// GongBoo Chart Engine v1 — Chart.js configuration is kept intentionally close
// to the official Chart.js JSON shape.  No custom drawing or coordinate conversion.
const ALLOWED_TYPES = new Set(['bar', 'line', 'scatter', 'pie', 'doughnut', 'polarArea', 'radar', 'bubble']);
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
];
let chartLoader = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => window.Chart ? resolve() : reject(new Error('Chart.js was not exposed by the loaded script.'));
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

export function ensureChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartLoader) return chartLoader;
  chartLoader = CDN_SOURCES.reduce((chain, src) => chain.catch(() => loadScript(src)), Promise.reject())
    .then(() => window.Chart)
    .finally(() => { if (!window.Chart) chartLoader = null; });
  return chartLoader;
}

export function validateChartPayload(payload) {
  const errors = [], warnings = [];
  if (!payload || typeof payload !== 'object') return { valid:false, errors:[{ code:'CHART_PAYLOAD_REQUIRED', path:'', message:'A chart JSON object is required.' }], warnings };
  if (String(payload.engine || '').toLowerCase() !== 'chart') errors.push({ code:'CHART_ENGINE_REQUIRED', path:'engine', message:'engine must be "chart".' });
  const config = payload.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) errors.push({ code:'CHART_CONFIG_REQUIRED', path:'config', message:'config must be a Chart.js configuration object.' });
  else {
    if (!ALLOWED_TYPES.has(config.type)) errors.push({ code:'CHART_TYPE_INVALID', path:'config.type', message:`Supported types: ${[...ALLOWED_TYPES].join(', ')}.` });
    if (!config.data || typeof config.data !== 'object' || Array.isArray(config.data)) errors.push({ code:'CHART_DATA_REQUIRED', path:'config.data', message:'config.data must be an object.' });
    else if (!Array.isArray(config.data.datasets) || config.data.datasets.length === 0) errors.push({ code:'CHART_DATASETS_REQUIRED', path:'config.data.datasets', message:'At least one dataset is required.' });
  }
  if (payload.height !== undefined && (!Number.isFinite(Number(payload.height)) || Number(payload.height) < 180 || Number(payload.height) > 900)) warnings.push({ code:'CHART_HEIGHT_DEFAULTED', path:'height', message:'height should be between 180 and 900; the default is used otherwise.' });
  return { valid:errors.length === 0, errors, warnings };
}

export function mountChart(host, payload) {
  const validation = validateChartPayload(payload);
  if (!host || !validation.valid || !window.Chart) return false;
  if (host.__gongbooChart && typeof host.__gongbooChart.destroy === 'function') host.__gongbooChart.destroy();
  const height = Number(payload.height);
  const safeHeight = Number.isFinite(height) && height >= 180 && height <= 900 ? height : 380;
  host.innerHTML = `<div class="gongboo-chart-host" style="height:${safeHeight}px;position:relative"><canvas aria-label="Chart" role="img"></canvas></div>`;
  const canvas = host.querySelector('canvas');
  const config = JSON.parse(JSON.stringify(payload.config));
  config.options = config.options || {};
  if (config.options.responsive === undefined) config.options.responsive = true;
  if (config.options.maintainAspectRatio === undefined) config.options.maintainAspectRatio = false;
  host.__gongbooChart = new window.Chart(canvas.getContext('2d'), config);
  return true;
}
