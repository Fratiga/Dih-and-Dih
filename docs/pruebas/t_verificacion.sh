#!/bin/sh
# Verificación de partidas apostadas con su registro: avisos falsos y abandono. Uso: sh docs/pruebas/t_verificacion.sh
# Aquí se prueba la parte de la base de datos (cartas_i_aplicar_verificacion). El veredicto en sí (volver a jugar la partida)
# se prueba con: node tools/probar-verificacion.js
. "$(dirname "$0")/lib.sh"
FALLOS=0
estado_partida() { sql "select estado||'/'||coalesce(apuesta_estado,'-')||'/'||coalesce(motivo,'-')||'/'||coalesce(resultado,'-') from cartas_partidas where id='$1'"; }
dueno() { sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$1'"; }
bloqueos() { sql "select count(*) from cartas_bloqueos"; }
nueva_apuesta() {
  eval "MA=\$M$(echo $1 | tail -c 2 | tr -d 0)"; eval "MB=\$M$(echo $2 | tail -c 2 | tr -d 0)"
  SA=$(dar $1 comun-1); SB=$(dar $2 comun-2)
  P=$(como $1 "select cartas_retar('$2', '$MA', '{}'::jsonb, array['$SA']::uuid[]);" | tail -1)
  como $2 "select cartas_responder('$P', true, '$MB', '{}'::jsonb, array['$SB']::uuid[]);" >/dev/null
}
limpiar
M1=$(mazo_de $U1); M2=$(mazo_de $U2); M3=$(mazo_de $U3); M4=$(mazo_de $U4)

echo "== Permisos: solo el servidor puede cerrar una apuesta con un veredicto"
nueva_apuesta $U1 $U2; PA=$P; SAa=$SA; SBa=$SB
for quien in "$U1" "$ADMIN" "$EDITOR"; do
  contiene "ni jugador, admin ni editor pueden llamar a la función ($(sql "select username from perfiles where user_id='$quien'"))" "$(como $quien "select cartas_i_aplicar_verificacion('$PA', 'j1', 'verificada');")" "permission denied"
done
contiene "sin sesión tampoco" "$(anonimo "select cartas_i_aplicar_verificacion('$PA', 'j1', 'verificada');")" "permission denied"
comprobar "la apuesta sigue intacta" "en_curso/activa/-/-" "$(estado_partida $PA)"
contiene "el servidor no acepta un resultado inventado" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'gana-el-mejor', 'verificada');")" "Resultado inválido"
contiene "ni un motivo inventado" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'j1', 'porque-si');")" "Motivo inválido"
contiene "un abandono no puede ser empate" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'empate', 'abandono');")" "no puede ser empate"
contiene "una partida que no existe da error claro" "$(servicio "select cartas_i_aplicar_verificacion(gen_random_uuid(), 'j1', 'verificada');")" "no encontrada"

echo "== Disputa: el registro decide, no el admin a ojo"
como $U1 "select cartas_terminar('$PA', 'j1');" >/dev/null
como $U2 "select cartas_terminar('$PA', 'j2');" >/dev/null
comprobar "los avisos chocan: disputa" "disputa/activa/-/-" "$(estado_partida $PA)"
comprobar "el panel ve la disputa" "1" "$(como $ADMIN "select jsonb_array_length(jsonb_path_query_array(cartas_admin_apuestas(), '\$[*] ? (@.situacion == \"disputa\")'));" | tail -1)"
R=$(servicio "select cartas_i_aplicar_verificacion('$PA', 'j2', 'verificada', 'Repetida: gana Dos en el turno 7');")
contiene "el servidor resuelve con el veredicto" "$R" "resuelta"
comprobar "estado final: terminada, verificada, gana el segundo" "terminada/resuelta/verificada/j2" "$(estado_partida $PA)"
comprobar "el ganador del registro se lleva la carta del otro" "$U2/poseida" "$(dueno $SAa)"
comprobar "y conserva la suya" "$U2/poseida" "$(dueno $SBa)"
comprobar "no quedan bloqueos" "0" "$(bloqueos)"
comprobar "quien mintió queda anotado una vez" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U1'")"
comprobar "quien dijo la verdad no queda anotado" "0" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U2'")"
comprobar "queda constancia de que se resolvió por el registro" "1" "$(sql "select count(*) from cartas_incidencias where tipo='apuesta_resuelta_por_registro' and referencia='apuesta:$PA'")"
comprobar "llamarlo otra vez no mueve nada" "ya-resuelta" "$(servicio "select cartas_i_aplicar_verificacion('$PA', 'j1', 'verificada');" | tail -1)"
comprobar "...y las cartas siguen donde estaban" "$U2/poseida" "$(dueno $SAa)"
comprobar "...y nadie queda anotado dos veces" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido'")"
REP=$(como $ADMIN "select cartas_admin_reputacion();")
contiene "el panel muestra a Uno con 1 aviso desmentido" "$REP" '"avisos_desmentidos": 1'
contiene "...y no a un jugador sin historial" "$(printf '%s' "$REP" | grep -c Tres)" "0"
contiene "un jugador no ve la reputación de nadie" "$(como $U1 "select cartas_admin_reputacion();")" "No autorizado"

echo "== Aviso falso con el rival callado: antes ganaba el mentiroso, ahora gana el registro"
nueva_apuesta $U3 $U4; PB=$P; SA3=$SA; SB4=$SB
como $U3 "select cartas_terminar('$PB', 'j1');" >/dev/null
comprobar "con un solo aviso sigue en curso" "en_curso/activa/-/-" "$(estado_partida $PB)"
servicio "select cartas_i_aplicar_verificacion('$PB', 'j2', 'verificada');" >/dev/null
comprobar "el registro dice que ganó el otro: se resuelve a su favor" "terminada/resuelta/verificada/j2" "$(estado_partida $PB)"
comprobar "el que mintió pierde su carta" "$U4/poseida" "$(dueno $SA3)"
comprobar "queda anotado el aviso desmentido de Tres" "1" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U3'")"

echo "== Aviso verdadero con el rival callado: se confirma al instante, sin esperar 24 horas"
nueva_apuesta $U1 $U3; PC=$P; SAc=$SA; SBc=$SB
como $U1 "select cartas_terminar('$PC', 'j1');" >/dev/null
servicio "select cartas_i_aplicar_verificacion('$PC', 'j1', 'verificada');" >/dev/null
comprobar "gana quien avisó, ahora con pruebas" "terminada/resuelta/verificada/j1" "$(estado_partida $PC)"
comprobar "se lleva la carta del callado" "$U1/poseida" "$(dueno $SBc)"
comprobar "nadie queda anotado por avisar la verdad" "0" "$(sql "select count(*) from cartas_incidencias where tipo='aviso_desmentido' and jugador='$U1' and referencia='apuesta:$PC'")"

echo "== Empate verificado"
nueva_apuesta $U2 $U4; PD=$P; SAd=$SA; SBd=$SB
servicio "select cartas_i_aplicar_verificacion('$PD', 'empate', 'verificada');" >/dev/null
comprobar "cada carta vuelve a su dueño" "$U2/poseida|$U4/poseida" "$(dueno $SAd)|$(dueno $SBd)"

echo "== Abandono: quien deja de jugar pierde"
nueva_apuesta $U1 $U4; PE=$P; SAe=$SA; SBe=$SB
servicio "select cartas_i_aplicar_verificacion('$PE', 'j1', 'abandono', 'Cuatro no actuó en 49 horas');" >/dev/null
comprobar "gana el que se quedó, por abandono" "terminada/resuelta/abandono/j1" "$(estado_partida $PE)"
comprobar "se lleva la carta del que desapareció" "$U1/poseida" "$(dueno $SBe)"
comprobar "el abandono queda anotado al que desapareció" "1" "$(sql "select count(*) from cartas_incidencias where tipo='abandono' and jugador='$U4'")"
contiene "el panel lo cuenta" "$(como $ADMIN "select cartas_admin_reputacion();")" '"abandonos": 1'
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Casos que no se tocan"
SAf=$(dar $U2 comun-3); PF=$(como $U2 "select cartas_retar('$U3', '$M2', '{}'::jsonb, '{}'::uuid[]);" | tail -1)
como $U3 "select cartas_responder('$PF', true, '$M3', '{}'::jsonb, '{}'::uuid[]);" >/dev/null
comprobar "una partida sin apuesta no se cierra por esta vía" "ya-resuelta" "$(servicio "select cartas_i_aplicar_verificacion('$PF', 'j1', 'verificada');" | tail -1)"
comprobar "...y sigue en curso" "en_curso/-/-/-" "$(estado_partida $PF)"
PG=$(como $U1 "select cartas_retar('$U2', '$M1', '{}'::jsonb, array['$(dar $U1 comun-4)']::uuid[]);" | tail -1)
comprobar "un reto sin aceptar no se cierra por esta vía" "ya-resuelta" "$(servicio "select cartas_i_aplicar_verificacion('$PG', 'j1', 'verificada');" | tail -1)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
