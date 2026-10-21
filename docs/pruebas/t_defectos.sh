#!/bin/sh
# Límites predeterminados al publicar una carta y cartas «únicas» (docs/economia-23_defectos_y_unicas.sql). Uso: sh docs/pruebas/t_defectos.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
limpiar
nueva() { sql "delete from cartas_catalogo where id = '$1'; insert into cartas_catalogo (id, rareza, tipo, limite, limite_jugador, obtenible, publicada) values ('$1', '$2', 'Objeto', ${3:-null}, ${4:-null}, true, false)" >/dev/null; }
publicar() { sql "update cartas_catalogo set publicada = true where id = '$1'" >/dev/null; }
lims() { sql "select coalesce(limite::text, '-') || '/' || coalesce(limite_jugador::text, '-') from cartas_catalogo where id = '$1'"; }

echo "== Los predeterminados"
comprobar "global 20 y por jugador 4 de partida" "20/4" "$(sql "select (valor::text)||'/'||(select valor::text from cartas_economia_ajustes where clave='limite_jugador_defecto') from cartas_economia_ajustes where clave='limite_global_defecto'")"
contiene "un jugador no los ve" "$(como $U1 "select cartas_admin_defectos();" 2>&1)" "No autorizado"
contiene "ni los cambia" "$(como $U1 "select cartas_admin_guardar_defectos(10, 2);" 2>&1)" "No autorizado"
contiene "el global va de 1 a 999" "$(como $ADMIN "select cartas_admin_guardar_defectos(0, 1);" 2>&1)" "de 1 a 999"
contiene "por jugador no pasa del global" "$(como $ADMIN "select cartas_admin_guardar_defectos(5, 6);" 2>&1)" "no puede ser mayor"

echo "== Al publicar una carta sin límites se le ponen"
nueva t-comun comun; publicar t-comun
comprobar "común sin límites: 20 y 4" "20/4" "$(lims t-comun)"
nueva t-legendaria legendaria; publicar t-legendaria
comprobar "legendaria: única (1 y 1)" "1/1" "$(lims t-legendaria)"
nueva t-limitada limitada; publicar t-limitada
comprobar "limitada: global predeterminado y 1 por jugador" "20/1" "$(lims t-limitada)"
nueva t-global7 comun 7; publicar t-global7
comprobar "con global puesto (7) solo se rellena el de por jugador" "7/4" "$(lims t-global7)"
nueva t-ambos comun 9 2; publicar t-ambos
comprobar "con los dos puestos no se toca nada" "9/2" "$(lims t-ambos)"
nueva t-borrador comun
comprobar "una carta sin publicar no recibe nada" "-/-" "$(lims t-borrador)"
sql "update cartas_catalogo set publicada = false where id = 't-comun'; update cartas_catalogo set publicada = true where id = 't-comun'" >/dev/null
comprobar "despublicar y volver a publicar no cambia lo ya puesto" "20/4" "$(lims t-comun)"
nueva t-publicada comun 3 3
sql "insert into cartas_catalogo (id, rareza, tipo, limite, obtenible, publicada) values ('t-nacepublica', 'infrecuente', 'Objeto', null, true, true) on conflict (id) do nothing" >/dev/null
comprobar "una carta que nace ya publicada también los recibe (global 20, por jugador 4)" "20/4" "$(lims t-nacepublica)"

echo "== Respeta lo ya emitido"
nueva t-emitida comun
for u in $U1 $U2 $U3; do for i in 1 2 3 4 5 6 7; do dar $u t-emitida >/dev/null; done; done; dar $U1 t-emitida >/dev/null
publicar t-emitida
comprobar "si ya hay 22 copias el global sube a 22 y el de por jugador a 8 (lo que ya tiene el que más tiene)" "22/8" "$(lims t-emitida)"

echo "== Cambiar los predeterminados"
como $ADMIN "select cartas_admin_guardar_defectos(12, 3);" >/dev/null 2>&1
nueva t-nueva2 comun; publicar t-nueva2
comprobar "con 12 y 3, una carta nueva recibe 12 y 3" "12/3" "$(lims t-nueva2)"
comprobar "las que ya estaban no cambian" "20/4" "$(lims t-comun)"
contiene "el panel ve los predeterminados" "$(como $ADMIN "select cartas_admin_defectos();")" '"global": 12'

echo "== Aplicar a las ya publicadas sin límite global"
sql "update cartas_catalogo set limite = null, limite_jugador = null where id in ('t-global7', 't-nacepublica')" >/dev/null
nueva t-sin-publicar comun
N=$(como $ADMIN "select cartas_admin_aplicar_defectos();" | tail -1)
comprobar "rellena las publicadas que no tenían global" "2" "$N"
comprobar "...con los predeterminados de ahora" "12/3" "$(lims t-global7)"
comprobar "...sin tocar las que ya tenían" "9/2" "$(lims t-ambos)"
comprobar "...ni las que no están publicadas" "-/-" "$(lims t-sin-publicar)"
comprobar "volver a aplicarlo no cambia nada" "0" "$(como $ADMIN "select cartas_admin_aplicar_defectos();" | tail -1)"
contiene "un jugador no puede aplicarlo" "$(como $U1 "select cartas_admin_aplicar_defectos();" 2>&1)" "No autorizado"

echo "== Cartas únicas (el atajo del panel: global 1, por jugador 1, en circulación)"
nueva t-unica comun; publicar t-unica
contiene "el panel puede dejar una carta como única" "$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\": \"t-unica\", \"limite\": 1, \"limite_jugador\": 1, \"en_circulacion\": true}]'::jsonb);" 2>&1 | tail -1)" "3"
comprobar "queda 1 y 1 y en circulación" "1/1/true" "$(sql "select limite||'/'||limite_jugador||'/'||en_circulacion from cartas_catalogo where id='t-unica'")"
dar $U1 t-unica >/dev/null
contiene "la única solo se emite una vez" "$(sql "select cartas_i_emitir('$U2', 't-unica', 'prueba', '', null, false);" 2>&1)" "AGOTADA"
comprobar "y un jugador no puede tener dos" "1" "$(sql "select cartas_limite_jugador('t-unica')")"
contiene "una carta con varias copias emitidas no puede pasar a única" "$(como $ADMIN "select cartas_admin_guardar_limites('[{\"id\": \"t-emitida\", \"limite\": 1, \"limite_jugador\": 1}]'::jsonb);" 2>&1)" "Ya se emitieron"

echo "== Y todo sigue cuadrando"
sql "delete from cartas_catalogo where id like 't-%' and not exists (select 1 from cartas_ejemplares e where e.carta_id = cartas_catalogo.id)" >/dev/null 2>&1
comprobar "la auditoría está limpia" "0" "$(auditar)"
echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
