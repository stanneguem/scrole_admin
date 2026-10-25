import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
const admin = createClient(url, serviceKey!);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "unauthorized" }, 401);
  try {
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "unauthorized" }, 401);
    const { data: profile, error: profileError } = await admin.from("administrateur_profil")
      .select("role,actif,auth_id").eq("auth_id", authData.user.id).eq("actif", true).maybeSingle();
    if (profileError || !profile || !["super_admin", "admin"].includes(String(profile.role).toLowerCase())) {
      return json({ error: "admin_permission_required" }, 403);
    }
    const { data: permissions, error: permissionsError } = await caller.rpc("admin_permissions_for_current_user");
    if (permissionsError || !(permissions ?? []).some((p: any) => p.permission === "settings.edit")) {
      return json({ error: "notification_management_permission_required" }, 403);
    }
    const input = await req.json();
    const mode = input.mode === "user" ? "user" : "segment";
    const title = String(input.title ?? "").trim();
    const body = String(input.body ?? "").trim();
    if (!title || title.length > 120 || !body || body.length > 1000) return json({ error: "invalid_title_or_body" }, 400);
    let recipients: string[] = [];
    if (mode === "user") {
      const id = String(input.user_id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_user_id" }, 400);
      const { data: user, error } = await admin.from("user_profiles").select("user_id").eq("user_id", id).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (user?.user_id) recipients = [user.user_id];
    } else {
      const filters = input.filters ?? {};
      let query = admin.from("user_profiles").select("user_id").is("deleted_at", null).neq("account_status", "deleted");
      if (filters.country_id && filters.country_id !== "all") query = query.eq("country_id", filters.country_id);
      if (filters.gender && filters.gender !== "all") {
        const genderMap: Record<string, string[]> = { female: ["female", "femme", "female"], male: ["male", "homme"], other: ["other", "autre", "non_binary"] };
        query = query.in("gender", genderMap[String(filters.gender)] ?? []);
      }
      const { data: profiles, error } = await query.limit(10000);
      if (error) throw error;
      let ids = (profiles ?? []).map((p: any) => String(p.user_id));
      if (filters.platform && filters.platform !== "all") {
        const { data: devices, error: deviceError } = await admin.from("user_devices").select("user_id").eq("platform", filters.platform).eq("push_enabled", true).not("device_token", "is", null);
        if (deviceError) throw deviceError;
        const platformIds = new Set((devices ?? []).map((d: any) => String(d.user_id)));
        ids = ids.filter((id) => platformIds.has(id));
      }
      // Language preference table may differ across deployments; use it only when present.
      if (filters.language && filters.language !== "all") {
        const { data: prefs, error: prefError } = await admin.from("user_preferences").select("user_id,language").eq("language", filters.language);
        if (prefError) return json({ error: "language_filter_unavailable", detail: "La table des préférences linguistiques doit être vérifiée pour activer ce filtre." }, 422);
        const languageIds = new Set((prefs ?? []).map((p: any) => String(p.user_id)));
        ids = ids.filter((id) => languageIds.has(id));
      }
      recipients = [...new Set(ids)];
    }
    if (!recipients.length) return json({ ok: true, recipients: 0, inserted: 0 });
    // Batches keep request payloads bounded. The notifications insert trigger dispatches push notifications.
    let inserted = 0;
    for (let i = 0; i < recipients.length; i += 250) {
      const rows = recipients.slice(i, i + 250).map((user_id) => ({
        user_id, type: "admin_broadcast", title, body, actor_id: null,
        data: { source: "scrole_admin", mode, sent_at: new Date().toISOString() },
      }));
      const { error } = await admin.from("notifications").insert(rows);
      if (error) throw error;
      inserted += rows.length;
    }
    return json({ ok: true, recipients: inserted, inserted });
  } catch (error) {
    console.error("admin-send-notification failed", error);
    return json({ error: error instanceof Error ? error.message : "internal_error" }, 500);
  }
});
