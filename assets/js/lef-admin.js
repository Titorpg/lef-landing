/* LEF — Panel administrativo (SPA en JS plano).
   Auth con Supabase. Roles: admin (todo) · teacher (lectura de sus grupos).
   Secciones: Dashboard · Estudiantes · Pagos · Académico · Usuarios */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var ME = null;
  var TOKEN = null;

  /* ============ utilidades ============ */
  function h(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function money(n, cur) {
    if (n == null) return "—";
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: cur || "COP", maximumFractionDigits: 0 }).format(n);
  }
  function date(s) {
    if (!s) return "—";
    var d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : new Date(s);
    return d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
  }
  var DAY_ES = { Monday: "Lun", Tuesday: "Mar", Wednesday: "Mié", Thursday: "Jue", Friday: "Vie", Saturday: "Sáb", Sunday: "Dom" };
  function days(arr) { return (arr || []).map(function (d) { return DAY_ES[d] || d; }).join(" "); }
  function time(t) { if (!t) return ""; var p = t.split(":"); var hh = +p[0]; return (hh % 12 || 12) + ":" + p[1] + (hh >= 12 ? "pm" : "am"); }
  var MONTHS_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  function lastDay(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
  function ymd(y, m0, d) { return y + "-" + String(m0 + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }

  // Un color fijo por módulo (module_number 1..12). A1.1 = azul de marca.
  var MODULE_COLORS = ["#2e4e9e", "#4a86c5", "#5bb1a9", "#6f9d4a", "#b3a133", "#cf8b3b",
                       "#c15b4a", "#9a5aa3", "#5f6bd0", "#7d8794", "#3aa0a0", "#33415c"];
  function modColor(n) { return MODULE_COLORS[((n || 1) - 1) % 12]; }

  var PAYST_ES = { approved: "Aprobado", pending: "Pendiente", declined: "Rechazado", refunded: "Reversado" };
  var METHOD_ES = { cash: "Efectivo", transfer: "Transferencia", pse: "PSE", card: "Tarjeta", other: "Otro" };
  var DOC_TYPES = ["TI", "CC", "CE", "PP"];
  var DOC_LABEL = { TI: "Tarjeta de identidad", CC: "Cédula de ciudadanía", CE: "Cédula de extranjería", PP: "Pasaporte" };
  function docSelect(name, val) {
    return '<select name="' + name + '">' + DOC_TYPES.map(function (k) {
      return '<option value="' + k + '"' + (k === val ? " selected" : "") + ">" + esc(DOC_LABEL[k]) + "</option>";
    }).join("") + "</select>";
  }
  var ROLE_ES = { admin: "Administrador", teacher: "Profesor", student: "Estudiante" };
  var ENROLL_STATUS = ["Pending", "Contacted", "Confirmed", "Paid", "Cancelled"];
  var ENROLL_ES = { Pending: "Nueva", Contacted: "Contactada", Confirmed: "Confirmada", Paid: "Pagada", Cancelled: "Cancelada" };

  function toast(msg, kind) {
    var t = h('<div class="pnl-alert ' + (kind || "ok") + '" style="position:fixed;right:20px;bottom:20px;z-index:80;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.15)">' + esc(msg) + "</div>");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4600);
  }
  function modal(title, bodyNode, onSave, saveLabel, danger) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h('<div class="pnl-modal"><h3>' + esc(title) + "</h3></div>");
    box.appendChild(bodyNode);
    var err = h('<div class="pnl-alert err" style="display:none"></div>');
    box.appendChild(err);
    var row = h('<div class="row"><button class="btn btn-ghost" data-x>Cancelar</button>' +
      '<button class="btn ' + (danger ? "btn-danger" : "btn-dark") + '" data-s>' + esc(saveLabel || "Guardar") + "</button></div>");
    box.appendChild(row);
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    row.querySelector("[data-x]").onclick = close;
    row.querySelector("[data-s]").onclick = function () {
      var btn = row.querySelector("[data-s]"); btn.disabled = true;
      Promise.resolve().then(onSave).then(function () { close(); }).catch(function (e) {
        err.textContent = friendly(e); err.style.display = "block"; btn.disabled = false;
      });
    };
    return { close: close };
  }
  function confirmDelete(title, message, onConfirm) {
    return modal(title, h('<p class="pnl-sub" style="margin-bottom:4px">' + esc(message) + "</p>"), onConfirm, "Eliminar", true);
  }
  function field(label, inputHtml) { return '<label class="fld"><span>' + esc(label) + "</span>" + inputHtml + "</label>"; }
  function moduleSelect(name, mods, selectedId) {
    return '<select name="' + name + '">' + mods.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === selectedId ? " selected" : "") + ">" +
        esc(m.level + " · " + m.title) + "</option>";
    }).join("") + "</select>";
  }
  var BLOCK_TABLE_ES = {
    enrollments: "inscripciones", payments: "pagos", subscriptions: "suscripciones",
    groups: "grupos", schedules: "horarios", students: "estudiantes", teachers: "profesores"
  };
  var CODE_ES = {
    LEF_PAYMENT_INMUTABLE: "Un pago registrado no se edita ni se borra. Usa “Reversar” para corregirlo.",
    LEF_PERIOD_ALREADY_PAID: "Ya hay un pago aprobado para ese mes en esta suscripción. Si fue un error, revérsalo primero.",
    LEF_ALREADY_REVERSED: "Ese pago ya tiene un reverso registrado.",
    LEF_PAYMENT_NOT_FOUND: "No se encontró el pago.",
    LEF_STUDENT_NOT_FOUND: "No se encontró el estudiante.",
    LEF_INVALID_DOC_TYPE: "Tipo de documento inválido.",
    LEF_MISSING_FIELDS: "Faltan datos obligatorios (nombre, documento, WhatsApp o correo)."
  };
  function friendly(e) {
    var m = (e && e.message) || String(e);
    var key = Object.keys(CODE_ES).find(function (k) { return m.indexOf(k) === 0 || m.indexOf(k) > -1; });
    if (key) return CODE_ES[key];
    if (e && (e.code === "23503" || /foreign key|violates/i.test(m))) {
      var det = (e && e.details) || "";
      var tbl = (det.match(/from table "(\w+)"/) || [])[1];
      var label = BLOCK_TABLE_ES[tbl] || "otros registros";
      return "No se puede eliminar: tiene " + label + " asociados. Cámbialos, cancélalos o desactívalo primero.";
    }
    if (e && e.code === "23505") return "Ya existe un registro con ese dato (correo duplicado, por ejemplo).";
    return m;
  }
  function btn(label, cls, fn) { var b = h('<button class="btn btn-sm ' + cls + '">' + esc(label) + "</button>"); b.onclick = fn; return b; }

  /* ============ datos ============ */
  function q(table) { return sb.from(table); }
  function rpc(fn, args) { return sb.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function activeModules() {
    return q("modules").select("id,level,title,module_number").eq("active", true).order("module_number")
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  function callFn(body) {
    return fetch(window.LEF_SUPABASE.url + "/functions/v1/manage-users", {
      method: "POST",
      headers: { "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(async function (r) {
      var j = await r.json();
      if (!r.ok) throw new Error(j.error || "Error");
      return j;
    });
  }

  /* ============ auth ============ */
  function boot() {
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      if (!s) return (window.location.replace("login.html"));
      TOKEN = s.access_token;
      return q("profiles").select("*").eq("user_id", s.user.id).maybeSingle().then(function (p) {
        if (p.error || !p.data || !p.data.active) {
          return sb.auth.signOut().then(function () { window.location.replace("login.html"); });
        }
        if (!["admin", "teacher"].includes(p.data.role)) return (window.location.replace("portal.html"));
        ME = p.data;
        renderShell();
      });
    });
  }

  /* ============ shell ============ */
  var SECTIONS = [
    { id: "dashboard", label: "Dashboard", roles: ["admin", "teacher"] },
    { id: "estudiantes", label: "Estudiantes", roles: ["admin", "teacher"] },
    { id: "pagos", label: "Pagos", roles: ["admin"] },
    { id: "academico", label: "Académico", roles: ["admin"] },
    { id: "usuarios", label: "Usuarios", roles: ["admin"] }
  ];

  function renderShell() {
    app.innerHTML = "";
    var allowed = SECTIONS.filter(function (s) { return s.roles.includes(ME.role); });
    app.appendChild(h(
      '<div class="pnl-top">' +
      '<a class="brand" href="#dashboard"><img src="assets/logo-horizontal.png" alt="LEF"></a>' +
      '<div class="who">' + esc(ME.full_name || ME.email) + " · " + esc(ROLE_ES[ME.role] || ME.role) +
      ' <button class="link" data-logout>Salir</button></div>' +
      "</div>"
    ));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"></nav><main class="pnl-main"></main></div>');
    var nav = wrap.querySelector(".pnl-nav");
    allowed.forEach(function (s) { nav.appendChild(h('<a href="#' + s.id + '">' + esc(s.label) + "</a>")); });
    app.appendChild(wrap);
    app.querySelector("[data-logout]").onclick = function () { sb.auth.signOut().then(boot); };

    window.onhashchange = route;
    var cur = location.hash.slice(1);
    if (cur === "inscripciones") { location.hash = "dashboard"; return; }
    if (!cur || !allowed.some(function (s) { return s.id === cur; })) location.hash = allowed[0].id;
    else route();
  }

  function route() {
    var id = location.hash.slice(1);
    if (id === "inscripciones") { location.hash = "dashboard"; return; }
    document.querySelectorAll(".pnl-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
    var main = document.querySelector(".pnl-main");
    if (!main) return;
    main.innerHTML = '<p class="muted">Cargando…</p>';
    var fn = ({
      dashboard: secDashboard, estudiantes: secEstudiantes,
      pagos: secPagos, academico: secAcademico, usuarios: secUsuarios
    })[id];
    if (fn) fn(main); else main.innerHTML = "<p>Sección no encontrada.</p>";
  }

  function head(main, title, sub) {
    main.innerHTML = '<h1 class="pnl-h">' + esc(title) + "</h1>" +
      (sub ? '<p class="pnl-sub">' + esc(sub) + "</p>" : "");
  }
  function tableWrap(cols) {
    var w = h('<div class="pnl-table-wrap"><table class="pnl"><thead><tr>' +
      cols.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") +
      "</tr></thead><tbody></tbody></table></div>");
    return { wrap: w, body: w.querySelector("tbody") };
  }
  function statRow(tiles) {
    return h('<div class="stat-row">' + tiles.map(function (t) {
      return '<div class="stat"><div class="k">' + esc(t[0]) + '</div><div class="v">' + t[1] + "</div></div>";
    }).join("") + "</div>");
  }

  /* ============ donut (SVG, sin librerías) ============ */
  function donut(modItems) {
    // modItems: [{n: module_number, label, value}] — TODOS los módulos activos
    var total = modItems.reduce(function (a, b) { return a + b.value; }, 0);
    var arcs = "";
    if (total) {
      var acc = 0;
      modItems.filter(function (m) { return m.value > 0; }).forEach(function (m) {
        var pct = m.value / total * 100;
        arcs += '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + modColor(m.n) +
          '" stroke-width="5" stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) +
          '" stroke-dashoffset="' + (25 - acc).toFixed(2) + '"></circle>';
        acc += pct;
      });
    }
    var svg = '<svg viewBox="0 0 42 42" class="donut-svg" role="img" aria-label="Inscripciones por módulo">' +
      '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eee" stroke-width="5"></circle>' + arcs +
      '<text x="21" y="20.5" text-anchor="middle" class="donut-c1">' + total + "</text>" +
      '<text x="21" y="25" text-anchor="middle" class="donut-c2">inscritos</text></svg>';
    var legend = '<ul class="donut-legend">' + modItems.map(function (m) {
      var pct = total ? Math.round(m.value / total * 100) : 0;
      return '<li><span class="sw" style="background:' + modColor(m.n) + '"></span>' +
        '<span class="lb">' + esc(m.label) + '</span><span class="vl">' + m.value + " · " + pct + "%</span></li>";
    }).join("") + "</ul>";
    return h('<div class="donut-wrap">' + svg + legend + "</div>");
  }

  /* ============ DASHBOARD ============ */
  function secDashboard(main) {
    var isAdmin = ME.role === "admin";
    head(main, "Dashboard", isAdmin ? "Resumen general del sistema." : "Resumen de tus grupos.");

    var jobs = [
      q("enrollments").select("id,registration_number,status,created_at,module_id,students(full_name,whatsapp,email),modules(level,title,module_number),groups(schedules(days,start_time,end_time),teachers(full_name))").order("created_at", { ascending: false }),
      q("students").select("id", { count: "exact", head: true }),
      q("modules").select("id,level,title,module_number,active").order("module_number"),
      q("teachers").select("id", { count: "exact", head: true }).eq("active", true)
    ];
    if (isAdmin) {
      jobs.push(rpc("admin_billing_overview"));
      jobs.push(q("payments").select("amount,currency,method,status,paid_at,receipt_number,student_name,students(full_name)").order("paid_at", { ascending: false }).limit(8));
    }

    Promise.all(jobs).then(function (res) {
      if (res[0].error) throw res[0].error;
      var enr = res[0].data || [];
      var studentCount = res[1].count || 0;
      var mods = res[2].data || [];
      var teacherCount = res[3].count || 0;
      var billing = isAdmin ? (res[4] || []) : [];
      var recentPays = isAdmin ? (res[5].data || []) : [];

      var activos = enr.filter(function (e) { return e.status !== "Cancelled"; });
      var nuevas = enr.filter(function (e) { return e.status === "Pending"; }).length;
      var alDia = billing.filter(function (b) { return b.status === "active" && !b.is_overdue; }).length;
      var mora = billing.filter(function (b) { return b.status === "active" && b.is_overdue; }).length;
      var congeladas = billing.filter(function (b) { return b.status === "frozen"; }).length;

      var tiles = [["Estudiantes", studentCount], ["Profesores", teacherCount],
        ["Inscripciones activas", activos.length], ["Inscripciones nuevas", nuevas]];
      if (isAdmin) { tiles.push(["Al día", alDia]); tiles.push(["En mora", mora]); tiles.push(["Congeladas", congeladas]); }
      main.appendChild(statRow(tiles));

      /* --- donut: TODOS los módulos activos, cada uno con su color --- */
      var countByMod = {};
      activos.forEach(function (e) { if (e.module_id) countByMod[e.module_id] = (countByMod[e.module_id] || 0) + 1; });
      var modItems = mods.filter(function (m) { return m.active || countByMod[m.id]; }).map(function (m) {
        return { n: m.module_number, label: m.level + " · " + m.title + (m.active ? "" : " (inactivo)"), value: countByMod[m.id] || 0 };
      });
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:26px 0 12px">Inscripciones por módulo</h2>'));
      main.appendChild(donut(modItems));

      /* --- estado módulos --- */
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:28px 0 12px">Estado de los módulos</h2>'));
      var inactive = mods.filter(function (m) { return !m.active; });
      if (inactive.length) {
        main.appendChild(h('<div class="mod-warn"><span class="ico">⚠️</span><div>' +
          "<b>" + inactive.length + " módulo(s) desactivado(s).</b> No aparecen para inscribir ni asignar. " +
          "Revisa que sea intencional:<br>" +
          inactive.map(function (m) { return esc(m.level + " · " + m.title); }).join(" · ") +
          '</div></div>'));
      } else {
        main.appendChild(h('<div class="mod-ok">Los ' + mods.length + " módulos están activos.</div>"));
      }

      /* --- inscripciones --- */
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:30px 0 12px">Inscripciones</h2>'));
      var t1 = tableWrap(["Matrícula", "Estudiante", "Contacto", "Módulo", "Horario", "Profesor", "Estado", "Fecha"]);
      enr.forEach(function (e) {
        var sc = e.groups && e.groups.schedules;
        var tr = h("<tr>" +
          "<td>" + esc(e.registration_number) + "</td>" +
          "<td>" + esc(e.students ? e.students.full_name : "—") + "</td>" +
          '<td class="wrap">' + esc(e.students ? e.students.whatsapp : "") + "<br><span class='muted'>" + esc(e.students ? e.students.email : "") + "</span></td>" +
          "<td>" + esc(e.modules ? e.modules.level + " · " + e.modules.title : "—") + "</td>" +
          "<td>" + (sc ? esc(days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time)) : "—") + "</td>" +
          "<td>" + esc(e.groups && e.groups.teachers ? e.groups.teachers.full_name : "—") + "</td>" +
          "<td></td><td>" + date(e.created_at) + "</td></tr>");
        var cell = tr.children[6];
        if (isAdmin) {
          var sel = h('<select style="width:auto">' + ENROLL_STATUS.map(function (s) {
            return '<option value="' + s + '"' + (s === e.status ? " selected" : "") + ">" + ENROLL_ES[s] + "</option>";
          }).join("") + "</select>");
          sel.onchange = function () {
            q("enrollments").update({ status: sel.value }).eq("id", e.id).then(function (u) {
              toast(u.error ? u.error.message : "Estado actualizado.", u.error ? "err" : "ok");
              if (!u.error) route();
            });
          };
          cell.appendChild(sel);
        } else cell.innerHTML = '<span class="badge neutral">' + ENROLL_ES[e.status] + "</span>";
        t1.body.appendChild(tr);
      });
      if (!enr.length) t1.body.appendChild(h('<tr><td colspan="8" class="muted">Sin inscripciones todavía.</td></tr>'));
      main.appendChild(t1.wrap);

      if (isAdmin) {
        main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:30px 0 12px">Pagos recientes</h2>'));
        var t2 = tableWrap(["Recibo", "Estudiante", "Monto", "Método", "Estado", "Fecha"]);
        recentPays.forEach(function (p) {
          var badge = p.status === "approved" ? "ok" : p.status === "refunded" ? "neutral" : p.status === "declined" ? "bad" : "neutral";
          var nombre = (p.students && p.students.full_name) || p.student_name || "—";
          t2.body.appendChild(h("<tr><td>" + esc(p.receipt_number || "—") + "</td><td>" + esc(nombre) + "</td><td>" +
            money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) + '</td><td><span class="badge ' + badge + '">' +
            esc(PAYST_ES[p.status] || p.status) + "</span></td><td>" + date(p.paid_at) + "</td></tr>"));
        });
        if (!recentPays.length) t2.body.appendChild(h('<tr><td colspan="6" class="muted">Sin pagos registrados.</td></tr>'));
        main.appendChild(t2.wrap);
      }
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  /* ============ ESTUDIANTES ============ */
  function secEstudiantes(main) {
    head(main, "Estudiantes", "Personas inscritas. El admin gestiona sus datos, el módulo en que están y su cuenta de acceso.");
    var toolbar;
    if (ME.role === "admin") {
      toolbar = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark" data-add>+ Estudiante</button>' +
        '<span class="muted" style="font-size:13px">Al agregar uno se elige su módulo y queda inscrito.</span></div>');
      main.appendChild(toolbar);
    }
    Promise.all([
      q("students").select("*").order("created_at", { ascending: false }),
      ME.role === "admin" ? q("profiles").select("user_id,student_id,email,active").eq("role", "student") : Promise.resolve({ data: [] }),
      q("enrollments").select("student_id,module_id,status,created_at,modules(level,title,module_number)").order("created_at", { ascending: false }),
      activeModules()
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var profByStudent = {}, modByStudent = {};
      (res[1].data || []).forEach(function (p) { if (p.student_id) profByStudent[p.student_id] = p; });
      (res[2].data || []).forEach(function (e) {
        if (e.status === "Cancelled") return;
        if (!modByStudent[e.student_id]) modByStudent[e.student_id] = e; // el más reciente
      });
      var mods = res[3];
      if (toolbar) toolbar.querySelector("[data-add]").onclick = function () { editStudent(null, null, mods); };

      var t = tableWrap(["Nombre", "Documento", "Módulo", "WhatsApp", "Correo", "Ciudad", "Cuenta portal", "Acciones"]);
      (res[0].data || []).forEach(function (s) {
        var prof = profByStudent[s.id];
        var enr = modByStudent[s.id];
        var modLabel = enr && enr.modules ? enr.modules.level + " · " + enr.modules.title : "—";
        var modColorDot = enr && enr.modules ? '<span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:' + modColor(enr.modules.module_number) + '"></span>' : "";
        var estado = !prof ? '<span class="badge neutral">sin cuenta</span>'
          : prof.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>';
        var tr = h([
          "<tr><td>", esc(s.full_name), "</td>",
          "<td>", esc((s.doc_type || "") + " " + (s.doc_number || "—")), "</td>",
          "<td>", modColorDot, esc(modLabel), "</td>",
          "<td>", esc(s.whatsapp), '</td><td class="wrap">', esc(s.email), "</td>",
          "<td>", esc(s.city || "—"), "</td>",
          "<td>", estado, (prof ? '<br><span class="muted" style="font-size:12px">' + esc(prof.email) + "</span>" : ""), "</td>",
          '<td class="acts"></td></tr>'
        ].join(""));
        var cell = tr.children[7];
        if (ME.role === "admin") {
          if (!prof) cell.appendChild(btn("Crear cuenta de portal", "btn-blue", function () { crearCuentaEstudiante(s); }));
          else {
            cell.appendChild(btn("Restablecer contraseña", "btn-ghost", function () { resetStudentPwd(s, prof); }));
            cell.appendChild(btn((prof.active ? "Desactivar" : "Activar") + " acceso", "btn-ghost", function () {
              callFn({ action: "set_active", user_id: prof.user_id, active: !prof.active })
                .then(function () { toast("Actualizado."); route(); }).catch(function (e) { toast(friendly(e), "err"); });
            }));
          }
          cell.appendChild(btn("Editar", "btn-ghost", function () { editStudent(s, enr ? enr.module_id : null, mods); }));
          cell.appendChild(btn("Eliminar", "btn-danger", function () { deleteStudent(s, prof); }));
        }
        t.body.appendChild(tr);
      });
      if (!res[0].data.length) t.body.appendChild(h('<tr><td colspan="8" class="muted">Sin estudiantes todavía. Aparecerán al inscribirse por el formulario, o agrégalos con “+ Estudiante”.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function editStudent(s, currentModuleId, mods) {
    if (!mods.length) { toast("No hay módulos activos. Activa alguno en Académico.", "err"); return; }
    var b = h("<div>" +
      field("Nombre completo del estudiante", '<input name="n" value="' + esc(s ? s.full_name : "") + '">') +
      field("Tipo de documento", docSelect("dt", s ? s.doc_type : "TI")) +
      field("Número de documento", '<input name="dn" value="' + esc(s ? (s.doc_number || "") : "") + '">') +
      field("Módulo en que se inscribe", moduleSelect("mod", mods, currentModuleId || mods[0].id)) +
      field("WhatsApp", '<input name="w" value="' + esc(s ? s.whatsapp : "") + '">') +
      field("Correo", '<input name="e" type="email" value="' + esc(s ? s.email : "") + '">') +
      field("Edad (opcional)", '<input name="a" type="number" min="5" max="100" value="' + (s && s.age ? s.age : "") + '">') +
      field("Ciudad (opcional)", '<input name="c" value="' + esc(s ? (s.city || "") : "") + '">') +
      '<p class="pnl-sub">El documento del estudiante es obligatorio. Si es menor de edad, va su tarjeta de identidad; el documento de quien paga se registra aparte, en la suscripción.</p>' +
      (s ? '<p class="pnl-sub">Cambiar el módulo actualiza su inscripción (si tenía grupo asignado, se libera).</p>' : "") +
      "</div>");
    modal(s ? "Editar estudiante" : "Nuevo estudiante", b, function () {
      var docNum = b.querySelector("[name=dn]").value.trim();
      if (docNum.length < 3) throw new Error("Ingresa el número de documento del estudiante.");
      var payload = {
        full_name: b.querySelector("[name=n]").value.trim(),
        doc_type: b.querySelector("[name=dt]").value,
        doc_number: docNum,
        whatsapp: b.querySelector("[name=w]").value.trim(),
        email: b.querySelector("[name=e]").value.trim(),
        age: +b.querySelector("[name=a]").value || null,
        city: b.querySelector("[name=c]").value.trim() || null
      };
      var moduleId = b.querySelector("[name=mod]").value;
      var pr = s
        ? q("students").update(payload).eq("id", s.id).then(function (r) { if (r.error) throw r.error; return s.id; })
        : q("students").insert(payload).select("id").single().then(function (r) { if (r.error) throw r.error; return r.data.id; });
      return pr.then(function (sid) {
        return rpc("admin_assign_module", { p_student_id: sid, p_module_id: moduleId });
      }).then(function () { toast(s ? "Estudiante actualizado." : "Estudiante inscrito."); route(); });
    }, s ? "Guardar" : "Inscribir");
  }

  function resetStudentPwd(s, prof) {
    var np = "lef" + Math.random().toString(36).slice(2, 10);
    var bb = h("<div>" + field("Nueva contraseña temporal", '<input name="p" value="' + np + '">') +
      '<p class="pnl-sub">Compártela con el estudiante. Podrá cambiarla luego.</p></div>');
    modal("Restablecer contraseña — " + s.full_name, bb, function () {
      return callFn({ action: "reset_password", user_id: prof.user_id, password: bb.querySelector("[name=p]").value })
        .then(function () { toast("Contraseña actualizada."); });
    }, "Guardar");
  }

  function deleteStudent(s, prof) {
    // El borrado real lo hace admin_delete_student (transaccional): borra
    // inscripciones y suscripciones sin pagos; DESLIGA las suscripciones/pagos
    // con historial (quedan fijos como libro contable). Luego borramos la cuenta.
    function doDelete() {
      return rpc("admin_delete_student", { p_student_id: s.id })
        .then(function () { return prof ? callFn({ action: "delete_account", user_id: prof.user_id }) : null; })
        .then(function () { toast("Estudiante eliminado."); route(); });
    }
    q("payments").select("id", { count: "exact", head: true }).eq("student_id", s.id).then(function (pc) {
      if (pc.error) throw pc.error;
      var n = pc.count || 0;
      if (n === 0) {
        confirmDelete("Eliminar estudiante",
          "Vas a eliminar a " + s.full_name + " y todo lo asociado (inscripción, suscripción y cuenta de acceso). No tiene pagos registrados.",
          doDelete);
        return;
      }
      var b = h("<div>" +
        '<p class="pnl-sub" style="margin-bottom:6px">' + esc(s.full_name) + " tiene <strong>" + n + " pago(s) registrado(s)</strong>.</p>" +
        '<p class="pnl-sub" style="margin-bottom:6px">Al eliminarlo, esos pagos <strong>NO se borran</strong>: quedan en el libro contable como historial fijo, pero <strong>desligados</strong> de este estudiante. Si más adelante vuelves a crear a esta persona, <strong>no se reconectará</strong> con esos pagos.</p>' +
        '<p class="pnl-sub" style="margin-bottom:10px">Se eliminan su inscripción, sus suscripciones sin pagos y su cuenta de acceso. Esta acción no se puede deshacer.</p>' +
        field('Escribe ELIMINAR para confirmar', '<input name="confirm" autocomplete="off" placeholder="ELIMINAR">') +
        "</div>");
      modal("Eliminar estudiante con historial de pagos", b, function () {
        if ((b.querySelector("[name=confirm]").value || "").trim().toUpperCase() !== "ELIMINAR")
          throw new Error('Escribe ELIMINAR para confirmar.');
        return doDelete();
      }, "Eliminar definitivamente", true);
    }).catch(function (e) { toast(friendly(e), "err"); });
  }

  function crearCuentaEstudiante(s) {
    var pwd = "lef" + Math.random().toString(36).slice(2, 10);
    var body = h("<div>" +
      field("Nombre", '<input name="fn" value="' + esc(s.full_name) + '">') +
      field("Correo (usuario para entrar)", '<input name="em" type="email" value="' + esc(s.email) + '">') +
      field("Contraseña temporal", '<input name="pw" value="' + pwd + '">') +
      '<p class="pnl-sub">Comparte estos datos con el estudiante. Entra en ' + esc(window.location.host) +
      '/login y podrá cambiar la contraseña luego.</p></div>');
    modal("Crear cuenta de portal — " + s.full_name, body, function () {
      return callFn({
        action: "create_account", role: "student",
        full_name: body.querySelector("[name=fn]").value.trim(),
        email: body.querySelector("[name=em]").value.trim(),
        password: body.querySelector("[name=pw]").value,
        student_id: s.id
      }).then(function () { toast("Cuenta creada."); route(); });
    }, "Crear cuenta");
  }

  /* ============ PAGOS ============ */
  function secPagos(main) {
    head(main, "Pagos", "Suscripciones mensuales y estado de pago. El cobro en línea (Wompi) se habilitará en la Fase 2.");
    var bar = h('<div class="pnl-toolbar">' +
      '<button class="btn btn-ghost btn-sm" data-freeze>Congelar cuentas vencidas</button>' +
      '<span class="muted" style="font-size:13px">La congelación automática se agenda en la Fase 2.</span></div>');
    main.appendChild(bar);
    bar.querySelector("[data-freeze]").onclick = function () {
      rpc("freeze_overdue_subscriptions").then(function (n) { toast(n + " cuenta(s) congelada(s)."); route(); })
        .catch(function (e) { toast(friendly(e), "err"); });
    };
    Promise.all([
      rpc("admin_billing_overview"),
      q("students").select("id,full_name,doc_type,doc_number,email,whatsapp").order("full_name"),
      activeModules()
    ]).then(function (res) {
        var rows = res[0] || [], students = res[1].data || [], mods = res[2];
        var newBtn = h('<button class="btn btn-dark btn-sm" data-new>+ Nueva suscripción</button>');
        bar.appendChild(newBtn);
        newBtn.onclick = function () { editarSuscripcion(null, students, mods); };
        var t = tableWrap(["Estudiante / pagador", "Módulo", "Mensualidad", "Próximo pago", "Último pago", "Estado", "Acciones"]);
        rows.forEach(function (r) {
          var st = r.status === "frozen" ? '<span class="badge bad">congelada</span>'
            : r.is_overdue ? '<span class="badge warn">en mora</span>'
            : r.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
            : '<span class="badge ok">al día</span>';
          var who = esc(r.student_name) +
            (r.student_deleted ? ' <span class="badge neutral">estudiante eliminado</span>' : "") +
            (r.payer_name && r.payer_name !== r.student_name
              ? '<br><span class="muted" style="font-size:12px">paga: ' + esc(r.payer_name) +
                (r.payer_doc_number ? " (" + esc((r.payer_doc_type || "") + " " + r.payer_doc_number) + ")" : "") + "</span>"
              : "");
          var tr = h("<tr><td>" + who + '</td><td class="wrap">' + esc(r.module_label || "—") +
            "</td><td>" + money(r.monthly_amount, r.currency) + "</td><td>" + date(r.next_due_date) + "</td><td>" +
            (r.last_payment_at ? date(r.last_payment_at) + " · " + money(r.last_payment_amount, r.currency) : "—") +
            '</td><td>' + st + '</td><td class="acts"></td></tr>');
          var cell = tr.children[6];
          cell.appendChild(btn("Ver pagos", "btn-ghost", function () { verPagos(r); }));
          if (!r.student_deleted) {
            cell.appendChild(btn("Registrar pago", "btn-blue", function () { registrarPago(r); }));
            cell.appendChild(btn("Editar", "btn-ghost", function () { editarSuscripcion(r, students, mods); }));
            cell.appendChild(btn("Eliminar", "btn-danger", function () {
              confirmDelete("Eliminar suscripción", "Solo se puede si no tiene pagos registrados. Si los tiene, revérsalos primero o elimina al estudiante (el historial se conserva).", function () {
                return q("subscriptions").delete().eq("id", r.subscription_id).then(function (d) {
                  if (d.error) throw d.error; toast("Suscripción eliminada."); route();
                });
              });
            }));
          }
          t.body.appendChild(tr);
        });
        if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Sin suscripciones. Crea una con “Nueva suscripción”.</td></tr>'));
        main.appendChild(t.wrap);
      }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function verPagos(r) {
    var box = h('<div><p class="muted">Cargando…</p></div>');
    modal("Pagos — " + r.student_name, box, null, "Cerrar");
    q("payments").select("*").eq("subscription_id", r.subscription_id).order("paid_at", { ascending: false })
      .then(function (res) {
        if (res.error) throw res.error;
        var pays = res.data || [];
        box.innerHTML = "";
        if (!pays.length) { box.appendChild(h('<p class="muted">Sin pagos en esta suscripción.</p>')); return; }
        var reversedIds = {};
        pays.forEach(function (p) { if (p.reverses_payment) reversedIds[p.reverses_payment] = true; });
        var tbl = tableWrap(["Recibo", "Mes", "Monto", "Método", "Pagador", "Estado", ""]);
        pays.forEach(function (p) {
          var isReversal = !!p.reverses_payment;
          var isReversed = reversedIds[p.id];
          var estado = p.status === "refunded" ? '<span class="badge neutral">reverso</span>'
            : isReversed ? '<span class="badge warn">reversado</span>'
            : '<span class="badge ok">' + esc(PAYST_ES[p.status] || p.status) + "</span>";
          var tr = h("<tr><td>" + esc(p.receipt_number || "—") + "</td><td>" + esc((p.period_month || "").slice(0, 7)) +
            "</td><td>" + money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) +
            '</td><td class="wrap">' + esc((p.payer_name || "—") + (p.payer_doc_number ? " · " + (p.payer_doc_type || "") + " " + p.payer_doc_number : "")) +
            "</td><td>" + estado + '</td><td class="acts"></td></tr>');
          if (!isReversal && !isReversed && p.status === "approved") {
            tr.children[6].appendChild(btn("Reversar", "btn-danger", function () { reversarPago(p); }));
          }
          tbl.body.appendChild(tr);
        });
        box.appendChild(tbl.wrap);
      }).catch(function (e) { box.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
  }

  function reversarPago(p) {
    var b = h("<div>" +
      '<p class="pnl-sub" style="margin-bottom:10px">Se creará un asiento de <strong>reverso</strong> del recibo ' + esc(p.receipt_number || p.id) +
      " por " + money(p.amount, p.currency) + ". El pago original queda en el libro (no se borra). Revisa después la fecha del próximo pago de la suscripción.</p>" +
      field("Motivo del reverso", '<input name="reason" placeholder="Ej.: monto equivocado, pago duplicado">') +
      "</div>");
    modal("Reversar pago", b, function () {
      var reason = (b.querySelector("[name=reason]").value || "").trim();
      if (reason.length < 3) throw new Error("Escribe el motivo del reverso.");
      return rpc("admin_reverse_payment", { p_payment_id: p.id, p_reason: reason })
        .then(function () { toast("Reverso registrado."); route(); });
    }, "Reversar", true);
  }

  function payerFields(src) {
    src = src || {};
    return '<p class="pnl-sub" style="margin:14px 0 6px;font-weight:600">Datos de quien paga (para el libro contable)</p>' +
      field("Nombre de quien paga", '<input name="pn" value="' + esc(src.name || "") + '">') +
      field("Tipo de documento", docSelect("pdt", src.docType || "CC")) +
      field("Número de documento", '<input name="pdn" value="' + esc(src.docNumber || "") + '">') +
      field("Correo (opcional)", '<input name="pe" type="email" value="' + esc(src.email || "") + '">') +
      field("Teléfono (opcional)", '<input name="pp" value="' + esc(src.phone || "") + '">');
  }
  function readPayer(box) {
    var g = function (n) { var el = box.querySelector("[name=" + n + "]"); return el ? el.value.trim() : ""; };
    var name = g("pn"), doc = g("pdn");
    if (name.length < 2 || doc.length < 3) throw new Error("Ingresa el nombre y el documento de quien paga.");
    return {
      p_payer_name: name, p_payer_doc_type: g("pdt"), p_payer_doc_number: doc,
      p_payer_email: g("pe") || null, p_payer_phone: g("pp") || null
    };
  }
  function payerFromStudent(s) {
    return s ? { name: s.full_name, docType: s.doc_type, docNumber: s.doc_number, email: s.email, phone: s.whatsapp } : {};
  }

  function editarSuscripcion(r, students, mods) {
    var byId = {}; students.forEach(function (s) { byId[s.id] = s; });
    var initPayer = r
      ? { name: r.payer_name, docType: r.payer_doc_type, docNumber: r.payer_doc_number, email: r.payer_email, phone: r.payer_phone }
      : payerFromStudent(students[0]);
    var body = h("<div>" +
      (r ? "" : field("Estudiante", '<select name="sid">' + students.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.full_name) + "</option>";
      }).join("") + "</select>")) +
      field("Módulo", moduleSelect("mod", mods, r ? r.module_id : (mods[0] && mods[0].id))) +
      field("Mensualidad (COP)", '<input name="amt" type="number" min="0" value="' + (r ? r.monthly_amount : "") + '">') +
      field("Día de cobro (1–28)", '<input name="day" type="number" min="1" max="28" value="' + (r ? "" : 1) + '" placeholder="1">') +
      field("Días de gracia", '<input name="grace" type="number" min="0" max="60" value="5">') +
      (r ? field("Estado", '<select name="status"><option value="active">Activa</option><option value="frozen">Congelada</option><option value="cancelled">Cancelada</option></select>') : "") +
      payerFields(initPayer) +
      (r ? "" : '<p class="pnl-sub">Si el estudiante es mayor y paga él mismo, deja sus datos. Si paga un familiar, cámbialos.</p>') +
      "</div>");
    if (r) {
      body.querySelector("[name=mod]").value = r.module_id || (mods[0] && mods[0].id);
      if (body.querySelector("[name=status]")) body.querySelector("[name=status]").value = r.status;
    }
    var sidSel = body.querySelector("[name=sid]");
    if (sidSel) sidSel.onchange = function () {
      var p = payerFromStudent(byId[sidSel.value]);
      body.querySelector("[name=pn]").value = p.name || "";
      body.querySelector("[name=pdt]").value = p.docType || "CC";
      body.querySelector("[name=pdn]").value = p.docNumber || "";
      body.querySelector("[name=pe]").value = p.email || "";
      body.querySelector("[name=pp]").value = p.phone || "";
    };
    modal(r ? "Editar suscripción" : "Nueva suscripción", body, function () {
      var payer = readPayer(body);
      var payload = {
        module_id: body.querySelector("[name=mod]").value,
        monthly_amount: +body.querySelector("[name=amt]").value || 0,
        grace_days: +body.querySelector("[name=grace]").value || 5,
        payer_name: payer.p_payer_name, payer_doc_type: payer.p_payer_doc_type,
        payer_doc_number: payer.p_payer_doc_number, payer_email: payer.p_payer_email,
        payer_phone: payer.p_payer_phone
      };
      var day = +body.querySelector("[name=day]").value;
      if (day >= 1 && day <= 28) payload.billing_day = day;
      if (r) {
        payload.status = body.querySelector("[name=status]").value;
        payload.updated_at = new Date().toISOString();
        return q("subscriptions").update(payload).eq("id", r.subscription_id).then(function (u) {
          if (u.error) throw u.error; toast("Suscripción actualizada."); route();
        });
      }
      payload.student_id = body.querySelector("[name=sid]").value;
      if (payload.billing_day) {
        var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1);
        payload.next_due_date = ymd(d.getFullYear(), d.getMonth(), payload.billing_day);
      }
      return q("subscriptions").insert(payload).then(function (i) {
        if (i.error) throw i.error; toast("Suscripción creada."); route();
      });
    }, r ? "Guardar" : "Crear");
  }

  function registrarPago(r) {
    var now = new Date();
    var body = h("<div>" +
      field("Monto (COP)", '<input name="amt" type="number" min="0" value="' + (r.monthly_amount || "") + '">') +
      field("Método", '<select name="m"><option value="cash">Efectivo</option><option value="transfer">Transferencia</option><option value="pse">PSE</option><option value="card">Tarjeta</option><option value="other">Otro</option></select>') +
      field("Mes que cubre", '<input name="pm" type="month" value="' + now.toISOString().slice(0, 7) + '">') +
      field("Referencia / nº de soporte (opcional)", '<input name="ref" placeholder="Nº de consignación, transferencia…">') +
      field("Nota (opcional)", '<input name="note">') +
      payerFields({
        name: r.payer_name, docType: r.payer_doc_type, docNumber: r.payer_doc_number,
        email: r.payer_email, phone: r.payer_phone
      }) +
      '<p class="pnl-sub">Registra el documento que figura en el soporte del pago (puede ser distinto al del estudiante).</p>' +
      "</div>");
    modal("Registrar pago — " + r.student_name, body, function () {
      var payer = readPayer(body);
      return rpc("record_payment", Object.assign({
        p_subscription_id: r.subscription_id,
        p_amount: +body.querySelector("[name=amt]").value || 0,
        p_method: body.querySelector("[name=m]").value,
        p_period_month: body.querySelector("[name=pm]").value + "-01",
        p_reference: body.querySelector("[name=ref]").value.trim() || null,
        p_notes: body.querySelector("[name=note]").value.trim() || null
      }, payer)).then(function () { toast("Pago registrado."); route(); });
    }, "Registrar");
  }

  /* ============ ACADÉMICO ============ */
  function secAcademico(main) {
    head(main, "Académico", "Módulos, ciclos, profesores, horarios y grupos.");
    var tabs = ["modulos", "ciclos", "profesores", "horarios", "grupos"];
    var lbl = { modulos: "Módulos", ciclos: "Ciclos", profesores: "Profesores", horarios: "Horarios", grupos: "Grupos" };
    var bar = h('<div class="pnl-toolbar">' + tabs.map(function (t) {
      return '<button class="btn btn-sm btn-ghost" data-tab="' + t + '">' + lbl[t] + "</button>";
    }).join("") + "</div>");
    main.appendChild(bar);
    var box = h("<div></div>"); main.appendChild(box);
    bar.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () {
        bar.querySelectorAll("[data-tab]").forEach(function (x) { x.classList.remove("btn-dark"); x.classList.add("btn-ghost"); });
        b.classList.add("btn-dark"); b.classList.remove("btn-ghost");
        ({ modulos: acModulos, ciclos: acCiclos, profesores: acProfesores, horarios: acHorarios, grupos: acGrupos })[b.dataset.tab](box);
      };
    });
    bar.querySelector("[data-tab]").click();
  }

  function acModulos(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([q("modules").select("*").order("module_number"), rpc("module_enrollment_counts")])
      .then(function (res) {
        var counts = {};
        (res[1] || []).forEach(function (c) { counts[c.module_id] = c.count; });
        var t = tableWrap(["#", "Nivel", "Título", "Descripción", "Inscritos", "Estado", "Acciones"]);
        (res[0].data || []).forEach(function (m) {
          var tr = h("<tr><td>" + m.module_number + '</td><td><span style="display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:6px;background:' + modColor(m.module_number) + '"></span>' + esc(m.level) +
            "</td><td>" + esc(m.title) + '</td><td class="wrap">' + esc(m.description) +
            '</td><td style="font-weight:600">' + (counts[m.id] || 0) + "</td><td>" +
            (m.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
            '</td><td class="acts"></td></tr>');
          var cell = tr.children[6];
          cell.appendChild(btn(m.active ? "Desactivar" : "Activar", "btn-ghost", function () {
            rpc("admin_set_module_active", { p_module_id: m.id, p_active: !m.active }).then(function () {
              toast("Módulo " + (m.active ? "desactivado" : "activado") + (m.active ? " (y sus horarios/grupos con él)." : " (y sus horarios/grupos que él había apagado)."));
              acModulos(box);
            }).catch(function (e) { toast(friendly(e), "err"); });
          }));
          cell.appendChild(btn("Editar", "btn-ghost", function () {
            var b = h("<div>" + field("Título (en inglés)", '<input name="t" value="' + esc(m.title) + '">') +
              field("Descripción (en español)", '<textarea name="d" rows="3">' + esc(m.description) + "</textarea>") + "</div>");
            modal("Editar módulo " + m.level, b, function () {
              return q("modules").update({
                title: b.querySelector("[name=t]").value.trim(),
                description: b.querySelector("[name=d]").value.trim()
              }).eq("id", m.id).then(function (u) { if (u.error) throw u.error; toast("Guardado."); acModulos(box); });
            });
          }));
          t.body.appendChild(tr);
        });
        box.innerHTML = ""; box.appendChild(t.wrap);
      });
  }

  function acProfesores(box) {
    box.innerHTML = "";
    var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Profesor</button></div>');
    box.appendChild(add);
    add.querySelector("button").onclick = function () { editTeacher(box, null); };
    q("teachers").select("*").order("full_name").then(function (r) {
      var t = tableWrap(["Nombre", "Correo", "WhatsApp", "Estado", "Acciones"]);
      (r.data || []).forEach(function (p) {
        var tr = h("<tr><td>" + esc(p.full_name) + "</td><td>" + esc(p.email) + "</td><td>" + esc(p.whatsapp || "—") +
          "</td><td>" + (p.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[4];
        cell.appendChild(btn(p.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("teachers").update({ active: !p.active }).eq("id", p.id).then(function () { acProfesores(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () { editTeacher(box, p); }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar profesor", "Vas a eliminar a " + p.full_name + ". No se puede si tiene grupos asignados.", function () {
            return q("teachers").delete().eq("id", p.id).then(function (d) { if (d.error) throw d.error; toast("Profesor eliminado."); acProfesores(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }
  function editTeacher(box, p) {
    var b = h("<div>" + field("Nombre", '<input name="n" value="' + esc(p ? p.full_name : "") + '">') +
      field("Correo", '<input name="e" type="email" value="' + esc(p ? p.email : "") + '">') +
      field("WhatsApp", '<input name="w" value="' + esc(p ? (p.whatsapp || "") : "") + '">') + "</div>");
    modal(p ? "Editar profesor" : "Nuevo profesor", b, function () {
      var payload = {
        full_name: b.querySelector("[name=n]").value.trim(),
        email: b.querySelector("[name=e]").value.trim(),
        whatsapp: b.querySelector("[name=w]").value.trim() || null
      };
      var pr = p ? q("teachers").update(payload).eq("id", p.id) : q("teachers").insert(payload);
      return pr.then(function (r) { if (r.error) throw r.error; toast(p ? "Profesor actualizado." : "Profesor agregado."); acProfesores(box); });
    }, p ? "Guardar" : "Agregar");
  }

  /* ---- Ciclos ---- */
  function periodOptions() {
    var out = [], now = new Date();
    for (var i = 0; i < 24; i++) {
      var a = new Date(now.getFullYear(), now.getMonth() + i, 1);
      var b = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      var label = a.getFullYear() === b.getFullYear()
        ? MONTHS_ABBR[a.getMonth()] + "-" + MONTHS_ABBR[b.getMonth()] + " " + b.getFullYear()
        : MONTHS_ABBR[a.getMonth()] + " " + a.getFullYear() + " - " + MONTHS_ABBR[b.getMonth()] + " " + b.getFullYear();
      out.push({
        label: label,
        value: a.getFullYear() + "-" + String(a.getMonth() + 1).padStart(2, "0") + "|" +
               b.getFullYear() + "-" + String(b.getMonth() + 1).padStart(2, "0")
      });
    }
    return out;
  }
  function cycleForm(c) {
    var opts = periodOptions();
    var b = h("<div>" +
      field("Periodo", '<select name="p">' + opts.map(function (o) {
        return '<option value="' + o.value + '"' + (c && c.name === o.label ? " selected" : "") + ">" + esc(o.label) + "</option>";
      }).join("") + "</select>") +
      field("Fecha de inicio (mes 1 del periodo)", '<input name="s" type="date">') +
      field("Fecha de fin (mes 2 del periodo)", '<input name="e" type="date">') +
      (c ? field("Estado", '<select name="st"><option value="Open">Abierto</option><option value="Closed">Cerrado</option></select>') : "") +
      "</div>");
    var sel = b.querySelector("[name=p]"), si = b.querySelector("[name=s]"), ei = b.querySelector("[name=e]");
    function applyPeriod() {
      var parts = sel.value.split("|"), a = parts[0].split("-"), z = parts[1].split("-");
      var ay = +a[0], am = +a[1] - 1, zy = +z[0], zm = +z[1] - 1;
      si.min = ymd(ay, am, 1); si.max = ymd(ay, am, lastDay(ay, am));
      ei.min = ymd(zy, zm, 1); ei.max = ymd(zy, zm, lastDay(zy, zm));
      si.value = (c && c.start_date && c.start_date >= si.min && c.start_date <= si.max) ? c.start_date : si.min;
      ei.value = (c && c.end_date && c.end_date >= ei.min && c.end_date <= ei.max) ? c.end_date : ei.max;
    }
    sel.addEventListener("change", applyPeriod);
    applyPeriod();
    if (c && c.status) b.querySelector("[name=st]").value = c.status;
    return b;
  }
  function acCiclos(box) {
    box.innerHTML = "";
    var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Ciclo</button></div>');
    box.appendChild(add);
    add.querySelector("button").onclick = function () {
      var b = cycleForm(null);
      modal("Nuevo ciclo", b, function () {
        return q("cycles").insert({
          name: b.querySelector("[name=p]").selectedOptions[0].textContent,
          start_date: b.querySelector("[name=s]").value, end_date: b.querySelector("[name=e]").value, status: "Open"
        }).then(function (i) { if (i.error) throw i.error; toast("Ciclo creado."); acCiclos(box); });
      });
    };
    q("cycles").select("*").order("start_date", { ascending: false }).then(function (r) {
      var t = tableWrap(["Periodo", "Inicio", "Fin", "Estado", "Acciones"]);
      (r.data || []).forEach(function (c) {
        var tr = h("<tr><td>" + esc(c.name) + "</td><td>" + date(c.start_date) + "</td><td>" + date(c.end_date) +
          "</td><td>" + (c.status === "Open" ? '<span class="badge ok">abierto</span>' : '<span class="badge neutral">cerrado</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[4];
        cell.appendChild(btn(c.status === "Open" ? "Cerrar" : "Abrir", "btn-ghost", function () {
          q("cycles").update({ status: c.status === "Open" ? "Closed" : "Open" }).eq("id", c.id).then(function () { acCiclos(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () {
          var b = cycleForm(c);
          modal("Editar ciclo", b, function () {
            return q("cycles").update({
              name: b.querySelector("[name=p]").selectedOptions[0].textContent,
              start_date: b.querySelector("[name=s]").value, end_date: b.querySelector("[name=e]").value,
              status: b.querySelector("[name=st]").value
            }).eq("id", c.id).then(function (u) { if (u.error) throw u.error; toast("Ciclo actualizado."); acCiclos(box); });
          });
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar ciclo", "No se puede si tiene horarios asociados.", function () {
            return q("cycles").delete().eq("id", c.id).then(function (d) { if (d.error) throw d.error; toast("Ciclo eliminado."); acCiclos(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  var DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  function acHorarios(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      q("schedules").select("*,cycles(name,status),modules(level,title,active)").order("created_at", { ascending: false }),
      q("cycles").select("id,name,status"), activeModules()
    ]).then(function (res) {
      box.innerHTML = "";
      var cycles = res[1].data || [], modules = res[2];
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Horario</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
        var b = h("<div>" +
          field("Ciclo", '<select name="c">' + cycles.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + (c.status !== "Open" ? " (cerrado)" : "") + "</option>"; }).join("") + "</select>") +
          field("Módulo", moduleSelect("m", modules, modules[0] && modules[0].id)) +
          field("Días", '<div>' + DOW.map(function (d) { return '<label style="display:inline-flex;gap:4px;margin:0 8px 6px 0;font-size:13px"><input type="checkbox" style="width:auto" value="' + d + '">' + DAY_ES[d] + "</label>"; }).join("") + "</div>") +
          field("Hora inicio", '<input name="s" type="time" value="18:00">') + field("Hora fin", '<input name="e" type="time" value="19:00">') + "</div>");
        modal("Nuevo horario", b, function () {
          var dsel = Array.prototype.slice.call(b.querySelectorAll("input[type=checkbox]:checked")).map(function (x) { return x.value; });
          if (!dsel.length) throw new Error("Elige al menos un día.");
          return q("schedules").insert({
            cycle_id: b.querySelector("[name=c]").value, module_id: b.querySelector("[name=m]").value,
            days: dsel, start_time: b.querySelector("[name=s]").value, end_time: b.querySelector("[name=e]").value
          }).then(function (i) { if (i.error) throw i.error; toast("Horario creado."); acHorarios(box); });
        });
      };
      var t = tableWrap(["Ciclo", "Módulo", "Días", "Horario", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (s) {
        var modTxt = s.modules ? s.modules.level + " · " + s.modules.title + (s.modules.active ? "" : " (módulo inactivo)") : "—";
        var estadoTxt = s.active ? '<span class="badge ok">activo</span>'
          : '<span class="badge neutral">inactivo' + (s.deactivated_by_module ? " · por módulo" : "") + "</span>";
        var tr = h("<tr><td>" + esc(s.cycles ? s.cycles.name : "—") + "</td><td>" + esc(modTxt) +
          "</td><td>" + esc(days(s.days)) + "</td><td>" + esc(time(s.start_time) + "–" + time(s.end_time)) +
          "</td><td>" + estadoTxt +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[5];
        cell.appendChild(btn(s.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("schedules").update({ active: !s.active, deactivated_by_module: false }).eq("id", s.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else acHorarios(box); });
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar horario", "No se puede si tiene grupos asociados.", function () {
            return q("schedules").delete().eq("id", s.id).then(function (d) { if (d.error) throw d.error; toast("Horario eliminado."); acHorarios(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  function acGrupos(box) {
    box.innerHTML = '<p class="muted">Cargando…</p>';
    Promise.all([
      q("groups").select("*,modules(level,title),teachers(full_name),schedules(days,start_time,end_time,cycles(name))").order("created_at", { ascending: false }),
      q("schedules").select("id,days,start_time,end_time,module_id,modules(level,title,active)").eq("active", true),
      q("teachers").select("id,full_name").eq("active", true),
      rpc("group_enrollment_counts")
    ]).then(function (res) {
      box.innerHTML = "";
      var scheds = (res[1].data || []).filter(function (s) { return s.modules && s.modules.active; });
      var teachers = res[2].data || [];
      var counts = {};
      (res[3] || []).forEach(function (c) { counts[c.group_id] = c.count; });
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Grupo</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
        if (!scheds.length) { toast("No hay horarios activos con módulo activo.", "err"); return; }
        var b = h("<div>" +
          field("Horario", '<select name="s">' + scheds.map(function (s) {
            return '<option value="' + s.id + '" data-mod="' + s.module_id + '">' + esc((s.modules ? s.modules.level : "") + " · " + days(s.days) + " " + time(s.start_time)) + "</option>";
          }).join("") + "</select>") +
          field("Profesor", '<select name="t">' + teachers.map(function (t) { return '<option value="' + t.id + '">' + esc(t.full_name) + "</option>"; }).join("") + "</select>") +
          field("Cupo", '<input name="c" type="number" min="1" max="8" value="8">') + "</div>");
        modal("Nuevo grupo", b, function () {
          var opt = b.querySelector("[name=s]").selectedOptions[0];
          return q("groups").insert({
            schedule_id: b.querySelector("[name=s]").value, module_id: opt.dataset.mod,
            teacher_id: b.querySelector("[name=t]").value, capacity: +b.querySelector("[name=c]").value || 8
          }).then(function (i) { if (i.error) throw i.error; toast("Grupo creado."); acGrupos(box); });
        });
      };
      var t = tableWrap(["Módulo", "Ciclo", "Horario", "Profesor", "Cupo", "Inscritos", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (g) {
        var sc = g.schedules;
        var estadoTxt = g.active ? '<span class="badge ok">activo</span>'
          : '<span class="badge neutral">inactivo' + (g.deactivated_by_module ? " · por módulo" : "") + "</span>";
        var tr = h("<tr><td>" + esc(g.modules ? g.modules.level + " · " + g.modules.title : "—") + "</td><td>" + esc(sc && sc.cycles ? sc.cycles.name : "—") +
          "</td><td>" + esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "—") + "</td><td>" + esc(g.teachers ? g.teachers.full_name : "—") +
          "</td><td>" + g.capacity + '</td><td style="font-weight:600">' + (counts[g.id] || 0) + "</td><td>" + estadoTxt +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[7];
        cell.appendChild(btn(g.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("groups").update({ active: !g.active, deactivated_by_module: false }).eq("id", g.id)
            .then(function (u) { if (u.error) toast(friendly(u.error), "err"); else acGrupos(box); });
        }));
        cell.appendChild(btn("Editar", "btn-ghost", function () {
          var b = h("<div>" +
            field("Profesor", '<select name="t">' + teachers.map(function (tt) {
              return '<option value="' + tt.id + '"' + (tt.id === g.teacher_id ? " selected" : "") + ">" + esc(tt.full_name) + "</option>";
            }).join("") + "</select>") +
            field("Cupo (máx. 8)", '<input name="c" type="number" min="1" max="8" value="' + g.capacity + '">') + "</div>");
          modal("Editar grupo", b, function () {
            return q("groups").update({
              teacher_id: b.querySelector("[name=t]").value,
              capacity: +b.querySelector("[name=c]").value || g.capacity
            }).eq("id", g.id).then(function (u) { if (u.error) throw u.error; toast("Grupo actualizado."); acGrupos(box); });
          });
        }));
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          var activos = counts[g.id] || 0;
          var msg = activos > 0
            ? "Tiene " + activos + " inscripción(es) activa(s) en este grupo. Cámbialas de módulo (Estudiantes > Editar) o cancélalas (Dashboard > Inscripciones) antes de eliminar."
            : "Se eliminará el grupo. Las inscripciones canceladas que lo referenciaban quedarán sin grupo (no se borran).";
          confirmDelete("Eliminar grupo", msg, function () {
            if (activos > 0) throw new Error(msg);
            return q("groups").delete().eq("id", g.id).then(function (d) { if (d.error) throw d.error; toast("Grupo eliminado."); acGrupos(box); });
          });
        }));
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  /* ============ USUARIOS ============ */
  function secUsuarios(main) {
    head(main, "Usuarios", "Todas las cuentas y personas del sistema, con su rol. Solo el administrador gestiona aquí.");
    var bar = h('<div class="pnl-toolbar">' +
      '<button class="btn btn-sm btn-dark" data-new>+ Cuenta de staff</button>' +
      '<select data-f-rol style="width:auto"><option value="">Todos los roles</option><option value="admin">Administrador</option><option value="teacher">Profesor</option><option value="student">Estudiante</option></select>' +
      '<select data-f-est style="width:auto"><option value="">Activos e inactivos</option><option value="1">Solo activos</option><option value="0">Solo inactivos</option></select>' +
      '<select data-f-ord style="width:auto"><option value="desc">Más recientes primero</option><option value="asc">Más antiguos primero</option></select>' +
      "</div>");
    main.appendChild(bar);
    var host = h("<div></div>"); main.appendChild(host);

    bar.querySelector("[data-new]").onclick = function () {
      q("teachers").select("id,full_name").eq("active", true).then(function (tr) {
        var teachers = tr.data || [];
        var pwd = "lef" + Math.random().toString(36).slice(2, 10);
        var b = h("<div>" +
          field("Rol", '<select name="r"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>') +
          field("Nombre", '<input name="n">') + field("Correo", '<input name="e" type="email">') +
          field("Contraseña temporal", '<input name="p" value="' + pwd + '">') +
          field("Vincular a profesor (opcional)", '<select name="t"><option value="">—</option>' + teachers.map(function (t) { return '<option value="' + t.id + '">' + esc(t.full_name) + "</option>"; }).join("") + "</select>") +
          "</div>");
        modal("Nueva cuenta de staff", b, function () {
          return callFn({
            action: "create_account", role: b.querySelector("[name=r]").value,
            full_name: b.querySelector("[name=n]").value.trim(),
            email: b.querySelector("[name=e]").value.trim(),
            password: b.querySelector("[name=p]").value,
            teacher_id: b.querySelector("[name=t]").value || null
          }).then(function () { toast("Cuenta creada."); load(); });
        }, "Crear");
      });
    };

    function load() {
      host.innerHTML = '<p class="muted">Cargando…</p>';
      Promise.all([q("profiles").select("*"), q("teachers").select("*")]).then(function (res) {
        if (res[0].error) throw res[0].error;
        var profiles = res[0].data || [], teachers = res[1].data || [];
        var linkedTeacher = {};
        profiles.forEach(function (p) { if (p.teacher_id) linkedTeacher[p.teacher_id] = true; });
        var rows = profiles.map(function (p) {
          return { name: p.full_name || "—", email: p.email, role: p.role, active: p.active,
            created_at: p.created_at, kind: "cuenta", user_id: p.user_id };
        });
        teachers.filter(function (t) { return !linkedTeacher[t.id]; }).forEach(function (t) {
          rows.push({ name: t.full_name, email: t.email, role: "teacher", active: t.active,
            created_at: t.created_at, kind: "profesor-sin-cuenta", teacher_id: t.id });
        });

        var fRol = bar.querySelector("[data-f-rol]").value;
        var fEst = bar.querySelector("[data-f-est]").value;
        var fOrd = bar.querySelector("[data-f-ord]").value;
        rows = rows.filter(function (r) {
          if (fRol && r.role !== fRol) return false;
          if (fEst === "1" && !r.active) return false;
          if (fEst === "0" && r.active) return false;
          return true;
        }).sort(function (a, b) {
          var d = new Date(a.created_at) - new Date(b.created_at);
          return fOrd === "asc" ? d : -d;
        });

        var t = tableWrap(["Nombre", "Correo", "Rol", "Acceso", "Creado", "Acciones"]);
        rows.forEach(function (r) {
          var acceso = r.kind === "profesor-sin-cuenta" ? '<span class="badge neutral">sin cuenta</span>'
            : r.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>';
          var tr = h("<tr><td>" + esc(r.name) + "</td><td>" + esc(r.email) + "</td><td>" +
            esc(ROLE_ES[r.role] || r.role) + "</td><td>" + acceso + "</td><td>" + date(r.created_at) +
            '</td><td class="acts"></td></tr>');
          var cell = tr.children[5];
          if (r.kind === "profesor-sin-cuenta") {
            cell.appendChild(btn("Crear cuenta", "btn-blue", function () {
              var pwd = "lef" + Math.random().toString(36).slice(2, 10);
              var b = h("<div>" + field("Nombre", '<input name="n" value="' + esc(r.name) + '">') +
                field("Correo", '<input name="e" type="email" value="' + esc(r.email) + '">') +
                field("Contraseña temporal", '<input name="p" value="' + pwd + '">') + "</div>");
              modal("Crear cuenta — " + r.name, b, function () {
                return callFn({
                  action: "create_account", role: "teacher",
                  full_name: b.querySelector("[name=n]").value.trim(),
                  email: b.querySelector("[name=e]").value.trim(),
                  password: b.querySelector("[name=p]").value, teacher_id: r.teacher_id
                }).then(function () { toast("Cuenta creada."); load(); });
              }, "Crear");
            }));
            t.body.appendChild(tr); return;
          }
          if (r.user_id === ME.user_id) { cell.innerHTML = '<span class="muted">tú</span>'; t.body.appendChild(tr); return; }
          cell.appendChild(btn(r.active ? "Desactivar" : "Activar", "btn-ghost", function () {
            callFn({ action: "set_active", user_id: r.user_id, active: !r.active })
              .then(function () { toast("Actualizado."); load(); }).catch(function (e) { toast(friendly(e), "err"); });
          }));
          if (r.role !== "student") {
            var rl = h('<select style="width:auto"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>');
            rl.value = r.role;
            rl.onchange = function () {
              callFn({ action: "set_role", user_id: r.user_id, role: rl.value })
                .then(function () { toast("Rol actualizado."); }).catch(function (e) { toast(friendly(e), "err"); });
            };
            cell.appendChild(rl);
          }
          cell.appendChild(btn("Eliminar", "btn-danger", function () {
            confirmDelete("Eliminar cuenta", "Se elimina el acceso de " + (r.name || r.email) + ". El registro de estudiante/profesor asociado NO se borra.", function () {
              return callFn({ action: "delete_account", user_id: r.user_id }).then(function () { toast("Cuenta eliminada."); load(); });
            });
          }));
          t.body.appendChild(tr);
        });
        if (!rows.length) t.body.appendChild(h('<tr><td colspan="6" class="muted">Sin usuarios con esos filtros.</td></tr>'));
        host.innerHTML = ""; host.appendChild(t.wrap);
      }).catch(function (e) { host.innerHTML = '<div class="pnl-alert err">' + esc(friendly(e)) + "</div>"; });
    }
    bar.querySelectorAll("select").forEach(function (s) { s.addEventListener("change", load); });
    load();
  }

  boot();
})();
