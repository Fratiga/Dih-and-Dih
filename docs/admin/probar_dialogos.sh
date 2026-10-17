#!/bin/sh
# Prueba local de docs/admin/dialogos_personajes.sql (contenedor cartas-pruebas, base "admin_pruebas7"). No toca producciÃ³n.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas7 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas7 with (force)" -c "create database admin_pruebas7" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas7 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno');
SQL
for f in admin/admin_historial.sql admin/dialogos_personajes.sql admin/dialogos_personajes.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas7 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corriÃ³ $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas7 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Diálogos de personajes"
como $ADMIN "select dialogo_guardar('buhonero', 'saludo', '[\"Hola.\", \"Pasa.\"]'::jsonb);" >/dev/null
chk "el admin guarda las frases de un grupo" "2" "$(P -c "select jsonb_array_length(frases) from dialogos_personajes where personaje='buhonero' and grupo='saludo'")"
como $ADMIN "select dialogo_guardar('buhonero', 'saludo', '[\"Solo una.\"]'::jsonb);" >/dev/null
chk "guardar otra vez lo reemplaza" "1|1" "$(P -c "select count(*) || '|' || max(jsonb_array_length(frases)) from dialogos_personajes")"
como $ADMIN "select dialogo_guardar('herrero', 'golpe', '[\"Calla.\"]'::jsonb);" >/dev/null
chk "cada personaje tiene sus grupos" "2" "$(P -c "select count(*) from dialogos_personajes")"
chk "un jugador no puede guardar" "ERROR:  No autorizado" "$(como $J1 "select dialogo_guardar('buhonero', 'exito', '[\"a\"]'::jsonb);" | head -1)"
chk "un jugador no escribe directo" "1" "$(como $J1 "insert into dialogos_personajes (personaje, grupo, frases) values ('buhonero', 'x', '[\"a\"]');" | grep -c 'row-level security\|permission denied')"
chk "cualquiera lee (anónimo)" "2" "$(anon "select count(*) from dialogos_personajes;" | tail -1)"
chk "un personaje que no existe" "1" "$(como $ADMIN "select dialogo_guardar('dragon', 'saludo', '[\"a\"]'::jsonb);" | grep -c 'check constraint')"
chk "una lista vacía no vale" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'error', '[]'::jsonb);" | grep -c 'check constraint')"
chk "una frase vacía no vale" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'error', '[\"\"]'::jsonb);" | grep -c 'check constraint')"
chk "una frase que no es texto" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'error', '[1]'::jsonb);" | grep -c 'check constraint')"
chk "texto en vez de lista" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'error', '\"a\"'::jsonb);" | grep -c 'check constraint')"
chk "una frase demasiado larga" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'error', jsonb_build_array(repeat('a', 241)));" | grep -c 'check constraint')"
chk "un grupo con nombre raro" "1" "$(como $ADMIN "select dialogo_guardar('buhonero', 'x; drop', '[\"a\"]'::jsonb);" | grep -c 'check constraint')"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='dialogos_personajes';" | tail -1)"
chk "un jugador no puede quitar" "ERROR:  No autorizado" "$(como $J1 "select dialogo_quitar('buhonero', 'saludo');" | head -1)"
como $ADMIN "select dialogo_quitar('buhonero', 'saludo');" >/dev/null
chk "quitar vuelve a las de fábrica" "1" "$(P -c "select count(*) from dialogos_personajes")"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
