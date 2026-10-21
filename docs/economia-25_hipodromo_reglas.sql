-- ECONOMÍA DE CARTAS, parte 25: se vuelven a poner las reglas del Hipódromo con cartas que decidió el usuario el 13-oct-2026 («opción B»).
-- Se puede correr más de una vez. Por qué hace falta: al volver a correr docs/hipodromo-2_cartas.sql (por ejemplo al renombrar la moneda a «tokens de
-- juego») se recrearon las funciones del Hipódromo y se perdieron estas reglas de economia-13. Ahora esas reglas están TAMBIÉN en docs/hipodromo-2_cartas.sql,
-- así que volver a correrlo ya no las quita.
--   * Las legendarias y las limitadas no se compran ni se venden en el Hipódromo (sin precio, las funciones las rechazan y no salen en la lista).
--   * En la lista de la reserva solo salen cartas que están EN CIRCULACIÓN, y comprar una que no lo esté da un error claro.
delete from public.hipodromo_precios_cartas where rareza in ('legendaria', 'limitada');

do $$
declare
  def text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'hipodromo_cartas_reserva';
  if def is null then raise exception 'No existe hipodromo_cartas_reserva'; end if;
  def := replace(def, chr(13), '');
  if position('c.en_circulacion' in def) = 0 then
    nuevo := replace(def, 'where c.publicada and (c.lado is null', 'where c.publicada and c.en_circulacion and (c.lado is null');
    if nuevo = def then raise exception 'No se encontró el filtro de la reserva'; end if;
    execute nuevo;
  end if;

  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'hipodromo_comprar_carta';
  if def is null then raise exception 'No existe hipodromo_comprar_carta'; end if;
  def := replace(def, chr(13), '');
  if position('en_circulacion' in def) = 0 then
    nuevo := replace(def, 'if not found then raise exception ''Esa carta no existe.''; end if;',
                          E'if not found then raise exception ''Esa carta no existe.''; end if;\n  if not v_carta.en_circulacion then raise exception ''Esa carta todavía no está disponible.''; end if;');
    if nuevo = def then raise exception 'No se encontró la comprobación de la carta'; end if;
    execute nuevo;
  end if;
end;
$$;
