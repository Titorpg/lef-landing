-- Datos de arranque para LEF (no forma parte del esquema).
-- Perfil admin + datos de prueba para poder probar el asistente de inscripción.
-- Los datos de prueba se pueden borrar desde el panel admin cuando el cliente
-- cargue lo real.

-- 1. Perfil admin (cuenta creada en auth.users)
insert into public.profiles (user_id, role, full_name, email)
values ('ffd43a97-42b3-49d9-a5b4-68b4f8a3ea0d', 'admin', 'Administrador LEF', 'director@lefcenter.com')
on conflict (user_id) do update set role = 'admin', active = true;

-- 2. Profesores de prueba
insert into public.teachers (full_name, email, whatsapp) values
  ('María Rada',      'maria.rada@lefcenter.com',      '573011111111'),
  ('Luis Caballero',  'luis.caballero@lefcenter.com',  '573012222222'),
  ('Daniela Ospino',  'daniela.ospino@lefcenter.com',  '573013333333')
on conflict (email) do nothing;

-- 3. Ciclo abierto
insert into public.cycles (name, start_date, end_date, status)
values ('Sep - Oct 2026', '2026-09-01', '2026-10-24', 'Open')
on conflict do nothing;

-- 4. Horarios + grupos de prueba para varios módulos
do $$
declare
  v_cycle uuid;
  v_maria uuid; v_luis uuid; v_daniela uuid;
  v_m1 uuid; v_m3 uuid; v_m4 uuid; v_m7 uuid;
  v_s uuid;
begin
  select id into v_cycle from public.cycles where name = 'Sep - Oct 2026';
  select id into v_maria   from public.teachers where email = 'maria.rada@lefcenter.com';
  select id into v_luis    from public.teachers where email = 'luis.caballero@lefcenter.com';
  select id into v_daniela from public.teachers where email = 'daniela.ospino@lefcenter.com';
  select id into v_m1 from public.modules where level = 'A1.1';
  select id into v_m3 from public.modules where level = 'A1.3';
  select id into v_m4 from public.modules where level = 'A2.1';
  select id into v_m7 from public.modules where level = 'B1.1';

  if not exists (select 1 from public.schedules where cycle_id = v_cycle) then
    -- A1.1 — mañana L/M/X/J
    insert into public.schedules (cycle_id, module_id, days, start_time, end_time)
    values (v_cycle, v_m1, array['Monday','Tuesday','Wednesday','Thursday'], '08:00', '09:00')
    returning id into v_s;
    insert into public.groups (module_id, schedule_id, teacher_id, capacity)
    values (v_m1, v_s, v_maria, 8);

    -- A1.1 — noche L/M/X/J
    insert into public.schedules (cycle_id, module_id, days, start_time, end_time)
    values (v_cycle, v_m1, array['Monday','Tuesday','Wednesday','Thursday'], '19:00', '20:00')
    returning id into v_s;
    insert into public.groups (module_id, schedule_id, teacher_id, capacity)
    values (v_m1, v_s, v_daniela, 8);

    -- A1.3 — tarde M/X/J/V
    insert into public.schedules (cycle_id, module_id, days, start_time, end_time)
    values (v_cycle, v_m3, array['Tuesday','Wednesday','Thursday','Friday'], '17:00', '18:00')
    returning id into v_s;
    insert into public.groups (module_id, schedule_id, teacher_id, capacity)
    values (v_m3, v_s, v_maria, 8);

    -- A2.1 — noche M/X/J/V
    insert into public.schedules (cycle_id, module_id, days, start_time, end_time)
    values (v_cycle, v_m4, array['Tuesday','Wednesday','Thursday','Friday'], '20:00', '21:00')
    returning id into v_s;
    insert into public.groups (module_id, schedule_id, teacher_id, capacity)
    values (v_m4, v_s, v_luis, 8);

    -- B1.1 — noche L/M/X/J
    insert into public.schedules (cycle_id, module_id, days, start_time, end_time)
    values (v_cycle, v_m7, array['Monday','Tuesday','Wednesday','Thursday'], '19:00', '20:30')
    returning id into v_s;
    insert into public.groups (module_id, schedule_id, teacher_id, capacity)
    values (v_m7, v_s, v_luis, 8);
  end if;
end $$;
