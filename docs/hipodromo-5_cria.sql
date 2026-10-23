-- HIPÓDROMO, parte 5: la cría dirigida (mutaciones, camadas, parentesco y precio de monta).
-- Cambia una sola función que ya existe, sin tocar tablas ni datos (se puede ejecutar más de una vez): hipodromo_ordenar acepta la orden nueva «monta»
-- (el dueño de un semental pone lo que cobra por montarlo) y dos campos más: «precio» y «riesgo» (confirmar que se cruzan parientes cercanos).
-- Antes de ejecutarlo, despliega la Edge Function con el motor nuevo; si no, la orden nueva llegaría y el motor la rechazaría como desconocida.
create or replace function public.hipodromo_ordenar(p_datos jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text := p_datos->>'tipo';
  v_d jsonb;
  v_id bigint;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  if v_tipo is null or v_tipo not in ('adoptar', 'comprar', 'vender', 'inscribir', 'desinscribir', 'entrenar', 'cuidar', 'tactica', 'nombre', 'retirar', 'cruzar', 'monta') then
    raise exception 'Orden desconocida.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  if (select count(*) from hipodromo_ordenes where usuario = v_uid and estado = 'pendiente') >= 20 then
    raise exception 'Tienes demasiadas órdenes sin resolver.';
  end if;
  -- solo se guardan los campos conocidos y el dueño es siempre quien manda la orden
  v_d := jsonb_strip_nulls(jsonb_build_object(
    'tipo', v_tipo, 'dueno', v_uid::text,
    'id', case when p_datos ? 'id' then (p_datos->>'id')::bigint end,
    'n', case when p_datos ? 'n' then (p_datos->>'n')::integer end,
    'madre', case when p_datos ? 'madre' then (p_datos->>'madre')::bigint end,
    'padre', case when p_datos ? 'padre' then (p_datos->>'padre')::bigint end,
    'stat', left(p_datos->>'stat', 8), 'tactica', left(p_datos->>'tactica', 8), 'sexo', left(p_datos->>'sexo', 1),
    'nombre', left(p_datos->>'nombre', 28),
    -- el precio de monta de un semental (sin precio = el de siempre) y la confirmación del riesgo al cruzar parientes
    'precio', case when jsonb_typeof(p_datos->'precio') = 'number' then round((p_datos->>'precio')::numeric)::integer end,
    'riesgo', case when p_datos->>'riesgo' = 'true' then true end));
  insert into hipodromo_ordenes (usuario, datos) values (v_uid, v_d) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.hipodromo_ordenar(jsonb) from public, anon;
grant execute on function public.hipodromo_ordenar(jsonb) to authenticated;
