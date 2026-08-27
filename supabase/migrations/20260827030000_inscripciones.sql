-- LEF — Etapa A: guardar las inscripciones del formulario del sitio.
-- La tabla recibe INSERT anónimo desde el frontend (clave publishable).
-- Nadie puede LEER sin autenticación: el cliente consulta desde el panel de Supabase.

create table if not exists public.inscripciones (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  nombre      text not null check (char_length(nombre) between 1 and 160),
  telefono    text not null check (char_length(telefono) between 3 and 40),
  email       text not null check (char_length(email) between 3 and 200),
  edad        integer check (edad is null or edad between 3 and 120),
  ciudad      text check (ciudad is null or char_length(ciudad) <= 120),
  nivel       text check (nivel is null or nivel in ('A1','A2','B1','B2')),
  horario     text check (horario is null or char_length(horario) <= 40),
  idioma      text check (idioma is null or idioma in ('es','en')),
  origen      text default 'sitio-web',
  estado      text not null default 'nuevo'
              check (estado in ('nuevo','contactado','inscrito','descartado')),
  notas       text
);

comment on table public.inscripciones is 'Inscripciones enviadas desde el formulario del sitio (etapa A).';

create index if not exists inscripciones_created_at_idx
  on public.inscripciones (created_at desc);

-- Seguridad a nivel de fila
alter table public.inscripciones enable row level security;

-- El público (clave anon/publishable) SOLO puede insertar.
drop policy if exists "public puede insertar inscripciones" on public.inscripciones;
create policy "public puede insertar inscripciones"
  on public.inscripciones
  for insert
  to anon, authenticated
  with check (true);

-- Sin política de SELECT/UPDATE/DELETE para anon => nadie lee ni modifica
-- salvo con la service_role key (panel de Supabase / backend de confianza).
