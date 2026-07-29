import fs from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const batchSize = Number(process.env.SUPABASE_BATCH_SIZE || 500);
const bibleRoot =
  process.env.BIBLE_DATA_ROOT ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE";
const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

if (!dryRun && (!supabaseUrl || !serviceKey)) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required unless --dry-run is used.",
  );
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...data] = rows;
  return data
    .filter((values) => values.some((value) => value !== ""))
    .map((values) =>
      Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])),
    );
}

function readCsv(relativePath) {
  const file = path.join(bibleRoot, relativePath);
  return parseCsv(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function emptyToNull(value) {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
}

function numberOrNull(value) {
  const text = emptyToNull(value);
  if (text === null) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function jsonOr(value, fallback) {
  const text = emptyToNull(value);
  if (text === null) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function upsert(table, rows, onConflict) {
  if (dryRun || rows.length === 0) return;
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set("on_conflict", onConflict);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      throw new Error(
        `${table} import failed at row ${start + 1}: ${response.status} ${await response.text()}`,
      );
    }
    process.stdout.write(
      `${table}: ${Math.min(start + batch.length, rows.length)}/${rows.length}\n`,
    );
  }
}

function buildVerses() {
  const versions = [
    ["data\\text\\BIBLE-TEXT-KJV-VERIFIED.csv", "kjv_text"],
    ["data\\text\\BIBLE-TEXT-WEB.csv", "web_text"],
    ["data\\text\\BIBLE-TEXT-KO-WEB-Genesis-01.csv", "ko_web_text"],
  ];
  const verses = new Map();

  for (const [relativePath, textColumn] of versions) {
    const fullPath = path.join(bibleRoot, relativePath);
    if (!fs.existsSync(fullPath)) continue;
    for (const row of readCsv(relativePath)) {
      const sourceCode = row.SOURCE_CODE;
      const current = verses.get(sourceCode) || {
        source_code: sourceCode,
        testament: row.TESTAMENT,
        book_code: row.BOOK,
        chapter: Number(row.CHAPTER),
        verse: Number(row.VERSE),
        kjv_text: null,
        web_text: null,
        ko_web_text: null,
      };
      current[textColumn] = row.TEXT;
      verses.set(sourceCode, current);
    }
  }
  return [...verses.values()];
}

function buildPeople() {
  return readCsv("data\\normalized\\people.csv").map((row) => ({
    person_id: row.person_id,
    canonical_name_en: row.canonical_name_en,
    canonical_name_ko: emptyToNull(row.canonical_name_ko),
    gender: emptyToNull(row.gender),
    description_en: emptyToNull(row.description_en),
    description_ko: emptyToNull(row.description_ko),
    roles: jsonOr(row.roles, []),
    tribe_id: emptyToNull(row.tribe_id),
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
    theographic_id: emptyToNull(row.theographic_id),
    status: row.status || "source_provided",
  }));
}

function buildAliases() {
  return readCsv("data\\normalized\\person_aliases.csv").map((row) => ({
    person_id: row.person_id,
    language: row.language || "en",
    alias: row.alias,
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
  }));
}

function buildReferences() {
  return readCsv("data\\normalized\\person_references.csv").map((row) => ({
    person_id: row.person_id,
    source_code: row.source_code,
    reference_kind: emptyToNull(row.reference_kind),
    is_key: String(row.is_key).toLowerCase() === "true",
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
  }));
}

function buildRelationships() {
  return readCsv("data\\normalized\\relations.source-provided.csv").map((row) => ({
    relation_id: row.relation_id,
    from_id: row.from_id,
    to_id: row.to_id,
    relationship_type: row.type,
    evidence_source_codes: jsonOr(row.evidence_source_codes, []),
    evidence_status: emptyToNull(row.evidence_status),
    confidence: numberOrNull(row.confidence),
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
    status: row.status || "source_provided",
  }));
}

function buildPlaces() {
  return readCsv("data\\normalized\\places.csv").map((row) => ({
    place_id: row.place_id,
    canonical_name_en: row.canonical_name_en,
    canonical_name_ko: emptyToNull(row.canonical_name_ko),
    aliases: jsonOr(row.aliases, []),
    feature_type: emptyToNull(row.feature_type),
    feature_subtype: emptyToNull(row.feature_subtype),
    latitude: numberOrNull(row.latitude),
    longitude: numberOrNull(row.longitude),
    precision_label: emptyToNull(row.precision),
    description_en: emptyToNull(row.description_en),
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
    coordinate_status: emptyToNull(row.coordinate_status),
    status: row.status || "source_provided",
  }));
}

function buildEvents() {
  return readCsv("data\\normalized\\events.csv").map((row) => ({
    event_id: row.event_id,
    title_en: row.title_en,
    title_ko: emptyToNull(row.title_ko),
    start_date_candidate: emptyToNull(row.start_date_candidate),
    duration_candidate: emptyToNull(row.duration_candidate),
    predecessor_id: emptyToNull(row.predecessor_id),
    part_of_id: emptyToNull(row.part_of_id),
    source_codes: jsonOr(row.source_codes, []),
    participant_source_ids: jsonOr(row.participant_source_ids, []),
    location_source_ids: jsonOr(row.location_source_ids, []),
    source_dataset: emptyToNull(row.source_dataset),
    source_record_id: emptyToNull(row.source_record_id),
    chronology_status: emptyToNull(row.chronology_status),
    status: row.status || "source_provided",
  }));
}

function buildJourneys() {
  const file = path.join(bibleRoot, "data\\normalized\\journeys.geojson");
  const geojson = JSON.parse(fs.readFileSync(file, "utf8"));
  return (geojson.features || []).map((feature, index) => {
    const properties = feature.properties || {};
    return {
      journey_id: String(
        properties.journey_id || properties.id || feature.id || `JOURNEY-${index + 1}`,
      ),
      title: emptyToNull(properties.title || properties.name),
      person_id: emptyToNull(properties.person_id),
      sequence_no: numberOrNull(properties.sequence_no || properties.sequence),
      geometry: feature.geometry,
      properties,
      source_dataset: emptyToNull(properties.source_dataset || "Theographic"),
    };
  });
}

const datasets = [
  ["bible_sources", [{
    source_id: "KJV",
    title: "King James Version",
    version_label: "KJV",
    license_note: "Original source text preserved exactly as imported.",
  }, {
    source_id: "WEB",
    title: "World English Bible",
    version_label: "WEB",
    license_note: "Original source text preserved exactly as imported.",
  }], "source_id"],
  ["bible_verses", buildVerses(), "source_code"],
  ["bible_people", buildPeople(), "person_id"],
  ["bible_person_aliases", buildAliases(), "person_id,language,alias"],
  ["bible_person_references", buildReferences(), "person_id,source_code,reference_kind,source_dataset"],
  ["bible_relationships", buildRelationships(), "relation_id"],
  ["bible_places", buildPlaces(), "place_id"],
  ["bible_events", buildEvents(), "event_id"],
  ["bible_journeys", buildJourneys(), "journey_id"],
];

for (const [table, rows, conflict] of datasets) {
  process.stdout.write(`${table}: prepared ${rows.length}\n`);
  await upsert(table, rows, conflict);
}

process.stdout.write(
  dryRun ? "DRY_RUN_COMPLETE\n" : "SUPABASE_CONTENT_IMPORT_COMPLETE\n",
);
