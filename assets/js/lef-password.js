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
   - validación en vivo en las casillas de contraseña NUEVA: borde rojo +
     aviso de lo que falta (o "no coincide" en la casilla de confirmar);
     borde verde cuando cumple. La 1ª casilla nueva de cada bloque es la
     contraseña; las siguientes del mismo bloque, la confirmación.
   - window.LEFPassword.validate(bloque): lo llaman los botones "Guardar";
     marca en rojo, enfoca la casilla con problema y devuelve el texto
     completo del error ("" si todo está bien) para mostrarlo en una alerta
     roja con LEFPassword.say(el, texto, "err").
   Se carga en login, recuperar, admin y portal antes del resto de scripts. */
(function () {
  "use strict";

  var MIN = 12; // mínimo de la política de contraseñas de Supabase
  var EYE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  /* ---------- reglas (las mismas de la política de Supabase) ---------- */
  function missing(pw) {
    pw = String(pw || "");
    var out = [];
    if (pw.length < MIN) {
      var f = MIN - pw.length;
      out.push(f === 1 ? "1 carácter más" : f + " caracteres más");
    }
    if (!/[A-Z]/.test(pw)) out.push("una letra mayúscula");
    if (!/[a-z]/.test(pw)) out.push("una letra minúscula");
    if (!/[0-9]/.test(pw)) out.push("un número");
    if (!/[^A-Za-z0-9]/.test(pw)) out.push("un símbolo (! @ # $ % * ? - _)");
    return out;
  }
  function joinEs(list) {
    return list.length <= 1 ? list.join("") : list.slice(0, -1).join(", ") + " y " + list[list.length - 1];
  }

  // Bloque = el formulario/tarjeta/recuadro donde vive la casilla.
  function blockOf(input) {
    return input.closest("form, .pnl-login, .pnl-modal, .pnl-table-wrap") || document.body;
  }
  function newInputs(block) {
    return Array.prototype.slice.call(block.querySelectorAll("input[data-pw-new]"));
  }
  // Estado de UNA casilla nueva: "" si está bien, o el texto del problema.
  function problemOf(input, forSave) {
    var list = newInputs(blockOf(input));
    var idx = list.indexOf(input);
    var v = input.value;
    if (idx <= 0) {
      if (!v) return forSave ? "Escribe la contraseña nueva." : "";
      var miss = missing(v);
      return miss.length ? "Falta: " + miss.join(" · ") : "";
    }
    if (!v) return forSave ? "Repite la contraseña nueva en la segunda casilla." : "";
    return v !== list[0].value ? "No coincide con la contraseña de arriba." : "";
  }
  function paintState(input, forSave) {
    var wrap = input.parentNode;
    var warn = wrap.nextElementSibling && wrap.nextElementSibling.classList.contains("pw-warn") ? wrap.nextElementSibling : null;
    var prob = problemOf(input, forSave);
    wrap.classList.toggle("pw-bad", !!prob);
    wrap.classList.toggle("pw-good", !prob && !!input.value);
    if (warn) { warn.textContent = prob; warn.style.display = prob ? "block" : "none"; }
    return prob;
  }
  function repaintBlock(input) {
    newInputs(blockOf(input)).forEach(function (el) { paintState(el, false); });
  }

  function enhance(input) {
    if (input.hasAttribute("data-pw-enh")) return;
    input.setAttribute("data-pw-enh", "1");
    var isNew = input.getAttribute("autocomplete") === "new-password";
    if (isNew) input.setAttribute("data-pw-new", "1");

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

    if (isNew) {
      // <small> y no <span>: label.fld span tiene estilo de título.
      var warn = document.createElement("small");
      warn.className = "pw-warn";
      warn.setAttribute("role", "alert");
      warn.style.display = "none";
      wrap.parentNode.insertBefore(warn, wrap.nextSibling);
    }

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
    if (isNew) input.addEventListener("input", function () { repaintBlock(input); });
    input._lefPwPaint = function () { paintCount(); if (isNew) repaintBlock(input); };
    paintEye(); paintCount();
  }

  /* ---------- API para los botones "Guardar" ---------- */
  // Valida las casillas nuevas del bloque; marca en rojo y enfoca la primera
  // con problema. Devuelve el mensaje completo para la alerta roja, o "".
  function validate(block) {
    var list = newInputs(block || document.body);
    if (!list.length) return "";
    var first = null, msg = "";
    list.forEach(function (el, i) {
      var prob = paintState(el, true);
      if (prob && !first) {
        first = el;
        if (i === 0 && el.value) {
          msg = "La contraseña no cumple los requisitos. Le falta: " + joinEs(missing(el.value)) +
            ". Debe tener mínimo " + MIN + " caracteres, con mayúscula, minúscula, número y símbolo.";
        } else {
          msg = prob === "No coincide con la contraseña de arriba."
            ? "Las contraseñas no coinciden: escribe exactamente la misma en las dos casillas."
            : prob;
        }
      }
    });
    if (first) { try { first.focus(); } catch (e) { /* noop */ } }
    return msg;
  }
  // Mensaje bajo el botón: "err" = alerta roja, "ok" = verde, otro = texto gris.
  function say(el, text, kind) {
    if (!el) return;
    el.textContent = text || "";
    el.className = kind === "err" ? "pnl-alert err pw-say" : kind === "ok" ? "pnl-alert ok pw-say" : "muted pw-say";
    el.style.display = text ? "" : "none";
  }
  window.LEFPassword = { validate: validate, say: say, missing: missing };

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
