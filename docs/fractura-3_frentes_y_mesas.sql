-- LA FRACTURA, parte 3: frentes con premio en cartas y mesas de varios jugadores con apuestas.
-- Corre DESPUÉS de scratchpad/fractura.sql, scratchpad/fractura_pvp.sql y de la economía de cartas (hasta la 19).
-- Se puede correr más de una vez.
--
-- FRENTES (contra la máquina)
--   * El juego ofrece una rotación de guerras ya montadas: tres al día y una gran guerra a la semana. Solo esas dan cartas.
--     Una guerra libre (la que el jugador monta a su gusto) queda en la historia pero no da nada.
--   * El nivel del frente lo calcula el servidor con los bandos y la dificultad:
--       escaramuza   2 bandos en normal                         -> valor «normal» del juego (1: tramo bueno)
--       guerra       3 o 4 bandos, o cualquiera en difícil       -> valor «dificil» (3: tramo excelente)
--       gran guerra  5 bandos o más, o 4 en difícil              -> valor «especial» (4: tramo extraordinario)
--   * Cada frente se cobra una sola vez por jugador. Siguen valiendo el tope diario, los límites y los sellos del sistema oficial.
--   * Como en los demás juegos contra la casa, el resultado lo informa el navegador: lo que limita el daño son los topes.
--
-- MESAS (entre jugadores, de 2 a 8)
--   * Alguien abre una mesa, los demás se sientan con su ejército y, si se quiere, la máquina ocupa las plazas que sobren.
--   * Cada jugador puede apostar las cartas que quiera, o ninguna. Las apuestas NO tienen que ser iguales.
--     Todos ven lo que apuesta cada uno y tienen que dar su visto bueno antes de empezar; si alguien cambia su apuesta
--     o entra alguien nuevo, hay que volver a darlo.
--   * Las cartas apostadas quedan bloqueadas hasta que la guerra termina.
--   * Quien gana se lleva las cartas de los que pierden. Si ganan varios (un equipo), se las reparten por turnos, de la más rara
--     a la más común. Si hay empate o gana la máquina, cada uno recupera las suyas. Si una carta no cabe en la colección de
--     quien la gana, se queda con su dueño.
--   * La guerra se guarda como en los duelos: la configuración y las acciones de cada turno. La máquina juega igual en todos los
--     navegadores, así que sus turnos no se guardan. Cada turno lleva una firma del estado para detectar si dos navegadores
--     dejan de ver lo mismo.
--   * Si a alguien se le pasa el plazo de su turno, cualquier otro jugador puede pedir que ese turno lo juegue la máquina.
--   * El final lo avisa cada navegador. Sin apuestas vale el primer aviso. Con apuestas hace falta que coincida más de la mitad
--     de los jugadores, o que lo confirmen todos los que pierden. Un aviso que nadie contradice en 24 horas se da por bueno.
--     Si los avisos chocan, la mesa queda en disputa y la resuelve el admin.

-- =====================================================================================================================
-- 1) FRENTES
-- =====================================================================================================================
alter table fractura_guerras add column if not exists frente text;
alter table fractura_guerras add column if not exists nivel text;
alter table fractura_guerras drop constraint if exists fractura_guerras_nivel_check;
alter table fractura_guerras add constraint fractura_guerras_nivel_check check (nivel is null or nivel in ('escaramuza', 'guerra', 'gran_guerra'));
create index if not exists fractura_guerras_frente_idx on fractura_guerras (user_id, frente) where frente is not null;

create or replace function fractura_nivel_frente(p_bandos int, p_dificultad text)
returns text
language sql
immutable
as $$
  select case when p_bandos >= 5 or (p_bandos >= 4 and p_dificultad = 'dificil') then 'gran_guerra'
              when p_bandos >= 3 or p_dificultad = 'dificil' then 'guerra'
              when p_dificultad = 'normal' then 'escaramuza'
              else null end;
$$;

-- p.frente = { clave: "d20261111-0" o "w20261109-0", bandos, dificultad }. La clave lleva el día (o el lunes de la semana) del frente.
create or replace function fractura_registrar_guerra(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nombre text;
  nuevo uuid;
  f jsonb;
  v_clave text;
  v_nivel text;
  v_dia date;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or length(p::text) > 30000 then raise exception 'Datos inválidos'; end if;
  if (p ->> 'resultado') not in ('victoria', 'derrota', 'empate') then raise exception 'Resultado inválido'; end if;
  if exists (select 1 from fractura_guerras where user_id = uid and creada > now() - interval '15 seconds') then
    raise exception 'Demasiado rápido';
  end if;
  f := p -> 'frente';
  if jsonb_typeof(f) = 'object' and coalesce(f ->> 'clave', '') ~ '^[dw][0-9]{8}-[0-9]$' and not coalesce((p ->> 'pvp')::boolean, false) then
    begin
      v_dia := to_date(substr(f ->> 'clave', 2, 8), 'YYYYMMDD');
      if v_dia between current_date - 16 and current_date + 1 then
        v_nivel := fractura_nivel_frente(least(greatest((f ->> 'bandos')::int, 2), 8), f ->> 'dificultad');
        if v_nivel is not null then v_clave := f ->> 'clave'; end if;
      end if;
    exception when others then
      v_clave := null; v_nivel := null;
    end;
  end if;
  select username into nombre from perfiles where user_id = uid;
  insert into fractura_guerras (user_id, jugador, ejercito, faccion, rival, tipo, resultado, turnos, razon, bajas, logros, titulo, cronica, anio, pvp, frente, nivel)
  values (uid, coalesce(nombre, 'Anónimo'), left(coalesce(p ->> 'ejercito', ''), 60), left(p ->> 'faccion', 60), left(p ->> 'rival', 60), left(p ->> 'tipo', 30),
          p ->> 'resultado', least(greatest(coalesce((p ->> 'turnos')::int, 0), 0), 200), left(coalesce(p ->> 'razon', ''), 300),
          coalesce(p -> 'bajas', '[]'::jsonb), coalesce(p -> 'logros', '[]'::jsonb), left(coalesce(p ->> 'titulo', ''), 120),
          coalesce(p -> 'cronica', '[]'::jsonb), coalesce((p ->> 'anio')::int, 1), coalesce((p ->> 'pvp')::boolean, false), v_clave, v_nivel)
  returning id into nuevo;
  return nuevo;
end;
$$;
revoke execute on function fractura_registrar_guerra(jsonb) from public, anon;
grant execute on function fractura_registrar_guerra(jsonb) to authenticated;

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
  if g.frente is null or g.nivel is null then raise exception 'Solo los frentes dan cartas: una guerra libre no da premio'; end if;
  if exists (select 1 from fractura_guerras o where o.user_id = uid and o.frente = g.frente and o.recompensada and o.id <> g.id) then
    raise exception 'Ya cobraste ese frente';
  end if;

  select * into cfg from cartas_juegos where juego = 'fractura';
  if not found or not cfg.activo then
    -- Apagado: no se da nada y la guerra no se gasta (se podrá reclamar cuando se encienda)
    return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo');
  end if;

  valor := case g.nivel
    when 'escaramuza' then coalesce((cfg.valores ->> 'normal')::numeric, 1)
    when 'guerra' then coalesce((cfg.valores ->> 'dificil')::numeric, 3)
    else coalesce((cfg.valores ->> 'especial')::numeric, 4) end;

  insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'fractura', left(p_guerra::text, 40), now() - interval '1 hour')
  returning token into v_token;
  r := cartas_i_juego_terminar_nucleo(v_token, 'gana', valor);

  update fractura_guerras set recompensada = true where id = p_guerra;
  if r ->> 'resultado' = 'carta' then
    r := r || jsonb_build_object('cantidad', (select count(*) from cartas_ejemplares where propietario = uid and carta_id = r ->> 'carta' and estado in ('poseida', 'bloqueada')));
  end if;
  return r || jsonb_build_object('nivel', g.nivel);
end;
$$;
revoke execute on function fractura_recompensa(uuid) from public, anon;
grant execute on function fractura_recompensa(uuid) to authenticated;

-- Los frentes que el jugador ya cobró (para marcarlos en la pantalla)
create or replace function fractura_frentes_cobrados()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct frente from fractura_guerras where user_id = auth.uid() and recompensada and frente is not null and creada > now() - interval '20 days';
$$;
revoke execute on function fractura_frentes_cobrados() from public, anon;
grant execute on function fractura_frentes_cobrados() to authenticated;

-- =====================================================================================================================
-- 2) MESAS
-- =====================================================================================================================
create table if not exists fractura_mesas (
  id uuid primary key default gen_random_uuid(),
  anfitrion uuid not null references auth.users(id) on delete cascade,
  nombre text not null default '',
  estado text not null default 'abierta' check (estado in ('abierta', 'activa', 'terminada', 'cancelada', 'disputa')),
  privada boolean not null default false,
  config jsonb not null,                          -- { tipo, forma, plazas, equipos, ia, relleno, dificultad, horas, reglas } y, al empezar, { jugadores, semilla, humanos }
  asientos jsonb not null default '[]'::jsonb,    -- [{ user, nombre, faccion, listo, bando }] (el bando se quita al empezar: pasa a config.jugadores)
  jugadores uuid[] not null default '{}',
  invitados uuid[] not null default '{}',
  apuestas jsonb not null default '{}'::jsonb,    -- { "<user>": [ejemplares] }
  turnos jsonb not null default '[]'::jsonb,      -- [{ j, acc, h } | { j, ausente, h } | { j, acc, rendicion, h }]
  activo int not null default 0,                  -- asiento al que le toca
  limite timestamptz,                             -- cuándo se le pasa el plazo
  reportes jsonb not null default '{}'::jsonb,    -- { "<user>": "0,2" | "empate" }
  reportado timestamptz,
  ganadores text,
  razon text,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists fractura_mesas_jugadores_idx on fractura_mesas using gin (jugadores);
create index if not exists fractura_mesas_estado_idx on fractura_mesas (estado, actualizada desc);

alter table fractura_mesas enable row level security;
drop policy if exists "fractura_mesas_select" on fractura_mesas;
create policy "fractura_mesas_select" on fractura_mesas for select
  using (auth.uid() = any(jugadores) or (estado = 'abierta' and (not privada or auth.uid() = any(invitados))) or fichas_es_admin());
-- Sin políticas de escritura: solo las funciones de abajo escriben.

create or replace function fractura_i_ref(p_id uuid, p_user uuid)
returns text language sql immutable as $$ select 'fractura:' || p_id::text || ':' || p_user::text; $$;

create or replace function fractura_i_sin_listos(p_asientos jsonb)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(a || '{"listo": false}'::jsonb order by n), '[]'::jsonb) from jsonb_array_elements(p_asientos) with ordinality t(a, n);
$$;

-- Suelta todas las apuestas de una mesa (cada carta vuelve a estar libre para su dueño)
create or replace function fractura_i_soltar_todo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  for k in select jsonb_object_keys(apuestas) from fractura_mesas where id = p_id loop
    perform cartas_i_desbloquear(fractura_i_ref(p_id, k::uuid));
  end loop;
end;
$$;

create or replace function fractura_i_asiento(p_user uuid, p_bando jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n text;
begin
  if p_bando is null or jsonb_typeof(p_bando) <> 'object' or length(p_bando::text) > 200000 then raise exception 'Bando inválido'; end if;
  if coalesce(p_bando ->> 'faccion', '') !~ '^[a-z0-9-]{1,60}$' then raise exception 'Bando inválido'; end if;
  select coalesce(username, 'Jugador') into n from perfiles where user_id = p_user;
  return jsonb_build_object('user', p_user, 'nombre', coalesce(n, 'Jugador'), 'faccion', p_bando ->> 'faccion', 'listo', false,
                            'bando', p_bando || jsonb_build_object('humano', true));
end;
$$;

create or replace function fractura_mesa_crear(p_nombre text, p_config jsonb, p_bando jsonb, p_invitados uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a jsonb;
  nueva uuid;
  plazas int;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' or length(p_config::text) > 4000 then raise exception 'Configuración inválida'; end if;
  begin plazas := (p_config ->> 'plazas')::int; exception when others then plazas := null; end;
  if plazas is null or plazas < 2 or plazas > 8 then raise exception 'Una mesa tiene de 2 a 8 plazas'; end if;
  if (select count(*) from fractura_mesas where anfitrion = uid and estado = 'abierta') >= 3 then raise exception 'Ya tienes varias mesas abiertas'; end if;
  a := fractura_i_asiento(uid, p_bando);
  insert into fractura_mesas (anfitrion, nombre, privada, config, asientos, jugadores, invitados)
  values (uid, left(coalesce(nullif(trim(p_nombre), ''), 'Mesa de ' || (a ->> 'nombre')), 60), coalesce((p_config ->> 'privada')::boolean, false),
          p_config - 'jugadores' - 'semilla' - 'humanos', jsonb_build_array(a), array[uid], coalesce(p_invitados, '{}'))
  returning id into nueva;
  return nueva;
end;
$$;

create or replace function fractura_mesa_unirse(p_id uuid, p_bando jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
  a jsonb;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select * into m from fractura_mesas where id = p_id for update;
  if not found or m.estado <> 'abierta' then raise exception 'Esa mesa ya no admite jugadores'; end if;
  if uid = any(m.jugadores) then raise exception 'Ya estás en esa mesa'; end if;
  if m.privada and not (uid = any(m.invitados)) then raise exception 'Esa mesa es por invitación'; end if;
  if jsonb_array_length(m.asientos) >= (m.config ->> 'plazas')::int then raise exception 'La mesa está llena'; end if;
  a := fractura_i_asiento(uid, p_bando);
  if exists (select 1 from jsonb_array_elements(m.asientos) s where s ->> 'faccion' = a ->> 'faccion') then
    raise exception 'Ese ejército ya está en la mesa: entra con otro';
  end if;
  update fractura_mesas set asientos = fractura_i_sin_listos(asientos) || jsonb_build_array(a), jugadores = jugadores || uid, actualizada = now() where id = p_id;
end;
$$;

-- Antes de empezar: levantarse de la mesa (el anfitrión la cierra). La apuesta vuelve a su dueño.
create or replace function fractura_mesa_salir(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or uid is null or not (uid = any(m.jugadores)) then raise exception 'No estás en esa mesa'; end if;
  if m.estado <> 'abierta' then raise exception 'La guerra ya empezó: puedes rendirte en tu turno'; end if;
  if m.anfitrion = uid then
    perform fractura_i_soltar_todo(p_id);
    update fractura_mesas set estado = 'cancelada', apuestas = '{}'::jsonb, actualizada = now() where id = p_id;
    return;
  end if;
  perform cartas_i_desbloquear(fractura_i_ref(p_id, uid));
  update fractura_mesas
     set asientos = fractura_i_sin_listos((select coalesce(jsonb_agg(s order by n), '[]'::jsonb) from jsonb_array_elements(m.asientos) with ordinality t(s, n) where s ->> 'user' <> uid::text)),
         jugadores = array_remove(jugadores, uid), apuestas = apuestas - uid::text, actualizada = now()
   where id = p_id;
end;
$$;

-- Fija (o quita, con una lista vacía) la apuesta de quien llama. No hay tope de valor ni tiene que parecerse a la de los demás.
create or replace function fractura_mesa_apostar(p_id uuid, p_ejemplares uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
  n int := coalesce(array_length(p_ejemplares, 1), 0);
  ref text;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into m from fractura_mesas where id = p_id for update;
  if not found or not (uid = any(m.jugadores)) then raise exception 'No estás en esa mesa'; end if;
  if m.estado <> 'abierta' then raise exception 'La guerra ya empezó: las apuestas están cerradas'; end if;
  if n > 60 then raise exception 'Demasiadas cartas en una sola apuesta'; end if;
  if n <> (select count(distinct x) from unnest(p_ejemplares) x) then raise exception 'Hay una carta repetida en la apuesta'; end if;
  ref := fractura_i_ref(p_id, uid);
  perform cartas_i_desbloquear(ref);
  if n > 0 then
    if (select count(*) from cartas_ejemplares where id = any(p_ejemplares) and propietario = uid and estado = 'poseida') <> n then
      raise exception 'Alguna de esas cartas no es tuya o no está libre';
    end if;
    perform cartas_i_bloquear(p_ejemplares, 'apuesta de La Fractura', ref, null);
  end if;
  update fractura_mesas
     set apuestas = case when n > 0 then jsonb_set(apuestas, array[uid::text], to_jsonb(p_ejemplares)) else apuestas - uid::text end,
         asientos = fractura_i_sin_listos(asientos), actualizada = now()
   where id = p_id;
end;
$$;

create or replace function fractura_mesa_listo(p_id uuid, p_listo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or uid is null or not (uid = any(m.jugadores)) or m.estado <> 'abierta' then raise exception 'No se puede'; end if;
  update fractura_mesas
     set asientos = (select jsonb_agg(case when s ->> 'user' = uid::text then s || jsonb_build_object('listo', coalesce(p_listo, false)) else s end order by n)
                       from jsonb_array_elements(m.asientos) with ordinality t(s, n)),
         actualizada = now()
   where id = p_id;
end;
$$;

-- El anfitrión empieza la guerra cuando hay al menos dos jugadores y todos dieron su visto bueno.
create or replace function fractura_mesa_empezar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
  n int;
  plazas int;
  lista jsonb;
  humanos jsonb;
  usadas text[];
  f text;
  i int;
  horas int;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or uid is null or m.anfitrion <> uid then raise exception 'Solo quien abrió la mesa puede empezar'; end if;
  if m.estado <> 'abierta' then raise exception 'Esa mesa ya no está abierta'; end if;
  n := jsonb_array_length(m.asientos);
  if n < 2 then raise exception 'Hacen falta al menos dos jugadores'; end if;
  if exists (select 1 from jsonb_array_elements(m.asientos) s where s ->> 'user' <> uid::text and not coalesce((s ->> 'listo')::boolean, false)) then
    raise exception 'Falta el visto bueno de algún jugador';
  end if;
  plazas := (m.config ->> 'plazas')::int;
  select jsonb_agg(s -> 'bando' order by k), jsonb_agg(s -> 'user' order by k), array_agg(s ->> 'faccion')
    into lista, humanos, usadas
    from jsonb_array_elements(m.asientos) with ordinality t(s, k);
  -- La máquina ocupa las plazas libres con los ejércitos que propuso el anfitrión (config.relleno), sin repetir
  if coalesce((m.config ->> 'ia')::boolean, false) and jsonb_typeof(m.config -> 'relleno') = 'array' then
    for f in select x from jsonb_array_elements_text(m.config -> 'relleno') x loop
      exit when jsonb_array_length(lista) >= plazas;
      if f ~ '^[a-z0-9-]{1,60}$' and not (f = any(usadas)) then
        usadas := usadas || f;
        lista := lista || jsonb_build_array(jsonb_build_object('faccion', f, 'humano', false, 'nivelIA', coalesce(m.config ->> 'dificultad', 'normal')));
        humanos := humanos || 'null'::jsonb;
      end if;
    end loop;
  end if;
  -- Por equipos: alternos alrededor de la mesa (solo con un número par de bandos, de cuatro en adelante)
  if coalesce((m.config ->> 'equipos')::boolean, false) and jsonb_array_length(lista) >= 4 and jsonb_array_length(lista) % 2 = 0 then
    select jsonb_agg(b || jsonb_build_object('equipo', ((k - 1) % 2)::int) order by k) into lista from jsonb_array_elements(lista) with ordinality t(b, k);
  end if;
  begin horas := least(greatest((m.config ->> 'horas')::int, 1), 168); exception when others then horas := 48; end;
  i := floor(random() * 2000000000)::int + 1;
  update fractura_mesas
     set estado = 'activa', activo = 0, limite = now() + make_interval(hours => coalesce(horas, 48)),
         config = (config - 'relleno') || jsonb_build_object('jugadores', lista, 'humanos', humanos, 'semilla', i, 'pvp', true, 'horas', coalesce(horas, 48)),
         asientos = (select jsonb_agg(s - 'bando' order by k) from jsonb_array_elements(m.asientos) with ordinality t(s, k)),
         turnos = '[]'::jsonb, actualizada = now()
   where id = p_id;
end;
$$;

-- Qué asiento ocupa un jugador en una guerra empezada (-1 si no está)
create or replace function fractura_i_asiento_de(p_config jsonb, p_user uuid)
returns int language sql immutable as $$
  select coalesce((select (k - 1)::int from jsonb_array_elements_text(p_config -> 'humanos') with ordinality t(u, k) where u = p_user::text limit 1), -1);
$$;

-- Añade un turno. p_tipo: 'turno' (acciones del jugador activo), 'rendicion' (el activo se rinde) o 'ausente' (se pasó el plazo:
-- lo pide cualquier jugador y ese turno lo juega la máquina). p_n: cuántos turnos creía haber quien llama. p_siguiente: a qué
-- asiento humano le toca después (lo calcula el navegador, que es quien conoce la guerra). p_firma: huella del estado al acabar.
create or replace function fractura_mesa_turno(p_id uuid, p_n int, p_tipo text, p_acciones jsonb, p_siguiente int, p_firma text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
  yo int;
  nuevo jsonb;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or uid is null or m.estado <> 'activa' then raise exception 'Esa guerra no está en curso'; end if;
  yo := fractura_i_asiento_de(m.config, uid);
  if yo < 0 then raise exception 'No estás en esa guerra'; end if;
  if p_n is distinct from jsonb_array_length(m.turnos) then raise exception 'La guerra cambió: recarga'; end if;
  if p_siguiente is null or p_siguiente < 0 or p_siguiente >= jsonb_array_length(m.config -> 'humanos') or jsonb_typeof(m.config -> 'humanos' -> p_siguiente) <> 'string' then
    raise exception 'Turno inválido';
  end if;
  if p_tipo = 'ausente' then
    if yo = m.activo then raise exception 'Es tu turno'; end if;
    if m.limite is null or now() < m.limite then raise exception 'Todavía está en plazo'; end if;
    nuevo := jsonb_build_object('j', m.activo, 'ausente', true, 'h', left(coalesce(p_firma, ''), 40));
  elsif p_tipo in ('turno', 'rendicion') then
    if yo <> m.activo then raise exception 'No es tu turno'; end if;
    -- Quien se rinde manda también lo que llevaba hecho en ese turno: los demás tienen que ver lo mismo
    if p_acciones is null or jsonb_typeof(p_acciones) <> 'array' or jsonb_array_length(p_acciones) > 600 or length(p_acciones::text) > 90000 then raise exception 'Acciones inválidas'; end if;
    nuevo := jsonb_build_object('j', yo, 'acc', p_acciones, 'h', left(coalesce(p_firma, ''), 40));
    if p_tipo = 'rendicion' then nuevo := nuevo || jsonb_build_object('rendicion', true); end if;
  else
    raise exception 'Turno inválido';
  end if;
  update fractura_mesas
     set turnos = turnos || jsonb_build_array(nuevo), activo = p_siguiente,
         limite = now() + make_interval(hours => coalesce((m.config ->> 'horas')::int, 48)), actualizada = now()
   where id = p_id;
end;
$$;

-- Reparte las apuestas y cierra la mesa. p_ganadores: "0,2" (asientos) o "empate".
create or replace function fractura_i_mesa_resolver(p_id uuid, p_ganadores text, p_razon text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m fractura_mesas%rowtype;
  ganan uuid[] := '{}';
  s text;
  u text;
  fila record;
  i int := 0;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or m.estado not in ('activa', 'disputa') then return; end if;
  if p_ganadores <> 'empate' then
    foreach s in array string_to_array(p_ganadores, ',') loop
      u := m.config -> 'humanos' ->> s::int;
      if u is not null then ganan := ganan || u::uuid; end if;
    end loop;
  end if;
  -- Si gana algún jugador, las cartas de los que pierden pasan a los que ganan, de la más rara a la más común y por turnos.
  -- Si es empate o gana la máquina, no se mueve nada.
  if coalesce(array_length(ganan, 1), 0) > 0 then
    for fila in
      select e.id, a.key::uuid as dueno
        from jsonb_each(m.apuestas) a
        cross join lateral jsonb_array_elements_text(a.value) x(ej)
        join cartas_ejemplares e on e.id = x.ej::uuid
        join cartas_catalogo c on c.id = e.carta_id
       where not (a.key::uuid = any(ganan))
       order by cartas_categoria_valor(c.rareza) desc, e.carta_id, e.id
    loop
      begin
        perform cartas_i_transferir(fila.id, ganan[1 + (i % array_length(ganan, 1))], 'apuesta ganada en La Fractura', fractura_i_ref(p_id, fila.dueno), null, true);
      exception when others then
        null;   -- si no cabe en la colección de quien gana, la carta se queda con su dueño (se desbloquea abajo)
      end;
      i := i + 1;
    end loop;
  end if;
  perform fractura_i_soltar_todo(p_id);
  update fractura_mesas set estado = 'terminada', ganadores = p_ganadores, razon = left(coalesce(p_razon, ''), 300), actualizada = now() where id = p_id;
end;
$$;

-- Mira los avisos de final que hay y decide: resolver, dejar en disputa o seguir esperando.
create or replace function fractura_i_mesa_decidir(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m fractura_mesas%rowtype;
  total int;
  n_rep int;
  mejor text;
  n_mejor int;
  distintos int;
  con_apuesta boolean;
  pierden int;
  pierden_ok int;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or m.estado <> 'activa' then return; end if;
  select count(*) into total from jsonb_array_elements(m.config -> 'humanos') h where jsonb_typeof(h) = 'string';
  select count(*), count(distinct value) into n_rep, distintos from jsonb_each_text(m.reportes);
  if n_rep = 0 then return; end if;
  select value, count(*) into mejor, n_mejor from jsonb_each_text(m.reportes) group by value order by count(*) desc, value limit 1;
  con_apuesta := exists (select 1 from jsonb_each(m.apuestas) a where jsonb_array_length(a.value) > 0);
  if not con_apuesta then
    perform fractura_i_mesa_resolver(p_id, mejor, m.razon);   -- sin nada en juego vale el primer aviso
    return;
  end if;
  -- Todos los que pierden según ese aviso lo confirman
  select count(*), count(*) filter (where m.reportes ->> u = mejor) into pierden, pierden_ok
    from jsonb_array_elements_text(m.config -> 'humanos') with ordinality t(u, k)
   where u is not null and (mejor = 'empate' or not ((k - 1)::text = any(string_to_array(mejor, ','))));
  if n_mejor * 2 > total or (distintos = 1 and pierden > 0 and pierden_ok = pierden) then
    perform fractura_i_mesa_resolver(p_id, mejor, m.razon);
  elsif distintos > 1 and (n_rep = total or m.reportado < now() - interval '24 hours') then
    update fractura_mesas set estado = 'disputa', actualizada = now() where id = p_id;
    insert into cartas_incidencias (tipo, referencia, detalle)
    values ('fractura_disputa', 'fractura:' || p_id::text, left('Los avisos del final no coinciden: ' || m.reportes::text, 300));
  elsif distintos = 1 and m.reportado < now() - interval '24 hours' then
    perform fractura_i_mesa_resolver(p_id, mejor, m.razon);   -- nadie lo contradijo en un día
  end if;
end;
$$;

-- Cada navegador avisa del final que ve. p_ganadores: asientos que ganan, separados por comas y en orden ("0" o "1,3"), o "empate".
create or replace function fractura_mesa_terminar(p_id uuid, p_ganadores text, p_razon text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m fractura_mesas%rowtype;
  total int;
begin
  select * into m from fractura_mesas where id = p_id for update;
  if not found or uid is null or fractura_i_asiento_de(m.config, uid) < 0 then raise exception 'No es tu guerra'; end if;
  if m.estado <> 'activa' then return m.estado; end if;
  total := jsonb_array_length(m.config -> 'jugadores');
  if p_ganadores is null or (p_ganadores <> 'empate' and p_ganadores !~ '^[0-7](,[0-7])*$') then raise exception 'Resultado inválido'; end if;
  if p_ganadores <> 'empate' and exists (select 1 from unnest(string_to_array(p_ganadores, ',')) x where x::int >= total) then raise exception 'Resultado inválido'; end if;
  update fractura_mesas
     set reportes = jsonb_set(reportes, array[uid::text], to_jsonb(p_ganadores)), reportado = coalesce(reportado, now()),
         razon = coalesce(nullif(razon, ''), left(coalesce(p_razon, ''), 300)), actualizada = now()
   where id = p_id;
  perform fractura_i_mesa_decidir(p_id);
  return (select estado from fractura_mesas where id = p_id);
end;
$$;

-- Limpieza: mesas abiertas que nadie empezó en 7 días y avisos de final que llevan un día sin respuesta
create or replace function fractura_i_limpiar_mesas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  for f in select id from fractura_mesas where estado = 'abierta' and actualizada < now() - interval '7 days' loop
    perform fractura_i_soltar_todo(f.id);
    update fractura_mesas set estado = 'cancelada', apuestas = '{}'::jsonb, actualizada = now() where id = f.id;
  end loop;
  for f in select id from fractura_mesas where estado = 'activa' and reportado is not null and reportado < now() - interval '24 hours' loop
    perform fractura_i_mesa_decidir(f.id);
  end loop;
end;
$$;

-- La lista de mesas para el vestíbulo: las mías y las abiertas a las que puedo entrar. Sin los soldados de cada bando (pesan mucho).
create or replace function fractura_mesas_lista()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r jsonb;
begin
  if uid is null then return '[]'::jsonb; end if;
  perform fractura_i_limpiar_mesas();
  select coalesce(jsonb_agg(x order by orden, actualizada desc), '[]'::jsonb) into r from (
    select m.actualizada,
           case when m.estado = 'activa' and m.config -> 'humanos' ->> m.activo = uid::text then 0 when m.estado = 'abierta' then 1 when m.estado = 'activa' then 2 else 3 end as orden,
           jsonb_build_object(
             'id', m.id, 'nombre', m.nombre, 'estado', m.estado, 'privada', m.privada, 'anfitrion', m.anfitrion, 'mia', uid = any(m.jugadores),
             'config', m.config - 'jugadores', 'activo', m.activo, 'limite', m.limite, 'ganadores', m.ganadores, 'razon', m.razon,
             'turnos', jsonb_array_length(m.turnos), 'actualizada', m.actualizada, 'reportes', m.reportes,
             'bandos', case when m.estado = 'abierta' then null else (select jsonb_agg(jsonb_build_object('faccion', b ->> 'faccion', 'humano', coalesce((b ->> 'humano')::boolean, false), 'nombre', b ->> 'nombre', 'equipo', b -> 'equipo') order by k)
                                                                     from jsonb_array_elements(m.config -> 'jugadores') with ordinality t(b, k)) end,
             'asientos', (select coalesce(jsonb_agg(jsonb_build_object('user', s -> 'user', 'nombre', s ->> 'nombre', 'faccion', s ->> 'faccion', 'listo', coalesce((s ->> 'listo')::boolean, false),
                                   'apuesta', case when m.apuestas ? (s ->> 'user') then cartas_i_info_apuesta(array(select jsonb_array_elements_text(m.apuestas -> (s ->> 'user'))::uuid)) else '[]'::jsonb end) order by k), '[]'::jsonb)
                            from jsonb_array_elements(m.asientos) with ordinality t(s, k))) as x
      from fractura_mesas m
     where (uid = any(m.jugadores) and (m.estado in ('abierta', 'activa', 'disputa') or m.actualizada > now() - interval '15 days'))
        or (m.estado = 'abierta' and (not m.privada or uid = any(m.invitados)))
     order by 2, 1 desc
     limit 40) q;
  return r;
end;
$$;

-- Mis cartas libres, con su nombre y rareza, para escoger la apuesta
create or replace function fractura_mis_cartas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ejemplar', e.id, 'carta', e.carta_id, 'numero', e.numero, 'rareza', c.rareza,
                                               'nombre', coalesce(d.data ->> 'nombre', e.carta_id)) order by cartas_categoria_valor(c.rareza) desc, e.carta_id, e.numero), '[]'::jsonb)
  from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id left join cartas_definiciones d on d.id = e.carta_id
  where e.propietario = auth.uid() and e.estado = 'poseida';
$$;

-- El admin resuelve una mesa en disputa (o una que se quedó parada): "0,2", "empate" o "cancelar" (devuelve todo)
create or replace function fractura_admin_mesa_resolver(p_id uuid, p_ganadores text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m fractura_mesas%rowtype;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into m from fractura_mesas where id = p_id for update;
  if not found or m.estado not in ('activa', 'disputa') then raise exception 'Esa mesa no está pendiente'; end if;
  if p_ganadores is null or (p_ganadores not in ('empate', 'cancelar') and p_ganadores !~ '^[0-7](,[0-7])*$') then raise exception 'Resultado inválido'; end if;
  perform fractura_i_mesa_resolver(p_id, case when p_ganadores = 'cancelar' then 'empate' else p_ganadores end, 'Resuelta por el admin.');
  update cartas_incidencias set resuelta = now(), resuelta_por = auth.uid() where referencia = 'fractura:' || p_id::text and resuelta is null;
end;
$$;

revoke all on function fractura_i_ref(uuid, uuid) from public, anon, authenticated;
revoke all on function fractura_i_sin_listos(jsonb) from public, anon, authenticated;
revoke all on function fractura_i_soltar_todo(uuid) from public, anon, authenticated;
revoke all on function fractura_i_asiento(uuid, jsonb) from public, anon, authenticated;
revoke all on function fractura_i_asiento_de(jsonb, uuid) from public, anon, authenticated;
revoke all on function fractura_i_mesa_resolver(uuid, text, text) from public, anon, authenticated;
revoke all on function fractura_i_mesa_decidir(uuid) from public, anon, authenticated;
revoke all on function fractura_i_limpiar_mesas() from public, anon, authenticated;
revoke all on function fractura_mesa_crear(text, jsonb, jsonb, uuid[]) from public, anon;
revoke all on function fractura_mesa_unirse(uuid, jsonb) from public, anon;
revoke all on function fractura_mesa_salir(uuid) from public, anon;
revoke all on function fractura_mesa_apostar(uuid, uuid[]) from public, anon;
revoke all on function fractura_mesa_listo(uuid, boolean) from public, anon;
revoke all on function fractura_mesa_empezar(uuid) from public, anon;
revoke all on function fractura_mesa_turno(uuid, int, text, jsonb, int, text) from public, anon;
revoke all on function fractura_mesa_terminar(uuid, text, text) from public, anon;
revoke all on function fractura_mesas_lista() from public, anon;
revoke all on function fractura_mis_cartas() from public, anon;
revoke all on function fractura_admin_mesa_resolver(uuid, text) from public, anon;
grant execute on function fractura_mesa_crear(text, jsonb, jsonb, uuid[]) to authenticated;
grant execute on function fractura_mesa_unirse(uuid, jsonb) to authenticated;
grant execute on function fractura_mesa_salir(uuid) to authenticated;
grant execute on function fractura_mesa_apostar(uuid, uuid[]) to authenticated;
grant execute on function fractura_mesa_listo(uuid, boolean) to authenticated;
grant execute on function fractura_mesa_empezar(uuid) to authenticated;
grant execute on function fractura_mesa_turno(uuid, int, text, jsonb, int, text) to authenticated;
grant execute on function fractura_mesa_terminar(uuid, text, text) to authenticated;
grant execute on function fractura_mesas_lista() to authenticated;
grant execute on function fractura_mis_cartas() to authenticated;
grant execute on function fractura_admin_mesa_resolver(uuid, text) to authenticated;

-- =====================================================================================================================
-- 3) ENCENDER LAS RECOMPENSAS DE LA FRACTURA
--    Con esta línea los frentes empiezan a dar cartas. Si prefieres encenderlas más tarde desde
--    Admin → Economía → Juegos y recetas, borra la línea antes de pegar.
-- =====================================================================================================================
update cartas_juegos set activo = true where juego = 'fractura';
