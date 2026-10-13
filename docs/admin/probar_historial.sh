#!/bin/sh
# Prueba local del historial de cambios (docs/admin/admin_historial.sql) en el contenedor cartas-pruebas.
# Crea una base aparte ("admin_pruebas") con tablas mínimas parecidas a las reales. No toca producción.
# Uso: sh docs/admin/probar_historial.sh
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
JUG=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }

docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas with (force)" -c "create database admin_pruebas" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, username text, side text);
insert into perfiles values ('$ADMIN', 'Admin Prueba', 'A');
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$JUG', 'jug@prueba') on conflict do nothing;
create table cartas_catalogo (id text primary key, rareza text);
create table cartas_definiciones (id text primary key references cartas_catalogo(id) on delete cascade, data jsonb not null);
create table musica_paginas (pagina text primary key, config jsonb not null, actualizada timestamptz default now());
create table fanarts_ocultos (src text primary key, creada timestamptz default now());
create table rocola_fondos (cancion text, juego text, dificultad text, url text, primary key (cancion, juego, dificultad));
SQL
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas -q -v ON_ERROR_STOP=1 < "$D/admin/admin_historial.sql" >/dev/null || { echo "El SQL no corrió"; exit 1; }
# la segunda corrida no debe fallar
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas -q -v ON_ERROR_STOP=1 < "$D/admin/admin_historial.sql" >/dev/null || { echo "Segunda corrida falló"; exit 1; }

echo "== Registro de cambios"
chk "tablas registradas (las que no existen se saltan)" "5" "$(P -c "select count(*) from admin_tablas")"
P -c "insert into musica_paginas values ('a.html', '{\"lista\":[\"x\"]}')"
P -c "update musica_paginas set config = '{\"lista\":[\"x\",\"y\"]}' where pagina = 'a.html'"
P -c "update musica_paginas set config = '{\"lista\":[\"x\",\"y\"]}' where pagina = 'a.html'"   # sin cambio: no se anota
P -c "insert into cartas_catalogo values ('c1', 'comun')"
P -c "insert into cartas_definiciones values ('c1', '{\"nombre\":\"Uno\"}')"
P -c "delete from fanarts_ocultos where src = 'nada'"
chk "insert + update (el update sin cambios no cuenta) + 2 de cartas" "4" "$(P -c "select count(*) from admin_cambios")"
chk "operaciones de musica_paginas" "INSERT,UPDATE" "$(P -c "select string_agg(operacion, ',' order by id) from admin_cambios where tabla = 'musica_paginas'")"
chk "la clave se guarda" "a.html" "$(P -c "select clave ->> 'pagina' from admin_cambios where tabla = 'musica_paginas' limit 1")"

echo "== Permisos"
chk "un jugador no puede listar" "ERROR:  No autorizado" "$(como $JUG "select admin_cambios_listar(10);" | head -1)"
chk "un jugador no puede revertir" "ERROR:  No autorizado" "$(como $JUG "select admin_cambio_revertir(1);" | head -1)"
chk "un jugador no lee la tabla de cambios" "0" "$(como $JUG "select count(*) from admin_cambios;" | tail -1)"
chk "un jugador no puede escribir en la tabla de cambios" "0" "$(como $JUG "insert into admin_cambios (tabla, clave, operacion) values ('x','{}','INSERT');" | grep -c 'INSERT 0 1')"
como $ADMIN "insert into fanarts_ocultos (src) values ('z');" >/dev/null
chk "el admin lista" "5" "$(como $ADMIN "select jsonb_array_length(admin_cambios_listar(50));" | tail -1)"
chk "el listado trae el nombre de quien cambió" "Admin Prueba" "$(como $ADMIN "select admin_cambios_listar(50) -> 0 ->> 'quien';" | tail -1)"

echo "== Deshacer"
UPD=$(P -c "select id from admin_cambios where tabla = 'musica_paginas' and operacion = 'UPDATE'")
como $ADMIN "select admin_cambio_revertir($UPD);" >/dev/null
chk "revertir un UPDATE devuelve la fila a como estaba" '{"lista": ["x"]}' "$(P -c "select config from musica_paginas where pagina = 'a.html'")"
chk "la reversión queda anotada y marcada" "1" "$(P -c "select count(*) from admin_cambios where revierte = $UPD")"
chk "no se puede revertir dos veces" "ERROR:  Ese cambio ya se revirtió" "$(como $ADMIN "select admin_cambio_revertir($UPD);" | head -1)"
REV=$(P -c "select id from admin_cambios where revierte = $UPD")
como $ADMIN "select admin_cambio_revertir($REV);" >/dev/null
chk "rehacer (revertir la reversión) vuelve al cambio original" '{"lista": ["x", "y"]}' "$(P -c "select config from musica_paginas where pagina = 'a.html'")"
INS=$(P -c "select id from admin_cambios where tabla = 'musica_paginas' and operacion = 'INSERT'")
como $ADMIN "select admin_cambio_revertir($INS);" >/dev/null
chk "revertir un INSERT borra la fila" "0" "$(P -c "select count(*) from musica_paginas")"
P -c "delete from cartas_definiciones where id = 'c1'" >/dev/null
DEL=$(P -c "select id from admin_cambios where tabla = 'cartas_definiciones' and operacion = 'DELETE'")
como $ADMIN "select admin_cambio_revertir($DEL);" >/dev/null
chk "revertir un DELETE vuelve a crear la fila" '{"nombre": "Uno"}' "$(P -c "select data from cartas_definiciones where id = 'c1'")"
P -c "insert into rocola_fondos values ('c', 'ritmo', 'facil', 'u1')" >/dev/null
P -c "update rocola_fondos set url = 'u2' where cancion = 'c' and juego = 'ritmo' and dificultad = 'facil'" >/dev/null
U2=$(P -c "select id from admin_cambios where tabla = 'rocola_fondos' and operacion = 'UPDATE'")
como $ADMIN "select admin_cambio_revertir($U2);" >/dev/null
chk "clave de varias columnas" "u1" "$(P -c "select url from rocola_fondos")"

echo
[ "$FALLOS" = 0 ] && echo "=== TODO PASA" || echo "=== $FALLOS comprobación(es) fallaron"
exit $FALLOS
