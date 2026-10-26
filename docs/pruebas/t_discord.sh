#!/bin/sh
# Integración con Discord (docs/discord.sql): vinculación de cuentas con código de un solo uso, límites, privacidad y consultas del bot.
# Uso: BD=discord sh docs/pruebas/cargar_local.sh todo && BD=discord sh docs/pruebas/t_discord.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BD:-pruebas}"
corre() { docker exec -i cartas-pruebas psql -U postgres -d "$BASE" -q -v ON_ERROR_STOP=1 < "$1" >/dev/null || { echo "No corrió $1"; exit 1; }; }
corre "$DOCS/admin/side_excepciones.sql"
corre "$DOCS/admin/regalos_eventos.sql"
# Tablas de producción que la base local no trae: solo lo que las consultas leen
sql "create table if not exists mj_estadisticas (user_id uuid, juego text, clave text, username text, partidas int default 0, victorias int default 0, derrotas int default 0, tablas int default 0, suma jsonb, maximo jsonb, minimo jsonb, updated_at timestamptz default now());
     create table if not exists hooey_puntajes (user_id uuid primary key, username text, total bigint default 0, mejor_racha int default 0, updated_at timestamptz default now());
     create table if not exists hipodromo_calendario (n int primary key, datos jsonb);
     delete from mj_estadisticas; delete from hooey_puntajes; delete from hipodromo_calendario;" >/dev/null
corre "$DOCS/discord.sql"
corre "$DOCS/discord.sql"   # se puede repetir
echo "(discord.sql corre dos veces sin error)"
sql "truncate discord_vinculos, discord_codigos, discord_intentos;" >/dev/null
sql "update perfiles set side = 'A' where user_id in ('$U1', '$U2'); update perfiles set side = 'B' where user_id in ('$U3', '$U4'); delete from side_excepciones;" >/dev/null
D1=111111111111111111
D2=222222222222222222
D3=333333333333333333
codigo() { como "$1" "select discord_crear_codigo() ->> 'codigo';" | tail -1; }
vinc() { servicio "select discord_i_vincular('$1', '$2', '$3');"; }

echo "== Crear códigos"
C1=$(codigo $U1)
if printf '%s' "$C1" | grep -qE '^[A-HJ-NP-Z2-9]{8}$'; then ok "el código tiene 8 letras y números sin símbolos confusos"; else mal "el código no tiene el formato esperado: $C1"; fi
comprobar "en la base solo está el hash, no el código" "0" "$(sql "select count(*) from discord_codigos where codigo_hash = '$C1'")"
comprobar "y el hash corresponde a ese código" "1" "$(sql "select count(*) from discord_codigos where codigo_hash = encode(sha256('$C1'::bytea), 'hex')")"
contiene "sin sesión no se puede pedir un código" "$(anonimo "select discord_crear_codigo();")" "permission denied"
contiene "un jugador no puede leer los códigos de la tabla" "$(como $U2 "select count(*) from discord_codigos;")" "permission denied"
contiene "ni las funciones del servidor" "$(como $U1 "select discord_i_perfil('$D1');")" "permission denied"
contiene "ni vincular a mano" "$(como $U1 "select discord_i_vincular('$C1', '$D1', 'x');")" "permission denied"
C1b=$(codigo $U1)
contiene "un código nuevo invalida al anterior" "$(vinc "$C1" $D1 x)" "no es válido"
sql "delete from discord_intentos" >/dev/null
for i in 1 2 3; do codigo $U1 >/dev/null; done
contiene "pedir demasiados códigos se frena (5 por hora)" "$(como $U1 "select discord_crear_codigo();")" "demasiados códigos"
sql "truncate discord_codigos" >/dev/null

echo "== Vincular"
C1=$(codigo $U1)
contiene "un código con espacios y minúsculas también vale" "$(vinc "$(printf '%s' "$C1" | tr 'A-Z' 'a-z' | sed 's/\(....\)\(....\)/\1 - \2/')" $D1 'Uno#0')" '"usuario": "Uno"'
comprobar "queda una vinculación" "$D1" "$(sql "select discord_id from discord_vinculos where user_id = '$U1'")"
contiene "el código ya no sirve" "$(vinc "$C1" $D2 x)" "no es válido"
contiene "una web ya vinculada no pide otro código" "$(como $U1 "select discord_crear_codigo();")" "ya está vinculada"
contiene "el estado de la vinculación sale en la web" "$(como $U1 "select discord_estado();")" '"vinculada": true'
contiene "y quien no está vinculado lo ve" "$(como $U2 "select discord_estado();")" '"vinculada": false'
C2=$(codigo $U2)
contiene "una cuenta de Discord no se vincula a dos jugadores" "$(vinc "$C2" $D1 x)" "ya está vinculada a un jugador"
comprobar "y el código de U2 sigue sin gastar" "1" "$(sql "select count(*) from discord_codigos where user_id = '$U2' and usado is null")"
contiene "un código que no existe" "$(vinc 'ZZZZZZZZ' $D3 x)" "no es válido"
sql "update discord_codigos set expira = now() - interval '1 minute' where user_id = '$U2'" >/dev/null
contiene "un código caducado no vale" "$(vinc "$C2" $D2 x)" "no es válido o ya caducó"
contiene "un identificador de Discord raro se rechaza" "$(vinc "$C2" "abc" x)" "No pude identificar"
C2=$(codigo $U2)
for i in 1 2 3 4 5; do vinc "QQQQQQQ$i" $D3 x >/dev/null; done
contiene "tras 5 intentos fallidos se bloquea esa cuenta de Discord" "$(vinc "$C2" $D3 x)" "Demasiados intentos"
comprobar "aunque el código sea bueno, no se gasta" "1" "$(sql "select count(*) from discord_codigos where user_id = '$U2' and usado is null and expira > now()")"
sql "delete from discord_intentos" >/dev/null
contiene "pasado el bloqueo se vincula" "$(vinc "$C2" $D3 'Dos#0')" '"usuario": "Dos"'

echo "== Desvincular"
como $U2 "select discord_desvincular();" >/dev/null
comprobar "desde la web se quita la vinculación" "0" "$(sql "select count(*) from discord_vinculos where user_id = '$U2'")"
C2=$(codigo $U2)
vinc "$C2" $D3 'Dos#0' >/dev/null
comprobar "desde Discord también" "t" "$(servicio "select discord_i_desvincular('$D3');" | tail -1)"
comprobar "y si no estaba vinculada dice que no" "f" "$(servicio "select discord_i_desvincular('$D3');" | tail -1)"
comprobar "quien no tiene sesión no puede desvincular" "1" "$(anonimo "select discord_desvincular();" | grep -c 'permission denied')"

echo "== /perfil"
contiene "sin vincular no hay perfil" "$(servicio "select discord_i_perfil('$D3');")" "Primero vincula"
sql "insert into mj_estadisticas (user_id, juego, clave, username, partidas, victorias, derrotas, tablas) values ('$U1', 'ajedrez', 'a', 'Uno', 10, 6, 3, 1), ('$U1', 'ajedrez', 'b', 'Uno', 4, 1, 3, 0), ('$U2', 'ajedrez', 'a', 'Dos', 8, 5, 3, 0), ('$U1', 'arqueria', 'a', 'Uno', 5, 4, 1, 0);
     insert into hooey_puntajes (user_id, username, total, mejor_racha) values ('$U1', 'Uno', 120, 5), ('$U2', 'Dos', 300, 9), ('$U3', 'Tres', 50, 2);" >/dev/null
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 77) on conflict (usuario) do update set saldo = 77" >/dev/null
P=$(servicio "select discord_i_perfil('$D1');")
contiene "el perfil es el de su dueña" "$P" '"usuario": "Uno"'
contiene "suma las partidas de ajedrez (10 + 4)" "$P" '"partidas": 14'
contiene "los tokens del Hipódromo salen a cualquier jugador" "$P" '"tokens": 77'
nocontiene "no mezcla datos de otra persona" "$P" "Dos"
contiene "los puntos de Hooey son los suyos" "$P" '"total": 120'
sql "insert into mj_estadisticas (user_id, juego, clave, username, partidas, victorias) values ('$U1', 'duelo', 'a', 'Uno', 3, 3)" >/dev/null
nocontiene "un juego oculto (el Duelo) no sale en el perfil" "$(servicio "select discord_i_perfil('$D1');")" "duelo"
contiene "ni se puede pedir su clasificación" "$(servicio "select discord_i_clasificacion('duelo');")" "no existe"

echo "== /clasificacion"
R=$(servicio "select discord_i_clasificacion('hooey');")
contiene "Hooey ordena de más a menos" "$R" '"usuario": "Dos"'
comprobar "y el primero es el de más puntos" "Dos" "$(servicio "select (discord_i_clasificacion('hooey') -> 0 ->> 'usuario');" | tail -1)"
comprobar "ajedrez suma las victorias de cada jugador (7 y 5)" "7|5" "$(servicio "select (discord_i_clasificacion('ajedrez') -> 0 ->> 'puntos') || '|' || (discord_i_clasificacion('ajedrez') -> 1 ->> 'puntos')" | tail -1)"
contiene "una clasificación inventada se rechaza" "$(servicio "select discord_i_clasificacion('x; drop table perfiles');")" "no existe"
comprobar "las tablas siguen en su sitio" "1" "$(sql "select count(*) from perfiles where user_id = '$U1'")"

echo "== /cartas (publicadas y por lado)"
sql "insert into cartas_catalogo (id, rareza, lado, publicada, tipo) values ('t-rata', 'comun', null, true, 'Criatura'), ('t-sombra-a', 'rara', '{A}', true, 'Personaje'), ('t-sombra-b', 'rara', '{B}', true, 'Personaje'), ('t-borrador', 'comun', null, false, 'Criatura') on conflict (id) do update set lado = excluded.lado, publicada = excluded.publicada;
     insert into cartas_definiciones (id, data) values ('t-rata', '{\"nombre\":\"Rata gris\",\"tipo\":\"Criatura\",\"coste\":1,\"atq\":1,\"pv\":1}'), ('t-sombra-a', '{\"nombre\":\"Rata del lado A\",\"tipo\":\"Personaje\"}'), ('t-sombra-b', '{\"nombre\":\"Rata del lado B\",\"tipo\":\"Personaje\"}'), ('t-borrador', '{\"nombre\":\"Rata sin publicar\",\"tipo\":\"Criatura\"}') on conflict (id) do update set data = excluded.data;" >/dev/null
vinc "$(codigo $U1)" $D1 'Uno#0' >/dev/null 2>&1 || true
C3=$(codigo $U3); vinc "$C3" $D3 'Tres#0' >/dev/null
contiene "una carta pública sale" "$(servicio "select discord_i_cartas('$D1', 'rata');")" "Rata gris"
nocontiene "una carta sin publicar no sale" "$(servicio "select discord_i_cartas('$D1', 'rata');")" "sin publicar"
A=$(servicio "select discord_i_cartas('$D1', 'rata');")
contiene "la de su lado sí (jugador del Side A)" "$A" "lado A"
nocontiene "la del otro lado no" "$A" "lado B"
B=$(servicio "select discord_i_cartas('$D3', 'rata');")
contiene "el del Side B ve la suya" "$B" "lado B"
nocontiene "y no la del A" "$B" "lado A"
S=$(servicio "select discord_i_cartas('999999999999999999', 'rata');")
nocontiene "sin cuenta vinculada solo salen las de todos (nada del lado A)" "$S" "lado A"
nocontiene "ni del lado B" "$S" "lado B"
contiene "y sí la general" "$S" "Rata gris"
sql "insert into side_excepciones (user_id, motivo) values ('$U3', 'prueba')" >/dev/null
contiene "con la excepción de Side se ven las dos" "$(servicio "select discord_i_cartas('$D3', 'rata');")" "lado A"
contiene "una búsqueda de una letra se rechaza" "$(servicio "select discord_i_cartas('$D1', 'r');")" "al menos 2 letras"
contiene "los comodines del texto no devuelven todo" "$(servicio "select discord_i_cartas('$D1', '%%');")" "al menos 2 letras"
comprobar "el nombre exacto sale primero" "Rata gris" "$(servicio "select discord_i_cartas('$D1', 'rata gris') -> 0 ->> 'nombre'" | tail -1)"

echo "== /eventos"
H1=$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1d +%Y-%m-%dT%H:%M:%SZ)
sql "delete from eventos_reclamos; delete from eventos_sitio;
     insert into eventos_sitio (titulo, texto, side, desde, hasta) values ('Para todos', 'x', null, now() - interval '1 hour', '$H1'), ('Solo A', 'x', 'A', now() - interval '1 hour', '$H1'), ('Solo B', 'x', 'B', now() - interval '1 hour', '$H1'), ('Pasado', 'x', null, now() - interval '3 days', now() - interval '2 days');
     insert into hipodromo_calendario (n, datos) values (1, jsonb_build_object('nombre', 'Copa de prueba', 'hora', (extract(epoch from now()) * 1000 + 3600000)::bigint, 'gradoNombre', 'Novatos', 'bolsa', 500, 'inscripcion', 50)), (2, jsonb_build_object('nombre', 'Carrera vieja', 'hora', (extract(epoch from now()) * 1000 - 3600000)::bigint));" >/dev/null
sql "delete from side_excepciones" >/dev/null
EA=$(servicio "select discord_i_eventos('$D1');")
contiene "el de todos sale" "$EA" "Para todos"
contiene "el de su Side sale" "$EA" "Solo A"
nocontiene "el del otro Side no" "$EA" "Solo B"
nocontiene "los pasados no" "$EA" "Pasado"
ES=$(servicio "select discord_i_eventos('999999999999999999');")
contiene "sin vincular salen solo los de todos" "$ES" "Para todos"
nocontiene "ni el del Side A" "$ES" "Solo A"
contiene "se ve la próxima carrera" "$ES" "Copa de prueba"
nocontiene "no sale una carrera que ya pasó" "$ES" "Carrera vieja"

echo
if [ "$FALLOS" = "0" ]; then echo "Todo bien."; else echo "FALLOS: $FALLOS"; exit 1; fi
