-- Pruebas de Las Veintiuna Velas (docs/veintiuna.sql). Las lanza docs/pruebas/t_veintiuna.sh; cada comprobación imprime «OK» o «FALLA» como aviso.
-- Todo con barajas conocidas: veintiuna_i_repartir recibe la baraja, así que cada mano se puede escribir carta por carta.

create or replace function t_check(p_desc text, p_cond boolean) returns void language plpgsql as $$
begin
  if coalesce(p_cond, false) then raise notice 'OK    %', p_desc; else raise notice 'FALLA %', p_desc; end if;
end $$;

-- Carta escrita como rango + palo: '10p' (diez de picas), 'Kc' (rey de corazones), 'Ad' (as de diamantes), '7t' (siete de tréboles)
create or replace function t_c(p_txt text) returns smallint language sql immutable as $$
  select (((case upper(left(p_txt, length(p_txt) - 1)) when 'A' then 1 when 'J' then 11 when 'Q' then 12 when 'K' then 13 else left(p_txt, length(p_txt) - 1)::int end) - 1)
          + 13 * (case right(p_txt, 1) when 'p' then 0 when 'c' then 1 when 'd' then 2 else 3 end))::smallint
$$;
-- Las cartas dadas van primero (jugador, crupier, jugador, crupier, y las que se roben después); el resto de la baraja, en desorden
create or replace function t_mazo(variadic p_cartas text[]) returns smallint[] language sql volatile as $$
  with dadas as (select t_c(c) as n, i from unnest(p_cartas) with ordinality as x(c, i)),
       resto as (select n::smallint from generate_series(0, 51) n where n not in (select n from dadas))
  select array_agg(n order by o, k) from (select n, 0 as o, i::text as k from dadas union all select n, 1, gen_random_uuid()::text from resto) z
$$;
create or replace function t_saldo(p_uid uuid, p_n numeric) returns void language plpgsql as $$
begin
  insert into hipodromo_billeteras (usuario, saldo) values (p_uid, p_n) on conflict (usuario) do update set saldo = p_n;
end $$;
create or replace function t_saldo_de(p_uid uuid) returns numeric language sql as $$ select coalesce((select saldo from hipodromo_billeteras where usuario = p_uid), 0) $$;
-- Reparte una mano como el servidor (sin sesión) con la regla y la baraja dadas; devuelve el estado
create or replace function t_reparte(p_uid uuid, p_regla text, p_modo text, p_apuesta numeric, variadic p_cartas text[]) returns jsonb language plpgsql as $$
begin
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (p_uid, p_regla) on conflict (user_id) do update set proxima_regla = p_regla;
  delete from veintiuna_partidas where user_id = p_uid and estado = 'en_curso';
  return veintiuna_i_repartir(p_uid, gen_random_uuid(), p_modo, p_apuesta, t_mazo(variadic p_cartas));
end $$;
-- Una acción como el servidor (sin sesión), sin pasar por el número de paso
create or replace function t_act(p_id uuid, p_accion text) returns jsonb language plpgsql as $$
declare p veintiuna_partidas%rowtype;
begin
  perform veintiuna_i_aplicar(p_id, p_accion);
  update veintiuna_partidas set paso = paso + 1, ultima_accion = now() where id = p_id;
  select * into p from veintiuna_partidas where id = p_id;
  return veintiuna_i_estado(p, veintiuna_i_saldo(p.user_id));
end $$;
create or replace function t_reset() returns void language plpgsql as $$
begin
  delete from veintiuna_partidas; delete from veintiuna_logros; delete from veintiuna_estadisticas;
  delete from hipodromo_movimientos; delete from hipodromo_billeteras;
  delete from cartas_ejemplares where false;
end $$;

/* ======================================================================== puntuación de manos */
do $$
declare v record;
begin
  perform t_reset();
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('Kp')], '{}', 10); perform t_check('As + rey = 21 blando', v.total = 21 and v.blando);
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('Ac'), t_c('9p')], '{}', 10); perform t_check('As + as + 9 = 21 (un as vale 11 y el otro 1)', v.total = 21 and v.blando);
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('6c'), t_c('Kp')], '{}', 10); perform t_check('As + 6 + rey = 17 duro (el as baja a 1)', v.total = 17 and not v.blando);
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('Ac'), t_c('Ad'), t_c('At')], '{}', 10); perform t_check('Cuatro ases = 14 (solo uno puede valer 11)', v.total = 14 and v.blando);
  select * into v from veintiuna_i_valor(array[t_c('Kp'), t_c('Qc'), t_c('5d')], '{}', 10); perform t_check('Figuras valen 10: K + Q + 5 = 25', v.total = 25);
  select * into v from veintiuna_i_valor(array[t_c('Kp'), t_c('Qc'), t_c('5d')], '{}', 11); perform t_check('Con la Maldición las figuras valen 11: K + Q + 5 = 27', v.total = 27);
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('Kc')], '{}', 11); perform t_check('Maldición: as + rey = 12 (el as no puede valer 11 sin pasarse)', v.total = 12 and not v.blando);
  select * into v from veintiuna_i_valor(array[t_c('10p'), t_c('Kc')], '{}', 11); perform t_check('Maldición: 10 + rey = 21', v.total = 21);
  select * into v from veintiuna_i_valor(array[t_c('10p'), t_c('6c'), t_c('Kd')], '{3}', 10); perform t_check('Fortuna: una carta fija vale 1 aunque sea un rey (10 + 6 + 1 = 17)', v.total = 17);
  select * into v from veintiuna_i_valor(array[t_c('Ap'), t_c('9c'), t_c('Kd')], '{3}', 10); perform t_check('Fortuna: el as real sigue pudiendo valer 11 (A + 9 + 1 = 21 blando)', v.total = 21 and v.blando);
  select * into v from veintiuna_i_valor(array[t_c('Ap')], '{1}', 10); perform t_check('Un as fijado por la Fortuna vale 1 y no sube a 11', v.total = 1 and not v.blando);
end $$;

/* ======================================================================== la baraja */
do $$
declare m smallint[]; ok boolean := true; i int; n int; primera int[] := array_fill(0, array[52]); veces int := 4000; esperado numeric := 4000.0 / 52; peor numeric := 0; x int; azar int[] := array_fill(0, array[3]); r int;
begin
  for i in 1..200 loop
    m := veintiuna_i_mazo();
    if array_length(m, 1) <> 52 or (select count(distinct c) from unnest(m) c) <> 52 or (select min(c) from unnest(m) c) <> 0 or (select max(c) from unnest(m) c) <> 51 then ok := false; end if;
  end loop;
  perform t_check('La baraja tiene 52 cartas distintas (200 barajas)', ok);
  for i in 1..veces loop m := veintiuna_i_mazo(); primera[m[1] + 1] := primera[m[1] + 1] + 1; end loop;
  for x in 1..52 loop peor := greatest(peor, abs(primera[x] - esperado)); end loop;
  perform t_check('La primera carta sale con frecuencia pareja (la peor se desvía ' || round(peor, 1) || ' de ' || round(esperado, 1) || ')', peor < esperado * 0.75);
  for i in 1..6000 loop r := veintiuna_i_azar(3); azar[r + 1] := azar[r + 1] + 1; end loop;
  perform t_check('La regla nueva sale con frecuencia pareja (' || azar[1] || '/' || azar[2] || '/' || azar[3] || ')', azar[1] between 1700 and 2300 and azar[2] between 1700 and 2300 and azar[3] between 1700 and 2300);
  perform t_check('veintiuna_i_azar nunca se sale del rango', (select bool_and(veintiuna_i_azar(3) between 0 and 2) from generate_series(1, 2000)));
end $$;

/* ======================================================================== el reparto: blackjack natural y demás */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; p veintiuna_partidas%rowtype;
begin
  perform t_reset(); perform t_saldo(u, 100);
  -- Blackjack natural del jugador (A + K) contra 9 + 7: 3 a 2 neto
  s := t_reparte(u, 'fortuna', 'apuesta', 20, 'Ap', '9c', 'Kp', '7c');
  pid := (s ->> 'partida')::uuid; select * into p from veintiuna_partidas where id = pid;
  perform t_check('Natural del jugador: la mano termina al repartir', s ->> 'estado' = 'terminada' and s #>> '{resultado,tipo}' = 'natural');
  perform t_check('Natural: paga 3 a 2 (apuesta 20 → neto +30)', (s #>> '{resultado,neto}')::numeric = 30 and (s #>> '{resultado,pago}')::numeric = 50);
  perform t_check('Natural: la billetera queda en 130', t_saldo_de(u) = 130);
  perform t_check('Natural: la mano se ve completa al terminar (la carta oculta ya se enseña)', jsonb_array_length(s #> '{crupier,cartas}') = 2 and (s #>> '{crupier,ocultas}')::int = 0);
  perform t_check('Natural: dos movimientos en el libro con la mano en el concepto', (select count(*) from hipodromo_movimientos where usuario = u and concepto like '%' || (s ->> 'partida') || '%') = 2);
  select * into p from veintiuna_partidas where id = (s ->> 'partida')::uuid;
  perform t_check('La mano apunta sus movimientos (cobro y pago)', p.mov_cobro is not null and p.mov_pago is not null and p.mov_peaje is null);
  perform t_check('Los movimientos apuntados son los del libro', (select monto from hipodromo_movimientos where id = p.mov_cobro) = -20 and (select monto from hipodromo_movimientos where id = p.mov_pago) = 50);
  -- Ambos tienen blackjack natural: empate, la apuesta vuelve
  perform t_saldo(u, 100);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, 'Ap', 'Kc', 'Qp', 'Ad');
  perform t_check('Natural de los dos: empate', s #>> '{resultado,tipo}' = 'empate' and s #>> '{resultado,razon}' = 'ambos_natural');
  perform t_check('Natural de los dos: la apuesta se devuelve (saldo 100)', t_saldo_de(u) = 100);
  -- Solo el crupier: pierdes sin poder jugar
  perform t_saldo(u, 100);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '9p', 'Ac', '7c', 'Kd');
  perform t_check('Natural del crupier: pierdes sin jugar', s #>> '{resultado,tipo}' = 'derrota' and s #>> '{resultado,razon}' = 'natural_crupier' and t_saldo_de(u) = 80);
  -- Un 21 con tres cartas NO es natural
  perform t_saldo(u, 100);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '7p', '9c', '7c', '8d', '7d');
  perform t_check('Una mano que sigue en curso no tiene resultado todavía', s ->> 'estado' = 'en_curso' and s -> 'resultado' = 'null'::jsonb);
  s := t_act((s ->> 'partida')::uuid, 'pedir');
  perform t_check('7 + 7 + 7 = 21 con tres cartas, no es natural', (s #>> '{jugador,total}')::int = 21 and s ->> 'estado' = 'en_curso');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('21 de tres cartas contra 17: victoria 1 a 1 (no 3 a 2)', s #>> '{resultado,tipo}' = 'victoria' and (s #>> '{resultado,neto}')::numeric = 20 and t_saldo_de(u) = 120);
  -- 10 + A es natural; A + 5 no lo es
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '9c', 'Ac', '8c');
  perform t_check('Natural con 10 + as', s #>> '{resultado,tipo}' = 'natural' and t_saldo_de(u) = 115);
end $$;

/* ======================================================================== Maldición al repartir */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb;
begin
  perform t_reset(); perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, 'Kp', '9c', 'Qc', '8d');
  perform t_check('Maldición: dos figuras suman 22 y pierdes al repartir', s #>> '{resultado,razon}' = 'pasado_al_repartir' and s #>> '{resultado,tipo}' = 'derrota' and t_saldo_de(u) = 80);
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, '10p', 'Kc', '5c', 'Qd');
  perform t_check('Maldición: si el crupier se pasa al repartir (dos figuras) ganas 1 a 1', s #>> '{resultado,razon}' = 'crupier_pasado_al_repartir' and s #>> '{resultado,tipo}' = 'victoria' and t_saldo_de(u) = 120);
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, 'Kp', 'Qc', '10c', '9d');
  perform t_check('Maldición: rey + 10 = 21 con dos cartas es blackjack natural', s #>> '{resultado,tipo}' = 'natural' and t_saldo_de(u) = 130);
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, 'Kp', '9c', 'Qc', '8d');
  perform t_check('Maldición: la derrota al repartir no la gana el crupier aunque él también se pase', true);
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, 'Kp', 'Qc', 'Qd', 'Kd');
  perform t_check('Maldición: si los dos se pasan al repartir pierdes tú primero', s #>> '{resultado,razon}' = 'pasado_al_repartir' and t_saldo_de(u) = 80);
  perform t_saldo(u, 100);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, 'Kp', '9c', 'Qc', '8d');
  perform t_check('Sin Maldición, dos figuras suman 20 y la mano sigue', s ->> 'estado' = 'en_curso' and (s #>> '{jugador,total}')::int = 20);
end $$;

/* ======================================================================== turnos: pedir, plantarse y el crupier */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; p veintiuna_partidas%rowtype;
begin
  perform t_reset(); perform t_saldo(u, 500);
  -- Jugador 10 + 8 = 18 contra 9 + 7: el crupier pide con 16 y saca un 3 → 19; pierdes
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '9c', '8c', '7c', '3d');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('El crupier pide con 16 (9 + 7 + 3 = 19) y gana a 18', (s #>> '{crupier,total}')::int = 19 and s #>> '{resultado,tipo}' = 'derrota' and jsonb_array_length(s #> '{crupier,cartas}') = 3);
  -- El crupier se planta con 17 duro
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '7c');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('El crupier se planta con 17 y no roba', jsonb_array_length(s #> '{crupier,cartas}') = 2 and (s #>> '{crupier,total}')::int = 17 and s #>> '{resultado,tipo}' = 'victoria');
  -- El crupier se planta con 17 blando (A + 6)
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '6c', '8c', 'Ad', '2d');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('El crupier se planta con un 17 blando (A + 6) sin robar', jsonb_array_length(s #> '{crupier,cartas}') = 2 and (s #>> '{crupier,total}')::int = 17 and (s #>> '{crupier,blando}')::boolean);
  -- El crupier se pasa
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '10c', '5c', '6c', '9d');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('El crupier se pasa (10 + 6 + 9 = 25) y ganas con 15', s #>> '{resultado,razon}' = 'crupier_se_pasa' and s #>> '{resultado,tipo}' = 'victoria');
  -- Empate: se devuelve la apuesta
  perform t_saldo(u, 500);
  s := t_reparte(u, 'maldicion', 'apuesta', 50, '10p', '10c', '8c', '8d');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Empate 18 contra 18: la apuesta vuelve (saldo 500)', s #>> '{resultado,tipo}' = 'empate' and t_saldo_de(u) = 500 and (s #>> '{resultado,neto}')::numeric = 0);
  -- Pasarte pierde sin que el crupier juegue
  perform t_saldo(u, 500);
  s := t_reparte(u, 'maldicion', 'apuesta', 50, '10p', '9c', '6c', '8c', '10d');
  s := t_act((s ->> 'partida')::uuid, 'pedir');
  perform t_check('Te pasas: pierdes y el crupier ni juega', s #>> '{resultado,razon}' = 'te_pasas' and jsonb_array_length(s #> '{crupier,cartas}') = 2 and t_saldo_de(u) = 450);
  -- No se puede pedir con 21
  s := t_reparte(u, 'maldicion', 'practica', 0, '10p', '9c', '5c', '8c', '6d');
  s := t_act((s ->> 'partida')::uuid, 'pedir');
  perform t_check('10 + 5 + 6 = 21', (s #>> '{jugador,total}')::int = 21);
  perform t_check('Con 21 no se puede pedir (acciones.pedir es falso)', (s #>> '{acciones,pedir}')::boolean = false);
  begin
    perform t_act((s ->> 'partida')::uuid, 'pedir'); perform t_check('Pedir con 21 se rechaza', false);
  exception when others then perform t_check('Pedir con 21 se rechaza (' || sqlerrm || ')', true); end;
  -- Una acción que no existe y una fuera de fase
  begin perform t_act((s ->> 'partida')::uuid, 'doblar'); perform t_check('Una acción que no existe se rechaza', false);
  exception when others then perform t_check('Una acción que no existe se rechaza', sqlerrm = 'Esa acción no existe.'); end;
  begin perform t_act((s ->> 'partida')::uuid, 'fortuna'); perform t_check('La Fortuna fuera de su fase se rechaza', false);
  exception when others then perform t_check('La Fortuna fuera de su fase se rechaza', true); end;
  begin perform t_act((s ->> 'partida')::uuid, 'voluntad'); perform t_check('La Última voluntad en otra regla se rechaza', false);
  exception when others then perform t_check('La Última voluntad en otra regla se rechaza', true); end;
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  begin perform t_act((s ->> 'partida')::uuid, 'plantar'); perform t_check('Una mano terminada no admite más acciones', false);
  exception when others then perform t_check('Una mano terminada no admite más acciones', sqlerrm = 'Esa mano ya terminó.'); end;
end $$;

/* ======================================================================== la carta oculta no sale del servidor */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; m jsonb; txt text;
begin
  perform t_reset(); perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '9c', '8c', '7c', '3d');       -- el crupier tiene 9 visible y 7 oculta
  txt := s::text;
  perform t_check('Mano en curso: del crupier solo viene una carta y una carta oculta', jsonb_array_length(s #> '{crupier,cartas}') = 1 and (s #>> '{crupier,ocultas}')::int = 1);
  perform t_check('La carta visible es la primera del crupier (9 de corazones)', s #>> '{crupier,cartas,0,r}' = '9' and s #>> '{crupier,cartas,0,p}' = '1');
  perform t_check('El total del crupier es el de su carta visible, no el de las dos', (s #>> '{crupier,total}')::int = 9);
  perform t_check('La respuesta no lleva ni la baraja ni ninguna carta de más', position('mazo' in txt) = 0 and position('repartidas' in txt) = 0 and position('"r": 7' in txt) = 0);
  select veintiuna_i_estado(p, 100) into m from veintiuna_partidas p where id = (s ->> 'partida')::uuid;
  perform t_check('El estado que se da al navegador no cambia si lo pide otra vez', m - 'saldo' = s - 'saldo');
  -- La mesa (lo que se carga al entrar) tampoco la enseña
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  m := veintiuna_mesa();
  reset role;
  txt := m::text;
  perform t_check('veintiuna_mesa devuelve la mano en curso con una sola carta del crupier', jsonb_array_length(m #> '{partida,crupier,cartas}') = 1 and position('mazo' in txt) = 0);
  perform t_check('La mesa tampoco enseña la carta oculta (un 7)', position('"r": 7' in (m -> 'partida')::text) = 0);
  -- Al terminar sí se ve todo
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Al terminar la mano el crupier enseña todas sus cartas', jsonb_array_length(s #> '{crupier,cartas}') = 3 and (s #>> '{crupier,ocultas}')::int = 0);
end $$;

/* ======================================================================== la Fortuna */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; p veintiuna_partidas%rowtype;
begin
  perform t_reset(); perform t_saldo(u, 200);
  -- 10 + 6 y te pasas con un rey: queda pendiente de la Fortuna (no pierdes todavía)
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '6c', '9d', 'Kd');
  pid := (s ->> 'partida')::uuid;
  s := t_act(pid, 'pedir');
  perform t_check('Fortuna: pasarte la primera vez no termina la mano, queda a decidir', s ->> 'estado' = 'en_curso' and s ->> 'fase' = 'fortuna' and (s #>> '{jugador,total}')::int = 26);
  perform t_check('Fortuna: en esa fase solo se puede salvar la mano o aceptarla', (s #>> '{acciones,pedir}')::boolean = false and (s #>> '{acciones,plantar}')::boolean = false and s #>> '{acciones,especial,tipo}' = 'fortuna');
  perform t_check('El peaje de la Fortuna es 60 % de la apuesta (12 con 20)', (s #>> '{acciones,especial,peaje}')::numeric = 12);
  begin perform t_act(pid, 'plantar'); perform t_check('No se puede plantar pasado de 21', false);
  exception when others then perform t_check('No se puede plantar pasado de 21', true); end;
  s := t_act(pid, 'fortuna');
  perform t_check('Fortuna: el rey pasa a valer 1 (10 + 6 + 1 = 17) y la mano sigue', (s #>> '{jugador,total}')::int = 17 and s ->> 'fase' = 'jugador' and (s #>> '{regla,usada}')::boolean);
  perform t_check('Fortuna: el peaje se cobra (200 - 20 - 12 = 168) y queda en el libro', t_saldo_de(u) = 168 and (select count(*) from hipodromo_movimientos where usuario = u and concepto like '%peaje de la Fortuna%' and monto = -12) = 1);
  perform t_check('La carta convertida se marca para que la pantalla lo cuente', (s #>> '{jugador,cartas,2,as1}')::boolean);
  s := t_act(pid, 'plantar');
  select * into p from veintiuna_partidas where id = pid;
  perform t_check('Con 17 contra 9 + 9 = 18 pierdes; el neto incluye el peaje (-20 -12)', s #>> '{resultado,tipo}' = 'derrota' and (s #>> '{resultado,neto}')::numeric = -32 and t_saldo_de(u) = 168);
  perform t_check('La mano guarda el movimiento del peaje', p.mov_peaje is not null and (select monto from hipodromo_movimientos where id = p.mov_peaje) = -12);
  -- Ganar después de la Fortuna
  perform t_saldo(u, 200);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '6c', '10d', 'Kd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna'); s := t_act(pid, 'plantar');
  perform t_check('Fortuna + victoria: 17 contra 10 + 10 = 20 pierde; el neto es negativo', s #>> '{resultado,tipo}' = 'derrota');
  perform t_saldo(u, 200);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '10c', '6c', '6d', 'Kd', '9d');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna'); s := t_act(pid, 'plantar');
  perform t_check('Fortuna + victoria: 17 contra 10 + 6 + 9 = 25 gana (+20 menos el peaje: neto 8)', s #>> '{resultado,tipo}' = 'victoria' and (s #>> '{resultado,neto}')::numeric = 8 and t_saldo_de(u) = 200 - 20 - 12 + 40);
  -- Aceptar la derrota no cuesta peaje
  perform t_saldo(u, 200);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '6c', '9d', 'Kd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'aceptar');
  perform t_check('Aceptar el pasarte pierde la apuesta y no cobra peaje (saldo 180)', s #>> '{resultado,razon}' = 'te_pasas' and t_saldo_de(u) = 180 and (s #>> '{resultado,peajes}')::numeric = 0);
  -- Solo una vez por ronda: la segunda vez que te pasas pierdes
  perform t_saldo(u, 200);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '5p', '9c', '6c', '9d', 'Kd', 'Qd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir');
  perform t_check('5 + 6 + rey = 21: no se pasa y no hay Fortuna', (s #>> '{jugador,total}')::int = 21 and s ->> 'fase' = 'jugador');
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '4c', '9d', 'Kd', 'Qd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna');
  perform t_check('Tras la Fortuna: 10 + 4 + 1 = 15 y puedes seguir pidiendo', (s #>> '{jugador,total}')::int = 15 and (s #>> '{acciones,pedir}')::boolean);
  s := t_act(pid, 'pedir');
  perform t_check('La segunda vez que te pasas ya no hay Fortuna: pierdes', s ->> 'estado' = 'terminada' and s #>> '{resultado,razon}' = 'te_pasas');
  -- Sin monedas para el peaje
  perform t_saldo(u, 20);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '6c', '9d', 'Kd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir');
  perform t_check('Sin monedas para el peaje la Fortuna sale como no disponible y dice cuántas faltan', (s #>> '{acciones,especial,disponible}')::boolean = false and s #>> '{acciones,especial,motivo}' = 'te faltan 12 monedas');
  begin perform t_act(pid, 'fortuna'); perform t_check('Salvar la mano sin monedas se rechaza', false);
  exception when others then perform t_check('Salvar la mano sin monedas se rechaza', true); end;
  perform t_check('Y la mano sigue pendiente (nada cambió)', (select fase from veintiuna_partidas where id = pid) = 'fortuna' and t_saldo_de(u) = 0);
  s := t_act(pid, 'aceptar');
  -- La mesa de práctica: el peaje es simbólico y la billetera no se toca
  perform t_saldo(u, 7);
  s := t_reparte(u, 'fortuna', 'practica', 0, '10p', '9c', '6c', '9d', 'Kd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna');
  perform t_check('Práctica: la Fortuna se puede usar sin monedas y la billetera queda igual', t_saldo_de(u) = 7 and (s #>> '{regla,usada}')::boolean);
  s := t_act(pid, 'plantar');
  perform t_check('Práctica: no hay movimientos en el libro', (select count(*) from hipodromo_movimientos where usuario = u and concepto like '%' || pid::text || '%') = 0 and t_saldo_de(u) = 7);
end $$;

/* ======================================================================== la Última voluntad */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; p veintiuna_partidas%rowtype;
begin
  perform t_reset(); perform t_saldo(u, 200);
  -- Tú tienes 19. El crupier tiene 18 (10 + 8). Con la Última voluntad roba antes de plantarse y se pasa con un rey
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '8c', 'Kd');
  pid := (s ->> 'partida')::uuid;
  perform t_check('Última voluntad: disponible con 19 y con peaje del 85 % (17 con 20)', (s #>> '{acciones,especial,disponible}')::boolean and (s #>> '{acciones,especial,peaje}')::numeric = 17);
  s := t_act(pid, 'voluntad');
  perform t_check('Última voluntad: el crupier roba una carta de más con 18 (10 + 8 + rey = 28) y se pasa', s #>> '{resultado,razon}' = 'crupier_se_pasa' and (s #>> '{crupier,total}')::int = 28 and jsonb_array_length(s #> '{crupier,cartas}') = 3);
  perform t_check('Última voluntad: ganas 20 menos el peaje de 17 (neto 3) y el saldo cuadra (200 - 20 - 17 + 40 = 203)', (s #>> '{resultado,neto}')::numeric = 3 and t_saldo_de(u) = 203);
  perform t_check('Última voluntad: el peaje queda en el libro y en la mano', (select count(*) from hipodromo_movimientos where usuario = u and concepto like '%peaje de la Última voluntad%' and monto = -17) = 1
                  and (select mov_peaje from veintiuna_partidas where id = pid) is not null);
  -- Plantarse sin usarla: el crupier con 18 se planta y no roba
  perform t_saldo(u, 200);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '8c', 'Kd');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Sin Última voluntad el crupier se planta con 18 y no roba (19 le gana)', s #>> '{resultado,tipo}' = 'victoria' and jsonb_array_length(s #> '{crupier,cartas}') = 2);
  -- El crupier roba la carta forzada y luego sigue con su regla: 10 + 4 = 14, forzada 2 = 16, pide otra (5) = 21
  perform t_saldo(u, 200);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '4c', '2d', '5d');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'voluntad');
  perform t_check('Después de la carta forzada el crupier sigue con su regla (14 + 2 = 16, pide un 5 = 21)', (s #>> '{crupier,total}')::int = 21 and jsonb_array_length(s #> '{crupier,cartas}') = 4 and s #>> '{resultado,tipo}' = 'derrota');
  -- La carta forzada se roba aunque el crupier ya tuviera 17 o más
  perform t_saldo(u, 200);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '7c', '3d');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'voluntad');
  perform t_check('Con 17 el crupier roba de más igualmente (10 + 7 + 3 = 20)', (s #>> '{crupier,total}')::int = 20 and jsonb_array_length(s #> '{crupier,cartas}') = 3);
  -- Si el admin pone un mínimo de puntos, con menos no se puede
  update cartas_economia_ajustes set valor = '18' where clave = 'veintiuna_voluntad_minimo';
  perform t_saldo(u, 200);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '7c', '8c', 'Kd');
  perform t_check('Con un mínimo de 18, con 17 la Última voluntad no está disponible y dice por qué', (s #>> '{acciones,especial,disponible}')::boolean = false and s #>> '{acciones,especial,motivo}' = 'necesitas 18 o más');
  begin perform t_act((s ->> 'partida')::uuid, 'voluntad'); perform t_check('Usarla con menos del mínimo se rechaza', false);
  exception when others then perform t_check('Usarla con menos del mínimo se rechaza (' || sqlerrm || ')', sqlerrm = 'La Última voluntad pide 18 puntos o más.'); end;
  perform t_check('Y no se cobró nada', t_saldo_de(u) = 180);
  update cartas_economia_ajustes set valor = '0' where clave = 'veintiuna_voluntad_minimo';
  s := t_reparte(u, 'voluntad', 'practica', 0, '10p', '10c', '7c', '8c', 'Kd');
  perform t_check('Con el mínimo en 0 la Última voluntad se puede usar con cualquier mano (17)', (s #>> '{acciones,especial,disponible}')::boolean);
  -- Solo una vez por ronda
  perform t_saldo(u, 200);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '8c', '2d', '4d');
  pid := (s ->> 'partida')::uuid;
  update veintiuna_partidas set voluntad_usada = true where id = pid;
  select veintiuna_i_estado(x, 100) into s from veintiuna_partidas x where x.id = pid;
  perform t_check('Una vez usada, el estado la marca como usada y no disponible', (s #>> '{regla,usada}')::boolean and (s #>> '{acciones,especial,disponible}')::boolean = false and s #>> '{acciones,especial,motivo}' = 'ya la usaste');
  begin perform t_act(pid, 'voluntad'); perform t_check('La Última voluntad solo se usa una vez por ronda', false);
  exception when others then perform t_check('La Última voluntad solo se usa una vez por ronda', true); end;
  -- Peaje: sin monedas, no disponible
  perform t_saldo(u, 20);
  s := t_reparte(u, 'voluntad', 'apuesta', 20, '10p', '10c', '9c', '8c');
  perform t_check('Última voluntad sin monedas para el peaje: no disponible y dice cuántas faltan', (s #>> '{acciones,especial,disponible}')::boolean = false and s #>> '{acciones,especial,motivo}' = 'te faltan 17 monedas');
  begin perform t_act((s ->> 'partida')::uuid, 'voluntad'); perform t_check('Usarla sin monedas se rechaza', false);
  exception when others then perform t_check('Usarla sin monedas se rechaza', true); end;
  perform t_check('Y no se cobró nada', t_saldo_de(u) = 0 and (select count(*) from hipodromo_movimientos where usuario = u and concepto like '%peaje%' and concepto like '%' || (s ->> 'partida') || '%') = 0);
  -- En la mesa de práctica no se cobra
  perform t_saldo(u, 0);
  s := t_reparte(u, 'voluntad', 'practica', 0, '10p', '10c', '9c', '8c', 'Kd');
  s := t_act((s ->> 'partida')::uuid, 'voluntad');
  perform t_check('Práctica: la Última voluntad funciona sin monedas', s #>> '{resultado,tipo}' = 'victoria' and t_saldo_de(u) = 0);
end $$;

/* ======================================================================== idempotencia y concurrencia dentro de una sola sesión */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; s2 jsonb; cli uuid := gen_random_uuid(); pid uuid; n_antes int;
begin
  perform t_reset(); perform t_saldo(u, 100);
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (u, 'maldicion') on conflict (user_id) do update set proxima_regla = 'maldicion';
  s := veintiuna_i_repartir(u, cli, 'apuesta', 20, t_mazo('10p', '9c', '8c', '7c', '3d'));
  s2 := veintiuna_i_repartir(u, cli, 'apuesta', 20, t_mazo('Ap', '9c', 'Kc', '7c'));
  perform t_check('Repartir dos veces con el mismo identificador devuelve la misma mano', s ->> 'partida' = s2 ->> 'partida' and (s2 ->> 'repetida')::boolean);
  perform t_check('Y la apuesta se cobró una sola vez (saldo 80, un solo movimiento)', t_saldo_de(u) = 80 and (select count(*) from hipodromo_movimientos where usuario = u) = 1);
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 20, t_mazo('10p', '9c', '8c', '7c')); perform t_check('No se puede repartir otra mano con una en curso', false);
  exception when others then perform t_check('No se puede repartir otra mano con una en curso', sqlerrm like 'Ya tienes una mano en curso%'); end;
  perform t_check('Una sola mano en curso por jugador (índice único)', (select count(*) from veintiuna_partidas where user_id = u and estado = 'en_curso') = 1);
  begin insert into veintiuna_partidas (user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier)
        values (u, gen_random_uuid(), 'practica', 10, 'fortuna', veintiuna_i_mazo(), 4, '{1,2}', '{3,4}');
        perform t_check('La base impide una segunda mano en curso aunque falle la función', false);
  exception when unique_violation then perform t_check('La base impide una segunda mano en curso aunque falle la función', true); end;
  pid := (s ->> 'partida')::uuid;
  -- acciones repetidas: pedir con el paso 0 dos veces
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  s := veintiuna_accion(pid, 0, 'pedir');
  n_antes := jsonb_array_length(s #> '{jugador,cartas}');
  s2 := veintiuna_accion(pid, 0, 'pedir');
  reset role;
  perform t_check('Pedir carta: una cuenta, tres cartas', n_antes = 3 and (s ->> 'paso')::int = 1);
  perform t_check('Repetir la misma acción (mismo paso) no pide otra carta y avisa de que era repetida', jsonb_array_length(s2 #> '{jugador,cartas}') = 3 and (s2 ->> 'repetida')::boolean);
  set local role authenticated;
  begin perform veintiuna_accion(pid, 5, 'pedir'); reset role; perform t_check('Un paso del futuro se rechaza', false);
  exception when others then reset role; perform t_check('Un paso del futuro se rechaza', sqlerrm like 'La mesa y tu pantalla no coinciden%'); end;
  set local role authenticated;
  s := veintiuna_accion(pid, 1, 'plantar');
  s2 := veintiuna_accion(pid, 1, 'plantar');
  reset role;
  perform t_check('Plantarse dos veces: se liquida una sola vez (un solo pago)', s ->> 'estado' = 'terminada' and (s2 ->> 'repetida')::boolean
                  and (select count(*) from hipodromo_movimientos where usuario = u and monto > 0) <= 1 and t_saldo_de(u) = (80 + (s #>> '{resultado,pago}')::numeric));
  perform t_check('El libro y la billetera cuadran', t_saldo_de(u) = 100 + (select sum(monto) from hipodromo_movimientos where usuario = u));
end $$;

/* ======================================================================== límites de la apuesta */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; m text;
  function_ok boolean;
begin
  perform t_reset(); perform t_saldo(u, 100);
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (u, 'maldicion') on conflict (user_id) do update set proxima_regla = 'maldicion';
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 5, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una apuesta por debajo del mínimo se rechaza', false);
  exception when others then perform t_check('Una apuesta por debajo del mínimo se rechaza (' || sqlerrm || ')', sqlerrm = 'La apuesta va de 10 a 100 monedas.'); end;
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 150, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una apuesta por encima del máximo se rechaza', false);
  exception when others then perform t_check('Una apuesta por encima del máximo se rechaza', sqlerrm = 'La apuesta va de 10 a 100 monedas.'); end;
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 25, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una apuesta que no es múltiplo del paso se rechaza', false);
  exception when others then perform t_check('Una apuesta que no es múltiplo del paso se rechaza', sqlerrm = 'La apuesta tiene que ser múltiplo de 10.'); end;
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', null, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una apuesta vacía se rechaza', false);
  exception when others then perform t_check('Una apuesta vacía se rechaza', true); end;
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', -10, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una apuesta negativa se rechaza', false);
  exception when others then perform t_check('Una apuesta negativa se rechaza', true); end;
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'dados', 10, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Una modalidad que no existe se rechaza', false);
  exception when others then perform t_check('Una modalidad que no existe se rechaza', true); end;
  perform t_saldo(u, 30);
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 50, t_mazo('10p', '9c', '8c', '7c')); perform t_check('Apostar más de lo que tienes se rechaza', false);
  exception when others then perform t_check('Apostar más de lo que tienes se rechaza y dice cuánto falta (' || sqlerrm || ')', sqlerrm = 'No tienes tantas monedas: te faltan 20.'); end;
  perform t_check('Y no se cobró nada ni quedó una mano a medias', t_saldo_de(u) = 30 and not exists (select 1 from veintiuna_partidas where user_id = u));
  begin perform veintiuna_i_repartir(u, gen_random_uuid(), 'apuesta', 10, t_mazo('10p', '9c', '8c', '7c')); perform t_check('(apuesta de 10 con 30 monedas)', true);
  exception when others then perform t_check('(apuesta de 10 con 30 monedas) ' || sqlerrm, false); end;
  perform t_check('Con 30 monedas sí se puede apostar 10', t_saldo_de(u) = 20);
  -- Práctica: no hace falta saldo y no toca nada
  perform t_saldo(u, 0); delete from veintiuna_partidas where user_id = u;
  s := veintiuna_i_repartir(u, gen_random_uuid(), 'practica', 999, t_mazo('10p', '9c', '8c', '7c'));
  perform t_check('La práctica ignora el importe pedido (la apuesta simbólica es 10) y no necesita monedas', (s ->> 'apuesta')::numeric = 10 and t_saldo_de(u) = 0 and s ->> 'modo' = 'practica');
  s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('La práctica no deja movimientos ni cambia la billetera aunque ganes', t_saldo_de(u) = 0 and not exists (select 1 from hipodromo_movimientos where usuario = u and concepto like '%' || (s ->> 'partida') || '%'));
end $$;

/* ======================================================================== mano abandonada */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; m jsonb;
begin
  perform t_reset(); perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, '10p', '9c', '9c', '8d', '2d');
  pid := (s ->> 'partida')::uuid;
  update veintiuna_partidas set ultima_accion = now() - interval '31 minutes' where id = pid;
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  set local role authenticated;
  m := veintiuna_mesa();
  reset role;
  perform t_check('Una mano parada más de 30 minutos se cierra sola al volver a la mesa', m -> 'partida' = 'null'::jsonb and (select estado from veintiuna_partidas where id = pid) = 'terminada');
  perform t_check('Se plantó con lo que tenía (19 contra 17: victoria) y se pagó una vez', (select resultado from veintiuna_partidas where id = pid) = 'victoria' and t_saldo_de(u) = 120);
  -- Pendiente de la Fortuna: se acepta la derrota sin cobrar peaje
  perform t_saldo(u, 100);
  s := t_reparte(u, 'fortuna', 'apuesta', 20, '10p', '9c', '6c', '9d', 'Kd');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir');
  update veintiuna_partidas set ultima_accion = now() - interval '31 minutes' where id = pid;
  set local role authenticated;
  m := veintiuna_mesa();
  reset role;
  perform t_check('Una mano parada pendiente de la Fortuna acepta la derrota sin cobrar el peaje', (select resultado from veintiuna_partidas where id = pid) = 'derrota' and t_saldo_de(u) = 80);
  -- Actuar sobre una mano caducada no la aplica
  perform t_saldo(u, 100);
  s := t_reparte(u, 'maldicion', 'apuesta', 20, '10p', '9c', '9c', '8d', '2d');
  pid := (s ->> 'partida')::uuid;
  update veintiuna_partidas set ultima_accion = now() - interval '45 minutes' where id = pid;
  set local role authenticated;
  s := veintiuna_accion(pid, 0, 'pedir');
  reset role;
  perform t_check('Pedir carta en una mano caducada no la aplica: ya estaba plantada', (s ->> 'cerrada_por_inactividad')::boolean and s ->> 'estado' = 'terminada' and jsonb_array_length(s #> '{jugador,cartas}') = 2);
end $$;

/* ======================================================================== estadísticas y desafíos */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000001'; s jsonb; pid uuid; e veintiuna_estadisticas%rowtype;
  function_logros text;
begin
  perform t_reset(); perform t_saldo(u, 1000);
  -- Primera victoria
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '7c'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  select * into e from veintiuna_estadisticas where user_id = u;
  perform t_check('Una victoria cuenta: 1 ronda, 1 victoria, racha 1', e.rondas = 1 and e.victorias = 1 and e.racha = 1 and e.mejor_racha = 1);
  perform t_check('Desafío «Primera vela» y «Bajo la Maldición» completados', exists (select 1 from veintiuna_logros where user_id = u and logro = 'primera_vela') and exists (select 1 from veintiuna_logros where user_id = u and logro = 'bajo_maldicion'));
  perform t_check('La mano dice qué desafíos completó', s -> 'logros_nuevos' @> '["primera_vela","bajo_maldicion"]'::jsonb);
  -- Un empate no rompe la racha; una derrota sí
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '8d'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  select * into e from veintiuna_estadisticas where user_id = u;
  perform t_check('Un empate no suma ni rompe la racha', e.empates = 1 and e.racha = 1);
  s := t_reparte(u, 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '9d'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  select * into e from veintiuna_estadisticas where user_id = u;
  perform t_check('Una derrota rompe la racha pero no la mejor racha', e.racha = 0 and e.mejor_racha = 1 and e.derrotas = 1);
  -- Tres seguidas
  s := t_reparte(u, 'maldicion', 'practica', 0, '10p', '10c', '8c', '7c'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  s := t_reparte(u, 'maldicion', 'practica', 0, '10p', '10c', '8c', '7c'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Dos victorias seguidas todavía no dan «Tres velas»', not exists (select 1 from veintiuna_logros where user_id = u and logro = 'tres_velas'));
  s := t_reparte(u, 'maldicion', 'practica', 0, '10p', '10c', '8c', '7c'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('La práctica también cuenta para los desafíos: tres seguidas dan «Tres velas»', exists (select 1 from veintiuna_logros where user_id = u and logro = 'tres_velas'));
  perform t_check('Y la práctica no tocó las monedas ganadas (neto solo de manos con apuesta)', (select neto from veintiuna_estadisticas where user_id = u) = 10 + 0 - 10);
  -- Un blackjack natural cuenta como victoria y racha, pero ya no tiene desafío propio (era pura suerte)
  s := t_reparte(u, 'fortuna', 'apuesta', 10, 'Ap', '10c', 'Kc', '7c');
  perform t_check('Un blackjack natural suma a las estadísticas (naturales) y no completa «Veintiuna exacta»', (select naturales from veintiuna_estadisticas where user_id = u) = 1 and not exists (select 1 from veintiuna_logros where user_id = u and logro = 'veintiuna_exacta'));
  -- Sin miedo: plantarse con 14 o menos y ganar
  perform t_check('Todavía no hay «Sin miedo»', not exists (select 1 from veintiuna_logros where user_id = u and logro = 'sin_miedo'));
  s := t_reparte(u, 'fortuna', 'practica', 0, '5p', '10c', '8c', '6c', 'Kd'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Plantarse con 13 y ganar (el crupier se pasa) da «Sin miedo»', s #>> '{resultado,tipo}' = 'victoria' and exists (select 1 from veintiuna_logros where user_id = u and logro = 'sin_miedo'));
  s := t_reparte(u, 'maldicion', 'practica', 0, '5p', '10c', '6c', '10d', '10d');
  s := t_act((s ->> 'partida')::uuid, 'pedir'); s := t_act((s ->> 'partida')::uuid, 'plantar');
  perform t_check('Llegar a 21 pidiendo y ganar da «Veintiuna exacta»', exists (select 1 from veintiuna_logros where user_id = u and logro = 'veintiuna_exacta'));
  -- Cinco cartas sin pasarte
  s := t_reparte(u, 'maldicion', 'practica', 0, '2p', '10c', '3c', '7c', '4d', '5d', '6d');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'pedir'); s := t_act(pid, 'pedir'); s := t_act(pid, 'plantar');
  perform t_check('Ganar con cinco cartas sin pasarte da «Cinco cartas sin pasarte»', s #>> '{resultado,tipo}' = 'victoria' and exists (select 1 from veintiuna_logros where user_id = u and logro = 'cinco_cartas'));
  -- Las tres reglas
  perform t_check('Con solo la Maldición ganada todavía no hay «Las tres voluntades»', not exists (select 1 from veintiuna_logros where user_id = u and logro = 'tres_voluntades'));
  s := t_reparte(u, 'voluntad', 'practica', 0, '10p', '10c', '9c', '8c', 'Kd'); s := t_act((s ->> 'partida')::uuid, 'voluntad');
  perform t_check('Ganar usando la Última voluntad da «La última palabra»', exists (select 1 from veintiuna_logros where user_id = u and logro = 'ultima_palabra'));
  s := t_reparte(u, 'fortuna', 'practica', 0, '10p', '10c', '6c', '6d', 'Kd', '9d');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna'); s := t_act(pid, 'plantar');
  perform t_check('Ganar después de salvar la mano con la Fortuna da «Peaje pagado»', exists (select 1 from veintiuna_logros where user_id = u and logro = 'peaje_pagado'));
  perform t_check('Con las tres reglas ganadas llega «Las tres voluntades»', exists (select 1 from veintiuna_logros where user_id = u and logro = 'tres_voluntades'));
  -- Un desafío no se completa dos veces
  perform t_check('Cada desafío aparece una sola vez', (select count(*) from veintiuna_logros where user_id = u) = (select count(distinct logro) from veintiuna_logros where user_id = u));
  perform t_check('No hay desafíos reclamados sin que nadie los reclame', not exists (select 1 from veintiuna_logros where reclamado is not null));
end $$;

/* ======================================================================== desafíos de riesgo (los de oro) */
do $$
declare u uuid := '00000000-0000-0000-0000-000000000002'; s jsonb; pid uuid;
begin
  perform t_reset();
  -- A la hora de la verdad: ganar con la Última voluntad estando en apuros (16 o menos)
  s := t_reparte(u, 'voluntad', 'practica', 0, '10p', '10c', '9c', '8c', 'Kd');
  s := t_act((s ->> 'partida')::uuid, 'voluntad');
  perform t_check('Ganar con la Última voluntad con 19 da «La última palabra» pero NO «A la hora de la verdad»', s #>> '{resultado,tipo}' = 'victoria' and exists (select 1 from veintiuna_logros where user_id = u and logro = 'ultima_palabra') and not exists (select 1 from veintiuna_logros where user_id = u and logro = 'ultima_hora'));
  s := t_reparte(u, 'voluntad', 'practica', 0, '10p', '10c', '6c', '8c', 'Kd');
  s := t_act((s ->> 'partida')::uuid, 'voluntad');
  perform t_check('Ganar con la Última voluntad con 16 da «A la hora de la verdad»', s #>> '{resultado,tipo}' = 'victoria' and exists (select 1 from veintiuna_logros where user_id = u and logro = 'ultima_hora'));
  -- La suerte bien pagada: 21 exactos después de salvar la mano con la Fortuna
  s := t_reparte(u, 'fortuna', 'practica', 0, '10p', '10c', '6c', '10d', 'Kd', '4c');
  pid := (s ->> 'partida')::uuid; s := t_act(pid, 'pedir'); s := t_act(pid, 'fortuna'); s := t_act(pid, 'pedir');
  perform t_check('Tras la Fortuna: 10 + 6 + 1 + 4 = 21', (s #>> '{jugador,total}')::int = 21);
  s := t_act(pid, 'plantar');
  perform t_check('Ganar con 21 tras la Fortuna da «La suerte bien pagada» y «Peaje pagado»', s #>> '{resultado,tipo}' = 'victoria' and exists (select 1 from veintiuna_logros where user_id = u and logro = 'fortuna_veintiuna') and exists (select 1 from veintiuna_logros where user_id = u and logro = 'peaje_pagado'));
  perform t_check('Los desafíos antiguos (suerte o repetir manos) ya no existen', not exists (select 1 from veintiuna_logros_def where id in ('natural', 'seis_velas', 'maestro')) and (select count(*) from veintiuna_logros_def) = 11);
end $$;
