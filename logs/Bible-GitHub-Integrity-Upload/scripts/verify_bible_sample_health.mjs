#!/usr/bin/env node

/* Fast all-section sample check. It is intentionally broad enough to touch
 * every user-facing data family, while verify_bible_full_integrity.mjs remains
 * the exhaustive cross-reference and every-file validator. */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'biblegongboo_repo', 'content');
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const exists = (name) => fs.existsSync(path.join(root, name));
const count = (value) => value instanceof Map ? value.size : (Array.isArray(value) ? value.length : (value && typeof value === 'object' ? Object.keys(value).length : 0));
const checks = [];
const check = (name, value) => checks.push({ name, passed: Boolean(value) });
const nonEmptyFile = (name) => {
  try { return exists(name) && count(load(name)) > 0; } catch { return false; }
};

// People -> places/events/scripture representative user journey.
const context = load('bible-context-links.json');
const people = load('people-index.json');
const places = new Map(load('places.json').map((item) => [item.id, item]));
check('People: Abraham exists', Boolean(people['PER-ABRAHAM']));
check('People: Aaron exists', Boolean(people['PER-AARON']));
check('People -> Atlas: Abraham includes Sodom', (context.person_contexts?.['PER-ABRAHAM']?.place_ids || []).includes('PLC-SODOM-1107-1107'));
check('Atlas: Sodom resolves', Boolean(context.places?.['PLC-SODOM-1107-1107'] || places.get('PLC-SODOM-1107-1107')));
check('Timeline: Sodom Destroyed exists', Object.values(context.events || {}).some((event) => event.title === 'Sodom Destroyed'));
check('Journeys: Paul journey 1 exists', load('journeys.json').some((journey) => journey.journey_id === 'JRN-PAUL-1'));
check('Timeline: Genesis exists', load('timelines.json').some((timeline) => timeline.timeline_id === 'TML-OT-Genesis'));

// Atlas and map layers.
check('Atlas: places data', count(places) > 0);
check('Atlas: 2.5D map layer', nonEmptyFile('bible-map25d.json'));
check('Atlas: geography layer', nonEmptyFile('bible-geography25d.json'));
check('Atlas: ancient roads layer', nonEmptyFile('ancient-roads25d.json'));

// All Study families. Each manifest target must exist and contain data.
const knowledge = load('knowledge/manifest.json');
for (const [section, file] of Object.entries(knowledge.sections || {})) {
  check(`Study: ${section}`, nonEmptyFile(file));
}
const concordance = load('knowledge/concordance/manifest.json');
const concordanceDir = path.join(root, 'knowledge', 'concordance');
const concordanceShards = fs.readdirSync(concordanceDir).filter((file) => /^\d{2}-.+\.json$/.test(file));
check('Study: Words / 66 book shards', concordance.unique_words > 0 && concordanceShards.length === 66 && concordanceShards.every((file) => nonEmptyFile(`knowledge/concordance/${file}`)));
const semantic = load('knowledge/semantic/manifest.json');
const semanticFiles = Object.values(semantic.files || semantic.categories || {}).flatMap((item) => typeof item === 'string' ? [item] : [item.file || item.path].filter(Boolean));
check('Study: semantic categories', semanticFiles.length > 0 && semanticFiles.every((file) => nonEmptyFile(file)) && nonEmptyFile(semantic.by_source_file));

// Early Church reader and its source index.
const reader = load('patristic-reader-manifest.json');
check('Early Church: reader manifest', Array.isArray(reader.records) && reader.records.length > 0);
check('Early Church: deep index', nonEmptyFile('patristic-deep-index.json'));

// Image/library metadata available to the normalizers and UI.
const images = load('knowledge/images/licensed-manifest.json');
check('Library: image metadata', count(images.records || images.images || images) > 0);
check('Library: book reference index', nonEmptyFile('knowledge/reference/books.json'));
check('Library: chapter reference index', nonEmptyFile('knowledge/reference/chapters.json'));
check('Library: dictionary reference index', nonEmptyFile('knowledge/reference/easton.json'));
check('Library: topics reference index', nonEmptyFile('knowledge/reference/topics.json'));

const passed = checks.every((item) => item.passed);
console.log(JSON.stringify({ status: passed ? 'passed' : 'failed', checks }, null, 2));
if (!passed) process.exit(1);
