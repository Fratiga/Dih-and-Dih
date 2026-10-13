-- ECONOMÍA DE CARTAS, parte 11: la etiqueta «En circulación».
-- BORRADOR SIN APLICAR. Se prueba en el entorno local (docs/pruebas). Corre DESPUÉS de economia_7, 8 y 9. Se puede correr más de una vez.
--
-- Una carta que no está en circulación no puede entrar al juego por ninguna vía automática: ni como recompensa de un minijuego,
-- ni como salida de la forja, ni al repartir la reserva, ni en el escaparate del mercader. Así una carta a medio hacer no se
-- cuela en las recompensas aunque esté publicada y marcada como ganable.
--   * Solo el admin la pone o la quita (Admin > Economía de cartas, columna «En circulación», también por lotes). Los editores no.
--   * Una carta nueva nace FUERA de circulación. Las que ya existen quedan fuera hasta que las marques.
--   * El admin sí puede regalar a mano una carta que no está en circulación (para probarla); eso no la pone en circulación.
--   * Quitar una carta de circulación no quita copias a nadie: lo que ya tienen los jugadores se queda, se puede intercambiar
--     y usar en mazos. Solo deja de salir de las vías automáticas.
-- Relación con las otras etiquetas: «publicada» = la ven los jugadores; «obtenible» = se puede ganar por recompensas;
-- «en circulación» = el admin la da por lista para entrar en la economía. Para salir por recompensa hacen falta las tres.

alter table cartas_catalogo add column if not exists en_circulacion boolean not null default false;

-- 1) El punto de entrada de toda copia nueva: nada que no esté en circulación se emite por una vía automática.
--    p_sin_limite solo lo usa el admin al regalar a mano; ese es el único camino que se salta la etiqueta.
create or replace function cartas_i_emitir(p_user uuid, p_carta text, p_motivo text, p_referencia text default '',
                                           p_por uuid default null, p_sin_limite boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  select * into ej from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva' order by numero limit 1 for update;
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
$$;
revoke all on function cartas_i_emitir(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;

-- 2) Los candidatos de las vías automáticas: se añade el filtro a las consultas que eligen carta.
--    Se hace sobre la definición que hay desplegada para no copiar funciones largas; si no encuentra el filtro, aborta.
do $$
declare
  r record;
  def text;
  nuevo text;
begin
  for r in select * from (values
    ('cartas_i_juego_terminar_nucleo', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_i_forjar_nucleo', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_disponibilidad', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_i_mercader_rotar', 'and c.publicada', 'and c.publicada and c.en_circulacion')
  ) as v(funcion, buscar, poner) loop
    select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.funcion;
    if def is null then raise exception 'No existe la función %', r.funcion; end if;
    if position('c.en_circulacion' in def) > 0 then continue; end if;   -- ya estaba aplicado
    nuevo := replace(def, r.buscar, r.poner);
    if nuevo = def then raise exception 'No se encontró el filtro de candidatas en %', r.funcion; end if;
    execute nuevo;
  end loop;
end;
$$;

-- 3) Admin: ver y cambiar la etiqueta (junto a los límites)
create or replace function cartas_admin_limites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'nombre', coalesce(d.data ->> 'nombre', c.id),
      'tipo', c.tipo,
      'rareza', c.rareza,
      'publicada', c.publicada,
      'obtenible', c.obtenible,
      'en_circulacion', c.en_circulacion,
      'limite', c.limite,
      'limite_jugador', c.limite_jugador,
      'limite_jugador_efectivo', cartas_limite_jugador(c.id),
      'copias_max', c.copias_max,
      'emitidas', coalesce(x.emitidas, 0),
      'poseidas', coalesce(x.poseidas, 0),
      'bloqueadas', coalesce(x.bloqueadas, 0),
      'reserva', coalesce(x.reserva, 0),
      'mercader', coalesce(x.mercader, 0),
      'destruidas', coalesce(x.destruidas, 0)
    ) order by c.tipo, c.rareza, coalesce(d.data ->> 'nombre', c.id))
    from cartas_catalogo c
    left join cartas_definiciones d on d.id = c.id
    left join lateral (
      select count(*) as emitidas,
             count(*) filter (where estado = 'poseida') as poseidas,
             count(*) filter (where estado = 'bloqueada') as bloqueadas,
             count(*) filter (where estado = 'en_reserva') as reserva,
             count(*) filter (where estado = 'en_mercader') as mercader,
             count(*) filter (where estado = 'destruida') as destruidas
      from cartas_ejemplares e where e.carta_id = c.id
    ) x on true
  ), '[]'::jsonb);
end;
$$;

-- p_cambios: [{ "id": "kobold", "limite": 20, "limite_jugador": 10, "en_circulacion": true }]. Una clave ausente no se toca.
create or replace function cartas_admin_guardar_limites(p_cambios jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cambio jsonb;
  carta cartas_catalogo%rowtype;
  nuevo int;
  nueva_circ boolean;
  hechos int := 0;
begin
  if uid is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) > 500 then
    raise exception 'Cambios inválidos';
  end if;
  for cambio in select value from jsonb_array_elements(p_cambios) loop
    select * into carta from cartas_catalogo where id = cambio ->> 'id' for update;
    if not found then raise exception 'La carta % no existe', cambio ->> 'id'; end if;

    if cambio ? 'limite' then
      nuevo := case when jsonb_typeof(cambio -> 'limite') = 'null' then null else (cambio ->> 'limite')::int end;
      if nuevo is not null and nuevo not between 1 and 999 then raise exception 'El límite global va de 1 a 999 (%)', carta.id; end if;
      if nuevo is distinct from carta.limite then
        update cartas_catalogo set limite = nuevo where id = carta.id;   -- el trigger impide bajar de lo ya emitido
        update cartas_definiciones set data = jsonb_set(data, '{limite}', coalesce(to_jsonb(nuevo), 'null'::jsonb)), actualizada = now(), actualizada_por = uid
          where id = carta.id;
        insert into cartas_limites_historial (carta_id, campo, antes, despues, por) values (carta.id, 'limite', carta.limite, nuevo, uid);
        hechos := hechos + 1;
      end if;
    end if;

    if cambio ? 'limite_jugador' then
      nuevo := case when jsonb_typeof(cambio -> 'limite_jugador') = 'null' then null else (cambio ->> 'limite_jugador')::int end;
      if nuevo is not null and nuevo not between 1 and 99 then raise exception 'El límite por jugador va de 1 a 99 (%)', carta.id; end if;
      if nuevo is distinct from carta.limite_jugador then
        update cartas_catalogo set limite_jugador = nuevo where id = carta.id;
        insert into cartas_limites_historial (carta_id, campo, antes, despues, por) values (carta.id, 'limite_jugador', carta.limite_jugador, nuevo, uid);
        hechos := hechos + 1;
      end if;
    end if;

    if cambio ? 'en_circulacion' then
      if jsonb_typeof(cambio -> 'en_circulacion') <> 'boolean' then raise exception 'En circulación es sí o no (%)', carta.id; end if;
      nueva_circ := (cambio ->> 'en_circulacion')::boolean;
      if nueva_circ is distinct from carta.en_circulacion then
        update cartas_catalogo set en_circulacion = nueva_circ where id = carta.id;
        insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
        values ('circulacion', carta.id, case when nueva_circ then 'Puesta en circulación' else 'Retirada de circulación' end, now(), uid);
        hechos := hechos + 1;
      end if;
    end if;
  end loop;
  return hechos;
end;
$$;

grant execute on function cartas_admin_limites() to authenticated;
grant execute on function cartas_admin_guardar_limites(jsonb) to authenticated;

-- 4) Regalos a mano: se permiten con cualquier carta, pero quedan registrados. El libro de movimientos y el registro de cartas ya
--    guardaban quién regaló qué y a quién; ahora, si la carta no está en circulación, además queda una incidencia visible en el panel.
create or replace function cartas_regalar(p_usuario uuid, p_carta text, p_nota text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
  total int;
  en_circ boolean;
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'Solo el admin puede regalar cartas';
  end if;
  -- El admin puede dar una carta que todavía no tiene límite global ni está en circulación, pero nunca pasar un límite ya definido
  res := cartas_i_emitir(p_usuario, p_carta, 'regalo del admin: ' || coalesce(p_nota, ''), '', uid, true);
  select count(*) into total from cartas_ejemplares where propietario = p_usuario and carta_id = p_carta and estado in ('poseida', 'bloqueada');
  insert into cartas_registro (user_id, carta_id, origen, detalle, por)
  values (p_usuario, p_carta, 'admin', left(coalesce(p_nota, ''), 200), uid);
  select en_circulacion into en_circ from cartas_catalogo where id = p_carta;
  if not en_circ then
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
    values ('regalo_fuera_de_circulacion', p_carta,
            left(format('Regalo a mano a %s (copia nº %s). La carta no está en circulación. %s',
                        coalesce((select username from perfiles where user_id = p_usuario), p_usuario::text), res ->> 'numero', coalesce(p_nota, '')), 300),
            now(), uid);
  end if;
  return jsonb_build_object('carta', p_carta, 'cantidad', total, 'numero', (res ->> 'numero')::int);
end;
$$;
grant execute on function cartas_regalar(uuid, text, text) to authenticated;

-- 5) Mercader: las ofertas especiales del admin también tienen que ser de cartas en circulación
create or replace function cartas_admin_mercader_agregar(p_carta text, p_valor_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c cartas_catalogo%rowtype;
  ej uuid;
  emitidas int;
begin
  if uid is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into c from cartas_catalogo where id = p_carta;
  if not found then raise exception 'Esa carta no existe'; end if;
  if not c.en_circulacion then raise exception 'Esa carta no está en circulación: ponla en circulación antes de ofrecerla en el mercader'; end if;
  if p_valor_min not between 1 and 40 then raise exception 'El valor va de 1 a 40'; end if;
  perform cartas_i_candado(p_carta);
  select id into ej from cartas_ejemplares where carta_id = p_carta and estado in ('en_reserva', 'en_mercader')
    and not exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = cartas_ejemplares.id and o.estado = 'activa')
    order by (estado = 'en_mercader') desc, numero limit 1;
  if ej is null then
    select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = p_carta;
    if c.limite is not null and emitidas >= c.limite then raise exception 'AGOTADA: ya se emitieron las % copias de esta carta', c.limite; end if;
    insert into cartas_ejemplares (carta_id, numero, propietario, estado) values (p_carta, emitidas + 1, null, 'en_mercader') returning id into ej;
    insert into cartas_movimientos (ejemplar, carta_id, tipo, motivo, por) values (ej, p_carta, 'emision', 'oferta especial del mercader', uid);
  end if;
  insert into cartas_mercader_ofertas (ejemplar, valor_min, especial) values (ej, p_valor_min, true);
end;
$$;
grant execute on function cartas_admin_mercader_agregar(text, int) to authenticated;
