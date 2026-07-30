import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultSourceRoot = path.join(
  os.homedir(),
  'Desktop',
  'gongboo.org',
  'BIBLE',
  '인물DB SOURCE',
  'Bible-Geocoding-Data-main',
  'Bible-Geocoding-Data-main'
);
const sourceRoot = path.resolve(process.env.BIBLE_MAP_SOURCE_ROOT || defaultSourceRoot);
const outputRoot = path.resolve(
  process.env.BIBLE_MAP_FACTORY_OUTPUT ||
    path.join(repoRoot, 'factory-output', 'bible-map')
);
const dataRoot = path.join(sourceRoot, 'data');

const BOOKS = {
  Gen: ['OT', 'Genesis'],
  Exod: ['OT', 'Exodus'],
  Lev: ['OT', 'Leviticus'],
  Num: ['OT', 'Numbers'],
  Deut: ['OT', 'Deuteronomy'],
  Josh: ['OT', 'Joshua'],
  Judg: ['OT', 'Judges'],
  Ruth: ['OT', 'Ruth'],
  '1Sam': ['OT', '1-Samuel'],
  '2Sam': ['OT', '2-Samuel'],
  '1Kgs': ['OT', '1-Kings'],
  '2Kgs': ['OT', '2-Kings'],
  '1Chr': ['OT', '1-Chronicles'],
  '2Chr': ['OT', '2-Chronicles'],
  Ezra: ['OT', 'Ezra'],
  Neh: ['OT', 'Nehemiah'],
  Esth: ['OT', 'Esther'],
  Job: ['OT', 'Job'],
  Ps: ['OT', 'Psalms'],
  Prov: ['OT', 'Proverbs'],
  Eccl: ['OT', 'Ecclesiastes'],
  Song: ['OT', 'Song-of-Solomon'],
  Isa: ['OT', 'Isaiah'],
  Jer: ['OT', 'Jeremiah'],
  Lam: ['OT', 'Lamentations'],
  Ezek: ['OT', 'Ezekiel'],
  Dan: ['OT', 'Daniel'],
  Hos: ['OT', 'Hosea'],
  Joel: ['OT', 'Joel'],
  Amos: ['OT', 'Amos'],
  Obad: ['OT', 'Obadiah'],
  Jonah: ['OT', 'Jonah'],
  Mic: ['OT', 'Micah'],
  Nah: ['OT', 'Nahum'],
  Hab: ['OT', 'Habakkuk'],
  Zeph: ['OT', 'Zephaniah'],
  Hag: ['OT', 'Haggai'],
  Zech: ['OT', 'Zechariah'],
  Mal: ['OT', 'Malachi'],
  Matt: ['NT', 'Matthew'],
  Mark: ['NT', 'Mark'],
  Luke: ['NT', 'Luke'],
  John: ['NT', 'John'],
  Acts: ['NT', 'Acts'],
  Rom: ['NT', 'Romans'],
  '1Cor': ['NT', '1-Corinthians'],
  '2Cor': ['NT', '2-Corinthians'],
  Gal: ['NT', 'Galatians'],
  Eph: ['NT', 'Ephesians'],
  Phil: ['NT', 'Philippians'],
  Col: ['NT', 'Colossians'],
  '1Thess': ['NT', '1-Thessalonians'],
  '2Thess': ['NT', '2-Thessalonians'],
  '1Tim': ['NT', '1-Timothy'],
  '2Tim': ['NT', '2-Timothy'],
  Titus: ['NT', 'Titus'],
  Phlm: ['NT', 'Philemon'],
  Heb: ['NT', 'Hebrews'],
  Jas: ['NT', 'James'],
  '1Pet': ['NT', '1-Peter'],
  '2Pet': ['NT', '2-Peter'],
  '1John': ['NT', '1-John'],
  '2John': ['NT', '2-John'],
  '3John': ['NT', '3-John'],
  Jude: ['NT', 'Jude'],
  Rev: ['NT', 'Revelation']
};

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required source file is missing: ${filePath}`);
  }
}

async function readJsonLines(filePath) {
  const records = [];
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const reader = readline.createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of reader) {
    lineNumber += 1;
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`${filePath}:${lineNumber}: ${error.message}`);
    }
  }
  return records;
}

function parseExtra(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseLonLat(value) {
  if (Array.isArray(value) && value.length >= 2) {
    const longitude = Number(value[0]);
    const latitude = Number(value[1]);
    return Number.isFinite(longitude) && Number.isFinite(latitude)
      ? { longitude, latitude }
      : null;
  }
  if (typeof value !== 'string') return null;
  const [longitude, latitude] = value.split(',').map(Number);
  return Number.isFinite(longitude) && Number.isFinite(latitude)
    ? { longitude, latitude }
    : null;
}

function osisToSourceCode(osis) {
  const match = String(osis || '').match(/^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  const [, abbreviation, chapterText, verseText] = match;
  const book = BOOKS[abbreviation];
  if (!book) return null;
  const [testament, bookName] = book;
  return `${testament}-${bookName}-${String(Number(chapterText)).padStart(2, '0')}-${String(
    Number(verseText)
  ).padStart(2, '0')}`;
}

function candidateScore(identification, resolution) {
  const values = [
    resolution?.best_time_score,
    resolution?.best_path_score,
    identification?.score?.time_total,
    identification?.score?.vote_total
  ]
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? Math.max(...values) : 0;
}

function buildCandidates(ancient, modernById) {
  const candidates = [];
  for (const [identificationIndex, identification] of (
    ancient.identifications || []
  ).entries()) {
    for (const [resolutionIndex, resolution] of (
      identification.resolutions || []
    ).entries()) {
      const modernId = resolution.modern_basis_id || resolution.id || identification.id;
      const modern = modernById.get(modernId);
      const coordinate =
        parseLonLat(resolution.lonlat) ||
        parseLonLat(modern?.lonlat) ||
        parseLonLat(modern?.representative_point);
      if (!coordinate) continue;
      candidates.push({
        identification_index: identificationIndex,
        resolution_index: resolutionIndex,
        modern_id: modernId || null,
        name_en: modern?.friendly_id || modern?.names?.[0] || null,
        longitude: coordinate.longitude,
        latitude: coordinate.latitude,
        location_type: resolution.type || identification.types?.[0] || modern?.type || null,
        confidence_score: candidateScore(identification, resolution),
        identification_description: identification.description || null,
        geometry_roles: resolution.geojson_roles || modern?.geojson_roles || null
      });
    }
  }
  return candidates.sort(
    (a, b) =>
      b.confidence_score - a.confidence_score ||
      String(a.name_en || '').localeCompare(String(b.name_en || ''))
  );
}

function writeJson(fileName, value) {
  const filePath = path.join(outputRoot, fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function writeJsonLines(fileName, values) {
  const filePath = path.join(outputRoot, fileName);
  const body = values.map((value) => JSON.stringify(value)).join('\n');
  fs.writeFileSync(filePath, body ? `${body}\n` : '', 'utf8');
  return filePath;
}

function mapPriority(place) {
  const references = Number(place.verse_reference_count) || 0;
  const confidence = Number(place.preferred_confidence_score) || 0;
  return Math.round(
    Math.log2(references + 1) * 100 +
      Math.min(1000, Math.max(0, confidence)) / 10 -
      Math.max(0, place.candidate_count - 1) * 4
  );
}

function minimumZoom(place) {
  const references = Number(place.verse_reference_count) || 0;
  if (references >= 100) return 1;
  if (references >= 30) return 2;
  if (references >= 10) return 3;
  if (references >= 3) return 4;
  return 5;
}

async function main() {
  const ancientPath = path.join(dataRoot, 'ancient.jsonl');
  const modernPath = path.join(dataRoot, 'modern.jsonl');
  const geometryPath = path.join(dataRoot, 'geometry.jsonl');
  const readmePath = path.join(sourceRoot, 'README.md');
  [ancientPath, modernPath, geometryPath, readmePath].forEach(requireFile);

  fs.mkdirSync(outputRoot, { recursive: true });

  const [ancientRows, modernRows, geometryRows] = await Promise.all([
    readJsonLines(ancientPath),
    readJsonLines(modernPath),
    readJsonLines(geometryPath)
  ]);
  const modernById = new Map(modernRows.map((row) => [row.id, row]));

  const references = [];
  const places = ancientRows.map((ancient) => {
    const extra = parseExtra(ancient.extra);
    const candidates = buildCandidates(ancient, modernById);
    const verseReferences = [...new Set(extra.osises || [])];
    for (const osis of verseReferences) {
      references.push({
        place_id: ancient.id,
        place_name_en: ancient.friendly_id,
        osis,
        source_code: osisToSourceCode(osis)
      });
    }
    const preferred = candidates[0] || null;
    return {
      place_id: ancient.id,
      name_en: ancient.friendly_id,
      place_class: ancient.identifications?.[0]?.class || null,
      location_type: preferred?.location_type || null,
      longitude: preferred?.longitude ?? null,
      latitude: preferred?.latitude ?? null,
      preferred_confidence_score: preferred?.confidence_score ?? null,
      preferred_modern_id: preferred?.modern_id || null,
      candidate_count: candidates.length,
      candidates,
      verse_reference_count: verseReferences.length,
      geojson_file: ancient.geojson_file || null,
      kml_file: ancient.kml_file || null,
      geometry_credit: ancient.geometry_credit || null,
      source_dataset: 'Bible-Geocoding-Data'
    };
  });

  const geometryIndex = geometryRows.map((geometry) => ({
    geometry_id: geometry.id,
    name_en: geometry.name,
    source: geometry.source,
    format: geometry.format,
    geometry_type: geometry.geometry,
    land_or_water: geometry.land_or_water || null,
    isobands_geojson_file: geometry.isobands_geojson_file || null,
    suggested: geometry.suggested || null
  }));

  const unresolvedOsis = references.filter((row) => !row.source_code);
  const locatedPlaces = places.filter(
    (row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)
  );
  const disputedPlaces = places.filter((row) => row.candidate_count > 1);
  const prototypePlaces = locatedPlaces
    .map((place) => ({
      id: place.place_id,
      name: place.name_en,
      longitude: place.longitude,
      latitude: place.latitude,
      type: place.location_type,
      priority: mapPriority(place),
      min_zoom: minimumZoom(place),
      verse_reference_count: place.verse_reference_count,
      candidate_count: place.candidate_count,
      confidence_score: place.preferred_confidence_score
    }))
    .sort(
      (left, right) =>
        right.priority - left.priority || left.name.localeCompare(right.name)
    );
  const report = {
    generated_at: new Date().toISOString(),
    source_root: sourceRoot,
    output_root: outputRoot,
    source_license: {
      main_data: 'CC BY 4.0',
      openstreetmap_portions: 'ODbL 1.0',
      images: 'per-record license; images are not exported by this factory'
    },
    counts: {
      ancient_places: places.length,
      located_places: locatedPlaces.length,
      unlocated_places: places.length - locatedPlaces.length,
      disputed_places: disputedPlaces.length,
      verse_references: references.length,
      unresolved_osis_references: unresolvedOsis.length,
      modern_locations: modernRows.length,
      geometry_records: geometryIndex.length
    },
    validation: {
      duplicate_place_ids:
        places.length - new Set(places.map((row) => row.place_id)).size,
      invalid_coordinates: places.filter(
        (row) =>
          row.longitude !== null &&
          (row.longitude < -180 ||
            row.longitude > 180 ||
            row.latitude < -90 ||
            row.latitude > 90)
      ).length,
      unresolved_osis_samples: unresolvedOsis.slice(0, 20)
    },
    exclusions: [
      'Images are excluded because licenses vary per record.',
      'Full GeoJSON/KML geometry is not copied; this stage emits a compact index.',
      'DFMS streamflow data and Patristic Text Archive XML are outside this map factory.'
    ]
  };

  const files = [
    writeJsonLines('bible-places.normalized.jsonl', places),
    writeJsonLines('bible-place-references.jsonl', references),
    writeJsonLines('bible-geometries.index.jsonl', geometryIndex),
    writeJson('bible-map25d.prototype.json', {
      schema_version: '1.0',
      generated_from: 'Bible-Geocoding-Data',
      places: prototypePlaces
    }),
    writeJson('bible-map-factory-report.json', report)
  ];

  console.log(
    JSON.stringify(
      {
        status: 'success',
        counts: report.counts,
        validation: report.validation,
        files
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
