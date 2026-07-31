import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const repoRoot = path.resolve(import.meta.dirname, "..");
const runtimeRoot = path.join(
  repoRoot,
  "factory-output",
  "commentary-remaining-ready",
);
const manifestPath = path.join(
  runtimeRoot,
  "remaining-commentary-manifest.json",
);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const failures = [];
let partitionBytes = 0;
let uncompressedBytes = 0;
let records = 0;
let largestPartition = null;

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

for (const partition of manifest.partitions) {
  const localPath = path.join(repoRoot, ...partition.local_path.split("/"));
  if (!fs.existsSync(localPath)) {
    failures.push({ storage_path: partition.storage_path, reason: "missing" });
    continue;
  }
  const compressed = fs.readFileSync(localPath);
  partitionBytes += compressed.length;
  if (!largestPartition || compressed.length > largestPartition.byte_size) {
    largestPartition = {
      storage_path: partition.storage_path,
      byte_size: compressed.length,
    };
  }
  if (compressed.length !== partition.byte_size) {
    failures.push({
      storage_path: partition.storage_path,
      reason: "byte_size",
    });
  }
  if (sha256(compressed) !== partition.sha256) {
    failures.push({ storage_path: partition.storage_path, reason: "sha256" });
  }
  let plain;
  try {
    plain = zlib.gunzipSync(compressed).toString("utf8");
  } catch {
    failures.push({ storage_path: partition.storage_path, reason: "gzip" });
    continue;
  }
  const byteSize = Buffer.byteLength(plain);
  uncompressedBytes += byteSize;
  if (byteSize !== partition.uncompressed_byte_size) {
    failures.push({
      storage_path: partition.storage_path,
      reason: "uncompressed_byte_size",
    });
  }
  const lines = plain.split("\n").filter(Boolean);
  records += lines.length;
  if (lines.length !== partition.records) {
    failures.push({
      storage_path: partition.storage_path,
      reason: "record_count",
    });
  }
  for (const line of lines) {
    try {
      JSON.parse(line);
    } catch {
      failures.push({
        storage_path: partition.storage_path,
        reason: "invalid_jsonl",
      });
      break;
    }
  }
}

const manifestBytes = fs.statSync(manifestPath).size;
const report = {
  generated_at: new Date().toISOString(),
  expected_partitions: manifest.partitions.length,
  validated_partitions: manifest.partitions.length - new Set(
    failures.map((item) => item.storage_path),
  ).size,
  expected_records: manifest.totals.accepted_records,
  validated_records: records,
  partition_bytes: partitionBytes,
  manifest_bytes: manifestBytes,
  exact_upload_bytes: partitionBytes + manifestBytes,
  exact_upload_mib: Number(
    ((partitionBytes + manifestBytes) / 1024 / 1024).toFixed(4),
  ),
  uncompressed_ready_bytes: uncompressedBytes,
  largest_partition: largestPartition,
  bucket_file_size_limit_bytes: 52_428_800,
  largest_partition_within_limit:
    Boolean(largestPartition) &&
    largestPartition.byte_size <= 52_428_800,
  failures,
};

fs.writeFileSync(
  path.join(runtimeRoot, "upload-readiness-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
