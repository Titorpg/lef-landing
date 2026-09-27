-- LEF — Exámenes de validación, ronda 2 (correcciones del usuario, 27 sep 2026).
--  1. Calendario: al estudiante, evento "Examen" el día que abre (botón a Clase de
--     hoy); al profesor, "Revisión de exámenes pendiente" el día que cierra.
--     Salen de la programación (no se guardan aparte): si cambian las fechas, se
--     mueven solos.
--  2. Revisión obligatoria: el profesor abre "Revisar respuestas", califica a mano
--     las preguntas abiertas y confirma (estado "revisado"); solo entonces "Dar OK".
--  3. El estudiante ve su examen corregido desde la novedad (Ver detalle) y lo
--     descarga en PDF. La novedad del resultado va primera, con imagen, y se
--     quita cuando el estudiante tiene activo (pagado) un módulo posterior.
--  4. Novedad temporal del profesor "Revisión de exámenes pendiente" (calculada,
--     nunca en la tabla announcements: no sale en Novedades del admin).
--  5. Orden por ciclo: cada resultado guarda su ciclo; los "No presentó" se
--     guardan de verdad cuando el estudiante suelta el grupo (cierre de ciclo).

-- ---------------------------------------------------------------------------
-- 1. Columnas nuevas
-- ---------------------------------------------------------------------------
alter table public.exam_submissions drop constraint if exists exam_submissions_status_check;
alter table public.exam_submissions add constraint exam_submissions_status_check
  check (status in ('pendiente', 'revisado', 'aprobado', 'no_presento'));
alter table public.exam_submissions add column if not exists manual jsonb not null default '{}'::jsonb;
alter table public.exam_submissions add column if not exists reviewed_by uuid references auth.users(id) on delete set null;
alter table public.exam_submissions add column if not exists reviewed_at timestamptz;
alter table public.exam_submissions add column if not exists cycle_name text;
alter table public.exam_submissions add column if not exists cycle_start date;
alter table public.exam_submissions add column if not exists cycle_end date;
alter table public.exam_submissions alter column answers set default '{}'::jsonb;
alter table public.exam_submissions alter column correct_count set default 0;
alter table public.exam_submissions alter column total_count set default 0;
alter table public.exam_submissions alter column score set default 0;
alter table public.exam_submissions alter column max_score set default 0;
alter table public.exam_submissions alter column sections set default '[]'::jsonb;

-- Ciclo de un grupo (para la foto del resultado).
create or replace function public.lef_group_cycle(p_group uuid)
  returns table(name text, start_date date, end_date date)
  language sql stable security definer set search_path = public as $$
  select c.name, c.start_date, c.end_date
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  join public.cycles c on c.id = s.cycle_id
  where g.id = p_group;
$$;

update public.exam_submissions x
   set cycle_name = c.name, cycle_start = c.start_date, cycle_end = c.end_date
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  join public.cycles c on c.id = s.cycle_id
 where g.id = x.group_id and x.cycle_start is null;

-- ---------------------------------------------------------------------------
-- 2. Calificar: opción múltiple sola; preguntas abiertas ("text") a mano.
-- ---------------------------------------------------------------------------
-- Recalcula secciones y totales con las respuestas y los puntos a mano.
create or replace function public.lef_exam_score(p_content jsonb, p_answers jsonb, p_manual jsonb)
  returns jsonb language plpgsql immutable set search_path = public as $$
declare
  v_sec jsonb; v_it jsonb; v_ans text; v_pts numeric; v_m numeric;
  v_secs jsonb := '[]'::jsonb;
  s_ok int; s_tot int; s_pts numeric; s_max numeric; s_open int;
  t_ok int := 0; t_tot int := 0; t_pts numeric := 0; t_max numeric := 0; t_open int := 0;
begin
  for v_sec in select value from jsonb_array_elements(p_content->'sections') loop
    s_ok := 0; s_tot := 0; s_pts := 0; s_max := 0; s_open := 0;
    for v_it in select value from jsonb_array_elements(v_sec->'items')
                where value->>'type' in ('choice', 'text') loop
      v_pts := coalesce((v_it->>'points')::numeric, 1);
      v_ans := p_answers->>(v_it->>'id');
      s_tot := s_tot + 1;
      s_max := s_max + v_pts;
      if v_it->>'type' = 'choice' then
        if v_ans ~ '^\d+$' and (v_it->'correct') @> to_jsonb(v_ans::int) then
          s_ok := s_ok + 1; s_pts := s_pts + v_pts;
        end if;
      else
        v_m := nullif(p_manual->>(v_it->>'id'), '')::numeric;
        if v_m is null then
          s_open := s_open + 1;
        else
          v_m := least(greatest(v_m, 0), v_pts);
          s_pts := s_pts + v_m;
          if v_m = v_pts then s_ok := s_ok + 1; end if;
        end if;
      end if;
    end loop;
    if s_tot > 0 then
      v_secs := v_secs || jsonb_build_array(jsonb_build_object(
        'title', v_sec->>'title', 'correct', s_ok, 'total', s_tot,
        'score', s_pts, 'max', s_max, 'open', s_open));
    end if;
    t_ok := t_ok + s_ok; t_tot := t_tot + s_tot; t_pts := t_pts + s_pts;
    t_max := t_max + s_max; t_open := t_open + s_open;
  end loop;
  return jsonb_build_object('sections', v_secs, 'correct', t_ok, 'total', t_tot,
                            'score', t_pts, 'max', t_max, 'open', t_open);
end;
$$;

-- Envío del estudiante: ahora también preguntas abiertas y la foto del ciclo.
create or replace function public.submit_my_exam(p_assignment uuid, p_answers jsonb)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_student uuid := public.current_student_id();
  v_a public.exam_assignments%rowtype;
  v_x public.validation_exams%rowtype;
  v_g record; v_cn text; v_cs date; v_ce date;
  v_it jsonb; v_ans text; v_r jsonb;
  v_id uuid;
begin
  select * into v_a from public.exam_assignments where id = p_assignment for share;
  if v_student is null or v_a.id is null or not public.lef_exam_targets(v_a.id, v_student) then
    raise exception 'LEF_EXAM_NOT_FOUND: este examen no está disponible para ti.';
  end if;
  if public.lef_today() not between v_a.opens_on and v_a.closes_on then
    raise exception 'LEF_EXAM_CLOSED: la franja para presentar este examen ya se cerró.';
  end if;
  if exists (select 1 from public.exam_submissions
             where exam_id = v_a.exam_id and student_id = v_student and status <> 'no_presento') then
    raise exception 'LEF_EXAM_ALREADY_SENT: ya enviaste este examen.';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'LEF_EXAM_INCOMPLETE: faltan respuestas.';
  end if;
  select * into v_x from public.validation_exams where id = v_a.exam_id;

  for v_it in select i.value from jsonb_array_elements(v_x.content->'sections') s,
                     jsonb_array_elements(s.value->'items') i
              where i.value->>'type' in ('choice', 'text') loop
    v_ans := p_answers->>(v_it->>'id');
    if v_it->>'type' = 'choice' and (v_ans is null or v_ans !~ '^\d+$') then
      raise exception 'LEF_EXAM_INCOMPLETE: falta responder "%".', left(v_it->>'text', 60);
    end if;
    if v_it->>'type' = 'text' and (v_ans is null or length(trim(v_ans)) = 0) then
      raise exception 'LEF_EXAM_INCOMPLETE: falta responder "%".', left(v_it->>'text', 60);
    end if;
    if v_it->>'type' = 'text' and length(v_ans) > 4000 then
      raise exception 'LEF_EXAM_TOO_LONG: una respuesta es demasiado larga (máximo 4000 caracteres).';
    end if;
  end loop;

  v_r := public.lef_exam_score(v_x.content, p_answers, '{}'::jsonb);
  select g.id, g.teacher_id, t.full_name as teacher_name, public.lef_group_label(g.id) as label
    into v_g
  from public.groups g left join public.teachers t on t.id = g.teacher_id
  where g.id = v_a.group_id;
  select name, start_date, end_date into v_cn, v_cs, v_ce from public.lef_group_cycle(v_a.group_id);

  -- Si estaba como "No presentó" (y se lo volvieron a programar), se reemplaza.
  delete from public.exam_submissions
   where exam_id = v_x.id and student_id = v_student and status = 'no_presento';

  insert into public.exam_submissions (exam_id, assignment_id, student_id, group_id, teacher_id,
    student_name, group_label, teacher_name, exam_title, module_level, answers,
    correct_count, total_count, score, max_score, sections, cycle_name, cycle_start, cycle_end)
  values (v_x.id, v_a.id, v_student, v_g.id, v_g.teacher_id,
    (select full_name from public.students where id = v_student), v_g.label, v_g.teacher_name,
    v_x.title, v_x.module_level, p_answers,
    (v_r->>'correct')::int, (v_r->>'total')::int, (v_r->>'score')::numeric, (v_r->>'max')::numeric,
    v_r->'sections', v_cn, v_cs, v_ce)
  returning id into v_id;
  return v_id;
end;
$$;

-- Revisión del profesor: puntos de las preguntas abiertas ({"q31": 4, …}) y
-- confirmar. Sin esto no se puede dar OK.
create or replace function public.teacher_review_exam(p_submission uuid, p_manual jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
  v_x public.validation_exams%rowtype;
  v_r jsonb;
begin
  select * into v_s from public.exam_submissions where id = p_submission for update;
  if v_s.id is null then raise exception 'LEF_EXAM_NOT_FOUND: esa respuesta ya no existe.'; end if;
  if not (public.is_admin() or (public.is_teacher() and v_s.teacher_id = public.current_teacher_id())) then
    raise exception 'LEF_FORBIDDEN: solo el profesor del grupo puede calificar este examen.';
  end if;
  if v_s.status = 'aprobado' then
    raise exception 'LEF_EXAM_APPROVED: este resultado ya se envió al estudiante; ya no se puede cambiar.';
  end if;
  if v_s.status = 'no_presento' then raise exception 'LEF_EXAM_NOT_SENT: el estudiante no presentó el examen.'; end if;
  select * into v_x from public.validation_exams where id = v_s.exam_id;
  v_r := public.lef_exam_score(v_x.content, v_s.answers, coalesce(p_manual, '{}'::jsonb));
  if (v_r->>'open')::int > 0 then
    raise exception 'LEF_EXAM_OPEN_PENDING: falta ponerle puntos a % pregunta(s) abierta(s).', v_r->>'open';
  end if;
  update public.exam_submissions
     set manual = coalesce(p_manual, '{}'::jsonb), sections = v_r->'sections',
         correct_count = (v_r->>'correct')::int, total_count = (v_r->>'total')::int,
         score = (v_r->>'score')::numeric, max_score = (v_r->>'max')::numeric,
         status = 'revisado', reviewed_by = auth.uid(), reviewed_at = now()
   where id = v_s.id;
  return v_r;
end;
$$;

-- OK del profesor (ya revisado): novedad personal con imagen.
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
  if v_s.status <> 'revisado' then
    raise exception 'LEF_EXAM_NOT_REVIEWED: primero revisa las respuestas y confirma la calificación.';
  end if;
  if v_s.student_id is null then raise exception 'LEF_EXAM_STUDENT: el estudiante ya no existe.'; end if;

  v_body := 'Tu profesor(a)' || coalesce(' ' || v_s.teacher_name, '')
    || ' revisó tu examen de validación del módulo ' || v_s.module_level
    || ' ("' || v_s.exam_title || '").' || E'\n\n'
    || 'RESULTADO GENERAL: ' || public.lef_fmt_num(v_s.score) || ' de ' || public.lef_fmt_num(v_s.max_score)
    || ' puntos · ' || v_s.correct_count || ' de ' || v_s.total_count || ' respuestas correctas.' || E'\n\n'
    || 'POR SECCIÓN:';
  for v_sec in select value from jsonb_array_elements(v_s.sections) loop
    v_body := v_body || E'\n• ' || (v_sec->>'title') || ': ' || (v_sec->>'correct') || ' de '
      || (v_sec->>'total') || ' correctas (' || public.lef_fmt_num((v_sec->>'score')::numeric)
      || ' de ' || public.lef_fmt_num((v_sec->>'max')::numeric) || ' puntos)';
  end loop;
  v_body := v_body || E'\n\n' || 'En "Ver detalle" puedes revisar tus respuestas y descargar tu evaluación en PDF. '
    || 'Esta novedad se quitará cuando empieces tu siguiente módulo.' || E'\n\n'
    || 'Recuerda: este examen no afecta tu nota final ni define si pasas de nivel. '
    || 'Es una herramienta para que veas tu progreso e identifiques qué puedes mejorar.';

  insert into public.announcements (title, body, category, student_id, image_url, pinned, published, expires_at, created_by)
  values ('Resultado de tu examen de validación ' || v_s.module_level, v_body, 'academico', v_s.student_id,
          'assets/inicio/noticia-examen-resultado.jpg', false, true, public.lef_today() + 365, auth.uid())
  returning id into v_ann;

  update public.exam_submissions
     set status = 'aprobado', approved_by = auth.uid(), approved_at = now(), announcement_id = v_ann
   where id = v_s.id;
  return v_s.id;
end;
$$;

-- Programar: si el estudiante estaba como "No presentó", se le puede volver a programar.
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
  if v_exam is null then
    raise exception 'LEF_EXAM_NONE: el módulo de este grupo todavía no tiene examen de validación.';
  end if;
  if p_opens is null or p_closes is null or p_closes < p_opens then
    raise exception 'LEF_EXAM_DATES: la fecha de cierre debe ser igual o posterior a la de apertura.';
  end if;
  if p_closes < public.lef_today() then raise exception 'LEF_EXAM_DATES: la franja no puede terminar en el pasado.'; end if;
  if p_closes - p_opens > 30 then raise exception 'LEF_EXAM_DATES: la franja puede durar máximo 30 días.'; end if;

  if p_student is not null then
    if not exists (select 1 from public.enrollments
                   where group_id = p_group and student_id = p_student and status <> 'Cancelled') then
      raise exception 'LEF_EXAM_STUDENT: ese estudiante no está en este grupo.';
    end if;
    if exists (select 1 from public.exam_submissions
               where exam_id = v_exam and student_id = p_student and status <> 'no_presento') then
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

-- ---------------------------------------------------------------------------
-- 3. "No presentó" guardado de verdad: cuando el estudiante suelta el grupo
--    (cierre de ciclo o cambio de grupo), queda la foto de los exámenes que se
--    le abrieron y no envió. Así el reporte final no pierde a nadie.
-- ---------------------------------------------------------------------------
create or replace function public.lef_exam_snapshot_no_show()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  a record; v_g record; v_cn text; v_cs date; v_ce date;
begin
  if old.group_id is null or new.group_id is not distinct from old.group_id then return new; end if;
  if new.status = 'Cancelled' then return new; end if;
  select g.id, g.teacher_id, t.full_name as teacher_name, public.lef_group_label(g.id) as label
    into v_g
  from public.groups g left join public.teachers t on t.id = g.teacher_id where g.id = old.group_id;
  select name, start_date, end_date into v_cn, v_cs, v_ce from public.lef_group_cycle(old.group_id);
  for a in
    select ea.*, x.title, x.module_level from public.exam_assignments ea
    join public.validation_exams x on x.id = ea.exam_id
    where ea.group_id = old.group_id and ea.opens_on <= public.lef_today()
      and (ea.student_id is null or ea.student_id = old.student_id)
  loop
    if not exists (select 1 from public.exam_submissions where exam_id = a.exam_id and student_id = old.student_id) then
      insert into public.exam_submissions (exam_id, assignment_id, student_id, group_id, teacher_id,
        student_name, group_label, teacher_name, exam_title, module_level, status,
        cycle_name, cycle_start, cycle_end)
      values (a.exam_id, a.id, old.student_id, old.group_id, v_g.teacher_id,
        (select full_name from public.students where id = old.student_id), v_g.label, v_g.teacher_name,
        a.title, a.module_level, 'no_presento', v_cn, v_cs, v_ce)
      on conflict (exam_id, student_id) do nothing;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists enrollments_exam_no_show_trg on public.enrollments;
create trigger enrollments_exam_no_show_trg
  after update of group_id on public.enrollments
  for each row execute function public.lef_exam_snapshot_no_show();

-- ---------------------------------------------------------------------------
-- 4. Resultados, ahora con ciclo y estado "revisado".
-- ---------------------------------------------------------------------------
drop function if exists public.exam_results(uuid, uuid);
create or replace function public.exam_results(p_exam uuid default null, p_group uuid default null)
  returns table(exam_id uuid, exam_title text, module_level text, is_test boolean,
                group_id uuid, group_label text, teacher_name text, group_active boolean,
                cycle_name text, cycle_start date, cycle_end date,
                assignment_id uuid, opens_on date, closes_on date, individual boolean,
                student_id uuid, student_name text,
                submission_id uuid, state text, correct_count integer, total_count integer,
                score numeric, max_score numeric, sections jsonb,
                submitted_at timestamptz, reviewed_at timestamptz, approved_at timestamptz)
  language sql stable security definer set search_path = public as $$
  with va as (
    select a.*
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
    select s.exam_id, s.group_id, s.assignment_id, a.opens_on, a.closes_on,
           coalesce(a.student_id is not null, false), s.student_id, s.id
    from public.exam_submissions s
    left join public.exam_assignments a on a.id = s.assignment_id
    where (public.is_admin() or (public.is_teacher() and s.teacher_id = public.current_teacher_id()))
      and (p_exam is null or s.exam_id = p_exam)
      and (p_group is null or s.group_id = p_group)
      and not exists (select 1 from latest l where l.x_id = s.exam_id and l.st_id = s.student_id)
  )
  select r.x_id, coalesce(s.exam_title, x.title), x.module_level, x.is_test,
         r.g_id, coalesce(s.group_label, public.lef_group_label(r.g_id)), coalesce(s.teacher_name, t.full_name),
         coalesce(g.active, false),
         coalesce(s.cycle_name, cy.name), coalesce(s.cycle_start, cy.start_date), coalesce(s.cycle_end, cy.end_date),
         r.a_id, r.o, r.c, r.indiv,
         r.st_id, coalesce(s.student_name, st.full_name, 'Estudiante eliminado'),
         s.id,
         case when s.id is not null then s.status
              when public.lef_today() > r.c then 'no_presento'
              when public.lef_today() >= r.o then 'abierto'
              else 'programado' end,
         s.correct_count, s.total_count, s.score, s.max_score, s.sections,
         s.submitted_at, s.reviewed_at, s.approved_at
  from allrows r
  join public.validation_exams x on x.id = r.x_id
  left join public.exam_submissions s on s.id = r.sub_id
  left join public.students st on st.id = r.st_id
  left join public.groups g on g.id = r.g_id
  left join public.teachers t on t.id = g.teacher_id
  left join lateral public.lef_group_cycle(r.g_id) cy on true
  order by x.module_level, 10 desc, 6, 17;
$$;

-- ---------------------------------------------------------------------------
-- 5. Estudiante: su examen corregido (solo después del OK del profesor).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_exam_result(p_submission uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
  v_x public.validation_exams%rowtype;
begin
  select * into v_s from public.exam_submissions where id = p_submission;
  if v_s.id is null or v_s.student_id is distinct from public.current_student_id() or v_s.status <> 'aprobado' then
    raise exception 'LEF_EXAM_NOT_FOUND: este resultado no está disponible.';
  end if;
  select * into v_x from public.validation_exams where id = v_s.exam_id;
  return jsonb_build_object(
    'title', v_s.exam_title, 'module_level', v_s.module_level, 'student_name', v_s.student_name,
    'teacher_name', v_s.teacher_name, 'group_label', v_s.group_label,
    'submitted_at', v_s.submitted_at, 'approved_at', v_s.approved_at,
    'score', v_s.score, 'max_score', v_s.max_score,
    'correct_count', v_s.correct_count, 'total_count', v_s.total_count,
    'sections_result', v_s.sections, 'answers', v_s.answers, 'manual', v_s.manual,
    'content', v_x.content);
end;
$$;

-- Tablón del estudiante: las novedades personales (resultado del examen) van
-- primero y se quitan cuando ya tiene ACTIVO (pagado) un módulo posterior.
drop function if exists public.get_my_announcements();
create or replace function public.get_my_announcements()
  returns table(id uuid, title text, body text, category text, image_url text,
                link_url text, link_label text, pinned boolean, publish_at timestamptz,
                module_level text, kind text, ref_id uuid)
  language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, a.category, a.image_url, a.link_url, a.link_label,
         a.pinned, a.publish_at, coalesce(m.level, xs.module_level),
         case when xs.id is not null then 'exam_result' end, xs.id
  from public.announcements a
  left join public.modules m on m.id = a.module_id
  left join public.exam_submissions xs on xs.announcement_id = a.id
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
    and (xs.id is null or not exists (
          select 1 from public.enrollments e
          join public.modules m2 on m2.id = e.module_id
          join public.modules mx on mx.level = xs.module_level
          where e.student_id = public.current_student_id()
            and e.status = 'Active'
            and m2.module_number > mx.module_number))
  order by (a.student_id is not null) desc, a.pinned desc, a.publish_at desc
  limit 40;
$$;

-- ---------------------------------------------------------------------------
-- 6. Novedades temporales del profesor (calculadas, no se guardan).
--    "Revisión de exámenes pendiente" por grupo: desde que programa el examen
--    hasta que ya no le queda ningún estudiante de ese grupo por calificar.
-- ---------------------------------------------------------------------------
create or replace function public.get_teacher_news()
  returns table(id uuid, kind text, title text, body text, image_url text, publish_at timestamptz,
                group_id uuid, group_label text, module_level text,
                opens_on date, closes_on date, to_review integer, sent integer, enrolled integer)
  language sql stable security definer set search_path = public as $$
  with mine as (
    select a.*, x.module_level, public.lef_group_label(a.group_id) as label
    from public.exam_assignments a
    join public.groups g on g.id = a.group_id
    join public.validation_exams x on x.id = a.exam_id
    where a.student_id is null and g.active and g.teacher_id = public.current_teacher_id()
  ), counts as (
    select m.id,
      (select count(*)::int from public.exam_submissions s
        where s.exam_id = m.exam_id and s.group_id = m.group_id and s.status in ('pendiente', 'revisado')) as to_review,
      (select count(*)::int from public.exam_submissions s
        where s.exam_id = m.exam_id and s.group_id = m.group_id and s.status in ('pendiente', 'revisado', 'aprobado')) as sent,
      (select count(*)::int from public.enrollments e
        where e.group_id = m.group_id and e.status in ('PendingPayment', 'Active')) as enrolled
    from mine m
  )
  select m.id, 'exam_review'::text, 'Revisión de exámenes pendiente'::text,
         ('Programaste el examen de validación ' || m.module_level || ' para el grupo ' || m.label
          || ', del ' || to_char(m.opens_on, 'DD/MM/YYYY') || ' al ' || to_char(m.closes_on, 'DD/MM/YYYY') || '.'
          || E'\n\n' || 'Hasta ahora lo enviaron ' || c.sent || ' de ' || c.enrolled || ' estudiantes'
          || case when c.to_review > 0 then ' y tienes ' || c.to_review || ' por calificar.' else '.' end
          || E'\n\n' || 'Revisa las respuestas de cada estudiante, confirma su calificación y dale OK para que '
          || 'reciba su resultado. Esta novedad se quita sola cuando no te quede nadie de este grupo por calificar.')::text,
         'assets/inicio/noticia-revision-examenes.jpg'::text, m.created_at,
         m.group_id, m.label, m.module_level, m.opens_on, m.closes_on, c.to_review, c.sent, c.enrolled
  from mine m join counts c on c.id = m.id
  where public.lef_today() <= m.closes_on or c.to_review > 0
  order by m.closes_on;
$$;

-- ---------------------------------------------------------------------------
-- 7. Calendario: eventos del examen (se calculan de la programación).
-- ---------------------------------------------------------------------------
create or replace function public.get_my_calendar(p_from date, p_to date)
  returns table(
    item_type text, id uuid, title text, details text, category text,
    starts_on date, ends_on date, start_time time, end_time time,
    link_url text, audience text, group_id uuid, group_label text,
    module_number integer, author text, can_edit boolean, cancelled boolean,
    cycle_name text, student_count integer, session_number integer, makeup_of date,
    holiday text, holiday_blurb text)
  language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_role    text;
  v_teacher uuid;
  v_student uuid;
  v_groups  uuid[];
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    raise exception 'LEF_CALENDAR_RANGE';
  end if;

  select pr.role, pr.teacher_id, pr.student_id into v_role, v_teacher, v_student
  from public.profiles pr where pr.user_id = v_uid and pr.active;
  if v_role is null then return; end if;

  if v_role = 'admin' then
    select array_agg(g.id) into v_groups from public.groups g where g.active;
  elsif v_role = 'teacher' then
    select array_agg(g.id) into v_groups from public.groups g
    where g.active and g.teacher_id = v_teacher;
  else
    select array_agg(distinct e.group_id) into v_groups from public.enrollments e
    where e.student_id = v_student and e.group_id is not null
      and e.status in ('PendingPayment', 'Active');
  end if;
  v_groups := coalesce(v_groups, '{}');

  return query
  select 'class'::text, g.id,
         ('Clase ' || m.level)::text,
         m.title::text,
         'clase'::text,
         d::date, d::date, sch.start_time, sch.end_time,
         null::text, 'group'::text, g.id,
         (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
         m.module_number,
         coalesce(t.full_name, '')::text,
         false,
         hol.day is not null or exists (
           select 1 from public.calendar_events x
           where x.category = 'sin_clase'
             and d::date between x.starts_on and x.ends_on
             and (x.audience in ('students', 'all') or (x.audience = 'group' and x.group_id = g.id))),
         c.name::text,
         case when v_role <> 'student' then (
           select count(*)::int from public.enrollments e
           where e.group_id = g.id and e.status in ('PendingPayment', 'Active')) end,
         public.lef_session_number(sch.days, c.start_date, d::date),
         null::date,
         hol.name, hol.blurb
  from public.groups g
  join public.schedules sch on sch.id = g.schedule_id
  join public.cycles c      on c.id = sch.cycle_id
  join public.modules m     on m.id = g.module_id
  left join public.teachers t on t.id = g.teacher_id
  cross join lateral generate_series(greatest(p_from, c.start_date), least(p_to, c.end_date), interval '1 day') d
  left join public.lef_holidays(p_from, p_to) hol on hol.day = d::date
  where g.id = any(v_groups)
    and (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
        [extract(isodow from d)::int] = any(sch.days);

  return query
  select 'event'::text, md5('lef-festivo-' || hol.day::text)::uuid,
         hol.name, hol.blurb, 'festivo'::text,
         hol.day, hol.day, null::time, null::time,
         null::text, 'all'::text, null::uuid, null::text, null::int,
         'Colombia'::text, false, false, null::text, null::int, null::int, null::date,
         hol.name, hol.blurb
  from public.lef_holidays(p_from, p_to) hol;

  return query
  select 'event'::text, x.id, x.title, x.details, x.category,
         x.starts_on, x.ends_on, x.start_time, x.end_time,
         x.link_url, x.audience, x.group_id,
         case when x.group_id is not null
              then (m.level || ' · ' || coalesce(gt.full_name, 'Sin profesor')) end::text,
         m.module_number,
         case when x.teacher_id is not null then coalesce(au.full_name, 'Profesor') else 'LEF' end::text,
         case when v_role = 'admin' then true
              when v_role = 'teacher' then x.created_by = v_uid
              else false end,
         false,
         null::text,
         null::int,
         case when x.makeup_of is not null then public.lef_session_number(sch.days, c.start_date, x.makeup_of) end,
         x.makeup_of,
         mh.name, mh.blurb
  from public.calendar_events x
  left join public.groups g     on g.id = x.group_id
  left join public.modules m    on m.id = g.module_id
  left join public.teachers gt  on gt.id = g.teacher_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.cycles c     on c.id = sch.cycle_id
  left join public.teachers au  on au.id = x.teacher_id
  left join lateral public.lef_holidays(x.makeup_of, x.makeup_of) mh on x.makeup_of is not null
  where x.starts_on <= p_to and x.ends_on >= p_from
    and (
      (v_role = 'admin' and (x.audience <> 'personal' or x.created_by = v_uid))
      or (v_role = 'teacher' and (
            x.created_by = v_uid
            or x.audience in ('teachers', 'all')
            or (x.audience = 'students' and x.category = 'sin_clase')
            or (x.audience = 'group' and x.group_id = any(v_groups))))
      or (v_role = 'student' and (
            x.audience in ('students', 'all')
            or (x.audience = 'group' and x.group_id = any(v_groups))))
    );

  -- Examen de validación: al estudiante, el día que abre.
  if v_role = 'student' then
    return query
    select 'event'::text, a.id,
           ('Examen de validación ' || xv.module_level)::text,
           ('Tu examen de validación está disponible del ' || to_char(a.opens_on, 'DD/MM/YYYY')
            || ' al ' || to_char(a.closes_on, 'DD/MM/YYYY')
            || '. Lo presentas en Mi curso → Clase de hoy. Tienes un solo intento.')::text,
           'examen'::text, a.opens_on, a.opens_on, null::time, null::time,
           null::text, 'group'::text, a.group_id,
           (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
           m.module_number, coalesce(t.full_name, 'LEF')::text, false, false,
           null::text, null::int, null::int, null::date, null::text, null::text
    from public.exam_assignments a
    join public.validation_exams xv on xv.id = a.exam_id
    join public.groups g on g.id = a.group_id
    join public.modules m on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where a.opens_on between p_from and p_to
      and public.lef_exam_targets(a.id, v_student);
  end if;

  -- Al profesor, el día que cierra: revisar los exámenes del grupo.
  if v_role = 'teacher' then
    return query
    select 'event'::text, md5('lef-revision-' || a.id::text)::uuid,
           'Revisión de exámenes pendiente'::text,
           ('Hoy se cierra el plazo del examen de validación ' || xv.module_level || ' del grupo '
            || public.lef_group_label(a.group_id) || '. Revisa las respuestas de cada estudiante, '
            || 'confirma su calificación y dale OK para que reciba su resultado.')::text,
           'revision_examen'::text, a.closes_on, a.closes_on, null::time, null::time,
           null::text, 'group'::text, a.group_id,
           (m.level || ' · ' || coalesce(t.full_name, 'Sin profesor'))::text,
           m.module_number, 'LEF'::text, false, false,
           null::text, null::int, null::int, null::date, null::text, null::text
    from public.exam_assignments a
    join public.validation_exams xv on xv.id = a.exam_id
    join public.groups g on g.id = a.group_id
    join public.modules m on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
    where a.student_id is null and a.closes_on between p_from and p_to
      and g.id = any(v_groups);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Permisos
-- ---------------------------------------------------------------------------
revoke all on function public.lef_group_cycle(uuid) from public, anon, authenticated;
revoke all on function public.lef_exam_score(jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.lef_exam_snapshot_no_show() from public, anon, authenticated;
revoke all on function public.submit_my_exam(uuid, jsonb) from public, anon;
revoke all on function public.teacher_review_exam(uuid, jsonb) from public, anon;
revoke all on function public.teacher_approve_exam(uuid) from public, anon;
revoke all on function public.teacher_schedule_exam(uuid, date, date, uuid) from public, anon;
revoke all on function public.exam_results(uuid, uuid) from public, anon;
revoke all on function public.get_my_exam_result(uuid) from public, anon;
revoke all on function public.get_my_announcements() from public, anon;
revoke all on function public.get_teacher_news() from public, anon;
revoke all on function public.get_my_calendar(date, date) from public, anon;
grant execute on function public.submit_my_exam(uuid, jsonb) to authenticated;
grant execute on function public.teacher_review_exam(uuid, jsonb) to authenticated;
grant execute on function public.teacher_approve_exam(uuid) to authenticated;
grant execute on function public.teacher_schedule_exam(uuid, date, date, uuid) to authenticated;
grant execute on function public.exam_results(uuid, uuid) to authenticated;
grant execute on function public.get_my_exam_result(uuid) to authenticated;
grant execute on function public.get_my_announcements() to authenticated;
grant execute on function public.get_teacher_news() to authenticated;
grant execute on function public.get_my_calendar(date, date) to authenticated;
