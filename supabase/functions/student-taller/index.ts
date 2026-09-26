// LEF — Talleres del estudiante (portal → Mis recursos → módulo → Talleres).
//
// Pedido del usuario (26 sep 2026): el taller lo ve solo quien pagó ese módulo
// y lo sigue viendo siempre, igual que el libro. Por eso el contenido NO está
// en el sitio público: vive aquí, junto a la función, y solo se entrega después
// de comprobar con get_my_course() (la misma regla de "Mis recursos") que el
// estudiante tiene ese módulo pagado.
//
// Para agregar un taller: su .json en ./talleres y una línea en TALLERES
// (clave "módulo/número": 1–4 = semanas, 5 = repaso del módulo). El portal
// muestra el taller como "Disponible" según su propia lista (RS_TALLER_FILES).
//
// Cuerpo: { module: "A1.1", n: 1 } → { taller } | { error }.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getAllowedOrigins, corsFor } from "../_shared/google-auth.ts";
import a11s1 from "./talleres/A1.1-semana-1.json" with { type: "json" };

const TALLERES: Record<string, unknown> = {
  "A1.1/1": a11s1,
};

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req, getAllowedOrigins()), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsFor(req, getAllowedOrigins()) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  let mod = "", n = 0;
  try { const b = await req.json(); mod = String(b?.module ?? ""); n = Number(b?.n) || 0; } catch { /* sin cuerpo */ }
  const taller = TALLERES[mod + "/" + n];
  if (!taller) return json(req, { error: "no_existe" }, 404);

  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: auth } = await asUser.auth.getUser();
  if (!auth?.user) return json(req, { error: "no_autenticado" }, 401);

  // Misma regla que "Mis recursos": alguna inscripción (no cancelada) de ese módulo, pagada.
  const { data: rows, error } = await asUser.rpc("get_my_course");
  if (error) return json(req, { error: "no_se_pudo_verificar" }, 500);
  // deno-lint-ignore no-explicit-any
  const paid = (rows as any[] || []).some((r) => r.module_level === mod && r.module_paid === true);
  if (!paid) return json(req, { error: "sin_pago" }, 403);

  return json(req, { taller });
});
