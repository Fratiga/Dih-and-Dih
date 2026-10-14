-- ECONOMÍA DE CARTAS, parte 19: recompensas de Zarabanda y Parranda (los juegos de ritmo). Hasta ahora no daban nada.
-- Se puede correr más de una vez. Los dos juegos nacen APAGADOS (activo = false): se encienden desde Admin → Economía → Juegos y recetas.
--
-- Son juegos EXIGENTES a propósito:
--   * Solo cuenta una canción COMPLETA, jugada de verdad (la práctica y las pruebas del editor no dan nada) y con al menos 50 s de partida.
--   * Fácil no da nada. Normal solo da un sello con rango S. Con Difícil hace falta rango A para un sello y S para una carta; con Experto,
--     rango B ya da un sello, A una carta «buena» y S una «excelente». Terminar la canción SIN UN SOLO FALLO ni pulsación de más con rango S
--     sube dos tramos en Difícil y uno en Experto (hasta «extraordinario»).
--   * El rango sale de la precisión: S 95 %, A 88 %, B 75 %, C 60 % (se cambia en el panel).
--   * Probabilidades más bajas que en los demás juegos (bueno 35 %, excelente 55 %, extraordinario 80 %), 2 cartas al día como mucho en cada
--     juego y 8 sellos (en vez de 5) para ganar una carta por sellos.
--   * El juego manda la clave = la dificultad (facil, normal, dificil, experto) y la puntuación = precisión en décimas de % (950 = 95,0 %),
--     más 10000 si no hubo ningún fallo ni pulsación de más.
-- Ojo: igual que en los demás juegos, el resultado lo informa el navegador y el servidor no puede comprobarlo; lo que limita el daño son los
-- topes por día y estas condiciones.

insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos, prob, grupos, valores) values
  ('zarabanda', 'Zarabanda', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 2, 50, 8, '{}',
   '{"bueno": {"comun": 85, "infrecuente": 15}, "excelente": {"comun": 20, "infrecuente": 60, "rara": 20}, "extraordinario": {"infrecuente": 40, "rara": 60}}',
   '{"bueno": 0.35, "excelente": 0.55, "extraordinario": 0.8}', '{}',
   '{"rangos": {"S": 95, "A": 88, "B": 75, "C": 60}, "dificultades": {"facil": {"S": -1, "A": -1, "B": -1, "C": -1, "sin_fallos": 0}, "normal": {"S": 0, "A": -1, "B": -1, "C": -1, "sin_fallos": 0}, "dificil": {"S": 1, "A": 0, "B": -1, "C": -1, "sin_fallos": 2}, "experto": {"S": 3, "A": 1, "B": 0, "C": -1, "sin_fallos": 1}}}'),
  ('parranda', 'Parranda', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 2, 50, 8, '{}',
   '{"bueno": {"comun": 85, "infrecuente": 15}, "excelente": {"comun": 20, "infrecuente": 60, "rara": 20}, "extraordinario": {"infrecuente": 40, "rara": 60}}',
   '{"bueno": 0.35, "excelente": 0.55, "extraordinario": 0.8}', '{}',
   '{"rangos": {"S": 95, "A": 88, "B": 75, "C": 60}, "dificultades": {"facil": {"S": -1, "A": -1, "B": -1, "C": -1, "sin_fallos": 0}, "normal": {"S": 0, "A": -1, "B": -1, "C": -1, "sin_fallos": 0}, "dificil": {"S": 1, "A": 0, "B": -1, "C": -1, "sin_fallos": 2}, "experto": {"S": 3, "A": 1, "B": 0, "C": -1, "sin_fallos": 1}}}')
on conflict (juego) do nothing;

-- 1) El puntaje de una partida de ritmo (se parchea la versión desplegada de cartas_valor_juego)
do $$
declare
  def text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cartas_valor_juego';
  if def is null then raise exception 'No existe cartas_valor_juego'; end if;
  def := replace(def, chr(13), '');
  if position('zarabanda' in def) > 0 then return; end if;   -- ya estaba aplicado
  nuevo := replace(def, E'  base numeric;\n', E'  base numeric;\n  d jsonb;\n  acc numeric;\n  rango text;\n');
  if nuevo = def then raise exception 'No se encontró la declaración de base'; end if;
  def := nuevo;
  nuevo := replace(def, E'  r := coalesce(v -> ''rivales'' -> p_clave, v -> ''rivales'' -> ''_otros'');\n',
    E'  if p_juego in (''zarabanda'', ''parranda'') then\n'
    || E'    d := v -> ''dificultades'' -> p_clave;\n'
    || E'    if d is null or p_resultado <> ''gana'' then return -1; end if;\n'
    || E'    acc := least(mod(greatest(coalesce(p_puntuacion, 0), 0), 10000) / 10, 100);\n'
    || E'    rango := case when acc >= (v -> ''rangos'' ->> ''S'')::numeric then ''S'' when acc >= (v -> ''rangos'' ->> ''A'')::numeric then ''A''\n'
    || E'                  when acc >= (v -> ''rangos'' ->> ''B'')::numeric then ''B'' when acc >= (v -> ''rangos'' ->> ''C'')::numeric then ''C'' else ''D'' end;\n'
    || E'    base := coalesce((d ->> rango)::numeric, -1);\n'
    || E'    if base < 0 then return -1; end if;\n'
    || E'    if rango = ''S'' and p_puntuacion >= 10000 then base := base + coalesce((d ->> ''sin_fallos'')::numeric, 0); end if;\n'
    || E'    return least(base, 1000);\n'
    || E'  end if;\n'
    || E'  r := coalesce(v -> ''rivales'' -> p_clave, v -> ''rivales'' -> ''_otros'');\n');
  if nuevo = def then raise exception 'No se encontró la línea de rivales'; end if;
  execute nuevo;
end;
$$;

-- 2) Lo que se puede guardar en «valores» de estos juegos (se parchea cartas_i_validar_valores)
do $$
declare
  def text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cartas_i_validar_valores';
  if def is null then raise exception 'No existe cartas_i_validar_valores'; end if;
  def := replace(def, chr(13), '');
  if position('zarabanda' in def) > 0 then return; end if;   -- ya estaba aplicado
  nuevo := replace(def, 'if p_juego not in (''ajedrez'', ''duelo'', ''arqueria'', ''hooey'', ''fractura'') then',
                        'if p_juego not in (''ajedrez'', ''duelo'', ''arqueria'', ''hooey'', ''fractura'', ''zarabanda'', ''parranda'') then');
  if nuevo = def then raise exception 'No se encontró la lista de juegos'; end if;
  def := nuevo;
  nuevo := replace(def, E'  if p_valores ? ''rivales'' then\n',
    E'  if p_juego in (''zarabanda'', ''parranda'') then\n'
    || E'    for k in select jsonb_object_keys(p_valores) loop\n'
    || E'      if k not in (''rangos'', ''dificultades'') then raise exception ''Valores de %: campo desconocido (%)'', p_juego, k; end if;\n'
    || E'    end loop;\n'
    || E'    if p_valores ? ''rangos'' then\n'
    || E'      if jsonb_typeof(p_valores -> ''rangos'') <> ''object'' or not (p_valores -> ''rangos'' ?& array[''S'', ''A'', ''B'', ''C''])\n'
    || E'         or exists (select 1 from jsonb_object_keys(p_valores -> ''rangos'') r where r not in (''S'', ''A'', ''B'', ''C'')) then\n'
    || E'        raise exception ''Los rangos son S, A, B y C (precisión mínima en por ciento)'';\n'
    || E'      end if;\n'
    || E'      if not ((p_valores -> ''rangos'' ->> ''S'')::numeric >= (p_valores -> ''rangos'' ->> ''A'')::numeric and (p_valores -> ''rangos'' ->> ''A'')::numeric >= (p_valores -> ''rangos'' ->> ''B'')::numeric\n'
    || E'              and (p_valores -> ''rangos'' ->> ''B'')::numeric >= (p_valores -> ''rangos'' ->> ''C'')::numeric and (p_valores -> ''rangos'' ->> ''S'')::numeric <= 100) then\n'
    || E'        raise exception ''La precisión mínima baja de S a C y no pasa de 100'';\n'
    || E'      end if;\n'
    || E'    end if;\n'
    || E'    if p_valores ? ''dificultades'' then\n'
    || E'      if jsonb_typeof(p_valores -> ''dificultades'') <> ''object'' then raise exception ''Las dificultades van como objeto''; end if;\n'
    || E'      for rival in select jsonb_object_keys(p_valores -> ''dificultades'') loop\n'
    || E'        if rival not in (''facil'', ''normal'', ''dificil'', ''experto'') then raise exception ''Dificultad desconocida (%)'', rival; end if;\n'
    || E'        if jsonb_typeof(p_valores -> ''dificultades'' -> rival) <> ''object'' then raise exception ''La dificultad % necesita S, A, B, C y sin_fallos'', rival; end if;\n'
    || E'        for campo in select jsonb_object_keys(p_valores -> ''dificultades'' -> rival) loop\n'
    || E'          if campo not in (''S'', ''A'', ''B'', ''C'', ''sin_fallos'') then raise exception ''Dificultad %: campo desconocido (%)'', rival, campo; end if;\n'
    || E'        end loop;\n'
    || E'      end loop;\n'
    || E'    end if;\n'
    || E'  end if;\n'
    || E'  if p_valores ? ''rivales'' then\n');
  if nuevo = def then raise exception 'No se encontró el bloque de rivales'; end if;
  execute nuevo;
end;
$$;
