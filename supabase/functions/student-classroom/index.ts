// LEF — "Mi clase" del estudiante (portal → Mi curso → Clase de hoy).
//
// Pedido del usuario (24 sep 2026). En Classroom las agendas de cada módulo
// ("… MODULE 4 DAY 12 …") se reutilizan con cada grupo nuevo. LEF decide qué
// agenda ve cada estudiante y cuándo, sin importar si en Classroom está
// publicada, en borrador o programada (pedido del usuario, 6 oct 2026):
//   * La clase n.º N de su grupo (contando desde el inicio del ciclo SOLO los
//     días de su horario) le toca la agenda "DAY N". Un día "Sin clase" igual
//     consume su número (el ciclo no se detiene); esa agenda se ve el día y la
//     hora de su reposición (evento "reposicion" del calendario).
//   * La agenda y el enlace de Meet se abren 10 minutos antes de la hora de la
//     clase. El Meet se cierra a la hora de fin; la agenda sigue abierta el
//     resto del día (por si la clase se alarga) y a medianoche pasa a
//     "Agendas anteriores" (pedido del usuario, 25 sep 2026). Antes de abrir,
//     el servidor NO entrega ni la agenda ni el Meet.
//   * "Agendas anteriores" = las de clases de días anteriores.
//
// Cómo encuentra la clase, sin que el admin configure nada:
//   estudiante → su inscripción vigente con grupo → profesor + módulo (A2.1)
//   → clase del profesor en Classroom cuyo nombre lleva SU nombre y el nivel
//     ("LEVEL A2 - LUIS CABALLERO") → tema del módulo ("MODULE 4"/"A2.1").
// Se lee con la conexión de Google del PROFESOR (publicado y borrador). Requiere
// la inscripción pagada. El Meet es el de la clase de Classroom, que el
// profesor pega en el Planificador (classroom_meet_links).
//
// action "info"  → clase, código para unirse y si el estudiante ya está en ella.
// action "today" → además, el estado de hoy, la agenda (si está abierta) y las anteriores.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor, accessTokenForTeacher } from "../_shared/google-auth.ts";
import { attachEmbeds, classroomGet, classroomList, norm, shapeAttachment, teacherMatchName } from "../_shared/classroom.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

const TZ = "America/Bogota";
const OPEN_EARLY_MIN = 10; // agenda y Meet se abren 10 minutos antes de la clase
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hmFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

function toMin(t: string | null | undefined) { if (!t) return 0; const p = String(t).split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
function hm(min: number) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }
function addDays(ymd: string, n: number) { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function weekday(ymd: string) { return DOW[new Date(ymd + "T12:00:00Z").getUTCDay()]; }
// Número de clase: días del horario desde el inicio del ciclo hasta esa fecha
// (inclusive), sin contar los días en que el ciclo del grupo está en pausa.
function sessionNumber(days: string[], start: string | null, ymd: string, paused: (ymd: string) => boolean) {
  if (!start || ymd < start) return 0;
  let n = 0;
  for (let d = start; d <= ymd; d = addDays(d, 1)) if (days.includes(weekday(d)) && !paused(d)) n++;
  return n;
}
function dayNum(t: string) { const m = /\b(?:DAY|D[IÍ]A)\s*(\d+)/i.exec(t || ""); return m ? +m[1] : null; }
// Nombre de tema o título → código de módulo de LEF (misma regla que el Planificador).
// REGLA FIJA (pedido del usuario, 6-7 oct 2026), en este orden:
//   1. Por número: "C1.2" escrito tal cual, o "MODULE 14" / "MODULE 2" → C1.2.
//   2. Si no trae número (error u omisión del profesor), por el NOMBRE del
//      módulo que tiene en el panel (Académico): "MODULE CERTIFIED" → C1.2, o
//      un tema que se llame solo "CERTIFIED". Solo entre los módulos del nivel
//      de la clase. Luego el día sale de "DAY n".
const normWords = (s: string) => " " + String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim() + " ";
function moduleCode(text: string, levelCode: string, byNumber: Record<number, string>, titles: Record<string, string> = {}) {
  const cm = /\b([ABC][12]\.[1-3])\b/i.exec(text || "");
  if (cm) return cm[1].toUpperCase();
  const nm = /\bMODUL[OE]\s*(\d+)/i.exec(text || "");
  if (!nm) {
    const t = normWords(text);
    const hit = Object.keys(titles).find((lv) => lv.indexOf(levelCode) === 0 && titles[lv] &&
      (t.includes(" MODULE" + normWords(titles[lv])) || t.includes(" MODULO" + normWords(titles[lv])) || t === normWords(titles[lv])));
    return hit || null;
  }
  const n = +nm[1], byNum = byNumber[n];
  if (byNum && byNum.indexOf(levelCode) === 0) return byNum;
  if (n >= 1 && n <= 3) return levelCode + "." + n; // numeración local dentro del nivel
  return byNum || null;
}

type Ev = { id: string; title: string; details: string; category: string; audience: string; group_id: string | null;
  starts_on: string; ends_on: string; start_time: string | null; end_time: string | null; makeup_of: string | null };

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

  let action = "info";
  try { const b = await req.json(); if (b && b.action === "today") action = "today"; } catch { /* sin cuerpo */ }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles")
    .select("role, student_id, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || profile.role !== "student" || !profile.student_id) {
    return json(req, { error: "requiere_estudiante" }, 403);
  }

  const { data: enr } = await admin.from("enrollments")
    .select("id, status, created_at, students(full_name, email), modules(level, title, module_number), groups(id, teacher_id, teachers(full_name), schedules(days, start_time, end_time, cycles(start_date, end_date)))")
    .eq("student_id", profile.student_id).in("status", ["PendingPayment", "Active"])
    .not("group_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!enr || !enr.groups) return json(req, { status: "sin_grupo" });

  // deno-lint-ignore no-explicit-any
  const e = enr as any;
  const mod = e.modules, grp = e.groups, sch = grp.schedules || {}, cyc = sch.cycles || {};
  const days: string[] = sch.days || [];
  const now = new Date();
  const today = dateFmt.format(now);
  const nowMin = toMin(hmFmt.format(now));
  const startMin = toMin(sch.start_time), endMin = sch.end_time ? toMin(sch.end_time) : startMin + 60;
  // Pausas del ciclo de ESTE grupo (29 sep 2026): esos días no consumen agenda.
  // El fin del grupo es el del ciclo (el admin deja días de sobra; 30 sep 2026).
  const { data: pauseRows } = await admin.from("calendar_events")
    .select("title, details, starts_on, ends_on").eq("pauses_cycle", true).eq("group_id", grp.id);
  const pauses = (pauseRows || []) as { title: string; details: string; starts_on: string; ends_on: string }[];
  const pauseOf = (ymd: string) => pauses.find((x) => x.starts_on <= ymd && ymd <= x.ends_on) || null;
  const isPaused = (ymd: string) => !!pauseOf(ymd);
  const groupEnd: string | null = cyc.end_date || null;
  const inCycle = (ymd: string) => (!cyc.start_date || cyc.start_date <= ymd) && (!groupEnd || ymd <= groupEnd);
  const isClassDate = (ymd: string) => days.includes(weekday(ymd)) && inCycle(ymd);

  const group = {
    module_level: mod.level, module_title: mod.title, days, start_time: sch.start_time, end_time: sch.end_time,
    teacher: grp.teachers?.full_name || "", cycle_start: cyc.start_date || null, cycle_end: groupEnd,
  };
  // Festivos de Colombia (fijos, lef_holidays): esa clase no se dicta y queda
  // por reprogramar, igual que un día "Sin clase" (pedido del usuario, 26 sep 2026).
  const holFrom = cyc.start_date && cyc.start_date < today ? cyc.start_date : today;
  const { data: holRows } = await admin.rpc("lef_holidays", { p_from: holFrom, p_to: addDays(today, 60) });
  const holidays = new Map<string, { name: string; blurb: string }>();
  ((holRows || []) as { day: string; name: string; blurb: string }[]).forEach((x) => holidays.set(x.day, { name: x.name, blurb: x.blurb }));
  let nextClass: string | null = null;
  for (let i = 1; i <= 60; i++) {
    const d = addDays(today, i);
    if (groupEnd && d > groupEnd) break;
    if (isClassDate(d) && !holidays.has(d) && !isPaused(d)) { nextClass = d; break; }
  }
  const beforeCycle = !!cyc.start_date && today < cyc.start_date;
  const base = { group, today, now: hm(nowMin), next_class: nextClass, before_cycle: beforeCycle };

  const { data: paid } = await admin.rpc("lef_enrollment_paid", { p_enrollment_id: e.id });
  if (!paid) return json(req, { ...base, status: "sin_pago" });

  const tok = await accessTokenForTeacher(admin, grp.teacher_id);
  if (!tok.ok) return json(req, { ...base, status: "profesor_sin_conexion" });

  try {
    const levelCode = String(mod.level).slice(0, 2).toUpperCase();
    const needle = norm(await teacherMatchName(grp.teacher_id));
    const levelRe = new RegExp(`\\b${levelCode}\\b`);
    const coursesRes = await classroomGet(tok.accessToken, "courses?teacherId=me&courseStates=ACTIVE&pageSize=100");
    const course = ((coursesRes.courses || []) as Record<string, unknown>[])
      .filter((c) => needle && norm(String(c.name || "")).includes(needle) && levelRe.test(norm(String(c.name || ""))))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))[0];
    if (!course) return json(req, { ...base, status: "sin_clase_classroom" });

    const code = (course.enrollmentCode as string) || null;
    const link = String(course.alternateLink || "https://classroom.google.com/");
    const courseOut = {
      name: course.name, enrollment_code: code, link,
      join_url: code ? `${link}${link.includes("?") ? "&" : "?"}cjc=${encodeURIComponent(code)}` : link,
    };

    if (action !== "today") {
      // ¿Ya está en la clase? Se busca en la lista de alumnos por correo o por
      // nombre. Si el profesor no ha dado ese permiso (hay que reconectar),
      // queda "no se sabe" y el portal sigue mostrando el botón.
      let joined: boolean | null = null;
      try {
        const roster = await classroomList(tok.accessToken, `courses/${course.id}/students?pageSize=100`, "students");
        const myEmail = String(e.students?.email || "").trim().toLowerCase();
        const myName = norm(String(e.students?.full_name || ""));
        joined = roster.some((s) => {
          const p = (s.profile || {}) as Record<string, unknown>;
          const em = String(p.emailAddress || "").trim().toLowerCase();
          const nm = norm(String(((p.name || {}) as Record<string, unknown>).fullName || ""));
          return (!!myEmail && em === myEmail) || (!!myName && nm === myName);
        });
      } catch { joined = null; }
      return json(req, { ...base, status: "ok", course: courseOut, joined });
    }

    // --- Hoy: clase normal, cancelada o reposición ---
    const { data: evRows } = await admin.from("calendar_events")
      .select("id, title, details, category, audience, group_id, starts_on, ends_on, start_time, end_time, makeup_of")
      .in("category", ["sin_clase", "reposicion"])
      .gte("ends_on", cyc.start_date || addDays(today, -90));
    const evs = ((evRows || []) as Ev[]).filter((x) =>
      x.category === "reposicion" ? x.group_id === grp.id
        : (x.audience === "students" || x.audience === "all" || (x.audience === "group" && x.group_id === grp.id)));
    const cancelOf = (ymd: string): { title: string; details: string; holiday?: boolean; paused?: boolean } | null => {
      const pz = pauseOf(ymd);
      if (pz) return { title: pz.title, details: pz.details || "", paused: true };
      const hol = holidays.get(ymd);
      if (hol) return { title: "Día festivo: " + hol.name, details: hol.blurb, holiday: true };
      return evs.find((x) => x.category === "sin_clase" && x.starts_on <= ymd && ymd <= x.ends_on) || null;
    };

    type Slot = { kind: "clase" | "reposicion"; day: number; start: number; end: number };
    const slots: Slot[] = [];
    let cancel: { reason: string; details: string; holiday: boolean; paused: boolean; pause_until: string | null } | null = null;
    if (isClassDate(today)) {
      const c = cancelOf(today);
      if (c) cancel = { reason: c.title, details: c.details || "", holiday: !!c.holiday, paused: !!c.paused,
        pause_until: c.paused ? pauseOf(today)!.ends_on : null };
      else slots.push({ kind: "clase", day: sessionNumber(days, cyc.start_date, today, isPaused), start: startMin, end: endMin });
    }
    evs.filter((x) => x.category === "reposicion" && x.starts_on === today && x.makeup_of).forEach((x) => {
      const s = toMin(x.start_time);
      slots.push({ kind: "reposicion", day: sessionNumber(days, cyc.start_date, x.makeup_of!, isPaused), start: s, end: x.end_time ? toMin(x.end_time) : s + 60 });
    });
    slots.sort((a, b) => a.start - b.start);
    // antes → (10 min antes) en_curso: agenda + Meet → (hora de fin) terminada: solo agenda, hasta medianoche.
    const phaseOf = (s: Slot) => nowMin < s.start - OPEN_EARLY_MIN ? "antes" : nowMin < s.end ? "en_curso" : "terminada";

    // Anteriores: clases de días anteriores (no canceladas) y reposiciones ya hechas.
    // Las de hoy siguen en "Clase de hoy" hasta medianoche.
    const prevDays = new Map<number, string>(); // DAY → fecha en que se vio
    if (cyc.start_date) {
      for (let d = cyc.start_date; d < today; d = addDays(d, 1)) {
        if (isClassDate(d) && !cancelOf(d)) prevDays.set(sessionNumber(days, cyc.start_date, d, isPaused), d);
      }
    }
    evs.filter((x) => x.category === "reposicion" && x.makeup_of && x.starts_on < today)
      .forEach((x) => prevDays.set(sessionNumber(days, cyc.start_date, x.makeup_of!, isPaused), x.starts_on));

    // Agendas del módulo en Classroom (solo si hay algo que mostrar).
    const needAgendas = prevDays.size > 0 || slots.some((s) => phaseOf(s) !== "antes");
    // deno-lint-ignore no-explicit-any
    let byDay = new Map<number, any[]>();
    let maxDay = 0;
    if (needAgendas) {
      const { data: modsAll } = await admin.from("modules").select("level, module_number, title");
      const byNumber: Record<number, string> = {}, titles: Record<string, string> = {};
      (modsAll || []).forEach((m: { level: string; module_number: number; title: string }) => {
        byNumber[m.module_number] = m.level; titles[m.level] = m.title;
      });
      let topics: Record<string, unknown>[] = [];
      try { topics = await classroomList(tok.accessToken, `courses/${course.id}/topics?pageSize=200`, "topic"); } catch { /* sin temas */ }
      const topicMod: Record<string, string | null> = {};
      topics.forEach((t) => { topicMod[String(t.topicId)] = moduleCode(String(t.name || ""), levelCode, byNumber, titles); });
      let mats: Record<string, unknown>[] = [];
      try {
        mats = await classroomList(tok.accessToken,
          `courses/${course.id}/courseWorkMaterials?pageSize=200&courseWorkMaterialStates=PUBLISHED&courseWorkMaterialStates=DRAFT`,
          "courseWorkMaterial");
      } catch { /* sin materiales */ }
      byDay = new Map();
      // Publicadas, en borrador o programadas (una programada es un borrador con
      // fecha): manda el horario de LEF, igual que en el Planificador.
      mats.filter((m) => m.state === "PUBLISHED" || m.state === "DRAFT").forEach((m) => {
        const mk = (m.topicId && topicMod[String(m.topicId)]) || moduleCode(String(m.title || ""), levelCode, byNumber, titles);
        const n = dayNum(String(m.title || ""));
        if (mk !== mod.level || n === null) return;
        maxDay = Math.max(maxDay, n);
        const list = byDay.get(n) || [];
        list.push({ id: m.id, title: m.title, description: m.description || null, alternateLink: m.alternateLink, day: n,
          attachments: ((m.materials as Record<string, unknown>[]) || []).map(shapeAttachment) });
        byDay.set(n, list);
      });
    }

    let meetUrl: string | null = null;
    if (slots.some((s) => phaseOf(s) === "en_curso")) {
      const { data: ml } = await admin.from("classroom_meet_links").select("meet_url").eq("course_id", String(course.id)).maybeSingle();
      meetUrl = (ml as { meet_url?: string } | null)?.meet_url || null;
    }

    const slotsOut = slots.map((s) => {
      const phase = phaseOf(s);
      const open = phase !== "antes";
      return {
        kind: s.kind, day: s.day, start: hm(s.start), end: hm(s.end), opens_at: hm(Math.max(0, s.start - OPEN_EARLY_MIN)), phase,
        agenda: open ? (byDay.get(s.day) || []) : [],
        meet_url: phase === "en_curso" ? meetUrl : null,
        meet_missing: phase === "en_curso" && !meetUrl,
      };
    });
    const previous = [...prevDays.entries()].sort((a, b) => b[0] - a[0])
      .map(([n, seen]) => ({ day: n, seen_on: seen, agendas: byDay.get(n) || [] }))
      .filter((p) => p.agendas.length);
    await attachEmbeds([...slotsOut.flatMap((s) => s.agenda), ...previous.flatMap((p) => p.agendas)]);

    // Próximo cambio de estado (para que el portal se actualice solo).
    const changes = slots.flatMap((s) => [s.start - OPEN_EARLY_MIN, s.start, s.end]).filter((m) => m > nowMin);
    if (!changes.length && slots.length) changes.push(24 * 60); // a medianoche la agenda pasa a anteriores
    const refreshIn = changes.length ? (Math.min(...changes) - nowMin) * 60 : null;

    return json(req, {
      ...base, status: "ok", course: courseOut, is_class_day: isClassDate(today), cancel, slots: slotsOut,
      previous, max_day: maxDay, refresh_in: refreshIn,
    });
  } catch {
    return json(req, { ...base, status: "error" }, 502);
  }
});
