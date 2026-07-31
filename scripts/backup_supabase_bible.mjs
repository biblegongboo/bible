import fs from "node:fs";
import path from "node:path";

const defaultEnvPath =
  process.env.BIBLE_SUPABASE_ENV ||
  "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE\\config.env.supabase.local";
const args = process.argv.slice(2);
const envArg = args.find((arg) => arg.startsWith("--env="));
const outputArg = args.find((arg) => arg.startsWith("--output="));

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnv(envArg ? path.resolve(envArg.slice(6)) : defaultEnvPath);

const supabaseUrl = String(process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const serviceKey = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "",
);
if (!supabaseUrl || !serviceKey) {
  throw new Error("Supabase URL and secret key are required.");
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputRoot = outputArg
  ? path.resolve(outputArg.slice("--output=".length))
  : path.join(
      "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE",
      "backups",
      `supabase-before-runtime-content-${timestamp}`,
    );

const tables = [
  "bible_sources",
  "bible_verses",
  "bible_people",
  "bible_person_aliases",
  "bible_person_references",
  "bible_relationships",
  "bible_related_entities",
  "bible_places",
  "bible_events",
  "bible_journeys",
  "bible_content_catalog",
  "bible_question_catalog",
  "bible_questions",
  "study_subjects",
  "member_profiles",
];

function headers(extra = {}) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    ...extra,
  };
}

async function exportTable(table) {
  const outputFile = path.join(outputRoot, `${table}.jsonl`);
  const stream = fs.createWriteStream(outputFile, { encoding: "utf8" });
  let offset = 0;
  let count = 0;
  const pageSize = 1000;
  try {
    while (true) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/${table}?select=*&offset=${offset}&limit=${pageSize}`,
        { headers: headers({ Accept: "application/json" }) },
      );
      if (response.status === 404) {
        stream.end();
        fs.rmSync(outputFile, { force: true });
        return { table, status: "not-found", rows: 0 };
      }
      if (!response.ok) {
        throw new Error(
          `${table} backup failed: ${response.status} ${await response.text()}`,
        );
      }
      const rows = await response.json();
      for (const row of rows) stream.write(`${JSON.stringify(row)}\n`);
      count += rows.length;
      if (rows.length < pageSize) break;
      offset += rows.length;
    }
  } finally {
    stream.end();
  }
  return { table, status: "exported", rows: count };
}

fs.mkdirSync(outputRoot, { recursive: true });
const results = [];
for (const table of tables) {
  const result = await exportTable(table);
  results.push(result);
  console.log(`${table}: ${result.status} (${result.rows})`);
}

const manifest = {
  created_at: new Date().toISOString(),
  project_url: supabaseUrl,
  purpose: "pre-runtime-content migration rollback backup",
  tables: results,
};
fs.writeFileSync(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`backup: ${outputRoot}`);
