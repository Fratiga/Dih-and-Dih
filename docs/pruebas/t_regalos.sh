#!/bin/sh
# Regalos y eventos (docs/admin/regalos_eventos.sql) sobre la economía de cartas: regalos directos del Admin, eventos con fechas y el regalo que cada jugador reclama una vez.
# Uso: sh docs/pruebas/cargar_local.sh todo && sh docs/pruebas/t_regalos.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$DOCS/admin/regalos_eventos.sql" >/dev/null || { echo "No corrió regalos_eventos.sql"; exit 1; }
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -v ON_ERROR_STOP=1 < "$DOCS/admin/regalos_eventos.sql" >/dev/null || { echo "Segunda corrida falló"; exit 1; }
limpiar
sql "delete from hipodromo_movimientos; delete from hipodromo_billeteras; delete from eventos_reclamos; delete from eventos_sitio; update cartas_catalogo set en_circulacion = true where id <> 'bufon';" >/dev/null 2>&1
sql "update perfiles set side = 'A' where user_id in ('$U1', '$U2'); update perfiles set side = 'B' where user_id in ('$U3', '$U4');" >/dev/null
H30=$(date -u -d "+30 days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+30d +%Y-%m-%dT%H:%M:%SZ)
duenos() { sql "select count(*) from cartas_ejemplares where carta_id='$2' and propietario='$1'"; }
monedas() { sql "select coalesce((select saldo from hipodromo_billeteras where usuario='$1'), 0)::int"; }

echo "== Regalo directo de una carta"
R=$(como $ADMIN "select admin_regalar_carta('comun-5', '$U1');")
contiene "se regala a una persona" "$R" '"entregadas": 1'
comprobar "la copia es suya y salió del libro de movimientos" "1|1" "$(duenos $U1 comun-5)|$(sql "select count(*) from cartas_movimientos where carta_id='comun-5' and a='$U1' and motivo='regalo del admin'")"
contiene "un jugador no puede regalar" "$(como $U1 "select admin_regalar_carta('comun-5', '$U1');")" "No autorizado"
contiene "una carta que no existe" "$(como $ADMIN "select admin_regalar_carta('no-existe', '$U1');")" "no existe"
como $ADMIN "select admin_regalar_carta('comun-6', null, 'B');" >/dev/null
comprobar "a un Side: lo reciben los del Side y solo ellos" "0|0|1|1" "$(duenos $U1 comun-6)|$(duenos $U2 comun-6)|$(duenos $U3 comun-6)|$(duenos $U4 comun-6)"
R=$(como $ADMIN "select admin_regalar_carta('legendaria-1', '$U1');")
R=$(como $ADMIN "select admin_regalar_carta('legendaria-1', '$U1');")
contiene "a quien ya tiene el máximo se le salta y se dice por qué" "$R" "límite por jugador"
comprobar "y no recibe una segunda copia" "1" "$(duenos $U1 legendaria-1)"
comprobar "el estado de las copias sigue limpio (nada bloqueado ni huérfano)" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"

echo "== Regalo directo de monedas"
como $ADMIN "select admin_regalar_monedas(50, '$U1');" >/dev/null
comprobar "se suman a la billetera" "50" "$(monedas $U1)"
comprobar "quedan en el libro del Hipódromo" "1" "$(sql "select count(*) from hipodromo_movimientos where usuario='$U1' and monto=50 and concepto like 'Regalo del admin%'")"
contiene "un jugador no puede" "$(como $U1 "select admin_regalar_monedas(50, '$U1');")" "No autorizado"
contiene "el monto tiene tope" "$(como $ADMIN "select admin_regalar_monedas(1000000, '$U1');")" "1 a 100000"
como $ADMIN "select admin_regalar_monedas(10, null, 'B', 'prueba');" >/dev/null
comprobar "a un Side: solo ese Side" "50|0|10|10" "$(monedas $U1)|$(monedas $U2)|$(monedas $U3)|$(monedas $U4)"

echo "== Eventos con regalo"
EV=$(como $ADMIN "select evento_guardar('{\"titulo\": \"Torneo de prueba\", \"texto\": \"Juega.\", \"enlace\": \"ajedrez.html\", \"hasta\": \"$(date -u -d '+1 day' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v+1d +%Y-%m-%dT%H:%M:%SZ)\", \"regalo_carta\": \"comun-7\", \"regalo_monedas\": 30}'::jsonb);" | tail -1)
comprobar "el admin crea un evento" "1" "$(sql "select count(*) from eventos_sitio where id='$EV'")"
contiene "un jugador no puede crear eventos" "$(como $U1 "select evento_guardar('{\"titulo\": \"x\", \"hasta\": \"$H30\"}'::jsonb);")" "No autorizado"
comprobar "cualquiera con sesión ve el evento en marcha" "1" "$(como $U2 "select count(*) from eventos_sitio;" | tail -1)"
R=$(como $U2 "select evento_reclamar('$EV');")
contiene "reclamar da la carta y las monedas" "$R" '"monedas": 30'
comprobar "la carta es suya y las monedas están" "1|30" "$(duenos $U2 comun-7)|$(monedas $U2)"
contiene "no se puede reclamar dos veces" "$(como $U2 "select evento_reclamar('$EV');")" "Ya reclamaste"
comprobar "no se duplicó nada" "1|30" "$(duenos $U2 comun-7)|$(monedas $U2)"
comprobar "cada quien ve solo sus reclamos" "1|0" "$(como $U2 "select count(*) from eventos_reclamos;" | tail -1)|$(como $U1 "select count(*) from eventos_reclamos;" | tail -1)"
contiene "no se puede cambiar lo que se regala cuando ya hay reclamos" "$(como $ADMIN "select evento_guardar('{\"id\": \"$EV\", \"titulo\": \"Torneo de prueba\", \"hasta\": \"$H30\", \"regalo_carta\": \"comun-8\", \"regalo_monedas\": 30}'::jsonb);")" "Ya hay jugadores"
nocontiene "sí se puede cambiar el texto" "$(como $ADMIN "select evento_guardar('{\"id\": \"$EV\", \"titulo\": \"Torneo de prueba 2\", \"hasta\": \"$H30\", \"regalo_carta\": \"comun-7\", \"regalo_monedas\": 30}'::jsonb);")" "ERROR"

echo "== Quién puede reclamar"
EB=$(como $ADMIN "select evento_guardar('{\"titulo\": \"Solo Side B\", \"side\": \"B\", \"hasta\": \"$H30\", \"regalo_monedas\": 5}'::jsonb);" | tail -1)
contiene "un jugador de otro Side no lo reclama" "$(como $U1 "select evento_reclamar('$EB');")" "no es para ti"
comprobar "ni siquiera lo ve" "0" "$(como $U1 "select count(*) from eventos_sitio where id='$EB';" | tail -1)"
nocontiene "uno del Side B sí" "$(como $U3 "select evento_reclamar('$EB');")" "ERROR"
sql "insert into eventos_sitio (id, titulo, desde, hasta, regalo_monedas) values (gen_random_uuid(), 'Futuro', now() + interval '1 day', now() + interval '2 days', 5), (gen_random_uuid(), 'Pasado', now() - interval '2 days', now() - interval '1 day', 5);" >/dev/null
F=$(sql "select id from eventos_sitio where titulo='Futuro'"); P=$(sql "select id from eventos_sitio where titulo='Pasado'")
contiene "un evento que aún no empezó no se reclama" "$(como $U2 "select evento_reclamar('$F');")" "ya no está en marcha"
contiene "uno que ya terminó tampoco" "$(como $U2 "select evento_reclamar('$P');")" "ya no está en marcha"
comprobar "los jugadores no ven el futuro ni el pasado" "1" "$(como $U2 "select count(*) from eventos_sitio;" | tail -1)"
SINR=$(como $ADMIN "select evento_guardar('{\"titulo\": \"Sin regalo\", \"hasta\": \"$H30\"}'::jsonb);" | tail -1)
contiene "un evento sin regalo no se reclama" "$(como $U2 "select evento_reclamar('$SINR');")" "no tiene regalo"

echo "== Si la carta no cabe, el reclamo se deshace"
sql "update cartas_ejemplares set propietario = '$U4', estado = 'poseida' where carta_id = 'legendaria-1'" >/dev/null   # la única copia pasa a U4
ER=$(como $ADMIN "select evento_guardar('{\"titulo\": \"Rara\", \"hasta\": \"$H30\", \"regalo_carta\": \"legendaria-1\", \"regalo_monedas\": 7}'::jsonb);" | tail -1)
contiene "quien ya tiene el máximo no puede reclamarla" "$(como $U4 "select evento_reclamar('$ER');")" "límite por jugador"
comprobar "el reclamo no quedó registrado ni se pagaron las monedas" "0|10" "$(sql "select count(*) from eventos_reclamos where evento='$ER' and user_id='$U4'")|$(monedas $U4)"
como $ADMIN "select evento_quitar('$ER');" >/dev/null
comprobar "quitar un evento borra también sus reclamos" "0" "$(sql "select count(*) from eventos_sitio where id='$ER'")"
contiene "un jugador no puede quitar eventos" "$(como $U1 "select evento_quitar('$EV');")" "No autorizado"
comprobar "la auditoría de la economía sigue limpia" "0" "$(sql "select count(*) from cartas_ejemplares where estado='bloqueada'")"

[ "$FALLOS" -eq 0 ] && echo "Todo bien." || { echo "$FALLOS fallo(s)."; exit 1; }
