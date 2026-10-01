// LEF — correo al estudiante con su informe de progreso en PDF (1 oct 2026).
// El profesor envía los informes de su grupo (teacher_send_progress_reports
// crea la novedad del Inicio); el panel arma el PDF de cada uno y lo manda aquí
// para adjuntarlo. Solo el profesor del grupo o un admin, solo informes ya
// enviados, y cada informe se avisa UNA vez (progress_reports.emailed_at).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor } from "../_shared/google-auth.ts";
import { progressReportEmail } from "../_shared/email-layout.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

function safeName(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
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

  let repId = "", pdf = "";
  try { const b = await req.json(); repId = String(b?.report_id || ""); pdf = String(b?.pdf || ""); } catch { /* sin cuerpo */ }
  if (!/^[0-9a-f-]{36}$/i.test(repId)) return json(req, { error: "informe_invalido" }, 400);
  // PDF en base64 ("%PDF" = "JVBER"), máximo ~5 MB.
  if (!pdf.startsWith("JVBER") || pdf.length > 7_000_000 || !/^[A-Za-z0-9+/=]+$/.test(pdf)) return json(req, { error: "pdf_invalido" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role, active, teacher_id").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !["admin", "teacher"].includes(profile.role)) return json(req, { error: "no_autorizado" }, 403);

  const { data: rep } = await admin.from("progress_reports")
    .select("id, sent_at, emailed_at, teacher_id, teacher_name, module_level, student_name, group_id, students(full_name, email)")
    .eq("id", repId).maybeSingle();
  if (!rep) return json(req, { error: "informe_no_existe" }, 404);
  if (profile.role !== "admin" && rep.teacher_id !== profile.teacher_id) return json(req, { error: "no_autorizado" }, 403);
  if (!rep.sent_at) return json(req, { sent: 0, skipped: "sin_enviar" });
  if (rep.emailed_at) return json(req, { sent: 0, skipped: "ya_avisado" });

  // deno-lint-ignore no-explicit-any
  const st: any = rep.students || {};
  const to = String(st.email || "").trim();
  if (!to) return json(req, { sent: 0, skipped: "sin_correo" });

  const apiKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) return json(req, { error: "correo_no_configurado" }, 500);
  const portalUrl = (Deno.env.get("LEF_LOGIN_URL") || "https://www.lefcenter.com/login").replace(/\/login\/?$/, "") + "/portal";

  let until = "";
  if (rep.group_id) {
    const { data: end } = await admin.rpc("lef_group_end", { p_group: rep.group_id });
    if (end) { const [y, m, d] = String(end).split("-"); until = `${d}/${m}/${y}`; }
  }
  const name = String(st.full_name || rep.student_name || "");
  const m = progressReportEmail({
    name: name.split(/\s+/)[0] || "", module: rep.module_level, teacher: rep.teacher_name || "", until,
  }, portalUrl);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from, to: [to], subject: m.subject, html: m.html, text: m.text,
      attachments: [{ filename: `Informe-de-progreso-${safeName(rep.module_level)}-${safeName(name)}.pdf`, content: pdf }],
    }),
  });
  if (!r.ok) {
    const err = String((await r.json().catch(() => ({})))?.message ?? `HTTP ${r.status}`);
    return json(req, { sent: 0, error: err }, 502);
  }
  await admin.from("progress_reports").update({ emailed_at: new Date().toISOString() }).eq("id", rep.id);
  return json(req, { sent: 1 });
});
