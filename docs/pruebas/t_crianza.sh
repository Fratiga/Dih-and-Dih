#!/bin/sh
# La crianza (docs/economia-18_crianza.sql): corrales por medio, parejas de la misma criatura, fases, nacimiento, límites y sobrepoblación.
# Uso: sh docs/pruebas/t_crianza.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
TMP=$(mktemp -d)
adm() { como $ADMIN "select cartas_admin_guardar_cria('$1', '$2'::jsonb);" 2>&1; }
iniciar() { como $1 "select cartas_corral_iniciar('$2', '$3', '$4');" 2>&1; }
recoger() { como $1 "select cartas_corral_recoger('$2');" 2>&1; }
cria_de() { sql "select id from cartas_crias where user_id='$1' and estado='en_curso' order by inicio desc limit 1"; }
terminar_ya() { sql "update cartas_crias set fin = now() - interval '1 minute' where id='$1'" >/dev/null; }
reiniciar() {
  limpiar
  sql "delete from cartas_crias; update cartas_catalogo set en_circulacion = true where id <> 'bufon';" >/dev/null 2>&1
}
reiniciar
adm comun-1 '{"habitat": "bosque", "horas": [1, 2, 1], "descanso_horas": 3}' >/dev/null
adm comun-2 '{"habitat": "aviario", "horas": [0.5, 0.5, 0.5], "descanso_horas": 1}' >/dev/null
adm comun-3 '{"habitat": "bosque", "horas": [1, 1, 1], "descanso_horas": 1}' >/dev/null
adm poco-1 '{"habitat": "cubil", "horas": [2, 4, 2], "descanso_horas": 4}' >/dev/null
adm rara-1 '{"habitat": "glaciar", "horas": [3, 6, 3], "descanso_horas": 6}' >/dev/null

echo "== Configuración de las especies (solo el admin)"
contiene "solo se crían criaturas (un objeto no)" "$(adm comun-4 '{"habitat": "bosque"}')" "Solo se crían cartas de tipo Criatura"
contiene "el corral tiene que existir" "$(adm comun-1 '{"habitat": "castillo"}')" "no existe"
contiene "tres fases" "$(adm comun-1 '{"horas": [1, 2]}')" "tres"
contiene "duración fuera de rango" "$(adm comun-1 '{"horas": [1, 2, 9999]}')" "entre 0,01 y 720"
contiene "un jugador no puede configurar" "$(como $U1 "select cartas_admin_guardar_cria('comun-1', '{\"habitat\": \"bosque\"}'::jsonb);" 2>&1)" "No autorizado"
contiene "sin sesión no se puede ni ver" "$(anonimo "select cartas_corral_ver();")" "permission denied"
comprobar "seis corrales" "6" "$(como $U1 "select jsonb_array_length(cartas_corral_ver() -> 'corrales');" | tail -1)"

echo "== Hacen falta dos copias tuyas de la misma criatura"
A=$(dar $U1 comun-1)
contiene "con una sola copia no hay corral (la misma copia dos veces)" "$(iniciar $U1 comun-1 $A $A)" "dos copias distintas"
B2=$(dar $U1 comun-2)
contiene "dos copias de criaturas distintas" "$(iniciar $U1 comun-1 $A $B2)" "misma criatura"
OTRA=$(dar $U2 comun-1)
contiene "una copia que es de otro jugador" "$(iniciar $U1 comun-1 $A $OTRA)" "ya no está disponible"
S1=$(dar $U1 comun-7); S2=$(dar $U1 comun-7)
contiene "una criatura sin corral configurado" "$(iniciar $U1 comun-7 $S1 $S2)" "no se puede criar"
OBJ1=$(dar $U1 comun-4); OBJ2=$(dar $U1 comun-4)
contiene "un objeto no se cría" "$(iniciar $U1 comun-4 $OBJ1 $OBJ2)" "no se puede criar"
comprobar "nada quedó bloqueado por los intentos fallidos" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"
sql "update cartas_catalogo set en_circulacion = false where id = 'comun-1'" >/dev/null
A2=$(dar $U1 comun-1)
contiene "una especie fuera de circulación no se cría" "$(iniciar $U1 comun-1 $A $A2)" "no está en circulación"
sql "update cartas_catalogo set en_circulacion = true where id = 'comun-1'" >/dev/null

echo "== Empezar una cría: las dos copias se bloquean, el corral admite una pareja"
R=$(iniciar $U1 comun-1 $A $A2)
contiene "empieza" "$R" '"id"'
comprobar "las dos copias quedan bloqueadas" "2" "$(sql "select count(*) from cartas_ejemplares where id in ('$A','$A2') and estado='bloqueada'")"
CRIA=$(cria_de $U1)
comprobar "la cría dura la suma de las tres fases (4 horas)" "4" "$(sql "select round(extract(epoch from (fin - inicio)) / 3600) from cartas_crias where id='$CRIA'")"
B3=$(dar $U1 comun-3); B4=$(dar $U1 comun-3)
contiene "el mismo corral no admite otra pareja (comun-3 también es del bosque)" "$(iniciar $U1 comun-3 $B3 $B4)" "ya tiene una pareja"
contiene "las copias bloqueadas no se pueden criar otra vez" "$(iniciar $U1 comun-1 $A $A2)" "ya no está disponible"
contiene "no se pueden apostar ni cambiar mientras crían" "$(como $U1 "select cartas_ofrecer('$U2', array['$A']::uuid[], '[{\"carta\":\"comun-4\",\"n\":1}]'::jsonb, '');" 2>&1)" "ya no está disponible"
contiene "recoger antes de tiempo" "$(recoger $U1 $CRIA)" "Todavía no ha terminado"
contiene "otro jugador no puede recoger mi cría" "$(recoger $U2 $CRIA)" "ya no está en el corral"
contiene "otro corral sí admite otra pareja a la vez (aviario)" "$(iniciar $U1 comun-2 $B2 $(dar $U1 comun-2))" '"id"'

echo "== Sacar a la pareja antes de tiempo: no nace nada"
AVIARIO=$(sql "select id from cartas_crias where user_id='$U1' and habitat='aviario' and estado='en_curso'")
como $U1 "select cartas_corral_sacar('$AVIARIO');" >/dev/null 2>&1
comprobar "la cría queda cancelada" "cancelada" "$(sql "select estado from cartas_crias where id='$AVIARIO'")"
comprobar "las dos copias vuelven a estar libres" "0" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-2' and estado='bloqueada'")"
comprobar "y no nació ninguna copia nueva" "2" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-2'")"

echo "== Nacimiento"
terminar_ya "$CRIA"
RN=$(recoger $U1 $CRIA)
contiene "nace una cría" "$RN" '"resultado": "cria"'
comprobar "tienes 3 copias (las dos de antes más la cría) y ninguna sigue bloqueada" "3/0" "$(sql "select count(*) filter (where propietario='$U1' and carta_id='comun-1')||'/'||count(*) filter (where carta_id='comun-1' and estado='bloqueada') from cartas_ejemplares")"
comprobar "la cría sale en el registro como nacida, con descanso" "nacida/true" "$(sql "select estado||'/'||(descanso_hasta > now()) from cartas_crias where id='$CRIA'")"
comprobar "y la copia nueva se emitió con el número siguiente (había 3 emitidas: dos mías y una de otro jugador)" "4" "$(sql "select numero from cartas_ejemplares where id = (select cria_ejemplar from cartas_crias where id='$CRIA')")"
contiene "recoger dos veces no da dos crías" "$(recoger $U1 $CRIA)" "ya no está en el corral"
comprobar "el movimiento queda registrado" "1" "$(sql "select count(*) from cartas_movimientos where referencia='cria:$CRIA' and tipo='emision'")"
C2=$(dar $U1 comun-3)
contiene "el corral descansa tras el nacimiento" "$(iniciar $U1 comun-1 $A $A2)" "descansando"
sql "update cartas_crias set descanso_hasta = now() - interval '1 minute' where id='$CRIA'" >/dev/null
contiene "pasado el descanso se puede volver a criar" "$(iniciar $U1 comun-1 $A $A2)" '"id"'

echo "== Sobrepoblación: respetar el medio ambiente"
reiniciar
adm comun-1 '{"habitat": "bosque", "horas": [1, 1, 1], "descanso_horas": 1}' >/dev/null
A=$(dar $U1 comun-1); A2=$(dar $U1 comun-1)
sql "update cartas_catalogo set limite = 2 where id = 'comun-1'" >/dev/null
contiene "con la especie en su límite global, no se empieza" "$(iniciar $U1 comun-1 $A $A2)" "Sobrepoblación de la especie: hay que respetar el medio ambiente"
comprobar "...y las dos copias siguen libres" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"
sql "update cartas_catalogo set limite = 3 where id = 'comun-1'" >/dev/null
iniciar $U1 comun-1 $A $A2 >/dev/null
CR=$(cria_de $U1)
dar $U2 comun-1 >/dev/null     # otro jugador se lleva la última copia mientras tanto
terminar_ya "$CR"
RS=$(recoger $U1 $CR)
contiene "si la especie se llena mientras tanto, al recoger no nace nada y lo explica" "$RS" "Sobrepoblación de la especie"
comprobar "...queda como sin cupo" "sin_cupo" "$(sql "select estado from cartas_crias where id='$CR'")"
comprobar "...y las dos copias vuelven a su dueño, sin bloqueos" "2/0" "$(sql "select count(*) filter (where propietario='$U1' and estado='poseida')||'/'||count(*) filter (where estado='bloqueada') from cartas_ejemplares where carta_id='comun-1'")"
comprobar "...sin pasar el límite global (3 copias emitidas)" "3" "$(sql "select max(numero) from cartas_ejemplares where carta_id='comun-1'")"
sql "update cartas_catalogo set limite = 20 where id = 'comun-1'" >/dev/null

echo "== Un copia de la reserva cuenta como sitio"
RES=$(dar $U2 comun-1); sql "select cartas_i_retirar('$RES', 'reserva', 'prueba');" >/dev/null
sql "update cartas_catalogo set limite = 4 where id = 'comun-1'" >/dev/null
contiene "con una copia en la reserva sí se puede criar aunque el límite esté lleno" "$(iniciar $U1 comun-1 $A $A2)" '"id"'
CR=$(cria_de $U1); terminar_ya "$CR"
RR=$(recoger $U1 $CR)
contiene "...y la cría sale de la reserva" "$RR" '"de_reserva": true'
sql "update cartas_catalogo set limite = 20 where id = 'comun-1'" >/dev/null

echo "== Límite por jugador"
reiniciar
adm rara-1 '{"habitat": "glaciar", "horas": [1, 1, 1], "descanso_horas": 1}' >/dev/null
sql "update cartas_catalogo set limite = 50 where id = 'rara-1'" >/dev/null
LIM=$(sql "select cartas_limite_jugador('rara-1')")
IDS=""; for k in $(seq 1 "$LIM"); do IDS="$IDS $(dar $U3 rara-1)"; done
set -- $IDS
contiene "con el máximo de la criatura no cabría la cría" "$(iniciar $U3 rara-1 $1 $2)" "máximo de esta criatura"

echo "== Dos peticiones a la vez con la misma pareja: solo una pasa"
reiniciar
adm comun-1 '{"habitat": "bosque", "horas": [1, 1, 1], "descanso_horas": 1}' >/dev/null
A=$(dar $U1 comun-1); A2=$(dar $U1 comun-1)
como $U1 "select cartas_corral_iniciar('comun-1', '$A', '$A2');" 1 > "$TMP/c1" 2>&1 &
sleep 0.3
como $U1 "select cartas_corral_iniciar('comun-1', '$A', '$A2');" 0 > "$TMP/c2" 2>&1 &
wait
comprobar "se crea una sola cría" "1" "$(sql "select count(*) from cartas_crias where user_id='$U1'")"
comprobar "...y las dos copias están bloqueadas una sola vez" "2" "$(sql "select count(*) from cartas_bloqueos")"

echo "== Si algo se rompe, nada se pierde"
CRIA=$(cria_de $U1)
sql "delete from cartas_bloqueos where referencia='cria:$CRIA'; update cartas_ejemplares set estado='poseida' where id in ('$A','$A2')" >/dev/null
sql "update cartas_ejemplares set propietario='$U2' where id='$A2'" >/dev/null
terminar_ya "$CRIA"
contiene "si las dos criaturas ya no estaban en el corral, se cancela sin dar nada" "$(recoger $U1 $CRIA)" "ya no estaban en el corral"
comprobar "...queda cancelada y no nació nada" "cancelada/2" "$(sql "select (select estado from cartas_crias where id='$CRIA'), (select count(*) from cartas_ejemplares where carta_id='comun-1')" | tr '|' '/')"
reiniciar
adm comun-1 '{"habitat": "bosque", "horas": [1, 1, 1], "descanso_horas": 1}' >/dev/null
A=$(dar $U1 comun-1); A2=$(dar $U1 comun-1)
iniciar $U1 comun-1 $A $A2 >/dev/null
CRIA=$(cria_de $U1)
sql "update cartas_crias set estado='cancelada' where id='$CRIA'" >/dev/null
sql "select cartas_i_liberar_huerfanos();" >/dev/null
comprobar "un bloqueo de cría que ya no existe se suelta solo" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"

echo "== Y todo sigue cuadrando"
comprobar "la auditoría está limpia" "0" "$(auditar)"
rm -rf "$TMP"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
