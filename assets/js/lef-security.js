/* LEF — utilidades de seguridad compartidas (login, portal, panel, recuperación).
   - Política de contraseña (debe coincidir con la del panel de Supabase).
   - "Candado" tras el inicio de sesión: cambio de contraseña obligatorio en el
     primer ingreso + segundo factor (MFA/TOTP) obligatorio para el admin.
   Sin dependencias más allá de supabase-js. */
(function () {
  "use strict";

  var PW_MIN = 12;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  // El QR que devuelve Supabase puede venir como data URI o como SVG en crudo.
  function qrHtml(qr, size) {
    size = size || 180;
    if (!qr) return "";
    if (/^data:/.test(qr)) return '<img alt="Código QR" width="' + size + '" height="' + size + '" src="' + qr.replace(/"/g, "&quot;") + '">';
    if (/<svg/i.test(qr)) return qr.replace("<svg", '<svg width="' + size + '" height="' + size + '"');
    // último recurso: como URI otpauth en texto
    return '<code style="font-size:11px;word-break:break-all">' + esc(qr) + "</code>";
  }

  // ---- Política de contraseña -------------------------------------------------
  function checkPassword(pw) {
    pw = pw || "";
    if (pw.length < PW_MIN) return { ok: false, msg: "La contraseña debe tener al menos " + PW_MIN + " caracteres." };
    if (!/[a-z]/.test(pw)) return { ok: false, msg: "Debe incluir al menos una letra minúscula." };
    if (!/[A-Z]/.test(pw)) return { ok: false, msg: "Debe incluir al menos una letra mayúscula." };
    if (!/[0-9]/.test(pw)) return { ok: false, msg: "Debe incluir al menos un número." };
    if (!/[^A-Za-z0-9]/.test(pw)) return { ok: false, msg: "Debe incluir al menos un símbolo (por ejemplo ! @ # $ %)." };
    return { ok: true, msg: "" };
  }
  function passwordHintHtml() {
    return '<p class="muted" style="font-size:12px;margin:-4px 0 12px">Mínimo ' + PW_MIN +
      ' caracteres, con mayúscula, minúscula, número y símbolo.</p>';
  }

  // ---- Estado de MFA --------------------------------------------------------
  function mfaState(sb) {
    return Promise.all([
      sb.auth.mfa.getAuthenticatorAssuranceLevel(),
      sb.auth.mfa.listFactors()
    ]).then(function (res) {
      var aal = (res[0] && res[0].data) || {};
      var factors = (res[1] && res[1].data) || {};
      var totp = (factors.totp || []);
      var verified = totp.filter(function (f) { return f.status === "verified"; });
      return {
        currentLevel: aal.currentLevel || "aal1",
        nextLevel: aal.nextLevel || "aal1",
        verifiedTotp: verified,
        unverified: totp.filter(function (f) { return f.status !== "verified"; })
      };
    });
  }

  // Limpia factores TOTP a medio inscribir (quedan si se interrumpe el proceso).
  function clearUnverified(sb) {
    return sb.auth.mfa.listFactors().then(function (r) {
      var totp = ((r.data && r.data.totp) || []).filter(function (f) { return f.status !== "verified"; });
      return Promise.all(totp.map(function (f) { return sb.auth.mfa.unenroll({ factorId: f.id }); }));
    }).catch(function () { /* sin bloqueo */ });
  }

  // ---- Tarjeta a pantalla completa ----------------------------------------
  // Se dibuja dentro de #app si existe (así el resto del script lo puede volver
  // a pintar tras el resolve); si no, sobre el body.
  function fullCard(innerHtml) {
    var host = document.getElementById("app") || document.body;
    host.innerHTML = "";
    var wrap = h('<div class="pnl-center"><div class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF">' + innerHtml + "</div></div>");
    host.appendChild(wrap);
    return wrap.querySelector(".pnl-login");
  }

  // ---- Paso: cambiar contraseña obligatorio -------------------------------
  function forcePasswordChange(sb) {
    return new Promise(function (resolve, reject) {
      var card = fullCard(
        '<p class="hint">Por seguridad, crea tu contraseña personal para continuar.</p>' +
        '<div class="pnl-alert err" data-err style="display:none"></div>' +
        passwordHintHtml() +
        '<label class="fld"><span>Nueva contraseña</span><input type="password" data-p1 autocomplete="new-password"></label>' +
        '<label class="fld"><span>Repite la contraseña</span><input type="password" data-p2 autocomplete="new-password"></label>' +
        '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Guardar y continuar</button>'
      );
      var err = card.querySelector("[data-err]");
      var btn = card.querySelector("[data-go]");
      btn.addEventListener("click", function () {
        err.style.display = "none";
        var p1 = card.querySelector("[data-p1]").value;
        var p2 = card.querySelector("[data-p2]").value;
        var chk = checkPassword(p1);
        if (!chk.ok) { err.textContent = chk.msg; err.style.display = "block"; return; }
        if (p1 !== p2) { err.textContent = "Las contraseñas no coinciden."; err.style.display = "block"; return; }
        btn.disabled = true; btn.textContent = "Guardando…";
        sb.auth.updateUser({ password: p1 }).then(function (r) {
          if (r.error) throw r.error;
          return sb.rpc("mark_my_password_changed");
        }).then(function () { resolve(); }).catch(function (e) {
          btn.disabled = false; btn.textContent = "Guardar y continuar";
          err.textContent = /same_password|different from the old/i.test(e.message || "")
            ? "La nueva contraseña debe ser distinta de la temporal."
            : (e.message || String(e));
          err.style.display = "block";
        });
      });
    });
  }

  // ---- Paso: reto de segundo factor (ya tiene TOTP) ----------------------
  function mfaChallenge(sb, factorId) {
    return new Promise(function (resolve) {
      var card = fullCard(
        '<p class="hint">Escribe el código de 6 dígitos de tu app de autenticación.</p>' +
        '<div class="pnl-alert err" data-err style="display:none"></div>' +
        '<label class="fld"><span>Código</span><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-code style="letter-spacing:.3em;text-align:center;font-size:20px"></label>' +
        '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Verificar</button>' +
        '<p class="back"><a href="#" data-logout>Cancelar y salir</a></p>'
      );
      var err = card.querySelector("[data-err]");
      var btn = card.querySelector("[data-go]");
      card.querySelector("[data-logout]").addEventListener("click", function (e) {
        e.preventDefault(); sb.auth.signOut().then(function () { location.replace("login.html"); });
      });
      btn.addEventListener("click", function () {
        err.style.display = "none";
        var code = (card.querySelector("[data-code]").value || "").trim();
        if (!/^\d{6}$/.test(code)) { err.textContent = "Son 6 dígitos."; err.style.display = "block"; return; }
        btn.disabled = true; btn.textContent = "Verificando…";
        sb.auth.mfa.challengeAndVerify({ factorId: factorId, code: code }).then(function (r) {
          if (r.error) throw r.error;
          resolve();
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = "Verificar";
          err.textContent = "Código incorrecto o vencido. Intenta con el siguiente.";
          console.warn("[mfa] verify", e);
          err.style.display = "block";
        });
      });
    });
  }

  // ---- Paso: inscribir TOTP (obligatorio para admin sin factor) ----------
  function mfaEnroll(sb) {
    return clearUnverified(sb).then(function () {
      return sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "LEF-" + Date.now() });
    }).then(function (r) {
      if (r.error) throw r.error;
      var d = r.data;
      return new Promise(function (resolve) {
        var card = fullCard(
          '<p class="hint">Tu cuenta requiere verificación en dos pasos. Escanea este código con Google Authenticator, Microsoft Authenticator, Authy o 1Password.</p>' +
          '<div style="text-align:center;margin:6px 0 14px">' + qrHtml(d.totp.qr_code, 180) + "</div>" +
          '<p class="muted" style="font-size:12px;word-break:break-all;margin-bottom:14px">¿No puedes escanear? Ingresa esta clave: <strong>' + esc(d.totp.secret) + "</strong></p>" +
          '<div class="pnl-alert err" data-err style="display:none"></div>' +
          '<label class="fld"><span>Código de la app</span><input inputmode="numeric" autocomplete="one-time-code" maxlength="6" data-code style="letter-spacing:.3em;text-align:center;font-size:20px"></label>' +
          '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Activar y continuar</button>' +
          '<p class="back"><a href="#" data-logout>Cancelar y salir</a></p>'
        );
        var err = card.querySelector("[data-err]");
        var btn = card.querySelector("[data-go]");
        card.querySelector("[data-logout]").addEventListener("click", function (e) {
          e.preventDefault();
          sb.auth.mfa.unenroll({ factorId: d.id }).catch(function () {}).then(function () {
            return sb.auth.signOut();
          }).then(function () { location.replace("login.html"); });
        });
        btn.addEventListener("click", function () {
          err.style.display = "none";
          var code = (card.querySelector("[data-code]").value || "").trim();
          if (!/^\d{6}$/.test(code)) { err.textContent = "Son 6 dígitos."; err.style.display = "block"; return; }
          btn.disabled = true; btn.textContent = "Activando…";
          sb.auth.mfa.challengeAndVerify({ factorId: d.id, code: code }).then(function (rr) {
            if (rr.error) throw rr.error;
            resolve();
          }).catch(function (e) {
            btn.disabled = false; btn.textContent = "Activar y continuar";
            err.textContent = "Código incorrecto. Espera al siguiente e intenta de nuevo.";
            console.warn("[mfa] enroll verify", e);
            err.style.display = "block";
          });
        });
      });
    });
  }

  /* Candado post-login. Se llama tras autenticar y cargar el profile.
     Devuelve una promesa que resuelve cuando la sesión está en orden:
       1. si must_change_password -> obliga a cambiarla
       2. MFA: si ya hay reto pendiente -> lo pide; si el rol lo exige y no hay
          factor -> obliga a inscribirlo.
     La página que llama debe re-render tras el resolve. */
  function enforce(sb, opts) {
    opts = opts || {};
    var mfaRequiredRoles = opts.mfaRequiredRoles || ["admin"];
    var role = opts.role;
    var mustChange = !!opts.mustChangePassword;

    var chain = Promise.resolve();
    if (mustChange) chain = chain.then(function () { return forcePasswordChange(sb); });

    return chain.then(function () { return mfaState(sb); }).then(function (st) {
      if (st.currentLevel === "aal2") return;               // ya verificado en esta sesión
      if (st.nextLevel === "aal2" && st.verifiedTotp.length) {
        return mfaChallenge(sb, st.verifiedTotp[0].id);     // tiene factor, falta el reto
      }
      if (mfaRequiredRoles.indexOf(role) > -1) {
        // challengeAndVerify dentro deja la sesión en aal2.
        // Si la inscripción falla (p. ej. MFA aún deshabilitado en el panel de
        // Supabase durante el despliegue), no se bloquea el ingreso: se registra
        // y se continúa. Apenas el factor exista, el reto de arriba es obligatorio.
        return mfaEnroll(sb).catch(function (e) {
          console.error("[mfa] no se pudo inscribir el segundo factor:", e);
        });
      }
      // rol sin MFA obligatorio y sin factor -> se permite (puede activarlo luego)
    });
  }

  window.LEFSec = {
    PW_MIN: PW_MIN,
    checkPassword: checkPassword,
    passwordHintHtml: passwordHintHtml,
    mfaState: mfaState,
    clearUnverified: clearUnverified,
    mfaEnroll: mfaEnroll,
    enforce: enforce,
    qrHtml: qrHtml,
    _h: h, _esc: esc
  };
})();
