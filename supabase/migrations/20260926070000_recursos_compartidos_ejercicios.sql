-- LEF — Recursos compartidos: Ejercicios por habilidad (pedido del usuario, 26 sep 2026).
-- (Antes "Recursos interactivos".) El admin sube las actividades en Recursos
-- compartidos → Ejercicios por habilidad → nivel → módulo → habilidad
-- (Vocabulario, Gramática, Listening, Reading) → "Crear actividad".
-- Cada habilidad tiene VARIAS actividades; las carpetas muestran cuántas hay.
-- Archivo: HTML, PDF, Word, PowerPoint o Excel, en el bucket PRIVADO "ejercicios"
-- (<módulo>/<habilidad>/<archivo>). Un HTML hecho con el molde LEF se guarda
-- además como datos (content).
-- Lo ve: el admin (todo), los profesores (leer) y el estudiante con ESE módulo
-- pagado (lef_my_paid_module, de 20260926060000).

create table if not exists public.skill_activities (
  id           uuid primary key default gen_random_uuid(),
  module_level text not null check (module_level ~ '^(A1|A2|B1|B2|C1)\.[1-3]$'),
  skill        text not null check (skill in ('vocabulario','gramatica','listening','reading')),
  title        text not null check (length(trim(title)) > 0),
  file_path    text not null,
  file_name    text not null,
  file_type    text not null check (file_type in ('html','pdf','word','ppt','excel')),
  file_size    integer,
  content      jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists skill_activities_module_idx on public.skill_activities(module_level, skill, created_at);

alter table public.skill_activities enable row level security;
drop policy if exists "admin gestiona ejercicios" on public.skill_activities;
create policy "admin gestiona ejercicios" on public.skill_activities
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profesor lee ejercicios" on public.skill_activities;
create policy "profesor lee ejercicios" on public.skill_activities
  for select to authenticated using (public.is_teacher());
drop policy if exists "estudiante lee ejercicios pagados" on public.skill_activities;
create policy "estudiante lee ejercicios pagados" on public.skill_activities
  for select to authenticated using (public.lef_my_paid_module(module_level));

insert into storage.buckets (id, name, public, file_size_limit)
values ('ejercicios', 'ejercicios', false, 20971520)   -- 20 MB por archivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "ejercicios admin gestiona" on storage.objects;
create policy "ejercicios admin gestiona" on storage.objects
  for all to authenticated
  using (bucket_id = 'ejercicios' and public.is_admin())
  with check (bucket_id = 'ejercicios' and public.is_admin());
drop policy if exists "ejercicios profesor lee" on storage.objects;
create policy "ejercicios profesor lee" on storage.objects
  for select to authenticated using (bucket_id = 'ejercicios' and public.is_teacher());
drop policy if exists "ejercicios estudiante lee pagados" on storage.objects;
create policy "ejercicios estudiante lee pagados" on storage.objects
  for select to authenticated
  using (bucket_id = 'ejercicios' and public.lef_my_paid_module(split_part(name, '/', 1)));
