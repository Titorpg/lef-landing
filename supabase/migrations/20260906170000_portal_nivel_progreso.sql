-- LEF — El portal del estudiante debe mostrar, grande y claro: el NIVEL en
-- el que está matriculado, el módulo/ciclo activo, y una barra de progreso
-- del ciclo actual (según sus fechas de inicio/fin). En Facturación debe
-- verse igual de claro el nivel + módulo + precio.
--
-- get_my_course() cambia su forma de retorno (agrega module_number y las
-- fechas del ciclo) -> hay que soltarla primero (Postgres no deja CREATE OR
-- REPLACE si cambia la lista de columnas de un "returns table").
drop function if exists public.get_my_course();

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
  order by e.created_at desc
  limit 1;
$$;

revoke all on function public.get_my_course() from public, anon;
grant execute on function public.get_my_course() to authenticated;

-- get_my_billing() sigue devolviendo jsonb (mismo tipo), solo se enriquece
-- cada suscripción con el nivel/título del módulo -> no hace falta soltarla.
create or replace function public.get_my_billing()
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'student', (select to_jsonb(s) from (
        select st.full_name, st.email, st.whatsapp, st.age, st.city from public.students st
        where st.id = public.current_student_id()) s),
    'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', sub.id, 'monthly_amount', sub.monthly_amount, 'currency', sub.currency,
          'status', sub.status, 'next_due_date', sub.next_due_date, 'billing_day', sub.billing_day,
          'grace_days', sub.grace_days, 'started_at', sub.started_at, 'description', sub.description,
          'module_id', sub.module_id, 'module_level', m.level, 'module_title', m.title
        ) order by sub.created_at)
        from public.subscriptions sub
        left join public.modules m on m.id = sub.module_id
        where sub.student_id = public.current_student_id()
      ), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc)
        from public.payments p where p.student_id = public.current_student_id()), '[]'::jsonb)
  );
$$;
