// LEF — recibe el "code" que manda Google tras el consentimiento del
// profesor, lo cambia por tokens (client_secret nunca sale de aquí) y guarda
// el refresh_token. Google navega aquí directo (no manda auth de Supabase),
// así que esta función se despliega con --no-verify-jwt.
import { createClient } from "jsr:@supabase/supabase-js@2";

const SITE_URL = (Deno.env.get("ALLOWED_ORIGINS") ?? "https://www.lefcenter.com")
  .split(",")[0].trim();

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redirectTo(status: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: `${SITE_URL}/admin.html?google=${status}#classroom` },
  });
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  if (u.searchParams.get("error")) return redirectTo("denied");
  if (!code || !state) return redirectTo("error");

  const parts = state.split(".");
  if (parts.length !== 3) return redirectTo("error");
  const [teacherId, ts, sig] = parts;

  const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET");
  if (!stateSecret) return redirectTo("error");
  const expectedSig = await hmacHex(stateSecret, `${teacherId}.${ts}`);
  if (expectedSig !== sig) return redirectTo("error");
  if (Date.now() - Number(ts) > 10 * 60 * 1000) return redirectTo("expired");

  const clientId = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLASSROOM_CLIENT_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  if (!clientId || !clientSecret) return redirectTo("error");
  const redirectUri = `${supabaseUrl}/functions/v1/classroom-oauth-callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) return redirectTo("error");

  let googleEmail: string | null = null;
  try {
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (infoRes.ok) googleEmail = (await infoRes.json()).email ?? null;
  } catch {
    // No crítico — se guarda igual sin el correo.
  }

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();
  const nowIso = new Date().toISOString();

  if (tokenData.refresh_token) {
    const { error } = await admin.from("teacher_google_tokens").upsert({
      teacher_id: teacherId,
      google_email: googleEmail,
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      access_token_expires_at: expiresAt,
      updated_at: nowIso,
    });
    if (error) return redirectTo("error");
  } else {
    // prompt=consent hace que Google siempre reenvíe refresh_token, pero por
    // si acaso: si ya había una fila, al menos se actualiza el access_token.
    await admin.from("teacher_google_tokens")
      .update({ access_token: tokenData.access_token, access_token_expires_at: expiresAt,
                google_email: googleEmail, updated_at: nowIso })
      .eq("teacher_id", teacherId);
  }

  return redirectTo("ok");
});
