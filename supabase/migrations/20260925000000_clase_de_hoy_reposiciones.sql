-- LEF — "Clase de hoy" por horario, clases canceladas y reposiciones, Meet.
--
-- Pedido del usuario (24 sep 2026):
--   * En Classroom las agendas de cada módulo están SIEMPRE publicadas (la
--     misma clase se reutiliza con cada grupo nuevo). LEF decide qué agenda ve
--     cada estudiante: la clase n.º N de su grupo, contando desde el inicio del
--     ciclo SOLO los días de su horario, le toca la agenda "DAY N".
--   * Un día marcado "Sin clase" igual consume su número (el ciclo no se
--     detiene) y esa clase queda pendiente: el profesor la reprograma desde su
--     Dashboard ("reposición"), y ese día y hora el estudiante ve la agenda que
--     se perdió.
--   * El botón de Meet lleva al Meet de la clase de Classroom, que el profesor
--     pega una vez en el Planificador (Google no lo entrega por la API).
--   * Se avisa por correo a los estudiantes cuando se cancela una clase y
--     cuando se programa su reposición (notified_at evita correos repetidos).

-- ============================================================================
-- 1. Reposiciones en el calendario
-- ============================================================================
alter table public.calendar_events add column if not exists makeup_of   date;        -- fecha de la clase que repone
alter table public.calendar_events add column if not exists notified_at timestamptz; -- correo ya enviado

alter table public.calendar_events drop constraint if exists calendar_events_category_check;
alter table public.calendar_events add constraint calendar_events_category_check
  check (category in ('actividad', 'evaluacion', 'evento', 'aviso', 'sin_clase', 'reposicion'));

alter table public.calendar_events drop constraint if exists calendar_events_makeup;
alter table public.calendar_events add constraint calendar_events_makeup check (
  category <> 'reposicion'
  or (audience = 'group' and group_id is not null and start_time is not null and makeup_of is not null));

-- El autor y el aviso por correo los controla el servidor (notified_at solo lo
-- escribe la función de correos, con la llave de servicio).
create or replace function public.calendar_events_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.teacher_id := case when public.is_admin() then null else public.current_teacher_id() end;
    new.created_at := now();
    new.notified_at := null;
  else
    new.created_by := old.created_by;
    new.teacher_id := old.teacher_id;
    new.created_at := old.created_at;
    if auth.uid() is not null then new.notified_at := old.notified_at; end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================================
-- 2. Número de clase: días del horario desde el inicio del ciclo (inclusive)
-- ============================================================================
create or replace function public.lef_session_number(p_days text[], p_start date, p_date date)
  returns integer language sql immutable as $$
  select case when p_start is null or p_date < p_start then 0 else (
    select count(*)::int
    from generate_series(p_start, p_date, interval '1 day') d
    where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from d)::int] = any(p_days)) end;
$$;

-- ============================================================================
-- 3. Calendario: cada clase trae su número (agenda "DAY N")
-- ============================================================================
drop function if exists public.get_my_calendar(date, date);
create or replace function public.get_my_calendar(p_from date, p_to date)
  returns table(
    item_type text, id uuid, title text, details text, category text,
    starts_on date, ends_on date, start_time time, end_time time,
    link_url text, audience text, group_id uuid, group_label text,
    module_number integer, author text, can_edit boolean, cancelled boolean,
    cycle_name text, student_count integer, session_number integer, makeup_of date)
  language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_teacher uuid;
  v_student uuid;
  v_groups  uuid[];
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'LEF_CALENDAR_RANGE';
  end if;

  select pr.role, pr.teacher_id, pr.student_id into v_role, v_teacher, v_student
  from public.profiles pr where pr.user_id = v_uid and pr.active;
  if v_role is null then return; end if;

  if v_role = 'admin' then
    select array_agg(g.id) into v_groups from public.groups g where g.active;
  elsif v_role = 'teacher' then
    select array_agg(g.id) into v_groups from public.groups g
    where g.active and g.teacher_id = v_teacher;
  else
    select array_agg(distinct e.group_id) into v_groups from public.enrollments e
    where e.student_id = v_student and e.group_id is not null
      and e.status in ('PendingPayment', 'Active');
  end if;
  v_groups := coalesce(v_groups, '{}');

  return query
  select 'class'::text, g.id,
         ('Clase ' || m.level)::text,
         m.title::text,
         'clase'::text,
         d::date, d::date, sch.start_time, sch.end_time,
         null::text, 'group'::text, g.id,
         (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
         m.module_number,
         coalesce(t.full_name, '')::text,
         false,
         exists (
           select 1 from public.calendar_events x
           where x.category = 'sin_clase'
             and d::date between x.starts_on and x.ends_on
             and (x.audience in ('students', 'all') or (x.audience = 'group' and x.group_id = g.id))),
         c.name::text,
         case when v_role <> 'student' then (
           select count(*)::int from public.enrollments e
           where e.group_id = g.id and e.status in ('PendingPayment', 'Active')) end,
         public.lef_session_number(sch.days, c.start_date, d::date),
         null::date
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  join public.cycles c      on c.id = sch.cycle_id
  join public.modules m     on m.id = g.module_id
  left join public.teachers t on t.id = g.teacher_id
  cross join lateral generate_series(greatest(p_from, c.start_date), least(p_to, c.end_date), interval '1 day') d
  where g.id = any(v_groups)
    and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
        [extract(isodow from d)::int] = any(sch.days);

  return query
  select 'event'::text, x.id, x.title, x.details, x.category,
         x.starts_on, x.ends_on, x.start_time, x.end_time,
         x.link_url, x.audience, x.group_id,
         case when x.group_id is not null
              then (m.level || ' · ' || coalesce(gt.full_name, 'Sin profesor')) end::text,
         m.module_number,
         case when x.teacher_id is not null then coalesce(au.full_name, 'Profesor') else 'LEF' end::text,
         case when v_role = 'admin' then true
              when v_role = 'teacher' then x.created_by = v_uid
              else false end,
         false,
         null::text,
         null::int,
         case when x.makeup_of is not null then public.lef_session_number(sch.days, c.start_date, x.makeup_of) end,
         x.makeup_of
  from public.calendar_events x
  left join public.groups g     on g.id = x.group_id
  left join public.modules m    on m.id = g.module_id
  left join public.teachers gt  on gt.id = g.teacher_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.cycles c     on c.id = sch.cycle_id
  left join public.teachers au  on au.id = x.teacher_id
  where x.starts_on <= p_to and x.ends_on >= p_from
    and (
      (v_role = 'admin' and (x.audience <> 'personal' or x.created_by = v_uid))
      or (v_role = 'teacher' and (
            x.created_by = v_uid
            or x.audience in ('teachers', 'all')
            or (x.audience = 'students' and x.category = 'sin_clase')
            or (x.audience = 'group' and x.group_id = any(v_groups))))
      or (v_role = 'student' and (
            x.audience in ('students', 'all')
            or (x.audience = 'group' and x.group_id = any(v_groups))))
    );
end;
$$;

revoke all on function public.get_my_calendar(date, date) from public, anon;
grant execute on function public.get_my_calendar(date, date) to authenticated;

-- ============================================================================
-- 4. Clases pendientes por reprogramar (Dashboard del profesor / admin)
-- ============================================================================
-- Cada día de clase del ciclo vigente que quedó "Sin clase" (para el grupo, o
-- para estudiantes/todos: festivos). Sigue apareciendo aunque ya tenga
-- reposición, hasta que pase la fecha de esa reposición.
create or replace function public.get_my_pending_makeups()
  returns table(group_id uuid, module_level text, module_title text, teacher_name text,
                class_date date, session_number integer, start_time time, end_time time,
                reason text, reason_details text,
                makeup_id uuid, makeup_date date, makeup_start time, makeup_end time)
  language sql stable security definer set search_path = public as $$
  with gr as (
    select g.id, m.level, m.title, t.full_name, sch.days, sch.start_time, sch.end_time, c.start_date, c.end_date
    from public.groups g
    join public.schedules sch on sch.id = g.schedule_id
    join public.cycles c      on c.id = sch.cycle_id
    join public.modules m     on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where g.active
      and ((public.current_teacher_id() is not null and g.teacher_id = public.current_teacher_id()) or public.is_admin())
  ), occ as (
    select gr.*, d::date as class_date
    from gr cross join lateral generate_series(gr.start_date, gr.end_date, interval '1 day') d
    where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from d)::int] = any(gr.days)
  )
  select o.id, o.level, o.title, coalesce(o.full_name, ''), o.class_date,
         public.lef_session_number(o.days, o.start_date, o.class_date),
         o.start_time, o.end_time, sc.title, sc.details,
         mk.id, mk.starts_on, mk.start_time, mk.end_time
  from occ o
  join lateral (
    select e.title, e.details from public.calendar_events e
    where e.category = 'sin_clase' and o.class_date between e.starts_on and e.ends_on
      and (e.audience in ('students', 'all') or (e.audience = 'group' and e.group_id = o.id))
    order by e.created_at limit 1) sc on true
  left join lateral (
    select r.id, r.starts_on, r.start_time, r.end_time from public.calendar_events r
    where r.category = 'reposicion' and r.group_id = o.id and r.makeup_of = o.class_date
    order by r.created_at desc limit 1) mk on true
  where mk.id is null or mk.starts_on >= public.lef_today()
  order by o.class_date, o.level;
$$;

revoke all on function public.get_my_pending_makeups() from public, anon;
grant execute on function public.get_my_pending_makeups() to authenticated;

-- ============================================================================
-- 5. Enlace de Meet de cada clase de Classroom (lo pega el profesor)
-- ============================================================================
create table if not exists public.classroom_meet_links (
  course_id   text primary key,
  meet_url    text not null check (meet_url ~ '^https://meet\.google\.com/[a-z0-9-]+'),
  teacher_id  uuid references public.teachers(id) on delete cascade,
  updated_at  timestamptz not null default now()
);

alter table public.classroom_meet_links enable row level security;

drop policy if exists "profesor gestiona su meet" on public.classroom_meet_links;
create policy "profesor gestiona su meet" on public.classroom_meet_links
  for all to authenticated
  using (public.current_teacher_id() is not null and teacher_id = public.current_teacher_id())
  with check (public.current_teacher_id() is not null and teacher_id = public.current_teacher_id());

drop policy if exists "admin gestiona meet" on public.classroom_meet_links;
create policy "admin gestiona meet" on public.classroom_meet_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
