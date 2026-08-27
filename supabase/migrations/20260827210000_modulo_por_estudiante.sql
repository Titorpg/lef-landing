-- LEF — el módulo es la unidad de "en qué está inscrito" un estudiante.
-- Permite inscripciones "solo módulo" (creadas a mano por el admin, sin grupo aún),
-- además de las del asistente (que sí traen grupo). El conteo por módulo del
-- dashboard y de la pestaña Módulos sale de aquí.

-- 1. group_id / cycle_id pasan a ser opcionales en enrollments
alter table public.enrollments alter column group_id drop not null;
alter table public.enrollments alter column cycle_id drop not null;

-- 2. el guardián de cupo ignora las inscripciones sin grupo
create or replace function public.enforce_group_capacity()
  returns trigger language plpgsql as $$
declare v_capacity int; v_count int;
begin
  if new.status = 'Cancelled' or new.group_id is null then
    return new;
  end if;
  select capacity into v_capacity from public.groups where id = new.group_id for update;
  select count(*) into v_count
  from public.enrollments
  where group_id = new.group_id and status <> 'Cancelled'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_count + 1 > v_capacity then
    raise exception 'LEF_GROUP_FULL: el grupo % ya está lleno (%/%).', new.group_id, v_count, v_capacity;
  end if;
  return new;
end;
$$;

-- 3. la suscripción se ata a un módulo (reemplaza la descripción libre)
alter table public.subscriptions
  add column if not exists module_id uuid references public.modules(id) on delete set null;

-- 4. asignar/actualizar el módulo de un estudiante (solo admin).
--    Si ya tiene inscripción activa, cambia su módulo (y suelta el grupo si tenía).
--    Si no, crea una inscripción "solo módulo" con número de matrícula.
create or replace function public.admin_assign_module(p_student_id uuid, p_module_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_reg text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then return null; end if;

  select id into v_enr from public.enrollments
    where student_id = p_student_id and status <> 'Cancelled'
    order by created_at desc limit 1;

  if v_enr is not null then
    update public.enrollments
      set module_id = p_module_id, group_id = null, cycle_id = null
      where id = v_enr;
    return v_enr;
  end if;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, p_student_id, p_module_id, 'Pending')
    returning id into v_enr;
  return v_enr;
end;
$$;

-- 5. conteo de inscripciones activas por módulo (para dashboard y pestaña Módulos)
create or replace function public.module_enrollment_counts()
  returns table(module_id uuid, count bigint)
  language sql stable security definer set search_path = public as $$
  select m.id, count(e.id)
  from public.modules m
  left join public.enrollments e on e.module_id = m.id and e.status <> 'Cancelled'
  group by m.id;
$$;

revoke all on function public.admin_assign_module(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_module(uuid, uuid) to authenticated;
grant execute on function public.module_enrollment_counts() to authenticated;
