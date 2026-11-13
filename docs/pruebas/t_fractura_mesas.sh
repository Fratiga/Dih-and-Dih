#!/bin/sh
# La Fractura: frentes con premio y mesas de varios jugadores con apuestas (docs/fractura-3_frentes_y_mesas.sql).
# Uso: BD=fractura_mesas sh docs/pruebas/t_fractura_mesas.sh
# La base necesita las tablas reales de La Fractura (scratchpad/fractura.sql y fractura_pvp.sql) y el archivo de arriba.
. "$(dirname "$0")/lib.sh"
FALLOS=0
HOY=$(date -u +%Y%m%d)
# (la probabilidad de carta por tramo se pone a 1 para que las pruebas no dependan del azar)
reset() { limpiar 2>/dev/null; sql "delete from fractura_guerras; delete from fractura_mesas; delete from cartas_incidencias; update cartas_catalogo set en_circulacion = true where id <> 'bufon'; update cartas_catalogo set limite_jugador = null; update cartas_juegos set activo = true, prob = '{\"bueno\": 1, \"excelente\": 1, \"extraordinario\": 1}' where juego = 'fractura'" >/dev/null; }
guerra() { # <usuario> <frente o NULL> <nivel o NULL> [resultado]
  sql "insert into fractura_guerras (user_id, faccion, rival, tipo, titulo, resultado, frente, nivel) values ('$1', 'okran', 'nernib', 'reinos', 'Guerra de prueba', '${4:-victoria}', $2, $3) returning id"
}
reclamar() { como "$1" "select fractura_recompensa('$2');" | tr -d '\n'; }
dueno() { sql "select propietario from cartas_ejemplares where id='$1'"; }
estado_ej() { sql "select estado from cartas_ejemplares where id='$1'"; }
mesa() { sql "select $2 from fractura_mesas where id='$1'"; }
BANDO() { printf '{"faccion":"%s","nombre":"Ejército %s","soldados":[]}' "$1" "$1"; }
crear() { # <usuario> <faccion> <config json> -> id
  como "$1" "select fractura_mesa_crear('', '$3'::jsonb, '$(BANDO $2)'::jsonb);" | tr -d ' \n'
}
unir() { como "$1" "select fractura_mesa_unirse('$2', '$(BANDO $3)'::jsonb);" | tr -d '\n'; }
apostar() { como "$1" "select fractura_mesa_apostar('$2', '{$3}'::uuid[]);" | tr -d '\n'; }
listo() { como "$1" "select fractura_mesa_listo('$2', true);" | tr -d '\n'; }
empezar() { como "$1" "select fractura_mesa_empezar('$2');" | tr -d '\n'; }
turno() { como "$1" "select fractura_mesa_turno('$2', $3, '$4', '[]'::jsonb, $5, 'h');" | tr -d '\n'; }
terminar() { como "$1" "select fractura_mesa_terminar('$2', '$3', 'fin de prueba');" | tr -d ' \n'; }
CFG4='{"tipo":"reinos","forma":"archipielago","plazas":4,"ia":true,"relleno":["okran","nernib","balutia","seosan","mravec"],"dificultad":"normal","horas":48,"reglas":3}'
CFG2='{"tipo":"reinos","forma":"continente","plazas":2,"ia":false,"horas":48,"reglas":3}'
CFGE='{"tipo":"reinos","forma":"continente","plazas":4,"ia":false,"equipos":true,"horas":48,"reglas":3}'

reset
echo "== Frentes: el nivel lo pone el servidor"
comprobar "2 bandos en normal es una escaramuza" "escaramuza" "$(sql "select fractura_nivel_frente(2, 'normal')")"
comprobar "2 bandos en fácil no es un frente" "" "$(sql "select coalesce(fractura_nivel_frente(2, 'facil'), '')")"
comprobar "3 bandos es una guerra" "guerra" "$(sql "select fractura_nivel_frente(3, 'normal')")"
comprobar "2 bandos en difícil es una guerra" "guerra" "$(sql "select fractura_nivel_frente(2, 'dificil')")"
comprobar "4 en difícil es una gran guerra" "gran_guerra" "$(sql "select fractura_nivel_frente(4, 'dificil')")"
comprobar "6 bandos es una gran guerra" "gran_guerra" "$(sql "select fractura_nivel_frente(6, 'normal')")"
G=$(como $U1 "select fractura_registrar_guerra('{\"resultado\":\"victoria\",\"faccion\":\"okran\",\"rival\":\"nernib\",\"tipo\":\"reinos\",\"frente\":{\"clave\":\"d$HOY-1\",\"bandos\":4,\"dificultad\":\"normal\",\"nivel\":\"gran_guerra\"}}'::jsonb);" | tr -d ' \n')
comprobar "registrar guarda el frente" "d$HOY-1" "$(sql "select frente from fractura_guerras where id='$G'")"
comprobar "y el nivel sale de bandos y dificultad, no de lo que diga el navegador" "guerra" "$(sql "select nivel from fractura_guerras where id='$G'")"
G2=$(como $U2 "select fractura_registrar_guerra('{\"resultado\":\"victoria\",\"faccion\":\"okran\",\"rival\":\"nernib\",\"tipo\":\"reinos\",\"frente\":{\"clave\":\"d20200101-0\",\"bandos\":4,\"dificultad\":\"normal\"}}'::jsonb);" | tr -d ' \n')
comprobar "un frente de hace años no cuenta" "" "$(sql "select coalesce(frente, '') from fractura_guerras where id='$G2'")"
G3=$(como $U3 "select fractura_registrar_guerra('{\"resultado\":\"victoria\",\"faccion\":\"okran\",\"rival\":\"nernib\",\"tipo\":\"reinos\",\"pvp\":true,\"frente\":{\"clave\":\"d$HOY-0\",\"bandos\":2,\"dificultad\":\"normal\"}}'::jsonb);" | tr -d ' \n')
comprobar "una guerra entre jugadores no es un frente" "" "$(sql "select coalesce(frente, '') from fractura_guerras where id='$G3'")"

echo "== Frentes: el premio"
R=$(reclamar $U1 $G)
contiene "un frente ganado da carta" "$R" '"resultado": "carta"'
contiene "y dice su nivel" "$R" '"nivel": "guerra"'
CARTA=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "una guerra (valor 3) da poco común o rara" "t" "$(sql "select rareza in ('infrecuente', 'rara') from cartas_catalogo where id='$CARTA'")"
contiene "no se cobra dos veces" "$(reclamar $U1 $G)" "ya dio su premio"
GB=$(guerra $U1 "'d$HOY-1'" "'guerra'")
contiene "ni ganando otra vez el mismo frente" "$(reclamar $U1 $GB)" "Ya cobraste ese frente"
GL=$(guerra $U2 NULL NULL)
contiene "una guerra libre no da cartas" "$(reclamar $U2 $GL)" "Solo los frentes"
GE=$(guerra $U2 "'d$HOY-0'" "'escaramuza'")
R=$(reclamar $U2 $GE); CE=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "una escaramuza (valor 1) da común o poco común" "t" "$(sql "select rareza in ('comun', 'infrecuente') from cartas_catalogo where id='$CE'")"
GG=$(guerra $U3 "'w$HOY-0'" "'gran_guerra'")
R=$(reclamar $U3 $GG); CG=$(printf '%s' "$R" | sed 's/.*"carta": "\([^"]*\)".*/\1/')
comprobar "una gran guerra (valor 4) da una rara" "rara" "$(sql "select rareza from cartas_catalogo where id='$CG'")"
comprobar "los frentes cobrados se pueden consultar" "d$HOY-1" "$(como $U1 "select * from fractura_frentes_cobrados();" | tr -d ' \n')"
GD=$(guerra $U4 "'d$HOY-2'" "'guerra'" derrota)
contiene "perder un frente no da nada" "$(reclamar $U4 $GD)" "Solo se premia ganar"
sql "update cartas_juegos set activo = false where juego = 'fractura'" >/dev/null
GA=$(guerra $U4 "'d$HOY-2'" "'guerra'")
contiene "con el juego apagado no da nada y no se gasta" "$(reclamar $U4 $GA)" 'juego-inactivo'
comprobar "la guerra sigue sin cobrar" "f" "$(sql "select recompensada from fractura_guerras where id='$GA'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

reset
echo "== Mesa: sentarse, apostar distinto y dar el visto bueno"
A1=$(dar $U1 comun-1)
B1=$(dar $U2 rara-1); B2=$(dar $U2 rara-2); B3=$(dar $U2 poco-1); B4=$(dar $U2 legendaria-1)
C1=$(dar $U3 comun-2)
M=$(crear $U1 caballeros-del-reino "$CFG4")
comprobar "la mesa nace abierta" "abierta" "$(mesa $M estado)"
contiene "no se entra con el mismo ejército" "$(unir $U2 $M caballeros-del-reino)" "ya está en la mesa"
unir $U2 $M pelgiria >/dev/null; unir $U3 $M mravec >/dev/null
comprobar "hay tres sentados" "3" "$(mesa $M 'jsonb_array_length(asientos)')"
contiene "no se sienta dos veces" "$(unir $U2 $M okran)" "Ya estás"
apostar $U1 $M "$A1" >/dev/null
contiene "nadie apuesta cartas de otro" "$(apostar $U1 $M "$B1")" "no es tuya"
comprobar "y su apuesta anterior sigue en pie" "bloqueada" "$(estado_ej $A1)"
apostar $U2 $M "$B1,$B2,$B3,$B4" >/dev/null
comprobar "una común contra cuatro cartas con una legendaria: vale" "4" "$(mesa $M "jsonb_array_length(apuestas -> '$U2')")"
comprobar "las cartas apostadas quedan bloqueadas" "bloqueada" "$(estado_ej $B4)"
comprobar "quien no apuesta, no apuesta" "f" "$(mesa $M "apuestas ? '$U3'")"
contiene "sin el visto bueno de todos no se empieza" "$(empezar $U1 $M)" "visto bueno"
listo $U2 $M >/dev/null; listo $U3 $M >/dev/null
apostar $U2 $M "$B1,$B2,$B3" >/dev/null
comprobar "cambiar la apuesta suelta la carta retirada" "poseida" "$(estado_ej $B4)"
contiene "y obliga a dar otra vez el visto bueno" "$(empezar $U1 $M)" "visto bueno"
contiene "solo empieza quien abrió la mesa" "$(empezar $U2 $M)" "Solo quien abrió"
listo $U2 $M >/dev/null; listo $U3 $M >/dev/null
L=$(como $U3 "select fractura_mesas_lista();")
contiene "la lista enseña lo que apuesta cada uno" "$L" '"rareza": "rara"'
nocontiene "y no carga los soldados" "$L" '"soldados"'
comprobar "empezar" "" "$(empezar $U1 $M)"
comprobar "la mesa pasa a activa" "activa" "$(mesa $M estado)"
comprobar "la máquina ocupa la cuarta plaza" "4" "$(mesa $M "jsonb_array_length(config -> 'jugadores')")"
comprobar "con un ejército que no estaba" "okran" "$(mesa $M "config -> 'jugadores' -> 3 ->> 'faccion'")"
comprobar "y la plaza de la máquina no es de nadie" "null" "$(mesa $M "config -> 'humanos' -> 3")"
contiene "empezada la guerra no se cambia la apuesta" "$(apostar $U2 $M "$B1")" "cerradas"
contiene "ni se levanta nadie" "$(como $U3 "select fractura_mesa_salir('$M');")" "ya empezó"

echo "== Mesa: turnos"
contiene "no juega quien no tiene el turno" "$(turno $U2 $M 0 turno 2)" "No es tu turno"
contiene "el siguiente tiene que ser un jugador, no la máquina" "$(turno $U1 $M 0 turno 3)" "Turno inválido"
comprobar "el primero juega" "" "$(turno $U1 $M 0 turno 1)"
comprobar "le toca al segundo" "1" "$(mesa $M activo)"
contiene "un turno repetido no entra" "$(turno $U2 $M 0 turno 2)" "recarga"
contiene "no se salta a nadie antes de plazo" "$(turno $U1 $M 1 ausente 2)" "en plazo"
sql "update fractura_mesas set limite = now() - interval '1 minute' where id='$M'" >/dev/null
contiene "nadie se salta a sí mismo" "$(turno $U2 $M 1 ausente 2)" "Es tu turno"
comprobar "pasado el plazo, otro pide que juegue la máquina" "" "$(turno $U3 $M 1 ausente 2)"
comprobar "queda anotado como ausente" "true" "$(mesa $M "turnos -> 1 ->> 'ausente'")"
comprobar "rendirse en tu turno" "" "$(turno $U3 $M 2 rendicion 0)"
contiene "un extraño no toca la mesa" "$(turno $U4 $M 3 turno 0)" "No estás"

echo "== Mesa: final con apuestas (gana el asiento 0)"
comprobar "un solo aviso de tres no basta" "activa" "$(terminar $U1 $M 0)"
comprobar "con dos de tres, se resuelve" "terminada" "$(terminar $U2 $M 0)"
comprobar "el ganador se lleva la rara" "$U1" "$(dueno $B1)"
comprobar "y las otras dos" "2" "$(sql "select count(*) from cartas_ejemplares where id in ('$B2', '$B3') and propietario='$U1'")"
comprobar "su carta sigue siendo suya y queda libre" "poseida" "$(estado_ej $A1)"
comprobar "quien no apostó no pierde nada" "$U3" "$(dueno $C1)"
comprobar "no queda nada bloqueado" "0" "$(sql "select count(*) from cartas_bloqueos where referencia like 'fractura:%'")"
comprobar "los movimientos quedan en el libro" "3" "$(sql "select count(*) from cartas_movimientos where motivo = 'apuesta ganada en La Fractura'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

reset
echo "== Mesa de dos: avisos que chocan"
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
comprobar "el que dice que ganó espera al otro" "activa" "$(terminar $U1 $M 0)"
comprobar "si el otro dice lo contrario, disputa" "disputa" "$(terminar $U2 $M 1)"
comprobar "queda una incidencia para el admin" "1" "$(sql "select count(*) from cartas_incidencias where tipo='fractura_disputa' and resuelta is null")"
comprobar "las cartas siguen bloqueadas" "bloqueada" "$(estado_ej $B1)"
contiene "un jugador no resuelve disputas" "$(como $U1 "select fractura_admin_mesa_resolver('$M', '0');")" "No autorizado"
como $ADMIN "select fractura_admin_mesa_resolver('$M', '1');" >/dev/null
comprobar "el admin da la razón al asiento 1" "$U2" "$(dueno $A1)"
comprobar "la mesa queda terminada" "terminada" "$(mesa $M estado)"
comprobar "y la incidencia resuelta" "0" "$(sql "select count(*) from cartas_incidencias where tipo='fractura_disputa' and resuelta is null")"

reset
echo "== Mesa de dos: el que pierde lo confirma, y el aviso sin respuesta"
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
comprobar "si el que pierde avisa primero, se resuelve" "terminada" "$(terminar $U2 $M 0)"
comprobar "y el otro cobra" "$U1" "$(dueno $B1)"
reset
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
terminar $U1 $M 0 >/dev/null
como $U2 "select fractura_mesas_lista();" >/dev/null
comprobar "un aviso reciente no se da por bueno solo" "activa" "$(mesa $M estado)"
sql "update fractura_mesas set reportado = now() - interval '25 hours' where id='$M'" >/dev/null
como $U2 "select fractura_mesas_lista();" >/dev/null
comprobar "a las 24 horas sin respuesta, vale" "terminada" "$(mesa $M estado)"
comprobar "y se paga" "$U1" "$(dueno $B1)"

reset
echo "== Empate y victoria de la máquina: cada uno recupera lo suyo"
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
terminar $U1 $M empate >/dev/null; terminar $U2 $M empate >/dev/null
comprobar "en empate la rara vuelve a su dueño" "$U2" "$(dueno $B1)"
comprobar "y queda libre" "poseida" "$(estado_ej $B1)"
reset
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 caballeros-del-reino "$CFG4"); unir $U2 $M pelgiria >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
terminar $U1 $M 2 >/dev/null; terminar $U2 $M 2 >/dev/null
comprobar "si gana la máquina la mesa termina" "terminada" "$(mesa $M estado)"
comprobar "y nadie pierde cartas" "$U2:$U1" "$(dueno $B1):$(dueno $A1)"

reset
echo "== Equipos: los que ganan se reparten lo de los que pierden"
A1=$(dar $U1 comun-1)
B1=$(dar $U2 rara-1); B2=$(dar $U2 poco-1); B3=$(dar $U2 comun-3)
C1=$(dar $U3 comun-2)
D1=$(dar $U4 rara-2); D2=$(dar $U4 comun-4)
M=$(crear $U1 okran "$CFGE"); unir $U2 $M nernib >/dev/null; unir $U3 $M balutia >/dev/null; unir $U4 $M seosan >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1,$B2,$B3" >/dev/null; apostar $U3 $M "$C1" >/dev/null; apostar $U4 $M "$D1,$D2" >/dev/null
listo $U2 $M >/dev/null; listo $U3 $M >/dev/null; listo $U4 $M >/dev/null; empezar $U1 $M >/dev/null
comprobar "los equipos van alternos" "0101" "$(mesa $M "(select string_agg(b ->> 'equipo', '' order by k) from jsonb_array_elements(config -> 'jugadores') with ordinality t(b, k))")"
terminar $U1 $M "0,2" >/dev/null; terminar $U2 $M "0,2" >/dev/null
comprobar "con dos de cuatro todavía no" "activa" "$(mesa $M estado)"
comprobar "cuando lo confirman los dos que pierden, sí" "terminada" "$(terminar $U4 $M "0,2")"
comprobar "cinco cartas cambian de manos" "5" "$(sql "select count(*) from cartas_ejemplares where id in ('$B1','$B2','$B3','$D1','$D2') and propietario in ('$U1','$U3')")"
comprobar "repartidas entre los dos que ganan (3 y 2)" "3,2" "$(sql "select string_agg(n::text, ',' order by n desc) from (select count(*) n from cartas_ejemplares where id in ('$B1','$B2','$B3','$D1','$D2') group by propietario) q")"
comprobar "las dos raras, una para cada uno" "2" "$(sql "select count(distinct propietario) from cartas_ejemplares where id in ('$B1','$D1')")"
comprobar "los que ganan conservan lo suyo" "$U1:$U3" "$(dueno $A1):$(dueno $C1)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

reset
echo "== Sin apuestas vale el primer aviso; y la carta que no cabe"
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
comprobar "sin nada en juego, el primer aviso cierra" "terminada" "$(terminar $U1 $M 0)"
reset
sql "update cartas_catalogo set limite_jugador = 1 where id = 'rara-1'" >/dev/null
A0=$(dar $U1 rara-1); B1=$(dar $U2 rara-1); B2=$(dar $U2 comun-1)
M=$(crear $U1 okran "$CFG2"); unir $U2 $M nernib >/dev/null
apostar $U2 $M "$B1,$B2" >/dev/null; listo $U2 $M >/dev/null; empezar $U1 $M >/dev/null
terminar $U1 $M 0 >/dev/null; terminar $U2 $M 0 >/dev/null
comprobar "la carta que no cabe se queda con su dueño" "$U2" "$(dueno $B1)"
comprobar "y queda libre" "poseida" "$(estado_ej $B1)"
comprobar "la que sí cabe, pasa" "$U1" "$(dueno $B2)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

reset
echo "== Levantarse de la mesa y mesas privadas"
A1=$(dar $U1 comun-1); B1=$(dar $U2 rara-1)
M=$(crear $U1 okran "$CFG4"); unir $U2 $M nernib >/dev/null
apostar $U1 $M "$A1" >/dev/null; apostar $U2 $M "$B1" >/dev/null
como $U2 "select fractura_mesa_salir('$M');" >/dev/null
comprobar "quien se levanta recupera su apuesta" "poseida" "$(estado_ej $B1)"
comprobar "y deja el asiento" "1" "$(mesa $M 'jsonb_array_length(asientos)')"
contiene "con uno solo no se empieza" "$(empezar $U1 $M)" "al menos dos"
como $U1 "select fractura_mesa_salir('$M');" >/dev/null
comprobar "si se va el anfitrión, la mesa se cierra" "cancelada" "$(mesa $M estado)"
comprobar "y su carta queda libre" "poseida" "$(estado_ej $A1)"
MP=$(como $U1 "select fractura_mesa_crear('Privada', '{\"plazas\":3,\"privada\":true,\"reglas\":3}'::jsonb, '$(BANDO okran)'::jsonb, array['$U2']::uuid[]);" | tr -d ' \n')
contiene "a una mesa privada no entra quien no está invitado" "$(unir $U3 $MP nernib)" "invitación"
comprobar "el invitado sí" "" "$(unir $U2 $MP nernib)"
nocontiene "y quien no está invitado ni la ve en la lista" "$(como $U3 "select fractura_mesas_lista();")" "Privada"
contiene "el invitado la ve" "$(como $U2 "select fractura_mesas_lista();")" "Privada"
comprobar "leyendo la tabla, el extraño tampoco la ve" "0" "$(como $U3 "select count(*) from fractura_mesas where id='$MP';" | tr -d ' \n')"
contiene "sin sesión no se puede nada" "$(anonimo "select fractura_mesas_lista();")" "permission denied"
sql "update fractura_mesas set actualizada = now() - interval '8 days' where id='$MP'" >/dev/null
como $U2 "select fractura_mesas_lista();" >/dev/null
comprobar "una mesa abierta que nadie empieza caduca a los 7 días" "cancelada" "$(mesa $MP estado)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
if [ "$FALLOS" = 0 ]; then echo "TODO BIEN"; else echo "FALLOS: $FALLOS"; fi
exit $FALLOS
