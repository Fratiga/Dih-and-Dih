#!/bin/sh
# Compatibilidad con lo que hay en producción y NO es de la economía de cartas: el Hipódromo (compra y venta de cartas con tokens),
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
contiene "se compra con tokens suficientes" "$R" '"ok": true'
comprobar "la copia de la reserva pasa al comprador y se cobran 50" "$U2/poseida|0" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$C'")|$(monedas $U2)"
comprobar "no se emitió ninguna copia nueva" "1" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-3'")"
dar_monedas $U2 10
contiene "con pocos tokens no se compra" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "No quedan copias"
sql "select cartas_i_retirar('$C', 'reserva', 'prueba');" >/dev/null
contiene "...ni con tokens insuficientes aunque haya reserva" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" "No tienes tokens"
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
  if [ "$(sql "select position('legendaria' in pg_get_functiondef('hipodromo_vender_carta(uuid)'::regprocedure)) > 0")" != "t" ]; then
    L=$(dar $U3 legendaria-1)
    R=$(como $U3 "select hipodromo_vender_carta('$L');")
    if printf '%s' "$R" | grep -q '"ok": true'; then nota "El Hipódromo compra legendarias (800 tokens) y las vende desde la reserva (2000): una legendaria puede cambiar de manos por tokens, sin pasar por las reglas del mercader (que las excluye)."; fi
  fi
fi

echo "== Hipódromo, opción B: legendarias y limitadas fuera, solo cartas en circulación (llamadas directas al servidor)"
if [ "$(sql "select position('legendaria' in pg_get_functiondef('hipodromo_vender_carta(uuid)'::regprocedure)) > 0")" = "t" ]; then
  limpiar
  sql "delete from hipodromo_movimientos; delete from hipodromo_billeteras; update cartas_catalogo set en_circulacion = true where id <> 'bufon'" >/dev/null
  PRECIOS_ANTES=$(sql "select string_agg(rareza||':'||compra||'/'||venta, ',' order by rareza) from hipodromo_precios_cartas")
  # una legendaria en la reserva y tokens de sobra
  LEG=$(dar $U4 legendaria-1); sql "select cartas_i_retirar('$LEG', 'reserva', 'prueba');" >/dev/null
  dar_monedas $U1 5000
  R=$(como $U1 "select hipodromo_comprar_carta('legendaria-1');")
  contiene "comprar una legendaria llamando a la función: rechazado" "$R" "legendarias y limitadas no se venden"
  comprobar "...no se cobra nada" "5000" "$(monedas $U1)"
  comprobar "...y la legendaria sigue en la reserva" "en_reserva" "$(sql "select estado from cartas_ejemplares where id='$LEG'")"
  # aunque alguien vuelva a ponerle precio a la limitada, la función sigue rechazándola
  sql "insert into hipodromo_precios_cartas values ('limitada', 5, 5) on conflict (rareza) do update set compra = 5, venta = 5" >/dev/null
  sql "update cartas_catalogo set en_circulacion = true where id = 'bufon'" >/dev/null
  BUF=$(dar $U1 bufon)
  contiene "vender una limitada llamando a la función: rechazado (aunque tenga precio)" "$(como $U1 "select hipodromo_vender_carta('$BUF');")" "legendarias y limitadas no se compran"
  comprobar "...la carta sigue siendo del jugador" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$BUF'")"
  BUF2=$(dar $U4 bufon); sql "select cartas_i_retirar('$BUF2', 'reserva', 'prueba');" >/dev/null
  contiene "comprar una limitada de la reserva: rechazado (aunque tenga precio)" "$(como $U1 "select hipodromo_comprar_carta('bufon');")" "legendarias y limitadas no se venden"
  sql "delete from hipodromo_precios_cartas where rareza = 'limitada'" >/dev/null
  LEG2=$(dar $U1 legendaria-1)
  contiene "vender una legendaria que se tiene: rechazado" "$(como $U1 "select hipodromo_vender_carta('$LEG2');")" "legendarias y limitadas no se compran"
  comprobar "...y sigue siendo suya" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$LEG2'")"
  comprobar "ningún token se movió en todo esto" "5000" "$(monedas $U1)"
  # la lista de la reserva
  COM=$(dar $U4 comun-1); sql "select cartas_i_retirar('$COM', 'reserva', 'prueba');" >/dev/null
  COM2=$(dar $U4 comun-2); sql "select cartas_i_retirar('$COM2', 'reserva', 'prueba'); update cartas_catalogo set en_circulacion = false where id = 'comun-2';" >/dev/null
  LISTA=$(como $U1 "select hipodromo_cartas_reserva();")
  contiene "la lista enseña una carta común en circulación" "$LISTA" '"carta": "comun-1"'
  nocontiene "...no enseña la legendaria de la reserva" "$LISTA" 'legendaria-1'
  nocontiene "...no enseña la limitada de la reserva" "$LISTA" '"bufon"'
  nocontiene "...no enseña una carta que no está en circulación" "$LISTA" 'comun-2'
  contiene "comprar una carta fuera de circulación llamando a la función: rechazado" "$(como $U1 "select hipodromo_comprar_carta('comun-2');")" "todavía no está en circulación"
  comprobar "...sin cobrar" "5000" "$(monedas $U1)"
  nocontiene "una carta común en circulación sigue pudiéndose comprar" "$(como $U1 "select hipodromo_comprar_carta('comun-1');")" "ERROR"
  comprobar "...por su precio de siempre (50)" "4950" "$(monedas $U1)"
  C3=$(dar $U1 comun-3)
  nocontiene "y vender una común sigue siendo posible" "$(como $U1 "select hipodromo_vender_carta('$C3');")" "ERROR"
  comprobar "...por su precio de siempre (20)" "4970" "$(monedas $U1)"
  comprobar "los precios no se tocaron" "$PRECIOS_ANTES" "$(sql "select string_agg(rareza||':'||compra||'/'||venta, ',' order by rareza) from hipodromo_precios_cartas")"
  comprobar "la auditoría está limpia" "0" "$(auditar)"
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

echo "== La Fractura: su recompensa ya no puede escribir en la colección a mano"
if [ "$(sql "select pg_get_functiondef('fractura_recompensa(uuid)'::regprocedure) ~* 'insert into cartas_coleccion'")" = "t" ]; then
  nota "fractura_recompensa (la versión de producción) escribe DIRECTAMENTE en cartas_coleccion: crea copias fantasma. La corrige economia-12 (probada en t_fractura.sh)."
else
  comprobar "la función ya no escribe en cartas_coleccion" "f" "$(sql "select pg_get_functiondef('fractura_recompensa(uuid)'::regprocedure) ~* 'insert into cartas_coleccion'")"
fi

echo "== Volver a correr docs/hipodromo-2_cartas.sql no quita las reglas de cartas (opción B)"
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$(dirname "$0")/../hipodromo-2_cartas.sql" >/dev/null 2>&1
comprobar "las legendarias y las limitadas siguen sin precio (no se compran ni se venden)" "0" "$(sql "select count(*) from hipodromo_precios_cartas where rareza in ('legendaria', 'limitada')")"
comprobar "la reserva solo enseña cartas en circulación" "t" "$(sql "select position('c.en_circulacion' in pg_get_functiondef('hipodromo_cartas_reserva()'::regprocedure)) > 0")"
comprobar "comprar una carta que no está en circulación se rechaza antes de cobrar" "t" "$(sql "select position('en_circulacion' in pg_get_functiondef('hipodromo_comprar_carta(text)'::regprocedure)) > 0")"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
