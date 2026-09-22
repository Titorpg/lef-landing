-- LEF — "Mis recursos" (portal): libro de estudio embebido vía Heyzine.
--
-- Pedido del usuario (21 sep 2026): nueva pestaña "Mis recursos" en el
-- portal, con los módulos que el estudiante ha cursado o cursa actualmente;
-- al entrar a un módulo se ven categorías (Libro de estudio, Talleres,
-- Recursos interactivos). Por ahora solo "Libro de estudio" tiene contenido
-- real: un enlace de Heyzine (heyzine.com) que el admin carga por módulo y
-- que el portal embebe en un iframe. Las demás categorías quedan vacías
-- ("próximamente") hasta que se decida cómo se van a montar.
--
-- get_my_course() es la fuente de datos que ya usa "Mi curso" (historial de
-- inscripciones del estudiante) — se le agrega la columna module_heyzine_url
-- para que "Mis recursos" pueda reusarla sin una función aparte.

alter table public.modules add column if not exists heyzine_url text;

create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date,
    module_heyzine_url text)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         sch.days, sch.start_time, sch.end_time,
         t.full_name, c.start_date, c.end_date,
         m.heyzine_url
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

grant execute on function public.get_my_course() to authenticated;
