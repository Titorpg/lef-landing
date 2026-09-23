/* LEF — página de destino del enlace "¿Olvidaste tu contraseña?" (/recuperar).
   El correo de Supabase (plantilla "recovery", diseño LEF) trae un enlace que
   Supabase canjea y redirige aquí con la sesión temporal en la URL; supabase-js
   la toma sola (detectSessionInUrl). El usuario fija su contraseña nueva, se
   cierra la sesión y entra normal por /login (con CAPTCHA).
   Autónoma a propósito: no depende de lef-security.js ni de RPCs del paquete
   revertido 3d737a4. Reglas de contraseña = las de la política de Supabase. */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var PW_HINT = "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo (por ejemplo ! @ # $ % * ? - _).";

  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
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
    if (/same_password|different from the old/i.test(m)) return "La contraseña nueva debe ser distinta de la anterior.";
    if (/session|jwt|expired/i.test(m)) return "El enlace venció mientras escribías. Pide uno nuevo desde la pantalla de inicio de sesión.";
    return "No se pudo guardar la contraseña. Intenta de nuevo.";
  }

  function card(inner) {
    app.innerHTML = "";
    app.appendChild(h('<div class="pnl-center"><div class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF — Learn English Fluently">' + inner + "</div></div>"));
    return app.querySelector(".pnl-login");
  }

  function invalidLink() {
    card(
      '<div class="pnl-alert err">Este enlace no es válido o ya venció.</div>' +
      '<p class="hint">Los enlaces para restablecer la contraseña duran 1 hora y sirven una sola vez. Pide uno nuevo desde la pantalla de inicio de sesión.</p>' +
      '<a class="btn btn-dark" style="width:100%;justify-content:center" href="login">Ir a iniciar sesión</a>'
    );
  }

  function form() {
    var root = card(
      '<p class="hint">Crea tu contraseña nueva.<br>' + PW_HINT + "</p>" +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      '<label class="fld"><span>Nueva contraseña</span><input type="password" data-p1 autocomplete="new-password"></label>' +
      '<label class="fld"><span>Repite la contraseña</span><input type="password" data-p2 autocomplete="new-password"></label>' +
      '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Guardar contraseña</button>'
    );
    var err = root.querySelector("[data-err]");
    var btn = root.querySelector("[data-go]");
    btn.addEventListener("click", function () {
      err.style.display = "none";
      var p1 = root.querySelector("[data-p1]").value;
      var p2 = root.querySelector("[data-p2]").value;
      var msg = checkPassword(p1) || (p1 !== p2 ? "Las contraseñas no coinciden." : "");
      if (msg) { err.textContent = msg; err.style.display = "block"; return; }
      btn.disabled = true; btn.textContent = "Guardando…";
      sb.auth.updateUser({ password: p1 }).then(function (r) {
        if (r.error) throw r.error;
        return sb.auth.signOut();
      }).then(function () {
        card('<div class="pnl-alert ok">Listo. Tu contraseña quedó actualizada.</div>' +
          '<p class="hint">Ya puedes entrar con tu contraseña nueva.</p>' +
          '<a class="btn btn-dark" style="width:100%;justify-content:center" href="login">Iniciar sesión</a>');
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Guardar contraseña";
        err.textContent = pwErrorEs(e); err.style.display = "block";
      });
    });
  }

  // Si Supabase rechazó el enlace, lo dice en la URL (#error=... / ?error=...).
  var urlInfo = (location.hash || "") + "&" + (location.search || "");
  if (/error(_code)?=/.test(urlInfo)) { invalidLink(); return; }

  // El canje del token puede tardar un instante tras cargar.
  var settled = false;
  sb.auth.onAuthStateChange(function (event, session) {
    if (settled) return;
    if (session && event === "PASSWORD_RECOVERY") { settled = true; form(); }
  });
  setTimeout(function () {
    if (settled) return;
    sb.auth.getSession().then(function (r) {
      if (settled) return;
      settled = true;
      if (r.data.session) form(); else invalidLink();
    });
  }, 1500);
})();
