import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return json({success:false,message:"Méthode non autorisée."},405);
 try{
  const service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return json({success:false,message:"Authentification requise."},401);
  const {data:{user},error:authError}=await service.auth.getUser(token);if(authError||!user)return json({success:false,message:"Session invalide."},401);
  const {data:admin,error:adminError}=await service.from("administrateur_profil").select("id,role,actif").eq("auth_id",user.id).maybeSingle();
  if(adminError)throw adminError;if(!admin||!admin.actif||!["admin","super_admin"].includes(String(admin.role)))return json({success:false,message:"Accès réservé aux administrateurs."},403);
  const {data:perm,error:permError}=await service.from("admin_role_permissions").select("enabled").eq("role",admin.role).eq("permission","events.view").maybeSingle();
  if(permError)throw permError;if(!perm?.enabled)return json({success:false,message:"Permission events.view requise."},403);
  const body=await req.json();const eventId=String(body.eventId??"").trim();if(!eventId)return json({success:false,message:"Identifiant événement requis."},400);
  const [ownershipResult,historyResult]=await Promise.all([service.from("admin_event_ownership").select("*").eq("event_id",eventId).maybeSingle(),service.from("admin_event_ownership_history").select("id,action,previous_owner_user_id,new_owner_user_id,proof_note,created_at").eq("event_id",eventId).order("created_at",{ascending:false})]);
  if(ownershipResult.error)throw ownershipResult.error;if(historyResult.error)throw historyResult.error;
  const ids=[...new Set([ownershipResult.data?.claimed_owner_user_id,...(historyResult.data??[]).flatMap((h:any)=>[h.previous_owner_user_id,h.new_owner_user_id])].filter(Boolean))];
  const {data:profiles,error:profileError}=ids.length?await service.from("user_profiles").select("user_id,username,first_name,last_name,photo_url").in("user_id",ids):{data:[],error:null};if(profileError)throw profileError;
  const map=new Map((profiles??[]).map((p:any)=>[p.user_id,p]));
  return json({success:true,ownership:ownershipResult.data?{...ownershipResult.data,claimed_owner:map.get(ownershipResult.data.claimed_owner_user_id)??null}:null,history:(historyResult.data??[]).map((h:any)=>({...h,previous_owner:map.get(h.previous_owner_user_id)??null,new_owner:map.get(h.new_owner_user_id)??null}))});
 }catch(error){console.error("admin-event-ownership-info",error);return json({success:false,message:error instanceof Error?error.message:"Impossible de charger la propriété."},500)}
});
