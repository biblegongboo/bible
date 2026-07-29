import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const repoRoot = path.resolve(import.meta.dirname, '..');
const bibleRoot = process.env.BIBLE_DATA_ROOT
  ? path.resolve(process.env.BIBLE_DATA_ROOT)
  : path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE');
const normalizedRoot = path.join(bibleRoot, 'data', 'normalized');
const theographicEventsPath = path.join(
  bibleRoot,
  '인물DB SOURCE',
  'theographic-bible-metadata-master',
  'theographic-bible-metadata-master',
  'json',
  'events.json'
);
const outputPath = path.join(repoRoot, 'content', 'journeys.json');
const reportPath = path.join(repoRoot, 'content', 'journeys-generation-report.json');

const MAX_STOPS_PER_ROUTE = 24;
const MIN_STOPS_PER_ROUTE = 3;
const ROUTE_COLOR = '#d97706';

function readJsonLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function eventKey(event) {
  return Number(event._source_order || 0);
}

function uniqueConsecutiveStops(stops) {
  const result = [];
  for (const stop of stops) {
    const previous = result.at(-1);
    if (previous?.place_id === stop.place_id) {
      previous.event_ids.push(...stop.event_ids);
      previous.source_codes.push(...stop.source_codes);
      previous.event_titles.push(...stop.event_titles);
      previous.source_codes = [...new Set(previous.source_codes)];
      previous.event_ids = [...new Set(previous.event_ids)];
      previous.event_titles = [...new Set(previous.event_titles)];
    } else {
      result.push(structuredClone(stop));
    }
  }
  return result;
}

function boundingBox(stops) {
  const xs = stops.map((stop) => stop.longitude);
  const ys = stops.map((stop) => stop.latitude);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.8);
  const spanY = Math.max(maxY - minY, 0.8);
  const padX = spanX * 0.14;
  const padY = spanY * 0.14;
  return [minX - padX, maxY + padY, maxX + padX, minY - padY];
}

function graphicFor(stops, routeId) {
  const objects = [];
  for (let index = 1; index < stops.length; index += 1) {
    objects.push({
      id: `${routeId}_segment_${index}`,
      type: 'segment',
      from: [stops[index - 1].longitude, stops[index - 1].latitude],
      to: [stops[index].longitude, stops[index].latitude],
      attributes: { strokeColor: ROUTE_COLOR, strokeWidth: 3 }
    });
  }
  stops.forEach((stop, index) => {
    objects.push({
      id: `${routeId}_place_${index + 1}`,
      type: 'point',
      coords: [stop.longitude, stop.latitude],
      name: `${index + 1}. ${stop.place_name_en}`,
      attributes: {
        size: 3,
        strokeColor: '#92400e',
        fillColor: '#fbbf24',
        label: { fontSize: 12, color: '#111827' }
      },
      source_reference: stop.source_codes.join(', ')
    });
  });
  return {
    engine: 'jsxgraph',
    type: 'bible.map.journey',
    board: { boundingbox: boundingBox(stops), grid: false },
    objects,
    metadata: {
      route_id: routeId,
      route_status: 'estimated',
      point_count: stops.length,
      map_note: 'Estimated route reconstructed from source events, Bible references, and source-provided place coordinates.'
    }
  };
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  if (result.length > 1 && result.at(-1).length < MIN_STOPS_PER_ROUTE) {
    result.at(-2).push(...result.pop());
  }
  return result;
}

function routeTitle(person, part, totalParts) {
  if (person.person_id === 'PER-JESUS-2') {
    const phases = [
      'Jesus — early life and early ministry (Estimated Route)',
      'Jesus — Galilean and regional ministry (Estimated Route)',
      'Jesus — final journey, Passion, and resurrection (Estimated Route)'
    ];
    return phases[part - 1] || `Jesus — ministry route ${part} (Estimated Route)`;
  }
  return totalParts > 1
    ? `${person.canonical_name_en} — estimated route ${part}`
    : `${person.canonical_name_en} — estimated route`;
}

const rawTheographicEvents = JSON.parse(fs.readFileSync(theographicEventsPath, 'utf8'));
const sortKeyByEventId = new Map(
  rawTheographicEvents.map((event, index) => [
    String(event.fields?.eventID || ''),
    Number(event.fields?.sortKey ?? index)
  ])
);
const events = readJsonLines(path.join(normalizedRoot, 'events.jsonl'))
  .map((event, index) => ({
    ...event,
    _source_order: sortKeyByEventId.get(String(event.source_record_id)) ?? index
  }));
const places = readJsonLines(path.join(normalizedRoot, 'places.jsonl'));
const people = readJsonLines(path.join(normalizedRoot, 'people.jsonl'));
const existingJourneys = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
const sourceProvidedJourneys = existingJourneys.filter((journey) => journey.status === 'source_provided');

const placeBySourceId = new Map(
  places
    .filter((place) => Number.isFinite(Number(place.latitude)) && Number.isFinite(Number(place.longitude)))
    .map((place) => [place.source_record_id, place])
);

const personByTheographicLookup = new Map();
for (const person of people) {
  if (!person.theographic_lookup) continue;
  const current = personByTheographicLookup.get(person.theographic_lookup);
  if (!current || person.person_id === 'PER-JESUS-2') {
    personByTheographicLookup.set(person.theographic_lookup, person);
  }
}

const eventsByPerson = new Map();
for (const event of events) {
  for (const participantId of event.participant_source_ids || []) {
    const person = personByTheographicLookup.get(participantId);
    if (!person) continue;
    if (!eventsByPerson.has(person.person_id)) {
      eventsByPerson.set(person.person_id, { person, events: [] });
    }
    eventsByPerson.get(person.person_id).events.push(event);
  }
}

const generated = [];
const skipped = [];

for (const { person, events: personEvents } of eventsByPerson.values()) {
  if (person.person_id === 'PER-PAUL' ||
      /^(God|Holy Spirit)$/i.test(person.canonical_name_en || '')) {
    skipped.push({
      person_id: person.person_id,
      person_name_en: person.canonical_name_en,
      reason: person.person_id === 'PER-PAUL'
        ? 'source-provided Paul geometry already exists'
        : 'not a physical human itinerary'
    });
    continue;
  }

  let selectedEvents = [...personEvents].sort((a, b) => eventKey(a) - eventKey(b));

  if (person.person_id === 'PER-JESUS-2') {
    const familyEvents = events.filter((event) => {
      const eventNumber = Number(event.source_record_id);
      return eventNumber >= 254 && eventNumber <= 265;
    });
    selectedEvents = [...new Map(
      [...selectedEvents, ...familyEvents].map((event) => [event.event_id, event])
    ).values()].sort((a, b) => eventKey(a) - eventKey(b));
    selectedEvents = selectedEvents.filter((event) => {
      const firstCode = event.source_codes?.[0] || '';
      return firstCode.startsWith('NT-') &&
        !/prophec|creation of all things/i.test(event.title_en || '');
    });
  }

  const rawStops = [];
  for (const event of selectedEvents) {
    for (const locationSourceId of event.location_source_ids || []) {
      const place = placeBySourceId.get(locationSourceId);
      if (!place) continue;
      rawStops.push({
        place_id: place.place_id,
        place_name_en: place.canonical_name_en,
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
        coordinate_status: place.coordinate_status,
        event_ids: [event.event_id],
        event_titles: [event.title_en],
        source_codes: [...(event.source_codes || [])]
      });
    }
  }

  const stops = uniqueConsecutiveStops(rawStops);
  if (stops.length < MIN_STOPS_PER_ROUTE || new Set(stops.map((stop) => stop.place_id)).size < 2) {
    skipped.push({
      person_id: person.person_id,
      person_name_en: person.canonical_name_en,
      reason: 'fewer than three located stops or fewer than two distinct places',
      located_stop_count: stops.length
    });
    continue;
  }

  const stopGroups = chunks(stops, MAX_STOPS_PER_ROUTE);
  stopGroups.forEach((stopGroup) => {
    const routeNumber = generated.filter((route) => route.person_id === person.person_id).length + 1;
    const routeId = `JRN-EST-${person.person_id.replace(/^PER-/, '')}-${String(routeNumber).padStart(2, '0')}`;
    generated.push({
      journey_id: routeId,
      title_en: routeTitle(person, routeNumber, stopGroups.length),
      title_ko: `${person.canonical_name_ko || person.canonical_name_en} 추정 경로${stopGroups.length > 1 ? ` ${routeNumber}` : ''}`,
      person_id: person.person_id,
      source_dataset: 'Theographic events + normalized places',
      status: 'estimated',
      route_label_en: 'Estimated Route',
      route_label_ko: '추정 경로',
      evidence: {
        event_ids: [...new Set(stopGroup.flatMap((stop) => stop.event_ids))],
        source_codes: [...new Set(stopGroup.flatMap((stop) => stop.source_codes))],
        coordinate_statuses: [...new Set(stopGroup.map((stop) => stop.coordinate_status))]
      },
      stops: stopGroup.map((stop, stopIndex) => ({
        sequence: stopIndex + 1,
        place_id: stop.place_id,
        place_name_en: stop.place_name_en,
        latitude: stop.latitude,
        longitude: stop.longitude,
        event_ids: stop.event_ids,
        event_titles: stop.event_titles,
        source_codes: stop.source_codes
      })),
      graphic: graphicFor(stopGroup, routeId)
    });
  });
}

generated.sort((a, b) => {
  if (a.person_id === 'PER-JESUS-2' && b.person_id === 'PER-JESUS-2') {
    return a.journey_id.localeCompare(b.journey_id);
  }
  if (a.person_id === 'PER-JESUS-2') return -1;
  if (b.person_id === 'PER-JESUS-2') return 1;
  return a.title_en.localeCompare(b.title_en) || a.journey_id.localeCompare(b.journey_id);
});

const output = [...sourceProvidedJourneys, ...generated];
fs.writeFileSync(outputPath, JSON.stringify(output), 'utf8');
fs.writeFileSync(reportPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  source_provided_routes: sourceProvidedJourneys.length,
  estimated_routes: generated.length,
  total_routes: output.length,
  people_with_estimated_routes: new Set(generated.map((route) => route.person_id)).size,
  estimated_stops: generated.reduce((sum, route) => sum + route.stops.length, 0),
  jesus_routes: generated.filter((route) => route.person_id === 'PER-JESUS-2').length,
  skipped_people: skipped.length,
  skipped
}, null, 2), 'utf8');

console.log(JSON.stringify({
  outputPath,
  reportPath,
  sourceProvidedRoutes: sourceProvidedJourneys.length,
  estimatedRoutes: generated.length,
  totalRoutes: output.length,
  peopleWithEstimatedRoutes: new Set(generated.map((route) => route.person_id)).size,
  jesusRoutes: generated.filter((route) => route.person_id === 'PER-JESUS-2').length
}, null, 2));
