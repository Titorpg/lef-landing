/* LEF — Motor de los talleres interactivos (26 sep 2026).
 * Lo usan el portal del estudiante (Mis recursos → Talleres) y el panel del admin
 * (Recursos compartidos → Talleres, vista previa).
 *
 * LEFTaller.render(contenedor, T)  dibuja el taller con el diseño de la plataforma.
 * LEFTaller.extract(textoHTML, módulo) lee un HTML de taller hecho con la plantilla
 *   LEF (bloque "const TALLER = {…}", como el de A1.1 semana 1) y devuelve su
 *   contenido como datos, o null si el HTML no usa la plantilla (entonces se
 *   muestra tal cual, dentro de un marco). El bloque se evalúa en un iframe
 *   aislado (sandbox), nunca en la página.
 * LEFTaller.kind(nombreArchivo)    html | pdf | word | ppt | excel | null.
 */
(function () {
  "use strict";
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var ICONS = {
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  function mcIc(n) {
    return '<svg class="mc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[n] || "") + "</svg>";
  }

  // Motor del taller (misma lógica del HTML original del usuario, 26 sep 2026):
  // opción ("choice") o escribir ("write"); cada parte se revisa completa (avisa
  // si falta alguna respuesta), marca ✓/✗ con la explicación, y se puede
  // reintentar. Barra de progreso por parte y puntaje final con mensaje.
  // El contenido (preguntas y explicaciones) lo escribe LEF: trae <b> a propósito.
  function render(body, T) {
    var norm = function (s) { return String(s).toLowerCase().replace(/[’‘`´]/g, "'").replace(/[.!?]+$/, "").replace(/\s+/g, " ").trim(); };
    var state = T.parts.map(function (p) {
      return { checked: false, correct: 0, total: p.exercises.reduce(function (n, e) { return n + e.items.length; }, 0) };
    });
    var wrap = h('<div class="tw"></div>');
    var hero = h('<div class="tw-hero"><span class="tw-hero__ic">' + mcIc("pencil") + "</span>" +
      '<div class="tw-hero__main"><p class="tw-hero__k">' + esc(T.level) + " · " + esc(T.title) + "</p>" +
      '<h2 class="tw-hero__t">' + esc(T.topic) + "</h2>" +
      '<p class="tw-hero__how">Responde, revisa y vuelve a intentarlo las veces que quieras.' + (T.duration ? " Tiempo aproximado: " + esc(T.duration) + "." : "") + "</p>" +
      '<div class="tw-prog" data-prog>' + T.parts.map(function () { return "<span></span>"; }).join("") + "</div>" +
      '<p class="tw-prog__l" data-prog-l></p></div></div>');
    wrap.appendChild(hero);
    var prog = hero.querySelector("[data-prog]"), progL = hero.querySelector("[data-prog-l]");
    var fin = h('<div class="tw-final" aria-live="polite" hidden><span class="tw-final__ic">' + mcIc("check") + '</span><div><div class="tw-final__big" data-fs></div><p data-fm></p></div></div>');

    T.parts.forEach(function (part, pi) {
      var sec = h('<section class="tw-part"><div class="tw-part__head"><span class="tw-part__n">Parte ' + (pi + 1) + "</span><h3>" + part.title + "</h3></div></section>");
      part.exercises.forEach(function (ex, ei) {
        var html = '<div class="tw-ex">';
        if (ex.reading) html += '<div class="tw-reading">' + ex.reading.map(function (p) { return "<p>" + p + "</p>"; }).join("") + "</div>";
        html += '<p class="tw-ex__ins">' + ex.ins + '</p><p class="tw-ex__help">' + ex.help + "</p>";
        ex.items.forEach(function (it, ii) {
          html += '<div class="tw-item" data-e="' + ei + '" data-i="' + ii + '">' +
            '<div class="tw-q"><span class="tw-q__n">' + (ii + 1) + '.</span><span class="tw-q__t">' + it.q + '</span><span class="tw-q__mark" aria-hidden="true"></span></div>';
          if (ex.type === "choice") {
            html += '<div class="tw-opts" role="group" aria-label="Opciones para la pregunta ' + (ii + 1) + '">' +
              ex.options.map(function (o) { return '<button type="button" class="tw-opt" data-v="' + esc(o) + '">' + esc(o) + "</button>"; }).join("") + "</div>";
          } else {
            html += '<input class="tw-write" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Respuesta ' + (ii + 1) + '" placeholder="Escribe aquí">';
          }
          html += '<div class="tw-why"></div></div>';
        });
        sec.appendChild(h(html + "</div>"));
      });
      var act = h('<div class="tw-acts"><button type="button" class="btn btn-dark" data-act="check">Revisar respuestas</button>' +
        '<span class="tw-score" aria-live="polite"></span><span class="tw-err" aria-live="polite"></span></div>');
      sec.appendChild(act);
      wrap.appendChild(sec);

      sec.addEventListener("click", function (e) {
        var opt = e.target.closest(".tw-opt");
        if (opt && !state[pi].checked) {
          opt.parentElement.querySelectorAll(".tw-opt").forEach(function (b) { b.classList.remove("is-sel"); });
          opt.classList.add("is-sel");
          act.querySelector(".tw-err").textContent = "";
          return;
        }
        var btn = e.target.closest("[data-act]");
        if (!btn) return;
        if (btn.dataset.act === "check") checkPart(pi, sec, act); else resetPart(pi, sec, act);
      });
      sec.addEventListener("input", function () { act.querySelector(".tw-err").textContent = ""; });
    });
    wrap.appendChild(fin);
    body.appendChild(wrap);

    function answerOf(el, ex) {
      if (ex.type === "choice") { var s = el.querySelector(".tw-opt.is-sel"); return s ? s.dataset.v : ""; }
      return el.querySelector(".tw-write").value;
    }

    function checkPart(pi, sec, act) {
      var part = T.parts[pi];
      var items = [].slice.call(sec.querySelectorAll(".tw-item"));
      var missing = items.filter(function (el) { return !answerOf(el, part.exercises[el.dataset.e]).trim(); }).length;
      if (missing) {
        act.querySelector(".tw-err").textContent = missing === 1 ? "Te falta 1 respuesta. Complétala antes de revisar." : "Te faltan " + missing + " respuestas. Complétalas antes de revisar.";
        return;
      }
      var ok = 0;
      items.forEach(function (el) {
        var ex = part.exercises[el.dataset.e], it = ex.items[el.dataset.i];
        var val = answerOf(el, ex);
        var good = ex.type === "choice" ? val === it.a : it.a.map(norm).indexOf(norm(val)) >= 0;
        el.classList.add(good ? "is-ok" : "is-bad");
        el.querySelector(".tw-q__mark").innerHTML = mcIc(good ? "check" : "x");
        if (!good) el.querySelector(".tw-why").innerHTML = (ex.type === "choice" ? "Respuesta correcta: <b>" + esc(it.a) + "</b>. " : "Respuesta correcta: ") + it.why;
        el.querySelectorAll(".tw-opt,.tw-write").forEach(function (x) { x.disabled = true; });
        if (good) ok++;
      });
      state[pi].checked = true; state[pi].correct = ok;
      act.querySelector(".tw-score").textContent = ok + " de " + items.length + " correctas";
      var b = act.querySelector("[data-act]");
      b.dataset.act = "reset"; b.textContent = "Intentar de nuevo"; b.className = "btn btn-ghost";
      updateProgress();
    }

    function resetPart(pi, sec, act) {
      sec.querySelectorAll(".tw-item").forEach(function (el) {
        el.classList.remove("is-ok", "is-bad");
        el.querySelector(".tw-q__mark").innerHTML = "";
        el.querySelector(".tw-why").innerHTML = "";
        el.querySelectorAll(".tw-opt").forEach(function (o) { o.classList.remove("is-sel"); o.disabled = false; });
        var w = el.querySelector(".tw-write"); if (w) { w.value = ""; w.disabled = false; }
      });
      state[pi].checked = false; state[pi].correct = 0;
      act.querySelector(".tw-score").textContent = "";
      var b = act.querySelector("[data-act]");
      b.dataset.act = "check"; b.textContent = "Revisar respuestas"; b.className = "btn btn-dark";
      updateProgress();
    }

    function updateProgress() {
      var done = state.filter(function (s) { return s.checked; }).length;
      [].slice.call(prog.children).forEach(function (s, i) { s.classList.toggle("is-done", state[i].checked); });
      progL.textContent = done + " de " + state.length + " partes revisadas";
      if (done === state.length) {
        var c = state.reduce(function (n, s) { return n + s.correct; }, 0), t = state.reduce(function (n, s) { return n + s.total; }, 0);
        var pct = Math.round(c / t * 100), M = T.messages || {};
        fin.querySelector("[data-fs]").innerHTML = c + "/" + t + " <small>" + pct + "%</small>";
        fin.querySelector("[data-fm]").textContent = pct >= 90 ? M.high : pct >= 70 ? M.mid : M.low;
        fin.hidden = false;
      } else fin.hidden = true;
    }
    updateProgress();
  }

  // ---------- Leer un HTML de taller hecho con la plantilla LEF ----------
  function valid(T) {
    return T && Array.isArray(T.parts) && T.parts.length && T.parts.every(function (p) {
      return p && Array.isArray(p.exercises) && p.exercises.every(function (e) {
        return e && Array.isArray(e.items) && (e.type === "write" || Array.isArray(e.options));
      });
    });
  }
  function extract(text, level) {
    var m = /const\s+TALLER\s*=\s*(\{[\s\S]*?\n\});/.exec(text || "");
    if (!m) return Promise.resolve(null);
    var lit = m[1].replace(/<\/script/gi, "<\\/script");
    return new Promise(function (resolve) {
      var fr = document.createElement("iframe");
      fr.setAttribute("sandbox", "allow-scripts");
      fr.style.display = "none";
      var done = false, timer = null;
      function finish(v) {
        if (done) return; done = true;
        clearTimeout(timer);
        window.removeEventListener("message", onMsg);
        fr.remove();
        resolve(v);
      }
      function onMsg(e) {
        if (e.source !== fr.contentWindow || !e.data || !("lefTaller" in e.data)) return;
        var T = null;
        try { T = e.data.lefTaller ? JSON.parse(e.data.lefTaller) : null; } catch (x) { T = null; }
        if (!valid(T)) return finish(null);
        // Mensajes finales y tiempo aproximado, tal como los trae el HTML.
        var mm = /pct\s*>=\s*90\s*\?\s*"([^"]*)"\s*:\s*pct\s*>=\s*70\s*\?\s*"([^"]*)"\s*:\s*"([^"]*)"/.exec(text);
        var dm = /Tiempo aproximado:\s*([^<.]+)/.exec(text);
        // El molde (assets/plantillas/taller-molde-lef.html) los trae en el bloque:
        // tiempo y mensajes {alto, medio, bajo}; el taller original, en el código.
        var M = T.mensajes || {};
        finish({
          level: level || T.level || "", title: T.title || "Taller", topic: T.topic || "",
          duration: T.tiempo || (dm ? dm[1].trim() : ""),
          messages: (M.alto && M.medio && M.bajo) ? { high: M.alto, mid: M.medio, low: M.bajo } : mm ? { high: mm[1], mid: mm[2], low: mm[3] } : {
            high: "¡Excelente trabajo! Dominas los temas de este taller.",
            mid: "¡Muy bien! Revisa los ítems marcados con ✗ e inténtalo otra vez.",
            low: "Repasa el tema en tu libro y vuelve a hacer el taller."
          },
          parts: T.parts
        });
      }
      window.addEventListener("message", onMsg);
      fr.srcdoc = "<script>try{var T=(" + lit + ");parent.postMessage({lefTaller:JSON.stringify(T)},\"*\")}catch(e){parent.postMessage({lefTaller:null},\"*\")}<\/script>";
      document.body.appendChild(fr);
      timer = setTimeout(function () { finish(null); }, 4000);
    });
  }

  function kind(name) {
    var ext = String(name || "").toLowerCase().split(".").pop();
    return ({ html: "html", htm: "html", pdf: "pdf", doc: "word", docx: "word", ppt: "ppt", pptx: "ppt", xls: "excel", xlsx: "excel" })[ext] || null;
  }

  var KIND_LABEL = { html: "HTML", pdf: "PDF", word: "Word", ppt: "PowerPoint", excel: "Excel" };
  function label(w) { return w.content ? "Taller interactivo" : (KIND_LABEL[w.file_type] || "Archivo"); }

  // Muestra un taller guardado (fila de la tabla workshops) dentro de "body":
  //   * con content (HTML con la plantilla LEF) → el taller con el diseño de la plataforma;
  //   * otro HTML → tal cual, en un marco aislado (sandbox);
  //   * PDF → el visor del navegador; Word/PowerPoint/Excel → el visor de Office.
  // storage = cliente de Supabase Storage (sb.storage). El enlace del archivo es
  // temporal (1 hora) y solo se entrega a quien tiene permiso (reglas del bucket).
  function show(body, w, storage) {
    body.innerHTML = "";
    if (w.content) { render(body, w.content); return Promise.resolve(); }
    var bucket = storage.from("talleres");
    if (w.file_type === "html") {
      body.innerHTML = '<p class="muted">Cargando el taller…</p>';
      return bucket.download(w.file_path).then(function (r) {
        if (r.error) throw r.error;
        return r.data.text();
      }).then(function (text) {
        body.innerHTML = "";
        var fr = document.createElement("iframe");
        fr.className = "tw-frame";
        fr.setAttribute("sandbox", "allow-scripts allow-forms allow-popups allow-modals");
        fr.setAttribute("title", w.title);
        fr.srcdoc = text;
        body.appendChild(fr);
      }).catch(function () { body.innerHTML = '<div class="pnl-alert err">No pudimos abrir el taller. Intenta de nuevo en unos minutos.</div>'; });
    }
    body.innerHTML = '<p class="muted">Cargando el archivo…</p>';
    return bucket.createSignedUrl(w.file_path, 3600).then(function (r) {
      if (r.error) throw r.error;
      var url = r.data.signedUrl;
      var viewer = w.file_type === "pdf" ? url : "https://view.officeapps.live.com/op/embed.aspx?src=" + encodeURIComponent(url);
      body.innerHTML = "";
      body.appendChild(h('<div class="tw-file-bar"><span>' + esc(w.file_name) + "</span>" +
        '<a class="btn btn-sm btn-ghost" href="' + esc(url) + '" target="_blank" rel="noopener" download="' + esc(w.file_name) + '">Descargar</a></div>'));
      var fr = document.createElement("iframe");
      fr.className = "tw-frame";
      fr.setAttribute("title", w.title);
      fr.src = viewer;
      body.appendChild(fr);
    }).catch(function () { body.innerHTML = '<div class="pnl-alert err">No pudimos abrir el archivo. Intenta de nuevo en unos minutos.</div>'; });
  }

  window.LEFTaller = { render: render, extract: extract, kind: kind, show: show, label: label };
})();
