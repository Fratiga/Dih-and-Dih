#!/bin/sh
# Estrés: operaciones aleatorias simultáneas de cuatro jugadores (ofrecer, aceptar, cancelar, forjar).
# Se busca: ningún interbloqueo sin resolver, ninguna pérdida ni duplicado de cartas, auditoría limpia.
# Uso: sh docs/pruebas/t_estres.sh [oleadas]
. "$(dirname "$0")/lib.sh"
FALLOS=0
OLEADAS="${1:-6}"
TMP=$(mktemp -d)
limpiar
USERS="$U1 $U2 $U3 $U4"
for u in $USERS; do for k in 1 2 3 4 5 6 7 8 9 10 11 12; do dar $u comun-$k >/dev/null; done; done
TOTAL_ANTES=$(sql "select count(*) from cartas_ejemplares")
n=0
ola=0
while [ $ola -lt $OLEADAS ]; do
  ola=$((ola + 1))
  # se vacían los registros diarios para que el tope de 3 forjas no corte la prueba
  sql "delete from cartas_forja_registro; delete from cartas_mercader_registro;" >/dev/null
  for u in $USERS; do
    # tres ofertas nuevas, cada una con una copia libre al azar
    for op in 1 2 3; do
      c=$(sql "select id from cartas_ejemplares where propietario='$u' and estado='poseida' order by random() limit 1")
      [ -z "$c" ] && continue
      want=$(( (RANDOM % 12) + 1 ))
      n=$((n + 1)); como $u "select cartas_ofrecer(null, array['$c']::uuid[], '[{\"carta\":\"comun-$want\",\"n\":1}]'::jsonb, 'estres');" 0.4 > "$TMP/o$n" 2>&1 &
    done
    # aceptar una oferta ajena abierta
    t=$(sql "select id||'|'||(pide->0->>'carta') from cartas_intercambios where estado='abierta' and de <> '$u' order by random() limit 1")
    if [ -n "$t" ]; then
      tid=${t%%|*}; carta=${t##*|}
      e=$(sql "select id from cartas_ejemplares where propietario='$u' and carta_id='$carta' and estado='poseida' limit 1")
      if [ -n "$e" ]; then n=$((n + 1)); como $u "select cartas_aceptar_trueque('$tid', array['$e']::uuid[]);" 0.4 > "$TMP/a$n" 2>&1 & fi
    fi
    # cancelar una oferta propia
    t=$(sql "select id from cartas_intercambios where estado='abierta' and de='$u' order by random() limit 1")
    if [ -n "$t" ]; then n=$((n + 1)); como $u "select cartas_cancelar_trueque('$t');" 0.4 > "$TMP/c$n" 2>&1 & fi
    # forjar con 5 comunes libres, si tiene
    ids=$(sql "select string_agg(quote_literal(id::text), ',') from (select id from cartas_ejemplares where propietario='$u' and estado='poseida' and carta_id like 'comun-%' order by random() limit 5) x")
    if [ -n "$ids" ]; then n=$((n + 1)); como $u "select cartas_forjar('fundir-comunes', array[$ids]::uuid[]);" 0.4 > "$TMP/f$n" 2>&1 & fi
  done
  wait
  printf '  oleada %s: %s operaciones lanzadas hasta ahora\n' "$ola" "$n"
done
cat "$TMP"/* > "$TMP.todo"
INTERBLOQUEOS=$(grep -c 'deadlock detected' "$TMP.todo")
echo "  interbloqueos detectados por Postgres (abortan solo una de las dos operaciones): $INTERBLOQUEOS"
echo "  errores vistos (esperables: ofertas ya cerradas, cartas ya movidas, topes):"
grep -o 'ERROR:  [^C]*' "$TMP.todo" | sed 's/ *$//' | sort | uniq -c | sort -rn | head -12 | sed 's/^/     /'
BIEN=$(grep -c '"resultado"' "$TMP.todo")
comprobar "hubo forjas que salieron bien (la prueba no está vacía)" "1" "$( [ "$BIEN" -gt 3 ] && echo 1 || echo 0 )"
comprobar "la auditoría está limpia tras el estrés" "0" "$(auditar)"
comprobar "no hay copias bloqueadas sin bloqueo ni bloqueos sin copia" "0" "$(sql "select count(*) from cartas_ejemplares e left join cartas_bloqueos b on b.ejemplar=e.id where (e.estado='bloqueada') <> (b.ejemplar is not null)")"
comprobar "estado y dueño coherentes en todas las copias" "0" "$(sql "select count(*) from cartas_ejemplares where (estado in ('poseida','bloqueada') and propietario is null) or (estado not in ('poseida','bloqueada') and propietario is not null)")"
comprobar "todo bloqueo corresponde a un intercambio abierto" "0" "$(sql "select count(*) from cartas_bloqueos b where not exists (select 1 from cartas_intercambios t where 'trueque:'||t.id::text=b.referencia and t.estado='abierta')")"
FORJADAS=$(sql "select count(*) from cartas_ejemplares where carta_id like 'poco-%'")
comprobar "cartas totales = las iniciales + las poco comunes forjadas (nada duplicado ni perdido)" "$((TOTAL_ANTES + FORJADAS))" "$(sql "select count(*) from cartas_ejemplares")"
comprobar "comunes destruidas = 5 por forja (nada se destruyó de más)" "$((FORJADAS * 5))" "$(sql "select count(*) from cartas_ejemplares where estado='destruida'")"
comprobar "cada jugador sigue dentro de su límite" "0" "$(sql "select count(*) from (select propietario, carta_id from cartas_ejemplares where estado in ('poseida','bloqueada') group by 1,2 having count(*) > cartas_limite_jugador(carta_id)) x")"
rm -rf "$TMP" "$TMP.todo"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
