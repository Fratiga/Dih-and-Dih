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
contiene "un jugador con sesión reparte una mano" "$R" '"estado": "en_curso"'
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
comprobar "la billetera sigue en 280 (300 menos la apuesta de 20) aunque se intente cambiar a mano" "t" "$(sql "select saldo = 280 from hipodromo_billeteras where usuario = '$U1'")"

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

echo "== Desafíos y recompensas de cartas"
sql "select t_reset()" >/dev/null; limpiar
sql "update cartas_juegos set activo = false where juego = 'veintiuna'" >/dev/null
sql "select t_act((t_reparte('$U1', 'maldicion', 'practica', 0, '10p', '10c', '8c', '7c') ->> 'partida')::uuid, 'plantar')" >/dev/null
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
sql "select t_act((t_reparte('$U1', 'fortuna', 'practica', 0, '5p', '10c', '8c', '6c', 'Kd') ->> 'partida')::uuid, 'plantar')" >/dev/null
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


[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
