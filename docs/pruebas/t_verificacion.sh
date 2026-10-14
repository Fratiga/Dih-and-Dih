#!/bin/sh
# Verificación de partidas apostadas con su registro: avisos falsos, abandono, autenticidad del registro, versión del motor
# e idempotencia. Uso: sh docs/pruebas/t_verificacion.sh
# Aquí se prueba la parte de la base de datos (cartas_i_aplicar_verificacion). El veredicto en sí (volver a jugar la partida)
# se prueba con: node tools/probar-verificacion.js
. "$(dirname "$0")/lib.sh"
FALLOS=0
V=v1   # versión del motor que registran los jugadores y con la que "repite" el servidor
estado_partida() { sql "select estado||'/'||coalesce(apuesta_estado,'-')||'/'||coalesce(motivo,'-')||'/'||coalesce(resultado,'-') from cartas_partidas where id='$1'"; }
dueno() { sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$1'"; }
bloqueos() { sql "select count(*) from cartas_bloqueos"; }
nueva_apuesta() {
  eval "MA=\$M$(echo $1 | tail -c 2 | tr -d 0)"; eval "MB=\$M$(echo $2 | tail -c 2 | tr -d 0)"
  SA=$(dar $1 comun-1); SB=$(dar $2 comun-2)
  P=$(como $1 "select cartas_retar('$2', '$MA', '{}'::jsonb, array['$SA']::uuid[]);" | tail -1)
  como $2 "select cartas_responder('$P', true, '$MB', '{}'::jsonb, array['$SB']::uuid[]);" >/dev/null
}
# ver <partida> <resultado> <motivo> [acciones] [actualizada] [motor]: lo que haría la función del servidor, con los datos de la partida
ver() {
  datos=$(sql "select jsonb_array_length(acciones)||'|'||actualizada from cartas_partidas where id='$1'")
  n="${4:-${datos%%|*}}"; act="${5:-${datos#*|}}"; motor="${6:-$V}"
  servicio "select cartas_i_aplicar_verificacion('$1', '$2', '$3', $n, '$act'::timestamptz, '$motor', 'detalle de prueba');" | tail -1
}
limpiar
sql "update cartas_economia_ajustes set valor = '\"$V\"' where clave = 'motor_version'" >/dev/null   # la versión del motor que fija el servidor
M1=$(mazo_de $U1); M2=$(mazo_de $U2); M3=$(mazo_de $U3); M4=$(mazo_de $U4)

echo "== Permisos: solo el servidor puede cerrar una apuesta con un veredicto"
nueva_apuesta $U1 $U2; PA=$P; SAa=$SA; SBa=$SB
LLAMADA="cartas_i_aplicar_verificacion('$PA', 'j1', 'verificada', 0, now(), '$V')"
for quien in "$U1" "$ADMIN" "$EDITOR"; do
  contiene "ni jugador, admin ni editor pueden llamar a la función ($(sql "select username from perfiles where user_id='$quien'"))" "$(como $quien "select $LLAMADA;")" "permission denied"
done
contiene "sin sesión tampoco" "$(anonimo "select $LLAMADA;")" "permission denied"
comprobar "la apuesta sigue intacta" "en_curso/activa/-/-" "$(estado_partida $PA)"
contiene "el servidor no acepta un resultado inventado" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'gana-el-mejor', 'verificada', 0, now(), '$V');")" "Resultado inválido"
contiene "ni un motivo inventado" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'j1', 'porque-si', 0, now(), '$V');")" "Motivo inválido"
contiene "un abandono no puede ser empate" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'empate', 'abandono', 0, now(), '$V');")" "no puede ser empate"
contiene "una partida que no existe da error claro" "$(servicio "select cartas_i_aplicar_verificacion(gen_random_uuid(), 'j1', 'verificada', 0, now(), '$V');")" "no encontrada"

echo "== Autenticidad del registro: nadie lo puede escribir ni cambiar a mano"
for col in "acciones = '[]'::jsonb" "semilla = 1" "primero = 1" "mazo1 = '[]'::jsonb" "mazo2 = '[]'::jsonb" "cartas = '{}'::jsonb" "turno = j2" "instantanea = '{}'::jsonb" "reporte1 = 'j1'" "estado = 'terminada'" "resultado = 'j1'" "actualizada = now()"; do
  R=$(como $U1 "update cartas_partidas set $col where id = '$PA';")
  contiene "un jugador no puede cambiar ${col%% =*} directamente" "$R" "permission denied"
done
contiene "ni insertar partidas a mano" "$(como $U1 "insert into cartas_partidas (j1, j2, mazo1) values ('$U1', '$U2', '[]'::jsonb);")" "permission denied"
contiene "ni borrarlas" "$(como $U1 "delete from cartas_partidas where id = '$PA';")" "permission denied"
comprobar "el registro sigue vacío" "0" "$(sql "select jsonb_array_length(acciones) from cartas_partidas where id='$PA'")"
contiene "quien no juega esa partida no puede añadir acciones" "$(como $U3 "select cartas_accion('$PA', '{\"t\":\"fin\"}'::jsonb);")" "Partida no encontrada"
TURNO=$(sql "select turno from cartas_partidas where id='$PA'")
OTRO=$( [ "$TURNO" = "$U1" ] && echo $U2 || echo $U1 )
contiene "el que no tiene el turno no puede jugar por el otro" "$(como $OTRO "select cartas_accion('$PA', '{\"t\":\"jugar\",\"i\":0}'::jsonb);")" "No es tu turno"
contiene "...ni fingir una reacción cuando nadie le espera" "$(como $TURNO "select cartas_accion('$PA', '{\"t\":\"pasar\"}'::jsonb);")" "Esperas la respuesta"
sql "update cartas_partidas set actualizada = now() where id='$PA'" >/dev/null
contiene "...ni seguir sin esperar antes de tiempo" "$(como $TURNO "select cartas_accion('$PA', '{\"t\":\"pasar\",\"forzar\":true}'::jsonb);")" "Todavía hay tiempo"
contiene "una acción con forma rara se rechaza" "$(como $TURNO "select cartas_accion('$PA', '{\"t\":\"hackear\"}'::jsonb);")" "Acción inválida"
contiene "...y una demasiado larga" "$(como $TURNO "select cartas_accion('$PA', jsonb_build_object('t', 'jugar', 'i', 0, 'relleno', repeat('x', 400)));")" "Acción inválida"
nocontiene "el que tiene el turno sí puede jugar" "$(como $TURNO "select cartas_accion('$PA', '{\"t\":\"fin\"}'::jsonb);")" "ERROR"
comprobar "y entonces el turno pasa al otro, lo decide el servidor" "$OTRO" "$(sql "select turno from cartas_partidas where id='$PA'")"

echo "== Versión del motor: la fija el servidor en la instantánea de la partida y solo se decide con esa misma"
comprobar "la instantánea lleva la versión que fijó el servidor" "v1" "$(sql "select instantanea->>'motor' from cartas_partidas where id='$PA'")"
contiene "los jugadores no pueden registrar ni cambiar la versión" "$(como $U1 "update cartas_partidas set instantanea = jsonb_set(instantanea, '{motor}', '\"v-trampa\"') where id = '$PA';")" "permission denied"
comprobar "repetida con otra versión del motor: no se decide nada" "motor" "$(ver $PA j2 verificada "" "" v2)"
comprobar "...ni con una versión en blanco" "motor" "$(ver $PA j2 verificada "" "" " ")"
sql "update cartas_economia_ajustes set valor = '\"v9\"' where clave = 'motor_version'" >/dev/null
comprobar "cambiar el ajuste del servidor después no afecta a la partida ya empezada" "motor" "$(ver $PA j2 verificada "" "" v9)"
sql "update cartas_economia_ajustes set valor = '\"$V\"' where clave = 'motor_version'" >/dev/null
comprobar "la apuesta sigue intacta tras todos esos rechazos" "en_curso/activa/-/-" "$(estado_partida $PA)"
comprobar "...y las dos cartas siguen bloqueadas" "2" "$(bloqueos)"

echo "== El registro no puede cambiar entre que se repite y que se aplica"
N=$(sql "select jsonb_array_length(acciones) from cartas_partidas where id='$PA'")
comprobar "con otro número de acciones se rechaza" "cambiada" "$(ver $PA j2 verificada $((N + 1)))"
comprobar "...también con menos" "cambiada" "$(ver $PA j2 verificada $((N - 1)))"

echo "== Disputa: el registro decide, no el admin a ojo"
como $U1 "select cartas_terminar('$PA', 'j1');" >/dev/null
como $U2 "select cartas_terminar('$PA', 'j2');" >/dev/null
comprobar "los avisos chocan: disputa" "disputa/activa/-/-" "$(estado_partida $PA)"
comprobar "el panel ve la disputa" "1" "$(como $ADMIN "select jsonb_array_length(jsonb_path_query_array(cartas_admin_apuestas(), '\$[*] ? (@.situacion == \"disputa\")'));" | tail -1)"
comprobar "el servidor resuelve con el veredicto" "resuelta" "$(ver $PA j2 verificada)"
comprobar "estado final: terminada, verificada, gana el segundo" "terminada/resuelta/verificada/j2" "$(estado_partida $PA)"
comprobar "el ganador del registro se lleva la carta del otro" "$U2/poseida" "$(dueno $SAa)"
comprobar "y conserva la suya" "$U2/poseida" "$(dueno $SBa)"
comprobar "no quedan bloqueos" "0" "$(bloqueos)"
comprobar "quien mintió queda anotado una vez" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U1'")"
comprobar "quien dijo la verdad no queda anotado" "0" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U2'")"
comprobar "queda constancia de que se resolvió por el registro" "1" "$(sql "select count(*) from cartas_incidencias where tipo='apuesta_resuelta_por_registro' and referencia='apuesta:$PA'")"
MOV=$(sql "select count(*) from cartas_movimientos where tipo='transferencia'")
comprobar "llamarlo otra vez no mueve nada" "ya-resuelta" "$(ver $PA j1 verificada)"
comprobar "...ni con el resultado contrario" "ya-resuelta" "$(ver $PA j2 verificada)"
comprobar "...y las cartas siguen donde estaban" "$U2/poseida" "$(dueno $SAa)"
comprobar "...sin ninguna transferencia más" "$MOV" "$(sql "select count(*) from cartas_movimientos where tipo='transferencia'")"
comprobar "...y nadie queda anotado dos veces" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido'")"
contiene "después de cerrada, nadie puede añadir acciones" "$(como $U2 "select cartas_accion('$PA', '{\"t\":\"fin\"}'::jsonb);")" "no está en curso"
REP=$(como $ADMIN "select cartas_admin_reputacion();")
contiene "el panel muestra a Uno con 1 aviso desmentido" "$REP" '"avisos_desmentidos": 1'
contiene "un jugador no ve la reputación de nadie" "$(como $U1 "select cartas_admin_reputacion();")" "No autorizado"

echo "== Aviso falso con el rival callado: antes ganaba el mentiroso, ahora gana el registro"
nueva_apuesta $U3 $U4; PB=$P; SA3=$SA; SB4=$SB
como $U3 "select cartas_terminar('$PB', 'j1');" >/dev/null
comprobar "con un solo aviso sigue en curso" "en_curso/activa/-/-" "$(estado_partida $PB)"
ver $PB j2 verificada >/dev/null
comprobar "el registro dice que ganó el otro: se resuelve a su favor" "terminada/resuelta/verificada/j2" "$(estado_partida $PB)"
comprobar "el que mintió pierde su carta" "$U4/poseida" "$(dueno $SA3)"
comprobar "queda anotado el aviso desmentido de Tres" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U3'")"

echo "== Aviso verdadero con el rival callado: se confirma al instante, sin esperar 24 horas"
nueva_apuesta $U1 $U3; PC=$P; SAc=$SA; SBc=$SB
como $U1 "select cartas_terminar('$PC', 'j1');" >/dev/null
ver $PC j1 verificada >/dev/null
comprobar "gana quien avisó, ahora con pruebas" "terminada/resuelta/verificada/j1" "$(estado_partida $PC)"
comprobar "se lleva la carta del callado" "$U1/poseida" "$(dueno $SBc)"
comprobar "nadie queda anotado por avisar la verdad" "0" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U1' and referencia='apuesta:$PC'")"

echo "== Empate verificado"
nueva_apuesta $U2 $U4; PD=$P; SAd=$SA; SBd=$SB
ver $PD empate verificada >/dev/null
comprobar "cada carta vuelve a su dueño" "$U2/poseida|$U4/poseida" "$(dueno $SAd)|$(dueno $SBd)"

echo "== Abandono a las 48 horas: la partida sigue activa, el plazo venció y nadie ha actuado"
nueva_apuesta $U1 $U4; PE=$P; SAe=$SA; SBe=$SB
sql "update cartas_partidas set actualizada = now() - interval '10 hours' where id='$PE'" >/dev/null
comprobar "a las 10 horas el plazo no ha vencido" "no-vencido" "$(ver $PE j1 abandono)"
sql "update cartas_partidas set actualizada = now() - interval '47 hours 50 minutes' where id='$PE'" >/dev/null
comprobar "a las 47 h 50 min tampoco" "no-vencido" "$(ver $PE j1 abandono)"
comprobar "el servidor no se fía de la hora que le diga quien llama: otra marca de actividad no vale" "cambiada" "$(ver $PE j1 abandono "" "2020-01-01 00:00:00+00")"
comprobar "la apuesta sigue activa y las cartas bloqueadas" "en_curso/activa/-/-|2" "$(estado_partida $PE)|$(bloqueos)"
sql "update cartas_partidas set actualizada = now() - interval '49 hours' where id='$PE'" >/dev/null
comprobar "a las 49 horas, vencido: se resuelve" "resuelta" "$(ver $PE j1 abandono)"
comprobar "gana el que se quedó, por abandono" "terminada/resuelta/abandono/j1" "$(estado_partida $PE)"
comprobar "se lleva la carta del que desapareció" "$U1/poseida" "$(dueno $SBe)"
comprobar "el abandono queda anotado al que desapareció" "1" "$(sql "select count(*) from cartas_incidencias where tipo='abandono' and jugador='$U4'")"
contiene "el panel lo cuenta" "$(como $ADMIN "select cartas_admin_reputacion();")" '"abandonos": 1'
comprobar "un abandono ya resuelto no se repite" "ya-resuelta" "$(ver $PE j1 abandono)"
echo "== Abandono: solo con la partida en curso"
nueva_apuesta $U2 $U3; PF=$P
como $U2 "select cartas_terminar('$PF', 'j1');" >/dev/null
como $U3 "select cartas_terminar('$PF', 'j2');" >/dev/null
sql "update cartas_partidas set actualizada = now() - interval '60 hours' where id='$PF'" >/dev/null
comprobar "una disputa no se cierra por abandono" "no-aplica" "$(ver $PF j1 abandono)"
comprobar "...sigue en disputa con las cartas bloqueadas" "disputa/activa/-/-|2" "$(estado_partida $PF)|$(bloqueos)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Casos que no se tocan"
PG=$(como $U4 "select cartas_retar('$U1', '$M4', '{}'::jsonb, '{}'::uuid[]);" | tail -1)
como $U1 "select cartas_responder('$PG', true, '$M1', '{}'::jsonb, '{}'::uuid[]);" >/dev/null
como $U4 "select cartas_registrar_motor('$PG', '$V');" >/dev/null; como $U1 "select cartas_registrar_motor('$PG', '$V');" >/dev/null
comprobar "una partida sin apuesta no se cierra por esta vía" "ya-resuelta" "$(ver $PG j1 verificada)"
comprobar "...y sigue en curso" "en_curso/-/-/-" "$(estado_partida $PG)"
PH=$(como $U3 "select cartas_retar('$U4', '$M3', '{}'::jsonb, array['$(dar $U3 comun-4)']::uuid[]);" | tail -1)
comprobar "un reto sin aceptar no se cierra por esta vía" "ya-resuelta" "$(ver $PH j1 verificada)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
