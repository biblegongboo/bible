#!/usr/bin/env node

/*
 * Pre-publication guard for content that is intentionally private in
 * Supabase Storage.  It catches stale public ./content/ references before a
 * GitHub Pages deployment can silently remove contextual Bible links.
 *
 * Usage:
 *   node scripts/verify_supabase_content_links.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(scriptDirectory, '..');
const privateRoot = path.resolve(publicRoot, '..', 'biblegongboo_repo');
const appRoot = path.join(publicRoot, 'supabase', 'app');
const privateContent = path.join(privateRoot, 'content');
const failures = [];
const passed = [];

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function requireCheck(condition, message) {
  if (condition) passed.push(message);
  else failures.push(message);
}

const mainFile = path.join(appRoot, 'main.js');
const main = read(mainFile);
requireCheck(
  main.includes("fetchContent('content/people-index.json')"),
  'People name index uses Supabase Storage when configured'
);
requireCheck(
  main.includes("fetchContent('content/bible-context-links.json')"),
  'People context links use Supabase Storage when configured'
);

const explorerFile = path.join(appRoot, 'bible-explorer.js');
const explorer = read(explorerFile);
const staticAssets = [...explorer.matchAll(/fetchContent\('([^']+\.json)'\)/g)]
  .map((match) => match[1])
  .filter((value) => !value.includes('${'));
for (const asset of staticAssets) {
  requireCheck(fs.existsSync(path.join(privateContent, asset)),
    `Canonical content exists: content/${asset}`);
}

const migrationReportFile = path.join(privateRoot, 'supabase', 'runtime-content-migration-report.json');
requireCheck(fs.existsSync(migrationReportFile), 'Runtime content migration report exists');
if (fs.existsSync(migrationReportFile)) {
  const report = JSON.parse(read(migrationReportFile));
  requireCheck(report.validation?.expected === report.validation?.matched,
    `Storage manifest count matches (${report.validation?.matched}/${report.validation?.expected})`);
  requireCheck(Array.isArray(report.validation?.failures) && report.validation.failures.length === 0,
    'Storage migration report has no validation failures');
}

const contextFile = path.join(privateContent, 'bible-context-links.json');
requireCheck(fs.existsSync(contextFile), 'Canonical person/place/event context file exists');
if (fs.existsSync(contextFile)) {
  const context = JSON.parse(read(contextFile));
  const abraham = context.person_contexts?.['PER-ABRAHAM'];
  const sodomId = 'PLC-SODOM-1107-1107';
  requireCheck(Array.isArray(abraham?.place_ids) && abraham.place_ids.includes(sodomId),
    'Sentinel link exists: Abraham → Sodom');
  requireCheck(context.places?.[sodomId]?.name === 'Sodom',
    'Sentinel place resolves: PLC-SODOM-1107-1107 → Sodom');
}

for (const result of passed) console.log(`PASS ${result}`);
for (const result of failures) console.error(`FAIL ${result}`);
if (failures.length) {
  console.error(`\nContent-link audit failed: ${failures.length} issue(s).`);
  process.exit(1);
}
console.log(`\nContent-link audit passed: ${passed.length} checks.`);
