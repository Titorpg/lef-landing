-- LEF — Recursos compartidos de las clases: Libros (pedido del usuario, 26 sep 2026).
-- Nueva pestaña del admin donde viven los libros:
--   * Libros principales: uno por MÓDULO (modules.heyzine_url, ya existía) y ahora
--     con título propio (modules.book_title). Si no tiene título, se muestra el
--     nombre del módulo.
--   * Libros complementarios: VARIOS por nivel (A2, B1, B2, C1; el A1 no tiene),
--     cada uno con título y link. Reemplaza a level_books (uno solo, sin título):
--     lo que hubiera allí se copia aquí.
-- El estudiante los ve en "Mis recursos" solo si pagó (módulo / algún módulo del nivel).

-- 1. Título del libro principal ------------------------------------------------
alter table public.modules add column if not exists book_title text;

-- 2. Libros complementarios (varios por nivel) ----------------------------------
create table if not exists public.level_complementary_books (
  id         uuid primary key default gen_random_uuid(),
  level      text not null check (level in ('A2','B1','B2','C1')),
  title      text not null check (length(trim(title)) > 0),
  url        text not null check (url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists level_complementary_books_level_idx on public.level_complementary_books(level, created_at);

alter table public.level_complementary_books enable row level security;
drop policy if exists "admin gestiona libros complementarios" on public.level_complementary_books;
create policy "admin gestiona libros complementarios" on public.level_complementary_books
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lo que ya estuviera cargado en level_books pasa aquí (una sola vez).
insert into public.level_complementary_books (level, title, url)
select lb.level, 'Libro complementario ' || lb.level, lb.complementary_book_url
from public.level_books lb
where lb.level in ('A2','B1','B2','C1')
  and lb.complementary_book_url ~ '^https?://'
  and not exists (select 1 from public.level_complementary_books x where x.level = lb.level);

-- 3. Para el estudiante: libros complementarios de sus niveles abiertos ----------
-- (nivel abierto = al menos un módulo de ese nivel pagado; misma regla de antes).
create or replace function public.get_my_complementary_books()
  returns table(level text, id uuid, title text, url text)
  language sql stable security definer set search_path = public as $$
  select b.level, b.id, b.title, b.url
  from public.level_complementary_books b
  where exists (
    select 1
    from public.enrollments e
    join public.modules m on m.id = e.module_id
    where e.student_id = public.current_student_id()
      and e.status <> 'Cancelled'
      and split_part(m.level, '.', 1) = b.level
      and public.lef_enrollment_paid(e.id)
  )
  order by array_position(array['A2','B1','B2','C1'], b.level), b.created_at;
$$;
revoke all on function public.get_my_complementary_books() from public, anon;
grant execute on function public.get_my_complementary_books() to authenticated;

-- 4. get_my_course entrega también el título del libro principal ----------------
-- (misma función de 20260923070000 + module_book_title al final).
drop function if exists public.get_my_course();

create or replace function public.get_my_course()
  returns table(
    enrollment_status text, registration_number text,
    module_level text, module_title text, module_description text, module_number integer,
    schedule_days text[], schedule_start_time time, schedule_end_time time,
    teacher_full_name text, cycle_start_date date, cycle_end_date date,
    module_heyzine_url text, module_paid boolean, module_book_title text)
  language sql stable security definer set search_path = public as $$
  select e.status, e.registration_number,
         m.level, m.title, m.description, m.module_number,
         case when e.status = 'Completed' then coalesce(sch.days, e.hist_days) else sch.days end,
         case when e.status = 'Completed' then coalesce(sch.start_time, e.hist_start_time) else sch.start_time end,
         case when e.status = 'Completed' then coalesce(sch.end_time, e.hist_end_time) else sch.end_time end,
         case when e.status = 'Completed' then coalesce(t.full_name, e.hist_teacher_name) else t.full_name end,
         case when e.status = 'Completed' then coalesce(c.start_date, e.hist_cycle_start) else c.start_date end,
         case when e.status = 'Completed' then coalesce(c.end_date, e.hist_cycle_end) else c.end_date end,
         case when paid.ok then m.heyzine_url end,
         paid.ok,
         m.book_title
  from public.enrollments e
  join public.modules m on m.id = e.module_id
  cross join lateral (select public.lef_enrollment_paid(e.id) as ok) paid
  left join public.groups g on g.id = e.group_id
  left join public.schedules sch on sch.id = g.schedule_id
  left join public.teachers t on t.id = g.teacher_id
  left join public.cycles c on c.id = e.cycle_id
  where e.student_id = public.current_student_id()
    and e.status <> 'Cancelled'
  order by e.created_at desc;
$$;

revoke all on function public.get_my_course() from public, anon;
grant execute on function public.get_my_course() to authenticated;
