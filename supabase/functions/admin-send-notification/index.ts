import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

function resolveServiceKey(): string | undefined {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 20);
    const serviceNamed = entries.find(([name]) => /service.?role|secret/i.test(name));
    if (serviceNamed) return serviceNamed[1];
    return entries.find(([, value]) => value.startsWith("sb_secret_"))?.[1]
      ?? entries.find(([, value]) => value.startsWith("eyJ"))?.[1];
  } catch {
    return undefined;
  }
}

const serviceKey = resolveServiceKey();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!url || !anonKey || !serviceKey) {
    console.error("admin-send-notification missing required server configuration");
    return json({ error: "server_configuration_error" }, 503);
  }

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await caller.auth.getUser();
    if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("administrateur_profil")
      .select("role,actif,auth_id").eq("auth_id", authData.user.id).eq("actif", true).maybeSingle();
    if (profileError) {
      console.error("admin profile lookup failed", profileError.message);
      return json({ error: "admin_authorization_failed" }, 500);
    }
    if (!profile || !["super_admin", "admin"].includes(String(profile.role).toLowerCase())) {
      return json({ error: "admin_permission_required" }, 403);
    }
    const { data: permissions, error: permissionsError } = await caller.rpc("admin_permissions_for_current_user");
    if (permissionsError) {
      console.error("admin permission lookup failed", permissionsError.message);
      return json({ error: "admin_authorization_failed" }, 500);
    }
    if (!(permissions ?? []).some((p: { permission?: string }) => p.permission === "settings.edit")) {
      return json({ error: "notification_management_permission_required" }, 403);
    }

    let input: Record<string, unknown>;
    try {
      const length = Number(req.headers.get("content-length") ?? 0);
      if (length > 32_000) return json({ error: "request_too_large" }, 413);
      const parsed = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_request_body" }, 400);
      input = parsed as Record<string, unknown>;
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const mode = input.mode;
    if (mode !== "user" && mode !== "segment") return json({ error: "invalid_mode" }, 400);
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const body = typeof input.body === "string" ? input.body.trim() : "";
    if (!title || title.length > 120 || !body || body.length > 1000) return json({ error: "invalid_title_or_body" }, 400);

    let recipients: string[] = [];
    if (mode === "user") {
      const id = typeof input.user_id === "string" ? input.user_id.trim() : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
        return json({ error: "invalid_user_id" }, 400);
      }
      const { data: user, error } = await admin.from("user_profiles").select("user_id")
        .eq("user_id", id).eq("account_status", "active").is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (user?.user_id) recipients = [user.user_id];
    } else {
      const filters = (input.filters && typeof input.filters === "object" && !Array.isArray(input.filters))
        ? input.filters as Record<string, unknown> : {};
      const country = typeof filters.country_id === "string" ? filters.country_id : "all";
      const gender = typeof filters.gender === "string" ? filters.gender : "all";
      const platform = typeof filters.platform === "string" ? filters.platform : "all";
      const language = typeof filters.language === "string" ? filters.language.toLowerCase().split(/[-_]/)[0] : "all";
      if (!["all", "homme", "femme", "male", "female", "other"].includes(gender)) return json({ error: "invalid_gender_filter" }, 400);
      if (gender === "other") return json({ error: "gender_filter_not_supported_by_schema", detail: "La base ne définit que les genres homme et femme." }, 422);
      if (!["all", "android", "ios", "web"].includes(platform)) return json({ error: "invalid_platform_filter" }, 400);
      if (!["all", "fr", "en", "es", "de", "it", "pt", "zh", "ja", "ru"].includes(language)) return json({ error: "invalid_language_filter" }, 400);
      if (country !== "all" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(country)) {
        return json({ error: "invalid_country_id" }, 400);
      }

      let query = admin.from("user_profiles").select("user_id").eq("account_status", "active").is("deleted_at", null);
      if (country !== "all") query = query.eq("country_id", country);
      if (gender !== "all") query = query.eq("gender", gender === "female" ? "femme" : gender === "male" ? "homme" : gender);
      const { data: profiles, error } = await query.limit(10000);
      if (error) throw error;
      let ids = (profiles ?? []).map((p: { user_id: string }) => String(p.user_id));

      if (platform !== "all") {
        const { data: devices, error: deviceError } = await admin.from("user_devices").select("user_id")
          .eq("platform", platform).eq("push_enabled", true).not("device_token", "is", null);
        if (deviceError) throw deviceError;
        const platformIds = new Set((devices ?? []).map((d: { user_id: string | null }) => String(d.user_id)));
        ids = ids.filter(id => platformIds.has(id));
      }
      if (language !== "all") {
        const { data: prefs, error: prefError } = await admin.from("user_preferences").select("user_id,language");
        if (prefError) throw prefError;
        const languageIds = new Set((prefs ?? []).filter((p: { user_id: string; language: string | null }) =>
          String(p.language ?? "fr").toLowerCase().split(/[-_]/)[0] === language).map((p: { user_id: string }) => String(p.user_id)));
        ids = ids.filter(id => languageIds.has(id));
      }
      recipients = [...new Set(ids)];
    }

    if (!recipients.length) return json({ ok: true, recipients: 0, inserted: 0 });
    let inserted = 0;
    for (let i = 0; i < recipients.length; i += 250) {
      const rows = recipients.slice(i, i + 250).map(user_id => ({
        user_id, type: "admin_broadcast", title, body, actor_id: null,
        data: { source: "scrole_admin", mode, sent_at: new Date().toISOString() },
      }));
      const { error } = await admin.from("notifications").insert(rows);
      if (error) throw error;
      inserted += rows.length;
    }
    return json({ ok: true, recipients: inserted, inserted });
  } catch (error) {
    console.error("admin-send-notification failed", error instanceof Error ? error.message : "unknown_error");
    return json({ error: "internal_error" }, 500);
  }
});
