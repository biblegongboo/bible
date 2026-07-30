import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const sourceRoot = resolveSourceRoot();
const outputFile = path.join(repoRoot, 'content', 'bible-geography25d.json');
const auditRoot = path.join(repoRoot, 'factory-output', 'bible-geography');

function resolveSourceRoot() {
  if (process.env.BIBLE_GEOCODING_ROOT) return path.resolve(process.env.BIBLE_GEOCODING_ROOT);
  const bibleRoot = path.join(os.homedir(), 'Desktop', 'gongboo.org', 'BIBLE');
  const matches = [];
  function walk(folder, depth = 0) {
    if (depth > 5 || !fs.existsSync(folder)) return;
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(folder, entry.name);
      if (
        fs.existsSync(path.join(candidate, 'data', 'geometry.jsonl')) &&
        fs.existsSync(path.join(candidate, 'geometry'))
      ) {
        matches.push(candidate);
      } else {
        walk(candidate, depth + 1);
      }
    }
  }
  walk(bibleRoot);
  if (!matches.length) throw new Error('Bible-Geocoding source root was not found.');
  return matches[0];
}

async function readJsonLines(filePath) {
  const rows = [];
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const reader = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of reader) if (line.trim()) rows.push(JSON.parse(line));
  return rows;
}

function validPoint(point) {
  return Array.isArray(point) && point.length >= 2 &&
    Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])) &&
    Number(point[0]) >= -180 && Number(point[0]) <= 180 &&
    Number(point[1]) >= -90 && Number(point[1]) <= 90;
}

function simplifyLine(points, maximum = 180) {
  const valid = (points || []).filter(validPoint).map((point) => [
    Number(Number(point[0]).toFixed(5)),
    Number(Number(point[1]).toFixed(5))
  ]);
  if (valid.length <= maximum) return valid;
  const result = [];
  const step = (valid.length - 1) / (maximum - 1);
  for (let index = 0; index < maximum; index += 1) {
    result.push(valid[Math.round(index * step)]);
  }
  return result;
}

function collectGeometry(geometry, output) {
  if (!geometry || !geometry.type) return;
  const coordinates = geometry.coordinates;
  if (geometry.type === 'LineString') {
    const line = simplifyLine(coordinates);
    if (line.length >= 2) output.lines.push(line);
  } else if (geometry.type === 'MultiLineString') {
    coordinates.forEach((line) => {
      const value = simplifyLine(line);
      if (value.length >= 2) output.lines.push(value);
    });
  } else if (geometry.type === 'Polygon') {
    coordinates.forEach((ring) => {
      const value = simplifyLine(ring);
      if (value.length >= 3) output.polygons.push(value);
    });
  } else if (geometry.type === 'MultiPolygon') {
    coordinates.forEach((polygon) => polygon.forEach((ring) => {
      const value = simplifyLine(ring);
      if (value.length >= 3) output.polygons.push(value);
    }));
  }
}

function geometryFile(row) {
  return row.simplified_geojson_file || row.geojson_file ||
    row.isobands_geojson_file || null;
}

function featureBounds(feature) {
  const points = [...feature.lines, ...feature.polygons].flat();
  if (!points.length) return null;
  return [
    Math.min(...points.map((point) => point[0])),
    Math.min(...points.map((point) => point[1])),
    Math.max(...points.map((point) => point[0])),
    Math.max(...points.map((point) => point[1]))
  ].map((value) => Number(value.toFixed(5)));
}

async function main() {
  const rows = await readJsonLines(path.join(sourceRoot, 'data', 'geometry.jsonl'));
  const features = [];
  const skipped = [];
  for (const row of rows) {
    const fileName = geometryFile(row);
    const filePath = fileName && path.join(sourceRoot, 'geometry', fileName);
    if (!filePath || !fs.existsSync(filePath)) {
      skipped.push({ geometry_id: row.id, reason: 'missing geometry file' });
      continue;
    }
    const geojson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const shape = { lines: [], polygons: [] };
    const sourceFeatures = geojson.type === 'FeatureCollection'
      ? geojson.features || []
      : geojson.type === 'Feature' ? [geojson] : [{ geometry: geojson }];
    sourceFeatures.forEach((feature) => collectGeometry(feature.geometry, shape));
    if (!shape.lines.length && !shape.polygons.length && row.suggested?.rough_boundary) {
      const ring = simplifyLine(row.suggested.rough_boundary.map((value) =>
        String(value).split(',').map(Number)));
      if (ring.length >= 3) shape.polygons.push(ring);
    }
    const feature = {
      id: row.id,
      name: row.name || geojson.metadata?.name || row.id,
      kind: row.geometry,
      land_or_water: row.land_or_water || 'land',
      lines: shape.lines,
      polygons: shape.polygons,
      source: row.source || null,
      source_url: row.source_url || null,
      geometry_credit: row.geometry_credit || null
    };
    feature.bounds = featureBounds(feature);
    if (!feature.bounds) {
      skipped.push({ geometry_id: row.id, reason: 'no line or polygon coordinates' });
      continue;
    }
    features.push(feature);
  }
  const payload = {
    schema_version: '1.0',
    generated_from: 'Bible-Geocoding-Data',
    disclosure: 'Boundaries and paths reproduce the source dataset and may represent approximate or proposed identifications.',
    features
  };
  const report = {
    generated_at: new Date().toISOString(),
    source_root: sourceRoot,
    counts: {
      source_rows: rows.length,
      included_features: features.length,
      water_features: features.filter((item) => item.land_or_water === 'water').length,
      land_features: features.filter((item) => item.land_or_water !== 'water').length,
      line_parts: features.reduce((sum, item) => sum + item.lines.length, 0),
      polygon_rings: features.reduce((sum, item) => sum + item.polygons.length, 0),
      skipped_features: skipped.length
    },
    validation: {
      duplicate_ids: features.length - new Set(features.map((item) => item.id)).size,
      features_without_bounds: features.filter((item) => !item.bounds).length,
      skipped
    }
  };
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.mkdirSync(auditRoot, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(payload)}\n`, 'utf8');
  fs.writeFileSync(path.join(auditRoot, 'bible-geography25d.json'),
    `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(auditRoot, 'validation-report.json'),
    `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'success', outputFile, report }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
