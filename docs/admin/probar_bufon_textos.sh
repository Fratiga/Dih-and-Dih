#!/bin/sh
# Prueba local de docs/admin/bufon_textos.sql (contenedor cartas-pruebas, base "admin_pruebas6"). No toca producciÃ³n.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas6 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas6 with (force)" -c "create database admin_pruebas6" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas6 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno');
SQL
for f in admin/admin_historial.sql admin/bufon_textos.sql admin/bufon_textos.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas6 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corriÃ³ $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas6 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Textos del Bufón"
como $ADMIN "select bufon_texto_guardar('n:intro_01', '[\"Hola.\", \"Pasa, pasa.\"]'::jsonb);" >/dev/null
chk "el admin guarda las líneas de un nodo" "2" "$(P -c "select jsonb_array_length(valor) from bufon_textos where clave='n:intro_01'")"
como $ADMIN "select bufon_texto_guardar('n:intro_01', '[\"Solo una.\"]'::jsonb);" >/dev/null
chk "guardar otra vez lo reemplaza" "1|1" "$(P -c "select count(*) || '|' || max(jsonb_array_length(valor)) from bufon_textos")"
como $ADMIN "select bufon_texto_guardar('o:intro_reason:mapa', '\"Cuéntame del mapa.\"'::jsonb);" >/dev/null
chk "el texto de una opción vale" "2" "$(P -c "select count(*) from bufon_textos")"
chk "un jugador no puede guardar" "ERROR:  No autorizado" "$(como $J1 "select bufon_texto_guardar('n:x', '[\"a\"]'::jsonb);" | head -1)"
chk "un jugador no escribe directo" "1" "$(como $J1 "insert into bufon_textos (clave, valor) values ('n:x', '[\"a\"]');" | grep -c 'row-level security\|permission denied')"
chk "cualquiera lee (anónimo)" "2" "$(anon "select count(*) from bufon_textos;" | tail -1)"
chk "un nodo con texto en vez de lista" "1" "$(como $ADMIN "select bufon_texto_guardar('n:y', '\"a\"'::jsonb);" | grep -c 'check constraint')"
chk "una línea vacía no vale" "1" "$(como $ADMIN "select bufon_texto_guardar('n:y', '[\"\"]'::jsonb);" | grep -c 'check constraint')"
chk "una línea que no es texto" "1" "$(como $ADMIN "select bufon_texto_guardar('n:y', '[1]'::jsonb);" | grep -c 'check constraint')"
chk "una clave rara" "1" "$(como $ADMIN "select bufon_texto_guardar('x:y; drop', '[\"a\"]'::jsonb);" | grep -c 'check constraint')"
chk "una opción con lista" "1" "$(como $ADMIN "select bufon_texto_guardar('o:a:b', '[\"a\"]'::jsonb);" | grep -c 'check constraint')"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='bufon_textos';" | tail -1)"
chk "un jugador no puede quitar" "ERROR:  No autorizado" "$(como $J1 "select bufon_texto_quitar('n:intro_01');" | head -1)"
como $ADMIN "select bufon_texto_quitar('n:intro_01');" >/dev/null
chk "quitar vuelve al original" "1" "$(P -c "select count(*) from bufon_textos")"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
