-- LEF — Planificador: cada profesor ve solo SUS clases de Google Classroom.
--
-- Pedido del usuario (24 sep 2026): las clases de Classroom llevan el nombre
-- del profesor ("LEVEL A1 GR 1 - LUIS CABALLERO", "LEVEL A2 - MARIA RADA").
-- classroom-list filtra por ese nombre: así cuando se creen las clases de los
-- demás niveles, a cada profesor se le suman solas.
--
-- Por defecto se busca con el nombre completo del profesor en LEF. La columna
-- classroom_match permite usar otro nombre: se usa para la cuenta de PRUEBA
-- (Luis Manga), que por ahora ve las clases de Luis Caballero.

alter table public.teachers add column if not exists classroom_match text;

update public.teachers set classroom_match = 'Luis Caballero'
where lower(full_name) like '%luis manga%';

-- Verificación: con qué nombre se buscarán las clases de cada profesor.
select full_name, coalesce(classroom_match, full_name) as busca_clases_con_nombre, active
from public.teachers order by full_name;
