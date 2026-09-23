// LEF — plantilla visual de los correos automáticos (Resend).
// Tablas + estilos en línea: es lo único que Gmail/Outlook respetan.
// El logo se carga desde el sitio (URL absoluta); si se reemplaza la imagen,
// cambiarle el nombre de archivo (caché de 1 año en /assets).

export const LEF_CONTACT = {
  site: "https://www.lefcenter.com",
  logo: "https://www.lefcenter.com/assets/logo-horizontal.png",
  whatsappUrl: "https://wa.me/573173962244",
  whatsappLabel: "+57 317 396 2244",
  email: "informacion@lefcenter.com",
  instagramUrl: "https://instagram.com/Lefcenter",
  instagramLabel: "@Lefcenter",
  facebookUrl: "https://www.facebook.com/profile.php?id=100067494009346",
};

export function escHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const INK = "#101010", AZUL = "#2e4e9e", GRAFITO = "#4d4d4d", PLATA = "#8c8c8c", NIEBLA = "#e7e7e4", FONDO = "#f2f2ef";
const FONT = "Arial,Helvetica,sans-serif";

// bodyHtml ya viene escapado por quien llama.
export function lefEmail(opts: {
  preheader: string; // texto que Gmail muestra junto al asunto
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
}) {
  const c = LEF_CONTACT;
  const link = (href: string, label: string) =>
    `<a href="${escHtml(href)}" style="color:${AZUL};text-decoration:none">${escHtml(label)}</a>`;
  const cta = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px"><tr>
<td style="background:${AZUL};border-radius:6px"><a href="${escHtml(opts.cta.url)}" style="display:inline-block;padding:12px 26px;font-family:${FONT};font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none">${escHtml(opts.cta.label)}</a></td>
</tr></table>`
    : "";

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${FONDO}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${FONDO}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">

<tr><td style="padding:28px 32px 20px;border-bottom:3px solid ${AZUL}">
<a href="${c.site}"><img src="${c.logo}" width="200" alt="LEF — Learn English Fluently" style="display:block;width:200px;max-width:100%;height:auto;border:0"></a>
</td></tr>

<tr><td style="padding:28px 32px 8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${INK}">
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:21px;line-height:1.3;color:${INK}">${escHtml(opts.heading)}</h1>
${opts.bodyHtml}
${cta}
</td></tr>

<tr><td style="padding:16px 32px 28px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td style="background:#fff8e1;border-left:4px solid #e0b000;border-radius:4px;padding:12px 16px;font-family:${FONT};font-size:13.5px;line-height:1.5;color:${GRAFITO}">
<strong style="color:${INK}">Por favor no respondas este correo.</strong> Se envía automáticamente y nadie revisa las respuestas. Si necesitas ayuda, escríbenos por WhatsApp o al correo de abajo.
</td></tr></table>
</td></tr>

<tr><td style="background:${INK};padding:24px 32px;font-family:${FONT};font-size:13.5px;line-height:1.8;color:#ffffff">
<strong style="font-size:14px">¿Necesitas ayuda? Contáctanos</strong><br>
<span style="color:${PLATA}">WhatsApp:</span> <a href="${c.whatsappUrl}" style="color:#ffffff;text-decoration:none">${c.whatsappLabel}</a><br>
<span style="color:${PLATA}">Correo:</span> <a href="mailto:${c.email}" style="color:#ffffff;text-decoration:none">${c.email}</a><br>
<span style="color:${PLATA}">Instagram:</span> <a href="${c.instagramUrl}" style="color:#ffffff;text-decoration:none">${c.instagramLabel}</a>
&nbsp;·&nbsp; <a href="${c.facebookUrl}" style="color:#ffffff;text-decoration:none">Facebook</a><br>
<a href="${c.site}" style="color:#c9d6ec;text-decoration:none">www.lefcenter.com</a>
</td></tr>

</table>
<p style="margin:14px 0 0;font-family:${FONT};font-size:12px;color:${PLATA}">LEF · Learn English Fluently</p>
</td></tr></table>
</body></html>`;
}

// Correo de usuario + contraseña temporal (manage-users: crear cuenta / restablecer).
export function credentialsEmail(
  kind: "new" | "reset", to: string, name: string, password: string, loginUrl: string,
) {
  const subject = kind === "new" ? "Tu cuenta de LEF" : "Tu nueva contraseña de LEF";
  const heading = kind === "new" ? "Te damos la bienvenida a LEF" : "Restablecimos tu contraseña";
  const intro = kind === "new"
    ? "Ya tienes tu cuenta en la plataforma de LEF. Estos son tus datos para entrar:"
    : "Se restableció la contraseña de tu cuenta en la plataforma de LEF. Estos son tus nuevos datos para entrar:";
  const hi = name ? `Hola, ${name}:` : "Hola:";
  const row = (label: string, value: string) =>
    `<tr><td style="padding:10px 14px;border-bottom:1px solid #e7e7e4;color:#4d4d4d;font-size:13.5px;white-space:nowrap">${label}</td>` +
    `<td style="padding:10px 14px;border-bottom:1px solid #e7e7e4">${value}</td></tr>`;
  const bodyHtml = `<p style="margin:0 0 12px">${escHtml(hi)}</p>
<p style="margin:0 0 16px">${intro}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #e7e7e4;border-radius:6px;border-collapse:separate;background:#fafaf8">
${row("Usuario", `<strong style="word-break:break-all">${escHtml(to)}</strong>`)}
${row("Contraseña temporal", `<span style="font-family:Consolas,Menlo,monospace;font-size:17px;font-weight:bold;letter-spacing:1px">${escHtml(password)}</span>`)}
</table>
<p style="margin:16px 0 0">Por seguridad, cámbiala al entrar desde <strong>Mi cuenta</strong>.</p>`;
  const html = lefEmail({
    preheader: kind === "new" ? "Tus datos para entrar a la plataforma de LEF." : "Tus nuevos datos para entrar a LEF.",
    heading, bodyHtml, cta: { label: "Entrar a LEF", url: loginUrl },
  });
  const text = `${hi}\n\n${intro}\n\nUsuario: ${to}\nContraseña temporal: ${password}\n\nEntra en: ${loginUrl}\n\n` +
    `Por seguridad, cámbiala al entrar desde Mi cuenta.` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// Pie en texto plano (clientes que no muestran HTML).
export const LEF_TEXT_FOOTER =
  `\n\n—\nPor favor no respondas este correo: se envía automáticamente y nadie revisa las respuestas.\n` +
  `¿Necesitas ayuda? WhatsApp ${LEF_CONTACT.whatsappLabel} · ${LEF_CONTACT.email} · Instagram ${LEF_CONTACT.instagramLabel}\n` +
  `${LEF_CONTACT.site}`;
