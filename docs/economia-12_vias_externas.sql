-- ECONOMÍA DE CARTAS, parte 12: vías de entrada de cartas que NO pasan por la economía. BORRADOR, SOLO SI LO APRUEBAS (decisión D2).
-- Ver docs/economia-despliegue.md, sección 2.
--
-- La Fractura: fractura_recompensa escribe directamente en cartas_coleccion (sin ejemplares, sin límites, sin la etiqueta
-- «En circulación») y la copia fantasma se pierde en cuanto el jugador recibe un ejemplar real de esa carta. Mientras no se conecte
-- con cartas_i_emitir, se desactiva. La firma no cambia (la página la sigue llamando y muestra el mensaje).
create or replace function fractura_recompensa(p_guerra uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  raise exception 'La recompensa de cartas de La Fractura está desactivada hasta conectarla con la economía de cartas';
end;
$$;
revoke execute on function fractura_recompensa(uuid) from public, anon;
grant execute on function fractura_recompensa(uuid) to authenticated;

-- El Hipódromo (hipodromo_comprar_carta, hipodromo_vender_carta, hipodromo_cartas_reserva) NO se toca aquí: lo mantiene otra sesión.
-- Opciones para decidir (no incluidas en este archivo):
--   a) dejarlo como está (la etiqueta «En circulación» ya impide comprar cartas no listas);
--   b) excluir legendarias y limitadas de la compra y la venta, y filtrar la lista de la reserva por «en circulación»;
--   c) desactivarlo hasta revisar el diseño de las monedas.
