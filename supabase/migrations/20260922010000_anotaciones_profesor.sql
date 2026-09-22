-- LEF — anotaciones privadas del profesor sobre cada estudiante.
--
-- Pedido del usuario (22 sep 2026): en la vista de Estudiantes del profesor,
-- la columna "Acciones" (que ahí no tenía sentido — crear cuenta, resetear
-- contraseña, etc. son cosas del admin) se reemplaza por "Anotaciones": un
-- recuadro de texto libre por estudiante, propio de cada profesor.
--
-- Acceso directo por RLS (sin RPC aparte, igual que el resto de tablas que
-- edita el admin): cada profesor solo puede ver/crear/editar SUS PROPIAS
-- anotaciones (teacher_id = current_teacher_id(), resuelto server-side a
-- partir de auth.uid() — un profesor no puede escribir anotaciones a nombre
-- de otro aunque mande otro teacher_id en el payload).

create table if not exists public.teacher_student_notes (
  teacher_id  uuid not null references public.teachers(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (teacher_id, student_id)
);

alter table public.teacher_student_notes enable row level security;

drop policy if exists "profesor gestiona sus anotaciones" on public.teacher_student_notes;
create policy "profesor gestiona sus anotaciones" on public.teacher_student_notes
  for all to authenticated
  using (teacher_id = public.current_teacher_id())
  with check (teacher_id = public.current_teacher_id());
