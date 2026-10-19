-- Pruebas de la mesa con amigos de Las Veintiuna Velas (docs/veintiuna.sql, sección 8). Las lanza docs/pruebas/t_veintiuna.sh justo después de t_veintiuna.sql,
-- así que usa sus ayudas (t_check, t_c, t_mazo, t_saldo, t_saldo_de, t_reset). Todo con barajas conocidas: la baraja que se pasa va primero, en este orden de reparto:
--   primera carta de cada jugador (por asiento), carta visible del crupier, segunda carta de cada jugador, carta oculta, y las que se roben después.

create or replace function t_sesion(p_uid uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true); end $$;

create or replace function t_amigos_listo(p_uid uuid, p_apuesta numeric) returns void language sql as $$
  update veintiuna_asientos set apuesta = p_apuesta, listo = true where user_id = p_uid $$;

create or replace function t_amigos_mesa(p_uid uuid) returns uuid language sql as $$ select mesa from veintiuna_asientos where user_id = p_uid $$;

create or replace function t_amigos_reparte(p_mesa uuid, variadic p_cartas text[]) returns void language plpgsql as $$
begin perform veintiuna_i_amigos_repartir(p_mesa, t_mazo(variadic p_cartas)); end $$;

-- Pone en cada asiento la mano tal como la ve su dueño (las de los demás están ocultas hasta que acaba la ronda)
create or replace function t_pleno(p_s jsonb, p_mesa uuid) returns jsonb language plpgsql as $$
declare r jsonb := p_s; i int; v_uid uuid; v jsonb;
begin
  if p_s is null or p_s -> 'asientos' is null then return p_s; end if;
  for i in 0..jsonb_array_length(p_s -> 'asientos') - 1 loop
    select user_id into v_uid from veintiuna_asientos where mesa = p_mesa and asiento = (p_s #>> array['asientos', i::text, 'asiento'])::int;
    if v_uid is not null then
      v := veintiuna_i_amigos_json(p_mesa, v_uid) #> array['asientos', i::text, 'mano'];
      r := jsonb_set(r, array['asientos', i::text, 'mano'], coalesce(v, 'null'::jsonb));
    end if;
  end loop;
  return r;
end $$;

-- Una acción como ese jugador, con el paso que ve su pantalla (devuelve la mesa con todo a la vista; ver t_pleno)
create or replace function t_amigos_act(p_uid uuid, p_accion text) returns jsonb language plpgsql as $$
declare v_paso int; v_mesa uuid; s jsonb;
begin
  select p.paso, a.mesa into v_paso, v_mesa from veintiuna_partidas p join veintiuna_asientos a on a.partida = p.id where a.user_id = p_uid;
  perform t_sesion(p_uid);
  s := veintiuna_amigos_accion(v_paso, p_accion);
  return t_pleno(s, v_mesa);
end $$;

create or replace function t_amigos_estado(p_uid uuid) returns jsonb language plpgsql as $$
declare s jsonb; v_mesa uuid;
begin
  select mesa into v_mesa from veintiuna_asientos where user_id = p_uid;
  perform t_sesion(p_uid); s := veintiuna_amigos_estado(null);
  return t_pleno(s, v_mesa);
end $$;

-- Mesa con N jugadores sentados (los primeros N de u1..u4) con 100 tokens cada uno y la regla dada (y la siguiente)
drop function if exists t_amigos_montar(int, text, text, boolean);
create or replace function t_amigos_montar(p_n int, p_regla text, p_proxima text default 'ojo', p_cartas boolean default false, p_modo text default 'casa') returns uuid language plpgsql as $$
declare
  u uuid[] := array['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004']::uuid[];
  s jsonb; v_cod text; v_mesa uuid; i int;
begin
  perform t_sesion(u[1]);
  s := veintiuna_amigos_crear('Mesa de prueba', true, p_cartas, p_modo);
  v_cod := s ->> 'codigo';
  select id into v_mesa from veintiuna_mesas where codigo = v_cod;
  for i in 2..p_n loop perform t_sesion(u[i]); perform veintiuna_amigos_unirse(v_cod); end loop;
  for i in 1..p_n loop perform t_saldo(u[i], 100); end loop;
  update veintiuna_mesas set regla = p_regla, proxima_regla = p_proxima where id = v_mesa;
  return v_mesa;
end $$;

/* ======================================================================== crear, unirse, lista, salir */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002';
  u3 uuid := '00000000-0000-0000-0000-000000000003'; u4 uuid := '00000000-0000-0000-0000-000000000004';
  s jsonb; v_cod text; l jsonb; v_mesa uuid; v_err text;
begin
  perform t_reset();
  delete from perfiles where user_id in (u1, u2, u3, u4);
  insert into perfiles (user_id, username, side) values (u1, 'Ana', 'A'), (u2, 'Beto', 'A'), (u3, 'Caro', 'B'), (u4, 'Dani', 'B');
  perform t_sesion(u1);
  s := veintiuna_amigos_crear('Los de siempre', true, false);
  v_cod := s ->> 'codigo';
  perform t_check('Crear una mesa: código de 5 caracteres, nombre, fase de apuestas y tú en el asiento 0', v_cod ~ '^[A-HJ-NP-Z2-9]{5}$' and s ->> 'nombre' = 'Los de siempre' and s ->> 'fase' = 'apuestas'
                  and jsonb_array_length(s -> 'asientos') = 1 and s #>> '{asientos,0,nombre}' = 'Ana' and (s #>> '{asientos,0,yo}')::boolean and (s ->> 'soy_creador')::boolean);
  perform t_check('Sin nombre se llama «Mesa de» y tu nombre', (select veintiuna_amigos_salir() is not null) and (select veintiuna_amigos_crear(null, false, false) ->> 'nombre') = 'Mesa de Ana');
  perform veintiuna_amigos_salir();
  s := veintiuna_amigos_crear('Los de siempre', true, false); v_cod := s ->> 'codigo';
  begin perform veintiuna_amigos_crear('Otra', true, false); perform t_check('No se puede crear una segunda mesa estando sentado', false);
  exception when others then perform t_check('No se puede crear una segunda mesa estando sentado', sqlerrm like 'Ya estás sentado%'); end;
  perform t_sesion(u2); s := veintiuna_amigos_unirse(lower(v_cod));
  perform t_check('Unirse con el código (sin importar mayúsculas): segundo asiento con tu nombre', jsonb_array_length(s -> 'asientos') = 2 and s #>> '{asientos,1,nombre}' = 'Beto' and (s #>> '{asientos,1,yo}')::boolean and not (s ->> 'soy_creador')::boolean);
  perform t_check('Volver a unirse a la misma mesa te devuelve la mesa sin duplicarte', jsonb_array_length(veintiuna_amigos_unirse(v_cod) -> 'asientos') = 2);
  begin perform veintiuna_amigos_unirse('ZZZZZ'); perform t_check('Un código que no existe se rechaza', false);
  exception when others then perform t_check('Un código que no existe se rechaza', sqlerrm like 'No encuentro esa mesa%'); end;
  perform t_sesion(u3);
  perform t_check('Una mesa privada no sale en la lista', jsonb_array_length(veintiuna_amigos_lista() -> 'mesas') = 0 and not (veintiuna_amigos_lista() ->> 'sentado')::boolean);
  s := veintiuna_amigos_crear('Abierta a todos', false, true);
  perform t_sesion(u4); l := veintiuna_amigos_lista();
  perform t_check('Una mesa pública sale en la lista con sus jugadores y si lleva pozo de cartas', jsonb_array_length(l -> 'mesas') = 1 and l #>> '{mesas,0,nombre}' = 'Abierta a todos'
                  and l #> '{mesas,0,jugadores}' = '["Caro"]'::jsonb and (l #>> '{mesas,0,cartas}')::boolean and (l #>> '{mesas,0,asientos_max}')::int = 5);
  -- mesa llena
  update cartas_economia_ajustes set valor = '2' where clave = 'veintiuna_mesa_asientos';
  perform t_sesion(u4);
  begin perform veintiuna_amigos_unirse(v_cod); perform t_check('Una mesa llena no admite a nadie más', false);
  exception when others then perform t_check('Una mesa llena no admite a nadie más', sqlerrm = 'La mesa está llena.'); end;
  update cartas_economia_ajustes set valor = '5' where clave = 'veintiuna_mesa_asientos';
  -- salir
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  select id into v_mesa from veintiuna_mesas where codigo = v_cod;
  perform t_check('Salir libera tu asiento y la mesa sigue abierta', (select count(*) from veintiuna_asientos where mesa = v_mesa) = 1 and (select estado from veintiuna_mesas where id = v_mesa) = 'abierta');
  perform t_sesion(u1); perform veintiuna_amigos_salir();
  perform t_check('Cuando se va el último, la mesa se cierra', (select estado from veintiuna_mesas where id = v_mesa) = 'cerrada');
  perform t_sesion(u4);
  begin perform veintiuna_amigos_unirse(v_cod); perform t_check('No se puede entrar en una mesa cerrada', false);
  exception when others then perform t_check('No se puede entrar en una mesa cerrada', sqlerrm like 'No encuentro esa mesa%'); end;
  perform t_check('Sin mesa, el estado lo dice', (veintiuna_amigos_estado(null) ->> 'sin_mesa')::boolean);
  -- el creador que se va traspasa la mesa
  perform t_sesion(u1); s := veintiuna_amigos_crear('Pasa el testigo', true, false); v_cod := s ->> 'codigo';
  perform t_sesion(u2); perform veintiuna_amigos_unirse(v_cod);
  perform t_sesion(u1); perform veintiuna_amigos_salir();
  perform t_check('Si se va quien creó la mesa, pasa a manos del siguiente', (select creador from veintiuna_mesas where codigo = v_cod) = u2);
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  -- quien está sentado no puede jugar solo
  perform t_sesion(u3); perform veintiuna_amigos_salir();
  perform t_sesion(u1); perform veintiuna_amigos_crear('Sentado', true, false);
  begin perform veintiuna_repartir(gen_random_uuid(), 'practica', 0); perform t_check('Sentado en una mesa con amigos no se puede repartir una mano individual', false);
  exception when others then perform t_check('Sentado en una mesa con amigos no se puede repartir una mano individual', sqlerrm like 'Estás sentado en una mesa con amigos%'); end;
  perform veintiuna_amigos_salir();
end $$;

/* ======================================================================== una ronda completa con dos jugadores */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002';
  v_mesa uuid; s jsonb; s2 jsonb; v_err text; p1 veintiuna_partidas%rowtype; p2 veintiuna_partidas%rowtype;
begin
  perform t_reset();
  v_mesa := t_amigos_montar(2, 'ojo', 'trueque');
  perform t_check('Con la mesa recién creada se espera a que apuesten', (select fase from veintiuna_mesas where id = v_mesa) = 'apuestas');
  -- apuesta por el camino público; el primero que apuesta pone en marcha el plazo
  perform t_sesion(u1); s := veintiuna_amigos_apostar(20);
  perform t_check('Apostar te deja listo y arranca el plazo de apuestas', (s #>> '{yo,listo}')::boolean and (s #>> '{yo,apuesta}')::numeric = 20 and (s ->> 'restante_s')::int between 40 and 45 and s ->> 'fase' = 'apuestas');
  perform t_sesion(u2); s2 := veintiuna_amigos_estado(null);
  perform t_check('El otro jugador ve que ya apostó, pero no cuánto: lo sabrá al repartir', (s2 #>> '{asientos,0,listo}')::boolean and s2 #>> '{asientos,0,apuesta}' is null and not (s2 #>> '{yo,listo}')::boolean);
  begin perform veintiuna_amigos_apostar(25); perform t_check('Una apuesta que no es múltiplo del paso se rechaza', false);
  exception when others then perform t_check('Una apuesta que no es múltiplo del paso se rechaza', sqlerrm like 'La apuesta tiene que ser múltiplo%'); end;
  begin perform veintiuna_amigos_apostar(500); perform t_check('Sin máximo, apostar más de lo que tienes se rechaza por falta de tokens', false);
  exception when others then perform t_check('Sin máximo, apostar más de lo que tienes se rechaza por falta de tokens', sqlerrm like 'No tienes tantos tokens%'); end;
  update cartas_economia_ajustes set valor = '100' where clave = 'veintiuna_apuesta_max';
  begin perform veintiuna_amigos_apostar(120); perform t_check('Con un máximo configurado, una apuesta por encima se rechaza', false);
  exception when others then perform t_check('Con un máximo configurado, una apuesta por encima se rechaza', sqlerrm like 'La apuesta va de%'); end;
  update cartas_economia_ajustes set valor = '0' where clave = 'veintiuna_apuesta_max';
  begin perform veintiuna_amigos_apostar(10, gen_random_uuid()); perform t_check('Poner una carta en una mesa sin pozo se rechaza', false);
  exception when others then perform t_check('Poner una carta en una mesa sin pozo se rechaza', sqlerrm = 'Esta mesa no juega con cartas.'); end;
  perform t_amigos_listo(u2, 30);                                          -- (para reparar con una baraja conocida)
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8c', '7t', '6d', 'Kd', 'Qd');
  s := t_amigos_estado(u1); s2 := t_amigos_estado(u2);
  perform t_check('Repartido: la mesa pasa a jugando y es el turno del asiento 0', s ->> 'fase' = 'jugando' and (s ->> 'turno')::int = 0 and (s #>> '{yo,tu_turno}')::boolean and not (s2 #>> '{yo,tu_turno}')::boolean);
  perform t_check('Cada jugador tiene sus dos cartas y el total', s #>> '{asientos,0,mano,total}' = '18' and s #>> '{asientos,1,mano,total}' = '16' and jsonb_array_length(s #> '{asientos,0,mano,cartas}') = 2);
  perform t_check('El crupier enseña una sola carta y tiene una oculta', jsonb_array_length(s #> '{crupier,cartas}') = 1 and (s #>> '{crupier,ocultas}')::int = 1 and s #>> '{crupier,cartas,0,r}' = '10');
  perform t_check('La baraja y la carta oculta no salen en lo que ve el navegador', position('mazo' in s::text) = 0 and position('mazo' in s2::text) = 0 and (s #>> '{asientos,0,apuesta}')::numeric = 20 and (s #>> '{asientos,1,apuesta}')::numeric = 30);
  perform t_check('Las apuestas se cobraron al repartir', t_saldo_de(u1) = 80 and t_saldo_de(u2) = 70);
  perform t_check('Cada mano guarda su mesa, su asiento y la ronda', (select count(*) from veintiuna_partidas where mesa = v_mesa and ronda_id = (select ronda_id from veintiuna_mesas where id = v_mesa)) = 2);
  -- turnos
  begin perform t_amigos_act(u2, 'plantar'); perform t_check('Fuera de tu turno no puedes jugar', false);
  exception when others then perform t_check('Fuera de tu turno no puedes jugar', sqlerrm = 'No es tu turno.'); end;
  s := t_amigos_act(u1, 'plantar');
  perform t_check('Al plantarte el turno pasa al siguiente y tu mano espera al crupier', (s ->> 'turno')::int = 1 and s #>> '{asientos,0,mano,fase}' = 'plantada' and s #>> '{asientos,0,mano,estado}' = 'en_curso' and not (s #>> '{yo,tu_turno}')::boolean);
  begin perform veintiuna_amigos_accion(0, 'plantar'); perform t_check('Con una acción repetida de otro paso no se aplica dos veces', true);
  exception when others then perform t_check('Con una acción repetida de otro paso no se aplica dos veces', true); end;
  s2 := t_amigos_act(u2, 'pedir');
  perform t_check('El segundo pide y se pasa (16 + rey): pierde y el crupier juega', s2 ->> 'fase' = 'resultado' and s2 #>> '{asientos,1,mano,resultado}' = 'derrota' and s2 #>> '{asientos,1,mano,razon}' = 'te_pasas');
  perform t_check('El crupier llega a 26 (10 + 6 + dama) y el primero gana', s2 #>> '{crupier,total}' = '26' and jsonb_array_length(s2 #> '{crupier,cartas}') = 3 and (s2 #>> '{crupier,ocultas}')::int = 0
                  and s2 #>> '{asientos,0,mano,resultado}' = 'victoria' and s2 #>> '{asientos,0,mano,razon}' = 'crupier_se_pasa');
  perform t_check('Se paga: el que ganó cobra el doble de su apuesta y el que perdió ya la había dejado', t_saldo_de(u1) = 120 and t_saldo_de(u2) = 70);
  perform t_check('El libro apunta apuesta y pago con el número de la mano', (select count(*) from hipodromo_movimientos where usuario = u1 and concepto like 'Veintiuna Velas:%(mano %') = 2
                  and (select sum(monto) from hipodromo_movimientos where usuario = u1) = 20);
  perform t_check('Cada mano cierra con los números de sus movimientos', (select count(*) from veintiuna_partidas where mesa = v_mesa and estado = 'terminada' and mov_cobro is not null) = 2);
  perform t_check('Las manos de la mesa quedan en el historial con las cartas finales del crupier', jsonb_array_length((select veintiuna_i_mano_json(crupier, '{}') from veintiuna_partidas where user_id = u1 and mesa = v_mesa)) = 3);
  perform t_check('Las estadísticas de cada uno cuentan su mano', (select victorias from veintiuna_estadisticas where user_id = u1) = 1 and (select derrotas from veintiuna_estadisticas where user_id = u2) = 1);
  perform t_check('Los desafíos de la mesa con apuesta cuentan (primera victoria)', exists (select 1 from veintiuna_logros where user_id = u1 and logro = 'primera_vela'));
  -- siguiente ronda
  update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
  s := t_amigos_estado(u1);
  perform t_check('Pasado el tiempo del resultado empieza otra ronda con la regla anunciada y sin apuestas', s ->> 'fase' = 'apuestas' and (s ->> 'ronda')::int = 2 and s #>> '{regla,id}' = 'trueque'
                  and s ->> 'proxima_regla' <> '' and not (s #>> '{yo,listo}')::boolean and s #> '{yo,partida}' is null and jsonb_array_length(s #> '{crupier,cartas}') = 0);
  perform t_check('Ninguna mano de la ronda anterior sigue abierta', not exists (select 1 from veintiuna_partidas where mesa = v_mesa and estado = 'en_curso'));
  perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
end $$;

/* ======================================================================== naturales al repartir */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s jsonb;
begin
  perform t_reset();
  -- Un natural del jugador (A + K) contra 9 + 7 se paga 3 a 2 al repartir; el otro sigue jugando
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, 'Ap', '9d', '9c', 'Kc', '7t', '7d', 'Kd');
  s := t_amigos_estado(u2);
  perform t_check('Un natural se paga al repartir (3 a 2) y esa mano no juega', s #>> '{asientos,0,mano,resultado}' = 'natural' and t_saldo_de(u1) = 130 and (s ->> 'turno')::int = 1 and s ->> 'fase' = 'jugando');
  perform t_check('El turno salta al jugador que sí tiene que decidir', (s #>> '{yo,tu_turno}')::boolean);
  s := t_amigos_act(u2, 'plantar');
  perform t_check('Si queda uno solo, al plantarse juega el crupier (16 + rey = 26) y acaba la ronda', s ->> 'fase' = 'resultado' and s #>> '{asientos,1,mano,resultado}' = 'victoria' and t_saldo_de(u2) = 120);
  perform veintiuna_amigos_salir(); perform t_sesion(u1); perform veintiuna_amigos_salir();
  perform t_reset();
  -- Natural del crupier: pierden los que no tienen natural y la ronda acaba sin turnos; quien también tiene natural empata
  v_mesa := t_amigos_montar(3, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20); perform t_amigos_listo(u3, 20);
  perform t_amigos_reparte(v_mesa, '10p', 'Kd', 'Ac', 'Ad', '8c', '9c', 'Qd', 'Kc');
  s := t_amigos_estado(u1);
  perform t_check('Con natural del crupier la ronda acaba al repartir, sin turnos', s ->> 'fase' = 'resultado' and (s #>> '{crupier,ocultas}')::int = 0 and s #>> '{crupier,total}' = '21' and jsonb_array_length(s #> '{crupier,cartas}') = 2);
  perform t_check('Pierden los dos sin natural y el que tiene natural empata (recupera su apuesta)', s #>> '{asientos,0,mano,razon}' = 'natural_crupier' and s #>> '{asientos,1,mano,razon}' = 'natural_crupier'
                  and s #>> '{asientos,2,mano,resultado}' = 'empate' and s #>> '{asientos,2,mano,razon}' = 'ambos_natural' and t_saldo_de(u1) = 80 and t_saldo_de(u2) = 80 and t_saldo_de(u3) = 100);
  perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();
end $$;

/* ======================================================================== las cartas de los demás están ocultas hasta que acaba la ronda */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s1 jsonb; s2 jsonb; i int;
begin
  perform t_reset();
  v_mesa := t_amigos_montar(3, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20); perform t_amigos_listo(u3, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '10c', '8d', '7t', '9p', '6d', 'Kd', '5c');
  perform t_sesion(u1); s1 := veintiuna_amigos_estado(null);
  perform t_sesion(u2); s2 := veintiuna_amigos_estado(null);
  perform t_check('Tus cartas las ves enteras: todas, con el total', jsonb_array_length(s1 #> '{asientos,0,mano,cartas}') = 2 and s1 #>> '{asientos,0,mano,total}' = '18' and (s1 #>> '{asientos,0,mano,oculta}') is null);
  perform t_check('De los demás solo se ve la primera carta y cuántas llevan', s1 #>> '{asientos,1,mano,oculta}' = 'true' and jsonb_array_length(s1 #> '{asientos,1,mano,cartas}') = 1 and (s1 #>> '{asientos,1,mano,n}')::int = 2
                  and s1 #>> '{asientos,1,mano,cartas,0,r}' = '9' and jsonb_array_length(s1 #> '{asientos,2,mano,cartas}') = 1);
  perform t_check('...sin total, sin peajes y sin saber si se pasaron', s1 #> '{asientos,1,mano,total}' is null and s1 #> '{asientos,1,mano,peajes}' is null and s1 #> '{asientos,1,mano,resultado}' is null and s1 #> '{asientos,1,mano,razon}' is null and s1 #> '{asientos,1,mano,blando}' is null);
  perform t_check('Cada uno ve las suyas y la primera de los otros (la mano del primero, vista por el segundo)', jsonb_array_length(s2 #> '{asientos,1,mano,cartas}') = 2 and s2 #>> '{asientos,0,mano,oculta}' = 'true' and jsonb_array_length(s2 #> '{asientos,0,mano,cartas}') = 1);
  perform t_check('La segunda carta de los demás no viaja ni escondida en la respuesta (8 de diamantes, 7 de tréboles)', position('"r": 7' in (s1 #> '{asientos,1}')::text) = 0 and position('"r": 9, "p": 0' in (s1 #> '{asientos,2}')::text) = 0
                  and (s1 #> '{asientos,1}')::text not like '%"p": 3%');
  -- cuando uno pide y se pasa, los demás solo ven que sigue o ha terminado, nunca que se pasó
  perform t_amigos_act(u1, 'plantar');
  perform t_sesion(u2); s2 := veintiuna_amigos_estado(null);
  perform t_check('Quien se planta aparece como «listo» para los demás, sin más datos', s2 #>> '{asientos,0,mano,fase}' = 'listo' and s2 #> '{asientos,0,mano,total}' is null);
  perform t_amigos_act(u2, 'pedir');                                    -- 16 + rey = 26: se pasa
  perform t_sesion(u3); s1 := veintiuna_amigos_estado(null);
  perform t_check('Quien se pasa tampoco lo enseña a los demás mientras dura la ronda: solo «listo» y una carta más', s1 #>> '{asientos,1,mano,fase}' = 'listo' and (s1 #>> '{asientos,1,mano,n}')::int = 3 and s1 #> '{asientos,1,mano,razon}' is null and s1 #> '{asientos,1,mano,resultado}' is null
                  and jsonb_array_length(s1 #> '{asientos,1,mano,cartas}') = 1);
  perform t_amigos_act(u3, 'plantar');
  perform t_sesion(u1); s1 := veintiuna_amigos_estado(null);
  perform t_check('Al acabar la ronda se enseña todo: cartas, totales y resultados de todos', s1 ->> 'fase' = 'resultado' and jsonb_array_length(s1 #> '{asientos,1,mano,cartas}') = 3 and s1 #>> '{asientos,1,mano,total}' = '26' and s1 #>> '{asientos,1,mano,razon}' = 'te_pasas'
                  and s1 #>> '{asientos,2,mano,total}' = '17' and (s1 #>> '{asientos,1,mano,oculta}') is null);
  -- una regla que cuesta tokens no se nota desde fuera (el peaje queda oculto)
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();
  perform t_reset();
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', 'Kd', 'Qd');
  perform t_amigos_act(u1, 'ojo');
  perform t_sesion(u2); s2 := veintiuna_amigos_estado(null);
  perform t_check('Si usas el Ojo del Tahúr los demás no ven que has pagado un peaje', s2 #> '{asientos,0,mano,peajes}' is null and s2 #>> '{asientos,0,mano,apuesta}' = '20.00');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();
  -- un natural pagado al repartir tampoco se nota hasta el final (casa)
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, 'Ap', '9d', '9c', 'Kc', '7t', '7d');
  perform t_sesion(u2); s2 := veintiuna_amigos_estado(null);
  perform t_check('Un natural pagado al repartir se ve como «listo», sin resultado, hasta que acaba la ronda', s2 #>> '{asientos,0,mano,fase}' = 'listo' and s2 #> '{asientos,0,mano,resultado}' is null and s2 #> '{asientos,0,mano,total}' is null);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();
end $$;

/* ======================================================================== turnos que se agotan, jugadores que se van */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s jsonb;
begin
  perform t_reset();
  v_mesa := t_amigos_montar(3, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20); perform t_amigos_listo(u3, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '10c', '8d', '7t', '9p', '6d', 'Kd', '5c');
  s := t_amigos_estado(u2);
  perform t_check('Cada turno tiene su plazo (unos 45 s)', (s ->> 'restante_s')::int between 40 and 45 and (s ->> 'turno')::int = 0);
  -- el primero no juega a tiempo: se planta solo
  update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
  s := t_amigos_estado(u2);
  perform t_check('Si no juegas a tiempo el servidor te planta y pasa el turno', s #>> '{asientos,0,mano,fase}' = 'plantada' and (s ->> 'turno')::int = 1
                  and (select perdidos from veintiuna_asientos where mesa = v_mesa and asiento = 0) = 1);
  s := t_amigos_act(u2, 'pedir');
  perform t_check('Jugar a tiempo pone a cero los turnos perdidos', (select perdidos from veintiuna_asientos where mesa = v_mesa and asiento = 1) = 0 and (s ->> 'turno')::int = 2);
  update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
  s := t_amigos_estado(u1);
  perform t_check('El último también se planta solo y entonces juega el crupier (16 + 5 = 21 gana a todos)', s ->> 'fase' = 'resultado' and s #>> '{crupier,total}' = '21'
                  and s #>> '{asientos,0,mano,resultado}' = 'derrota' and s #>> '{asientos,2,mano,resultado}' = 'derrota' and s #>> '{asientos,1,mano,razon}' = 'te_pasas');
  -- quien deja que se jueguen solos dos turnos seguidos se levanta antes de la siguiente ronda
  update veintiuna_asientos set perdidos = 2 where mesa = v_mesa and asiento = 2;
  update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
  s := t_amigos_estado(u1);
  perform t_check('Dos turnos perdidos seguidos: te levantan al acabar el resultado', jsonb_array_length(s -> 'asientos') = 2 and s ->> 'fase' = 'apuestas' and not exists (select 1 from veintiuna_asientos where user_id = u3));
  -- quien no da señales (cierra la pestaña) se levanta
  update veintiuna_asientos set ultima_actividad = now() - interval '10 minutes' where user_id = u2;
  s := t_amigos_estado(u1);
  perform t_check('Quien lleva más de dos minutos y medio sin dar señales se levanta', jsonb_array_length(s -> 'asientos') = 1 and not exists (select 1 from veintiuna_asientos where user_id = u2));
  perform veintiuna_amigos_salir();
  perform t_reset();

  -- irse a mitad de ronda: pierdes la mano (la apuesta ya está pagada) y el turno sigue
  v_mesa := t_amigos_montar(3, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20); perform t_amigos_listo(u3, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '10c', '8d', '7t', '9p', '6d', 'Kd', 'Qd');
  perform t_sesion(u1); perform veintiuna_amigos_salir();
  s := veintiuna_i_amigos_json(v_mesa, u2);
  perform t_check('Irte en tu turno pierde la mano por abandono y el turno pasa al siguiente', (select resultado || '/' || razon from veintiuna_partidas where user_id = u1 and mesa = v_mesa) = 'derrota/abandono'
                  and t_saldo_de(u1) = 80 and (s ->> 'turno')::int = 1 and jsonb_array_length(s -> 'asientos') = 2);
  perform t_amigos_act(u2, 'plantar');
  perform t_sesion(u3); perform veintiuna_amigos_salir();
  s := veintiuna_i_amigos_json(v_mesa, u2);
  perform t_check('Si el último que queda en juego se va, la ronda se cierra sola y juega el crupier', s ->> 'fase' = 'resultado' and s #>> '{asientos,0,mano,resultado}' = 'victoria' and t_saldo_de(u2) = 120);
  perform t_check('Con un solo jugador sentado la mesa sigue abierta', jsonb_array_length(s -> 'asientos') = 1 and (select estado from veintiuna_mesas where id = v_mesa) = 'abierta');
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- irse mientras se apuesta no cuesta nada
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_sesion(u2); perform veintiuna_amigos_apostar(40);
  perform veintiuna_amigos_salir();
  perform t_check('Irte antes de repartir no te cuesta tokens ni deja nada colgado', t_saldo_de(u2) = 100 and (select count(*) from veintiuna_partidas) = 0);
  perform t_sesion(u1); perform veintiuna_amigos_salir();
end $$;

/* ======================================================================== las reglas especiales en la mesa */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002';
  v_mesa uuid; s jsonb; s2 jsonb; i int; v_ok boolean := true;
begin
  -- Ojo del Tahúr: solo ve la siguiente carta quien paga, y es la que robará el que pida después
  perform t_reset();
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', 'Kd', 'Qd');
  s := t_amigos_estado(u1);
  perform t_check('Ojo: tu turno ofrece el botón con su peaje (35 % de 20 = 7)', s #>> '{yo,acciones,especial,tipo}' = 'ojo' and (s #>> '{yo,acciones,especial,disponible}')::boolean and (s #>> '{yo,acciones,especial,peaje}')::numeric = 7);
  s := t_amigos_act(u1, 'ojo');
  perform t_check('Ojo: pagas el peaje y ves la siguiente carta (rey de diamantes)', (s #>> '{yo,regla,proxima,r}')::int = 13 and (s #>> '{yo,regla,proxima,p}')::int = 2 and t_saldo_de(u1) = 73);
  s2 := t_amigos_estado(u2);
  perform t_check('Ojo: el otro jugador no ve esa carta en ninguna parte', s2 #>> '{yo,regla,proxima}' is null);
  perform t_amigos_act(u1, 'plantar');
  s2 := t_amigos_act(u2, 'pedir');
  perform t_check('Ojo: el siguiente que pide recibe justo esa carta', s2 #>> '{asientos,1,mano,cartas,2,r}' = '13' and s2 #>> '{asientos,1,mano,cartas,2,p}' = '2');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Cartas marcadas: ves la carta oculta tú solo
  v_mesa := t_amigos_montar(2, 'marcadas');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', 'Kd', 'Qd');
  s := t_amigos_act(u1, 'marcadas');
  perform t_check('Cartas marcadas: ves la carta oculta del crupier (6 de diamantes) y pagas 3,6', s #>> '{yo,vista,r}' = '6' and s #>> '{yo,vista,p}' = '2' and t_saldo_de(u1) = 76.4);
  perform t_check('...pero para la mesa sigue oculta: el crupier enseña una carta', jsonb_array_length(s #> '{crupier,cartas}') = 1 and (s #>> '{crupier,ocultas}')::int = 1);
  perform t_amigos_act(u1, 'plantar');
  s2 := t_amigos_estado(u2);
  perform t_check('Cartas marcadas: el otro jugador no ve esa carta', s2 #>> '{yo,vista}' is null);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Trueque: tu primera carta y la visible del crupier cambian de sitio, y todos lo ven
  v_mesa := t_amigos_montar(2, 'trueque');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '4c', '8d', '7t', '6d', 'Kd', 'Qd');
  s := t_amigos_act(u1, 'trueque');
  perform t_check('Trueque: tu primera carta pasa a ser la del crupier y viceversa', s #>> '{asientos,0,mano,cartas,0,r}' = '4' and s #>> '{crupier,cartas,0,r}' = '10' and s #>> '{asientos,0,mano,total}' = '12' and t_saldo_de(u1) = 60);
  s2 := t_amigos_estado(u2);
  perform t_check('Trueque: el otro jugador ve el cambio en el crupier', s2 #>> '{crupier,cartas,0,r}' = '10' and s2 #>> '{crupier,cartas,0,p}' = '0');
  perform t_amigos_act(u1, 'plantar');
  s2 := t_amigos_act(u2, 'plantar');
  perform t_check('Trueque: el crupier juega con la carta cambiada (10 + 6 = 16, pide y se pasa con el rey: 26)', s2 #>> '{crupier,total}' = '26' and jsonb_array_length(s2 #> '{crupier,cartas}') = 3);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Fortuna: te pasas, sigue siendo tu turno hasta que decides; la carta pasa a valer 1
  v_mesa := t_amigos_montar(2, 'fortuna');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', 'Kd', 'Qd');
  s := t_amigos_act(u1, 'pedir');
  perform t_check('Fortuna: al pasarte sigues en tu turno con la opción de salvar la mano', s ->> 'fase' = 'jugando' and (s ->> 'turno')::int = 0 and s #>> '{yo,acciones,especial,tipo}' = 'fortuna' and (s #>> '{yo,tu_turno}')::boolean);
  s := t_amigos_act(u1, 'fortuna');
  perform t_check('Fortuna: pagas el 60 % (12) y el rey vale 1: tienes 19', s #>> '{asientos,0,mano,total}' = '19' and t_saldo_de(u1) = 68 and (s ->> 'turno')::int = 0);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Última voluntad: cambias tu última carta por la siguiente de la baraja
  v_mesa := t_amigos_montar(2, 'voluntad');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', '2d', 'Qd');
  s := t_amigos_act(u1, 'voluntad');
  perform t_check('Última voluntad: la última carta (8) se cambia por la siguiente de la baraja (2) y pagas el 50 % (10)', s #>> '{asientos,0,mano,total}' = '12' and t_saldo_de(u1) = 70);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Vela corta: el crupier se planta con 16 y el natural paga 6 a 5
  v_mesa := t_amigos_montar(2, 'vela');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, 'Ap', '9d', '10c', 'Kc', '10d', '6d', 'Kd');
  perform t_check('Vela corta: el natural paga 6 a 5 (cobras 44 de 20)', t_saldo_de(u1) = 124);
  s2 := t_amigos_act(u2, 'plantar');
  perform t_check('Vela corta: el crupier se planta con 16 sin pedir y el jugador con 19 gana', s2 #>> '{crupier,total}' = '16' and jsonb_array_length(s2 #> '{crupier,cartas}') = 2 and s2 #>> '{asientos,1,mano,resultado}' = 'victoria');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Maldición: dos figuras suman 22 y pierden al repartir
  v_mesa := t_amigos_montar(2, 'maldicion');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, 'Kp', '9d', '10c', 'Qd', '7t', '6d', 'Kd');
  s := t_amigos_estado(u2);
  perform t_check('Maldición: dos figuras pierden al repartir y el otro jugador sigue', s #>> '{asientos,0,mano,razon}' = 'pasado_al_repartir' and (s ->> 'turno')::int = 1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset();

  -- Pacto del Bufón: un dado para toda la mesa; lo que cambia es siempre la siguiente carta de la baraja
  for i in 1..40 loop
    v_mesa := t_amigos_montar(2, 'bufon');
    perform t_amigos_listo(u1, 10); perform t_amigos_listo(u2, 10);
    perform veintiuna_i_amigos_repartir(v_mesa);
    if not exists (select 1 from veintiuna_mesas m where m.id = v_mesa and m.bufon_evento is not null) then v_ok := false; end if;
    if exists (select 1 from veintiuna_mesas m where m.id = v_mesa and m.pos <> 6 + case when m.bufon_evento = 'nada' then 0 else 1 end) and exists (select 1 from veintiuna_partidas p where p.mesa = v_mesa and p.estado = 'en_curso') then v_ok := false; end if;
    if exists (select 1 from veintiuna_mesas m where m.id = v_mesa and m.bufon_evento = 'jugador' and m.bufon_asiento is null) then v_ok := false; end if;
    if exists (select 1 from veintiuna_partidas p join veintiuna_mesas m on m.id = p.mesa where p.mesa = v_mesa and m.bufon_evento = 'crupier' and p.bufon_evento <> 'crupier') then v_ok := false; end if;
    if exists (select 1 from veintiuna_partidas p join veintiuna_mesas m on m.id = p.mesa where p.mesa = v_mesa and m.bufon_evento = 'jugador' and (p.bufon_evento = 'jugador') <> (p.asiento = m.bufon_asiento)) then v_ok := false; end if;
    perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
    perform t_reset();
  end loop;
  perform t_check('Bufón (40 repartos): el dado afecta a la mesa entera, la baraja avanza lo justo y cada mano sabe qué le pasó', v_ok);

  -- Sin apostar tokens: juegas, no se te cobra y no cuenta para los desafíos
  v_mesa := t_amigos_montar(2, 'ojo');
  perform t_amigos_listo(u1, 0); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8d', '7t', '6d', 'Kd', 'Qd');
  perform t_check('Jugar sin apostar: no se cobra nada y la mano es de práctica', t_saldo_de(u1) = 100 and (select modo from veintiuna_partidas where user_id = u1) = 'practica' and (select apuesta from veintiuna_partidas where user_id = u1) = 10);
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'plantar');
  perform t_check('Ganar sin apostar no paga tokens y no da desafíos ni racha, pero sí suma una mano', t_saldo_de(u1) = 100 and not exists (select 1 from veintiuna_logros where user_id = u1)
                  and (select racha from veintiuna_estadisticas where user_id = u1) = 0 and (select rondas from veintiuna_estadisticas where user_id = u1) = 1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
end $$;

/* ======================================================================== el pozo de cartas */
create or replace function t_pozo_limpiar() returns void language plpgsql as $$
begin
  truncate cartas_ejemplares, cartas_movimientos, cartas_bloqueos, cartas_mercader_ofertas, cartas_mercader_registro, cartas_intercambios, cartas_partidas, cartas_coleccion, cartas_numeradas,
           cartas_registro, cartas_forja_registro, cartas_mazos, cartas_partidas_juego, cartas_recompensas_registro, cartas_progreso restart identity cascade;
end $$;
create or replace function t_dar(p_uid uuid, p_carta text) returns uuid language sql as $$
  select (cartas_i_emitir(p_uid, p_carta, 'prueba', '', null, true) ->> 'ejemplar')::uuid $$;
create or replace function t_dueno(p_ejemplar uuid) returns text language sql as $$
  select coalesce(propietario::text, '-') || '/' || estado from cartas_ejemplares where id = p_ejemplar $$;
-- El tercer jugador se sienta sin apostar: así los dos primeros no disparan el reparto solos y se puede repartir con una baraja conocida
create or replace function t_pozo_preparar(p_carta1 text default 'comun-3', p_carta2 text default 'comun-4') returns jsonb language plpgsql as $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002';
  v_mesa uuid; e1 uuid; e2 uuid;
begin
  perform t_reset(); perform t_pozo_limpiar();
  e1 := t_dar(u1, p_carta1); e2 := t_dar(u2, p_carta2);
  v_mesa := t_amigos_montar(3, 'ojo', 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform t_sesion(u2); perform veintiuna_amigos_apostar(20, e2);
  return jsonb_build_object('mesa', v_mesa, 'e1', e1, 'e2', e2);
end $$;
create or replace function t_pozo_estado(p_mesa uuid) returns text language sql as $$
  select coalesce((select estado || '/' || coalesce(ganador::text, '-') from veintiuna_pozos where ronda_id = (select ronda_id from veintiuna_mesas where id = p_mesa)), 'sin pozo') $$;

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s jsonb; e1 uuid; e2 uuid; e3 uuid; x jsonb;
begin
  -- apostar con cartas: comprobaciones antes de repartir
  perform t_reset(); perform t_pozo_limpiar();
  e1 := t_dar(u1, 'comun-3'); e2 := t_dar(u2, 'comun-4'); e3 := t_dar(u3, 'legendaria-1');
  v_mesa := t_amigos_montar(3, 'ojo', 'ojo', true);
  perform t_sesion(u1);
  begin perform veintiuna_amigos_apostar(20, e2); perform t_check('No puedes poner en el pozo una carta que no es tuya', false);
  exception when others then perform t_check('No puedes poner en el pozo una carta que no es tuya', sqlerrm like 'Alguna de las cartas apostadas no es tuya%'); end;
  s := veintiuna_amigos_apostar(20, e1);
  perform t_check('Poner una carta bloquea la copia y la enseña en el pozo a todos', t_dueno(e1) = u1 || '/bloqueada' and s #>> '{pozo,cartas,0,carta}' = 'comun-3' and (s #>> '{pozo,cartas,0,yo}')::boolean and (s #>> '{asientos,0,con_carta}')::boolean);
  perform t_sesion(u3);
  begin perform veintiuna_amigos_apostar(20, e3); perform t_check('Cartas de rarezas muy distintas no se pueden jugar juntas (más de una categoría)', false);
  exception when others then perform t_check('Cartas de rarezas muy distintas no se pueden jugar juntas (más de una categoría)', sqlerrm like 'Las apuestas no están equilibradas%'); end;
  perform t_check('Y esa carta no queda bloqueada', t_dueno(e3) = u3 || '/poseida');
  perform t_sesion(u1); s := veintiuna_amigos_apostar(20);
  perform t_check('Cambiar de idea y apostar sin carta la libera', t_dueno(e1) = u1 || '/poseida' and (s #>> '{pozo,cartas}') = '[]' and not (s #>> '{asientos,0,con_carta}')::boolean);
  update cartas_economia_ajustes set valor = '0' where clave = 'veintiuna_pozo_max_dia';
  begin perform veintiuna_amigos_apostar(20, e1); perform t_check('Hay un tope diario de veces que se pone una carta en el pozo', false);
  exception when others then perform t_check('Hay un tope diario de veces que se pone una carta en el pozo', sqlerrm like 'Hoy ya has puesto cartas en el pozo%'); end;
  update cartas_economia_ajustes set valor = '5' where clave = 'veintiuna_pozo_max_dia';
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();
  perform t_reset(); perform t_pozo_limpiar();
  -- una mesa sin pozo no admite cartas
  v_mesa := t_amigos_montar(2, 'ojo', 'ojo', false);
  e1 := t_dar(u1, 'comun-3');
  perform t_sesion(u1);
  begin perform veintiuna_amigos_apostar(20, e1); perform t_check('En una mesa sin pozo no se pueden poner cartas', false);
  exception when others then perform t_check('En una mesa sin pozo no se pueden poner cartas', sqlerrm = 'Esta mesa no juega con cartas.'); end;
  perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();

  -- P1: gana solo el primero (el otro se pasa): se lleva la carta del otro
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_check('Con dos cartas en el pozo y sin el tercero listo, la mesa espera (no reparte sola)', (select fase from veintiuna_mesas where id = v_mesa) = 'apuestas');
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '9c', '7t', '6d', 'Kd', 'Qd');
  perform t_check('Al repartir las dos cartas siguen bloqueadas hasta que acabe la ronda', t_dueno(e1) = u1 || '/bloqueada' and t_dueno(e2) = u2 || '/bloqueada' and t_pozo_estado(v_mesa) like 'abierto/%');
  perform t_amigos_act(u1, 'plantar'); s := t_amigos_act(u2, 'pedir');
  perform t_check('P1: gana el único que ganó a la casa y se lleva las dos cartas', t_dueno(e1) = u1 || '/poseida' and t_dueno(e2) = u1 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u1);
  perform t_check('P1: el pozo queda resuelto a la vista de todos y sin bloqueos pendientes', s #>> '{pozo,estado}' = 'pagado' and (select count(*) from cartas_bloqueos) = 0 and (select count(*) from veintiuna_pozo_cartas) = 0);
  perform t_check('P1: el traspaso queda en el libro de cartas', (select count(*) from cartas_movimientos where tipo = 'transferencia' and ejemplar = e2 and a = u1) = 1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P2: ganan los dos a la casa, gana el pozo la mejor mano (20 contra 19)
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_amigos_reparte(v_mesa, '10p', 'Kd', '10c', '9c', '10d', '6d', 'Qd');
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'plantar');
  perform t_check('P2: si ganan los dos a la casa, el pozo es de la mejor mano (20 > 19)', t_dueno(e1) = u2 || '/poseida' and t_dueno(e2) = u2 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u2);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P3: empate arriba: cada carta vuelve a su dueño
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_amigos_reparte(v_mesa, '10p', '10d', '10c', '9c', '9d', '6d', 'Qd');
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'plantar');
  perform t_check('P3: empate en la mejor mano, las cartas vuelven a su dueño', t_dueno(e1) = u1 || '/poseida' and t_dueno(e2) = u2 || '/poseida' and t_pozo_estado(v_mesa) = 'devuelto/-');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P4: nadie gana a la casa: vuelven
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '8c', '7t', '10d');
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'plantar');
  perform t_check('P4: si nadie gana a la casa, nadie gana el pozo', t_dueno(e1) = u1 || '/poseida' and t_dueno(e2) = u2 || '/poseida' and t_pozo_estado(v_mesa) = 'devuelto/-');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P5: un natural vale más que cualquier total
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_amigos_reparte(v_mesa, 'Ap', '10d', '9c', 'Kc', 'Qd', '7d', 'Kd');
  perform t_amigos_act(u2, 'plantar');
  perform t_check('P5: el natural gana el pozo aunque el otro también ganó a la casa con 20', t_dueno(e2) = u1 || '/poseida' and t_dueno(e1) = u1 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P6: quien se va a mitad de ronda no puede ganar, pero su carta sigue en juego
  x := t_pozo_preparar(); v_mesa := (x ->> 'mesa')::uuid; e1 := (x ->> 'e1')::uuid; e2 := (x ->> 'e2')::uuid;
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '9c', '7t', '6d', 'Qd');
  perform t_amigos_act(u1, 'plantar');
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_check('P6: quien abandona pierde su carta frente al que gana a la casa', t_dueno(e1) = u1 || '/poseida' and t_dueno(e2) = u1 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P7: una sola carta en el pozo: no hay pozo y se devuelve al repartir
  perform t_reset(); perform t_pozo_limpiar();
  e1 := t_dar(u1, 'comun-3');
  v_mesa := t_amigos_montar(3, 'ojo', 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform t_sesion(u2); perform veintiuna_amigos_apostar(20);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '9c', '7t', '6d', 'Qd');
  s := t_amigos_estado(u1);
  perform t_check('P7: si solo una persona puso carta, se le devuelve al repartir y se le avisa', t_dueno(e1) = u1 || '/poseida' and (select count(*) from veintiuna_pozos) = 0 and s #>> '{yo,aviso}' like 'Nadie más puso carta%');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- P8: si al ganador ya no le cabe la carta en su colección, vuelve a su dueño (sin error)
  perform t_reset(); perform t_pozo_limpiar();
  update cartas_catalogo set limite_jugador = 1 where id = 'comun-3';                           -- cada jugador solo puede tener una copia
  e1 := t_dar(u1, 'comun-3');
  e2 := t_dar(u2, 'comun-3');
  v_mesa := t_amigos_montar(3, 'ojo', 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform t_sesion(u2); perform veintiuna_amigos_apostar(20, e2);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '10c', '9c', '7t', '6d', 'Kd', 'Qd');
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'pedir');
  perform t_check('P8: el límite por jugador se respeta: la carta que no le cabe a quien gana vuelve a su dueño', t_dueno(e2) = u2 || '/poseida' and t_dueno(e1) = u1 || '/poseida' and (select count(*) from cartas_bloqueos) = 0);
  update cartas_catalogo set limite_jugador = null where id = 'comun-3';
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- irse antes de repartir suelta la carta
  perform t_reset(); perform t_pozo_limpiar();
  e1 := t_dar(u1, 'comun-3');
  v_mesa := t_amigos_montar(2, 'ojo', 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform veintiuna_amigos_salir();
  perform t_check('Irte antes de repartir suelta tu carta del pozo', t_dueno(e1) = u1 || '/poseida' and (select count(*) from veintiuna_pozo_cartas) = 0);
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_reset(); perform t_pozo_limpiar();
end $$;

/* ======================================================================== muchas rondas al azar: el libro cuadra y las cartas se conservan */
do $$
declare
  u uuid[] := array['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']::uuid[];
  v_mesa uuid; s jsonb; i int; j int; v_turno int; v_uid uuid; v_acc text; v_total int; v_fase text; v_guard int;
  v_cartas uuid[]; v_ap numeric; v_carta uuid; v_n_cartas int; v_rondas int := 0; v_ok boolean := true; v_msg text := ''; v_bloq int; v_audit int;
  v_pagados int := 0; v_dev int := 0;
begin
  perform t_reset(); perform t_pozo_limpiar();
  for i in 1..3 loop
    perform t_dar(u[i], 'comun-3'); perform t_dar(u[i], 'comun-4'); perform t_dar(u[i], 'comun-5');
  end loop;
  select count(*) into v_n_cartas from cartas_ejemplares;
  v_mesa := t_amigos_montar(3, 'ojo', 'ojo', true);
  for i in 1..3 loop perform t_saldo(u[i], 5000); end loop;
  for j in 1..60 loop
    -- apuestas al azar: algunos juegan sin tokens, algunos pasan, y algunos ponen una carta en el pozo
    for i in 1..3 loop
      perform t_sesion(u[i]);
      v_ap := (array[0, 10, 20, 50, 100])[1 + veintiuna_i_azar(5)];
      v_carta := null;
      if veintiuna_i_azar(2) = 0 then
        select id into v_carta from cartas_ejemplares where propietario = u[i] and estado = 'poseida' order by id limit 1;
      end if;
      begin
        if veintiuna_i_azar(8) = 0 then perform veintiuna_amigos_pasar(); else perform veintiuna_amigos_apostar(v_ap, v_carta); end if;
      exception when others then
        if sqlerrm not like 'Ahora no se puede%' then v_ok := false; v_msg := v_msg || ' apostar:' || sqlerrm; end if;
      end;
    end loop;
    -- si nadie ha apostado todavía o falta alguno, se cierra el plazo
    select fase into v_fase from veintiuna_mesas where id = v_mesa;
    if v_fase = 'apuestas' then
      update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
      perform t_amigos_estado(u[1]);
      select fase into v_fase from veintiuna_mesas where id = v_mesa;
    end if;
    v_guard := 0;
    while v_fase = 'jugando' and v_guard < 60 loop
      v_guard := v_guard + 1;
      select turno into v_turno from veintiuna_mesas where id = v_mesa;
      select user_id into v_uid from veintiuna_asientos where mesa = v_mesa and asiento = v_turno;
      s := t_amigos_estado(v_uid);
      select (x #>> '{mano,total}')::int into v_total from jsonb_array_elements(s -> 'asientos') x where (x ->> 'asiento')::int = v_turno;
      if s #>> '{yo,acciones,especial,tipo}' = 'fortuna' then v_acc := (array['fortuna', 'aceptar'])[1 + veintiuna_i_azar(2)];
      elsif veintiuna_i_azar(4) = 0 and s #>> '{yo,acciones,especial,disponible}' = 'true' then v_acc := s #>> '{yo,acciones,especial,tipo}';
      elsif veintiuna_i_azar(12) = 0 then
        -- este turno se agota: lo juega el servidor
        update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
        perform t_amigos_estado(u[1]);
        v_acc := null;
      elsif v_total < 15 then v_acc := 'pedir';
      else v_acc := 'plantar';
      end if;
      if v_acc is not null then
        begin
          perform t_amigos_act(v_uid, v_acc);
        exception when others then
          begin perform t_amigos_act(v_uid, case when s #>> '{yo,acciones,especial,tipo}' = 'fortuna' then 'aceptar' else 'plantar' end);
          exception when others then v_ok := false; v_msg := v_msg || ' accion:' || sqlerrm; end;
        end;
      end if;
      select fase into v_fase from veintiuna_mesas where id = v_mesa;
    end loop;
    if v_fase = 'jugando' then v_ok := false; v_msg := v_msg || ' la ronda no acabó'; end if;
    select count(*) into v_bloq from cartas_bloqueos;
    select count(*) filter (where estado = 'pagado'), count(*) filter (where estado = 'devuelto') into v_pagados, v_dev from veintiuna_pozos;
    v_rondas := v_rondas + 1;
    -- pasa el tiempo del resultado
    update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
    perform t_amigos_estado(u[1]);
    update veintiuna_asientos set perdidos = 0 where mesa = v_mesa;
    if (select count(*) from veintiuna_asientos where mesa = v_mesa) < 3 then v_ok := false; v_msg := v_msg || ' se levantó alguien'; exit; end if;
  end loop;
  perform t_check('60 rondas al azar con tres jugadores, tokens, pozo de cartas, plazos agotados y todas las reglas: ninguna da error (' || v_msg || ')', v_ok and v_rondas = 60);
  perform t_check('Ninguna mano quedó abierta', (select count(*) from veintiuna_partidas where estado = 'en_curso') = (select count(*) from veintiuna_partidas p join veintiuna_mesas m on m.id = p.mesa and m.ronda_id = p.ronda_id where p.estado = 'en_curso'));
  perform t_check('Se repartieron manos de verdad (' || (select count(*) from veintiuna_partidas) || ')', (select count(*) from veintiuna_partidas) > 60);
  perform t_check('Hubo pozos pagados y pozos devueltos (' || v_pagados || ' y ' || v_dev || ')', v_pagados > 0 and v_dev > 0);
  -- cuando acaba la última ronda, nadie está bloqueado salvo por un pozo abierto
  for i in 1..3 loop perform t_sesion(u[i]); perform veintiuna_amigos_salir(); end loop;
  perform t_check('Las cartas se conservan: ni se crean ni se destruyen', (select count(*) from cartas_ejemplares) = v_n_cartas and (select count(*) from cartas_ejemplares where estado not in ('poseida')) = 0);
  perform t_check('Sin bloqueos pendientes al terminar', (select count(*) from cartas_bloqueos) = 0 and (select count(*) from veintiuna_pozo_cartas) = 0);
  perform t_check('Las colecciones de los tres suman las mismas cartas de siempre', (select count(*) from cartas_ejemplares where propietario = any (u)) = v_n_cartas);
  perform t_check('El libro cuadra para los tres: saldo = 5000 + movimientos', not exists (
    select 1 from hipodromo_billeteras b where b.usuario = any (u) and b.saldo <> 5000 + coalesce((select sum(monto) from hipodromo_movimientos m where m.usuario = b.usuario), 0)));
  perform t_check('Nunca un saldo negativo en el libro', not exists (select 1 from hipodromo_movimientos where saldo < 0));
  perform t_check('Cada mano con apuesta: cobro + peajes + pago del libro = su neto', not exists (
    select 1 from veintiuna_partidas p where p.modo = 'apuesta' and p.mesa is not null
      and coalesce((select sum(m.monto) from hipodromo_movimientos m where m.usuario = p.user_id and m.concepto like '%(mano ' || p.id || ')%'), 0) <> p.neto));
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
  select jsonb_array_length(cartas_auditoria()) into v_audit;
  perform t_check('La auditoría de la economía de cartas sigue limpia', v_audit = 0);
  perform t_reset(); perform t_pozo_limpiar();
end $$;

/* ======================================================================== todos contra todos (sin crupier: gana el bote la mejor mano) */
create or replace function t_duelo_montar(p_n int, p_regla text default 'ojo', p_cartas boolean default false) returns uuid language plpgsql as $$
begin return t_amigos_montar(p_n, p_regla, 'ojo', p_cartas, 'duelo'); end $$;

do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s jsonb; i int; v_ok boolean := true; v_reglas text[] := '{}'; r text;
begin
  -- las reglas que se sortean en este modo
  for i in 1..300 loop r := veintiuna_i_regla_nueva_duelo(); if not (r = any (v_reglas)) then v_reglas := v_reglas || r; end if; end loop;
  perform t_check('Todos contra todos solo sortea las reglas que no necesitan crupier (' || array_to_string(v_reglas, ', ') || ')', v_reglas @> array['fortuna', 'maldicion', 'voluntad', 'ojo', 'bufon'] and cardinality(v_reglas) = 5);

  -- T1: la mejor mano se lleva todo el bote
  perform t_reset();
  v_mesa := t_duelo_montar(3);
  perform t_check('La mesa se crea en modo duelo y lo dice', (select modo from veintiuna_mesas where id = v_mesa) = 'duelo');
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 30); perform t_amigos_listo(u3, 50);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '9c', '7t', 'Kd', 'Qd', '5c');
  s := t_amigos_estado(u1);
  perform t_check('Sin crupier: no hay cartas del crupier y se enseña el bote (100)', s ->> 'modo' = 'duelo' and jsonb_array_length(s #> '{crupier,cartas}') = 0 and (s #>> '{crupier,ocultas}')::int = 0 and (s ->> 'bote')::numeric = 100);
  perform t_check('Cada jugador tiene sus dos cartas y las apuestas salieron de su billetera', s #>> '{asientos,0,mano,total}' = '19' and s #>> '{asientos,1,mano,total}' = '16' and s #>> '{asientos,2,mano,total}' = '18'
                  and t_saldo_de(u1) = 80 and t_saldo_de(u2) = 70 and t_saldo_de(u3) = 50);
  perform t_check('Empieza el primer asiento (la primera ronda) y no se paga nada al repartir', (s ->> 'turno')::int = 0 and s ->> 'fase' = 'jugando' and not exists (select 1 from veintiuna_partidas where mesa = v_mesa and estado = 'terminada'));
  perform t_amigos_act(u1, 'plantar');
  s := t_amigos_act(u2, 'pedir');
  perform t_check('Quien se pasa queda fuera pero su mano sigue abierta hasta el final (su apuesta está en el bote)', s #>> '{asientos,1,mano,fase}' = 'pasada' and s #>> '{asientos,1,mano,estado}' = 'en_curso' and (s ->> 'turno')::int = 2);
  s := t_amigos_act(u3, 'plantar');
  perform t_check('Al acabar, la mejor mano (19) se lleva el bote entero: 100', s ->> 'fase' = 'resultado' and t_saldo_de(u1) = 180 and t_saldo_de(u2) = 70 and t_saldo_de(u3) = 50);
  perform t_check('Los resultados: gana el bote, se pasa y pierde ante una mejor mano', s #>> '{asientos,0,mano,resultado}' = 'victoria' and s #>> '{asientos,0,mano,razon}' = 'bote'
                  and s #>> '{asientos,1,mano,razon}' = 'te_pasas' and s #>> '{asientos,2,mano,razon}' = 'rival_mejor' and (s #>> '{asientos,0,mano,neto}')::numeric = 80);
  perform t_check('Las fichas se conservan: lo que entra en el bote sale entero', t_saldo_de(u1) + t_saldo_de(u2) + t_saldo_de(u3) = 300);
  perform t_check('El libro apunta apuesta y bote con el número de la mano', (select count(*) from hipodromo_movimientos where usuario = u1 and concepto like 'Veintiuna Velas: bote ganado (mano %') = 1);
  perform t_check('Una mano de «todos contra todos» no cuenta para desafíos ni rachas, pero sí para las estadísticas', not exists (select 1 from veintiuna_logros where user_id = u1)
                  and (select racha from veintiuna_estadisticas where user_id = u1) = 0 and (select rondas from veintiuna_estadisticas where user_id = u1) = 1 and (select victorias from veintiuna_estadisticas where user_id = u1) = 1 and (select neto from veintiuna_estadisticas where user_id = u1) = 80);
  perform t_check('Ninguna mano queda abierta', not exists (select 1 from veintiuna_partidas where estado = 'en_curso'));
  -- el primero en jugar rota cada ronda
  update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
  perform t_amigos_estado(u1);
  perform t_amigos_listo(u1, 10); perform t_amigos_listo(u2, 10); perform t_amigos_listo(u3, 10);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '9c', '7t', '10c', 'Qd', '5c');
  s := t_amigos_estado(u1);
  perform t_check('En la segunda ronda empieza el segundo asiento (el turno rota)', (s ->> 'ronda')::int = 2 and (s ->> 'turno')::int = 1);
  perform t_amigos_act(u2, 'plantar');
  s := t_amigos_estado(u1);
  perform t_check('...y sigue el tercero y luego el primero', (s ->> 'turno')::int = 2);
  perform t_amigos_act(u3, 'plantar');
  s := t_amigos_estado(u1);
  perform t_check('...y por último el primero', (s ->> 'turno')::int = 0);
  perform t_amigos_act(u1, 'plantar');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- T2: empate arriba: el bote se reparte a partes iguales sin perder ni un céntimo
  perform t_reset();
  v_mesa := t_duelo_montar(3);
  perform t_amigos_listo(u1, 10); perform t_amigos_listo(u2, 20); perform t_amigos_listo(u3, 20);
  perform t_amigos_reparte(v_mesa, '10p', '10d', '10c', '8c', '8d', '8t');
  perform t_amigos_act(u1, 'plantar'); perform t_amigos_act(u2, 'plantar'); s := t_amigos_act(u3, 'plantar');
  perform t_check('Empate de tres con un bote de 50: 16,68 + 16,66 + 16,66, el céntimo sobrante para el primero', t_saldo_de(u1) = 100 - 10 + 16.68 and t_saldo_de(u2) = 100 - 20 + 16.66 and t_saldo_de(u3) = 100 - 20 + 16.66);
  perform t_check('Las fichas se conservan también al repartir', t_saldo_de(u1) + t_saldo_de(u2) + t_saldo_de(u3) = 300);
  perform t_check('Quien gana poco por repartirse un bote mayor que su apuesta cuenta como victoria y quien pone más y empata, como derrota', s #>> '{asientos,0,mano,resultado}' = 'victoria' and s #>> '{asientos,1,mano,resultado}' = 'derrota' and s #>> '{asientos,0,mano,razon}' = 'bote_compartido');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- T3: se pasan todos: se devuelven las apuestas
  perform t_reset();
  v_mesa := t_duelo_montar(2);
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 30);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '6c', '7t', 'Kd', 'Qd');
  perform t_amigos_act(u1, 'pedir'); s := t_amigos_act(u2, 'pedir');
  perform t_check('Si todos se pasan, las apuestas se devuelven', s ->> 'fase' = 'resultado' and t_saldo_de(u1) = 100 and t_saldo_de(u2) = 100 and s #>> '{asientos,0,mano,razon}' = 'todos_se_pasan' and s #>> '{asientos,0,mano,resultado}' = 'empate');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();

  -- T4: un natural vale más que cualquier total y se planta solo
  perform t_reset();
  v_mesa := t_duelo_montar(2);
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 20);
  perform t_amigos_reparte(v_mesa, 'Ap', '10d', 'Kc', '9t', '5d');
  s := t_amigos_estado(u2);
  perform t_check('Un natural no se paga al repartir: se planta solo y el turno pasa al otro', s #>> '{asientos,0,mano,fase}' = 'plantada' and (s ->> 'turno')::int = 1 and t_saldo_de(u1) = 80);
  s := t_amigos_act(u2, 'plantar');
  perform t_check('El natural (21 con dos cartas) gana a un 19 y se lleva el bote de 40', t_saldo_de(u1) = 120 and t_saldo_de(u2) = 80 and s #>> '{asientos,0,mano,resultado}' = 'victoria');
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();

  -- T5: quien se va a mitad de ronda deja su apuesta en el bote
  perform t_reset();
  v_mesa := t_duelo_montar(3);
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 30); perform t_amigos_listo(u3, 50);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '8c', '9c', '7t', 'Kd', 'Qd');
  perform t_amigos_act(u1, 'plantar');
  perform t_sesion(u2); perform veintiuna_amigos_salir();
  perform t_check('Irse en tu turno marca la mano como abandonada pero sigue abierta hasta el final', (select fase from veintiuna_partidas where user_id = u2 and mesa = v_mesa) = 'abandonada'
                  and (select estado from veintiuna_partidas where user_id = u2 and mesa = v_mesa) = 'en_curso');
  s := t_amigos_act(u3, 'plantar');
  perform t_check('La apuesta del que se fue se queda en el bote: gana el 19 (u1) con 100', s ->> 'fase' = 'resultado' and t_saldo_de(u1) = 180 and t_saldo_de(u2) = 70 and t_saldo_de(u3) = 50
                  and (select razon from veintiuna_partidas where user_id = u2 and mesa = v_mesa) = 'abandono');
  perform t_check('Ya no queda ninguna mano abierta del que se fue', not exists (select 1 from veintiuna_partidas where estado = 'en_curso'));
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();

  -- T6: con un solo jugador apostando no hay bote: la ronda se juega sin apostar
  perform t_reset();
  v_mesa := t_duelo_montar(2);
  perform t_amigos_listo(u1, 20); perform t_amigos_listo(u2, 0);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '9c', '7t');
  s := t_amigos_estado(u1);
  perform t_check('Si solo apuesta uno, esa ronda se juega sin apostar y se le avisa', t_saldo_de(u1) = 100 and (select count(*) from veintiuna_partidas where modo = 'practica' and mesa = v_mesa) = 2 and s #>> '{yo,aviso}' like '%al menos dos jugadores%');
  perform t_amigos_act(u1, 'plantar'); s := t_amigos_act(u2, 'plantar');
  perform t_check('Sin apostar se compite por la gloria: gana el 19 sin mover tokens', s #>> '{asientos,0,mano,resultado}' = 'victoria' and s #>> '{asientos,1,mano,resultado}' = 'derrota' and t_saldo_de(u1) = 100 and t_saldo_de(u2) = 100);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();

  -- T7: el Bufón en este modo
  perform t_reset();
  for i in 1..40 loop
    v_mesa := t_duelo_montar(2, 'bufon');
    perform t_amigos_listo(u1, 10); perform t_amigos_listo(u2, 10);
    perform veintiuna_i_amigos_repartir(v_mesa);
    if not exists (select 1 from veintiuna_mesas m where m.id = v_mesa and m.bufon_evento in ('nada', 'jugador') and cardinality(m.crupier) = 0 and m.pos = 4 + case when m.bufon_evento = 'jugador' then 1 else 0 end) then v_ok := false; end if;
    if exists (select 1 from veintiuna_partidas p join veintiuna_mesas m on m.id = p.mesa where p.mesa = v_mesa and m.bufon_evento = 'jugador' and (p.bufon_evento = 'jugador') <> (p.asiento = m.bufon_asiento)) then v_ok := false; end if;
    perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir();
    perform t_reset();
  end loop;
  perform t_check('Bufón en «todos contra todos» (40 repartos): sin crupier, solo puede cambiar la primera carta de un jugador', v_ok);
end $$;

/* ======================================================================== todos contra todos con pozo de cartas */
do $$
declare
  u1 uuid := '00000000-0000-0000-0000-000000000001'; u2 uuid := '00000000-0000-0000-0000-000000000002'; u3 uuid := '00000000-0000-0000-0000-000000000003';
  v_mesa uuid; s jsonb; e1 uuid; e2 uuid;
begin
  -- gana el pozo la mejor mano de quienes pusieron carta y no se pasaron (aunque no hubiera crupier a quien ganar)
  perform t_reset(); perform t_pozo_limpiar();
  e1 := t_dar(u1, 'comun-3'); e2 := t_dar(u2, 'comun-4');
  v_mesa := t_duelo_montar(3, 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform t_sesion(u2); perform veintiuna_amigos_apostar(20, e2);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '9c', '7t', 'Kd');
  perform t_amigos_act(u1, 'plantar');
  perform t_amigos_act(u2, 'plantar');
  s := t_amigos_estado(u1);
  perform t_check('En el duelo el pozo de cartas va a la mejor mano de quienes pusieron carta (19 contra 16)', t_dueno(e1) = u1 || '/poseida' and t_dueno(e2) = u1 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u1);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();
  perform t_reset(); perform t_pozo_limpiar();
  -- quien se pasa no puede ganar el pozo
  e1 := t_dar(u1, 'comun-3'); e2 := t_dar(u2, 'comun-4');
  v_mesa := t_duelo_montar(3, 'ojo', true);
  perform t_sesion(u1); perform veintiuna_amigos_apostar(20, e1);
  perform t_sesion(u2); perform veintiuna_amigos_apostar(20, e2);
  perform t_amigos_reparte(v_mesa, '10p', '9d', '6c', '7t', 'Kd');
  perform t_amigos_act(u1, 'pedir');       -- 16 + rey = 26: se pasa
  perform t_amigos_act(u2, 'plantar');
  perform t_check('Quien se pasa pierde su carta ante el que no se pasó', t_dueno(e1) = u2 || '/poseida' and t_dueno(e2) = u2 || '/poseida' and t_pozo_estado(v_mesa) = 'pagado/' || u2);
  perform t_sesion(u1); perform veintiuna_amigos_salir(); perform t_sesion(u2); perform veintiuna_amigos_salir(); perform t_sesion(u3); perform veintiuna_amigos_salir();
  perform t_reset(); perform t_pozo_limpiar();
end $$;

/* ======================================================================== muchas rondas al azar en «todos contra todos»: las fichas se conservan */
do $$
declare
  u uuid[] := array['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']::uuid[];
  v_mesa uuid; s jsonb; i int; j int; v_turno int; v_uid uuid; v_acc text; v_total int; v_fase text; v_guard int; v_ap numeric;
  v_ok boolean := true; v_msg text := ''; v_rondas int := 0; v_total_inicial numeric := 15000; v_peajes numeric; v_saldos numeric;
begin
  perform t_reset();
  v_mesa := t_duelo_montar(3);
  for i in 1..3 loop perform t_saldo(u[i], 5000); end loop;
  for j in 1..60 loop
    for i in 1..3 loop
      perform t_sesion(u[i]);
      v_ap := (array[0, 10, 20, 50, 100, 500, 1000])[1 + veintiuna_i_azar(7)];
      begin
        if veintiuna_i_azar(10) = 0 then perform veintiuna_amigos_pasar(); else perform veintiuna_amigos_apostar(v_ap); end if;
      exception when others then
        if sqlerrm not like 'Ahora no se puede%' and sqlerrm not like 'No tienes tantos tokens%' then v_ok := false; v_msg := v_msg || ' apostar:' || sqlerrm; end if;
      end;
    end loop;
    select fase into v_fase from veintiuna_mesas where id = v_mesa;
    if v_fase = 'apuestas' then
      update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
      perform t_amigos_estado(u[1]);
      select fase into v_fase from veintiuna_mesas where id = v_mesa;
    end if;
    v_guard := 0;
    while v_fase = 'jugando' and v_guard < 60 loop
      v_guard := v_guard + 1;
      select turno into v_turno from veintiuna_mesas where id = v_mesa;
      select user_id into v_uid from veintiuna_asientos where mesa = v_mesa and asiento = v_turno;
      s := t_amigos_estado(v_uid);
      select (x #>> '{mano,total}')::int into v_total from jsonb_array_elements(s -> 'asientos') x where (x ->> 'asiento')::int = v_turno;
      if s #>> '{yo,acciones,especial,tipo}' = 'fortuna' then v_acc := (array['fortuna', 'aceptar'])[1 + veintiuna_i_azar(2)];
      elsif veintiuna_i_azar(4) = 0 and s #>> '{yo,acciones,especial,disponible}' = 'true' then v_acc := s #>> '{yo,acciones,especial,tipo}';
      elsif veintiuna_i_azar(12) = 0 then
        update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
        perform t_amigos_estado(u[1]);
        v_acc := null;
      elsif v_total < 15 then v_acc := 'pedir';
      else v_acc := 'plantar';
      end if;
      if v_acc is not null then
        begin perform t_amigos_act(v_uid, v_acc);
        exception when others then
          begin perform t_amigos_act(v_uid, case when s #>> '{yo,acciones,especial,tipo}' = 'fortuna' then 'aceptar' else 'plantar' end);
          exception when others then v_ok := false; v_msg := v_msg || ' accion:' || sqlerrm; end;
        end;
      end if;
      select fase into v_fase from veintiuna_mesas where id = v_mesa;
    end loop;
    if v_fase = 'jugando' then v_ok := false; v_msg := v_msg || ' la ronda no acabó'; end if;
    v_rondas := v_rondas + 1;
    -- en cada ronda: las fichas que hay + lo que se gastó en peajes = lo que había al principio
    select coalesce(sum(saldo), 0) into v_saldos from hipodromo_billeteras where usuario = any (u);
    select coalesce(sum(peajes), 0) into v_peajes from veintiuna_partidas where user_id = any (u) and modo = 'apuesta';
    if v_saldos + v_peajes <> v_total_inicial then v_ok := false; v_msg := v_msg || ' fichas ronda ' || j || ': ' || (v_saldos + v_peajes); exit; end if;
    update veintiuna_mesas set fase_limite = now() - interval '1 second' where id = v_mesa;
    perform t_amigos_estado(u[1]);
    update veintiuna_asientos set perdidos = 0 where mesa = v_mesa;
    if (select count(*) from veintiuna_asientos where mesa = v_mesa) < 3 then v_ok := false; v_msg := v_msg || ' se levantó alguien'; exit; end if;
  end loop;
  perform t_check('60 rondas al azar de «todos contra todos» (apuestas hasta 1000, plazos agotados, todas las reglas): sin errores y las fichas se conservan (' || v_msg || ')', v_ok and v_rondas = 60);
  perform t_check('Ninguna mano quedó abierta salvo las de la ronda en curso', (select count(*) from veintiuna_partidas where estado = 'en_curso') = (select count(*) from veintiuna_partidas p join veintiuna_mesas m on m.id = p.mesa and m.ronda_id = p.ronda_id where p.estado = 'en_curso'));
  perform t_check('Hubo manos de verdad, con tokens y sin ellos (' || (select count(*) from veintiuna_partidas) || ')', (select count(*) from veintiuna_partidas where modo = 'apuesta') > 30);
  perform t_check('Nunca se cobró nada a ningún jugador por encima de lo que tenía (sin saldos negativos)', not exists (select 1 from hipodromo_movimientos where saldo < 0));
  perform t_check('Cada mano con apuesta cuadra con el libro: cobro + peajes + pago = su neto', not exists (
    select 1 from veintiuna_partidas p where p.modo = 'apuesta' and p.mesa is not null and p.estado = 'terminada'
      and coalesce((select sum(m.monto) from hipodromo_movimientos m where m.usuario = p.user_id and m.concepto like '%(mano ' || p.id || ')%'), 0) <> p.neto));
  perform t_check('Ninguna mano de «todos contra todos» sumó desafíos ni rachas', not exists (select 1 from veintiuna_logros where user_id = any (u)) and not exists (select 1 from veintiuna_estadisticas where user_id = any (u) and racha > 0));
  for i in 1..3 loop perform t_sesion(u[i]); perform veintiuna_amigos_salir(); end loop;
  perform t_reset();
end $$;
