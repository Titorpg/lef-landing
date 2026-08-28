/* LEF — Asistente de inscripción (4 pasos)
   Paso 1 Tus datos · Paso 2 Elige tu nivel · Paso 3 Elige tu horario · Paso 4 Revisar
   Al confirmar: create_enrollment -> pantalla con número de matrícula + WhatsApp. */
(function () {
  "use strict";

  var mount = document.getElementById("enroll-app");
  if (!mount) return;

  var WHATSAPP_NUMBER = (window.LEF_WHATSAPP || "573013240652");
  var sb = window.lefSupabase;

  var DAY_ES = {
    Monday: "Lunes", Tuesday: "Martes", Wednesday: "Miércoles", Thursday: "Jueves",
    Friday: "Viernes", Saturday: "Sábado", Sunday: "Domingo"
  };
  var DAY_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

  var state = {
    step: 1,
    data: { name: "", docType: "CC", docNumber: "", phone: "", email: "", age: "", city: "" },
    modules: null,
    moduleId: null,
    schedules: null,
    scheduleId: null,
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
  function fmtTime(t) {
    if (!t) return "";
    var p = t.split(":"); var h = parseInt(p[0], 10); var m = p[1] || "00";
    var ap = h >= 12 ? "p.m." : "a.m."; var h12 = h % 12 || 12;
    return h12 + ":" + m + " " + ap;
  }
  function fmtDays(days) {
    if (!days || !days.length) return "";
    var sorted = days.slice().sort(function (a, b) { return DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b); });
    return sorted.map(function (d) { return DAY_ES[d] || d; }).join(" · ");
  }
  function selectedModule() {
    return (state.modules || []).find(function (m) { return m.id === state.moduleId; });
  }
  function selectedSchedule() {
    return (state.schedules || []).find(function (s) { return s.schedule_id === state.scheduleId; });
  }

  /* ---------- data ---------- */
  function rpc(fn, args) {
    if (!sb) return Promise.reject(new Error("sin-conexion"));
    return sb.rpc(fn, args || {}).then(function (res) {
      if (res.error) throw res.error;
      return res.data;
    });
  }
  function loadModules() {
    if (state.modules) return Promise.resolve();
    return rpc("get_public_modules").then(function (rows) { state.modules = rows || []; });
  }
  function loadSchedules() {
    state.schedules = null;
    return rpc("get_schedule_availability", { p_module_id: state.moduleId })
      .then(function (rows) {
        state.schedules = (rows || []).filter(function (r) { return r.active; });
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
    var labels = ["Tus datos", "Elige tu nivel", "Elige tu horario", "Revisar"];
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
      '<p class="wz-sub">Usaremos esta información para confirmar tu cupo y contactarte por WhatsApp.</p>' +
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
    if (!state.modules) return '<p class="wz-loading">Cargando niveles…</p>';
    var cards = state.modules.map(function (m) {
      var on = m.id === state.moduleId;
      return '<button type="button" class="wz-mod' + (on ? " is-on" : "") + '" data-mod="' + m.id + '">' +
        '<span class="wz-mod-tag">Módulo ' + m.module_number + " · " + esc(m.level) + "</span>" +
        '<span class="wz-mod-title">' + esc(m.title) + "</span>" +
        '<span class="wz-mod-desc">' + esc(m.description) + "</span>" +
        (on ? '<span class="wz-mod-check">✓</span>' : "") +
        "</button>";
    }).join("");
    return '' +
      '<h2 class="wz-h">¿Cuál es tu nivel de inglés?</h2>' +
      '<p class="wz-sub">Selecciona el nivel que deseas cursar. Si no estás seguro, elige tu mejor opción — lo confirmamos en tu primera clase.</p>' +
      '<div class="wz-mods">' + cards + "</div>" +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-1">&larr; Atrás</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-3"' + (state.moduleId ? "" : " disabled") + ">Continuar &rarr;</button>" +
      "</div>";
  }

  function viewStep3() {
    var mod = selectedModule();
    var head = '<h2 class="wz-h">Elige tu horario</h2>' +
      '<p class="wz-sub">Horarios disponibles para <strong>' + esc(mod ? mod.level + " — " + mod.title : "") + "</strong>.</p>";
    var body;
    if (!state.schedules) {
      body = '<p class="wz-loading">Cargando horarios…</p>';
    } else if (!state.schedules.length) {
      body = '<div class="wz-empty">' +
        '<p>No hay horarios disponibles para este nivel por el momento. Puedes elegir otro nivel o escribirnos por WhatsApp.</p>' +
        '<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="' + waLink(
          "Hola, quiero inscribirme en el nivel " + (mod ? mod.level + " (" + mod.title + ")" : "") +
          " pero no veo horarios disponibles. ¿Me ayudan?") + '">' +
        '<img src="assets/icon-whatsapp-black.png" alt="" class="icn-inline">Escríbenos por WhatsApp</a>' +
        "</div>";
    } else {
      body = '<div class="wz-slots">' + state.schedules.map(function (s) {
        var on = s.schedule_id === state.scheduleId;
        var full = s.is_full;
        return '<button type="button" class="wz-slot' + (on ? " is-on" : "") + (full ? " is-full" : "") + '"' +
          (full ? " disabled" : ' data-slot="' + s.schedule_id + '"') + ">" +
          '<span class="wz-slot-days">' + esc(fmtDays(s.days)) + "</span>" +
          '<span class="wz-slot-time">' + fmtTime(s.start_time) + " – " + fmtTime(s.end_time) + "</span>" +
          '<span class="wz-slot-seats">' + (full ? "Sin cupos" : (s.available + " cupo" + (s.available === 1 ? "" : "s") + " disponible" + (s.available === 1 ? "" : "s"))) + "</span>" +
          (on ? '<span class="wz-mod-check">✓</span>' : "") +
          "</button>";
      }).join("") + "</div>";
    }
    return head + body +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-2">&larr; Atrás</button>' +
        '<button type="button" class="btn btn-dark" data-act="to-4"' + (state.scheduleId ? "" : " disabled") + ">Continuar &rarr;</button>" +
      "</div>";
  }

  function viewStep4() {
    var d = state.data, mod = selectedModule(), sc = selectedSchedule();
    var rows = [
      ["Nombre", d.name],
      ["Documento", (DOC_LABEL[d.docType] || d.docType) + ": " + d.docNumber],
      ["WhatsApp", d.phone],
      ["Correo", d.email],
      d.age ? ["Edad", d.age] : null,
      d.city ? ["Ciudad", d.city] : null,
      ["Nivel", mod ? "Módulo " + mod.module_number + " · " + mod.level + " — " + mod.title : ""],
      ["Días", sc ? fmtDays(sc.days) : ""],
      ["Horario", sc ? fmtTime(sc.start_time) + " – " + fmtTime(sc.end_time) : ""]
    ].filter(Boolean);
    return '' +
      '<h2 class="wz-h">Revisa y confirma</h2>' +
      '<p class="wz-sub">Verifica que todo esté correcto. Al confirmar, generaremos tu número de matrícula.</p>' +
      '<dl class="wz-review">' + rows.map(function (r) {
        return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>";
      }).join("") + "</dl>" +
      '<label class="wz-consent"><input type="checkbox" id="wz-ok"> Acepto que LEF me contacte por WhatsApp y correo para completar mi inscripción.</label>' +
      '<div class="wz-nav">' +
        '<button type="button" class="btn btn-outline-dark" data-act="to-3"' + (state.submitting ? " disabled" : "") + ">&larr; Atrás</button>" +
        '<button type="button" class="btn btn-dark" data-act="submit"' + (state.submitting ? " disabled" : "") + ">" +
          (state.submitting ? "Enviando…" : "Confirmar inscripción") + "</button>" +
      "</div>";
  }

  function viewResult() {
    var r = state.result;
    var waMsg = "¡Hola! Acabo de inscribirme en LEF.\n" +
      "Matrícula: " + r.registration_number + "\n" +
      "Nombre: " + state.data.name + "\n" +
      "Nivel: " + (r.module_level || "") + " — " + (r.module_title || "") + "\n" +
      "Horario: " + fmtDays(r.schedule_days) + ", " + fmtTime(r.schedule_start_time) + " – " + fmtTime(r.schedule_end_time) + "\n" +
      "Quedo atento(a) para confirmar el cupo y el pago.";
    return '<div class="wz-card wz-done">' +
      '<div class="wz-done-badge">✓</div>' +
      '<h2 class="wz-h">¡Inscripción registrada!</h2>' +
      '<p class="wz-sub">Guarda tu número de matrícula. Nuestro equipo te contactará por WhatsApp para confirmar el cupo y el pago.</p>' +
      '<div class="wz-regnum">' + esc(r.registration_number) + "</div>" +
      '<dl class="wz-review">' +
        "<div><dt>Nombre</dt><dd>" + esc(r.student_full_name || state.data.name) + "</dd></div>" +
        "<div><dt>Nivel</dt><dd>" + esc((r.module_level || "") + " — " + (r.module_title || "")) + "</dd></div>" +
        "<div><dt>Días</dt><dd>" + esc(fmtDays(r.schedule_days)) + "</dd></div>" +
        "<div><dt>Horario</dt><dd>" + esc(fmtTime(r.schedule_start_time) + " – " + fmtTime(r.schedule_end_time)) + "</dd></div>" +
        (r.teacher_full_name ? "<div><dt>Profesor(a)</dt><dd>" + esc(r.teacher_full_name) + "</dd></div>" : "") +
      "</dl>" +
      '<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' + waLink(waMsg) + '">' +
        '<img src="assets/icon-whatsapp-black.png" alt="" class="icn-inline">Continuar por WhatsApp</a>' +
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

    mount.querySelectorAll("[data-mod]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.moduleId = b.getAttribute("data-mod");
        state.scheduleId = null;
        render();
      });
    });
    mount.querySelectorAll("[data-slot]").forEach(function (b) {
      b.addEventListener("click", function () {
        state.scheduleId = b.getAttribute("data-slot");
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
      readStep1();
      if (!step1Valid()) { state.error = "Revisa el nombre, el documento, el WhatsApp y el correo."; return render(); }
      go(2);
      loadModules().then(render).catch(function () { state.error = "No pudimos cargar los niveles. Intenta de nuevo."; render(); });
      return;
    }
    if (act === "to-3") {
      if (!state.moduleId) return;
      go(3);
      loadSchedules().then(render).catch(function () { state.error = "No pudimos cargar los horarios. Intenta de nuevo."; render(); });
      return;
    }
    if (act === "to-4") {
      if (!state.scheduleId) return;
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
    rpc("create_enrollment", {
      p_full_name: d.name.trim(),
      p_whatsapp: d.phone.trim(),
      p_email: d.email.trim(),
      p_module_id: state.moduleId,
      p_schedule_id: state.scheduleId,
      p_doc_type: d.docType,
      p_doc_number: d.docNumber.trim(),
      p_age: d.age ? parseInt(d.age, 10) : null,
      p_city: d.city ? d.city.trim() : null
    }).then(function (rows) {
      var row = Array.isArray(rows) ? rows[0] : rows;
      return rpc("get_enrollment_confirmation", { p_id: row.enrollment_id });
    }).then(function (conf) {
      state.result = Array.isArray(conf) ? conf[0] : conf;
      state.submitting = false;
      render();
      window.scrollTo({ top: mount.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
    }).catch(function (err) {
      state.submitting = false;
      var msg = (err && err.message) || "";
      if (msg.indexOf("LEF_DUPLICATE_REGISTRATION") === 0) {
        state.error = "Ya existe una inscripción con este correo, WhatsApp o documento para el ciclo actual (" +
          msg.split(":")[1] + "). Escríbenos por WhatsApp si necesitas ayuda.";
      } else if (msg.indexOf("LEF_CYCLE_CLOSED") === 0) {
        state.error = "El ciclo de inscripción está cerrado por ahora. Escríbenos por WhatsApp para más información.";
      } else if (msg.indexOf("LEF_NO_AVAILABLE_GROUP") === 0 || msg.indexOf("LEF_GROUP_FULL") === 0) {
        state.error = "Ese horario acaba de llenarse. Elige otro horario, por favor.";
        state.scheduleId = null;
      } else {
        state.error = "No pudimos completar tu inscripción. Intenta de nuevo o escríbenos por WhatsApp.";
      }
      render();
    });
  }

  render();
})();
