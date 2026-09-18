-- LEF — Pagos parciales (abonos) sin fechas fijas de cobro.
--
-- Pedido del usuario (17 sep 2026): ya no hay "día de cobro" ni "días de
-- gracia" por suscripción. Cada suscripción ("Generar pago" en el panel) es
-- el cobro de UN módulo; se puede completar con uno o varios abonos. Mientras
-- la suma de pagos aprobados no alcance monthly_amount, la suscripción queda
-- en "pago parcial" y la inscripción NO se activa (el estudiante no obtiene
-- acceso al curso). Solo al completarse el valor se activa el acceso.
--
-- De paso se retira "Congelar cuentas vencidas" (dependía de next_due_date +
-- grace_days, ambos eliminados). Congelar una cuenta sigue existiendo como
-- acción manual del admin (Editar suscripción -> Estado: Congelada).
--
-- Hallazgo importante mientras se hacía este cambio: desde la migración
-- 20260906150000, record_payment quedó con DOS versiones sobrecargadas -- la
-- de 11 parámetros (con datos del pagador y número de recibo, la que de
-- verdad invoca el panel en Pagos -> "Registrar pago") y una de 6 parámetros
-- agregada después (sin pagador ni recibo) que sí activaba la inscripción a
-- "Active" pero que, al tener una firma distinta, NUNCA llegó a invocarse
-- (Postgres la dejó como una segunda función en vez de reemplazar la
-- primera). Resultado: un pago manual registrado desde el panel nunca
-- activaba el curso del estudiante -- lo hacía únicamente el pago en línea
-- por Wompi (record_wompi_payment, función aparte). Esta migración limpia
-- esa duplicidad y deja una sola versión de record_payment, con la lógica de
-- activación (ahora basada en el total pagado, no en "cualquier pago").

-- ============================================================================
-- 1. Quitar la congelación automática por fecha.
-- ============================================================================
drop function if exists public.freeze_overdue_subscriptions();

-- ============================================================================
-- 2. Quitar la sobrecarga vieja de record_payment (nunca se invocaba desde
--    el panel, pero activaba la inscripción sin registrar pagador ni recibo).
-- ============================================================================
drop function if exists public.record_payment(uuid,numeric,text,date,text,text);

-- ============================================================================
-- 3. subscriptions ya no necesita día de cobro / gracia / próximo vencimiento.
-- ============================================================================
alter table public.subscriptions drop column if exists billing_day;
alter table public.subscriptions drop column if exists grace_days;
alter table public.subscriptions drop column if exists next_due_date;

-- ============================================================================
-- 4. record_payment — activa la inscripción solo cuando la SUMA de pagos
--    aprobados (sin contar los reversados) llega a monthly_amount. Un abono
--    parcial se registra igual (para el libro contable) pero no activa nada.
--    Ya no se puede sobrepagar una suscripción ya completa.
-- ============================================================================
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

  if v_paid_before + p_amount >= v_sub.monthly_amount then
    update public.enrollments set status = 'Active'
      where student_id = v_sub.student_id and status = 'PendingPayment';
  end if;

  return v_payment_id;
end;
$$;

revoke all on function public.record_payment(uuid,numeric,text,date,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.record_payment(uuid,numeric,text,date,text,text,text,text,text,text,text) to authenticated;

-- ============================================================================
-- 5. record_wompi_payment — mismo criterio (suma vs. mensualidad) en vez de
--    activar siempre con cualquier pago; ya no toca next_due_date (columna
--    eliminada). El widget de Wompi hoy siempre cobra el valor completo, así
--    que en la práctica esto no cambia su comportamiento normal.
-- ============================================================================
create or replace function public.record_wompi_payment(
  p_subscription_id uuid, p_amount numeric, p_currency text, p_method text,
  p_gateway_txn_id text, p_reference text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_payment_id uuid;
  v_existing uuid;
  v_paid_before numeric;
begin
  -- Idempotencia: si Wompi reintenta el webhook, no duplicar el pago.
  select id into v_existing from public.payments where gateway_txn_id = p_gateway_txn_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  select coalesce(sum(p.amount), 0) into v_paid_before
  from public.payments p
  where p.subscription_id = p_subscription_id
    and p.status = 'approved'
    and not exists (select 1 from public.payments r where r.reverses_payment = p.id);

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

  if v_paid_before + p_amount >= v_sub.monthly_amount then
    update public.enrollments set status = 'Active'
      where student_id = v_sub.student_id and status = 'PendingPayment';
  end if;

  return v_payment_id;
end;
$$;

-- ============================================================================
-- 6. admin_billing_overview — quita next_due_date/is_overdue, agrega
--    paid_amount (suma de pagos aprobados sin contar reversados) para que el
--    panel muestre el progreso del abono y derive el estado (pendiente /
--    pago parcial / al día) sin fechas de por medio.
-- ============================================================================
drop function if exists public.admin_billing_overview();
create or replace function public.admin_billing_overview()
  returns table(subscription_id uuid, student_id uuid, module_id uuid,
                student_name text, student_email text, student_deleted boolean,
                payer_name text, payer_doc_type text, payer_doc_number text,
                payer_email text, payer_phone text,
                module_label text, monthly_amount numeric, currency text, status text,
                paid_amount numeric, last_payment_at timestamptz, last_payment_amount numeric)
  language sql stable security definer set search_path = public as $$
  select sub.id, st.id, sub.module_id,
         coalesce(st.full_name, sub.student_name, '(estudiante eliminado)'),
         st.email,
         (sub.student_id is null),
         sub.payer_name, sub.payer_doc_type, sub.payer_doc_number,
         sub.payer_email, sub.payer_phone,
         coalesce(m.level || ' · ' || m.title, sub.description) as module_label,
         sub.monthly_amount, sub.currency, sub.status,
         coalesce(pd.paid_amount, 0),
         lp.paid_at, lp.amount
  from public.subscriptions sub
  left join public.students st on st.id = sub.student_id
  left join public.modules m on m.id = sub.module_id
  left join lateral (
    select paid_at, amount from public.payments p
    where p.subscription_id = sub.id and p.status = 'approved'
    order by p.paid_at desc limit 1
  ) lp on true
  left join lateral (
    select sum(p.amount) as paid_amount from public.payments p
    where p.subscription_id = sub.id and p.status = 'approved'
      and not exists (select 1 from public.payments r where r.reverses_payment = p.id)
  ) pd on true
  where public.is_admin()
  order by (sub.student_id is null), coalesce(st.full_name, sub.student_name);
$$;
grant execute on function public.admin_billing_overview() to authenticated;

-- ============================================================================
-- 7. get_my_billing — mismo ajuste para el portal del estudiante: quita
--    next_due_date/billing_day/grace_days, agrega paid_amount.
-- ============================================================================
create or replace function public.get_my_billing()
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'student', (select to_jsonb(s) from (
        select st.full_name, st.email, st.whatsapp, st.age, st.city from public.students st
        where st.id = public.current_student_id()) s),
    'subscriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', sub.id, 'monthly_amount', sub.monthly_amount, 'currency', sub.currency,
          'status', sub.status, 'started_at', sub.started_at, 'description', sub.description,
          'module_id', sub.module_id, 'module_level', m.level, 'module_title', m.title,
          'paid_amount', coalesce((
            select sum(p.amount) from public.payments p
            where p.subscription_id = sub.id and p.status = 'approved'
              and not exists (select 1 from public.payments r where r.reverses_payment = p.id)
          ), 0)
        ) order by sub.created_at)
        from public.subscriptions sub
        left join public.modules m on m.id = sub.module_id
        where sub.student_id = public.current_student_id()
      ), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(p) order by p.paid_at desc)
        from public.payments p where p.student_id = public.current_student_id()), '[]'::jsonb)
  );
$$;
