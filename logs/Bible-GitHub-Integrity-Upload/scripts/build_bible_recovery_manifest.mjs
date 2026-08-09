#!/usr/bin/env node

/*
 * Creates a recovery baseline without changing source data.  It records the
 * raw-source inventory, normalized outputs, and private runtime-content
 * inventory needed to rebuild the Bible service after a DB/Storage failure.
 *
 * Normal run:  node scripts/build_bible_recovery_manifest.mjs --bible-root <BIBLE>
 * Full checksum: node scripts/build_bible_recovery_manifest.mjs --bible-root <BIBLE> --hash
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(scriptDir, '..');
const privateRepo = path.resolve(publicRoot, '..', 'biblegongboo_repo');
const args = process.argv.slice(2);
const valueAfter = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : '';
const bibleRoot = path.resolve(valueAfter('--bible-root') || path.join(process.env.USERPROFILE || '', 'Desktop', 'gongboo.org', 'BIBLE'));
const withHash = args.includes('--hash');
const recoveryRoot = path.join(bibleRoot, 'data', 'recovery');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function allFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['.git', 'node_modules', '.DS_Store'].includes(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  if (fs.existsSync(root)) visit(root);
  return files.sort();
}
function toRecord(root, file) {
  const stat = fs.statSync(file);
  return {
    path: path.relative(root, file).replaceAll(path.sep, '/'),
    bytes: stat.size,
    modified_at: stat.mtime.toISOString(),
    ...(withHash ? { sha256: sha256(file) } : {})
  };
}
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
function writeJsonl(file, values) {
  fs.writeFileSync(file, `${values.map((value) => JSON.stringify(value)).join('\n')}\n`, 'utf8');
}
function csv(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

if (!fs.existsSync(bibleRoot)) throw new Error(`Bible root not found: ${bibleRoot}`);
const sourceRoot = path.join(bibleRoot, 'SOURCE');
const normalizedManifestFile = path.join(bibleRoot, 'data', 'normalized', 'manifest.json');
if (!fs.existsSync(sourceRoot)) throw new Error(`Source directory not found: ${sourceRoot}`);
if (!fs.existsSync(normalizedManifestFile)) throw new Error(`Normalized manifest not found: ${normalizedManifestFile}`);

fs.mkdirSync(recoveryRoot, { recursive: true });
const sourceFiles = allFiles(sourceRoot).map((file) => toRecord(sourceRoot, file));
const contentRoot = path.join(privateRepo, 'content');
const contentFiles = allFiles(contentRoot).map((file) => toRecord(privateRepo, file));
const normalized = JSON.parse(fs.readFileSync(normalizedManifestFile, 'utf8'));
const runtimeReportFile = path.join(privateRepo, 'supabase', 'runtime-content-migration-report.json');
const runtimeReport = fs.existsSync(runtimeReportFile)
  ? JSON.parse(fs.readFileSync(runtimeReportFile, 'utf8')) : null;

writeJsonl(path.join(recoveryRoot, 'source-file-inventory.jsonl'), sourceFiles);
writeJsonl(path.join(recoveryRoot, 'runtime-content-inventory.jsonl'), contentFiles);

const lineage = [
  ...((normalized.inputs || []).map((item) => ({ stage: 'source_input', path: item.file, sha256: item.sha256 || '', note: 'Normalizer input' }))),
  ...((normalized.outputs || []).map((item) => ({ stage: 'normalized_output', path: item.file, sha256: item.sha256 || '', note: 'Normalizer output' }))),
  ...contentFiles.map((item) => ({ stage: 'runtime_content', path: item.path, sha256: item.sha256 || '', note: 'Private Supabase Storage candidate' }))
];
const columns = ['stage', 'path', 'sha256', 'note'];
fs.writeFileSync(path.join(recoveryRoot, 'source-to-runtime-lineage.csv'),
  `${columns.join(',')}\r\n${lineage.map((row) => columns.map((key) => csv(row[key])).join(',')).join('\r\n')}\r\n`, 'utf8');

const manifest = {
  schema_version: '1.0',
  generated_at: new Date().toISOString(),
  purpose: 'Recovery baseline. Raw sources remain immutable; rebuild normalized data, runtime content, Supabase Storage, then DB from canonical scripts.',
  hash_mode: withHash ? 'sha256_all_files' : 'metadata_only',
  roots: { bible_root: bibleRoot, source_root: sourceRoot, private_runtime_content_root: contentRoot },
  source_inventory: { files: sourceFiles.length, bytes: sourceFiles.reduce((sum, item) => sum + item.bytes, 0), file: 'source-file-inventory.jsonl' },
  normalized_manifest: normalized,
  runtime_content_inventory: { files: contentFiles.length, bytes: contentFiles.reduce((sum, item) => sum + item.bytes, 0), file: 'runtime-content-inventory.jsonl' },
  runtime_storage_migration: runtimeReport,
  lineage_file: 'source-to-runtime-lineage.csv',
  recovery_order: ['restore SOURCE archive', 'run normalizers/factories', 'run full integrity audit', 'upload validated runtime content to Supabase Storage', 'import DB tables', 'run browser smoke tests']
};
writeJson(path.join(recoveryRoot, 'bible-recovery-manifest.json'), manifest);
console.log(JSON.stringify({ status: 'success', recoveryRoot, sourceFiles: sourceFiles.length, runtimeContentFiles: contentFiles.length, hashMode: manifest.hash_mode }, null, 2));
