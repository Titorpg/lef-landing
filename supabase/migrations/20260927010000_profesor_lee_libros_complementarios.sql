-- LEF — Recursos de la clase del profesor (pedido del usuario, 27 sep 2026).
-- El profesor ve las mismas carpetas de Recursos compartidos que el admin, solo
-- para leer. Talleres y Ejercicios por habilidad ya tenían su política de lectura
-- para profesores; faltaba la de Libros complementarios.

drop policy if exists "profesor lee libros complementarios" on public.level_complementary_books;
create policy "profesor lee libros complementarios" on public.level_complementary_books
  for select to authenticated using (public.is_teacher());
