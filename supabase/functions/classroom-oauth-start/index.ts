// LEF — arranca el flujo de OAuth para que un profesor conecte su cuenta de
// Google Classroom (solo lectura: cursos, temas y materiales). Conexión por
// profesor, no domain-wide delegation — cada quien autoriza la suya. El
// client_secret nunca sale de aquí; el navegador solo recibe la URL de
// Google a la que redirigirse.
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

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Solo lectura de estructura — nada de tareas calificadas ni entregas.
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "openid",
  "email",
].join(" ");

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

  const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
  const clientId = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID");
  if (!stateSecret || !clientId) return json(req, { error: "classroom_sin_configurar" }, 500);

  const redirectUri = `${url}/functions/v1/classroom-oauth-callback`;
  const payload = `${profile.teacher_id}.${Date.now()}`;
  const sig = await hmacHex(stateSecret, payload);
  const state = `${payload}.${sig}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return json(req, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});
