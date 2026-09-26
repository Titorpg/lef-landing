-- LEF — Libro complementario POR NIVEL (pedido del usuario, 26 sep 2026).
-- Hay un libro complementario para todo el nivel (A2, B1, B2, C1; el A1 NO tiene),
-- no uno por módulo; el admin lo carga desde el primer módulo del nivel (A2.1,
-- B1.1, B2.1, C1.1). En "Mis recursos" del estudiante sale en la carpeta "Libros
-- complementarios" y se le abre el del nivel en cuanto tenga pagado CUALQUIER
-- módulo de ese nivel (y ya queda abierto de ahí en adelante).
-- La columna modules.complementary_book_url (20260926010000) queda sin uso.

create table if not exists public.level_books (
  level                  text primary key check (level in ('A2','B1','B2','C1')),
  complementary_book_url text,
  updated_at             timestamptz not null default now()
);

insert into public.level_books (level) values ('A2'),('B1'),('B2'),('C1')
on conflict (level) do nothing;

alter table public.level_books enable row level security;

-- Solo el admin lee y edita la tabla directamente; el estudiante la recibe por
-- get_my_level_books(), que filtra por lo que tiene pagado.
drop policy if exists "admin gestiona libros por nivel" on public.level_books;
create policy "admin gestiona libros por nivel" on public.level_books
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Niveles abiertos del estudiante (al menos un módulo pagado del nivel) con el
-- enlace de su libro complementario (null si LEF aún no lo ha cargado).
create or replace function public.get_my_level_books()
  returns table(level text, complementary_book_url text)
  language sql stable security definer set search_path = public as $$
  select lb.level, lb.complementary_book_url
  from public.level_books lb
  where exists (
    select 1
    from public.enrollments e
    join public.modules m on m.id = e.module_id
    where e.student_id = public.current_student_id()
      and e.status <> 'Cancelled'
      and split_part(m.level, '.', 1) = lb.level
      and public.lef_enrollment_paid(e.id)
  )
  order by array_position(array['A2','B1','B2','C1'], lb.level);
$$;

revoke all on function public.get_my_level_books() from public, anon;
grant execute on function public.get_my_level_books() to authenticated;
