-- ECONOMÍA DE CARTAS, parte 4: duelos de cartas con apuesta.
-- Corre esto DESPUÉS de economia_1_nucleo.sql (y de cartas_combate.sql). Se puede correr más de una vez.
--
-- Reglas (ver docs/economia-de-cartas.md, sección 9):
--   * Un reto puede llevar una apuesta de 1 a 5 cartas. El retador las bloquea al enviar el reto; el rival tiene que
--     aceptar con una apuesta del mismo número de cartas y de categorías de valor parecidas (cada pareja, ordenadas de
--     mayor a menor rareza, se lleva como mucho una categoría).
--   * Las cartas apostadas quedan bloqueadas: no se pueden regalar, cambiar, apostar en otra partida ni gastar.
--   * Gana quien se lleva las cartas de los dos. Un empate devuelve cada carta a su dueño. Rendirse tras aceptar es perder.
--   * Antes de aceptar se comprueba que, ganara quien ganara, el que recibe no pasaría su límite por jugador. Si al
--     resolver ya no cabe una carta, esa carta vuelve a su dueño.
--   * El resultado lo avisa cada navegador (el juego se reproduce igual en los dos): si los dos coinciden se resuelve;
--     si discrepan la partida queda en disputa y la resuelve el admin; si uno se declara perdedor se resuelve al momento; si
--     solo reporta uno una victoria o un empate y el otro no contesta en 10 minutos, vale lo que dijo.
--   * Máximo 5 retos con apuesta al día por jugador y 2 al día entre la misma pareja. Un reto sin respuesta caduca a los 7 días.

alter table cartas_partidas
  add column if not exists apuesta1 uuid[] not null default '{}',
  add column if not exists apuesta2 uuid[] not null default '{}',
  add column if not exists apuesta1_info jsonb not null default '[]'::jsonb,
  add column if not exists apuesta2_info jsonb not null default '[]'::jsonb,
  add column if not exists apuesta_estado text,
  add column if not exists reporte1 text,
  add column if not exists reporte2 text,
  add column if not exists reportado timestamptz;

alter table cartas_partidas drop constraint if exists cartas_partidas_apuesta_estado_check;
alter table cartas_partidas add constraint cartas_partidas_apuesta_estado_check check (apuesta_estado is null or apuesta_estado in ('pendiente', 'activa', 'resuelta', 'devuelta'));
alter table cartas_partidas drop constraint if exists cartas_partidas_reporte1_check;
alter table cartas_partidas add constraint cartas_partidas_reporte1_check check (reporte1 is null or reporte1 in ('j1', 'j2', 'empate'));
alter table cartas_partidas drop constraint if exists cartas_partidas_reporte2_check;
alter table cartas_partidas add constraint cartas_partidas_reporte2_check check (reporte2 is null or reporte2 in ('j1', 'j2', 'empate'));
alter table cartas_partidas drop constraint if exists cartas_partidas_estado_check;
alter table cartas_partidas add constraint cartas_partidas_estado_check check (estado in ('pendiente', 'en_curso', 'terminada', 'rechazada', 'disputa', 'cancelada'));
alter table cartas_partidas drop constraint if exists cartas_partidas_motivo_check;
alter table cartas_partidas add constraint cartas_partidas_motivo_check check (motivo is null or motivo in ('vida', 'rendicion', 'acuerdo', 'admin', 'tiempo'));

-- Categoría de valor de una rareza (para equilibrar apuestas)
create or replace function cartas_categoria_valor(p_rareza text)
returns int
language sql
immutable
as $$
  select case p_rareza when 'comun' then 1 when 'infrecuente' then 2 when 'rara' then 3 else 4 end;
$$;

-- null si el jugador puede apostar estas copias; si no, el motivo
create or replace function cartas_i_error_apuesta(p_user uuid, p_ids uuid[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if n < 1 or n > 5 then return 'Una apuesta lleva de 1 a 5 cartas'; end if;
  if n <> (select count(distinct x) from unnest(p_ids) x) then return 'Hay una carta repetida en la apuesta'; end if;
  if (select count(*) from cartas_ejemplares where id = any(p_ids) and propietario = p_user and estado = 'poseida') <> n then
    return 'Alguna de las cartas apostadas no es tuya o no está libre';
  end if;
  return null;
end;
$$;

create or replace function cartas_i_info_apuesta(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('ejemplar', e.id, 'carta', e.carta_id, 'numero', e.numero, 'rareza', c.rareza,
                                               'nombre', coalesce(d.data ->> 'nombre', e.carta_id)) order by cartas_categoria_valor(c.rareza) desc, e.carta_id), '[]'::jsonb)
  from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id left join cartas_definiciones d on d.id = e.carta_id
  where e.id = any(p_ids);
$$;

-- null si las dos apuestas están equilibradas
create or replace function cartas_i_error_equilibrio(p_a uuid[], p_b uuid[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cats_a int[];
  cats_b int[];
  i int;
begin
  if coalesce(array_length(p_a, 1), 0) <> coalesce(array_length(p_b, 1), 0) then
    return 'Las dos apuestas deben llevar el mismo número de cartas';
  end if;
  select array_agg(cartas_categoria_valor(c.rareza) order by cartas_categoria_valor(c.rareza) desc) into cats_a
    from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id where e.id = any(p_a);
  select array_agg(cartas_categoria_valor(c.rareza) order by cartas_categoria_valor(c.rareza) desc) into cats_b
    from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id where e.id = any(p_b);
  for i in 1..coalesce(array_length(cats_a, 1), 0) loop
    if abs(cats_a[i] - cats_b[i]) > 1 then
      return 'Las apuestas no están equilibradas: las cartas de cada pareja no pueden diferir en más de una categoría de rareza';
    end if;
  end loop;
  return null;
end;
$$;

-- null si quien recibe las cartas p_ids no pasaría su límite por jugador
create or replace function cartas_i_error_pago(p_recibe uuid, p_ids uuid[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fila record;
  problema text;
begin
  for fila in select carta_id, count(*) n from cartas_ejemplares where id = any(p_ids) group by carta_id loop
    problema := cartas_i_error_recibir(p_recibe, fila.carta_id, fila.n::int);
    if problema is not null then return problema; end if;
  end loop;
  return null;
end;
$$;

-- Devuelve las cartas apostadas a sus dueños (reto rechazado, cancelado o caducado)
create or replace function cartas_i_apuesta_devolver(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cartas_i_desbloquear('apuesta:' || p_id::text);
  update cartas_partidas set apuesta_estado = 'devuelta' where id = p_id and apuesta_estado in ('pendiente', 'activa');
end;
$$;

-- Reparte las cartas apostadas según el resultado ('j1', 'j2' o 'empate')
create or replace function cartas_i_resolver_apuesta(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f cartas_partidas%rowtype;
  ref text := 'apuesta:' || p_id::text;
  ganador uuid;
  ids uuid[];
  e uuid;
begin
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
      null;   -- si ya no cabe en la colección del ganador, la carta se queda con su dueño (se desbloquea abajo)
    end;
  end loop;
  perform cartas_i_desbloquear(ref);
  update cartas_partidas set apuesta_estado = 'resuelta' where id = p_id;
end;
$$;

-- Termina la partida con un resultado ya acordado
create or replace function cartas_i_cerrar_partida(p_id uuid, p_resultado text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update cartas_partidas set estado = 'terminada', resultado = p_resultado, motivo = p_motivo, actualizada = now() where id = p_id;
  perform cartas_i_resolver_apuesta(p_id, p_resultado);
end;
$$;

-- Limpieza: retos sin respuesta, resultados que nadie contradijo y bloqueos caducados
create or replace function cartas_i_limpiar_apuestas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  for f in select id from cartas_partidas where estado = 'pendiente' and creada < now() - interval '7 days' loop
    update cartas_partidas set estado = 'rechazada', actualizada = now() where id = f.id;
    perform cartas_i_apuesta_devolver(f.id);
  end loop;
  for f in select id, case when reporte1 is not null then reporte1 else reporte2 end as rep from cartas_partidas
           where estado = 'en_curso' and apuesta_estado = 'activa' and reportado < now() - interval '10 minutes'
             and ((reporte1 is null) <> (reporte2 is null)) loop
    perform cartas_i_cerrar_partida(f.id, f.rep, 'tiempo');
  end loop;
  perform cartas_i_liberar_caducados();
end;
$$;

revoke all on function cartas_i_error_apuesta(uuid, uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_info_apuesta(uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_error_equilibrio(uuid[], uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_error_pago(uuid, uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_apuesta_devolver(uuid) from public, anon, authenticated;
revoke all on function cartas_i_resolver_apuesta(uuid, text) from public, anon, authenticated;
revoke all on function cartas_i_cerrar_partida(uuid, text, text) from public, anon, authenticated;
revoke all on function cartas_i_limpiar_apuestas() from public, anon, authenticated;

-- Lo llama el navegador al abrir el lobby: pone al día lo que caducó
create or replace function cartas_refrescar()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform cartas_i_limpiar_apuestas();
end;
$$;
grant execute on function cartas_refrescar() to authenticated;

-- Reto (con apuesta opcional)
drop function if exists cartas_retar(uuid, uuid, jsonb);
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
  perform cartas_i_limpiar_apuestas();
  if p_rival is null or p_rival = uid then raise exception 'Rival inválido'; end if;
  select username into nombre_el from perfiles where user_id = p_rival;
  if not found then raise exception 'Ese jugador no existe'; end if;
  select username into nombre_yo from perfiles where user_id = uid;

  select cartas into deck from cartas_mazos where id = p_mazo and user_id = uid;
  if deck is null then raise exception 'Ese mazo no es tuyo'; end if;
  problema := cartas_mazo_error(uid, deck);
  if problema is not null then raise exception '%', problema; end if;
  if p_cartas is null or jsonb_typeof(p_cartas) <> 'object' or length(p_cartas::text) > 120000 then
    raise exception 'Datos de cartas inválidos';
  end if;

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
  end if;

  insert into cartas_partidas (j1, j2, nombre1, nombre2, mazo1, cartas)
  values (uid, p_rival, coalesce(nombre_yo, 'Anónimo'), coalesce(nombre_el, 'Anónimo'), cartas_aplanar_mazo(deck), p_cartas)
  returning id into nueva;

  if con_apuesta then
    perform cartas_i_bloquear(p_apuesta, 'apuesta', 'apuesta:' || nueva::text, now() + interval '8 days');
    update cartas_partidas set apuesta1 = p_apuesta, apuesta1_info = cartas_i_info_apuesta(p_apuesta), apuesta_estado = 'pendiente' where id = nueva;
  end if;
  return nueva;
end;
$$;

-- Aceptar (con la apuesta del rival si el reto la lleva) o rechazar
drop function if exists cartas_responder(uuid, boolean, uuid, jsonb);
create or replace function cartas_responder(p_id uuid, p_aceptar boolean, p_mazo uuid default null, p_cartas jsonb default '{}'::jsonb,
                                            p_apuesta uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fila cartas_partidas%rowtype;
  deck jsonb;
  problema text;
  quien int;
  con_apuesta boolean;
  ref text;
begin
  perform cartas_i_limpiar_apuestas();
  select * into fila from cartas_partidas where id = p_id for update;
  if not found or uid is null or uid <> fila.j2 then raise exception 'Partida no encontrada'; end if;
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
  problema := cartas_mazo_error(uid, deck);
  if problema is not null then raise exception '%', problema; end if;
  if p_cartas is null or jsonb_typeof(p_cartas) <> 'object' or length(p_cartas::text) > 120000 then
    raise exception 'Datos de cartas inválidos';
  end if;

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
    perform cartas_i_bloquear(p_apuesta, 'apuesta', ref, null);
    update cartas_bloqueos set caduca = null where referencia = ref;
  elsif coalesce(array_length(p_apuesta, 1), 0) > 0 then
    raise exception 'Este reto no lleva apuesta';
  end if;

  quien := case when random() < 0.5 then 0 else 1 end;
  update cartas_partidas
    set estado = 'en_curso',
        mazo2 = cartas_aplanar_mazo(deck),
        cartas = cartas || p_cartas,
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

-- El resultado lo avisa cada navegador. Sin apuesta basta con uno; con apuesta se cruzan los dos avisos.
create or replace function cartas_terminar(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fila cartas_partidas%rowtype;
begin
  if p_resultado not in ('j1', 'j2', 'empate') then raise exception 'Resultado inválido'; end if;
  select * into fila from cartas_partidas where id = p_id for update;
  if not found or uid is null or uid not in (fila.j1, fila.j2) then raise exception 'Partida no encontrada'; end if;
  if fila.estado <> 'en_curso' then return; end if;

  if fila.apuesta_estado is distinct from 'activa' then
    update cartas_partidas
      set estado = 'terminada', resultado = p_resultado, motivo = 'vida', actualizada = now()
      where id = p_id;
    return;
  end if;

  if uid = fila.j1 then
    update cartas_partidas set reporte1 = p_resultado, reportado = coalesce(reportado, now()) where id = p_id;
  else
    update cartas_partidas set reporte2 = p_resultado, reportado = coalesce(reportado, now()) where id = p_id;
  end if;
  select * into fila from cartas_partidas where id = p_id;

  -- Declararse perdedor es definitivo
  if (uid = fila.j1 and p_resultado = 'j2') or (uid = fila.j2 and p_resultado = 'j1') then
    perform cartas_i_cerrar_partida(p_id, p_resultado, 'acuerdo');
  elsif fila.reporte1 is not null and fila.reporte2 is not null then
    if fila.reporte1 = fila.reporte2 then
      perform cartas_i_cerrar_partida(p_id, fila.reporte1, 'vida');
    else
      update cartas_partidas set estado = 'disputa', actualizada = now() where id = p_id;
    end if;
  end if;
end;
$$;

create or replace function cartas_rendirse(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  fila cartas_partidas%rowtype;
begin
  select * into fila from cartas_partidas where id = p_id for update;
  if not found or uid is null or uid not in (fila.j1, fila.j2) then raise exception 'Partida no encontrada'; end if;
  if fila.estado = 'pendiente' then
    if fila.j1 <> uid then raise exception 'Usa rechazar para este reto'; end if;
    update cartas_partidas set estado = 'rechazada', actualizada = now() where id = p_id;
    if coalesce(array_length(fila.apuesta1, 1), 0) > 0 then perform cartas_i_apuesta_devolver(p_id); end if;
  elsif fila.estado in ('en_curso', 'disputa') then
    perform cartas_i_cerrar_partida(p_id, case when uid = fila.j1 then 'j2' else 'j1' end, 'rendicion');
  else
    raise exception 'La partida ya terminó';
  end if;
end;
$$;

-- El admin resuelve una disputa o una partida abandonada: resultado 'j1', 'j2', 'empate' o 'cancelar' (devuelve todo)
create or replace function cartas_admin_resolver_apuesta(p_id uuid, p_resultado text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  fila cartas_partidas%rowtype;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_resultado not in ('j1', 'j2', 'empate', 'cancelar') then raise exception 'Resultado inválido'; end if;
  select * into fila from cartas_partidas where id = p_id for update;
  if not found then raise exception 'Partida no encontrada'; end if;
  if fila.estado not in ('en_curso', 'disputa', 'pendiente') then raise exception 'La partida ya terminó'; end if;
  if p_resultado = 'cancelar' then
    update cartas_partidas set estado = 'cancelada', motivo = 'admin', actualizada = now() where id = p_id;
    if fila.apuesta_estado in ('pendiente', 'activa') then perform cartas_i_apuesta_devolver(p_id); end if;
  else
    perform cartas_i_cerrar_partida(p_id, p_resultado, 'admin');
  end if;
end;
$$;
grant execute on function cartas_admin_resolver_apuesta(uuid, text) to authenticated;
grant execute on function cartas_retar(uuid, uuid, jsonb, uuid[]) to authenticated;
grant execute on function cartas_responder(uuid, boolean, uuid, jsonb, uuid[]) to authenticated;
grant execute on function cartas_terminar(uuid, text) to authenticated;
grant execute on function cartas_rendirse(uuid) to authenticated;
