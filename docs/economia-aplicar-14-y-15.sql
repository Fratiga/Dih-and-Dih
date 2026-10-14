-- Economía de cartas: migraciones 14 (forja siempre a la reserva) y 15 (probabilidad y cartas por tramo en cada minijuego). Pégalo entero en el editor SQL de Supabase.
begin;

-- ===== economia-14 =====
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

-- ===== economia-15 =====
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

commit;
