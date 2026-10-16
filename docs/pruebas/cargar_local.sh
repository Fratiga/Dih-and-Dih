#!/bin/sh
# Recrea desde cero la base de pruebas local (contenedor cartas-pruebas) hasta el estado ACTUAL de producción.
# Uso: sh docs/pruebas/cargar_local.sh [hasta]   (hasta = "prod" por defecto; "todo" añade las correcciones 7 a 9)
set -e
DOCS="$(cd "$(dirname "$0")/.." && pwd)"
HASTA="${1:-prod}"
P="docker exec -i cartas-pruebas psql -U postgres -v ON_ERROR_STOP=1 -q"
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists pruebas" -c "create database pruebas" >/dev/null 2>&1 || true
docker exec cartas-pruebas psql -U postgres -q -c "drop database if exists pruebas with (force)" -c "create database pruebas"
for f in pruebas/00_supabase_simulado.sql pruebas/01_esquema_base.sql pruebas/02_datos_prueba.sql economia-1_nucleo.sql economia-3_recompensas.sql economia-4_apuestas.sql economia-5_intercambios.sql economia-6_forja.sql pruebas/03_funciones_externas.sql; do
  echo "== $f"; $P -d pruebas < "$DOCS/$f"
done
if [ "$HASTA" = "todo" ]; then
  for f in economia-7_integridad.sql economia-8_permisos.sql economia-9_panel_admin.sql economia-10_verificacion.sql economia-11_en_circulacion.sql economia-12_vias_externas.sql economia-13_hipodromo_cartas.sql economia-14_forja_reserva.sql economia-15_juegos_por_tramo.sql economia-16_valores_por_rival.sql economia-17_rivales_arqueria.sql economia-18_crianza.sql economia-19_ritmo_recompensas.sql economia-20_reserva_compartida.sql economia-21_corral_unicas.sql; do
    echo "== $f"; $P -d pruebas < "$DOCS/$f"
  done
fi
# Las baterías forjan cartas de cualquier tipo (en producción la forja solo acepta las que no están vivas: lo comprueba t_circulacion)
if [ "$HASTA" = "todo" ]; then
  docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -c "insert into cartas_economia_ajustes (clave, valor) values ('forja_tipos', '[\"Criatura\", \"Objeto\", \"Terreno\", \"Acción\", \"Reacción\", \"Entidad\", \"Personaje\"]') on conflict (clave) do update set valor = excluded.valor"
fi
# Como en producción: las recompensas de cartas están apagadas
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q -c "update cartas_juegos set activo = false"
# Las cartas de prueba están en circulación (menos el Bufón), salvo que la etiqueta aún no exista
docker exec -i cartas-pruebas psql -U postgres -d pruebas -q <<'SQL'
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'cartas_catalogo' and column_name = 'en_circulacion') then
    update cartas_catalogo set en_circulacion = true where id <> 'bufon';
  end if;
end $$;
SQL
echo "listo ($HASTA)"
