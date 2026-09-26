-- LEF — Recursos compartidos: Talleres (pedido del usuario, 26 sep 2026).
-- El admin sube los talleres en Recursos compartidos → Talleres → nivel → módulo →
-- Taller semana 1…4 / Repaso del módulo (slot 1…5). Archivo: HTML, PDF, Word,
-- PowerPoint o Excel, en un espacio PRIVADO (bucket "talleres").
-- Un HTML hecho con la plantilla de taller LEF se guarda además como datos
-- (content) para mostrarlo con el diseño de la plataforma.
-- Lo ve: el admin (todo), los profesores (leer) y el estudiante que tenga ESE
-- módulo pagado (y lo sigue viendo siempre, como el libro).

-- 1. ¿El estudiante actual tiene pagado este módulo (p. ej. 'A1.1')? ------------
create or replace function public.lef_my_paid_module(p_level text)
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.enrollments e
    join public.modules m on m.id = e.module_id
    where e.student_id = public.current_student_id()
      and e.status <> 'Cancelled'
      and m.level = p_level
      and public.lef_enrollment_paid(e.id)
  );
$$;
revoke all on function public.lef_my_paid_module(text) from public, anon;
grant execute on function public.lef_my_paid_module(text) to authenticated;

-- 2. Talleres ---------------------------------------------------------------------
create table if not exists public.workshops (
  id           uuid primary key default gen_random_uuid(),
  module_level text not null check (module_level ~ '^(A1|A2|B1|B2|C1)\.[1-3]$'),
  slot         integer not null check (slot between 1 and 5),  -- 1–4 = semanas, 5 = repaso
  title        text not null check (length(trim(title)) > 0),
  file_path    text not null,
  file_name    text not null,
  file_type    text not null check (file_type in ('html','pdf','word','ppt','excel')),
  file_size    integer,
  content      jsonb,        -- taller interactivo (HTML con la plantilla LEF)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists workshops_module_idx on public.workshops(module_level, slot, created_at);

alter table public.workshops enable row level security;
drop policy if exists "admin gestiona talleres" on public.workshops;
create policy "admin gestiona talleres" on public.workshops
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "profesor lee talleres" on public.workshops;
create policy "profesor lee talleres" on public.workshops
  for select to authenticated using (public.is_teacher());
drop policy if exists "estudiante lee talleres pagados" on public.workshops;
create policy "estudiante lee talleres pagados" on public.workshops
  for select to authenticated using (public.lef_my_paid_module(module_level));

-- 3. Archivos (privados): talleres/<módulo>/<slot>/<archivo> ------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('talleres', 'talleres', false, 20971520)   -- 20 MB por archivo
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "talleres admin gestiona" on storage.objects;
create policy "talleres admin gestiona" on storage.objects
  for all to authenticated
  using (bucket_id = 'talleres' and public.is_admin())
  with check (bucket_id = 'talleres' and public.is_admin());
drop policy if exists "talleres profesor lee" on storage.objects;
create policy "talleres profesor lee" on storage.objects
  for select to authenticated using (bucket_id = 'talleres' and public.is_teacher());
drop policy if exists "talleres estudiante lee pagados" on storage.objects;
create policy "talleres estudiante lee pagados" on storage.objects
  for select to authenticated
  using (bucket_id = 'talleres' and public.lef_my_paid_module(split_part(name, '/', 1)));
