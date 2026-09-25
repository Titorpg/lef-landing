// LEF — "Mi clase" del estudiante (portal → Mi curso).
//
// Pedido del usuario (24 sep 2026): el estudiante entra a la clase de Google
// Classroom de SU profesor con un botón (código de la clase), y ve dentro de
// LEF la "Clase de hoy": la agenda que el profesor publicó hoy. En Classroom
// el profesor tiene todas las agendas ("… MODULE 4 DAY 12 …") como BORRADOR y
// el día de la clase publica la que toca.
//
// Cómo encuentra todo, sin que el admin configure nada:
//   estudiante → su inscripción vigente con grupo → profesor + módulo (A2.1)
//   → clase del profesor en Classroom cuyo nombre lleva SU nombre y el nivel
//     ("LEVEL A2 - LUIS CABALLERO"): una clase por profesor y nivel, compartida
//     por todos sus grupos de ese nivel;
//   → dentro, el tema del módulo ("MODULE 4" global, "A2.1" o "MODULE 1–3"
//     local), igual que el Planificador.
// Se lee con la conexión de Google del PROFESOR (el estudiante no conecta
// nada) y SOLO lo publicado: los borradores nunca salen de aquí. Requiere que
// la inscripción esté pagada (mismo criterio que "Mis recursos").
//
// action "info"  → datos de la clase (código y enlace para unirse). Rápido.
// action "today" → además, agendas publicadas del módulo: las de hoy y las
//                  anteriores (con la revisión de "se deja incrustar").
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
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const dowFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });
const bogotaDate = (iso: string | undefined) => (iso ? dateFmt.format(new Date(iso)) : "");

function dayNum(t: string) { const m = /\b(?:DAY|D[IÍ]A)\s*(\d+)/i.exec(t || ""); return m ? +m[1] : null; }

// Nombre de tema o título → código de módulo de LEF (misma regla que el Planificador).
function moduleCode(text: string, levelCode: string, byNumber: Record<number, string>) {
  const cm = /\b([ABC][12]\.[1-3])\b/i.exec(text || "");
  if (cm) return cm[1].toUpperCase();
  const nm = /\bMODUL[OE]\s*(\d+)/i.exec(text || "");
  if (!nm) return null;
  const n = +nm[1], byNum = byNumber[n];
  if (byNum && byNum.indexOf(levelCode) === 0) return byNum;
  if (n >= 1 && n <= 3) return levelCode + "." + n; // numeración local dentro del nivel
  return byNum || null;
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

  let action = "info";
  try { const b = await req.json(); if (b && b.action === "today") action = "today"; } catch { /* sin cuerpo */ }

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles")
    .select("role, student_id, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || profile.role !== "student" || !profile.student_id) {
    return json(req, { error: "requiere_estudiante" }, 403);
  }

  // Inscripción vigente con grupo (la más reciente).
  const { data: enr } = await admin.from("enrollments")
    .select("id, status, created_at, modules(level, title, module_number), groups(id, teacher_id, teachers(full_name), schedules(days, start_time, end_time, cycles(start_date, end_date)))")
    .eq("student_id", profile.student_id).in("status", ["PendingPayment", "Active"])
    .not("group_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!enr || !enr.groups) return json(req, { status: "sin_grupo" });

  // deno-lint-ignore no-explicit-any
  const e = enr as any;
  const mod = e.modules, grp = e.groups, sch = grp.schedules || {}, cyc = sch.cycles || {};
  const today = dateFmt.format(new Date());
  const weekday = dowFmt.format(new Date());
  const group = {
    module_level: mod.level, module_title: mod.title,
    days: sch.days || [], start_time: sch.start_time, end_time: sch.end_time,
    teacher: grp.teachers?.full_name || "",
    cycle_start: cyc.start_date || null, cycle_end: cyc.end_date || null,
  };
  const isClassDay = (sch.days || []).includes(weekday) &&
    (!cyc.start_date || cyc.start_date <= today) && (!cyc.end_date || today <= cyc.end_date);
  // Próxima clase (después de hoy) dentro de las fechas del ciclo.
  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let nextClass: string | null = null;
  for (let i = 1; i <= 21; i++) {
    const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + i);
    const ymd = d.toISOString().slice(0, 10);
    if (cyc.end_date && ymd > cyc.end_date) break;
    if (cyc.start_date && ymd < cyc.start_date) continue;
    if ((sch.days || []).includes(DOW[d.getUTCDay()])) { nextClass = ymd; break; }
  }
  const base = { group, today, is_class_day: isClassDay, next_class: nextClass };

  const { data: paid } = await admin.rpc("lef_enrollment_paid", { p_enrollment_id: e.id });
  if (!paid) return json(req, { ...base, status: "sin_pago" });

  const tok = await accessTokenForTeacher(admin, grp.teacher_id);
  if (!tok.ok) return json(req, { ...base, status: "profesor_sin_conexion" });

  try {
    // Clase del profesor para este nivel: lleva su nombre y el nivel (A2).
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
    if (action !== "today") return json(req, { ...base, status: "ok", course: courseOut });

    // Agendas PUBLICADAS del módulo del estudiante.
    const { data: modsAll } = await admin.from("modules").select("level, module_number");
    const byNumber: Record<number, string> = {};
    (modsAll || []).forEach((m: { level: string; module_number: number }) => { byNumber[m.module_number] = m.level; });
    let topics: Record<string, unknown>[] = [];
    try { topics = await classroomList(tok.accessToken, `courses/${course.id}/topics?pageSize=200`, "topic"); } catch { /* sin temas */ }
    const topicMod: Record<string, string | null> = {};
    topics.forEach((t) => { topicMod[String(t.topicId)] = moduleCode(String(t.name || ""), levelCode, byNumber); });
    let mats: Record<string, unknown>[] = [];
    try {
      mats = await classroomList(tok.accessToken,
        `courses/${course.id}/courseWorkMaterials?pageSize=200&courseWorkMaterialStates=PUBLISHED`, "courseWorkMaterial");
    } catch { /* sin materiales */ }

    const agendas = mats
      .filter((m) => m.state === "PUBLISHED")
      .filter((m) => {
        const mk = (m.topicId && topicMod[String(m.topicId)]) || moduleCode(String(m.title || ""), levelCode, byNumber);
        return mk === mod.level;
      })
      .map((m) => ({
        id: m.id, title: m.title, description: m.description || null, alternateLink: m.alternateLink,
        day: dayNum(String(m.title || "")),
        // Publicada hoy: el profesor la pasa de borrador a publicada ese día
        // (o la programa); updateTime/scheduledTime marcan ese momento.
        published_on: bogotaDate(String(m.scheduledTime || m.updateTime || m.creationTime || "")),
        attachments: ((m.materials as Record<string, unknown>[]) || []).map(shapeAttachment),
      }))
      .sort((a, b) => (b.day ?? -1) - (a.day ?? -1) || String(b.published_on).localeCompare(String(a.published_on)));

    const todays = agendas.filter((a) => a.published_on === today);
    // Anteriores = solo lo que YA cursó ESTE estudiante: publicadas desde el
    // inicio de su ciclo hasta ayer. La clase de Classroom se reutiliza entre
    // grupos, así que lo publicado para grupos anteriores no cuenta (pedido del
    // usuario, 24 sep 2026: "si vamos en el día 2, en anteriores solo el 1").
    const since = cyc.start_date || (() => {
      const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 30); return d.toISOString().slice(0, 10);
    })();
    const previous = agendas
      .filter((a) => a.published_on && a.published_on >= since && a.published_on < today)
      .slice(0, 40);
    await attachEmbeds([...todays, ...previous]);

    return json(req, { ...base, status: "ok", course: courseOut, today_agendas: todays, previous_agendas: previous });
  } catch {
    return json(req, { ...base, status: "error" }, 502);
  }
});
