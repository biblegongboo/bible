#!/usr/bin/env node

/* Live Supabase Storage audit. Never commit a key: this reads it only from a
 * local env file or process environment, compares the canonical private
 * runtime files with bible_content_assets, then optionally hashes every live
 * Storage object. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(scriptDir, '..');
const args = process.argv.slice(2);
const option = (name, fallback = '') => {
  const found = args.find((item) => item.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};
const privateRoot = path.resolve(option('--private-root', path.resolve(publicRoot, '..', 'biblegongboo_repo')));
const envPath = option('--env', process.env.BIBLE_SUPABASE_ENV || 'C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config.env.supabase.local');
const metadataOnly = args.includes('--metadata-only');
const concurrency = Math.max(1, Math.min(16, Number(option('--concurrency', '8')) || 8));
const failures = [];
const fail = (message) => failures.push(message);

function loadEnv(file) {
  if (!file || !fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : entry.isFile() ? [full] : [];
  });
}
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function encodePath(value) { return value.split('/').map(encodeURIComponent).join('/'); }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function request(url, options, label) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status !== 429 && response.status < 500) return response;
      last = new Error(`${label}: HTTP ${response.status}`);
    } catch (error) { last = error; }
    await sleep(500 * attempt);
  }
  throw last;
}

loadEnv(path.resolve(envPath));
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const secret = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
if (!supabaseUrl || !secret) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required locally.');

const contentRoot = path.join(privateRoot, 'content');
if (!fs.existsSync(contentRoot)) throw new Error(`Canonical private content is missing: ${contentRoot}`);
const selectedDirectories = ['knowledge', 'patristic-reader'];
const rootFiles = fs.readdirSync(contentRoot, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => path.join(contentRoot, entry.name));
const localFiles = [...rootFiles, ...selectedDirectories.flatMap((name) => walk(path.join(contentRoot, name)))].sort();
const expected = new Map(localFiles.map((file) => {
  const buffer = fs.readFileSync(file);
  const storagePath = path.relative(privateRoot, file).split(path.sep).join('/');
  return [storagePath, { bytes: buffer.length, sha256: sha256(buffer) }];
}));
const headers = { apikey: secret, Authorization: `Bearer ${secret}` };
const response = await request(`${supabaseUrl}/rest/v1/bible_content_assets?select=storage_path,sha256,byte_size,storage_bucket&enabled=eq.true`, { headers }, 'asset index');
if (!response.ok) throw new Error(`Cannot read bible_content_assets: HTTP ${response.status}`);
const remoteRows = await response.json();
const remote = new Map(remoteRows.map((row) => [row.storage_path, row]));
for (const [storagePath, local] of expected) {
  const row = remote.get(storagePath);
  if (!row) { fail(`Asset index missing: ${storagePath}`); continue; }
  if (row.sha256 !== local.sha256) fail(`Checksum mismatch in asset index: ${storagePath}`);
  if (Number(row.byte_size) !== local.bytes) fail(`Size mismatch in asset index: ${storagePath}`);
}

let objectChecks = 0;
if (!metadataOnly) {
  const jobs = [...expected.entries()];
  let nextJob = 0;
  async function worker() {
    while (nextJob < jobs.length) {
      const [storagePath, local] = jobs[nextJob++];
    const row = remote.get(storagePath);
    if (!row) continue;
    const object = await request(`${supabaseUrl}/storage/v1/object/authenticated/${row.storage_bucket || 'bible-content'}/${encodePath(storagePath)}`, { headers }, `Storage object ${storagePath}`);
    objectChecks += 1;
    if (!object.ok) { fail(`Storage object unavailable: ${storagePath} (HTTP ${object.status})`); continue; }
    const bytes = Buffer.from(await object.arrayBuffer());
    if (sha256(bytes) !== local.sha256) fail(`Storage object checksum mismatch: ${storagePath}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
}
console.log(JSON.stringify({ status: failures.length ? 'failed' : 'passed', checked_at: new Date().toISOString(), expected_assets: expected.size, indexed_assets: remote.size, object_checks: objectChecks, metadata_only: metadataOnly, concurrency, failures }, null, 2));
if (failures.length) process.exit(1);
