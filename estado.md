# Estado del proyecto — Landing LEF

Última actualización: 27 de agosto de 2026 (sesión: migración Vercel+Supabase, Fase 1 completa, base Fase 2)

## 🔗 Enlaces

- **Sitio en vivo:** https://www.lefcenter.com  (y https://lef-center.vercel.app)
- **Sitio viejo (GitHub Pages, se deja caer):** https://titorpg.github.io/lef-landing/
- **Repositorio (temporal, cuenta personal):** https://github.com/Titorpg/lef-landing
- **Carpeta local:** `C:\Users\Temporal\Desktop\LEF`
- **Backend (Supabase):** proyecto `lef-center-prod`, org LEFCENTER — https://cemrxcatbxbcipxmsnjf.supabase.co
- **Inicio de sesión único:** https://www.lefcenter.com/login  (enruta a admin o portal según el rol; enlace "Iniciar sesión" en el header de todo el sitio)
- **Panel admin:** https://www.lefcenter.com/admin  (cuenta `director@lefcenter.com`, contraseña temporal en `.env` → `ADMIN_TEMP_PASSWORD`, cambiar)
- **Portal estudiante:** https://www.lefcenter.com/portal

El sitio ahora corre en **Vercel** (Team `lefcenter` del cliente). No depende del computador.

## ⚙️ Infraestructura (migración a Vercel + Supabase — en curso)

| Pieza | Dónde | Cuenta | Estado |
|---|---|---|---|
| Frontend estático | Vercel, proyecto `lef-center` | Team `lefcenter` (cliente) | ✅ desplegado en vivo |
| Backend (BD/Auth/Functions) | Supabase, proyecto `lef-center-prod` (región us-east-1) | Org LEFCENTER (cliente) | ✅ sistema de inscripción + facturación (base) |
| Código fuente | GitHub `Titorpg/lef-landing` | **Personal (temporal)** | ⏳ transferir al cliente en la entrega |
| Dominio `lefcenter.com` | DNS de terceros → Vercel | Cliente | ✅ movido a `lef-center` (apex→www, sin tocar DNS) |

**Despliegue:** no hay auto-deploy (sin conexión Git). Para publicar cambios:
`npx vercel deploy --prod --yes --token <VERCEL_TOKEN> --scope lefcenter` desde la carpeta.
El token y las credenciales de Supabase están en `.env` local (NO se sube — ver `.gitignore`).

**Proyectos viejos** (los borra el cliente cuando quiera):
- Vercel: `lef-center-app` — se le quitó el dominio `lefcenter.com` (ahora en `lef-center`).
  Sigue vivo en `lef-center-app.vercel.app` como referencia del diseño anterior.
- Supabase: `director@lefcenter.com's Project` (cuenta free permite 2 proyectos; ahora van 2/2)

### FASE 1 — Sistema de inscripción — HECHA ✅
Portado del proyecto viejo del cliente (`lef-center-app`) y reconstruido en JS plano.

**Migraciones aplicadas** (`supabase/migrations/`):
| Archivo | Qué hace |
|---|---|
| `20260827120000_sistema_inscripcion.sql` | 9 tablas + funciones + RLS + seed 12 módulos; elimina `inscripciones` de la etapa A |
| `20260827190000_module_titles_en.sql` | Títulos de módulos en inglés (Hello World, Everyday Life…), descripción en español |
| `20260827210000_modulo_por_estudiante.sql` | `enrollments.group_id`/`cycle_id` opcionales; `subscriptions.module_id`; `admin_assign_module`, `module_enrollment_counts` |
| `20260827220000_billing_overview_modulo.sql` | `admin_billing_overview` devuelve el módulo de la suscripción |
| `20260827230000_cascadas_admin.sql` | Grupo borrable si no tiene inscripciones activas; desactivar módulo apaga sus horarios/grupos en cascada; `group_enrollment_counts` |
| `20260827240000_pagos_libro_contable.sql` | Documento del estudiante **obligatorio**; se puede **eliminar** un estudiante (`admin_delete_student`) conservando el historial de pagos desligado; datos del **pagador** en la suscripción + congelados en cada pago; pagos **inmutables** (trigger) con consecutivo `REC-AAAA-NNNNN`; corrección vía `admin_reverse_payment` |

**Tablas:** `modules`, `cycles`, `teachers`, `schedules`, `groups`, `students`,
`enrollments`, `registration_counters`, `profiles`, `subscriptions`, `payments`.

**Funciones SECURITY DEFINER:** `get_public_modules`, `get_schedule_availability`,
`create_enrollment` (transaccional: valida cupo, dup-check correo/WhatsApp, asigna grupo,
matrícula `LEF-AAAA-NNNNN`), `get_enrollment_confirmation`, `admin_assign_module`
(crea/actualiza la inscripción "solo módulo" de un estudiante), `module_enrollment_counts`,
`record_payment`, `freeze_overdue_subscriptions`, `get_my_billing`, `admin_billing_overview`,
`is_admin`/`is_teacher`/`is_staff`/`current_student_id`. RLS en todas las tablas.

- **Asistente de 4 pasos** (`inscripcion.html` + `assets/js/lef-enroll.js` + CSS en `style.css`):
  1 Tus datos · 2 Elige nivel (12 módulos, título en inglés) · 3 Elige horario (cupos reales) · 4 Revisar.
  Al confirmar: pantalla con nº de matrícula **+ botón WhatsApp** (opción b).
- **Panel admin** (`admin.html` + `assets/js/lef-admin.js` + `assets/css/lef-panel.css`):
  login vía `/login`. Barra superior = solo logo LEF (lleva al Dashboard). Secciones:
  - **Dashboard**: KPIs (estudiantes, **profesores**, inscripciones activas/nuevas,
    al día/mora/congeladas — todos en una fila en escritorio); donut SVG con **1 color fijo
    por módulo** y leyenda en grilla con % de cada uno; sección **"Estado de los módulos"**
    con aviso ⚠️ si hay alguno desactivado; tabla de inscripciones (cambiar estado);
    pagos recientes.
  - **Estudiantes**: al crear/editar se **elige el módulo** (crea/actualiza la inscripción
    vía `admin_assign_module`); columna Módulo; crear cuenta de portal, restablecer
    contraseña, activar/desactivar acceso, editar, eliminar, + Estudiante.
  - **Pagos**: suscripción atada a **Módulo** (lista desplegable, no texto libre);
    registrar pago manual, editar, eliminar, congelar vencidas.
  - **Académico**: Módulos (activar/desactivar, editar título/desc, columna **Inscritos**),
    Ciclos (**Periodo** = selector de pares de meses que fija los calendarios inicio/fin;
    abrir/cerrar, editar, eliminar), Profesores (editar/eliminar), Horarios
    (activar/desactivar, eliminar), Grupos (editar profesor/cupo, activar/desactivar, eliminar).
    Un módulo desactivado deja de aparecer para asignar en todas las pestañas.
  - **Usuarios**: lista admin + estudiantes + **profesores** (con o sin cuenta); columna
    Creado; filtros por rol / activo-inactivo / orden por fecha; crear staff, cambiar rol,
    activar/desactivar, eliminar.
- **Portal del estudiante** (`portal.html` + `assets/js/lef-portal.js`): pestaña Facturación.
- **Roles** (`profiles.role`): `admin` (todo) · `teacher` (lectura de sus grupos) ·
  `student` (solo el portal). Cuenta admin única sembrada; crea las demás desde el panel.
- **Login único** (`login.html` + `assets/js/lef-auth.js`): un solo formulario para todos;
  enruta a `/admin` o `/portal` según el rol. Enlace "Iniciar sesión" en el header de todo
  el sitio (texto en escritorio, ícono donde estaba el de WhatsApp en móvil — el ícono de
  WhatsApp del header se quitó).
- **Edge Function** `manage-users` (solo admin): `create_account`, `set_role`, `set_active`,
  `reset_password`, `delete_account`, `update_email`. Deploy: `npx supabase functions deploy
  manage-users --project-ref cemrxcatbxbcipxmsnjf` (con `SUPABASE_ACCESS_TOKEN` en el env).

### FASE 2 — Portal + facturación

**Hecho hoy ✅** (sin Wompi, operación manual):
- Tablas `subscriptions` + `payments`; funciones `record_payment`, `freeze_overdue_subscriptions`,
  `get_my_billing`, `admin_billing_overview`.
- **Portal del estudiante** (`portal.html` + `assets/js/lef-portal.js`): login, pestaña
  **Facturación** — mensualidad, estado (al día/en mora/congelada), próximo pago, historial.
  Botones de pago en línea visibles pero deshabilitados ("próximamente").
- **Pestaña Pagos del admin**: crea suscripción por estudiante, registra pagos manuales
  (efectivo/transferencia/…), congela/activa, botón "congelar cuentas vencidas".

**Modelo contable (implementado en `20260827240000`):**
- **Estudiante** ≠ **Pagador**. El documento del estudiante es obligatorio (TI/CC/CE/PP,
  el estudiante puede ser menor). El "tercero" del libro es **quien paga**: nombre + tipo y
  número de documento + correo + teléfono, se guardan en la **suscripción** y se **congelan
  en cada pago** (el pagador puede cambiar mes a mes).
- Cada pago lleva consecutivo `REC-AAAA-NNNNN` y una copia congelada de estudiante + pagador,
  así el asiento es auto-suficiente ante la DIAN aunque se elimine al estudiante.
- Los pagos son **inmutables** (trigger `payments_immutable`): no se editan ni se borran.
  Corrección = `admin_reverse_payment` (asiento de reverso, status `refunded`).
- Eliminar un estudiante (`admin_delete_student`): borra inscripción y suscripciones **sin
  pagos**; **desliga** (student_id→NULL) las suscripciones/pagos con historial. No se reconecta
  si se recrea al estudiante.

**Pendiente ⏳ (Wompi — APLAZADO por decisión del usuario, 28 ago 2026):**
El cliente **ya tiene la cuenta Wompi**, pero se decide hacer la integración más adelante.
Antes de empezar hay que reunir: llave pública, secreto de integridad, llave privada y
secreto de eventos (sandbox + producción), y definir las 4 decisiones (abajo).
1. Cargar llaves en `.env` (local) y secretos de Edge Function (Supabase).
2. Cobro en línea: PSE + tarjeta (checkout Wompi). ¿Nequi/Bancolombia también?
3. Guardar tarjeta tokenizada (payment_source) para cobro recurrente.
4. Edge Function `wompi-webhook` (confirmación de pagos) + tabla `payment_methods`.
   El webhook debe llenar `payments` **solo en estado final** (el trigger bloquea UPDATE) y
   registrar campos de la pasarela: id de transacción, banco PSE / franquicia / últimos 4,
   `payment_source_id`, monto en centavos, referencia de comercio, `status`/mensaje.
5. Cobro mensual automático (pg_cron + Edge Function).
6. Congelación automática de morosos (pg_cron) — la función ya existe, falta agendarla.
7. Consentimiento de cobro recurrente + actualizar Términos/Política (revisión legal).
8. **Decisión pendiente: ¿LEF emite factura electrónica ante la DIAN o documento
   equivalente?** Define si hay que integrar un proveedor externo (Siigo/Alegra/Factus)
   y guardar el CUFE / número de factura en cada pago.
9. **Decisión pendiente:** ¿cobro recurrente automático o pago manual cada mes desde el portal?
10. Decisiones pendientes: monto (fijo por curso o por estudiante), día de cobro, días de gracia.

### Datos de prueba en Supabase (borrar cuando entren los reales)
- Profesores: María Rada, Luis Caballero, Daniela Ospino
- Ciclo abierto "Sep - Oct 2026" + 5 horarios/grupos (A1.1 ×2, A1.3, A2.1, B1.1)
- Estudiante demo: **Ana Gómez Prueba** (`ana.prueba@lef-test.com` / `AnaDemo2026!`) —
  matrícula LEF-2026-00001, módulo A1.1, cuenta de portal activa, suscripción $180.000 con 1 pago.
  Tras `20260827240000` su documento quedó como `CC PENDIENTE` (backfill) — editarlo.
- Estudiante **Jorge Rada** (`jorgeradash@gmail.com`) — creado por el cliente probando el panel;
  quedó **sin módulo** (se creó antes de la migración `20260827210000`). Editarlo y asignarle
  módulo para que entre al conteo, o borrarlo.
- Semilla: `supabase/seed_demo.sql`. Todo borrable desde el panel (Académico / Estudiantes / Usuarios).
- Contraseña temporal del admin: `.env` → `ADMIN_TEMP_PASSWORD` (cambiar en la entrega).

### Entrega / handoff
1. GitHub: *Settings → Transfer ownership* del repo a la cuenta del cliente.
2. Vercel: ya está en el Team del cliente — reconectar a su GitHub si quieren auto-deploy.
3. Supabase: ya está en la org del cliente. **Regenerar** las llaves API y `manage-users`
   secrets, cambiar la contraseña del admin, revocar los tokens de `.env`.
4. Dominio: ya apunta a Vercel.
5. Datos de prueba: borrarlos.

## Qué es esto

Landing page multi-página para **LEF (Learn English Fluently)**, academia de inglés online en Barranquilla, Colombia. Sitio estático (HTML/CSS/JS, sin framework ni build), bilingüe (ES/EN con toggle), construido siguiendo `BRAND_GUIDELINES.md`.

## Estructura del sitio (páginas públicas + panel/portal)

| Archivo | Contenido |
|---|---|
| `index.html` | Home: hero con carrusel de fotos y frase animada, "¿Qué hace LEF diferente?" (tarjetas + ruta de niveles con módulo C1), preguntas de calificación, frase ancla, sección del fundador (foto + cita rotativa), cierre + CTA |
| `niveles.html` | Los 4 niveles CEFR (A1–B2) con los 12 módulos (títulos en inglés — mismos que en el panel/asistente — y descripciones en español), bloque de horas (16h+3h=19h) y bloque C1 |
| `sistema.html` | Los 3 pilares del método + nota sobre el examen de validación (no punitivo) |
| `ofrecemos.html` | Las 6 cosas que ofrece LEF (clases, club de conversación, materiales, plataforma, tutorías **al final de cada ciclo**, acompañamiento) |
| `inscripcion.html` | **Asistente de inscripción de 4 pasos** conectado a Supabase (`assets/js/lef-enroll.js`) + tarjeta de pasarela Wompi (solo visual) |
| `login.html` | Inicio de sesión único (`assets/js/lef-auth.js`) — enruta por rol — no indexado |
| `admin.html` | Panel administrativo (SPA, `assets/js/lef-admin.js`) — no indexado |
| `portal.html` | Portal del estudiante — pestaña de facturación (`assets/js/lef-portal.js`) — no indexado |
| `preguntas-frecuentes.html` | Acordeón de FAQ (contenido **inventado como placeholder**, ver abajo) |
| `politica-privacidad.html` | Política de privacidad (borrador fundamentado en la Ley 1581 de 2012 de Colombia) |
| `terminos-uso.html` | Términos de uso (borrador) |

Archivos compartidos: `style.css` (todo el sistema visual, incluye el asistente de inscripción),
`script.js` (i18n EN/ES, menú drawer móvil, reveal-on-scroll, carrusel del hero, cita rotativa
del fundador, inyección del enlace "Iniciar sesión" en el header). `supabase-config.js` (URL +
publishable key, factory `lefClient`). `assets/vendor/supabase.min.js` (supabase-js vendorizado).
`assets/js/`: `lef-enroll.js` (asistente), `lef-admin.js` (panel), `lef-portal.js` (portal),
`lef-auth.js` (login). `assets/css/lef-panel.css` (panel + portal + login).

**Backup del código:** solo el repo GitHub personal + Vercel. `.env` (tokens y credenciales)
vive únicamente local y NO está en Git.

## Identidad de marca (resumen)

- Colores: escala de grises (Tinta `#101010` a Papel `#FAFAF8`) + acento Azul `#2E4E9E`. Nada de otros colores excepto el verde de WhatsApp (`#25D366`, usado en los botones "Escríbenos por WhatsApp" / "Continuar por WhatsApp") y el verde/negro propios de los íconos de WhatsApp.
- Tipografía: Archivo Black (títulos) + Jost (cuerpo), vía Google Fonts.
- Pre-títulos azules (`.eyebrow`) uniformes arriba de los títulos principales en todo el sitio.
- Fuente completa de reglas: `BRAND_GUIDELINES.md`. Contenido oficial: `LEF_CONTENT.md` y `LEF_Cursos_Niveles.md`.

## Datos reales usados

- **WhatsApp:** +57 301 324 0652 (dato dado directamente por el cliente)
- **Correo:** informacion@lefcenter.com
- **Facebook:** https://www.facebook.com/profile.php?id=100067494009346 (perfil real)
- **Instagram:** @Lefcenter (usuario dado por el cliente, no verificado)
- **LinkedIn:** solo el ícono — no existe cuenta/link real todavía, aparece atenuado y sin click ("Próximamente")
- **Fundador:** Luis Antonio Caballero Torrez, Fundador y Director Académico — foto en `assets/photo-founder.png` (headshot **generado con IA**, no es una foto real todavía) y 6 frases suyas en la sección del fundador (1 dada por el cliente + 5 escritas por Claude en el mismo tono, bilingües).

## Pendientes / cosas a revisar

1. **Imágenes reales faltantes**:
   - Los 3 pilares en `sistema.html` (recuadros "Imagen pendiente")
   - Secciones de collage en `niveles.html` y `ofrecemos.html`
   - La foto del fundador es un headshot generado con IA — reemplazar cuando haya una foto real
   - El carrusel del hero en `index.html` ya usa 14 fotos reales (`photo-materials.jpg` + `photo-materials1.jpg`...`13.jpg`)
   - Hay dos fotos sin usar en `assets/` (`pexels-thirdman-5649522.jpg`, `pexels-yankrukov-8199706.jpg`) — preguntarle al cliente si son para alguna sección específica
2. **Preguntas frecuentes** — las 10 preguntas y respuestas son **inventadas** (se pidió así explícitamente mientras se define contenido real). Los métodos de pago y precios se dejaron genéricos a propósito ("se confirman por WhatsApp") porque no hay esa información real todavía.
3. **Pasarela Wompi** — el botón/tarjeta en `inscripcion.html` es solo visual ("próximamente"); falta la integración funcional real. (Se hará sobre Supabase Edge Functions cuando haya credenciales de Wompi.)
4. **Política de privacidad y Términos de uso** — son borradores fundamentados en investigación (Ley 1581/2012, estructura típica de plataformas educativas), marcados como "documento en revisión" en la propia página. Deben pasar por revisión legal antes de darse por definitivos.
5. **LinkedIn** — falta el link real de la cuenta cuando exista.
6. **Contenido bilingüe incompleto** — el toggle EN/ES funciona en todo el header/footer y en las páginas principales (home, niveles, sistema, ofrecemos, inscripción, incluyendo todo lo agregado en esta sesión), pero el contenido de FAQ, política de privacidad y términos de uso sigue **solo en español**.

## Cómo seguir trabajando

- **Para pedir cambios:** decime qué ajustar, edito los archivos localmente.
- **Para publicar:** `npx vercel deploy --prod --yes --token <VERCEL_TOKEN> --scope lefcenter`
  (token en `.env`). El sitio actualiza al toque. Luego `git add` + `commit` + `push` para
  guardar en el repo. **No hay auto-deploy** — cada cambio hay que desplegarlo a mano.
- **Backend:** las migraciones SQL se aplican vía la Management API de Supabase con
  `SUPABASE_ACCESS_TOKEN`. Las Edge Functions con `npx supabase functions deploy`.
- **Caché:** el `vercel.json` deja que JS/CSS revaliden y cachea imágenes 1 año. Si un cambio
  de JS no se ve, `Ctrl+Shift+R` una vez (afecta solo a quien ya había cargado la versión vieja).
- **Assets:** imágenes/íconos en `assets/`. Falta un ícono propio de "login" (hoy es un SVG inline).

## Estado al cerrar esta sesión (28 ago 2026)

- ✅ Sitio migrado a Vercel + Supabase, dominio apuntando, Fase 1 completa y probada en vivo.
- ✅ Base de Fase 2 (portal + facturación manual) lista.
- ✅ Migración `20260827240000` (documento del estudiante + libro contable + borrado de
  estudiante conservando historial) escrita. **Falta aplicarla a Supabase y desplegar.**
- ⏳ También sin aplicar: `20260827230000_cascadas_admin.sql`.
- ⏳ Wompi: el cliente ya tiene la cuenta, pero la integración de pagos en línea se
  **aplazó** por decisión del usuario (28 ago 2026) — ver "Pendiente ⏳".
- ⏳ Jorge Rada sin módulo (ver datos de prueba).
- ⏳ Contenido bilingüe de FAQ/política/términos; imágenes reales; revisión legal.
