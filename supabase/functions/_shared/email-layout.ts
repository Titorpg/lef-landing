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

// --- Clases canceladas y reposiciones (notify-class-change, 24 sep 2026) ---
// Un día marcado "Sin clase" y la reposición que programa el profesor se
// avisan a cada estudiante del grupo, con tono formal y disculpa de LEF.
type ClassInfo = {
  name: string;          // nombre del estudiante
  module: string;        // "A2.1 — Real Life"
  teacher: string;
  classDate: string;     // "martes 29 de septiembre"
  classTime: string;     // "6:00 p. m."
};

function reasonBox(reason: string, details: string) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:18px 22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">Motivo</p>
<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:600;color:${INK}">${escHtml(reason)}</p>
${details ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:14.5px;color:${GRAFITO};white-space:pre-line">${escHtml(details)}</p>` : ""}
</td></tr></table>`;
}

// Varios días (p. ej. semana de receso): un solo correo con todas las fechas (plural).
export function classCancelledEmail(c: ClassInfo & { reason: string; details: string; plural?: boolean }, portalUrl: string) {
  const subject = `Información sobre ${c.plural ? "tus clases" : `tu clase del ${c.classDate}`} — ${c.module.split(" — ")[0]}`;
  const heading = "Novedad en tu calendario de clases";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">Te escribimos para avisarte que ${c.plural ? "tus clases" : "tu clase"} de <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong> del <strong style="color:${INK};font-weight:600">${escHtml(c.classDate)}</strong>${c.classTime ? ` a las <strong style="color:${INK};font-weight:600">${escHtml(c.classTime)}</strong>` : ""} no se ${c.plural ? "van" : "va"} a realizar.</p>
${reasonBox(c.reason, c.details)}
<p style="margin:0 0 14px">Lamentamos mucho los inconvenientes que esto te pueda causar. En LEF cuidamos que no pierdas ninguna clase: ${c.teacher ? `tu profesor(a) <strong style="color:${INK};font-weight:600">${escHtml(c.teacher)}</strong>` : "tu profesor(a)"} se pondrá en contacto contigo para acordar ${c.plural ? "las fechas en que recuperarán estas clases" : "la fecha en que recuperarán esta clase"}.</p>
<p style="margin:0">Cuando ${c.plural ? "queden programadas" : "quede programada"}, te avisaremos por este medio y la verás también en el calendario de tu portal.</p>`;
  const html = lefEmail({
    preheader: `${c.plural ? "Tus clases" : "Tu clase"} del ${c.classDate} no se ${c.plural ? "realizarán" : "realizará"}. Motivo: ${c.reason}.`,
    eyebrow: "Información académica", heading, bodyHtml, cta: { label: "Ver mi calendario", url: portalUrl + "#calendario" },
  });
  const text = `${hi}\n\n${c.plural ? "Tus clases" : "Tu clase"} de ${c.module} del ${c.classDate}${c.classTime ? ` a las ${c.classTime}` : ""} no se ${c.plural ? "van" : "va"} a realizar.\n\n` +
    `Motivo: ${c.reason}${c.details ? `\n${c.details}` : ""}\n\nLamentamos mucho los inconvenientes. ${c.teacher ? `Tu profesor(a) ${c.teacher}` : "Tu profesor(a)"} ` +
    `se pondrá en contacto contigo para acordar la fecha en que recuperarán esta clase. Cuando quede programada, te avisaremos ` +
    `y la verás en el calendario de tu portal: ${portalUrl}#calendario` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// Pausa del ciclo de un grupo (29 sep 2026; tono ajustado el 30 sep a pedido del
// cliente): informativo y académico, sin resaltarlo como algo negativo ni hablar de
// correr el calendario. Solo: esos días no hay sesiones, el motivo y cuándo retoman.
export function classPausedEmail(c: ClassInfo & { reason: string; details: string; fromDate: string; toDate: string;
  resumeDate: string }, portalUrl: string) {
  const range = c.fromDate === c.toDate ? `el ${c.fromDate}` : `del ${c.fromDate} al ${c.toDate}`;
  const subject = `Información sobre tu calendario de clases — ${c.module.split(" — ")[0]}`;
  const heading = "Novedad en tu calendario de clases";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const resumeSub = [c.classTime, c.teacher ? "con tu profesor(a) " + c.teacher : ""].filter(Boolean).join(" · ");
  const resumeBox = c.resumeDate ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:18px 22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">Retomamos</p>
<p style="margin:0;font-family:${FONT};font-size:18px;font-weight:700;color:${INK}">${escHtml(c.resumeDate)}</p>
${resumeSub ? `<p style="margin:4px 0 0;font-family:${FONT};font-size:15px;color:${GRAFITO}">${escHtml(resumeSub)}</p>` : ""}
</td></tr></table>` : "";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">Te informamos que ${escHtml(range)} no habrá sesiones de tu grupo de <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong>.</p>
${reasonBox(c.reason, c.details)}
${resumeBox}
<p style="margin:0">Las clases continúan en el punto del programa donde quedamos. Puedes consultar tu calendario en el portal.</p>`;
  const html = lefEmail({
    preheader: `${range.charAt(0).toUpperCase() + range.slice(1)} no habrá sesiones de tu grupo. Motivo: ${c.reason}.`,
    eyebrow: "Información académica", heading, bodyHtml, cta: { label: "Ver mi calendario", url: portalUrl + "#calendario" },
  });
  const text = `${hi}\n\nTe informamos que ${range} no habrá sesiones de tu grupo de ${c.module}.\n\n` +
    `Motivo: ${c.reason}${c.details ? `\n${c.details}` : ""}\n\n` +
    (c.resumeDate ? `Retomamos el ${c.resumeDate}${c.classTime ? `, a las ${c.classTime}` : ""}${c.teacher ? `, con tu profesor(a) ${c.teacher}` : ""}. ` : "") +
    `Las clases continúan en el punto del programa donde quedamos. Puedes consultar tu calendario en el portal: ${portalUrl}#calendario` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// --- Cambios de un aviso ya enviado (remove-class-event, 29 sep 2026) ---
// Pedido del usuario: siempre empiezan con una disculpa.
// Se borró una reposición: la clase queda otra vez por reprogramar.
export function classMakeupCancelledEmail(c: ClassInfo & { makeupDate: string; makeupTime: string }, portalUrl: string) {
  const subject = `Cambio en la reposición de tu clase — ${c.module.split(" — ")[0]}`;
  const heading = "Hubo un cambio en tu reposición";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">Lo sentimos mucho: hay un cambio en la reposición de tu clase de <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong>. La reposición del <strong style="color:${INK};font-weight:600">${escHtml(c.makeupDate)}</strong>${c.makeupTime ? ` ${escHtml(c.makeupTime)}` : ""}, con la que recuperábamos la clase del ${escHtml(c.classDate)}, <strong style="color:${INK};font-weight:600">ya no se realizará</strong>.</p>
<p style="margin:0 0 14px">Te pedimos disculpas por el cambio. ${c.teacher ? `Tu profesor(a) <strong style="color:${INK};font-weight:600">${escHtml(c.teacher)}</strong>` : "Tu profesor(a)"} acordará contigo una nueva fecha para recuperar esa clase.</p>
<p style="margin:0">Cuando quede programada, te avisaremos por este medio y la verás en el calendario de tu portal.</p>`;
  const html = lefEmail({
    preheader: `Lo sentimos: la reposición del ${c.makeupDate} ya no se realizará. Te avisaremos la nueva fecha.`,
    eyebrow: "Cambio en tu reposición", heading, bodyHtml, cta: { label: "Ver mi calendario", url: portalUrl + "#calendario" },
  });
  const text = `${hi}\n\nLo sentimos mucho: hay un cambio en la reposición de tu clase de ${c.module}. La reposición del ` +
    `${c.makeupDate}${c.makeupTime ? ` ${c.makeupTime}` : ""}, con la que recuperábamos la clase del ${c.classDate}, ya no se realizará.\n\n` +
    `Te pedimos disculpas por el cambio. ${c.teacher ? `Tu profesor(a) ${c.teacher}` : "Tu profesor(a)"} acordará contigo una nueva fecha ` +
    `para recuperar esa clase. Cuando quede programada, te avisaremos y la verás en tu calendario: ${portalUrl}#calendario` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// Se borró un "Sin clase" (o la pausa del ciclo): las clases de esos días sí se dictan.
export function classRestoredEmail(c: ClassInfo & { plural?: boolean; pause?: boolean; droppedMakeups?: string[] }, portalUrl: string) {
  const what = c.pause ? "la pausa de tus clases" : "tu día sin clases";
  const subject = (c.pause ? "Cambio en la pausa: tus clases sí se realizarán"
    : c.plural ? "Cambio: tus clases sí se realizarán" : `Cambio: tu clase del ${c.classDate} sí se realizará`) + ` — ${c.module.split(" — ")[0]}`;
  const heading = c.plural ? "Tus clases sí se realizarán" : "Tu clase sí se realizará";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const dropped = (c.droppedMakeups || []).length
    ? `<p style="margin:0 0 14px">Por eso, ${c.droppedMakeups!.length === 1 ? `la reposición que estaba programada para el <strong style="color:${INK};font-weight:600">${escHtml(c.droppedMakeups![0])}</strong> queda cancelada` : `las reposiciones que estaban programadas (${escHtml(c.droppedMakeups!.join("; "))}) quedan canceladas`}: ya no hace falta recuperar ${c.plural ? "esas clases" : "esa clase"}.</p>`
    : "";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">Lo sentimos mucho: hay un cambio en ${what}. ${c.plural ? "Tus clases" : "Tu clase"} de <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong> del <strong style="color:${INK};font-weight:600">${escHtml(c.classDate)}</strong> <strong style="color:${INK};font-weight:600">sí se ${c.plural ? "van" : "va"} a realizar</strong>, en tu horario normal${c.classTime ? ` de las ${escHtml(c.classTime)}` : ""}.</p>
${dropped}
<p style="margin:0">Te pedimos disculpas por el cambio. En el calendario de tu portal ya aparecen tus clases actualizadas${c.teacher ? `, con tu profesor(a) ${escHtml(c.teacher)}` : ""}.</p>`;
  const html = lefEmail({
    preheader: `Lo sentimos: hubo un cambio. ${c.plural ? "Tus clases" : "Tu clase"} del ${c.classDate} sí se ${c.plural ? "realizarán" : "realizará"}.`,
    eyebrow: c.pause ? "Cambio en la pausa de tus clases" : "Cambio en tu día sin clases", heading, bodyHtml,
    cta: { label: "Ver mi calendario", url: portalUrl + "#calendario" },
  });
  const text = `${hi}\n\nLo sentimos mucho: hay un cambio en ${what}. ${c.plural ? "Tus clases" : "Tu clase"} de ${c.module} del ${c.classDate} ` +
    `sí se ${c.plural ? "van" : "va"} a realizar, en tu horario normal${c.classTime ? ` de las ${c.classTime}` : ""}.\n\n` +
    ((c.droppedMakeups || []).length ? `Por eso, ${c.droppedMakeups!.length === 1 ? `la reposición del ${c.droppedMakeups![0]} queda cancelada` : `las reposiciones programadas (${c.droppedMakeups!.join("; ")}) quedan canceladas`}.\n\n` : "") +
    `Te pedimos disculpas por el cambio. En tu calendario ya aparecen tus clases actualizadas: ${portalUrl}#calendario` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

export function classMakeupEmail(c: ClassInfo & { makeupDate: string; makeupTime: string; holiday?: string }, portalUrl: string) {
  // Clase que cayó en festivo: "que no hubo el lunes 12 de octubre por el festivo (…)".
  const why = c.holiday ? `que no hubo el ${c.classDate} por el festivo (${c.holiday})` : `que no se realizó el ${c.classDate}`;
  const subject = `Tu clase se recuperará el ${c.makeupDate} — ${c.module.split(" — ")[0]}`;
  const heading = `Recuperamos tu clase el ${c.makeupDate}`;
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">La clase de <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong> ${escHtml(why)} ya tiene nueva fecha:</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:18px 22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">Nueva fecha</p>
<p style="margin:0;font-family:${FONT};font-size:18px;font-weight:700;color:${INK}">${escHtml(c.makeupDate)}</p>
<p style="margin:4px 0 0;font-family:${FONT};font-size:15px;color:${GRAFITO}">${escHtml(c.makeupTime)}${c.teacher ? ` · con tu profesor(a) ${escHtml(c.teacher)}` : ""}</p>
</td></tr></table>
<p style="margin:0">Ese día entra a tu portal, en <strong style="color:${INK};font-weight:600">Mi curso → Clase de hoy</strong>: la agenda y el botón para unirte a la reunión se habilitan 10 minutos antes de la hora de la clase.</p>`;
  const html = lefEmail({
    preheader: `Tu clase del ${c.classDate} se recuperará el ${c.makeupDate}, ${c.makeupTime}.`,
    eyebrow: "Reposición de clase", heading, bodyHtml, cta: { label: "Ir a Clase de hoy", url: portalUrl + "#clase-hoy" },
  });
  const text = `${hi}\n\nLa clase de ${c.module} ${why} se recuperará el ${c.makeupDate}, ${c.makeupTime}` +
    `${c.teacher ? ` con tu profesor(a) ${c.teacher}` : ""}.\n\nEse día entra a tu portal, en Mi curso → Clase de hoy: la agenda y el botón para unirte ` +
    `a la reunión se habilitan 10 minutos antes de la hora de la clase: ${portalUrl}#clase-hoy` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// --- Examen de validación (notify-exam-result, 27 sep 2026) ---
// Cuando el profesor da el OK al examen, se avisa que el resultado ya está en
// el tablón del portal (Inicio). El correo no trae la nota: la ve en LEF.
export function examResultEmail(c: { name: string; module: string; examTitle: string; teacher: string }, portalUrl: string) {
  const subject = `Ya está disponible el resultado de tu examen de validación — ${c.module}`;
  const heading = "Tu resultado ya está disponible";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">${c.teacher ? `Tu profesor(a) <strong style="color:${INK};font-weight:600">${escHtml(c.teacher)}</strong>` : "Tu profesor(a)"} ya revisó tu examen de validación del módulo <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:18px 22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">Dónde verlo</p>
<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:600;color:${INK}">En tu portal, en Inicio</p>
<p style="margin:6px 0 0;font-family:${FONT};font-size:14.5px;color:${GRAFITO}">Busca la novedad "Resultado de tu examen de validación". Ahí está tu resultado general y el de cada sección.</p>
</td></tr></table>
<p style="margin:0">Recuerda que este examen no afecta tu nota final ni define si pasas de nivel: es una herramienta para que veas tu progreso e identifiques qué puedes mejorar.</p>`;
  const html = lefEmail({
    preheader: `Tu profesor(a) revisó tu examen de validación de ${c.module}. Míralo en tu portal.`,
    eyebrow: "Examen de validación", heading, bodyHtml, cta: { label: "Ver mi resultado", url: portalUrl + "#inicio" },
  });
  const text = `${hi}\n\n${c.teacher ? `Tu profesor(a) ${c.teacher}` : "Tu profesor(a)"} ya revisó tu examen de validación del módulo ${c.module}.\n\n` +
    `Míralo en tu portal, en Inicio: busca la novedad "Resultado de tu examen de validación". ${portalUrl}#inicio\n\n` +
    `Recuerda que este examen no afecta tu nota final ni define si pasas de nivel.` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}

// Informe de progreso (1 oct 2026): va adjunto en PDF y también queda en el Inicio.
export function progressReportEmail(c: { name: string; module: string; teacher: string; until: string }, portalUrl: string) {
  const subject = `Tu informe de progreso del módulo ${c.module}`;
  const heading = "Tu informe de progreso está listo";
  const hi = c.name ? `Hola, ${c.name}:` : "Hola:";
  const who = c.teacher ? `Tu profesor(a) <strong style="color:${INK};font-weight:600">${escHtml(c.teacher)}</strong>` : "Tu profesor(a)";
  const bodyHtml = `<p style="margin:0 0 10px;color:${INK}">${escHtml(hi)}</p>
<p style="margin:0 0 22px">${who} completó tu informe de progreso del módulo <strong style="color:${INK};font-weight:600">${escHtml(c.module)}</strong>: cómo vas en cada habilidad, sus observaciones y metas para tu siguiente ciclo.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>
<td style="background:${SUAVE};border-radius:14px;padding:18px 22px">
<p style="margin:0 0 4px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;color:${PLATA}">Dónde verlo</p>
<p style="margin:0;font-family:${FONT};font-size:16px;font-weight:600;color:${INK}">Va adjunto a este correo en PDF</p>
<p style="margin:6px 0 0;font-family:${FONT};font-size:14.5px;color:${GRAFITO}">También lo puedes descargar en tu portal, en Inicio, en la novedad "Tu informe de progreso"${c.until ? ` (disponible hasta el ${escHtml(c.until)})` : ""}.</p>
</td></tr></table>
<p style="margin:0">Léelo con calma: es una guía para que sepas qué estás haciendo bien y qué puedes reforzar.</p>`;
  const html = lefEmail({
    preheader: `Tu informe de progreso de ${c.module} va adjunto en PDF.`,
    eyebrow: "Informe de progreso", heading, bodyHtml, cta: { label: "Ver en mi portal", url: portalUrl + "#inicio" },
  });
  const text = `${hi}\n\n${c.teacher ? `Tu profesor(a) ${c.teacher}` : "Tu profesor(a)"} completó tu informe de progreso del módulo ${c.module}.\n\n` +
    `Va adjunto a este correo en PDF. También lo puedes descargar en tu portal, en Inicio: ${portalUrl}#inicio` + LEF_TEXT_FOOTER;
  return { subject, html, text };
}
