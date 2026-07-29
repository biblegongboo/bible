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
  if (!supabaseUrl || !anonKey || !serviceKey || !accessToken) {
    return json({ status: "error", code: "AUTH_REQUIRED", message: "Please log in again." }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ status: "error", code: "AUTH_INVALID", message: "Please log in again." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("member_profiles")
    .select("account_type,payment_status,expired_date,access_subjects,is_trial,trial_start,trial_limit,active")
    .eq("id", authData.user.id)
    .single();
  if (profileError || !profile || !profile.active) {
    return json({ status: "error", code: "AUTH_INACTIVE", message: "This account is inactive." }, 403);
  }

  const today = new Date().toISOString().slice(0, 10);
  const isAdmin = profile.account_type === "admin";
  const isTrial = profile.is_trial === true || profile.payment_status === "p";
  if (!isAdmin && profile.expired_date && profile.expired_date < today) {
    return json({ status: "error", code: "AUTH_EXPIRED", message: "Your subscription has expired." }, 403);
  }
  if (!isAdmin && !isTrial && profile.payment_status !== "a") {
    return json({ status: "error", code: "AUTH_NO_ACCESS", message: "No active subscription." }, 403);
  }

  const payload = await request.json().catch(() => ({}));
  const requestedSubject = String(payload.sheet || "BIBLE-OT").replace(/-/g, "_").toUpperCase();
  const allowedSubjects = Array.isArray(profile.access_subjects) ? profile.access_subjects : [];
  if (!isAdmin && !isTrial && !allowedSubjects.includes(requestedSubject)) {
    return json({ status: "error", code: "AUTH_SUBJECT_DENIED", message: "Subject access is not assigned." }, 403);
  }
  if (payload.action === "catalog") {
    const { data: catalogRows, error: catalogError } = await admin
      .from("bible_question_catalog")
      .select("catalog_code,book_code,chapter,start_n,last_n,question_count,status")
      .order("start_n", { ascending: true });
    if (catalogError) return json({ status: "error", message: catalogError.message }, 500);
    return json({
      status: "success",
      catalog: (catalogRows || []).map((row) => ({
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
  if (requestedSubject === "BIBLE_NT") {
    return json(payload.total === "true" || payload.total === true
      ? { status: "success", total: 0 }
      : { status: "success", data: [] });
  }

  if (payload.total === "true" || payload.total === true) {
    const { count, error } = await admin
      .from("bible_questions")
      .select("n", { count: "exact", head: true });
    if (error) return json({ status: "error", message: error.message }, 500);
    return json({
      status: "success",
      total: isTrial && !isAdmin ? Math.min(Number(profile.trial_limit || 20), count || 0) : count || 0,
    });
  }

  let start = Math.max(1, Number.parseInt(String(payload.start || 1), 10) || 1);
  let limit = Math.min(200, Math.max(1, Number.parseInt(String(payload.limit || 50), 10) || 50));
  if (isTrial && !isAdmin) {
    start = Math.max(1, Number(profile.trial_start || 1));
    limit = Math.min(limit, Math.max(1, Number(profile.trial_limit || 20)));
  }
  const { data: rows, error } = await admin
    .from("bible_questions")
    .select("*")
    .gte("n", start)
    .lte("n", start + limit - 1)
    .order("n", { ascending: true });
  if (error) return json({ status: "error", message: error.message }, 500);
  return json({ status: "success", data: (rows || []).map(questionRow) });
});
