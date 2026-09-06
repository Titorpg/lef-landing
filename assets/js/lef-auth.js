/* LEF — inicio de sesión único.
   Una sola puerta para admin, profesores y estudiantes.
   Tras autenticar, enruta según profiles.role:
     admin / teacher  -> admin.html
     student          -> portal.html
   Antes de enrutar corre LEFSec.enforce():
     - cambio de contraseña obligatorio si la cuenta aún usa la temporal
     - segundo factor (MFA/TOTP) obligatorio para el admin
   El formulario está protegido con Cloudflare Turnstile si hay clave configurada. */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var CAPTCHA_KEY = (window.LEF_AUTH_CONFIG && window.LEF_AUTH_CONFIG.turnstileSiteKey) || "";

  var captchaToken = null;
  var captchaWidgetId = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

  function destFor(role) { return role === "student" ? "portal.html" : "admin.html"; }
  function go(role) { window.location.replace(destFor(role)); }

  /* ---------- Turnstile (CAPTCHA) ---------- */
  function mountCaptcha(container) {
    if (!CAPTCHA_KEY) return;
    var el = h('<div style="margin:2px 0 14px;min-height:65px"></div>');
    container.appendChild(el);
    var tries = 0;
    (function render() {
      if (window.turnstile && window.turnstile.render) {
        captchaWidgetId = window.turnstile.render(el, {
          sitekey: CAPTCHA_KEY,
          callback: function (t) { captchaToken = t; },
          "error-callback": function () { captchaToken = null; },
          "expired-callback": function () { captchaToken = null; }
        });
      } else if (tries++ < 60) {
        setTimeout(render, 200);
      }
    })();
  }
  function resetCaptcha() {
    captchaToken = null;
    if (captchaWidgetId != null && window.turnstile) {
      try { window.turnstile.reset(captchaWidgetId); } catch (e) { /* noop */ }
    }
  }
  function captchaOpts() {
    return (CAPTCHA_KEY && captchaToken) ? { captchaToken: captchaToken } : {};
  }

  /* ---------- flujo ---------- */
  function afterAuth(userId) {
    return sb.from("profiles").select("role,active,must_change_password").eq("user_id", userId).maybeSingle()
      .then(function (p) {
        if (p.error || !p.data || !p.data.active) {
          return sb.auth.signOut().then(function () {
            throw new Error("Esta cuenta no tiene acceso. Contacta a LEF.");
          });
        }
        var role = p.data.role;
        return window.LEFSec.enforce(sb, {
          role: role,
          mustChangePassword: p.data.must_change_password,
          mfaRequiredRoles: ["admin"]
        }).then(function () { go(role); });
      });
  }

  function boot() {
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      if (!s) return renderLogin();
      afterAuth(s.user.id).catch(function () { renderLogin("Esta cuenta no tiene acceso. Contacta a LEF."); });
    });
  }

  function renderLogin(msg) {
    app.innerHTML = "";
    var card = h(
      '<div class="pnl-center"><form class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF — Learn English Fluently">' +
      '<p class="hint">Ingresa con tu correo y contraseña.<br>Estudiantes, profesores y administración usan el mismo acceso.</p>' +
      (msg ? '<div class="pnl-alert err">' + esc(msg) + "</div>" : "") +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      '<label class="fld"><span>Correo</span><input type="email" name="email" autocomplete="username" required></label>' +
      '<label class="fld"><span>Contraseña</span><input type="password" name="password" autocomplete="current-password" required></label>' +
      '<div data-captcha></div>' +
      '<button class="btn btn-dark" style="width:100%;justify-content:center" type="submit">Ingresar</button>' +
      '<p class="back"><a href="#" data-forgot>¿Olvidaste tu contraseña?</a></p>' +
      '<p class="back"><a href="index.html">&larr; Volver al sitio</a></p>' +
      "</form></div>"
    );
    var form = card.querySelector("form");
    mountCaptcha(card.querySelector("[data-captcha]"));

    card.querySelector("[data-forgot]").addEventListener("click", function (e) {
      e.preventDefault(); renderForgot();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]"); err.style.display = "none";
      var btn = form.querySelector("button"); btn.disabled = true;
      if (CAPTCHA_KEY && !captchaToken) {
        err.textContent = "Espera a que termine la verificación anti-robots e intenta de nuevo.";
        err.style.display = "block"; btn.disabled = false; return;
      }
      sb.auth.signInWithPassword({
        email: form.email.value.trim(),
        password: form.password.value,
        options: captchaOpts()
      })
        .then(function (r) {
          if (r.error) throw r.error;
          return afterAuth(r.data.user.id);
        })
        .catch(function (er) {
          resetCaptcha();
          err.textContent = er.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : /captcha/i.test(er.message || "") ? "No pasó la verificación anti-robots. Recarga la página."
            : er.message;
          err.style.display = "block"; btn.disabled = false;
        });
    });
    app.appendChild(card);
  }

  function renderForgot() {
    app.innerHTML = "";
    var card = h(
      '<div class="pnl-center"><form class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF">' +
      '<p class="hint">Escribe tu correo y te enviamos un enlace para crear una contraseña nueva.</p>' +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      '<div class="pnl-alert ok" data-ok style="display:none"></div>' +
      '<label class="fld"><span>Correo</span><input type="email" name="email" autocomplete="username" required></label>' +
      '<div data-captcha></div>' +
      '<button class="btn btn-dark" style="width:100%;justify-content:center" type="submit">Enviar enlace</button>' +
      '<p class="back"><a href="#" data-back>&larr; Volver</a></p>' +
      "</form></div>"
    );
    var form = card.querySelector("form");
    mountCaptcha(card.querySelector("[data-captcha]"));
    card.querySelector("[data-back]").addEventListener("click", function (e) { e.preventDefault(); renderLogin(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]"); err.style.display = "none";
      var ok = form.querySelector("[data-ok]"); ok.style.display = "none";
      var btn = form.querySelector("button"); btn.disabled = true;
      if (CAPTCHA_KEY && !captchaToken) {
        err.textContent = "Espera a que termine la verificación e intenta de nuevo.";
        err.style.display = "block"; btn.disabled = false; return;
      }
      sb.auth.resetPasswordForEmail(form.email.value.trim(), {
        redirectTo: window.location.origin + "/recuperar.html",
        captchaToken: (CAPTCHA_KEY && captchaToken) || undefined
      }).then(function (r) {
        if (r.error) throw r.error;
        ok.textContent = "Si el correo está registrado, te llegará el enlace en unos minutos. Revisa también spam.";
        ok.style.display = "block";
        btn.disabled = true;
      }).catch(function (er) {
        resetCaptcha();
        err.textContent = er.message || String(er);
        err.style.display = "block"; btn.disabled = false;
      });
    });
    app.appendChild(card);
  }

  boot();
})();
