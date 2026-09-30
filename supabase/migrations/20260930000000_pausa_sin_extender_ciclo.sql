-- LEF — La pausa del ciclo ya NO extiende el fin del grupo (30 sep 2026, pedido
-- del cliente).
--
-- El administrador arma cada ciclo con días de sobra: un módulo tiene 16 agendas
-- (la DAY 16 es el examen de validación) y los grupos reales tienen 20 o más días
-- de clase en su ciclo. Caso real: el B1.1 del profesor Luis Caballero (mar–vie,
-- 29 sep–30 oct) con la semana de receso en pausa (6–9 oct) llega a la DAY 16
-- justo el 30 oct. Por eso la pausa solo congela la numeración de las agendas; el
-- fin del grupo es siempre el del ciclo.
--
-- lef_group_end se conserva (la usan el calendario, Clase de hoy, Mi curso, el
-- cierre de ciclos, etc.) pero ahora devuelve el fin del ciclo.

create or replace function public.lef_group_end(p_group uuid)
  returns date language sql stable security definer set search_path = public as $$
  select c.end_date
  from public.groups g
  join public.schedules s on s.id = g.schedule_id
  join public.cycles c on c.id = s.cycle_id
  where g.id = p_group;
$$;

revoke all on function public.lef_group_end(uuid) from public, anon;
grant execute on function public.lef_group_end(uuid) to authenticated, service_role;
