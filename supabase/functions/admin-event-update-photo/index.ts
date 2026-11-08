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
  const body=await req.json();const eventId=String(body.eventId??"").trim();const photo=String(body.photo??"").trim();
  if(!eventId||!/^https:\/\//i.test(photo))return json({success:false,message:"Photo ou événement invalide."},400);
  const {data:event,error:eventError}=await service.from("events").select("creator_id").eq("id",eventId).maybeSingle();
  if(eventError)throw eventError;if(!event||event.creator_id!==user.id)return json({success:false,message:"Événement inaccessible."},403);
  const {error:updateError}=await service.from("events").update({photo,updated_at:new Date().toISOString()}).eq("id",eventId);
  if(updateError)throw updateError;return json({success:true});
 }catch(error){console.error("admin-event-update-photo",error);return json({success:false,message:error instanceof Error?error.message:"Mise à jour photo impossible."},400)}
});