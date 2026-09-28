-- LEF — Novedad del resultado del examen sin examen (28 sep 2026).
--  Al quitar el examen de PRUEBA A1.3, la base borró en cascada los envíos de ese
--  examen, pero la novedad "Resultado de tu examen de validación" del estudiante
--  (Liam) quedó publicada sin su resultado: se veía vacía, sin "Ver detalle".
--  1) Se borran las novedades de resultado que ya no tienen su envío.
--  2) De aquí en adelante, si se borra un envío (a mano, por el admin o en
--     cascada), su novedad se borra con él. La regla de siempre no cambia: la
--     novedad se quita sola cuando el estudiante tiene activo un módulo posterior.

delete from public.announcements a
 where a.student_id is not null
   and a.title like 'Resultado de tu examen de validaci%'
   and not exists (select 1 from public.exam_submissions xs where xs.announcement_id = a.id);

create or replace function public.exam_submissions_drop_announcement()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.announcement_id is not null then
    delete from public.announcements where id = old.announcement_id;
  end if;
  return old;
end;
$$;

drop trigger if exists exam_submissions_drop_announcement_trg on public.exam_submissions;
create trigger exam_submissions_drop_announcement_trg
  after delete on public.exam_submissions
  for each row execute function public.exam_submissions_drop_announcement();
