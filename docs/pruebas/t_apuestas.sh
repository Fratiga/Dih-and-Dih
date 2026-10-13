#!/bin/sh
# Pruebas de duelos con apuesta (A1, A11, regla de silencio, bloqueos huérfanos, disputas). Uso: sh docs/pruebas/t_apuestas.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0

estado_partida() { sql "select estado||'/'||coalesce(apuesta_estado,'-')||'/'||coalesce(motivo,'-')||'/'||coalesce(resultado,'-') from cartas_partidas where id='$1'"; }
dueno() { sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$1'"; }
bloqueos() { sql "select count(*) from cartas_bloqueos"; }
refrescar() { como $U4 "select cartas_refrescar();" >/dev/null; }
# retador $1 reta a $2 con una carta común apostada; el rival acepta con otra. Deja P (partida), SA y SB (las cartas apostadas)
nueva_apuesta() {
  eval "MA=\$M$(echo $1 | tail -c 2 | tr -d 0)"; eval "MB=\$M$(echo $2 | tail -c 2 | tr -d 0)"
  SA=$(dar $1 comun-1); SB=$(dar $2 comun-2)
  P=$(como $1 "select cartas_retar('$2', '$MA', '{}'::jsonb, array['$SA']::uuid[]);" | tail -1)
  como $2 "select cartas_responder('$P', true, '$MB', '{}'::jsonb, array['$SB']::uuid[]);" >/dev/null
}

limpiar
M1=$(mazo_de $U1); M2=$(mazo_de $U2); M3=$(mazo_de $U3); M4=$(mazo_de $U4)

echo "== A1: el servidor construye las cartas del duelo, no el navegador"
SA=$(dar $U1 comun-1); SB=$(dar $U2 comun-2)
FALSO='{"comun-1":{"id":"comun-1","nombre":"HACK","atq":99,"pv":99,"coste":0},"inventada":{"id":"inventada","atq":50,"pv":50}}'
P=$(como $U1 "select cartas_retar('$U2', '$M1', '$FALSO'::jsonb, array['$SA']::uuid[]);" | tail -1)
comprobar "el reto se crea" "pendiente/pendiente/-/-" "$(estado_partida $P)"
comprobar "el ataque de Común 1 es el oficial, no 99" "2" "$(sql "select cartas->'comun-1'->>'atq' from cartas_partidas where id='$P'")"
comprobar "el nombre es el oficial" "Común 1" "$(sql "select cartas->'comun-1'->>'nombre' from cartas_partidas where id='$P'")"
comprobar "no entró ninguna carta inventada" "0" "$(sql "select count(*) from cartas_partidas where id='$P' and cartas ? 'inventada'")"
comprobar "están las 7 cartas distintas del mazo" "7" "$(sql "select count(*) from cartas_partidas p, jsonb_object_keys(p.cartas) where p.id='$P'")"
FALSO2='{"comun-1":{"id":"comun-1","nombre":"HACK2","atq":77,"pv":77},"poco-1":{"id":"poco-1","nombre":"HACK3","atq":88,"pv":88}}'
como $U2 "select cartas_responder('$P', true, '$M2', '$FALSO2'::jsonb, array['$SB']::uuid[]);" >/dev/null
comprobar "queda en curso con apuesta activa" "en_curso/activa/-/-" "$(estado_partida $P)"
comprobar "quien acepta no pisa las cartas del retador (Común 1)" "2" "$(sql "select cartas->'comun-1'->>'atq' from cartas_partidas where id='$P'")"
comprobar "ni mete cartas falsas (Poco común 1 oficial)" "3" "$(sql "select cartas->'poco-1'->>'atq' from cartas_partidas where id='$P'")"
comprobar "ningún texto falso en las cartas" "0" "$(sql "select count(*) from cartas_partidas where id='$P' and cartas::text like '%HACK%'")"
comprobar "las dos apuestas están bloqueadas" "2" "$(bloqueos)"
echo "== Resultado: los dos avisan lo mismo"
como $U1 "select cartas_terminar('$P', 'j1');" >/dev/null
comprobar "con un aviso solo, sigue en curso" "en_curso/activa/-/-" "$(estado_partida $P)"
como $U2 "select cartas_terminar('$P', 'j1');" >/dev/null
comprobar "si el segundo reconoce que perdió, se resuelve (concesión)" "terminada/resuelta/acuerdo/j1" "$(estado_partida $P)"
comprobar "el ganador tiene la carta del perdedor" "$U1/poseida" "$(dueno $SB)"
comprobar "el ganador conserva la suya" "$U1/poseida" "$(dueno $SA)"
comprobar "no quedan bloqueos" "0" "$(bloqueos)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Los dos avisan empate"
nueva_apuesta $U2 $U3; PEM=$P; SAem=$SA; SBem=$SB
como $U2 "select cartas_terminar('$PEM', 'empate');" >/dev/null
como $U3 "select cartas_terminar('$PEM', 'empate');" >/dev/null
comprobar "dos avisos iguales de empate: se resuelve" "terminada/resuelta/vida/empate" "$(estado_partida $PEM)"
comprobar "cada carta vuelve a su dueño" "$U2/poseida|$U3/poseida" "$(dueno $SAem)|$(dueno $SBem)"

echo "== Disputa y resolución del admin"
nueva_apuesta $U3 $U4; PB=$P; SA3=$SA; SB4=$SB
como $U3 "select cartas_terminar('$PB', 'j1');" >/dev/null
como $U4 "select cartas_terminar('$PB', 'j2');" >/dev/null
comprobar "avisos distintos: disputa, con las cartas todavía bloqueadas" "disputa/activa/-/-" "$(estado_partida $PB)"
comprobar "...y los dos bloqueos siguen" "2" "$(bloqueos)"
contiene "un jugador no puede resolver la disputa" "$(como $U3 "select cartas_admin_resolver_apuesta('$PB', 'j1');")" "No autorizado"
como $ADMIN "select cartas_admin_resolver_apuesta('$PB', 'empate');" >/dev/null
comprobar "el admin la resuelve como empate" "terminada/resuelta/admin/empate" "$(estado_partida $PB)"
comprobar "cada carta vuelve a su dueño (3)" "$U3/poseida" "$(dueno $SA3)"
comprobar "cada carta vuelve a su dueño (4)" "$U4/poseida" "$(dueno $SB4)"
comprobar "no quedan bloqueos" "0" "$(bloqueos)"
contiene "el admin no puede resolver dos veces" "$(como $ADMIN "select cartas_admin_resolver_apuesta('$PB', 'j1');")" "ya terminó"

echo "== Regla de silencio: un solo aviso y el otro calla (24 horas)"
nueva_apuesta $U1 $U3; PC=$P; SAc=$SA; SBc=$SB
como $U1 "select cartas_terminar('$PC', 'j1');" >/dev/null
sql "update cartas_partidas set reportado = now() - interval '23 hours' where id='$PC'" >/dev/null
refrescar
comprobar "a las 23 horas todavía no se devuelve" "en_curso/activa/-/-" "$(estado_partida $PC)"
sql "update cartas_partidas set reportado = now() - interval '25 hours' where id='$PC'" >/dev/null
refrescar
comprobar "a las 25 horas se cancela y se devuelve, sin ganador" "cancelada/devuelta/tiempo/-" "$(estado_partida $PC)"
comprobar "la carta del que avisó sigue siendo suya" "$U1/poseida" "$(dueno $SAc)"
comprobar "la del que calló también" "$U3/poseida" "$(dueno $SBc)"
comprobar "no quedan bloqueos" "0" "$(bloqueos)"
refrescar; refrescar
comprobar "refrescar otra vez no cambia nada" "cancelada/devuelta/tiempo/-" "$(estado_partida $PC)"
comprobar "cada carta se desbloqueó una sola vez (no hay doble devolución)" "1|1" "$(sql "select (select count(*) from cartas_movimientos where ejemplar='$SAc' and tipo='desbloqueo')||'|'||(select count(*) from cartas_movimientos where ejemplar='$SBc' and tipo='desbloqueo')")"
comprobar "queda constancia en las incidencias, una vez" "1" "$(sql "select count(*) from cartas_incidencias where tipo='apuesta_devuelta_por_tiempo' and referencia='apuesta:$PC'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Partida apostada sin ningún aviso (72 horas)"
nueva_apuesta $U2 $U4; PD=$P; SAd=$SA; SBd=$SB
sql "update cartas_partidas set actualizada = now() - interval '71 hours' where id='$PD'" >/dev/null
refrescar
comprobar "a las 71 horas sigue en curso" "en_curso/activa/-/-" "$(estado_partida $PD)"
sql "update cartas_partidas set actualizada = now() - interval '73 hours' where id='$PD'" >/dev/null
refrescar
comprobar "a las 73 horas se devuelve" "cancelada/devuelta/tiempo/-" "$(estado_partida $PD)"
comprobar "cartas de vuelta con sus dueños" "$U2/poseida|$U4/poseida" "$(dueno $SAd)|$(dueno $SBd)"
echo "== Los avisos tienen su ajuste: si el admin cambia el plazo, se respeta"
como $ADMIN "select cartas_admin_guardar_ajustes('{\"apuesta_silencio_horas\": 48}'::jsonb);" >/dev/null
nueva_apuesta $U1 $U4; PE=$P; SAe=$SA; SBe=$SB
como $U1 "select cartas_terminar('$PE', 'j1');" >/dev/null
sql "update cartas_partidas set reportado = now() - interval '30 hours' where id='$PE'" >/dev/null
refrescar
comprobar "con plazo de 48 h, a las 30 h no se devuelve" "en_curso/activa/-/-" "$(estado_partida $PE)"
como $ADMIN "select cartas_admin_guardar_ajustes('{\"apuesta_silencio_horas\": 24}'::jsonb);" >/dev/null
refrescar
comprobar "al volver a 24 h, sí" "cancelada/devuelta/tiempo/-" "$(estado_partida $PE)"

echo "== Concesión definitiva"
nueva_apuesta $U2 $U3; PF=$P; SAf=$SA; SBf=$SB
como $U2 "select cartas_terminar('$PF', 'j2');" >/dev/null
comprobar "declararse perdedor cierra al momento" "terminada/resuelta/acuerdo/j2" "$(estado_partida $PF)"
comprobar "el rival se lleva la carta apostada" "$U3/poseida" "$(dueno $SAf)"

echo "== Reto sin respuesta (7 días) y rendición del retador"
SAg=$(dar $U1 comun-3)
PG=$(como $U1 "select cartas_retar('$U3', '$M1', '{}'::jsonb, array['$SAg']::uuid[]);" | tail -1)
comprobar "la carta del reto queda bloqueada" "$U1/bloqueada" "$(dueno $SAg)"
sql "update cartas_partidas set creada = now() - interval '8 days' where id='$PG'" >/dev/null
refrescar
comprobar "pasados 7 días el reto se rechaza y se devuelve" "rechazada/devuelta/-/-" "$(estado_partida $PG)"
comprobar "la carta queda libre" "$U1/poseida" "$(dueno $SAg)"
SAh=$(dar $U1 comun-3)
PH=$(como $U1 "select cartas_retar('$U3', '$M1', '{}'::jsonb, array['$SAh']::uuid[]);" | tail -1)
como $U1 "select cartas_rendirse('$PH');" >/dev/null
comprobar "el retador puede retirar su reto pendiente" "rechazada/devuelta/-/-" "$(estado_partida $PH)"
comprobar "la carta queda libre" "$U1/poseida" "$(dueno $SAh)"

echo "== Bloqueos huérfanos y recuperación por el admin"
H1=$(dar $U1 comun-4); H2=$(dar $U2 comun-4)
sql "update cartas_ejemplares set estado='bloqueada' where id in ('$H1','$H2'); insert into cartas_bloqueos (ejemplar, motivo, referencia) values ('$H1', 'apuesta', 'apuesta:'||gen_random_uuid()), ('$H2', 'intercambio', 'trueque:'||gen_random_uuid());" >/dev/null
comprobar "hay 2 bloqueos sin operación" "2" "$(bloqueos)"
contiene "la auditoría ve las dos bloqueadas" "$(auditar)" "0"
H3=$(dar $U3 comun-4)
sql "update cartas_ejemplares set estado='bloqueada' where id='$H3'; insert into cartas_bloqueos (ejemplar, motivo, referencia, caduca) values ('$H3', 'apuesta', 'apuesta:00000000-0000-4000-8000-000000000999', null);" >/dev/null
BL=$(como $ADMIN "select cartas_admin_bloqueos();")
contiene "el panel ve los bloqueos con su situación" "$BL" "inexistente"
contiene "no se puede liberar sin motivo" "$(como $ADMIN "select cartas_admin_liberar_bloqueos('apuesta:00000000-0000-4000-8000-000000000999', 'x');")" "motivo"
como $ADMIN "select cartas_admin_liberar_bloqueos('apuesta:00000000-0000-4000-8000-000000000999', 'copia atascada en prueba');" >/dev/null
comprobar "el admin libera un bloqueo huérfano" "$U3/poseida" "$(dueno $H3)"
refrescar
comprobar "el servidor suelta solo los otros dos al abrir el lobby" "0" "$(bloqueos)"
comprobar "...y las copias quedan libres con su dueño" "$U1/poseida|$U2/poseida" "$(dueno $H1)|$(dueno $H2)"
nueva_apuesta $U1 $U2; PI=$P
contiene "el admin NO puede soltar a mano una apuesta activa" "$(como $ADMIN "select cartas_admin_liberar_bloqueos('apuesta:$PI', 'quiero soltarla');")" "sigue activa"
como $ADMIN "select cartas_admin_resolver_apuesta('$PI', 'cancelar');" >/dev/null
comprobar "se cancela por su vía y se devuelve" "cancelada/devuelta/admin/-" "$(estado_partida $PI)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Editor y admin no juegan con cartas que no tienen cuando hay apuesta"
sql "insert into cartas_mazos (user_id, nombre, cartas) values ('$EDITOR', 'Mazo ajeno', '{\"comun-1\":3,\"comun-2\":3,\"comun-3\":3,\"comun-4\":3,\"comun-5\":3,\"comun-6\":3,\"poco-1\":2}'::jsonb)" >/dev/null
ME=$(sql "select id from cartas_mazos where user_id='$EDITOR'")
SE=$(dar $EDITOR poco-2)
contiene "el editor no puede retar con apuesta usando un mazo que no posee" "$(como $EDITOR "select cartas_retar('$U3', '$ME', '{}'::jsonb, array['$SE']::uuid[]);")" "No tienes suficientes copias"
nocontiene "...pero sí puede retar sin apuesta (prueba entre amigos)" "$(como $EDITOR "select cartas_retar('$U3', '$ME', '{}'::jsonb, '{}'::uuid[]);")" "ERROR"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
