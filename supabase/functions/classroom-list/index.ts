// LEF — trae cursos, temas y materiales (solo lectura) del profesor
// autenticado desde Google Classroom, usando su token guardado. Los tokens
// nunca llegan al navegador: todo el llamado a Google pasa por aquí.
import { getAllowedOrigins, corsFor, getTeacherAccessToken } from "../_shared/google-auth.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

// Cada courseWorkMaterial trae uno o más archivos adjuntos (Drive, YouTube,
// enlace o Form). La API de Classroom ya da el id/URL de cada uno — no hace
// falta pedir acceso a Drive para saber qué embeber.
function shapeAttachment(att: Record<string, unknown>) {
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

async function classroomGet(accessToken: string, path: string) {
  const res = await fetch(`https://classroom.googleapis.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`classroom_api_${res.status}`);
  return res.json();
}

// Recorre todas las páginas de un listado (key = campo con la lista).
async function classroomList(accessToken: string, path: string, key: string) {
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

Deno.serve(async (req) => {
  const allowed = getAllowedOrigins();
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req, allowed) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const auth = await getTeacherAccessToken(req);
  if (!auth.ok) {
    if (auth.error === "no_conectado" || auth.error === "reconectar") return json(req, { connected: false });
    return json(req, { error: auth.error }, auth.status);
  }
  const accessToken = auth.accessToken;

  try {
    const coursesRes = await classroomGet(accessToken, "courses?teacherId=me&courseStates=ACTIVE&pageSize=100");
    const courses = coursesRes.courses || [];

    const shaped = await Promise.all(courses.map(async (c: Record<string, unknown>) => {
      let topics: Record<string, unknown>[] = [];
      let materials: Record<string, unknown>[] = [];
      try {
        topics = await classroomList(accessToken, `courses/${c.id}/topics?pageSize=200`, "topic");
      } catch {
        // Curso sin temas creados todavía.
      }
      try {
        // Publicados Y borradores: LEF guarda las clases prearmadas como
        // borrador en Classroom (los estudiantes no las ven allá); los
        // profesores del curso sí pueden leerlas.
        materials = await classroomList(accessToken,
          `courses/${c.id}/courseWorkMaterials?pageSize=200&courseWorkMaterialStates=PUBLISHED&courseWorkMaterialStates=DRAFT`,
          "courseWorkMaterial");
      } catch {
        // Curso sin materiales todavía.
      }
      return {
        id: c.id,
        name: c.name,
        section: c.section || null,
        alternateLink: c.alternateLink,
        topics: topics.map((t) => ({ id: t.topicId, name: t.name })),
        materials: materials.map((m) => ({
          id: m.id, title: m.title, description: m.description || null, topicId: m.topicId || null,
          alternateLink: m.alternateLink, state: m.state, creationTime: m.creationTime,
          attachments: ((m.materials as Record<string, unknown>[]) || []).map(shapeAttachment),
        })),
      };
    }));

    return json(req, { connected: true, google_email: auth.googleEmail, courses: shaped });
  } catch {
    return json(req, { connected: true, error: "classroom_api_error" }, 502);
  }
});
