// LEF — trae cursos, temas y materiales (solo lectura) del profesor
// autenticado desde Google Classroom, usando su token guardado. Los tokens
// nunca llegan al navegador: todo el llamado a Google pasa por aquí.
// (Adjuntos, revisión de "se deja incrustar" y lectura de Classroom viven en
// ../_shared/classroom.ts, compartidos con student-classroom.)
import { getAllowedOrigins, corsFor, getTeacherAccessToken } from "../_shared/google-auth.ts";
import { attachEmbeds, classroomGet, classroomList, norm, shapeAttachment, teacherMatchName } from "../_shared/classroom.ts";

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
  const accessToken = auth.accessToken;

  try {
    const coursesRes = await classroomGet(accessToken, "courses?teacherId=me&courseStates=ACTIVE&pageSize=100");
    // Cada profesor ve solo las clases que llevan SU nombre ("LEVEL A2 - LUIS
    // CABALLERO"): así las clases nuevas de otros niveles se le suman solas, y
    // no se mezclan las de otros profesores ni las plantillas.
    const matchName = await teacherMatchName(auth.teacherId);
    const needle = norm(matchName);
    const courses = ((coursesRes.courses || []) as Record<string, unknown>[])
      .filter((c) => needle && norm(String(c.name || "")).includes(needle));

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

    // Una revisión por dirección distinta (se repiten mucho entre clases).
    await attachEmbeds(shaped.flatMap((c) => c.materials));

    return json(req, { connected: true, google_email: auth.googleEmail, match_name: matchName, courses: shaped });
  } catch {
    return json(req, { connected: true, error: "classroom_api_error" }, 502);
  }
});
