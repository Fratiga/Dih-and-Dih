#!/bin/sh
# El Pozo del Dragón (docs/pozo-dragon.sql): combinaciones y dados, oculto/abierto, Duelo, Pozo Compartido, modo solitario, salas, partidas al azar, permisos y peticiones simultáneas.
# Uso: sh docs/pruebas/cargar_local.sh todo && sh docs/pruebas/t_pozo_dragon.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
AQUI="$(cd "$(dirname "$0")" && pwd)"
DOCS="$(cd "$AQUI/.." && pwd)"

echo "== Reglas, economía, cartas, plazos y partidas al azar (SQL)"
SALIDA=$(docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=0 < "$AQUI/t_pozo_dragon.sql" 2>&1)
printf '%s\n' "$SALIDA" | grep -E 'NOTICE:  (OK|FALLA)' | sed -E 's/^psql:[^ ]* ?//; s/NOTICE:  OK   /  OK   /; s/NOTICE:  FALLA /  FALLA /'
N_FALLA=$(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  FALLA')
N_OK=$(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  OK')
ERRORES=$(printf '%s\n' "$SALIDA" | grep -E 'ERROR|error:' | head -5)
[ -n "$ERRORES" ] && { echo "  FALLA errores de SQL en las pruebas:"; printf '%s\n' "$ERRORES"; FALLOS=$((FALLOS + 1)); }
FALLOS=$((FALLOS + N_FALLA))
echo "  ($N_OK comprobaciones correctas)"

# Las pruebas sustituyeron la función de los dados por una con cola: se vuelve a cargar la original (y se abre el juego solo para estas pruebas)
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$DOCS/pozo-dragon.sql" >/dev/null 2>&1 || { echo "  FALLA no se pudo recargar docs/pozo-dragon.sql"; FALLOS=$((FALLOS + 1)); }
sql "delete from t_dados; update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico'" >/dev/null
comprobar "la función de los dados vuelve a ser la original (sin cola de pruebas)" "f" "$(sql "select pg_get_functiondef('pozo_i_dado'::regproc) like '%t_dados%'" | sed 's/^t$/t/')"

echo "== Permisos"
sql "select t_pz_reset()" >/dev/null
sql "update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico'; insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1000), ('$U2', 1000), ('$U3', 1000), ('$U4', 1000) on conflict (usuario) do update set saldo = 1000" >/dev/null
for f in "pozo_lista()" "pozo_crear('duelo', true, null, 50, 0, null)" "pozo_unirse('ABCDE')" "pozo_cerrar_inscripcion()" "pozo_ofrecer('{}')" "pozo_confirmar(1)" "pozo_retirar_confirmacion()" "pozo_salir()" \
         "pozo_tirar(0)" "pozo_cobrar(0)" "pozo_continuar(0)" "pozo_estado(null)" "pozo_mis_cartas()" "pozo_solo_estado()" "pozo_solo_empezar(gen_random_uuid(), 10)" "pozo_solo_tirar(gen_random_uuid(), 0)" \
         "pozo_solo_cobrar(gen_random_uuid(), 0)" "pozo_solo_descartar()" "pozo_desafios()" "pozo_reclamar('una_mas')"; do
  contiene "sin sesión no se puede llamar a $(printf '%s' "$f" | cut -d'(' -f1)" "$(anonimo "select $f;")" "permission denied"
done
for f in "pozo_i_tirar(gen_random_uuid(), 0, null, false)" "pozo_i_json(gen_random_uuid(), '$U1')" "pozo_i_terminar_duelo(gen_random_uuid(), 0, 'x')" "pozo_i_terminar_compartido(gen_random_uuid(), 'x')" "pozo_i_abonar('$U1', 1000, 'regalo')" \
         "pozo_i_debitar('$U1', 1, 'x')" "pozo_i_dado()" "pozo_i_pagar(gen_random_uuid(), 0, 100, 'x')" "pozo_i_devolver(gen_random_uuid(), 0, 'x')" "pozo_i_empezar(gen_random_uuid())" "pozo_i_avanzar(gen_random_uuid())" \
         "pozo_i_solo_cerrar(gen_random_uuid(), 'cobro')" "pozo_i_solo_accion(gen_random_uuid(), 0, 'tirar')" "pozo_i_solo_premio(100, 5, 1)" "pozo_i_acceso()" "pozo_i_logros_solo(gen_random_uuid())" "pozo_i_logros_duelo(gen_random_uuid(), 0)" "pozo_i_logros_compartido(gen_random_uuid())" "pozo_i_contar('$U1', 'x', 'suma', 1)" "pozo_i_comprobar('$U1')" "pozo_i_dia('$U1')"; do
  contiene "un jugador no puede llamar a la función interna $(printf '%s' "$f" | cut -d'(' -f1)" "$(como $U1 "select $f;")" "permission denied"
done
R=$(como $U1 "select pozo_crear('compartido', false, 'Permisos', 50, 0, 3) ->> 'codigo';" | tail -1)
comprobar "un jugador con sesión crea una mesa" "5" "$(printf '%s' "$R" | tr -d '\n' | wc -c | tr -d ' ')"
comprobar "un jugador no lee las tablas del juego (llevan las barajas de cartas y los dados)" "0|0|0|0|0" "$(como $U1 "select count(*) from pozo_mesas;" | tail -1)|$(como $U1 "select count(*) from pozo_jugadores;" | tail -1)|$(como $U1 "select count(*) from pozo_tiradas;" | tail -1)|$(como $U1 "select count(*) from pozo_rondas;" | tail -1)|$(como $U1 "select count(*) from pozo_solo;" | tail -1)"
comprobar "el admin sí puede revisarlas" "1" "$(como $ADMIN "select count(*) from pozo_mesas;" | tail -1)"
for t in "update pozo_mesas set estado = 'terminada'" "delete from pozo_mesas" "insert into pozo_jugadores (mesa, asiento, user_id, nombre) values (gen_random_uuid(), 1, '$U2', 'x')" "update pozo_jugadores set dinero = 100000" \
         "insert into pozo_tiradas (mesa, asiento, ronda, n, d1, d2, d3, categoria) values (gen_random_uuid(), 0, 1, 1, 6, 6, 6, 'triple_seis')" "update pozo_solo set bono = 100" "delete from pozo_solo" "insert into pozo_rondas (mesa, ronda, ganador) values (gen_random_uuid(), 1, 0)"; do
  contiene "escribir directo en las tablas está prohibido: $(printf '%s' "$t" | cut -c1-52)" "$(como $U1 "$t;")" "permission denied"
done
como $U1 "update hipodromo_billeteras set saldo = 999999 where usuario = '$U1';" >/dev/null
comprobar "nadie puede cambiar su saldo a mano (el saldo sigue en 1000)" "1000" "$(sql "select saldo::int from hipodromo_billeteras where usuario = '$U1'")"
sql "update hipodromo_billeteras set saldo = 1000 where usuario = '$U1'; select t_pz_reset()" >/dev/null
sql "update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico'; insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1000), ('$U2', 1000), ('$U3', 1000), ('$U4', 1000) on conflict (usuario) do update set saldo = 1000" >/dev/null

echo "== Desafíos y recompensas de cartas"
sql "select t_pz_reset()" >/dev/null
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1000) on conflict (usuario) do update set saldo = 1000; update cartas_juegos set activo = false where juego = 'pozo_dragon'" >/dev/null
sql "insert into pozo_progreso (user_id) values ('$U1') on conflict do nothing; insert into pozo_logros (user_id, logro) values ('$U1', 'una_mas')" >/dev/null
contiene "los desafíos de hoy salen con el de «Una más» completado y sin reclamar" "$(como $U1 "select pozo_desafios() -> 'desafios' -> 0;")" '"completado": true'
contiene "con el juego apagado reclamar no da nada" "$(como $U1 "select pozo_reclamar('una_mas');")" "juego-inactivo"
comprobar "y el desafío sigue sin gastar" "" "$(sql "select reclamado from pozo_logros where user_id = '$U1' and logro = 'una_mas'")"
contiene "un desafío sin completar no se reclama" "$(como $U1 "select pozo_reclamar('remontada');")" "todavía no está completado"
contiene "un desafío que no existe tampoco" "$(como $U1 "select pozo_reclamar('inventado');")" "no existe"
sql "update cartas_juegos set activo = true where juego = 'pozo_dragon'" >/dev/null
R=$(como $U1 "select pozo_reclamar('una_mas');")
contiene "encendido el juego, reclamar da una carta" "$R" '"resultado": "carta"'
contiene "de nivel «bueno» (bronce)" "$R" '"tramo": "bueno"'
comprobar "la copia está en la colección de quien reclamó y sale del libro como minijuego" "1|1" "$(sql "select count(*) from cartas_ejemplares where propietario = '$U1'")|$(sql "select count(*) from cartas_movimientos where a = '$U1' and motivo like 'minijuego%pozo_dragon%'")"
contiene "no se reclama dos veces" "$(como $U1 "select pozo_reclamar('una_mas');")" "Ya reclamaste"
sql "insert into pozo_logros (user_id, logro) values ('$U1', 'diezmo'), ('$U1', 'doble_o_nada') on conflict do nothing" >/dev/null
R=$(como $U1 "select pozo_reclamar('diezmo');")
contiene "la segunda carta del día sí sale (tope de dos al día, como Las Veintiuna Velas)" "$R" '"resultado": "carta"'
R=$(como $U1 "select pozo_reclamar('doble_o_nada');")
contiene "la tercera no sale: tope diario" "$R" "tope-diario"
comprobar "y ese desafío sigue guardado" "" "$(sql "select reclamado from pozo_logros where user_id = '$U1' and logro = 'doble_o_nada'")"
sql "update cartas_recompensas_registro set creado = creado - interval '1 day'" >/dev/null
R=$(como $U1 "select pozo_reclamar('doble_o_nada');")
contiene "al día siguiente sí, y un desafío de plata es de nivel «excelente»" "$R" '"tramo": "excelente"'
comprobar "sin sellos ni restos en el progreso general" "0" "$(sql "select coalesce(sum(sellos), 0) from cartas_progreso where user_id = '$U1' and juego = 'pozo_dragon'")"
sql "select t_pz_reset()" >/dev/null
sql "update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico'; insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1000), ('$U2', 1000), ('$U3', 1000), ('$U4', 1000) on conflict (usuario) do update set saldo = 1000" >/dev/null

echo "== Peticiones simultáneas"
TMP=$(mktemp -d)
# Solitario: la misma petición de empezar dos veces a la vez
CLI=$(sql "select gen_random_uuid()")
como $U1 "select pozo_solo_empezar('$CLI', 100) ->> 'id';" 1 > "$TMP/a" &
como $U1 "select pozo_solo_empezar('$CLI', 100) ->> 'id';" 1 > "$TMP/b" &
wait
comprobar "empezar dos veces a la vez con el mismo identificador: una sola partida y una sola apuesta descontada" "1|900" "$(sql "select count(*) from pozo_solo where user_id = '$U1'")|$(sql "select saldo::int from hipodromo_billeteras where usuario = '$U1'")"
comprobar "y las dos respuestas son la misma partida" "1" "$(cat "$TMP/a" "$TMP/b" | grep -E '^[0-9a-f-]{36}$' | sort -u | wc -l | tr -d ' ')"
sql "delete from pozo_solo; update hipodromo_billeteras set saldo = 1000 where usuario = '$U1'; delete from hipodromo_movimientos" >/dev/null
# Solitario: dos partidas distintas a la vez
C1=$(sql "select gen_random_uuid()"); C2=$(sql "select gen_random_uuid()")
como $U1 "select pozo_solo_empezar('$C1', 100) ->> 'id';" 1 > "$TMP/a" &
como $U1 "select pozo_solo_empezar('$C2', 100) ->> 'id';" 1 > "$TMP/b" &
wait
comprobar "dos partidas distintas a la vez: solo una se abre y solo se cobra una apuesta" "1|900|1" "$(sql "select count(*) from pozo_solo where user_id = '$U1'")|$(sql "select saldo::int from hipodromo_billeteras where usuario = '$U1'")|$(sql "select count(*) from hipodromo_movimientos where usuario = '$U1'")"
contiene "la otra recibe un error claro" "$(cat "$TMP/a" "$TMP/b")" "Ya tienes una partida en solitario"
# Solitario: cobrar dos veces a la vez
ID=$(sql "select id from pozo_solo where user_id = '$U1'")
sql "update pozo_solo set fase = 'decidir', tiradas = 1, bono = 0.25, paso = 1 where id = '$ID'" >/dev/null
como $U1 "select pozo_solo_cobrar('$ID', 1) ->> 'pago';" 1 > "$TMP/a" &
como $U1 "select pozo_solo_cobrar('$ID', 1) ->> 'pago';" 1 > "$TMP/b" &
wait
comprobar "cobrar dos veces a la vez: se paga una sola vez (118,75 = 900 + 118,75)" "terminada|1018.75|2" "$(sql "select estado from pozo_solo where id = '$ID'")|$(sql "select saldo from hipodromo_billeteras where usuario = '$U1'")|$(sql "select count(*) from hipodromo_movimientos where usuario = '$U1'")"
# Solitario: tirar dos veces a la vez con el mismo paso
sql "delete from pozo_solo; update hipodromo_billeteras set saldo = 1000 where usuario = '$U1'; delete from hipodromo_movimientos" >/dev/null
ID=$(como $U1 "select pozo_solo_empezar(gen_random_uuid(), 100) ->> 'id';" | tail -1)
como $U1 "select pozo_solo_tirar('$ID', 0) ->> 'tiradas';" 1 > "$TMP/a" &
como $U1 "select pozo_solo_tirar('$ID', 0) ->> 'tiradas';" 1 > "$TMP/b" &
wait
comprobar "tirar dos veces a la vez con el mismo paso: una sola tirada" "1" "$(sql "select count(*) from pozo_solo_tiradas where solo = '$ID'")"
sql "delete from pozo_solo; select t_pz_reset()" >/dev/null
sql "update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico'; insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1000), ('$U2', 1000), ('$U3', 1000), ('$U4', 1000) on conflict (usuario) do update set saldo = 1000" >/dev/null
# Mesas: tres jugadores se unen a la vez a un duelo (caben dos)
COD=$(como $U1 "select pozo_crear('duelo', false, 'Carrera', 100, 0, null) ->> 'codigo';" | tail -1)
como $U2 "select pozo_unirse('$COD') ->> 'estado';" 1 > "$TMP/a" &
como $U3 "select pozo_unirse('$COD') ->> 'estado';" 1 > "$TMP/b" &
como $U4 "select pozo_unirse('$COD') ->> 'estado';" 1 > "$TMP/c" &
wait
comprobar "tres entran a la vez en un duelo: se sientan justo dos (con el creador)" "2" "$(sql "select count(*) from pozo_jugadores where mesa = (select id from pozo_mesas where codigo = '$COD')")"
contiene "a los que no cabían se les dice que está cerrada o llena" "$(cat "$TMP/a" "$TMP/b" "$TMP/c")" "ya no admite jugadores"
# Mesas: confirmar dos veces a la vez
ENTRA=$(sql "select user_id from pozo_jugadores where mesa = (select id from pozo_mesas where codigo = '$COD') and user_id <> '$U1' limit 1")
CONDV=$(sql "select cond_version from pozo_mesas where codigo = '$COD'")
como $U1 "select pozo_confirmar($CONDV) ->> 'estado';" 1 > "$TMP/a" &
como $U1 "select pozo_confirmar($CONDV) ->> 'estado';" 1 > "$TMP/b" &
wait
comprobar "confirmar dos veces a la vez: una sola reserva de 100" "900" "$(sql "select saldo::int from hipodromo_billeteras where usuario = '$U1'")"
como $ENTRA "select pozo_confirmar($CONDV) ->> 'estado';" >/dev/null
comprobar "con los dos confirmados la partida está en juego y hay 200 reservados" "jugando|200" "$(sql "select estado from pozo_mesas where codigo = '$COD'")|$(sql "select (sum(dinero))::int from pozo_jugadores where mesa = (select id from pozo_mesas where codigo = '$COD')")"
# Mesas: el jugador al que le toca tira dos veces a la vez, y el otro intenta tirar fuera de turno
TURNO=$(sql "select j.user_id from pozo_mesas m join pozo_jugadores j on j.mesa = m.id and j.asiento = m.turno where m.codigo = '$COD'")
OTRO=$(sql "select user_id from pozo_jugadores where mesa = (select id from pozo_mesas where codigo = '$COD') and user_id <> '$TURNO'")
PASO=$(sql "select paso from pozo_mesas where codigo = '$COD'")
como $TURNO "select pozo_tirar($PASO) ->> 'paso';" 1 > "$TMP/a" &
como $TURNO "select pozo_tirar($PASO) ->> 'paso';" 1 > "$TMP/b" &
como $OTRO "select pozo_tirar($PASO);" 1 > "$TMP/c" &
wait
comprobar "tirar dos veces a la vez con el mismo paso, y el rival fuera de turno: se anota una sola tirada" "1" "$(sql "select count(*) from pozo_tiradas where mesa = (select id from pozo_mesas where codigo = '$COD')")"
sql "select pozo_i_terminar_duelo((select id from pozo_mesas where codigo = '$COD'), null, 'prueba')" >/dev/null
comprobar "al acabar el duelo (empate de prueba) el dinero vuelve entero y no queda nada bloqueado" "4000" "$(sql "select (sum(saldo))::int from hipodromo_billeteras where usuario in ('$U1', '$U2', '$U3', '$U4')")"
rm -rf "$TMP"

# Deja la base como estaba para quien venga después: juego oculto y sin partidas
sql "select t_pz_reset(); update cartas_economia_ajustes set valor = 'false' where clave = 'pozo_dragon_publico'" >/dev/null

[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
