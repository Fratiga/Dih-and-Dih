#!/bin/sh
# Pruebas con dos sesiones a la vez (A2, A3, A9). Uso: sh docs/pruebas/t_concurrencia.sh
# Cada sesión es una conexión distinta a Postgres; la primera retiene sus candados unos segundos para obligar a la segunda a esperar.
. "$(dirname "$0")/lib.sh"
FALLOS=0
TMP=$(mktemp -d)


echo "== A2: dos compras al mercader con las mismas cartas de entrada"
limpiar
C1=$(dar $U1 comun-1); C2=$(dar $U1 comun-2); C3=$(dar $U1 comun-3)
P1=$(dar $U4 poco-1); P2=$(dar $U4 poco-2)
sql "select cartas_i_retirar('$P1', 'mercader', 'prueba'); select cartas_i_retirar('$P2', 'mercader', 'prueba');" >/dev/null
OA=$(sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) values ('$P1', 3) returning id")
OB=$(sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) values ('$P2', 3) returning id")
ENTREGA="array['$C1','$C2','$C3']::uuid[]"
como $U1 "select cartas_mercader_comprar('$OA', $ENTREGA);" 3 > "$TMP/a" &
sleep 0.6
como $U1 "select cartas_mercader_comprar('$OB', $ENTREGA);" 0 > "$TMP/b" &
wait
echo "  sesión A: $(head -c 140 "$TMP/a" | tr '\n' ' ')"
echo "  sesión B: $(head -c 140 "$TMP/b" | tr '\n' ' ')"
GANADAS=$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id like 'poco-%' and estado in ('poseida','bloqueada')")
comprobar "el jugador recibe una sola carta del mercader por unas mismas entregas" "1" "$GANADAS"
sql "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\"}', false); select jsonb_array_length(cartas_auditoria());" | tail -1 | { read n; comprobar "la auditoría no encuentra nada raro" "0" "$n"; }

echo "== A3: aceptar un intercambio con una copia que se ofrece en otro intercambio a la vez"
limpiar
X1=$(dar $U1 comun-2)          # lo que ofrece el jugador 1
Y=$(dar $U2 comun-1)           # la copia que pide el jugador 1 y que el jugador 2 usa dos veces
T1=$(como $U1 "select cartas_ofrecer(null, array['$X1']::uuid[], '[{\"carta\":\"comun-1\",\"n\":1}]'::jsonb, 'p1');" | tail -1)
como $U2 "select cartas_ofrecer(null, array['$Y']::uuid[], '[{\"carta\":\"comun-3\",\"n\":1}]'::jsonb, 'p2');" 3 > "$TMP/c" &
sleep 0.6
como $U2 "select cartas_aceptar_trueque('$T1', array['$Y']::uuid[]);" 0 > "$TMP/d" &
wait
echo "  oferta de 2: $(head -c 140 "$TMP/c" | tr '\n' ' ')"
echo "  aceptar:     $(head -c 140 "$TMP/d" | tr '\n' ' ')"
ESTADO_Y=$(sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$Y'")
BLOQ=$(sql "select count(*) from cartas_bloqueos where ejemplar='$Y'")
ABIERTA=$(sql "select count(*) from cartas_intercambios where estado='abierta' and '$Y' = any(ofrece)")
if [ "$ESTADO_Y" = "$U2/bloqueada" ] && [ "$BLOQ" = "1" ]; then ok "la copia sigue siendo de su dueño y bloqueada por su oferta"
elif [ "$ESTADO_Y" = "$U1/poseida" ] && [ "$ABIERTA" = "0" ]; then ok "la copia se movió y el otro intercambio quedó cerrado"
else mal "estado incoherente: copia en $ESTADO_Y, bloqueos $BLOQ, ofertas abiertas que la incluyen $ABIERTA"; fi

rm -rf "$TMP"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
