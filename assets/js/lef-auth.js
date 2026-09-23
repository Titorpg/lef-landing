/* LEF — inicio de sesión único.
   Una sola puerta para admin, profesores y estudiantes.
   Tras autenticar, enruta según profiles.role:
     admin / teacher  -> admin.html
     student          -> portal.html
   El formulario está protegido con Cloudflare Turnstile (CAPTCHA) cuando hay
   Site Key en supabase-config.js; el token viaja en signInWithPassword y lo
   valida Supabase (Authentication → CAPTCHA, con la Secret Key). */
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

  /* ---------- Turnstile (CAPTCHA) ---------- */
  function mountCaptcha(container) {
    if (!CAPTCHA_KEY) return;
    var tries = 0;
    (function render() {
      if (window.turnstile && window.turnstile.render) {
        captchaWidgetId = window.turnstile.render(container, {
          sitekey: CAPTCHA_KEY,
          language: "es",
          callback: function (t) { captchaToken = t; },
          "error-callback": function () { captchaToken = null; },
          "expired-callback": function () { captchaToken = null; }
        });
      } else if (tries++ < 75) {
        setTimeout(render, 200); // el script de Cloudflare carga async
      } else {
        container.innerHTML = '<p class="muted" style="font-size:12.5px;text-align:center">No cargó la verificación de seguridad. Recarga la página.</p>';
      }
    })();
  }
  // Cada token sirve una sola vez: tras cualquier intento hay que pedir otro.
  function resetCaptcha() {
    captchaToken = null;
    if (captchaWidgetId != null && window.turnstile) {
      try { window.turnstile.reset(captchaWidgetId); } catch (e) { /* noop */ }
    }
  }

  function destFor(role) {
    return role === "student" ? "portal.html" : "admin.html";
  }

  function go(role) { window.location.replace(destFor(role)); }

  function boot() {
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      if (!s) return renderLogin();
      sb.from("profiles").select("role,active").eq("user_id", s.user.id).maybeSingle()
        .then(function (p) {
          if (p.error || !p.data || !p.data.active) {
            return sb.auth.signOut().then(function () {
              renderLogin("Esta cuenta no tiene acceso. Contacta a LEF.");
            });
          }
          go(p.data.role);
        });
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
      (CAPTCHA_KEY ? '<div data-captcha style="margin:2px 0 14px;min-height:65px;display:flex;justify-content:center"></div>' : "") +
      '<button class="btn btn-dark" style="width:100%;justify-content:center" type="submit">Ingresar</button>' +
      '<p class="back"><a href="index.html">&larr; Volver al sitio</a></p>' +
      "</form></div>"
    );
    var form = card.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]"); err.style.display = "none";
      if (CAPTCHA_KEY && !captchaToken) {
        err.textContent = "Espera a que termine la verificación de seguridad (la casilla de Cloudflare) e intenta de nuevo.";
        err.style.display = "block";
        return;
      }
      var btn = form.querySelector("button"); btn.disabled = true;
      var creds = { email: form.email.value.trim(), password: form.password.value };
      if (CAPTCHA_KEY) creds.options = { captchaToken: captchaToken };
      sb.auth.signInWithPassword(creds)
        .then(function (r) {
          if (r.error) throw r.error;
          return sb.from("profiles").select("role,active").eq("user_id", r.data.user.id).maybeSingle();
        })
        .then(function (p) {
          if (p.error || !p.data || !p.data.active) {
            return sb.auth.signOut().then(function () {
              throw new Error("Esta cuenta no tiene acceso. Contacta a LEF.");
            });
          }
          go(p.data.role);
        })
        .catch(function (er) {
          err.textContent = er.message === "Invalid login credentials"
            ? "Correo o contraseña incorrectos."
            : /captcha/i.test(er.message || "") ? "No pudimos completar la verificación de seguridad. Espera a que se marque la casilla e intenta de nuevo."
            : er.message;
          err.style.display = "block"; btn.disabled = false;
          resetCaptcha();
        });
    });
    app.appendChild(card);
    var cap = card.querySelector("[data-captcha]");
    if (cap) mountCaptcha(cap);
  }

  boot();
})();
