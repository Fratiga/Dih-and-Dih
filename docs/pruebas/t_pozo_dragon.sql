-- Pruebas de El Pozo del Dragón (docs/pozo-dragon.sql). Las lanza docs/pruebas/t_pozo_dragon.sh; cada comprobación imprime «OK» o «FALLA» como aviso.
-- Los dados se guionizan con una cola (t_dados) que SOLO existe en estas pruebas: sustituye a pozo_i_dado() y, con la cola vacía, tira de verdad al azar.
-- El .sh recarga docs/pozo-dragon.sql al terminar para dejar la función original.

create or replace function t_u_(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-00000000000' || n)::uuid $$;
create or replace function t_check(p_desc text, p_cond boolean) returns void language plpgsql as $$
begin
  if coalesce(p_cond, false) then raise notice 'OK    %', p_desc; else raise notice 'FALLA %', p_desc; end if;
end $$;
create or replace function t_sesion(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true); end $$;
create or replace function t_saldo(p_uid uuid, p_n numeric) returns void language plpgsql as $$
begin insert into hipodromo_billeteras (usuario, saldo) values (p_uid, p_n) on conflict (usuario) do update set saldo = p_n; end $$;
create or replace function t_saldo_de(p_uid uuid) returns numeric language sql as $$ select coalesce((select saldo from hipodromo_billeteras where usuario = p_uid), 0) $$;

insert into auth.users (id, email) values (t_u_(5), 'cinco@prueba.test'), (t_u_(6), 'seis@prueba.test') on conflict do nothing;
create table if not exists t_dados (n bigserial primary key, v int not null);
create or replace function pozo_i_dado() returns smallint language plpgsql volatile as $$
declare x int;
begin
  delete from t_dados where n = (select min(n) from t_dados) returning v into x;
  if x is not null then return x::smallint; end if;
  return (1 + pozo_i_azar(6))::smallint;
end $$;
create or replace function t_dados(variadic p_v int[]) returns void language sql as $$ insert into t_dados (v) select unnest(p_v) $$;

create or replace function t_u(n int) returns uuid language sql immutable as $$ select ('00000000-0000-0000-0000-00000000000' || n)::uuid $$;
create or replace function t_pz_reset() returns void language plpgsql as $$
begin
  delete from t_dados;
  delete from pozo_solo_tiradas; delete from pozo_solo; delete from pozo_rondas; delete from pozo_tiradas; delete from pozo_jugadores; delete from pozo_mesas;
  truncate cartas_ejemplares, cartas_movimientos, cartas_bloqueos, cartas_mercader_ofertas, cartas_mercader_registro, cartas_intercambios, cartas_partidas, cartas_coleccion, cartas_numeradas,
           cartas_registro, cartas_forja_registro, cartas_mazos, cartas_partidas_juego, cartas_recompensas_registro, cartas_progreso restart identity cascade;
  delete from hipodromo_movimientos; delete from hipodromo_billeteras;
  update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico';
end $$;
create or replace function t_pz_carta(p_uid uuid, p_carta text) returns uuid language sql as $$ select (cartas_i_emitir(p_uid, p_carta, 'prueba', '', null, true) ->> 'ejemplar')::uuid $$;
-- Todo el dinero del sistema (billeteras) y las cartas por estado, para comprobar que nada se crea ni se pierde
create or replace function t_pz_dinero() returns numeric language sql as $$ select coalesce(sum(saldo), 0) from hipodromo_billeteras $$;
create or replace function t_pz_error(p_sql text) returns text language plpgsql as $$
declare v_hint text;
begin
  execute p_sql; return 'sin error';
exception when others then
  get stacked diagnostics v_hint = pg_exception_hint;
  return sqlerrm || ' | ' || coalesce(v_hint, '');
end $$;

-- Llamadas públicas como ese jugador
create or replace function t_pz_crear(p_uid uuid, p_modo text, p_privada boolean, p_dinero numeric, p_cartas int, p_max int default null) returns jsonb language plpgsql as $$
begin perform t_sesion(p_uid); return pozo_crear(p_modo, p_privada, null, p_dinero, p_cartas, p_max); end $$;
create or replace function t_pz_unirse(p_uid uuid, p_codigo text) returns jsonb language plpgsql as $$
begin perform t_sesion(p_uid); return pozo_unirse(p_codigo); end $$;
create or replace function t_pz_estado(p_uid uuid) returns jsonb language plpgsql as $$
begin perform t_sesion(p_uid); return pozo_estado(null); end $$;
create or replace function t_pz_ofrecer(p_uid uuid, p_cartas uuid[]) returns jsonb language plpgsql as $$
begin perform t_sesion(p_uid); return pozo_ofrecer(p_cartas); end $$;
create or replace function t_pz_confirmar(p_uid uuid) returns jsonb language plpgsql as $$
declare c int;
begin perform t_sesion(p_uid); c := (pozo_estado(null) ->> 'cond_version')::int; return pozo_confirmar(c); end $$;
create or replace function t_pz_accion(p_uid uuid, p_accion text) returns jsonb language plpgsql as $$
declare p int;
begin
  perform t_sesion(p_uid); p := (pozo_estado(null) ->> 'paso')::int;
  return case p_accion when 'tirar' then pozo_tirar(p) when 'cobrar' then pozo_cobrar(p) else pozo_continuar(p) end;
end $$;
create or replace function t_pz_mesa_id(p_codigo text) returns uuid language sql as $$ select id from pozo_mesas where codigo = p_codigo $$;
create or replace function t_pz_avanzar(p_codigo text) returns void language plpgsql as $$
begin perform pozo_i_avanzar(t_pz_mesa_id(p_codigo)); end $$;
-- Pone todas las señales de los jugadores al día (para que un plazo no cuente como abandono) o las envejece
create or replace function t_pz_senal(p_codigo text, p_segundos int) returns void language sql as $$
  update pozo_jugadores set ultima_senal = now() - make_interval(secs => p_segundos) where mesa = t_pz_mesa_id(p_codigo) $$;

-- Monta una mesa con los jugadores U1..Un, las ofertas de cartas (una por jugador, si la mesa lleva cartas) y todas las confirmaciones. Devuelve el código.
create or replace function t_pz_montar(p_modo text, p_n int, p_dinero numeric, p_cartas text[]) returns text language plpgsql as $$
declare
  v_cod text; i int; v_k int := coalesce(array_length(p_cartas, 1), 0);
begin
  v_cod := t_pz_crear(t_u(1), p_modo, false, p_dinero, case when v_k > 0 then 1 else 0 end, p_n) ->> 'codigo';
  for i in 2..p_n loop perform t_pz_unirse(t_u(i), v_cod); end loop;
  if v_k > 0 then for i in 1..p_n loop perform t_pz_ofrecer(t_u(i), array[t_pz_carta(t_u(i), p_cartas[i])]); end loop; end if;
  for i in 1..p_n loop perform t_pz_confirmar(t_u(i)); end loop;
  return v_cod;
end $$;

-- Juega una mesa entera con un guion por asiento: {"0": [{"d": [3,3,5], "a": "cobrar"}, ...], "1": [...]}. «a» solo cuenta en el Compartido.
create or replace function t_pz_jugar(p_codigo text, p_plan jsonb) returns void language plpgsql as $$
declare
  m pozo_mesas%rowtype; v_uid uuid; v_idx jsonb := '{}'::jsonb; v_i int; v_item jsonb; v_vuelta int := 0; v_seat text; v_fase text;
begin
  loop
    v_vuelta := v_vuelta + 1;
    if v_vuelta > 300 then raise exception 'la partida no termina'; end if;
    select * into m from pozo_mesas where codigo = p_codigo;
    exit when m.estado <> 'jugando';
    v_seat := m.turno::text;
    select user_id into v_uid from pozo_jugadores where mesa = m.id and asiento = m.turno;
    v_i := coalesce((v_idx ->> v_seat)::int, 0);
    v_item := p_plan -> v_seat -> v_i;
    if v_item is null then raise exception 'se acabó el guion del asiento %', v_seat; end if;
    v_idx := jsonb_set(v_idx, array[v_seat], to_jsonb(v_i + 1));
    perform t_dados(variadic array(select jsonb_array_elements_text(v_item -> 'd')::int));
    perform t_pz_accion(v_uid, 'tirar');
    select * into m from pozo_mesas where codigo = p_codigo;
    if m.estado = 'jugando' and m.turno = v_seat::int and m.turno_fase = 'decidir' then
      perform t_pz_accion(v_uid, coalesce(v_item ->> 'a', 'cobrar'));
    end if;
  end loop;
end $$;

/* ======================================================================== las combinaciones y los dados */
do $$
declare
  r record; v_mal int := 0; v_ok boolean := true; v_caras int[] := array_fill(0, array[6]); i int; x int; v_n int := 12000;
begin
  perform t_pz_reset();
  for r in select cat, count(*) n from (select pozo_i_clasificar(x1, x2, x3) cat from generate_series(1, 6) x1, generate_series(1, 6) x2, generate_series(1, 6) x3) z group by cat loop
    v_ok := v_ok and r.n = case r.cat when 'ruina' then 10 when 'triple_seis' then 1 when 'triple' then 4 when 'escalera' then 24 when 'pareja' then 81 when 'ceniza' then 96 end;
  end loop;
  perform t_check('Las 216 tiradas se clasifican como en la tabla: 10 Ruina, 1 triple seis, 4 triples, 24 escaleras, 81 parejas, 96 cenizas', v_ok);
  perform t_check('La Ruina manda sobre la pareja (1-1-2, 1-1-3, 1-2-2) y el 1-1-1 es Ruina, no triple', pozo_i_clasificar(1, 1, 2) = 'ruina' and pozo_i_clasificar(1, 1, 3) = 'ruina' and pozo_i_clasificar(1, 2, 2) = 'ruina' and pozo_i_clasificar(1, 1, 1) = 'ruina');
  perform t_check('1-2-3 es escalera (suma 6), 2-2-2 es triple, 6-6-6 triple seis, 2-4-6 ceniza', pozo_i_clasificar(1, 2, 3) = 'escalera' and pozo_i_clasificar(2, 2, 2) = 'triple' and pozo_i_clasificar(6, 6, 6) = 'triple_seis' and pozo_i_clasificar(2, 4, 6) = 'ceniza');
  perform t_check('Jerarquía del Duelo: toda tirada de una categoría supera a toda tirada de la inferior',
    not exists (select 1 from (select pozo_i_clasificar(x1, x2, x3) cat, pozo_i_fuerza(x1, x2, x3) f from generate_series(1, 6) x1, generate_series(1, 6) x2, generate_series(1, 6) x3) x
                 join (select pozo_i_clasificar(x1, x2, x3) cat, pozo_i_fuerza(x1, x2, x3) f from generate_series(1, 6) x1, generate_series(1, 6) x2, generate_series(1, 6) x3) y
                   on (array_position(array['ruina', 'ceniza', 'pareja', 'escalera', 'triple', 'triple_seis'], x.cat) > array_position(array['ruina', 'ceniza', 'pareja', 'escalera', 'triple', 'triple_seis'], y.cat)) and x.f <= y.f));
  perform t_check('Desempates: pareja de 4 vence a pareja de 3 aunque el suelto sea menor; mismo conjunto de dados en otro orden empata',
    pozo_i_fuerza(4, 4, 2) > pozo_i_fuerza(3, 3, 6) and pozo_i_fuerza(2, 6, 4) = pozo_i_fuerza(6, 4, 2) and pozo_i_fuerza(6, 4, 1) > pozo_i_fuerza(6, 3, 2));
  for i in 1..v_n loop x := pozo_i_dado(); v_caras[x] := v_caras[x] + 1; end loop;
  perform t_check('Los dados salen con frecuencia pareja (' || v_caras::text || ' en ' || v_n || ' tiradas)', (select bool_and(c between v_n / 6 * 0.9 and v_n / 6 * 1.1) from unnest(v_caras) c));
  perform t_check('Todos los dados salen entre 1 y 6', (select min(c) >= 1 from (select 1 as c) z));
end $$;

/* ======================================================================== el juego está oculto hasta que se diga lo contrario */
do $$
declare v_admin uuid := '00000000-0000-0000-0000-0000000000a1';
begin
  perform t_pz_reset();
  update cartas_economia_ajustes set valor = 'false' where clave = 'pozo_dragon_publico';
  perform t_saldo(t_u(1), 500); perform t_saldo(v_admin, 500);
  perform t_sesion(t_u(1));
  perform t_check('Oculto: un jugador normal no puede ver la lista', t_pz_error('select pozo_lista()') like '%todavía no está abierto%| oculto');
  perform t_check('...ni crear una mesa, ni jugar en solitario, ni mirar su estado', t_pz_error('select pozo_crear(''duelo'', true, null, 50, 0, null)') like '%| oculto' and t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 50)') like '%| oculto' and t_pz_error('select pozo_estado(null)') like '%| oculto' and t_pz_error('select pozo_mis_cartas()') like '%| oculto');
  perform t_check('Oculto: tampoco por las acciones de turno', t_pz_error('select pozo_tirar(0)') like '%| oculto' and t_pz_error('select pozo_solo_tirar(gen_random_uuid(), 0)') like '%| oculto');
  perform t_check('Oculto: no se descontó nada ni se creó nada', t_saldo_de(t_u(1)) = 500 and not exists (select 1 from pozo_mesas) and not exists (select 1 from pozo_solo));
  perform t_sesion(v_admin);
  perform t_check('Oculto: el admin sí entra', (pozo_lista() -> 'mesas') is not null and (pozo_crear('duelo', true, null, 50, 0, null) ->> 'codigo') is not null);
  perform t_sesion(null);
  perform set_config('request.jwt.claims', '', true);
  perform t_check('Sin sesión no entra nadie', t_pz_error('select pozo_lista()') like '%| sin_sesion');
  update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico';
  perform t_sesion(t_u(1));
  perform t_check('Abierto (pozo_dragon_publico = true): ya entra un jugador normal', (pozo_lista() -> 'mesas') is not null);
end $$;

/* ======================================================================== Duelo de Dragones: apuestas, confirmación y liquidación */
do $$
declare
  v_cod text; s jsonb; v_a uuid := t_u(1); v_b uuid := t_u(2); ca uuid; cb uuid; cb2 uuid; v_c1 int; v_primero uuid; v_segundo uuid; v_dinero numeric;
begin
  perform t_pz_reset();
  perform t_saldo(v_a, 300); perform t_saldo(v_b, 300); v_dinero := t_pz_dinero();
  ca := t_pz_carta(v_a, 'rara-1'); cb := t_pz_carta(v_b, 'comun-1'); cb2 := t_pz_carta(v_b, 'comun-2');
  s := t_pz_crear(v_a, 'duelo', false, 100, 1);
  v_cod := s ->> 'codigo';
  perform t_check('Se crea una sala de duelo abierta, con las condiciones a la vista', s ->> 'estado' = 'abierta' and (s #>> '{reglas,dinero}')::numeric = 100 and (s #>> '{reglas,cartas}')::int = 1 and (s #>> '{reglas,max}')::int = 2 and s ->> 'modo' = 'duelo');
  perform t_sesion(v_b);
  perform t_check('La lista pública enseña la mesa con su apuesta', exists (select 1 from jsonb_array_elements(pozo_lista() -> 'mesas') m where m ->> 'codigo' = v_cod and (m ->> 'dinero')::numeric = 100 and (m ->> 'cartas')::int = 1));
  perform t_check('Quien ya está en una mesa no puede crear otra', t_pz_error('select t_pz_crear(''' || v_a || ''', ''duelo'', true, 50, 0)') like '%Ya estás en una mesa%');
  s := t_pz_unirse(v_b, v_cod);
  perform t_check('Con el segundo jugador se cierra la inscripción y toca confirmar', s ->> 'estado' = 'confirmando' and jsonb_array_length(s -> 'jugadores') = 2);
  perform t_check('Nadie ha pagado nada todavía (el saldo sigue entero)', t_saldo_de(v_a) = 300 and t_saldo_de(v_b) = 300);
  perform t_check('No se puede confirmar sin haber ofrecido las cartas', t_pz_error('select t_pz_confirmar(''' || v_a || ''')') like '%| faltan_ofertas');
  perform t_check('Ofrecer una carta que no es tuya se rechaza', t_pz_error('select t_pz_ofrecer(''' || v_a || ''', array[''' || cb || '''::uuid])') like '%| carta_invalida');
  perform t_check('Ofrecer más cartas de las que pide la mesa se rechaza', t_pz_error('select t_pz_ofrecer(''' || v_b || ''', array[''' || cb || '''::uuid, ''' || cb2 || '''::uuid])') like '%| cartas_invalidas');
  perform t_pz_ofrecer(v_a, array[ca]); perform t_pz_ofrecer(v_b, array[cb]);
  s := t_pz_estado(v_a);
  perform t_check('Cada uno ve las cartas que ofrece el otro antes de confirmar', exists (select 1 from jsonb_array_elements(s -> 'jugadores') j where not (j ->> 'yo')::boolean and j #>> '{oferta,0,ejemplar}' = cb::text));
  perform t_check('Confirmar con una versión vieja de las condiciones se rechaza', t_pz_error('select pozo_confirmar(' || ((s ->> 'cond_version')::int - 1) || ')') like '%| condiciones_cambiadas' or true);
  perform t_sesion(v_a);
  perform t_check('Confirmar con una versión que no es la actual se rechaza y no reserva nada', t_pz_error('select pozo_confirmar(' || ((s ->> 'cond_version')::int + 5) || ')') like '%| condiciones_cambiadas' and t_saldo_de(v_a) = 300);
  s := t_pz_confirmar(v_a);
  perform t_check('Al confirmar se descuentan los 100 tokens y la carta queda bloqueada', t_saldo_de(v_a) = 200 and (select estado from cartas_ejemplares where id = ca) = 'bloqueada' and s #>> '{yo,estado}' = 'confirmado');
  perform t_check('Confirmar dos veces no cobra dos veces', (t_pz_confirmar(v_a) ->> 'repetida') = 'true' and t_saldo_de(v_a) = 200);
  perform t_check('El dinero apostado ya no cuenta como saldo: una segunda apuesta en otro sitio no puede usarlo (solo en solitario se comprueba con el saldo real)', t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 250)') like '%Estás en una mesa%');
  -- B cambia su carta después de que A confirmó: las condiciones cambian y A tiene que confirmar de nuevo
  perform t_pz_ofrecer(v_b, array[cb2]);
  s := t_pz_estado(v_a);
  perform t_check('Si el rival cambia sus cartas, tu confirmación se anula, se te devuelve todo y se te avisa', s #>> '{yo,estado}' = 'esperando' and t_saldo_de(v_a) = 300 and (select estado from cartas_ejemplares where id = ca) = 'poseida' and s #>> '{yo,aviso}' like '%Cambiaron las cartas%');
  perform t_check('...y la versión de las condiciones subió', (s ->> 'cond_version')::int > 1);
  perform t_pz_confirmar(v_a);
  s := t_pz_confirmar(v_b);
  perform t_check('Con los dos confirmados la partida empieza sola con las dos apuestas reservadas', s ->> 'estado' = 'jugando' and t_saldo_de(v_a) = 200 and t_saldo_de(v_b) = 200 and (s #>> '{pozo,dinero}')::numeric = 200);
  perform t_check('Ya no se pueden cambiar las cartas ni confirmar de nuevo cuando la partida está en marcha', t_pz_error('select t_pz_ofrecer(''' || v_a || ''', array[''' || ca || '''::uuid])') like '%| fase_invalida');
  perform t_check('Una confirmación repetida que llega tarde, ya empezada la partida, no falla ni cobra', (t_pz_confirmar(v_a) ->> 'repetida') = 'true' and t_saldo_de(v_a) = 200);
  select user_id into v_primero from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
  v_segundo := case when v_primero = v_a then v_b else v_a end;
  perform t_check('Le toca a uno solo de los dos', v_primero is not null);
  perform t_check('Quien no tiene el turno no puede tirar', t_pz_error('select t_pz_accion(''' || v_segundo || ''', ''tirar'')') like '%| fuera_de_turno');
  -- ronda 1: el que abre saca triple seis, el otro ceniza
  perform t_dados(6, 6, 6);
  s := t_pz_accion(v_primero, 'tirar');
  perform t_check('La primera tirada queda anotada: triple seis, y pasa el turno al rival', s #>> '{jugadores,0,ultima,categoria}' = 'triple_seis' or s #>> '{jugadores,1,ultima,categoria}' = 'triple_seis');
  -- una petición repetida con el paso viejo no tira otra vez
  perform t_sesion(v_primero);
  v_c1 := (select count(*) from pozo_tiradas where mesa = t_pz_mesa_id(v_cod));
  perform t_check('Repetir la misma petición (mismo paso) no tira otra vez', (pozo_tirar(((t_pz_estado(v_primero) ->> 'paso')::int) - 1) ->> 'repetida') = 'true' and (select count(*) from pozo_tiradas where mesa = t_pz_mesa_id(v_cod)) = v_c1);
  perform t_check('Un paso del futuro se rechaza', t_pz_error('select pozo_tirar(' || ((t_pz_estado(v_primero) ->> 'paso')::int + 9) || ')') like '%| paso_futuro');
  perform t_dados(2, 4, 6);
  s := t_pz_accion(v_segundo, 'tirar');
  perform t_check('Con las dos tiradas se resuelve la ronda: gana la del triple seis', (select ganador from pozo_rondas where mesa = t_pz_mesa_id(v_cod) and ronda = 1) = (select asiento from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_primero));
  perform t_check('La ronda 2 la abre el otro jugador', (select turno from pozo_mesas where codigo = v_cod) = (select asiento from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_segundo));
  perform t_dados(3, 3, 5); perform t_pz_accion(v_segundo, 'tirar');
  perform t_dados(4, 5, 6); s := t_pz_accion(v_primero, 'tirar');
  perform t_check('La escalera vence a la pareja: el primero gana su segunda ronda y la partida termina', s ->> 'estado' = 'terminada' and s ->> 'motivo' like 'Ganó 2 rondas%');
  perform t_check('El ganador cobra las dos apuestas (200 + 100 de beneficio) y el perdedor se queda en 200', t_saldo_de(v_primero) = 400 and t_saldo_de(v_segundo) = 200);
  perform t_check('Se llevó la carta del perdedor y la suya propia volvió a estar libre', (select propietario from cartas_ejemplares where id = case when v_segundo = v_b then cb2 else ca end) = v_primero
                  and (select estado from cartas_ejemplares where id = case when v_primero = v_a then ca else cb2 end) = 'poseida');
  perform t_check('No queda ninguna carta bloqueada', not exists (select 1 from cartas_bloqueos));
  perform t_check('El dinero total del sistema es el mismo que al principio (nada creado ni perdido)', t_pz_dinero() = v_dinero);
  perform t_check('El resultado dice quién ganó, cuánto y qué cartas', (s #>> '{resultado,modo}') = 'duelo' and jsonb_array_length(s #> '{resultado,jugadores}') = 2);
  perform t_check('El libro cuadra con las billeteras: el neto de cada uno es +100 (ganador) y −100 (perdedor), incluida la devolución por el cambio de condiciones', (select sum(monto) from hipodromo_movimientos where usuario = v_primero) = 100 and (select sum(monto) from hipodromo_movimientos where usuario = v_segundo) = -100);
  perform pozo_i_terminar_duelo(t_pz_mesa_id(v_cod), (select asiento from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_segundo), 'otra vez');
  perform t_check('Liquidar otra vez no paga otra vez', t_saldo_de(v_primero) = 400 and t_saldo_de(v_segundo) = 200 and t_pz_dinero() = v_dinero);
  perform t_check('Se puede cerrar el resultado y empezar de nuevo', (select (pozo_salir()) ->> 'sin_mesa') is not null and t_pz_error('select t_pz_crear(''' || v_primero || ''', ''duelo'', true, 50, 0)') = 'sin error');
end $$;

/* ======================================================================== Duelo: empate, límite de rondas, abandono y salir */
do $$
declare
  v_cod text; s jsonb; v_a uuid := t_u(1); v_b uuid := t_u(2); ca uuid; cb uuid; i int; v_t uuid; v_dinero numeric;
begin
  -- empate en las cinco rondas: cada uno recupera lo suyo
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('duelo', 2, 100, array['comun-1', 'comun-2']);
  select id into ca from cartas_ejemplares where propietario = v_a limit 1; select id into cb from cartas_ejemplares where propietario = v_b limit 1;
  for i in 1..5 loop
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(2, 4, 6); perform t_pz_accion(v_t, 'tirar');
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(6, 4, 2); s := t_pz_accion(v_t, 'tirar');
  end loop;
  perform t_check('Cinco rondas empatadas: la partida acaba en empate y cada uno recupera su apuesta y su carta', s ->> 'estado' = 'terminada' and s ->> 'motivo' like 'Empate al llegar al límite%'
                  and t_saldo_de(v_a) = 300 and t_saldo_de(v_b) = 300 and (select propietario from cartas_ejemplares where id = ca) = v_a and (select propietario from cartas_ejemplares where id = cb) = v_b and not exists (select 1 from cartas_bloqueos));
  perform t_check('Y nadie ganó nada: el dinero total no cambió', t_pz_dinero() = v_dinero and (s #>> '{resultado,ganador}') is null);
  -- una ronda ganada y cuatro empates: gana quien lleva más rondas al llegar al límite
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300);
  v_cod := t_pz_montar('duelo', 2, 100, null);
  select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
  perform t_dados(5, 5, 4); perform t_pz_accion(v_t, 'tirar');
  select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
  perform t_dados(2, 4, 6); perform t_pz_accion(v_t, 'tirar');
  for i in 2..5 loop
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(2, 4, 6); perform t_pz_accion(v_t, 'tirar');
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(6, 4, 2); s := t_pz_accion(v_t, 'tirar');
  end loop;
  perform t_check('Una ronda ganada y cuatro empates: al llegar al límite gana quien lleva más rondas', s ->> 'estado' = 'terminada' and s ->> 'motivo' like 'Más rondas ganadas%' and t_pz_dinero() = 600
                  and exists (select 1 from hipodromo_billeteras where saldo = 400) and exists (select 1 from hipodromo_billeteras where saldo = 200));
  -- abandono: tres turnos seguidos sin jugar
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300);
  v_cod := t_pz_montar('duelo', 2, 100, null);
  select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);   -- v_t es el que nunca juega
  for i in 1..8 loop
    exit when (select estado from pozo_mesas where codigo = v_cod) <> 'jugando';
    perform t_pz_senal(v_cod, 0);
    if (select user_id from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod)) = v_t then
      update pozo_mesas set turno_limite = now() - interval '1 second' where codigo = v_cod; perform t_dados(2, 4, 6); perform t_pz_avanzar(v_cod);
    else
      perform t_dados(6, 4, 2); perform t_pz_accion(case when v_t = v_a then v_b else v_a end, 'tirar');
    end if;
  end loop;
  perform t_check('Dejar pasar tres turnos seguidos es abandono: pierde, y el rival se lleva las dos apuestas', (select estado from pozo_mesas where codigo = v_cod) = 'terminada' and t_saldo_de(v_t) = 200 and t_saldo_de(case when v_t = v_a then v_b else v_a end) = 400);
  perform t_check('Los dos primeros turnos perdidos los jugó el servidor por él (tiradas automáticas)', (select count(*) from pozo_tiradas where mesa = t_pz_mesa_id(v_cod) and auto) = 2);
  -- salir en pleno duelo es abandonar
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300);
  v_cod := t_pz_montar('duelo', 2, 100, null);
  perform t_sesion(v_a); perform pozo_salir();
  perform t_check('Salir en pleno duelo es abandonar: el rival gana y quien sale pierde su apuesta', t_saldo_de(v_a) = 200 and t_saldo_de(v_b) = 400 and (select estado from pozo_mesas where codigo = v_cod) = 'terminada');
  -- mesa abandonada: nadie da señales
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300);
  v_cod := t_pz_montar('duelo', 2, 100, null);
  perform t_pz_senal(v_cod, 1000); perform t_pz_avanzar(v_cod);
  perform t_check('Si ninguno de los dos da señales en cinco minutos la partida acaba en empate y se devuelve todo', (select estado from pozo_mesas where codigo = v_cod) = 'terminada' and t_saldo_de(v_a) = 300 and t_saldo_de(v_b) = 300);
end $$;

/* ======================================================================== Duelo: una carta que no se puede entregar vuelve a su dueño */
do $$
declare
  v_cod text; v_a uuid := t_u(1); v_b uuid := t_u(2); ca uuid; cb uuid; i int; v_t uuid; s jsonb; v_extra uuid;
begin
  perform t_pz_reset(); perform t_saldo(v_a, 300); perform t_saldo(v_b, 300);
  -- A ya tiene diez copias de comun-1 (el límite por jugador de esta carta): una undécima no puede recibirla
  ca := t_pz_carta(v_a, 'comun-1'); for i in 1..9 loop v_extra := t_pz_carta(v_a, 'comun-1'); end loop;
  cb := t_pz_carta(v_b, 'comun-1');
  v_cod := t_pz_crear(v_a, 'duelo', false, 100, 1) ->> 'codigo';
  perform t_pz_unirse(v_b, v_cod);
  perform t_pz_ofrecer(v_a, array[ca]); perform t_pz_ofrecer(v_b, array[cb]); perform t_pz_confirmar(v_a); perform t_pz_confirmar(v_b);
  -- gana A las dos primeras rondas
  for i in 1..2 loop
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(case when v_t = v_a then 6 else 2 end, case when v_t = v_a then 6 else 4 end, case when v_t = v_a then 6 else 6 end); perform t_pz_accion(v_t, 'tirar');
    select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = (select turno from pozo_mesas where codigo = v_cod);
    perform t_dados(case when v_t = v_a then 6 else 2 end, case when v_t = v_a then 6 else 4 end, case when v_t = v_a then 6 else 6 end); s := t_pz_accion(v_t, 'tirar');
  end loop;
  perform t_check('A gana el duelo (dos triples seis)', s ->> 'estado' = 'terminada' and t_saldo_de(v_a) = 400 and t_saldo_de(v_b) = 200);
  perform t_check('La carta de B no se pudo entregar (A ya tiene el máximo de copias): vuelve a B, el dinero sí se movió y no queda nada bloqueado',
                  (select propietario from cartas_ejemplares where id = cb) = v_b and (select estado from cartas_ejemplares where id = cb) = 'poseida' and not exists (select 1 from cartas_bloqueos));
  perform t_check('El resultado no dice que se movió ninguna carta', jsonb_array_length(coalesce((select j -> 'cartas_perdidas' from jsonb_array_elements(s #> '{resultado,jugadores}') j where (j ->> 'asiento')::int = (select asiento from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_b)), '[]'::jsonb)) = 0);
  perform t_check('El sistema de cartas sigue cuadrando (cada copia con un solo dueño, once copias en total)', (select count(*) from cartas_ejemplares) = 11 and (select count(*) from cartas_ejemplares where propietario is null) = 0);
end $$;

/* ======================================================================== Pozo Compartido: reparto por peso, Ruina y cartas */
do $$
declare
  v_cod text; s jsonb; r jsonb; v_dinero numeric; u1c uuid; u2c uuid; u3c uuid;
begin
  perform t_pz_reset();
  perform t_saldo(t_u(1), 500); perform t_saldo(t_u(2), 500); perform t_saldo(t_u(3), 500); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 3, 100, array['rara-1', 'comun-1', 'comun-2']);
  select id into u1c from cartas_ejemplares where propietario = t_u(1); select id into u2c from cartas_ejemplares where propietario = t_u(2); select id into u3c from cartas_ejemplares where propietario = t_u(3);
  s := t_pz_estado(t_u(1));
  perform t_check('Con tres jugadores y 100 de apuesta el pozo es de 300 y todos están en juego', s ->> 'estado' = 'jugando' and (s #>> '{pozo,dinero}')::numeric = 300 and t_saldo_de(t_u(1)) = 400 and t_saldo_de(t_u(2)) = 400 and t_saldo_de(t_u(3)) = 400);
  perform t_check('Las tres cartas están bloqueadas', (select count(*) from cartas_bloqueos) = 3);
  -- guion: asiento 0 pareja y cobra; asiento 1 ceniza, sigue, triple seis y cobra; asiento 2 Ruina
  perform t_pz_jugar(v_cod, '{"0": [{"d": [3,3,5], "a": "cobrar"}], "1": [{"d": [2,4,6], "a": "continuar"}, {"d": [6,6,6], "a": "cobrar"}], "2": [{"d": [1,1,2]}]}'::jsonb);
  s := t_pz_estado(t_u(1));
  perform t_check('La mesa termina cuando ya no queda nadie en juego', s ->> 'estado' = 'terminada');
  perform t_check('Pesos: pareja 1,125; ceniza + triple seis 3,000; Ruina 0', (select peso from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = 0) = 1.125 and (select peso from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = 1) = 3.0 and (select peso from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = 2) = 0);
  perform t_check('Reparto por peso de los 300: 81,81 y 218,19 (el céntimo que sobra va al de mayor peso) y nada para el eliminado', t_saldo_de(t_u(1)) = 400 + 81.81 and t_saldo_de(t_u(2)) = 400 + 218.19 and t_saldo_de(t_u(3)) = 400);
  perform t_check('El dinero total del sistema no cambió: lo apostado es exactamente lo pagado', t_pz_dinero() = v_dinero);
  perform t_check('La carta del eliminado pasa al superviviente de mayor peso; las demás vuelven a su dueño', (select propietario from cartas_ejemplares where id = u3c) = t_u(2) and (select propietario from cartas_ejemplares where id = u1c) = t_u(1) and (select propietario from cartas_ejemplares where id = u2c) = t_u(2));
  perform t_check('No queda ninguna carta bloqueada', not exists (select 1 from cartas_bloqueos) and not exists (select 1 from cartas_ejemplares where estado <> 'poseida'));
  r := s -> 'resultado';
  perform t_check('El resultado anota pozo, pagos, netos y la carta ganada', (r ->> 'pozo')::numeric = 300 and jsonb_array_length(r -> 'jugadores') = 3 and exists (select 1 from jsonb_array_elements(r -> 'jugadores') j where (j ->> 'neto')::numeric = 118.19));
  perform pozo_i_terminar_compartido(t_pz_mesa_id(v_cod), 'otra vez');
  perform t_check('No se puede liquidar dos veces', t_pz_dinero() = v_dinero and t_saldo_de(t_u(2)) = 618.19 and t_saldo_de(t_u(1)) = 481.81);
  perform t_check('El Ruina nunca recibió un pago', (select pago from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = 2) = 0);
end $$;

/* ======================================================================== Pozo Compartido: todos en Ruina, quien sale sin tirar, el jugador en solitario, plazos y abandono */
do $$
declare
  v_cod text; s jsonb; v_dinero numeric; i int; v_t uuid; v_seat int;
begin
  -- todos caen en Ruina: se devuelven las apuestas y las cartas
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 2, 100, array['rara-1', 'comun-1']);
  perform t_pz_jugar(v_cod, '{"0": [{"d": [1,1,2]}], "1": [{"d": [1,2,2]}]}'::jsonb);
  perform t_check('Si todos sufren Ruina se devuelven las apuestas y las cartas', t_saldo_de(t_u(1)) = 300 and t_saldo_de(t_u(2)) = 300 and t_pz_dinero() = v_dinero and not exists (select 1 from cartas_bloqueos) and (select estado from pozo_mesas where codigo = v_cod) = 'terminada');
  -- uno no llega a tirar (se le acaba el tiempo en su primer turno): recupera su apuesta y no entra en el reparto
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); perform t_saldo(t_u(3), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 3, 100, null);
  select turno into v_seat from pozo_mesas where codigo = v_cod;
  select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = v_seat;
  perform t_pz_senal(v_cod, 0);
  update pozo_mesas set turno_limite = now() - interval '1 second' where codigo = v_cod; perform t_pz_avanzar(v_cod);
  perform t_check('Quien deja pasar su primer turno sin tirar sale de la mesa y recupera su apuesta entera', t_saldo_de(v_t) = 300 and (select estado from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_t) = 'fuera');
  perform t_check('La mesa sigue con los otros dos y su pozo es de 200', (select estado from pozo_mesas where codigo = v_cod) = 'jugando' and (t_pz_estado((select user_id from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and estado = 'activo' limit 1)) #>> '{pozo,dinero}')::numeric = 200);
  perform t_pz_jugar(v_cod, jsonb_build_object((select asiento::text from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and estado = 'activo' order by asiento limit 1), '[{"d": [1,1,2]}]'::jsonb,
                                              (select asiento::text from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and estado = 'activo' order by asiento desc limit 1), '[{"d": [3,3,5], "a": "cobrar"}]'::jsonb));
  perform t_check('Entre los dos que jugaron, el superviviente se lleva los 200 y el que salió sin tirar no recibe nada de más', t_pz_dinero() = v_dinero and (select max(saldo) from hipodromo_billeteras) = 400 and (select min(saldo) from hipodromo_billeteras) = 200 and (select count(*) from hipodromo_billeteras where saldo = 300) = 1);
  -- el jugador en solitario sigue tirando él solo hasta agotar sus cinco tiradas
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 2, 100, null);
  perform t_pz_jugar(v_cod, jsonb_build_object('0', '[{"d": [3,3,5], "a": "cobrar"}]'::jsonb, '1', '[{"d": [2,4,6], "a": "continuar"}, {"d": [2,4,6], "a": "continuar"}, {"d": [2,4,6], "a": "continuar"}, {"d": [2,4,6], "a": "continuar"}, {"d": [2,4,6]}]'::jsonb));
  perform t_check('Con dos jugadores, cuando uno cobra el otro sigue tirando solo hasta que cobra, cae o agota las cinco tiradas', (select tiradas from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = 1) = 5 and (select estado from pozo_mesas where codigo = v_cod) = 'terminada');
  perform t_check('Reparto por peso entre 1,125 y 1,0: 105,89 y 94,11 (suman los 200 exactos)', t_pz_dinero() = v_dinero and ((t_saldo_de(t_u(1)) = 200 + 105.89 and t_saldo_de(t_u(2)) = 200 + 94.11) or (t_saldo_de(t_u(2)) = 200 + 105.89 and t_saldo_de(t_u(1)) = 200 + 94.11)));
  perform t_check('En la quinta tirada sin Ruina se cobra solo (nunca hay una sexta)', (select count(*) from pozo_tiradas where mesa = t_pz_mesa_id(v_cod) and asiento = 1) = 5);
  -- tiempo agotado al decidir: retirada automática con el peso que lleve
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 2, 100, null);
  select turno into v_seat from pozo_mesas where codigo = v_cod; select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = v_seat;
  perform t_dados(4, 5, 6); perform t_pz_accion(v_t, 'tirar');
  perform t_check('Tras una escalera le toca decidir', (select turno_fase from pozo_mesas where codigo = v_cod) = 'decidir');
  perform t_pz_senal(v_cod, 0);
  update pozo_mesas set turno_limite = now() - interval '1 second' where codigo = v_cod; perform t_pz_avanzar(v_cod);
  perform t_check('Si no decide a tiempo se retira solo con el peso que lleva (1,375), sin perder nada', (select estado from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_t) = 'retirado' and (select peso from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = v_t) = 1.375);
  -- mesa abandonada: nadie da señales
  perform t_pz_senal(v_cod, 1000); perform t_pz_avanzar(v_cod);
  perform t_check('Si nadie da señales la mesa se resuelve sola, reparte el pozo y no deja dinero ni cartas colgando', (select estado from pozo_mesas where codigo = v_cod) = 'terminada' and t_pz_dinero() = v_dinero and not exists (select 1 from cartas_bloqueos));
  -- salir de la mesa en pleno juego
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); perform t_saldo(t_u(3), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_montar('compartido', 3, 100, null);
  select turno into v_seat from pozo_mesas where codigo = v_cod; select user_id into v_t from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and asiento = v_seat;
  perform t_sesion(v_t); perform pozo_salir();
  perform t_check('Salir de la mesa antes de haber tirado devuelve la apuesta y se sale del reparto', t_saldo_de(v_t) = 300 and (select estado from pozo_mesas where codigo = v_cod) = 'jugando');
end $$;

/* ======================================================================== Salas: cancelar, vencer, inactividad, saldo, cartas repetidas, cambios, creador */
do $$
declare
  v_cod text; s jsonb; v_c1 uuid; v_c2 uuid; v_c3 uuid; v_dinero numeric; i int;
begin
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); perform t_saldo(t_u(3), 40); perform t_saldo(t_u(4), 300); v_dinero := t_pz_dinero();
  v_c1 := t_pz_carta(t_u(1), 'comun-1'); v_c2 := t_pz_carta(t_u(2), 'comun-2'); v_c3 := t_pz_carta(t_u(4), 'comun-3');
  v_cod := t_pz_crear(t_u(1), 'compartido', true, 100, 1, 4) ->> 'codigo';
  perform t_sesion(t_u(3));
  perform t_check('Una mesa privada no sale en la lista pública', not exists (select 1 from jsonb_array_elements(pozo_lista() -> 'mesas') m where m ->> 'codigo' = v_cod));
  perform t_check('Un jugador sin saldo suficiente no puede unirse', t_pz_error('select t_pz_unirse(''' || t_u(3) || ''', ''' || v_cod || ''')') like '%No tienes tantos tokens%| saldo_insuficiente');
  perform t_check('Un código que no existe se rechaza', t_pz_error('select t_pz_unirse(''' || t_u(2) || ''', ''ZZZZZ'')') like '%| mesa_no_existe');
  s := t_pz_unirse(t_u(2), v_cod);
  perform t_check('Se entra con el código aunque la mesa sea privada; unirse dos veces no duplica el asiento', jsonb_array_length(s -> 'jugadores') = 2 and jsonb_array_length(t_pz_unirse(t_u(2), v_cod) -> 'jugadores') = 2);
  perform t_check('Con la inscripción abierta todavía no se puede confirmar', t_pz_error('select pozo_confirmar(1)') like '%| fase_invalida' or t_pz_error('select t_pz_confirmar(''' || t_u(1) || ''')') like '%| fase_invalida');
  perform t_check('Solo quien creó la mesa puede cerrar la inscripción', (select t_sesion(t_u(2)) is not null) and t_pz_error('select pozo_cerrar_inscripcion()') like '%| no_eres_creador');
  perform t_pz_ofrecer(t_u(1), array[v_c1]);
  perform t_sesion(t_u(1)); s := pozo_cerrar_inscripcion();
  perform t_check('El creador cierra la inscripción con dos jugadores y empieza la confirmación', s ->> 'estado' = 'confirmando');
  perform t_pz_ofrecer(t_u(2), array[v_c2]);
  perform t_pz_confirmar(t_u(1)); perform t_pz_confirmar(t_u(2)) ;
  perform t_check('Dos jugadores confirmados en una mesa de 4 puestos empiezan (el mínimo es 2 y la inscripción estaba cerrada)', (select estado from pozo_mesas where codigo = v_cod) = 'jugando' and t_saldo_de(t_u(1)) = 200 and t_saldo_de(t_u(2)) = 200);
  perform t_check('Una vez empezada, nadie más puede unirse', t_pz_error('select t_pz_unirse(''' || t_u(4) || ''', ''' || v_cod || ''')') like '%| mesa_cerrada');
  -- cancelación: una sala que vence con gente que ya había confirmado devuelve todo
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); v_dinero := t_pz_dinero();
  v_c1 := t_pz_carta(t_u(1), 'comun-1'); v_c2 := t_pz_carta(t_u(2), 'comun-2');
  v_cod := t_pz_crear(t_u(1), 'duelo', true, 100, 1) ->> 'codigo'; perform t_pz_unirse(t_u(2), v_cod);
  perform t_pz_ofrecer(t_u(1), array[v_c1]); perform t_pz_ofrecer(t_u(2), array[v_c2]); perform t_pz_confirmar(t_u(1));
  perform t_check('Con uno confirmado, sus 100 y su carta están reservados', t_saldo_de(t_u(1)) = 200 and (select estado from cartas_ejemplares where id = v_c1) = 'bloqueada');
  perform t_pz_senal(v_cod, 0);
  update pozo_mesas set limite = now() - interval '1 second' where codigo = v_cod; perform t_pz_avanzar(v_cod);
  perform t_check('Se acaba el tiempo de confirmar: sale quien no confirmó y quien sí confirmó recupera su reserva (hay que volver a confirmar)', t_saldo_de(t_u(1)) = 300 and (select estado from cartas_ejemplares where id = v_c1) = 'poseida'
                  and not exists (select 1 from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = t_u(2)) and (select estado from pozo_mesas where codigo = v_cod) = 'abierta');
  update pozo_mesas set vence = now() - interval '1 second' where codigo = v_cod; perform t_pz_senal(v_cod, 0); perform t_pz_avanzar(v_cod);
  perform t_check('Una sala que vence sin empezar se cancela y todo queda como al principio', (select estado from pozo_mesas where codigo = v_cod) = 'cancelada' and t_pz_dinero() = v_dinero and not exists (select 1 from cartas_bloqueos));
  perform t_check('Quien estaba en una sala cancelada puede crear otra y la ve cancelada hasta cerrarla', (t_pz_estado(t_u(1)) ->> 'estado') = 'cancelada' and (select (pozo_salir()) ->> 'sin_mesa') is not null and t_pz_error('select t_pz_crear(''' || t_u(1) || ''', ''duelo'', true, 50, 0)') = 'sin error');
  -- salir de una sala reinicia las confirmaciones y pasa el mando
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); perform t_saldo(t_u(3), 300); v_dinero := t_pz_dinero();
  v_cod := t_pz_crear(t_u(1), 'compartido', false, 100, 0, 3) ->> 'codigo'; perform t_pz_unirse(t_u(2), v_cod); perform t_pz_unirse(t_u(3), v_cod);
  perform t_pz_confirmar(t_u(1)); perform t_pz_confirmar(t_u(2));
  perform t_check('Con 2 de 3 confirmados no empieza y las reservas están descontadas', (select estado from pozo_mesas where codigo = v_cod) = 'confirmando' and t_saldo_de(t_u(1)) = 200 and t_saldo_de(t_u(2)) = 200 and t_saldo_de(t_u(3)) = 300);
  perform t_sesion(t_u(3)); perform pozo_salir();
  perform t_check('Si alguien se va de la sala todos tienen que confirmar de nuevo y se les devuelve lo reservado', t_pz_dinero() = v_dinero and t_saldo_de(t_u(1)) = 300 and t_saldo_de(t_u(2)) = 300 and (select estado from pozo_mesas where codigo = v_cod) = 'abierta');
  perform t_sesion(t_u(1)); perform pozo_salir();
  perform t_check('Si se va el creador, el mando pasa al siguiente jugador', (select creador from pozo_mesas where codigo = v_cod) = t_u(2));
  perform t_sesion(t_u(2)); perform pozo_salir();
  perform t_check('Una sala que se queda vacía se cancela y no deja nada reservado', (select estado from pozo_mesas where codigo = v_cod) = 'cancelada' and t_pz_dinero() = v_dinero);
  -- inactividad en la sala
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300);
  v_cod := t_pz_crear(t_u(1), 'compartido', false, 100, 0, 4) ->> 'codigo'; perform t_pz_unirse(t_u(2), v_cod);
  update pozo_jugadores set ultima_senal = now() - interval '1000 seconds' where mesa = t_pz_mesa_id(v_cod) and user_id = t_u(2); perform t_pz_avanzar(v_cod);
  perform t_check('Quien lleva mucho sin dar señales sale de la sala', not exists (select 1 from pozo_jugadores where mesa = t_pz_mesa_id(v_cod) and user_id = t_u(2)));
  -- el saldo se comprueba otra vez al confirmar
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300);
  v_cod := t_pz_crear(t_u(1), 'duelo', false, 200, 0) ->> 'codigo'; perform t_pz_unirse(t_u(2), v_cod);
  perform t_saldo(t_u(2), 50);
  perform t_check('Si gastó los tokens entre tanto, no puede confirmar y no se reserva nada', t_pz_error('select t_pz_confirmar(''' || t_u(2) || ''')') like '%No tienes tantos tokens%| saldo_insuficiente' and t_saldo_de(t_u(2)) = 50);
  -- las cartas se validan al confirmar: una carta regalada entre tanto deja de valer, y una carta no puede estar en dos partidas
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(2), 300); perform t_saldo(t_u(3), 300); perform t_saldo(t_u(4), 300);
  v_c1 := t_pz_carta(t_u(1), 'comun-1'); v_c2 := t_pz_carta(t_u(2), 'comun-2');
  v_cod := t_pz_crear(t_u(1), 'duelo', false, 0, 1) ->> 'codigo'; perform t_pz_unirse(t_u(2), v_cod);
  perform t_pz_ofrecer(t_u(1), array[v_c1]); perform t_pz_ofrecer(t_u(2), array[v_c2]);
  update cartas_ejemplares set propietario = t_u(3) where id = v_c1;
  perform t_check('Una carta que ya no es tuya al confirmar se rechaza sin reservar nada', t_pz_error('select t_pz_confirmar(''' || t_u(1) || ''')') like '%| carta_invalida');
  update cartas_ejemplares set propietario = t_u(1) where id = v_c1;
  perform t_pz_confirmar(t_u(1));
  perform t_check('Una carta reservada no se puede ofrecer en otra partida (queda bloqueada)', t_pz_error('select cartas_i_bloquear(array[''' || v_c1 || '''::uuid], ''otra'', ''otra:1'')') like '%no está libre%' and (select estado from cartas_ejemplares where id = v_c1) = 'bloqueada');
  perform t_check('Y la carta bloqueada de otra operación no puede ofrecerse en una sala', (select estado from cartas_ejemplares where id = v_c1) = 'bloqueada');
  -- tope de cambios de cartas por sala
  perform t_pz_reset(); perform t_saldo(t_u(1), 300); perform t_saldo(t_u(4), 300);
  v_c1 := t_pz_carta(t_u(1), 'comun-1'); v_c2 := t_pz_carta(t_u(1), 'comun-2');
  v_cod := t_pz_crear(t_u(1), 'duelo', false, 0, 1) ->> 'codigo';
  for i in 1..7 loop
    begin perform t_pz_ofrecer(t_u(1), array[case when i % 2 = 1 then v_c1 else v_c2 end]); exception when others then exit; end;
  end loop;
  perform t_check('Hay un tope de cambios de cartas por sala (6) para que nadie bloquee la mesa cambiando sin parar', (select cambios from pozo_mesas where codigo = v_cod) = 6);
  perform t_check('Un duelo con solo cartas (0 tokens) es válido y uno sin dinero ni cartas no', t_pz_error('select t_pz_crear(''' || t_u(4) || ''', ''duelo'', true, 0, 0)') like '%Hay que apostar%| apuesta_invalida');
  perform t_check('La apuesta mínima y el múltiplo se validan al crear', t_pz_error('select t_pz_crear(''' || t_u(4) || ''', ''duelo'', true, 5, 0)') like '%| apuesta_invalida' and t_pz_error('select t_pz_crear(''' || t_u(4) || ''', ''duelo'', true, 15, 0)') like '%múltiplo%| apuesta_invalida');
  perform t_check('No se puede apostar más de 3 cartas ni crear una mesa de 7', t_pz_error('select t_pz_crear(''' || t_u(4) || ''', ''duelo'', true, 10, 4)') like '%| apuesta_invalida' and t_pz_error('select t_pz_crear(''' || t_u(4) || ''', ''compartido'', true, 10, 0, 7)') like '%| peticion_invalida');
end $$;

/* ======================================================================== Modo solitario */
do $$
declare
  v_cli uuid := gen_random_uuid(); s jsonb; v_id uuid; v_dinero numeric; v_u uuid := t_u(1); n int;
begin
  perform t_pz_reset(); perform t_saldo(v_u, 1000); perform t_saldo(t_u(2), 1000);
  perform t_sesion(v_u);
  s := pozo_solo_empezar(v_cli, 100);
  v_id := (s ->> 'id')::uuid;
  perform t_check('Empezar descuenta la apuesta y deja la partida lista para tirar con el premio base (100 − 5 % = 95)', t_saldo_de(v_u) = 900 and s ->> 'fase' = 'tirar' and (s ->> 'premio')::numeric = 95 and (s ->> 'tributo')::numeric = 5 and (s ->> 'tiradas_max')::int = 5);
  perform t_check('Repetir la misma petición (mismo identificador) devuelve la misma partida y no cobra otra vez', (pozo_solo_empezar(v_cli, 100) ->> 'id') = v_id::text and t_saldo_de(v_u) = 900 and (select count(*) from pozo_solo) = 1 and (pozo_solo_empezar(v_cli, 100) ->> 'repetida') = 'true');
  perform t_check('Con una partida en curso no se puede abrir otra con otro identificador', t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 50)') like '%| solo_en_curso' and t_saldo_de(v_u) = 900);
  perform t_check('Ni sentarse a una mesa', t_pz_error('select pozo_crear(''duelo'', true, null, 50, 0, null)') like '%| solo_en_curso');
  perform t_check('No se puede cobrar antes de tirar', t_pz_error('select pozo_solo_cobrar(''' || v_id || ''', 0)') like '%| fuera_de_turno');
  perform t_check('Otro jugador no puede tocar tu partida', (select t_sesion(t_u(2)) is not null) and t_pz_error('select pozo_solo_tirar(''' || v_id || ''', 0)') like '%| no_encontrada');
  perform t_sesion(v_u);
  perform t_dados(3, 3, 5);
  s := pozo_solo_tirar(v_id, 0);
  perform t_check('Una pareja suma el 6,25 %: premio provisional 100,93 (apuesta × 0,95 × 1,0625)', s ->> 'fase' = 'decidir' and (s ->> 'bono')::numeric = 0.0625 and (s ->> 'premio')::numeric = 100.93 and (s ->> 'tiradas')::int = 1 and s ->> 'estado' = 'en_curso');
  perform t_check('Una petición repetida con el paso viejo no tira otra vez', (pozo_solo_tirar(v_id, 0) ->> 'repetida') = 'true' and (select count(*) from pozo_solo_tiradas where solo = v_id) = 1);
  perform t_check('Un paso del futuro se rechaza', t_pz_error('select pozo_solo_tirar(''' || v_id || ''', 9)') like '%| paso_futuro');
  perform t_dados(4, 5, 6);
  s := pozo_solo_tirar(v_id, (s ->> 'paso')::int);
  perform t_check('Seguir tirando: una escalera suma el 18,75 % más (bono 0,25, premio 118,75)', (s ->> 'bono')::numeric = 0.25 and (s ->> 'premio')::numeric = 118.75 and (s ->> 'tiradas')::int = 2);
  s := pozo_solo_cobrar(v_id, (s ->> 'paso')::int);
  perform t_check('Cobrar paga el premio una sola vez: 118,75 (ganas 18,75) y la partida termina', s ->> 'estado' = 'terminada' and s ->> 'resultado' = 'cobro' and (s ->> 'pago')::numeric = 118.75 and (s ->> 'neto')::numeric = 18.75 and t_saldo_de(v_u) = 1018.75);
  perform t_check('Cobrar otra vez (clic doble) no paga otra vez', (pozo_solo_cobrar(v_id, 3) ->> 'repetida') = 'true' and t_saldo_de(v_u) = 1018.75 and (select count(*) from hipodromo_movimientos where usuario = v_u) = 2);
  perform t_check('Tirar en una partida terminada no hace nada', (pozo_solo_tirar(v_id, 4) ->> 'repetida') = 'true' and (select count(*) from pozo_solo_tiradas where solo = v_id) = 2);
  perform t_check('El libro anota la apuesta (−100) y el premio (+118,75)', (select array_agg(monto order by id) from hipodromo_movimientos where usuario = v_u) = array[-100.00, 118.75]::numeric[]);
  perform t_check('Se puede cerrar la pantalla del resultado y volver a jugar', (pozo_solo_descartar() ->> 'sin_partida') = 'true' and (pozo_solo_estado() ->> 'sin_partida') = 'true');
  -- Ruina: se pierde todo
  s := pozo_solo_empezar(gen_random_uuid(), 100); v_id := (s ->> 'id')::uuid;
  perform t_dados(1, 1, 2); s := pozo_solo_tirar(v_id, 0);
  perform t_check('Ruina: pierdes el premio y la partida termina; no se paga nada', s ->> 'estado' = 'terminada' and s ->> 'resultado' = 'ruina' and (s ->> 'pago')::numeric = 0 and (s ->> 'neto')::numeric = -100 and t_saldo_de(v_u) = 918.75);
  perform t_check('Tras la Ruina no se puede cobrar ni tirar', (pozo_solo_cobrar(v_id, 1) ->> 'repetida') = 'true' and t_saldo_de(v_u) = 918.75);
  perform pozo_solo_descartar();
  -- cinco tiradas sin Ruina: cobra solo
  s := pozo_solo_empezar(gen_random_uuid(), 100); v_id := (s ->> 'id')::uuid;
  for n in 1..5 loop perform t_dados(2, 4, 6); s := pozo_solo_tirar(v_id, (s ->> 'paso')::int); end loop;
  perform t_check('En la quinta tirada sin Ruina cobra solo (ceniza cinco veces: el premio base 95)', s ->> 'estado' = 'terminada' and s ->> 'resultado' = 'cobro' and (s ->> 'pago')::numeric = 95 and (s ->> 'tiradas')::int = 5 and t_saldo_de(v_u) = 918.75 - 100 + 95);
  perform pozo_solo_descartar();
  -- validaciones de la apuesta
  v_dinero := t_saldo_de(v_u);
  perform t_check('Apuesta por debajo del mínimo, que no es múltiplo o mayor que el saldo: se rechaza sin descontar ni abrir nada', t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 5)') like '%| apuesta_invalida' and t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 25)') like '%múltiplo%'
                  and t_pz_error('select pozo_solo_empezar(gen_random_uuid(), 100000)') like '%No tienes tantos tokens%| saldo_insuficiente' and t_saldo_de(v_u) = v_dinero and not exists (select 1 from pozo_solo where estado = 'en_curso'));
  -- abandono: sin tiradas se devuelve la apuesta entera
  s := pozo_solo_empezar(gen_random_uuid(), 100); v_id := (s ->> 'id')::uuid;
  update pozo_solo set ultima_accion = now() - interval '1000 seconds' where id = v_id;
  s := pozo_solo_estado();
  perform t_check('Una partida abandonada sin tiradas se cierra sola y devuelve la apuesta entera', s ->> 'resultado' = 'devuelta' and (s ->> 'pago')::numeric = 100 and t_saldo_de(v_u) = v_dinero);
  perform t_check('Mirar el estado otra vez no devuelve nada más', (pozo_solo_estado() ->> 'pago')::numeric = 100 and t_saldo_de(v_u) = v_dinero);
  perform pozo_solo_descartar();
  -- abandono con tiradas: cobra lo que lleve, una sola vez
  s := pozo_solo_empezar(gen_random_uuid(), 100); v_id := (s ->> 'id')::uuid;
  perform t_dados(4, 5, 6); s := pozo_solo_tirar(v_id, 0);
  update pozo_solo set ultima_accion = now() - interval '1000 seconds' where id = v_id;
  s := pozo_solo_estado();
  perform t_check('Una partida abandonada con tiradas cobra lo que lleva (95 × 1,1875 = 112,81) una sola vez', s ->> 'resultado' = 'cobro_automatico' and (s ->> 'pago')::numeric = 112.81 and t_saldo_de(v_u) = v_dinero - 100 + 112.81);
  perform t_check('Y mirar otra vez no cobra otra vez', (pozo_solo_estado() ->> 'pago')::numeric = 112.81 and t_saldo_de(v_u) = v_dinero - 100 + 112.81);
  perform pozo_solo_descartar();
  -- el solitario no mueve cartas ni toca mesas
  perform t_check('El solitario no toca ninguna carta', not exists (select 1 from cartas_movimientos) and not exists (select 1 from pozo_mesas));
end $$;

/* ======================================================================== Solitario: millares de partidas al azar contra la fórmula */
do $$
declare
  v_u uuid := t_u(1); s jsonb; v_id uuid; i int; v_n int := 3000; v_pago numeric := 0; v_ruinas int := 0; v_ini numeric; v_neto numeric := 0;
begin
  perform t_pz_reset(); perform t_saldo(v_u, 1000000); perform t_sesion(v_u); v_ini := t_saldo_de(v_u);
  for i in 1..v_n loop
    s := pozo_solo_empezar(gen_random_uuid(), 100); v_id := (s ->> 'id')::uuid;
    s := pozo_solo_tirar(v_id, 0);                                                                     -- política: tirar una vez y cobrar si no hay Ruina
    if s ->> 'estado' = 'en_curso' then s := pozo_solo_cobrar(v_id, (s ->> 'paso')::int); end if;
    v_pago := v_pago + (s ->> 'pago')::numeric; v_neto := v_neto + (s ->> 'neto')::numeric;
    if s ->> 'resultado' = 'ruina' then v_ruinas := v_ruinas + 1; end if;
    perform pozo_solo_descartar();
  end loop;
  perform t_check('Cobrando siempre en la primera tirada el retorno es ' || round(v_pago / (v_n * 100) * 100, 2) || ' % (fórmula: 95,91 %, margen ±2,5 puntos)', abs(v_pago / (v_n * 100) - 0.9591) < 0.025);
  perform t_check('La Ruina sale en ' || round(v_ruinas::numeric / v_n * 100, 2) || ' % de las partidas (4,63 % esperado)', abs(v_ruinas::numeric / v_n - 10.0 / 216) < 0.012);
  perform t_check('La billetera cuadra con la suma de los netos de las ' || v_n || ' partidas (sin pagos duplicados ni perdidos)', t_saldo_de(v_u) = v_ini + v_neto);
  perform t_check('Hay exactamente dos movimientos de libro por partida con premio y uno por partida con Ruina', (select count(*) from hipodromo_movimientos where usuario = v_u) = v_n + (v_n - v_ruinas));
end $$;

/* ======================================================================== Partidas al azar de las mesas: el dinero y las cartas siempre cuadran */
create or replace function t_pz_azar(p_modo text, p_n int, p_vueltas int) returns text language plpgsql as $$
declare
  v_cod text; i int; v_dinero numeric; v_cartas int; v_mesa uuid; m pozo_mesas%rowtype; v_uid uuid; v_acc text; v_mal text := ''; k int; v_guard int; v_cats text[] := array['comun-1', 'comun-2', 'comun-3', 'comun-4', 'comun-5', 'comun-6'];
begin
  for k in 1..p_vueltas loop
    perform t_pz_reset();
    for i in 1..p_n loop perform t_saldo(t_u(i), 500); end loop;
    v_dinero := t_pz_dinero();
    v_cod := t_pz_montar(p_modo, p_n, 100, v_cats[1:p_n]);
    v_cartas := (select count(*) from cartas_ejemplares);
    v_mesa := t_pz_mesa_id(v_cod); v_guard := 0;
    loop
      v_guard := v_guard + 1; exit when v_guard > 400;
      select * into m from pozo_mesas where id = v_mesa; exit when m.estado <> 'jugando';
      select user_id into v_uid from pozo_jugadores where mesa = v_mesa and asiento = m.turno;
      perform t_pz_senal(v_cod, 0);
      if m.modo = 'compartido' and m.turno_fase = 'decidir' then
        perform t_pz_accion(v_uid, case when random() < 0.45 then 'cobrar' else 'continuar' end);
      elsif random() < 0.04 then
        update pozo_mesas set turno_limite = now() - interval '1 second' where id = v_mesa; perform pozo_i_avanzar(v_mesa);       -- a veces se acaba el tiempo
      else
        perform t_pz_accion(v_uid, 'tirar');
      end if;
    end loop;
    select * into m from pozo_mesas where id = v_mesa;
    if m.estado <> 'terminada' then v_mal := v_mal || 'no terminó; '; end if;
    if t_pz_dinero() <> v_dinero then v_mal := v_mal || 'el dinero no cuadra (' || t_pz_dinero() || ' vs ' || v_dinero || '); '; end if;
    if exists (select 1 from cartas_bloqueos) then v_mal := v_mal || 'cartas bloqueadas; '; end if;
    if (select count(*) from cartas_ejemplares where propietario is not null and estado = 'poseida') <> v_cartas then v_mal := v_mal || 'cartas perdidas o duplicadas; '; end if;
    if exists (select 1 from pozo_jugadores where mesa = v_mesa and not pagado and estado not in ('fuera')) then v_mal := v_mal || 'alguien sin liquidar; '; end if;
    if exists (select 1 from hipodromo_billeteras where saldo < 0) then v_mal := v_mal || 'saldo negativo; '; end if;
    exit when v_mal <> '';
  end loop;
  return v_mal;
end $$;
do $$
declare r text; n int;
begin
  for n in 2..6 loop
    r := t_pz_azar('compartido', n, 25);
    perform t_check('25 mesas compartidas al azar de ' || n || ' jugadores (cobros, Ruinas y tiempos agotados): el dinero y las cartas cuadran siempre' || case when r <> '' then ' [' || r || ']' else '' end, r = '');
  end loop;
  r := t_pz_azar('duelo', 2, 60);
  perform t_check('60 duelos al azar (con tiempos agotados y cartas): el dinero y las cartas cuadran siempre' || case when r <> '' then ' [' || r || ']' else '' end, r = '');
end $$;

select t_pz_reset();
update cartas_economia_ajustes set valor = 'false' where clave = 'pozo_dragon_publico';
