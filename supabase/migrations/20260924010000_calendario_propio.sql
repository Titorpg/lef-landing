-- LEF — calendario propio de la plataforma (reemplaza a Google Calendar).
--
-- Pedido del usuario (24 sep 2026): programar en Google Calendar y traerlo al
-- panel era complicado. Ahora el calendario vive en LEF, con tres vistas:
--
--   * Profesor: ve sus clases (salen solas de sus grupos: días + hora del
--     horario, entre las fechas del ciclo) y puede anotar cosas de clase,
--     dirigidas a "solo para mí" o a UNO de sus grupos.
--   * Estudiante: SOLO LECTURA. Ve las clases del grupo en que está
--     matriculado, lo que su profesor le programe a ese grupo y lo que el
--     admin publique para estudiantes o para todos.
--   * Admin: ve todas las clases y todo lo publicado (menos las notas
--     personales de cada profesor) y publica para todos, solo profesores,
--     solo estudiantes, un grupo, o solo para él.
--
-- Las clases NO se guardan como filas: se calculan al vuelo desde
-- groups → schedules → cycles, así una matrícula nueva, un cambio de horario o
-- el cierre del ciclo se reflejan solos. Un evento tipo "sin_clase" (festivo,
-- clase cancelada) dirigido a estudiantes/todos o al grupo marca esas clases
-- como canceladas en el calendario.
--
-- Seguridad (ver feedback de RLS/UPDATE): created_by y teacher_id los pone un
-- trigger y no se pueden cambiar; el profesor solo escribe filas suyas, con
-- público "personal" o un grupo que sea SUYO; el estudiante no toca la tabla
-- (lee por get_my_calendar()).

-- ============================================================================
-- 1. Tabla
-- ============================================================================
create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(trim(title)) between 2 and 140),
  details     text not null default '' check (char_length(details) <= 2000),
  category    text not null default 'actividad'
              check (category in ('actividad', 'evaluacion', 'evento', 'aviso', 'sin_clase')),
  starts_on   date not null,
  ends_on     date not null,
  start_time  time,           -- null = todo el día
  end_time    time,
  link_url    text check (link_url is null or link_url ~ '^https://'),
  audience    text not null
              check (audience in ('personal', 'group', 'teachers', 'students', 'all')),
  group_id    uuid references public.groups(id) on delete cascade,
  teacher_id  uuid references public.teachers(id) on delete cascade, -- autor, si es profesor
  created_by  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_dates  check (ends_on >= starts_on and ends_on - starts_on <= 90),
  constraint calendar_events_times  check (
    (start_time is null and end_time is null) or
    (start_time is not null and ends_on = starts_on and (end_time is null or end_time > start_time))),
  constraint calendar_events_group  check ((audience = 'group') = (group_id is not null))
);

create index if not exists calendar_events_range_idx on public.calendar_events (starts_on, ends_on);
create index if not exists calendar_events_group_idx on public.calendar_events (group_id);

-- ============================================================================
-- 2. Autor fijo: lo pone el servidor, no el navegador
-- ============================================================================
create or replace function public.calendar_events_stamp()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.teacher_id := case when public.is_admin() then null else public.current_teacher_id() end;
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.teacher_id := old.teacher_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists calendar_events_stamp on public.calendar_events;
create trigger calendar_events_stamp before insert or update on public.calendar_events
  for each row execute function public.calendar_events_stamp();

-- Grupos activos del profesor que está conectado.
create or replace function public.my_teacher_group_ids()
  returns setof uuid language sql stable security definer set search_path = public as $$
  select g.id from public.groups g
  where g.teacher_id = public.current_teacher_id() and g.active;
$$;
revoke all on function public.my_teacher_group_ids() from public, anon;
grant execute on function public.my_teacher_group_ids() to authenticated;

-- ============================================================================
-- 3. RLS
-- ============================================================================
alter table public.calendar_events enable row level security;

-- Admin: todo, menos las notas personales de otras personas.
drop policy if exists "admin gestiona calendario" on public.calendar_events;
create policy "admin gestiona calendario" on public.calendar_events
  for all to authenticated
  using (public.is_admin() and (audience <> 'personal' or created_by = auth.uid()))
  with check (public.is_admin() and (audience <> 'personal' or created_by = auth.uid()));

-- Profesor: lee lo suyo, lo dirigido a profesores/todos, lo de sus grupos y
-- los "sin clase" de los estudiantes (festivos: si no, vería su clase tachada
-- sin saber por qué).
drop policy if exists "profesor lee calendario" on public.calendar_events;
create policy "profesor lee calendario" on public.calendar_events
  for select to authenticated
  using (public.current_teacher_id() is not null and (
    created_by = auth.uid()
    or audience in ('teachers', 'all')
    or (audience = 'students' and category = 'sin_clase')
    or (audience = 'group' and group_id in (select public.my_teacher_group_ids()))));

-- Profesor: escribe solo filas suyas, para él o para un grupo SUYO.
drop policy if exists "profesor crea en su calendario" on public.calendar_events;
create policy "profesor crea en su calendario" on public.calendar_events
  for insert to authenticated
  with check (public.current_teacher_id() is not null
    and audience in ('personal', 'group')
    and (group_id is null or group_id in (select public.my_teacher_group_ids())));

drop policy if exists "profesor edita su calendario" on public.calendar_events;
create policy "profesor edita su calendario" on public.calendar_events
  for update to authenticated
  using (public.current_teacher_id() is not null and created_by = auth.uid())
  with check (public.current_teacher_id() is not null and created_by = auth.uid()
    and audience in ('personal', 'group')
    and (group_id is null or group_id in (select public.my_teacher_group_ids())));

drop policy if exists "profesor borra de su calendario" on public.calendar_events;
create policy "profesor borra de su calendario" on public.calendar_events
  for delete to authenticated
  using (public.current_teacher_id() is not null and created_by = auth.uid());

-- ============================================================================
-- 4. Lo que ve cada quien en un rango de fechas (clases + eventos)
-- ============================================================================
create or replace function public.get_my_calendar(p_from date, p_to date)
  returns table(
    item_type text, id uuid, title text, details text, category text,
    starts_on date, ends_on date, start_time time, end_time time,
    link_url text, audience text, group_id uuid, group_label text,
    module_number integer, author text, can_edit boolean, cancelled boolean)
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

  -- Grupos cuyas clases se muestran.
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

  -- Clases: cada día del horario dentro de las fechas del ciclo.
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
             and (x.audience in ('students', 'all') or (x.audience = 'group' and x.group_id = g.id)))
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  join public.cycles c      on c.id = sch.cycle_id
  join public.modules m     on m.id = g.module_id
  left join public.teachers t on t.id = g.teacher_id
  cross join lateral generate_series(greatest(p_from, c.start_date), least(p_to, c.end_date), interval '1 day') d
  where g.id = any(v_groups)
    and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
        [extract(isodow from d)::int] = any(sch.days);

  -- Eventos publicados.
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
         false
  from public.calendar_events x
  left join public.groups g    on g.id = x.group_id
  left join public.modules m   on m.id = g.module_id
  left join public.teachers gt on gt.id = g.teacher_id
  left join public.teachers au on au.id = x.teacher_id
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
