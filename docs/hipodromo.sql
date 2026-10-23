-- HIPÓDROMO: tablas, permisos y las funciones del servidor (mundo, monedas, apuestas y cuadras).
-- Se ejecuta una vez en el editor SQL de Supabase. Se puede repetir sin romper nada.
-- Explicación del conjunto en docs/hipodromo.md. Probado con PostgreSQL 17 (ver «Cómo se probó»).
--
-- Quién puede qué:
--   * hipodromo_estado     : el mundo entero, con lo oculto (genes, forma, resultado de la próxima carrera).
--                            Nadie lo lee ni lo escribe salvo la función de servicio (service_role).
--   * hipodromo_criaturas  : el perfil público de cada criatura (con su dueño y su precio). Lo lee cualquiera.
--   * hipodromo_programa   : la próxima carrera (inscritos, puertas, pronóstico, cuotas). Lo lee cualquiera.
--   * hipodromo_carreras   : el resultado de cada carrera. La propia base lo esconde hasta la hora de salida
--                            (la carrera se calcula una hora antes), así no hace falta un reloj exacto en el servidor.
--   * hipodromo_noticias   : las noticias; se leen cuando su hora ya pasó.
--   * hipodromo_calendario : las próximas carreras (categoría, distancia, pista, precio de inscribir). Lo lee cualquiera.
--   * hipodromo_votos      : (opcional) a quién apuesta cada jugador, para enseñar el porcentaje de la comunidad.
--   * hipodromo_billeteras, _movimientos, _apuestas, _ordenes, _avisos y _cuadras: lo de cada jugador. Cada uno lee
--     solo lo suyo y nadie escribe directamente: todo pasa por las funciones de abajo (security definer).
--   Los tokens son del servidor: apostar y mandar órdenes a la cuadra pasan por funciones que comprueban saldo y plazo.

-- ------------------------------------------------------------------ estado secreto del mundo
create table if not exists public.hipodromo_estado (
  id          integer primary key default 1 check (id = 1),
  version     bigint not null default 0,
  mundo       jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.hipodromo_estado enable row level security;
revoke all on public.hipodromo_estado from anon, authenticated;      -- sin políticas: solo service_role

-- ------------------------------------------------------------------ lo público
create table if not exists public.hipodromo_criaturas (
  id        bigint primary key,
  nombre    text not null,
  sexo      text not null check (sexo in ('m', 'f')),
  estado    text not null check (estado in ('activo', 'criador', 'retirado', 'fallecido')),
  nac       integer not null,                 -- número de carrera en que nació (negativo para las que ya estaban)
  gen       integer not null default 1,       -- generación: 1 las fundadoras, 2 sus hijas...
  padre_id  bigint,
  madre_id  bigint,
  salidas   integer not null default 0,
  victorias integer not null default 0,
  premios   integer not null default 0,
  leyenda   boolean not null default false,
  dueno     text,                             -- id del jugador dueño (null si la lleva el mundo)
  n         integer not null default 0,       -- última carrera en la que cambió
  publico   jsonb not null                    -- perfil público completo, tal como lo calcula el motor
);
alter table public.hipodromo_criaturas add column if not exists dueno text;
drop index if exists public.hipodromo_criaturas_nombre;
create unique index if not exists hipodromo_criaturas_nombre on public.hipodromo_criaturas (lower(nombre));
create index if not exists hipodromo_criaturas_estado on public.hipodromo_criaturas (estado);
create index if not exists hipodromo_criaturas_victorias on public.hipodromo_criaturas (victorias desc);
create index if not exists hipodromo_criaturas_leyenda on public.hipodromo_criaturas (leyenda) where leyenda;
create index if not exists hipodromo_criaturas_dueno on public.hipodromo_criaturas (dueno) where dueno is not null;

create table if not exists public.hipodromo_programa (
  n       integer primary key,
  hora    timestamptz not null,
  cierre  timestamptz not null,
  publico jsonb not null
);

create table if not exists public.hipodromo_carreras (
  n         integer primary key,
  hora      timestamptz not null,
  resultado jsonb not null
);

create table if not exists public.hipodromo_noticias (
  id     bigint generated always as identity primary key,
  n      integer not null,
  hora   timestamptz not null,
  tipo   text not null,
  titulo text not null,
  texto  text not null,
  ids    bigint[] not null default '{}'
);
create index if not exists hipodromo_noticias_hora on public.hipodromo_noticias (hora desc);
create index if not exists hipodromo_noticias_ids on public.hipodromo_noticias using gin (ids);

create table if not exists public.hipodromo_calendario (
  n     integer primary key,
  datos jsonb not null
);

alter table public.hipodromo_criaturas enable row level security;
alter table public.hipodromo_programa enable row level security;
alter table public.hipodromo_carreras enable row level security;
alter table public.hipodromo_noticias enable row level security;
alter table public.hipodromo_calendario enable row level security;

drop policy if exists "hipodromo_criaturas se lee" on public.hipodromo_criaturas;
create policy "hipodromo_criaturas se lee" on public.hipodromo_criaturas for select using (true);
drop policy if exists "hipodromo_programa se lee" on public.hipodromo_programa;
create policy "hipodromo_programa se lee" on public.hipodromo_programa for select using (true);
drop policy if exists "hipodromo_carreras se lee desde la salida" on public.hipodromo_carreras;
create policy "hipodromo_carreras se lee desde la salida" on public.hipodromo_carreras for select using (hora <= now());
drop policy if exists "hipodromo_noticias se lee cuando toca" on public.hipodromo_noticias;
create policy "hipodromo_noticias se lee cuando toca" on public.hipodromo_noticias for select using (hora <= now());
drop policy if exists "hipodromo_calendario se lee" on public.hipodromo_calendario;
create policy "hipodromo_calendario se lee" on public.hipodromo_calendario for select using (true);

revoke all on public.hipodromo_criaturas, public.hipodromo_programa, public.hipodromo_carreras, public.hipodromo_noticias, public.hipodromo_calendario from anon, authenticated;
grant select on public.hipodromo_criaturas, public.hipodromo_programa, public.hipodromo_carreras, public.hipodromo_noticias, public.hipodromo_calendario to anon, authenticated;

-- ------------------------------------------------------------------ lo de cada jugador
create table if not exists public.hipodromo_billeteras (
  usuario uuid primary key,
  saldo   numeric(12, 2) not null default 0 check (saldo >= 0),   -- nadie empieza con tokens (docs/hipodromo-2_cartas.sql)
  creada  timestamptz not null default now()
);
create table if not exists public.hipodromo_movimientos (
  id       bigint generated always as identity primary key,
  usuario  uuid not null,
  n        integer,
  concepto text not null,
  monto    numeric(12, 2) not null,
  saldo    numeric(12, 2) not null,
  creado   timestamptz not null default now()
);
create index if not exists hipodromo_movimientos_usuario on public.hipodromo_movimientos (usuario, id desc);
create table if not exists public.hipodromo_apuestas (
  id      bigint generated always as identity primary key,
  usuario uuid not null,
  n       integer not null,
  tipo    text not null check (tipo in ('ganador', 'podio', 'exacta', 'pozo')),
  sel     jsonb not null,                       -- un id de criatura, o [primero, segundo] en la exacta
  nombres jsonb not null default '[]',
  carrera text,
  monto   numeric(12, 2) not null check (monto >= 1),
  cuota   numeric(8, 2) not null,
  estado  text not null default 'pendiente' check (estado in ('pendiente', 'ganada', 'perdida', 'devuelta')),
  pago    numeric(12, 2) not null default 0,
  creada  timestamptz not null default now()
);
-- doble: si se gana, lo cobrado se juega solo a ganador al favorito de la carrera siguiente. origen: la apuesta de la que viene.
alter table public.hipodromo_apuestas add column if not exists doble boolean not null default false;
alter table public.hipodromo_apuestas add column if not exists origen bigint;
alter table public.hipodromo_apuestas drop constraint if exists hipodromo_apuestas_tipo_check;
alter table public.hipodromo_apuestas add constraint hipodromo_apuestas_tipo_check check (tipo in ('ganador', 'podio', 'exacta', 'pozo'));
create index if not exists hipodromo_apuestas_usuario on public.hipodromo_apuestas (usuario, id desc);
create index if not exists hipodromo_apuestas_pendientes on public.hipodromo_apuestas (n) where estado = 'pendiente';
create table if not exists public.hipodromo_ordenes (
  id       bigint generated always as identity primary key,
  usuario  uuid not null,
  datos    jsonb not null,
  estado   text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'rechazada')),
  texto    text,
  creada   timestamptz not null default now(),
  resuelta timestamptz
);
create index if not exists hipodromo_ordenes_usuario on public.hipodromo_ordenes (usuario, id desc);
create index if not exists hipodromo_ordenes_pendientes on public.hipodromo_ordenes (id) where estado = 'pendiente';
create table if not exists public.hipodromo_avisos (
  id          bigint generated always as identity primary key,
  usuario     uuid not null,
  n           integer,
  criatura_id bigint,
  texto       text not null,
  creado      timestamptz not null default now()
);
create index if not exists hipodromo_avisos_usuario on public.hipodromo_avisos (usuario, id desc);
create table if not exists public.hipodromo_cuadras (
  dueno       uuid not null,
  criatura_id bigint not null,
  n           integer not null,
  datos       jsonb not null,                   -- lo que le cuenta su entrenador: órdenes, cansancio, capacidades redondeadas
  primary key (dueno, criatura_id)
);

alter table public.hipodromo_billeteras enable row level security;
alter table public.hipodromo_movimientos enable row level security;
alter table public.hipodromo_apuestas enable row level security;
alter table public.hipodromo_ordenes enable row level security;
alter table public.hipodromo_avisos enable row level security;
alter table public.hipodromo_cuadras enable row level security;
drop policy if exists "hipodromo_billeteras la propia" on public.hipodromo_billeteras;
create policy "hipodromo_billeteras la propia" on public.hipodromo_billeteras for select using (usuario = auth.uid());
drop policy if exists "hipodromo_movimientos los propios" on public.hipodromo_movimientos;
create policy "hipodromo_movimientos los propios" on public.hipodromo_movimientos for select using (usuario = auth.uid());
drop policy if exists "hipodromo_apuestas las propias" on public.hipodromo_apuestas;
create policy "hipodromo_apuestas las propias" on public.hipodromo_apuestas for select using (usuario = auth.uid());
drop policy if exists "hipodromo_ordenes las propias" on public.hipodromo_ordenes;
create policy "hipodromo_ordenes las propias" on public.hipodromo_ordenes for select using (usuario = auth.uid());
drop policy if exists "hipodromo_avisos los propios" on public.hipodromo_avisos;
create policy "hipodromo_avisos los propios" on public.hipodromo_avisos for select using (usuario = auth.uid());
drop policy if exists "hipodromo_cuadras la propia" on public.hipodromo_cuadras;
create policy "hipodromo_cuadras la propia" on public.hipodromo_cuadras for select using (dueno = auth.uid());
revoke all on public.hipodromo_billeteras, public.hipodromo_movimientos, public.hipodromo_apuestas, public.hipodromo_ordenes, public.hipodromo_avisos, public.hipodromo_cuadras from anon, authenticated;
grant select on public.hipodromo_billeteras, public.hipodromo_movimientos, public.hipodromo_apuestas, public.hipodromo_ordenes, public.hipodromo_avisos, public.hipodromo_cuadras to authenticated;

-- ------------------------------------------------------------------ guardar una tanda (la llama la Edge Function)
-- p_version: la versión del estado que leyó la función (0 la primera vez). Si otra ejecución se adelantó, falla con
-- el código 40001 y la función simplemente vuelve a intentarlo desde el estado nuevo. Todo se guarda en una transacción:
-- el mundo, las criaturas, las carreras, las noticias, los pagos de tokens, el resultado de las órdenes, los avisos
-- y la liquidación de las apuestas de las carreras que se aplican. Si un pago dejara a alguien con saldo negativo
-- (alguien apostó entre la lectura y el guardado), falla con 23514 y la función repite con los saldos nuevos.
-- p_lote: lo que devuelve HipodromoMotor.lote(...) o loteInicial(...)
create or replace function public.hipodromo_guardar(p_version bigint, p_lote jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nueva bigint;
  r record;
  v_saldo numeric;
  v_orden bigint[];
  v_gana boolean;
  v_base numeric; v_total numeric; v_pago numeric; v_next hipodromo_programa%rowtype; v_fav jsonb; v_npc jsonb; v_npc_total numeric; v_npc_base numeric;
begin
  -- (el choque de versión usa 23514 y no 40001: PostgREST reintenta sin fin lo que falla con 40001 y una versión vieja nunca acierta)
  if p_version = 0 then
    insert into hipodromo_estado (id, version, mundo) values (1, 1, p_lote->'mundo') on conflict (id) do nothing;
    if not found then raise exception 'version' using errcode = '23514'; end if;
    v_nueva := 1;
  else
    update hipodromo_estado
       set mundo = p_lote->'mundo', version = version + 1, actualizado = now()
     where id = 1 and version = p_version
     returning version into v_nueva;
    if v_nueva is null then raise exception 'version' using errcode = '23514'; end if;
  end if;

  insert into hipodromo_criaturas (id, nombre, sexo, estado, nac, gen, padre_id, madre_id, salidas, victorias, premios, leyenda, dueno, n, publico)
  select x.id, x.nombre, x.sexo, x.estado, x.nac, x.gen, x.padre_id, x.madre_id, x.salidas, x.victorias, x.premios, x.leyenda, x.dueno, x.n, x.publico
    from jsonb_to_recordset(coalesce(p_lote->'criaturas', '[]'::jsonb)) as x(
      id bigint, nombre text, sexo text, estado text, nac integer, gen integer, padre_id bigint, madre_id bigint,
      salidas integer, victorias integer, premios integer, leyenda boolean, dueno text, n integer, publico jsonb)
  on conflict (id) do update set
    nombre = excluded.nombre, estado = excluded.estado, gen = excluded.gen, salidas = excluded.salidas, victorias = excluded.victorias,
    premios = excluded.premios, leyenda = excluded.leyenda, dueno = excluded.dueno, n = excluded.n, publico = excluded.publico;

  insert into hipodromo_programa (n, hora, cierre, publico)
  select x.n, to_timestamp(x.hora / 1000.0), to_timestamp(x.cierre / 1000.0), x.publico
    from jsonb_to_recordset(coalesce(p_lote->'programas', '[]'::jsonb)) as x(n integer, hora bigint, cierre bigint, publico jsonb)
  on conflict (n) do update set hora = excluded.hora, cierre = excluded.cierre, publico = excluded.publico;

  -- un resultado ya publicado no se vuelve a escribir
  insert into hipodromo_carreras (n, hora, resultado)
  select x.n, to_timestamp(x.hora / 1000.0), x.resultado
    from jsonb_to_recordset(coalesce(p_lote->'carreras', '[]'::jsonb)) as x(n integer, hora bigint, resultado jsonb)
  on conflict (n) do nothing;

  insert into hipodromo_noticias (n, hora, tipo, titulo, texto, ids)
  select x.n, to_timestamp(x.hora / 1000.0), x.tipo, x.titulo, x.texto,
         coalesce(array(select jsonb_array_elements_text(x.ids)::bigint), '{}')
    from jsonb_to_recordset(coalesce(p_lote->'noticias', '[]'::jsonb)) as x(n integer, hora bigint, tipo text, titulo text, texto text, ids jsonb);

  -- las próximas carreras (lo que se puede inscribir) y lo privado de cada cuadra: se reemplazan enteros
  if p_lote ? 'calendario' then
    delete from hipodromo_calendario where true;   -- Supabase exige WHERE en todo DELETE (pg-safeupdate)
    insert into hipodromo_calendario (n, datos) select (x->>'n')::integer, x from jsonb_array_elements(p_lote->'calendario') as x;
  end if;
  if p_lote ? 'cuadras' then
    delete from hipodromo_cuadras where true;
    insert into hipodromo_cuadras (dueno, criatura_id, n, datos)
    select x.dueno::uuid, x.criatura_id, x.n, x.datos
      from jsonb_to_recordset(p_lote->'cuadras') as x(dueno text, criatura_id bigint, n integer, datos jsonb);
  end if;

  -- tokens: premios, inscripciones, compras, ventas, montas. Cada pago deja un movimiento.
  for r in select x.dueno::uuid as usuario, x.monto, x.concepto, x.n
             from jsonb_to_recordset(coalesce(p_lote->'pagos', '[]'::jsonb)) as x(dueno text, monto numeric, concepto text, n integer)
            where x.monto <> 0 loop
    insert into hipodromo_billeteras (usuario) values (r.usuario) on conflict (usuario) do nothing;
    update hipodromo_billeteras set saldo = saldo + r.monto where usuario = r.usuario returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (r.usuario, r.n, left(coalesce(r.concepto, ''), 200), r.monto, v_saldo);
  end loop;

  -- el resultado de cada orden que se ha procesado
  update hipodromo_ordenes o
     set estado = case when x.ok then 'hecha' else 'rechazada' end, texto = left(coalesce(x.texto, x.error, ''), 300), resuelta = now()
    from jsonb_to_recordset(coalesce(p_lote->'ordenes', '[]'::jsonb)) as x(oid bigint, ok boolean, texto text, error text)
   where o.id = x.oid and o.estado = 'pendiente';

  insert into hipodromo_avisos (usuario, n, criatura_id, texto)
  select x.dueno::uuid, x.n, x.id, left(x.texto, 300)
    from jsonb_to_recordset(coalesce(p_lote->'avisos', '[]'::jsonb)) as x(dueno text, n integer, id bigint, texto text);

  -- liquidar las apuestas de las carreras que se aplican ahora (su resultado ya está guardado desde que se programó)
  for r in select a.id, a.usuario, a.n, a.tipo, a.sel, a.monto, a.cuota, a.doble, c.resultado
             from hipodromo_apuestas a
             left join hipodromo_carreras c on c.n = a.n
            where a.estado = 'pendiente'
              and a.n in (select (jsonb_array_elements_text(coalesce(p_lote->'aplicadas', '[]'::jsonb)))::integer)
            order by a.id loop
    if r.resultado is null then
      update hipodromo_apuestas set estado = 'devuelta', pago = r.monto where id = r.id;
      update hipodromo_billeteras set saldo = saldo + r.monto where usuario = r.usuario returning saldo into v_saldo;
      insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (r.usuario, null, 'Apuesta devuelta', r.monto, v_saldo);
      continue;
    end if;
    select array(select (e->>'id')::bigint from jsonb_array_elements(r.resultado->'llegada') with ordinality t(e, i) order by i) into v_orden;
    if r.tipo = 'pozo' then
      -- el pozo: lo apostado por todos más el bote, menos la retención, entre quienes aciertan (nunca menos de lo apostado)
      -- además de los jugadores, apuesta la tribuna (los personajes del hipódromo, js/hipodromo-npc.js): sus apuestas van en el programa publicado (publico->pozoNpc, por criatura)
      select coalesce(publico->'pozoNpc', '{}'::jsonb) into v_npc from hipodromo_programa where n = r.n;
      select coalesce(sum(value::numeric), 0) into v_npc_total from jsonb_each_text(coalesce(v_npc, '{}'::jsonb));
      v_npc_base := coalesce((v_npc ->> v_orden[1]::text)::numeric, 0);
      select coalesce(sum(monto), 0) + v_npc_total into v_total from hipodromo_apuestas where n = r.n and tipo = 'pozo';
      select coalesce(sum(monto), 0) + v_npc_base into v_base from hipodromo_apuestas where n = r.n and tipo = 'pozo' and (sel #>> '{}')::bigint = v_orden[1];
      v_gana := (r.sel #>> '{}')::bigint = v_orden[1];
      v_pago := case when v_gana then round(greatest(r.monto, (v_total + 50) * 0.9 * r.monto / v_base), 2) else 0 end;
    else
      v_gana := case r.tipo
        when 'ganador' then (r.sel #>> '{}')::bigint = v_orden[1]
        when 'podio' then (r.sel #>> '{}')::bigint = any (v_orden[1:3])
        else (r.sel->>0)::bigint = v_orden[1] and (r.sel->>1)::bigint = v_orden[2]
      end;
      v_pago := case when v_gana then round(r.monto * r.cuota, 2) else 0 end;
    end if;
    if v_gana then
      update hipodromo_apuestas set estado = 'ganada', pago = v_pago where id = r.id;
      -- doble: lo ganado no se cobra, pasa a ganador al favorito de la carrera siguiente si todavía se puede apostar
      v_fav := null;
      if r.doble then
        select * into v_next from hipodromo_programa where n = r.n + 1 and now() < cierre and not coalesce((publico->>'suspendida')::boolean, false);
        if found then
          select e into v_fav from jsonb_array_elements(v_next.publico->'entrantes') e order by (e->>'gan')::numeric, (e->>'puerta')::integer limit 1;
        end if;
      end if;
      if v_fav is not null then
        insert into hipodromo_apuestas (usuario, n, tipo, sel, nombres, carrera, monto, cuota, origen)
          values (r.usuario, r.n + 1, 'ganador', to_jsonb((v_fav->>'id')::bigint), jsonb_build_array(v_fav->>'nombre'), v_next.publico->>'nombre', v_pago, (v_fav->>'gan')::numeric, r.id);
        select saldo into v_saldo from hipodromo_billeteras where usuario = r.usuario;
        insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (r.usuario, r.n + 1, 'Doble: lo ganado pasa a la carrera ' || (r.n + 1), 0, v_saldo);
      else
        update hipodromo_billeteras set saldo = saldo + v_pago where usuario = r.usuario returning saldo into v_saldo;
        insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (r.usuario, null, 'Apuesta ganada', v_pago, v_saldo);
      end if;
    else
      update hipodromo_apuestas set estado = 'perdida' where id = r.id;
    end if;
  end loop;

  return v_nueva;
end;
$$;
revoke all on function public.hipodromo_guardar(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.hipodromo_guardar(bigint, jsonb) to service_role;

-- ------------------------------------------------------------------ funciones de los jugadores
-- La hora del servidor (para ajustar el reloj de la página)
create or replace function public.hipodromo_ahora() returns timestamptz language sql stable as $$ select now() $$;
revoke all on function public.hipodromo_ahora() from public;
grant execute on function public.hipodromo_ahora() to anon, authenticated;

-- Crea la billetera del jugador si no existe (empieza en 0) y devuelve el saldo
create or replace function public.hipodromo_saldo() returns numeric
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_saldo numeric;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid;
  return v_saldo;
end;
$$;
revoke all on function public.hipodromo_saldo() from public, anon;
grant execute on function public.hipodromo_saldo() to authenticated;

-- Apostar. La cuota la pone el servidor con lo publicado, nunca el cliente. Devuelve { ok, ... } o { ok: false, error }.
drop function if exists public.hipodromo_apostar(integer, text, jsonb, numeric);
create or replace function public.hipodromo_apostar(p_n integer, p_tipo text, p_sel jsonb, p_monto numeric, p_doble boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_monto numeric := floor(p_monto);
  v_prog hipodromo_programa%rowtype;
  v_saldo numeric;
  v_ids bigint[];
  v_ent jsonb;
  v_cuota numeric;
  v_nombres jsonb := '[]';
  v_a bigint; v_b bigint; v_pa numeric; v_pb numeric; v_raw numeric; v_tot numeric; v_gid numeric;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Hace falta iniciar sesión.'); end if;
  if p_tipo not in ('ganador', 'podio', 'exacta', 'pozo') then return jsonb_build_object('ok', false, 'error', 'Ese tipo de apuesta no existe.'); end if;
  if p_doble and p_tipo <> 'ganador' then return jsonb_build_object('ok', false, 'error', 'El doble solo vale para apuestas a ganador.'); end if;
  if v_monto is null or v_monto < 1 or v_monto > 1000000 then return jsonb_build_object('ok', false, 'error', 'Pon un importe de al menos 1 token.'); end if;
  select * into v_prog from hipodromo_programa where n = p_n;
  if not found then return jsonb_build_object('ok', false, 'error', 'Esa carrera no existe.'); end if;
  if now() >= v_prog.cierre then return jsonb_build_object('ok', false, 'error', 'Las apuestas de esa carrera están cerradas.'); end if;
  if coalesce((v_prog.publico->>'suspendida')::boolean, false) then return jsonb_build_object('ok', false, 'error', 'La carrera está suspendida.'); end if;
  select array(select (e->>'id')::bigint from jsonb_array_elements(v_prog.publico->'entrantes') e) into v_ids;

  if p_tipo = 'exacta' then
    if jsonb_typeof(p_sel) <> 'array' or jsonb_array_length(p_sel) <> 2 then return jsonb_build_object('ok', false, 'error', 'Elige dos criaturas distintas.'); end if;
    v_a := (p_sel->>0)::bigint; v_b := (p_sel->>1)::bigint;
    if v_a = v_b or not (v_a = any (v_ids)) or not (v_b = any (v_ids)) then return jsonb_build_object('ok', false, 'error', 'Elige dos criaturas distintas que corran.'); end if;
    v_pa := (v_prog.publico->'mercado'->>(v_a::text))::numeric; v_pb := (v_prog.publico->'mercado'->>(v_b::text))::numeric;
    v_raw := least(500, greatest(1.05, 1 / ((v_pa * v_pb / (1 - v_pa)) * 1.25)));
    v_cuota := case when v_raw < 10 then round(v_raw, 2) when v_raw < 100 then round(v_raw, 1) else round(v_raw, 0) end;
    select jsonb_agg(e->>'nombre' order by case when (e->>'id')::bigint = v_a then 0 else 1 end) into v_nombres
      from jsonb_array_elements(v_prog.publico->'entrantes') e where (e->>'id')::bigint in (v_a, v_b);
  else
    if jsonb_typeof(p_sel) <> 'number' then return jsonb_build_object('ok', false, 'error', 'Esa criatura no corre.'); end if;
    v_a := (p_sel #>> '{}')::bigint;
    if not (v_a = any (v_ids)) then return jsonb_build_object('ok', false, 'error', 'Esa criatura no corre.'); end if;
    select (e->>(case when p_tipo = 'podio' then 'pod' else 'gan' end))::numeric, jsonb_build_array(e->>'nombre') into v_cuota, v_nombres
      from jsonb_array_elements(v_prog.publico->'entrantes') e where (e->>'id')::bigint = v_a;
    if p_tipo = 'pozo' then
      -- sin cuota fija: la que se guarda es la estimada con lo que hay apostado ahora; el pago real se calcula al liquidar
      select coalesce(sum(monto), 0), coalesce(sum(monto) filter (where (sel #>> '{}')::bigint = v_a), 0) into v_tot, v_gid
        from hipodromo_apuestas where n = p_n and tipo = 'pozo' and estado = 'pendiente';
      -- y lo que la tribuna (los personajes) ya ha apostado a estas horas
      select v_tot + coalesce(sum((b->>'monto')::numeric), 0), v_gid + coalesce(sum((b->>'monto')::numeric) filter (where (b->>'sel')::bigint = v_a), 0) into v_tot, v_gid
        from jsonb_array_elements(coalesce(v_prog.publico->'tribuna', '[]'::jsonb)) b where (b->>'hora')::bigint <= (extract(epoch from now()) * 1000)::bigint;
      v_raw := greatest(v_monto, (v_tot + v_monto + 50) * 0.9 * v_monto / (v_gid + v_monto)) / v_monto;
      v_cuota := case when v_raw < 10 then round(v_raw, 2) when v_raw < 100 then round(v_raw, 1) else round(v_raw, 0) end;
    end if;
  end if;

  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid for update;
  if v_monto > v_saldo then return jsonb_build_object('ok', false, 'error', 'No tienes tantos tokens.'); end if;
  if (select count(*) from hipodromo_apuestas where usuario = v_uid and n = p_n and estado = 'pendiente') >= 20 then
    return jsonb_build_object('ok', false, 'error', 'Demasiadas apuestas en la misma carrera.');
  end if;
  update hipodromo_billeteras set saldo = saldo - v_monto where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_apuestas (usuario, n, tipo, sel, nombres, carrera, monto, cuota, doble)
    values (v_uid, p_n, p_tipo, p_sel, v_nombres, v_prog.publico->>'nombre', v_monto, v_cuota, coalesce(p_doble, false));
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (v_uid, p_n, 'Apuesta: ' || p_tipo || ', carrera ' || p_n, -v_monto, v_saldo);
  return jsonb_build_object('ok', true, 'cuota', v_cuota, 'saldo', v_saldo, 'nombres', v_nombres);
end;
$$;
revoke all on function public.hipodromo_apostar(integer, text, jsonb, numeric, boolean) from public, anon;
grant execute on function public.hipodromo_apostar(integer, text, jsonb, numeric, boolean) to authenticated;

-- Lo que hay apostado ahora a cada criatura en el pozo de cada carrera pendiente (solo sumas, no quién apostó)
create or replace view public.hipodromo_pozos as
  select n, (sel #>> '{}')::bigint as criatura_id, sum(monto)::numeric as total, count(*)::integer as apuestas
    from public.hipodromo_apuestas
   where tipo = 'pozo' and estado = 'pendiente'
   group by n, (sel #>> '{}')::bigint;
grant select on public.hipodromo_pozos to anon, authenticated;

-- Mandar una orden a la cuadra. No se resuelve aquí: la Edge Function la lee en el siguiente minuto, el motor decide si
-- vale y cuánto cuesta, y el resultado y el cobro se guardan junto al mundo. Devuelve el id de la orden (míralo en hipodromo_ordenes).
create or replace function public.hipodromo_ordenar(p_datos jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text := p_datos->>'tipo';
  v_d jsonb;
  v_id bigint;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  if v_tipo is null or v_tipo not in ('adoptar', 'comprar', 'vender', 'inscribir', 'desinscribir', 'entrenar', 'cuidar', 'tactica', 'nombre', 'retirar', 'cruzar') then
    raise exception 'Orden desconocida.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  if (select count(*) from hipodromo_ordenes where usuario = v_uid and estado = 'pendiente') >= 20 then
    raise exception 'Tienes demasiadas órdenes sin resolver.';
  end if;
  -- solo se guardan los campos conocidos y el dueño es siempre quien manda la orden
  v_d := jsonb_strip_nulls(jsonb_build_object(
    'tipo', v_tipo, 'dueno', v_uid::text,
    'id', case when p_datos ? 'id' then (p_datos->>'id')::bigint end,
    'n', case when p_datos ? 'n' then (p_datos->>'n')::integer end,
    'madre', case when p_datos ? 'madre' then (p_datos->>'madre')::bigint end,
    'padre', case when p_datos ? 'padre' then (p_datos->>'padre')::bigint end,
    'stat', left(p_datos->>'stat', 8), 'tactica', left(p_datos->>'tactica', 8), 'sexo', left(p_datos->>'sexo', 1),
    'nombre', left(p_datos->>'nombre', 28)));
  insert into hipodromo_ordenes (usuario, datos) values (v_uid, v_d) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.hipodromo_ordenar(jsonb) from public, anon;
grant execute on function public.hipodromo_ordenar(jsonb) to authenticated;

-- ------------------------------------------------------------------ vistas útiles para la interfaz
create or replace view public.hipodromo_leyendas with (security_invoker = true) as
  select id, nombre, sexo, estado, gen, salidas, victorias, premios, publico
    from public.hipodromo_criaturas
   where leyenda
   order by victorias desc, premios desc;
grant select on public.hipodromo_leyendas to anon, authenticated;

-- ------------------------------------------------------------------ OPCIONAL: opinión de la comunidad
-- Cada jugador con sesión deja a quién apuesta como ganador (una sola criatura por carrera, se puede cambiar
-- hasta que cierran las apuestas). Es una encuesta: se puede votar una cosa y apostar otra.
create table if not exists public.hipodromo_votos (
  n           integer not null,
  usuario     uuid not null default auth.uid(),
  criatura_id bigint not null,
  creado      timestamptz not null default now(),
  primary key (n, usuario)
);
alter table public.hipodromo_votos enable row level security;

drop policy if exists "hipodromo_votos ver el propio" on public.hipodromo_votos;
create policy "hipodromo_votos ver el propio" on public.hipodromo_votos for select using (usuario = auth.uid());

drop policy if exists "hipodromo_votos votar" on public.hipodromo_votos;
create policy "hipodromo_votos votar" on public.hipodromo_votos for insert with check (
  usuario = auth.uid()
  and exists (select 1 from public.hipodromo_programa p
               where p.n = hipodromo_votos.n and now() < p.cierre
                 and p.publico->'entrantes' @> jsonb_build_array(jsonb_build_object('id', hipodromo_votos.criatura_id))));

drop policy if exists "hipodromo_votos cambiar" on public.hipodromo_votos;
create policy "hipodromo_votos cambiar" on public.hipodromo_votos for update using (usuario = auth.uid()) with check (
  usuario = auth.uid()
  and exists (select 1 from public.hipodromo_programa p
               where p.n = hipodromo_votos.n and now() < p.cierre
                 and p.publico->'entrantes' @> jsonb_build_array(jsonb_build_object('id', hipodromo_votos.criatura_id))));

revoke all on public.hipodromo_votos from anon, authenticated;
grant select, insert, update on public.hipodromo_votos to authenticated;

-- Solo cuentas agregadas: nadie ve quién votó qué. Es una vista con los permisos de su dueño (hace falta para contar los
-- votos de todos), y el panel de Supabase la marca como aviso de seguridad: es a propósito, solo da números.
create or replace view public.hipodromo_comunidad as
  select n, criatura_id, count(*)::integer as votos
    from public.hipodromo_votos
   group by n, criatura_id;
grant select on public.hipodromo_comunidad to anon, authenticated;

-- Supabase da a las vistas nuevas permisos de escritura por defecto: se quitan, las vistas solo se leen.
revoke all on public.hipodromo_pozos, public.hipodromo_leyendas, public.hipodromo_comunidad from anon, authenticated;
grant select on public.hipodromo_pozos, public.hipodromo_leyendas, public.hipodromo_comunidad to anon, authenticated;
