-- ECONOMÍA DE CARTAS, parte 3: recompensas de los minijuegos.
-- Corre esto DESPUÉS de economia_1_nucleo.sql. Se puede correr más de una vez (no pisa lo que cambies en Admin).
--
-- Cómo funciona (ver docs/economia-de-cartas.md, sección 6):
--   * Al empezar una partida contra la casa, el navegador pide un permiso (cartas_juego_iniciar). Al terminar lo entrega
--     con el resultado (cartas_juego_terminar). El servidor mide el tiempo, decide el tramo, tira el dado y entrega la carta.
--   * Tramos: participación (suma un sello), buen resultado, excelente y extraordinario. Se deciden comparando con los
--     umbrales de cada juego, no con la clasificación de los demás.
--   * Antes de dar una carta comprueba lo mismo que todo el sistema: disponible en ese juego, límite global (la reserva se
--     usa primero), límite por jugador y copia libre. Nunca supera un límite por dar un premio.
--   * Si la carta pedida no está, baja a una rareza menor del mismo grupo; si no queda nada, da un sello.
--   * Topes por día y por juego con rendimientos decrecientes, una partida mínima de tiempo y una carta garantizada si
--     pasan muchas partidas buenas sin premio.
--   * Las legendarias y limitadas nunca salen de aquí.

-- 0) La función antigua (metía cartas saltándose los límites)
drop function if exists cartas_recompensa(text, text, text, integer);

-- 1) Ajustes y juegos -------------------------------------------------------------------------------
create table if not exists cartas_economia_ajustes (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz not null default now()
);

insert into cartas_economia_ajustes (clave, valor) values
  ('tope_dia_total', '6'),                 -- cartas por jugador y día entre todos los juegos
  ('multiplicadores', '[1, 0.5, 0.25]'),   -- probabilidad de la 1ª, 2ª y 3ª carta del día en un mismo juego (después, 0)
  ('pity', '10'),                          -- partidas buenas seguidas sin carta antes de asegurar una común
  ('mejora_personal', '0.1')               -- superar tu marca en este porcentaje sube un tramo, una vez al día
on conflict (clave) do nothing;

create table if not exists cartas_juegos (
  juego text primary key check (juego ~ '^[a-z0-9_]{1,30}$'),
  nombre text not null,
  activo boolean not null default true,
  umbrales jsonb not null,                       -- { participacion, bueno, excelente, extraordinario } sobre el valor de la partida
  tope_dia int not null default 3 check (tope_dia between 0 and 50),
  min_segundos int not null default 20 check (min_segundos between 0 and 3600),
  sellos_por_carta int not null default 5 check (sellos_por_carta between 1 and 50),
  grupo jsonb not null default '{}'::jsonb,      -- { tipos: [...], afinidades: [...], ids: [...] }; vacío = cualquier carta ganable
  pesos jsonb not null,                          -- por tramo: { bueno: { comun: 80, infrecuente: 20 }, ... }
  actualizado timestamptz not null default now()
);

insert into cartas_juegos (juego, nombre, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos) values
  ('ajedrez', 'Ajedrez', '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 3, 60, 5,
     '{"tipos": ["Personaje", "Terreno"]}',
     '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}'),
  ('duelo', 'Duelo', '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 3, 20, 5,
     '{"tipos": ["Personaje", "Objeto", "Reacción"]}',
     '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}'),
  ('arqueria', 'Arquería', '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 3, 25, 5,
     '{"tipos": ["Criatura", "Objeto", "Reacción"]}',
     '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}'),
  ('hooey', 'Sacrificar a Hooey', '{"participacion": 3, "bueno": 10, "excelente": 40, "extraordinario": 100}', 3, 15, 5,
     '{"tipos": ["Criatura", "Personaje", "Terreno"]}',
     '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}')
on conflict (juego) do nothing;

create table if not exists cartas_progreso (
  user_id uuid not null references auth.users(id) on delete cascade,
  juego text not null references cartas_juegos(juego) on delete cascade,
  sellos int not null default 0,
  sin_carta int not null default 0,          -- partidas buenas seguidas sin carta
  mejor numeric not null default 0,
  mejora_fecha date,
  actualizado timestamptz not null default now(),
  primary key (user_id, juego)
);

create table if not exists cartas_partidas_juego (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  juego text not null references cartas_juegos(juego) on delete cascade,
  clave text not null,
  inicio timestamptz not null default now(),
  usado boolean not null default false
);
create index if not exists cartas_partidas_juego_user_idx on cartas_partidas_juego (user_id, inicio desc);

create table if not exists cartas_recompensas_registro (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  juego text not null,
  tramo text not null,
  valor numeric not null,
  resultado text not null check (resultado in ('carta', 'sello', 'nada')),
  carta_id text,
  nota text not null default '',
  creado timestamptz not null default now()
);
create index if not exists cartas_recompensas_user_idx on cartas_recompensas_registro (user_id, creado desc);

alter table cartas_economia_ajustes enable row level security;
alter table cartas_juegos enable row level security;
alter table cartas_progreso enable row level security;
alter table cartas_partidas_juego enable row level security;
alter table cartas_recompensas_registro enable row level security;

drop policy if exists "cartas_juegos_select" on cartas_juegos;
create policy "cartas_juegos_select" on cartas_juegos for select using (true);
drop policy if exists "cartas_ajustes_select" on cartas_economia_ajustes;
create policy "cartas_ajustes_select" on cartas_economia_ajustes for select using (fichas_es_admin());
drop policy if exists "cartas_progreso_select" on cartas_progreso;
create policy "cartas_progreso_select" on cartas_progreso for select using (user_id = auth.uid() or fichas_es_admin());
drop policy if exists "cartas_recompensas_select" on cartas_recompensas_registro;
create policy "cartas_recompensas_select" on cartas_recompensas_registro for select using (user_id = auth.uid() or fichas_es_admin());
-- cartas_partidas_juego no se lee desde el navegador

-- 2) Valor de una partida -----------------------------------------------------------------------------
-- Es lo que se compara con los umbrales. Contra la casa: la dificultad del rival que se vence (1 a 4) y, en arquería,
-- un punto más por ganar con holgura. Ajedrez: las tablas valen un escalón menos. Hooey: la racha.
create or replace function cartas_valor_juego(p_juego text, p_clave text, p_resultado text, p_puntuacion numeric)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  dif int;
begin
  if p_juego = 'hooey' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 1000);
  end if;
  if p_juego = 'ajedrez' then
    if p_clave = 'hooey' then return -1; end if;   -- el rival del caos no da premio
    dif := case p_clave when 'ocevat' then 1 when 'baraja' then 2 when 'ilyth' then 3 when 'perro' then 4 else 1 end;
    return case p_resultado when 'gana' then dif when 'tablas' then greatest(dif - 1, 0) else 0 end;
  end if;
  if p_juego = 'duelo' then
    dif := case p_clave when 'recluta' then 1 when 'miliciano' then 2 when 'caballero' then 3 when 'adam' then 4 else 1 end;
    return case p_resultado when 'gana' then dif else 0 end;
  end if;
  if p_juego = 'arqueria' then
    dif := case p_clave when 'hornet' then 1 when 'garra' then 2 when 'cassius' then 3 else 1 end;
    return case p_resultado when 'gana' then least(dif + case when coalesce(p_puntuacion, 0) >= 30 then 1 else 0 end, 4) else 0 end;
  end if;
  return 0;
end;
$$;

-- 3) Empezar y terminar una partida ----------------------------------------------------------------------
create or replace function cartas_juego_iniciar(p_juego text, p_clave text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nuevo uuid;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  if not exists (select 1 from cartas_juegos where juego = p_juego and activo) then raise exception 'Ese juego no da cartas'; end if;
  if p_clave is null or p_clave !~ '^[a-z0-9_-]{1,40}$' then raise exception 'Clave inválida'; end if;
  delete from cartas_partidas_juego where inicio < now() - interval '3 hours';
  -- Un jugador solo tiene una partida abierta por juego: empezar otra descarta la anterior
  delete from cartas_partidas_juego where user_id = uid and juego = p_juego and not usado;
  insert into cartas_partidas_juego (user_id, juego, clave) values (uid, p_juego, p_clave) returning token into nuevo;
  return nuevo;
end;
$$;

create or replace function cartas_ajuste(p_clave text, p_defecto jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select valor from cartas_economia_ajustes where clave = p_clave), p_defecto);
$$;

create or replace function cartas_juego_terminar(p_token uuid, p_resultado text, p_puntuacion numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  parte cartas_partidas_juego%rowtype;
  cfg cartas_juegos%rowtype;
  prog cartas_progreso%rowtype;
  valor numeric;
  tramo int := 0;
  tramo_txt text;
  nombres text[] := array['ninguno', 'participacion', 'bueno', 'excelente', 'extraordinario'];
  segundos numeric;
  hoy_total int;
  hoy_juego int;
  tope_total int := (cartas_ajuste('tope_dia_total', '6'))::text::int;
  pity int := (cartas_ajuste('pity', '10'))::text::int;
  mejora numeric := (cartas_ajuste('mejora_personal', '0.1'))::text::numeric;
  mults jsonb := cartas_ajuste('multiplicadores', '[1, 0.5, 0.25]');
  mult numeric;
  sube boolean := false;
  quiere_carta boolean := false;
  lado_usuario text;
  orden text[] := array['comun', 'infrecuente', 'rara'];
  pesos jsonb;
  total_peso int := 0;
  tirada int;
  acum int := 0;
  idx int := 1;
  i int;
  candidata record;
  intento int;
  emision jsonb;
  elegida text;
  rareza_elegida text;
  tenia int;
  resultado_txt text := 'nada';
  nota text := '';
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  if p_resultado not in ('gana', 'pierde', 'tablas') then raise exception 'Resultado inválido'; end if;

  select * into parte from cartas_partidas_juego where token = p_token and user_id = uid for update;
  if not found or parte.usado then return jsonb_build_object('resultado', 'nada', 'motivo', 'partida-no-valida'); end if;
  update cartas_partidas_juego set usado = true where token = p_token;
  select * into cfg from cartas_juegos where juego = parte.juego;
  if not found or not cfg.activo then return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo'); end if;

  segundos := extract(epoch from (now() - parte.inicio));
  if segundos < cfg.min_segundos then return jsonb_build_object('resultado', 'nada', 'motivo', 'muy-rapido'); end if;

  valor := cartas_valor_juego(parte.juego, parte.clave, p_resultado, p_puntuacion);
  if valor < 0 then return jsonb_build_object('resultado', 'nada', 'motivo', 'sin-premio'); end if;

  -- Tramo por umbrales
  if valor >= (cfg.umbrales ->> 'participacion')::numeric then tramo := 1; end if;
  if valor >= (cfg.umbrales ->> 'bueno')::numeric then tramo := 2; end if;
  if valor >= (cfg.umbrales ->> 'excelente')::numeric then tramo := 3; end if;
  if valor >= (cfg.umbrales ->> 'extraordinario')::numeric then tramo := 4; end if;

  insert into cartas_progreso (user_id, juego) values (uid, parte.juego) on conflict do nothing;
  select * into prog from cartas_progreso where user_id = uid and juego = parte.juego for update;

  -- Mejora personal: superar tu marca en un 10 % o más sube un tramo, una vez al día
  if tramo >= 2 and tramo < 4 and prog.mejor > 0 and valor >= prog.mejor * (1 + mejora) and prog.mejora_fecha is distinct from current_date then
    tramo := tramo + 1; sube := true;
    update cartas_progreso set mejora_fecha = current_date where user_id = uid and juego = parte.juego;
  end if;
  update cartas_progreso set mejor = greatest(mejor, valor) where user_id = uid and juego = parte.juego;
  tramo_txt := nombres[tramo + 1];

  if tramo = 0 then
    insert into cartas_recompensas_registro (user_id, juego, tramo, valor, resultado) values (uid, parte.juego, 'ninguno', valor, 'nada');
    return jsonb_build_object('resultado', 'nada', 'motivo', 'sin-premio', 'tramo', 'ninguno');
  end if;

  -- Topes del día
  select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
  select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = parte.juego and creado >= date_trunc('day', now());

  if tramo >= 2 then
    if hoy_total >= tope_total or hoy_juego >= cfg.tope_dia then
      mult := 0; nota := 'tope-diario';
    else
      mult := coalesce((mults ->> hoy_juego)::numeric, 0);
    end if;
    quiere_carta := random() < mult;
    -- Si pasan muchas partidas buenas sin carta, se asegura una (mientras no se haya llegado al tope)
    if not quiere_carta and nota = '' and prog.sin_carta + 1 >= pity then quiere_carta := true; nota := 'garantizada'; end if;
  end if;

  select side into lado_usuario from perfiles where user_id = uid;

  -- Carta: tirada de rareza dentro del tramo; si no hay carta disponible baja a una rareza menor
  if quiere_carta then
    pesos := coalesce(cfg.pesos -> tramo_txt, '{"comun": 100}'::jsonb);
    if nota = 'garantizada' then pesos := '{"comun": 100}'::jsonb; end if;
    select coalesce(sum(value::int), 0) into total_peso from jsonb_each_text(pesos);
    tirada := 1 + floor(random() * greatest(total_peso, 1))::int;
    for i in 1..3 loop
      acum := acum + coalesce((pesos ->> orden[i])::int, 0);
      if tirada <= acum then idx := i; exit; end if;
    end loop;

    for i in reverse idx..1 loop
      for intento in 1..3 loop
        select c.id into elegida
        from cartas_catalogo c
        left join cartas_definiciones d on d.id = c.id
        left join lateral (select count(*) n from cartas_ejemplares e where e.carta_id = c.id and e.estado = 'en_reserva') res on true
        left join lateral (select coalesce(max(numero), 0) n from cartas_ejemplares e where e.carta_id = c.id) em on true
        where c.obtenible and c.publicada and c.rareza = orden[i]
          and (c.lado is null or (lado_usuario is not null and lado_usuario = any(c.lado)))
          and (not (cfg.grupo ? 'tipos') or jsonb_array_length(cfg.grupo -> 'tipos') = 0 or c.tipo in (select jsonb_array_elements_text(cfg.grupo -> 'tipos')))
          and (not (cfg.grupo ? 'afinidades') or jsonb_array_length(cfg.grupo -> 'afinidades') = 0
               or exists (select 1 from jsonb_array_elements_text(coalesce(d.data -> 'afinidad', '[]'::jsonb)) a where a in (select jsonb_array_elements_text(cfg.grupo -> 'afinidades'))))
          and (not (cfg.grupo ? 'ids') or jsonb_array_length(cfg.grupo -> 'ids') = 0 or c.id in (select jsonb_array_elements_text(cfg.grupo -> 'ids')))
          and (res.n > 0 or (c.limite is not null and em.n < c.limite))
          and cartas_i_error_recibir(uid, c.id, 1) is null
        order by -ln(1 - random()) / greatest(1, res.n + case when c.limite is null then 0 else greatest(c.limite - em.n, 0) end)
        limit 1;
        exit when elegida is null;
        begin
          emision := cartas_i_emitir(uid, elegida, 'minijuego: ' || parte.juego, p_token::text, null, false);
          rareza_elegida := orden[i];
          exit;
        exception when others then
          elegida := null;    -- se agotó justo ahora: se prueba con otra
        end;
      end loop;
      exit when elegida is not null;
    end loop;
  end if;

  if elegida is not null then
    select count(*) into tenia from cartas_ejemplares where propietario = uid and carta_id = elegida and estado in ('poseida', 'bloqueada');
    update cartas_progreso set sin_carta = 0, actualizado = now() where user_id = uid and juego = parte.juego;
    insert into cartas_registro (user_id, carta_id, origen, detalle)
    values (uid, elegida, 'juego', left(parte.juego || ':' || parte.clave || ':' || p_resultado || ':' || p_puntuacion, 200));
    insert into cartas_recompensas_registro (user_id, juego, tramo, valor, resultado, carta_id, nota)
    values (uid, parte.juego, tramo_txt, valor, 'carta', elegida, nota);
    return jsonb_build_object('resultado', 'carta', 'tramo', tramo_txt, 'mejora', sube,
      'carta', elegida, 'rareza', rareza_elegida, 'numero', (emision ->> 'numero')::int, 'de_reserva', (emision ->> 'de_reserva')::boolean,
      'nueva', tenia = 1, 'sellos', prog.sellos, 'sellos_meta', cfg.sellos_por_carta);
  end if;

  -- Sin carta: un sello. Con los sellos completos se intenta entregar una común
  resultado_txt := 'sello';
  if tramo >= 2 and quiere_carta then nota := 'agotado'; end if;   -- tocaba carta y no había ninguna disponible
  update cartas_progreso set sellos = sellos + 1, sin_carta = case when tramo >= 2 then sin_carta + 1 else sin_carta end, actualizado = now()
    where user_id = uid and juego = parte.juego returning * into prog;

  if prog.sellos >= cfg.sellos_por_carta and hoy_total < tope_total and hoy_juego < cfg.tope_dia then
    for intento in 1..3 loop
      select c.id into elegida
      from cartas_catalogo c
      left join lateral (select count(*) n from cartas_ejemplares e where e.carta_id = c.id and e.estado = 'en_reserva') res on true
      left join lateral (select coalesce(max(numero), 0) n from cartas_ejemplares e where e.carta_id = c.id) em on true
      where c.obtenible and c.publicada and c.rareza = 'comun'
        and (c.lado is null or (lado_usuario is not null and lado_usuario = any(c.lado)))
        and (not (cfg.grupo ? 'tipos') or jsonb_array_length(cfg.grupo -> 'tipos') = 0 or c.tipo in (select jsonb_array_elements_text(cfg.grupo -> 'tipos')))
        and (res.n > 0 or (c.limite is not null and em.n < c.limite))
        and cartas_i_error_recibir(uid, c.id, 1) is null
      order by -ln(1 - random()) / greatest(1, res.n + case when c.limite is null then 0 else greatest(c.limite - em.n, 0) end)
      limit 1;
      exit when elegida is null;
      begin
        emision := cartas_i_emitir(uid, elegida, 'sellos: ' || parte.juego, p_token::text, null, false);
        exit;
      exception when others then
        elegida := null;
      end;
    end loop;
    if elegida is not null then
      update cartas_progreso set sellos = 0 where user_id = uid and juego = parte.juego;
      select count(*) into tenia from cartas_ejemplares where propietario = uid and carta_id = elegida and estado in ('poseida', 'bloqueada');
      insert into cartas_registro (user_id, carta_id, origen, detalle) values (uid, elegida, 'juego', left('sellos:' || parte.juego, 200));
      insert into cartas_recompensas_registro (user_id, juego, tramo, valor, resultado, carta_id, nota)
      values (uid, parte.juego, tramo_txt, valor, 'carta', elegida, 'sellos');
      return jsonb_build_object('resultado', 'carta', 'tramo', tramo_txt, 'por_sellos', true, 'carta', elegida, 'rareza', 'comun',
        'numero', (emision ->> 'numero')::int, 'de_reserva', (emision ->> 'de_reserva')::boolean, 'nueva', tenia = 1, 'sellos', 0, 'sellos_meta', cfg.sellos_por_carta);
    end if;
  end if;

  insert into cartas_recompensas_registro (user_id, juego, tramo, valor, resultado, nota) values (uid, parte.juego, tramo_txt, valor, 'sello', nota);
  return jsonb_build_object('resultado', 'sello', 'tramo', tramo_txt, 'motivo', nota, 'mejora', sube, 'sellos', prog.sellos, 'sellos_meta', cfg.sellos_por_carta);
end;
$$;

-- Cómo va el jugador en cada juego (sellos y cuántas cartas lleva hoy) y qué juegos dan cartas
create or replace function cartas_mis_juegos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'juego', j.juego, 'nombre', j.nombre, 'sellos', coalesce(p.sellos, 0), 'sellos_meta', j.sellos_por_carta,
      'hoy', (select count(*) from cartas_recompensas_registro r where r.user_id = uid and r.juego = j.juego and r.resultado = 'carta' and r.creado >= date_trunc('day', now())),
      'tope_dia', j.tope_dia) order by j.nombre)
    from cartas_juegos j left join cartas_progreso p on p.user_id = uid and p.juego = j.juego where j.activo), '[]'::jsonb);
end;
$$;

-- Qué cartas se pueden ganar todavía (para no esconder lo que se agotó)
create or replace function cartas_disponibilidad()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'agotada',
    not (coalesce(res.n, 0) > 0 or (c.limite is not null and em.n < c.limite)), 'quedan', coalesce(res.n, 0) + case when c.limite is null then null else greatest(c.limite - em.n, 0) end)), '[]'::jsonb)
  from cartas_catalogo c
  left join lateral (select count(*) n from cartas_ejemplares e where e.carta_id = c.id and e.estado = 'en_reserva') res on true
  left join lateral (select coalesce(max(numero), 0) n from cartas_ejemplares e where e.carta_id = c.id) em on true
  where c.obtenible and c.publicada;
$$;

-- 4) Admin: ver y cambiar la configuración de cada juego --------------------------------------------------
create or replace function cartas_admin_juegos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'juegos', coalesce((select jsonb_agg(to_jsonb(j) order by j.nombre) from cartas_juegos j), '[]'::jsonb),
    'ajustes', coalesce((select jsonb_object_agg(clave, valor) from cartas_economia_ajustes), '{}'::jsonb));
end;
$$;

create or replace function cartas_admin_guardar_juego(p_juego text, p_cfg jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u jsonb;
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
  update cartas_juegos set
    activo = coalesce((p_cfg ->> 'activo')::boolean, activo),
    umbrales = coalesce(p_cfg -> 'umbrales', umbrales),
    tope_dia = coalesce((p_cfg ->> 'tope_dia')::int, tope_dia),
    min_segundos = coalesce((p_cfg ->> 'min_segundos')::int, min_segundos),
    sellos_por_carta = coalesce((p_cfg ->> 'sellos_por_carta')::int, sellos_por_carta),
    grupo = coalesce(p_cfg -> 'grupo', grupo),
    pesos = coalesce(p_cfg -> 'pesos', pesos),
    actualizado = now()
  where juego = p_juego;
end;
$$;

create or replace function cartas_admin_guardar_ajustes(p_ajustes jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  for k in select jsonb_object_keys(p_ajustes) loop
    if k not in ('tope_dia_total', 'multiplicadores', 'pity', 'mejora_personal') then raise exception 'Ajuste desconocido: %', k; end if;
    insert into cartas_economia_ajustes (clave, valor, actualizado) values (k, p_ajustes -> k, now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
  end loop;
end;
$$;

revoke all on function cartas_ajuste(text, jsonb) from public, anon, authenticated;
grant execute on function cartas_juego_iniciar(text, text) to authenticated;
grant execute on function cartas_juego_terminar(uuid, text, numeric) to authenticated;
grant execute on function cartas_mis_juegos() to authenticated;
grant execute on function cartas_disponibilidad() to authenticated;
grant execute on function cartas_admin_juegos() to authenticated;
grant execute on function cartas_admin_guardar_juego(text, jsonb) to authenticated;
grant execute on function cartas_admin_guardar_ajustes(jsonb) to authenticated;
