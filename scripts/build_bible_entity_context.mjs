import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const normalizedRoot = path.resolve(
  process.env.BIBLE_NORMALIZED_ROOT ||
    path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE', 'data', 'normalized')
);
const mapFactoryRoot = path.join(repoRoot, 'factory-output', 'bible-map');
const outputFile = path.join(repoRoot, 'content', 'bible-context-links.json');
const auditRoot = path.join(repoRoot, 'factory-output', 'bible-entity-context');

function readJsonLines(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function main() {
  const people = readJsonLines(path.join(normalizedRoot, 'people.jsonl'));
  const places = readJsonLines(path.join(normalizedRoot, 'places.jsonl'));
  const events = readJsonLines(path.join(normalizedRoot, 'events.jsonl'));
  const geocodingPlaces = readJsonLines(
    path.join(mapFactoryRoot, 'bible-places.normalized.jsonl')
  );
  const geocodingReferences = readJsonLines(
    path.join(mapFactoryRoot, 'bible-place-references.jsonl')
  );

  const personByLookup = new Map();
  people.forEach((person) => {
    [person.theographic_lookup, person.theographic_id, person.source_record_id]
      .filter(Boolean)
      .forEach((value) => personByLookup.set(String(value), person));
  });
  const placeByLookup = new Map();
  const placeByName = new Map();
  places.forEach((place) => {
    [place.source_record_id, place.place_id].filter(Boolean)
      .forEach((value) => placeByLookup.set(String(value), place));
    placeByName.set(normalizeName(place.canonical_name_en), place);
  });

  const geocodingToLegacy = {};
  geocodingPlaces.forEach((place) => {
    const match = placeByName.get(normalizeName(place.name_en));
    if (match) geocodingToLegacy[place.place_id] = match.place_id;
  });

  const sourceToPlaces = {};
  geocodingReferences.forEach((reference) => {
    if (!reference.source_code) return;
    if (!sourceToPlaces[reference.source_code]) sourceToPlaces[reference.source_code] = [];
    sourceToPlaces[reference.source_code].push(reference.place_id);
  });
  Object.keys(sourceToPlaces).forEach((sourceCode) => {
    sourceToPlaces[sourceCode] = unique(sourceToPlaces[sourceCode]);
  });

  const eventIndex = {};
  const personContexts = {};
  events.forEach((event) => {
    const participantIds = unique((event.participant_source_ids || []).map((sourceId) =>
      personByLookup.get(String(sourceId))?.person_id
    ));
    const placeIds = unique((event.location_source_ids || []).map((sourceId) =>
      placeByLookup.get(String(sourceId))?.place_id
    ));
    eventIndex[event.event_id] = {
      id: event.event_id,
      title: event.title_en,
      title_ko: event.title_ko || '',
      source_codes: event.source_codes || [],
      participant_ids: participantIds,
      place_ids: placeIds,
      date: event.start_date_candidate || '',
      status: event.status || 'source_provided'
    };
    participantIds.forEach((personId) => {
      if (!personContexts[personId]) {
        personContexts[personId] = {
          event_ids: [],
          place_ids: [],
          scripture_place_ids: []
        };
      }
      personContexts[personId].event_ids.push(event.event_id);
      personContexts[personId].place_ids.push(...placeIds);
      (event.source_codes || []).forEach((sourceCode) => {
        personContexts[personId].scripture_place_ids.push(...(sourceToPlaces[sourceCode] || []));
      });
    });
  });
  Object.values(personContexts).forEach((context) => {
    context.event_ids = unique(context.event_ids);
    context.place_ids = unique(context.place_ids);
    context.scripture_place_ids = unique(context.scripture_place_ids);
  });

  const placeIndex = Object.fromEntries(places.map((place) => [
    place.place_id,
    {
      id: place.place_id,
      name: place.canonical_name_en,
      name_ko: place.canonical_name_ko || '',
      type: place.feature_subtype || place.feature_type || '',
      latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : null,
      longitude: Number.isFinite(Number(place.longitude)) ? Number(place.longitude) : null
    }
  ]));
  const geocodingPlaceIndex = Object.fromEntries(geocodingPlaces.map((place) => [
    place.place_id,
    {
      id: place.place_id,
      name: place.name_en,
      type: place.location_type || '',
      latitude: place.latitude,
      longitude: place.longitude,
      legacy_place_id: geocodingToLegacy[place.place_id] || null,
      reference_count: place.verse_reference_count
    }
  ]));

  const payload = {
    schema_version: '1.0',
    generated_from: ['ACAI', 'Theographic', 'Bible-Geocoding-Data'],
    person_contexts: personContexts,
    events: eventIndex,
    places: placeIndex,
    geocoding_places: geocodingPlaceIndex,
    source_to_places: sourceToPlaces
  };
  const report = {
    generated_at: new Date().toISOString(),
    counts: {
      people_with_context: Object.keys(personContexts).length,
      events: Object.keys(eventIndex).length,
      legacy_places: Object.keys(placeIndex).length,
      geocoding_places: Object.keys(geocodingPlaceIndex).length,
      geocoding_to_legacy_matches: Object.keys(geocodingToLegacy).length,
      scripture_codes_with_places: Object.keys(sourceToPlaces).length,
      direct_person_event_links: Object.values(personContexts)
        .reduce((sum, context) => sum + context.event_ids.length, 0),
      direct_person_place_links: Object.values(personContexts)
        .reduce((sum, context) => sum + context.place_ids.length, 0)
    },
    validation: {
      unresolved_event_participants: events.reduce((sum, event) =>
        sum + (event.participant_source_ids || [])
          .filter((id) => !personByLookup.has(String(id))).length, 0),
      unresolved_event_places: events.reduce((sum, event) =>
        sum + (event.location_source_ids || [])
          .filter((id) => !placeByLookup.has(String(id))).length, 0)
    }
  };

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload)}\n`, 'utf8');
  fs.writeFileSync(path.join(auditRoot, 'validation-report.json'),
    `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'success', outputFile, report }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
