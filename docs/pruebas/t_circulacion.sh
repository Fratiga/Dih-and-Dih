#!/bin/sh
# La etiqueta «En circulación»: una carta que no lo está no entra por ninguna vía automática. Uso: sh docs/pruebas/t_circulacion.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
limpiar
# cartas_guardar de prueba para crear una carta nueva
NUEVA="jsonb_build_object('nombre', 'Nueva', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 10, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x')"
circ() { sql "select en_circulacion from cartas_catalogo where id='$1'"; }
poner() { sql "update cartas_catalogo set en_circulacion = $2 where id in ($1)"; }   # poner "'a','b'" true|false
todas() { sql "update cartas_catalogo set en_circulacion = $1"; }

echo "== Una carta nueva nace fuera de circulación"
como $EDITOR "select cartas_guardar('carta-editor', $NUEVA, true);" >/dev/null
comprobar "la que crea un editor" "f" "$(circ carta-editor)"
como $ADMIN "select cartas_guardar('carta-admin', $NUEVA, true);" >/dev/null
comprobar "la que crea el admin también" "f" "$(circ carta-admin)"
como $ADMIN "select cartas_guardar('comun-1', jsonb_build_object('nombre', 'Común 1 editada', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 20, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x'), true);" >/dev/null
comprobar "editar una carta ya en circulación no cambia la etiqueta" "t" "$(circ comun-1)"

echo "== Quién cambia la etiqueta"
contiene "un jugador no puede" "$(como $U1 "select cartas_admin_guardar_limites('[{\"id\":\"comun-1\",\"en_circulacion\":false}]'::jsonb);")" "No autorizado"
contiene "un editor tampoco" "$(como $EDITOR "select cartas_admin_guardar_limites('[{\"id\":\"comun-1\",\"en_circulacion\":false}]'::jsonb);")" "No autorizado"
comprobar "sigue en circulación" "t" "$(circ comun-1)"
contiene "el valor tiene que ser sí o no" "$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\":\"comun-1\",\"en_circulacion\":\"si\"}]'::jsonb);")" "sí o no"
comprobar "el admin cambia dos cartas a la vez (devuelve 2 cambios)" "2" "$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\":\"carta-editor\",\"en_circulacion\":true},{\"id\":\"carta-admin\",\"en_circulacion\":true}]'::jsonb);" | tail -1)"
comprobar "quedaron en circulación" "t|t" "$(circ carta-editor)|$(circ carta-admin)"
comprobar "repetir el mismo cambio no cambia nada (0)" "0" "$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\":\"carta-editor\",\"en_circulacion\":true}]'::jsonb);" | tail -1)"
comprobar "queda anotado quién y cuándo" "2" "$(sql "select count(*) from cartas_incidencias where tipo='circulacion' and resuelta_por='$ADMIN' and detalle='Puesta en circulación'")"
contiene "el panel ve la etiqueta de cada carta" "$(como $ADMIN "select cartas_admin_limites();")" '"en_circulacion": true'
poner "'carta-editor','carta-admin'" false

echo "== Ninguna vía automática emite una carta fuera de circulación"
todas true
RES=$(dar $U2 comun-1); sql "select cartas_i_retirar('$RES', 'reserva', 'prueba');" >/dev/null     # una copia en la reserva
poner "'comun-1'" false
contiene "no se emite una nueva" "$(sql "select cartas_i_emitir('$U1', 'comun-1', 'recompensa', '', null, false);" 2>&1)" "todavía no está en circulación"
comprobar "...tampoco se reparte la de la reserva" "en_reserva" "$(sql "select estado from cartas_ejemplares where id='$RES'")"
nocontiene "el admin sí puede regalarla a mano" "$(como $ADMIN "select cartas_regalar('$U1', 'comun-1', 'prueba');")" "ERROR"
comprobar "...y eso no la pone en circulación" "f" "$(circ comun-1)"
poner "'comun-1'" true
nocontiene "en circulación vuelve a salir (de la reserva)" "$(sql "select cartas_i_emitir('$U1', 'comun-1', 'recompensa', '', null, false);" 2>&1)" "ERROR"
comprobar "...y sale justo la copia de la reserva" "$U1/poseida" "$(sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$RES'")"

echo "== Recompensas de minijuegos"
limpiar; todas false; poner "'rara-1'" true
sql "update cartas_juegos set activo = true" >/dev/null
TK=$(como $U1 "select cartas_juego_iniciar('arqueria', 'cassius');" | tail -1)
sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
RW=$(como $U1 "select cartas_juego_terminar('$TK', 'gana', 40);")
contiene "con solo Rara 1 en circulación, la recompensa es Rara 1" "$RW" '"carta": "rara-1"'
todas false
TK=$(como $U2 "select cartas_juego_iniciar('arqueria', 'cassius');" | tail -1)
sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
RW=$(como $U2 "select cartas_juego_terminar('$TK', 'gana', 40);")
nocontiene "con ninguna carta en circulación no se da carta" "$RW" '"resultado": "carta"'
comprobar "...y el jugador no recibió nada" "0" "$(sql "select count(*) from cartas_ejemplares where propietario='$U2'")"
sql "update cartas_juegos set activo = false" >/dev/null

echo "== Forja"
limpiar; todas true
ids=""; for k in 1 2 3 4 5; do ids="$ids,'$(dar $U1 comun-$k)'"; done
poner "'poco-1','poco-2','poco-3','poco-4','poco-5','poco-6'" false
FS=$(como $U1 "select cartas_forjar('fundir-comunes', array[${ids#,}]::uuid[]);")
contiene "sin poco comunes en circulación no hay salida y no se consume nada" "$FS" "sin-salida"
comprobar "...las 5 comunes siguen siendo suyas" "5" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and estado='poseida'")"
poner "'poco-3'" true
FS=$(como $U1 "select cartas_forjar('fundir-comunes', array[${ids#,}]::uuid[]);")
contiene "con solo Poco común 3 en circulación, sale esa" "$FS" '"carta": "poco-3"'

echo "== Mercader y disponibilidad"
limpiar; todas true
A=$(dar $U4 poco-1); B=$(dar $U4 poco-2)
sql "select cartas_i_retirar('$A', 'mercader', 'prueba'); select cartas_i_retirar('$B', 'mercader', 'prueba');" >/dev/null
poner "'poco-1'" false
V=$(como $U1 "select cartas_mercader_ver();")
contiene "el escaparate enseña la que está en circulación" "$V" '"carta": "poco-2"'
nocontiene "...y no la que no lo está" "$V" '"carta": "poco-1"'
todas true; poner "'poco-4','poco-5'" false
sql "update cartas_catalogo set obtenible = false where id = 'bufon'" >/dev/null
comprobar "cartas_disponibilidad solo cuenta las que están en circulación (21 de 23 menos Bufón y las 2 quitadas)" "$(sql "select count(*) from cartas_catalogo where obtenible and publicada and en_circulacion")" "$(como $U1 "select jsonb_array_length(cartas_disponibilidad());" | tail -1)"

echo "== Quitar de circulación no quita nada a los jugadores"
limpiar; todas true
Z=$(dar $U1 comun-2)
como $ADMIN "select cartas_admin_guardar_limites('[{\"id\":\"comun-2\",\"en_circulacion\":false}]'::jsonb);" >/dev/null
comprobar "la copia sigue siendo suya y libre" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$Z'")"
nocontiene "y la puede ofrecer en un intercambio" "$(como $U1 "select cartas_ofrecer(null, array['$Z']::uuid[], '[{\"carta\":\"comun-3\",\"n\":1}]'::jsonb, '');")" "ERROR"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
