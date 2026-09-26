-- LEF — Festivos de Colombia fijos en todos los calendarios.
--
-- Pedido del usuario (26 sep 2026):
--   * Los festivos salen solos en el calendario de todos (admin, profesores y
--     estudiantes), con un mensaje corto de qué se celebra. Nadie los puede
--     crear, mover, editar ni borrar.
--   * Una clase que cae en festivo queda como un día "Sin clase" (mismo
--     mecanismo que cuando el profesor cancela): tachada en el calendario, con
--     el motivo "Día festivo", y pendiente por reprogramar en el Dashboard del
--     profesor desde que se crea el grupo. NO se envía correo por el festivo;
--     el correo sale solo cuando el profesor programa la reposición.
--
-- Regla legal (fuente oficial):
--   * Ley 51 de 1983 (Ley Emiliani), art. 1 — Función Pública:
--     https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=4954
--     Fijos: 1 ene, 1 may, 20 jul, 7 ago, 8 dic, 25 dic, Jueves y Viernes Santo.
--     Se corren al lunes siguiente (si no caen en lunes): 6 ene, 19 mar,
--     29 jun, 15 ago, 12 oct, 1 nov, 11 nov, Ascensión, Corpus Christi y
--     Sagrado Corazón.
--   * Ley 2578 del 1 de junio de 2026 — Ministerio del Interior: 9 de julio,
--     Virgen del Rosario de Chiquinquirá, también se corre al lunes (en 2026
--     cayó el lunes 13 de julio). Aplica desde 2026.
-- Se calculan (Pascua por el algoritmo gregoriano) en vez de copiarlos a mano:
-- así sirven para cualquier año. Verificado contra los calendarios publicados
-- de 2026 y 2027.

-- ============================================================================
-- 1. Festivos entre dos fechas
-- ============================================================================
-- Domingo de Pascua (algoritmo gregoriano anónimo).
create or replace function public.lef_easter(y int)
  returns date language plpgsql immutable as $$
declare a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
begin
  a := y % 19; b := y / 100; c := y % 100; d := b / 4; e := b % 4;
  f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
  i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
  return make_date(y, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
end;
$$;

-- move = se corre al lunes siguiente (Ley Emiliani). since = año desde el que aplica.
create or replace function public.lef_holidays(p_from date, p_to date)
  returns table(day date, name text, blurb text)
  language sql immutable set search_path = public as $$
  with yrs as (
    select y, public.lef_easter(y) as easter
    from generate_series(extract(year from p_from)::int,
                         least(extract(year from p_to)::int, extract(year from p_from)::int + 20)) y
    where p_from is not null and p_to is not null and p_to >= p_from
  ), raw as (
    select v.name, v.blurb, v.move,
           case when v.easter_off is not null then yrs.easter + v.easter_off else make_date(yrs.y, v.mon, v.dd) end as base
    from yrs
    cross join (values
      ('Año Nuevo',                  '¡Feliz año nuevo! Arrancamos el año con toda la energía.',               1,  1,  null::int, false, 0),
      ('Jueves Santo',               'Semana Santa: día de recogimiento en todo el país.',                    null, null, -3,     false, 0),
      ('Viernes Santo',              'Semana Santa: se conmemora la Pasión de Cristo.',                       null, null, -2,     false, 0),
      ('Día del Trabajo',            'Un homenaje a todas las personas que trabajan por el país.',            5,  1,  null,      false, 0),
      ('Día de la Independencia',    '¡Se celebra el Grito de Independencia del 20 de julio de 1810!',        7,  20, null,      false, 0),
      ('Batalla de Boyacá',          'Se recuerda la victoria de 1819 que selló la independencia.',           8,  7,  null,      false, 0),
      ('Inmaculada Concepción',      'Fiesta de la Inmaculada Concepción; la víspera es la Noche de Velitas.', 12, 8,  null,      false, 0),
      ('Navidad',                    '¡Feliz Navidad! Tiempo para compartir en familia.',                     12, 25, null,      false, 0),
      ('Día de los Reyes Magos',     'Se recuerda la visita de los Reyes Magos al niño Jesús.',               1,  6,  null,      true,  0),
      ('Día de San José',            'Día de San José, patrono de las familias y los trabajadores.',          3,  19, null,      true,  0),
      ('San Pedro y San Pablo',      'Se honra a los apóstoles Pedro y Pablo.',                               6,  29, null,      true,  0),
      ('Virgen de Chiquinquirá',     'Homenaje a la Virgen del Rosario de Chiquinquirá, patrona de Colombia.', 7,  9,  null,      true,  2026),
      ('Asunción de la Virgen',      'Fiesta de la Asunción de la Virgen María.',                             8,  15, null,      true,  0),
      ('Día de la Diversidad Étnica y Cultural', 'Se celebra la riqueza étnica y cultural de Colombia (antes Día de la Raza).', 10, 12, null, true, 0),
      ('Día de Todos los Santos',    'Un día para recordar a todos los santos.',                              11, 1,  null,      true,  0),
      ('Independencia de Cartagena', 'Se celebra la independencia de Cartagena de 1811.',                     11, 11, null,      true,  0),
      ('Ascensión del Señor',        'Se celebra la Ascensión de Jesús al cielo.',                            null, null, 39,     true,  0),
      ('Corpus Christi',             'Fiesta del Cuerpo y la Sangre de Cristo.',                              null, null, 60,     true,  0),
      ('Sagrado Corazón de Jesús',   'Colombia está consagrada al Sagrado Corazón de Jesús.',                 null, null, 68,     true,  0)
    ) v(name, blurb, mon, dd, easter_off, move, since)
    where yrs.y >= v.since
  ), moved as (
    select case when move then base + ((8 - extract(isodow from base)::int) % 7) else base end as day, name, blurb
    from raw
  )
  -- Si dos festivos caen el mismo día, se muestran juntos.
  select m.day, string_agg(m.name, ' y ' order by m.name), string_agg(m.blurb, ' ' order by m.name)
  from moved m
  where m.day between p_from and p_to
  group by m.day
  order by m.day;
$$;

revoke all on function public.lef_easter(int) from public, anon;
grant execute on function public.lef_easter(int) to authenticated, service_role;
revoke all on function public.lef_holidays(date, date) from public, anon;
grant execute on function public.lef_holidays(date, date) to authenticated, service_role;

-- ============================================================================
-- 2. Calendario: festivos para todos + clases de festivo tachadas
-- ============================================================================
-- Nuevas columnas: holiday / holiday_blurb (en una clase: el festivo que la
-- anula; en un festivo: su nombre y su mensaje).
drop function if exists public.get_my_calendar(date, date);
create or replace function public.get_my_calendar(p_from date, p_to date)
  returns table(
    item_type text, id uuid, title text, details text, category text,
    starts_on date, ends_on date, start_time time, end_time time,
    link_url text, audience text, group_id uuid, group_label text,
    module_number integer, author text, can_edit boolean, cancelled boolean,
    cycle_name text, student_count integer, session_number integer, makeup_of date,
    holiday text, holiday_blurb text)
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
         public.lef_session_number(sch.days, c.start_date, d::date),
         null::date,
         hol.name, hol.blurb
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  join public.cycles c      on c.id = sch.cycle_id
  join public.modules m     on m.id = g.module_id
  left join public.teachers t on t.id = g.teacher_id
  cross join lateral generate_series(greatest(p_from, c.start_date), least(p_to, c.end_date), interval '1 day') d
  left join public.lef_holidays(p_from, p_to) hol on hol.day = d::date
  where g.id = any(v_groups)
    and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
        [extract(isodow from d)::int] = any(sch.days);

  -- Festivos: para todos, de solo lectura (id fijo por fecha).
  return query
  select 'event'::text, md5('lef-festivo-' || hol.day::text)::uuid,
         hol.name, hol.blurb, 'festivo'::text,
         hol.day, hol.day, null::time, null::time,
         null::text, 'all'::text, null::uuid, null::text, null::int,
         'Colombia'::text, false, false, null::text, null::int, null::int, null::date,
         hol.name, hol.blurb
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
         case when x.makeup_of is not null then public.lef_session_number(sch.days, c.start_date, x.makeup_of) end,
         x.makeup_of,
         mh.name, mh.blurb
  from public.calendar_events x
  left join public.groups g     on g.id = x.group_id
  left join public.modules m    on m.id = g.module_id
  left join public.teachers gt  on gt.id = g.teacher_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.cycles c     on c.id = sch.cycle_id
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
end;
$$;

revoke all on function public.get_my_calendar(date, date) from public, anon;
grant execute on function public.get_my_calendar(date, date) to authenticated;

-- ============================================================================
-- 3. Clases por reprogramar: también las que caen en festivo
-- ============================================================================
-- Aparecen desde que el grupo existe (se calculan del horario y el ciclo), sin
-- correo. El motivo es "Día festivo: <nombre>". Si además hubiera un "Sin
-- clase" manual ese mismo día, manda el festivo (una sola fila).
drop function if exists public.get_my_pending_makeups();
create or replace function public.get_my_pending_makeups()
  returns table(group_id uuid, module_level text, module_title text, teacher_name text,
                class_date date, session_number integer, start_time time, end_time time,
                reason text, reason_details text,
                makeup_id uuid, makeup_date date, makeup_start time, makeup_end time,
                is_holiday boolean)
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
  ), hol as (
    select h.* from (select min(start_date) lo, max(end_date) hi from gr) r
    cross join lateral public.lef_holidays(r.lo, r.hi) h
    where r.lo is not null
  ), occ as (
    select gr.*, d::date as class_date
    from gr cross join lateral generate_series(gr.start_date, gr.end_date, interval '1 day') d
    where (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from d)::int] = any(gr.days)
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
         public.lef_session_number(w.days, w.start_date, w.class_date),
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
