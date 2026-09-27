-- LEF — El nivel A1 también lleva libros complementarios (pedido del usuario, 26 sep 2026).
-- Antes solo A2, B1, B2 y C1.

alter table public.level_complementary_books drop constraint if exists level_complementary_books_level_check;
alter table public.level_complementary_books add constraint level_complementary_books_level_check
  check (level in ('A1','A2','B1','B2','C1'));

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
  order by array_position(array['A1','A2','B1','B2','C1'], b.level), b.created_at;
$$;
revoke all on function public.get_my_complementary_books() from public, anon;
grant execute on function public.get_my_complementary_books() to authenticated;
