#!/bin/sh
# Avisos de Discord (docs/discord-avisos.sql): la cola, el aviso de «la carrera sale en 2 minutos», los reintentos y los permisos.
# Uso: BD=discord sh docs/pruebas/cargar_local.sh todo && BD=discord sh docs/pruebas/t_discord_avisos.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${BD:-pruebas}"
corre() { docker exec -i cartas-pruebas psql -U postgres -d "$BASE" -q -v ON_ERROR_STOP=1 < "$1" >/dev/null || { echo "No corrió $1"; exit 1; }; }
# La tabla de carreras de producción (solo las columnas que se leen)
sql "create table if not exists hipodromo_programa (n int primary key, hora timestamptz not null, cierre timestamptz not null, publico jsonb not null default '{}'); delete from hipodromo_programa;" >/dev/null
corre "$DOCS/discord.sql"
corre "$DOCS/discord-avisos.sql"
corre "$DOCS/discord-avisos.sql"   # se puede repetir
echo "(discord-avisos.sql corre dos veces sin error)"
sql "truncate discord_cola restart identity; delete from discord_canales;" >/dev/null
CANAL=444444444444444444
carrera() { sql "insert into hipodromo_programa (n, hora, cierre, publico) values ($1, now() + interval '$2', now() + interval '$2' - interval '1 minute', '$3'::jsonb) on conflict (n) do update set hora = excluded.hora, cierre = excluded.cierre, publico = excluded.publico"; }
cola() { sql "select count(*) from discord_cola $1"; }

echo "== Sin canal configurado no se avisa de nada"
carrera 1 "90 seconds" '{"nombre": "Copa de prueba", "grado": "gran", "pista": "ceniza", "bolsa": 5000, "dist": 1600}'
comprobar "no se apunta nada" "0|0" "$(servicio "select discord_i_encolar_carreras();" | tail -1)|$(cola)"

echo "== Con canal: solo las carreras que salen en 2 minutos o menos"
sql "insert into discord_canales (evento, canal_id) values ('carrera', '$CANAL')" >/dev/null
carrera 2 "5 minutes" '{"nombre": "Lejana"}'
carrera 3 "-1 minutes" '{"nombre": "Ya salió"}'
carrera 4 "100 seconds" '{"nombre": "Suspendida", "suspendida": true}'
comprobar "se apunta una (la que sale en 90 s); la lejana, la que ya salió y la suspendida no" "1" "$(servicio "select discord_i_encolar_carreras();" | tail -1)"
comprobar "y es la carrera 1" "carrera:1" "$(sql "select clave from discord_cola")"
comprobar "la cola dice a qué canal va" "$CANAL" "$(sql "select canal_id from discord_cola")"
comprobar "guarda los datos públicos de la carrera" "Copa de prueba|ceniza|5000" "$(sql "select (contenido ->> 'nombre') || '|' || (contenido ->> 'pista') || '|' || (contenido ->> 'bolsa') from discord_cola")"
comprobar "no guarda nada más que eso (sin resultados)" "n,hora,cierre,nombre,grado,pista,dist,bolsa" "$(sql "select string_agg(k, ',' order by case k when 'n' then 1 when 'hora' then 2 when 'cierre' then 3 when 'nombre' then 4 when 'grado' then 5 when 'pista' then 6 when 'dist' then 7 else 8 end) from (select jsonb_object_keys(contenido) k from discord_cola) x")"
comprobar "correr la mirada otra vez no apunta un segundo aviso" "0|1" "$(servicio "select discord_i_encolar_carreras();" | tail -1)|$(cola)"
sql "update discord_canales set activo = false" >/dev/null
carrera 5 "60 seconds" '{"nombre": "Con el canal pausado"}'
comprobar "con el canal pausado no se apunta nada" "0" "$(servicio "select discord_i_encolar_carreras();" | tail -1)"
sql "update discord_canales set activo = true" >/dev/null
sql "delete from hipodromo_programa where n in (2, 3, 4, 5)" >/dev/null

echo "== Tomar de la cola"
T=$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)
comprobar "se toma el aviso pendiente" "1" "$T"
comprobar "queda reservado: una segunda llamada seguida no lo toma" "0" "$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)"
comprobar "cuenta el intento" "1" "$(sql "select intentos from discord_cola")"

echo "== Anotar el resultado"
servicio "select discord_i_marcar_cola(1, false, 'Discord no contesta', 20);" >/dev/null
comprobar "un fallo lo deja pendiente con su error" "pendiente|Discord no contesta" "$(sql "select estado || '|' || ultimo_error from discord_cola")"
comprobar "y no se vuelve a tomar hasta que pase la espera (20 s)" "0" "$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)"
sql "update discord_cola set proximo_intento = now() - interval '1 second'" >/dev/null
comprobar "pasada la espera, se vuelve a tomar" "1" "$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)"
servicio "select discord_i_marcar_cola(1, true);" >/dev/null
comprobar "un envío bueno lo deja como enviado" "enviado" "$(sql "select estado from discord_cola")"
comprobar "y ya no sale nunca más" "0" "$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)"
servicio "select discord_i_marcar_cola(1, false, 'tarde', 20);" >/dev/null
comprobar "anotar de nuevo algo ya resuelto no lo cambia" "enviado" "$(sql "select estado from discord_cola")"

echo "== Cinco intentos fallidos y se da por perdido"
carrera 6 "100 seconds" '{"nombre": "Rebelde"}'
servicio "select discord_i_encolar_carreras();" >/dev/null
for i in 1 2 3 4 5; do
  sql "update discord_cola set proximo_intento = now() - interval '1 second', reservado_hasta = null where clave = 'carrera:6' and estado = 'pendiente'" >/dev/null
  servicio "select count(*) from discord_i_tomar_cola(10);" >/dev/null
  servicio "select discord_i_marcar_cola((select id from discord_cola where clave = 'carrera:6'), false, 'Missing Access', 5);" >/dev/null
done
comprobar "al quinto fallo queda como fallido, con el motivo" "fallido|Missing Access|5" "$(sql "select estado || '|' || ultimo_error || '|' || intentos from discord_cola where clave = 'carrera:6'")"
contiene "un error larguísimo se recorta a 200 caracteres" "$(servicio "select discord_i_marcar_cola(1, false, '$(printf 'x%.0s' $(seq 1 500))', 5);" 2>&1 | head -2)" ""
comprobar "ningún error guardado pasa de 200 caracteres" "0" "$(sql "select count(*) from discord_cola where length(ultimo_error) > 200")"

echo "== Los avisos que llegan tarde caducan en vez de mandarse"
carrera 7 "90 seconds" '{"nombre": "Tarde"}'
servicio "select discord_i_encolar_carreras();" >/dev/null
sql "update discord_cola set caduca = now() - interval '1 second', proximo_intento = now() - interval '1 second' where clave = 'carrera:7'" >/dev/null
comprobar "no se toma" "0" "$(servicio "select count(*) from discord_i_tomar_cola(10);" | tail -1)"
comprobar "queda como caducado" "caducado" "$(sql "select estado from discord_cola where clave = 'carrera:7'")"

echo "== Cuántos se toman a la vez"
sql "truncate discord_cola restart identity" >/dev/null
sql "insert into discord_cola (origen, clave, canal_id, contenido, caduca) select 'carrera', 'carrera:' || g, '$CANAL', '{}', now() + interval '1 hour' from generate_series(100, 140) g" >/dev/null
comprobar "pedir 1000 solo da 25 como mucho" "25" "$(servicio "select count(*) from discord_i_tomar_cola(1000);" | tail -1)"
comprobar "pedir 0 da 1 como mínimo" "1" "$(servicio "select count(*) from discord_i_tomar_cola(0);" | tail -1)"

echo "== Limpieza"
sql "truncate discord_cola restart identity" >/dev/null
sql "insert into discord_cola (origen, clave, canal_id, contenido, caduca, estado, creado) values ('carrera', 'a', '$CANAL', '{}', now(), 'enviado', now() - interval '8 days'), ('carrera', 'b', '$CANAL', '{}', now(), 'enviado', now() - interval '1 day'), ('carrera', 'c', '$CANAL', '{}', now() + interval '1 hour', 'pendiente', now() - interval '9 days')" >/dev/null
comprobar "borra lo resuelto de hace más de una semana, y nada más" "1|2" "$(servicio "select discord_i_limpiar_cola();" | tail -1)|$(cola)"

echo "== Permisos"
for f in "discord_i_encolar_carreras()" "discord_i_tomar_cola(5)" "discord_i_marcar_cola(1, true)" "discord_i_limpiar_cola()"; do
  contiene "un jugador no puede llamar a $f" "$(como $U1 "select $f;")" "permission denied"
  contiene "ni sin sesión: $f" "$(anonimo "select $f;")" "permission denied"
done
contiene "un jugador no puede leer la cola" "$(como $U1 "select count(*) from discord_cola;")" "permission denied"
contiene "ni los canales" "$(como $U1 "select count(*) from discord_canales;")" "permission denied"
contiene "ni escribir un canal" "$(como $U1 "insert into discord_canales (evento, canal_id) values ('carrera', '1');")" "permission denied"
contiene "el identificador de canal tiene que ser un número de Discord" "$(sql "insert into discord_canales (evento, canal_id) values ('otro', 'no-es-un-canal');" 2>&1)" "violates check"

echo
if [ "$FALLOS" = "0" ]; then echo "Todo bien."; else echo "FALLOS: $FALLOS"; exit 1; fi
