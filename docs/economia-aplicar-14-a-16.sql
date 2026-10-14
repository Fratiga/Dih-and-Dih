-- Economía de cartas: migraciones 14 (forja siempre a la reserva), 15 (probabilidad y cartas por tramo) y 16 (puntaje por rival, editable). Se pueden correr aunque ya hayas corrido la 14 y la 15. Pégalo entero en el editor SQL de Supabase.
begin;

-- ===== economia-14_forja_reserva =====
-- ECONOMÍA DE CARTAS, parte 14: la forja nunca destruye cartas. Las copias que se entregan vuelven a la reserva (y de ahí al reparto).
-- Decisión del usuario del 13-oct-2026: ni siquiera existe la opción de destruir. Se puede correr más de una vez.
update cartas_recetas set destino = 'reserva' where destino <> 'reserva';
alter table cartas_recetas alter column destino set default 'reserva';

-- Aunque alguien mande otra cosa (el panel, una llamada directa o un SQL a mano), el destino siempre queda en 'reserva'
create or replace function cartas_trg_recetas_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.destino := 'reserva';
  return new;
end;
$$;
drop trigger if exists cartas_recetas_reserva on cartas_recetas;
create trigger cartas_recetas_reserva before insert or update on cartas_recetas
  for each row execute function cartas_trg_recetas_reserva();
revoke all on function cartas_trg_recetas_reserva() from public, anon, authenticated;


-- ===== economia-15_juegos_por_tramo =====
-- ECONOMÍA DE CARTAS, parte 15: cada resultado de un minijuego decide su propia probabilidad de carta y, si se quiere, sus propias cartas.
-- Antes: el puntaje solo elegía el tramo (participación, bueno, excelente, extraordinario) y con él la tabla de rarezas; la probabilidad de
-- que saliera carta era la misma en todos los tramos con carta (1, 0,5 y 0,25 según las cartas ganadas ese día en ese juego).
-- Ahora, por juego y por tramo (bueno, excelente, extraordinario):
--   prob    probabilidad de que ESE tramo dé carta (0 a 1). Se multiplica por el factor del día (1, 0,5, 0,25 según las cartas que ya
--           ganó hoy en ese juego), que sigue igual. Por defecto: bueno 0,5, excelente 0,8, extraordinario 1.
--   grupos  qué cartas puede dar ESE tramo: { tipos: [...], afinidades: [...], ids: [...] }. Si un tramo no aparece, usa el grupo del juego.
-- Se puede correr más de una vez.
alter table cartas_juegos add column if not exists prob jsonb not null default '{"bueno": 0.5, "excelente": 0.8, "extraordinario": 1}'::jsonb;
alter table cartas_juegos add column if not exists grupos jsonb not null default '{}'::jsonb;

-- 1) La función que da la recompensa: se parchea sobre la definición desplegada (si no encuentra algo, aborta)
do $$
declare
  def text;
  nuevo text;
  ini int;
  fin int;
  trozo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cartas_i_juego_terminar_nucleo';
  if def is null then raise exception 'No existe cartas_i_juego_terminar_nucleo'; end if;
  if position('grupo_t' in def) > 0 then return; end if;   -- ya estaba aplicado
  nuevo := replace(def, E'  pesos jsonb;\n', E'  pesos jsonb;\n  grupo_t jsonb;\n');
  if nuevo = def then raise exception 'No se encontró la declaración de pesos'; end if;
  def := nuevo;
  nuevo := replace(def, E'  tramo_txt := nombres[tramo + 1];\n',
    E'  tramo_txt := nombres[tramo + 1];\n  grupo_t := case when jsonb_typeof(cfg.grupos -> tramo_txt) = ''object'' then cfg.grupos -> tramo_txt else cfg.grupo end;\n');
  if nuevo = def then raise exception 'No se encontró tramo_txt'; end if;
  def := nuevo;
  nuevo := replace(def, 'mult := coalesce((mults ->> hoy_juego)::numeric, 0);',
    'mult := coalesce((mults ->> hoy_juego)::numeric, 0) * coalesce((cfg.prob ->> tramo_txt)::numeric, 1);');
  if nuevo = def then raise exception 'No se encontró el multiplicador'; end if;
  def := nuevo;
  -- Solo el filtro de la tirada normal (la carta común por sellos sigue usando el grupo del juego)
  ini := position('c.rareza = orden[i]' in def);
  fin := position('and (res.n > 0' in substr(def, ini));
  if ini = 0 or fin = 0 then raise exception 'No se encontró el filtro de candidatas'; end if;
  trozo := substr(def, ini, fin - 1);
  if position('cfg.grupo' in trozo) = 0 then raise exception 'No se encontró cfg.grupo en el filtro'; end if;
  def := substr(def, 1, ini - 1) || replace(trozo, 'cfg.grupo', 'grupo_t') || substr(def, ini + fin - 1);
  execute def;
end;
$$;

-- 2) Admin: guardar la configuración de un juego, ahora con probabilidad y cartas por tramo, y con las formas comprobadas
create or replace function cartas_admin_guardar_juego(p_juego text, p_cfg jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u jsonb;
  k text;
  clave text;
  x jsonb;
  malas text;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from cartas_juegos where juego = p_juego) then raise exception 'Juego desconocido'; end if;
  if p_cfg ? 'umbrales' then
    u := p_cfg -> 'umbrales';
    if jsonb_typeof(u) <> 'object' or not (u ? 'participacion' and u ? 'bueno' and u ? 'excelente' and u ? 'extraordinario') then
      raise exception 'Los umbrales necesitan participación, bueno, excelente y extraordinario';
    end if;
    if not ((u ->> 'participacion')::numeric <= (u ->> 'bueno')::numeric and (u ->> 'bueno')::numeric <= (u ->> 'excelente')::numeric
            and (u ->> 'excelente')::numeric <= (u ->> 'extraordinario')::numeric) then
      raise exception 'Los umbrales tienen que ir de menor a mayor';
    end if;
  end if;
  if p_cfg ? 'prob' then
    if jsonb_typeof(p_cfg -> 'prob') <> 'object' then raise exception 'La probabilidad va por tramo'; end if;
    for k in select jsonb_object_keys(p_cfg -> 'prob') loop
      if k not in ('bueno', 'excelente', 'extraordinario') then raise exception 'Probabilidad: tramo desconocido (%)', k; end if;
      if jsonb_typeof(p_cfg -> 'prob' -> k) <> 'number' or (p_cfg -> 'prob' ->> k)::numeric not between 0 and 1 then
        raise exception 'La probabilidad de % va de 0 a 1', k;
      end if;
    end loop;
  end if;
  if p_cfg ? 'pesos' then
    if jsonb_typeof(p_cfg -> 'pesos') <> 'object' then raise exception 'Los pesos van por tramo'; end if;
    for k in select jsonb_object_keys(p_cfg -> 'pesos') loop
      if k not in ('bueno', 'excelente', 'extraordinario') then raise exception 'Pesos: tramo desconocido (%)', k; end if;
      if jsonb_typeof(p_cfg -> 'pesos' -> k) <> 'object' then raise exception 'Los pesos de % van por rareza', k; end if;
      for clave in select jsonb_object_keys(p_cfg -> 'pesos' -> k) loop
        if clave not in ('comun', 'infrecuente', 'rara') then raise exception 'Pesos: rareza desconocida (%)', clave; end if;
        if jsonb_typeof(p_cfg -> 'pesos' -> k -> clave) <> 'number' or (p_cfg -> 'pesos' -> k ->> clave)::numeric not between 0 and 1000
           or (p_cfg -> 'pesos' -> k ->> clave)::numeric <> trunc((p_cfg -> 'pesos' -> k ->> clave)::numeric) then
          raise exception 'Los pesos son números enteros de 0 a 1000';
        end if;
      end loop;
      if (select coalesce(sum(value::int), 0) from jsonb_each_text(p_cfg -> 'pesos' -> k)) <= 0 then
        raise exception 'El tramo % necesita al menos una rareza con peso mayor que 0', k;
      end if;
    end loop;
  end if;
  if p_cfg ? 'grupos' then
    if jsonb_typeof(p_cfg -> 'grupos') <> 'object' then raise exception 'Los grupos van por tramo'; end if;
    for k in select jsonb_object_keys(p_cfg -> 'grupos') loop
      if k not in ('bueno', 'excelente', 'extraordinario') then raise exception 'Grupos: tramo desconocido (%)', k; end if;
    end loop;
  end if;
  -- Grupo del juego y grupos por tramo: { tipos, afinidades, ids } de textos; las cartas concretas tienen que existir
  for x in
    select s.v from (
      select p_cfg -> 'grupo' as v where p_cfg ? 'grupo'
      union all
      select e.value from jsonb_each(case when p_cfg ? 'grupos' then p_cfg -> 'grupos' else '{}'::jsonb end) e
    ) s
  loop
    if jsonb_typeof(x) <> 'object' then raise exception 'Cada grupo de cartas es un objeto con tipos, afinidades e ids'; end if;
    for clave in select jsonb_object_keys(x) loop
      if clave not in ('tipos', 'afinidades', 'ids') then raise exception 'Grupo: campo desconocido (%)', clave; end if;
      if jsonb_typeof(x -> clave) <> 'array' or exists (select 1 from jsonb_array_elements(x -> clave) e where jsonb_typeof(e) <> 'string') then
        raise exception 'Grupo: % tiene que ser una lista de textos', clave;
      end if;
    end loop;
    if x ? 'ids' then
      select string_agg(i, ', ') into malas from jsonb_array_elements_text(x -> 'ids') i where not exists (select 1 from cartas_catalogo c where c.id = i);
      if malas is not null then raise exception 'Estas cartas no existen: %', malas; end if;
    end if;
  end loop;
  update cartas_juegos set
    activo = coalesce((p_cfg ->> 'activo')::boolean, activo),
    umbrales = coalesce(p_cfg -> 'umbrales', umbrales),
    tope_dia = coalesce((p_cfg ->> 'tope_dia')::int, tope_dia),
    min_segundos = coalesce((p_cfg ->> 'min_segundos')::int, min_segundos),
    sellos_por_carta = coalesce((p_cfg ->> 'sellos_por_carta')::int, sellos_por_carta),
    grupo = coalesce(p_cfg -> 'grupo', grupo),
    grupos = coalesce(p_cfg -> 'grupos', grupos),
    prob = coalesce(p_cfg -> 'prob', prob),
    pesos = coalesce(p_cfg -> 'pesos', pesos),
    actualizado = now()
  where juego = p_juego;
end;
$$;
revoke execute on function cartas_admin_guardar_juego(text, jsonb) from public, anon;
grant execute on function cartas_admin_guardar_juego(text, jsonb) to authenticated;


-- ===== economia-16_valores_por_rival =====
-- ECONOMÍA DE CARTAS, parte 16: el puntaje que da cada rival (y cada victoria de La Fractura) deja de estar escrito dentro de una función y pasa
-- a la configuración de cada juego (cartas_juegos.valores), para verlo y cambiarlo desde el panel. Los valores iniciales son EXACTAMENTE los de antes.
--   ajedrez, duelo, arqueria   rivales: { rival: { gana, tablas, pierde } }, _otros (rival desconocido). Un valor negativo = esa partida no da premio.
--                              arqueria además: bonus { puntos, suma } (si ganas con esos puntos o más, suma) y maximo.
--   hooey                      por_punto (puntaje por cada sacrificio) y maximo.
--   fractura                   normal, dificil y especial: lo que vale una victoria normal, de dificultad/núcleo/capital y de primera victoria/leyenda/némesis/tres generaciones.
-- Se puede correr más de una vez.
alter table cartas_juegos add column if not exists valores jsonb not null default '{}'::jsonb;

update cartas_juegos set valores = '{"rivales": {"ocevat": {"gana": 1, "tablas": 0, "pierde": 0}, "baraja": {"gana": 2, "tablas": 1, "pierde": 0}, "ilyth": {"gana": 3, "tablas": 2, "pierde": 0}, "perro": {"gana": 4, "tablas": 3, "pierde": 0}, "hooey": {"gana": -1, "tablas": -1, "pierde": -1}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}'::jsonb
  where juego = 'ajedrez' and valores = '{}'::jsonb;
update cartas_juegos set valores = '{"rivales": {"recluta": {"gana": 1, "tablas": 0, "pierde": 0}, "miliciano": {"gana": 2, "tablas": 0, "pierde": 0}, "caballero": {"gana": 3, "tablas": 0, "pierde": 0}, "adam": {"gana": 4, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}'::jsonb
  where juego = 'duelo' and valores = '{}'::jsonb;
update cartas_juegos set valores = '{"rivales": {"hornet": {"gana": 1, "tablas": 0, "pierde": 0}, "garra": {"gana": 2, "tablas": 0, "pierde": 0}, "cassius": {"gana": 3, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}, "bonus": {"puntos": 30, "suma": 1}, "maximo": 4}'::jsonb
  where juego = 'arqueria' and valores = '{}'::jsonb;
update cartas_juegos set valores = '{"por_punto": 1, "maximo": 1000}'::jsonb where juego = 'hooey' and valores = '{}'::jsonb;
update cartas_juegos set valores = '{"normal": 1, "dificil": 3, "especial": 4}'::jsonb where juego = 'fractura' and valores = '{}'::jsonb;

-- 1) Qué puntaje da una partida: ahora lee la configuración (STABLE, porque consulta una tabla)
create or replace function cartas_valor_juego(p_juego text, p_clave text, p_resultado text, p_puntuacion numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v jsonb;
  r jsonb;
  res text;
  base numeric;
begin
  select valores into v from cartas_juegos where juego = p_juego;
  if v is null or v = '{}'::jsonb then return 0; end if;
  if p_juego = 'hooey' then
    return least(greatest(coalesce(p_puntuacion, 0), 0) * coalesce((v ->> 'por_punto')::numeric, 1), coalesce((v ->> 'maximo')::numeric, 1000));
  end if;
  if p_juego = 'fractura' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 1000);      -- el valor ya viene calculado por fractura_recompensa
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

-- 2) La Fractura: los tres valores salen de la configuración
create or replace function fractura_recompensa(p_guerra uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g fractura_guerras%rowtype;
  cfg cartas_juegos%rowtype;
  valor numeric;
  v_token uuid;
  r jsonb;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into g from fractura_guerras where id = p_guerra for update;
  if not found or g.user_id <> uid then raise exception 'Esa guerra no es tuya'; end if;
  if g.resultado <> 'victoria' then raise exception 'Solo se premia ganar'; end if;
  if g.pvp then raise exception 'Las guerras entre jugadores no dan cartas'; end if;
  if g.recompensada then raise exception 'Esa guerra ya dio su premio'; end if;

  select * into cfg from cartas_juegos where juego = 'fractura';
  if not found or not cfg.activo then
    return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo');
  end if;

  valor := coalesce((cfg.valores ->> 'normal')::numeric, 1);
  if g.logros ? 'victoria_dificil' or g.logros ? 'nucleo' or g.logros ? 'capital' then valor := coalesce((cfg.valores ->> 'dificil')::numeric, 3); end if;
  if exists (select 1 from jsonb_array_elements_text(g.logros) l where l like 'primera_victoria:%')
     or g.logros ? 'leyenda' or g.logros ? 'nemesis' or g.logros ? 'tres_generaciones' then
    valor := coalesce((cfg.valores ->> 'especial')::numeric, 4);
  end if;

  insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'fractura', left(p_guerra::text, 40), now() - interval '1 hour')
  returning token into v_token;
  r := cartas_i_juego_terminar_nucleo(v_token, 'gana', valor);

  update fractura_guerras set recompensada = true where id = p_guerra;
  if r ->> 'resultado' = 'carta' then
    r := r || jsonb_build_object('cantidad', (select count(*) from cartas_ejemplares where propietario = uid and carta_id = r ->> 'carta' and estado in ('poseida', 'bloqueada')));
  end if;
  return r;
end;
$$;
revoke execute on function fractura_recompensa(uuid) from public, anon;
grant execute on function fractura_recompensa(uuid) to authenticated;

-- 3) Comprobación de lo que se guarda en «valores»
create or replace function cartas_i_validar_valores(p_juego text, p_valores jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  k text;
  rival text;
  campo text;
begin
  if jsonb_typeof(p_valores) <> 'object' then raise exception 'Los valores de un juego son un objeto'; end if;
  if jsonb_path_exists(p_valores, 'strict $.** ? (@.type() == "number" && (@ < -1 || @ > 1000))') then
    raise exception 'Los puntajes van de 0 a 1000 (o -1 para que esa partida no dé premio)';
  end if;
  if jsonb_path_exists(p_valores, 'strict $.** ? (@.type() != "number" && @.type() != "object")') then
    raise exception 'Los valores solo pueden ser números';
  end if;
  for k in select jsonb_object_keys(p_valores) loop
    if p_juego in ('ajedrez', 'duelo', 'arqueria') and k not in ('rivales', 'bonus', 'maximo') then raise exception 'Valores de %: campo desconocido (%)', p_juego, k; end if;
    if p_juego = 'hooey' and k not in ('por_punto', 'maximo') then raise exception 'Valores de hooey: campo desconocido (%)', k; end if;
    if p_juego = 'fractura' and k not in ('normal', 'dificil', 'especial') then raise exception 'Valores de fractura: campo desconocido (%)', k; end if;
    if p_juego not in ('ajedrez', 'duelo', 'arqueria', 'hooey', 'fractura') then raise exception 'Este juego no tiene valores configurables'; end if;
  end loop;
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

-- 4) cartas_admin_guardar_juego acepta «valores» (se parchea la versión desplegada)
do $$
declare
  def text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cartas_admin_guardar_juego';
  if def is null then raise exception 'No existe cartas_admin_guardar_juego'; end if;
  if position('valores' in def) > 0 then return; end if;   -- ya estaba aplicado
  nuevo := replace(def, E'  update cartas_juegos set\n', E'  if p_cfg ? ''valores'' then perform cartas_i_validar_valores(p_juego, p_cfg -> ''valores''); end if;\n  update cartas_juegos set\n');
  if nuevo = def then raise exception 'No se encontró el update de cartas_juegos'; end if;
  def := nuevo;
  nuevo := replace(def, E'    pesos = coalesce(p_cfg -> ''pesos'', pesos),\n', E'    pesos = coalesce(p_cfg -> ''pesos'', pesos),\n    valores = coalesce(p_cfg -> ''valores'', valores),\n');
  if nuevo = def then raise exception 'No se encontró la línea de pesos'; end if;
  execute nuevo;
end;
$$;

commit;
