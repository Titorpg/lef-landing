-- LEF — Cambio de contraseña obligatorio en el primer ingreso (parte 4 del
-- endurecimiento del login, 23 sep 2026).
--
-- Reemplaza SOLO la sección 1 de 20260906130000_seguridad_cuentas.sql, que
-- nunca se aplicó (su sección de audit_log choca con la tabla actual de
-- 20260906180000 — NO aplicar ese archivo).
--
-- Es aditiva y segura: todas las cuentas existentes quedan con
-- must_change_password = false, así que a nadie se le pide nada al aplicarla.
-- Solo se marca en true cuando el admin crea una cuenta o restablece una
-- contraseña desde el panel (Edge Function manage-users).

alter table public.profiles add column if not exists must_change_password boolean not null default false;
alter table public.profiles add column if not exists password_changed_at   timestamptz;

comment on column public.profiles.must_change_password is
  'true = la cuenta tiene una contraseña temporal puesta por LEF (cuenta nueva o '
  'restablecida desde el panel). El panel/portal obliga a crear una personal antes de seguir.';

-- La persona marca su propia contraseña como cambiada (tras auth.updateUser).
-- SECURITY DEFINER porque profiles no acepta UPDATE directo del usuario
-- (20260906120000: evita que alguien se auto-promueva a admin).
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

notify pgrst, 'reload schema';
