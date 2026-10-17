-- LAS VEINTIUNA VELAS: un blackjack contra la casa (veintiuna.html), con una regla especial por ronda.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de la economía de cartas (economia-1 a economia-21) y del Hipódromo (docs/hipodromo.sql). Se puede repetir.
--
-- Qué hay aquí (el diseño completo está en docs/veintiuna.md):
--   * La mesa entera vive en el servidor: la baraja se baraja aquí con gen_random_uuid() (aleatoriedad criptográfica del servidor), se guarda aquí y el
--     navegador solo recibe las cartas que ya se ven. La carta oculta del crupier NO sale del servidor hasta que la ronda termina.
--   * Las monedas son las del Hipódromo: se usa su billetera (hipodromo_billeteras) y su libro (hipodromo_movimientos). No hay billetera nueva. Cada movimiento
--     lleva en el concepto el identificador de la mano, y la mano guarda los números de sus movimientos.
--   * Una mano por jugador a la vez (índice único), cada petición lleva un identificador (reintentar no cobra dos veces) y cada acción lleva el número de paso
--     (repetir una acción ya aplicada devuelve el estado actual en vez de aplicarla otra vez). Una mano abandonada se cierra sola, plantándose, a los 30 minutos.
--   * Mesa de práctica: mismas reglas y mismas cartas, apuesta simbólica, sin tocar la billetera. Cuenta para los desafíos, no da monedas.
--   * Desafíos: logros que el servidor comprueba al terminar cada mano. Cada uno se completa una vez y se reclama una vez. La carta sale del sistema oficial de
--     recompensas (cartas_juegos 'veintiuna' + cartas_i_juego_terminar_nucleo), con sus topes diarios, límites global y por jugador, circulación y reserva.
--     El juego nace APAGADO (activo = false): se enciende en Admin → Economía → Juegos y recetas. Apagado, los desafíos se siguen completando y esperan.

/* ================================================================== 0) AJUSTES */
insert into cartas_economia_ajustes (clave, valor) values
  ('veintiuna_apuesta_min', '10'),        -- apuesta mínima (la apuesta de la mesa de práctica es esta, simbólica)
  ('veintiuna_apuesta_max', '100'),       -- apuesta máxima. La apuesta mediana del Hipódromo es 20 y la máxima 50
  ('veintiuna_apuesta_paso', '10'),       -- las apuestas son múltiplos de esto (así el 3 a 2 del blackjack natural siempre da monedas enteras)
  ('veintiuna_peaje_fortuna', '0.6'),     -- Fortuna: fracción de la apuesta que cuesta salvar la mano
  ('veintiuna_peaje_voluntad', '0.85'),   -- Última voluntad: fracción de la apuesta que cuesta obligar al crupier a robar
  ('veintiuna_voluntad_minimo', '0'),     -- Última voluntad: puntos mínimos para poder usarla (0 = cualquier mano)
  ('veintiuna_inactividad_min', '30')     -- minutos sin jugar tras los que la mano se cierra sola, plantándose
on conflict (clave) do nothing;

/* ================================================================== 1) TABLAS */
-- Los desafíos y lo que dan (la lógica de cada uno está en veintiuna_i_registrar y veintiuna_i_progreso)
create table if not exists veintiuna_logros_def (
  id text primary key,
  orden int not null,
  nivel text not null check (nivel in ('bronce', 'plata', 'oro')),   -- bronce vale 1 (resultado bueno), plata 3 (excelente) y oro 4 (extraordinario) en cartas_juegos.valores
  nombre text not null,
  texto text not null,
  meta int not null default 1 check (meta >= 1)
);
insert into veintiuna_logros_def (id, orden, nivel, nombre, texto, meta) values
  ('primera_vela',     1, 'bronce', 'Primera vela',              'Gana una mano.', 1),
  ('bajo_maldicion',   2, 'bronce', 'Bajo la Maldición',         'Gana una mano en una ronda con la Maldición.', 1),
  ('peaje_pagado',     3, 'bronce', 'Peaje pagado',              'Gana una mano después de salvarla con la Fortuna.', 1),
  ('ultima_palabra',   4, 'bronce', 'La última palabra',         'Gana una mano después de usar la Última voluntad.', 1),
  ('veintiuna_exacta', 5, 'plata',  'Veintiuna exacta',          'Gana llegando a 21 pidiendo cartas. Un blackjack natural no cuenta.', 1),
  ('natural',          6, 'plata',  'Blackjack natural',         'Recibe un 21 con tus dos primeras cartas.', 1),
  ('tres_velas',       7, 'plata',  'Tres velas seguidas',       'Gana tres manos seguidas. Un empate no rompe la racha.', 3),
  ('tres_voluntades',  8, 'plata',  'Las tres voluntades',       'Gana al menos una mano con cada una de las tres reglas.', 3),
  ('seis_velas',       9, 'oro',    'Seis velas seguidas',       'Gana seis manos seguidas. Un empate no rompe la racha.', 6),
  ('cinco_cartas',    10, 'oro',    'Cinco cartas sin pasarte',  'Gana con cinco cartas o más sin pasarte de 21.', 1),
  ('maestro',         11, 'oro',    'Maestro de la mesa',        'Gana 50 manos.', 50)
on conflict (id) do update set orden = excluded.orden, nivel = excluded.nivel, nombre = excluded.nombre, texto = excluded.texto, meta = excluded.meta;

create table if not exists veintiuna_estadisticas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  proxima_regla text not null default 'maldicion' check (proxima_regla in ('fortuna', 'maldicion', 'voluntad')),   -- la regla de la siguiente mano, ya decidida y visible
  rondas int not null default 0,
  victorias int not null default 0,
  derrotas int not null default 0,
  empates int not null default 0,
  naturales int not null default 0,
  racha int not null default 0,
  mejor_racha int not null default 0,
  reglas_ganadas text[] not null default '{}',
  contadores jsonb not null default '{}'::jsonb,
  neto numeric(12, 2) not null default 0,          -- monedas ganadas o perdidas en manos con apuesta
  actualizado timestamptz not null default now()
);

create table if not exists veintiuna_logros (
  user_id uuid not null references auth.users(id) on delete cascade,
  logro text not null references veintiuna_logros_def(id) on delete cascade,
  completado timestamptz not null default now(),
  reclamado timestamptz,
  carta text,
  numero int,
  primary key (user_id, logro)
);

-- Una fila por mano. Lleva la baraja entera: NO se lee desde el navegador (solo el admin, para revisar)
create table if not exists veintiuna_partidas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente uuid not null,                                    -- identificador de la petición de repartir: repetirla devuelve esta misma mano
  modo text not null check (modo in ('apuesta', 'practica')),
  apuesta numeric(12, 2) not null check (apuesta > 0),
  peajes numeric(12, 2) not null default 0,
  regla text not null check (regla in ('fortuna', 'maldicion', 'voluntad')),
  estado text not null default 'en_curso' check (estado in ('en_curso', 'terminada')),
  fase text not null default 'jugador' check (fase in ('jugador', 'fortuna')),   -- 'fortuna': te pasaste y puedes salvar la mano pagando el peaje
  paso int not null default 0,
  mazo smallint[] not null,
  repartidas int not null,
  jugador smallint[] not null,
  crupier smallint[] not null,
  jugador_as1 int[] not null default '{}',                  -- posiciones (desde 1) de las cartas que la Fortuna convirtió en un as de valor 1
  fortuna_usada boolean not null default false,
  voluntad_usada boolean not null default false,
  resultado text check (resultado in ('natural', 'victoria', 'empate', 'derrota')),
  razon text,
  pago numeric(12, 2),                                      -- lo que se devuelve a la billetera (apuesta incluida)
  neto numeric(12, 2),                                      -- pago - apuesta - peajes
  logros_nuevos text[] not null default '{}',
  mov_cobro bigint,                                         -- números en hipodromo_movimientos
  mov_peaje bigint,
  mov_pago bigint,
  creada timestamptz not null default now(),
  ultima_accion timestamptz not null default now(),
  terminada timestamptz,
  unique (user_id, cliente),
  check ((estado = 'terminada') = (resultado is not null))
);
create unique index if not exists veintiuna_una_en_curso on veintiuna_partidas (user_id) where estado = 'en_curso';
create index if not exists veintiuna_partidas_user_idx on veintiuna_partidas (user_id, creada desc);

alter table veintiuna_logros_def enable row level security;
alter table veintiuna_estadisticas enable row level security;
alter table veintiuna_logros enable row level security;
alter table veintiuna_partidas enable row level security;
drop policy if exists "veintiuna_logros_def_select" on veintiuna_logros_def;
create policy "veintiuna_logros_def_select" on veintiuna_logros_def for select using (true);
drop policy if exists "veintiuna_estadisticas_select" on veintiuna_estadisticas;
create policy "veintiuna_estadisticas_select" on veintiuna_estadisticas for select using (user_id = auth.uid() or fichas_es_admin());
drop policy if exists "veintiuna_logros_select" on veintiuna_logros;
create policy "veintiuna_logros_select" on veintiuna_logros for select using (user_id = auth.uid() or fichas_es_admin());
drop policy if exists "veintiuna_partidas_admin" on veintiuna_partidas;
create policy "veintiuna_partidas_admin" on veintiuna_partidas for select using (fichas_es_admin());
-- Nadie escribe directamente: solo las funciones de abajo
revoke all on veintiuna_logros_def, veintiuna_estadisticas, veintiuna_logros, veintiuna_partidas from anon, authenticated;
grant select on veintiuna_logros_def to anon, authenticated;
grant select on veintiuna_estadisticas, veintiuna_logros, veintiuna_partidas to authenticated;

/* ================================================================== 2) EL JUEGO EN LA ECONOMÍA DE CARTAS */
-- Mismo camino que Ajedrez, La Fractura o Zarabanda: una fila en cartas_juegos y el cierre oficial de la recompensa.
-- Un desafío de nivel bronce vale 1 (resultado «bueno»), plata 3 («excelente») y oro 4 («extraordinario»), con las cartas y los pesos que el admin quiera.
-- Una carta al día como mucho desde la mesa (tope_dia 1) y siempre la que toca: la probabilidad de cada tramo es 1 para que un desafío completado no se pierda en un sello.
insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos, prob, grupos, valores) values
  ('veintiuna', 'Las Veintiuna Velas', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 1, 0, 5, '{}',
   '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}',
   '{"bueno": 1, "excelente": 1, "extraordinario": 1}', '{}',
   '{"rivales": {"bronce": {"gana": 1, "tablas": 0, "pierde": 0}, "plata": {"gana": 3, "tablas": 0, "pierde": 0}, "oro": {"gana": 4, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}')
on conflict (juego) do nothing;

-- El editor de Juegos y recetas guarda «valores»; el validador tiene que conocer este juego (mismo formato que Ajedrez: rivales con gana/tablas/pierde).
do $$
declare
  d text := pg_get_functiondef('public.cartas_i_validar_valores(text,jsonb)'::regprocedure);
  a1 text := $a$if p_juego in ('ajedrez', 'duelo', 'arqueria') and k not in ('rivales', 'bonus', 'maximo')$a$;
  b1 text := $a$if p_juego in ('ajedrez', 'duelo', 'arqueria', 'veintiuna') and k not in ('rivales', 'bonus', 'maximo')$a$;
  a2 text := $a$if p_juego not in ('ajedrez', 'duelo', 'arqueria', 'hooey', 'fractura', 'zarabanda', 'parranda')$a$;
  b2 text := $a$if p_juego not in ('ajedrez', 'duelo', 'arqueria', 'veintiuna', 'hooey', 'fractura', 'zarabanda', 'parranda')$a$;
begin
  if position('veintiuna' in d) > 0 then return; end if;                           -- ya parcheada
  if position(a1 in d) = 0 or position(a2 in d) = 0 then
    raise exception 'cartas_i_validar_valores ha cambiado: añade el juego veintiuna a mano a sus dos listas de juegos con «rivales»';
  end if;
  execute replace(replace(d, a1, b1), a2, b2);
end $$;

/* ================================================================== 3) PIEZAS DEL JUEGO */
create or replace function veintiuna_i_error(p_msg text, p_codigo text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_msg using hint = p_codigo;
end;
$$;

-- Un número entre 0 y p_n - 1 con el aleatorio del servidor (gen_random_uuid usa el generador criptográfico de Postgres)
create or replace function veintiuna_i_azar(p_n int)
returns int
language sql
volatile
as $$
  select (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % p_n)::int
$$;

create or replace function veintiuna_i_regla_nueva()
returns text
language sql
volatile
as $$
  select (array['fortuna', 'maldicion', 'voluntad'])[1 + veintiuna_i_azar(3)]
$$;

-- Baraja de 52 cartas: 0 a 51. Carta = n: rango (n % 13) + 1 (1 = as, 11 = J, 12 = Q, 13 = K) y palo n / 13 (0 picas, 1 corazones, 2 diamantes, 3 tréboles)
create or replace function veintiuna_i_mazo()
returns smallint[]
language sql
volatile
as $$
  select array_agg(n::smallint order by gen_random_uuid()) from generate_series(0, 51) n
$$;

-- Valor de una mano. p_figura es lo que valen J, Q y K (10; 11 con la Maldición). Un as vale 1 y sube a 11 si cabe, salvo los que la Fortuna dejó fijos en 1.
create or replace function veintiuna_i_valor(p_cartas smallint[], p_fijos int[], p_figura int, out total int, out blando boolean)
language plpgsql
immutable
as $$
declare
  i int;
  r int;
  ases int := 0;
  suma int := 0;
begin
  for i in 1..coalesce(array_length(p_cartas, 1), 0) loop
    r := (p_cartas[i] % 13) + 1;
    if i = any (coalesce(p_fijos, '{}'::int[])) then
      suma := suma + 1;                                              -- la Fortuna la dejó como un as de valor 1, sea la carta que sea
    elsif r = 1 then
      suma := suma + 1;
      ases := ases + 1;
    elsif r >= 11 then
      suma := suma + p_figura;
    else
      suma := suma + r;
    end if;
  end loop;
  blando := false;
  if ases > 0 and suma + 10 <= 21 then suma := suma + 10; blando := true; end if;
  total := suma;
end;
$$;

create or replace function veintiuna_i_carta(p_n smallint, p_fija boolean default false)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object('r', (p_n % 13) + 1, 'p', p_n / 13) || case when p_fija then jsonb_build_object('as1', true) else '{}'::jsonb end
$$;

create or replace function veintiuna_i_mano_json(p_cartas smallint[], p_fijos int[])
returns jsonb
language sql
immutable
as $$
  select coalesce(jsonb_agg(veintiuna_i_carta(c.n, c.i = any (coalesce(p_fijos, '{}'::int[]))) order by c.i), '[]'::jsonb)
  from unnest(p_cartas) with ordinality as c(n, i)
$$;

create or replace function veintiuna_i_saldo(p_uid uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select saldo from hipodromo_billeteras where usuario = p_uid), 0)
$$;

-- El turno del crupier: si hay Última voluntad roba una carta de más ANTES de nada; después pide con 16 o menos y se planta con 17 o más (también con 17 blando)
create or replace function veintiuna_i_turno_crupier(p_mazo smallint[], p_repartidas int, p_crupier smallint[], p_figura int, p_forzar boolean, out o_crupier smallint[], out o_repartidas int)
language plpgsql
immutable
as $$
declare
  v record;
begin
  o_crupier := p_crupier;
  o_repartidas := p_repartidas;
  if p_forzar then
    o_crupier := o_crupier || p_mazo[o_repartidas + 1];
    o_repartidas := o_repartidas + 1;
  end if;
  loop
    select * into v from veintiuna_i_valor(o_crupier, '{}'::int[], p_figura);
    exit when v.total >= 17;
    if o_repartidas >= 52 then raise exception 'La baraja se acabó'; end if;
    o_crupier := o_crupier || p_mazo[o_repartidas + 1];
    o_repartidas := o_repartidas + 1;
  end loop;
end;
$$;

-- Lo que el navegador puede ver de una mano. La baraja y la carta oculta del crupier no salen mientras la mano sigue en curso.
create or replace function veintiuna_i_estado(p veintiuna_partidas, p_saldo numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  figura int := case p.regla when 'maldicion' then 11 else 10 end;
  vj record;
  vc record;
  terminada boolean := p.estado = 'terminada';
  fraccion numeric;
  peaje numeric;
  puede_pedir boolean := false;
  especial jsonb := 'null'::jsonb;
  cru_cartas smallint[];
  faltan numeric;
  motivo text;
  minimo int := (cartas_ajuste('veintiuna_voluntad_minimo', '0'))::text::int;
begin
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
  cru_cartas := case when terminada then p.crupier else p.crupier[1:1] end;
  select * into vc from veintiuna_i_valor(cru_cartas, '{}'::int[], figura);
  fraccion := (cartas_ajuste(case p.regla when 'fortuna' then 'veintiuna_peaje_fortuna' else 'veintiuna_peaje_voluntad' end, '0.5'))::text::numeric;
  peaje := round(p.apuesta * fraccion, 2);

  if not terminada then
    if p.fase = 'jugador' then
      puede_pedir := vj.total < 21;
      if p.regla = 'voluntad' then
        faltan := case when p.modo = 'apuesta' then greatest(peaje - p_saldo, 0) else 0 end;
        motivo := case when p.voluntad_usada then 'ya la usaste' when vj.total < minimo then 'necesitas ' || minimo || ' o más' when faltan > 0 then 'te faltan ' || trim_scale(faltan) || ' monedas' end;
        especial := jsonb_build_object('tipo', 'voluntad', 'disponible', motivo is null, 'motivo', motivo, 'peaje', peaje);
      end if;
    else
      faltan := case when p.modo = 'apuesta' then greatest(peaje - p_saldo, 0) else 0 end;
      especial := jsonb_build_object('tipo', 'fortuna', 'disponible', faltan = 0, 'motivo', case when faltan > 0 then 'te faltan ' || trim_scale(faltan) || ' monedas' end, 'peaje', peaje);
    end if;
  end if;

  return jsonb_build_object(
    'partida', p.id,
    'paso', p.paso,
    'modo', p.modo,
    'apuesta', p.apuesta,
    'peajes', p.peajes,
    'regla', jsonb_build_object('id', p.regla, 'usada', case p.regla when 'fortuna' then p.fortuna_usada when 'voluntad' then p.voluntad_usada else false end,
                                'peaje', case when p.regla = 'maldicion' then null else peaje end),
    'estado', p.estado,
    'fase', case when terminada then 'fin' else p.fase end,
    'jugador', jsonb_build_object('cartas', veintiuna_i_mano_json(p.jugador, p.jugador_as1), 'total', vj.total, 'blando', vj.blando),
    'crupier', jsonb_build_object('cartas', veintiuna_i_mano_json(cru_cartas, '{}'::int[]), 'ocultas', case when terminada then 0 else 1 end, 'total', vc.total, 'blando', vc.blando,
                                  'robadas_desde', case when terminada then 3 else null end),
    'acciones', case when terminada then 'null'::jsonb else jsonb_build_object('pedir', puede_pedir, 'plantar', p.fase = 'jugador', 'especial', especial) end,
    'resultado', case when terminada then jsonb_build_object('tipo', p.resultado, 'razon', p.razon, 'pago', p.pago, 'neto', p.neto, 'apuesta', p.apuesta, 'peajes', p.peajes) end,
    'logros_nuevos', to_jsonb(p.logros_nuevos),
    'saldo', p_saldo
  );
end;
$$;

/* ================================================================== 4) FIN DE LA MANO: cobro, estadísticas y desafíos */
-- Registra la mano en las estadísticas y completa los desafíos. Devuelve los desafíos que acaban de completarse.
create or replace function veintiuna_i_registrar(p veintiuna_partidas)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  est veintiuna_estadisticas%rowtype;
  gana boolean := p.resultado in ('natural', 'victoria');
  n_cartas int := coalesce(array_length(p.jugador, 1), 0);
  vj record;
  cont jsonb;
  nuevos text[];
begin
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (p.user_id, veintiuna_i_regla_nueva()) on conflict do nothing;
  select * into est from veintiuna_estadisticas where user_id = p.user_id for update;
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, case p.regla when 'maldicion' then 11 else 10 end);
  cont := est.contadores;
  if gana then
    if p.regla = 'maldicion' then cont := jsonb_set(cont, '{ganadas_maldicion}', to_jsonb(coalesce((cont ->> 'ganadas_maldicion')::int, 0) + 1)); end if;
    if p.fortuna_usada then cont := jsonb_set(cont, '{ganadas_fortuna_usada}', to_jsonb(coalesce((cont ->> 'ganadas_fortuna_usada')::int, 0) + 1)); end if;
    if p.voluntad_usada then cont := jsonb_set(cont, '{ganadas_voluntad_usada}', to_jsonb(coalesce((cont ->> 'ganadas_voluntad_usada')::int, 0) + 1)); end if;
    if p.resultado = 'victoria' and n_cartas > 2 and vj.total = 21 then cont := jsonb_set(cont, '{veintiunas}', to_jsonb(coalesce((cont ->> 'veintiunas')::int, 0) + 1)); end if;
    if p.resultado = 'victoria' and n_cartas >= 5 and vj.total <= 21 then cont := jsonb_set(cont, '{cinco_cartas}', to_jsonb(coalesce((cont ->> 'cinco_cartas')::int, 0) + 1)); end if;
  end if;
  update veintiuna_estadisticas set
    rondas = rondas + 1,
    victorias = victorias + case when gana then 1 else 0 end,
    derrotas = derrotas + case when p.resultado = 'derrota' then 1 else 0 end,
    empates = empates + case when p.resultado = 'empate' then 1 else 0 end,
    naturales = naturales + case when vj.total = 21 and n_cartas = 2 then 1 else 0 end,
    racha = case when gana then racha + 1 when p.resultado = 'derrota' then 0 else racha end,
    mejor_racha = greatest(mejor_racha, case when gana then racha + 1 else racha end),
    reglas_ganadas = case when gana and not (p.regla = any (reglas_ganadas)) then array_append(reglas_ganadas, p.regla) else reglas_ganadas end,
    contadores = cont,
    neto = neto + case when p.modo = 'apuesta' then coalesce(p.neto, 0) else 0 end,
    actualizado = now()
  where user_id = p.user_id
  returning * into est;

  with ins as (
    insert into veintiuna_logros (user_id, logro)
    select p.user_id, d.id from veintiuna_logros_def d
    where case d.id
      when 'primera_vela' then est.victorias >= 1
      when 'bajo_maldicion' then coalesce((est.contadores ->> 'ganadas_maldicion')::int, 0) >= 1
      when 'peaje_pagado' then coalesce((est.contadores ->> 'ganadas_fortuna_usada')::int, 0) >= 1
      when 'ultima_palabra' then coalesce((est.contadores ->> 'ganadas_voluntad_usada')::int, 0) >= 1
      when 'veintiuna_exacta' then coalesce((est.contadores ->> 'veintiunas')::int, 0) >= 1
      when 'natural' then est.naturales >= 1
      when 'tres_velas' then est.mejor_racha >= 3
      when 'tres_voluntades' then cardinality(est.reglas_ganadas) >= 3
      when 'seis_velas' then est.mejor_racha >= 6
      when 'cinco_cartas' then coalesce((est.contadores ->> 'cinco_cartas')::int, 0) >= 1
      when 'maestro' then est.victorias >= 50
      else false end
    on conflict do nothing
    returning logro
  )
  select coalesce(array_agg(logro), '{}') into nuevos from ins;
  return nuevos;
end;
$$;

-- Cierra la mano con un resultado: paga (una sola vez: solo si la mano seguía en curso), apunta el movimiento y registra la mano
create or replace function veintiuna_i_liquidar(p_id uuid, p_resultado text, p_razon text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p veintiuna_partidas%rowtype;
  v_pago numeric;
  v_neto numeric;
  v_saldo numeric;
  v_mov bigint;
  v_nuevos text[];
  v_concepto text;
begin
  select * into p from veintiuna_partidas where id = p_id for update;
  if not found then raise exception 'Esa mano no existe'; end if;
  if p.estado = 'terminada' then return; end if;                    -- jamás se liquida dos veces
  v_pago := case p_resultado when 'natural' then p.apuesta * 2.5 when 'victoria' then p.apuesta * 2 when 'empate' then p.apuesta else 0 end;
  v_neto := v_pago - p.apuesta - p.peajes;
  if p.modo = 'apuesta' and v_pago > 0 then
    update hipodromo_billeteras set saldo = saldo + v_pago where usuario = p.user_id returning saldo into v_saldo;
    v_concepto := case p_resultado when 'natural' then 'blackjack natural' when 'victoria' then 'victoria' else 'empate, apuesta devuelta' end;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
      values (p.user_id, null, 'Veintiuna Velas: ' || v_concepto || ' (mano ' || p.id || ')', v_pago, v_saldo) returning id into v_mov;
  end if;
  update veintiuna_partidas set estado = 'terminada', resultado = p_resultado, razon = p_razon, pago = v_pago, neto = v_neto, terminada = now(), mov_pago = v_mov
    where id = p_id returning * into p;
  v_nuevos := veintiuna_i_registrar(p);
  update veintiuna_partidas set logros_nuevos = v_nuevos where id = p_id;
end;
$$;

/* ================================================================== 5) ACCIONES DEL JUGADOR */
-- Aplica una acción a una mano en curso (la fila ya está bloqueada). Devuelve la mano actualizada.
create or replace function veintiuna_i_aplicar(p_id uuid, p_accion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p veintiuna_partidas%rowtype;
  figura int;
  vj record;
  vc record;
  fraccion numeric;
  peaje numeric;
  v_saldo numeric;
  v_mov bigint;
  nueva smallint;
  cru smallint[];
  rep int;
  forzar boolean := false;
begin
  select * into p from veintiuna_partidas where id = p_id for update;
  if p.estado <> 'en_curso' then perform veintiuna_i_error('Esa mano ya terminó.', 'mano_terminada'); end if;
  figura := case p.regla when 'maldicion' then 11 else 10 end;
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);

  if p_accion = 'pedir' then
    if p.fase <> 'jugador' then perform veintiuna_i_error('Ahora no puedes pedir carta.', 'accion_invalida'); end if;
    if vj.total >= 21 then perform veintiuna_i_error('Ya tienes 21: plántate.', 'accion_invalida'); end if;
    nueva := p.mazo[p.repartidas + 1];
    update veintiuna_partidas set jugador = jugador || nueva, repartidas = repartidas + 1 where id = p_id returning * into p;
    select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
    if vj.total > 21 then
      if p.regla = 'fortuna' and not p.fortuna_usada then
        update veintiuna_partidas set fase = 'fortuna' where id = p_id;     -- decide el jugador: salvar la mano pagando el peaje, o aceptar la derrota
        return;
      end if;
      perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas');
    end if;
    return;
  end if;

  if p_accion = 'fortuna' then
    if p.regla <> 'fortuna' or p.fase <> 'fortuna' or p.fortuna_usada then perform veintiuna_i_error('La Fortuna no está disponible ahora.', 'accion_invalida'); end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric;
    peaje := round(p.apuesta * fraccion, 2);
    if p.modo = 'apuesta' then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan las monedas para el peaje de la Fortuna (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
      update hipodromo_billeteras set saldo = saldo - peaje where usuario = p.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (p.user_id, null, 'Veintiuna Velas: peaje de la Fortuna (mano ' || p.id || ')', -peaje, v_saldo) returning id into v_mov;
    end if;
    update veintiuna_partidas set fase = 'jugador', fortuna_usada = true, peajes = peajes + peaje,
      jugador_as1 = jugador_as1 || array_length(jugador, 1), mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    return;
  end if;

  if p_accion = 'aceptar' then
    if p.fase <> 'fortuna' then perform veintiuna_i_error('No hay nada que aceptar.', 'accion_invalida'); end if;
    perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas');
    return;
  end if;

  if p_accion = 'voluntad' then
    if p.regla <> 'voluntad' or p.fase <> 'jugador' or p.voluntad_usada then perform veintiuna_i_error('La Última voluntad no está disponible ahora.', 'accion_invalida'); end if;
    if vj.total < (cartas_ajuste('veintiuna_voluntad_minimo', '0'))::text::int then
      perform veintiuna_i_error('La Última voluntad pide ' || (cartas_ajuste('veintiuna_voluntad_minimo', '0'))::text || ' puntos o más.', 'accion_invalida');
    end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_voluntad', '0.85'))::text::numeric;
    peaje := round(p.apuesta * fraccion, 2);
    if p.modo = 'apuesta' then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan las monedas para el peaje de la Última voluntad (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
      update hipodromo_billeteras set saldo = saldo - peaje where usuario = p.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (p.user_id, null, 'Veintiuna Velas: peaje de la Última voluntad (mano ' || p.id || ')', -peaje, v_saldo) returning id into v_mov;
    end if;
    update veintiuna_partidas set voluntad_usada = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id returning * into p;
    forzar := true;
  elsif p_accion = 'plantar' then
    if p.fase <> 'jugador' then perform veintiuna_i_error('Ahora no puedes plantarte.', 'accion_invalida'); end if;
  else
    perform veintiuna_i_error('Esa acción no existe.', 'accion_invalida');
  end if;

  -- Plantarse (con o sin Última voluntad): el crupier juega su turno
  select o_crupier, o_repartidas into cru, rep from veintiuna_i_turno_crupier(p.mazo, p.repartidas, p.crupier, figura, forzar);
  update veintiuna_partidas set crupier = cru, repartidas = rep where id = p_id;
  select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
  if vc.total > 21 then
    perform veintiuna_i_liquidar(p_id, 'victoria', 'crupier_se_pasa');
  elsif vj.total > vc.total then
    perform veintiuna_i_liquidar(p_id, 'victoria', 'mayor');
  elsif vj.total < vc.total then
    perform veintiuna_i_liquidar(p_id, 'derrota', 'menor');
  else
    perform veintiuna_i_liquidar(p_id, 'empate', 'igual');
  end if;
end;
$$;

-- Una mano que lleva demasiado tiempo parada se cierra sola, plantándose (o aceptando el pasarse si estaba pendiente de la Fortuna)
create or replace function veintiuna_i_cerrar_inactiva(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p veintiuna_partidas%rowtype;
  minutos numeric := (cartas_ajuste('veintiuna_inactividad_min', '30'))::text::numeric;
begin
  select * into p from veintiuna_partidas where user_id = p_uid and estado = 'en_curso' for update;
  if found and p.ultima_accion < now() - make_interval(secs => minutos * 60) then
    perform veintiuna_i_aplicar(p.id, case when p.fase = 'fortuna' then 'aceptar' else 'plantar' end);
    update veintiuna_partidas set paso = paso + 1 where id = p.id;
  end if;
end;
$$;

/* ================================================================== 6) LO QUE LLAMA EL NAVEGADOR */
-- La mesa: saldo, límites, la mano en curso (si la hay), la regla de la siguiente mano, estadísticas y desafíos
create or replace function veintiuna_mesa()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  est veintiuna_estadisticas%rowtype;
  p veintiuna_partidas%rowtype;
  cfg cartas_juegos%rowtype;
  v_saldo numeric;
  hoy_total int;
  hoy_juego int;
  logros jsonb;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));
  insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (uid, veintiuna_i_regla_nueva()) on conflict do nothing;
  perform veintiuna_i_cerrar_inactiva(uid);
  select * into est from veintiuna_estadisticas where user_id = uid;
  select saldo into v_saldo from hipodromo_billeteras where usuario = uid;
  select * into p from veintiuna_partidas where user_id = uid and estado = 'en_curso';
  select * into cfg from cartas_juegos where juego = 'veintiuna';
  select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
  select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = 'veintiuna' and creado >= date_trunc('day', now());

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'nivel', d.nivel, 'nombre', d.nombre, 'texto', d.texto, 'meta', d.meta,
      'progreso', least(d.meta, case d.id
        when 'primera_vela' then est.victorias
        when 'bajo_maldicion' then coalesce((est.contadores ->> 'ganadas_maldicion')::int, 0)
        when 'peaje_pagado' then coalesce((est.contadores ->> 'ganadas_fortuna_usada')::int, 0)
        when 'ultima_palabra' then coalesce((est.contadores ->> 'ganadas_voluntad_usada')::int, 0)
        when 'veintiuna_exacta' then coalesce((est.contadores ->> 'veintiunas')::int, 0)
        when 'natural' then est.naturales
        when 'tres_velas' then est.mejor_racha
        when 'tres_voluntades' then cardinality(est.reglas_ganadas)
        when 'seis_velas' then est.mejor_racha
        when 'cinco_cartas' then coalesce((est.contadores ->> 'cinco_cartas')::int, 0)
        when 'maestro' then est.victorias
        else 0 end),
      'completado', l.completado, 'reclamado', l.reclamado, 'carta', l.carta) order by d.orden), '[]'::jsonb)
    into logros
    from veintiuna_logros_def d left join veintiuna_logros l on l.logro = d.id and l.user_id = uid;

  return jsonb_build_object(
    'saldo', v_saldo,
    'limites', jsonb_build_object(
      'min', (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric,
      'max', (cartas_ajuste('veintiuna_apuesta_max', '100'))::text::numeric,
      'paso', (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric),
    'peajes', jsonb_build_object(
      'fortuna', (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric,
      'voluntad', (cartas_ajuste('veintiuna_peaje_voluntad', '0.85'))::text::numeric),
    'voluntad_minimo', (cartas_ajuste('veintiuna_voluntad_minimo', '0'))::text::int,
    'inactividad_min', (cartas_ajuste('veintiuna_inactividad_min', '30'))::text::numeric,
    'partida', case when p.id is not null then veintiuna_i_estado(p, v_saldo) end,
    'proxima_regla', est.proxima_regla,
    'estadisticas', jsonb_build_object('rondas', est.rondas, 'victorias', est.victorias, 'derrotas', est.derrotas, 'empates', est.empates, 'naturales', est.naturales,
                                       'racha', est.racha, 'mejor_racha', est.mejor_racha, 'neto', est.neto),
    'logros', logros,
    'recompensas', jsonb_build_object('activas', coalesce(cfg.activo, false), 'hoy', hoy_juego, 'tope_dia', coalesce(cfg.tope_dia, 1), 'tope_total_agotado', hoy_total >= (cartas_ajuste('tope_dia_total', '6'))::text::int)
  );
end;
$$;

-- Repartir una mano. El interno recibe el jugador y la baraja (las pruebas le pasan barajas conocidas); el público usa la sesión y una baraja nueva.
create or replace function veintiuna_i_repartir(p_uid uuid, p_cliente uuid, p_modo text, p_apuesta numeric, p_mazo smallint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := p_uid;
  min_a numeric := (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric;
  max_a numeric := (cartas_ajuste('veintiuna_apuesta_max', '100'))::text::numeric;
  paso_a numeric := (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric;
  est veintiuna_estadisticas%rowtype;
  p veintiuna_partidas%rowtype;
  v_id uuid := gen_random_uuid();
  v_apuesta numeric;
  v_saldo numeric;
  v_mov bigint;
  v_regla text;
  v_mazo smallint[];
  figura int;
  vj record;
  vc record;
  v_res text;
  v_razon text;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if p_cliente is null then perform veintiuna_i_error('Falta el identificador de la mano.', 'peticion_invalida'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));

  select * into p from veintiuna_partidas where user_id = uid and cliente = p_cliente;
  if found then return veintiuna_i_estado(p, veintiuna_i_saldo(uid)) || jsonb_build_object('repetida', true); end if;

  perform veintiuna_i_cerrar_inactiva(uid);
  if exists (select 1 from veintiuna_partidas where user_id = uid and estado = 'en_curso') then
    perform veintiuna_i_error('Ya tienes una mano en curso. Termínala antes de repartir otra.', 'mano_en_curso');
  end if;
  if p_modo not in ('apuesta', 'practica') then perform veintiuna_i_error('Esa modalidad no existe.', 'peticion_invalida'); end if;
  if p_modo = 'apuesta' then
    v_apuesta := p_apuesta;
    if v_apuesta is null or v_apuesta < min_a or v_apuesta > max_a then
      perform veintiuna_i_error('La apuesta va de ' || min_a || ' a ' || max_a || ' monedas.', 'apuesta_invalida');
    end if;
    if v_apuesta <> trunc(v_apuesta / paso_a) * paso_a then
      perform veintiuna_i_error('La apuesta tiene que ser múltiplo de ' || paso_a || '.', 'apuesta_invalida');
    end if;
  else
    v_apuesta := min_a;                                              -- la mesa de práctica usa una apuesta simbólica que no se cobra
  end if;

  insert into veintiuna_estadisticas (user_id, proxima_regla) values (uid, veintiuna_i_regla_nueva()) on conflict do nothing;
  select * into est from veintiuna_estadisticas where user_id = uid for update;
  v_regla := est.proxima_regla;
  update veintiuna_estadisticas set proxima_regla = veintiuna_i_regla_nueva() where user_id = uid;
  figura := case v_regla when 'maldicion' then 11 else 10 end;
  v_mazo := p_mazo;

  if p_modo = 'apuesta' then
    insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
    select saldo into v_saldo from hipodromo_billeteras where usuario = uid for update;
    if v_apuesta > v_saldo then
      perform veintiuna_i_error('No tienes tantas monedas: te faltan ' || trim_scale(v_apuesta - v_saldo) || '.', 'saldo_insuficiente');
    end if;
    update hipodromo_billeteras set saldo = saldo - v_apuesta where usuario = uid returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
      values (uid, null, 'Veintiuna Velas: apuesta (mano ' || v_id || ')', -v_apuesta, v_saldo) returning id into v_mov;
  end if;

  -- Reparto: jugador, crupier (la carta que se ve), jugador, crupier (la oculta)
  insert into veintiuna_partidas (id, user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier, mov_cobro)
    values (v_id, uid, p_cliente, p_modo, v_apuesta, v_regla, v_mazo, 4, array[v_mazo[1], v_mazo[3]], array[v_mazo[2], v_mazo[4]], v_mov)
    returning * into p;

  -- Orden de resolución al repartir
  select * into vj from veintiuna_i_valor(p.jugador, '{}'::int[], figura);
  select * into vc from veintiuna_i_valor(p.crupier, '{}'::int[], figura);
  if vj.total > 21 then v_res := 'derrota'; v_razon := 'pasado_al_repartir';                  -- solo con la Maldición: dos figuras suman 22
  elsif vj.total = 21 and vc.total = 21 then v_res := 'empate'; v_razon := 'ambos_natural';
  elsif vj.total = 21 then v_res := 'natural'; v_razon := 'natural';
  elsif vc.total = 21 then v_res := 'derrota'; v_razon := 'natural_crupier';
  elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_pasado_al_repartir';       -- solo con la Maldición
  end if;
  if v_res is not null then perform veintiuna_i_liquidar(v_id, v_res, v_razon); end if;

  select * into p from veintiuna_partidas where id = v_id;
  return veintiuna_i_estado(p, veintiuna_i_saldo(uid));
end;
$$;

-- Repartir una mano. p_cliente: un identificador nuevo por mano (si la petición se repite, devuelve la misma mano sin cobrar otra vez)
create or replace function veintiuna_repartir(p_cliente uuid, p_modo text, p_apuesta numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  return veintiuna_i_repartir(auth.uid(), p_cliente, p_modo, p_apuesta, veintiuna_i_mazo());
end;
$$;

-- Una acción en la mano: 'pedir', 'plantar', 'voluntad' (Última voluntad), 'fortuna' (salvar la mano pagando el peaje) o 'aceptar' (aceptar el pasarte).
-- p_paso es el paso que el navegador cree que tiene la mano. Si ya pasó (se reenvió la misma acción), no se aplica otra vez: se devuelve el estado actual.
create or replace function veintiuna_accion(p_partida uuid, p_paso int, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p veintiuna_partidas%rowtype;
  minutos numeric := (cartas_ajuste('veintiuna_inactividad_min', '30'))::text::numeric;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));
  select * into p from veintiuna_partidas where id = p_partida and user_id = uid for update;
  if not found then perform veintiuna_i_error('No encuentro esa mano.', 'no_encontrada'); end if;
  if p.estado = 'terminada' or p_paso < p.paso then
    return veintiuna_i_estado(p, veintiuna_i_saldo(uid)) || jsonb_build_object('repetida', true);
  end if;
  if p_paso > p.paso then perform veintiuna_i_error('La mesa y tu pantalla no coinciden. Recarga la mesa.', 'paso_futuro'); end if;
  if p.ultima_accion < now() - make_interval(secs => minutos * 60) then
    perform veintiuna_i_cerrar_inactiva(uid);                         -- tardaste demasiado: la mano se plantó sola
    select * into p from veintiuna_partidas where id = p_partida;
    return veintiuna_i_estado(p, veintiuna_i_saldo(uid)) || jsonb_build_object('cerrada_por_inactividad', true);
  end if;
  perform veintiuna_i_aplicar(p_partida, p_accion);
  update veintiuna_partidas set paso = paso + 1, ultima_accion = now() where id = p_partida;
  select * into p from veintiuna_partidas where id = p_partida;
  return veintiuna_i_estado(p, veintiuna_i_saldo(uid));
end;
$$;

-- Las últimas manos terminadas (con las cartas, que ya no se esconden) y lo que variaron las monedas
create or replace function veintiuna_historial(p_limite int default 15)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.terminada desc), '[]'::jsonb) from (
    select p.id, p.terminada, p.modo, p.regla, p.resultado, p.razon, p.apuesta, p.peajes, p.pago, p.neto,
           veintiuna_i_mano_json(p.jugador, p.jugador_as1) as jugador, veintiuna_i_mano_json(p.crupier, '{}'::int[]) as crupier,
           (select total from veintiuna_i_valor(p.jugador, p.jugador_as1, case p.regla when 'maldicion' then 11 else 10 end)) as total_jugador,
           (select total from veintiuna_i_valor(p.crupier, '{}'::int[], case p.regla when 'maldicion' then 11 else 10 end)) as total_crupier
    from veintiuna_partidas p
    where p.user_id = auth.uid() and p.estado = 'terminada'
    order by p.terminada desc
    limit greatest(1, least(coalesce(p_limite, 15), 50))
  ) x
$$;

-- Reclamar la carta de un desafío completado. Pasa por el sistema oficial de recompensas; si no hay carta que dar (apagado, tope del día, agotado)
-- NO se gasta el desafío y se puede reclamar más tarde.
create or replace function veintiuna_reclamar(p_logro text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l veintiuna_logros%rowtype;
  d veintiuna_logros_def%rowtype;
  cfg cartas_juegos%rowtype;
  hoy_total int;
  hoy_juego int;
  tope_total int := (cartas_ajuste('tope_dia_total', '6'))::text::int;
  v_token uuid;
  r jsonb := '{}'::jsonb;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  perform cartas_i_candado_jugador(uid);
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));
  select * into d from veintiuna_logros_def where id = p_logro;
  if not found then perform veintiuna_i_error('Ese desafío no existe.', 'no_encontrado'); end if;
  select * into l from veintiuna_logros where user_id = uid and logro = p_logro for update;
  if not found then perform veintiuna_i_error('Ese desafío todavía no está completado.', 'no_completado'); end if;
  if l.reclamado is not null then perform veintiuna_i_error('Ya reclamaste este desafío.', 'ya_reclamado'); end if;

  select * into cfg from cartas_juegos where juego = 'veintiuna';
  if not found or not cfg.activo then return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo'); end if;
  select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
  select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = 'veintiuna' and creado >= date_trunc('day', now());
  if hoy_total >= tope_total or hoy_juego >= cfg.tope_dia then return jsonb_build_object('resultado', 'nada', 'motivo', 'tope-diario'); end if;

  -- «Mejora personal» del sistema general sube un tramo al superar tu mejor puntaje; aquí no hay puntajes sino niveles de desafío, así que se deja sin efecto
  insert into cartas_progreso (user_id, juego, mejor) values (uid, 'veintiuna', 1000) on conflict (user_id, juego) do update set mejor = 1000;

  begin
    insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'veintiuna', d.nivel, now() - interval '1 hour') returning token into v_token;
    r := cartas_i_juego_terminar_nucleo(v_token, 'gana', 0);
    if r ->> 'resultado' is distinct from 'carta' then
      raise exception 'sin carta' using errcode = 'VE001';              -- deshace todo lo que hizo el cierre (token, sello, registro): el desafío sigue guardado
    end if;
  exception when sqlstate 'VE001' then
    return jsonb_build_object('resultado', 'nada', 'motivo', coalesce(nullif(r ->> 'motivo', ''), 'agotado'), 'nota', r ->> 'nota');
  end;

  update veintiuna_logros set reclamado = now(), carta = r ->> 'carta', numero = (r ->> 'numero')::int where user_id = uid and logro = p_logro;
  return r || jsonb_build_object('logro', d.nombre, 'nivel', d.nivel,
    'cantidad', (select count(*) from cartas_ejemplares where propietario = uid and carta_id = r ->> 'carta' and estado in ('poseida', 'bloqueada')));
end;
$$;

/* ================================================================== 7) PERMISOS */
revoke all on function veintiuna_i_error(text, text), veintiuna_i_azar(int), veintiuna_i_regla_nueva(), veintiuna_i_mazo(),
  veintiuna_i_valor(smallint[], int[], int), veintiuna_i_carta(smallint, boolean), veintiuna_i_mano_json(smallint[], int[]), veintiuna_i_saldo(uuid),
  veintiuna_i_turno_crupier(smallint[], int, smallint[], int, boolean), veintiuna_i_repartir(uuid, uuid, text, numeric, smallint[]), veintiuna_i_estado(veintiuna_partidas, numeric), veintiuna_i_registrar(veintiuna_partidas),
  veintiuna_i_liquidar(uuid, text, text), veintiuna_i_aplicar(uuid, text), veintiuna_i_cerrar_inactiva(uuid) from public, anon, authenticated;
revoke all on function veintiuna_mesa(), veintiuna_repartir(uuid, text, numeric), veintiuna_accion(uuid, int, text), veintiuna_historial(int), veintiuna_reclamar(text) from public, anon;
grant execute on function veintiuna_mesa(), veintiuna_repartir(uuid, text, numeric), veintiuna_accion(uuid, int, text), veintiuna_historial(int), veintiuna_reclamar(text) to authenticated;
