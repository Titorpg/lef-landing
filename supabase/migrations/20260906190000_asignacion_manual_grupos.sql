-- LEF — Asignar estudiantes a un grupo específico a mano (Académico → Grupos).
--
-- Hasta ahora el grupo de un estudiante se elegía solo automáticamente (el de
-- menos cupo ocupado) al convertir una pre-inscripción, o quedaba "solo
-- módulo" sin grupo. Pedido del usuario: al crear/editar un grupo, poder ver
-- los estudiantes de ese módulo que todavía no tienen grupo ("libres") y
-- unirlos uno por uno a ESTE grupo en concreto — así se puede repartir a
-- mano cuando hay más estudiantes que cupos (8) en un horario.

create or replace function public.admin_assign_group(p_enrollment_id uuid, p_group_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_enr public.enrollments%rowtype;
  v_grp public.groups%rowtype;
  v_cycle_id uuid;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;

  select * into v_enr from public.enrollments where id = p_enrollment_id;
  if not found then raise exception 'LEF_ENROLLMENT_NOT_FOUND'; end if;
  if v_enr.status = 'Cancelled' then raise exception 'LEF_ENROLLMENT_CANCELLED'; end if;

  select * into v_grp from public.groups where id = p_group_id;
  if not found then raise exception 'LEF_GROUP_NOT_FOUND'; end if;
  if not v_grp.active then raise exception 'LEF_GROUP_INACTIVE'; end if;
  if v_enr.module_id <> v_grp.module_id then raise exception 'LEF_MODULE_MISMATCH'; end if;

  select count(*) into v_count from public.enrollments
    where group_id = p_group_id and status <> 'Cancelled';
  if v_count >= v_grp.capacity then raise exception 'LEF_GROUP_FULL'; end if;

  select sch.cycle_id into v_cycle_id from public.schedules sch where sch.id = v_grp.schedule_id;

  update public.enrollments set group_id = p_group_id, cycle_id = v_cycle_id
    where id = p_enrollment_id;
end;
$$;

revoke all on function public.admin_assign_group(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_group(uuid, uuid) to authenticated;

-- Libera al estudiante del grupo (vuelve a quedar "libre" para otro grupo del
-- mismo módulo, o para que se lo asigne más adelante).
create or replace function public.admin_unassign_group(p_enrollment_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  update public.enrollments set group_id = null, cycle_id = null
    where id = p_enrollment_id and status <> 'Cancelled';
  if not found then raise exception 'LEF_ENROLLMENT_NOT_FOUND'; end if;
end;
$$;

revoke all on function public.admin_unassign_group(uuid) from public, anon;
grant execute on function public.admin_unassign_group(uuid) to authenticated;
