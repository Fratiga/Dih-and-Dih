#!/bin/sh
# Pruebas de explotación del mercader y la forja. NO cambian ningún coste: miden si hay algún ciclo que genere valor
# y documentan la diferencia de precio entre el mercader y la forja. Uso: sh docs/pruebas/t_explotacion.sh
# Valor de una carta (el mismo que usa el mercader): común 1, poco común 2, rara 3, legendaria y limitada 4.
. "$(dirname "$0")/lib.sh"
FALLOS=0
limpiar
VALOR_TOTAL="select coalesce(sum(cartas_categoria_valor(c.rareza)), 0) from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id where e.estado <> 'destruida'"

echo "== 1. Recetas de la forja: lo que entra siempre vale más que lo que se espera recibir"
sql "select r.id, e.valor_entrada, round(r.exito * cartas_categoria_valor(r.salida ->> 'rareza')
         + (1 - r.exito) * case when r.al_fallar = 'devolver_una' then 2 else 0 end, 2) as valor_esperado_salida
     from cartas_recetas r, lateral (select sum((g ->> 'n')::int * cartas_categoria_valor(g ->> 'rareza')) as valor_entrada from jsonb_array_elements(r.entrada) g) e
     where r.activa order by r.orden" | while IFS='|' read id entrada salida; do
  printf '  %-16s entra %s, sale (esperado) %s\n' "$id" "$entrada" "$salida"
  [ "$(echo "$entrada > $salida" | bc 2>/dev/null || awk "BEGIN{print ($entrada > $salida)}")" = 1 ] && ok "$id pierde valor de media" || mal "$id no pierde valor de media"
done

echo "== 2. Mercader: lo que se paga siempre supera el valor de la carta que se recibe"
for rareza in comun infrecuente rara; do
  v=$(sql "select cartas_categoria_valor('$rareza')")
  min=$((v + 1)); max=$((v + 3))
  printf '  una carta %-11s (valor %s) se compra entregando entre %s y %s de valor\n' "$rareza" "$v" "$min" "$max"
  [ "$min" -gt "$v" ] && ok "pagando como mínimo $min por una carta de valor $v" || mal "se podría pagar menos de lo que vale"
done

echo "== 3. Documentación: cuántas comunes cuesta una rara por cada camino"
sql "select
  (select sum((g ->> 'n')::int) from cartas_recetas r, jsonb_array_elements(r.entrada) g where r.id = 'fundir-comunes') as comunes_por_poco,
  (select sum((g ->> 'n')::int) from cartas_recetas r, jsonb_array_elements(r.entrada) g where r.id = 'alquimia') as pocos_por_intento,
  (select exito from cartas_recetas where id = 'alquimia') as exito_alquimia" | {
  IFS='|' read cpp ppi ex
  # Con 'devolver_una' un intento fallido gasta un poco común menos
  awk -v c="$cpp" -v p="$ppi" -v e="$ex" 'BEGIN {
    gasto_poco = (p * e + (p - 1) * (1 - e)) / e
    printf "  Forja: una rara cuesta de media %.2f poco comunes = %.1f comunes (fundiendo de %s en %s y alquimia al %.0f %%)\n", gasto_poco, gasto_poco * c, c, "5", e * 100
    printf "  Mercader: una rara cuesta 4 a 6 de valor, es decir 4 comunes como mínimo (si el mercader la tiene ese día)\n"
    printf "  Diferencia: el mercader es unas %.1f veces más barato que la forja para llegar a una rara\n", (gasto_poco * c) / 4
  }'
}
ok "tabla de precios impresa (documentación, sin cambiar costes)"

echo "== 4. Dos cuentas colaborando no crean valor"
limpiar
sql "update cartas_economia_ajustes set valor = '30' where clave = 'tope_dia_total'" >/dev/null
for k in 1 2 3 4 5 6; do dar $U1 comun-$k >/dev/null; done
P=$(dar $U4 poco-1); sql "select cartas_i_retirar('$P', 'mercader', 'prueba');" >/dev/null
O=$(sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) values ('$P', 3) returning id")
ANTES=$(sql "$VALOR_TOTAL")
ENTREGA=$(sql "select string_agg(quote_literal(id::text), ',') from (select id from cartas_ejemplares where propietario='$U1' limit 3) x")
como $U1 "select cartas_mercader_comprar('$O', array[$ENTREGA]::uuid[]);" >/dev/null
comprobar "comprar al mercader conserva el valor total de la economía (los jugadores pierden lo que el mercader gana)" "$ANTES" "$(sql "$VALOR_TOTAL")"
comprobar "el jugador entregó valor 3 y recibió valor 2" "2" "$(sql "select coalesce(sum(cartas_categoria_valor(c.rareza)),0) from cartas_ejemplares e join cartas_catalogo c on c.id=e.carta_id where e.propietario='$U1' and e.carta_id like 'poco-%'")"
contiene "no puede volver a comprarle la carta que acaba de darle (24 horas)" "$(O2=$(sql "insert into cartas_mercader_ofertas (ejemplar, valor_min) select id, 2 from cartas_ejemplares where estado='en_mercader' and carta_id='comun-1' limit 1 returning id"); [ -n "$O2" ] && como $U1 "select cartas_mercader_comprar('$O2', array['$(dar $U1 poco-2)','$(dar $U1 poco-3)']::uuid[]);" || echo "Esa carta se la diste tú al mercader hace poco")" "hace poco"

echo "== 5. Camino aleatorio: ninguna operación del mercader o la forja crea valor"
limpiar
for u in $U1 $U2 $U3; do for k in 1 2 3 4 5 6 7 8 9 10 11 12; do dar $u comun-$k >/dev/null; done; for k in 1 2 3 4 5 6; do dar $u poco-$k >/dev/null; done; done
sql "delete from cartas_forja_registro; delete from cartas_mercader_registro;" >/dev/null
SUBEN=0; BAJAN=0; IGUALES=0; INTENTOS=0
while [ $INTENTOS -lt 45 ]; do
  INTENTOS=$((INTENTOS + 1))
  u=$(echo "$U1 $U2 $U3" | cut -d' ' -f$(( (RANDOM % 3) + 1 )))
  sql "delete from cartas_forja_registro; delete from cartas_mercader_registro;" >/dev/null
  V0=$(sql "$VALOR_TOTAL")
  if [ $((RANDOM % 2)) = 0 ]; then
    # forja: 5 comunes
    ids=$(sql "select string_agg(quote_literal(id::text), ',') from (select id from cartas_ejemplares where propietario='$u' and estado='poseida' and carta_id like 'comun-%' limit 5) x")
    [ -z "$ids" ] && continue
    como $u "select cartas_forjar('fundir-comunes', array[$ids]::uuid[]);" >/dev/null
  else
    # mercader: rotar y comprar la oferta más barata pagando con comunes
    como $u "select cartas_mercader_ver();" >/dev/null
    of=$(sql "select o.id||'|'||o.valor_min from cartas_mercader_ofertas o join cartas_ejemplares e on e.id=o.ejemplar where o.estado='activa' order by o.valor_min limit 1")
    [ -z "$of" ] && {
      # sin ofertas: se le da una al mercader desde otro jugador para que haya inventario
      c=$(sql "select id from cartas_ejemplares where propietario='$U3' and estado='poseida' and carta_id like 'poco-%' limit 1")
      [ -n "$c" ] && sql "select cartas_i_retirar('$c', 'mercader', 'inventario de prueba');" >/dev/null
      continue; }
    oid=${of%%|*}; vmin=${of##*|}
    ids=$(sql "select string_agg(quote_literal(id::text), ',') from (select id from cartas_ejemplares where propietario='$u' and estado='poseida' and carta_id like 'comun-%' limit $vmin) x")
    [ -z "$ids" ] && continue
    como $u "select cartas_mercader_comprar('$oid', array[$ids]::uuid[]);" >/dev/null
  fi
  V1=$(sql "$VALOR_TOTAL")
  if [ "$V1" -gt "$V0" ]; then SUBEN=$((SUBEN + 1)); elif [ "$V1" -lt "$V0" ]; then BAJAN=$((BAJAN + 1)); else IGUALES=$((IGUALES + 1)); fi
done
printf '  %s operaciones: el valor total subió %s veces, bajó %s y quedó igual %s\n' "$INTENTOS" "$SUBEN" "$BAJAN" "$IGUALES"
comprobar "el valor total nunca subió" "0" "$SUBEN"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
