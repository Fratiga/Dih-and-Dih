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
