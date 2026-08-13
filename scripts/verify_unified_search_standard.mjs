import fs from 'node:fs';

const html = fs.readFileSync('supabase/app/index.html', 'utf8');
const explorer = fs.readFileSync('supabase/app/bible-explorer.js', 'utf8');
const main = fs.readFileSync('supabase/app/main.js', 'utf8');
const checks = [
  ['Bible People alphabet', html.includes('id="biblePeopleAlphabet"')],
  ['Places alphabet', html.includes('id="biblePlaceAlphabet"')],
  ['Verse Topics alphabet', html.includes('id="bibleEntitiesAlphabet"')],
  ['Verse Topics uses independent scrolling', explorer.includes("['entities', 'words', 'dictionary', 'topics', 'books'].includes(section)")],
  ['Journeys search directory', html.includes('id="bibleJourneySearch"') && html.includes('id="bibleJourneyResults"') && html.includes('id="bibleJourneyAlphabet"')],
  ['Timeline search directory', html.includes('id="bibleTimelineSearch"') && html.includes('id="bibleTimelineResults"') && html.includes('id="bibleTimelineAlphabet"')],
  ['Early Church alphabet', html.includes('id="biblePatristicAlphabet"')],
  ['Words alphabet', html.includes('id="bibleWordAlphabet"')],
  ['Dictionary alphabet', html.includes('id="bibleDictionaryAlphabet"')],
  ['Topics search and alphabet', html.includes('id="bibleTopicSearch"') && html.includes('id="bibleTopicAlphabet"')],
  ['Books alphabet', html.includes('id="bibleBookAlphabet"')],
  ['Library alphabet', html.includes('id="bibleLibraryAlphabet"')],
  ['Museum alphabet retained', html.includes('id="bibleMuseumLetters"')],
  ['knowledge alphabet IDs are mapped explicitly', explorer.includes("words: 'bibleWordAlphabet'") && explorer.includes("topics: 'bibleTopicAlphabet'") && explorer.includes("books: 'bibleBookAlphabet'")],
  ['independent list and detail scrolling', html.includes('.bible-explore-layout.is-search-browser')],
  ['automatic prefetch sentinel', explorer.includes("rootMargin: '0px 0px 420px 0px'")],
  ['People automatic prefetch', main.includes('data-people-load-sentinel') && main.includes("rootMargin: '0px 0px 420px 0px'")],
  ['People alphabet does not read list paging state', !main.slice(main.indexOf('function biblePeopleRenderAlphabet_'), main.indexOf('function biblePeopleRelationshipName_')).includes('visibleCount')],
  ['People alphabet filters canonical names, not aliases', main.slice(main.indexOf('function biblePeopleRenderAlphabet_'), main.indexOf('function biblePeopleRelationshipName_')).includes("String(person.NAME_EN || '').trim().toUpperCase().startsWith(biblePeopleLetter)") && !main.slice(main.indexOf('function biblePeopleRenderAlphabet_'), main.indexOf('function biblePeopleRelationshipName_')).includes('biblePeopleRunSearch_')],
  ['manual knowledge load button removed', !explorer.includes('data-knowledge-more')],
  ['museum pages load 80 at a time', explorer.includes('const museumPageSize = 80')],
  ['museum Previous and Next controls removed', !explorer.includes('data-museum-page="next"')]
];
let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  failed ||= !ok;
}
if (failed) process.exit(1);
