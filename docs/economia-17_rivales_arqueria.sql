-- ECONOMÍA DE CARTAS, parte 17: Arquería tiene seis rivales (Hornet, Garra, Cassius, Torvrena, Miliciano y Tobi) y la configuración solo
-- conocía tres: los otros contaban como «cualquier otro rival» (1 punto), es decir, cuanto más difícil el rival, menos puntaje.
-- Se añaden con 4 de puntaje al ganar (el máximo, tramo extraordinario). Lo que ya estuviera configurado NO se pisa. Se puede correr más de una vez.
update cartas_juegos set valores = jsonb_set(valores, '{rivales}',
  '{"torvrena": {"gana": 4, "tablas": 0, "pierde": 0}, "milicia": {"gana": 4, "tablas": 0, "pierde": 0}, "tobi": {"gana": 4, "tablas": 0, "pierde": 0}}'::jsonb || (valores -> 'rivales'))
where juego = 'arqueria' and valores ? 'rivales';
