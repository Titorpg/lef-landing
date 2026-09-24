// LEF — trae los eventos del calendario principal de Google del profesor
// autenticado (solo lectura) para un rango de fechas: el panel lo pinta como
// cuadrícula de mes, igual que Google Calendar. Usa el mismo token guardado
// que Classroom (se pidió el scope calendar.readonly en la misma conexión).
import { getAllowedOrigins, corsFor, getTeacherAccessToken } from "../_shared/google-auth.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

const DAY = 24 * 60 * 60 * 1000;

Deno.serve(async (req) => {
  const allowed = getAllowedOrigins();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req, allowed) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const auth = await getTeacherAccessToken(req);
  if (!auth.ok) {
    if (auth.error === "no_conectado" || auth.error === "reconectar") return json(req, { connected: false });
    return json(req, { error: auth.error }, auth.status);
  }

  // Rango pedido por el panel (la cuadrícula de un mes: hasta 6 semanas).
  // Sin rango válido: desde hoy, 6 semanas.
  let body: { timeMin?: string; timeMax?: string } = {};
  try { body = await req.json(); } catch { /* sin cuerpo */ }
  let min = Date.parse(body.timeMin || "");
  let max = Date.parse(body.timeMax || "");
  if (isNaN(min) || isNaN(max) || max <= min || max - min > 45 * DAY) {
    min = Date.now();
    max = min + 42 * DAY;
  }

  try {
    const items: Record<string, unknown>[] = [];
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        timeMin: new Date(min).toISOString(),
        timeMax: new Date(max).toISOString(),
        maxResults: "250",
        singleEvents: "true",
        orderBy: "startTime",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
      });
      if (!res.ok) throw new Error(`calendar_api_${res.status}`);
      const data = await res.json();
      items.push(...(data.items || []));
      pageToken = data.nextPageToken || "";
    } while (pageToken && items.length < 1000);

    // Respuesta del propio profesor a la invitación (si es invitado).
    const selfResponse = (e: Record<string, unknown>) =>
      ((e.attendees as Record<string, unknown>[] | undefined) || []).find((a) => a.self)?.responseStatus as string | undefined;

    const events = items
      // Igual que Google Calendar: no se muestran los cancelados ni las
      // invitaciones que el profesor rechazó.
      .filter((e) => e.status !== "cancelled" && selfResponse(e) !== "declined")
      .map((e) => {
        const start = e.start as Record<string, unknown> | undefined;
        const end = e.end as Record<string, unknown> | undefined;
        const organizer = e.organizer as Record<string, unknown> | undefined;
        return {
          organizer: organizer?.email || null,
          response: selfResponse(e) || null,
          eventType: e.eventType || null,
          id: e.id,
          summary: e.summary || "(Sin título)",
          location: e.location || null,
          htmlLink: e.htmlLink,
          hangoutLink: e.hangoutLink || null,
          colorId: e.colorId || null,
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
