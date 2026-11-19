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
comprobar "las trece tablas existen" "13" "$(sql "select count(*) from pg_tables where tablename like 'tablero\_%'")"
comprobar "hay una sola fila de estado" "1" "$(sql "select count(*) from tablero_estado")"
comprobar "el estado guarda el orden de las carpetas del diario y del arte" "[]|[]" "$(sql "select carpetas::text || '|' || carpetas_arte::text from tablero_estado")"

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

echo "== Solo con side"
sql "update perfiles set side = null where user_id = '$U4'" >/dev/null
comprobar "sin side no ve escenas, fichas, estado ni chat" "0|0|0|0" "$(uno "$U4" "select count(*) from tablero_escenas;")|$(uno "$U4" "select count(*) from tablero_objetos;")|$(uno "$U4" "select count(*) from tablero_estado;")|$(uno "$U4" "select count(*) from tablero_mensajes;")"
contiene "sin side no escribe ni tira" "$(como "$U4" "select tablero_tirar('1d20');")" "necesitas tener un side"
sql "update perfiles set side = 'B' where user_id = '$U4'" >/dev/null
comprobar "con side, sí" "1" "$(uno "$U4" "select count(*) from tablero_escenas;")"

echo "== El jugador ajusta su ficha"
como "$U1" "select tablero_ajustar_propio('$F1', '{\"nombre\": \"Laia la Rápida\", \"verNombre\": true, \"barraPos\": \"debajo\", \"auras\": [{\"radio\": 999, \"color\": \"red\", \"forma\": \"cuadrado\"}], \"cambiaformas\": true, \"vision\": {\"oscuridad\": 999}, \"src\": \"https://malo.com/x.png\"}');" >/dev/null
comprobar "cambia nombre, barras y auras (con límites) y nada más" "Laia la Rápida|true|debajo|120|#ffff99|cuadrado|||" "$(sql "select (datos ->> 'nombre') || '|' || (datos ->> 'verNombre') || '|' || (datos ->> 'barraPos') || '|' || (datos -> 'auras' -> 0 ->> 'radio') || '|' || (datos -> 'auras' -> 0 ->> 'color') || '|' || (datos -> 'auras' -> 0 ->> 'forma') || '|' || coalesce(datos ->> 'cambiaformas', '') || '|' || coalesce(datos -> 'vision' ->> 'oscuridad', '') || '|' || case when datos ->> 'src' = 'https://malo.com/x.png' then 'malo' else '' end from tablero_objetos where id = '$F1'")"
contiene "no ajusta la ficha de otro" "$(como "$U2" "select tablero_ajustar_propio('$F1', '{\"nombre\": \"X\"}');")" "no es tuya"
como "$U1" "select tablero_ajustar_propio('$F1', '{\"voltearH\": true, \"sinAjuste\": true, \"sinMenu\": true, \"grupo\": \"g1\", \"ancho\": 99999, \"alto\": 2}');" >/dev/null
comprobar "transformación avanzada: giros, ajuste, menús, grupo y dimensiones con tope" "true|true|true|g1|1400|10" "$(sql "select (datos ->> 'voltearH') || '|' || (datos ->> 'sinAjuste') || '|' || (datos ->> 'sinMenu') || '|' || (datos ->> 'grupo') || '|' || ancho || '|' || alto from tablero_objetos where id = '$F1'")"
como "$U1" "select tablero_ajustar_propio('$F1', '{\"grupo\": null, \"voltearH\": \"sí\", \"ancho\": 70, \"alto\": 70}');" >/dev/null
comprobar "desagrupa y no acepta un giro que no sea sí o no" "|true|70" "$(sql "select coalesce(datos ->> 'grupo', '') || '|' || (datos ->> 'voltearH') || '|' || ancho from tablero_objetos where id = '$F1'")"
sql "update tablero_objetos set datos = datos - 'voltearH' - 'sinAjuste' - 'sinMenu' where id = '$F1'" >/dev/null
sql "update tablero_objetos set datos = (datos || '{\"nombre\": \"Laia\"}') - 'auras' - 'verNombre' - 'barraPos' where id = '$F1'" >/dev/null

echo "== Imágenes propias en el tablero"
IMG=$(como "$U1" "select tablero_crear_propio('$S1', 'imagen', 100, 100, 70, 70, '{\"src\": \"https://x.com/lobo.png\", \"nombre\": \"Lobo\", \"cambiaformas\": true, \"barras\": [{\"valor\": 99}]}');" | tail -1)
comprobar "el jugador pone una imagen suya y solo se guardan la imagen y el nombre" "imagen|fichas|https://x.com/lobo.png|Lobo||" "$(sql "select tipo || '|' || capa || '|' || (datos ->> 'src') || '|' || (datos ->> 'nombre') || '|' || coalesce(datos ->> 'cambiaformas', '') || '|' || coalesce(datos ->> 'barras', '') from tablero_objetos where id = '$IMG'")"
contiene "solo imágenes https" "$(como "$U1" "select tablero_crear_propio('$S1', 'imagen', 1, 1, 70, 70, '{\"src\": \"data:image/png;base64,AAAA\"}');")" "no vale"
sql "delete from tablero_objetos where id = '$IMG'" >/dev/null

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
contiene "no crea otra cosa que dibujos, texto o imágenes" "$(como "$U1" "select tablero_crear_propio('$S1', 'pin', 0, 0, 10, 10, '{}');")" "Solo puedes dibujar"
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

echo "== Iluminación dinámica"
MURO=$(como "$ADMIN" "insert into tablero_objetos (escena, capa, tipo, datos) values ('$S1', 'luz', 'dibujo', '{\"muro\": \"puerta\", \"puntos\": [0, 0, 70, 0]}') returning id;" | head -1)
como "$ADMIN" "insert into tablero_objetos (escena, capa, tipo, datos) values ('$S1', 'luz', 'luz', '{\"luz\": {\"brillante\": 20, \"tenue\": 20}}');" >/dev/null
comprobar "el DJ pone muros y luces en la capa de iluminación" "2" "$(sql "select count(*) from tablero_objetos where capa = 'luz'")"
comprobar "el jugador los lee (su navegador calcula lo que ve)" "2" "$(uno "$U1" "select count(*) from tablero_objetos where capa = 'luz';")"
como "$U1" "update tablero_objetos set datos = jsonb_set(datos, '{abierta}', 'true') where id = '$MURO';" >/dev/null
comprobar "el jugador no abre puertas ni toca muros" "" "$(sql "select datos ->> 'abierta' from tablero_objetos where id = '$MURO'")"
contiene "el jugador no crea luces" "$(como "$U1" "insert into tablero_objetos (escena, capa, tipo) values ('$S1', 'luz', 'luz');")" "row-level security"
comprobar "el jugador abre una puerta con su tirador" "t|true" "$(uno "$U1" "select tablero_puerta('$MURO');")|$(sql "select datos ->> 'abierta' from tablero_objetos where id = '$MURO'")"
como "$ADMIN" "update tablero_objetos set datos = datos || '{\"llave\": true}' where id = '$MURO';" >/dev/null
contiene "con llave no la abre" "$(como "$U1" "select tablero_puerta('$MURO');")" "cerrada con llave"
contiene "un muro no es una puerta" "$(como "$U1" "select tablero_puerta('$F1');")" "no es una puerta"

echo "== Marcadores de estado"
como "$U1" "select tablero_estados('$F1', '[{\"id\": \"envenenado\"}, {\"id\": \"agotamiento\", \"n\": 2}]');" >/dev/null
comprobar "el jugador marca estados en su ficha" "envenenado|2" "$(sql "select (datos -> 'estados' -> 0 ->> 'id') || '|' || (datos -> 'estados' -> 1 ->> 'n') from tablero_objetos where id = '$F1'")"
contiene "no en la ficha de otro" "$(como "$U2" "select tablero_estados('$F1', '[]');")" "no es tuya"
contiene "solo una lista" "$(como "$U1" "select tablero_estados('$F1', '{}');")" "no válidos"
comprobar "y no toca nada más de la ficha" "Laia" "$(sql "select datos ->> 'nombre' from tablero_objetos where id = '$F1'")"
contiene "un estado de otro personaje no se lo pone el jugador" "$(como "$U1" "select tablero_estados('$F1', '[{\"id\": \"casteo_notas\"}]');")" "de otro personaje"
como "$ADMIN" "update tablero_objetos set datos = jsonb_set(datos, '{estados}', '[{\"id\": \"fumando\"}]') where id = '$F1';" >/dev/null
como "$U1" "select tablero_estados('$F1', '[{\"id\": \"fumando\"}, {\"id\": \"derribado\"}]');" >/dev/null
comprobar "pero puede dejar el que le puso el DJ y añadir condiciones" "fumando|derribado" "$(sql "select (datos -> 'estados' -> 0 ->> 'id') || '|' || (datos -> 'estados' -> 1 ->> 'id') from tablero_objetos where id = '$F1'")"
sql "update tablero_objetos set datos = datos || '{\"nombre\": \"Ryn Feycrown\"}' where id = '$F1'" >/dev/null
como "$U1" "select tablero_estados('$F1', '[{\"id\": \"casteo_notas\"}]');" >/dev/null
comprobar "el de su personaje sí" "casteo_notas" "$(sql "select datos -> 'estados' -> 0 ->> 'id' from tablero_objetos where id = '$F1'")"
contiene "y el de otro no aunque tenga el suyo" "$(como "$U1" "select tablero_estados('$F1', '[{\"id\": \"casteo_notas\"}, {\"id\": \"furia_salvaje\"}]');")" "de otro personaje"
contiene "el estado de dar de Cassius no se lo pone Ryn a sí misma" "$(como "$U1" "select tablero_estados('$F1', '[{\"id\": \"casteo_notas\"}, {\"id\": \"raudo\"}]');")" "de otro personaje"
como "$U1" "select tablero_dar_estado('$F2', 'inspiracion_bardica', true, 6);" >/dev/null
comprobar "Ryn da Inspiración bárdica a la ficha de otro jugador" "inspiracion_bardica|6" "$(sql "select (datos -> 'estados' -> 0 ->> 'id') || '|' || (datos -> 'estados' -> 0 ->> 'n') from tablero_objetos where id = '$F2'")"
contiene "pero no da los de otro personaje" "$(como "$U1" "select tablero_dar_estado('$F2', 'raudo', true);")" "de otro personaje"
contiene "ni cualquier estado" "$(como "$U1" "select tablero_dar_estado('$F2', 'derribado', true);")" "no se puede dar"
como "$U1" "select tablero_dar_estado('$F2', 'inspiracion_bardica', false);" >/dev/null
comprobar "y la quita" "0" "$(sql "select jsonb_array_length(coalesce(datos -> 'estados', '[]')) from tablero_objetos where id = '$F2'")"
contiene "otro jugador sin ese personaje no la da" "$(como "$U3" "select tablero_dar_estado('$F1', 'heroismo', true);")" "de otro personaje"
sql "update tablero_objetos set datos = (datos || '{\"nombre\": \"Laia\"}') - 'estados' where id = '$F1'" >/dev/null

echo "== Copiar apariencias"
contiene "sin permiso del DJ no cambia de aspecto" "$(como "$U1" "select tablero_apariencia('$F1', '{\"src\": \"https://x.com/lobo.png\", \"nombre\": \"Lobo\"}');")" "no puede cambiar"
sql "update tablero_objetos set datos = datos || '{\"cambiaformas\": true, \"src\": \"https://x.com/laia.png\"}' where id = '$F1'" >/dev/null
como "$U1" "select tablero_apariencia('$F1', '{\"src\": \"https://x.com/lobo.png\", \"nombre\": \"Lobo\", \"verNombre\": true}');" >/dev/null
comprobar "con permiso toma el aspecto copiado" "https://x.com/lobo.png|Lobo|true" "$(sql "select (datos ->> 'src') || '|' || (datos ->> 'nombre') || '|' || (datos ->> 'verNombre') from tablero_objetos where id = '$F1'")"
como "$U1" "select tablero_apariencia('$F1', '{\"src\": \"https://x.com/oso.png\", \"nombre\": \"Oso\"}');" >/dev/null
como "$U1" "select tablero_apariencia('$F1', null);" >/dev/null
comprobar "y vuelve a su aspecto original aunque copie dos veces" "https://x.com/laia.png|Laia|" "$(sql "select (datos ->> 'src') || '|' || (datos ->> 'nombre') || '|' || coalesce(datos ->> 'disfraz', '') from tablero_objetos where id = '$F1'")"
contiene "otro jugador no cambia su aspecto" "$(como "$U2" "select tablero_apariencia('$F1', null);")" "no es tuya"
contiene "solo imágenes https o del sitio" "$(como "$U1" "select tablero_apariencia('$F1', '{\"src\": \"javascript:alert(1)\"}');")" "no válida"
sql "delete from tablero_apariencias" >/dev/null
como "$U1" "insert into tablero_apariencias (nombre, datos) values ('Lobo', '{\"src\": \"https://x.com/lobo.png\"}');" >/dev/null
comprobar "la biblioteca de apariencias es solo de su dueño" "1|0" "$(uno "$U1" "select count(*) from tablero_apariencias;")|$(uno "$U2" "select count(*) from tablero_apariencias;")"

echo "== Perfil y GIFs"
sql "delete from tablero_perfil; delete from tablero_gifs" >/dev/null
como "$U1" "insert into tablero_perfil (avatar) values ('https://ejemplo.com/yo.png');" >/dev/null
comprobar "cada uno pone su avatar y lo ven los demás" "https://ejemplo.com/yo.png" "$(uno "$U2" "select avatar from tablero_perfil where uid = '$U1';")"
como "$U2" "update tablero_perfil set avatar = 'https://malo.com/x.png' where uid = '$U1';" >/dev/null
comprobar "nadie cambia el avatar de otro" "https://ejemplo.com/yo.png" "$(sql "select avatar from tablero_perfil where uid = '$U1'")"
contiene "el avatar tiene que ser un enlace https" "$(como "$U2" "insert into tablero_perfil (avatar) values ('javascript:alert(1)');")" "check"
como "$U1" "update tablero_perfil set color = '#12ab34' where uid = '$U1';" >/dev/null
comprobar "cada uno elige su color y lo ven los demás" "#12ab34" "$(uno "$U2" "select color from tablero_perfil where uid = '$U1';")"
contiene "el color tiene que ser #rrggbb" "$(como "$U1" "update tablero_perfil set color = 'red; x' where uid = '$U1';")" "check"
como "$U1" "select tablero_decir('hola', 'todos', null, null);" >/dev/null
comprobar "el chat usa el avatar de quien escribe" "https://ejemplo.com/yo.png" "$(sql "select avatar from tablero_mensajes order by id desc limit 1")"
como "$U1" "insert into tablero_gifs (url, nombre) values ('https://media.tenor.com/a.gif', 'gato');" >/dev/null
comprobar "los GIFs favoritos son solo de su dueño" "1|0" "$(uno "$U1" "select count(*) from tablero_gifs;")|$(uno "$U2" "select count(*) from tablero_gifs;")"
contiene "sin sesión no se ve nada" "$(anonimo "select count(*) from tablero_perfil;")" "denied"

echo "== Arte y macros"
como "$ADMIN" "insert into tablero_arte (src, nombre) values ('x.png', 'Mapa');" >/dev/null
comprobar "la biblioteca de arte es solo del GM" "0|1" "$(uno "$U1" "select count(*) from tablero_arte;")|$(uno "$ADMIN" "select count(*) from tablero_arte;")"
como "$U1" "insert into tablero_arte (src, nombre) values ('https://x.com/mio.png', 'Mío');" >/dev/null
comprobar "cada jugador tiene su biblioteca: ve la suya y no la de otros ni la del DJ" "1|Mío|0" "$(uno "$U1" "select count(*) from tablero_arte;")|$(uno "$U1" "select nombre from tablero_arte;")|$(uno "$U2" "select count(*) from tablero_arte;")"
contiene "no sube a nombre de otro" "$(como "$U2" "insert into tablero_arte (autor, src) values ('$U1', 'https://x.com/a.png');")" "row-level security"
contiene "solo enlaces https" "$(como "$U2" "insert into tablero_arte (src) values ('javascript:alert(1)');")" "row-level security"
como "$U2" "delete from tablero_arte;" >/dev/null
comprobar "y no borra la de otros" "2" "$(sql "select count(*) from tablero_arte")"
sql "delete from tablero_arte where autor = '$U1'" >/dev/null
como "$ADMIN" "update tablero_arte set carpeta = 'Mapas/Cuevas';" >/dev/null
comprobar "el arte se guarda en carpetas" "Mapas/Cuevas" "$(sql "select carpeta from tablero_arte limit 1")"
como "$U1" "insert into tablero_macros (nombre, texto) values ('Ataque', '/r 1d20+5');" >/dev/null
comprobar "cada jugador ve solo sus macros" "1|0" "$(uno "$U1" "select count(*) from tablero_macros;")|$(uno "$U2" "select count(*) from tablero_macros;")"
contiene "no crea macros a nombre de otro" "$(como "$U2" "insert into tablero_macros (autor, nombre) values ('$U1', 'X');")" "row-level security"

echo "== Tablas aleatorias"
sql "delete from tablero_tablas" >/dev/null
T1=$(como "$ADMIN" "insert into tablero_tablas (nombre, filas) values ('Botín', '[{\"texto\": \"Poción\", \"peso\": 3}, {\"texto\": \"Espada\"}, {\"texto\": \"  \"}]') returning id;" | head -1)
T2=$(como "$ADMIN" "insert into tablero_tablas (nombre, filas, ver_todos) values ('Nombres', '[{\"texto\": \"Ana\"}]', true) returning id;" | head -1)
T3=$(como "$ADMIN" "insert into tablero_tablas (nombre, ver_todos) values ('Vacía', true) returning id;" | head -1)
comprobar "el jugador ve solo las tablas que el DJ comparte" "2|Nombres" "$(uno "$U1" "select count(*) from tablero_tablas;")|$(uno "$U1" "select nombre from tablero_tablas order by nombre limit 1;")"
contiene "el jugador no crea tablas" "$(como "$U1" "insert into tablero_tablas (nombre) values ('X');")" "row-level security"
como "$U1" "update tablero_tablas set ver_todos = true where id = '$T1';" >/dev/null
comprobar "ni cambia las del DJ" "f" "$(sql "select ver_todos from tablero_tablas where id = '$T1'")"
contiene "dos tablas no se llaman igual" "$(como "$ADMIN" "insert into tablero_tablas (nombre) values ('botín ');")" "duplicate"
como "$U1" "select tablero_tirar_tabla('$T2');" >/dev/null
comprobar "el jugador tira una tabla compartida y sale en el chat" "Ana|Nombres|1|1" "$(sql "select (tirada->'tabla'->>'texto') || '|' || (tirada->'tabla'->>'nombre') || '|' || (tirada->>'total') || '|' || (tirada->'tabla'->>'de') from tablero_mensajes order by id desc limit 1")"
contiene "no tira una tabla que no ve" "$(como "$U1" "select tablero_tirar_tabla('$T1');")" "no existe"
contiene "una tabla vacía no se tira" "$(como "$U1" "select tablero_tirar_tabla('$T3');")" "vacía"
contiene "sin sesión no se tira" "$(anonimo "select tablero_tirar_tabla('$T2');")" "permission denied"
como "$ADMIN" "select count(tablero_tirar_tabla('$T1', 'secreta')) from generate_series(1, 400);" >/dev/null
comprobar "el peso cuenta (3 a 1) y las filas en blanco no salen" "true|0|4" "$(sql "select (count(*) filter (where tirada->'tabla'->>'texto' = 'Poción') > 2 * count(*) filter (where tirada->'tabla'->>'texto' = 'Espada'))::text from tablero_mensajes where tirada->'tabla'->>'nombre' = 'Botín'")|$(sql "select count(*) from tablero_mensajes where tirada->'tabla'->>'nombre' = 'Botín' and tirada->'tabla'->>'texto' not in ('Poción', 'Espada')")|$(sql "select distinct tirada->'tabla'->>'de' from tablero_mensajes where tirada->'tabla'->>'nombre' = 'Botín'")"
comprobar "las tiradas secretas del DJ no las ve el jugador" "0" "$(uno "$U1" "select count(*) from tablero_mensajes where tirada->'tabla'->>'nombre' = 'Botín';")"

echo "== Salvaciones contra la muerte"
sql "create table if not exists fichas_personajes (id uuid primary key default gen_random_uuid(), owner_id uuid not null, archivado boolean not null default false, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), roll20 jsonb)" >/dev/null
FP=$(sql "insert into fichas_personajes (owner_id, data) values ('$U1', '{\"combate\": {\"pvActual\": 0, \"pvMax\": 20}}') returning id")
FS=$(sql "insert into fichas_personajes (owner_id, data) values ('$U1', '{\"identidad\": {\"nombre\": \"Sin combate\"}}') returning id")
como "$U1" "select tablero_ficha_muerte('$FP', 1, 2);" >/dev/null
comprobar "el dueño apunta éxitos y fallos en su hoja" '{"exitos": 1, "fallos": 2}' "$(sql "select data->'combate'->'salvMuerte' from fichas_personajes where id = '$FP'")"
contiene "otro jugador no toca esa hoja" "$(como "$U2" "select tablero_ficha_muerte('$FP', 3, 0);")" "no es tuya"
como "$ADMIN" "select tablero_ficha_muerte('$FP', 9, -4);" >/dev/null
comprobar "el DJ también, y los valores quedan entre 0 y 3" '{"exitos": 3, "fallos": 0}' "$(sql "select data->'combate'->'salvMuerte' from fichas_personajes where id = '$FP'")"
comprobar "el resto de la hoja no cambia" "0|20" "$(sql "select (data->'combate'->>'pvActual') || '|' || (data->'combate'->>'pvMax') from fichas_personajes where id = '$FP'")"
como "$U1" "select tablero_ficha_muerte('$FS', 0, 1);" >/dev/null
comprobar "una hoja sin combate lo crea" '1|Sin combate' "$(sql "select (data->'combate'->'salvMuerte'->>'fallos') || '|' || (data->'identidad'->>'nombre') from fichas_personajes where id = '$FS'")"
sql "delete from fichas_personajes where id in ('$FP', '$FS')" >/dev/null

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
