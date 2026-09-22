-- LEF — un abono parcial ya activa al estudiante en el sistema.
--
-- Pedido del usuario (21 sep 2026): hasta ahora record_payment/record_wompi_payment
-- solo pasaban la inscripción a 'Active' cuando la SUMA de pagos llegaba a
-- monthly_amount (ver 20260918000000). En la práctica eso dejaba al estudiante
-- "pendiente de pago" en el sistema aunque ya hubiera entregado un abono. Ahora
-- CUALQUIER pago aprobado (> 0) activa la inscripción de una vez; el estado de
-- "pago parcial" vs "al día" lo sigue mostrando el panel/portal por separado
-- (admin_billing_overview / get_my_billing, sin cambios) comparando paid_amount
-- contra monthly_amount, así que no se pierde la visibilidad de que queda saldo.
--
-- El guardarraíl de no poder sobrepagar una suscripción ya completa
-- (LEF_SUBSCRIPTION_ALREADY_PAID) se mantiene igual en record_payment.

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
  v_paid_before numeric;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  select coalesce(sum(p.amount), 0) into v_paid_before
  from public.payments p
  where p.subscription_id = p_subscription_id
    and p.status = 'approved'
    and not exists (select 1 from public.payments r where r.reverses_payment = p.id);

  if v_paid_before >= v_sub.monthly_amount then
    raise exception 'LEF_SUBSCRIPTION_ALREADY_PAID';
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
  set status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  -- Antes: solo activaba al completar monthly_amount. Ahora: cualquier abono
  -- aprobado activa la inscripción; "pago parcial" vs "al día" lo sigue
  -- mostrando el panel/portal comparando paid_amount contra monthly_amount.
  if p_amount > 0 then
    update public.enrollments set status = 'Active'
      where student_id = v_sub.student_id and status = 'PendingPayment';
  end if;

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
                               period_month, method, status, reference, gateway_txn_id, notes,
                               receipt_number)
  values (p_subscription_id, v_sub.student_id, p_amount, p_currency,
          date_trunc('month', now())::date, p_method, 'approved',
          p_reference, p_gateway_txn_id, 'Pago en línea vía Wompi',
          public.next_receipt_number())
  returning id into v_payment_id;

  update public.subscriptions
  set status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  -- Antes: solo activaba al completar monthly_amount. Ahora: cualquier abono
  -- aprobado activa la inscripción (wompi-checkout ya solo cobra el saldo
  -- pendiente, así que esto también cubre el pago que completa la mensualidad).
  if p_amount > 0 then
    update public.enrollments set status = 'Active'
      where student_id = v_sub.student_id and status = 'PendingPayment';
  end if;

  return v_payment_id;
end;
$$;
