import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";
import path from "node:path";

const bibleRoot = "C:\\Users\\daeca\\Desktop\\gongboo.org\\BIBLE";
const workbookPath = path.join(bibleRoot, "import", "Test of member.xlsx");
const envPath = path.join(bibleRoot, "config", ".env.supabase.local");
const reportPath = path.join(bibleRoot, "logs", "supabase-member-sync-report.json");

async function loadEnv(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}

function clean(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function booleanValue(value) {
  return ["1", "true", "yes", "y", "active", "a"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function listValue(value) {
  const text = clean(value);
  if (!text) return [];
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (_) {}
  }
  return text.split(/[|,;]/).map((item) => item.trim()).filter(Boolean);
}

function isoValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    return new Date(Date.UTC(1899, 11, 30) + value * 86400000).toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function isoDate(value) {
  const iso = isoValue(value);
  return iso ? iso.slice(0, 10) : null;
}

function rowsFromSheet(workbook, sheetName) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const used = sheet.getUsedRange(true);
  if (!used || used.rowCount < 2) return [];
  const values = used.values;
  const headers = values[0].map((value) => String(value || "").trim().toLowerCase());
  return values.slice(1)
    .filter((row) => row.some((value) => value !== null && value !== ""))
    .map((row, rowIndex) => Object.fromEntries(
      headers.map((header, columnIndex) => [header, row[columnIndex]])
        .filter(([header]) => header)
    ))
    .map((row) => ({ ...row, __rowNumber: rowIndex + 2 }));
}

function legacyPassword(pin) {
  const value = String(pin ?? "").trim();
  if (!value) throw new Error("A member PIN is missing.");
  return value.length < 6 ? `GB!${value}` : value;
}

async function api(url, key, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json;charset=utf-8",
          ...(options.headers || {}),
        },
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return { body, headers: response.headers };
      if (![408, 429, 500, 502, 503, 504].includes(response.status)) {
        throw new Error(body.message || body.msg || `HTTP ${response.status}`);
      }
      lastError = new Error(body.message || body.msg || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** (attempt - 1), 12000)));
  }
  throw lastError;
}

async function listAuthUsers(baseUrl, key) {
  const result = await api(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1000`, key);
  const users = Array.isArray(result.body) ? result.body : result.body.users || [];
  return new Map(users.map((user) => [String(user.email || "").toLowerCase(), user]));
}

async function createAuthUser(baseUrl, key, member) {
  const email = String(member.email || "").trim().toLowerCase();
  const result = await api(`${baseUrl}/auth/v1/admin/users`, key, {
    method: "POST",
    body: JSON.stringify({
      email,
      password: legacyPassword(member.pin),
      email_confirm: true,
      user_metadata: {
        name: clean(member.name) || "",
        phone: clean(member.pn) || "",
        legacy_member_id: clean(member.id),
      },
    }),
  });
  return result.body.user || result.body;
}

async function upsert(baseUrl, key, table, conflict, rows) {
  if (!rows.length) return;
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    await api(
      `${baseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`,
      key,
      {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(batch),
      }
    );
  }
}

const env = await loadEnv(envPath);
const baseUrl = String(env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) throw new Error("Supabase URL or secret key is missing.");

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const memberRows = rowsFromSheet(workbook, "member");
const subjectRows = rowsFromSheet(workbook, "subjects");

const emailSet = new Set();
for (const member of memberRows) {
  const email = String(member.email || "").trim().toLowerCase();
  if (!email || emailSet.has(email)) throw new Error("Missing or duplicate member email.");
  emailSet.add(email);
}

const existingUsers = await listAuthUsers(baseUrl, key);
let createdUsers = 0;
const profiles = [];
for (const member of memberRows) {
  const email = String(member.email).trim().toLowerCase();
  let authUser = existingUsers.get(email);
  if (!authUser) {
    authUser = await createAuthUser(baseUrl, key, member);
    existingUsers.set(email, authUser);
    createdUsers += 1;
  }
  const status = String(member.payment_status || "").trim().toLowerCase();
  const accountType = String(member.account_type || "personal").trim().toLowerCase() || "personal";
  profiles.push({
    id: authUser.id,
    email,
    display_name: clean(member.name),
    phone: clean(member.pn),
    account_type: accountType === "admin" ? "admin" : "personal",
    payment_status: status,
    expired_date: isoDate(member.expired_date),
    access_subjects: listValue(member.access_subjects),
    is_trial: status === "p",
    trial_start: 1,
    trial_limit: 20,
    set_size: 120,
    active: accountType === "admin" || status === "a" || status === "p",
    amount: Number(member.amount) || null,
    payment_date: isoValue(member.payment_date),
    last_login: isoValue(member.last_login),
    memo: clean(member.memo),
    max_sessions: Math.max(1, Number(member.max_sessions) || 1),
    legacy_source: "Test of member/member",
    legacy_row_number: member.__rowNumber,
    created_at: isoValue(member.created_at) || new Date().toISOString(),
  });
}

const subjects = subjectRows.map((row) => ({
  code: clean(row.code),
  name: clean(row.name),
  category: clean(row.category),
  sheet_name: clean(row.sheet),
  set_size: Math.max(1, Number(row.set_size) || 120),
  data_format: clean(row.format),
  active: booleanValue(row.active),
  version: clean(row.version),
  question_count: Math.max(0, Number(row.question_count) || 0),
}));

await upsert(baseUrl, key, "member_profiles", "id", profiles);
await upsert(baseUrl, key, "study_subjects", "code", subjects);

const report = {
  completedAt: new Date().toISOString(),
  sourceWorkbook: workbookPath,
  activeMembers: memberRows.length,
  authUsersCreated: createdUsers,
  profilesUpserted: profiles.length,
  subjectsUpserted: subjects.length,
  backupRowsNotActivated: rowsFromSheet(workbook, "backup").length,
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
