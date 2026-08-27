/* LEF — Portal del estudiante. Una sola pestaña: Facturación.
   El estudiante ve su suscripción, estado de pago e historial.
   El cobro en línea (Wompi) y la tarjeta guardada se habilitan en la Fase 2. */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");

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
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }
  function monthLabel(s) {
    if (!s) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    var t = d.toLocaleDateString("es-CO", { year: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  var METHOD_ES = { cash: "Efectivo", transfer: "Transferencia", pse: "PSE", card: "Tarjeta", other: "Otro" };
  var PAYST_ES = { approved: "Aprobado", pending: "Pendiente", declined: "Rechazado", refunded: "Devuelto" };

  function boot() {
    sb.auth.getSession().then(function (r) {
      if (!r.data.session) return (window.location.replace("login.html"));
      sb.from("profiles").select("role,full_name,active").eq("user_id", r.data.session.user.id).maybeSingle()
        .then(function (p) {
          if (p.error || !p.data || !p.data.active) {
            return sb.auth.signOut().then(function () { window.location.replace("login.html"); });
          }
          if (p.data.role !== "student") {
            // staff entró aquí: mándalos al panel
            return (window.location.replace("admin.html"));
          }
          renderBilling(p.data);
        });
    });
  }

  function renderBilling(profile) {
    app.innerHTML = "";
    app.appendChild(h('<div class="pnl-top">' +
      '<a class="brand" href="index.html"><img src="assets/logo-horizontal.png" alt="LEF"><span class="tag">Mi cuenta</span></a>' +
      '<div class="who">' + esc(profile.full_name || "") + ' <button class="link" id="logout">Salir</button></div></div>'));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"><a class="active" href="#facturacion">Facturación</a></nav>' +
      '<main class="pnl-main"><p class="muted">Cargando…</p></main></div>');
    app.appendChild(wrap);
    document.getElementById("logout").onclick = function () { sb.auth.signOut().then(boot); };
    var main = wrap.querySelector(".pnl-main");

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

      subs.forEach(function (s) {
        var overdue = s.status === "active" && s.next_due_date &&
          (new Date() > new Date(new Date(s.next_due_date).getTime() + (s.grace_days || 0) * 864e5));
        var badge = s.status === "frozen" ? '<span class="badge bad">cuenta congelada</span>'
          : overdue ? '<span class="badge warn">pago pendiente</span>'
          : s.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
          : '<span class="badge ok">al día</span>';

        if (s.status === "frozen") {
          main.appendChild(h('<div class="pnl-alert err">Tu cuenta está <strong>congelada</strong> por falta de pago. Realiza el pago o contacta a LEF por WhatsApp para reactivarla.</div>'));
        }

        main.appendChild(h(
          '<div class="stat-row">' +
          '<div class="stat"><div class="k">Mensualidad</div><div class="v">' + money(s.monthly_amount, s.currency) + "</div></div>" +
          '<div class="stat"><div class="k">Estado</div><div class="v" style="font-size:16px">' + badge + "</div></div>" +
          '<div class="stat"><div class="k">Próximo pago</div><div class="v" style="font-size:16px">' + date(s.next_due_date) + "</div></div>" +
          "</div>"
        ));
        if (s.description) main.appendChild(h('<p class="pnl-sub">' + esc(s.description) + "</p>"));

        var box = h('<div class="pnl-table-wrap" style="padding:20px;margin-bottom:24px">' +
          '<p style="font-weight:600;margin-bottom:6px">Pago en línea</p>' +
          '<p class="muted" style="font-size:13.5px;margin-bottom:14px">Muy pronto podrás pagar tu mensualidad con PSE o tarjeta, y guardar tu tarjeta para el cobro automático mensual, de forma segura a través de Wompi.</p>' +
          '<button class="btn btn-blue" disabled>Pagar en línea (próximamente)</button> ' +
          '<button class="btn btn-ghost" disabled>Guardar tarjeta para cobro automático (próximamente)</button>' +
          "</div>");
        main.appendChild(box);
      });

      main.appendChild(h('<h2 class="pnl-h" style="font-size:16px;margin-top:8px">Historial de pagos</h2>'));
      var t = h('<div class="pnl-table-wrap"><table class="pnl"><thead><tr>' +
        "<th>Fecha</th><th>Mes cubierto</th><th>Monto</th><th>Método</th><th>Estado</th><th>Referencia</th>" +
        "</tr></thead><tbody></tbody></table></div>");
      var tb = t.querySelector("tbody");
      pays.forEach(function (p) {
        tb.appendChild(h("<tr><td>" + date(p.paid_at) + "</td><td>" + monthLabel(p.period_month) + "</td><td>" +
          money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) + "</td><td>" +
          esc(PAYST_ES[p.status] || p.status) + "</td><td>" + esc(p.reference || "—") + "</td></tr>"));
      });
      if (!pays.length) tb.appendChild(h('<tr><td colspan="6" class="muted">Todavía no hay pagos registrados.</td></tr>'));
      main.appendChild(t);
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu información: ' + esc(e.message) + "</div>";
    });
  }

  boot();
})();
