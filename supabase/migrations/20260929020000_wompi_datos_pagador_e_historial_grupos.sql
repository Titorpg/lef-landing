-- LEF — (1) Datos del pagador en los pagos de Wompi y (2) historial del grupo al
-- borrarlo a mano (29 sep 2026, pedido del usuario tras el chequeo general).
--
-- 1. record_wompi_payment nunca copió a payments los datos del pagador (nombre,
--    documento, correo, teléfono) ni el nombre/registro del estudiante, que
--    record_payment (pago manual) sí copia de la mensualidad. Los recibos RC1 y
--    RC16 quedaron sin esos datos. Se corrige la función y se rellenan los pagos
--    afectados (queda constancia en el Registro de eventos: payment.payer_backfill).
--    Solo se llenan campos vacíos: no se cambia monto, fecha, método ni recibo.
-- 2. Borrar un grupo desde Académico → Grupos lo quitaba también de "Grupos
--    anteriores" del profesor (la foto en group_history solo se tomaba al cerrar el
--    ciclo). Ahora, antes de borrarlo, se guarda la foto si tuvo estudiantes.

-- ============================================================================
-- 1. Wompi: mismos datos que un pago manual
-- ============================================================================
create or replace function public.record_wompi_payment(
  p_subscription_id uuid, p_amount numeric, p_currency text, p_method text,
  p_gateway_txn_id text, p_reference text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_reg text;
  v_payment_id uuid;
  v_existing uuid;
begin
  select id into v_existing from public.payments where gateway_txn_id = p_gateway_txn_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

  select coalesce(
    (select e.registration_number from public.enrollments e where e.id = v_sub.enrollment_id),
    (select e.registration_number from public.enrollments e
      where e.student_id = v_sub.student_id and e.status <> 'Cancelled'
      order by e.created_at desc limit 1))
  into v_reg;

  insert into public.payments (subscription_id, student_id, amount, currency,
                               period_month, method, status, reference, gateway_txn_id, notes,
                               receipt_number,
                               payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone,
                               student_name, student_reg)
  values (p_subscription_id, v_sub.student_id, p_amount, p_currency,
          date_trunc('month', now())::date, p_method, 'approved',
          p_reference, p_gateway_txn_id, 'Pago en línea vía Wompi',
          public.next_receipt_number(),
          v_sub.payer_name, v_sub.payer_doc_type, v_sub.payer_doc_number, v_sub.payer_email, v_sub.payer_phone,
          coalesce(v_sub.student_name, (select full_name from public.students where id = v_sub.student_id)),
          v_reg)
  returning id into v_payment_id;

  update public.subscriptions
  set status = case when status = 'frozen' then 'active' else status end,
      frozen_at = null,
      updated_at = now()
  where id = p_subscription_id;

  if p_amount > 0 then
    update public.enrollments set status = 'Active'
      where student_id = v_sub.student_id and status = 'PendingPayment'
        and (id = v_sub.enrollment_id
             or (v_sub.enrollment_id is null
                 and (v_sub.module_id is null or module_id = v_sub.module_id)));
  end if;

  return v_payment_id;
end;
$$;

-- Relleno de los pagos de Wompi que quedaron sin datos (compuerta de edición
-- admin + constancia en audit_log, igual que 20260915120000).
do $$
declare r record; v_name text; v_reg text;
begin
  perform set_config('lef.allow_admin_payment_edit', 'on', true);
  for r in
    select p.id, p.receipt_number, p.student_id, s.payer_name, s.payer_doc_type, s.payer_doc_number,
           s.payer_email, s.payer_phone, s.student_name as sub_student, s.enrollment_id
    from public.payments p
    join public.subscriptions s on s.id = p.subscription_id
    where p.gateway_txn_id is not null
      and p.payer_name is null and p.student_name is null
    order by p.paid_at
  loop
    v_name := coalesce(r.sub_student, (select full_name from public.students where id = r.student_id));
    v_reg := coalesce(
      (select e.registration_number from public.enrollments e where e.id = r.enrollment_id),
      (select e.registration_number from public.enrollments e
        where e.student_id = r.student_id and e.status <> 'Cancelled'
        order by e.created_at desc limit 1));
    insert into public.audit_log (actor_email, action, target_table, target_id, reason, details)
    values ('sistema (migración 20260929020000)', 'payment.payer_backfill', 'payments', r.id,
            'Datos del pagador faltantes por bug en record_wompi_payment',
            jsonb_build_object('receipt_number', r.receipt_number, 'estudiante', v_name,
                               'pagado_por', r.payer_name, 'documento', r.payer_doc_number));
    update public.payments
       set payer_name = r.payer_name, payer_doc_type = r.payer_doc_type,
           payer_doc_number = r.payer_doc_number, payer_email = r.payer_email,
           payer_phone = r.payer_phone, student_name = v_name, student_reg = v_reg
     where id = r.id;
  end loop;
end $$;

-- ============================================================================
-- 2. Borrar un grupo a mano: queda en "Grupos anteriores" del profesor
-- ============================================================================
-- Corre antes que groups_release_enrollments_trg (orden alfabético), cuando las
-- inscripciones todavía apuntan al grupo. Si el grupo nunca tuvo estudiantes no
-- se guarda nada. lef_finish_cycle ya guarda la foto antes de borrar: no se duplica.
create or replace function public.groups_history_snapshot()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.group_history h where h.group_id = old.id) then return old; end if;
  if not exists (select 1 from public.enrollments e where e.group_id = old.id) then return old; end if;

  insert into public.group_history (group_id, teacher_id, teacher_name, module_id, module_level,
    module_title, module_number, days, start_time, end_time, capacity,
    cycle_name, cycle_start, cycle_end, students)
  select old.id, old.teacher_id, t.full_name, m.id, m.level, m.title, m.module_number,
         s.days, s.start_time, s.end_time, old.capacity,
         c.name, c.start_date, coalesce(public.lef_group_end(old.id), c.end_date),
         coalesce((select jsonb_agg(jsonb_build_object('student_id', st.id, 'name', st.full_name,
                     'result', case when e.status = 'Completed' then 'completado' else 'cancelado' end)
                   order by st.full_name)
                   from public.enrollments e join public.students st on st.id = e.student_id
                   where e.group_id = old.id), '[]'::jsonb)
  from public.schedules s
  join public.cycles c on c.id = s.cycle_id
  left join public.teachers t on t.id = old.teacher_id
  left join public.modules m on m.id = old.module_id
  where s.id = old.schedule_id;
  return old;
end;
$$;

revoke all on function public.groups_history_snapshot() from public, anon, authenticated;

drop trigger if exists groups_history_snapshot_trg on public.groups;
create trigger groups_history_snapshot_trg
  before delete on public.groups
  for each row execute function public.groups_history_snapshot();
