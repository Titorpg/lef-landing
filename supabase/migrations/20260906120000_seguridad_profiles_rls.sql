-- LEF — Corrección de seguridad: escalada de privilegios en public.profiles.
--
-- PROBLEMA (introducido en 20260831190000):
--   La política "edita su propio profile" permitía  UPDATE ... USING/CHECK (user_id = auth.uid()).
--   Como PostgREST concede UPDATE sobre TODAS las columnas al rol `authenticated`, cualquier
--   usuario con sesión podía hacer:
--       update profiles set role = 'admin' where user_id = <su propio id>;
--   y quedar como admin (is_admin() solo mira profiles.role), con acceso a toda la base.
--
-- ARREGLO:
--   1. Se elimina esa política y se REVOCA el UPDATE directo sobre profiles para
--      `authenticated` y `anon`. A partir de aquí profiles solo se modifica:
--        - desde el Edge Function `manage-users` (service_role: rol, activo, correo…), o
--        - vía funciones SECURITY DEFINER acotadas (el estudiante solo su avatar).
--   2. Nueva función `update_my_avatar(text)` para que el portal actualice SOLO avatar_url
--      de su propia fila. Reemplaza el `sb.from('profiles').update({avatar_url})` del portal.
--
-- Las políticas de SELECT ("lee su propio profile" / "admin gestiona profiles") NO cambian:
-- cada quien sigue viendo su fila y el admin todas.

-- ============================================================================
-- 1. Quitar la política laxa de UPDATE y revocar el privilegio directo
-- ============================================================================
drop policy if exists "edita su propio profile" on public.profiles;

revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- La política "admin gestiona profiles" (FOR ALL) sigue existiendo, pero sin el
-- GRANT de UPDATE ya no habilita UPDATE vía PostgREST ni para el admin. El admin
-- modifica cuentas por el Edge Function `manage-users`, que usa la service_role
-- key y no depende de estos grants. Lo dejamos así a propósito: ninguna ruta con
-- la llave pública puede escribir en profiles.

-- ============================================================================
-- 2. update_my_avatar — única vía para que el estudiante toque su fila
-- ============================================================================
create or replace function public.update_my_avatar(p_url text)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'no_autenticado';
  end if;

  -- Solo se acepta una URL del bucket público de avatares de este proyecto.
  if p_url is null
     or p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/' then
    raise exception 'url_invalida';
  end if;

  update public.profiles
     set avatar_url = p_url
   where user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_avatar(text) from public, anon;
grant execute on function public.update_my_avatar(text) to authenticated;

-- ============================================================================
-- 3. Barrido de seguridad: ninguna otra tabla debe tener el mismo patrón.
--    (Informativo — revisado a mano el 6 sep 2026)
--    students / teachers / groups / modules / schedules / cycles / enrollments:
--      solo tienen políticas de escritura para is_admin() / is_teacher().
--    subscriptions / payments: escritura solo para admin o service_role.
--    profiles: corregido arriba.
-- ============================================================================
