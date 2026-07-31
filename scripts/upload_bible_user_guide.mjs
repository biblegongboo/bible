import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(repoRoot, 'supabase', 'app', 'USER-GUIDE.ko.md');
const defaultEnvPath = 'C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config.env.supabase.local';

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

loadEnv(process.env.BIBLE_SUPABASE_ENV || defaultEnvPath);
const supabaseUrl = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '');
if (!supabaseUrl || !serviceKey) throw new Error('Supabase URL and service key are required.');

const storagePath = 'guides/user-guide-ko.md';
const content = fs.readFileSync(sourcePath);
const sha256 = crypto.createHash('sha256').update(content).digest('hex');
const asset = {
  asset_id: 'ASSET-' + crypto.createHash('sha256').update(storagePath).digest('hex').slice(0, 24),
  source_id: 'BIBLE-KNOWLEDGE',
  asset_type: 'user-guide',
  storage_bucket: 'bible-content',
  storage_path: storagePath,
  content_type: 'text/markdown;charset=utf-8',
  byte_size: content.length,
  sha256,
  enabled: true,
  metadata: { title: 'GongBoo Bible Korean user guide', migrated_by: 'upload_bible_user_guide.mjs' }
};
const headers = (extra = {}) => ({ apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, ...extra });
const encodedPath = storagePath.split('/').map(encodeURIComponent).join('/');

const upload = await fetch(supabaseUrl + '/storage/v1/object/bible-content/' + encodedPath, {
  method: 'POST', headers: headers({ 'Content-Type': asset.content_type, 'x-upsert': 'true' }), body: content
});
if (!upload.ok) throw new Error('Storage upload failed: ' + upload.status + ' ' + await upload.text());

const upsert = await fetch(supabaseUrl + '/rest/v1/bible_content_assets?on_conflict=asset_id', {
  method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify(asset)
});
if (!upsert.ok) throw new Error('Asset registration failed: ' + upsert.status + ' ' + await upsert.text());
console.log(JSON.stringify({ status: 'success', storage_path: storagePath, bytes: asset.byte_size, sha256: sha256.slice(0, 16) }));
