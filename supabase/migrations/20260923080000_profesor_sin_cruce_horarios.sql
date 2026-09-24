-- LEF — Un profesor no puede tener dos grupos activos que se crucen.
--
-- Pedido del usuario (23 sep 2026): si un profesor ya tiene, p. ej., un grupo
-- Lun/Mié/Vie 7:00–8:00 p.m., no se le puede crear otro grupo en ese mismo
-- horario. El panel avisa antes de guardar (con el grupo que choca y una
-- sugerencia de horario libre); esto es la garantía en la base de datos por si
-- el cruce llega por otro camino (editar un horario, activar un grupo,
-- cambiar las fechas de un ciclo, dos admins a la vez).
--
-- Hay cruce entre dos grupos ACTIVOS del mismo profesor, con horario activo,
-- cuando se cumplen las tres cosas a la vez:
--   - comparten al menos un día,
--   - las horas se solapan (7:00–8:00 y 8:00–9:00 NO se cruzan),
--   - sus ciclos coinciden en fechas (grupos de ciclos distintos que no se
--     solapan en el calendario pueden repetir hora).
-- Los 30 minutos de descanso entre clases son una sugerencia del panel, no
-- una regla: aquí solo se bloquea el cruce real.

-- Devuelve el primer grupo del profesor que choca con el grupo dado (o nada).
create or replace function public.lef_group_teacher_conflict(p_group_id uuid)
  returns uuid language sql stable security definer set search_path = public as $$
  select o.id
  from public.groups g
  join public.schedules s  on s.id = g.schedule_id
  join public.cycles    c  on c.id = s.cycle_id
  join public.groups    o  on o.teacher_id = g.teacher_id and o.id <> g.id and o.active
  join public.schedules os on os.id = o.schedule_id and os.active
  join public.cycles    oc on oc.id = os.cycle_id
  where g.id = p_group_id
    and g.active and s.active
    and s.days && os.days
    and s.start_time < os.end_time and os.start_time < s.end_time
    and c.start_date <= oc.end_date and oc.start_date <= c.end_date
  limit 1;
$$;

revoke all on function public.lef_group_teacher_conflict(uuid) from public, anon, authenticated;

create or replace function public.lef_raise_teacher_conflict(p_group_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_other uuid; v_desc text;
begin
  v_other := public.lef_group_teacher_conflict(p_group_id);
  if v_other is null then return; end if;
  select t.full_name || ' ya tiene el grupo ' || m.level || ' (' ||
         array_to_string(s.days, ', ') || ' ' ||
         to_char(s.start_time, 'HH24:MI') || '–' || to_char(s.end_time, 'HH24:MI') || ', ciclo ' || c.name || ')'
    into v_desc
  from public.groups o
  join public.teachers t on t.id = o.teacher_id
  join public.modules m on m.id = o.module_id
  join public.schedules s on s.id = o.schedule_id
  join public.cycles c on c.id = s.cycle_id
  where o.id = v_other;
  raise exception 'LEF_TEACHER_SCHEDULE_CONFLICT' using detail = v_desc;
end;
$$;

revoke all on function public.lef_raise_teacher_conflict(uuid) from public, anon, authenticated;

-- AFTER: así la consulta ya ve la fila nueva; el error deshace el cambio.
-- Grupos: al crear, cambiar profesor/horario o activar.
create or replace function public.groups_teacher_conflict_trg()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.active then
    perform public.lef_raise_teacher_conflict(new.id);
  end if;
  return null;
end;
$$;

drop trigger if exists groups_teacher_conflict on public.groups;
create trigger groups_teacher_conflict
  after insert or update of teacher_id, schedule_id, active on public.groups
  for each row execute function public.groups_teacher_conflict_trg();

-- Horarios: al cambiar días/horas/ciclo o activarlo, revisa sus grupos.
create or replace function public.schedules_teacher_conflict_trg()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_g uuid;
begin
  if new.active then
    for v_g in select id from public.groups where schedule_id = new.id and active loop
      perform public.lef_raise_teacher_conflict(v_g);
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists schedules_teacher_conflict on public.schedules;
create trigger schedules_teacher_conflict
  after update of days, start_time, end_time, cycle_id, active on public.schedules
  for each row execute function public.schedules_teacher_conflict_trg();

-- Ciclos: al mover sus fechas puede empezar a solaparse con otro ciclo.
create or replace function public.cycles_teacher_conflict_trg()
  returns trigger language plpgsql security definer set search_path = public as $$
declare v_g uuid;
begin
  for v_g in
    select g.id from public.groups g
    join public.schedules s on s.id = g.schedule_id
    where s.cycle_id = new.id and g.active and s.active
  loop
    perform public.lef_raise_teacher_conflict(v_g);
  end loop;
  return null;
end;
$$;

drop trigger if exists cycles_teacher_conflict on public.cycles;
create trigger cycles_teacher_conflict
  after update of start_date, end_date on public.cycles
  for each row execute function public.cycles_teacher_conflict_trg();

-- Revisión: cruces que YA existían antes de esta regla (los triggers solo
-- actúan sobre cambios nuevos). Si esta consulta devuelve filas, hay que
-- mover uno de los dos grupos de cada par desde el panel.
select t.full_name as profesor,
       mg.level || ' ' || array_to_string(s.days, ',') || ' ' || to_char(s.start_time, 'HH24:MI') || '-' || to_char(s.end_time, 'HH24:MI') as grupo,
       mo.level || ' ' || array_to_string(os.days, ',') || ' ' || to_char(os.start_time, 'HH24:MI') || '-' || to_char(os.end_time, 'HH24:MI') as choca_con
from public.groups g
join public.teachers t on t.id = g.teacher_id
join public.modules mg on mg.id = g.module_id
join public.schedules s on s.id = g.schedule_id
join public.groups o on o.id = public.lef_group_teacher_conflict(g.id)
join public.modules mo on mo.id = o.module_id
join public.schedules os on os.id = o.schedule_id;
