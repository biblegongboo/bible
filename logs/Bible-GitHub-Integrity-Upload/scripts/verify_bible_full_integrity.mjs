#!/usr/bin/env node

/* Full structural data audit. Run after a large import, Storage migration,
 * or before a release. It checks every reference in people/place/event context
 * data, core runtime assets, and the last content-migration manifest. */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(scriptDir, '..');
const privateRoot = path.resolve(publicRoot, '..', 'biblegongboo_repo');
const contentRoot = path.join(privateRoot, 'content');
const failures = [];
const counts = {};
const fail = (message) => failures.push(message);
const load = (file) => JSON.parse(fs.readFileSync(path.join(contentRoot, file), 'utf8'));
const exists = (file) => fs.existsSync(path.join(contentRoot, file));
const requireFile = (file) => { if (!exists(file)) fail(`Missing canonical content file: ${file}`); };

const core = ['people-index.json', 'places.json', 'journeys.json', 'timelines.json', 'bible-map25d.json', 'ancient-roads25d.json', 'bible-geography25d.json', 'bible-context-links.json', 'patristic-deep-index.json', 'patristic-reader-manifest.json'];
core.forEach(requireFile);
if (failures.length) {
  failures.forEach((item) => console.error(`FAIL ${item}`));
  process.exit(1);
}

const people = load('people-index.json');
const places = load('places.json');
const journeys = load('journeys.json');
const timelines = load('timelines.json');
const context = load('bible-context-links.json');
const readerManifest = load('patristic-reader-manifest.json');
const knowledgeManifestFile = 'knowledge/manifest.json';
requireFile(knowledgeManifestFile);
const knowledgeManifest = load(knowledgeManifestFile);
const knowledgeSections = Object.entries(knowledgeManifest.sections || {});
for (const [section, file] of knowledgeSections) {
  requireFile(file);
  try {
    const value = load(file);
    if (Array.isArray(value) && value.length === 0) fail(`Knowledge section is empty: ${section}`);
    if (!Array.isArray(value) && (!value || Object.keys(value).length === 0)) fail(`Knowledge section is empty: ${section}`);
  } catch (error) {
    fail(`Knowledge section cannot be read (${section}): ${error.message}`);
  }
}
const concordanceDirectory = path.join(contentRoot, 'knowledge', 'concordance');
const concordanceBooks = fs.existsSync(concordanceDirectory)
  ? fs.readdirSync(concordanceDirectory).filter((file) => /^\d{2}-.+\.json$/.test(file))
  : [];
if (concordanceBooks.length !== 66) fail(`Concordance book shard count is ${concordanceBooks.length}, expected 66`);
const semanticDirectory = path.join(contentRoot, 'knowledge', 'semantic');
const semanticFiles = fs.existsSync(semanticDirectory)
  ? fs.readdirSync(semanticDirectory).filter((file) => file !== 'manifest.json' && file.endsWith('.json'))
  : [];
if (semanticFiles.length === 0) fail('Semantic knowledge files are missing');
counts.library = {
  concordance_books: concordanceBooks.length,
  words: knowledgeManifest.counts?.concordance_unique_words || 0,
  dictionary: knowledgeManifest.counts?.easton_entries || 0,
  books: knowledgeManifest.counts?.books || 0,
  chapters: knowledgeManifest.counts?.chapters || 0,
  topic_lists: knowledgeManifest.counts?.topic_lists || 0,
  image_records: knowledgeManifest.counts?.image_records || 0,
  semantic_categories: semanticFiles.length,
};
for (const [key, value] of Object.entries(counts.library)) if (!value) fail(`Knowledge manifest reports no ${key}`);
const placeIds = new Set(places.map((item) => item.id));
const peopleIds = new Set(Object.keys(people));
const eventIds = new Set(Object.keys(context.events || {}));
const contextPlaces = new Set(Object.keys(context.places || {}));
const geoPlaces = new Set(Object.keys(context.geocoding_places || {}));
counts.people = peopleIds.size; counts.places = placeIds.size; counts.events = eventIds.size; counts.journeys = journeys.length; counts.timelines = timelines.length;

for (const [personId, item] of Object.entries(context.person_contexts || {})) {
  if (!peopleIds.has(personId)) fail(`Context person missing from people index: ${personId}`);
  for (const id of item.event_ids || []) if (!eventIds.has(id)) fail(`Person ${personId} references missing event: ${id}`);
  for (const id of item.place_ids || []) if (!contextPlaces.has(id)) fail(`Person ${personId} references missing place: ${id}`);
  for (const id of item.scripture_place_ids || []) if (!geoPlaces.has(id)) fail(`Person ${personId} references missing Scripture place: ${id}`);
}
for (const [eventId, event] of Object.entries(context.events || {})) {
  for (const id of event.participant_ids || []) if (!peopleIds.has(id)) fail(`Event ${eventId} references missing person: ${id}`);
  for (const id of event.place_ids || []) if (!contextPlaces.has(id)) fail(`Event ${eventId} references missing place: ${id}`);
}
for (const [sourceCode, ids] of Object.entries(context.source_to_places || {})) {
  if (!sourceCode) fail('Blank source-code key in source_to_places');
  for (const id of ids || []) if (!geoPlaces.has(id)) fail(`Source ${sourceCode} references missing geocoding place: ${id}`);
}
for (const place of places) {
  if (!place.id || !place.name) fail(`Invalid place record: ${JSON.stringify(place).slice(0, 180)}`);
}
for (const journey of journeys) {
  if (!journey.journey_id || !journey.title_en) fail('Journey lacks ID or title');
  if (!Array.isArray(journey.graphic?.objects) || journey.graphic.objects.length === 0) fail(`Journey has no graphic objects: ${journey.journey_id}`);
}
for (const timeline of timelines) {
  if (!timeline.timeline_id || !Array.isArray(timeline.graphic?.rows) || timeline.graphic.rows.length === 0) fail(`Timeline has no rows: ${timeline.timeline_id || '(missing ID)'}`);
}
for (const entry of readerManifest.records || []) {
  const file = String(entry.file || '').replace(/^content\//, '');
  if (!file || !exists(file)) fail(`Patristic reader content missing: ${entry.reader_key || entry.id || '(unknown)'}`);
}
const reportFile = path.join(privateRoot, 'supabase', 'runtime-content-migration-report.json');
if (!fs.existsSync(reportFile)) fail('Runtime content migration report missing');
else {
  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  if (report.validation?.expected !== report.validation?.matched) fail(`Storage manifest mismatch: ${report.validation?.matched}/${report.validation?.expected}`);
  if ((report.validation?.failures || []).length) fail(`Storage migration report has ${report.validation.failures.length} failure(s)`);
}

console.log(JSON.stringify({ status: failures.length ? 'failed' : 'passed', checked_at: new Date().toISOString(), counts, failures }, null, 2));
if (failures.length) process.exit(1);
