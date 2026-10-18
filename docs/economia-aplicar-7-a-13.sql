-- Economía de cartas: migraciones 7 a 13 de una vez (todo o nada). Pégalo entero en el editor SQL de Supabase y ejecútalo.
-- Antes: la copia e0 ya existe (select respaldo_economia_20261013.restaurar('e0') lo deshace).
begin;

-- ===== economia-7_integridad =====
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
  ('disputa_dias', '14'),                -- una disputa que nadie resuelve en estos días se cierra como no resuelta y devuelve las apuestas
  ('motor_version', '"2026.10.13-1"')    -- versión del motor de Triunfos que el servidor da por buena: se copia a cada partida al aceptarla
on conflict (clave) do nothing;

-- Instantánea inmutable de cada partida: quiénes jugaron, con qué cartas y mazos, con qué semilla, con qué vínculos y con qué
-- versión del motor. Se toma UNA vez, al aceptar el reto. Con ella (y no con nada de lo que cambie después) se repite la partida
-- para comprobar quién ganó, así que editar una carta, un vínculo o el motor más tarde no cambia retrospectivamente un resultado.
alter table cartas_partidas add column if not exists instantanea jsonb;
alter table cartas_partidas add column if not exists instantanea_hash text;

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
    if k not in ('tope_dia_total', 'multiplicadores', 'pity', 'mejora_personal', 'apuesta_silencio_horas', 'apuesta_inactividad_horas', 'disputa_dias', 'motor_version') then
      raise exception 'Ajuste desconocido: %', k;
    end if;
    if k = 'motor_version' and (jsonb_typeof(p_ajustes -> k) <> 'string' or (p_ajustes ->> k) !~ '^[0-9A-Za-z._-]{1,40}$') then
      raise exception 'La versión del motor son letras, números, puntos y guiones (hasta 40)';
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

-- Cierra una partida con un resultado: primero reparte las cartas (o las deja bloqueadas si algo falla) y después marca la partida.
-- Si el reparto falla, la partida queda en disputa con una incidencia; nunca se marca como terminada una apuesta sin repartir.
create or replace function cartas_i_cerrar_partida(p_id uuid, p_resultado text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  repartida text;
begin
  perform cartas_i_resolver_apuesta(p_id, p_resultado);
  select apuesta_estado into repartida from cartas_partidas where id = p_id;
  if repartida = 'activa' then
    update cartas_partidas set estado = 'disputa', actualizada = now() where id = p_id;   -- el reparto falló: lo revisa el admin
  else
    update cartas_partidas set estado = 'terminada', resultado = p_resultado, motivo = p_motivo, actualizada = now() where id = p_id;
  end if;
end;
$$;
revoke all on function cartas_i_cerrar_partida(uuid, text, text) from public, anon, authenticated;

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
    return;   -- la apuesta sigue activa y con sus bloqueos: cartas_i_cerrar_partida deja la partida en disputa
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
  nueva_semilla int;
  cartas_finales jsonb;
  mazo2_plano jsonb;
  snap jsonb;
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
  nueva_semilla := floor(random() * 2147483647)::int;
  cartas_finales := cartas_i_instantanea(deck) || fila.cartas;     -- A1: lo ya guardado del retador manda; nada de lo que mande el navegador
  mazo2_plano := cartas_aplanar_mazo(deck);
  -- Instantánea inmutable: todo lo que hace falta para repetir esta partida exactamente igual, ahora y dentro de un año
  snap := jsonb_build_object(
    'formato', 1,
    'participantes', jsonb_build_array(jsonb_build_object('id', fila.j1, 'nombre', fila.nombre1), jsonb_build_object('id', fila.j2, 'nombre', fila.nombre2)),
    'cartas', cartas_finales,
    'mazos', jsonb_build_array(fila.mazo1, mazo2_plano),
    'semilla', nueva_semilla,
    'primero', quien,
    'vinculos', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'tipo', v.tipo, 'data', v.data, 'borrado', v.borrado) order by v.id) from cartas_vinculos v), '[]'::jsonb),
    'motor', cartas_ajuste('motor_version', to_jsonb('2026.10.13-1'::text)),
    'tomada', now());
  update cartas_partidas
    set estado = 'en_curso',
        mazo2 = mazo2_plano,
        cartas = cartas_finales,
        semilla = nueva_semilla,
        primero = quien,
        turno = case when quien = 0 then j1 else j2 end,
        apuesta2 = case when con_apuesta then p_apuesta else '{}' end,
        apuesta2_info = case when con_apuesta then cartas_i_info_apuesta(p_apuesta) else '[]'::jsonb end,
        apuesta_estado = case when con_apuesta then 'activa' else apuesta_estado end,
        instantanea = snap,
        instantanea_hash = md5(snap::text),
        actualizada = now()
    where id = p_id;
end;
$$;

-- 4b) La partida queda congelada: ni los jugadores, ni las funciones, ni una edición a mano pueden cambiar con qué cartas, mazos,
--     semilla, apuesta o versión se jugó, ni reescribir un resultado ya cerrado, ni borrar acciones del registro.
create or replace function cartas_trg_partidas_inmutables()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.j1 is distinct from old.j1 or new.j2 is distinct from old.j2 then
    raise exception 'Una partida no puede cambiar de jugadores';
  end if;
  -- Desde que el reto se acepta (o se cierra), lo que define la partida no se toca
  if old.estado <> 'pendiente' then
    if new.nombre1 is distinct from old.nombre1 or new.nombre2 is distinct from old.nombre2
       or new.mazo1 is distinct from old.mazo1 or new.mazo2 is distinct from old.mazo2
       or new.cartas is distinct from old.cartas or new.semilla is distinct from old.semilla or new.primero is distinct from old.primero
       or new.apuesta1 is distinct from old.apuesta1 or new.apuesta2 is distinct from old.apuesta2
       or new.apuesta1_info is distinct from old.apuesta1_info or new.apuesta2_info is distinct from old.apuesta2_info
       or new.instantanea is distinct from old.instantanea or new.instantanea_hash is distinct from old.instantanea_hash then
      raise exception 'La partida ya empezó: sus participantes, cartas, mazos, semilla, apuesta e instantánea no se pueden cambiar';
    end if;
  end if;
  -- El registro de acciones solo crece
  if jsonb_array_length(new.acciones) < jsonb_array_length(old.acciones) then
    raise exception 'El registro de acciones de una partida no se puede acortar';
  end if;
  -- Un resultado, un motivo o un aviso, una vez puestos, no se reescriben
  if old.resultado is not null and new.resultado is distinct from old.resultado then raise exception 'El resultado de una partida no se puede cambiar'; end if;
  if old.motivo is not null and new.motivo is distinct from old.motivo then raise exception 'El motivo de cierre de una partida no se puede cambiar'; end if;
  if old.reporte1 is not null and new.reporte1 is distinct from old.reporte1 then raise exception 'Un aviso de resultado no se puede cambiar'; end if;
  if old.reporte2 is not null and new.reporte2 is distinct from old.reporte2 then raise exception 'Un aviso de resultado no se puede cambiar'; end if;
  -- Una partida cerrada queda cerrada. Lo único que puede moverse después es que la apuesta pase de pendiente/activa a resuelta/devuelta.
  if old.estado in ('terminada', 'cancelada', 'rechazada') then
    if new.estado is distinct from old.estado or new.acciones is distinct from old.acciones or new.turno is distinct from old.turno then
      raise exception 'La partida ya está cerrada';
    end if;
  end if;
  if new.apuesta_estado is distinct from old.apuesta_estado
     and not ((old.apuesta_estado is null and new.apuesta_estado = 'pendiente')
              or (old.apuesta_estado in ('pendiente', 'activa') and new.apuesta_estado in ('activa', 'resuelta', 'devuelta'))) then
    raise exception 'La apuesta de una partida no puede volver atrás';
  end if;
  return new;
end;
$$;
revoke all on function cartas_trg_partidas_inmutables() from public, anon, authenticated;
drop trigger if exists cartas_partidas_inmutables on cartas_partidas;
create trigger cartas_partidas_inmutables before update on cartas_partidas
  for each row execute function cartas_trg_partidas_inmutables();

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
  -- La forja solo acepta cartas que no están vivas (personajes y criaturas no se destruyen: las criaturas se crían en el corral)
  -- (los tipos que entran son el ajuste forja_tipos de cartas_economia_ajustes; por defecto Objeto, Reacción, Terreno y Acción)
  if exists (select 1 from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id
             where x.id = any(p_ejemplares)
               and c.tipo <> all (array(select jsonb_array_elements_text(cartas_ajuste('forja_tipos', '["Objeto", "Reacción", "Terreno", "Acción"]'::jsonb))))) then
    raise exception 'La forja solo acepta cartas que no están vivas: objetos, reacciones, terrenos y acciones';
  end if;
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


-- ===== economia-8_permisos =====
-- ECONOMÍA DE CARTAS, parte 8: permisos y datos de los jugadores (auditoría del 12 de octubre de 2026, A6, A7 y A10).
-- BORRADOR SIN APLICAR. Se prueba primero en una rama de pruebas (ver docs/economia-correcciones-plan.md).
-- Corre esto DESPUÉS de economia_7_integridad.sql. Se puede correr más de una vez.
--
--   A6  Solo el admin cambia los parámetros económicos de una carta existente (rareza, tipo, lado, disponibilidad para
--       recompensas y límite global). Un editor puede seguir editando el resto (nombre, texto, imagen, coste, ataque...).
--       Una carta NUEVA de un editor nace sin publicar, sin límite global y no ganable; un admin la revisa y la configura.
--       Un editor tampoco publica ni despublica cartas existentes (la disponibilidad es del admin).
--   A7  El Side no se puede cambiar una vez elegido (salvo el admin, que puede previsualizar ambos lados, como ya hace la
--       interfaz). El nombre de usuario es único sin distinguir mayúsculas.
--   A10 Menos permisos: ninguna función de cartas es ejecutable sin sesión (salvo las dos que usan las políticas y la
--       interfaz), las funciones internas no se llaman desde el navegador y las tablas de cartas no admiten escrituras
--       directas (nunca hubo políticas de escritura, así que no se rompe ningún flujo).

-- A6 ---------------------------------------------------------------------------------------------------------------
create or replace function cartas_guardar(p_id text, p_data jsonb, p_publicada boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_rareza text := p_data ->> 'rareza';
  v_tipo text := p_data ->> 'tipo';
  v_lado text[];
  v_limite int;
  v_obtenible boolean;
  v_afin text;
  v_max_numero int;
  v_imagen text := p_data ->> 'imagen';
  v_forma jsonb;
  v_es_admin boolean;
  v_previa cartas_catalogo%rowtype;
  v_existe boolean;
  v_ignorados text[] := '{}';
  v_publicada boolean := coalesce(p_publicada, true);
begin
  if uid is null or not cartas_puede_editar() then
    raise exception 'No autorizado';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,60}$' then
    raise exception 'El identificador solo admite minúsculas, números y guiones (hasta 60)';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 20000 then
    raise exception 'Datos de carta inválidos';
  end if;
  if coalesce(length(p_data ->> 'nombre'), 0) not between 1 and 60 then
    raise exception 'El nombre debe tener entre 1 y 60 letras';
  end if;
  if coalesce(length(p_data ->> 'epiteto'), 0) > 60 then
    raise exception 'El subtítulo es demasiado largo';
  end if;
  if v_tipo not in ('Personaje', 'Criatura', 'Entidad', 'Objeto', 'Acción', 'Terreno', 'Reacción') then
    raise exception 'Tipo de carta inválido';
  end if;
  if v_rareza not in ('comun', 'infrecuente', 'rara', 'legendaria', 'limitada') then
    raise exception 'Rareza inválida';
  end if;
  if jsonb_typeof(p_data -> 'afinidad') <> 'array' or jsonb_array_length(p_data -> 'afinidad') not between 1 and 2 then
    raise exception 'Elige una o dos afinidades';
  end if;
  for v_afin in select jsonb_array_elements_text(p_data -> 'afinidad') loop
    if v_afin not in ('juramento', 'sombra', 'carne', 'arcano', 'eternidad', 'caceria') then
      raise exception 'Afinidad inválida';
    end if;
  end loop;
  if jsonb_typeof(p_data -> 'coste') <> 'number' or (p_data ->> 'coste')::numeric not between 0 and 20 or (p_data ->> 'coste')::numeric <> floor((p_data ->> 'coste')::numeric) then
    raise exception 'El coste va de 0 a 20';
  end if;
  foreach v_afin in array array['atq', 'pv'] loop
    if p_data -> v_afin is not null and jsonb_typeof(p_data -> v_afin) <> 'null' then
      if jsonb_typeof(p_data -> v_afin) <> 'number' or (p_data ->> v_afin)::numeric not between 0 and 99 or (p_data ->> v_afin)::numeric <> floor((p_data ->> v_afin)::numeric) then
        raise exception 'Ataque y vida van de 0 a 99';
      end if;
    end if;
  end loop;
  if coalesce(jsonb_typeof(p_data -> 'atq') = 'number', false) <> coalesce(jsonb_typeof(p_data -> 'pv') = 'number', false) then
    raise exception 'Pon ataque y vida los dos, o ninguno';
  end if;
  if coalesce(length(p_data ->> 'habilidad'), 0) > 600 then
    raise exception 'Las reglas son demasiado largas (600 letras)';
  end if;
  if coalesce(length(p_data ->> 'descripcion'), 0) > 1500 then
    raise exception 'La descripción es demasiado larga (1500 letras)';
  end if;
  if v_imagen is not null and v_imagen !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cartas/[A-Za-z0-9/_.-]+$' then
    raise exception 'La imagen debe estar subida desde el editor';
  end if;
  if p_data ? 'formas' and jsonb_typeof(p_data -> 'formas') <> 'null' then
    if jsonb_typeof(p_data -> 'formas') <> 'array' or jsonb_array_length(p_data -> 'formas') > 7 then
      raise exception 'Una carta puede tener hasta 7 formas además de la base';
    end if;
    for v_forma in select value from jsonb_array_elements(p_data -> 'formas') loop
      if jsonb_typeof(v_forma) <> 'object' then
        raise exception 'Forma inválida';
      end if;
      if coalesce(length(v_forma ->> 'nombre'), 0) not between 1 and 40 then
        raise exception 'El nombre de cada forma debe tener entre 1 y 40 letras';
      end if;
      if (v_forma ->> 'imagen') is not null and (v_forma ->> 'imagen') !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cartas/[A-Za-z0-9/_.-]+$' then
        raise exception 'La imagen de cada forma debe estar subida desde el editor';
      end if;
      if v_forma -> 'ajuste' is not null and jsonb_typeof(v_forma -> 'ajuste') <> 'null' then
        if jsonb_typeof(v_forma -> 'ajuste') <> 'object'
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'z'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'z')::numeric not between 1 and 3
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'x'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'x')::numeric not between 0 and 100
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'y'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'y')::numeric not between 0 and 100 then
          raise exception 'Encuadre de la foto de una forma inválido';
        end if;
      end if;
    end loop;
  end if;
  if p_data -> 'copiasMax' is not null and jsonb_typeof(p_data -> 'copiasMax') <> 'null' then
    if jsonb_typeof(p_data -> 'copiasMax') <> 'number' or (p_data ->> 'copiasMax')::numeric not between 1 and 3
       or (p_data ->> 'copiasMax')::numeric <> floor((p_data ->> 'copiasMax')::numeric) then
      raise exception 'Las copias por mazo van de 1 a 3';
    end if;
  end if;
  if p_data -> 'ajuste' is not null and jsonb_typeof(p_data -> 'ajuste') <> 'null' then
    if jsonb_typeof(p_data -> 'ajuste') <> 'object'
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'z'), '') <> 'number' or (p_data -> 'ajuste' ->> 'z')::numeric not between 1 and 3
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'x'), '') <> 'number' or (p_data -> 'ajuste' ->> 'x')::numeric not between 0 and 100
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'y'), '') <> 'number' or (p_data -> 'ajuste' ->> 'y')::numeric not between 0 and 100 then
      raise exception 'Encuadre de la foto inválido';
    end if;
  end if;
  if p_data ? 'fuente' and jsonb_typeof(p_data -> 'fuente') = 'object' then
    if (p_data -> 'fuente' ->> 'data') not in ('PERSONAJES', 'BESTIARIO', 'OBJETOS', 'LUGARES') or (p_data -> 'fuente' ->> 'id') !~ '^[a-z0-9-]{1,80}$' then
      raise exception 'Entrada del compendio inválida';
    end if;
  end if;

  if p_data -> 'lado' is null or jsonb_typeof(p_data -> 'lado') = 'null' then
    v_lado := null;
  else
    if jsonb_typeof(p_data -> 'lado') <> 'array' then raise exception 'Lado inválido'; end if;
    select array_agg(x) into v_lado from jsonb_array_elements_text(p_data -> 'lado') x;
    if exists (select 1 from unnest(v_lado) x where x not in ('A', 'B')) then
      raise exception 'Lado inválido';
    end if;
  end if;

  if p_data -> 'limite' is null or jsonb_typeof(p_data -> 'limite') = 'null' then
    v_limite := null;
  else
    if jsonb_typeof(p_data -> 'limite') <> 'number' or (p_data ->> 'limite')::numeric not between 1 and 999 then
      raise exception 'El límite de copias va de 1 a 999';
    end if;
    v_limite := (p_data ->> 'limite')::int;
    select coalesce(max(numero), 0) into v_max_numero from cartas_ejemplares where carta_id = p_id;
    if v_limite < v_max_numero then
      raise exception 'Ya se emitieron % copias de esta carta: el límite no puede ser menor', v_max_numero;
    end if;
  end if;

  v_obtenible := coalesce((p_data ->> 'obtenible')::boolean, true);

  -- A6: lo económico solo lo cambia el admin
  v_es_admin := fichas_es_admin();
  select * into v_previa from cartas_catalogo where id = p_id;
  v_existe := found;
  if not v_es_admin then
    if v_existe then
      if v_rareza is distinct from v_previa.rareza then v_ignorados := array_append(v_ignorados, 'rareza'); end if;
      if v_tipo is distinct from v_previa.tipo then v_ignorados := array_append(v_ignorados, 'tipo'); end if;
      if v_lado is distinct from v_previa.lado then v_ignorados := array_append(v_ignorados, 'lado'); end if;
      if v_limite is distinct from v_previa.limite then v_ignorados := array_append(v_ignorados, 'limite'); end if;
      if v_obtenible is distinct from v_previa.obtenible then v_ignorados := array_append(v_ignorados, 'obtenible'); end if;
      if v_publicada is distinct from v_previa.publicada then v_ignorados := array_append(v_ignorados, 'publicada'); end if;
      v_publicada := v_previa.publicada;
      v_rareza := v_previa.rareza; v_tipo := v_previa.tipo; v_lado := v_previa.lado;
      v_limite := v_previa.limite; v_obtenible := v_previa.obtenible;
    else
      -- Una carta nueva de un editor queda sin publicar, sin límite global y no obtenible hasta que un admin la revise y la configure
      if v_publicada then v_ignorados := array_append(v_ignorados, 'publicada'); end if;
      v_publicada := false;
      v_limite := null;
      v_obtenible := false;
    end if;
    p_data := p_data || jsonb_build_object('rareza', v_rareza, 'tipo', v_tipo, 'lado', to_jsonb(v_lado),
                                           'limite', to_jsonb(v_limite), 'obtenible', v_obtenible);
  end if;

  insert into cartas_catalogo (id, rareza, lado, obtenible, limite, publicada, tipo, copias_max)
  values (p_id, v_rareza, v_lado, v_obtenible, v_limite, v_publicada,
          v_tipo, (p_data ->> 'copiasMax')::int)
  on conflict (id) do update set
    rareza = excluded.rareza, lado = excluded.lado, obtenible = excluded.obtenible,
    limite = excluded.limite, publicada = excluded.publicada, tipo = excluded.tipo, copias_max = excluded.copias_max;

  insert into cartas_definiciones (id, data, actualizada, actualizada_por)
  values (p_id, p_data, now(), uid)
  on conflict (id) do update set data = excluded.data, actualizada = now(), actualizada_por = uid;

  return jsonb_build_object('id', p_id, 'publicada', v_publicada, 'ignorados', to_jsonb(v_ignorados));
end;
$$;
grant execute on function cartas_guardar(text, jsonb, boolean) to authenticated;

-- A7: Side permanente y nombre de usuario único -----------------------------------------------------------------------
-- Nombres repetidos que ya existieran: el más antiguo (por user_id) se queda con el suyo y los demás pasan a "nombre (2)",
-- "nombre (3)"... Hoy no hay ninguno, así que esto no cambia nada, pero así la migración nunca falla por datos viejos.
do $$
declare
  r record;
  n int;
begin
  for r in
    select user_id, username,
           row_number() over (partition by lower(btrim(username)) order by user_id) as pos
    from perfiles where username is not null and btrim(username) <> ''
  loop
    if r.pos > 1 then
      n := r.pos;
      while exists (select 1 from perfiles where lower(btrim(username)) = lower(btrim(r.username || ' (' || n || ')'))) loop
        n := n + 1;
      end loop;
      update perfiles set username = r.username || ' (' || n || ')' where user_id = r.user_id;
    end if;
  end loop;
end;
$$;

create unique index if not exists perfiles_username_unico on perfiles (lower(btrim(username)))
  where username is not null and btrim(username) <> '';

create or replace function perfiles_proteger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cambia_nombre boolean := new.username is not null;
begin
  if new.side is not null and new.side not in ('A', 'B') then
    raise exception 'Side inválido';
  end if;
  if tg_op = 'UPDATE' then
    if old.side is not null and new.side is distinct from old.side then
      -- El Side es permanente. Solo el admin puede cambiar el suyo (para previsualizar ambos lados) y quien trabaja con
      -- el rol de servicio o desde el editor SQL (sin sesión de jugador).
      if auth.uid() is not null and not fichas_es_admin() then
        raise exception 'El Side no se puede cambiar';
      end if;
    end if;
    cambia_nombre := new.username is not null and new.username is distinct from old.username;
  end if;
  if cambia_nombre then
    new.username := btrim(new.username);
    if new.username <> '' and char_length(new.username) not between 2 and 30 then
      raise exception 'El nombre de usuario debe tener entre 2 y 30 caracteres';
    end if;
    if new.username ~ '[[:cntrl:]]' then
      raise exception 'El nombre de usuario tiene caracteres no válidos';
    end if;
    if new.username <> '' and exists (select 1 from perfiles p where lower(btrim(p.username)) = lower(new.username) and p.user_id <> new.user_id) then
      raise exception 'Ese nombre de usuario ya está en uso';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function perfiles_proteger() from public, anon, authenticated;

drop trigger if exists perfiles_proteger_trg on perfiles;
create trigger perfiles_proteger_trg before insert or update on perfiles
  for each row execute function perfiles_proteger();

-- La política antigua permitía también DELETE: borrar el perfil y crearlo de nuevo con otro Side saltaba la protección
drop policy if exists "Cada quien lee y edita su propio perfil" on perfiles;
drop policy if exists "perfiles_select_propio" on perfiles;
drop policy if exists "perfiles_insert_propio" on perfiles;
drop policy if exists "perfiles_update_propio" on perfiles;
create policy "perfiles_select_propio" on perfiles for select to authenticated using (auth.uid() = user_id);
create policy "perfiles_insert_propio" on perfiles for insert to authenticated with check (auth.uid() = user_id);
create policy "perfiles_update_propio" on perfiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A10: funciones ----------------------------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname
           from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'cartas\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    -- internas: el navegador nunca las llama
    if f.proname like 'cartas\_i\_%' or f.proname like 'cartas\_trg\_%' or f.proname in ('cartas_sincronizar', 'cartas_ajuste', 'cartas_mazo_error') then
      execute format('revoke execute on function %s from authenticated', f.firma);
    end if;
  end loop;
end;
$$;
-- Las usan las políticas de lectura y la interfaz antes de iniciar sesión
grant execute on function cartas_puede_editar() to anon, authenticated;
grant execute on function cartas_es_editor() to anon, authenticated;

-- A10: tablas. Ninguna tabla de cartas tiene políticas de escritura, así que ningún flujo escribe directamente.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'cartas\_%' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on table %I from anon, authenticated', t);
  end loop;
end;
$$;
revoke all on table perfiles from anon;
revoke delete, truncate, references, trigger on table perfiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on table fichas_admins from anon, authenticated;


-- ===== economia-9_panel_admin =====
-- ECONOMÍA DE CARTAS, parte 9: funciones del panel de administración (disputas, apuestas atascadas, bloqueos, juegos y recetas).
-- BORRADOR SIN APLICAR. Se prueba primero en una rama de pruebas (ver docs/economia-correcciones-plan.md).
-- Corre esto DESPUÉS de economia_7_integridad.sql y economia_8_permisos.sql. Se puede correr más de una vez.
-- Todas comprueban fichas_es_admin() dentro: un editor o un jugador reciben "No autorizado".

-- Apuestas que necesitan atención o que siguen abiertas. El admin no puede leer cartas_partidas (la política solo deja ver
-- las propias), así que esto es lo que le da la vista completa.
create or replace function cartas_admin_apuestas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  horas_silencio numeric := (cartas_ajuste('apuesta_silencio_horas', '24'))::text::numeric;
  horas_inactividad numeric := (cartas_ajuste('apuesta_inactividad_horas', '72'))::text::numeric;
  dias_disputa numeric := (cartas_ajuste('disputa_dias', '14'))::text::numeric;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.prioridad, x.creada)
    from (
      select p.id, p.estado, p.apuesta_estado, p.motivo, p.resultado, p.j1, p.j2, p.nombre1, p.nombre2,
             p.apuesta1_info, p.apuesta2_info, p.reporte1, p.reporte2, p.reportado, p.creada, p.actualizada,
             case
               when p.estado = 'disputa' then 'disputa'
               when p.estado = 'en_curso' and ((p.reporte1 is null) <> (p.reporte2 is null)) then 'un_aviso'
               when p.estado = 'en_curso' and p.reporte1 is null and p.reporte2 is null then 'sin_avisos'
               when p.estado = 'pendiente' then 'sin_respuesta'
               else 'otra'
             end as situacion,
             case
               when p.estado = 'disputa' then 1
               when p.estado = 'en_curso' and ((p.reporte1 is null) <> (p.reporte2 is null)) then 2
               when p.estado = 'en_curso' then 3
               else 4
             end as prioridad,
             case
               when p.estado = 'en_curso' and ((p.reporte1 is null) <> (p.reporte2 is null))
                 then p.reportado + horas_silencio * interval '1 hour'
               when p.estado = 'en_curso' and p.reporte1 is null and p.reporte2 is null
                 then p.actualizada + horas_inactividad * interval '1 hour'
               when p.estado = 'pendiente' then p.creada + interval '7 days'
               when p.estado = 'disputa' then p.actualizada + dias_disputa * interval '1 day'
             end as se_devuelve_el
      from cartas_partidas p
      where p.apuesta_estado in ('pendiente', 'activa') or p.estado = 'disputa'
         or (p.apuesta_estado in ('resuelta', 'devuelta') and p.actualizada > now() - interval '14 days')
    ) x
  ), '[]'::jsonb);
end;
$$;

-- Partida completa (acciones y datos) para revisar una disputa
create or replace function cartas_admin_partida(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fila cartas_partidas%rowtype;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into fila from cartas_partidas where id = p_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  return to_jsonb(fila);
end;
$$;

-- El admin resuelve una disputa o una partida abandonada: 'j1', 'j2', 'empate' o 'cancelar' (devuelve todo).
-- Misma firma que antes; ahora además deja constancia en las incidencias.
create or replace function cartas_admin_resolver_apuesta(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  previa cartas_partidas%rowtype;
  fila cartas_partidas%rowtype;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_resultado not in ('j1', 'j2', 'empate', 'cancelar') then raise exception 'Resultado inválido'; end if;
  select * into previa from cartas_partidas where id = p_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  perform cartas_i_candado_jugadores(previa.j1, previa.j2);
  select * into fila from cartas_partidas where id = p_id for update;
  if fila.estado not in ('en_curso', 'disputa', 'pendiente') then raise exception 'La partida ya terminó'; end if;
  if p_resultado = 'cancelar' then
    update cartas_partidas set estado = 'cancelada', motivo = 'admin', actualizada = now() where id = p_id;
    if fila.apuesta_estado in ('pendiente', 'activa') then perform cartas_i_apuesta_devolver(p_id); end if;
  else
    perform cartas_i_cerrar_partida(p_id, p_resultado, 'admin');
  end if;
  insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
  values ('apuesta_resuelta_por_admin', 'apuesta:' || p_id::text, 'Resultado: ' || p_resultado, now(), auth.uid());
end;
$$;

-- Bloqueos agrupados por la operación que los retiene, con el estado real de esa operación
create or replace function cartas_admin_bloqueos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(g) order by g.situacion desc, g.desde)
    from (
      select b.referencia,
             min(b.creado) as desde,
             min(b.caduca) as caduca,
             count(*) as copias,
             jsonb_agg(jsonb_build_object('ejemplar', e.id, 'carta', e.carta_id, 'numero', e.numero, 'propietario', e.propietario,
                                          'nombre', (select username from perfiles where user_id = e.propietario)) order by e.carta_id, e.numero) as cartas,
             case
               when b.referencia like 'apuesta:%' then coalesce((
                 select case when p.apuesta_estado in ('pendiente', 'activa') and p.estado in ('pendiente', 'en_curso', 'disputa') then 'activa' else 'cerrada' end
                 from cartas_partidas p where 'apuesta:' || p.id::text = b.referencia), 'inexistente')
               when b.referencia like 'trueque:%' then coalesce((
                 select case when t.estado = 'abierta' then 'activa' else 'cerrada' end
                 from cartas_intercambios t where 'trueque:' || t.id::text = b.referencia), 'inexistente')
               else 'desconocida'
             end as situacion
      from cartas_bloqueos b join cartas_ejemplares e on e.id = b.ejemplar
      group by b.referencia
    ) g
  ), '[]'::jsonb);
end;
$$;

-- Suelta los bloqueos de una operación que ya terminó (o que no existe). Si la operación sigue activa, no lo permite:
-- hay que resolverla (apuesta) o cancelarla (intercambio), que devuelven las cartas una sola vez y con su registro.
create or replace function cartas_admin_liberar_bloqueos(p_referencia text, p_motivo text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  situacion text;
  n int;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if coalesce(length(btrim(p_motivo)), 0) < 5 then raise exception 'Escribe un motivo (mínimo 5 letras)'; end if;
  if not exists (select 1 from cartas_bloqueos where referencia = p_referencia) then raise exception 'No hay copias bloqueadas con esa referencia'; end if;
  situacion := case
    when p_referencia like 'apuesta:%' then coalesce((
      select case when p.apuesta_estado in ('pendiente', 'activa') and p.estado in ('pendiente', 'en_curso', 'disputa') then 'activa' else 'cerrada' end
      from cartas_partidas p where 'apuesta:' || p.id::text = p_referencia), 'inexistente')
    when p_referencia like 'trueque:%' then coalesce((
      select case when t.estado = 'abierta' then 'activa' else 'cerrada' end
      from cartas_intercambios t where 'trueque:' || t.id::text = p_referencia), 'inexistente')
    else 'desconocida'
  end;
  if situacion = 'activa' then
    raise exception 'Esa operación sigue activa: resuélvela o cancélala desde su pestaña, no se sueltan sus copias a mano';
  end if;
  n := cartas_i_desbloquear(p_referencia);
  insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
  values ('bloqueo_liberado_por_admin', p_referencia, left(p_motivo, 300), now(), auth.uid());
  return n;
end;
$$;

create or replace function cartas_admin_incidencias(p_incluir_resueltas boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(i) order by i.creada desc)
    from (select * from cartas_incidencias where p_incluir_resueltas or resuelta is null order by creada desc limit 200) i
  ), '[]'::jsonb);
end;
$$;

create or replace function cartas_admin_cerrar_incidencia(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  update cartas_incidencias set resuelta = now(), resuelta_por = auth.uid() where id = p_id and resuelta is null;
end;
$$;

-- Recetas de la forja, ahora con validación (antes aceptaba cualquier JSON)
create or replace function cartas_admin_guardar_receta(p_id text, p_cfg jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g jsonb;
  total int := 0;
  t text;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,40}$' then raise exception 'El identificador de la receta solo admite minúsculas, números y guiones'; end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Receta inválida'; end if;
  if p_cfg ? 'entrada' then
    if jsonb_typeof(p_cfg -> 'entrada') <> 'array' or jsonb_array_length(p_cfg -> 'entrada') not between 1 and 4 then
      raise exception 'La entrada lleva de 1 a 4 grupos de cartas';
    end if;
    for g in select value from jsonb_array_elements(p_cfg -> 'entrada') loop
      if jsonb_typeof(g) <> 'object' or (g ->> 'rareza') not in ('comun', 'infrecuente', 'rara') then
        raise exception 'Cada grupo de entrada necesita una rareza: común, poco común o rara (la forja no usa legendarias ni limitadas)';
      end if;
      if jsonb_typeof(g -> 'n') <> 'number' or (g ->> 'n')::numeric not between 1 and 12 or (g ->> 'n')::numeric <> floor((g ->> 'n')::numeric) then
        raise exception 'Cada grupo pide de 1 a 12 cartas';
      end if;
      total := total + (g ->> 'n')::int;
      if g ? 'tipos' then
        if jsonb_typeof(g -> 'tipos') <> 'array' then raise exception 'Los tipos son una lista'; end if;
        for t in select jsonb_array_elements_text(g -> 'tipos') loop
          if t not in ('Personaje', 'Criatura', 'Entidad', 'Objeto', 'Acción', 'Terreno', 'Reacción') then raise exception 'Tipo inválido: %', t; end if;
        end loop;
      end if;
    end loop;
    if total > 12 then raise exception 'La forja admite como mucho 12 cartas por receta'; end if;
  end if;
  if p_cfg ? 'salida' then
    if jsonb_typeof(p_cfg -> 'salida') <> 'object' or (p_cfg -> 'salida' ->> 'rareza') not in ('comun', 'infrecuente', 'rara') then
      raise exception 'La salida necesita una rareza: común, poco común o rara';
    end if;
  end if;
  if p_cfg ? 'exito' and (jsonb_typeof(p_cfg -> 'exito') <> 'number' or (p_cfg ->> 'exito')::numeric not between 0 and 1) then
    raise exception 'El éxito va de 0 a 1';
  end if;
  if p_cfg ? 'al_fallar' and (p_cfg ->> 'al_fallar') not in ('perder_todo', 'devolver_una') then raise exception 'Al fallar: perder_todo o devolver_una'; end if;
  if p_cfg ? 'destino' and (p_cfg ->> 'destino') not in ('destruida', 'reserva') then raise exception 'Destino: destruida o reserva'; end if;

  insert into cartas_recetas (id, nombre, descripcion, activa, entrada, salida, exito, al_fallar, destino, orden)
  values (p_id, coalesce(p_cfg ->> 'nombre', p_id), coalesce(p_cfg ->> 'descripcion', ''), coalesce((p_cfg ->> 'activa')::boolean, true),
          coalesce(p_cfg -> 'entrada', '[]'::jsonb), coalesce(p_cfg -> 'salida', '{}'::jsonb), coalesce((p_cfg ->> 'exito')::numeric, 1),
          coalesce(p_cfg ->> 'al_fallar', 'perder_todo'), coalesce(p_cfg ->> 'destino', 'destruida'), coalesce((p_cfg ->> 'orden')::int, 0))
  on conflict (id) do update set
    nombre = coalesce(p_cfg ->> 'nombre', cartas_recetas.nombre), descripcion = coalesce(p_cfg ->> 'descripcion', cartas_recetas.descripcion),
    activa = coalesce((p_cfg ->> 'activa')::boolean, cartas_recetas.activa), entrada = coalesce(p_cfg -> 'entrada', cartas_recetas.entrada),
    salida = coalesce(p_cfg -> 'salida', cartas_recetas.salida), exito = coalesce((p_cfg ->> 'exito')::numeric, cartas_recetas.exito),
    al_fallar = coalesce(p_cfg ->> 'al_fallar', cartas_recetas.al_fallar), destino = coalesce(p_cfg ->> 'destino', cartas_recetas.destino),
    orden = coalesce((p_cfg ->> 'orden')::int, cartas_recetas.orden), actualizada = now();
end;
$$;

-- Todas las recetas, también las desactivadas (la lectura directa solo deja ver las activas a quien las usa)
create or replace function cartas_admin_recetas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(to_jsonb(r) order by r.orden, r.id) from cartas_recetas r), '[]'::jsonb);
end;
$$;

revoke execute on function cartas_admin_apuestas() from public, anon;
revoke execute on function cartas_admin_partida(uuid) from public, anon;
revoke execute on function cartas_admin_bloqueos() from public, anon;
revoke execute on function cartas_admin_liberar_bloqueos(text, text) from public, anon;
revoke execute on function cartas_admin_incidencias(boolean) from public, anon;
revoke execute on function cartas_admin_cerrar_incidencia(bigint) from public, anon;
revoke execute on function cartas_admin_recetas() from public, anon;
grant execute on function cartas_admin_apuestas() to authenticated;
grant execute on function cartas_admin_partida(uuid) to authenticated;
grant execute on function cartas_admin_resolver_apuesta(uuid, text) to authenticated;
grant execute on function cartas_admin_bloqueos() to authenticated;
grant execute on function cartas_admin_liberar_bloqueos(text, text) to authenticated;
grant execute on function cartas_admin_incidencias(boolean) to authenticated;
grant execute on function cartas_admin_cerrar_incidencia(bigint) to authenticated;
grant execute on function cartas_admin_guardar_receta(text, jsonb) to authenticated;
grant execute on function cartas_admin_recetas() to authenticated;


-- ===== economia-10_verificacion =====
-- ECONOMÍA DE CARTAS, parte 10: verificar las partidas apostadas con su registro de acciones (avisos falsos y abandono).
-- BORRADOR SIN APLICAR. Se prueba en el entorno local (docs/pruebas). Corre DESPUÉS de economia_7, 8 y 9. Se puede correr más de una vez.
--
-- Idea: el motor del combate es determinista y una acción ilegal se ignora igual en todos los navegadores, así que la lista de
-- acciones guardada en cartas_partidas decide quién ganó. Una Edge Function («cartas-verificar», docs/cartas-verificar.ts) vuelve
-- a jugar la partida con el mismo motor y llama a cartas_i_aplicar_verificacion con el veredicto. Lo que cada jugador «avise»
-- pasa a ser solo una pista:
--   * Un aviso falso ya no gana nada: si el registro dice otra cosa, se reparte según el registro y queda anotado quién mintió.
--   * Un jugador que desaparece pierde: si quien tiene que actuar lleva 48 horas (apuesta_turno_horas) sin hacerlo, pierde por abandono.
-- Si la Edge Function no está o no puede decidir, siguen valiendo las reglas de economia_7 (disputa para el admin, devolución a las
-- 24 y 72 horas y cierre sin ganador a los 14 días).
--
-- Por qué el registro es de fiar: lo escribe solo cartas_accion (security definer), que exige ser jugador de la partida, que sea
-- su turno y que la partida esté en curso; el navegador no tiene permiso de escritura sobre cartas_partidas (economia_8) y la
-- semilla, los mazos y las cartas de la partida los fija el servidor (economia_7). Aquí se añaden tres seguros más, dentro de la
-- base de datos y por tanto imposibles de saltar desde la función:
--   1. La partida se repite con su INSTANTÁNEA INMUTABLE (economia_7: participantes, cartas, mazos, semilla, vínculos y versión del
--      motor, tomada al aceptar el reto y protegida por un disparador y por una huella). Editar después una carta, un vínculo o el
--      motor no cambia retrospectivamente quién ganó. La base comprueba que la huella siga siendo la de entonces.
--   2. El motor con el que se repite es el que el servidor fijó para esa partida (ajuste motor_version, copiado a la instantánea).
--      No lo elige ningún jugador: así nadie puede "envenenar" la versión para escapar de la verificación.
--   3. El registro no pudo cambiar entre que se repitió y que se aplica (mismo número de acciones y, para el abandono, la misma
--      marca de tiempo de última actividad).
--   4. El plazo de abandono lo mide el reloj de la base de datos, no el de quien llama.

alter table cartas_partidas drop constraint if exists cartas_partidas_motivo_check;
alter table cartas_partidas add constraint cartas_partidas_motivo_check
  check (motivo is null or motivo in ('vida', 'rendicion', 'acuerdo', 'admin', 'tiempo', 'sin_resolver', 'verificada', 'abandono'));

insert into cartas_economia_ajustes (clave, valor) values
  ('apuesta_turno_horas', '48')      -- horas sin actuar quien tiene que hacerlo antes de perder por abandono
on conflict (clave) do nothing;

alter table cartas_incidencias add column if not exists jugador uuid references auth.users(id) on delete set null;
create index if not exists cartas_incidencias_jugador_idx on cartas_incidencias (jugador) where jugador is not null;

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
    if k not in ('tope_dia_total', 'multiplicadores', 'pity', 'mejora_personal', 'apuesta_silencio_horas', 'apuesta_inactividad_horas',
                 'apuesta_turno_horas', 'disputa_dias', 'motor_version') then
      raise exception 'Ajuste desconocido: %', k;
    end if;
    if k in ('apuesta_silencio_horas', 'apuesta_inactividad_horas', 'apuesta_turno_horas') and
       (jsonb_typeof(p_ajustes -> k) <> 'number' or (p_ajustes ->> k)::numeric not between 1 and 720) then
      raise exception 'Las horas van de 1 a 720 (%)', k;
    end if;
    if k = 'motor_version' and (jsonb_typeof(p_ajustes -> k) <> 'string' or (p_ajustes ->> k) !~ '^[0-9A-Za-z._-]{1,40}$') then
      raise exception 'La versión del motor son letras, números, puntos y guiones (hasta 40)';
    end if;
    if k = 'disputa_dias' and (jsonb_typeof(p_ajustes -> k) <> 'number' or (p_ajustes ->> k)::numeric not between 1 and 365) then
      raise exception 'Los días van de 1 a 365 (%)', k;
    end if;
    insert into cartas_economia_ajustes (clave, valor, actualizado) values (k, p_ajustes -> k, now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
  end loop;
end;
$$;
grant execute on function cartas_admin_guardar_ajustes(jsonb) to authenticated;

-- Cierra una apuesta activa con el veredicto del registro. Solo la puede llamar el servidor (rol de servicio), nunca un jugador.
--   p_acciones / p_actualizada: lo que valía la partida cuando se repitió (nº de acciones y marca de última actividad).
--   p_motor: versión del motor con la que se repitió.
-- Devuelve: 'resuelta' | 'ya-resuelta' (ya estaba cerrada o no tiene apuesta activa: no se mueve nada) | 'cambiada' (el registro cambió
-- mientras se comprobaba) | 'motor' (se repitió con una versión distinta de la que fijó la partida) | 'sin-instantanea' (la partida no
-- tiene instantánea: no se decide automáticamente) | 'alterada' (la instantánea no coincide con su huella o con la partida) |
-- 'no-vencido' (el plazo de abandono no ha vencido para el reloj de la base de datos) | 'no-aplica' (un abandono solo vale con la
-- partida en curso).
create or replace function cartas_i_aplicar_verificacion(p_id uuid, p_resultado text, p_motivo text, p_acciones int, p_actualizada timestamptz,
                                                         p_motor text, p_detalle text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_partidas%rowtype;
  f cartas_partidas%rowtype;
  perdedor uuid;
  horas_turno numeric := (cartas_ajuste('apuesta_turno_horas', '48'))::text::numeric;
begin
  if p_resultado not in ('j1', 'j2', 'empate') then raise exception 'Resultado inválido'; end if;
  if p_motivo not in ('verificada', 'abandono') then raise exception 'Motivo inválido'; end if;
  if p_motivo = 'abandono' and p_resultado = 'empate' then raise exception 'Un abandono no puede ser empate'; end if;
  select * into previo from cartas_partidas where id = p_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  perform cartas_i_candado_jugadores(previo.j1, previo.j2);
  select * into f from cartas_partidas where id = p_id for update;
  if f.estado not in ('en_curso', 'disputa') or f.apuesta_estado is distinct from 'activa' then return 'ya-resuelta'; end if;

  -- 1) El registro es el mismo que se repitió
  if jsonb_array_length(f.acciones) is distinct from p_acciones then return 'cambiada'; end if;
  -- 2) La instantánea existe, no ha sido tocada y coincide con la partida; y se repite con la versión del motor que ella fija
  if f.instantanea is null or f.instantanea_hash is null then return 'sin-instantanea'; end if;
  if md5(f.instantanea::text) is distinct from f.instantanea_hash
     or f.instantanea -> 'cartas' is distinct from f.cartas
     or f.instantanea -> 'mazos' -> 0 is distinct from f.mazo1 or f.instantanea -> 'mazos' -> 1 is distinct from f.mazo2
     or (f.instantanea ->> 'semilla')::int is distinct from f.semilla or (f.instantanea ->> 'primero')::int is distinct from f.primero then
    insert into cartas_incidencias (tipo, referencia, detalle) values ('instantanea_alterada', 'apuesta:' || p_id::text, 'La instantánea de la partida no coincide con su huella o con la partida: no se decide automáticamente');
    return 'alterada';
  end if;
  if p_motor is null or f.instantanea ->> 'motor' is distinct from p_motor then return 'motor'; end if;
  -- 3) Abandono: la partida sigue en curso, nadie ha actuado desde entonces y el plazo venció según el reloj de la base de datos
  if p_motivo = 'abandono' then
    if f.estado <> 'en_curso' then return 'no-aplica'; end if;
    if f.actualizada is distinct from p_actualizada then return 'cambiada'; end if;
    if now() - f.actualizada < horas_turno * interval '1 hour' then return 'no-vencido'; end if;
  end if;

  -- Quien avisó algo que el registro desmiente queda anotado (no se le quita nada: solo no gana por mentir)
  if f.reporte1 is not null and f.reporte1 <> p_resultado then
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta, jugador)
    values ('aviso_desmentido', 'apuesta:' || p_id::text, format('%s avisó «%s» y el registro de la partida dice «%s»', f.nombre1, f.reporte1, p_resultado), now(), f.j1);
  end if;
  if f.reporte2 is not null and f.reporte2 <> p_resultado then
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta, jugador)
    values ('aviso_desmentido', 'apuesta:' || p_id::text, format('%s avisó «%s» y el registro de la partida dice «%s»', f.nombre2, f.reporte2, p_resultado), now(), f.j2);
  end if;
  if p_motivo = 'abandono' then
    perdedor := case when p_resultado = 'j1' then f.j2 else f.j1 end;
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta, jugador)
    values ('abandono', 'apuesta:' || p_id::text, left(coalesce(nullif(p_detalle, ''), 'Dejó pasar el plazo sin actuar'), 300), now(), perdedor);
  end if;

  perform cartas_i_cerrar_partida(p_id, p_resultado, p_motivo);
  insert into cartas_incidencias (tipo, referencia, detalle, resuelta)
  values ('apuesta_resuelta_por_registro', 'apuesta:' || p_id::text,
          left(format('Resultado %s (%s). Motor %s. %s', p_resultado, p_motivo, p_motor, coalesce(p_detalle, '')), 300), now());
  return 'resuelta';
end;
$$;
revoke all on function cartas_i_aplicar_verificacion(uuid, text, text, int, timestamptz, text, text) from public, anon, authenticated;
grant execute on function cartas_i_aplicar_verificacion(uuid, text, text, int, timestamptz, text, text) to service_role;

-- Panel: quién ha avisado cosas desmentidas por el registro o ha abandonado partidas apostadas
create or replace function cartas_admin_reputacion()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.avisos_desmentidos + x.abandonos desc, x.nombre)
    from (
      select i.jugador as user_id, coalesce(p.username, '(sin nombre)') as nombre,
             count(*) filter (where i.tipo = 'aviso_desmentido')::int as avisos_desmentidos,
             count(*) filter (where i.tipo = 'abandono')::int as abandonos,
             max(i.creada) as ultima
      from cartas_incidencias i left join perfiles p on p.user_id = i.jugador
      where i.jugador is not null and i.tipo in ('aviso_desmentido', 'abandono')
      group by i.jugador, p.username
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke execute on function cartas_admin_reputacion() from public, anon;
grant execute on function cartas_admin_reputacion() to authenticated;


-- ===== economia-11_en_circulacion =====
-- ECONOMÍA DE CARTAS, parte 11: la etiqueta «En circulación».
-- BORRADOR SIN APLICAR. Se prueba en el entorno local (docs/pruebas). Corre DESPUÉS de economia_7, 8 y 9. Se puede correr más de una vez.
--
-- Una carta que no está en circulación no puede entrar al juego por ninguna vía automática: ni como recompensa de un minijuego,
-- ni como salida de la forja, ni al repartir la reserva, ni en el escaparate del mercader. Así una carta a medio hacer no se
-- cuela en las recompensas aunque esté publicada y marcada como ganable.
--   * Solo el admin la pone o la quita (Admin > Economía de cartas, columna «En circulación», también por lotes). Los editores no.
--   * Una carta nueva nace FUERA de circulación. Las que ya existen quedan fuera hasta que las marques.
--   * El admin sí puede regalar a mano una carta que no está en circulación (para probarla); eso no la pone en circulación.
--   * Quitar una carta de circulación no quita copias a nadie: lo que ya tienen los jugadores se queda, se puede intercambiar
--     y usar en mazos. Solo deja de salir de las vías automáticas.
-- Relación con las otras etiquetas: «publicada» = la ven los jugadores; «obtenible» = se puede ganar por recompensas;
-- «en circulación» = el admin la da por lista para entrar en la economía. Para salir por recompensa hacen falta las tres.

alter table cartas_catalogo add column if not exists en_circulacion boolean not null default false;

-- 1) El punto de entrada de toda copia nueva: nada que no esté en circulación se emite por una vía automática.
--    p_sin_limite solo lo usa el admin al regalar a mano; ese es el único camino que se salta la etiqueta.
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
  if not carta.en_circulacion and not p_sin_limite then
    raise exception 'Esa carta todavía no está en circulación';
  end if;
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
revoke all on function cartas_i_emitir(uuid, text, text, text, uuid, boolean) from public, anon, authenticated;

-- 2) Los candidatos de las vías automáticas: se añade el filtro a las consultas que eligen carta.
--    Se hace sobre la definición que hay desplegada para no copiar funciones largas; si no encuentra el filtro, aborta.
do $$
declare
  r record;
  def text;
  nuevo text;
begin
  for r in select * from (values
    ('cartas_i_juego_terminar_nucleo', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_i_forjar_nucleo', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_disponibilidad', 'c.obtenible and c.publicada', 'c.obtenible and c.publicada and c.en_circulacion'),
    ('cartas_i_mercader_rotar', 'and c.publicada', 'and c.publicada and c.en_circulacion')
  ) as v(funcion, buscar, poner) loop
    select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = r.funcion;
    if def is null then raise exception 'No existe la función %', r.funcion; end if;
    if position('c.en_circulacion' in def) > 0 then continue; end if;   -- ya estaba aplicado
    nuevo := replace(def, r.buscar, r.poner);
    if nuevo = def then raise exception 'No se encontró el filtro de candidatas en %', r.funcion; end if;
    execute nuevo;
  end loop;
end;
$$;

-- 3) Admin: ver y cambiar la etiqueta (junto a los límites)
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
      'en_circulacion', c.en_circulacion,
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

-- p_cambios: [{ "id": "kobold", "limite": 20, "limite_jugador": 10, "en_circulacion": true }]. Una clave ausente no se toca.
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
  nueva_circ boolean;
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

    if cambio ? 'en_circulacion' then
      if jsonb_typeof(cambio -> 'en_circulacion') <> 'boolean' then raise exception 'En circulación es sí o no (%)', carta.id; end if;
      nueva_circ := (cambio ->> 'en_circulacion')::boolean;
      if nueva_circ is distinct from carta.en_circulacion then
        update cartas_catalogo set en_circulacion = nueva_circ where id = carta.id;
        insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
        values ('circulacion', carta.id, case when nueva_circ then 'Puesta en circulación' else 'Retirada de circulación' end, now(), uid);
        hechos := hechos + 1;
      end if;
    end if;
  end loop;
  return hechos;
end;
$$;

grant execute on function cartas_admin_limites() to authenticated;
grant execute on function cartas_admin_guardar_limites(jsonb) to authenticated;

-- 4) Regalos a mano: se permiten con cualquier carta, pero quedan registrados. El libro de movimientos y el registro de cartas ya
--    guardaban quién regaló qué y a quién; ahora, si la carta no está en circulación, además queda una incidencia visible en el panel.
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
  en_circ boolean;
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'Solo el admin puede regalar cartas';
  end if;
  -- El admin puede dar una carta que todavía no tiene límite global ni está en circulación, pero nunca pasar un límite ya definido
  res := cartas_i_emitir(p_usuario, p_carta, 'regalo del admin: ' || coalesce(p_nota, ''), '', uid, true);
  select count(*) into total from cartas_ejemplares where propietario = p_usuario and carta_id = p_carta and estado in ('poseida', 'bloqueada');
  insert into cartas_registro (user_id, carta_id, origen, detalle, por)
  values (p_usuario, p_carta, 'admin', left(coalesce(p_nota, ''), 200), uid);
  select en_circulacion into en_circ from cartas_catalogo where id = p_carta;
  if not en_circ then
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta, resuelta_por)
    values ('regalo_fuera_de_circulacion', p_carta,
            left(format('Regalo a mano a %s (copia nº %s). La carta no está en circulación. %s',
                        coalesce((select username from perfiles where user_id = p_usuario), p_usuario::text), res ->> 'numero', coalesce(p_nota, '')), 300),
            now(), uid);
  end if;
  return jsonb_build_object('carta', p_carta, 'cantidad', total, 'numero', (res ->> 'numero')::int);
end;
$$;
grant execute on function cartas_regalar(uuid, text, text) to authenticated;

-- 5) Mercader: las ofertas especiales del admin también tienen que ser de cartas en circulación
create or replace function cartas_admin_mercader_agregar(p_carta text, p_valor_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c cartas_catalogo%rowtype;
  ej uuid;
  emitidas int;
begin
  if uid is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into c from cartas_catalogo where id = p_carta;
  if not found then raise exception 'Esa carta no existe'; end if;
  if not c.en_circulacion then raise exception 'Esa carta no está en circulación: ponla en circulación antes de ofrecerla en el mercader'; end if;
  if p_valor_min not between 1 and 40 then raise exception 'El valor va de 1 a 40'; end if;
  perform cartas_i_candado(p_carta);
  select id into ej from cartas_ejemplares where carta_id = p_carta and estado in ('en_reserva', 'en_mercader')
    and not exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = cartas_ejemplares.id and o.estado = 'activa')
    order by (estado = 'en_mercader') desc, numero limit 1;
  if ej is null then
    select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = p_carta;
    if c.limite is not null and emitidas >= c.limite then raise exception 'AGOTADA: ya se emitieron las % copias de esta carta', c.limite; end if;
    insert into cartas_ejemplares (carta_id, numero, propietario, estado) values (p_carta, emitidas + 1, null, 'en_mercader') returning id into ej;
    insert into cartas_movimientos (ejemplar, carta_id, tipo, motivo, por) values (ej, p_carta, 'emision', 'oferta especial del mercader', uid);
  end if;
  insert into cartas_mercader_ofertas (ejemplar, valor_min, especial) values (ej, p_valor_min, true);
end;
$$;
grant execute on function cartas_admin_mercader_agregar(text, int) to authenticated;


-- ===== economia-12_vias_externas =====
-- ECONOMÍA DE CARTAS, parte 12: La Fractura pasa por el sistema oficial de recompensas. BORRADOR SIN APLICAR (decisión del usuario, 13 oct).
-- Corre DESPUÉS de economia_7 a economia_11. Se puede correr más de una vez.
--
-- Antes: fractura_recompensa escribía DIRECTAMENTE en cartas_coleccion (sin ejemplares, sin movimientos, sin límites, sin la etiqueta
-- «En circulación»), y esa copia fantasma se perdía en cuanto el jugador recibía un ejemplar real de esa carta.
-- Ahora La Fractura es un juego más de cartas_juegos ('fractura'), con los mismos topes diarios, tramos, límites global y por
-- jugador, disponibilidad, etiqueta «En circulación», sellos y registro que el resto, y la carta sale por cartas_i_emitir (ejemplar +
-- movimiento). Si no hay ninguna carta elegible, el sistema oficial baja de rareza y, si no queda nada, da un sello: nunca crea una
-- copia fantasma ni pasa un límite.
--   * Una victoria vale 1 (tramo «bueno»); con logros de dificultad, núcleo o capital vale 3 («excelente»); con una primera victoria,
--     leyenda, némesis o tres generaciones vale 4 («extraordinario»). Es la misma escala que las rarezas de antes.
--   * Las guerras entre jugadores (pvp), las perdidas y las ya reclamadas siguen sin dar nada.
--   * El juego nace APAGADO (activo = false): hasta que lo enciendas en el panel no sale ninguna carta y la guerra NO se gasta (se podrá
--     reclamar cuando se encienda). Las recompensas del resto de juegos siguen como estén.

-- 1) Valor de una partida: se añade La Fractura (el valor ya viene calculado por la función de abajo)
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
  if p_juego = 'fractura' then
    return least(greatest(coalesce(p_puntuacion, 0), 0), 4);
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

-- 2) El juego en la tabla de configuración (apagado). Mismos umbrales, topes y pesos que los demás.
insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos) values
  ('fractura', 'La Fractura', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 3, 0, 5, '{}',
   '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}')
on conflict (juego) do nothing;

-- 3) La recompensa: reclamar el premio de una guerra ganada = terminar una partida de recompensa del juego 'fractura'
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
  valor numeric := 1;
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
    -- Apagado: no se da nada y la guerra no se gasta (se podrá reclamar cuando se encienda)
    return jsonb_build_object('resultado', 'nada', 'motivo', 'juego-inactivo');
  end if;

  if g.logros ? 'victoria_dificil' or g.logros ? 'nucleo' or g.logros ? 'capital' then valor := 3; end if;
  if exists (select 1 from jsonb_array_elements_text(g.logros) l where l like 'primera_victoria:%')
     or g.logros ? 'leyenda' or g.logros ? 'nemesis' or g.logros ? 'tres_generaciones' then
    valor := 4;
  end if;

  -- El mismo camino que los demás minijuegos: una partida de recompensa y su cierre (topes, límites, circulación, sellos, registro)
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


-- ===== economia-13_hipodromo_cartas =====
-- ECONOMÍA DE CARTAS, parte 13: Hipódromo, opción B (decisión del usuario, 13 oct). BORRADOR SIN APLICAR.
-- Corre DESPUÉS de economia_11 (usa la etiqueta «En circulación»). Se puede correr más de una vez.
-- Avisado a la sesión que mantiene el Hipódromo («Caballo») antes de escribirlo.
--
-- Qué cambia, SOLO en las tres funciones de compra y venta de cartas del Hipódromo, y en el servidor (una llamada directa también
-- queda rechazada, no solo la interfaz):
--   * Las cartas LEGENDARIAS y LIMITADAS no se compran ni se venden: lo comprueba la propia función por rareza, no solo la falta de
--     precio (si alguien vuelve a poner un precio de legendaria con hipodromo_admin_precios, sigue sin poder comerciarse).
--   * Solo se pueden COMPRAR cartas «en circulación»; se comprueba antes de cobrar.
--   * hipodromo_cartas_reserva() solo lista cartas en circulación y excluye legendarias y limitadas.
-- Qué NO cambia: los precios (ni la tabla hipodromo_precios_cartas ni hipodromo_admin_precios), las firmas, el formato de lo que
-- devuelven, la vía de venta de cartas normales, ni nada más del Hipódromo. Vender una carta fuera de circulación se sigue permitiendo
-- (vuelve a la reserva; allí no se puede comprar hasta que esté en circulación).
-- El texto base de las tres funciones es el que hay en producción el 13 de octubre de 2026 (revisado antes de escribir esto).

create or replace function public.hipodromo_cartas_reserva()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lado text;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'carta', c.id, 'rareza', c.rareza, 'tipo', c.tipo, 'copias', r.copias, 'precio', p.compra,
             'tengo', (select count(*) from cartas_ejemplares x where x.propietario = v_uid and x.carta_id = c.id and x.estado in ('poseida', 'bloqueada')),
             'limite', cartas_limite_jugador(c.id))
           order by case c.rareza when 'comun' then 1 when 'infrecuente' then 2 when 'rara' then 3 when 'limitada' then 4 else 5 end, c.id)
    from (select carta_id, count(*)::int as copias from cartas_ejemplares where estado = 'en_reserva' group by carta_id) r
    join cartas_catalogo c on c.id = r.carta_id
    join hipodromo_precios_cartas p on p.rareza = c.rareza
    where c.publicada and c.en_circulacion and c.rareza not in ('legendaria', 'limitada')
      and (c.lado is null or (v_lado is not null and v_lado = any (c.lado)))
  ), '[]'::jsonb);
end;
$$;

create or replace function public.hipodromo_comprar_carta(p_carta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_carta cartas_catalogo%rowtype;
  v_lado text;
  v_precio integer;
  v_saldo numeric;
  v_res jsonb;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  select * into v_carta from cartas_catalogo where id = p_carta and publicada;
  if not found then raise exception 'Esa carta no existe.'; end if;
  if v_carta.rareza in ('legendaria', 'limitada') then raise exception 'Las cartas legendarias y limitadas no se venden en el hipódromo.'; end if;
  if not v_carta.en_circulacion then raise exception 'Esa carta todavía no está en circulación.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  if v_carta.lado is not null and (v_lado is null or not (v_lado = any (v_carta.lado))) then raise exception 'Esa carta no está disponible para ti.'; end if;
  select compra into v_precio from hipodromo_precios_cartas where rareza = v_carta.rareza;
  if v_precio is null then raise exception 'Esa rareza no se vende.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  perform cartas_i_candado(p_carta);
  if not exists (select 1 from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva') then
    raise exception 'No quedan copias de esa carta en la reserva.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid for update;
  if v_saldo < v_precio then raise exception 'No tienes tokens suficientes (cuesta %).', v_precio; end if;
  v_res := cartas_i_emitir(v_uid, p_carta, 'comprada con tokens de juego', 'hipodromo:compra');
  update hipodromo_billeteras set saldo = saldo - v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Compra de carta: ' || p_carta || ' (' || v_carta.rareza || ')', -v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', p_carta, 'rareza', v_carta.rareza, 'precio', v_precio, 'saldo', v_saldo, 'numero', v_res -> 'numero');
end;
$$;

create or replace function public.hipodromo_vender_carta(p_ejemplar uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ej cartas_ejemplares%rowtype;
  v_rareza text;
  v_precio integer;
  v_saldo numeric;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  select * into v_ej from cartas_ejemplares where id = p_ejemplar;
  if not found or v_ej.propietario is distinct from v_uid then raise exception 'Esa carta no es tuya.'; end if;
  select rareza into v_rareza from cartas_catalogo where id = v_ej.carta_id;
  if v_rareza in ('legendaria', 'limitada') then raise exception 'Las cartas legendarias y limitadas no se compran en el hipódromo.'; end if;
  select venta into v_precio from hipodromo_precios_cartas where rareza = v_rareza;
  if v_precio is null then raise exception 'Esa rareza no se compra.'; end if;
  perform cartas_i_candado(v_ej.carta_id);
  select * into v_ej from cartas_ejemplares where id = p_ejemplar for update;
  if v_ej.propietario is distinct from v_uid or v_ej.estado <> 'poseida' then raise exception 'Esa carta no está libre: puede estar apostada o en un intercambio.'; end if;
  perform cartas_i_retirar(p_ejemplar, 'reserva', 'vendida por tokens de juego', 'hipodromo:venta');
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  update hipodromo_billeteras set saldo = saldo + v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Venta de carta: ' || v_ej.carta_id || ' (' || v_rareza || ')', v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', v_ej.carta_id, 'rareza', v_rareza, 'precio', v_precio, 'saldo', v_saldo);
end;
$$;

commit;
