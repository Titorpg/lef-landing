/* LEF — Informe de progreso académico (plantilla de prueba, 30 sep 2026).
   Réplica de PLANTILLA_INFORME_PROGRESO.docx: el profesor solo marca
   Inicial / En proceso / Logrado / Destacado en cada habilidad y la plataforma
   redacta las observaciones y las recomendaciones con frases armadas por reglas
   (sin IA): cada texto depende de lo marcado, del nombre y del nivel.
     LEFInforme.TEMPLATE              → secciones y habilidades
     LEFInforme.generate(answers, ctx) → { part, speaking, writing, recom }
       ctx: { name, level, pct, seed }  (seed cambia la redacción, no el sentido)
     LEFInforme.render(opts)           → nodo con el informe (hoja)
       opts.meta { student, level, cycle, teacher, date }
       opts.answers {skillId: 1..4}   opts.texts (guardados; si no, se generan)
       opts.editable  → botones que se activan al clic
       opts.pct (null = sin resultado) · opts.examNote · opts.note (anotación)
       opts.seed · opts.onChange(answers, texts) */
(function () {
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var LEVELS = [
    { v: 1, t: "Inicial" }, { v: 2, t: "En proceso" }, { v: 3, t: "Logrado" }, { v: 4, t: "Destacado" }
  ];

  // Frases cortas (1 oct 2026: el usuario pidió textos más concisos) y dirigidas
  // al estudiante por su nombre (el informe lo leerá el estudiante; el docente le habla).
  // s = fortaleza (3 y 4) · w = cómo está (1 y 2) · a = qué se recomienda (1 y 2)
  // goal = meta del siguiente ciclo si está bajo · up = meta para pasar de Logrado a Destacado
  var SKILLS = {
    asistencia: { t: "Asistencia", d: "Regularidad en las sesiones del ciclo", n: "la asistencia",
      s: { 4: "asiste con total regularidad", 3: "mantiene una asistencia regular" },
      w: { 2: "algunas ausencias han interrumpido la continuidad de su proceso", 1: "sus ausencias frecuentes han limitado su avance" },
      a: { 2: "asistir a todas las sesiones y repasar el material de las que pierda", 1: "priorizar la asistencia y recuperar con su docente los temas perdidos" },
      goal: "asistir a todas las sesiones y repasar las que pierda",
      up: "llegar a cada clase con la anterior repasada" },
    participacion: { t: "Participación", d: "Iniciativa para intervenir en clase", n: "la participación",
      s: { 4: "interviene por iniciativa propia", 3: "participa cuando se le invita" },
      w: { 2: "interviene sobre todo cuando se le pide", 1: "sus intervenciones aún son escasas" },
      a: { 2: "intervenir de forma voluntaria al menos una vez por clase", 1: "empezar con intervenciones cortas y preparadas para ganar seguridad" },
      goal: "intervenir voluntariamente en cada clase",
      up: "liderar la conversación en las actividades en parejas" },
    actitud: { t: "Actitud y motivación", d: "Disposición y compromiso durante las actividades", n: "la actitud",
      s: { 4: "muestra una actitud ejemplar", 3: "muestra buena disposición" },
      w: { 2: "su disposición varía de una sesión a otra", 1: "se observa poca disposición de su parte ante las actividades" },
      a: { 2: "fijarse metas semanales cortas para sostener la motivación", 1: "conversar con su docente sobre sus intereses y dificultades" },
      goal: "seguir una rutina semanal de estudio con metas concretas",
      up: "proponer temas de su interés para practicar" },
    fluidez: { t: "Fluidez y confianza", d: "Habla sin bloqueos frecuentes", n: "la fluidez",
      s: { 4: "se expresa con soltura", 3: "se comunica con relativa fluidez" },
      w: { 2: "aún presenta pausas y bloqueos frecuentes", 1: "le cuesta sostener un intercambio oral sin apoyo" },
      a: { 2: "practicar en voz alta fuera de clase, por ejemplo con audios breves", 1: "ensayar a diario en voz alta frases de uso frecuente" },
      goal: "grabar cada semana un audio corto sobre un tema del módulo",
      up: "participar en el Conversation Club para hablar con más soltura" },
    estructuras: { t: "Uso de estructuras", d: "Aplica las estructuras gramaticales del nivel", n: "las estructuras gramaticales",
      s: { 4: "aplica con precisión las estructuras del nivel", 3: "usa correctamente las estructuras trabajadas" },
      w: { 2: "las aplica correctamente solo en ocasiones", 1: "aún no logra incorporarlas al hablar" },
      a: { 2: "usar las estructuras del módulo en frases propias", 1: "reforzar las estructuras básicas con ejercicios guiados" },
      goal: "crear cinco oraciones propias con cada estructura nueva",
      up: "combinar varias estructuras en una misma intervención" },
    vocabOral: { t: "Vocabulario activo", d: "Usa el vocabulario trabajado en clase", n: "el vocabulario oral",
      s: { 4: "usa con naturalidad el vocabulario de clase", 3: "usa adecuadamente el vocabulario de clase" },
      w: { 2: "reconoce las palabras de clase, pero aún las usa poco", 1: "dispone de pocas palabras para expresarse" },
      a: { 2: "usar cada semana las palabras nuevas en frases propias", 1: "repasar el vocabulario de cada clase con tarjetas o aplicaciones" },
      goal: "incorporar al habla diez palabras nuevas por semana",
      up: "usar sinónimos y expresiones más precisas" },
    pronunciacion: { t: "Pronunciación", d: "Inteligibilidad general al hablar", n: "la pronunciación",
      s: { 4: "pronuncia con claridad", 3: "tiene una pronunciación inteligible" },
      w: { 2: "algunos errores dificultan por momentos que se le entienda", 1: "los errores dificultan con frecuencia que se le entienda" },
      a: { 2: "escuchar y repetir audios cortos imitando la entonación", 1: "practicar a diario los sonidos básicos con escucha y repetición" },
      goal: "practicar shadowing con audios del módulo tres veces por semana",
      up: "trabajar la entonación y el enlace entre palabras" },
    oraciones: { t: "Construcción de oraciones", d: "Coherencia y correcta sintaxis escrita", n: "la construcción de oraciones",
      s: { 4: "redacta oraciones coherentes y bien ordenadas", 3: "construye oraciones claras" },
      w: { 2: "algunas de sus oraciones presentan problemas de orden o coherencia", 1: "presenta dificultades frecuentes de orden y sentido al escribir" },
      a: { 2: "revisar el orden sujeto–verbo–complemento antes de entregar", 1: "escribir oraciones cortas a partir de modelos" },
      goal: "escribir un párrafo corto por semana y revisarlo con su docente",
      up: "enlazar ideas con conectores como because, but o so" },
    vocabEscrito: { t: "Uso de vocabulario", d: "Aplica el vocabulario del ciclo por escrito", n: "el vocabulario escrito",
      s: { 4: "emplea un vocabulario variado y preciso", 3: "aplica por escrito el vocabulario del ciclo" },
      w: { 2: "aún resulta repetitivo o poco preciso", 1: "las palabras del ciclo aún no aparecen en sus escritos" },
      a: { 2: "incluir palabras nuevas del módulo en cada escrito", 1: "completar oraciones modelo con el vocabulario de la clase" },
      goal: "usar cinco palabras nuevas del módulo en cada escrito",
      up: "variar el vocabulario escrito con sinónimos" },
    ortografia: { t: "Ortografía y puntuación", d: "Precisión en la forma escrita", n: "la ortografía y la puntuación",
      s: { 4: "escribe con precisión ortográfica", 3: "comete pocos errores de ortografía" },
      w: { 2: "aún comete algunos errores por corregir", 1: "comete errores con frecuencia" },
      a: { 2: "releer cada texto antes de entregarlo", 1: "anotar las palabras en que se equivoca y practicarlas" },
      goal: "revisar su lista de errores frecuentes antes de cada entrega",
      up: "cuidar la puntuación en textos más largos" },
    auditiva: { t: "Comprensión auditiva", d: "Extrae información clave al escuchar", n: "la comprensión auditiva",
      s: { 4: "comprende con facilidad los audios del nivel", 3: "extrae la idea principal de los audios" },
      w: { 2: "capta la idea general, pero se le escapan detalles", 1: "aún le cuesta extraer información al escuchar" },
      a: { 2: "escuchar cada audio dos veces: primero la idea general y luego los detalles", 1: "escuchar inglés a diario con audios lentos o subtitulados" },
      goal: "escuchar inglés quince minutos al día y anotar las ideas principales",
      up: "practicar con audios a velocidad natural y sin subtítulos" },
    lectora: { t: "Comprensión lectora", d: "Interpreta textos del nivel con precisión", n: "la comprensión lectora",
      s: { 4: "interpreta con precisión los textos del nivel", 3: "comprende bien los textos del nivel" },
      w: { 2: "capta la idea general, pero necesita apoyo con los detalles", 1: "requiere mucho acompañamiento para comprender los textos" },
      a: { 2: "resumir con sus palabras los textos que lee", 1: "leer textos breves con apoyo de imágenes y vocabulario previo" },
      goal: "leer un texto corto por semana y resumirlo en tres oraciones",
      up: "leer textos auténticos breves, como noticias sencillas" }
  };

  // area = cómo se nombra la sección en las recomendaciones.
  var TEMPLATE = {
    version: 1,
    sections: [
      { id: "part", n: 1, title: "Participación y Compromiso", obs: true, focus: "la participación y el compromiso",
        area: "la participación", items: ["asistencia", "participacion", "actitud"] },
      { id: "speaking", n: 2, title: "Producción Oral — Speaking", obs: true, focus: "la producción oral",
        area: "la expresión oral", items: ["fluidez", "estructuras", "vocabOral", "pronunciacion"] },
      { id: "writing", n: 3, title: "Producción Escrita — Writing", obs: true, focus: "la producción escrita",
        area: "la expresión escrita", items: ["oraciones", "vocabEscrito", "ortografia"] },
      { id: "comprension", n: 4, title: "Comprensión — Listening & Reading", obs: false, focus: "la comprensión",
        area: "la comprensión (listening y reading)", items: ["auditiva", "lectora"] }
    ]
  };
  var ALL = [];
  TEMPLATE.sections.forEach(function (s) { ALL = ALL.concat(s.items); });

  /* ---------------- Redacción por reglas ---------------- */
  function hash(str) {
    var x = 2166136261;
    for (var i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); }
    return x >>> 0;
  }
  function picker(seed) {
    var n = 0;
    return function (arr) { n++; return arr[hash(seed + "|" + n) % arr.length]; };
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function joinY(list) {
    if (list.length < 2) return list.join("");
    var last = list[list.length - 1];
    // "y" → "e" delante de palabra que empieza por i/hi (interviene, interpreta…)
    var y = /^h?i[^aeou]/i.test(last) ? " e " : " y ";
    return list.slice(0, -1).join(", ") + y + last;
  }
  function band(avg) { return avg >= 3.5 ? 4 : avg >= 2.75 ? 3 : avg >= 1.75 ? 2 : 1; }
  function firstName(full) { var p = String(full || "").trim().split(/\s+/)[0]; return p ? cap(p.toLowerCase()) : ""; }
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ""; }); }
  function avgOf(ids, ans) { return ids.reduce(function (s, id) { return s + ans[id]; }, 0) / ids.length; }

  // Cada observación: apertura + fortalezas (una oración) + una oración por
  // aspecto a mejorar (cómo está; qué se le recomienda).
  // Siempre con el nombre del estudiante, sin "usted" (pedido del usuario, 1 oct 2026).
  var OPEN = {
    4: ["{n}su desempeño en {f} es destacado.", "{n}en {f} alcanza un nivel sobresaliente.", "{n}sobresale en {f} durante este ciclo."],
    3: ["{n}cumple los objetivos del ciclo en {f}.", "{n}en {f} su desempeño es sólido.", "{n}logra avances claros en {f}."],
    2: ["{n}está en proceso de consolidar {f}.", "{n}en {f} avanza, aunque todavía sin constancia.", "{n}sus avances en {f} aún requieren práctica."],
    1: ["{n}en {f} está en una etapa inicial y necesita acompañamiento cercano.", "{n}presenta dificultades en {f} que conviene atender.",
        "{n}inicia su proceso en {f} y necesita refuerzo constante."]
  };
  var STRONG = ["Destaco que {x}.", "Es de resaltar que {x}.", "Valoro que {x}."];
  // [con "a", sin "a"]: "En cuanto a la…" / "En cuanto al vocabulario…"
  var WEAK_LEAD = [["En cuanto a", "En cuanto"], ["Respecto a", "Respecto"], ["Sobre", "Sobre"]];
  var REC = ["le recomiendo", "le sugiero", "es importante"];

  function sectionText(sec, ans, v, pick) {
    var out = [cap(fill(pick(OPEN[band(avgOf(sec.items, ans))]), { n: v.n ? v.n + ", " : "", f: sec.focus }))];
    var strong = sec.items.filter(function (id) { return ans[id] >= 3; })
      .sort(function (x, y) { return ans[y] - ans[x]; })
      .map(function (id) { return SKILLS[id].s[ans[id]]; });
    if (strong.length) out.push(fill(pick(STRONG), { x: joinY(strong) }));
    var first = hash(v.seed + sec.id) % 3;
    sec.items.filter(function (id) { return ans[id] <= 2; })
      .sort(function (x, y) { return ans[x] - ans[y]; })
      .forEach(function (id, i) {
        var sk = SKILLS[id], lead = WEAK_LEAD[(first + i) % 3];
        var head = /^el /.test(sk.n) ? (lead[1] === "Sobre" ? "Sobre el " : lead[1] + " al ") + sk.n.slice(3) : lead[0] + " " + sk.n;
        out.push(head + ", " + sk.w[ans[id]] + "; " + REC[(first + i) % 3] + " " + sk.a[ans[id]] + ".");
      });
    return out.join(" ");
  }

  var R_OPEN = {
    4: "culmina el módulo {lv} con un desempeño destacado.",
    3: "culmina el módulo {lv} cumpliendo los objetivos propuestos.",
    2: "culmina el módulo {lv} con avances, aunque varias habilidades siguen en proceso.",
    1: "culmina el módulo {lv} en una etapa inicial en varias habilidades."
  };
  function examSentence(p) {
    if (p == null) return "";
    var s = "Su resultado en la validación formativa (" + p + " %) ";
    if (p >= 90) return s + "confirma un dominio muy sólido de los contenidos.";
    if (p >= 75) return s + "refleja un buen manejo de los contenidos.";
    if (p >= 60) return s + "muestra un manejo aceptable, con aspectos por reforzar.";
    return s + "indica que conviene repasar los contenidos del módulo.";
  }
  // Áreas más fuertes y más débiles (promedio por sección), para que el
  // resumen cambie con cada respuesta y no solo con el promedio general.
  function areasSentence(ans) {
    var secs = TEMPLATE.sections.map(function (s) { return { area: s.area, avg: avgOf(s.items, ans) }; });
    var hi = Math.max.apply(null, secs.map(function (s) { return s.avg; }));
    var lo = Math.min.apply(null, secs.map(function (s) { return s.avg; }));
    if (hi - lo < 0.25) return "Mantiene un nivel parejo en todas las áreas evaluadas.";
    var best = secs.filter(function (s) { return s.avg === hi; }).map(function (s) { return s.area; });
    var worst = secs.filter(function (s) { return s.avg === lo; }).map(function (s) { return s.area; });
    var b = (best.length > 1 ? "Sus mayores fortalezas están en " : "Su mayor fortaleza está en ") + joinY(best);
    var w = worst.length > 1 ? "las áreas que más requieren refuerzo son " + joinY(worst) : "el área que más requiere refuerzo es " + worst[0];
    if (hi < 2.75) return cap(w) + ".";
    if (lo >= 3) return b + "; aun así, " + (worst.length > 1 ? "puede seguir fortaleciendo " : "puede seguir fortaleciendo ") + joinY(worst) + ".";
    return b + ", y " + w + ".";
  }
  // Habilidades en Destacado: si son muchas, solo cuántas.
  function topSentence(ans) {
    var top = ALL.filter(function (id) { return ans[id] === 4; });
    if (!top.length || top.length === ALL.length) return "";
    if (top.length > 3) return "Alcanzó el nivel Destacado en " + top.length + " de las " + ALL.length + " habilidades evaluadas.";
    return "Alcanzó el nivel Destacado en " + joinY(top.map(function (id) { return SKILLS[id].n.replace(/^(la|el|las) /, ""); })) + ".";
  }
  var R_GENERIC = [
    "mantener la práctica diaria fuera de clase",
    "asumir retos mayores, como exposiciones cortas o textos auténticos"
  ];

  function recomText(ans, v) {
    var open = fill(R_OPEN[band(avgOf(ALL, ans))], { lv: v.lv });
    var out = [v.n ? v.n + ", " + open : cap(open), areasSentence(ans), topSentence(ans)].filter(Boolean);
    var ex = examSentence(v.pct);
    if (ex) out.push(ex);
    var order = function (list) { return list.slice().sort(function (x, y) { return ans[x] - ans[y] || ALL.indexOf(x) - ALL.indexOf(y); }); };
    var goals = order(ALL.filter(function (id) { return ans[id] <= 2; })).map(function (id) { return SKILLS[id].goal; })
      .concat(order(ALL.filter(function (id) { return ans[id] === 3; })).map(function (id) { return SKILLS[id].up; }))
      .concat(R_GENERIC).slice(0, 3);
    return out.join(" ") + "\nMetas para el siguiente ciclo:\n" + goals.map(function (g, i) { return (i + 1) + ". " + cap(g) + "."; }).join("\n");
  }

  function complete(ans) { return ALL.every(function (id) { return ans && ans[id] >= 1 && ans[id] <= 4; }); }

  function generate(ans, ctx) {
    ctx = ctx || {};
    var v = { n: firstName(ctx.name), lv: ctx.level || "", pct: ctx.pct, seed: String(ctx.seed || 0) };
    var out = {};
    TEMPLATE.sections.forEach(function (sec) {
      if (!sec.obs) return;
      var done = sec.items.every(function (id) { return ans[id] >= 1; });
      out[sec.id] = done ? sectionText(sec, ans, v, picker(v.seed + "|" + sec.id)) : "";
    });
    out.recom = complete(ans) ? recomText(ans, v) : "";
    return out;
  }

  /* ---------------- Hoja del informe ---------------- */
  var PEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';

  function render(opts) {
    var m = opts.meta || {}, ans = Object.assign({}, opts.answers || {}), ed = !!opts.editable;
    var texts = opts.texts || null;
    var root = h('<article class="ip-sheet' + (ed ? " is-edit" : "") + '"></article>');
    root.appendChild(h('<header class="ip-head"><img src="assets/logo-horizontal.png" alt="LEF Learn English Fluently">' +
      '<div><h2>Informe de progreso académico</h2><p>Learn English Fluently · @lefcenter</p></div></header>'));
    root.appendChild(h('<dl class="ip-meta">' +
      "<div><dt>Estudiante</dt><dd>" + esc(m.student || "—") + "</dd></div>" +
      "<div><dt>Nivel</dt><dd>" + esc(m.level || "—") + "</dd></div>" +
      "<div><dt>Ciclo</dt><dd>" + esc(m.cycle || "—") + "</dd></div>" +
      "<div><dt>Docente</dt><dd>" + esc(m.teacher || "—") + "</dd></div></dl>"));

    var boxes = {};
    function obsBox(id, label, hint) {
      var b = h('<div class="ip-obs"><div class="ip-obs__h">' + PEN + "<span>" + esc(label) + "</span>" +
        (ed ? '<small>La redacta la plataforma según lo que marques</small>' : "") + '</div><p class="ip-obs__t"></p></div>');
      boxes[id] = { el: b.querySelector(".ip-obs__t"), hint: hint };
      return b;
    }

    TEMPLATE.sections.forEach(function (sec) {
      var s = h('<section class="ip-sec"><div class="ip-sec__h"><span class="ip-sec__n">' + sec.n + "</span><h3>" + esc(sec.title) + "</h3></div>" +
        '<div class="ip-grid"></div></section>');
      var grid = s.querySelector(".ip-grid");
      sec.items.forEach(function (id) {
        var sk = SKILLS[id];
        var row = h('<div class="ip-row" role="radiogroup" aria-label="' + esc(sk.t) + '"><div class="ip-skill"><strong>' + esc(sk.t) + "</strong><small>" + esc(sk.d) + "</small></div></div>");
        LEVELS.forEach(function (l) {
          var on = ans[id] === l.v;
          var b = h('<button type="button" role="radio" class="ip-opt is-l' + l.v + (on ? " is-on" : "") + '" aria-checked="' + on + '"' + (ed ? "" : " disabled") + ">" +
            '<span class="ip-box">' + CHECK + '</span><span class="ip-opt__t">' + l.t + "</span></button>");
          if (ed) b.addEventListener("click", function () {
            ans[id] = l.v;
            row.querySelectorAll(".ip-opt").forEach(function (o) { o.classList.remove("is-on"); o.setAttribute("aria-checked", "false"); });
            b.classList.add("is-on"); b.setAttribute("aria-checked", "true");
            row.classList.remove("is-missing");
            texts = null;
            refresh();
          });
          row.appendChild(b);
        });
        grid.appendChild(row);
      });
      if (sec.obs) s.appendChild(obsBox(sec.id, "Observación del docente", "Marca las habilidades de esta sección y aquí aparecerá la observación."));
      root.appendChild(s);
    });

    var s5 = h('<section class="ip-sec"><div class="ip-sec__h"><span class="ip-sec__n">5</span><h3>Recomendaciones para el Siguiente Ciclo</h3></div></section>');
    s5.appendChild(obsBox("recom", "Observaciones y metas sugeridas", "Cuando marques todas las habilidades aparecerán las recomendaciones."));
    root.appendChild(s5);

    var pct = opts.pct;
    root.appendChild(h('<div class="ip-result"><div class="ip-result__n"><span>Resultado · Validación Formativa</span>' +
      (pct == null ? "<strong>— %</strong>" : "<strong>" + esc(pct) + " %</strong>") +
      '<div class="ex-bar is-big"><i style="width:' + (pct == null ? 0 : Math.max(0, Math.min(100, pct))) + '%"></i></div>' +
      (opts.examNote ? "<small>" + esc(opts.examNote) + "</small>" : "") + "</div>" +
      "<p>Este resultado es una herramienta diagnóstica que orienta el proceso de aprendizaje. No es un juicio de valor sobre el estudiante.</p></div>"));

    root.appendChild(h('<div class="ip-note"><div class="ip-obs__h">' + PEN + "<span>Comentario del docente</span>" +
      (ed ? "<small>Tu anotación de Estudiantes → Mis anotaciones</small>" : "") + "</div>" +
      (opts.note ? '<p class="ip-obs__t">' + esc(opts.note) + "</p>"
        : '<p class="ip-obs__t is-empty">' + (ed ? "No tienes anotaciones sobre este estudiante. Puedes escribirlas en Estudiantes → Mis anotaciones." : "Sin comentario.") + "</p>") + "</div>"));

    root.appendChild(h('<div class="ip-sign"><div><span class="ip-sign__v">' + esc(m.teacher || "") + "</span><span>Firma del docente</span></div>" +
      '<div><span class="ip-sign__v">' + esc(m.date || "") + "</span><span>Fecha de emisión</span></div></div>"));
    root.appendChild(h('<footer class="ip-foot">LEF Center · Learn English Fluently · @lefcenter · Barranquilla, Colombia</footer>'));

    function refresh() {
      var t = texts || generate(ans, { name: m.student, level: m.level, pct: pct, seed: opts.seed });
      Object.keys(boxes).forEach(function (k) {
        var bx = boxes[k];
        bx.el.textContent = t[k] || bx.hint;
        bx.el.classList.toggle("is-empty", !t[k]);
      });
      if (opts.onChange) opts.onChange(Object.assign({}, ans), t);
    }
    refresh();

    root.lefMissing = function () {
      var miss = 0;
      root.querySelectorAll(".ip-row").forEach(function (row, i) {
        var bad = !(ans[ALL[i]] >= 1);
        row.classList.toggle("is-missing", bad);
        if (bad) miss++;
      });
      var f = root.querySelector(".ip-row.is-missing");
      if (f) f.scrollIntoView({ behavior: "smooth", block: "center" });
      return miss;
    };
    return root;
  }

  window.LEFInforme = { TEMPLATE: TEMPLATE, SKILLS: SKILLS, LEVELS: LEVELS, ALL: ALL, generate: generate, render: render, complete: complete };
})();
