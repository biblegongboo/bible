import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = resolveSourceRoot();
const dataRoot = path.join(sourceRoot, 'data');
const outputFile = path.join(repoRoot, 'content', 'patristic-deep-index.json');
const auditRoot = path.join(repoRoot, 'factory-output', 'patristic-deep-content');

function resolveSourceRoot() {
  if (process.env.PATRISTIC_SOURCE_ROOT) return path.resolve(process.env.PATRISTIC_SOURCE_ROOT);
  const bibleRoot = path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE');
  const matches = [];
  function walk(folder, depth = 0) {
    if (depth > 5 || !fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(folder, entry.name);
      if (
        entry.name === 'pta_data-public' &&
        fs.existsSync(path.join(candidate, 'data'))
      ) {
        matches.push(candidate);
      } else {
        walk(candidate, depth + 1);
      }
    }
  }
  walk(bibleRoot);
  if (!matches.length) throw new Error('Patristic Text Archive source root was not found.');
  return matches[0];
}

function listFiles(folder, output = []) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const target = path.join(folder, entry.name);
    if (entry.isDirectory()) listFiles(target, output);
    else if (entry.isFile() && entry.name.endsWith('.xml') && entry.name !== '__cts__.xml') {
      output.push(target);
    }
  }
  return output;
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function first(text, expression) {
  const match = text.match(expression);
  return match ? decodeXml(match[1]) : '';
}

function attr(text, expression) {
  const match = text.match(expression);
  return match ? String(match[1] || '').trim() : '';
}

function main() {
  const files = listFiles(dataRoot);
  const records = files.map((filePath) => {
    const xml = fs.readFileSync(filePath, 'utf8');
    const headerEnd = xml.indexOf('</teiHeader>');
    const header = headerEnd >= 0 ? xml.slice(0, headerEnd + 12) : xml.slice(0, 40000);
    const licenceTag = header.match(/<licence\b([^>]*)>([\s\S]*?)<\/licence>/i);
    return {
      id: first(header, /<idno\s+type=["']PTA["'][^>]*>([\s\S]*?)<\/idno>/i) ||
        path.basename(filePath, '.xml'),
      title: first(header, /<title\b[^>]*>([\s\S]*?)<\/title>/i),
      author: first(header, /<author\b[^>]*>[\s\S]*?<persName\b[^>]*>([\s\S]*?)<\/persName>[\s\S]*?<\/author>/i),
      language: attr(xml.slice(0, 1000), /<TEI\b[^>]*xml:lang=["']([^"']+)["']/i),
      publication_year: first(header, /<publicationStmt>[\s\S]*?<date\b[^>]*>([\s\S]*?)<\/date>/i),
      licence_name: licenceTag ? decodeXml(licenceTag[2]) : '',
      licence_url: licenceTag ? attr(licenceTag[1], /target=["']([^"']+)["']/i) : '',
      relative_file: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
      source: 'Patristic Text Archive',
      public_allowed: Boolean(licenceTag && attr(licenceTag[1], /target=["']([^"']+)["']/i)),
      status: 'source_provided_secondary_literature'
    };
  }).filter((record) => record.id && record.title);

  const duplicateKey = (record) => `${record.id}|${record.language}`;
  const deduplicated = [...new Map(records.map((record) => [duplicateKey(record), record])).values()];
  const payload = {
    schema_version: '1.0',
    content_class: 'secondary-literature',
    disclosure: 'Patristic works are historical secondary literature and are not part of the KJV/WEB Bible text.',
    records: deduplicated
  };
  const report = {
    generated_at: new Date().toISOString(),
    source_root: sourceRoot,
    counts: {
      xml_files: files.length,
      indexed_records: deduplicated.length,
      authors: new Set(deduplicated.map((record) => record.author).filter(Boolean)).size,
      languages: new Set(deduplicated.map((record) => record.language).filter(Boolean)).size,
      records_with_explicit_licence: deduplicated.filter((record) => record.licence_url).length
    },
    validation: {
      duplicate_id_language_pairs: deduplicated.length -
        new Set(deduplicated.map(duplicateKey)).size,
      missing_title: deduplicated.filter((record) => !record.title).length,
      missing_licence: deduplicated.filter((record) => !record.licence_url).length
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
