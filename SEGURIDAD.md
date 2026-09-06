# LEF — Endurecimiento del inicio de sesión

Guía de puesta en marcha. Hazlo **en este orden**. Lo que hace Claude va marcado
con 🤖; lo que haces tú, con 👤.

Fecha de este plan: 6 de septiembre de 2026.

---

## Resumen de qué cambia

- 🔴 **Se cierra una escalada de privilegios**: hoy un estudiante puede volverse
  admin desde la consola del navegador (`update profiles set role='admin'`). La
  migración `20260906120000` lo bloquea.
- Contraseñas: las genera el servidor, se envían por correo (Resend), y el usuario
  **debe crear su contraseña personal en el primer ingreso**. Política fuerte
  (12+ caracteres, mayúscula, minúscula, número, símbolo).
- **Verificación en dos pasos (2FA/TOTP) obligatoria para administradores.**
- **CAPTCHA (Cloudflare Turnstile)** en el login y en "¿olvidaste tu contraseña?".
- "¿Olvidaste tu contraseña?" real, con enlace por correo (`recuperar.html`).
- Edge Functions con **CORS restringido** a los dominios de LEF.
- **Bitácora de auditoría** (`audit_log`) de toda acción sobre cuentas.
- Guardarraíl: no se puede quitar el rol / desactivar / borrar al **último admin**.

---

## PASO 1 — 👤 Crear cuenta de Resend (correos)

1. Entra a <https://resend.com> y regístrate (plan gratis: 3.000 correos/mes).
2. **Add Domain** → `lefcenter.com`.
3. Resend te da unos registros DNS (SPF, DKIM, y opcional DMARC). Agrégalos donde
   administras el DNS de `lefcenter.com` (el mismo panel donde apunta a Vercel).
   Espera a que Resend marque el dominio como **Verified** (minutos a un par de horas).
4. **API Keys** → **Create API Key** (permiso *Sending access*). Cópiala
   (`re_...`) — la necesitas en el PASO 4.
5. Decide la dirección remitente, por ejemplo `acceso@lefcenter.com`.
   (No hace falta crear el buzón; solo tiene que ser del dominio verificado.)

---

## PASO 2 — 👤 Crear la clave de Cloudflare Turnstile (CAPTCHA)

1. Entra a <https://dash.cloudflare.com> → **Turnstile** → **Add widget**.
2. Nombre: `LEF login`. **Domains**: `www.lefcenter.com`, `lefcenter.com`,
   `lef-center.vercel.app`. Widget mode: **Managed**.
3. Te da dos claves:
   - **Site Key** (pública) → va en `supabase-config.js` (PASO 7).
   - **Secret Key** (privada) → va en el panel de Supabase (PASO 6).

---

## PASO 3 — 👤 Aplicar las migraciones SQL

Como siempre: SQL Editor de <https://supabase.com/dashboard> (proyecto
`lef-center-prod`) o el script Node. **En este orden**:

1. `supabase/migrations/20260906120000_seguridad_profiles_rls.sql`
2. `supabase/migrations/20260906130000_seguridad_cuentas.sql`
3. `supabase/migrations/20260906140000_preinscripciones.sql`
   *(cambio del formulario público → lista de "Pre-inscritos"; ver estado.md §📋.
   No es de seguridad, pero se aplica en el mismo lote y debe ir antes del deploy.)*

> Después de aplicar la 1ª, la **subida de foto de perfil** del portal deja de
> funcionar hasta que se despliegue el frontend nuevo (PASO 5). Es solo la foto.
> Después de la 3ª, el formulario público necesita el frontend nuevo (PASO 5)
> para funcionar — hasta entonces daría error al enviar.

Avísale a Claude cuando estén aplicadas.

---

## PASO 4 — 🤖 Secrets de Supabase para las Edge Functions

Claude corre (necesita los valores de los PASOS 1):

```
npx supabase secrets set --project-ref cemrxcatbxbcipxmsnjf \
  RESEND_API_KEY="re_..." \
  RESEND_FROM="LEF <acceso@lefcenter.com>" \
  ALLOWED_ORIGINS="https://www.lefcenter.com,https://lefcenter.com,https://lef-center.vercel.app" \
  LEF_LOGIN_URL="https://www.lefcenter.com/login"
```

---

## PASO 5 — 🤖 Desplegar frontend + Edge Functions

```
npx vercel deploy --prod --yes --scope lefcenter
npx supabase functions deploy manage-users  --project-ref cemrxcatbxbcipxmsnjf
npx supabase functions deploy wompi-checkout --project-ref cemrxcatbxbcipxmsnjf
```

(El webhook `wompi-webhook` no cambia.)

---

## PASO 6 — 👤 Ajustes en el panel de Supabase

`Dashboard → Authentication → …`

### Sign In / Providers → Email
- **Confirm email**: ON.
- **Secure email change**: ON.

### Sign Ups
- **Allow new users to sign up**: **OFF** (todas las cuentas las crea el admin).
- **Allow anonymous sign-ins**: OFF.

### Passwords
- **Minimum password length**: `12`.
- **Password Requirements**: *Lowercase, uppercase, digits and symbols*.
- **Leaked password protection**: **ON** (HaveIBeenPwned).

### Multi-Factor Authentication (MFA)
- **TOTP (App Authenticator)**: **Enabled**.
  (Puede estar bajo "Advanced" / "MFA". Deja habilitado al menos TOTP.)

### Sessions
- **Time-box user sessions**: `8 hours` (staff) — si solo hay un valor global,
  usa `24 hours`.
- **Inactivity timeout**: `2 hours`.
- **Refresh token rotation**: ON. **Reuse interval**: `10` s.

### Advanced / JWT
- **Access token (JWT) expiry**: `1800` (segundos).

### Bot and Abuse Protection → CAPTCHA
- **Enable CAPTCHA protection**: ON.
- **Provider**: **Turnstile**.
- **Secret key**: la *Secret Key* del PASO 2.

### Rate Limits
- Baja **Sign in / Sign up** a `~10` por hora por IP.
- Baja **Token refresh** y **Verify** a valores conservadores (deja margen: el
  refresh legítimo ocurre cada ~30 min por sesión).

### SMTP (para los correos de recuperación de Supabase)
`Authentication → Emails → SMTP Settings` → **Enable Custom SMTP**:
- Host: `smtp.resend.com`  ·  Port: `465`  ·  User: `resend`
- Password: la **API Key de Resend** (`re_...`, la misma del PASO 4)
- Sender email: `acceso@lefcenter.com`  ·  Sender name: `LEF`

---

## PASO 7 — 🤖 Poner la Site Key de Turnstile y redeploy

Claude edita `supabase-config.js`:

```js
window.LEF_AUTH_CONFIG = { turnstileSiteKey: "0x4AAAA..." };
```

y vuelve a desplegar el frontend. (Mientras esté vacía, el login funciona sin
CAPTCHA — por eso este paso va al final.)

---

## PASO 8 — 👤 Probar

1. **Escalada de privilegios cerrada**: entra al portal como estudiante de prueba,
   abre la consola del navegador y ejecuta
   `await lefSupabase.from('profiles').update({role:'admin'}).eq('user_id', (await lefSupabase.auth.getUser()).data.user.id)`.
   Debe fallar (permiso denegado). Antes funcionaba.
2. **Alta de cuenta**: crea una cuenta de estudiante de prueba → llega el correo de
   Resend con usuario + contraseña temporal → al entrar, obliga a crear contraseña
   personal (12+ con símbolo).
3. **2FA admin**: entra con la cuenta admin → obliga a escanear el QR y meter el
   código de 6 dígitos. Cierra sesión y vuelve a entrar → pide el código.
4. **Olvidé mi contraseña**: desde `/login`, enlace "¿Olvidaste tu contraseña?" →
   llega correo → `recuperar.html` deja fijar una nueva.
5. **CAPTCHA**: en `/login` aparece el widget de Cloudflare antes de "Ingresar".
6. **Auditoría**: en Supabase, `select * from audit_log order by at desc;` muestra
   las acciones de cuentas.
7. Borra la cuenta de prueba.

---

## Notas / límites conocidos

- **Recuperación de 2FA**: si un admin pierde su teléfono, otro admin **no** puede
  quitarle el factor desde el panel (la API de Supabase solo deja que cada quien
  gestione su propio MFA). Mitigación: mantener **siempre 2+ administradores**, o
  usar el enlace "¿olvidaste tu contraseña?" — al re-fijar contraseña por correo,
  Supabase puede pedir re-inscribir MFA. Para casos extremos, borrar el factor
  desde `auth.mfa_factors` en el SQL Editor.
- El correo de alta lleva una contraseña temporal en texto plano. Se acepta a
  propósito (flujo pedido por LEF), y se acota obligando a cambiarla en el primer
  ingreso — la temporal deja de servir apenas el usuario entra una vez.
- Los estudiantes **no** tienen 2FA obligatorio (ven pocos datos). Se puede subir
  a obligatorio cambiando `mfaRequiredRoles` en `assets/js/lef-security.js` y en
  los dos `enforce(...)` de `lef-portal.js` / `lef-admin.js`.
