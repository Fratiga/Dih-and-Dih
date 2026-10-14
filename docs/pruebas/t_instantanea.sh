#!/bin/sh
# Instantánea inmutable de las partidas: al aceptar el reto se guarda quiénes juegan, con qué cartas y mazos, semilla, vínculos y versión
# del motor; después nada de eso cambia, ni por ediciones posteriores ni por escrituras directas, y un resultado cerrado no se reescribe.
# Uso: sh docs/pruebas/t_instantanea.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
estado_partida() { sql "select estado||'/'||coalesce(apuesta_estado,'-')||'/'||coalesce(motivo,'-')||'/'||coalesce(resultado,'-') from cartas_partidas where id='$1'"; }
# Intenta un UPDATE directo como superusuario (la base de datos tiene que negarse igualmente)
intentar() { sql "$1" 2>&1; }
limpiar
sql "update cartas_economia_ajustes set valor = '\"v1\"' where clave = 'motor_version'" >/dev/null
M1=$(mazo_de $U1); M2=$(mazo_de $U2); M3=$(mazo_de $U3)
SA=$(dar $U1 comun-1); SB=$(dar $U2 comun-2)
P=$(como $U1 "select cartas_retar('$U2', '$M1', '{}'::jsonb, array['$SA']::uuid[]);" | tail -1)

echo "== Antes de aceptar no hay instantánea; al aceptar se toma"
comprobar "un reto pendiente no tiene instantánea" "|" "$(sql "select coalesce(instantanea::text,'')||'|'||coalesce(instantanea_hash,'') from cartas_partidas where id='$P'")"
como $U2 "select cartas_responder('$P', true, '$M2', '{}'::jsonb, array['$SB']::uuid[]);" >/dev/null
comprobar "al aceptar se guarda la instantánea y su huella" "true|true" "$(sql "select (instantanea is not null)||'|'||(instantanea_hash = md5(instantanea::text)) from cartas_partidas where id='$P'")"
comprobar "lleva a los dos participantes con su nombre de entonces" "$U1:Uno|$U2:Dos" "$(sql "select (instantanea->'participantes'->0->>'id')||':'||(instantanea->'participantes'->0->>'nombre')||'|'||(instantanea->'participantes'->1->>'id')||':'||(instantanea->'participantes'->1->>'nombre') from cartas_partidas where id='$P'")"
comprobar "las 7 cartas distintas de los dos mazos" "7" "$(sql "select count(*) from cartas_partidas p, jsonb_object_keys(p.instantanea->'cartas') where p.id='$P'")"
comprobar "los dos mazos de 20 cartas" "20|20" "$(sql "select jsonb_array_length(instantanea->'mazos'->0)||'|'||jsonb_array_length(instantanea->'mazos'->1) from cartas_partidas where id='$P'")"
comprobar "la semilla y el primer turno" "true|true" "$(sql "select ((instantanea->>'semilla')::int = semilla)||'|'||((instantanea->>'primero')::int = primero) from cartas_partidas where id='$P'")"
comprobar "la versión del motor la fija el servidor (el ajuste), no un jugador" "v1" "$(sql "select instantanea->>'motor' from cartas_partidas where id='$P'")"
comprobar "y la lista de vínculos (vacía aquí)" "[]" "$(sql "select (instantanea->'vinculos')::text from cartas_partidas where id='$P'")"
comprobar "las columnas de la partida coinciden con la instantánea" "t" "$(sql "select (instantanea->'cartas' = cartas) and (instantanea->'mazos'->0 = mazo1) and (instantanea->'mazos'->1 = mazo2) from cartas_partidas where id='$P'")"
comprobar "solo los dos jugadores ven la partida" "0" "$(como $U3 "select count(*) from cartas_partidas where id='$P';" | tail -1)"

echo "== Modificar cosas DESPUÉS no cambia la partida"
HASH=$(sql "select instantanea_hash from cartas_partidas where id='$P'")
ATQ=$(sql "select instantanea->'cartas'->'comun-1'->>'atq' from cartas_partidas where id='$P'")
como $U1 "update perfiles set username = 'Uno Cambiado' where user_id = '$U1';" >/dev/null
como $ADMIN "select cartas_guardar('comun-1', jsonb_build_object('nombre', 'Común 1 ahora muy fuerte', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 20, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 0, 'atq', 9, 'pv', 9, 'habilidad', 'otra cosa'), true);" >/dev/null
sql "insert into cartas_vinculos (id, tipo, data) values ('vinculo-nuevo', 'circulo', '{\"miembros\":[\"comun-1\",\"comun-2\"],\"niveles\":[{\"n\":2}]}'::jsonb)" >/dev/null
sql "update cartas_economia_ajustes set valor = '\"v2\"' where clave = 'motor_version'" >/dev/null
sql "update cartas_mazos set cartas = '{\"comun-1\":1}'::jsonb where user_id = '$U1'" >/dev/null
comprobar "la carta de hoy cambió de verdad (ataque 9)" "9" "$(sql "select data->>'atq' from cartas_definiciones where id='comun-1'")"
comprobar "el nombre de usuario cambió de verdad" "Uno Cambiado" "$(sql "select username from perfiles where user_id='$U1'")"
comprobar "la partida sigue con el ataque de entonces" "$ATQ" "$(sql "select cartas->'comun-1'->>'atq' from cartas_partidas where id='$P'")"
comprobar "la huella guardada sigue siendo la de entonces" "$HASH" "$(sql "select instantanea_hash from cartas_partidas where id='$P'")"
comprobar "y coincide con el contenido" "t" "$(sql "select md5(instantanea::text) = instantanea_hash from cartas_partidas where id='$P'")"
comprobar "los nombres de la partida son los de entonces" "Uno|Dos" "$(sql "select nombre1||'|'||nombre2 from cartas_partidas where id='$P'")"
comprobar "los vínculos nuevos no entran en la partida" "[]" "$(sql "select (instantanea->'vinculos')::text from cartas_partidas where id='$P'")"
comprobar "la versión del motor sigue siendo v1" "v1" "$(sql "select instantanea->>'motor' from cartas_partidas where id='$P'")"
comprobar "el mazo de la partida es el de entonces (20 cartas)" "20" "$(sql "select jsonb_array_length(mazo1) from cartas_partidas where id='$P'")"
comprobar "una partida NUEVA sí lleva lo de hoy (motor v2 y el vínculo nuevo)" "v2|1" "$(
  SA2=$(dar $U3 comun-1); SB2=$(dar $U2 comun-2)
  P2=$(como $U3 "select cartas_retar('$U2', '$M3', '{}'::jsonb, array['$SA2']::uuid[]);" | tail -1)
  como $U2 "select cartas_responder('$P2', true, '$M2', '{}'::jsonb, array['$SB2']::uuid[]);" >/dev/null
  sql "select (instantanea->>'motor')||'|'||jsonb_array_length(instantanea->'vinculos') from cartas_partidas where id='$P2'")"

sql "update cartas_mazos set cartas = '{\"comun-1\":3,\"comun-2\":3,\"comun-3\":3,\"comun-4\":3,\"comun-5\":3,\"comun-6\":3,\"poco-1\":2}'::jsonb where user_id = '$U1'" >/dev/null   # se devuelve el mazo de Uno
echo "== La base de datos no deja cambiar lo que define la partida (ni a mano)"
for col in "cartas = '{}'::jsonb" "mazo1 = '[]'::jsonb" "mazo2 = '[]'::jsonb" "semilla = 7" "primero = 1 - primero" "apuesta1 = '{}'" "apuesta2 = '{}'" \
           "nombre1 = 'Otro'" "nombre2 = 'Otro'" "instantanea = '{}'::jsonb" "instantanea_hash = 'x'" "apuesta1_info = '[]'::jsonb"; do
  contiene "no se puede cambiar ${col%% =*}" "$(intentar "update cartas_partidas set $col where id='$P';")" "La partida ya empezó"
done
contiene "ni cambiar a los jugadores" "$(intentar "update cartas_partidas set j1 = j2 where id='$P';")" "jugadores"
contiene "el registro de acciones no se puede acortar" "$(sql "update cartas_partidas set acciones = acciones || '[{\"t\":\"fin\"}]'::jsonb where id='$P'" >/dev/null; intentar "update cartas_partidas set acciones = '[]'::jsonb where id='$P';")" "no se puede acortar"
nocontiene "lo que sí puede moverse: la hora de última actividad y del primer aviso" "$(intentar "update cartas_partidas set actualizada = now(), reportado = now() where id='$P';")" "ERROR"

echo "== Un resultado cerrado no se reescribe"
como $U1 "select cartas_terminar('$P', 'j1');" >/dev/null
como $U2 "select cartas_terminar('$P', 'j2');" >/dev/null
contiene "un aviso ya puesto no se cambia" "$(intentar "update cartas_partidas set reporte1 = 'j2' where id='$P';")" "aviso de resultado"
N=$(sql "select jsonb_array_length(acciones) from cartas_partidas where id='$P'")
RES=$(servicio "select cartas_i_aplicar_verificacion('$P', 'j2', 'verificada', $N, now(), 'v1', 'cierre de prueba');" | tail -1)
comprobar "se cierra con la versión de la partida (v1)" "resuelta" "$RES"
comprobar "terminada, verificada, gana el segundo" "terminada/resuelta/verificada/j2" "$(estado_partida $P)"
contiene "el resultado no se puede reescribir" "$(intentar "update cartas_partidas set resultado = 'j1' where id='$P';")" "resultado de una partida"
contiene "ni el motivo" "$(intentar "update cartas_partidas set motivo = 'admin' where id='$P';")" "motivo de cierre"
contiene "ni reabrir la partida" "$(intentar "update cartas_partidas set estado = 'en_curso' where id='$P';")" "ya está cerrada"
contiene "ni la apuesta volver a activa" "$(intentar "update cartas_partidas set apuesta_estado = 'activa' where id='$P';")" "no puede volver atrás"
contiene "ni añadir acciones a una partida cerrada" "$(intentar "update cartas_partidas set acciones = acciones || '[{\"t\":\"fin\"}]'::jsonb where id='$P';")" "ya está cerrada"
echo "== Y lo editado después tampoco la cambia retrospectivamente"
como $ADMIN "select cartas_guardar('comun-2', jsonb_build_object('nombre', 'Común 2 reforzada', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 20, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 0, 'atq', 20, 'pv', 20, 'habilidad', 'x'), true);" >/dev/null
sql "update cartas_economia_ajustes set valor = '\"v3\"' where clave = 'motor_version'" >/dev/null
comprobar "repetir la verificación no cambia nada" "ya-resuelta" "$(servicio "select cartas_i_aplicar_verificacion('$P', 'j1', 'verificada', $N, now(), 'v3', 'otra');" | tail -1)"
comprobar "el resultado sigue siendo el de entonces" "terminada/resuelta/verificada/j2" "$(estado_partida $P)"

echo "== Una partida sin instantánea (anterior a ellas) o con la instantánea tocada no se decide automáticamente"
sql "update cartas_economia_ajustes set valor = '\"v1\"' where clave = 'motor_version'" >/dev/null
sql "update cartas_partidas set creada = creada - interval '2 days' where cardinality(apuesta1) > 0" >/dev/null
sql "update cartas_catalogo set limite = 200, limite_jugador = 99 where id in ('comun-1', 'comun-2')" >/dev/null
SA3=$(dar $U1 comun-1); SB3=$(dar $U4 comun-2); M4=$(mazo_de $U4)
P3=$(como $U1 "select cartas_retar('$U4', '$M1', '{}'::jsonb, array['$SA3']::uuid[]);" | tail -1)
como $U4 "select cartas_responder('$P3', true, '$M4', '{}'::jsonb, array['$SB3']::uuid[]);" >/dev/null
N3=$(sql "select jsonb_array_length(acciones) from cartas_partidas where id='$P3'")
sql "alter table cartas_partidas disable trigger cartas_partidas_inmutables; update cartas_partidas set instantanea = null, instantanea_hash = null where id='$P3'; alter table cartas_partidas enable trigger cartas_partidas_inmutables;" >/dev/null
comprobar "sin instantánea no se decide" "sin-instantanea" "$(servicio "select cartas_i_aplicar_verificacion('$P3', 'j1', 'verificada', $N3, now(), 'v1', 'x');" | tail -1)"
comprobar "...y la apuesta sigue intacta" "en_curso/activa/-/-" "$(estado_partida $P3)"
sql "alter table cartas_partidas disable trigger cartas_partidas_inmutables; update cartas_partidas set instantanea = jsonb_build_object('formato', 1, 'motor', 'v1', 'cartas', '{}'::jsonb), instantanea_hash = 'huella-falsa' where id='$P3'; alter table cartas_partidas enable trigger cartas_partidas_inmutables;" >/dev/null
comprobar "con una instantánea tocada (la huella no cuadra) tampoco" "alterada" "$(servicio "select cartas_i_aplicar_verificacion('$P3', 'j1', 'verificada', $N3, now(), 'v1', 'x');" | tail -1)"
comprobar "...y queda una incidencia" "1" "$(sql "select count(*) from cartas_incidencias where tipo='instantanea_alterada' and referencia='apuesta:$P3'")"
comprobar "...y la apuesta sigue intacta" "en_curso/activa/-/-" "$(estado_partida $P3)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
