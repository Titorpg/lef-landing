/* LEF — calendario propio de la plataforma (reemplaza a Google Calendar).
   Lo usan el panel (admin y profesor, editable) y el portal del estudiante
   (solo lectura). Los datos salen de get_my_calendar(): las clases se calculan
   de los grupos (días + hora del horario, entre las fechas del ciclo) y los
   eventos de la tabla calendar_events. Quién ve qué lo decide la BD.

   Diseño (patrones de calendarios profesionales): panel lateral con "Hoy" y la
   próxima clase, mini-mes para saltar de fecha, filtros por tipo y próximas
   actividades; vistas Semana (franja horaria con línea de "ahora"), Mes y
   Agenda (la principal en celular). Cada tipo tiene color + ícono (no solo
   color), y "Sin clase" va rayado.

   Uso: LEFCalendar.mount(contenedor, {
          sb,                      cliente de Supabase
          role: "admin" | "teacher" | "student",
          teacherId,               (profesor) para listar SUS grupos
          toast                    opcional, fn(mensaje, "ok"|"err")
        }) */
(function () {
  "use strict";

  /* ---------- utilidades ---------- */
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
  function weekStart(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); }
  function toMin(t) { var p = String(t || "0:0").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }
  function fmtTime(t, short) {
    if (!t) return "";
    var p = String(t).split(":"), hh = +p[0], mm = p[1];
    var hr = hh % 12 || 12;
    if (short) return hr + (mm !== "00" ? ":" + mm : "") + (hh >= 12 ? "p" : "a");
    return hr + ":" + mm + (hh >= 12 ? " p. m." : " a. m.");
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function longDay(d) { return cap(d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })); }
  function monthName(d) { return cap(d.toLocaleDateString("es-CO", { month: "long" })); }
  function shortMonth(d) { return d.toLocaleDateString("es-CO", { month: "short" }).replace(".", ""); }

  var DAY_ES = { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié", Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom" };
  var DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  var DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  var DOW1 = ["L", "M", "M", "J", "V", "S", "D"];

  /* ---------- íconos (trazo, 24x24) ---------- */
  var ICONS = {
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    check: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    calx: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m14 14-4 4m0-4 4 4"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z"/>',
    text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    redo: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>'
  };
  function ic(name, cls) {
    return '<svg class="lcal-ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  // Mismos colores por módulo que el resto del panel (module_number 1..15).
  var MODULE_COLORS = ["#2e4e9e", "#4a86c5", "#5bb1a9", "#6f9d4a", "#b3a133", "#cf8b3b",
                       "#c15b4a", "#9a5aa3", "#5f6bd0", "#7d8794", "#3aa0a0", "#33415c",
                       "#b5476b", "#2c7a5a", "#8a6d3b"];

  // Tipos. "clase" no se crea a mano: sale de los grupos.
  var CATS = {
    clase:      { label: "Clases",     one: "Clase",      color: "#2e4e9e", icon: "cap" },
    actividad:  { label: "Actividades", one: "Actividad", color: "#2f7d6d", icon: "pencil" },
    evaluacion: { label: "Evaluaciones", one: "Evaluación", color: "#b4233c", icon: "check" },
    evento:     { label: "Eventos",    one: "Evento",     color: "#b7791f", icon: "star" },
    aviso:      { label: "Avisos",     one: "Aviso",      color: "#4d4d4d", icon: "megaphone" },
    sin_clase:  { label: "Sin clase",  one: "Sin clase",  color: "#8c8c8c", icon: "calx" },
    // La crea el profesor desde su Dashboard ("Clases por reprogramar"), no desde aquí.
    reposicion: { label: "Reposiciones", one: "Reposición", color: "#6b4fa3", icon: "redo" }
  };
  var CATS_BY_ROLE = {
    teacher: ["actividad", "evaluacion", "aviso", "sin_clase"],
    admin:   ["evento", "aviso", "actividad", "evaluacion", "sin_clase"]
  };
  var CAT_HINT = {
    actividad: "Tareas, lecturas, entregas.",
    evaluacion: "Quiz, examen, presentación.",
    evento: "Talleres, actividades de LEF.",
    aviso: "Un recordatorio o novedad.",
    sin_clase: "Tacha las clases de esos días. Los estudiantes reciben un correo y la clase queda pendiente por reprogramar en el Dashboard del profesor."
  };
  var AUDIENCE_ES = {
    personal: "Solo para mí", teachers: "Profesores", students: "Estudiantes", all: "Profesores y estudiantes"
  };

  function catOf(it) { return it.item_type === "class" ? "clase" : it.category; }
  // Una reposición se ve como una clase más del grupo (mismo color e ícono) y
  // se filtra junto con "Clases".
  function filterKey(it) { var c = catOf(it); return c === "reposicion" ? "clase" : c; }
  function colorOf(it) {
    if (it.item_type === "class" || (it.category === "reposicion" && it.module_number)) return MODULE_COLORS[((it.module_number || 1) - 1) % MODULE_COLORS.length];
    return (CATS[it.category] || CATS.actividad).color;
  }
  function iconOf(it) { return it.category === "reposicion" ? "cap" : (CATS[catOf(it)] || CATS.actividad).icon; }
  function audienceLabel(it, role) {
    if (it.audience === "group") return "Grupo " + (it.group_label || "");
    if (role === "student") return "";
    return AUDIENCE_ES[it.audience] || "";
  }
  function timeRange(it) {
    if (!it.start_time) return it.ends_on !== it.starts_on ? "Varios días" : "Todo el día";
    return fmtTime(it.start_time) + (it.end_time ? " – " + fmtTime(it.end_time) : "");
  }
  function metaLine(it, role) {
    if (it.item_type === "class") {
      return role === "student" ? it.details + (it.author ? " · " + it.author : "") : (it.group_label || "");
    }
    var a = audienceLabel(it, role);
    return [a, it.author && it.author !== "LEF" && role !== "teacher" ? it.author : ""].filter(Boolean).join(" · ");
  }
  function startDate(it) {
    var d = parseKey(it.starts_on), m = toMin(it.start_time || "00:00");
    d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d;
  }
  function endDate(it) {
    if (!it.start_time) { var e = parseKey(it.ends_on); e.setHours(23, 59, 0, 0); return e; }
    var d = parseKey(it.starts_on), m = it.end_time ? toMin(it.end_time) : toMin(it.start_time) + 60;
    d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d;
  }
  function countdown(target, now) {
    var min = Math.round((target - now) / 60000);
    if (min < 60) return "en " + Math.max(min, 1) + " min";
    var today = new Date(now); today.setHours(0, 0, 0, 0);
    var t = new Date(target); t.setHours(0, 0, 0, 0);
    var days = Math.round((t - today) / 86400000);
    if (days === 0) { var hh = Math.floor(min / 60), mm = min % 60; return "en " + hh + " h" + (mm ? " " + mm + " min" : ""); }
    if (days === 1) return "mañana";
    return "en " + days + " días";
  }
  function friendly(e) {
    var m = (e && (e.message || e.error_description)) || String(e || "");
    if (/row-level security|permission denied/i.test(m)) return "No tienes permiso para publicar eso (revisa a quién va dirigido).";
    if (/calendar_events_times/.test(m)) return "Revisa las horas: la de fin debe ser después de la de inicio, y un evento con hora debe ser de un solo día.";
    if (/calendar_events_dates/.test(m)) return "Revisa las fechas: la de fin no puede ser antes de la de inicio (máximo 90 días).";
    if (/link_url/.test(m)) return "El enlace debe empezar por https://";
    if (/title/.test(m) && /check/i.test(m)) return "Escribe un título (mínimo 2 letras).";
    if (/calendar_events_makeup/.test(m)) return "Una reposición necesita fecha y hora de inicio.";
    if (/get_my_calendar|Could not find the function/i.test(m)) return "El calendario todavía no está activado en el servidor.";
    if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    return m || "Algo salió mal.";
  }
  function storeGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function storeSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }

  /* ---------- ventana (hoja) ---------- */
  // o: { color, icon, label, title, body (nodo), actions: [{label, cls, icon, fn, left}] }
  // fn devuelve promesa; si se resuelve (y no devuelve true), se cierra.
  function openSheet(o) {
    var bg = h('<div class="pnl-modal-bg lcal-modal-bg"></div>');
    var box = h('<div class="lcal-sheet' + (o.wide ? " is-wide" : "") + '" role="dialog" aria-modal="true" style="--c:' + (o.color || "#101010") + '">' +
      '<div class="lcal-sheet__band"><span class="lcal-sheet__badge">' + ic(o.icon || "cal") + "</span>" +
      '<span class="lcal-sheet__label">' + esc(o.label || "") + "</span>" +
      '<button type="button" class="lcal-sheet__x" aria-label="Cerrar">' + ic("x") + "</button></div>" +
      '<div class="lcal-sheet__body"><h3 class="lcal-sheet__title">' + esc(o.title || "") + "</h3></div></div>");
    var inner = box.querySelector(".lcal-sheet__body");
    inner.appendChild(o.body);
    var err = h('<div class="pnl-alert err" style="display:none;margin:12px 0 0"></div>');
    inner.appendChild(err);
    var row = h('<div class="lcal-sheet__actions"></div>');
    (o.actions || []).forEach(function (a) {
      var b = h('<button type="button" class="btn ' + (a.cls || "btn-ghost") + '">' + (a.icon ? ic(a.icon) : "") + "<span>" + esc(a.label) + "</span></button>");
      if (a.left) b.classList.add("is-left");
      b.onclick = function () {
        if (!a.fn) return close();
        b.disabled = true; err.style.display = "none";
        Promise.resolve().then(a.fn).then(function (keep) { if (keep !== true) close(); else b.disabled = false; }).catch(function (e) {
          err.textContent = friendly(e); err.style.display = "block"; b.disabled = false;
        });
      };
      row.appendChild(b);
    });
    if (row.children.length) inner.appendChild(row);
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); document.removeEventListener("keydown", onKey); if (o.onClose) o.onClose(); }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    box.querySelector(".lcal-sheet__x").onclick = close;
    return { close: close, box: box };
  }

  /* ---------- calendario ---------- */
  var nowTimer = null; // uno solo por página: el reloj de la línea "ahora"

  function mount(root, opts) {
    var sb = opts.sb, role = opts.role;
    var editable = role === "admin" || role === "teacher";
    var toast = opts.toast || function () {};
    var isPhone = window.matchMedia("(max-width:640px)").matches;
    var view = storeGet("lef-cal-view2") || (isPhone ? "agenda" : "week");
    if (isPhone && view === "week") view = "agenda";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var cursor = new Date(today);    // día seleccionado
    var miniMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    var hidden = {};
    var cache = {};                  // "yyyy-mm" → promesa de elementos del mes (con semanas completas)
    var upcomingP = null;
    var groupsP = null;
    var token = 0;

    root.innerHTML = "";
    root.classList.add("lcal");
    var side = h('<aside class="lcal-side"></aside>');
    var mainEl = h('<section class="lcal-main"></section>');
    root.appendChild(side); root.appendChild(mainEl);

    var head = h(
      '<div class="lcal-head">' +
      '<div class="lcal-head__nav">' +
      '<button type="button" class="lcal-iconbtn" data-prev aria-label="Anterior">' + ic("left") + "</button>" +
      '<button type="button" class="lcal-iconbtn" data-next aria-label="Siguiente">' + ic("right") + "</button>" +
      '<button type="button" class="lcal-todaybtn" data-today>Hoy</button></div>' +
      '<h2 class="lcal-head__title" data-title></h2>' +
      '<div class="lcal-seg" role="tablist">' +
      '<button type="button" data-view="week" class="lcal-seg__week">Semana</button>' +
      '<button type="button" data-view="month">Mes</button>' +
      '<button type="button" data-view="agenda">Agenda</button></div></div>');
    var bodyEl = h('<div class="lcal-body"></div>');
    mainEl.appendChild(head); mainEl.appendChild(bodyEl);

    head.querySelector("[data-prev]").onclick = function () { step(-1); };
    head.querySelector("[data-next]").onclick = function () { step(1); };
    head.querySelector("[data-today]").onclick = function () { setCursor(new Date(today)); };
    head.querySelectorAll("[data-view]").forEach(function (b) {
      b.onclick = function () { view = b.getAttribute("data-view"); storeSet("lef-cal-view2", view); render(); };
    });

    function step(n) {
      var c = new Date(cursor);
      if (view === "week") c = addDays(c, 7 * n);
      else {
        var day = c.getDate();
        c = new Date(c.getFullYear(), c.getMonth() + n, 1);
        c.setDate(Math.min(day, new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate()));
      }
      setCursor(c);
    }
    function setCursor(d) {
      cursor = d;
      miniMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      render();
    }

    /* ----- datos ----- */
    function monthRange(d) {
      var first = new Date(d.getFullYear(), d.getMonth(), 1), last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      return { first: first, last: last, start: weekStart(first), end: addDays(weekStart(last), 6) };
    }
    function fetchRange(from, to) {
      return sb.rpc("get_my_calendar", { p_from: keyOf(from), p_to: keyOf(to) }).then(function (r) {
        if (r.error) throw r.error;
        return r.data || [];
      });
    }
    function monthItems(d) {
      var k = d.getFullYear() + "-" + d.getMonth();
      if (!cache[k]) {
        var r = monthRange(d);
        cache[k] = fetchRange(r.start, r.end);
        cache[k].catch(function () { delete cache[k]; });
      }
      return cache[k];
    }
    function upcoming() {
      if (!upcomingP) {
        upcomingP = fetchRange(today, addDays(today, 45));
        upcomingP.catch(function () { upcomingP = null; });
      }
      return upcomingP;
    }
    function refresh() { cache = {}; upcomingP = null; render(); }

    function visible(list) { return list.filter(function (it) { return !hidden[filterKey(it)]; }); }

    // Reparte cada elemento en los días que ocupa (los de varios días, en todos).
    function byDay(list, from, to) {
      var map = {};
      list.forEach(function (it) {
        var d = parseKey(it.starts_on), end = parseKey(it.ends_on);
        if (d < from) d = new Date(from);
        for (var i = 0; d <= end && d <= to && i < 100; i++) {
          (map[keyOf(d)] = map[keyOf(d)] || []).push(it);
          d = addDays(d, 1);
        }
      });
      Object.keys(map).forEach(function (k) {
        map[k].sort(function (a, b) {
          var aa = !a.start_time, bb = !b.start_time;
          if (aa !== bb) return aa ? -1 : 1;
          return toMin(a.start_time) - toMin(b.start_time);
        });
      });
      return map;
    }

    /* ----- pintar ----- */
    function render() {
      var my = ++token;
      head.querySelectorAll("[data-view]").forEach(function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-view") === view);
      });
      root.setAttribute("data-view", view);
      paintTitle();
      bodyEl.classList.add("is-loading");
      var monthsNeeded = [cursor];
      if (miniMonth.getMonth() !== cursor.getMonth() || miniMonth.getFullYear() !== cursor.getFullYear()) monthsNeeded.push(miniMonth);
      Promise.all([Promise.all(monthsNeeded.map(monthItems)), upcoming().catch(function () { return []; })]).then(function (res) {
        if (my !== token) return;
        bodyEl.classList.remove("is-loading");
        var items = res[0][0], miniItems = res[0][1] || items, up = res[1];
        paintSide(items, miniItems, up);
        bodyEl.innerHTML = "";
        if (view === "week") paintWeek(items);
        else if (view === "month") paintMonth(items);
        else paintAgenda(items);
      }).catch(function (e) {
        if (my !== token) return;
        bodyEl.classList.remove("is-loading");
        paintSide([], [], []);
        bodyEl.innerHTML = "";
        bodyEl.appendChild(h('<div class="pnl-alert err">No pudimos cargar el calendario: ' + esc(friendly(e)) + "</div>"));
      });
    }

    function paintTitle() {
      var t = head.querySelector("[data-title]");
      if (view === "week") {
        var a = weekStart(cursor), b = addDays(a, 6);
        t.innerHTML = a.getMonth() === b.getMonth()
          ? esc(a.getDate() + " – " + b.getDate() + " ") + "<span>" + esc(monthName(a) + " " + b.getFullYear()) + "</span>"
          : esc(a.getDate() + " " + shortMonth(a) + " – " + b.getDate() + " " + shortMonth(b)) + " <span>" + b.getFullYear() + "</span>";
      } else {
        t.innerHTML = esc(monthName(cursor)) + " <span>" + cursor.getFullYear() + "</span>";
      }
    }

    /* --- panel lateral --- */
    function paintSide(items, miniItems, up) {
      side.innerHTML = "";
      side.appendChild(heroCard(up));
      side.appendChild(miniCard(miniItems));
      side.appendChild(filterCard(items));
      side.appendChild(upcomingCard(up));
    }

    function heroCard(up) {
      var now = new Date();
      var classes = up.filter(function (it) { return it.item_type === "class" && !it.cancelled && endDate(it) > now; })
        .sort(function (a, b) { return startDate(a) - startDate(b); });
      var next = classes[0];
      var todayCount = up.filter(function (it) { return it.item_type === "class" && !it.cancelled && it.starts_on === keyOf(today); }).length;
      var nextHtml;
      if (next) {
        var s = startDate(next), live = s <= now;
        nextHtml = '<div class="lcal-hero__next" style="--c:' + colorOf(next) + '">' +
          '<span class="lcal-hero__k">' + (live ? '<i class="lcal-live"></i>En curso ahora' : (role === "admin" ? "Próxima clase en LEF" : "Tu próxima clase")) + "</span>" +
          '<strong class="lcal-hero__t">' + esc(next.title) + "</strong>" +
          '<span class="lcal-hero__m">' + esc((next.starts_on === keyOf(today) ? "Hoy" : longDay(parseKey(next.starts_on))) + " · " + fmtTime(next.start_time)) +
          (role !== "student" && next.group_label ? "<br>" + esc(next.group_label) : "") + "</span>" +
          (live ? "" : '<span class="lcal-hero__cd">' + ic("clock") + esc(countdown(s, now)) + "</span>") +
          "</div>";
      } else {
        nextHtml = '<div class="lcal-hero__next is-empty"><span class="lcal-hero__k">' +
          (role === "student" ? "Cuando te asignen un grupo, aquí verás tu próxima clase." : "No hay clases programadas en los próximos días.") + "</span></div>";
      }
      var card = h('<div class="lcal-hero">' +
        '<div class="lcal-hero__date"><span class="lcal-hero__dow">' + esc(cap(today.toLocaleDateString("es-CO", { weekday: "long" }))) + "</span>" +
        '<span class="lcal-hero__num">' + today.getDate() + "</span>" +
        '<span class="lcal-hero__mon">' + esc(monthName(today) + " " + today.getFullYear()) + "</span>" +
        (todayCount ? '<span class="lcal-hero__pill">' + todayCount + (todayCount === 1 ? " clase hoy" : " clases hoy") + "</span>" : "") +
        "</div>" + nextHtml +
        (editable ? '<button type="button" class="lcal-hero__new" data-new>' + ic("plus") + "<span>Nuevo evento</span></button>" : "") +
        "</div>");
      if (next) {
        var n = card.querySelector(".lcal-hero__next");
        n.classList.add("is-link"); n.tabIndex = 0;
        n.onclick = function () { showItem(next); };
      }
      if (editable) card.querySelector("[data-new]").onclick = function () { editEvent(null, keyOf(cursor < today ? today : cursor)); };
      return card;
    }

    function miniCard(items) {
      var first = miniMonth, r = monthRange(first), map = byDay(visible(items), r.start, r.end);
      var card = h('<div class="lcal-card lcal-mini">' +
        '<div class="lcal-mini__head"><strong>' + esc(monthName(first) + " " + first.getFullYear()) + "</strong>" +
        '<span><button type="button" class="lcal-iconbtn sm" data-mp aria-label="Mes anterior">' + ic("left") + "</button>" +
        '<button type="button" class="lcal-iconbtn sm" data-mn aria-label="Mes siguiente">' + ic("right") + "</button></span></div>" +
        '<div class="lcal-mini__grid"></div></div>');
      var grid = card.querySelector(".lcal-mini__grid");
      DOW1.forEach(function (d) { grid.appendChild(h('<span class="lcal-mini__dow">' + d + "</span>")); });
      var ws = weekStart(cursor), we = addDays(ws, 6);
      for (var d = new Date(r.start); d <= r.end; d = addDays(d, 1)) {
        (function (day) {
          var k = keyOf(day), list = map[k] || [];
          var cls = "lcal-mini__day" + (day.getMonth() !== first.getMonth() ? " is-out" : "") +
            (k === keyOf(today) ? " is-today" : "") + (k === keyOf(cursor) ? " is-sel" : "") +
            (view === "week" && day >= ws && day <= we ? " in-week" : "");
          var dots = {};
          list.forEach(function (it) { if (!it.cancelled) dots[colorOf(it)] = true; });
          var b = h('<button type="button" class="' + cls + '" aria-label="' + esc(longDay(day)) + '">' + day.getDate() +
            '<span class="lcal-mini__dots">' + Object.keys(dots).slice(0, 3).map(function (c) { return '<i style="background:' + c + '"></i>'; }).join("") + "</span></button>");
          b.onclick = function () { setCursor(day); if (view === "agenda") setTimeout(function () { scrollAgendaTo(k); }, 50); };
          grid.appendChild(b);
        })(new Date(d));
      }
      card.querySelector("[data-mp]").onclick = function () { miniMonth = new Date(first.getFullYear(), first.getMonth() - 1, 1); render(); };
      card.querySelector("[data-mn]").onclick = function () { miniMonth = new Date(first.getFullYear(), first.getMonth() + 1, 1); render(); };
      return card;
    }

    function filterCard(items) {
      var counts = {};
      items.forEach(function (it) {
        var c = filterKey(it);
        if (it.item_type === "class" && parseKey(it.starts_on).getMonth() !== cursor.getMonth()) return;
        counts[c] = (counts[c] || 0) + 1;
      });
      var keys = Object.keys(CATS).filter(function (k) { return counts[k] || hidden[k]; });
      var card = h('<div class="lcal-card lcal-filters"><p class="lcal-card__k">Mostrar</p></div>');
      if (!keys.length) { card.appendChild(h('<p class="lcal-card__empty">Nada programado este mes.</p>')); return card; }
      keys.forEach(function (k) {
        var c = CATS[k];
        var b = h('<button type="button" class="lcal-filter' + (hidden[k] ? " is-off" : "") + '" aria-pressed="' + !hidden[k] + '" style="--c:' + (k === "clase" ? "#101010" : c.color) + '">' +
          '<span class="lcal-filter__box">' + ic(c.icon) + "</span><span class=\"lcal-filter__l\">" + esc(c.label) + "</span>" +
          '<span class="lcal-filter__n">' + (counts[k] || 0) + "</span></button>");
        b.onclick = function () { hidden[k] = !hidden[k]; render(); };
        card.appendChild(b);
      });
      return card;
    }

    function upcomingCard(up) {
      var now = new Date();
      var list = up.filter(function (it) { return it.item_type === "event" && endDate(it) >= now; })
        .sort(function (a, b) { return startDate(a) - startDate(b); }).slice(0, 5);
      var card = h('<div class="lcal-card lcal-up"><p class="lcal-card__k">Próximas actividades</p></div>');
      if (!list.length) { card.appendChild(h('<p class="lcal-card__empty">Nada pendiente en las próximas semanas.</p>')); return card; }
      list.forEach(function (it) {
        var d = parseKey(it.starts_on);
        var b = h('<button type="button" class="lcal-up__item" style="--c:' + colorOf(it) + '">' +
          '<span class="lcal-up__date"><b>' + d.getDate() + "</b>" + esc(shortMonth(d)) + "</span>" +
          '<span class="lcal-up__body"><strong>' + esc(it.title) + "</strong>" +
          '<span>' + ic(iconOf(it)) + esc(CATS[it.category] ? CATS[it.category].one : "") + " · " + esc(timeRange(it)) + "</span></span></button>");
        b.onclick = function () { showItem(it); };
        card.appendChild(b);
      });
      return card;
    }

    /* --- Semana --- */
    function paintWeek(items) {
      var ws = weekStart(cursor), days = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(ws, i); });
      var map = byDay(visible(items), ws, days[6]);
      var first = Infinity, last = -Infinity, anyAll = false;
      days.forEach(function (d) {
        (map[keyOf(d)] || []).forEach(function (it) {
          if (!it.start_time) { anyAll = true; return; }
          first = Math.min(first, toMin(it.start_time));
          last = Math.max(last, it.end_time ? toMin(it.end_time) : toMin(it.start_time) + 60);
        });
      });
      // Franja horaria ajustada a lo que hay esa semana (1 h de aire arriba y
      // abajo, mínimo 8 h) y alto por hora calculado para que quepa sin scroll.
      if (first === Infinity) { first = 8 * 60; last = 18 * 60; }
      var minH = Math.max(0, Math.floor(first / 60) - 1), maxH = Math.min(24, Math.ceil(last / 60) + 1);
      while (maxH - minH < 8) { if (maxH < 24) maxH++; else minH--; }
      var HOUR_PX = Math.max(44, Math.min(64, Math.floor(680 / (maxH - minH))));
      var wrap = h('<div class="lcal-week"></div>');
      var headRow = h('<div class="lcal-week__row lcal-week__heads"><div class="lcal-week__gut"></div></div>');
      days.forEach(function (d, i) {
        var k = keyOf(d);
        var hd = h('<button type="button" class="lcal-week__hd' + (k === keyOf(today) ? " is-today" : "") + (i > 4 ? " is-wkd" : "") + '">' +
          '<span class="lcal-week__dow">' + DOW[i] + '</span><span class="lcal-week__num">' + d.getDate() + "</span></button>");
        hd.onclick = function () { cursor = d; view = "agenda"; storeSet("lef-cal-view2", view); render(); setTimeout(function () { scrollAgendaTo(k); }, 60); };
        headRow.appendChild(hd);
      });
      wrap.appendChild(headRow);

      if (anyAll) {
        var allRow = h('<div class="lcal-week__row lcal-week__all"><div class="lcal-week__gut"><span>Todo el día</span></div></div>');
        days.forEach(function (d, i) {
          var cell = h('<div class="lcal-week__allcell' + (i > 4 ? " is-wkd" : "") + '"></div>');
          (map[keyOf(d)] || []).filter(function (it) { return !it.start_time; }).forEach(function (it) {
            cell.appendChild(pill(it, d, true));
          });
          allRow.appendChild(cell);
        });
        wrap.appendChild(allRow);
      }

      var scroll = h('<div class="lcal-week__scroll"></div>');
      var grid = h('<div class="lcal-week__row lcal-week__grid" style="height:' + ((maxH - minH) * HOUR_PX) + "px;--hour:" + HOUR_PX + 'px"></div>');
      var gut = h('<div class="lcal-week__gut lcal-week__hours"></div>');
      for (var hr = minH + 1; hr < maxH; hr++) {
        gut.appendChild(h('<span style="top:' + ((hr - minH) * HOUR_PX) + 'px">' + fmtTime(pad(hr) + ":00", true).replace("a", " a. m.").replace("p", " p. m.") + "</span>"));
      }
      grid.appendChild(gut);
      days.forEach(function (d, i) {
        var k = keyOf(d);
        var col = h('<div class="lcal-week__col' + (k === keyOf(today) ? " is-today" : "") + (i > 4 ? " is-wkd" : "") + '"></div>');
        var timed = (map[k] || []).filter(function (it) { return !!it.start_time; });
        layoutLanes(timed).forEach(function (p) {
          var it = p.it, s = toMin(it.start_time), e = it.end_time ? toMin(it.end_time) : s + 60;
          var top = (s - minH * 60) / 60 * HOUR_PX, hgt = Math.max((e - s) / 60 * HOUR_PX - 3, 24);
          var c = colorOf(it);
          var blk = h('<button type="button" class="lcal-blk' + (it.cancelled || it.category === "sin_clase" ? " is-striped" : "") + (it.cancelled ? " is-cancelled" : "") +
            (hgt < 40 ? " is-short" : "") + (hgt >= 64 ? " is-tall" : "") + (p.lanes > 1 ? " is-narrow" : "") + '" style="--c:' + c + ";top:" + top + "px;height:" + hgt + "px;left:calc(" + (p.lane / p.lanes * 100) + "% + 2px);width:calc(" + (100 / p.lanes) + '% - 5px)">' +
            '<span class="lcal-blk__title">' + ic(iconOf(it)) + "<span>" + esc(it.title) + "</span></span>" +
            '<span class="lcal-blk__time">' + esc(fmtTime(it.start_time) + (it.end_time ? " – " + fmtTime(it.end_time) : "")) + "</span>" +
            (hgt >= 70 ? '<span class="lcal-blk__meta">' + esc(it.cancelled ? "Sin clase" : metaLine(it, role)) + "</span>" : "") +
            "</button>");
          blk.onclick = function (ev) { ev.stopPropagation(); showItem(it); };
          col.appendChild(blk);
        });
        if (editable) {
          col.classList.add("is-add");
          col.onclick = function (ev) {
            var y = ev.clientY - col.getBoundingClientRect().top;
            var mins = minH * 60 + Math.floor(y / HOUR_PX * 2) * 30;
            editEvent(null, k, pad(Math.floor(mins / 60)) + ":" + pad(mins % 60));
          };
        }
        grid.appendChild(col);
      });
      scroll.appendChild(grid);
      wrap.appendChild(scroll);
      bodyEl.appendChild(wrap);

      // Línea de "ahora" en la columna de hoy (se mueve cada minuto).
      var todayIdx = days.map(keyOf).indexOf(keyOf(today));
      if (nowTimer) { clearInterval(nowTimer); nowTimer = null; }
      if (todayIdx >= 0) {
        var col = grid.children[todayIdx + 1];
        var line = h('<div class="lcal-now"><i></i></div>');
        col.appendChild(line);
        var place = function () {
          if (!document.body.contains(line)) { clearInterval(nowTimer); nowTimer = null; return; }
          var n = new Date(), m = n.getHours() * 60 + n.getMinutes();
          line.style.display = m < minH * 60 || m > maxH * 60 ? "none" : "";
          line.style.top = ((m - minH * 60) / 60 * HOUR_PX) + "px";
        };
        place();
        nowTimer = setInterval(place, 60000);
      }
      // Desplaza hasta la hora actual (o la primera clase).
      var n0 = new Date(), target = todayIdx >= 0 ? Math.max(n0.getHours() - 1, Math.floor(first / 60) - 1) : minH;
      scroll.scrollTop = Math.max(0, (target - minH) * HOUR_PX);
      if (!visible(items).length) bodyEl.appendChild(emptyNote("No hay nada programado esta semana."));
    }

    // Eventos que se cruzan a la misma hora: lado a lado.
    function layoutLanes(list) {
      var out = [], cluster = [], lanesEnd = [], clusterEnd = -1;
      function flush() { var n = lanesEnd.length; cluster.forEach(function (p) { p.lanes = n; }); cluster = []; lanesEnd = []; }
      list.slice().sort(function (a, b) { return toMin(a.start_time) - toMin(b.start_time); }).forEach(function (it) {
        var s = toMin(it.start_time), e = it.end_time ? toMin(it.end_time) : s + 60;
        if (s >= clusterEnd) { flush(); clusterEnd = -1; }
        var lane = lanesEnd.findIndex(function (end) { return end <= s; });
        if (lane < 0) { lane = lanesEnd.length; lanesEnd.push(e); } else lanesEnd[lane] = e;
        var p = { it: it, lane: lane, lanes: 1 };
        cluster.push(p); out.push(p);
        clusterEnd = Math.max(clusterEnd, e);
      });
      flush();
      return out;
    }

    /* --- Mes --- */
    function pill(it, day) {
      var c = colorOf(it), multi = it.ends_on !== it.starts_on, k = keyOf(day);
      var cls = "lcal-pill" + (!it.start_time ? " is-allday" : "") + (it.cancelled ? " is-cancelled" : "") +
        (it.category === "sin_clase" || it.cancelled ? " is-striped" : "") +
        (multi && k !== it.starts_on && day.getDay() !== 1 ? " cont-l" : "") +
        (multi && k !== it.ends_on && day.getDay() !== 0 ? " cont-r" : "");
      var b = h('<button type="button" class="' + cls + '" style="--c:' + c + '" title="' + esc(it.title) + '">' +
        ic(iconOf(it)) + (it.start_time ? '<span class="lcal-pill__t">' + esc(fmtTime(it.start_time, true)) + "</span>" : "") +
        '<span class="lcal-pill__l">' + esc(it.title) + "</span></button>");
      b.onclick = function (e) { e.stopPropagation(); showItem(it); };
      return b;
    }

    function paintMonth(items) {
      var r = monthRange(cursor), map = byDay(visible(items), r.start, r.end);
      var wrap = h('<div class="lcal-month"></div>');
      var dow = h('<div class="lcal-month__dow"></div>');
      DOW.forEach(function (d, i) { dow.appendChild(h("<span" + (i > 4 ? ' class="is-wkd"' : "") + ">" + d + "</span>")); });
      wrap.appendChild(dow);
      var grid = h('<div class="lcal-month__grid"></div>');
      for (var d = new Date(r.start); d <= r.end; d = addDays(d, 1)) {
        (function (day) {
          var k = keyOf(day), list = map[k] || [];
          var wd = (day.getDay() + 6) % 7;
          var cell = h('<div class="lcal-cell' + (day.getMonth() !== cursor.getMonth() ? " is-out" : "") + (k === keyOf(today) ? " is-today" : "") +
            (k === keyOf(cursor) ? " is-sel" : "") + (wd > 4 ? " is-wkd" : "") + '">' +
            '<div class="lcal-cell__top"><span class="lcal-cell__num">' + day.getDate() + "</span>" +
            (editable ? '<button type="button" class="lcal-cell__add" aria-label="Agregar el ' + esc(longDay(day)) + '">' + ic("plus") + "</button>" : "") +
            '</div><div class="lcal-cell__evs"></div>' +
            '<div class="lcal-cell__dots">' + list.slice(0, 4).map(function (it) { return '<i style="background:' + colorOf(it) + '"></i>'; }).join("") + "</div></div>");
          var box = cell.querySelector(".lcal-cell__evs");
          list.slice(0, 3).forEach(function (it) { box.appendChild(pill(it, day, false)); });
          if (list.length > 3) {
            var more = h('<button type="button" class="lcal-cell__more">+' + (list.length - 3) + " más</button>");
            more.onclick = function (e) { e.stopPropagation(); dayDetail(day, list); };
            box.appendChild(more);
          }
          if (editable) cell.querySelector(".lcal-cell__add").onclick = function (e) { e.stopPropagation(); editEvent(null, k); };
          cell.onclick = function () {
            if (list.length) dayDetail(day, list);
            else if (editable) editEvent(null, k);
            else { cursor = day; render(); }
          };
          grid.appendChild(cell);
        })(new Date(d));
      }
      wrap.appendChild(grid);
      bodyEl.appendChild(wrap);
      if (!visible(items).length) bodyEl.appendChild(emptyNote("No hay nada programado este mes."));
    }

    /* --- Agenda --- */
    function paintAgenda(items) {
      var r = monthRange(cursor);
      var from = r.first, isThisMonth = today >= r.first && today <= r.last;
      if (isThisMonth) from = today;
      var map = byDay(visible(items), from, r.last);
      var keys = Object.keys(map).sort();
      var list = h('<div class="lcal-agenda"></div>');
      keys.forEach(function (k) {
        var day = parseKey(k), isToday = keyOf(today) === k;
        var sec = h('<section class="lcal-aday' + (isToday ? " is-today" : "") + '" data-day="' + k + '">' +
          '<div class="lcal-aday__date"><span class="lcal-aday__dow">' + esc(DOW[(day.getDay() + 6) % 7]) + "</span>" +
          '<span class="lcal-aday__num">' + day.getDate() + "</span>" +
          (isToday ? '<span class="lcal-aday__badge">Hoy</span>' : '<span class="lcal-aday__mon">' + esc(shortMonth(day)) + "</span>") +
          '</div><div class="lcal-aday__list"></div></section>');
        var box = sec.querySelector(".lcal-aday__list");
        map[k].forEach(function (it) {
          var card = h('<button type="button" class="lcal-acard' + (it.cancelled ? " is-cancelled" : "") + (it.category === "sin_clase" || it.cancelled ? " is-striped" : "") + '" style="--c:' + colorOf(it) + '">' +
            '<span class="lcal-acard__time">' + (it.start_time ? esc(fmtTime(it.start_time)) + (it.end_time ? "<small>" + esc(fmtTime(it.end_time)) + "</small>" : "") : "<small>" + esc(timeRange(it)) + "</small>") + "</span>" +
            '<span class="lcal-acard__icon">' + ic(iconOf(it)) + "</span>" +
            '<span class="lcal-acard__body"><strong>' + esc(it.title) + "</strong>" +
            '<span>' + esc(it.cancelled ? "Sin clase este día" : [CATS[catOf(it)].one, metaLine(it, role)].filter(Boolean).join(" · ")) + "</span></span>" +
            '<span class="lcal-acard__chev">' + ic("right") + "</span></button>");
          card.onclick = function () { showItem(it); };
          box.appendChild(card);
        });
        list.appendChild(sec);
      });
      if (!keys.length) {
        list.appendChild(emptyNote(isThisMonth ? "No hay nada más programado este mes." : "No hay nada programado este mes."));
      }
      var nextM = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      var more = h('<button type="button" class="lcal-agenda__more">Ver ' + esc(monthName(nextM).toLowerCase()) + " " + ic("right") + "</button>");
      more.onclick = function () { setCursor(nextM); };
      list.appendChild(more);
      bodyEl.appendChild(list);
    }
    function scrollAgendaTo(k) {
      var el = bodyEl.querySelector('[data-day="' + k + '"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function emptyNote(text) {
      var n = h('<div class="lcal-empty"><span class="lcal-empty__ic">' + ic("cal") + "</span><p>" + esc(text) + "</p>" +
        (editable ? '<button type="button" class="btn btn-sm btn-dark">' + ic("plus") + "<span>Agregar algo</span></button>" : "") + "</div>");
      if (editable) n.querySelector("button").onclick = function () { editEvent(null, keyOf(cursor < today ? today : cursor)); };
      return n;
    }

    /* --- detalle --- */
    function dayDetail(day, list) {
      var k = keyOf(day);
      var box = h('<div class="lcal-daylist"></div>');
      var sheet;
      list.forEach(function (it) {
        var row = h('<button type="button" class="lcal-acard' + (it.cancelled ? " is-cancelled" : "") + (it.category === "sin_clase" || it.cancelled ? " is-striped" : "") + '" style="--c:' + colorOf(it) + '">' +
          '<span class="lcal-acard__icon">' + ic(iconOf(it)) + "</span>" +
          '<span class="lcal-acard__body"><strong>' + esc(it.title) + "</strong><span>" + esc(timeRange(it) + (metaLine(it, role) ? " · " + metaLine(it, role) : "")) + "</span></span>" +
          '<span class="lcal-acard__chev">' + ic("right") + "</span></button>");
        row.onclick = function () { sheet.close(); showItem(it); };
        box.appendChild(row);
      });
      var actions = [];
      if (editable) actions.push({ label: "Agregar en este día", icon: "plus", cls: "btn-dark", fn: function () { editEvent(null, k); } });
      sheet = openSheet({ color: "#101010", icon: "cal", label: list.length + (list.length === 1 ? " elemento" : " elementos"), title: longDay(day), body: box, actions: actions });
    }

    function showItem(it) {
      var c = colorOf(it), cat = CATS[catOf(it)] || CATS.actividad;
      var rows = [];
      rows.push(["clock", it.ends_on !== it.starts_on ? "Del " + longDay(parseKey(it.starts_on)) + " al " + longDay(parseKey(it.ends_on)) : longDay(parseKey(it.starts_on)),
                 it.ends_on !== it.starts_on ? "" : timeRange(it)]);
      if (it.item_type === "class") {
        rows.push(["book", it.details, "Módulo " + (it.group_label || "").split(" · ")[0]]);
        if (it.session_number) rows.push(["text", "Agenda DAY " + it.session_number, "Clase n.º " + it.session_number + " del ciclo"]);
        if (it.author) rows.push(["user", it.author, "Profesor(a)"]);
        if (it.cycle_name) rows.push(["layers", it.cycle_name, "Ciclo"]);
        if (it.student_count != null) rows.push(["users", it.student_count + (it.student_count === 1 ? " estudiante" : " estudiantes"), "Inscritos en el grupo"]);
      } else {
        if (it.category === "reposicion" && it.makeup_of) {
          rows.push(["redo", "Recupera la clase del " + longDay(parseKey(it.makeup_of)).toLowerCase(), it.session_number ? "Agenda DAY " + it.session_number : ""]);
        }
        var aud = audienceLabel(it, role);
        if (aud) rows.push([it.audience === "personal" ? "lock" : it.audience === "group" ? "users" : "globe", aud, "Para"]);
        rows.push(["user", it.author, "Publicado por"]);
      }
      var b = h('<div class="lcal-detail">' +
        (it.cancelled ? '<div class="lcal-note">' + ic("calx") + "<span>Este día no hay clase.</span></div>" : "") +
        '<ul class="lcal-meta">' + rows.map(function (r) {
          return "<li>" + ic(r[0]) + "<span><strong>" + esc(r[1]) + "</strong>" + (r[2] ? "<small>" + esc(r[2]) + "</small>" : "") + "</span></li>";
        }).join("") + "</ul>" +
        (it.item_type !== "class" && it.details ? '<div class="lcal-desc">' + ic("text") + "<p>" + esc(it.details) + "</p></div>" : "") +
        (it.link_url && /^https:\/\//.test(it.link_url) ? '<a class="lcal-linkbtn" href="' + esc(it.link_url) + '" target="_blank" rel="noopener">' + ic("link") + "<span>Abrir enlace</span></a>" : "") +
        "</div>");
      var actions = [];
      if (it.item_type === "event" && it.can_edit) {
        actions.push({ label: "Eliminar", icon: "trash", cls: "btn-danger", left: true, fn: function () { return confirmRemove(it); } });
        actions.push({ label: "Editar", icon: "edit", cls: "btn-dark", fn: function () { editEvent(it); } });
      }
      openSheet({ color: c, icon: cat.icon, label: cat.one, title: it.title, body: b, actions: actions });
    }

    function confirmRemove(it) {
      return new Promise(function (resolve, reject) {
        var b = h('<p class="lcal-confirm">Se borra “' + esc(it.title) + "” del calendario" +
          (it.audience === "personal" ? "." : " y deja de verse para las personas a las que iba dirigido.") + "</p>");
        openSheet({ color: "#8a2b2b", icon: "trash", label: "Eliminar", title: "¿Eliminar del calendario?", body: b,
          onClose: function () { reject(new Error("Cancelado.")); }, actions: [
          { label: "Cancelar" },
          { label: "Eliminar", cls: "btn-danger", fn: function () {
            return sb.from("calendar_events").delete().eq("id", it.id).select("id").then(function (r) {
              if (r.error) throw r.error;
              if (!r.data || !r.data.length) throw new Error("No se pudo eliminar (quizá ya no existe o no es tuyo).");
              toast("Eliminado del calendario.");
              resolve(); refresh();
            });
          } }
        ] });
      }).then(null, function (e) { if (e && e.message === "Cancelado.") return true; throw e; });
    }

    /* --- crear / editar --- */
    function loadGroups() {
      if (groupsP) return groupsP;
      var qy = sb.from("groups").select("id,active,teacher_id,modules(level,module_number),schedules(days,start_time,end_time),teachers(full_name)").eq("active", true);
      if (role === "teacher") qy = qy.eq("teacher_id", opts.teacherId);
      groupsP = qy.then(function (r) {
        if (r.error) throw r.error;
        return (r.data || []).sort(function (a, b) {
          return ((a.modules || {}).module_number || 0) - ((b.modules || {}).module_number || 0);
        });
      });
      groupsP.catch(function () { groupsP = null; });
      return groupsP;
    }
    function groupDays(g) {
      var s = g.schedules || {};
      return (s.days || []).slice().sort(function (a, b) { return DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b); })
        .map(function (x) { return DAY_ES[x] || x; }).join(" ") + " · " + fmtTime(s.start_time);
    }

    function editEvent(ev, dayKey, atTime) {
      loadGroups().catch(function () { return []; }).then(function (groups) {
        var cats = CATS_BY_ROLE[role];
        if (ev && cats.indexOf(ev.category) === -1) cats = [ev.category];
        var e = ev || {
          category: cats[0], starts_on: dayKey, ends_on: dayKey,
          start_time: atTime || null, end_time: null,
          audience: role === "teacher" ? (groups.length ? "group" : "personal") : "all",
          group_id: role === "teacher" && groups[0] ? groups[0].id : null
        };
        var allDay = !e.start_time;
        var audVal = e.audience === "group" ? (role === "teacher" ? "g:" + e.group_id : "group") : e.audience;
        var audOpts = role === "teacher"
          ? groups.map(function (g) {
              return ["g:" + g.id, "users", "Grupo " + ((g.modules || {}).level || ""), groupDays(g), MODULE_COLORS[(((g.modules || {}).module_number || 1) - 1) % MODULE_COLORS.length]];
            }).concat([["personal", "lock", "Solo para mí", "Una nota personal: nadie más la ve.", "#4d4d4d"]])
          : [["all", "globe", "Todos", "Profesores y estudiantes", "#2e4e9e"],
             ["students", "cap", "Estudiantes", "Todos los estudiantes", "#2e4e9e"],
             ["teachers", "user", "Profesores", "Todos los profesores", "#2e4e9e"],
             ["group", "users", "Un grupo", "Sus estudiantes y su profesor", "#2e4e9e"],
             ["personal", "lock", "Solo para mí", "Nota personal", "#4d4d4d"]];

        var f = h('<div class="lcal-form">' +
          '<label class="lcal-f"><span class="lcal-f__l">Título</span><input name="title" maxlength="140" value="' + esc(e.title || "") + '" placeholder="' +
            (role === "teacher" ? "Ej.: Quiz de la unidad 3" : "Ej.: Semana de receso") + '"></label>' +
          '<div class="lcal-f"><span class="lcal-f__l">Tipo</span><div class="lcal-cats">' + cats.map(function (c) {
            return '<label class="lcal-cat" style="--c:' + CATS[c].color + '"><input type="radio" name="category" value="' + c + '"' + (e.category === c ? " checked" : "") + ">" +
              "<span>" + ic(CATS[c].icon) + esc(CATS[c].one) + "</span></label>";
          }).join("") + '</div><p class="lcal-f__hint" data-cat-hint></p></div>' +
          '<div class="lcal-f"><span class="lcal-f__l">Cuándo</span>' +
          '<div class="lcal-when"><label class="lcal-in">' + ic("cal") + '<input type="date" name="starts_on" value="' + esc(e.starts_on || "") + '" aria-label="Fecha"></label>' +
          '<label class="lcal-switch"><input type="checkbox" name="allday"' + (allDay ? " checked" : "") + '><i></i><span>Todo el día</span></label></div>' +
          '<div class="lcal-when" data-times' + (allDay ? ' style="display:none"' : "") + '>' +
          '<label class="lcal-in">' + ic("clock") + '<input type="time" name="start_time" value="' + esc((e.start_time || "").slice(0, 5)) + '" aria-label="Hora de inicio"></label>' +
          '<span class="lcal-when__sep">a</span>' +
          '<label class="lcal-in">' + ic("clock") + '<input type="time" name="end_time" value="' + esc((e.end_time || "").slice(0, 5)) + '" aria-label="Hora de fin"></label></div>' +
          '<div class="lcal-when" data-until' + (allDay ? "" : ' style="display:none"') + '>' +
          '<span class="lcal-when__sep">Hasta</span><label class="lcal-in">' + ic("cal") + '<input type="date" name="ends_on" value="' + esc(e.ends_on && e.ends_on !== e.starts_on ? e.ends_on : "") + '" aria-label="Hasta"></label>' +
          '<span class="lcal-f__hint" style="margin:0">(opcional, para varios días)</span></div></div>' +
          '<div class="lcal-f"><span class="lcal-f__l">¿Para quién?</span><div class="lcal-auds">' + audOpts.map(function (o) {
            return '<label class="lcal-aud" style="--c:' + o[4] + '"><input type="radio" name="aud" value="' + esc(o[0]) + '"' + (audVal === o[0] ? " checked" : "") + ">" +
              '<span class="lcal-aud__ic">' + ic(o[1]) + '</span><span class="lcal-aud__t"><strong>' + esc(o[2]) + "</strong><small>" + esc(o[3]) + "</small></span></label>";
          }).join("") + "</div>" +
          (role === "admin" ? '<label class="lcal-in lcal-groupsel" data-group-pick style="display:none">' + ic("users") + '<select name="group_id">' +
            (groups.length ? groups.map(function (g) {
              return '<option value="' + g.id + '"' + (e.group_id === g.id ? " selected" : "") + ">" + esc(((g.modules || {}).level || "") + " · " + groupDays(g) + (g.teachers ? " · " + g.teachers.full_name : "")) + "</option>";
            }).join("") : '<option value="">No hay grupos activos</option>') + "</select></label>" : "") +
          (role === "teacher" && !groups.length ? '<p class="lcal-f__hint">Todavía no tienes grupos asignados: por ahora solo puedes crear notas personales.</p>' : "") +
          "</div>" +
          '<label class="lcal-f"><span class="lcal-f__l">Detalles <em>opcional</em></span><textarea name="details" rows="3" maxlength="2000" placeholder="Instrucciones, páginas, materiales…">' + esc(e.details || "") + "</textarea></label>" +
          '<label class="lcal-f"><span class="lcal-f__l">Enlace <em>opcional</em></span><span class="lcal-in">' + ic("link") + '<input name="link_url" inputmode="url" placeholder="https://" value="' + esc(e.link_url || "") + '"></span></label>' +
          "</div>");

        var allBox = f.querySelector("[name=allday]"), times = f.querySelector("[data-times]"), until = f.querySelector("[data-until]");
        allBox.onchange = function () { times.style.display = allBox.checked ? "none" : ""; until.style.display = allBox.checked ? "" : "none"; };
        var catHint = f.querySelector("[data-cat-hint]");
        function curCat() { var x = f.querySelector("[name=category]:checked"); return x ? x.value : cats[0]; }
        function syncCat() { catHint.textContent = CAT_HINT[curCat()] || ""; }
        f.querySelectorAll("[name=category]").forEach(function (r) { r.onchange = syncCat; }); syncCat();
        var gp = f.querySelector("[data-group-pick]");
        function curAud() { var x = f.querySelector("[name=aud]:checked"); return x ? x.value : ""; }
        function syncAud() { if (gp) gp.style.display = curAud() === "group" ? "" : "none"; }
        f.querySelectorAll("[name=aud]").forEach(function (r) { r.onchange = syncAud; }); syncAud();

        function save() {
          var val = function (n) { var x = f.querySelector("[name=" + n + "]"); return x ? String(x.value || "").trim() : ""; };
          var title = val("title");
          if (title.length < 2) throw new Error("Escribe un título.");
          var starts = val("starts_on");
          if (!starts) throw new Error("Elige la fecha.");
          var ends = allBox.checked ? (val("ends_on") || starts) : starts;
          if (ends < starts) throw new Error("La fecha “Hasta” no puede ser antes de la fecha de inicio.");
          var row = { title: title, category: curCat(), details: val("details"), starts_on: starts, ends_on: ends,
                      start_time: null, end_time: null, link_url: val("link_url") || null };
          if (row.link_url && !/^https:\/\//.test(row.link_url)) {
            if (/^[\w-]+(\.[\w-]+)+/.test(row.link_url)) row.link_url = "https://" + row.link_url;
            else throw new Error("El enlace debe empezar por https://");
          }
          if (!allBox.checked) {
            row.start_time = val("start_time") || null;
            row.end_time = val("end_time") || null;
            if (!row.start_time) throw new Error("Elige la hora de inicio o marca “Todo el día”.");
            if (row.end_time && row.end_time <= row.start_time) throw new Error("La hora de fin debe ser después de la de inicio.");
          }
          var a = curAud();
          if (!a) throw new Error("Elige para quién es.");
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
            if (!ev && row.category === "sin_clase" && ["group", "students", "all"].indexOf(row.audience) !== -1) {
              notifyClassChange(sb, r.data[0].id).then(function (res) {
                toast(res && res.sent ? "Agregado. Se avisó por correo a " + res.sent + (res.sent === 1 ? " estudiante." : " estudiantes.")
                  : "Agregado al calendario (no había estudiantes a quienes avisar ese día).");
              }).catch(function () { toast("Agregado, pero no se pudo enviar el correo a los estudiantes.", "err"); });
            } else toast(ev ? "Cambios guardados." : "Agregado al calendario.");
            cursor = parseKey(starts);
            miniMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
            refresh();
          });
        }
        openSheet({ color: "#101010", icon: ev ? "edit" : "plus", label: ev ? "Editar" : "Nuevo evento",
          title: ev ? ev.title : longDay(parseKey(dayKey)), body: f, wide: true,
          actions: [{ label: "Cancelar" }, { label: ev ? "Guardar cambios" : "Guardar", cls: "btn-dark", fn: save }] });
        setTimeout(function () { var t = f.querySelector("[name=title]"); if (t && !ev) t.focus(); }, 30);
      });
    }

    render();
    return { reload: refresh };
  }

  // Correo a los estudiantes por una clase cancelada o una reposición
  // (función notify-class-change; cada evento se avisa una sola vez).
  function notifyClassChange(sb, eventId) {
    return sb.auth.getSession().then(function (r) {
      var tok = r.data && r.data.session ? r.data.session.access_token : "";
      return fetch(window.LEF_SUPABASE.url + "/functions/v1/notify-class-change", {
        method: "POST", headers: { "Authorization": "Bearer " + tok, "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId })
      }).then(function (res) { return res.json().then(function (j) { if (!res.ok) throw new Error(j.error || "Error"); return j; }); });
    });
  }

  window.LEFCalendar = { mount: mount, notifyClassChange: notifyClassChange };
})();
