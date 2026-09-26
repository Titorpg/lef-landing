-- LEF — "Cambio de módulo por error": pasar la inscripción en curso a otro
-- módulo SIN cobro nuevo (pedido del usuario, 26 sep 2026).
--
-- Estudiantes → Editar → "— Cambio de módulo por error … —" + módulo correcto.
-- A diferencia de elegir otro módulo (que da por completado el actual si ya
-- estaba pagado y crea una inscripción y un cobro nuevos), aquí:
--   * la MISMA inscripción cambia de módulo (conserva su número y su estado:
--     si ya estaba pagada sigue activa);
--   * su mensualidad y sus pagos pasan con ella al módulo correcto (los pagos
--     no se tocan: están atados a la mensualidad, no al módulo);
--   * nada queda como "completado" y no se crea ningún cobro;
--   * si tenía grupo, lo suelta (el grupo es de otro módulo);
--   * queda anotado en el Registro de eventos (audit_log).
-- Requiere 20260926020000_cobro_al_asignar_modulo.sql (lef_ensure_subscription).

create or replace function public.admin_correct_module(p_student_id uuid, p_module_id uuid, p_reason text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_enr record; v_from text; v_to text; v_student text; v_group text; v_email text;
  v_subs int; v_paid boolean;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then raise exception 'LEF_INVALID_MODULE'; end if;

  select e.id, e.module_id, e.status, e.registration_number, e.group_id into v_enr
    from public.enrollments e
    where e.student_id = p_student_id and e.status in ('PendingPayment', 'Active')
    order by e.created_at desc limit 1;
  if v_enr.id is null then raise exception 'LEF_NO_CURRENT_MODULE'; end if;
  if v_enr.module_id = p_module_id then raise exception 'LEF_SAME_MODULE'; end if;
  if exists (select 1 from public.enrollments
             where student_id = p_student_id and module_id = p_module_id and status = 'Completed') then
    raise exception 'LEF_MODULE_ALREADY_COMPLETED';
  end if;

  select level || ' · ' || title into v_from from public.modules where id = v_enr.module_id;
  select level || ' · ' || title into v_to   from public.modules where id = p_module_id;
  if v_to is null then raise exception 'LEF_INVALID_MODULE'; end if;
  select full_name into v_student from public.students where id = p_student_id;
  if v_enr.group_id is not null then
    select array_to_string(sch.days, ', ') || ' ' || to_char(sch.start_time, 'HH24:MI') || coalesce(' · ' || t.full_name, '')
      into v_group
      from public.groups g join public.schedules sch on sch.id = g.schedule_id
      left join public.teachers t on t.id = g.teacher_id
      where g.id = v_enr.group_id;
  end if;
  v_paid := public.lef_enrollment_paid(v_enr.id);

  -- Mensualidades antiguas sin ligar del módulo equivocado: se ligan a esta
  -- inscripción para que el pago la siga cubriendo en el módulo correcto.
  update public.subscriptions
    set enrollment_id = v_enr.id, updated_at = now()
    where student_id = p_student_id and enrollment_id is null and module_id = v_enr.module_id;

  -- La inscripción cambia de módulo (mismo estado) y suelta el grupo/ciclo.
  update public.enrollments
    set module_id = p_module_id, group_id = null, cycle_id = null
    where id = v_enr.id;

  -- Su mensualidad (con o sin pagos) pasa al módulo correcto.
  update public.subscriptions
    set module_id = p_module_id, updated_at = now()
    where enrollment_id = v_enr.id;
  get diagnostics v_subs = row_count;

  -- Si por alguna razón no tenía mensualidad (pendiente de pago), se crea UNA.
  if v_subs = 0 and v_enr.status = 'PendingPayment' then
    perform public.lef_ensure_subscription(v_enr.id);
  end if;

  select email into v_email from public.profiles where user_id = auth.uid();
  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'enrollment.correct_module', 'enrollments', v_enr.id,
          coalesce(nullif(trim(p_reason), ''), 'Error de inscripción: se pasó al módulo correcto'),
          jsonb_build_object(
            'estudiante', v_student, 'inscripcion', v_enr.registration_number,
            'modulo_antes', v_from, 'modulo_despues', v_to,
            'pagado', v_paid, 'estado', v_enr.status,
            'mensualidades_movidas', v_subs, 'grupo_soltado', v_group));
  return v_enr.id;
end;
$$;

revoke all on function public.admin_correct_module(uuid, uuid, text) from public, anon;
grant execute on function public.admin_correct_module(uuid, uuid, text) to authenticated;
