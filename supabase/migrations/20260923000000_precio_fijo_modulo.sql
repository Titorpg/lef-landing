-- LEF — el módulo siguiente se cobra al precio fijo, no al de la mensualidad anterior.
--
-- Pedido del usuario (23 sep 2026): la auto-matrícula del portal ("Matricular
-- el siguiente curso") copiaba el monto de la última mensualidad del
-- estudiante — con Liam eso daba 20.000 COP, que era solo un valor de prueba.
-- El cobro debe salir siempre del precio establecido para los módulos:
-- 297.500 COP por mensualidad (el mismo que ya usa "Crear estudiante" desde
-- una pre-inscripción). Queda en una sola función para cambiarlo en un solo
-- sitio si algún día sube. Los datos de QUIÉN PAGA sí se siguen copiando de
-- la última mensualidad (eso no es precio).

create or replace function public.lef_monthly_price()
  returns numeric language sql immutable as $$
  select 297500::numeric;
$$;

grant execute on function public.lef_monthly_price() to authenticated;

create or replace function public.get_next_module_offer()
  returns table(next_module_id uuid, next_module_level text, next_module_title text,
                suggested_amount numeric, suggested_currency text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_next uuid;
begin
  if v_student is null then return; end if;
  if public.lef_student_has_current(v_student) then return; end if;

  v_next := public.lef_next_module_for(v_student);
  if v_next is null then return; end if;

  return query select m.id, m.level, m.title, public.lef_monthly_price(), 'COP'::text
  from public.modules m where m.id = v_next;
end;
$$;

grant execute on function public.get_next_module_offer() to authenticated;

create or replace function public.self_enroll_next_module()
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_next uuid;
  v_prev_sub record;
  v_reg text;
  v_new_enr uuid;
begin
  if v_student is null then raise exception 'LEF_NOT_ALLOWED'; end if;

  perform public.close_ended_cycles();

  if public.lef_student_has_current(v_student) then
    raise exception 'LEF_COURSE_NOT_DONE';
  end if;

  v_next := public.lef_next_module_for(v_student);
  if v_next is null then raise exception 'LEF_NO_NEXT_MODULE'; end if;

  -- Por si quedó un 'Active' con el ciclo vencido sin cerrar todavía
  update public.enrollments set status = 'Completed', completed_at = now()
    where student_id = v_student and status = 'Active';

  -- Solo los datos del pagador salen de la última mensualidad; el monto no.
  select payer_name, payer_doc_type, payer_doc_number, payer_email, payer_phone
    into v_prev_sub
  from public.subscriptions
  where student_id = v_student
  order by created_at desc limit 1;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, v_student, v_next, 'PendingPayment')
    returning id into v_new_enr;

  insert into public.subscriptions (student_id, enrollment_id, module_id, monthly_amount, currency,
                                     payer_name, payer_doc_type, payer_doc_number,
                                     payer_email, payer_phone)
  values (v_student, v_new_enr, v_next, public.lef_monthly_price(), 'COP',
          v_prev_sub.payer_name, v_prev_sub.payer_doc_type, v_prev_sub.payer_doc_number,
          v_prev_sub.payer_email, v_prev_sub.payer_phone);

  return v_new_enr;
end;
$$;

revoke all on function public.self_enroll_next_module() from public, anon;
grant execute on function public.self_enroll_next_module() to authenticated;
