#!/bin/sh
# Resoluciones simultáneas de una apuesta: nunca se resuelve dos veces, nunca se devuelve y se entrega a la vez, nunca se pierde una carta.
# Cada escenario lanza dos o tres sesiones reales a la vez sobre la misma partida; la primera retiene sus candados unos segundos.
# Uso: sh docs/pruebas/t_simultaneas.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
TMP=$(mktemp -d)
V=v1
estado_partida() { sql "select estado||'/'||coalesce(apuesta_estado,'-')||'/'||coalesce(motivo,'-')||'/'||coalesce(resultado,'-') from cartas_partidas where id='$1'"; }
dueno_de() { sql "select coalesce(propietario::text,'-') from cartas_ejemplares where id='$1'"; }
estado_de() { sql "select estado from cartas_ejemplares where id='$1'"; }
nueva_apuesta() {
  eval "MA=\$M$(echo $1 | tail -c 2 | tr -d 0)"; eval "MB=\$M$(echo $2 | tail -c 2 | tr -d 0)"
  UA=$1; UB=$2
  SA=$(dar $1 comun-1); SB=$(dar $2 comun-2)
  P=$(como $1 "select cartas_retar('$2', '$MA', '{}'::jsonb, array['$SA']::uuid[]);" | tail -1)
  como $2 "select cartas_responder('$P', true, '$MB', '{}'::jsonb, array['$SB']::uuid[]);" >/dev/null
  como $1 "select cartas_registrar_motor('$P', '$V');" >/dev/null
  como $2 "select cartas_registrar_motor('$P', '$V');" >/dev/null
}
llamada() {  # <partida> <resultado> <motivo>: la sentencia que lanzaría la función del servidor con los datos actuales
  datos=$(sql "select jsonb_array_length(acciones)||'|'||actualizada from cartas_partidas where id='$1'")
  echo "select cartas_i_aplicar_verificacion('$1', '$2', '$3', ${datos%%|*}, '${datos#*|}'::timestamptz, '$V', 'prueba');"
}
# Después de cada escenario: la apuesta quedó cerrada UNA sola vez y las cartas cuadran con ese cierre
coherente() {  # <descripción>
  est=$(estado_partida $P)
  case "$est" in
    terminada/resuelta/*/j1) esp="$UA|$UA"; trf=1 ;;
    terminada/resuelta/*/j2) esp="$UB|$UB"; trf=1 ;;
    terminada/resuelta/*/empate|cancelada/devuelta/*|rechazada/*) esp="$UA|$UB"; trf=0 ;;
    *) mal "$1: la apuesta quedó en un estado raro ($est)"; return ;;
  esac
  comprobar "$1: cada carta está donde dice el cierre ($est)" "$esp" "$(dueno_de $SA)|$(dueno_de $SB)"
  comprobar "$1: las cartas están libres y sin bloqueos" "poseida|poseida|0" "$(estado_de $SA)|$(estado_de $SB)|$(sql "select count(*) from cartas_bloqueos")"
  comprobar "$1: se transfirió exactamente lo que correspondía ($trf)" "$trf" "$(sql "select count(*) from cartas_movimientos where tipo='transferencia' and ejemplar in ('$SA','$SB')")"
  comprobar "$1: ninguna carta se desbloqueó dos veces" "ok" "$(sql "select case when count(*) filter (where n > 1) = 0 then 'ok' else 'doble' end from (select count(*) n from cartas_movimientos where tipo='desbloqueo' and ejemplar in ('$SA','$SB') group by ejemplar) x")"
  comprobar "$1: la auditoría está limpia" "0" "$(auditar)"
}
limpiar
M1=$(mazo_de $U1); M2=$(mazo_de $U2); M3=$(mazo_de $U3); M4=$(mazo_de $U4)
sql "update cartas_catalogo set limite = 400, limite_jugador = 99 where id in ('comun-1', 'comun-2')" >/dev/null
nuevo_dia() { sql "update cartas_partidas set creada = creada - interval '2 days' where cardinality(apuesta1) > 0" >/dev/null; }

echo "== 1. Dos verificaciones a la vez con el mismo veredicto"
nueva_apuesta $U1 $U2
servicio_espera "$(llamada $P j2 verificada)" 2 > "$TMP/a" &
sleep 0.6
servicio "$(llamada $P j2 verificada)" > "$TMP/b" &
wait
comprobar "una resuelve y la otra encuentra la apuesta ya cerrada" "1|1" "$(cat "$TMP/a" "$TMP/b" | grep -c '^resuelta$')|$(cat "$TMP/a" "$TMP/b" | grep -c '^ya-resuelta$')"
coherente "dos verificaciones"

echo "== 2. Dos verificaciones a la vez con veredictos contrarios (no puede pasar con un registro, pero la base de datos no debe fiarse)"
nuevo_dia; nueva_apuesta $U1 $U2
servicio_espera "$(llamada $P j1 verificada)" 2 > "$TMP/a" &
sleep 0.6
servicio "$(llamada $P j2 verificada)" > "$TMP/b" &
wait
comprobar "solo una de las dos se aplica" "1" "$(cat "$TMP/a" "$TMP/b" | grep -c '^resuelta$')"
coherente "veredictos contrarios"

echo "== 3. Verificación mientras los jugadores avisan el resultado"
nuevo_dia; nueva_apuesta $U1 $U2
servicio_espera "$(llamada $P j2 verificada)" 2 > "$TMP/a" &
sleep 0.6
como $U1 "select cartas_terminar('$P', 'j1');" 0 > "$TMP/b" &
como $U2 "select cartas_terminar('$P', 'j2');" 0 > "$TMP/c" &
wait
comprobar "gana el registro (j2) y nadie cobra por avisar" "terminada/resuelta/verificada/j2" "$(estado_partida $P)"
coherente "verificación y avisos"

echo "== 4. Verificación contra una rendición"
nuevo_dia; nueva_apuesta $U1 $U2
servicio_espera "$(llamada $P j1 verificada)" 2 > "$TMP/a" &
sleep 0.6
como $U1 "select cartas_rendirse('$P');" 0 > "$TMP/b" &
wait
echo "  (la verificación llegó primero: $(cat "$TMP/a" | tr '\n' ' ') / la rendición dijo: $(head -c 80 "$TMP/b" | tr '\n' ' '))"
comprobar "queda una sola resolución" "1" "$(sql "select count(*) from cartas_partidas where id='$P' and estado='terminada' and apuesta_estado='resuelta'")"
coherente "verificación y rendición"
# Y al revés: la rendición llega primero
nuevo_dia; nueva_apuesta $U1 $U2
como $U1 "select cartas_rendirse('$P');" 2 > "$TMP/a" &
sleep 0.6
servicio "$(llamada $P j1 verificada)" > "$TMP/b" &
wait
comprobar "la rendición manda: la verificación no cambia nada" "terminada/resuelta/rendicion/j2" "$(estado_partida $P)"
coherente "rendición y verificación"

echo "== 5. Verificación contra el admin que cancela y devuelve"
nuevo_dia; nueva_apuesta $U1 $U2
como $ADMIN "select cartas_admin_resolver_apuesta('$P', 'cancelar');" 2 > "$TMP/a" &
sleep 0.6
servicio "$(llamada $P j1 verificada)" > "$TMP/b" &
wait
comprobar "el admin llegó primero: se devolvió y la verificación no entrega" "cancelada/devuelta/admin/-" "$(estado_partida $P)"
coherente "admin y verificación"
nuevo_dia; nueva_apuesta $U1 $U2
servicio_espera "$(llamada $P j1 verificada)" 2 > "$TMP/a" &
sleep 0.6
como $ADMIN "select cartas_admin_resolver_apuesta('$P', 'cancelar');" 0 > "$TMP/b" &
wait
contiene "el admin llega tarde y se le dice que ya terminó" "$(cat "$TMP/b")" "ya terminó"
comprobar "la verificación manda: gana el primero" "terminada/resuelta/verificada/j1" "$(estado_partida $P)"
coherente "verificación y admin"

echo "== 6. Verificación contra el barrido por tiempo (un solo aviso pasadas 24 horas)"
nuevo_dia; nueva_apuesta $U1 $U2
como $U1 "select cartas_terminar('$P', 'j1');" >/dev/null
sql "update cartas_partidas set reportado = now() - interval '30 hours' where id='$P'" >/dev/null
servicio_espera "$(llamada $P j2 verificada)" 2 > "$TMP/a" &
sleep 0.6
como $U4 "select cartas_refrescar();" 0 > "$TMP/b" &
wait
echo "  (resultado final: $(estado_partida $P))"
coherente "verificación y barrido"
# Y el barrido primero, con la verificación llegando mientras
nuevo_dia; nueva_apuesta $U1 $U2
como $U1 "select cartas_terminar('$P', 'j1');" >/dev/null
sql "update cartas_partidas set reportado = now() - interval '30 hours' where id='$P'" >/dev/null
como $U4 "select cartas_refrescar();" 2 > "$TMP/a" &
sleep 0.6
servicio "$(llamada $P j2 verificada)" > "$TMP/b" &
wait
comprobar "el barrido devolvió y la verificación ya no encuentra nada" "cancelada/devuelta/tiempo/-" "$(estado_partida $P)"
coherente "barrido y verificación"

echo "== 7. Abandono: el jugador vuelve a actuar justo cuando se va a resolver"
nuevo_dia; nueva_apuesta $U1 $U2
TURNO=$(sql "select turno from cartas_partidas where id='$P'")
sql "update cartas_partidas set actualizada = now() - interval '50 hours' where id='$P'" >/dev/null
LL="$(llamada $P $( [ "$TURNO" = "$U1" ] && echo j2 || echo j1 ) abandono)"
como $TURNO "select cartas_accion('$P', '{\"t\":\"fin\"}'::jsonb);" 2 > "$TMP/a" &
sleep 0.6
servicio "$LL" > "$TMP/b" &
wait
comprobar "jugó a tiempo: no hay abandono y la partida sigue" "en_curso/activa/-/-" "$(estado_partida $P)"
contiene "la verificación vio que la marca de actividad había cambiado" "$(cat "$TMP/b")" "cambiada"
comprobar "las dos cartas siguen bloqueadas" "bloqueada|bloqueada" "$(estado_de $SA)|$(estado_de $SB)"
como $ADMIN "select cartas_admin_resolver_apuesta('$P', 'cancelar');" >/dev/null   # se cierra para el siguiente escenario
# Y al revés: el abandono se resuelve primero y la jugada llega tarde
nuevo_dia; nueva_apuesta $U1 $U2
TURNO=$(sql "select turno from cartas_partidas where id='$P'")
sql "update cartas_partidas set actualizada = now() - interval '50 hours' where id='$P'" >/dev/null
LL="$(llamada $P $( [ "$TURNO" = "$U1" ] && echo j2 || echo j1 ) abandono)"
servicio_espera "$LL" 2 > "$TMP/a" &
sleep 0.6
como $TURNO "select cartas_accion('$P', '{\"t\":\"fin\"}'::jsonb);" 0 > "$TMP/b" &
wait
comprobar "el abandono se aplicó primero" "terminada/resuelta/abandono/$( [ "$TURNO" = "$U1" ] && echo j2 || echo j1 )" "$(estado_partida $P)"
contiene "y la jugada tardía se rechaza: la partida ya no está en curso" "$(cat "$TMP/b")" "no está en curso"
coherente "abandono y jugada"

echo "== 8. Resolver una apuesta dos veces desde dos sesiones del admin"
nuevo_dia; nueva_apuesta $U1 $U2
como $U1 "select cartas_terminar('$P', 'j1');" >/dev/null; como $U2 "select cartas_terminar('$P', 'j2');" >/dev/null
como $ADMIN "select cartas_admin_resolver_apuesta('$P', 'j1');" 2 > "$TMP/a" &
sleep 0.6
como $ADMIN "select cartas_admin_resolver_apuesta('$P', 'j2');" 0 > "$TMP/b" &
wait
contiene "la segunda sesión se entera de que ya terminó" "$(cat "$TMP/b")" "ya terminó"
comprobar "vale la primera resolución" "terminada/resuelta/admin/j1" "$(estado_partida $P)"
coherente "dos resoluciones del admin"

rm -rf "$TMP"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
