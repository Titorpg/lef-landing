/* LEF — cambio de contraseña obligatorio (parte 4, 23 sep 2026).
   Si profiles.must_change_password = true (cuenta nueva o contraseña
   restablecida por el admin), el panel y el portal muestran esta pantalla
   antes de cargar nada más. Al guardar: auth.updateUser + RPC
   mark_my_password_changed, y sigue a la app.

   Defensivo a propósito (el paquete 3d737a4 rompió el login de todos):
   - si la columna no existe, profile.must_change_password es undefined → no
     se obliga nada;
   - si la RPC falla, la contraseña ya quedó cambiada y se deja pasar igual
     (a lo sumo se vuelve a pedir en el próximo ingreso).

   Uso: LEFPrimerIngreso.check(sb, profile, appEl, continuar) */
(function () {
  "use strict";

  var PW_HINT = "Mínimo 12 caracteres, con mayúscula, minúscula, número y símbolo (por ejemplo ! @ # $ % * ? - _).";

  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
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
    if (/same_password|different from the old/i.test(m)) return "Debe ser distinta de la contraseña temporal que te enviamos.";
    return "No se pudo guardar la contraseña. Intenta de nuevo.";
  }

  // Tras cualquier cambio de contraseña hecho por la propia persona (Mi cuenta,
  // /recuperar): quita la marca. Nunca lanza.
  function markChanged(sb) {
    return Promise.resolve().then(function () { return sb.rpc("mark_my_password_changed"); })
      .then(function () {}, function () {});
  }

  function check(sb, profile, app, next) {
    if (!profile || profile.must_change_password !== true) return next();

    var first = String(profile.full_name || "").trim().split(/\s+/)[0];
    app.innerHTML = "";
    app.appendChild(h(
      '<div class="pnl-center"><div class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF — Learn English Fluently">' +
      '<p class="hint"><strong>' + (first ? "Hola, " + esc(first) + ". " : "") + 'Crea tu contraseña personal</strong><br>' +
      "Entraste con una contraseña temporal. Por seguridad, cámbiala por una tuya antes de continuar.<br><br>" + PW_HINT + "</p>" +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      '<label class="fld"><span>Nueva contraseña</span><input type="password" data-p1 autocomplete="new-password"></label>' +
      '<label class="fld"><span>Repite la contraseña</span><input type="password" data-p2 autocomplete="new-password"></label>' +
      '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Guardar y continuar</button>' +
      '<p class="back" style="margin-top:14px"><a href="#" data-out>Cerrar sesión</a></p>' +
      "</div></div>"
    ));
    var root = app.querySelector(".pnl-login");
    var err = root.querySelector("[data-err]");
    var btn = root.querySelector("[data-go]");
    root.querySelector("[data-out]").addEventListener("click", function (e) {
      e.preventDefault();
      sb.auth.signOut().then(function () { window.location.replace("login"); });
    });
    btn.addEventListener("click", function () {
      err.style.display = "none";
      var p1 = root.querySelector("[data-p1]").value;
      var p2 = root.querySelector("[data-p2]").value;
      // Casillas en rojo + mensaje con todo lo que falta (lef-password.js).
      var msg = window.LEFPassword ? window.LEFPassword.validate(root)
        : (checkPassword(p1) || (p1 !== p2 ? "Las contraseñas no coinciden." : ""));
      if (msg) { err.textContent = msg; err.style.display = "block"; return; }
      btn.disabled = true; btn.textContent = "Guardando…";
      sb.auth.updateUser({ password: p1 }).then(function (r) {
        if (r.error) throw r.error;
        return markChanged(sb);
      }).then(function () {
        profile.must_change_password = false;
        next();
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Guardar y continuar";
        err.textContent = pwErrorEs(e); err.style.display = "block";
      });
    });
  }

  window.LEFPrimerIngreso = { check: check, markChanged: markChanged };
})();
