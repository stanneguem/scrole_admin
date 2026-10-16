import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, message: "Méthode non autorisée." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Configuration Supabase indisponible.");

    const service = createClient(url, serviceKey);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, message: "Authentification requise." }, 401);

    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) {
      return json({ success: false, message: "Session administrateur invalide." }, 401);
    }

    const { data: requester, error: requesterError } = await service
      .from("administrateur_profil")
      .select("id, role, actif")
      .eq("auth_id", authData.user.id)
      .eq("actif", true)
      .maybeSingle();

    if (requesterError) throw requesterError;
    if (!requester || !["super_admin", "admin", "moderateur"].includes(requester.role)) {
      return json({ success: false, message: "Accès refusé." }, 403);
    }

    const { data: communities, error: communitiesError } = await service
      .from("communities")
      .select("id, creator_id, name, slug, description, photo_profile, photo_cover, visibility, status, created_at, updated_at, scheduled_deletion_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (communitiesError) throw communitiesError;

    const rows = communities ?? [];
    const ids = rows.map((row: any) => row.id);
    const creatorIds = [...new Set(rows.map((row: any) => row.creator_id).filter(Boolean))];

    const [membersResult, postsResult, profilesResult] = await Promise.all([
      ids.length
        ? service.from("community_members").select("community_id, user_id").in("community_id", ids)
        : Promise.resolve({ data: [], error: null }),
      ids.length
        ? service.from("community_posts").select("community_id, status").in("community_id", ids)
        : Promise.resolve({ data: [], error: null }),
      creatorIds.length
        ? service.from("user_profiles").select("user_id, username, first_name, last_name, photo_url").in("user_id", creatorIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (membersResult.error) throw membersResult.error;
    if (postsResult.error) throw postsResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const memberCounts = new Map<string, number>();
    const uniqueMemberIds = new Set<string>();
    for (const row of membersResult.data ?? []) {
      memberCounts.set(row.community_id, (memberCounts.get(row.community_id) ?? 0) + 1);
      if (row.user_id) uniqueMemberIds.add(row.user_id);
    }

    const postCounts = new Map<string, number>();
    const pendingPostCounts = new Map<string, number>();
    for (const row of postsResult.data ?? []) {
      postCounts.set(row.community_id, (postCounts.get(row.community_id) ?? 0) + 1);
      if (row.status === "en_attente") {
        pendingPostCounts.set(row.community_id, (pendingPostCounts.get(row.community_id) ?? 0) + 1);
      }
    }

    const creatorById = new Map((profilesResult.data ?? []).map((profile: any) => [profile.user_id, profile]));
    const result = rows.map((community: any) => ({
      ...community,
      members_count: memberCounts.get(community.id) ?? 0,
      posts_count: postCounts.get(community.id) ?? 0,
      pending_posts_count: pendingPostCounts.get(community.id) ?? 0,
      creator: creatorById.get(community.creator_id) ?? null,
    }));

    return json({ success: true, communities: result, total: result.length, unique_community_members: uniqueMemberIds.size, community_memberships: (membersResult.data ?? []).length, community_posts: (postsResult.data ?? []).length, truncated: result.length === 500, requesterRole: requester.role });
  } catch (error) {
    console.error("admin-community-directory error", error);
    return json({
      success: false,
      message: error instanceof Error ? error.message : "Erreur interne.",
    }, 500);
  }
});
