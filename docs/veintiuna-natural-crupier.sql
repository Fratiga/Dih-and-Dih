-- Las Veintiuna Velas: el 21 natural de la crupier ya no cierra la mano al repartir (29-oct-2026).
-- La mano se juega con normalidad; al final el natural de la crupier gana a cualquier 21 que no sea natural, y mientras lo tenga los peajes de las reglas especiales salen gratis.
-- Solo cambia la lógica de estas cuatro funciones (el resto de docs/veintiuna.sql sigue igual). Se puede repetir sin problema. Las funciones conservan sus permisos.
-- Ver docs/veintiuna.md («Orden al repartir»).

create or replace function veintiuna_i_aplicar(p_id uuid, p_accion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p veintiuna_partidas%rowtype;
  figura int;
  vj record;
  vc record;
  fraccion numeric;
  peaje numeric;
  v_saldo numeric;
  v_mov bigint;
  nueva smallint;
  cru smallint[];
  rep int;
  n int;
  v_cn boolean;
begin
  select * into p from veintiuna_partidas where id = p_id for update;
  if p.estado <> 'en_curso' then perform veintiuna_i_error('Esa mano ya terminó.', 'mano_terminada'); end if;
  figura := case p.regla when 'maldicion' then 11 else 10 end;
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
  -- Si la crupier tiene un 21 natural la mano se juega igual, pero está decidida: mientras lo tenga, las reglas de pago (peajes) salen gratis para que nadie pague por jugarla
  select * into vc from veintiuna_i_valor(p.crupier, '{}'::int[], figura);
  v_cn := vc.total = 21 and array_length(p.crupier, 1) = 2;

  if p_accion = 'pedir' then
    if p.fase <> 'jugador' then perform veintiuna_i_error('Ahora no puedes pedir carta.', 'accion_invalida'); end if;
    if vj.total >= 21 then perform veintiuna_i_error('Ya tienes 21: plántate.', 'accion_invalida'); end if;
    nueva := p.mazo[p.repartidas + 1];
    update veintiuna_partidas set jugador = jugador || nueva, repartidas = repartidas + 1 where id = p_id returning * into p;
    select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
    if vj.total > 21 then
      if p.regla = 'fortuna' and not p.fortuna_usada then
        update veintiuna_partidas set fase = 'fortuna' where id = p_id;     -- decide el jugador: salvar la mano pagando el peaje, o aceptar la derrota
        return;
      end if;
      if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;          -- su apuesta ya está en el bote; se cierra al acabar la ronda
      else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    end if;
    return;
  end if;

  if p_accion = 'fortuna' then
    if p.regla <> 'fortuna' or p.fase <> 'fortuna' or p.fortuna_usada then perform veintiuna_i_error('La Fortuna no está disponible ahora.', 'accion_invalida'); end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric;
    peaje := case when v_cn then 0 else round(p.apuesta * fraccion, 2) end;
    if p.modo = 'apuesta' and peaje > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan los tokens para el peaje de la Fortuna (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
      update hipodromo_billeteras set saldo = saldo - peaje where usuario = p.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (p.user_id, null, 'Veintiuna Velas: peaje de la Fortuna (mano ' || p.id || ')', -peaje, v_saldo) returning id into v_mov;
    end if;
    update veintiuna_partidas set fase = 'jugador', fortuna_usada = true, peajes = peajes + peaje,
      jugador_as1 = jugador_as1 || array_length(jugador, 1), mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    return;
  end if;

  if p_accion = 'aceptar' then
    if p.fase <> 'fortuna' then perform veintiuna_i_error('No hay nada que aceptar.', 'accion_invalida'); end if;
    if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;
    else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    return;
  end if;

  if p_accion = 'voluntad' then
    -- Cambias tu última carta por la siguiente de la baraja (peaje). Si la nueva te pasa de 21, pierdes (no hay Fortuna en esta regla).
    if p.regla <> 'voluntad' or p.fase <> 'jugador' or p.voluntad_usada then perform veintiuna_i_error('La Última voluntad no está disponible ahora.', 'accion_invalida'); end if;
    if vj.total >= 21 then perform veintiuna_i_error('Con 21 no hace falta cambiar nada: plántate.', 'accion_invalida'); end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_voluntad', '0.5'))::text::numeric;
    peaje := case when v_cn then 0 else round(p.apuesta * fraccion, 2) end;
    if p.modo = 'apuesta' and peaje > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan los tokens para el peaje de la Última voluntad (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
      update hipodromo_billeteras set saldo = saldo - peaje where usuario = p.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (p.user_id, null, 'Veintiuna Velas: peaje de la Última voluntad (mano ' || p.id || ')', -peaje, v_saldo) returning id into v_mov;
    end if;
    n := array_length(p.jugador, 1);
    nueva := p.mazo[p.repartidas + 1];
    update veintiuna_partidas set voluntad_usada = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje),
      jugador = p.jugador[1:n - 1] || nueva, repartidas = repartidas + 1, jugador_as1 = array_remove(jugador_as1, n)
      where id = p_id returning * into p;
    select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
    if vj.total > 21 then
      if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;
      else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    end if;
    return;
  end if;

  if p_accion in ('ojo', 'marcadas', 'trueque') then
    if p.regla <> p_accion or p.fase <> 'jugador' then perform veintiuna_i_error('Esa acción no está disponible ahora.', 'accion_invalida'); end if;
    peaje := case when v_cn then 0 else veintiuna_i_peaje(p.regla, p.apuesta) end;
    if p_accion = 'ojo' then
      -- Ojo del Tahúr: pagas y ves la siguiente carta de la baraja (será tu próxima carta, o la primera que robe el crupier si te plantas)
      if p.ojo_pos is not null then perform veintiuna_i_error('Ya miraste la baraja en esta mano.', 'accion_invalida'); end if;
      if vj.total >= 21 then perform veintiuna_i_error('Con 21 no hace falta mirar: plántate.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'del Ojo del Tahúr', p.id) else null end;
      update veintiuna_partidas set ojo_pos = repartidas, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    elsif p_accion = 'marcadas' then
      -- Cartas marcadas: pagas y ves la carta oculta del crupier
      if p.marcadas_usada then perform veintiuna_i_error('Ya viste la carta oculta en esta mano.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'de las Cartas marcadas', p.id) else null end;
      update veintiuna_partidas set marcadas_usada = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    else
      -- Trueque con la casa: antes de pedir carta, tu primera carta se cambia por la que el crupier tiene boca arriba
      if p.trueque_usado then perform veintiuna_i_error('Ya hiciste el trueque en esta mano.', 'accion_invalida'); end if;
      if array_length(p.jugador, 1) <> 2 then perform veintiuna_i_error('El trueque solo vale antes de pedir carta.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'del Trueque con la casa', p.id) else null end;
      update veintiuna_partidas set trueque_usado = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje),
        jugador = array[crupier[1], jugador[2]], crupier = array[jugador[1], crupier[2]] where id = p_id;
    end if;
    return;
  end if;

  if p_accion = 'plantar' then
    if p.fase <> 'jugador' then perform veintiuna_i_error('Ahora no puedes plantarte.', 'accion_invalida'); end if;
  else
    perform veintiuna_i_error('Esa acción no existe.', 'accion_invalida');
  end if;

  -- Plantarse en una mesa con amigos: la mano espera; el crupier juega cuando han acabado todos (veintiuna_i_amigos_cerrar_ronda)
  if p.mesa is not null then
    update veintiuna_partidas set fase = 'plantada' where id = p_id;
    return;
  end if;

  -- Plantarse: el crupier juega su turno
  select o_crupier, o_repartidas into cru, rep from veintiuna_i_turno_crupier(p.mazo, p.repartidas, p.crupier, figura, false, case when p.regla = 'vela' then 16 else 17 end);
  update veintiuna_partidas set crupier = cru, repartidas = rep where id = p_id;
  select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
  if vc.total = 21 and array_length(cru, 1) = 2 and not (array_length(p.jugador, 1) = 2 and vj.total = 21) then
    perform veintiuna_i_liquidar(p_id, 'derrota', 'natural_crupier');                  -- el blackjack natural de la crupier gana a cualquier 21 que no lo sea
  elsif vc.total > 21 then
    perform veintiuna_i_liquidar(p_id, 'victoria', 'crupier_se_pasa');
  elsif vj.total > vc.total then
    perform veintiuna_i_liquidar(p_id, 'victoria', 'mayor');
  elsif vj.total < vc.total then
    perform veintiuna_i_liquidar(p_id, 'derrota', 'menor');
  else
    perform veintiuna_i_liquidar(p_id, 'empate', 'igual');
  end if;
end;
$$;

create or replace function veintiuna_i_repartir(p_uid uuid, p_cliente uuid, p_modo text, p_apuesta numeric, p_mazo smallint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := p_uid;
  min_a numeric := (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric;
  max_a numeric := (cartas_ajuste('veintiuna_apuesta_max', '0'))::text::numeric;
  paso_a numeric := (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric;
  est veintiuna_estadisticas%rowtype;
  p veintiuna_partidas%rowtype;
  v_id uuid := gen_random_uuid();
  v_apuesta numeric;
  v_saldo numeric;
  v_mov bigint;
  v_regla text;
  v_mazo smallint[];
  figura int;
  vj record;
  vc record;
  v_res text;
  v_razon text;
  v_jug smallint[];
  v_cru smallint[];
  v_rep int;
  v_dado int;
  v_evento text;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if p_cliente is null then perform veintiuna_i_error('Falta el identificador de la mano.', 'peticion_invalida'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));

  select * into p from veintiuna_partidas where user_id = uid and cliente = p_cliente;
  if found then return veintiuna_i_estado(p, veintiuna_i_saldo(uid)) || jsonb_build_object('repetida', true); end if;

  perform veintiuna_i_cerrar_inactiva(uid);
  if exists (select 1 from veintiuna_asientos where user_id = uid) then
    perform veintiuna_i_error('Estás sentado en una mesa con amigos. Levántate de ella para jugar solo.', 'en_mesa');
  end if;
  if exists (select 1 from veintiuna_partidas where user_id = uid and estado = 'en_curso') then
    perform veintiuna_i_error('Ya tienes una mano en curso. Termínala antes de repartir otra.', 'mano_en_curso');
  end if;
  if p_modo not in ('apuesta', 'practica') then perform veintiuna_i_error('Esa modalidad no existe.', 'peticion_invalida'); end if;
  if p_modo = 'apuesta' then
    v_apuesta := p_apuesta;
    if v_apuesta is null or v_apuesta < min_a or (max_a > 0 and v_apuesta > max_a) then
      perform veintiuna_i_error(case when max_a > 0 then 'La apuesta va de ' || min_a || ' a ' || max_a || ' tokens.' else 'La apuesta mínima es de ' || min_a || ' tokens.' end, 'apuesta_invalida');
    end if;
    if v_apuesta <> trunc(v_apuesta / paso_a) * paso_a then
      perform veintiuna_i_error('La apuesta tiene que ser múltiplo de ' || paso_a || '.', 'apuesta_invalida');
    end if;
  else
    v_apuesta := min_a;                                              -- la mesa de práctica usa una apuesta simbólica que no se cobra
  end if;

  insert into veintiuna_estadisticas (user_id, proxima_regla) values (uid, veintiuna_i_regla_nueva()) on conflict do nothing;
  select * into est from veintiuna_estadisticas where user_id = uid for update;
  v_regla := est.proxima_regla;
  update veintiuna_estadisticas set proxima_regla = veintiuna_i_regla_nueva() where user_id = uid;
  figura := case v_regla when 'maldicion' then 11 else 10 end;
  v_mazo := p_mazo;
  v_jug := array[v_mazo[1], v_mazo[3]];
  v_cru := array[v_mazo[2], v_mazo[4]];
  v_rep := 4;
  -- Pacto del Bufón: tira un dado. 1 o 2, nada; 3 o 4, la carta visible del crupier se cambia por la siguiente de la baraja; 5 o 6, lo mismo con tu primera carta.
  -- (Es un cambio por una carta al azar, así que no cambia el valor esperado de la mano; solo pone caos antes de que decidas nada.)
  if v_regla = 'bufon' then
    v_dado := veintiuna_i_azar(6);
    v_evento := case when v_dado < 2 then 'nada' when v_dado < 4 then 'crupier' else 'jugador' end;
    if v_evento = 'crupier' then v_cru[1] := v_mazo[5]; v_rep := 5;
    elsif v_evento = 'jugador' then v_jug[1] := v_mazo[5]; v_rep := 5; end if;
  end if;

  if p_modo = 'apuesta' then
    insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
    select saldo into v_saldo from hipodromo_billeteras where usuario = uid for update;
    if v_apuesta > v_saldo then
      perform veintiuna_i_error('No tienes tantos tokens: te faltan ' || trim_scale(v_apuesta - v_saldo) || '.', 'saldo_insuficiente');
    end if;
    update hipodromo_billeteras set saldo = saldo - v_apuesta where usuario = uid returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
      values (uid, null, 'Veintiuna Velas: apuesta (mano ' || v_id || ')', -v_apuesta, v_saldo) returning id into v_mov;
  end if;

  -- Reparto: jugador, crupier (la carta que se ve), jugador, crupier (la oculta)
  insert into veintiuna_partidas (id, user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier, mov_cobro, bufon_evento)
    values (v_id, uid, p_cliente, p_modo, v_apuesta, v_regla, v_mazo, v_rep, v_jug, v_cru, v_mov, v_evento)
    returning * into p;

  -- Orden de resolución al repartir
  select * into vj from veintiuna_i_valor(p.jugador, '{}'::int[], figura);
  select * into vc from veintiuna_i_valor(p.crupier, '{}'::int[], figura);
  if vj.total > 21 then v_res := 'derrota'; v_razon := 'pasado_al_repartir';                  -- solo con la Maldición: dos figuras suman 22
  elsif vj.total = 21 and vc.total = 21 then v_res := 'empate'; v_razon := 'ambos_natural';
  elsif vj.total = 21 then v_res := 'natural'; v_razon := 'natural';
  elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_pasado_al_repartir';       -- solo con la Maldición
  end if;
  if v_res is not null then perform veintiuna_i_liquidar(v_id, v_res, v_razon); end if;

  select * into p from veintiuna_partidas where id = v_id;
  return veintiuna_i_estado(p, veintiuna_i_saldo(uid));
end;
$$;

create or replace function veintiuna_i_amigos_repartir(p_mesa uuid, p_mazo smallint[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  a record;
  v_ids int[] := '{}';
  v_apuestas numeric[] := '{}';
  v_k int;
  v_i int;
  v_mazo smallint[];
  v_pos int;
  v_cru smallint[];
  v_jug smallint[];
  v_id uuid;
  v_modo text;
  v_ap numeric;
  v_saldo numeric;
  v_mov bigint;
  v_dado int;
  v_evento text;
  v_afectado int;
  figura int;
  min_a numeric := (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric;
  vj record;
  vc record;
  v_res text;
  v_razon text;
  v_pozo int;
  v_hay boolean;
  n_apost int;
  v_f int;
  v_duelo boolean;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  if m.fase <> 'apuestas' then return; end if;
  v_duelo := m.modo = 'duelo';
  figura := case m.regla when 'maldicion' then 11 else 10 end;

  -- Quién juega: los listos con apuesta. Si no les alcanzan los tokens (los gastaron en otro sitio) se quedan sin jugar esta ronda.
  for a in select * from veintiuna_asientos where mesa = m.id and listo and apuesta is not null order by asiento loop
    if a.apuesta > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = a.user_id for update;      -- la fila queda bloqueada hasta el final: el saldo no puede cambiar entre comprobar y cobrar
      if coalesce(v_saldo, 0) < a.apuesta then
        update veintiuna_asientos set listo = false, apuesta = null, aviso = 'No te alcanzaban los tokens para tu apuesta: te quedas sin jugar esta ronda.' where mesa = m.id and asiento = a.asiento;
        perform veintiuna_i_pozo_soltar(m.ronda_id, a.user_id);
        continue;
      end if;
    end if;
    v_ids := v_ids || a.asiento;
    v_apuestas := v_apuestas || a.apuesta;
  end loop;
  v_k := coalesce(array_length(v_ids, 1), 0);
  if v_k = 0 then
    update veintiuna_mesas set fase_limite = null where id = m.id;
    perform veintiuna_i_amigos_tocar(m.id);
    return;
  end if;
  -- Todos contra todos: el bote solo existe si apuestan tokens al menos dos jugadores; si no, esta ronda se juega sin apostar
  if v_duelo then
    select count(*) filter (where x > 0) into n_apost from unnest(v_apuestas) x;
    if n_apost < 2 then
      update veintiuna_asientos set aviso = 'En «todos contra todos» tienen que apostar tokens al menos dos jugadores: esta ronda se juega sin apostar.'
        where mesa = m.id and asiento = any (v_ids) and apuesta > 0;
      v_apuestas := array_fill(0::numeric, array[v_k]);
    end if;
  end if;
  -- El pozo de cartas solo vale si pusieron carta al menos dos de los que juegan
  select count(*) into v_pozo from veintiuna_pozo_cartas c where c.ronda_id = m.ronda_id
    and exists (select 1 from veintiuna_asientos s where s.mesa = m.id and s.user_id = c.user_id and s.asiento = any (v_ids));
  if v_pozo < 2 then
    update veintiuna_asientos set aviso = 'Nadie más puso carta en el pozo: tu carta vuelve a tu colección.' where mesa = m.id and carta is not null;
    perform veintiuna_i_pozo_soltar(m.ronda_id);
  else
    insert into veintiuna_pozos (ronda_id, mesa, ronda) values (m.ronda_id, m.id, m.ronda) on conflict do nothing;
    -- las cartas de quienes no juegan esta ronda se sueltan
    for a in select c.user_id from veintiuna_pozo_cartas c where c.ronda_id = m.ronda_id
             and not exists (select 1 from veintiuna_asientos s where s.mesa = m.id and s.user_id = c.user_id and s.asiento = any (v_ids)) loop
      perform veintiuna_i_pozo_soltar(m.ronda_id, a.user_id);
    end loop;
  end if;

  -- Reparto: una carta a cada jugador (por orden de asiento), la visible del crupier, la segunda de cada jugador y la oculta
  v_mazo := coalesce(p_mazo, veintiuna_i_mazo_doble());
  if v_duelo then
    -- Sin crupier: dos cartas a cada jugador y nada más. El Bufón: 1-3 nada; 4-6 cambia la primera carta de un jugador al azar.
    v_cru := '{}'::smallint[];
    v_pos := 2 * v_k;
    if m.regla = 'bufon' then
      v_dado := veintiuna_i_azar(6);
      v_evento := case when v_dado < 3 then 'nada' else 'jugador' end;
      if v_evento = 'jugador' then v_afectado := v_ids[1 + veintiuna_i_azar(v_k)]; end if;
    end if;
  else
  v_cru := array[v_mazo[1 + v_k], v_mazo[2 * v_k + 2]];
  v_pos := 2 * v_k + 2;
  if m.regla = 'bufon' then
    -- Pacto del Bufón: un dado para toda la mesa. 1-2 nada; 3-4 cambia la carta visible del crupier por la siguiente; 5-6 cambia la primera carta de un jugador al azar.
    v_dado := veintiuna_i_azar(6);
    v_evento := case when v_dado < 2 then 'nada' when v_dado < 4 then 'crupier' else 'jugador' end;
    if v_evento = 'crupier' then v_cru[1] := v_mazo[v_pos + 1]; v_pos := v_pos + 1;
    elsif v_evento = 'jugador' then v_afectado := v_ids[1 + veintiuna_i_azar(v_k)]; end if;
  end if;
  end if;
  -- Quién juega primero: en «todos contra todos» rota cada ronda (el último en jugar ve lo que han hecho los demás)
  v_f := ((m.ronda - 1) % v_k) + 1;
  update veintiuna_mesas set mazo = v_mazo, pos = v_pos, crupier = v_cru, bufon_evento = v_evento, bufon_asiento = v_afectado where id = m.id;
  select * into vc from veintiuna_i_valor(v_cru, '{}'::int[], figura);

  for v_i in 1..v_k loop
    select * into a from veintiuna_asientos where mesa = m.id and asiento = v_ids[v_i];
    v_jug := case when v_duelo then array[v_mazo[v_i], v_mazo[v_k + v_i]] else array[v_mazo[v_i], v_mazo[v_k + 1 + v_i]] end;
    if v_evento = 'jugador' and v_ids[v_i] = v_afectado then
      v_jug[1] := v_mazo[v_pos + 1]; v_pos := v_pos + 1;
      update veintiuna_mesas set pos = v_pos where id = m.id;
    end if;
    v_id := gen_random_uuid();
    v_ap := v_apuestas[v_i];
    v_modo := case when v_ap > 0 then 'apuesta' else 'practica' end;
    v_mov := null;
    if v_modo = 'apuesta' then
      select saldo into v_saldo from hipodromo_billeteras where usuario = a.user_id for update;
      update hipodromo_billeteras set saldo = saldo - v_ap where usuario = a.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (a.user_id, null, 'Veintiuna Velas: apuesta (mano ' || v_id || ')', -v_ap, v_saldo) returning id into v_mov;
    end if;
    insert into veintiuna_partidas (id, user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier, mov_cobro, bufon_evento, mesa, asiento, ronda_id, duelo, orden)
      values (v_id, a.user_id, gen_random_uuid(), v_modo, case when v_modo = 'apuesta' then v_ap else min_a end, m.regla, v_mazo, v_pos, v_jug, v_cru, v_mov,
              case when m.regla <> 'bufon' then null when v_evento = 'crupier' then 'crupier' when v_evento = 'jugador' and v_ids[v_i] = v_afectado then 'jugador' else 'nada' end,
              m.id, a.asiento, m.ronda_id, v_duelo, case when v_duelo then (v_i - v_f + v_k) % v_k else v_i - 1 end);
    update veintiuna_asientos set partida = v_id where mesa = m.id and asiento = a.asiento;
    -- Orden de resolución al repartir (igual que en la mesa individual)
    select * into vj from veintiuna_i_valor(v_jug, '{}'::int[], figura);
    v_res := null;
    if v_duelo then
      -- Sin crupier nada se paga al repartir: dos figuras con la Maldición se pasan y un natural se planta solo
      if vj.total > 21 then update veintiuna_partidas set fase = 'pasada' where id = v_id;
      elsif vj.total = 21 then update veintiuna_partidas set fase = 'plantada' where id = v_id;
      end if;
    elsif vj.total > 21 then v_res := 'derrota'; v_razon := 'pasado_al_repartir';
    elsif vj.total = 21 and vc.total = 21 then v_res := 'empate'; v_razon := 'ambos_natural';
    elsif vj.total = 21 then v_res := 'natural'; v_razon := 'natural';
    elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_pasado_al_repartir';
    end if;
    if v_res is not null then perform veintiuna_i_liquidar(v_id, v_res, v_razon); end if;
  end loop;

  update veintiuna_mesas set fase = 'jugando', fase_limite = null, turno = null where id = m.id;
  perform veintiuna_i_amigos_sincronizar(m.id);
  perform veintiuna_i_amigos_turno(m.id);
end;
$$;

create or replace function veintiuna_i_amigos_cerrar_ronda(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  r record;
  figura int;
  limite int;
  vc record;
  vj record;
  cru smallint[];
  rep int;
  v_res text;
  v_razon text;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  figura := case m.regla when 'maldicion' then 11 else 10 end;
  limite := case m.regla when 'vela' then 16 else 17 end;
  if m.modo = 'duelo' then
    perform veintiuna_i_amigos_resolver_duelo(m.id);
  elsif exists (select 1 from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso') then
    select o_crupier, o_repartidas into cru, rep from veintiuna_i_turno_crupier(m.mazo, m.pos, m.crupier, figura, false, limite);
    update veintiuna_mesas set crupier = cru, pos = rep where id = m.id;
    m.crupier := cru;
    select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
    for r in select * from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso' order by asiento loop
      update veintiuna_partidas set crupier = cru where id = r.id;
      select * into vj from veintiuna_i_valor(r.jugador, r.jugador_as1, figura);
      if vc.total = 21 and array_length(cru, 1) = 2 and not (array_length(r.jugador, 1) = 2 and vj.total = 21) then v_res := 'derrota'; v_razon := 'natural_crupier';      -- el natural de la crupier gana a cualquier 21 que no lo sea
      elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_se_pasa';
      elsif vj.total > vc.total then v_res := 'victoria'; v_razon := 'mayor';
      elsif vj.total < vc.total then v_res := 'derrota'; v_razon := 'menor';
      else v_res := 'empate'; v_razon := 'igual';
      end if;
      perform veintiuna_i_liquidar(r.id, v_res, v_razon);
    end loop;
  end if;
  update veintiuna_partidas set crupier = m.crupier where mesa = m.id and ronda_id = m.ronda_id;
  perform veintiuna_i_pozo_resolver(m.id);
  update veintiuna_mesas set fase = 'resultado', turno = null,
    fase_limite = now() + make_interval(secs => (cartas_ajuste('veintiuna_mesa_resultado_s', '10'))::text::numeric)
    where id = m.id;
  perform veintiuna_i_amigos_tocar(m.id);
end;
$$;
