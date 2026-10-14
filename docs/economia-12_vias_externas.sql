-- ECONOMÍA DE CARTAS, parte 12: La Fractura pasa por el sistema oficial de recompensas. BORRADOR SIN APLICAR (decisión del usuario, 13 oct).
-- Corre DESPUÉS de economia_7 a economia_11. Se puede correr más de una vez.
--
-- Antes: fractura_recompensa escribía DIRECTAMENTE en cartas_coleccion (sin ejemplares, sin movimientos, sin límites, sin la etiqueta
-- «En circulación»), y esa copia fantasma se perdía en cuanto el jugador recibía un ejemplar real de esa carta.
-- Ahora La Fractura es un juego más de cartas_juegos ('fractura'), con los mismos topes diarios, tramos, límites global y por
-- jugador, disponibilidad, etiqueta «En circulación», sellos y registro que el resto, y la carta sale por cartas_i_emitir (ejemplar +
-- movimiento). Si no hay ninguna carta elegible, el sistema oficial baja de rareza y, si no queda nada, da un sello: nunca crea una
-- copia fantasma ni pasa un límite.
--   * Una victoria vale 1 (tramo «bueno»); con logros de dificultad, núcleo o capital vale 3 («excelente»); con una primera victoria,
--     leyenda, némesis o tres generaciones vale 4 («extraordinario»). Es la misma escala que las rarezas de antes.
--   * Las guerras entre jugadores (pvp), las perdidas y las ya reclamadas siguen sin dar nada.
--   * El juego nace APAGADO (activo = false): hasta que lo enciendas en el panel no sale ninguna carta y la guerra NO se gasta (se podrá
--     reclamar cuando se encienda). Las recompensas del resto de juegos siguen como estén.

-- 1) Valor de una partida: se añade La Fractura (el valor ya viene calculado por la función de abajo)
create or replace function cartas_valor_juego(p_juego text, p_clave text, p_resultado text, p_puntuacion numeric)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  dif int;
begin
  if p_juego = 'hooey' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 1000);
  end if;
  if p_juego = 'fractura' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 4);
  end if;
  if p_juego = 'ajedrez' then
    if p_clave = 'hooey' then return -1; end if;   -- el rival del caos no da premio
    dif := case p_clave when 'ocevat' then 1 when 'baraja' then 2 when 'ilyth' then 3 when 'perro' then 4 else 1 end;
    return case p_resultado when 'gana' then dif when 'tablas' then greatest(dif - 1, 0) else 0 end;
  end if;
  if p_juego = 'duelo' then
    dif := case p_clave when 'recluta' then 1 when 'miliciano' then 2 when 'caballero' then 3 when 'adam' then 4 else 1 end;
    return case p_resultado when 'gana' then dif else 0 end;
  end if;
  if p_juego = 'arqueria' then
    dif := case p_clave when 'hornet' then 1 when 'garra' then 2 when 'cassius' then 3 else 1 end;
    return case p_resultado when 'gana' then least(dif + case when coalesce(p_puntuacion, 0) >= 30 then 1 else 0 end, 4) else 0 end;
  end if;
  return 0;
end;
$$;

-- 2) El juego en la tabla de configuración (apagado). Mismos umbrales, topes y pesos que los demás.
insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos) values
  ('fractura', 'La Fractura', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 3, 0, 5, '{}',
   '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}')
on conflict (juego) do nothing;

-- 3) La recompensa: reclamar el premio de una guerra ganada = terminar una partida de recompensa del juego 'fractura'
create or replace function fractura_recompensa(p_guerra uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g fractura_guerras%rowtype;
  cfg cartas_juegos%rowtype;
  valor numeric := 1;
  v_token uuid;
  r jsonb;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into g from fractura_guerras where id = p_guerra for update;
  if not found or g.user_id <> uid then raise exception 'Esa guerra no es tuya'; end if;
  if g.resultado <> 'victoria' then raise exception 'Solo se premia ganar'; end if;
  if g.pvp then raise exception 'Las guerras entre jugadores no dan cartas'; end if;
  if g.recompensada then raise exception 'Esa guerra ya dio su premio'; end if;

  select * into cfg from cartas_juegos where juego = 'fractura';
  if not found or not cfg.activo then
    -- Apagado: no se da nada y la guerra no se gasta (se podrá reclamar cuando se encienda)
    return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo');
  end if;

  if g.logros ? 'victoria_dificil' or g.logros ? 'nucleo' or g.logros ? 'capital' then valor := 3; end if;
  if exists (select 1 from jsonb_array_elements_text(g.logros) l where l like 'primera_victoria:%')
     or g.logros ? 'leyenda' or g.logros ? 'nemesis' or g.logros ? 'tres_generaciones' then
    valor := 4;
  end if;

  -- El mismo camino que los demás minijuegos: una partida de recompensa y su cierre (topes, límites, circulación, sellos, registro)
  insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'fractura', left(p_guerra::text, 40), now() - interval '1 hour')
  returning token into v_token;
  r := cartas_i_juego_terminar_nucleo(v_token, 'gana', valor);

  update fractura_guerras set recompensada = true where id = p_guerra;
  if r ->> 'resultado' = 'carta' then
    r := r || jsonb_build_object('cantidad', (select count(*) from cartas_ejemplares where propietario = uid and carta_id = r ->> 'carta' and estado in ('poseida', 'bloqueada')));
  end if;
  return r;
end;
$$;
revoke execute on function fractura_recompensa(uuid) from public, anon;
grant execute on function fractura_recompensa(uuid) to authenticated;
