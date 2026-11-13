#!/bin/sh
# Biblioteca de los jugadores (docs/admin/biblioteca.sql): quién lee, quién sube, quién edita y borra.
#   BD=tablero sh docs/pruebas/cargar_local.sh && BD=tablero sh docs/pruebas/t_biblioteca.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
BD="${BD:-pruebas}"
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="docker exec -i cartas-pruebas psql -U postgres -d $BD -q -v ON_ERROR_STOP=1"
cargar() { $PSQL < "$DOCS/$1" >/dev/null 2>&1 || { echo "No corrió $1"; $PSQL < "$DOCS/$1" 2>&1 | grep -i error | head -3; exit 1; }; }

echo "== Instalación"
cargar admin/biblioteca.sql
cargar admin/biblioteca.sql          # se puede repetir
sql "delete from biblioteca_entradas" >/dev/null
NOMBRE_U1=$(sql "select username from perfiles where user_id = '$U1'")   # se devuelve al final: otras pruebas lo usan
sql "insert into perfiles (user_id, username) values ('$U1', 'Exus') on conflict (user_id) do update set username = 'Exus'" >/dev/null

echo "== Subir"
E1=$(como "$U1" "insert into biblioteca_entradas (tipo, nombre, fuente, autor, autor_nombre) values ('clase', 'Paladín', 'Manual', '$U2', 'Otro') returning id;" | head -1)
comprobar "un jugador sube una clase" "1" "$(sql "select count(*) from biblioteca_entradas")"
comprobar "el autor y su nombre los pone el servidor aunque mande otros" "$U1|Exus" "$(sql "select autor || '|' || autor_nombre from biblioteca_entradas where id = '$E1'")"
contiene "sin sesión no se sube nada" "$(anonimo "insert into biblioteca_entradas (nombre) values ('Pirata');")" "denied"
contiene "un tipo raro no entra" "$(como "$U1" "insert into biblioteca_entradas (tipo, nombre) values ('hechizo', 'X');")" "check"

echo "== Leer"
comprobar "otro jugador lo ve" "Paladín" "$(como "$U2" "select nombre from biblioteca_entradas;" | head -1)"
contiene "sin sesión no se ve" "$(anonimo "select count(*) from biblioteca_entradas;")" "denied"

echo "== Editar y borrar"
como "$U2" "update biblioteca_entradas set nombre = 'Robado' where id = '$E1';" >/dev/null
comprobar "otro jugador no edita lo ajeno" "Paladín" "$(sql "select nombre from biblioteca_entradas where id = '$E1'")"
como "$U1" "update biblioteca_entradas set nombre = 'Paladín (juramento)', autor = '$U2' where id = '$E1';" >/dev/null
comprobar "el autor edita lo suyo, sin poder cambiar de autor" "Paladín (juramento)|$U1" "$(sql "select nombre || '|' || autor from biblioteca_entradas where id = '$E1'")"
como "$ADMIN" "update biblioteca_entradas set resumen = 'Revisado' where id = '$E1';" >/dev/null
comprobar "el Admin edita cualquiera" "Revisado|$U1" "$(sql "select resumen || '|' || autor from biblioteca_entradas where id = '$E1'")"
contiene "como mucho 12 archivos" "$(como "$U1" "update biblioteca_entradas set archivos = (select jsonb_agg(jsonb_build_object('ruta', g)) from generate_series(1, 13) g) where id = '$E1';")" "12 archivos"
como "$U2" "delete from biblioteca_entradas where id = '$E1';" >/dev/null
comprobar "otro jugador no borra lo ajeno" "1" "$(sql "select count(*) from biblioteca_entradas")"
E2=$(como "$U2" "insert into biblioteca_entradas (tipo, nombre) values ('raza', 'Tiefling') returning id;" | head -1)
como "$ADMIN" "delete from biblioteca_entradas where id = '$E2';" >/dev/null
comprobar "el Admin borra cualquiera" "1" "$(sql "select count(*) from biblioteca_entradas")"
como "$U1" "delete from biblioteca_entradas where id = '$E1';" >/dev/null
comprobar "el autor borra lo suyo" "0" "$(sql "select count(*) from biblioteca_entradas")"

sql "update perfiles set username = '$NOMBRE_U1' where user_id = '$U1'" >/dev/null

echo
if [ "$FALLOS" = 0 ]; then echo "Todo bien."; else echo "$FALLOS fallo(s)."; exit 1; fi
