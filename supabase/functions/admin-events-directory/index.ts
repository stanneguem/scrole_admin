import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Méthode non autorisée." }, 405);
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, message: "Authentification requise." }, 401);

    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, message: "Session invalide." }, 401);

    const { data: requester, error: requesterError } = await service
      .from("administrateur_profil")
      .select("id, role, actif")
      .eq("auth_id", authData.user.id)
      .eq("actif", true)
      .maybeSingle();
    if (requesterError) throw requesterError;
    if (!requester || !["admin", "super_admin"].includes(String(requester.role))) {
      return json({ success: false, message: "Accès réservé aux administrateurs de la plateforme." }, 403);
    }

    const { data: permission, error: permissionError } = await service
      .from("admin_role_permissions")
      .select("permission")
      .eq("role", requester.role)
      .eq("permission", "events.view")
      .eq("enabled", true)
      .maybeSingle();
    if (permissionError) throw permissionError;
    if (!permission) return json({ success: false, message: "La permission events.view est requise." }, 403);

    const { data: events, error: eventsError } = await service
      .from("events")
      .select("id, creator_id, name, slug, description, photo, country_id, city_id, starts_at, ends_at, is_free, status, created_at, updated_at, scheduled_deletion_at, community_id, is_virtual, virtual_link, address, is_public, real_created_at, share_count")
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (eventsError) throw eventsError;

    const rows = events ?? [];
    const eventIds = rows.map((event: any) => event.id).filter(Boolean);
    const creatorIds = [...new Set(rows.map((event: any) => event.creator_id).filter(Boolean))];
    const cityIds = [...new Set(rows.map((event: any) => event.city_id).filter(Boolean))];
    const countryIds = [...new Set(rows.map((event: any) => event.country_id).filter(Boolean))];

    const [checkinsResult, profilesResult, citiesResult, countriesResult, communitiesResult, ownershipResult] = await Promise.all([
      eventIds.length ? service.from("event_checkins").select("event_id,status").in("event_id", eventIds) : Promise.resolve({ data: [], error: null }),
      creatorIds.length ? service.from("user_profiles").select("user_id,username,first_name,last_name,photo_url").in("user_id", creatorIds) : Promise.resolve({ data: [], error: null }),
      cityIds.length ? service.from("cities").select("id,nom").in("id", cityIds) : Promise.resolve({ data: [], error: null }),
      countryIds.length ? service.from("countries").select("id,nom,code_iso").in("id", countryIds) : Promise.resolve({ data: [], error: null }),
      [...new Set(rows.map((event: any) => event.community_id).filter(Boolean))].length
        ? service.from("communities").select("id,name").in("id", [...new Set(rows.map((event: any) => event.community_id).filter(Boolean))])
        : Promise.resolve({ data: [], error: null }),
      eventIds.length ? service.from("admin_event_ownership").select("event_id,ownership_type,ownership_status,ownership_note,claimed_owner_user_id").in("event_id", eventIds) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [checkinsResult, profilesResult, citiesResult, countriesResult, communitiesResult, ownershipResult] as any[]) {
      if (result.error) throw result.error;
    }

    const profileById = new Map((profilesResult.data ?? []).map((row: any) => [row.user_id, row]));
    const cityById = new Map((citiesResult.data ?? []).map((row: any) => [row.id, row]));
    const countryById = new Map((countriesResult.data ?? []).map((row: any) => [row.id, row]));
    const communityById = new Map((communitiesResult.data ?? []).map((row: any) => [row.id, row]));
    const ownershipByEventId = new Map((ownershipResult.data ?? []).map((row: any) => [row.event_id, row]));
    const checkinCounts = new Map<string, { total: number; present: number }>();
    for (const row of checkinsResult.data ?? []) {
      const counts = checkinCounts.get(row.event_id) ?? { total: 0, present: 0 };
      if (!["cancelled", "canceled", "invalidated", "rejected"].includes(String(row.status ?? "").toLowerCase())) counts.total++;
      if (["validated", "checked_in", "present", "confirmed", "accepte", "accepted"].includes(String(row.status ?? "").toLowerCase())) counts.present++;
      checkinCounts.set(row.event_id, counts);
    }

    const result = rows.map((event: any) => {
      const creator: any = profileById.get(event.creator_id);
      return {
        ...event,
        creator: creator ? {
          user_id: creator.user_id,
          username: creator.username,
          name: [creator.first_name, creator.last_name].filter(Boolean).join(" ") || creator.username || "Utilisateur",
          photo_url: creator.photo_url,
        } : null,
        city: cityById.get(event.city_id) ?? null,
        country: countryById.get(event.country_id) ?? null,
        community: communityById.get(event.community_id) ?? null,
        ownership: ownershipByEventId.get(event.id) ?? null,
        participant_count: checkinCounts.get(event.id)?.total ?? 0,
        checked_in_count: checkinCounts.get(event.id)?.present ?? 0,
      };
    });
    return json({ success: true, events: result, total: result.length, requesterRole: requester.role });
  } catch (error) {
    return json({ success: false, message: error instanceof Error ? error.message : "Erreur interne." }, 500);
  }
});
