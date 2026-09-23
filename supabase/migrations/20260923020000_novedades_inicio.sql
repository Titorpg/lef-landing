-- LEF — "Inicio" del portal del estudiante: tablón de novedades.
--
-- Pedido del usuario (23 sep 2026): el logo del portal ya no saca de la
-- plataforma; lleva a una pestaña nueva "Inicio" que funciona como tablón de
-- noticias: novedades de LEF, información de sus cursos, pagos y estado de
-- cuenta. Lo del curso/pagos sale de las funciones que ya existen
-- (get_my_course, get_my_billing, get_next_module_offer); lo que LEF quiere
-- compartir lo publica el admin desde el panel (Novedades) en esta tabla.
--
-- Buenas prácticas aplicadas (tablones de plataformas educativas): avisos
-- fijados primero y luego los más recientes; imagen de portada; categoría;
-- dirigidos a todos o solo a los estudiantes de un módulo; con fecha de
-- vencimiento para que no se acumulen avisos viejos.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(trim(title)) between 3 and 140),
  body        text not null default '',
  category    text not null default 'novedad'
              check (category in ('novedad', 'academico', 'evento', 'pagos', 'importante')),
  -- solo imágenes propias del sitio (assets/...) o enlaces https
  image_url   text check (image_url is null or image_url ~ '^(https://|assets/)'),
  link_url    text check (link_url is null or link_url ~ '^https?://'),
  link_label  text,
  pinned      boolean not null default false,
  module_id   uuid references public.modules(id) on delete cascade, -- null = todos
  published   boolean not null default true,
  publish_at  timestamptz not null default now(),
  expires_at  date,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists announcements_feed_idx
  on public.announcements (published, pinned desc, publish_at desc);

alter table public.announcements enable row level security;

-- El admin administra todo desde el panel. El estudiante NO lee la tabla
-- directo: solo por get_my_announcements(), que filtra lo que le aplica.
drop policy if exists "admin gestiona novedades" on public.announcements;
create policy "admin gestiona novedades" on public.announcements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_my_announcements()
  returns table(id uuid, title text, body text, category text, image_url text,
                link_url text, link_label text, pinned boolean, publish_at timestamptz,
                module_level text)
  language sql stable security definer set search_path = public as $$
  select a.id, a.title, a.body, a.category, a.image_url, a.link_url, a.link_label,
         a.pinned, a.publish_at, m.level
  from public.announcements a
  left join public.modules m on m.id = a.module_id
  where public.current_student_id() is not null
    and a.published
    and a.publish_at <= now()
    and (a.expires_at is null or a.expires_at >= public.lef_today())
    and (a.module_id is null or exists (
          select 1 from public.enrollments e
          where e.student_id = public.current_student_id()
            and e.module_id = a.module_id
            and e.status in ('PendingPayment', 'Active')))
  order by a.pinned desc, a.publish_at desc
  limit 40;
$$;

revoke all on function public.get_my_announcements() from public, anon;
grant execute on function public.get_my_announcements() to authenticated;

-- Primera novedad de bienvenida, para que el tablón no arranque vacío
-- (el admin la puede editar o borrar desde Novedades).
insert into public.announcements (title, body, category, image_url, pinned)
select '¡Bienvenido a tu nuevo Inicio en LEF!',
       'Este es tu tablón: aquí vas a ver las novedades de LEF, avisos sobre tus clases y el estado de tu curso y tus pagos, todo en un solo lugar. Revísalo cada vez que entres a la plataforma.',
       'novedad', 'assets/inicio/noticia-clase-online.jpg', true
where not exists (select 1 from public.announcements);
