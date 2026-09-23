// LEF — genera las plantillas de correo de Supabase Auth con el diseño v2
// (supabase/functions/_shared/email-layout.ts → lefEmail), para que TODOS los
// correos automáticos se vean igual. Supabase no ejecuta código en sus
// plantillas: aquí se produce el HTML con las variables de Go ({{ .X }}) y se
// sube con apply-auth-templates.mjs (Management API).
//
// Uso (Node 24+, importa el .ts directo):
//   node supabase/templates/build-auth-templates.mjs
import { writeFileSync } from "node:fs";
import { lefEmail } from "../functions/_shared/email-layout.ts";

const GRAFITO = "#4d4d4d", PLATA = "#8c8c8c", INK = "#101010";
const hola = `<p style="margin:0 0 10px;color:${INK}">{{ if .Data.full_name }}Hola, {{ .Data.full_name }}:{{ else }}Hola:{{ end }}</p>`;

export const templates = {
  recovery: {
    subject: "Restablece tu contraseña de LEF",
    html: lefEmail({
      preheader: "Crea una contraseña nueva para entrar a LEF.",
      eyebrow: "Acceso a tu cuenta",
      heading: "Restablece tu contraseña",
      bodyHtml: `${hola}
<p style="margin:0 0 12px">Recibimos una solicitud para restablecer la contraseña de tu cuenta de LEF (<strong style="color:${INK};font-weight:600">{{ .Email }}</strong>).</p>
<p style="margin:0">Toca el botón para crear una contraseña nueva.</p>`,
      cta: { label: "Crear contraseña nueva", url: "{{ .ConfirmationURL }}" },
      afterCtaHtml: `<p style="margin:18px 0 0;font-size:13.5px;color:${PLATA}">El enlace vence en <strong style="color:${GRAFITO};font-weight:600">1 hora</strong> y solo se puede usar una vez. Si no pediste este cambio, ignora este correo: tu contraseña actual sigue funcionando.</p>`,
    }),
  },
  password_changed_notification: {
    subject: "Tu contraseña de LEF fue cambiada",
    html: lefEmail({
      preheader: "Aviso de seguridad de tu cuenta de LEF.",
      eyebrow: "Aviso de seguridad",
      heading: "Tu contraseña fue cambiada",
      bodyHtml: `${hola}
<p style="margin:0 0 12px">Te confirmamos que se cambió la contraseña de tu cuenta de LEF (<strong style="color:${INK};font-weight:600">{{ .Email }}</strong>).</p>
<p style="margin:0 0 12px">Si fuiste tú, no tienes que hacer nada más.</p>
<p style="margin:0"><strong style="color:${INK};font-weight:600">Si no fuiste tú</strong>, escríbenos de inmediato por WhatsApp o al correo de abajo para proteger tu cuenta.</p>`,
      cta: { label: "Entrar a LEF", url: "https://www.lefcenter.com/login" },
    }),
  },
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("build-auth-templates.mjs")) {
  for (const [name, t] of Object.entries(templates)) {
    writeFileSync(new URL(`./${name}.html`, import.meta.url), t.html);
    console.log(`${name}.html  (${t.html.length} bytes) — asunto: ${t.subject}`);
  }
}
