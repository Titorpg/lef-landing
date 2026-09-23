// LEF — gestión de cuentas (solo admin).
// Crea/edita usuarios de auth y su fila en profiles.
// Se invoca desde el panel admin con el JWT del admin; aquí se re-verifica el rol.
//
// Nota (15 sep 2026): esta es la versión que coincide con la desplegada en Supabase.
// Existe una versión más nueva con endurecimiento de login (contraseñas generadas por
// el servidor + envío por Resend + profiles.must_change_password + audit_log) en el
// historial de git (commit 3d737a4), pero depende de una migración que sigue sin
// aplicarse (ver estado.md / SEGURIDAD.md) — no desplegar esa versión todavía o se
// rompe la creación/reseteo de cuentas.
//
// 23 sep 2026: envío OPCIONAL de credenciales por correo (Resend) al crear una
// cuenta o restablecer la contraseña (payload.send_email = true). Es adicional:
// si el correo falla, la cuenta/contraseña igual queda hecha y se responde
// { ok: true, email_sent: false, email_error } para que el admin la comparta
// por WhatsApp como siempre.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { credentialsEmail } from "../_shared/email-layout.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Parte 4 (23 sep 2026): una contraseña puesta por el admin es temporal → la
// cuenta queda marcada para crear una personal al entrar. Va aparte y sin
// lanzar: si la columna aún no existe (migración 20260923050000 sin aplicar)
// la creación/reseteo sigue funcionando igual que antes.
// deno-lint-ignore no-explicit-any
async function markMustChange(admin: any, uid: string) {
  try {
    await admin.from("profiles").update({ must_change_password: true }).eq("user_id", uid);
  } catch { /* noop */ }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// Envía usuario + contraseña temporal. Nunca lanza: devuelve el resultado.
async function sendCredentials(
  kind: "new" | "reset", to: string, name: string, password: string,
): Promise<{ email_sent: boolean; email_error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM");
  const loginUrl = Deno.env.get("LEF_LOGIN_URL") || "https://www.lefcenter.com/login";
  if (!apiKey || !from) return { email_sent: false, email_error: "correo_no_configurado" };

  const { subject, html, text } = credentialsEmail(kind, to, name, password, loginUrl);

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    if (r.ok) return { email_sent: true };
    const j = await r.json().catch(() => ({}));
    return { email_sent: false, email_error: String(j?.message ?? `HTTP ${r.status}`) };
  } catch (e) {
    return { email_sent: false, email_error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // 1. Identificar al que llama y exigir rol admin.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json({ error: "no_autenticado" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: me } = await admin
    .from("profiles").select("role, active").eq("user_id", auth.user.id).maybeSingle();
  if (!me || !me.active) return json({ error: "requiere_admin" }, 403);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const action = String(payload.action ?? "");

  // Autoservicio: cualquier cuenta activa (admin, profesor o estudiante) puede
  // cambiar SU PROPIO correo desde "Mi cuenta" — todo lo demás sigue admin-only.
  const isSelfEmailUpdate = action === "update_email" && String(payload.user_id ?? "") === auth.user.id;
  if (!isSelfEmailUpdate && me.role !== "admin") return json({ error: "requiere_admin" }, 403);

  try {
    if (action === "create_account") {
      // Crea la cuenta de auth + profile. role: 'student' | 'teacher' | 'admin'
      const email = String(payload.email ?? "").trim().toLowerCase();
      const role = String(payload.role ?? "student");
      const full_name = String(payload.full_name ?? "").trim();
      const password = String(payload.password ?? "");
      const student_id = payload.student_id ? String(payload.student_id) : null;
      // teacher_id solo llega ya elegido cuando se le da acceso a un profesor
      // que YA existía en Académico (fila "profesor sin cuenta" en Usuarios).
      // En cualquier otro caso, un profesor nuevo se enlaza solo: más abajo
      // se crea su fila en teachers con estos mismos datos, sin que el admin
      // tenga que elegir ni vincular nada aparte.
      let teacher_id = payload.teacher_id ? String(payload.teacher_id) : null;
      if (!email || !password || password.length < 8) return json({ error: "email_o_password_invalido" }, 400);
      if (!["student", "teacher", "admin"].includes(role)) return json({ error: "rol_invalido" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (cErr) return json({ error: cErr.message }, 400);

      let createdTeacherId: string | null = null;
      if (role === "teacher" && !teacher_id) {
        const { data: newTeacher, error: tErr } = await admin.from("teachers")
          .insert({ full_name, email }).select("id").single();
        if (tErr) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json({ error: tErr.message }, 400);
        }
        teacher_id = newTeacher.id;
        createdTeacherId = newTeacher.id;
      }

      const { error: pErr } = await admin.from("profiles").insert({
        user_id: created.user.id, role, full_name, email, student_id, teacher_id,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        if (createdTeacherId) await admin.from("teachers").delete().eq("id", createdTeacherId);
        return json({ error: pErr.message }, 400);
      }
      await markMustChange(admin, created.user.id);
      const mail = payload.send_email ? await sendCredentials("new", email, full_name, password) : {};
      return json({ ok: true, user_id: created.user.id, ...mail });
    }

    if (action === "set_role") {
      const { error } = await admin.from("profiles")
        .update({ role: String(payload.role) }).eq("user_id", String(payload.user_id));
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }

    if (action === "set_active") {
      const active = !!payload.active;
      const { error } = await admin.from("profiles")
        .update({ active }).eq("user_id", String(payload.user_id));
      if (error) return json({ error: error.message }, 400);
      await admin.auth.admin.updateUserById(String(payload.user_id), {
        ban_duration: active ? "none" : "876000h",
      });
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const uid = String(payload.user_id);
      const password = String(payload.password);
      const { data: upd, error } = await admin.auth.admin.updateUserById(uid, { password });
      if (error) return json({ error: error.message }, 400);
      await markMustChange(admin, uid);
      if (!payload.send_email) return json({ ok: true });
      const { data: prof } = await admin.from("profiles").select("full_name").eq("user_id", uid).maybeSingle();
      const to = upd.user?.email ?? "";
      const mail = to
        ? await sendCredentials("reset", to, prof?.full_name ?? "", password)
        : { email_sent: false, email_error: "sin_correo" };
      return json({ ok: true, ...mail });
    }

    if (action === "delete_account") {
      const uid = String(payload.user_id);
      if (uid === auth.user.id) return json({ error: "no_puedes_borrarte" }, 400);
      await admin.from("profiles").delete().eq("user_id", uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }

    if (action === "update_email") {
      const uid = String(payload.user_id);
      const email = String(payload.email ?? "").trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_invalido" }, 400);
      const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      await admin.from("profiles").update({ email }).eq("user_id", uid);
      return json({ ok: true });
    }

    if (action === "update_profile") {
      // Corrige nombre y/o correo de una cuenta (admin, profesor o estudiante) desde Usuarios.
      const uid = String(payload.user_id);
      const email = String(payload.email ?? "").trim().toLowerCase();
      const full_name = String(payload.full_name ?? "").trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "email_invalido" }, 400);
      if (!full_name) return json({ error: "nombre_invalido" }, 400);
      const { error: aErr } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
      if (aErr) return json({ error: aErr.message }, 400);
      const { error: pErr } = await admin.from("profiles").update({ email, full_name }).eq("user_id", uid);
      if (pErr) return json({ error: pErr.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
