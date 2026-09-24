-- LEF — Nivel C1: módulos 13–15 (C1.1 HIRED, C1.2 CERTIFIED, C1.3 FLUENT).
--
-- Pedido del usuario (23 sep 2026): el cliente agrega el nivel C1 con sus
-- tres módulos, en la plataforma (Académico) y en la página pública (el
-- bloque "Módulo especial" de niveles.html). Van después de B2.3 en el orden
-- (module_number 13–15), así que al terminar B2.3 el portal sugiere C1.1.
--
-- La tabla solo aceptaba A1.1…B2.3 y module_number 1–12 (checks de la
-- migración inicial): se sueltan esos checks, se crean de nuevo con C1 y se
-- insertan los tres módulos. Título en inglés, descripción en español (igual
-- que los otros 12). Sin libro de Heyzine todavía: se carga desde Académico.

do $$
declare r record;
begin
  -- Los checks automáticos de level / module_number (nombre generado por
  -- Postgres): se buscan por su definición para no depender del nombre.
  for r in
    select conname from pg_constraint
    where conrelid = 'public.modules'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%level%' or pg_get_constraintdef(oid) ilike '%module_number%')
  loop
    execute format('alter table public.modules drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.modules add constraint modules_level_check
  check (level in ('A1.1','A1.2','A1.3','A2.1','A2.2','A2.3',
                   'B1.1','B1.2','B1.3','B2.1','B2.2','B2.3',
                   'C1.1','C1.2','C1.3'));
alter table public.modules add constraint modules_module_number_check
  check (module_number between 1 and 15);

insert into public.modules (level, module_number, title, description) values
  ('C1.1', 13, 'HIRED',
   'Simulacros de entrevistas de trabajo reales, vocabulario profesional de tu sector, cómo hablar de tu experiencia y tus logros, y cómo negociar con seguridad en inglés.'),
  ('C1.2', 14, 'CERTIFIED',
   'Formato, tiempos y estrategias de exámenes internacionales (IELTS, TOEFL, Cambridge C1), con simulacros de reading, listening, writing y speaking y retroalimentación personalizada.'),
  ('C1.3', 15, 'FLUENT',
   'Expresiones idiomáticas, humor, registro formal e informal y matices culturales para desenvolverte con naturalidad en entornos anglófonos.')
on conflict (level) do nothing;

-- Verificación: deben salir los 15 módulos, C1.1–C1.3 al final.
select module_number, level, title, active from public.modules order by module_number;
