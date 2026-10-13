#!/bin/sh
# Prueba local de docs/admin/contenido_servidor.sql (contenedor cartas-pruebas, base "admin_pruebas2"). No toca producción.
# Uso: sh docs/admin/probar_contenido.sh
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
JUG=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas2 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }

docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas2 with (force)" -c "create database admin_pruebas2" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas2 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, nombre text, side text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$JUG', 'jug@prueba') on conflict do nothing;
SQL
for f in admin/admin_historial.sql admin/contenido_servidor.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas2 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corrió $f"; exit 1; }
done
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas2 -q -v ON_ERROR_STOP=1 < "$D/admin/contenido_servidor.sql" >/dev/null 2>&1 || { echo "Segunda corrida falló"; exit 1; }

echo "== Permisos"
chk "un jugador no puede guardar" "ERROR:  No autorizado" "$(como $JUG "select contenido_guardar('PERSONAJES', 'rook', '{\"title\":\"X\"}');" | head -1)"
chk "un jugador no puede restaurar" "ERROR:  No autorizado" "$(como $JUG "select contenido_restaurar('PERSONAJES', 'rook');" | head -1)"
chk "un jugador no puede escribir directo" "0" "$(como $JUG "insert into contenido_servidor (coleccion, clave) values ('PERSONAJES','x');" | grep -c 'INSERT 0 1')"
chk "cualquiera puede leer (también sin sesión)" "0" "$(printf 'begin;\nset local role anon;\nselect count(*) from contenido_servidor;\ncommit;\n' | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$' | tail -1)"

echo "== Guardar"
como $ADMIN "select contenido_guardar('PERSONAJES', 'rook', '{\"title\":\"Rook el Largo\",\"lado\":[\"A\"]}');" >/dev/null
chk "el admin guarda un parche" "Rook el Largo" "$(P -c "select data ->> 'title' from contenido_servidor where clave = 'rook'")"
como $ADMIN "select contenido_guardar('PERSONAJES', 'rook', '{\"title\":\"Rook\"}');" >/dev/null
chk "guardar otra vez reemplaza (no duplica)" "1|Rook" "$(P -c "select count(*) || '|' || max(data ->> 'title') from contenido_servidor")"
chk "colección desconocida" "ERROR:  Colección desconocida" "$(como $ADMIN "select contenido_guardar('FICHAS', 'x', '{}');" | head -1)"
chk "clave vacía" "ERROR:  Clave inválida" "$(como $ADMIN "select contenido_guardar('LUGARES', '', '{}');" | head -1)"
chk "datos que no son un objeto" "ERROR:  Datos inválidos o demasiado grandes (máximo 600 KB)" "$(como $ADMIN "select contenido_guardar('LUGARES', 'x', '[1]');" | head -1)"
como $ADMIN "select contenido_guardar('ECONOMIA', 'Armas|Daga', '{\"precio\":\"3 po\"}');" >/dev/null
chk "claves con espacios y barra vertical" "3 po" "$(P -c "select data ->> 'precio' from contenido_servidor where clave = 'Armas|Daga'")"
como $ADMIN "select contenido_guardar('OBJETOS', 'viejo', '{}', true);" >/dev/null
chk "borrado se guarda" "t" "$(P -c "select borrado from contenido_servidor where clave = 'viejo'")"

echo "== Restaurar y deshacer"
como $ADMIN "select contenido_restaurar('OBJETOS', 'viejo');" >/dev/null
chk "restaurar quita la fila" "0" "$(P -c "select count(*) from contenido_servidor where clave = 'viejo'")"
chk "todo quedó en el historial" "t" "$(P -c "select count(*) = 5 from admin_cambios where tabla = 'contenido_servidor'")"
ID=$(P -c "select id from admin_cambios where tabla = 'contenido_servidor' and operacion = 'DELETE' order by id desc limit 1")
como $ADMIN "select admin_cambio_revertir($ID);" >/dev/null
chk "deshacer el restaurar vuelve a crear el parche (clave de dos columnas)" "t" "$(P -c "select borrado from contenido_servidor where clave = 'viejo'")"

echo
[ "$FALLOS" = 0 ] && echo "=== TODO PASA" || echo "=== $FALLOS comprobación(es) fallaron"
exit $FALLOS
