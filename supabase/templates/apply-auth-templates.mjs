// LEF — sube a Supabase Auth (Management API) el SMTP de Resend, la URL del
// sitio y las plantillas de build-auth-templates.mjs. Lee de .env:
//   SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, RESEND_API_KEY
// Uso (desde la raíz del repo; lee el .env solo):
//   node --no-warnings supabase/templates/apply-auth-templates.mjs [--solo-plantillas]
import { templates } from "./build-auth-templates.mjs";

try { process.loadEnvFile(new URL("../../.env", import.meta.url)); } catch { /* ya viene en el entorno */ }

const { SUPABASE_ACCESS_TOKEN: token, SUPABASE_PROJECT_REF: ref, RESEND_API_KEY: resendKey } = process.env;
if (!token || !ref) throw new Error("Falta SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF");
const soloPlantillas = process.argv.includes("--solo-plantillas");

const body = {
  mailer_subjects_recovery: templates.recovery.subject,
  mailer_templates_recovery_content: templates.recovery.html,
  mailer_notifications_password_changed_enabled: true,
  mailer_subjects_password_changed_notification: templates.password_changed_notification.subject,
  mailer_templates_password_changed_notification_content: templates.password_changed_notification.html,
};
if (!soloPlantillas) {
  if (!resendKey) throw new Error("Falta RESEND_API_KEY");
  Object.assign(body, {
    site_url: "https://www.lefcenter.com",
    uri_allow_list: "https://www.lefcenter.com/**,https://lefcenter.com/**",
    smtp_admin_email: "no-responder@notificaciones.lefcenter.com",
    smtp_sender_name: "LEF",
    smtp_host: "smtp.resend.com",
    smtp_port: "465",
    smtp_user: "resend",
    smtp_pass: resendKey,
    rate_limit_email_sent: 30,
  });
}

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await r.json().catch(() => ({}));
if (!r.ok) { console.error("ERROR", r.status, JSON.stringify(j).slice(0, 500)); process.exit(1); }
const show = ["site_url", "uri_allow_list", "smtp_host", "smtp_port", "smtp_user", "smtp_admin_email", "smtp_sender_name",
  "rate_limit_email_sent", "mailer_subjects_recovery", "mailer_notifications_password_changed_enabled",
  "mailer_subjects_password_changed_notification", "security_captcha_enabled"];
for (const k of show) console.log(k, "=", j[k]);
console.log("smtp_pass configurada:", !!j.smtp_pass);
console.log("plantilla recovery LEF:", String(j.mailer_templates_recovery_content || "").includes("lefcenter.com/assets/logo"));
console.log("plantilla password_changed LEF:", String(j.mailer_templates_password_changed_notification_content || "").includes("lefcenter.com/assets/logo"));
