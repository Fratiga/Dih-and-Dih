#!/bin/sh
# El Buhonero del Hipódromo (docs/economia-26_buhonero_precios_y_deseos.sql): precio por escasez, cartas únicas fuera, tope diario de ventas y «lo que buscas».
# Uso: sh docs/pruebas/t_buhonero.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
limpiar
saldo() { sql "select coalesce((select saldo from hipodromo_billeteras where usuario='$1'), 0)"; }
dar_tokens() { sql "insert into hipodromo_billeteras (usuario, saldo) values ('$1', $2) on conflict (usuario) do update set saldo = $2" >/dev/null; }
precio() { sql "select coalesce(hipodromo_i_precio('$1', '$2')::text, 'no')"; }
ajuste() { sql "insert into cartas_economia_ajustes (clave, valor) values ('$1', '$2') on conflict (clave) do update set valor = excluded.valor" >/dev/null; }
sql "update cartas_catalogo set en_circulacion = true where id <> 'bufon'" >/dev/null
sql "delete from hipodromo_movimientos; delete from hipodromo_deseos" >/dev/null 2>&1
ajuste hipodromo_escasez 1; ajuste hipodromo_ventas_dia 10; ajuste limite_global_defecto 20

echo "== El precio depende de la escasez (límite global: 20 = el de siempre)"
comprobar "comun-3 (20 copias) paga 20 y cobra 50" "20/50" "$(precio comun-3 venta)/$(precio comun-3 compra)"
comprobar "poco-1 (12 copias): 60 × raíz(20/12) = 77 y 150 × 1,29 = 194" "77/194" "$(precio poco-1 venta)/$(precio poco-1 compra)"
comprobar "rara-1 (5 copias): el doble, 400 y 1000" "400/1000" "$(precio rara-1 venta)/$(precio rara-1 compra)"
sql "update cartas_catalogo set limite = 80 where id = 'comun-1'" >/dev/null
comprobar "una carta con muchísimas copias (80) paga la mitad como mucho: 10 y 25" "10/25" "$(precio comun-1 venta)/$(precio comun-1 compra)"
sql "update cartas_catalogo set limite = null where id = 'comun-2'" >/dev/null
comprobar "sin límite global, el precio de siempre" "20/50" "$(precio comun-2 venta)/$(precio comun-2 compra)"
comprobar "la compra siempre cuesta más que la venta (en todas)" "0" "$(sql "select count(*) from cartas_catalogo c where hipodromo_i_precio(c.id, 'compra') is not null and hipodromo_i_precio(c.id, 'compra') <= hipodromo_i_precio(c.id, 'venta')")"
ajuste hipodromo_escasez 0
comprobar "con la escasez apagada vuelven los precios fijos (rara = 200)" "200/500" "$(precio rara-1 venta)/$(precio rara-1 compra)"
ajuste hipodromo_escasez 1

echo "== Únicas, legendarias y limitadas no se compran ni se venden"
sql "update cartas_catalogo set limite = 1, limite_jugador = 1 where id = 'comun-5'" >/dev/null
comprobar "una carta única no tiene precio" "no" "$(precio comun-5 venta)"
comprobar "una legendaria tampoco" "no" "$(precio legendaria-1 venta)"
comprobar "ni la limitada" "no" "$(precio bufon venta)"
U=$(dar $U1 comun-5)
contiene "vender una única llamando a la función" "$(como $U1 "select hipodromo_vender_carta('$U');" 2>&1)" "no compra esa carta"
comprobar "...y sigue siendo suya" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$U'")"
sql "select cartas_i_retirar('$U', 'reserva', 'prueba');" >/dev/null
dar_tokens $U2 5000
contiene "comprar una única que esté en la reserva" "$(como $U2 "select hipodromo_comprar_carta('comun-5');" 2>&1)" "no vende esa carta"
comprobar "...sin cobrar" "5000" "$(saldo $U2)"
comprobar "y la reserva ni la enseña" "0" "$(como $U2 "select count(*) from jsonb_array_elements(hipodromo_cartas_reserva()) x where x->>'carta' = 'comun-5';" | tail -1)"

echo "== Vender: se paga el precio por escasez"
E=$(dar $U1 poco-1)
contiene "se vende y cobra 77" "$(como $U1 "select hipodromo_vender_carta('$E');")" '"precio": 77'
comprobar "el saldo sube 77" "77" "$(saldo $U1)"
comprobar "el libro de tokens lo anota" "1" "$(sql "select count(*) from hipodromo_movimientos where usuario='$U1' and monto=77")"

echo "== Tope diario de ventas"
ajuste hipodromo_ventas_dia 3
sql "delete from hipodromo_movimientos where usuario='$U1'" >/dev/null; dar_tokens $U1 0
for i in 1 2 3; do E=$(dar $U1 comun-3); como $U1 "select hipodromo_vender_carta('$E');" >/dev/null 2>&1; done
E=$(dar $U1 comun-3)
contiene "a la cuarta venta del día, no" "$(como $U1 "select hipodromo_vender_carta('$E');" 2>&1)" "Hoy ya le vendiste 3 cartas"
comprobar "...y no cobra" "60" "$(saldo $U1)"
comprobar "las que ya vendió siguen vendidas y la cuarta sigue siendo suya" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$E'")"
comprobar "otro jugador no tiene el tope del primero" "ok" "$(F=$(dar $U3 comun-3); como $U3 "select hipodromo_vender_carta('$F');" 2>&1 | grep -q '"ok": true' && echo ok || echo no)"
comprobar "el panel del jugador cuenta lo vendido hoy" "3/3" "$(como $U1 "select (hipodromo_precios_mis_cartas() ->> 'hoy') || '/' || (hipodromo_precios_mis_cartas() ->> 'tope');" | tail -1)"
ajuste hipodromo_ventas_dia 0
comprobar "con el tope en 0 se puede seguir vendiendo" "ok" "$(como $U1 "select hipodromo_vender_carta('$E');" 2>&1 | grep -q '"ok": true' && echo ok || echo no)"
ajuste hipodromo_ventas_dia 10

echo "== La reserva: solo cartas en circulación, con su precio y marcando lo que buscas"
dar_tokens $U2 5000
C=$(dar $U1 comun-3); sql "select cartas_i_retirar('$C', 'reserva', 'prueba');" >/dev/null
comprobar "la reserva enseña comun-3 a 50" "50" "$(como $U2 "select x->>'precio' from jsonb_array_elements(hipodromo_cartas_reserva()) x where x->>'carta' = 'comun-3';" | tail -1)"
sql "update cartas_catalogo set en_circulacion = false where id = 'comun-3'" >/dev/null
comprobar "fuera de circulación ya no sale" "0" "$(como $U2 "select count(*) from jsonb_array_elements(hipodromo_cartas_reserva()) x where x->>'carta' = 'comun-3';" | tail -1)"
sql "update cartas_catalogo set en_circulacion = true where id = 'comun-3'" >/dev/null

echo "== Lo que buscas"
contiene "sin sesión no se puede" "$(anonimo "select hipodromo_deseos_ver();")" "permission denied"
como $U2 "select hipodromo_deseo_poner('comun-3');" >/dev/null 2>&1
comprobar "se apunta una carta" "1" "$(como $U2 "select jsonb_array_length(hipodromo_deseos_ver());" | tail -1)"
comprobar "en la lista dice cuántas copias hay en la reserva" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-3' and estado='en_reserva'")" "$(como $U2 "select (hipodromo_deseos_ver() -> 0 ->> 'copias');" | tail -1)"
comprobar "y en la reserva sale marcada como buscada, la primera" "true" "$(como $U2 "select x->>'buscada' from jsonb_array_elements(hipodromo_cartas_reserva()) x limit 1;" | tail -1)"
comprobar "apuntar dos veces la misma no la duplica" "1" "$(como $U2 "select hipodromo_deseo_poner('comun-3'); select jsonb_array_length(hipodromo_deseos_ver());" 2>&1 | tail -1)"
contiene "no se puede apuntar una única" "$(como $U2 "select hipodromo_deseo_poner('comun-5');" 2>&1)" "no vende esa carta"
contiene "ni una legendaria" "$(como $U2 "select hipodromo_deseo_poner('legendaria-1');" 2>&1)" "no vende esa carta"
contiene "ni una carta que no existe" "$(como $U2 "select hipodromo_deseo_poner('no-existe');" 2>&1)" "no existe"
comprobar "al comprarla se borra de lo que buscas" "0" "$(como $U2 "select hipodromo_comprar_carta('comun-3'); select jsonb_array_length(hipodromo_deseos_ver());" 2>&1 | tail -1)"
for n in 1 2 3 4 6 7 8 9 10 11 12; do como $U2 "select hipodromo_deseo_poner('comun-$n');" >/dev/null 2>&1; done
como $U2 "select hipodromo_deseo_poner('poco-1');" >/dev/null 2>&1
comprobar "con 12 apuntadas, la 13.ª no entra" "12" "$(como $U2 "select jsonb_array_length(hipodromo_deseos_ver());" | tail -1)"
contiene "...y lo dice" "$(como $U2 "select hipodromo_deseo_poner('poco-2');" 2>&1)" "Solo puedes apuntar 12"
como $U2 "select hipodromo_deseo_quitar('comun-1');" >/dev/null 2>&1
comprobar "se quita una" "11" "$(como $U2 "select jsonb_array_length(hipodromo_deseos_ver());" | tail -1)"
comprobar "cada jugador ve solo lo suyo" "0" "$(como $U3 "select jsonb_array_length(hipodromo_deseos_ver());" | tail -1)"

echo "== Y todo sigue cuadrando"
comprobar "la auditoría está limpia" "0" "$(auditar)"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
