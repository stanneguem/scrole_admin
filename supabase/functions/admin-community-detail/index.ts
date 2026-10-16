import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const out=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response("ok",{headers});if(req.method!=="POST")return out({success:false,message:"Méthode non autorisée."},405);try{
const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!key)throw new Error("Configuration Supabase indisponible.");
const db=createClient(url,key),token=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!token)return out({success:false,message:"Authentification requise."},401);
const {data:a,error:ae}=await db.auth.getUser(token);if(ae||!a.user)return out({success:false,message:"Session invalide."},401);
const {data:admin,error:de}=await db.from("administrateur_profil").select("id,role,actif").eq("auth_id",a.user.id).eq("actif",true).maybeSingle();if(de)throw de;if(!admin||!["super_admin","admin","moderateur"].includes(admin.role))return out({success:false,message:"Accès refusé."},403);
const b=await req.json().catch(()=>({})),cid=typeof b.community_id==="string"?b.community_id:"";if(!cid)return out({success:false,message:"Identifiant manquant."},400);
const {data:c,error:ce}=await db.from("communities").select("id,creator_id,name,slug,description,photo_profile,photo_cover,visibility,status,created_at,updated_at,scheduled_deletion_at,require_manual_approval").eq("id",cid).maybeSingle();if(ce)throw ce;
if(!c)return out({success:false,message:"Communauté introuvable."},404);
const action=typeof b.action==="string"?b.action:"";
if(action){
 const elevated=["super_admin","admin"].includes(admin.role);
 if(["remove_member","change_member_role","review_join_request"].includes(action)&&!elevated)return out({success:false,message:"Droits insuffisants."},403);
 if(["moderate_post","restore_post"].includes(action)){
  const pid=typeof b.post_id==="string"?b.post_id:"";
  const {data:p,error:e}=await db.from("community_posts").select("id").eq("id",pid).eq("community_id",cid).maybeSingle();if(e)throw e;if(!p)return out({success:false,message:"Publication introuvable."},404);
  if(action==="restore_post"){const {error:x}=await db.from("community_posts").update({status:"active",moderation_reason:null,deleted_at:null,deleted_by:null,purge_at:null}).eq("id",pid).eq("community_id",cid);if(x)throw x;return out({success:true,message:"Publication restaurée."});}
  const mode=b.mode==="delete"?"delete":"hide",reason=typeof b.reason==="string"?b.reason.trim().slice(0,500):"";
  const patch=mode==="delete"?{status:"deleted",moderation_reason:reason||"Suppression par la modération",deleted_at:new Date().toISOString(),deleted_by:auth.user.id}:{status:"spam_suspect",moderation_reason:reason||"Masquée par la modération"};
  const {error:x}=await db.from("community_posts").update(patch).eq("id",pid).eq("community_id",cid);if(x)throw x;return out({success:true,message:mode==="delete"?"Publication supprimée.":"Publication masquée."});
 }
 if(action==="remove_member"){
  const uid=typeof b.user_id==="string"?b.user_id:"";if(!uid)return out({success:false,message:"Membre manquant."},400);if(uid===c.creator_id)return out({success:false,message:"Le créateur ne peut pas être retiré."},400);
  const {data:m,error:e}=await db.from("community_members").select("role").eq("community_id",cid).eq("user_id",uid).maybeSingle();if(e)throw e;if(!m)return out({success:false,message:"Membre introuvable."},404);
  if(m.role==="admin"&&admin.role!=="super_admin")return out({success:false,message:"Seul un super administrateur peut retirer un administrateur."},403);
  const {error:x}=await db.from("community_members").delete().eq("community_id",cid).eq("user_id",uid);if(x)throw x;return out({success:true,message:"Membre retiré."});
 }
 if(action==="change_member_role"){
  const uid=typeof b.user_id==="string"?b.user_id:"",role=typeof b.role==="string"?b.role:"";if(!uid||!["admin","moderator","member"].includes(role))return out({success:false,message:"Membre ou rôle invalide."},400);
  if(uid===c.creator_id&&role!=="admin")return out({success:false,message:"Le créateur doit conserver le rôle administrateur."},400);
  const {data:m,error:e}=await db.from("community_members").select("role").eq("community_id",cid).eq("user_id",uid).maybeSingle();if(e)throw e;if(!m)return out({success:false,message:"Membre introuvable."},404);
  if(m.role==="admin"&&role!=="admin"&&admin.role!=="super_admin")return out({success:false,message:"Seul un super administrateur peut rétrograder un administrateur."},403);
  const {error:x}=await db.from("community_members").update({role}).eq("community_id",cid).eq("user_id",uid);if(x)throw x;return out({success:true,message:"Rôle mis à jour."});
 }
 if(action==="review_join_request"){
  const rid=typeof b.request_id==="string"?b.request_id:"",decision=b.decision==="acceptee"?"acceptee":b.decision==="refusee"?"refusee":"";if(!rid||!decision)return out({success:false,message:"Décision invalide."},400);
  const {data:r,error:e}=await db.from("community_join_requests").select("id,user_id,status").eq("id",rid).eq("community_id",cid).maybeSingle();if(e)throw e;if(!r||r.status!=="en_attente")return out({success:false,message:"Demande non disponible."},409);
  if(decision==="acceptee"){const {error:x}=await db.from("community_members").upsert({community_id:cid,user_id:r.user_id,role:"member"},{onConflict:"community_id,user_id"});if(x)throw x;}
  const {error:x}=await db.from("community_join_requests").update({status:decision,responded_at:new Date().toISOString()}).eq("id",rid).eq("community_id",cid);if(x)throw x;return out({success:true,message:decision==="acceptee"?"Demande acceptée.":"Demande refusée."});
 }
 if(action==="review_spam_flag"){
  const fid=typeof b.flag_id==="string"?b.flag_id:"",status=b.status==="confirme"?"confirme":b.status==="ignore"?"ignore":"";if(!fid||!status)return out({success:false,message:"Décision invalide."},400);
  const {error:x}=await db.from("community_spam_flags").update({status,handled_by:auth.user.id,handled_at:new Date().toISOString()}).eq("id",fid).eq("community_id",cid);if(x)throw x;return out({success:true,message:status==="confirme"?"Signalement confirmé.":"Signalement ignoré."});
 }
 return out({success:false,message:"Action inconnue."},400);

const [mr,pr,fr,jr,mc,pc]=await Promise.all([
db.from("community_members").select("community_id,user_id,role,joined_at").eq("community_id",cid).order("joined_at",{ascending:false}).limit(500),
db.from("community_posts").select("id,community_id,author_id,content,photo,photos,video_url,video_thumbnail_url,status,moderation_reason,created_at,updated_at,deleted_at").eq("community_id",cid).order("created_at",{ascending:false}).limit(100),
db.from("community_spam_flags").select("id,post_id,author_id,reasons,score,status,created_at,handled_at").eq("community_id",cid).order("created_at",{ascending:false}).limit(100),
db.from("community_join_requests").select("id,user_id,status,created_at,responded_at").eq("community_id",cid).order("created_at",{ascending:false}).limit(100),
db.from("community_members").select("user_id",{count:"exact",head:true}).eq("community_id",cid),
db.from("community_posts").select("id",{count:"exact",head:true}).eq("community_id",cid)]);
for(const x of [mr,pr,fr,jr,mc,pc])if(x.error)throw x.error;
const posts=pr.data??[],ids=[...new Set([c.creator_id,...(mr.data??[]).map((m:any)=>m.user_id),...posts.map((p:any)=>p.author_id),...(fr.data??[]).map((f:any)=>f.author_id),...(jr.data??[]).map((r:any)=>r.user_id)].filter(Boolean))],postIds=posts.map((p:any)=>p.id);
const [profiles,comments,reactions]=await Promise.all([
ids.length?db.from("user_profiles").select("user_id,username,first_name,last_name,photo_url,account_status").in("user_id",ids):Promise.resolve({data:[],error:null}),
postIds.length?db.from("community_post_comments").select("post_id").in("post_id",postIds):Promise.resolve({data:[],error:null}),
postIds.length?db.from("community_post_reactions").select("post_id").in("post_id",postIds):Promise.resolve({data:[],error:null})]);
if(profiles.error)throw profiles.error;if(comments.error)throw comments.error;if(reactions.error)throw reactions.error;
const pm=new Map((profiles.data??[]).map((p:any)=>[p.user_id,p])),cc=new Map<string,number>(),rc=new Map<string,number>();for(const x of comments.data??[])cc.set(x.post_id,(cc.get(x.post_id)??0)+1);for(const x of reactions.data??[])rc.set(x.post_id,(rc.get(x.post_id)??0)+1);
return out({success:true,community:{...c,creator:pm.get(c.creator_id)??null},stats:{members:mc.count??0,posts:pc.count??0,comments:comments.data?.length??0,reactions:reactions.data?.length??0,pending_posts:posts.filter((p:any)=>p.status==="en_attente").length,flagged_posts:(fr.data??[]).filter((f:any)=>f.status==="en_attente").length,pending_join_requests:(jr.data??[]).filter((r:any)=>r.status==="en_attente").length},members:(mr.data??[]).map((m:any)=>({...m,profile:pm.get(m.user_id)??null})),posts:posts.map((p:any)=>({...p,author:pm.get(p.author_id)??null,comments_count:cc.get(p.id)??0,reactions_count:rc.get(p.id)??0})),flags:(fr.data??[]).map((f:any)=>({...f,author:pm.get(f.author_id)??null})),join_requests:(jr.data??[]).map((r:any)=>({...r,profile:pm.get(r.user_id)??null})),truncated:{members:(mr.data??[]).length===500,posts:posts.length===100,flags:(fr.data??[]).length===100}});
}catch(e){console.error(e);return out({success:false,message:e instanceof Error?e.message:"Erreur interne."},500)}});