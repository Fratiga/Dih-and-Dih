#!/bin/sh
# Regresión de los flujos normales (sin concurrencia): lo que ya funcionaba tiene que seguir funcionando.
# Uso: sh docs/pruebas/t_regresion.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
dueno() { sql "select coalesce(propietario::text,'-')||'/'||estado from cartas_ejemplares where id='$1'"; }
tiene() { sql "select count(*) from cartas_ejemplares where propietario='$1' and carta_id='$2' and estado in ('poseida','bloqueada')"; }
limpiar

echo "== Admin: regalar, quitar, reserva y límites"
nocontiene "el admin regala una carta" "$(como $ADMIN "select cartas_regalar('$U1', 'rara-1', 'prueba');")" "ERROR"
comprobar "el jugador la tiene (copia número 1)" "1|1" "$(tiene $U1 rara-1)|$(sql "select numero from cartas_ejemplares where carta_id='rara-1'")"
como $ADMIN "select cartas_regalar('$U1', 'rara-1', 'p');" >/dev/null; como $ADMIN "select cartas_regalar('$U1', 'rara-1', 'p');" >/dev/null
contiene "el límite por jugador se respeta (el efectivo es el menor entre 10 y el global 5)" "$(for i in 1 2 3; do como $ADMIN "select cartas_regalar('$U1', 'rara-1', 'p');"; done)" "El límite por jugador de esta carta es 5"
comprobar "no se emitió ninguna por encima del límite global" "5" "$(sql "select max(numero) from cartas_ejemplares where carta_id='rara-1'")"
como $ADMIN "select cartas_quitar('$U1', 'rara-1', 'corrección', 'reserva');" >/dev/null
comprobar "quitar a la reserva: queda en reserva" "1" "$(sql "select count(*) from cartas_ejemplares where carta_id='rara-1' and estado='en_reserva'")"
como $ADMIN "select cartas_regalar('$U2', 'rara-1', 'p');" >/dev/null
comprobar "lo siguiente que se regala sale de la reserva (la copia 5)" "5" "$(sql "select numero from cartas_ejemplares where carta_id='rara-1' and propietario='$U2'")"
como $ADMIN "select cartas_quitar('$U2', 'rara-1', 'destruir', 'destruida');" >/dev/null
contiene "una copia destruida NO libera hueco" "$(como $ADMIN "select cartas_regalar('$U3', 'rara-1', 'p');")" "AGOTADA"
L=$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\":\"rara-1\",\"limite\":3}]'::jsonb);")
contiene "no se puede bajar el límite global por debajo de lo emitido" "$L" "Ya se emitieron 5"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Cada jugador solo ve lo suyo"
comprobar "Uno ve su colección" "4" "$(como $U1 "select cantidad from cartas_coleccion where carta_id='rara-1';" | tail -1)"
comprobar "Dos no ve la colección de Uno" "0" "$(como $U2 "select count(*) from cartas_coleccion where user_id='$U1';" | tail -1)"
comprobar "cada jugador lee solo su perfil" "1" "$(como $U1 "select count(*) from perfiles;" | tail -1)"
comprobar "Uno no ve los ejemplares de otros" "4" "$(como $U1 "select count(*) from cartas_ejemplares;" | tail -1)"
comprobar "el admin ve todos los ejemplares" "5" "$(como $ADMIN "select count(*) from cartas_ejemplares;" | tail -1)"

echo "== Intercambio completo, cancelado y con errores"
limpiar
X=$(dar $U1 comun-2); Y=$(dar $U2 comun-1)
T=$(como $U1 "select cartas_ofrecer(null, array['$X']::uuid[], '[{\"carta\":\"comun-1\",\"n\":1}]'::jsonb, 'cambio uno por uno');" | tail -1)
comprobar "la copia ofrecida queda bloqueada" "$U1/bloqueada" "$(dueno $X)"
contiene "no se puede ofrecer dos veces la misma copia" "$(como $U1 "select cartas_ofrecer(null, array['$X']::uuid[], '[{\"carta\":\"comun-1\",\"n\":1}]'::jsonb, '');")" "ya no está disponible"
contiene "no se puede aceptar entregando otra cosa" "$(como $U2 "select cartas_aceptar_trueque('$T', array['$(dar $U2 comun-3)']::uuid[]);")" "exactamente lo que se pide"
contiene "no se puede aceptar el propio intercambio" "$(como $U1 "select cartas_aceptar_trueque('$T', array['$Y']::uuid[]);")" "tu propio intercambio"
nocontiene "Dos acepta lo que se pide" "$(como $U2 "select cartas_aceptar_trueque('$T', array['$Y']::uuid[]);")" "ERROR"
comprobar "las copias cambiaron de dueño" "$U2/poseida|$U1/poseida" "$(dueno $X)|$(dueno $Y)"
comprobar "el intercambio queda aceptado" "aceptada" "$(sql "select estado from cartas_intercambios where id='$T'")"
comprobar "sin bloqueos" "0" "$(sql "select count(*) from cartas_bloqueos")"
contiene "no se puede aceptar dos veces" "$(como $U3 "select cartas_aceptar_trueque('$T', array['$(dar $U3 comun-1)']::uuid[]);")" "ya no está abierto"
X2=$(dar $U1 comun-4)
T2=$(como $U1 "select cartas_ofrecer('$U3', array['$X2']::uuid[], '[{\"carta\":\"comun-5\",\"n\":1}]'::jsonb, 'solo para Tres');" | tail -1)
contiene "un intercambio dirigido no lo acepta otro" "$(como $U2 "select cartas_aceptar_trueque('$T2', array['$(dar $U2 comun-5)']::uuid[]);")" "para otro jugador"
nocontiene "el oferente lo cancela" "$(como $U1 "select cartas_cancelar_trueque('$T2');")" "ERROR"
comprobar "la copia queda libre" "$U1/poseida" "$(dueno $X2)"
contiene "un tercero no puede cancelar el de otro" "$(como $U3 "select cartas_cancelar_trueque('$(como $U1 "select cartas_ofrecer(null, array['$(dar $U1 comun-9)']::uuid[], '[{\"carta\":\"comun-10\",\"n\":1}]'::jsonb, '');" | tail -1)');")" "Ese intercambio no existe"
X3=$(dar $U1 comun-6)
T3=$(como $U1 "select cartas_ofrecer(null, array['$X3']::uuid[], '[{\"carta\":\"comun-6\",\"n\":1}]'::jsonb, 'caduca');" | tail -1)
sql "update cartas_intercambios set caduca = now() - interval '1 minute' where id='$T3'" >/dev/null
como $U4 "select cartas_refrescar();" >/dev/null
comprobar "un intercambio caducado se cierra y devuelve la copia" "caducada|$U1/poseida" "$(sql "select estado from cartas_intercambios where id='$T3'")|$(dueno $X3)"
nocontiene "el admin puede cancelar el intercambio de cualquiera" "$(T4=$(como $U1 "select cartas_ofrecer(null, array['$(dar $U1 comun-7)']::uuid[], '[{\"carta\":\"comun-8\",\"n\":1}]'::jsonb, '');" | tail -1); como $ADMIN "select cartas_cancelar_trueque('$T4');")" "ERROR"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Límite por jugador al intercambiar"
limpiar
for k in 1 2 3 4 5 6 7 8 9 10; do dar $U1 comun-1 >/dev/null; done      # Uno ya tiene 10 de Común 1 (el máximo)
Z=$(dar $U2 comun-1)
TL=$(como $U2 "select cartas_ofrecer(null, array['$Z']::uuid[], '[{\"carta\":\"comun-2\",\"n\":1}]'::jsonb, '');" | tail -1)
contiene "quien ya está en su límite no puede aceptar recibir otra copia" "$(como $U1 "select cartas_aceptar_trueque('$TL', array['$(dar $U1 comun-2)']::uuid[]);")" "Tú no podrías recibirlo"
comprobar "no se movió nada: la oferta sigue abierta y bloqueada" "abierta|$U2/bloqueada" "$(sql "select estado from cartas_intercambios where id='$TL'")|$(dueno $Z)"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Mercader"
limpiar
P=$(dar $U4 poco-1); sql "select cartas_i_retirar('$P', 'mercader', 'prueba');" >/dev/null
R=$(dar $U4 rara-1); sql "select cartas_i_retirar('$R', 'mercader', 'prueba');" >/dev/null
V=$(como $U1 "select cartas_mercader_ver();")
contiene "el mercader enseña ofertas (rotación diaria desde su inventario)" "$V" "ofertas"
OP=$(sql "select id from cartas_mercader_ofertas where ejemplar='$P' and estado='activa'")
C1=$(dar $U1 comun-1); C2=$(dar $U1 comun-2); C3=$(dar $U1 comun-3); L1=$(dar $U1 legendaria-1)
contiene "no alcanza el valor" "$(como $U1 "select cartas_mercader_comprar('$OP', array['$C1','$C2']::uuid[]);")" "No alcanza"
contiene "no acepta legendarias" "$(como $U1 "select cartas_mercader_comprar('$OP', array['$C1','$C2','$L1']::uuid[]);")" "legendarias"
contiene "no se pasa del valor (3 comunes y una poco común suman 5 > 3+2)" "$(como $U1 "select cartas_mercader_comprar('$OP', array['$C1','$C2','$C3','$(dar $U1 poco-2)','$(dar $U1 poco-3)']::uuid[]);")" "Te pasas"
nocontiene "con 3 comunes (valor 3) se compra" "$(como $U1 "select cartas_mercader_comprar('$OP', array['$C1','$C2','$C3']::uuid[]);")" "ERROR"
comprobar "recibe la poco común" "$U1/poseida" "$(dueno $P)"
comprobar "las 3 comunes pasaron al mercader" "3" "$(sql "select count(*) from cartas_ejemplares where id in ('$C1','$C2','$C3') and estado='en_mercader'")"
contiene "esa oferta ya no está" "$(como $U2 "select cartas_mercader_comprar('$OP', array['$(dar $U2 comun-4)','$(dar $U2 comun-5)','$(dar $U2 comun-6)']::uuid[]);")" "Esa oferta ya no está"
comprobar "queda registrada la compra" "1" "$(sql "select count(*) from cartas_mercader_registro where user_id='$U1'")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Forja"
limpiar
ids=""; for k in 1 2 3 4 5; do ids="$ids,'$(dar $U1 comun-$k)'"; done
FR=$(como $U1 "select cartas_forjar('fundir-comunes', array[${ids#,}]::uuid[]);")
contiene "5 comunes dan una poco común" "$FR" '"resultado": "carta"'
comprobar "las 5 comunes se destruyeron" "5" "$(sql "select count(*) from cartas_ejemplares where carta_id like 'comun-%' and estado='destruida'")"
comprobar "no se libera hueco de emisión (siguen 5 emitidas)" "5" "$(sql "select count(*) from cartas_ejemplares where carta_id like 'comun-%'")"
contiene "con cartas de otra rareza falla y no consume nada" "$(como $U1 "select cartas_forjar('fundir-comunes', array[$(for k in 1 2 3 4 5; do printf "'%s'," "$(dar $U1 poco-$k)"; done | sed 's/,$//')]::uuid[]);")" "pide"
comprobar "...y sus poco comunes siguen siendo suyas (las 5 más la que ganó antes)" "6" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id like 'poco-%' and estado='poseida'")"
ids2=""; for k in 6 7 8 9 10; do ids2="$ids2,'$(dar $U1 comun-$k)'"; done
sql "update cartas_catalogo set obtenible = false where rareza = 'infrecuente'" >/dev/null
FS=$(como $U1 "select cartas_forjar('fundir-comunes', array[${ids2#,}]::uuid[]);")
contiene "si no hay carta que dar, no se consume nada" "$FS" "sin-salida"
comprobar "...las 5 comunes siguen siendo suyas" "5" "$(sql "select count(*) from cartas_ejemplares where propietario='$U1' and carta_id in ('comun-6','comun-7','comun-8','comun-9','comun-10') and estado='poseida'")"
sql "update cartas_catalogo set obtenible = true where rareza = 'infrecuente'" >/dev/null
sql "insert into cartas_recetas (id, nombre, entrada, salida, exito, al_fallar, destino, orden) values ('siempre-falla', 'Falla', '[{\"rareza\":\"comun\",\"n\":3}]', '{\"rareza\":\"infrecuente\"}', 0, 'devolver_una', 'destruida', 9)" >/dev/null
ids3=""; for k in 11 12 1; do ids3="$ids3,'$(dar $U1 comun-$k)'"; done
FF=$(como $U1 "select cartas_forjar('siempre-falla', array[${ids3#,}]::uuid[]);")
contiene "una receta que falla devuelve una de las cartas" "$FF" '"devuelta": true'
comprobar "se destruyeron 2 de las 3" "2" "$(sql "select count(*) from cartas_forja_registro f, jsonb_array_elements(f.entrega) e where f.receta='siempre-falla' and exists (select 1 from cartas_ejemplares x where x.id = (e->>'ejemplar')::uuid and x.estado='destruida')")"
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo "== Recompensas (en la copia local se encienden; en producción siguen apagadas)"
limpiar
contiene "con el juego apagado no se da permiso" "$(como $U1 "select cartas_juego_iniciar('ajedrez', 'ocevat');")" "Ese juego no da cartas"
sql "update cartas_juegos set activo = true" >/dev/null
TK=$(como $U1 "select cartas_juego_iniciar('duelo', 'adam');" | tail -1)
contiene "terminar demasiado rápido no da nada" "$(como $U1 "select cartas_juego_terminar('$TK', 'gana', 0);")" "muy-rapido"
TK=$(como $U1 "select cartas_juego_iniciar('duelo', 'adam');" | tail -1)
sql "update cartas_partidas_juego set inicio = now() - interval '5 minutes' where token='$TK'" >/dev/null
RW=$(como $U1 "select cartas_juego_terminar('$TK', 'gana', 0);")
contiene "ganar al rival más difícil da carta" "$RW" '"resultado": "carta"'
contiene "el mismo permiso no se puede usar dos veces" "$(como $U1 "select cartas_juego_terminar('$TK', 'gana', 0);")" "partida-no-valida"
comprobar "la carta entregada es de este jugador y queda en el libro" "1|1" "$(sql "select (select count(*) from cartas_ejemplares where propietario='$U1')||'|'||(select count(*) from cartas_movimientos where a='$U1')")"
sql "update cartas_juegos set activo = false" >/dev/null
comprobar "la auditoría está limpia" "0" "$(auditar)"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
