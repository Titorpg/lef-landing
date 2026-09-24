// LEF — helpers compartidos por las Edge Functions que llaman APIs de Google
// a nombre de un profesor (classroom-list): valida su JWT de
// Supabase, busca su token de Google guardado y lo refresca si hace falta.
// Los tokens nunca salen de aquí hacia el navegador.
import { createClient } from "jsr:@supabase/supabase-js@2";

export function getAllowedOrigins(): string[] {
  return (Deno.env.get("ALLOWED_ORIGINS") ??
    "https://www.lefcenter.com,https://lefcenter.com,https://lef-center.vercel.app")
    .split(",").map((s) => s.trim()).filter(Boolean);
}

export function corsFor(req: Request, allowedOrigins: string[]) {
  const origin = req.headers.get("Origin") ?? "";
  const allow = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("google_refresh_failed");
  return data as { access_token: string; expires_in: number };
}

export type TeacherTokenResult =
  | { ok: true; accessToken: string; googleEmail: string | null; teacherId: string }
  | { ok: false; status: number; error: string };

// Verifica el JWT del profesor y devuelve un access_token de Google listo
// para usar (refrescándolo si hace falta). error "no_conectado"/"reconectar"
// significan "todavía no hay nada que mostrar", no un fallo del llamador.
export async function getTeacherAccessToken(req: Request): Promise<TeacherTokenResult> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return { ok: false, status: 401, error: "no_autenticado" };

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin
    .from("profiles").select("teacher_id, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !profile.teacher_id) {
    return { ok: false, status: 403, error: "requiere_profesor" };
  }

  const { data: tok } = await admin
    .from("teacher_google_tokens").select("*").eq("teacher_id", profile.teacher_id).maybeSingle();
  if (!tok) return { ok: false, status: 200, error: "no_conectado" };

  let accessToken = tok.access_token as string;
  const expired = !tok.access_token_expires_at ||
    new Date(tok.access_token_expires_at).getTime() <= Date.now() + 60_000;

  if (expired) {
    try {
      const refreshed = await refreshAccessToken(tok.refresh_token);
      accessToken = refreshed.access_token;
      await admin.from("teacher_google_tokens").update({
        access_token: accessToken,
        access_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("teacher_id", profile.teacher_id);
    } catch {
      return { ok: false, status: 200, error: "reconectar" };
    }
  }

  return { ok: true, accessToken, googleEmail: tok.google_email, teacherId: profile.teacher_id };
}
