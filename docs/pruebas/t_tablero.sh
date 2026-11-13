#!/bin/sh
# Tablero de juego (docs/admin/tablero.sql): quién ve qué, quién mueve qué, tiradas en el servidor, chat, diario,
# orden de turno y macros.
# Usa su propia base para no chocar con otras sesiones:
#   BD=tablero sh docs/pruebas/cargar_local.sh && BD=tablero sh docs/pruebas/t_tablero.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
BD="${BD:-pruebas}"
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="docker exec -i cartas-pruebas psql -U postgres -d $BD -q -v ON_ERROR_STOP=1"
cargar() { $PSQL < "$DOCS/$1" >/dev/null 2>&1 || { echo "No corrió $1"; $PSQL < "$DOCS/$1" 2>&1 | grep -i error | head -3; exit 1; }; }
uno() { como "$1" "$2" | tail -1; }

echo "== Instalación"
cargar admin/tablero.sql
cargar admin/tablero.sql          # se puede repetir sin romper nada
comprobar "las nueve tablas existen" "9" "$(sql "select count(*) from pg_tables where tablename like 'tablero\_%'")"
comprobar "hay una sola fila de estado" "1" "$(sql "select count(*) from tablero_estado")"

sql "delete from tablero_escenas; delete from tablero_diario; delete from tablero_macros; delete from tablero_arte; truncate tablero_mensajes; insert into tablero_estado (id) values (1) on conflict (id) do nothing; update tablero_estado set escena_jugadores = null, iniciativa = '{\"lista\": [], \"turno\": 0, \"ronda\": 1, \"visible\": false}'" >/dev/null
S1=$(como "$ADMIN" "insert into tablero_escenas (nombre) values ('Cripta') returning id;" | head -1)
S2=$(como "$ADMIN" "insert into tablero_escenas (nombre) values ('Ciudad') returning id;" | head -1)
# obj escena capa controladores nombre [bloqueado] [datos extra]
obj() { como "$ADMIN" "insert into tablero_objetos (escena, capa, controladores, datos, bloqueado) values ('$1', '$2', $3, '{\"nombre\": \"$4\"${6:+, $6}}', ${5:-false}) returning id;" | head -1; }
NADIE="'{}'"
MAPA=$(obj "$S1" mapa "$NADIE" Mapa)
F1=$(obj "$S1" fichas "array['$U1']::uuid[]" Laia false '"barras": [{"valor": 10, "max": 20, "editar": true}, {"valor": 1, "max": 2, "editar": false}, {}]')
F2=$(obj "$S1" fichas "array['$U2']::uuid[]" Ryn)
FB=$(obj "$S1" fichas "array['$U1']::uuid[]" Estatua true)
GM=$(obj "$S1" gm "$NADIE" Emboscada)
DEL=$(obj "$S1" delantero "$NADIE" Techo)
OTRA=$(obj "$S2" fichas "array['$U1']::uuid[]" Laia2)
comprobar "el GM crea escenas y objetos" "2|7" "$(sql "select count(*) from tablero_escenas")|$(sql "select count(*) from tablero_objetos")"

echo "== Quién ve qué"
comprobar "sin escena mostrada, un jugador no ve nada" "0|0" "$(uno "$U1" "select count(*) from tablero_escenas;")|$(uno "$U1" "select count(*) from tablero_objetos;")"
como "$ADMIN" "update tablero_estado set escena_jugadores = '$S1' where id = 1;" >/dev/null
comprobar "el jugador ve solo la escena mostrada" "1|Cripta" "$(uno "$U1" "select count(*) from tablero_escenas;")|$(uno "$U1" "select nombre from tablero_escenas;")"
comprobar "ve mapa, fichas y capa delantera, nada de la capa del DJ ni de otra escena" "5|0|0" "$(uno "$U1" "select count(*) from tablero_objetos;")|$(uno "$U1" "select count(*) from tablero_objetos where capa = 'gm';")|$(uno "$U1" "select count(*) from tablero_objetos where escena = '$S2';")"
comprobar "el GM lo ve todo" "7|2" "$(uno "$ADMIN" "select count(*) from tablero_objetos;")|$(uno "$ADMIN" "select count(*) from tablero_escenas;")"
comprobar "sin sesión no se ve nada" "0|0|0" "$(anonimo "select count(*) from tablero_objetos;" | tail -1)|$(anonimo "select count(*) from tablero_escenas;" | tail -1)|$(anonimo "select count(*) from tablero_estado;" | tail -1)"
como "$U1" "select tablero_mover('$OTRA', 5, 5);" >/dev/null 2>&1
comprobar "la página del GM que no es la de los jugadores no se ve ni se toca" "1|0" "$(uno "$U2" "select count(*) from tablero_escenas;")|$(sql "select x from tablero_objetos where id = '$OTRA'")"
como "$ADMIN" "insert into tablero_notas_gm (objeto, texto) values ('$F2', 'Es un traidor');" >/dev/null
comprobar "las notas del DJ no las ve ningún jugador" "0|1" "$(uno "$U2" "select count(*) from tablero_notas_gm;")|$(uno "$ADMIN" "select count(*) from tablero_notas_gm;")"

echo "== Quién mueve qué"
como "$U1" "update tablero_objetos set x = 999 where id = '$F1';" >/dev/null
comprobar "el jugador no puede escribir la tabla directamente" "0" "$(sql "select x from tablero_objetos where id = '$F1'")"
contiene "el jugador no puede crear objetos directamente" "$(como "$U1" "insert into tablero_objetos (escena) values ('$S1');")" "row-level security"
como "$U1" "delete from tablero_objetos where id = '$F1';" >/dev/null
comprobar "el jugador no puede borrar objetos" "1" "$(sql "select count(*) from tablero_objetos where id = '$F1'")"
como "$U1" "select tablero_mover('$F1', 140, 210);" >/dev/null
comprobar "el jugador mueve su ficha" "140|210" "$(sql "select x || '|' || y from tablero_objetos where id = '$F1'")"
contiene "no mueve la ficha de otro" "$(como "$U1" "select tablero_mover('$F2', 1, 1);")" "No puedes mover esa ficha"
contiene "no mueve lo de la capa del DJ" "$(como "$U1" "select tablero_mover('$GM', 1, 1);")" "No puedes mover esa ficha"
contiene "no mueve una ficha suya bloqueada" "$(como "$U1" "select tablero_mover('$FB', 1, 1);")" "No puedes mover esa ficha"
contiene "no mueve una ficha suya de otra escena" "$(como "$U1" "select tablero_mover('$OTRA', 1, 1);")" "No puedes mover esa ficha"
contiene "no mueve sin sesión" "$(anonimo "select tablero_mover('$F1', 1, 1);")" "permission denied"
contiene "posición absurda" "$(como "$U1" "select tablero_mover('$F1', 1e9, 1);")" "Posición no válida"
como "$ADMIN" "update tablero_objetos set controlan_todos = true where id = '$F2';" >/dev/null
como "$U3" "select tablero_mover('$F2', 77, 77);" >/dev/null
comprobar "una ficha que controlan todos la mueve cualquiera" "77" "$(sql "select x from tablero_objetos where id = '$F2'")"
como "$ADMIN" "update tablero_objetos set controlan_todos = false where id = '$F2';" >/dev/null
como "$ADMIN" "select tablero_mover('$GM', 35, 35);" >/dev/null
comprobar "el GM mueve cualquier cosa" "35" "$(sql "select x from tablero_objetos where id = '$GM'")"
como "$U1" "update tablero_estado set escena_jugadores = '$S2' where id = 1;" >/dev/null
comprobar "el jugador no cambia la escena de los jugadores" "$S1" "$(sql "select escena_jugadores from tablero_estado")"
como "$U1" "update tablero_escenas set nombre = 'Hackeada' where id = '$S1';" >/dev/null
comprobar "el jugador no renombra la escena" "Cripta" "$(sql "select nombre from tablero_escenas where id = '$S1'")"

echo "== Barras"
como "$U1" "select tablero_barra('$F1', 1, 7, 20);" >/dev/null
comprobar "el jugador cambia una barra editable de su ficha" "7" "$(sql "select datos->'barras'->0->>'valor' from tablero_objetos where id = '$F1'")"
contiene "no cambia una barra que el GM no deja editar" "$(como "$U1" "select tablero_barra('$F1', 2, 0, 2);")" "No puedes cambiar esa barra"
contiene "no cambia barras de fichas ajenas" "$(como "$U2" "select tablero_barra('$F1', 1, 0, 20);")" "No puedes cambiar esa barra"
contiene "barra 4 no existe" "$(como "$ADMIN" "select tablero_barra('$F1', 4, 0, 1);")" "Valor no válido"
como "$ADMIN" "select tablero_barra('$GM', 3, 50, 60);" >/dev/null
comprobar "el GM cambia cualquier barra, aunque la ficha no tuviera barras" "50|3" "$(sql "select (datos->'barras'->2->>'valor') || '|' || jsonb_array_length(datos->'barras') from tablero_objetos where id = '$GM'")"

echo "== Dibujos de jugadores"
D1=$(uno "$U1" "select tablero_crear_propio('$S1', 'dibujo', 10, 10, 50, 50, '{\"puntos\": [0, 0, 50, 50], \"trazo\": \"#ff0000\"}');")
comprobar "el jugador dibuja en la capa de fichas de su escena" "fichas|dibujo|$S1" "$(sql "select capa || '|' || tipo || '|' || escena from tablero_objetos where id = '$D1'")"
contiene "no crea otra cosa que dibujos o texto" "$(como "$U1" "select tablero_crear_propio('$S1', 'imagen', 0, 0, 10, 10, '{}');")" "Solo puedes dibujar"
comprobar "otro jugador no borra el dibujo ajeno" "0" "$(uno "$U2" "select tablero_borrar_propio(array['$D1']::uuid[]);")"
contiene "no dibuja en una escena que no ve" "$(como "$U1" "select tablero_crear_propio('$S2', 'dibujo', 0, 0, 10, 10, '{}');")" "No puedes dibujar"
comprobar "no borra fichas aunque las controle" "0" "$(uno "$U1" "select tablero_borrar_propio(array['$F1']::uuid[]);")"
comprobar "borra su dibujo" "1|0" "$(uno "$U1" "select tablero_borrar_propio(array['$D1']::uuid[]);")|$(sql "select count(*) from tablero_objetos where id = '$D1'")"

echo "== Tiradas"
R=$(uno "$U1" "select (t->>'total') || '|' || jsonb_array_length(t->'partes') || '|' || (t->>'expr') from tablero_tirar('1d20 + 5', 'Ataque') t;")
T=${R%%|*}
if [ "$T" -ge 6 ] && [ "$T" -le 25 ]; then ok "1d20+5 da entre 6 y 25 ($T)"; else mal "1d20+5 fuera de rango ($R)"; fi
contiene "la tirada tiene dos partes y la expresión limpia" "$R" "|2|1d20+5"
comprobar "queda en el chat con el nombre de quien tira y la etiqueta" "Uno|Ataque" "$(sql "select nombre || '|' || (tirada->>'etiqueta') from tablero_mensajes order by id desc limit 1")"
comprobar "ventaja: se queda con el dado más alto" "0" "$(uno "$U1" "select count(*) from (select tablero_tirar('2d20kh1') t from generate_series(1, 40)) q where (t->>'total')::int <> (select max(v::int) from jsonb_array_elements_text(t->'partes'->0->'valores') v);")"
comprobar "desventaja: se queda con el más bajo" "0" "$(uno "$U1" "select count(*) from (select tablero_tirar('2d20kl1') t from generate_series(1, 40)) q where (t->>'total')::int <> (select min(v::int) from jsonb_array_elements_text(t->'partes'->0->'valores') v);")"
comprobar "4d6kh3 suma los tres más altos" "0" "$(uno "$U1" "select count(*) from (select tablero_tirar('4d6kh3') t from generate_series(1, 40)) q where (t->>'total')::int <> (select sum(v::int) - min(v::int) from jsonb_array_elements_text(t->'partes'->0->'valores') v);")"
comprobar "300 d6 salen todas las caras y ninguna fuera de 1 a 6" "6|1|6" "$(uno "$U1" "select count(distinct (t->>'total')) || '|' || min((t->>'total')::int) || '|' || max((t->>'total')::int) from (select tablero_tirar('d6') t from generate_series(1, 300)) q;")"
comprobar "dados Fudge entre -4 y 4" "t" "$(uno "$U1" "select bool_and((t->>'total')::int between -4 and 4) from (select tablero_tirar('4df') t from generate_series(1, 60)) q;")"
comprobar "éxitos: 5d6>4 cuenta los dados de 4 o más" "0" "$(uno "$U1" "select count(*) from (select tablero_tirar('5d6>4') t from generate_series(1, 40)) q where (t->>'total')::int <> (select count(*) from jsonb_array_elements_text(t->'partes'->0->'valores') v where v::int >= 4);")"
comprobar "un dado que explota tira otro al sacar el máximo" "0" "$(uno "$U1" "select count(*) from (select tablero_tirar('1d2!') t from generate_series(1, 60)) q where (select count(*) from jsonb_array_elements_text(t->'partes'->0->'valores')) <> 1 + (select count(*) from jsonb_array_elements_text(t->'partes'->0->'valores') with ordinality x(v, o) where o < (select count(*) from jsonb_array_elements_text(t->'partes'->0->'valores')) and v::int = 2);")"
comprobar "el que se acumula (!!) queda en un solo valor" "t" "$(uno "$U1" "select bool_and(jsonb_array_length(t->'partes'->0->'valores') = 1) from (select tablero_tirar('1d2!!') t from generate_series(1, 30)) q;")"
comprobar "restas y varios grupos" "ok" "$(uno "$U1" "select case when (t->>'total')::int between -2 and 15 then 'ok' else t::text end from tablero_tirar('2d6+1d4-3-1') t;")"
contiene "expresión rara" "$(como "$U1" "select tablero_tirar('1d20; drop table x');")" "Tirada no válida"
contiene "demasiados dados" "$(como "$U1" "select tablero_tirar('101d6');")" "100 dados"
contiene "dado de una cara" "$(como "$U1" "select tablero_tirar('1d1');")" "2 a 1000 caras"
contiene "quedarse con más de los que tiras" "$(como "$U1" "select tablero_tirar('2d20kh3');")" "más dados"
contiene "sin sesión no se tira" "$(anonimo "select tablero_tirar('1d20');")" "permission denied"
contiene "la función interna no se puede llamar" "$(como "$U1" "select tablero_i_tirar('1d20');")" "permission denied"
sql "truncate tablero_mensajes" >/dev/null
como "$U1" "select tablero_tirar('1d20', 'Sigilo', 'dj');" >/dev/null
comprobar "una tirada al DJ la ven quien tira y el GM, no los demás" "1|1|0" "$(uno "$U1" "select count(*) from tablero_mensajes;")|$(uno "$ADMIN" "select count(*) from tablero_mensajes;")|$(uno "$U2" "select count(*) from tablero_mensajes;")"
sql "truncate tablero_mensajes" >/dev/null
SEC=$(uno "$U1" "select tablero_tirar('1d20', 'Percepción', 'secreta');")
comprobar "una tirada secreta solo la ve el GM, ni quien tira, y no se le devuelve el resultado" "0|1|{\"secreta\": true}" "$(uno "$U1" "select count(*) from tablero_mensajes;")|$(uno "$ADMIN" "select count(*) from tablero_mensajes;")|$SEC"
contiene "modo inventado" "$(como "$U1" "select tablero_tirar('1d20', '', 'todos-menos-el-gm');")" "Modo no válido"

echo "== Chat"
sql "truncate tablero_mensajes" >/dev/null
como "$U1" "select tablero_decir('   ');" >/dev/null
comprobar "un mensaje vacío no se guarda" "0" "$(sql "select count(*) from tablero_mensajes")"
como "$U2" "select tablero_decir('Hola a todos');" >/dev/null
comprobar "los mensajes públicos los ven todos" "Hola a todos" "$(uno "$U1" "select texto from tablero_mensajes;")"
como "$U1" "select tablero_decir('Ataco con [[1d20+5]] y hago [[2d6+3]] de daño');" >/dev/null
comprobar "las tiradas en línea se resuelven en el servidor y se marcan en el texto" "Ataco con ⟦0⟧ y hago ⟦1⟧ de daño|2" "$(sql "select texto || '|' || jsonb_array_length(tirada->'enlinea') from tablero_mensajes order by id desc limit 1")"
como "$U1" "select tablero_decir('Solo para ti', 'susurro', 'Tres');" >/dev/null
comprobar "un susurro lo ven el destinatario, quien lo manda y el GM" "1|1|0|1" "$(uno "$U3" "select count(*) from tablero_mensajes where modo = 'susurro';")|$(uno "$U1" "select count(*) from tablero_mensajes where modo = 'susurro';")|$(uno "$U2" "select count(*) from tablero_mensajes where modo = 'susurro';")|$(uno "$ADMIN" "select count(*) from tablero_mensajes where modo = 'susurro';")"
contiene "susurro a alguien que no existe" "$(como "$U1" "select tablero_decir('hola', 'susurro', 'Nadie');")" "No encuentro"
como "$U1" "delete from tablero_mensajes;" >/dev/null
comprobar "el jugador no borra el chat" "3" "$(sql "select count(*) from tablero_mensajes")"

echo "== Diario"
P1=$(uno "$ADMIN" "insert into tablero_diario (tipo, nombre, controladores, ver) values ('personaje', 'Laia', array['$U1']::uuid[], array['$U1']::uuid[]) returning id;")
P2=$(uno "$ADMIN" "insert into tablero_diario (tipo, nombre) values ('personaje', 'Dexter') returning id;")
N1=$(uno "$ADMIN" "insert into tablero_diario (tipo, nombre, ver_todos) values ('nota', 'Mapa del laboratorio', true) returning id;")
como "$ADMIN" "insert into tablero_diario_gm (diario, texto) values ('$P2', 'Es el jefe final');" >/dev/null
comprobar "cada jugador ve sus personajes y las notas para todos, no lo oculto" "2|1|0" "$(uno "$U1" "select count(*) from tablero_diario;")|$(uno "$U2" "select count(*) from tablero_diario;")|$(uno "$U2" "select count(*) from tablero_diario_gm;")"
como "$U1" "select tablero_decir('Hola', 'todos', null, '$P1');" >/dev/null
comprobar "el jugador habla como su personaje" "Laia" "$(sql "select nombre from tablero_mensajes order by id desc limit 1")"
contiene "no habla como un personaje que no controla" "$(como "$U1" "select tablero_decir('Soy Dexter', 'todos', null, '$P2');")" "No puedes hablar como"
como "$U2" "select tablero_decir('a Laia', 'susurro', 'Laia');" >/dev/null
comprobar "un susurro a un personaje llega a quien lo controla" "1" "$(uno "$U1" "select count(*) from tablero_mensajes where texto = 'a Laia';")"
como "$U1" "update tablero_diario set nombre = 'X' where id = '$N1';" >/dev/null
comprobar "el jugador no edita el diario" "Mapa del laboratorio" "$(sql "select nombre from tablero_diario where id = '$N1'")"

echo "== Orden de turno"
como "$U1" "select tablero_tirar_iniciativa('$F1', 3);" >/dev/null
comprobar "la tirada de iniciativa entra en la lista" "1|Laia" "$(sql "select jsonb_array_length(iniciativa->'lista') || '|' || (iniciativa->'lista'->0->>'nombre') from tablero_estado")"
V=$(sql "select (iniciativa->'lista'->0->>'valor')::int from tablero_estado")
if [ "$V" -ge 4 ] && [ "$V" -le 23 ]; then ok "1d20+3 entre 4 y 23 ($V)"; else mal "iniciativa fuera de rango ($V)"; fi
como "$U1" "select tablero_tirar_iniciativa('$F1', 3);" >/dev/null
comprobar "volver a tirar no la duplica" "1" "$(sql "select jsonb_array_length(iniciativa->'lista') from tablero_estado")"
contiene "no tira por la ficha de otro" "$(como "$U1" "select tablero_tirar_iniciativa('$F2', 0);")" "no es tuya"
contiene "modificador absurdo" "$(como "$U1" "select tablero_tirar_iniciativa('$F1', 99);")" "Modificador no válido"
como "$ADMIN" "select tablero_tirar_iniciativa('$GM', 2); select tablero_tirar_iniciativa('$F2', 1);" >/dev/null
comprobar "el GM tira por cualquiera y la de la capa del DJ es secreta y va marcada oculta" "3|secreta|true" "$(sql "select jsonb_array_length(iniciativa->'lista') from tablero_estado")|$(sql "select modo from tablero_mensajes where tirada->>'etiqueta' = 'Iniciativa de Emboscada'")|$(sql "select e->>'oculto' from tablero_estado, jsonb_array_elements(iniciativa->'lista') e where e->>'nombre' = 'Emboscada'")"
comprobar "la lista queda ordenada de mayor a menor" "t" "$(sql "select bool_and(a >= b) from (select (e->>'valor')::int a, lead((e->>'valor')::int) over (order by o) b from jsonb_array_elements((select iniciativa->'lista' from tablero_estado)) with ordinality x(e, o)) q where b is not null")"
sql "update tablero_estado set iniciativa = jsonb_build_object('lista', jsonb_build_array(jsonb_build_object('id', '$F1', 'valor', 20), jsonb_build_object('id', '$F2', 'valor', 10), jsonb_build_object('id', '$GM', 'valor', 5)), 'turno', 0, 'ronda', 1)" >/dev/null
contiene "un jugador no pasa el turno de otro" "$(como "$U2" "select tablero_turno(1);")" "No es tu turno"
como "$U1" "select tablero_turno(1);" >/dev/null
comprobar "el jugador termina su turno" "1" "$(sql "select iniciativa->>'turno' from tablero_estado")"
contiene "un jugador no retrocede el turno" "$(como "$U2" "select tablero_turno(-1);")" "No es tu turno"
como "$ADMIN" "select tablero_turno(1); select tablero_turno(1);" >/dev/null
comprobar "al dar la vuelta sube la ronda" "0|2" "$(sql "select (iniciativa->>'turno') || '|' || (iniciativa->>'ronda') from tablero_estado")"
como "$ADMIN" "select tablero_turno(-1);" >/dev/null
comprobar "el GM retrocede y la ronda vuelve" "2|1" "$(sql "select (iniciativa->>'turno') || '|' || (iniciativa->>'ronda') from tablero_estado")"

como "$U1" "select tablero_iniciativa_valor('$F1', 17);" >/dev/null
comprobar "el jugador cambia el número de iniciativa de su ficha" "17" "$(sql "select e->>'valor' from tablero_estado, jsonb_array_elements(iniciativa->'lista') e where e->>'id' = '$F1'")"
contiene "no cambia el de una ficha ajena" "$(como "$U1" "select tablero_iniciativa_valor('$F2', 30);")" "no es tuya"
contiene "ni el de una ficha que no está en el orden" "$(como "$U1" "select tablero_iniciativa_valor('$FB', 3);")" "no está en el orden"

echo "== Pausar el movimiento"
como "$ADMIN" "update tablero_estado set pausa = true where id = 1;" >/dev/null
contiene "con el movimiento pausado el jugador no mueve" "$(como "$U1" "select tablero_mover('$F1', 210, 210);")" "pausado el movimiento"
como "$ADMIN" "select tablero_mover('$F1', 210, 210);" >/dev/null
comprobar "el GM sí mueve con la pausa puesta" "210" "$(sql "select x from tablero_objetos where id = '$F1'")"
como "$ADMIN" "update tablero_estado set pausa = false where id = 1;" >/dev/null
como "$U1" "select tablero_mover('$F1', 280, 280);" >/dev/null
comprobar "al quitar la pausa vuelve a mover" "280" "$(sql "select x from tablero_objetos where id = '$F1'")"
como "$ADMIN" "insert into tablero_objetos (escena, capa, tipo, datos) values ('$S1', 'fichas', 'pin', '{\"titulo\": \"Puerta\"}');" >/dev/null
comprobar "se pueden poner pines en el mapa" "1" "$(sql "select count(*) from tablero_objetos where tipo = 'pin'")"

echo "== Arte y macros"
como "$ADMIN" "insert into tablero_arte (src, nombre) values ('x.png', 'Mapa');" >/dev/null
comprobar "la biblioteca de arte es solo del GM" "0|1" "$(uno "$U1" "select count(*) from tablero_arte;")|$(uno "$ADMIN" "select count(*) from tablero_arte;")"
como "$U1" "insert into tablero_macros (nombre, texto) values ('Ataque', '/r 1d20+5');" >/dev/null
comprobar "cada jugador ve solo sus macros" "1|0" "$(uno "$U1" "select count(*) from tablero_macros;")|$(uno "$U2" "select count(*) from tablero_macros;")"
contiene "no crea macros a nombre de otro" "$(como "$U2" "insert into tablero_macros (autor, nombre) values ('$U1', 'X');")" "row-level security"

echo "== Cambiar la escena de los jugadores"
como "$ADMIN" "update tablero_estado set escena_jugadores = '$S2' where id = 1;" >/dev/null
comprobar "al cambiar de escena el jugador ve solo la nueva" "1|Laia2" "$(uno "$U1" "select count(*) from tablero_objetos;")|$(uno "$U1" "select datos->>'nombre' from tablero_objetos;")"
contiene "y ya no mueve fichas de la escena anterior" "$(como "$U1" "select tablero_mover('$F1', 1, 1);")" "No puedes mover esa ficha"
como "$U1" "select tablero_mover('$OTRA', 70, 70);" >/dev/null
comprobar "sí mueve la suya de la escena nueva" "70" "$(sql "select x from tablero_objetos where id = '$OTRA'")"
como "$ADMIN" "delete from tablero_escenas where id = '$S2';" >/dev/null
comprobar "borrar la escena borra sus objetos y deja el estado sin escena" "0|" "$(sql "select count(*) from tablero_objetos where escena = '$S2'")|$(sql "select coalesce(escena_jugadores::text, '') from tablero_estado")"

echo
if [ "$FALLOS" -eq 0 ]; then echo "Todo bien."; else echo "$FALLOS fallo(s)."; exit 1; fi
