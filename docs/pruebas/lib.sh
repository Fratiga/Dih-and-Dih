#!/bin/sh
# Utilidades de las pruebas locales (contenedor cartas-pruebas, base "pruebas"). Nada de esto toca producción.
# Usuarios de prueba: admin (a1), editor (e1) y jugadores 1 a 4.
ADMIN=00000000-0000-0000-0000-0000000000a1
EDITOR=00000000-0000-0000-0000-0000000000e1
U1=00000000-0000-0000-0000-000000000001
U2=00000000-0000-0000-0000-000000000002
U3=00000000-0000-0000-0000-000000000003
U4=00000000-0000-0000-0000-000000000004

# psql como superusuario (preparar datos y mirar resultados)
sup() { docker exec -i cartas-pruebas psql -U postgres -d pruebas -tA -v ON_ERROR_STOP=0 -q "$@"; }
sql() { printf '%s\n' "$1" | sup; }

# Ejecuta SQL como un jugador (rol authenticated con sesión simulada). Uso: como <uid> "sql" [segundos de espera al final, con los candados puestos]
como() {
  uid="$1"; cmd="$2"; espera="${3:-0}"
  printf 'begin;\nset local role authenticated;\nselect set_config('"'"'request.jwt.claims'"'"', '"'"'{"sub":"%s","role":"authenticated"}'"'"', true);\n%s\n%s\ncommit;\n' \
    "$uid" "$cmd" "$( [ "$espera" != 0 ] && echo "select pg_sleep($espera);" )" | sup 2>&1 | grep -v '^$' | grep -v '^set_config\|^{"sub"\|^SET$\|^BEGIN$\|^COMMIT$'
}
# Igual pero sin sesión (rol anon)
anonimo() {
  printf 'begin;\nset local role anon;\n%s\ncommit;\n' "$1" | sup 2>&1 | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'
}

ok()   { printf '  OK   %s\n' "$1"; }
mal()  { printf '  FALLA %s\n' "$1"; FALLOS=$((${FALLOS:-0} + 1)); }
# comprobar "descripción" "valor esperado" "valor real"
comprobar() { if [ "$2" = "$3" ]; then ok "$1"; else mal "$1 (esperado: $2, real: $3)"; fi; }

# contiene "descripción" "salida" "texto que debe aparecer"
contiene() { case "$2" in *"$3"*) ok "$1";; *) mal "$1 (salida: $(printf '%s' "$2" | head -c 200 | tr '\n' ' '))";; esac; }
nocontiene() { case "$2" in *"$3"*) mal "$1 (salida: $(printf '%s' "$2" | head -c 200 | tr '\n' ' '))";; *) ok "$1";; esac; }
# Vacía todo lo que dejan las pruebas de cartas (no toca usuarios, perfiles ni catálogo)
limpiar() {
  sql "truncate cartas_ejemplares, cartas_movimientos, cartas_bloqueos, cartas_mercader_ofertas, cartas_mercader_registro, cartas_intercambios, cartas_partidas, cartas_coleccion, cartas_numeradas, cartas_registro, cartas_forja_registro, cartas_mazos, cartas_partidas_juego, cartas_recompensas_registro, cartas_progreso restart identity cascade;" >/dev/null
  sql "delete from cartas_incidencias" >/dev/null 2>&1 || true
}
dar() { sql "select (cartas_i_emitir('$1', '$2', 'prueba', '', null, true) ->> 'ejemplar')"; }
# Auditoría como admin: devuelve el número de problemas
auditar() { sql "select set_config('request.jwt.claims', '{\"sub\":\"$ADMIN\"}', false); select jsonb_array_length(cartas_auditoria());" | tail -1; }
# Mazo válido de 20 cartas para un jugador: 3 de cada común (18) y 2 poco-1. Las cartas se le dan (no cuentan como apuesta)
mazo_de() {
  u="$1"
  for n in 1 2 3 4 5 6; do dar $u comun-$n >/dev/null; dar $u comun-$n >/dev/null; dar $u comun-$n >/dev/null; done
  dar $u poco-1 >/dev/null; dar $u poco-1 >/dev/null
  sql "insert into cartas_mazos (user_id, nombre, cartas) values ('$u', 'Mazo prueba', '{\"comun-1\":3,\"comun-2\":3,\"comun-3\":3,\"comun-4\":3,\"comun-5\":3,\"comun-6\":3,\"poco-1\":2}'::jsonb) returning id"
}
