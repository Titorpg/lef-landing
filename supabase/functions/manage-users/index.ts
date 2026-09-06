// LEF — gestión de cuentas (solo admin).
// Crea/edita usuarios de auth y su fila en profiles.
// Se invoca desde el panel admin con el JWT del admin; aquí se re-verifica el rol.
//
// Seguridad (sep 2026):
//   - CORS restringido a los dominios de LEF (ALLOWED_ORIGINS).
//   - Las contraseñas de alta y de restablecimiento las genera ESTE servidor
//     (nunca llegan del navegador) y se marcan como "debe cambiarla en el primer
//     ingreso" (profiles.must_change_password = true).
//   - La contraseña se envía por correo al usuario vía Resend, y también se
//     devuelve al admin como respaldo para leerla en voz alta si hace falta.
//   - No se puede quitar el rol / desactivar / borrar al último admin activo.
//   - Toda acción que toca cuentas queda en public.audit_log.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.lefcenter.com,https://lefcenter.com,https://lef-center.vercel.app")
  .split(",").map((s) => s.trim()).filter(Boolean);

const LOGIN_URL = Deno.env.get("LEF_LOGIN_URL") ?? "https://www.lefcenter.com/login";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "LEF <acceso@lefcenter.com>";

function corsFor(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), "Content-Type": "application/json" },
  });
}

// Contraseña temporal fuerte, sin caracteres ambiguos, con 4 clases.
function generatePassword(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digit = "23456789";
  const symbol = "!@#$%*?-_";
  const all = lower + upper + digit + symbol;
  const pick = (set: string, n: number) => {
    const out: string[] = [];
    const buf = new Uint32Array(n);
    crypto.getRandomValues(buf);
    for (let i = 0; i < n; i++) out.push(set[buf[i] % set.length]);
    return out;
  };
  const chars = [
    ...pick(lower, 3), ...pick(upper, 3), ...pick(digit, 3), ...pick(symbol, 2),
    ...pick(all, 5),
  ];
  // Barajado Fisher-Yates con aleatoriedad criptográfica.
  for (let i = chars.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

async function sendCredentialsEmail(to: string, fullName: string, password: string) {
  if (!RESEND_API_KEY) {
    console.warn("[manage-users] RESEND_API_KEY sin configurar — no se envió el correo");
    return { sent: false, reason: "resend_sin_configurar" };
  }
  const nombre = fullName ? fullName.split(" ")[0] : "";
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#101010;line-height:1.5">
      <h2 style="color:#2E4E9E;margin:0 0 12px">Tu acceso a LEF</h2>
      <p>Hola${nombre ? " " + nombre : ""}, LEF creó tu cuenta para el portal.</p>
      <p style="margin:16px 0;padding:14px 16px;background:#FAFAF8;border:1px solid #e5e5e0;border-radius:8px">
        <strong>Usuario:</strong> ${to}<br>
        <strong>Contraseña temporal:</strong>
        <code style="font-size:15px">${password}</code>
      </p>
      <p><strong>Importante:</strong> esta contraseña es temporal. Entra a
        <a href="${LOGIN_URL}">${LOGIN_URL}</a>, inicia sesión con los datos de arriba,
        y el sistema te pedirá <strong>crear tu propia contraseña personal</strong>
        antes de continuar. Esa nueva contraseña queda guardada automáticamente en tu cuenta.</p>
      <p style="color:#666;font-size:13px">Si no esperabas este correo, escríbenos por WhatsApp.</p>
    </div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM, to, subject: "Tu acceso a LEF", html }),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error("[manage-users] Resend falló:", r.status, t);
      return { sent: false, reason: "resend_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[manage-users] Resend excepción:", e);
    return { sent: false, reason: "resend_excepcion" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // 1. Identificar al que llama y exigir rol admin.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: "no_autenticado" }, 401);

  const admin = createClient(url, serviceKey);
  const { data: me } = await admin
    .from("profiles").select("role, active, email").eq("user_id", auth.user.id).maybeSingle();
  if (!me || me.role !== "admin" || !me.active) return json(req, { error: "requiere_admin" }, 403);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json(req, { error: "json_invalido" }, 400); }
  const action = String(payload.action ?? "");

  const audit = (row: Record<string, unknown>) =>
    admin.from("audit_log").insert({
      actor_user_id: auth.user.id,
      actor_email: me.email,
      ip,
      ...row,
    }).then(({ error }) => { if (error) console.error("[audit_log]", error); });

  // Nº de admins activos DISTINTOS del user_id dado (para el guardarraíl).
  const otherActiveAdmins = async (excludeUserId: string) => {
    const { count } = await admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin").eq("active", true).neq("user_id", excludeUserId);
    return count ?? 0;
  };

  try {
    if (action === "create_account") {
      // Crea la cuenta de auth + profile. role: 'student' | 'teacher' | 'admin'
      const email = String(payload.email ?? "").trim().toLowerCase();
      const role = String(payload.role ?? "student");
      const full_name = String(payload.full_name ?? "").trim();
      const student_id = payload.student_id ? String(payload.student_id) : null;
      const teacher_id = payload.teacher_id ? String(payload.teacher_id) : null;
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(req, { error: "email_invalido" }, 400);
      if (!["student", "teacher", "admin"].includes(role)) return json(req, { error: "rol_invalido" }, 400);

      const password = generatePassword();

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (cErr) return json(req, { error: cErr.message }, 400);

      const { error: pErr } = await admin.from("profiles").insert({
        user_id: created.user.id, role, full_name, email, student_id, teacher_id,
        must_change_password: true,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json(req, { error: pErr.message }, 400);
      }

      const mail = await sendCredentialsEmail(email, full_name, password);
      await audit({ action: "create_account", target_user_id: created.user.id, target_email: email,
        detail: { role, email_sent: mail.sent } });

      // password: respaldo para que el admin lo lea si el correo no llega.
      return json(req, { ok: true, user_id: created.user.id, password, email_sent: mail.sent });
    }

    if (action === "set_role") {
      const target = String(payload.user_id);
      const newRole = String(payload.role);
      if (!["student", "teacher", "admin"].includes(newRole)) return json(req, { error: "rol_invalido" }, 400);
      const { data: tgt } = await admin.from("profiles").select("role, active, email").eq("user_id", target).maybeSingle();
      if (tgt?.role === "admin" && newRole !== "admin" && tgt.active) {
        if (await otherActiveAdmins(target) === 0) return json(req, { error: "ultimo_admin" }, 400);
      }
      const { error } = await admin.from("profiles").update({ role: newRole }).eq("user_id", target);
      if (error) return json(req, { error: error.message }, 400);
      await audit({ action: "set_role", target_user_id: target, target_email: tgt?.email,
        detail: { from: tgt?.role, to: newRole } });
      return json(req, { ok: true });
    }

    if (action === "set_active") {
      const target = String(payload.user_id);
      const active = !!payload.active;
      const { data: tgt } = await admin.from("profiles").select("role, active, email").eq("user_id", target).maybeSingle();
      if (!active && tgt?.role === "admin" && tgt.active) {
        if (await otherActiveAdmins(target) === 0) return json(req, { error: "ultimo_admin" }, 400);
      }
      const { error } = await admin.from("profiles").update({ active }).eq("user_id", target);
      if (error) return json(req, { error: error.message }, 400);
      await admin.auth.admin.updateUserById(target, { ban_duration: active ? "none" : "876000h" });
      await audit({ action: "set_active", target_user_id: target, target_email: tgt?.email, detail: { active } });
      return json(req, { ok: true });
    }

    if (action === "reset_password") {
      // La contraseña la genera el servidor y se envía por correo (igual que el alta).
      const target = String(payload.user_id);
      const { data: tgt } = await admin.from("profiles")
        .select("email, full_name").eq("user_id", target).maybeSingle();
      if (!tgt) return json(req, { error: "cuenta_no_encontrada" }, 404);

      const password = generatePassword();
      const { error } = await admin.auth.admin.updateUserById(target, { password });
      if (error) return json(req, { error: error.message }, 400);
      await admin.from("profiles").update({ must_change_password: true }).eq("user_id", target);

      const mail = await sendCredentialsEmail(tgt.email, tgt.full_name ?? "", password);
      await audit({ action: "reset_password", target_user_id: target, target_email: tgt.email,
        detail: { email_sent: mail.sent } });
      return json(req, { ok: true, password, email_sent: mail.sent });
    }

    if (action === "delete_account") {
      const uid = String(payload.user_id);
      if (uid === auth.user.id) return json(req, { error: "no_puedes_borrarte" }, 400);
      const { data: tgt } = await admin.from("profiles").select("role, active, email").eq("user_id", uid).maybeSingle();
      if (tgt?.role === "admin" && tgt.active && await otherActiveAdmins(uid) === 0) {
        return json(req, { error: "ultimo_admin" }, 400);
      }
      await admin.from("profiles").delete().eq("user_id", uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) return json(req, { error: error.message }, 400);
      await audit({ action: "delete_account", target_user_id: uid, target_email: tgt?.email });
      return json(req, { ok: true });
    }

    if (action === "update_email") {
      const uid = String(payload.user_id);
      const email = String(payload.email ?? "").trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(req, { error: "email_invalido" }, 400);
      const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true });
      if (error) return json(req, { error: error.message }, 400);
      await admin.from("profiles").update({ email }).eq("user_id", uid);
      await audit({ action: "update_email", target_user_id: uid, target_email: email });
      return json(req, { ok: true });
    }

    return json(req, { error: "accion_desconocida" }, 400);
  } catch (e) {
    return json(req, { error: String(e) }, 500);
  }
});
