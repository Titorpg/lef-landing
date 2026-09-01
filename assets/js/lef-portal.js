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
      '<img src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:26px;height:26px;border-radius:50%;object-fit:cover">' +
      esc(ME.full_name || "") + ' <button class="link" data-logout>Salir</button></div></div>'
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
          '<p class="muted" style="font-size:13.5px;margin-bottom:14px">Paga tu mensualidad con PSE o tarjeta, de forma segura, a través de Wompi.</p>' +
          '<button class="btn btn-blue" data-pay="' + s.id + '"' + (s.status === "cancelled" ? " disabled" : "") + '>Pagar en línea</button> ' +
          '<button class="btn btn-ghost" disabled>Guardar tarjeta para cobro automático (próximamente)</button>' +
          '<p class="muted" data-pay-msg style="font-size:12.5px;margin-top:10px"></p>' +
          "</div>");
        main.appendChild(box);

        var payBtn = box.querySelector("[data-pay]");
        var payMsg = box.querySelector("[data-pay-msg]");
        payBtn.addEventListener("click", function () { openWompiCheckout(s.id, payBtn, payMsg, main); });
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

  function openWompiCheckout(subscriptionId, btn, msgEl, main) {
    if (!window.WidgetCheckout) {
      msgEl.textContent = "La pasarela de pagos no cargó. Recarga la página e intenta de nuevo.";
      return;
    }
    btn.disabled = true;
    var original = btn.textContent;
    btn.textContent = "Cargando…";
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
      btn.disabled = false;
      btn.textContent = original;
      checkout.open(function (result) {
        var tx = result && result.transaction;
        if (tx && tx.status === "APPROVED") {
          msgEl.textContent = "¡Pago recibido! Actualizando tu historial…";
        } else if (tx && tx.status === "PENDING") {
          msgEl.textContent = "Tu pago está pendiente de confirmación. Actualizaremos tu historial apenas se confirme.";
        } else {
          msgEl.textContent = "El pago no se completó. Puedes intentarlo de nuevo.";
        }
        // El pago real lo confirma el webhook (no este resultado); refrescamos para
        // mostrarlo si ya llegó, y una vez más un poco después por si tarda unos segundos.
        setTimeout(function () { renderBilling(main); }, 1800);
        setTimeout(function () { renderBilling(main); }, 5000);
      });
    }).catch(function (e) {
      btn.disabled = false;
      btn.textContent = original;
      msgEl.textContent = "No pudimos iniciar el pago: " + ((e && e.message) || e);
    });
  }

  /* ---------- Mi curso ---------- */
  function renderCourse(main) {
    sb.rpc("get_my_course").then(function (r) {
      if (r.error) throw r.error;
      var rows = r.data || [];
      var c = rows[0];
      main.innerHTML = '<h1 class="pnl-h">Mi curso</h1><p class="pnl-sub">El módulo en el que estás inscrito actualmente.</p>';

      if (!c) {
        main.appendChild(h('<div class="pnl-alert ok">Aún no tienes un módulo asignado. Escríbenos por WhatsApp si crees que esto es un error.</div>'));
        return;
      }

      main.appendChild(h(
        '<div class="stat-row">' +
        '<div class="stat"><div class="k">Nivel</div><div class="v" style="font-size:16px">' + esc(c.module_level) + "</div></div>" +
        '<div class="stat"><div class="k">Módulo</div><div class="v" style="font-size:16px">' + esc(c.module_title) + "</div></div>" +
        '<div class="stat"><div class="k">Matrícula</div><div class="v" style="font-size:16px">' + esc(c.registration_number) + "</div></div>" +
        "</div>"
      ));
      if (c.module_description) main.appendChild(h('<p class="pnl-sub">' + esc(c.module_description) + "</p>"));

      if (c.schedule_days && c.schedule_days.length) {
        main.appendChild(h(
          '<div class="stat-row">' +
          '<div class="stat"><div class="k">Días</div><div class="v" style="font-size:16px">' + esc(fmtDays(c.schedule_days)) + "</div></div>" +
          '<div class="stat"><div class="k">Horario</div><div class="v" style="font-size:16px">' + fmtTime(c.schedule_start_time) + " – " + fmtTime(c.schedule_end_time) + "</div></div>" +
          (c.teacher_full_name ? '<div class="stat"><div class="k">Profesor(a)</div><div class="v" style="font-size:16px">' + esc(c.teacher_full_name) + "</div></div>" : "") +
          "</div>"
        ));
      } else {
        main.appendChild(h('<div class="pnl-alert ok">Todavía no tienes horario asignado — LEF te contactará por WhatsApp para coordinarlo.</div>'));
      }
    }).catch(function (e) {
      main.innerHTML = '<div class="pnl-alert err">No pudimos cargar tu curso: ' + esc(e.message) + "</div>";
    });
  }

  /* ---------- Mi cuenta ---------- */
  function renderAccount(main) {
    main.innerHTML = '<h1 class="pnl-h">Mi cuenta</h1><p class="pnl-sub">Tu foto, contraseña y datos de contacto.</p>';

    // --- Foto de perfil ---
    var avatarBox = h(
      '<div class="pnl-table-wrap" style="padding:20px;margin-bottom:24px;display:flex;align-items:center;gap:18px;flex-wrap:wrap">' +
      '<img data-avatar-preview src="' + esc(ME.avatar_url || "assets/logo-isotype.png") + '" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:1px solid var(--niebla)">' +
      '<div><label class="fld" style="margin-bottom:6px"><span>Foto de perfil</span><input type="file" accept="image/*" data-avatar-input></label>' +
      '<p class="muted" data-avatar-msg style="font-size:12.5px"></p></div>' +
      "</div>"
    );
    main.appendChild(avatarBox);
    avatarBox.querySelector("[data-avatar-input]").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var msg = avatarBox.querySelector("[data-avatar-msg]");
      msg.textContent = "Subiendo…";
      var path = ME.user_id + "/" + Date.now() + "_" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      sb.storage.from("avatars").upload(path, file, { upsert: true }).then(function (up) {
        if (up.error) throw up.error;
        var publicUrl = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
        return sb.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", ME.user_id).then(function (upd) {
          if (upd.error) throw upd.error;
          ME.avatar_url = publicUrl;
          avatarBox.querySelector("[data-avatar-preview]").src = publicUrl;
          var topImg = document.querySelector(".pnl-top .who img");
          if (topImg) topImg.src = publicUrl;
          msg.textContent = "Foto actualizada.";
        });
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
