import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.resolve(
  process.env.BIBLE_CONTEXT_SOURCE_ROOT ||
  'C:/Users/daeca/Desktop/gongboo.org/BIBLE/인물DB SOURCE'
);
const roadsPath = path.join(sourceRoot, 'itinere_roads', 'itinere_roads.geojson');
const outputRoot = path.join(repoRoot, 'factory-output', 'bible-context-update');
const contentPath = path.join(repoRoot, 'content', 'ancient-roads25d.json');
// Covers the biblical Levant, Egypt, Asia Minor, Greece, and Rome.
const REGION = { west: 10, south: 20, east: 50, north: 45 };

function inverseWorldMercator(x, y) {
  const a = 6378137;
  const eccentricity = 0.08181919084262149;
  const longitude = (Number(x) / a) * 180 / Math.PI;
  const t = Math.exp(-Number(y) / a);
  let latitude = Math.PI / 2 - 2 * Math.atan(t);
  for (let index = 0; index < 12; index += 1) {
    const sine = Math.sin(latitude);
    latitude = Math.PI / 2 - 2 * Math.atan(
      t * ((1 - eccentricity * sine) / (1 + eccentricity * sine)) ** (eccentricity / 2)
    );
  }
  return [longitude, latitude * 180 / Math.PI];
}

function squareDistance(point, start, end) {
  let x = start[0], y = start[1];
  let dx = end[0] - x, dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = end[0]; y = end[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = point[0] - x; dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance = 0.012) {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const threshold = tolerance * tolerance;
  while (stack.length) {
    const [first, last] = stack.pop();
    let maximum = threshold, selected = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squareDistance(points[index], points[first], points[last]);
      if (distance > maximum) { maximum = distance; selected = index; }
    }
    if (selected >= 0) {
      keep[selected] = 1;
      stack.push([first, selected], [selected, last]);
    }
  }
  return points.filter((_, index) => keep[index]);
}

function inside([longitude, latitude]) {
  return longitude >= REGION.west && longitude <= REGION.east &&
    latitude >= REGION.south && latitude <= REGION.north;
}

function normalizeRoad(feature, index) {
  const sourceLines = feature.geometry?.type === 'MultiLineString'
    ? feature.geometry.coordinates
    : [];
  const converted = sourceLines.map((line) =>
    line.map((point) => inverseWorldMercator(point[0], point[1]))
  );
  if (!converted.some((line) => line.some(inside))) return null;
  const lines = converted.map((line) => simplify(line)).filter((line) => line.length >= 2);
  const properties = feature.properties || {};
  return {
    road_id: `ITINERE-${String(index + 1).padStart(5, '0')}`,
    name: properties.Name || '',
    road_type: properties.Type || '',
    lower_date: Number(properties.Lower_Date) === 9999 ? null : Number(properties.Lower_Date),
    upper_date: Number(properties.Upper_Date) === 9999 ? null : Number(properties.Upper_Date),
    construction_period: properties.Cons_per_e || null,
    itinerary: properties.Itinerary || null,
    certainty: properties.Segment_s || 'Unknown',
    citation: properties.Citation || null,
    bibliography: properties.Bibliograp || null,
    average_slope: Number.isFinite(Number(properties.Avg_Slope)) ? Number(properties.Avg_Slope) : null,
    length_meters: Number.isFinite(Number(properties.Shape_Leng)) ? Number(properties.Shape_Leng) : null,
    lines
  };
}

if (!fs.existsSync(roadsPath)) throw new Error(`Itiner-e GeoJSON not found: ${roadsPath}`);
fs.mkdirSync(outputRoot, { recursive: true });
const raw = JSON.parse(fs.readFileSync(roadsPath, 'utf8'));
const roads = raw.features.map(normalizeRoad).filter(Boolean);
const counts = roads.reduce((result, road) => {
  result[road.certainty] = (result[road.certainty] || 0) + 1;
  return result;
}, {});
const payload = {
  schema_version: '1.0',
  source_updated_at: fs.statSync(roadsPath).mtime.toISOString(),
  source: {
    dataset: 'Itiner-e ancient roads',
    source_crs: 'EPSG:3395',
    normalized_crs: 'EPSG:4326',
    attribution_required: true
  },
  region: REGION,
  road_count: roads.length,
  roads
};
const inventory = {
  source_root: sourceRoot,
  classifications: [
    { name: 'Bible-Geocoding-Data-main', classification: 'already-integrated', use: 'places, verse references, complex geometry' },
    { name: 'itinere_roads', classification: 'integrated-now', use: 'ancient road overlay and route context' },
    { name: 'dfms / dfms_v1_07222026.csv', classification: 'excluded', reason: 'modern streamflow observations are outside the current Bible context scope' },
    { name: 'pta_data-public', classification: 'deferred-phase-2', reason: 'Patristic texts are secondary literature, not core Bible person/place/event records' },
    { name: '17122148.json', classification: 'metadata-only', reason: 'repository deposit metadata rather than Bible content records' }
  ]
};
const report = {
  source_feature_count: raw.features.length,
  included_road_count: roads.length,
  certainty_counts: counts,
  original_coordinate_count: raw.features.reduce((total, feature) =>
    total + (feature.geometry?.coordinates || []).reduce((sum, line) => sum + line.length, 0), 0),
  normalized_coordinate_count: roads.reduce((total, road) =>
    total + road.lines.reduce((sum, line) => sum + line.length, 0), 0),
  invalid_coordinate_count: roads.reduce((total, road) =>
    total + road.lines.flat().filter((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1])).length, 0),
  duplicate_road_id_count: roads.length - new Set(roads.map((road) => road.road_id)).size
};

fs.writeFileSync(path.join(outputRoot, 'ancient-roads25d.json'), JSON.stringify(payload));
fs.writeFileSync(path.join(outputRoot, 'source-inventory.json'), JSON.stringify(inventory, null, 2));
fs.writeFileSync(path.join(outputRoot, 'validation-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(contentPath, JSON.stringify(payload));
console.log(JSON.stringify({ outputRoot, contentPath, ...report }, null, 2));
