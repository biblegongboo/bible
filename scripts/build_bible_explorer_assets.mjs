import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = process.argv[2];
const outputRoot = process.argv[3];
if (!sourceRoot || !outputRoot) {
  throw new Error('Usage: node build_bible_explorer_assets.mjs <BIBLE data root> <output root>');
}

function readJsonLines(file) {
  return fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const places = readJsonLines(path.join(sourceRoot, 'normalized', 'places.jsonl'))
  .filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)))
  .map((place) => ({
    id: place.place_id,
    name: place.canonical_name_en,
    name_ko: place.canonical_name_ko || '',
    aliases: place.aliases || [],
    type: place.feature_subtype || place.feature_type || '',
    lat: Number(place.latitude),
    lon: Number(place.longitude),
    description: place.description_en || '',
    source: place.source_dataset || ''
  }));

const journeys = readJsonLines(path.join(sourceRoot, 'graphics', 'paul-journey-graphics.jsonl'));
const timelines = readJsonLines(path.join(sourceRoot, 'graphics', 'timeline-by-book.jsonl'));

fs.mkdirSync(outputRoot, { recursive: true });
fs.writeFileSync(path.join(outputRoot, 'places.json'), JSON.stringify(places));
fs.writeFileSync(path.join(outputRoot, 'journeys.json'), JSON.stringify(journeys));
fs.writeFileSync(path.join(outputRoot, 'timelines.json'), JSON.stringify(timelines));

console.log(JSON.stringify({
  places: places.length,
  journeys: journeys.length,
  timelines: timelines.length
}));
