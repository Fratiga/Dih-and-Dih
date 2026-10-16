-- ECONOMÍA DE CARTAS, parte 20: el Buhonero y el Hipódromo venden del mismo montón.
--
-- Antes: las cartas que un jugador le daba al Buhonero pasaban al estado 'en_mercader', un montón que solo el Buhonero veía. El Hipódromo
-- (y las recompensas) solo repartían lo que estaba en 'en_reserva'. Lo que vendía el Hipódromo sí llegaba al Buhonero, pero no al revés.
-- Ahora: lo que se le da al Buhonero va a la reserva común ('en_reserva'). Así el Buhonero, el Hipódromo y las recompensas reparten del mismo
-- montón. El movimiento sigue anotándose como 'retirada_mercader', así que la regla de «no te vende de vuelta hasta mañana» no cambia.
-- Se puede repetir. Se corre en el SQL Editor de Supabase. No toca datos: solo cambia dos funciones.

-- 1) Lo que se le da al Buhonero va a la reserva común
create or replace function public.cartas_i_retirar(p_ejemplar uuid, p_destino text, p_motivo text, p_referencia text default ''::text, p_por uuid default null::uuid, p_desde_bloqueo boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  ej cartas_ejemplares%rowtype;
  dueno_antes uuid;
  nuevo_estado text;
  tipo_mov text;
begin
  if p_destino not in ('reserva', 'destruida', 'mercader') then raise exception 'Destino inválido'; end if;
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  dueno_antes := ej.propietario;
  perform cartas_i_candado_jugador(dueno_antes);
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.propietario is distinct from dueno_antes then raise exception 'Esa copia cambió de dueño mientras se procesaba: vuelve a intentarlo'; end if;
  if ej.estado = 'bloqueada' then
    if not p_desde_bloqueo or not exists (select 1 from cartas_bloqueos b where b.ejemplar = p_ejemplar and b.referencia = p_referencia) then
      raise exception 'Esa copia está bloqueada';
    end if;
  elsif ej.estado <> 'poseida' or ej.propietario is null then
    raise exception 'Esa copia no está disponible';
  end if;
  -- 'mercader' y 'reserva' terminan en el mismo montón; solo cambia cómo se anota el movimiento
  nuevo_estado := case p_destino when 'destruida' then 'destruida' else 'en_reserva' end;
  tipo_mov := case p_destino when 'reserva' then 'retirada_reserva' when 'destruida' then 'retirada_destruida' else 'retirada_mercader' end;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = null, estado = nuevo_estado, actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia, por)
  values (p_ejemplar, ej.carta_id, tipo_mov, ej.propietario, left(p_motivo, 200), left(p_referencia, 200), p_por);
end;
$function$;

-- 2) Al repartir de la reserva (Hipódromo, recompensas) se prefiere una copia que el Buhonero no tenga en oferta ahora mismo.
--    Si no hay otra, se reparte esa y la oferta se retira sola la próxima vez que alguien mire al Buhonero.
create or replace function public.cartas_i_emitir(p_user uuid, p_carta text, p_motivo text, p_referencia text default ''::text, p_por uuid default null::uuid, p_sin_limite boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  carta cartas_catalogo%rowtype;
  problema text;
  ej cartas_ejemplares%rowtype;
  emitidas int;
begin
  select * into carta from cartas_catalogo where id = p_carta;
  if not found then raise exception 'Esa carta no existe'; end if;
  if not carta.en_circulacion and not p_sin_limite then
    raise exception 'Esa carta todavía no está en circulación';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Ese jugador no existe'; end if;
  perform cartas_i_candado_jugador(p_user);
  perform cartas_i_candado(p_carta);

  problema := cartas_i_error_recibir(p_user, p_carta, 1);
  if problema is not null then raise exception '%', problema; end if;

  select * into ej from cartas_ejemplares x where x.carta_id = p_carta and x.estado = 'en_reserva'
    order by exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = x.id and o.estado = 'activa'), x.numero limit 1 for update;
  if found then
    update cartas_ejemplares set propietario = p_user, estado = 'poseida', actualizada = now() where id = ej.id;
    insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia, por)
    values (ej.id, p_carta, 'entrega_reserva', p_user, left(p_motivo, 200), left(p_referencia, 200), p_por);
    return jsonb_build_object('ejemplar', ej.id, 'numero', ej.numero, 'de_reserva', true);
  end if;

  select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = p_carta;
  if carta.limite is null and not p_sin_limite then
    raise exception 'Esta carta no tiene límite global definido: no se emite por recompensa';
  end if;
  if carta.limite is not null and emitidas >= carta.limite then
    raise exception 'AGOTADA: ya se emitieron las % copias de esta carta', carta.limite;
  end if;

  insert into cartas_ejemplares (carta_id, numero, propietario, estado)
  values (p_carta, emitidas + 1, p_user, 'poseida') returning * into ej;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia, por)
  values (ej.id, p_carta, 'emision', p_user, left(p_motivo, 200), left(p_referencia, 200), p_por);
  return jsonb_build_object('ejemplar', ej.id, 'numero', ej.numero, 'de_reserva', false);
end;
$function$;

-- 3) Las copias que ya estaban en el montón del Buhonero (si hubiera) pasan a la reserva común, salvo las que están en una oferta activa.
--    Las ofertas especiales del admin que no se vendieron quedan como estaban hasta que se retiren.
update cartas_ejemplares e set estado = 'en_reserva', actualizada = now()
 where estado = 'en_mercader'
   and not exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = e.id and o.estado = 'activa');
