-- LEF — Asignar un módulo desde Estudiantes también genera su mensualidad.
--
-- Problema (reportado por el usuario el 26 sep 2026 con el estudiante "Liam"):
-- Estudiantes → Editar → otro módulo creaba la inscripción "pendiente de
-- pago" (admin_assign_module) pero NO la mensualidad: el estudiante veía el
-- aviso de pago pendiente en Mi curso y nada que pagar en Facturación. La
-- mensualidad solo nacía con Pagos → "Generar pago" o con la auto-inscripción
-- del estudiante (self_enroll_next_module).
--
-- Ahora:
--   * admin_assign_module deja SIEMPRE la inscripción pendiente con su
--     mensualidad (precio fijo; pagador = el de su última mensualidad, o el
--     propio estudiante si nunca tuvo una), igual que la auto-inscripción.
--   * Pagos → "Generar pago" no duplica: si esa inscripción ya tiene una
--     mensualidad sin pagos, la reutiliza y le pone los datos del pagador que
--     se escribieron en el formulario.
--   * Arreglo de lo que ya pasó: toda inscripción pendiente de pago sin
--     ninguna mensualidad recibe la suya.

-- ============================================================================
-- 1. Mensualidad de una inscripción (si no tiene ninguna)
-- ============================================================================
create or replace function public.lef_ensure_subscription(p_enrollment_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr record; v_prev record; v_st record; v_sub uuid;
begin
  select id, student_id, module_id into v_enr from public.enrollments where id = p_enrollment_id;
  if v_enr.id is null then return null; end if;

  select id into v_sub from public.subscriptions where enrollment_id = p_enrollment_id
    order by created_at desc limit 1;
  if v_sub is not null then return v_sub; end if;

  -- Mensualidad antigua del mismo módulo que quedó sin ligar a su inscripción:
  -- se liga a esta en vez de crear otra.
  select id into v_sub from public.subscriptions
    where student_id = v_enr.student_id and module_id = v_enr.module_id
      and enrollment_id is null and status <> 'cancelled'
    order by created_at desc limit 1;
  if v_sub is not null then
    update public.subscriptions set enrollment_id = v_enr.id, updated_at = now() where id = v_sub;
    return v_sub;
  end if;

  -- Pagador: el de su última mensualidad; si no tiene, el propio estudiante.
  select payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone into v_prev
    from public.subscriptions
    where student_id = v_enr.student_id and payer_name is not null
    order by created_at desc limit 1;
  if v_prev.payer_name is null then
    select full_name as payer_name, doc_type as payer_doc_type, doc_number as payer_doc_number,
           email as payer_email, whatsapp as payer_phone into v_prev
      from public.students where id = v_enr.student_id;
  end if;

  insert into public.subscriptions (student_id, enrollment_id, module_id, monthly_amount, currency,
                                    payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone)
  values (v_enr.student_id, v_enr.id, v_enr.module_id, public.lef_monthly_price(), 'COP',
          v_prev.payer_name, v_prev.payer_doc_type, v_prev.payer_doc_number, v_prev.payer_email, v_prev.payer_phone)
  returning id into v_sub;
  return v_sub;
end;
$$;

revoke all on function public.lef_ensure_subscription(uuid) from public, anon, authenticated;

-- ============================================================================
-- 2. Estudiantes → Editar → módulo: inscripción + mensualidad
-- ============================================================================
create or replace function public.admin_assign_module(p_student_id uuid, p_module_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_current_module uuid; v_current_status text; v_reg text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then return null; end if;

  select id, module_id, status into v_enr, v_current_module, v_current_status
    from public.enrollments
    where student_id = p_student_id and status in ('PendingPayment', 'Active')
    order by created_at desc limit 1;

  if v_enr is not null and v_current_module = p_module_id then
    return v_enr; -- sin cambios
  end if;

  if exists (select 1 from public.enrollments
             where student_id = p_student_id and module_id = p_module_id and status = 'Completed') then
    raise exception 'LEF_MODULE_ALREADY_COMPLETED';
  end if;

  if v_enr is not null and v_current_status = 'Active' then
    -- dos pasos: primero se completa (foto hist_* con el grupo todavía
    -- puesto), después se suelta el grupo/ciclo
    update public.enrollments set status = 'Completed', completed_at = now() where id = v_enr;
    update public.enrollments set group_id = null, cycle_id = null where id = v_enr;
    v_enr := null;
  end if;

  if v_enr is not null then
    -- 'PendingPayment' (nunca se activó): se corrige en el sitio, y su
    -- mensualidad sin pagos se mueve al módulo nuevo para no quedar cruzada
    update public.enrollments
      set module_id = p_module_id, group_id = null, cycle_id = null
      where id = v_enr;
    update public.subscriptions sub set module_id = p_module_id, updated_at = now()
      where sub.enrollment_id = v_enr
        and not exists (select 1 from public.payments p where p.subscription_id = sub.id);
    perform public.lef_ensure_subscription(v_enr);
    return v_enr;
  end if;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, p_student_id, p_module_id, 'PendingPayment')
    returning id into v_enr;
  perform public.lef_ensure_subscription(v_enr);
  return v_enr;
end;
$$;

revoke all on function public.admin_assign_module(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_module(uuid, uuid) to authenticated;

-- ============================================================================
-- 3. Pagos → "Generar pago": sin mensualidades duplicadas
-- ============================================================================
create or replace function public.admin_create_subscription(
  p_student_id uuid, p_module_id uuid, p_monthly_amount numeric,
  p_payer_name text, p_payer_doc_type text, p_payer_doc_number text,
  p_payer_email text default null, p_payer_phone text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_sub uuid; v_completed boolean := false;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then raise exception 'LEF_INVALID_MODULE'; end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'LEF_STUDENT_NOT_FOUND';
  end if;

  select id into v_enr from public.enrollments
    where student_id = p_student_id and module_id = p_module_id and status = 'Completed'
    order by created_at desc limit 1;
  v_completed := v_enr is not null;

  if v_enr is null then
    v_enr := public.admin_assign_module(p_student_id, p_module_id);
  end if;

  -- Módulo en curso o pendiente: si ya tiene una mensualidad sin pagos (p. ej.
  -- la que creó admin_assign_module), se usa esa con el pagador del formulario.
  if not v_completed then
    select sub.id into v_sub from public.subscriptions sub
      where sub.enrollment_id = v_enr and sub.status <> 'cancelled'
        and not exists (select 1 from public.payments p where p.subscription_id = sub.id)
      order by sub.created_at desc limit 1;
    if v_sub is not null then
      update public.subscriptions
        set payer_name = p_payer_name, payer_doc_type = p_payer_doc_type, payer_doc_number = p_payer_doc_number,
            payer_email = p_payer_email, payer_phone = p_payer_phone, updated_at = now()
        where id = v_sub;
      return v_sub;
    end if;
  end if;

  insert into public.subscriptions (student_id, enrollment_id, module_id, monthly_amount, currency,
                                    payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone)
  values (p_student_id, v_enr, p_module_id, public.lef_monthly_price(), 'COP',
          p_payer_name, p_payer_doc_type, p_payer_doc_number, p_payer_email, p_payer_phone)
  returning id into v_sub;
  return v_sub;
end;
$$;

revoke all on function public.admin_create_subscription(uuid, uuid, numeric, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_subscription(uuid, uuid, numeric, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 4. Arreglo: inscripciones pendientes de pago que quedaron sin mensualidad
-- ============================================================================
select public.lef_ensure_subscription(e.id)
from public.enrollments e
where e.status = 'PendingPayment'
  and not exists (select 1 from public.subscriptions s where s.enrollment_id = e.id);
