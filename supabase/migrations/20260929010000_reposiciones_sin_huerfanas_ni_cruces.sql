-- LEF — Reposiciones: sin huérfanas, sin festivos y sin cruces (29 sep 2026, pedido del usuario).
--
--  1. Si se borra un "Sin clase" (normal o que pausa el ciclo), o se editan sus
--     fechas y un día queda por fuera, esas clases vuelven a dictarse: sus
--     reposiciones se borran solas (salvo que ese día siga sin clase por otro
--     motivo, p. ej. festivo). Caso real: el "Sin clase" del 29 sep del grupo
--     A1.3 (cuentas de prueba) se borró y su reposición del 14 oct quedó viva.
--     Los correos de disculpa los manda la función remove-class-event.
--  2. Una reposición no se puede programar en un festivo ni cruzarse con otra
--     clase (normal o reposición) del mismo profesor. El Dashboard lo avisa en
--     el mismo recuadro (check_makeup_slot) y la base lo exige (trigger).

-- ============================================================================
-- 1. Reposiciones huérfanas
-- ============================================================================
-- ¿Esa clase del grupo sigue sin dictarse? (festivo o algún "Sin clase" que la cubra)
create or replace function public.lef_class_still_off(p_group uuid, p_date date)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lef_holidays(p_date, p_date))
      or exists (
        select 1 from public.calendar_events x
        where x.category = 'sin_clase'
          and p_date between x.starts_on and x.ends_on
          and (x.audience in ('students', 'all') or (x.audience = 'group' and x.group_id = p_group)));
$$;

create or replace function public.calendar_events_drop_orphan_makeups()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.calendar_events r
  where r.category = 'reposicion'
    and r.makeup_of between old.starts_on and old.ends_on
    and (old.audience in ('students', 'all') or r.group_id = old.group_id)
    and not public.lef_class_still_off(r.group_id, r.makeup_of);
  return null;
end;
$$;

drop trigger if exists calendar_events_drop_orphan_makeups on public.calendar_events;
create trigger calendar_events_drop_orphan_makeups
  after delete or update of starts_on, ends_on, audience, group_id, category on public.calendar_events
  for each row when (old.category = 'sin_clase')
  execute function public.calendar_events_drop_orphan_makeups();

-- Limpieza de las que ya quedaron huérfanas (solo las que aún no pasan).
delete from public.calendar_events r
where r.category = 'reposicion' and r.makeup_of is not null
  and r.starts_on >= public.lef_today()
  and not public.lef_class_still_off(r.group_id, r.makeup_of);

-- ============================================================================
-- 2. Reposición: ni en festivo ni cruzada con otra clase del profesor
-- ============================================================================
-- Devuelve null si la franja está libre; si no, el motivo:
--   {"reason":"holiday","holiday":"<nombre>"}
--   {"reason":"clash","kind":"clase"|"reposicion","level":"A2.1","start":"18:00","end":"19:00"}
-- Cuentan las clases normales de TODOS los grupos del profesor (y del propio
-- grupo) que sí se dictan ese día, y sus otras reposiciones.
create or replace function public.lef_makeup_conflict(p_group uuid, p_date date, p_start time, p_end time,
                                                      p_exclude uuid default null)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_teacher uuid;
  v_hol text;
  v_end time;
  r record;
begin
  if p_group is null or p_date is null then return null; end if;
  select h.name into v_hol from public.lef_holidays(p_date, p_date) h limit 1;
  if v_hol is not null then
    return jsonb_build_object('reason', 'holiday', 'holiday', v_hol);
  end if;
  if p_start is null then return null; end if;
  v_end := coalesce(p_end, p_start + interval '1 hour');
  select g.teacher_id into v_teacher from public.groups g where g.id = p_group;

  for r in
    select m.level, s.start_time as st, coalesce(s.end_time, s.start_time + interval '1 hour') as en
    from public.groups g
    join public.schedules s on s.id = g.schedule_id
    join public.cycles c on c.id = s.cycle_id
    join public.modules m on m.id = g.module_id
    where g.active
      and (g.id = p_group or (v_teacher is not null and g.teacher_id = v_teacher))
      and p_date between c.start_date and coalesce(public.lef_group_end(g.id), c.end_date)
      and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
          [extract(isodow from p_date)::int] = any(s.days)
      and not public.lef_class_still_off(g.id, p_date)
      and s.start_time < v_end
      and p_start < coalesce(s.end_time, s.start_time + interval '1 hour')
    order by s.start_time
  loop
    return jsonb_build_object('reason', 'clash', 'kind', 'clase', 'level', r.level,
                              'start', to_char(r.st, 'HH24:MI'), 'end', to_char(r.en, 'HH24:MI'));
  end loop;

  for r in
    select m.level, x.start_time as st, coalesce(x.end_time, x.start_time + interval '1 hour') as en
    from public.calendar_events x
    join public.groups g on g.id = x.group_id
    join public.modules m on m.id = g.module_id
    where x.category = 'reposicion' and x.starts_on = p_date
      and (p_exclude is null or x.id <> p_exclude)
      and (g.id = p_group or (v_teacher is not null and g.teacher_id = v_teacher))
      and x.start_time < v_end
      and p_start < coalesce(x.end_time, x.start_time + interval '1 hour')
    order by x.start_time
  loop
    return jsonb_build_object('reason', 'clash', 'kind', 'reposicion', 'level', r.level,
                              'start', to_char(r.st, 'HH24:MI'), 'end', to_char(r.en, 'HH24:MI'));
  end loop;
  return null;
end;
$$;

revoke all on function public.lef_class_still_off(uuid, date) from public, anon, authenticated;
revoke all on function public.lef_makeup_conflict(uuid, date, time, time, uuid) from public, anon, authenticated;

-- Para el Dashboard: solo el admin o el profesor del grupo.
create or replace function public.check_makeup_slot(p_group uuid, p_date date, p_start time, p_end time,
                                                    p_exclude uuid default null)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or exists (
            select 1 from public.groups g
            where g.id = p_group and public.current_teacher_id() is not null
              and g.teacher_id = public.current_teacher_id())) then
    return null;
  end if;
  return public.lef_makeup_conflict(p_group, p_date, p_start, p_end, p_exclude);
end;
$$;

revoke all on function public.check_makeup_slot(uuid, date, time, time, uuid) from public, anon;
grant execute on function public.check_makeup_slot(uuid, date, time, time, uuid) to authenticated;

-- La base lo exige al crear o mover una reposición.
create or replace function public.calendar_events_makeup_check()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if tg_op = 'UPDATE' and old.starts_on = new.starts_on
     and old.start_time is not distinct from new.start_time
     and old.end_time is not distinct from new.end_time
     and old.group_id is not distinct from new.group_id then
    return new;
  end if;
  v := public.lef_makeup_conflict(new.group_id, new.starts_on, new.start_time, new.end_time, new.id);
  if v is null then return new; end if;
  if v->>'reason' = 'holiday' then
    raise exception 'LEF_MAKEUP_HOLIDAY: no se puede programar la reposición el % porque es festivo (%).',
      to_char(new.starts_on, 'DD/MM/YYYY'), v->>'holiday';
  end if;
  raise exception 'LEF_MAKEUP_CLASH: no es posible programar en esa franja: ese día ya está % % de % a %.',
    case when v->>'kind' = 'reposicion' then 'la reposición de' else 'la clase' end,
    v->>'level', v->>'start', v->>'end';
end;
$$;

drop trigger if exists calendar_events_makeup_check on public.calendar_events;
create trigger calendar_events_makeup_check
  before insert or update on public.calendar_events
  for each row when (new.category = 'reposicion')
  execute function public.calendar_events_makeup_check();
