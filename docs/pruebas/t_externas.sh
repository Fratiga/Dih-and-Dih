#!/bin/sh
# Compatibilidad con lo que hay en producción y NO es de la economía de cartas: el Hipódromo (compra y venta de cartas con monedas),
# el cambio de Side desde el panel de admin y la recompensa de La Fractura. Uso: sh docs/pruebas/t_externas.sh
# Las líneas "NOTA" no son pruebas: son hallazgos que se dejan a la vista para decidir.
. "$(dirname "$0")/lib.sh"
FALLOS=0
nota() { printf '  NOTA %s\n' "$1"; }
limpiar
sql "delete from hipodromo_movimientos; delete from hipodromo_billeteras; delete from fractura_guerras;" >/dev/null
monedas() { sql "select coalesce((select saldo from hipodromo_billeteras where usuario='$1'), 0)::int"; }
dar_monedas() { sql "insert into hipodromo_billeteras (usuario, saldo) values ('$1', $2) on conflict (usuario) do update set saldo = $2" >/dev/null; }

echo "== Hipódromo: vender una carta a la reserva"
C=$(dar $U1 comun-3)
R=$(como $U1 "select hipodromo_vender_carta('$C');")
contiene "se vende una carta libre" "$R" '"ok": true'
comprobar "la carta pasa a la reserva y el jugador cobra 20" "-/en_reserva|20" "$(sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$C'")|$(monedas $U1)"
comprobar "queda en el libro de movimientos con su referencia" "1" "$(sql "select count(*) from cartas_movimientos where ejemplar='$C' and tipo='retirada_reserva' and referencia='hipodromo:venta'")"
contiene "no se puede vender dos veces la misma copia" "$(como $U1 "select hipodromo_vender_carta('$C');")" "no es tuya"
contiene "ni la de otro" "$(como $U2 "select hipodromo_vender_carta('$C');")" "no es tuya"
B=$(dar $U1 comun-4); sql "select cartas_i_bloquear(array['$B']::uuid[], 'apuesta', 'apuesta:x');" >/dev/null
contiene "ni una copia bloqueada en una apuesta o un intercambio" "$(como $U1 "select hipodromo_vender_carta('$B');")" "no está libre"
comprobar "la copia bloqueada sigue bloqueada" "bloqueada" "$(sql "select estado from cartas_ejemplares where id='$B'")"

echo "== Hipódromo: comprar una carta de la reserva"
dar_monedas $U2 50
R=$(como $U2 "select hipodromo_comprar_carta('comun-3');")
contiene "se compra con monedas suficientes" "$R" '"ok": true'
comprobar "la copia de la reserva pasa al comprador y se cobran 50" "$U2/poseida|0" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$C'")|$(monedas $U2)"
comprobar "no se emitió ninguna copia nueva" "1" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-3'")"
dar_monedas $U2 10
contiene "con pocas monedas no se compra" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "No quedan copias"
sql "select cartas_i_retirar('$C', 'reserva', 'prueba');" >/dev/null
contiene "...ni con monedas insuficientes aunque haya reserva" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "No tienes monedas"
comprobar "el saldo no cambió" "10" "$(monedas $U2)"

echo "== Hipódromo y la etiqueta «En circulación»"
if sql "select 1 from information_schema.columns where table_name='cartas_catalogo' and column_name='en_circulacion'" | grep -q 1; then
  dar_monedas $U2 100
  sql "update cartas_catalogo set en_circulacion = false where id = 'comun-3'" >/dev/null
  contiene "una carta fuera de circulación no se puede comprar aunque esté en la reserva" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "todavía no está en circulación"
  comprobar "...y no se cobra nada" "100" "$(monedas $U2)"
  comprobar "...y la copia sigue en la reserva" "en_reserva" "$(sql "select estado from cartas_ejemplares where id='$C'")"
  if como $U2 "select hipodromo_cartas_reserva();" | grep -q '"carta": "comun-3"'; then nota "hipodromo_cartas_reserva() ENSEÑA las cartas fuera de circulación (la compra falla, pero aparecen en la lista). Lo cambia quien mantiene el Hipódromo."; fi
  sql "update cartas_catalogo set en_circulacion = true where id = 'comun-3'" >/dev/null
  nocontiene "...y puesta en circulación vuelve a poder comprarse" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "ERROR"
  L=$(dar $U3 legendaria-1)
  R=$(como $U3 "select hipodromo_vender_carta('$L');")
  if printf '%s' "$R" | grep -q '"ok": true'; then nota "El Hipódromo compra legendarias (800 monedas) y las vende desde la reserva (2000): una legendaria puede cambiar de manos por monedas, sin pasar por las reglas del mercader (que las excluye)."; fi
fi

echo "== Hipódromo: dos compradores a la vez por la última copia de la reserva"
limpiar
sql "delete from hipodromo_movimientos; delete from hipodromo_billeteras;" >/dev/null
X=$(dar $U4 comun-6); sql "select cartas_i_retirar('$X', 'reserva', 'prueba');" >/dev/null
dar_monedas $U1 100; dar_monedas $U2 100
TMP=$(mktemp -d)
como $U1 "select hipodromo_comprar_carta('comun-6');" 2 > "$TMP/a" &
sleep 0.6
como $U2 "select hipodromo_comprar_carta('comun-6');" 0 > "$TMP/b" &
wait
comprobar "solo uno se la queda" "1" "$(cat "$TMP/a" "$TMP/b" | grep -c '"ok": true')"
comprobar "el otro no paga" "150" "$(( $(monedas $U1) + $(monedas $U2) ))"
comprobar "la copia tiene un solo dueño y no se emitió otra" "1" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-6' and propietario is not null")"
comprobar "la auditoría está limpia" "0" "$(auditar)"
rm -rf "$TMP"

echo "== Cambiar el Side desde el panel de admin (fichas_admin_set_side)"
if sql "select 1 from pg_trigger where tgname='perfiles_proteger_trg'" | grep -q 1; then
  nocontiene "el admin puede cambiar el Side de otro jugador" "$(como $ADMIN "select fichas_admin_set_side('$U1', 'B');")" "ERROR"
  comprobar "...y queda cambiado" "B" "$(sql "select side from perfiles where user_id='$U1'")"
  contiene "un jugador no puede usar la función" "$(como $U2 "select fichas_admin_set_side('$U1', 'A');")" "No autorizado"
  comprobar "...y el Side de Uno sigue como lo dejó el admin" "B" "$(sql "select side from perfiles where user_id='$U1'")"
  sql "update perfiles set side = 'A' where user_id='$U1'" >/dev/null
fi

echo "== La Fractura: su recompensa escribe directamente en la colección"
limpiar
sql "update cartas_catalogo set limite = null where id = 'comun-9'" >/dev/null     # la Fractura solo premia cartas SIN límite global
G=$(sql "insert into fractura_guerras (user_id, titulo, resultado, pvp, logros) values ('$U1', 'Guerra de prueba', 'victoria', false, '[]') returning id")
R=$(como $U1 "select fractura_recompensa('$G');")
if printf '%s' "$R" | grep -q '"carta"'; then
  CARTA=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
  EJ=$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id='$CARTA'")
  COL=$(sql "select coalesce(sum(cantidad), 0) from cartas_coleccion where user_id='$U1' and carta_id='$CARTA'")
  nota "fractura_recompensa dio $CARTA: la colección dice $COL copia(s) y los ejemplares dicen $EJ. La auditoría sale: $(auditar) problema(s)."
else
  nota "fractura_recompensa falló: $(printf '%s' "$R" | head -c 160 | tr '\n' ' ')"
fi

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
