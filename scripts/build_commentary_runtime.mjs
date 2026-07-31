import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const repoRoot = path.resolve(import.meta.dirname, "..");
const sourceFile =
  process.argv[2] ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\SOURCE\\주석\\교부 및 역사적 주석을 모은 큐레이션된 데이터셋 (AD 100-1700)\\commentary.jsonl";
const outputRoot = path.join(
  repoRoot,
  "factory-output",
  "commentary-runtime",
);
const partitionRoot = path.join(outputRoot, "partitions");

function safeSlug(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(partitionRoot, { recursive: true });

const groups = new Map();
const sources = new Map();
let inputRows = 0;
let malformedRows = 0;

const lines = readline.createInterface({
  input: fs.createReadStream(sourceFile),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  if (!line.trim()) continue;
  inputRows += 1;
  let record;
  try {
    record = JSON.parse(line);
  } catch {
    malformedRows += 1;
    continue;
  }

  const sourceId = safeSlug(record._source_id);
  const book = safeSlug(record.book_osis || record.book);
  const groupKey = `${sourceId}/${book}`;
  if (!groups.has(groupKey)) groups.set(groupKey, []);
  groups.get(groupKey).push({
    entry_id: record.entry_id || null,
    book: record.book || null,
    book_osis: record.book_osis || null,
    book_number: record.book_number ?? null,
    chapter: record.chapter ?? null,
    verse_range: record.verse_range || null,
    verse_range_osis: record.verse_range_osis || null,
    verse_text: record.verse_text || null,
    commentary_text: record.commentary_text || null,
    summary: record.summary || null,
    key_quote: record.key_quote || null,
    cross_references: record.cross_references || [],
    word_count: record.word_count ?? null,
  });

  if (!sources.has(sourceId)) {
    sources.set(sourceId, {
      source_id: sourceId,
      title: record._source_title || sourceId,
      author: record._author || record.author || null,
      contributors: record._contributors || [],
      license: record._license || null,
      source_url: record._source_url || null,
      records: 0,
      books: new Set(),
    });
  }
  const source = sources.get(sourceId);
  source.records += 1;
  source.books.add(book);
}

const partitions = [];
for (const [groupKey, records] of [...groups.entries()].sort()) {
  const [sourceId, book] = groupKey.split("/");
  const relativePath = `commentary/verse/${sourceId}/${book}.jsonl.gz`;
  const localPath = path.join(partitionRoot, sourceId, `${book}.jsonl.gz`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  const ndjson = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
  const compressed = zlib.gzipSync(Buffer.from(ndjson), { level: 9 });
  fs.writeFileSync(localPath, compressed);
  partitions.push({
    source_id: sourceId,
    book,
    records: records.length,
    storage_path: relativePath,
    local_path: path.relative(repoRoot, localPath).split(path.sep).join("/"),
    byte_size: compressed.length,
    uncompressed_byte_size: Buffer.byteLength(ndjson),
    sha256: sha256(compressed),
  });
}

const manifest = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  category: "verse-commentary",
  source_file: path.basename(sourceFile),
  input_rows: inputRows,
  malformed_rows: malformedRows,
  source_count: sources.size,
  partition_count: partitions.length,
  record_count: partitions.reduce((sum, item) => sum + item.records, 0),
  compressed_bytes: partitions.reduce((sum, item) => sum + item.byte_size, 0),
  uncompressed_bytes: partitions.reduce(
    (sum, item) => sum + item.uncompressed_byte_size,
    0,
  ),
  sources: [...sources.values()]
    .map((source) => ({
      ...source,
      books: [...source.books].sort(),
    }))
    .sort((a, b) => a.source_id.localeCompare(b.source_id)),
  partitions,
};

fs.writeFileSync(
  path.join(outputRoot, "commentary-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

console.log(
  JSON.stringify(
    {
      input_rows: manifest.input_rows,
      malformed_rows: manifest.malformed_rows,
      sources: manifest.source_count,
      partitions: manifest.partition_count,
      records: manifest.record_count,
      compressed_mib: Number(
        (manifest.compressed_bytes / 1024 / 1024).toFixed(2),
      ),
      largest_partition_mib: Number(
        (
          Math.max(...partitions.map((item) => item.byte_size)) /
          1024 /
          1024
        ).toFixed(2),
      ),
      output: outputRoot,
    },
    null,
    2,
  ),
);
