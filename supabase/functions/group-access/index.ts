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

function validPin(pin: string) {
  return /^\d{4,12}$/.test(pin);
}

async function requireAdmin(
  authClient: ReturnType<typeof createClient>,
  service: ReturnType<typeof createClient>,
  accessToken: string,
) {
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return null;
  const { data: profile } = await service
    .from("member_profiles")
    .select("account_type,active")
    .eq("id", authData.user.id)
    .maybeSingle();
  return profile?.active && profile.account_type === "admin" ? authData.user : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ message: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ message: "Service configuration is unavailable." }, 500);

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = String(payload.action || "");
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (action === "list_organizations") {
    const { data: organizations, error } = await service
      .from("learning_organizations")
      .select("id,organization_name")
      .eq("active", true)
      .order("organization_name", { ascending: true });
    if (error) return json({ message: "Unable to load organizations." }, 500);
    return json({ status: "success", organizations: organizations || [] });
  }

  if (action === "login") {
    const loginEmail = String(payload.login_email || "").trim().toLowerCase();
    const pin = String(payload.pin || "").trim();
    if (!loginEmail || !loginEmail.includes("@") || !validPin(pin)) {
      return json({ message: "Email and a 4–12 digit PIN are required." }, 400);
    }
    const { data: member } = await service
      .from("learning_organization_members")
      .select("auth_user_id,active,login_email")
      .ilike("login_email", loginEmail)
      .maybeSingle();
    if (!member?.active || !member.auth_user_id) return json({ message: "Email or PIN is incorrect." }, 401);
    const { data: authUser, error: authUserError } = await service.auth.admin.getUserById(member.auth_user_id);
    if (authUserError || !authUser.user?.email) return json({ message: "Email or PIN is incorrect." }, 401);
    const anonymous = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: sessionData, error: signInError } = await anonymous.auth.signInWithPassword({ email: authUser.user.email, password: pin });
    if (signInError || !sessionData.session) return json({ message: "Email or PIN is incorrect." }, 401);
    return json({ status: "success", session: sessionData.session });
  }

  if (action === "create_member") {
    const accessToken = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const adminUser = await requireAdmin(authClient, service, accessToken);
    if (!adminUser) return json({ message: "Administrator access is required." }, 403);
    const organizationId = String(payload.organization_id || "").trim();
    const memberName = String(payload.member_name || "").trim();
    const loginEmail = String(payload.login_email || "").trim().toLowerCase();
    const memo = String(payload.memo || "").trim();
    const pin = String(payload.pin || "").trim();
    if (!organizationId || !memberName || !loginEmail || !loginEmail.includes("@") || !validPin(pin)) {
      return json({ message: "Member name, email, and a 4–12 digit PIN are required." }, 400);
    }
    const { data: organization } = await service.from("learning_organizations").select("id,seat_limit,active").eq("id", organizationId).maybeSingle();
    if (!organization?.active) return json({ message: "The organization is unavailable." }, 400);
    const { count } = await service.from("learning_organization_members").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("active", true);
    if ((count || 0) >= organization.seat_limit) return json({ message: "The organization seat limit has been reached." }, 409);
    const { data: createdUser, error: createUserError } = await service.auth.admin.createUser({
      email: loginEmail,
      password: pin,
      email_confirm: true,
      user_metadata: { group_member: true, display_name: memberName },
    });
    if (createUserError || !createdUser.user) return json({ message: createUserError?.message || "Unable to create the group member." }, 500);
    const userId = createdUser.user.id;
    const { error: profileError } = await service.from("member_profiles").update({
      display_name: memberName,
      account_type: "personal",
      payment_status: "a",
      is_trial: false,
      active: true,
      access_subjects: ["BIBLE_OT", "BIBLE_NT"],
    }).eq("id", userId);
    if (profileError) {
      await service.auth.admin.deleteUser(userId);
      return json({ message: "Unable to prepare the member profile." }, 500);
    }
    const { data: member, error: memberError } = await service.from("learning_organization_members").insert({
      organization_id: organizationId,
      member_name: memberName,
      login_email: loginEmail,
      memo,
      auth_user_id: userId,
    }).select("id,member_name,memo,active,created_at").single();
    if (memberError) {
      await service.auth.admin.deleteUser(userId);
      return json({ message: memberError.message }, 409);
    }
    return json({ status: "success", member });
  }

  return json({ message: "Unknown action." }, 400);
});
