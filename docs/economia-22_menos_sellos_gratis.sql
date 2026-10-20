-- ECONOMÍA DE CARTAS, parte 22: que las recompensas premien más la habilidad y menos el solo hecho de jugar.
-- Se puede correr más de una vez. Todo esto también se puede cambiar a mano desde Admin → Economía → Juegos y recetas.
--
-- 1) Perder (o empatar sin mérito) ya no da un sello. Hasta ahora, en Ajedrez, Duelo y Arquería, perder valía 0 y 0 llegaba al tramo de
--    «participación», que da un sello; con 5 sellos se ganaba una carta, así que cinco partidas perdidas daban una carta.
--    Ahora esas partidas valen -1 (no cuentan). Ganar, y empatar contra un rival que valga algo (por ejemplo tablas contra Baraja), siguen igual.
-- 2) Veintiuna NO se toca: sus cartas salen de los desafíos (cada uno se completa una vez y da una carta segura), no de cada partida. Una versión
--    anterior de este archivo le había bajado las probabilidades y puesto un tiempo mínimo por error; si ya la corriste, esto lo deja como estaba.
update cartas_juegos set valores = jsonb_set(valores, '{rivales}', (
  select jsonb_object_agg(e.key, jsonb_build_object(
    'gana', e.value -> 'gana',
    'tablas', case when coalesce((e.value ->> 'tablas')::numeric, 0) = 0 then to_jsonb(-1) else e.value -> 'tablas' end,
    'pierde', case when coalesce((e.value ->> 'pierde')::numeric, 0) = 0 then to_jsonb(-1) else e.value -> 'pierde' end))
  from jsonb_each(valores -> 'rivales') e))
where juego in ('ajedrez', 'duelo', 'arqueria') and valores ? 'rivales';

-- Veintiuna como la dejó su diseño (por si una versión anterior de este archivo ya la había cambiado)
update cartas_juegos set prob = '{"bueno": 1, "excelente": 1, "extraordinario": 1}'::jsonb, min_segundos = 0 where juego = 'veintiuna';
update cartas_juegos set valores = jsonb_set(valores, '{rivales}', (
  select jsonb_object_agg(e.key, jsonb_build_object(
    'gana', e.value -> 'gana',
    'tablas', case when (e.value ->> 'tablas')::numeric = -1 then to_jsonb(0) else e.value -> 'tablas' end,
    'pierde', case when (e.value ->> 'pierde')::numeric = -1 then to_jsonb(0) else e.value -> 'pierde' end))
  from jsonb_each(valores -> 'rivales') e))
where juego = 'veintiuna' and valores ? 'rivales';
