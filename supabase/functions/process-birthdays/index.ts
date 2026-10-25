import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const secret = Deno.env.get("BIRTHDAY_WORKER_SECRET");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEYS");
const admin = createClient(url, serviceKey!);
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const copy: Record<string, { selfTitle: string; selfBody: (name: string) => string; friendTitle: string; friendBody: (name: string) => string }> = {
  fr: { selfTitle: "Joyeux anniversaire 🎂", selfBody: n => "Toute l’équipe Scrole te souhaite un merveilleux anniversaire, " + n + " !", friendTitle: "C’est son anniversaire 🎉", friendBody: n => "Souhaite un joyeux anniversaire à " + n + " !" },
  en: { selfTitle: "Happy birthday 🎂", selfBody: n => "The Scrole team wishes you a wonderful birthday, " + n + "!", friendTitle: "It's their birthday 🎉", friendBody: n => "Wish " + n + " a happy birthday!" },
  es: { selfTitle: "Feliz cumpleaños 🎂", selfBody: n => "¡El equipo de Scrole te desea un cumpleaños maravilloso, " + n + "!", friendTitle: "Hoy es su cumpleaños 🎉", friendBody: n => "¡Felicita a " + n + " por su cumpleaños!" },
  de: { selfTitle: "Alles Gute zum Geburtstag 🎂", selfBody: n => "Das Scrole-Team wünscht dir einen wundervollen Geburtstag, " + n + "!", friendTitle: "Geburtstag heute 🎉", friendBody: n => "Wünsche " + n + " alles Gute zum Geburtstag!" },
  it: { selfTitle: "Buon compleanno 🎂", selfBody: n => "Il team Scrole ti augura uno splendido compleanno, " + n + "!", friendTitle: "Oggi è il suo compleanno 🎉", friendBody: n => "Augura buon compleanno a " + n + "!" },
  pt: { selfTitle: "Feliz aniversário 🎂", selfBody: n => "A equipa Scrole deseja-te um aniversário maravilhoso, " + n + "!", friendTitle: "Hoje é o aniversário 🎉", friendBody: n => "Deseja feliz aniversário a " + n + "!" },
  zh: { selfTitle: "生日快乐 🎂", selfBody: n => "Scrole 团队祝你生日快乐，" + n + "！", friendTitle: "今天是他的生日 🎉", friendBody: n => "祝 " + n + " 生日快乐！" },
  ja: { selfTitle: "お誕生日おめでとう 🎂", selfBody: n => "Scroleチームより、素敵な誕生日をお祈りします、" + n + "！", friendTitle: "今日は誕生日です 🎉", friendBody: n => n + "に誕生日のお祝いを送りましょう！" },
  ru: { selfTitle: "С днём рождения 🎂", selfBody: n => "Команда Scrole желает тебе прекрасного дня рождения, " + n + "!", friendTitle: "Сегодня день рождения 🎉", friendBody: n => "Поздравь " + n + " с днём рождения!" },
};
function language(value: unknown) { const l = String(value ?? "fr").toLowerCase().split(/[-_]/)[0]; return copy[l] ? l : "fr"; }

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!secret || req.headers.get("x-birthday-worker-secret") !== secret) return json({ error: "unauthorized" }, 401);
  try {
    const now = new Date();
    const monthDay = now.toISOString().slice(5, 10);
    const year = now.getUTCFullYear();
    const { data: profiles, error } = await admin.from("user_profiles")
      .select("user_id,username,first_name,last_name,birth_date,account_status,deleted_at")
      .not("birth_date", "is", null).is("deleted_at", null).limit(10000);
    if (error) throw error;
    const todays = (profiles ?? []).filter((p: any) => String(p.birth_date).slice(5, 10) === monthDay && p.account_status !== "deleted");
    let selfCount = 0, socialCount = 0;
    for (const person of todays as any[]) {
      const name = String(person.first_name || person.username || "Scrole").trim();
      const { data: pref } = await admin.from("user_preferences").select("language").eq("user_id", person.user_id).maybeSingle();
      const lang = language(pref?.language);
      const text = copy[lang];
      const { data: already } = await admin.from("notifications").select("id").eq("user_id", person.user_id).eq("type", "birthday_self").contains("data", { birthday_year: year }).limit(1);
      if (!already?.length) {
        const { error: insertError } = await admin.from("notifications").insert({ user_id: person.user_id, type: "birthday_self", title: text.selfTitle, body: text.selfBody(name), data: { birthday_year: year, subject_user_id: person.user_id } });
        if (insertError) throw insertError;
        selfCount++;
      }
      const [{ data: follows, error: followError }, { data: friends, error: friendError }] = await Promise.all([
        admin.from("user_follows").select("follower_id").eq("followed_id", person.user_id),
        admin.from("friendships").select("user_a_id,user_b_id").or("user_a_id.eq." + person.user_id + ",user_b_id.eq." + person.user_id),
      ]);
      if (followError || friendError) throw followError ?? friendError;
      const audience = new Set<string>((follows ?? []).map((r: any) => String(r.follower_id)));
      for (const f of friends ?? []) audience.add(String(f.user_a_id) === String(person.user_id) ? String(f.user_b_id) : String(f.user_a_id));
      audience.delete(String(person.user_id));
      for (const recipientId of audience) {
        const { data: recipientPref } = await admin.from("user_preferences").select("language").eq("user_id", recipientId).maybeSingle();
        const recipientCopy = copy[language(recipientPref?.language)];
        const { data: prior } = await admin.from("notifications").select("id").eq("user_id", recipientId).eq("type", "birthday_friend").contains("data", { birthday_year: year, subject_user_id: person.user_id }).limit(1);
        if (prior?.length) continue;
        const { error: notifyError } = await admin.from("notifications").insert({ user_id: recipientId, type: "birthday_friend", title: recipientCopy.friendTitle, body: recipientCopy.friendBody(name), actor_id: person.user_id, data: { birthday_year: year, subject_user_id: person.user_id, target_user_id: person.user_id } });
        if (notifyError) throw notifyError;
        socialCount++;
      }
    }
    return json({ ok: true, date: monthDay, birthdays: todays.length, self_notifications: selfCount, friend_follower_notifications: socialCount });
  } catch (error) {
    console.error("process-birthdays failed", error);
    return json({ error: error instanceof Error ? error.message : "internal_error" }, 500);
  }
});
