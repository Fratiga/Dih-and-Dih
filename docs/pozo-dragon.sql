-- EL POZO DEL DRAGÓN: juego de dados con apuestas de tokens y cartas (pozo-dragon.html). Tres modalidades que comparten los dados, la clasificación y el dinero:
--   * Solitario (sección 12): tú contra el Dragón, solo dinero; paga la casa, con tributo del 5 % y bonos a un cuarto para que no se cree dinero sin respaldo.
--   * Duelo de Dragones: dos jugadores, mejor de tres rondas ganadas (gana quien llega a 2), límite de 5 rondas.
--   * El Pozo Compartido: de 2 a 6 jugadores que tiran por turnos, deciden cuándo cobrar y se reparten el pozo en proporción a su peso.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de la economía de cartas (economia-1 a economia-21) y del Hipódromo (docs/hipodromo.sql). Se puede repetir.
-- El diseño, las reglas y las simulaciones están en docs/pozo-dragon.md.
--
-- ESTÁ OCULTO: mientras el ajuste 'pozo_dragon_publico' sea false, cada función pública solo responde al admin (fichas_es_admin()). Para abrirlo a todos:
--   update cartas_economia_ajustes set valor = 'true' where clave = 'pozo_dragon_publico';   (y quitar js/oculto.js de pozo-dragon.html; ver docs/pozo-dragon.md)
--
-- Qué hay aquí:
--   * Todo lo decide el servidor: los dados (aleatoriedad del servidor), la clasificación, el orden de los turnos, las reservas, el pozo y los pagos. El navegador solo pide
--     acciones («tirar», «cobrar», «continuar») y pinta lo que el servidor confirma. Cada acción lleva el número de paso de la mesa: repetirla no la aplica dos veces.
--   * El dinero son los tokens del Hipódromo (hipodromo_billeteras / hipodromo_movimientos): la apuesta se DESCUENTA al confirmar (el saldo disponible ya no la cuenta)
--     y se abona al liquidar. Las cartas se bloquean con el sistema oficial (cartas_i_bloquear) y cambian de dueño solo con cartas_i_transferir, que respeta los límites.
--   * Una mesa se liquida UNA sola vez: el candado de la mesa y el estado 'terminada' lo garantizan.
--   * Nada se queda colgado: una sala vacía caduca, quien no confirma sale, quien no juega su turno se retira solo, y una mesa abandonada se resuelve sola.

/* ================================================================== 0) AJUSTES */
insert into cartas_economia_ajustes (clave, valor) values
  ('pozo_dragon_publico', 'false'),      -- false: solo el admin lo ve y lo juega
  ('pozo_apuesta_min', '10'),            -- apuesta de dinero mínima por jugador (0 se permite si se juega solo con cartas)
  ('pozo_apuesta_paso', '10'),           -- las apuestas son múltiplos de esto
  ('pozo_apuesta_max', '0'),             -- apuesta máxima por jugador; 0 = sin máximo (el juego es entre jugadores: no se crea dinero)
  ('pozo_cartas_max', '3'),              -- cartas que puede poner cada jugador
  ('pozo_turno_s', '30'),                -- segundos para jugar cada turno
  ('pozo_confirmar_s', '90'),            -- segundos para confirmar las condiciones cuando la inscripción está cerrada
  ('pozo_sala_min', '30'),               -- minutos que vive una sala que no llega a empezar
  ('pozo_inactividad_s', '120'),         -- segundos sin dar señales tras los que sales de una sala que aún no empezó
  ('pozo_abandono_s', '300'),            -- segundos sin señales de NINGÚN jugador tras los que una mesa en juego se resuelve sola
  ('pozo_cambios_max', '6'),             -- veces que se pueden cambiar las cartas ofrecidas en una sala
  ('pozo_tiradas_max', '5'),             -- tiradas máximas de cada jugador en el Pozo Compartido
  ('pozo_duelo_victorias', '2'),         -- rondas que hay que ganar en el Duelo
  ('pozo_duelo_rondas', '5'),            -- rondas máximas del Duelo (los empates gastan ronda)
  ('pozo_duelo_faltas', '2'),            -- turnos seguidos que se pueden dejar pasar en el Duelo (se tira solo); el siguiente es abandono
  ('pozo_bono_pareja', '12.5'),          -- bonos del Pozo Compartido, en % de la apuesta. Suman al PESO del jugador (ver docs/pozo-dragon.md: la tabla original de 25/75/150/400 se aplica a la mitad)
  ('pozo_bono_escalera', '37.5'),
  ('pozo_bono_triple', '75'),
  ('pozo_bono_triple_seis', '200')
on conflict (clave) do nothing;

/* ================================================================== 1) TABLAS */
create table if not exists pozo_mesas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  modo text not null check (modo in ('duelo', 'compartido')),
  nombre text not null,
  privada boolean not null default true,
  creador uuid not null,
  estado text not null default 'abierta' check (estado in ('abierta', 'confirmando', 'jugando', 'terminada', 'cancelada')),
  dinero numeric(12, 2) not null default 0 check (dinero >= 0),     -- apuesta de dinero de cada jugador
  cartas int not null default 0 check (cartas between 0 and 5),     -- cartas que pone cada jugador
  min_jugadores int not null default 2,
  max_jugadores int not null default 2 check (max_jugadores between 2 and 6),
  cond_version int not null default 1,                              -- sube cada vez que cambian las condiciones (jugadores u ofertas): obliga a confirmar de nuevo
  cambios int not null default 0,
  limite timestamptz,                                               -- confirmando: hasta cuándo se puede confirmar
  vence timestamptz not null,                                       -- una sala que no empieza antes de esto se cancela
  ronda int not null default 0,                                     -- Duelo: la ronda; Compartido: la vuelta
  turno int,
  turno_fase text check (turno_fase in ('tirar', 'decidir')),
  turno_limite timestamptz,
  paso int not null default 0,                                      -- sube con cada acción aceptada o cambio de turno: las peticiones repetidas no se aplican dos veces
  empieza int,                                                      -- Duelo: quién tira primero en la ronda actual
  resultado jsonb,
  motivo text,
  version bigint not null default 1,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  iniciada timestamptz,
  terminada timestamptz,
  check (dinero > 0 or cartas > 0)
);

create table if not exists pozo_jugadores (
  mesa uuid not null references pozo_mesas(id) on delete cascade,
  asiento int not null,
  user_id uuid not null,
  nombre text not null,
  estado text not null default 'esperando' check (estado in ('esperando', 'confirmado', 'activo', 'retirado', 'ruina', 'fuera')),
  oferta uuid[] not null default '{}',                              -- cartas que ofrece (visibles para todos; todavía no reservadas)
  dinero numeric(12, 2) not null default 0,                         -- lo que está DE VERDAD reservado (ya descontado de su billetera)
  cartas uuid[] not null default '{}',                              -- cartas DE VERDAD bloqueadas
  tiradas int not null default 0,
  peso numeric(10, 4) not null default 1,                           -- Compartido: 1 (su apuesta) + los bonos de sus tiradas
  victorias int not null default 0,                                 -- Duelo
  faltas int not null default 0,
  aviso text,
  pagado boolean not null default false,
  pago numeric(12, 2),
  ultima_senal timestamptz not null default now(),
  activo boolean not null default true,                             -- false cuando la mesa termina o se cancela, o sales
  descartada boolean not null default false,                        -- ya viste el resultado y cerraste la mesa
  creado timestamptz not null default now(),
  primary key (mesa, asiento),
  unique (mesa, user_id)
);
create unique index if not exists pozo_un_activo on pozo_jugadores (user_id) where activo;
create index if not exists pozo_jugadores_user_idx on pozo_jugadores (user_id, creado desc);

create table if not exists pozo_tiradas (
  id bigint generated always as identity primary key,
  mesa uuid not null references pozo_mesas(id) on delete cascade,
  asiento int not null,
  ronda int not null,
  n int not null,                                                   -- nº de tirada de ese jugador en la mesa
  d1 smallint not null check (d1 between 1 and 6),
  d2 smallint not null check (d2 between 1 and 6),
  d3 smallint not null check (d3 between 1 and 6),
  categoria text not null,
  auto boolean not null default false,                              -- la tiró el servidor porque se acabó el tiempo (Duelo)
  creada timestamptz not null default now()
);
create index if not exists pozo_tiradas_mesa_idx on pozo_tiradas (mesa, id);

create table if not exists pozo_rondas (
  mesa uuid not null references pozo_mesas(id) on delete cascade,
  ronda int not null,
  ganador int,                                                      -- asiento ganador; null = empate
  primary key (mesa, ronda)
);

alter table pozo_mesas enable row level security;
alter table pozo_jugadores enable row level security;
alter table pozo_tiradas enable row level security;
alter table pozo_rondas enable row level security;
drop policy if exists "pozo_mesas_admin" on pozo_mesas;
create policy "pozo_mesas_admin" on pozo_mesas for select using (fichas_es_admin());
drop policy if exists "pozo_jugadores_admin" on pozo_jugadores;
create policy "pozo_jugadores_admin" on pozo_jugadores for select using (fichas_es_admin());
drop policy if exists "pozo_tiradas_admin" on pozo_tiradas;
create policy "pozo_tiradas_admin" on pozo_tiradas for select using (fichas_es_admin());
drop policy if exists "pozo_rondas_admin" on pozo_rondas;
create policy "pozo_rondas_admin" on pozo_rondas for select using (fichas_es_admin());
-- Nadie escribe ni lee directamente (solo el admin, para revisar): todo pasa por las funciones de abajo
revoke all on pozo_mesas, pozo_jugadores, pozo_tiradas, pozo_rondas from anon, authenticated;
grant select on pozo_mesas, pozo_jugadores, pozo_tiradas, pozo_rondas to authenticated;

/* ================================================================== 2) PIEZAS: errores, dados y combinaciones */
create or replace function pozo_i_error(p_msg text, p_codigo text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_msg using hint = p_codigo;
end;
$$;

-- Un número entre 0 y p_n - 1 con el aleatorio del servidor (gen_random_uuid usa el generador criptográfico de Postgres)
create or replace function pozo_i_azar(p_n int)
returns int
language sql
volatile
as $$
  select (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % p_n)::int
$$;

create or replace function pozo_i_dado()
returns smallint
language sql
volatile
as $$
  select (1 + pozo_i_azar(6))::smallint
$$;

-- La clasificación, determinista y excluyente, en este orden: Ruina (suma de 3 a 5), triple seis, otros triples, escalera, pareja, ceniza
create or replace function pozo_i_clasificar(a int, b int, c int)
returns text
language sql
immutable
as $$
  select case
    when a + b + c <= 5 then 'ruina'
    when a = b and b = c then case when a = 6 then 'triple_seis' else 'triple' end
    when (select max(x) - min(x) = 2 and count(distinct x) = 3 from unnest(array[a, b, c]) x) then 'escalera'
    when a = b or b = c or a = c then 'pareja'
    else 'ceniza'
  end
$$;

-- Bono de cada combinación en el Pozo Compartido, como fracción de la apuesta (12,5 % = 0.125). Ruina y ceniza no suman nada.
create or replace function pozo_i_bono(p_categoria text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select case p_categoria
    when 'pareja' then (cartas_ajuste('pozo_bono_pareja', '12.5'))::text::numeric
    when 'escalera' then (cartas_ajuste('pozo_bono_escalera', '37.5'))::text::numeric
    when 'triple' then (cartas_ajuste('pozo_bono_triple', '75'))::text::numeric
    when 'triple_seis' then (cartas_ajuste('pozo_bono_triple_seis', '200'))::text::numeric
    else 0 end / 100
$$;

-- La fuerza de una tirada para compararla en el Duelo: a mayor número, mejor. Jerarquía: Ruina < ceniza < pareja < escalera < triple (2 a 5) < triple seis.
-- Dentro de una categoría: Ruina por la suma; ceniza por los dados de mayor a menor; pareja por el valor de la pareja y luego el del dado suelto;
-- escalera por el dado más alto; triple por su valor. Dos tiradas con la misma fuerza empatan.
create or replace function pozo_i_fuerza(a int, b int, c int)
returns int
language plpgsql
immutable
as $$
declare
  cat text := pozo_i_clasificar(a, b, c);
  o int[] := array(select x from unnest(array[a, b, c]) x order by x desc);
  par int;
  suelto int;
begin
  if cat = 'ruina' then return a + b + c; end if;
  if cat = 'ceniza' then return 1000 + o[1] * 100 + o[2] * 10 + o[3]; end if;
  if cat = 'pareja' then
    par := case when a = b or a = c then a else b end;
    suelto := a + b + c - 2 * par;
    return 2000 + par * 10 + suelto;
  end if;
  if cat = 'escalera' then return 3000 + o[1]; end if;
  if cat = 'triple' then return 4000 + a; end if;
  return 5006;
end;
$$;

/* ================================================================== 3) PIEZAS: jugadores, códigos, dinero, cartas */
create or replace function pozo_i_nombre(p_uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select nullif(trim(username), '') from perfiles where user_id = p_uid), 'Jugador')
$$;

create or replace function pozo_i_codigo()
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
    for i in 1..5 loop c := c || substr(alfabeto, 1 + pozo_i_azar(length(alfabeto)), 1); end loop;
    exit when not exists (select 1 from pozo_mesas where codigo = c);
  end loop;
  return c;
end;
$$;

create or replace function pozo_i_tocar(p_mesa uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update pozo_mesas set version = version + 1, actualizada = now() where id = p_mesa
$$;

-- Mientras el juego esté oculto solo responde al admin
create or replace function pozo_i_acceso()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform pozo_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if not (cartas_ajuste('pozo_dragon_publico', 'false'))::text::boolean and not coalesce(fichas_es_admin(), false) then
    perform pozo_i_error('El Pozo del Dragón todavía no está abierto.', 'oculto');
  end if;
end;
$$;

create or replace function pozo_i_saldo(p_uid uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select saldo from hipodromo_billeteras where usuario = p_uid), 0)
$$;

-- Descuenta de la billetera (la apuesta deja de estar disponible) y lo anota en el libro
create or replace function pozo_i_debitar(p_uid uuid, p_monto numeric, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  if p_monto <= 0 then return; end if;
  insert into hipodromo_billeteras (usuario) values (p_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = p_uid for update;
  if v_saldo < p_monto then perform pozo_i_error('No tienes tantos tokens: te faltan ' || trim_scale(p_monto - v_saldo) || '.', 'saldo_insuficiente'); end if;
  update hipodromo_billeteras set saldo = saldo - p_monto where usuario = p_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (p_uid, null, left(p_concepto, 200), -p_monto, v_saldo);
end;
$$;

create or replace function pozo_i_abonar(p_uid uuid, p_monto numeric, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  if p_monto <= 0 then return; end if;
  insert into hipodromo_billeteras (usuario) values (p_uid) on conflict (usuario) do nothing;
  update hipodromo_billeteras set saldo = saldo + p_monto where usuario = p_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (p_uid, null, left(p_concepto, 200), p_monto, v_saldo);
end;
$$;

create or replace function pozo_i_ref(p_mesa uuid, p_uid uuid)
returns text
language sql
immutable
as $$ select 'pozodragon:' || p_mesa::text || ':' || p_uid::text $$;

-- Devuelve lo que un jugador tenía reservado (dinero y cartas) y lo deja sin confirmar. Es seguro repetirla: no hay nada más que devolver la segunda vez.
create or replace function pozo_i_devolver(p_mesa uuid, p_asiento int, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j pozo_jugadores%rowtype;
  m pozo_mesas%rowtype;
begin
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = p_asiento for update;
  if not found then return; end if;
  select * into m from pozo_mesas where id = p_mesa;
  if j.dinero > 0 then perform pozo_i_abonar(j.user_id, j.dinero, p_concepto || ' (mesa ' || m.codigo || ')'); end if;
  if cardinality(j.cartas) > 0 then perform cartas_i_desbloquear(pozo_i_ref(p_mesa, j.user_id)); end if;
  update pozo_jugadores set dinero = 0, cartas = '{}' where mesa = p_mesa and asiento = p_asiento;
end;
$$;

/* ================================================================== 4) SALAS: reiniciar, quitar, cancelar, cerrar la inscripción */
-- Cambian las condiciones (alguien entra, sale o cambia sus cartas): todo el mundo tiene que confirmar de nuevo, y lo ya reservado se devuelve
create or replace function pozo_i_reiniciar(p_mesa uuid, p_aviso text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j record;
  m pozo_mesas%rowtype;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  for j in select asiento, estado from pozo_jugadores where mesa = p_mesa order by asiento loop
    if j.estado = 'confirmado' then
      perform pozo_i_devolver(p_mesa, j.asiento, 'El Pozo del Dragón: apuesta devuelta, cambiaron las condiciones');
      update pozo_jugadores set estado = 'esperando', aviso = p_aviso where mesa = p_mesa and asiento = j.asiento;
    end if;
  end loop;
  update pozo_mesas set cond_version = cond_version + 1,
    limite = case when estado = 'confirmando' then now() + make_interval(secs => (cartas_ajuste('pozo_confirmar_s', '90'))::text::numeric) else null end
    where id = p_mesa;
  perform pozo_i_tocar(p_mesa);
end;
$$;

create or replace function pozo_i_cancelar(p_mesa uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j record;
  m pozo_mesas%rowtype;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado not in ('abierta', 'confirmando') then return; end if;
  for j in select asiento from pozo_jugadores where mesa = p_mesa order by user_id loop
    perform pozo_i_devolver(p_mesa, j.asiento, 'El Pozo del Dragón: mesa cancelada, apuesta devuelta');
  end loop;
  update pozo_jugadores set activo = false, estado = 'fuera', aviso = p_motivo where mesa = p_mesa;
  update pozo_mesas set estado = 'cancelada', motivo = p_motivo, terminada = now(), turno = null, turno_fase = null, turno_limite = null, limite = null where id = p_mesa;
  perform pozo_i_tocar(p_mesa);
end;
$$;

-- Saca a un jugador de una sala que aún no ha empezado (devuelve su reserva y reinicia las confirmaciones de los demás)
create or replace function pozo_i_quitar(p_mesa uuid, p_asiento int, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  j pozo_jugadores%rowtype;
  v_resto int;
  v_nuevo uuid;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = p_asiento for update;
  if not found or m.estado not in ('abierta', 'confirmando') then return; end if;
  perform pozo_i_devolver(p_mesa, p_asiento, 'El Pozo del Dragón: apuesta devuelta');
  delete from pozo_jugadores where mesa = p_mesa and asiento = p_asiento;
  select count(*) into v_resto from pozo_jugadores where mesa = p_mesa and activo;
  if v_resto = 0 then perform pozo_i_cancelar(p_mesa, 'Se vació la sala'); return; end if;
  if m.creador = j.user_id then
    select user_id into v_nuevo from pozo_jugadores where mesa = p_mesa and activo order by asiento limit 1;
    update pozo_mesas set creador = v_nuevo where id = p_mesa;
  end if;
  -- cambió la lista de participantes: vuelve a abrirse la inscripción y hay que confirmar otra vez
  update pozo_mesas set estado = 'abierta', limite = null where id = p_mesa;
  perform pozo_i_reiniciar(p_mesa, 'Cambió la lista de jugadores: vuelve a confirmar.');
  update pozo_mesas set limite = null where id = p_mesa;
end;
$$;

create or replace function pozo_i_cerrar_inscripcion(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update pozo_mesas set estado = 'confirmando', cond_version = cond_version + 1,
    limite = now() + make_interval(secs => (cartas_ajuste('pozo_confirmar_s', '90'))::text::numeric)
    where id = p_mesa and estado = 'abierta';
  perform pozo_i_tocar(p_mesa);
end;
$$;

/* ================================================================== 5) EMPEZAR */
create or replace function pozo_i_empezar(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  v_n int;
  v_primero int;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado <> 'confirmando' then return; end if;
  select count(*) into v_n from pozo_jugadores where mesa = p_mesa and activo;
  if v_n < m.min_jugadores or exists (select 1 from pozo_jugadores where mesa = p_mesa and activo and estado <> 'confirmado') then return; end if;
  -- Última comprobación: todas las aportaciones están de verdad reservadas
  if exists (select 1 from pozo_jugadores where mesa = p_mesa and activo and (dinero <> m.dinero or cardinality(cartas) <> m.cartas)) then
    perform pozo_i_error('Alguna aportación no está reservada: la partida no puede empezar.', 'reserva_incompleta');
  end if;
  select asiento into v_primero from pozo_jugadores where mesa = p_mesa and activo order by gen_random_uuid() limit 1;
  update pozo_jugadores set estado = 'activo', peso = 1, tiradas = 0, victorias = 0, faltas = 0, aviso = null where mesa = p_mesa and activo;
  update pozo_mesas set estado = 'jugando', iniciada = now(), limite = null, ronda = 1, empieza = v_primero, turno = v_primero, turno_fase = 'tirar',
    turno_limite = now() + make_interval(secs => (cartas_ajuste('pozo_turno_s', '30'))::text::numeric), paso = paso + 1 where id = p_mesa;
  perform pozo_i_tocar(p_mesa);
end;
$$;

/* ================================================================== 6) LIQUIDAR */
create or replace function pozo_i_pagar(p_mesa uuid, p_asiento int, p_monto numeric, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j pozo_jugadores%rowtype;
  m pozo_mesas%rowtype;
begin
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = p_asiento for update;
  if not found or j.pagado then return; end if;
  select * into m from pozo_mesas where id = p_mesa;
  if p_monto > 0 then perform pozo_i_abonar(j.user_id, p_monto, p_concepto || ' (mesa ' || m.codigo || ')'); end if;
  update pozo_jugadores set pagado = true, pago = p_monto, dinero = 0 where mesa = p_mesa and asiento = p_asiento;
end;
$$;

-- Mueve una carta apostada a un ganador con el sistema oficial. Si no se puede (límite del jugador, etc.) devuelve false y la carta vuelve a su dueño al desbloquear.
create or replace function pozo_i_dar_carta(p_mesa uuid, p_ejemplar uuid, p_de uuid, p_a uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cartas_i_transferir(p_ejemplar, p_a, 'pozo ganado en El Pozo del Dragón', pozo_i_ref(p_mesa, p_de), null, true);
  return true;
exception when others then
  return false;
end;
$$;

-- Termina el Duelo. p_ganador = asiento que gana todo; null = empate (cada uno recupera lo suyo)
create or replace function pozo_i_terminar_duelo(p_mesa uuid, p_ganador int, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  g pozo_jugadores%rowtype;
  p pozo_jugadores%rowtype;
  v_bote numeric;
  v_res jsonb := '[]'::jsonb;
  v_c uuid;
  v_movidas uuid[];
  v_ganadas uuid[] := '{}';
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado <> 'jugando' then return; end if;
  if p_ganador is null then
    for p in select * from pozo_jugadores where mesa = p_mesa and activo order by user_id loop
      perform pozo_i_pagar(p_mesa, p.asiento, p.dinero, 'El Pozo del Dragón: empate, apuesta devuelta');
      perform cartas_i_desbloquear(pozo_i_ref(p_mesa, p.user_id));
      v_res := v_res || jsonb_build_object('asiento', p.asiento, 'pago', p.dinero, 'neto', 0, 'cartas_ganadas', '[]'::jsonb, 'cartas_perdidas', '[]'::jsonb);
    end loop;
  else
    select * into g from pozo_jugadores where mesa = p_mesa and asiento = p_ganador;
    select coalesce(sum(dinero), 0) into v_bote from pozo_jugadores where mesa = p_mesa and activo;
    for p in select * from pozo_jugadores where mesa = p_mesa and activo and asiento <> p_ganador order by user_id loop
      -- las cartas del perdedor pasan al ganador; si alguna no se puede mover (límites), vuelve a su dueño al desbloquear
      v_movidas := '{}';
      foreach v_c in array p.cartas loop
        if pozo_i_dar_carta(p_mesa, v_c, p.user_id, g.user_id) then v_movidas := v_movidas || v_c; end if;
      end loop;
      v_ganadas := v_ganadas || v_movidas;
      perform cartas_i_desbloquear(pozo_i_ref(p_mesa, p.user_id));
      perform pozo_i_pagar(p_mesa, p.asiento, 0, 'El Pozo del Dragón: derrota');
      v_res := v_res || jsonb_build_object('asiento', p.asiento, 'pago', 0, 'neto', -p.dinero, 'cartas_perdidas', to_jsonb(v_movidas), 'cartas_ganadas', '[]'::jsonb);
    end loop;
    perform cartas_i_desbloquear(pozo_i_ref(p_mesa, g.user_id));
    perform pozo_i_pagar(p_mesa, g.asiento, v_bote, 'El Pozo del Dragón: premio del duelo');
    v_res := v_res || jsonb_build_object('asiento', g.asiento, 'pago', v_bote, 'neto', v_bote - g.dinero, 'cartas_ganadas', to_jsonb(v_ganadas), 'cartas_perdidas', '[]'::jsonb);
  end if;
  update pozo_jugadores set activo = false where mesa = p_mesa and activo;
  update pozo_mesas set estado = 'terminada', terminada = now(), motivo = p_motivo, turno = null, turno_fase = null, turno_limite = null, paso = paso + 1,
    resultado = jsonb_build_object('modo', 'duelo', 'ganador', p_ganador, 'motivo', p_motivo, 'jugadores', v_res) where id = p_mesa;
  begin perform pozo_i_logros_duelo(p_mesa, p_ganador); exception when others then null; end;
  perform pozo_i_tocar(p_mesa);
end;
$$;

-- Termina el Pozo Compartido: el pozo (las apuestas de quienes siguen en la mesa) se reparte entre los que no sufrieron Ruina en proporción a su peso.
-- Quien no llegó a tirar ni una vez ya recuperó su apuesta al salir. Si todos sufren Ruina se devuelven las apuestas.
-- Cartas: las de los eliminados forman un botín que se reparte de una en una (primero las más raras) entre los supervivientes, de mayor a menor peso; las propias vuelven a su dueño.
create or replace function pozo_i_terminar_compartido(p_mesa uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  s pozo_jugadores%rowtype;
  r pozo_jugadores%rowtype;
  b record;
  v_pozo numeric;
  v_peso numeric;
  v_suma numeric := 0;
  v_pago numeric;
  v_mayor int;
  v_n_surv int;
  v_orden int[];
  v_i int := 0;
  v_dest int;
  v_dest_uid uuid;
  v_gan jsonb := '{}'::jsonb;
  v_per jsonb := '{}'::jsonb;
  v_res jsonb := '[]'::jsonb;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado <> 'jugando' then return; end if;
  select coalesce(sum(dinero), 0) into v_pozo from pozo_jugadores where mesa = p_mesa and activo and estado in ('retirado', 'ruina');
  select count(*), coalesce(sum(peso), 0) into v_n_surv, v_peso from pozo_jugadores where mesa = p_mesa and activo and estado = 'retirado';

  if v_n_surv = 0 then
    for r in select * from pozo_jugadores where mesa = p_mesa and activo order by user_id loop
      perform pozo_i_pagar(p_mesa, r.asiento, r.dinero, 'El Pozo del Dragón: sin supervivientes, apuesta devuelta');
      perform cartas_i_desbloquear(pozo_i_ref(p_mesa, r.user_id));
    end loop;
  else
    -- Dinero: cada superviviente cobra pozo × su peso / peso total (céntimos hacia abajo); lo que sobre de los céntimos va al de mayor peso
    select asiento into v_mayor from pozo_jugadores where mesa = p_mesa and activo and estado = 'retirado' order by peso desc, asiento limit 1;
    select coalesce(sum(trunc(v_pozo * peso / v_peso, 2)), 0) into v_suma from pozo_jugadores where mesa = p_mesa and activo and estado = 'retirado';
    select coalesce(array_agg(asiento order by peso desc, asiento), '{}') into v_orden from pozo_jugadores where mesa = p_mesa and activo and estado = 'retirado';
    for s in select * from pozo_jugadores where mesa = p_mesa and activo and estado = 'retirado' order by user_id loop
      v_pago := trunc(v_pozo * s.peso / v_peso, 2) + case when s.asiento = v_mayor then v_pozo - v_suma else 0 end;
      perform pozo_i_pagar(p_mesa, s.asiento, v_pago, 'El Pozo del Dragón: premio del pozo');
    end loop;
    -- Cartas del botín
    for b in select x.c as carta, j.user_id as dueno, j.asiento as asiento_dueno
               from pozo_jugadores j cross join lateral unnest(j.cartas) as x(c)
               join cartas_ejemplares e on e.id = x.c join cartas_catalogo ct on ct.id = e.carta_id
              where j.mesa = p_mesa and j.activo and j.estado = 'ruina'
              order by cartas_categoria_valor(ct.rareza) desc, x.c loop
      v_dest := v_orden[1 + (v_i % v_n_surv)];
      select user_id into v_dest_uid from pozo_jugadores where mesa = p_mesa and asiento = v_dest;
      if pozo_i_dar_carta(p_mesa, b.carta, b.dueno, v_dest_uid) then
        v_gan := jsonb_set(v_gan, array[v_dest::text], coalesce(v_gan -> v_dest::text, '[]'::jsonb) || to_jsonb(b.carta), true);
        v_per := jsonb_set(v_per, array[b.asiento_dueno::text], coalesce(v_per -> b.asiento_dueno::text, '[]'::jsonb) || to_jsonb(b.carta), true);
      end if;
      v_i := v_i + 1;
    end loop;
    for r in select * from pozo_jugadores where mesa = p_mesa and activo order by user_id loop
      perform cartas_i_desbloquear(pozo_i_ref(p_mesa, r.user_id));
      if r.estado = 'ruina' then perform pozo_i_pagar(p_mesa, r.asiento, 0, 'El Pozo del Dragón: Ruina'); end if;
    end loop;
  end if;
  for r in select * from pozo_jugadores where mesa = p_mesa order by asiento loop
    v_res := v_res || jsonb_build_object('asiento', r.asiento, 'estado', r.estado, 'peso', r.peso, 'tiradas', r.tiradas,
      'pago', coalesce(r.pago, 0), 'neto', coalesce(r.pago, 0) - case when r.estado = 'fuera' then coalesce(r.pago, 0) else m.dinero end,
      'cartas_ganadas', coalesce(v_gan -> r.asiento::text, '[]'::jsonb), 'cartas_perdidas', coalesce(v_per -> r.asiento::text, '[]'::jsonb));
  end loop;
  update pozo_jugadores set activo = false where mesa = p_mesa and activo;
  update pozo_mesas set estado = 'terminada', terminada = now(), motivo = p_motivo, turno = null, turno_fase = null, turno_limite = null, paso = paso + 1,
    resultado = jsonb_build_object('modo', 'compartido', 'motivo', p_motivo, 'pozo', v_pozo, 'jugadores', v_res) where id = p_mesa;
  begin perform pozo_i_logros_compartido(p_mesa); exception when others then null; end;
  perform pozo_i_tocar(p_mesa);
end;
$$;

/* ================================================================== 7) JUGAR */
-- Pasa el turno al siguiente jugador activo (Compartido). Si ya no queda nadie activo, termina la mesa.
create or replace function pozo_i_siguiente(p_mesa uuid, p_desde int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  v_sig int;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  select asiento into v_sig from pozo_jugadores where mesa = p_mesa and activo and estado = 'activo' and asiento > p_desde order by asiento limit 1;
  if v_sig is null then
    select asiento into v_sig from pozo_jugadores where mesa = p_mesa and activo and estado = 'activo' order by asiento limit 1;
    if v_sig is not null then update pozo_mesas set ronda = ronda + 1 where id = p_mesa; end if;
  end if;
  if v_sig is null then perform pozo_i_terminar_compartido(p_mesa, 'Todos han cobrado o han caído'); return; end if;
  update pozo_mesas set turno = v_sig, turno_fase = 'tirar', paso = paso + 1,
    turno_limite = now() + make_interval(secs => (cartas_ajuste('pozo_turno_s', '30'))::text::numeric) where id = p_mesa;
  perform pozo_i_tocar(p_mesa);
end;
$$;

-- Un jugador sale del Pozo Compartido en pleno juego: si ya tiró al menos una vez cobra (queda con su peso); si no, sale y recupera su apuesta sin participar en el reparto
create or replace function pozo_i_retirar_compartido(p_mesa uuid, p_asiento int, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j pozo_jugadores%rowtype;
begin
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = p_asiento for update;
  if not found or j.estado <> 'activo' then return; end if;
  if j.tiradas >= 1 then
    update pozo_jugadores set estado = 'retirado', aviso = p_motivo where mesa = p_mesa and asiento = p_asiento;
  else
    perform pozo_i_devolver(p_mesa, p_asiento, 'El Pozo del Dragón: sales sin tirar, apuesta devuelta');
    update pozo_jugadores set estado = 'fuera', aviso = p_motivo, pagado = true, pago = j.dinero, activo = false where mesa = p_mesa and asiento = p_asiento;
  end if;
  perform pozo_i_tocar(p_mesa);
end;
$$;

-- Resuelve una ronda del Duelo cuando los dos ya tiraron
create or replace function pozo_i_resolver_ronda(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  t record;
  v_fuerza int[] := '{}';
  v_asientos int[] := '{}';
  v_ganador int;
  v_gana int := (cartas_ajuste('pozo_duelo_victorias', '2'))::text::int;
  v_max int := (cartas_ajuste('pozo_duelo_rondas', '5'))::text::int;
  v_otro int;
  v_a pozo_jugadores%rowtype;
  v_b pozo_jugadores%rowtype;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  for t in select asiento, pozo_i_fuerza(d1, d2, d3) as f from pozo_tiradas where mesa = p_mesa and ronda = m.ronda order by id loop
    v_asientos := v_asientos || t.asiento; v_fuerza := v_fuerza || t.f;
  end loop;
  if v_fuerza[1] > v_fuerza[2] then v_ganador := v_asientos[1];
  elsif v_fuerza[2] > v_fuerza[1] then v_ganador := v_asientos[2];
  else v_ganador := null; end if;
  insert into pozo_rondas (mesa, ronda, ganador) values (p_mesa, m.ronda, v_ganador) on conflict do nothing;
  if v_ganador is not null then update pozo_jugadores set victorias = victorias + 1 where mesa = p_mesa and asiento = v_ganador; end if;
  select * into v_a from pozo_jugadores where mesa = p_mesa and activo order by asiento limit 1;
  select * into v_b from pozo_jugadores where mesa = p_mesa and activo order by asiento desc limit 1;
  if v_a.victorias >= v_gana then perform pozo_i_terminar_duelo(p_mesa, v_a.asiento, 'Ganó ' || v_gana || ' rondas'); return; end if;
  if v_b.victorias >= v_gana then perform pozo_i_terminar_duelo(p_mesa, v_b.asiento, 'Ganó ' || v_gana || ' rondas'); return; end if;
  if m.ronda >= v_max then
    -- Límite de rondas: gana quien tenga más rondas ganadas; si están igualados, empate y cada uno recupera lo suyo
    if v_a.victorias > v_b.victorias then perform pozo_i_terminar_duelo(p_mesa, v_a.asiento, 'Más rondas ganadas al llegar al límite');
    elsif v_b.victorias > v_a.victorias then perform pozo_i_terminar_duelo(p_mesa, v_b.asiento, 'Más rondas ganadas al llegar al límite');
    else perform pozo_i_terminar_duelo(p_mesa, null, 'Empate al llegar al límite de rondas'); end if;
    return;
  end if;
  -- siguiente ronda: abre el otro jugador
  v_otro := case when m.empieza = v_a.asiento then v_b.asiento else v_a.asiento end;
  update pozo_mesas set ronda = ronda + 1, empieza = v_otro, turno = v_otro, turno_fase = 'tirar', paso = paso + 1,
    turno_limite = now() + make_interval(secs => (cartas_ajuste('pozo_turno_s', '30'))::text::numeric) where id = p_mesa;
  perform pozo_i_tocar(p_mesa);
end;
$$;

-- Una tirada del jugador al que le toca. p_dados null = los saca el servidor (las pruebas pasan los suyos). p_auto: la tira el servidor por falta de tiempo.
create or replace function pozo_i_tirar(p_mesa uuid, p_asiento int, p_dados int[] default null, p_auto boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  j pozo_jugadores%rowtype;
  d int[];
  v_cat text;
  v_n int;
  v_en_ronda int;
  v_otro int;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = p_asiento for update;
  if m.estado <> 'jugando' or m.turno is distinct from p_asiento or m.turno_fase is distinct from 'tirar' or j.estado <> 'activo' then
    perform pozo_i_error('Ahora no te toca tirar.', 'fuera_de_turno');
  end if;
  d := coalesce(p_dados, array[pozo_i_dado(), pozo_i_dado(), pozo_i_dado()]::int[]);
  v_cat := pozo_i_clasificar(d[1], d[2], d[3]);
  v_n := j.tiradas + 1;
  insert into pozo_tiradas (mesa, asiento, ronda, n, d1, d2, d3, categoria, auto) values (p_mesa, p_asiento, m.ronda, v_n, d[1], d[2], d[3], v_cat, p_auto);
  update pozo_jugadores set tiradas = v_n, faltas = case when p_auto then faltas else 0 end where mesa = p_mesa and asiento = p_asiento;

  if m.modo = 'duelo' then
    select count(*) into v_en_ronda from pozo_tiradas where mesa = p_mesa and ronda = m.ronda;
    if v_en_ronda < 2 then
      select asiento into v_otro from pozo_jugadores where mesa = p_mesa and activo and asiento <> p_asiento;
      update pozo_mesas set turno = v_otro, turno_fase = 'tirar', paso = paso + 1,
        turno_limite = now() + make_interval(secs => (cartas_ajuste('pozo_turno_s', '30'))::text::numeric) where id = p_mesa;
      perform pozo_i_tocar(p_mesa);
    else
      perform pozo_i_resolver_ronda(p_mesa);
    end if;
    return;
  end if;

  -- Pozo Compartido
  if v_cat = 'ruina' then
    update pozo_jugadores set estado = 'ruina', peso = 0 where mesa = p_mesa and asiento = p_asiento;
    perform pozo_i_siguiente(p_mesa, p_asiento);
  else
    update pozo_jugadores set peso = peso + pozo_i_bono(v_cat) where mesa = p_mesa and asiento = p_asiento;
    if v_n >= (cartas_ajuste('pozo_tiradas_max', '5'))::text::int then
      update pozo_jugadores set estado = 'retirado', aviso = 'Llegaste a la última tirada sin Ruina: cobras.' where mesa = p_mesa and asiento = p_asiento;
      perform pozo_i_siguiente(p_mesa, p_asiento);
    else
      update pozo_mesas set turno_fase = 'decidir', paso = paso + 1,
        turno_limite = now() + make_interval(secs => (cartas_ajuste('pozo_turno_s', '30'))::text::numeric) where id = p_mesa;
      perform pozo_i_tocar(p_mesa);
    end if;
  end if;
end;
$$;

-- Después de una tirada sin Ruina: cobrar (te quedas con el peso que llevas) o continuar (pasa el turno; tirarás otra vez en tu próximo turno)
create or replace function pozo_i_decidir(p_mesa uuid, p_asiento int, p_cobrar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado <> 'jugando' or m.modo <> 'compartido' or m.turno is distinct from p_asiento or m.turno_fase is distinct from 'decidir' then
    perform pozo_i_error('Ahora no puedes decidir.', 'fuera_de_turno');
  end if;
  if p_cobrar then update pozo_jugadores set estado = 'retirado' where mesa = p_mesa and asiento = p_asiento; end if;
  perform pozo_i_siguiente(p_mesa, p_asiento);
end;
$$;

-- Lo que pasa cuando se acaba el tiempo del turno actual
create or replace function pozo_i_turno_vencido(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  j pozo_jugadores%rowtype;
  v_faltas_max int := (cartas_ajuste('pozo_duelo_faltas', '2'))::text::int;
  v_otro int;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if m.estado <> 'jugando' or m.turno is null then return; end if;
  select * into j from pozo_jugadores where mesa = p_mesa and asiento = m.turno for update;
  if m.modo = 'duelo' then
    update pozo_jugadores set faltas = faltas + 1 where mesa = p_mesa and asiento = m.turno returning * into j;
    if j.faltas > v_faltas_max then
      select asiento into v_otro from pozo_jugadores where mesa = p_mesa and activo and asiento <> m.turno;
      perform pozo_i_terminar_duelo(p_mesa, v_otro, 'Abandono: demasiados turnos sin jugar');
    else
      perform pozo_i_tirar(p_mesa, m.turno, null, true);
    end if;
    return;
  end if;
  -- Compartido: retirada automática segura
  perform pozo_i_retirar_compartido(p_mesa, m.turno, 'Se acabó el tiempo: te retiraste solo.');
  perform pozo_i_siguiente(p_mesa, m.turno);
end;
$$;

/* ================================================================== 8) AVANZAR: plazos, ausencias y salas que no empiezan */
-- Quien llama ya tiene el candado de la mesa
create or replace function pozo_i_avanzar(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  j record;
  v_inact numeric := (cartas_ajuste('pozo_inactividad_s', '120'))::text::numeric;
  v_aband numeric := (cartas_ajuste('pozo_abandono_s', '300'))::text::numeric;
  v_vuelta int := 0;
  v_ausentes boolean;
  v_resto int;
begin
  select * into m from pozo_mesas where id = p_mesa for update;
  if not found or m.estado in ('terminada', 'cancelada') then return; end if;

  if m.estado in ('abierta', 'confirmando') then
    for j in select asiento from pozo_jugadores where mesa = p_mesa and activo and ultima_senal < now() - make_interval(secs => v_inact) order by asiento loop
      perform pozo_i_quitar(p_mesa, j.asiento, 'Saliste de la sala por inactividad.');
    end loop;
    select * into m from pozo_mesas where id = p_mesa;
    if m.estado in ('terminada', 'cancelada') then return; end if;
    if m.estado = 'abierta' and m.vence < now() then perform pozo_i_cancelar(p_mesa, 'La sala venció sin llegar a empezar.'); return; end if;
    if m.estado = 'confirmando' and m.limite is not null and m.limite < now() then
      -- se acabó el tiempo de confirmar: salen los que no confirmaron y, si cambia la lista, se confirma de nuevo
      for j in select asiento from pozo_jugadores where mesa = p_mesa and activo and estado <> 'confirmado' order by asiento loop
        perform pozo_i_quitar(p_mesa, j.asiento, 'No confirmaste a tiempo.');
      end loop;
      select * into m from pozo_mesas where id = p_mesa;
      if m.estado = 'abierta' then
        select count(*) into v_resto from pozo_jugadores where mesa = p_mesa and activo;
        if v_resto >= m.min_jugadores then perform pozo_i_cerrar_inscripcion(p_mesa); end if;
      end if;
    end if;
    return;
  end if;

  if m.estado = 'jugando' then
    select not exists (select 1 from pozo_jugadores where mesa = p_mesa and activo and ultima_senal >= now() - make_interval(secs => v_aband)) into v_ausentes;
    if v_ausentes then
      -- Nadie da señales: la mesa se resuelve sola. El Duelo queda en empate (cada uno recupera lo suyo); en el Compartido todos se retiran.
      if m.modo = 'duelo' then perform pozo_i_terminar_duelo(p_mesa, null, 'Mesa abandonada: ninguno de los dos dio señales.'); return; end if;
      for j in select asiento from pozo_jugadores where mesa = p_mesa and activo and estado = 'activo' order by asiento loop
        perform pozo_i_retirar_compartido(p_mesa, j.asiento, 'Mesa abandonada: te retiraste solo.');
      end loop;
      perform pozo_i_terminar_compartido(p_mesa, 'Mesa abandonada');
      return;
    end if;
    while v_vuelta < 50 loop
      select * into m from pozo_mesas where id = p_mesa;
      exit when m.estado <> 'jugando' or m.turno_limite is null or m.turno_limite >= now();
      perform pozo_i_turno_vencido(p_mesa);
      v_vuelta := v_vuelta + 1;
    end loop;
  end if;
end;
$$;

/* ================================================================== 9) LO QUE VE CADA JUGADOR */
create or replace function pozo_i_json(p_mesa uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
  v_js jsonb;
  v_pozo numeric;
  v_peso numeric;
  v_rondas jsonb;
  v_bonos jsonb;
begin
  select * into m from pozo_mesas where id = p_mesa;
  select * into y from pozo_jugadores where mesa = p_mesa and user_id = p_uid;
  select coalesce(sum(dinero), 0) into v_pozo from pozo_jugadores where mesa = p_mesa and estado in ('confirmado', 'activo', 'retirado', 'ruina');
  select coalesce(sum(peso), 0) into v_peso from pozo_jugadores where mesa = p_mesa and estado in ('activo', 'retirado');
  select coalesce(jsonb_agg(jsonb_build_object(
      'asiento', j.asiento, 'nombre', j.nombre, 'estado', j.estado, 'yo', j.user_id = p_uid,
      'oferta', cartas_i_info_apuesta(case when cardinality(j.cartas) > 0 then j.cartas else j.oferta end),
      'oferta_completa', cardinality(j.oferta) = m.cartas,
      'tiradas', j.tiradas, 'peso', j.peso, 'victorias', j.victorias, 'faltas', j.faltas, 'activo', j.activo,
      'parte', case when m.modo = 'compartido' and j.estado in ('activo', 'retirado') and v_peso > 0 then trunc(v_pozo * j.peso / v_peso, 2) end,
      'aviso', case when j.user_id = p_uid then j.aviso end,
      'pago', j.pago,
      'ultima', (select jsonb_build_object('dados', jsonb_build_array(t.d1, t.d2, t.d3), 'categoria', t.categoria, 'ronda', t.ronda, 'n', t.n, 'auto', t.auto, 'id', t.id)
                   from pozo_tiradas t where t.mesa = p_mesa and t.asiento = j.asiento order by t.id desc limit 1)
    ) order by j.asiento), '[]'::jsonb) into v_js
    from pozo_jugadores j where j.mesa = p_mesa;
  select coalesce(jsonb_agg(jsonb_build_object('ronda', r.ronda, 'ganador', r.ganador,
      'dados', (select jsonb_object_agg(t.asiento::text, jsonb_build_array(t.d1, t.d2, t.d3)) from pozo_tiradas t where t.mesa = p_mesa and t.ronda = r.ronda)) order by r.ronda), '[]'::jsonb)
    into v_rondas from pozo_rondas r where r.mesa = p_mesa;
  v_bonos := jsonb_build_object('pareja', pozo_i_bono('pareja'), 'escalera', pozo_i_bono('escalera'), 'triple', pozo_i_bono('triple'), 'triple_seis', pozo_i_bono('triple_seis'));
  return jsonb_build_object(
    'codigo', m.codigo, 'nombre', m.nombre, 'modo', m.modo, 'privada', m.privada, 'estado', m.estado, 'version', m.version, 'paso', m.paso,
    'cond_version', m.cond_version, 'ronda', m.ronda, 'creador', m.creador = p_uid, 'motivo', m.motivo,
    'reglas', jsonb_build_object('dinero', m.dinero, 'cartas', m.cartas, 'min', m.min_jugadores, 'max', m.max_jugadores,
      'tiradas_max', (cartas_ajuste('pozo_tiradas_max', '5'))::text::int, 'turno_s', (cartas_ajuste('pozo_turno_s', '30'))::text::int,
      'victorias', (cartas_ajuste('pozo_duelo_victorias', '2'))::text::int, 'rondas_max', (cartas_ajuste('pozo_duelo_rondas', '5'))::text::int,
      'faltas', (cartas_ajuste('pozo_duelo_faltas', '2'))::text::int, 'bonos', v_bonos, 'cambios_max', (cartas_ajuste('pozo_cambios_max', '6'))::text::int),
    'cambios', m.cambios,
    'turno', case when m.estado = 'jugando' then jsonb_build_object('asiento', m.turno, 'fase', m.turno_fase,
        'restante_s', case when m.turno_limite is null then null else round(greatest(0, extract(epoch from (m.turno_limite - now())))) end) end,
    'restante_s', case when m.estado = 'confirmando' and m.limite is not null then round(greatest(0, extract(epoch from (m.limite - now()))))
                       when m.estado = 'abierta' then round(greatest(0, extract(epoch from (m.vence - now())))) end,
    'pozo', jsonb_build_object('dinero', v_pozo, 'peso', v_peso),
    'jugadores', v_js, 'rondas', v_rondas, 'resultado', m.resultado,
    'yo', case when y.mesa is null then null else jsonb_build_object('asiento', y.asiento, 'estado', y.estado, 'saldo', pozo_i_saldo(p_uid),
        'tu_turno', m.estado = 'jugando' and m.turno = y.asiento and y.estado = 'activo',
        'oferta_completa', cardinality(y.oferta) = m.cartas, 'aviso', y.aviso, 'peso', y.peso) end
  );
end;
$$;

/* ================================================================== 10) LO QUE LLAMA EL NAVEGADOR */
-- La mesa de ese jugador: la que tiene abierta o la última terminada que aún no cerró (durante diez minutos)
create or replace function pozo_i_mesa_de(p_uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select j.mesa from pozo_jugadores j join pozo_mesas m on m.id = j.mesa
   where j.user_id = p_uid and (j.activo or (not j.descartada and m.estado in ('terminada', 'cancelada') and m.terminada > now() - interval '10 minutes'))
   order by j.activo desc, j.creado desc limit 1
$$;

create or replace function pozo_lista()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f record;
  r jsonb;
begin
  perform pozo_i_acceso();
  -- limpieza: salas vencidas, plazos y mesas abandonadas se resuelven aquí aunque nadie las esté mirando (cada mesa bajo su candado)
  for f in select id from pozo_mesas where estado in ('abierta', 'confirmando', 'jugando')
             and (vence < now() or (limite is not null and limite < now()) or (turno_limite is not null and turno_limite < now())
                  or exists (select 1 from pozo_jugadores j where j.mesa = pozo_mesas.id and j.activo and j.ultima_senal < now() - interval '60 seconds')) loop
    if pg_try_advisory_xact_lock(hashtextextended('pozo_mesa_' || f.id::text, 0)) then perform pozo_i_avanzar(f.id); end if;
  end loop;
  delete from pozo_mesas where estado in ('terminada', 'cancelada') and terminada < now() - interval '7 days';
  select coalesce(jsonb_agg(jsonb_build_object('codigo', m.codigo, 'nombre', m.nombre, 'modo', m.modo, 'dinero', m.dinero, 'cartas', m.cartas, 'max', m.max_jugadores,
      'jugadores', (select coalesce(jsonb_agg(j.nombre order by j.asiento), '[]'::jsonb) from pozo_jugadores j where j.mesa = m.id and j.activo)) order by m.creada desc), '[]'::jsonb)
    into r from pozo_mesas m where m.estado = 'abierta' and not m.privada and exists (select 1 from pozo_jugadores j where j.mesa = m.id and j.activo);
  return jsonb_build_object('mesas', r, 'mia', pozo_i_mesa_de(uid) is not null, 'saldo', pozo_i_saldo(uid), 'solo', pozo_i_solo_reglas(),
    'ajustes', jsonb_build_object('apuesta_min', (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric, 'apuesta_paso', (cartas_ajuste('pozo_apuesta_paso', '10'))::text::numeric,
      'apuesta_max', (cartas_ajuste('pozo_apuesta_max', '0'))::text::numeric, 'cartas_max', (cartas_ajuste('pozo_cartas_max', '3'))::text::int,
      'min_compartido', 2, 'max_compartido', 6));
end;
$$;

create or replace function pozo_crear(p_modo text, p_privada boolean, p_nombre text, p_dinero numeric, p_cartas int, p_max int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  min_a numeric := (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric;
  max_a numeric := (cartas_ajuste('pozo_apuesta_max', '0'))::text::numeric;
  paso_a numeric := (cartas_ajuste('pozo_apuesta_paso', '10'))::text::numeric;
  cartas_max int := (cartas_ajuste('pozo_cartas_max', '3'))::text::int;
  v_dinero numeric := coalesce(p_dinero, 0);
  v_cartas int := coalesce(p_cartas, 0);
  v_max int;
  v_nombre text;
  v_id uuid;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if p_modo not in ('duelo', 'compartido') then perform pozo_i_error('Esa modalidad no existe.', 'peticion_invalida'); end if;
  if exists (select 1 from pozo_jugadores where user_id = uid and activo) then perform pozo_i_error('Ya estás en una mesa. Sal de ella antes de crear otra.', 'ya_en_mesa'); end if;
  if exists (select 1 from pozo_solo where user_id = uid and estado = 'en_curso') then perform pozo_i_error('Tienes una partida en solitario en curso. Termínala antes de sentarte a una mesa.', 'solo_en_curso'); end if;
  if v_dinero < 0 or (v_dinero > 0 and (v_dinero < min_a or (max_a > 0 and v_dinero > max_a))) then
    perform pozo_i_error(case when max_a > 0 then 'La apuesta va de ' || min_a || ' a ' || max_a || ' tokens.' else 'La apuesta mínima es de ' || min_a || ' tokens.' end, 'apuesta_invalida');
  end if;
  if v_dinero > 0 and v_dinero <> trunc(v_dinero / paso_a) * paso_a then perform pozo_i_error('La apuesta tiene que ser múltiplo de ' || paso_a || '.', 'apuesta_invalida'); end if;
  if v_cartas < 0 or v_cartas > cartas_max then perform pozo_i_error('Cada jugador puede poner de 0 a ' || cartas_max || ' cartas.', 'apuesta_invalida'); end if;
  if v_dinero = 0 and v_cartas = 0 then perform pozo_i_error('Hay que apostar dinero, cartas o las dos cosas.', 'apuesta_invalida'); end if;
  if v_dinero > pozo_i_saldo(uid) then perform pozo_i_error('No tienes tantos tokens: te faltan ' || trim_scale(v_dinero - pozo_i_saldo(uid)) || '.', 'saldo_insuficiente'); end if;
  v_max := case when p_modo = 'duelo' then 2 else coalesce(p_max, 4) end;
  if v_max < 2 or v_max > 6 then perform pozo_i_error('Una mesa es de 2 a 6 jugadores.', 'peticion_invalida'); end if;
  v_nombre := nullif(left(trim(coalesce(p_nombre, '')), 30), '');
  if v_nombre is null then v_nombre := case when p_modo = 'duelo' then 'Duelo de ' else 'Pozo de ' end || pozo_i_nombre(uid); end if;
  insert into pozo_mesas (codigo, modo, nombre, privada, creador, dinero, cartas, min_jugadores, max_jugadores, vence)
    values (pozo_i_codigo(), p_modo, v_nombre, coalesce(p_privada, true), uid, v_dinero, v_cartas, 2, v_max,
            now() + make_interval(mins => (cartas_ajuste('pozo_sala_min', '30'))::text::int))
    returning id into v_id;
  insert into pozo_jugadores (mesa, asiento, user_id, nombre) values (v_id, 0, uid, pozo_i_nombre(uid));
  return pozo_i_json(v_id, uid);
end;
$$;

create or replace function pozo_unirse(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  m pozo_mesas%rowtype;
  v_id uuid;
  v_n int;
  v_asiento int;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  select id into v_id from pozo_mesas where codigo = upper(trim(coalesce(p_codigo, '')));
  if v_id is null then perform pozo_i_error('No hay ninguna mesa con ese código.', 'mesa_no_existe'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  perform pozo_i_avanzar(v_id);
  select * into m from pozo_mesas where id = v_id;
  if exists (select 1 from pozo_jugadores where mesa = v_id and user_id = uid and activo) then return pozo_i_json(v_id, uid); end if;
  if exists (select 1 from pozo_jugadores where user_id = uid and activo) then perform pozo_i_error('Ya estás en otra mesa. Sal de ella antes de entrar en esta.', 'ya_en_mesa'); end if;
  if exists (select 1 from pozo_solo where user_id = uid and estado = 'en_curso') then perform pozo_i_error('Tienes una partida en solitario en curso. Termínala antes de sentarte a una mesa.', 'solo_en_curso'); end if;
  if m.estado <> 'abierta' then perform pozo_i_error('Esa mesa ya no admite jugadores.', 'mesa_cerrada'); end if;
  select count(*) into v_n from pozo_jugadores where mesa = v_id and activo;
  if v_n >= m.max_jugadores then perform pozo_i_error('La mesa está llena.', 'mesa_llena'); end if;
  if m.dinero > pozo_i_saldo(uid) then perform pozo_i_error('No tienes tantos tokens para esta mesa: te faltan ' || trim_scale(m.dinero - pozo_i_saldo(uid)) || '.', 'saldo_insuficiente'); end if;
  select min(s) into v_asiento from generate_series(0, m.max_jugadores - 1) s where not exists (select 1 from pozo_jugadores where mesa = v_id and asiento = s);
  insert into pozo_jugadores (mesa, asiento, user_id, nombre) values (v_id, v_asiento, uid, pozo_i_nombre(uid));
  v_n := v_n + 1;
  perform pozo_i_tocar(v_id);
  -- Con el cupo lleno se cierra la inscripción; el Duelo se cierra con los dos
  if v_n >= m.max_jugadores then perform pozo_i_cerrar_inscripcion(v_id); end if;
  return pozo_i_json(v_id, uid);
end;
$$;

create or replace function pozo_cerrar_inscripcion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  v_n int;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then perform pozo_i_error('No estás en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  perform pozo_i_avanzar(v_id);
  select * into m from pozo_mesas where id = v_id;
  if m.creador <> uid then perform pozo_i_error('Solo quien creó la mesa puede cerrar la inscripción.', 'no_eres_creador'); end if;
  if m.estado <> 'abierta' then perform pozo_i_error('La inscripción ya está cerrada.', 'fase_invalida'); end if;
  select count(*) into v_n from pozo_jugadores where mesa = v_id and activo;
  if v_n < m.min_jugadores then perform pozo_i_error('Hacen falta al menos ' || m.min_jugadores || ' jugadores.', 'faltan_jugadores'); end if;
  perform pozo_i_cerrar_inscripcion(v_id);
  return pozo_i_json(v_id, uid);
end;
$$;

create or replace function pozo_ofrecer(p_cartas uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
  v_problema text;
  v_cartas uuid[] := coalesce(p_cartas, '{}');
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then perform pozo_i_error('No estás en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  perform pozo_i_avanzar(v_id);
  select * into m from pozo_mesas where id = v_id;
  select * into y from pozo_jugadores where mesa = v_id and user_id = uid and activo;
  if not found then return pozo_i_json(v_id, uid); end if;
  if m.estado not in ('abierta', 'confirmando') then perform pozo_i_error('Ya no se pueden cambiar las cartas.', 'fase_invalida'); end if;
  if m.cartas = 0 then perform pozo_i_error('Esta mesa no se juega con cartas.', 'sin_cartas'); end if;
  if cardinality(v_cartas) <> m.cartas then perform pozo_i_error('En esta mesa cada jugador pone ' || m.cartas || ' carta' || case when m.cartas = 1 then '' else 's' end || '.', 'cartas_invalidas'); end if;
  if y.estado = 'confirmado' then perform pozo_i_error('Retira primero tu confirmación para cambiar las cartas.', 'confirmado'); end if;
  if y.oferta = v_cartas then return pozo_i_json(v_id, uid); end if;
  if m.cambios >= (cartas_ajuste('pozo_cambios_max', '6'))::text::int then perform pozo_i_error('Ya se cambiaron demasiadas veces las cartas en esta mesa.', 'demasiados_cambios'); end if;
  v_problema := cartas_i_error_apuesta(uid, v_cartas);
  if v_problema is not null then perform pozo_i_error(v_problema, 'carta_invalida'); end if;
  update pozo_jugadores set oferta = v_cartas, aviso = null where mesa = v_id and asiento = y.asiento;
  update pozo_mesas set cambios = cambios + 1 where id = v_id;
  perform pozo_i_reiniciar(v_id, 'Cambiaron las cartas de la mesa: vuelve a confirmar.');
  return pozo_i_json(v_id, uid);
end;
$$;

-- Confirma las condiciones tal como las ve el jugador (p_cond = la versión de las condiciones que enseñaba su pantalla) y reserva su aportación de forma atómica
create or replace function pozo_confirmar(p_cond int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
  v_n int;
  v_problema text;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then perform pozo_i_error('No estás en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  perform pozo_i_avanzar(v_id);
  select * into m from pozo_mesas where id = v_id;
  select * into y from pozo_jugadores where mesa = v_id and user_id = uid and activo;
  if not found then return pozo_i_json(v_id, uid); end if;
  if y.estado in ('confirmado', 'activo', 'retirado', 'ruina') then return pozo_i_json(v_id, uid) || jsonb_build_object('repetida', true); end if;
  if m.estado <> 'confirmando' then perform pozo_i_error('Todavía no se puede confirmar: la inscripción sigue abierta.', 'fase_invalida'); end if;
  if p_cond is distinct from m.cond_version then perform pozo_i_error('Las condiciones de la mesa cambiaron. Revísalas y vuelve a confirmar.', 'condiciones_cambiadas'); end if;
  select count(*) into v_n from pozo_jugadores where mesa = v_id and activo;
  if v_n < m.min_jugadores then perform pozo_i_error('Faltan jugadores.', 'faltan_jugadores'); end if;
  if exists (select 1 from pozo_jugadores where mesa = v_id and activo and cardinality(oferta) <> m.cartas) then
    perform pozo_i_error('Todavía faltan cartas por ofrecer: ' || (select string_agg(nombre, ', ') from pozo_jugadores where mesa = v_id and activo and cardinality(oferta) <> m.cartas) || '.', 'faltan_ofertas');
  end if;
  -- Reserva atómica: si algo falla (saldo, carta ya usada) se deshace todo
  if m.cartas > 0 then
    v_problema := cartas_i_error_apuesta(uid, y.oferta);
    if v_problema is not null then perform pozo_i_error(v_problema, 'carta_invalida'); end if;
  end if;
  if m.dinero > 0 then perform pozo_i_debitar(uid, m.dinero, 'El Pozo del Dragón: apuesta (mesa ' || m.codigo || ')'); end if;
  if m.cartas > 0 then perform cartas_i_bloquear(y.oferta, 'Pozo del Dragón', pozo_i_ref(v_id, uid), null); end if;
  update pozo_jugadores set estado = 'confirmado', dinero = m.dinero, cartas = case when m.cartas > 0 then y.oferta else '{}' end, aviso = null where mesa = v_id and asiento = y.asiento;
  perform pozo_i_tocar(v_id);
  if not exists (select 1 from pozo_jugadores where mesa = v_id and activo and estado <> 'confirmado') then perform pozo_i_empezar(v_id); end if;
  return pozo_i_json(v_id, uid);
end;
$$;

create or replace function pozo_retirar_confirmacion()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then perform pozo_i_error('No estás en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  select * into m from pozo_mesas where id = v_id;
  select * into y from pozo_jugadores where mesa = v_id and user_id = uid and activo;
  if m.estado <> 'confirmando' or y.estado <> 'confirmado' then return pozo_i_json(v_id, uid); end if;
  perform pozo_i_devolver(v_id, y.asiento, 'El Pozo del Dragón: apuesta devuelta, retiraste tu confirmación');
  update pozo_jugadores set estado = 'esperando' where mesa = v_id and asiento = y.asiento;
  perform pozo_i_tocar(v_id);
  return pozo_i_json(v_id, uid);
end;
$$;

-- Salir de la mesa. Antes de empezar: sales y recuperas lo reservado. En pleno Duelo es abandonar (pierdes). En el Compartido: te retiras (cobras con tu peso si ya tiraste; si no, recuperas tu apuesta sin participar en el reparto).
-- Con la mesa terminada o cancelada, solo cierras el resultado.
create or replace function pozo_salir()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
  v_otro int;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then return jsonb_build_object('sin_mesa', true); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  select * into m from pozo_mesas where id = v_id;
  select * into y from pozo_jugadores where mesa = v_id and user_id = uid;
  if m.estado in ('terminada', 'cancelada') then
    update pozo_jugadores set descartada = true, activo = false where mesa = v_id and user_id = uid;
    return jsonb_build_object('sin_mesa', true);
  end if;
  if m.estado in ('abierta', 'confirmando') then
    perform pozo_i_quitar(v_id, y.asiento, 'Saliste de la mesa.');
  elsif m.modo = 'duelo' then
    select asiento into v_otro from pozo_jugadores where mesa = v_id and activo and asiento <> y.asiento;
    perform pozo_i_terminar_duelo(v_id, v_otro, 'Abandono');
    update pozo_jugadores set descartada = true where mesa = v_id and user_id = uid;
  else
    if y.estado = 'activo' then
      perform pozo_i_retirar_compartido(v_id, y.asiento, 'Saliste de la mesa.');
      if m.turno = y.asiento then perform pozo_i_siguiente(v_id, y.asiento);
      elsif not exists (select 1 from pozo_jugadores where mesa = v_id and activo and estado = 'activo') then perform pozo_i_terminar_compartido(v_id, 'Todos han cobrado o han caído'); end if;
    end if;
    update pozo_jugadores set descartada = true where mesa = v_id and user_id = uid;
  end if;
  return jsonb_build_object('sin_mesa', true);
end;
$$;

-- Las acciones de turno llevan el paso de la mesa que veía el jugador: si ya no coincide, la acción ya se aplicó (o la mesa cambió) y se devuelve el estado sin aplicarla otra vez
create or replace function pozo_i_accion(p_paso int, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid := pozo_i_mesa_de(auth.uid());
  m pozo_mesas%rowtype;
  y pozo_jugadores%rowtype;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if v_id is null then perform pozo_i_error('No estás en ninguna mesa.', 'sin_mesa'); end if;
  perform pg_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0));
  perform pozo_i_avanzar(v_id);
  select * into m from pozo_mesas where id = v_id;
  select * into y from pozo_jugadores where mesa = v_id and user_id = uid;
  update pozo_jugadores set ultima_senal = now() where mesa = v_id and user_id = uid;
  if m.estado <> 'jugando' or p_paso < m.paso then return pozo_i_json(v_id, uid) || jsonb_build_object('repetida', true); end if;
  if p_paso > m.paso then perform pozo_i_error('La mesa y tu pantalla no coinciden. Recarga la mesa.', 'paso_futuro'); end if;
  if m.turno is distinct from y.asiento then perform pozo_i_error('No es tu turno.', 'fuera_de_turno'); end if;
  if p_accion = 'tirar' then perform pozo_i_tirar(v_id, y.asiento, null, false);
  elsif p_accion = 'cobrar' then perform pozo_i_decidir(v_id, y.asiento, true);
  elsif p_accion = 'continuar' then perform pozo_i_decidir(v_id, y.asiento, false);
  else perform pozo_i_error('Esa acción no existe.', 'accion_invalida'); end if;
  return pozo_i_json(v_id, uid);
end;
$$;
create or replace function pozo_tirar(p_paso int) returns jsonb language sql security definer set search_path = public as $$ select pozo_i_accion(p_paso, 'tirar') $$;
create or replace function pozo_cobrar(p_paso int) returns jsonb language sql security definer set search_path = public as $$ select pozo_i_accion(p_paso, 'cobrar') $$;
create or replace function pozo_continuar(p_paso int) returns jsonb language sql security definer set search_path = public as $$ select pozo_i_accion(p_paso, 'continuar') $$;

create or replace function pozo_estado(p_version bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  m pozo_mesas%rowtype;
  v_toca boolean;
begin
  perform pozo_i_acceso();
  v_id := pozo_i_mesa_de(uid);
  if v_id is null then return jsonb_build_object('sin_mesa', true, 'saldo', pozo_i_saldo(uid)); end if;
  update pozo_jugadores set ultima_senal = now() where mesa = v_id and user_id = uid and ultima_senal < now() - interval '4 seconds';
  select * into m from pozo_mesas where id = v_id;
  v_toca := m.estado in ('abierta', 'confirmando', 'jugando') and (m.vence < now() or (m.limite is not null and m.limite < now()) or (m.turno_limite is not null and m.turno_limite < now())
            or exists (select 1 from pozo_jugadores j where j.mesa = v_id and j.activo and j.ultima_senal < now() - interval '60 seconds'));
  if v_toca and pg_try_advisory_xact_lock(hashtextextended('pozo_mesa_' || v_id::text, 0)) then
    perform pozo_i_avanzar(v_id);
    select * into m from pozo_mesas where id = v_id;
  end if;
  if p_version is not null and p_version = m.version then
    return jsonb_build_object('sin_cambios', true, 'version', m.version,
      'restante_s', case when m.estado = 'jugando' and m.turno_limite is not null then round(greatest(0, extract(epoch from (m.turno_limite - now()))))
                         when m.estado = 'confirmando' and m.limite is not null then round(greatest(0, extract(epoch from (m.limite - now())))) end);
  end if;
  return pozo_i_json(v_id, uid);
end;
$$;

create or replace function pozo_mis_cartas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform pozo_i_acceso();
  return cartas_i_info_apuesta(array(select id from cartas_ejemplares where propietario = uid and estado = 'poseida' limit 300));
end;
$$;

/* ================================================================== 11) PERMISOS */
revoke all on function pozo_i_error(text, text), pozo_i_azar(int), pozo_i_dado(), pozo_i_clasificar(int, int, int), pozo_i_bono(text), pozo_i_fuerza(int, int, int),
  pozo_i_nombre(uuid), pozo_i_codigo(), pozo_i_tocar(uuid), pozo_i_acceso(), pozo_i_saldo(uuid), pozo_i_debitar(uuid, numeric, text), pozo_i_abonar(uuid, numeric, text),
  pozo_i_ref(uuid, uuid), pozo_i_devolver(uuid, int, text), pozo_i_reiniciar(uuid, text), pozo_i_cancelar(uuid, text), pozo_i_quitar(uuid, int, text), pozo_i_cerrar_inscripcion(uuid),
  pozo_i_empezar(uuid), pozo_i_pagar(uuid, int, numeric, text), pozo_i_dar_carta(uuid, uuid, uuid, uuid), pozo_i_terminar_duelo(uuid, int, text), pozo_i_terminar_compartido(uuid, text),
  pozo_i_siguiente(uuid, int), pozo_i_retirar_compartido(uuid, int, text), pozo_i_resolver_ronda(uuid), pozo_i_tirar(uuid, int, int[], boolean), pozo_i_decidir(uuid, int, boolean),
  pozo_i_turno_vencido(uuid), pozo_i_avanzar(uuid), pozo_i_json(uuid, uuid), pozo_i_mesa_de(uuid), pozo_i_accion(int, text) from public, anon, authenticated;
revoke all on function pozo_lista(), pozo_crear(text, boolean, text, numeric, int, int), pozo_unirse(text), pozo_cerrar_inscripcion(), pozo_ofrecer(uuid[]), pozo_confirmar(int),
  pozo_retirar_confirmacion(), pozo_salir(), pozo_tirar(int), pozo_cobrar(int), pozo_continuar(int), pozo_estado(bigint), pozo_mis_cartas() from public, anon;
grant execute on function pozo_lista(), pozo_crear(text, boolean, text, numeric, int, int), pozo_unirse(text), pozo_cerrar_inscripcion(), pozo_ofrecer(uuid[]), pozo_confirmar(int),
  pozo_retirar_confirmacion(), pozo_salir(), pozo_tirar(int), pozo_cobrar(int), pozo_continuar(int), pozo_estado(bigint), pozo_mis_cartas() to authenticated;

/* ================================================================== 12) MODO SOLITARIO: tú contra el Dragón
   Apuestas dinero, tiras tres dados y decides si cobrar o seguir. Aquí NO hay otros jugadores: paga la casa, así que el juego crea tokens cuando ganas y los destruye cuando pierdes.
   Para que no se creen tokens sin respaldo la tabla tiene una ventaja de la casa calculada (tools/pozo-dragon-solo.js):
     - Premio = apuesta × (1 − tributo) × (1 + bonos), con un tributo VISIBLE del 5 % y los bonos a un cuarto de la tabla propuesta (pareja 6,25 %, escalera 18,75 %, triple 37,5 %, triple seis 100 %).
     - Con la mejor estrategia posible el jugador recupera de media el 97,49 % (ventaja de la casa 2,51 %); con la tabla propuesta sin tributo recuperaría el 171 %.
   Solo dinero: no hay cartas, porque la casa no puede entregar cartas sin salirse de los límites y la reserva de la economía de cartas.
   Tiradas seguras y más allá: las cinco primeras tiradas (pozo_tiradas_max) tienen solo el riesgo de los dados (4,63 %). Después de la quinta se puede seguir tirando, pero el Dragón carga los dados:
   antes de cada tirada extra hay una probabilidad de Ruina forzada que empieza en pozo_solo_peligro_inicial % y se multiplica por pozo_solo_peligro_factor en cada tirada, con tope pozo_solo_peligro_max %
   (8, 16, 32, 64, 95... por defecto). Cuando se fuerza, los dados enseñan una tirada de Ruina corriente (suma de 3 a 5). NADA de esto se dice en la pantalla: se aprende jugando.
   Con la mejor estrategia posible nadie sigue después de la quinta (cada tirada extra pierde valor esperado), así que el retorno máximo sigue siendo el de las cinco tiradas (tools/pozo-dragon-solo.js lo comprueba).
   Una partida por jugador a la vez. El inicio lleva un identificador del cliente (repetirlo devuelve la misma partida, sin cobrar dos veces) y cada acción lleva el paso. El pago se hace una sola vez,
   al pasar la partida a 'terminada' bajo su candado. Una partida abandonada se cierra sola: sin tiradas se devuelve la apuesta entera; con tiradas se cobra lo que lleve (retirada segura). */
insert into cartas_economia_ajustes (clave, valor) values
  ('pozo_solo_tributo', '5'),              -- % que el Dragón retiene del premio (visible antes de apostar)
  ('pozo_solo_bono_pareja', '6.25'),       -- bonos en % de la apuesta (antes del tributo)
  ('pozo_solo_bono_escalera', '18.75'),
  ('pozo_solo_bono_triple', '37.5'),
  ('pozo_solo_bono_triple_seis', '100'),
  ('pozo_solo_apuesta_max', '0'),          -- apuesta máxima; 0 = sin máximo (como Las Veintiuna Velas). Si algún día hace falta un tope, se pone aquí
  ('pozo_solo_abandono_s', '120'),         -- segundos sin actuar tras los que una partida abandonada se cierra sola
  ('pozo_solo_peligro_inicial', '8'),      -- % de Ruina forzada en la primera tirada después de las seguras (la sexta)
  ('pozo_solo_peligro_factor', '2'),       -- por cuánto se multiplica en cada tirada siguiente (exponencial)
  ('pozo_solo_peligro_max', '95')          -- tope de la Ruina forzada, en %
on conflict (clave) do nothing;

create table if not exists pozo_solo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  cliente uuid not null,                                            -- identificador de la petición de empezar: repetirla devuelve esta misma partida
  apuesta numeric(12, 2) not null check (apuesta > 0),
  tributo numeric(5, 2) not null,                                   -- % de tributo con el que empezó (un cambio de ajustes no toca partidas en curso)
  bonos jsonb not null,                                             -- fracciones por combinación con las que empezó
  estado text not null default 'en_curso' check (estado in ('en_curso', 'terminada')),
  fase text not null default 'tirar' check (fase in ('tirar', 'decidir')),
  tiradas int not null default 0,
  bono numeric(10, 4) not null default 0,                           -- suma de los bonos de las tiradas, en fracciones de la apuesta
  paso int not null default 0,
  resultado text check (resultado in ('ruina', 'cobro', 'cobro_automatico', 'devuelta')),
  pago numeric(12, 2),
  neto numeric(12, 2),
  descartada boolean not null default false,
  creada timestamptz not null default now(),
  ultima_accion timestamptz not null default now(),
  terminada timestamptz,
  unique (user_id, cliente),
  check ((estado = 'terminada') = (resultado is not null))
);
create unique index if not exists pozo_solo_una_en_curso on pozo_solo (user_id) where estado = 'en_curso';
create index if not exists pozo_solo_user_idx on pozo_solo (user_id, creada desc);

create table if not exists pozo_solo_tiradas (
  id bigint generated always as identity primary key,
  solo uuid not null references pozo_solo(id) on delete cascade,
  n int not null,
  d1 smallint not null check (d1 between 1 and 6),
  d2 smallint not null check (d2 between 1 and 6),
  d3 smallint not null check (d3 between 1 and 6),
  categoria text not null,
  bono_despues numeric(10, 4) not null,
  creada timestamptz not null default now()
);
create index if not exists pozo_solo_tiradas_idx on pozo_solo_tiradas (solo, id);

alter table pozo_solo enable row level security;
alter table pozo_solo_tiradas enable row level security;
drop policy if exists "pozo_solo_admin" on pozo_solo;
create policy "pozo_solo_admin" on pozo_solo for select using (fichas_es_admin());
drop policy if exists "pozo_solo_tiradas_admin" on pozo_solo_tiradas;
create policy "pozo_solo_tiradas_admin" on pozo_solo_tiradas for select using (fichas_es_admin());
revoke all on pozo_solo, pozo_solo_tiradas from anon, authenticated;
grant select on pozo_solo, pozo_solo_tiradas to authenticated;

-- Lo que se cobraría ahora: apuesta × (1 − tributo) × (1 + bonos), céntimos hacia abajo (a favor de la casa, menos de un céntimo)
create or replace function pozo_i_solo_premio(p_apuesta numeric, p_tributo numeric, p_bono numeric)
returns numeric
language sql
immutable
as $$ select trunc(p_apuesta * (1 - p_tributo / 100) * (1 + p_bono), 2) $$;

create or replace function pozo_i_solo_json(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s pozo_solo%rowtype;
  v_hist jsonb;
begin
  select * into s from pozo_solo where id = p_id;
  select coalesce(jsonb_agg(jsonb_build_object('n', t.n, 'dados', jsonb_build_array(t.d1, t.d2, t.d3), 'categoria', t.categoria, 'bono_despues', t.bono_despues, 'id', t.id) order by t.id), '[]'::jsonb)
    into v_hist from pozo_solo_tiradas t where t.solo = p_id;
  return jsonb_build_object(
    'id', s.id, 'apuesta', s.apuesta, 'tributo', s.tributo, 'bonos', s.bonos, 'estado', s.estado, 'fase', s.fase, 'tiradas', s.tiradas,
    'tiradas_max', (cartas_ajuste('pozo_tiradas_max', '5'))::text::int, 'bono', s.bono, 'paso', s.paso,
    'premio', pozo_i_solo_premio(s.apuesta, s.tributo, s.bono),                          -- lo que cobrarías ahora (el premio provisional)
    'base', pozo_i_solo_premio(s.apuesta, s.tributo, 0),
    'resultado', s.resultado, 'pago', s.pago, 'neto', s.neto, 'historial', v_hist, 'saldo', pozo_i_saldo(s.user_id),
    'restante_s', case when s.estado = 'en_curso' then round(greatest(0, (cartas_ajuste('pozo_solo_abandono_s', '120'))::text::numeric - extract(epoch from (now() - s.ultima_accion)))) end);
end;
$$;

-- Cierra la partida UNA vez: paga (o no) y anota el libro. Quien llama ya tiene el candado del jugador.
create or replace function pozo_i_solo_cerrar(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s pozo_solo%rowtype;
  v_pago numeric;
begin
  select * into s from pozo_solo where id = p_id for update;
  if not found or s.estado <> 'en_curso' then return; end if;                       -- ya se cerró: no se paga dos veces
  v_pago := case p_resultado when 'ruina' then 0 when 'devuelta' then s.apuesta else pozo_i_solo_premio(s.apuesta, s.tributo, s.bono) end;
  if v_pago > 0 then
    perform pozo_i_abonar(s.user_id, v_pago, case p_resultado when 'devuelta' then 'El Pozo del Dragón (solo): apuesta devuelta' else 'El Pozo del Dragón (solo): premio' end || ' (partida ' || s.id || ')');
  end if;
  update pozo_solo set estado = 'terminada', resultado = p_resultado, pago = v_pago, neto = v_pago - apuesta, terminada = now(), paso = paso + 1, ultima_accion = now() where id = p_id;
  begin perform pozo_i_logros_solo(p_id); exception when others then null; end;                  -- los desafíos nunca pueden estropear un pago
end;
$$;

-- Una partida abandonada se resuelve sola: sin tiradas se devuelve la apuesta; con tiradas se cobra lo que lleve
create or replace function pozo_i_solo_avanzar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s pozo_solo%rowtype;
begin
  select * into s from pozo_solo where id = p_id for update;
  if not found or s.estado <> 'en_curso' then return; end if;
  if s.ultima_accion >= now() - make_interval(secs => (cartas_ajuste('pozo_solo_abandono_s', '120'))::text::numeric) then return; end if;
  perform pozo_i_solo_cerrar(p_id, case when s.tiradas = 0 then 'devuelta' else 'cobro_automatico' end);
end;
$$;

-- La partida de ese jugador: la que tiene en curso o la última terminada que aún no cerró (diez minutos)
create or replace function pozo_i_solo_de(p_uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from pozo_solo where user_id = p_uid and (estado = 'en_curso' or (not descartada and terminada > now() - interval '10 minutes')) order by (estado = 'en_curso') desc, creada desc limit 1
$$;

create or replace function pozo_solo_estado()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  v_id := pozo_i_solo_de(uid);
  if v_id is null then return jsonb_build_object('sin_partida', true, 'saldo', pozo_i_saldo(uid), 'reglas', pozo_i_solo_reglas()); end if;
  perform pozo_i_solo_avanzar(v_id);
  v_id := pozo_i_solo_de(uid);
  if v_id is null then return jsonb_build_object('sin_partida', true, 'saldo', pozo_i_saldo(uid), 'reglas', pozo_i_solo_reglas()); end if;
  return pozo_i_solo_json(v_id);
end;
$$;

create or replace function pozo_i_solo_reglas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('tributo', (cartas_ajuste('pozo_solo_tributo', '5'))::text::numeric,
    'bonos', jsonb_build_object('pareja', (cartas_ajuste('pozo_solo_bono_pareja', '6.25'))::text::numeric / 100, 'escalera', (cartas_ajuste('pozo_solo_bono_escalera', '18.75'))::text::numeric / 100,
                                'triple', (cartas_ajuste('pozo_solo_bono_triple', '37.5'))::text::numeric / 100, 'triple_seis', (cartas_ajuste('pozo_solo_bono_triple_seis', '100'))::text::numeric / 100),
    'tiradas_max', (cartas_ajuste('pozo_tiradas_max', '5'))::text::int, 'apuesta_min', (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric,
    'apuesta_paso', (cartas_ajuste('pozo_apuesta_paso', '10'))::text::numeric, 'apuesta_max', (cartas_ajuste('pozo_solo_apuesta_max', '0'))::text::numeric,
    'abandono_s', (cartas_ajuste('pozo_solo_abandono_s', '120'))::text::int)
$$;

create or replace function pozo_solo_empezar(p_cliente uuid, p_apuesta numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  min_a numeric := (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric;
  max_a numeric := (cartas_ajuste('pozo_solo_apuesta_max', '0'))::text::numeric;
  paso_a numeric := (cartas_ajuste('pozo_apuesta_paso', '10'))::text::numeric;
  s pozo_solo%rowtype;
  v_id uuid := gen_random_uuid();
  v_saldo_antes numeric;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  if p_cliente is null then perform pozo_i_error('Falta el identificador de la partida.', 'peticion_invalida'); end if;
  select * into s from pozo_solo where user_id = uid and cliente = p_cliente;
  if found then return pozo_i_solo_json(s.id) || jsonb_build_object('repetida', true); end if;     -- la misma petición otra vez: la misma partida, sin cobrar de nuevo
  select id into v_id from pozo_solo where user_id = uid and estado = 'en_curso';
  if found then perform pozo_i_solo_avanzar(v_id); end if;
  if exists (select 1 from pozo_solo where user_id = uid and estado = 'en_curso') then perform pozo_i_error('Ya tienes una partida en solitario en curso. Termínala antes de empezar otra.', 'solo_en_curso'); end if;
  if exists (select 1 from pozo_jugadores where user_id = uid and activo) then perform pozo_i_error('Estás en una mesa. Sal de ella antes de jugar en solitario.', 'ya_en_mesa'); end if;
  if p_apuesta is null or p_apuesta < min_a or (max_a > 0 and p_apuesta > max_a) then
    perform pozo_i_error(case when max_a > 0 then 'La apuesta va de ' || min_a || ' a ' || max_a || ' tokens.' else 'La apuesta mínima es de ' || min_a || ' tokens.' end, 'apuesta_invalida');
  end if;
  if p_apuesta <> trunc(p_apuesta / paso_a) * paso_a then perform pozo_i_error('La apuesta tiene que ser múltiplo de ' || paso_a || '.', 'apuesta_invalida'); end if;
  v_id := gen_random_uuid();
  v_saldo_antes := pozo_i_saldo(uid);
  perform pozo_i_debitar(uid, p_apuesta, 'El Pozo del Dragón (solo): apuesta (partida ' || v_id || ')');            -- el saldo disponible ya no la cuenta; si no alcanza, nada queda a medias
  insert into pozo_solo (id, user_id, cliente, apuesta, tributo, bonos, saldo_antes)
    values (v_id, uid, p_cliente, p_apuesta, (cartas_ajuste('pozo_solo_tributo', '5'))::text::numeric, pozo_i_solo_reglas() -> 'bonos', v_saldo_antes);
  return pozo_i_solo_json(v_id);
end;
$$;

-- Tirar (la primera vez y cada vez que decides seguir) o cobrar. p_paso: el paso de la partida que veía el jugador.
create or replace function pozo_i_solo_accion(p_id uuid, p_paso int, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  s pozo_solo%rowtype;
  d int[];
  v_cat text;
  v_bono numeric;
  v_max int := (cartas_ajuste('pozo_tiradas_max', '5'))::text::int;
  v_peligro numeric;
  v_forzada boolean := false;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  select * into s from pozo_solo where id = p_id and user_id = uid for update;
  if not found then perform pozo_i_error('No encuentro esa partida.', 'no_encontrada'); end if;
  perform pozo_i_solo_avanzar(p_id);
  select * into s from pozo_solo where id = p_id;
  if s.estado = 'terminada' or p_paso < s.paso then return pozo_i_solo_json(p_id) || jsonb_build_object('repetida', true); end if;
  if p_paso > s.paso then perform pozo_i_error('La partida y tu pantalla no coinciden. Recarga la página.', 'paso_futuro'); end if;

  if p_accion = 'cobrar' then
    if s.fase <> 'decidir' then perform pozo_i_error('Todavía no has tirado: no hay nada que cobrar.', 'fuera_de_turno'); end if;
    perform pozo_i_solo_cerrar(p_id, 'cobro');
  elsif p_accion = 'tirar' then
    -- Más allá de las tiradas seguras el Dragón carga los dados: una probabilidad de Ruina forzada que crece de forma exponencial (en % con dos decimales)
    if s.tiradas >= v_max then
      v_peligro := least((cartas_ajuste('pozo_solo_peligro_max', '95'))::text::numeric,
                         (cartas_ajuste('pozo_solo_peligro_inicial', '8'))::text::numeric * power((cartas_ajuste('pozo_solo_peligro_factor', '2'))::text::numeric, s.tiradas - v_max));
      v_forzada := pozo_i_azar(10000) < round(v_peligro * 100);
    end if;
    if v_forzada then
      -- una de las diez tiradas de Ruina, al azar: se ve como cualquier Ruina
      select array[a, b, c]::int[] into d from (values (1,1,1),(1,1,2),(1,2,1),(2,1,1),(1,1,3),(1,3,1),(3,1,1),(1,2,2),(2,1,2),(2,2,1)) v(a, b, c) offset pozo_i_azar(10) limit 1;
    else
      d := array[pozo_i_dado(), pozo_i_dado(), pozo_i_dado()]::int[];
    end if;
    v_cat := pozo_i_clasificar(d[1], d[2], d[3]);
    v_bono := s.bono + case v_cat when 'pareja' then (s.bonos ->> 'pareja')::numeric when 'escalera' then (s.bonos ->> 'escalera')::numeric
                                  when 'triple' then (s.bonos ->> 'triple')::numeric when 'triple_seis' then (s.bonos ->> 'triple_seis')::numeric else 0 end;
    insert into pozo_solo_tiradas (solo, n, d1, d2, d3, categoria, bono_despues) values (p_id, s.tiradas + 1, d[1], d[2], d[3], v_cat, case when v_cat = 'ruina' then s.bono else v_bono end);
    update pozo_solo set tiradas = tiradas + 1, ultima_accion = now() where id = p_id;
    if v_cat = 'ruina' then
      perform pozo_i_solo_cerrar(p_id, 'ruina');                                     -- pierdes el premio provisional y se acaba
    else
      update pozo_solo set bono = v_bono, fase = 'decidir', paso = paso + 1 where id = p_id;                       -- se puede cobrar o seguir tirando, también después de la quinta
    end if;
  else
    perform pozo_i_error('Esa acción no existe.', 'accion_invalida');
  end if;
  return pozo_i_solo_json(p_id);
end;
$$;
create or replace function pozo_solo_tirar(p_id uuid, p_paso int) returns jsonb language sql security definer set search_path = public as $$ select pozo_i_solo_accion(p_id, p_paso, 'tirar') $$;
create or replace function pozo_solo_cobrar(p_id uuid, p_paso int) returns jsonb language sql security definer set search_path = public as $$ select pozo_i_solo_accion(p_id, p_paso, 'cobrar') $$;

-- Cerrar la pantalla del resultado
create or replace function pozo_solo_descartar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  perform pozo_i_acceso();
  update pozo_solo set descartada = true where user_id = uid and estado = 'terminada' and not descartada;
  return jsonb_build_object('sin_partida', true, 'saldo', pozo_i_saldo(uid), 'reglas', pozo_i_solo_reglas());
end;
$$;

revoke all on function pozo_i_solo_premio(numeric, numeric, numeric), pozo_i_solo_json(uuid), pozo_i_solo_cerrar(uuid, text), pozo_i_solo_avanzar(uuid), pozo_i_solo_de(uuid),
  pozo_i_solo_reglas(), pozo_i_solo_accion(uuid, int, text) from public, anon, authenticated;
revoke all on function pozo_solo_estado(), pozo_solo_empezar(uuid, numeric), pozo_solo_tirar(uuid, int), pozo_solo_cobrar(uuid, int), pozo_solo_descartar() from public, anon;
grant execute on function pozo_solo_estado(), pozo_solo_empezar(uuid, numeric), pozo_solo_tirar(uuid, int), pozo_solo_cobrar(uuid, int), pozo_solo_descartar() to authenticated;

/* ================================================================== 13) DESAFÍOS: cartas por jugar (los de aquí son para valientes)
   Misma mecánica que Las Veintiuna Velas (docs/veintiuna.md): el servidor cuenta lo que haces, cada desafío se completa y se reclama una vez AL DÍA y da una carta.
   Se reinician a las 00:00 UTC. Reutilizan el sistema oficial de recompensas (una fila en cartas_juegos y cartas_i_juego_terminar_nucleo), con sus topes diarios, límites, circulación y reserva.
   Dos cartas al día como mucho desde aquí (tope_dia 2, como Las Veintiuna Velas hoy). Si no hay carta que dar el desafío NO se gasta: queda guardado y se puede reclamar más tarde, pero el mismo día.
   Nace ENCENDIDO (activo = true, igual que Las Veintiuna Velas); se apaga en Admin → Economía → Juegos y recetas.
   Qué cuenta: las partidas en solitario, los duelos y las mesas compartidas con apuesta de dinero (para que nadie los gane pactando gratis con un amigo). */
create table if not exists pozo_logros_def (
  id text primary key,
  orden int not null,
  nivel text not null check (nivel in ('bronce', 'plata', 'oro')),   -- bronce vale 1 (resultado bueno), plata 3 (excelente) y oro 4 (extraordinario) en cartas_juegos.valores
  nombre text not null,
  texto text not null,
  contador text not null,                                           -- qué contador del día mide el progreso
  meta int not null default 1 check (meta >= 1)
);
insert into pozo_logros_def (id, orden, nivel, nombre, texto, contador, meta) values
  ('una_mas',        1, 'bronce', 'Una más',                   'Tira los dados después de la quinta tirada en una partida en solitario.', 'extra', 1),
  ('diezmo',         2, 'bronce', 'El diezmo del Dragón',      'Pierde 500 tokens en Ruinas del solitario en un mismo día.', 'perdido', 500),
  ('mala_racha',     3, 'bronce', 'Mala racha',                'Cae en Ruina tres veces seguidas en el solitario.', 'mejor_ruinas_seguidas', 3),
  ('doble_o_nada',   4, 'plata',  'Doble o nada',              'Cobra en el solitario un premio de al menos el doble de tu apuesta.', 'mult_max', 200),
  ('mil_al_fuego',   5, 'plata',  'Mil tokens al fuego',       'Apuesta 1.000 tokens en total en el solitario en un mismo día.', 'apostado', 1000),
  ('seis_seis_seis', 6, 'plata',  'Seis, seis, seis',          'Saca un triple seis en el solitario.', 'triples_seis', 1),
  ('sin_red',        7, 'plata',  'Sin red',                   'Haz tres tiradas después de la quinta en un mismo día.', 'extra', 3),
  ('duelo_limpio',   8, 'plata',  'Duelo limpio',              'Gana un duelo por 2 a 0 con dinero en juego.', 'duelos_2a0', 1),
  ('todo_o_nada',    9, 'oro',    'Todo o nada',               'Apuesta al menos el 90 % de tu saldo (y no menos de 100 tokens) en una partida en solitario y cóbrala.', 'todo_o_nada', 1),
  ('hasta_el_fondo', 10, 'oro',   'Hasta el fondo',            'Cobra una partida en solitario después de ocho tiradas o más.', 'serie_max', 8),
  ('remontada',      11, 'oro',   'Remontada imposible',       'Gana un duelo con dinero en juego después de perder la primera ronda.', 'duelos_remontada', 1),
  ('ultimo_en_pie',  12, 'oro',   'Último en pie',             'Cobra en una mesa compartida con dinero en juego en la que caigan en Ruina al menos otros dos jugadores.', 'ultimo_en_pie', 1)
on conflict (id) do update set orden = excluded.orden, nivel = excluded.nivel, nombre = excluded.nombre, texto = excluded.texto, contador = excluded.contador, meta = excluded.meta;

-- El progreso del día de cada jugador (los contadores se reinician cada día) y lo que ha completado y reclamado hoy
create table if not exists pozo_progreso (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dia date not null default ((now() at time zone 'utc')::date),
  contadores jsonb not null default '{}'::jsonb
);
create table if not exists pozo_logros (
  user_id uuid not null references auth.users(id) on delete cascade,
  logro text not null references pozo_logros_def(id) on delete cascade,
  completado timestamptz not null default now(),
  reclamado timestamptz,
  carta text,
  numero int,
  primary key (user_id, logro)
);
-- El saldo con el que empezó cada partida en solitario (para «Todo o nada»)
alter table pozo_solo add column if not exists saldo_antes numeric(12, 2);

alter table pozo_progreso enable row level security;
alter table pozo_logros enable row level security;
alter table pozo_logros_def enable row level security;
drop policy if exists "pozo_progreso_admin" on pozo_progreso;
create policy "pozo_progreso_admin" on pozo_progreso for select using (fichas_es_admin());
drop policy if exists "pozo_logros_admin" on pozo_logros;
create policy "pozo_logros_admin" on pozo_logros for select using (fichas_es_admin());
drop policy if exists "pozo_logros_def_admin" on pozo_logros_def;
create policy "pozo_logros_def_admin" on pozo_logros_def for select using (fichas_es_admin());
revoke all on pozo_progreso, pozo_logros, pozo_logros_def from anon, authenticated;
grant select on pozo_progreso, pozo_logros, pozo_logros_def to authenticated;

-- Una fila en cartas_juegos y el cierre oficial de la recompensa, igual que Las Veintiuna Velas. Bronce vale 1, plata 3 y oro 4; la probabilidad de cada tramo es 1.
insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos, prob, grupos, valores) values
  ('pozo_dragon', 'El Pozo del Dragón', true, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 2, 0, 5, '{}',
   '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}',
   '{"bueno": 1, "excelente": 1, "extraordinario": 1}', '{}',
   '{"rivales": {"bronce": {"gana": 1, "tablas": 0, "pierde": 0}, "plata": {"gana": 3, "tablas": 0, "pierde": 0}, "oro": {"gana": 4, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}')
on conflict (juego) do nothing;

-- El editor de Juegos y recetas guarda «valores»; el validador tiene que conocer este juego (mismo formato que Ajedrez y Veintiuna: rivales con gana/tablas/pierde).
do $$
declare
  d text := pg_get_functiondef('public.cartas_i_validar_valores(text,jsonb)'::regprocedure);
begin
  if position('pozo_dragon' in d) > 0 then return; end if;                         -- ya parcheada
  if position($a$'ajedrez', 'duelo', 'arqueria', 'veintiuna'$a$ in d) = 0 then
    raise exception 'cartas_i_validar_valores ha cambiado: añade el juego pozo_dragon a mano a sus dos listas de juegos con «rivales»';
  end if;
  execute replace(d, $a$'ajedrez', 'duelo', 'arqueria', 'veintiuna'$a$, $b$'ajedrez', 'duelo', 'arqueria', 'veintiuna', 'pozo_dragon'$b$);
end $$;

-- A las 00:00 UTC lo del día anterior desaparece: lo completado y sin reclamar se pierde
create or replace function pozo_i_dia(p_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into pozo_progreso (user_id) values (p_uid) on conflict do nothing;
  update pozo_progreso set dia = (now() at time zone 'utc')::date, contadores = '{}'::jsonb where user_id = p_uid and dia < (now() at time zone 'utc')::date;
  if found then delete from pozo_logros where user_id = p_uid; end if;
end;
$$;

-- Contadores del día: sumar, quedarse con el máximo o fijar un valor
create or replace function pozo_i_contar(p_uid uuid, p_clave text, p_modo text, p_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora numeric;
begin
  select coalesce((contadores ->> p_clave)::numeric, 0) into v_ahora from pozo_progreso where user_id = p_uid;
  update pozo_progreso set contadores = jsonb_set(contadores, array[p_clave], to_jsonb(case p_modo when 'suma' then v_ahora + p_valor when 'maximo' then greatest(v_ahora, p_valor) else p_valor end), true)
    where user_id = p_uid;
end;
$$;

-- Apunta los desafíos que el contador de hoy ya cumple
create or replace function pozo_i_comprobar(p_uid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into pozo_logros (user_id, logro)
  select p_uid, d.id from pozo_logros_def d join pozo_progreso p on p.user_id = p_uid
   where coalesce((p.contadores ->> d.contador)::numeric, 0) >= d.meta
  on conflict do nothing
$$;

-- Una partida en solitario terminada
create or replace function pozo_i_logros_solo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s pozo_solo%rowtype;
  v_max int := (cartas_ajuste('pozo_tiradas_max', '5'))::text::int;
  v_seis int;
  v_ruinas numeric;
begin
  select * into s from pozo_solo where id = p_id;
  if not found or s.estado <> 'terminada' or s.resultado = 'devuelta' then return; end if;                      -- una partida devuelta sin tiradas no cuenta
  perform pozo_i_dia(s.user_id);
  perform pozo_i_contar(s.user_id, 'apostado', 'suma', s.apuesta);
  perform pozo_i_contar(s.user_id, 'extra', 'suma', greatest(0, s.tiradas - v_max));
  select count(*) into v_seis from pozo_solo_tiradas where solo = p_id and categoria = 'triple_seis';
  if v_seis > 0 then perform pozo_i_contar(s.user_id, 'triples_seis', 'suma', v_seis); end if;
  if s.resultado = 'ruina' then
    perform pozo_i_contar(s.user_id, 'perdido', 'suma', s.apuesta);
    select coalesce((contadores ->> 'ruinas_seguidas')::numeric, 0) + 1 into v_ruinas from pozo_progreso where user_id = s.user_id;
    perform pozo_i_contar(s.user_id, 'ruinas_seguidas', 'poner', v_ruinas);
    perform pozo_i_contar(s.user_id, 'mejor_ruinas_seguidas', 'maximo', v_ruinas);
  else
    perform pozo_i_contar(s.user_id, 'ruinas_seguidas', 'poner', 0);
    perform pozo_i_contar(s.user_id, 'mult_max', 'maximo', round(s.pago / s.apuesta * 100));
    perform pozo_i_contar(s.user_id, 'serie_max', 'maximo', s.tiradas);
    if s.apuesta >= 100 and s.saldo_antes is not null and s.apuesta >= s.saldo_antes * 0.9 then perform pozo_i_contar(s.user_id, 'todo_o_nada', 'poner', 1); end if;
  end if;
  perform pozo_i_comprobar(s.user_id);
end;
$$;

-- Un duelo terminado (solo cuenta con dinero en juego y si lo ganó alguien por rondas)
create or replace function pozo_i_logros_duelo(p_mesa uuid, p_ganador int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  g pozo_jugadores%rowtype;
  v_victorias int := (cartas_ajuste('pozo_duelo_victorias', '2'))::text::int;
  v_rival_victorias int;
  v_primera int;
begin
  if p_ganador is null then return; end if;
  select * into m from pozo_mesas where id = p_mesa;
  if m.dinero < (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric then return; end if;
  select * into g from pozo_jugadores where mesa = p_mesa and asiento = p_ganador;
  if g.victorias < v_victorias then return; end if;                                                  -- ganó porque el otro se fue: no cuenta
  select coalesce(max(victorias), 0) into v_rival_victorias from pozo_jugadores where mesa = p_mesa and asiento <> p_ganador;
  select ganador into v_primera from pozo_rondas where mesa = p_mesa and ronda = 1;
  perform pozo_i_dia(g.user_id);
  if v_rival_victorias = 0 then perform pozo_i_contar(g.user_id, 'duelos_2a0', 'suma', 1); end if;
  if v_primera is not null and v_primera <> p_ganador then perform pozo_i_contar(g.user_id, 'duelos_remontada', 'suma', 1); end if;
  perform pozo_i_comprobar(g.user_id);
end;
$$;

-- Una mesa compartida terminada
create or replace function pozo_i_logros_compartido(p_mesa uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m pozo_mesas%rowtype;
  r pozo_jugadores%rowtype;
  v_ruinas int;
begin
  select * into m from pozo_mesas where id = p_mesa;
  if m.dinero < (cartas_ajuste('pozo_apuesta_min', '10'))::text::numeric then return; end if;
  select count(*) into v_ruinas from pozo_jugadores where mesa = p_mesa and estado = 'ruina';
  if v_ruinas < 2 then return; end if;
  for r in select * from pozo_jugadores where mesa = p_mesa and estado = 'retirado' loop
    perform pozo_i_dia(r.user_id);
    perform pozo_i_contar(r.user_id, 'ultimo_en_pie', 'suma', 1);
    perform pozo_i_comprobar(r.user_id);
  end loop;
end;
$$;

-- Lo que ves: los desafíos de hoy con tu progreso y, si ya reclamaste, la carta que te tocó
create or replace function pozo_desafios()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cfg cartas_juegos%rowtype;
  p pozo_progreso%rowtype;
begin
  perform pozo_i_acceso();
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  perform pozo_i_dia(uid);
  select * into p from pozo_progreso where user_id = uid;
  select * into cfg from cartas_juegos where juego = 'pozo_dragon';
  return jsonb_build_object('activo', coalesce(cfg.activo, false),
    'reinicia_en_s', round(extract(epoch from (date_trunc('day', now() at time zone 'utc') + interval '1 day' - (now() at time zone 'utc')))),
    'desafios', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nivel', d.nivel, 'nombre', d.nombre, 'texto', d.texto, 'meta', d.meta,
        'progreso', least(d.meta, coalesce((p.contadores ->> d.contador)::numeric, 0)),
        'completado', l.user_id is not null, 'reclamado', l.reclamado is not null, 'carta', l.carta) order by d.orden)
      from pozo_logros_def d left join pozo_logros l on l.user_id = uid and l.logro = d.id), '[]'::jsonb));
end;
$$;

-- Reclamar la carta de un desafío completado. Pasa por el sistema oficial de recompensas; si no hay carta que dar (apagado, tope del día, agotado)
-- NO se gasta el desafío y se puede reclamar más tarde, pero solo el mismo día.
create or replace function pozo_reclamar(p_logro text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l pozo_logros%rowtype;
  d pozo_logros_def%rowtype;
  cfg cartas_juegos%rowtype;
  hoy_total int;
  hoy_juego int;
  tope_total int := (cartas_ajuste('tope_dia_total', '6'))::text::int;
  v_token uuid;
  r jsonb := '{}'::jsonb;
begin
  perform pozo_i_acceso();
  perform cartas_i_candado_jugador(uid);
  perform pg_advisory_xact_lock(hashtextextended('pozo_u_' || uid::text, 0));
  select * into d from pozo_logros_def where id = p_logro;
  if not found then perform pozo_i_error('Ese desafío no existe.', 'no_encontrado'); end if;
  perform pozo_i_dia(uid);                                                          -- lo completado ayer y sin reclamar ya no vale
  select * into l from pozo_logros where user_id = uid and logro = p_logro for update;
  if not found then perform pozo_i_error('Ese desafío todavía no está completado.', 'no_completado'); end if;
  if l.reclamado is not null then perform pozo_i_error('Ya reclamaste este desafío.', 'ya_reclamado'); end if;
  select * into cfg from cartas_juegos where juego = 'pozo_dragon';
  if not found or not cfg.activo then return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo'); end if;
  select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
  select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = 'pozo_dragon' and creado >= date_trunc('day', now());
  if hoy_total >= tope_total or hoy_juego >= cfg.tope_dia then return jsonb_build_object('resultado', 'nada', 'motivo', 'tope-diario'); end if;
  -- «Mejora personal» del sistema general sube un tramo al superar tu mejor puntaje; aquí no hay puntajes sino niveles de desafío: se deja sin efecto
  insert into cartas_progreso (user_id, juego, mejor) values (uid, 'pozo_dragon', 1000) on conflict (user_id, juego) do update set mejor = 1000;
  begin
    insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'pozo_dragon', d.nivel, now() - interval '1 hour') returning token into v_token;
    r := cartas_i_juego_terminar_nucleo(v_token, 'gana', 0);
    if r ->> 'resultado' is distinct from 'carta' then
      raise exception 'sin carta' using errcode = 'VE001';                          -- deshace todo lo que hizo el cierre: el desafío sigue guardado
    end if;
  exception when sqlstate 'VE001' then
    return jsonb_build_object('resultado', 'nada', 'motivo', coalesce(nullif(r ->> 'motivo', ''), 'agotado'), 'nota', r ->> 'nota');
  end;
  update pozo_logros set reclamado = now(), carta = r ->> 'carta', numero = (r ->> 'numero')::int where user_id = uid and logro = p_logro;
  return r || jsonb_build_object('logro', d.nombre, 'nivel', d.nivel,
    'cantidad', (select count(*) from cartas_ejemplares where propietario = uid and carta_id = r ->> 'carta' and estado in ('poseida', 'bloqueada')));
end;
$$;

revoke all on function pozo_i_dia(uuid), pozo_i_contar(uuid, text, text, numeric), pozo_i_comprobar(uuid), pozo_i_logros_solo(uuid), pozo_i_logros_duelo(uuid, int), pozo_i_logros_compartido(uuid) from public, anon, authenticated;
revoke all on function pozo_desafios(), pozo_reclamar(text) from public, anon;
grant execute on function pozo_desafios(), pozo_reclamar(text) to authenticated;
