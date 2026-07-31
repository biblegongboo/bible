import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(repoRoot, "content");
const reportPath = path.join(
  repoRoot,
  "supabase",
  "runtime-content-migration-report.json",
);
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const envArg = args.find((arg) => arg.startsWith("--env="));
const defaultEnvPath =
  process.env.BIBLE_SUPABASE_ENV ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config.env.supabase.local";

function loadEnv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
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

loadEnv(envArg ? path.resolve(envArg.slice("--env=".length)) : defaultEnvPath);

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "",
);

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) are required.",
  );
}

const sourceRows = [
  {
    source_id: "BIBLE-RUNTIME-MAPS",
    content_type: "map",
    title: "Bible GongBoo map, place, journey, timeline, and context factories",
    author: "Bible GongBoo",
    source_url: null,
    license_label: "mixed-source-metadata",
    status: "active",
    enabled: true,
    image_enabled: true,
    commentary_enabled: false,
    display_order: 10,
    metadata: { managed_by: "migrate_runtime_content_to_supabase.mjs" },
  },
  {
    source_id: "BIBLE-KNOWLEDGE",
    content_type: "knowledge",
    title: "Bible GongBoo Scripture knowledge extensions",
    author: "Bible GongBoo",
    source_url: null,
    license_label: "mixed-source-metadata",
    status: "active",
    enabled: true,
    image_enabled: true,
    commentary_enabled: false,
    display_order: 20,
    metadata: { managed_by: "migrate_runtime_content_to_supabase.mjs" },
  },
  {
    source_id: "BIBLE-PATRISTIC",
    content_type: "document",
    title: "Early Church and historical Christian writings",
    author: null,
    source_url: null,
    license_label: "source-recorded-public-material",
    status: "active",
    enabled: true,
    image_enabled: false,
    commentary_enabled: false,
    display_order: 30,
    metadata: { managed_by: "migrate_runtime_content_to_supabase.mjs" },
  },
];

function walk(directory) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(fullPath));
    else if (entry.isFile()) output.push(fullPath);
  }
  return output;
}

function runtimeFiles() {
  const rootFiles = fs
    .readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(contentRoot, entry.name));
  const knowledgeFiles = walk(path.join(contentRoot, "knowledge"));
  const readerFiles = walk(path.join(contentRoot, "patristic-reader"));
  return [...rootFiles, ...knowledgeFiles, ...readerFiles].sort();
}

function mimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return (
    {
      ".json": "application/json;charset=utf-8",
      ".jsonl": "application/x-ndjson;charset=utf-8",
      ".geojson": "application/geo+json;charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".pdf": "application/pdf",
    }[extension] || "application/octet-stream"
  );
}

function sourceFor(relativePath) {
  if (relativePath.startsWith("content/patristic-reader/")) {
    return "BIBLE-PATRISTIC";
  }
  if (
    relativePath.startsWith("content/knowledge/") ||
    /patristic-(deep-index|reader-manifest)\.json$/.test(relativePath)
  ) {
    return relativePath.includes("patristic")
      ? "BIBLE-PATRISTIC"
      : "BIBLE-KNOWLEDGE";
  }
  return "BIBLE-RUNTIME-MAPS";
}

function typeFor(relativePath) {
  if (relativePath.includes("/patristic")) return "patristic";
  if (relativePath.includes("/knowledge/images/")) return "image-metadata";
  if (relativePath.includes("/knowledge/concordance/")) return "concordance";
  if (relativePath.includes("/knowledge/")) return "knowledge";
  if (/map|geograph|roads|places|journey/i.test(relativePath)) return "map";
  if (/timeline|context|people/i.test(relativePath)) return "context";
  return "runtime-data";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assetRows() {
  return runtimeFiles().map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    const relativePath = path
      .relative(repoRoot, filePath)
      .split(path.sep)
      .join("/");
    return {
      asset_id: `ASSET-${sha256(Buffer.from(relativePath)).slice(0, 24)}`,
      source_id: sourceFor(relativePath),
      asset_type: typeFor(relativePath),
      storage_bucket: "bible-content",
      storage_path: relativePath,
      content_type: mimeType(filePath),
      byte_size: buffer.length,
      sha256: sha256(buffer),
      enabled: true,
      metadata: { original_relative_path: relativePath },
      localPath: filePath,
    };
  });
}

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
      lastError = new Error(`${label} returned HTTP ${response.status}`);
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

async function upsert(table, rows, onConflict) {
  if (dryRun || rows.length === 0) return;
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  url.searchParams.set("on_conflict", onConflict);
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

async function remoteAssets() {
  if (dryRun) return new Map();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/bible_content_assets?select=storage_path,sha256`,
    { headers: headers({ Accept: "application/json" }) },
  );
  if (!response.ok) {
    throw new Error(
      `Unable to read existing assets: ${response.status} ${await response.text()}`,
    );
  }
  return new Map(
    (await response.json()).map((row) => [row.storage_path, row.sha256]),
  );
}

function encodeStoragePath(value) {
  return value.split("/").map(encodeURIComponent).join("/");
}

async function uploadAsset(asset) {
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
    `Storage upload ${asset.storage_path}`,
  );
  if (!response.ok) {
    throw new Error(
      `Upload failed for ${asset.storage_path}: ${response.status} ${await response.text()}`,
    );
  }
}

async function validate(expectedAssets) {
  if (dryRun) return null;
  const response = await fetch(
    `${supabaseUrl}/rest/v1/bible_content_assets?select=storage_path,sha256,byte_size&enabled=eq.true`,
    { headers: headers({ Accept: "application/json" }) },
  );
  if (!response.ok) {
    throw new Error(`Validation query failed: HTTP ${response.status}`);
  }
  const actual = new Map((await response.json()).map((row) => [row.storage_path, row]));
  const failures = expectedAssets
    .filter((asset) => {
      const row = actual.get(asset.storage_path);
      return (
        !row ||
        row.sha256 !== asset.sha256 ||
        Number(row.byte_size) !== asset.byte_size
      );
    })
    .map((asset) => asset.storage_path);
  return {
    expected: expectedAssets.length,
    matched: expectedAssets.length - failures.length,
    failures,
  };
}

const assets = assetRows();
const previous = await remoteAssets();
const changed = assets.filter(
  (asset) => previous.get(asset.storage_path) !== asset.sha256,
);

console.log(
  JSON.stringify(
    {
      mode: dryRun ? "dry-run" : "upload",
      files: assets.length,
      changed: changed.length,
      bytes: assets.reduce((sum, asset) => sum + asset.byte_size, 0),
      megabytes: Number(
        (assets.reduce((sum, asset) => sum + asset.byte_size, 0) / 1024 / 1024).toFixed(2),
      ),
    },
    null,
    2,
  ),
);

if (!dryRun) {
  await upsert("content_sources", sourceRows, "source_id");
  let nextUploadIndex = 0;
  let completedUploads = 0;
  const uploadWorker = async () => {
    while (nextUploadIndex < changed.length) {
      const asset = changed[nextUploadIndex];
      nextUploadIndex += 1;
      await uploadAsset(asset);
      const { localPath, ...assetRow } = asset;
      await upsert("bible_content_assets", [assetRow], "asset_id");
      completedUploads += 1;
      if (
        completedUploads % 25 === 0 ||
        completedUploads === changed.length
      ) {
        console.log(`storage: ${completedUploads}/${changed.length}`);
      }
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(8, Math.max(1, changed.length)) },
      () => uploadWorker(),
    ),
  );
  await upsert(
    "bible_content_assets",
    assets.map(({ localPath, ...row }) => row),
    "asset_id",
  );
}

const validation = await validate(assets);
const report = {
  generated_at: new Date().toISOString(),
  mode: dryRun ? "dry-run" : "upload",
  source_count: sourceRows.length,
  asset_count: assets.length,
  changed_asset_count: changed.length,
  total_bytes: assets.reduce((sum, asset) => sum + asset.byte_size, 0),
  excluded: [
    "content/patristic/** duplicate working copies",
    "commentary source files",
    "factory intermediate files",
  ],
  validation,
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`report: ${reportPath}`);
