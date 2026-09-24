/* LEF — calendario propio de la plataforma (reemplaza a Google Calendar).
   Lo usan el panel (admin y profesor, editable) y el portal del estudiante
   (solo lectura). Los datos salen de get_my_calendar(): las clases se calculan
   de los grupos (días + hora del horario, entre las fechas del ciclo) y los
   eventos de la tabla calendar_events. Quién ve qué lo decide la BD.

   Uso: LEFCalendar.mount(contenedor, {
          sb,                      cliente de Supabase
          role: "admin" | "teacher" | "student",
          teacherId,               (profesor) para listar SUS grupos
          toast                    opcional, fn(mensaje, "ok"|"err")
        }) */
(function () {
  "use strict";

  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function keyOf(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parseKey(k) { var p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function fmtTime(t) {
    if (!t) return "";
    var p = String(t).split(":"), hh = +p[0];
    return (hh % 12 || 12) + ":" + p[1] + (hh >= 12 ? " p. m." : " a. m.");
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function longDay(d) { return cap(d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })); }

  var DAY_ES = { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié", Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom" };
  var DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

  // Mismos colores por módulo que el resto del panel (module_number 1..15).
  var MODULE_COLORS = ["#2e4e9e", "#4a86c5", "#5bb1a9", "#6f9d4a", "#b3a133", "#cf8b3b",
                       "#c15b4a", "#9a5aa3", "#5f6bd0", "#7d8794", "#3aa0a0", "#33415c",
                       "#b5476b", "#2c7a5a", "#8a6d3b"];

  // Tipos de anotación. "clase" no se crea a mano: sale de los grupos.
  var CATS = {
    clase:      { label: "Clase",      color: "#2e4e9e" },
    actividad:  { label: "Actividad",  color: "#2e4e9e" },
    evaluacion: { label: "Evaluación", color: "#8a2b2b" },
    evento:     { label: "Evento",     color: "#8a6d1a" },
    aviso:      { label: "Aviso",      color: "#262626" },
    sin_clase:  { label: "Sin clase",  color: "#8c8c8c" }
  };
  var CATS_BY_ROLE = {
    teacher: ["actividad", "evaluacion", "aviso", "sin_clase"],
    admin:   ["evento", "aviso", "actividad", "evaluacion", "sin_clase"]
  };
  var AUDIENCE_ES = {
    personal: "Solo para mí", teachers: "Profesores", students: "Estudiantes", all: "Profesores y estudiantes"
  };

  function colorOf(it) {
    if (it.item_type === "class") return MODULE_COLORS[((it.module_number || 1) - 1) % MODULE_COLORS.length];
    return (CATS[it.category] || CATS.actividad).color;
  }
  function audienceLabel(it, role) {
    if (it.audience === "group") return "Grupo " + (it.group_label || "");
    if (role === "student") return "";
    return AUDIENCE_ES[it.audience] || "";
  }
  function whenLabel(it) {
    if (!it.start_time) {
      if (it.ends_on !== it.starts_on) return "Del " + longDay(parseKey(it.starts_on)) + " al " + longDay(parseKey(it.ends_on));
      return "Todo el día";
    }
    return fmtTime(it.start_time) + (it.end_time ? " – " + fmtTime(it.end_time) : "");
  }
  function friendly(e) {
    var m = (e && (e.message || e.error_description)) || String(e || "");
    if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para publicar eso (revisa a quién va dirigido).";
    if (/calendar_events_times/.test(m)) return "Revisa las horas: la de fin debe ser después de la de inicio, y un evento con hora debe ser de un solo día.";
    if (/calendar_events_dates/.test(m)) return "Revisa las fechas: la de fin no puede ser antes de la de inicio (máximo 90 días).";
    if (/link_url/.test(m)) return "El enlace debe empezar por https://";
    if (/title/.test(m) && /check/i.test(m)) return "Escribe un título (mínimo 2 letras).";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    return m || "Algo salió mal.";
  }

  // Ventana modal con los estilos del panel (.pnl-modal). actions: [{label, cls, fn}]
  // — fn devuelve promesa; si se resuelve, se cierra.
  function openModal(title, bodyNode, actions) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h('<div class="pnl-modal"><h3>' + esc(title) + "</h3></div>");
    box.appendChild(bodyNode);
    var err = h('<div class="pnl-alert err" style="display:none;margin-top:10px"></div>');
    box.appendChild(err);
    var row = h('<div class="row" style="flex-wrap:wrap"></div>');
    (actions || []).forEach(function (a) {
      var b = h('<button type="button" class="btn ' + (a.cls || "btn-ghost") + '">' + esc(a.label) + "</button>");
      if (a.left) b.style.marginRight = "auto";
      b.onclick = function () {
        if (!a.fn) return close();
        b.disabled = true; err.style.display = "none";
        Promise.resolve().then(a.fn).then(function (keep) { if (keep !== true) close(); }).catch(function (e) {
          err.textContent = friendly(e); err.style.display = "block"; b.disabled = false;
        });
      };
      row.appendChild(b);
    });
    box.appendChild(row);
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); document.removeEventListener("keydown", onKey); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    return { close: close, box: box };
  }

  function storeGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

  function mount(root, opts) {
    var sb = opts.sb, role = opts.role;
    var editable = role === "admin" || role === "teacher";
    var toast = opts.toast || function () {};
    var groupsPromise = null;
    var hidden = {};   // tipos ocultos con el filtro de la leyenda
    var view = storeGet("lef-cal-view") || (window.matchMedia("(max-width:640px)").matches ? "agenda" : "month");
    var cur = new Date(); cur = new Date(cur.getFullYear(), cur.getMonth(), 1);
    var items = [];

    root.innerHTML = "";
    var bar = h(
      '<div class="cal-bar">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-today>Hoy</button>' +
      '<button type="button" class="cal-nav" data-prev aria-label="Mes anterior">&lsaquo;</button>' +
      '<button type="button" class="cal-nav" data-next aria-label="Mes siguiente">&rsaquo;</button>' +
      '<h2 class="cal-title" data-title></h2>' +
      '<span class="muted cal-status" data-status></span>' +
      '<div class="cal-bar__end">' +
      '<div class="cal-seg" role="tablist"><button type="button" data-view="month">Mes</button><button type="button" data-view="agenda">Agenda</button></div>' +
      (editable ? '<button type="button" class="btn btn-sm btn-dark" data-new>+ Nuevo</button>' : "") +
      "</div></div>"
    );
    var legend = h('<div class="cal-legend"></div>');
    var body = h("<div></div>");
    root.appendChild(bar); root.appendChild(legend); root.appendChild(body);

    bar.querySelector("[data-today]").onclick = function () { var n = new Date(); cur = new Date(n.getFullYear(), n.getMonth(), 1); load(); };
    bar.querySelector("[data-prev]").onclick = function () { cur = new Date(cur.getFullYear(), cur.getMonth() - 1, 1); load(); };
    bar.querySelector("[data-next]").onclick = function () { cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); load(); };
    bar.querySelectorAll("[data-view]").forEach(function (b) {
      b.onclick = function () { view = b.getAttribute("data-view"); storeSet("lef-cal-view", view); paint(); };
    });
    if (editable) bar.querySelector("[data-new]").onclick = function () { editEvent(null, keyOf(new Date())); };

    function range() {
      var first = cur;
      var gridStart = addDays(first, -((first.getDay() + 6) % 7));
      var last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
      var gridEnd = addDays(last, 6 - ((last.getDay() + 6) % 7));
      return { start: gridStart, end: gridEnd, first: first, last: last };
    }

    function load() {
      var r = range();
      var t = cur.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
      bar.querySelector("[data-title]").textContent = cap(t);
      var status = bar.querySelector("[data-status]");
      status.textContent = "Cargando…";
      var token = {}; load.token = token;
      sb.rpc("get_my_calendar", { p_from: keyOf(r.start), p_to: keyOf(r.end) }).then(function (res) {
        if (load.token !== token) return;
        if (res.error) throw res.error;
        items = res.data || [];
        status.textContent = "";
        paint();
      }).catch(function (e) {
        if (load.token !== token) return;
        status.textContent = "";
        items = [];
        paint();
        body.prepend(h('<div class="pnl-alert err" style="margin-bottom:12px">No pudimos cargar el calendario: ' + esc(friendly(e)) + "</div>"));
      });
    }

    function visible() {
      return items.filter(function (it) { return !hidden[it.item_type === "class" ? "clase" : it.category]; });
    }

    function paintLegend() {
      legend.innerHTML = "";
      var present = {};
      items.forEach(function (it) { present[it.item_type === "class" ? "clase" : it.category] = true; });
      Object.keys(CATS).forEach(function (k) {
        if (!present[k]) return;
        var chip = h('<button type="button" class="cal-chip' + (hidden[k] ? " is-off" : "") + '" aria-pressed="' + (!hidden[k]) + '">' +
          '<span class="cal-dot" style="background:' + (k === "clase" ? "var(--ink)" : CATS[k].color) + '"></span>' +
          esc(k === "clase" ? "Clases" : CATS[k].label) + "</button>");
        chip.onclick = function () { hidden[k] = !hidden[k]; paint(); };
        legend.appendChild(chip);
      });
    }

    function paint() {
      bar.querySelectorAll("[data-view]").forEach(function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-view") === view);
      });
      paintLegend();
      body.innerHTML = "";
      if (view === "agenda") paintAgenda(); else paintMonth();
    }

    // Reparte cada elemento en los días que ocupa (los de varios días, en todos).
    function byDay(list, from, to) {
      var map = {};
      list.forEach(function (it) {
        var d = parseKey(it.starts_on), end = parseKey(it.ends_on);
        if (d < from) d = new Date(from);
        for (var i = 0; d <= end && d <= to && i < 100; i++) {
          var k = keyOf(d);
          (map[k] = map[k] || []).push(it);
          d = addDays(d, 1);
        }
      });
      Object.keys(map).forEach(function (k) {
        map[k].sort(function (a, b) {
          var aa = !a.start_time, bb = !b.start_time;
          if (aa !== bb) return aa ? -1 : 1;
          return String(a.start_time || "").localeCompare(String(b.start_time || ""));
        });
      });
      return map;
    }

    function chip(it) {
      var c = colorOf(it);
      var cls = "cal-ev" + (it.cancelled ? " is-cancelled" : "");
      var el;
      if (!it.start_time) {
        el = h('<div class="' + cls + ' cal-ev--allday" style="background:' + c + ';--c:' + c + '">' + esc(it.title) + "</div>");
      } else {
        el = h('<div class="' + cls + '" style="--c:' + c + '"><span class="cal-dot" style="background:' + c + '"></span>' +
          '<span class="cal-ev__time">' + esc(fmtTime(it.start_time).replace(/ ([ap])\. m\./, "$1")) + "</span> " + esc(it.title) + "</div>");
      }
      el.title = it.title + (it.cancelled ? " (sin clase)" : "");
      el.addEventListener("click", function (e) { e.stopPropagation(); showItem(it); });
      return el;
    }

    function paintMonth() {
      var r = range(), map = byDay(visible(), r.start, r.end), todayKey = keyOf(new Date());
      var grid = h('<div class="cal-grid"></div>');
      DOW.forEach(function (d) { grid.appendChild(h('<div class="cal-dow">' + d + "</div>")); });
      for (var d = new Date(r.start); d <= r.end; d = addDays(d, 1)) {
        (function (day) {
          var k = keyOf(day), list = map[k] || [];
          var cell = h('<div class="cal-cell' + (day.getMonth() !== cur.getMonth() ? " is-out" : "") +
            (k === todayKey ? " is-today" : "") + (list.length || editable ? " is-clickable" : "") + '">' +
            '<span class="cal-num">' + day.getDate() + '</span><div class="cal-evs"></div></div>');
          var box = cell.querySelector(".cal-evs");
          list.slice(0, 3).forEach(function (it) { box.appendChild(chip(it)); });
          if (list.length > 3) box.appendChild(h('<div class="cal-more">+' + (list.length - 3) + " más</div>"));
          if (list.length || editable) {
            cell.addEventListener("click", function () {
              // Día vacío + panel editable: directo a crear en ese día.
              if (!list.length) editEvent(null, k); else dayDetail(day, list);
            });
          }
          grid.appendChild(cell);
        })(new Date(d));
      }
      body.appendChild(grid);
      if (!items.length) body.appendChild(h('<p class="muted" style="margin-top:10px;font-size:13.5px">' +
        (editable ? "No hay nada programado este mes. Toca un día para agregar algo." : "No hay nada programado este mes.") + "</p>"));
    }

    // Lista por días del mes visible (desde hoy si es el mes en curso).
    function paintAgenda() {
      var r = range(), today = new Date(); today.setHours(0, 0, 0, 0);
      var from = r.first, isThisMonth = today >= r.first && today <= r.last;
      if (isThisMonth) from = today;
      var map = byDay(visible(), from, r.last);
      var keys = Object.keys(map).sort();
      var list = h('<div class="cal-agenda"></div>');
      keys.forEach(function (k) {
        var day = parseKey(k), isToday = keyOf(today) === k;
        var sec = h('<section class="cal-agenda__day' + (isToday ? " is-today" : "") + '">' +
          '<div class="cal-agenda__date"><span class="cal-agenda__num">' + day.getDate() + "</span>" +
          '<span class="cal-agenda__dow">' + esc(isToday ? "Hoy" : DOW[(day.getDay() + 6) % 7]) + "</span></div>" +
          '<div class="cal-agenda__items"></div></section>');
        var box = sec.querySelector(".cal-agenda__items");
        map[k].forEach(function (it) {
          var c = colorOf(it);
          var row = h('<button type="button" class="cal-agenda__item' + (it.cancelled ? " is-cancelled" : "") + '" style="--c:' + c + '">' +
            '<span class="cal-agenda__bar"></span>' +
            '<span class="cal-agenda__main"><strong>' + esc(it.title) + (it.cancelled ? " · sin clase" : "") + "</strong>" +
            '<span class="muted">' + esc([whenLabel(it), it.item_type === "class" ? it.details : audienceLabel(it, role)].filter(Boolean).join(" · ")) + "</span></span>" +
            "</button>");
          row.onclick = function () { showItem(it); };
          box.appendChild(row);
        });
        list.appendChild(sec);
      });
      if (!keys.length) {
        list.appendChild(h('<p class="muted" style="font-size:13.5px">' +
          (isThisMonth ? "No hay nada más programado este mes." : "No hay nada programado este mes.") + "</p>"));
      }
      body.appendChild(list);
    }

    function dayDetail(day, list) {
      var k = keyOf(day);
      var box = h("<div></div>");
      list.forEach(function (it) {
        var c = colorOf(it);
        var row = h('<button type="button" class="cal-detail cal-detail--btn' + (it.cancelled ? " is-cancelled" : "") + '">' +
          '<span class="cal-dot" style="background:' + c + ';margin-top:7px"></span>' +
          '<span style="flex:1;min-width:0;text-align:left"><span style="display:block;font-weight:600;font-size:14px">' + esc(it.title) +
          (it.cancelled ? " · sin clase" : "") + "</span>" +
          '<span class="muted" style="display:block;font-size:12.5px">' + esc([whenLabel(it), it.item_type === "class" ? it.details : audienceLabel(it, role)].filter(Boolean).join(" · ")) + "</span></span></button>");
        row.onclick = function () { m.close(); showItem(it); };
        box.appendChild(row);
      });
      var actions = [{ label: "Cerrar" }];
      if (editable) actions.push({ label: "+ Agregar en este día", cls: "btn-dark", fn: function () { editEvent(null, k); } });
      var m = openModal(longDay(day), box, actions);
    }

    function showItem(it) {
      var c = colorOf(it);
      var lines = [];
      var dateTxt = it.ends_on !== it.starts_on ? whenLabel(it) : longDay(parseKey(it.starts_on)) + " · " + whenLabel(it);
      lines.push(["Cuándo", dateTxt]);
      if (it.item_type === "class") {
        lines.push(["Módulo", it.details]);
        if (it.author) lines.push(["Profesor", it.author]);
      } else {
        var aud = audienceLabel(it, role);
        if (aud) lines.push(["Para", aud]);
        lines.push(["Publicado por", it.author]);
      }
      var b = h('<div class="cal-item">' +
        '<p class="cal-item__cat"><span class="cal-dot" style="background:' + c + '"></span>' +
        esc(it.item_type === "class" ? "Clase" : (CATS[it.category] || {}).label || "") + "</p>" +
        (it.cancelled ? '<div class="pnl-alert warn" style="margin-bottom:10px">Este día no hay clase.</div>' : "") +
        lines.map(function (l) { return '<p class="cal-item__row"><span>' + esc(l[0]) + "</span>" + esc(l[1]) + "</p>"; }).join("") +
        (it.item_type !== "class" && it.details ? '<p class="cal-item__details">' + esc(it.details) + "</p>" : "") +
        (it.link_url && /^https:\/\//.test(it.link_url) ? '<p style="margin-top:10px"><a href="' + esc(it.link_url) + '" target="_blank" rel="noopener">Abrir enlace ↗</a></p>' : "") +
        "</div>");
      var actions = [];
      if (it.item_type === "event" && it.can_edit) {
        actions.push({ label: "Eliminar", cls: "btn-danger", left: true, fn: function () { return removeEvent(it); } });
        actions.push({ label: "Editar", cls: "btn-ghost", fn: function () { editEvent(it); } });
      }
      actions.push({ label: "Cerrar", cls: "btn-dark" });
      openModal(it.title, b, actions);
    }

    function removeEvent(it) {
      return sb.from("calendar_events").delete().eq("id", it.id).select("id").then(function (r) {
        if (r.error) throw r.error;
        if (!r.data || !r.data.length) throw new Error("No se pudo eliminar (quizá ya no existe o no es tuyo).");
        toast("Eliminado del calendario.");
        load();
      });
    }

    // Grupos para "¿Para quién?": el profesor solo los suyos; el admin, todos.
    function loadGroups() {
      if (groupsPromise) return groupsPromise;
      var qy = sb.from("groups").select("id,active,teacher_id,modules(level,module_number),schedules(days,start_time,end_time),teachers(full_name)").eq("active", true);
      if (role === "teacher") qy = qy.eq("teacher_id", opts.teacherId);
      groupsPromise = qy.then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).sort(function (a, b) {
          return ((a.modules || {}).module_number || 0) - ((b.modules || {}).module_number || 0);
        });
      });
      return groupsPromise;
    }
    function groupText(g) {
      var s = g.schedules || {};
      var d = (s.days || []).slice().sort(function (a, b) { return DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b); })
        .map(function (x) { return DAY_ES[x] || x; }).join(" ");
      return ((g.modules || {}).level || "") + " · " + d + " " + fmtTime(s.start_time) +
        (role === "admin" && g.teachers ? " · " + g.teachers.full_name : "");
    }

    function editEvent(ev, dayKey) {
      ev = ev || null;
      loadGroups().catch(function () { return []; }).then(function (groups) {
        var cats = CATS_BY_ROLE[role];
        var e = ev || { category: cats[0], starts_on: dayKey, ends_on: dayKey, audience: role === "teacher" && groups.length ? "group" : (role === "teacher" ? "personal" : "all"), group_id: role === "teacher" && groups[0] ? groups[0].id : null };
        var allDay = !e.start_time;
        var audOpts = role === "teacher"
          ? [["personal", "Solo para mí (nota personal)"]].concat(groups.map(function (g) { return ["g:" + g.id, "Grupo " + groupText(g)]; }))
          : [["all", "Profesores y estudiantes"], ["students", "Solo estudiantes"], ["teachers", "Solo profesores"],
             ["group", "Un grupo en particular"], ["personal", "Solo para mí (nota personal)"]];
        var audVal = role === "teacher" ? (e.audience === "group" ? "g:" + e.group_id : "personal") : e.audience;

        var f = h('<div class="cal-form">' +
          '<label class="fld"><span>Título</span><input name="title" maxlength="140" value="' + esc(e.title || "") + '" placeholder="' +
            (role === "teacher" ? "Ej.: Entregar el workbook, Quiz de la unidad 3" : "Ej.: Semana de receso, Taller de conversación") + '"></label>' +
          '<label class="fld"><span>Tipo</span><select name="category">' + cats.map(function (c) {
            return '<option value="' + c + '"' + (e.category === c ? " selected" : "") + ">" + esc(CATS[c].label) + "</option>";
          }).join("") + "</select></label>" +
          '<p class="cal-hint" data-hint-sin style="display:none">“Sin clase” marca como canceladas las clases de esos días para el público que elijas.</p>' +
          '<div class="cal-form__two"><label class="fld"><span>Fecha</span><input type="date" name="starts_on" value="' + esc(e.starts_on || "") + '"></label>' +
          '<label class="fld"><span>Hasta (opcional)</span><input type="date" name="ends_on" value="' + esc(e.ends_on && e.ends_on !== e.starts_on ? e.ends_on : "") + '"></label></div>' +
          '<label class="cal-check"><input type="checkbox" name="allday"' + (allDay ? " checked" : "") + "> Todo el día</label>" +
          '<div class="cal-form__two" data-times' + (allDay ? ' style="display:none"' : "") + '>' +
          '<label class="fld"><span>Hora de inicio</span><input type="time" name="start_time" value="' + esc((e.start_time || "").slice(0, 5)) + '"></label>' +
          '<label class="fld"><span>Hora de fin (opcional)</span><input type="time" name="end_time" value="' + esc((e.end_time || "").slice(0, 5)) + '"></label></div>' +
          '<label class="fld"><span>¿Para quién?</span><select name="aud">' + audOpts.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (audVal === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
          }).join("") + "</select></label>" +
          (role === "admin" ? '<label class="fld" data-group-pick style="display:none"><span>Grupo</span><select name="group_id">' +
            (groups.length ? groups.map(function (g) {
              return '<option value="' + g.id + '"' + (e.group_id === g.id ? " selected" : "") + ">" + esc(groupText(g)) + "</option>";
            }).join("") : '<option value="">No hay grupos activos</option>') + "</select></label>" : "") +
          (role === "teacher" && !groups.length ? '<p class="cal-hint">Todavía no tienes grupos asignados: por ahora solo puedes crear notas personales.</p>' : "") +
          '<p class="cal-hint" data-aud-hint></p>' +
          '<label class="fld"><span>Detalles (opcional)</span><textarea name="details" rows="3" maxlength="2000">' + esc(e.details || "") + "</textarea></label>" +
          '<label class="fld"><span>Enlace (opcional)</span><input name="link_url" inputmode="url" placeholder="https://" value="' + esc(e.link_url || "") + '"></label>' +
          "</div>");

        var allBox = f.querySelector("[name=allday]"), times = f.querySelector("[data-times]");
        allBox.onchange = function () { times.style.display = allBox.checked ? "none" : ""; };
        var catSel = f.querySelector("[name=category]"), sinHint = f.querySelector("[data-hint-sin]");
        function syncCat() { sinHint.style.display = catSel.value === "sin_clase" ? "" : "none"; }
        catSel.onchange = syncCat; syncCat();
        var audSel = f.querySelector("[name=aud]"), gp = f.querySelector("[data-group-pick]"), audHint = f.querySelector("[data-aud-hint]");
        function syncAud() {
          var v = audSel.value;
          if (gp) gp.style.display = v === "group" ? "" : "none";
          audHint.textContent = v === "personal" ? "Solo tú lo verás en tu calendario."
            : v === "all" ? "Lo verán todos los profesores y todos los estudiantes."
            : v === "students" ? "Lo verán todos los estudiantes en su calendario."
            : v === "teachers" ? "Lo verán todos los profesores."
            : "Lo verán los estudiantes de ese grupo" + (role === "admin" ? " y su profesor." : ".");
        }
        audSel.onchange = syncAud; syncAud();

        function save() {
          var val = function (n) { var x = f.querySelector("[name=" + n + "]"); return x ? String(x.value || "").trim() : ""; };
          var title = val("title");
          if (title.length < 2) throw new Error("Escribe un título.");
          var starts = val("starts_on");
          if (!starts) throw new Error("Elige la fecha.");
          var ends = val("ends_on") || starts;
          if (ends < starts) throw new Error("La fecha “Hasta” no puede ser antes de la fecha de inicio.");
          var row = { title: title, category: catSel.value, details: val("details"), starts_on: starts, ends_on: ends,
                      start_time: null, end_time: null, link_url: val("link_url") || null };
          if (row.link_url && !/^https:\/\//.test(row.link_url)) {
            if (/^[\w-]+(\.[\w-]+)+/.test(row.link_url)) row.link_url = "https://" + row.link_url;
            else throw new Error("El enlace debe empezar por https://");
          }
          if (!allBox.checked) {
            if (ends !== starts) throw new Error("Un evento con hora debe ser de un solo día (quita “Hasta” o marca “Todo el día”).");
            row.start_time = val("start_time") || null;
            row.end_time = val("end_time") || null;
            if (!row.start_time) throw new Error("Elige la hora de inicio o marca “Todo el día”.");
            if (row.end_time && row.end_time <= row.start_time) throw new Error("La hora de fin debe ser después de la de inicio.");
          }
          var a = audSel.value;
          if (a.indexOf("g:") === 0) { row.audience = "group"; row.group_id = a.slice(2); }
          else if (a === "group") {
            row.audience = "group"; row.group_id = val("group_id");
            if (!row.group_id) throw new Error("Elige el grupo.");
          } else { row.audience = a; row.group_id = null; }

          var op = ev ? sb.from("calendar_events").update(row).eq("id", ev.id).select("id")
                      : sb.from("calendar_events").insert(row).select("id");
          return op.then(function (r) {
            if (r.error) throw r.error;
            if (!r.data || !r.data.length) throw new Error("No se pudo guardar (revisa tus permisos).");
            toast(ev ? "Cambios guardados." : "Agregado al calendario.");
            // Si lo creó en otro mes, llevarlo a ese mes.
            var d = parseKey(starts);
            cur = new Date(d.getFullYear(), d.getMonth(), 1);
            load();
          });
        }
        openModal(ev ? "Editar" : "Nuevo en el calendario", f, [{ label: "Cancelar" }, { label: "Guardar", cls: "btn-dark", fn: save }]);
        setTimeout(function () { var t = f.querySelector("[name=title]"); if (t && !ev) t.focus(); }, 30);
      });
    }

    load();
    return { reload: load };
  }

  window.LEFCalendar = { mount: mount };
})();
