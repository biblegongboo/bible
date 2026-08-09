#!/usr/bin/env node

/* Fast representative check. Use after a focused UI/data change. Full data
 * validation remains in verify_bible_full_integrity.mjs. */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'biblegongboo_repo', 'content');
const load = (name) => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const context = load('bible-context-links.json');
const people = load('people-index.json');
const places = new Map(load('places.json').map((item) => [item.id, item]));
const checks = [];
const check = (name, value) => checks.push({ name, passed: Boolean(value) });
const hasPerson = (id) => Boolean(people[id]);
const hasPlace = (id) => Boolean(context.places?.[id] || places.get(id));

check('People: Abraham exists', hasPerson('PER-ABRAHAM'));
check('People → Atlas: Abraham includes Sodom', (context.person_contexts?.['PER-ABRAHAM']?.place_ids || []).includes('PLC-SODOM-1107-1107'));
check('Atlas: Sodom resolves', hasPlace('PLC-SODOM-1107-1107') && context.places['PLC-SODOM-1107-1107'].name === 'Sodom');
check('People: Aaron exists', hasPerson('PER-AARON'));
check('Timeline: Sodom Destroyed exists', Object.values(context.events || {}).some((event) => event.title === 'Sodom Destroyed'));
check('Journeys: Paul journey 1 exists', load('journeys.json').some((journey) => journey.journey_id === 'JRN-PAUL-1'));
check('Timeline: Genesis exists', load('timelines.json').some((timeline) => timeline.timeline_id === 'TML-OT-Genesis'));
check('Library reader manifest exists', Array.isArray(load('patristic-reader-manifest.json').records));
console.log(JSON.stringify({ status: checks.every((item) => item.passed) ? 'passed' : 'failed', checks }, null, 2));
if (checks.some((item) => !item.passed)) process.exit(1);
