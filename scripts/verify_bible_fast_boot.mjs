import fs from 'node:fs';

const source = fs.readFileSync(new URL('../supabase/app/main.js', import.meta.url), 'utf8');

function expect(pattern, message) {
  if (!pattern.test(source)) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS ${message}`);
  }
}

expect(/prepareBibleInstantHome_\(\);[\s\S]*requestIdleCallback/, 'first screen renders before explorer bindings');
expect(/function prepareBibleInstantHome_\(\)[\s\S]*updateSetSelector\(\);[\s\S]*hideSplash\(\);/, 'instant catalog closes the splash without a network wait');
expect(/history\.scrollRestoration = 'manual'/, 'startup disables stale browser scroll restoration');
expect(/if \(chapter\.__instant\)[\s\S]*await ensureBibleChapterCatalog_\(\)/, 'early chapter clicks wait for the exact catalog');
expect(/bibleChapterCatalogPromise_/, 'catalog requests are deduplicated');

const booksMatch = source.match(/var BIBLE_BOOK_ORDER = \[([\s\S]*?)\n\];/);
const countsMatch = source.match(/var BIBLE_BOOK_CHAPTER_COUNTS = \[([\s\S]*?)\n\];/);
const books = Function(`return [${booksMatch?.[1] || ''}]`)();
const counts = Function(`return [${countsMatch?.[1] || ''}]`)();
const chapters = counts.reduce((sum, value) => sum + value, 0);

if (books.length === 66 && counts.length === 66 && chapters === 1189) {
  console.log('PASS instant catalog covers 66 books and 1,189 chapters');
} else {
  console.error(`FAIL instant catalog shape books=${books.length} counts=${counts.length} chapters=${chapters}`);
  process.exitCode = 1;
}
