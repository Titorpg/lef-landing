-- LEF — numeración de recibos con la nomenclatura de la DIAN.
--
-- Pedido del usuario (23 sep 2026): mientras el cliente decide si va a emitir
-- factura electrónica, que los recibos que genera Pagos sigan la nomenclatura
-- que la DIAN exige para la numeración de facturación:
--   * PREFIJO de máximo 4 caracteres, solo letras y/o números (sin guiones,
--     puntos ni otros símbolos).
--   * NÚMERO CONSECUTIVO, continuo — no se reinicia cada año (la DIAN autoriza
--     rangos "desde–hasta" por resolución, no por año calendario).
--   * El número del documento es prefijo + consecutivo, pegados: RC1, RC2…
-- Fuente: micrositios.dian.gov.co (numeración de facturación, preguntas
-- frecuentes) y guías de Siigo/Alegra sobre prefijos.
--
-- Antes: 'REC-2026-00007' (guiones y año, con contador que se reiniciaba cada
-- año). Los recibos ya emitidos NO se renombran (los pagos son inmutables);
-- los nuevos siguen el mismo contador, sin saltos ni repetidos.
--
-- Prefijo "RC" = Recibo de Caja. Estos recibos son el soporte interno del
-- pago, NO son factura electrónica: si LEF decide facturar, el número de la
-- factura lo asigna la resolución de la DIAN a través del proveedor
-- (Siigo/Alegra/Factus), y se guardaría aparte en cada pago.

-- El contador global vive en receipt_counters con year = 0 (fila única),
-- arrancando donde quedó el contador por año más alto.
insert into public.receipt_counters (year, next_seq)
  select 0, coalesce(max(next_seq), 1) from public.receipt_counters where year <> 0
  on conflict (year) do nothing;

create or replace function public.lef_receipt_prefix()
  returns text language sql immutable as $$
  select 'RC'::text;  -- máx. 4 letras/números, sin símbolos (regla DIAN)
$$;

create or replace function public.next_receipt_number()
  returns text language plpgsql security definer set search_path = public as $$
declare v_seq int;
begin
  update public.receipt_counters set next_seq = next_seq + 1
    where year = 0
    returning next_seq - 1 into v_seq;
  if v_seq is null then
    insert into public.receipt_counters (year, next_seq) values (0, 2)
      on conflict (year) do update set next_seq = public.receipt_counters.next_seq + 1
      returning next_seq - 1 into v_seq;
  end if;
  return public.lef_receipt_prefix() || v_seq::text;
end;
$$;

revoke all on function public.next_receipt_number() from public, anon, authenticated;

-- Reiniciar la numeración a 1 (SOLO para el arranque real, después de borrar
-- los pagos de prueba): el admin nunca lo hace desde el panel; se corre a mano
-- una única vez en el SQL Editor:
--   update public.receipt_counters set next_seq = 1 where year = 0;
