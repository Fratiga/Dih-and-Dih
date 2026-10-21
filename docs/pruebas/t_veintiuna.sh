#!/bin/sh
# Las Veintiuna Velas (docs/veintiuna.sql): reglas, reglas especiales, carta oculta, economía, idempotencia, permisos, desafíos y recompensas.
# Uso: sh docs/pruebas/cargar_local.sh todo && sh docs/pruebas/t_veintiuna.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "== Reglas del juego (SQL)"
SALIDA=$(docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=0 < "$AQUI/t_veintiuna.sql" 2>&1)
printf '%s\n' "$SALIDA" | grep -E 'NOTICE:  (OK|FALLA)' | sed -E 's/^psql:[^ ]* ?//; s/NOTICE:  OK   /  OK   /; s/NOTICE:  FALLA /  FALLA /'
N_FALLA=$(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  FALLA')
N_OK=$(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  OK')
ERRORES=$(printf '%s\n' "$SALIDA" | grep -E 'ERROR|error:' | head -5)
[ -n "$ERRORES" ] && { echo "  FALLA errores de SQL en las pruebas:"; printf '%s\n' "$ERRORES"; FALLOS=$((FALLOS + 1)); }
FALLOS=$((FALLOS + N_FALLA))
echo "  ($N_OK comprobaciones correctas)"

echo "== Manos por la ruta del navegador (barajas del servidor) y libro de tokens"
SALIDA=$(docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=0 < "$AQUI/t_veintiuna_api.sql" 2>&1)
printf '%s\n' "$SALIDA" | grep -E 'NOTICE:  (OK|FALLA)' | sed -E 's/NOTICE:  OK   /  OK   /; s/NOTICE:  FALLA /  FALLA /'
FALLOS=$((FALLOS + $(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  FALLA')))
ERRORES=$(printf '%s\n' "$SALIDA" | grep -E 'ERROR' | head -3); [ -n "$ERRORES" ] && { echo "  FALLA errores de SQL: $ERRORES"; FALLOS=$((FALLOS + 1)); }

echo "== Permisos"
sql "select t_reset()" >/dev/null
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 300), ('$U2', 300) on conflict (usuario) do update set saldo = 300" >/dev/null
CLI=$(sql "select gen_random_uuid()")
for f in "veintiuna_mesa()" "veintiuna_repartir('$CLI', 'practica', 0)" "veintiuna_accion('$CLI', 0, 'pedir')" "veintiuna_historial(5)" "veintiuna_reclamar('primera_vela')"; do
  contiene "sin sesión no se puede llamar a $f" "$(anonimo "select $f;")" "permission denied"
done
for f in "veintiuna_i_repartir('$U1', '$CLI', 'practica', 0, null)" "veintiuna_i_aplicar('$CLI', 'plantar')" "veintiuna_i_liquidar('$CLI', 'victoria', 'x')" "veintiuna_i_mazo()" "veintiuna_i_registrar(null)"; do
  contiene "un jugador no puede llamar a la función interna $(printf '%s' "$f" | cut -d'(' -f1)" "$(como $U1 "select $f;")" "permission denied"
done
R=$(como $U1 "select veintiuna_repartir('$CLI', 'apuesta', 20);")
contiene "un jugador con sesión reparte una mano (con un 9 % de naturales al repartir, puede acabar ya)" "$R" '"modo": "apuesta"'
PID=$(sql "select id from veintiuna_partidas where user_id = '$U1'")
comprobar "un jugador no lee la tabla de manos (lleva la baraja)" "0" "$(como $U1 "select count(*) from veintiuna_partidas;" | tail -1)"
comprobar "el admin sí puede revisarlas" "1" "$(como $ADMIN "select count(*) from veintiuna_partidas where user_id = '$U1';" | tail -1)"
RONDAS0=$(sql "select rondas from veintiuna_estadisticas where user_id = '$U1'")
contiene "otro jugador no puede actuar sobre mi mano" "$(como $U2 "select veintiuna_accion('$PID', 0, 'plantar');")" "No encuentro esa mano"
contiene "ni verla en su historial" "$(como $U2 "select veintiuna_historial(5);")" "[]"
for t in "insert into veintiuna_partidas (user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier) values ('$U1', gen_random_uuid(), 'practica', 10, 'fortuna', '{1}', 1, '{1}', '{2}')" \
         "update veintiuna_partidas set resultado = 'victoria'" "delete from veintiuna_partidas" \
         "update veintiuna_estadisticas set victorias = 99" "insert into veintiuna_logros (user_id, logro) values ('$U1', 'maestro')" "update veintiuna_logros set reclamado = null" "delete from veintiuna_logros" "update veintiuna_logros_def set meta = 1"; do
  contiene "escribir directo en las tablas está prohibido: $(printf '%s' "$t" | cut -c1-48)" "$(como $U1 "$t;")" "permission denied"
done
comprobar "las estadísticas propias se pueden leer y las ajenas no" "1|0" "$(como $U1 "select count(*) from veintiuna_estadisticas;" | tail -1)|$(como $U2 "select count(*) from veintiuna_estadisticas where user_id = '$U1';" | tail -1)"
como $U1 "update hipodromo_billeteras set saldo = 9999 where usuario = '$U1';" >/dev/null
comprobar "la billetera sigue como la dejó la mano (300 - 20 + lo que pagó) aunque se intente cambiar a mano" "t" "$(sql "select b.saldo = 300 - p.apuesta + coalesce(p.pago, 0) from hipodromo_billeteras b join veintiuna_partidas p on p.user_id = b.usuario where b.usuario = '$U1'")"

echo "== Dos peticiones a la vez"
sql "delete from veintiuna_partidas; delete from hipodromo_movimientos; update hipodromo_billeteras set saldo = 300 where usuario in ('$U1', '$U2')" >/dev/null
TMP=$(mktemp -d)
# Una mano que termina al repartir (natural de alguien, un 9 % de las veces) no deja nada en curso: en ese caso se repite la prueba con otras cartas
for intento in 1 2 3 4 5 6; do
  sql "delete from veintiuna_partidas; delete from hipodromo_movimientos; update hipodromo_billeteras set saldo = 300 where usuario in ('$U1', '$U2')" >/dev/null
  C1=$(sql "select gen_random_uuid()"); C2=$(sql "select gen_random_uuid()")
  como $U1 "select veintiuna_repartir('$C1', 'apuesta', 20);" 1 > "$TMP/a" &
  como $U1 "select veintiuna_repartir('$C2', 'apuesta', 20);" 1 > "$TMP/b" &
  wait
  [ "$(sql "select count(*) from veintiuna_partidas where user_id = '$U1' and estado = 'en_curso'")" = 1 ] && [ "$(sql "select count(*) from veintiuna_partidas where user_id = '$U1'")" = 1 ] && break
done
comprobar "dos manos a la vez con identificadores distintos: solo una se reparte" "1" "$(sql "select count(*) from veintiuna_partidas where user_id = '$U1'")"
comprobar "y solo se cobró una apuesta (saldo 280, un movimiento)" "t|1" "$(sql "select saldo = 280 from hipodromo_billeteras where usuario = '$U1'")|$(sql "select count(*) from hipodromo_movimientos where usuario = '$U1'")"
contiene "la segunda recibe un error claro" "$(cat "$TMP/a" "$TMP/b")" "Ya tienes una mano en curso"
for intento in 1 2 3 4 5 6; do
  sql "delete from veintiuna_partidas; update hipodromo_billeteras set saldo = 300 where usuario = '$U1'; delete from hipodromo_movimientos" >/dev/null
  como $U1 "select veintiuna_repartir('$C1', 'apuesta', 20);" 1 > "$TMP/a" &
  como $U1 "select veintiuna_repartir('$C1', 'apuesta', 20);" 1 > "$TMP/b" &
  wait
  [ "$(sql "select count(*) from veintiuna_partidas where user_id = '$U1' and estado = 'en_curso'")" = 1 ] && break
  C1=$(sql "select gen_random_uuid()")
done
comprobar "la misma petición dos veces a la vez: una sola mano y una sola apuesta cobrada" "1|t|1" "$(sql "select count(*) from veintiuna_partidas where user_id = '$U1'")|$(sql "select saldo = 280 from hipodromo_billeteras where usuario = '$U1'")|$(sql "select count(*) from hipodromo_movimientos where usuario = '$U1'")"
PID=$(sql "select id from veintiuna_partidas where user_id = '$U1'")
RONDAS0=$(sql "select rondas from veintiuna_estadisticas where user_id = '$U1'")
como $U1 "select veintiuna_accion('$PID', 0, 'plantar');" 1 > "$TMP/a" &
como $U1 "select veintiuna_accion('$PID', 0, 'plantar');" 1 > "$TMP/b" &
wait
comprobar "plantarse dos veces a la vez: la mano se liquida una sola vez" "terminada|1" "$(sql "select estado from veintiuna_partidas where id = '$PID'")|$(sql "select rondas - $RONDAS0 from veintiuna_estadisticas where user_id = '$U1'")"
comprobar "como mucho un pago en el libro" "t" "$(sql "select count(*) <= 1 from hipodromo_movimientos where usuario = '$U1' and monto > 0")"
comprobar "el saldo cuadra con el libro" "t" "$(sql "select saldo = 300 + (select sum(monto) from hipodromo_movimientos where usuario = '$U1') from hipodromo_billeteras where usuario = '$U1'")"
rm -rf "$TMP"

echo "== Mesa con amigos: reglas, turnos, pozo de cartas y rondas al azar (SQL)"
SALIDA=$(docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=0 < "$AQUI/t_veintiuna_amigos.sql" 2>&1)
printf '%s\n' "$SALIDA" | grep -E 'NOTICE:  (OK|FALLA)' | sed -E 's/NOTICE:  OK   /  OK   /; s/NOTICE:  FALLA /  FALLA /'
FALLOS=$((FALLOS + $(printf '%s\n' "$SALIDA" | grep -c 'NOTICE:  FALLA')))
ERRORES=$(printf '%s\n' "$SALIDA" | grep -E 'ERROR' | head -3); [ -n "$ERRORES" ] && { echo "  FALLA errores de SQL: $ERRORES"; FALLOS=$((FALLOS + 1)); }

echo "== Mesa con amigos: permisos y peticiones simultáneas"
sql "select t_reset()" >/dev/null; limpiar
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 300), ('$U2', 300), ('$U3', 300), ('$U4', 300) on conflict (usuario) do update set saldo = 300" >/dev/null
for f in "veintiuna_amigos_lista()" "veintiuna_amigos_crear('x', true, false)" "veintiuna_amigos_unirse('ABCDE')" "veintiuna_amigos_salir()" "veintiuna_amigos_estado(null)" "veintiuna_amigos_mis_cartas()" "veintiuna_amigos_apostar(10, null)" "veintiuna_amigos_pasar()" "veintiuna_amigos_repartir()" "veintiuna_amigos_accion(0, 'pedir')"; do
  contiene "sin sesión no se puede llamar a $f" "$(anonimo "select $f;")" "permission denied"
done
for f in "veintiuna_i_amigos_repartir('$CLI', null)" "veintiuna_i_amigos_actuar('$CLI', 0, 'pedir', false)" "veintiuna_i_amigos_json('$CLI', '$U1')" "veintiuna_i_pozo_resolver('$CLI')" "veintiuna_i_amigos_sacar('$CLI', '$U1')" "veintiuna_i_amigos_avanzar('$CLI')" "veintiuna_i_mazo_doble()"; do
  contiene "un jugador no puede llamar a la función interna $(printf '%s' "$f" | cut -d'(' -f1)" "$(como $U1 "select $f;")" "permission denied"
done
contiene "con la sesión vacía la función se niega con un mensaje claro" "$(como $U1 "select set_config('request.jwt.claims', '', true); select veintiuna_amigos_lista();")" "Hay que iniciar sesión"
R=$(como $U1 "select veintiuna_amigos_crear('Permisos', true, false);")
contiene "un jugador con sesión crea una mesa" "$R" '"nombre": "Permisos"'
comprobar "un jugador no lee las tablas de mesas ni de asientos (llevan la baraja)" "0|0|0" "$(como $U1 "select count(*) from veintiuna_mesas;" | tail -1)|$(como $U1 "select count(*) from veintiuna_asientos;" | tail -1)|$(como $U1 "select count(*) from veintiuna_pozo_cartas;" | tail -1)"
comprobar "el admin sí puede revisarlas" "1" "$(como $ADMIN "select count(*) from veintiuna_mesas;" | tail -1)"
for t in "update veintiuna_mesas set fase = 'resultado'" "delete from veintiuna_mesas" "insert into veintiuna_asientos (mesa, asiento, user_id, nombre) values (gen_random_uuid(), 1, '$U2', 'x')" "update veintiuna_asientos set apuesta = 1000" \
         "update veintiuna_pozos set estado = 'pagado'" "insert into veintiuna_pozo_cartas (ronda_id, user_id, ejemplar, carta) values (gen_random_uuid(), '$U1', gen_random_uuid(), 'comun-1')"; do
  contiene "escribir directo en las tablas de la mesa está prohibido: $(printf '%s' "$t" | cut -c1-48)" "$(como $U1 "$t;")" "permission denied"
done
como $U1 "select veintiuna_amigos_salir();" >/dev/null
# Varios entran a la vez en una mesa de tres asientos: entran justo los que caben, cada uno en su asiento
sql "update cartas_economia_ajustes set valor = '3' where clave = 'veintiuna_mesa_asientos'" >/dev/null
TMP=$(mktemp -d)
COD=$(como $U1 "select veintiuna_amigos_crear('Concurrencia', true, false) ->> 'codigo';" | tail -1)
como $U2 "select veintiuna_amigos_unirse('$COD') ->> 'fase';" > "$TMP/a" &
como $U3 "select veintiuna_amigos_unirse('$COD') ->> 'fase';" > "$TMP/b" &
como $U4 "select veintiuna_amigos_unirse('$COD') ->> 'fase';" > "$TMP/c" &
wait
comprobar "entran a la vez 3 y la mesa se queda en 3 asientos distintos" "3|3" "$(sql "select count(*) from veintiuna_asientos")|$(sql "select count(distinct asiento) from veintiuna_asientos")"
contiene "al que no cabía se le dice que está llena" "$(cat "$TMP/a" "$TMP/b" "$TMP/c")" "La mesa está llena"
sql "update cartas_economia_ajustes set valor = '5' where clave = 'veintiuna_mesa_asientos'; select t_reset()" >/dev/null
# Dos apuestan a la vez y la mesa reparte una sola vez (cada uno paga su apuesta una vez)
COD=$(como $U1 "select veintiuna_amigos_crear('Apuestan a la vez', true, false) ->> 'codigo';" | tail -1)
como $U2 "select veintiuna_amigos_unirse('$COD') ->> 'fase';" >/dev/null
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 300), ('$U2', 300) on conflict (usuario) do update set saldo = 300" >/dev/null
como $U1 "select veintiuna_amigos_apostar(20) ->> 'fase';" > "$TMP/a" &
como $U2 "select veintiuna_amigos_apostar(30) ->> 'fase';" > "$TMP/b" &
wait
comprobar "apuestan a la vez: dos manos, una por jugador, y la ronda empezó una sola vez" "2|1|jugando|2" "$(sql "select count(*) from veintiuna_partidas")|$(sql "select count(distinct ronda_id) from veintiuna_partidas")|$(sql "select case when count(*) filter (where fase = 'jugando') + count(*) filter (where fase = 'resultado') = 1 then 'jugando' else 'mal' end from veintiuna_mesas")|$(sql "select count(*) from hipodromo_movimientos where concepto like '%apuesta (mano%'")"
comprobar "cada apuesta se cobró una vez y cada pago se abonó una sola vez (saldo = 300 - apuesta + pago)" "t|2" "$(sql "select bool_and(b.saldo = 300 - p.apuesta + coalesce(p.pago, 0)) from veintiuna_partidas p join hipodromo_billeteras b on b.usuario = p.user_id where p.modo = 'apuesta'")|$(sql "select count(*) from hipodromo_movimientos where concepto like '%apuesta (mano%'")"
rm -rf "$TMP"
como $U1 "select veintiuna_amigos_salir();" >/dev/null; como $U2 "select veintiuna_amigos_salir();" >/dev/null
sql "select t_reset()" >/dev/null

echo "== Desafíos y recompensas de cartas"
sql "select t_reset()" >/dev/null; limpiar
sql "update cartas_juegos set activo = false where juego = 'veintiuna'" >/dev/null
sql "select t_saldo('$U1', 5000)" >/dev/null
sql "select t_act((t_reparte('$U1', 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '7c') ->> 'partida')::uuid, 'plantar')" >/dev/null
contiene "el desafío «Primera vela» está completado y sin reclamar" "$(como $U1 "select veintiuna_mesa() -> 'logros' -> 0;")" '"reclamado": null'
contiene "con el juego apagado reclamar no da nada" "$(como $U1 "select veintiuna_reclamar('primera_vela');")" "juego-inactivo"
comprobar "y el desafío sigue sin gastar" "" "$(sql "select reclamado from veintiuna_logros where user_id = '$U1' and logro = 'primera_vela'")"
contiene "un desafío sin completar no se reclama" "$(como $U1 "select veintiuna_reclamar('ultima_hora');")" "todavía no está completado"
contiene "un desafío que no existe tampoco" "$(como $U1 "select veintiuna_reclamar('inventado');")" "no existe"
sql "update cartas_juegos set activo = true where juego = 'veintiuna'" >/dev/null
R=$(como $U1 "select veintiuna_reclamar('primera_vela');")
contiene "encendido el juego, reclamar da una carta" "$R" '"resultado": "carta"'
contiene "de nivel «bueno» (bronce)" "$R" '"tramo": "bueno"'
comprobar "la copia está en la colección de quien reclamó y sale del libro como minijuego" "1|1" "$(sql "select count(*) from cartas_ejemplares where propietario = '$U1'")|$(sql "select count(*) from cartas_movimientos where a = '$U1' and motivo = 'minijuego: veintiuna'")"
comprobar "el desafío queda reclamado con su carta" "t" "$(sql "select reclamado is not null and carta is not null from veintiuna_logros where user_id = '$U1' and logro = 'primera_vela'")"
contiene "no se reclama dos veces" "$(como $U1 "select veintiuna_reclamar('primera_vela');")" "Ya reclamaste"
comprobar "no se duplicó la copia" "1" "$(sql "select count(*) from cartas_ejemplares where propietario = '$U1'")"
sql "select t_act((t_reparte('$U1', 'fortuna', 'apuesta', 10, '5p', '10c', '8c', '6c', 'Kd') ->> 'partida')::uuid, 'plantar')" >/dev/null
comprobar "«Sin miedo» completó su desafío" "t" "$(sql "select count(*) = 1 from veintiuna_logros where user_id = '$U1' and logro = 'sin_miedo' and reclamado is null")"
R=$(como $U1 "select veintiuna_reclamar('sin_miedo');")
contiene "el segundo del día no sale (tope de una carta al día en la mesa)" "$R" "tope-diario"
comprobar "y el desafío sigue guardado" "" "$(sql "select reclamado from veintiuna_logros where user_id = '$U1' and logro = 'sin_miedo'")"
sql "update cartas_recompensas_registro set creado = creado - interval '1 day'" >/dev/null
R=$(como $U1 "select veintiuna_reclamar('sin_miedo');")
contiene "al día siguiente sí" "$R" '"resultado": "carta"'
contiene "un desafío de plata es de nivel «excelente», sin subir un tramo por la «mejora personal»" "$R" '"tramo": "excelente"'
comprobar "sin sellos ni restos en el progreso general" "0" "$(sql "select coalesce(sum(sellos), 0) from cartas_progreso where user_id = '$U1' and juego = 'veintiuna'")"

# Si no hay carta que dar, el desafío no se gasta ni deja sellos
sql "update cartas_recompensas_registro set creado = creado - interval '1 day'" >/dev/null
sql "update cartas_catalogo set en_circulacion = false" >/dev/null
R=$(como $U1 "select veintiuna_reclamar('bajo_maldicion');")
contiene "sin cartas en circulación no se entrega nada" "$R" '"resultado": "nada"'
comprobar "y el desafío sigue guardado, sin sellos ni registro de más" "|0|2" "$(sql "select reclamado from veintiuna_logros where user_id = '$U1' and logro = 'bajo_maldicion'")|$(sql "select coalesce(sum(sellos), 0) from cartas_progreso where user_id = '$U1' and juego = 'veintiuna'")|$(sql "select count(*) from cartas_recompensas_registro where user_id = '$U1' and juego = 'veintiuna'")"
sql "update cartas_catalogo set en_circulacion = true where id <> 'bufon'" >/dev/null
sql "update cartas_catalogo set limite = (select count(*) from cartas_ejemplares e where e.carta_id = cartas_catalogo.id and e.estado <> 'destruida') where id <> 'bufon'" >/dev/null 2>&1
R=$(como $U1 "select veintiuna_reclamar('bajo_maldicion');")
contiene "con todos los límites globales agotados tampoco sale nada" "$R" '"resultado": "nada"'
comprobar "y no se emitió ninguna copia nueva (la auditoría sigue limpia)" "0" "$(auditar)"
comprobar "el desafío sigue sin gastar" "" "$(sql "select reclamado from veintiuna_logros where user_id = '$U1' and logro = 'bajo_maldicion'")"
sql "update cartas_catalogo set limite = 20 where id like 'comun-%'; update cartas_catalogo set limite = 12 where id like 'poco-%'; update cartas_catalogo set limite = 5 where id like 'rara-%'; update cartas_catalogo set limite = 1 where id = 'legendaria-1'" >/dev/null
# Los desafíos se reinician cada día: lo completado ayer (reclamado o no) se borra y se puede completar otra vez; lo no reclamado se apaga
comprobar "antes de pasar el día hay desafíos de hoy guardados (dos reclamados y uno sin reclamar)" "3" "$(sql "select count(*) from veintiuna_logros where user_id = '$U1'")"
sql "update veintiuna_estadisticas set dia_logros = dia_logros - 1 where user_id = '$U1'" >/dev/null
M=$(como $U1 "select veintiuna_mesa();")
comprobar "al día siguiente todos los desafíos vuelven a empezar (ninguno completado)" "0" "$(sql "select count(*) from veintiuna_logros where user_id = '$U1'")"
contiene "y su progreso del día es 0" "$(printf '%s' "$M" | tr -d '
 ' | grep -o '"id":"primera_vela"[^}]*' | head -1)" '"progreso":0'
comprobar "las estadísticas de siempre se conservan (victorias, mejor racha)" "t" "$(sql "select victorias >= 2 from veintiuna_estadisticas where user_id = '$U1'")"
comprobar "y el reinicio fija el día de hoy" "t" "$(sql "select dia_logros = (now() at time zone 'utc')::date from veintiuna_estadisticas where user_id = '$U1'")"
contiene "lo completado ayer ya no se puede reclamar" "$(como $U1 "select veintiuna_reclamar('primera_vela');")" "todavía no está completado"
contiene "la mesa dice cuándo se reinician" "$M" '"logros_reinician"'
sql "select t_act((t_reparte('$U1', 'maldicion', 'apuesta', 10, '10p', '10c', '8c', '7c') ->> 'partida')::uuid, 'plantar')" >/dev/null
comprobar "ganando hoy, «Primera vela» se completa de nuevo (y sin reclamar)" "t" "$(sql "select count(*) = 1 from veintiuna_logros where user_id = '$U1' and logro = 'primera_vela' and reclamado is null")"
comprobar "el contador del día cuenta solo la victoria de hoy" "1" "$(sql "select coalesce((contadores ->> 'victorias_dia')::int, 0) from veintiuna_estadisticas where user_id = '$U1'")"
# un desafío completado y sin reclamar al acabar el día se apaga
sql "update veintiuna_estadisticas set dia_logros = dia_logros - 1 where user_id = '$U1'" >/dev/null
contiene "lo completado y sin reclamar de ayer no se puede reclamar hoy" "$(como $U1 "select veintiuna_reclamar('primera_vela');")" "todavía no está completado"
como $U1 "select veintiuna_mesa();" >/dev/null
comprobar "y desaparece al reiniciar" "0" "$(sql "select count(*) from veintiuna_logros where user_id = '$U1'")"

# El editor de Admin guarda el juego (valida los valores de los desafíos)
GUARDAR='{"valores": {"rivales": {"bronce": {"gana": 1, "tablas": 0, "pierde": 0}, "plata": {"gana": 3, "tablas": 0, "pierde": 0}, "oro": {"gana": 4, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}}'
nocontiene "el editor de Juegos y recetas acepta los valores de este juego" "$(como $ADMIN "select cartas_admin_guardar_juego('veintiuna', '$GUARDAR'::jsonb);")" "ERROR"
nocontiene "y también encender el juego desde el panel" "$(como $ADMIN "select cartas_admin_guardar_juego('veintiuna', '{\"activo\": true}'::jsonb);")" "ERROR"
contiene "rechaza campos que no existen" "$(como $ADMIN "select cartas_admin_guardar_juego('veintiuna', '{\"valores\": {\"inventado\": {}}}'::jsonb);")" "campo desconocido"
contiene "un jugador no puede cambiar la configuración" "$(como $U1 "select cartas_admin_guardar_juego('veintiuna', '{\"activo\": false}'::jsonb);")" "No autorizado"
contiene "el juego aparece en el panel de recompensas del Admin" "$(como $ADMIN "select cartas_admin_juegos();")" "veintiuna"
comprobar "la auditoría de la economía de cartas sigue limpia" "0" "$(auditar)"

echo "== Valor esperado de cada regla (partidas de verdad contra el servidor)"
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$AQUI/t_veintiuna_ev.sql" >/dev/null
N="${VEINTIUNA_EV_MANOS:-12000}"
comprobar_ev() { # descripción, esperado (en %), margen, argumentos de t_ev
  real=$(printf '%s\n' "select round(ev * 100, 2), round(error * 100, 2) from t_ev($3);" | sup | head -1)
  ev=${real%%|*}; err=${real##*|}
  dentro=$(awk -v e="$ev" -v x="$2" -v m="$4" 'BEGIN { d = e - x; if (d < 0) d = -d; print (d <= m) ? 1 : 0 }')
  comprobar "$1: valor esperado $ev % ± $err (simulación $2 %, margen $4)" "1" "$dentro"
}
comprobar_ev "Maldición, estrategia 13/15/18" "-2.92" "'maldicion', $N, 13, 15, 18" 3.2
comprobar_ev "Fortuna, estrategia 14/17/18 y peaje del 60 %" "-2.16" "'fortuna', $N, 14, 17, 18" 3.2
comprobar_ev "Última voluntad: cambiar la última carta con 15 o 16 si era un 5 o menos, peaje del 50 %" "-4.17" "'voluntad', $N, 12, 17, 18, 0, 15, 16, 5" 3.2

comprobar_ev2() { # descripción, esperado (en %), regla
  real=$(printf '%s\n' "select round(ev * 100, 2), round(error * 100, 2) from t_ev2('$3', $N);" | sup | head -1)
  ev=${real%%|*}; err=${real##*|}
  dentro=$(awk -v e="$ev" -v x="$2" 'BEGIN { d = e - x; if (d < 0) d = -d; print (d <= 3.2) ? 1 : 0 }')
  comprobar "$1: valor esperado $ev % ± $err (simulación $2 %, margen 3.2)" "1" "$dentro"
}
comprobar_ev2 "Vela corta (crupier con 16, natural 6 a 5), estrategia sencilla" "-3.65" vela
comprobar_ev2 "Pacto del Bufón, estrategia sencilla (debe parecerse al blackjack base)" "-2.16" bufon
comprobar_ev2 "Ojo del Tahúr, mirar con 12 a 16" "-5.00" ojo
comprobar_ev2 "Cartas marcadas, mirar siempre al principio" "-15.28" marcadas
comprobar_ev2 "Trueque con la casa, cuando la visible vale 5 más que tu primera" "-10.09" trueque


echo "== La Última Vela (reto de Muerte Súbita contra Cera): reglas, repetir y recuperar, de quién es cada intento (SQL)"
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$AQUI/../veintiuna-reto.sql" >/dev/null 2>&1 || { echo "  FALLA docs/veintiuna-reto.sql no se pudo cargar (¿está cargada pruebas/05_muerte_subita_simulado.sql?)"; FALLOS=$((FALLOS + 1)); }
SALIDA=$(docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=0 < "$AQUI/t_veintiuna_reto.sql" 2>&1)
printf '%s
' "$SALIDA" | grep -E 'NOTICE:  (OK|FALLA)' | sed -E 's/NOTICE:  OK   /  OK   /; s/NOTICE:  FALLA /  FALLA /'
FALLOS=$((FALLOS + $(printf '%s
' "$SALIDA" | grep -c 'NOTICE:  FALLA')))
ERRORES=$(printf '%s
' "$SALIDA" | grep -E 'ERROR' | head -3); [ -n "$ERRORES" ] && { echo "  FALLA errores de SQL: $ERRORES"; FALLOS=$((FALLOS + 1)); }

echo "== La Última Vela: permisos"
sql "select t_r_limpiar(); select t_reset()" >/dev/null
INT=$(sql "select t_r_intento('$U1')")
INT2=$(sql "select t_r_intento('$U2')")
for f in "veintiuna_reto_estado('$INT')" "veintiuna_reto_repartir('$INT', 0)" "veintiuna_reto_accion('$INT', 0, 'pedir')" "ms_finalizar('$INT', 1, 0)"; do
  contiene "sin sesión no se puede llamar a $(printf '%s' "$f" | cut -d'(' -f1)" "$(anonimo "select $f;")" "permission denied"
done
for f in "veintiuna_i_reto_repartir('$U1', '$INT', 0, null)" "veintiuna_i_reto_cerrar_mano(gen_random_uuid(), 'victoria', 'x')" "veintiuna_i_reto_plantar(gen_random_uuid())" "veintiuna_i_reto_json('$INT')" "veintiuna_i_reto_intento('$U1', '$INT')" "veintiuna_i_reto_const('ganar')"; do
  contiene "un jugador no puede llamar a la función interna $(printf '%s' "$f" | cut -d'(' -f1)" "$(como $U1 "select $f;")" "permission denied"
done
R=$(como $U1 "select veintiuna_reto_repartir('$INT', 0) -> 'mano' ->> 'fase';")
case "$R" in *jugador*|*terminada*) ok "un jugador con sesión reparte la primera mano de su reto";; *) mal "un jugador con sesión reparte la primera mano de su reto (salida: $R)";; esac
comprobar "un jugador no lee la tabla de manos (lleva la baraja)" "0" "$(como $U1 "select count(*) from veintiuna_reto_manos;" | tail -1)"
comprobar "el admin sí puede revisarlas" "1" "$(como $ADMIN "select count(*) from veintiuna_reto_manos where intento = '$INT';" | tail -1)"
comprobar "cada jugador ve su fila del reto y no la de otro" "1|0" "$(como $U1 "select count(*) from veintiuna_retos;" | tail -1)|$(como $U2 "select count(*) from veintiuna_retos where intento = '$INT';" | tail -1)"
for t in "insert into veintiuna_retos (intento, user_id) values ('$INT2', '$U2')" "update veintiuna_retos set ganadas = 3" "delete from veintiuna_retos"          "update veintiuna_reto_manos set resultado = 'victoria'" "delete from veintiuna_reto_manos" "insert into veintiuna_reto_manos (intento, orden, numero, mazo, repartidas, jugador, cera) values ('$INT', 99, 1, '{1}', 1, '{1}', '{2}')"; do
  contiene "escribir directo en las tablas del reto está prohibido: $(printf '%s' "$t" | cut -c1-48)" "$(como $U1 "$t;")" "permission denied"
done
sql "select t_r_limpiar()" >/dev/null

echo "== La Última Vela: dos peticiones a la vez"
TMP=$(mktemp -d)
sql "select t_r_limpiar()" >/dev/null
INT=$(sql "select t_r_intento('$U1')")
como $U1 "select veintiuna_reto_repartir('$INT', 0) ->> 'repartidas';" 1 > "$TMP/a" &
como $U1 "select veintiuna_reto_repartir('$INT', 0) ->> 'repartidas';" 1 > "$TMP/b" &
wait
comprobar "repartir dos veces a la vez la primera mano: se reparte una sola" "1" "$(sql "select count(*) from veintiuna_reto_manos where intento = '$INT'")"
comprobar "y el contador de manos del reto cuadra" "1" "$(sql "select manos from veintiuna_retos where intento = '$INT'")"
if [ "$(sql "select estado from veintiuna_reto_manos where intento = '$INT'")" = "en_curso" ]; then
  como $U1 "select veintiuna_reto_accion('$INT', 0, 'plantar') -> 'mano' ->> 'resultado';" 1 > "$TMP/a" &
  como $U1 "select veintiuna_reto_accion('$INT', 0, 'plantar') -> 'mano' ->> 'resultado';" 1 > "$TMP/b" &
  wait
  comprobar "plantarse dos veces a la vez: la mano se cuenta una sola vez para el reto" "1" "$(sql "select ganadas + perdidas + empates_seguidos from veintiuna_retos where intento = '$INT'")"
  comprobar "y las dos respuestas dicen lo mismo" "1" "$(cat "$TMP/a" "$TMP/b" | grep -v '^$' | sort -u | wc -l | tr -d ' ')"
else
  ok "(la primera mano acabó al repartir, un natural: no hay nada que plantar; se repite en la próxima tanda)"
fi
rm -rf "$TMP"
sql "select t_r_limpiar()" >/dev/null

echo "== La Última Vela: el servidor juega las mismas reglas que la simulación (misma baraja, misma estrategia, mismo resultado)"
if command -v node >/dev/null 2>&1; then
  N_BARAJAS="${VEINTIUNA_RETO_BARAJAS:-1500}"
  RES=$(node "$AQUI/../../tools/veintiuna-ultima-vela-verificar.js" "$N_BARAJAS" | docker exec -i cartas-pruebas psql -U postgres -d pruebas -tA -q -v ON_ERROR_STOP=0 2>&1 | sort | uniq -c | tr -s ' ' | tr '\n' ' ' | sed 's/^ *//;s/ *$//')
  comprobar "$((N_BARAJAS * 2)) manos (novato y básico) dan el mismo resultado en el servidor y en la simulación" "$((N_BARAJAS * 2)) t" "$RES"
else
  echo "  (sin node no se puede comparar con la simulación: se omite)"
fi
sql "select t_r_limpiar(); select t_reset()" >/dev/null

[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
