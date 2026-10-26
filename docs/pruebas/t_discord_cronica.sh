#!/bin/sh
# Discord, parte 2 (docs/discord-2_consultas.sql): /cronica, /racha, /desafios, /carrera, /saldo y los anuncios de la crónica por Side.
# Uso: BD=discord sh docs/pruebas/cargar_local.sh todo && BD=discord sh docs/pruebas/t_discord_cronica.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
# Como el de lib.sh, pero cierra la consulta con «;» (varias de aquí abajo terminan en un where y sin ese punto y coma el commit se pegaría a la consulta)
servicio() { printf 'begin;
set local role service_role;
%s;
commit;
' "$1" | sup 2>&1 | grep -v '^$' | grep -v '^SET$|^BEGIN$|^COMMIT$'; }
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BD:-pruebas}"
corre() { docker exec -i cartas-pruebas psql -U postgres -d "$BASE" -q -v ON_ERROR_STOP=1 < "$1" >/dev/null || { echo "No corrió $1"; exit 1; }; }
# Lo que la base local no trae
sql "create table if not exists hipodromo_programa (n int primary key, hora timestamptz not null, cierre timestamptz not null, publico jsonb not null default '{}'); delete from hipodromo_programa;" >/dev/null
corre "$DOCS/admin/side_excepciones.sql"
corre "$DOCS/discord.sql"
corre "$DOCS/discord-avisos.sql"
corre "$DOCS/cronica-1_base.sql"
corre "$DOCS/discord-2_consultas.sql"
corre "$DOCS/discord-2_consultas.sql"   # se puede repetir
echo "(discord-2_consultas.sql corre dos veces sin error)"
sql "truncate discord_vinculos, discord_codigos, discord_intentos, discord_cola restart identity; delete from discord_canales; delete from side_excepciones; truncate cronica_sucesos restart identity;" >/dev/null
sql "update perfiles set side = 'A' where user_id in ('$U1', '$U2'); update perfiles set side = 'B' where user_id in ('$U3', '$U4');" >/dev/null
D1=111111111111111111; D3=333333333333333333; DX=999999999999999999
codigo() { como "$1" "select discord_crear_codigo() ->> 'codigo';" | tail -1; }
servicio "select discord_i_vincular('$(codigo $U1)', '$D1', 'Uno#0');" >/dev/null
servicio "select discord_i_vincular('$(codigo $U3)', '$D3', 'Tres#0');" >/dev/null
suceso() { sql "insert into cronica_sucesos (juego, tipo, user_id, otro_id, side, datos, actualizado, creado, visible_desde, oculto, enlace) values ('$1', '$2', $3, $4, $5, '$6'::jsonb, now() - interval '$7', now() - interval '$7', now() - interval '$7', ${8:-false}, ${9:-null}) returning id"; }

echo "== /cronica: quién ve qué"
S_A=$(suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Dragón Dorado", "rareza": "legendaria", "origen": "sellos"}' "5 minutes")
S_B=$(suceso cartas carta_ganada "'$U3'" null "'B'" '{"nombre": "Kobold", "rareza": "rara"}' "6 minutes")
S_G=$(suceso hipodromo copa_hipodromo "'$U1'" null null '{"criatura": "Brasa", "copa": "La Copa de Bronce", "premio": 10000}' "7 minutes")
S_I=$(suceso cartas intercambio "'$U1'" "'$U3'" null '{"dio": [{"nombre": "Draco", "n": 1}], "recibio": [{"nombre": "Kobold", "n": 2}]}' "8 minutes")
suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Oculta"}' "9 minutes" true >/dev/null
suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Vieja"}' "20 days" >/dev/null
sql "insert into cronica_sucesos (juego, tipo, user_id, side, datos, visible_desde) values ('hipodromo', 'copa_hipodromo', '$U1', 'A', '{\"criatura\": \"Futura\", \"copa\": \"La Copa\"}', now() + interval '1 hour')" >/dev/null
R=$(servicio "select discord_i_cronica('$D1');")
contiene "el Side A ve lo del Side A" "$R" "Dragón Dorado"
contiene "y lo que ven los dos Sides" "$R" "Brasa"
nocontiene "no ve lo del Side B" "$R" "Kobold\", \"rareza"
nocontiene "no ve lo oculto" "$R" "Oculta"
nocontiene "ni lo de hace 20 días" "$R" "Vieja"
nocontiene "ni lo que todavía no toca (visible_desde en el futuro)" "$R" "Futura"
comprobar "los más recientes primero" "Dragón Dorado" "$(servicio "select discord_i_cronica('$D1') -> 0 -> 'datos' ->> 'nombre'" | tail -1)"
R3=$(servicio "select discord_i_cronica('$D3');")
contiene "el Side B ve lo suyo" "$R3" "Kobold"
nocontiene "y no lo del Side A" "$R3" "Dragón Dorado"
comprobar "en un intercambio nadie dice quién fue (usuario vacío)" "null|null" "$(servicio "select coalesce(x ->> 'user', 'null') || '|' || coalesce(x ->> 'otro', 'null') from jsonb_array_elements(discord_i_cronica('$D1')) as t(x) where x ->> 'tipo' = 'intercambio'" | tail -1)"
comprobar "pero sí le marca a quien le toca" "true" "$(servicio "select x ->> 'yo' from jsonb_array_elements(discord_i_cronica('$D1')) as t(x) where x ->> 'tipo' = 'intercambio'" | tail -1)"
comprobar "en lo que no es anónimo sí sale el nombre" "Uno" "$(servicio "select x ->> 'user' from jsonb_array_elements(discord_i_cronica('$D1')) as t(x) where x ->> 'tipo' = 'copa_hipodromo'" | tail -1)"
sql "insert into side_excepciones (user_id, motivo) values ('$U3', 'prueba')" >/dev/null
contiene "con la excepción de Side se ven los dos Sides" "$(servicio "select discord_i_cronica('$D3');")" "Dragón Dorado"
comprobar "un admin tampoco ve quién hizo un intercambio en Discord" "t" "$(sql "insert into discord_vinculos (user_id, discord_id) values ('$ADMIN', '$DX') on conflict do nothing; select (every((x ->> 'user') is null)) from jsonb_array_elements((select discord_i_cronica('$DX'))) as t(x) where x ->> 'tipo' = 'intercambio'" | tail -1)"
sql "delete from discord_vinculos where discord_id = '$DX'; delete from side_excepciones" >/dev/null
contiene "sin vincular no hay crónica" "$(servicio "select discord_i_cronica('$DX');")" "Primero vincula"
comprobar "el límite se acota (0 da 1, 1000 da como mucho 15)" "1|3" "$(servicio "select jsonb_array_length(discord_i_cronica('$D1', 0))" | tail -1)|$(servicio "select jsonb_array_length(discord_i_cronica('$D1', 1000))" | tail -1)"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_cronica('$D1');")" "permission denied"

echo "== /racha y /desafios"
sql "delete from veintiuna_logros where user_id in ('$U1', '$U3'); delete from veintiuna_estadisticas where user_id in ('$U1', '$U3')" >/dev/null
sql "insert into veintiuna_estadisticas (user_id, proxima_regla, rondas, victorias, racha, mejor_racha) values ('$U1', veintiuna_i_regla_nueva(), 20, 11, 4, 6) on conflict (user_id) do update set rondas = 20, victorias = 11, racha = 4, mejor_racha = 6, dia_logros = (now() at time zone 'utc')::date" >/dev/null
V=$(servicio "select discord_i_veintiuna('$D1');")
contiene "la racha y las rondas son las suyas" "$V" '"racha": 4'
contiene "y la mejor racha" "$V" '"mejor_racha": 6'
comprobar "trae los 11 desafíos" "11" "$(servicio "select jsonb_array_length(discord_i_veintiuna('$D1') -> 'desafios')" | tail -1)"
comprobar "todos pendientes si no ha completado ninguno" "11" "$(servicio "select count(*) from jsonb_array_elements(discord_i_veintiuna('$D1') -> 'desafios') as t(d) where d ->> 'estado' = 'pendiente'" | tail -1)"
sql "insert into veintiuna_logros (user_id, logro, completado, reclamado) values ('$U1', 'primera_vela', now(), now()), ('$U1', 'tres_velas', now(), null)" >/dev/null
comprobar "uno reclamado y uno completado sin reclamar" "reclamado|completado" "$(servicio "select (select d ->> 'estado' from jsonb_array_elements(discord_i_veintiuna('$D1') -> 'desafios') as t(d) where d ->> 'id' = 'primera_vela') || '|' || (select d ->> 'estado' from jsonb_array_elements(discord_i_veintiuna('$D1') -> 'desafios') as t(d) where d ->> 'id' = 'tres_velas')" | tail -1)"
sql "update veintiuna_estadisticas set dia_logros = (now() at time zone 'utc')::date - 1 where user_id = '$U1'" >/dev/null
comprobar "si el último día anotado es anterior a hoy, no cuenta lo de ayer (se reinician)" "11" "$(servicio "select count(*) from jsonb_array_elements(discord_i_veintiuna('$D1') -> 'desafios') as t(d) where d ->> 'estado' = 'pendiente'" | tail -1)"
comprobar "dice cuándo se reinician (las 00:00 UTC de mañana)" "t" "$(servicio "select ((discord_i_veintiuna('$D1') ->> 'reinicia')::bigint = extract(epoch from (((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc'))::bigint)" | tail -1)"
contiene "sin vincular, no hay datos" "$(servicio "select discord_i_veintiuna('$DX');")" "Primero vincula"
comprobar "quien nunca ha jugado ve ceros y todo pendiente" "0|11" "$(servicio "select (discord_i_veintiuna('$D3') ->> 'racha') || '|' || (select count(*) from jsonb_array_elements(discord_i_veintiuna('$D3') -> 'desafios') as t(d) where d ->> 'estado' = 'pendiente')" | tail -1)"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_veintiuna('$D1');")" "permission denied"

echo "== /carrera"
comprobar "sin carreras programadas, dice que no hay" "false" "$(servicio "select discord_i_carrera('$D1') ->> 'hay'" | tail -1)"
sql "insert into hipodromo_programa (n, hora, cierre, publico) values (700, now() + interval '30 minutes', now() + interval '29 minutes', '{\"nombre\": \"Copa de prueba\", \"grado\": \"gran\", \"pista\": \"ceniza\", \"bolsa\": 5000, \"dist\": 1600, \"entrantes\": [{\"puerta\": 1, \"nombre\": \"Lenta\", \"gan\": 12.5, \"pod\": 3.1, \"dueno\": null}, {\"puerta\": 2, \"nombre\": \"Favorita\", \"gan\": 2.08, \"pod\": 1.23, \"dueno\": {\"id\": \"npc:hilda\", \"nombre\": \"Madre Hilda\"}}, {\"puerta\": 3, \"nombre\": \"Segunda\", \"gan\": 4.2, \"pod\": 1.5, \"dueno\": null}, {\"puerta\": 4, \"nombre\": \"Cuarta\", \"gan\": 20, \"pod\": 4, \"dueno\": null}]}')" >/dev/null
C=$(servicio "select discord_i_carrera('$D1');")
contiene "enseña la próxima carrera" "$C" "Copa de prueba"
comprobar "las tres favoritas, de la más a la menos favorita" "Favorita|Segunda|Lenta" "$(servicio "select string_agg(e ->> 'nombre', '|') from jsonb_array_elements(discord_i_carrera('$D1') -> 'entrantes') as t(e)" | tail -1)"
comprobar "con su dueño cuando lo tiene" "Madre Hilda" "$(servicio "select discord_i_carrera('$D1') -> 'entrantes' -> 0 ->> 'dueno'" | tail -1)"
nocontiene "no sale ninguna carrera que ya pasó" "$(servicio "select discord_i_carrera('$D1');")" "Vieja"
sql "update hipodromo_programa set publico = publico || '{\"suspendida\": true}'" >/dev/null
comprobar "una suspendida lo dice" "true" "$(servicio "select discord_i_carrera('$D1') ->> 'suspendida'" | tail -1)"
sql "update hipodromo_programa set publico = jsonb_build_object('nombre', 'Sin datos', 'entrantes', '[{\"nombre\": \"x\", \"gan\": \"raro\"}]'::jsonb)" >/dev/null
comprobar "unos datos raros no rompen nada" "0" "$(servicio "select jsonb_array_length(discord_i_carrera('$D1') -> 'entrantes')" | tail -1)"
contiene "sin vincular, no hay datos" "$(servicio "select discord_i_carrera('$DX');")" "Primero vincula"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_carrera('$D1');")" "permission denied"

echo "== /saldo"
sql "insert into hipodromo_billeteras (usuario, saldo) values ('$U1', 1234.5) on conflict (usuario) do update set saldo = 1234.5" >/dev/null
comprobar "devuelve los tokens de la cuenta" "1234.5" "$(servicio "select discord_i_saldo('$D1')" | tail -1)"
comprobar "quien no tiene billetera tiene 0" "0" "$(servicio "select discord_i_saldo('$D3')" | tail -1)"
contiene "sin vincular, no hay datos" "$(servicio "select discord_i_saldo('$DX');")" "Primero vincula"

echo "== Qué se anuncia (la función de lo fuerte)"
fuerte() { sql "select discord_i_cronica_fuerte(row(0, now(), now(), now(), 'j', '$1', null, null, null, '$2'::jsonb, null, null, false)::cronica_sucesos)"; }
comprobar "una carta legendaria sí" "t" "$(fuerte carta_ganada '{"rareza": "legendaria"}')"
comprobar "una limitada sí" "t" "$(fuerte carta_ganada '{"rareza": "limitada"}')"
comprobar "una rara no" "f" "$(fuerte carta_ganada '{"rareza": "rara"}')"
comprobar "el resumen «ganó N cartas hoy» no" "f" "$(fuerte carta_ganada '{"resumen": true, "rareza": "legendaria"}')"
comprobar "una copa sí" "t" "$(fuerte copa_hipodromo '{}')"
comprobar "una apuesta de 1000 tokens sí" "t" "$(fuerte apuesta_hipodromo '{"pago": 1000}')"
comprobar "una de 999 no" "f" "$(fuerte apuesta_hipodromo '{"pago": 999}')"
comprobar "una racha récord ya terminada sí" "t" "$(fuerte racha_veintiuna '{"activa": false, "record": true}')"
comprobar "una racha viva no (se actualizaría cada victoria)" "f" "$(fuerte racha_veintiuna '{"activa": true, "record": true}')"
comprobar "una racha terminada que no fue récord no" "f" "$(fuerte racha_veintiuna '{"activa": false, "record": false}')"
comprobar "un intercambio no" "f" "$(fuerte intercambio '{}')"
comprobar "un desafío de oro no" "f" "$(fuerte logro_oro_veintiuna '{}')"
comprobar "la primera cría de una especie sí" "t" "$(fuerte cria_nacida '{"primera": true}')"
comprobar "otra cría no" "f" "$(fuerte cria_nacida '{}')"
comprobar "una noticia del Admin no (va con discord_admin_anunciar)" "f" "$(fuerte nota '{"texto": "x"}')"
comprobar "un tipo que no existe no" "f" "$(fuerte inventado '{}')"

echo "== Anuncios por canal"
sql "truncate cronica_sucesos restart identity; truncate discord_cola restart identity; delete from discord_canales;" >/dev/null
CA=444444444444444441; CB=444444444444444442; CG=444444444444444443
suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Dragón Dorado", "rareza": "legendaria"}' "5 minutes" >/dev/null
suceso cartas carta_ganada "'$U3'" null "'B'" '{"nombre": "El Bufón", "rareza": "limitada"}' "5 minutes" >/dev/null
suceso hipodromo copa_hipodromo "'$U1'" null null '{"criatura": "Brasa", "copa": "La Copa"}' "5 minutes" >/dev/null
suceso cartas intercambio "'$U1'" "'$U3'" null '{"dio": [], "recibio": []}' "5 minutes" >/dev/null
suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Antigua", "rareza": "legendaria"}' "2 hours" >/dev/null
suceso cartas carta_ganada "'$U1'" null "'A'" '{"nombre": "Escondida", "rareza": "legendaria"}' "5 minutes" true >/dev/null
comprobar "sin ningún canal configurado no se apunta nada" "0|0" "$(servicio "select discord_i_encolar_cronica();" | tail -1)|$(sql "select count(*) from discord_cola")"
sql "insert into discord_canales (evento, canal_id) values ('cronica_a', '$CA'), ('cronica_b', '$CB'), ('cronica_general', '$CG')" >/dev/null
comprobar "con los tres canales se apuntan 3 (A, B y general)" "3" "$(servicio "select discord_i_encolar_cronica();" | tail -1)"
comprobar "lo del Side A va al canal A, y solo a ese" "$CA" "$(sql "select canal_id from discord_cola where contenido -> 'datos' ->> 'nombre' = 'Dragón Dorado'")"
comprobar "lo del Side B va al canal B" "$CB" "$(sql "select canal_id from discord_cola where contenido -> 'datos' ->> 'nombre' = 'El Bufón'")"
comprobar "lo que ven los dos Sides va al canal general" "$CG" "$(sql "select canal_id from discord_cola where contenido ->> 'tipo' = 'copa_hipodromo'")"
comprobar "nada del Side A llega al canal B ni al revés" "0" "$(sql "select count(*) from discord_cola where (canal_id = '$CB' and contenido -> 'datos' ->> 'nombre' = 'Dragón Dorado') or (canal_id = '$CA' and contenido -> 'datos' ->> 'nombre' = 'El Bufón')")"
comprobar "no se anuncia lo antiguo (hace 2 horas), ni lo oculto, ni los intercambios" "0" "$(sql "select count(*) from discord_cola where contenido -> 'datos' ->> 'nombre' in ('Antigua', 'Escondida') or contenido ->> 'tipo' = 'intercambio'")"
comprobar "volver a mirar no repite el aviso" "0|3" "$(servicio "select discord_i_encolar_cronica();" | tail -1)|$(sql "select count(*) from discord_cola")"
comprobar "el nombre de quien lo ganó va en el aviso (no es anónimo)" "Uno" "$(sql "select contenido ->> 'user' from discord_cola where contenido -> 'datos' ->> 'nombre' = 'Dragón Dorado'")"
comprobar "el aviso caduca a las 2 horas" "t" "$(sql "select bool_and(caduca between now() + interval '119 minutes' and now() + interval '121 minutes') from discord_cola where origen = 'cronica'")"
sql "update discord_canales set activo = false where evento = 'cronica_b'" >/dev/null
suceso cartas carta_ganada "'$U3'" null "'B'" '{"nombre": "Otra del B", "rareza": "legendaria"}' "1 minute" >/dev/null
comprobar "un canal pausado no recibe nada" "0" "$(servicio "select discord_i_encolar_cronica();" | tail -1)"
# Una cría anónima (la primera de su especie) nunca lleva el nombre
sql "update discord_canales set activo = true where evento = 'cronica_b'" >/dev/null
sql "insert into cronica_tipos (tipo, juego, activo, config) values ('cria_nacida', 'cartas', true, '{\"anonimo\": true}') on conflict (tipo) do update set config = '{\"anonimo\": true}', activo = true" >/dev/null
suceso cartas cria_nacida "'$U3'" null "'B'" '{"nombre": "Hidra", "primera": true}' "1 minute" >/dev/null
servicio "select discord_i_encolar_cronica();" >/dev/null
comprobar "un suceso anónimo se apunta sin el nombre de nadie" "null" "$(sql "select coalesce(contenido ->> 'user', 'null') from discord_cola where contenido ->> 'tipo' = 'cria_nacida'")"

echo "== Recordatorio de los desafíos de Veintiuna"
sql "truncate discord_cola restart identity; truncate cronica_sucesos restart identity; delete from discord_canales" >/dev/null
HOY=$(sql "select (now() at time zone 'utc')::date")
A_LAS() { sql "select '${HOY} $1+00'::timestamptz"; }
servicio "select discord_i_encolar_cronica('${HOY} 23:55:00+00');" >/dev/null
comprobar "sin canal «veintiuna», no se recuerda nada" "0" "$(sql "select count(*) from discord_cola")"
sql "insert into discord_canales (evento, canal_id) values ('veintiuna', '$CG')" >/dev/null
servicio "select discord_i_encolar_cronica('${HOY} 12:00:00+00');" >/dev/null
comprobar "al mediodía no se recuerda" "0" "$(sql "select count(*) from discord_cola")"
servicio "select discord_i_encolar_cronica('${HOY} 23:30:00+00');" >/dev/null
comprobar "a las 23:30 todavía no" "0" "$(sql "select count(*) from discord_cola")"
comprobar "a las 23:55 se apunta uno" "1" "$(servicio "select discord_i_encolar_cronica('${HOY} 23:55:00+00');" | tail -1)"
comprobar "a las 23:57 no se repite" "0|1" "$(servicio "select discord_i_encolar_cronica('${HOY} 23:57:00+00');" | tail -1)|$(sql "select count(*) from discord_cola")"
comprobar "dice a qué hora se reinician (las 00:00 UTC) y caduca entonces" "t" "$(sql "select ((contenido ->> 'hora')::bigint = extract(epoch from (('${HOY}'::date + 1)::timestamp at time zone 'utc'))::bigint) and caduca = (('${HOY}'::date + 1)::timestamp at time zone 'utc') from discord_cola")"
comprobar "a las 00:00 ya no" "0" "$(servicio "select discord_i_encolar_cronica((('${HOY}'::date + 1)::timestamp at time zone 'utc'));" | tail -1)"

echo "== Anunciar a mano (el Admin)"
sql "truncate discord_cola restart identity; truncate cronica_sucesos restart identity; delete from discord_canales" >/dev/null
N=$(suceso nota nota null null "'A'" '{"texto": "El puente cayó."}' "1 minute" false "'compendio.html'")
OCU=$(suceso nota nota null null "'A'" '{"texto": "Oculta"}' "1 minute" true)
contiene "un jugador no puede" "$(como $U1 "select discord_admin_anunciar($N);")" "No autorizado"
contiene "sin canal configurado, el Admin lo sabe" "$(como $ADMIN "select discord_admin_anunciar($N);")" "No hay un canal"
sql "insert into discord_canales (evento, canal_id) values ('cronica_a', '$CA')" >/dev/null
contiene "con canal, queda en la cola" "$(como $ADMIN "select discord_admin_anunciar($N);")" "En la cola"
comprobar "en el canal de su Side" "$CA" "$(sql "select canal_id from discord_cola")"
contiene "anunciarlo otra vez no lo duplica" "$(como $ADMIN "select discord_admin_anunciar($N);")" "Ya estaba anunciado"
comprobar "y solo hay una fila" "1" "$(sql "select count(*) from discord_cola")"
contiene "uno oculto no se puede anunciar" "$(como $ADMIN "select discord_admin_anunciar($OCU);")" "no existe o está oculto"
contiene "uno que no existe tampoco" "$(como $ADMIN "select discord_admin_anunciar(99999);")" "no existe"
contiene "sin sesión, no" "$(anonimo "select discord_admin_anunciar($N);")" "permission denied"

echo "== Permisos de lo interno"
for f in "discord_i_saldo('$D1')" "discord_i_encolar_cronica()" "discord_i_cronica_evento('A')"; do
  contiene "un jugador no puede llamar a $f" "$(como $U1 "select $f;")" "permission denied"
  contiene "ni sin sesión: $f" "$(anonimo "select $f;")" "permission denied"
done

echo
if [ "$FALLOS" = "0" ]; then echo "Todo bien."; else echo "FALLOS: $FALLOS"; exit 1; fi
