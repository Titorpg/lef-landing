-- LEF — Exámenes de validación (pedido del usuario, 27 sep 2026). Base de todo.
--
-- Cómo funciona (lo dictó el usuario):
--  * UN examen por módulo, al final (validation_exams). Hoy se reemplaza el Google
--    Form del DAY 16. El contenido va como datos: secciones → preguntas de opción
--    múltiple con su clave y puntos, lectura (passage) y audio/video de YouTube.
--  * El PROFESOR lo programa para su grupo con una franja de días (exam_assignments).
--    Mientras la franja está abierta, al estudiante le sale en "Clase de hoy".
--  * El estudiante lo presenta UNA vez; al enviarlo solo ve "Enviado". La nota la
--    calcula la base de datos (submit_my_exam): el estudiante nunca recibe la clave.
--  * El profesor revisa y da OK (teacher_approve_exam) → se le publica al estudiante
--    una novedad PERSONAL con su resultado (announcements.student_id) y le llega un
--    correo (Edge Function notify-exam-result) avisando que ya está disponible.
--  * Quien no lo presenta en la franja aparece como "No presentó".
--  * Caso especial: el admin borra la respuesta de un estudiante (queda en el
--    Registro de eventos) y el profesor se lo vuelve a programar solo a él.
--  * Admin ve todo en Recursos compartidos → Examen de validación; el profesor ve
--    sus grupos en Recursos de la clase → Exámenes de validación.

-- ---------------------------------------------------------------------------
-- 1. Tablas
-- ---------------------------------------------------------------------------
create table if not exists public.validation_exams (
  id           uuid primary key default gen_random_uuid(),
  module_level text not null unique check (module_level ~ '^(A1|A2|B1|B2|C1)\.[1-3]$'),
  title        text not null check (length(trim(title)) > 0),
  intro        text,
  content      jsonb not null,           -- {version, sections:[{title, instructions, passage, youtube, items:[…]}]}
  is_test      boolean not null default false,
  source_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.exam_assignments (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.validation_exams(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  student_id  uuid references public.students(id) on delete cascade,  -- null = todo el grupo
  opens_on    date not null,
  closes_on   date not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint exam_assignments_dates check (closes_on >= opens_on)
);
create index if not exists exam_assignments_group_idx on public.exam_assignments(group_id, exam_id);

create table if not exists public.exam_submissions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.validation_exams(id) on delete cascade,
  assignment_id   uuid references public.exam_assignments(id) on delete set null,
  student_id      uuid references public.students(id) on delete cascade,
  group_id        uuid references public.groups(id) on delete set null,
  teacher_id      uuid references public.teachers(id) on delete set null,
  -- Foto de cómo estaba todo al presentarlo (para el reporte final aunque cambie el grupo).
  student_name    text not null,
  group_label     text,
  teacher_name    text,
  exam_title      text not null,
  module_level    text not null,
  answers         jsonb not null,
  correct_count   integer not null,
  total_count     integer not null,
  score           numeric not null,
  max_score       numeric not null,
  sections        jsonb not null,        -- [{title, correct, total, score, max}]
  submitted_at    timestamptz not null default now(),
  status          text not null default 'pendiente' check (status in ('pendiente', 'aprobado')),
  approved_by     uuid references auth.users(id) on delete set null,
  approved_at     timestamptz,
  announcement_id uuid references public.announcements(id) on delete set null,
  emailed_at      timestamptz,
  constraint exam_submissions_once unique (exam_id, student_id)
);
create index if not exists exam_submissions_teacher_idx on public.exam_submissions(teacher_id, exam_id);

-- Novedades personales (resultado del examen de UN estudiante).
alter table public.announcements add column if not exists student_id uuid references public.students(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 2. Reglas de acceso. Escribir solo por las funciones de abajo (salvo el admin).
-- ---------------------------------------------------------------------------
alter table public.validation_exams enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.exam_submissions enable row level security;

drop policy if exists "admin gestiona examenes" on public.validation_exams;
create policy "admin gestiona examenes" on public.validation_exams
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profesor lee examenes" on public.validation_exams;
create policy "profesor lee examenes" on public.validation_exams
  for select to authenticated using (public.is_teacher());

drop policy if exists "admin gestiona programacion examenes" on public.exam_assignments;
create policy "admin gestiona programacion examenes" on public.exam_assignments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profesor lee programacion de sus grupos" on public.exam_assignments;
create policy "profesor lee programacion de sus grupos" on public.exam_assignments
  for select to authenticated using (group_id in (
    select g.id from public.groups g where g.teacher_id = public.current_teacher_id()));

drop policy if exists "admin lee respuestas examenes" on public.exam_submissions;
create policy "admin lee respuestas examenes" on public.exam_submissions
  for select to authenticated using (public.is_admin());
drop policy if exists "profesor lee respuestas de sus grupos" on public.exam_submissions;
create policy "profesor lee respuestas de sus grupos" on public.exam_submissions
  for select to authenticated using (teacher_id = public.current_teacher_id());

-- ---------------------------------------------------------------------------
-- 3. Ayudas
-- ---------------------------------------------------------------------------
-- "A1.3 · Lun · Mié · 6:00 p. m." (para listas y para la foto del resultado).
create or replace function public.lef_group_label(p_group uuid)
  returns text language sql stable security definer set search_path = public as $$
  select m.level
    || coalesce(' · ' || nullif(array_to_string(array(
         select case d when 'Monday' then 'Lun' when 'Tuesday' then 'Mar' when 'Wednesday' then 'Mié'
                       when 'Thursday' then 'Jue' when 'Friday' then 'Vie' when 'Saturday' then 'Sáb' else 'Dom' end
         from unnest(s.days) d), ' · '), ''), '')
    || coalesce(' · ' || ltrim(to_char(s.start_time, 'HH12:MI'), '0')
         || case when s.start_time < '12:00' then ' a. m.' else ' p. m.' end, '')
  from public.groups g
  join public.modules m on m.id = g.module_id
  left join public.schedules s on s.id = g.schedule_id
  where g.id = p_group;
$$;

-- 78 → "78", 78.5 → "78.5" (sin el punto suelto que deja to_char).
create or replace function public.lef_fmt_num(p numeric)
  returns text language sql immutable set search_path = public as $$
  select rtrim(to_char(p, 'FM999990.##'), '.');
$$;

-- ¿Esta programación le toca a este estudiante? (su grupo, o programada solo para él)
create or replace function public.lef_exam_targets(p_assignment uuid, p_student uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.exam_assignments a
    where a.id = p_assignment
      and (a.student_id = p_student
           or (a.student_id is null and exists (
                 select 1 from public.enrollments e
                 where e.group_id = a.group_id and e.student_id = p_student
                   and e.status in ('PendingPayment', 'Active')))));
$$;

-- ---------------------------------------------------------------------------
-- 4. Estudiante
-- ---------------------------------------------------------------------------
-- Exámenes que puede presentar HOY (franja abierta y aún no enviado).
create or replace function public.get_my_pending_exams()
  returns table(assignment_id uuid, exam_title text, module_level text, opens_on date, closes_on date)
  language sql stable security definer set search_path = public as $$
  select a.id, x.title, x.module_level, a.opens_on, a.closes_on
  from public.exam_assignments a
  join public.validation_exams x on x.id = a.exam_id
  where public.current_student_id() is not null
    and public.lef_today() between a.opens_on and a.closes_on
    and public.lef_exam_targets(a.id, public.current_student_id())
    and not exists (select 1 from public.exam_submissions s
                    where s.exam_id = a.exam_id and s.student_id = public.current_student_id())
  order by a.closes_on, x.module_level;
$$;

-- El examen SIN la clave de respuestas.
create or replace function public.get_my_exam(p_assignment uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_a public.exam_assignments%rowtype;
  v_x public.validation_exams%rowtype;
begin
  select * into v_a from public.exam_assignments where id = p_assignment;
  if v_student is null or v_a.id is null or not public.lef_exam_targets(v_a.id, v_student) then
    raise exception 'LEF_EXAM_NOT_FOUND: este examen no está disponible para ti.';
  end if;
  if public.lef_today() not between v_a.opens_on and v_a.closes_on then
    raise exception 'LEF_EXAM_CLOSED: este examen no está abierto hoy.';
  end if;
  if exists (select 1 from public.exam_submissions where exam_id = v_a.exam_id and student_id = v_student) then
    raise exception 'LEF_EXAM_ALREADY_SENT: ya enviaste este examen.';
  end if;
  select * into v_x from public.validation_exams where id = v_a.exam_id;
  return jsonb_build_object(
    'assignment_id', v_a.id, 'title', v_x.title, 'intro', v_x.intro,
    'module_level', v_x.module_level, 'closes_on', v_a.closes_on,
    'sections', coalesce((
      select jsonb_agg(jsonb_set(sec, '{items}', coalesce((
               select jsonb_agg(it - 'correct' order by io)
               from jsonb_array_elements(sec->'items') with ordinality as i(it, io)), '[]'::jsonb)) order by so)
      from jsonb_array_elements(v_x.content->'sections') with ordinality as s(sec, so)), '[]'::jsonb));
end;
$$;

-- Envía las respuestas ({"q1": 2, …}: índice de la opción en el orden original).
-- La nota la calcula la base de datos, por sección y general.
create or replace function public.submit_my_exam(p_assignment uuid, p_answers jsonb)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_a public.exam_assignments%rowtype;
  v_x public.validation_exams%rowtype;
  v_g record;
  v_sec jsonb; v_it jsonb; v_ans text;
  v_secs jsonb := '[]'::jsonb;
  s_ok int; s_tot int; s_pts numeric; s_max numeric;
  t_ok int := 0; t_tot int := 0; t_pts numeric := 0; t_max numeric := 0;
  v_id uuid;
begin
  select * into v_a from public.exam_assignments where id = p_assignment for share;
  if v_student is null or v_a.id is null or not public.lef_exam_targets(v_a.id, v_student) then
    raise exception 'LEF_EXAM_NOT_FOUND: este examen no está disponible para ti.';
  end if;
  if public.lef_today() not between v_a.opens_on and v_a.closes_on then
    raise exception 'LEF_EXAM_CLOSED: la franja para presentar este examen ya se cerró.';
  end if;
  if exists (select 1 from public.exam_submissions where exam_id = v_a.exam_id and student_id = v_student) then
    raise exception 'LEF_EXAM_ALREADY_SENT: ya enviaste este examen.';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'LEF_EXAM_INCOMPLETE: faltan respuestas.';
  end if;
  select * into v_x from public.validation_exams where id = v_a.exam_id;

  for v_sec in select value from jsonb_array_elements(v_x.content->'sections') loop
    s_ok := 0; s_tot := 0; s_pts := 0; s_max := 0;
    for v_it in select value from jsonb_array_elements(v_sec->'items') where value->>'type' = 'choice' loop
      v_ans := p_answers->>(v_it->>'id');
      if v_ans is null or v_ans !~ '^\d+$' then
        raise exception 'LEF_EXAM_INCOMPLETE: falta responder "%".', left(v_it->>'text', 60);
      end if;
      s_tot := s_tot + 1;
      s_max := s_max + coalesce((v_it->>'points')::numeric, 1);
      if (v_it->'correct') @> to_jsonb(v_ans::int) then
        s_ok := s_ok + 1;
        s_pts := s_pts + coalesce((v_it->>'points')::numeric, 1);
      end if;
    end loop;
    if s_tot > 0 then
      v_secs := v_secs || jsonb_build_array(jsonb_build_object(
        'title', v_sec->>'title', 'correct', s_ok, 'total', s_tot, 'score', s_pts, 'max', s_max));
    end if;
    t_ok := t_ok + s_ok; t_tot := t_tot + s_tot; t_pts := t_pts + s_pts; t_max := t_max + s_max;
  end loop;

  select g.id, g.teacher_id, t.full_name as teacher_name, public.lef_group_label(g.id) as label
    into v_g
  from public.groups g left join public.teachers t on t.id = g.teacher_id
  where g.id = v_a.group_id;

  insert into public.exam_submissions (exam_id, assignment_id, student_id, group_id, teacher_id,
    student_name, group_label, teacher_name, exam_title, module_level, answers,
    correct_count, total_count, score, max_score, sections)
  values (v_x.id, v_a.id, v_student, v_g.id, v_g.teacher_id,
    (select full_name from public.students where id = v_student), v_g.label, v_g.teacher_name,
    v_x.title, v_x.module_level, p_answers, t_ok, t_tot, t_pts, t_max, v_secs)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Profesor y admin
-- ---------------------------------------------------------------------------
-- Programar (o cambiar las fechas de) el examen de un grupo, o para UN estudiante
-- del grupo (reprogramación después de que el admin borró su respuesta, o si no
-- lo presentó).
create or replace function public.teacher_schedule_exam(p_group uuid, p_opens date, p_closes date, p_student uuid default null)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_g public.groups%rowtype;
  v_exam uuid;
  v_id uuid;
begin
  select * into v_g from public.groups where id = p_group;
  if v_g.id is null then raise exception 'LEF_GROUP_NOT_FOUND: el grupo no existe.'; end if;
  if not (public.is_admin() or (public.is_teacher() and v_g.teacher_id = public.current_teacher_id())) then
    raise exception 'LEF_FORBIDDEN: solo el profesor del grupo puede programar su examen.';
  end if;
  select x.id into v_exam from public.validation_exams x
    join public.modules m on m.level = x.module_level where m.id = v_g.module_id;
  if v_exam is null then raise exception 'LEF_EXAM_NONE: el módulo de este grupo todavía no tiene examen de validación.'; end if;
  if p_opens is null or p_closes is null or p_closes < p_opens then
    raise exception 'LEF_EXAM_DATES: la fecha de cierre debe ser igual o posterior a la de apertura.';
  end if;
  if p_closes < public.lef_today() then raise exception 'LEF_EXAM_DATES: la franja no puede terminar en el pasado.'; end if;
  if p_closes - p_opens > 30 then raise exception 'LEF_EXAM_DATES: la franja puede durar máximo 30 días.'; end if;

  if p_student is not null then
    if not exists (select 1 from public.enrollments where group_id = p_group and student_id = p_student and status <> 'Cancelled') then
      raise exception 'LEF_EXAM_STUDENT: ese estudiante no está en este grupo.';
    end if;
    if exists (select 1 from public.exam_submissions where exam_id = v_exam and student_id = p_student) then
      raise exception 'LEF_EXAM_ALREADY_SENT: ese estudiante ya presentó el examen. Si hay que repetirlo, el admin debe borrar su respuesta primero.';
    end if;
  end if;

  select id into v_id from public.exam_assignments
   where exam_id = v_exam and group_id = p_group and student_id is not distinct from p_student
   order by created_at desc limit 1;
  if v_id is null then
    insert into public.exam_assignments (exam_id, group_id, student_id, opens_on, closes_on, created_by)
    values (v_exam, p_group, p_student, p_opens, p_closes, auth.uid()) returning id into v_id;
  else
    update public.exam_assignments set opens_on = p_opens, closes_on = p_closes where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Quitar una programación (solo si nadie lo ha enviado con ella).
create or replace function public.teacher_cancel_exam(p_assignment uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare v_teacher uuid;
begin
  select g.teacher_id into v_teacher from public.exam_assignments a join public.groups g on g.id = a.group_id where a.id = p_assignment;
  if not found then raise exception 'LEF_EXAM_NOT_FOUND: esa programación ya no existe.'; end if;
  if not (public.is_admin() or (public.is_teacher() and v_teacher = public.current_teacher_id())) then
    raise exception 'LEF_FORBIDDEN: solo el profesor del grupo puede quitar esta programación.';
  end if;
  if exists (select 1 from public.exam_submissions where assignment_id = p_assignment) then
    raise exception 'LEF_EXAM_HAS_ANSWERS: ya hay estudiantes que lo enviaron; cambia las fechas en lugar de quitarlo.';
  end if;
  delete from public.exam_assignments where id = p_assignment;
end;
$$;

-- Resultados: una fila por estudiante y examen. El admin ve todo; el profesor, sus grupos.
-- state: pendiente (enviado, falta el OK) · aprobado · no_presento (se cerró la franja)
--        · abierto (aún puede presentarlo) · programado (la franja no ha empezado)
create or replace function public.exam_results(p_exam uuid default null, p_group uuid default null)
  returns table(exam_id uuid, exam_title text, module_level text, is_test boolean,
                group_id uuid, group_label text, teacher_name text,
                assignment_id uuid, opens_on date, closes_on date, individual boolean,
                student_id uuid, student_name text,
                submission_id uuid, state text, correct_count integer, total_count integer,
                score numeric, max_score numeric, sections jsonb, submitted_at timestamptz, approved_at timestamptz)
  language sql stable security definer set search_path = public as $$
  with va as (
    select a.*, g.teacher_id as g_teacher
    from public.exam_assignments a join public.groups g on g.id = a.group_id
    where (public.is_admin() or (public.is_teacher() and g.teacher_id = public.current_teacher_id()))
      and (p_exam is null or a.exam_id = p_exam)
      and (p_group is null or a.group_id = p_group)
  ), targets as (
    select va.id as a_id, va.exam_id as x_id, va.group_id as g_id, va.opens_on as o, va.closes_on as c,
           false as indiv, e.student_id as st_id, va.created_at as a_at
    from va join public.enrollments e on e.group_id = va.group_id and e.status <> 'Cancelled'
    where va.student_id is null
    union all
    select va.id, va.exam_id, va.group_id, va.opens_on, va.closes_on, true, va.student_id, va.created_at
    from va where va.student_id is not null
  ), latest as (
    select distinct on (x_id, st_id) * from targets order by x_id, st_id, indiv desc, a_at desc
  ), allrows as (
    select l.x_id, l.g_id, l.a_id, l.o, l.c, l.indiv, l.st_id, s.id as sub_id
    from latest l
    left join public.exam_submissions s on s.exam_id = l.x_id and s.student_id = l.st_id
    union all
    select s.exam_id, s.group_id, s.assignment_id, a.opens_on, a.closes_on, coalesce(a.student_id is not null, false), s.student_id, s.id
    from public.exam_submissions s
    left join public.exam_assignments a on a.id = s.assignment_id
    where (public.is_admin() or (public.is_teacher() and s.teacher_id = public.current_teacher_id()))
      and (p_exam is null or s.exam_id = p_exam)
      and (p_group is null or s.group_id = p_group)
      and not exists (select 1 from latest l where l.x_id = s.exam_id and l.st_id = s.student_id)
  )
  select r.x_id, coalesce(s.exam_title, x.title), x.module_level, x.is_test,
         r.g_id, coalesce(s.group_label, public.lef_group_label(r.g_id)), coalesce(s.teacher_name, t.full_name),
         r.a_id, r.o, r.c, r.indiv,
         r.st_id, coalesce(s.student_name, st.full_name, 'Estudiante eliminado'),
         s.id,
         case when s.id is not null then s.status
              when public.lef_today() > r.c then 'no_presento'
              when public.lef_today() >= r.o then 'abierto'
              else 'programado' end,
         s.correct_count, s.total_count, s.score, s.max_score, s.sections, s.submitted_at, s.approved_at
  from allrows r
  join public.validation_exams x on x.id = r.x_id
  left join public.exam_submissions s on s.id = r.sub_id
  left join public.students st on st.id = r.st_id
  left join public.groups g on g.id = r.g_id
  left join public.teachers t on t.id = g.teacher_id
  order by x.module_level, 6, 13;
$$;

-- OK del profesor: publica la novedad personal con el resultado. El correo lo
-- manda después la Edge Function notify-exam-result.
create or replace function public.teacher_approve_exam(p_submission uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
  v_body text;
  v_ann uuid;
  v_sec jsonb;
begin
  select * into v_s from public.exam_submissions where id = p_submission for update;
  if v_s.id is null then raise exception 'LEF_EXAM_NOT_FOUND: esa respuesta ya no existe.'; end if;
  if not (public.is_admin() or (public.is_teacher() and v_s.teacher_id = public.current_teacher_id())) then
    raise exception 'LEF_FORBIDDEN: solo el profesor del grupo puede aprobar este resultado.';
  end if;
  if v_s.status = 'aprobado' then return v_s.id; end if;
  if v_s.student_id is null then raise exception 'LEF_EXAM_STUDENT: el estudiante ya no existe.'; end if;

  v_body := 'Tu profesor(a)' || coalesce(' ' || v_s.teacher_name, '') || ' revisó tu examen de validación del módulo '
    || v_s.module_level || ' ("' || v_s.exam_title || '").' || E'\n\n'
    || 'RESULTADO GENERAL: ' || public.lef_fmt_num(v_s.score) || ' de ' || public.lef_fmt_num(v_s.max_score)
    || ' puntos · ' || v_s.correct_count || ' de ' || v_s.total_count || ' respuestas correctas.' || E'\n\n'
    || 'POR SECCIÓN:';
  for v_sec in select value from jsonb_array_elements(v_s.sections) loop
    v_body := v_body || E'\n• ' || (v_sec->>'title') || ': ' || (v_sec->>'correct') || ' de ' || (v_sec->>'total')
      || ' correctas (' || public.lef_fmt_num((v_sec->>'score')::numeric) || ' de '
      || public.lef_fmt_num((v_sec->>'max')::numeric) || ' puntos)';
  end loop;
  v_body := v_body || E'\n\n' || 'Recuerda: este examen no afecta tu nota final ni define si pasas de nivel. '
    || 'Es una herramienta para que veas tu progreso e identifiques qué puedes mejorar.';

  insert into public.announcements (title, body, category, student_id, pinned, published, expires_at, created_by)
  values ('Resultado de tu examen de validación ' || v_s.module_level, v_body, 'academico', v_s.student_id,
          false, true, public.lef_today() + 90, auth.uid())
  returning id into v_ann;

  update public.exam_submissions
     set status = 'aprobado', approved_by = auth.uid(), approved_at = now(), announcement_id = v_ann
   where id = v_s.id;
  return v_s.id;
end;
$$;

-- Caso especial: el admin borra la respuesta de un estudiante (con motivo, queda en
-- el Registro de eventos). Luego el profesor se lo puede volver a programar.
create or replace function public.admin_delete_exam_submission(p_submission uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
  v_email text;
begin
  if not public.is_admin() then raise exception 'LEF_FORBIDDEN: solo el admin puede borrar respuestas.'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'LEF_REASON: escribe el motivo.'; end if;
  select * into v_s from public.exam_submissions where id = p_submission;
  if v_s.id is null then raise exception 'LEF_EXAM_NOT_FOUND: esa respuesta ya no existe.'; end if;
  select email into v_email from public.profiles where user_id = auth.uid();
  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'exam_submission.delete', 'exam_submissions', v_s.id, trim(p_reason),
          jsonb_build_object('student_id', v_s.student_id, 'student_name', v_s.student_name,
            'exam_title', v_s.exam_title, 'module_level', v_s.module_level, 'group_label', v_s.group_label,
            'teacher_name', v_s.teacher_name, 'score', v_s.score, 'max_score', v_s.max_score,
            'correct_count', v_s.correct_count, 'total_count', v_s.total_count,
            'status', v_s.status, 'submitted_at', v_s.submitted_at));
  if v_s.announcement_id is not null then delete from public.announcements where id = v_s.announcement_id; end if;
  delete from public.exam_submissions where id = v_s.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Tablón: las novedades personales solo las ve su estudiante.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_announcements()
  returns table(id uuid, title text, body text, category text, image_url text,
                link_url text, link_label text, pinned boolean, publish_at timestamptz,
                module_level text)
  language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, a.category, a.image_url, a.link_url, a.link_label,
         a.pinned, a.publish_at, m.level
  from public.announcements a
  left join public.modules m on m.id = a.module_id
  where public.current_student_id() is not null
    and a.published
    and a.publish_at <= now()
    and (a.expires_at is null or a.expires_at >= public.lef_today())
    and (a.student_id is null or a.student_id = public.current_student_id())
    and (a.module_id is null or exists (
          select 1 from public.enrollments e
          where e.student_id = public.current_student_id()
            and e.module_id = a.module_id
            and e.status in ('PendingPayment', 'Active')))
  order by a.pinned desc, a.publish_at desc
  limit 40;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos de ejecución
-- ---------------------------------------------------------------------------
revoke all on function public.lef_group_label(uuid) from public, anon;
revoke all on function public.lef_exam_targets(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_my_pending_exams() from public, anon;
revoke all on function public.get_my_exam(uuid) from public, anon;
revoke all on function public.submit_my_exam(uuid, jsonb) from public, anon;
revoke all on function public.teacher_schedule_exam(uuid, date, date, uuid) from public, anon;
revoke all on function public.teacher_cancel_exam(uuid) from public, anon;
revoke all on function public.exam_results(uuid, uuid) from public, anon;
revoke all on function public.teacher_approve_exam(uuid) from public, anon;
revoke all on function public.admin_delete_exam_submission(uuid, text) from public, anon;
revoke all on function public.get_my_announcements() from public, anon;
grant execute on function public.lef_group_label(uuid) to authenticated;
grant execute on function public.get_my_pending_exams() to authenticated;
grant execute on function public.get_my_exam(uuid) to authenticated;
grant execute on function public.submit_my_exam(uuid, jsonb) to authenticated;
grant execute on function public.teacher_schedule_exam(uuid, date, date, uuid) to authenticated;
grant execute on function public.teacher_cancel_exam(uuid) to authenticated;
grant execute on function public.exam_results(uuid, uuid) to authenticated;
grant execute on function public.teacher_approve_exam(uuid) to authenticated;
grant execute on function public.admin_delete_exam_submission(uuid, text) to authenticated;
grant execute on function public.get_my_announcements() to authenticated;

-- ---------------------------------------------------------------------------
-- 8. EXAMEN DE PRUEBA (A1.3) — pedido del usuario el 27 sep 2026 para ver cómo
--    funciona. Copia del Google Form "VALIDATION EXAM MODULE 3 LEVEL A1.3"
--    (1RESuE…). Clave tal como está en Google; el Listening (27–30) no tenía clave
--    y se completó con respuestas supuestas; los puntos también son supuestos
--    (3 c/u; 4 la 21, Reading y Listening) para sumar 100.
--    QUITARLO cuando se carguen los exámenes reales (ver estado.md):
--      delete from public.validation_exams where is_test;
-- ---------------------------------------------------------------------------
insert into public.validation_exams (module_level, title, intro, content, is_test, source_note)
values ('A1.3', 'VALIDATION EXAM MODULE 3 LEVEL A1.3',
  'This exam helps you check if you have reached the learning objectives of this course. It does not affect your final result and does not determine if you move to the next level. It is a tool to reflect on your progress and identify what you can improve.',
  $json${"version":1,"sections":[{"title":"Grammar","instructions":"Choose the correct answer","passage":null,"youtube":null,"items":[{"type":"choice","id":"q1","text":"1. She _____ to the market last Saturday","options":["go","goes","went"],"correct":[2],"points":3,"shuffle":true},{"type":"choice","id":"q2","text":"2. They _____ not finish their homework yesterday.","options":["did","do","does"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q3","text":"3. _____ you see a good movie last weekend?","options":["Did","Do","Does"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q4","text":"4. My brother _____ dinner alone last night.","options":["made","make","maked"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q5","text":"5. We _____ a taxi because it was raining.","options":["take","taked","took"],"correct":[2],"points":3,"shuffle":true},{"type":"choice","id":"q6","text":"6. I _____ very tired after work last Monday.","options":["am","was","were"],"correct":[1],"points":3,"shuffle":true},{"type":"choice","id":"q7","text":"7. _____ your parents at home last night?","options":["Am","Was","Were"],"correct":[2],"points":3,"shuffle":true},{"type":"choice","id":"q8","text":"8. She _____ at the office yesterday — she was sick.","options":["isn't","wasn't","weren't"],"correct":[1],"points":3,"shuffle":true},{"type":"choice","id":"q9","text":"9. \"_____ the concert good last Friday?\"  \"Yes, it _____.\"","options":["Was / was","Was / were","Were / were"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q10","text":"10. My little sister _____ ride a bike when she was four.","options":["can","could","couldn't"],"correct":[1],"points":3,"shuffle":true},{"type":"choice","id":"q11","text":"11. _____ you speak English before you started this course?","options":["Can","Could","Did"],"correct":[1],"points":3,"shuffle":true},{"type":"choice","id":"q12","text":"12. I _____ swim very well, but I _____ play tennis.\nContext: I never learned.","options":["can / can't","can / couldn't","could / can't"],"correct":[1],"points":3,"shuffle":true},{"type":"heading","text":"Find the error in the sentence"},{"type":"choice","id":"q13","text":"13. Yesterday she buyed a new dress and went to a party.","options":["buyed","go","went"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q14","text":"14. \"Could you to help me with this exercise, please?\"","options":["could","to help","with"],"correct":[0],"points":3,"shuffle":true}]},{"title":"Vocabulary","instructions":null,"passage":null,"youtube":null,"items":[{"type":"choice","id":"q15","text":"15. What is the past form of the verb GO?","options":["goed","gone","went"],"correct":[2],"points":3,"shuffle":true},{"type":"choice","id":"q16","text":"16. What is the past form of the verb BUY?","options":["bought","buyd","buyed"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q17","text":"17. What is the past form of the verb SEE?","options":["saw","seed","seen"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q18","text":"18. Choose the correct time expression: \"I called her 10 minutes._______\"","options":["ago","last","yesterday"],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q19","text":"19. Choose the sentence that uses the time expression correctly.","options":["I ate pizza last night.","I ate pizza the last night.","I ate pizza yesterday night."],"correct":[2,0],"points":3,"shuffle":true},{"type":"choice","id":"q20","text":"20. Look at this situation: A person is playing the piano perfectly. What do we say about this person?","options":["She can play the piano.","She can't play the piano.","She could play the piano."],"correct":[0],"points":3,"shuffle":true},{"type":"choice","id":"q21","text":"21. Which sentence is a polite request?","options":["Could you explain this to me?","Explain this.","You explain this to me."],"correct":[0],"points":4,"shuffle":true}]},{"title":"Reading","instructions":null,"passage":"My name is Valentina and last weekend was very different from my usual routine. On Saturday morning, I woke up late — it was already 9:30. I didn't go to the gym because I was really tired. Instead, I made breakfast at home and ate with my sister. We had eggs, bread and coffee. My sister didn't drink coffee because she doesn't like it. She had juice. In the afternoon, we went to a market near our house. We bought some vegetables and fruit. There was a small café next to the market, so we stopped there. I had a tea and my sister had a hot chocolate. It was cold outside so the hot drinks were perfect. In the evening, I watched a movie at home. My sister didn't watch TV — she read a book instead. We went to bed at 11:00 because the next day was Sunday and we didn't have work. It was a quiet weekend, but I really enjoyed it.","youtube":null,"items":[{"type":"choice","id":"q22","text":"22. Why didn't Valentina go to the gym on Saturday morning?","options":["Because she was really tired","Because she went to the market","Because the gym was closed"],"correct":[0],"points":4,"shuffle":true},{"type":"choice","id":"q23","text":"23. What did Valentina and her sister do at the market?","options":["They bought vegetables and fruit","They had coffee and juice","They watched a movie"],"correct":[0],"points":4,"shuffle":true},{"type":"choice","id":"q24","text":"24. Why didn't Valentina's sister drink coffee","options":["Because she doesn't like it","Because she prefers tea","Because there wasn't any coffee"],"correct":[0],"points":4,"shuffle":true},{"type":"choice","id":"q25","text":"25. What did Valentina do in the evening?","options":["She read a book","She watched a movie at home","She went out with friends"],"correct":[1],"points":4,"shuffle":true},{"type":"choice","id":"q26","text":"26. Why did they go to bed at 11:00?","options":["Because the next day was Sunday and they didn't have work","Because they ate late","Because they were bored"],"correct":[0],"points":4,"shuffle":true}]},{"title":"Listening","instructions":null,"passage":null,"youtube":"mq93_iLc4_k","items":[{"type":"choice","id":"q27","text":"27. Where did Lucas go last Saturday?","options":["To a park with his friends","To a restaurant","To the gym"],"correct":[0],"points":4,"shuffle":true},{"type":"choice","id":"q28","text":"28. Why couldn't Lucas play football when he was a child?","options":["Because he didn't like sports","Because he was sick","Because his neighborhood didn't have a field"],"correct":[2],"points":4,"shuffle":true},{"type":"choice","id":"q29","text":"29. What can Lucas do now that he couldn't do two years ago?","options":["He can cook","He can drive","He can speak English"],"correct":[2],"points":4,"shuffle":true},{"type":"choice","id":"q30","text":"30. What did Lucas ask his friend at the café?","options":["Can you come with me tomorrow?","Can you pay for me?","Could you take a photo of us?"],"correct":[2],"points":4,"shuffle":true}]}]}$json$::jsonb,
  true, 'PRUEBA (27 sep 2026): copia del Google Form 1RESuE_pW017HpbDuIkGWDskmvOweNLCKrtCmjapSkKQ; Listening y puntos supuestos.')
on conflict (module_level) do nothing;
