/* LEF — inicio de sesión único.
   Una sola puerta para admin, profesores y estudiantes.
   Tras autenticar, enruta según profiles.role:
     admin / teacher  -> admin.html
     student          -> portal.html */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }

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
      '<button class="btn btn-dark" style="width:100%;justify-content:center" type="submit">Ingresar</button>' +
      '<p class="back"><a href="index.html">&larr; Volver al sitio</a></p>' +
      "</form></div>"
    );
    var form = card.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]"); err.style.display = "none";
      var btn = form.querySelector("button"); btn.disabled = true;
      sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value })
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
            ? "Correo o contraseña incorrectos." : er.message;
          err.style.display = "block"; btn.disabled = false;
        });
    });
    app.appendChild(card);
  }

  boot();
})();
