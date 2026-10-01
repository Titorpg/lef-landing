-- LEF — Envío del informe de progreso a los estudiantes (1 oct 2026).
--
-- Pedido del usuario:
--   * Cuando el profesor tiene guardados los informes de TODOS los estudiantes
--     de su grupo, los envía de una vez: a cada estudiante le llega un correo
--     con su informe en PDF (Edge Function notify-progress-report) y una
--     novedad personal en su Inicio, con el mismo formato del resultado del
--     examen, para descargarlo. La novedad dura hasta que termina el ciclo del
--     grupo (expires_at = lef_group_end).
--   * Ya enviado, el informe queda bloqueado para el profesor. Si hay que
--     corregirlo, el admin lo desbloquea (queda en el Registro de eventos), se
--     quita la novedad y el profesor lo vuelve a enviar solo a ese estudiante.
--   * Estudiante que entra después del envío: el profesor le llena su informe
--     y el mismo botón se lo envía solo a él (se envían los que falten).
--   * "Revisión de exámenes pendiente" (profesor) se quita en cuanto todos los
--     estudiantes del grupo tienen su resultado revisado y enviado (OK); si
--     alguien no lo presenta, al cerrar la franja.

alter table public.progress_reports add column if not exists sent_at timestamptz;
alter table public.progress_reports add column if not exists emailed_at timestamptz;
alter table public.progress_reports add column if not exists announcement_id uuid
  references public.announcements(id) on delete set null;

-- Guardar: igual que antes, pero un informe ya enviado no se puede cambiar.
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
  if exists (select 1 from public.progress_reports
              where student_id = p_student and group_id = p_group and sent_at is not null) then
    raise exception 'Este informe ya se envió al estudiante. Si hay que corregirlo, pide al admin que lo desbloquee.';
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
    (student_id, group_id, teacher_id, module_level, student_name,
     teacher_name, group_label, cycle_name, cycle_start, cycle_end,
     answers, texts, exam_pct, exam_state, teacher_note)
  values
    (p_student, p_group, v_t, v_level, coalesce(v_sname, 'Estudiante'),
     v_tname, public.lef_group_label(p_group), v_cy.name,
     v_cy.start_date, v_cy.end_date, p_answers, p_texts, v_pct,
     coalesce(v_state, 'sin_examen'), v_note)
  on conflict (student_id, group_id) do update set
     teacher_id = excluded.teacher_id,
     module_level = excluded.module_level,
     student_name = excluded.student_name,
     teacher_name = excluded.teacher_name,
     group_label = excluded.group_label,
     cycle_name = excluded.cycle_name,
     cycle_start = excluded.cycle_start,
     cycle_end = excluded.cycle_end,
     answers = excluded.answers, texts = excluded.texts,
     exam_pct = excluded.exam_pct, exam_state = excluded.exam_state,
     teacher_note = excluded.teacher_note, updated_at = now()
  returning r.id into v_id;
  return jsonb_build_object('id', v_id, 'exam_pct', v_pct,
    'exam_state', coalesce(v_state, 'sin_examen'), 'teacher_note', v_note);
end;
$$;

-- Enviar: exige que todos los estudiantes del grupo tengan su informe; envía
-- los que aún no se han enviado (novedad personal + marca sent_at). Devuelve
-- los informes enviados para que el panel les mande el correo con el PDF.
create or replace function public.teacher_send_progress_reports(p_group uuid)
  returns setof uuid language plpgsql security definer set search_path = public as $$
declare
  v_t uuid := public.current_teacher_id();
  v_level text;
  v_tname text;
  v_end date;
  v_missing int;
  v_ann uuid;
  r record;
begin
  if v_t is null then
    raise exception 'Solo los profesores envían el informe de progreso.';
  end if;
  select m.level, t.full_name into v_level, v_tname
    from public.groups g
    join public.modules m on m.id = g.module_id
    left join public.teachers t on t.id = g.teacher_id
   where g.id = p_group and g.teacher_id = v_t;
  if v_level is null then
    raise exception 'Ese grupo no es tuyo.';
  end if;
  select count(*) into v_missing
    from public.enrollments e
   where e.group_id = p_group and e.status in ('Active', 'PendingPayment')
     and not exists (select 1 from public.progress_reports p
                      where p.group_id = p_group and p.student_id = e.student_id);
  if v_missing > 0 then
    raise exception 'Faltan % informes por llenar en este grupo. Llénalos todos antes de enviar.', v_missing;
  end if;
  v_end := coalesce(public.lef_group_end(p_group), public.lef_today() + 30);
  for r in
    select p.id, p.student_id
      from public.progress_reports p
      join public.enrollments e on e.group_id = p.group_id and e.student_id = p.student_id
                               and e.status in ('Active', 'PendingPayment')
     where p.group_id = p_group and p.sent_at is null
  loop
    insert into public.announcements
      (title, body, category, student_id, image_url, pinned, published, expires_at, created_by)
    values
      ('Tu informe de progreso ' || v_level,
       'Tu profesor(a)' || coalesce(' ' || v_tname, '')
         || ' completó tu informe de progreso del módulo ' || v_level || '.' || E'\n\n'
         || 'En él encuentras cómo vas en cada habilidad (participación, speaking, writing, '
         || 'listening y reading), las observaciones de tu profesor(a) y metas para tu siguiente ciclo.'
         || E'\n\n' || 'Descárgalo en PDF con el botón de abajo; también te llegó a tu correo.'
         || E'\n\n' || 'Esta novedad estará aquí hasta el ' || to_char(v_end, 'DD/MM/YYYY')
         || ', cuando termina tu ciclo.',
       'academico', r.student_id, 'assets/inicio/noticia-informe-progreso.jpg',
       false, true, v_end, auth.uid())
    returning id into v_ann;
    update public.progress_reports
       set sent_at = now(), announcement_id = v_ann
     where id = r.id;
    return next r.id;
  end loop;
end;
$$;

-- Admin: desbloquear un informe enviado para que el profesor lo corrija.
create or replace function public.admin_unlock_progress_report(p_report uuid, p_reason text)
  returns void language plpgsql security definer set search_path = public as $$
declare
  v_r public.progress_reports%rowtype;
  v_email text;
begin
  if not public.is_admin() then
    raise exception 'Solo el admin puede desbloquear un informe.';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Escribe el motivo.';
  end if;
  select * into v_r from public.progress_reports where id = p_report;
  if v_r.id is null then
    raise exception 'Ese informe ya no existe.';
  end if;
  if v_r.sent_at is null then
    return;
  end if;
  select email into v_email from public.profiles where user_id = auth.uid();
  insert into public.audit_log
    (actor_user_id, actor_email, action, target_table, target_id, reason, details)
  values
    (auth.uid(), v_email, 'progress_report.unlock', 'progress_reports', v_r.id, trim(p_reason),
     jsonb_build_object('student_id', v_r.student_id, 'student_name', v_r.student_name,
       'module_level', v_r.module_level, 'group_label', v_r.group_label,
       'teacher_name', v_r.teacher_name, 'sent_at', v_r.sent_at, 'emailed_at', v_r.emailed_at));
  if v_r.announcement_id is not null then
    delete from public.announcements where id = v_r.announcement_id;
  end if;
  update public.progress_reports
     set sent_at = null, emailed_at = null, announcement_id = null
   where id = v_r.id;
end;
$$;

-- Estudiante: su informe enviado (para descargarlo en PDF desde la novedad).
create or replace function public.get_my_progress_report(p_report uuid)
  returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'module_level', p.module_level,
           'student_name', p.student_name, 'teacher_name', p.teacher_name,
           'cycle_name', p.cycle_name, 'cycle_start', p.cycle_start, 'cycle_end', p.cycle_end,
           'answers', p.answers, 'texts', p.texts, 'exam_pct', p.exam_pct,
           'teacher_note', p.teacher_note, 'sent_at', p.sent_at)
    from public.progress_reports p
   where p.id = p_report
     and p.sent_at is not null
     and p.student_id = public.current_student_id();
$$;

-- Tablón del estudiante: la novedad del informe es personal (kind progress_report).
create or replace function public.get_my_announcements()
  returns table(id uuid, title text, body text, category text, image_url text,
                link_url text, link_label text, pinned boolean, publish_at timestamptz,
                module_level text, kind text, ref_id uuid)
  language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, a.category, a.image_url, a.link_url, a.link_label,
         a.pinned, a.publish_at, coalesce(m.level, xs.module_level, pr.module_level),
         case when xs.id is not null then 'exam_result'
              when pr.id is not null then 'progress_report' end,
         coalesce(xs.id, pr.id)
  from public.announcements a
  left join public.modules m on m.id = a.module_id
  left join public.exam_submissions xs on xs.announcement_id = a.id
  left join public.progress_reports pr on pr.announcement_id = a.id
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

-- Novedad del profesor: se quita cuando todos tienen su resultado con OK.
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
      (select count(*)::int from public.exam_submissions s
        where s.exam_id = m.exam_id and s.group_id = m.group_id and s.status = 'aprobado') as approved,
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
          || 'reciba su resultado. Esta novedad se quita sola cuando todos los estudiantes del grupo tengan '
          || 'su resultado enviado (si alguien no lo presenta, al cerrar la franja).')::text,
         'assets/inicio/noticia-revision-examenes.jpg'::text, m.created_at,
         m.group_id, m.label, m.module_level, m.opens_on, m.closes_on, c.to_review, c.sent, c.enrolled
  from mine m join counts c on c.id = m.id
  where c.to_review > 0
     or (public.lef_today() <= m.closes_on and c.approved < c.enrolled)
  order by m.closes_on;
$$;

revoke all on function public.teacher_send_progress_reports(uuid) from public, anon;
revoke all on function public.admin_unlock_progress_report(uuid, text) from public, anon;
revoke all on function public.get_my_progress_report(uuid) from public, anon;
revoke all on function public.get_my_announcements() from public, anon;
revoke all on function public.get_teacher_news() from public, anon;
grant execute on function public.teacher_send_progress_reports(uuid) to authenticated;
grant execute on function public.admin_unlock_progress_report(uuid, text) to authenticated;
grant execute on function public.get_my_progress_report(uuid) to authenticated;
grant execute on function public.get_my_announcements() to authenticated;
grant execute on function public.get_teacher_news() to authenticated;
