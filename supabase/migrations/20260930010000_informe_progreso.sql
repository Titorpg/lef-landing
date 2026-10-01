-- LEF — Informe de progreso académico (plantilla de prueba, 30 sep 2026).
--
-- Pedido del usuario: nueva carpeta "Informe de progreso" en Recursos
-- compartidos (admin) y en Recursos de la clase (profesor). El profesor elige
-- un grupo activo → un estudiante → "Rellenar informe de progreso", marca
-- Inicial / En proceso / Logrado / Destacado en cada habilidad y la plataforma
-- redacta las observaciones (lef-informe.js, frases por reglas). Por ahora lo
-- ven solo el admin y los profesores (el estudiante NO).
--
-- Lo que no sale del profesor lo pone la base de datos al guardar, para que no
-- se pueda inventar:
--   * el % de validación formativa = nota del examen de validación del módulo
--     ya revisado por el profesor (estado revisado o aprobado);
--   * el comentario = su anotación del estudiante (pestaña Estudiantes →
--     Mis anotaciones, tabla teacher_student_notes);
--   * nombres, grupo y ciclo (foto del momento, como en exam_submissions).
-- Un informe por estudiante y grupo (guardar otra vez lo actualiza).

create table if not exists public.progress_reports (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid references public.students(id) on delete set null,
  group_id         uuid references public.groups(id) on delete set null,
  teacher_id       uuid references public.teachers(id) on delete set null,
  module_level     text not null,
  student_name     text not null,
  teacher_name     text,
  group_label      text,
  cycle_name       text,
  cycle_start      date,
  cycle_end        date,
  answers          jsonb not null default '{}'::jsonb,
  texts            jsonb not null default '{}'::jsonb,
  exam_pct         numeric,
  exam_state       text,
  teacher_note     text,
  template_version integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists progress_reports_once on public.progress_reports(student_id, group_id);
create index if not exists progress_reports_teacher_idx on public.progress_reports(teacher_id);

alter table public.progress_reports enable row level security;

drop policy if exists "admin lee informes" on public.progress_reports;
create policy "admin lee informes" on public.progress_reports
  for select to authenticated using (public.is_admin());
drop policy if exists "profesor lee sus informes" on public.progress_reports;
create policy "profesor lee sus informes" on public.progress_reports
  for select to authenticated using (teacher_id = public.current_teacher_id());

-- Guardar (crear o actualizar) el informe de un estudiante de SU grupo.
create or replace function public.teacher_save_progress_report(
  p_group uuid, p_student uuid, p_answers jsonb, p_texts jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_t uuid := public.current_teacher_id();
  v_level text;
  v_sname text;
  v_tname text;
  v_pct numeric;
  v_state text;
  v_note text;
  v_cy record;
  v_id uuid;
begin
  if v_t is null then
    raise exception 'Solo los profesores llenan el informe de progreso.';
  end if;
  select m.level into v_level
    from public.groups g join public.modules m on m.id = g.module_id
   where g.id = p_group and g.teacher_id = v_t;
  if v_level is null then
    raise exception 'Ese grupo no es tuyo.';
  end if;
  if not exists (select 1 from public.enrollments e
                  where e.group_id = p_group and e.student_id = p_student
                    and e.status <> 'Cancelled') then
    raise exception 'El estudiante no está en ese grupo.';
  end if;
  if jsonb_typeof(p_answers) <> 'object'
     or not exists (select 1 from jsonb_each(p_answers))
     or exists (select 1 from jsonb_each(p_answers)
                 where value::text not in ('1', '2', '3', '4')) then
    raise exception 'Marca una opción en cada habilidad.';
  end if;
  if jsonb_typeof(p_texts) <> 'object'
     or exists (select 1 from jsonb_each(p_texts)
                 where jsonb_typeof(value) <> 'string'
                    or length(value #>> '{}') > 4000) then
    raise exception 'El texto del informe no es válido.';
  end if;

  select full_name into v_sname from public.students where id = p_student;
  select full_name into v_tname from public.teachers where id = v_t;
  select * into v_cy from public.lef_group_cycle(p_group);

  select s.status,
         case when s.status in ('revisado', 'aprobado') and s.max_score > 0
              then round(s.score / s.max_score * 100) end
    into v_state, v_pct
    from public.exam_submissions s
    join public.validation_exams x on x.id = s.exam_id
   where s.student_id = p_student and x.module_level = v_level
   order by s.submitted_at desc
   limit 1;

  select nullif(trim(n.note), '') into v_note
    from public.teacher_student_notes n
   where n.teacher_id = v_t and n.student_id = p_student;

  insert into public.progress_reports as r
    (student_id, group_id, teacher_id, module_level, student_name, teacher_name,
     group_label, cycle_name, cycle_start, cycle_end, answers, texts,
     exam_pct, exam_state, teacher_note)
  values
    (p_student, p_group, v_t, v_level, coalesce(v_sname, 'Estudiante'), v_tname,
     public.lef_group_label(p_group), v_cy.name, v_cy.start_date, v_cy.end_date,
     p_answers, p_texts, v_pct, coalesce(v_state, 'sin_examen'), v_note)
  on conflict (student_id, group_id) do update set
     teacher_id = excluded.teacher_id, module_level = excluded.module_level,
     student_name = excluded.student_name, teacher_name = excluded.teacher_name,
     group_label = excluded.group_label, cycle_name = excluded.cycle_name,
     cycle_start = excluded.cycle_start, cycle_end = excluded.cycle_end,
     answers = excluded.answers, texts = excluded.texts,
     exam_pct = excluded.exam_pct, exam_state = excluded.exam_state,
     teacher_note = excluded.teacher_note, updated_at = now()
  returning r.id into v_id;

  return jsonb_build_object('id', v_id, 'exam_pct', v_pct,
    'exam_state', coalesce(v_state, 'sin_examen'), 'teacher_note', v_note);
end;
$$;

revoke all on function public.teacher_save_progress_report(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.teacher_save_progress_report(uuid, uuid, jsonb, jsonb) to authenticated;
