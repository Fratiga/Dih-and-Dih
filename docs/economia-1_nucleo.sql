-- ECONOMÍA DE CARTAS, parte 1: el núcleo.
-- Ver docs/economia-de-cartas.md. Corre esto entero en el SQL Editor de Supabase DESPUÉS de cartas.sql,
-- cartas_editor.sql y cartas_combate.sql. Se puede correr más de una vez.
--
-- Qué hace:
--   * Cada copia de una carta pasa a ser un ejemplar con identificador único (cartas_ejemplares).
--   * Todo cambio de dueño o de estado queda en un libro que no se edita (cartas_movimientos).
--   * Dos límites separados: global (cartas_catalogo.limite, el que ya existía) y por jugador (limite_jugador).
--   * Las copias que «vuelven al mercado» quedan en reserva y se reparten antes de emitir copias nuevas.
--   * cartas_coleccion y cartas_numeradas siguen existiendo: ahora las rellena el propio sistema a partir de los
--     ejemplares, así que el álbum, los mazos y el resto no cambian.
--   * Herramienta del admin para ver y cambiar los límites, y una auditoría que comprueba que todo cuadra.

-- 1) Límite por jugador en el catálogo --------------------------------------------------------
-- null = el que corresponde al tipo: 3 los personajes, 10 criaturas/objetos/terrenos/etc., 1 legendarias y limitadas.
alter table cartas_catalogo add column if not exists limite_jugador int check (limite_jugador is null or limite_jugador between 1 and 99);

-- 2) Tablas -------------------------------------------------------------------------------------
create table if not exists cartas_ejemplares (
  id uuid primary key default gen_random_uuid(),
  carta_id text not null references cartas_catalogo(id),
  numero int not null check (numero >= 1),
  propietario uuid references auth.users(id) on delete set null,
  estado text not null check (estado in ('poseida', 'bloqueada', 'en_reserva', 'en_mercader', 'destruida')),
  atributos jsonb not null default '{}'::jsonb,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  unique (carta_id, numero)
);
create index if not exists cartas_ejemplares_prop_idx on cartas_ejemplares (propietario, carta_id) where propietario is not null;
create index if not exists cartas_ejemplares_reserva_idx on cartas_ejemplares (carta_id, numero) where estado = 'en_reserva';

create table if not exists cartas_movimientos (
  id bigserial primary key,
  ejemplar uuid not null references cartas_ejemplares(id),
  carta_id text not null,
  tipo text not null check (tipo in ('emision', 'entrega_reserva', 'transferencia', 'retirada_reserva',
                                     'retirada_destruida', 'retirada_mercader', 'bloqueo', 'desbloqueo', 'ajuste')),
  de uuid,
  a uuid,
  motivo text not null default '',
  referencia text not null default '',
  por uuid,
  creado timestamptz not null default now()
);
create index if not exists cartas_movimientos_carta_idx on cartas_movimientos (carta_id, creado desc);
create index if not exists cartas_movimientos_de_idx on cartas_movimientos (de, creado desc) where de is not null;
create index if not exists cartas_movimientos_a_idx on cartas_movimientos (a, creado desc) where a is not null;
create index if not exists cartas_movimientos_ref_idx on cartas_movimientos (referencia) where referencia <> '';

-- Copias retenidas por una apuesta, un intercambio, un torneo o un uso temporal
create table if not exists cartas_bloqueos (
  ejemplar uuid primary key references cartas_ejemplares(id) on delete cascade,
  motivo text not null,
  referencia text not null,
  caduca timestamptz,
  creado timestamptz not null default now()
);
create index if not exists cartas_bloqueos_ref_idx on cartas_bloqueos (referencia);

create table if not exists cartas_limites_historial (
  id bigserial primary key,
  carta_id text not null,
  campo text not null check (campo in ('limite', 'limite_jugador')),
  antes int,
  despues int,
  por uuid,
  creado timestamptz not null default now()
);

alter table cartas_ejemplares enable row level security;
alter table cartas_movimientos enable row level security;
alter table cartas_bloqueos enable row level security;
alter table cartas_limites_historial enable row level security;

drop policy if exists "cartas_ejemplares_select" on cartas_ejemplares;
create policy "cartas_ejemplares_select" on cartas_ejemplares for select using (propietario = auth.uid() or fichas_es_admin());
drop policy if exists "cartas_movimientos_select" on cartas_movimientos;
create policy "cartas_movimientos_select" on cartas_movimientos for select using (de = auth.uid() or a = auth.uid() or fichas_es_admin());
drop policy if exists "cartas_bloqueos_select" on cartas_bloqueos;
create policy "cartas_bloqueos_select" on cartas_bloqueos for select using (fichas_es_admin());
drop policy if exists "cartas_limites_historial_select" on cartas_limites_historial;
create policy "cartas_limites_historial_select" on cartas_limites_historial for select using (fichas_es_admin());
-- Sin políticas de escritura: solo las funciones de abajo escriben.

-- 3) Migración de lo que ya existe (una sola vez) ---------------------------------------------------
-- Antes de crear los triggers, para que no se recalcule nada a mitad de camino.
do $$
declare
  r record;
  faltan int;
  i int;
begin
  if exists (select 1 from cartas_ejemplares) then return; end if;

  insert into cartas_ejemplares (carta_id, numero, propietario, estado)
  select carta_id, numero, user_id, 'poseida' from cartas_numeradas;

  for r in select user_id, carta_id, cantidad from cartas_coleccion loop
    select r.cantidad - count(*) into faltan from cartas_numeradas x where x.carta_id = r.carta_id and x.user_id = r.user_id;
    for i in 1..greatest(faltan, 0) loop
      insert into cartas_ejemplares (carta_id, numero, propietario, estado)
      values (r.carta_id, (select coalesce(max(numero), 0) + 1 from cartas_ejemplares where carta_id = r.carta_id), r.user_id, 'poseida');
    end loop;
  end loop;

  insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo)
  select id, carta_id, 'emision', propietario, 'migración' from cartas_ejemplares;
end;
$$;

-- 4) cartas_coleccion y cartas_numeradas se rellenan solas ---------------------------------------------
-- El álbum, los mazos y el resto siguen leyendo esas tablas. Las numeradas solo existen para las legendarias y limitadas.
create or replace function cartas_sincronizar(p_user uuid, p_carta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_user is not null then
    select count(*) into n from cartas_ejemplares
    where propietario = p_user and carta_id = p_carta and estado in ('poseida', 'bloqueada');
    if n > 0 then
      insert into cartas_coleccion (user_id, carta_id, cantidad) values (p_user, p_carta, n)
      on conflict (user_id, carta_id) do update set cantidad = excluded.cantidad;
    else
      delete from cartas_coleccion where user_id = p_user and carta_id = p_carta;
    end if;
  end if;

  delete from cartas_numeradas where carta_id = p_carta;
  insert into cartas_numeradas (carta_id, numero, user_id)
  select e.carta_id, e.numero, e.propietario
  from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id
  where e.carta_id = p_carta and c.rareza in ('legendaria', 'limitada')
    and e.propietario is not null and e.estado in ('poseida', 'bloqueada');
end;
$$;

create or replace function cartas_trg_ejemplares()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then perform cartas_sincronizar(old.propietario, old.carta_id); end if;
  if tg_op in ('INSERT', 'UPDATE') then perform cartas_sincronizar(new.propietario, new.carta_id); end if;
  return null;
end;
$$;

drop trigger if exists cartas_ejemplares_sync on cartas_ejemplares;
create trigger cartas_ejemplares_sync after insert or update or delete on cartas_ejemplares
  for each row execute function cartas_trg_ejemplares();

-- Un límite global nunca baja de lo ya emitido (nadie pierde cartas); y si cambia la rareza o el límite, se rehacen los números
create or replace function cartas_trg_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emitidas int;
begin
  if tg_when = 'BEFORE' then
    if new.limite is not null and new.limite is distinct from old.limite then
      select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = new.id;
      if new.limite < emitidas then
        raise exception 'Ya se emitieron % copias de esta carta: el límite global no puede ser menor', emitidas;
      end if;
    end if;
    return new;
  end if;
  perform cartas_sincronizar(null, new.id);
  return null;
end;
$$;

drop trigger if exists cartas_catalogo_antes on cartas_catalogo;
create trigger cartas_catalogo_antes before update of limite on cartas_catalogo
  for each row execute function cartas_trg_catalogo();
drop trigger if exists cartas_catalogo_despues on cartas_catalogo;
create trigger cartas_catalogo_despues after update of rareza, limite on cartas_catalogo
  for each row execute function cartas_trg_catalogo();

-- 5) Funciones internas (no se llaman desde el navegador) ------------------------------------------------
create or replace function cartas_limite_jugador(p_carta text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select least(
    coalesce(c.limite_jugador, case when c.rareza in ('legendaria', 'limitada') then 1 when c.tipo = 'Personaje' then 3 else 10 end),
    coalesce(c.limite, 2147483647))
  from cartas_catalogo c where c.id = p_carta;
$$;

-- null si el jugador puede recibir p_extra copias más; si no, el motivo
create or replace function cartas_i_error_recibir(p_user uuid, p_carta text, p_extra int default 1)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  lim int := cartas_limite_jugador(p_carta);
  tiene int;
begin
  select count(*) into tiene from cartas_ejemplares
  where propietario = p_user and carta_id = p_carta and estado in ('poseida', 'bloqueada');
  if tiene + p_extra > lim then
    return format('El límite por jugador de esta carta es %s y ya tiene %s', lim, tiene);
  end if;
  return null;
end;
$$;

create or replace function cartas_i_candado(p_carta text)
returns void
language sql
security definer
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtext('cartas_ejemplares_' || p_carta));
$$;

-- Da una copia a un jugador. Primero usa una de la reserva; si no hay, emite una nueva respetando el límite global.
create or replace function cartas_i_emitir(p_user uuid, p_carta text, p_motivo text, p_referencia text default '',
                                           p_por uuid default null, p_sin_limite boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  carta cartas_catalogo%rowtype;
  problema text;
  ej cartas_ejemplares%rowtype;
  emitidas int;
begin
  select * into carta from cartas_catalogo where id = p_carta;
  if not found then raise exception 'Esa carta no existe'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Ese jugador no existe'; end if;
  perform cartas_i_candado(p_carta);

  problema := cartas_i_error_recibir(p_user, p_carta, 1);
  if problema is not null then raise exception '%', problema; end if;

  select * into ej from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva' order by numero limit 1 for update;
  if found then
    update cartas_ejemplares set propietario = p_user, estado = 'poseida', actualizada = now() where id = ej.id;
    insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia, por)
    values (ej.id, p_carta, 'entrega_reserva', p_user, left(p_motivo, 200), left(p_referencia, 200), p_por);
    return jsonb_build_object('ejemplar', ej.id, 'numero', ej.numero, 'de_reserva', true);
  end if;

  select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = p_carta;
  if carta.limite is null and not p_sin_limite then
    raise exception 'Esta carta no tiene límite global definido: no se emite por recompensa';
  end if;
  if carta.limite is not null and emitidas >= carta.limite then
    raise exception 'AGOTADA: ya se emitieron las % copias de esta carta', carta.limite;
  end if;

  insert into cartas_ejemplares (carta_id, numero, propietario, estado)
  values (p_carta, emitidas + 1, p_user, 'poseida') returning * into ej;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia, por)
  values (ej.id, p_carta, 'emision', p_user, left(p_motivo, 200), left(p_referencia, 200), p_por);
  return jsonb_build_object('ejemplar', ej.id, 'numero', ej.numero, 'de_reserva', false);
end;
$$;

-- Cambia una copia de dueño. Si venía bloqueada (apuesta, intercambio), p_desde_bloqueo debe ser true.
create or replace function cartas_i_transferir(p_ejemplar uuid, p_a uuid, p_motivo text, p_referencia text default '',
                                               p_por uuid default null, p_desde_bloqueo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  problema text;
begin
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.estado = 'bloqueada' and not p_desde_bloqueo then raise exception 'Esa copia está bloqueada'; end if;
  if ej.estado not in ('poseida', 'bloqueada') or ej.propietario is null then raise exception 'Esa copia no es de ningún jugador'; end if;
  if ej.propietario = p_a then return; end if;
  problema := cartas_i_error_recibir(p_a, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = p_a, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, a, motivo, referencia, por)
  values (p_ejemplar, ej.carta_id, 'transferencia', ej.propietario, p_a, left(p_motivo, 200), left(p_referencia, 200), p_por);
end;
$$;

-- Retira una copia: p_destino 'reserva' (sigue existiendo, se reparte antes que ninguna emisión nueva),
-- 'destruida' (desaparece para siempre) o 'mercader' (pasa al inventario del mercader).
create or replace function cartas_i_retirar(p_ejemplar uuid, p_destino text, p_motivo text, p_referencia text default '',
                                            p_por uuid default null, p_desde_bloqueo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  nuevo_estado text;
  tipo_mov text;
begin
  if p_destino not in ('reserva', 'destruida', 'mercader') then raise exception 'Destino inválido'; end if;
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.estado = 'bloqueada' and not p_desde_bloqueo then raise exception 'Esa copia está bloqueada'; end if;
  if ej.estado in ('destruida') then raise exception 'Esa copia ya fue destruida'; end if;
  nuevo_estado := case p_destino when 'reserva' then 'en_reserva' when 'destruida' then 'destruida' else 'en_mercader' end;
  tipo_mov := case p_destino when 'reserva' then 'retirada_reserva' when 'destruida' then 'retirada_destruida' else 'retirada_mercader' end;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = null, estado = nuevo_estado, actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia, por)
  values (p_ejemplar, ej.carta_id, tipo_mov, ej.propietario, left(p_motivo, 200), left(p_referencia, 200), p_por);
end;
$$;

-- Retiene copias (apuesta, intercambio, torneo, uso temporal) hasta que se desbloqueen con la misma referencia
create or replace function cartas_i_bloquear(p_ejemplares uuid[], p_motivo text, p_referencia text, p_caduca timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  id_ uuid;
  ej cartas_ejemplares%rowtype;
begin
  foreach id_ in array p_ejemplares loop
    select * into ej from cartas_ejemplares where id = id_ for update;
    if not found then raise exception 'Esa copia no existe'; end if;
    if ej.estado <> 'poseida' then raise exception 'Una de las copias no está libre'; end if;
    update cartas_ejemplares set estado = 'bloqueada', actualizada = now() where id = id_;
    insert into cartas_bloqueos (ejemplar, motivo, referencia, caduca) values (id_, left(p_motivo, 60), left(p_referencia, 200), p_caduca);
    insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia)
    values (id_, ej.carta_id, 'bloqueo', ej.propietario, left(p_motivo, 200), left(p_referencia, 200));
  end loop;
end;
$$;

create or replace function cartas_i_desbloquear(p_referencia text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  fila record;
  n int := 0;
begin
  for fila in select b.ejemplar, e.carta_id, e.propietario from cartas_bloqueos b join cartas_ejemplares e on e.id = b.ejemplar
              where b.referencia = p_referencia for update of e loop
    update cartas_ejemplares set estado = 'poseida', actualizada = now() where id = fila.ejemplar and estado = 'bloqueada';
    insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia)
    values (fila.ejemplar, fila.carta_id, 'desbloqueo', fila.propietario, 'fin del bloqueo', left(p_referencia, 200));
    n := n + 1;
  end loop;
  delete from cartas_bloqueos where referencia = p_referencia;
  return n;
end;
$$;

-- Libera lo que caducó (por ejemplo, una apuesta que nadie aceptó)
create or replace function cartas_i_liberar_caducados()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  n int := 0;
begin
  for ref in select distinct referencia from cartas_bloqueos where caduca is not null and caduca < now() loop
    n := n + cartas_i_desbloquear(ref);
  end loop;
  return n;
end;
$$;

revoke all on function cartas_sincronizar(uuid, text) from public, anon, authenticated;
revoke all on function cartas_trg_ejemplares() from public, anon, authenticated;
revoke all on function cartas_trg_catalogo() from public, anon, authenticated;
revoke all on function cartas_i_error_recibir(uuid, text, int) from public, anon, authenticated;
revoke all on function cartas_i_candado(text) from public, anon, authenticated;
revoke all on function cartas_i_emitir(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_transferir(uuid, uuid, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_retirar(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_bloquear(uuid[], text, text, timestamptz) from public, anon, authenticated;
revoke all on function cartas_i_desbloquear(text) from public, anon, authenticated;
revoke all on function cartas_i_liberar_caducados() from public, anon, authenticated;

-- 6) Lo que ya usaba el admin, ahora sobre ejemplares ------------------------------------------------------
create or replace function cartas_regalar(p_usuario uuid, p_carta text, p_nota text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
  total int;
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'Solo el admin puede regalar cartas';
  end if;
  -- El admin puede dar una carta que todavía no tiene límite global, pero nunca pasar uno definido ni el de por jugador
  res := cartas_i_emitir(p_usuario, p_carta, 'regalo del admin: ' || coalesce(p_nota, ''), '', uid, true);
  select count(*) into total from cartas_ejemplares where propietario = p_usuario and carta_id = p_carta and estado in ('poseida', 'bloqueada');
  insert into cartas_registro (user_id, carta_id, origen, detalle, por)
  values (p_usuario, p_carta, 'admin', left(coalesce(p_nota, ''), 200), uid);
  return jsonb_build_object('carta', p_carta, 'cantidad', total, 'numero', (res ->> 'numero')::int);
end;
$$;

-- Corrige un regalo o retira una copia. Por defecto vuelve a la reserva; con 'destruida' desaparece.
drop function if exists cartas_quitar(uuid, text, text);
create or replace function cartas_quitar(p_usuario uuid, p_carta text, p_nota text default '', p_destino text default 'reserva')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ej uuid;
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'Solo el admin puede quitar cartas';
  end if;
  select id into ej from cartas_ejemplares
  where propietario = p_usuario and carta_id = p_carta and estado = 'poseida'
  order by numero desc limit 1;
  if ej is null then
    raise exception 'Ese jugador no tiene esa carta libre (puede estar bloqueada en una apuesta)';
  end if;
  perform cartas_i_retirar(ej, p_destino, 'quitada por el admin: ' || coalesce(p_nota, ''), '', uid);
  insert into cartas_registro (user_id, carta_id, origen, detalle, por)
  values (p_usuario, p_carta, 'quitada', left(coalesce(p_nota, ''), 200), uid);
end;
$$;

grant execute on function cartas_regalar(uuid, text, text) to authenticated;
grant execute on function cartas_quitar(uuid, text, text, text) to authenticated;
grant execute on function cartas_limite_jugador(text) to authenticated;

-- El editor de cartas no puede borrar una carta con ejemplares (existan o no en una colección)
create or replace function cartas_borrar(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not cartas_puede_editar() then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from cartas_coleccion where carta_id = p_id)
     or exists (select 1 from cartas_numeradas where carta_id = p_id)
     or exists (select 1 from cartas_ejemplares where carta_id = p_id)
     or exists (select 1 from cartas_registro where carta_id = p_id) then
    raise exception 'Alguien ya tuvo esta carta: despublícala en vez de borrarla';
  end if;
  delete from cartas_catalogo where id = p_id;
end;
$$;

-- La recompensa antigua metía cartas directamente en la colección, saltándose los límites. Se cierra hasta que la
-- reemplace el motor de recompensas (economia_3_recompensas.sql).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'cartas_recompensa' and pronamespace = 'public'::regnamespace) then
    revoke all on function cartas_recompensa(text, text, text, integer) from public, anon, authenticated;
  end if;
end;
$$;

-- 7) Herramienta de límites del admin ------------------------------------------------------------------------
create or replace function cartas_admin_limites()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id,
      'nombre', coalesce(d.data ->> 'nombre', c.id),
      'tipo', c.tipo,
      'rareza', c.rareza,
      'publicada', c.publicada,
      'obtenible', c.obtenible,
      'limite', c.limite,
      'limite_jugador', c.limite_jugador,
      'limite_jugador_efectivo', cartas_limite_jugador(c.id),
      'copias_max', c.copias_max,
      'emitidas', coalesce(x.emitidas, 0),
      'poseidas', coalesce(x.poseidas, 0),
      'bloqueadas', coalesce(x.bloqueadas, 0),
      'reserva', coalesce(x.reserva, 0),
      'mercader', coalesce(x.mercader, 0),
      'destruidas', coalesce(x.destruidas, 0)
    ) order by c.tipo, c.rareza, coalesce(d.data ->> 'nombre', c.id))
    from cartas_catalogo c
    left join cartas_definiciones d on d.id = c.id
    left join lateral (
      select count(*) as emitidas,
             count(*) filter (where estado = 'poseida') as poseidas,
             count(*) filter (where estado = 'bloqueada') as bloqueadas,
             count(*) filter (where estado = 'en_reserva') as reserva,
             count(*) filter (where estado = 'en_mercader') as mercader,
             count(*) filter (where estado = 'destruida') as destruidas
      from cartas_ejemplares e where e.carta_id = c.id
    ) x on true
  ), '[]'::jsonb);
end;
$$;

-- p_cambios: [{ "id": "kobold", "limite": 20, "limite_jugador": 10 }]. Una clave ausente no se toca; null la deja sin definir.
create or replace function cartas_admin_guardar_limites(p_cambios jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cambio jsonb;
  carta cartas_catalogo%rowtype;
  nuevo int;
  hechos int := 0;
begin
  if uid is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_cambios is null or jsonb_typeof(p_cambios) <> 'array' or jsonb_array_length(p_cambios) > 500 then
    raise exception 'Cambios inválidos';
  end if;
  for cambio in select value from jsonb_array_elements(p_cambios) loop
    select * into carta from cartas_catalogo where id = cambio ->> 'id' for update;
    if not found then raise exception 'La carta % no existe', cambio ->> 'id'; end if;

    if cambio ? 'limite' then
      nuevo := case when jsonb_typeof(cambio -> 'limite') = 'null' then null else (cambio ->> 'limite')::int end;
      if nuevo is not null and nuevo not between 1 and 999 then raise exception 'El límite global va de 1 a 999 (%)', carta.id; end if;
      if nuevo is distinct from carta.limite then
        update cartas_catalogo set limite = nuevo where id = carta.id;   -- el trigger impide bajar de lo ya emitido
        update cartas_definiciones set data = jsonb_set(data, '{limite}', coalesce(to_jsonb(nuevo), 'null'::jsonb)), actualizada = now(), actualizada_por = uid
          where id = carta.id;
        insert into cartas_limites_historial (carta_id, campo, antes, despues, por) values (carta.id, 'limite', carta.limite, nuevo, uid);
        hechos := hechos + 1;
      end if;
    end if;

    if cambio ? 'limite_jugador' then
      nuevo := case when jsonb_typeof(cambio -> 'limite_jugador') = 'null' then null else (cambio ->> 'limite_jugador')::int end;
      if nuevo is not null and nuevo not between 1 and 99 then raise exception 'El límite por jugador va de 1 a 99 (%)', carta.id; end if;
      if nuevo is distinct from carta.limite_jugador then
        update cartas_catalogo set limite_jugador = nuevo where id = carta.id;
        insert into cartas_limites_historial (carta_id, campo, antes, despues, por) values (carta.id, 'limite_jugador', carta.limite_jugador, nuevo, uid);
        hechos := hechos + 1;
      end if;
    end if;
  end loop;
  return hechos;
end;
$$;

-- Movimientos recientes de una carta o de un jugador (el admin los revisa cuando algo no cuadra)
create or replace function cartas_admin_historial(p_carta text default null, p_usuario uuid default null, p_limite int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(m) order by m.creado desc)
    from (
      select m.id, m.carta_id, e.numero, m.tipo, m.de, m.a, m.motivo, m.referencia, m.creado,
             (select username from perfiles where user_id = m.de) as nombre_de,
             (select username from perfiles where user_id = m.a) as nombre_a
      from cartas_movimientos m join cartas_ejemplares e on e.id = m.ejemplar
      where (p_carta is null or m.carta_id = p_carta) and (p_usuario is null or m.de = p_usuario or m.a = p_usuario)
      order by m.creado desc limit least(coalesce(p_limite, 100), 500)
    ) m
  ), '[]'::jsonb);
end;
$$;

-- Comprueba que todo cuadra. Sin filas = todo bien.
create or replace function cartas_auditoria()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(to_jsonb(p)) from (
    -- numeración con huecos o repetida
    select c.id as carta_id, 'La numeración tiene huecos' as problema,
           format('%s copias y la última lleva el número %s', n, mx) as detalle
    from cartas_catalogo c join lateral (select count(*) n, coalesce(max(numero), 0) mx from cartas_ejemplares e where e.carta_id = c.id) x on true
    where n <> mx
    union all
    select c.id, 'Más copias emitidas que el límite global', format('%s emitidas, límite %s', x.mx, c.limite)
    from cartas_catalogo c join lateral (select coalesce(max(numero), 0) mx from cartas_ejemplares e where e.carta_id = c.id) x on true
    where c.limite is not null and x.mx > c.limite
    union all
    -- estado y dueño que no concuerdan
    select e.carta_id, 'Estado y dueño no concuerdan', format('copia %s en estado %s', e.numero, e.estado)
    from cartas_ejemplares e
    where (e.estado in ('poseida', 'bloqueada') and e.propietario is null) or (e.estado not in ('poseida', 'bloqueada') and e.propietario is not null)
    union all
    -- la colección que ve el jugador no coincide con los ejemplares
    select coalesce(a.carta_id, b.carta_id), 'La colección no coincide con los ejemplares',
           format('colección %s, ejemplares %s', coalesce(a.cantidad, 0), coalesce(b.n, 0))
    from cartas_coleccion a
    full join (select propietario, carta_id, count(*) n from cartas_ejemplares where estado in ('poseida', 'bloqueada') group by 1, 2) b
      on b.propietario = a.user_id and b.carta_id = a.carta_id
    where coalesce(a.cantidad, 0) <> coalesce(b.n, 0)
    union all
    -- un jugador por encima de su límite
    select e.carta_id, 'Un jugador supera su límite por jugador',
           format('%s tiene %s y el límite es %s', (select username from perfiles where user_id = e.propietario), count(*), cartas_limite_jugador(e.carta_id))
    from cartas_ejemplares e where e.estado in ('poseida', 'bloqueada')
    group by e.carta_id, e.propietario having count(*) > cartas_limite_jugador(e.carta_id)
    union all
    -- bloqueos sueltos
    select e.carta_id, 'Copia bloqueada sin bloqueo registrado', format('copia %s', e.numero)
    from cartas_ejemplares e left join cartas_bloqueos b on b.ejemplar = e.id where e.estado = 'bloqueada' and b.ejemplar is null
    union all
    select e.carta_id, 'Bloqueo sobre una copia que no está bloqueada', format('copia %s en estado %s', e.numero, e.estado)
    from cartas_bloqueos b join cartas_ejemplares e on e.id = b.ejemplar where e.estado <> 'bloqueada'
  ) p), '[]'::jsonb);
end;
$$;

grant execute on function cartas_admin_limites() to authenticated;
grant execute on function cartas_admin_guardar_limites(jsonb) to authenticated;
grant execute on function cartas_admin_historial(text, uuid, int) to authenticated;
grant execute on function cartas_auditoria() to authenticated;
