// LEF — trae cursos, temas y materiales (solo lectura) del profesor
// autenticado desde Google Classroom, usando su token guardado. Los tokens
// nunca llegan al navegador: todo el llamado a Google pasa por aquí.
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ??
  "https://www.lefcenter.com,https://lefcenter.com,https://lef-center.vercel.app")
  .split(",").map((s) => s.trim()).filter(Boolean);

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

async function refreshAccessToken(refreshToken: string) {
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

async function classroomGet(accessToken: string, path: string) {
  const res = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`classroom_api_${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: "no_autenticado" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: profile } = await admin
    .from("profiles").select("teacher_id, active").eq("user_id", auth.user.id).maybeSingle();
  if (!profile || !profile.active || !profile.teacher_id) return json(req, { error: "requiere_profesor" }, 403);

  const { data: tok } = await admin
    .from("teacher_google_tokens").select("*").eq("teacher_id", profile.teacher_id).maybeSingle();
  if (!tok) return json(req, { connected: false });

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
      return json(req, { connected: false, error: "reconectar" });
    }
  }

  try {
    const coursesRes = await classroomGet(accessToken, "courses?teacherId=me&courseStates=ACTIVE&pageSize=100");
    const courses = coursesRes.courses || [];

    const shaped = await Promise.all(courses.map(async (c: Record<string, unknown>) => {
      let topics: Record<string, unknown>[] = [];
      let materials: Record<string, unknown>[] = [];
      try {
        const topicsRes = await classroomGet(accessToken, `courses/${c.id}/topics?pageSize=200`);
        topics = topicsRes.topic || [];
      } catch {
        // Curso sin temas creados todavía.
      }
      try {
        const matRes = await classroomGet(accessToken, `courses/${c.id}/courseWorkMaterials?pageSize=200`);
        materials = matRes.courseWorkMaterial || [];
      } catch {
        // Curso sin materiales publicados todavía.
      }
      return {
        id: c.id,
        name: c.name,
        section: c.section || null,
        alternateLink: c.alternateLink,
        topics: topics.map((t) => ({ id: t.topicId, name: t.name })),
        materials: materials.map((m) => ({
          id: m.id, title: m.title, topicId: m.topicId || null, alternateLink: m.alternateLink,
        })),
      };
    }));

    return json(req, { connected: true, google_email: tok.google_email, courses: shaped });
  } catch {
    return json(req, { connected: true, error: "classroom_api_error" }, 502);
  }
});
