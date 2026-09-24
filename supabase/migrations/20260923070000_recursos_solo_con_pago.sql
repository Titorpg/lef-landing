-- LEF — El libro y los recursos de un módulo se abren SOLO cuando hay pago.
--
-- Reporte del usuario (23 sep 2026): estudiante nueva (Keidy Vergara) con su
-- mensualidad generada y SIN ningún pago ya veía el libro en "Mis recursos".
-- Su inscripción había quedado en 'Active' sin pago (el selector de estado de
-- Inicio → Inscripciones deja ponerla así a mano), y get_my_course() entregaba
-- el enlace de Heyzine a cualquier inscripción no cancelada — el portal solo
-- lo escondía mirando el estado, en el navegador.
--
-- Regla: el acceso lo decide el PAGO, no la etiqueta de estado.
--   1. lef_enrollment_paid(): ¿tiene esta inscripción al menos un pago
--      aprobado y no reversado? (mismo criterio que activa la inscripción en
--      record_payment / record_wompi_payment: cualquier abono > 0).
--   2. get_my_course() solo devuelve el enlace del libro si está pagada, y
--      trae la columna module_paid para que el portal bloquee "Mis recursos".
--   3. Una inscripción no puede quedar en 'Active' sin pago (ni a mano).
--   4. Corrige las que ya están 'Active' sin pago → 'PendingPayment'.

-- 1. ¿Inscripción pagada? ------------------------------------------------------
-- Mensualidades viejas sin enrollment_id caen al criterio por módulo (igual
-- que en record_payment).
create or replace function public.lef_enrollment_paid(p_enrollment_id uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.enrollments e
    join public.subscriptions sub
      on sub.student_id = e.student_id
     and (sub.enrollment_id = e.id
          or (sub.enrollment_id is null
              and (sub.module_id is null or sub.module_id = e.module_id)))
    join public.payments p on p.subscription_id = sub.id
    where e.id = p_enrollment_id
      and p.status = 'approved'
      and p.amount > 0
      and not exists (select 1 from public.payments r where r.reverses_payment = p.id)
  );
$$;

revoke all on function public.lef_enrollment_paid(uuid) from public, anon, authenticated;

-- 2. "Mi curso" / "Mis recursos" ----------------------------------------------
-- Cambian las columnas de retorno: hay que soltar la función primero (42P13).
drop function if exists public.get_my_course();

create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date,
    module_heyzine_url text, module_paid boolean)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         case when e.status = 'Completed' then coalesce(sch.days, e.hist_days) else sch.days end,
         case when e.status = 'Completed' then coalesce(sch.start_time, e.hist_start_time) else sch.start_time end,
         case when e.status = 'Completed' then coalesce(sch.end_time, e.hist_end_time) else sch.end_time end,
         case when e.status = 'Completed' then coalesce(t.full_name, e.hist_teacher_name) else t.full_name end,
         case when e.status = 'Completed' then coalesce(c.start_date, e.hist_cycle_start) else c.start_date end,
         case when e.status = 'Completed' then coalesce(c.end_date, e.hist_cycle_end) else c.end_date end,
         case when paid.ok then m.heyzine_url end,
         paid.ok
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  cross join lateral (select public.lef_enrollment_paid(e.id) as ok) paid
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.cycles c on c.id = e.cycle_id
  where e.student_id = public.current_student_id()
    and e.status <> 'Cancelled'
  order by e.created_at desc;
$$;

revoke all on function public.get_my_course() from public, anon;
grant execute on function public.get_my_course() to authenticated;

-- 3. 'Active' exige pago ------------------------------------------------------
-- record_payment / record_wompi_payment insertan el pago ANTES de activar, así
-- que pasan este control sin cambios.
create or replace function public.enrollments_active_needs_payment()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'Active'
     and (tg_op = 'INSERT' or old.status is distinct from 'Active')
     and not public.lef_enrollment_paid(new.id) then
    raise exception 'LEF_ENROLLMENT_NEEDS_PAYMENT';
  end if;
  return new;
end;
$$;

drop trigger if exists enrollments_active_needs_payment_trg on public.enrollments;
create trigger enrollments_active_needs_payment_trg
  before insert or update of status on public.enrollments
  for each row execute function public.enrollments_active_needs_payment();

-- 4. Corrige las que ya quedaron activas sin pago -----------------------------
update public.enrollments e set status = 'PendingPayment'
where e.status = 'Active'
  and not public.lef_enrollment_paid(e.id);
