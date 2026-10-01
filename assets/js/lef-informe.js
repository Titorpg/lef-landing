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

  // s = fortaleza (3 y 4) · w = cómo está (1 y 2) · a = qué se recomienda (1 y 2)
  // goal = meta del siguiente ciclo si está bajo · up = meta para pasar de Logrado a Destacado
  var SKILLS = {
    asistencia: { t: "Asistencia", d: "Regularidad en las sesiones del ciclo", n: "la asistencia",
      s: { 4: "asiste con total regularidad a las sesiones",
           3: "mantiene una asistencia regular a lo largo del ciclo" },
      w: { 2: "se registran algunas ausencias que interrumpen la continuidad del proceso",
           1: "las ausencias frecuentes han limitado de forma importante el avance en el ciclo" },
      a: { 2: "asistir a todas las sesiones y, cuando no sea posible, ponerse al día con el material de la clase antes de la siguiente",
           1: "priorizar la asistencia, ya que cada sesión se apoya en la anterior, y acordar con el docente un plan para recuperar los temas perdidos" },
      goal: "asistir a la totalidad de las sesiones y repasar el material de cada clase a la que no pueda asistir",
      up: "llegar a cada sesión con el material de la clase anterior repasado" },
    participacion: { t: "Participación", d: "Iniciativa para intervenir en clase", n: "la participación",
      s: { 4: "interviene por iniciativa propia con preguntas que aportan a la clase",
           3: "participa con frecuencia cuando se le invita a hacerlo" },
      w: { 2: "interviene principalmente cuando se le pide de forma directa",
           1: "sus intervenciones en clase son todavía escasas" },
      a: { 2: "proponerse al menos una intervención voluntaria por sesión, aunque sea breve",
           1: "empezar con intervenciones cortas y preparadas (una pregunta o un comentario por clase) para ganar seguridad" },
      goal: "intervenir de manera voluntaria en cada sesión, con preguntas o aportes breves en inglés",
      up: "asumir un rol más activo en las dinámicas de grupo, por ejemplo liderando la conversación en las actividades en parejas" },
    actitud: { t: "Actitud y motivación", d: "Disposición y compromiso durante las actividades", n: "la actitud y la motivación",
      s: { 4: "demuestra una actitud ejemplar frente a las actividades propuestas",
           3: "muestra buena disposición durante las actividades de la clase" },
      w: { 2: "la disposición hacia las actividades varía de una sesión a otra",
           1: "se observa poca disposición frente a las actividades propuestas" },
      a: { 2: "fijarse metas cortas cada semana que le permitan ver su propio progreso y sostener la motivación",
           1: "conversar con el docente sobre sus intereses y dificultades, de modo que las actividades le resulten más significativas" },
      goal: "establecer una rutina semanal de estudio con metas concretas y revisar su avance al final de cada semana",
      up: "proponer temas o materiales de su interés para practicar dentro y fuera de clase" },
    fluidez: { t: "Fluidez y confianza", d: "Habla sin bloqueos frecuentes", n: "la fluidez",
      s: { 4: "se expresa con soltura al hablar",
           3: "logra comunicarse con relativa fluidez para su nivel" },
      w: { 2: "todavía se presentan pausas y bloqueos frecuentes al hablar",
           1: "le cuesta sostener un intercambio oral sin apoyo" },
      a: { 2: "practicar la expresión oral con regularidad fuera de clase, por ejemplo describiendo su día en voz alta o grabando audios breves",
           1: "preparar y ensayar frases de uso frecuente y decirlas en voz alta a diario, aunque sea por pocos minutos" },
      goal: "grabar cada semana un audio de uno a dos minutos sobre un tema del módulo y escucharlo para identificar pausas y muletillas",
      up: "participar en conversaciones más extensas, como el Conversation Club, para sostener la fluidez en situaciones menos preparadas" },
    estructuras: { t: "Uso de estructuras", d: "Aplica las estructuras gramaticales del nivel", n: "el uso de las estructuras gramaticales",
      s: { 4: "aplica con precisión las estructuras gramaticales del nivel incluso en situaciones espontáneas",
           3: "utiliza correctamente las estructuras trabajadas en la mayoría de sus intervenciones" },
      w: { 2: "las aplica de forma correcta solo en algunas ocasiones",
           1: "aún no logra incorporarlas al hablar" },
      a: { 2: "repasar las estructuras del módulo y usarlas de manera consciente en frases propias",
           1: "retomar las estructuras básicas del nivel con ejercicios guiados antes de llevarlas a la conversación" },
      goal: "construir y decir en voz alta cinco oraciones propias con cada estructura nueva del módulo",
      up: "combinar varias estructuras en una misma intervención para expresar ideas más complejas" },
    vocabOral: { t: "Vocabulario activo", d: "Usa el vocabulario trabajado en clase", n: "el vocabulario activo",
      s: { 4: "incorpora con naturalidad el vocabulario trabajado en clase",
           3: "usa de forma adecuada el vocabulario de la clase al hablar" },
      w: { 2: "reconoce las palabras trabajadas en clase, pero todavía las usa poco al hablar",
           1: "dispone todavía de pocas palabras para expresarse oralmente" },
      a: { 2: "llevar una lista personal de palabras nuevas y usar cada una en una frase oral durante la semana",
           1: "repasar el vocabulario de cada clase con tarjetas o aplicaciones y practicarlo en voz alta" },
      goal: "incorporar a su expresión oral al menos diez palabras nuevas por semana, registrándolas en una lista personal",
      up: "incluir sinónimos y expresiones más precisas para no repetir siempre las mismas palabras" },
    pronunciacion: { t: "Pronunciación", d: "Inteligibilidad general al hablar", n: "la pronunciación",
      s: { 4: "tiene una pronunciación clara que facilita la comprensión en todo momento",
           3: "tiene una pronunciación inteligible para su nivel" },
      w: { 2: "algunos errores dificultan por momentos la comprensión",
           1: "con frecuencia los errores dificultan la comprensión del mensaje" },
      a: { 2: "escuchar y repetir audios cortos del nivel imitando el ritmo y la entonación",
           1: "trabajar los sonidos básicos del inglés con ejercicios diarios de escucha y repetición" },
      goal: "practicar la técnica de shadowing (escuchar y repetir al mismo tiempo) con audios del módulo al menos tres veces por semana",
      up: "trabajar la entonación y el enlace entre palabras para sonar más natural" },
    oraciones: { t: "Construcción de oraciones", d: "Coherencia y correcta sintaxis escrita", n: "la construcción de oraciones",
      s: { 4: "redacta oraciones coherentes con un orden sintáctico correcto",
           3: "construye oraciones claras y bien organizadas" },
      w: { 2: "algunas presentan problemas de orden o de coherencia",
           1: "presenta dificultades frecuentes de orden y de sentido al escribir" },
      a: { 2: "revisar el orden sujeto–verbo–complemento antes de entregar cada texto",
           1: "escribir oraciones cortas a partir de modelos y avanzar poco a poco hacia textos más largos" },
      goal: "escribir un párrafo corto por semana sobre los temas del módulo y revisarlo con la retroalimentación del docente",
      up: "enlazar sus ideas con conectores (and, but, because, so, however) para producir textos más elaborados" },
    vocabEscrito: { t: "Uso de vocabulario", d: "Aplica el vocabulario del ciclo por escrito", n: "el uso del vocabulario por escrito",
      s: { 4: "emplea por escrito un vocabulario variado y adecuado al contexto",
           3: "aplica por escrito el vocabulario del ciclo de forma correcta" },
      w: { 2: "todavía resulta repetitivo o poco preciso",
           1: "las palabras del ciclo aún no se reflejan en sus escritos" },
      a: { 2: "incluir de forma intencional palabras nuevas del módulo en cada ejercicio escrito",
           1: "completar oraciones modelo con el vocabulario de la clase para fijarlo" },
      goal: "usar en cada escrito al menos cinco palabras nuevas del módulo",
      up: "variar el vocabulario escrito con sinónimos y expresiones propias del nivel siguiente" },
    ortografia: { t: "Ortografía y puntuación", d: "Precisión en la forma escrita", n: "la ortografía y la puntuación",
      s: { 4: "escribe con precisión ortográfica y buen uso de la puntuación",
           3: "comete pocos errores de ortografía y de puntuación" },
      w: { 2: "aparecen errores que conviene corregir",
           1: "los errores son frecuentes en sus escritos" },
      a: { 2: "releer cada texto antes de entregarlo, con atención especial a las palabras que suele escribir mal",
           1: "llevar un registro de sus errores frecuentes y practicar la escritura correcta de esas palabras" },
      goal: "llevar una lista de sus errores ortográficos frecuentes y revisarla antes de cada entrega",
      up: "cuidar la puntuación en textos más largos, especialmente el uso de comas y puntos" },
    auditiva: { t: "Comprensión auditiva", d: "Extrae información clave al escuchar", n: "la comprensión auditiva",
      s: { 4: "comprende con facilidad audios y conversaciones del nivel incluso a velocidad natural",
           3: "extrae la información principal de los audios del nivel" },
      w: { 2: "capta las ideas generales al escuchar, pero se le escapan detalles importantes",
           1: "aún le resulta difícil extraer información al escuchar" },
      a: { 2: "escuchar audios cortos varias veces, primero para captar la idea general y luego los detalles",
           1: "escuchar inglés a diario con audios lentos o con subtítulos, aumentando la dificultad de forma gradual" },
      goal: "escuchar al menos quince minutos diarios de inglés (podcasts, canciones o videos del nivel) y anotar las ideas principales",
      up: "practicar con audios a velocidad natural y sin subtítulos" },
    lectora: { t: "Comprensión lectora", d: "Interpreta textos del nivel con precisión", n: "la comprensión lectora",
      s: { 4: "interpreta con precisión los textos del nivel e infiere la información implícita",
           3: "comprende de forma adecuada los textos del nivel" },
      w: { 2: "capta la idea general de los textos, pero necesita apoyo con los detalles",
           1: "requiere todavía mucho acompañamiento para comprender los textos del nivel" },
      a: { 2: "leer textos cortos del nivel y resumir con sus propias palabras las ideas principales",
           1: "leer textos breves con apoyo de imágenes y vocabulario previo, subrayando lo que entiende" },
      goal: "leer un texto corto del nivel por semana y escribir un resumen de tres o cuatro oraciones",
      up: "leer textos auténticos breves (noticias o artículos sencillos) para ampliar el vocabulario y la comprensión" }
  };

  var TEMPLATE = {
    version: 1,
    sections: [
      { id: "part", n: 1, title: "Participación y Compromiso", obs: true, focus: "la participación y el compromiso con el proceso",
        items: ["asistencia", "participacion", "actitud"] },
      { id: "speaking", n: 2, title: "Producción Oral — Speaking", obs: true, focus: "la producción oral",
        items: ["fluidez", "estructuras", "vocabOral", "pronunciacion"] },
      { id: "writing", n: 3, title: "Producción Escrita — Writing", obs: true, focus: "la producción escrita",
        items: ["oraciones", "vocabEscrito", "ortografia"] },
      { id: "comprension", n: 4, title: "Comprensión — Listening & Reading", obs: false, focus: "la comprensión",
        items: ["auditiva", "lectora"] }
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
    // "y" → "e" delante de palabra que empieza por i/hi (incorpora, interviene…)
    var y = /^h?i[^aeou]/i.test(last) ? " e " : " y ";
    return list.slice(0, -1).join(", ") + y + last;
  }
  function band(avg) { return avg >= 3.5 ? 4 : avg >= 2.75 ? 3 : avg >= 1.75 ? 2 : 1; }
  function firstName(full) { var p = String(full || "").trim().split(/\s+/)[0] || "El estudiante"; return cap(p.toLowerCase()); }
  function fill(s, v) { return s.replace(/\{(\w+)\}/g, function (_, k) { return v[k] != null ? v[k] : ""; }); }

  var OPEN = {
    4: ["{n} demuestra un desempeño destacado en {f}, por encima de lo esperado para el nivel {lv}.",
        "En {f}, {n} alcanza un nivel sobresaliente durante este ciclo.",
        "El desempeño de {n} en {f} es excelente y refleja un trabajo constante."],
    3: ["{n} cumple satisfactoriamente con los objetivos del ciclo en {f}.",
        "En {f}, {n} muestra un desempeño sólido y acorde con el nivel {lv}.",
        "El trabajo de {n} en {f} evidencia logros claros durante este ciclo."],
    2: ["{n} se encuentra en proceso de consolidar {f}: se observan avances, aunque todavía no de manera constante.",
        "En {f}, {n} muestra avances que aún requieren práctica para afianzarse.",
        "El desempeño de {n} en {f} está en desarrollo y necesita mayor constancia."],
    1: ["En {f}, {n} se encuentra en una etapa inicial y requiere un acompañamiento cercano para avanzar.",
        "{n} presenta dificultades en {f} que conviene atender de forma prioritaria.",
        "El proceso de {n} en {f} está comenzando y necesita refuerzo constante."]
  };
  var STRONG = ["Se destaca que {x}.", "Entre sus fortalezas, cabe mencionar que {x}.", "Es de resaltar que {x}."];
  // [con "a", sin "a"]: "En cuanto a la…" / "En cuanto al uso…"
  var WEAK_LEAD = [["En cuanto a", "En cuanto"], ["Respecto a", "Respecto"], ["En lo que se refiere a", "En lo que se refiere"]];
  var REC = ["Se recomienda {x}.", "Como estrategia, se sugiere {x}.", "Para avanzar, es conveniente {x}."];
  var UNEVEN = "Se observa un perfil desigual: algunas habilidades están bien desarrolladas y otras aún necesitan trabajo.";
  var CLOSE = {
    4: ["Se le anima a mantener este nivel de compromiso y a asumir retos de mayor exigencia.",
        "Este resultado es una base muy sólida para el siguiente módulo."],
    3: ["Con práctica constante, puede llevar estas habilidades a un nivel destacado.",
        "Se le invita a continuar con la misma constancia en el siguiente ciclo."],
    2: ["Con práctica regular y el acompañamiento del docente, estos aspectos pueden afianzarse en el próximo ciclo.",
        "Los avances logrados muestran que, con mayor constancia, puede alcanzar los objetivos del nivel."],
    1: ["Con un plan de trabajo constante y el apoyo del docente, es posible lograr avances significativos.",
        "Es importante no desanimarse: cada sesión de práctica suma al proceso."]
  };

  function sectionText(sec, ans, v, pick) {
    var vals = sec.items.map(function (id) { return ans[id]; });
    var avg = vals.reduce(function (s, x) { return s + x; }, 0) / vals.length;
    var b = band(avg), out = [];
    out.push(fill(pick(OPEN[b]), { n: v.n, f: sec.focus, lv: v.lv }));
    if (b <= 3 && Math.max.apply(null, vals) - Math.min.apply(null, vals) >= 2) out.push(UNEVEN);
    var strong = sec.items.filter(function (id) { return ans[id] >= 3; })
      .sort(function (x, y) { return ans[y] - ans[x]; })
      .map(function (id) { return SKILLS[id].s[ans[id]]; });
    // Más de dos fortalezas: en dos oraciones para que no quede una lista larga.
    if (strong.length) out.push(fill(pick(STRONG), { x: joinY(strong.slice(0, 2)) }));
    if (strong.length > 2) out.push("Además, " + joinY(strong.slice(2)) + ".");
    var leads = WEAK_LEAD.slice(), recs = REC.slice(), first = hash(v.seed + sec.id) % 3;
    sec.items.filter(function (id) { return ans[id] <= 2; })
      .sort(function (x, y) { return ans[x] - ans[y]; })
      .forEach(function (id, i) {
        var sk = SKILLS[id], lead = leads[(first + i) % leads.length];
        var noun = /^el /.test(sk.n) ? lead[1] + " al " + sk.n.slice(3) : lead[0] + " " + sk.n;
        out.push(noun + ", " + sk.w[ans[id]] + ". " + fill(recs[(first + i) % recs.length], { x: sk.a[ans[id]] }));
      });
    out.push(pick(CLOSE[b]));
    return out.join(" ");
  }

  var R_OPEN = {
    4: "{n} culmina el módulo {lv} con un desempeño destacado en la mayoría de las habilidades evaluadas.",
    3: "{n} culmina el módulo {lv} alcanzando los objetivos propuestos en la mayoría de las habilidades evaluadas.",
    2: "{n} culmina el módulo {lv} con avances importantes, aunque varias habilidades se encuentran aún en proceso.",
    1: "{n} culmina el módulo {lv} en una etapa inicial en varias de las habilidades evaluadas."
  };
  function examSentence(p) {
    if (p == null) return "";
    if (p >= 90) return "El resultado de la validación formativa (" + p + " %) confirma un dominio muy sólido de los contenidos del módulo.";
    if (p >= 75) return "El resultado de la validación formativa (" + p + " %) refleja un buen manejo de los contenidos del módulo.";
    if (p >= 60) return "El resultado de la validación formativa (" + p + " %) muestra un manejo aceptable de los contenidos, con aspectos por reforzar.";
    return "El resultado de la validación formativa (" + p + " %) indica que conviene repasar los contenidos del módulo antes de avanzar.";
  }
  var R_GENERIC = [
    "mantener la práctica diaria del idioma fuera de clase para conservar el nivel alcanzado",
    "asumir retos de mayor exigencia, como exposiciones cortas en inglés o la lectura de textos auténticos"
  ];
  var R_CLOSE = [
    "Se recomienda revisar estas metas con el docente al inicio del próximo módulo para darles seguimiento.",
    "Estas metas pueden retomarse con el docente al comenzar el siguiente ciclo para medir el avance.",
    "Dar seguimiento a estas metas semana a semana facilitará un progreso visible en el próximo módulo."
  ];

  function recomText(ans, v, pick) {
    var avg = ALL.reduce(function (s, id) { return s + ans[id]; }, 0) / ALL.length;
    var out = [fill(R_OPEN[band(avg)], { n: v.n, lv: v.lv })];
    var ex = examSentence(v.pct);
    if (ex) out.push(ex);
    var order = function (list) { return list.slice().sort(function (x, y) { return ans[x] - ans[y] || ALL.indexOf(x) - ALL.indexOf(y); }); };
    var goals = order(ALL.filter(function (id) { return ans[id] <= 2; })).map(function (id) { return SKILLS[id].goal; })
      .concat(order(ALL.filter(function (id) { return ans[id] === 3; })).map(function (id) { return SKILLS[id].up; }))
      .concat(R_GENERIC).slice(0, 3);
    out.push("Para el siguiente ciclo se sugieren las siguientes metas:");
    var txt = out.join(" ") + "\n" + goals.map(function (g, i) { return (i + 1) + ". " + cap(g) + "."; }).join("\n");
    return txt + "\n" + pick(R_CLOSE);
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
    out.recom = complete(ans) ? recomText(ans, v, picker(v.seed + "|recom")) : "";
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
