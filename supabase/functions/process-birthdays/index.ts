import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL");
const secret=Deno.env.get("BIRTHDAY_WORKER_SECRET");
function serviceKey():string|undefined {
 const direct=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if(direct)return direct;
 const raw=Deno.env.get("SUPABASE_SECRET_KEYS"); if(!raw)return;
 try { const v:unknown=JSON.parse(raw); if(!v||typeof v!=="object"||Array.isArray(v))return;
 const entries=Object.entries(v as Record<string,unknown>).filter((e):e is [string,string]=>typeof e[1]==="string"&&e[1].length>20);
 return entries.find(([k])=>/service.?role|secret/i.test(k))?.[1]??entries.find(([,s])=>s.startsWith("sb_secret_"))?.[1]??entries.find(([,s])=>s.startsWith("eyJ"))?.[1];
 } catch{return;}
}
const key=serviceKey();
const json=(v:unknown,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
const copy:Record<string,{selfTitle:string;selfBody:(n:string)=>string;friendTitle:string;friendBody:(n:string)=>string}>={
fr:{selfTitle:"Joyeux anniversaire 🎂",selfBody:n=>"Toute l’équipe Scrole te souhaite un merveilleux anniversaire, "+n+" !",friendTitle:"C’est son anniversaire 🎉",friendBody:n=>"Souhaite un joyeux anniversaire à "+n+" !"},
en:{selfTitle:"Happy birthday 🎂",selfBody:n=>"The Scrole team wishes you a wonderful birthday, "+n+"!",friendTitle:"It's their birthday 🎉",friendBody:n=>"Wish "+n+" a happy birthday!"},
es:{selfTitle:"Feliz cumpleaños 🎂",selfBody:n=>"¡El equipo de Scrole te desea un cumpleaños maravilloso, "+n+"!",friendTitle:"Hoy es su cumpleaños 🎉",friendBody:n=>"¡Felicita a "+n+" por su cumpleaños!"},
de:{selfTitle:"Alles Gute zum Geburtstag 🎂",selfBody:n=>"Das Scrole-Team wünscht dir einen wundervollen Geburtstag, "+n+"!",friendTitle:"Geburtstag heute 🎉",friendBody:n=>"Wünsche "+n+" alles Gute zum Geburtstag!"},
it:{selfTitle:"Buon compleanno 🎂",selfBody:n=>"Il team Scrole ti augura uno splendido compleanno, "+n+"!",friendTitle:"Oggi è il suo compleanno 🎉",friendBody:n=>"Augura buon compleanno a "+n+"!"},
pt:{selfTitle:"Feliz aniversário 🎂",selfBody:n=>"A equipa Scrole deseja-te um aniversário maravilhoso, "+n+"!",friendTitle:"Hoje é o aniversário 🎉",friendBody:n=>"Deseja feliz aniversário a "+n+"!"},
zh:{selfTitle:"生日快乐 🎂",selfBody:n=>"Scrole 团队祝你生日快乐，"+n+"！",friendTitle:"今天是他的生日 🎉",friendBody:n=>"祝 "+n+" 生日快乐！"},
ja:{selfTitle:"お誕生日おめでとう 🎂",selfBody:n=>"Scroleチームより、素敵な誕生日をお祈りします、"+n+"！",friendTitle:"今日は誕生日です 🎉",friendBody:n=>n+"に誕生日のお祝いを送りましょう！"},
ru:{selfTitle:"С днём рождения 🎂",selfBody:n=>"Команда Scrole желает тебе прекрасного дня рождения, "+n+"!",friendTitle:"Сегодня день рождения 🎉",friendBody:n=>"Поздравь "+n+" с днём рождения!"}};
const lang=(v:unknown)=>{const l=String(v??"fr").toLowerCase().split(/[-_]/)[0];return copy[l]?l:"fr";};
Deno.serve(async(req:Request)=>{
 if(req.method!=="POST")return json({error:"method_not_allowed"},405);
 if(!secret||req.headers.get("x-birthday-worker-secret")!==secret)return json({error:"unauthorized"},401);
 if(!url||!key)return json({error:"server_configuration_error"},503);
 try{
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const now=new Date(), md=now.toISOString().slice(5,10), year=now.getUTCFullYear();
 const {data:profiles,error}=await db.from("user_profiles").select("user_id,username,first_name,last_name,birth_date").eq("account_status","active").is("deleted_at",null).not("birth_date","is",null).limit(10000);
 if(error)throw error;
 const people=(profiles??[]).filter((p:any)=>String(p.birth_date).slice(5,10)===md);
 let self=0,social=0,skipped=0,failed=0; const errors:string[]=[];
 for(const p of people){try{
 const name=String([p.first_name,p.last_name].filter(Boolean).join(" ").trim()||p.username||"Scrole").slice(0,100);
 const {data:pref,error:pe}=await db.from("user_preferences").select("language,notifications_enabled").eq("user_id",p.user_id).maybeSingle();if(pe)throw pe;
 if(pref?.notifications_enabled===false){skipped++;continue;}
 const c=copy[lang(pref?.language)];
 const {data:old,error:oe}=await db.from("notifications").select("id").eq("user_id",p.user_id).eq("type","birthday_self").contains("data",{birthday_year:year}).limit(1);if(oe)throw oe;
 if(!old?.length){const {error:e}=await db.from("notifications").insert({user_id:p.user_id,type:"birthday_self",title:c.selfTitle,body:c.selfBody(name),data:{birthday_year:year,subject_user_id:p.user_id}});if(e)throw e;self++;}
 const [{data:follows,error:fe},{data:friends,error:fre}]=await Promise.all([db.from("user_follows").select("follower_id").eq("followed_id",p.user_id),db.from("friendships").select("user_a_id,user_b_id").or("user_a_id.eq."+p.user_id+",user_b_id.eq."+p.user_id)]);
 if(fe||fre)throw fe??fre;
 const audience=new Set<string>((follows??[]).map((x:any)=>String(x.follower_id)));for(const f of friends??[])audience.add(String(f.user_a_id)===String(p.user_id)?String(f.user_b_id):String(f.user_a_id));audience.delete(String(p.user_id));
 const ids=[...audience];if(!ids.length)continue;
 const {data:activeUsers,error:ae}=await db.from("user_profiles").select("user_id").in("user_id",ids).eq("account_status","active").is("deleted_at",null);if(ae)throw ae;
 const valid=new Set((activeUsers??[]).map((x:any)=>String(x.user_id)));
 for(const rid of audience){if(!valid.has(rid))continue;try{
 const {data:rp,error:rpe}=await db.from("user_preferences").select("language,notifications_enabled").eq("user_id",rid).maybeSingle();if(rpe)throw rpe;
 if(rp?.notifications_enabled===false){skipped++;continue;}
 const rc=copy[lang(rp?.language)];
 const {data:prior,error:pre}=await db.from("notifications").select("id").eq("user_id",rid).eq("type","birthday_friend").contains("data",{birthday_year:year,subject_user_id:p.user_id}).limit(1);if(pre)throw pre;if(prior?.length)continue;
 const {error:ie}=await db.from("notifications").insert({user_id:rid,type:"birthday_friend",title:rc.friendTitle,body:rc.friendBody(name),actor_id:p.user_id,data:{birthday_year:year,subject_user_id:p.user_id,target_user_id:p.user_id}});if(ie)throw ie;social++;
 }catch(e){failed++;errors.push("recipient:"+rid+":"+(e instanceof Error?e.message:"unknown"));}}
 }catch(e){failed++;errors.push("birthday:"+String(p.user_id)+":"+(e instanceof Error?e.message:"unknown"));}}
 return json({ok:failed===0,date:md,timezone:"UTC",birthdays:people.length,self_notifications:self,friend_follower_notifications:social,skipped,failed,errors:errors.slice(0,20)},failed===0?200:207);
 }catch(e){console.error("process-birthdays failed",e instanceof Error?e.message:"unknown_error");return json({error:"internal_error"},500);}
});