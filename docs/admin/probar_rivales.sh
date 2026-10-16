#!/bin/sh
# Prueba local de docs/admin/rivales.sql (contenedor cartas-pruebas, base "admin_pruebas5"). No toca producción.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas5 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas5 with (force)" -c "create database admin_pruebas5" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas5 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno');
SQL
for f in admin/admin_historial.sql admin/rivales.sql admin/rivales.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas5 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corrió $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas5 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Dificultad de los rivales"
como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'reaccion', '0.3'::jsonb);" >/dev/null
chk "el admin guarda un número" "0.3" "$(P -c "select valor from rivales_ajustes where juego='duelo' and rival='caballero' and campo='reaccion'")"
como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'reaccion', '0.25'::jsonb);" >/dev/null
chk "guardar otra vez lo reemplaza (sin duplicar)" "1|0.25" "$(P -c "select count(*) || '|' || max(valor::text) from rivales_ajustes")"
como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'dano', '[11, 21]'::jsonb);" >/dev/null
chk "una lista de números vale" "[11, 21]" "$(P -c "select valor from rivales_ajustes where campo='dano'")"
chk "un jugador no puede guardar" "ERROR:  No autorizado" "$(como $J1 "select rival_ajuste_guardar('duelo', 'caballero', 'hp', '99'::jsonb);" | head -1)"
chk "un jugador no escribe directo" "1" "$(como $J1 "insert into rivales_ajustes (juego, rival, campo, valor) values ('duelo','x','hp','1');" | grep -c 'row-level security\|permission denied')"
chk "cualquiera lee los ajustes (anónimo)" "2" "$(anon "select count(*) from rivales_ajustes;" | tail -1)"
chk "un juego que no existe" "1" "$(como $ADMIN "select rival_ajuste_guardar('damas', 'x', 'hp', '1'::jsonb);" | grep -c 'check constraint')"
chk "un texto no es un número" "1" "$(como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'hp', '\"mucho\"'::jsonb);" | grep -c 'check constraint')"
chk "una lista con texto tampoco" "1" "$(como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'dano', '[1, \"a\"]'::jsonb);" | grep -c 'check constraint')"
chk "un nombre de campo raro" "1" "$(como $ADMIN "select rival_ajuste_guardar('duelo', 'caballero', 'a b; drop', '1'::jsonb);" | grep -c 'check constraint')"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='rivales_ajustes';" | tail -1)"
chk "un jugador no puede quitar" "ERROR:  No autorizado" "$(como $J1 "select rival_ajuste_quitar('duelo', 'caballero');" | head -1)"
como $ADMIN "select rival_ajuste_quitar('duelo', 'caballero', 'dano');" >/dev/null
chk "quitar un campo deja el otro" "reaccion" "$(P -c "select string_agg(campo, ',') from rivales_ajustes")"
como $ADMIN "select rival_ajuste_quitar('duelo', 'caballero');" >/dev/null
chk "quitar sin campo vuelve todo al archivo" "0" "$(P -c "select count(*) from rivales_ajustes")"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
