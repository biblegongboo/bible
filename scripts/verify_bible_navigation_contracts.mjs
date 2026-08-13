import fs from 'node:fs';

const main = fs.readFileSync(new URL('../supabase/app/main.js', import.meta.url), 'utf8');
const explorer = fs.readFileSync(new URL('../supabase/app/bible-explorer.js', import.meta.url), 'utf8');
const vector = fs.readFileSync(new URL('../supabase/app/graphics/map25d/vector-scene25d.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../supabase/app/index.html', import.meta.url), 'utf8');

const checks = [
  ['inline People links have an exclusive destination', main.includes('button.dataset.biblePersonId = item.id')],
  ['inline Atlas links have an exclusive destination', main.includes('button.dataset.biblePlaceName = item.nameToOpen')],
  ['entity clicks stop propagation', main.includes('event.stopPropagation();')],
  ['Scripture capture excludes non-Scripture destinations', main.includes("event.target.closest('[data-bible-person-id], [data-bible-place-id], [data-bible-place-name], [data-bible-event-id]")],
  ['Timeline place uses the common reveal path', /data-timeline-place-id[\s\S]{0,1800}revealPlaceDetail\(place\)/.test(explorer)],
  ['place reveal scrolls city detail into view', /function revealPlaceDetail[\s\S]{0,500}biblePlaceDetail[\s\S]{0,200}scrollIntoView/.test(explorer)],
  ['Timeline chips carry canonical destinations', explorer.includes('data-bible-person-id=') && explorer.includes('data-bible-place-id=')],
  ['Timeline centre lock remains enabled', vector.includes('lockVerticalPan')],
  ['graphic selections consume native clicks', vector.includes('event.stopPropagation();') && vector.includes('bubbles: false')],
  ['graphic selection happens before a re-render can replace the click target', vector.includes("circle.addEventListener('pointerdown', selectNode)") && vector.includes("hitTarget.addEventListener('pointerdown', selectNode)")],
  ['graphic selection retains a mouse click fallback', vector.includes("circle.addEventListener('click', selectNode)") && vector.includes("hitTarget.addEventListener('click', selectNode)")],
  ['Scripture navigation runs after component handlers', /openBibleScriptureReference_\(referenceButton\.dataset\.bibleSourceCode\);\s*}\);/.test(main)],
  ['release HTML requests the current main bundle', index.includes('main.js?v=9.45-library-search-standard1')]
  ,['main requests the current Explorer bundle', main.includes('bible-explorer.js?v=9.30-library-search-standard1')]
  ,['missing exact verse opens nearest chapter question without an alert', main.includes('opened the nearest available chapter question') && !main.includes("alert('The chapter opened, but no quiz has been created for '")]
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) process.exit(1);
