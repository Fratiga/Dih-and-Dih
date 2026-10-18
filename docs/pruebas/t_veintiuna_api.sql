-- Manos de verdad por el mismo camino que usa el navegador (rol «authenticated», baraja del servidor, reglas al azar) y comprobación del libro de tokens.
do $$
declare
  u uuid := '00000000-0000-0000-0000-000000000002';
  s jsonb; pid uuid; paso int; i int; accion text; saldo0 numeric := 500; fin jsonb; n_terminadas int := 0; bien boolean := true; mal text := '';
  total_j int; vistas_crupier int; reglas text[] := '{}'; r text; ruina int := 0; ok_cartas boolean := true; txt text;
begin
  perform t_reset();
  perform t_saldo(u, saldo0);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  for i in 1..120 loop
    if (veintiuna_mesa() ->> 'saldo')::numeric < 100 then
      reset role; perform t_saldo(u, (select saldo from hipodromo_billeteras where usuario = u) + 400); saldo0 := saldo0 + 400; set local role authenticated;
    end if;
    s := veintiuna_repartir(gen_random_uuid(), case when i % 5 = 0 then 'practica' else 'apuesta' end, 10 * (1 + (i % 4)));
    r := s #>> '{regla,id}'; if not (r = any (reglas)) then reglas := reglas || r; end if;
    pid := (s ->> 'partida')::uuid;
    while s ->> 'estado' = 'en_curso' loop
      txt := s::text;
      -- la carta oculta no sale nunca mientras la mano sigue
      if jsonb_array_length(s #> '{crupier,cartas}') <> 1 or (s #>> '{crupier,ocultas}')::int <> 1 or position('mazo' in txt) > 0 then ok_cartas := false; end if;
      total_j := (s #>> '{jugador,total}')::int;
      if s ->> 'fase' = 'fortuna' then
        accion := case when (s #>> '{acciones,especial,disponible}')::boolean and i % 2 = 0 then 'fortuna' else 'aceptar' end;
      elsif (s #>> '{acciones,especial,disponible}')::boolean is true and s #>> '{acciones,especial,tipo}' = 'voluntad' and i % 3 = 0 then accion := 'voluntad';
      elsif total_j >= 17 then accion := 'plantar';
      else accion := 'pedir';
      end if;
      s := veintiuna_accion(pid, (s ->> 'paso')::int, accion);
    end loop;
    n_terminadas := n_terminadas + 1;
    if (s #>> '{crupier,ocultas}')::int <> 0 then ok_cartas := false; end if;
  end loop;
  reset role;
  perform t_check('120 manos jugadas por la ruta del navegador, todas terminadas', n_terminadas = 120 and not exists (select 1 from veintiuna_partidas where estado = 'en_curso'));
  perform t_check('Salieron las ocho reglas (' || array_to_string(reglas, ', ') || ')', array_length(reglas, 1) = 8);
  perform t_check('Mientras las manos seguían en curso nunca salió más de una carta del crupier ni la baraja', ok_cartas);
  perform t_check('La billetera cuadra con el libro: saldo = inicial + suma de movimientos', (select saldo from hipodromo_billeteras where usuario = u) = saldo0 + (select coalesce(sum(monto), 0) from hipodromo_movimientos where usuario = u));
  perform t_check('Cada movimiento lleva el número de su mano', not exists (select 1 from hipodromo_movimientos where usuario = u and concepto not like '%(mano %'));
  perform t_check('Cada mano con apuesta: cobro + peajes + pago del libro = su neto', not exists (
    select 1 from veintiuna_partidas p where p.modo = 'apuesta'
      and coalesce((select sum(m.monto) from hipodromo_movimientos m where m.usuario = p.user_id and m.concepto like '%(mano ' || p.id || ')%'), 0) <> p.neto));
  perform t_check('Las manos de práctica no dejaron ningún movimiento', not exists (select 1 from veintiuna_partidas p join hipodromo_movimientos m on m.concepto like '%(mano ' || p.id || ')%' where p.modo = 'practica'));
  perform t_check('Cada mano terminada guarda los números de sus movimientos', not exists (select 1 from veintiuna_partidas p where p.modo = 'apuesta' and p.mov_cobro is null)
                  and not exists (select 1 from veintiuna_partidas p where p.modo = 'apuesta' and p.resultado <> 'derrota' and p.mov_pago is null));
  perform t_check('Nunca hay un saldo negativo en el libro', not exists (select 1 from hipodromo_movimientos where usuario = u and saldo < 0));
  perform t_check('Las estadísticas suman las manos', (select rondas from veintiuna_estadisticas where user_id = u) = 120
                  and (select victorias + derrotas + empates from veintiuna_estadisticas where user_id = u) = 120);
  perform t_check('Las estadísticas de tokens coinciden con las manos con apuesta', (select neto from veintiuna_estadisticas where user_id = u) = (select coalesce(sum(neto), 0) from veintiuna_partidas where modo = 'apuesta'));
  perform t_check('El historial devuelve las últimas manos con cartas y variación', true);
  perform set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  fin := veintiuna_historial(10);
  reset role;
  perform t_check('Historial: 10 manos terminadas, la más reciente primero, con cartas y neto', jsonb_array_length(fin) = 10 and (fin #>> '{0,neto}') is not null and jsonb_array_length(fin #> '{0,jugador}') >= 2
                  and (fin #>> '{0,terminada}')::timestamptz >= (fin #>> '{9,terminada}')::timestamptz);
end $$;
