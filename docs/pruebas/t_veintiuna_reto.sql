-- Pruebas de La Última Vela (docs/veintiuna-reto.sql). Las lanza docs/pruebas/t_veintiuna.sh después de t_veintiuna.sql (usa sus ayudas t_check, t_c, t_mazo, t_saldo).
-- Todo con barajas escritas carta por carta, en este orden de reparto: jugador, Cera (la visible), jugador, Cera (la segunda), y las que se roben después.

create or replace function t_sesion(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true); end $$;

create or replace function t_r_limpiar() returns void language plpgsql as $$
begin
  delete from veintiuna_reto_manos; delete from veintiuna_retos; delete from muerte_subita_intentos;
end $$;
-- Un intento de Muerte Súbita nuevo para ese jugador (cada uno con su personaje, porque el índice único solo deja un intento vivo por personaje y desafío)
create or replace function t_r_intento(p_uid uuid, p_desafio text default 'cera-veintiuna') returns uuid language sql as $$
  insert into muerte_subita_intentos (user_id, username, personaje_id, personaje_nombre, desafio)
  values (p_uid, 'prueba', 'pj-' || gen_random_uuid(), 'Personaje de prueba', p_desafio) returning id $$;
-- Reparte la siguiente mano con la baraja escrita (como la función pública, pero con baraja dada)
create or replace function t_r_reparte(p_uid uuid, p_intento uuid, variadic p_cartas text[]) returns jsonb language plpgsql as $$
declare v_manos int;
begin
  v_manos := coalesce((select manos from veintiuna_retos where intento = p_intento), 0);
  return veintiuna_i_reto_repartir(p_uid, p_intento, v_manos, t_mazo(variadic p_cartas));
end $$;
-- Una acción como ese jugador, con el paso que ve su pantalla
create or replace function t_r_act(p_uid uuid, p_intento uuid, p_accion text) returns jsonb language plpgsql as $$
declare v_paso int;
begin
  v_paso := coalesce((select paso from veintiuna_reto_manos where intento = p_intento and estado = 'en_curso'), 0);
  perform t_sesion(p_uid);
  return veintiuna_reto_accion(p_intento, v_paso, p_accion);
end $$;
-- Ejecuta una instrucción y devuelve el error (mensaje y pista) o «sin error»
create or replace function t_r_error(p_sql text) returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql; return 'sin error';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return sqlerrm || ' | ' || coalesce(v_hint, '');
end $$;
-- Juega UNA mano entera en el servidor con la baraja dada y una estrategia («novato» pide hasta 17; «basico» es la estrategia básica de la simulación)
-- y dice si el resultado coincide con el que calculó la simulación (tools/veintiuna-ultima-vela.js)
create or replace function t_r_comparar(p_mazo smallint[], p_politica text, p_esperado text) returns boolean language plpgsql as $$
declare
  u uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; h veintiuna_reto_manos%rowtype; vj record; up int; pide boolean; v_res text; v_paso int;
begin
  i := t_r_intento(u);
  perform veintiuna_i_reto_repartir(u, i, 0, p_mazo);
  perform t_sesion(u);
  loop
    select * into h from veintiuna_reto_manos where intento = i and estado = 'en_curso';
    exit when not found;
    select * into vj from veintiuna_i_valor(h.jugador, '{}'::int[], 10);
    up := case when (h.cera[1] % 13) + 1 = 1 then 11 else least((h.cera[1] % 13) + 1, 10) end;
    if p_politica = 'novato' then pide := vj.total < 17;
    else pide := not (case when vj.blando then vj.total >= (case when up >= 9 then 19 else 18 end) else vj.total >= (case when up >= 7 then 17 else 12 end) end);
    end if;
    perform veintiuna_reto_accion(i, h.paso, case when pide then 'pedir' else 'plantar' end);
  end loop;
  select resultado into v_res from veintiuna_reto_manos where intento = i;
  delete from muerte_subita_intentos where id = i;
  return v_res = p_esperado;
end $$;

/* ======================================================================== las dos reglas de Cera: El testigo y Cera exigente */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; s jsonb;
begin
  perform t_r_limpiar();
  -- Cera sube hasta 18 (en la mesa normal se planta con 17)
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, '10p', '6d', '7c', '5t', '3p', '4p');
  perform t_check('El testigo: Cera enseña sus dos cartas desde que se reparte', jsonb_array_length(s #> '{mano,cera,cartas}') = 2 and s #>> '{mano,fase}' = 'jugador' and s #>> '{mano,cera,total}' = '11');
  perform t_check('La mano se reparte sin resolver (17 contra 11) y la baraja no viaja en la respuesta', s #>> '{mano,jugador,total}' = '17' and s::text not like '%mazo%');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Cera pide hasta llegar a 18: 11, 14, 18 (cuatro cartas) y gana al 17 del jugador', s #>> '{mano,cera,total}' = '18' and jsonb_array_length(s #> '{mano,cera,cartas}') = 4
                  and s #>> '{mano,resultado}' = 'derrota' and s #>> '{mano,razon}' = 'cera_mejor');
  -- con 17 duro pide
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', '10d', '9c', '7t', '3p');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Con 17 Cera sigue pidiendo (el 3 la deja en 20) y el 19 del jugador pierde', jsonb_array_length(s #> '{mano,cera,cartas}') = 3 and s #>> '{mano,cera,total}' = '20' and s #>> '{mano,resultado}' = 'derrota');
  -- con 18 se planta
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', '10d', '9c', '8t', '3p');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Con 18 Cera se planta (dos cartas) y el 19 del jugador gana', jsonb_array_length(s #> '{mano,cera,cartas}') = 2 and s #>> '{mano,resultado}' = 'victoria' and s #>> '{mano,razon}' = 'mejor_mano');
  -- 18 blando también cuenta como 18
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', 'Ad', '9c', '7t', '3p');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Con 18 blando (as + 7) Cera se planta', jsonb_array_length(s #> '{mano,cera,cartas}') = 2 and s #>> '{mano,cera,total}' = '18' and s #>> '{mano,resultado}' = 'victoria');
  -- 17 blando pide
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', 'Ad', '9c', '6t', '4p');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Con 17 blando (as + 6) Cera pide: el 4 la deja en 21 y gana al 19', s #>> '{mano,cera,total}' = '21' and jsonb_array_length(s #> '{mano,cera,cartas}') = 3 and s #>> '{mano,resultado}' = 'derrota');
  -- Cera se pasa
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', '10d', '8c', '6t', 'Kp');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Si Cera se pasa (16 + rey = 26) gana el jugador', s #>> '{mano,cera,total}' = '26' and s #>> '{mano,resultado}' = 'victoria' and s #>> '{mano,razon}' = 'cera_se_pasa');
  -- empate a 18: ya no se mueve
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', '10d', '8c', '8t', '3p');
  s := t_r_act(u1, i, 'plantar');
  perform t_check('18 contra 18 es empate', s #>> '{mano,resultado}' = 'empate' and s #>> '{mano,razon}' = 'mismo_total');
end $$;

/* ======================================================================== el reparto y lo que hace el jugador */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; s jsonb;
begin
  perform t_r_limpiar();
  -- naturales al repartir
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, 'Ap', '9d', 'Kc', '8t');
  perform t_check('Un 21 al repartir gana la mano en el acto', s #>> '{mano,fase}' = 'terminada' and s #>> '{mano,resultado}' = 'victoria' and s #>> '{mano,razon}' = 'natural' and (s ->> 'ganadas')::int = 1);
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, 'Ap', 'Ad', 'Kc', 'Kt');
  perform t_check('Si los dos tienen 21 es empate, y el empate cuenta como tal (se repetirá)', s #>> '{mano,resultado}' = 'empate' and s #>> '{mano,razon}' = 'ambos_natural' and (s ->> 'empates_seguidos')::int = 1 and (s ->> 'ganadas')::int = 0 and (s ->> 'perdidas')::int = 0);
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, '10p', 'Ad', '9c', 'Kt');
  perform t_check('Si solo Cera tiene 21 al repartir, pierdes la mano sin poder hacer nada', s #>> '{mano,resultado}' = 'derrota' and s #>> '{mano,razon}' = 'natural_cera' and (s ->> 'perdidas')::int = 1);
  -- te pasas
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '10p', '9d', '6c', '8t', 'Kp');
  s := t_r_act(u1, i, 'pedir');
  perform t_check('Pasarte de 21 pierde la mano sin que Cera robe', s #>> '{mano,resultado}' = 'derrota' and s #>> '{mano,razon}' = 'te_pasas' and jsonb_array_length(s #> '{mano,cera,cartas}') = 2 and s #>> '{mano,jugador,total}' = '26');
  -- 21 pidiendo: se planta solo
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '5p', '10d', '6c', '7t', 'Qp', '2c');
  s := t_r_act(u1, i, 'pedir');
  perform t_check('Con 21 al pedir no se puede pedir más: te plantas solo y Cera juega (7 + 10 = 17, pide un 2 y se queda en 19)', s #>> '{mano,jugador,total}' = '21' and s #>> '{mano,fase}' = 'terminada' and s #>> '{mano,cera,total}' = '19' and s #>> '{mano,resultado}' = 'victoria');
  -- pedir sin pasarte deja la mano abierta y sube el paso
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '5p', '10d', '4c', '7t', '2p', 'Kc');
  s := t_r_act(u1, i, 'pedir');
  perform t_check('Pedir sin pasarte deja la mano abierta con la carta nueva (5 + 4 + 2 = 11) y Cera sin tocar', s #>> '{mano,fase}' = 'jugador' and s #>> '{mano,jugador,total}' = '11' and (s #>> '{mano,paso}')::int = 1 and jsonb_array_length(s #> '{mano,cera,cartas}') = 2);
end $$;

/* ======================================================================== el reto: 3 de 5, los empates repiten */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; s jsonb; k int;
  gana text[] := array['Ap', '9d', 'Kc', '8t'];                            -- natural del jugador
  pierde text[] := array['10p', 'Ad', '9c', 'Kt'];                          -- natural de Cera
  empata text[] := array['10p', '10d', '8c', '8t', '3p'];                   -- 18 contra 18
begin
  perform t_r_limpiar();
  perform t_sesion(u1);
  i := t_r_intento(u1);
  s := veintiuna_reto_estado(i);
  perform t_check('Sin repartir nada: estado vacío, a la primera mano, listo para repartir', s ->> 'estado' = 'en_curso' and s -> 'mano' = 'null'::jsonb and (s ->> 'repartidas')::int = 0 and (s ->> 'numero')::int = 1
                  and (s #>> '{meta,ganar}')::int = 3 and (s #>> '{meta,manos}')::int = 5 and (s #>> '{meta,empates}')::int = 2 and (s #>> '{meta,cera}')::int = 18);
  -- tres empates seguidos: el tercero es derrota
  s := t_r_reparte(u1, i, variadic empata); s := t_r_act(u1, i, 'plantar');
  perform t_check('Primer empate: la mano se repite (0 a 0, sigue siendo la mano 1)', (s ->> 'empates_seguidos')::int = 1 and (s ->> 'numero')::int = 1 and (s ->> 'perdidas')::int = 0);
  s := t_r_reparte(u1, i, variadic empata);
  perform t_check('La mano repetida se marca como repetición 1 de la misma mano', (s #>> '{mano,repeticion}')::int = 1 and (s #>> '{mano,numero}')::int = 1);
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Segundo empate seguido: se repite otra vez', (s ->> 'empates_seguidos')::int = 2 and (s ->> 'perdidas')::int = 0);
  s := t_r_reparte(u1, i, variadic empata); s := t_r_act(u1, i, 'plantar');
  perform t_check('Tercer empate seguido: cuenta como derrota de esa mano (aunque el resultado de la mano sea empate)', s #>> '{mano,resultado}' = 'empate' and s #>> '{mano,cuenta}' = 'derrota' and (s ->> 'perdidas')::int = 1 and (s ->> 'empates_seguidos')::int = 0 and (s ->> 'numero')::int = 2);
  perform t_check('Se han repartido tres manos y el historial las recuerda', (s ->> 'repartidas')::int = 3 and jsonb_array_length(s -> 'historial') = 3);
  s := t_r_reparte(u1, i, variadic empata); s := t_r_act(u1, i, 'plantar');
  perform t_check('Tras un empate, el contador de empates de la mano siguiente empieza de cero (nuevo empate = 1 de nuevo)', (s ->> 'empates_seguidos')::int = 1 and (s #>> '{mano,repeticion}')::int = 0 and (s #>> '{mano,numero}')::int = 2);
  -- una victoria entre empates reinicia la cuenta
  s := t_r_reparte(u1, i, variadic gana);
  perform t_check('Una victoria pone a cero los empates seguidos', (s ->> 'ganadas')::int = 1 and (s ->> 'empates_seguidos')::int = 0 and (s ->> 'numero')::int = 3);

  -- 3 victorias = reto ganado
  perform t_r_limpiar();
  i := t_r_intento(u1);
  for k in 1..3 loop s := t_r_reparte(u1, i, variadic gana); end loop;
  perform t_check('Con 3 victorias el reto se gana en el acto (sin jugar las 5)', s ->> 'estado' = 'ganado' and (s ->> 'ganadas')::int = 3 and (s ->> 'repartidas')::int = 3);
  perform t_check('El intento de Muerte Súbita se cierra solo como «ganado» con 3 a 0, sin veredicto (lo pone el DM)', (select estado = 'ganado' and puntaje = 3 and puntaje_rival = 0 and veredicto is null and cerrado_en is not null from muerte_subita_intentos where id = i));
  s := t_r_reparte(u1, i, variadic gana);
  perform t_check('Con el reto cerrado no se reparte otra mano', (s ->> 'repartidas')::int = 3 and (select count(*) from veintiuna_reto_manos where intento = i) = 3);
  -- 3 derrotas = reto perdido
  i := t_r_intento(u1);
  for k in 1..3 loop s := t_r_reparte(u1, i, variadic pierde); end loop;
  perform t_check('Con 3 derrotas el reto se pierde y el intento queda «perdido» con 0 a 3', s ->> 'estado' = 'perdido' and (select estado = 'perdido' and puntaje = 0 and puntaje_rival = 3 and veredicto is null from muerte_subita_intentos where id = i));
  -- ganar, perder, ganar, perder, ganar: en la quinta mano
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, variadic gana); s := t_r_reparte(u1, i, variadic pierde); s := t_r_reparte(u1, i, variadic gana); s := t_r_reparte(u1, i, variadic pierde);
  perform t_check('2 a 2 tras cuatro manos: el reto sigue y toca la quinta', s ->> 'estado' = 'en_curso' and (s ->> 'numero')::int = 5);
  s := t_r_reparte(u1, i, variadic gana);
  perform t_check('La quinta mano decide: 3 a 2, ganado', s ->> 'estado' = 'ganado' and (select puntaje = 3 and puntaje_rival = 2 from muerte_subita_intentos where id = i));
  -- perder, perder, ganar, ganar, perder: 2 a 3, perdido en la quinta
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, variadic pierde); s := t_r_reparte(u1, i, variadic pierde); s := t_r_reparte(u1, i, variadic gana); s := t_r_reparte(u1, i, variadic gana);
  s := t_r_reparte(u1, i, variadic pierde);
  perform t_check('2 a 3: perdido', s ->> 'estado' = 'perdido' and (select puntaje = 2 and puntaje_rival = 3 from muerte_subita_intentos where id = i));
  -- el DM sigue decidiendo: un veredicto no reabre el reto
  update muerte_subita_intentos set veredicto = 'confirmado' where id = i;
  s := t_r_reparte(u1, i, variadic gana);
  perform t_check('Con veredicto del DM tampoco se reparte nada más', (s ->> 'repartidas')::int = 5 and (select count(*) from veintiuna_reto_manos where intento = i) = 5);
end $$;

/* ======================================================================== repetir, recargar y desconectarse */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; s jsonb; s2 jsonb; v_cartas jsonb;
begin
  perform t_r_limpiar();
  perform t_sesion(u1);
  i := t_r_intento(u1);
  s := t_r_reparte(u1, i, '5p', '10d', '4c', '7t', '2p', 'Kc', '3d');
  perform t_check('Repartir otra vez con una mano abierta no reparte otra (devuelve la misma)', (veintiuna_i_reto_repartir(u1, i, 1, t_mazo('Kp', 'Qp', 'Jp', '10p')) #>> '{mano,jugador,total}')::int = 9 and (select manos from veintiuna_retos where intento = i) = 1);
  perform t_check('Repartir con un contador viejo tampoco reparta (un clic repetido no gasta una mano)', (veintiuna_i_reto_repartir(u1, i, 0, t_mazo('Kp', 'Qp', 'Jp', '10p')) #>> '{mano,jugador,total}')::int = 9 and (select count(*) from veintiuna_reto_manos where intento = i) = 1);
  s := t_r_act(u1, i, 'pedir');
  perform t_check('Pedir: 5 + 4 + 2 = 11, paso 1', s #>> '{mano,jugador,total}' = '11' and (s #>> '{mano,paso}')::int = 1);
  perform t_sesion(u1);
  s2 := veintiuna_reto_accion(i, 0, 'pedir');
  perform t_check('Repetir la acción con el paso viejo no pide otra carta: devuelve el estado y lo marca repetido', s2 #>> '{mano,jugador,total}' = '11' and (s2 ->> 'repetida')::boolean and (select array_length(jugador, 1) from veintiuna_reto_manos where intento = i) = 3);
  perform t_check('Un paso del futuro se rechaza con su pista', t_r_error('select veintiuna_reto_accion(''' || i || ''', 7, ''pedir'')') like '%| paso_futuro');
  perform t_check('Una acción que no existe (doblar) se rechaza', t_r_error('select veintiuna_reto_accion(''' || i || ''', 1, ''doblar'')') like '%| accion_invalida');
  perform t_check('Dividir tampoco existe', t_r_error('select veintiuna_reto_accion(''' || i || ''', 1, ''dividir'')') like '%| accion_invalida');
  -- recargar la página o reconectarse: el estado vuelve completo
  s := veintiuna_reto_estado(i);
  perform t_check('Al recargar se recupera la mano en curso con las mismas cartas y el mismo paso', s #>> '{mano,fase}' = 'jugador' and s #>> '{mano,jugador,total}' = '11' and (s #>> '{mano,paso}')::int = 1 and (s ->> 'repartidas')::int = 1);
  v_cartas := s #> '{mano,jugador,cartas}';
  perform t_check('...y no se puede pedir una mano nueva para cambiar la suerte', (veintiuna_reto_estado(i) #> '{mano,jugador,cartas}') = v_cartas);
  s := t_r_act(u1, i, 'plantar');
  perform t_check('Cera juega con la baraja que ya estaba (7 + 10 = 17, pide el siguiente de la baraja)', jsonb_array_length(s #> '{mano,cera,cartas}') >= 3 and s #>> '{mano,fase}' = 'terminada');
  s2 := veintiuna_reto_accion(i, 2, 'pedir');
  perform t_check('Actuar sobre una mano terminada no hace nada', s2 #>> '{mano,fase}' = 'terminada' and (s2 ->> 'repetida')::boolean);
end $$;

/* ======================================================================== de quién es cada intento */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002';
  i uuid; iv uuid; ia uuid; ic uuid; s jsonb;
begin
  perform t_r_limpiar();
  i := t_r_intento(u1);
  perform t_r_reparte(u1, i, '5p', '10d', '4c', '7t', '2p');
  perform t_sesion(u2);
  perform t_check('Otro jugador no puede ver mi reto', t_r_error('select veintiuna_reto_estado(''' || i || ''')') like '%No encuentro ese desafío%| no_encontrado');
  perform t_check('...ni repartir en él', t_r_error('select veintiuna_reto_repartir(''' || i || ''', 1)') like '%| no_encontrado');
  perform t_check('...ni jugar mi mano', t_r_error('select veintiuna_reto_accion(''' || i || ''', 0, ''plantar'')') like '%| no_encontrado');
  perform t_check('Un intento que no existe da el mismo error', t_r_error('select veintiuna_reto_estado(gen_random_uuid())') like '%| no_encontrado');
  iv := t_r_intento(u1, 'verdam-arqueria');
  perform t_sesion(u1);
  perform t_check('El intento de otro desafío (Verdam) no sirve para este reto', t_r_error('select veintiuna_reto_repartir(''' || iv || ''', 0)') like '%| no_encontrado');
  ia := t_r_intento(u1);
  update muerte_subita_intentos set veredicto = 'anulado' where id = ia;
  perform t_check('Un intento anulado por el DM no se juega', t_r_error('select veintiuna_reto_repartir(''' || ia || ''', 0)') like '%| anulado');
  ic := t_r_intento(u1);
  perform t_check('Jugar una acción antes de repartir la primera mano da un error claro', t_r_error('select veintiuna_reto_accion(''' || ic || ''', 0, ''pedir'')') like '%| sin_mano');
  -- sin sesión
  perform set_config('request.jwt.claims', '', true);
  perform t_check('Sin sesión no se puede nada', t_r_error('select veintiuna_reto_repartir(''' || ic || ''', 0)') like '%| sin_sesion');
  -- ms_finalizar (el cierre con puntajes que manda el navegador) no cierra este desafío
  perform t_sesion(u1);
  perform t_check('ms_finalizar se niega a cerrar el desafío de Cera aunque mande 3000 a 0', t_r_error('select ms_finalizar(''' || i || ''', 3000, 0)') like '%lo cierra el servidor%');
  perform t_check('...y el intento sigue en curso', (select estado = 'en_curso' and puntaje is null from muerte_subita_intentos where id = i));
  perform t_check('ms_finalizar sigue cerrando los demás desafíos (Verdam: 5 a 3 = ganado)', (select ms_finalizar(iv, 5, 3)) = 'ganado');
end $$;

/* ======================================================================== no toca tokens, cartas ni estadísticas */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001';
  i uuid; s jsonb; k int; antes text; despues text;
begin
  perform t_r_limpiar();
  perform t_reset();
  perform t_saldo(u1, 300);
  antes := (select concat_ws('|', (select saldo from hipodromo_billeteras where usuario = u1), (select count(*) from hipodromo_movimientos), (select count(*) from veintiuna_estadisticas), (select count(*) from veintiuna_partidas),
                            (select count(*) from veintiuna_logros), (select count(*) from cartas_ejemplares), (select count(*) from cartas_movimientos)));
  i := t_r_intento(u1);
  for k in 1..5 loop
    s := t_r_reparte(u1, i, '10p', '6d', '7c', '5t', '3p', '4p');
    if s #>> '{mano,fase}' = 'jugador' then s := t_r_act(u1, i, 'plantar'); end if;
  end loop;
  despues := (select concat_ws('|', (select saldo from hipodromo_billeteras where usuario = u1), (select count(*) from hipodromo_movimientos), (select count(*) from veintiuna_estadisticas), (select count(*) from veintiuna_partidas),
                              (select count(*) from veintiuna_logros), (select count(*) from cartas_ejemplares), (select count(*) from cartas_movimientos)));
  perform t_check('Un reto entero (perdido) no mueve tokens, no toca estadísticas ni logros de la mesa y no mueve cartas', antes = despues);
  perform t_check('Y el reto quedó cerrado en el intento', (select estado = 'perdido' from muerte_subita_intentos where id = i));
end $$;

select t_r_limpiar();
select t_reset();
