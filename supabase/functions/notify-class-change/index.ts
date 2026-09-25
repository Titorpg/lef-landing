// LEF — correo a los estudiantes cuando se cancela una clase ("Sin clase" en
// el calendario) o cuando se programa su reposición (Dashboard del profesor).
// Pedido del usuario (24 sep 2026): es un evento puntual e importante, así
// que se avisa formalmente, con el motivo y una disculpa de LEF.
//
// La llama el panel justo después de guardar el evento. Solo el autor del
// evento o un admin pueden pedir el envío, y cada evento se avisa UNA vez
// (calendar_events.notified_at).
//   sin_clase → a los estudiantes de cada grupo que tenía clase ese día (del
//               grupo elegido, o de todos los grupos si fue para estudiantes/todos).
//   reposicion → a los estudiantes del grupo, con la nueva fecha y hora.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor } from "../_shared/google-auth.ts";
import { classCancelledEmail, classMakeupEmail } from "../_shared/email-layout.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function addDays(ymd: string, n: number) { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function longDate(ymd: string) {
  return new Date(ymd + "T12:00:00Z").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
function joinEs(list: string[]) { return list.length < 2 ? (list[0] || "") : list.slice(0, -1).join(", ") + " y " + list[list.length - 1]; }
function time12(t: string | null | undefined) {
  if (!t) return "";
  const p = String(t).split(":"), hh = +p[0];
  return (hh % 12 || 12) + ":" + p[1] + (hh >= 12 ? " p. m." : " a. m.");
}

Deno.serve(async (req) => {
  const allowed = getAllowedOrigins();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req, allowed) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: "no_autenticado" }, 401);

  let eventId = "";
  try { const b = await req.json(); eventId = String(b?.event_id || ""); } catch { /* sin cuerpo */ }
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return json(req, { error: "evento_invalido" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !["admin", "teacher"].includes(profile.role)) return json(req, { error: "no_autorizado" }, 403);

  const { data: ev } = await admin.from("calendar_events")
    .select("id, title, details, category, audience, group_id, starts_on, ends_on, start_time, end_time, makeup_of, created_by, notified_at")
    .eq("id", eventId).maybeSingle();
  if (!ev) return json(req, { error: "evento_no_existe" }, 404);
  if (profile.role !== "admin" && ev.created_by !== auth.user.id) return json(req, { error: "no_autorizado" }, 403);
  if (!["sin_clase", "reposicion"].includes(ev.category)) return json(req, { sent: 0, skipped: "no_aplica" });
  if (ev.notified_at) return json(req, { sent: 0, skipped: "ya_avisado" });
  if (ev.category === "sin_clase" && !["group", "students", "all"].includes(ev.audience)) return json(req, { sent: 0, skipped: "sin_estudiantes" });

  // Grupos activos con su horario y ciclo.
  let gq = admin.from("groups")
    .select("id, modules(level, title), teachers(full_name), schedules(days, start_time, end_time, cycles(start_date, end_date))")
    .eq("active", true);
  if (ev.group_id) gq = gq.eq("id", ev.group_id);
  const { data: groups } = await gq;

  // Por grupo, los días de clase afectados (un solo correo por estudiante).
  // deno-lint-ignore no-explicit-any
  const pairs: { g: any; dates: string[] }[] = [];
  // deno-lint-ignore no-explicit-any
  (groups || []).forEach((g: any) => {
    const sch = g.schedules || {}, cyc = sch.cycles || {}, days: string[] = sch.days || [];
    const isClass = (d: string) => days.includes(DOW[new Date(d + "T12:00:00Z").getUTCDay()]) &&
      (!cyc.start_date || cyc.start_date <= d) && (!cyc.end_date || d <= cyc.end_date);
    if (ev.category === "reposicion") { if (ev.makeup_of) pairs.push({ g, dates: [ev.makeup_of] }); return; }
    const dates: string[] = [];
    for (let d = ev.starts_on; d <= ev.ends_on; d = addDays(d, 1)) if (isClass(d)) dates.push(d);
    if (dates.length) pairs.push({ g, dates });
  });

  const apiKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) return json(req, { error: "correo_no_configurado" }, 500);
  const portalUrl = (Deno.env.get("LEF_LOGIN_URL") || "https://www.lefcenter.com/login").replace(/\/login\/?$/, "") + "/portal";

  const emails: Record<string, unknown>[] = [];
  for (const { g, dates } of pairs) {
    const { data: enr } = await admin.from("enrollments").select("students(full_name, email)")
      .eq("group_id", g.id).in("status", ["PendingPayment", "Active"]);
    const seen = new Set<string>();
    // deno-lint-ignore no-explicit-any
    (enr || []).forEach((row: any) => {
      const st = row.students || {}, to = String(st.email || "").trim();
      if (!to || seen.has(to.toLowerCase())) return;
      seen.add(to.toLowerCase());
      const info = {
        name: String(st.full_name || "").split(/\s+/)[0] || "",
        module: `${g.modules?.level || ""} — ${g.modules?.title || ""}`,
        teacher: g.teachers?.full_name || "",
        classDate: joinEs(dates.map(longDate)),
        classTime: time12(g.schedules?.start_time),
      };
      const m = ev.category === "sin_clase"
        ? classCancelledEmail({ ...info, reason: ev.title, details: ev.details || "", plural: dates.length > 1 }, portalUrl)
        : classMakeupEmail({ ...info, makeupDate: longDate(ev.starts_on),
            makeupTime: `de ${time12(ev.start_time)}${ev.end_time ? ` a ${time12(ev.end_time)}` : ""}` }, portalUrl);
      emails.push({ from, to: [to], subject: m.subject, html: m.html, text: m.text });
    });
  }

  // Resend permite hasta 100 correos por llamada.
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < emails.length; i += 100) {
    try {
      const r = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(emails.slice(i, i + 100)),
      });
      if (r.ok) sent += emails.slice(i, i + 100).length;
      else errors.push(String((await r.json().catch(() => ({})))?.message ?? `HTTP ${r.status}`));
    } catch (e) { errors.push(String(e)); }
  }
  if (sent > 0 || emails.length === 0) {
    await admin.from("calendar_events").update({ notified_at: new Date().toISOString() }).eq("id", ev.id);
  }
  return json(req, { sent, total: emails.length, errors });
});
