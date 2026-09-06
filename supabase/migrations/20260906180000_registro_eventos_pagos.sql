-- LEF — Registro de eventos + el admin puede corregir pagos y suscripciones
-- de verdad (borrar/editar), no solo reversar.
--
-- Motivo (pedido del usuario, 6 sep 2026): los pagos eran 100% inmutables
-- (ni el admin podía borrarlos ni editarlos, solo "Reversar"). Eso impedía
-- limpiar datos de prueba y corregir errores reales de captura. La regla
-- nueva: el admin SÍ puede borrar/editar pagos y suscripciones, pero SOLO
-- a través de estas funciones, que exigen un motivo y dejan un registro
-- permanente en audit_log ANTES de tocar el dato. audit_log no lo puede
-- editar ni borrar nadie (ni el admin) — así queda la prueba de qué se hizo
-- y por qué, aunque el dato original ya no exista.

-- ============================================================================
-- 1. audit_log — append-only, nadie lo edita ni lo borra
-- ============================================================================
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_email   text,
  action        text not null,          -- ej: 'payment.delete', 'payment.update', 'subscription.delete'
  target_table  text not null,
  target_id     uuid,
  reason        text not null,
  details       jsonb                   -- copia del registro afectado antes del cambio
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "admin lee audit_log" on public.audit_log;
create policy "admin lee audit_log" on public.audit_log
  for select to authenticated using (public.is_admin());
-- Sin política de insert/update/delete para clientes: solo entra por las
-- funciones SECURITY DEFINER de abajo (que corren con privilegios propios).

-- ============================================================================
-- 2. payments_immutable — ahora también se abre cuando una función admin
--    vetada (que ya registró en audit_log) lo autoriza para ESTA transacción.
-- ============================================================================
create or replace function public.payments_immutable()
  returns trigger language plpgsql as $$
begin
  if current_setting('lef.allow_payment_detach', true) = 'on'
     and tg_op = 'UPDATE' and old.student_id is not null and new.student_id is null then
    return coalesce(new, old);  -- desligado por eliminación del estudiante
  end if;
  if current_setting('lef.allow_admin_payment_edit', true) = 'on' then
    return coalesce(new, old);  -- corrección/borrado admin, ya registrado en audit_log
  end if;
  raise exception
    'LEF_PAYMENT_INMUTABLE: un pago registrado no se edita ni se borra directamente. Usa "Reversar", "Editar" o "Eliminar".';
end;
$$;

-- ============================================================================
-- 3. admin_delete_payment — borra un pago de verdad, con motivo obligatorio
-- ============================================================================
create or replace function public.admin_delete_payment(p_payment_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.payments%rowtype;
  v_email text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'LEF_REASON_REQUIRED'; end if;

  select * into v_row from public.payments where id = p_payment_id;
  if not found then raise exception 'LEF_PAYMENT_NOT_FOUND'; end if;

  select email into v_email from public.profiles where user_id = auth.uid();

  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'payment.delete', 'payments', p_payment_id, trim(p_reason), to_jsonb(v_row));

  perform set_config('lef.allow_admin_payment_edit', 'on', true);
  delete from public.payments where id = p_payment_id;
end;
$$;

revoke all on function public.admin_delete_payment(uuid, text) from public, anon;
grant execute on function public.admin_delete_payment(uuid, text) to authenticated;

-- ============================================================================
-- 4. admin_update_payment — corrige monto/método/mes/notas de un pago,
--    con motivo obligatorio (para errores de captura reales).
-- ============================================================================
create or replace function public.admin_update_payment(
  p_payment_id uuid, p_reason text,
  p_amount numeric default null, p_method text default null,
  p_period_month date default null, p_notes text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_before public.payments%rowtype;
  v_email text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'LEF_REASON_REQUIRED'; end if;

  select * into v_before from public.payments where id = p_payment_id;
  if not found then raise exception 'LEF_PAYMENT_NOT_FOUND'; end if;

  select email into v_email from public.profiles where user_id = auth.uid();

  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'payment.update', 'payments', p_payment_id, trim(p_reason), jsonb_build_object(
    'before', to_jsonb(v_before),
    'new_amount', p_amount, 'new_method', p_method,
    'new_period_month', p_period_month, 'new_notes', p_notes));

  perform set_config('lef.allow_admin_payment_edit', 'on', true);
  update public.payments set
    amount = coalesce(p_amount, amount),
    method = coalesce(p_method, method),
    period_month = coalesce(p_period_month, period_month),
    notes = coalesce(p_notes, notes)
  where id = p_payment_id;
end;
$$;

revoke all on function public.admin_update_payment(uuid,text,numeric,text,date,text) from public, anon;
grant execute on function public.admin_update_payment(uuid,text,numeric,text,date,text) to authenticated;

-- ============================================================================
-- 5. admin_delete_subscription — reemplaza el DELETE directo desde el
--    cliente; exige motivo y deja registro. Sigue sin poder borrarse si
--    tiene pagos (hay que borrar esos pagos primero, cada uno con su motivo).
-- ============================================================================
create or replace function public.admin_delete_subscription(p_subscription_id uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_row public.subscriptions%rowtype;
  v_email text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'LEF_REASON_REQUIRED'; end if;

  select * into v_row from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  select email into v_email from public.profiles where user_id = auth.uid();

  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'subscription.delete', 'subscriptions', p_subscription_id, trim(p_reason), to_jsonb(v_row));

  delete from public.subscriptions where id = p_subscription_id;
end;
$$;

revoke all on function public.admin_delete_subscription(uuid, text) from public, anon;
grant execute on function public.admin_delete_subscription(uuid, text) to authenticated;

-- ============================================================================
-- 6. admin_reverse_payment — se le agrega el registro en audit_log
--    (misma firma y lógica; ya pedía motivo, solo faltaba dejarlo anotado).
-- ============================================================================
create or replace function public.admin_reverse_payment(p_payment_id uuid, p_reason text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_orig public.payments%rowtype;
  v_new_id uuid;
  v_email text;
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

  select email into v_email from public.profiles where user_id = auth.uid();
  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'payment.reverse', 'payments', p_payment_id,
    coalesce(nullif(trim(p_reason), ''), 'sin motivo'), to_jsonb(v_orig));

  return v_new_id;
end;
$$;

revoke all on function public.admin_reverse_payment(uuid, text) from public, anon;
grant execute on function public.admin_reverse_payment(uuid, text) to authenticated;

-- ============================================================================
-- 7. admin_list_audit_log — para la pestaña "Registro de eventos"
-- ============================================================================
create or replace function public.admin_list_audit_log(p_limit integer default 200)
  returns setof public.audit_log
  language sql stable security definer set search_path = public as $$
  select * from public.audit_log
  where public.is_admin()
  order by created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.admin_list_audit_log(integer) from public, anon;
grant execute on function public.admin_list_audit_log(integer) to authenticated;
