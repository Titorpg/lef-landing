-- LEF — Pausar el ciclo de UN grupo (29 sep 2026, pedido del usuario).
--
-- La regla general no cambia: un día "Sin clase" (o festivo) consume su agenda
-- y el profesor la repone en otra fecha. Para recesos largos (p. ej. la semana
-- de receso de octubre) el "Sin clase" de un grupo puede además PAUSAR el ciclo
-- de ese grupo (calendar_events.pauses_cycle):
--   * Los días de clase en pausa no consumen agenda ni quedan por reponer: al
--     volver, el grupo sigue con la agenda que le tocaba.
--   * El fin del grupo se corre tantas CLASES como se pausaron, siguiendo su
--     horario (lef_group_end). El ciclo es compartido con otros grupos: solo se
--     extiende el grupo pausado; el ciclo se cierra cuando termina su último grupo.
--   * Solo para un grupo (nunca para toda la academia), todo el día y desde hoy
--     en adelante. Lo pueden hacer el admin y el profesor del grupo.
-- Todo se calcula (no se guarda la fecha de fin): si la pausa se edita o se
-- borra, la numeración y el fin se recalculan solos.

-- ============================================================================
-- 1. La marca de pausa
-- ============================================================================
alter table public.calendar_events add column if not exists pauses_cycle boolean not null default false;

alter table public.calendar_events drop constraint if exists calendar_events_pause;
alter table public.calendar_events add constraint calendar_events_pause check (
  not pauses_cycle
  or (category = 'sin_clase' and audience = 'group' and group_id is not null and start_time is null));

create index if not exists calendar_events_pause_idx on public.calendar_events (group_id) where pauses_cycle;

-- Una pausa no puede empezar en el pasado (renumeraría clases ya dictadas).
create or replace function public.calendar_events_pause_check()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.pauses_cycle and new.starts_on < public.lef_today() and (
       tg_op = 'INSERT' or not old.pauses_cycle
       or old.starts_on is distinct from new.starts_on
       or old.ends_on is distinct from new.ends_on
       or old.group_id is distinct from new.group_id) then
    raise exception 'LEF_PAUSE_PAST: la pausa del ciclo debe empezar hoy o después.';
  end if;
  return new;
end;
$$;

drop trigger if exists calendar_events_pause_check on public.calendar_events;
create trigger calendar_events_pause_check before insert or update on public.calendar_events
  for each row execute function public.calendar_events_pause_check();

-- ============================================================================
-- 2. Numeración y fin del grupo, descontando los días en pausa
-- ============================================================================
-- ¿Ese día el ciclo del grupo está en pausa?
create or replace function public.lef_group_paused(p_group uuid, p_date date)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.calendar_events x
    where x.pauses_cycle and x.group_id = p_group
      and p_date between x.starts_on and x.ends_on);
$$;

-- Clase n.º N del grupo en esa fecha (= agenda "DAY N"): días de su horario
-- desde el inicio del ciclo, sin contar los días en pausa.
create or replace function public.lef_group_session(p_group uuid, p_date date)
  returns integer language sql stable security definer set search_path = public as $$
  select case when c.start_date is null or p_date < c.start_date then 0 else (
    select count(*)::int
    from generate_series(c.start_date, p_date, interval '1 day') d
    where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from d)::int] = any(s.days)
      and not exists (
        select 1 from public.calendar_events x
        where x.pauses_cycle and x.group_id = g.id
          and d::date between x.starts_on and x.ends_on)) end
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  join public.cycles c on c.id = s.cycle_id
  where g.id = p_group;
$$;

-- Último día de clase del grupo: sin pausas, el fin del ciclo; con pausas, el
-- día de la clase n.º N (N = clases que tenía el ciclo), saltando las pausadas.
create or replace function public.lef_group_end(p_group uuid)
  returns date language sql stable security definer set search_path = public as $$
  with gr as (
    select g.id, s.days, c.start_date, c.end_date,
           (select count(*)
            from generate_series(c.start_date, c.end_date, interval '1 day') d
            where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
                  [extract(isodow from d)::int] = any(s.days)) as n
    from public.groups g
    join public.schedules s on s.id = g.schedule_id
    join public.cycles c on c.id = s.cycle_id
    where g.id = p_group
  )
  select case
    when gr.n = 0 or not exists (
      select 1 from public.calendar_events x where x.pauses_cycle and x.group_id = gr.id)
    then gr.end_date
    else greatest(gr.end_date, (
      select k.day from (
        select d::date as day, row_number() over (order by d) as rn
        from generate_series(gr.start_date, gr.end_date + 400, interval '1 day') d
        where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
              [extract(isodow from d)::int] = any(gr.days)
          and not exists (
            select 1 from public.calendar_events x
            where x.pauses_cycle and x.group_id = gr.id
              and d::date between x.starts_on and x.ends_on)) k
      where k.rn = gr.n)) end
  from gr;
$$;

revoke all on function public.lef_group_paused(uuid, date) from public, anon;
revoke all on function public.lef_group_session(uuid, date) from public, anon;
revoke all on function public.lef_group_end(uuid) from public, anon;
grant execute on function public.lef_group_paused(uuid, date) to authenticated, service_role;
grant execute on function public.lef_group_session(uuid, date) to authenticated, service_role;
grant execute on function public.lef_group_end(uuid) to authenticated, service_role;

-- ============================================================================
-- 3. Calendario: clases hasta el fin del grupo, numeración con pausas
-- ============================================================================
-- Columnas nuevas: paused (clase en un día de pausa / "Sin clase" que pausa) y
-- group_end (fin del grupo, para mostrar hasta cuándo se extiende).
drop function if exists public.get_my_calendar(date, date);
create or replace function public.get_my_calendar(p_from date, p_to date)
  returns table(
    item_type text, id uuid, title text, details text, category text,
    starts_on date, ends_on date, start_time time, end_time time,
    link_url text, audience text, group_id uuid, group_label text,
    module_number integer, author text, can_edit boolean, cancelled boolean,
    cycle_name text, student_count integer, session_number integer, makeup_of date,
    holiday text, holiday_blurb text, paused boolean, group_end date)
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
         hol.day is not null or exists (
           select 1 from public.calendar_events x
           where x.category = 'sin_clase'
             and d::date between x.starts_on and x.ends_on
             and (x.audience in ('students', 'all') or (x.audience = 'group' and x.group_id = g.id))),
         c.name::text,
         case when v_role <> 'student' then (
           select count(*)::int from public.enrollments e
           where e.group_id = g.id and e.status in ('PendingPayment', 'Active')) end,
         case when public.lef_group_paused(g.id, d::date) then null
              else public.lef_group_session(g.id, d::date) end,
         null::date,
         hol.name, hol.blurb,
         public.lef_group_paused(g.id, d::date),
         ge.fin
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  join public.cycles c      on c.id = sch.cycle_id
  join public.modules m     on m.id = g.module_id
  left join public.teachers t on t.id = g.teacher_id
  cross join lateral (select public.lef_group_end(g.id) as fin) ge
  cross join lateral generate_series(greatest(p_from, c.start_date), least(p_to, ge.fin), interval '1 day') d
  left join public.lef_holidays(p_from, p_to) hol on hol.day = d::date
  where g.id = any(v_groups)
    and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
        [extract(isodow from d)::int] = any(sch.days);

  return query
  select 'event'::text, md5('lef-festivo-' || hol.day::text)::uuid,
         hol.name, hol.blurb, 'festivo'::text,
         hol.day, hol.day, null::time, null::time,
         null::text, 'all'::text, null::uuid, null::text, null::int,
         'Colombia'::text, false, false, null::text, null::int, null::int, null::date,
         hol.name, hol.blurb, false, null::date
  from public.lef_holidays(p_from, p_to) hol;

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
         case when x.makeup_of is not null and g.id is not null then public.lef_group_session(g.id, x.makeup_of) end,
         x.makeup_of,
         mh.name, mh.blurb,
         x.pauses_cycle,
         case when x.pauses_cycle and g.id is not null then public.lef_group_end(g.id) end
  from public.calendar_events x
  left join public.groups g     on g.id = x.group_id
  left join public.modules m    on m.id = g.module_id
  left join public.teachers gt  on gt.id = g.teacher_id
  left join public.teachers au  on au.id = x.teacher_id
  left join lateral public.lef_holidays(x.makeup_of, x.makeup_of) mh on x.makeup_of is not null
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

  if v_role = 'student' then
    return query
    select 'event'::text, a.id,
           ('Examen de validación ' || xv.module_level)::text,
           ('Tu examen de validación está disponible del ' || to_char(a.opens_on, 'DD/MM/YYYY')
            || ' al ' || to_char(a.closes_on, 'DD/MM/YYYY')
            || '. Lo presentas en Mi curso → Clase de hoy. Tienes un solo intento.')::text,
           'examen'::text, a.opens_on, a.opens_on, null::time, null::time,
           null::text, 'group'::text, a.group_id,
           (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
           m.module_number, coalesce(t.full_name, 'LEF')::text, false, false,
           null::text, null::int, null::int, null::date, null::text, null::text, false, null::date
    from public.exam_assignments a
    join public.validation_exams xv on xv.id = a.exam_id
    join public.groups g on g.id = a.group_id
    join public.modules m on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where a.opens_on between p_from and p_to
      and public.lef_exam_targets(a.id, v_student);
  end if;

  if v_role = 'teacher' then
    return query
    select 'event'::text, md5('lef-revision-' || a.id::text)::uuid,
           'Revisión de exámenes pendiente'::text,
           ('Hoy se cierra el plazo del examen de validación ' || xv.module_level || ' del grupo '
            || public.lef_group_label(a.group_id) || '. Revisa las respuestas de cada estudiante, '
            || 'confirma su calificación y dale OK para que reciba su resultado.')::text,
           'revision_examen'::text, a.closes_on, a.closes_on, null::time, null::time,
           null::text, 'group'::text, a.group_id,
           (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
           m.module_number, 'LEF'::text, false, false,
           null::text, null::int, null::int, null::date, null::text, null::text, false, null::date
    from public.exam_assignments a
    join public.validation_exams xv on xv.id = a.exam_id
    join public.groups g on g.id = a.group_id
    join public.modules m on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where a.student_id is null and a.closes_on between p_from and p_to
      and g.id = any(v_groups);
  end if;
end;
$$;

revoke all on function public.get_my_calendar(date, date) from public, anon;
grant execute on function public.get_my_calendar(date, date) to authenticated;

-- ============================================================================
-- 4. Clases por reprogramar: los días en pausa NO se reponen
-- ============================================================================
drop function if exists public.get_my_pending_makeups();
create or replace function public.get_my_pending_makeups()
  returns table(group_id uuid, module_level text, module_title text, teacher_name text,
                class_date date, session_number integer, start_time time, end_time time,
                reason text, reason_details text,
                makeup_id uuid, makeup_date date, makeup_start time, makeup_end time,
                is_holiday boolean)
  language sql stable security definer set search_path = public as $$
  with gr as (
    select g.id, m.level, m.title, t.full_name, sch.days, sch.start_time, sch.end_time,
           c.start_date, public.lef_group_end(g.id) as end_date
    from public.groups g
    join public.schedules sch on sch.id = g.schedule_id
    join public.cycles c      on c.id = sch.cycle_id
    join public.modules m     on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where g.active
      and ((public.current_teacher_id() is not null and g.teacher_id = public.current_teacher_id()) or public.is_admin())
  ), hol as (
    select h.* from (select min(start_date) lo, max(end_date) hi from gr) r
    cross join lateral public.lef_holidays(r.lo, r.hi) h
    where r.lo is not null
  ), occ as (
    select gr.*, d::date as class_date
    from gr cross join lateral generate_series(gr.start_date, gr.end_date, interval '1 day') d
    where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from d)::int] = any(gr.days)
      and not public.lef_group_paused(gr.id, d::date)
  ), why as (
    select o.*,
           case when hl.day is not null then 'Día festivo: ' || hl.name else sc.title end as reason,
           case when hl.day is not null then hl.blurb else sc.details end as reason_details,
           hl.day is not null as is_holiday
    from occ o
    left join hol hl on hl.day = o.class_date
    left join lateral (
      select e.title, e.details from public.calendar_events e
      where e.category = 'sin_clase' and o.class_date between e.starts_on and e.ends_on
        and (e.audience in ('students', 'all') or (e.audience = 'group' and e.group_id = o.id))
      order by e.created_at limit 1) sc on true
    where hl.day is not null or sc.title is not null
  )
  select w.id, w.level, w.title, coalesce(w.full_name, ''), w.class_date,
         public.lef_group_session(w.id, w.class_date),
         w.start_time, w.end_time, w.reason, w.reason_details,
         mk.id, mk.starts_on, mk.start_time, mk.end_time, w.is_holiday
  from why w
  left join lateral (
    select r.id, r.starts_on, r.start_time, r.end_time from public.calendar_events r
    where r.category = 'reposicion' and r.group_id = w.id and r.makeup_of = w.class_date
    order by r.created_at desc limit 1) mk on true
  where mk.id is null or mk.starts_on >= public.lef_today()
  order by w.class_date, w.level;
$$;

revoke all on function public.get_my_pending_makeups() from public, anon;
grant execute on function public.get_my_pending_makeups() to authenticated;

-- ============================================================================
-- 5. Cierre del ciclo: espera a que termine su último grupo
-- ============================================================================
create or replace function public.close_ended_cycles()
  returns integer language plpgsql security definer set search_path = public as $$
declare v_c record; v_n integer := 0;
begin
  for v_c in
    select x.id, x.fin from (
      select c.id, greatest(c.end_date, (
               select max(public.lef_group_end(g.id))
               from public.groups g join public.schedules s on s.id = g.schedule_id
               where s.cycle_id = c.id)) as fin
      from public.cycles c) x
    where x.fin < public.lef_today()
    order by x.fin
  loop
    perform public.lef_finish_cycle(v_c.id,
      'Cierre automático: terminó la fecha del ciclo (' || to_char(v_c.fin, 'YYYY-MM-DD') || ').', null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.close_ended_cycles() from public, anon;
grant execute on function public.close_ended_cycles() to authenticated;

-- Foto de cada grupo al cerrar: con su fin real (extendido si tuvo pausa).
create or replace function public.lef_finish_cycle(p_cycle_id uuid, p_reason text, p_actor uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_cycle public.cycles%rowtype;
  v_ids uuid[];
  v_students jsonb;
  v_completed int; v_cancelled int; v_groups int; v_scheds int;
  v_email text;
begin
  select * into v_cycle from public.cycles where id = p_cycle_id for update skip locked;
  if not found then return; end if;

  select coalesce(array_agg(distinct e.id), '{}') into v_ids
  from public.enrollments e
  left join public.groups g on g.id = e.group_id
  left join public.schedules s on s.id = g.schedule_id
  where e.cycle_id = p_cycle_id or s.cycle_id = p_cycle_id;

  select jsonb_agg(jsonb_build_object('estudiante', st.full_name, 'modulo', m.level,
           'resultado', case e.status when 'Active' then 'completado' else 'cancelado (sin pago)' end))
    into v_students
  from public.enrollments e
  join public.students st on st.id = e.student_id
  join public.modules m on m.id = e.module_id
  where e.id = any(v_ids) and e.status in ('Active', 'PendingPayment');

  insert into public.group_history (group_id, teacher_id, teacher_name, module_id, module_level,
    module_title, module_number, days, start_time, end_time, capacity,
    cycle_name, cycle_start, cycle_end, students)
  select g.id, g.teacher_id, t.full_name, m.id, m.level, m.title, m.module_number,
         s.days, s.start_time, s.end_time, g.capacity,
         v_cycle.name, v_cycle.start_date, coalesce(public.lef_group_end(g.id), v_cycle.end_date),
         coalesce((select jsonb_agg(jsonb_build_object('student_id', st.id, 'name', st.full_name,
                     'result', case when e.status in ('Active', 'Completed') then 'completado' else 'cancelado' end)
                   order by st.full_name)
                   from public.enrollments e join public.students st on st.id = e.student_id
                   where e.group_id = g.id and e.status in ('Active', 'PendingPayment', 'Completed')), '[]'::jsonb)
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.modules m on m.id = g.module_id
  where s.cycle_id = p_cycle_id;

  update public.enrollments set status = 'Completed', completed_at = now()
    where id = any(v_ids) and status = 'Active';
  get diagnostics v_completed = row_count;

  update public.enrollments set status = 'Cancelled'
    where id = any(v_ids) and status = 'PendingPayment';
  get diagnostics v_cancelled = row_count;

  update public.enrollments set group_id = null, cycle_id = null
    where id = any(v_ids);

  delete from public.groups
    where schedule_id in (select id from public.schedules where cycle_id = p_cycle_id);
  get diagnostics v_groups = row_count;
  delete from public.schedules where cycle_id = p_cycle_id;
  get diagnostics v_scheds = row_count;
  delete from public.cycles where id = p_cycle_id;

  if p_actor is not null then
    select email into v_email from public.profiles where user_id = p_actor;
  end if;

  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (p_actor, v_email, 'cycle.finish', 'cycles', p_cycle_id, p_reason,
          jsonb_build_object(
            'ciclo', v_cycle.name, 'inicio', v_cycle.start_date, 'fin', v_cycle.end_date,
            'modulos_completados', v_completed, 'inscripciones_canceladas_sin_pago', v_cancelled,
            'grupos_eliminados', v_groups, 'horarios_eliminados', v_scheds,
            'estudiantes', coalesce(v_students, '[]'::jsonb)));
end;
$$;

revoke all on function public.lef_finish_cycle(uuid, text, uuid) from public, anon, authenticated;

-- ============================================================================
-- 6. "¿Sigue cursando?" y fechas del curso: con el fin del grupo
-- ============================================================================
create or replace function public.lef_student_has_current(p_student uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    left join public.cycles c on c.id = e.cycle_id
    cross join lateral (select coalesce(public.lef_group_end(e.group_id), c.end_date) as fin) f
    where e.student_id = p_student
      and (e.status = 'PendingPayment'
           or (e.status = 'Active' and (f.fin is null or f.fin >= public.lef_today()))));
$$;

create or replace function public.lef_next_module_for(p_student uuid)
  returns uuid language sql stable security definer set search_path = public as $$
  with done as (
    select e.module_id, m.module_number
    from public.enrollments e
    join public.modules m on m.id = e.module_id
    left join public.cycles c on c.id = e.cycle_id
    where e.student_id = p_student
      and (e.status = 'Completed'
           or (e.status = 'Active' and coalesce(public.lef_group_end(e.group_id), c.end_date) < public.lef_today()))
  )
  select m.id from public.modules m
  where m.active
    and m.module_number > (select max(module_number) from done)
    and m.id not in (select module_id from done)
  order by m.module_number limit 1;
$$;

revoke all on function public.lef_student_has_current(uuid) from public, anon, authenticated;
revoke all on function public.lef_next_module_for(uuid) from public, anon, authenticated;

drop function if exists public.get_my_course();
create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date,
    module_heyzine_url text, module_paid boolean, module_book_title text)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         case when e.status = 'Completed' then coalesce(sch.days, e.hist_days) else sch.days end,
         case when e.status = 'Completed' then coalesce(sch.start_time, e.hist_start_time) else sch.start_time end,
         case when e.status = 'Completed' then coalesce(sch.end_time, e.hist_end_time) else sch.end_time end,
         case when e.status = 'Completed' then coalesce(t.full_name, e.hist_teacher_name) else t.full_name end,
         case when e.status = 'Completed' then coalesce(c.start_date, e.hist_cycle_start) else c.start_date end,
         case when e.status = 'Completed' then coalesce(c.end_date, e.hist_cycle_end)
              else coalesce(public.lef_group_end(g.id), c.end_date) end,
         case when paid.ok then m.heyzine_url end,
         paid.ok,
         m.book_title
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

-- Copia histórica de la inscripción: el fin es el del grupo.
create or replace function public.enrollments_snapshot()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_completing boolean;
  r record;
begin
  if tg_op = 'INSERT' then
    v_completing := new.status = 'Completed';
  else
    v_completing := new.status = 'Completed' and old.status is distinct from 'Completed';
  end if;
  if new.status = 'Completed' and not v_completing then
    return new;
  end if;

  if new.group_id is not null then
    select sch.days, sch.start_time, sch.end_time, t.full_name into r
      from public.groups g
      join public.schedules sch on sch.id = g.schedule_id
      left join public.teachers t on t.id = g.teacher_id
      where g.id = new.group_id;
    if found then
      new.hist_days := r.days; new.hist_start_time := r.start_time;
      new.hist_end_time := r.end_time; new.hist_teacher_name := r.full_name;
    end if;
  elsif not v_completing then
    new.hist_days := null; new.hist_start_time := null;
    new.hist_end_time := null; new.hist_teacher_name := null;
  end if;

  if new.cycle_id is not null then
    select name, start_date, end_date into r from public.cycles where id = new.cycle_id;
    if found then
      new.hist_cycle_name := r.name; new.hist_cycle_start := r.start_date;
      new.hist_cycle_end := coalesce(public.lef_group_end(new.group_id), r.end_date);
    end if;
  elsif not v_completing then
    new.hist_cycle_name := null; new.hist_cycle_start := null; new.hist_cycle_end := null;
  end if;

  return new;
end;
$$;

-- Ciclo de un grupo (foto de los exámenes): con el fin del grupo.
create or replace function public.lef_group_cycle(p_group uuid)
  returns table(name text, start_date date, end_date date)
  language sql stable security definer set search_path = public as $$
  select c.name, c.start_date, coalesce(public.lef_group_end(g.id), c.end_date)
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  join public.cycles c on c.id = s.cycle_id
  where g.id = p_group;
$$;

revoke all on function public.lef_group_cycle(uuid) from public, anon, authenticated;
