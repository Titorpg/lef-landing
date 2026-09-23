/* LEF — casillas de contraseña más fáciles de usar (23 sep 2026).
   A TODO <input type="password"> de la página (también los que se crean
   después, p. ej. dentro de modales o al cambiar de pantalla) le agrega:
   - puntos grandes, en negrita y espaciados, fáciles de contar (CSS en
     lef-panel.css → .pw-wrap);
   - un ojito a la derecha para ver/ocultar lo escrito;
   - solo en las casillas de contraseña NUEVA (autocomplete="new-password"):
     contador "n/12" que se pone verde al llegar al mínimo de la política.
     En el login NO hay contador (decisión del usuario: para confirmar lo
     escrito está el ojito).
   Se carga en login, recuperar, admin y portal antes del resto de scripts. */
(function () {
  "use strict";

  var MIN = 12; // mínimo de la política de contraseñas de Supabase
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function enhance(input) {
    if (input.hasAttribute("data-pw-enh")) return;
    input.setAttribute("data-pw-enh", "1");
    var isNew = input.getAttribute("autocomplete") === "new-password";

    var wrap = document.createElement("div");
    wrap.className = "pw-wrap" + (isNew ? " pw-has-count" : "");
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    var count = null;
    if (isNew) {
      count = document.createElement("small");
      count.className = "pw-count";
      count.setAttribute("aria-live", "polite");
      wrap.appendChild(count);
    }

    var btn = document.createElement("button");
    btn.type = "button"; // nunca envía el formulario
    btn.className = "pw-eye";
    wrap.appendChild(btn);

    function paintEye() {
      var shown = input.type === "text";
      btn.innerHTML = shown ? EYE_OFF : EYE;
      btn.setAttribute("aria-label", shown ? "Ocultar contraseña" : "Mostrar contraseña");
      btn.title = shown ? "Ocultar contraseña" : "Mostrar contraseña";
      wrap.classList.toggle("pw-shown", shown);
    }
    function paintCount() {
      if (!count) return;
      var n = input.value.length;
      if (!n) { count.textContent = ""; count.className = "pw-count"; return; }
      count.textContent = n + "/" + MIN;
      count.className = "pw-count" + (n >= MIN ? " ok" : " short");
      count.title = n + (n === 1 ? " carácter" : " caracteres");
    }

    // mousedown sin foco: el cursor se queda en la casilla (y en el celular no se cierra el teclado).
    btn.addEventListener("mousedown", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation(); // estamos dentro de <label>: que no reenvíe el clic
      var pos = input.selectionStart;
      input.type = input.type === "password" ? "text" : "password";
      paintEye();
      try { input.focus(); if (pos != null) input.setSelectionRange(pos, pos); } catch (er) { /* noop */ }
    });
    input.addEventListener("input", paintCount);
    input._lefPwPaint = paintCount;
    paintEye(); paintCount();
  }

  // Si el código de la página vacía o llena la casilla (value = ""), no se
  // dispara "input": se revisa el largo cada medio segundo (barato).
  setInterval(function () {
    var list = document.querySelectorAll("input[data-pw-enh]");
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el._lefPwLen !== el.value.length) { el._lefPwLen = el.value.length; if (el._lefPwPaint) el._lefPwPaint(); }
    }
  }, 500);

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type="password"]')) enhance(root);
    var list = root.querySelectorAll('input[type="password"]');
    for (var i = 0; i < list.length; i++) enhance(list[i]);
  }

  function start() {
    scan(document.body);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) scan(added[j]);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
