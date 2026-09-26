-- LEF — Libro complementario por módulo (pedido del usuario, 26 sep 2026).
-- Cada módulo tendrá 1 libro principal (heyzine_url, ya en "Mis recursos") y
-- 1 complementario. Por ahora solo se guarda el enlace desde Académico →
-- Módulos → Editar; dónde se muestra se decide más adelante (pendiente).
alter table public.modules add column if not exists complementary_book_url text;
