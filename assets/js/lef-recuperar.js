/* LEF — página de destino del enlace "¿Olvidaste tu contraseña?".
   El enlace del correo trae un token de recuperación; supabase-js lo canjea por
   una sesión temporal (detectSessionInUrl). Aquí el usuario fija su contraseña
   nueva; luego se cierra sesión y entra normal por /login (que aplica el resto
   de controles: MFA, etc.). */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var LEFSec = window.LEFSec;
  function h(html) { return LEFSec._h(html); }
  function esc(s) { return LEFSec._esc(s); }

  function card(inner) {
    app.innerHTML = "";
    app.appendChild(h('<div class="pnl-center"><div class="pnl-login">' +
      '<img class="logo" src="assets/logo-horizontal.png" alt="LEF">' + inner + "</div></div>"));
  }

  function invalidLink() {
    card(
      '<div class="pnl-alert err">Este enlace no es válido o ya venció.</div>' +
      '<p class="hint">Pide uno nuevo desde la pantalla de inicio de sesión.</p>' +
      '<a class="btn btn-dark" style="width:100%;justify-content:center" href="login.html">Ir a iniciar sesión</a>'
    );
  }

  function form() {
    card(
      '<p class="hint">Crea tu contraseña nueva.</p>' +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      LEFSec.passwordHintHtml() +
      '<label class="fld"><span>Nueva contraseña</span><input type="password" data-p1 autocomplete="new-password"></label>' +
      '<label class="fld"><span>Repite la contraseña</span><input type="password" data-p2 autocomplete="new-password"></label>' +
      '<button class="btn btn-dark" data-go style="width:100%;justify-content:center">Guardar contraseña</button>'
    );
    var root = app.querySelector(".pnl-login");
    var err = root.querySelector("[data-err]");
    var btn = root.querySelector("[data-go]");
    btn.addEventListener("click", function () {
      err.style.display = "none";
      var p1 = root.querySelector("[data-p1]").value;
      var p2 = root.querySelector("[data-p2]").value;
      var chk = LEFSec.checkPassword(p1);
      if (!chk.ok) { err.textContent = chk.msg; err.style.display = "block"; return; }
      if (p1 !== p2) { err.textContent = "Las contraseñas no coinciden."; err.style.display = "block"; return; }
      btn.disabled = true; btn.textContent = "Guardando…";
      sb.auth.updateUser({ password: p1 }).then(function (r) {
        if (r.error) throw r.error;
        return sb.rpc("mark_my_password_changed");
      }).then(function () {
        return sb.auth.signOut();
      }).then(function () {
        card('<div class="pnl-alert ok">Listo. Tu contraseña quedó actualizada.</div>' +
          '<a class="btn btn-dark" style="width:100%;justify-content:center" href="login.html">Iniciar sesión</a>');
      }).catch(function (e) {
        btn.disabled = false; btn.textContent = "Guardar contraseña";
        err.textContent = /same_password|different from the old/i.test(e.message || "")
          ? "La contraseña nueva debe ser distinta de la anterior."
          : (e.message || String(e));
        err.style.display = "block";
      });
    });
  }

  // El canje del token puede tardar un instante tras cargar.
  var settled = false;
  sb.auth.onAuthStateChange(function (event, session) {
    if (settled) return;
    if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) { settled = true; form(); }
  });
  setTimeout(function () {
    if (settled) return;
    sb.auth.getSession().then(function (r) {
      if (settled) return;
      settled = true;
      if (r.data.session) form(); else invalidLink();
    });
  }, 1200);
})();
