import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const envPath =
  process.argv[2] ||
  'C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config\\.env.supabase.local';

function readEnv(filePath) {
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return values;
}

const env = readEnv(envPath);
const rawUrl = env.SUPABASE_URL;
const url = rawUrl
  ?.replace(/\/+$/, '')
  .replace(/\/(?:rest|auth|functions)\/v1$/i, '');
const publishableKey =
  env.SUPABASE_PUBLISHABLE_KEY ||
  (env.SUPABASE_SECRET_KEY?.startsWith('sb_publishable_')
    ? env.SUPABASE_SECRET_KEY
    : '');

if (!url?.startsWith('https://')) {
  throw new Error('SUPABASE_URL is missing or invalid.');
}
if (!publishableKey.startsWith('sb_publishable_')) {
  throw new Error('SUPABASE_PUBLISHABLE_KEY is missing or invalid.');
}

const target = path.join(repoRoot, 'supabase', 'app', 'supabase-config.js');
const content = `window.BIBLE_SUPABASE_CONFIG = Object.freeze({
  url: ${JSON.stringify(url)},
  publishableKey: ${JSON.stringify(publishableKey)},
  questionFunction: 'bible-content',
  enabled: true
});
`;

fs.writeFileSync(target, content, 'utf8');
console.log(
  JSON.stringify({
    configured: true,
    target,
    projectRef: new URL(url).hostname.split('.')[0],
    enabled: true,
  }),
);
