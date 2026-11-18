-- HIPÓDROMO, parte 6: la cuadra como casa (divisa, patrocinio de carreras, obras y subastas).
-- Cambia una sola función que ya existe, sin tocar tablas ni datos (se puede ejecutar más de una vez): hipodromo_ordenar acepta las órdenes nuevas
-- «divisa», «patrocinar», «ampliar», «instalacion», «subastar» y «pujar», y tres campos más: la divisa (dos colores, dibujo y emblema), «monto» y «titulo».
-- Orden: primero despliega la Edge Function con el motor nuevo (el commit que lo trae); después ejecuta esto. Si se hace al revés, las órdenes nuevas
-- llegarían a un motor que no las conoce y se rechazarían como «Orden desconocida» (sin cobrar nada).
create or replace function public.hipodromo_ordenar(p_datos jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text := p_datos->>'tipo';
  v_d jsonb;
  v_id bigint;
  v_div jsonb := case when jsonb_typeof(p_datos->'divisa') = 'object' then p_datos->'divisa' end;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  if v_tipo is null or v_tipo not in ('adoptar', 'comprar', 'vender', 'inscribir', 'desinscribir', 'entrenar', 'cuidar', 'tactica', 'nombre', 'retirar', 'cruzar', 'monta', 'objeto',
                                      'divisa', 'patrocinar', 'ampliar', 'instalacion', 'subastar', 'pujar') then
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
    -- el precio de monta de un semental, el precio de salida de una subasta o lo que se puja (sin precio = el de siempre)
    'precio', case when jsonb_typeof(p_datos->'precio') = 'number' then round((p_datos->>'precio')::numeric)::integer end,
    -- los objetos del criadero y las instalaciones (cuál y si se quita)
    'objeto', left(p_datos->>'objeto', 24), 'quitar', case when p_datos->>'quitar' = 'true' then true end,
    -- lo que se pone en la bolsa de una carrera y el nombre que se le da
    'monto', case when jsonb_typeof(p_datos->'monto') = 'number' then round((p_datos->>'monto')::numeric)::integer end,
    'titulo', left(p_datos->>'titulo', 32),
    -- la divisa de la cuadra: solo sus cuatro campos, cortos (el motor comprueba que existan)
    'divisa', case when v_div is not null then jsonb_build_object('c1', left(v_div->>'c1', 12), 'c2', left(v_div->>'c2', 12), 'patron', left(v_div->>'patron', 12), 'emblema', left(v_div->>'emblema', 12)) end));
  insert into hipodromo_ordenes (usuario, datos) values (v_uid, v_d) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.hipodromo_ordenar(jsonb) from public, anon;
grant execute on function public.hipodromo_ordenar(jsonb) to authenticated;
