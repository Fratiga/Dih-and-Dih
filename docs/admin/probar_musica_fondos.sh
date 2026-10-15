#!/bin/sh
# Prueba local de docs/admin/musica_fondos.sql (contenedor cartas-pruebas, base "admin_pruebas4"). No toca producción.
D="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN=00000000-0000-0000-0000-0000000000a1
J1=00000000-0000-0000-0000-000000000001
FALLOS=0
P() { docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas4 -tA -v ON_ERROR_STOP=0 -q "$@" 2>&1; }
como() { printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\ncommit;\n' "$1" "$2" | P | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'; }
anon() { printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | P | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
chk() { if [ "$2" = "$3" ]; then echo "  OK   $1"; else echo "  FALLA $1 (esperado: $2, real: $3)"; FALLOS=$((FALLOS+1)); fi; }
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists admin_pruebas4 with (force)" -c "create database admin_pruebas4" >/dev/null 2>&1
docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas4 -q -v ON_ERROR_STOP=1 < "$D/pruebas/00_supabase_simulado.sql" >/dev/null 2>&1 || true
P <<SQL
create table fichas_admins (user_id uuid primary key);
insert into fichas_admins values ('$ADMIN');
create function fichas_es_admin() returns boolean language sql security definer stable as \$\$ select exists (select 1 from fichas_admins where user_id = auth.uid()) \$\$;
create table perfiles (user_id uuid primary key, side text, username text);
insert into auth.users (id, email) values ('$ADMIN', 'admin@prueba'), ('$J1', 'j1@prueba') on conflict do nothing;
insert into perfiles values ('$ADMIN', 'A', 'admin'), ('$J1', 'A', 'uno');
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
SQL
for f in admin/admin_historial.sql admin/musica_fondos.sql admin/musica_fondos.sql; do
  docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas4 -q -v ON_ERROR_STOP=1 < "$D/$f" >/dev/null 2>&1 || { echo "No corrió $f"; docker exec -i cartas-pruebas psql -U postgres -d admin_pruebas4 -q -v ON_ERROR_STOP=1 < "$D/$f" 2>&1 | grep -i error | head -3; exit 1; }
done
echo "== Rocola de fondos"
como $ADMIN "insert into musica_fondos (ruta, archivo, titulo) values ('https://x/a.mp3','a.mp3','Tema');" >/dev/null
chk "el admin añade una canción" "1" "$(P -c "select count(*) from musica_fondos")"
chk "el admin la ve" "1" "$(como $ADMIN "select count(*) from musica_fondos;" | tail -1)"
chk "un jugador no ve la lista" "0" "$(como $J1 "select count(*) from musica_fondos;" | tail -1)"
chk "un anónimo no ve la lista" "0" "$(anon "select count(*) from musica_fondos;" | tail -1)"
chk "un jugador no puede añadir" "1" "$(como $J1 "insert into musica_fondos (ruta, archivo, titulo) values ('https://x/b.mp3','b.mp3','Otro');" | grep -c 'row-level security')"
como $J1 "delete from musica_fondos;" >/dev/null
chk "un jugador no puede borrar" "1" "$(como $ADMIN "select count(*) from musica_fondos;" | tail -1)"
como $ADMIN "update musica_fondos set titulo='Nuevo';" >/dev/null
chk "renombrar" "Nuevo" "$(P -c "select titulo from musica_fondos")"
chk "título vacío no vale" "1" "$(como $ADMIN "update musica_fondos set titulo='';" | grep -c 'check constraint')"
chk "queda en el historial" "t" "$(como $ADMIN "select count(*) > 0 from admin_cambios where tabla='musica_fondos';" | tail -1)"
chk "el bucket es público" "t" "$(P -c "select public from storage.buckets where id='musica_fondos'")"
[ $FALLOS -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
