-- LEF — ciclo de vida completo de una inscripción (22 sep 2026).
--
-- Pedido del usuario: inscribir al estudiante en un módulo nuevo dejaba
-- "rebabas" de la inscripción anterior (caso real: Liam Caballero seguía
-- viendo A1.1 activo en "Mi curso" sin grupo, horario, ciclo ni profesor).
-- Qué queda funcionando con esta migración:
--
--  1. Al terminar un módulo, el estudiante queda SIN módulo actual (la
--     columna "Módulo" de Estudiantes vacía), a la espera de que el admin
--     (Editar o Pagos → Generar pago) o el propio estudiante (sugerencia en
--     "Mi curso") genere la inscripción siguiente. "Generar pago" ahora
--     también inscribe al estudiante en el módulo elegido
--     (admin_create_subscription), y cada mensualidad queda atada a SU
--     inscripción (enrollment_id): pagarla activa esa inscripción y no otra.
--
--  2. Cuando pasa la fecha de fin de un ciclo, todo se cierra solo, en orden:
--     inscripciones activas -> 'Completed', inscripciones que nunca se
--     pagaron -> 'Cancelled', se sueltan grupo/ciclo, y se eliminan los
--     grupos, los horarios y el ciclo (lef_finish_cycle). Lo corre pg_cron
--     cada noche y, por si acaso, también el panel y el portal al abrirse
--     (close_ended_cycles es idempotente). Queda anotado en el Registro de
--     eventos. El admin puede además finalizar un ciclo antes de tiempo.
--
--  3. Un módulo ya completado no se vuelve a matricular: admin_assign_module
--     lo rechaza (LEF_MODULE_ALREADY_COMPLETED) y la sugerencia del portal
--     salta los módulos ya cursados.
--
--  4. Para que "Mi curso" siga mostrando el detalle de los módulos
--     completados (días, horario, profesor, fechas del ciclo) aunque el
--     grupo/horario/ciclo ya se hayan borrado, cada inscripción guarda una
--     copia de esos datos (columnas hist_*), que se congela al completarse.

-- ============================================================================
-- 0. Fecha "de hoy" en Colombia (el servidor corre en UTC)
-- ============================================================================
create or replace function public.lef_today()
  returns date language sql stable as $$
  select (now() at time zone 'America/Bogota')::date;
$$;

-- ============================================================================
-- 1. Copia histórica del grupo/horario/profesor/ciclo en cada inscripción
-- ============================================================================
alter table public.enrollments add column if not exists hist_cycle_name   text;
alter table public.enrollments add column if not exists hist_cycle_start  date;
alter table public.enrollments add column if not exists hist_cycle_end    date;
alter table public.enrollments add column if not exists hist_days         text[];
alter table public.enrollments add column if not exists hist_start_time   time;
alter table public.enrollments add column if not exists hist_end_time     time;
alter table public.enrollments add column if not exists hist_teacher_name text;

-- Relleno para lo que ya existe (antes de crear el trigger).
update public.enrollments e
  set hist_days = sch.days, hist_start_time = sch.start_time,
      hist_end_time = sch.end_time, hist_teacher_name = t.full_name
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  where g.id = e.group_id and e.hist_days is null;

update public.enrollments e
  set hist_cycle_name = c.name, hist_cycle_start = c.start_date, hist_cycle_end = c.end_date
  from public.cycles c
  where c.id = e.cycle_id and e.hist_cycle_start is null;

-- Mientras la inscripción está en curso, la copia sigue a sus referencias
-- vivas (si pierde el grupo o el ciclo, se limpia). En el momento en que pasa
-- a 'Completed' se toma la foto final, y de ahí en adelante no se toca más.
create or replace function public.enrollments_snapshot()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_completing boolean;
  r record;
begin
  if tg_op = 'INSERT' then
    v_completing := new.status = 'Completed';
  else
    v_completing := new.status = 'Completed' and old.status is distinct from 'Completed';
  end if;
  if new.status = 'Completed' and not v_completing then
    return new; -- historial congelado
  end if;

  if new.group_id is not null then
    select sch.days, sch.start_time, sch.end_time, t.full_name into r
      from public.groups g
      join public.schedules sch on sch.id = g.schedule_id
      left join public.teachers t on t.id = g.teacher_id
      where g.id = new.group_id;
    if found then
      new.hist_days := r.days; new.hist_start_time := r.start_time;
      new.hist_end_time := r.end_time; new.hist_teacher_name := r.full_name;
    end if;
  elsif not v_completing then
    new.hist_days := null; new.hist_start_time := null;
    new.hist_end_time := null; new.hist_teacher_name := null;
  end if;

  if new.cycle_id is not null then
    select name, start_date, end_date into r from public.cycles where id = new.cycle_id;
    if found then
      new.hist_cycle_name := r.name; new.hist_cycle_start := r.start_date;
      new.hist_cycle_end := r.end_date;
    end if;
  elsif not v_completing then
    new.hist_cycle_name := null; new.hist_cycle_start := null; new.hist_cycle_end := null;
  end if;

  return new;
end;
$$;

drop trigger if exists enrollments_snapshot_trg on public.enrollments;
create trigger enrollments_snapshot_trg
  before insert or update on public.enrollments
  for each row execute function public.enrollments_snapshot();

-- ============================================================================
-- 2. Borrar un grupo o un ciclo a mano ya no deja inscripciones "corriendo"
-- ============================================================================
-- Antes, borrar un grupo solo soltaba group_id (FK on delete set null): la
-- inscripción conservaba cycle_id y "Mi curso" seguía mostrando la barra del
-- ciclo corriendo, sin grupo ni profesor. Ahora las inscripciones en curso
-- sueltan también el ciclo; el estudiante vuelve a "libres" de su módulo.
create or replace function public.groups_release_enrollments()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.enrollments
    set group_id = null,
        cycle_id = case when status in ('PendingPayment', 'Active') then null else cycle_id end
    where group_id = old.id;
  return old;
end;
$$;

drop trigger if exists groups_release_enrollments_trg on public.groups;
create trigger groups_release_enrollments_trg
  before delete on public.groups
  for each row execute function public.groups_release_enrollments();

-- enrollments.cycle_id es ON DELETE RESTRICT: sin esto, un ciclo con
-- historial nunca se podía borrar. Las completadas conservan su copia hist_*.
create or replace function public.cycles_release_enrollments()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.enrollments set cycle_id = null where cycle_id = old.id;
  return old;
end;
$$;

drop trigger if exists cycles_release_enrollments_trg on public.cycles;
create trigger cycles_release_enrollments_trg
  before delete on public.cycles
  for each row execute function public.cycles_release_enrollments();

-- ============================================================================
-- 3. Cierre de ciclos: libera estudiantes y borra grupo -> horario -> ciclo
-- ============================================================================
create or replace function public.lef_finish_cycle(p_cycle_id uuid, p_reason text, p_actor uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_cycle public.cycles%rowtype;
  v_ids uuid[];
  v_students jsonb;
  v_completed int; v_cancelled int; v_groups int; v_scheds int;
  v_email text;
begin
  -- skip locked: si el cron y el panel lo disparan a la vez, solo uno trabaja
  select * into v_cycle from public.cycles where id = p_cycle_id for update skip locked;
  if not found then return; end if;

  select coalesce(array_agg(distinct e.id), '{}') into v_ids
  from public.enrollments e
  left join public.groups g on g.id = e.group_id
  left join public.schedules s on s.id = g.schedule_id
  where e.cycle_id = p_cycle_id or s.cycle_id = p_cycle_id;

  select jsonb_agg(jsonb_build_object('estudiante', st.full_name, 'modulo', m.level,
           'resultado', case e.status when 'Active' then 'completado' else 'cancelado (sin pago)' end))
    into v_students
  from public.enrollments e
  join public.students st on st.id = e.student_id
  join public.modules m on m.id = e.module_id
  where e.id = any(v_ids) and e.status in ('Active', 'PendingPayment');

  -- 1) el que cursó (pagó) el módulo lo completa; la foto hist_* se toma aquí
  update public.enrollments set status = 'Completed', completed_at = now()
    where id = any(v_ids) and status = 'Active';
  get diagnostics v_completed = row_count;

  -- 2) el que nunca pagó no completó nada: se cancela esa inscripción
  update public.enrollments set status = 'Cancelled'
    where id = any(v_ids) and status = 'PendingPayment';
  get diagnostics v_cancelled = row_count;

  -- 3) todos sueltan grupo y ciclo (queda "Módulo" vacío en Estudiantes)
  update public.enrollments set group_id = null, cycle_id = null
    where id = any(v_ids);

  -- 4) borrar en orden: grupos -> horarios -> ciclo
  delete from public.groups
    where schedule_id in (select id from public.schedules where cycle_id = p_cycle_id);
  get diagnostics v_groups = row_count;
  delete from public.schedules where cycle_id = p_cycle_id;
  get diagnostics v_scheds = row_count;
  delete from public.cycles where id = p_cycle_id;

  if p_actor is not null then
    select email into v_email from public.profiles where user_id = p_actor;
  end if;

  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (p_actor, v_email, 'cycle.finish', 'cycles', p_cycle_id, p_reason,
          jsonb_build_object(
            'ciclo', v_cycle.name, 'inicio', v_cycle.start_date, 'fin', v_cycle.end_date,
            'modulos_completados', v_completed, 'inscripciones_canceladas_sin_pago', v_cancelled,
            'grupos_eliminados', v_groups, 'horarios_eliminados', v_scheds,
            'estudiantes', coalesce(v_students, '[]'::jsonb)));
end;
$$;

revoke all on function public.lef_finish_cycle(uuid, text, uuid) from public, anon, authenticated;

-- Cierra TODOS los ciclos cuya fecha de fin ya pasó (el día siguiente al
-- último día de clase). Idempotente: si no hay nada vencido, no hace nada.
-- La puede llamar cualquier usuario con sesión (panel o portal) porque solo
-- actúa sobre lo que ya venció por fecha — lo mismo que haría el cron.
create or replace function public.close_ended_cycles()
  returns integer language plpgsql security definer set search_path = public as $$
declare v_c record; v_n integer := 0;
begin
  for v_c in select id, end_date from public.cycles where end_date < public.lef_today() order by end_date loop
    perform public.lef_finish_cycle(v_c.id,
      'Cierre automático: terminó la fecha del ciclo (' || to_char(v_c.end_date, 'YYYY-MM-DD') || ').', null);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke all on function public.close_ended_cycles() from public, anon;
grant execute on function public.close_ended_cycles() to authenticated;

-- Botón "Finalizar ahora" de Académico → Ciclos (antes de su fecha de fin).
create or replace function public.admin_finish_cycle(p_cycle_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;
  if not exists (select 1 from public.cycles where id = p_cycle_id) then
    raise exception 'LEF_CYCLE_NOT_FOUND';
  end if;
  perform public.lef_finish_cycle(p_cycle_id, 'Ciclo finalizado a mano desde el panel.', auth.uid());
end;
$$;

revoke all on function public.admin_finish_cycle(uuid) from public, anon;
grant execute on function public.admin_finish_cycle(uuid) to authenticated;

-- Cron nocturno: 00:10 hora Colombia (05:10 UTC). Si pg_cron no está
-- disponible, la migración sigue igual — el panel y el portal lo disparan.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
  exception when others then
    raise notice 'pg_cron no disponible (%): el cierre lo harán el panel y el portal.', sqlerrm;
    return;
  end;
  begin
    execute $cron$select cron.unschedule(jobid) from cron.job where jobname = 'lef-cerrar-ciclos-vencidos'$cron$;
    execute $cron$select cron.schedule('lef-cerrar-ciclos-vencidos', '10 5 * * *', 'select public.close_ended_cycles()')$cron$;
  exception when others then
    raise notice 'No se pudo agendar el cron (%): el cierre lo harán el panel y el portal.', sqlerrm;
  end;
end $$;

-- ============================================================================
-- 4. Módulo actual del estudiante: asignar, liberar, no repetir completados
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
    return v_enr;
  end if;

  v_reg := public.next_registration_number();
  insert into public.enrollments (registration_number, student_id, module_id, status)
    values (v_reg, p_student_id, p_module_id, 'PendingPayment')
    returning id into v_enr;
  return v_enr;
end;
$$;

-- Deja al estudiante SIN módulo actual (Estudiantes → Editar → "Sin módulo").
--   'complete': el módulo en curso (ya pagado) queda como completado.
--   'cancel'  : la inscripción en curso se cancela (no cuenta como cursada).
create or replace function public.admin_release_module(p_student_id uuid, p_mode text)
  returns void language plpgsql security definer set search_path = public as $$
declare v_enr uuid; v_status text;
begin
  if not public.is_admin() then raise exception 'LEF_NOT_ALLOWED'; end if;

  select id, status into v_enr, v_status
    from public.enrollments
    where student_id = p_student_id and status in ('PendingPayment', 'Active')
    order by created_at desc limit 1;
  if v_enr is null then return; end if; -- ya estaba sin módulo

  if p_mode = 'complete' then
    if v_status <> 'Active' then raise exception 'LEF_ENROLLMENT_NOT_ACTIVE'; end if;
    update public.enrollments set status = 'Completed', completed_at = now() where id = v_enr;
    update public.enrollments set group_id = null, cycle_id = null where id = v_enr;
  elsif p_mode = 'cancel' then
    update public.enrollments set status = 'Cancelled', group_id = null, cycle_id = null where id = v_enr;
  else
    raise exception 'LEF_INVALID_MODE';
  end if;
end;
$$;

revoke all on function public.admin_release_module(uuid, text) from public, anon;
grant execute on function public.admin_release_module(uuid, text) to authenticated;

-- Pagos → "Generar pago": crea la mensualidad Y deja al estudiante inscrito
-- en ese módulo (así la columna "Módulo" de Estudiantes se actualiza sola).
-- Si el módulo ya lo completó, es el cobro de algo ya cursado (p. ej. la
-- segunda mensualidad pendiente): se ata a esa inscripción y no se toca su
-- módulo actual.
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
  values (p_student_id, v_enr, p_module_id, coalesce(p_monthly_amount, 0), 'COP',
          p_payer_name, p_payer_doc_type, p_payer_doc_number, p_payer_email, p_payer_phone)
  returning id into v_sub;
  return v_sub;
end;
$$;

revoke all on function public.admin_create_subscription(uuid, uuid, numeric, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_subscription(uuid, uuid, numeric, text, text, text, text, text) to authenticated;

-- ============================================================================
-- 5. Pagar una mensualidad activa SU inscripción (no cualquiera pendiente)
-- ============================================================================
-- Antes: cualquier pago activaba TODAS las inscripciones PendingPayment del
-- estudiante — pagar una deuda de un módulo ya cursado activaba el módulo
-- nuevo sin que nadie lo pagara. Mensualidades viejas sin enrollment_id caen
-- al criterio por módulo.
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

  select coalesce(
    (select e.registration_number from public.enrollments e where e.id = v_sub.enrollment_id),
    (select e.registration_number from public.enrollments e
      where e.student_id = v_sub.student_id and e.status <> 'Cancelled'
      order by e.created_at desc limit 1))
  into v_reg;

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

create or replace function public.record_wompi_payment(
  p_subscription_id uuid, p_amount numeric, p_currency text, p_method text,
  p_gateway_txn_id text, p_reference text)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_sub public.subscriptions%rowtype;
  v_payment_id uuid;
  v_existing uuid;
begin
  -- Idempotencia: si Wompi reintenta el webhook, no duplicar el pago.
  select id into v_existing from public.payments where gateway_txn_id = p_gateway_txn_id;
  if v_existing is not null then return v_existing; end if;

  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'LEF_SUBSCRIPTION_NOT_FOUND'; end if;

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

-- ============================================================================
-- 6. Sugerencia del portal: el siguiente módulo NO cursado
-- ============================================================================
-- ¿Tiene un módulo en curso? (pendiente de pago, o activo cuyo ciclo no ha
-- terminado / todavía no tiene ciclo)
create or replace function public.lef_student_has_current(p_student uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.enrollments e
    left join public.cycles c on c.id = e.cycle_id
    where e.student_id = p_student
      and (e.status = 'PendingPayment'
           or (e.status = 'Active' and (c.end_date is null or c.end_date >= public.lef_today()))));
$$;

-- Siguiente módulo = el de menor número, activo, por encima del más alto que
-- ya terminó, y que no haya cursado ya.
create or replace function public.lef_next_module_for(p_student uuid)
  returns uuid language sql stable security definer set search_path = public as $$
  with done as (
    select e.module_id, m.module_number
    from public.enrollments e
    join public.modules m on m.id = e.module_id
    left join public.cycles c on c.id = e.cycle_id
    where e.student_id = p_student
      and (e.status = 'Completed' or (e.status = 'Active' and c.end_date < public.lef_today()))
  )
  select m.id from public.modules m
  where m.active
    and m.module_number > (select max(module_number) from done)
    and m.id not in (select module_id from done)
  order by m.module_number limit 1;
$$;

revoke all on function public.lef_student_has_current(uuid) from public, anon, authenticated;
revoke all on function public.lef_next_module_for(uuid) from public, anon, authenticated;

create or replace function public.get_next_module_offer()
  returns table(next_module_id uuid, next_module_level text, next_module_title text,
                suggested_amount numeric, suggested_currency text)
  language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_next uuid;
  v_prev_sub record;
begin
  if v_student is null then return; end if;
  if public.lef_student_has_current(v_student) then return; end if;

  v_next := public.lef_next_module_for(v_student);
  if v_next is null then return; end if;

  select monthly_amount, currency into v_prev_sub
  from public.subscriptions
  where student_id = v_student
  order by created_at desc limit 1;

  return query select m.id, m.level, m.title,
    coalesce(v_prev_sub.monthly_amount, 297500::numeric), coalesce(v_prev_sub.currency, 'COP')
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

  -- Mismo monto y pagador de la última mensualidad del estudiante
  select monthly_amount, currency, payer_name, payer_doc_type, payer_doc_number,
         payer_email, payer_phone
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
  values (v_student, v_new_enr, v_next, coalesce(v_prev_sub.monthly_amount, 297500::numeric),
          coalesce(v_prev_sub.currency, 'COP'), v_prev_sub.payer_name,
          v_prev_sub.payer_doc_type, v_prev_sub.payer_doc_number,
          v_prev_sub.payer_email, v_prev_sub.payer_phone);

  return v_new_enr;
end;
$$;

revoke all on function public.self_enroll_next_module() from public, anon;
grant execute on function public.self_enroll_next_module() to authenticated;

-- ============================================================================
-- 7. "Mi curso": los completados muestran su copia histórica si el grupo/
--    horario/ciclo ya no existen; los que están en curso, solo datos vivos.
-- ============================================================================
create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date,
    module_heyzine_url text)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         case when e.status = 'Completed' then coalesce(sch.days, e.hist_days) else sch.days end,
         case when e.status = 'Completed' then coalesce(sch.start_time, e.hist_start_time) else sch.start_time end,
         case when e.status = 'Completed' then coalesce(sch.end_time, e.hist_end_time) else sch.end_time end,
         case when e.status = 'Completed' then coalesce(t.full_name, e.hist_teacher_name) else t.full_name end,
         case when e.status = 'Completed' then coalesce(c.start_date, e.hist_cycle_start) else c.start_date end,
         case when e.status = 'Completed' then coalesce(c.end_date, e.hist_cycle_end) else c.end_date end,
         m.heyzine_url
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.cycles c on c.id = e.cycle_id
  where e.student_id = public.current_student_id()
    and e.status <> 'Cancelled'
  order by e.created_at desc;
$$;

grant execute on function public.get_my_course() to authenticated;

-- ============================================================================
-- 8. Limpieza de datos: una inscripción pendiente de un módulo que el mismo
--    estudiante ya completó es un error de la lógica anterior (caso Liam
--    Caballero: A1.1 completado + A1.1 "pendiente de pago" de nuevo).
-- ============================================================================
update public.enrollments e set status = 'Cancelled', group_id = null, cycle_id = null
where e.status = 'PendingPayment'
  and exists (select 1 from public.enrollments d
              where d.student_id = e.student_id and d.module_id = e.module_id
                and d.status = 'Completed');
