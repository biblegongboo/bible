import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot =
  process.argv[2] ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\SOURCE\\주석";
const outputRoot = path.join(
  repoRoot,
  "factory-output",
  "commentary-remaining-ready",
);
const partitionRoot = path.join(outputRoot, "partitions");
const maxPartitionBytes = 8 * 1024 * 1024;

const fileCategories = {
  "church_fathers.jsonl": "church-father-quotes",
  "reference_entry.jsonl": "reference",
  "sermon.jsonl": "sermon",
  "hymn_collection.jsonl": "hymn",
  "structured_text.jsonl": "historical-work",
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.isFile() ? [target] : [];
  });
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function slug(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizedPerson(value) {
  return normalizeText(value)
    .replace(/\b(saint|st\.?|rev\.?|reverend|bishop|pope)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sourcePair(record) {
  return `${normalizeText(record._source_title)}|${normalizedPerson(
    record._author || record.author,
  )}`;
}

function loadExistingPatristic() {
  const indexPath = path.join(repoRoot, "content", "patristic-deep-index.json");
  const manifestPath = path.join(
    repoRoot,
    "content",
    "patristic-reader-manifest.json",
  );
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pairs = new Set(
    (index.records || []).map(
      (record) =>
        `${normalizeText(record.title)}|${normalizedPerson(record.author)}`,
    ),
  );
  const textHashes = new Set();
  for (const entry of manifest.records || []) {
    const filePath = path.join(repoRoot, ...entry.file.split("/"));
    if (!fs.existsSync(filePath)) continue;
    const reader = JSON.parse(fs.readFileSync(filePath, "utf8"));
    for (const block of reader.blocks || []) {
      const normalized = normalizeText(block.text);
      if (normalized) textHashes.add(sha256(normalized));
    }
  }
  return { pairs, textHashes };
}

async function readJsonlRecovering(filePath) {
  const records = [];
  const failures = [];
  let lineNumber = 0;
  let buffer = "";
  let bufferStart = 0;
  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    lineNumber += 1;
    if (!buffer) {
      try {
        records.push(JSON.parse(line));
        continue;
      } catch {
        if (!line.trimStart().startsWith("{")) {
          failures.push({ line: lineNumber, reason: "orphan-fragment" });
          continue;
        }
        buffer = line;
        bufferStart = lineNumber;
        continue;
      }
    }
    buffer += `\\n${line}`;
    try {
      records.push(JSON.parse(buffer));
      buffer = "";
      bufferStart = 0;
    } catch {
      // Continue until the multiline JSON record closes.
    }
  }
  if (buffer) failures.push({ line: bufferStart, reason: "unclosed-record" });
  return { records, failures };
}

function dedupKey(category, record) {
  if (category === "church-father-quotes") {
    return [
      record._source_id,
      record.anchor_ref,
      normalizeText(record.quote),
    ].join("|");
  }
  if (category === "reference") {
    return [
      record._source_id,
      normalizeText(record.term),
      sha256(normalizeText(JSON.stringify(record.definition_blocks || []))),
    ].join("|");
  }
  if (category === "sermon") {
    return [
      record._source_id,
      record.sermon_id || normalizeText(record.title),
      sha256(normalizeText(JSON.stringify(record.content_blocks || []))),
    ].join("|");
  }
  if (category === "hymn") {
    return [
      record._source_id,
      record.entry_id || normalizeText(record.title),
      sha256(normalizeText(JSON.stringify(record.stanzas || []))),
    ].join("|");
  }
  return [
    record._source_id,
    record.section_path,
    record.block_index,
    sha256(normalizeText(record.text)),
  ].join("|");
}

function primaryText(category, record) {
  if (category === "church-father-quotes") return record.quote;
  if (category === "historical-work") return record.text;
  return "";
}

function compactRecord(record) {
  const output = {};
  for (const [key, value] of Object.entries(record)) {
    if (
      [
        "_source_title",
        "_author",
        "_contributors",
        "_schema_type",
        "_license",
        "_source_url",
      ].includes(key)
    ) {
      continue;
    }
    output[key] = value;
  }
  return output;
}

function flushPartition(category, sourceId, part, records, partitions) {
  if (!records.length) return;
  const directory = path.join(partitionRoot, category, sourceId);
  fs.mkdirSync(directory, { recursive: true });
  const fileName = `part-${String(part).padStart(3, "0")}.jsonl.gz`;
  const localPath = path.join(directory, fileName);
  const ndjson = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const compressed = zlib.gzipSync(Buffer.from(ndjson), { level: 9 });
  fs.writeFileSync(localPath, compressed);
  partitions.push({
    category,
    source_id: sourceId,
    part,
    records: records.length,
    storage_path: `commentary/${category}/${sourceId}/${fileName}`,
    local_path: path.relative(repoRoot, localPath).split(path.sep).join("/"),
    byte_size: compressed.length,
    uncompressed_byte_size: Buffer.byteLength(ndjson),
    sha256: sha256(compressed),
  });
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(partitionRoot, { recursive: true });

const existing = loadExistingPatristic();
const inputFiles = walk(sourceRoot).filter((filePath) =>
  Object.hasOwn(fileCategories, path.basename(filePath)),
);
const categoryReports = [];
const allPartitions = [];
const sourceCatalog = new Map();
const excludedAudit = [];

function auditExclusion(category, reason, record = {}, details = {}) {
  excludedAudit.push({
    category,
    reason,
    source_id: record._source_id || null,
    record_id:
      record.entry_id ||
      record.sermon_id ||
      record.work_id ||
      record.section_path ||
      null,
    label:
      record.title ||
      record.term ||
      record.anchor_ref ||
      record.section_title ||
      null,
    ...details,
  });
}

for (const filePath of inputFiles.sort()) {
  const fileName = path.basename(filePath);
  const category = fileCategories[fileName];
  const { records, failures } = await readJsonlRecovering(filePath);
  const seen = new Set();
  const acceptedBySource = new Map();
  const exclusions = {
    internal_duplicate: 0,
    existing_easton_source: 0,
    existing_patristic_work: 0,
    existing_patristic_text: 0,
    invalid: failures.length,
  };
  let recoveredRecords = fileName === "hymn_collection.jsonl" ? 1 : 0;
  for (const failure of failures) {
    auditExclusion(category, "invalid", {}, failure);
  }

  for (const record of records) {
    const sourceId = slug(record._source_id);
    const key = dedupKey(category, record);
    if (seen.has(key)) {
      exclusions.internal_duplicate += 1;
      auditExclusion(category, "internal_duplicate", record);
      continue;
    }
    seen.add(key);

    if (
      category === "reference" &&
      sourceId === "eastons-bible-dictionary"
    ) {
      exclusions.existing_easton_source += 1;
      auditExclusion(category, "existing_easton_source", record);
      continue;
    }
    if (
      category === "historical-work" &&
      existing.pairs.has(sourcePair(record))
    ) {
      exclusions.existing_patristic_work += 1;
      auditExclusion(category, "existing_patristic_work", record);
      continue;
    }
    const text = primaryText(category, record);
    if (
      text &&
      existing.textHashes.has(sha256(normalizeText(text)))
    ) {
      exclusions.existing_patristic_text += 1;
      auditExclusion(category, "existing_patristic_text", record);
      continue;
    }

    if (!acceptedBySource.has(sourceId)) acceptedBySource.set(sourceId, []);
    acceptedBySource.get(sourceId).push(compactRecord(record));
    if (!sourceCatalog.has(`${category}/${sourceId}`)) {
      sourceCatalog.set(`${category}/${sourceId}`, {
        category,
        source_id: sourceId,
        title: record._source_title || sourceId,
        author: record._author || record.author || null,
        contributors: record._contributors || [],
        license: record._license || null,
        source_url: record._source_url || null,
        records: 0,
      });
    }
    sourceCatalog.get(`${category}/${sourceId}`).records += 1;
  }

  const categoryPartitions = [];
  for (const [sourceId, sourceRecords] of [...acceptedBySource].sort()) {
    let part = 1;
    let current = [];
    let currentBytes = 0;
    for (const record of sourceRecords) {
      const size = Buffer.byteLength(JSON.stringify(record)) + 1;
      if (current.length && currentBytes + size > maxPartitionBytes) {
        flushPartition(
          category,
          sourceId,
          part++,
          current,
          categoryPartitions,
        );
        current = [];
        currentBytes = 0;
      }
      current.push(record);
      currentBytes += size;
    }
    flushPartition(category, sourceId, part, current, categoryPartitions);
  }
  allPartitions.push(...categoryPartitions);
  const accepted = [...acceptedBySource.values()].reduce(
    (sum, items) => sum + items.length,
    0,
  );
  categoryReports.push({
    category,
    file: fileName,
    raw_input_bytes: fs.statSync(filePath).size,
    parsed_records: records.length,
    recovered_records: recoveredRecords,
    accepted_records: accepted,
    excluded_records: Object.values(exclusions).reduce(
      (sum, value) => sum + value,
      0,
    ),
    exclusions,
    sources: acceptedBySource.size,
    partitions: categoryPartitions.length,
    upload_bytes: categoryPartitions.reduce(
      (sum, item) => sum + item.byte_size,
      0,
    ),
    uncompressed_ready_bytes: categoryPartitions.reduce(
      (sum, item) => sum + item.uncompressed_byte_size,
      0,
    ),
  });
}

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_root: sourceRoot,
  strategy: {
    partition: "category/source/max-8MiB-uncompressed",
    compression: "gzip-level-9",
    duplicate_rules: [
      "category-specific internal identity",
      "exclude curated Easton because Theographic Easton is already live",
      "exclude historical works matching existing Patristic title and author",
      "exclude exact normalized Patristic reader block text",
    ],
  },
  existing_reference_sets: {
    patristic_title_author_pairs: existing.pairs.size,
    patristic_text_hashes: existing.textHashes.size,
  },
  categories: categoryReports,
  sources: [...sourceCatalog.values()].sort((a, b) =>
    `${a.category}/${a.source_id}`.localeCompare(
      `${b.category}/${b.source_id}`,
    ),
  ),
  partitions: allPartitions,
  totals: {
    parsed_records: categoryReports.reduce(
      (sum, item) => sum + item.parsed_records,
      0,
    ),
    accepted_records: categoryReports.reduce(
      (sum, item) => sum + item.accepted_records,
      0,
    ),
    excluded_records: categoryReports.reduce(
      (sum, item) => sum + item.excluded_records,
      0,
    ),
    sources: sourceCatalog.size,
    partitions: allPartitions.length,
    upload_bytes: allPartitions.reduce(
      (sum, item) => sum + item.byte_size,
      0,
    ),
    uncompressed_ready_bytes: allPartitions.reduce(
      (sum, item) => sum + item.uncompressed_byte_size,
      0,
    ),
  },
};

const manifestPath = path.join(outputRoot, "remaining-commentary-manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const manifestBytes = fs.statSync(manifestPath).size;
const exactUploadBytes = manifest.totals.upload_bytes + manifestBytes;
const report = {
  ...manifest,
  exact_upload: {
    partition_bytes: manifest.totals.upload_bytes,
    manifest_bytes: manifestBytes,
    total_bytes: exactUploadBytes,
    total_mib: Number((exactUploadBytes / 1024 / 1024).toFixed(4)),
    total_mb_decimal: Number((exactUploadBytes / 1_000_000).toFixed(4)),
  },
};
fs.writeFileSync(
  path.join(outputRoot, "validation-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(outputRoot, "excluded-records.jsonl"),
  excludedAudit.map((record) => JSON.stringify(record)).join("\n") +
    (excludedAudit.length ? "\n" : ""),
);
console.log(JSON.stringify(report.exact_upload, null, 2));
console.log(
  JSON.stringify(
    categoryReports.map((item) => ({
      category: item.category,
      parsed: item.parsed_records,
      accepted: item.accepted_records,
      excluded: item.excluded_records,
      sources: item.sources,
      partitions: item.partitions,
      upload_mib: Number((item.upload_bytes / 1024 / 1024).toFixed(4)),
      exclusions: item.exclusions,
    })),
    null,
    2,
  ),
);
