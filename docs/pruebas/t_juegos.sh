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

echo "== Zarabanda y Parranda: recompensas exigentes, por puntos ganados"
reiniciar
admz() { como $ADMIN "select cartas_admin_guardar_juego('$1', '$2'::jsonb);" 2>&1; }
# puntuación = puntos × 10000 + precisión en décimas de %
pz() { echo $(( $1 * 10000 + $2 )); }
for J in zarabanda parranda; do
  comprobar "$J: Fácil no da nada, ni con un millón de puntos" "-1" "$(val $J facil gana $(pz 1000000 990))"
  comprobar "$J: Normal, 400.000 puntos = un sello (0)" "0" "$(val $J normal gana $(pz 400000 900))"
  comprobar "$J: Normal, 340.000 puntos no llega al sello" "-1" "$(val $J normal gana $(pz 340000 990))"
  comprobar "$J: Difícil, 300.000 = un sello" "0" "$(val $J dificil gana $(pz 300000 850))"
  comprobar "$J: Difícil, 400.000 = bueno (1)" "1" "$(val $J dificil gana $(pz 400000 850))"
  comprobar "$J: Difícil, 550.000 = excelente (3)" "3" "$(val $J dificil gana $(pz 550000 850))"
  comprobar "$J: Difícil no tiene extraordinario aunque haya un millón" "3" "$(val $J dificil gana $(pz 1000000 990))"
  comprobar "$J: Experto, 350.000 = un sello" "0" "$(val $J experto gana $(pz 350000 850))"
  comprobar "$J: Experto, 500.000 = bueno" "1" "$(val $J experto gana $(pz 500000 850))"
  comprobar "$J: Experto, 700.000 = excelente" "3" "$(val $J experto gana $(pz 700000 850))"
  comprobar "$J: Experto, 900.000 = extraordinario (4)" "4" "$(val $J experto gana $(pz 900000 850))"
  comprobar "$J: una canción corta con rango S pero pocos puntos no da nada" "-1" "$(val $J experto gana $(pz 120000 1000))"
  comprobar "$J: muchos puntos con menos del 80 % de precisión no dan nada" "-1" "$(val $J experto gana $(pz 950000 790))"
  comprobar "$J: justo el 80 % sí cuenta" "4" "$(val $J experto gana $(pz 950000 800))"
  comprobar "$J: no terminar la canción no da nada" "-1" "$(val $J experto pierde $(pz 950000 990))"
  comprobar "$J: una dificultad inventada no da nada" "-1" "$(val $J imposible gana $(pz 950000 990))"
done
contiene "puntos que no suben de sello a extraordinario" "$(admz zarabanda '{"valores": {"dificultades": {"dificil": {"sello": 500000, "bueno": 400000, "excelente": -1, "extraordinario": -1}}}}')" "tienen que subir"
contiene "una dificultad desconocida" "$(admz parranda '{"valores": {"dificultades": {"locura": {"sello": 1}}}}')" "Dificultad desconocida"
contiene "un campo raro en una dificultad" "$(admz parranda '{"valores": {"dificultades": {"experto": {"Z": 1}}}}')" "campo desconocido"
contiene "un campo raro arriba" "$(admz zarabanda '{"valores": {"rangos": {"S": 95}}}')" "campo desconocido"
contiene "precisión mínima fuera de 0 a 100" "$(admz zarabanda '{"valores": {"precision_minima": 150}}')" "0 a 100"
contiene "puntos fuera de rango" "$(admz zarabanda '{"valores": {"dificultades": {"experto": {"sello": 99999999999}}}}')" "van de 0 a 10.000.000"
admz zarabanda '{"valores": {"precision_minima": 0, "dificultades": {"experto": {"sello": 1, "bueno": 2, "excelente": 3, "extraordinario": 4}}}}' | grep -q ERROR && echo "  (no se pudo cambiar la configuración de prueba)"
comprobar "los puntos mínimos se pueden cambiar desde el panel" "4" "$(val zarabanda experto gana $(pz 4 0))"
admz zarabanda '{"activo": true, "prob": {"bueno": 1, "excelente": 1, "extraordinario": 1}, "valores": {"precision_minima": 80, "dificultades": {"facil": {"sello": -1, "bueno": -1, "excelente": -1, "extraordinario": -1}, "normal": {"sello": 350000, "bueno": -1, "excelente": -1, "extraordinario": -1}, "dificil": {"sello": 300000, "bueno": 400000, "excelente": 550000, "extraordinario": -1}, "experto": {"sello": 350000, "bueno": 500000, "excelente": 700000, "extraordinario": 900000}}}}' >/dev/null
jugarz() {
  TK=$(como $1 "select cartas_juego_iniciar('zarabanda', '$2');" | tail -1)
  sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
  como $1 "select cartas_juego_terminar('$TK', 'gana', $3);"
}
contiene "Experto con 900.000 puntos: tramo extraordinario" "$(jugarz $U1 experto $(pz 900000 900))" '"tramo": "extraordinario"'
contiene "Fácil con muchos puntos: sin recompensa" "$(jugarz $U2 facil $(pz 900000 990))" '"motivo": "sin-premio"'
contiene "Experto con una canción de pocos puntos: sin recompensa" "$(jugarz $U2 experto $(pz 100000 1000))" '"motivo": "sin-premio"'
TK=$(como $U3 "select cartas_juego_iniciar('zarabanda', 'experto');" | tail -1)
contiene "una partida de pocos segundos no cuenta" "$(como $U3 "select cartas_juego_terminar('$TK', 'gana', $(pz 900000 900));")" "muy-rapido"

echo "== Perder ya no da sellos; Veintiuna menos generosa (migración 22)"
reiniciar
M22() { docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$(dirname "$0")/../economia-22_menos_sellos_gratis.sql" 2>&1 | grep -v NOTICE | head -3; }
sql "delete from cartas_juegos where juego = 'veintiuna'" >/dev/null
sql "insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, pesos, valores, prob) values ('veintiuna', 'Veintiuna', false, '{\"participacion\": 0, \"bueno\": 1, \"excelente\": 3, \"extraordinario\": 4}', 2, 0, 5, '{\"bueno\": {\"comun\": 100}}', '{\"rivales\": {\"oro\": {\"gana\": 4, \"tablas\": 0, \"pierde\": 0}, \"_otros\": {\"gana\": 1, \"tablas\": 0, \"pierde\": 0}}}', '{\"bueno\": 1, \"excelente\": 1, \"extraordinario\": 1}')" >/dev/null
comprobar "antes: perder contra Cassius valía 0 (un sello)" "0" "$(val arqueria cassius pierde 0)"
M22; M22
comprobar "perder en Ajedrez ya no cuenta" "-1" "$(val ajedrez baraja pierde 0)"
comprobar "tablas sin mérito (contra Ocevat) tampoco" "-1" "$(val ajedrez ocevat tablas 0)"
comprobar "tablas contra Baraja sí valen (1)" "1" "$(val ajedrez baraja tablas 0)"
comprobar "ganar sigue igual (Baraja = 2)" "2" "$(val ajedrez baraja gana 0)"
comprobar "contra Hooey sigue sin premio" "-1" "$(val ajedrez hooey gana 0)"
comprobar "perder en Arquería ya no cuenta" "-1" "$(val arqueria cassius pierde 0)"
comprobar "ganar en Arquería sigue igual (Garra = 2)" "2" "$(val arqueria garra gana 0)"
comprobar "perder en Duelo ya no cuenta" "-1" "$(val duelo adam pierde 0)"
comprobar "ganar en Duelo sigue igual" "4" "$(val duelo adam gana 0)"
TK=$(como $U1 "select cartas_juego_iniciar('arqueria', 'cassius');" | tail -1)
sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
contiene "una partida de Arquería perdida no da ni un sello" "$(como $U1 "select cartas_juego_terminar('$TK', 'pierde', 0);")" '"motivo": "sin-premio"'
comprobar "...y no suma sellos" "0" "$(sql "select count(*) from cartas_progreso where user_id='$U1' and sellos > 0")"
comprobar "Veintiuna: probabilidad del tramo bueno" "0.5" "$(sql "select prob->>'bueno' from cartas_juegos where juego='veintiuna'")"
comprobar "Veintiuna: el tramo extraordinario sigue seguro" "1" "$(sql "select prob->>'extraordinario' from cartas_juegos where juego='veintiuna'")"
comprobar "Veintiuna: una partida tiene que durar 30 s" "30" "$(sql "select min_segundos from cartas_juegos where juego='veintiuna'")"
comprobar "Veintiuna: perder ya no cuenta" "-1" "$(sql "select cartas_valor_juego('veintiuna', 'oro', 'pierde', 0)")"
sql "delete from cartas_juegos where juego = 'veintiuna'" >/dev/null

echo "== Y todo sigue cuadrando"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
