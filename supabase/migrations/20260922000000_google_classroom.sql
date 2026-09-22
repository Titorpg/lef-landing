-- LEF — integración de solo lectura con Google Classroom (por profesor).
--
-- Pedido del usuario (22 sep 2026): traer a la plataforma los cursos que ya
-- tiene creados en Google Classroom, organizados por tema, para que los
-- profesores los vean dentro de LEF. Solo cursos + temas + materiales, con
-- un enlace para abrir cada uno en Classroom — nada de tareas calificadas ni
-- entregas de estudiantes. Conexión por profesor (OAuth estándar, cada quien
-- autoriza su propia cuenta) en vez de domain-wide delegation, y la app de
-- Google Cloud se registra como "Interna" (el Workspace de LEF lo permite)
-- para no necesitar el proceso de revisión de Google.
--
-- Los tokens los maneja únicamente supabase/functions/classroom-oauth-start,
-- classroom-oauth-callback y classroom-list (service role) — esta tabla no
-- tiene ninguna política de RLS con "using", así que nadie entra por
-- PostgREST directo, ni siquiera el propio profesor dueño de la fila.

create table if not exists public.teacher_google_tokens (
  teacher_id               uuid primary key references public.teachers(id) on delete cascade,
  google_email             text,
  refresh_token            text not null,
  access_token             text,
  access_token_expires_at  timestamptz,
  connected_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.teacher_google_tokens enable row level security;

create or replace function public.current_teacher_id()
  returns uuid language sql stable security definer set search_path = public as $$
  select teacher_id from public.profiles where user_id = auth.uid() and active;
$$;

grant execute on function public.current_teacher_id() to authenticated;

-- El profesor consulta su propio estado de conexión sin ver el token.
create or replace function public.get_my_classroom_connection()
  returns table(connected boolean, google_email text)
  language sql stable security definer set search_path = public as $$
  select count(*) > 0, max(t.google_email)
  from public.teacher_google_tokens t
  where t.teacher_id = public.current_teacher_id();
$$;

grant execute on function public.get_my_classroom_connection() to authenticated;

create or replace function public.disconnect_my_classroom()
  returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.teacher_google_tokens where teacher_id = public.current_teacher_id();
end;
$$;

revoke all on function public.disconnect_my_classroom() from public, anon;
grant execute on function public.disconnect_my_classroom() to authenticated;
