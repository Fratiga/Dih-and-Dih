#!/bin/sh
# Pruebas de permisos (A6, A7, A10): sin sesión, jugador, editor y admin. Uso: sh docs/pruebas/t_permisos.sh
. "$(dirname "$0")/lib.sh"
FALLOS=0
limpiar
PERMISO="permission denied"

echo "== Sin sesión (anon)"
contiene "no puede usar el mercader" "$(anonimo "select cartas_mercader_ver();")" "$PERMISO"
contiene "no puede forjar" "$(anonimo "select cartas_forjar('fundir-comunes', array[]::uuid[]);")" "$PERMISO"
contiene "no puede leer los límites de admin" "$(anonimo "select cartas_admin_limites();")" "$PERMISO"
contiene "no puede iniciar un juego con recompensa" "$(anonimo "select cartas_juego_iniciar('ajedrez', 'ocevat');")" "$PERMISO"
comprobar "sí puede preguntar si es editor (lo usan las políticas)" "f" "$(anonimo "select cartas_puede_editar();" | tail -1)"
comprobar "sí puede leer el catálogo público" "23" "$(anonimo "select count(*) from cartas_catalogo;" | tail -1)"
contiene "no puede escribir en el catálogo" "$(anonimo "update cartas_catalogo set limite = 999;")" "$PERMISO"
comprobar "no ve ejemplares" "0" "$(anonimo "select count(*) from cartas_ejemplares;" | tail -1)"

echo "== Jugador normal (Uno, Side A)"
for f in "cartas_admin_limites()" "cartas_admin_apuestas()" "cartas_admin_bloqueos()" "cartas_admin_incidencias(false)" "cartas_admin_recetas()" "cartas_admin_juegos()" "cartas_auditoria()" \
         "cartas_admin_historial(null, null, 10)" "cartas_admin_liberar_bloqueos('apuesta:x', 'motivo largo')" "cartas_admin_guardar_juego('ajedrez', '{}'::jsonb)" \
         "cartas_admin_guardar_receta('x', '{}'::jsonb)" "cartas_admin_guardar_limites('[]'::jsonb)" "cartas_admin_guardar_ajustes('{}'::jsonb)" \
         "cartas_admin_resolver_apuesta(gen_random_uuid(), 'cancelar')" "cartas_admin_mercader_agregar('comun-1', 3)"; do
  contiene "no puede llamar a $f" "$(como $U1 "select $f;")" "No autorizado"
done
contiene "no puede regalarse cartas" "$(como $U1 "select cartas_regalar('$U1', 'comun-1', 'x');")" "Solo el admin"
contiene "no puede guardar cartas" "$(como $U1 "select cartas_guardar('comun-1', '{}'::jsonb, true);")" "No autorizado"
for f in "cartas_i_emitir('$U1', 'comun-1', 'x')" "cartas_i_forjar_nucleo('fundir-comunes', array[]::uuid[])" "cartas_i_transferir(gen_random_uuid(), '$U1', 'x')" \
         "cartas_i_exigir('$U1', array[]::uuid[])" "cartas_mazo_error('$U2', '{}'::jsonb)" "cartas_ajuste('pity', null)" "cartas_i_instantanea('{}'::jsonb)"; do
  contiene "no puede llamar a la interna $(echo "$f" | cut -d'(' -f1)" "$(como $U1 "select $f;")" "$PERMISO"
done
for t in "insert into cartas_ejemplares (carta_id, numero, propietario, estado) values ('comun-1', 99, '$U1', 'poseida')" \
         "update cartas_catalogo set limite = 999" "delete from cartas_bloqueos" "update cartas_juegos set activo = true" \
         "insert into cartas_economia_ajustes (clave, valor) values ('x', '1')" "update cartas_coleccion set cantidad = 99" \
         "insert into fichas_admins (user_id) values ('$U1')" "insert into cartas_editores (user_id) values ('$U1')" "truncate cartas_movimientos"; do
  contiene "no puede: $(echo "$t" | cut -c1-48)" "$(como $U1 "$t;")" "$PERMISO"
done
comprobar "ningún ejemplar apareció por escritura directa" "0" "$(sql "select count(*) from cartas_ejemplares")"
contiene "no puede cambiar su Side (A a B)" "$(como $U1 "update perfiles set side = 'B' where user_id = '$U1';")" "El Side no se puede cambiar"
comprobar "su Side sigue siendo A" "A" "$(sql "select side from perfiles where user_id = '$U1'")"
contiene "no puede borrar su perfil" "$(como $U1 "delete from perfiles where user_id = '$U1';")" "$PERMISO"
contiene "no puede tomar el nombre de otro (mayúsculas distintas)" "$(como $U1 "update perfiles set username = 'DOS' where user_id = '$U1';")" "ya está en uso"
contiene "no puede tomar el nombre de otro (con espacios)" "$(como $U1 "update perfiles set username = '  dos ' where user_id = '$U1';")" "ya está en uso"
contiene "no admite nombres de una letra" "$(como $U1 "update perfiles set username = 'x' where user_id = '$U1';")" "entre 2 y 30"
contiene "no admite caracteres de control" "$(como $U1 "update perfiles set username = E'ab\\x01cd' where user_id = '$U1';")" "no válidos"
nocontiene "sí puede cambiarse el nombre a uno libre" "$(como $U1 "update perfiles set username = 'Uno Nuevo' where user_id = '$U1';")" "ERROR"
comprobar "el nombre quedó guardado" "Uno Nuevo" "$(sql "select username from perfiles where user_id = '$U1'")"
nocontiene "puede volver a guardar su propio nombre" "$(como $U1 "update perfiles set username = 'Uno Nuevo' where user_id = '$U1';")" "ERROR"
nocontiene "puede cambiar el Side si no tenía ninguno (alta de cuenta nueva)" "$(
  sql "insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f5', 'cinco@prueba.local');" >/dev/null
  como 00000000-0000-0000-0000-0000000000f5 "insert into perfiles (user_id) values ('00000000-0000-0000-0000-0000000000f5'); update perfiles set side = 'A' where user_id = '00000000-0000-0000-0000-0000000000f5'; update perfiles set username = 'Cinco' where user_id = '00000000-0000-0000-0000-0000000000f5';")" "ERROR"
comprobar "el alta nueva quedó con Side A y su nombre" "A|Cinco" "$(sql "select side||'|'||username from perfiles where user_id = '00000000-0000-0000-0000-0000000000f5'")"
contiene "...pero después ya no puede cambiarlo" "$(como 00000000-0000-0000-0000-0000000000f5 "update perfiles set side = 'B' where user_id = '00000000-0000-0000-0000-0000000000f5';")" "El Side no se puede cambiar"
contiene "no admite un Side inventado" "$(como $U2 "update perfiles set side = 'Z' where user_id = '$U2';")" "Side"

echo "== Editor"
sql "select cartas_i_emitir('$U1', 'comun-1', 'prueba');" >/dev/null   # que comun-1 tenga una copia emitida
R=$(como $EDITOR "select cartas_guardar('comun-1', jsonb_build_object('nombre', 'Común Uno Editada', 'epiteto', '', 'tipo', 'Objeto', 'rareza', 'rara', 'lado', '[\"A\"]'::jsonb, 'limite', 999, 'obtenible', false, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 2, 'atq', 1, 'pv', 2, 'habilidad', 'Nueva habilidad'), true);")
contiene "puede guardar una carta existente" "$R" "ignorados"
contiene "se le avisa de lo que se ignoró (rareza)" "$R" "rareza"
contiene "se le avisa de lo que se ignoró (limite)" "$R" "limite"
comprobar "la rareza no cambió" "comun" "$(sql "select rareza from cartas_catalogo where id='comun-1'")"
comprobar "el tipo no cambió" "Criatura" "$(sql "select tipo from cartas_catalogo where id='comun-1'")"
comprobar "el límite global no cambió" "20" "$(sql "select limite from cartas_catalogo where id='comun-1'")"
comprobar "el lado no cambió" "" "$(sql "select coalesce(lado::text,'') from cartas_catalogo where id='comun-1'")"
comprobar "sigue siendo obtenible" "t" "$(sql "select obtenible from cartas_catalogo where id='comun-1'")"
comprobar "el nombre sí cambió (es suyo)" "Común Uno Editada" "$(sql "select data->>'nombre' from cartas_definiciones where id='comun-1'")"
comprobar "la copia guardada en las definiciones tampoco lleva los valores ignorados" "comun|20|Criatura" "$(sql "select (data->>'rareza')||'|'||(data->>'limite')||'|'||(data->>'tipo') from cartas_definiciones where id='comun-1'")"
R=$(como $EDITOR "select cartas_guardar('carta-del-editor', jsonb_build_object('nombre', 'Nueva', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'rara', 'limite', 50, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 2, 'atq', 1, 'pv', 2, 'habilidad', 'x'), true);")
nocontiene "puede crear una carta nueva" "$R" "ERROR"
comprobar "la carta nueva del editor nace sin límite y no obtenible" "||false" "$(sql "select coalesce(limite::text,'')||'|'||'|'||obtenible from cartas_catalogo where id='carta-del-editor'")"
comprobar "...también en su definición" "false" "$(sql "select data->>'obtenible' from cartas_definiciones where id='carta-del-editor'")"
contiene "el editor no puede cambiar límites" "$(como $EDITOR "select cartas_admin_guardar_limites('[{\"id\":\"comun-1\",\"limite\":30}]'::jsonb);")" "No autorizado"
contiene "el editor no puede regalar" "$(como $EDITOR "select cartas_regalar('$U1', 'comun-1', 'x');")" "Solo el admin"
contiene "el editor no cambia su Side" "$(como $EDITOR "update perfiles set side = 'B' where user_id = '$EDITOR';")" "El Side no se puede cambiar"
nocontiene "el editor sí puede borrar una carta que nadie tuvo" "$(como $EDITOR "select cartas_borrar('carta-del-editor');")" "ERROR"

echo "== Editor: cartas sin publicar hasta que un admin las revise"
R=$(como $EDITOR "select cartas_guardar('otra-del-editor', jsonb_build_object('nombre', 'Otra', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 5, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x'), true);")
contiene "pidió publicarla y se le avisa" "$R" "publicada"
comprobar "la carta nueva de un editor queda sin publicar, sin límite y no obtenible" "false||false" "$(sql "select publicada||'|'||coalesce(limite::text,'')||'|'||obtenible from cartas_catalogo where id='otra-del-editor'")"
comprobar "los jugadores no la ven" "0" "$(como $U1 "select count(*) from cartas_definiciones where id='otra-del-editor';" | tail -1)"
R=$(como $EDITOR "select cartas_guardar('otra-del-editor', jsonb_build_object('nombre', 'Otra editada', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x'), true);")
comprobar "editarla otra vez tampoco la publica" "f" "$(sql "select publicada from cartas_catalogo where id='otra-del-editor'")"
como $ADMIN "select cartas_guardar('otra-del-editor', jsonb_build_object('nombre', 'Otra revisada', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 8, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x'), true);" >/dev/null
comprobar "un admin la revisa, configura y publica" "true|8|true" "$(sql "select publicada||'|'||limite||'|'||obtenible from cartas_catalogo where id='otra-del-editor'")"
R=$(como $EDITOR "select cartas_guardar('otra-del-editor', jsonb_build_object('nombre', 'Otra', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'comun', 'limite', 8, 'obtenible', true, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 1, 'atq', 1, 'pv', 1, 'habilidad', 'x'), false);")
contiene "un editor no puede despublicar una carta ya revisada" "$R" "publicada"
comprobar "...y sigue publicada" "t" "$(sql "select publicada from cartas_catalogo where id='otra-del-editor'")"

echo "== Admin"
R=$(como $ADMIN "select cartas_guardar('comun-2', jsonb_build_object('nombre', 'Común 2', 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'infrecuente', 'limite', 25, 'obtenible', false, 'afinidad', '[\"carne\"]'::jsonb, 'coste', 2, 'atq', 1, 'pv', 2, 'habilidad', 'x'), true);")
nocontiene "el admin puede guardar una carta" "$R" "ERROR"
comprobar "el admin sí cambia rareza, límite y disponibilidad" "infrecuente|25|false" "$(sql "select rareza||'|'||limite||'|'||obtenible from cartas_catalogo where id='comun-2'")"
nocontiene "el admin cambia su propio Side (previsualizar)" "$(como $ADMIN "update perfiles set side = 'A' where user_id = '$ADMIN';")" "ERROR"
comprobar "el Side del admin cambió" "A" "$(sql "select side from perfiles where user_id = '$ADMIN'")"
nocontiene "el admin lee los límites" "$(como $ADMIN "select cartas_admin_limites();")" "No autorizado"
nocontiene "el admin lee las apuestas" "$(como $ADMIN "select cartas_admin_apuestas();")" "ERROR"
nocontiene "el admin lee los bloqueos" "$(como $ADMIN "select cartas_admin_bloqueos();")" "ERROR"
nocontiene "el admin lee las incidencias" "$(como $ADMIN "select cartas_admin_incidencias();")" "ERROR"
nocontiene "el admin lee las recetas" "$(como $ADMIN "select cartas_admin_recetas();")" "ERROR"
contiene "validación de recetas: rareza legendaria no vale" "$(como $ADMIN "select cartas_admin_guardar_receta('mala', '{\"entrada\":[{\"rareza\":\"legendaria\",\"n\":1}]}'::jsonb);")" "la forja no usa legendarias"
contiene "validación de recetas: éxito fuera de 0 a 1" "$(como $ADMIN "select cartas_admin_guardar_receta('mala', '{\"exito\":2}'::jsonb);")" "El éxito va de 0 a 1"
nocontiene "receta válida" "$(como $ADMIN "select cartas_admin_guardar_receta('buena', '{\"nombre\":\"Buena\",\"entrada\":[{\"rareza\":\"comun\",\"n\":4}],\"salida\":{\"rareza\":\"infrecuente\"},\"exito\":0.5}'::jsonb);")" "ERROR"
contiene "ajuste de horas fuera de rango" "$(como $ADMIN "select cartas_admin_guardar_ajustes('{\"apuesta_silencio_horas\": 0}'::jsonb);")" "Las horas van de 1 a 720"
nocontiene "ajuste de horas válido" "$(como $ADMIN "select cartas_admin_guardar_ajustes('{\"apuesta_silencio_horas\": 24}'::jsonb);")" "ERROR"

echo
[ "$FALLOS" = 0 ] && echo "TODO BIEN" || echo "$FALLOS comprobación(es) falló(aron)"
exit "$FALLOS"
