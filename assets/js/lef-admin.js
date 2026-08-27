/* LEF — Panel administrativo (SPA en JS plano).
   Auth con Supabase. Roles: admin (todo) · teacher (solo lectura de sus grupos).
   Secciones: Inscripciones · Estudiantes · Pagos · Académico · Usuarios */
(function () {
  "use strict";

  var sb = window.lefClient({ session: true });
  var app = document.getElementById("app");
  var ME = null;            // { user_id, role, full_name, email }
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

  function toast(msg, kind) {
    var t = h('<div class="pnl-alert ' + (kind || "ok") + '" style="position:fixed;right:20px;bottom:20px;z-index:80;max-width:340px;box-shadow:0 8px 24px rgba(0,0,0,.15)">' + esc(msg) + "</div>");
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  function modal(title, bodyNode, onSave, saveLabel) {
    var bg = h('<div class="pnl-modal-bg"></div>');
    var box = h('<div class="pnl-modal"><h3>' + esc(title) + '</h3></div>');
    box.appendChild(bodyNode);
    var err = h('<div class="pnl-alert err" style="display:none"></div>');
    box.appendChild(err);
    var row = h('<div class="row"><button class="btn btn-ghost" data-x>Cancelar</button><button class="btn btn-dark" data-s>' + esc(saveLabel || "Guardar") + "</button></div>");
    box.appendChild(row);
    bg.appendChild(box);
    document.body.appendChild(bg);
    function close() { bg.remove(); }
    bg.addEventListener("click", function (e) { if (e.target === bg) close(); });
    row.querySelector("[data-x]").onclick = close;
    row.querySelector("[data-s]").onclick = function () {
      var btn = row.querySelector("[data-s]"); btn.disabled = true;
      Promise.resolve().then(onSave).then(function () { close(); }).catch(function (e) {
        err.textContent = (e && e.message) || String(e); err.style.display = "block"; btn.disabled = false;
      });
    };
    return { close: close };
  }
  function field(label, inputHtml) {
    return '<label class="fld"><span>' + esc(label) + "</span>" + inputHtml + "</label>";
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
      if (!s) return renderLogin();
      TOKEN = s.access_token;
      return q("profiles").select("*").eq("user_id", s.user.id).maybeSingle().then(function (p) {
        if (p.error || !p.data || !p.data.active || !["admin", "teacher"].includes(p.data.role)) {
          return sb.auth.signOut().then(function () {
            renderLogin("Esta cuenta no tiene acceso al panel.");
          });
        }
        ME = p.data;
        renderShell();
      });
    });
  }

  function renderLogin(msg) {
    app.innerHTML = "";
    var card = h(
      '<div class="pnl-center"><form class="pnl-login">' +
      '<div class="brand">LEF <span>·</span> Panel</div>' +
      '<p class="hint">Ingresa con tu cuenta de staff.</p>' +
      (msg ? '<div class="pnl-alert err">' + esc(msg) + "</div>" : "") +
      '<div class="pnl-alert err" data-err style="display:none"></div>' +
      field("Correo", '<input type="email" name="email" autocomplete="username" required>') +
      field("Contraseña", '<input type="password" name="password" autocomplete="current-password" required>') +
      '<button class="btn btn-dark" style="width:100%;justify-content:center" type="submit">Ingresar</button>' +
      "</form></div>"
    );
    var form = card.querySelector("form");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var err = form.querySelector("[data-err]"); err.style.display = "none";
      var btn = form.querySelector("button"); btn.disabled = true;
      sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value })
        .then(function (r) {
          if (r.error) throw r.error;
          boot();
        }).catch(function (er) {
          err.textContent = er.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : er.message;
          err.style.display = "block"; btn.disabled = false;
        });
    });
    app.appendChild(card);
  }

  /* ============ shell ============ */
  var SECTIONS = [
    { id: "inscripciones", label: "Inscripciones", roles: ["admin", "teacher"] },
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
      '<div class="brand">LEF <span>·</span> Panel</div>' +
      '<div class="who">' + esc(ME.full_name || ME.email) + ' · ' + esc(ME.role) +
      ' <button class="link" data-logout>Salir</button></div>' +
      "</div>"
    ));
    var wrap = h('<div class="pnl-wrap"><nav class="pnl-nav"></nav><main class="pnl-main"></main></div>');
    var nav = wrap.querySelector(".pnl-nav");
    allowed.forEach(function (s) {
      nav.appendChild(h('<a href="#' + s.id + '">' + esc(s.label) + "</a>"));
    });
    app.appendChild(wrap);
    app.querySelector("[data-logout]").onclick = function () { sb.auth.signOut().then(boot); };

    window.onhashchange = route;
    if (!location.hash || !allowed.some(function (s) { return "#" + s.id === location.hash; })) {
      location.hash = allowed[0].id;
    } else route();
  }

  function route() {
    var id = location.hash.slice(1);
    document.querySelectorAll(".pnl-nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("href") === "#" + id);
    });
    var main = document.querySelector(".pnl-main");
    main.innerHTML = '<p class="muted">Cargando…</p>';
    var fn = ({
      inscripciones: secInscripciones, estudiantes: secEstudiantes,
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
      '</tr></thead><tbody></tbody></table></div>');
    return { wrap: w, body: w.querySelector("tbody") };
  }

  /* ============ INSCRIPCIONES ============ */
  var ENROLL_STATUS = ["Pending", "Contacted", "Confirmed", "Paid", "Cancelled"];
  var ENROLL_ES = { Pending: "Nueva", Contacted: "Contactada", Confirmed: "Confirmada", Paid: "Pagada", Cancelled: "Cancelada" };
  function secInscripciones(main) {
    head(main, "Inscripciones", ME.role === "teacher" ? "Inscripciones de tus grupos." : "Todas las inscripciones del sistema.");
    q("enrollments").select("id,registration_number,status,created_at,students(full_name,whatsapp,email),modules(level,title),groups(schedules(days,start_time,end_time),teachers(full_name))")
      .order("created_at", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        var t = tableWrap(["Matrícula", "Estudiante", "Contacto", "Nivel", "Horario", "Profesor", "Estado", "Fecha"]);
        (r.data || []).forEach(function (e) {
          var sc = e.groups && e.groups.schedules;
          var tr = h("<tr>" +
            "<td>" + esc(e.registration_number) + "</td>" +
            "<td>" + esc(e.students ? e.students.full_name : "—") + "</td>" +
            '<td class="wrap">' + esc(e.students ? e.students.whatsapp : "") + "<br><span class='muted'>" + esc(e.students ? e.students.email : "") + "</span></td>" +
            "<td>" + esc(e.modules ? e.modules.level + " · " + e.modules.title : "—") + "</td>" +
            "<td>" + (sc ? esc(days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time)) : "—") + "</td>" +
            "<td>" + esc(e.groups && e.groups.teachers ? e.groups.teachers.full_name : "—") + "</td>" +
            "<td></td>" +
            "<td>" + date(e.created_at) + "</td>" +
            "</tr>");
          var cell = tr.children[6];
          if (ME.role === "admin") {
            var sel = h('<select style="width:auto">' + ENROLL_STATUS.map(function (s) {
              return '<option value="' + s + '"' + (s === e.status ? " selected" : "") + ">" + ENROLL_ES[s] + "</option>";
            }).join("") + "</select>");
            sel.onchange = function () {
              q("enrollments").update({ status: sel.value }).eq("id", e.id).then(function (u) {
                if (u.error) { toast(u.error.message, "err"); } else toast("Estado actualizado.");
              });
            };
            cell.appendChild(sel);
          } else {
            cell.innerHTML = '<span class="badge neutral">' + ENROLL_ES[e.status] + "</span>";
          }
          t.body.appendChild(tr);
        });
        if (!r.data.length) t.body.appendChild(h('<tr><td colspan="8" class="muted">Sin inscripciones todavía.</td></tr>'));
        main.appendChild(t.wrap);
      }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(e.message) + "</div>")); });
  }

  /* ============ ESTUDIANTES ============ */
  function secEstudiantes(main) {
    head(main, "Estudiantes", "Personas inscritas. Aquí el admin crea la cuenta de acceso al portal de facturación.");
    Promise.all([
      q("students").select("*").order("created_at", { ascending: false }),
      ME.role === "admin" ? q("profiles").select("user_id,student_id,email,active").eq("role", "student") : Promise.resolve({ data: [] })
    ]).then(function (res) {
      if (res[0].error) throw res[0].error;
      var profByStudent = {};
      (res[1].data || []).forEach(function (p) { if (p.student_id) profByStudent[p.student_id] = p; });
      var t = tableWrap(["Nombre", "WhatsApp", "Correo", "Ciudad", "Cuenta portal", ""]);
      (res[0].data || []).forEach(function (s) {
        var prof = profByStudent[s.id];
        var tr = h("<tr>" +
          "<td>" + esc(s.full_name) + "</td>" +
          "<td>" + esc(s.whatsapp) + "</td>" +
          '<td class="wrap">' + esc(s.email) + "</td>" +
          "<td>" + esc(s.city || "—") + "</td>" +
          "<td>" + (prof ? '<span class="badge ok">activa</span>' : '<span class="badge neutral">sin cuenta</span>') + "</td>" +
          "<td></td></tr>");
        if (ME.role === "admin" && !prof) {
          var b = h('<button class="btn btn-sm btn-ghost">Crear cuenta</button>');
          b.onclick = function () { crearCuentaEstudiante(s); };
          tr.children[5].appendChild(b);
        }
        t.body.appendChild(tr);
      });
      if (!res[0].data.length) t.body.appendChild(h('<tr><td colspan="6" class="muted">Sin estudiantes.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(e.message) + "</div>")); });
  }

  function crearCuentaEstudiante(s) {
    var pwd = "lef" + Math.random().toString(36).slice(2, 10);
    var body = h("<div>" +
      field("Nombre", '<input name="fn" value="' + esc(s.full_name) + '">') +
      field("Correo (usuario)", '<input name="em" type="email" value="' + esc(s.email) + '">') +
      field("Contraseña temporal", '<input name="pw" value="' + pwd + '">') +
      '<p class="pnl-sub">Comparte estos datos con el estudiante. Podrá cambiar la contraseña luego.</p>' +
      "</div>");
    modal("Crear cuenta de portal", body, function () {
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
      '<span class="muted" style="font-size:13px">La congelación automática se agenda en la Fase 2.</span>' +
      "</div>");
    main.appendChild(bar);
    bar.querySelector("[data-freeze]").onclick = function () {
      rpc("freeze_overdue_subscriptions").then(function (n) { toast(n + " cuenta(s) congelada(s)."); route(); })
        .catch(function (e) { toast(e.message, "err"); });
    };
    Promise.all([
      rpc("admin_billing_overview"),
      q("students").select("id,full_name").order("full_name")
    ]).then(function (res) {
      var rows = res[0] || [];
      var students = res[1].data || [];
      var newBtn = h('<button class="btn btn-dark btn-sm" data-new>+ Nueva suscripción</button>');
      bar.appendChild(newBtn);
      newBtn.onclick = function () { editarSuscripcion(null, students); };

      var t = tableWrap(["Estudiante", "Descripción", "Mensualidad", "Próximo pago", "Último pago", "Estado", ""]);
      rows.forEach(function (r) {
        var st = r.status === "frozen" ? '<span class="badge bad">congelada</span>'
          : r.is_overdue ? '<span class="badge warn">en mora</span>'
          : r.status === "cancelled" ? '<span class="badge neutral">cancelada</span>'
          : '<span class="badge ok">al día</span>';
        var tr = h("<tr>" +
          "<td>" + esc(r.student_name) + "</td>" +
          '<td class="wrap">' + esc(r.description || "—") + "</td>" +
          "<td>" + money(r.monthly_amount, r.currency) + "</td>" +
          "<td>" + date(r.next_due_date) + "</td>" +
          "<td>" + (r.last_payment_at ? date(r.last_payment_at) + " · " + money(r.last_payment_amount, r.currency) : "—") + "</td>" +
          "<td>" + st + "</td><td></td></tr>");
        var actions = tr.children[6];
        var pay = h('<button class="btn btn-sm btn-blue">Registrar pago</button>');
        pay.onclick = function () { registrarPago(r); };
        var edit = h('<button class="btn btn-sm btn-ghost" style="margin-left:6px">Editar</button>');
        edit.onclick = function () { editarSuscripcion(r, students); };
        actions.appendChild(pay); actions.appendChild(edit);
        t.body.appendChild(tr);
      });
      if (!rows.length) t.body.appendChild(h('<tr><td colspan="7" class="muted">Sin suscripciones. Crea una con “Nueva suscripción”.</td></tr>'));
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(e.message) + "</div>")); });
  }

  function editarSuscripcion(r, students) {
    var body = h("<div>" +
      (r ? "" : field("Estudiante", '<select name="sid">' + students.map(function (s) {
        return '<option value="' + s.id + '">' + esc(s.full_name) + "</option>";
      }).join("") + "</select>")) +
      field("Descripción", '<input name="desc" value="' + esc(r ? (r.description || "") : "") + '" placeholder="Curso A1.1 — Primeros pasos">') +
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
        payload.next_due_date = d.getFullYear() + "-" +
          String(d.getMonth() + 1).padStart(2, "0") + "-" +
          String(payload.billing_day).padStart(2, "0");
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
      field("Nota (opcional)", '<input name="note">') +
      "</div>");
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
      var t = tableWrap(["#", "Nivel", "Título", "Descripción", "Activo", ""]);
      (r.data || []).forEach(function (m) {
        var tr = h("<tr><td>" + m.module_number + "</td><td>" + esc(m.level) + "</td><td>" + esc(m.title) +
          '</td><td class="wrap">' + esc(m.description) + "</td><td>" +
          (m.active ? '<span class="badge ok">sí</span>' : '<span class="badge neutral">no</span>') + "</td><td></td></tr>");
        var e = h('<button class="btn btn-sm btn-ghost">Editar</button>');
        e.onclick = function () {
          var b = h("<div>" + field("Título", '<input name="t" value="' + esc(m.title) + '">') +
            field("Descripción", '<textarea name="d" rows="3">' + esc(m.description) + "</textarea>") +
            field("Activo", '<select name="a"><option value="true">Sí</option><option value="false">No</option></select>') + "</div>");
          b.querySelector("[name=a]").value = String(m.active);
          modal("Editar módulo " + m.level, b, function () {
            return q("modules").update({
              title: b.querySelector("[name=t]").value.trim(),
              description: b.querySelector("[name=d]").value.trim(),
              active: b.querySelector("[name=a]").value === "true"
            }).eq("id", m.id).then(function (u) { if (u.error) throw u.error; toast("Guardado."); acModulos(box); });
          });
        };
        tr.children[5].appendChild(e);
        t.body.appendChild(tr);
      });
      box.innerHTML = ""; box.appendChild(t.wrap);
    });
  }

  function acProfesores(box) {
    box.innerHTML = "";
    var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Profesor</button></div>');
    box.appendChild(add);
    add.querySelector("button").onclick = function () {
      var b = h("<div>" + field("Nombre", '<input name="n">') + field("Correo", '<input name="e" type="email">') +
        field("WhatsApp", '<input name="w">') + "</div>");
      modal("Nuevo profesor", b, function () {
        return q("teachers").insert({
          full_name: b.querySelector("[name=n]").value.trim(),
          email: b.querySelector("[name=e]").value.trim(),
          whatsapp: b.querySelector("[name=w]").value.trim() || null
        }).then(function (i) { if (i.error) throw i.error; toast("Profesor agregado."); acProfesores(box); });
      });
    };
    q("teachers").select("*").order("full_name").then(function (r) {
      var t = tableWrap(["Nombre", "Correo", "WhatsApp", "Activo", ""]);
      (r.data || []).forEach(function (p) {
        var tr = h("<tr><td>" + esc(p.full_name) + "</td><td>" + esc(p.email) + "</td><td>" + esc(p.whatsapp || "—") +
          "</td><td>" + (p.active ? "sí" : "no") + "</td><td></td></tr>");
        var tg = h('<button class="btn btn-sm btn-ghost">' + (p.active ? "Desactivar" : "Activar") + "</button>");
        tg.onclick = function () {
          q("teachers").update({ active: !p.active }).eq("id", p.id).then(function () { acProfesores(box); });
        };
        tr.children[4].appendChild(tg);
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  function acCiclos(box) {
    box.innerHTML = "";
    var add = h('<div class="pnl-toolbar"><button class="btn btn-sm btn-dark">+ Ciclo</button></div>');
    box.appendChild(add);
    add.querySelector("button").onclick = function () {
      var b = h("<div>" + field("Nombre", '<input name="n" placeholder="Nov - Dic 2026">') +
        field("Inicio", '<input name="s" type="date">') + field("Fin", '<input name="e" type="date">') + "</div>");
      modal("Nuevo ciclo", b, function () {
        return q("cycles").insert({
          name: b.querySelector("[name=n]").value.trim(),
          start_date: b.querySelector("[name=s]").value,
          end_date: b.querySelector("[name=e]").value,
          status: "Open"
        }).then(function (i) { if (i.error) throw i.error; toast("Ciclo creado."); acCiclos(box); });
      });
    };
    q("cycles").select("*").order("start_date", { ascending: false }).then(function (r) {
      var t = tableWrap(["Nombre", "Inicio", "Fin", "Estado", ""]);
      (r.data || []).forEach(function (c) {
        var tr = h("<tr><td>" + esc(c.name) + "</td><td>" + date(c.start_date) + "</td><td>" + date(c.end_date) +
          '</td><td>' + (c.status === "Open" ? '<span class="badge ok">abierto</span>' : '<span class="badge neutral">cerrado</span>') + "</td><td></td></tr>");
        var tg = h('<button class="btn btn-sm btn-ghost">' + (c.status === "Open" ? "Cerrar" : "Abrir") + "</button>");
        tg.onclick = function () {
          q("cycles").update({ status: c.status === "Open" ? "Closed" : "Open" }).eq("id", c.id).then(function () { acCiclos(box); });
        };
        tr.children[4].appendChild(tg);
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
          var dsel = Array.prototype.slice.call(b.querySelectorAll('input[type=checkbox]:checked')).map(function (x) { return x.value; });
          if (!dsel.length) throw new Error("Elige al menos un día.");
          return q("schedules").insert({
            cycle_id: b.querySelector("[name=c]").value, module_id: b.querySelector("[name=m]").value,
            days: dsel, start_time: b.querySelector("[name=s]").value, end_time: b.querySelector("[name=e]").value
          }).then(function (i) { if (i.error) throw i.error; toast("Horario creado."); acHorarios(box); });
        });
      };
      var t = tableWrap(["Ciclo", "Módulo", "Días", "Horario", "Activo", ""]);
      (res[0].data || []).forEach(function (s) {
        var tr = h("<tr><td>" + esc(s.cycles ? s.cycles.name : "—") + "</td><td>" + esc(s.modules ? s.modules.level + " · " + s.modules.title : "—") +
          "</td><td>" + esc(days(s.days)) + "</td><td>" + esc(time(s.start_time) + "–" + time(s.end_time)) + "</td><td>" + (s.active ? "sí" : "no") + "</td><td></td></tr>");
        var tg = h('<button class="btn btn-sm btn-ghost">' + (s.active ? "Desactivar" : "Activar") + "</button>");
        tg.onclick = function () { q("schedules").update({ active: !s.active }).eq("id", s.id).then(function () { acHorarios(box); }); };
        tr.children[5].appendChild(tg);
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
      var t = tableWrap(["Módulo", "Ciclo", "Horario", "Profesor", "Cupo", "Activo", ""]);
      (res[0].data || []).forEach(function (g) {
        var sc = g.schedules;
        var tr = h("<tr><td>" + esc(g.modules ? g.modules.level + " · " + g.modules.title : "—") + "</td><td>" + esc(sc && sc.cycles ? sc.cycles.name : "—") +
          "</td><td>" + esc(sc ? days(sc.days) + " " + time(sc.start_time) + "–" + time(sc.end_time) : "—") + "</td><td>" + esc(g.teachers ? g.teachers.full_name : "—") +
          "</td><td>" + g.capacity + "</td><td>" + (g.active ? "sí" : "no") + "</td><td></td></tr>");
        var tg = h('<button class="btn btn-sm btn-ghost">' + (g.active ? "Desactivar" : "Activar") + "</button>");
        tg.onclick = function () { q("groups").update({ active: !g.active }).eq("id", g.id).then(function () { acGrupos(box); }); };
        tr.children[6].appendChild(tg);
        t.body.appendChild(tr);
      });
      box.appendChild(t.wrap);
    });
  }

  /* ============ USUARIOS ============ */
  var ROLE_ES = { admin: "Administrador", teacher: "Profesor", student: "Estudiante" };
  function secUsuarios(main) {
    head(main, "Usuarios", "Cuentas de acceso. Solo el administrador puede crear cuentas y cambiar roles.");
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
      var t = tableWrap(["Nombre", "Correo", "Rol", "Estado", ""]);
      (r.data || []).forEach(function (p) {
        var tr = h("<tr><td>" + esc(p.full_name || "—") + "</td><td>" + esc(p.email) + "</td><td>" +
          esc(ROLE_ES[p.role] || p.role) + "</td><td>" +
          (p.active ? '<span class="badge ok">activa</span>' : '<span class="badge bad">inactiva</span>') + "</td><td></td></tr>");
        var cell = tr.children[4];
        if (p.user_id !== ME.user_id) {
          var tg = h('<button class="btn btn-sm btn-ghost">' + (p.active ? "Desactivar" : "Activar") + "</button>");
          tg.onclick = function () {
            callFn({ action: "set_active", user_id: p.user_id, active: !p.active })
              .then(function () { toast("Actualizado."); route(); }).catch(function (e) { toast(e.message, "err"); });
          };
          cell.appendChild(tg);
          if (p.role !== "student") {
            var rl = h('<select style="width:auto;margin-left:6px"><option value="teacher">Profesor</option><option value="admin">Administrador</option></select>');
            rl.value = p.role;
            rl.onchange = function () {
              callFn({ action: "set_role", user_id: p.user_id, role: rl.value })
                .then(function () { toast("Rol actualizado."); }).catch(function (e) { toast(e.message, "err"); });
            };
            cell.appendChild(rl);
          }
        } else cell.innerHTML = '<span class="muted">tú</span>';
        t.body.appendChild(tr);
      });
      main.appendChild(t.wrap);
    }).catch(function (e) { main.appendChild(h('<div class="pnl-alert err">' + esc(e.message) + "</div>")); });
  }

  boot();
})();
