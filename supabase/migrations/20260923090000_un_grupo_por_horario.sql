-- LEF — Un horario tiene UN solo grupo (= un solo profesor).
--
-- Pedido del usuario (23 sep 2026): al crear un grupo solo deben salir los
-- horarios que todavía no tienen profesor, para que el mismo horario y módulo
-- no termine asignado a dos profesores distintos. El panel ya filtra la lista;
-- esto lo garantiza en la base de datos por cualquier camino.
-- Cuenta también los grupos desactivados (siguen ocupando su horario). Si se
-- necesitan dos grupos a la misma hora, se crea un segundo horario igual.

-- Si ya hay horarios con más de un grupo, no se crea la regla y se avisa cuáles
-- son (hay que dejar uno solo por horario desde el panel y volver a correr esto).
do $$
declare v_dups text;
begin
  select string_agg(m.level || ' ' || array_to_string(s.days, ',') || ' ' ||
                    to_char(s.start_time, 'HH24:MI') || ' (' || x.n || ' grupos)', '; ')
    into v_dups
  from (select schedule_id, count(*) n from public.groups group by schedule_id having count(*) > 1) x
  join public.schedules s on s.id = x.schedule_id
  join public.modules m on m.id = s.module_id;

  if v_dups is not null then
    raise exception 'Hay horarios con más de un grupo: %. Deja un solo grupo en cada uno y vuelve a ejecutar.', v_dups;
  end if;
end $$;

create unique index if not exists groups_one_per_schedule on public.groups (schedule_id);
