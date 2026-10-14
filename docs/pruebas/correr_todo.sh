#!/bin/sh
# Recarga la base local con las correcciones (o sin ellas, con "prod") y corre todas las baterías, cada una sobre una base limpia.
# Uso: sh docs/pruebas/correr_todo.sh [todo|prod]
D="$(cd "$(dirname "$0")" && pwd)"
MODO="${1:-todo}"
TOTAL=0
for t in t_concurrencia t_permisos t_apuestas t_topes t_regresion t_explotacion t_verificacion t_instantanea t_simultaneas t_circulacion t_externas t_fractura t_juegos t_crianza t_estres; do
  [ -f "$D/$t.sh" ] || continue
  sh "$D/cargar_local.sh" "$MODO" >/dev/null 2>&1
  echo "######## $t ($MODO)"
  sh "$D/$t.sh" 2>&1; r=$?
  TOTAL=$((TOTAL + r))
done
echo "######## t_recuperacion (se carga la base él mismo)"
sh "$D/t_recuperacion.sh" 2>&1; r=$?
TOTAL=$((TOTAL + r))
echo
[ "$TOTAL" = 0 ] && echo "=== TODAS LAS BATERÍAS PASAN ($MODO)" || echo "=== $TOTAL comprobación(es) fallaron en total ($MODO)"
echo "######## probar-verificacion (Node, el veredicto de las partidas)"
node "$D/../../tools/probar-verificacion.js" 2>&1 | tail -3
