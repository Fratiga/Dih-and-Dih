#!/bin/sh
# Las criaturas únicas no se crían (docs/economia-21_corral_unicas.sql): con límite global 1 no hay pareja posible aunque el admin haya dado dos copias.
# Uso: sh docs/pruebas/t_crianza_unicas.sh   (después de cargar_local.sh todo, que ya aplica economia-21)
. "$(dirname "$0")/lib.sh"
FALLOS=0
iniciar() { como $1 "select cartas_corral_iniciar('$2', '$3', '$4');" 2>&1; }
limpiar
trap "sql \"set session_replication_role = replica; update cartas_catalogo set limite = 20 where id in ('comun-1', 'comun-3');\" >/dev/null" EXIT
sql "delete from cartas_crias; update cartas_catalogo set en_circulacion = true where id <> 'bufon';" >/dev/null 2>&1
como $ADMIN "select cartas_admin_guardar_cria('comun-1', '{\"habitat\": \"aviario\", \"horas\": [1, 1, 1], \"descanso_horas\": 1}'::jsonb);" >/dev/null 2>&1
como $ADMIN "select cartas_admin_guardar_cria('comun-3', '{\"habitat\": \"bosque\", \"horas\": [1, 1, 1], \"descanso_horas\": 1}'::jsonb);" >/dev/null 2>&1

echo "== Límite global 1: no hay pareja posible"
# Ni el catálogo ni la emisión dejan que haya más copias que el límite, así que el caso se fuerza como lo haría un dato mal corregido a mano:
# se dan las copias con el límite alto y después se baja el límite saltándose los disparadores (solo en esta prueba)
bajar() { sql "set session_replication_role = replica; update cartas_catalogo set limite = $2 where id = '$1';" >/dev/null; }
A=$(dar $U1 comun-1); B=$(dar $U1 comun-1); C=$(dar $U1 comun-1)
bajar comun-1 1
comprobar "un jugador tiene tres copias aunque el límite global es 1" "3" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-1' and propietario='$U1'")"
contiene "con límite 1 no se puede empezar la cría" "$(iniciar $U1 comun-1 $A $B)" "criatura única"
comprobar "no se bloqueó nada" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"
comprobar "no se creó ninguna cría" "0" "$(sql "select count(*) from cartas_crias")"

echo "== Más copias que el límite: el mundo está por encima de lo permitido"
bajar comun-1 2
contiene "tres copias con límite 2 no pueden criar" "$(iniciar $U1 comun-1 $A $B)" "más copias de esta criatura que su límite"
sql "update cartas_ejemplares set estado='destruida', propietario=null where id = '$C'" >/dev/null
contiene "con dos copias y límite 2 no hay hueco para la cría (sobrepoblación de siempre)" "$(iniciar $U1 comun-1 $A $B)" "Sobrepoblación"

echo "== Una criatura normal sigue criándose"
sql "update cartas_catalogo set limite = 20 where id = 'comun-3'" >/dev/null
X=$(dar $U2 comun-3); Y=$(dar $U2 comun-3)
nocontiene "una criatura con límite amplio sí empieza" "$(iniciar $U2 comun-3 $X $Y)" "ERROR"
comprobar "la pareja queda bloqueada en el corral" "2" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"

[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
