-- LEF — corrige que los pagos hechos con Wompi nunca reciben número de recibo.
--
-- record_payment (pago manual, registrado por el admin) sí llamaba a
-- next_receipt_number() desde que existe el libro contable (20260827240000).
-- record_wompi_payment (el que usa wompi-webhook para los pagos en línea) se quedó
-- sin esa línea desde que se creó (20260831190000) — por eso el Dashboard y
-- "Ver pagos" siempre muestran "—" en la columna Recibo para pagos hechos en línea
-- con Wompi, incluido el primer pago real en producción.

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

-- Backfill: pagos aprobados que ya existen y se quedaron sin recibo. Usa el mismo
-- contador (next_receipt_number/receipt_counters) que usan los pagos nuevos, para no
-- chocar con recibos ya emitidos (a la fecha de esta migración va en REC-2026-00006).
-- Los pagos son inmutables (trigger payments_immutable, ver 20260906180000): hay que
-- abrir la misma compuerta que usan admin_update_payment/admin_delete_payment y dejar
-- rastro en audit_log antes de tocar el dato.
do $$
declare r record; v_new_receipt text;
begin
  perform set_config('lef.allow_admin_payment_edit', 'on', true);
  for r in
    select id from public.payments
    where receipt_number is null and status = 'approved'
    order by paid_at, id
  loop
    v_new_receipt := public.next_receipt_number();
    insert into public.audit_log (actor_email, action, target_table, target_id, reason, details)
    values ('sistema (migración 20260915120000)', 'payment.receipt_backfill', 'payments', r.id,
            'Recibo faltante por bug en record_wompi_payment (nunca llamaba a next_receipt_number)',
            jsonb_build_object('receipt_number_asignado', v_new_receipt));
    update public.payments set receipt_number = v_new_receipt where id = r.id;
  end loop;
end $$;
