-- LAS VEINTIUNA VELAS: un blackjack contra la casa (veintiuna.html), con una regla especial por ronda.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de la economía de cartas (economia-1 a economia-21) y del Hipódromo (docs/hipodromo.sql). Se puede repetir.
--
-- Qué hay aquí (el diseño completo está en docs/veintiuna.md):
--   * La mesa entera vive en el servidor: la baraja se baraja aquí con gen_random_uuid() (aleatoriedad criptográfica del servidor), se guarda aquí y el
--     navegador solo recibe las cartas que ya se ven. La carta oculta del crupier NO sale del servidor hasta que la ronda termina.
--   * Los tokens son los del Hipódromo: se usa su billetera (hipodromo_billeteras) y su libro (hipodromo_movimientos). No hay billetera nueva. Cada movimiento
--     lleva en el concepto el identificador de la mano, y la mano guarda los números de sus movimientos.
--   * Una mano por jugador a la vez (índice único), cada petición lleva un identificador (reintentar no cobra dos veces) y cada acción lleva el número de paso
--     (repetir una acción ya aplicada devuelve el estado actual en vez de aplicarla otra vez). Una mano abandonada se cierra sola, plantándose, a los 30 minutos.
--   * Mesa de práctica: mismas reglas y mismas cartas, apuesta simbólica, sin tocar la billetera. No cuenta para los desafíos ni para las rachas, no da tokens.
--   * Desafíos: logros que el servidor comprueba al terminar cada mano. Cada uno se completa una vez y se reclama una vez. La carta sale del sistema oficial de
--     recompensas (cartas_juegos 'veintiuna' + cartas_i_juego_terminar_nucleo), con sus topes diarios, límites global y por jugador, circulación y reserva.
--     El juego nace APAGADO (activo = false): se enciende en Admin → Economía → Juegos y recetas. Apagado, los desafíos se siguen completando y esperan.

/* ================================================================== 0) AJUSTES */
insert into cartas_economia_ajustes (clave, valor) values
  ('veintiuna_apuesta_min', '10'),        -- apuesta mínima (la apuesta de la mesa de práctica es esta, simbólica)
  ('veintiuna_apuesta_max', '0'),         -- apuesta máxima; 0 = sin máximo (se puede apostar todo lo que tengas). Si algún día hace falta un tope, se pone aquí
  ('veintiuna_apuesta_paso', '10'),       -- las apuestas son múltiplos de esto (así el 3 a 2 del blackjack natural siempre da tokens enteros)
  ('veintiuna_peaje_fortuna', '0.6'),     -- Fortuna: fracción de la apuesta que cuesta salvar la mano
  ('veintiuna_peaje_voluntad', '0.5'),   -- Última voluntad: fracción de la apuesta que cuesta cambiar tu última carta por la siguiente
  ('veintiuna_peaje_ojo', '0.35'),       -- Ojo del Tahúr: fracción de la apuesta que cuesta ver la siguiente carta de la baraja
  ('veintiuna_peaje_marcadas', '0.18'),   -- Cartas marcadas: fracción de la apuesta que cuesta ver la carta oculta del crupier
  ('veintiuna_peaje_trueque', '1'),       -- Trueque con la casa: fracción de la apuesta que cuesta cambiar tu primera carta por la visible del crupier
  ('veintiuna_inactividad_min', '30'),    -- minutos sin jugar tras los que la mano se cierra sola, plantándose
  ('veintiuna_mesa_asientos', '5'),       -- asientos de una mesa con amigos
  ('veintiuna_mesa_apuestas_s', '45'),    -- segundos que quedan para apostar cuando el primero de la mesa ya apostó
  ('veintiuna_mesa_turno_s', '45'),       -- segundos que tiene cada jugador en su turno antes de plantarse solo
  ('veintiuna_mesa_resultado_s', '10'),   -- segundos que se enseña el resultado antes de la siguiente ronda
  ('veintiuna_mesa_inactividad_s', '150'),-- segundos sin dar señales (la página abierta avisa cada pocos segundos) tras los que se levanta de la mesa
  ('veintiuna_mesa_perdidos_max', '2'),   -- turnos seguidos que puede dejar que se jueguen solos antes de que lo levanten de la mesa
  ('veintiuna_pozo_max_dia', '5')         -- veces al día que un jugador puede poner una carta en el pozo de una mesa
on conflict (clave) do nothing;
-- La mesa nació con un máximo de 100; el usuario lo quitó (18-oct-2026). Solo se toca si sigue con el valor de origen.
update cartas_economia_ajustes set valor = '0' where clave = 'veintiuna_apuesta_max' and valor = '100'::jsonb;

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
  ('sin_miedo',        6, 'plata',  'Sin miedo',                 'Gana plantándote con 14 puntos o menos.', 1),
  ('tres_velas',       7, 'plata',  'Tres velas seguidas',       'Gana tres manos seguidas. Un empate no rompe la racha.', 3),
  ('tres_voluntades',  8, 'plata',  'Tres caras de la mesa',      'Gana al menos una mano con tres reglas distintas.', 3),
  ('ultima_hora',      9, 'oro',    'Reescribir el destino',     'Gana con 20 o 21 después de cambiar una carta con la Última voluntad.', 1),
  ('cinco_cartas',    10, 'oro',    'Cinco cartas sin pasarte',  'Gana con cinco cartas o más sin pasarte de 21.', 1),
  ('fortuna_veintiuna', 11, 'oro',  'La suerte bien pagada',     'Gana con 21 exactos después de salvar la mano con la Fortuna.', 1)
on conflict (id) do update set orden = excluded.orden, nivel = excluded.nivel, nombre = excluded.nombre, texto = excluded.texto, meta = excluded.meta;
-- Desafíos de una versión anterior (premiaban repetir manos o la pura suerte): fuera
delete from veintiuna_logros_def where id in ('natural', 'seis_velas', 'maestro');

create table if not exists veintiuna_estadisticas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  proxima_regla text not null default 'maldicion',   -- la regla de la siguiente mano, ya decidida y visible
  rondas int not null default 0,
  victorias int not null default 0,
  derrotas int not null default 0,
  empates int not null default 0,
  naturales int not null default 0,
  racha int not null default 0,
  mejor_racha int not null default 0,
  reglas_ganadas text[] not null default '{}',
  contadores jsonb not null default '{}'::jsonb,
  neto numeric(12, 2) not null default 0,          -- tokens ganados o perdidos en manos con apuesta
  actualizado timestamptz not null default now()
);
-- Los desafíos se reinician cada día (a las 00:00 UTC, el mismo día que usan los topes de cartas): dia_logros es el día al que pertenece el progreso de hoy
alter table veintiuna_estadisticas add column if not exists dia_logros date not null default ((now() at time zone 'utc')::date);

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
  regla text not null,
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
  ojo_pos int,                                              -- Ojo del Tahúr: cuántas cartas se habían repartido cuando se miró (la carta que se ve es la siguiente)
  marcadas_usada boolean not null default false,
  trueque_usado boolean not null default false,
  bufon_evento text,
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
-- Si la mesa ya existía con tres reglas, se amplían las reglas y las columnas (se puede repetir)
alter table veintiuna_partidas add column if not exists ojo_pos int;
alter table veintiuna_partidas add column if not exists marcadas_usada boolean not null default false;
alter table veintiuna_partidas add column if not exists trueque_usado boolean not null default false;
alter table veintiuna_partidas add column if not exists bufon_evento text;
alter table veintiuna_partidas drop constraint if exists veintiuna_partidas_regla_check;
alter table veintiuna_partidas add constraint veintiuna_partidas_regla_check check (regla in ('fortuna', 'maldicion', 'voluntad', 'ojo', 'marcadas', 'trueque', 'vela', 'bufon'));
alter table veintiuna_partidas drop constraint if exists veintiuna_partidas_bufon_evento_check;
alter table veintiuna_partidas add constraint veintiuna_partidas_bufon_evento_check check (bufon_evento is null or bufon_evento in ('nada', 'crupier', 'jugador'));
alter table veintiuna_estadisticas drop constraint if exists veintiuna_estadisticas_proxima_regla_check;
alter table veintiuna_estadisticas add constraint veintiuna_estadisticas_proxima_regla_check check (proxima_regla in ('fortuna', 'maldicion', 'voluntad', 'ojo', 'marcadas', 'trueque', 'vela', 'bufon'));

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
  select (array['fortuna', 'maldicion', 'voluntad', 'ojo', 'marcadas', 'trueque', 'vela', 'bufon'])[1 + veintiuna_i_azar(8)]
$$;

-- En «todos contra todos» no hay crupier que juegue: solo valen las reglas que se juegan entre jugadores
create or replace function veintiuna_i_regla_nueva_duelo()
returns text
language sql
volatile
as $$
  select (array['fortuna', 'maldicion', 'voluntad', 'ojo', 'bufon'])[1 + veintiuna_i_azar(5)]
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

-- El turno del crupier: pide mientras no llegue a p_limite (17 normalmente, 16 con la Vela corta; también se planta con 17 blando). p_forzar (robar una carta de más antes de nada) ya no lo usa ninguna regla
drop function if exists veintiuna_i_turno_crupier(smallint[], int, smallint[], int, boolean);
create or replace function veintiuna_i_turno_crupier(p_mazo smallint[], p_repartidas int, p_crupier smallint[], p_figura int, p_forzar boolean, p_limite int, out o_crupier smallint[], out o_repartidas int)
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
    exit when v.total >= p_limite;
    if o_repartidas >= array_length(p_mazo, 1) then raise exception 'La baraja se acabó'; end if;
    o_crupier := o_crupier || p_mazo[o_repartidas + 1];
    o_repartidas := o_repartidas + 1;
  end loop;
end;
$$;

-- El peaje de la acción especial de cada regla: una fracción de la apuesta (las reglas sin acción no cobran nada)
create or replace function veintiuna_i_peaje(p_regla text, p_apuesta numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select round(p_apuesta * case p_regla
    when 'fortuna' then (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric
    when 'voluntad' then (cartas_ajuste('veintiuna_peaje_voluntad', '0.5'))::text::numeric
    when 'ojo' then (cartas_ajuste('veintiuna_peaje_ojo', '0.35'))::text::numeric
    when 'marcadas' then (cartas_ajuste('veintiuna_peaje_marcadas', '0.18'))::text::numeric
    when 'trueque' then (cartas_ajuste('veintiuna_peaje_trueque', '1'))::text::numeric
    else 0 end, 2)
$$;

-- Cobra el peaje de una acción especial de la billetera (solo en la mesa con apuesta) y lo apunta en el libro. Devuelve el número del movimiento.
create or replace function veintiuna_i_cobrar(p_user uuid, p_modo text, p_peaje numeric, p_nombre text, p_mano uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
  v_mov bigint;
begin
  if p_modo <> 'apuesta' then return null; end if;
  select saldo into v_saldo from hipodromo_billeteras where usuario = p_user for update;
  if coalesce(v_saldo, 0) < p_peaje then perform veintiuna_i_error('No te alcanzan los tokens para el peaje ' || p_nombre || ' (' || trim_scale(p_peaje) || ').', 'saldo_insuficiente'); end if;
  update hipodromo_billeteras set saldo = saldo - p_peaje where usuario = p_user returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (p_user, null, 'Veintiuna Velas: peaje ' || p_nombre || ' (mano ' || p_mano || ')', -p_peaje, v_saldo) returning id into v_mov;
  return v_mov;
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
  peaje numeric := veintiuna_i_peaje(p.regla, p.apuesta);
  puede_pedir boolean := false;
  especial jsonb := 'null'::jsonb;
  usada boolean;
  cru_cartas smallint[];
  faltan numeric;
  motivo text;
begin
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
  cru_cartas := case when terminada then p.crupier else p.crupier[1:1] end;
  select * into vc from veintiuna_i_valor(cru_cartas, '{}'::int[], figura);
  usada := case p.regla when 'fortuna' then p.fortuna_usada when 'voluntad' then p.voluntad_usada when 'ojo' then p.ojo_pos is not null when 'marcadas' then p.marcadas_usada when 'trueque' then p.trueque_usado else false end;

  if not terminada then
    if p.fase = 'jugador' then
      puede_pedir := vj.total < 21;
      if p.regla in ('voluntad', 'ojo', 'marcadas', 'trueque') then
        faltan := case when p.modo = 'apuesta' then greatest(peaje - p_saldo, 0) else 0 end;
        motivo := case
          when usada then 'ya lo usaste'
          when p.regla in ('voluntad', 'ojo') and vj.total >= 21 then 'con 21 no hace falta'
          when p.regla = 'trueque' and array_length(p.jugador, 1) <> 2 then 'solo antes de pedir carta'
          when faltan > 0 then 'te faltan ' || trim_scale(faltan) || ' tokens' end;
        especial := jsonb_build_object('tipo', p.regla, 'disponible', motivo is null, 'motivo', motivo, 'peaje', peaje);
      end if;
    elsif p.fase = 'fortuna' then
      faltan := case when p.modo = 'apuesta' then greatest(peaje - p_saldo, 0) else 0 end;
      especial := jsonb_build_object('tipo', 'fortuna', 'disponible', faltan = 0, 'motivo', case when faltan > 0 then 'te faltan ' || trim_scale(faltan) || ' tokens' end, 'peaje', peaje);
    end if;
  end if;

  return jsonb_build_object(
    'partida', p.id,
    'paso', p.paso,
    'modo', p.modo,
    'apuesta', p.apuesta,
    'peajes', p.peajes,
    'regla', jsonb_build_object('id', p.regla, 'usada', usada, 'peaje', case when p.regla in ('fortuna', 'voluntad', 'ojo', 'marcadas', 'trueque') then peaje end,
                                'evento', p.bufon_evento,
                                -- Ojo del Tahúr: la carta que viene, solo mientras siga siendo la siguiente y solo si ya pagaste el peaje
                                'proxima', case when not terminada and p.ojo_pos is not null and p.repartidas = p.ojo_pos and p.fase = 'jugador' then veintiuna_i_carta(p.mazo[p.repartidas + 1]) end),
    'estado', p.estado,
    'fase', case when terminada then 'fin' else p.fase end,
    'jugador', jsonb_build_object('cartas', veintiuna_i_mano_json(p.jugador, p.jugador_as1), 'total', vj.total, 'blando', vj.blando),
    'crupier', jsonb_build_object('cartas', veintiuna_i_mano_json(cru_cartas, '{}'::int[]), 'ocultas', case when terminada then 0 else 1 end, 'total', vc.total, 'blando', vc.blando,
                                  'robadas_desde', case when terminada then 3 else null end,
                                  -- Cartas marcadas: la carta oculta, solo si ya pagaste el peaje
                                  'vista', case when not terminada and p.marcadas_usada then veintiuna_i_carta(p.crupier[2]) end),
    'acciones', case when terminada then 'null'::jsonb else jsonb_build_object('pedir', puede_pedir, 'plantar', p.fase = 'jugador', 'especial', especial) end,
    'resultado', case when terminada then jsonb_build_object('tipo', p.resultado, 'razon', p.razon, 'pago', p.pago, 'neto', p.neto, 'apuesta', p.apuesta, 'peajes', p.peajes) end,
    'logros_nuevos', to_jsonb(p.logros_nuevos),
    'saldo', p_saldo
  );
end;
$$;

/* ================================================================== 4) FIN DE LA MANO: cobro, estadísticas y desafíos */
-- Registra la mano en las estadísticas y completa los desafíos. Devuelve los desafíos que acaban de completarse.
/* Reinicio diario de los desafíos: si el progreso guardado es de un día anterior, se borra (contadores del día, racha del día, reglas ganadas del día) y se quitan los
   desafíos de ayer, hayan sido reclamados o no. Lo completado y no reclamado ayer se apaga: hay que volver a completarlo hoy. Las estadísticas de siempre (rondas, victorias,
   mejor racha...) no se tocan. Se llama al empezar a registrar una mano, al mirar la mesa y al reclamar. */
create or replace function veintiuna_i_dia_logros(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update veintiuna_estadisticas set dia_logros = (now() at time zone 'utc')::date, contadores = '{}'::jsonb
  where user_id = p_uid and dia_logros < (now() at time zone 'utc')::date;
  if found then delete from veintiuna_logros where user_id = p_uid; end if;
end;
$$;

create or replace function veintiuna_i_registrar(p veintiuna_partidas)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  est veintiuna_estadisticas%rowtype;
  gana boolean := p.resultado in ('natural', 'victoria');
  cuenta boolean := p.modo = 'apuesta' and not p.duelo;   -- ni la mesa de práctica ni «todos contra todos» cuentan para rachas ni desafíos (así nadie los gana pactando con un amigo)
  n_cartas int := coalesce(array_length(p.jugador, 1), 0);
  vj record;
  cont jsonb;
  nuevos text[];
begin
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (p.user_id, veintiuna_i_regla_nueva()) on conflict do nothing;
  perform veintiuna_i_dia_logros(p.user_id);
  select * into est from veintiuna_estadisticas where user_id = p.user_id for update;
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, case p.regla when 'maldicion' then 11 else 10 end);
  cont := est.contadores;
  if cuenta then
    -- lo que cuenta para los desafíos de HOY (se borra con el reinicio diario): victorias, racha y reglas ganadas del día
    if gana then
      cont := jsonb_set(cont, '{victorias_dia}', to_jsonb(coalesce((cont ->> 'victorias_dia')::int, 0) + 1));
      cont := jsonb_set(cont, '{racha_dia}', to_jsonb(coalesce((cont ->> 'racha_dia')::int, 0) + 1));
      cont := jsonb_set(cont, '{mejor_racha_dia}', to_jsonb(greatest(coalesce((cont ->> 'mejor_racha_dia')::int, 0), coalesce((cont ->> 'racha_dia')::int, 0))));
      if not (coalesce(cont -> 'reglas_dia', '[]'::jsonb) ? p.regla) then cont := jsonb_set(cont, '{reglas_dia}', coalesce(cont -> 'reglas_dia', '[]'::jsonb) || to_jsonb(p.regla::text)); end if;
    elsif p.resultado = 'derrota' then
      cont := jsonb_set(cont, '{racha_dia}', '0'::jsonb);
    end if;
  end if;
  if gana and cuenta then
    if p.regla = 'maldicion' then cont := jsonb_set(cont, '{ganadas_maldicion}', to_jsonb(coalesce((cont ->> 'ganadas_maldicion')::int, 0) + 1)); end if;
    if p.fortuna_usada then cont := jsonb_set(cont, '{ganadas_fortuna_usada}', to_jsonb(coalesce((cont ->> 'ganadas_fortuna_usada')::int, 0) + 1)); end if;
    if p.voluntad_usada then cont := jsonb_set(cont, '{ganadas_voluntad_usada}', to_jsonb(coalesce((cont ->> 'ganadas_voluntad_usada')::int, 0) + 1)); end if;
    if p.resultado = 'victoria' and n_cartas > 2 and vj.total = 21 then cont := jsonb_set(cont, '{veintiunas}', to_jsonb(coalesce((cont ->> 'veintiunas')::int, 0) + 1)); end if;
    if p.resultado = 'victoria' and n_cartas >= 5 and vj.total <= 21 then cont := jsonb_set(cont, '{cinco_cartas}', to_jsonb(coalesce((cont ->> 'cinco_cartas')::int, 0) + 1)); end if;
    if p.resultado = 'victoria' and vj.total <= 14 then cont := jsonb_set(cont, '{ganadas_plantado_bajo}', to_jsonb(coalesce((cont ->> 'ganadas_plantado_bajo')::int, 0) + 1)); end if;
    if p.voluntad_usada and vj.total >= 20 then cont := jsonb_set(cont, '{ganadas_voluntad_alto}', to_jsonb(coalesce((cont ->> 'ganadas_voluntad_alto')::int, 0) + 1)); end if;
    if p.fortuna_usada and vj.total = 21 then cont := jsonb_set(cont, '{ganadas_fortuna_21}', to_jsonb(coalesce((cont ->> 'ganadas_fortuna_21')::int, 0) + 1)); end if;
  end if;
  update veintiuna_estadisticas set
    rondas = rondas + 1,
    victorias = victorias + case when gana then 1 else 0 end,
    derrotas = derrotas + case when p.resultado = 'derrota' then 1 else 0 end,
    empates = empates + case when p.resultado = 'empate' then 1 else 0 end,
    naturales = naturales + case when vj.total = 21 and n_cartas = 2 then 1 else 0 end,
    racha = case when not cuenta then racha when gana then racha + 1 when p.resultado = 'derrota' then 0 else racha end,
    mejor_racha = greatest(mejor_racha, case when gana and cuenta then racha + 1 else racha end),
    reglas_ganadas = case when cuenta and gana and not (p.regla = any (reglas_ganadas)) then array_append(reglas_ganadas, p.regla) else reglas_ganadas end,
    contadores = cont,
    neto = neto + case when p.modo = 'apuesta' then coalesce(p.neto, 0) else 0 end,
    actualizado = now()
  where user_id = p.user_id
  returning * into est;

  with ins as (
    insert into veintiuna_logros (user_id, logro)
    select p.user_id, d.id from veintiuna_logros_def d
    where cuenta and case d.id
      when 'primera_vela' then coalesce((est.contadores ->> 'victorias_dia')::int, 0) >= 1
      when 'bajo_maldicion' then coalesce((est.contadores ->> 'ganadas_maldicion')::int, 0) >= 1
      when 'peaje_pagado' then coalesce((est.contadores ->> 'ganadas_fortuna_usada')::int, 0) >= 1
      when 'ultima_palabra' then coalesce((est.contadores ->> 'ganadas_voluntad_usada')::int, 0) >= 1
      when 'veintiuna_exacta' then coalesce((est.contadores ->> 'veintiunas')::int, 0) >= 1
      when 'sin_miedo' then coalesce((est.contadores ->> 'ganadas_plantado_bajo')::int, 0) >= 1
      when 'tres_velas' then coalesce((est.contadores ->> 'mejor_racha_dia')::int, 0) >= 3
      when 'tres_voluntades' then jsonb_array_length(coalesce(est.contadores -> 'reglas_dia', '[]'::jsonb)) >= 3
      when 'ultima_hora' then coalesce((est.contadores ->> 'ganadas_voluntad_alto')::int, 0) >= 1
      when 'cinco_cartas' then coalesce((est.contadores ->> 'cinco_cartas')::int, 0) >= 1
      when 'fortuna_veintiuna' then coalesce((est.contadores ->> 'ganadas_fortuna_21')::int, 0) >= 1
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
  v_pago := case p_resultado when 'natural' then p.apuesta * case when p.regla = 'vela' then 2.2 else 2.5 end when 'victoria' then p.apuesta * 2 when 'empate' then p.apuesta else 0 end;
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
  n int;
  v_cn boolean;
begin
  select * into p from veintiuna_partidas where id = p_id for update;
  if p.estado <> 'en_curso' then perform veintiuna_i_error('Esa mano ya terminó.', 'mano_terminada'); end if;
  figura := case p.regla when 'maldicion' then 11 else 10 end;
  select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
  -- Si la crupier tiene un 21 natural la mano se juega igual, pero está decidida: mientras lo tenga, las reglas de pago (peajes) salen gratis para que nadie pague por jugarla
  select * into vc from veintiuna_i_valor(p.crupier, '{}'::int[], figura);
  v_cn := vc.total = 21 and array_length(p.crupier, 1) = 2;

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
      if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;          -- su apuesta ya está en el bote; se cierra al acabar la ronda
      else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    end if;
    return;
  end if;

  if p_accion = 'fortuna' then
    if p.regla <> 'fortuna' or p.fase <> 'fortuna' or p.fortuna_usada then perform veintiuna_i_error('La Fortuna no está disponible ahora.', 'accion_invalida'); end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric;
    peaje := case when v_cn then 0 else round(p.apuesta * fraccion, 2) end;
    if p.modo = 'apuesta' and peaje > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan los tokens para el peaje de la Fortuna (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
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
    if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;
    else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    return;
  end if;

  if p_accion = 'voluntad' then
    -- Cambias tu última carta por la siguiente de la baraja (peaje). Si la nueva te pasa de 21, pierdes (no hay Fortuna en esta regla).
    if p.regla <> 'voluntad' or p.fase <> 'jugador' or p.voluntad_usada then perform veintiuna_i_error('La Última voluntad no está disponible ahora.', 'accion_invalida'); end if;
    if vj.total >= 21 then perform veintiuna_i_error('Con 21 no hace falta cambiar nada: plántate.', 'accion_invalida'); end if;
    fraccion := (cartas_ajuste('veintiuna_peaje_voluntad', '0.5'))::text::numeric;
    peaje := case when v_cn then 0 else round(p.apuesta * fraccion, 2) end;
    if p.modo = 'apuesta' and peaje > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = p.user_id for update;
      if coalesce(v_saldo, 0) < peaje then perform veintiuna_i_error('No te alcanzan los tokens para el peaje de la Última voluntad (' || trim_scale(peaje) || ').', 'saldo_insuficiente'); end if;
      update hipodromo_billeteras set saldo = saldo - peaje where usuario = p.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (p.user_id, null, 'Veintiuna Velas: peaje de la Última voluntad (mano ' || p.id || ')', -peaje, v_saldo) returning id into v_mov;
    end if;
    n := array_length(p.jugador, 1);
    nueva := p.mazo[p.repartidas + 1];
    update veintiuna_partidas set voluntad_usada = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje),
      jugador = p.jugador[1:n - 1] || nueva, repartidas = repartidas + 1, jugador_as1 = array_remove(jugador_as1, n)
      where id = p_id returning * into p;
    select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
    if vj.total > 21 then
      if p.duelo then update veintiuna_partidas set fase = 'pasada' where id = p_id;
      else perform veintiuna_i_liquidar(p_id, 'derrota', 'te_pasas'); end if;
    end if;
    return;
  end if;

  if p_accion in ('ojo', 'marcadas', 'trueque') then
    if p.regla <> p_accion or p.fase <> 'jugador' then perform veintiuna_i_error('Esa acción no está disponible ahora.', 'accion_invalida'); end if;
    peaje := case when v_cn then 0 else veintiuna_i_peaje(p.regla, p.apuesta) end;
    if p_accion = 'ojo' then
      -- Ojo del Tahúr: pagas y ves la siguiente carta de la baraja (será tu próxima carta, o la primera que robe el crupier si te plantas)
      if p.ojo_pos is not null then perform veintiuna_i_error('Ya miraste la baraja en esta mano.', 'accion_invalida'); end if;
      if vj.total >= 21 then perform veintiuna_i_error('Con 21 no hace falta mirar: plántate.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'del Ojo del Tahúr', p.id) else null end;
      update veintiuna_partidas set ojo_pos = repartidas, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    elsif p_accion = 'marcadas' then
      -- Cartas marcadas: pagas y ves la carta oculta del crupier
      if p.marcadas_usada then perform veintiuna_i_error('Ya viste la carta oculta en esta mano.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'de las Cartas marcadas', p.id) else null end;
      update veintiuna_partidas set marcadas_usada = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje) where id = p_id;
    else
      -- Trueque con la casa: antes de pedir carta, tu primera carta se cambia por la que el crupier tiene boca arriba
      if p.trueque_usado then perform veintiuna_i_error('Ya hiciste el trueque en esta mano.', 'accion_invalida'); end if;
      if array_length(p.jugador, 1) <> 2 then perform veintiuna_i_error('El trueque solo vale antes de pedir carta.', 'accion_invalida'); end if;
      v_mov := case when peaje > 0 then veintiuna_i_cobrar(p.user_id, p.modo, peaje, 'del Trueque con la casa', p.id) else null end;
      update veintiuna_partidas set trueque_usado = true, peajes = peajes + peaje, mov_peaje = coalesce(v_mov, mov_peaje),
        jugador = array[crupier[1], jugador[2]], crupier = array[jugador[1], crupier[2]] where id = p_id;
    end if;
    return;
  end if;

  if p_accion = 'plantar' then
    if p.fase <> 'jugador' then perform veintiuna_i_error('Ahora no puedes plantarte.', 'accion_invalida'); end if;
  else
    perform veintiuna_i_error('Esa acción no existe.', 'accion_invalida');
  end if;

  -- Plantarse en una mesa con amigos: la mano espera; el crupier juega cuando han acabado todos (veintiuna_i_amigos_cerrar_ronda)
  if p.mesa is not null then
    update veintiuna_partidas set fase = 'plantada' where id = p_id;
    return;
  end if;

  -- Plantarse: el crupier juega su turno
  select o_crupier, o_repartidas into cru, rep from veintiuna_i_turno_crupier(p.mazo, p.repartidas, p.crupier, figura, false, case when p.regla = 'vela' then 16 else 17 end);
  update veintiuna_partidas set crupier = cru, repartidas = rep where id = p_id;
  select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
  if vc.total = 21 and array_length(cru, 1) = 2 and not (array_length(p.jugador, 1) = 2 and vj.total = 21) then
    perform veintiuna_i_liquidar(p_id, 'derrota', 'natural_crupier');                  -- el blackjack natural de la crupier gana a cualquier 21 que no lo sea
  elsif vc.total > 21 then
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
  select * into p from veintiuna_partidas where user_id = p_uid and estado = 'en_curso' and mesa is null for update;
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
  perform veintiuna_i_dia_logros(uid);
  select * into est from veintiuna_estadisticas where user_id = uid;
  select saldo into v_saldo from hipodromo_billeteras where usuario = uid;
  select * into p from veintiuna_partidas where user_id = uid and estado = 'en_curso' and mesa is null;
  select * into cfg from cartas_juegos where juego = 'veintiuna';
  select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
  select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = 'veintiuna' and creado >= date_trunc('day', now());

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'nivel', d.nivel, 'nombre', d.nombre, 'texto', d.texto, 'meta', d.meta,
      'progreso', least(d.meta, case d.id
        when 'primera_vela' then coalesce((est.contadores ->> 'victorias_dia')::int, 0)
        when 'bajo_maldicion' then coalesce((est.contadores ->> 'ganadas_maldicion')::int, 0)
        when 'peaje_pagado' then coalesce((est.contadores ->> 'ganadas_fortuna_usada')::int, 0)
        when 'ultima_palabra' then coalesce((est.contadores ->> 'ganadas_voluntad_usada')::int, 0)
        when 'veintiuna_exacta' then coalesce((est.contadores ->> 'veintiunas')::int, 0)
        when 'sin_miedo' then coalesce((est.contadores ->> 'ganadas_plantado_bajo')::int, 0)
        when 'tres_velas' then coalesce((est.contadores ->> 'mejor_racha_dia')::int, 0)
        when 'tres_voluntades' then jsonb_array_length(coalesce(est.contadores -> 'reglas_dia', '[]'::jsonb))
        when 'ultima_hora' then coalesce((est.contadores ->> 'ganadas_voluntad_alto')::int, 0)
        when 'cinco_cartas' then coalesce((est.contadores ->> 'cinco_cartas')::int, 0)
        when 'fortuna_veintiuna' then coalesce((est.contadores ->> 'ganadas_fortuna_21')::int, 0)
        else 0 end),
      'completado', l.completado, 'reclamado', l.reclamado, 'carta', l.carta) order by d.orden), '[]'::jsonb)
    into logros
    from veintiuna_logros_def d left join veintiuna_logros l on l.logro = d.id and l.user_id = uid;

  return jsonb_build_object(
    'saldo', v_saldo,
    'limites', jsonb_build_object(
      'min', (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric,
      'max', nullif((cartas_ajuste('veintiuna_apuesta_max', '0'))::text::numeric, 0),
      'paso', (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric),
    'peajes', jsonb_build_object(
      'fortuna', (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric,
      'voluntad', (cartas_ajuste('veintiuna_peaje_voluntad', '0.5'))::text::numeric,
      'ojo', (cartas_ajuste('veintiuna_peaje_ojo', '0.35'))::text::numeric,
      'marcadas', (cartas_ajuste('veintiuna_peaje_marcadas', '0.18'))::text::numeric,
      'trueque', (cartas_ajuste('veintiuna_peaje_trueque', '1'))::text::numeric),
    'inactividad_min', (cartas_ajuste('veintiuna_inactividad_min', '30'))::text::numeric,
    'partida', case when p.id is not null then veintiuna_i_estado(p, v_saldo) end,
    'proxima_regla', est.proxima_regla,
    'estadisticas', jsonb_build_object('rondas', est.rondas, 'victorias', est.victorias, 'derrotas', est.derrotas, 'empates', est.empates, 'naturales', est.naturales,
                                       'racha', est.racha, 'mejor_racha', est.mejor_racha, 'neto', est.neto),
    'logros', logros,
    'logros_reinician', ((((now() at time zone 'utc')::date) + 1)::timestamp at time zone 'utc'),   -- cuándo se reinician los desafíos (siguiente 00:00 UTC)
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
  max_a numeric := (cartas_ajuste('veintiuna_apuesta_max', '0'))::text::numeric;
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
  v_jug smallint[];
  v_cru smallint[];
  v_rep int;
  v_dado int;
  v_evento text;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if p_cliente is null then perform veintiuna_i_error('Falta el identificador de la mano.', 'peticion_invalida'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));

  select * into p from veintiuna_partidas where user_id = uid and cliente = p_cliente;
  if found then return veintiuna_i_estado(p, veintiuna_i_saldo(uid)) || jsonb_build_object('repetida', true); end if;

  perform veintiuna_i_cerrar_inactiva(uid);
  if exists (select 1 from veintiuna_asientos where user_id = uid) then
    perform veintiuna_i_error('Estás sentado en una mesa con amigos. Levántate de ella para jugar solo.', 'en_mesa');
  end if;
  if exists (select 1 from veintiuna_partidas where user_id = uid and estado = 'en_curso') then
    perform veintiuna_i_error('Ya tienes una mano en curso. Termínala antes de repartir otra.', 'mano_en_curso');
  end if;
  if p_modo not in ('apuesta', 'practica') then perform veintiuna_i_error('Esa modalidad no existe.', 'peticion_invalida'); end if;
  if p_modo = 'apuesta' then
    v_apuesta := p_apuesta;
    if v_apuesta is null or v_apuesta < min_a or (max_a > 0 and v_apuesta > max_a) then
      perform veintiuna_i_error(case when max_a > 0 then 'La apuesta va de ' || min_a || ' a ' || max_a || ' tokens.' else 'La apuesta mínima es de ' || min_a || ' tokens.' end, 'apuesta_invalida');
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
  v_jug := array[v_mazo[1], v_mazo[3]];
  v_cru := array[v_mazo[2], v_mazo[4]];
  v_rep := 4;
  -- Pacto del Bufón: tira un dado. 1 o 2, nada; 3 o 4, la carta visible del crupier se cambia por la siguiente de la baraja; 5 o 6, lo mismo con tu primera carta.
  -- (Es un cambio por una carta al azar, así que no cambia el valor esperado de la mano; solo pone caos antes de que decidas nada.)
  if v_regla = 'bufon' then
    v_dado := veintiuna_i_azar(6);
    v_evento := case when v_dado < 2 then 'nada' when v_dado < 4 then 'crupier' else 'jugador' end;
    if v_evento = 'crupier' then v_cru[1] := v_mazo[5]; v_rep := 5;
    elsif v_evento = 'jugador' then v_jug[1] := v_mazo[5]; v_rep := 5; end if;
  end if;

  if p_modo = 'apuesta' then
    insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
    select saldo into v_saldo from hipodromo_billeteras where usuario = uid for update;
    if v_apuesta > v_saldo then
      perform veintiuna_i_error('No tienes tantos tokens: te faltan ' || trim_scale(v_apuesta - v_saldo) || '.', 'saldo_insuficiente');
    end if;
    update hipodromo_billeteras set saldo = saldo - v_apuesta where usuario = uid returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
      values (uid, null, 'Veintiuna Velas: apuesta (mano ' || v_id || ')', -v_apuesta, v_saldo) returning id into v_mov;
  end if;

  -- Reparto: jugador, crupier (la carta que se ve), jugador, crupier (la oculta)
  insert into veintiuna_partidas (id, user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier, mov_cobro, bufon_evento)
    values (v_id, uid, p_cliente, p_modo, v_apuesta, v_regla, v_mazo, v_rep, v_jug, v_cru, v_mov, v_evento)
    returning * into p;

  -- Orden de resolución al repartir
  select * into vj from veintiuna_i_valor(p.jugador, '{}'::int[], figura);
  select * into vc from veintiuna_i_valor(p.crupier, '{}'::int[], figura);
  if vj.total > 21 then v_res := 'derrota'; v_razon := 'pasado_al_repartir';                  -- solo con la Maldición: dos figuras suman 22
  elsif vj.total = 21 and vc.total = 21 then v_res := 'empate'; v_razon := 'ambos_natural';
  elsif vj.total = 21 then v_res := 'natural'; v_razon := 'natural';
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
  if p.mesa is not null then perform veintiuna_i_error('Esa mano es de una mesa con amigos: se juega desde allí.', 'mano_de_mesa'); end if;
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

-- Las últimas manos terminadas (con las cartas, que ya no se esconden) y lo que variaron los tokens
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
-- NO se gasta el desafío y se puede reclamar más tarde, pero solo el mismo día: a las 00:00 UTC los desafíos se reinician y lo no reclamado se apaga.
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
  insert into veintiuna_estadisticas (user_id, proxima_regla) values (uid, veintiuna_i_regla_nueva()) on conflict do nothing;
  perform veintiuna_i_dia_logros(uid);   -- lo completado ayer y sin reclamar ya no vale
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
  veintiuna_i_turno_crupier(smallint[], int, smallint[], int, boolean, int), veintiuna_i_peaje(text, numeric), veintiuna_i_cobrar(uuid, text, numeric, text, uuid), veintiuna_i_repartir(uuid, uuid, text, numeric, smallint[]), veintiuna_i_estado(veintiuna_partidas, numeric), veintiuna_i_registrar(veintiuna_partidas),
  veintiuna_i_liquidar(uuid, text, text), veintiuna_i_aplicar(uuid, text), veintiuna_i_cerrar_inactiva(uuid) from public, anon, authenticated;
revoke all on function veintiuna_mesa(), veintiuna_repartir(uuid, text, numeric), veintiuna_accion(uuid, int, text), veintiuna_historial(int), veintiuna_reclamar(text) from public, anon;
grant execute on function veintiuna_mesa(), veintiuna_repartir(uuid, text, numeric), veintiuna_accion(uuid, int, text), veintiuna_historial(int), veintiuna_reclamar(text) to authenticated;

/* ================================================================== 8) MESA CON AMIGOS
   Una mesa compartida: hasta 5 asientos, una sola crupier (Cera), una regla por ronda para toda la mesa y turnos por asiento.
   Cada jugador sigue teniendo SU mano en veintiuna_partidas (con las mismas reglas, peajes, desafíos y libro de tokens que la mesa individual);
   lo compartido (baraja doble, cartas del crupier, posición de la baraja) vive en veintiuna_mesas y se copia a cada mano en curso.
   Una ronda: apuestas (hasta que todos estén listos, o 45 s después de que apueste el primero) → reparto → turnos por asiento (45 s cada uno) → el crupier juega
   → resultado (10 s) → siguiente ronda. Quien no juega a tiempo se planta solo; quien se va a mitad de ronda pierde su mano.
   POZO DE CARTAS (opcional, lo elige quien crea la mesa): cada jugador puede poner UNA carta suya en el pozo antes de repartir. Se bloquea con el sistema oficial de
   la economía de cartas. Al acabar la ronda, entre quienes pusieron carta y ganaron a la casa, se lleva TODO el pozo el que tenga la mejor mano (natural, después el
   total más alto). Si empatan arriba, o nadie ganó a la casa, cada carta vuelve a su dueño. Nunca se crean ni se destruyen cartas. */

/* ---------------------------------------------------------------- 8.1) TABLAS */
create table if not exists veintiuna_mesas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  creador uuid references auth.users(id) on delete set null,
  privada boolean not null default false,
  cartas boolean not null default false,                    -- con pozo de cartas
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada')),
  creada timestamptz not null default now(),
  actividad timestamptz not null default now(),
  version bigint not null default 1,                        -- sube con cada cambio: el navegador pregunta por ella y solo recibe la mesa si cambió
  ronda int not null default 1,
  ronda_id uuid not null default gen_random_uuid(),
  fase text not null default 'apuestas' check (fase in ('apuestas', 'jugando', 'resultado')),
  fase_limite timestamptz,
  turno int,
  regla text not null,
  proxima_regla text not null,
  mazo smallint[],
  pos int not null default 0,
  crupier smallint[] not null default '{}',
  bufon_evento text check (bufon_evento is null or bufon_evento in ('nada', 'crupier', 'jugador')),
  bufon_asiento int,
  check (regla in ('fortuna', 'maldicion', 'voluntad', 'ojo', 'marcadas', 'trueque', 'vela', 'bufon')),
  check (proxima_regla in ('fortuna', 'maldicion', 'voluntad', 'ojo', 'marcadas', 'trueque', 'vela', 'bufon'))
);
create table if not exists veintiuna_asientos (
  mesa uuid not null references veintiuna_mesas(id) on delete cascade,
  asiento int not null check (asiento between 0 and 9),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  sentado timestamptz not null default now(),
  ultima_actividad timestamptz not null default now(),
  apuesta numeric(12, 2),                                   -- null: todavía no apostó; 0: juega sin apostar tokens (no cuenta para desafíos); más de 0: apuesta
  listo boolean not null default false,                     -- ya apostó o decidió pasar esta ronda
  carta uuid,                                               -- copia que pone en el pozo de cartas
  partida uuid,                                             -- su mano de esta ronda
  perdidos int not null default 0,                          -- turnos seguidos que dejó que se jugaran solos
  aviso text,
  primary key (mesa, asiento),
  unique (user_id)
);
create table if not exists veintiuna_pozos (
  ronda_id uuid primary key,
  mesa uuid references veintiuna_mesas(id) on delete set null,
  ronda int not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'pagado', 'devuelto')),
  ganador uuid references auth.users(id) on delete set null,
  creado timestamptz not null default now(),
  resuelto timestamptz
);
create table if not exists veintiuna_pozo_cartas (
  ronda_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ejemplar uuid not null,
  carta text not null,
  rareza text,
  nombre text,
  abandono boolean not null default false,                  -- se fue de la mesa a mitad de ronda: no puede ganar el pozo, pero su carta sigue en juego
  creado timestamptz not null default now(),
  primary key (ronda_id, user_id)
);
create index if not exists veintiuna_pozo_cartas_user_idx on veintiuna_pozo_cartas (user_id, creado desc);
alter table veintiuna_partidas add column if not exists mesa uuid references veintiuna_mesas(id) on delete set null;
alter table veintiuna_partidas add column if not exists asiento int;
alter table veintiuna_partidas add column if not exists ronda_id uuid;
alter table veintiuna_partidas drop constraint if exists veintiuna_partidas_fase_check;
alter table veintiuna_partidas add constraint veintiuna_partidas_fase_check check (fase in ('jugador', 'fortuna', 'plantada', 'pasada', 'abandonada'));   -- pasada y abandonada: solo en «todos contra todos» (la mano espera al final de la ronda para repartir el bote)
alter table veintiuna_partidas add column if not exists orden int;                                  -- turno dentro de la ronda (0 es el primero)
alter table veintiuna_partidas add column if not exists duelo boolean not null default false;       -- mano de una mesa «todos contra todos»: no cuenta para desafíos ni rachas
alter table veintiuna_mesas add column if not exists modo text not null default 'casa';
alter table veintiuna_mesas drop constraint if exists veintiuna_mesas_modo_check;
alter table veintiuna_mesas add constraint veintiuna_mesas_modo_check check (modo in ('casa', 'duelo'));
create index if not exists veintiuna_partidas_mesa_idx on veintiuna_partidas (mesa, ronda_id) where mesa is not null;
alter table veintiuna_mesas enable row level security;
alter table veintiuna_asientos enable row level security;
alter table veintiuna_pozos enable row level security;
alter table veintiuna_pozo_cartas enable row level security;
drop policy if exists "veintiuna_mesas_admin" on veintiuna_mesas;
create policy "veintiuna_mesas_admin" on veintiuna_mesas for select using (fichas_es_admin());
drop policy if exists "veintiuna_asientos_admin" on veintiuna_asientos;
create policy "veintiuna_asientos_admin" on veintiuna_asientos for select using (fichas_es_admin());
drop policy if exists "veintiuna_pozos_admin" on veintiuna_pozos;
create policy "veintiuna_pozos_admin" on veintiuna_pozos for select using (fichas_es_admin());
drop policy if exists "veintiuna_pozo_cartas_admin" on veintiuna_pozo_cartas;
create policy "veintiuna_pozo_cartas_admin" on veintiuna_pozo_cartas for select using (fichas_es_admin());
revoke all on veintiuna_mesas, veintiuna_asientos, veintiuna_pozos, veintiuna_pozo_cartas from anon;
revoke insert, update, delete on veintiuna_mesas, veintiuna_asientos, veintiuna_pozos, veintiuna_pozo_cartas from authenticated;

/* ---------------------------------------------------------------- 8.2) PIEZAS */
-- Dos barajas barajadas juntas (104 cartas): con cinco jugadores una sola podría quedarse corta
create or replace function veintiuna_i_mazo_doble()
returns smallint[]
language sql
volatile
as $$
  select array_agg(n::smallint order by gen_random_uuid()) from generate_series(0, 51) n cross join generate_series(1, 2) d
$$;

create or replace function veintiuna_i_nombre(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select nullif(trim(username), '') from perfiles where user_id = p_uid), 'Jugador')
$$;

-- Código corto para invitar a la mesa: 5 caracteres sin los que se confunden (0/O, 1/I)
create or replace function veintiuna_i_amigos_codigo()
returns text
language plpgsql
volatile
as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..5 loop c := c || substr(alfabeto, 1 + veintiuna_i_azar(length(alfabeto)), 1); end loop;
    exit when not exists (select 1 from veintiuna_mesas where codigo = c);
  end loop;
  return c;
end;
$$;

create or replace function veintiuna_i_amigos_tocar(p_mesa uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update veintiuna_mesas set version = version + 1, actividad = now() where id = p_mesa
$$;

-- Copia lo compartido (baraja, posición y cartas del crupier) a las manos que siguen en juego
create or replace function veintiuna_i_amigos_sincronizar(p_mesa uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update veintiuna_partidas p set mazo = m.mazo, repartidas = m.pos, crupier = m.crupier
    from veintiuna_mesas m
    where m.id = p_mesa and p.mesa = m.id and p.ronda_id = m.ronda_id and p.estado = 'en_curso'
$$;

-- Lo buena que es una mano para comparar entre jugadores: un natural (21 con dos cartas) vale 22 y gana a cualquier otro total
create or replace function veintiuna_i_calidad(p_jugador smallint[], p_as1 int[], p_figura int)
returns int
language sql
immutable
as $$
  select case when coalesce(array_length(p_jugador, 1), 0) = 2 and (select total from veintiuna_i_valor(p_jugador, p_as1, p_figura)) = 21 then 22
              else (select total from veintiuna_i_valor(p_jugador, p_as1, p_figura)) end
$$;

-- Cierra una mano pagando lo que se decide (el bote de «todos contra todos»): una sola vez, apunta el movimiento y registra la mano
create or replace function veintiuna_i_liquidar_pago(p_id uuid, p_pago numeric, p_resultado text, p_razon text, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p veintiuna_partidas%rowtype;
  v_saldo numeric;
  v_mov bigint;
  v_nuevos text[];
begin
  select * into p from veintiuna_partidas where id = p_id for update;
  if not found then raise exception 'Esa mano no existe'; end if;
  if p.estado = 'terminada' then return; end if;
  if p.modo = 'apuesta' and p_pago > 0 then
    update hipodromo_billeteras set saldo = saldo + p_pago where usuario = p.user_id returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
      values (p.user_id, null, 'Veintiuna Velas: ' || p_concepto || ' (mano ' || p.id || ')', p_pago, v_saldo) returning id into v_mov;
  end if;
  update veintiuna_partidas set estado = 'terminada', resultado = p_resultado, razon = p_razon, pago = case when p.modo = 'apuesta' then p_pago else 0 end,
    neto = case when p.modo = 'apuesta' then p_pago else 0 end - p.apuesta * case when p.modo = 'apuesta' then 1 else 0 end - p.peajes,
    terminada = now(), mov_pago = v_mov
    where id = p_id returning * into p;
  v_nuevos := veintiuna_i_registrar(p);
  update veintiuna_partidas set logros_nuevos = v_nuevos where id = p_id;
end;
$$;

/* ---------------------------------------------------------------- 8.3) POZO DE CARTAS */
-- Suelta las cartas del pozo de una ronda (de todos, o de un jugador): se desbloquean y vuelven a quien las puso
create or replace function veintiuna_i_pozo_soltar(p_ronda uuid, p_user uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  for f in select ejemplar, user_id from veintiuna_pozo_cartas where ronda_id = p_ronda and (p_user is null or user_id = p_user) loop
    perform cartas_i_desbloquear('veintiuna:' || p_ronda::text || ':' || f.user_id::text);
  end loop;
  delete from veintiuna_pozo_cartas where ronda_id = p_ronda and (p_user is null or user_id = p_user);
  update veintiuna_asientos set carta = null where carta is not null and (p_user is null or user_id = p_user)
    and mesa in (select id from veintiuna_mesas where ronda_id = p_ronda);
end;
$$;

-- Reparte el pozo al acabar la ronda (ver la explicación del principio de esta sección)
create or replace function veintiuna_i_pozo_resolver(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  figura int;
  f record;
  v_ganador uuid;
  v_mejor int := -1;
  v_nota int;
  v_empate boolean := false;
  v_n int;
  v_pagadas int := 0;
begin
  select * into m from veintiuna_mesas where id = p_mesa;
  select count(*) into v_n from veintiuna_pozo_cartas where ronda_id = m.ronda_id;
  if v_n = 0 or not exists (select 1 from veintiuna_pozos where ronda_id = m.ronda_id and estado = 'abierto') then return; end if;
  figura := case m.regla when 'maldicion' then 11 else 10 end;
  -- Contra la casa compiten los que le ganaron; en «todos contra todos», los que no se pasaron ni se fueron
  for f in select c.user_id, p.jugador, p.jugador_as1
             from veintiuna_pozo_cartas c join veintiuna_partidas p on p.user_id = c.user_id and p.ronda_id = m.ronda_id and p.mesa = m.id
            where c.ronda_id = m.ronda_id and not c.abandono
              and case when m.modo = 'duelo' then p.fase = 'plantada' else p.resultado in ('natural', 'victoria') end loop
    v_nota := veintiuna_i_calidad(f.jugador, f.jugador_as1, figura);
    if v_nota > v_mejor then v_mejor := v_nota; v_ganador := f.user_id; v_empate := false;
    elsif v_nota = v_mejor then v_empate := true;
    end if;
  end loop;
  if v_ganador is null or v_empate then
    perform veintiuna_i_pozo_soltar(m.ronda_id);
    update veintiuna_pozos set estado = 'devuelto', resuelto = now() where ronda_id = m.ronda_id;
    return;
  end if;
  for f in select ejemplar, user_id from veintiuna_pozo_cartas where ronda_id = m.ronda_id and user_id <> v_ganador loop
    begin
      perform cartas_i_transferir(f.ejemplar, v_ganador, 'pozo ganado en Las Veintiuna Velas', 'veintiuna:' || m.ronda_id::text || ':' || f.user_id::text, null, true);
      v_pagadas := v_pagadas + 1;
    exception when others then
      null;     -- si al ganador ya no le cabe en la colección (límite por jugador), la carta vuelve a su dueño al desbloquear
    end;
  end loop;
  perform veintiuna_i_pozo_soltar(m.ronda_id);
  update veintiuna_pozos set estado = 'pagado', ganador = v_ganador, resuelto = now() where ronda_id = m.ronda_id;
end;
$$;

/* ---------------------------------------------------------------- 8.4) LA RONDA */
-- Una ronda nueva: la regla anunciada pasa a ser la de la ronda y se sortea la siguiente; los asientos vuelven a estar sin apostar
create or replace function veintiuna_i_amigos_nueva_ronda(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update veintiuna_mesas set ronda = ronda + 1, ronda_id = gen_random_uuid(), regla = proxima_regla,
    proxima_regla = case when modo = 'duelo' then veintiuna_i_regla_nueva_duelo() else veintiuna_i_regla_nueva() end,
    fase = 'apuestas', fase_limite = null, turno = null, mazo = null, pos = 0, crupier = '{}', bufon_evento = null, bufon_asiento = null
    where id = p_mesa;
  update veintiuna_asientos set apuesta = null, listo = false, carta = null, partida = null, aviso = null where mesa = p_mesa;
  perform veintiuna_i_amigos_tocar(p_mesa);
end;
$$;

-- El crupier juega, se pagan las manos que seguían en juego, se reparte el pozo y se enseña el resultado
create or replace function veintiuna_i_amigos_cerrar_ronda(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  r record;
  figura int;
  limite int;
  vc record;
  vj record;
  cru smallint[];
  rep int;
  v_res text;
  v_razon text;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  figura := case m.regla when 'maldicion' then 11 else 10 end;
  limite := case m.regla when 'vela' then 16 else 17 end;
  if m.modo = 'duelo' then
    perform veintiuna_i_amigos_resolver_duelo(m.id);
  elsif exists (select 1 from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso') then
    select o_crupier, o_repartidas into cru, rep from veintiuna_i_turno_crupier(m.mazo, m.pos, m.crupier, figura, false, limite);
    update veintiuna_mesas set crupier = cru, pos = rep where id = m.id;
    m.crupier := cru;
    select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
    for r in select * from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso' order by asiento loop
      update veintiuna_partidas set crupier = cru where id = r.id;
      select * into vj from veintiuna_i_valor(r.jugador, r.jugador_as1, figura);
      if vc.total = 21 and array_length(cru, 1) = 2 and not (array_length(r.jugador, 1) = 2 and vj.total = 21) then v_res := 'derrota'; v_razon := 'natural_crupier';      -- el natural de la crupier gana a cualquier 21 que no lo sea
      elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_se_pasa';
      elsif vj.total > vc.total then v_res := 'victoria'; v_razon := 'mayor';
      elsif vj.total < vc.total then v_res := 'derrota'; v_razon := 'menor';
      else v_res := 'empate'; v_razon := 'igual';
      end if;
      perform veintiuna_i_liquidar(r.id, v_res, v_razon);
    end loop;
  end if;
  update veintiuna_partidas set crupier = m.crupier where mesa = m.id and ronda_id = m.ronda_id;
  perform veintiuna_i_pozo_resolver(m.id);
  update veintiuna_mesas set fase = 'resultado', turno = null,
    fase_limite = now() + make_interval(secs => (cartas_ajuste('veintiuna_mesa_resultado_s', '10'))::text::numeric)
    where id = m.id;
  perform veintiuna_i_amigos_tocar(m.id);
end;
$$;

-- Todos contra todos: gana el bote (la suma de las apuestas) la mejor mano entre quienes apostaron y no se pasaron ni se fueron. Si empatan, se reparte a partes iguales.
-- Si ninguno que apostó sigue en pie, se devuelven las apuestas. Quien juega sin apostar compite por la gloria (cuenta como victoria o derrota, sin tokens).
create or replace function veintiuna_i_amigos_resolver_duelo(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  r record;
  figura int;
  v_bote numeric;
  v_mejor_ap int;
  v_mejor_todos int;
  v_n_ap int;
  v_n_todos int;
  v_parte numeric;
  v_resto numeric;
  v_pago numeric;
  v_res text;
  v_razon text;
  v_primero boolean := true;
  v_sin_apuesta_en_pie boolean;
begin
  select * into m from veintiuna_mesas where id = p_mesa;
  figura := case m.regla when 'maldicion' then 11 else 10 end;
  select coalesce(sum(apuesta), 0) into v_bote from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and modo = 'apuesta';
  select max(veintiuna_i_calidad(jugador, jugador_as1, figura)), count(*) into v_mejor_ap, v_n_ap from veintiuna_partidas p
    where mesa = m.id and ronda_id = m.ronda_id and modo = 'apuesta' and fase = 'plantada'
      and veintiuna_i_calidad(jugador, jugador_as1, figura) = (select max(veintiuna_i_calidad(q.jugador, q.jugador_as1, figura)) from veintiuna_partidas q where q.mesa = m.id and q.ronda_id = m.ronda_id and q.modo = 'apuesta' and q.fase = 'plantada');
  select max(veintiuna_i_calidad(jugador, jugador_as1, figura)), count(*) into v_mejor_todos, v_n_todos from veintiuna_partidas p
    where mesa = m.id and ronda_id = m.ronda_id and fase = 'plantada'
      and veintiuna_i_calidad(jugador, jugador_as1, figura) = (select max(veintiuna_i_calidad(q.jugador, q.jugador_as1, figura)) from veintiuna_partidas q where q.mesa = m.id and q.ronda_id = m.ronda_id and q.fase = 'plantada');
  if v_n_ap > 0 then
    v_parte := trunc(v_bote * 100 / v_n_ap) / 100;
    v_resto := v_bote - v_parte * v_n_ap;
  end if;
  for r in select * from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso' order by asiento loop
    if r.modo = 'apuesta' then
      if v_n_ap = 0 then
        perform veintiuna_i_liquidar_pago(r.id, r.apuesta, 'empate', 'todos_se_pasan', 'apuesta devuelta');
      elsif r.fase = 'plantada' and veintiuna_i_calidad(r.jugador, r.jugador_as1, figura) = v_mejor_ap then
        v_pago := v_parte + case when v_primero then v_resto else 0 end;
        v_primero := false;
        v_res := case when v_pago > r.apuesta then 'victoria' when v_pago = r.apuesta then 'empate' else 'derrota' end;
        perform veintiuna_i_liquidar_pago(r.id, v_pago, v_res, case when v_n_ap > 1 then 'bote_compartido' else 'bote' end, case when v_n_ap > 1 then 'bote compartido' else 'bote ganado' end);
      else
        perform veintiuna_i_liquidar_pago(r.id, 0, 'derrota', case r.fase when 'pasada' then 'te_pasas' when 'abandonada' then 'abandono' else 'rival_mejor' end, 'bote perdido');
      end if;
    else
      if v_n_todos = 0 then v_res := 'empate'; v_razon := 'todos_se_pasan';
      elsif r.fase = 'plantada' and veintiuna_i_calidad(r.jugador, r.jugador_as1, figura) = v_mejor_todos then
        v_res := case when v_n_todos > 1 then 'empate' else 'victoria' end; v_razon := case when v_n_todos > 1 then 'igual' else 'mejor_mano' end;
      else v_res := 'derrota'; v_razon := case r.fase when 'pasada' then 'te_pasas' when 'abandonada' then 'abandono' else 'rival_mejor' end;
      end if;
      perform veintiuna_i_liquidar_pago(r.id, 0, v_res, v_razon, 'mano sin apuesta');
    end if;
  end loop;
end;
$$;

-- Pasa el turno al siguiente asiento que sigue en juego; si no queda nadie, cierra la ronda
create or replace function veintiuna_i_amigos_turno(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  v_next int;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  select asiento into v_next from veintiuna_partidas
    where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso' and fase in ('jugador', 'fortuna')
      and orden > coalesce((select orden from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and asiento = m.turno), -1)
    order by orden limit 1;
  if v_next is null then
    perform veintiuna_i_amigos_cerrar_ronda(m.id);
  else
    update veintiuna_mesas set turno = v_next, fase_limite = now() + make_interval(secs => (cartas_ajuste('veintiuna_mesa_turno_s', '45'))::text::numeric) where id = m.id;
    perform veintiuna_i_amigos_tocar(m.id);
  end if;
end;
$$;

-- Reparte la ronda a quienes ya apostaron (o pasan a jugar sin apostar). p_mazo: las pruebas pasan barajas conocidas.
create or replace function veintiuna_i_amigos_repartir(p_mesa uuid, p_mazo smallint[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  a record;
  v_ids int[] := '{}';
  v_apuestas numeric[] := '{}';
  v_k int;
  v_i int;
  v_mazo smallint[];
  v_pos int;
  v_cru smallint[];
  v_jug smallint[];
  v_id uuid;
  v_modo text;
  v_ap numeric;
  v_saldo numeric;
  v_mov bigint;
  v_dado int;
  v_evento text;
  v_afectado int;
  figura int;
  min_a numeric := (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric;
  vj record;
  vc record;
  v_res text;
  v_razon text;
  v_pozo int;
  v_hay boolean;
  n_apost int;
  v_f int;
  v_duelo boolean;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  if m.fase <> 'apuestas' then return; end if;
  v_duelo := m.modo = 'duelo';
  figura := case m.regla when 'maldicion' then 11 else 10 end;

  -- Quién juega: los listos con apuesta. Si no les alcanzan los tokens (los gastaron en otro sitio) se quedan sin jugar esta ronda.
  for a in select * from veintiuna_asientos where mesa = m.id and listo and apuesta is not null order by asiento loop
    if a.apuesta > 0 then
      select saldo into v_saldo from hipodromo_billeteras where usuario = a.user_id for update;      -- la fila queda bloqueada hasta el final: el saldo no puede cambiar entre comprobar y cobrar
      if coalesce(v_saldo, 0) < a.apuesta then
        update veintiuna_asientos set listo = false, apuesta = null, aviso = 'No te alcanzaban los tokens para tu apuesta: te quedas sin jugar esta ronda.' where mesa = m.id and asiento = a.asiento;
        perform veintiuna_i_pozo_soltar(m.ronda_id, a.user_id);
        continue;
      end if;
    end if;
    v_ids := v_ids || a.asiento;
    v_apuestas := v_apuestas || a.apuesta;
  end loop;
  v_k := coalesce(array_length(v_ids, 1), 0);
  if v_k = 0 then
    update veintiuna_mesas set fase_limite = null where id = m.id;
    perform veintiuna_i_amigos_tocar(m.id);
    return;
  end if;
  -- Todos contra todos: el bote solo existe si apuestan tokens al menos dos jugadores; si no, esta ronda se juega sin apostar
  if v_duelo then
    select count(*) filter (where x > 0) into n_apost from unnest(v_apuestas) x;
    if n_apost < 2 then
      update veintiuna_asientos set aviso = 'En «todos contra todos» tienen que apostar tokens al menos dos jugadores: esta ronda se juega sin apostar.'
        where mesa = m.id and asiento = any (v_ids) and apuesta > 0;
      v_apuestas := array_fill(0::numeric, array[v_k]);
    end if;
  end if;
  -- El pozo de cartas solo vale si pusieron carta al menos dos de los que juegan
  select count(*) into v_pozo from veintiuna_pozo_cartas c where c.ronda_id = m.ronda_id
    and exists (select 1 from veintiuna_asientos s where s.mesa = m.id and s.user_id = c.user_id and s.asiento = any (v_ids));
  if v_pozo < 2 then
    update veintiuna_asientos set aviso = 'Nadie más puso carta en el pozo: tu carta vuelve a tu colección.' where mesa = m.id and carta is not null;
    perform veintiuna_i_pozo_soltar(m.ronda_id);
  else
    insert into veintiuna_pozos (ronda_id, mesa, ronda) values (m.ronda_id, m.id, m.ronda) on conflict do nothing;
    -- las cartas de quienes no juegan esta ronda se sueltan
    for a in select c.user_id from veintiuna_pozo_cartas c where c.ronda_id = m.ronda_id
             and not exists (select 1 from veintiuna_asientos s where s.mesa = m.id and s.user_id = c.user_id and s.asiento = any (v_ids)) loop
      perform veintiuna_i_pozo_soltar(m.ronda_id, a.user_id);
    end loop;
  end if;

  -- Reparto: una carta a cada jugador (por orden de asiento), la visible del crupier, la segunda de cada jugador y la oculta
  v_mazo := coalesce(p_mazo, veintiuna_i_mazo_doble());
  if v_duelo then
    -- Sin crupier: dos cartas a cada jugador y nada más. El Bufón: 1-3 nada; 4-6 cambia la primera carta de un jugador al azar.
    v_cru := '{}'::smallint[];
    v_pos := 2 * v_k;
    if m.regla = 'bufon' then
      v_dado := veintiuna_i_azar(6);
      v_evento := case when v_dado < 3 then 'nada' else 'jugador' end;
      if v_evento = 'jugador' then v_afectado := v_ids[1 + veintiuna_i_azar(v_k)]; end if;
    end if;
  else
  v_cru := array[v_mazo[1 + v_k], v_mazo[2 * v_k + 2]];
  v_pos := 2 * v_k + 2;
  if m.regla = 'bufon' then
    -- Pacto del Bufón: un dado para toda la mesa. 1-2 nada; 3-4 cambia la carta visible del crupier por la siguiente; 5-6 cambia la primera carta de un jugador al azar.
    v_dado := veintiuna_i_azar(6);
    v_evento := case when v_dado < 2 then 'nada' when v_dado < 4 then 'crupier' else 'jugador' end;
    if v_evento = 'crupier' then v_cru[1] := v_mazo[v_pos + 1]; v_pos := v_pos + 1;
    elsif v_evento = 'jugador' then v_afectado := v_ids[1 + veintiuna_i_azar(v_k)]; end if;
  end if;
  end if;
  -- Quién juega primero: en «todos contra todos» rota cada ronda (el último en jugar ve lo que han hecho los demás)
  v_f := ((m.ronda - 1) % v_k) + 1;
  update veintiuna_mesas set mazo = v_mazo, pos = v_pos, crupier = v_cru, bufon_evento = v_evento, bufon_asiento = v_afectado where id = m.id;
  select * into vc from veintiuna_i_valor(v_cru, '{}'::int[], figura);

  for v_i in 1..v_k loop
    select * into a from veintiuna_asientos where mesa = m.id and asiento = v_ids[v_i];
    v_jug := case when v_duelo then array[v_mazo[v_i], v_mazo[v_k + v_i]] else array[v_mazo[v_i], v_mazo[v_k + 1 + v_i]] end;
    if v_evento = 'jugador' and v_ids[v_i] = v_afectado then
      v_jug[1] := v_mazo[v_pos + 1]; v_pos := v_pos + 1;
      update veintiuna_mesas set pos = v_pos where id = m.id;
    end if;
    v_id := gen_random_uuid();
    v_ap := v_apuestas[v_i];
    v_modo := case when v_ap > 0 then 'apuesta' else 'practica' end;
    v_mov := null;
    if v_modo = 'apuesta' then
      select saldo into v_saldo from hipodromo_billeteras where usuario = a.user_id for update;
      update hipodromo_billeteras set saldo = saldo - v_ap where usuario = a.user_id returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
        values (a.user_id, null, 'Veintiuna Velas: apuesta (mano ' || v_id || ')', -v_ap, v_saldo) returning id into v_mov;
    end if;
    insert into veintiuna_partidas (id, user_id, cliente, modo, apuesta, regla, mazo, repartidas, jugador, crupier, mov_cobro, bufon_evento, mesa, asiento, ronda_id, duelo, orden)
      values (v_id, a.user_id, gen_random_uuid(), v_modo, case when v_modo = 'apuesta' then v_ap else min_a end, m.regla, v_mazo, v_pos, v_jug, v_cru, v_mov,
              case when m.regla <> 'bufon' then null when v_evento = 'crupier' then 'crupier' when v_evento = 'jugador' and v_ids[v_i] = v_afectado then 'jugador' else 'nada' end,
              m.id, a.asiento, m.ronda_id, v_duelo, case when v_duelo then (v_i - v_f + v_k) % v_k else v_i - 1 end);
    update veintiuna_asientos set partida = v_id where mesa = m.id and asiento = a.asiento;
    -- Orden de resolución al repartir (igual que en la mesa individual)
    select * into vj from veintiuna_i_valor(v_jug, '{}'::int[], figura);
    v_res := null;
    if v_duelo then
      -- Sin crupier nada se paga al repartir: dos figuras con la Maldición se pasan y un natural se planta solo
      if vj.total > 21 then update veintiuna_partidas set fase = 'pasada' where id = v_id;
      elsif vj.total = 21 then update veintiuna_partidas set fase = 'plantada' where id = v_id;
      end if;
    elsif vj.total > 21 then v_res := 'derrota'; v_razon := 'pasado_al_repartir';
    elsif vj.total = 21 and vc.total = 21 then v_res := 'empate'; v_razon := 'ambos_natural';
    elsif vj.total = 21 then v_res := 'natural'; v_razon := 'natural';
    elsif vc.total > 21 then v_res := 'victoria'; v_razon := 'crupier_pasado_al_repartir';
    end if;
    if v_res is not null then perform veintiuna_i_liquidar(v_id, v_res, v_razon); end if;
  end loop;

  update veintiuna_mesas set fase = 'jugando', fase_limite = null, turno = null where id = m.id;
  perform veintiuna_i_amigos_sincronizar(m.id);
  perform veintiuna_i_amigos_turno(m.id);
end;
$$;

-- Una acción de un jugador en su turno (o la que el servidor hace por quien se pasó de tiempo)
create or replace function veintiuna_i_amigos_actuar(p_mesa uuid, p_asiento int, p_accion text, p_auto boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
  p veintiuna_partidas%rowtype;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  select * into a from veintiuna_asientos where mesa = p_mesa and asiento = p_asiento;
  select * into p from veintiuna_partidas where id = a.partida for update;
  perform veintiuna_i_aplicar(p.id, p_accion);
  update veintiuna_partidas set paso = paso + 1, ultima_accion = now() where id = p.id;
  select * into p from veintiuna_partidas where id = p.id;
  -- lo que la acción pudo cambiar de lo compartido: la posición de la baraja (pedir, Última voluntad) y las cartas del crupier (Trueque)
  update veintiuna_mesas set pos = p.repartidas, crupier = p.crupier where id = m.id;
  perform veintiuna_i_amigos_sincronizar(m.id);
  if p_auto then
    update veintiuna_asientos set perdidos = perdidos + 1 where mesa = p_mesa and asiento = p_asiento;
  else
    update veintiuna_asientos set perdidos = 0 where mesa = p_mesa and asiento = p_asiento;
  end if;
  if p.estado = 'terminada' or p.fase in ('plantada', 'pasada', 'abandonada') then
    perform veintiuna_i_amigos_turno(m.id);
  else
    update veintiuna_mesas set fase_limite = now() + make_interval(secs => (cartas_ajuste('veintiuna_mesa_turno_s', '45'))::text::numeric) where id = m.id;
    perform veintiuna_i_amigos_tocar(m.id);
  end if;
end;
$$;

-- Levanta a un jugador de la mesa. A mitad de ronda pierde su mano (la apuesta ya está pagada) y no puede ganar el pozo.
create or replace function veintiuna_i_amigos_sacar(p_mesa uuid, p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
  p veintiuna_partidas%rowtype;
  v_nuevo uuid;
begin
  select * into m from veintiuna_mesas where id = p_mesa for update;
  select * into a from veintiuna_asientos where mesa = p_mesa and user_id = p_uid;
  if not found then return; end if;
  if m.fase = 'apuestas' then
    perform veintiuna_i_pozo_soltar(m.ronda_id, p_uid);
  elsif m.fase = 'jugando' then
    select * into p from veintiuna_partidas where id = a.partida for update;
    if found and p.estado = 'en_curso' then
      update veintiuna_pozo_cartas set abandono = true where ronda_id = m.ronda_id and user_id = p_uid;
      if p.duelo then update veintiuna_partidas set fase = 'abandonada' where id = p.id;     -- su apuesta se queda en el bote
      else perform veintiuna_i_liquidar(p.id, 'derrota', 'abandono'); end if;
    end if;
  end if;
  delete from veintiuna_asientos where mesa = p_mesa and user_id = p_uid;
  if not exists (select 1 from veintiuna_asientos where mesa = p_mesa) then
    perform veintiuna_i_pozo_soltar(m.ronda_id);
    update veintiuna_mesas set estado = 'cerrada' where id = p_mesa;
    perform veintiuna_i_amigos_tocar(p_mesa);
    return;
  end if;
  if m.creador = p_uid then
    select user_id into v_nuevo from veintiuna_asientos where mesa = p_mesa order by sentado limit 1;
    update veintiuna_mesas set creador = v_nuevo where id = p_mesa;
  end if;
  if m.fase = 'jugando' then
    if not exists (select 1 from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and estado = 'en_curso' and fase in ('jugador', 'fortuna')) then
      perform veintiuna_i_amigos_cerrar_ronda(p_mesa);
    elsif m.turno = a.asiento then
      perform veintiuna_i_amigos_turno(p_mesa);
    else
      perform veintiuna_i_amigos_tocar(p_mesa);
    end if;
  else
    perform veintiuna_i_amigos_tocar(p_mesa);
  end if;
end;
$$;

-- Hace avanzar la mesa si toca: levanta a quien no da señales, reparte cuando están listos o se acaba el plazo, planta a quien se pasó de tiempo y pasa a la siguiente ronda.
-- Quien la llama ya tiene el candado de la mesa.
create or replace function veintiuna_i_amigos_avanzar(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  a record;
  p veintiuna_partidas%rowtype;
  n_asientos int;
  n_listos int;
  n_pasan int;
  inactividad numeric := (cartas_ajuste('veintiuna_mesa_inactividad_s', '150'))::text::numeric;
  perdidos_max int := (cartas_ajuste('veintiuna_mesa_perdidos_max', '2'))::text::int;
  vueltas int := 0;
begin
  loop
    vueltas := vueltas + 1;
    exit when vueltas > 12;
    select * into m from veintiuna_mesas where id = p_mesa;
    exit when not found or m.estado <> 'abierta';
    for a in select user_id from veintiuna_asientos where mesa = m.id and ultima_actividad < now() - make_interval(secs => inactividad) loop
      perform veintiuna_i_amigos_sacar(m.id, a.user_id);
    end loop;
    select * into m from veintiuna_mesas where id = p_mesa;
    exit when m.estado <> 'abierta';

    if m.fase = 'apuestas' then
      select count(*), count(*) filter (where listo and apuesta is not null), count(*) filter (where listo and apuesta is null)
        into n_asientos, n_listos, n_pasan from veintiuna_asientos where mesa = m.id;
      if n_listos > 0 and (n_listos + n_pasan = n_asientos or (m.fase_limite is not null and m.fase_limite <= now())) then
        perform veintiuna_i_amigos_repartir(m.id);
        continue;
      end if;
      exit;
    elsif m.fase = 'jugando' then
      if m.fase_limite is not null and m.fase_limite <= now() and m.turno is not null then
        select * into a from veintiuna_asientos where mesa = m.id and asiento = m.turno;
        select * into p from veintiuna_partidas where id = a.partida;
        perform veintiuna_i_amigos_actuar(m.id, m.turno, case when p.fase = 'fortuna' then 'aceptar' else 'plantar' end, true);
        continue;
      end if;
      exit;
    else
      if m.fase_limite is not null and m.fase_limite <= now() then
        for a in select user_id from veintiuna_asientos where mesa = m.id and perdidos >= perdidos_max loop
          perform veintiuna_i_amigos_sacar(m.id, a.user_id);
        end loop;
        select * into m from veintiuna_mesas where id = p_mesa;
        exit when m.estado <> 'abierta';
        perform veintiuna_i_amigos_nueva_ronda(m.id);
      end if;
      exit;
    end if;
  end loop;
end;
$$;

/* ---------------------------------------------------------------- 8.5) LO QUE VE CADA JUGADOR */
-- La mesa tal como la ve un jugador sentado: las manos de todos (ya se ven), la carta oculta del crupier solo cuando acaba la ronda, y SUS acciones y secretos
-- (la carta que ve con el Ojo, la oculta si pagó las Cartas marcadas). La baraja nunca sale.
create or replace function veintiuna_i_amigos_json(p_mesa uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m veintiuna_mesas%rowtype;
  figura int;
  vc record;
  vj record;
  cru smallint[];
  items jsonb := '[]'::jsonb;
  pozo jsonb := '[]'::jsonb;
  yo jsonb;
  s record;
  p veintiuna_partidas%rowtype;
  mi veintiuna_asientos%rowtype;
  est jsonb;
  v_saldo numeric := veintiuna_i_saldo(p_uid);
  resta numeric;
  p_pozo veintiuna_pozos%rowtype;
begin
  select * into m from veintiuna_mesas where id = p_mesa;
  figura := case m.regla when 'maldicion' then 11 else 10 end;
  cru := case m.fase when 'resultado' then m.crupier when 'jugando' then m.crupier[1:1] else '{}'::smallint[] end;
  select * into vc from veintiuna_i_valor(cru, '{}'::int[], figura);
  select * into mi from veintiuna_asientos where mesa = p_mesa and user_id = p_uid;
  select * into vj from veintiuna_i_valor('{}'::smallint[], '{}'::int[], figura);       -- (se rellena de verdad para cada asiento; aquí solo le da forma)

  for s in select * from veintiuna_asientos where mesa = p_mesa order by asiento loop
    p := null;
    if s.partida is not null then select * into p from veintiuna_partidas where id = s.partida; end if;
    if p.id is not null then select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura); end if;
    items := items || jsonb_build_array(jsonb_build_object(
      'asiento', s.asiento, 'nombre', s.nombre, 'yo', s.user_id = p_uid, 'listo', s.listo, 'perdidos', s.perdidos,
      'apuesta', case when m.fase = 'apuestas' and s.user_id <> p_uid then null else s.apuesta end,        -- las apuestas de los demás se ven al repartir, no antes
      'pasa', s.listo and s.apuesta is null,
      'con_carta', s.carta is not null,
      -- Las manos de los demás están ocultas hasta que acaba la ronda: solo se ve su primera carta y cuántas llevan. Ni el total, ni los peajes, ni si se pasaron.
      'mano', case when p.id is null then null
                   when s.user_id = p_uid or m.fase = 'resultado' then jsonb_build_object(
        'cartas', veintiuna_i_mano_json(p.jugador, p.jugador_as1), 'n', coalesce(array_length(p.jugador, 1), 0), 'total', vj.total, 'blando', vj.blando,
        'estado', p.estado, 'fase', p.fase, 'modo', p.modo, 'apuesta', p.apuesta, 'peajes', p.peajes,
        'resultado', p.resultado, 'razon', p.razon, 'pago', p.pago, 'neto', p.neto)
                   else jsonb_build_object(
        'cartas', veintiuna_i_mano_json(p.jugador[1:1], '{}'::int[]), 'n', coalesce(array_length(p.jugador, 1), 0), 'oculta', true,
        'fase', case when p.estado = 'terminada' or p.fase in ('plantada', 'pasada', 'abandonada') then 'listo' else 'jugador' end,
        'modo', p.modo, 'apuesta', p.apuesta) end
    ));
  end loop;

  select * into p_pozo from veintiuna_pozos where ronda_id = m.ronda_id;
  select coalesce(jsonb_agg(jsonb_build_object('nombre', (select nombre from veintiuna_asientos a where a.mesa = p_mesa and a.user_id = c.user_id), 'user', c.user_id,
                                               'carta', c.carta, 'rareza', c.rareza, 'titulo', c.nombre, 'abandono', c.abandono, 'yo', c.user_id = p_uid) order by c.creado), '[]'::jsonb)
    into pozo from veintiuna_pozo_cartas c where c.ronda_id = m.ronda_id;

  yo := jsonb_build_object('asiento', mi.asiento, 'saldo', v_saldo, 'apuesta', mi.apuesta, 'listo', mi.listo, 'aviso', mi.aviso, 'tu_turno', false);
  if mi.partida is not null then
    select * into p from veintiuna_partidas where id = mi.partida;
    est := veintiuna_i_estado(p, v_saldo);
    yo := yo || jsonb_build_object('partida', p.id, 'paso', p.paso, 'modo', p.modo, 'regla', est -> 'regla', 'acciones', est -> 'acciones', 'vista', est #> '{crupier,vista}',
                                   'resultado', est -> 'resultado', 'logros_nuevos', est -> 'logros_nuevos',
                                   'tu_turno', m.fase = 'jugando' and m.turno = mi.asiento and p.estado = 'en_curso' and p.fase in ('jugador', 'fortuna'));
  end if;

  resta := case when m.fase_limite is null then null else greatest(0, extract(epoch from (m.fase_limite - now()))) end;
  return jsonb_build_object(
    'modo', m.modo,
    'bote', case when m.modo = 'duelo' and m.fase <> 'apuestas' then (select coalesce(sum(apuesta), 0) from veintiuna_partidas where mesa = m.id and ronda_id = m.ronda_id and modo = 'apuesta') end,
    'codigo', m.codigo, 'nombre', m.nombre, 'cartas', m.cartas, 'privada', m.privada, 'creador', (select nombre from veintiuna_asientos a where a.mesa = p_mesa and a.user_id = m.creador),
    'soy_creador', m.creador = p_uid,
    'version', m.version, 'ronda', m.ronda, 'fase', m.fase, 'restante_s', round(resta), 'turno', m.turno,
    'asientos_max', (cartas_ajuste('veintiuna_mesa_asientos', '5'))::text::int,
    'regla', jsonb_build_object('id', m.regla, 'evento', case when m.regla = 'bufon' then m.bufon_evento end, 'asiento_afectado', case when m.regla = 'bufon' then m.bufon_asiento end),
    'proxima_regla', m.proxima_regla,
    'crupier', jsonb_build_object('cartas', veintiuna_i_mano_json(cru, '{}'::int[]), 'ocultas', case when m.fase = 'jugando' and m.modo = 'casa' then 1 else 0 end, 'total', vc.total, 'blando', vc.blando),
    'asientos', items,
    'pozo', jsonb_build_object('activo', m.cartas, 'cartas', pozo, 'estado', p_pozo.estado, 'ganador', (select nombre from veintiuna_asientos a where a.mesa = p_mesa and a.user_id = p_pozo.ganador),
                               'ganador_nombre_libre', (select veintiuna_i_nombre(p_pozo.ganador))),
    'yo', yo,
    'limites', jsonb_build_object(
      'min', (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric,
      'max', nullif((cartas_ajuste('veintiuna_apuesta_max', '0'))::text::numeric, 0),
      'paso', (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric),
    'peajes', jsonb_build_object(
      'fortuna', (cartas_ajuste('veintiuna_peaje_fortuna', '0.6'))::text::numeric,
      'voluntad', (cartas_ajuste('veintiuna_peaje_voluntad', '0.5'))::text::numeric,
      'ojo', (cartas_ajuste('veintiuna_peaje_ojo', '0.35'))::text::numeric,
      'marcadas', (cartas_ajuste('veintiuna_peaje_marcadas', '0.18'))::text::numeric,
      'trueque', (cartas_ajuste('veintiuna_peaje_trueque', '1'))::text::numeric)
  );
end;
$$;

/* ---------------------------------------------------------------- 8.6) LO QUE LLAMA EL NAVEGADOR */
-- Mesas públicas con sitio o en juego (las privadas solo se entran con su código)
create or replace function veintiuna_amigos_lista()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inactividad numeric := (cartas_ajuste('veintiuna_mesa_inactividad_s', '150'))::text::numeric;
  f record;
  r jsonb;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  -- limpieza: las mesas cerradas hace días se borran y quien lleva mucho sin dar señales se levanta (cada mesa bajo su candado)
  delete from veintiuna_mesas where estado = 'cerrada' and actividad < now() - interval '2 days';
  for f in select distinct mesa, user_id from veintiuna_asientos where ultima_actividad < now() - make_interval(secs => inactividad) loop
    if pg_try_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || f.mesa::text, 0)) then perform veintiuna_i_amigos_sacar(f.mesa, f.user_id); end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('codigo', m.codigo, 'nombre', m.nombre, 'cartas', m.cartas, 'modo', m.modo, 'fase', m.fase, 'ronda', m.ronda,
      'jugadores', (select coalesce(jsonb_agg(a.nombre order by a.asiento), '[]'::jsonb) from veintiuna_asientos a where a.mesa = m.id),
      'asientos_max', (cartas_ajuste('veintiuna_mesa_asientos', '5'))::text::int) order by m.actividad desc), '[]'::jsonb)
    into r from veintiuna_mesas m where m.estado = 'abierta' and not m.privada and exists (select 1 from veintiuna_asientos a where a.mesa = m.id);
  return jsonb_build_object('mesas', r, 'sentado', exists (select 1 from veintiuna_asientos where user_id = uid), 'saldo', veintiuna_i_saldo(uid));
end;
$$;

-- Crea una mesa y te sienta en ella
drop function if exists veintiuna_amigos_crear(text, boolean, boolean);
create or replace function veintiuna_amigos_crear(p_nombre text default null, p_privada boolean default true, p_cartas boolean default false, p_modo text default 'casa')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_nombre text;
  v_id uuid;
  v_modo text := coalesce(nullif(p_modo, ''), 'casa');
  v_regla text;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if v_modo not in ('casa', 'duelo') then perform veintiuna_i_error('Ese modo de mesa no existe.', 'peticion_invalida'); end if;
  v_regla := case when v_modo = 'duelo' then veintiuna_i_regla_nueva_duelo() else veintiuna_i_regla_nueva() end;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));
  perform veintiuna_i_cerrar_inactiva(uid);
  if exists (select 1 from veintiuna_asientos where user_id = uid) then perform veintiuna_i_error('Ya estás sentado en una mesa. Sal de ella antes de crear otra.', 'ya_sentado'); end if;
  if exists (select 1 from veintiuna_partidas where user_id = uid and estado = 'en_curso') then perform veintiuna_i_error('Termina antes tu mano individual.', 'mano_en_curso'); end if;
  v_nombre := nullif(left(trim(coalesce(p_nombre, '')), 30), '');
  if v_nombre is null then v_nombre := 'Mesa de ' || veintiuna_i_nombre(uid); end if;
  insert into veintiuna_mesas (codigo, nombre, creador, privada, cartas, regla, proxima_regla, modo)
    values (veintiuna_i_amigos_codigo(), v_nombre, uid, coalesce(p_privada, true), coalesce(p_cartas, false), v_regla,
            case when v_modo = 'duelo' then veintiuna_i_regla_nueva_duelo() else veintiuna_i_regla_nueva() end, v_modo)
    returning id into v_id;
  insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
  insert into veintiuna_asientos (mesa, asiento, user_id, nombre) values (v_id, 0, uid, veintiuna_i_nombre(uid));
  return veintiuna_i_amigos_json(v_id, uid);
end;
$$;

-- Te sienta en una mesa por su código (o te devuelve a la tuya si ya estabas)
create or replace function veintiuna_amigos_unirse(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  v_max int := (cartas_ajuste('veintiuna_mesa_asientos', '5'))::text::int;
  v_asiento int;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_' || uid::text, 0));
  select * into m from veintiuna_mesas where codigo = upper(trim(coalesce(p_codigo, ''))) and estado = 'abierta';
  if not found then perform veintiuna_i_error('No encuentro esa mesa. Revisa el código.', 'mesa_no_existe'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || m.id::text, 0));
  if exists (select 1 from veintiuna_asientos where user_id = uid and mesa = m.id) then return veintiuna_i_amigos_json(m.id, uid); end if;
  if exists (select 1 from veintiuna_asientos where user_id = uid) then perform veintiuna_i_error('Ya estás sentado en otra mesa. Sal de ella antes.', 'ya_sentado'); end if;
  perform veintiuna_i_cerrar_inactiva(uid);
  if exists (select 1 from veintiuna_partidas where user_id = uid and estado = 'en_curso') then perform veintiuna_i_error('Termina antes tu mano individual.', 'mano_en_curso'); end if;
  select min(n) into v_asiento from generate_series(0, v_max - 1) n where not exists (select 1 from veintiuna_asientos where mesa = m.id and asiento = n);
  if v_asiento is null then perform veintiuna_i_error('La mesa está llena.', 'mesa_llena'); end if;
  insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
  insert into veintiuna_asientos (mesa, asiento, user_id, nombre) values (m.id, v_asiento, uid, veintiuna_i_nombre(uid));
  perform veintiuna_i_amigos_tocar(m.id);
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

-- Te levantas de la mesa
create or replace function veintiuna_amigos_salir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_mesa uuid;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select mesa into v_mesa from veintiuna_asientos where user_id = uid;
  if v_mesa is null then return jsonb_build_object('ok', true); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || v_mesa::text, 0));
  perform veintiuna_i_amigos_sacar(v_mesa, uid);
  return jsonb_build_object('ok', true);
end;
$$;

-- El estado de tu mesa. Si pasas la versión que ya tienes y no ha cambiado nada, solo recibes {sin_cambios}. Cada llamada es también la señal de que sigues ahí.
create or replace function veintiuna_amigos_estado(p_version bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
  n_asientos int;
  n_listos int;
  n_pasan int;
  toca boolean;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then return jsonb_build_object('sin_mesa', true); end if;
  update veintiuna_asientos set ultima_actividad = now() where mesa = a.mesa and asiento = a.asiento and ultima_actividad < now() - interval '4 seconds';
  select * into m from veintiuna_mesas where id = a.mesa;
  select count(*), count(*) filter (where listo and apuesta is not null), count(*) filter (where listo and apuesta is null)
    into n_asientos, n_listos, n_pasan from veintiuna_asientos where mesa = m.id;
  toca := m.estado = 'abierta' and (
       (m.fase = 'apuestas' and n_listos > 0 and (n_listos + n_pasan = n_asientos or (m.fase_limite is not null and m.fase_limite <= now())))
    or (m.fase in ('jugando', 'resultado') and m.fase_limite is not null and m.fase_limite <= now())
    or exists (select 1 from veintiuna_asientos where mesa = m.id and ultima_actividad < now() - make_interval(secs => (cartas_ajuste('veintiuna_mesa_inactividad_s', '150'))::text::numeric)));
  if toca and pg_try_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || m.id::text, 0)) then
    perform veintiuna_i_amigos_avanzar(m.id);
    select * into m from veintiuna_mesas where id = a.mesa;
  end if;
  if not exists (select 1 from veintiuna_asientos where user_id = uid) then return jsonb_build_object('sin_mesa', true, 'levantado', true); end if;
  if p_version is not null and p_version = m.version then
    return jsonb_build_object('sin_cambios', true, 'version', m.version,
      'restante_s', case when m.fase_limite is null then null else round(greatest(0, extract(epoch from (m.fase_limite - now())))) end);
  end if;
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

-- Las copias tuyas que se pueden poner en el pozo (libres, y no puestas ya en otra cosa)
create or replace function veintiuna_amigos_mis_cartas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  return cartas_i_info_apuesta(array(select id from cartas_ejemplares where propietario = uid and estado = 'poseida' limit 300));
end;
$$;

-- Apostar para la ronda (0 = jugar sin apostar tokens: no cuenta para los desafíos) y, si la mesa tiene pozo, poner una carta
create or replace function veintiuna_amigos_apostar(p_apuesta numeric, p_carta uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
  min_a numeric := (cartas_ajuste('veintiuna_apuesta_min', '10'))::text::numeric;
  max_a numeric := (cartas_ajuste('veintiuna_apuesta_max', '0'))::text::numeric;
  paso_a numeric := (cartas_ajuste('veintiuna_apuesta_paso', '10'))::text::numeric;
  v_saldo numeric;
  v_problema text;
  v_info jsonb;
  f record;
  v_hoy int;
  ref text;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then perform veintiuna_i_error('No estás sentado en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || a.mesa::text, 0));
  perform veintiuna_i_amigos_avanzar(a.mesa);
  select * into m from veintiuna_mesas where id = a.mesa;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then return jsonb_build_object('sin_mesa', true, 'levantado', true); end if;
  if m.fase <> 'apuestas' then perform veintiuna_i_error('Ahora no se puede apostar: espera a la siguiente ronda.', 'fase_invalida'); end if;
  if p_apuesta is null or p_apuesta < 0 then perform veintiuna_i_error('Esa apuesta no es válida.', 'apuesta_invalida'); end if;
  if p_apuesta > 0 then
    if p_apuesta < min_a or (max_a > 0 and p_apuesta > max_a) then perform veintiuna_i_error(case when max_a > 0 then 'La apuesta va de ' || min_a || ' a ' || max_a || ' tokens (o 0 para jugar sin apostar).' else 'La apuesta mínima es de ' || min_a || ' tokens (o 0 para jugar sin apostar).' end, 'apuesta_invalida'); end if;
    if p_apuesta <> trunc(p_apuesta / paso_a) * paso_a then perform veintiuna_i_error('La apuesta tiene que ser múltiplo de ' || paso_a || '.', 'apuesta_invalida'); end if;
    v_saldo := veintiuna_i_saldo(uid);
    if p_apuesta > v_saldo then perform veintiuna_i_error('No tienes tantos tokens: te faltan ' || trim_scale(p_apuesta - v_saldo) || '.', 'saldo_insuficiente'); end if;
  end if;
  ref := 'veintiuna:' || m.ronda_id::text || ':' || uid::text;
  -- la carta del pozo
  if p_carta is null or p_carta is distinct from a.carta then
    if a.carta is not null then perform veintiuna_i_pozo_soltar(m.ronda_id, uid); end if;
  end if;
  if p_carta is not null and p_carta is distinct from a.carta then
    if not m.cartas then perform veintiuna_i_error('Esta mesa no juega con cartas.', 'sin_pozo'); end if;
    v_problema := cartas_i_error_apuesta(uid, array[p_carta]);
    if v_problema is not null then perform veintiuna_i_error(v_problema, 'carta_invalida'); end if;
    select count(*) into v_hoy from veintiuna_pozo_cartas where user_id = uid and creado >= date_trunc('day', now());
    if v_hoy >= (cartas_ajuste('veintiuna_pozo_max_dia', '5'))::text::int then
      perform veintiuna_i_error('Hoy ya has puesto cartas en el pozo ' || v_hoy || ' veces. Mañana podrás más.', 'pozo_tope_dia');
    end if;
    -- equilibrio: las cartas del pozo no pueden diferir en más de una categoría de rareza
    for f in select ejemplar from veintiuna_pozo_cartas where ronda_id = m.ronda_id loop
      v_problema := cartas_i_error_equilibrio(array[p_carta], array[f.ejemplar]);
      if v_problema is not null then perform veintiuna_i_error(v_problema, 'pozo_desequilibrado'); end if;
    end loop;
    perform cartas_i_bloquear(array[p_carta], 'pozo de Las Veintiuna Velas', ref, now() + interval '2 hours');
    v_info := cartas_i_info_apuesta(array[p_carta]) -> 0;
    insert into veintiuna_pozo_cartas (ronda_id, user_id, ejemplar, carta, rareza, nombre)
      values (m.ronda_id, uid, p_carta, v_info ->> 'carta', v_info ->> 'rareza', v_info ->> 'nombre');
    update veintiuna_asientos set carta = p_carta where mesa = m.id and asiento = a.asiento;
  end if;
  update veintiuna_asientos set apuesta = p_apuesta, listo = true, aviso = null where mesa = m.id and asiento = a.asiento;
  if m.fase_limite is null then
    update veintiuna_mesas set fase_limite = now() + make_interval(secs => (cartas_ajuste('veintiuna_mesa_apuestas_s', '45'))::text::numeric) where id = m.id;
  end if;
  perform veintiuna_i_amigos_tocar(m.id);
  perform veintiuna_i_amigos_avanzar(m.id);
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

-- No jugar esta ronda
create or replace function veintiuna_amigos_pasar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then perform veintiuna_i_error('No estás sentado en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || a.mesa::text, 0));
  select * into m from veintiuna_mesas where id = a.mesa;
  if m.fase <> 'apuestas' then perform veintiuna_i_error('Ahora no se puede decidir: espera a la siguiente ronda.', 'fase_invalida'); end if;
  perform veintiuna_i_pozo_soltar(m.ronda_id, uid);
  update veintiuna_asientos set apuesta = null, listo = true, aviso = null where mesa = m.id and asiento = a.asiento;
  perform veintiuna_i_amigos_tocar(m.id);
  perform veintiuna_i_amigos_avanzar(m.id);
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

-- Quien creó la mesa reparte ya con quienes están listos (los demás se sientan esta ronda)
create or replace function veintiuna_amigos_repartir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then perform veintiuna_i_error('No estás sentado en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || a.mesa::text, 0));
  select * into m from veintiuna_mesas where id = a.mesa;
  if m.creador is distinct from uid then perform veintiuna_i_error('Solo quien creó la mesa puede repartir antes de tiempo.', 'solo_creador'); end if;
  if m.fase <> 'apuestas' then perform veintiuna_i_error('Ahora no se puede repartir.', 'fase_invalida'); end if;
  if not exists (select 1 from veintiuna_asientos where mesa = m.id and listo and apuesta is not null) then perform veintiuna_i_error('Todavía no ha apostado nadie.', 'sin_apuestas'); end if;
  perform veintiuna_i_amigos_repartir(m.id);
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

-- Una acción en tu turno: 'pedir', 'plantar', 'fortuna', 'aceptar', 'voluntad', 'ojo', 'marcadas' o 'trueque'. p_paso es el paso de tu mano que ve tu pantalla.
create or replace function veintiuna_amigos_accion(p_paso int, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m veintiuna_mesas%rowtype;
  a veintiuna_asientos%rowtype;
  p veintiuna_partidas%rowtype;
begin
  if uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then perform veintiuna_i_error('No estás sentado en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_mesa_' || a.mesa::text, 0));
  perform veintiuna_i_amigos_avanzar(a.mesa);
  select * into m from veintiuna_mesas where id = a.mesa;
  select * into a from veintiuna_asientos where user_id = uid;
  if not found then return jsonb_build_object('sin_mesa', true, 'levantado', true); end if;
  if m.fase <> 'jugando' or m.turno is distinct from a.asiento then
    perform veintiuna_i_error('No es tu turno.', 'no_es_tu_turno');
  end if;
  select * into p from veintiuna_partidas where id = a.partida;
  if p_paso < p.paso then return veintiuna_i_amigos_json(m.id, uid); end if;               -- esa acción ya estaba aplicada
  if p_paso > p.paso then perform veintiuna_i_error('La mesa y tu pantalla no coinciden. Recarga.', 'paso_futuro'); end if;
  perform veintiuna_i_amigos_actuar(m.id, a.asiento, p_accion, false);
  perform veintiuna_i_amigos_avanzar(m.id);
  return veintiuna_i_amigos_json(m.id, uid);
end;
$$;

/* ---------------------------------------------------------------- 8.7) PERMISOS */
revoke all on function veintiuna_i_mazo_doble(), veintiuna_i_nombre(uuid), veintiuna_i_amigos_codigo(), veintiuna_i_amigos_tocar(uuid), veintiuna_i_amigos_sincronizar(uuid),
  veintiuna_i_pozo_soltar(uuid, uuid), veintiuna_i_pozo_resolver(uuid), veintiuna_i_amigos_nueva_ronda(uuid), veintiuna_i_amigos_cerrar_ronda(uuid), veintiuna_i_amigos_turno(uuid),
  veintiuna_i_amigos_repartir(uuid, smallint[]), veintiuna_i_amigos_actuar(uuid, int, text, boolean), veintiuna_i_amigos_sacar(uuid, uuid), veintiuna_i_amigos_avanzar(uuid),
  veintiuna_i_amigos_json(uuid, uuid), veintiuna_i_amigos_resolver_duelo(uuid), veintiuna_i_calidad(smallint[], int[], int), veintiuna_i_liquidar_pago(uuid, numeric, text, text, text),
  veintiuna_i_regla_nueva_duelo() from public, anon, authenticated;
revoke all on function veintiuna_amigos_lista(), veintiuna_amigos_crear(text, boolean, boolean, text), veintiuna_amigos_unirse(text), veintiuna_amigos_salir(), veintiuna_amigos_estado(bigint),
  veintiuna_amigos_mis_cartas(), veintiuna_amigos_apostar(numeric, uuid), veintiuna_amigos_pasar(), veintiuna_amigos_repartir(), veintiuna_amigos_accion(int, text) from public, anon;
grant execute on function veintiuna_amigos_lista(), veintiuna_amigos_crear(text, boolean, boolean, text), veintiuna_amigos_unirse(text), veintiuna_amigos_salir(), veintiuna_amigos_estado(bigint),
  veintiuna_amigos_mis_cartas(), veintiuna_amigos_apostar(numeric, uuid), veintiuna_amigos_pasar(), veintiuna_amigos_repartir(), veintiuna_amigos_accion(int, text) to authenticated;
