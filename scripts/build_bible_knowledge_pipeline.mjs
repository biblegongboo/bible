import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const validateOnly = process.argv.includes('--validate-only');
const reportFile = path.join(repoRoot, 'factory-output', 'bible-knowledge-pipeline-report.json');

const stages = [
  'build_bible_map_factory.mjs',
  'build_bible_explorer_assets.mjs',
  'build_estimated_journeys.mjs',
  'build_bible_context_update.mjs',
  'build_bible_geography_layers.mjs',
  'build_bible_entity_context.mjs',
  'build_patristic_deep_content.mjs',
  'build_patristic_reader_content.mjs'
];

function run(script) {
  return new Promise((resolve, reject) => {
    const label = path.basename(script, '.mjs');
    console.log(`KNOWLEDGE_STAGE_START=${label}`);
    const child = spawn(process.execPath, [path.join(scriptDir, script)], {
      cwd: repoRoot,
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`${label} exited with ${code}`));
      else {
        console.log(`KNOWLEDGE_STAGE_DONE=${label}`);
        resolve();
      }
    });
  });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

function validate() {
  const map = readJson('content/bible-map25d.json');
  const roads = readJson('content/ancient-roads25d.json');
  const geography = readJson('content/bible-geography25d.json');
  const context = readJson('content/bible-context-links.json');
  const journeys = readJson('content/journeys.json');
  const timelines = readJson('content/timelines.json');
  const patristic = readJson('content/patristic-deep-index.json');
  const readers = readJson('content/patristic-reader-manifest.json');
  const checks = {
    map_places: (map.places || []).length,
    ancient_roads: (roads.roads || []).length,
    geography_features: (geography.features || []).length,
    geography_with_display_metadata: (geography.features || [])
      .filter((feature) => Number.isFinite(feature.min_zoom) && Number.isFinite(feature.priority)).length,
    people_contexts: Object.keys(context.person_contexts || {}).length,
    events: Object.keys(context.events || {}).length,
    places: Object.keys(context.places || {}).length,
    scripture_codes_with_places: Object.keys(context.source_to_places || {}).length,
    journeys: journeys.length,
    timelines: timelines.length,
    patristic_public: (patristic.records || []).filter((record) => record.public_allowed).length,
    patristic_readers: (readers.records || []).length
  };
  const failures = [];
  if (!checks.map_places) failures.push('map_places');
  if (!checks.geography_features ||
      checks.geography_features !== checks.geography_with_display_metadata) {
    failures.push('geography_display_metadata');
  }
  if (!checks.people_contexts || !checks.events || !checks.scripture_codes_with_places) {
    failures.push('entity_context');
  }
  if (checks.patristic_public !== checks.patristic_readers) {
    failures.push('patristic_reader_coverage');
  }
  return { checks, failures };
}

try {
  if (!validateOnly) {
    for (const stage of stages) await run(stage);
  }
  const validation = validate();
  const report = {
    generated_at: new Date().toISOString(),
    mode: validateOnly ? 'validate-only' : 'full-build',
    stages,
    ...validation,
    status: validation.failures.length ? 'error' : 'success'
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (validation.failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
