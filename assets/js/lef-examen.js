/* LEF — Examen de validación corregido (27 sep 2026).
   Lo usan el panel (el profesor revisa y califica las preguntas abiertas; "Ver
   respuestas" después del OK) y el portal (el estudiante ve su examen corregido
   desde la novedad del resultado y lo descarga en PDF).
     LEFExam.score(content, answers, manual)  → mismos cálculos que la base de datos
     LEFExam.render(content, answers, manual, opts) → nodo con el examen corregido
       opts.editable  → el profesor pone los puntos de las preguntas abiertas
       opts.onChange(manual, totales)
       opts.who       → "Tu respuesta" (estudiante) / "Respuesta del estudiante"
     LEFExam.pdf(datos) → descarga la evaluación en PDF (jsPDF, se carga al usarlo)
   Tipos de pregunta: "choice" (opción múltiple, se califica sola) y "text"
   (abierta: la califica el profesor). "heading" es un subtítulo. */
(function () {
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(n) { return String(Math.round(Number(n || 0) * 100) / 100); }
  function isQ(it) { return it.type === "choice" || it.type === "text"; }
  // Imagen de la pregunta: solo archivos de la plataforma (assets/…) o https.
  function imgSrc(it) { var u = it && it.image; return /^(assets\/[\w\/.-]+|https:\/\/)/.test(u || "") ? u : ""; }
  function imgHtml(it) { var u = imgSrc(it); return u ? '<img class="ex-q-img" src="' + esc(u) + '" alt="" loading="lazy">' : ""; }
  function manualOf(manual, id) {
    var v = manual ? manual[id] : null;
    return v === "" || v == null || isNaN(Number(v)) ? null : Number(v);
  }

  function score(content, answers, manual) {
    var out = { sections: [], correct: 0, total: 0, score: 0, max: 0, open: 0 };
    ((content && content.sections) || []).forEach(function (s) {
      var r = { title: s.title, correct: 0, total: 0, score: 0, max: 0, open: 0 };
      (s.items || []).filter(isQ).forEach(function (it) {
        var pts = Number(it.points || 1), a = answers ? answers[it.id] : null;
        r.total++; r.max += pts;
        if (it.type === "choice") {
          if (a != null && (it.correct || []).indexOf(Number(a)) > -1) { r.correct++; r.score += pts; }
        } else {
          var m = manualOf(manual, it.id);
          if (m == null) r.open++;
          else { m = Math.min(Math.max(m, 0), pts); r.score += m; if (m === pts) r.correct++; }
        }
      });
      if (r.total) out.sections.push(r);
      out.correct += r.correct; out.total += r.total; out.score += r.score; out.max += r.max; out.open += r.open;
    });
    return out;
  }

  function render(content, answers, manual, opts) {
    opts = opts || {};
    manual = Object.assign({}, manual || {});
    var who = opts.who || "Respuesta del estudiante";
    var root = h('<div class="exr"></div>');
    var secChips = [];
    function refresh() {
      var t = score(content, answers, manual);
      secChips.forEach(function (c, i) {
        var s = t.sections[i];
        if (s) c.textContent = num(s.score) + "/" + num(s.max) + " pts" + (s.open ? " · " + s.open + " por calificar" : "");
      });
      if (opts.onChange) opts.onChange(Object.assign({}, manual), t);
    }
    var qi = 0;
    ((content && content.sections) || []).forEach(function (s, si) {
      var hasQ = (s.items || []).some(isQ);
      var sec = h('<section class="exr-sec"><div class="exr-sec__top"><div><span class="exr-sec__k">Sección ' + (si + 1) + "</span>" +
        "<h2>" + esc(s.title) + "</h2></div>" + (hasQ ? '<span class="exr-sec__pts"></span>' : "") + "</div>" +
        (s.instructions ? '<p class="exr-sec__ins">' + esc(s.instructions) + "</p>" : "") +
        (s.passage ? '<details class="exr-passage"><summary>Ver la lectura</summary><div class="ex-passage">' + esc(s.passage) + "</div></details>" : "") +
        (s.youtube ? '<details class="exr-passage"><summary>Ver el audio</summary><div class="ex-video"><iframe src="https://www.youtube-nocookie.com/embed/' +
          esc(s.youtube) + '?rel=0" title="Audio" allowfullscreen loading="lazy"></iframe></div></details>' : "") + "</section>");
      if (hasQ) secChips.push(sec.querySelector(".exr-sec__pts"));
      (s.items || []).forEach(function (it) {
        if (it.type === "heading") { sec.appendChild(h('<p class="exr-head">' + esc(it.text) + "</p>")); return; }
        if (!isQ(it)) return;
        qi++;
        var pts = Number(it.points || 1), a = answers ? answers[it.id] : null;
        if (it.type === "choice") {
          var mine = a == null ? -1 : Number(a), ok = (it.correct || []).indexOf(mine) > -1;
          var q = h('<div class="exr-q ' + (ok ? "is-ok" : "is-bad") + '"><div class="exr-q__top"><p class="exr-q__t">' + esc(it.text) + "</p>" +
            '<span class="exr-badge">' + (ok ? "✓ Correcta" : "✗ Incorrecta") + " · " + (ok ? num(pts) : "0") + "/" + num(pts) + " pts</span></div>" + imgHtml(it) +
            '<ul class="exr-opts">' + (it.options || []).map(function (o, i) {
              var isC = (it.correct || []).indexOf(i) > -1, isM = i === mine;
              return '<li class="' + (isC ? "is-correct" : "") + (isM && !isC ? " is-wrong" : "") + '">' +
                '<span class="exr-opt__dot"></span><span class="exr-opt__t">' + esc(o) + "</span>" +
                (isM ? '<span class="exr-tag">' + esc(who) + "</span>" : "") +
                (isC && !isM ? '<span class="exr-tag is-ok">Correcta</span>' : "") + "</li>";
            }).join("") + "</ul></div>");
          sec.appendChild(q);
        } else {
          var m = manualOf(manual, it.id);
          var q2 = h('<div class="exr-q is-open"><div class="exr-q__top"><p class="exr-q__t">' + esc(it.text) + "</p>" +
            '<span class="exr-badge">' + (m == null ? "Por calificar" : num(m) + "/" + num(pts) + " pts") + "</span></div>" + imgHtml(it) +
            '<div class="exr-open"><span class="exr-open__k">' + esc(who) + "</span><p>" + esc(a || "(sin respuesta)") + "</p></div></div>");
          if (opts.editable) {
            var f = h('<label class="exr-grade"><span>Puntos para esta respuesta (0 a ' + num(pts) + ')</span>' +
              '<input type="number" min="0" max="' + pts + '" step="0.5" inputmode="decimal" value="' + (m == null ? "" : m) + '"></label>');
            var inp = f.querySelector("input"), badge = q2.querySelector(".exr-badge");
            inp.addEventListener("input", function () {
              var v = inp.value === "" ? null : Math.min(Math.max(Number(inp.value), 0), pts);
              if (v == null || isNaN(v)) delete manual[it.id]; else manual[it.id] = v;
              badge.textContent = v == null || isNaN(v) ? "Por calificar" : num(v) + "/" + num(pts) + " pts";
              refresh();
            });
            q2.appendChild(f);
          }
          sec.appendChild(q2);
        }
      });
      root.appendChild(sec);
    });
    setTimeout(refresh, 0);
    return root;
  }

  // ---------- PDF ----------
  var JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  function loadJsPdf() {
    if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise(function (ok, bad) {
      var s = document.createElement("script");
      s.src = JSPDF; s.onload = function () { ok(window.jspdf.jsPDF); };
      s.onerror = function () { bad(new Error("No se pudo preparar el PDF. Revisa tu conexión e intenta de nuevo.")); };
      document.head.appendChild(s);
    });
  }
  function logoData() {
    return fetch("assets/logo-horizontal.png").then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
  }
  // Las fuentes estándar del PDF solo traen Latin-1: se cambian los signos que no están.
  function pl(s) {
    return String(s == null ? "" : s).replace(/[—–]/g, "-").replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
      .replace(/→/g, "->").replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "");
  }

  // Imágenes de las preguntas para el PDF: { idPregunta: { data, w, h } } (si una
  // no carga, esa pregunta sale sin imagen).
  function itemImages(content) {
    var jobs = [];
    ((content && content.sections) || []).forEach(function (s) {
      (s.items || []).forEach(function (it) {
        var u = imgSrc(it);
        if (!u) return;
        jobs.push(fetch(u).then(function (r) { return r.blob(); }).then(function (b) {
          return new Promise(function (ok) { var fr = new FileReader(); fr.onload = function () { ok(fr.result); }; fr.readAsDataURL(b); });
        }).then(function (data) {
          return new Promise(function (ok) {
            var im = new Image();
            im.onload = function () { ok([it.id, { data: data, w: im.naturalWidth, h: im.naturalHeight }]); };
            im.onerror = function () { ok(null); };
            im.src = data;
          });
        }).catch(function () { return null; }));
      });
    });
    return Promise.all(jobs).then(function (list) {
      var out = {};
      list.forEach(function (x) { if (x) out[x[0]] = x[1]; });
      return out;
    });
  }

  function pdf(d) {
    return Promise.all([loadJsPdf(), logoData(), itemImages(d.content)]).then(function (res) {
      var JsPDF = res[0], logo = res[1], imgs = res[2];
      var doc = new JsPDF({ unit: "pt", format: "a4" });
      var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48, y = M;
      function need(hh) { if (y + hh > H - M) { doc.addPage(); y = M; } }
      function text(str, size, style, color, indent) {
        doc.setFont("helvetica", style || "normal"); doc.setFontSize(size); doc.setTextColor.apply(doc, color || [16, 16, 16]);
        var lines = doc.splitTextToSize(pl(str), W - 2 * M - (indent || 0));
        lines.forEach(function (ln) { need(size * 1.35); doc.text(ln, M + (indent || 0), y + size); y += size * 1.35; });
      }
      if (logo) { try { doc.addImage(logo, "PNG", M, y, 130, 130 * 157 / 697); y += 42; } catch (e) { /* sin logo */ } }
      text("Evaluación de validación", 11, "bold", [46, 78, 158]);
      text(d.title, 17, "bold");
      y += 4;
      text("Estudiante: " + d.student + "    ·    Módulo: " + d.module, 10, "normal", [77, 77, 77]);
      if (d.teacher || d.group) text((d.teacher ? "Profesor(a): " + d.teacher : "") + (d.group ? "    ·    Grupo: " + d.group : ""), 10, "normal", [77, 77, 77]);
      text("Presentado: " + d.submitted + (d.approved ? "    ·    Revisado: " + d.approved : ""), 10, "normal", [77, 77, 77]);
      y += 8;
      need(56);
      doc.setFillColor(245, 247, 251); doc.roundedRect(M, y, W - 2 * M, 50, 8, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(16, 16, 16);
      doc.text(num(d.score) + " / " + num(d.max), M + 16, y + 32);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(77, 77, 77);
      doc.text(pl("puntos  ·  " + d.correct + " de " + d.total + " respuestas correctas"), M + 130, y + 30);
      y += 64;
      (d.sectionsResult || []).forEach(function (s) {
        text("•  " + s.title + ": " + s.correct + " de " + s.total + " correctas  (" + num(s.score) + " de " + num(s.max) + " puntos)", 10.5);
      });
      y += 10;
      var n = 0;
      ((d.content && d.content.sections) || []).forEach(function (s, si) {
        y += 8;
        need(40);
        text("Sección " + (si + 1) + " - " + s.title, 13, "bold", [46, 78, 158]);
        if (s.instructions) text(s.instructions, 9.5, "italic", [110, 110, 110]);
        (s.items || []).forEach(function (it) {
          if (it.type === "heading") { y += 4; text(it.text, 10.5, "bold", [46, 78, 158]); return; }
          if (!isQ(it)) return;
          n++;
          var pts = Number(it.points || 1), a = d.answers ? d.answers[it.id] : null;
          y += 6;
          function drawImg() {
            var im = imgs[it.id];
            if (!im) return;
            var hh = Math.min(110, im.h), ww = im.w * hh / im.h;
            if (ww > W - 2 * M - 12) { ww = W - 2 * M - 12; hh = im.h * ww / im.w; }
            need(hh + 8);
            try { doc.addImage(im.data, /png/i.test(im.data.slice(0, 30)) ? "PNG" : "JPEG", M + 12, y + 2, ww, hh); y += hh + 8; } catch (e) { /* sin imagen */ }
          }
          if (it.type === "choice") {
            var mine = a == null ? -1 : Number(a), ok = (it.correct || []).indexOf(mine) > -1;
            text(it.text + "   [" + (ok ? "Correcta" : "Incorrecta") + " · " + (ok ? num(pts) : "0") + "/" + num(pts) + " pts]", 10.5, "bold", ok ? [31, 122, 68] : [138, 43, 43]);
            drawImg();
            text("Tu respuesta: " + (mine > -1 ? it.options[mine] : "(sin respuesta)"), 10, "normal", [16, 16, 16], 12);
            if (!ok) text("Respuesta correcta: " + (it.correct || []).map(function (i) { return it.options[i]; }).join(" / "), 10, "normal", [31, 122, 68], 12);
          } else {
            var m = manualOf(d.manual, it.id);
            text(it.text + "   [" + (m == null ? "Sin calificar" : num(m) + "/" + num(pts) + " pts") + "]", 10.5, "bold");
            drawImg();
            text("Tu respuesta: " + (a || "(sin respuesta)"), 10, "normal", [16, 16, 16], 12);
          }
        });
      });
      var pages = doc.internal.getNumberOfPages();
      for (var p = 1; p <= pages; p++) {
        doc.setPage(p); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(140, 140, 140);
        doc.text(pl("LEF · Learn English Fluently · www.lefcenter.com"), M, H - 24);
        doc.text("Página " + p + " de " + pages, W - M, H - 24, { align: "right" });
      }
      var safe = function (s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9.]+/g, "-").replace(/^-+|-+$/g, ""); };
      doc.save("Evaluacion-" + safe(d.module) + "-" + safe(d.student) + ".pdf");
    });
  }

  window.LEFExam = { score: score, render: render, pdf: pdf, num: num };
})();
