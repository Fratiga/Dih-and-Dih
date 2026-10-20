#!/bin/sh
# Prueba local de docs/admin/hipodromo_personajes.sql (contenedor cartas-pruebas, base "admin_pruebas_npc"). No toca producción.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas_npc -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas_npc with (force)" -c "create database admin_pruebas_npc" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas_npc -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno');
SQL
for f in admin/admin_historial.sql admin/hipodromo_personajes.sql admin/hipodromo_personajes.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas_npc -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corrió $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas_npc -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Personajes del hipódromo"
como $ADMIN "select hipodromo_npc_guardar('npc:remedios', '{\"reserva\": 100, \"activo\": false}'::jsonb);" >/dev/null
chk "el admin guarda los ajustes de un personaje" "100" "$(P -c "select datos->>'reserva' from hipodromo_npc_ajustes where clave='npc:remedios'")"
como $ADMIN "select hipodromo_npc_guardar('npc:remedios', '{\"reserva\": 250}'::jsonb);" >/dev/null
chk "guardar otra vez lo reemplaza entero" "250|" "$(P -c "select (datos->>'reserva') || '|' || coalesce(datos->>'activo','') from hipodromo_npc_ajustes where clave='npc:remedios'")"
como $ADMIN "select hipodromo_npc_guardar('global', '{\"activo\": true, \"apuestas\": 1.5}'::jsonb);" >/dev/null
como $ADMIN "select hipodromo_npc_guardar('npc:brea', '{\"nuevo\": true, \"nombre\": \"Tomasa\"}'::jsonb);" >/dev/null
chk "caben los generales y los personajes nuevos" "3" "$(P -c "select count(*) from hipodromo_npc_ajustes")"
chk "un jugador no puede guardar" "ERROR:  No autorizado" "$(como $J1 "select hipodromo_npc_guardar('npc:pez', '{}'::jsonb);" | head -1)"
chk "un jugador no escribe directo" "1" "$(como $J1 "insert into hipodromo_npc_ajustes (clave, datos) values ('npc:pez', '{}');" | grep -c 'row-level security\|permission denied')"
chk "un jugador no lee los ajustes" "0" "$(como $J1 "select count(*) from hipodromo_npc_ajustes;" | tail -1)"
chk "un anónimo tampoco" "1" "$(anon "select count(*) from hipodromo_npc_ajustes;" | grep -c 'permission denied')"
chk "el admin los lee" "3" "$(como $ADMIN "select count(*) from hipodromo_npc_ajustes;" | tail -1)"
chk "una clave rara no vale" "1" "$(como $ADMIN "select hipodromo_npc_guardar('cualquier cosa', '{}'::jsonb);" | grep -c 'check constraint')"
chk "unos datos que no son un objeto no valen" "1" "$(como $ADMIN "select hipodromo_npc_guardar('npc:pez', '[1]'::jsonb);" | grep -c 'check constraint')"
chk "unos datos enormes no valen" "1" "$(como $ADMIN "select hipodromo_npc_guardar('npc:pez', jsonb_build_object('x', repeat('a', 21000)));" | grep -c 'check constraint')"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='hipodromo_npc_ajustes';" | tail -1)"
chk "un jugador no puede quitar" "ERROR:  No autorizado" "$(como $J1 "select hipodromo_npc_quitar('npc:remedios');" | head -1)"
como $ADMIN "select hipodromo_npc_quitar('npc:remedios');" >/dev/null
chk "quitar vuelve a los de fábrica" "2" "$(P -c "select count(*) from hipodromo_npc_ajustes")"
echo "== Órdenes"
ID=$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"caja\",\"npc\":\"npc:hilda\",\"modo\":\"sumar\",\"monto\":500,\"basura\":1}'::jsonb);" | tail -1)
chk "el admin manda una orden de caja y recibe su id" "1" "$ID"
chk "solo se guardan los campos conocidos" '{"npc": "npc:hilda", "modo": "sumar", "tipo": "caja", "monto": 500}' "$(P -c "select datos::text from hipodromo_npc_ordenes where id=$ID")"
chk "nace pendiente" "pendiente" "$(P -c "select estado from hipodromo_npc_ordenes where id=$ID")"
como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"dar\",\"npc\":\"npc:hilda\",\"criatura\":12}'::jsonb);" >/dev/null
como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"soltar\",\"npc\":\"npc:hilda\"}'::jsonb);" >/dev/null
como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"prestamo\",\"npc\":\"npc:pez\"}'::jsonb);" >/dev/null
chk "caben dar, soltar y préstamo" "4" "$(P -c "select count(*) from hipodromo_npc_ordenes")"
chk "un jugador no manda órdenes" "ERROR:  No autorizado" "$(como $J1 "select hipodromo_npc_orden('{\"tipo\":\"soltar\",\"npc\":\"npc:hilda\"}'::jsonb);" | head -1)"
chk "no lee las órdenes" "0" "$(como $J1 "select count(*) from hipodromo_npc_ordenes;" | tail -1)"
chk "una orden inventada se rechaza" "ERROR:  Orden desconocida." "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"hackear\",\"npc\":\"npc:hilda\"}'::jsonb);" | head -1)"
chk "un personaje con nombre raro se rechaza" "ERROR:  Personaje no válido." "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"soltar\",\"npc\":\"x; drop\"}'::jsonb);" | head -1)"
chk "la caja pide modo e importe" "1" "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"caja\",\"npc\":\"npc:hilda\",\"modo\":\"regalar\",\"monto\":5}'::jsonb);" | grep -c 'necesita un modo')"
chk "un importe absurdo se rechaza" "1" "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"caja\",\"npc\":\"npc:hilda\",\"modo\":\"sumar\",\"monto\":99999999999}'::jsonb);" | grep -c 'necesita un modo')"
chk "dar pide la criatura" "ERROR:  Falta la criatura." "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"dar\",\"npc\":\"npc:hilda\"}'::jsonb);" | head -1)"
P -c "insert into hipodromo_npc_ordenes (datos) select '{\"tipo\":\"soltar\",\"npc\":\"npc:hilda\"}' from generate_series(1, 30)" >/dev/null
chk "no se amontonan órdenes sin resolver" "ERROR:  Hay demasiadas órdenes sin resolver." "$(como $ADMIN "select hipodromo_npc_orden('{\"tipo\":\"soltar\",\"npc\":\"npc:hilda\"}'::jsonb);" | head -1)"
chk "insertar con el aviso a la función no rompe aunque no haya pg_net" "34" "$(P -c "select count(*) from hipodromo_npc_ordenes")"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
