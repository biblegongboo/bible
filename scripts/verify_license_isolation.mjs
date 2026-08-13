import fs from 'node:fs';
const migration = fs.readFileSync('supabase/migrations/20260813010000_create_license_quiz_schema.sql','utf8');
const forbidden = [/alter\s+table\s+(public\.)?bible_/i,/drop\s+/i,/delete\s+from\s+(public\.)?bible_/i,/update\s+(public\.)?bible_/i];
const checks = [
  ['migration creates only license tables', ['license_products','license_questions','license_question_translations','license_question_reviews','license_entitlements'].every((name)=>migration.includes(`public.${name}`))],
  ['migration does not mutate Bible objects', forbidden.every((pattern)=>!pattern.test(migration))],
  ['question bank has RLS', migration.includes('alter table public.license_questions enable row level security')],
  ['question bank has no public policy', !/create policy[^;]+license_questions/is.test(migration)],
  ['entitlements reference shared Auth only', migration.includes('references auth.users(id)')]
  ,['sample is final questions 1 through 20', fs.readFileSync('scripts/license/prepare_license_workbook.py','utf8').includes('"sequence_number":order') && fs.readFileSync('scripts/license/prepare_license_workbook.py','utf8').includes('"is_sample":order<=20')]
];
let failed=false; for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);failed||=!ok;} if(failed)process.exit(1);
