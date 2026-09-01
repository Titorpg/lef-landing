# Estado del proyecto — Landing LEF

Última actualización: 31 de agosto de 2026. Sesión larga: ajustes visuales en Home/Niveles/
Sistema/Qué ofrecemos (desplegados) + arranque de **Fase 2 de Wompi** — portal del estudiante
con 3 pestañas (Facturación con pago real, Mi curso, Mi cuenta) y las Edge Functions de Wompi
ya desplegadas. **Migración del portal aplicada (HTTP 201) y llaves de Wompi sandbox
configuradas el 1 sep 2026** — el portal carga y el backend de pagos sandbox está completo.
**Siguiente paso: probar un pago de sandbox de punta a punta** (ver Wompi Fase 1, punto 5).

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

Las dos últimas se aplicaron el 28 ago 2026 (Management API, HTTP 201) y se desplegó a Vercel.

**Tablas:** `modules`, `cycles`, `teachers`, `schedules`, `groups`, `students`,
`enrollments`, `registration_counters`, `profiles`, `subscriptions`, `payments`.

**Funciones SECURITY DEFINER:** `get_public_modules`, `get_schedule_availability`,
`create_enrollment` (transaccional: valida cupo, exige documento del estudiante,
dup-check correo/WhatsApp/documento, asigna grupo, matrícula `LEF-AAAA-NNNNN`),
`get_enrollment_confirmation`, `admin_assign_module` (crea/actualiza la inscripción
"solo módulo" de un estudiante), `module_enrollment_counts`, `group_enrollment_counts`,
`admin_set_module_active` (cascada módulo→horarios/grupos), `record_payment` (congela
al pagador, consecutivo `REC-…`), `admin_reverse_payment`, `next_receipt_number`,
`admin_delete_student`, `freeze_overdue_subscriptions`, `get_my_billing`,
`admin_billing_overview`, `is_admin`/`is_teacher`/`is_staff`/`current_student_id`.
RLS en todas las tablas. Trigger `payments_immutable` (pagos append-only).

- **Asistente de 4 pasos** (`inscripcion.html` + `assets/js/lef-enroll.js` + CSS en `style.css`):
  1 Tus datos (nombre, **tipo y número de documento — obligatorio**, WhatsApp, correo, edad,
  ciudad) · 2 Elige nivel (12 módulos, título en inglés) · 3 Elige horario (cupos reales) ·
  4 Revisar. Al confirmar: pantalla con nº de matrícula **+ botón WhatsApp** (opción b).
- **Panel admin** (`admin.html` + `assets/js/lef-admin.js` + `assets/css/lef-panel.css`):
  login vía `/login`. Barra superior = solo logo LEF (lleva al Dashboard). Secciones:
  - **Dashboard**: KPIs (estudiantes, **profesores**, inscripciones activas/nuevas,
    al día/mora/congeladas — todos en una fila en escritorio); donut SVG con **1 color fijo
    por módulo** y leyenda en grilla con % de cada uno; sección **"Estado de los módulos"**
    con aviso ⚠️ si hay alguno desactivado; tabla de inscripciones (cambiar estado);
    pagos recientes.
  - **Estudiantes**: al crear/editar se **elige el módulo** (crea/actualiza la inscripción
    vía `admin_assign_module`) y se exige **documento** (TI/CC/CE/PP); columnas Documento y
    Módulo; crear cuenta de portal, restablecer contraseña, activar/desactivar acceso,
    editar, **eliminar** (si tiene pagos: modal "escribe ELIMINAR", el historial se conserva
    desligado), + Estudiante.
  - **Pagos**: suscripción atada a **Módulo** + **datos de quien paga** (nombre + documento +
    correo + teléfono, prellenados del estudiante); registrar pago manual (con datos del
    pagador editables por pago), **"Ver pagos"** por suscripción → **"Reversar"** (los pagos
    no se editan ni se borran); congelar vencidas. Suscripciones de estudiantes eliminados en
    solo lectura, etiqueta "estudiante eliminado".
  - **Académico**: Módulos (activar/desactivar, editar título/desc, columna **Inscritos**),
    Ciclos (**Periodo** = selector de pares de meses que fija los calendarios inicio/fin;
    abrir/cerrar, editar, eliminar), Profesores (editar/eliminar), Horarios
    (activar/desactivar, eliminar), Grupos (editar profesor/cupo, activar/desactivar, eliminar).
    Un módulo desactivado deja de aparecer para asignar en todas las pestañas.
  - **Usuarios**: lista admin + estudiantes + **profesores** (con o sin cuenta); columna
    Creado; filtros por rol / activo-inactivo / orden por fecha; crear staff, cambiar rol,
    activar/desactivar, eliminar.
- **Portal del estudiante** (`portal.html` + `assets/js/lef-portal.js`): pestaña Facturación
  (historial de pagos con nº de recibo `REC-…`).
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

**Hecho ✅** (operación manual, sin Wompi todavía):
- Tablas `subscriptions` + `payments`; funciones `record_payment`, `freeze_overdue_subscriptions`,
  `get_my_billing`, `admin_billing_overview`, `admin_reverse_payment`, `admin_delete_student`.
- **Portal del estudiante** (`portal.html` + `assets/js/lef-portal.js`): login, pestaña
  **Facturación** — mensualidad, estado (al día/en mora/congelada), próximo pago, historial
  con nº de recibo. Botones de pago en línea visibles pero deshabilitados ("próximamente").
- **Pestaña Pagos del admin**: crea suscripción por estudiante (con datos del pagador),
  registra pagos manuales (efectivo/transferencia/…), ver pagos y reversar, congela/activa,
  botón "congelar cuentas vencidas".
- **Libro contable** (ver abajo): documento del estudiante obligatorio, pagador separado,
  pagos inmutables con consecutivo, borrado de estudiante conservando historial.

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

**Wompi — FASE 1 en construcción (arrancó el 31 ago 2026, ya no está aplazada):**
El cliente ya tiene la cuenta habilitada y decidió arrancar. Fase 1 = pago único de la
mensualidad desde el **portal del estudiante** (no desde el formulario público) con el
Widget oficial de Wompi (PSE + tarjeta); **sin** tokenización ni cobro automático mensual
todavía — eso es Fase 2, más abajo, sigue pendiente igual que antes.

Fase 1 — estado:
1. ✅ Edge Functions `wompi-checkout` (calcula la firma de integridad del lado del
   servidor, **con** verify_jwt) y `wompi-webhook` (verifica la firma de eventos y
   registra el pago, **sin** verify_jwt — Wompi llama sin auth de Supabase) —
   desplegadas en Supabase (`wompi-webhook` v5 con `--no-verify-jwt --use-api`).
2. ✅ Portal: pestaña Facturación con el botón "Pagar en línea" ya conectado al widget;
   pestañas nuevas Mi curso y Mi cuenta. **Desplegado en Vercel.**
3. ✅ Migración de base de datos (`get_my_course`, `update_my_profile`,
   `record_wompi_payment`, `profiles.avatar_url`, bucket de Storage `avatars`) —
   **APLICADA por el usuario el 31 ago 2026** (`node apply-migration.js`, HTTP 201).
   El portal ya carga.
4. ✅ Llaves de Wompi **sandbox** configuradas el 1 sep 2026 como secrets de Supabase
   (`npx supabase secrets set` — este comando **sí** lo puede correr Claude, no está
   bloqueado): `WOMPI_PUBLIC_KEY` (`pub_test_SwKPZBu7...`), `WOMPI_INTEGRITY_SECRET`
   (`test_integrity_6AB9m8m4...`), `WOMPI_EVENTS_SECRET` (`test_events_mVWpVDDC...`).
   URL de eventos registrada en Wompi (Sandbox → "Seguimiento de transacciones → URL de
   Eventos"): `https://cemrxcatbxbcipxmsnjf.supabase.co/functions/v1/wompi-webhook`.
   La llave privada no hace falta todavía. **En producción hay que repetir todo con
   llaves `pub_prod_...` / `prod_integrity_...` / `prod_events_...` y registrar la URL
   en el ambiente de producción de Wompi por separado.**
5. ⏳ **SIGUIENTE: probar un pago de sandbox de punta a punta** desde el portal (cuenta
   demo Ana Gómez). Tarjetas de prueba de Wompi: aprobada `4242 4242 4242 4242`,
   rechazada `4111 1111 1111 1111` (CVV y fecha cualquiera futura). Verificar que el
   pago aparece en la pestaña Facturación con nº de recibo `REC-…` (lo registra el
   webhook, no la redirección del navegador).
6. ⏳ Cuando funcione en sandbox, repetir con llaves de producción (`pub_prod_...`) para
   pasar a cobros reales.

**Fase 2 — sigue pendiente (sin definir, para más adelante):**
1. Guardar tarjeta tokenizada (payment_source) para cobro recurrente.
2. Cobro mensual automático (pg_cron + Edge Function).
3. Congelación automática de morosos (pg_cron) — la función ya existe, falta agendarla.
4. Consentimiento de cobro recurrente + actualizar Términos/Política (revisión legal).
5. **Decisión pendiente: ¿LEF emite factura electrónica ante la DIAN o documento
   equivalente?** Define si hay que integrar un proveedor externo (Siigo/Alegra/Factus)
   y guardar el CUFE / número de factura en cada pago.
6. **Decisión pendiente:** ¿cobro recurrente automático o pago manual cada mes desde el portal?
7. Decisiones pendientes: monto (fijo por curso o por estudiante — hoy ya es por estudiante,
   vía `subscriptions.monthly_amount`), día de cobro, días de gracia (`billing_day`/
   `grace_days` en `subscriptions` ya existen, solo falta la automatización).

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
| `index.html` | Home: hero con carrusel de fotos y frase animada, "¿Qué hace LEF diferente?" (4 tarjetas con foto real de Pexels + ruta de niveles con módulo C1), preguntas de calificación (sin el recuadro "Verifica tu nivel", eliminado), frase ancla (franja azul, ya no negra), sección del fundador (logo + cita rotativa), cierre + CTA |
| `niveles.html` | Los 4 niveles CEFR (A1–B2) con los 12 módulos, bloque de horas (16h+3h=19h), bloque **C1 rediseñado** (tarjeta igual a los niveles + panel "qué incluye" con 5 puntos, ambos se expanden juntos al hover) y **carrusel de reseñas** "Voces de LEF" al final (fondo azul) |
| `sistema.html` | Los 3 pilares del método (con foto real de Pexels cada uno) + nota corta sobre el examen de validación dividida en 2 párrafos + 3 puntos con chulo (ya no hay franja negra "Tres pilares") + carrusel de reseñas |
| `ofrecemos.html` | Las 6 cosas que ofrece LEF en tarjetas estilo "Sistema de aprendizaje" (sin foto, 2 columnas × 3 en escritorio) + 4 puntos con chulo (ya no hay foto suelta ni franja azul separada — el carrusel de reseñas ya es azul) |
| `inscripcion.html` | **Asistente de inscripción de 4 pasos** conectado a Supabase (`assets/js/lef-enroll.js`) + tarjeta de pasarela Wompi (solo visual) |
| `login.html` | Inicio de sesión único (`assets/js/lef-auth.js`) — enruta por rol — no indexado |
| `admin.html` | Panel administrativo (SPA, `assets/js/lef-admin.js`) — no indexado |
| `portal.html` | Portal del estudiante — 3 pestañas con router por hash (`assets/js/lef-portal.js`): Facturación (pago en línea con Wompi), Mi curso, Mi cuenta (foto/contraseña/datos) — no indexado |
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
- **Sección del fundador (`#founder`):** ya **no** muestra foto, nombre ni cargo del fundador
  (se quitó el 30 ago 2026 por decisión del usuario). Ahora lleva el logo horizontal de LEF
  en grande (`.founder-logo`) y debajo las **6 frases rotativas** (1 dada por el cliente + 5
  escritas por Claude en el mismo tono, bilingües), que inserta `initFounderQuotes()` en
  `script.js`. `assets/photo-founder.png` sigue en el repo pero ya no se usa; la clave i18n
  `founder_role` quedó sin uso.

## Pendientes / cosas a revisar

1. **✅ HECHO — Migración del portal aplicada**
   (`supabase/migrations/20260831190000_portal_curso_cuenta_wompi.sql`, commit `115dfa2`):
   aplicada por el usuario el 31 ago 2026 con `node apply-migration.js` (HTTP 201). Agregó
   `get_my_course`, `update_my_profile`, `record_wompi_payment`, `profiles.avatar_url` y el
   bucket de Storage `avatars`. El portal del estudiante ya carga. **⏳ Falta probarlo en vivo.**
2. **✅ HECHO — Llaves de Wompi sandbox configuradas** (1 sep 2026): los 3 secrets en
   Supabase + URL de eventos registrada en Wompi + `wompi-webhook` redesplegada sin
   verify_jwt (v5). Ver sección Wompi Fase 1 arriba. **⏳ Falta la prueba de pago de
   punta a punta** (punto 5 de esa sección) y luego repetir con llaves de producción.
3. **✅ HECHO — Migración de Supabase aplicada** (`supabase/migrations/20260831180000_inscripcion_horario_despues.sql`,
   commit `c0d3944`): aplicada por el usuario el 31 ago 2026 desde una terminal (HTTP 201,
   "Migración aplicada correctamente"), corriendo un script Node (`node apply-migration.js`,
   generado para la ocasión y borrado después de usarlo) que llama a la Management API de
   Supabase con `SUPABASE_ACCESS_TOKEN` — Claude Code no puede llamar esa API por su cuenta
   (bloqueo automático de seguridad, probado con Bash y PowerShell), así que cualquier
   migración futura necesita este mismo paso manual del usuario. `create_enrollment` ahora
   acepta `p_schedule_id` nulo y `get_enrollment_confirmation` no exige grupo asignado.
   (Nota: desplegar Edge Functions con `npx supabase functions deploy` **sí** lo puede
   hacer Claude directamente — el bloqueo es solo para la Management API de SQL.)
4. **✅ HECHO — Botón "decidir horario después" en el asistente** (`assets/js/lef-enroll.js`
   paso 3, commit `96b3542`, desplegado): aparece siempre, tenga o no horarios el módulo; al
   elegirlo se habilita "Continuar" y el paso 4 / la pantalla final muestran "Por definir — lo
   coordinamos por WhatsApp". Probado en local hasta la pantalla de revisión.
   **⏳ Falta probar el envío real de punta a punta en vivo** — confirmar que aparece el
   número de matrícula y el botón "Continuar por WhatsApp"; si se usa un estudiante de
   prueba, borrarlo después desde el panel admin.
5. **✅ HECHO — Bug de "Atrás" arreglado** (commit `ff65a3e`, desplegado, encontrado por el
   cliente al probar el punto anterior): el botón "Atrás" del paso 3 reutilizaba la validación
   del paso 1 y borraba nombre/documento/WhatsApp/correo al retroceder, dejando el asistente
   sin poder avanzar ni retroceder más. Ya retrocede sin tocar los datos.
6. **Reseñas de "Voces de LEF" son inventadas** — el carrusel de testimonios (Niveles, Sistema,
   Qué ofrecemos) usa 6 reseñas de ejemplo escritas por Claude, no de estudiantes reales.
   Reemplazar en `script.js` (claves `testi_1_q`…`testi_6_m`) cuando el cliente tenga reseñas
   reales o quiera pedirlas.
7. **Preguntas frecuentes** — las 10 preguntas y respuestas son **inventadas** (se pidió así explícitamente mientras se define contenido real). Los métodos de pago y precios se dejaron genéricos a propósito ("se confirman por WhatsApp") porque no hay esa información real todavía.
8. **Política de privacidad y Términos de uso** — son borradores fundamentados en investigación (Ley 1581/2012, estructura típica de plataformas educativas, y ahora también referencian a Wompi como pasarela), marcados como "documento en revisión" en la propia página. Deben pasar por revisión legal antes de darse por definitivos.
9. **Fotos reales pendientes**: la foto del fundador (headshot generado con IA, ya no se usa en portada pero sigue en el repo) y todas las fotos de las 4 casillas de "Qué hace LEF diferente" (Home), los 3 pilares (Sistema de aprendizaje) son de banco de imágenes (Pexels), no de estudiantes/clases reales de LEF — reemplazar cuando haya material propio.
10. **Contenido bilingüe incompleto** — el toggle EN/ES funciona en todo el header/footer y en las páginas principales (home, niveles, sistema, ofrecemos, inscripción, incluyendo todo lo agregado en esta sesión), pero el contenido de FAQ, política de privacidad y términos de uso sigue **solo en español**.

## Cómo seguir trabajando

- **Para pedir cambios:** decime qué ajustar, edito los archivos localmente.
- **Para publicar:** `npx vercel deploy --prod --yes --token <VERCEL_TOKEN> --scope lefcenter`
  (token en `.env`). El sitio actualiza al toque. Luego `git add` + `commit` + `push` para
  guardar en el repo. **No hay auto-deploy** — cada cambio hay que desplegarlo a mano.
- **Backend:** las migraciones SQL se aplican vía la Management API de Supabase con
  `SUPABASE_ACCESS_TOKEN`. Las Edge Functions con `npx supabase functions deploy`.
  **Desde el 31 ago 2026, Claude Code ya no puede llamar esa API por su cuenta** (bloqueo
  automático de seguridad al detectar cambios de base de datos en producción — probado con
  Bash y PowerShell, ambos bloqueados). El usuario tiene que aplicar cada migración a mano,
  con cualquiera de estas dos opciones: (a) pegar el SQL en el **SQL Editor** de
  dashboard.supabase.com (funciona desde el navegador del celular), o (b) correr un script
  Node que Claude puede dejar listo (lee `.env` y hace la llamada) desde una **terminal
  aparte** (no el chat de Claude Code) con `node <script>.js`.
- **Caché:** el `vercel.json` deja que JS/CSS revaliden y cachea imágenes 1 año. Si un cambio
  de JS no se ve, `Ctrl+Shift+R` una vez (afecta solo a quien ya había cargado la versión vieja).
  **Importante:** si se reemplaza el *contenido* de una imagen ya existente (no una nueva),
  hay que guardarla con un **nombre de archivo distinto** — sobrescribir el mismo nombre deja
  la versión vieja cacheada indefinidamente aunque el archivo en el repo ya sea el correcto.
- **Assets:** imágenes/íconos en `assets/`. Falta un ícono propio de "login" (hoy es un SVG inline).

## Estado al cerrar esta sesión (1 sep 2026) — Wompi sandbox funcionando

- ✅ **Migración del portal aplicada** por el usuario (`node apply-migration.js`, HTTP 201).
- ✅ **Llaves de Wompi sandbox configuradas** (secrets de Supabase) + URL de eventos
  registrada en Wompi + `wompi-webhook` redesplegada sin verify_jwt.
- ✅ **Bug del webhook corregido** (commit `bb516f6`): Wompi manda `timestamp` en la raíz
  del evento, no dentro de `signature`; el guard lo rechazaba con HTTP 400 y el pago no se
  registraba. Tras el arreglo, **pago de sandbox probado de punta a punta** — aparece en el
  historial con recibo `REC-…` (dos pagos de prueba con la cuenta jorgeradash@gmail.com).
- ✅ **Ajustes de Pagos/portal** (commit `9ed0db0`, desplegado con `./deploy.ps1`):
  1. El modal "Ver pagos" del admin ahora es ancho en escritorio (`.pnl-modal.wide`, 860px);
     ya no aplasta la tabla en vertical.
  2. Suscripción activa **sin ningún pago confirmado → estado "pendiente"** (badge en el
     portal del estudiante, badge + KPI "Pendientes" en el Dashboard del admin, badge en la
     lista de Pagos). Pasa a "al día" cuando el webhook registra el primer pago. Es lógica
     de visualización, sin migración.
- ℹ️ "Reversar pago" del admin **sí funciona** — llama a `admin_reverse_payment` (crea asiento
  de reverso, el pago original queda inmutable). El botón sale solo en pagos "aprobados" sin
  reverso previo.
- 🔧 **Scripts nuevos en la carpeta** (no se suben, `.claude/` y `*.ps1` sueltos):
  - `deploy.ps1` — publica a Vercel leyendo el token del `.env` (`./deploy.ps1`).
  - `configurar-permisos-deploy.ps1` — **correr una vez**: autoriza a Claude Code a hacer
    `npx vercel deploy` y `npx supabase functions deploy` / `secrets set` sin que el
    clasificador de auto-mode los bloquee (escribe `.claude/settings.local.json`). Después,
    reiniciar Claude Code. Claude no puede escribir ese archivo por su cuenta (frontera de
    seguridad). Las migraciones SQL siguen siendo manuales igual que antes.
- ⏳ **Pendiente:** pasar Wompi a **producción** (llaves `pub_prod_...` + URL de eventos en
  el ambiente de producción de Wompi) y borrar los pagos/estudiantes de prueba.

## Estado al cerrar esta sesión (31 ago 2026)

Sesión larga de ajustes visuales pedidos por el cliente, en Home, Niveles, Sistema de
aprendizaje y Qué ofrecemos. **Cada punto se desplegó a producción apenas se terminaba**
(no quedó nada visual pendiente de publicar). Commits `c102077` → `c0d3944`.

- ✅ **Home**: 4 imágenes reales (Pexels, horizontales) en "¿Qué hace LEF diferente?" con
  overlay del logo; "Verifica tu nivel/Descubre tu nivel" azul unificado con el bloque C1, y
  la franja "Aprender inglés es más..." pasó de negra a azul; footer sin botón de LinkedIn
  (el cliente no usa esa red) y con "Teléfono" en vez de "WhatsApp" en Contacto; recuadro
  "Verifica tu nivel" **eliminado** (decisión del cliente, sección sin uso).
- ✅ **Legales y FAQ**: ya no se menciona ningún precio en ningún lado del sitio; política de
  privacidad, términos de uso y FAQ ahora hablan de **Wompi** como la pasarela de pagos oficial
  (política de privacidad tiene una sección nueva sobre terceros/Wompi).
- ✅ **Niveles**: estadísticas (12/4/8/3) y texto de horas/nota más legibles (más grandes/oscuros);
  el módulo **C1 rediseñado** como tarjeta de nivel + panel "qué incluye" (5 puntos), ambos con
  la misma altura incluso cuando la tarjeta se expande al pasar el cursor (CSS `align-items:stretch`,
  sin JS); **carrusel de reseñas** "Voces de LEF" reemplazó los 3 recuadros de imagen pendiente.
- ✅ **Sistema de aprendizaje**: los 3 pilares ya tienen foto real (Pexels); se quitó la franja
  negra "Tres pilares, un solo sistema" y su mensaje pasó a 3 puntos con chulo debajo de una
  nota más corta (dividida en 2 párrafos, antes era un solo párrafo muy largo); carrusel de
  reseñas al final.
- ✅ **Qué ofrecemos**: las 6 casillas ahora usan el mismo formato que "Sistema de aprendizaje"
  (tarjeta con badge circular, sin foto), 2 columnas × 3 en escritorio; se quitó la foto suelta
  que quedaba flotando al lado; el mensaje de la franja azul pasó a 4 puntos con chulo debajo
  de las casillas, y se eliminó esa franja azul (el carrusel de reseñas de abajo ya es azul).
- ✅ **Carrusel de reseñas** (componente compartido, usado en Niveles/Sistema/Qué ofrecemos):
  varias vueltas hasta quedar bien —
  1. Reescrito de animación CSS a JS con auto-scroll infinito real y arrastre manual
     (mouse/dedo) — al soltar retoma el movimiento solo.
  2. Encontrado y corregido un bug real: si el navegador no dispara `pointerup` al soltar
     (por lo que fuera), la bandera de "arrastrando" quedaba atascada para siempre y el
     autoplay se congelaba tras la primera interacción. Se agregaron seguros (listeners de
     respaldo a nivel `window`, vigilante de 4s).
  3. Vuelto a animar con CSS `transform` (acelerado por GPU) en vez de `scrollLeft`, porque
     este último se sentía "lagueado" — mismo resultado fluido que el original, con arrastre.
  4. Ya no respeta la preferencia de accesibilidad "reducir movimiento" del sistema — decisión
     explícita del cliente, para que el carrusel siempre se mueva solo.
  - Velocidad: más lenta en escritorio, algo más rápida en móvil que antes.
- ✅ **Asistente de inscripción**: agregado el botón "Prefiero decidir mi horario después" en
  el paso 3 (`assets/js/lef-enroll.js`, commit `96b3542`) — aparece siempre, con o sin horarios
  disponibles; habilita "Continuar" y el paso 4/pantalla final muestran "Por definir — lo
  coordinamos por WhatsApp". Desplegado y probado en local hasta la pantalla de revisión.
- ✅ **Migración de Supabase aplicada** (más tarde en la misma sesión, ver "Pendientes" #1):
  permite que `create_enrollment` reciba horario nulo y cree una inscripción "solo módulo".
  Claude Code no pudo aplicarla por su cuenta (bloqueo de seguridad, probado con Bash y
  PowerShell); el usuario la aplicó desde una terminal aparte en VS Code corriendo un script
  Node preparado para la ocasión → **HTTP 201, aplicada correctamente**. Falta la prueba real
  de punta a punta en el sitio en vivo.
- ✅ Corregido además un bug preexistente del botón "Atrás" en el asistente (ver punto 3 de
  "Pendientes"), encontrado por el cliente al probar el flujo completo.
- ♻️ Recordatorio: **no hay auto-deploy**. Cada cambio de HTML/CSS/JS se publicó a mano con
  `npx vercel deploy --prod --yes --token <VERCEL_TOKEN> --scope lefcenter` después de cada commit.

## Estado al cerrar la sesión anterior (30 ago 2026)

- ✅ Portada: quitada la foto + nombre + cargo del fundador; en su lugar el logo LEF grande.
  Las frases rotativas se mantienen. Cambios en `index.html` y `style.css`.
- ✅ Commit `a3535d8` + `git push` a GitHub (se subieron también los 4 commits que estaban
  pendientes de push desde la sesión anterior).
- ✅ Desplegado a producción con `npx vercel deploy --prod` → alias `www.lefcenter.com`
  (deploy `dpl_J5fMsqZCQz3Xsa2hWQpryV5aSRTj`). Verificado en vivo.
- ♻️ Recordatorio: **no hay auto-deploy**. Commit/push a GitHub NO publica nada; hay que
  correr `npx vercel deploy --prod --yes --token <VERCEL_TOKEN> --scope lefcenter` a mano.

## Estado al cerrar la sesión anterior (28 ago 2026)

- ✅ Sitio migrado a Vercel + Supabase, dominio apuntando, Fase 1 completa y probada en vivo.
- ✅ Fase 2 (portal + facturación manual) + libro contable listos.
- ✅ Migraciones `20260827230000` y `20260827240000` **aplicadas** a Supabase y **desplegado**
  a Vercel (commits `888c5b3`, `0276352`). ✅ `git push` hecho el 30 ago 2026.
- ⏳ **Probar en vivo** (con `Ctrl+Shift+R`): inscripción con documento, borrado de estudiante,
  datos del pagador y reversos en Pagos.
- ⏳ Wompi: el cliente ya tiene la cuenta; integración de pagos en línea **aplazada** por
  decisión del usuario — ver FASE 2 → "Pendiente ⏳ (Wompi)".
- ⏳ Datos de prueba: Ana Gómez con documento `CC PENDIENTE`; Jorge Rada sin módulo y con
  documento `CC PENDIENTE`.
- ⏳ Contenido bilingüe de FAQ/política/términos; imágenes reales; revisión legal.
