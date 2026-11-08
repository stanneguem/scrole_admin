import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ success: false, message: "Méthode non autorisée." }, 405);
  try {
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return json({ success: false, message: "Authentification requise." }, 401);
    const { data: authData, error: authError } = await service.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, message: "Session invalide." }, 401);
    const { data: admin, error: adminError } = await service.from("administrateur_profil").select("id, role, actif").eq("auth_id", authData.user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!admin || !admin.actif || !["admin", "super_admin"].includes(String(admin.role))) return json({ success: false, message: "Accès réservé aux administrateurs." }, 403);
    const { data: permission, error: permissionError } = await service.from("admin_role_permissions").select("enabled").eq("role", admin.role).eq("permission", "events.transfer_ownership").maybeSingle();
    if (permissionError) throw permissionError;
    if (!permission?.enabled) return json({ success: false, message: "Permission de transfert requise." }, 403);
    const body = await req.json(); const eventId = String(body.eventId ?? "").trim(); const userId = String(body.userId ?? "").trim(); const proofNote = String(body.proofNote ?? "").trim();
    if (!eventId || !userId || !proofNote) return json({ success: false, message: "Événement, utilisateur et preuve sont obligatoires." }, 400);
    const { error } = await service.rpc("admin_transfer_event_ownership", { p_event_id: eventId, p_new_owner_user_id: userId, p_admin_profile_id: admin.id, p_proof_note: proofNote });
    if (error) throw error;
    return json({ success: true });
  } catch (error) { console.error("admin-event-ownership-transfer", error); return json({ success: false, message: error instanceof Error ? error.message : "Transfert impossible." }, 400); }
});
