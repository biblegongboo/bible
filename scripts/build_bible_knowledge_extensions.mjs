import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = path.resolve(
  process.env.BIBLE_KNOWLEDGE_SOURCE_ROOT ||
    path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE', '인물DB SOURCE')
);
const oldRoot = path.join(sourceRoot, 'old');
const acaiRoot = path.join(oldRoot, 'ACAI-2025-07-23', 'ACAI-2025-07-23');
const theographicRoot = path.join(
  oldRoot,
  'theographic-bible-metadata-master',
  'theographic-bible-metadata-master'
);
const bibleDataRoot = path.join(oldRoot, 'BibleData-master', 'BibleData-master');
const geocodingRoot = path.join(
  sourceRoot,
  'Bible-Geocoding-Data-main',
  'Bible-Geocoding-Data-main'
);
const contentRoot = path.join(repoRoot, 'content', 'knowledge');
const auditRoot = path.join(repoRoot, 'factory-output', 'knowledge-extensions');

const BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges',
  'Ruth', '1-Samuel', '2-Samuel', '1-Kings', '2-Kings', '1-Chronicles',
  '2-Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song-of-Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah',
  'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew',
  'Mark', 'Luke', 'John', 'Acts', 'Romans', '1-Corinthians', '2-Corinthians',
  'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1-Thessalonians',
  '2-Thessalonians', '1-Timothy', '2-Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1-Peter', '2-Peter', '1-John', '2-John', '3-John', 'Jude',
  'Revelation'
];

const SEMANTIC_CATEGORIES = [
  ['keyterms', 'keyterm'],
  ['realia', 'realia'],
  ['groups', 'group'],
  ['flora', 'flora'],
  ['fauna', 'fauna'],
  ['deities', 'deity']
];

function ensureDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function requirePath(target) {
  if (!fs.existsSync(target)) throw new Error(`Required source is missing: ${target}`);
}

function writeJson(target, value) {
  ensureDirectory(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(value)}\n`, 'utf8');
}

function writePrettyJson(target, value) {
  ensureDirectory(path.dirname(target));
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function descriptionFrom(localization) {
  const descriptions = Array.isArray(localization?.descriptions)
    ? localization.descriptions
    : [];
  return cleanText(
    descriptions.map((entry) => entry?.description || entry?.gloss || '').find(Boolean)
  );
}

function sourceCodeFromNumericReference(reference) {
  const digits = String(reference || '').replace(/\D/g, '');
  if (digits.length !== 8) return null;
  const bookNumber = Number(digits.slice(0, 2));
  const chapter = Number(digits.slice(2, 5));
  const verse = Number(digits.slice(5, 8));
  const book = BOOKS[bookNumber - 1];
  if (!book || !chapter || !verse) return null;
  const testament = bookNumber <= 39 ? 'OT' : 'NT';
  return `${testament}-${book}-${String(chapter).padStart(2, '0')}-${String(verse).padStart(2, '0')}`;
}

function sourceCode(bookNumber, chapter, verse) {
  const book = BOOKS[Number(bookNumber) - 1];
  if (!book || !Number(chapter) || !Number(verse)) return null;
  return `${Number(bookNumber) <= 39 ? 'OT' : 'NT'}-${book}-${String(chapter).padStart(2, '0')}-${String(verse).padStart(2, '0')}`;
}

function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function buildSemanticEntities() {
  const outputDirectory = path.join(contentRoot, 'semantic');
  const sourceIndex = {};
  const manifest = { schema_version: '1.0', categories: {}, total_entities: 0 };
  const failures = [];

  for (const [folder, category] of SEMANTIC_CATEGORIES) {
    const directory = path.join(acaiRoot, folder, 'json');
    requirePath(directory);
    const records = [];
    for (const fileName of fs.readdirSync(directory).filter((name) => name.endsWith('.json'))) {
      try {
        const source = JSON.parse(fs.readFileSync(path.join(directory, fileName), 'utf8'));
        const localization = source.localizations?.eng || {};
        const references = unique((source.references || [])
          .map(sourceCodeFromNumericReference));
        const keyReferences = unique((source.key_references || [])
          .map(sourceCodeFromNumericReference));
        const subtype =
          source[`${category}_type`] ||
          source.realia_type ||
          source.group_type ||
          source.flora_type ||
          source.fauna_type ||
          source.deity_type ||
          '';
        const record = {
          entity_id: source.id,
          primary_id: source.primary_id || source.id,
          category,
          subtype,
          name_en: cleanText(localization.preferred_label),
          aliases_en: unique(localization.alternate_labels || []),
          description_en: descriptionFrom(localization),
          source_codes: references,
          key_source_codes: keyReferences,
          referred_to_as: unique(source.referred_to_as || []),
          group_origin: source.group_origin || null,
          only_apocrypha: Boolean(source.only_mentioned_in_apocrypha),
          non_biblical: Boolean(source.non_biblical),
          source: 'ACAI'
        };
        records.push(record);
        references.forEach((code) => {
          if (!sourceIndex[code]) sourceIndex[code] = [];
          sourceIndex[code].push(record.entity_id);
        });
      } catch (error) {
        failures.push({ category, file: fileName, error: error.message });
      }
    }
    records.sort((a, b) => a.name_en.localeCompare(b.name_en));
    const relativeFile = `semantic/${category}.json`;
    writeJson(path.join(contentRoot, relativeFile), {
      schema_version: '1.0',
      category,
      records
    });
    manifest.categories[category] = {
      count: records.length,
      file: `knowledge/${relativeFile}`
    };
    manifest.total_entities += records.length;
  }
  Object.keys(sourceIndex).forEach((code) => {
    sourceIndex[code] = unique(sourceIndex[code]);
  });
  writeJson(path.join(outputDirectory, 'by-source.json'), {
    schema_version: '1.0',
    source_to_entities: sourceIndex
  });
  manifest.source_code_count = Object.keys(sourceIndex).length;
  manifest.by_source_file = 'knowledge/semantic/by-source.json';
  writePrettyJson(path.join(outputDirectory, 'manifest.json'), manifest);
  return { manifest, failures };
}

async function buildConcordance() {
  const csvFile = path.join(theographicRoot, 'CSV', 'WordIndex.csv');
  requirePath(csvFile);
  const outputDirectory = path.join(contentRoot, 'concordance');
  ensureDirectory(outputDirectory);

  const bookMaps = Array.from({ length: 66 }, () => new Map());
  const globalCounts = new Map();
  const globalBooks = new Map();
  let rowCount = 0;
  let invalidRows = 0;
  const stream = fs.createReadStream(csvFile, 'utf8');
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let headers = null;
  for await (const line of lines) {
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    if (!line) continue;
    const values = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    const bookNumber = Number(row.BookID);
    const code = sourceCode(bookNumber, row.Chapter, row.VerseNum);
    const word = cleanText(row.Word);
    if (!code || !word || !bookMaps[bookNumber - 1]) {
      invalidRows += 1;
      continue;
    }
    rowCount += 1;
    const key = word.toLocaleLowerCase('en-US');
    const bookMap = bookMaps[bookNumber - 1];
    if (!bookMap.has(key)) {
      bookMap.set(key, {
        word,
        count: 0,
        syllables: Number(row.Syllables) || null,
        source_codes: new Set(),
        person_ids: new Set(),
        place_ids: new Set(),
        year_min: null,
        year_max: null
      });
    }
    const entry = bookMap.get(key);
    entry.count += 1;
    entry.source_codes.add(code);
    if (row.PersonID && row.PersonID !== '0') entry.person_ids.add(row.PersonID);
    if (row.PlaceID && row.PlaceID !== '0') entry.place_ids.add(row.PlaceID);
    const year = Number(row.YearNum);
    if (Number.isFinite(year) && year !== 0) {
      entry.year_min = entry.year_min === null ? year : Math.min(entry.year_min, year);
      entry.year_max = entry.year_max === null ? year : Math.max(entry.year_max, year);
    }
    globalCounts.set(key, (globalCounts.get(key) || 0) + 1);
    if (!globalBooks.has(key)) globalBooks.set(key, new Set());
    globalBooks.get(key).add(bookNumber);
  }

  const books = [];
  bookMaps.forEach((bookMap, index) => {
    const records = [...bookMap.values()].map((entry) => ({
      ...entry,
      source_codes: [...entry.source_codes],
      person_ids: [...entry.person_ids],
      place_ids: [...entry.place_ids]
    })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
    const slug = `${String(index + 1).padStart(2, '0')}-${BOOKS[index].toLowerCase()}`;
    const file = `knowledge/concordance/${slug}.json`;
    writeJson(path.join(repoRoot, 'content', file), {
      schema_version: '1.0',
      book_number: index + 1,
      book: BOOKS[index],
      records
    });
    books.push({
      book_number: index + 1,
      book: BOOKS[index],
      unique_words: records.length,
      word_occurrences: records.reduce((sum, record) => sum + record.count, 0),
      file
    });
  });
  const topWords = [...globalCounts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, 2000);
  const allWords = [...globalCounts.entries()]
    .map(([word, count]) => ({
      word,
      count,
      book_numbers: [...(globalBooks.get(word) || [])]
    }))
    .sort((a, b) => a.word.localeCompare(b.word));
  const manifest = {
    schema_version: '1.0',
    source: 'Theographic WordIndex',
    source_rows: rowCount,
    invalid_rows: invalidRows,
    unique_words: globalCounts.size,
    top_words: topWords,
    all_words: allWords,
    books
  };
  writePrettyJson(path.join(outputDirectory, 'manifest.json'), manifest);
  return manifest;
}

function buildReferenceContent() {
  const jsonRoot = path.join(theographicRoot, 'json');
  const booksSource = JSON.parse(fs.readFileSync(path.join(jsonRoot, 'books.json'), 'utf8'));
  const chaptersSource = JSON.parse(fs.readFileSync(path.join(jsonRoot, 'chapters.json'), 'utf8'));
  const groupsSource = JSON.parse(fs.readFileSync(path.join(jsonRoot, 'peopleGroups.json'), 'utf8'));
  const eastonSource = JSON.parse(fs.readFileSync(path.join(jsonRoot, 'easton.json'), 'utf8'));

  const books = booksSource.map(({ id, fields = {} }) => ({
    source_id: id,
    osis_name: fields.osisName || '',
    order: Number(fields.bookOrder) || null,
    name_en: fields.bookName || '',
    division: fields.bookDiv || '',
    testament: fields.testament || '',
    short_name: fields.shortName || '',
    slug: fields.slug || '',
    year_written: fields.yearWritten || '',
    place_written_ids: fields.placeWritten || [],
    chapter_count: Number(fields.chapterCount) || null,
    verse_count: Number(fields.verseCount) || null,
    writer_ids: fields.writers || [],
    people_count: Number(fields.peopleCount) || 0,
    place_count: Number(fields.placeCount) || 0
  })).sort((a, b) => (a.order || 999) - (b.order || 999));

  const chapters = chaptersSource.map(({ id, fields = {} }) => ({
    source_id: id,
    osis_ref: fields.osisRef || '',
    book_ids: fields.book || [],
    chapter_number: Number(fields.chapterNum) || null,
    writer_ids: fields.writer || [],
    verse_ids: fields.verses || [],
    slug: fields.slug || '',
    people_count: Number(fields.peopleCount) || 0,
    place_count: Number(fields.placesCount) || 0
  }));

  const peopleGroups = groupsSource.map(({ id, fields = {} }) => ({
    source_id: id,
    name_en: fields.groupName || '',
    member_ids: fields.members || [],
    parent_group_ids: fields.partOf || [],
    verse_ids: fields.verses || [],
    event_ids: fields.events || []
  })).sort((a, b) => a.name_en.localeCompare(b.name_en));

  const easton = eastonSource.map(({ id, fields = {} }) => ({
    source_id: id,
    term_id: fields.termID || '',
    term_en: fields.termLabel || '',
    text_en: cleanText(fields.dictText),
    match_type: fields.matchType || '',
    match_slugs: fields.matchSlugs || [],
    person_ids: fields.personLookup || [],
    place_ids: fields.placeLookup || []
  })).filter((record) => record.term_en || record.text_en);

  const topicDirectory = path.join(bibleDataRoot, 'encyclopedia', 'lists');
  const topics = fs.readdirSync(topicDirectory)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({
      topic: path.basename(name, '.md'),
      source_markdown: fs.readFileSync(path.join(topicDirectory, name), 'utf8')
    }));

  const output = {
    books: { records: books },
    chapters: { records: chapters },
    people_groups: { records: peopleGroups },
    easton: { records: easton },
    topics: { records: topics }
  };
  Object.entries(output).forEach(([name, value]) => {
    writeJson(path.join(contentRoot, 'reference', `${name.replace('_', '-')}.json`), {
      schema_version: '1.0',
      source: name === 'topics' ? 'BibleData' : 'Theographic',
      ...value
    });
  });
  return {
    books: books.length,
    chapters: chapters.length,
    people_groups: peopleGroups.length,
    easton_entries: easton.length,
    topic_lists: topics.length
  };
}

function readJsonLines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function buildModernPlacesAndImages() {
  const modern = readJsonLines(path.join(geocodingRoot, 'data', 'modern.jsonl'));
  const ancient = readJsonLines(path.join(geocodingRoot, 'data', 'ancient.jsonl'));
  const images = readJsonLines(path.join(geocodingRoot, 'data', 'image.jsonl'));
  const ancientNames = Object.fromEntries(ancient.map((place) => [
    place.id,
    place.friendly_id || place.names?.[0]?.name || place.id
  ]));

  const modernRecords = modern.map((place) => {
    const [longitude, latitude] = String(place.lonlat || '').split(',').map(Number);
    return {
      modern_id: place.id,
      name_en: place.friendly_id || place.names?.[0]?.name || '',
      aliases_en: unique((place.names || []).map((name) => name.name)),
      type: place.type || '',
      class: place.class || '',
      longitude: Number.isFinite(longitude) ? longitude : null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      precision: place.precision || null,
      ancient_associations: Object.entries(place.ancient_associations || {}).map(
        ([ancientId, association]) => ({
          ancient_id: ancientId,
          ancient_name_en: ancientNames[ancientId] || association.name || '',
          confidence_score: Number(association.score) || 0
        })
      ),
      image_id: place.media?.thumbnail?.image_id || null,
      source: 'Bible-Geocoding-Data'
    };
  });

  const allowedLicensePattern =
    /^(CC0|CC-ZERO|CC-PD-MARK|PUBLIC DOMAIN|PD|CC-BY(?:-SA)?-(?:1\.0|2\.0|2\.5|3\.0|4\.0)(?:-[A-Z]{2,3})?|GFDL|ATTRIBUTION|FAL|GPL)$/i;
  const imageRecords = images.map((image) => {
    const modernIds = unique([
      ...Object.keys(image.descriptions || {}),
      ...Object.keys(image.thumbnails || {})
    ]);
    const license = cleanText(image.license).toUpperCase();
    return {
      image_id: image.id,
      license: image.license || '',
      public_allowed: allowedLicensePattern.test(license),
      author: cleanText(image.author),
      credit: cleanText(image.credit),
      credit_url: image.credit_url || image.url || '',
      source_page_url: image.url || image.credit_url || '',
      file_url: image.file_url || '',
      thumbnail_url_pattern: image.thumbnail_url_pattern || '',
      width: Number(image.width) || null,
      height: Number(image.height) || null,
      modern_ids: modernIds,
      descriptions: image.descriptions || {}
    };
  });

  writeJson(path.join(contentRoot, 'geography', 'modern-places.json'), {
    schema_version: '1.0',
    records: modernRecords
  });
  writeJson(path.join(contentRoot, 'images', 'licensed-manifest.json'), {
    schema_version: '1.0',
    policy: 'External image links are retained with source and licence metadata. User-facing attribution is handled by the site-level credits notice.',
    records: imageRecords.filter((record) =>
      record.thumbnail_url_pattern || record.file_url || record.source_page_url)
  });
  const licenseCounts = {};
  imageRecords.forEach((record) => {
    const key = record.license || '[missing]';
    licenseCounts[key] = (licenseCounts[key] || 0) + 1;
  });
  return {
    modern_places: modernRecords.length,
    ancient_modern_links: modernRecords.reduce(
      (sum, record) => sum + record.ancient_associations.length,
      0
    ),
    image_records: imageRecords.length,
    licensed_images: imageRecords.filter((record) =>
      record.public_allowed && (record.thumbnail_url_pattern || record.file_url)).length,
    linked_images: imageRecords.filter((record) =>
      record.thumbnail_url_pattern || record.file_url || record.source_page_url).length,
    excluded_images: imageRecords.filter((record) =>
      !record.public_allowed || !(record.thumbnail_url_pattern || record.file_url)).length,
    license_counts: licenseCounts
  };
}

async function main() {
  [acaiRoot, theographicRoot, bibleDataRoot, geocodingRoot].forEach(requirePath);
  ensureDirectory(contentRoot);
  ensureDirectory(auditRoot);

  console.log('EXTENSION_STAGE_START=semantic');
  const semantic = buildSemanticEntities();
  console.log('EXTENSION_STAGE_DONE=semantic');

  console.log('EXTENSION_STAGE_START=concordance');
  const concordance = await buildConcordance();
  console.log('EXTENSION_STAGE_DONE=concordance');

  console.log('EXTENSION_STAGE_START=reference');
  const reference = buildReferenceContent();
  console.log('EXTENSION_STAGE_DONE=reference');

  console.log('EXTENSION_STAGE_START=geography-images');
  const geographyImages = buildModernPlacesAndImages();
  console.log('EXTENSION_STAGE_DONE=geography-images');

  const report = {
    generated_at: new Date().toISOString(),
    source_root: sourceRoot,
    counts: {
      semantic_entities: semantic.manifest.total_entities,
      semantic_source_codes: semantic.manifest.source_code_count,
      concordance_rows: concordance.source_rows,
      concordance_unique_words: concordance.unique_words,
      concordance_books: concordance.books.length,
      ...reference,
      ...geographyImages
    },
    validation: {
      semantic_parse_failures: semantic.failures,
      concordance_invalid_rows: concordance.invalid_rows,
      missing_book_partitions: concordance.books.filter((book) => !book.word_occurrences)
        .map((book) => book.book)
    }
  };
  report.status =
    semantic.failures.length ||
    concordance.invalid_rows ||
    report.validation.missing_book_partitions.length
      ? 'warning'
      : 'success';
  writePrettyJson(path.join(auditRoot, 'validation-report.json'), report);
  writePrettyJson(path.join(contentRoot, 'manifest.json'), {
    schema_version: '1.0',
    generated_at: report.generated_at,
    counts: report.counts,
    sections: {
      semantic: 'knowledge/semantic/manifest.json',
      concordance: 'knowledge/concordance/manifest.json',
      books: 'knowledge/reference/books.json',
      chapters: 'knowledge/reference/chapters.json',
      people_groups: 'knowledge/reference/people-groups.json',
      dictionary: 'knowledge/reference/easton.json',
      topics: 'knowledge/reference/topics.json',
      modern_places: 'knowledge/geography/modern-places.json',
      licensed_images: 'knowledge/images/licensed-manifest.json'
    }
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
