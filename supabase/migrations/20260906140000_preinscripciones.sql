-- LEF — Pre-inscripciones (lista de espera del formulario público).
--
-- Cambio de flujo: el formulario público YA NO crea un estudiante ni una
-- inscripción. Ahora guarda una "pre-inscripción". El admin ve la lista en el
-- panel (Estudiantes → pestaña "Pre-inscritos"), contacta a la persona y, si
-- acuerdan el inicio del curso, pulsa "Crear estudiante": ahí sí se crea el
-- estudiante + la inscripción (con cupo, grupo y matrícula), reutilizando
-- create_enrollment.
--
-- No depende de las migraciones de seguridad (20260906120000 / 130000), pero si
-- se aplican todas, respeta el orden por fecha.

-- ============================================================================
-- 1. Tabla
-- ============================================================================
create table if not exists public.preinscripciones (
  id                   uuid primary key default gen_random_uuid(),
  created_at           timestamptz not null default now(),
  full_name            text not null,
  doc_type             text check (doc_type in ('TI','CC','CE','PP')),
  doc_number           text,
  whatsapp             text not null,
  email                text not null,
  age                  integer,
  city                 text,
  desired_module_id    uuid references public.modules(id)   on delete set null,
  desired_schedule_id  uuid references public.schedules(id) on delete set null,
  wants_schedule_later boolean not null default false,
  notes                text,
  status               text not null default 'nuevo'
                         check (status in ('nuevo','contactado','convertido','descartado')),
  converted_student_id uuid references public.students(id) on delete set null,
  converted_at         timestamptz,
  handled_by           uuid
);

create index if not exists preinscripciones_status_idx
  on public.preinscripciones (status, created_at desc);

alter table public.preinscripciones enable row level security;

-- Staff (admin + profesores) puede ver la lista; solo el admin la gestiona.
drop policy if exists "staff lee preinscripciones" on public.preinscripciones;
create policy "staff lee preinscripciones" on public.preinscripciones
  for select to authenticated using (public.is_teacher());

drop policy if exists "admin gestiona preinscripciones" on public.preinscripciones;
create policy "admin gestiona preinscripciones" on public.preinscripciones
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- anon no tiene política: solo entra por create_preinscripcion (SECURITY DEFINER).

-- ============================================================================
-- 2. create_preinscripcion — la llama el formulario público (anon)
-- ============================================================================
create or replace function public.create_preinscripcion(
  p_full_name text, p_whatsapp text, p_email text,
  p_doc_type text default null, p_doc_number text default null,
  p_age integer default null, p_city text default null,
  p_module_id uuid default null, p_schedule_id uuid default null,
  p_wants_schedule_later boolean default false)
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
    desired_module_id, desired_schedule_id, wants_schedule_later)
  values (
    trim(p_full_name), p_doc_type, nullif(trim(coalesce(p_doc_number, '')), ''),
    trim(p_whatsapp), trim(p_email), p_age,
    nullif(trim(coalesce(p_city, '')), ''),
    p_module_id, p_schedule_id, coalesce(p_wants_schedule_later, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_preinscripcion(text,text,text,text,text,integer,text,uuid,uuid,boolean) from public;
grant execute on function public.create_preinscripcion(text,text,text,text,text,integer,text,uuid,uuid,boolean) to anon, authenticated;

-- ============================================================================
-- 3. admin_convert_preinscripcion — "Crear estudiante" desde el panel
--    Reutiliza create_enrollment (crea students + enrollments, cupo, matrícula).
-- ============================================================================
create or replace function public.admin_convert_preinscripcion(
  p_id uuid, p_module_id uuid, p_schedule_id uuid,
  p_doc_type text, p_doc_number text,
  p_age integer default null, p_city text default null)
  returns table(enrollment_id uuid, registration_number text, student_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_pre public.preinscripciones%rowtype;
  v_enr_id uuid;
  v_reg text;
  v_student_id uuid;
begin
  if not public.is_admin() then
    raise exception 'LEF_REQUIRES_ADMIN';
  end if;

  select * into v_pre from public.preinscripciones where id = p_id;
  if not found then
    raise exception 'LEF_PREINSCRIPCION_NOT_FOUND';
  end if;
  if v_pre.status = 'convertido' then
    raise exception 'LEF_ALREADY_CONVERTED';
  end if;

  select ce.enrollment_id, ce.registration_number
    into v_enr_id, v_reg
  from public.create_enrollment(
    v_pre.full_name, v_pre.whatsapp, v_pre.email,
    p_module_id, p_schedule_id,
    coalesce(nullif(p_doc_type, ''), v_pre.doc_type, 'CC'),
    coalesce(nullif(trim(coalesce(p_doc_number, '')), ''), v_pre.doc_number),
    coalesce(p_age, v_pre.age),
    coalesce(nullif(trim(coalesce(p_city, '')), ''), v_pre.city)
  ) ce;

  select e.student_id into v_student_id from public.enrollments e where e.id = v_enr_id;

  update public.preinscripciones
     set status = 'convertido',
         converted_student_id = v_student_id,
         converted_at = now(),
         handled_by = auth.uid()
   where id = p_id;

  return query select v_enr_id, v_reg, v_student_id;
end;
$$;

revoke all on function public.admin_convert_preinscripcion(uuid,uuid,uuid,text,text,integer,text) from public, anon;
grant execute on function public.admin_convert_preinscripcion(uuid,uuid,uuid,text,text,integer,text) to authenticated;
