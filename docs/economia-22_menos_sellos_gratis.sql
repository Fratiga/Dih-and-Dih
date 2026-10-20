-- ECONOMÍA DE CARTAS, parte 22: que las recompensas premien más la habilidad y menos el solo hecho de jugar.
-- Se puede correr más de una vez. Todo esto también se puede cambiar a mano desde Admin → Economía → Juegos y recetas.
--
-- 1) Perder (o empatar sin mérito) ya no da un sello. Hasta ahora, en Ajedrez, Duelo, Arquería y Veintiuna, perder valía 0 y 0 llegaba
--    al tramo de «participación», que da un sello; con 5 sellos se ganaba una carta, así que cinco partidas perdidas daban una carta.
--    Ahora esas partidas valen -1 (no cuentan). Ganar, y empatar contra un rival que valga algo (por ejemplo tablas contra Baraja), siguen igual.
-- 2) Veintiuna daba carta en el 100 % de las partidas (probabilidad 1 en los tres tramos y sin tiempo mínimo). Ahora: bueno 50 %, excelente
--    70 %, extraordinario 100 %, y una partida tiene que durar al menos 30 s para contar.
update cartas_juegos set valores = jsonb_set(valores, '{rivales}', (
  select jsonb_object_agg(e.key, jsonb_build_object(
    'gana', e.value -> 'gana',
    'tablas', case when coalesce((e.value ->> 'tablas')::numeric, 0) = 0 then to_jsonb(-1) else e.value -> 'tablas' end,
    'pierde', case when coalesce((e.value ->> 'pierde')::numeric, 0) = 0 then to_jsonb(-1) else e.value -> 'pierde' end))
  from jsonb_each(valores -> 'rivales') e))
where juego in ('ajedrez', 'duelo', 'arqueria', 'veintiuna') and valores ? 'rivales';

update cartas_juegos set prob = '{"bueno": 0.5, "excelente": 0.7, "extraordinario": 1}'::jsonb, min_segundos = 30 where juego = 'veintiuna';
