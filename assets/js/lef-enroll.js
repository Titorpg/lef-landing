/* LEF — Asistente de pre-inscripción (4 pasos)
   Paso 1 Tus datos · Paso 2 Tu nivel (autoevaluación) · Paso 3 Franja horaria
   (preferencia) · Paso 4 Revisar.
   El nivel y la franja horaria son solo INDICADORES para el asesor — no
   reservan cupo ni módulo. Al enviar: create_preinscripcion -> queda en la
   lista de "Pre-inscritos" del panel. El admin contacta a la persona y, si
   acuerdan el inicio, crea el estudiante desde el panel (ahí sí se elige el
   módulo, el horario y el grupo reales, con cupo y matrícula). El formulario
   NO crea estudiantes ni inscripciones. */
(function () {
  "use strict";

  var mount = document.getElementById("enroll-app");
  if (!mount) return;

  var WHATSAPP_NUMBER = (window.LEF_WHATSAPP || "573013240652");
  var sb = window.lefSupabase;

  var LEVELS = [
    { id: "beginner", label: "Principiante", range: "A1 – A2",
      desc: "Conoces lo básico: saludar, presentarte, contar, hablar de tu rutina. Te cuesta mantener una conversación completa en inglés." },
    { id: "intermediate", label: "Intermedio", range: "B1 – B2",
      desc: "Puedes conversar sobre temas cotidianos, entender textos o videos sencillos, y dar tu opinión, aunque cometas errores." },
    { id: "advanced", label: "Avanzado", range: "C1 en adelante",
      desc: "Te comunicas con fluidez en la mayoría de los temas, entiendes contenido complejo y buscas perfeccionar tu nivel." }
  ];
  var TIME_SLOTS = [
    { id: "morning", label: "Mañana", range: "6:00 a.m. – 12:00 p.m.",
      desc: "Ideal si estudias o trabajas en jornada de tarde o noche." },
    { id: "afternoon", label: "Tarde", range: "12:00 p.m. – 6:00 p.m.",
      desc: "La franja más solicitada — revisa que no choque con almuerzo o salida del colegio." },
    { id: "evening", label: "Noche", range: "6:00 p.m. – 9:00 p.m.",
      desc: "Pensada para quienes trabajan o estudian durante el día." }
  ];
  var LEVEL_BY_ID = {}; LEVELS.forEach(function (l) { LEVEL_BY_ID[l.id] = l; });
  var TIME_BY_ID = {}; TIME_SLOTS.forEach(function (t) { TIME_BY_ID[t.id] = t; });

  var state = {
    step: 1,
    data: { name: "", docType: "CC", docNumber: "", phone: "", email: "", age: "", city: "" },
    levelEstimate: null,
    timePreference: null,
    submitting: false,
    result: null,
    error: ""
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- data ---------- */
  function rpc(fn, args) {
    if (!sb) return Promise.reject(new Error("sin-conexion"));
    return sb.rpc(fn, args || {}).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }

  /* ---------- validation ---------- */
  function step1Valid() {
    var d = state.data;
    return d.name.trim().length >= 2 &&
      ["TI", "CC", "CE", "PP"].indexOf(d.docType) >= 0 &&
      d.docNumber.trim().length >= 3 &&
      d.phone.replace(/\D/g, "").length >= 7 &&
      /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim());
  }
  var DOC_LABEL = { TI: "Tarjeta de identidad", CC: "Cédula de ciudadanía", CE: "Cédula de extranjería", PP: "Pasaporte" };

  /* ---------- render ---------- */
  function stepper() {
    var labels = ["Tus datos", "Tu nivel", "Franja horaria", "Revisar"];
    var done = state.result ? 5 : state.step;
    return '<ol class="wz-steps">' + labels.map(function (l, i) {
      var n = i + 1;
      var cls = n < done ? "is-done" : (n === done ? "is-current" : "");
      return '<li class="' + cls + '"><span class="wz-dot">' +
        (n < done ? "✓" : n) + '</span><span class="wz-lab">' + l + "</span></li>";
    }).join("") + "</ol>";
  }

  function view() {
    if (state.result) return viewResult();
    var body =
      state.step === 1 ? viewStep1() :
      state.step === 2 ? viewStep2() :
      state.step === 3 ? viewStep3() : viewStep4();
    return '<div class="wz-card">' + stepper() +
      (state.error ? '<p class="wz-alert">' + esc(state.error) + "</p>" : "") +
      body + "</div>";
  }

  function viewStep1() {
    var d = state.data;
    return '' +
      '<h2 class="wz-h">Cuéntanos sobre ti</h2>' +
      '<p class="wz-sub">Usaremos esta información para contactarte por WhatsApp y continuar tu proceso.</p>' +
      '<div class="wz-grid">' +
        field("wz-name", "Nombre completo del estudiante", "text", d.name, true, "full") +
        docTypeField(d.docType) +
        field("wz-docnum", "Número de documento", "text", d.docNumber, true) +
        field("wz-phone", "Número de WhatsApp", "tel", d.phone, true) +
        field("wz-email", "Correo electrónico", "email", d.email, true) +
        field("wz-age", "Edad", "number", d.age, false) +
        field("wz-city", "Ciudad", "text", d.city, false) +
      '</div>' +
      '<div class="wz-nav wz-nav-end">' +
        '<button type="button" class="btn btn-dark" data-act="to-2">Continuar &rarr;</button>' +
      '</div>';
  }
  function field(id, label, type, val, req, full) {
    return '<div class="field ' + (full || "") + '">' +
      '<label for="' + id + '">' + label + (req ? '<span class="req">*</span>' : "") + "</label>" +
      '<input id="' + id + '" type="' + type + '" value="' + esc(val) + '"' +
      (type === "number" ? ' min="5" max="100"' : "") + ">" +
      "</div>";
  }
  function docTypeField(val) {
    return '<div class="field">' +
      '<label for="wz-doctype">Tipo de documento<span class="req">*</span></label>' +
      '<select id="wz-doctype">' + ["TI", "CC", "CE", "PP"].map(function (k) {
        return '<option value="' + k + '"' + (k === val ? " selected" : "") + ">" + esc(DOC_LABEL[k]) + "</option>";
      }).join("") + "</select>" +
      "</div>";
  }

  function viewStep2() {
    var cards = LEVELS.map(function (l) {
      var on = l.id === state.levelEstimate;
      return '<button type="button" class="wz-mod' + (on ? " is-on" : "") + '" data-level="' + l.id + '">' +
        '<span class="wz-mod-tag">' + esc(l.range) + "</span>" +
        '<span class="wz-mod-title">' + esc(l.label) + "</span>" +
        '<span class="wz-mod-desc">' + esc(l.desc) + "</span>" +
        (on ? '<span class="wz-mod-check">✓</span>' : "") +
        "</button>";
    }).join("");
    return '' +
      '<h2 class="wz-h">¿Con cuál nivel de inglés te identificas mejor?</h2>' +
      '<p class="wz-sub">Es solo una referencia para tu asesor — no define tu módulo final. Lo confirmamos contigo antes de empezar.</p>' +
      '<div class="wz-mods">' + cards + "</div>" +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-1">&larr; Atrás</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-3"' + (state.levelEstimate ? "" : " disabled") + ">Continuar &rarr;</button>" +
      "</div>";
  }

  function viewStep3() {
    var cards = TIME_SLOTS.map(function (t) {
      var on = t.id === state.timePreference;
      return '<button type="button" class="wz-slot' + (on ? " is-on" : "") + '" data-time="' + t.id + '">' +
        '<span class="wz-slot-days">' + esc(t.label) + "</span>" +
        '<span class="wz-slot-time">' + esc(t.range) + "</span>" +
        '<span class="wz-mod-desc">' + esc(t.desc) + "</span>" +
        (on ? '<span class="wz-mod-check">✓</span>' : "") +
        "</button>";
    }).join("");
    return '' +
      '<h2 class="wz-h">¿En qué franja horaria te gustaría tomar tus clases?</h2>' +
      '<p class="wz-sub">También es una preferencia, no una reserva — la disponibilidad depende del ciclo abierto y puede variar.</p>' +
      '<div class="wz-slots">' + cards + "</div>" +
      '<p class="wz-note">La franja que elijas nos ayuda a coordinar contigo, pero el horario final se confirma según los cupos y grupos disponibles al momento de tu inscripción — puede que no coincida exactamente con lo que elegiste aquí.</p>' +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-2">&larr; Atrás</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-4"' + (state.timePreference ? "" : " disabled") + ">Continuar &rarr;</button>" +
      "</div>";
  }

  function viewStep4() {
    var d = state.data, lvl = LEVEL_BY_ID[state.levelEstimate], tp = TIME_BY_ID[state.timePreference];
    var rows = [
      ["Nombre", d.name],
      ["Documento", (DOC_LABEL[d.docType] || d.docType) + ": " + d.docNumber],
      ["WhatsApp", d.phone],
      ["Correo", d.email],
      d.age ? ["Edad", d.age] : null,
      d.city ? ["Ciudad", d.city] : null,
      ["Nivel (tu autoevaluación)", lvl ? lvl.label + " (" + lvl.range + ")" : ""],
      ["Franja preferida", tp ? tp.label + " · " + tp.range : ""]
    ].filter(Boolean);
    return '' +
      '<h2 class="wz-h">Revisa y envía</h2>' +
      '<p class="wz-sub">Verifica que todo esté correcto. Esto es una solicitud de pre-inscripción: no se genera matrícula todavía. Un asesor de LEF revisará tus datos y te contactará por WhatsApp para continuar.</p>' +
      '<dl class="wz-review">' + rows.map(function (r) {
        return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
      }).join("") + "</dl>" +
      '<label class="wz-consent"><input type="checkbox" id="wz-ok"> Acepto que LEF me contacte por WhatsApp y correo para dar seguimiento a mi solicitud.</label>' +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-3"' + (state.submitting ? " disabled" : "") + ">&larr; Atrás</button>" +
        '<button type="button" class="btn btn-dark" data-act="submit"' + (state.submitting ? " disabled" : "") + ">" +
          (state.submitting ? "Enviando…" : "Enviar solicitud") + "</button>" +
      "</div>";
  }

  function viewResult() {
    var d = state.data, lvl = LEVEL_BY_ID[state.levelEstimate], tp = TIME_BY_ID[state.timePreference];
    var waMsg = "¡Hola! Acabo de enviar mi solicitud de pre-inscripción en LEF.\n" +
      "Nombre: " + d.name + "\n" +
      "Nivel con el que me identifico: " + (lvl ? lvl.label : "") + "\n" +
      "Franja horaria de mi preferencia: " + (tp ? tp.label : "") + "\n" +
      "Quedo atento(a) a que un asesor se comunique conmigo.";
    return '<div class="wz-card wz-done">' +
      '<div class="wz-done-badge">✓</div>' +
      '<h2 class="wz-h">¡Gracias! Recibimos tu solicitud</h2>' +
      '<p class="wz-sub">Un asesor de LEF se pondrá en contacto contigo pronto por WhatsApp para continuar con tu proceso de inscripción. También puedes escribirnos tú ahora.</p>' +
      '<dl class="wz-review">' +
        "<div><dt>Nombre</dt><dd>" + esc(d.name) + "</dd></div>" +
        "<div><dt>Nivel</dt><dd>" + esc(lvl ? lvl.label + " (" + lvl.range + ")" : "") + "</dd></div>" +
        "<div><dt>Franja preferida</dt><dd>" + esc(tp ? tp.label : "") + "</dd></div>" +
      "</dl>" +
      '<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' + waLink(waMsg) + '">' +
        '<img src="assets/icon-whatsapp-black.png" alt="" class="icn-inline">Escríbenos por WhatsApp</a>' +
      "</div>";
  }

  function waLink(msg) {
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
  }

  /* ---------- interaction ---------- */
  function render() {
    mount.innerHTML = view();
    bind();
  }

  function readStep1() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value : ""; };
    state.data = {
      name: g("wz-name"), docType: g("wz-doctype") || "CC", docNumber: g("wz-docnum"),
      phone: g("wz-phone"), email: g("wz-email"),
      age: g("wz-age"), city: g("wz-city")
    };
  }

  function go(step) { state.error = ""; state.step = step; render(); window.scrollTo({ top: mount.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" }); }

  function bind() {
    mount.querySelectorAll("input, select").forEach(function (el) {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", function () {
        if (state.step === 1) {
          readStep1();
          var btn = mount.querySelector('[data-act="to-2"]');
          if (btn) btn.disabled = !step1Valid();
        }
        if (el.id === "wz-ok") {
          var s = mount.querySelector('[data-act="submit"]');
          if (s) s.disabled = !el.checked || state.submitting;
        }
      });
    });

    mount.querySelectorAll("[data-level]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.levelEstimate = b.getAttribute("data-level");
        render();
      });
    });
    mount.querySelectorAll("[data-time]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.timePreference = b.getAttribute("data-time");
        render();
      });
    });

    mount.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () { handle(b.getAttribute("data-act")); });
    });

    if (state.step === 1) {
      var btn = mount.querySelector('[data-act="to-2"]');
      if (btn) btn.disabled = !step1Valid();
    }
    if (state.step === 4) {
      var s = mount.querySelector('[data-act="submit"]');
      var ok = document.getElementById("wz-ok");
      if (s) s.disabled = !(ok && ok.checked) || state.submitting;
    }
  }

  function handle(act) {
    if (act === "to-1") return go(1);
    if (act === "to-2") {
      if (state.step !== 1) { go(2); return; } // volviendo desde un paso posterior: no releer/validar el paso 1
      readStep1();
      if (!step1Valid()) { state.error = "Revisa el nombre, el documento, el WhatsApp y el correo."; return render(); }
      go(2);
      return;
    }
    if (act === "to-3") {
      if (!state.levelEstimate) return;
      go(3);
      return;
    }
    if (act === "to-4") {
      if (!state.timePreference) return;
      go(4);
      return;
    }
    if (act === "submit") return submit();
  }

  function submit() {
    var ok = document.getElementById("wz-ok");
    if (!ok || !ok.checked || state.submitting) return;
    state.submitting = true; state.error = ""; render();
    var d = state.data;
    rpc("create_preinscripcion", {
      p_full_name: d.name.trim(),
      p_whatsapp: d.phone.trim(),
      p_email: d.email.trim(),
      p_doc_type: d.docType || null,
      p_doc_number: d.docNumber ? d.docNumber.trim() : null,
      p_age: d.age ? parseInt(d.age, 10) : null,
      p_city: d.city ? d.city.trim() : null,
      p_level_estimate: state.levelEstimate,
      p_time_preference: state.timePreference
    }).then(function (id) {
      state.result = { id: id };
      state.submitting = false;
      render();
      window.scrollTo({ top: mount.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    }).catch(function (err) {
      state.submitting = false;
      var msg = (err && err.message) || "";
      if (msg.indexOf("LEF_PREINSCRIPCION_RECIENTE") === 0) {
        state.error = "Ya recibimos una solicitud tuya en las últimas horas. Nuestro equipo te contactará pronto — o escríbenos por WhatsApp.";
      } else if (msg.indexOf("LEF_MISSING_FIELDS") === 0) {
        state.error = "Faltan datos obligatorios. Revisa el nombre, el WhatsApp y el correo.";
      } else {
        state.error = "No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.";
      }
      render();
    });
  }

  render();
})();
