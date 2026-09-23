-- LEF — Novedades: subir la imagen de portada desde el equipo del admin.
--
-- Pedido del usuario (23 sep 2026): además de elegir una foto de la galería o
-- pegar un enlace, poder SUBIR una imagen propia. Se guarda en el bucket
-- público "novedades" de Supabase Storage (lectura pública, porque la ve el
-- estudiante en su Inicio); solo el admin puede subir, reemplazar o borrar.
-- Límite: 5 MB y solo imágenes (el panel además la achica antes de subirla).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('novedades', 'novedades', true, 5242880,
          array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  on conflict (id) do update
    set public = true, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "novedades lectura publica" on storage.objects;
create policy "novedades lectura publica" on storage.objects for select
  using (bucket_id = 'novedades');

drop policy if exists "novedades admin sube" on storage.objects;
create policy "novedades admin sube" on storage.objects for insert to authenticated
  with check (bucket_id = 'novedades' and public.is_admin());

drop policy if exists "novedades admin actualiza" on storage.objects;
create policy "novedades admin actualiza" on storage.objects for update to authenticated
  using (bucket_id = 'novedades' and public.is_admin())
  with check (bucket_id = 'novedades' and public.is_admin());

drop policy if exists "novedades admin borra" on storage.objects;
create policy "novedades admin borra" on storage.objects for delete to authenticated
  using (bucket_id = 'novedades' and public.is_admin());
