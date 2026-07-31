import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";

const sourceRoot =
  process.argv[2] ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\SOURCE\\주석";

function findJsonlFiles(root) {
  const results = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) results.push(...findJsonlFiles(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".jsonl")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

async function auditFile(filePath) {
  let rows = 0;
  let malformed = 0;
  let rawBytes = 0;
  let compressedBytes = 0;
  const sourceIds = new Set();
  const licenses = new Map();
  let firstKeys = [];

  const gzip = zlib.createGzip({ level: 6 });
  gzip.on("data", (chunk) => {
    compressedBytes += chunk.length;
  });
  fs.createReadStream(filePath).pipe(gzip);

  const lines = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    rows += 1;
    rawBytes += Buffer.byteLength(line) + 1;
    try {
      const record = JSON.parse(line);
      if (rows === 1) firstKeys = Object.keys(record);
      if (record._source_id) sourceIds.add(String(record._source_id));
      const license = String(record._license || "missing").trim().toLowerCase();
      licenses.set(license, (licenses.get(license) || 0) + 1);
    } catch {
      malformed += 1;
    }
  }

  await new Promise((resolve, reject) => {
    gzip.once("end", resolve);
    gzip.once("error", reject);
  });

  return {
    file: path.basename(filePath),
    rows,
    malformed,
    sources: sourceIds.size,
    rawMiB: Number((rawBytes / 1024 / 1024).toFixed(2)),
    gzipMiB: Number((compressedBytes / 1024 / 1024).toFixed(2)),
    licenseKinds: licenses.size,
    licenses: Object.fromEntries(
      [...licenses.entries()].sort((a, b) => b[1] - a[1]),
    ),
    firstKeys,
  };
}

const results = [];
for (const filePath of findJsonlFiles(sourceRoot)) {
  results.push(await auditFile(filePath));
}

const summary = {
  sourceRoot,
  files: results.length,
  rows: results.reduce((sum, item) => sum + item.rows, 0),
  malformed: results.reduce((sum, item) => sum + item.malformed, 0),
  rawMiB: Number(
    results.reduce((sum, item) => sum + item.rawMiB, 0).toFixed(2),
  ),
  gzipMiB: Number(
    results.reduce((sum, item) => sum + item.gzipMiB, 0).toFixed(2),
  ),
  results,
};

console.log(JSON.stringify(summary, null, 2));
