/* LEF — Asistente de pre-inscripción (4 pasos)
   Paso 1 Tus datos · Paso 2 Tu nivel (autoevaluación) · Paso 3 Franja horaria
   (preferencia) · Paso 4 Revisar.
   El nivel y la franja horaria son solo INDICADORES para el asesor — no
   reservan cupo ni módulo. Al enviar: create_preinscripcion -> queda en la
   lista de "Pre-inscritos" del panel. El admin contacta a la persona y, si
   acuerdan el inicio, crea el estudiante desde el panel (ahí sí se elige el
   módulo, el horario y el grupo reales, con cupo y matrícula). El formulario
   NO crea estudiantes ni inscripciones.
   Todos los textos vienen de window.LEF_I18N (definido en script.js) según el
   idioma activo (localStorage "lef-lang"); al cambiar de idioma con el
   selector del header se dispara "lef:langchange" y el asistente se vuelve a
   dibujar en el idioma nuevo sin perder lo que el usuario ya escribió. */
(function () {
  "use strict";

  var mount = document.getElementById("enroll-app");
  if (!mount) return;

  var WHATSAPP_NUMBER = (window.LEF_WHATSAPP || "573173962244");
  var sb = window.lefSupabase;

  var FALLBACK_ES = {
    step_data: "Tus datos", step_level: "Tu nivel", step_time: "Franja horaria", step_review: "Revisar",
    h1: "Cuéntanos sobre ti", sub1: "Usaremos esta información para contactarte por WhatsApp y continuar tu proceso.",
    name: "Nombre completo del estudiante", doctype: "Tipo de documento", docnum: "Número de documento",
    phone: "Número de WhatsApp", email: "Correo electrónico", age: "Edad", city: "Ciudad",
    doc_ti: "Tarjeta de identidad", doc_cc: "Cédula de ciudadanía", doc_ce: "Cédula de extranjería", doc_pp: "Pasaporte",
    continue: "Continuar →", back: "← Atrás",
    err_step1: "Revisa el nombre, el documento, el WhatsApp y el correo.",
    h2: "¿Con cuál nivel de inglés te identificas mejor?",
    sub2: "Es solo una referencia para tu asesor — no define tu módulo final. Lo confirmamos contigo antes de empezar.",
    lvl_beginner_label: "Principiante", lvl_beginner_range: "A1 – A2",
    lvl_beginner_desc: "Conoces lo básico: saludar, presentarte, contar, hablar de tu rutina. Te cuesta mantener una conversación completa en inglés.",
    lvl_intermediate_label: "Intermedio", lvl_intermediate_range: "B1 – B2",
    lvl_intermediate_desc: "Puedes conversar sobre temas cotidianos, entender textos o videos sencillos, y dar tu opinión, aunque cometas errores.",
    lvl_advanced_label: "Avanzado", lvl_advanced_range: "C1 en adelante",
    lvl_advanced_desc: "Te comunicas con fluidez en la mayoría de los temas, entiendes contenido complejo y buscas perfeccionar tu nivel.",
    h3: "¿En qué franja horaria te gustaría tomar tus clases?",
    sub3: "También es una preferencia, no una reserva — la disponibilidad depende del ciclo abierto y puede variar.",
    time_morning_label: "Mañana", time_morning_range: "6:00 a.m. – 12:00 p.m.",
    time_morning_desc: "Ideal si estudias o trabajas en jornada de tarde o noche.",
    time_afternoon_label: "Tarde", time_afternoon_range: "12:00 p.m. – 6:00 p.m.",
    time_afternoon_desc: "La franja más solicitada — revisa que no choque con almuerzo o salida del colegio.",
    time_evening_label: "Noche", time_evening_range: "6:00 p.m. – 9:00 p.m.",
    time_evening_desc: "Pensada para quienes trabajan o estudian durante el día.",
    note3: "La franja que elijas nos ayuda a coordinar contigo, pero el horario final se confirma según los cupos y grupos disponibles al momento de tu inscripción — puede que no coincida exactamente con lo que elegiste aquí.",
    h4: "Revisa y envía",
    sub4: "Verifica que todo esté correcto. Esto es una solicitud de pre-inscripción: no se genera matrícula todavía. Un asesor de LEF revisará tus datos y te contactará por WhatsApp para continuar.",
    row_name: "Nombre", row_doc: "Documento", row_wa: "WhatsApp", row_email: "Correo",
    row_level: "Nivel (tu autoevaluación)", row_time: "Franja preferida",
    consent: "Acepto que LEF me contacte por WhatsApp y correo para dar seguimiento a mi solicitud.",
    submit: "Enviar solicitud", submitting: "Enviando…",
    done_h: "¡Gracias! Recibimos tu solicitud",
    done_sub: "Un asesor de LEF se pondrá en contacto contigo pronto por WhatsApp para continuar con tu proceso de inscripción. También puedes escribirnos tú ahora.",
    done_level: "Nivel", done_wa: "Escríbenos por WhatsApp",
    err_recent: "Ya recibimos una solicitud tuya en las últimas horas. Nuestro equipo te contactará pronto — o escríbenos por WhatsApp.",
    err_missing: "Faltan datos obligatorios. Revisa el nombre, el WhatsApp y el correo.",
    err_generic: "No pudimos enviar tu solicitud. Intenta de nuevo o escríbenos por WhatsApp.",
    wa_result: "¡Hola! Acabo de enviar mi solicitud de pre-inscripción en LEF.\nNombre: {name}\nNivel con el que me identifico: {level}\nFranja horaria de mi preferencia: {time}\nQuedo atento(a) a que un asesor se comunique conmigo."
  };

  function lang() {
    try {
      var saved = localStorage.getItem("lef-lang");
      if (saved === "en" || saved === "es") return saved;
    } catch (e) {}
    return "es";
  }
  function T() {
    var dict = window.LEF_I18N;
    if (dict && dict[lang()] && dict[lang()].wz) return dict[lang()].wz;
    return FALLBACK_ES;
  }
  function LEVELS(t) {
    return [
      { id: "beginner", label: t.lvl_beginner_label, range: t.lvl_beginner_range, desc: t.lvl_beginner_desc },
      { id: "intermediate", label: t.lvl_intermediate_label, range: t.lvl_intermediate_range, desc: t.lvl_intermediate_desc },
      { id: "advanced", label: t.lvl_advanced_label, range: t.lvl_advanced_range, desc: t.lvl_advanced_desc }
    ];
  }
  function TIME_SLOTS(t) {
    return [
      { id: "morning", label: t.time_morning_label, range: t.time_morning_range, desc: t.time_morning_desc },
      { id: "afternoon", label: t.time_afternoon_label, range: t.time_afternoon_range, desc: t.time_afternoon_desc },
      { id: "evening", label: t.time_evening_label, range: t.time_evening_range, desc: t.time_evening_desc }
    ];
  }
  function DOC_LABEL(t) {
    return { TI: t.doc_ti, CC: t.doc_cc, CE: t.doc_ce, PP: t.doc_pp };
  }

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

  /* ---------- render ---------- */
  function stepper(t) {
    var labels = [t.step_data, t.step_level, t.step_time, t.step_review];
    var done = state.result ? 5 : state.step;
    return '<ol class="wz-steps">' + labels.map(function (l, i) {
      var n = i + 1;
      var cls = n < done ? "is-done" : (n === done ? "is-current" : "");
      return '<li class="' + cls + '"><span class="wz-dot">' +
        (n < done ? "✓" : n) + '</span><span class="wz-lab">' + esc(l) + "</span></li>";
    }).join("") + "</ol>";
  }

  function view(t) {
    if (state.result) return viewResult(t);
    var body =
      state.step === 1 ? viewStep1(t) :
      state.step === 2 ? viewStep2(t) :
      state.step === 3 ? viewStep3(t) : viewStep4(t);
    return '<div class="wz-card">' + stepper(t) +
      (state.error ? '<p class="wz-alert">' + esc(state.error) + "</p>" : "") +
      body + "</div>";
  }

  function viewStep1(t) {
    var d = state.data;
    return '' +
      '<h2 class="wz-h">' + esc(t.h1) + '</h2>' +
      '<p class="wz-sub">' + esc(t.sub1) + '</p>' +
      '<div class="wz-grid">' +
        field("wz-name", t.name, "text", d.name, true, "full") +
        docTypeField(t, d.docType) +
        field("wz-docnum", t.docnum, "text", d.docNumber, true) +
        field("wz-phone", t.phone, "tel", d.phone, true) +
        field("wz-email", t.email, "email", d.email, true) +
        field("wz-age", t.age, "number", d.age, false) +
        field("wz-city", t.city, "text", d.city, false) +
      '</div>' +
      '<div class="wz-nav wz-nav-end">' +
        '<button type="button" class="btn btn-dark" data-act="to-2">' + esc(t.continue) + '</button>' +
      '</div>';
  }
  function field(id, label, type, val, req, full) {
    return '<div class="field ' + (full || "") + '">' +
      '<label for="' + id + '">' + esc(label) + (req ? '<span class="req">*</span>' : "") + "</label>" +
      '<input id="' + id + '" type="' + type + '" value="' + esc(val) + '"' +
      (type === "number" ? ' min="5" max="100"' : "") + ">" +
      "</div>";
  }
  function docTypeField(t, val) {
    var docLabel = DOC_LABEL(t);
    return '<div class="field">' +
      '<label for="wz-doctype">' + esc(t.doctype) + '<span class="req">*</span></label>' +
      '<select id="wz-doctype">' + ["TI", "CC", "CE", "PP"].map(function (k) {
        return '<option value="' + k + '"' + (k === val ? " selected" : "") + ">" + esc(docLabel[k]) + "</option>";
      }).join("") + "</select>" +
      "</div>";
  }

  function viewStep2(t) {
    var cards = LEVELS(t).map(function (l) {
      var on = l.id === state.levelEstimate;
      return '<button type="button" class="wz-mod' + (on ? " is-on" : "") + '" data-level="' + l.id + '">' +
        '<span class="wz-mod-tag">' + esc(l.range) + "</span>" +
        '<span class="wz-mod-title">' + esc(l.label) + "</span>" +
        '<span class="wz-mod-desc">' + esc(l.desc) + "</span>" +
        (on ? '<span class="wz-mod-check">✓</span>' : "") +
        "</button>";
    }).join("");
    return '' +
      '<h2 class="wz-h">' + esc(t.h2) + '</h2>' +
      '<p class="wz-sub">' + esc(t.sub2) + '</p>' +
      '<div class="wz-mods">' + cards + "</div>" +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-1">' + esc(t.back) + '</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-3"' + (state.levelEstimate ? "" : " disabled") + ">" + esc(t.continue) + "</button>" +
      "</div>";
  }

  function viewStep3(t) {
    var cards = TIME_SLOTS(t).map(function (s) {
      var on = s.id === state.timePreference;
      return '<button type="button" class="wz-slot' + (on ? " is-on" : "") + '" data-time="' + s.id + '">' +
        '<span class="wz-slot-days">' + esc(s.label) + "</span>" +
        '<span class="wz-slot-time">' + esc(s.range) + "</span>" +
        '<span class="wz-mod-desc">' + esc(s.desc) + "</span>" +
        (on ? '<span class="wz-mod-check">✓</span>' : "") +
        "</button>";
    }).join("");
    return '' +
      '<h2 class="wz-h">' + esc(t.h3) + '</h2>' +
      '<p class="wz-sub">' + esc(t.sub3) + '</p>' +
      '<div class="wz-slots">' + cards + "</div>" +
      '<p class="wz-note">' + esc(t.note3) + '</p>' +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-2">' + esc(t.back) + '</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-4"' + (state.timePreference ? "" : " disabled") + ">" + esc(t.continue) + "</button>" +
      "</div>";
  }

  function viewStep4(t) {
    var d = state.data, lvl = byId(LEVELS(t), state.levelEstimate), tp = byId(TIME_SLOTS(t), state.timePreference);
    var docLabel = DOC_LABEL(t);
    var rows = [
      [t.row_name, d.name],
      [t.row_doc, (docLabel[d.docType] || d.docType) + ": " + d.docNumber],
      [t.row_wa, d.phone],
      [t.row_email, d.email],
      d.age ? [t.age, d.age] : null,
      d.city ? [t.city, d.city] : null,
      [t.row_level, lvl ? lvl.label + " (" + lvl.range + ")" : ""],
      [t.row_time, tp ? tp.label + " · " + tp.range : ""]
    ].filter(Boolean);
    return '' +
      '<h2 class="wz-h">' + esc(t.h4) + '</h2>' +
      '<p class="wz-sub">' + esc(t.sub4) + '</p>' +
      '<dl class="wz-review">' + rows.map(function (r) {
        return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
      }).join("") + "</dl>" +
      '<label class="wz-consent"><input type="checkbox" id="wz-ok"> ' + esc(t.consent) + '</label>' +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-3"' + (state.submitting ? " disabled" : "") + ">" + esc(t.back) + "</button>" +
        '<button type="button" class="btn btn-dark" data-act="submit"' + (state.submitting ? " disabled" : "") + ">" +
          esc(state.submitting ? t.submitting : t.submit) + "</button>" +
      "</div>";
  }

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function viewResult(t) {
    var d = state.data, lvl = byId(LEVELS(t), state.levelEstimate), tp = byId(TIME_SLOTS(t), state.timePreference);
    var waMsg = t.wa_result
      .replace("{name}", d.name)
      .replace("{level}", lvl ? lvl.label : "")
      .replace("{time}", tp ? tp.label : "");
    return '<div class="wz-card wz-done">' +
      '<div class="wz-done-badge">✓</div>' +
      '<h2 class="wz-h">' + esc(t.done_h) + '</h2>' +
      '<p class="wz-sub">' + esc(t.done_sub) + '</p>' +
      '<dl class="wz-review">' +
        "<div><dt>" + esc(t.row_name) + "</dt><dd>" + esc(d.name) + "</dd></div>" +
        "<div><dt>" + esc(t.done_level) + "</dt><dd>" + esc(lvl ? lvl.label + " (" + lvl.range + ")" : "") + "</dd></div>" +
        "<div><dt>" + esc(t.row_time) + "</dt><dd>" + esc(tp ? tp.label : "") + "</dd></div>" +
      "</dl>" +
      '<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' + waLink(waMsg) + '">' +
        '<img src="assets/icon-whatsapp-black.png" alt="" class="icn-inline">' + esc(t.done_wa) + '</a>' +
      "</div>";
  }

  function waLink(msg) {
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(msg);
  }

  /* ---------- interaction ---------- */
  function render() {
    var t = T();
    mount.innerHTML = view(t);
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
      if (!step1Valid()) { state.error = T().err_step1; return render(); }
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
      var t = T();
      if (msg.indexOf("LEF_PREINSCRIPCION_RECIENTE") === 0) {
        state.error = t.err_recent;
      } else if (msg.indexOf("LEF_MISSING_FIELDS") === 0) {
        state.error = t.err_missing;
      } else {
        state.error = t.err_generic;
      }
      render();
    });
  }

  document.addEventListener("lef:langchange", render);

  render();
})();
