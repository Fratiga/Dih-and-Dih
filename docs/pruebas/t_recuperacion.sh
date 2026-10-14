#!/bin/sh
# Prueba del procedimiento de recuperación (docs/economia-etapa0_respaldo.sql): aplicar las etapas, volver atrás y comprobar
# que todo queda IDÉNTICO a como estaba (funciones, permisos, políticas, restricciones, índices, disparadores) y que no se pierde un dato.
# Uso: sh docs/pruebas/t_recuperacion.sh      (parte del estado "prod": recarga la base él mismo)
D="$(cd "$(dirname "$0")/.." && pwd)"
. "$D/pruebas/lib.sh"
FALLOS=0
R=respaldo_economia_20261013
aplicar() { docker exec -i cartas-pruebas psql -U postgres -d pruebas -v ON_ERROR_STOP=1 -q < "$D/$1" 2>&1 | grep -v '^NOTICE' | head -5; }
huella() { docker exec -i cartas-pruebas psql -U postgres -d pruebas -tA -F'|' < "$D/pruebas/huella.sql"; }
cmp_huella() { # <descripción> <huella esperada> <huella real>
  if [ "$2" = "$3" ]; then ok "$1"; else mal "$1"; echo "$2" > /tmp/h_esp.txt; echo "$3" > /tmp/h_real.txt; diff /tmp/h_esp.txt /tmp/h_real.txt | head -12; fi; }

sh "$D/pruebas/cargar_local.sh" prod >/dev/null 2>&1
# una carta real y un perfil extra para comprobar que los datos sobreviven
CARTA=$(dar $U1 comun-3)
sql "insert into cartas_economia_ajustes (clave, valor) values ('prueba', '1') on conflict do nothing" >/dev/null
H_A=$(huella)

echo "== Etapa 0: copia inicial"
aplicar economia-etapa0_respaldo.sql
R0=$(sql "select $R.tomar_copia('e0')")
contiene "la copia se toma" "$R0" "Copia e0 tomada"
contiene "no se puede tomar dos veces con el mismo nombre" "$(sql "select $R.tomar_copia('e0')" 2>&1)" "Ya existe una copia"
comprobar "el comportamiento no cambió: misma huella" "$H_A" "$(huella)"
comprobar "la copia guarda las 65+ funciones" "t" "$(sql "select (select count(*) from $R.funciones_e0) >= 65")"
comprobar "y los datos de las tablas (la carta que había)" "1" "$(sql "select count(*) from $R.d_e0_cartas_ejemplares")"
contiene "nadie con sesión puede leer el esquema de copias" "$(como $U1 "select count(*) from $R.funciones_e0;")" "permission denied"
contiene "ni sin sesión" "$(anonimo "select count(*) from $R.funciones_e0;")" "permission denied"
contiene "ni ejecutar la restauración" "$(como $ADMIN "select $R.restaurar('e0');")" "permission denied"

echo "== Etapa 1 (economia-7) y 2 (economia-8)"
aplicar economia-7_integridad.sql
sql "select $R.tomar_copia('e1')" >/dev/null
H_1=$(huella)
aplicar economia-8_permisos.sql
H_2=$(huella)
comprobar "las etapas cambian cosas (si no, la prueba no prueba nada)" "distinto" "$( [ "$H_A" != "$H_2" ] && echo distinto || echo igual )"

echo "== Etapa 3 (economia-9, 10 y 11)"
sql "select $R.tomar_copia('e2')" >/dev/null
aplicar economia-9_panel_admin.sql
aplicar economia-10_verificacion.sql
aplicar economia-11_en_circulacion.sql
H_3=$(huella)
CARTAS_ANTES=$(sql "select count(*) from cartas_ejemplares")

echo "== Etapa 5 (economia-12 La Fractura y economia-13 Hipódromo)"
sql "select $R.tomar_copia('e3')" >/dev/null
aplicar economia-12_vias_externas.sql
aplicar economia-13_hipodromo_cartas.sql
H_4=$(huella)
comprobar "la etapa 5 cambia cosas" "distinto" "$( [ "$H_3" != "$H_4" ] && echo distinto || echo igual )"
sql "select $R.restaurar('e3')" >/dev/null
cmp_huella "tras restaurar e3 vuelven el Hipódromo y La Fractura de antes (idéntico a la etapa 3 aplicada)" "$H_3" "$(huella)"
comprobar "la Fractura de antes (escribe en la colección) vuelve a estar" "t" "$(sql "select pg_get_functiondef('fractura_recompensa(uuid)'::regprocedure) ~* 'insert into cartas_coleccion'")"

echo "== Vuelta atrás de la etapa 3 (a la copia e2)"
RES=$(sql "select $R.restaurar('e2')")
echo "  $RES"
cmp_huella "tras restaurar e2 todo es idéntico a antes de la etapa 3" "$(huella_dummy=1; echo "$H_2")" "$(huella)"
comprobar "no se perdió ningún dato" "$CARTAS_ANTES" "$(sql "select count(*) from cartas_ejemplares")"

echo "== Vuelta atrás de la etapa 2 y 1 (a la copia e1 y a la e0)"
sql "select $R.restaurar('e1')" >/dev/null
cmp_huella "tras restaurar e1 todo es idéntico a la etapa 1 aplicada" "$H_1" "$(huella)"
sql "select $R.restaurar('e0')" >/dev/null
cmp_huella "tras restaurar e0 todo es idéntico al estado de producción original" "$H_A" "$(huella)"
comprobar "la carta del jugador sigue siendo suya" "$U1/poseida" "$(sql "select propietario::text||'/'||estado from cartas_ejemplares where id='$CARTA'")"
comprobar "el ajuste de prueba sigue" "1" "$(sql "select valor from cartas_economia_ajustes where clave='prueba'")"
RES2=$(sql "select $R.restaurar('e0')")
cmp_huella "restaurar dos veces seguidas no estropea nada" "$H_A" "$(huella)"
contiene "una copia que no existe da un error claro" "$(sql "select $R.restaurar('e9')" 2>&1)" "No hay una copia"

echo "== Después de volver atrás se puede volver a aplicar"
aplicar economia-7_integridad.sql; aplicar economia-8_permisos.sql; aplicar economia-9_panel_admin.sql; aplicar economia-10_verificacion.sql; aplicar economia-11_en_circulacion.sql
aplicar economia-12_vias_externas.sql; aplicar economia-13_hipodromo_cartas.sql
cmp_huella "reaplicar todo deja la misma huella que la primera vez" "$H_4" "$(huella)"
sql "update cartas_catalogo set en_circulacion = true where id <> 'bufon'" >/dev/null
comprobar "y el sistema funciona (la auditoría está limpia)" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
