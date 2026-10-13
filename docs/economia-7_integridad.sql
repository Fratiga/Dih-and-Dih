-- ECONOMÍA DE CARTAS, parte 7: integridad (auditoría del 12 de octubre de 2026, hallazgos A1, A2, A3, A9 y A11).
-- BORRADOR SIN APLICAR. Se prueba primero en una rama de pruebas (ver docs/economia-correcciones-plan.md).
-- Corre esto DESPUÉS de economia_1 a economia_6. Se puede correr más de una vez.
--
-- Qué arregla:
--   A1  Los datos de las cartas de un duelo los construye el servidor desde cartas_definiciones. Lo que mande el
--       navegador (p_cartas) se ignora, y quien acepta ya no puede pisar las cartas del retador.
--   A2  Mercader, forja e intercambios comprueban dueño, estado y disponibilidad de cada copia DENTRO de la transacción
--       y con la fila bloqueada, antes de consumirla. Una misma copia no puede entrar en dos operaciones a la vez.
--   A3  Un intercambio respeta los bloqueos: solo mueve copias que siguen bloqueadas por ESE intercambio (las del
--       oferente) o libres y del que acepta. Nunca borra el bloqueo de otra operación.
--   A9  Los topes diarios (mercader, forja, recompensas, retos con apuesta, intercambios abiertos) se comprueban con un
--       candado por jugador, así que dos peticiones en paralelo no pueden pasarse del tope.
--   A11 Recuperación segura de bloqueos atascados y regla de silencio de las apuestas (24 horas, devolución, sin
--       ganador automático).
--
-- Orden de candados (para no provocar interbloqueos): 1) jugadores, en orden de identificador; 2) cartas, en orden
-- alfabético; 3) filas de ejemplares, en orden de identificador. Si aun así Postgres detecta un interbloqueo, aborta una de
-- las dos transacciones y no se pierde nada: el navegador recibe un error y puede reintentar.

-- 0) Ajustes nuevos y tabla de incidencias -------------------------------------------------------------------
insert into cartas_economia_ajustes (clave, valor) values
  ('apuesta_silencio_horas', '24'),      -- un solo aviso de resultado y el otro calla: pasado este plazo se devuelve la apuesta
  ('apuesta_inactividad_horas', '72'),   -- partida apostada sin ningún aviso ni movimiento: pasado este plazo se devuelve (PROPUESTA, por confirmar)
  ('disputa_dias', '14')                 -- una disputa que nadie resuelve en estos días se cierra como no resuelta y devuelve las apuestas
on conflict (clave) do nothing;

-- Motivos con los que se cierra una partida (economia_10 añade «verificada» y «abandono»)
alter table cartas_partidas drop constraint if exists cartas_partidas_motivo_check;
alter table cartas_partidas add constraint cartas_partidas_motivo_check
  check (motivo is null or motivo in ('vida', 'rendicion', 'acuerdo', 'admin', 'tiempo', 'sin_resolver'));

create table if not exists cartas_incidencias (
  id bigserial primary key,
  tipo text not null,
  referencia text not null default '',
  detalle text not null default '',
  creada timestamptz not null default now(),
  resuelta timestamptz,
  resuelta_por uuid
);
create index if not exists cartas_incidencias_abiertas_idx on cartas_incidencias (creada desc) where resuelta is null;
alter table cartas_incidencias enable row level security;
drop policy if exists "cartas_incidencias_select" on cartas_incidencias;
create policy "cartas_incidencias_select" on cartas_incidencias for select using (fichas_es_admin());

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
  if p_ajustes is null or jsonb_typeof(p_ajustes) <> 'object' then raise exception 'Ajustes inválidos'; end if;
  for k in select jsonb_object_keys(p_ajustes) loop
    if k not in ('tope_dia_total', 'multiplicadores', 'pity', 'mejora_personal', 'apuesta_silencio_horas', 'apuesta_inactividad_horas', 'disputa_dias') then
      raise exception 'Ajuste desconocido: %', k;
    end if;
    if k = 'disputa_dias' and (jsonb_typeof(p_ajustes -> k) <> 'number' or (p_ajustes ->> k)::numeric not between 1 and 365) then
      raise exception 'Los días van de 1 a 365 (%)', k;
    end if;
    if k in ('apuesta_silencio_horas', 'apuesta_inactividad_horas') and
       (jsonb_typeof(p_ajustes -> k) <> 'number' or (p_ajustes ->> k)::numeric not between 1 and 720) then
      raise exception 'Las horas van de 1 a 720 (%)', k;
    end if;
    insert into cartas_economia_ajustes (clave, valor, actualizado) values (k, p_ajustes -> k, now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
  end loop;
end;
$$;
grant execute on function cartas_admin_guardar_ajustes(jsonb) to authenticated;

-- 1) Candados y comprobaciones ----------------------------------------------------------------------------------
create or replace function cartas_i_candado_jugador(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select pg_advisory_xact_lock(hashtext('cartas_jugador_' || p_user::text)) where p_user is not null;
$$;

-- Dos jugadores, siempre en el mismo orden
create or replace function cartas_i_candado_jugadores(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_a is null or p_b is null or p_a = p_b then
    perform cartas_i_candado_jugador(coalesce(p_a, p_b));
  elsif p_a::text < p_b::text then
    perform cartas_i_candado_jugador(p_a);
    perform cartas_i_candado_jugador(p_b);
  else
    perform cartas_i_candado_jugador(p_b);
    perform cartas_i_candado_jugador(p_a);
  end if;
end;
$$;

-- Comprueba, con las filas bloqueadas, que TODAS las copias son de p_user y están en p_estado
-- (y, si están bloqueadas, que las retiene la operación p_referencia). Si no, aborta toda la operación.
create or replace function cartas_i_exigir(p_user uuid, p_ids uuid[], p_estado text default 'poseida', p_referencia text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  carta text;
  esperadas int;
  validas int;
begin
  if p_ids is null or coalesce(array_length(p_ids, 1), 0) = 0 then return; end if;
  for carta in select distinct carta_id from cartas_ejemplares where id = any(p_ids) order by carta_id loop
    perform cartas_i_candado(carta);
  end loop;
  perform 1 from cartas_ejemplares where id = any(p_ids) order by id for update;
  select count(distinct x) into esperadas from unnest(p_ids) x;
  select count(*) into validas
  from cartas_ejemplares e
  where e.id = any(p_ids) and e.propietario = p_user and e.estado = p_estado
    and (p_estado <> 'bloqueada' or p_referencia is null
         or exists (select 1 from cartas_bloqueos b where b.ejemplar = e.id and b.referencia = p_referencia));
  if validas <> esperadas then
    raise exception 'Alguna de las cartas ya no está disponible para esta operación (puede haberse movido, apostado o intercambiado)';
  end if;
end;
$$;

-- Como cartas_mazo_error, pero sin la excepción de admin y editores: para jugar con apuesta hay que tener las cartas
create or replace function cartas_i_mazo_error_estricto(p_user uuid, p_cartas jsonb)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  base text := cartas_mazo_error(p_user, p_cartas);
  fila record;
begin
  if base is not null then return base; end if;
  for fila in select key, (value #>> '{}')::int as n from jsonb_each(p_cartas) loop
    if coalesce((select cantidad from cartas_coleccion where user_id = p_user and carta_id = fila.key), 0) < fila.n then
      return 'No tienes suficientes copias de ' || fila.key || ' para jugar con apuesta';
    end if;
  end loop;
  return null;
end;
$$;

-- A1: datos de las cartas de un mazo { cartaId: copias } tal como están en las definiciones oficiales
create or replace function cartas_i_instantanea(p_mazo jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
      'id', c.id,
      'nombre', d.data -> 'nombre',
      'epiteto', coalesce(d.data -> 'epiteto', '""'::jsonb),
      'tipo', to_jsonb(c.tipo),
      'rareza', to_jsonb(c.rareza),
      'afinidad', d.data -> 'afinidad',
      'coste', d.data -> 'coste',
      'atq', coalesce(d.data -> 'atq', 'null'::jsonb),
      'pv', coalesce(d.data -> 'pv', 'null'::jsonb),
      'habilidad', coalesce(d.data -> 'habilidad', '""'::jsonb),
      'imagen', coalesce(d.data -> 'imagen', 'null'::jsonb),
      'ajuste', coalesce(d.data -> 'ajuste', 'null'::jsonb))), '{}'::jsonb)
  from jsonb_object_keys(p_mazo) k
  join cartas_catalogo c on c.id = k
  join cartas_definiciones d on d.id = c.id;
$$;

-- Para los barridos automáticos: si alguno de los dos jugadores está ocupado con otra operación, se salta y se reintenta en la
-- siguiente vuelta, en vez de esperar (así dos barridos que se cruzan nunca se bloquean entre sí)
create or replace function cartas_i_intentar_candado_jugadores(p_a uuid, p_b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_try_advisory_xact_lock(hashtext('cartas_jugador_' || p_a::text)) and pg_try_advisory_xact_lock(hashtext('cartas_jugador_' || p_b::text));
$$;
revoke all on function cartas_i_intentar_candado_jugadores(uuid, uuid) from public, anon, authenticated;
revoke all on function cartas_i_candado_jugador(uuid) from public, anon, authenticated;
revoke all on function cartas_i_candado_jugadores(uuid, uuid) from public, anon, authenticated;
revoke all on function cartas_i_exigir(uuid, uuid[], text, text) from public, anon, authenticated;
revoke all on function cartas_i_mazo_error_estricto(uuid, jsonb) from public, anon, authenticated;
revoke all on function cartas_i_instantanea(jsonb) from public, anon, authenticated;

-- 2) Funciones del núcleo, endurecidas (misma firma que antes) -------------------------------------------------
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
  perform cartas_i_candado_jugador(p_user);
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

-- Cambia una copia de dueño. Si venía bloqueada, p_desde_bloqueo debe ser true Y p_referencia debe ser la del bloqueo.
create or replace function cartas_i_transferir(p_ejemplar uuid, p_a uuid, p_motivo text, p_referencia text default '',
                                               p_por uuid default null, p_desde_bloqueo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  dueno_antes uuid;
  problema text;
begin
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  dueno_antes := ej.propietario;
  perform cartas_i_candado_jugadores(dueno_antes, p_a);
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.propietario is distinct from dueno_antes then raise exception 'Esa copia cambió de dueño mientras se procesaba: vuelve a intentarlo'; end if;
  if ej.estado = 'bloqueada' then
    if not p_desde_bloqueo or not exists (select 1 from cartas_bloqueos b where b.ejemplar = p_ejemplar and b.referencia = p_referencia) then
      raise exception 'Esa copia está bloqueada';
    end if;
  elsif ej.estado <> 'poseida' or ej.propietario is null then
    raise exception 'Esa copia no es de ningún jugador';
  end if;
  if ej.propietario = p_a then return; end if;
  problema := cartas_i_error_recibir(p_a, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = p_a, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, a, motivo, referencia, por)
  values (p_ejemplar, ej.carta_id, 'transferencia', ej.propietario, p_a, left(p_motivo, 200), left(p_referencia, 200), p_por);
end;
$$;

-- Retira una copia de un jugador: 'reserva', 'destruida' o 'mercader'. Solo sirve para copias libres (o bloqueadas por la
-- operación indicada con p_desde_bloqueo). Una copia que ya está en la reserva, el mercader o destruida NO se puede retirar otra vez.
create or replace function cartas_i_retirar(p_ejemplar uuid, p_destino text, p_motivo text, p_referencia text default '',
                                            p_por uuid default null, p_desde_bloqueo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  dueno_antes uuid;
  nuevo_estado text;
  tipo_mov text;
begin
  if p_destino not in ('reserva', 'destruida', 'mercader') then raise exception 'Destino inválido'; end if;
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  dueno_antes := ej.propietario;
  perform cartas_i_candado_jugador(dueno_antes);
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.propietario is distinct from dueno_antes then raise exception 'Esa copia cambió de dueño mientras se procesaba: vuelve a intentarlo'; end if;
  if ej.estado = 'bloqueada' then
    if not p_desde_bloqueo or not exists (select 1 from cartas_bloqueos b where b.ejemplar = p_ejemplar and b.referencia = p_referencia) then
      raise exception 'Esa copia está bloqueada';
    end if;
  elsif ej.estado <> 'poseida' or ej.propietario is null then
    raise exception 'Esa copia no está disponible';
  end if;
  nuevo_estado := case p_destino when 'reserva' then 'en_reserva' when 'destruida' then 'destruida' else 'en_mercader' end;
  tipo_mov := case p_destino when 'reserva' then 'retirada_reserva' when 'destruida' then 'retirada_destruida' else 'retirada_mercader' end;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = null, estado = nuevo_estado, actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia, por)
  values (p_ejemplar, ej.carta_id, tipo_mov, ej.propietario, left(p_motivo, 200), left(p_referencia, 200), p_por);
end;
$$;

-- Retiene copias libres. Las toma en orden para no cruzarse con otra operación.
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
  foreach id_ in array coalesce((select array_agg(x order by x) from unnest(p_ejemplares) x), '{}'::uuid[]) loop
    select * into ej from cartas_ejemplares where id = id_;
    if not found then raise exception 'Esa copia no existe'; end if;
    perform cartas_i_candado(ej.carta_id);
    select * into ej from cartas_ejemplares where id = id_ for update;
    if ej.estado <> 'poseida' then raise exception 'Una de las copias no está libre'; end if;
    update cartas_ejemplares set estado = 'bloqueada', actualizada = now() where id = id_;
    insert into cartas_bloqueos (ejemplar, motivo, referencia, caduca) values (id_, left(p_motivo, 60), left(p_referencia, 200), p_caduca);
    insert into cartas_movimientos (ejemplar, carta_id, tipo, de, motivo, referencia)
    values (id_, ej.carta_id, 'bloqueo', ej.propietario, left(p_motivo, 200), left(p_referencia, 200));
  end loop;
end;
$$;

-- Mueve una copia de dueño sin volver a comprobar límites (quien llama ya comprobó el resultado final).
-- A3: solo mueve copias libres o bloqueadas por ESTA misma operación (p_referencia); nunca borra el bloqueo de otra.
create or replace function cartas_i_mover_forzado(p_ejemplar uuid, p_a uuid, p_motivo text, p_referencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  dueno_antes uuid;
begin
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  dueno_antes := ej.propietario;
  perform cartas_i_candado_jugadores(dueno_antes, p_a);
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.propietario is distinct from dueno_antes then raise exception 'Esa copia cambió de dueño mientras se procesaba: vuelve a intentarlo'; end if;
  if ej.propietario is null or ej.estado not in ('poseida', 'bloqueada') then raise exception 'Esa copia no es de ningún jugador'; end if;
  if ej.estado = 'bloqueada' and not exists (select 1 from cartas_bloqueos b where b.ejemplar = p_ejemplar and b.referencia = p_referencia) then
    raise exception 'Esa copia está bloqueada por otra operación';
  end if;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = p_a, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, a, motivo, referencia)
  values (p_ejemplar, ej.carta_id, 'transferencia', ej.propietario, p_a, left(p_motivo, 200), left(p_referencia, 200));
end;
$$;

create or replace function cartas_i_dar_ejemplar(p_ejemplar uuid, p_user uuid, p_motivo text, p_referencia text default '')
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
  perform cartas_i_candado_jugador(p_user);
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.estado not in ('en_reserva', 'en_mercader') then raise exception 'Esa copia ya no está disponible'; end if;
  problema := cartas_i_error_recibir(p_user, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;
  update cartas_ejemplares set propietario = p_user, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia)
  values (p_ejemplar, ej.carta_id, 'entrega_reserva', p_user, left(p_motivo, 200), left(p_referencia, 200));
end;
$$;

-- 3) Recuperación de bloqueos (A11) -----------------------------------------------------------------------------
-- Bloqueos cuya apuesta o intercambio ya no existe o ya terminó: se sueltan. Es idempotente: soltar dos veces no hace nada
-- la segunda vez, y una copia que ya cambió de dueño no se toca (cartas_i_desbloquear solo actúa sobre estado 'bloqueada').
create or replace function cartas_i_liberar_huerfanos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  n int := 0;
begin
  for ref in
    select distinct b.referencia from cartas_bloqueos b
    where (b.referencia like 'apuesta:%' and not exists (
             select 1 from cartas_partidas p
             where 'apuesta:' || p.id::text = b.referencia and p.apuesta_estado in ('pendiente', 'activa')
               and p.estado in ('pendiente', 'en_curso', 'disputa')))
       or (b.referencia like 'trueque:%' and not exists (
             select 1 from cartas_intercambios t where 'trueque:' || t.id::text = b.referencia and t.estado = 'abierta'))
  loop
    n := n + cartas_i_desbloquear(ref);
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta)
    values ('bloqueo_huerfano_liberado', ref, 'Se soltaron las copias de un bloqueo cuya operación ya había terminado', now());
  end loop;
  return n;
end;
$$;
revoke all on function cartas_i_liberar_huerfanos() from public, anon, authenticated;

-- Devuelve una apuesta activa sin ganador (falta de confirmación)
create or replace function cartas_i_devolver_por_tiempo(p_id uuid, p_detalle text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_partidas%rowtype;
  f cartas_partidas%rowtype;
begin
  select * into previo from cartas_partidas where id = p_id;
  if not found then return; end if;
  if not cartas_i_intentar_candado_jugadores(previo.j1, previo.j2) then return; end if;
  select * into f from cartas_partidas where id = p_id for update;
  if f.estado <> 'en_curso' or f.apuesta_estado is distinct from 'activa' then return; end if;
  update cartas_partidas set estado = 'cancelada', motivo = 'tiempo', actualizada = now() where id = p_id;
  perform cartas_i_apuesta_devolver(p_id);
  insert into cartas_incidencias (tipo, referencia, detalle, resuelta)
  values ('apuesta_devuelta_por_tiempo', 'apuesta:' || p_id::text, left(p_detalle, 300), now());
end;
$$;
revoke all on function cartas_i_devolver_por_tiempo(uuid, text) from public, anon, authenticated;

-- Una disputa que nadie resuelve en «disputa_dias» (14) se cierra como NO RESUELTA: se devuelven las apuestas, nadie gana y el
-- historial queda (la partida conserva los dos avisos y la incidencia los repite).
create or replace function cartas_i_cerrar_disputa_vieja(p_id uuid, p_dias numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_partidas%rowtype;
  f cartas_partidas%rowtype;
begin
  select * into previo from cartas_partidas where id = p_id;
  if not found then return; end if;
  if not cartas_i_intentar_candado_jugadores(previo.j1, previo.j2) then return; end if;
  select * into f from cartas_partidas where id = p_id for update;
  if f.estado <> 'disputa' or f.apuesta_estado is distinct from 'activa' or f.actualizada >= now() - p_dias * interval '1 day' then return; end if;
  update cartas_partidas set estado = 'cancelada', motivo = 'sin_resolver', actualizada = now() where id = p_id;
  perform cartas_i_apuesta_devolver(p_id);
  insert into cartas_incidencias (tipo, referencia, detalle, resuelta)
  values ('disputa_sin_resolver', 'apuesta:' || p_id::text,
          left(format('Disputa de más de %s días sin resolver; apuestas devueltas. %s avisó «%s» y %s avisó «%s».',
                      p_dias, f.nombre1, coalesce(f.reporte1, 'nada'), f.nombre2, coalesce(f.reporte2, 'nada')), 300), now());
end;
$$;
revoke all on function cartas_i_cerrar_disputa_vieja(uuid, numeric) from public, anon, authenticated;

-- Reparte las cartas apostadas según el resultado. Si una carta no se puede mover por un motivo inesperado, la partida
-- queda en disputa con una incidencia para el admin; nunca se traga el error en silencio.
create or replace function cartas_i_resolver_apuesta(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_partidas%rowtype;
  f cartas_partidas%rowtype;
  ref text := 'apuesta:' || p_id::text;
  ganador uuid;
  ids uuid[];
  e uuid;
  fallo boolean := false;
begin
  select * into previo from cartas_partidas where id = p_id;
  if not found then return; end if;
  perform cartas_i_candado_jugadores(previo.j1, previo.j2);
  select * into f from cartas_partidas where id = p_id for update;
  if not found or f.apuesta_estado is distinct from 'activa' then return; end if;
  if p_resultado = 'j1' then ganador := f.j1; ids := f.apuesta2;
  elsif p_resultado = 'j2' then ganador := f.j2; ids := f.apuesta1;
  else
    perform cartas_i_desbloquear(ref);
    update cartas_partidas set apuesta_estado = 'resuelta' where id = p_id;
    return;
  end if;
  foreach e in array ids loop
    begin
      perform cartas_i_transferir(e, ganador, 'apuesta ganada', ref, null, true);
    exception when others then
      if sqlerrm like 'El límite por jugador%' then
        null;   -- ya no cabe en la colección del ganador: la carta se queda con su dueño (se desbloquea abajo)
      else
        fallo := true;
        insert into cartas_incidencias (tipo, referencia, detalle) values ('apuesta_no_resuelta', ref, left(sqlerrm, 300));
      end if;
    end;
  end loop;
  if fallo then
    update cartas_partidas set estado = 'disputa', actualizada = now() where id = p_id;
    return;
  end if;
  perform cartas_i_desbloquear(ref);
  update cartas_partidas set apuesta_estado = 'resuelta' where id = p_id;
end;
$$;

-- Limpieza: retos sin respuesta, apuestas sin confirmación, bloqueos huérfanos y caducados
create or replace function cartas_i_limpiar_apuestas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  horas_silencio numeric := (cartas_ajuste('apuesta_silencio_horas', '24'))::text::numeric;
  horas_inactividad numeric := (cartas_ajuste('apuesta_inactividad_horas', '72'))::text::numeric;
  dias_disputa numeric := (cartas_ajuste('disputa_dias', '14'))::text::numeric;
begin
  for f in select id from cartas_partidas where estado = 'pendiente' and creada < now() - interval '7 days' loop
    update cartas_partidas set estado = 'rechazada', actualizada = now() where id = f.id and estado = 'pendiente';
    perform cartas_i_apuesta_devolver(f.id);
  end loop;
  -- Un solo aviso de resultado y el otro no confirma: NO se da ganador; se devuelve la apuesta
  for f in select id from cartas_partidas
           where estado = 'en_curso' and apuesta_estado = 'activa' and reportado < now() - horas_silencio * interval '1 hour'
             and ((reporte1 is null) <> (reporte2 is null)) loop
    perform cartas_i_devolver_por_tiempo(f.id, format('Un solo aviso y sin confirmar en %s horas', horas_silencio));
  end loop;
  -- Partida apostada sin ningún aviso y sin movimiento
  for f in select id from cartas_partidas
           where estado = 'en_curso' and apuesta_estado = 'activa' and reporte1 is null and reporte2 is null
             and actualizada < now() - horas_inactividad * interval '1 hour' loop
    perform cartas_i_devolver_por_tiempo(f.id, format('Sin avisos ni movimientos en %s horas', horas_inactividad));
  end loop;
  -- Disputas que nadie resolvió en dias_disputa: se cierran sin ganador y se devuelve todo
  for f in select id from cartas_partidas
           where estado = 'disputa' and apuesta_estado = 'activa' and actualizada < now() - dias_disputa * interval '1 day' loop
    perform cartas_i_cerrar_disputa_vieja(f.id, dias_disputa);
  end loop;
  perform cartas_i_liberar_huerfanos();
  perform cartas_i_liberar_caducados();
end;
$$;

-- 4) Duelos: A1 (cartas desde las definiciones oficiales) + candados + regla de apuestas ---------------------------
-- p_cartas se mantiene en la firma para no romper a los navegadores que todavía lo mandan, pero se IGNORA.
create or replace function cartas_retar(p_rival uuid, p_mazo uuid, p_cartas jsonb, p_apuesta uuid[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  nombre_yo text;
  nombre_el text;
  deck jsonb;
  problema text;
  nueva uuid;
  con_apuesta boolean := coalesce(array_length(p_apuesta, 1), 0) > 0;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  if p_rival is null or p_rival = uid then raise exception 'Rival inválido'; end if;
  perform cartas_i_candado_jugadores(uid, p_rival);
  perform cartas_i_limpiar_apuestas();
  select username into nombre_el from perfiles where user_id = p_rival;
  if not found then raise exception 'Ese jugador no existe'; end if;
  select username into nombre_yo from perfiles where user_id = uid;

  select cartas into deck from cartas_mazos where id = p_mazo and user_id = uid;
  if deck is null then raise exception 'Ese mazo no es tuyo'; end if;
  problema := case when con_apuesta then cartas_i_mazo_error_estricto(uid, deck) else cartas_mazo_error(uid, deck) end;
  if problema is not null then raise exception '%', problema; end if;

  if exists (
    select 1 from cartas_partidas
    where estado in ('pendiente', 'en_curso', 'disputa')
      and ((j1 = uid and j2 = p_rival) or (j1 = p_rival and j2 = uid))
  ) then
    raise exception 'Ya tienen una partida abierta';
  end if;
  if (select count(*) from cartas_partidas where j1 = uid and estado = 'pendiente') >= 5 then
    raise exception 'Demasiados retos pendientes';
  end if;

  if con_apuesta then
    problema := cartas_i_error_apuesta(uid, p_apuesta);
    if problema is not null then raise exception '%', problema; end if;
    if (select count(*) from cartas_partidas where (j1 = uid or j2 = uid) and cardinality(apuesta1) > 0 and creada >= date_trunc('day', now())) >= 5 then
      raise exception 'Máximo 5 retos con apuesta al día';
    end if;
    if (select count(*) from cartas_partidas where cardinality(apuesta1) > 0 and creada >= date_trunc('day', now())
          and ((j1 = uid and j2 = p_rival) or (j1 = p_rival and j2 = uid))) >= 2 then
      raise exception 'Ya apostaron dos veces hoy entre ustedes: prueben mañana';
    end if;
    perform cartas_i_exigir(uid, p_apuesta, 'poseida');
  end if;

  insert into cartas_partidas (j1, j2, nombre1, nombre2, mazo1, cartas)
  values (uid, p_rival, coalesce(nombre_yo, 'Anónimo'), coalesce(nombre_el, 'Anónimo'), cartas_aplanar_mazo(deck), cartas_i_instantanea(deck))
  returning id into nueva;

  if con_apuesta then
    perform cartas_i_bloquear(p_apuesta, 'apuesta', 'apuesta:' || nueva::text, now() + interval '8 days');
    update cartas_partidas set apuesta1 = p_apuesta, apuesta1_info = cartas_i_info_apuesta(p_apuesta), apuesta_estado = 'pendiente' where id = nueva;
  end if;
  return nueva;
end;
$$;

create or replace function cartas_responder(p_id uuid, p_aceptar boolean, p_mazo uuid default null, p_cartas jsonb default '{}'::jsonb,
                                            p_apuesta uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  previa cartas_partidas%rowtype;
  fila cartas_partidas%rowtype;
  deck jsonb;
  problema text;
  quien int;
  con_apuesta boolean;
  ref text;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select * into previa from cartas_partidas where id = p_id;
  if not found or uid <> previa.j2 then raise exception 'Partida no encontrada'; end if;
  perform cartas_i_candado_jugadores(previa.j1, previa.j2);
  perform cartas_i_limpiar_apuestas();
  select * into fila from cartas_partidas where id = p_id for update;
  if not found or uid <> fila.j2 then raise exception 'Partida no encontrada'; end if;
  if fila.estado <> 'pendiente' then raise exception 'Este reto ya no está pendiente'; end if;
  con_apuesta := coalesce(array_length(fila.apuesta1, 1), 0) > 0;
  ref := 'apuesta:' || p_id::text;

  if not p_aceptar then
    update cartas_partidas set estado = 'rechazada', actualizada = now() where id = p_id;
    if con_apuesta then perform cartas_i_apuesta_devolver(p_id); end if;
    return;
  end if;

  select cartas into deck from cartas_mazos where id = p_mazo and user_id = uid;
  if deck is null then raise exception 'Elige uno de tus mazos'; end if;
  problema := case when con_apuesta then cartas_i_mazo_error_estricto(uid, deck) else cartas_mazo_error(uid, deck) end;
  if problema is not null then raise exception '%', problema; end if;

  if con_apuesta then
    problema := cartas_i_error_apuesta(uid, p_apuesta);
    if problema is not null then raise exception '%', problema; end if;
    problema := cartas_i_error_equilibrio(fila.apuesta1, p_apuesta);
    if problema is not null then raise exception '%', problema; end if;
    -- Gane quien gane, el que recibe no puede pasar su límite por jugador
    problema := cartas_i_error_pago(fila.j1, p_apuesta);
    if problema is not null then raise exception 'Si ganara el retador no podría recibir tus cartas: %', problema; end if;
    problema := cartas_i_error_pago(fila.j2, fila.apuesta1);
    if problema is not null then raise exception 'Si ganaras no podrías recibir las cartas del retador: %', problema; end if;
    perform cartas_i_exigir(fila.j1, fila.apuesta1, 'bloqueada', ref);
    perform cartas_i_exigir(uid, p_apuesta, 'poseida');
    perform cartas_i_bloquear(p_apuesta, 'apuesta', ref, null);
    update cartas_bloqueos set caduca = null where referencia = ref;
  elsif coalesce(array_length(p_apuesta, 1), 0) > 0 then
    raise exception 'Este reto no lleva apuesta';
  end if;

  quien := case when random() < 0.5 then 0 else 1 end;
  update cartas_partidas
    set estado = 'en_curso',
        mazo2 = cartas_aplanar_mazo(deck),
        cartas = cartas_i_instantanea(deck) || cartas,      -- A1: lo ya guardado del retador manda; nada de lo que mande el navegador
        semilla = floor(random() * 2147483647)::int,
        primero = quien,
        turno = case when quien = 0 then j1 else j2 end,
        apuesta2 = case when con_apuesta then p_apuesta else '{}' end,
        apuesta2_info = case when con_apuesta then cartas_i_info_apuesta(p_apuesta) else '[]'::jsonb end,
        apuesta_estado = case when con_apuesta then 'activa' else apuesta_estado end,
        actualizada = now()
    where id = p_id;
end;
$$;

-- 5) Intercambios (A3) -------------------------------------------------------------------------------------------
create or replace function cartas_aceptar_trueque(p_id uuid, p_ejemplares uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  previo cartas_intercambios%rowtype;
  f cartas_intercambios%rowtype;
  problema text;
  x jsonb;
  e uuid;
  ref text := 'trueque:' || p_id::text;
  nombre_yo text;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select * into previo from cartas_intercambios where id = p_id;
  if not found then raise exception 'Ese intercambio no existe'; end if;
  perform cartas_i_candado_jugadores(uid, previo.de);
  perform cartas_i_limpiar_intercambios();
  select * into f from cartas_intercambios where id = p_id for update;
  if f.estado <> 'abierta' then raise exception 'Ese intercambio ya no está abierto'; end if;
  if f.de = uid then raise exception 'No puedes aceptar tu propio intercambio'; end if;
  if f.para is not null and f.para <> uid then raise exception 'Ese intercambio es para otro jugador'; end if;

  problema := cartas_i_error_copias(uid, p_ejemplares, 5);
  if problema is not null then raise exception 'Lo que entregas: %', problema; end if;
  -- Tiene que ser exactamente lo que se pidió
  if coalesce(array_length(p_ejemplares, 1), 0) <> (select coalesce(sum((y ->> 'n')::int), 0) from jsonb_array_elements(f.pide) y) then
    raise exception 'Tienes que entregar exactamente lo que se pide';
  end if;
  for x in select value from jsonb_array_elements(f.pide) loop
    if (select count(*) from cartas_ejemplares where id = any(p_ejemplares) and carta_id = x ->> 'carta') <> (x ->> 'n')::int then
      raise exception 'Tienes que entregar exactamente lo que se pide';
    end if;
  end loop;

  -- Con los candados puestos: lo que ofrece el oferente sigue retenido por ESTE intercambio, y lo que entrega quien acepta sigue siendo suyo y libre
  perform cartas_i_exigir(f.de, f.ofrece, 'bloqueada', ref);
  perform cartas_i_exigir(uid, p_ejemplares, 'poseida');

  problema := cartas_i_error_canje(f.de, f.ofrece, p_ejemplares);
  if problema is not null then raise exception 'Quien ofrece no puede recibirlo: %', problema; end if;
  problema := cartas_i_error_canje(uid, p_ejemplares, f.ofrece);
  if problema is not null then raise exception 'Tú no podrías recibirlo: %', problema; end if;

  select username into nombre_yo from perfiles where user_id = uid;
  foreach e in array f.ofrece loop perform cartas_i_mover_forzado(e, uid, 'intercambio', ref); end loop;
  foreach e in array p_ejemplares loop perform cartas_i_mover_forzado(e, f.de, 'intercambio', ref); end loop;
  update cartas_intercambios set estado = 'aceptada', aceptada_por = uid, nombre_acepta = coalesce(nombre_yo, 'Anónimo'),
         entregado_info = cartas_i_info_apuesta(p_ejemplares), cerrada = now() where id = p_id;
end;
$$;

create or replace function cartas_cancelar_trueque(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_intercambios%rowtype;
  f cartas_intercambios%rowtype;
begin
  select * into previo from cartas_intercambios where id = p_id;
  if not found or auth.uid() is null or (previo.de <> auth.uid() and not fichas_es_admin()) then raise exception 'Ese intercambio no existe'; end if;
  perform cartas_i_candado_jugador(previo.de);
  select * into f from cartas_intercambios where id = p_id for update;
  if f.estado <> 'abierta' then raise exception 'Ese intercambio ya no está abierto'; end if;
  update cartas_intercambios set estado = 'cancelada', cerrada = now() where id = p_id;
  perform cartas_i_desbloquear('trueque:' || p_id::text);
end;
$$;

-- 6) Envoltorios con candado por jugador (A2 y A9) -----------------------------------------------------------------
-- La función original pasa a llamarse cartas_i_*_nucleo (sin permisos para el navegador) y la pública toma primero el
-- candado del jugador y comprueba las copias con las filas bloqueadas. Se puede correr más de una vez.
do $$
begin
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cartas_i_forjar_nucleo') then
    alter function cartas_forjar(text, uuid[]) rename to cartas_i_forjar_nucleo;
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cartas_i_ofrecer_nucleo') then
    alter function cartas_ofrecer(uuid, uuid[], jsonb, text) rename to cartas_i_ofrecer_nucleo;
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cartas_i_juego_iniciar_nucleo') then
    alter function cartas_juego_iniciar(text, text) rename to cartas_i_juego_iniciar_nucleo;
  end if;
  if not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'cartas_i_juego_terminar_nucleo') then
    alter function cartas_juego_terminar(uuid, text, numeric) rename to cartas_i_juego_terminar_nucleo;
  end if;
end;
$$;

create or replace function cartas_forjar(p_receta text, p_ejemplares uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  perform cartas_i_exigir(uid, p_ejemplares, 'poseida');
  return cartas_i_forjar_nucleo(p_receta, p_ejemplares);
end;
$$;

create or replace function cartas_ofrecer(p_para uuid, p_ofrece uuid[], p_pide jsonb, p_nota text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  perform cartas_i_exigir(uid, p_ofrece, 'poseida');
  return cartas_i_ofrecer_nucleo(p_para, p_ofrece, p_pide, p_nota);
end;
$$;

create or replace function cartas_juego_iniciar(p_juego text, p_clave text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(auth.uid());
  return cartas_i_juego_iniciar_nucleo(p_juego, p_clave);
end;
$$;

create or replace function cartas_juego_terminar(p_token uuid, p_resultado text, p_puntuacion numeric default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(auth.uid());
  return cartas_i_juego_terminar_nucleo(p_token, p_resultado, p_puntuacion);
end;
$$;

-- 7) Mercader (A2 + A9) ---------------------------------------------------------------------------------------------
create or replace function cartas_mercader_comprar(p_oferta uuid, p_ejemplares uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o cartas_mercader_ofertas%rowtype;
  ej cartas_ejemplares%rowtype;
  problema text;
  valor int;
  ref text;
  e uuid;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into o from cartas_mercader_ofertas where id = p_oferta for update;
  if not found or o.estado <> 'activa' then raise exception 'Esa oferta ya no está'; end if;
  if not o.especial and o.dia <> current_date then
    update cartas_mercader_ofertas set estado = 'retirada' where id = p_oferta;
    raise exception 'Esa oferta ya caducó: el mercader cambia de inventario cada día';
  end if;
  select * into ej from cartas_ejemplares where id = o.ejemplar;
  if ej.estado not in ('en_mercader', 'en_reserva') then
    update cartas_mercader_ofertas set estado = 'retirada' where id = p_oferta;
    raise exception 'El mercader ya no tiene esa carta';
  end if;
  if (select count(*) from cartas_mercader_registro where user_id = uid and creado >= date_trunc('day', now())) >= 3 then
    raise exception 'Hoy ya hiciste 3 cambios con el mercader. Vuelve mañana';
  end if;
  if exists (select 1 from cartas_movimientos where tipo = 'retirada_mercader' and de = uid and carta_id = ej.carta_id and creado > now() - interval '24 hours') then
    raise exception 'Esa carta se la diste tú al mercader hace poco: no te la vende de vuelta hasta mañana';
  end if;

  problema := cartas_i_error_copias(uid, p_ejemplares, 5);
  if problema is not null then raise exception 'Lo que entregas: %', problema; end if;
  -- A2: con el candado del jugador y las filas bloqueadas, cada copia sigue siendo suya y libre justo antes de consumirla
  perform cartas_i_exigir(uid, p_ejemplares, 'poseida');
  if exists (select 1 from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id
             where x.id = any(p_ejemplares) and (c.rareza in ('legendaria', 'limitada') or x.carta_id = ej.carta_id)) then
    raise exception 'El mercader no acepta cartas legendarias ni limitadas, ni otra copia de la que te ofrece';
  end if;
  select sum(cartas_categoria_valor(c.rareza)) into valor from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id where x.id = any(p_ejemplares);
  if valor < o.valor_min then raise exception 'No alcanza: tienes que entregar cartas que sumen al menos % de valor (común 1, poco común 2, rara 3) y entregas %', o.valor_min, valor; end if;
  if valor > o.valor_min + 2 then raise exception 'Te pasas: entrega cartas que sumen % de valor, como mucho % (entregas %)', o.valor_min, o.valor_min + 2, valor; end if;
  problema := cartas_i_error_recibir(uid, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;

  ref := 'mercader:' || p_oferta::text;
  foreach e in array p_ejemplares loop perform cartas_i_retirar(e, 'mercader', 'cambio con el mercader', ref); end loop;
  perform cartas_i_dar_ejemplar(o.ejemplar, uid, 'cambio con el mercader', ref);
  update cartas_mercader_ofertas set estado = 'vendida', vendida_a = uid, vendida = now() where id = p_oferta;
  insert into cartas_mercader_registro (user_id, oferta, recibe, entrega)
  values (uid, p_oferta, ej.carta_id, cartas_i_info_apuesta(p_ejemplares));
  insert into cartas_registro (user_id, carta_id, origen, detalle) values (uid, ej.carta_id, 'juego', 'mercader');
  return jsonb_build_object('carta', ej.carta_id, 'numero', ej.numero,
    'nombre', coalesce((select data ->> 'nombre' from cartas_definiciones where id = ej.carta_id), ej.carta_id));
end;
$$;

-- 8) Permisos de lo nuevo y de lo envuelto ------------------------------------------------------------------------
revoke all on function cartas_i_forjar_nucleo(text, uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_ofrecer_nucleo(uuid, uuid[], jsonb, text) from public, anon, authenticated;
revoke all on function cartas_i_juego_iniciar_nucleo(text, text) from public, anon, authenticated;
revoke all on function cartas_i_juego_terminar_nucleo(uuid, text, numeric) from public, anon, authenticated;
revoke all on function cartas_i_emitir(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_transferir(uuid, uuid, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_retirar(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function cartas_i_bloquear(uuid[], text, text, timestamptz) from public, anon, authenticated;
revoke all on function cartas_i_mover_forzado(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function cartas_i_dar_ejemplar(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function cartas_i_resolver_apuesta(uuid, text) from public, anon, authenticated;
revoke all on function cartas_i_limpiar_apuestas() from public, anon, authenticated;
-- Las funciones creadas de cero (los envoltorios) nacen con permiso para todos: se cierra a quien no ha iniciado sesión
revoke execute on function cartas_forjar(text, uuid[]) from public, anon;
revoke execute on function cartas_ofrecer(uuid, uuid[], jsonb, text) from public, anon;
revoke execute on function cartas_juego_iniciar(text, text) from public, anon;
revoke execute on function cartas_juego_terminar(uuid, text, numeric) from public, anon;
grant execute on function cartas_forjar(text, uuid[]) to authenticated;
grant execute on function cartas_ofrecer(uuid, uuid[], jsonb, text) to authenticated;
grant execute on function cartas_juego_iniciar(text, text) to authenticated;
grant execute on function cartas_juego_terminar(uuid, text, numeric) to authenticated;
grant execute on function cartas_retar(uuid, uuid, jsonb, uuid[]) to authenticated;
grant execute on function cartas_responder(uuid, boolean, uuid, jsonb, uuid[]) to authenticated;
grant execute on function cartas_aceptar_trueque(uuid, uuid[]) to authenticated;
grant execute on function cartas_cancelar_trueque(uuid) to authenticated;
grant execute on function cartas_mercader_comprar(uuid, uuid[]) to authenticated;
