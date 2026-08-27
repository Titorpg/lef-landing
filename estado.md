# Estado del proyecto — Landing LEF

Última actualización: 27 de agosto de 2026

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

- **Backend** (`supabase/migrations/20260827120000_sistema_inscripcion.sql`):
  9 tablas (`modules`, `cycles`, `teachers`, `schedules`, `groups`, `students`,
  `enrollments`, `registration_counters`, `profiles`) + funciones SECURITY DEFINER:
  `get_public_modules`, `get_schedule_availability`, `create_enrollment`
  (transaccional: valida cupo, detecta duplicados por correo/WhatsApp, asigna grupo,
  genera matrícula `LEF-AAAA-NNNNN`), `get_enrollment_confirmation`. RLS en todo.
  La tabla `inscripciones` de la etapa A se **eliminó** (reemplazada por students+enrollments).
- **Asistente de 4 pasos** (`inscripcion.html` + `assets/js/lef-enroll.js` + CSS en `style.css`):
  1 Tus datos · 2 Elige nivel (12 módulos) · 3 Elige horario (cupos reales) · 4 Revisar.
  Al confirmar: pantalla con nº de matrícula **+ botón WhatsApp** (opción b).
- **Panel admin** (`admin.html` + `assets/js/lef-admin.js` + `assets/css/lef-panel.css`):
  login vía `/login`. Secciones:
  - **Dashboard**: KPIs (estudiantes, inscripciones, al día/mora/congeladas), donut SVG de
    inscripciones por módulo, tabla de inscripciones (cambiar estado), pagos recientes.
  - **Estudiantes**: crear cuenta de portal, restablecer contraseña, activar/desactivar
    acceso, editar, eliminar, + Estudiante manual.
  - **Pagos**: suscripciones, registrar pago manual, editar, congelar vencidas.
  - **Académico**: Módulos (activar/desactivar + editar título/desc), Ciclos (Periodo =
    selector de pares de meses que fija los calendarios de inicio/fin, abrir/cerrar, editar),
    Profesores (editar/eliminar), Horarios (activar/desactivar, eliminar), Grupos
    (editar profesor/cupo, activar/desactivar, eliminar).
  - **Usuarios**: crear staff, cambiar rol, activar/desactivar, eliminar.
  - Barra superior con logo LEF (sin tag "Panel"); el logo lleva al Dashboard, no al sitio.
- **Roles** (tabla `profiles.role`): `admin` (todo) · `teacher` (solo lectura de sus grupos)
  · `student` (solo el portal). Helpers: `is_admin()`, `is_teacher()`, `current_student_id()`.
  Cuenta admin única sembrada; el admin crea las demás cuentas desde el panel.
- **Edge Function** `manage-users`: crea/edita cuentas de auth (solo admin). Sin Wompi no
  hace falta nada más.

### FASE 2 — Portal + facturación

**Hecho hoy ✅** (sin Wompi, operación manual):
- Tablas `subscriptions` + `payments`; funciones `record_payment`, `freeze_overdue_subscriptions`,
  `get_my_billing`, `admin_billing_overview`.
- **Portal del estudiante** (`portal.html` + `assets/js/lef-portal.js`): login, pestaña
  **Facturación** — mensualidad, estado (al día/en mora/congelada), próximo pago, historial.
  Botones de pago en línea visibles pero deshabilitados ("próximamente").
- **Pestaña Pagos del admin**: crea suscripción por estudiante, registra pagos manuales
  (efectivo/transferencia/…), congela/activa, botón "congelar cuentas vencidas".

**Pendiente ⏳ (Wompi — el cliente entrega la cuenta mañana):**
1. Cuenta Wompi del cliente (sandbox + producción) → llaves.
2. Cobro en línea: PSE + tarjeta (checkout Wompi).
3. Guardar tarjeta tokenizada (payment_source) para cobro recurrente.
4. Edge Function `wompi-webhook` (confirmación de pagos) + tabla `payment_methods`.
5. Cobro mensual automático (pg_cron + Edge Function).
6. Congelación automática de morosos (pg_cron) — la función ya existe, falta agendarla.
7. Consentimiento de cobro recurrente + actualizar Términos/Política (revisión legal).
8. Decisiones pendientes: monto (fijo por curso o por estudiante), día de cobro, días de gracia.

### Datos de prueba en Supabase (borrar cuando entren los reales)
- Profesores: María Rada, Luis Caballero, Daniela Ospino
- Ciclo abierto "Sep - Oct 2026" + 5 horarios/grupos (A1.1 ×2, A1.3, A2.1, B1.1)
- Estudiante demo: **Ana Gómez Prueba** (`ana.prueba@lef-test.com`) — matrícula LEF-2026-00001,
  cuenta de portal activa, suscripción $180.000 con 1 pago registrado.
- Semilla: `supabase/seed_demo.sql`. Borrable desde el panel (Académico / Estudiantes).

### Entrega / handoff
1. GitHub: *Settings → Transfer ownership* del repo a la cuenta del cliente.
2. Vercel: ya está en el Team del cliente — reconectar a su GitHub si quieren auto-deploy.
3. Supabase: ya está en la org del cliente. **Regenerar** las llaves API y `manage-users`
   secrets, cambiar la contraseña del admin, revocar los tokens de `.env`.
4. Dominio: ya apunta a Vercel.
5. Datos de prueba: borrarlos.

## Qué es esto

Landing page multi-página para **LEF (Learn English Fluently)**, academia de inglés online en Barranquilla, Colombia. Sitio estático (HTML/CSS/JS, sin framework ni build), bilingüe (ES/EN con toggle), construido siguiendo `BRAND_GUIDELINES.md`.

## Estructura del sitio (8 páginas)

| Archivo | Contenido |
|---|---|
| `index.html` | Home: hero con carrusel de fotos y frase animada, "¿Qué hace LEF diferente?" (tarjetas + ruta de niveles con módulo C1), preguntas de calificación, frase ancla, sección del fundador (foto + cita rotativa), cierre + CTA |
| `niveles.html` | Los 4 niveles CEFR (A1–B2) con los 12 módulos reales (nombres y descripciones), bloque de horas de acompañamiento (16h+3h=19h) y bloque C1 de cursos adicionales |
| `sistema.html` | Los 3 pilares del método + nota sobre el examen de validación (no punitivo) |
| `ofrecemos.html` | Las 6 cosas que ofrece LEF (clases, club de conversación, materiales, plataforma, tutorías **al final de cada ciclo**, acompañamiento) |
| `inscripcion.html` | **Asistente de inscripción de 4 pasos** conectado a Supabase (`assets/js/lef-enroll.js`) + tarjeta de pasarela Wompi (solo visual) |
| `login.html` | Inicio de sesión único (`assets/js/lef-auth.js`) — enruta por rol — no indexado |
| `admin.html` | Panel administrativo (SPA, `assets/js/lef-admin.js`) — no indexado |
| `portal.html` | Portal del estudiante — pestaña de facturación (`assets/js/lef-portal.js`) — no indexado |
| `preguntas-frecuentes.html` | Acordeón de FAQ (contenido **inventado como placeholder**, ver abajo) |
| `politica-privacidad.html` | Política de privacidad (borrador fundamentado en la Ley 1581 de 2012 de Colombia) |
| `terminos-uso.html` | Términos de uso (borrador) |

Archivos compartidos: `style.css` (todo el sistema visual), `script.js` (i18n EN/ES, menú drawer móvil, formulario→WhatsApp, reveal-on-scroll, carrusel del hero, cita rotativa del fundador).

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

- **Para pedir cambios:** solo decime qué ajustar, yo edito los archivos localmente.
- **Para publicar cambios en el sitio en vivo:** avisame y hago `git add` + `commit` + `push` — se actualiza solo en 1-2 minutos, sin que tengas que volver a autenticarte.
- **Para ver el sitio en local antes de publicar:** puedo levantar un servidor local de prueba (Node) en `http://127.0.0.1:PUERTO/` si querés revisar algo antes de subirlo.
- **Si un cambio publicado no se ve en el celular:** normalmente es caché del navegador — probar en modo incógnito o borrar caché del sitio antes de asumir que algo quedó mal.
- **Assets:** todas las imágenes/íconos están en `assets/` (logos, fotos reales de clase y materiales, foto del fundador, íconos de WhatsApp/redes/FAQ ya integrados).
