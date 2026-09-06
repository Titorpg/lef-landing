-- LEF — El formulario público deja de ser un selector de módulo/horario y
-- pasa a pedir solo INDICADORES de referencia para el asesor: una
-- autoevaluación de nivel (Principiante/Intermedio/Avanzado) y una franja
-- horaria preferida (Mañana/Tarde/Noche). El admin sigue siendo quien elige
-- el módulo, el horario y el grupo reales al convertir la solicitud en
-- estudiante (eso no cambia).
--
-- No se tocan desired_module_id/desired_schedule_id (quedan en el esquema,
-- simplemente el formulario público ya no los llena) — así los registros
-- viejos no se rompen ni pierden su dato.

alter table public.preinscripciones
  add column if not exists level_estimate text
    check (level_estimate is null or level_estimate in ('beginner','intermediate','advanced')),
  add column if not exists time_preference text
    check (time_preference is null or time_preference in ('morning','afternoon','evening'));

-- create_preinscripcion — se agregan los dos indicadores. Postgres identifica
-- las funciones por su firma completa (tipos de parámetros): agregar
-- parámetros nuevos con "create or replace" crea una función SOBRECARGADA en
-- vez de reemplazar la vieja (y PostgREST no sabría cuál usar). Por eso hay
-- que soltar la firma anterior primero.
drop function if exists public.create_preinscripcion(text,text,text,text,text,integer,text,uuid,uuid,boolean);

create or replace function public.create_preinscripcion(
  p_full_name text, p_whatsapp text, p_email text,
  p_doc_type text default null, p_doc_number text default null,
  p_age integer default null, p_city text default null,
  p_module_id uuid default null, p_schedule_id uuid default null,
  p_wants_schedule_later boolean default false,
  p_level_estimate text default null, p_time_preference text default null)
  returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_phone text := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
begin
  if coalesce(trim(p_full_name), '') = '' or coalesce(trim(p_email), '') = ''
     or coalesce(trim(p_whatsapp), '') = '' then
    raise exception 'LEF_MISSING_FIELDS';
  end if;
  if p_doc_type is not null and p_doc_type not in ('TI','CC','CE','PP') then
    raise exception 'LEF_INVALID_DOC_TYPE';
  end if;
  if p_level_estimate is not null and p_level_estimate not in ('beginner','intermediate','advanced') then
    raise exception 'LEF_INVALID_LEVEL_ESTIMATE';
  end if;
  if p_time_preference is not null and p_time_preference not in ('morning','afternoon','evening') then
    raise exception 'LEF_INVALID_TIME_PREFERENCE';
  end if;

  -- Anti doble-envío / spam: una solicitud pendiente reciente por contacto.
  if exists (
    select 1 from public.preinscripciones
    where status in ('nuevo','contactado')
      and created_at > now() - interval '24 hours'
      and (lower(trim(email)) = v_email
           or regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g') = v_phone)
  ) then
    raise exception 'LEF_PREINSCRIPCION_RECIENTE';
  end if;

  insert into public.preinscripciones (
    full_name, doc_type, doc_number, whatsapp, email, age, city,
    desired_module_id, desired_schedule_id, wants_schedule_later,
    level_estimate, time_preference)
  values (
    trim(p_full_name), p_doc_type, nullif(trim(coalesce(p_doc_number, '')), ''),
    trim(p_whatsapp), trim(p_email), p_age,
    nullif(trim(coalesce(p_city, '')), ''),
    p_module_id, p_schedule_id, coalesce(p_wants_schedule_later, false),
    p_level_estimate, p_time_preference)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_preinscripcion(text,text,text,text,text,integer,text,uuid,uuid,boolean,text,text) from public;
grant execute on function public.create_preinscripcion(text,text,text,text,text,integer,text,uuid,uuid,boolean,text,text) to anon, authenticated;
