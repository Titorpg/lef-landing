/* LEF — Panel administrativo (SPA en JS plano).
   Auth con Supabase. Roles: admin (todo) · teacher (lectura de sus grupos).
   Secciones: Dashboard · Estudiantes · Pagos · Académico · Usuarios */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var ME = null;
  var TOKEN = null;

  /* ============ utilidades ============ */
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n, cur) {
    if (n == null) return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: cur || "COP", maximumFractionDigits: 0 }).format(n);
  }
  function date(s) {
    if (!s) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
  }
  var DAY_ES = { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié", Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom" };
  function days(arr) { return (arr || []).map(function (d) { return DAY_ES[d] || d; }).join(" "); }
  function time(t) { if (!t) return ""; var p = t.split(":"); var hh = +p[0]; return (hh % 12 || 12) + ":" + p[1] + (hh >= 12 ? "pm" : "am"); }
  var MONTHS_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  function ymd(y, m0, d) { return y + "-" + String(m0 + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }

  // Un color fijo por módulo (module_number 1..15; 13–15 = nivel C1). A1.1 = azul de marca.
  var MODULE_COLORS = ["#2e4e9e", "#4a86c5", "#5bb1a9", "#6f9d4a", "#b3a133", "#cf8b3b",
                       "#c15b4a", "#9a5aa3", "#5f6bd0", "#7d8794", "#3aa0a0", "#33415c",
                       "#b5476b", "#2c7a5a", "#8a6d3b"];
  function modColor(n) { return MODULE_COLORS[((n || 1) - 1) % MODULE_COLORS.length]; }

  // Precio fijo de la mensualidad de un módulo (mismo valor que lef_monthly_price() en la BD).
  var MONTHLY_PRICE = 297500;
  // Mensualidad al CREAR un cobro: fija, de solo lectura. Para un valor
  // distinto (descuento, beca…) se cambia después con Pagos → Editar.
  function fixedPriceField() {
    return field("Mensualidad (COP)", '<input type="text" readonly value="' +
      new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(MONTHLY_PRICE) +
      '" style="background:var(--papel);color:var(--grafito)">') +
      '<p class="pnl-sub" style="margin:-6px 0 12px;font-size:12.5px">Precio fijo de los módulos. Si este estudiante tiene un valor distinto, cámbialo después con <strong>Pagos → Editar</strong>.</p>';
  }
  var PAYST_ES = { approved: "Aprobado", pending: "Pendiente", declined: "Rechazado", refunded: "Reversado" };
  var METHOD_ES = { cash: "Efectivo", transfer: "Transferencia", pse: "PSE", card: "Tarjeta", other: "Otro" };
  var DOC_TYPES = ["TI", "CC", "CE", "PP"];
  var DOC_LABEL = { TI: "Tarjeta de identidad", CC: "Cédula de ciudadanía", CE: "Cédula de extranjería", PP: "Pasaporte" };
  function docSelect(name, val) {
    return '<select name="' + name + '">' + DOC_TYPES.map(function (k) {
      return '<option value="' + k + '"' + (k === val ? " selected" : "") + ">" + esc(DOC_LABEL[k]) + "</option>";
    }).join("") + "</select>";
  }
  var ROLE_ES = { admin: "Administrador", teacher: "Profesor", student: "Estudiante" };
  var ENROLL_STATUS = ["PendingPayment", "Active", "Cancelled"];
  // "Completed" no está en ENROLL_STATUS a propósito: un módulo se archiva como
  // completado al asignar el siguiente (admin_assign_module), no desde este select
  // genérico — de ahí no se puede "corregir" a mano sin crear el módulo siguiente.
  var ENROLL_ES = { PendingPayment: "Pendiente de pago", Active: "Activo", Completed: "Completado", Cancelled: "Cancelada" };

  // Política de contraseñas (la misma que exige Supabase → Authentication →
  // Passwords): mínimo 12, con minúscula, mayúscula, número y símbolo.
  var PW_HINT = "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo (por ejemplo ! @ # $ % * ? - _).";
  function checkPassword(pw) {
    pw = String(pw || "");
    if (pw.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return "La contraseña debe tener mayúsculas y minúsculas.";
    if (!/[0-9]/.test(pw)) return "La contraseña debe tener al menos un número.";
    if (!/[^A-Za-z0-9]/.test(pw)) return "La contraseña debe tener al menos un símbolo (por ejemplo ! @ # $ % * ? - _).";
    return "";
  }
  // Contraseña temporal que cumple la política (sin letras que se confunden: 0/O, 1/l/I).
  function genPassword() {
    var lo = "abcdefghijkmnpqrstuvwxyz", up = "ABCDEFGHJKLMNPQRSTUVWXYZ", di = "23456789", sy = "!@#$%*?-_";
    var all = lo + up + di + sy, rnd = new Uint32Array(14), out = [];
    (window.crypto || window.msCrypto).getRandomValues(rnd);
    [lo, up, di, sy].forEach(function (set, i) { out.push(set[rnd[i] % set.length]); });
    for (var i = 4; i < 14; i++) out.push(all[rnd[i] % all.length]);
    for (var j = out.length - 1; j > 0; j--) { var k = rnd[j] % (j + 1); var t = out[j]; out[j] = out[k]; out[k] = t; }
    return out.join("");
  }
  // Casilla "enviar también por correo" (manage-users → Resend). Es adicional:
  // la contraseña se sigue mostrando para compartirla por WhatsApp.
  function mailCheckbox() {
    return '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 8px">' +
      '<input type="checkbox" name="sm" style="width:auto" checked> Enviar también el usuario y la contraseña por correo</label>';
  }
  function wantsMail(box) { var c = box.querySelector("[name=sm]"); return !!(c && c.checked); }
  // Texto para el admin según lo que respondió manage-users.
  function mailOutcome(res) {
    if (!res || res.email_sent == null) return "";
    if (res.email_sent) return "Se enviaron los datos por correo.";
    return "El correo NO se pudo enviar (" + (res.email_error === "correo_no_configurado" ? "el envío de correos no está configurado" : res.email_error || "error desconocido") +
      "): compártelos por WhatsApp.";
  }
  function toastMail(base, res) {
    var m = mailOutcome(res);
    toast(base + (m ? " " + m : ""), res && res.email_sent === false ? "err" : "ok");
  }

  function toast(msg, kind) {
    var t = h('<div class="pnl-alert ' + (kind || "ok") + '" style="position:fixed;right:20px;bottom:20px;z-index:80;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15)">' + esc(msg) + "</div>");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4600);
  }
  function modal(title, bodyNode, onSave, saveLabel, danger, wide) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h('<div class="pnl-modal' + (wide ? " wide" : "") + '"><h3>' + esc(title) + "</h3></div>");
    box.appendChild(bodyNode);
    var err = h('<div class="pnl-alert err" style="display:none;white-space:pre-line"></div>');
    box.appendChild(err);
    var row = h('<div class="row"><button class="btn btn-ghost" data-x>Cancelar</button>' +
      '<button class="btn ' + (danger ? "btn-danger" : "btn-dark") + '" data-s>' + esc(saveLabel || "Guardar") + "</button></div>");
    box.appendChild(row);
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    row.querySelector("[data-x]").onclick = close;
    row.querySelector("[data-s]").onclick = function () {
      var btn = row.querySelector("[data-s]"); btn.disabled = true;
      Promise.resolve().then(onSave).then(function () { close(); }).catch(function (e) {
        err.textContent = friendly(e); err.style.display = "block"; btn.disabled = false;
      });
    };
    return { close: close };
  }
  function confirmDelete(title, message, onConfirm) {
    return modal(title, h('<p class="pnl-sub" style="margin-bottom:4px">' + esc(message) + "</p>"), onConfirm, "Eliminar", true);
  }
  // Como reversarPago: pide un motivo obligatorio antes de una acción irreversible
  // sobre facturación (queda anotado en el Registro de eventos).
  function promptReason(title, message, saveLabel, onConfirm) {
    var b = h("<div>" +
      (message ? '<p class="pnl-sub" style="margin-bottom:10px">' + message + "</p>" : "") +
      field("Motivo (obligatorio, queda en el Registro de eventos)", '<input name="reason" placeholder="Ej.: pago de prueba, dato duplicado, error de captura">') +
      "</div>");
    return modal(title, b, function () {
      var reason = (b.querySelector("[name=reason]").value || "").trim();
      if (reason.length < 3) throw new Error("Escribe el motivo.");
      return onConfirm(reason);
    }, saveLabel || "Confirmar", true);
  }
  function field(label, inputHtml) { return '<label class="fld"><span>' + esc(label) + "</span>" + inputHtml + "</label>"; }
  // Como field(), pero sin <label> envolvente: para controles que traen sus propios <label> adentro.
  function fieldBlock(label, innerHtml) { return '<div class="fld-block"><span class="fld-title">' + esc(label) + "</span>" + innerHtml + "</div>"; }
  function moduleSelect(name, mods, selectedId) {
    return '<select name="' + name + '">' + mods.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === selectedId ? " selected" : "") + ">" +
        esc(m.level + " · " + m.title) + "</option>";
    }).join("") + "</select>";
  }
  // Selector de módulo en forma de lista (en vez de <select>) para poder
  // marcar con una etiqueta verde los módulos que el estudiante ya completó.
  //   completed: { module_id: true }  — módulos ya cursados por el estudiante
  //   opts.lockCompleted: no se pueden elegir (Estudiantes → Editar)
  //   opts.suggestedId:   se marca con "Sugerido"
  //   opts.extra:         [{ value, label }] opciones al inicio (p. ej. "Sin módulo")
  function modulePicker(name, mods, selectedId, completed, opts) {
    opts = opts || {};
    completed = completed || {};
    var rows = (opts.extra || []).map(function (x) {
      return '<label class="mod-pick__row mod-pick__row--extra"><input type="radio" name="' + name + '" value="' + esc(x.value) + '"' +
        (x.value === selectedId ? " checked" : "") + "><span>" + esc(x.label) + "</span></label>";
    });
    mods.forEach(function (m) {
      var done = !!completed[m.id];
      var locked = done && opts.lockCompleted;
      rows.push('<label class="mod-pick__row' + (done ? " is-done" : "") + (locked ? " is-locked" : "") + '">' +
        '<input type="radio" name="' + name + '" value="' + m.id + '"' +
        (m.id === selectedId && !locked ? " checked" : "") + (locked ? " disabled" : "") + ">" +
        '<span class="mod-pick__dot" style="background:' + modColor(m.module_number) + '"></span>' +
        '<span class="mod-pick__lbl">' + esc(m.level + " · " + m.title) + "</span>" +
        (done ? '<span class="mod-pick__done">✓ Completado</span>' : "") +
        (!done && m.id === opts.suggestedId ? '<span class="mod-pick__sug">Sugerido</span>' : "") +
        "</label>");
    });
    return '<div class="mod-pick">' + rows.join("") + "</div>";
  }
  function pickedValue(box, name) {
    var el = box.querySelector("[name=" + name + "]:checked");
    return el ? el.value : "";
  }
  // Siguiente módulo sugerido: el primero (activo) por encima del más alto
  // que ya completó, saltando los que ya cursó. null si no ha completado ninguno.
  function suggestNextModule(mods, completed, modById) {
    var maxDone = 0;
    Object.keys(completed || {}).forEach(function (id) {
      var m = modById[id];
      if (m && m.module_number > maxDone) maxDone = m.module_number;
    });
    if (!maxDone) return null;
    var next = mods.filter(function (m) { return m.module_number > maxDone && !completed[m.id]; })[0];
    return next ? next.id : null;
  }
  var BLOCK_TABLE_ES = {
    enrollments: "inscripciones", payments: "pagos", subscriptions: "suscripciones",
    groups: "grupos", schedules: "horarios", students: "estudiantes", teachers: "profesores"
  };
  var CODE_ES = {
    LEF_PAYMENT_INMUTABLE: "Un pago registrado no se edita ni se borra. Usa “Reversar” para corregirlo.",
    LEF_SUBSCRIPTION_ALREADY_PAID: "Esta mensualidad ya está completa. Si necesitas corregir algo, edita o reversa un pago existente desde “Ver pagos”.",
    LEF_ALREADY_REVERSED: "Ese pago ya tiene un reverso registrado.",
    LEF_PAYMENT_NOT_FOUND: "No se encontró el pago.",
    LEF_STUDENT_NOT_FOUND: "No se encontró el estudiante.",
    LEF_INVALID_DOC_TYPE: "Tipo de documento inválido.",
    LEF_MISSING_FIELDS: "Faltan datos obligatorios (nombre, documento, WhatsApp o correo).",
    "LEF_DUPLICATE_REGISTRATION": "Ya existe una inscripción con ese correo, WhatsApp o documento en el ciclo actual.",
    LEF_CYCLE_CLOSED: "No hay un ciclo abierto para ese horario. Abre el ciclo en Académico o elige “sin horario por ahora”.",
    LEF_NO_AVAILABLE_GROUP: "Ese horario ya no tiene cupo. Elige otro horario o déjalo sin horario por ahora.",
    LEF_INVALID_MODULE: "El módulo elegido no está activo.",
    LEF_ALREADY_CONVERTED: "Esta solicitud ya fue convertida en estudiante.",
    LEF_PREINSCRIPCION_NOT_FOUND: "No se encontró la solicitud.",
    LEF_REQUIRES_ADMIN: "Solo un administrador puede hacer esto.",
    LEF_REASON_REQUIRED: "Escribe el motivo — queda anotado en el Registro de eventos.",
    LEF_GROUP_FULL: "Ese grupo ya está lleno.",
    LEF_GROUP_INACTIVE: "Ese grupo está desactivado.",
    LEF_MODULE_MISMATCH: "El estudiante y el grupo no son del mismo módulo.",
    LEF_ENROLLMENT_NOT_FOUND: "No se encontró la inscripción.",
    LEF_ENROLLMENT_CANCELLED: "Esa inscripción está cancelada.",
    LEF_GROUP_NOT_FOUND: "No se encontró el grupo.",
    LEF_MODULE_ALREADY_COMPLETED: "Ese estudiante ya completó ese módulo — no se puede volver a matricular. Elige otro.",
    LEF_ENROLLMENT_NOT_ACTIVE: "Ese módulo todavía no se ha pagado, así que no se puede marcar como completado. Usa “cancelar la inscripción”.",
    groups_one_per_schedule: "Ese horario ya tiene un grupo con profesor asignado. Elige otro horario, o crea uno nuevo en la pestaña Horarios.",
    LEF_TEACHER_SCHEDULE_CONFLICT: "Ese profesor ya tiene otro grupo que se cruza con ese horario (mismos días y horas, en ciclos que coinciden). Cambia el horario o el profesor.",
    LEF_ENROLLMENT_NEEDS_PAYMENT: "Esa inscripción no tiene ningún pago registrado, así que no puede quedar “Activo”. Se activa sola al registrar el primer pago (en Pagos).",
    LEF_CYCLE_NOT_FOUND:"No se encontró el ciclo (quizás ya se cerró).",
    no_autenticado: "Tu sesión expiró. Vuelve a iniciar sesión.",
    url_invalida: "Esa imagen no es válida.",
    ultimo_admin: "No puedes quitar el rol, desactivar ni eliminar al último administrador activo. Crea o activa otro admin primero.",
    email_invalido: "El correo no es válido.",
    correo_en_uso: "Ese correo ya está asociado a otra cuenta. Cada cuenta debe tener un correo distinto: usa otro correo o revisa la cuenta existente en Usuarios.",
    correo_en_profesor: "Ya hay un profesor registrado con ese correo (aparece en Usuarios como “sin cuenta”). Usa el botón “Crear cuenta” de su fila, o elimínalo primero.",
    no_puedes_borrarte: "No puedes eliminar tu propia cuenta.",
    no_cambiar_tu_rol: "No puedes cambiar tu propio rol. Pídeselo a otro administrador.",
    requiere_2_pasos: "Tu sesión no pasó la verificación en 2 pasos. Cierra sesión y vuelve a entrar con el código de tu app.",
    no_resetear_tu_mfa: "No puedes restablecer tu propia verificación en 2 pasos. Pídeselo al otro administrador.",
    rol_estudiante_fijo: "Las cuentas de estudiante no cambian de rol.",
    rol_invalido: "Ese rol no es válido.",
    cuenta_no_encontrada: "No se encontró esa cuenta (quizás ya fue eliminada).",
    profesor_con_grupos: "No se puede pasar a Administrador: todavía tiene grupos asignados como profesor. Reasígnalos primero en Académico → Grupos.",
    requiere_admin: "Necesitas permisos de administrador para esta acción."
  };
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if ((e && e.code === "weak_password") || /weak_password|Password should|password is known to be weak|pwned/i.test(m)) {
      return /pwned|known to be weak|leaked/i.test(m)
        ? "Esa contraseña aparece en filtraciones públicas de internet. Elige otra distinta."
        : "La contraseña no cumple los requisitos: " + PW_HINT;
    }
    var key = Object.keys(CODE_ES).find(function (k) { return m.indexOf(k) === 0 || m.indexOf(k) > -1; });
    if (key) return CODE_ES[key];
    if (e && (e.code === "23503" || /foreign key|violates/i.test(m))) {
      var det = (e && e.details) || "";
      var tbl = (det.match(/from table "(\w+)"/) || [])[1];
      var label = BLOCK_TABLE_ES[tbl] || "otros registros";
      return "No se puede eliminar: tiene " + label + " asociados. Cámbialos, cancélalos o desactívalo primero.";
    }
    if (e && e.code === "23505") return "Ya existe un registro con ese dato (correo duplicado, por ejemplo).";
    return m;
  }
  function btn(label, cls, fn) { var b = h('<button class="btn btn-sm ' + cls + '">' + esc(label) + "</button>"); b.onclick = fn; return b; }

  /* ============ datos ============ */
  function q(table) { return sb.from(table); }
  function rpc(fn, args) { return sb.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function activeModules() {
    return q("modules").select("id,level,title,module_number").eq("active", true).order("module_number")
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  function callFn(body) {
    if (body && body.password != null) {
      var pwErr = checkPassword(body.password);
      if (pwErr) return Promise.reject(new Error(pwErr));
    }
    return fetch(window.LEF_SUPABASE.url + "/functions/v1/manage-users", {
      method: "POST",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async function (r) {
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      return j;
    });
  }
  function callEdgeFn(name, body) {
    return fetch(window.LEF_SUPABASE.url + "/functions/v1/" + name, {
      method: "POST",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(async function (r) {
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      return j;
    });
  }

  /* ============ auth ============ */
  function boot() {
    // El token se renueva solo (cada hora, o al verificar los 2 pasos): mantener
    // TOKEN al día para las llamadas a las Edge Functions.
    sb.auth.onAuthStateChange(function (ev, sess) { if (sess && sess.access_token) TOKEN = sess.access_token; });
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      if (!s) return (window.location.replace("login.html"));
      TOKEN = s.access_token;
      return q("profiles").select("*").eq("user_id", s.user.id).maybeSingle().then(function (p) {
        if (p.error || !p.data || !p.data.active) {
          return sb.auth.signOut().then(function () { window.location.replace("login.html"); });
        }
        if (!["admin", "teacher"].includes(p.data.role)) return (window.location.replace("portal.html"));
        ME = p.data;
        // Cierra los ciclos cuya fecha de fin ya pasó (libera estudiantes y
        // borra grupo → horario → ciclo). Lo hace también el cron nocturno;
        // esto es el respaldo por si el cron no corrió. Si falla, igual se abre el panel.
        function open() { return rpc("close_ended_cycles").catch(function () {}).then(renderShell); }
        function afterMfa() {
          // Verificar el código cambia el token (aal2): se toma el nuevo.
          return sb.auth.getSession().then(function (r2) {
            if (r2.data.session) TOKEN = r2.data.session.access_token;
            // Contraseña temporal puesta por un admin → primero crear una personal.
            if (window.LEFPrimerIngreso) return window.LEFPrimerIngreso.check(sb, ME, app, open);
            return open();
          });
        }
        // Verificación en 2 pasos (lef-mfa.js): obligatoria para administradores;
        // va antes del cambio de contraseña porque Supabase lo exige así.
        if (window.LEFMfa) return window.LEFMfa.gate(sb, app, ME.role === "admin", afterMfa);
        return afterMfa();
      });
    });
  }

  /* ============ shell ============ */
  var SECTIONS = [
    { id: "dashboard", label: "Dashboard", roles: ["admin", "teacher"] },
    { id: "estudiantes", label: "Estudiantes", roles: ["admin", "teacher"] },
    { id: "misgrupos", label: "Mis grupos", roles: ["teacher"] },
    { id: "recursos_clase", label: "Recursos de la clase", roles: ["teacher"] },
    { id: "classroom", label: "Planificador", roles: ["teacher"] },
    { id: "calendario", label: "Calendario", roles: ["teacher"] },
    { id: "pagos", label: "Pagos", roles: ["admin"] },
    { id: "novedades", label: "Novedades", roles: ["admin"] },
    { id: "academico", label: "Académico", roles: ["admin"] },
    { id: "usuarios", label: "Usuarios", roles: ["admin"] },
    { id: "registro", label: "Registro de eventos", roles: ["admin"] },
    { id: "micuenta", label: "Mi cuenta", roles: ["admin", "teacher"] }
  ];

  function renderShell() {
    app.innerHTML = "";
    var allowed = SECTIONS.filter(function (s) { return s.roles.includes(ME.role); });
    app.appendChild(h(
      '<div class="pnl-top">' +
      '<a class="brand" href="#dashboard"><img src="assets/logo-horizontal.png" alt="LEF"></a>' +
      '<div class="who">' +
      '<img src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none">' +
      '<span class="name-text">' + esc(ME.full_name || ME.email) + "</span> · " + esc(ROLE_ES[ME.role] || ME.role) +
      ' <button class="link" data-logout>Salir</button></div>' +
      "</div>"
    ));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"></nav><main class="pnl-main"></main></div>');
    var nav = wrap.querySelector(".pnl-nav");
    allowed.forEach(function (s) { nav.appendChild(h('<a href="#' + s.id + '">' + esc(s.label) + "</a>")); });
    app.appendChild(wrap);
    app.querySelector("[data-logout]").onclick = function () { sb.auth.signOut().then(boot); };

    window.onhashchange = route;
    var cur = location.hash.slice(1);
    if (cur === "inscripciones") { location.hash = "dashboard"; return; }
    if (!cur || !allowed.some(function (s) { return s.id === cur; })) location.hash = allowed[0].id;
    else route();
  }

  function route() {
    var id = location.hash.slice(1);
    if (id === "inscripciones") { location.hash = "dashboard"; return; }
    document.querySelectorAll(".pnl-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
    var main = document.querySelector(".pnl-main");
    if (!main) return;
    main.innerHTML = '<p class="muted">Cargando…</p>';
    var fn = ({
      dashboard: secDashboard, estudiantes: secEstudiantes, misgrupos: secMisGrupos,
      recursos_clase: secRecursosClase, classroom: secClassroom, calendario: secCalendario,
      pagos: secPagos, novedades: secNovedades, academico: secAcademico, usuarios: secUsuarios,
      registro: secRegistro, micuenta: secMiCuenta
    })[id];
    if (fn) fn(main); else main.innerHTML = "<p>Sección no encontrada.</p>";
  }

  function head(main, title, sub) {
    main.innerHTML = '<h1 class="pnl-h">' + esc(title) + "</h1>" +
      (sub ? '<p class="pnl-sub">' + esc(sub) + "</p>" : "");
  }
  // Todas las tablas del panel. En celular (CSS .m-cards, ≤780px) cada fila se
  // ve como TARJETA en vez de tabla deslizable: arriba el estado, luego el
  // título, los datos con su rótulo en 2 columnas (los largos a lo ancho) y
  // los botones abajo, 2 por fila. En PC sigue siendo tabla normal.
  // Cada fila se marca sola al agregarse según el encabezado de su columna.
  //   opt.title: índice de la columna que hace de título (por defecto 0).
  var MC_STATE = { "Estado": 1, "Acceso": 1 };
  var MC_FULL = { "Contacto": 1, "Correo": 1, "Detalle": 1, "Motivo": 1, "Descripción": 1, "Anotaciones": 1, "Pagador": 1 };
  function tableWrap(cols, opt) {
    opt = opt || {};
    var titleIdx = opt.title != null ? opt.title : 0;
    var w = h('<div class="pnl-table-wrap m-cards"><table class="pnl"><thead><tr>' +
      cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
      "</tr></thead><tbody></tbody></table></div>");
    var body = w.querySelector("tbody");
    function mark(tr) {
      if (!tr || tr.nodeType !== 1 || tr.tagName !== "TR" || tr.hasAttribute("data-mc")) return;
      tr.setAttribute("data-mc", "1");
      var col = 0;
      Array.prototype.forEach.call(tr.children, function (td) {
        var span = td.colSpan || 1, c = cols[col];
        if (span > 1) td.classList.add("mc-full");
        else if (col === titleIdx) td.classList.add("mc-title");
        else if (MC_STATE[c]) td.classList.add("mc-state");
        else if (c === "Acciones" || c === "") td.classList.add("mc-acts");
        else {
          if (c && !td.hasAttribute("data-label")) td.setAttribute("data-label", c);
          if (MC_FULL[c]) td.classList.add("mc-wide");
        }
        col += span;
      });
    }
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, mark); });
    }).observe(body, { childList: true });
    return { wrap: w, body: body };
  }
  function statRow(tiles) {
    return h('<div class="stat-row">' + tiles.map(function (t) {
      return '<div class="stat"><div class="k">' + esc(t[0]) + '</div><div class="v">' + t[1] + "</div></div>";
    }).join("") + "</div>");
  }

  /* ============ donut (SVG, sin librerías) ============ */
  function donut(modItems) {
    // modItems: [{n: module_number, label, value}] — TODOS los módulos activos
    var total = modItems.reduce(function (a, b) { return a + b.value; }, 0);
    var arcs = "";
    if (total) {
      var acc = 0;
      modItems.filter(function (m) { return m.value > 0; }).forEach(function (m) {
        var pct = m.value / total * 100;
        arcs += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + modColor(m.n) +
          '" stroke-width="5" stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) +
          '" stroke-dashoffset="' + (25 - acc).toFixed(2) + '"></circle>';
        acc += pct;
      });
    }
    var svg = '<svg viewBox="0 0 42 42" class="donut-svg" role="img" aria-label="Inscripciones por módulo">' +
      '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eee" stroke-width="5"></circle>' + arcs +
      '<text x="21" y="20.5" text-anchor="middle" class="donut-c1">' + total + "</text>" +
      '<text x="21" y="25" text-anchor="middle" class="donut-c2">inscritos</text></svg>';
    var legend = '<ul class="donut-legend">' + modItems.map(function (m) {
      var pct = total ? Math.round(m.value / total * 100) : 0;
      return '<li><span class="sw" style="background:' + modColor(m.n) + '"></span>' +
        '<span class="lb">' + esc(m.label) + '</span><span class="vl">' + m.value + " · " + pct + "%</span></li>";
    }).join("") + "</ul>";
    return h('<div class="donut-wrap">' + svg + legend + "</div>");
  }

  /* ============ DASHBOARD ============ */
  function secDashboard(main) {
    if (ME.role !== "admin") return secDashboardTeacher(main);
    var isAdmin = true;
    head(main, "Dashboard", "Resumen general del sistema.");

    var jobs = [
      q("enrollments").select("id,registration_number,status,created_at,module_id,students(full_name,whatsapp,email),modules(level,title,module_number),groups(schedules(days,start_time,end_time),teachers(full_name))").order("created_at", { ascending: false }),
      q("students").select("id", { count: "exact", head: true }),
      q("modules").select("id,level,title,module_number,active").order("module_number"),
      q("teachers").select("id", { count: "exact", head: true }).eq("active", true)
    ];
    if (isAdmin) {
      jobs.push(rpc("admin_billing_overview"));
      jobs.push(q("payments").select("amount,currency,method,status,paid_at,receipt_number,student_name,students(full_name)").order("paid_at", { ascending: false }).limit(8));
      jobs.push(q("preinscripciones").select("id", { count: "exact", head: true }).in("status", ["nuevo", "contactado"]));
    }

    Promise.all(jobs).then(function (res) {
      if (res[0].error) throw res[0].error;
      var enr = res[0].data || [];
      var studentCount = res[1].count || 0;
      var mods = res[2].data || [];
      var teacherCount = res[3].count || 0;
      var billing = isAdmin ? (res[4] || []) : [];
      var recentPays = isAdmin ? (res[5].data || []) : [];
      var preCount = isAdmin ? (res[6] && res[6].count) || 0 : 0;

      var activos = enr.filter(function (e) { return e.status !== "Cancelled" && e.status !== "Completed"; });
      var nuevas = enr.filter(function (e) { return e.status === "PendingPayment"; }).length;
      // "Pendiente" = suscripción activa sin ningún abono todavía; "pago parcial" = tiene
      // algo abonado pero no completa la mensualidad; "al día" = mensualidad completa.
      var pendientes = billing.filter(function (b) { return b.status === "active" && !(b.paid_amount > 0); }).length;
      var parciales = billing.filter(function (b) { return b.status === "active" && b.paid_amount > 0 && b.paid_amount < b.monthly_amount; }).length;
      var alDia = billing.filter(function (b) { return b.status === "active" && b.paid_amount >= b.monthly_amount; }).length;
      var congeladas = billing.filter(function (b) { return b.status === "frozen"; }).length;

      var tiles = [["Estudiantes", studentCount], ["Profesores", teacherCount],
        ["Inscripciones activas", activos.length], ["Inscripciones sin pago", nuevas]];
      if (isAdmin) {
        tiles.push(["Pre-inscritos", preCount]);
        tiles.push(["Pendientes", pendientes]); tiles.push(["Pago parcial", parciales]);
        tiles.push(["Al día", alDia]); tiles.push(["Congeladas", congeladas]);
      }
      main.appendChild(statRow(tiles));

      /* --- donut: TODOS los módulos activos, cada uno con su color --- */
      var countByMod = {};
      activos.forEach(function (e) { if (e.module_id) countByMod[e.module_id] = (countByMod[e.module_id] || 0) + 1; });
      var modItems = mods.filter(function (m) { return m.active || countByMod[m.id]; }).map(function (m) {
        return { n: m.module_number, label: m.level + " · " + m.title + (m.active ? "" : " (inactivo)"), value: countByMod[m.id] || 0 };
      });
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:26px 0 12px">Inscripciones por módulo</h2>'));
      main.appendChild(donut(modItems));

      /* --- estado módulos --- */
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:28px 0 12px">Estado de los módulos</h2>'));
      var inactive = mods.filter(function (m) { return !m.active; });
      if (inactive.length) {
        main.appendChild(h('<div class="mod-warn"><span class="ico">⚠️</span><div>' +
          "<b>" + inactive.length + " módulo(s) desactivado(s).</b> No aparecen para inscribir ni asignar. " +
          "Revisa que sea intencional:<br>" +
          inactive.map(function (m) { return esc(m.level + " · " + m.title); }).join(" · ") +
          '</div></div>'));
      } else {
        main.appendChild(h('<div class="mod-ok">Los ' + mods.length + " módulos están activos.</div>"));
      }

      /* --- inscripciones --- */
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:30px 0 12px">Inscripciones</h2>'));
      var t1 = tableWrap(["Matrícula", "Estudiante", "Contacto", "Módulo", "Horario", "Profesor", "Estado", "Fecha"], { title: 1 });
      enr.forEach(function (e) {
        var sc = e.groups && e.groups.schedules;
        var tr = h("<tr>" +
          "<td>" + esc(e.registration_number) + "</td>" +
          "<td>" + esc(e.students ? e.students.full_name : "—") + "</td>" +
          '<td class="wrap">' + esc(e.students ? e.students.whatsapp : "") + "<br><span class='muted'>" + esc(e.students ? e.students.email : "") + "</span></td>" +
          "<td>" + esc(e.modules ? e.modules.level + " · " + e.modules.title : "—") + "</td>" +
          "<td>" + (sc ? esc(days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time)) : "—") + "</td>" +
          "<td>" + esc(e.groups && e.groups.teachers ? e.groups.teachers.full_name : "—") + "</td>" +
          "<td></td><td>" + date(e.created_at) + "</td></tr>");
        var cell = tr.children[6];
        if (isAdmin && e.status !== "Completed") {
          var sel = h('<select style="width:auto">' + ENROLL_STATUS.map(function (s) {
            return '<option value="' + s + '"' + (s === e.status ? " selected" : "") + ">" + ENROLL_ES[s] + "</option>";
          }).join("") + "</select>");
          sel.onchange = function () {
            q("enrollments").update({ status: sel.value }).eq("id", e.id).then(function (u) {
              toast(u.error ? friendly(u.error) : "Estado actualizado.", u.error ? "err" : "ok");
              route(); // si falló, el selector vuelve a mostrar el estado real
            });
          };
          cell.appendChild(sel);
        } else cell.innerHTML = '<span class="badge neutral">' + ENROLL_ES[e.status] + "</span>";
        t1.body.appendChild(tr);
      });
      if (!enr.length) t1.body.appendChild(h('<tr><td colspan="8" class="muted">Sin inscripciones todavía.</td></tr>'));
      main.appendChild(t1.wrap);

      if (isAdmin) {
        main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:30px 0 12px">Pagos recientes</h2>'));
        var t2 = tableWrap(["Recibo", "Estudiante", "Monto", "Método", "Estado", "Fecha"]);
        recentPays.forEach(function (p) {
          var badge = p.status === "approved" ? "ok" : p.status === "refunded" ? "neutral" : p.status === "declined" ? "bad" : "neutral";
          var nombre = (p.students && p.students.full_name) || p.student_name || "—";
          t2.body.appendChild(h("<tr><td>" + esc(p.receipt_number || "—") + "</td><td>" + esc(nombre) + "</td><td>" +
            money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) + '</td><td><span class="badge ' + badge + '">' +
            esc(PAYST_ES[p.status] || p.status) + "</span></td><td>" + date(p.paid_at) + "</td></tr>"));
        });
        if (!recentPays.length) t2.body.appendChild(h('<tr><td colspan="6" class="muted">Sin pagos registrados.</td></tr>'));
        main.appendChild(t2.wrap);
      }
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  // Grupos activos del profesor + sus inscripciones (Active/PendingPayment).
  // Usado por el Dashboard (resumen) y por "Mis grupos" (detalle).
  function loadMyGroups() {
    return q("groups").select("id,capacity,active,modules(id,level,title,module_number),schedules(days,start_time,end_time)")
      .eq("teacher_id", ME.teacher_id).eq("active", true)
      .then(function (gr) {
        if (gr.error) throw gr.error;
        var groups = gr.data || [];
        if (!groups.length) return { groups: [], enrollments: [] };
        var groupIds = groups.map(function (g) { return g.id; });
        return q("enrollments").select("student_id,group_id,status,students(full_name)").in("group_id", groupIds)
          .then(function (er) {
            if (er.error) throw er.error;
            var enr = (er.data || []).filter(function (e) { return e.status === "Active" || e.status === "PendingPayment"; });
            return { groups: groups, enrollments: enr };
          });
      });
  }

  // Dashboard propio del profesor: solo sus grupos, nada del resto del
  // colegio (pagos, otros módulos, etc. — eso es del admin).
  function secDashboardTeacher(main) {
    head(main, "Dashboard", "Resumen de tus grupos.");
    if (!ME.teacher_id) {
      main.appendChild(h('<div class="pnl-alert err">Tu cuenta no está vinculada a un profesor todavía — pide al admin que la revise en Usuarios.</div>'));
      return;
    }
    loadMyGroups().then(function (d) {
      var groups = d.groups;
      if (!groups.length) {
        main.appendChild(statRow([["Cursos asignados", 0], ["Grupos activos", 0], ["Estudiantes asignados", 0], ["Cupos disponibles", 0]]));
        main.appendChild(h('<div class="pnl-alert ok" style="margin-top:16px">Todavía no tienes grupos asignados — el admin te asigna desde Académico → Grupos.</div>'));
        return;
      }
      var countByGroup = {}, uniqueStudents = {}, mods = {};
      d.enrollments.forEach(function (e) {
        countByGroup[e.group_id] = (countByGroup[e.group_id] || 0) + 1;
        uniqueStudents[e.student_id] = true;
      });
      groups.forEach(function (g) { if (g.modules) mods[g.modules.id] = true; });
      var cupos = groups.reduce(function (sum, g) { return sum + Math.max(g.capacity - (countByGroup[g.id] || 0), 0); }, 0);

      main.appendChild(statRow([
        ["Cursos asignados", Object.keys(mods).length],
        ["Grupos activos", groups.length],
        ["Estudiantes asignados", Object.keys(uniqueStudents).length],
        ["Cupos disponibles", cupos]
      ]));
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  // "Mis grupos" (solo profesor): el detalle de cada grupo que el admin le
  // configuró, con la lista de estudiantes inscritos a un clic.
  function secMisGrupos(main) {
    head(main, "Mis grupos", "Los grupos que el admin te asignó.");
    if (!ME.teacher_id) {
      main.appendChild(h('<div class="pnl-alert err">Tu cuenta no está vinculada a un profesor todavía — pide al admin que la revise en Usuarios.</div>'));
      return;
    }
    loadMyGroups().then(function (d) {
      var groups = d.groups;
      if (!groups.length) {
        main.appendChild(h('<div class="pnl-alert ok">Todavía no tienes grupos asignados — el admin te asigna desde Académico → Grupos.</div>'));
        return;
      }
      var countByGroup = {}, namesByGroup = {};
      d.enrollments.forEach(function (e) {
        countByGroup[e.group_id] = (countByGroup[e.group_id] || 0) + 1;
        (namesByGroup[e.group_id] = namesByGroup[e.group_id] || []).push(e.students ? e.students.full_name : "—");
      });
      groups.forEach(function (g) {
        var sc = g.schedules;
        var card = h(
          '<div class="pnl-table-wrap" style="padding:18px 20px;margin-bottom:14px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">' +
          "<div><p style=\"font-weight:700;font-size:15px\">" + (g.modules ? esc(g.modules.level + " · " + g.modules.title) : "—") + "</p>" +
          '<p class="muted" style="font-size:13px">' + (sc ? esc(days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time)) : "Sin horario asignado") + "</p></div>" +
          '<span class="badge neutral">' + (countByGroup[g.id] || 0) + " / " + g.capacity + " estudiantes</span>" +
          "</div>" +
          '<button type="button" class="btn btn-ghost btn-sm" style="margin-top:10px" data-toggle>Ver estudiantes</button>' +
          '<div class="muted" style="font-size:13px;margin-top:8px" data-list hidden></div>' +
          "</div>"
        );
        var names = namesByGroup[g.id] || [];
        var toggleBtn = card.querySelector("[data-toggle]");
        var listEl = card.querySelector("[data-list]");
        toggleBtn.addEventListener("click", function () {
          var show = listEl.hidden;
          listEl.hidden = !show;
          toggleBtn.textContent = show ? "Ocultar estudiantes" : "Ver estudiantes";
          if (show) listEl.textContent = names.length ? names.join(", ") : "Sin estudiantes inscritos todavía.";
        });
        main.appendChild(card);
      });
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  /* ============ ESTUDIANTES ============ */
  function secEstudiantes(main) {
    if (ME.role !== "admin") {
      head(main, "Estudiantes", "Tus estudiantes y tus anotaciones sobre cada uno.");
      var teacherHost = h("<div></div>");
      main.appendChild(teacherHost);
      renderStudentsList(teacherHost);
      return;
    }
    head(main, "Estudiantes", "Personas inscritas y solicitudes que llegan por el formulario público.");
    var tabsBar = h('<div class="pnl-toolbar" data-tabs style="margin-bottom:14px"></div>');
    var host = h("<div></div>");
    main.appendChild(tabsBar); main.appendChild(host);
    var current = secEstudiantes._tab || "estudiantes";

    function paint() {
      secEstudiantes._tab = current;
      tabsBar.innerHTML = "";
      [["estudiantes", "Estudiantes"],
       ["preinscritos", "Pre-inscritos" + (secEstudiantes._preCount ? " (" + secEstudiantes._preCount + ")" : "")]
      ].forEach(function (t) {
        var b = h('<button class="btn btn-sm ' + (current === t[0] ? "btn-dark" : "btn-ghost") + '">' + t[1] + "</button>");
        b.onclick = function () { current = t[0]; paint(); };
        tabsBar.appendChild(b);
      });
      host.innerHTML = '<p class="muted">Cargando…</p>';
      (current === "preinscritos" ? renderPreinscritos : renderStudentsList)(host);
    }

    q("preinscripciones").select("id", { count: "exact", head: true }).in("status", ["nuevo", "contactado"])
      .then(function (r) { secEstudiantes._preCount = r.count || 0; paint(); })
      .catch(function () { paint(); });
  }

  function renderStudentsList(main) {
    var toolbar;
    if (ME.role === "admin") {
      toolbar = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark" data-add>+ Estudiante</button>' +
        '<span class="muted" style="font-size:13px">Al agregar uno se elige su módulo y queda inscrito.</span></div>');
      main.innerHTML = ""; main.appendChild(toolbar);
    } else { main.innerHTML = ""; }
    var isAdminView = ME.role === "admin";

    // El profesor solo ve a los estudiantes de SUS grupos (los que el admin
    // le asignó en Académico → Grupos) — no a todo el colegio.
    var myGroupIdsPromise = (isAdminView || !ME.teacher_id)
      ? Promise.resolve(null)
      : q("groups").select("id").eq("teacher_id", ME.teacher_id).then(function (r) {
          if (r.error) throw r.error;
          return (r.data || []).map(function (g) { return g.id; });
        });

    myGroupIdsPromise.then(function (myGroupIds) {
      if (!isAdminView && !ME.teacher_id) {
        main.appendChild(h('<div class="pnl-alert err">Tu cuenta no está vinculada a un profesor todavía — pide al admin que la revise en Usuarios.</div>'));
        return;
      }
      if (!isAdminView && !myGroupIds.length) {
        main.appendChild(h('<div class="pnl-alert ok">Todavía no tienes grupos asignados — el admin te asigna desde Académico → Grupos.</div>'));
        return;
      }
      return Promise.all([
        q("students").select("*").order("created_at", { ascending: false }),
        isAdminView ? q("profiles").select("user_id,student_id,email,active").eq("role", "student") : Promise.resolve({ data: [] }),
        q("enrollments").select("id,student_id,module_id,group_id,status,created_at,modules(level,title,module_number)").order("created_at", { ascending: false }),
        activeModules(),
        isAdminView ? Promise.resolve({ data: [] }) : q("teacher_student_notes").select("student_id,note").eq("teacher_id", ME.teacher_id)
      ]).then(function (res) {
        if (res[0].error) throw res[0].error;
        var profByStudent = {}, modByStudent = {}, noteByStudent = {}, myStudentIds = null, doneByStudent = {};
        (res[1].data || []).forEach(function (p) { if (p.student_id) profByStudent[p.student_id] = p; });
        (res[2].data || []).forEach(function (e) {
          // Módulo ACTUAL = el más reciente pendiente de pago o activo. Los
          // completados/cancelados no cuentan: al terminar un módulo, la
          // columna queda vacía hasta que se genere la inscripción siguiente.
          if (e.status === "Completed") { (doneByStudent[e.student_id] = doneByStudent[e.student_id] || {})[e.module_id] = true; return; }
          if (e.status !== "PendingPayment" && e.status !== "Active") return;
          if (!modByStudent[e.student_id]) modByStudent[e.student_id] = e; // el más reciente
        });
        if (!isAdminView) {
          myStudentIds = {};
          (res[2].data || []).forEach(function (e) {
            if (e.status !== "Cancelled" && e.group_id && myGroupIds.indexOf(e.group_id) !== -1) myStudentIds[e.student_id] = true;
          });
        }
        (res[4].data || []).forEach(function (n) { noteByStudent[n.student_id] = n.note; });
        var mods = res[3];
        if (toolbar) toolbar.querySelector("[data-add]").onclick = function () { editStudent(null, null, mods, {}); };

        var cols = isAdminView
          ? ["Nombre", "Documento", "Módulo", "Inscripción", "WhatsApp", "Correo", "Ciudad", "Cuenta portal", "Acciones"]
          : ["Nombre", "Documento", "Módulo", "WhatsApp", "Correo", "Ciudad", "Anotaciones"];
        var t = tableWrap(cols);
        var visibleStudents = isAdminView ? (res[0].data || []) : (res[0].data || []).filter(function (s) { return myStudentIds[s.id]; });
        visibleStudents.forEach(function (s) {
          var prof = profByStudent[s.id];
        var enr = modByStudent[s.id];
        var modLabel = enr && enr.modules ? enr.modules.level + " · " + enr.modules.title : "—";
        var modColorDot = enr && enr.modules ? '<span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:' + modColor(enr.modules.module_number) + '"></span>' : "";
        var doneCount = Object.keys(doneByStudent[s.id] || {}).length;
        var tr;
        if (isAdminView) {
          var enrBadge = !enr ? '<span class="badge neutral">sin módulo</span>' : enr.status === "Active" ? '<span class="badge ok">activo</span>'
            : enr.status === "PendingPayment" ? '<span class="badge warn">pendiente de pago</span>'
            : '<span class="badge neutral">' + esc(ENROLL_ES[enr.status] || enr.status) + "</span>";
          var estado = !prof ? '<span class="badge neutral">sin cuenta</span>'
            : prof.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>';
          tr = h([
            "<tr><td>", esc(s.full_name), "</td>",
            "<td>", esc((s.doc_type || "") + " " + (s.doc_number || "—")), "</td>",
            "<td>", modColorDot, esc(modLabel),
            (doneCount ? '<br><span class="muted" style="font-size:12px">' + doneCount + (doneCount === 1 ? " módulo completado" : " módulos completados") + "</span>" : ""),
            "</td>",
            "<td>", enrBadge, "</td>",
            "<td>", esc(s.whatsapp), '</td><td class="wrap">', esc(s.email), "</td>",
            "<td>", esc(s.city || "—"), "</td>",
            "<td>", estado, (prof ? '<br><span class="muted" style="font-size:12px">' + esc(prof.email) + "</span>" : ""), "</td>",
            '<td class="acts"></td></tr>'
          ].join(""));
          var cell = tr.children[8];
          if (!prof) cell.appendChild(btn("Crear cuenta de portal", "btn-blue", function () { crearCuentaEstudiante(s); }));
          else {
            cell.appendChild(btn("Restablecer contraseña", "btn-ghost", function () { resetStudentPwd(s, prof); }));
            cell.appendChild(btn((prof.active ? "Desactivar" : "Activar") + " acceso", "btn-ghost", function () {
              callFn({ action: "set_active", user_id: prof.user_id, active: !prof.active })
                .then(function () { toast("Actualizado."); route(); }).catch(function (e) { toast(friendly(e), "err"); });
            }));
          }
          cell.appendChild(btn("Detalle", "btn-ghost", function () { studentDetail(s); }));
          cell.appendChild(btn("Editar", "btn-ghost", function () { editStudent(s, enr || null, mods, doneByStudent[s.id] || {}); }));
          cell.appendChild(btn("Eliminar", "btn-danger", function () { deleteStudent(s, prof); }));
        } else {
          tr = h([
            "<tr><td>", esc(s.full_name), "</td>",
            "<td>", esc((s.doc_type || "") + " " + (s.doc_number || "—")), "</td>",
            "<td>", modColorDot, esc(modLabel), "</td>",
            "<td>", esc(s.whatsapp), '</td><td class="wrap">', esc(s.email), "</td>",
            "<td>", esc(s.city || "—"), "</td>",
            '<td style="min-width:220px"></td></tr>'
          ].join(""));
          var noteCell = tr.children[6];
          var noteBox = h(
            '<div>' +
            '<textarea rows="2" style="width:100%;resize:vertical;font:inherit;padding:6px 8px;border:1px solid var(--niebla);border-radius:8px">' +
            esc(noteByStudent[s.id] || "") + "</textarea>" +
            '<div style="display:flex;align-items:center;gap:8px;margin-top:4px">' +
            '<button class="btn btn-sm btn-ghost" data-save-note>Guardar</button>' +
            '<span class="muted" data-note-msg style="font-size:12px"></span>' +
            "</div></div>"
          );
          noteCell.appendChild(noteBox);
          noteBox.querySelector("[data-save-note]").addEventListener("click", function () {
            var msg = noteBox.querySelector("[data-note-msg]");
            if (!ME.teacher_id) { msg.textContent = "Tu cuenta no está vinculada a un profesor — pide al admin que la revise."; return; }
            var val = noteBox.querySelector("textarea").value;
            msg.textContent = "Guardando…";
            q("teacher_student_notes").upsert({
              teacher_id: ME.teacher_id, student_id: s.id, note: val, updated_at: new Date().toISOString()
            }).then(function (u) {
              if (u.error) throw u.error;
              msg.textContent = "Guardado.";
              setTimeout(function () { msg.textContent = ""; }, 2000);
            }).catch(function (e) { msg.textContent = friendly(e); });
          });
        }
        t.body.appendChild(tr);
      });
        if (!visibleStudents.length) t.body.appendChild(h('<tr><td colspan="' + cols.length + '" class="muted">Sin estudiantes todavía' + (isAdminView ? '. Aparecen aquí cuando el admin crea uno (desde “+ Estudiante” o desde una solicitud de la pestaña Pre-inscritos).' : " asignados.") + "</td></tr>"));
        main.appendChild(t.wrap);
      });
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  var PRE_STATUS_BADGE = {
    nuevo: '<span class="badge warn">nuevo</span>',
    contactado: '<span class="badge neutral">contactado</span>',
    convertido: '<span class="badge ok">convertido</span>',
    descartado: '<span class="badge bad">descartado</span>'
  };
  var LEVEL_ES = { beginner: "Principiante (A1–A2)", intermediate: "Intermedio (B1–B2)", advanced: "Avanzado (C1+)" };
  var TIME_ES = { morning: "Mañana", afternoon: "Tarde", evening: "Noche" };

  function renderPreinscritos(main) {
    main.innerHTML = "";
    Promise.all([
      q("preinscripciones").select("*")
        .neq("status", "convertido")
        .order("created_at", { ascending: false }),
      activeModules()
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var rows = res[0].data || [], mods = res[1];
      var t = tableWrap(["Fecha", "Nombre", "Contacto", "Nivel (autoeval.)", "Franja preferida", "Estado", "Acciones"], { title: 1 });
      rows.forEach(function (p) {
        var tr = h("<tr><td>" + date(p.created_at) + "</td><td>" + esc(p.full_name) + "</td>" +
          '<td class="wrap">' + esc(p.whatsapp) + '<br><span class="muted" style="font-size:12px">' + esc(p.email) + "</span></td>" +
          "<td>" + esc(LEVEL_ES[p.level_estimate] || "—") + "</td><td>" + esc(TIME_ES[p.time_preference] || "—") + "</td>" +
          "<td>" + (PRE_STATUS_BADGE[p.status] || esc(p.status)) + '</td><td class="acts"></td></tr>');
        var cell = tr.children[6];
        if (ME.role === "admin" && (p.status === "nuevo" || p.status === "contactado")) {
          cell.appendChild(btn("Crear estudiante", "btn-blue", function () { convertPreinscrito(p, mods); }));
          if (p.status === "nuevo") {
            cell.appendChild(btn("Marcar contactado", "btn-ghost", function () {
              q("preinscripciones").update({ status: "contactado", handled_by: ME.user_id }).eq("id", p.id)
                .then(function (u) { if (u.error) throw u.error; toast("Marcado como contactado."); route(); })
                .catch(function (e) { toast(friendly(e), "err"); });
            }));
          }
          cell.appendChild(btn("Descartar", "btn-danger", function () {
            confirmDelete("Descartar solicitud",
              "Se marca como descartada la solicitud de " + p.full_name + ". No se borra el registro.",
              function () {
                return q("preinscripciones").update({ status: "descartado", handled_by: ME.user_id }).eq("id", p.id)
                  .then(function (u) { if (u.error) throw u.error; toast("Solicitud descartada."); route(); });
              });
          }));
        } else if (p.status === "descartado") {
          cell.innerHTML = '<span class="muted">—</span>';
        }
        t.body.appendChild(tr);
      });
      if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Sin solicitudes todavía. Aparecen aquí cuando alguien completa el formulario público de inscripción.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function convertPreinscrito(p, mods) {
    if (!mods.length) { toast("No hay módulos activos. Activa alguno en Académico.", "err"); return; }
    var defaultMod = (p.desired_module_id && mods.some(function (m) { return m.id === p.desired_module_id; }))
      ? p.desired_module_id : mods[0].id;
    var pwd = genPassword();
    var b = h("<div>" +
      '<p class="pnl-sub" style="margin-bottom:6px">Solicitud de <strong>' + esc(p.full_name) + "</strong><br>" +
      esc(p.whatsapp) + " · " + esc(p.email) + (p.age ? " · " + esc(p.age) + " años" : "") + (p.city ? " · " + esc(p.city) : "") + "</p>" +
      '<p class="pnl-sub" style="margin-bottom:10px">Dice tener nivel <strong>' + esc(LEVEL_ES[p.level_estimate] || "sin especificar") +
      "</strong> · prefiere la franja <strong>" + esc(TIME_ES[p.time_preference] || "sin especificar") +
      '</strong> — es solo referencia del formulario, elige abajo el módulo y horario reales según tu conversación con la persona.</p>' +
      field("Tipo de documento", docSelect("dt", p.doc_type || "CC")) +
      field("Número de documento", '<input name="dn" value="' + esc(p.doc_number || "") + '">') +
      field("Módulo", moduleSelect("mod", mods, defaultMod)) +
      field("Horario", '<select name="sch"><option value="">Cargando…</option></select>') +
      fixedPriceField() +
      field("Contraseña temporal del portal", '<input name="pw" value="' + pwd + '">') +
      mailCheckbox() +
      '<p class="pnl-sub">Se crea el estudiante, su inscripción (con cupo, grupo y matrícula — queda como <strong>pendiente de pago</strong>), su cuenta de portal y su cobro de la mensualidad, todo en un paso. Comparte el usuario y la contraseña con el estudiante para que entre y pague. Si quien paga no es el estudiante, corrige el pagador después desde Pagos → Editar.</p>' +
      "</div>");
    var schSel = b.querySelector("[name=sch]");
    function loadSch(moduleId) {
      schSel.innerHTML = '<option value="">Cargando…</option>';
      rpc("get_schedule_availability", { p_module_id: moduleId }).then(function (list) {
        var opts = '<option value="">Sin horario por ahora (se define después)</option>';
        (list || []).filter(function (r) { return r.active; }).forEach(function (r) {
          opts += '<option value="' + r.schedule_id + '"' +
            (r.schedule_id === p.desired_schedule_id && !r.is_full ? " selected" : "") +
            (r.is_full ? " disabled" : "") + ">" +
            days(r.days) + " " + time(r.start_time) + "–" + time(r.end_time) +
            (r.is_full ? " (sin cupos)" : " (" + r.available + " cupo" + (r.available === 1 ? "" : "s") + ")") + "</option>";
        });
        schSel.innerHTML = opts;
        if (p.wants_schedule_later) schSel.value = "";
      }).catch(function () { schSel.innerHTML = '<option value="">Sin horario por ahora (se define después)</option>'; });
    }
    loadSch(defaultMod);
    b.querySelector("[name=mod]").onchange = function () { loadSch(this.value); };

    modal("Crear estudiante desde la solicitud", b, function () {
      var dn = b.querySelector("[name=dn]").value.trim();
      if (!dn) throw new Error("El número de documento es obligatorio.");
      var accountPwd = b.querySelector("[name=pw]").value;
      var sendMail = wantsMail(b);
      var pwErr = checkPassword(accountPwd);
      if (pwErr) throw new Error(pwErr); // antes de crear nada, para no dejar el estudiante a medias
      // Igual con el correo: si ya lo usa otra cuenta, se avisa ANTES de crear
      // matrícula y cobro (si no, quedaría el estudiante creado sin cuenta).
      return callFn({ action: "check_email", email: p.email }).then(function (chk) {
        if (chk && chk.in_use) throw new Error("correo_en_uso");
        return crearDesdeSolicitud();
      });
      function crearDesdeSolicitud() {
      var moduleId = b.querySelector("[name=mod]").value;
      var docType = b.querySelector("[name=dt]").value;
      var monthly = MONTHLY_PRICE;
      return rpc("admin_convert_preinscripcion", {
        p_id: p.id,
        p_module_id: moduleId,
        p_schedule_id: b.querySelector("[name=sch]").value || null,
        p_doc_type: docType,
        p_doc_number: dn,
        p_age: p.age || null,
        p_city: p.city || null
      }).then(function (out) {
        var row = Array.isArray(out) ? out[0] : out;
        return q("subscriptions").insert({
          student_id: row.student_id, enrollment_id: row.enrollment_id, module_id: moduleId,
          monthly_amount: monthly, currency: "COP",
          payer_name: p.full_name, payer_doc_type: docType, payer_doc_number: dn,
          payer_email: p.email, payer_phone: p.whatsapp
        }).then(function (subRes) {
          if (subRes.error) throw subRes.error;
          return callFn({
            action: "create_account", role: "student",
            full_name: p.full_name, email: p.email,
            password: accountPwd, student_id: row.student_id, send_email: sendMail
          }).then(function (acc) {
            route();
            var mailMsg = mailOutcome(acc);
            var info = h("<div>" +
              '<p class="pnl-sub" style="margin-bottom:8px">Matrícula <strong>' + esc(row.registration_number) +
              '</strong> creada — inscripción en <strong>pendiente de pago</strong>, mensualidad ' + esc(money(monthly, "COP")) + ' ya generada.</p>' +
              '<p class="pnl-sub" style="margin-bottom:8px">Usuario: <strong>' + esc(p.email) + "</strong><br>" +
              'Contraseña temporal: <code style="font-size:14px">' + esc(accountPwd) + "</code></p>" +
              (mailMsg ? '<p class="pnl-sub" style="margin-bottom:8px"><strong>' + esc(mailMsg) + "</strong></p>" : "") +
              '<p class="pnl-sub">Compártelos con el estudiante para que entre al portal y pague. La inscripción pasa a "activo" en cuanto se complete el valor de la mensualidad (en uno o varios abonos).</p></div>');
            modal("Estudiante creado", info, function () { return Promise.resolve(); }, "Entendido");
          }).catch(function (accErr) {
            route();
            toast("Se creó la matrícula " + row.registration_number + " y su mensualidad, pero la cuenta de portal falló (" +
              friendly(accErr) + "). Créala desde Estudiantes con “Crear cuenta de portal”.", "err");
          });
        });
      });
      }
    }, "Crear estudiante");
  }

  // curEnr: inscripción ACTUAL (PendingPayment/Active) o null si está sin módulo.
  // completed: { module_id: true } con los módulos que ya cursó.
  function editStudent(s, curEnr, mods, completed) {
    if (!mods.length) { toast("No hay módulos activos. Activa alguno en Académico.", "err"); return; }
    completed = completed || {};
    var modById = {}; mods.forEach(function (m) { modById[m.id] = m; });
    var extra, selected;
    if (curEnr) {
      extra = [{ value: "__cancel", label: "— Quitar módulo actual: cancelar la inscripción —" }];
      if (curEnr.status === "Active") extra.push({ value: "__complete", label: "— Quitar módulo actual: marcarlo como completado —" });
      selected = curEnr.module_id;
    } else {
      extra = [{ value: "", label: "— Sin módulo por ahora —" }];
      var firstOpen = mods.filter(function (m) { return !completed[m.id]; })[0];
      selected = s ? "" : (firstOpen ? firstOpen.id : "");
    }
    var suggested = curEnr ? null : suggestNextModule(mods, completed, modById);
    var note = curEnr
      ? (curEnr.status === "Active"
        ? "Si eliges otro módulo, el actual (" + (curEnr.modules ? curEnr.modules.level : "") + ", ya pagado) queda como <strong>completado</strong> y se crea la inscripción nueva pendiente de pago."
        : "Si eliges otro módulo, la inscripción pendiente de pago se cambia a ese módulo (si tenía grupo asignado, se libera).")
      : (s ? "Hoy no tiene módulo en curso. Elige el siguiente para inscribirlo" + (suggested ? " (el sugerido es el que sigue a lo que ya cursó)" : "") + ", o déjalo sin módulo." : "");
    var b = h("<div>" +
      field("Nombre completo del estudiante", '<input name="n" value="' + esc(s ? s.full_name : "") + '">') +
      field("Tipo de documento", docSelect("dt", s ? s.doc_type : "TI")) +
      field("Número de documento", '<input name="dn" value="' + esc(s ? (s.doc_number || "") : "") + '">') +
      fieldBlock("Módulo en que se inscribe", modulePicker("mod", mods, selected, completed, { lockCompleted: true, suggestedId: suggested, extra: extra })) +
      (note ? '<p class="pnl-sub" style="margin:-4px 0 12px">' + note + "</p>" : "") +
      field("WhatsApp", '<input name="w" value="' + esc(s ? s.whatsapp : "") + '">') +
      field("Correo", '<input name="e" type="email" value="' + esc(s ? s.email : "") + '">') +
      field("Edad (opcional)", '<input name="a" type="number" min="5" max="100" value="' + (s && s.age ? s.age : "") + '">') +
      field("Ciudad (opcional)", '<input name="c" value="' + esc(s ? (s.city || "") : "") + '">') +
      '<p class="pnl-sub">El documento del estudiante es obligatorio. Si es menor de edad, va su tarjeta de identidad; el documento de quien paga se registra aparte, en la suscripción.</p>' +
      "</div>");
    modal(s ? "Editar estudiante" : "Nuevo estudiante", b, function () {
      var docNum = b.querySelector("[name=dn]").value.trim();
      if (docNum.length < 3) throw new Error("Ingresa el número de documento del estudiante.");
      var payload = {
        full_name: b.querySelector("[name=n]").value.trim(),
        doc_type: b.querySelector("[name=dt]").value,
        doc_number: docNum,
        whatsapp: b.querySelector("[name=w]").value.trim(),
        email: b.querySelector("[name=e]").value.trim(),
        age: +b.querySelector("[name=a]").value || null,
        city: b.querySelector("[name=c]").value.trim() || null
      };
      var moduleVal = pickedValue(b, "mod");
      var pr = s
        ? q("students").update(payload).eq("id", s.id).then(function (r) { if (r.error) throw r.error; return s.id; })
        : q("students").insert(payload).select("id").single().then(function (r) { if (r.error) throw r.error; return r.data.id; });
      return pr.then(function (sid) {
        if (moduleVal === "__cancel") return rpc("admin_release_module", { p_student_id: sid, p_mode: "cancel" });
        if (moduleVal === "__complete") return rpc("admin_release_module", { p_student_id: sid, p_mode: "complete" });
        if (!moduleVal) return null;
        return rpc("admin_assign_module", { p_student_id: sid, p_module_id: moduleVal });
      }).then(function () { toast(s ? "Estudiante actualizado." : (moduleVal ? "Estudiante inscrito." : "Estudiante creado, sin módulo por ahora.")); route(); });
    }, s ? "Guardar" : "Inscribir");
  }

  // Estudiantes → "Detalle": módulo en curso + módulos que ya culminó (con la
  // copia hist_* de ciclo/horario/profesor, porque el grupo, el horario y el
  // ciclo se borran solos cuando el ciclo termina).
  function studentDetail(s) {
    var box = h('<div><p class="muted">Cargando…</p></div>');
    modal("Detalle — " + s.full_name, box, null, "Cerrar", false, true);
    q("enrollments")
      .select("id,registration_number,status,created_at,completed_at,hist_cycle_name,hist_cycle_start,hist_cycle_end,hist_days,hist_start_time,hist_end_time,hist_teacher_name," +
        "modules(level,title,module_number),cycles(name,start_date,end_date),groups(schedules(days,start_time,end_time),teachers(full_name))")
      .eq("student_id", s.id).order("created_at", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        var rows = r.data || [];
        var current = rows.filter(function (e) { return e.status === "PendingPayment" || e.status === "Active"; })[0];
        var done = rows.filter(function (e) { return e.status === "Completed"; })
          .sort(function (a, b) { return ((a.modules && a.modules.module_number) || 0) - ((b.modules && b.modules.module_number) || 0); });
        var cancelled = rows.filter(function (e) { return e.status === "Cancelled"; });
        function modName(e) { return e.modules ? e.modules.level + " · " + e.modules.title : "—"; }
        function dot(e) { return '<span class="mod-pick__dot" style="background:' + modColor(e.modules && e.modules.module_number) + '"></span>'; }
        function infoLine(e) {
          var sc = e.groups && e.groups.schedules;
          var d = sc ? sc.days : e.hist_days, st = sc ? sc.start_time : e.hist_start_time, et = sc ? sc.end_time : e.hist_end_time;
          var teacher = (e.groups && e.groups.teachers && e.groups.teachers.full_name) || e.hist_teacher_name;
          var cs = e.cycles ? e.cycles.start_date : e.hist_cycle_start, ce = e.cycles ? e.cycles.end_date : e.hist_cycle_end;
          var parts = [];
          if (cs && ce) parts.push("Ciclo " + date(cs) + " – " + date(ce));
          if (d && d.length) parts.push(days(d) + " " + time(st) + "–" + time(et));
          if (teacher) parts.push("Prof. " + teacher);
          return parts.length ? esc(parts.join(" · ")) : "Sin grupo asignado";
        }
        box.innerHTML = "";

        box.appendChild(h('<h3 style="font-size:14px;margin-bottom:8px">Módulo en curso</h3>'));
        box.appendChild(current
          ? h('<div class="det-card"><div class="det-card__top">' + dot(current) + "<strong>" + esc(modName(current)) + "</strong>" +
              (current.status === "Active" ? '<span class="badge ok">activo</span>' : '<span class="badge warn">pendiente de pago</span>') +
              '</div><p class="muted" style="font-size:12.5px;margin-top:4px">Matrícula ' + esc(current.registration_number) + " · " + infoLine(current) + "</p></div>")
          : h('<p class="pnl-sub">Sin módulo en curso — queda a la espera de que se genere su siguiente inscripción (desde Editar, desde Pagos → Generar pago, o por el propio estudiante en su portal).</p>'));

        box.appendChild(h('<h3 style="font-size:14px;margin:18px 0 8px">Módulos completados (' + done.length + ")</h3>"));
        if (!done.length) box.appendChild(h('<p class="pnl-sub">Todavía no ha culminado ningún módulo.</p>'));
        done.forEach(function (e) {
          box.appendChild(h('<div class="det-card"><div class="det-card__top">' + dot(e) + "<strong>" + esc(modName(e)) + "</strong>" +
            '<span class="mod-pick__done">✓ Completado</span></div>' +
            '<p class="muted" style="font-size:12.5px;margin-top:4px">Matrícula ' + esc(e.registration_number) +
            (e.completed_at ? " · cerrado el " + date(e.completed_at) : "") + " · " + infoLine(e) + "</p></div>"));
        });

        if (cancelled.length) {
          box.appendChild(h('<h3 style="font-size:14px;margin:18px 0 8px">Inscripciones canceladas (' + cancelled.length + ")</h3>"));
          box.appendChild(h('<p class="muted" style="font-size:12.5px">' + cancelled.map(function (e) {
            return esc(modName(e) + " (matrícula " + e.registration_number + ")");
          }).join("<br>") + "</p>"));
        }
      }).catch(function (e) { box.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
  }

  function resetStudentPwd(s, prof) {
    var np = genPassword();
    var bb = h("<div>" + field("Nueva contraseña temporal", '<input name="p" value="' + np + '">') + mailCheckbox() +
      '<p class="pnl-sub">Compártela con el estudiante. Podrá cambiarla luego.</p></div>');
    modal("Restablecer contraseña — " + s.full_name, bb, function () {
      return callFn({ action: "reset_password", user_id: prof.user_id, password: bb.querySelector("[name=p]").value, send_email: wantsMail(bb) })
        .then(function (res) { toastMail("Contraseña actualizada.", res); });
    }, "Guardar");
  }

  function deleteStudent(s, prof) {
    // El borrado real lo hace admin_delete_student (transaccional): borra
    // inscripciones y suscripciones sin pagos; DESLIGA las suscripciones/pagos
    // con historial (quedan fijos como libro contable). Luego borramos la cuenta.
    function doDelete() {
      return rpc("admin_delete_student", { p_student_id: s.id })
        .then(function () { return prof ? callFn({ action: "delete_account", user_id: prof.user_id }) : null; })
        .then(function () { toast("Estudiante eliminado."); route(); });
    }
    q("payments").select("id", { count: "exact", head: true }).eq("student_id", s.id).then(function (pc) {
      if (pc.error) throw pc.error;
      var n = pc.count || 0;
      if (n === 0) {
        confirmDelete("Eliminar estudiante",
          "Vas a eliminar a " + s.full_name + " y todo lo asociado (inscripción, suscripción y cuenta de acceso). No tiene pagos registrados.",
          doDelete);
        return;
      }
      var b = h("<div>" +
        '<p class="pnl-sub" style="margin-bottom:6px">' + esc(s.full_name) + " tiene <strong>" + n + " pago(s) registrado(s)</strong>.</p>" +
        '<p class="pnl-sub" style="margin-bottom:6px">Al eliminarlo, esos pagos <strong>NO se borran</strong>: quedan en el libro contable como historial fijo, pero <strong>desligados</strong> de este estudiante. Si más adelante vuelves a crear a esta persona, <strong>no se reconectará</strong> con esos pagos.</p>' +
        '<p class="pnl-sub" style="margin-bottom:10px">Se eliminan su inscripción, sus suscripciones sin pagos y su cuenta de acceso. Esta acción no se puede deshacer.</p>' +
        field('Escribe ELIMINAR para confirmar', '<input name="confirm" autocomplete="off" placeholder="ELIMINAR">') +
        "</div>");
      modal("Eliminar estudiante con historial de pagos", b, function () {
        if ((b.querySelector("[name=confirm]").value || "").trim().toUpperCase() !== "ELIMINAR")
          throw new Error('Escribe ELIMINAR para confirmar.');
        return doDelete();
      }, "Eliminar definitivamente", true);
    }).catch(function (e) { toast(friendly(e), "err"); });
  }

  function crearCuentaEstudiante(s) {
    var pwd = genPassword();
    var body = h("<div>" +
      field("Nombre", '<input name="fn" value="' + esc(s.full_name) + '">') +
      field("Correo (usuario para entrar)", '<input name="em" type="email" value="' + esc(s.email) + '">') +
      field("Contraseña temporal", '<input name="pw" value="' + pwd + '">') + mailCheckbox() +
      '<p class="pnl-sub">Comparte estos datos con el estudiante. Entra en ' + esc(window.location.host) +
      '/login y podrá cambiar la contraseña luego.</p></div>');
    modal("Crear cuenta de portal — " + s.full_name, body, function () {
      return callFn({
        action: "create_account", role: "student",
        full_name: body.querySelector("[name=fn]").value.trim(),
        email: body.querySelector("[name=em]").value.trim(),
        password: body.querySelector("[name=pw]").value,
        student_id: s.id, send_email: wantsMail(body)
      }).then(function (res) { toastMail("Cuenta creada.", res); route(); });
    }, "Crear cuenta");
  }

  /* ============ GOOGLE CLASSROOM (solo profesor) ============ */
  // Conexión por profesor (OAuth estándar, cada quien autoriza su propia
  // cuenta) — no domain-wide delegation. Solo lectura: cursos, temas y
  // materiales, con un enlace para abrir cada uno en Classroom (no se
  // embebe ni se pide acceso a Drive, no hace falta).
  function secClassroom(main) {
    head(main, "Planificador", "Tus clases de Google Classroom, organizadas por nivel y módulo.");

    var qs = new URLSearchParams(location.search);
    var googleStatus = qs.get("google");
    if (googleStatus) {
      var statusMsg = {
        ok: "Cuenta de Google conectada.",
        denied: "Cancelaste la conexión con Google.",
        expired: "El enlace expiró — intenta conectarte de nuevo.",
        error: "No pudimos conectar tu cuenta de Google. Intenta de nuevo."
      }[googleStatus] || "";
      if (statusMsg) {
        main.appendChild(h('<div class="pnl-alert ' + (googleStatus === "ok" ? "ok" : "err") + '" style="margin-bottom:16px">' + esc(statusMsg) + "</div>"));
      }
      history.replaceState(null, "", location.pathname + location.hash);
    }

    var body = h('<div></div>');
    main.appendChild(body);
    body.innerHTML = '<p class="muted">Cargando…</p>';

    rpc("get_my_classroom_connection").then(function (r) {
      var conn = (r && r[0]) || { connected: false };
      body.innerHTML = "";
      if (!conn.connected) renderConnectPrompt(body);
      else renderCourseList(body, conn.google_email);
    }).catch(function (e) { body.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });

    function renderConnectPrompt(box) {
      var card = h(
        '<div class="pnl-table-wrap" style="padding:24px;text-align:center">' +
        '<p class="pnl-sub" style="margin-bottom:16px">Conecta tu cuenta de Google para ver aquí los cursos y materiales que ya tienes en Classroom.</p>' +
        '<button class="btn btn-blue" data-connect>Conectar con Google Classroom</button>' +
        "</div>"
      );
      box.appendChild(card);
      var btnEl = card.querySelector("[data-connect]");
      btnEl.addEventListener("click", function () {
        btnEl.disabled = true; btnEl.textContent = "Redirigiendo…";
        callEdgeFn("classroom-oauth-start").then(function (d) {
          if (!d || !d.url) throw new Error("respuesta_invalida");
          window.location.href = d.url;
        }).catch(function (e) {
          btnEl.disabled = false; btnEl.textContent = "Conectar con Google Classroom";
          toast("No pudimos iniciar la conexión: " + ((e && e.message) || e), "err");
        });
      });
    }

    function renderCourseList(box, email) {
      var bar = h(
        '<div class="pnl-toolbar" style="justify-content:space-between">' +
        '<span class="muted" style="font-size:13px">Conectado como <strong>' + esc(email || "—") + "</strong></span>" +
        '<button class="btn btn-ghost btn-sm" data-disconnect>Desconectar</button>' +
        "</div>"
      );
      box.appendChild(bar);
      bar.querySelector("[data-disconnect]").addEventListener("click", function () {
        rpc("disconnect_my_classroom").then(function () { secClassroom(main); }).catch(function (e) { toast(friendly(e), "err"); });
      });

      var loading = h('<p class="muted">Cargando tus cursos de Classroom…</p>');
      box.appendChild(loading);

      callEdgeFn("classroom-list").then(function (d) {
        loading.remove();
        if (!d || d.connected === false) {
          box.appendChild(h('<div class="pnl-alert err">Tu conexión con Google expiró — desconéctate y vuelve a conectarte.</div>'));
          return;
        }
        // classroom-list ya devuelve solo las clases que llevan el nombre del
        // profesor ("LEVEL A2 - LUIS CABALLERO"), para que no se mezclen las de
        // otros profesores ni las plantillas (tienen los mismos temas).
        var courses = d.courses || [];
        if (!courses.length) {
          box.appendChild(h('<div class="pnl-alert ok">No encontramos clases con tu nombre' +
            (d.match_name ? " (“" + esc(d.match_name) + "”)" : "") + " en tu cuenta de Classroom. " +
            "Las clases deben llevar tu nombre, por ejemplo “LEVEL A1 - " + esc(d.match_name || "TU NOMBRE") + "”.</div>"));
          return;
        }
        // Módulos de LEF: número global (MODULE 4) → código (A2.1) y título.
        q("modules").select("level,title,module_number").then(function (r) {
          var mods = { titles: {}, byNumber: {} };
          (r.data || []).forEach(function (m) { mods.titles[m.level] = m.title; mods.byNumber[m.module_number] = m.level; });
          var tree = buildTree(courses, mods);
          var nav = h("<div></div>");
          box.appendChild(nav);
          showLevels(nav, tree);
        });
      }).catch(function (e) {
        loading.remove();
        box.appendChild(h('<div class="pnl-alert err">No pudimos cargar Classroom: ' + esc((e && e.message) || e) + "</div>"));
      });
    }

    // Embebe el archivo/video adjunto directo en la página en vez de mandar a
    // otra pestaña. Drive y YouTube tienen URLs de vista previa pensadas para
    // esto (no hace falta pedir acceso a Drive). Un enlace externo o un Form
    // pueden no dejarse embeber (lo decide el sitio destino, no LEF) — por
    // eso siempre queda debajo el enlace de respaldo para abrirlo aparte.
    function linkCard(att) {
      var host = "";
      try { host = new URL(att.url).hostname.replace(/^www\./, ""); } catch (e) { host = ""; }
      return '<div class="cls-linkcard">' +
        '<div style="min-width:0"><p class="cls-linkcard__title">' + esc(att.title || host || "Enlace") + "</p>" +
        '<p class="muted" style="font-size:12.5px">' + esc(host) + " no permite mostrarse dentro de otra página.</p></div>" +
        '<a href="' + esc(att.url) + '" target="_blank" rel="noopener" class="btn btn-blue btn-sm">Abrir en una pestaña nueva ↗</a>' +
        "</div>";
    }

    function attachmentEmbed(att) {
      if (att.type === "drive") {
        return '<div class="cls-embed"><iframe src="https://drive.google.com/file/d/' + esc(att.id) + '/preview" allow="autoplay" loading="lazy"></iframe></div>' +
          (att.alternateLink ? '<a href="' + esc(att.alternateLink) + '" target="_blank" rel="noopener" class="cls-fallback">¿No carga? Ábrelo en Google Drive ↗</a>' : "");
      }
      if (att.type === "youtube") {
        return '<div class="cls-embed cls-embed--16-9"><iframe src="https://www.youtube.com/embed/' + esc(att.id) + '" allowfullscreen loading="lazy"></iframe></div>';
      }
      if ((att.type === "link" || att.type === "form") && att.url) {
        // classroom-list ya revisó si el sitio se deja mostrar aquí (Wordwall
        // y Forms vienen con su dirección para incrustar). Si no se deja
        // (Kahoot, Blooket…), tarjeta con botón en vez del "rechazó la conexión".
        if (att.embeddable === false) return linkCard(att);
        return '<div class="cls-embed"><iframe src="' + esc(att.embedUrl || att.url) + '" loading="lazy" allowfullscreen></iframe></div>' +
          '<a href="' + esc(att.url) + '" target="_blank" rel="noopener" class="cls-fallback">¿No carga? Abrir en una pestaña nueva ↗</a>';
      }
      return "";
    }

    function postBlock(m) {
      var attachments = m.attachments || [];
      var embedsHtml = attachments.map(attachmentEmbed).join("");
      return '<div class="cls-post">' +
        (m.description ? '<p class="pnl-sub" style="white-space:pre-line;margin-bottom:10px">' + esc(m.description) + "</p>" : "") +
        (embedsHtml || '<a href="' + esc(m.alternateLink) + '" target="_blank" rel="noopener" class="cls-fallback">Ver en Classroom ↗</a>') +
        "</div>";
    }

    /* --- Carpetas: Nivel → Módulo → Días ---
       Classroom no tiene carpetas dentro de carpetas (solo clase → temas →
       materiales), así que se arman aquí leyendo los nombres, tal como los
       usa LEF en Classroom:
         - la clase lleva el nivel en el nombre ("LEVEL A2 - LUIS CABALLERO" → A2);
         - cada tema es un módulo con su número GLOBAL: "MODULE 4" → A2.1
           (según module_number de LEF); también sirve "A2.1" escrito tal cual;
         - cada material es un día: "LEVEL A2 MODULE 4 DAY 12 …" → día 12, en
           ese orden (sin número de día, por fecha de creación);
         - un material sin tema cae en su módulo si el título dice "MODULE n";
           si no, en "Otros materiales" al final del nivel. */
    var LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1"];
    var OTHERS = "Otros materiales";
    function dayNum(t) { var m = /\b(?:DAY|D[IÍ]A)\s*(\d+)/i.exec(t || ""); return m ? +m[1] : null; }
    // Nombre de tema o título → código de módulo de LEF (o null).
    function moduleCode(text, levelCode, mods) {
      var cm = /\b([ABC][12]\.[1-3])\b/i.exec(text || "");
      if (cm) return cm[1].toUpperCase();
      var nm = /\bMODUL[OE]\s*(\d+)/i.exec(text || "");
      if (!nm) return null;
      var n = +nm[1], byNum = mods.byNumber[n];
      if (byNum && (!levelCode || byNum.indexOf(levelCode) === 0)) return byNum;
      // Numeración local dentro del nivel ("MODULE 2" en la clase de A2 → A2.2).
      if (levelCode && n >= 1 && n <= 3) return levelCode + "." + n;
      return byNum || null;
    }
    function buildTree(courses, mods) {
      var levels = {};
      courses.forEach(function (c) {
        var lm = /\b([ABC][12])\b/i.exec(c.name || "");
        var code = lm ? lm[1].toUpperCase() : null;
        var key = code || ("curso:" + c.id);
        var lv = levels[key] = levels[key] || { key: key, code: code, label: code ? "Nivel " + code : c.name, links: [], modules: {} };
        lv.links.push({ name: c.name, url: c.alternateLink });
        var topicMod = {};
        (c.topics || []).forEach(function (t) { topicMod[t.id] = moduleCode(t.name, code, mods) || t.name; });
        (c.materials || []).forEach(function (m) {
          var mk = (m.topicId && topicMod[m.topicId]) || moduleCode(m.title, code, mods) || OTHERS;
          var mod = lv.modules[mk] = lv.modules[mk] || { key: mk, title: mods.titles[mk] || "", items: [] };
          mod.items.push(m);
        });
      });
      var list = Object.keys(levels).map(function (k) { return levels[k]; });
      list.sort(function (a, b) {
        var ia = a.code ? LEVEL_ORDER.indexOf(a.code) : 99, ib = b.code ? LEVEL_ORDER.indexOf(b.code) : 99;
        return ia - ib || a.label.localeCompare(b.label);
      });
      list.forEach(function (lv) {
        lv.moduleList = Object.keys(lv.modules).map(function (k) { return lv.modules[k]; })
          .sort(function (a, b) {
            if (a.key === OTHERS) return 1;
            if (b.key === OTHERS) return -1;
            return a.key.localeCompare(b.key, "es", { numeric: true });
          });
        lv.moduleList.forEach(function (mod) {
          mod.items.sort(function (a, b) {
            var na = dayNum(a.title), nb = dayNum(b.title);
            if (na !== null && nb !== null && na !== nb) return na - nb;
            if (na !== null && nb === null) return -1;
            if (na === null && nb !== null) return 1;
            return String(a.creationTime || "").localeCompare(String(b.creationTime || ""));
          });
        });
      });
      return list;
    }

    function folderRow(title, sub, onOpen) {
      var row = h('<div class="resource-row" tabindex="0" role="button">' +
        '<div><div style="font-weight:600">' + esc(title) + "</div>" +
        (sub ? '<span style="font-size:13px;color:var(--grafito)">' + esc(sub) + "</span>" : "") + "</div>" +
        '<span class="resource-row__chevron" aria-hidden="true">&rsaquo;</span></div>');
      row.addEventListener("click", onOpen);
      row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } });
      return row;
    }
    function backBtn(label, onBack) {
      var b = h('<button type="button" class="resource-back">&larr; ' + esc(label) + "</button>");
      b.addEventListener("click", onBack);
      return b;
    }
    function modLabel(mod) { return mod.key + (mod.title ? " — " + mod.title : ""); }

    function showLevels(nav, tree) {
      nav.innerHTML = "";
      tree.forEach(function (lv) {
        var n = lv.moduleList.filter(function (m) { return m.key !== OTHERS; }).length;
        nav.appendChild(folderRow(lv.label, n + (n === 1 ? " módulo" : " módulos") + " · " + lv.links.map(function (l) { return l.name; }).join(", "),
          function () { showModules(nav, tree, lv); }));
      });
    }

    function showModules(nav, tree, lv) {
      nav.innerHTML = "";
      nav.appendChild(backBtn("Planificador", function () { showLevels(nav, tree); }));
      nav.appendChild(h('<h2 class="pnl-h" style="font-size:18px;margin-bottom:2px">' + esc(lv.label) + "</h2>"));
      nav.appendChild(h('<p style="margin-bottom:14px">' + lv.links.map(function (l) {
        return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener" style="font-size:12.5px;color:var(--azul);text-decoration:none">Abrir “' + esc(l.name) + "” en Classroom ↗</a>";
      }).join(" · ") + "</p>"));
      if (!lv.moduleList.length) nav.appendChild(h('<div class="pnl-alert ok">Esta clase todavía no tiene materiales.</div>'));
      lv.moduleList.forEach(function (mod) {
        var n = mod.items.length;
        nav.appendChild(folderRow(modLabel(mod), n + (n === 1 ? " clase" : " clases"), function () { showDays(nav, tree, lv, mod); }));
      });
    }

    // Días como acordeón: el contenido (archivos embebidos) solo se carga al
    // abrir cada día, para no traer 16 visores de una vez.
    function showDays(nav, tree, lv, mod) {
      nav.innerHTML = "";
      nav.appendChild(backBtn(lv.label, function () { showModules(nav, tree, lv); }));
      nav.appendChild(h('<h2 class="pnl-h" style="font-size:18px;margin-bottom:14px">' + esc(modLabel(mod)) + "</h2>"));
      mod.items.forEach(function (m) {
        var wrap = h('<div class="cls-day"></div>');
        var row = h('<div class="resource-row" tabindex="0" role="button" aria-expanded="false">' +
          '<div style="font-weight:600">' + esc(m.title || "Sin título") + "</div>" +
          '<span class="resource-row__chevron" aria-hidden="true">&rsaquo;</span></div>');
        var panel = h('<div class="cls-day__body" hidden></div>');
        function toggle() {
          var open = panel.hidden;
          panel.hidden = !open;
          row.setAttribute("aria-expanded", open ? "true" : "false");
          wrap.classList.toggle("is-open", open);
          if (open && !panel.dataset.filled) { panel.dataset.filled = "1"; panel.innerHTML = postBlock(m); }
        }
        row.addEventListener("click", toggle);
        row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        wrap.appendChild(row);
        wrap.appendChild(panel);
        nav.appendChild(wrap);
      });
    }
  }

  /* ============ RECURSOS DE LA CLASE (solo profesor) ============ */
  // Misma mecánica de "carpetas dentro de carpetas" que "Mis recursos" en el
  // portal del estudiante: lista -> nivel -> contenido, cada uno con su
  // botón "Volver". Libro de trabajo reusa el mismo visor de Heyzine
  // (.resource-frame-wrap) que ya ve el estudiante, pero aquí el profesor
  // elige con cuál módulo entrar mediante una barra de búsqueda.
  function secRecursosClase(main) {
    renderRecursosRoot(main);
  }

  function renderRecursosRoot(main) {
    head(main, "Recursos de la clase", "Material de apoyo para tus clases.");
    [
      { id: "libro", label: "Libro de trabajo" },
      { id: "materiales", label: "Materiales" }
    ].forEach(function (it) {
      var row = h('<div class="resource-row" tabindex="0" role="button"><span>' + esc(it.label) +
        '</span><span class="resource-row__chevron" aria-hidden="true">›</span></div>');
      row.addEventListener("click", function () {
        if (it.id === "libro") renderLibroTrabajo(main); else renderMateriales(main);
      });
      row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); } });
      main.appendChild(row);
    });
  }

  function renderLibroTrabajo(main) {
    main.innerHTML = "";
    var back = h('<button type="button" class="resource-back">&larr; Recursos de la clase</button>');
    back.addEventListener("click", function () { renderRecursosRoot(main); });
    main.appendChild(back);
    main.appendChild(h('<h1 class="pnl-h" style="margin-bottom:2px">Libro de trabajo</h1>'));
    main.appendChild(h('<p class="pnl-sub">Busca el módulo cuyo libro quieres abrir.</p>'));

    var searchBox = h('<input type="search" placeholder="Buscar módulo (ej. A1.1, Hello World)…" style="max-width:360px;margin-bottom:14px;display:block">');
    var listBox = h("<div></div>");
    var viewerBox = h("<div></div>");
    main.appendChild(searchBox); main.appendChild(listBox); main.appendChild(viewerBox);

    q("modules").select("id,level,title,heyzine_url,module_number").eq("active", true).order("module_number")
      .then(function (r) {
        if (r.error) throw r.error;
        var mods = r.data || [];

        function paintList(filter) {
          listBox.innerHTML = "";
          var f = (filter || "").trim().toLowerCase();
          var filtered = !f ? mods : mods.filter(function (m) {
            return (m.level + " " + m.title).toLowerCase().indexOf(f) !== -1;
          });
          if (!filtered.length) { listBox.appendChild(h('<p class="muted">Sin resultados.</p>')); return; }
          filtered.forEach(function (m) {
            var row = h(
              '<div class="resource-row" tabindex="0" role="button">' +
              '<div><div class="lvl-tag" style="margin-bottom:2px">' + esc(m.level) + "</div>" +
              '<span style="font-size:13.5px;color:var(--grafito)">' + esc(m.title) + "</span></div>" +
              '<span class="resource-row__chevron" aria-hidden="true">›</span></div>'
            );
            row.addEventListener("click", function () { paintViewer(m); });
            listBox.appendChild(row);
          });
        }

        function paintViewer(m) {
          searchBox.style.display = "none";
          listBox.style.display = "none";
          viewerBox.innerHTML = "";
          var backToList = h('<button type="button" class="resource-back">&larr; Elegir otro módulo</button>');
          backToList.addEventListener("click", function () {
            viewerBox.innerHTML = "";
            searchBox.style.display = ""; listBox.style.display = "";
          });
          viewerBox.appendChild(backToList);
          viewerBox.appendChild(h('<h2 style="font-size:16px;margin:0 0 12px">' + esc(m.level) + " — " + esc(m.title) + "</h2>"));
          if (m.heyzine_url) {
            viewerBox.appendChild(h('<div class="resource-frame-wrap"><iframe src="' + esc(m.heyzine_url) + '" allowfullscreen loading="lazy"></iframe></div>'));
          } else {
            viewerBox.appendChild(h('<div class="pnl-alert ok">Este módulo todavía no tiene un libro cargado.</div>'));
          }
        }

        paintList("");
        searchBox.addEventListener("input", function () { paintList(searchBox.value); });
      }).catch(function (e) { listBox.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
  }

  function renderMateriales(main) {
    main.innerHTML = "";
    var back = h('<button type="button" class="resource-back">&larr; Recursos de la clase</button>');
    back.addEventListener("click", function () { renderRecursosRoot(main); });
    main.appendChild(back);
    main.appendChild(h('<h1 class="pnl-h" style="margin-bottom:2px">Materiales</h1>'));
    main.appendChild(h('<p class="pnl-sub">Elige qué quieres ver.</p>'));
    ["Talleres", "Recursos interactivos", "Material bibliográfico"].forEach(function (label) {
      var row = h('<div class="resource-row" tabindex="0" role="button"><span>' + esc(label) +
        '</span><span class="resource-row__chevron" aria-hidden="true">›</span></div>');
      row.addEventListener("click", function () { renderMaterialCategory(main, label); });
      row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); } });
      main.appendChild(row);
    });
  }

  function renderMaterialCategory(main, label) {
    main.innerHTML = "";
    var back = h('<button type="button" class="resource-back">&larr; Materiales</button>');
    back.addEventListener("click", function () { renderMateriales(main); });
    main.appendChild(back);
    main.appendChild(h('<h1 class="pnl-h" style="margin-bottom:14px">' + esc(label) + "</h1>"));
    main.appendChild(h('<div class="pnl-alert ok">Todavía no hay contenido cargado aquí — LEF lo agregará pronto.</div>'));
  }

  /* ============ CALENDARIO (solo profesor) ============ */
  // Usa la misma conexión de Google que Planificador (mismo token, se pidió
  // el scope de Calendar en la misma pantalla de consentimiento) — no hay un
  // botón "Conectar" aparte aquí. Se pinta como cuadrícula de mes (igual que
  // Google Calendar) con los eventos que trae calendar-list; no se embebe el
  // calendario de Google porque ese solo funciona si el navegador tiene
  // abierta la sesión de Google del profesor.
  var GCAL_COLORS = { "1": "#7986cb", "2": "#33b679", "3": "#8e24aa", "4": "#e67c73", "5": "#f6bf26", "6": "#f4511e",
    "7": "#039be5", "8": "#616161", "9": "#3f51b5", "10": "#0b8043", "11": "#d50000" };
  var CAL_DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  function secCalendario(main) {
    head(main, "Calendario", "Tu Google Calendar, mes a mes.");
    var body = h("<div></div>");
    main.appendChild(body);
    body.innerHTML = '<p class="muted">Cargando…</p>';

    rpc("get_my_classroom_connection").then(function (r) {
      var conn = (r && r[0]) || { connected: false };
      body.innerHTML = "";
      if (!conn.connected) {
        var card = h(
          '<div class="pnl-table-wrap" style="padding:24px;text-align:center">' +
          '<p class="pnl-sub" style="margin-bottom:16px">Conecta tu cuenta de Google desde <strong>Planificador</strong> para ver aquí tu calendario.</p>' +
          '<button class="btn btn-blue" data-go>Ir a Planificador</button></div>'
        );
        body.appendChild(card);
        card.querySelector("[data-go]").addEventListener("click", function () { location.hash = "classroom"; });
        return;
      }
      var now = new Date();
      showMonth(now.getFullYear(), now.getMonth());
    }).catch(function (e) { body.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });

    function keyOf(d) { return ymd(d.getFullYear(), d.getMonth(), d.getDate()); }
    function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
    function fmtEventTime(iso) {
      if (!iso || iso.length <= 10) return "";
      return new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
    }
    function evColor(ev) { return GCAL_COLORS[ev.colorId] || "var(--azul)"; }

    // Días (yyyy-mm-dd) que ocupa un evento. Todo el día: el "end" de Google
    // es exclusivo. Con hora: desde el día de inicio hasta el de fin.
    function eventDays(ev) {
      var start = ev.allDay ? new Date(ev.start + "T00:00:00") : new Date(ev.start);
      var end = ev.allDay ? addDays(new Date(ev.end + "T00:00:00"), -1) : new Date(ev.end || ev.start);
      var out = [], d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      var last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      for (var i = 0; d <= last && i < 62; i++) { out.push(keyOf(d)); d = addDays(d, 1); }
      return out.length ? out : [keyOf(start)];
    }

    function showMonth(year, month) {
      body.innerHTML = "";
      var first = new Date(year, month, 1);
      var gridStart = addDays(first, -((first.getDay() + 6) % 7)); // lunes anterior
      var lastOfMonth = new Date(year, month + 1, 0);
      var gridEnd = addDays(lastOfMonth, 6 - ((lastOfMonth.getDay() + 6) % 7)); // domingo siguiente
      var monthName = first.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

      var bar = h(
        '<div class="cal-bar">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-today>Hoy</button>' +
        '<button type="button" class="cal-nav" data-prev aria-label="Mes anterior">&lsaquo;</button>' +
        '<button type="button" class="cal-nav" data-next aria-label="Mes siguiente">&rsaquo;</button>' +
        '<h2 class="cal-title">' + esc(monthName.charAt(0).toUpperCase() + monthName.slice(1)) + "</h2>" +
        '<span class="muted cal-status" data-status>Cargando eventos…</span>' +
        "</div>"
      );
      body.appendChild(bar);
      bar.querySelector("[data-today]").onclick = function () { var n = new Date(); showMonth(n.getFullYear(), n.getMonth()); };
      bar.querySelector("[data-prev]").onclick = function () { showMonth(month === 0 ? year - 1 : year, (month + 11) % 12); };
      bar.querySelector("[data-next]").onclick = function () { showMonth(month === 11 ? year + 1 : year, (month + 1) % 12); };

      var grid = h('<div class="cal-grid"></div>');
      CAL_DOW.forEach(function (d) { grid.appendChild(h('<div class="cal-dow">' + d + "</div>")); });
      var cells = {}, todayKey = keyOf(new Date());
      for (var d = new Date(gridStart); d <= gridEnd; d = addDays(d, 1)) {
        var k = keyOf(d);
        var cell = h('<div class="cal-cell' + (d.getMonth() !== month ? " is-out" : "") + (k === todayKey ? " is-today" : "") + '">' +
          '<span class="cal-num">' + d.getDate() + "</span><div class=\"cal-evs\"></div></div>");
        cells[k] = { el: cell, events: [], date: new Date(d) };
        grid.appendChild(cell);
      }
      body.appendChild(grid);

      callEdgeFn("calendar-list", {
        timeMin: gridStart.toISOString(),
        timeMax: addDays(gridEnd, 1).toISOString()
      }).then(function (res) {
        var status = bar.querySelector("[data-status]");
        if (!res || res.connected === false) {
          status.textContent = "";
          body.appendChild(h('<div class="pnl-alert err" style="margin-top:12px">Tu conexión con Google expiró — desconéctate y vuelve a conectarte desde Planificador.</div>'));
          return;
        }
        var events = res.events || [];
        status.textContent = events.length ? "" : "Sin eventos este mes";
        events.forEach(function (ev) {
          eventDays(ev).forEach(function (k) { if (cells[k]) cells[k].events.push(ev); });
        });
        Object.keys(cells).forEach(function (k) { fillCell(cells[k]); });
      }).catch(function (e) {
        bar.querySelector("[data-status]").textContent = "";
        body.appendChild(h('<div class="pnl-alert err" style="margin-top:12px">No pudimos cargar tu calendario: ' + esc((e && e.message) || e) + "</div>"));
      });
    }

    // Hasta 3 eventos por día en la celda; el resto en "+N más". Tocar el día
    // abre el detalle con todos sus eventos.
    function fillCell(c) {
      if (!c.events.length) return;
      c.events.sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return String(a.start).localeCompare(String(b.start));
      });
      var box = c.el.querySelector(".cal-evs");
      c.events.slice(0, 3).forEach(function (ev) {
        box.appendChild(h(ev.allDay
          ? '<div class="cal-ev cal-ev--allday" style="background:' + evColor(ev) + '">' + esc(ev.summary) + "</div>"
          : '<div class="cal-ev" style="--c:' + evColor(ev) + '"><span class="cal-dot" style="background:' + evColor(ev) + '"></span>' +
            '<span class="cal-ev__time">' + esc(fmtEventTime(ev.start)) + "</span> " + esc(ev.summary) + "</div>"));
      });
      if (c.events.length > 3) box.appendChild(h('<div class="cal-more">+' + (c.events.length - 3) + " más</div>"));
      c.el.classList.add("has-events");
      c.el.addEventListener("click", function () { dayDetail(c); });
    }

    function dayDetail(c) {
      var label = c.date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
      var list = h("<div></div>");
      c.events.forEach(function (ev) {
        var when = ev.allDay ? "Todo el día" : fmtEventTime(ev.start) + (ev.end ? " – " + fmtEventTime(ev.end) : "");
        list.appendChild(h(
          '<div class="cal-detail">' +
          '<span class="cal-dot" style="background:' + evColor(ev) + ';margin-top:6px"></span>' +
          '<div style="flex:1;min-width:0"><p style="font-weight:600;font-size:14px">' + esc(ev.summary) + "</p>" +
          '<p class="muted" style="font-size:12.5px">' + esc(when) + (ev.location ? " · " + esc(ev.location) : "") + "</p>" +
          '<p style="font-size:12.5px;margin-top:2px">' +
          (ev.hangoutLink ? '<a href="' + esc(ev.hangoutLink) + '" target="_blank" rel="noopener" style="color:var(--azul);text-decoration:none;margin-right:12px">Unirse a Meet ↗</a>' : "") +
          (ev.htmlLink ? '<a href="' + esc(ev.htmlLink) + '" target="_blank" rel="noopener" style="color:var(--azul);text-decoration:none">Ver en Google Calendar ↗</a>' : "") +
          "</p></div></div>"
        ));
      });
      modal(label.charAt(0).toUpperCase() + label.slice(1), list, null, "Cerrar", false);
    }
  }

  /* ============ PAGOS ============ */
  function secPagos(main) {
    head(main, "Pagos", "El cobro de cada módulo y su estado de pago. El estudiante paga en línea con Wompi desde su portal, o registrás el pago (o un abono) aquí a mano.");
    var bar = h('<div class="pnl-toolbar"></div>');
    main.appendChild(bar);
    Promise.all([
      rpc("admin_billing_overview"),
      q("students").select("id,full_name,doc_type,doc_number,email,whatsapp").order("full_name"),
      activeModules(),
      q("enrollments").select("student_id,module_id,status,created_at,modules(level)").order("created_at", { ascending: false })
    ]).then(function (res) {
        var rows = res[0] || [], students = res[1].data || [], mods = res[2];
        // Por estudiante: módulo actual (más reciente pendiente/activo) y módulos ya completados.
        var enrInfo = {};
        ((res[3] && res[3].data) || []).forEach(function (e) {
          var inf = enrInfo[e.student_id] = enrInfo[e.student_id] || { current: null, completed: {} };
          if (e.status === "Completed") inf.completed[e.module_id] = true;
          else if ((e.status === "PendingPayment" || e.status === "Active") && !inf.current) inf.current = e;
        });
        var newBtn = h('<button class="btn btn-dark btn-sm" data-new>+ Generar pago</button>');
        bar.appendChild(newBtn);
        newBtn.onclick = function () { editarSuscripcion(null, students, mods, enrInfo); };
        var t = tableWrap(["Estudiante / pagador", "Módulo", "Mensualidad", "Pagado", "Último pago", "Estado", "Acciones"]);
        rows.forEach(function (r) {
          var paid = r.paid_amount || 0;
          var st = r.status === "frozen" ? '<span class="badge bad">congelada</span>'
            : r.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
            : paid <= 0 ? '<span class="badge neutral">pendiente</span>'
            : paid < r.monthly_amount ? '<span class="badge warn">pago parcial</span>'
            : '<span class="badge ok">al día</span>';
          var who = esc(r.student_name) +
            (r.student_deleted ? ' <span class="badge neutral">estudiante eliminado</span>' : "") +
            (r.payer_name && r.payer_name !== r.student_name
              ? '<br><span class="muted" style="font-size:12px">paga: ' + esc(r.payer_name) +
                (r.payer_doc_number ? " (" + esc((r.payer_doc_type || "") + " " + r.payer_doc_number) + ")" : "") + "</span>"
              : "");
          var tr = h("<tr><td>" + who + '</td><td class="wrap">' + esc(r.module_label || "—") +
            "</td><td>" + money(r.monthly_amount, r.currency) + "</td><td>" + money(paid, r.currency) + "</td><td>" +
            (r.last_payment_at ? date(r.last_payment_at) + " · " + money(r.last_payment_amount, r.currency) : "—") +
            '</td><td>' + st + '</td><td class="acts"></td></tr>');
          var cell = tr.children[6];
          cell.appendChild(btn("Ver pagos", "btn-ghost", function () { verPagos(r); }));
          if (!r.student_deleted) {
            cell.appendChild(btn("Registrar pago", "btn-blue", function () { registrarPago(r); }));
            cell.appendChild(btn("Editar", "btn-ghost", function () { editarSuscripcion(r, students, mods); }));
          }
          // "Eliminar" también para cobros de estudiantes ya borrados: si no
          // tienen pagos, no deben quedar flotando sin dueño en la lista.
          cell.appendChild(btn("Eliminar", "btn-danger", function () {
            promptReason("Eliminar suscripción",
              (r.student_deleted ? "El estudiante de este cobro ya fue eliminado. " : "") +
              "Si tiene pagos registrados, bórralos primero desde “Ver pagos” (cada uno pide su propio motivo).",
              "Eliminar", function (reason) {
                return rpc("admin_delete_subscription", { p_subscription_id: r.subscription_id, p_reason: reason })
                  .then(function () { toast("Suscripción eliminada."); route(); });
              });
          }));
          t.body.appendChild(tr);
        });
        if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Sin pagos generados. Crea uno con “Generar pago”.</td></tr>'));
        main.appendChild(t.wrap);
      }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function verPagos(r) {
    var box = h('<div><p class="muted">Cargando…</p></div>');
    modal("Pagos — " + r.student_name, box, null, "Cerrar", false, true);
    q("payments").select("*").eq("subscription_id", r.subscription_id).order("paid_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        var pays = res.data || [];
        box.innerHTML = "";
        if (!pays.length) { box.appendChild(h('<p class="muted">Sin pagos en esta suscripción.</p>')); return; }
        var reversedIds = {};
        pays.forEach(function (p) { if (p.reverses_payment) reversedIds[p.reverses_payment] = true; });
        var tbl = tableWrap(["Recibo", "Mes", "Monto", "Método", "Pagador", "Estado", ""]);
        pays.forEach(function (p) {
          var isReversal = !!p.reverses_payment;
          var isReversed = reversedIds[p.id];
          var estado = p.status === "refunded" ? '<span class="badge neutral">reverso</span>'
            : isReversed ? '<span class="badge warn">reversado</span>'
            : '<span class="badge ok">' + esc(PAYST_ES[p.status] || p.status) + "</span>";
          var tr = h("<tr><td>" + esc(p.receipt_number || "—") +
            (p.gateway_txn_id ? '<br><span class="muted" style="font-size:11px">Wompi: ' + esc(p.gateway_txn_id) + "</span>" : "") +
            "</td><td>" + esc((p.period_month || "").slice(0, 7)) +
            "</td><td>" + money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) +
            '</td><td class="wrap">' + esc((p.payer_name || "—") + (p.payer_doc_number ? " · " + (p.payer_doc_type || "") + " " + p.payer_doc_number : "")) +
            "</td><td>" + estado + '</td><td class="acts"></td></tr>');
          if (!isReversal && !isReversed && p.status === "approved") {
            tr.children[6].appendChild(btn("Reversar", "btn-danger", function () { reversarPago(p); }));
          }
          tr.children[6].appendChild(btn("Editar", "btn-ghost", function () { editarPago(p, function () { verPagos(r); }); }));
          tr.children[6].appendChild(btn("Eliminar", "btn-danger", function () { eliminarPago(p, function () { verPagos(r); }); }));
          tbl.body.appendChild(tr);
        });
        box.appendChild(tbl.wrap);
      }).catch(function (e) { box.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
  }

  function editarPago(p, onDone) {
    var b = h("<div>" +
      '<p class="pnl-sub" style="margin-bottom:10px">Corrige un dato mal capturado del pago ' + esc(p.receipt_number || p.id) + '. Queda anotado en el Registro de eventos.</p>' +
      field("Monto (COP)", '<input name="amt" type="number" min="0" value="' + p.amount + '">') +
      field("Método", '<select name="m">' + Object.keys(METHOD_ES).map(function (k) {
        return '<option value="' + k + '"' + (k === p.method ? " selected" : "") + ">" + esc(METHOD_ES[k]) + "</option>";
      }).join("") + "</select>") +
      field("Mes cubierto", '<input name="pm" type="month" value="' + (p.period_month || "").slice(0, 7) + '">') +
      field("Notas", '<input name="note" value="' + esc(p.notes || "") + '">') +
      field("Motivo de la corrección (obligatorio, queda en el Registro de eventos)", '<input name="reason" placeholder="Ej.: monto mal digitado">') +
      "</div>");
    modal("Editar pago", b, function () {
      var reason = (b.querySelector("[name=reason]").value || "").trim();
      if (reason.length < 3) throw new Error("Escribe el motivo de la corrección.");
      return rpc("admin_update_payment", {
        p_payment_id: p.id, p_reason: reason,
        p_amount: +b.querySelector("[name=amt]").value || null,
        p_method: b.querySelector("[name=m]").value,
        p_period_month: b.querySelector("[name=pm]").value + "-01",
        p_notes: b.querySelector("[name=note]").value.trim() || null
      }).then(function () { toast("Pago corregido."); onDone && onDone(); });
    }, "Guardar corrección");
  }

  function eliminarPago(p, onDone) {
    promptReason("Eliminar pago",
      "Se borra de verdad el recibo " + esc(p.receipt_number || p.id) + " (" + money(p.amount, p.currency) +
      "). No se puede deshacer — si el pago sí ocurrió y solo quieres corregirlo, usa “Editar”, y si el estudiante ya no debe ese cobro, usa “Reversar”.",
      "Eliminar", function (reason) {
        return rpc("admin_delete_payment", { p_payment_id: p.id, p_reason: reason })
          .then(function () { toast("Pago eliminado."); onDone && onDone(); });
      });
  }

  function reversarPago(p) {
    var b = h("<div>" +
      '<p class="pnl-sub" style="margin-bottom:10px">Se creará un asiento de <strong>reverso</strong> del recibo ' + esc(p.receipt_number || p.id) +
      " por " + money(p.amount, p.currency) + ". El pago original queda en el libro (no se borra). Revisa después la fecha del próximo pago de la suscripción.</p>" +
      field("Motivo del reverso", '<input name="reason" placeholder="Ej.: monto equivocado, pago duplicado">') +
      "</div>");
    modal("Reversar pago", b, function () {
      var reason = (b.querySelector("[name=reason]").value || "").trim();
      if (reason.length < 3) throw new Error("Escribe el motivo del reverso.");
      return rpc("admin_reverse_payment", { p_payment_id: p.id, p_reason: reason })
        .then(function () { toast("Reverso registrado."); route(); });
    }, "Reversar", true);
  }

  function payerFields(src) {
    src = src || {};
    return '<p class="pnl-sub" style="margin:14px 0 6px;font-weight:600">Datos de quien paga (para el libro contable)</p>' +
      field("Nombre de quien paga", '<input name="pn" value="' + esc(src.name || "") + '">') +
      field("Tipo de documento", docSelect("pdt", src.docType || "CC")) +
      field("Número de documento", '<input name="pdn" value="' + esc(src.docNumber || "") + '">') +
      field("Correo (opcional)", '<input name="pe" type="email" value="' + esc(src.email || "") + '">') +
      field("Teléfono (opcional)", '<input name="pp" value="' + esc(src.phone || "") + '">');
  }
  function readPayer(box) {
    var g = function (n) { var el = box.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
    var name = g("pn"), doc = g("pdn");
    if (name.length < 2 || doc.length < 3) throw new Error("Ingresa el nombre y el documento de quien paga.");
    return {
      p_payer_name: name, p_payer_doc_type: g("pdt"), p_payer_doc_number: doc,
      p_payer_email: g("pe") || null, p_payer_phone: g("pp") || null
    };
  }
  function payerFromStudent(s) {
    return s ? { name: s.full_name, docType: s.doc_type, docNumber: s.doc_number, email: s.email, phone: s.whatsapp } : {};
  }

  function editarSuscripcion(r, students, mods, enrInfo) {
    if (!r && !students.length) { toast("No hay estudiantes todavía.", "err"); return; }
    var byId = {}; students.forEach(function (s) { byId[s.id] = s; });
    var modById = {}; mods.forEach(function (m) { modById[m.id] = m; });
    var initPayer = r
      ? { name: r.payer_name, docType: r.payer_doc_type, docNumber: r.payer_doc_number, email: r.payer_email, phone: r.payer_phone }
      : payerFromStudent(students[0]);
    var body = h("<div>" +
      (r ? "" : field("Estudiante", '<select name="sid">' + students.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.full_name) + "</option>";
      }).join("") + "</select>")) +
      (r ? field("Módulo", moduleSelect("mod", mods, r.module_id))
         : fieldBlock("Módulo", '<div data-modpick></div>') + '<p class="pnl-sub" data-modnote style="margin:-4px 0 12px"></p>') +
      (r ? field("Mensualidad (COP)", '<input name="amt" type="number" min="0" value="' + r.monthly_amount + '">')
         : fixedPriceField()) +
      (r ? "" :
        field("Abono inicial (COP, opcional)", '<input name="abono" type="number" min="0" value="0">') +
        field("Método del abono", '<select name="abonoM">' + Object.keys(METHOD_ES).map(function (k) {
          return '<option value="' + k + '">' + esc(METHOD_ES[k]) + "</option>";
        }).join("") + "</select>") +
        '<p class="pnl-sub" style="margin:-4px 0 10px">Si el estudiante ya entregó algo de dinero, regístralo aquí — con eso ya queda <strong>activo</strong> en el sistema. Si no alcanza a cubrir la mensualidad completa, queda marcado como <strong>pago parcial</strong> hasta completarla — puedes seguir sumando abonos después con “Registrar pago”.</p>') +
      (r ? field("Estado", '<select name="status"><option value="active">Activa</option><option value="frozen">Congelada</option><option value="cancelled">Cancelada</option></select>') : "") +
      payerFields(initPayer) +
      (r ? "" : '<p class="pnl-sub">Si el estudiante es mayor y paga él mismo, deja sus datos. Si paga un familiar, cámbialos.</p>') +
      "</div>");
    if (r) {
      body.querySelector("[name=mod]").value = r.module_id || (mods[0] && mods[0].id);
      if (body.querySelector("[name=status]")) body.querySelector("[name=status]").value = r.status;
    }
    var sidSel = body.querySelector("[name=sid]");
    // "Generar pago" también inscribe al estudiante en el módulo elegido
    // (admin_create_subscription): el selector marca lo ya completado y
    // explica qué va a pasar con su módulo actual antes de guardar.
    function infoFor(sid) { return (enrInfo && enrInfo[sid]) || { current: null, completed: {} }; }
    function paintModNote() {
      var inf = infoFor(sidSel.value), picked = pickedValue(body, "mod"), cur = inf.current;
      var note = body.querySelector("[data-modnote]"), txt;
      if (!picked) txt = "";
      else if (inf.completed[picked]) txt = "Ya completó este módulo: solo se genera el cobro (p. ej. una mensualidad pendiente), <strong>no</strong> se vuelve a inscribir ni cambia su módulo actual.";
      else if (cur && cur.module_id === picked) txt = "Es su módulo actual: el cobro queda atado a esa inscripción.";
      else if (cur && cur.status === "Active") txt = "⚠️ Hoy está cursando " + esc(cur.modules ? cur.modules.level : "otro módulo") + " (activo). Si generas el cobro de este módulo, el actual queda como <strong>completado</strong> y se le inscribe en este.";
      else if (cur) txt = "Hoy tiene " + esc(cur.modules ? cur.modules.level : "otro módulo") + " pendiente de pago: su inscripción se cambia a este módulo.";
      else txt = "No tiene módulo en curso: queda inscrito en este módulo (pendiente de pago) y aparece así en Estudiantes.";
      note.innerHTML = txt;
    }
    function paintModPicker() {
      var inf = infoFor(sidSel.value);
      var suggested = inf.current ? null : suggestNextModule(mods, inf.completed, modById);
      var firstOpen = mods.filter(function (m) { return !inf.completed[m.id]; })[0];
      var sel = inf.current ? inf.current.module_id : (suggested || (firstOpen && firstOpen.id) || (mods[0] && mods[0].id));
      var host = body.querySelector("[data-modpick]");
      host.innerHTML = modulePicker("mod", mods, sel, inf.completed, { suggestedId: suggested });
      host.querySelectorAll("[name=mod]").forEach(function (x) { x.onchange = paintModNote; });
      paintModNote();
    }
    if (sidSel) {
      paintModPicker();
      sidSel.onchange = function () {
        var p = payerFromStudent(byId[sidSel.value]);
        body.querySelector("[name=pn]").value = p.name || "";
        body.querySelector("[name=pdt]").value = p.docType || "CC";
        body.querySelector("[name=pdn]").value = p.docNumber || "";
        body.querySelector("[name=pe]").value = p.email || "";
        body.querySelector("[name=pp]").value = p.phone || "";
        paintModPicker();
      };
    }
    modal(r ? "Editar suscripción" : "Generar pago", body, function () {
      var payer = readPayer(body);
      var payload = {
        module_id: r ? body.querySelector("[name=mod]").value : pickedValue(body, "mod"),
        // Al crear, siempre el precio fijo; solo "Editar" permite cambiarlo.
        monthly_amount: r ? (+body.querySelector("[name=amt]").value || 0) : MONTHLY_PRICE,
        payer_name: payer.p_payer_name, payer_doc_type: payer.p_payer_doc_type,
        payer_doc_number: payer.p_payer_doc_number, payer_email: payer.p_payer_email,
        payer_phone: payer.p_payer_phone
      };
      if (r) {
        payload.status = body.querySelector("[name=status]").value;
        payload.updated_at = new Date().toISOString();
        return q("subscriptions").update(payload).eq("id", r.subscription_id).then(function (u) {
          if (u.error) throw u.error; toast("Suscripción actualizada."); route();
        });
      }
      if (!payload.module_id) throw new Error("Elige el módulo.");
      var abono = +body.querySelector("[name=abono]").value || 0;
      return rpc("admin_create_subscription", Object.assign({
        p_student_id: body.querySelector("[name=sid]").value,
        p_module_id: payload.module_id,
        p_monthly_amount: payload.monthly_amount
      }, payer)).then(function (subId) {
        if (abono > 0) {
          return rpc("record_payment", Object.assign({
            p_subscription_id: subId, p_amount: abono,
            p_method: body.querySelector("[name=abonoM]").value
          }, payer)).then(function () { toast("Pago generado."); route(); });
        }
        toast("Pago generado."); route();
      });
    }, r ? "Guardar" : "Generar");
  }

  function registrarPago(r) {
    var now = new Date();
    var paid = r.paid_amount || 0;
    var remaining = Math.max(r.monthly_amount - paid, 0);
    var progress = paid <= 0
      ? '<p class="pnl-sub" style="margin-bottom:10px">Todavía no hay ningún abono registrado para esta mensualidad de ' + money(r.monthly_amount, r.currency) + ".</p>"
      : '<p class="pnl-sub" style="margin-bottom:10px">Ya se han abonado <strong>' + money(paid, r.currency) + "</strong> de " + money(r.monthly_amount, r.currency) +
        (remaining > 0 ? " — falta " + money(remaining, r.currency) + " para completarla." : " — ya está completa.") + "</p>";
    var body = h("<div>" + progress +
      field("Monto del abono (COP)", '<input name="amt" type="number" min="0" value="' + (remaining || "") + '">') +
      field("Método", '<select name="m"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="pse">PSE</option><option value="card">Tarjeta</option><option value="other">Otro</option></select>') +
      field("Mes que cubre", '<input name="pm" type="month" value="' + now.toISOString().slice(0, 7) + '">') +
      field("Referencia / nº de soporte (opcional)", '<input name="ref" placeholder="Nº de consignación, transferencia…">') +
      field("Nota (opcional)", '<input name="note">') +
      payerFields({
        name: r.payer_name, docType: r.payer_doc_type, docNumber: r.payer_doc_number,
        email: r.payer_email, phone: r.payer_phone
      }) +
      '<p class="pnl-sub">Registra el documento que figura en el soporte del pago (puede ser distinto al del estudiante). El estudiante queda activo con este abono; si el monto no completa la mensualidad, queda marcado como pago parcial hasta completarla.</p>' +
      "</div>");
    modal("Registrar pago — " + r.student_name, body, function () {
      var payer = readPayer(body);
      return rpc("record_payment", Object.assign({
        p_subscription_id: r.subscription_id,
        p_amount: +body.querySelector("[name=amt]").value || 0,
        p_method: body.querySelector("[name=m]").value,
        p_period_month: body.querySelector("[name=pm]").value + "-01",
        p_reference: body.querySelector("[name=ref]").value.trim() || null,
        p_notes: body.querySelector("[name=note]").value.trim() || null
      }, payer)).then(function () { toast("Pago registrado."); route(); });
    }, "Registrar");
  }

  /* ============ NOVEDADES (tablón "Inicio" del portal) ============ */
  var NEWS_CAT_ES = { novedad: "Novedad", academico: "Académico", evento: "Evento", pagos: "Pagos", importante: "Importante" };
  // Fotos de Pexels ya incluidas en el sitio, para elegir portada sin buscar enlaces.
  var NEWS_GALLERY = [
    "assets/inicio/noticia-clase-online.jpg", "assets/inicio/noticia-online-classes.jpg",
    "assets/inicio/noticia-apuntes.jpg", "assets/inicio/noticia-tablero.jpg",
    "assets/inicio/noticia-curso.jpg", "assets/inicio/hero-estudio.jpg"
  ];

  function secNovedades(main) {
    head(main, "Novedades", "Lo que publiques aquí aparece en el Inicio del portal de los estudiantes: primero las fijadas, luego las más recientes.");
    var bar = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Nueva novedad</button></div>');
    main.appendChild(bar);
    Promise.all([
      q("announcements").select("*,modules(level)").order("pinned", { ascending: false }).order("publish_at", { ascending: false }),
      activeModules()
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var rows = res[0].data || [], mods = res[1];
      bar.querySelector("button").onclick = function () { editNovedad(null, mods); };
      var todayStr = new Date().toISOString().slice(0, 10);
      var t = tableWrap(["Novedad", "Categoría", "Para", "Publicada", "Vence", "Estado", "Acciones"]);
      rows.forEach(function (n) {
        var expired = n.expires_at && n.expires_at < todayStr;
        var future = new Date(n.publish_at) > new Date();
        var st = !n.published ? '<span class="badge neutral">borrador</span>'
          : expired ? '<span class="badge neutral">vencida</span>'
          : future ? '<span class="badge warn">programada</span>'
          : '<span class="badge ok">visible</span>';
        var tr = h("<tr><td class=\"wrap\">" + (n.pinned ? "📌 " : "") + "<strong>" + esc(n.title) + "</strong>" +
          '<br><span class="muted" style="font-size:12px">' + esc((n.body || "").slice(0, 90)) + ((n.body || "").length > 90 ? "…" : "") + "</span></td>" +
          "<td>" + esc(NEWS_CAT_ES[n.category] || n.category) + "</td>" +
          "<td>" + esc(n.modules ? "Quienes cursan " + n.modules.level : "Todos") + "</td>" +
          "<td>" + date(n.publish_at) + "</td><td>" + (n.expires_at ? date(n.expires_at) : "—") + "</td>" +
          "<td>" + st + '</td><td class="acts"></td></tr>');
        var cell = tr.children[6];
        cell.appendChild(btn(n.pinned ? "Desfijar" : "Fijar", "btn-ghost", function () {
          q("announcements").update({ pinned: !n.pinned, updated_at: new Date().toISOString() }).eq("id", n.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else route(); });
        }));
        cell.appendChild(btn(n.published ? "Ocultar" : "Publicar", "btn-ghost", function () {
          q("announcements").update({ published: !n.published, updated_at: new Date().toISOString() }).eq("id", n.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else route(); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () { editNovedad(n, mods); }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar novedad", "Se borra “" + n.title + "” y deja de verse en el portal de los estudiantes.", function () {
            return q("announcements").delete().eq("id", n.id).then(function (d) { if (d.error) throw d.error; toast("Novedad eliminada."); route(); });
          });
        }));
        t.body.appendChild(tr);
      });
      if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Todavía no hay novedades. Crea la primera con “+ Nueva novedad”.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  // Quién la verá: estudiantes con cuenta de portal activa; si va dirigida a un
  // módulo, solo los que lo están CURSANDO (pendiente de pago o activo) — los
  // que ya lo completaron no la ven. Se cuenta en vivo en el formulario.
  function loadNewsAudience() {
    return Promise.all([
      q("profiles").select("student_id").eq("role", "student").eq("active", true),
      q("enrollments").select("student_id,module_id").in("status", ["PendingPayment", "Active"])
    ]).then(function (res) {
      var withAccount = {};
      (res[0].data || []).forEach(function (p) { if (p.student_id) withAccount[p.student_id] = true; });
      var byModule = {};
      (res[1].data || []).forEach(function (e) {
        if (!withAccount[e.student_id]) return;
        (byModule[e.module_id] = byModule[e.module_id] || {})[e.student_id] = true;
      });
      return { all: Object.keys(withAccount).length, byModule: byModule };
    }).catch(function () { return null; });
  }

  // Achica la imagen en el navegador antes de subirla (máx. 1600 px de ancho,
  // JPEG): una foto de celular de 5-10 MB queda en unos cientos de KB.
  function shrinkImage(file) {
    return new Promise(function (resolve) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return resolve(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, 1600 / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { resolve(blob || file); }, "image/jpeg", 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  function editNovedad(n, mods) {
    n = n || {};
    var img = n.image_url || "";
    var custom = img && NEWS_GALLERY.indexOf(img) === -1 ? img : "";
    var pubLocal = n.publish_at ? new Date(new Date(n.publish_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    var modById = {}; mods.forEach(function (m) { modById[m.id] = m; });
    var b = h('<div class="news-editor"><div class="news-editor__form">' +
      field("Título", '<input name="t" maxlength="140" value="' + esc(n.title || "") + '">') +
      field("Categoría", '<select name="c">' + Object.keys(NEWS_CAT_ES).map(function (k) {
        return '<option value="' + k + '"' + ((n.category || "novedad") === k ? " selected" : "") + ">" + esc(NEWS_CAT_ES[k]) + "</option>";
      }).join("") + "</select>") +
      field("Texto", '<textarea name="b" rows="6" placeholder="Lo que quieres contarle a los estudiantes. Los saltos de línea se respetan.">' + esc(n.body || "") + "</textarea>") +
      fieldBlock("Imagen de portada", '<div class="news-gal">' +
        '<label class="news-gal__opt news-gal__none"><input type="radio" name="img" value=""' + (!img ? " checked" : "") + "><span>Sin imagen</span></label>" +
        NEWS_GALLERY.map(function (src) {
          return '<label class="news-gal__opt"><input type="radio" name="img" value="' + src + '"' + (img === src ? " checked" : "") + '><img src="' + src + '" alt=""></label>';
        }).join("") +
        '<label class="news-gal__opt news-gal__none" data-custom-tile><input type="radio" name="img" value="__custom"' + (custom ? " checked" : "") + ">" +
        (custom ? '<img src="' + esc(custom) + '" alt="">' : "<span>Tu imagen</span>") + "</label>" +
        "</div>" +
        '<div class="news-upload">' +
        '<button type="button" class="btn btn-sm btn-blue" data-upload>Subir imagen desde tu equipo</button>' +
        '<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file hidden>' +
        '<span class="muted" data-upload-msg style="font-size:12.5px"></span></div>' +
        '<input name="imgurl" placeholder="…o pega el enlace de una imagen (https://…)" value="' + esc(custom) + '">') +
      field("Enlace (opcional)", '<input name="l" placeholder="https://…" value="' + esc(n.link_url || "") + '">') +
      field("Texto del botón del enlace", '<input name="ll" placeholder="Ej.: Inscríbete aquí" value="' + esc(n.link_label || "") + '">') +
      field("¿Para quién?", '<select name="m"><option value="">Todos los estudiantes</option>' + mods.map(function (m) {
        return '<option value="' + m.id + '"' + (n.module_id === m.id ? " selected" : "") + ">Solo quienes están cursando " + esc(m.level + " · " + m.title) + "</option>";
      }).join("") + "</select>") +
      '<p class="news-audience" data-audience>Calculando a cuántos estudiantes les llega…</p>' +
      field("Publicar desde (vacío = ahora)", '<input name="pa" type="datetime-local" value="' + esc(pubLocal) + '">') +
      field("Deja de verse después del (opcional)", '<input name="ex" type="date" value="' + esc(n.expires_at || "") + '">') +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin:4px 0 8px"><input type="checkbox" name="pin" style="width:auto"' + (n.pinned ? " checked" : "") + "> Fijar arriba del tablón</label>" +
      '<label style="display:flex;gap:8px;align-items:center;font-size:14px;margin-bottom:8px"><input type="checkbox" name="pub" style="width:auto"' + (n.id && !n.published ? "" : " checked") + "> Publicada (si la desmarcas queda como borrador)</label>" +
      '</div><div class="news-editor__preview"><div class="news-editor__sticky">' +
      '<p class="fld-title">Vista previa — así la verá el estudiante</p><div data-prev-card></div>' +
      '<p class="fld-title" style="margin-top:16px">Al darle “Leer más”</p><div class="news-prev-open" data-prev-open></div>' +
      "</div></div></div>");

    var val = function (k) { return (b.querySelector("[name=" + k + "]").value || "").trim(); };
    function currentImage() {
      var pick = pickedValue(b, "img");
      return pick === "__custom" ? val("imgurl") : pick;
    }
    var okImg = function (u) { return /^(https:\/\/|assets\/)/.test(u || "") ? u : ""; };

    // Vista previa en vivo: mismo HTML y estilos que el Inicio del portal.
    function renderPreview() {
      var cat = val("c"), title = val("t") || "Título de la novedad", body = val("b");
      var imgUrl = okImg(currentImage());
      var mod = modById[val("m")];
      var pinned = b.querySelector("[name=pin]").checked;
      var excerpt = body.length > 160 ? body.slice(0, 157).trim() + "…" : body;
      var pa = val("pa"), when = (pa ? new Date(pa) : new Date()).toISOString();
      var metaOpen = '<div class="news-card__meta"><span class="news-cat cat-' + esc(cat) + '">' + esc(NEWS_CAT_ES[cat] || cat) + "</span>";
      var modTag = mod ? '<span class="news-mod">Módulo ' + esc(mod.level) + "</span>" : "";
      b.querySelector("[data-prev-card]").innerHTML =
        '<article class="news-card' + (pinned ? " news-card--pinned" : "") + '">' +
        (imgUrl ? '<div class="news-card__img"><img src="' + esc(imgUrl) + '" alt=""></div>' : "") +
        '<div class="news-card__body">' + metaOpen +
        (pinned ? '<span class="news-pin">📌 Fijado</span>' : "") + '<span class="news-new">Nuevo</span>' + modTag + "</div>" +
        "<h3>" + esc(title) + "</h3>" +
        '<p class="news-card__date">' + esc(date(when)) + "</p>" +
        (excerpt ? '<p class="news-card__excerpt">' + esc(excerpt) + "</p>" : "") +
        '<span class="news-card__more">Leer más →</span></div></article>';
      var link = /^https?:\/\//.test(val("l")) ? val("l") : "";
      b.querySelector("[data-prev-open]").innerHTML =
        (imgUrl ? '<img class="news-prev-open__img" src="' + esc(imgUrl) + '" alt="">' : "") +
        metaOpen + modTag + "</div>" +
        '<h3 class="news-modal__title">' + esc(title) + "</h3>" +
        '<p class="news-card__date">' + esc(date(when)) + "</p>" +
        '<div class="news-modal__body">' + (esc(body) || '<span class="muted">(sin texto)</span>') + "</div>" +
        (link ? '<span class="btn btn-blue btn-sm" style="margin-top:12px;display:inline-block">' + esc(val("ll") || "Ver más") + "</span>" : "");
    }

    var audience = null;
    function renderAudience() {
      var el = b.querySelector("[data-audience]");
      if (!audience) { el.textContent = ""; return; }
      var modId = val("m");
      var nn = modId ? Object.keys(audience.byModule[modId] || {}).length : audience.all;
      var who = modId ? "estudiante(s) que están cursando " + (modById[modId] ? modById[modId].level : "ese módulo") : "estudiante(s) con cuenta en el portal";
      el.className = "news-audience" + (nn ? "" : " news-audience--none");
      el.innerHTML = nn
        ? "👥 La verán <strong>" + nn + "</strong> " + esc(who) + "."
        : "⚠️ Hoy <strong>nadie</strong> la vería: no hay " + esc(who) + ". Quienes ya completaron un módulo no ven las novedades dirigidas a él.";
    }
    loadNewsAudience().then(function (a) { audience = a; renderAudience(); });

    b.addEventListener("input", renderPreview);
    b.addEventListener("change", function (e) {
      if (e.target.name === "m") renderAudience();
      renderPreview();
    });
    // Escribir un enlace de imagen la deja elegida automáticamente.
    b.querySelector("[name=imgurl]").addEventListener("input", function () {
      if (val("imgurl")) b.querySelector("[name=img][value=__custom]").checked = true;
    });

    // Subir imagen: se achica, se sube al bucket "novedades" y queda elegida.
    var fileIn = b.querySelector("[data-file]"), upMsg = b.querySelector("[data-upload-msg]");
    b.querySelector("[data-upload]").addEventListener("click", function () { fileIn.click(); });
    fileIn.addEventListener("change", function () {
      var file = fileIn.files && fileIn.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { upMsg.textContent = "Ese archivo no es una imagen."; return; }
      upMsg.textContent = "Subiendo…";
      shrinkImage(file).then(function (blob) {
        var ext = blob.type === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "jpg").toLowerCase();
        var path = Date.now() + "_" + file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) + "." + ext;
        return sb.storage.from("novedades").upload(path, blob, { contentType: blob.type || file.type, upsert: false }).then(function (up) {
          if (up.error) throw up.error;
          var url = sb.storage.from("novedades").getPublicUrl(path).data.publicUrl;
          b.querySelector("[name=imgurl]").value = url;
          b.querySelector("[name=img][value=__custom]").checked = true;
          var tile = b.querySelector("[data-custom-tile]");
          var old = tile.querySelector("img, span"); if (old) old.remove();
          tile.appendChild(h('<img src="' + esc(url) + '" alt="">'));
          upMsg.textContent = "Imagen subida ✓";
          renderPreview();
        });
      }).catch(function (err) {
        upMsg.textContent = "No se pudo subir: " + friendly(err);
      }).then(function () { fileIn.value = ""; });
    });

    renderPreview();

    modal(n.id ? "Editar novedad" : "Nueva novedad", b, function () {
      var title = val("t");
      if (title.length < 3) throw new Error("Escribe un título.");
      var imageUrl = currentImage();
      if (pickedValue(b, "img") === "__custom" && !imageUrl) throw new Error("Sube una imagen o pega su enlace, o elige otra portada.");
      if (imageUrl && !/^(https:\/\/|assets\/)/.test(imageUrl)) throw new Error("El enlace de la imagen debe empezar por https://");
      var link = val("l");
      if (link && !/^https?:\/\//.test(link)) throw new Error("El enlace debe empezar por https://");
      var pa = val("pa");
      var payload = {
        title: title, category: val("c"), body: val("b"),
        image_url: imageUrl || null, link_url: link || null, link_label: val("ll") || null,
        module_id: val("m") || null,
        publish_at: pa ? new Date(pa).toISOString() : (n.publish_at || new Date().toISOString()),
        expires_at: val("ex") || null,
        pinned: b.querySelector("[name=pin]").checked,
        published: b.querySelector("[name=pub]").checked,
        updated_at: new Date().toISOString()
      };
      var pr = n.id
        ? q("announcements").update(payload).eq("id", n.id)
        : q("announcements").insert(Object.assign({ created_by: ME.user_id }, payload));
      return pr.then(function (r) { if (r.error) throw r.error; toast(n.id ? "Novedad actualizada." : "Novedad publicada."); route(); });
    }, n.id ? "Guardar" : "Publicar", false, true);
  }

  /* ============ REGISTRO DE EVENTOS ============ */
  var AUDIT_ACTION_ES = {
    "payment.delete": "Pago eliminado", "payment.update": "Pago editado",
    "payment.reverse": "Pago reversado", "subscription.delete": "Suscripción eliminada",
    "payment.receipt_backfill": "Recibo corregido (error del sistema, ya resuelto)",
    "cycle.finish": "Ciclo finalizado (estudiantes liberados; grupos, horarios y ciclo eliminados)"
  };
  // Motivo en lenguaje simple para acciones que hizo el sistema (no un admin escribiendo a mano);
  // sin esto, la tabla mostraba el texto técnico tal cual quedó guardado en el momento de la corrección.
  var AUDIT_REASON_ES = {
    "payment.receipt_backfill": "Un error de programación dejaba el número de recibo vacío en los pagos hechos con Wompi. Ya se corrigió."
  };
  // Explicación completa para el botón "Ver" de acciones del sistema — se agrega ANTES del detalle
  // técnico (que se conserva igual, por si alguien de soporte técnico lo necesita).
  var AUDIT_ACTION_EXPLAIN_ES = {
    "payment.receipt_backfill":
      "¿Qué pasó? Cuando un estudiante pagaba en línea con Wompi, el sistema debía asignarle automáticamente " +
      "un número de recibo interno (por ejemplo REC-2026-00006), igual que se hace con los pagos manuales. " +
      "Por un error de programación que existía desde que se creó esa función, esa asignación nunca se hacía " +
      "— por eso el recibo aparecía vacío (\"—\") en \"Ver pagos\", aunque el pago sí se había cobrado y " +
      "quedado registrado correctamente.\n\n" +
      "¿Qué se corrigió? Se completó el número de recibo que faltaba en los pagos afectados. No se cambió " +
      "ningún monto, fecha, estudiante ni otro dato del pago — solo se llenó el campo del recibo. También se " +
      "corrigió el sistema para que esto no vuelva a pasar con los próximos pagos de Wompi.\n\n" +
      "¿Hay algo que hacer? No. Este registro queda aquí solo como comprobante permanente de que se hizo " +
      "esa corrección — nadie, ni el admin, puede borrar este historial."
  };
  // Explicación en palabras de un evento, armada con los datos que guardó el
  // registro (el código técnico queda aparte, en un desplegable para soporte).
  //   lk.students { id: nombre } · lk.modules { id: "A1.1 · Título" }
  function explainAudit(r, lk) {
    var d = r.details || {};
    var who = function (x) {
      return (x && (x.student_name || lk.students[x.student_id])) || (x && x.payer_name) || "un estudiante ya eliminado";
    };
    var payer = function (x) {
      return x && x.payer_name ? x.payer_name + (x.payer_doc_number ? " (" + (x.payer_doc_type || "") + " " + x.payer_doc_number + ")" : "") : "sin dato";
    };
    var month = function (s) {
      if (!s) return "—";
      var p = String(s).slice(0, 7).split("-");
      return (["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][+p[1] - 1] || p[1]) + " de " + p[0];
    };
    var method = function (m) { return METHOD_ES[m] || m || "—"; };
    var receipt = function (x) { return x.receipt_number || "sin número de recibo"; };
    var line = function (label, val) { return "• " + label + ": " + val; };

    switch (r.action) {
      case "payment.delete":
        return [
          "Se ELIMINÓ por completo un pago de " + who(d) + ". Ese pago ya no existe en el sistema: este registro es la única constancia de que existió.",
          "Datos del pago que se borró:\n" + [
            line("Recibo", receipt(d)),
            line("Monto", money(d.amount, d.currency)),
            line("Método", method(d.method)),
            line("Mes que cubría", month(d.period_month)),
            line("Fecha en que se registró", date(d.paid_at)),
            line("Pagado por", payer(d))
          ].join("\n")
        ];
      case "payment.update": {
        var b = d.before || {}, changes = [];
        if (d.new_amount != null && +d.new_amount !== +b.amount) changes.push(line("Monto", money(b.amount, b.currency) + " → " + money(d.new_amount, b.currency)));
        if (d.new_method && d.new_method !== b.method) changes.push(line("Método", method(b.method) + " → " + method(d.new_method)));
        if (d.new_period_month && String(d.new_period_month).slice(0, 7) !== String(b.period_month || "").slice(0, 7)) changes.push(line("Mes que cubre", month(b.period_month) + " → " + month(d.new_period_month)));
        if (d.new_notes != null && d.new_notes !== b.notes) changes.push(line("Nota", (b.notes || "(vacía)") + " → " + d.new_notes));
        return [
          "Se CORRIGIÓ un dato del pago con recibo " + receipt(b) + " de " + who(b) + " (pagado por " + payer(b) + ").",
          changes.length ? "Qué cambió (antes → después):\n" + changes.join("\n") : "Se guardó la corrección sin que ningún dato quedara distinto al que ya tenía."
        ];
      }
      case "payment.reverse":
        return [
          "Se REVERSÓ el pago con recibo " + receipt(d) + " de " + who(d) + ". El pago original NO se borró: sigue en el libro contable, y se creó un asiento de reverso por el mismo valor que lo anula (en “Ver pagos” aparece marcado como “reverso”).",
          "Pago reversado:\n" + [
            line("Monto", money(d.amount, d.currency)),
            line("Método", method(d.method)),
            line("Mes que cubría", month(d.period_month)),
            line("Pagado por", payer(d))
          ].join("\n")
        ];
      case "subscription.delete":
        return [
          "Se ELIMINÓ un cobro (suscripción) de " + who(d) + ". No tenía pagos registrados en el momento de borrarse, así que no afectó ningún pago.",
          "Cobro que se borró:\n" + [
            line("Módulo", lk.modules[d.module_id] || "(módulo no identificado)"),
            line("Mensualidad", money(d.monthly_amount, d.currency)),
            line("Creado el", date(d.created_at)),
            line("Pagador registrado", payer(d))
          ].join("\n")
        ];
      case "cycle.finish": {
        var auto = !r.actor_email;
        var est = (d.estudiantes || []).map(function (e) { return "• " + e.estudiante + " — " + e.modulo + ": " + e.resultado; });
        return [
          (auto ? "El sistema CERRÓ AUTOMÁTICAMENTE el ciclo " : "Se FINALIZÓ A MANO (antes de su fecha) el ciclo ") +
            (d.ciclo || "") + " (" + date(d.inicio) + " – " + date(d.fin) + ")" + (auto ? ", porque ya había pasado su fecha de fin." : "."),
          "Qué se hizo:\n" + [
            line("Estudiantes que completaron su módulo", d.modulos_completados || 0),
            line("Inscripciones canceladas porque nunca se pagaron", d.inscripciones_canceladas_sin_pago || 0),
            line("Grupos eliminados", d.grupos_eliminados || 0),
            line("Horarios eliminados", d.horarios_eliminados || 0),
            "• El ciclo también se eliminó."
          ].join("\n"),
          est.length ? "Estudiantes afectados:\n" + est.join("\n") : "No había estudiantes inscritos en ese ciclo.",
          "Todos quedaron sin módulo en Estudiantes, a la espera de su siguiente inscripción. Los módulos completados se siguen viendo en su “Detalle” y en el portal."
        ];
      }
    }
    return null;
  }

  function secRegistro(main) {
    head(main, "Registro de eventos", "Cada vez que se edita, reversa o elimina un pago o una suscripción, o se cierra un ciclo, queda anotado aquí, con el motivo — nadie puede editar ni borrar este registro, ni siquiera el admin.");
    // Nombres de estudiantes y módulos para que la explicación hable en palabras, no en códigos.
    var lk = { students: {}, modules: {} };
    Promise.all([
      rpc("admin_list_audit_log", { p_limit: 300 }),
      q("students").select("id,full_name"),
      q("modules").select("id,level,title")
    ]).then(function (res) {
      (res[1].data || []).forEach(function (s) { lk.students[s.id] = s.full_name; });
      (res[2].data || []).forEach(function (m) { lk.modules[m.id] = m.level + " · " + m.title; });
      return res[0];
    }).then(function (rows) {
      rows = rows || [];
      var t = tableWrap(["Fecha", "Quién", "Acción", "Motivo", "Detalle"], { title: 2 });
      rows.forEach(function (r) {
        var detailBtn = h('<button class="btn btn-sm btn-ghost">Ver</button>');
        var td = h("<td></td>"); td.appendChild(detailBtn);
        var reasonDisplay = AUDIT_REASON_ES[r.action] || r.reason;
        var tr = h("<tr><td>" + date(r.created_at) + " " + new Date(r.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) +
          "</td><td>" + esc(r.actor_email || (r.action === "cycle.finish" ? "Sistema (automático)" : "—")) + "</td><td>" + esc(AUDIT_ACTION_ES[r.action] || r.action) +
          '</td><td class="wrap">' + esc(reasonDisplay) + "</td></tr>");
        tr.appendChild(td);
        detailBtn.onclick = function () {
          var box = h("<div></div>");
          var fixed = AUDIT_ACTION_EXPLAIN_ES[r.action];
          var paras = fixed ? [fixed] : explainAudit(r, lk);
          var when = date(r.created_at) + " a las " + new Date(r.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
          var by = r.actor_email || (r.action === "cycle.finish" ? "el sistema (automático)" : "—");
          box.appendChild(h('<p class="muted" style="font-size:12.5px;margin:0 0 12px">' + esc(when) + " · hecho por " + esc(by) + "</p>"));
          (paras || ["No hay una explicación preparada para este tipo de evento. Abajo está el detalle técnico."]).forEach(function (p) {
            box.appendChild(h('<p style="margin:0 0 14px;line-height:1.55;white-space:pre-wrap">' + esc(p) + "</p>"));
          });
          if (!fixed) box.appendChild(h('<p style="margin:0 0 14px;line-height:1.55"><strong>Motivo escrito:</strong> ' + esc(r.reason) + "</p>"));
          // Detalle técnico: escondido por defecto, solo para soporte.
          var tech = h('<details style="margin-top:6px"><summary class="muted" style="font-size:12px;cursor:pointer">Detalle técnico (solo para soporte)</summary>' +
            (fixed ? '<p class="muted" style="font-size:12.5px;margin:8px 0">Motivo técnico original: ' + esc(r.reason) + "</p>" : "") +
            '<pre style="white-space:pre-wrap;font-size:12px;max-height:50vh;overflow:auto;background:var(--niebla);padding:12px;border-radius:8px;margin-top:8px">' +
            esc(JSON.stringify(r.details, null, 2)) + "</pre></details>");
          box.appendChild(tech);
          modal("Detalle — " + (AUDIT_ACTION_ES[r.action] || r.action), box, function () { return Promise.resolve(); }, "Cerrar");
        };
        t.body.appendChild(tr);
      });
      if (!rows.length) t.body.appendChild(h('<tr><td colspan="5" class="muted">Sin eventos registrados todavía.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  /* ============ MI CUENTA (admin) ============ */
  var ACCOUNT_AVATAR_GALLERY = [
    "assets/avatars/m1.svg", "assets/avatars/m2.svg", "assets/avatars/m3.svg",
    "assets/avatars/f1.svg", "assets/avatars/f2.svg", "assets/avatars/f3.svg"
  ];
  function secMiCuenta(main) {
    head(main, "Mi cuenta", "Tu foto, nombre, correo y contraseña.");

    // --- Foto de perfil ---
    var avatarBox = h(
      '<div class="pnl-table-wrap" style="padding:20px;margin-bottom:22px;max-width:520px">' +
      '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      '<img data-avatar-preview src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--niebla)">' +
      '<div><label class="fld" style="margin-bottom:6px"><span>Foto de perfil</span><input type="file" accept="image/*" data-avatar-input></label>' +
      '<p class="muted" data-avatar-msg style="font-size:12.5px"></p></div>' +
      "</div>" +
      '<p class="muted" style="font-size:12.5px;margin:14px 0 8px">O tocá un dibujo:</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      ACCOUNT_AVATAR_GALLERY.map(function (src) {
        return '<img data-avatar-pick src="' + src + '" alt="" style="width:52px;height:52px;border-radius:50%;cursor:pointer;border:2px solid transparent">';
      }).join("") +
      "</div></div>"
    );
    main.appendChild(avatarBox);

    function setAvatar(url, msgEl) {
      return rpc("update_my_avatar", { p_url: url }).then(function () {
        ME.avatar_url = url;
        avatarBox.querySelector("[data-avatar-preview]").src = url;
        var topImg = document.querySelector(".pnl-top .who img");
        if (topImg) topImg.src = url;
        msgEl.textContent = "Foto actualizada.";
      });
    }
    avatarBox.querySelectorAll("[data-avatar-pick]").forEach(function (img) {
      img.onclick = function () {
        var msg = avatarBox.querySelector("[data-avatar-msg]");
        msg.textContent = "Guardando…";
        setAvatar(img.getAttribute("src"), msg).catch(function (err) { msg.textContent = friendly(err); });
      };
    });
    avatarBox.querySelector("[data-avatar-input]").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var msg = avatarBox.querySelector("[data-avatar-msg]");
      msg.textContent = "Subiendo…";
      var path = ME.user_id + "/" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      sb.storage.from("avatars").upload(path, file, { upsert: true }).then(function (up) {
        if (up.error) throw up.error;
        var publicUrl = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        return setAvatar(publicUrl, msg);
      }).catch(function (err) { msg.textContent = "No pudimos subir la foto: " + ((err && err.message) || err); });
    });

    // --- Nombre ---
    var nameBox = h('<div class="pnl-table-wrap" style="padding:20px;margin-bottom:22px;max-width:520px">' +
      '<p style="font-weight:600;margin-bottom:10px">Nombre</p>' +
      field("Nombre completo", '<input name="fn" value="' + esc(ME.full_name || "") + '">') +
      '<button class="btn btn-blue" data-save-name>Guardar nombre</button>' +
      '<p class="muted" data-name-msg style="font-size:12.5px;margin-top:8px"></p></div>');
    main.appendChild(nameBox);
    nameBox.querySelector("[data-save-name]").onclick = function () {
      var msg = nameBox.querySelector("[data-name-msg]");
      var val = nameBox.querySelector("[name=fn]").value.trim();
      if (val.length < 2) { msg.textContent = "Escribe tu nombre."; return; }
      msg.textContent = "Guardando…";
      rpc("update_my_name", { p_full_name: val }).then(function () {
        ME.full_name = val;
        var nameEl = document.querySelector(".pnl-top .who .name-text");
        if (nameEl) nameEl.textContent = val;
        msg.textContent = "Nombre actualizado.";
      }).catch(function (err) { msg.textContent = friendly(err); });
    };

    // --- Correo ---
    var emailBox = h('<div class="pnl-table-wrap" style="padding:20px;margin-bottom:22px;max-width:520px">' +
      '<p style="font-weight:600;margin-bottom:10px">Correo (usuario para entrar)</p>' +
      field("Correo", '<input name="em" type="email" value="' + esc(ME.email || "") + '">') +
      '<button class="btn btn-blue" data-save-email>Guardar correo</button>' +
      '<p class="muted" data-email-msg style="font-size:12.5px;margin-top:8px">Cambiarlo cambia con qué correo entrás al panel.</p></div>');
    main.appendChild(emailBox);
    emailBox.querySelector("[data-save-email]").onclick = function () {
      var msg = emailBox.querySelector("[data-email-msg]");
      var val = emailBox.querySelector("[name=em]").value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val)) { msg.textContent = "El correo no es válido."; return; }
      msg.textContent = "Guardando…";
      callFn({ action: "update_email", user_id: ME.user_id, email: val }).then(function () {
        ME.email = val;
        msg.textContent = "Correo actualizado.";
      }).catch(function (err) { msg.textContent = friendly(err); });
    };

    // --- Contraseña ---
    var pwBox = h('<div class="pnl-table-wrap" style="padding:20px;max-width:520px">' +
      '<p style="font-weight:600;margin-bottom:10px">Cambiar contraseña</p>' +
      field("Nueva contraseña", '<input type="password" name="p1" autocomplete="new-password">') +
      field("Confirmar contraseña", '<input type="password" name="p2" autocomplete="new-password">') +
      '<p class="pnl-sub" style="margin:-4px 0 12px;font-size:12.5px">' + esc(PW_HINT) + "</p>" +
      '<button class="btn btn-blue" data-save-pw>Guardar contraseña</button>' +
      '<p class="muted" data-pw-msg style="font-size:12.5px;margin-top:8px"></p></div>');
    main.appendChild(pwBox);
    pwBox.querySelector("[data-save-pw]").onclick = function () {
      var msg = pwBox.querySelector("[data-pw-msg]");
      var P = window.LEFPassword;
      function say(t, kind) { if (P) P.say(msg, t, kind); else msg.textContent = t; }
      var p1 = pwBox.querySelector("[name=p1]").value, p2 = pwBox.querySelector("[name=p2]").value;
      // Casillas en rojo + alerta roja con todo lo que falta (lef-password.js).
      var pwErr = P ? P.validate(pwBox) : (checkPassword(p1) || (p1 !== p2 ? "Las contraseñas no coinciden." : ""));
      if (pwErr) { say(pwErr, "err"); return; }
      say("Guardando…");
      sb.auth.updateUser({ password: p1 }).then(function (r) {
        if (r.error) throw r.error;
        if (window.LEFPrimerIngreso) window.LEFPrimerIngreso.markChanged(sb);
        pwBox.querySelector("[name=p1]").value = pwBox.querySelector("[name=p2]").value = "";
        say("Contraseña actualizada.", "ok");
      }).catch(function (err) { say("No pudimos cambiar la contraseña: " + friendly(err), "err"); });
    };
  }

  /* ============ ACADÉMICO ============ */
  function secAcademico(main) {
    head(main, "Académico", "Módulos, ciclos, profesores, horarios y grupos.");
    var tabs = ["modulos", "ciclos", "profesores", "horarios", "grupos"];
    var lbl = { modulos: "Módulos", ciclos: "Ciclos", profesores: "Profesores", horarios: "Horarios", grupos: "Grupos" };
    var bar = h('<div class="pnl-toolbar">' + tabs.map(function (t) {
      return '<button class="btn btn-sm btn-ghost" data-tab="' + t + '">' + lbl[t] + "</button>";
    }).join("") + "</div>");
    main.appendChild(bar);
    var box = h("<div></div>"); main.appendChild(box);
    bar.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () {
        bar.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.remove("btn-dark"); x.classList.add("btn-ghost"); });
        b.classList.add("btn-dark"); b.classList.remove("btn-ghost");
        ({ modulos: acModulos, ciclos: acCiclos, profesores: acProfesores, horarios: acHorarios, grupos: acGrupos })[b.dataset.tab](box);
      };
    });
    bar.querySelector("[data-tab]").click();
  }

  function acModulos(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([q("modules").select("*").order("module_number"), rpc("module_enrollment_counts")])
      .then(function (res) {
        var counts = {};
        (res[1] || []).forEach(function (c) { counts[c.module_id] = c.count; });
        var t = tableWrap(["#", "Nivel", "Título", "Descripción", "Inscritos", "Estado", "Acciones"], { title: 2 });
        (res[0].data || []).forEach(function (m) {
          var tr = h("<tr><td>" + m.module_number + '</td><td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:' + modColor(m.module_number) + '"></span>' + esc(m.level) +
            "</td><td>" + esc(m.title) + '</td><td class="wrap">' + esc(m.description) +
            '</td><td style="font-weight:600">' + (counts[m.id] || 0) + "</td><td>" +
            (m.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
            '</td><td class="acts"></td></tr>');
          var cell = tr.children[6];
          cell.appendChild(btn(m.active ? "Desactivar" : "Activar", "btn-ghost", function () {
            rpc("admin_set_module_active", { p_module_id: m.id, p_active: !m.active }).then(function () {
              toast("Módulo " + (m.active ? "desactivado" : "activado") + (m.active ? " (y sus horarios/grupos con él)." : " (y sus horarios/grupos que él había apagado)."));
              acModulos(box);
            }).catch(function (e) { toast(friendly(e), "err"); });
          }));
          cell.appendChild(btn("Editar", "btn-ghost", function () {
            var b = h("<div>" + field("Título (en inglés)", '<input name="t" value="' + esc(m.title) + '">') +
              field("Descripción (en español)", '<textarea name="d" rows="3">' + esc(m.description) + "</textarea>") +
              field("URL del libro en Heyzine (opcional)", '<input name="hz" placeholder="https://heyzine.com/flip-book/xxxxx.html" value="' + esc(m.heyzine_url || "") + '">') +
              '<p class="pnl-sub" style="margin:-4px 0 0">El estudiante lo ve embebido en "Mis recursos" → este módulo → Libro de estudio. Déjalo vacío si todavía no hay libro para este módulo.</p>' +
              "</div>");
            modal("Editar módulo " + m.level, b, function () {
              return q("modules").update({
                title: b.querySelector("[name=t]").value.trim(),
                description: b.querySelector("[name=d]").value.trim(),
                heyzine_url: b.querySelector("[name=hz]").value.trim() || null
              }).eq("id", m.id).then(function (u) { if (u.error) throw u.error; toast("Guardado."); acModulos(box); });
            });
          }));
          t.body.appendChild(tr);
        });
        box.innerHTML = ""; box.appendChild(t.wrap);
      });
  }

  function acProfesores(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      q("teachers").select("*").order("full_name"),
      q("groups").select("id,teacher_id").eq("active", true)
    ]).then(function (res) {
      box.innerHTML = "";
      box.appendChild(h('<p class="pnl-sub" style="margin-bottom:12px">Los profesores nuevos se dan de alta desde Usuarios ' +
        '(+ Cuenta de staff). Aquí solo se visualizan y se corrigen sus datos.</p>'));
      var counts = {};
      (res[1].data || []).forEach(function (g) { counts[g.teacher_id] = (counts[g.teacher_id] || 0) + 1; });
      var t = tableWrap(["Nombre", "Correo", "WhatsApp", "Grupos activos", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (p) {
        var n = counts[p.id] || 0;
        var tr = h("<tr><td>" + esc(p.full_name) + "</td><td>" + esc(p.email) + "</td><td>" + esc(p.whatsapp || "—") +
          '</td><td></td><td>' + (p.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
          '</td><td class="acts"></td></tr>');
        var gcell = tr.children[3];
        if (n) {
          var gbtn = btn(n + (n === 1 ? " grupo" : " grupos"), "btn-ghost", function () { teacherGroupsModal(p); });
          gcell.appendChild(gbtn);
        } else {
          gcell.textContent = "—";
        }
        var cell = tr.children[5];
        cell.appendChild(btn(p.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("teachers").update({ active: !p.active }).eq("id", p.id).then(function () { acProfesores(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () { editTeacher(box, p); }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar profesor", "Vas a eliminar a " + p.full_name + ". No se puede si tiene grupos asignados.", function () {
            return q("teachers").delete().eq("id", p.id).then(function (d) { if (d.error) throw d.error; toast("Profesor eliminado."); acProfesores(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }
  function editTeacher(box, p) {
    var b = h("<div>" + field("Nombre", '<input name="n" value="' + esc(p.full_name) + '">') +
      field("Correo", '<input name="e" type="email" value="' + esc(p.email) + '">') +
      field("WhatsApp", '<input name="w" value="' + esc(p.whatsapp || "") + '">') + "</div>");
    modal("Editar profesor", b, function () {
      var payload = {
        full_name: b.querySelector("[name=n]").value.trim(),
        email: b.querySelector("[name=e]").value.trim(),
        whatsapp: b.querySelector("[name=w]").value.trim() || null
      };
      return q("teachers").update(payload).eq("id", p.id)
        .then(function (r) { if (r.error) throw r.error; toast("Profesor actualizado."); acProfesores(box); });
    }, "Guardar");
  }

  // Detalle de los grupos activos de un profesor: ciclo, horario, cupo y estudiantes,
  // con la misma información que ya vive en cada grupo (Académico > Grupos).
  function teacherGroupsModal(t) {
    var box = h('<div><p class="muted">Cargando…</p></div>');
    modal("Grupos activos — " + t.full_name, box, null, "Cerrar", false, true);
    Promise.all([
      q("groups").select("*,modules(level,title),schedules(days,start_time,end_time,cycles(name,status))")
        .eq("teacher_id", t.id).eq("active", true).order("created_at", { ascending: false }),
      q("enrollments").select("group_id,students(full_name)").not("status", "in", "(Cancelled,Completed)")
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var groups = res[0].data || [];
      var byGroup = {};
      (res[1].data || []).forEach(function (e) {
        if (!e.group_id || !e.students) return;
        (byGroup[e.group_id] = byGroup[e.group_id] || []).push(e.students.full_name);
      });
      box.innerHTML = "";
      if (!groups.length) { box.appendChild(h('<p class="muted">Sin grupos activos.</p>')); return; }
      groups.forEach(function (g) {
        var sc = g.schedules;
        var est = byGroup[g.id] || [];
        box.appendChild(h(
          '<div class="pnl-table-wrap" style="padding:14px 16px;margin-bottom:12px">' +
          '<p style="font-weight:600;margin-bottom:6px">' + esc(g.modules ? g.modules.level + " · " + g.modules.title : "—") + '</p>' +
          '<p class="pnl-sub" style="margin-bottom:4px">Ciclo: ' + esc(sc && sc.cycles ? sc.cycles.name : "—") + '</p>' +
          '<p class="pnl-sub" style="margin-bottom:4px">Horario: ' + esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "—") + '</p>' +
          '<p class="pnl-sub" style="margin-bottom:4px">Cupo: ' + est.length + "/" + g.capacity + '</p>' +
          '<p class="pnl-sub">Estudiantes: ' + (est.length ? esc(est.join(", ")) : "—") + "</p>" +
          "</div>"
        ));
      });
    }).catch(function (e) { box.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
  }

  /* ---- Ciclos ---- */
  function periodLabel(sVal, eVal) {
    if (!sVal || !eVal) return "";
    var s = sVal.split("-"), e = eVal.split("-");
    var sy = +s[0], sm = +s[1] - 1, ey = +e[0], em = +e[1] - 1;
    return sy === ey
      ? MONTHS_ABBR[sm] + "-" + MONTHS_ABBR[em] + " " + ey
      : MONTHS_ABBR[sm] + " " + sy + " - " + MONTHS_ABBR[em] + " " + ey;
  }
  function cycleForm(c) {
    var now = new Date(), todayStr = ymd(now.getFullYear(), now.getMonth(), now.getDate());
    var b = h("<div>" +
      field("Periodo", '<input name="p" type="text" readonly>') +
      field("Fecha de inicio", '<input name="s" type="date" min="' + todayStr + '">') +
      field("Fecha de fin", '<input name="e" type="date" min="' + todayStr + '">') +
      (c ? field("Estado", '<select name="st"><option value="Open">Abierto</option><option value="Closed">Cerrado</option></select>') : "") +
      "</div>");
    var pInput = b.querySelector("[name=p]"), si = b.querySelector("[name=s]"), ei = b.querySelector("[name=e]");
    function updatePeriod() { pInput.value = periodLabel(si.value, ei.value); }
    function onStartChange() {
      if (si.value < todayStr) si.value = todayStr;
      ei.min = si.value > todayStr ? si.value : todayStr;
      if (ei.value && ei.value < ei.min) ei.value = ei.min;
      updatePeriod();
    }
    si.addEventListener("change", onStartChange);
    ei.addEventListener("change", function () {
      if (ei.value < ei.min) ei.value = ei.min;
      updatePeriod();
    });
    si.value = (c && c.start_date) ? c.start_date : todayStr;
    ei.min = si.value > todayStr ? si.value : todayStr;
    ei.value = (c && c.end_date) ? c.end_date : todayStr;
    if (ei.value < ei.min) ei.value = ei.min;
    updatePeriod();
    if (c && c.status) b.querySelector("[name=st]").value = c.status;
    return b;
  }
  function acCiclos(box) {
    box.innerHTML = "";
    var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Ciclo</button></div>');
    box.appendChild(add);
    box.appendChild(h('<p class="pnl-sub" style="margin-bottom:12px">Cuando pasa la <strong>fecha de fin</strong> de un ciclo, el sistema lo cierra solo: ' +
      'los estudiantes que lo cursaron quedan con ese módulo <strong>completado</strong>, los que nunca pagaron quedan con la inscripción cancelada, ' +
      'todos quedan <strong>sin módulo</strong> en Estudiantes, y se eliminan sus grupos, sus horarios y el ciclo. Queda anotado en el Registro de eventos. ' +
      'Con “Finalizar ahora” haces lo mismo antes de la fecha.</p>'));
    add.querySelector("button").onclick = function () {
      var b = cycleForm(null);
      modal("Nuevo ciclo", b, function () {
        return q("cycles").insert({
          name: b.querySelector("[name=p]").value,
          start_date: b.querySelector("[name=s]").value, end_date: b.querySelector("[name=e]").value, status: "Open"
        }).then(function (i) { if (i.error) throw i.error; toast("Ciclo creado."); acCiclos(box); });
      });
    };
    q("cycles").select("*").order("start_date", { ascending: false }).then(function (r) {
      var t = tableWrap(["Periodo", "Inicio", "Fin", "Estado", "Acciones"]);
      (r.data || []).forEach(function (c) {
        var tr = h("<tr><td>" + esc(c.name) + "</td><td>" + date(c.start_date) + "</td><td>" + date(c.end_date) +
          "</td><td>" + (c.status === "Open" ? '<span class="badge ok">abierto</span>' : '<span class="badge neutral">cerrado</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[4];
        cell.appendChild(btn(c.status === "Open" ? "Cerrar" : "Abrir", "btn-ghost", function () {
          q("cycles").update({ status: c.status === "Open" ? "Closed" : "Open" }).eq("id", c.id).then(function () { acCiclos(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () {
          var b = cycleForm(c);
          modal("Editar ciclo", b, function () {
            return q("cycles").update({
              name: b.querySelector("[name=p]").value,
              start_date: b.querySelector("[name=s]").value, end_date: b.querySelector("[name=e]").value,
              status: b.querySelector("[name=st]").value
            }).eq("id", c.id).then(function (u) { if (u.error) throw u.error; toast("Ciclo actualizado."); acCiclos(box); });
          });
        }));
        cell.appendChild(btn("Finalizar ahora", "btn-ghost", function () {
          var b = h("<div>" +
            '<p class="pnl-sub" style="margin-bottom:8px">Vas a cerrar el ciclo <strong>' + esc(c.name) + "</strong> antes de su fecha de fin (" + date(c.end_date) + ").</p>" +
            '<p class="pnl-sub" style="margin-bottom:10px">Los estudiantes activos quedan con su módulo <strong>completado</strong>, los pendientes de pago quedan con la inscripción cancelada, todos quedan sin módulo, y se <strong>eliminan</strong> los grupos, los horarios y el ciclo. No se puede deshacer.</p>' +
            field("Escribe FINALIZAR para confirmar", '<input name="confirm" autocomplete="off" placeholder="FINALIZAR">') +
            "</div>");
          modal("Finalizar ciclo", b, function () {
            if ((b.querySelector("[name=confirm]").value || "").trim().toUpperCase() !== "FINALIZAR")
              throw new Error("Escribe FINALIZAR para confirmar.");
            return rpc("admin_finish_cycle", { p_cycle_id: c.id }).then(function () { toast("Ciclo finalizado y limpiado."); acCiclos(box); });
          }, "Finalizar ciclo", true);
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar ciclo", "No se puede si tiene horarios asociados.", function () {
            return q("cycles").delete().eq("id", c.id).then(function (d) { if (d.error) throw d.error; toast("Ciclo eliminado."); acCiclos(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  var DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  /* --- Cruces de horario de un profesor ---
     Mismo criterio que la regla de la base de datos (migración
     20260923080000): dos grupos activos del mismo profesor se cruzan si
     comparten un día, las horas se solapan y sus ciclos coinciden en fechas.
     `groups` son filas con schedules(days,start_time,end_time,active,cycles(...));
     `sched` es { days, start_time, end_time, cycles: { start_date, end_date } }. */
  var GROUP_CONFLICT_SELECT = "id,teacher_id,active,schedule_id,modules(level),teachers(full_name)," +
    "schedules(days,start_time,end_time,active,cycles(name,start_date,end_date))";
  function toMin(t) { var p = String(t || "0:0").split(":"); return (+p[0]) * 60 + (+p[1]); }
  function fromMin(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  function cyclesOverlap(a, b) { return !a || !b || (a.start_date <= b.end_date && b.start_date <= a.end_date); }
  // Grupos activos del profesor que comparten algún día y ciclo con `sched`.
  function teacherSameDays(groups, teacherId, sched, excludeId) {
    return groups.filter(function (g) {
      var s = g.schedules;
      return g.teacher_id === teacherId && g.id !== excludeId && g.active && s && s.active !== false &&
        (s.days || []).some(function (d) { return (sched.days || []).indexOf(d) !== -1; }) &&
        cyclesOverlap(sched.cycles, s.cycles);
    });
  }
  function teacherConflicts(groups, teacherId, sched, excludeId) {
    return teacherSameDays(groups, teacherId, sched, excludeId).filter(function (g) {
      return toMin(sched.start_time) < toMin(g.schedules.end_time) && toMin(g.schedules.start_time) < toMin(sched.end_time);
    });
  }
  // Hora libre más cercana a la pedida, mismos días y misma duración, con al
  // menos 30 min de descanso antes y después de sus otras clases (6am–10pm).
  function suggestSlot(groups, teacherId, sched, excludeId) {
    var busy = teacherSameDays(groups, teacherId, sched, excludeId).map(function (g) {
      return [toMin(g.schedules.start_time), toMin(g.schedules.end_time)];
    });
    var start = toMin(sched.start_time), dur = toMin(sched.end_time) - start, best = null;
    for (var c = 6 * 60; c + dur <= 22 * 60; c += 15) {
      var free = busy.every(function (x) { return c + dur + 30 <= x[0] || c >= x[1] + 30; });
      // "<=": a igual distancia gana la hora más tarde (después de su clase).
      if (free && (best === null || Math.abs(c - start) <= Math.abs(best - start))) best = c;
    }
    return best === null ? null : { start_time: fromMin(best), end_time: fromMin(best + dur) };
  }
  function groupDesc(g) {
    var s = g.schedules;
    return (g.modules ? g.modules.level : "Grupo") + " · " + days(s.days) + " " + time(s.start_time) + "–" + time(s.end_time) +
      (s.cycles && s.cycles.name ? " (ciclo " + s.cycles.name + ")" : "");
  }
  // Aviso en líneas de texto (sirve para el recuadro del modal y para errores).
  // extra: líneas propias de cada pantalla (qué hacer para seguir).
  function conflictLines(teacherName, conflicts, sched, suggestion, extra) {
    var lines = [(teacherName || "Este profesor") + " ya tiene " + (conflicts.length > 1 ? "grupos" : "un grupo") +
      " que coincide" + (conflicts.length > 1 ? "n" : "") + " con esa programación:"];
    conflicts.forEach(function (g) { lines.push("• " + groupDesc(g)); });
    lines.push(suggestion
      ? "Sugerencia: " + days(sched.days) + " de " + time(suggestion.start_time) + " a " + time(suggestion.end_time) +
        " — le deja al menos 30 minutos de descanso entre clase y clase."
      : "No hay un espacio libre esos días para este profesor (dejando 30 minutos entre clases); prueba con otros días u otro profesor.");
    return lines.concat(extra || []);
  }
  function conflictAlertHtml(lines) {
    return '<div class="pnl-alert err" style="margin:4px 0 0">' + lines.map(function (l, i) {
      return i === 0 ? "<strong>" + esc(l) + "</strong>" : esc(l);
    }).join("<br>") + "</div>";
  }

  function acHorarios(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      q("schedules").select("*,cycles(name,status),modules(level,title,active)").order("created_at", { ascending: false }),
      q("cycles").select("id,name,status,start_date,end_date"), activeModules(),
      q("groups").select(GROUP_CONFLICT_SELECT)
    ]).then(function (res) {
      box.innerHTML = "";
      var cycles = res[1].data || [], modules = res[2], allGroups = res[3].data || [];
      var cycleById = {}; cycles.forEach(function (c) { cycleById[c.id] = c; });
      // Cambiar días/horas/ciclo de un horario (o activarlo) mueve a todos sus
      // grupos: ninguno de sus profesores puede quedar cruzado. Devuelve el
      // aviso en texto, o "" si no hay cruce.
      function scheduleClash(scheduleId, sched) {
        var msg = "";
        allGroups.forEach(function (g) {
          if (msg || g.schedule_id !== scheduleId || !g.active) return;
          var clash = teacherConflicts(allGroups, g.teacher_id, sched, g.id);
          if (clash.length) {
            msg = conflictLines(g.teachers && g.teachers.full_name, clash, sched,
              suggestSlot(allGroups, g.teacher_id, sched, g.id),
              ["Este horario lo usa su grupo " + (g.modules ? g.modules.level : "") + ", así que no se puede guardar así. Elige otra hora o días."]).join("\n");
          }
        });
        return msg;
      }
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Horario</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
        var b = h("<div>" +
          field("Ciclo", '<select name="c">' + cycles.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + (c.status !== "Open" ? " (cerrado)" : "") + "</option>"; }).join("") + "</select>") +
          field("Módulo", moduleSelect("m", modules, modules[0] && modules[0].id)) +
          field("Días", '<div>' + DOW.map(function (d) { return '<label style="display:inline-flex;gap:4px;margin:0 8px 6px 0;font-size:13px"><input type="checkbox" style="width:auto" value="' + d + '">' + DAY_ES[d] + "</label>"; }).join("") + "</div>") +
          field("Hora inicio", '<input name="s" type="time" value="18:00">') + field("Hora fin", '<input name="e" type="time" value="19:00">') + "</div>");
        modal("Nuevo horario", b, function () {
          var dsel = Array.prototype.slice.call(b.querySelectorAll("input[type=checkbox]:checked")).map(function (x) { return x.value; });
          if (!dsel.length) throw new Error("Elige al menos un día.");
          return q("schedules").insert({
            cycle_id: b.querySelector("[name=c]").value, module_id: b.querySelector("[name=m]").value,
            days: dsel, start_time: b.querySelector("[name=s]").value, end_time: b.querySelector("[name=e]").value
          }).then(function (i) { if (i.error) throw i.error; toast("Horario creado."); acHorarios(box); });
        });
      };
      var t = tableWrap(["Ciclo", "Módulo", "Días", "Horario", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (s) {
        var modTxt = s.modules ? s.modules.level + " · " + s.modules.title + (s.modules.active ? "" : " (módulo inactivo)") : "—";
        var estadoTxt = s.active ? '<span class="badge ok">activo</span>'
          : '<span class="badge neutral">inactivo' + (s.deactivated_by_module ? " · por módulo" : "") + "</span>";
        var tr = h("<tr><td>" + esc(s.cycles ? s.cycles.name : "—") + "</td><td>" + esc(modTxt) +
          "</td><td>" + esc(days(s.days)) + "</td><td>" + esc(time(s.start_time) + "–" + time(s.end_time)) +
          "</td><td>" + estadoTxt +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[5];
        cell.appendChild(btn(s.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          if (!s.active) {
            var clashMsg = scheduleClash(s.id, { days: s.days, start_time: s.start_time, end_time: s.end_time, cycles: cycleById[s.cycle_id] });
            if (clashMsg) { toast(clashMsg.replace(/\n/g, " "), "err"); return; }
          }
          q("schedules").update({ active: !s.active, deactivated_by_module: false }).eq("id", s.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else acHorarios(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () {
          var b = h("<div>" +
            field("Ciclo", '<select name="c">' + cycles.map(function (c) { return '<option value="' + c.id + '"' + (c.id === s.cycle_id ? " selected" : "") + ">" + esc(c.name) + (c.status !== "Open" ? " (cerrado)" : "") + "</option>"; }).join("") + "</select>") +
            field("Módulo", moduleSelect("m", modules, s.module_id)) +
            field("Días", '<div>' + DOW.map(function (d) { return '<label style="display:inline-flex;gap:4px;margin:0 8px 6px 0;font-size:13px"><input type="checkbox" style="width:auto" value="' + d + '"' + ((s.days || []).indexOf(d) !== -1 ? " checked" : "") + ">" + DAY_ES[d] + "</label>"; }).join("") + "</div>") +
            field("Hora inicio", '<input name="s" type="time" value="' + esc((s.start_time || "").slice(0, 5)) + '">') + field("Hora fin", '<input name="e" type="time" value="' + esc((s.end_time || "").slice(0, 5)) + '">') + "</div>");
          modal("Editar horario", b, function () {
            var dsel = Array.prototype.slice.call(b.querySelectorAll("input[type=checkbox]:checked")).map(function (x) { return x.value; });
            if (!dsel.length) throw new Error("Elige al menos un día.");
            var clashMsg = s.active && scheduleClash(s.id, {
              days: dsel, start_time: b.querySelector("[name=s]").value, end_time: b.querySelector("[name=e]").value,
              cycles: cycleById[b.querySelector("[name=c]").value]
            });
            if (clashMsg) throw new Error(clashMsg);
            return q("schedules").update({
              cycle_id: b.querySelector("[name=c]").value, module_id: b.querySelector("[name=m]").value,
              days: dsel, start_time: b.querySelector("[name=s]").value, end_time: b.querySelector("[name=e]").value
            }).eq("id", s.id).then(function (u) { if (u.error) throw u.error; toast("Horario actualizado."); acHorarios(box); });
          });
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar horario", "No se puede si tiene grupos asociados.", function () {
            return q("schedules").delete().eq("id", s.id).then(function (d) { if (d.error) throw d.error; toast("Horario eliminado."); acHorarios(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  function acGrupos(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      q("groups").select("*,modules(level,title),teachers(full_name),schedules(days,start_time,end_time,active,cycles(name,start_date,end_date))").order("created_at", { ascending: false }),
      q("schedules").select("id,days,start_time,end_time,module_id,modules(level,title,active),cycles(name,start_date,end_date)").eq("active", true),
      q("teachers").select("id,full_name").eq("active", true),
      rpc("group_enrollment_counts")
    ]).then(function (res) {
      box.innerHTML = "";
      var allGroups = res[0].data || [];
      var scheds = (res[1].data || []).filter(function (s) { return s.modules && s.modules.active; });
      var schedById = {}; scheds.forEach(function (s) { schedById[s.id] = s; });
      var teachers = res[2].data || [];
      var teacherName = {}; teachers.forEach(function (t) { teacherName[t.id] = t.full_name; });
      var counts = {};
      (res[3] || []).forEach(function (c) { counts[c.group_id] = c.count; });
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Grupo</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
        if (!scheds.length) { toast("No hay horarios activos con módulo activo.", "err"); return; }
        // Solo horarios que todavía no tienen grupo (= profesor asignado): así
        // un mismo horario y módulo no termina repartido entre dos profesores.
        // Cuenta también los grupos desactivados, que siguen ocupando su horario.
        var taken = {}; allGroups.forEach(function (g) { taken[g.schedule_id] = true; });
        var openScheds = scheds.filter(function (s) { return !taken[s.id]; });
        if (!openScheds.length) {
          toast("Todos los horarios activos ya tienen un profesor asignado. Crea un horario nuevo en la pestaña Horarios.", "err");
          return;
        }
        var b = h("<div>" +
          field("Horario", '<select name="s">' + openScheds.map(function (s) {
            return '<option value="' + s.id + '" data-mod="' + s.module_id + '">' + esc((s.modules ? s.modules.level : "") + " · " + days(s.days) + " " + time(s.start_time) + "–" + time(s.end_time)) + "</option>";
          }).join("") + "</select>") +
          field("Profesor", '<select name="t">' + teachers.map(function (t) { return '<option value="' + t.id + '">' + esc(t.full_name) + "</option>"; }).join("") + "</select>") +
          field("Cupo", '<input name="c" type="number" min="1" max="8" value="8">') +
          '<div data-conflict></div>' + "</div>");
        var sSel = b.querySelector("[name=s]"), tSel = b.querySelector("[name=t]");
        // El profesor no puede quedar con dos grupos cruzados: el aviso sale
        // apenas se elige la combinación y "Guardar" no se deja usar hasta
        // cambiar el horario (o el profesor).
        function conflictsNow() { return teacherConflicts(allGroups, tSel.value, schedById[sSel.value], null); }
        modal("Nuevo grupo", b, function () {
          if (conflictsNow().length) throw new Error("Ese profesor ya tiene un grupo en ese horario. Elige un horario disponible.");
          var opt = b.querySelector("[name=s]").selectedOptions[0];
          return q("groups").insert({
            schedule_id: b.querySelector("[name=s]").value, module_id: opt.dataset.mod,
            teacher_id: b.querySelector("[name=t]").value, capacity: +b.querySelector("[name=c]").value || 8
          }).select().single().then(function (i) {
            if (i.error) throw i.error;
            toast("Grupo creado.");
            acGrupos(box);
            gestionarGrupoEstudiantes(i.data);
          });
        });
        var saveBtn = b.parentNode.querySelector("[data-s]");
        function checkConflict() {
          var sc = schedById[sSel.value], conflicts = conflictsNow();
          var slot = b.querySelector("[data-conflict]");
          saveBtn.disabled = conflicts.length > 0;
          if (!conflicts.length) { slot.innerHTML = ""; return; }
          var sug = suggestSlot(allGroups, tSel.value, sc, null);
          // Horarios ya creados del mismo módulo que este profesor sí tiene libres.
          var free = openScheds.filter(function (o) {
            return o.id !== sc.id && o.module_id === sc.module_id && !teacherConflicts(allGroups, tSel.value, o, null).length;
          });
          slot.innerHTML = conflictAlertHtml(conflictLines(teacherName[tSel.value], conflicts, sc, sug, [
            free.length
              ? "Horarios sin asignar de este módulo que tiene libres: " + free.map(function (o) { return days(o.days) + " " + time(o.start_time) + "–" + time(o.end_time); }).join("; ") + "."
              : "Si el horario sugerido no aparece en la lista, créalo primero en la pestaña Horarios.",
            "Cambia el horario (o el profesor) para poder guardar."
          ]));
        }
        sSel.addEventListener("change", checkConflict);
        tSel.addEventListener("change", checkConflict);
        checkConflict();
      };
      var t = tableWrap(["Módulo", "Ciclo", "Horario", "Profesor", "Cupo", "Inscritos", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (g) {
        var sc = g.schedules;
        var estadoTxt = g.active ? '<span class="badge ok">activo</span>'
          : '<span class="badge neutral">inactivo' + (g.deactivated_by_module ? " · por módulo" : "") + "</span>";
        var tr = h("<tr><td>" + esc(g.modules ? g.modules.level + " · " + g.modules.title : "—") + "</td><td>" + esc(sc && sc.cycles ? sc.cycles.name : "—") +
          "</td><td>" + esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "—") + "</td><td>" + esc(g.teachers ? g.teachers.full_name : "—") +
          "</td><td>" + g.capacity + '</td><td style="font-weight:600">' + (counts[g.id] || 0) + "</td><td>" + estadoTxt +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[7];
        cell.appendChild(btn("Estudiantes", "btn-blue", function () { gestionarGrupoEstudiantes(g); }));
        cell.appendChild(btn(g.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          if (!g.active && g.schedules) {
            var clash = teacherConflicts(allGroups, g.teacher_id, g.schedules, g.id);
            if (clash.length) {
              toast(conflictLines(teacherName[g.teacher_id] || (g.teachers && g.teachers.full_name), clash, g.schedules,
                suggestSlot(allGroups, g.teacher_id, g.schedules, g.id), ["Por eso no se puede activar este grupo."]).join(" "), "err");
              return;
            }
          }
          q("groups").update({ active: !g.active, deactivated_by_module: false }).eq("id", g.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else acGrupos(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () {
          var b = h("<div>" +
            field("Profesor", '<select name="t">' + teachers.map(function (tt) {
              return '<option value="' + tt.id + '"' + (tt.id === g.teacher_id ? " selected" : "") + ">" + esc(tt.full_name) + "</option>";
            }).join("") + "</select>") +
            field("Cupo (máx. 8)", '<input name="c" type="number" min="1" max="8" value="' + g.capacity + '">') +
            '<div data-conflict></div>' + "</div>");
          var tSel = b.querySelector("[name=t]");
          function conflictsNow() {
            // Solo al cambiar de profesor (editar el cupo no debe trabarse).
            return g.active && g.schedules && tSel.value !== g.teacher_id
              ? teacherConflicts(allGroups, tSel.value, g.schedules, g.id) : [];
          }
          modal("Editar grupo", b, function () {
            if (conflictsNow().length) throw new Error("Ese profesor ya tiene un grupo en ese horario. Elige otro profesor.");
            return q("groups").update({
              teacher_id: b.querySelector("[name=t]").value,
              capacity: +b.querySelector("[name=c]").value || g.capacity
            }).eq("id", g.id).then(function (u) { if (u.error) throw u.error; toast("Grupo actualizado."); acGrupos(box); });
          });
          // Aquí el horario del grupo es fijo: el cruce solo se arregla con otro
          // profesor (o creando el grupo en otro horario).
          var saveBtn = b.parentNode.querySelector("[data-s]");
          function checkConflict() {
            var conflicts = conflictsNow(), slot = b.querySelector("[data-conflict]");
            saveBtn.disabled = conflicts.length > 0;
            if (!conflicts.length) { slot.innerHTML = ""; return; }
            slot.innerHTML = conflictAlertHtml(conflictLines(teacherName[tSel.value], conflicts, g.schedules,
              suggestSlot(allGroups, tSel.value, g.schedules, g.id),
              ["El horario de un grupo ya creado no se cambia aquí: elige otro profesor, o crea un grupo nuevo en el horario sugerido."]));
          }
          tSel.addEventListener("change", checkConflict);
          checkConflict();
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          var activos = counts[g.id] || 0;
          var msg = activos > 0
            ? "Tiene " + activos + " inscripción(es) activa(s) en este grupo. Cámbialas de módulo (Estudiantes > Editar) o cancélalas (Dashboard > Inscripciones) antes de eliminar."
            : "Se eliminará el grupo. Las inscripciones canceladas que lo referenciaban quedarán sin grupo (no se borran).";
          confirmDelete("Eliminar grupo", msg, function () {
            if (activos > 0) throw new Error(msg);
            return q("groups").delete().eq("id", g.id).then(function (d) { if (d.error) throw d.error; toast("Grupo eliminado."); acGrupos(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  // Elegir a mano qué estudiantes de un módulo entran a ESTE grupo en concreto
  // (los que no se unen quedan "libres" para otro grupo del mismo horario/ciclo,
  // o para esperar el siguiente). Modal persistente, como "Ver pagos".
  function gestionarGrupoEstudiantes(g) {
    var box = h('<div><p class="muted">Cargando…</p></div>');
    modal("Estudiantes del grupo", box, null, "Cerrar", false, true);

    function load() {
      box.innerHTML = '<p class="muted">Cargando…</p>';
      Promise.all([
        q("groups").select("*,modules(level,title),schedules(days,start_time,end_time)").eq("id", g.id).single(),
        q("enrollments").select("id,student_id,students(full_name,whatsapp,doc_type,doc_number)")
          .eq("group_id", g.id).not("status", "in", "(Cancelled,Completed)"),
        q("enrollments").select("id,student_id,students(full_name,whatsapp,doc_type,doc_number)")
          .eq("module_id", g.module_id).is("group_id", null).not("status", "in", "(Cancelled,Completed)")
      ]).then(function (res) {
        if (res[0].error) throw res[0].error;
        var grp = res[0].data, dentro = res[1].data || [], libres = res[2].data || [];
        var sc = grp.schedules;
        box.innerHTML = "";
        box.appendChild(h(
          '<p class="pnl-sub" style="margin-bottom:14px">' +
          '<strong>' + esc(grp.modules ? grp.modules.level + " · " + grp.modules.title : "") + '</strong> — ' +
          esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "sin horario") +
          ' · cupo <strong>' + dentro.length + "/" + grp.capacity + "</strong></p>"
        ));

        box.appendChild(h('<h3 style="font-size:14px;margin-bottom:8px">En este grupo</h3>'));
        var t1 = tableWrap(["Estudiante", "Documento", "WhatsApp", ""]);
        dentro.forEach(function (e) {
          var s = e.students;
          var tr = h("<tr><td>" + esc(s.full_name) + "</td><td>" + esc((s.doc_type || "") + " " + (s.doc_number || "")) +
            "</td><td>" + esc(s.whatsapp) + '</td><td class="acts"></td></tr>');
          tr.children[3].appendChild(btn("Quitar del grupo", "btn-ghost", function () {
            rpc("admin_unassign_group", { p_enrollment_id: e.id })
              .then(function () { toast("Estudiante liberado."); load(); })
              .catch(function (err) { toast(friendly(err), "err"); });
          }));
          t1.body.appendChild(tr);
        });
        if (!dentro.length) t1.body.appendChild(h('<tr><td colspan="4" class="muted">Todavía no hay estudiantes en este grupo.</td></tr>'));
        box.appendChild(t1.wrap);

        var lleno = dentro.length >= grp.capacity;
        box.appendChild(h('<h3 style="font-size:14px;margin:18px 0 8px">Estudiantes libres de este módulo' + (lleno ? " (grupo lleno)" : "") + "</h3>"));
        var t2 = tableWrap(["Estudiante", "Documento", "WhatsApp", ""]);
        libres.forEach(function (e) {
          var s = e.students;
          var tr = h("<tr><td>" + esc(s.full_name) + "</td><td>" + esc((s.doc_type || "") + " " + (s.doc_number || "")) +
            "</td><td>" + esc(s.whatsapp) + '</td><td class="acts"></td></tr>');
          var joinBtn = btn("Unir al grupo", "btn-blue", function () {
            rpc("admin_assign_group", { p_enrollment_id: e.id, p_group_id: g.id })
              .then(function () { toast("Estudiante unido al grupo."); load(); })
              .catch(function (err) { toast(friendly(err), "err"); });
          });
          joinBtn.disabled = lleno;
          tr.children[3].appendChild(joinBtn);
          t2.body.appendChild(tr);
        });
        if (!libres.length) t2.body.appendChild(h('<tr><td colspan="4" class="muted">No hay estudiantes de este módulo esperando grupo.</td></tr>'));
        box.appendChild(t2.wrap);
      }).catch(function (e) { box.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
    }
    load();
  }

  /* ============ USUARIOS ============ */
  function secUsuarios(main) {
    head(main, "Usuarios", "Todas las cuentas y personas del sistema, con su rol. Solo el administrador gestiona aquí.");
    var bar = h('<div class="pnl-toolbar">' +
      '<button class="btn btn-sm btn-dark" data-new>+ Cuenta de staff</button>' +
      '<select data-f-rol style="width:auto"><option value="">Todos los roles</option><option value="admin">Administrador</option><option value="teacher">Profesor</option><option value="student">Estudiante</option></select>' +
      '<select data-f-est style="width:auto"><option value="">Activos e inactivos</option><option value="1">Solo activos</option><option value="0">Solo inactivos</option></select>' +
      '<select data-f-ord style="width:auto"><option value="desc">Más recientes primero</option><option value="asc">Más antiguos primero</option></select>' +
      "</div>");
    main.appendChild(bar);
    var host = h("<div></div>"); main.appendChild(host);

    bar.querySelector("[data-new]").onclick = function () {
      var pwd = genPassword();
      var b = h("<div>" +
        field("Rol", '<select name="r"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>') +
        field("Nombre", '<input name="n">') + field("Correo", '<input name="e" type="email">') +
        field("Contraseña temporal", '<input name="p" value="' + pwd + '">') + mailCheckbox() +
        '<p class="pnl-sub">Si el rol es Profesor, queda enlazado automáticamente a un registro nuevo en Académico → Profesores (mismo nombre y correo) — no hace falta vincular nada aparte.</p>' +
        "</div>");
      modal("Nueva cuenta de staff", b, function () {
        return callFn({
          action: "create_account", role: b.querySelector("[name=r]").value,
          full_name: b.querySelector("[name=n]").value.trim(),
          email: b.querySelector("[name=e]").value.trim(),
          password: b.querySelector("[name=p]").value, send_email: wantsMail(b)
        }).then(function (res) { toastMail("Cuenta creada.", res); load(); });
      }, "Crear");
    };

    function load() {
      host.innerHTML = '<p class="muted">Cargando…</p>';
      Promise.all([q("profiles").select("*"), q("teachers").select("*")]).then(function (res) {
        if (res[0].error) throw res[0].error;
        var profiles = res[0].data || [], teachers = res[1].data || [];
        var linkedTeacher = {};
        profiles.forEach(function (p) { if (p.teacher_id) linkedTeacher[p.teacher_id] = true; });
        var rows = profiles.map(function (p) {
          return { name: p.full_name || "—", email: p.email, role: p.role, active: p.active,
            created_at: p.created_at, kind: "cuenta", user_id: p.user_id };
        });
        teachers.filter(function (t) { return !linkedTeacher[t.id]; }).forEach(function (t) {
          rows.push({ name: t.full_name, email: t.email, role: "teacher", active: t.active,
            created_at: t.created_at, kind: "profesor-sin-cuenta", teacher_id: t.id });
        });

        var fRol = bar.querySelector("[data-f-rol]").value;
        var fEst = bar.querySelector("[data-f-est]").value;
        var fOrd = bar.querySelector("[data-f-ord]").value;
        rows = rows.filter(function (r) {
          if (fRol && r.role !== fRol) return false;
          if (fEst === "1" && !r.active) return false;
          if (fEst === "0" && r.active) return false;
          return true;
        }).sort(function (a, b) {
          var d = new Date(a.created_at) - new Date(b.created_at);
          return fOrd === "asc" ? d : -d;
        });

        var t = tableWrap(["Nombre", "Correo", "Rol", "Acceso", "Creado", "Acciones"]);
        rows.forEach(function (r) {
          var acceso = r.kind === "profesor-sin-cuenta" ? '<span class="badge neutral">sin cuenta</span>'
            : r.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>';
          var tr = h("<tr><td>" + esc(r.name) + "</td><td>" + esc(r.email) + "</td><td>" +
            esc(ROLE_ES[r.role] || r.role) + "</td><td>" + acceso + "</td><td>" + date(r.created_at) +
            '</td><td class="acts"></td></tr>');
          var cell = tr.children[5];
          if (r.kind === "profesor-sin-cuenta") {
            cell.appendChild(btn("Crear cuenta", "btn-blue", function () {
              var pwd = genPassword();
              var b = h("<div>" + field("Nombre", '<input name="n" value="' + esc(r.name) + '">') +
                field("Correo", '<input name="e" type="email" value="' + esc(r.email) + '">') +
                field("Contraseña temporal", '<input name="p" value="' + pwd + '">') + mailCheckbox() + "</div>");
              modal("Crear cuenta — " + r.name, b, function () {
                return callFn({
                  action: "create_account", role: "teacher",
                  full_name: b.querySelector("[name=n]").value.trim(),
                  email: b.querySelector("[name=e]").value.trim(),
                  password: b.querySelector("[name=p]").value, teacher_id: r.teacher_id, send_email: wantsMail(b)
                }).then(function (res) { toastMail("Cuenta creada.", res); load(); });
              }, "Crear");
            }));
            // Registro de profesor sin cuenta de acceso (queda así, p. ej., al
            // eliminar la cuenta de un profesor): se borra de Académico → Profesores.
            // Con grupos asignados la BD lo impide (on delete restrict) y
            // friendly() lo explica en palabras.
            cell.appendChild(btn("Eliminar", "btn-danger", function () {
              confirmDelete("Eliminar profesor",
                "Vas a eliminar el registro de profesor de " + r.name + " (no tiene cuenta de acceso). " +
                "También se borran sus anotaciones sobre estudiantes y su conexión con Google Classroom. " +
                "Si tiene grupos asignados no se podrá: reasígnalos primero en Académico → Grupos.",
                function () {
                  return q("teachers").delete().eq("id", r.teacher_id).then(function (d) {
                    if (d.error) throw d.error;
                    toast("Profesor eliminado."); load();
                  });
                });
            }));
            t.body.appendChild(tr); return;
          }
          if (r.user_id === ME.user_id) { cell.innerHTML = '<span class="muted">tú</span>'; t.body.appendChild(tr); return; }
          cell.appendChild(btn("Editar", "btn-ghost", function () {
            var b = h("<div>" + field("Nombre", '<input name="n" value="' + esc(r.name === "—" ? "" : r.name) + '">') +
              field("Correo", '<input name="e" type="email" value="' + esc(r.email) + '">') + "</div>");
            modal("Editar usuario", b, function () {
              var full_name = b.querySelector("[name=n]").value.trim();
              var email = b.querySelector("[name=e]").value.trim();
              if (!full_name) throw new Error("Escribe el nombre.");
              if (!email) throw new Error("Escribe el correo.");
              return callFn({ action: "update_profile", user_id: r.user_id, full_name: full_name, email: email })
                .then(function () { toast("Usuario actualizado."); load(); });
            }, "Guardar");
          }));
          cell.appendChild(btn("Restablecer contraseña", "btn-ghost", function () {
            var np = genPassword();
            var bb = h("<div>" + field("Nueva contraseña temporal", '<input name="p" value="' + np + '">') + mailCheckbox() +
              '<p class="pnl-sub">Compártela con ' + esc(r.name) + '. Podrá cambiarla luego.</p></div>');
            modal("Restablecer contraseña — " + r.name, bb, function () {
              return callFn({ action: "reset_password", user_id: r.user_id, password: bb.querySelector("[name=p]").value, send_email: wantsMail(bb) })
                .then(function (res) { toastMail("Contraseña actualizada.", res); });
            }, "Guardar");
          }));
          cell.appendChild(btn(r.active ? "Desactivar" : "Activar", "btn-ghost", function () {
            callFn({ action: "set_active", user_id: r.user_id, active: !r.active })
              .then(function () { toast("Actualizado."); load(); }).catch(function (e) { toast(friendly(e), "err"); });
          }));
          if (r.role !== "student") {
            var rl = h('<select style="width:auto"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>');
            rl.value = r.role;
            // Cambio de rol real (manage-users set_role): se confirma explicando
            // qué se borra/crea. El select vuelve a su valor hasta que se confirme.
            rl.onchange = function () {
              var target = rl.value;
              rl.value = r.role;
              var toAdmin = target === "admin";
              var bodyTxt = toAdmin
                ? "Pasará a ser Administrador y dejará de ser profesor: se borra su registro en Académico → Profesores, " +
                  "sus anotaciones sobre estudiantes y su conexión con Google Classroom. Si tiene grupos asignados no se podrá: " +
                  "reasígnalos primero en Académico → Grupos."
                : "Pasará a ser Profesor y dejará de ser administrador: pierde el acceso a la administración y se le crea " +
                  "su registro en Académico → Profesores para poder asignarle grupos.";
              modal("Cambiar rol — " + (r.name || r.email), h('<p class="pnl-sub" style="margin-bottom:4px">' + esc(bodyTxt) + "</p>"), function () {
                return callFn({ action: "set_role", user_id: r.user_id, role: target }).then(function (res) {
                  toast(toAdmin
                    ? "Ahora es Administrador." + (res && res.removed_teacher ? " Se borró su registro de profesor." : "")
                    : "Ahora es Profesor." + (res && res.created_teacher ? " Se creó su registro en Académico → Profesores." : ""));
                  load();
                });
              }, toAdmin ? "Pasar a Administrador" : "Pasar a Profesor", toAdmin);
            };
            cell.appendChild(rl);
          }
          if (r.role === "admin") {
            // Parte 5: si otro admin perdió/cambió el celular, se le borra la
            // verificación en 2 pasos y al entrar la vuelve a activar.
            cell.appendChild(btn("Restablecer 2 pasos", "btn-ghost", function () {
              modal("Restablecer verificación en 2 pasos — " + (r.name || r.email),
                h('<p class="pnl-sub" style="margin-bottom:4px">Úsalo si ' + esc(r.name || r.email) +
                  " perdió o cambió su celular. Se borra su verificación en 2 pasos actual; la próxima vez que entre, " +
                  "el sistema le pedirá activarla de nuevo con su celular nuevo.</p>"),
                function () {
                  return callFn({ action: "reset_mfa", user_id: r.user_id }).then(function (res) {
                    toast(res && res.removed ? "Verificación en 2 pasos restablecida. Al entrar la activará de nuevo."
                      : "Esa cuenta no tenía la verificación en 2 pasos activa.");
                  });
                }, "Restablecer");
            }));
          }
          cell.appendChild(btn("Eliminar", "btn-danger", function () {
            confirmDelete("Eliminar cuenta", "Se elimina el acceso de " + (r.name || r.email) + ". El registro de estudiante/profesor asociado NO se borra.", function () {
              return callFn({ action: "delete_account", user_id: r.user_id }).then(function () { toast("Cuenta eliminada."); load(); });
            });
          }));
          t.body.appendChild(tr);
        });
        if (!rows.length) t.body.appendChild(h('<tr><td colspan="6" class="muted">Sin usuarios con esos filtros.</td></tr>'));
        host.innerHTML = ""; host.appendChild(t.wrap);
      }).catch(function (e) { host.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
    }
    bar.querySelectorAll("select").forEach(function (s) { s.addEventListener("change", load); });
    load();
  }

  boot();
})();
