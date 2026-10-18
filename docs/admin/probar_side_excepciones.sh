#!/bin/sh
# Prueba local de docs/admin/side_excepciones.sql (contenedor cartas-pruebas, base "admin_pruebas8"). No toca producciÃ³n.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
CARO=00000000-0000-0000-0000-0000000000c1
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas8 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas8 with (force)" -c "create database admin_pruebas8" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas8 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba'), ('$CARO', 'caro@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno'), ('$CARO', 'A', 'Caro');
SQL
for f in admin/admin_historial.sql admin/side_excepciones.sql admin/side_excepciones.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas8 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corriÃ³ $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas8 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Excepciones de Side"
chk "Caro queda con la excepción al correr el SQL" "t" "$(como $CARO "select side_ve_ambos();" | tail -1)"
chk "otro jugador no la tiene" "f" "$(como $J1 "select side_ve_ambos();" | tail -1)"
chk "cada quien ve solo su fila" "1|0" "$(como $CARO "select count(*) from side_excepciones;" | tail -1)|$(como $J1 "select count(*) from side_excepciones;" | tail -1)"
chk "el admin ve todas" "1" "$(como $ADMIN "select count(*) from side_excepciones;" | tail -1)"
chk "un jugador no puede dar la excepción" "ERROR:  No autorizado" "$(como $J1 "select side_excepcion_dar('$J1', 'x');" | head -1)"
chk "un jugador no escribe directo" "1" "$(como $J1 "insert into side_excepciones (user_id) values ('$J1');" | grep -c 'row-level security\|permission denied')"
como $ADMIN "select side_excepcion_dar('$J1', 'prueba');" >/dev/null
chk "el admin la da" "t" "$(como $J1 "select side_ve_ambos();" | tail -1)"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='side_excepciones';" | tail -1)"
chk "un jugador no puede quitarla" "ERROR:  No autorizado" "$(como $J1 "select side_excepcion_quitar('$J1');" | head -1)"
como $ADMIN "select side_excepcion_quitar('$J1');" >/dev/null
chk "el admin la quita" "f" "$(como $J1 "select side_ve_ambos();" | tail -1)"
chk "Caro sigue con la suya" "t" "$(como $CARO "select side_ve_ambos();" | tail -1)"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
