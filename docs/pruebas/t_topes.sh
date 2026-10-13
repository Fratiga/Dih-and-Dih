#!/bin/sh
# A9: los topes diarios aguantan peticiones simultáneas del mismo jugador. Uso: sh docs/pruebas/t_topes.sh
# Cada sesión usa cartas distintas (comunes y poco comunes sin repetir) para que no se estorben por filas compartidas:
# así la única cosa que las ordena es el candado del jugador, que es justo lo que se quiere probar.
. "$(dirname "$0")/lib.sh"
FALLOS=0
TMP=$(mktemp -d)
limpiar

echo "== Mercader: 5 compras a la vez de un mismo jugador, tope de 3 al día"
i=0
while [ $i -lt 5 ]; do
  i=$((i + 1))
  E=$(dar $U4 poco-$i); sql "select cartas_i_retirar('$E', 'mercader', 'prueba');" >/dev/null
  O=$(sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) values ('$E', 2) returning id")
  A=$(dar $U1 comun-$((i * 2 - 1))); B=$(dar $U1 comun-$((i * 2)))
  echo "select cartas_mercader_comprar('$O', array['$A','$B']::uuid[]);" > "$TMP/cmd$i"
done
for i in 1 2 3 4 5; do como $U1 "$(cat "$TMP/cmd$i")" 2 > "$TMP/m$i" & done
wait
EXITOS=$(cat "$TMP"/m* | grep -c '"carta"')
CAP=$(cat "$TMP"/m* | grep -c 'Hoy ya hiciste 3 cambios')
comprobar "compras que salieron bien" "3" "$EXITOS"
comprobar "compras rechazadas por el tope" "2" "$CAP"
comprobar "cambios registrados hoy" "3" "$(sql "select count(*) from cartas_mercader_registro where user_id='$U1'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Forja: 5 forjas a la vez de un mismo jugador, tope de 3 al día"
limpiar
# una receta de prueba por sesión: 1 común distinta por 1 poco común de un tipo distinto
i=0
for tp in Criatura Objeto Terreno Acción Reacción; do
  i=$((i + 1))
  sql "insert into cartas_recetas (id, nombre, entrada, salida, exito, al_fallar, destino, orden) values ('prueba-$i', 'Prueba $i', '[{\"rareza\":\"comun\",\"n\":1}]', '{\"rareza\":\"infrecuente\",\"tipos\":[\"$tp\"]}', 1, 'perder_todo', 'destruida', 9) on conflict (id) do nothing" >/dev/null
  C=$(dar $U2 comun-$i)
  echo "select cartas_forjar('prueba-$i', array['$C']::uuid[]);" > "$TMP/cmd$i"
done
for i in 1 2 3 4 5; do como $U2 "$(cat "$TMP/cmd$i")" 2 > "$TMP/f$i" & done
wait
EXITOS=$(cat "$TMP"/f* | grep -c '"resultado": "carta"')
CAP=$(cat "$TMP"/f* | grep -c 'Hoy ya forjaste 3 veces')
comprobar "forjas que salieron bien" "3" "$EXITOS"
comprobar "forjas rechazadas por el tope" "2" "$CAP"
comprobar "forjas registradas hoy" "3" "$(sql "select count(*) from cartas_forja_registro where user_id='$U2'")"
comprobar "las 2 comunes de las forjas rechazadas siguen en su poder" "2" "$(sql "select count(*) from cartas_ejemplares where propietario='$U2' and carta_id like 'comun-%' and estado='poseida'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Intercambios abiertos: 8 ofertas a la vez de un mismo jugador, tope de 5 abiertos"
limpiar
i=0
while [ $i -lt 8 ]; do
  i=$((i + 1))
  E=$(dar $U3 comun-$i)
  echo "select cartas_ofrecer(null, array['$E']::uuid[], '[{\"carta\":\"comun-12\",\"n\":1}]'::jsonb, 'prueba $i');" > "$TMP/cmd$i"
done
for i in 1 2 3 4 5 6 7 8; do como $U3 "$(cat "$TMP/cmd$i")" 2 > "$TMP/o$i" & done
wait
comprobar "intercambios abiertos (tope 5)" "5" "$(sql "select count(*) from cartas_intercambios where estado='abierta' and de='$U3'")"
comprobar "copias bloqueadas por esos intercambios" "5" "$(sql "select count(*) from cartas_ejemplares where propietario='$U3' and estado='bloqueada'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Forja: dos forjas a la vez con las mismas cartas"
limpiar
ids=""; for k in 1 2 3 4 5; do ids="$ids,'$(dar $U1 comun-$k)'"; done
ARR="array[${ids#,}]::uuid[]"
como $U1 "select cartas_forjar('fundir-comunes', $ARR);" 2 > "$TMP/g1" &
sleep 0.5
como $U1 "select cartas_forjar('fundir-comunes', $ARR);" 0 > "$TMP/g2" &
wait
EXITOS=$(cat "$TMP"/g1 "$TMP"/g2 | grep -c '"resultado": "carta"')
comprobar "solo una forja consume esas cartas" "1" "$EXITOS"
comprobar "el jugador tiene una sola carta poco común nueva" "1" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id like 'poco-%'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

rm -rf "$TMP"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
