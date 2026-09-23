// LEF — aplica UN archivo de migración SQL a la base de producción vía la
// Management API de Supabase (lee SUPABASE_ACCESS_TOKEN y SUPABASE_PROJECT_REF
// del .env). Lo corre el usuario: a Claude se le bloquea escribir en producción.
//
// Uso (desde la raíz del repo):
//   node --no-warnings scripts/apply-migration.mjs supabase/migrations/<archivo>.sql
import { readFileSync } from "node:fs";

try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch { /* ya viene en el entorno */ }
const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref } = process.env;
const file = process.argv[2];
if (!token || !ref) throw new Error("Falta SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF en .env");
if (!file || !file.endsWith(".sql")) throw new Error("Indica el archivo .sql de la migración");

const query = readFileSync(file, "utf8");
console.log(`Aplicando ${file} (${query.length} caracteres)…`);
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await r.text();
if (!r.ok) { console.error("ERROR", r.status, text.slice(0, 800)); process.exit(1); }
console.log("OK — migración aplicada.", text.length > 2 ? text.slice(0, 300) : "");
