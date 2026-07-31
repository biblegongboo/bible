import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtimeRoot = path.join(
  repoRoot,
  "factory-output",
  "commentary-runtime",
);
const manifestPath = path.join(runtimeRoot, "commentary-manifest.json");
const reportPath = path.join(runtimeRoot, "supabase-migration-report.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envArg = args.find((arg) => arg.startsWith("--env="));
const defaultEnvPath =
  process.env.BIBLE_SUPABASE_ENV ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config.env.supabase.local";

function loadEnv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

loadEnv(envArg ? path.resolve(envArg.slice(6)) : defaultEnvPath);
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "",
);
if (!dryRun && (!supabaseUrl || !serviceKey)) {
  throw new Error("Supabase URL and secret key are required.");
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sourceIdFor = (value) =>
  `COMMENTARY-${String(value).toUpperCase().replace(/[^A-Z0-9]+/g, "-")}`;
const sha256 = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");
const assetId = (storagePath) =>
  `ASSET-${sha256(Buffer.from(storagePath)).slice(0, 24)}`;

const sourceRows = [
  {
    source_id: "BIBLE-COMMENTARY-CATALOG",
    content_type: "commentary-catalog",
    title: "Bible commentary catalog",
    author: "Bible GongBoo",
    source_url: null,
    license_label: "source-recorded",
    status: "active",
    enabled: true,
    image_enabled: false,
    commentary_enabled: true,
    display_order: 40,
    metadata: { managed_by: "migrate_commentary_to_supabase.mjs" },
  },
  ...manifest.sources.map((source, index) => ({
    source_id: sourceIdFor(source.source_id),
    content_type: "verse-commentary",
    title: source.title,
    author: source.author,
    source_url: source.source_url,
    license_label: source.license || "source-recorded",
    status: "active",
    enabled: true,
    image_enabled: false,
    commentary_enabled: true,
    display_order: 50 + index,
    metadata: {
      original_source_id: source.source_id,
      contributors: source.contributors,
      records: source.records,
      books: source.books,
      managed_by: "migrate_commentary_to_supabase.mjs",
    },
  })),
];

const manifestStoragePath = "commentary/commentary-manifest.json";
const manifestBuffer = fs.readFileSync(manifestPath);
const assets = [
  {
    asset_id: assetId(manifestStoragePath),
    source_id: "BIBLE-COMMENTARY-CATALOG",
    asset_type: "commentary-manifest",
    storage_bucket: "bible-content",
    storage_path: manifestStoragePath,
    content_type: "application/json;charset=utf-8",
    byte_size: manifestBuffer.length,
    sha256: sha256(manifestBuffer),
    enabled: true,
    metadata: { records: manifest.record_count },
    localPath: manifestPath,
  },
  ...manifest.partitions.map((partition) => ({
    asset_id: assetId(partition.storage_path),
    source_id: sourceIdFor(partition.source_id),
    asset_type: "verse-commentary",
    storage_bucket: "bible-content",
    storage_path: partition.storage_path,
    content_type: "application/gzip",
    byte_size: partition.byte_size,
    sha256: partition.sha256,
    enabled: true,
    metadata: {
      book: partition.book,
      records: partition.records,
      uncompressed_byte_size: partition.uncompressed_byte_size,
    },
    localPath: path.join(repoRoot, ...partition.local_path.split("/")),
  })),
];

function headers(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function fetchWithRetry(url, options, label) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status < 500 && response.status !== 429) return response;
      lastError = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 5) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(8000, 1000 * 2 ** (attempt - 1))),
      );
    }
  }
  throw lastError;
}

async function upsert(table, rows, conflict) {
  if (dryRun || rows.length === 0) return;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("on_conflict", conflict);
  const response = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: headers({
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(rows),
    },
    `${table} upsert`,
  );
  if (!response.ok) {
    throw new Error(
      `${table} upsert failed: ${response.status} ${await response.text()}`,
    );
  }
}

function encodeStoragePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function remoteHashes() {
  if (dryRun) return new Map();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/bible_content_assets?select=storage_path,sha256&storage_path=like.commentary/*`,
    { headers: headers({ Accept: "application/json" }) },
  );
  if (!response.ok) throw new Error(`Remote asset read failed: ${response.status}`);
  return new Map(
    (await response.json()).map((row) => [row.storage_path, row.sha256]),
  );
}

async function upload(asset) {
  const response = await fetchWithRetry(
    `${supabaseUrl}/storage/v1/object/${asset.storage_bucket}/${encodeStoragePath(asset.storage_path)}`,
    {
      method: "POST",
      headers: headers({
        "Content-Type": asset.content_type,
        "x-upsert": "true",
      }),
      body: fs.readFileSync(asset.localPath),
    },
    asset.storage_path,
  );
  if (!response.ok) {
    throw new Error(
      `Upload failed ${asset.storage_path}: ${response.status} ${await response.text()}`,
    );
  }
}

const previous = await remoteHashes();
const changed = assets.filter(
  (asset) => previous.get(asset.storage_path) !== asset.sha256,
);
console.log(
  JSON.stringify({
    mode: dryRun ? "dry-run" : "upload",
    sources: sourceRows.length,
    assets: assets.length,
    changed: changed.length,
    records: manifest.record_count,
    mib: Number(
      (assets.reduce((sum, asset) => sum + asset.byte_size, 0) / 1024 / 1024).toFixed(2),
    ),
  }),
);

if (!dryRun) {
  await upsert("content_sources", sourceRows, "source_id");
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < changed.length) {
      const asset = changed[cursor++];
      await upload(asset);
      const { localPath, ...row } = asset;
      await upsert("bible_content_assets", [row], "asset_id");
      completed += 1;
      if (completed % 25 === 0 || completed === changed.length) {
        console.log(`storage: ${completed}/${changed.length}`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(6, Math.max(1, changed.length)) }, worker),
  );
  await upsert(
    "bible_content_assets",
    assets.map(({ localPath, ...row }) => row),
    "asset_id",
  );
}

const remote = await remoteHashes();
const failures = assets
  .filter((asset) => remote.get(asset.storage_path) !== asset.sha256)
  .map((asset) => asset.storage_path);
const report = {
  generated_at: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "upload",
  sources: sourceRows.length,
  assets: assets.length,
  uploaded_or_changed: changed.length,
  records: manifest.record_count,
  total_bytes: assets.reduce((sum, asset) => sum + asset.byte_size, 0),
  validation: {
    expected: assets.length,
    matched: assets.length - failures.length,
    failures,
  },
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report));
