// LEF — trae los próximos eventos del calendario principal de Google del
// profesor autenticado (solo lectura). Usa el mismo token guardado que
// Classroom (se pidió el scope calendar.readonly en la misma conexión).
import { getAllowedOrigins, corsFor, getTeacherAccessToken } from "../_shared/google-auth.ts";

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

  const auth = await getTeacherAccessToken(req);
  if (!auth.ok) {
    if (auth.error === "no_conectado" || auth.error === "reconectar") return json(req, { connected: false });
    return json(req, { error: auth.error }, auth.status);
  }

  const params = new URLSearchParams({
    timeMin: new Date().toISOString(),
    maxResults: "25",
    singleEvents: "true",
    orderBy: "startTime",
  });

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });
    if (!res.ok) throw new Error(`calendar_api_${res.status}`);
    const data = await res.json();

    const events = (data.items || []).map((e: Record<string, unknown>) => {
      const start = e.start as Record<string, unknown> | undefined;
      const end = e.end as Record<string, unknown> | undefined;
      return {
        id: e.id,
        summary: e.summary || "(Sin título)",
        location: e.location || null,
        htmlLink: e.htmlLink,
        start: start?.dateTime || start?.date,
        end: end?.dateTime || end?.date,
        allDay: !!start?.date,
      };
    });

    return json(req, { connected: true, google_email: auth.googleEmail, events });
  } catch {
    return json(req, { connected: true, error: "calendar_api_error" }, 502);
  }
});
