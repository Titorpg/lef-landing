-- LEF — lógica interconectada del panel admin.
-- 1) Un grupo se puede eliminar si ya no tiene inscripciones ACTIVAS (las canceladas
--    sueltan su referencia en vez de bloquear el borrado).
-- 2) Desactivar un módulo apaga automáticamente sus horarios/grupos; reactivarlo
--    los vuelve a encender (solo los que él mismo apagó, no los apagados a mano).

-- ----------------------------------------------------------------------------
-- 1. enrollments.group_id: de RESTRICT a SET NULL
-- ----------------------------------------------------------------------------
do $$
declare v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.enrollments'::regclass
    and confrelid = 'public.groups'::regclass
    and contype = 'f';
  if v_conname is not null then
    execute format('alter table public.enrollments drop constraint %I', v_conname);
  end if;
end $$;

alter table public.enrollments
  add constraint enrollments_group_id_fkey
  foreign key (group_id) references public.groups(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 2. Marca de "apagado automáticamente por su módulo"
-- ----------------------------------------------------------------------------
alter table public.schedules add column if not exists deactivated_by_module boolean not null default false;
alter table public.groups    add column if not exists deactivated_by_module boolean not null default false;

create or replace function public.admin_set_module_active(p_module_id uuid, p_active boolean)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;

  if p_active then
    update public.modules set active = true where id = p_module_id;
    update public.schedules set active = true, deactivated_by_module = false
      where module_id = p_module_id and deactivated_by_module = true;
    update public.groups set active = true, deactivated_by_module = false
      where module_id = p_module_id and deactivated_by_module = true;
  else
    update public.schedules set active = false, deactivated_by_module = true
      where module_id = p_module_id and active = true;
    update public.groups set active = false, deactivated_by_module = true
      where module_id = p_module_id and active = true;
    update public.modules set active = false where id = p_module_id;
  end if;
end;
$$;

revoke all on function public.admin_set_module_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_module_active(uuid, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Conteo de inscripciones activas por grupo (para mostrar en Académico > Grupos)
-- ----------------------------------------------------------------------------
create or replace function public.group_enrollment_counts()
  returns table(group_id uuid, count bigint)
  language sql stable security definer set search_path = public as $$
  select g.id, count(e.id)
  from public.groups g
  left join public.enrollments e on e.group_id = g.id and e.status <> 'Cancelled'
  group by g.id;
$$;

grant execute on function public.group_enrollment_counts() to authenticated;
