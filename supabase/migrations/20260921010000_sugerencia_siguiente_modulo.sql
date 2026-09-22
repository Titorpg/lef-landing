-- LEF — sugerencia de auto-matrícula al siguiente módulo, en "Mi curso".
--
-- Pedido del usuario (21 sep 2026): hoy solo el admin matricula al estudiante
-- en el siguiente módulo (admin_assign_module, manual). Si el estudiante ya
-- terminó su módulo actual y el admin todavía no le ha asignado el
-- siguiente, "Mi curso" debe ofrecerle un botón "Matricular el siguiente
-- curso" que cree su inscripción + mensualidad del módulo que sigue en el
-- orden jerárquico (module_number + 1), para que la pague desde Facturación
-- y se active sola (igual que cualquier otra mensualidad).
--
-- "Terminó su módulo actual" = mismo criterio que ya usa el portal
-- (isCourseDone en lef-portal.js) para mostrar el chulo verde: la
-- inscripción quedó 'Completed', O sigue 'Active' pero el ciclo asignado ya
-- terminó (el admin no ha llegado a archivarla todavía). Si el admin YA
-- asignó el siguiente módulo a mano, la inscripción más reciente del
-- estudiante deja de ser esa y la sugerencia desaparece sola (no hay nada
-- que limpiar aparte).

-- ============================================================================
-- 1. get_next_module_offer() — de solo lectura, la consulta "Mi curso" para
--    decidir si mostrar la sugerencia y con qué datos.
-- ============================================================================
create or replace function public.get_next_module_offer()
  returns table(next_module_id uuid, next_module_level text, next_module_title text,
                suggested_amount numeric, suggested_currency text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_enr record;
  v_done boolean := false;
  v_next record;
  v_prev_sub record;
begin
  if v_student is null then return; end if;

  select e.id, e.module_id, e.status, e.cycle_id, m.module_number
    into v_enr
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  where e.student_id = v_student and e.status <> 'Cancelled'
  order by e.created_at desc limit 1;

  if not found then return; end if;

  if v_enr.status = 'Completed' then
    v_done := true;
  elsif v_enr.status = 'Active' and v_enr.cycle_id is not null then
    select (c.end_date < current_date) into v_done
    from public.cycles c where c.id = v_enr.cycle_id;
  end if;

  if not coalesce(v_done, false) then return; end if;

  select id, level, title into v_next
  from public.modules
  where module_number = v_enr.module_number + 1 and active = true;

  if not found then return; end if;

  select monthly_amount, currency into v_prev_sub
  from public.subscriptions
  where student_id = v_student and module_id = v_enr.module_id
  order by created_at desc limit 1;

  return query select v_next.id, v_next.level, v_next.title,
    coalesce(v_prev_sub.monthly_amount, 297500::numeric), coalesce(v_prev_sub.currency, 'COP');
end;
$$;

grant execute on function public.get_next_module_offer() to authenticated;

-- ============================================================================
-- 2. self_enroll_next_module() — crea la inscripción + suscripción del
--    siguiente módulo. Repite el mismo chequeo de "terminó su módulo actual"
--    de arriba (para no confiar en lo que mandó el navegador) y, si hace
--    falta, archiva la inscripción vieja como 'Completed' recién ahí (nunca
--    antes de confirmar que existe un módulo siguiente al que pasarla).
-- ============================================================================
create or replace function public.self_enroll_next_module()
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_enr record;
  v_done boolean := false;
  v_next record;
  v_prev_sub record;
  v_reg text;
  v_new_enr uuid;
begin
  if v_student is null then raise exception 'LEF_NOT_ALLOWED'; end if;

  select e.id, e.module_id, e.status, e.cycle_id, m.module_number
    into v_enr
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  where e.student_id = v_student and e.status <> 'Cancelled'
  order by e.created_at desc limit 1;

  if not found then raise exception 'LEF_NO_ENROLLMENT'; end if;

  if v_enr.status = 'Completed' then
    v_done := true;
  elsif v_enr.status = 'Active' and v_enr.cycle_id is not null then
    select (c.end_date < current_date) into v_done
    from public.cycles c where c.id = v_enr.cycle_id;
  end if;

  if not coalesce(v_done, false) then
    raise exception 'LEF_COURSE_NOT_DONE';
  end if;

  select id, level, title into v_next
  from public.modules
  where module_number = v_enr.module_number + 1 and active = true;

  if not found then
    raise exception 'LEF_NO_NEXT_MODULE';
  end if;

  if v_enr.status = 'Active' then
    update public.enrollments set status = 'Completed', completed_at = now()
      where id = v_enr.id;
  end if;

  -- Mismo monto y datos de pagador de la mensualidad del módulo que termina,
  -- por si el admin cambió el precio para este estudiante en particular.
  select monthly_amount, currency, payer_name, payer_doc_type, payer_doc_number,
         payer_email, payer_phone
    into v_prev_sub
  from public.subscriptions
  where student_id = v_student and module_id = v_enr.module_id
  order by created_at desc limit 1;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, v_student, v_next.id, 'PendingPayment')
    returning id into v_new_enr;

  insert into public.subscriptions (student_id, module_id, monthly_amount, currency,
                                     payer_name, payer_doc_type, payer_doc_number,
                                     payer_email, payer_phone)
  values (v_student, v_next.id, coalesce(v_prev_sub.monthly_amount, 297500::numeric),
          coalesce(v_prev_sub.currency, 'COP'), v_prev_sub.payer_name,
          v_prev_sub.payer_doc_type, v_prev_sub.payer_doc_number,
          v_prev_sub.payer_email, v_prev_sub.payer_phone);

  return v_new_enr;
end;
$$;

revoke all on function public.self_enroll_next_module() from public, anon;
grant execute on function public.self_enroll_next_module() to authenticated;
