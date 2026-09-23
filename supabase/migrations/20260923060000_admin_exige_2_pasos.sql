-- LEF — Parte 5b del endurecimiento del login (23 sep 2026): la base de datos
-- EXIGE la verificación en 2 pasos a los administradores.
--
-- Hasta aquí el bloqueo era solo de la interfaz (lef-mfa.js). Con esto, una
-- sesión de administrador que no pasó el código (aal1 en el token) no tiene
-- permisos de administrador en NINGUNA política RLS ni función: todas pasan
-- por is_admin() / is_teacher() (verificado: no hay chequeos de rol sueltos).
--
-- Profesores y estudiantes NO cambian (no tienen 2 pasos obligatorios).
-- create or replace conserva los grants existentes.

create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where user_id = auth.uid() and role = 'admin' and active)
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Un admin también cuenta como "staff" (is_teacher), pero solo con 2 pasos;
-- un profesor sigue igual que antes.
create or replace function public.is_teacher()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where user_id = auth.uid() and active
                   and (role = 'teacher'
                        or (role = 'admin' and coalesce(auth.jwt() ->> 'aal', '') = 'aal2')));
$$;
