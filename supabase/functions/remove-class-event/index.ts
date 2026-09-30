// LEF — borrar un "Sin clase" (normal o que pausa el ciclo) o una reposición, y
// avisar a los estudiantes con una disculpa (pedido del usuario, 29 sep 2026).
//
// La llama el calendario al tocar "Eliminar" en esos eventos. Solo el autor del
// evento o un admin. Se borra con la llave de servicio; la base borra sola las
// reposiciones que quedan huérfanas (trigger calendar_events_drop_orphan_makeups).
//   sin_clase  → "tu clase del … sí se realizará" (+ reposiciones que se cancelan;
//                si era una pausa, las clases de esos días vuelven a dictarse).
//   reposicion → "la reposición del … ya no se realizará" (la clase vuelve a
//                quedar por reprogramar en el Dashboard del profesor).
// Solo se avisa lo que se había avisado (notified_at) y solo fechas de hoy en adelante.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor } from "../_shared/google-auth.ts";
import { classMakeupCancelledEmail, classRestoredEmail } from "../_shared/email-layout.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" });
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

type Ev = { id: string; title: string; category: string; audience: string; group_id: string | null; starts_on: string;
  ends_on: string; start_time: string | null; end_time: string | null; makeup_of: string | null; created_by: string;
  notified_at: string | null; pauses_cycle?: boolean };

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

  const { data: evRow } = await admin.from("calendar_events").select("*").eq("id", eventId).maybeSingle();
  if (!evRow) return json(req, { error: "evento_no_existe" }, 404);
  const ev = evRow as Ev;
  if (profile.role !== "admin" && ev.created_by !== auth.user.id) return json(req, { error: "no_autorizado" }, 403);
  if (!["sin_clase", "reposicion"].includes(ev.category)) return json(req, { error: "no_aplica" }, 400);

  const today = dateFmt.format(new Date());
  const portal = (Deno.env.get("LEF_LOGIN_URL") || "https://www.lefcenter.com/login").replace(/\/login\/?$/, "") + "/portal";
  const announce = !!ev.notified_at && ["group", "students", "all"].includes(ev.audience);

  // Grupos afectados (activos), con horario, ciclo, módulo y profesor.
  let gq = admin.from("groups")
    .select("id, modules(level, title), teachers(full_name), schedules(days, start_time, end_time, cycles(start_date, end_date))")
    .eq("active", true);
  if (ev.group_id) gq = gq.eq("id", ev.group_id);
  // deno-lint-ignore no-explicit-any
  const groups = ((await gq).data || []) as any[];

  // Reposiciones que podrían caer con el "Sin clase" (para contarlas en el correo).
  // deno-lint-ignore no-explicit-any
  let candidates: any[] = [];
  if (ev.category === "sin_clase" && groups.length) {
    const { data } = await admin.from("calendar_events").select("id, group_id, starts_on, start_time, end_time")
      .eq("category", "reposicion").gte("makeup_of", ev.starts_on).lte("makeup_of", ev.ends_on)
      .in("group_id", groups.map((g) => g.id));
    candidates = data || [];
  }

  const { error: delErr } = await admin.from("calendar_events").delete().eq("id", ev.id);
  if (delErr) return json(req, { error: "no_se_pudo_borrar", detail: delErr.message }, 500);

  // Lo que se avisa a cada estudiante: [correo del grupo g].
  const perGroup: { g: Record<string, unknown>; build: (info: Record<string, string>) => { subject: string; html: string; text: string } }[] = [];
  let removedMakeups = 0;

  if (ev.category === "reposicion") {
    const g = groups[0];
    if (announce && g && ev.starts_on >= today && ev.makeup_of) {
      perGroup.push({ g, build: (info) => classMakeupCancelledEmail({ ...info, classDate: longDate(ev.makeup_of!),
        makeupDate: longDate(ev.starts_on), makeupTime: `de ${time12(ev.start_time)}${ev.end_time ? ` a ${time12(ev.end_time)}` : ""}` } as never, portal) });
    }
  } else {
    // Tras borrar: ¿qué reposiciones desaparecieron? (las borró la base)
    const stillIds = new Set<string>();
    if (candidates.length) {
      const { data } = await admin.from("calendar_events").select("id").in("id", candidates.map((c) => c.id));
      (data || []).forEach((x: { id: string }) => stillIds.add(x.id));
    }
    const gone = candidates.filter((c) => !stillIds.has(c.id));
    removedMakeups = gone.length;

    // Días que vuelven a tener clase: de hoy en adelante, sin festivo ni otro "Sin clase".
    const from = ev.starts_on > today ? ev.starts_on : today;
    const { data: holRows } = from <= ev.ends_on ? await admin.rpc("lef_holidays", { p_from: from, p_to: ev.ends_on }) : { data: [] };
    const hol = new Set(((holRows || []) as { day: string }[]).map((x) => x.day));
    const { data: others } = await admin.from("calendar_events").select("audience, group_id, starts_on, ends_on")
      .eq("category", "sin_clase").lte("starts_on", ev.ends_on).gte("ends_on", from);
    for (const g of groups) {
      const sch = g.schedules || {}, cyc = sch.cycles || {}, days: string[] = sch.days || [];
      let end: string | null = cyc.end_date || null;
      const { data: ge } = await admin.rpc("lef_group_end", { p_group: g.id });
      if (ge) end = String(ge);
      const off = (d: string) => hol.has(d) || ((others || []) as { audience: string; group_id: string | null; starts_on: string; ends_on: string }[])
        .some((x) => x.starts_on <= d && d <= x.ends_on && (x.audience === "students" || x.audience === "all" || x.group_id === g.id));
      const dates: string[] = [];
      for (let d = from; d <= ev.ends_on; d = addDays(d, 1)) {
        if (days.includes(DOW[new Date(d + "T12:00:00Z").getUTCDay()]) && (!cyc.start_date || cyc.start_date <= d)
            && (!end || d <= end) && !off(d)) dates.push(d);
      }
      const dropped = gone.filter((c) => c.group_id === g.id && c.starts_on >= today)
        .map((c) => `${longDate(c.starts_on)} de ${time12(c.start_time)}${c.end_time ? ` a ${time12(c.end_time)}` : ""}`);
      if (!announce || !dates.length) continue;
      perGroup.push({ g, build: (info) => classRestoredEmail({ ...info, classDate: joinEs(dates.map(longDate)), plural: dates.length > 1,
        pause: !!ev.pauses_cycle, droppedMakeups: dropped } as never, portal) });
    }
  }

  const apiKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM");
  if (!perGroup.length) return json(req, { deleted: true, sent: 0, removed_makeups: removedMakeups });
  if (!apiKey || !from) return json(req, { deleted: true, sent: 0, removed_makeups: removedMakeups, error: "correo_no_configurado" });

  const emails: Record<string, unknown>[] = [];
  for (const { g, build } of perGroup) {
    const { data: enr } = await admin.from("enrollments").select("students(full_name, email)")
      .eq("group_id", g.id as string).in("status", ["PendingPayment", "Active"]);
    const seen = new Set<string>();
    // deno-lint-ignore no-explicit-any
    (enr || []).forEach((row: any) => {
      const st = row.students || {}, to = String(st.email || "").trim();
      if (!to || seen.has(to.toLowerCase())) return;
      seen.add(to.toLowerCase());
      // deno-lint-ignore no-explicit-any
      const gg = g as any;
      const m = build({
        name: String(st.full_name || "").split(/\s+/)[0] || "",
        module: `${gg.modules?.level || ""} — ${gg.modules?.title || ""}`,
        teacher: gg.teachers?.full_name || "",
        classDate: "",
        classTime: time12(gg.schedules?.start_time),
      });
      emails.push({ from, to: [to], subject: m.subject, html: m.html, text: m.text });
    });
  }

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
  return json(req, { deleted: true, sent, total: emails.length, errors, removed_makeups: removedMakeups });
});
