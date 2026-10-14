#!/bin/sh
# La Fractura conectada al sistema oficial de recompensas (economia-12). Uso: sh docs/pruebas/t_fractura.sh
# Comprueba que la recompensa sale por ejemplares y movimientos (nunca escribe en la colección), respeta límites globales y personales,
# disponibilidad, la etiqueta «En circulación» y los topes, y cae a un sello (nunca a una copia fantasma) cuando no hay carta elegible.
. "$(dirname "$0")/lib.sh"
FALLOS=0
guerra() { # <usuario> <logros json> [resultado] [pvp]
  sql "insert into fractura_guerras (user_id, titulo, resultado, pvp, logros) values ('$1', 'Guerra de prueba', '${3:-victoria}', ${4:-false}, '$2') returning id"
}
reclamar() { como "$1" "select fractura_recompensa('$2');" | tr -d '\n'; }
ejemplares_de() { sql "select count(*) from cartas_ejemplares where propietario='$1'"; }
reset() { limpiar; sql "delete from fractura_guerras" >/dev/null; sql "update cartas_catalogo set en_circulacion = true where id <> 'bufon'; update cartas_catalogo set limite_jugador = null" >/dev/null; }

reset
echo "== Apagado: no da nada y la guerra no se gasta"
G=$(guerra $U1 '[]')
R=$(reclamar $U1 $G)
contiene "con el juego apagado no se da carta" "$R" 'juego-inactivo'
comprobar "la guerra sigue sin gastar (se podrá reclamar al encender)" "f" "$(sql "select recompensada from fractura_guerras where id='$G'")"
comprobar "no se creó ningún ejemplar" "0" "$(ejemplares_de $U1)"
sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null

echo "== Una victoria normal da una carta por el sistema oficial"
R=$(reclamar $U1 $G)
contiene "da una carta" "$R" '"resultado": "carta"'
CARTA=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "hay un ejemplar real de esa carta, del jugador" "1" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id='$CARTA' and estado='poseida'")"
comprobar "con su movimiento de emisión (motivo: minijuego La Fractura)" "1" "$(sql "select count(*) from cartas_movimientos where tipo='emision' and a='$U1' and motivo = 'minijuego: fractura'")"
comprobar "queda en el registro de recompensas" "1" "$(sql "select count(*) from cartas_recompensas_registro where user_id='$U1' and juego='fractura' and resultado='carta'")"
comprobar "la colección coincide con los ejemplares (nada fantasma)" "1" "$(sql "select cantidad from cartas_coleccion where user_id='$U1' and carta_id='$CARTA'")"
comprobar "la rareza es común o poco común (tramo bueno)" "t" "$(sql "select rareza in ('comun', 'infrecuente') from cartas_catalogo where id='$CARTA'")"
comprobar "la guerra queda reclamada" "t" "$(sql "select recompensada from fractura_guerras where id='$G'")"
contiene "no se puede reclamar dos veces" "$(reclamar $U1 $G)" "ya dio su premio"
comprobar "sigue habiendo un solo ejemplar" "1" "$(ejemplares_de $U1)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Quién puede reclamar y por qué guerras"
contiene "la guerra de otro jugador, no" "$(reclamar $U2 $G)" "no es tuya"
GD=$(guerra $U2 '[]' derrota)
contiene "una derrota no da nada" "$(reclamar $U2 $GD)" "Solo se premia ganar"
GP=$(guerra $U2 '[]' victoria true)
contiene "una guerra entre jugadores tampoco" "$(reclamar $U2 $GP)" "no dan cartas"
contiene "sin sesión, no" "$(anonimo "select fractura_recompensa('$G');")" "permission denied"
contiene "una guerra inexistente da error claro" "$(reclamar $U2 00000000-0000-0000-0000-00000000dead)" "no es tuya"

echo "== Los logros suben el tramo (misma escala que los demás juegos)"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
GN=$(guerra $U2 '["nucleo"]')
R=$(reclamar $U2 $GN); CN=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "un núcleo tomado (valor 3, excelente) da poco común o rara" "t" "$(sql "select rareza in ('infrecuente', 'rara') from cartas_catalogo where id='$CN'")"
GL=$(guerra $U3 '["leyenda"]')
R=$(reclamar $U3 $GL); CL=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "una leyenda (valor 4, extraordinario) da una rara" "rara" "$(sql "select rareza from cartas_catalogo where id='$CL'")"
GPV=$(guerra $U4 '["primera_victoria:ocevat"]')
R=$(reclamar $U4 $GPV); CP=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "una primera victoria (valor 4) también una rara" "rara" "$(sql "select rareza from cartas_catalogo where id='$CP'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== La etiqueta «En circulación» y la disponibilidad"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
sql "update cartas_catalogo set en_circulacion = false" >/dev/null
G1=$(guerra $U1 '["leyenda"]')
R=$(reclamar $U1 $G1)
contiene "con ninguna carta en circulación, sale un sello" "$R" '"resultado": "sello"'
comprobar "...y no se creó ninguna copia (ni fantasma)" "0|0" "$(ejemplares_de $U1)|$(sql "select count(*) from cartas_coleccion where user_id='$U1'")"
comprobar "...y la guerra queda gastada (el sello ya es su premio)" "t" "$(sql "select recompensada from fractura_guerras where id='$G1'")"
comprobar "...con un sello anotado" "1" "$(sql "select sellos from cartas_progreso where user_id='$U1' and juego='fractura'")"
sql "update cartas_catalogo set en_circulacion = true where id = 'rara-2'" >/dev/null
G2=$(guerra $U2 '["leyenda"]')
R=$(reclamar $U2 $G2)
contiene "con solo Rara 2 en circulación, sale esa" "$R" '"carta": "rara-2"'
sql "update cartas_catalogo set obtenible = false where id = 'rara-2'" >/dev/null
G3=$(guerra $U3 '["leyenda"]')
contiene "...y si deja de ser ganable, sale un sello" "$(reclamar $U3 $G3)" '"resultado": "sello"'
sql "update cartas_catalogo set obtenible = true where id = 'rara-2'" >/dev/null

echo "== Límite por jugador: si ya tiene todas las que podría recibir, sale un sello y nadie pasa su límite"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
sql "update cartas_catalogo set limite_jugador = 1" >/dev/null
for c in $(sql "select id from cartas_catalogo where en_circulacion and obtenible and publicada"); do dar $U1 "$c" >/dev/null; done
ANTES=$(ejemplares_de $U1)
GL1=$(guerra $U1 '["leyenda"]')
contiene "no hay carta que pueda recibir: sello" "$(reclamar $U1 $GL1)" '"resultado": "sello"'
comprobar "no se creó ningún ejemplar más" "$ANTES" "$(ejemplares_de $U1)"
comprobar "nadie pasa su límite (auditoría limpia)" "0" "$(auditar)"

echo "== Límite global: con todas las copias emitidas, sale un sello y no se emite ninguna"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
for c in $(sql "select id from cartas_catalogo where en_circulacion and obtenible and publicada"); do dar $U3 "$c" >/dev/null; done
sql "update cartas_catalogo set limite = (select max(numero) from cartas_ejemplares e where e.carta_id = cartas_catalogo.id) where en_circulacion" >/dev/null
EMIT=$(sql "select count(*) from cartas_ejemplares")
GG=$(guerra $U2 '["leyenda"]')
contiene "todo agotado: sello" "$(reclamar $U2 $GG)" '"resultado": "sello"'
comprobar "no se emitió ninguna copia nueva" "$EMIT" "$(sql "select count(*) from cartas_ejemplares")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Topes diarios (3 cartas por juego y día)"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
sql "insert into cartas_recompensas_registro (user_id, juego, tramo, valor, resultado, carta_id) select '$U1', 'fractura', 'bueno', 1, 'carta', 'comun-1' from generate_series(1, 3)" >/dev/null
GT=$(guerra $U1 '["leyenda"]')
R=$(reclamar $U1 $GT)
contiene "con 3 cartas ya ganadas hoy: sello por tope diario" "$R" 'tope-diario'
comprobar "no sale carta" "0" "$(ejemplares_de $U1)"

echo "== Dos reclamaciones de la misma guerra a la vez"
reset; sql "update cartas_juegos set activo = true where juego = 'fractura'" >/dev/null
GC=$(guerra $U1 '["leyenda"]')
TMP=$(mktemp -d)
como $U1 "select fractura_recompensa('$GC');" 2 > "$TMP/a" &
sleep 0.6
como $U1 "select fractura_recompensa('$GC');" 0 > "$TMP/b" &
wait
comprobar "solo una se lleva el premio" "1" "$(cat "$TMP/a" "$TMP/b" | grep -c '"resultado": "carta"')"
contiene "la otra se entera de que ya se dio" "$(cat "$TMP/a" "$TMP/b")" "ya dio su premio"
comprobar "un solo ejemplar" "1" "$(ejemplares_de $U1)"
comprobar "la auditoría está limpia" "0" "$(auditar)"
rm -rf "$TMP"

echo "== Nunca escribe directamente en la colección"
comprobar "toda copia de la colección tiene su ejemplar (misma cuenta)" "0" "$(sql "select count(*) from cartas_coleccion c where c.cantidad <> (select count(*) from cartas_ejemplares e where e.propietario = c.user_id and e.carta_id = c.carta_id and e.estado in ('poseida','bloqueada'))")"
comprobar "y la función no contiene ninguna escritura en cartas_coleccion" "f" "$(sql "select pg_get_functiondef('fractura_recompensa(uuid)'::regprocedure) ~* 'insert into cartas_coleccion|update cartas_coleccion'")"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
