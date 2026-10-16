#!/bin/sh
# Economía parte 20: el Buhonero y el Hipódromo reparten del mismo montón (la reserva común).
# Uso: (cargar_local.sh todo ya aplica economia-20) sh docs/pruebas/t_reserva_compartida.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
limpiar
sql "delete from hipodromo_movimientos; delete from hipodromo_billeteras; update cartas_catalogo set en_circulacion = true where id <> 'bufon'" >/dev/null
monedas() { sql "select coalesce((select saldo from hipodromo_billeteras where usuario='$1'), 0)::int"; }
dar_monedas() { sql "insert into hipodromo_billeteras (usuario, saldo) values ('$1', $2) on conflict (usuario) do update set saldo = $2" >/dev/null; }

echo "== Lo que se le da al Buhonero llega a la reserva común"
C=$(dar $U1 comun-3)
sql "select cartas_i_retirar('$C', 'mercader', 'cambio con el mercader', 'mercader:prueba');" >/dev/null
comprobar "la copia queda en la reserva común" "en_reserva" "$(sql "select estado from cartas_ejemplares where id='$C'")"
comprobar "el movimiento sigue siendo de mercader (para la regla de las 24 horas)" "1" "$(sql "select count(*) from cartas_movimientos where ejemplar='$C' and tipo='retirada_mercader'")"

echo "== El Hipódromo puede vender lo que dio el Buhonero"
dar_monedas $U2 50
contiene "se compra en el Hipódromo" "$(como $U2 "select hipodromo_comprar_carta('comun-3');")" '"ok": true'
comprobar "la copia que le dieron al Buhonero pasó al comprador" "$U2/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$C'")"
comprobar "no se emitió ninguna copia nueva" "1" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-3'")"

echo "== Al repartir se prefiere la copia que el Buhonero no tiene en oferta"
limpiar
A=$(dar $U1 comun-4); B=$(dar $U1 comun-4)
sql "select cartas_i_retirar('$A', 'reserva', 'prueba'); select cartas_i_retirar('$B', 'reserva', 'prueba');" >/dev/null
sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) values ('$A', 2)" >/dev/null
dar_monedas $U2 100
como $U2 "select hipodromo_comprar_carta('comun-4');" >/dev/null
comprobar "se llevó la copia que no estaba en oferta" "$U2/poseida|en_reserva" "$(sql "select (select propietario::text||'/'||estado from cartas_ejemplares where id='$B')||'|'||(select estado from cartas_ejemplares where id='$A')")"
comprobar "la oferta del Buhonero sigue en pie" "activa" "$(sql "select estado from cartas_mercader_ofertas where ejemplar='$A'")"
como $U3 "select hipodromo_comprar_carta('comun-4');" >/dev/null
dar_monedas $U3 100
como $U3 "select hipodromo_comprar_carta('comun-4');" >/dev/null
comprobar "si ya no queda otra, se reparte la que estaba en oferta" "$U3/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$A'")"
como $U1 "select cartas_mercader_ver();" >/dev/null
comprobar "y la oferta se retira sola al mirar al Buhonero" "retirada" "$(sql "select estado from cartas_mercader_ofertas where ejemplar='$A'")"

echo "== La reserva que ve el Hipódromo incluye lo del Buhonero"
limpiar
D=$(dar $U1 comun-5)
sql "select cartas_i_retirar('$D', 'mercader', 'cambio con el mercader', 'mercader:prueba2');" >/dev/null
contiene "aparece en la lista del Hipódromo" "$(como $U2 "select hipodromo_cartas_reserva();")" '"carta": "comun-5"'

[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
