import fs from 'node:fs';

const html = fs.readFileSync(new URL('../supabase/app/index.html', import.meta.url), 'utf8');
const explorer = fs.readFileSync(new URL('../supabase/app/bible-explorer.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../supabase/app/main.js', import.meta.url), 'utf8');
const checks = [
  ['Sermons alone expose Title/Author search', html.includes('bibleSermonSearchBy') && explorer.includes("librarySection !== 'sermon'")],
  ['collection filter is available', html.includes('bibleSermonSource')],
  ['All and A-Z controls are generated', explorer.includes("['All', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']")],
  ['alphabet ignores leading quotation marks', explorer.includes("replace(/^[^A-Za-z0-9]+/")],
  ['left list loads in scroll batches', explorer.includes('SERMON_BATCH_SIZE = 80') && explorer.includes('results.onscroll')],
  ['load-more button provides a reliable fallback', explorer.includes('data-sermon-load-more') && explorer.includes('Load next')],
  ['selected sermon remains in the right detail pane', explorer.includes('bible-sermon-reader') && explorer.includes('data-sermon-neighbor')],
  ['old title-page Next navigation is removed', !explorer.includes('data-sermon-page="next"')],
  ['nested Explorer cache is refreshed', main.includes('bible-explorer.js?v=9.28-sermon-load-more1')],
  ['release HTML requests the pilot bundle', html.includes('main.js?v=9.43-sermon-load-more1')]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
