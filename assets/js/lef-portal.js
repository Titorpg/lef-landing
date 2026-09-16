/* LEF — Portal del estudiante. 3 pestañas: Facturación, Mi curso, Mi cuenta.
   El cobro en línea usa el Widget oficial de Wompi (checkout.wompi.co/widget.js);
   la firma de integridad se calcula en el Edge Function wompi-checkout (nunca en el
   navegador) y el pago se confirma por el webhook wompi-webhook, no por el resultado
   del widget. La tarjeta guardada para cobro automático sigue para una fase futura. */
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

  var WHATSAPP_NUMBER = "573013240652";
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
      sb.from("profiles").select("user_id,role,full_name,active,avatar_url").eq("user_id", uid).maybeSingle()
        .then(function (p) {
          if (p.error || !p.data || !p.data.active) {
            return sb.auth.signOut().then(function () { window.location.replace("login.html"); });
          }
          if (p.data.role !== "student") return window.location.replace("admin.html");
          ME = p.data;
          renderShell();
        });
    });
  }

  var TABS = [
    { id: "facturacion", label: "Facturación", render: renderBilling },
    { id: "curso", label: "Mi curso", render: renderCourse },
    { id: "cuenta", label: "Mi cuenta", render: renderAccount }
  ];

  function renderShell() {
    app.innerHTML = "";
    app.appendChild(h(
      '<div class="pnl-top">' +
      '<a class="brand" href="index.html"><img src="assets/logo-horizontal.png" alt="LEF"><span class="tag">Mi cuenta</span></a>' +
      '<div class="who">' +
      '<img src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover;flex:none">' +
      '<span class="name-text">' + esc(ME.full_name || "") + '</span>' +
      ' <button class="link" data-logout>Salir</button></div></div>'
    ));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"></nav><main class="pnl-main"></main></div>');
    var nav = wrap.querySelector(".pnl-nav");
    TABS.forEach(function (t) { nav.appendChild(h('<a href="#' + t.id + '">' + esc(t.label) + "</a>")); });
    app.appendChild(wrap);
    app.querySelector("[data-logout]").onclick = function () { sb.auth.signOut().then(boot); };

    window.onhashchange = route;
    var cur = location.hash.slice(1);
    if (!cur || !TABS.some(function (t) { return t.id === cur; })) location.hash = TABS[0].id;
    else route();
  }

  function route() {
    var id = location.hash.slice(1);
    var tab = TABS.filter(function (t) { return t.id === id; })[0] || TABS[0];
    document.querySelectorAll(".pnl-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + tab.id);
    });
    var main = document.querySelector(".pnl-main");
    if (!main) return;
    main.innerHTML = '<p class="muted">Cargando…</p>';
    tab.render(main);
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
        var overdue = s.status === "active" && s.next_due_date &&
          (new Date() > new Date(new Date(s.next_due_date).getTime() + (s.grace_days || 0) * 864e5));
        var subPays = pays.filter(function (p) { return p.subscription_id === s.id; });
        // "Pendiente" = todavía no hay ningún pago confirmado de esta suscripción.
        var hasPaid = subPays.some(function (p) { return p.status === "approved"; });
        // Al día = ya pagó el período actual y no está vencido. En este caso NO debe
        // poder volver a pagar el mismo curso por error (ver caso del estudiante que
        // pasó de A1.1 pagado a A1.2: A1.1 debe quedar "al día", sin botón de pago).
        var upToDate = s.status === "active" && hasPaid && !overdue;
        var lastPay = subPays.filter(function (p) { return p.status === "approved"; })
          .sort(function (a, b) { return new Date(b.paid_at) - new Date(a.paid_at); })[0];
        return { s: s, overdue: overdue, hasPaid: hasPaid, upToDate: upToDate, lastPay: lastPay };
      });
      entries.sort(function (a, b) {
        if (a.upToDate !== b.upToDate) return a.upToDate ? 1 : -1;
        if (a.upToDate) {
          return new Date((b.lastPay && b.lastPay.paid_at) || 0) - new Date((a.lastPay && a.lastPay.paid_at) || 0);
        }
        return new Date(a.s.started_at || 0) - new Date(b.s.started_at || 0);
      });

      entries.forEach(function (e) {
        var s = e.s, overdue = e.overdue, hasPaid = e.hasPaid, upToDate = e.upToDate, lastPay = e.lastPay;
        var badge = s.status === "frozen" ? '<span class="badge bad">cuenta congelada</span>'
          : s.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
          : (s.status === "active" && !hasPaid) ? '<span class="badge neutral">pendiente</span>'
          : overdue ? '<span class="badge warn">pago pendiente</span>'
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
          (s.status === "cancelled" ? "" :
            '<div class="course-hero__pay">' +
            '<p class="course-hero__pay-lead">Puedes pagar tu mensualidad de dos formas: por transferencia directa escaneando un QR desde tu app bancaria, o con tarjeta débito/crédito a través de Wompi. Elige la que prefieras en el siguiente paso.</p>' +
            '<button class="btn btn-blue" data-open-pay>Pagar ahora</button> ' +
            '<button class="btn btn-ghost" disabled>Guardar tarjeta para cobro automático (próximamente)</button>' +
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
      '<p class="pay-modal__cta-label">Llave Bre-B: @lefcenter</p>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-copy-key>Copiar llave</button>' +
      '<p class="muted" style="font-size:11.5px;text-align:center">Toca el QR para verlo en grande y escanearlo mejor.</p>' +
      '<p class="muted" style="font-size:12px;text-align:center">' +
      'Después de transferir, <a href="' + waLink(s) + '" target="_blank" rel="noopener">escríbenos por WhatsApp con el comprobante</a> para registrar tu pago.</p>' +
      "</div>" +
      '<div class="pay-modal__divider">o</div>' +
      '<div class="pay-modal__col">' +
      '<img src="assets/wompi-pagos-vertical.png" alt="Wompi — paga con tarjeta débito o crédito" class="pay-visual">' +
      '<p class="pay-modal__cta-label">Paga ahora</p>' +
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
    var doneMsg = now >= end ? "Tu ciclo ya terminó — LEF actualizará tu siguiente módulo en breve."
      : now < start ? "Tu ciclo todavía no empieza."
      : "Va " + pct + "% del ciclo.";
    return '<div class="course-progress">' +
      '<div class="bar-labels"><span>' + date(startStr) + "</span><span>" + date(endStr) + "</span></div>" +
      '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
      '<p class="bar-note">' + esc(doneMsg) + "</p></div>";
  }

  // Completado = el admin ya archivó ese módulo (asignó el siguiente), o el ciclo
  // ya terminó aunque todavía no le hayan asignado el módulo que sigue.
  function isCourseDone(c) {
    if (c.enrollment_status === "Completed") return true;
    if (!c.cycle_end_date) return false;
    return new Date() >= new Date(c.cycle_end_date + "T00:00:00");
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

    main.appendChild(h(
      '<div class="course-hero">' +
      '<div class="lvl-tag">Nivel · matrícula ' + esc(c.registration_number) + "</div>" +
      "<h2>" + esc(levelOf(c.module_level)) + "</h2>" +
      '<div class="mod-name">Módulo actual: ' + esc(c.module_level) + " — " + esc(c.module_title) + "</div>" +
      progressBar(c.cycle_start_date, c.cycle_end_date) +
      (c.module_description ? '<p class="pnl-sub" style="margin:14px 0 16px"><strong>Contenido de este módulo:</strong> ' + esc(c.module_description) + "</p>" : "") +
      scheduleHtml +
      "</div>"
    ));
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

  function renderCourse(main) {
    sb.rpc("get_my_course").then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      main.innerHTML = '<h1 class="pnl-h">Mi curso</h1><p class="pnl-sub">El nivel y el módulo en el que estás inscrito actualmente.</p>';

      if (!rows.length) {
        main.appendChild(h('<div class="pnl-alert ok">Aún no tienes un módulo asignado. Escríbenos por WhatsApp si crees que esto es un error.</div>'));
        return;
      }

      var current = rows.filter(function (c) { return !isCourseDone(c); });
      var done = rows.filter(isCourseDone);

      current.forEach(function (c) { renderCourseHero(main, c); });
      if (!current.length) {
        main.appendChild(h('<div class="pnl-alert ok">Ya completaste tu módulo actual — LEF te asignará el siguiente en breve.</div>'));
      }
      done.forEach(function (c) { renderCourseCompact(main, c); });
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu curso: ' + esc(e.message) + "</div>";
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
      '<button class="btn btn-blue" data-pw-save>Guardar contraseña</button>' +
      '<p class="muted" data-pw-msg style="font-size:12.5px;margin-top:8px"></p>' +
      "</div>"
    );
    main.appendChild(pwBox);
    pwBox.querySelector("[data-pw-save]").addEventListener("click", function () {
      var msg = pwBox.querySelector("[data-pw-msg]");
      var pw1 = pwBox.querySelector("[data-pw-new]").value;
      var pw2 = pwBox.querySelector("[data-pw-confirm]").value;
      if (pw1.length < 8) { msg.textContent = "La contraseña debe tener al menos 8 caracteres."; return; }
      if (pw1 !== pw2) { msg.textContent = "Las contraseñas no coinciden."; return; }
      msg.textContent = "Guardando…";
      sb.auth.updateUser({ password: pw1 }).then(function (r) {
        if (r.error) throw r.error;
        msg.textContent = "Contraseña actualizada.";
        pwBox.querySelector("[data-pw-new]").value = "";
        pwBox.querySelector("[data-pw-confirm]").value = "";
      }).catch(function (e) {
        msg.textContent = "No pudimos cambiar la contraseña: " + ((e && e.message) || e);
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
