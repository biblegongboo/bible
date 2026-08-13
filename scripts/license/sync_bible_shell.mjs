import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const sourcePath = path.join(root, 'supabase/app/index.html');
const targetPath = path.join(root, 'license/app/index.html');
const adapterPath = path.join(root, 'license/app/license-main.js');
const oldMainPath = path.join(root, 'license/app/main.js');

let html = fs.readFileSync(sourcePath, 'utf8');
if (!fs.existsSync(adapterPath) && fs.existsSync(oldMainPath)) {
  fs.copyFileSync(oldMainPath, adapterPath);
}

html = html.replace(
  /<script src="\.\/supabase-config\.js[^>]*><\/script>\s*<script src="\.\/supabase-auth\.js[^>]*><\/script>\s*<script src="\.\/supabase-provider\.js[^>]*><\/script>\s*<script type="module">[\s\S]*?initialize\(\);\s*}\);\s*<\/script>/,
  '<script src="./config.js?v=license-shell1"></script>'
);
html += '\n<script type="module" src="./license-main.js?v=license-shell1"></script>\n';
fs.writeFileSync(targetPath, html, 'utf8');
console.log(`Synced Bible UI shell: ${path.relative(root, sourcePath)} -> ${path.relative(root, targetPath)}`);
