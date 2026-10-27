#!/bin/sh
# Discord, parte 3 (docs/discord-3_extras.sql): /ficha, /avisos, el resumen semanal, las novedades del sitio y los avisos personales por mensaje privado.
# Uso: BD=discord sh docs/pruebas/cargar_local.sh todo && BD=discord sh docs/pruebas/t_discord_extras.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
# Como el de lib.sh, pero cierra la consulta con «;» (varias terminan en un where y sin ese punto y coma el commit se pegaría a la consulta)
servicio() { printf 'begin;\nset local role service_role;\n%s;\ncommit;\n' "$1" | sup 2>&1 | grep -v '^$' | grep -v '^SET$\|^BEGIN$\|^COMMIT$'; }
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
RAIZ="$(cd "$DOCS/.." && pwd)"
BASE="${BD:-pruebas}"
corre() { docker exec -i cartas-pruebas psql -U postgres -d "$BASE" -q -v ON_ERROR_STOP=1 < "$1" >/dev/null || { echo "No corrió $1"; exit 1; }; }
# Lo que la base local no trae
sql "create table if not exists hipodromo_programa (n int primary key, hora timestamptz not null, cierre timestamptz not null, publico jsonb not null default '{}'); delete from hipodromo_programa;
     create table if not exists fichas_personajes (id uuid primary key default gen_random_uuid(), owner_id uuid not null, archivado boolean not null default false, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), roll20 jsonb);
     delete from fichas_personajes;" >/dev/null
corre "$DOCS/admin/side_excepciones.sql"
sql "create table if not exists contenido_servidor (coleccion text not null, clave text not null, data jsonb not null default '{}', borrado boolean not null default false, actualizada timestamptz not null default now(), actualizada_por uuid, primary key (coleccion, clave));" >/dev/null
corre "$DOCS/discord.sql"
corre "$DOCS/discord-avisos.sql"
corre "$DOCS/cronica-1_base.sql"
corre "$DOCS/discord-2_consultas.sql"
corre "$DOCS/discord-3_extras.sql"
corre "$DOCS/discord-3_extras.sql"   # se puede repetir
echo "(discord-3_extras.sql corre dos veces sin error)"
sql "truncate discord_vinculos, discord_codigos, discord_intentos, discord_cola, discord_preferencias, discord_indice_ids, discord_tareas restart identity; delete from discord_canales; delete from side_excepciones; truncate cronica_sucesos restart identity; delete from contenido_servidor;" >/dev/null
sql "update perfiles set side = 'A' where user_id in ('$U1', '$U2'); update perfiles set side = 'B' where user_id in ('$U3', '$U4');" >/dev/null
D1=111111111111111111; D2=222222222222222222; D3=333333333333333333; DX=999999999999999999
codigo() { como "$1" "select discord_crear_codigo() ->> 'codigo';" | tail -1; }
servicio "select discord_i_vincular('$(codigo $U1)', '$D1', 'Uno#0');" >/dev/null
servicio "select discord_i_vincular('$(codigo $U2)', '$D2', 'Dos#0');" >/dev/null
servicio "select discord_i_vincular('$(codigo $U3)', '$D3', 'Tres#0');" >/dev/null
cola() { sql "select count(*) from discord_cola $1"; }

echo "== /avisos: las preferencias"
contiene "sin vincular, no hay avisos" "$(servicio "select discord_i_avisos('$DX');")" "Primero vincula"
comprobar "por defecto todo apagado" "false|false" "$(servicio "select (discord_i_avisos('$D1') ->> 'cria') || '|' || (discord_i_avisos('$D1') ->> 'carrera')" | tail -1)"
comprobar "activar uno no toca el otro" "true|false" "$(servicio "select (discord_i_avisos('$D1', true) ->> 'cria') || '|' || (discord_i_avisos('$D1', true) ->> 'carrera')" | tail -1)"
comprobar "activar el segundo mantiene el primero" "true|true" "$(servicio "select (discord_i_avisos('$D1', null, true) ->> 'cria') || '|' || (discord_i_avisos('$D1', null, true) ->> 'carrera')" | tail -1)"
comprobar "apagar uno mantiene el otro" "false|true" "$(servicio "select (discord_i_avisos('$D1', false) ->> 'cria') || '|' || (discord_i_avisos('$D1', false) ->> 'carrera')" | tail -1)"
comprobar "cada cuenta tiene los suyos (los de otra no cambian)" "false|false" "$(servicio "select (discord_i_avisos('$D2') ->> 'cria') || '|' || (discord_i_avisos('$D2') ->> 'carrera')" | tail -1)"
comprobar "queda una sola fila por cuenta que haya cambiado algo" "1" "$(sql "select count(*) from discord_preferencias")"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_avisos('$D1');")" "permission denied"
contiene "ni leer la tabla de preferencias" "$(como $U1 "select count(*) from discord_preferencias;")" "permission denied"
servicio "select discord_i_avisos('$D1', true, true);" >/dev/null

echo "== /ficha"
F1=$(sql "insert into fichas_personajes (owner_id, data, updated_at) values ('$U1', '{\"identidad\": {\"nombre\": \"Aldric\", \"clase\": \"Guerrero\", \"subclase\": \"Campeón\", \"raza\": \"Humano\", \"trasfondo\": \"Soldado\", \"alineamiento\": \"Legal bueno\", \"nivelTotal\": 6, \"experiencia\": 14000, \"historia\": \"SECRETO-HISTORIA\", \"descripcionFisica\": \"SECRETO-FISICO\", \"notasPublicas\": \"SECRETO-NOTAS\"}, \"ownerEmail\": \"SECRETO@correo.test\", \"atributos\": {\"fue\": 18, \"des\": \"14\", \"con\": 16, \"int\": 8, \"sab\": 12, \"car\": 10}, \"ajustesAtributos\": {\"fue\": 1}, \"combate\": {\"ca\": {\"modo\": \"auto\", \"armadura\": 16, \"escudo\": 2, \"incluyeDes\": false, \"otros\": 0}, \"pvActual\": 38, \"pvMax\": 52, \"pvTemp\": 5, \"velocidad\": \"30 pies\", \"condiciones\": \"Asustado\", \"resistencias\": \"necrótico\", \"iniciativaAjuste\": 1}, \"inventario\": {\"monedas\": {\"oro\": 120, \"plata\": 5, \"cobre\": 0}}, \"ataques\": [{\"nombre\": \"Espada larga\"}, {\"nombre\": \"Arco corto\"}, {\"dano\": \"1d4\"}], \"rasgos\": [{}, {}, {}], \"hechizos\": []}'::jsonb, now() - interval '2 days') returning id")
sql "insert into fichas_personajes (owner_id, data, updated_at) values ('$U1', '{\"identidad\": {\"nombre\": \"Aldrina\", \"clase\": \"Maga\", \"nivelTotal\": 2}}'::jsonb, now() - interval '1 day')" >/dev/null
sql "insert into fichas_personajes (owner_id, archivado, data) values ('$U1', true, '{\"identidad\": {\"nombre\": \"Archivada\", \"clase\": \"Bardo\", \"nivelTotal\": 1}}'::jsonb)" >/dev/null
sql "insert into fichas_personajes (owner_id, data) values ('$U2', '{\"identidad\": {\"nombre\": \"Ajena\", \"clase\": \"Pícara\", \"nivelTotal\": 3}}'::jsonb)" >/dev/null
L=$(servicio "select discord_i_fichas('$D1');")
contiene "la lista trae tus personajes" "$L" "Aldric"
nocontiene "sin los archivados" "$L" "Archivada"
nocontiene "ni los de otra persona" "$L" "Ajena"
comprobar "y vienen los más recientes primero" "Aldrina" "$(servicio "select discord_i_fichas('$D1') -> 'lista' -> 0 ->> 'nombre'" | tail -1)"
comprobar "sin nombre no hay ficha" "null" "$(servicio "select coalesce(discord_i_fichas('$D1') ->> 'ficha', 'null')" | tail -1)"
F=$(servicio "select discord_i_fichas('$D1', 'aldric') -> 'ficha';")
contiene "con el nombre exacto sale esa ficha" "$F" '"nombre": "Aldric"'
comprobar "con «ald» gana el que empieza igual y es más reciente (Aldrina)" "Aldrina" "$(servicio "select discord_i_fichas('$D1', 'ald') -> 'ficha' ->> 'nombre'" | tail -1)"
comprobar "con una parte del nombre también (dri)" "Aldric" "$(servicio "select discord_i_fichas('$D1', 'dric') -> 'ficha' ->> 'nombre'" | tail -1)"
comprobar "el nombre exacto gana a los que solo empiezan igual" "Aldric" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'nombre'" | tail -1)"
comprobar "con mayúsculas y espacios da igual" "Aldric" "$(servicio "select discord_i_fichas('$D1', '  ALDRIC ') -> 'ficha' ->> 'nombre'" | tail -1)"
comprobar "un nombre que no existe no da ficha (pero sí la lista)" "null|2" "$(servicio "select coalesce(discord_i_fichas('$D1', 'zzz') ->> 'ficha', 'null') || '|' || jsonb_array_length(discord_i_fichas('$D1', 'zzz') -> 'lista')" | tail -1)"
comprobar "no se puede pedir la ficha de otra persona por nombre" "null" "$(servicio "select coalesce(discord_i_fichas('$D1', 'Ajena') ->> 'ficha', 'null')" | tail -1)"
comprobar "ni una ficha archivada" "null" "$(servicio "select coalesce(discord_i_fichas('$D1', 'Archivada') ->> 'ficha', 'null')" | tail -1)"
comprobar "los comodines del nombre no devuelven cualquiera (%)" "null" "$(servicio "select coalesce(discord_i_fichas('$D1', '%%') ->> 'ficha', 'null')" | tail -1)"
contiene "sin vincular no hay fichas" "$(servicio "select discord_i_fichas('$DX');")" "Primero vincula"
comprobar "quien no tiene personajes recibe una lista vacía" "0" "$(servicio "select jsonb_array_length(discord_i_fichas('$D3') -> 'lista')" | tail -1)"
nocontiene "la historia, la descripción física, las notas y el correo no salen" "$(servicio "select discord_i_fichas('$D1', 'Aldric')::text")" "SECRETO"
comprobar "los números se leen aunque vengan como texto (des «14» da +2)" "2" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' -> 'atributos' -> 'des' ->> 'mod'" | tail -1)"
comprobar "el ajuste manual cuenta (fue 18, +1 de ajuste: +5)" "5" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' -> 'atributos' -> 'fue' ->> 'mod'" | tail -1)"
comprobar "la CA: 16 + 2 sin Destreza" "18" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'ca'" | tail -1)"
comprobar "la competencia de nivel 6 es +3" "3" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'competencia'" | tail -1)"
comprobar "la iniciativa: +2 de Destreza y +1 de ajuste" "3" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'iniciativa'" | tail -1)"
comprobar "solo salen los ataques con nombre" "Espada larga|Arco corto" "$(servicio "select (discord_i_fichas('$D1', 'Aldric') -> 'ficha' -> 'ataques' ->> 0) || '|' || (discord_i_fichas('$D1', 'Aldric') -> 'ficha' -> 'ataques' ->> 1)" | tail -1)"
comprobar "y cuenta los rasgos" "3" "$(servicio "select discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'n_rasgos'" | tail -1)"
comprobar "dice cuándo se guardó por última vez" "t" "$(servicio "select (discord_i_fichas('$D1', 'Aldric') -> 'ficha' ->> 'actualizada') is not null" | tail -1)"
sql "insert into fichas_personajes (owner_id, data) values ('$U3', '{}'::jsonb), ('$U3', '{\"identidad\": 5, \"combate\": \"raro\", \"atributos\": [1], \"ataques\": \"no es lista\", \"rasgos\": null}'::jsonb)" >/dev/null
contiene "una ficha vacía no rompe nada" "$(servicio "select discord_i_fichas('$D3');")" "Sin nombre"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_fichas('$D1');")" "permission denied"
echo "   (comparación de las cuentas con las de js/fichas-calc.js)"
PARIDAD=$(cd "$RAIZ" && node tools/ficha-paridad.js | printf '%s\n' "$(cat)" | sup)
TOTAL=$(printf '%s\n' "$PARIDAD" | grep -c .)
BUENOS=$(printf '%s\n' "$PARIDAD" | grep -c '^t$')
comprobar "CA, competencia, iniciativa y modificadores dan lo mismo que el navegador en los $TOTAL casos de ejemplo" "$TOTAL" "$BUENOS"

echo "== Resumen semanal"
sql "truncate cronica_sucesos restart identity; truncate discord_cola restart identity; delete from discord_canales;" >/dev/null
DOM=$(sql "select to_char(date_trunc('week', now() at time zone 'utc') + interval '6 days', 'YYYY-MM-DD')")
SUN="${DOM} 20:30:00+00"
suceso() { sql "insert into cronica_sucesos (juego, tipo, user_id, side, datos, actualizado, creado, visible_desde, oculto) values ('$1', '$2', $3, $4, '$5'::jsonb, '${SUN}'::timestamptz - interval '$6', '${SUN}'::timestamptz - interval '$6', '${SUN}'::timestamptz - interval '$6', ${7:-false})"; }
CA=444444444444444441; CB=444444444444444442; CG=444444444444444443
sql "insert into discord_canales (evento, canal_id) values ('cronica_a', '$CA'), ('cronica_b', '$CB'), ('cronica_general', '$CG')" >/dev/null
# Datos de la semana: Side A, Side B y de los dos
suceso veintiuna racha_veintiuna "'$U1'" "'A'" '{"racha": 5, "activa": false}' "3 days" >/dev/null
suceso veintiuna racha_veintiuna "'$U2'" "'A'" '{"racha": 9, "activa": true}' "2 days" >/dev/null
suceso veintiuna racha_veintiuna "'$U3'" "'B'" '{"racha": 12, "activa": false}' "1 day" >/dev/null
suceso hipodromo apuesta_hipodromo "'$U1'" "'A'" '{"monto": 100, "pago": 650, "mult": 6.5, "criaturas": ["Brasa"]}' "4 days" >/dev/null
suceso hipodromo apuesta_hipodromo "'$U3'" "'B'" '{"monto": 200, "pago": 2400, "mult": 12, "criaturas": ["Ceniza"]}' "4 days" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Dragón Dorado", "rareza": "legendaria"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Rata", "rareza": "comun"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Kobold", "rareza": "infrecuente"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Draco", "rareza": "rara"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U3'" "'B'" '{"nombre": "El Bufón", "rareza": "limitada"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"resumen": true, "n": 3}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Muy vieja", "rareza": "limitada"}' "8 days" >/dev/null
suceso cartas carta_ganada "'$U1'" "'A'" '{"nombre": "Oculta", "rareza": "limitada"}' "1 day" true >/dev/null
suceso hipodromo copa_hipodromo "'$U1'" null '{"criatura": "x"}' "1 day" >/dev/null
suceso cartas carta_ganada "'$U1'" null '{"nombre": "Para los dos", "rareza": "legendaria"}' "1 day" >/dev/null
LUNES="$(sql "select to_char(date_trunc('week', now() at time zone 'utc'), 'YYYY-MM-DD')") 20:30:00+00"
comprobar "un lunes no se apunta nada" "0" "$(servicio "select discord_i_encolar_resumen('${LUNES}');" | tail -1)"
comprobar "el domingo a las 19:59 todavía no" "0" "$(servicio "select discord_i_encolar_resumen('${DOM} 19:59:00+00');" | tail -1)"
comprobar "ni a las 23:00 (ya es tarde)" "0" "$(servicio "select discord_i_encolar_resumen('${DOM} 23:00:00+00');" | tail -1)"
comprobar "el domingo a las 20:30 se apuntan los tres (A, B y general)" "3" "$(servicio "select discord_i_encolar_resumen('${SUN}');" | tail -1)"
comprobar "volver a mirar la misma semana no repite" "0|3" "$(servicio "select discord_i_encolar_resumen('${SUN}');" | tail -1)|$(cola "where origen = 'resumen'")"
resumen() { sql "select contenido $2 from discord_cola where canal_id = '$1' and origen = 'resumen'"; }
comprobar "el canal del Side A cuenta la mejor racha de su Side (9, de Dos)" "Dos|9" "$(resumen $CA "-> 'racha' ->> 'user'")|$(resumen $CA "-> 'racha' ->> 'racha'")"
comprobar "el del Side B, la suya (12)" "Tres|12" "$(resumen $CB "-> 'racha' ->> 'user'")|$(resumen $CB "-> 'racha' ->> 'racha'")"
comprobar "el general, ninguna (todas son de un Side)" "null" "$(resumen $CG "-> 'racha' ->> 'user'" | sed 's/^$/null/')"
comprobar "la apuesta más pagada del Side A (650)" "650" "$(resumen $CA "-> 'apuesta' ->> 'pago'")"
comprobar "y del Side B (2400)" "2400" "$(resumen $CB "-> 'apuesta' ->> 'pago'")"
comprobar "las 3 cartas más raras del Side A (dos legendarias, la suya y la de los dos Sides, y la rara)" "Dragón Dorado|Para los dos|Draco" "$(sql "select string_agg(c ->> 'nombre', '|' order by ord) from discord_cola, jsonb_array_elements(contenido -> 'cartas') with ordinality as t(c, ord) where canal_id = '$CA' and origen = 'resumen'")"
comprobar "el Side A cuenta 5 cartas ganadas (sin el resumen «ganó N», ni la vieja, ni la oculta; con la de los dos Sides)" "5" "$(resumen $CA "->> 'total_cartas'")"
comprobar "el Side B ve la suya y la de los dos Sides (2)" "2" "$(resumen $CB "->> 'total_cartas'")"
comprobar "el general solo cuenta lo de los dos Sides (1)" "1" "$(resumen $CG "->> 'total_cartas'")"
nocontiene "nada del Side B llega al canal del Side A" "$(sql "select contenido::text from discord_cola where canal_id = '$CA'")" "Bufón"
nocontiene "ni nada del Side A al del B" "$(sql "select contenido::text from discord_cola where canal_id = '$CB'")" "Dragón Dorado"
nocontiene "ni nada de un Side al general" "$(sql "select contenido::text from discord_cola where canal_id = '$CG'")" "Dragón Dorado\"}, {"
comprobar "lo oculto y lo viejo no entra" "0" "$(sql "select count(*) from discord_cola where contenido::text like '%Oculta%' or contenido::text like '%Muy vieja%'")"
comprobar "caduca a las 3 horas" "t" "$(sql "select bool_and(caduca between '${SUN}'::timestamptz + interval '179 minutes' and '${SUN}'::timestamptz + interval '181 minutes') from discord_cola where origen = 'resumen'")"
SIG=$(sql "select to_char(date_trunc('week', now() at time zone 'utc') + interval '13 days', 'YYYY-MM-DD')")
comprobar "la semana siguiente, sin sucesos nuevos en 7 días, no hay resumen" "0" "$(servicio "select discord_i_encolar_resumen('${SIG} 20:30:00+00');" | tail -1)"
sql "truncate discord_cola restart identity; update discord_canales set activo = false where evento = 'cronica_b'" >/dev/null
comprobar "un canal pausado no recibe resumen" "2" "$(servicio "select discord_i_encolar_resumen('${SUN}');" | tail -1)"
sql "truncate discord_cola restart identity; delete from discord_canales; truncate cronica_sucesos restart identity" >/dev/null
sql "insert into discord_canales (evento, canal_id) values ('cronica_a', '$CA')" >/dev/null
comprobar "una semana sin nada no se publica" "0" "$(servicio "select discord_i_encolar_resumen('${SUN}');" | tail -1)"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_encolar_resumen();")" "permission denied"

echo "== Novedades del sitio"
sql "truncate discord_cola restart identity; delete from discord_canales; delete from contenido_servidor; truncate discord_indice_ids; truncate discord_tareas" >/dev/null
HOY=$(sql "select (now() at time zone 'utc')::date")
AYER=$(sql "select (now() at time zone 'utc')::date - 1")
ANTES=$(sql "select (now() at time zone 'utc')::date - 5")
nov() { servicio "select discord_i_encolar_novedad('$1', '$2', '$3', '$4', '$5');" | tail -1; }
comprobar "sin canal «novedades» no se anuncia nada" "0" "$(nov "$HOY|A" 'Algo' 'texto' 'mapa.html' "$HOY")"
sql "insert into discord_canales (evento, canal_id) values ('novedades', '$CG')" >/dev/null
comprobar "una novedad de hoy se apunta" "1" "$(nov "$HOY|A" 'Algo' 'texto' 'mapa.html' "$HOY")"
comprobar "repetirla no la duplica" "0" "$(nov "$HOY|A" 'Algo' 'texto' 'mapa.html' "$HOY")"
comprobar "una de ayer también" "1" "$(nov "$AYER|B" 'Ayer' 'texto' '' "$AYER")"
comprobar "una de hace 5 días no (al encender el canal no sale lo antiguo)" "0" "$(nov "$ANTES|C" 'Antigua' 'texto' '' "$ANTES")"
comprobar "una con fecha rara no" "0" "$(nov 'x|D' 'Rara' 'texto' '' 'ayer')"
comprobar "una sin título no" "0" "$(nov 'x|E' '   ' 'texto' '' "$HOY")"
comprobar "una con la fecha muy en el futuro no" "0" "$(nov 'x|F' 'Futura' 'texto' '' "$(sql "select (now() at time zone 'utc')::date + 10")")"
comprobar "un enlace raro se guarda como vacío" "null" "$(nov "$HOY|G" 'Enlace malo' 'texto' 'javascript:alert(1)' "$HOY" >/dev/null; sql "select coalesce(contenido ->> 'enlace', 'null') from discord_cola where clave = 'novedad:$HOY|G'")"
comprobar "el enlace bueno se guarda" "mapa.html" "$(sql "select contenido ->> 'enlace' from discord_cola where clave = 'novedad:$HOY|A'")"
comprobar "el texto largo se recorta a 1000" "1000" "$(servicio "select discord_i_encolar_novedad('$HOY|H', 'Larga', repeat('x', 5000), null, '$HOY')" >/dev/null; sql "select length(contenido ->> 'texto') from discord_cola where clave = 'novedad:$HOY|H'")"
comprobar "van al canal «novedades»" "$CG" "$(sql "select distinct canal_id from discord_cola where origen = 'novedad'")"
comprobar "y caducan a las 12 horas" "t" "$(sql "select bool_and(caduca between now() + interval '11 hours' and now() + interval '13 hours') from discord_cola where origen = 'novedad'")"
sql "truncate discord_cola restart identity" >/dev/null
sql "insert into contenido_servidor (coleccion, clave, data, borrado, actualizada) values
  ('NOVEDADES', '$HOY|Del panel', jsonb_build_object('fecha', '$HOY', 'titulo', 'Del panel', 'texto', 'Escrita en Admin', 'enlace', 'fichas.html'), false, now()),
  ('NOVEDADES', '$HOY|Borrada', jsonb_build_object('fecha', '$HOY', 'titulo', 'Borrada', 'texto', 'x'), true, now()),
  ('NOVEDADES', '$HOY|Editada hace días', jsonb_build_object('fecha', '$HOY', 'titulo', 'Editada hace días', 'texto', 'x'), false, now() - interval '3 days'),
  ('REGLAS', 'otra', jsonb_build_object('fecha', '$HOY', 'titulo', 'No es una novedad', 'texto', 'x'), false, now())"
comprobar "las novedades del panel de Admin se apuntan (solo la reciente y no borrada)" "1" "$(servicio "select discord_i_encolar_novedades_admin();" | tail -1)"
comprobar "con su texto y su enlace" "Escrita en Admin|fichas.html" "$(sql "select (contenido ->> 'texto') || '|' || (contenido ->> 'enlace') from discord_cola where origen = 'novedad'")"
comprobar "volver a mirar no la repite" "0" "$(servicio "select discord_i_encolar_novedades_admin();" | tail -1)"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_encolar_novedades_admin();")" "permission denied"

echo "== Entradas nuevas del compendio"
sql "truncate discord_cola restart identity; truncate discord_indice_ids; truncate discord_tareas" >/dev/null
comprobar "sin canal «novedades» no toca mirar el índice" "f" "$(sql "delete from discord_canales where evento = 'novedades'" >/dev/null; servicio "select discord_i_indice_toca();" | tail -1)"
sql "insert into discord_canales (evento, canal_id) values ('novedades', '$CG')" >/dev/null
comprobar "con canal, la primera vez sí toca" "t" "$(servicio "select discord_i_indice_toca();" | tail -1)"
comprobar "justo después ya no" "f" "$(servicio "select discord_i_indice_toca();" | tail -1)"
comprobar "a los 9 minutos tampoco" "f" "$(servicio "select discord_i_indice_toca(now() + interval '9 minutes');" | tail -1)"
comprobar "a los 11 minutos sí" "t" "$(servicio "select discord_i_indice_toca(now() + interval '11 minutes');" | tail -1)"
comprobar "la primera vez que se ven los identificadores solo se guardan: no se anuncia todo el compendio" "[]|3" "$(servicio "select discord_i_indice_nuevas(array['a', 'b', 'c'])" | tail -1)|$(sql "select count(*) from discord_indice_ids")"
comprobar "la siguiente devuelve solo los nuevos" "d,e" "$(servicio "select string_agg(x, ',' order by x) from jsonb_array_elements_text(discord_i_indice_nuevas(array['a', 'b', 'd', 'e'])) x" | tail -1)"
comprobar "y los ya vistos no vuelven a salir" "[]" "$(servicio "select discord_i_indice_nuevas(array['a', 'b', 'd', 'e'])" | tail -1)"
contiene "una lista nula se rechaza" "$(servicio "select discord_i_indice_nuevas(null);")" "no válida"
comprobar "un identificador larguísimo no entra" "[]" "$(servicio "select discord_i_indice_nuevas(array[repeat('x', 500)])" | tail -1)"
ITEMS='[{"id": "a", "t": "Entrada A", "c": "Lugares", "p": "compendio.html#e=a"}, {"id": "b", "t": "Entrada B", "c": "Bestiario", "p": "http://malo.test"}]'
comprobar "las entradas nuevas se apuntan en un solo aviso" "1" "$(servicio "select discord_i_encolar_entradas('$ITEMS'::jsonb);" | tail -1)"
comprobar "el mismo grupo no se repite" "0" "$(servicio "select discord_i_encolar_entradas('$ITEMS'::jsonb);" | tail -1)"
comprobar "una ruta que no es una página del sitio se guarda vacía; la buena (con = en el # ) se conserva" "compendio.html#e=a|null" "$(sql "select (contenido -> 'items' -> 0 ->> 'p') || '|' || coalesce(contenido -> 'items' -> 1 ->> 'p', 'null') from discord_cola where origen = 'entradas'")"
comprobar "dice cuántas son en total" "2" "$(sql "select contenido ->> 'total' from discord_cola where origen = 'entradas'")"
comprobar "una lista vacía no se apunta" "0" "$(servicio "select discord_i_encolar_entradas('[]'::jsonb);" | tail -1)"
comprobar "lo que no es una lista tampoco" "0" "$(servicio "select discord_i_encolar_entradas('{\"a\": 1}'::jsonb);" | tail -1)"
comprobar "con 20 entradas solo guarda 8 para mostrar, pero cuenta las 20" "8|20" "$(servicio "select discord_i_encolar_entradas((select jsonb_agg(jsonb_build_object('id', 'x' || g, 't', 'T' || g, 'c', 'C', 'p', 'compendio.html')) from generate_series(1, 20) g))" >/dev/null; sql "select jsonb_array_length(contenido -> 'items') || '|' || (contenido ->> 'total') from discord_cola where origen = 'entradas' order by id desc limit 1")"
comprobar "un grupo de más de 500 no se apunta" "0" "$(servicio "select discord_i_encolar_entradas((select jsonb_agg(jsonb_build_object('id', 'y' || g, 't', 'T', 'c', 'C', 'p', 'compendio.html')) from generate_series(1, 501) g))" | tail -1)"
sql "delete from discord_canales where evento = 'novedades'" >/dev/null
comprobar "sin canal no se apunta" "0" "$(servicio "select discord_i_encolar_entradas('[{\"id\": \"z\", \"t\": \"Z\", \"c\": \"C\", \"p\": \"compendio.html\"}]'::jsonb);" | tail -1)"
contiene "un jugador no puede llamar a las funciones" "$(como $U1 "select discord_i_indice_nuevas(array['a']);")" "permission denied"
contiene "ni a la de si toca" "$(como $U1 "select discord_i_indice_toca();")" "permission denied"
contiene "ni leer los identificadores" "$(como $U1 "select count(*) from discord_indice_ids;")" "permission denied"

echo "== Avisos personales por mensaje privado"
sql "truncate discord_cola restart identity; delete from hipodromo_programa; delete from cartas_crias; update discord_preferencias set cria = false, carrera = false" >/dev/null
servicio "select discord_i_avisos('$D1', true, true);" >/dev/null
servicio "select discord_i_avisos('$D3', false, false);" >/dev/null
sql "insert into hipodromo_programa (n, hora, cierre, publico) values (800, now() + interval '90 seconds', now() + interval '30 seconds', jsonb_build_object('nombre', 'Copa personal', 'entrantes', jsonb_build_array(
  jsonb_build_object('puerta', 1, 'nombre', 'Brasa', 'dueno', jsonb_build_object('id', '$U1', 'nombre', 'Uno')),
  jsonb_build_object('puerta', 2, 'nombre', 'Ceniza', 'dueno', jsonb_build_object('id', '$U1', 'nombre', 'Uno')),
  jsonb_build_object('puerta', 3, 'nombre', 'De Dos', 'dueno', jsonb_build_object('id', '$U2', 'nombre', 'Dos')),
  jsonb_build_object('puerta', 4, 'nombre', 'De Tres', 'dueno', jsonb_build_object('id', '$U3', 'nombre', 'Tres')),
  jsonb_build_object('puerta', 5, 'nombre', 'Salvaje', 'dueno', null),
  jsonb_build_object('puerta', 6, 'nombre', 'De un personaje', 'dueno', jsonb_build_object('id', 'npc:hilda', 'nombre', 'Hilda')))))" >/dev/null
comprobar "se apunta un solo aviso privado (el de Uno; Dos no lo activó, Tres lo apagó, y los personajes no tienen Discord)" "1" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
comprobar "va al mensaje privado de Uno" "dm:$D1" "$(sql "select canal_id from discord_cola where origen = 'dm'")"
comprobar "con sus dos criaturas, y solo las suyas, por puerta" "Brasa|Ceniza" "$(sql "select string_agg(c ->> 'nombre', '|' order by c ->> 'puerta') from discord_cola, jsonb_array_elements(contenido -> 'criaturas') c where origen = 'dm'")"
comprobar "no menciona la carrera de nadie más (nombre de la carrera sí)" "Copa personal" "$(sql "select contenido ->> 'nombre' from discord_cola where origen = 'dm'")"
comprobar "repetir no lo duplica" "0|1" "$(servicio "select discord_i_encolar_personales();" | tail -1)|$(cola "where origen = 'dm'")"
comprobar "caduca cuando sale la carrera" "t" "$(sql "select caduca between now() + interval '80 seconds' and now() + interval '100 seconds' from discord_cola where origen = 'dm'")"
sql "truncate discord_cola restart identity; update hipodromo_programa set publico = publico || '{\"suspendida\": true}'" >/dev/null
comprobar "una carrera suspendida no avisa" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
sql "update hipodromo_programa set publico = publico - 'suspendida', hora = now() + interval '10 minutes', cierre = now() + interval '9 minutes'" >/dev/null
comprobar "ni una que sale dentro de 10 minutos (solo dentro de 2)" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
sql "update hipodromo_programa set hora = now() + interval '90 seconds', cierre = now() + interval '30 seconds'" >/dev/null
servicio "select discord_i_avisos('$D1', null, false);" >/dev/null
comprobar "con el aviso de carrera apagado, no avisa" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
servicio "select discord_i_avisos('$D1', null, true);" >/dev/null
sql "delete from discord_vinculos where discord_id = '$D1'" >/dev/null
comprobar "sin Discord vinculado no hay a quién avisar" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
servicio "select discord_i_vincular('$(codigo $U1)', '$D1', 'Uno#0');" >/dev/null
sql "truncate discord_cola restart identity" >/dev/null
# Crías: lista = en curso y con la fecha de fin ya pasada
# Las claves foráneas de la crianza (corrales, ejemplares) no importan aquí: se apagan solo para esta inserción
P="set session_replication_role = replica;"
sql "$P insert into cartas_catalogo (id, rareza, publicada, tipo) values ('hidra-t', 'rara', true, 'Criatura') on conflict (id) do nothing; insert into cartas_definiciones (id, data) values ('hidra-t', '{\"nombre\": \"Hidra\"}') on conflict (id) do nothing;" >/dev/null
sql "$P insert into cartas_crias (user_id, carta_id, habitat, ejemplar_a, ejemplar_b, fases, inicio, fin, estado) values
  ('$U1', 'hidra-t', 'h1', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 hours', now() - interval '1 minute', 'en_curso'),
  ('$U1', 'hidra-t', 'h2', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '5 hours', now() + interval '2 hours', 'en_curso'),
  ('$U1', 'hidra-t', 'h3', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 days', now() - interval '2 days', 'en_curso'),
  ('$U1', 'hidra-t', 'h4', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 hours', now() - interval '2 minutes', 'nacida'),
  ('$U1', 'hidra-t', 'h5', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 hours', now() - interval '2 minutes', 'cancelada'),
  ('$U2', 'hidra-t', 'h1', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 hours', now() - interval '2 minutes', 'en_curso'),
  ('$U3', 'hidra-t', 'h1', gen_random_uuid(), gen_random_uuid(), '[]', now() - interval '3 hours', now() - interval '2 minutes', 'en_curso')" >/dev/null
sql "update hipodromo_programa set hora = now() + interval '1 hour', cierre = now() + interval '59 minutes'" >/dev/null
comprobar "una sola cría lista avisa (la de Uno: en curso y ya terminada; no las de hace días, ni nacidas, ni canceladas, ni las de quien no lo activó)" "1" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
comprobar "va a su mensaje privado con el nombre de la criatura" "dm:$D1|Hidra" "$(sql "select canal_id || '|' || (contenido ->> 'cria') from discord_cola where origen = 'dm'")"
comprobar "repetir no la duplica" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
servicio "select discord_i_avisos('$D1', false);" >/dev/null
sql "truncate discord_cola restart identity" >/dev/null
comprobar "con el aviso de crías apagado, no avisa" "0" "$(servicio "select discord_i_encolar_personales();" | tail -1)"
contiene "un jugador no puede llamar a la función" "$(como $U1 "select discord_i_encolar_personales();")" "permission denied"

echo "== La cola: no insistir y guardar las novedades más tiempo"
sql "truncate discord_cola restart identity" >/dev/null
sql "insert into discord_cola (origen, clave, canal_id, contenido, caduca) values ('dm', 'dm:x', 'dm:$D1', '{}', now() + interval '1 hour')" >/dev/null
servicio "select count(*) from discord_i_tomar_cola(5);" >/dev/null
servicio "select discord_i_marcar_cola(1, false, 'no acepta mensajes', 0);" >/dev/null
comprobar "con espera 0 se da por perdido a la primera (no insiste)" "fallido|1" "$(sql "select estado || '|' || intentos from discord_cola")"
sql "truncate discord_cola restart identity" >/dev/null
sql "insert into discord_cola (origen, clave, canal_id, contenido, caduca, estado, creado) values
  ('novedad', 'n1', '$CG', '{}', now(), 'enviado', now() - interval '30 days'),
  ('novedad', 'n2', '$CG', '{}', now(), 'enviado', now() - interval '70 days'),
  ('entradas', 'e1', '$CG', '{}', now(), 'enviado', now() - interval '30 days'),
  ('carrera', 'c1', '$CG', '{}', now(), 'enviado', now() - interval '10 days'),
  ('resumen', 'r1', '$CG', '{}', now(), 'enviado', now() - interval '3 days')" >/dev/null
comprobar "la limpieza borra lo de 7 días, pero guarda 60 las novedades y las entradas nuevas (para no anunciarlas otra vez)" "2|3" "$(servicio "select discord_i_limpiar_cola();" | tail -1)|$(cola)"

echo "== Permisos de lo nuevo"
for f in "discord_i_num('1'::jsonb)" "discord_i_ficha_mod('{}'::jsonb, 'fue')" "discord_i_ficha_resumen('{}'::jsonb)"; do
  contiene "un jugador no puede llamar a $f" "$(como $U1 "select $f;")" "permission denied"
  contiene "ni sin sesión: $f" "$(anonimo "select $f;")" "permission denied"
done
contiene "un jugador no puede leer las tareas internas" "$(como $U1 "select count(*) from discord_tareas;")" "permission denied"

echo
if [ "$FALLOS" = "0" ]; then echo "Todo bien."; else echo "FALLOS: $FALLOS"; exit 1; fi
