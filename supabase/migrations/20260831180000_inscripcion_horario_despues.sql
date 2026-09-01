-- LEF — permite completar la inscripción sin elegir horario todavía.
-- Antes, si un módulo no tenía horarios activos o ninguno tenía cupo, el
-- estudiante quedaba bloqueado en el paso 3 del asistente. Ahora puede elegir
-- "decidir después" y enviar el formulario igual: la inscripción queda
-- "solo módulo" (sin grupo/ciclo), tal como ya soporta admin_assign_module,
-- y el equipo le asigna horario y grupo más adelante desde el panel admin.

-- ============================================================================
-- 1. create_enrollment — p_schedule_id ahora es opcional
-- ============================================================================
drop function if exists public.create_enrollment(text,text,text,uuid,uuid,text,text,integer,text);

create or replace function public.create_enrollment(
  p_full_name text, p_whatsapp text, p_email text,
  p_module_id uuid, p_schedule_id uuid,
  p_doc_type text, p_doc_number text,
  p_age integer default null, p_city text default null)
  returns table(enrollment_id uuid, registration_number text)
  language plpgsql security definer set search_path = public as $$
declare
  v_schedule public.schedules%rowtype;
  v_cycle public.cycles%rowtype;
  v_module public.modules%rowtype;
  v_module_id uuid;
  v_cycle_id uuid;
  v_group_id uuid;
  v_norm_email text := lower(trim(p_email));
  v_norm_phone text := regexp_replace(p_whatsapp, '\D', '', 'g');
  v_norm_doc  text := upper(regexp_replace(coalesce(p_doc_number, ''), '\s', '', 'g'));
  v_dup_reg_number text;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_reg_number text;
begin
  if coalesce(trim(p_full_name),'') = '' or coalesce(trim(p_email),'') = ''
     or coalesce(trim(p_whatsapp),'') = '' or v_norm_doc = '' then
    raise exception 'LEF_MISSING_FIELDS';
  end if;
  if coalesce(p_doc_type,'') not in ('TI','CC','CE','PP') then
    raise exception 'LEF_INVALID_DOC_TYPE';
  end if;

  if p_schedule_id is not null then
    -- Camino normal: el horario elegido manda sobre el módulo y el ciclo.
    select * into v_schedule from public.schedules where id = p_schedule_id;
    if not found or v_schedule.active = false then
      raise exception 'LEF_NO_AVAILABLE_GROUP';
    end if;
    v_module_id := v_schedule.module_id;

    select * into v_cycle from public.cycles where id = v_schedule.cycle_id;
    if not found or v_cycle.status <> 'Open' then
      raise exception 'LEF_CYCLE_CLOSED';
    end if;
    v_cycle_id := v_cycle.id;

    perform pg_advisory_xact_lock(hashtext('lef_enrollment_cycle_' || v_cycle.id::text)::bigint);
  else
    -- "Decidir horario después": inscripción solo-módulo, sin grupo ni ciclo.
    select * into v_module from public.modules where id = p_module_id;
    if not found or v_module.active = false then
      raise exception 'LEF_INVALID_MODULE';
    end if;
    v_module_id := v_module.id;
    v_cycle_id := null;
  end if;

  select e.registration_number into v_dup_reg_number
  from public.enrollments e
  join public.students st on st.id = e.student_id
  where e.status <> 'Cancelled'
    and ((v_cycle_id is not null and e.cycle_id = v_cycle_id)
         or (v_cycle_id is null and e.cycle_id is null))
    and (lower(trim(st.email)) = v_norm_email
         or regexp_replace(st.whatsapp, '\D', '', 'g') = v_norm_phone
         or upper(regexp_replace(st.doc_number, '\s', '', 'g')) = v_norm_doc)
  limit 1;
  if v_dup_reg_number is not null then
    raise exception 'LEF_DUPLICATE_REGISTRATION:%', v_dup_reg_number;
  end if;

  if p_schedule_id is not null then
    select gd.id into v_group_id
    from (
      select g.id, g.capacity,
        (select count(*) from public.enrollments e2
         where e2.group_id = g.id and e2.status <> 'Cancelled') as enrolled_count
      from public.groups g
      where g.module_id = v_module_id and g.schedule_id = p_schedule_id and g.active = true
    ) gd
    where gd.enrolled_count < gd.capacity
    order by gd.enrolled_count asc
    limit 1;
    if v_group_id is null then
      raise exception 'LEF_NO_AVAILABLE_GROUP';
    end if;
  else
    v_group_id := null;
  end if;

  insert into public.students (full_name, whatsapp, email, doc_type, doc_number, age, city)
  values (trim(p_full_name), trim(p_whatsapp), trim(p_email),
          p_doc_type, trim(p_doc_number), p_age,
          nullif(trim(coalesce(p_city, '')), ''))
  returning id into v_student_id;

  v_reg_number := public.next_registration_number();

  insert into public.enrollments (registration_number, student_id, module_id, group_id, cycle_id, status)
  values (v_reg_number, v_student_id, v_module_id, v_group_id, v_cycle_id, 'Pending')
  returning id into v_enrollment_id;

  return query select v_enrollment_id, v_reg_number;
end;
$$;

revoke all on function public.create_enrollment(text,text,text,uuid,uuid,text,text,integer,text) from public, anon;
grant execute on function public.create_enrollment(text,text,text,uuid,uuid,text,text,integer,text) to anon, authenticated;

-- ============================================================================
-- 2. get_enrollment_confirmation — group/schedule/teacher ahora son opcionales
-- ============================================================================
create or replace function public.get_enrollment_confirmation(p_id uuid)
  returns table(id uuid, registration_number text, status text, created_at timestamptz,
                student_full_name text, module_level text, module_title text,
                schedule_days text[], schedule_start_time time, schedule_end_time time,
                teacher_full_name text)
  language sql stable security definer set search_path = public as $$
  select e.id, e.registration_number, e.status, e.created_at,
         st.full_name, m.level, m.title, sch.days, sch.start_time, sch.end_time, t.full_name
  from public.enrollments e
  join public.students st on st.id = e.student_id
  join public.modules m on m.id = e.module_id
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  where e.id = p_id limit 1;
$$;
