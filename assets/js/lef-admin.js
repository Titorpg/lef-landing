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
  function lastDay(year, month0) { return new Date(year, month0 + 1, 0).getDate(); }
  function ymd(year, month0, day) {
    return year + "-" + String(month0 + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  }

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
  function field(label, inputHtml) {
    return '<label class="fld"><span>' + esc(label) + "</span>" + inputHtml + "</label>";
  }
  function friendly(e) {
    var m = (e && e.message) || String(e);
    if (e && (e.code === "23503" || /foreign key|violates/i.test(m))) {
      return "No se puede eliminar: tiene registros asociados (inscripciones, pagos, grupos u horarios). Cámbialos o desactívalo primero.";
    }
    if (e && e.code === "23505") return "Ya existe un registro con ese dato (correo duplicado, por ejemplo).";
    return m;
  }

  /* ============ datos ============ */
  function q(table) { return sb.from(table); }
  function rpc(fn, args) { return sb.rpc(fn, args || {}).then(function (r) { if (r.error) throw r.error; return r.data; }); }
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
  var ROLE_ES = { admin: "Administrador", teacher: "Profesor", student: "Estudiante" };
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

  /* ============ donut (SVG, sin librerías) ============ */
  var DONUT_COLORS = ["#2e4e9e", "#3f6fd6", "#6f93da", "#101010", "#4d4d4d", "#8c8c8c", "#c9d6ec"];
  function donut(items) {
    // items: [{label, value}]
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    if (!total) return h('<p class="muted">Sin inscripciones para graficar todavía.</p>');
    var sorted = items.slice().sort(function (a, b) { return b.value - a.value; });
    var top = sorted.slice(0, 6);
    var rest = sorted.slice(6);
    if (rest.length) top.push({ label: "Otros", value: rest.reduce(function (a, b) { return a + b.value; }, 0) });

    var acc = 0;
    var circles = top.map(function (it, i) {
      var pct = it.value / total * 100;
      var c = '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="' + DONUT_COLORS[i % DONUT_COLORS.length] +
        '" stroke-width="5" stroke-dasharray="' + pct.toFixed(2) + " " + (100 - pct).toFixed(2) +
        '" stroke-dashoffset="' + (25 - acc).toFixed(2) + '"></circle>';
      acc += pct;
      return c;
    }).join("");
    var svg = '<svg viewBox="0 0 42 42" class="donut-svg" role="img" aria-label="Inscripciones por módulo">' +
      '<circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#eee" stroke-width="5"></circle>' +
      circles +
      '<text x="21" y="20.5" text-anchor="middle" class="donut-c1">' + total + "</text>" +
      '<text x="21" y="25" text-anchor="middle" class="donut-c2">inscritos</text>' +
      "</svg>";
    var legend = '<ul class="donut-legend">' + top.map(function (it, i) {
      var pct = Math.round(it.value / total * 100);
      return '<li><span class="sw" style="background:' + DONUT_COLORS[i % DONUT_COLORS.length] + '"></span>' +
        '<span class="lb">' + esc(it.label) + "</span><span class=\"vl\">" + it.value + " · " + pct + "%</span></li>";
    }).join("") + "</ul>";
    return h('<div class="donut-wrap">' + svg + legend + "</div>");
  }

  /* ============ DASHBOARD ============ */
  var ENROLL_STATUS = ["Pending", "Contacted", "Confirmed", "Paid", "Cancelled"];
  var ENROLL_ES = { Pending: "Nueva", Contacted: "Contactada", Confirmed: "Confirmada", Paid: "Pagada", Cancelled: "Cancelada" };
  var PAYST_ES = { approved: "Aprobado", pending: "Pendiente", declined: "Rechazado", refunded: "Devuelto" };
  var METHOD_ES = { cash: "Efectivo", transfer: "Transferencia", pse: "PSE", card: "Tarjeta", other: "Otro" };

  function secDashboard(main) {
    var isAdmin = ME.role === "admin";
    head(main, "Dashboard", isAdmin ? "Resumen general del sistema." : "Resumen de tus grupos.");

    var jobs = [
      q("enrollments").select("id,registration_number,status,created_at,students(full_name,whatsapp,email),modules(level,title),groups(schedules(days,start_time,end_time),teachers(full_name))").order("created_at", { ascending: false }),
      q("students").select("id", { count: "exact", head: true })
    ];
    if (isAdmin) {
      jobs.push(rpc("admin_billing_overview"));
      jobs.push(q("payments").select("amount,currency,method,status,paid_at,students(full_name)").order("paid_at", { ascending: false }).limit(8));
    }

    Promise.all(jobs).then(function (res) {
      var enr = (res[0].data || []);
      if (res[0].error) throw res[0].error;
      var studentCount = res[1].count || 0;
      var billing = isAdmin ? (res[2] || []) : [];
      var recentPays = isAdmin ? (res[3].data || []) : [];

      var activos = enr.filter(function (e) { return e.status !== "Cancelled"; });
      var nuevas = enr.filter(function (e) { return e.status === "Pending"; }).length;
      var alDia = billing.filter(function (b) { return b.status === "active" && !b.is_overdue; }).length;
      var mora = billing.filter(function (b) { return b.status === "active" && b.is_overdue; }).length;
      var congeladas = billing.filter(function (b) { return b.status === "frozen"; }).length;

      /* --- KPIs --- */
      var tiles = [
        ["Estudiantes", studentCount],
        ["Inscripciones activas", activos.length],
        ["Inscripciones nuevas", nuevas]
      ];
      if (isAdmin) {
        tiles.push(["Al día", alDia]);
        tiles.push(["En mora", mora]);
        tiles.push(["Congeladas", congeladas]);
      }
      main.appendChild(h('<div class="stat-row">' + tiles.map(function (t) {
        return '<div class="stat"><div class="k">' + esc(t[0]) + '</div><div class="v">' + t[1] + "</div></div>";
      }).join("") + "</div>"));

      /* --- donut de módulos --- */
      var byModule = {};
      activos.forEach(function (e) {
        var key = e.modules ? (e.modules.level + " · " + e.modules.title) : "—";
        byModule[key] = (byModule[key] || 0) + 1;
      });
      var modItems = Object.keys(byModule).map(function (k) { return { label: k, value: byModule[k] }; });
      main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:26px 0 12px">Inscripciones por módulo</h2>'));
      main.appendChild(donut(modItems));

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
            });
          };
          cell.appendChild(sel);
        } else cell.innerHTML = '<span class="badge neutral">' + ENROLL_ES[e.status] + "</span>";
        t1.body.appendChild(tr);
      });
      if (!enr.length) t1.body.appendChild(h('<tr><td colspan="8" class="muted">Sin inscripciones todavía.</td></tr>'));
      main.appendChild(t1.wrap);

      /* --- pagos recientes --- */
      if (isAdmin) {
        main.appendChild(h('<h2 class="pnl-h" style="font-size:15px;margin:30px 0 12px">Pagos recientes</h2>'));
        var t2 = tableWrap(["Estudiante", "Monto", "Método", "Estado", "Fecha"]);
        recentPays.forEach(function (p) {
          var badge = p.status === "approved" ? "ok" : p.status === "declined" ? "bad" : "neutral";
          t2.body.appendChild(h("<tr><td>" + esc(p.students ? p.students.full_name : "—") + "</td><td>" +
            money(p.amount, p.currency) + "</td><td>" + esc(METHOD_ES[p.method] || p.method) + '</td><td><span class="badge ' + badge + '">' +
            esc(PAYST_ES[p.status] || p.status) + "</span></td><td>" + date(p.paid_at) + "</td></tr>"));
        });
        if (!recentPays.length) t2.body.appendChild(h('<tr><td colspan="5" class="muted">Sin pagos registrados.</td></tr>'));
        main.appendChild(t2.wrap);
      }
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  /* ============ ESTUDIANTES ============ */
  function secEstudiantes(main) {
    head(main, "Estudiantes", "Personas inscritas. El admin gestiona aquí sus datos y su cuenta de acceso al portal.");
    if (ME.role === "admin") {
      var bar = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark" data-add>+ Estudiante</button>' +
        '<span class="muted" style="font-size:13px">La mayoría se agregan solos al inscribirse. Usa esto para cargar uno manualmente.</span></div>');
      main.appendChild(bar);
      bar.querySelector("[data-add]").onclick = function () { editStudent(null); };
    }
    Promise.all([
      q("students").select("*").order("created_at", { ascending: false }),
      ME.role === "admin" ? q("profiles").select("user_id,student_id,email,active").eq("role", "student") : Promise.resolve({ data: [] })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var profByStudent = {};
      (res[1].data || []).forEach(function (p) { if (p.student_id) profByStudent[p.student_id] = p; });
      var t = tableWrap(["Nombre", "WhatsApp", "Correo", "Ciudad", "Cuenta portal", "Acciones"]);
      (res[0].data || []).forEach(function (s) {
        var prof = profByStudent[s.id];
        var estado = !prof ? '<span class="badge neutral">sin cuenta</span>'
          : prof.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>';
        var tr = h("<tr>" +
          "<td>" + esc(s.full_name) + "</td><td>" + esc(s.whatsapp) + '</td><td class="wrap">' + esc(s.email) +
          "</td><td>" + esc(s.city || "—") + "</td><td>" + estado +
          (prof ? '<br><span class="muted" style="font-size:12px">' + esc(prof.email) + "</span>" : "") +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[5];
        if (ME.role === "admin") {
          if (!prof) {
            cell.appendChild(btn("Crear cuenta de portal", "btn-blue", function () { crearCuentaEstudiante(s); }));
          } else {
            cell.appendChild(btn("Restablecer contraseña", "btn-ghost", function () { resetStudentPwd(s, prof); }));
            cell.appendChild(btn((prof.active ? "Desactivar" : "Activar") + " acceso", "btn-ghost", function () {
              callFn({ action: "set_active", user_id: prof.user_id, active: !prof.active })
                .then(function () { toast("Actualizado."); route(); }).catch(function (e) { toast(friendly(e), "err"); });
            }));
          }
          cell.appendChild(btn("Editar", "btn-ghost", function () { editStudent(s); }));
          cell.appendChild(btn("Eliminar", "btn-danger", function () { deleteStudent(s, prof); }));
        }
        t.body.appendChild(tr);
      });
      if (!res[0].data.length) t.body.appendChild(h('<tr><td colspan="6" class="muted">Sin estudiantes todavía. Aparecerán al inscribirse, o agrégalos con “+ Estudiante”.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function btn(label, cls, fn) {
    var b = h('<button class="btn btn-sm ' + cls + '">' + esc(label) + "</button>");
    b.onclick = fn;
    return b;
  }

  function editStudent(s) {
    var b = h("<div>" +
      field("Nombre completo", '<input name="n" value="' + esc(s ? s.full_name : "") + '">') +
      field("WhatsApp", '<input name="w" value="' + esc(s ? s.whatsapp : "") + '">') +
      field("Correo", '<input name="e" type="email" value="' + esc(s ? s.email : "") + '">') +
      field("Edad (opcional)", '<input name="a" type="number" min="5" max="100" value="' + (s && s.age ? s.age : "") + '">') +
      field("Ciudad (opcional)", '<input name="c" value="' + esc(s ? (s.city || "") : "") + '">') + "</div>");
    modal(s ? "Editar estudiante" : "Nuevo estudiante", b, function () {
      var payload = {
        full_name: b.querySelector("[name=n]").value.trim(),
        whatsapp: b.querySelector("[name=w]").value.trim(),
        email: b.querySelector("[name=e]").value.trim(),
        age: +b.querySelector("[name=a]").value || null,
        city: b.querySelector("[name=c]").value.trim() || null
      };
      var pr = s ? q("students").update(payload).eq("id", s.id) : q("students").insert(payload);
      return pr.then(function (r) { if (r.error) throw r.error; toast(s ? "Estudiante actualizado." : "Estudiante agregado."); route(); });
    }, s ? "Guardar" : "Agregar");
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
    confirmDelete("Eliminar estudiante", "Vas a eliminar a " + s.full_name + " y todo lo asociado (inscripciones y suscripciones sin pagos). Los pagos registrados NO se pueden borrar por historial contable.", function () {
      return q("payments").select("id", { count: "exact", head: true }).eq("student_id", s.id).then(function (pc) {
        if ((pc.count || 0) > 0) throw new Error("Este estudiante tiene pagos registrados. No se puede eliminar (historial contable). Desactiva su acceso en su lugar.");
        return q("subscriptions").delete().eq("student_id", s.id);
      }).then(function () {
        return q("enrollments").delete().eq("student_id", s.id);
      }).then(function () {
        return prof ? callFn({ action: "delete_account", user_id: prof.user_id }) : null;
      }).then(function () {
        return q("students").delete().eq("id", s.id);
      }).then(function (r) {
        if (r && r.error) throw r.error;
        toast("Estudiante eliminado."); route();
      });
    });
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
    Promise.all([rpc("admin_billing_overview"), q("students").select("id,full_name").order("full_name")])
      .then(function (res) {
        var rows = res[0] || [], students = res[1].data || [];
        var newBtn = h('<button class="btn btn-dark btn-sm" data-new>+ Nueva suscripción</button>');
        bar.appendChild(newBtn);
        newBtn.onclick = function () { editarSuscripcion(null, students); };
        var t = tableWrap(["Estudiante", "Descripción", "Mensualidad", "Próximo pago", "Último pago", "Estado", "Acciones"]);
        rows.forEach(function (r) {
          var st = r.status === "frozen" ? '<span class="badge bad">congelada</span>'
            : r.is_overdue ? '<span class="badge warn">en mora</span>'
            : r.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
            : '<span class="badge ok">al día</span>';
          var tr = h("<tr><td>" + esc(r.student_name) + '</td><td class="wrap">' + esc(r.description || "—") +
            "</td><td>" + money(r.monthly_amount, r.currency) + "</td><td>" + date(r.next_due_date) + "</td><td>" +
            (r.last_payment_at ? date(r.last_payment_at) + " · " + money(r.last_payment_amount, r.currency) : "—") +
            '</td><td>' + st + '</td><td class="acts"></td></tr>');
          var cell = tr.children[6];
          cell.appendChild(btn("Registrar pago", "btn-blue", function () { registrarPago(r); }));
          cell.appendChild(btn("Editar", "btn-ghost", function () { editarSuscripcion(r, students); }));
          t.body.appendChild(tr);
        });
        if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Sin suscripciones. Crea una con “Nueva suscripción”.</td></tr>'));
        main.appendChild(t.wrap);
      }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  function editarSuscripcion(r, students) {
    var body = h("<div>" +
      (r ? "" : field("Estudiante", '<select name="sid">' + students.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.full_name) + "</option>";
      }).join("") + "</select>")) +
      field("Descripción", '<input name="desc" value="' + esc(r ? (r.description || "") : "") + '" placeholder="Curso A1.1 — Hello, World">') +
      field("Mensualidad (COP)", '<input name="amt" type="number" min="0" value="' + (r ? r.monthly_amount : "") + '">') +
      field("Día de cobro (1–28)", '<input name="day" type="number" min="1" max="28" value="' + (r ? "" : 1) + '" placeholder="1">') +
      field("Días de gracia", '<input name="grace" type="number" min="0" max="60" value="5">') +
      (r ? field("Estado", '<select name="status"><option value="active">Activa</option><option value="frozen">Congelada</option><option value="cancelled">Cancelada</option></select>') : "") +
      "</div>");
    if (r && body.querySelector("[name=status]")) body.querySelector("[name=status]").value = r.status;
    modal(r ? "Editar suscripción" : "Nueva suscripción", body, function () {
      var payload = {
        description: body.querySelector("[name=desc]").value.trim() || null,
        monthly_amount: +body.querySelector("[name=amt]").value || 0,
        grace_days: +body.querySelector("[name=grace]").value || 5
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
      field("Referencia (opcional)", '<input name="ref">') +
      field("Nota (opcional)", '<input name="note">') + "</div>");
    modal("Registrar pago — " + r.student_name, body, function () {
      return rpc("record_payment", {
        p_subscription_id: r.subscription_id,
        p_amount: +body.querySelector("[name=amt]").value || 0,
        p_method: body.querySelector("[name=m]").value,
        p_period_month: body.querySelector("[name=pm]").value + "-01",
        p_reference: body.querySelector("[name=ref]").value.trim() || null,
        p_notes: body.querySelector("[name=note]").value.trim() || null
      }).then(function () { toast("Pago registrado."); route(); });
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
    q("modules").select("*").order("module_number").then(function (r) {
      var t = tableWrap(["#", "Nivel", "Título", "Descripción", "Estado", "Acciones"]);
      (r.data || []).forEach(function (m) {
        var tr = h("<tr><td>" + m.module_number + "</td><td>" + esc(m.level) + "</td><td>" + esc(m.title) +
          '</td><td class="wrap">' + esc(m.description) + "</td><td>" +
          (m.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[5];
        cell.appendChild(btn(m.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("modules").update({ active: !m.active }).eq("id", m.id).then(function (u) {
            if (u.error) toast(friendly(u.error), "err"); else { toast("Módulo " + (m.active ? "desactivado" : "activado") + "."); acModulos(box); }
          });
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
    // 24 pares de meses consecutivos a partir del mes actual
    var out = [];
    var now = new Date();
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
      var parts = sel.value.split("|");
      var a = parts[0].split("-"), z = parts[1].split("-");
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
        var label = b.querySelector("[name=p]").selectedOptions[0].textContent;
        return q("cycles").insert({
          name: label, start_date: b.querySelector("[name=s]").value,
          end_date: b.querySelector("[name=e]").value, status: "Open"
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
            var label = b.querySelector("[name=p]").selectedOptions[0].textContent;
            return q("cycles").update({
              name: label, start_date: b.querySelector("[name=s]").value,
              end_date: b.querySelector("[name=e]").value, status: b.querySelector("[name=st]").value
            }).eq("id", c.id).then(function (u) { if (u.error) throw u.error; toast("Ciclo actualizado."); acCiclos(box); });
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
      q("schedules").select("*,cycles(name,status),modules(level,title)").order("created_at", { ascending: false }),
      q("cycles").select("id,name,status"), q("modules").select("id,level,title").order("module_number")
    ]).then(function (res) {
      box.innerHTML = "";
      var cycles = res[1].data || [], modules = res[2].data || [];
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Horario</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
        var b = h("<div>" +
          field("Ciclo", '<select name="c">' + cycles.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + (c.status !== "Open" ? " (cerrado)" : "") + "</option>"; }).join("") + "</select>") +
          field("Módulo", '<select name="m">' + modules.map(function (m) { return '<option value="' + m.id + '">' + esc(m.level + " · " + m.title) + "</option>"; }).join("") + "</select>") +
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
        var tr = h("<tr><td>" + esc(s.cycles ? s.cycles.name : "—") + "</td><td>" + esc(s.modules ? s.modules.level + " · " + s.modules.title : "—") +
          "</td><td>" + esc(days(s.days)) + "</td><td>" + esc(time(s.start_time) + "–" + time(s.end_time)) +
          "</td><td>" + (s.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[5];
        cell.appendChild(btn(s.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("schedules").update({ active: !s.active }).eq("id", s.id).then(function () { acHorarios(box); });
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
      q("schedules").select("id,days,start_time,end_time,module_id,modules(level,title)").eq("active", true),
      q("teachers").select("id,full_name").eq("active", true)
    ]).then(function (res) {
      box.innerHTML = "";
      var scheds = res[1].data || [], teachers = res[2].data || [];
      var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Grupo</button></div>');
      box.appendChild(add);
      add.querySelector("button").onclick = function () {
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
      var t = tableWrap(["Módulo", "Ciclo", "Horario", "Profesor", "Cupo", "Estado", "Acciones"]);
      (res[0].data || []).forEach(function (g) {
        var sc = g.schedules;
        var tr = h("<tr><td>" + esc(g.modules ? g.modules.level + " · " + g.modules.title : "—") + "</td><td>" + esc(sc && sc.cycles ? sc.cycles.name : "—") +
          "</td><td>" + esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "—") + "</td><td>" + esc(g.teachers ? g.teachers.full_name : "—") +
          "</td><td>" + g.capacity + "</td><td>" + (g.active ? '<span class="badge ok">activo</span>' : '<span class="badge neutral">inactivo</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[6];
        cell.appendChild(btn(g.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          q("groups").update({ active: !g.active }).eq("id", g.id).then(function () { acGrupos(box); });
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
          confirmDelete("Eliminar grupo", "No se puede si tiene inscripciones. Cancélalas o muévelas primero.", function () {
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
    head(main, "Usuarios", "Cuentas de acceso. Solo el administrador puede crear cuentas, cambiar roles y eliminar.");
    var bar = h('<div class="pnl-toolbar">' +
      '<button class="btn btn-sm btn-dark" data-new>+ Cuenta de staff</button>' +
      '<span class="muted" style="font-size:13px">Las cuentas de estudiante se crean desde “Estudiantes”.</span></div>');
    main.appendChild(bar);
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
          }).then(function () { toast("Cuenta creada."); route(); });
        }, "Crear");
      });
    };
    q("profiles").select("*").order("created_at").then(function (r) {
      if (r.error) throw r.error;
      var t = tableWrap(["Nombre", "Correo", "Rol", "Estado", "Acciones"]);
      (r.data || []).forEach(function (p) {
        var tr = h("<tr><td>" + esc(p.full_name || "—") + "</td><td>" + esc(p.email) + "</td><td>" +
          esc(ROLE_ES[p.role] || p.role) + "</td><td>" +
          (p.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>') +
          '</td><td class="acts"></td></tr>');
        var cell = tr.children[4];
        if (p.user_id === ME.user_id) { cell.innerHTML = '<span class="muted">tú</span>'; t.body.appendChild(tr); return; }
        cell.appendChild(btn(p.active ? "Desactivar" : "Activar", "btn-ghost", function () {
          callFn({ action: "set_active", user_id: p.user_id, active: !p.active })
            .then(function () { toast("Actualizado."); route(); }).catch(function (e) { toast(friendly(e), "err"); });
        }));
        if (p.role !== "student") {
          var rl = h('<select style="width:auto"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>');
          rl.value = p.role;
          rl.onchange = function () {
            callFn({ action: "set_role", user_id: p.user_id, role: rl.value })
              .then(function () { toast("Rol actualizado."); }).catch(function (e) { toast(friendly(e), "err"); });
          };
          cell.appendChild(rl);
        }
        cell.appendChild(btn("Eliminar", "btn-danger", function () {
          confirmDelete("Eliminar cuenta", "Se elimina el acceso de " + (p.full_name || p.email) + ". El registro de estudiante/profesor asociado NO se borra.", function () {
            return callFn({ action: "delete_account", user_id: p.user_id }).then(function () { toast("Cuenta eliminada."); route(); });
          });
        }));
        t.body.appendChild(tr);
      });
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(friendly(e)) + "</div>")); });
  }

  boot();
})();
