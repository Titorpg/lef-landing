// LEF — piezas compartidas para leer Google Classroom (classroom-list para el
// Planificador del profesor, student-classroom para "Mi clase" del estudiante).
// Todo va con el token de Google del PROFESOR; nunca sale al navegador.
import { createClient } from "jsr:@supabase/supabase-js@2";

// Cada courseWorkMaterial trae uno o más archivos adjuntos (Drive, YouTube,
// enlace o Form). La API de Classroom ya da el id/URL de cada uno — no hace
// falta pedir acceso a Drive para saber qué embeber.
export function shapeAttachment(att: Record<string, unknown>) {
  if (att.driveFile) {
    const outer = att.driveFile as Record<string, unknown>;
    const df = (outer.driveFile as Record<string, unknown>) || outer;
    return { type: "drive", id: df.id, title: df.title, alternateLink: df.alternateLink };
  }
  if (att.youTubeVideo) {
    const yt = att.youTubeVideo as Record<string, unknown>;
    return { type: "youtube", id: yt.id, title: yt.title, alternateLink: yt.alternateLink };
  }
  if (att.link) {
    const lk = att.link as Record<string, unknown>;
    return { type: "link", url: lk.url, title: lk.title };
  }
  if (att.form) {
    const fm = att.form as Record<string, unknown>;
    return { type: "form", url: fm.formUrl, title: fm.title };
  }
  return { type: "unknown" };
}

// --- ¿Se puede mostrar el enlace DENTRO de LEF? ---
// Muchos sitios (Kahoot, Blooket, Baamboozle, Gimkit…) prohíben que otra
// página los muestre en un iframe (X-Frame-Options / CSP frame-ancestors) y el
// navegador enseña "…rechazó la conexión". Aquí se revisa cada enlace una vez:
//   - Wordwall: su página normal no se deja incrustar, pero su API oEmbed da la
//     dirección /embed/<guid> que sí (la misma del botón "Incrustar").
//   - Google Forms: la versión ?embedded=true sí se deja incrustar.
//   - Resto: se piden los encabezados del sitio; si lo prohíbe, el panel
//     muestra una tarjeta con "Abrir en una pestaña nueva" en vez del error.
export type Embed = { embedUrl: string | null; embeddable: boolean };

function withTimeout(ms: number) {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function wordwallEmbed(url: string): Promise<Embed> {
  try {
    const res = await fetch(`https://wordwall.net/api/oembed?url=${encodeURIComponent(url)}&format=json`, { signal: withTimeout(5000) });
    if (!res.ok) return { embedUrl: null, embeddable: false };
    const data = await res.json();
    const src = /src="([^"]+)"/.exec(String(data.html || ""));
    return src ? { embedUrl: src[1].replace(/&amp;/g, "&"), embeddable: true } : { embedUrl: null, embeddable: false };
  } catch {
    return { embedUrl: null, embeddable: false };
  }
}

async function frameCheck(url: string): Promise<Embed> {
  // http:// dentro de una página https lo bloquea el navegador de todos modos.
  if (!/^https:\/\//i.test(url)) return { embedUrl: null, embeddable: false };
  try {
    const res = await fetch(url, { redirect: "follow", signal: withTimeout(4000), headers: { "User-Agent": "Mozilla/5.0 (LEF embed check)" } });
    res.body?.cancel();
    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    if (xfo.includes("deny") || xfo.includes("sameorigin")) return { embedUrl: null, embeddable: false };
    const fa = /frame-ancestors([^;]*)/i.exec(res.headers.get("content-security-policy") || "");
    if (fa) {
      const v = fa[1].toLowerCase();
      if (!v.includes("*") && !v.includes("lefcenter.com")) return { embedUrl: null, embeddable: false };
    }
    return { embedUrl: url, embeddable: true };
  } catch {
    // Sin respuesta a tiempo: se intenta mostrar (queda el enlace de respaldo).
    return { embedUrl: url, embeddable: true };
  }
}

export async function resolveEmbed(url: string): Promise<Embed> {
  if (/^https?:\/\/(www\.)?wordwall\.net\/([a-z]{2}\/)?resource\/\d+/i.test(url)) return wordwallEmbed(url);
  if (/^https:\/\/docs\.google\.com\/forms\//i.test(url)) {
    const u = new URL(url);
    u.searchParams.delete("usp");
    u.searchParams.set("embedded", "true");
    return { embedUrl: u.toString(), embeddable: true };
  }
  return frameCheck(url);
}

// Revisa una sola vez cada dirección distinta y le pega el resultado a cada adjunto.
export async function attachEmbeds(materials: { attachments: Record<string, unknown>[] }[]) {
  const urls = new Set<string>();
  materials.forEach((m) => m.attachments.forEach((a) => {
    if ((a.type === "link" || a.type === "form") && a.url) urls.add(String(a.url));
  }));
  const embeds = new Map<string, Embed>();
  await Promise.all([...urls].map(async (u) => { embeds.set(u, await resolveEmbed(u)); }));
  materials.forEach((m) => m.attachments.forEach((a) => {
    const e = a.url ? embeds.get(String(a.url)) : undefined;
    if (e) Object.assign(a, e);
  }));
}

export async function classroomGet(accessToken: string, path: string) {
  const res = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`classroom_api_${res.status}`);
  return res.json();
}

// Recorre todas las páginas de un listado (key = campo con la lista).
export async function classroomList(accessToken: string, path: string, key: string) {
  const out: Record<string, unknown>[] = [];
  let pageToken = "";
  do {
    const sep = path.includes("?") ? "&" : "?";
    const res = await classroomGet(accessToken, path + (pageToken ? `${sep}pageToken=${encodeURIComponent(pageToken)}` : ""));
    out.push(...((res[key] as Record<string, unknown>[]) || []));
    pageToken = (res.nextPageToken as string) || "";
  } while (pageToken);
  return out;
}

// "Luis  Caballero" → "LUIS CABALLERO" (sin tildes, mayúsculas, espacios simples)
export function norm(s: string) {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

// Nombre con el que se buscan las clases del profesor en Classroom: su
// classroom_match si el admin lo puso (p. ej. la cuenta de prueba), si no su
// nombre completo. Si la columna todavía no existe, cae al nombre.
export async function teacherMatchName(teacherId: string) {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const withMatch = await admin.from("teachers").select("full_name, classroom_match").eq("id", teacherId).maybeSingle();
  if (!withMatch.error) {
    const row = withMatch.data as { full_name?: string; classroom_match?: string | null } | null;
    return (row?.classroom_match || row?.full_name || "").trim();
  }
  const plain = await admin.from("teachers").select("full_name").eq("id", teacherId).maybeSingle();
  return ((plain.data as { full_name?: string } | null)?.full_name || "").trim();
}
