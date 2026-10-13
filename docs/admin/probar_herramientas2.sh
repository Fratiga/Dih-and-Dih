#!/bin/sh
# Prueba local de docs/admin/herramientas_2.sql (contenedor cartas-pruebas, base "admin_pruebas3"). No toca producción.
# Las tablas de apoyo (perfiles, peticiones, storage) copian las columnas reales de producción.
# Uso: sh docs/admin/probar_herramientas2.sh
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
J2=00000000-0000-0000-0000-000000000002
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas3 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }

docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas3 with (force)" -c "create database admin_pruebas3" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas3 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba'), ('$J2', 'j2@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno'), ('$J2', 'B', 'dos');
create table peticiones (id uuid primary key default gen_random_uuid(), created_at timestamptz default now(), texto text, nombre text, atendida boolean not null default false, codigo uuid not null default gen_random_uuid());
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
SQL
for f in admin/admin_historial.sql admin/herramientas_2.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas3 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corrió $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas3 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas3 -q -v ON_ERROR_STOP=1 < "$D/admin/herramientas_2.sql" >/dev/null 2>&1 || { echo "Segunda corrida falló"; exit 1; }

echo "== Interruptores"
chk "un jugador no puede cambiar uno" "ERROR:  No autorizado" "$(como $J1 "select interruptor_poner('huella_bufon', false);" | head -1)"
como $ADMIN "select interruptor_poner('huella_bufon', false);" >/dev/null
chk "el admin lo apaga" "f" "$(P -c "select activo from sitio_interruptores where clave = 'huella_bufon'")"
como $ADMIN "select interruptor_poner('huella_bufon', true);" >/dev/null
chk "y lo vuelve a encender (sin duplicar)" "1|true" "$(P -c "select count(*) || '|' || bool_and(activo) from sitio_interruptores")"
chk "clave inválida" "ERROR:  Clave inválida" "$(como $ADMIN "select interruptor_poner('Mala Clave!', true);" | head -1)"
chk "cualquiera lee (anónimo)" "1" "$(anon "select count(*) from sitio_interruptores;" | tail -1)"

echo "== Mensajes"
como $ADMIN "select admin_mensaje_enviar('Para todos');" >/dev/null
como $ADMIN "select admin_mensaje_enviar('Solo para uno', '$J1');" >/dev/null
como $ADMIN "select admin_mensaje_enviar('Solo Side B', null, 'B');" >/dev/null
como $ADMIN "select admin_mensaje_enviar('Caducado', null, null, 1);" >/dev/null
P -c "update admin_mensajes set expira = now() - interval '1 hour' where texto = 'Caducado'" >/dev/null
chk "jugador 1 (Side A) ve: todos + el suyo" "Para todos|Solo para uno" "$(como $J1 "select string_agg(texto, '|' order by id) from admin_mensajes;" | tail -1)"
chk "jugador 2 (Side B) ve: todos + Side B" "Para todos|Solo Side B" "$(como $J2 "select string_agg(texto, '|' order by id) from admin_mensajes;" | tail -1)"
chk "el admin ve todo (también lo caducado)" "4" "$(como $ADMIN "select count(*) from admin_mensajes;" | tail -1)"
chk "un jugador no puede enviar" "ERROR:  No autorizado" "$(como $J1 "select admin_mensaje_enviar('hola');" | head -1)"
chk "un jugador no escribe directo" "0" "$(como $J1 "insert into admin_mensajes (texto) values ('x');" | grep -c 'INSERT 0 1')"
chk "mensaje vacío" "ERROR:  El mensaje debe tener entre 1 y 600 letras" "$(como $ADMIN "select admin_mensaje_enviar('   ');" | head -1)"
como $ADMIN "select admin_mensaje_quitar(1);" >/dev/null
chk "quitar lo oculta a los jugadores" "Solo para uno" "$(como $J1 "select string_agg(texto, '|' order by id) from admin_mensajes;" | tail -1)"

echo "== Suspensión"
chk "un jugador no puede suspender" "ERROR:  No autorizado" "$(como $J1 "select cuenta_suspender('$J2', 'x');" | head -1)"
chk "no se suspende a uno mismo" "ERROR:  No puedes suspender tu propia cuenta" "$(como $ADMIN "select cuenta_suspender('$ADMIN');" | head -1)"
como $ADMIN "select cuenta_suspender('$J1', 'Prueba', 3);" >/dev/null
chk "queda con fecha de fin" "t" "$(P -c "select hasta > now() from cuentas_suspendidas where user_id = '$J1'")"
chk "el suspendido ve su propia fila" "Prueba" "$(como $J1 "select motivo from cuentas_suspendidas;" | tail -1)"
chk "otro jugador no ve la fila de nadie" "0" "$(como $J2 "select count(*) from cuentas_suspendidas;" | tail -1)"
P -c "insert into fichas_admins values ('$J2')" >/dev/null
chk "no se suspende a un admin" "ERROR:  No se suspende a un admin" "$(como $ADMIN "select cuenta_suspender('$J2');" | head -1)"
P -c "delete from fichas_admins where user_id = '$J2'" >/dev/null
como $ADMIN "select cuenta_levantar('$J1');" >/dev/null
chk "levantar borra la fila" "0" "$(P -c "select count(*) from cuentas_suspendidas")"

echo "== Respuestas a peticiones"
ID=$(P -c "insert into peticiones (texto, nombre) values ('¿Pueden añadir X?', 'Ana') returning id" | head -1)
COD=$(P -c "select codigo from peticiones where id = '$ID'")
chk "un jugador no puede responder" "ERROR:  No autorizado" "$(como $J1 "select peticion_responder('$ID', 'ok');" | head -1)"
como $ADMIN "select peticion_responder('$ID', 'Sí, ya está.');" >/dev/null
chk "responder la marca como atendida" "true|Sí, ya está." "$(P -c "select atendida || '|' || respuesta from peticiones where id = '$ID'")"
chk "quien la envió ve la respuesta con su código (sin sesión)" "true|Sí, ya está." "$(anon "select atendida || '|' || respuesta from peticiones_estado(array['$COD']::uuid[]);" | tail -1)"
chk "respuesta demasiado larga" "ERROR:  La respuesta es demasiado larga (1000 letras)" "$(como $ADMIN "select peticion_responder('$ID', repeat('x', 1001));" | head -1)"

echo "== Archivos (bucket)"
chk "el bucket existe y es público" "t" "$(P -c "select public from storage.buckets where id = 'archivos'")"
chk "tres políticas del bucket" "3" "$(P -c "select count(*) from pg_policies where tablename = 'objects' and policyname like 'archivos_%'")"

echo "== Historial"
chk "los interruptores quedan en el historial" "t" "$(P -c "select count(*) >= 2 from admin_cambios where tabla = 'sitio_interruptores'")"

echo
[ "$FALLOS" = 0 ] && echo "=== TODO PASA" || echo "=== $FALLOS comprobación(es) fallaron"
exit $FALLOS
