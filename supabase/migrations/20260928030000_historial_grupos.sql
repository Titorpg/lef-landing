-- LEF — Historial de grupos (28 sep 2026, pedido del usuario).
--  Al cerrarse un ciclo, lef_finish_cycle borra grupos, horarios y ciclo. Para que
--  el profesor no pierda sus grupos ("que no desaparezcan, que digan Completado y
--  pasen a Grupos anteriores"), justo antes de borrarlos se guarda una foto de cada
--  grupo en group_history: módulo, horario, ciclo, profesor y sus estudiantes.
--  La usan Mis grupos (Grupos anteriores) y Estudiantes (agrupados por grupo).

create table if not exists public.group_history (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid,                      -- id que tenía el grupo (ya no existe)
  teacher_id    uuid references public.teachers(id) on delete set null,
  teacher_name  text,
  module_id     uuid references public.modules(id) on delete set null,
  module_level  text,
  module_title  text,
  module_number int,
  days          text[],
  start_time    time,
  end_time      time,
  capacity      int,
  cycle_name    text,
  cycle_start   date,
  cycle_end     date,
  students      jsonb not null default '[]'::jsonb,  -- [{student_id, name, result: completado|cancelado}]
  finished_at   timestamptz not null default now()
);
create index if not exists group_history_teacher_idx on public.group_history(teacher_id, cycle_start desc);

alter table public.group_history enable row level security;
drop policy if exists "admin lee historial de grupos" on public.group_history;
create policy "admin lee historial de grupos" on public.group_history
  for select to authenticated using (public.is_admin());
drop policy if exists "profesor lee sus grupos anteriores" on public.group_history;
create policy "profesor lee sus grupos anteriores" on public.group_history
  for select to authenticated using (public.is_teacher() and teacher_id = public.current_teacher_id());

-- Cierre de ciclo: igual que antes + la foto de cada grupo antes de borrarlo.
create or replace function public.lef_finish_cycle(p_cycle_id uuid, p_reason text, p_actor uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_cycle public.cycles%rowtype;
  v_ids uuid[];
  v_students jsonb;
  v_completed int; v_cancelled int; v_groups int; v_scheds int;
  v_email text;
begin
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

  -- 0) foto de cada grupo del ciclo (con sus estudiantes) antes de borrarlo
  insert into public.group_history (group_id, teacher_id, teacher_name, module_id, module_level,
    module_title, module_number, days, start_time, end_time, capacity,
    cycle_name, cycle_start, cycle_end, students)
  select g.id, g.teacher_id, t.full_name, m.id, m.level, m.title, m.module_number,
         s.days, s.start_time, s.end_time, g.capacity,
         v_cycle.name, v_cycle.start_date, v_cycle.end_date,
         coalesce((select jsonb_agg(jsonb_build_object('student_id', st.id, 'name', st.full_name,
                     'result', case when e.status in ('Active', 'Completed') then 'completado' else 'cancelado' end)
                   order by st.full_name)
                   from public.enrollments e join public.students st on st.id = e.student_id
                   where e.group_id = g.id and e.status in ('Active', 'PendingPayment', 'Completed')), '[]'::jsonb)
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.modules m on m.id = g.module_id
  where s.cycle_id = p_cycle_id;

  update public.enrollments set status = 'Completed', completed_at = now()
    where id = any(v_ids) and status = 'Active';
  get diagnostics v_completed = row_count;

  update public.enrollments set status = 'Cancelled'
    where id = any(v_ids) and status = 'PendingPayment';
  get diagnostics v_cancelled = row_count;

  update public.enrollments set group_id = null, cycle_id = null
    where id = any(v_ids);

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

-- Grupos que ya se cerraron antes de esta migración: se reconstruyen con la copia
-- (hist_*) de las inscripciones completadas (solo quedan los que completaron).
insert into public.group_history (teacher_id, teacher_name, module_id, module_level, module_title,
  module_number, days, start_time, end_time, cycle_name, cycle_start, cycle_end, students, finished_at)
select t.id, e.hist_teacher_name, m.id, m.level, m.title, m.module_number,
       e.hist_days, e.hist_start_time, e.hist_end_time,
       max(e.hist_cycle_name), e.hist_cycle_start, max(e.hist_cycle_end),
       jsonb_agg(jsonb_build_object('student_id', st.id, 'name', st.full_name, 'result', 'completado')
                 order by st.full_name),
       coalesce(max(e.completed_at), now())
from public.enrollments e
join public.students st on st.id = e.student_id
join public.modules m on m.id = e.module_id
left join public.teachers t on t.full_name = e.hist_teacher_name
where e.status = 'Completed' and e.group_id is null and e.hist_days is not null
  and not exists (select 1 from public.group_history h
                  where h.module_id = m.id and h.days = e.hist_days
                    and h.start_time is not distinct from e.hist_start_time
                    and h.cycle_start is not distinct from e.hist_cycle_start)
group by t.id, e.hist_teacher_name, m.id, m.level, m.title, m.module_number,
         e.hist_days, e.hist_start_time, e.hist_end_time, e.hist_cycle_start;
