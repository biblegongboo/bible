import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : '';
};
const base = valueAfter('--base');
const allowed = valueAfter('--allow').split(',').map((value) => value.trim()).filter(Boolean);
if (!base || !allowed.length) {
  console.error('Usage: node scripts/verify_bible_release_scope.mjs --base <origin-main-sha> --allow <path,path>');
  process.exit(2);
}

const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
const remoteMain = git('rev-parse', 'origin/main');
if (remoteMain !== base) {
  console.error(`FAIL origin/main changed: expected ${base}, found ${remoteMain}. Integrate on the new main before deploying.`);
  process.exit(1);
}

const changed = new Set([
  ...git('diff', '--name-only', base).split(/\r?\n/),
  ...git('ls-files', '--others', '--exclude-standard').split(/\r?\n/)
].filter(Boolean).map((path) => path.replaceAll('\\', '/')));
const unexpected = [...changed].filter((path) => !allowed.some((entry) =>
  entry.endsWith('/') ? path.startsWith(entry) : path === entry));

if (unexpected.length) {
  console.error(`FAIL files outside the approved release scope:\n${unexpected.map((path) => `  ${path}`).join('\n')}`);
  process.exit(1);
}
console.log(`PASS release base ${base}`);
console.log(`PASS ${changed.size} changed file(s) stay inside the approved scope`);
