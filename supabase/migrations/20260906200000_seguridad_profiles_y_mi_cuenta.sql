-- LEF — Corrige la escalada de privilegios en profiles (pieza aislada del
-- endurecimiento del login, que sigue en pausa por Resend/Turnstile) y
-- habilita que admin/profesor cambien su propio nombre y foto, como ya
-- podía hacer el estudiante.
--
-- PROBLEMA (introducido en 20260831190000, documentado en memoria del
-- proyecto): la política "edita su propio profile" daba UPDATE sin
-- restringir columnas -> cualquier usuario autenticado podía hacer
-- `update profiles set role='admin' where user_id=<su propio id>` y
-- quedar como admin. Se cierra revocando UPDATE directo y dejando solo dos
-- funciones SECURITY DEFINER acotadas a una columna cada una.

drop policy if exists "edita su propio profile" on public.profiles;
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;

-- update_my_avatar — acepta una URL real del bucket de Storage, o uno de los
-- 6 avatares de caricatura fijos que sirve el sitio estático.
create or replace function public.update_my_avatar(p_url text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if p_url is null or not (
       p_url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
    or p_url in ('assets/avatars/m1.svg','assets/avatars/m2.svg','assets/avatars/m3.svg',
                 'assets/avatars/f1.svg','assets/avatars/f2.svg','assets/avatars/f3.svg')
  ) then
    raise exception 'url_invalida';
  end if;
  update public.profiles set avatar_url = p_url where user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_avatar(text) from public, anon;
grant execute on function public.update_my_avatar(text) to authenticated;

-- update_my_name — cambia solo el nombre visible de la propia cuenta
-- (admin/profesor; el estudiante ya cambia el suyo vía update_my_profile,
-- que toca la tabla students, no profiles).
create or replace function public.update_my_name(p_full_name text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'no_autenticado'; end if;
  if coalesce(trim(p_full_name), '') = '' then raise exception 'LEF_MISSING_FIELDS'; end if;
  update public.profiles set full_name = trim(p_full_name) where user_id = auth.uid();
end;
$$;

revoke all on function public.update_my_name(text) from public, anon;
grant execute on function public.update_my_name(text) to authenticated;
