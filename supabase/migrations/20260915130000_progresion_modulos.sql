-- LEF — Progresión automática de módulos (historial de "Mi curso").
--
-- Hasta ahora admin_assign_module SIEMPRE reescribía la misma fila de
-- enrollments al cambiar el módulo de un estudiante (module_id, group_id,
-- cycle_id) — por eso "Mi curso" nunca podía mostrar qué módulos ya cursó:
-- en el momento de avanzarlo, se perdía el rastro del anterior.
--
-- Ahora, cuando el módulo REALMENTE cambia y la inscripción actual ya está
-- 'Active' (ya se activó con un pago), esa fila se archiva como 'Completed'
-- (con completed_at) y se crea una fila NUEVA para el módulo siguiente — así
-- el estudiante queda con más de una fila no cancelada al mismo tiempo.
-- Todo lo que contaba "inscripciones activas"/cupo con status <> 'Cancelled'
-- debe ahora excluir también 'Completed' (si no, los módulos ya cursados
-- inflarían cupos y KPIs). get_my_course() es la excepción: ahí SÍ se
-- necesita ver 'Completed' para armar el historial en el portal.
--
-- Si el módulo cambia pero la inscripción actual todavía está
-- 'PendingPayment' (nunca se activó), se sigue corrigiendo en el sitio como
-- antes — no tiene sentido archivar algo que nunca empezó.
--
-- Hallazgo de paso: editStudent (panel) llama admin_assign_module en CADA
-- guardado del modal, aunque el admin no haya tocado el módulo — y la
-- versión vieja de la función siempre limpiaba group_id/cycle_id, así que
-- cualquier edición (ej. corregir el teléfono) desasignaba al estudiante de
-- su grupo sin querer. La rama "módulo sin cambios -> no tocar nada" de
-- abajo corrige ese bug de paso.

-- 1. nuevo estado 'Completed' + fecha de cierre
alter table public.enrollments add column if not exists completed_at timestamptz;

alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('PendingPayment', 'Active', 'Completed', 'Cancelled'));

-- 2. el guardián de cupo también ignora los módulos ya completados
create or replace function public.enforce_group_capacity()
  returns trigger language plpgsql as $$
declare v_capacity int; v_count int;
begin
  if new.status in ('Cancelled', 'Completed') or new.group_id is null then
    return new;
  end if;
  select capacity into v_capacity from public.groups where id = new.group_id for update;
  select count(*) into v_count
  from public.enrollments
  where group_id = new.group_id and status not in ('Cancelled', 'Completed')
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_count + 1 > v_capacity then
    raise exception 'LEF_GROUP_FULL: el grupo % ya está lleno (%/%).', new.group_id, v_count, v_capacity;
  end if;
  return new;
end;
$$;

-- 3. conteos de cupo/inscritos excluyen los módulos ya completados
create or replace function public.module_enrollment_counts()
  returns table(module_id uuid, count bigint)
  language sql stable security definer set search_path = public as $$
  select m.id, count(e.id)
  from public.modules m
  left join public.enrollments e on e.module_id = m.id and e.status not in ('Cancelled', 'Completed')
  group by m.id;
$$;

create or replace function public.group_enrollment_counts()
  returns table(group_id uuid, count bigint)
  language sql stable security definer set search_path = public as $$
  select g.id, count(e.id)
  from public.groups g
  left join public.enrollments e on e.group_id = g.id and e.status not in ('Cancelled', 'Completed')
  group by g.id;
$$;

-- 4. asignación manual de grupo: no se puede tocar el grupo de un registro
--    histórico, y el cupo tampoco lo cuenta
create or replace function public.admin_assign_group(p_enrollment_id uuid, p_group_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_enr public.enrollments%rowtype;
  v_grp public.groups%rowtype;
  v_cycle_id uuid;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then raise exception 'LEF_ENROLLMENT_NOT_FOUND'; end if;
  if v_enr.status in ('Cancelled', 'Completed') then raise exception 'LEF_ENROLLMENT_CANCELLED'; end if;

  select * into v_grp from public.groups where id = p_group_id;
  if not found then raise exception 'LEF_GROUP_NOT_FOUND'; end if;
  if not v_grp.active then raise exception 'LEF_GROUP_INACTIVE'; end if;
  if v_enr.module_id <> v_grp.module_id then raise exception 'LEF_MODULE_MISMATCH'; end if;

  select count(*) into v_count from public.enrollments
    where group_id = p_group_id and status not in ('Cancelled', 'Completed');
  if v_count >= v_grp.capacity then raise exception 'LEF_GROUP_FULL'; end if;

  select sch.cycle_id into v_cycle_id from public.schedules sch where sch.id = v_grp.schedule_id;

  update public.enrollments set group_id = p_group_id, cycle_id = v_cycle_id
    where id = p_enrollment_id;
end;
$$;

create or replace function public.admin_unassign_group(p_enrollment_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  update public.enrollments set group_id = null, cycle_id = null
    where id = p_enrollment_id and status not in ('Cancelled', 'Completed');
  if not found then raise exception 'LEF_ENROLLMENT_NOT_FOUND'; end if;
end;
$$;

-- 5. admin_assign_module: archiva el módulo anterior como 'Completed' en vez
--    de reescribirlo, PERO solo cuando el módulo realmente cambia y la
--    inscripción actual ya estaba 'Active'. Si el módulo no cambió, no toca
--    nada (corrige el bug de editStudent desasignando el grupo sin querer).
create or replace function public.admin_assign_module(p_student_id uuid, p_module_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_current_module uuid; v_current_status text; v_reg text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then return null; end if;

  select id, module_id, status into v_enr, v_current_module, v_current_status
    from public.enrollments
    where student_id = p_student_id and status in ('PendingPayment', 'Active')
    order by created_at desc limit 1;

  if v_enr is not null then
    if v_current_module = p_module_id then
      return v_enr; -- sin cambios: nada que archivar ni reasignar
    end if;

    if v_current_status = 'Active' then
      update public.enrollments set status = 'Completed', completed_at = now() where id = v_enr;
      v_reg := public.next_registration_number();
      insert into public.enrollments (registration_number, student_id, module_id, status)
        values (v_reg, p_student_id, p_module_id, 'PendingPayment')
        returning id into v_enr;
      return v_enr;
    end if;

    -- 'PendingPayment' (nunca se activó): se corrige en el sitio, como antes
    update public.enrollments
      set module_id = p_module_id, group_id = null, cycle_id = null
      where id = v_enr;
    return v_enr;
  end if;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, p_student_id, p_module_id, 'PendingPayment')
    returning id into v_enr;
  return v_enr;
end;
$$;

-- 6. get_my_course(): ya no se corta a 1 fila — devuelve también el
--    historial de módulos 'Completed' (la más reciente primero, que
--    siempre es la actual porque se inserta después que la archivada).
create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         sch.days, sch.start_time, sch.end_time,
         t.full_name, c.start_date, c.end_date
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.cycles c on c.id = e.cycle_id
  where e.student_id = public.current_student_id()
    and e.status <> 'Cancelled'
  order by e.created_at desc;
$$;
