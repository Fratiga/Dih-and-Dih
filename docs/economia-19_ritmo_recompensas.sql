-- ECONOMÍA DE CARTAS, parte 19: recompensas de Zarabanda y Parranda (los juegos de ritmo). Hasta ahora no daban nada.
-- Se puede correr más de una vez (también si ya habías corrido una versión anterior de este archivo: la sustituye).
-- Los dos juegos nacen APAGADOS (activo = false): se encienden desde Admin → Economía → Juegos y recetas.
--
-- Son juegos EXIGENTES a propósito, y el premio sale de los PUNTOS GANADOS en la canción (no del rango):
--   * Una canción corta o fácil da pocos puntos, así que no se puede abusar de las canciones donde sacar una S es sencillo.
--   * Solo cuenta una canción COMPLETA, jugada de verdad (la práctica y las pruebas del editor no dan nada) y con al menos 50 s de partida.
--   * Cada dificultad tiene sus propios puntos mínimos para cada tramo (sello, bueno, excelente, extraordinario; -1 = ese tramo no existe):
--       Fácil: nada.   Normal: solo un sello a partir de 350.000.
--       Difícil: sello 300.000, bueno 400.000, excelente 550.000.   Experto: sello 350.000, bueno 500.000, excelente 700.000, extraordinario 900.000.
--     (Referencia: en la mesa, la mediana en Difícil es 285.000 y en Experto 350.000; el máximo visto, 1.054.000.)
--   * Para que una canción larguísima no se gane a base de puntos con una precisión mediocre, además hace falta una precisión mínima (80 %,
--     «precision_minima» en el panel; 0 la quita).
--   * Probabilidades más bajas que en los demás juegos (bueno 35 %, excelente 55 %, extraordinario 80 %), 2 cartas al día como mucho en cada
--     juego y 8 sellos (en vez de 5) para ganar una carta por sellos.
--   * El juego manda la clave = la dificultad (facil, normal, dificil, experto) y la puntuación = puntos × 10000 + precisión en décimas de %
--     (950 = 95,0 %).
-- Ojo: igual que en los demás juegos, el resultado lo informa el navegador y el servidor no puede comprobarlo; lo que limita el daño son los
-- topes por día y estas condiciones.

insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos, prob, grupos, valores) values
  ('zarabanda', 'Zarabanda', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 2, 50, 8, '{}',
   '{"bueno": {"comun": 85, "infrecuente": 15}, "excelente": {"comun": 20, "infrecuente": 60, "rara": 20}, "extraordinario": {"infrecuente": 40, "rara": 60}}',
   '{"bueno": 0.35, "excelente": 0.55, "extraordinario": 0.8}', '{}', '{}'),
  ('parranda', 'Parranda', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 2, 50, 8, '{}',
   '{"bueno": {"comun": 85, "infrecuente": 15}, "excelente": {"comun": 20, "infrecuente": 60, "rara": 20}, "extraordinario": {"infrecuente": 40, "rara": 60}}',
   '{"bueno": 0.35, "excelente": 0.55, "extraordinario": 0.8}', '{}', '{}')
on conflict (juego) do nothing;

-- Los puntos mínimos iniciales (si ya había una configuración por rangos de una versión anterior, se cambia por esta)
update cartas_juegos set valores = '{"precision_minima": 80, "dificultades": {"facil": {"sello": -1, "bueno": -1, "excelente": -1, "extraordinario": -1}, "normal": {"sello": 350000, "bueno": -1, "excelente": -1, "extraordinario": -1}, "dificil": {"sello": 300000, "bueno": 400000, "excelente": 550000, "extraordinario": -1}, "experto": {"sello": 350000, "bueno": 500000, "excelente": 700000, "extraordinario": 900000}}}'::jsonb
where juego in ('zarabanda', 'parranda') and not (valores ? 'precision_minima');

-- 1) El puntaje de una partida (versión completa: sustituye a la anterior)
create or replace function cartas_valor_juego(p_juego text, p_clave text, p_resultado text, p_puntuacion numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
  u jsonb;
  r jsonb;
  d jsonb;
  res text;
  base numeric;
  pts numeric;
  acc numeric;
begin
  select valores, umbrales into v, u from cartas_juegos where juego = p_juego;
  if v is null or v = '{}'::jsonb then return 0; end if;
  if p_juego = 'hooey' then
    return least(greatest(coalesce(p_puntuacion, 0), 0) * coalesce((v ->> 'por_punto')::numeric, 1), coalesce((v ->> 'maximo')::numeric, 1000));
  end if;
  if p_juego = 'fractura' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 1000);      -- el valor ya viene calculado por fractura_recompensa
  end if;
  if p_juego in ('zarabanda', 'parranda') then
    -- puntuación = puntos × 10000 + precisión en décimas de %
    d := v -> 'dificultades' -> p_clave;
    if d is null or p_resultado <> 'gana' then return -1; end if;
    pts := floor(least(greatest(coalesce(p_puntuacion, 0), 0), 1e12) / 10000);
    acc := least(mod(greatest(coalesce(p_puntuacion, 0), 0), 10000) / 10, 100);
    if acc < coalesce((v ->> 'precision_minima')::numeric, 0) then return -1; end if;
    -- el tramo más alto cuyos puntos mínimos se alcanzan (-1 = ese tramo no existe en esta dificultad)
    if coalesce((d ->> 'extraordinario')::numeric, -1) >= 0 and pts >= (d ->> 'extraordinario')::numeric then return (u ->> 'extraordinario')::numeric; end if;
    if coalesce((d ->> 'excelente')::numeric, -1) >= 0 and pts >= (d ->> 'excelente')::numeric then return (u ->> 'excelente')::numeric; end if;
    if coalesce((d ->> 'bueno')::numeric, -1) >= 0 and pts >= (d ->> 'bueno')::numeric then return (u ->> 'bueno')::numeric; end if;
    if coalesce((d ->> 'sello')::numeric, -1) >= 0 and pts >= (d ->> 'sello')::numeric then return (u ->> 'participacion')::numeric; end if;
    return -1;
  end if;
  r := coalesce(v -> 'rivales' -> p_clave, v -> 'rivales' -> '_otros');
  if r is null then return 0; end if;
  res := case p_resultado when 'gana' then 'gana' when 'tablas' then 'tablas' else 'pierde' end;
  base := coalesce((r ->> res)::numeric, 0);
  if base < 0 then return -1; end if;
  if p_resultado = 'gana' and v ? 'bonus' and coalesce(p_puntuacion, 0) >= coalesce((v -> 'bonus' ->> 'puntos')::numeric, 1e9) then
    base := base + coalesce((v -> 'bonus' ->> 'suma')::numeric, 0);
  end if;
  return least(base, coalesce((v ->> 'maximo')::numeric, 1000));
end;
$$;
revoke all on function cartas_valor_juego(text, text, text, numeric) from public, anon;
grant execute on function cartas_valor_juego(text, text, text, numeric) to authenticated;

-- 2) Lo que se puede guardar en «valores» (versión completa: sustituye a la anterior)
create or replace function cartas_i_validar_valores(p_juego text, p_valores jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  k text;
  rival text;
  campo text;
  previo numeric := -1;
  t text;
  x numeric;
begin
  if jsonb_typeof(p_valores) <> 'object' then raise exception 'Los valores de un juego son un objeto'; end if;
  if p_juego in ('zarabanda', 'parranda') then
    if jsonb_path_exists(p_valores, 'strict $.** ? (@.type() == "number" && (@ < -1 || @ > 10000000))') then
      raise exception 'Los puntos van de 0 a 10.000.000 (o -1 para quitar ese tramo)';
    end if;
  elsif jsonb_path_exists(p_valores, 'strict $.** ? (@.type() == "number" && (@ < -1 || @ > 1000))') then
    raise exception 'Los puntajes van de 0 a 1000 (o -1 para que esa partida no dé premio)';
  end if;
  if jsonb_path_exists(p_valores, 'strict $.** ? (@.type() != "number" && @.type() != "object")') then
    raise exception 'Los valores solo pueden ser números';
  end if;
  for k in select jsonb_object_keys(p_valores) loop
    if p_juego in ('ajedrez', 'duelo', 'arqueria', 'veintiuna') and k not in ('rivales', 'bonus', 'maximo') then raise exception 'Valores de %: campo desconocido (%)', p_juego, k; end if;
    if p_juego = 'hooey' and k not in ('por_punto', 'maximo') then raise exception 'Valores de hooey: campo desconocido (%)', k; end if;
    if p_juego = 'fractura' and k not in ('normal', 'dificil', 'especial') then raise exception 'Valores de fractura: campo desconocido (%)', k; end if;
    if p_juego in ('zarabanda', 'parranda') and k not in ('precision_minima', 'dificultades') then raise exception 'Valores de %: campo desconocido (%)', p_juego, k; end if;
    if p_juego not in ('ajedrez', 'duelo', 'arqueria', 'veintiuna', 'hooey', 'fractura', 'zarabanda', 'parranda') then raise exception 'Este juego no tiene valores configurables'; end if;
  end loop;
  if p_juego in ('zarabanda', 'parranda') then
    if p_valores ? 'precision_minima' and (jsonb_typeof(p_valores -> 'precision_minima') <> 'number' or (p_valores ->> 'precision_minima')::numeric not between 0 and 100) then
      raise exception 'La precisión mínima va de 0 a 100';
    end if;
    if p_valores ? 'dificultades' then
      if jsonb_typeof(p_valores -> 'dificultades') <> 'object' then raise exception 'Las dificultades van como objeto'; end if;
      for rival in select jsonb_object_keys(p_valores -> 'dificultades') loop
        if rival not in ('facil', 'normal', 'dificil', 'experto') then raise exception 'Dificultad desconocida (%)', rival; end if;
        if jsonb_typeof(p_valores -> 'dificultades' -> rival) <> 'object' then raise exception 'La dificultad % necesita sello, bueno, excelente y extraordinario', rival; end if;
        for campo in select jsonb_object_keys(p_valores -> 'dificultades' -> rival) loop
          if campo not in ('sello', 'bueno', 'excelente', 'extraordinario') then raise exception 'Dificultad %: campo desconocido (%)', rival, campo; end if;
        end loop;
        -- Los puntos mínimos suben de sello a extraordinario (los tramos que valen -1 no cuentan)
        previo := -1;
        foreach t in array array['sello', 'bueno', 'excelente', 'extraordinario'] loop
          x := coalesce((p_valores -> 'dificultades' -> rival ->> t)::numeric, -1);
          if x >= 0 then
            if x < previo then raise exception 'En % los puntos mínimos tienen que subir de sello a extraordinario', rival; end if;
            previo := x;
          end if;
        end loop;
      end loop;
    end if;
  end if;
  if p_valores ? 'rivales' then
    if jsonb_typeof(p_valores -> 'rivales') <> 'object' then raise exception 'Los rivales van como objeto'; end if;
    for rival in select jsonb_object_keys(p_valores -> 'rivales') loop
      if jsonb_typeof(p_valores -> 'rivales' -> rival) <> 'object' then raise exception 'El rival % necesita gana, tablas y pierde', rival; end if;
      for campo in select jsonb_object_keys(p_valores -> 'rivales' -> rival) loop
        if campo not in ('gana', 'tablas', 'pierde') then raise exception 'Rival %: campo desconocido (%)', rival, campo; end if;
      end loop;
    end loop;
    if not (p_valores -> 'rivales' ? '_otros') then raise exception 'Falta _otros (el valor de un rival que no está en la lista)'; end if;
  end if;
  if p_valores ? 'bonus' and (jsonb_typeof(p_valores -> 'bonus') <> 'object' or exists (select 1 from jsonb_object_keys(p_valores -> 'bonus') b where b not in ('puntos', 'suma'))) then
    raise exception 'El bonus lleva puntos y suma';
  end if;
end;
$$;
revoke all on function cartas_i_validar_valores(text, jsonb) from public, anon, authenticated;
