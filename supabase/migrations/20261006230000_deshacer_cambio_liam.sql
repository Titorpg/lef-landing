-- LEF — deshacer el cambio de módulo de Liam Caballero (6 oct 2026, 9:51 p. m.).
-- Se hizo por "elegir otro módulo" en vez de "Cambio de módulo por error":
-- dio por completado su A1.3 pagado (LEF-2026-00005, recibo RC14) y creó
-- LEF-2026-00022 (C1.2) con un cobro nuevo de $297.500 sin pagos.
-- Esto lo deja como si se hubiera usado "Cambio de módulo por error".
-- Pegar completo en el SQL Editor de Supabase.

begin;

-- 1. Borra el cobro nuevo (solo si no tiene pagos).
delete from public.subscriptions
where id = '2d5cf4d1-a151-4a47-8b80-d6d7074ed07d'
  and not exists (
    select 1 from public.payments
    where subscription_id =
      '2d5cf4d1-a151-4a47-8b80-d6d7074ed07d');

-- 2. Borra la inscripción nueva LEF-2026-00022.
delete from public.enrollments
where id = '4807e390-893e-4be1-8d8f-fff2a325eadd'
  and status = 'PendingPayment'
  and not exists (
    select 1 from public.subscriptions
    where enrollment_id =
      '4807e390-893e-4be1-8d8f-fff2a325eadd');

-- 3. La inscripción pagada vuelve a estar activa,
--    ya en C1.2 y en el grupo del profesor Luis Caballero.
update public.enrollments
set status = 'Active',
    completed_at = null,
    module_id = '4e229549-259a-4c60-9511-e5d37f2aafed',
    group_id = 'f5f016f2-2e1f-4987-abc1-ab324c951174',
    cycle_id = 'ef2d24e5-1579-457e-9e2e-1d1012efa187'
where id = '117a047a-f72d-4cb0-92fc-5645b4c6db4f';

-- 4. Su mensualidad pagada (RC14) pasa a C1.2.
update public.subscriptions
set module_id = '4e229549-259a-4c60-9511-e5d37f2aafed',
    updated_at = now()
where id = '50a43521-5c7c-4ae6-b9fa-a4d70fe3b98f';

-- 5. Queda anotado en el Registro de eventos.
insert into public.audit_log
  (action, target_table, target_id, reason, details)
values (
  'enrollment.correct_module', 'enrollments',
  '117a047a-f72d-4cb0-92fc-5645b4c6db4f',
  'Se deshizo un cambio hecho con cobro nuevo por error',
  jsonb_build_object(
    'estudiante', 'Liam Caballero',
    'inscripcion', 'LEF-2026-00005',
    'modulo_antes', 'A1.3 · My Story',
    'modulo_despues', 'C1.2 · CERTIFIED',
    'pagado', true, 'estado', 'Active',
    'mensualidades_movidas', 1));

commit;

-- Revisión: debe salir UNA fila, LEF-2026-00005,
-- Active, C1.2, con grupo.
select e.registration_number, e.status,
       m.level, e.group_id is not null as con_grupo
from public.enrollments e
join public.modules m on m.id = e.module_id
where e.student_id =
  '82ff7065-cd9f-4650-b08b-bb7ef1457812'
  and e.status in ('Active', 'PendingPayment');
