# LEF — Seguridad del inicio de sesión (estado real)

Actualizado: 23 de septiembre de 2026. El plan original del 6 sep (paquete
`3d737a4`) rompió el login y se revirtió; todo se rehízo **por partes, probando
cada una**. El historial de ese plan queda en git.

## Qué está en vivo

| Qué | Dónde |
|---|---|
| Nadie puede auto-promoverse a admin (RLS de `profiles` sin UPDATE directo) | migraciones `20260906120000`, `20260906200000` |
| CAPTCHA Cloudflare Turnstile en login y en "¿Olvidaste tu contraseña?" | `assets/js/lef-auth.js`, secret en Supabase |
| Política de contraseñas: 12+ con mayúscula, minúscula, número y símbolo (leaked-password NO: requiere plan Pro) | Supabase Auth + `lef-password.js` (validación, ojito, contador) |
| Correo de credenciales al crear/restablecer cuenta (opcional, casilla) | `supabase/functions/manage-users`, Resend |
| Correos con diseño LEF (cuenta nueva, recuperar, "contraseña cambiada") | `supabase/functions/_shared/email-layout.ts`, `supabase/templates/` |
| SMTP de Supabase por Resend, `site_url` = https://www.lefcenter.com | `supabase/templates/apply-auth-templates.mjs` |
| "¿Olvidaste tu contraseña?" → `/recuperar` | `lef-auth.js`, `lef-recuperar.js` |
| Cambio de contraseña obligatorio en el primer ingreso | migración `20260923050000`, `lef-primer-ingreso.js` |
| Verificación en 2 pasos (TOTP) obligatoria para administradores, exigida también por la BD y `manage-users` | `lef-mfa.js`, migración `20260923060000` |
| Correo único por cuenta; cambio de rol real (desliga lo del rol anterior) | `manage-users` |

## Recuperar acceso

- **Un admin perdió el celular:** el otro admin → Usuarios → "Restablecer 2 pasos".
  Al entrar, lo vuelve a activar.
- **Olvidó la contraseña:** "¿Olvidaste tu contraseña?" en el login (si tiene 2
  pasos, `/recuperar` le pide el código antes).
- **Ambos admins sin acceso:** desde el servidor (service role) borrar los
  factores MFA: `DELETE /auth/v1/admin/users/{id}/factors/{factor_id}`.

## Reglas para cambios futuros

- Un cambio a la vez, desplegar, probar con el usuario, recién después el siguiente.
- La config de Auth y el SQL de producción los aplica el usuario (SQL Editor o
  `node --no-warnings scripts/apply-migration.mjs <archivo>`).
- Código que funcione aunque la migración aún no esté aplicada.

## No implementado (decisiones o pendientes)

- CORS de las Edge Functions sigue abierto (`*`); protegen con JWT + rol.
- No hay bitácora de acciones sobre cuentas (el Registro de eventos es de pagos).
- Leaked-password protection: no (plan Pro de Supabase).
