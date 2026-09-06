-- LEF — Estado de la inscripción atado al pago.
--
-- Pedido del usuario (6 sep 2026): al convertir una pre-inscripción en
-- estudiante, la inscripción queda "pendiente de pago" y la cuenta de portal
-- se crea en el mismo paso (antes eran dos pantallas separadas). En cuanto se
-- registra el primer pago del estudiante (manual o por Wompi), la inscripción
-- pasa sola a "activo". Los estados viejos (Pending/Contacted/Confirmed/Paid)
-- se reemplazan por PendingPayment/Active; 'Cancelled' se mantiene igual
-- (lo usan muchas funciones para filtrar inscripciones activas).

-- ============================================================================
-- 1. Migrar los datos existentes antes de endurecer el check
-- ============================================================================
update public.enrollments set status = 'PendingPayment'
  where status in ('Pending', 'Contacted', 'Confirmed');
update public.enrollments set status = 'Active'
  where status = 'Paid';

alter table public.enrollments drop constraint if exists enrollments_status_check;
alter table public.enrollments add constraint enrollments_status_check
  check (status in ('PendingPayment', 'Active', 'Cancelled'));

alter table public.enrollments alter column status set default 'PendingPayment';

-- ============================================================================
-- 2. create_enrollment — inserta PendingPayment en vez de Pending
--    (misma firma que 20260831180000; solo cambia el valor insertado)
-- ============================================================================
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
  values (v_reg_number, v_student_id, v_module_id, v_group_id, v_cycle_id, 'PendingPayment')
  returning id into v_enrollment_id;

  return query select v_enrollment_id, v_reg_number;
end;
$$;

-- ============================================================================
-- 3. admin_assign_module — misma firma que 20260827210000, PendingPayment
-- ============================================================================
create or replace function public.admin_assign_module(p_student_id uuid, p_module_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_reg text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then return null; end if;

  select id into v_enr from public.enrollments
    where student_id = p_student_id and status <> 'Cancelled'
    order by created_at desc limit 1;

  if v_enr is not null then
    update public.enrollments
      set module_id = p_module_id, group_id = null, cycle_id = null
      where id = v_enr;
    return v_enr;
  end if;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, p_student_id, p_module_id, 'PendingPayment')
    returning id into v_enr;
  return v_enr;
end;
$$;

-- ============================================================================
-- 4. record_payment / record_wompi_payment — activan la inscripción al pagar
-- ============================================================================
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

  update public.enrollments set status = 'Active'
    where student_id = v_sub.student_id and status = 'PendingPayment';

  return v_payment_id;
end;
$$;

create or replace function public.record_wompi_payment(
  p_subscription_id uuid, p_amount numeric, p_currency text, p_method text,
  p_gateway_txn_id text, p_reference text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_payment_id uuid;
  v_existing uuid;
begin
  -- Idempotencia: si Wompi reintenta el webhook, no duplicar el pago.
  select id into v_existing from public.payments where gateway_txn_id = p_gateway_txn_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  insert into public.payments (subscription_id, student_id, amount, currency,
                               period_month, method, status, reference, gateway_txn_id, notes)
  values (p_subscription_id, v_sub.student_id, p_amount, p_currency,
          date_trunc('month', now())::date, p_method, 'approved',
          p_reference, p_gateway_txn_id, 'Pago en línea vía Wompi')
  returning id into v_payment_id;

  update public.subscriptions
  set next_due_date = (date_trunc('month', now()) + interval '1 month')::date
                        + (billing_day - 1),
      status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  update public.enrollments set status = 'Active'
    where student_id = v_sub.student_id and status = 'PendingPayment';

  return v_payment_id;
end;
$$;
