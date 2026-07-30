import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const indexFile = path.join(repoRoot, 'content', 'patristic-deep-index.json');
const outputRoot = path.join(repoRoot, 'content', 'patristic-reader');
const manifestFile = path.join(repoRoot, 'content', 'patristic-reader-manifest.json');
const reportFile = path.join(repoRoot, 'factory-output', 'patristic-reader', 'validation-report.json');

function resolveSourceRoot() {
  if (process.env.PATRISTIC_SOURCE_ROOT) return path.resolve(process.env.PATRISTIC_SOURCE_ROOT);
  const bibleRoot = path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE');
  const matches = [];
  function walk(folder, depth = 0) {
    if (depth > 5 || !fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(folder, entry.name);
      if (entry.name === 'pta_data-public' && fs.existsSync(path.join(candidate, 'data'))) {
        matches.push(candidate);
      } else walk(candidate, depth + 1);
    }
  }
  walk(bibleRoot);
  if (!matches.length) throw new Error('Patristic Text Archive source root was not found.');
  return matches[0];
}

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => String.fromCodePoint(parseInt(value, 16)))
    .replace(/&#([0-9]+);/g, (_, value) => String.fromCodePoint(Number(value)))
    .replace(/\s+/g, ' ')
    .trim();
}

function textOnly(xml) {
  return decodeXml(String(xml || '').replace(/<[^>]+>/g, ' '));
}

function extractBlocks(xml) {
  const bodyMatch = xml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : '';
  const blocks = [];
  const expression = /<(head|p|ab|l)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = expression.exec(body))) {
    const text = textOnly(match[2]);
    if (!text) continue;
    blocks.push({
      type: match[1].toLowerCase() === 'head' ? 'heading' : 'paragraph',
      text
    });
  }
  if (!blocks.length) {
    const text = textOnly(body);
    if (text) blocks.push({ type: 'paragraph', text });
  }
  return blocks.flatMap((block) => {
    if (block.text.length <= 5000) return [block];
    const pieces = [];
    let remaining = block.text;
    while (remaining.length > 5000) {
      let end = remaining.lastIndexOf(' ', 5000);
      if (end < 1000) end = 5000;
      pieces.push({ type: block.type, text: remaining.slice(0, end).trim() });
      remaining = remaining.slice(end).trim();
    }
    if (remaining) pieces.push({ type: block.type, text: remaining });
    return pieces;
  });
}

function safeName(id) {
  return String(id).replace(/[^a-z0-9._-]+/gi, '-');
}

try {
  const sourceRoot = resolveSourceRoot();
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const publicRecords = (index.records || []).filter((record) => record.public_allowed);
  const manifestRecords = [];
  const failures = [];
  fs.mkdirSync(outputRoot, { recursive: true });
  for (const record of publicRecords) {
    try {
      const sourceFile = path.join(sourceRoot, record.relative_file);
      const xml = fs.readFileSync(sourceFile, 'utf8');
      const blocks = extractBlocks(xml);
      const readerKey = `${record.id}|${record.language || 'und'}`;
      const fileName = `${safeName(record.id)}-${safeName(record.language || 'und')}.json`;
      const payload = {
        schema_version: '1.0',
        id: record.id,
        title: record.title,
        author: record.author,
        language: record.language,
        content_class: 'historical_secondary_literature',
        disclosure: index.disclosure,
        source: record.source,
        licence_name: record.licence_name,
        licence_url: record.licence_url,
        blocks
      };
      fs.writeFileSync(path.join(outputRoot, fileName), `${JSON.stringify(payload)}\n`, 'utf8');
      manifestRecords.push({
        reader_key: readerKey,
        id: record.id,
        language: record.language || '',
        file: `content/patristic-reader/${fileName}`,
        blocks: blocks.length,
        characters: blocks.reduce((total, block) => total + block.text.length, 0)
      });
    } catch (error) {
      failures.push({ id: record.id, message: error.message });
    }
  }
  const manifest = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    content_class: 'historical_secondary_literature',
    records: manifestRecords
  };
  const report = {
    generated_at: manifest.generated_at,
    source_root: sourceRoot,
    public_index_records: publicRecords.length,
    reader_records: manifestRecords.length,
    unique_reader_files: new Set(manifestRecords.map((record) => record.file)).size,
    records_with_no_text: manifestRecords.filter((record) => !record.characters).length,
    failures
  };
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest)}\n`, 'utf8');
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: failures.length ? 'partial' : 'success', manifestFile, report }, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
