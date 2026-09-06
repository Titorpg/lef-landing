-- LEF — Endurecimiento del inicio de sesión (parte de base de datos).
-- Acompaña a los cambios en el Edge Function `manage-users` y en el frontend
-- (login con CAPTCHA + MFA, cambio de contraseña obligatorio en el primer ingreso,
-- "¿olvidaste tu contraseña?", registro de auditoría).
--
-- Requiere haber aplicado antes: 20260906120000_seguridad_profiles_rls.sql

-- ============================================================================
-- 1. profiles: marca de "debe cambiar la contraseña" + fecha del último cambio
-- ============================================================================
alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists password_changed_at   timestamptz;

comment on column public.profiles.must_change_password is
  'true = la cuenta entró con una contraseña generada por LEF y aún no la ha cambiado. '
  'El portal/panel obliga a fijar una personal antes de dejar usar nada más.';

-- El estudiante/staff marca su propia contraseña como cambiada (tras updateUser).
-- SECURITY DEFINER: profiles ya no acepta UPDATE directo (ver 20260906120000).
create or replace function public.mark_my_password_changed()
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no_autenticado';
  end if;
  update public.profiles
     set must_change_password = false,
         password_changed_at   = now()
   where user_id = auth.uid();
end;
$$;

revoke all on function public.mark_my_password_changed() from public, anon;
grant execute on function public.mark_my_password_changed() to authenticated;

-- ============================================================================
-- 2. audit_log — bitácora de acciones sensibles sobre cuentas
--    La escribe SOLO el Edge Function `manage-users` (service_role, salta RLS).
--    La lee SOLO el admin.
-- ============================================================================
create table if not exists public.audit_log (
  id             bigint generated always as identity primary key,
  at             timestamptz not null default now(),
  actor_user_id  uuid,
  actor_email    text,
  action         text not null,
  target_user_id uuid,
  target_email   text,
  detail         jsonb,
  ip             text
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;

drop policy if exists "admin lee audit_log" on public.audit_log;
create policy "admin lee audit_log" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- Sin políticas de INSERT/UPDATE/DELETE para `authenticated`: la bitácora es
-- append-only y solo la escribe el service_role.
revoke insert, update, delete on public.audit_log from authenticated, anon;

-- ============================================================================
-- 3. Recordatorio operativo (no ejecuta nada)
--    - En el panel de Supabase hay que activar aparte (ver SEGURIDAD.md):
--        Auth → Providers → Email  : "Confirm email" ON, registro público OFF
--        Auth → Passwords          : longitud 12 + clases de caracteres, leaked password ON
--        Auth → MFA                : TOTP habilitado
--        Auth → Sessions           : time-box + inactivity timeout
--        Auth → Rate limits        : bajar sign-in / OTP / verify
--        Auth → Bot protection     : Cloudflare Turnstile (secret key)
--        Auth → SMTP               : Resend (host smtp.resend.com)
-- ============================================================================
