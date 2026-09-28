-- LEF — Editor de exámenes de validación (28 sep 2026, dictado por el usuario).
--  * Solo el admin edita (el profesor sigue solo leyendo): textos, respuestas
--    correctas, puntos, enlaces de YouTube, lecturas, preguntas y secciones.
--  * Las correcciones aplican a quienes presenten el examen DE AHÍ EN ADELANTE:
--    cada envío guarda la copia del examen tal como estaba cuando lo presentó
--    (exam_submissions.content) y la revisión, el "Ver detalle" y el PDF usan esa copia.
--  * Cada edición queda en el Registro de eventos con lo que cambió.

-- 1. Copia del examen en cada envío (los que ya existen quedan con la versión actual).
alter table public.exam_submissions add column if not exists content jsonb;
update public.exam_submissions s set content = x.content
  from public.validation_exams x
 where x.id = s.exam_id and s.content is null;

-- 2. Envío del estudiante: igual que antes + guarda la copia del examen.
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
    correct_count, total_count, score, max_score, sections, cycle_name, cycle_start, cycle_end, content)
  values (v_x.id, v_a.id, v_student, v_g.id, v_g.teacher_id,
    (select full_name from public.students where id = v_student), v_g.label, v_g.teacher_name,
    v_x.title, v_x.module_level, p_answers,
    (v_r->>'correct')::int, (v_r->>'total')::int, (v_r->>'score')::numeric, (v_r->>'max')::numeric,
    v_r->'sections', v_cn, v_cs, v_ce, v_x.content)
  returning id into v_id;
  return v_id;
end;
$$;

-- 3. Revisión del profesor: califica sobre la copia que presentó el estudiante.
create or replace function public.teacher_review_exam(p_submission uuid, p_manual jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
  v_c jsonb;
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
  v_c := coalesce(v_s.content, (select content from public.validation_exams where id = v_s.exam_id));
  v_r := public.lef_exam_score(v_c, v_s.answers, coalesce(p_manual, '{}'::jsonb));
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

-- 4. Estudiante: su examen corregido, con la versión que presentó.
create or replace function public.get_my_exam_result(p_submission uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_s public.exam_submissions%rowtype;
begin
  select * into v_s from public.exam_submissions where id = p_submission;
  if v_s.id is null or v_s.student_id is distinct from public.current_student_id() or v_s.status <> 'aprobado' then
    raise exception 'LEF_EXAM_NOT_FOUND: este resultado no está disponible.';
  end if;
  return jsonb_build_object(
    'title', v_s.exam_title, 'module_level', v_s.module_level, 'student_name', v_s.student_name,
    'teacher_name', v_s.teacher_name, 'group_label', v_s.group_label,
    'submitted_at', v_s.submitted_at, 'approved_at', v_s.approved_at,
    'score', v_s.score, 'max_score', v_s.max_score,
    'correct_count', v_s.correct_count, 'total_count', v_s.total_count,
    'sections_result', v_s.sections, 'answers', v_s.answers, 'manual', v_s.manual,
    'content', coalesce(v_s.content, (select content from public.validation_exams where id = v_s.exam_id)));
end;
$$;

-- 5. Admin: guardar el examen editado (valida que quede bien armado y lo anota
--    en el Registro de eventos con la lista de cambios y la versión anterior).
create or replace function public.admin_update_exam(p_exam uuid, p_title text, p_intro text,
  p_content jsonb, p_changes jsonb default '[]'::jsonb, p_note text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_x public.validation_exams%rowtype;
  v_email text;
  v_sec jsonb; v_it jsonb; v_c jsonb;
  v_ids text[] := '{}';
  v_n int; v_q int := 0;
begin
  if not public.is_admin() then raise exception 'LEF_FORBIDDEN: solo el admin puede editar exámenes.'; end if;
  select * into v_x from public.validation_exams where id = p_exam for update;
  if v_x.id is null then raise exception 'LEF_EXAM_NOT_FOUND: ese examen ya no existe.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'LEF_EXAM_EDIT: el examen necesita un título.'; end if;
  if p_content is null or jsonb_typeof(p_content->'sections') <> 'array' or jsonb_array_length(p_content->'sections') = 0 then
    raise exception 'LEF_EXAM_EDIT: el examen necesita al menos una sección.';
  end if;

  for v_sec in select value from jsonb_array_elements(p_content->'sections') loop
    if coalesce(trim(v_sec->>'title'), '') = '' then
      raise exception 'LEF_EXAM_EDIT: todas las secciones necesitan un nombre.';
    end if;
    if v_sec->>'youtube' is not null and v_sec->>'youtube' !~ '^[A-Za-z0-9_-]{11}$' then
      raise exception 'LEF_EXAM_EDIT: el enlace de YouTube de "%" no es válido.', v_sec->>'title';
    end if;
    if jsonb_typeof(v_sec->'items') <> 'array' then
      raise exception 'LEF_EXAM_EDIT: la sección "%" está mal armada.', v_sec->>'title';
    end if;
    for v_it in select value from jsonb_array_elements(v_sec->'items') loop
      if v_it->>'type' not in ('choice', 'text', 'heading') then
        raise exception 'LEF_EXAM_EDIT: hay un elemento de tipo desconocido en "%".', v_sec->>'title';
      end if;
      if coalesce(trim(v_it->>'text'), '') = '' then
        raise exception 'LEF_EXAM_EDIT: hay una pregunta o subtítulo sin texto en "%".', v_sec->>'title';
      end if;
      continue when v_it->>'type' = 'heading';
      v_q := v_q + 1;
      if coalesce(v_it->>'id', '') = '' or (v_it->>'id') = any(v_ids) then
        raise exception 'LEF_EXAM_EDIT: hay preguntas con el mismo identificador.';
      end if;
      v_ids := v_ids || (v_it->>'id');
      if jsonb_typeof(v_it->'points') <> 'number' or (v_it->>'points')::numeric <= 0 then
        raise exception 'LEF_EXAM_EDIT: la pregunta "%" necesita puntos mayores que 0.', left(v_it->>'text', 60);
      end if;
      continue when v_it->>'type' = 'text';
      v_n := coalesce(jsonb_array_length(v_it->'options'), 0);
      if v_n < 2 then
        raise exception 'LEF_EXAM_EDIT: la pregunta "%" necesita al menos 2 opciones.', left(v_it->>'text', 60);
      end if;
      if exists (select 1 from jsonb_array_elements_text(v_it->'options') o where trim(o) = '') then
        raise exception 'LEF_EXAM_EDIT: la pregunta "%" tiene una opción vacía.', left(v_it->>'text', 60);
      end if;
      if jsonb_typeof(v_it->'correct') <> 'array' or jsonb_array_length(v_it->'correct') = 0 then
        raise exception 'LEF_EXAM_EDIT: marca la respuesta correcta de "%".', left(v_it->>'text', 60);
      end if;
      for v_c in select value from jsonb_array_elements(v_it->'correct') loop
        if jsonb_typeof(v_c) <> 'number' or (v_c::text)::int < 0 or (v_c::text)::int >= v_n then
          raise exception 'LEF_EXAM_EDIT: la respuesta correcta de "%" no coincide con sus opciones.', left(v_it->>'text', 60);
        end if;
      end loop;
    end loop;
  end loop;
  if v_q = 0 then raise exception 'LEF_EXAM_EDIT: el examen necesita al menos una pregunta.'; end if;

  select email into v_email from public.profiles where user_id = auth.uid();
  insert into public.audit_log (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values (auth.uid(), v_email, 'exam.update', 'validation_exams', v_x.id,
          coalesce(nullif(trim(p_note), ''), 'Corrección del examen desde el editor'),
          jsonb_build_object('module_level', v_x.module_level, 'title', trim(p_title), 'old_title', v_x.title,
            'changes', coalesce(p_changes, '[]'::jsonb),
            'before', jsonb_build_object('title', v_x.title, 'intro', v_x.intro, 'content', v_x.content)));

  update public.validation_exams
     set title = trim(p_title), intro = nullif(trim(coalesce(p_intro, '')), ''),
         content = p_content, updated_at = now()
   where id = v_x.id;
end;
$$;

revoke all on function public.admin_update_exam(uuid, text, text, jsonb, jsonb, text) from public, anon;
grant execute on function public.admin_update_exam(uuid, text, text, jsonb, jsonb, text) to authenticated;
