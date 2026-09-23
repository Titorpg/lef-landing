-- LEF — toda mensualidad NUEVA nace con el precio fijo de los módulos.
--
-- Pedido del usuario (23 sep 2026): al generar una suscripción en Pagos, el
-- valor debe ser siempre el precio fijo (297.500 COP). Solo si el admin
-- entra después a "Editar" y lo escribe a mano, puede quedar distinto.
-- El panel ya muestra el campo como solo lectura al crear; esto lo garantiza
-- también en la base de datos.
--
-- Se puede aplicar antes o después de 20260923000000_precio_fijo_modulo.sql
-- (redefine lef_monthly_price igual, sin cambiar nada).

create or replace function public.lef_monthly_price()
  returns numeric language sql immutable as $$
  select 297500::numeric;
$$;

grant execute on function public.lef_monthly_price() to authenticated;

-- Cualquier insert que no mande monto (o futuros caminos de alta) cae al precio fijo.
alter table public.subscriptions alter column monthly_amount set default public.lef_monthly_price();

-- Pagos → "Generar pago": el monto que venga del navegador se ignora al crear;
-- se guarda siempre el precio fijo. (Se deja el parámetro para no romper la firma.)
create or replace function public.admin_create_subscription(
  p_student_id uuid, p_module_id uuid, p_monthly_amount numeric,
  p_payer_name text, p_payer_doc_type text, p_payer_doc_number text,
  p_payer_email text default null, p_payer_phone text default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_sub uuid;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if p_module_id is null then raise exception 'LEF_INVALID_MODULE'; end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'LEF_STUDENT_NOT_FOUND';
  end if;

  select id into v_enr from public.enrollments
    where student_id = p_student_id and module_id = p_module_id and status = 'Completed'
    order by created_at desc limit 1;

  if v_enr is null then
    v_enr := public.admin_assign_module(p_student_id, p_module_id);
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
