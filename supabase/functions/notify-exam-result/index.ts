// LEF — correo al estudiante cuando su profesor da el OK a su examen de
// validación (pedido del usuario, 27 sep 2026). El resultado va en una novedad
// personal de su tablón (teacher_approve_exam); el correo solo avisa que ya está.
//
// La llama el panel justo después de aprobar. Solo el profesor del grupo o un
// admin pueden pedir el envío, y cada resultado se avisa UNA vez
// (exam_submissions.emailed_at).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor } from "../_shared/google-auth.ts";
import { examResultEmail } from "../_shared/email-layout.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
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

  let subId = "";
  try { const b = await req.json(); subId = String(b?.submission_id || ""); } catch { /* sin cuerpo */ }
  if (!/^[0-9a-f-]{36}$/i.test(subId)) return json(req, { error: "resultado_invalido" }, 400);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin.from("profiles").select("role, active, teacher_id").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !["admin", "teacher"].includes(profile.role)) return json(req, { error: "no_autorizado" }, 403);

  const { data: sub } = await admin.from("exam_submissions")
    .select("id, status, emailed_at, teacher_id, teacher_name, module_level, exam_title, student_id, students(full_name, email)")
    .eq("id", subId).maybeSingle();
  if (!sub) return json(req, { error: "resultado_no_existe" }, 404);
  if (profile.role !== "admin" && sub.teacher_id !== profile.teacher_id) return json(req, { error: "no_autorizado" }, 403);
  if (sub.status !== "aprobado") return json(req, { sent: 0, skipped: "sin_aprobar" });
  if (sub.emailed_at) return json(req, { sent: 0, skipped: "ya_avisado" });

  // deno-lint-ignore no-explicit-any
  const st: any = sub.students || {};
  const to = String(st.email || "").trim();
  if (!to) return json(req, { sent: 0, skipped: "sin_correo" });

  const apiKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("RESEND_FROM");
  if (!apiKey || !from) return json(req, { error: "correo_no_configurado" }, 500);
  const portalUrl = (Deno.env.get("LEF_LOGIN_URL") || "https://www.lefcenter.com/login").replace(/\/login\/?$/, "") + "/portal";

  const m = examResultEmail({
    name: String(st.full_name || "").split(/\s+/)[0] || "",
    module: sub.module_level, examTitle: sub.exam_title, teacher: sub.teacher_name || "",
  }, portalUrl);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: m.subject, html: m.html, text: m.text }),
  });
  if (!r.ok) {
    const err = String((await r.json().catch(() => ({})))?.message ?? `HTTP ${r.status}`);
    return json(req, { sent: 0, error: err }, 502);
  }
  await admin.from("exam_submissions").update({ emailed_at: new Date().toISOString() }).eq("id", sub.id);
  return json(req, { sent: 1 });
});
