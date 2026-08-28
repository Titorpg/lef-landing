-- LEF — El pago es un asiento de libro contable (justificable ante la DIAN),
-- separado del estudiante y del pagador.
--
--  1. Documento de identidad del estudiante: obligatorio.
--  2. Se puede eliminar un estudiante: sus suscripciones SIN pagos se borran,
--     las que tienen pagos se DESLIGAN (student_id -> NULL) y el historial queda fijo.
--  3. Datos del PAGADOR (el "tercero" del libro): viven en la suscripción y se
--     CONGELAN dentro de cada pago (el pagador puede cambiar mes a mes;
--     ej. estudiante menor de edad cuya mensualidad paga el padre).
--  4. Los pagos son inmutables: no se editan ni se borran. Las correcciones van
--     como un asiento de reverso. Cada pago lleva un consecutivo REC-AAAA-NNNNN.
--
-- Pendiente para la integración de Wompi (otra migración): campos de la pasarela
-- (id de transacción, banco PSE / franquicia / últimos 4, payment_source_id),
-- tabla payment_methods, Edge Function wompi-webhook, cobro recurrente, y la
-- decisión de factura electrónica (CUFE / proveedor externo).

-- ============================================================================
-- 1. DOCUMENTO DEL ESTUDIANTE (obligatorio)
-- ============================================================================
alter table public.students add column if not exists doc_type   text;
alter table public.students add column if not exists doc_number text;

update public.students
  set doc_type   = coalesce(doc_type, 'CC'),
      doc_number = coalesce(doc_number, 'PENDIENTE')
  where doc_number is null;

alter table public.students alter column doc_type   set not null;
alter table public.students alter column doc_number set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'students_doc_type_check') then
    alter table public.students
      add constraint students_doc_type_check check (doc_type in ('TI','CC','CE','PP'));
  end if;
end $$;

-- ============================================================================
-- 2. PAGADOR en la suscripción + copia congelada del estudiante
-- ============================================================================
alter table public.subscriptions add column if not exists payer_name       text;
alter table public.subscriptions add column if not exists payer_doc_type   text;
alter table public.subscriptions add column if not exists payer_doc_number text;
alter table public.subscriptions add column if not exists payer_email      text;
alter table public.subscriptions add column if not exists payer_phone      text;
alter table public.subscriptions add column if not exists student_name     text;  -- se llena al eliminar al estudiante

-- ============================================================================
-- 3. El pago se desliga del estudiante y CONGELA a quién correspondía
-- ============================================================================
alter table public.subscriptions alter column student_id drop not null;
alter table public.payments      alter column student_id drop not null;

do $$
declare r record;
begin
  for r in
    select conname, conrelid::regclass::text as tbl
    from pg_constraint
    where contype = 'f'
      and confrelid = 'public.students'::regclass
      and conrelid in ('public.subscriptions'::regclass, 'public.payments'::regclass)
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

alter table public.subscriptions
  add constraint subscriptions_student_id_fkey
  foreign key (student_id) references public.students(id) on delete set null;

alter table public.payments
  add constraint payments_student_id_fkey
  foreign key (student_id) references public.students(id) on delete set null;

-- El "un pago aprobado por periodo" pasa de índice único rígido a regla en
-- record_payment (así, tras un reverso, se puede volver a registrar ese mes).
drop index if exists public.payments_period_uindex;
create index if not exists payments_period_idx
  on public.payments(subscription_id, period_month);

-- Copia congelada dentro de cada pago (auto-suficiente para el libro).
alter table public.payments add column if not exists payer_name       text;
alter table public.payments add column if not exists payer_doc_type   text;
alter table public.payments add column if not exists payer_doc_number text;
alter table public.payments add column if not exists payer_email      text;
alter table public.payments add column if not exists payer_phone      text;
alter table public.payments add column if not exists student_name     text;
alter table public.payments add column if not exists student_reg      text;   -- matrícula LEF-AAAA-NNNNN
alter table public.payments add column if not exists receipt_number   text;   -- consecutivo REC-AAAA-NNNNN
alter table public.payments add column if not exists reverses_payment uuid references public.payments(id) on delete set null;

-- ============================================================================
-- 4. CONSECUTIVO de recibo
-- ============================================================================
create table if not exists public.receipt_counters (
  year     integer primary key,
  next_seq integer not null default 1
);
alter table public.receipt_counters enable row level security;  -- sin políticas: solo funciones SECURITY DEFINER

create or replace function public.next_receipt_number()
  returns text language plpgsql security definer set search_path = public as $$
declare v_year int := extract(year from now())::int; v_seq int;
begin
  insert into public.receipt_counters (year, next_seq) values (v_year, 2)
  on conflict (year) do update set next_seq = public.receipt_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return 'REC-' || v_year || '-' || lpad(v_seq::text, 5, '0');
end;
$$;
revoke all on function public.next_receipt_number() from public, anon, authenticated;

-- ============================================================================
-- 5. BACKFILL de datos de prueba ya existentes (antes de blindar los pagos)
-- ============================================================================
update public.subscriptions sub set
  payer_name       = coalesce(sub.payer_name, st.full_name),
  payer_email      = coalesce(sub.payer_email, st.email),
  payer_phone      = coalesce(sub.payer_phone, st.whatsapp),
  payer_doc_type   = coalesce(sub.payer_doc_type, st.doc_type),
  payer_doc_number = coalesce(sub.payer_doc_number, st.doc_number)
from public.students st
where st.id = sub.student_id and sub.payer_name is null;

update public.payments p set
  payer_name       = coalesce(p.payer_name, st.full_name),
  payer_email      = coalesce(p.payer_email, st.email),
  payer_phone      = coalesce(p.payer_phone, st.whatsapp),
  payer_doc_type   = coalesce(p.payer_doc_type, st.doc_type),
  payer_doc_number = coalesce(p.payer_doc_number, st.doc_number),
  student_name     = coalesce(p.student_name, st.full_name)
from public.students st
where st.id = p.student_id and p.payer_name is null;

update public.payments p set student_reg = e.registration_number
from public.enrollments e
where e.student_id = p.student_id and p.student_reg is null;

with numbered as (
  select id,
    'REC-' || to_char(paid_at, 'YYYY') || '-' ||
    lpad((row_number() over (partition by to_char(paid_at, 'YYYY')
                             order by paid_at, id))::text, 5, '0') as rn
  from public.payments
)
update public.payments p set receipt_number = n.rn
from numbered n where n.id = p.id and p.receipt_number is null;

insert into public.receipt_counters (year, next_seq)
  select extract(year from paid_at)::int, count(*) + 1
  from public.payments group by 1
on conflict (year) do update set next_seq = greatest(public.receipt_counters.next_seq, excluded.next_seq);

-- ============================================================================
-- 6. PAGOS INMUTABLES  (no UPDATE, no DELETE — salvo desligar al eliminar al estudiante)
-- ============================================================================
create or replace function public.payments_immutable()
  returns trigger language plpgsql as $$
begin
  if current_setting('lef.allow_payment_detach', true) = 'on'
     and tg_op = 'UPDATE' and old.student_id is not null and new.student_id is null then
    return new;  -- desligado por eliminación del estudiante
  end if;
  raise exception
    'LEF_PAYMENT_INMUTABLE: un pago registrado no se edita ni se borra. Usa "Reversar" para corregirlo.';
end;
$$;

drop trigger if exists trg_payments_immutable on public.payments;
create trigger trg_payments_immutable
  before update or delete on public.payments
  for each row execute function public.payments_immutable();

-- RLS: el admin lee e inserta pagos; ya no puede modificarlos ni borrarlos.
drop policy if exists "admin gestiona payments" on public.payments;
drop policy if exists "admin lee payments"      on public.payments;
drop policy if exists "admin registra payments" on public.payments;
create policy "admin lee payments" on public.payments for select to authenticated
  using (public.is_admin());
create policy "admin registra payments" on public.payments for insert to authenticated
  with check (public.is_admin());

-- ============================================================================
-- 7. create_enrollment  — ahora exige documento del estudiante
-- ============================================================================
drop function if exists public.create_enrollment(text,text,text,uuid,uuid,integer,text);

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
  v_module_id uuid;
  v_norm_email text := lower(trim(p_email));
  v_norm_phone text := regexp_replace(p_whatsapp, '\D', '', 'g');
  v_norm_doc  text := upper(regexp_replace(coalesce(p_doc_number, ''), '\s', '', 'g'));
  v_dup_reg_number text;
  v_group_id uuid;
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
         or regexp_replace(st.whatsapp, '\D', '', 'g') = v_norm_phone
         or upper(regexp_replace(st.doc_number, '\s', '', 'g')) = v_norm_doc)
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

  insert into public.students (full_name, whatsapp, email, doc_type, doc_number, age, city)
  values (trim(p_full_name), trim(p_whatsapp), trim(p_email),
          p_doc_type, trim(p_doc_number), p_age,
          nullif(trim(coalesce(p_city, '')), ''))
  returning id into v_student_id;

  v_reg_number := public.next_registration_number();

  insert into public.enrollments (registration_number, student_id, module_id, group_id, cycle_id, status)
  values (v_reg_number, v_student_id, v_module_id, v_group_id, v_cycle.id, 'Pending')
  returning id into v_enrollment_id;

  return query select v_enrollment_id, v_reg_number;
end;
$$;

revoke all on function public.create_enrollment(text,text,text,uuid,uuid,text,text,integer,text) from public, anon;
grant execute on function public.create_enrollment(text,text,text,uuid,uuid,text,text,integer,text) to anon, authenticated;

-- ============================================================================
-- 8. record_payment  — congela al pagador y asigna consecutivo
-- ============================================================================
drop function if exists public.record_payment(uuid,numeric,text,date,text,text);

create or replace function public.record_payment(
  p_subscription_id uuid, p_amount numeric, p_method text,
  p_period_month date default date_trunc('month', now())::date,
  p_reference text default null, p_notes text default null,
  p_payer_name text default null, p_payer_doc_type text default null,
  p_payer_doc_number text default null, p_payer_email text default null,
  p_payer_phone text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_reg text;
  v_payment_id uuid;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  -- ¿ya hay un pago aprobado y no reversado para ese mes?
  if exists (
    select 1 from public.payments p
    where p.subscription_id = p_subscription_id
      and p.period_month = date_trunc('month', p_period_month)::date
      and p.status = 'approved'
      and not exists (select 1 from public.payments r where r.reverses_payment = p.id)
  ) then
    raise exception 'LEF_PERIOD_ALREADY_PAID';
  end if;

  select e.registration_number into v_reg
  from public.enrollments e
  where e.student_id = v_sub.student_id and e.status <> 'Cancelled'
  order by e.created_at desc limit 1;

  insert into public.payments (
    subscription_id, student_id, amount, currency, period_month, method, status,
    reference, notes, recorded_by, receipt_number,
    payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone,
    student_name, student_reg)
  values (
    p_subscription_id, v_sub.student_id, p_amount, v_sub.currency,
    date_trunc('month', p_period_month)::date, p_method, 'approved',
    p_reference, p_notes, auth.uid(), public.next_receipt_number(),
    coalesce(nullif(trim(coalesce(p_payer_name,'')),''),       v_sub.payer_name),
    coalesce(nullif(trim(coalesce(p_payer_doc_type,'')),''),   v_sub.payer_doc_type),
    coalesce(nullif(trim(coalesce(p_payer_doc_number,'')),''), v_sub.payer_doc_number),
    coalesce(nullif(trim(coalesce(p_payer_email,'')),''),      v_sub.payer_email),
    coalesce(nullif(trim(coalesce(p_payer_phone,'')),''),      v_sub.payer_phone),
    coalesce(v_sub.student_name,
             (select full_name from public.students where id = v_sub.student_id)),
    v_reg)
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

revoke all on function public.record_payment(uuid,numeric,text,date,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.record_payment(uuid,numeric,text,date,text,text,text,text,text,text,text) to authenticated;

-- ============================================================================
-- 9. admin_reverse_payment  — corrección contable = asiento nuevo
-- ============================================================================
create or replace function public.admin_reverse_payment(p_payment_id uuid, p_reason text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orig public.payments%rowtype;
  v_new_id uuid;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  select * into v_orig from public.payments where id = p_payment_id;
  if not found then raise exception 'LEF_PAYMENT_NOT_FOUND'; end if;
  if v_orig.status = 'refunded' then raise exception 'LEF_ALREADY_REVERSED'; end if;
  if exists (select 1 from public.payments where reverses_payment = p_payment_id) then
    raise exception 'LEF_ALREADY_REVERSED';
  end if;

  insert into public.payments (
    subscription_id, student_id, amount, currency, period_month, method, status,
    reference, notes, recorded_by, receipt_number, reverses_payment,
    payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone,
    student_name, student_reg)
  values (
    v_orig.subscription_id, v_orig.student_id, v_orig.amount, v_orig.currency,
    v_orig.period_month, v_orig.method, 'refunded',
    'Reverso de ' || coalesce(v_orig.receipt_number, v_orig.id::text),
    'REVERSO — ' || coalesce(p_reason, 'sin motivo'),
    auth.uid(), public.next_receipt_number(), v_orig.id,
    v_orig.payer_name, v_orig.payer_doc_type, v_orig.payer_doc_number,
    v_orig.payer_email, v_orig.payer_phone, v_orig.student_name, v_orig.student_reg)
  returning id into v_new_id;

  return v_new_id;
end;
$$;

revoke all on function public.admin_reverse_payment(uuid, text) from public, anon;
grant execute on function public.admin_reverse_payment(uuid, text) to authenticated;

-- ============================================================================
-- 10. admin_delete_student  — borra el estudiante conservando el historial de pagos
-- ============================================================================
create or replace function public.admin_delete_student(p_student_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'LEF_STUDENT_NOT_FOUND';
  end if;

  -- conservar el nombre en las suscripciones que sobreviven (tienen pagos)
  update public.subscriptions sub
    set student_name = coalesce(sub.student_name, s.full_name)
    from public.students s
    where s.id = p_student_id and sub.student_id = p_student_id;

  -- suscripciones sin ningún pago: no tienen valor contable -> se borran
  delete from public.subscriptions sub
    where sub.student_id = p_student_id
      and not exists (select 1 from public.payments p where p.subscription_id = sub.id);

  -- inscripciones: son registro académico, no contable -> se borran
  delete from public.enrollments where student_id = p_student_id;

  -- permitir que el trigger de inmutabilidad deje desligar los pagos
  perform set_config('lef.allow_payment_detach', 'on', true);

  -- al borrar al estudiante, las FK 'on delete set null' desligan
  -- las suscripciones y pagos que quedan (historial contable fijo)
  delete from public.students where id = p_student_id;
end;
$$;

revoke all on function public.admin_delete_student(uuid) from public, anon;
grant execute on function public.admin_delete_student(uuid) to authenticated;

-- ============================================================================
-- 11. admin_billing_overview  — sobrevive a estudiantes eliminados
-- ============================================================================
drop function if exists public.admin_billing_overview();
create or replace function public.admin_billing_overview()
  returns table(subscription_id uuid, student_id uuid, module_id uuid,
                student_name text, student_email text, student_deleted boolean,
                payer_name text, payer_doc_type text, payer_doc_number text,
                payer_email text, payer_phone text,
                module_label text, monthly_amount numeric, currency text, status text,
                next_due_date date, last_payment_at timestamptz, last_payment_amount numeric,
                is_overdue boolean)
  language sql stable security definer set search_path = public as $$
  select sub.id, st.id, sub.module_id,
         coalesce(st.full_name, sub.student_name, '(estudiante eliminado)'),
         st.email,
         (sub.student_id is null),
         sub.payer_name, sub.payer_doc_type, sub.payer_doc_number,
         sub.payer_email, sub.payer_phone,
         coalesce(m.level || ' · ' || m.title, sub.description) as module_label,
         sub.monthly_amount, sub.currency, sub.status, sub.next_due_date,
         lp.paid_at, lp.amount,
         (sub.status = 'active' and sub.next_due_date is not null
          and current_date > sub.next_due_date + sub.grace_days)
  from public.subscriptions sub
  left join public.students st on st.id = sub.student_id
  left join public.modules m on m.id = sub.module_id
  left join lateral (
    select paid_at, amount from public.payments p
    where p.subscription_id = sub.id and p.status = 'approved'
    order by p.paid_at desc limit 1
  ) lp on true
  where public.is_admin()
  order by (sub.student_id is null), coalesce(st.full_name, sub.student_name);
$$;
grant execute on function public.admin_billing_overview() to authenticated;
