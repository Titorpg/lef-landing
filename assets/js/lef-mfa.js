/* LEF — verificación en 2 pasos (TOTP) — parte 5 del endurecimiento del login
   (23 sep 2026). Obligatoria para administradores (hay 2: "Administrador LEF"
   y "Admin Sistemas"; uno puede restablecer la del otro desde Usuarios).

   LEFMfa.gate(sb, app, required, next):
     - si la cuenta tiene un factor verificado y la sesión aún es aal1 →
       pantalla "escribe el código de 6 dígitos" → next();
     - si NO tiene factor y required → pantalla para activarla (QR, clave o
       botón que abre la app en el mismo celular) → next();
     - si no aplica → next() directo.
   Ante cualquier error inesperado de Supabase al consultar el estado, deja
   pasar (next) en vez de bloquear: el bloqueo real lo pondrá el servidor.

   Orden importa: Supabase exige sesión aal2 para cambiar la contraseña de
   una cuenta con 2 pasos activos, por eso este paso va ANTES del cambio de
   contraseña obligatorio (lef-primer-ingreso.js) y en /recuperar. */
(function () {
  "use strict";

  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function qrHtml(qr) {
    if (!qr) return "";
    if (/^data:/.test(qr)) return '<img alt="Código QR" width="190" height="190" style="margin:0 auto" src="' + qr.replace(/"/g, "&quot;") + '">';
    if (/<svg/i.test(qr)) return qr.replace("<svg", '<svg width="190" height="190"');
    return "";
  }
  function card(app, inner) {
    app.innerHTML = "";
    app.appendChild(h('<div class="pnl-center"><div class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF — Learn English Fluently">' + inner + "</div></div>"));
    return app.querySelector(".pnl-login");
  }
  function codeField() {
    return '<label class="fld"><span>Código de 6 dígitos</span>' +
      '<input data-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="000000" ' +
      'style="letter-spacing:.45em;text-align:center;font-size:24px;font-weight:600"></label>';
  }
  function codeErr(e) {
    var m = (e && e.message) || String(e);
    if (/invalid|expired|code/i.test(m)) return "Código incorrecto o vencido. Espera a que la app muestre el siguiente código e intenta de nuevo.";
    if (/rate|too many/i.test(m)) return "Demasiados intentos. Espera un minuto e intenta de nuevo.";
    return "No se pudo verificar el código. Intenta de nuevo.";
  }
  // Solo dígitos; al completar 6, envía solo.
  function wireCode(root, submit) {
    var inp = root.querySelector("[data-code]");
    inp.addEventListener("input", function () {
      inp.value = inp.value.replace(/\D/g, "").slice(0, 6);
      if (inp.value.length === 6) submit();
    });
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); submit(); } });
    setTimeout(function () { try { inp.focus(); } catch (er) { /* noop */ } }, 50);
    return inp;
  }
  function logoutLink(sb) {
    return '<p class="back" style="margin-top:14px"><a href="#" data-out>Cerrar sesión</a></p>';
  }
  function wireLogout(sb, root) {
    var a = root.querySelector("[data-out]");
    if (a) a.addEventListener("click", function (e) {
      e.preventDefault();
      sb.auth.signOut().then(function () { window.location.replace("login"); });
    });
  }

  /* ---------- escribir el código (ya tiene 2 pasos activos) ---------- */
  function challenge(sb, app, factor, next, opts) {
    var root = card(app,
      '<p class="hint"><strong>Verificación en 2 pasos</strong><br>' +
      "Abre tu app de autenticación (Google Authenticator u otra) y escribe el código de 6 dígitos de <strong>LEF</strong>.</p>" +
      '<div class="pnl-alert err" data-err style="display:none"></div>' + codeField() +
      '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Verificar</button>' +
      '<p class="hint" style="margin:16px 0 0;font-size:12.5px">¿Perdiste o cambiaste tu celular? ' +
      (opts && opts.lostHelp ? esc(opts.lostHelp) : "Pide a otro administrador que te restablezca la verificación en 2 pasos desde Usuarios.") + "</p>" +
      logoutLink(sb));
    wireLogout(sb, root);
    var err = root.querySelector("[data-err]"), btn = root.querySelector("[data-go]"), busy = false;
    var inp;
    function submit() {
      if (busy) return;
      var code = inp.value.trim();
      if (!/^\d{6}$/.test(code)) { err.textContent = "Escribe los 6 dígitos que muestra la app."; err.style.display = "block"; return; }
      busy = true; btn.disabled = true; btn.textContent = "Verificando…"; err.style.display = "none";
      sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code }).then(function (r) {
        if (r.error) throw r.error;
        next();
      }).catch(function (e) {
        busy = false; btn.disabled = false; btn.textContent = "Verificar";
        err.textContent = codeErr(e); err.style.display = "block"; inp.value = ""; inp.focus();
      });
    }
    inp = wireCode(root, submit);
    btn.addEventListener("click", submit);
  }

  /* ---------- activarla por primera vez ---------- */
  function enroll(sb, app, all, next) {
    // Un intento abandonado deja un factor "unverified": se limpia antes.
    var stale = (all || []).filter(function (f) { return f.factor_type === "totp" && f.status !== "verified"; });
    Promise.all(stale.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }).catch(function () {}); }))
      .then(function () {
        return sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "LEF " + new Date().toISOString().slice(0, 16), issuer: "LEF" });
      })
      .then(function (r) {
        if (r.error) throw r.error;
        var d = r.data, uri = d.totp.uri || "", secret = d.totp.secret || "";
        var root = card(app,
          '<p class="hint"><strong>Activa la verificación en 2 pasos</strong><br>' +
          "Por seguridad, las cuentas de administrador piden un código del celular además de la contraseña. Solo se configura una vez.</p>" +
          '<ol style="font-size:13.5px;color:var(--grafito);padding-left:20px;margin:0 0 14px;line-height:1.55">' +
          "<li>Instala en tu celular <strong>Google Authenticator</strong> o <strong>Microsoft Authenticator</strong> (gratis).</li>" +
          "<li>Agrega la cuenta de LEF: escanea el código QR con la app, o si estás en el mismo celular, toca <strong>“Abrir en la app”</strong> (o copia la clave y pégala en la app).</li>" +
          "<li>Escribe abajo el código de 6 dígitos que aparece en la app.</li></ol>" +
          '<div style="text-align:center;margin:4px 0 10px">' + qrHtml(d.totp.qr_code) + "</div>" +
          '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:10px">' +
          (uri ? '<a class="btn btn-ghost btn-sm" href="' + esc(uri) + '">Abrir en la app</a>' : "") +
          '<button type="button" class="btn btn-ghost btn-sm" data-copy>Copiar clave</button></div>' +
          '<p class="muted" style="font-size:12px;text-align:center;word-break:break-all;margin-bottom:14px">Clave: <strong style="font-family:ui-monospace,Consolas,monospace;letter-spacing:.06em">' + esc(secret) + "</strong></p>" +
          '<div class="pnl-alert err" data-err style="display:none"></div>' + codeField() +
          '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Activar y continuar</button>' +
          logoutLink(sb));
        wireLogout(sb, root);
        var copyBtn = root.querySelector("[data-copy]");
        copyBtn.addEventListener("click", function () {
          var done = function () { copyBtn.textContent = "¡Clave copiada!"; setTimeout(function () { copyBtn.textContent = "Copiar clave"; }, 2500); };
          if (navigator.clipboard) navigator.clipboard.writeText(secret).then(done, function () { window.prompt("Copia la clave:", secret); });
          else window.prompt("Copia la clave:", secret);
        });
        var err = root.querySelector("[data-err]"), btn = root.querySelector("[data-go]"), busy = false, inp;
        function submit() {
          if (busy) return;
          var code = inp.value.trim();
          if (!/^\d{6}$/.test(code)) { err.textContent = "Escribe los 6 dígitos que muestra la app."; err.style.display = "block"; return; }
          busy = true; btn.disabled = true; btn.textContent = "Activando…"; err.style.display = "none";
          sb.auth.mfa.challengeAndVerify({ factorId: d.id, code: code }).then(function (rr) {
            if (rr.error) throw rr.error;
            next();
          }).catch(function (e) {
            busy = false; btn.disabled = false; btn.textContent = "Activar y continuar";
            err.textContent = codeErr(e); err.style.display = "block"; inp.value = ""; inp.focus();
          });
        }
        inp = wireCode(root, submit);
        btn.addEventListener("click", submit);
      })
      .catch(function (e) {
        var root = card(app,
          '<div class="pnl-alert err">No se pudo iniciar la activación de la verificación en 2 pasos.</div>' +
          '<p class="hint">' + esc((e && e.message) || String(e)) + "<br>Recarga la página e intenta de nuevo.</p>" + logoutLink(sb));
        wireLogout(sb, root);
      });
  }

  function gate(sb, app, required, next, opts) {
    Promise.all([sb.auth.mfa.getAuthenticatorAssuranceLevel(), sb.auth.mfa.listFactors()])
      .then(function (res) {
        var aal = res[0].data || {}, fac = res[1].data || {};
        if (res[0].error || res[1].error) return next();
        var verified = (fac.totp || []).filter(function (f) { return f.status === "verified"; });
        if (verified.length) {
          if (aal.currentLevel === "aal2") return next();
          return challenge(sb, app, verified[0], next, opts);
        }
        if (required) return enroll(sb, app, fac.all, next);
        next();
      })
      .catch(function () { next(); });
  }

  window.LEFMfa = { gate: gate };
})();
