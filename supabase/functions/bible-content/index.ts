import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json;charset=utf-8",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function questionRow(row: Record<string, unknown>) {
  return {
    N: row.n,
    SUBJECT: row.source_code,
    SOURCE_CODE: row.source_code,
    POINT_CODE: row.point_code,
    Q_EN: row.q_en,
    Q_KO: row.q_ko,
    P_EN: row.passage_en,
    P_KO: row.passage_ko,
    "1_EN": row.option_1_en,
    "1_KO": row.option_1_ko,
    "2_EN": row.option_2_en,
    "2_KO": row.option_2_ko,
    "3_EN": row.option_3_en,
    "3_KO": row.option_3_ko,
    "4_EN": row.option_4_en,
    "4_KO": row.option_4_ko,
    A: row.answer,
    E_EN: row.explanation_en,
    E_KO: row.explanation_ko,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ status: "error", message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ status: "error", code: "SERVER_CONFIG", message: "Bible content is unavailable." }, 500);
  }

  // Bible study is public during beta. Authentication remains optional so a
  // signed-in user can still be recognized without blocking guest access.
  if (accessToken) {
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await authClient.auth.getUser(accessToken);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const payload = await request.json().catch(() => ({}));
  if (payload.action === "storage_file") {
    const storagePath = String(payload.path || "")
      .replace(/^\/+/, "")
      .replace(/\\/g, "/");
    if (!storagePath || storagePath.includes("..") ||
        !/^(content|commentary)\//.test(storagePath)) {
      return json({ status: "error", message: "A valid Bible content path is required." }, 400);
    }
    const { data: file, error: fileError } = await admin.storage
      .from("bible-content")
      .download(storagePath);
    if (fileError || !file) {
      return json({
        status: "error",
        message: fileError?.message || "Bible content was not found.",
      }, 404);
    }
    return new Response(file, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": file.type || "application/octet-stream",
        "Cache-Control": "public, max-age=300",
      },
    });
  }
  const requestedSubject = String(payload.sheet || "BIBLE-OT").replace(/-/g, "_").toUpperCase();
  const questionTable = requestedSubject === "BIBLE_NT"
    ? "bible_nt_questions"
    : "bible_ot_questions";
  if (payload.action === "catalog") {
    const catalogRows: Record<string, unknown>[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data: page, error: catalogError } = await admin
        .from("bible_question_catalog")
        .select("catalog_code,book_code,chapter,start_n,last_n,question_count,status")
        .order("catalog_code", { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (catalogError) return json({ status: "error", message: catalogError.message }, 500);
      catalogRows.push(...(page || []));
      if (!page || page.length < pageSize) break;
    }
    return json({
      status: "success",
      catalog: catalogRows.map((row) => ({
        CODE: row.catalog_code,
        BOOK_EN: row.book_code,
        CHAPTER: row.chapter,
        START_ROW: row.start_n,
        LAST_ROW: row.last_n,
        QUESTION_COUNT: row.question_count,
        STATUS: row.status,
      })),
    });
  }
  if (payload.action === "source_lookup") {
    const sourceCode = String(payload.source_code || "").trim();
    if (!/^(OT|NT)-.+-\d{2,3}-\d{2,3}$/i.test(sourceCode)) {
      return json({ status: "error", message: "A valid Scripture reference is required." }, 400);
    }
    const sourceTable = /^NT-/i.test(sourceCode) ? "bible_nt_questions" : "bible_ot_questions";
    const { data: sourceRows, error: sourceError } = await admin
      .from(sourceTable)
      .select("n,source_code")
      .eq("source_code", sourceCode)
      .order("n", { ascending: true })
      .limit(1);
    if (sourceError) return json({ status: "error", message: sourceError.message }, 500);
    return json({
      status: "success",
      data: (sourceRows || []).map((row) => ({ N: row.n, SOURCE_CODE: row.source_code })),
    });
  }
  if (payload.total === "true" || payload.total === true) {
    const { count, error } = await admin
      .from(questionTable)
      .select("n", { count: "exact", head: true });
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({
      status: "success",
      total: count || 0,
    });
  }

  let start = Math.max(1, Number.parseInt(String(payload.start || 1), 10) || 1);
  let limit = Math.min(200, Math.max(1, Number.parseInt(String(payload.limit || 50), 10) || 50));
  const { data: rows, error } = await admin
    .from(questionTable)
    .select("*")
    .gte("n", start)
    .lte("n", start + limit - 1)
    .order("n", { ascending: true });
  if (error) return json({ status: "error", message: error.message }, 500);
  return json({ status: "success", data: (rows || []).map(questionRow) });
});
