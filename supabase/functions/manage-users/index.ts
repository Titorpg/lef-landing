// LEF — gestión de cuentas (solo admin).
// Crea/edita usuarios de auth y su fila en profiles.
// Se invoca desde el panel admin con el JWT del admin; aquí se re-verifica el rol.
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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
  if (!me || me.role !== "admin" || !me.active) return json({ error: "requiere_admin" }, 403);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return json({ error: "json_invalido" }, 400); }
  const action = String(payload.action ?? "");

  try {
    if (action === "create_account") {
      // Crea la cuenta de auth + profile. role: 'student' | 'teacher' | 'admin'
      const email = String(payload.email ?? "").trim().toLowerCase();
      const role = String(payload.role ?? "student");
      const full_name = String(payload.full_name ?? "").trim();
      const password = String(payload.password ?? "");
      const student_id = payload.student_id ? String(payload.student_id) : null;
      const teacher_id = payload.teacher_id ? String(payload.teacher_id) : null;
      if (!email || !password || password.length < 8) return json({ error: "email_o_password_invalido" }, 400);
      if (!["student", "teacher", "admin"].includes(role)) return json({ error: "rol_invalido" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (cErr) return json({ error: cErr.message }, 400);

      const { error: pErr } = await admin.from("profiles").insert({
        user_id: created.user.id, role, full_name, email, student_id, teacher_id,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: pErr.message }, 400);
      }
      return json({ ok: true, user_id: created.user.id });
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
      const { error } = await admin.auth.admin.updateUserById(
        String(payload.user_id), { password: String(payload.password) });
      return error ? json({ error: error.message }, 400) : json({ ok: true });
    }

    return json({ error: "accion_desconocida" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
