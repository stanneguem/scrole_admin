import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    const { data: admin, error: adminError } = await service.from("administrateur_profil")
      .select("id,role,actif").eq("auth_id", authData.user.id).eq("actif", true).maybeSingle();
    if (adminError) throw adminError;
    if (!admin || !["admin", "super_admin"].includes(String(admin.role))) {
      return json({ success: false, message: "Accès réservé aux administrateurs." }, 403);
    }
    const { data: permission, error: permissionError } = await service.from("admin_role_permissions")
      .select("enabled").eq("role", admin.role).eq("permission", "events.transfer_ownership").maybeSingle();
    if (permissionError) throw permissionError;
    if (!permission?.enabled) return json({ success: false, message: "Permission de transfert requise." }, 403);
    const body = await req.json();
    const q = String(body.query ?? "").trim().replace(/[,%_()]/g, " ").replace(/\s+/g, " ");
    // À l’ouverture, proposer directement quelques comptes actifs. La recherche filtre ensuite l’ensemble des membres.
    const initialLoad = q.length < 2;
    const { data: users, error } = await service.from("user_profiles")
      .select("user_id,username,first_name,last_name,photo_url")
      .is("deleted_at", null).eq("account_status", "active")
      .or(`username.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
      .order(initialLoad ? "created_at" : "first_name", { ascending: !initialLoad }).limit(initialLoad ? 12 : 30);
    if (error) throw error;
    return json({ success: true, users: users ?? [] });
  } catch (error) {
    console.error("admin-event-owner-search", error);
    return json({ success: false, message: error instanceof Error ? error.message : "Recherche impossible." }, 500);
  }
});
