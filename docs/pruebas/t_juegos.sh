#!/bin/sh
# Probabilidad de carta y cartas propias por tramo de cada minijuego (docs/economia-15_juegos_por_tramo.sql). Uso: sh docs/pruebas/t_juegos.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
adm() { como $ADMIN "select cartas_admin_guardar_juego('arqueria', '$1'::jsonb);" 2>&1; }
# jugar <usuario> <rival> <puntuación>: una partida de Arquería ganada, ya con el tiempo mínimo cumplido
jugar() {
  TK=$(como $1 "select cartas_juego_iniciar('arqueria', '$2');" | tail -1)
  sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
  como $1 "select cartas_juego_terminar('$TK', 'gana', $3);"
}
reiniciar() {
  limpiar
  sql "delete from cartas_recompensas_registro; delete from cartas_progreso;" >/dev/null 2>&1
  sql "update cartas_juegos set activo = true, grupos = '{}'::jsonb, prob = '{\"bueno\": 0.5, \"excelente\": 0.8, \"extraordinario\": 1}'::jsonb" >/dev/null
}
# hornet sin bonus da valor 1 (tramo bueno); cassius sin bonus da 3 (excelente); cassius con 40 puntos da 4 (extraordinario)

echo "== Por defecto"
reiniciar
comprobar "bueno 0,5, excelente 0,8 y extraordinario 1" "0.5/0.8/1" "$(sql "select (prob->>'bueno')||'/'||(prob->>'excelente')||'/'||(prob->>'extraordinario') from cartas_juegos where juego='arqueria'")"

echo "== La probabilidad es de cada tramo"
reiniciar; adm '{"prob": {"bueno": 0}}' >/dev/null
contiene "con probabilidad 0 en «bueno» no sale carta, solo un sello" "$(jugar $U1 hornet 0)" '"resultado": "sello"'
comprobar "...y no se emitió ninguna copia" "0" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1'")"
reiniciar; adm '{"prob": {"bueno": 1}}' >/dev/null
contiene "con probabilidad 1 en «bueno» sale carta" "$(jugar $U1 hornet 0)" '"resultado": "carta"'
reiniciar; adm '{"prob": {"extraordinario": 0}}' >/dev/null
contiene "con probabilidad 0 en «extraordinario» no sale carta" "$(jugar $U1 cassius 40)" '"resultado": "sello"'
contiene "...y «excelente» sigue dando carta (prob 0,8 solo con el mismo recorte)" "$(adm '{"prob": {"excelente": 1}}' >/dev/null; jugar $U2 cassius 0)" '"resultado": "carta"'
reiniciar; adm '{"prob": {"bueno": 0.5}}' >/dev/null
N=0; for i in 1 2 3 4 5 6 7 8; do
  sql "delete from cartas_recompensas_registro; delete from cartas_progreso;" >/dev/null 2>&1
  r=$(jugar $U3 hornet 0); case "$r" in *'"resultado": "carta"'*) N=$((N + 1));; esac
done
comprobar "con 0,5 salen cartas a veces pero no siempre (hubo $N de 8)" "si" "$( [ "$N" -ge 1 ] && [ "$N" -le 7 ] && echo si || echo no )"

echo "== Cada tramo con sus propias cartas"
reiniciar
adm '{"prob": {"bueno": 1, "excelente": 1}, "pesos": {"bueno": {"rara": 100}, "excelente": {"rara": 100}, "extraordinario": {"rara": 100}}, "grupos": {"bueno": {"ids": ["rara-2"]}, "excelente": {"ids": ["rara-3"]}}}' >/dev/null
contiene "«bueno» da exactamente la carta de su grupo" "$(jugar $U1 hornet 0)" '"carta": "rara-2"'
contiene "«excelente» da la suya" "$(jugar $U2 cassius 0)" '"carta": "rara-3"'
contiene "«extraordinario» no tiene grupo propio: usa el del juego (una criatura rara)" "$(jugar $U3 cassius 40)" '"rareza": "rara"'
comprobar "...y el que no tiene grupo propio puede sacar cualquier rara del grupo del juego, no solo las de otros tramos" "t" "$(sql "select exists (select 1 from cartas_ejemplares where propietario='$U3' and carta_id like 'rara-%')")"
reiniciar
adm '{"prob": {"bueno": 1}, "pesos": {"bueno": {"comun": 100}}, "grupos": {"bueno": {"tipos": ["Objeto"]}}}' >/dev/null
jugar $U1 hornet 0 >/dev/null
comprobar "un grupo por tipo solo da cartas de ese tipo" "Objeto" "$(sql "select c.tipo from cartas_ejemplares e join cartas_catalogo c on c.id=e.carta_id where e.propietario='$U1'")"
reiniciar
adm '{"prob": {"bueno": 1}, "pesos": {"bueno": {"comun": 100}}, "grupos": {"bueno": {"ids": ["comun-1"]}}}' >/dev/null
sql "update cartas_catalogo set en_circulacion = false where id = 'comun-1'" >/dev/null
nocontiene "una carta concreta fuera de circulación no sale aunque el tramo la pida" "$(jugar $U1 hornet 0)" '"carta": "comun-1"'
comprobar "...y nadie recibió esa copia" "0" "$(sql "select count(*) from cartas_ejemplares where carta_id='comun-1'")"

echo "== Lo que se puede guardar"
reiniciar
contiene "probabilidad fuera de 0 a 1" "$(adm '{"prob": {"bueno": 1.5}}')" "va de 0 a 1"
contiene "probabilidad para la participación (nunca da carta)" "$(adm '{"prob": {"participacion": 0.5}}')" "tramo desconocido"
contiene "carta que no existe en un grupo" "$(adm '{"grupos": {"bueno": {"ids": ["no-existe"]}}}')" "no existen"
contiene "campo raro en un grupo" "$(adm '{"grupos": {"bueno": {"colores": ["rojo"]}}}')" "campo desconocido"
contiene "un tramo sin ninguna rareza con peso" "$(adm '{"pesos": {"bueno": {"comun": 0}}}')" "al menos una rareza"
contiene "pesos con decimales" "$(adm '{"pesos": {"bueno": {"comun": 1.5}}}')" "enteros"
contiene "un jugador no puede cambiar la configuración" "$(como $U1 "select cartas_admin_guardar_juego('arqueria', '{\"prob\": {\"bueno\": 1}}'::jsonb);" 2>&1)" "No autorizado"
comprobar "nada de lo rechazado se guardó" "0.5" "$(sql "select prob->>'bueno' from cartas_juegos where juego='arqueria'")"

echo "== Puntaje de cada rival: los valores iniciales son los de siempre"
reiniciar
val() { sql "select cartas_valor_juego('$1', '$2', '$3', $4)"; }
comprobar "ajedrez baraja gana = 2" "2" "$(val ajedrez baraja gana 0)"
comprobar "ajedrez baraja tablas = 1" "1" "$(val ajedrez baraja tablas 0)"
comprobar "ajedrez perro pierde = 0" "0" "$(val ajedrez perro pierde 0)"
comprobar "ajedrez contra hooey no da premio" "-1" "$(val ajedrez hooey gana 0)"
comprobar "ajedrez rival desconocido = 1" "1" "$(val ajedrez desconocido gana 0)"
comprobar "duelo adam gana = 4" "4" "$(val duelo adam gana 0)"
comprobar "duelo tablas = 0" "0" "$(val duelo adam tablas 0)"
comprobar "arqueria cassius gana con 40 puntos = 4 (3 + bonus, máximo 4)" "4" "$(val arqueria cassius gana 40)"
comprobar "arqueria hornet gana con 30 puntos = 2" "2" "$(val arqueria hornet gana 30)"
comprobar "arqueria hornet gana con 29 puntos = 1" "1" "$(val arqueria hornet gana 29)"
comprobar "arqueria torvrena, milicia y tobi ganan = 4" "4/4/4" "$(val arqueria torvrena gana 0)/$(val arqueria milicia gana 0)/$(val arqueria tobi gana 0)"
comprobar "arqueria pierde = 0" "0" "$(val arqueria cassius pierde 99)"
comprobar "hooey 7 sacrificios = 7" "7" "$(val hooey hooey gana 7)"
comprobar "hooey con 5000 sacrificios topa en 1000" "1000" "$(val hooey hooey gana 5000)"

echo "== Cambiar el puntaje de un rival cambia lo que se juega"
reiniciar
adm '{"valores": {"rivales": {"hornet": {"gana": 4, "tablas": 0, "pierde": 0}, "garra": {"gana": 2, "tablas": 0, "pierde": 0}, "cassius": {"gana": 3, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}, "bonus": {"puntos": 30, "suma": 0}, "maximo": 4}}' >/dev/null
comprobar "hornet ahora vale 4" "4" "$(val arqueria hornet gana 0)"
comprobar "y sin bonus un 40 ya no suma" "3" "$(val arqueria cassius gana 40)"
sql "update cartas_juegos set prob = '{\"bueno\": 1, \"excelente\": 1, \"extraordinario\": 1}'::jsonb, pesos = '{\"bueno\": {\"comun\": 1}, \"excelente\": {\"comun\": 1}, \"extraordinario\": {\"rara\": 100}}'::jsonb where juego = 'arqueria'" >/dev/null
contiene "ganar a hornet ahora da el tramo extraordinario (4)" "$(jugar $U1 hornet 0)" '"tramo": "extraordinario"'

echo "== Valores: lo que se rechaza"
contiene "un puntaje fuera de rango" "$(adm '{"valores": {"maximo": 5000}}')" "van de 0 a 1000"
contiene "un campo desconocido" "$(adm '{"valores": {"magia": 1}}')" "campo desconocido"
contiene "un rival con un campo raro" "$(adm '{"valores": {"rivales": {"hornet": {"vence": 1}, "_otros": {"gana": 1}}}}')" "campo desconocido"
contiene "sin la fila _otros" "$(adm '{"valores": {"rivales": {"hornet": {"gana": 1}}}}')" "_otros"
contiene "un valor que no es número" "$(adm '{"valores": {"maximo": "mucho"}}')" "solo pueden ser números"
contiene "un jugador no puede cambiarlo" "$(como $U1 "select cartas_admin_guardar_juego('arqueria', '{\"valores\": {\"maximo\": 4}}'::jsonb);" 2>&1)" "No autorizado"
comprobar "nada de lo rechazado se guardó" "4" "$(sql "select valores->>'maximo' from cartas_juegos where juego='arqueria'")"

echo "== Zarabanda y Parranda: recompensas exigentes"
reiniciar
admz() { como $ADMIN "select cartas_admin_guardar_juego('$1', '$2'::jsonb);" 2>&1; }
for J in zarabanda parranda; do
  comprobar "$J: Fácil no da nada, ni con una canción perfecta" "-1" "$(val $J facil gana 10990)"
  comprobar "$J: Normal con rango S solo da un sello (0)" "0" "$(val $J normal gana 960)"
  comprobar "$J: Normal con rango A no da nada" "-1" "$(val $J normal gana 900)"
  comprobar "$J: Difícil con rango S = 1" "1" "$(val $J dificil gana 950)"
  comprobar "$J: Difícil con rango S y sin fallos = 3" "3" "$(val $J dificil gana 10970)"
  comprobar "$J: Difícil con rango A solo da un sello (0)" "0" "$(val $J dificil gana 890)"
  comprobar "$J: Difícil con rango B no da nada" "-1" "$(val $J dificil gana 800)"
  comprobar "$J: Experto con rango S = 3" "3" "$(val $J experto gana 960)"
  comprobar "$J: Experto con rango S y sin fallos = 4" "4" "$(val $J experto gana 10990)"
  comprobar "$J: Experto con rango A = 1" "1" "$(val $J experto gana 890)"
  comprobar "$J: Experto con rango B = 0" "0" "$(val $J experto gana 800)"
  comprobar "$J: Experto con rango C no da nada" "-1" "$(val $J experto gana 650)"
  comprobar "$J: sin fallos pero sin rango S no suma el bonus" "1" "$(val $J experto gana 10890)"
  comprobar "$J: no terminar la canción no da nada" "-1" "$(val $J experto pierde 990)"
  comprobar "$J: una dificultad inventada no da nada" "-1" "$(val $J imposible gana 990)"
done
contiene "rangos que no bajan de S a C" "$(admz zarabanda '{"valores": {"rangos": {"S": 80, "A": 90, "B": 70, "C": 60}}}')" "baja de S a C"
contiene "una dificultad desconocida" "$(admz parranda '{"valores": {"dificultades": {"locura": {"S": 1}}}}')" "Dificultad desconocida"
contiene "un campo raro en una dificultad" "$(admz parranda '{"valores": {"dificultades": {"experto": {"Z": 1}}}}')" "campo desconocido"
contiene "un campo raro arriba" "$(admz zarabanda '{"valores": {"magia": 1}}')" "campo desconocido"
admz zarabanda '{"activo": true, "prob": {"bueno": 1, "excelente": 1, "extraordinario": 1}}' >/dev/null
jugarz() {
  TK=$(como $1 "select cartas_juego_iniciar('zarabanda', '$2');" | tail -1)
  sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
  como $1 "select cartas_juego_terminar('$TK', 'gana', $3);"
}
contiene "Experto, rango S y sin un fallo: tramo extraordinario" "$(jugarz $U1 experto 10990)" '"tramo": "extraordinario"'
contiene "Fácil perfecto: sin recompensa" "$(jugarz $U2 facil 10990)" '"motivo": "sin-premio"'
TK=$(como $U3 "select cartas_juego_iniciar('zarabanda', 'experto');" | tail -1)
contiene "una partida de pocos segundos no cuenta" "$(como $U3 "select cartas_juego_terminar('$TK', 'gana', 10990);")" "muy-rapido"

echo "== Y todo sigue cuadrando"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
