// LEF — plantilla visual de los correos automáticos (Resend).
// Tablas + estilos en línea: es lo único que Gmail/Outlook respetan.
// Logo e íconos se cargan desde el sitio (URL absoluta); si se reemplaza una
// imagen, cambiarle el nombre de archivo (caché de 1 año en /assets).
//
// Estilo (v2, 23 sep 2026): una sola tarjeta blanca con mucho aire, logo
// encima sobre el fondo, sin recuadros con borde; pie centrado fuera de la
// tarjeta con íconos de contacto. La v1 (bloques/bordes) se sentía "cuadriculada".

export const LEF_CONTACT = {
  site: "https://www.lefcenter.com",
  siteLabel: "www.lefcenter.com",
  logo: "https://www.lefcenter.com/assets/logo-horizontal.png",
  whatsappUrl: "https://wa.me/573173962244",
  whatsappLabel: "+57 317 396 2244",
  email: "informacion@lefcenter.com",
  instagramUrl: "https://instagram.com/Lefcenter",
  instagramLabel: "@Lefcenter",
  facebookUrl: "https://www.facebook.com/profile.php?id=100067494009346",
  icons: {
    whatsapp: "https://www.lefcenter.com/assets/icon-whatsapp-black.png",
    email: "https://www.lefcenter.com/assets/icon-email.png",
    instagram: "https://www.lefcenter.com/assets/icon-instagram.png",
    facebook: "https://www.lefcenter.com/assets/icon-facebook.png",
  },
};

export function escHtml(v: string) {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

const INK = "#101010", AZUL = "#2e4e9e", GRAFITO = "#4d4d4d", PLATA = "#8c8c8c", NIEBLA = "#e7e7e4";
const FONDO = "#f4f3ef", SUAVE = "#f7f6f2";
// Jost es la tipografía de la web; Apple Mail/iOS la cargan, Gmail usa el respaldo.
const FONT = "'Jost','Helvetica Neue',Helvetica,Arial,sans-serif";

// bodyHtml ya viene escapado por quien llama.
export function lefEmail(opts: {
  preheader: string; // texto que Gmail muestra junto al asunto
  eyebrow?: string; // rótulo pequeño sobre el título
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  afterCtaHtml?: string;
}) {
  const c = LEF_CONTACT;
  const cta = opts.cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 0"><tr>
<td style="background:${AZUL};border-radius:999px"><a href="${escHtml(opts.cta.url)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:15px;font-weight:600;letter-spacing:.3px;color:#ffffff;text-decoration:none;border-radius:999px">${escHtml(opts.cta.label)}&nbsp;&rarr;</a></td>
</tr></table>`
    : "";
  const icon = (href: string, src: string, alt: string) =>
    `<td style="padding:0 9px"><a href="${href}"><img src="${src}" width="26" height="26" alt="${alt}" style="display:block;width:26px;height:26px;border:0"></a></td>`;

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<link href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap" rel="stylesheet">
<title>${escHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${FONDO};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escHtml(opts.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${FONDO}"><tr><td align="center" style="padding:40px 16px 32px">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:540px">
<tr><td align="center" style="padding:0 0 28px">
<a href="${c.site}"><img src="${c.logo}" width="190" alt="LEF — Learn English Fluently" style="display:block;width:190px;max-width:65%;height:auto;border:0"></a>
</td></tr>

<tr><td style="background:#ffffff;border-radius:18px;padding:44px 44px 36px;font-family:${FONT};font-size:15.5px;line-height:1.65;color:${GRAFITO}">
${opts.eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:${AZUL}">${escHtml(opts.eyebrow)}</p>` : ""}
<h1 style="margin:0 0 22px;font-family:${FONT};font-size:27px;line-height:1.25;font-weight:700;letter-spacing:-.4px;color:${INK}">${escHtml(opts.heading)}</h1>
${opts.bodyHtml}
${cta}
${opts.afterCtaHtml ?? ""}
<p style="margin:36px 0 0;padding-top:22px;border-top:1px solid ${NIEBLA};font-family:${FONT};font-size:12.5px;line-height:1.6;color:${PLATA}">
<strong style="color:${GRAFITO};font-weight:600">Este es un mensaje automático, por favor no lo respondas.</strong><br>
Nadie revisa las respuestas a este correo. Si necesitas ayuda, usa los medios de contacto de abajo.
</p>
</td></tr>

<tr><td align="center" style="padding:32px 12px 0;font-family:${FONT};font-size:13px;line-height:1.7;color:${PLATA}">
<p style="margin:0 0 14px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:.3px;color:${GRAFITO}">¿Necesitas ayuda? Estamos para ti</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px"><tr>
${icon(c.whatsappUrl, c.icons.whatsapp, "WhatsApp")}${icon(`mailto:${c.email}`, c.icons.email, "Correo")}${icon(c.instagramUrl, c.icons.instagram, "Instagram")}${icon(c.facebookUrl, c.icons.facebook, "Facebook")}
</tr></table>
<a href="${c.whatsappUrl}" style="color:${GRAFITO};text-decoration:none">WhatsApp ${c.whatsappLabel}</a>
&nbsp;&middot;&nbsp; <a href="mailto:${c.email}" style="color:${GRAFITO};text-decoration:none">${c.email}</a><br>
<a href="${c.site}" style="color:${AZUL};text-decoration:none;font-weight:600">${c.siteLabel}</a>
<p style="margin:18px 0 0;font-family:${FONT};font-size:11.5px;letter-spacing:.4px;color:#b0b0ab">LEF &middot; Learn English Fluently</p>
</td></tr>
</table>

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
  const label = (t: string) =>
    `<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">${t}</p>`;
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 26px">${intro}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:22px 26px">
${label("Usuario")}
<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;font-weight:500;color:${INK};word-break:break-all">${escHtml(to)}</p>
${label("Contraseña temporal")}
<p style="margin:0;font-family:'SF Mono',Consolas,Menlo,monospace;font-size:21px;font-weight:700;letter-spacing:1.5px;color:${INK}">${escHtml(password)}</p>
</td></tr></table>`;
  const html = lefEmail({
    preheader: kind === "new" ? "Tus datos para entrar a la plataforma de LEF." : "Tus nuevos datos para entrar a LEF.",
    eyebrow: kind === "new" ? "Tu cuenta" : "Acceso a tu cuenta",
    heading, bodyHtml, cta: { label: "Entrar a LEF", url: loginUrl },
    afterCtaHtml: `<p style="margin:18px 0 0;font-size:13.5px;color:${PLATA}">Por seguridad, cambia esta contraseña al entrar, desde <strong style="color:${GRAFITO};font-weight:600">Mi cuenta</strong>.</p>`,
  });
  const text = `${hi}\n\n${intro}\n\nUsuario: ${to}\nContraseña temporal: ${password}\n\nEntra en: ${loginUrl}\n\n` +
    `Por seguridad, cambia esta contraseña al entrar, desde Mi cuenta.` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// Pie en texto plano (clientes que no muestran HTML).
export const LEF_TEXT_FOOTER =
  `\n\n—\nEste es un mensaje automático, por favor no lo respondas: nadie revisa las respuestas a este correo.\n` +
  `¿Necesitas ayuda? WhatsApp ${LEF_CONTACT.whatsappLabel} · ${LEF_CONTACT.email} · Instagram ${LEF_CONTACT.instagramLabel}\n` +
  `${LEF_CONTACT.site}`;
