#!/bin/sh
# Crónica del mundo (docs/cronica-1_base.sql y docs/cronica-2_disparadores.sql): quién ve qué, anonimato, umbrales de cada tipo y que un fallo de la crónica no rompe el juego.
# Usa su propia base para no chocar con otras sesiones:
#   BD=cronica sh docs/pruebas/cargar_local.sh todo && BD=cronica sh docs/pruebas/t_cronica.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
BD="${BD:-pruebas}"
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="docker exec -i cartas-pruebas psql -U postgres -d $BD -q -v ON_ERROR_STOP=1"
cargar() { $PSQL < "$DOCS/$1" >/dev/null || { echo "No corrió $1"; exit 1; }; }

# La base local no trae las tablas del Hipódromo ni la excepción de Side: se cargan aquí
cargar hipodromo.sql
cargar admin/side_excepciones.sql
# Tablas de puntajes (en producción las crean scratchpad/hooey_ranking.sql, ritmo_puntajes.sql, parranda.sql y minijuegos_estadisticas.sql; aquí, con las mismas columnas)
$PSQL >/dev/null <<'SQLX'
create table if not exists hooey_puntajes (user_id uuid primary key references auth.users(id) on delete cascade, username text not null, total bigint not null default 0, mejor_racha int not null default 0, updated_at timestamptz not null default now());
create table if not exists ritmo_puntajes (user_id uuid not null references auth.users(id) on delete cascade, cancion text not null, dificultad text not null, username text not null, puntos int not null default 0, precision numeric(5,1) not null default 0, rango text not null default 'D', combo_max int not null default 0, jugadas int not null default 1, updated_at timestamptz not null default now(), primary key (user_id, cancion, dificultad));
create table if not exists parranda_puntajes (user_id uuid not null references auth.users(id) on delete cascade, cancion text not null, dificultad text not null, mapa_version text not null default 'auto', username text not null, puntos int not null default 0, precision numeric(5,1) not null default 0, rango text not null default 'D', combo_max int not null default 0, jugadas int not null default 1, updated_at timestamptz not null default now(), primary key (user_id, cancion, dificultad, mapa_version));
create table if not exists mj_estadisticas (user_id uuid not null references auth.users(id) on delete cascade, juego text not null check (juego in ('duelo', 'ajedrez', 'arqueria')), clave text not null, username text not null, partidas int not null default 0, victorias int not null default 0, derrotas int not null default 0, tablas int not null default 0, updated_at timestamptz not null default now(), primary key (user_id, juego, clave));
SQLX
cargar cronica-1_base.sql
cargar cronica-2_disparadores.sql
cargar cronica-1_base.sql          # se puede repetir sin romper nada
cargar cronica-2_disparadores.sql

n() { sql "select count(*) from cronica_sucesos where $1"; }
ver() { como "$1" "select jsonb_array_length(cronica_ver(${2:-100}) -> 'sucesos');" | tail -1; }
vaciar() { sql "truncate cronica_sucesos restart identity" >/dev/null; sql "update cronica_tipos set activo = (tipo <> 'partida_dificil')" >/dev/null; }
NOM() { sql "select username from perfiles where user_id = '$1'"; }
# Lo que ve un jugador en el primer suceso: usuario | otro | anónimo
ANON() { como "$1" "select coalesce(s->>'user', '-') || '|' || coalesce(s->>'otro', '-') || '|' || (s->>'anonimo') from jsonb_array_elements(cronica_ver(${2:-5})->'sucesos') s;" | tail -1; }
# Ayudantes de las pruebas de apuestas (Hipódromo y Veintiuna)
ap() { sql "insert into hipodromo_apuestas (usuario, n, tipo, sel, nombres, carrera, monto, cuota, doble, origen) values ('$1', ${2:-1}, 'ganador', '1', '[\"Rayo\"]', 'Gran Premio', $3, 5, ${4:-false}, ${5:-null}) returning id" | head -1; }
gana() { sql "update hipodromo_apuestas set estado = 'ganada', pago = $2 where id = $1" >/dev/null; }
vp() { sql "insert into veintiuna_partidas (user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier) values ('$1', gen_random_uuid(), '$2', $3, 'maldicion', '{1,2,3}', 4, '{1,2}', '{3,4}') returning id" | head -1; }
cierra() { sql "update veintiuna_partidas set estado = 'terminada', resultado = 'victoria', pago = $2 where id = '$1'" >/dev/null; }
sql "update perfiles set side = 'A' where user_id in ('$U1', '$U2'); update perfiles set side = 'B' where user_id in ('$U3', '$U4');" >/dev/null
sql "update cartas_catalogo set en_circulacion = true where id <> 'bufon';" >/dev/null 2>&1
limpiar; vaciar
sql "truncate hipodromo_apuestas, hipodromo_carreras, hipodromo_criaturas, veintiuna_estadisticas, veintiuna_logros, veintiuna_partidas, hooey_puntajes, ritmo_puntajes, parranda_puntajes, mj_estadisticas cascade" >/dev/null

echo "== Instalación"
comprobar "los catorce disparadores están puestos" "14" "$(sql "select count(*) from pg_trigger where tgname ~ '^cronica_' and not tgisinternal")"
comprobar "los quince tipos están sembrados" "15" "$(sql "select count(*) from cronica_tipos")"
comprobar "volver a correr los archivos no duplica los tipos" "15" "$(sql "select count(*) from cronica_tipos")"
comprobar "la partida difícil nace apagada" "f" "$(sql "select activo from cronica_tipos where tipo = 'partida_dificil'")"

echo "== Permisos"
contiene "sin sesión no se lee" "$(anonimo "select cronica_ver(5);")" "permission denied"
contiene "sin sesión no se cuenta" "$(anonimo "select cronica_contar(now());")" "permission denied"
contiene "un jugador no puede llamar a la función interna" "$(como $U1 "select cronica_i_anotar('nota', null, null, null, '{}', 'x');")" "permission denied"
contiene "ni leer la tabla directo" "$(como $U1 "select count(*) from cronica_sucesos;")" "permission denied"
contiene "ni escribir en ella" "$(como $U1 "insert into cronica_sucesos (juego, tipo) values ('x', 'y');")" "permission denied"
contiene "ni leer los tipos" "$(como $U1 "select count(*) from cronica_tipos;")" "permission denied"
contiene "un jugador no puede escribir noticias" "$(como $U1 "select cronica_publicar('hola');")" "No autorizado"
contiene "ni ocultar" "$(como $U1 "select cronica_ocultar(1);")" "No autorizado"
contiene "ni cambiar los tipos" "$(como $U1 "select cronica_tipo_guardar('nota', false, '{}'::jsonb);")" "No autorizado"
contiene "ni ver la lista del admin" "$(como $U1 "select cronica_admin_ver();")" "No autorizado"
contiene "ni disparar un disparador a mano" "$(como $U1 "select cronica_t_carta();")" "permission denied"

echo "== Noticias del Admin"
contiene "el admin escribe una noticia" "$(como $ADMIN "select cronica_publicar('El puente de Valmar cayó anoche.', null, 'compendio.html');")" "1"
comprobar "todos la ven (sin Side)" "1|1|1" "$(ver $U1)|$(ver $U3)|$(ver $ADMIN)"
contiene "una noticia vacía se rechaza" "$(como $ADMIN "select cronica_publicar('   ');")" "entre 1 y 240"
contiene "una noticia demasiado larga se rechaza" "$(como $ADMIN "select cronica_publicar(repeat('x', 241));")" "entre 1 y 240"
contiene "un Side inventado se rechaza" "$(como $ADMIN "select cronica_publicar('x', 'C');")" "A o B"
contiene "un enlace raro se rechaza" "$(como $ADMIN "select cronica_publicar('x', null, 'http://malo.com');")" "violates check"
como $ADMIN "select cronica_publicar('Solo para el Side A.', 'A');" >/dev/null
comprobar "una noticia de un Side solo la ve ese Side (y el admin)" "2|1|2" "$(ver $U1)|$(ver $U3)|$(ver $ADMIN)"
comprobar "el contador respeta lo mismo" "2|1" "$(como $U1 "select cronica_contar(now() - interval '1 day') ->> 'n';" | tail -1)|$(como $U3 "select cronica_contar(now() - interval '1 day') ->> 'n';" | tail -1)"
ID=$(sql "select id from cronica_sucesos where datos->>'texto' like 'Solo para%'")
como $ADMIN "select cronica_ocultar($ID);" >/dev/null
comprobar "ocultar la quita de la lista de todos" "1|1" "$(ver $U1)|$(ver $ADMIN)"
comprobar "pero el admin la sigue viendo en su revisión" "2" "$(como $ADMIN "select jsonb_array_length(cronica_admin_ver());" | tail -1)"
como $ADMIN "select cronica_ocultar($ID, false);" >/dev/null
comprobar "y se puede volver a mostrar" "2" "$(ver $U1)"
contiene "ocultar algo que no existe avisa" "$(como $ADMIN "select cronica_ocultar(99999);")" "no existe"

echo "== Excepción de Side"
como $ADMIN "select side_excepcion_dar('$U3', 'prueba');" >/dev/null
comprobar "quien tiene la excepción ve también lo del otro Side" "2" "$(ver $U3)"
como $ADMIN "select side_excepcion_quitar('$U3');" >/dev/null
comprobar "al quitarla vuelve a ver solo lo suyo" "1" "$(ver $U3)"
vaciar

echo "== Tipos: encender, apagar y umbrales"
como $ADMIN "select cronica_tipo_guardar('nota', false, '{\"dias\": 60}'::jsonb);" >/dev/null
nocontiene "con un tipo apagado el Admin puede publicar, pero la función interna no anota" "$(sql "select cronica_i_anotar('nota', null, null, null, '{}', 'k1')")" "1"
comprobar "no se anotó nada" "0" "$(n "clave = 'k1'")"
como $ADMIN "select cronica_tipo_guardar('nota', true, '{\"dias\": 60}'::jsonb);" >/dev/null
comprobar "encendido otra vez, sí" "t" "$(sql "select cronica_i_anotar('nota', null, null, null, '{}', 'k1') is not null")"
comprobar "la misma clave no se anota dos veces" "1" "$(sql "select cronica_i_anotar('nota', null, null, null, '{}', 'k1'); select count(*) from cronica_sucesos where clave = 'k1'" | tail -1)"
contiene "una configuración que no es un objeto se rechaza" "$(como $ADMIN "select cronica_tipo_guardar('nota', true, '[1]'::jsonb);")" "objeto JSON"
contiene "un tipo que no existe se avisa" "$(como $ADMIN "select cronica_tipo_guardar('nada', true, '{}'::jsonb);")" "no existe"
comprobar "el panel del admin lista los tipos" "15" "$(como $ADMIN "select jsonb_array_length(cronica_admin_tipos());" | tail -1)"
vaciar

echo "== Cartas ganadas"
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'comun-1', 'juego', 'sellos:ajedrez')" >/dev/null
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'poco-1', 'juego', 'sellos:ajedrez')" >/dev/null
comprobar "una común y una infrecuente no se anotan" "0" "$(n "tipo = 'carta_ganada'")"
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-1', 'juego', 'sellos:ajedrez')" >/dev/null
comprobar "una rara ganada con sellos sí" "1" "$(n "tipo = 'carta_ganada' and user_id = '$U1' and datos->>'origen' = 'sellos'")"
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-2', 'admin', 'regalo')" >/dev/null
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-2', 'juego', 'mercader')" >/dev/null
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-2', 'juego', 'cria:123')" >/dev/null
comprobar "ni un regalo del Admin, ni una compra al Buhonero, ni una cría (esa tiene su tipo anónimo)" "1" "$(n "tipo = 'carta_ganada'")"
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-3', 'juego', 'forja:abc')" >/dev/null
comprobar "forjar una rara se anota con su origen" "forja" "$(sql "select datos->>'origen' from cronica_sucesos where tipo = 'carta_ganada' and datos->>'nombre' is not null order by id desc limit 1")"
E=$(dar $U2 legendaria-1)
sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U2', 'legendaria-1', 'juego', 'sellos:veintiuna')" >/dev/null
comprobar "una legendaria lleva el número de su copia" "1" "$(sql "select datos->>'numero' from cronica_sucesos where tipo = 'carta_ganada' and user_id = '$U2'")"
sql "delete from cronica_sucesos" >/dev/null
for c in rara-1 rara-2 rara-3 rara-1 rara-2 rara-3; do sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', '$c', 'juego', 'sellos:ajedrez')" >/dev/null; done
comprobar "pasado el tope de 3 al día se junta en una sola línea" "3|1" "$(n "tipo = 'carta_ganada' and not (datos ? 'resumen')")|$(n "datos ? 'resumen'")"
comprobar "que dice cuántas fueron" "6" "$(sql "select datos->>'n' from cronica_sucesos where datos ? 'resumen'")"
R=$(como $U1 "select cronica_ver(20) -> 'sucesos' -> 0 ->> 'user';" | tail -1)
comprobar "las cartas ganadas sí llevan nombre" "$(NOM $U1)" "$R"
vaciar

echo "== Cartas ganadas a otro jugador (pozo de Veintiuna y apuestas de cartas)"
limpiar; vaciar
mov() { sql "insert into cartas_movimientos (ejemplar, carta_id, tipo, de, a, motivo, referencia) values ('$1', '$2', 'transferencia', '$3', '$4', '$5', 'x')" >/dev/null; }
EJ=$(dar $U1 rara-1); mov $EJ rara-1 $U1 $U2 "apuesta ganada"
comprobar "ganar una rara en una apuesta de cartas se anota, con el nombre del ganador" "1|apuesta|$U2" "$(n "tipo = 'carta_ganada'")|$(sql "select datos->>'origen' from cronica_sucesos where tipo = 'carta_ganada'")|$(sql "select user_id from cronica_sucesos where tipo = 'carta_ganada'")"
EJL=$(dar $U1 legendaria-1); mov $EJL legendaria-1 $U1 $U3 "pozo ganado en Las Veintiuna Velas"
comprobar "el pozo de Veintiuna también, con el número de copia" "pozo|1" "$(sql "select datos->>'origen' from cronica_sucesos where user_id = '$U3'")|$(sql "select datos->>'numero' from cronica_sucesos where user_id = '$U3'")"
EJC=$(dar $U1 comun-1); mov $EJC comun-1 $U1 $U2 "apuesta ganada"
comprobar "una carta común ganada así no" "2" "$(n "tipo = 'carta_ganada'")"
EJ2=$(dar $U1 rara-2); mov $EJ2 rara-2 $U1 $U2 "intercambio"
mov $EJ2 rara-2 $U2 $U1 "regalo del admin"
comprobar "ni un intercambio ni un regalo: esos tienen su propio tipo o no cuentan" "2" "$(n "tipo = 'carta_ganada'")"
vaciar

echo "== Premios grandes por sí solos"
I=$(ap $U1 1 1000); gana $I 1500
comprobar "una apuesta de Hipódromo que paga 1500 se anota aunque sea solo 1,5 veces" "1" "$(n "tipo = 'apuesta_hipodromo'")"
I=$(ap $U1 2 800); gana $I 900
comprobar "900 por 800 no (ni 4 veces ni 1000)" "1" "$(n "tipo = 'apuesta_hipodromo'")"
V=$(vp $U1 apuesta 600); cierra $V 1200
comprobar "una mesa de Veintiuna que paga 1200 se anota aunque sea 2 veces" "1" "$(n "tipo = 'apuesta_veintiuna'")"
sql "update cronica_tipos set config = '{\"ratio\": 4, \"min_pago\": 200, \"pago_siempre\": 5000}' where tipo = 'apuesta_hipodromo'" >/dev/null
I=$(ap $U1 3 1000); gana $I 1500
comprobar "el umbral se cambia desde el Admin (pago_siempre)" "1" "$(n "tipo = 'apuesta_hipodromo'")"
sql "update cronica_tipos set config = '{\"ratio\": 4, \"min_pago\": 200}' where tipo = 'apuesta_hipodromo'" >/dev/null
vaciar

echo "== Intercambios (anónimos)"
X=$(dar $U1 rara-1); Y=$(dar $U2 rara-2)
T=$(como $U1 "select cartas_ofrecer(null, array['$X']::uuid[], '[{\"carta\":\"rara-2\",\"n\":1}]'::jsonb, '');" | tail -1)
como $U2 "select cartas_aceptar_trueque('$T', array['$Y']::uuid[]);" >/dev/null
comprobar "un trueque con cartas raras se anota" "1" "$(n "tipo = 'intercambio'")"
comprobar "guarda quién, para el admin" "$U1|$U2" "$(sql "select user_id || '|' || otro_id from cronica_sucesos where tipo = 'intercambio'")"
comprobar "los jugadores no ven quién fue" "-|-|true" "$(ANON $EDITOR)"
comprobar "quien intercambió ve que le toca" "true" "$(como $U1 "select s->>'yo' from jsonb_array_elements(cronica_ver(5)->'sucesos') s;" | tail -1)"
comprobar "y un tercero no" "false" "$(como $EDITOR "select s->>'yo' from jsonb_array_elements(cronica_ver(5)->'sucesos') s;" | tail -1)"
contiene "el admin sí lo ve con nombre" "$(como $ADMIN "select cronica_ver(5)::text;")" "\"user\": \"$(NOM $U1)\""
contiene "en los datos van las cartas, no las personas" "$(sql "select datos::text from cronica_sucesos where tipo = 'intercambio'")" 'rara-2'
nocontiene "ningún nombre de jugador en los datos" "$(sql "select datos::text from cronica_sucesos where tipo = 'intercambio'")" "$(NOM $U1)"
X2=$(dar $U1 comun-1); Y2=$(dar $U2 comun-2)
T2=$(como $U1 "select cartas_ofrecer(null, array['$X2']::uuid[], '[{\"carta\":\"comun-2\",\"n\":1}]'::jsonb, '');" | tail -1)
como $U2 "select cartas_aceptar_trueque('$T2', array['$Y2']::uuid[]);" >/dev/null
comprobar "el otro Side no ve un intercambio que no es suyo" "0" "$(ver $U3)"
comprobar "uno por uno de comunes no se anota" "1" "$(n "tipo = 'intercambio'")"
X3=$(dar $U1 comun-3); X4=$(dar $U1 comun-4); Y3=$(dar $U2 comun-5)
T3=$(como $U1 "select cartas_ofrecer(null, array['$X3','$X4']::uuid[], '[{\"carta\":\"comun-5\",\"n\":1}]'::jsonb, '');" | tail -1)
como $U2 "select cartas_aceptar_trueque('$T3', array['$Y3']::uuid[]);" >/dev/null
comprobar "pero tres comunes en total sí" "2" "$(n "tipo = 'intercambio'")"
vaciar

echo "== Crías (anónimas)"
A1=$(dar $U1 comun-9); B1=$(dar $U1 comun-9)
sql "insert into cartas_crias (user_id, carta_id, habitat, ejemplar_a, ejemplar_b, fases, fin, estado) values ('$U1', 'comun-9', 'aviario', '$A1', '$B1', '[]', now(), 'en_curso')" >/dev/null
sql "update cartas_crias set estado = 'nacida' where carta_id = 'comun-9'" >/dev/null
comprobar "la primera cría de una especie, aunque sea común, se anota" "1|t" "$(n "tipo = 'cria_nacida'")|$(sql "select datos->>'primera' from cronica_sucesos where tipo = 'cria_nacida'" | sed 's/true/t/')"
sql "insert into cartas_crias (user_id, carta_id, habitat, ejemplar_a, ejemplar_b, fases, fin, estado) values ('$U2', 'comun-9', 'bosque', '$A1', '$B1', '[]', now(), 'en_curso')" >/dev/null
sql "update cartas_crias set estado = 'nacida' where user_id = '$U2'" >/dev/null
comprobar "la segunda de la misma especie común no" "1" "$(n "tipo = 'cria_nacida'")"
sql "insert into cartas_crias (user_id, carta_id, habitat, ejemplar_a, ejemplar_b, fases, fin, estado) values ('$U2', 'rara-3', 'madriguera', '$A1', '$B1', '[]', now(), 'en_curso')" >/dev/null
sql "update cartas_crias set estado = 'nacida' where carta_id = 'rara-3'" >/dev/null
comprobar "una rara se anota" "2" "$(n "tipo = 'cria_nacida'")"
comprobar "no dice de quién es" "-|-|true" "$(ANON $EDITOR 1)"
vaciar

echo "== Apuestas del Hipódromo"
I=$(ap $U1 1 100); gana $I 450
comprobar "450 por 100 (4,5 veces y más de 200) se anota" "1" "$(n "tipo = 'apuesta_hipodromo'")"
comprobar "con el múltiplo" "4.5" "$(sql "select datos->>'mult' from cronica_sucesos where tipo = 'apuesta_hipodromo'")"
I=$(ap $U1 2 100); gana $I 300
comprobar "3 veces no" "1" "$(n "tipo = 'apuesta_hipodromo'")"
I=$(ap $U1 3 30); gana $I 150
comprobar "5 veces pero menos de 200 tokens tampoco" "1" "$(n "tipo = 'apuesta_hipodromo'")"
I=$(ap $U2 4 100 true); gana $I 380
comprobar "con «doble» lo ganado no se cobra: la primera no se anota" "1" "$(n "tipo = 'apuesta_hipodromo'")"
J=$(ap $U2 5 380 false $I); gana $J 600
comprobar "el último eslabón sí, medido contra lo que se apostó al empezar" "2|6.0" "$(n "tipo = 'apuesta_hipodromo'")|$(sql "select datos->>'mult' from cronica_sucesos where tipo = 'apuesta_hipodromo' and user_id = '$U2'")"
sql "update hipodromo_apuestas set pago = 5000 where id = $J" >/dev/null
comprobar "tocar la apuesta después no la anota otra vez" "2" "$(n "tipo = 'apuesta_hipodromo'")"
sql "update cronica_tipos set config = '{\"ratio\": \"muchas\"}' where tipo = 'apuesta_hipodromo'" >/dev/null
K=$(ap $U1 6 100)
R=$(sql "update hipodromo_apuestas set estado = 'ganada', pago = 900 where id = $K returning estado")
comprobar "una configuración rota no impide que el juego cobre" "ganada" "$R"
comprobar "y no se anota nada" "2" "$(n "tipo = 'apuesta_hipodromo'")"
sql "update cronica_tipos set config = '{\"ratio\": 4, \"min_pago\": 200}' where tipo = 'apuesta_hipodromo'" >/dev/null
vaciar

echo "== Copas del Hipódromo"
sql "insert into hipodromo_criaturas (id, nombre, sexo, estado, nac, dueno, publico) values (1, 'Brasa', 'f', 'activo', 0, '$U1', '{}'), (2, 'Salvaje', 'm', 'activo', 0, null, '{}'), (3, 'Trueno', 'm', 'activo', 0, '$U3', '{}')" >/dev/null
sql "insert into hipodromo_carreras (n, hora, resultado) values (10, now() - interval '10 minutes', '{\"grado\": \"copa_oro\", \"nombre\": \"Copa de Oro\", \"llegada\": [{\"id\": 1, \"nombre\": \"Brasa\", \"premio\": 20000}]}'::jsonb)" >/dev/null
comprobar "una copa ganada por una criatura con dueño se anota" "1" "$(n "tipo = 'copa_hipodromo' and user_id = '$U1'")"
sql "insert into hipodromo_carreras (n, hora, resultado) values (11, now() - interval '10 minutes', '{\"grado\": \"copa_plata\", \"nombre\": \"Copa de Plata\", \"llegada\": [{\"id\": 2, \"nombre\": \"Salvaje\", \"premio\": 10000}]}'::jsonb)" >/dev/null
comprobar "una criatura sin dueño no" "1" "$(n "tipo = 'copa_hipodromo'")"
sql "insert into hipodromo_carreras (n, hora, resultado) values (12, now() - interval '10 minutes', '{\"grado\": \"corriente\", \"nombre\": \"Corriente\", \"llegada\": [{\"id\": 1, \"nombre\": \"Brasa\", \"premio\": 400}]}'::jsonb)" >/dev/null
comprobar "una carrera corriente tampoco" "1" "$(n "tipo = 'copa_hipodromo'")"
sql "insert into hipodromo_carreras (n, hora, resultado) values (13, now() + interval '50 minutes', '{\"grado\": \"gran\", \"nombre\": \"Gran Premio\", \"llegada\": [{\"id\": 3, \"nombre\": \"Trueno\", \"premio\": 5000}]}'::jsonb)" >/dev/null
comprobar "el Gran Premio también cuenta" "2" "$(n "tipo = 'copa_hipodromo'")"
comprobar "pero no se enseña hasta que acaba la carrera (no se adelanta el resultado)" "1|0" "$(ver $U1)|$(ver $U3)"
sql "update cronica_sucesos set visible_desde = now() - interval '1 minute' where clave = 'hip:copa:13'" >/dev/null
comprobar "y con la carrera ya corrida aparece (el Side B lo ve)" "1|1" "$(ver $U3)|$(ver $U3 1)"
vaciar

echo "== Rachas de Veintiuna (una sola línea viva)"
sql "insert into veintiuna_estadisticas (user_id, proxima_regla, racha, mejor_racha) values ('$U1', 'maldicion', 0, 0), ('$U2', 'maldicion', 0, 3)" >/dev/null
for r in 1 2 3; do sql "update veintiuna_estadisticas set racha = $r where user_id = '$U1'" >/dev/null; done
comprobar "hasta tres victorias no se anota" "0" "$(n "tipo = 'racha_veintiuna'")"
sql "update veintiuna_estadisticas set racha = 4, mejor_racha = 4 where user_id = '$U1'" >/dev/null
comprobar "a la cuarta nace la línea" "1|4|true" "$(n "tipo = 'racha_veintiuna'")|$(sql "select datos->>'racha' from cronica_sucesos where tipo = 'racha_veintiuna'")|$(sql "select datos->>'activa' from cronica_sucesos where tipo = 'racha_veintiuna'")"
comprobar "es récord: supera la mejor racha de los demás (3)" "true" "$(sql "select datos->>'record' from cronica_sucesos where tipo = 'racha_veintiuna'")"
for r in 5 6 7; do sql "update veintiuna_estadisticas set racha = $r, mejor_racha = $r where user_id = '$U1'" >/dev/null; done
comprobar "mientras dura sigue siendo UNA línea, puesta al día" "1|7|true" "$(n "tipo = 'racha_veintiuna'")|$(sql "select datos->>'racha' from cronica_sucesos where tipo = 'racha_veintiuna'")|$(sql "select datos->>'activa' from cronica_sucesos where tipo = 'racha_veintiuna'")"
sql "update veintiuna_estadisticas set racha = 0 where user_id = '$U1'" >/dev/null
comprobar "al perder se cierra con la racha que llevaba" "1|7|false" "$(n "tipo = 'racha_veintiuna'")|$(sql "select datos->>'racha' from cronica_sucesos where tipo = 'racha_veintiuna'")|$(sql "select datos->>'activa' from cronica_sucesos where tipo = 'racha_veintiuna'")"
for r in 1 2 3 4; do sql "update veintiuna_estadisticas set racha = $r where user_id = '$U1'" >/dev/null; done
comprobar "una racha nueva abre otra línea y la vieja queda cerrada" "2|1" "$(n "tipo = 'racha_veintiuna'")|$(n "tipo = 'racha_veintiuna' and datos->>'activa' = 'true'")"
sql "update veintiuna_estadisticas set racha = 2 where user_id = '$U2'" >/dev/null
sql "update veintiuna_estadisticas set racha = 1 where user_id = '$U2'" >/dev/null
comprobar "quien no llegó a cuatro no deja nada al perder" "0" "$(n "tipo = 'racha_veintiuna' and user_id = '$U2'")"
vaciar

echo "== Desafíos de oro de Veintiuna"
sql "insert into veintiuna_logros (user_id, logro) values ('$U1', 'primera_vela')" >/dev/null
comprobar "uno de bronce no se anota" "0" "$(n "tipo = 'logro_oro_veintiuna'")"
sql "insert into veintiuna_logros (user_id, logro) values ('$U1', 'cinco_cartas')" >/dev/null
comprobar "uno de oro sí" "1|Cinco cartas sin pasarte" "$(n "tipo = 'logro_oro_veintiuna'")|$(sql "select datos->>'nombre' from cronica_sucesos where tipo = 'logro_oro_veintiuna'")"
sql "delete from veintiuna_logros where user_id = '$U1'; insert into veintiuna_logros (user_id, logro) values ('$U1', 'cinco_cartas')" >/dev/null
comprobar "repetirlo el mismo día no duplica la línea" "1" "$(n "tipo = 'logro_oro_veintiuna'")"
sql "update cronica_sucesos set clave = replace(clave, to_char(now() at time zone 'utc', 'YYYYMMDD'), '20200101') where tipo = 'logro_oro_veintiuna'" >/dev/null
sql "delete from veintiuna_logros where user_id = '$U1'; insert into veintiuna_logros (user_id, logro) values ('$U1', 'cinco_cartas')" >/dev/null
comprobar "pero otro día sí puede volver a salir" "2" "$(n "tipo = 'logro_oro_veintiuna'")"
vaciar

echo "== Récord de Hooey"
sql "insert into hooey_puntajes (user_id, username, total, mejor_racha) values ('$U1', 'Uno', 50, 5)" >/dev/null
comprobar "el primer jugador no es récord (no hay otro)" "0" "$(n "tipo = 'record_hooey'")"
sql "insert into hooey_puntajes (user_id, username, total, mejor_racha) values ('$U2', 'Dos', 10, 3)" >/dev/null
comprobar "uno que entra por debajo tampoco" "0" "$(n "tipo = 'record_hooey'")"
sql "update hooey_puntajes set mejor_racha = 7 where user_id = '$U2'" >/dev/null
comprobar "quien pasa al primero sale, con el nombre del anterior" "1|7|Uno" "$(n "tipo = 'record_hooey'")|$(sql "select datos->>'racha' from cronica_sucesos where tipo = 'record_hooey'")|$(sql "select datos->>'anterior' from cronica_sucesos where tipo = 'record_hooey'")"
sql "update hooey_puntajes set mejor_racha = 9 where user_id = '$U2'" >/dev/null
comprobar "quien ya iba primero y mejora no vuelve a salir" "1" "$(n "tipo = 'record_hooey'")"
sql "update hooey_puntajes set mejor_racha = 12 where user_id = '$U1'" >/dev/null
comprobar "pero si el otro le devuelve el puesto, sí" "2" "$(n "tipo = 'record_hooey'")"
vaciar

echo "== Récords de Zarabanda y Parranda"
rp() { sql "insert into ritmo_puntajes (user_id, cancion, dificultad, username, puntos, rango) values ('$1', '$2', '$3', 'N$1', $4, 'A') on conflict (user_id, cancion, dificultad) do update set puntos = excluded.puntos" >/dev/null; }
rp $U1 "musica/rock/Cancion Rara.mp3" normal 5000
comprobar "con un solo jugador no es récord" "0" "$(n "tipo = 'record_ritmo'")"
rp $U2 "musica/rock/Cancion Rara.mp3" normal 4000
comprobar "entrar por debajo no es récord" "0" "$(n "tipo = 'record_ritmo'")"
rp $U2 "musica/rock/Cancion Rara.mp3" normal 6000
comprobar "tomar el primer puesto sale, con la canción sin carpeta ni extensión" "1|Cancion Rara|6000" "$(n "tipo = 'record_ritmo'")|$(sql "select datos->>'cancion' from cronica_sucesos where tipo = 'record_ritmo'")|$(sql "select datos->>'puntos' from cronica_sucesos where tipo = 'record_ritmo'")"
rp $U2 "musica/rock/Cancion Rara.mp3" normal 7000
comprobar "mejorar el propio primer puesto no repite" "1" "$(n "tipo = 'record_ritmo'")"
rp $U1 "musica/rock/Cancion Rara.mp3" experto 100
comprobar "otra dificultad es otro marcador" "1" "$(n "tipo = 'record_ritmo'")"
pp() { sql "insert into parranda_puntajes (user_id, cancion, dificultad, mapa_version, username, puntos, rango) values ('$1', 'p/Tema.ogg', 'normal', '$2', 'N$1', $3, 'S') on conflict (user_id, cancion, dificultad, mapa_version) do update set puntos = excluded.puntos" >/dev/null; }
pp $U1 auto 3000; pp $U2 v2 9000
comprobar "en Parranda cada versión del mapa es otro marcador: sin rival en la misma versión no hay récord" "0" "$(n "tipo = 'record_parranda'")"
pp $U2 auto 3500
comprobar "en la misma versión sí" "1|Tema" "$(n "tipo = 'record_parranda'")|$(sql "select datos->>'cancion' from cronica_sucesos where tipo = 'record_parranda'")"
sql "update cronica_tipos set config = '{\"min_jugadores\": 3}' where tipo = 'record_ritmo'" >/dev/null
rp $U3 "otra/Cancion B.mp3" facil 100; rp $U4 "otra/Cancion B.mp3" facil 200
comprobar "el mínimo de jugadores se cambia desde el Admin" "1" "$(n "tipo = 'record_ritmo'")"
sql "update cronica_tipos set config = '{\"min_jugadores\": 2}' where tipo = 'record_ritmo'" >/dev/null
vaciar

echo "== Líder de Ajedrez y Arquería"
mj() { sql "insert into mj_estadisticas (user_id, juego, clave, username, partidas, victorias) values ('$1', '$2', '$3', 'N$1', $4, $4) on conflict (user_id, juego, clave) do update set victorias = excluded.victorias, partidas = excluded.partidas" >/dev/null; }
mj $U1 ajedrez ilyth 5
comprobar "sin otro jugador no hay líder que cambiar" "0" "$(n "tipo = 'record_minijuego'")"
mj $U2 ajedrez pvp 2
comprobar "con menos de 3 victorias o sin pasar al primero, nada" "0" "$(n "tipo = 'record_minijuego'")"
mj $U2 ajedrez pvp 6
comprobar "pasar al primero con 6 victorias sale" "1|6" "$(n "tipo = 'record_minijuego'")|$(sql "select datos->>'victorias' from cronica_sucesos where tipo = 'record_minijuego'")"
mj $U2 ajedrez pvp 8
comprobar "seguir ganando siendo el primero no repite" "1" "$(n "tipo = 'record_minijuego'")"
mj $U1 duelo ilyth 40; mj $U2 duelo pvp 1
comprobar "el Duelo (oculto) no cuenta" "1" "$(n "tipo = 'record_minijuego'")"
mj $U3 arqueria pvp 4; mj $U4 arqueria pvp 5
comprobar "Arquería también, con su propio marcador" "2" "$(n "tipo = 'record_minijuego'")"
comprobar "el filtro «records» enseña todos los récords" "2|0" "$(como $ADMIN "select jsonb_array_length(cronica_ver(20, null, 'records')->'sucesos');" | tail -1)|$(como $ADMIN "select jsonb_array_length(cronica_ver(20, null, 'cartas')->'sucesos');" | tail -1)"
vaciar

echo "== La Última Vela"
sql "delete from muerte_subita_intentos" >/dev/null
intento() { sql "insert into muerte_subita_intentos (user_id, username, personaje_id, personaje_nombre, desafio) values ('$1', 'x', 'pj-$2', 'PJ $2', 'ultima-vela') returning id" | head -1; }
IN=$(intento $U1 1)
sql "insert into veintiuna_retos (intento, user_id) values ('$IN', '$U1')" >/dev/null
comprobar "mientras el reto está en curso no se anota nada" "0" "$(n "tipo = 'ultima_vela'")"
sql "update veintiuna_retos set ganadas = 2, perdidas = 1 where intento = '$IN'" >/dev/null
comprobar "ni con manos sueltas" "0" "$(n "tipo = 'ultima_vela'")"
sql "update veintiuna_retos set estado = 'ganado', ganadas = 3 where intento = '$IN'" >/dev/null
comprobar "ganar el reto se anota, con el nombre y el marcador" "1|ganado|3|1" "$(n "tipo = 'ultima_vela' and user_id = '$U1'")|$(sql "select datos->>'resultado' from cronica_sucesos where tipo = 'ultima_vela'")|$(sql "select datos->>'ganadas' from cronica_sucesos where tipo = 'ultima_vela'")|$(sql "select datos->>'perdidas' from cronica_sucesos where tipo = 'ultima_vela'")"
sql "update veintiuna_retos set actualizado = now() where intento = '$IN'" >/dev/null
comprobar "tocar la fila después no lo repite" "1" "$(n "tipo = 'ultima_vela'")"
IN2=$(intento $U2 2)
sql "insert into veintiuna_retos (intento, user_id, estado, ganadas, perdidas) values ('$IN2', '$U2', 'en_curso', 1, 2)" >/dev/null
sql "update veintiuna_retos set estado = 'perdido', perdidas = 3 where intento = '$IN2'" >/dev/null
comprobar "perderlo también" "2|perdido" "$(n "tipo = 'ultima_vela'")|$(sql "select datos->>'resultado' from cronica_sucesos where tipo = 'ultima_vela' and user_id = '$U2'")"
comprobar "lo ve todo su Side" "2|2|0" "$(ver $U1)|$(ver $U2)|$(ver $U3)"
vaciar

echo "== Apuestas grandes de Veintiuna"
V=$(vp $U1 apuesta 100); cierra $V 250
comprobar "una mano individual que paga 2,5 veces no llega a 4" "0" "$(n "tipo = 'apuesta_veintiuna'")"
V=$(vp $U1 apuesta 100); cierra $V 450
comprobar "una mesa que paga 4,5 veces sí" "1|4.5" "$(n "tipo = 'apuesta_veintiuna'")|$(sql "select datos->>'mult' from cronica_sucesos where tipo = 'apuesta_veintiuna'")"
V=$(vp $U1 practica 100); cierra $V 900
comprobar "las manos de práctica no cuentan" "1" "$(n "tipo = 'apuesta_veintiuna'")"
V=$(vp $U1 apuesta 20); cierra $V 100
comprobar "ni 5 veces si no llega a 200 tokens" "1" "$(n "tipo = 'apuesta_veintiuna'")"
vaciar

echo "== Quién ve qué en la lista"
sql "select cronica_i_anotar('nota', null, null, 'A', '{\"texto\": \"A\"}', 'a1'), cronica_i_anotar('nota', null, null, 'B', '{\"texto\": \"B\"}', 'b1'), cronica_i_anotar('nota', null, null, null, '{\"texto\": \"todos\"}', 'c1')" >/dev/null
comprobar "cada Side ve lo suyo y lo de todos" "2|2|3" "$(ver $U1)|$(ver $U3)|$(ver $ADMIN)"
vaciar
sql "select cronica_i_anotar('nota', null, null, null, '{}', 'n1'), cronica_i_anotar('logro_oro_veintiuna', null, null, null, '{}', 'o1'), cronica_i_anotar('nota', null, null, null, '{}', 'n2')" >/dev/null
sql "update cronica_sucesos set actualizado = now() - interval '20 days' where clave in ('n1', 'o1')" >/dev/null
sql "update cronica_sucesos set actualizado = now() - interval '70 days' where clave = 'n2'" >/dev/null
comprobar "lo de más de 14 días ya no sale; una noticia del Admin de hace 20 días sí (duran 60) y una de 70 no" "1" "$(ver $U1)"
vaciar
for i in 1 2 3 4 5 6; do sql "select cronica_i_anotar('nota', null, null, null, '{\"texto\": \"n$i\"}', 'k$i')" >/dev/null; done
comprobar "el límite se respeta" "3" "$(ver $U1 3)"
comprobar "y se pide como mínimo uno" "1" "$(ver $U1 0)"
comprobar "paginar con «antes» devuelve los más viejos" "2" "$(como $U1 "select jsonb_array_length(cronica_ver(2, (select min((s->>'actualizado')::timestamptz) from jsonb_array_elements(cronica_ver(4)->'sucesos') s))->'sucesos');" | tail -1)"
sql "update cronica_sucesos set juego = 'cartas' where clave in ('k1', 'k2')" >/dev/null
comprobar "se puede filtrar por juego" "2" "$(como $U1 "select jsonb_array_length(cronica_ver(20, null, 'cartas')->'sucesos');" | tail -1)"
vaciar

echo "== Un fallo de la crónica no rompe el juego"
sql "alter table cronica_sucesos rename to cronica_sucesos_x" >/dev/null
R=$(sql "insert into cartas_registro (user_id, carta_id, origen, detalle) values ('$U1', 'rara-1', 'juego', 'sellos:ajedrez') returning carta_id")
comprobar "aunque la tabla de la crónica no esté, la carta se registra igual" "rara-1" "$R"
sql "alter table cronica_sucesos_x rename to cronica_sucesos" >/dev/null
vaciar

echo
if [ "$FALLOS" = 0 ]; then echo "Todo bien."; else echo "FALLOS: $FALLOS"; exit 1; fi
