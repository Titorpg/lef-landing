-- ============================================================================
-- LEF — Fase 1: sistema de inscripción  (+ base de la Fase 2: facturación)
-- ----------------------------------------------------------------------------
-- Portado y adaptado del proyecto anterior. Añade:
--   * profiles con rol (admin / teacher / student)
--   * tablas de facturación (subscriptions, payments) — operación manual por ahora
--   * el motor de inscripción anónimo (wizard de 4 pasos) vía funciones SECURITY DEFINER
-- La integración con Wompi (cobro en línea y recurrente) se hará en la Fase 2.
-- ============================================================================

-- La tabla plana de la etapa A ya no se usa: queda reemplazada por students + enrollments.
drop table if exists public.inscripciones cascade;

-- ----------------------------------------------------------------------------
-- 1. Catálogo académico
-- ----------------------------------------------------------------------------

create table if not exists public.modules (
  id            uuid primary key default gen_random_uuid(),
  level         text not null unique
                check (level in ('A1.1','A1.2','A1.3','A2.1','A2.2','A2.3',
                                 'B1.1','B1.2','B1.3','B2.1','B2.2','B2.3')),
  module_number integer not null check (module_number between 1 and 12),
  title         text not null,
  description   text not null default '',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists public.cycles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  status      text not null default 'Open' check (status in ('Open','Closed')),
  created_at  timestamptz not null default now(),
  constraint cycles_dates_check check (end_date >= start_date)
);

create table if not exists public.teachers (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  email       text not null unique,
  whatsapp    text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  cycle_id    uuid not null references public.cycles(id) on delete restrict,
  module_id   uuid not null references public.modules(id) on delete restrict,
  days        text[] not null,
  start_time  time not null,
  end_time    time not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  constraint schedules_time_check check (end_time > start_time),
  constraint schedules_days_valid check (
    cardinality(days) > 0 and
    days <@ array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  )
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  module_id   uuid not null references public.modules(id) on delete restrict,
  schedule_id uuid not null references public.schedules(id) on delete restrict,
  teacher_id  uuid not null references public.teachers(id) on delete restrict,
  capacity    integer not null default 8 check (capacity > 0 and capacity <= 8),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Personas: students + enrollments
-- ----------------------------------------------------------------------------

create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  whatsapp    text not null,
  email       text not null,
  age         integer check (age is null or age between 5 and 100),
  city        text,
  created_at  timestamptz not null default now()
);

create table if not exists public.registration_counters (
  year      integer primary key,
  next_seq  integer not null default 1
);

create table if not exists public.enrollments (
  id                  uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  student_id          uuid not null references public.students(id) on delete restrict,
  module_id           uuid not null references public.modules(id) on delete restrict,
  group_id            uuid not null references public.groups(id) on delete restrict,
  cycle_id            uuid not null references public.cycles(id) on delete restrict,
  status              text not null default 'Pending'
                      check (status in ('Pending','Contacted','Confirmed','Paid','Cancelled')),
  created_at          timestamptz not null default now()
);

create index if not exists enrollments_student_idx on public.enrollments(student_id);
create index if not exists enrollments_group_idx   on public.enrollments(group_id);

-- ----------------------------------------------------------------------------
-- 3. Cuentas y roles  (profiles sobre auth.users)
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null check (role in ('admin','teacher','student')),
  full_name   text,
  email       text not null,
  teacher_id  uuid references public.teachers(id) on delete set null,
  student_id  uuid references public.students(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists profiles_student_uindex on public.profiles(student_id) where student_id is not null;
create unique index if not exists profiles_teacher_uindex on public.profiles(teacher_id) where teacher_id is not null;

-- Helpers de rol (SECURITY DEFINER: evitan recursión de RLS al leer profiles)
create or replace function public.is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where user_id = auth.uid() and role = 'admin' and active);
$$;

create or replace function public.is_teacher()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where user_id = auth.uid() and role in ('admin','teacher') and active);
$$;

-- Compatibilidad con las funciones portadas del proyecto viejo
create or replace function public.is_staff()
  returns boolean language sql stable security definer set search_path = public as $$
  select public.is_teacher();
$$;

create or replace function public.current_student_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select student_id from public.profiles where user_id = auth.uid() and active;
$$;

-- ----------------------------------------------------------------------------
-- 4. Facturación  (Fase 2 — operación manual hoy, Wompi después)
-- ----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete restrict,
  enrollment_id  uuid references public.enrollments(id) on delete set null,
  description    text,
  monthly_amount numeric(12,2) not null check (monthly_amount >= 0),
  currency       text not null default 'COP',
  billing_day    integer not null default 1 check (billing_day between 1 and 28),
  grace_days     integer not null default 5 check (grace_days between 0 and 60),
  status         text not null default 'active' check (status in ('active','frozen','cancelled')),
  next_due_date  date,
  started_at     date not null default current_date,
  frozen_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists subscriptions_student_idx on public.subscriptions(student_id);
create index if not exists subscriptions_status_idx  on public.subscriptions(status);

create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete restrict,
  student_id      uuid not null references public.students(id) on delete restrict,
  amount          numeric(12,2) not null check (amount >= 0),
  currency        text not null default 'COP',
  period_month    date not null,                 -- primer día del mes que cubre
  method          text not null check (method in ('pse','card','cash','transfer','other')),
  status          text not null default 'approved'
                  check (status in ('pending','approved','declined','refunded')),
  reference       text,
  gateway_txn_id  text,                          -- id de transacción Wompi (Fase 2)
  paid_at         timestamptz not null default now(),
  recorded_by     uuid references auth.users(id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);

create index if not exists payments_subscription_idx on public.payments(subscription_id);
create index if not exists payments_student_idx      on public.payments(student_id);
create unique index if not exists payments_period_uindex
  on public.payments(subscription_id, period_month) where status = 'approved';

-- ----------------------------------------------------------------------------
-- 5. Lógica del motor de inscripción  (portada del proyecto anterior)
-- ----------------------------------------------------------------------------

create or replace function public.next_registration_number()
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  insert into public.registration_counters (year, next_seq)
  values (v_year, 2)
  on conflict (year) do update set next_seq = public.registration_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return 'LEF-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;

create or replace function public.enforce_group_capacity()
  returns trigger language plpgsql as $$
declare
  v_capacity int;
  v_count int;
begin
  if new.status = 'Cancelled' then
    return new;
  end if;
  select capacity into v_capacity from public.groups where id = new.group_id for update;
  select count(*) into v_count
  from public.enrollments
  where group_id = new.group_id
    and status <> 'Cancelled'
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
  if v_count + 1 > v_capacity then
    raise exception 'LEF_GROUP_FULL: el grupo % ya está lleno (%/%).', new.group_id, v_count, v_capacity;
  end if;
  return new;
end;
$$;

drop trigger if exists enrollments_capacity_guard on public.enrollments;
create trigger enrollments_capacity_guard
  before insert or update on public.enrollments
  for each row execute function public.enforce_group_capacity();

create or replace function public.get_public_modules()
  returns table(id uuid, level text, module_number integer, title text, description text)
  language sql stable security definer set search_path = public as $$
  select id, level, module_number, title, description
  from public.modules where active = true order by module_number;
$$;

create or replace function public.get_schedule_availability(p_module_id uuid)
  returns table(schedule_id uuid, cycle_id uuid, module_id uuid, days text[],
                start_time time, end_time time, active boolean,
                total_capacity bigint, total_enrolled bigint, available bigint,
                is_full boolean, group_count bigint)
  language sql stable security definer set search_path = public as $$
  with active_groups as (
    select g.id, g.schedule_id, g.capacity
    from public.groups g
    where g.module_id = p_module_id and g.active = true
  ),
  enrolled as (
    select ag.id as group_id, count(e.id) as enrolled_count
    from active_groups ag
    left join public.enrollments e on e.group_id = ag.id and e.status <> 'Cancelled'
    group by ag.id
  )
  select
    s.id, s.cycle_id, s.module_id, s.days, s.start_time, s.end_time, s.active,
    coalesce(sum(ag.capacity), 0)::bigint,
    coalesce(sum(en.enrolled_count), 0)::bigint,
    greatest(coalesce(sum(ag.capacity), 0) - coalesce(sum(en.enrolled_count), 0), 0)::bigint,
    (count(ag.id) = 0)
      or (greatest(coalesce(sum(ag.capacity), 0) - coalesce(sum(en.enrolled_count), 0), 0) = 0),
    count(ag.id)::bigint
  from public.schedules s
  join public.cycles c on c.id = s.cycle_id
  left join active_groups ag on ag.schedule_id = s.id
  left join enrolled en on en.group_id = ag.id
  where s.module_id = p_module_id and s.active = true and c.status = 'Open'
  group by s.id, s.cycle_id, s.module_id, s.days, s.start_time, s.end_time, s.active;
$$;

create or replace function public.create_enrollment(
  p_full_name text, p_whatsapp text, p_email text,
  p_module_id uuid, p_schedule_id uuid,
  p_age integer default null, p_city text default null)
  returns table(enrollment_id uuid, registration_number text)
  language plpgsql security definer set search_path = public as $$
declare
  v_schedule public.schedules%rowtype;
  v_cycle public.cycles%rowtype;
  v_module_id uuid;
  v_norm_email text := lower(trim(p_email));
  v_norm_phone text := regexp_replace(p_whatsapp, '\D', '', 'g');
  v_dup_reg_number text;
  v_group_id uuid;
  v_student_id uuid;
  v_enrollment_id uuid;
  v_reg_number text;
begin
  if coalesce(trim(p_full_name),'') = '' or coalesce(trim(p_email),'') = ''
     or coalesce(trim(p_whatsapp),'') = '' then
    raise exception 'LEF_MISSING_FIELDS';
  end if;

  select * into v_schedule from public.schedules where id = p_schedule_id;
  if not found or v_schedule.active = false then
    raise exception 'LEF_NO_AVAILABLE_GROUP';
  end if;
  v_module_id := v_schedule.module_id;  -- el horario manda sobre el módulo

  select * into v_cycle from public.cycles where id = v_schedule.cycle_id;
  if not found or v_cycle.status <> 'Open' then
    raise exception 'LEF_CYCLE_CLOSED';
  end if;

  perform pg_advisory_xact_lock(hashtext('lef_enrollment_cycle_' || v_cycle.id::text)::bigint);

  select e.registration_number into v_dup_reg_number
  from public.enrollments e
  join public.students st on st.id = e.student_id
  where e.cycle_id = v_cycle.id
    and e.status <> 'Cancelled'
    and (lower(trim(st.email)) = v_norm_email
         or regexp_replace(st.whatsapp, '\D', '', 'g') = v_norm_phone)
  limit 1;
  if v_dup_reg_number is not null then
    raise exception 'LEF_DUPLICATE_REGISTRATION:%', v_dup_reg_number;
  end if;

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

  insert into public.students (full_name, whatsapp, email, age, city)
  values (trim(p_full_name), trim(p_whatsapp), trim(p_email), p_age,
          nullif(trim(coalesce(p_city, '')), ''))
  returning id into v_student_id;

  v_reg_number := public.next_registration_number();

  insert into public.enrollments (registration_number, student_id, module_id, group_id, cycle_id, status)
  values (v_reg_number, v_student_id, v_module_id, v_group_id, v_cycle.id, 'Pending')
  returning id into v_enrollment_id;

  return query select v_enrollment_id, v_reg_number;
end;
$$;

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
  join public.groups g on g.id = e.group_id
  join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  where e.id = p_id limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 6. Lógica de facturación  (operación manual — la usa el admin)
-- ----------------------------------------------------------------------------

-- Registra un pago (efectivo/transferencia/PSE/tarjeta) y adelanta la próxima fecha.
create or replace function public.record_payment(
  p_subscription_id uuid, p_amount numeric, p_method text,
  p_period_month date default date_trunc('month', now())::date,
  p_reference text default null, p_notes text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_payment_id uuid;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  insert into public.payments (subscription_id, student_id, amount, currency,
                               period_month, method, status, reference, notes, recorded_by)
  values (p_subscription_id, v_sub.student_id, p_amount, v_sub.currency,
          date_trunc('month', p_period_month)::date, p_method, 'approved',
          p_reference, p_notes, auth.uid())
  returning id into v_payment_id;

  update public.subscriptions
  set next_due_date = (date_trunc('month', p_period_month) + interval '1 month')::date
                        + (billing_day - 1),
      status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  return v_payment_id;
end;
$$;

-- Congela las suscripciones vencidas más allá del periodo de gracia.
-- Hoy la dispara el admin con un botón; en la Fase 2 se agenda con pg_cron.
create or replace function public.freeze_overdue_subscriptions()
  returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  with frozen as (
    update public.subscriptions
    set status = 'frozen', frozen_at = now(), updated_at = now()
    where status = 'active'
      and next_due_date is not null
      and current_date > next_due_date + grace_days
    returning 1
  )
  select count(*) into v_count from frozen;
  return v_count;
end;
$$;

-- Vista del estudiante: su suscripción + historial de pagos.
create or replace function public.get_my_billing()
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'student', (select to_jsonb(s) from (
        select st.full_name, st.email from public.students st
        where st.id = public.current_student_id()) s),
    'subscriptions', coalesce((select jsonb_agg(to_jsonb(sub) order by sub.created_at)
        from public.subscriptions sub where sub.student_id = public.current_student_id()), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc)
        from public.payments p where p.student_id = public.current_student_id()), '[]'::jsonb)
  );
$$;

-- Resumen para el admin: cada suscripción con su último pago y estado de mora.
create or replace function public.admin_billing_overview()
  returns table(subscription_id uuid, student_id uuid, student_name text, student_email text,
                description text, monthly_amount numeric, currency text, status text,
                next_due_date date, last_payment_at timestamptz, last_payment_amount numeric,
                is_overdue boolean)
  language sql stable security definer set search_path = public as $$
  select sub.id, st.id, st.full_name, st.email, sub.description, sub.monthly_amount, sub.currency,
         sub.status, sub.next_due_date,
         lp.paid_at, lp.amount,
         (sub.status = 'active' and sub.next_due_date is not null
          and current_date > sub.next_due_date + sub.grace_days)
  from public.subscriptions sub
  join public.students st on st.id = sub.student_id
  left join lateral (
    select paid_at, amount from public.payments p
    where p.subscription_id = sub.id and p.status = 'approved'
    order by p.paid_at desc limit 1
  ) lp on true
  where public.is_admin()
  order by st.full_name;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS
-- ----------------------------------------------------------------------------

alter table public.modules               enable row level security;
alter table public.cycles                enable row level security;
alter table public.teachers              enable row level security;
alter table public.schedules             enable row level security;
alter table public.groups                enable row level security;
alter table public.students              enable row level security;
alter table public.enrollments           enable row level security;
alter table public.registration_counters enable row level security;
alter table public.profiles              enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.payments              enable row level security;

-- Catálogo académico: admin escribe, profesor lee. (El público entra por funciones.)
do $$
declare t text;
begin
  foreach t in array array['modules','cycles','teachers','schedules','groups'] loop
    execute format('drop policy if exists "admin escribe %1$s" on public.%1$s;', t);
    execute format('create policy "admin escribe %1$s" on public.%1$s for all to authenticated using (public.is_admin()) with check (public.is_admin());', t);
    execute format('drop policy if exists "staff lee %1$s" on public.%1$s;', t);
    execute format('create policy "staff lee %1$s" on public.%1$s for select to authenticated using (public.is_teacher());', t);
  end loop;
end $$;

-- students: admin todo; profesor lee; el estudiante lee su propia ficha.
drop policy if exists "admin gestiona students" on public.students;
create policy "admin gestiona students" on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "staff lee students" on public.students;
create policy "staff lee students" on public.students for select to authenticated
  using (public.is_teacher());
drop policy if exists "estudiante lee su ficha" on public.students;
create policy "estudiante lee su ficha" on public.students for select to authenticated
  using (id = public.current_student_id());

-- enrollments: admin todo; profesor lee las de sus grupos; estudiante lee las suyas.
drop policy if exists "admin gestiona enrollments" on public.enrollments;
create policy "admin gestiona enrollments" on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profesor lee enrollments de sus grupos" on public.enrollments;
create policy "profesor lee enrollments de sus grupos" on public.enrollments for select to authenticated
  using (public.is_teacher() and group_id in (
    select g.id from public.groups g
    join public.profiles pr on pr.teacher_id = g.teacher_id
    where pr.user_id = auth.uid()));
drop policy if exists "estudiante lee sus enrollments" on public.enrollments;
create policy "estudiante lee sus enrollments" on public.enrollments for select to authenticated
  using (student_id = public.current_student_id());

-- profiles: admin todo; cada quien lee su propia fila.
drop policy if exists "admin gestiona profiles" on public.profiles;
create policy "admin gestiona profiles" on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "lee su propio profile" on public.profiles;
create policy "lee su propio profile" on public.profiles for select to authenticated
  using (user_id = auth.uid());

-- subscriptions / payments: admin todo; estudiante lee lo suyo.
drop policy if exists "admin gestiona subscriptions" on public.subscriptions;
create policy "admin gestiona subscriptions" on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "estudiante lee sus subscriptions" on public.subscriptions;
create policy "estudiante lee sus subscriptions" on public.subscriptions for select to authenticated
  using (student_id = public.current_student_id());

drop policy if exists "admin gestiona payments" on public.payments;
create policy "admin gestiona payments" on public.payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "estudiante lee sus payments" on public.payments;
create policy "estudiante lee sus payments" on public.payments for select to authenticated
  using (student_id = public.current_student_id());

-- registration_counters: sin políticas => solo funciones SECURITY DEFINER lo tocan.

-- ----------------------------------------------------------------------------
-- 8. Grants: qué puede ejecutar cada quién
-- ----------------------------------------------------------------------------

revoke all on function public.next_registration_number()       from public, anon, authenticated;
revoke all on function public.freeze_overdue_subscriptions()   from public, anon;
revoke all on function public.record_payment(uuid,numeric,text,date,text,text) from public, anon;
revoke all on function public.admin_billing_overview()         from public, anon;

grant execute on function public.get_public_modules()                       to anon, authenticated;
grant execute on function public.get_schedule_availability(uuid)            to anon, authenticated;
grant execute on function public.create_enrollment(text,text,text,uuid,uuid,integer,text) to anon, authenticated;
grant execute on function public.get_enrollment_confirmation(uuid)          to anon, authenticated;
grant execute on function public.is_admin()                                 to authenticated;
grant execute on function public.is_teacher()                               to authenticated;
grant execute on function public.current_student_id()                       to authenticated;
grant execute on function public.get_my_billing()                           to authenticated;
grant execute on function public.admin_billing_overview()                   to authenticated;
grant execute on function public.record_payment(uuid,numeric,text,date,text,text) to authenticated;
grant execute on function public.freeze_overdue_subscriptions()             to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Semilla: los 12 módulos
-- ----------------------------------------------------------------------------

-- Título en inglés, descripción en español (ver migración 20260827190000).
insert into public.modules (level, module_number, title, description) values
  ('A1.1', 1,  'Hello, World',              'Saludos, el abecedario, números y presentaciones cotidianas.'),
  ('A1.2', 2,  'Everyday Life',             'Rutinas diarias, familia, comida y presente simple.'),
  ('A1.3', 3,  'My Story',                  'Direcciones, lugares de la ciudad y pasado simple.'),
  ('A2.1', 4,  'Out and About',             'Pasado continuo, vocabulario de viajes y comparativos.'),
  ('A2.2', 5,  'On the Move',               'Formas de futuro, invitaciones y superlativos.'),
  ('A2.3', 6,  'Experience Counts',         'Should/shouldn''t, modales y cómo dar consejos.'),
  ('B1.1', 7,  'Connecting the Dots',       'Present Perfect vs. Past Simple, for/since y First Conditional.'),
  ('B1.2', 8,  'Behind the Words',          'Estilo indirecto, Past Perfect y modales de deducción.'),
  ('B1.3', 9,  'What If?',                  'Modales de especulación, formas de futuro complejas y debate estructurado.'),
  ('B2.1', 10, 'The Bigger Picture',        'Condicionales mixtos y lenguaje hipotético avanzado.'),
  ('B2.2', 11, 'Power of Words',            'Voz pasiva avanzada y reportes precisos.'),
  ('B2.3', 12, 'Your English, Your Voice',  'Modismos, phrasal verbs y el proyecto final de B2.')
on conflict (level) do nothing;
