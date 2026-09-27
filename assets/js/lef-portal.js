/* LEF — Portal del estudiante. Pestañas: Inicio (tablón), Facturación, Mi curso,
   Mis recursos, Mi cuenta. El logo lleva a Inicio.
   El cobro en línea usa el Widget oficial de Wompi (checkout.wompi.co/widget.js);
   la firma de integridad se calcula en el Edge Function wompi-checkout (nunca en el
   navegador) y el pago se confirma por el webhook wompi-webhook, no por el resultado
   del widget. Guardar tarjeta / cobro automático: pendiente de confirmar, sin nada visible en el portal. */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var ME = null; // { user_id, full_name, avatar_url, ... }
  var TOKEN = null;

  function callFn(name, body) {
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

  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function field(label, inputHtml) { return '<label class="fld"><span>' + esc(label) + "</span>" + inputHtml + "</label>"; }
  function money(n, cur) {
    if (n == null) return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: cur || "COP", maximumFractionDigits: 0 }).format(n);
  }
  function date(s) {
    if (!s) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }
  function monthLabel(s) {
    if (!s) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    var t = d.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  var DAY_ES = {
    Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles", Thursday: "Jueves",
    Friday: "Viernes", Saturday: "Sábado", Sunday: "Domingo"
  };
  var DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function fmtDays(days) {
    if (!days || !days.length) return "";
    var sorted = days.slice().sort(function (a, b) { return DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b); });
    return sorted.map(function (d) { return DAY_ES[d] || d; }).join(" · ");
  }
  function fmtTime(t) {
    if (!t) return "";
    var p = t.split(":"); var hh = parseInt(p[0], 10); var mm = p[1] || "00";
    var ap = hh >= 12 ? "p.m." : "a.m."; var h12 = hh % 12 || 12;
    return h12 + ":" + mm + " " + ap;
  }
  var METHOD_ES = { cash: "Efectivo", transfer: "Transferencia", pse: "PSE", card: "Tarjeta", other: "Otro" };
  var PAYST_ES = { approved: "Aprobado", pending: "Pendiente", declined: "Rechazado", refunded: "Reverso" };

  // Misma política que exige Supabase (Authentication → Passwords).
  var PW_HINT = "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo (por ejemplo ! @ # $ % * ? - _).";
  function checkPassword(pw) {
    pw = String(pw || "");
    if (pw.length < 12) return "La contraseña debe tener al menos 12 caracteres.";
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) return "La contraseña debe tener mayúsculas y minúsculas.";
    if (!/[0-9]/.test(pw)) return "La contraseña debe tener al menos un número.";
    if (!/[^A-Za-z0-9]/.test(pw)) return "La contraseña debe tener al menos un símbolo (por ejemplo ! @ # $ % * ? - _).";
    return "";
  }
  function pwErrorEs(e) {
    var m = (e && e.message) || String(e);
    if (/pwned|known to be weak|leaked/i.test(m)) return "Esa contraseña aparece en filtraciones públicas de internet. Elige otra distinta.";
    if ((e && e.code === "weak_password") || /weak_password|Password should/i.test(m)) return "La contraseña no cumple los requisitos: " + PW_HINT;
    if (/same_password|different from the old/i.test(m)) return "La nueva contraseña debe ser distinta de la actual.";
    return m;
  }

  var WHATSAPP_NUMBER = "573173962244";
  function waLink(s) {
    var msg = "Hola LEF, ya hice la transferencia de mi mensualidad" +
      (s.module_level ? " del módulo " + s.module_level : "") + " (" + money(s.monthly_amount, s.currency) + "). Adjunto el comprobante.";
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
  }
  function copyKey(btn) {
    var original = btn.textContent;
    function done(ok) {
      btn.textContent = ok ? "¡Llave copiada!" : "No se pudo copiar";
      setTimeout(function () { btn.textContent = original; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText("@lefcenter").then(function () { done(true); }).catch(function () { done(false); });
    } else {
      done(false);
    }
  }

  function boot() {
    sb.auth.getSession().then(function (r) {
      if (!r.data.session) return window.location.replace("login.html");
      TOKEN = r.data.session.access_token;
      var uid = r.data.session.user.id;
      // select("*") y no una lista de columnas: así, si must_change_password aún
      // no existe en la BD, la consulta no falla (una columna inexistente en la
      // lista haría fallar el login de todos los estudiantes).
      sb.from("profiles").select("*").eq("user_id", uid).maybeSingle()
        .then(function (p) {
          if (p.error || !p.data || !p.data.active) {
            return sb.auth.signOut().then(function () { window.location.replace("login.html"); });
          }
          if (p.data.role !== "student") return window.location.replace("admin.html");
          ME = p.data;
          // Contraseña temporal puesta por un admin → primero crear una personal.
          if (window.LEFPrimerIngreso) return window.LEFPrimerIngreso.check(sb, ME, app, renderShell);
          renderShell();
        });
    });
  }

  var TABS = [
    { id: "inicio", label: "Inicio", render: renderHome },
    { id: "facturacion", label: "Facturación", render: renderBilling },
    { id: "curso", label: "Mi curso", render: renderCourse },
    { id: "calendario", label: "Calendario", render: renderCalendar },
    { id: "clase-hoy", label: "Clase de hoy", render: renderClassToday, hidden: true, parent: "curso" },
    { id: "recursos", label: "Mis recursos", render: renderResources },
    { id: "cuenta", label: "Mi cuenta", render: renderAccount }
  ];

  function renderShell() {
    app.innerHTML = "";
    app.appendChild(h(
      '<div class="pnl-top">' +
      // El logo lleva a Inicio (antes sacaba de la plataforma, a la página pública).
      '<a class="brand" href="#inicio"><img src="assets/logo-horizontal.png" alt="LEF"><span class="tag">Mi cuenta</span></a>' +
      '<div class="who">' +
      '<img src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none">' +
      '<span class="name-text">' + esc(ME.full_name || "") + '</span>' +
      ' <button class="link" data-logout>Salir</button></div></div>'
    ));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"></nav><main class="pnl-main"></main></div>');
    var nav = wrap.querySelector(".pnl-nav");
    TABS.forEach(function (t) { if (!t.hidden) nav.appendChild(h('<a href="#' + t.id + '">' + esc(t.label) + "</a>")); });
    app.appendChild(wrap);
    app.querySelector("[data-logout]").onclick = function () { sb.auth.signOut().then(boot); };

    window.onhashchange = route;
    var cur = location.hash.slice(1);
    if (!cur || !TABS.some(function (t) { return t.id === cur; })) location.hash = TABS[0].id;
    else route();
  }

  function route() {
    var id = location.hash.slice(1);
    if (id !== "clase-hoy" && typeof clearTodayTimers === "function") clearTodayTimers();
    var tab = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    document.querySelectorAll(".pnl-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + (tab.parent || tab.id));
    });
    var main = document.querySelector(".pnl-main");
    if (!main) return;
    main.innerHTML = '<p class="muted">Cargando…</p>';
    tab.render(main);
  }

  /* ---------- Inicio (tablón) ---------- */
  // Estructura (buenas prácticas de portales educativos): saludo personal
  // arriba → avisos urgentes en franjas de color → resumen de curso, pagos y
  // progreso con acceso directo a cada pestaña → novedades de LEF (fijadas
  // primero, luego las más recientes, con imagen de portada) → contacto.
  var NEWS_CAT = {
    novedad: { label: "Novedad", cls: "cat-novedad" },
    academico: { label: "Académico", cls: "cat-academico" },
    evento: { label: "Evento", cls: "cat-evento" },
    pagos: { label: "Pagos", cls: "cat-pagos" },
    importante: { label: "Importante", cls: "cat-importante" }
  };
  // Programa completo A1.1 → C1.3 (módulos 1–15): contar también el nivel C1
  // anima a matricularse en los últimos módulos (pedido del cliente). El
  // progreso de cada estudiante cuenta desde el módulo con el que ENTRÓ (no
  // todos empiezan en A1.1): quien entra en el 8 tiene una ruta de 8 módulos.
  var TOTAL_MODULES = 15;

  function go(tab) { location.hash = tab; }
  function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || ""; }
  function safeUrl(u) { return /^(https:\/\/|assets\/)/.test(u || "") ? u : ""; }
  function safeLink(u) { return /^https?:\/\//.test(u || "") ? u : ""; }

  // Próxima clase a partir de los días y la hora de inicio del horario.
  function nextClass(days, startTime) {
    if (!days || !days.length || !startTime) return null;
    var p = startTime.split(":"), now = new Date();
    for (var i = 0; i < 8; i++) {
      var d = new Date(now); d.setDate(now.getDate() + i);
      d.setHours(+p[0], +p[1] || 0, 0, 0);
      if (days.indexOf(DAY_ORDER[(d.getDay() + 6) % 7]) !== -1 && d > now) return d;
    }
    return null;
  }
  function whenLabel(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var dd = new Date(d); dd.setHours(0, 0, 0, 0);
    var diff = Math.round((dd - today) / 86400000);
    var hhmm = fmtTime(String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"));
    return (diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : DAY_ES[DAY_ORDER[(d.getDay() + 6) % 7]]) + ", " + hhmm;
  }

  function renderHome(main) {
    sb.rpc("close_ended_cycles").then(function () {}, function () {}).then(function () {
      return Promise.all([
        sb.rpc("get_my_course"),
        sb.rpc("get_my_billing"),
        sb.rpc("get_next_module_offer"),
        sb.rpc("get_my_announcements")
      ]);
    }).then(function (res) {
      if (res[0].error) throw res[0].error;
      var courses = res[0].data || [];
      var billing = (res[1] && res[1].data) || {};
      var offer = (res[2] && res[2].data && res[2].data[0]) || null;
      var news = (res[3] && !res[3].error && res[3].data) || [];

      var current = courses.filter(function (c) { return !isCourseDone(c); })[0] || null;
      var doneCount = courses.filter(isCourseDone).length;
      var subs = (billing.subscriptions || []).filter(function (s) { return s.status !== "cancelled"; });
      var owing = subs.filter(function (s) { return s.status !== "cancelled" && (s.paid_amount || 0) < s.monthly_amount; });
      var frozen = subs.some(function (s) { return s.status === "frozen"; });
      var balance = owing.reduce(function (a, s) { return a + (s.monthly_amount - (s.paid_amount || 0)); }, 0);
      var pays = (billing.payments || []).filter(function (p) { return p.status === "approved" && !p.reverses_payment; })
        .sort(function (a, b) { return new Date(b.paid_at) - new Date(a.paid_at); });

      main.innerHTML = "";

      // 1) Saludo personal
      var today = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
      main.appendChild(h(
        '<section class="home-hero">' +
        '<div class="home-hero__txt">' +
        '<p class="home-hero__date">' + esc(today.charAt(0).toUpperCase() + today.slice(1)) + "</p>" +
        "<h1>¡Hola, " + esc(firstName(ME.full_name) || "bienvenido") + "!</h1>" +
        '<p class="home-hero__sub">' + (current
          ? "Estás cursando el <strong>módulo " + esc(current.module_level) + "</strong> — " + esc(current.module_title) + "."
          : doneCount ? "Ya completaste " + doneCount + (doneCount === 1 ? " módulo" : " módulos") + ". ¡Sigue avanzando!"
          : "Bienvenido a tu plataforma de LEF.") + "</p>" +
        "</div></section>"
      ));

      // 2) Avisos urgentes (franjas de color, lo primero que se ve)
      var alerts = [];
      if (frozen) alerts.push(["bad", "Tu cuenta está <strong>congelada</strong> por falta de pago. Ponte al día para reactivar tu curso.", "Ir a Facturación", "facturacion"]);
      else if (owing.length) {
        var partial = owing.some(function (s) { return (s.paid_amount || 0) > 0; });
        alerts.push(["warn", partial
          ? "Te falta <strong>" + money(balance, "COP") + "</strong> para completar tu mensualidad."
          : "Tienes una mensualidad pendiente de <strong>" + money(balance, "COP") + "</strong>" +
            (current && current.enrollment_status === "PendingPayment" ? " — págala para activar tu módulo." : "."),
          "Pagar ahora", "facturacion"]);
      }
      if (offer) alerts.push(["info", "Ya puedes matricularte en el <strong>módulo " + esc(offer.next_module_level) + "</strong> — " + esc(offer.next_module_title) + ".", "Ver en Mi curso", "curso"]);
      if (current && current.enrollment_status === "Active" && !(current.schedule_days && current.schedule_days.length)) {
        alerts.push(["neutral", "Todavía no tienes horario asignado — LEF te contactará por WhatsApp para coordinarlo.", "", ""]);
      }
      alerts.forEach(function (a) {
        var el = h('<div class="home-alert home-alert--' + a[0] + '"><span>' + a[1] + "</span>" +
          (a[2] ? '<button type="button" class="btn btn-sm ' + (a[0] === "info" ? "btn-blue" : "btn-dark") + '">' + esc(a[2]) + "</button>" : "") + "</div>");
        var b = el.querySelector("button"); if (b) b.addEventListener("click", function () { go(a[3]); });
        main.appendChild(el);
      });

      // 3) Resumen: curso · pagos · progreso
      var courseBody;
      if (current) {
        var nc = nextClass(current.schedule_days, current.schedule_start_time);
        courseBody = '<div class="home-card__big">' + esc(current.module_level) + "</div>" +
          '<div class="home-card__line">' + esc(current.module_title) + "</div>" +
          (current.enrollment_status === "PendingPayment" ? '<span class="badge warn">pendiente de pago</span>'
            : nc ? '<div class="home-card__line"><strong>Próxima clase:</strong> ' + esc(whenLabel(nc)) + "</div>"
            : current.cycle_end_date ? '<div class="home-card__line">Ciclo hasta el ' + esc(date(current.cycle_end_date)) + "</div>"
            : '<div class="home-card__line muted">Sin horario asignado todavía</div>');
      } else {
        courseBody = '<div class="home-card__big">—</div><div class="home-card__line">' +
          (offer ? "Tu siguiente módulo es " + esc(offer.next_module_level) : "Sin módulo en curso") + "</div>";
      }
      var payBody = !subs.length
        ? '<div class="home-card__big">—</div><div class="home-card__line">Aún no tienes mensualidades</div>'
        : frozen ? '<div class="home-card__big home-card__big--bad">Congelada</div><div class="home-card__line">Saldo: ' + money(balance, "COP") + "</div>"
        : owing.length ? '<div class="home-card__big home-card__big--warn">' + money(balance, "COP") + '</div><div class="home-card__line">Saldo pendiente</div>'
        : '<div class="home-card__big home-card__big--ok">Al día</div><div class="home-card__line">No tienes saldos pendientes</div>';
      if (pays[0]) payBody += '<div class="home-card__line muted">Último pago: ' + money(pays[0].amount, pays[0].currency) + " · " + esc(date(pays[0].paid_at)) + "</div>";
      var first = courses.reduce(function (a, c) { return !a || c.module_number < a.module_number ? c : a; }, null);
      var routeTotal = first ? TOTAL_MODULES - first.module_number + 1 : TOTAL_MODULES;
      var pct = Math.min(100, Math.round(doneCount / routeTotal * 100));
      var progBody = '<div class="home-card__big">' + doneCount + '<span class="home-card__of"> / ' + routeTotal + "</span></div>" +
        '<div class="home-card__line">módulos completados (' + esc(first ? first.module_level : "A1.1") + " → C1.3)</div>" +
        '<div class="home-card__bar"><div style="width:' + pct + '%"></div></div>';

      var cards = h('<div class="home-cards"></div>');
      [["Mi curso", courseBody, "Ver mi curso", "curso"],
       ["Mis pagos", payBody, "Ir a Facturación", "facturacion"],
       ["Mi progreso", progBody, "Ver mis recursos", "recursos"]].forEach(function (c) {
        var card = h('<div class="home-card"><div class="home-card__k">' + esc(c[0]) + "</div>" + c[1] +
          '<button type="button" class="link home-card__go">' + esc(c[2]) + " →</button></div>");
        card.querySelector(".home-card__go").addEventListener("click", function () { go(c[3]); });
        cards.appendChild(card);
      });
      main.appendChild(cards);

      // 4) Novedades de LEF
      main.appendChild(h('<div class="home-sec"><h2 class="pnl-h">Novedades de LEF</h2></div>'));
      if (!news.length) {
        main.appendChild(h('<div class="home-empty">Por ahora no hay novedades nuevas. Cuando LEF publique algo, lo verás aquí primero.</div>'));
      } else {
        var grid = h('<div class="news-grid"></div>');
        var weekAgo = Date.now() - 7 * 86400000;
        news.forEach(function (n) {
          var cat = NEWS_CAT[n.category] || NEWS_CAT.novedad;
          var img = safeUrl(n.image_url);
          var isNew = new Date(n.publish_at).getTime() > weekAgo;
          var excerpt = (n.body || "").length > 160 ? n.body.slice(0, 157).trim() + "…" : (n.body || "");
          var card = h(
            '<article class="news-card' + (n.pinned ? " news-card--pinned" : "") + '" tabindex="0" role="button">' +
            (img ? '<div class="news-card__img"><img src="' + esc(img) + '" alt="" loading="lazy"></div>' : "") +
            '<div class="news-card__body">' +
            '<div class="news-card__meta"><span class="news-cat ' + cat.cls + '">' + esc(cat.label) + "</span>" +
            (n.pinned ? '<span class="news-pin">📌 Fijado</span>' : "") +
            (n.kind === "exam_result" ? '<span class="news-mine">Solo para ti</span>' : "") +
            (isNew ? '<span class="news-new">Nuevo</span>' : "") +
            (n.module_level ? '<span class="news-mod">Módulo ' + esc(n.module_level) + "</span>" : "") + "</div>" +
            "<h3>" + esc(n.title) + "</h3>" +
            '<p class="news-card__date">' + esc(date(n.publish_at)) + "</p>" +
            (excerpt ? '<p class="news-card__excerpt">' + esc(excerpt) + "</p>" : "") +
            '<span class="news-card__more">Leer más →</span>' +
            "</div></article>"
          );
          function open() { openNews(n); }
          card.addEventListener("click", open);
          card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
          grid.appendChild(card);
        });
        main.appendChild(grid);
      }

      // 5) Contacto
      main.appendChild(h(
        '<div class="home-help"><strong>¿Tienes dudas sobre tus clases o tus pagos?</strong>' +
        '<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="https://wa.me/' + WHATSAPP_NUMBER + '">' +
        '<img src="assets/icon-whatsapp-black.png" alt="" class="icn-inline">Escríbenos por WhatsApp</a></div>'
      ));
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu inicio: ' + esc((e && e.message) || e) + "</div>";
    });
  }

  // Novedad completa en un recuadro (el tablón solo muestra el resumen).
  function openNews(n) {
    var cat = NEWS_CAT[n.category] || NEWS_CAT.novedad;
    var img = safeUrl(n.image_url), link = safeLink(n.link_url);
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h(
      '<div class="pnl-modal news-modal">' +
      '<button type="button" class="pay-modal__close" data-close aria-label="Cerrar">×</button>' +
      (img ? '<img class="news-modal__img" src="' + esc(img) + '" alt="">' : "") +
      '<div class="news-card__meta"><span class="news-cat ' + cat.cls + '">' + esc(cat.label) + "</span>" +
      (n.module_level ? '<span class="news-mod">Módulo ' + esc(n.module_level) + "</span>" : "") + "</div>" +
      '<h3 class="news-modal__title">' + esc(n.title) + "</h3>" +
      '<p class="news-card__date">' + esc(date(n.publish_at)) + "</p>" +
      '<div class="news-modal__body">' + esc(n.body || "") + "</div>" +
      (link ? '<a class="btn btn-blue btn-sm" style="margin-top:14px" target="_blank" rel="noopener" href="' + esc(link) + '">' + esc(n.link_label || "Ver más") + "</a>" : "") +
      (n.kind === "exam_result" && n.ref_id ? '<button type="button" class="btn btn-blue btn-sm" style="margin-top:14px" data-exam-detail>Ver detalle</button>' : "") +
      "</div>"
    );
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    box.querySelector("[data-close]").addEventListener("click", close);
    var det = box.querySelector("[data-exam-detail]");
    if (det) det.addEventListener("click", function () { close(); renderExamResult(document.querySelector(".pnl-main"), n.ref_id); });
  }

  /* ---------- Facturación ---------- */
  function renderBilling(main) {
    sb.rpc("get_my_billing").then(function (r) {
      if (r.error) throw r.error;
      var d = r.data || {};
      var subs = d.subscriptions || [];
      var pays = d.payments || [];
      main.innerHTML = '<h1 class="pnl-h">Facturación</h1>' +
        '<p class="pnl-sub">Aquí gestionas el pago de tu mensualidad.</p>';

      if (!subs.length) {
        main.appendChild(h('<div class="pnl-alert ok">Aún no tienes una mensualidad asignada. LEF la configurará al confirmar tu inscripción.</div>'));
      }

      // Se precalcula cada suscripción y se reordena: la(s) que todavía hay que pagar
      // (recuadro grande) primero, y las ya pagadas y al día (recuadro delgado) debajo,
      // con la más reciente arriba — así queda como una lista que se va apilando cada
      // vez que llega un curso nuevo a cobrarse.
      var entries = subs.map(function (s) {
        var paid = s.paid_amount || 0;
        var subPays = pays.filter(function (p) { return p.subscription_id === s.id; });
        // "Pendiente" = todavía no hay ningún abono. "Pago parcial" = hay algo
        // abonado pero no completa la mensualidad — el estudiante ya está
        // activo en el sistema, solo queda saldo por cubrir. "Al día" = la
        // mensualidad ya está completa (en uno o varios abonos). En este
        // caso NO debe poder volver a pagar el mismo
        // curso por error (ver caso del estudiante que pasó de A1.1 pagado a
        // A1.2: A1.1 debe quedar "al día", sin botón de pago).
        var partial = s.status === "active" && paid > 0 && paid < s.monthly_amount;
        var upToDate = s.status === "active" && paid >= s.monthly_amount;
        var lastPay = subPays.filter(function (p) { return p.status === "approved"; })
          .sort(function (a, b) { return new Date(b.paid_at) - new Date(a.paid_at); })[0];
        return { s: s, paid: paid, partial: partial, upToDate: upToDate, lastPay: lastPay };
      });
      entries.sort(function (a, b) {
        if (a.upToDate !== b.upToDate) return a.upToDate ? 1 : -1;
        if (a.upToDate) {
          return new Date((b.lastPay && b.lastPay.paid_at) || 0) - new Date((a.lastPay && a.lastPay.paid_at) || 0);
        }
        return new Date(a.s.started_at || 0) - new Date(b.s.started_at || 0);
      });

      entries.forEach(function (e) {
        var s = e.s, paid = e.paid, partial = e.partial, upToDate = e.upToDate, lastPay = e.lastPay;
        var badge = s.status === "frozen" ? '<span class="badge bad">cuenta congelada</span>'
          : s.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
          : (s.status === "active" && paid <= 0) ? '<span class="badge neutral">pendiente</span>'
          : partial ? '<span class="badge warn">pago parcial</span>'
          : '<span class="badge ok">al día</span>';
        var titleTag = s.module_level
          ? '<div class="lvl-tag">Nivel · ' + esc(s.module_level) + " — " + esc(s.module_title) + "</div>"
          : '<div class="lvl-tag">Tu mensualidad</div>';

        if (s.status === "frozen") {
          main.appendChild(h('<div class="pnl-alert err">Tu cuenta está <strong>congelada</strong> por falta de pago. Realiza el pago o contacta a LEF por WhatsApp para reactivarla.</div>'));
        }

        if (upToDate) {
          // Ya pagado y al día: recuadro delgado — el detalle del pago queda un
          // clic más allá en vez de mezclarse con la mensualidad pendiente (si hay otra).
          var card = h(
            '<div class="course-compact">' +
            '<div class="course-compact__row">' +
            '<div>' + titleTag +
            '<div class="course-compact__sum">' + money(s.monthly_amount, s.currency) + " / mes · " + badge + "</div>" +
            "</div>" +
            '<button class="btn btn-ghost btn-sm" data-detail-toggle>Ver detalle</button>' +
            "</div>" +
            '<div class="course-compact__detail" hidden></div>' +
            "</div>"
          );
          main.appendChild(card);

          var toggleBtn = card.querySelector("[data-detail-toggle]");
          var detailPanel = card.querySelector(".course-compact__detail");
          var open = false;
          toggleBtn.addEventListener("click", function () {
            open = !open;
            detailPanel.hidden = !open;
            toggleBtn.textContent = open ? "Ocultar detalle" : "Ver detalle";
            if (open && !detailPanel.dataset.filled) {
              detailPanel.dataset.filled = "1";
              detailPanel.innerHTML = lastPay ? (
                '<div class="stat-row stat-row--stack" style="margin-bottom:10px">' +
                '<div class="stat"><div class="k">Recibo</div><div class="v" style="font-size:16px">' + esc(lastPay.receipt_number || "—") + "</div></div>" +
                '<div class="stat"><div class="k">Monto pagado</div><div class="v" style="font-size:16px">' + money(lastPay.amount, lastPay.currency) + "</div></div>" +
                '<div class="stat"><div class="k">Fecha de pago</div><div class="v" style="font-size:16px">' + date(lastPay.paid_at) + "</div></div>" +
                '<div class="stat"><div class="k">Método</div><div class="v" style="font-size:16px">' + esc(METHOD_ES[lastPay.method] || lastPay.method) + "</div></div>" +
                "</div>" +
                '<p class="muted" style="font-size:12.5px">Mes cubierto: ' + monthLabel(lastPay.period_month) +
                (lastPay.reference ? " · Referencia: " + esc(lastPay.reference) : "") + "</p>" +
                (s.description ? '<p class="pnl-sub" style="margin-top:10px">' + esc(s.description) + "</p>" : "")
              ) : '<p class="muted" style="font-size:13px">No encontramos el detalle de este pago.</p>';
            }
          });
          return;
        }

        // Pendiente de pago o vencido: recuadro grande y detallado, con el pago en
        // línea integrado en el mismo recuadro (así queda claro a qué curso corresponde).
        var hero = h(
          '<div class="course-hero">' +
          titleTag +
          "<h2>" + money(s.monthly_amount, s.currency) + "<span style=\"font-family:inherit;font-size:14px;color:var(--grafito);font-weight:400\"> / mes</span></h2>" +
          '<div class="mod-name">' + badge + "</div>" +
          (s.description ? '<p class="pnl-sub" style="margin:-8px 0 18px">' + esc(s.description) + "</p>" : "") +
          // Con un abono el curso ya queda activo (acuerdo con LEF): el mensaje
          // solo recuerda el saldo, sin condicionar el acceso.
          (partial ? '<p class="pnl-sub" style="margin:-8px 0 18px">Ya abonaste <strong>' + money(paid, s.currency) +
            "</strong> y tu curso ya está activo: puedes entrar a tus clases y recursos cuando quieras. Tu saldo pendiente es de <strong>" +
            money(s.monthly_amount - paid, s.currency) + "</strong>; recuerda completarlo antes de que termine tu ciclo.</p>" : "") +
          (s.status === "cancelled" ? "" :
            '<div class="course-hero__pay">' +
            '<p class="course-hero__pay-lead">Puedes pagar tu mensualidad de dos formas: por transferencia directa escaneando un QR desde tu app bancaria o usando la llave Bre-B @lefcenter, o con tarjeta débito/crédito a través de Wompi. Elige la que prefieras en el siguiente paso.</p>' +
            '<button class="btn btn-blue" data-open-pay>Pagar ahora</button>' +
            "</div>") +
          "</div>"
        );
        main.appendChild(hero);

        var openPayBtn = hero.querySelector("[data-open-pay]");
        if (openPayBtn) {
          openPayBtn.addEventListener("click", function () { openPayModal(s, main); });
        }
      });

      main.appendChild(h('<h2 class="pnl-h" style="font-size:16px;margin-top:8px">Historial de pagos</h2>'));
      var t = h('<div class="pnl-table-wrap"><table class="pnl"><thead><tr>' +
        "<th>Recibo</th><th>Fecha</th><th>Mes cubierto</th><th>Monto</th><th>Método</th><th>Estado</th><th>Referencia</th>" +
        "</tr></thead><tbody></tbody></table></div>");
      var tb = t.querySelector("tbody");
      pays.forEach(function (p) {
        tb.appendChild(h("<tr><td>" + esc(p.receipt_number || "—") + "</td><td>" + date(p.paid_at) + "</td><td>" + monthLabel(p.period_month) + "</td><td>" +
          money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) + "</td><td>" +
          esc(PAYST_ES[p.status] || p.status) + "</td><td>" + esc(p.reference || "—") + "</td></tr>"));
      });
      if (!pays.length) tb.appendChild(h('<tr><td colspan="7" class="muted">Todavía no hay pagos registrados.</td></tr>'));
      main.appendChild(t);
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu información: ' + esc(e.message) + "</div>";
    });
  }

  // Amplía una imagen a pantalla casi completa (el QR se ve bien en el modal,
  // pero a ese tamaño el celular no siempre lo enfoca para escanear).
  function openImageLightbox(src, alt) {
    var lb = h(
      '<div class="qr-lightbox">' +
      '<button type="button" class="qr-lightbox__close" data-close aria-label="Cerrar">×</button>' +
      '<img src="' + src + '" alt="' + esc(alt) + '">' +
      "</div>"
    );
    document.body.appendChild(lb);
    function close() { lb.remove(); }
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    lb.querySelector("[data-close]").addEventListener("click", close);
  }

  // Recuadro flotante "¿Cómo quieres pagar?" (se abre al pulsar "Pagar ahora"):
  // a la izquierda el QR de transferencia directa, a la derecha Wompi con su
  // propio banner y un botón verde que dispara el widget.
  function openPayModal(s, main) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h(
      '<div class="pnl-modal wide pay-modal">' +
      '<button type="button" class="pay-modal__close" data-close aria-label="Cerrar">×</button>' +
      "<h3>¿Cómo quieres pagar?</h3>" +
      '<div class="pay-modal__cols">' +
      '<div class="pay-modal__col">' +
      '<img src="assets/qr-bancolombia.jpg" alt="QR de pago Bre-B — Lef Center" class="pay-visual pay-qr__img" data-qr-zoom>' +
      '<p class="muted" style="font-size:11.5px;text-align:center;margin-top:-4px">Toca el QR para verlo en grande y escanearlo mejor.</p>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-copy-key>Copiar llave @lefcenter</button>' +
      '<p class="muted" style="font-size:12px;text-align:center">' +
      'Después de transferir, <a href="' + waLink(s) + '" target="_blank" rel="noopener">escríbenos por WhatsApp con el comprobante</a> para registrar tu pago.</p>' +
      "</div>" +
      '<div class="pay-modal__divider">o</div>' +
      '<div class="pay-modal__col">' +
      '<img src="assets/wompi-pagos-vertical.png" alt="Wompi — paga con tarjeta débito o crédito" class="pay-visual">' +
      '<button type="button" class="btn-wompi" data-pay>Pague aquí</button>' +
      "</div>" +
      "</div>" +
      '<p class="muted" data-pay-msg style="text-align:center;font-size:12.5px;margin-top:6px"></p>' +
      "</div>"
    );
    bg.appendChild(box);
    document.body.appendChild(bg);

    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    box.querySelector("[data-close]").addEventListener("click", close);

    box.querySelector("[data-qr-zoom]").addEventListener("click", function () {
      openImageLightbox("assets/qr-bancolombia.jpg", "QR de pago Bre-B — Lef Center");
    });
    box.querySelector("[data-copy-key]").addEventListener("click", function (e) { copyKey(e.currentTarget); });

    var wompiBtn = box.querySelector("[data-pay]");
    var msgEl = box.querySelector("[data-pay-msg]");
    wompiBtn.addEventListener("click", function () {
      openWompiCheckout(s.id, msgEl, main, function (loading) { wompiBtn.classList.toggle("is-loading", loading); }, close);
    });
  }

  function openWompiCheckout(subscriptionId, msgEl, main, setLoading, closeModal) {
    if (!window.WidgetCheckout) {
      msgEl.textContent = "La pasarela de pagos no cargó. Recarga la página e intenta de nuevo.";
      return;
    }
    setLoading(true);
    msgEl.textContent = "";

    callFn("wompi-checkout", { subscription_id: subscriptionId }).then(function (d) {
      if (!d || !d.signature) throw new Error("respuesta_invalida");

      var checkout = new window.WidgetCheckout({
        currency: d.currency,
        amountInCents: d.amountInCents,
        reference: d.reference,
        publicKey: d.publicKey,
        signature: { integrity: d.signature }
      });
      setLoading(false);
      checkout.open(function (result) {
        var tx = result && result.transaction;
        if (tx && (tx.status === "APPROVED" || tx.status === "PENDING")) {
          msgEl.textContent = tx.status === "APPROVED"
            ? "¡Pago recibido! Actualizando tu historial…"
            : "Tu pago está pendiente de confirmación. Actualizaremos tu historial apenas se confirme.";
          setTimeout(closeModal, 1500);
        } else {
          msgEl.textContent = "El pago no se completó. Puedes intentarlo de nuevo.";
        }
        // El pago real lo confirma el webhook (no este resultado); refrescamos para
        // mostrarlo si ya llegó, y una vez más un poco después por si tarda unos segundos.
        setTimeout(function () { renderBilling(main); }, 1800);
        setTimeout(function () { renderBilling(main); }, 5000);
      });
    }).catch(function (e) {
      setLoading(false);
      msgEl.textContent = "No pudimos iniciar el pago: " + ((e && e.message) || e);
    });
  }

  /* ---------- Mi curso ---------- */
  function levelOf(moduleLevel) { return (moduleLevel || "").split(".")[0]; }

  function progressBar(startStr, endStr) {
    if (!startStr || !endStr) {
      return '<p class="pnl-sub">Tu ciclo todavía no tiene fechas asignadas — LEF te avisará cuando quede definido.</p>';
    }
    var start = new Date(startStr + "T00:00:00"), end = new Date(endStr + "T00:00:00"), now = new Date();
    var total = end - start, elapsed = now - start;
    var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / total) * 100))) : (now >= end ? 100 : 0);
    var dayAfterEnd = new Date(end); dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
    var doneMsg = now >= dayAfterEnd ? "Tu ciclo ya terminó — LEF actualizará tu siguiente módulo en breve."
      : now >= end ? "Hoy es el último día de tu ciclo."
      : now < start ? "Tu ciclo todavía no empieza."
      : "Va " + pct + "% del ciclo.";
    return '<div class="course-progress">' +
      '<div class="bar-labels"><span>' + date(startStr) + "</span><span>" + date(endStr) + "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<p class="bar-note">' + esc(doneMsg) + "</p></div>";
  }

  // Completado = el admin ya archivó ese módulo (asignó el siguiente), o el ciclo
  // ya terminó aunque todavía no le hayan asignado el módulo que sigue.
  // La fecha de fin es el último día de clase: el curso cuenta como terminado
  // desde el día siguiente (mismo criterio que el cierre automático del ciclo).
  function isCourseDone(c) {
    if (c.enrollment_status === "Completed") return true;
    if (!c.cycle_end_date) return false;
    var dayAfter = new Date(c.cycle_end_date + "T00:00:00");
    dayAfter.setDate(dayAfter.getDate() + 1);
    return new Date() >= dayAfter;
  }

  function renderCourseHero(main, c) {
    // Contenido del módulo y horario/aviso van DENTRO del mismo recuadro (antes
    // quedaban sueltos como párrafos aparte, y con varios cursos apilados no se
    // entendía a cuál pertenecía cada uno).
    var scheduleHtml = (c.schedule_days && c.schedule_days.length)
      ? '<div class="stat-row">' +
        '<div class="stat"><div class="k">Días</div><div class="v" style="font-size:16px">' + esc(fmtDays(c.schedule_days)) + "</div></div>" +
        '<div class="stat"><div class="k">Horario</div><div class="v" style="font-size:16px">' + fmtTime(c.schedule_start_time) + " – " + fmtTime(c.schedule_end_time) + "</div></div>" +
        (c.teacher_full_name ? '<div class="stat"><div class="k">Profesor(a)</div><div class="v" style="font-size:16px">' + esc(c.teacher_full_name) + "</div></div>" : "") +
        "</div>"
      : '<div class="pnl-alert ok" style="margin:0">Todavía no tienes horario asignado — LEF te contactará por WhatsApp para coordinarlo.</div>';

    // Mientras no haya ningún pago, el módulo está matriculado pero no activo:
    // el aviso lleva directo a Facturación (desaparece solo con el primer abono).
    var pendingHtml = c.enrollment_status === "PendingPayment"
      ? '<div class="pnl-alert warn course-pending"><span>Pendiente de pago — paga tu mensualidad para activar este módulo y sus recursos.</span>' +
        '<button type="button" class="btn btn-blue btn-sm" data-go-billing>Ir a Facturación</button></div>'
      : "";

    var card = h(
      '<div class="course-hero">' +
      '<div class="lvl-tag">Nivel · matrícula ' + esc(c.registration_number) + "</div>" +
      "<h2>" + esc(levelOf(c.module_level)) + "</h2>" +
      '<div class="mod-name">Módulo actual: ' + esc(c.module_level) + " — " + esc(c.module_title) + "</div>" +
      pendingHtml +
      progressBar(c.cycle_start_date, c.cycle_end_date) +
      (c.module_description ? '<p class="pnl-sub" style="margin:14px 0 16px"><strong>Contenido de este módulo:</strong> ' + esc(c.module_description) + "</p>" : "") +
      scheduleHtml +
      "</div>"
    );
    var goBilling = card.querySelector("[data-go-billing]");
    if (goBilling) goBilling.addEventListener("click", function () { location.hash = "facturacion"; });
    main.appendChild(card);
  }

  // Módulo ya culminado: recuadro delgado (igual que en Facturación), con "Ver
  // detalle" para el resumen de qué se vio y que quedó aprobado — sin mezclarse
  // con el módulo actual, que es el que debe verse en primer plano.
  function renderCourseCompact(main, c) {
    var card = h(
      '<div class="course-compact course-compact--done">' +
      '<div class="course-compact__row">' +
      '<div class="course-compact__left">' +
      '<div class="course-compact__check" aria-hidden="true">✓</div>' +
      "<div>" +
      '<div class="lvl-tag">Nivel · ' + esc(c.module_level) + " — " + esc(c.module_title) + "</div>" +
      '<div class="course-compact__sum">Matrícula ' + esc(c.registration_number) + "</div>" +
      "</div>" +
      "</div>" +
      '<button class="btn btn-ghost btn-sm" data-detail-toggle>Ver detalle</button>' +
      "</div>" +
      '<div class="course-compact__detail" hidden></div>' +
      "</div>"
    );
    main.appendChild(card);

    var toggleBtn = card.querySelector("[data-detail-toggle]");
    var detailPanel = card.querySelector(".course-compact__detail");
    var open = false;
    toggleBtn.addEventListener("click", function () {
      open = !open;
      detailPanel.hidden = !open;
      toggleBtn.textContent = open ? "Ocultar detalle" : "Ver detalle";
      if (open && !detailPanel.dataset.filled) {
        detailPanel.dataset.filled = "1";
        var scheduleHtml = (c.schedule_days && c.schedule_days.length)
          ? '<div class="stat-row stat-row--stack" style="margin-bottom:10px">' +
            '<div class="stat"><div class="k">Días</div><div class="v" style="font-size:16px">' + esc(fmtDays(c.schedule_days)) + "</div></div>" +
            '<div class="stat"><div class="k">Horario</div><div class="v" style="font-size:16px">' + fmtTime(c.schedule_start_time) + " – " + fmtTime(c.schedule_end_time) + "</div></div>" +
            (c.teacher_full_name ? '<div class="stat"><div class="k">Profesor(a)</div><div class="v" style="font-size:16px">' + esc(c.teacher_full_name) + "</div></div>" : "") +
            "</div>"
          : "";
        detailPanel.innerHTML =
          '<div class="course-compact__approved"><span aria-hidden="true">✓</span> Curso aprobado</div>' +
          (c.cycle_start_date && c.cycle_end_date ? '<p class="muted" style="font-size:12.5px;margin-bottom:10px">Ciclo: ' + date(c.cycle_start_date) + " – " + date(c.cycle_end_date) + "</p>" : "") +
          scheduleHtml +
          (c.module_description ? '<p class="pnl-sub" style="margin-top:4px"><strong>Contenido visto:</strong> ' + esc(c.module_description) + "</p>" : "");
      }
    });
  }

  // Sugerencia de auto-matrícula: solo aparece cuando el módulo actual ya
  // está terminado (chulo verde) y el admin todavía no asignó el siguiente a
  // mano — get_next_module_offer() no devuelve fila en ningún otro caso, así
  // que si el admin ya lo matriculó, esta tarjeta deja de salir sola.
  // Recuadro con el módulo bien visible (nivel + código + título) y el valor
  // de la mensualidad; se usa en la tarjeta y en la confirmación.
  function nextModuleSummary(offer) {
    return '<div class="next-mod">' +
      '<div class="next-mod__code">Módulo ' + esc(offer.next_module_level) + "</div>" +
      '<div class="next-mod__title">' + esc(offer.next_module_title) + "</div>" +
      '<div class="next-mod__price"><span>Mensualidad</span><strong>' + money(offer.suggested_amount, offer.suggested_currency) + "</strong></div>" +
      "</div>";
  }

  // Confirmación antes de matricular, por si le dieron al botón por error.
  function confirmEnrollNext(offer, onConfirm) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h(
      '<div class="pnl-modal">' +
      "<h3>¿Confirmas tu matrícula?</h3>" +
      '<p class="pnl-sub" style="margin-bottom:12px">Te vas a matricular en:</p>' +
      nextModuleSummary(offer) +
      '<p class="pnl-sub" style="margin:14px 0 4px">Se generará tu cobro en <strong>Facturación</strong>. El curso se activa en cuanto registres tu pago.</p>' +
      '<div class="row"><button class="btn btn-ghost" data-x>Cancelar</button>' +
      '<button class="btn btn-blue" data-ok>Sí, matricularme</button></div>' +
      "</div>"
    );
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    box.querySelector("[data-x]").addEventListener("click", close);
    box.querySelector("[data-ok]").addEventListener("click", function () { close(); onConfirm(); });
  }

  function renderNextModuleOffer(main, offer) {
    var box = h(
      '<div class="course-hero">' +
      '<div class="lvl-tag">Tu siguiente módulo</div>' +
      "<h2>Nivel " + esc(levelOf(offer.next_module_level)) + "</h2>" +
      nextModuleSummary(offer) +
      '<div class="course-hero__pay">' +
      '<p class="course-hero__pay-lead">Ya completaste tu módulo anterior. Matricúlate en el <strong>módulo ' + esc(offer.next_module_level) +
      "</strong> para continuar — se genera tu mensualidad para que la pagues desde Facturación.</p>" +
      '<button class="btn btn-blue" data-enroll-next>Matricularme en el módulo ' + esc(offer.next_module_level) + "</button>" +
      "</div>" +
      '<p class="muted" data-enroll-msg style="font-size:12.5px;margin-top:10px"></p>' +
      "</div>"
    );
    main.appendChild(box);

    var btn = box.querySelector("[data-enroll-next]");
    var msg = box.querySelector("[data-enroll-msg]");
    btn.addEventListener("click", function () { confirmEnrollNext(offer, doEnroll); });
    function doEnroll() {
      btn.disabled = true;
      msg.textContent = "Matriculando…";
      sb.rpc("self_enroll_next_module").then(function (r) {
        if (r.error) throw r.error;
        // Vuelve a pintar "Mi curso" en el sitio: la sugerencia desaparece y
        // queda la tarjeta normal del módulo nuevo, sin recargar la página.
        renderCourse(main, { justEnrolled: offer.next_module_level });
      }).catch(function (e) {
        btn.disabled = false;
        var m = (e && e.message) || String(e);
        msg.textContent = /LEF_COURSE_NOT_DONE/.test(m) ? "Ya tienes un módulo en curso o pendiente de pago — recarga la página."
          : /LEF_NO_NEXT_MODULE/.test(m) ? "No hay un módulo siguiente disponible por ahora. Escríbenos por WhatsApp."
          : "No pudimos matricularte: " + m;
      });
    }
  }

  // opts.justEnrolled: código del módulo recién matriculado desde la sugerencia,
  // para mostrar el aviso de "¡Listo!" una sola vez encima de la tarjeta nueva.
  /* ---------- Calendario (solo lectura) ---------- */
  // Mismo calendario del panel (lef-calendar.js), sin editar: las clases de su
  // grupo (salen solas de su matrícula), lo que su profesor programe para el
  // grupo y lo que LEF publique para los estudiantes.
  function renderCalendar(main) {
    main.innerHTML = '<h1 class="pnl-h">Calendario</h1>' +
      '<p class="pnl-sub">Tus clases y lo que tu profesor y LEF programen para ti.</p>';
    var box = h("<div></div>");
    main.appendChild(box);
    window.LEFCalendar.mount(box, { sb: sb, role: "student", onExam: function () { go("clase-hoy"); } });
  }

  function renderCourse(main, opts) {
    opts = opts || {};
    // Primero cierra los ciclos vencidos (lo hace también el cron nocturno) para
    // que "Mi curso" nunca muestre un módulo corriendo en un ciclo que ya terminó.
    sb.rpc("close_ended_cycles").then(function () {}, function () {}).then(function () {
      return sb.rpc("get_my_course");
    }).then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      main.innerHTML = '<h1 class="pnl-h">Mi curso</h1><p class="pnl-sub">El nivel y el módulo en el que estás inscrito actualmente.</p>';
      if (opts.justEnrolled) {
        main.appendChild(h('<div class="pnl-alert ok">¡Listo! Quedaste matriculado en el <strong>módulo ' + esc(opts.justEnrolled) +
          "</strong>. Ya se generó tu mensualidad en Facturación.</div>"));
      }

      if (!rows.length) {
        main.appendChild(h('<div class="pnl-alert ok">Aún no tienes un módulo asignado. Escríbenos por WhatsApp si crees que esto es un error.</div>'));
        return;
      }

      var current = rows.filter(function (c) { return !isCourseDone(c); });
      var done = rows.filter(isCourseDone);

      current.forEach(function (c) { renderCourseHero(main, c); });
      var withGroup = current.filter(function (c) { return c.schedule_days && c.schedule_days.length; })[0];
      if (withGroup) renderMyClassCard(main, withGroup);

      var offerPromise = current.length
        ? Promise.resolve(null)
        : sb.rpc("get_next_module_offer").then(function (r2) { return (r2.data && r2.data[0]) || null; })
          .catch(function () { return null; });

      offerPromise.then(function (offer) {
        if (!current.length) {
          if (offer) renderNextModuleOffer(main, offer);
          else main.appendChild(h('<div class="pnl-alert ok">Ya completaste tu módulo actual — LEF te asignará el siguiente en breve.</div>'));
        }
        done.forEach(function (c) { renderCourseCompact(main, c); });
      });
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu curso: ' + esc(e.message) + "</div>";
    });
  }

  /* ---------- Mi clase en Google Classroom + "Clase de hoy" ---------- */
  // Pedido del usuario (24 sep 2026): desde Mi curso el estudiante abre "Clase de hoy"
  // (desde el 26 sep sin botón ni código para unirse a Classroom),
  // donde ve la agenda que el profesor publicó hoy (en Classroom las agendas
  // "DAY n" están en borrador y el profesor publica la del día). Todo sale de
  // la función student-classroom, que lee Classroom con la conexión del
  // profesor y SOLO lo publicado. Requiere la mensualidad pagada.
  function classFn(action) {
    // Token fresco en cada llamada (la sesión se renueva sola cada hora).
    return sb.auth.getSession().then(function (r) {
      var tok = (r.data && r.data.session) ? r.data.session.access_token : TOKEN;
      return fetch(window.LEF_SUPABASE.url + "/functions/v1/student-classroom", {
        method: "POST",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ action: action })
      }).then(function (res) {
        return res.json().then(function (j) {
          if (!res.ok && !j.status) throw new Error(j.error || "Error");
          return j;
        });
      });
    });
  }

  var MC_ICONS = {
    board: '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/><circle cx="12" cy="10" r="2.5"/><path d="M7.5 15.5c.8-1.6 2.5-2.5 4.5-2.5s3.7.9 4.5 2.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calx: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m14 14-4 4m0-4 4 4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/>',
    video: '<path d="m23 7-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    books: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h5"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    abc: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    grammar: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="m16 16 2 2 4-4"/>',
    headph: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    read: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'
  };
  // Logo de Google Meet (el de Classroom) para el recuadro de la reunión.
  var MEET_LOGO = '<svg class="meet-card__logo" viewBox="0 0 87.5 72" aria-hidden="true">' +
    '<path fill="#00832d" d="M49.5 36l8.53 9.75 11.47 7.33 2-17.02-2-16.64-11.69 6.44z"/>' +
    '<path fill="#0066da" d="M0 51.5V66c0 3.315 2.685 6 6 6h14.5l3-10.96-3-9.54-9.95-3z"/>' +
    '<path fill="#e94235" d="M20.5 0L0 20.5l10.55 3 9.95-3 2.95-9.41z"/>' +
    '<path fill="#2684fc" d="M20.5 20.5H0v31h20.5z"/>' +
    '<path fill="#00ac47" d="M82.6 8.68L69.5 19.42v33.66l13.16 10.79c1.97 1.54 4.85.135 4.85-2.37V11c0-2.535-2.945-3.925-4.91-2.32zM49.5 36v15.5h-29V72h43c3.315 0 6-2.685 6-6V53.08z"/>' +
    '<path fill="#ffba00" d="M63.5 0h-43v20.5h29V36l20-16.57V6c0-3.315-2.685-6-6-6z"/></svg>';
  function mcIc(name) {
    return '<svg class="mc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (MC_ICONS[name] || "") + "</svg>";
  }

  var CLASS_MSG = {
    sin_pago: ["lock", "Tu clase se activa con el pago", "La agenda diaria y la reunión de tu clase se activan cuando pagues tu mensualidad."],
    profesor_sin_conexion: ["alert", "Tu profesor aún no ha conectado Classroom", "Tu agenda aparecerá aquí en cuanto lo conecte."],
    sin_clase_classroom: ["alert", "Tu clase aún no está en Classroom", "Tu profesor todavía no ha creado la clase de tu nivel. Tu agenda aparecerá aquí apenas la cree."],
    sin_grupo: ["clock", "Aún no tienes grupo asignado", "Cuando LEF te asigne un grupo, aquí aparecerá tu clase."],
    error: ["alert", "No pudimos consultar Classroom", "Intenta de nuevo en unos minutos."]
  };

  // Tarjeta de Mi curso: solo los datos del grupo y el acceso a "Clase de hoy".
  // Ya no invita a unirse a Classroom (26 sep 2026): la agenda y el Meet se ven
  // desde la plataforma sin estar inscrito en la clase.
  function renderMyClassCard(main, c) {
    var card = h('<div class="myclass">' +
      '<div class="myclass__head"><span class="myclass__ic">' + mcIc("board") + "</span>" +
      '<div style="min-width:0"><p class="myclass__k">Tu clase</p>' +
      '<h3 class="myclass__t">' + esc(c.module_level + " — " + c.module_title) + "</h3>" +
      '<p class="myclass__m">' + esc([c.teacher_full_name, fmtDays(c.schedule_days), fmtTime(c.schedule_start_time)].filter(Boolean).join(" · ")) + "</p></div></div>" +
      '<p class="myclass__hint">' + (c.module_paid
        ? "La agenda y el botón de la reunión se activan 10 minutos antes de tu clase en <strong>Clase de hoy</strong>."
        : esc(CLASS_MSG.sin_pago[2])) + "</p>" +
      '<div class="myclass__acts">' +
      '<button type="button" class="btn btn-dark" data-today>' + mcIc("sun") + "<span>Clase de hoy</span></button></div></div>");
    card.querySelector("[data-today]").addEventListener("click", function () { go("clase-hoy"); });
    main.appendChild(card);
  }

  // Adjuntos embebidos (misma lógica que el Planificador del profesor).
  function mcLinkCard(att) {
    var host = "";
    try { host = new URL(att.url).hostname.replace(/^www\./, ""); } catch (e) { host = ""; }
    return '<div class="cls-linkcard"><div style="min-width:0"><p class="cls-linkcard__title">' + esc(att.title || host || "Enlace") + "</p>" +
      '<p class="muted" style="font-size:12.5px">' + esc(host) + " se abre en una pestaña aparte.</p></div>" +
      '<a href="' + esc(att.url) + '" target="_blank" rel="noopener" class="btn btn-blue btn-sm">Abrir ↗</a></div>';
  }
  function mcAttachment(att) {
    // Drive: el archivo lo abre Google con la sesión de Google del NAVEGADOR del
    // estudiante (debe haberse unido a la clase con ese correo; Classroom lo
    // comparte con la clase al publicar). En iPhone/Safari el visor dentro de
    // LEF no recibe esa sesión: por eso el botón "Abrir en Google Drive" va
    // visible arriba (abre la app o una pestaña, donde sí funciona).
    if (att.type === "drive") {
      var open = att.alternateLink || ("https://drive.google.com/file/d/" + encodeURIComponent(att.id) + "/view");
      return '<div class="drive-att">' +
        '<div class="drive-att__bar"><span class="drive-att__name">' + mcIc("book") + "<span>" + esc(att.title || "Archivo de Google Drive") + "</span></span>" +
        '<a href="' + esc(open) + '" target="_blank" rel="noopener" class="btn btn-blue btn-sm">' + mcIc("ext") + "<span>Abrir en Google Drive</span></a></div>" +
        '<div class="cls-embed"><iframe src="https://drive.google.com/file/d/' + esc(att.id) + '/preview" allow="autoplay" loading="lazy"></iframe></div>' +
        '<p class="drive-att__note">¿Dice que no tienes acceso? Entra a Google con el mismo correo con el que te uniste a tu clase. ' +
        "En iPhone, usa “Abrir en Google Drive”.</p></div>";
    }
    if (att.type === "youtube") {
      return '<div class="cls-embed cls-embed--16-9"><iframe src="https://www.youtube.com/embed/' + esc(att.id) + '" allowfullscreen loading="lazy"></iframe></div>';
    }
    if ((att.type === "link" || att.type === "form") && att.url) {
      if (att.embeddable === false) return mcLinkCard(att);
      return '<div class="cls-embed"><iframe src="' + esc(att.embedUrl || att.url) + '" loading="lazy" allowfullscreen></iframe></div>' +
        '<a href="' + esc(att.url) + '" target="_blank" rel="noopener" class="cls-fallback">¿No carga? Abrir en una pestaña nueva ↗</a>';
    }
    return "";
  }
  // Sin enlaces a Classroom (pedido del usuario, 26 sep 2026): la agenda se
  // ve completa aquí y nada invita al estudiante a irse a otra plataforma.
  function mcPost(m) {
    var html = (m.attachments || []).map(mcAttachment).join("");
    var desc = m.description ? '<p class="agenda__desc">' + esc(m.description) + "</p>" : "";
    return desc + html || '<p class="muted" style="font-size:13.5px">Esta agenda no tiene contenido adicional.</p>';
  }

  // "Clase de hoy" por horario (pedido del usuario, 24–25 sep 2026): la clase
  // n.º N del ciclo (solo días del horario) muestra la agenda DAY N. Agenda y
  // botón de Meet se abren 10 min antes de la hora de la clase; el Meet se
  // quita a la hora de fin y la agenda sigue hasta medianoche (luego pasa a
  // "Clases anteriores"). Un día "Sin clase" muestra el motivo. La
  // función student-classroom decide y NO entrega agenda ni Meet fuera de hora;
  // aquí solo se pinta y se vuelve a consultar sola cuando cambia el estado.
  // Diseño tipo Classroom (pedido del usuario, 25 sep 2026): barra superior
  // con el módulo; a la izquierda el recuadro de Meet (botón amarillo cuando
  // la reunión está abierta, gris y deshabilitado cuando no) y el recuadro
  // "Clases anteriores" (abre la lista como una carpeta); al centro, la agenda.
  var todayTimers = [];
  function clearTodayTimers() { todayTimers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); todayTimers = []; }
  function hmToMin(s) { var p = String(s || "0:0").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function t12(s) { return fmtTime(String(s || "").slice(0, 5)); }
  function longYmd(ymd) {
    return new Date(ymd + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  }
  function inLabel(min) {
    if (min <= 0) return "en un momento";
    if (min < 60) return "en " + min + " min";
    var h2 = Math.floor(min / 60), m2 = min % 60;
    return "en " + h2 + " h" + (m2 ? " " + m2 + " min" : "");
  }

  function renderClassToday(main) {
    clearTodayTimers();
    main.innerHTML = "";
    var back = h('<button type="button" class="resource-back">&larr; Mi curso</button>');
    back.addEventListener("click", function () { clearTodayTimers(); go("curso"); });
    main.appendChild(back);
    var box = h('<div class="today"><div class="today-hero is-loading"><div class="today-hero__date"><span class="today-hero__k">Clase de hoy</span>' +
      '<span class="today-hero__num">' + new Date().getDate() + "</span></div>" +
      '<div class="today-hero__info"><p class="today-hero__mod">Buscando tu clase de hoy…</p></div></div></div>');
    main.appendChild(box);
    // Examen de validación abierto (lo programa el profesor): sale arriba, haya o no clase hoy.
    var examsP = sb.rpc("get_my_pending_exams").then(function (r) { return r.error ? [] : r.data || []; }, function () { return []; });

    classFn("today").then(function (d) {
      if (location.hash.slice(1) !== "clase-hoy") return;
      box.innerHTML = "";
      var g = d.group || {}, todayD = d.today ? new Date(d.today + "T12:00:00") : new Date();
      // Reloj del servidor (hora de Colombia) contra el del navegador, para las cuentas regresivas.
      var serverNow = hmToMin(d.now), clientAt = Date.now();
      function nowMin() { return serverNow + Math.floor((Date.now() - clientAt) / 60000); }
      var slots = d.slots || [];
      var cur = slots.filter(function (s) { return s.phase !== "terminada"; })[0] || slots[slots.length - 1] || null;

      var state = "off", pill = "";
      if (d.status !== "ok") { state = "off"; pill = ""; }
      else if (d.before_cycle) { state = "off"; pill = "Tu ciclo aún no empieza"; }
      else if (d.cancel && !cur) { state = "off"; pill = d.cancel.holiday ? "Hoy es festivo" : "Hoy no hay clase"; }
      else if (cur) {
        var started = nowMin() >= hmToMin(cur.start);
        state = cur.phase === "en_curso" ? (started ? "live" : "ok") : cur.phase === "antes" ? "wait" : "off";
        pill = cur.phase === "en_curso" ? (started ? "Clase en curso" : "Tu clase está por empezar") : cur.phase === "antes" ? "Hoy tienes clase" : "Clase terminada";
      } else { pill = "Hoy no tienes clase"; }
      var timeTxt = cur ? t12(cur.start) + " – " + t12(cur.end) : (g.start_time ? fmtTime(g.start_time) + (g.end_time ? " – " + fmtTime(g.end_time) : "") : "");
      box.appendChild(h('<div class="today-hero">' +
        '<div class="today-hero__date"><span class="today-hero__k">Clase de hoy</span>' +
        '<span class="today-hero__num">' + todayD.getDate() + "</span>" +
        '<span class="today-hero__dm">' + esc(todayD.toLocaleDateString("es-CO", { weekday: "long" })) + " · " + esc(todayD.toLocaleDateString("es-CO", { month: "long" })) + "</span></div>" +
        '<div class="today-hero__info">' +
        (g.module_level ? '<span class="today-hero__k">Tu módulo</span><p class="today-hero__mod">' + esc(g.module_level + " — " + g.module_title) + "</p>" : "") +
        ((timeTxt || g.teacher) ? '<div class="today-hero__chips">' +
          (timeTxt ? '<span class="today-hero__chip">' + mcIc("clock") + "<span>" + esc(timeTxt) + "</span></span>" : "") +
          (g.teacher ? '<span class="today-hero__chip">' + mcIc("user") + "<span>Profesor: " + esc(g.teacher) + "</span></span>" : "") +
          "</div>" : "") +
        (pill ? '<span class="today-pill is-' + state + '"><i></i>' + esc(pill) + "</span>" : "") +
        "</div></div>"));
      var examSlot = h('<div class="exam-slot"></div>');
      box.appendChild(examSlot);
      examsP.then(function (list) { if (location.hash.slice(1) === "clase-hoy") examBanners(examSlot, list, main); });

      function empty(icon, title, text, cls) {
        return h('<div class="today-empty' + (cls ? " " + cls : "") + '"><span class="today-empty__ic">' + mcIc(icon) + "</span><h2>" + esc(title) + "</h2><p>" + text + "</p></div>");
      }

      if (d.status !== "ok") {
        var m = CLASS_MSG[d.status] || CLASS_MSG.error;
        var st = empty(m[0], m[1], esc(m[2]));
        if (d.status === "sin_pago") {
          var fb = h('<button type="button" class="btn btn-blue">Ir a Facturación</button>');
          fb.addEventListener("click", function () { go("facturacion"); });
          st.appendChild(fb);
        }
        box.appendChild(st);
        return;
      }

      // Cuadrícula tipo Classroom: Meet y Clases anteriores a la izquierda,
      // la agenda del día al centro (en celular: Meet, agenda, anteriores).
      var grid = h('<div class="today-grid"></div>');
      var col = h('<div class="today-main"></div>');
      grid.appendChild(meetCard());
      grid.appendChild(col);
      grid.appendChild(prevCard());
      box.appendChild(grid);

      // El botón se ve siempre: amarillo y activo solo mientras la reunión
      // está abierta (10 min antes hasta la hora de fin, con enlace); el
      // resto del tiempo, gris y sin poder tocarse, con el motivo debajo.
      function meetCard() {
        var on = !!(cur && cur.phase === "en_curso" && cur.meet_url), note;
        if (on) note = nowMin() < hmToMin(cur.start) ? "Tu clase empieza a las " + t12(cur.start) : "Clase en curso · termina a las " + t12(cur.end);
        else if (d.before_cycle) note = "Se activará el día de tu primera clase.";
        else if (!cur) note = "Hoy no hay reunión: no tienes clase.";
        else if (cur.phase === "antes") note = "Se activa a las " + t12(cur.opens_at) + ", 10 minutos antes de tu clase.";
        else if (cur.phase === "en_curso") note = "Tu profesor aún no ha configurado el enlace de la reunión. Escríbele o espera un momento.";
        else note = "La reunión terminó a las " + t12(cur.end);
        return h('<section class="meet-card' + (on ? " is-on" : "") + '">' +
          '<div class="meet-card__head">' + MEET_LOGO + "<span>Meet</span></div>" +
          (on ? '<a class="meet-card__btn" href="' + esc(cur.meet_url) + '" target="_blank" rel="noopener">Unirse</a>'
              : '<button type="button" class="meet-card__btn" disabled>Unirse</button>') +
          '<p class="meet-card__note">' + esc(note) + "</p></section>");
      }

      function prevCard() {
        var n = 0;
        (d.previous || []).forEach(function (p) { n += (p.agendas || []).length; });
        var card = h('<section class="prev-card"><h3>Clases anteriores</h3>' +
          "<p>" + (n ? "Repasa las agendas de las clases que ya tuviste, de la más reciente a la más antigua."
                     : "Aquí irán quedando las agendas de las clases que ya tuviste, para que las repases cuando quieras.") + "</p>" +
          '<button type="button" class="prev-card__all"' + (n ? "" : " disabled") + ">Ver todo" + (n ? " (" + n + ")" : "") + "</button></section>");
        card.querySelector("button").addEventListener("click", function () { renderPastClasses(main, d.previous || []); });
        return card;
      }

      // fmtTime ya termina en "p.m.": no se le agrega otro punto.
      var dot = g.start_time ? "" : ".";
      var nextTxt = d.next_class ? "<strong>" + esc(longYmd(d.next_class)) + (g.start_time ? " a las " + esc(fmtTime(g.start_time)) : "") + "</strong>" : "";
      if (d.before_cycle) {
        var bc = empty("calx", "Tu ciclo aún no empieza",
          (nextTxt ? "Tu primera clase es el " + nextTxt + dot : "Pronto empezarán tus clases.") +
          " Mientras tanto, puedes ir revisando el libro de tu módulo en Mis recursos.");
        var rb = h('<button type="button" class="btn btn-dark">' + mcIc("book") + "<span>Ir a Mis recursos</span></button>");
        rb.addEventListener("click", function () { go("recursos"); });
        bc.appendChild(rb);
        col.appendChild(bc);
      } else if (d.cancel && !cur) {
        col.appendChild(h('<div class="today-empty is-cancel"><span class="today-empty__ic">' + mcIc("calx") + "</span><h2>" + (d.cancel.holiday ? "Hoy es festivo: no hay clase" : "Hoy no hay clase") + "</h2>" +
          '<div class="today-reason"><span>Motivo</span><strong>' + esc(d.cancel.reason) + "</strong>" + (d.cancel.details ? "<p>" + esc(d.cancel.details) + "</p>" : "") + "</div>" +
          "<p>Tu profesor se pondrá en contacto contigo para acordar cuándo recuperarán esta clase; la nueva fecha aparecerá en tu calendario." +
          (nextTxt ? " Tu próxima clase es el " + nextTxt + dot : "") + "</p></div>"));
      } else if (!cur) {
        col.appendChild(empty("calx", "Hoy no tienes clase",
          (nextTxt ? "Tu próxima clase es el " + nextTxt + dot : "Revisa tu horario en Mi curso.") +
          ((d.previous || []).length ? " Mientras tanto, puedes repasar lo visto en Clases anteriores." : "")));
      } else {
        slots.forEach(function (s) { col.appendChild(slotBlock(s)); });
      }

      function slotBlock(s) {
        var wrap = h('<div class="today-slot"></div>');
        var label = s.kind === "reposicion" ? "Reposición · clase DAY " + s.day : "Clase n.º " + s.day + " · agenda DAY " + s.day;
        if (s.phase === "antes") {
          var w = h('<div class="today-empty is-wait"><span class="today-empty__ic">' + mcIc("clock") + "</span>" +
            "<h2>" + (s.kind === "reposicion" ? "Hoy tienes la reposición de tu clase" : "Hoy tienes clase") + "</h2>" +
            "<p>Tu agenda y el botón para unirte a la reunión se habilitan a las <strong>" + esc(t12(s.opens_at)) + "</strong>, 10 minutos antes de tu clase" +
            ' <span class="today-count" data-count></span>.</p><span class="today-tag">' + esc(label) + "</span></div>");
          var cnt = w.querySelector("[data-count]");
          var paint = function () { cnt.textContent = "(" + inLabel(hmToMin(s.opens_at) - nowMin()) + ")"; };
          paint(); todayTimers.push(setInterval(paint, 30000));
          wrap.appendChild(w);
          return wrap;
        }
        // En curso (desde 10 min antes) o terminada: la agenda del día sigue
        // visible hasta medianoche; el botón de la reunión (recuadro de Meet)
        // solo se activa en curso.
        if (!s.agenda.length) {
          wrap.appendChild(empty("alert", "La agenda DAY " + s.day + " aún no está publicada", "Tu profesor la tendrá lista en breve. Vuelve a revisar en unos minutos."));
        }
        s.agenda.forEach(function (a) {
          wrap.appendChild(h('<article class="agenda">' +
            '<header class="agenda__head"><span class="agenda__day"><small>Day</small>' + esc(String(s.day)) + "</span>" +
            '<div class="agenda__titles"><h2>' + esc(a.title || "Agenda de hoy") + "</h2><p>" + esc(label) + "</p></div>" +
            "</header>" +
            '<div class="agenda__body">' + mcPost(a) + "</div></article>"));
        });
        if (s.phase === "terminada") {
          wrap.appendChild(h('<p class="today-note">' + mcIc("clock") + "<span>La clase terminó a las " + esc(t12(s.end)) +
            " Esta agenda sigue aquí hasta el final del día; desde mañana la encontrarás en <strong>Clases anteriores</strong>.</span></p>"));
        }
        return wrap;
      }

      // Se vuelve a consultar sola cuando se abre la agenda, empieza o termina la clase.
      if (d.refresh_in != null) {
        todayTimers.push(setTimeout(function () {
          if (location.hash.slice(1) === "clase-hoy") renderClassToday(main);
        }, (d.refresh_in + 5) * 1000));
      }
    }).catch(function () {
      box.innerHTML = "";
      box.appendChild(h('<div class="today-empty"><span class="today-empty__ic">' + mcIc("alert") + "</span><h2>" + esc(CLASS_MSG.error[1]) +
        "</h2><p>" + esc(CLASS_MSG.error[2]) + "</p></div>"));
    });
  }

  // "Clases anteriores" como una carpeta dentro de Clase de hoy: la lista de
  // agendas ya vistas (la más reciente primero), en acordeón como las ve el
  // profesor en el Planificador, cada una con la fecha de la clase encima.
  /* ---------- Examen de validación (27 sep 2026) ----------
     El profesor lo programa para el grupo con una franja de días; mientras está
     abierta sale en Clase de hoy. Se presenta UNA vez, por secciones (como el
     Google Form de antes). La nota la calcula la base de datos: aquí nunca llega
     la clave. Al enviar solo se ve "Enviado"; el resultado llega después al
     Inicio, cuando el profesor da el OK. Las respuestas a medias se guardan en
     este navegador por si se cierra la página. */
  function examErr(e) { var m = (e && e.message) || String(e); var x = m.match(/^LEF_[A-Z_]+:\s*([\s\S]+)$/); return x ? x[1] : m; }
  function examDraftKey(id) { return "lef-exam-" + id; }
  function examDraft(id) { try { return JSON.parse(localStorage.getItem(examDraftKey(id)) || "null"); } catch (e) { return null; } }
  function examSaveDraft(id, d) { try { localStorage.setItem(examDraftKey(id), JSON.stringify(d)); } catch (e) { /* sin almacenamiento */ } }
  function examDropDraft(id) { try { localStorage.removeItem(examDraftKey(id)); } catch (e) { /* nada */ } }

  function examBanners(slot, list, main) {
    list.forEach(function (x) {
      var draft = examDraft(x.assignment_id);
      var b = h('<section class="exam-banner"><span class="exam-banner__ic">' + mcIc("pencil") + "</span>" +
        '<div class="exam-banner__txt"><span class="exam-banner__k">Examen de validación · ' + esc(x.module_level) + "</span>" +
        "<h2>" + esc(x.exam_title) + "</h2>" +
        "<p>Disponible hasta el <strong>" + esc(longYmd(x.closes_on)) + "</strong>. Tienes un solo intento: cuando lo envíes ya no podrás cambiar tus respuestas.</p></div>" +
        '<button type="button" class="btn btn-blue">' + (draft ? "Continuar examen" : "Presentar examen") + "</button></section>");
      b.querySelector("button").addEventListener("click", function () { renderExam(main, x.assignment_id); });
      slot.appendChild(b);
    });
  }

  // Orden de opciones mezclado pero fijo para este estudiante y este examen
  // (si recarga la página, las opciones no cambian de lugar).
  function examShuffle(arr, seedTxt) {
    var s = 0;
    for (var i = 0; i < seedTxt.length; i++) s = (Math.imul(31, s) + seedTxt.charCodeAt(i)) | 0;
    function rnd() { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    var a = arr.slice();
    for (var j = a.length - 1; j > 0; j--) { var k = Math.floor(rnd() * (j + 1)); var tmp = a[j]; a[j] = a[k]; a[k] = tmp; }
    return a;
  }

  function renderExam(main, assignmentId) {
    clearTodayTimers();
    main.innerHTML = "";
    window.scrollTo(0, 0);
    var back = h('<button type="button" class="resource-back">&larr; Clase de hoy</button>');
    back.addEventListener("click", function () { renderClassToday(main); });
    main.appendChild(back);
    var box = h('<div class="exm"><p class="muted">Cargando tu examen…</p></div>');
    main.appendChild(box);

    sb.rpc("get_my_exam", { p_assignment: assignmentId }).then(function (r) {
      if (r.error) throw r.error;
      var x = r.data, secs = (x.sections || []).filter(function (s) { return (s.items || []).some(function (it) { return it.type === "choice" || it.type === "text"; }); });
      var draft = examDraft(assignmentId) || {};
      var answers = draft.answers || {}, cur = Math.min(draft.section || 0, secs.length - 1);
      var totalQ = 0;
      secs.forEach(function (s) { s.items.forEach(function (it) { if (it.type === "choice" || it.type === "text") totalQ++; }); });
      function save() { examSaveDraft(assignmentId, { answers: answers, section: cur }); }
      function has(id) { var v = answers[id]; return v != null && String(v).trim() !== ""; }
      function answered() { return Object.keys(answers).filter(has).length; }

      box.innerHTML = "";
      box.appendChild(h('<header class="exm-head"><span class="exm-head__k">Examen de validación · ' + esc(x.module_level) + "</span>" +
        "<h1>" + esc(x.title) + "</h1>" + (x.intro ? "<p>" + esc(x.intro) + "</p>" : "") +
        '<div class="exm-chips"><span>' + mcIc("check") + totalQ + " preguntas</span><span>" + mcIc("cal") + "Hasta el " + esc(longYmd(x.closes_on)) + "</span>" +
        "<span>" + mcIc("lock") + "Un solo intento</span></div></header>"));
      var prog = h('<div class="exm-prog"><div class="exm-prog__top"><span data-sec></span><span data-cnt></span></div><div class="ex-bar"><i></i></div></div>');
      box.appendChild(prog);
      var stage = h("<div></div>");
      box.appendChild(stage);

      function paintProgress() {
        prog.querySelector("[data-sec]").textContent = "Sección " + (cur + 1) + " de " + secs.length + " · " + secs[cur].title;
        prog.querySelector("[data-cnt]").textContent = answered() + " de " + totalQ + " respondidas";
        prog.querySelector("i").style.width = Math.round(100 * answered() / totalQ) + "%";
      }

      function paint() {
        var s = secs[cur];
        stage.innerHTML = "";
        var sec = h('<section class="exm-sec"><h2>' + esc(s.title) + "</h2>" +
          (s.instructions ? '<p class="exm-sec__ins">' + esc(s.instructions) + "</p>" : "") +
          (s.passage ? '<div class="ex-passage">' + esc(s.passage) + "</div>" : "") +
          (s.youtube ? '<div class="ex-video"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(s.youtube) + '?rel=0" title="Audio del examen" allow="encrypted-media" allowfullscreen></iframe></div>' : "") +
          "</section>");
        stage.appendChild(sec);
        s.items.forEach(function (it) {
          if (it.type === "heading") { stage.appendChild(h('<p class="exm-note">' + esc(it.text) + "</p>")); return; }
          if (it.type === "text") {
            // Pregunta abierta: la escribe el estudiante y la califica el profesor.
            var tq = h('<fieldset class="exm-q" data-q="' + esc(it.id) + '"><legend>' + esc(it.text) + "</legend>" +
              '<textarea class="exm-text" rows="4" maxlength="4000" placeholder="Escribe tu respuesta aquí"></textarea>' +
              '<p class="exm-text__note">Esta respuesta la califica tu profesor.</p></fieldset>');
            var ta = tq.querySelector("textarea");
            ta.value = answers[it.id] || "";
            ta.addEventListener("input", function () {
              if (ta.value.trim()) answers[it.id] = ta.value; else delete answers[it.id];
              save(); paintProgress(); tq.classList.remove("is-missing");
            });
            stage.appendChild(tq);
            return;
          }
          if (it.type !== "choice") return;
          var idx = it.options.map(function (_, i) { return i; });
          if (it.shuffle) idx = examShuffle(idx, assignmentId + it.id);
          var q = h('<fieldset class="exm-q" data-q="' + esc(it.id) + '"><legend>' + esc(it.text) + "</legend></fieldset>");
          idx.forEach(function (i) {
            var opt = h('<label class="exm-opt"><input type="radio" name="' + esc(it.id) + '" value="' + i + '"><span>' + esc(it.options[i]) + "</span></label>");
            var inp = opt.querySelector("input");
            if (String(answers[it.id]) === String(i)) { inp.checked = true; opt.classList.add("is-sel"); }
            inp.addEventListener("change", function () {
              answers[it.id] = i; save(); paintProgress();
              q.classList.remove("is-missing");
              q.querySelectorAll(".exm-opt").forEach(function (o) { o.classList.toggle("is-sel", o.querySelector("input").checked); });
            });
            q.appendChild(opt);
          });
          stage.appendChild(q);
        });
        var nav = h('<div class="exm-nav"><p class="exm-nav__err" aria-live="polite"></p></div>');
        if (cur > 0) {
          var prev = h('<button type="button" class="btn btn-ghost">Atrás</button>');
          prev.addEventListener("click", function () { cur--; save(); paint(); window.scrollTo(0, 0); });
          nav.appendChild(prev);
        }
        var last = cur === secs.length - 1;
        var next = h('<button type="button" class="btn ' + (last ? "btn-blue" : "btn-dark") + '">' + (last ? "Enviar examen" : "Siguiente") + "</button>");
        next.addEventListener("click", function () {
          var missing = [].slice.call(stage.querySelectorAll(".exm-q")).filter(function (f) { return !has(f.getAttribute("data-q")); });
          missing.forEach(function (f) { f.classList.add("is-missing"); });
          if (missing.length) {
            nav.querySelector(".exm-nav__err").textContent = missing.length === 1 ? "Te falta responder 1 pregunta de esta sección." : "Te faltan " + missing.length + " preguntas de esta sección.";
            missing[0].scrollIntoView({ behavior: "smooth", block: "center" });
            return;
          }
          if (!last) { cur++; save(); paint(); window.scrollTo(0, 0); return; }
          confirmSend();
        });
        nav.appendChild(next);
        stage.appendChild(nav);
        paintProgress();
      }

      function confirmSend() {
        var bg = h('<div class="pnl-modal-bg"></div>');
        var m = h('<div class="pnl-modal"><h3>¿Enviar tu examen?</h3>' +
          '<p class="pnl-sub">Respondiste las ' + totalQ + " preguntas. Solo puedes enviarlo <strong>una vez</strong>: después no podrás cambiar tus respuestas.</p>" +
          '<p class="exm-nav__err" data-err></p>' +
          '<div class="row"><button type="button" class="btn btn-ghost" data-x>Revisar</button><button type="button" class="btn btn-blue" data-s>Enviar</button></div></div>');
        bg.appendChild(m);
        document.body.appendChild(bg);
        function close() { bg.remove(); }
        bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
        m.querySelector("[data-x]").addEventListener("click", close);
        var send = m.querySelector("[data-s]");
        send.addEventListener("click", function () {
          send.disabled = true; send.textContent = "Enviando…";
          sb.rpc("submit_my_exam", { p_assignment: assignmentId, p_answers: answers }).then(function (res) {
            if (res.error) throw res.error;
            examDropDraft(assignmentId);
            close();
            done();
          }).catch(function (e) {
            send.disabled = false; send.textContent = "Enviar";
            m.querySelector("[data-err]").textContent = examErr(e);
          });
        });
      }

      function done() {
        box.innerHTML = "";
        window.scrollTo(0, 0);
        var d = h('<div class="today-empty exm-done"><span class="today-empty__ic">' + mcIc("check") + "</span>" +
          "<h2>¡Examen enviado!</h2>" +
          "<p>Tu profesor lo va a revisar. Cuando esté listo te llegará un correo y verás tu resultado en tu <strong>Inicio</strong>.</p></div>");
        var b = h('<button type="button" class="btn btn-dark">Volver a Clase de hoy</button>');
        b.addEventListener("click", function () { renderClassToday(main); });
        d.appendChild(b);
        box.appendChild(d);
      }

      paint();
    }).catch(function (e) {
      box.innerHTML = "";
      var d = h('<div class="today-empty"><span class="today-empty__ic">' + mcIc("alert") + "</span><h2>No pudimos abrir el examen</h2><p>" + esc(examErr(e)) + "</p></div>");
      box.appendChild(d);
    });
  }

  // Examen corregido (desde la novedad del resultado → "Ver detalle"): sus
  // respuestas, la correcta cuando se equivocó, y "Descargar evaluación" en PDF
  // para que no se pierda cuando la novedad se quite al empezar otro módulo.
  function renderExamResult(main, submissionId) {
    clearTodayTimers();
    main.innerHTML = "";
    window.scrollTo(0, 0);
    var back = h('<button type="button" class="resource-back">&larr; Inicio</button>');
    back.addEventListener("click", function () { if (location.hash === "#inicio") renderHome(main); else go("inicio"); });
    main.appendChild(back);
    var box = h('<div class="exm"><p class="muted">Cargando tu evaluación…</p></div>');
    main.appendChild(box);
    sb.rpc("get_my_exam_result", { p_submission: submissionId }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data, num = window.LEFExam.num;
      var pct = d.max_score ? Math.round(100 * d.score / d.max_score) : 0;
      box.innerHTML = "";
      box.appendChild(h('<header class="exm-head"><span class="exm-head__k">Tu evaluación · ' + esc(d.module_level) + "</span>" +
        "<h1>" + esc(d.title) + "</h1>" +
        '<div class="exm-chips">' + (d.teacher_name ? "<span>" + mcIc("user") + "Revisó: " + esc(d.teacher_name) + "</span>" : "") +
        "<span>" + mcIc("cal") + "Presentado el " + esc(date(d.submitted_at)) + "</span></div>" +
        '<div class="ex-total" style="margin-top:14px"><div class="ex-total__n"><strong>' + num(d.score) + "</strong><span>/" + num(d.max_score) + " puntos</span></div>" +
        '<div class="ex-total__m"><span>' + pct + "% · " + d.correct_count + " de " + d.total_count + ' respuestas correctas</span><div class="ex-bar is-big"><i style="width:' + pct + '%"></i></div></div></div>' +
        (d.sections_result || []).map(function (s) {
          var p = s.max ? Math.round(100 * s.score / s.max) : 0;
          return '<div class="ex-sec"><div class="ex-sec__top"><strong>' + esc(s.title) + "</strong><span>" + s.correct + " de " + s.total + " correctas · " +
            num(s.score) + "/" + num(s.max) + ' pts</span></div><div class="ex-bar"><i style="width:' + p + '%"></i></div></div>';
        }).join("") +
        '<p class="exm-sec__ins" style="margin-top:10px">En verde, la respuesta correcta; en rojo, la que marcaste cuando te equivocaste.</p></header>'));
      box.appendChild(window.LEFExam.render(d.content, d.answers || {}, d.manual || {}, { who: "Tu respuesta" }));
      var foot = h('<div class="exm-nav"><p class="exm-nav__err" aria-live="polite"></p></div>');
      var dl = h('<button type="button" class="btn btn-blue">' + mcIc("file") + "<span>Descargar evaluación</span></button>");
      dl.addEventListener("click", function () {
        dl.disabled = true;
        foot.querySelector(".exm-nav__err").textContent = "";
        window.LEFExam.pdf({
          title: d.title, module: d.module_level, student: d.student_name, teacher: d.teacher_name, group: d.group_label,
          submitted: date(d.submitted_at), approved: d.approved_at ? date(d.approved_at) : "",
          score: d.score, max: d.max_score, correct: d.correct_count, total: d.total_count,
          sectionsResult: d.sections_result, content: d.content, answers: d.answers, manual: d.manual
        }).catch(function (e) { foot.querySelector(".exm-nav__err").textContent = examErr(e); })
          .then(function () { dl.disabled = false; });
      });
      foot.appendChild(dl);
      box.appendChild(foot);
    }).catch(function (e) {
      box.innerHTML = "";
      box.appendChild(h('<div class="today-empty"><span class="today-empty__ic">' + mcIc("alert") + "</span><h2>No pudimos abrir tu evaluación</h2><p>" + esc(examErr(e)) + "</p></div>"));
    });
  }

  function renderPastClasses(main, previous) {
    clearTodayTimers();
    main.innerHTML = "";
    var back = h('<button type="button" class="resource-back">&larr; Clase de hoy</button>');
    back.addEventListener("click", function () { renderClassToday(main); });
    main.appendChild(back);
    main.appendChild(h('<h1 class="pnl-h" style="margin-bottom:4px">Clases anteriores</h1>'));
    main.appendChild(h('<p class="past-intro">Las agendas de las clases que ya tuviste, de la más reciente a la más antigua. Toca una para abrirla.</p>'));
    var list = h('<div class="past-list"></div>');
    previous.forEach(function (p) {
      (p.agendas || []).forEach(function (a) {
        var when = p.seen_on ? longYmd(p.seen_on) : "";
        var item = h('<div class="past-item">' +
          '<p class="past-item__date">' + mcIc("cal") + "<span>" + (when ? "Clase del " + esc(when) : "Clase n.º " + esc(String(p.day))) + "</span></p></div>");
        var acc = h('<div class="cls-day"></div>');
        var row = h('<div class="resource-row" tabindex="0" role="button" aria-expanded="false">' +
          '<div style="min-width:0"><div style="font-weight:600">' + esc(a.title || ("Agenda DAY " + p.day)) + "</div>" +
          '<span style="font-size:12.5px;color:var(--grafito)">Clase n.º ' + esc(String(p.day)) + " · agenda DAY " + esc(String(p.day)) + "</span></div>" +
          '<span class="resource-row__chevron" aria-hidden="true">&rsaquo;</span></div>');
        var panel = h('<div class="cls-day__body" hidden></div>');
        var toggle = function () {
          var open = panel.hidden;
          panel.hidden = !open;
          row.setAttribute("aria-expanded", open ? "true" : "false");
          acc.classList.toggle("is-open", open);
          if (open && !panel.dataset.filled) { panel.dataset.filled = "1"; panel.innerHTML = '<div class="cls-post">' + mcPost(a) + "</div>"; }
        };
        row.addEventListener("click", toggle);
        row.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
        acc.appendChild(row); acc.appendChild(panel);
        item.appendChild(acc);
        list.appendChild(item);
      });
    });
    main.appendChild(list);
    window.scrollTo(0, 0);
  }

  /* ---------- Mis recursos ---------- */
  // Carpetas dentro de carpetas (pedido del usuario, 26 sep 2026), con la misma
  // mecánica del Planificador del profesor:
  //   Mis recursos → niveles (A1…C1)
  //   Nivel        → "Libros complementarios" + sus módulos
  //   Módulo       → Libro de estudio · Talleres · Ejercicios por habilidad
  // Solo salen los niveles y módulos que el estudiante cursa o ya cursó. Un
  // módulo sin pagar sale con candado y lleva a Facturación (la base de datos
  // tampoco entrega su libro). El libro complementario es de TODO el nivel y se
  // abre con cualquier módulo pagado de ese nivel (get_my_complementary_books;
  // varios libros con título, los carga el admin en Recursos compartidos). Todos
  // los niveles, A1 incluido (26 sep 2026).
  // Talleres y Ejercicios por habilidad los sube el admin en Recursos compartidos.
  var RS_LEVELS = ["A1", "A2", "B1", "B2", "C1"];
  var RS_BOOK_LEVELS = ["A1", "A2", "B1", "B2", "C1"];   // el A1 también desde el 26 sep (antes no)
  var RS_TALLERES = ["Taller semana 1", "Taller semana 2", "Taller semana 3", "Taller semana 4", "Repaso del módulo"];

  function rsModel(rows, books) {
    var byLevel = {};
    rows.forEach(function (c) {
      var code = String(c.module_level || "").split(".")[0];
      if (RS_LEVELS.indexOf(code) < 0) return;
      var L = byLevel[code] = byLevel[code] || { code: code, byMod: {} };
      // Si repitió el módulo, manda la inscripción pagada (vienen de la más reciente a la más antigua).
      var prev = L.byMod[c.module_level];
      if (!prev || (!prev.module_paid && c.module_paid)) L.byMod[c.module_level] = c;
    });
    var urls = {};
    (books || []).forEach(function (b) { (urls[b.level] = urls[b.level] || []).push({ title: b.title, url: b.url }); });
    var levels = RS_LEVELS.filter(function (k) { return byLevel[k]; }).map(function (k) {
      var L = byLevel[k];
      L.mods = Object.keys(L.byMod).sort(function (a, b) { return a.localeCompare(b, "es", { numeric: true }); })
        .map(function (m) { return L.byMod[m]; });
      L.open = L.mods.some(function (m) { return m.module_paid; });
      L.books = urls[k] || [];
      return L;
    });
    return { levels: levels };
  }

  // Ícono de nivel (26 sep 2026, diseño del usuario): globo de conversación con el
  // nivel adentro (A1, A2…) y destellos dorados. Solo en carpetas de nivel y módulo.
  function lvlIc(code) {
    return '<svg class="lvl-ic" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
      '<path d="M21 9.5c-8.6 0-15.5 6-15.5 13.4 0 3.6 1.6 6.9 4.3 9.3l-2.3 6.3 7-3.3c2 .7 4.2 1 6.5 1 8.6 0 15.5-6 15.5-13.3S29.6 9.5 21 9.5z" stroke="#1b2a5e" stroke-width="2.6" stroke-linejoin="round" fill="#fff"/>' +
      '<text x="21" y="27.4" text-anchor="middle" font-family="Jost,system-ui,sans-serif" font-weight="700" font-size="11.5" fill="#1b2a5e">' + esc(String(code).split(".")[0]) + "</text>" +
      '<path d="M37.5 5.5 36 9.5M42.5 10.5l-3.8 2M43.5 17.5h-4M41.5 30l-3-1.8M38 35.5l-1.6-3" stroke="#d9a52b" stroke-width="2.4" stroke-linecap="round"/></svg>';
  }

  // Tarjeta de carpeta: color e ícono según lo que contiene (o.badge = nivel/módulo).
  function rsCard(o) {
    var el = h('<button type="button" class="rs-card is-' + o.tone + (o.locked ? " is-locked" : "") + '">' +
      '<span class="rs-card__top"><span class="rs-card__ic">' + (o.badge ? lvlIc(o.badge) : mcIc(o.icon)) + "</span>" +
      '<span class="rs-card__go" aria-hidden="true">' + mcIc(o.locked ? "lock" : "arrow") + "</span></span>" +
      '<span class="rs-card__t">' + esc(o.title) + "</span>" +
      (o.sub ? '<span class="rs-card__s">' + esc(o.sub) + "</span>" : "") +
      (o.chip ? '<span class="rs-chip is-' + o.chip[0] + '">' + esc(o.chip[1]) + "</span>" : "") +
      "</button>");
    el.addEventListener("click", o.onOpen);
    return el;
  }

  // Página de una carpeta: ruta (Mis recursos › A1 › A1.1), título y contenido.
  // Barra fija arriba con "Atrás" (vuelve UNA carpeta) y la ruta completa
  // (pedido del usuario, 26 sep 2026: la ruta sola era difícil de usar).
  function rsPage(main, crumbs, title, sub) {
    main.innerHTML = "";
    window.scrollTo(0, 0);
    if (crumbs.length) {
      var bar = h('<div class="fold-bar"><button type="button" class="fold-back" aria-label="Atrás: volver a ' + esc(crumbs[crumbs.length - 1][0]) + '">' +
        mcIc("arrow") + "<span>Atrás</span></button></div>");
      bar.querySelector(".fold-back").addEventListener("click", crumbs[crumbs.length - 1][1]);
      var nav = h('<nav class="rs-crumbs" aria-label="Ruta"></nav>');
      crumbs.forEach(function (c) {
        var a = h('<button type="button" class="rs-crumbs__a">' + esc(c[0]) + "</button>");
        a.addEventListener("click", c[1]);
        nav.appendChild(a);
        nav.appendChild(h('<span class="rs-crumbs__sep" aria-hidden="true">›</span>'));
      });
      nav.appendChild(h('<span class="rs-crumbs__here">' + esc(title) + "</span>"));
      bar.appendChild(nav);
      main.appendChild(bar);
    }
    main.appendChild(h('<h1 class="pnl-h">' + esc(title) + "</h1>"));
    if (sub) main.appendChild(h('<p class="pnl-sub">' + esc(sub) + "</p>"));
    var body = h('<div class="rs-body"></div>');
    main.appendChild(body);
    return body;
  }

  function rsEmpty(title, text) {
    return h('<div class="today-empty"><span class="today-empty__ic">' + mcIc("folder") + "</span><h2>" + esc(title) + "</h2><p>" + esc(text) + "</p></div>");
  }

  function rsViewer(body, url, title) {
    if (!url) { body.appendChild(rsEmpty("Todavía no hay libro aquí", "LEF lo agregará pronto.")); return; }
    body.appendChild(h('<div class="resource-frame-wrap"><iframe src="' + esc(url) + '" allowfullscreen loading="lazy" title="' + esc(title) + '"></iframe></div>'));
  }

  function rsRoot(main, M) {
    var body = rsPage(main, [], "Mis recursos", "Material de estudio de los niveles y módulos que has tomado o estás tomando.");
    if (!M.levels.length) {
      body.appendChild(rsEmpty("Aún no tienes recursos", "Cuando empieces tu primer módulo, aquí verás su material."));
      return;
    }
    var grid = h('<div class="rs-grid"></div>');
    M.levels.forEach(function (L) {
      var n = L.mods.length;
      grid.appendChild(rsCard({ tone: "lvl", badge: L.code, title: "Nivel " + L.code,
        sub: n + (n === 1 ? " módulo" : " módulos") + " · " + L.mods.map(function (m) { return m.module_level; }).join(", "),
        onOpen: function () { rsLevel(main, M, L); } }));
    });
    body.appendChild(grid);
  }

  // Carpeta "Libros complementarios" DENTRO de cada nivel (junto a sus módulos;
  // corrección del usuario, 26 sep 2026). Todos los niveles, A1 incluido.
  function rsComp(main, M, L) {
    var crumbs = [["Mis recursos", function () { rsRoot(main, M); }], ["Nivel " + L.code, function () { rsLevel(main, M, L); }]];
    var body = rsPage(main, crumbs, "Libros complementarios", "Libros para todo el nivel " + L.code + ".");
    if (!L.books.length) { body.appendChild(rsEmpty("Todavía no hay libros aquí", "LEF los agregará pronto.")); return; }
    var grid = h('<div class="rs-grid"></div>');
    L.books.forEach(function (bk) {
      grid.appendChild(rsCard({ tone: "amber", icon: "books", title: bk.title, sub: "Para todo el nivel " + L.code,
        onOpen: function () {
          var b = rsPage(main, crumbs.concat([["Libros complementarios", function () { rsComp(main, M, L); }]]), bk.title);
          rsViewer(b, bk.url, bk.title);
        } }));
    });
    body.appendChild(grid);
  }

  function rsLevel(main, M, L) {
    var body = rsPage(main, [["Mis recursos", function () { rsRoot(main, M); }]], "Nivel " + L.code, RS_BOOK_LEVELS.indexOf(L.code) >= 0 ? "Elige un módulo o los libros complementarios del nivel." : "Elige un módulo.");
    var grid = h('<div class="rs-grid"></div>');
    if (RS_BOOK_LEVELS.indexOf(L.code) >= 0) {
      grid.appendChild(rsCard({ tone: "amber", icon: "books", title: "Libros complementarios", locked: !L.open,
        sub: L.open ? "Para todo el nivel " + L.code : "Se abre cuando pagues tu primer módulo del nivel.",
        onOpen: function () { if (L.open) rsComp(main, M, L); else go("facturacion"); } }));
    }
    L.mods.forEach(function (c) {
      var locked = !c.module_paid;
      grid.appendChild(rsCard({ tone: "lvl", badge: c.module_level, title: c.module_level, sub: c.module_title, locked: locked,
        chip: locked ? ["warn", "Pendiente de pago"] : c.enrollment_status === "Completed" ? ["done", "Culminado"] : ["ok", "En curso"],
        onOpen: function () { if (locked) go("facturacion"); else rsModule(main, M, L, c); } }));
    });
    body.appendChild(grid);
    if (L.mods.some(function (c) { return !c.module_paid; })) {
      body.appendChild(h('<p class="rs-note">' + mcIc("lock") + "<span>El módulo con candado se abre cuando pagues su mensualidad.</span></p>"));
    }
  }

  function rsModule(main, M, L, c) {
    var crumbs = [["Mis recursos", function () { rsRoot(main, M); }], ["Nivel " + L.code, function () { rsLevel(main, M, L); }]];
    var name = c.module_level + " — " + c.module_title;
    var body = rsPage(main, crumbs, name, "Elige qué quieres ver.");
    var inner = crumbs.concat([[c.module_level, function () { rsModule(main, M, L, c); }]]);
    var grid = h('<div class="rs-grid"></div>');
    grid.appendChild(rsCard({ tone: "ink", icon: "read", title: "Libro de estudio", sub: c.module_book_title || "Libro + workbook",
      chip: c.module_heyzine_url ? null : ["soon", "Próximamente"],
      onOpen: function () { rsViewer(rsPage(main, inner, "Libro de estudio", c.module_book_title || ""), c.module_heyzine_url, c.module_book_title || "Libro de estudio — " + c.module_level); } }));
    grid.appendChild(rsCard({ tone: "violet", icon: "pencil", title: "Talleres", sub: "4 semanas + repaso del módulo",
      onOpen: function () { rsTalleres(main, inner, c); } }));
    grid.appendChild(rsCard({ tone: "green", icon: "spark", title: "Ejercicios por habilidad", sub: "Actividades para practicar lo del módulo",
      onOpen: function () { rsEjercicios(main, inner, c); } }));
    body.appendChild(grid);
  }

  // Talleres ya cargados: módulo → números de taller (1–4 semanas, 5 repaso).
  // El contenido NO está en el sitio público: lo entrega la función
  // student-taller solo si el estudiante pagó ese módulo (sus .json viven en
  // supabase/functions/student-taller/talleres). El motor de abajo lo dibuja con
  // el diseño del portal. Para agregar uno: su .json allá + su número aquí.
  var RS_TALLER_READY = {
    "A1.1": [1]
  };

  // Talleres del módulo: los sube el admin en Recursos compartidos → Talleres
  // (tabla workshops; el estudiante solo recibe los de módulos pagados). Mientras
  // no se aplique ese SQL, se usa la lista fija de antes (RS_TALLER_READY).
  function rsTalleres(main, crumbs, c) {
    var body = rsPage(main, crumbs, "Talleres", "Un taller por semana y el repaso del módulo.");
    var here = crumbs.concat([["Talleres", function () { rsTalleres(main, crumbs, c); }]]);
    var list = h('<div class="rs-files"><p class="muted">Cargando…</p></div>');
    body.appendChild(list);
    sb.from("workshops").select("id,slot,title,file_path,file_name,file_type,content")
      .eq("module_level", c.module_level).order("created_at").then(function (r) {
        var legacy = !!r.error, ws = r.data || [];
        list.innerHTML = "";
        RS_TALLERES.forEach(function (t, i) {
          var mine = ws.filter(function (w) { return w.slot === i + 1; });
          var ok = legacy ? (RS_TALLER_READY[c.module_level] || []).indexOf(i + 1) >= 0 : mine.length > 0;
          var row = h('<' + (ok ? 'button type="button"' : "div") + ' class="rs-file' + (ok ? " is-ready" : "") + '"><span class="rs-file__ic">' + mcIc("file") + "</span>" +
            '<span class="rs-file__t">' + esc(t) + "<small>" + (mine.length === 1 ? esc(mine[0].title) : (i < 4 ? "Semana " + (i + 1) + " del módulo" : "Al final del módulo")) + "</small></span>" +
            (ok ? '<span class="rs-chip is-ok">' + (mine.length > 1 ? mine.length + " talleres" : "Disponible") + '</span><span class="rs-card__go" aria-hidden="true">' + mcIc("arrow") + "</span>"
              : '<span class="rs-chip is-soon">Próximamente</span>') +
            "</" + (ok ? "button" : "div") + ">");
          if (ok) row.addEventListener("click", function () {
            if (legacy) return rsTallerOpen(main, here, t, c.module_level, i + 1);
            if (mine.length === 1) return rsWorkshopShow(main, here, mine[0]);
            rsWorkshopList(main, here, t, mine);
          });
          list.appendChild(row);
        });
      });
  }

  function rsWorkshopShow(main, crumbs, w) {
    window.LEFTaller.show(rsPage(main, crumbs, w.title), w, sb.storage);
  }

  function rsWorkshopList(main, crumbs, name, ws) {
    var body = rsPage(main, crumbs, name);
    var here = crumbs.concat([[name, function () { rsWorkshopList(main, crumbs, name, ws); }]]);
    var list = h('<div class="rs-files"></div>');
    ws.forEach(function (w) {
      var row = h('<button type="button" class="rs-file is-ready"><span class="rs-file__ic">' + mcIc("file") + "</span>" +
        '<span class="rs-file__t">' + esc(w.title) + "<small>" + esc(window.LEFTaller.label(w)) + "</small></span>" +
        '<span class="rs-card__go" aria-hidden="true">' + mcIc("arrow") + "</span></button>");
      row.addEventListener("click", function () { rsWorkshopShow(main, here, w); });
      list.appendChild(row);
    });
    body.appendChild(list);
  }

  function rsTallerOpen(main, crumbs, name, level, n) {
    var body = rsPage(main, crumbs, name);
    body.innerHTML = '<p class="muted">Cargando el taller…</p>';
    // Token fresco (la sesión se renueva sola cada hora), como en Clase de hoy.
    sb.auth.getSession().then(function (r) {
      var tok = (r.data && r.data.session) ? r.data.session.access_token : TOKEN;
      return fetch(window.LEF_SUPABASE.url + "/functions/v1/student-taller", {
        method: "POST",
        headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ module: level, n: n })
      });
    }).then(function (res) {
      return res.json().then(function (j) { if (!res.ok || !j.taller) throw new Error(j.error || "Error"); return j.taller; });
    }).then(function (T) {
      body.innerHTML = "";
      rsTallerRender(main, body, T);
    }).catch(function () {
      body.innerHTML = '<div class="pnl-alert err">No pudimos abrir el taller. Intenta de nuevo en unos minutos.</div>';
    });
  }

  // El motor del taller vive en lef-taller.js (lo usan el portal y el panel).
  function rsTallerRender(main, body, T) { window.LEFTaller.render(body, T); }

  // Ejercicios por habilidad (antes "Recursos interactivos", 26 sep 2026):
  // módulo → Vocabulario / Gramática / Listening / Reading (cada carpeta dice
  // cuántas actividades tiene) → las actividades como tarjetas → el ejercicio.
  // Las sube el admin en Recursos compartidos (tabla skill_activities; el
  // estudiante solo recibe las de módulos pagados).
  var RS_SKILLS = [
    { id: "vocabulario", label: "Vocabulario", icon: "abc" },
    { id: "gramatica", label: "Gramática", icon: "grammar" },
    { id: "listening", label: "Listening", icon: "headph" },
    { id: "reading", label: "Reading", icon: "read" }
  ];
  function rsEjercicios(main, crumbs, c) {
    var body = rsPage(main, crumbs, "Ejercicios por habilidad", "Elige la habilidad que quieres practicar.");
    var here = crumbs.concat([["Ejercicios por habilidad", function () { rsEjercicios(main, crumbs, c); }]]);
    body.innerHTML = '<p class="muted">Cargando…</p>';
    sb.from("skill_activities").select("id,skill,title,file_path,file_name,file_type,content")
      .eq("module_level", c.module_level).order("created_at").then(function (r) {
        body.innerHTML = "";
        var all = r.error ? [] : (r.data || []);
        var grid = h('<div class="rs-grid"></div>');
        RS_SKILLS.forEach(function (sk) {
          var list = all.filter(function (w) { return w.skill === sk.id; });
          grid.appendChild(rsCard({ tone: "green", icon: sk.icon, title: sk.label + " (" + list.length + ")",
            sub: list.length ? list.length + (list.length === 1 ? " actividad" : " actividades") : "Próximamente",
            onOpen: function () { rsEjerciciosSkill(main, here, sk, list); } }));
        });
        body.appendChild(grid);
      });
  }
  function rsEjerciciosSkill(main, crumbs, sk, list) {
    var body = rsPage(main, crumbs, sk.label);
    if (!list.length) { body.appendChild(rsEmpty("Todavía no hay actividades aquí", "LEF las agregará pronto.")); return; }
    var here = crumbs.concat([[sk.label, function () { rsEjerciciosSkill(main, crumbs, sk, list); }]]);
    var grid = h('<div class="rs-grid"></div>');
    list.forEach(function (w) {
      grid.appendChild(rsCard({ tone: "green", icon: w.content ? "spark" : "file", title: w.title, sub: window.LEFTaller.label(w, "Actividad interactiva"),
        onOpen: function () { window.LEFTaller.show(rsPage(main, here, w.title), w, sb.storage, "ejercicios"); } }));
    });
    body.appendChild(grid);
  }

  function renderResources(main) {
    main.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      sb.rpc("get_my_course"),
      // Si la base de datos aún no tiene los libros por nivel, la carpeta sale igual, sin libro.
      // Libros complementarios del nivel (varios, con título). Mientras no se aplique
      // el SQL de Recursos compartidos, se usa el libro único de antes (level_books).
      sb.rpc("get_my_complementary_books").then(function (r) {
        if (!r.error) return r.data || [];
        return sb.rpc("get_my_level_books").then(function (o) {
          return (o.data || []).filter(function (b) { return b.complementary_book_url; })
            .map(function (b) { return { level: b.level, title: "Libro complementario " + b.level, url: b.complementary_book_url }; });
        });
      }).then(null, function () { return []; })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      rsRoot(main, rsModel(res[0].data || [], res[1]));
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tus recursos: ' + esc(e.message) + "</div>";
    });
  }

  /* ---------- Mi cuenta ---------- */
  function renderAccount(main) {
    main.innerHTML = '<h1 class="pnl-h">Mi cuenta</h1><p class="pnl-sub">Tu foto, contraseña y datos de contacto.</p>';

    // --- Foto de perfil ---
    var AVATAR_GALLERY = [
      "assets/avatars/m1.svg", "assets/avatars/m2.svg", "assets/avatars/m3.svg",
      "assets/avatars/f1.svg", "assets/avatars/f2.svg", "assets/avatars/f3.svg"
    ];
    var avatarBox = h(
      '<div class="pnl-table-wrap" style="padding:20px;margin-bottom:24px">' +
      '<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      '<img data-avatar-preview src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--niebla)">' +
      '<div><label class="fld" style="margin-bottom:6px"><span>Foto de perfil</span><input type="file" accept="image/*" data-avatar-input></label>' +
      '<p class="muted" data-avatar-msg style="font-size:12.5px"></p></div>' +
      "</div>" +
      '<p class="muted" style="font-size:12.5px;margin:14px 0 8px">O tocá un dibujo:</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      AVATAR_GALLERY.map(function (src) {
        return '<img data-avatar-pick src="' + src + '" alt="" style="width:52px;height:52px;border-radius:50%;cursor:pointer;border:2px solid transparent">';
      }).join("") +
      "</div>" +
      "</div>"
    );
    main.appendChild(avatarBox);

    function setAvatar(url, msgEl) {
      return sb.rpc("update_my_avatar", { p_url: url }).then(function (r) {
        if (r.error) throw r.error;
        ME.avatar_url = url;
        avatarBox.querySelector("[data-avatar-preview]").src = url;
        var topImg = document.querySelector(".pnl-top .who img");
        if (topImg) topImg.src = url;
        msgEl.textContent = "Foto actualizada.";
      });
    }

    avatarBox.querySelectorAll("[data-avatar-pick]").forEach(function (img) {
      img.addEventListener("click", function () {
        var msg = avatarBox.querySelector("[data-avatar-msg]");
        msg.textContent = "Guardando…";
        setAvatar(img.getAttribute("src"), msg).catch(function (err) {
          msg.textContent = "No pudimos guardar la foto: " + ((err && err.message) || err);
        });
      });
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
      }).catch(function (err) {
        msg.textContent = "No pudimos subir la foto: " + ((err && err.message) || err);
      });
    });

    // --- Cambiar contraseña ---
    var pwBox = h(
      '<div class="pnl-table-wrap" style="padding:20px;margin-bottom:24px">' +
      '<p style="font-weight:600;margin-bottom:10px">Cambiar contraseña</p>' +
      field("Nueva contraseña", '<input type="password" data-pw-new autocomplete="new-password">') +
      field("Confirmar contraseña", '<input type="password" data-pw-confirm autocomplete="new-password">') +
      '<p class="pnl-sub" style="margin:-4px 0 12px;font-size:12.5px">' + esc(PW_HINT) + "</p>" +
      '<button class="btn btn-blue" data-pw-save>Guardar contraseña</button>' +
      '<p class="muted" data-pw-msg style="font-size:12.5px;margin-top:8px"></p>' +
      "</div>"
    );
    main.appendChild(pwBox);
    pwBox.querySelector("[data-pw-save]").addEventListener("click", function () {
      var msg = pwBox.querySelector("[data-pw-msg]");
      var P = window.LEFPassword;
      function say(t, kind) { if (P) P.say(msg, t, kind); else msg.textContent = t; }
      var pw1 = pwBox.querySelector("[data-pw-new]").value;
      var pw2 = pwBox.querySelector("[data-pw-confirm]").value;
      // Casillas en rojo + alerta roja con todo lo que falta (lef-password.js).
      var pwErr = P ? P.validate(pwBox) : (checkPassword(pw1) || (pw1 !== pw2 ? "Las contraseñas no coinciden." : ""));
      if (pwErr) { say(pwErr, "err"); return; }
      say("Guardando…");
      sb.auth.updateUser({ password: pw1 }).then(function (r) {
        if (r.error) throw r.error;
        if (window.LEFPrimerIngreso) window.LEFPrimerIngreso.markChanged(sb);
        say("Contraseña actualizada.", "ok");
        pwBox.querySelector("[data-pw-new]").value = "";
        pwBox.querySelector("[data-pw-confirm]").value = "";
      }).catch(function (e) {
        say("No pudimos cambiar la contraseña: " + pwErrorEs(e), "err");
      });
    });

    // --- Datos de contacto ---
    sb.rpc("get_my_billing").then(function (r) {
      if (r.error) throw r.error;
      var st = (r.data && r.data.student) || {};
      var dataBox = h(
        '<div class="pnl-table-wrap" style="padding:20px;margin-bottom:24px">' +
        '<p style="font-weight:600;margin-bottom:10px">Datos de contacto</p>' +
        field("Nombre completo", '<input data-acc-name value="' + esc(st.full_name) + '">') +
        field("WhatsApp", '<input data-acc-whatsapp value="' + esc(st.whatsapp) + '">') +
        field("Correo", '<input type="email" data-acc-email value="' + esc(st.email) + '">') +
        field("Edad", '<input type="number" min="5" max="100" data-acc-age value="' + (st.age || "") + '">') +
        field("Ciudad", '<input data-acc-city value="' + esc(st.city || "") + '">') +
        '<button class="btn btn-blue" data-acc-save>Guardar datos</button>' +
        '<p class="muted" data-acc-msg style="font-size:12.5px;margin-top:8px"></p>' +
        "</div>"
      );
      main.appendChild(dataBox);
      dataBox.querySelector("[data-acc-save]").addEventListener("click", function () {
        var msg = dataBox.querySelector("[data-acc-msg]");
        var g = function (sel) { return dataBox.querySelector(sel).value; };
        msg.textContent = "Guardando…";
        sb.rpc("update_my_profile", {
          p_full_name: g("[data-acc-name]"),
          p_whatsapp: g("[data-acc-whatsapp]"),
          p_email: g("[data-acc-email]"),
          p_age: g("[data-acc-age]") ? parseInt(g("[data-acc-age]"), 10) : null,
          p_city: g("[data-acc-city]") || null
        }).then(function (res) {
          if (res.error) throw res.error;
          msg.textContent = "Datos actualizados.";
        }).catch(function (e) {
          msg.textContent = "No pudimos guardar tus datos: " + ((e && e.message) || e);
        });
      });
    }).catch(function (e) {
      main.appendChild(h('<div class="pnl-alert err">No pudimos cargar tus datos: ' + esc(e.message) + "</div>"));
    });
  }

  boot();
})();
