-- ECONOMÍA DE CARTAS, parte 10: verificar las partidas apostadas con su registro de acciones (avisos falsos y abandono).
-- BORRADOR SIN APLICAR. Se prueba en el entorno local (docs/pruebas). Corre DESPUÉS de economia_7, 8 y 9. Se puede correr más de una vez.
--
-- Idea: el motor del combate es determinista y una acción ilegal se ignora igual en todos los navegadores, así que la lista de
-- acciones guardada en cartas_partidas decide quién ganó. Una Edge Function («cartas-verificar», docs/cartas-verificar.ts) vuelve
-- a jugar la partida con el mismo motor y llama a cartas_i_aplicar_verificacion con el veredicto. Lo que cada jugador «avise»
-- pasa a ser solo una pista:
--   * Un aviso falso ya no gana nada: si el registro dice otra cosa, se reparte según el registro y queda anotado quién mintió.
--   * Un jugador que desaparece pierde: si quien tiene que actuar lleva más de «apuesta_turno_horas» sin hacerlo, pierde por abandono.
-- Si la Edge Function no está o no puede decidir, siguen valiendo las reglas de economia_7 (disputa para el admin, devolución a las 24 y 72 horas).

alter table cartas_partidas drop constraint if exists cartas_partidas_motivo_check;
alter table cartas_partidas add constraint cartas_partidas_motivo_check
  check (motivo is null or motivo in ('vida', 'rendicion', 'acuerdo', 'admin', 'tiempo', 'verificada', 'abandono'));

insert into cartas_economia_ajustes (clave, valor) values
  ('apuesta_turno_horas', '48')      -- horas sin actuar quien tiene que hacerlo antes de perder por abandono (PROPUESTA, por confirmar)
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
    if k not in ('tope_dia_total', 'multiplicadores', 'pity', 'mejora_personal', 'apuesta_silencio_horas', 'apuesta_inactividad_horas', 'apuesta_turno_horas') then
      raise exception 'Ajuste desconocido: %', k;
    end if;
    if k in ('apuesta_silencio_horas', 'apuesta_inactividad_horas', 'apuesta_turno_horas') and
       (jsonb_typeof(p_ajustes -> k) <> 'number' or (p_ajustes ->> k)::numeric not between 1 and 720) then
      raise exception 'Las horas van de 1 a 720 (%)', k;
    end if;
    insert into cartas_economia_ajustes (clave, valor, actualizado) values (k, p_ajustes -> k, now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
  end loop;
end;
$$;
grant execute on function cartas_admin_guardar_ajustes(jsonb) to authenticated;

-- Cierra una apuesta activa con el veredicto del registro. Solo la puede llamar el servidor (rol de servicio), nunca un jugador.
-- Devuelve 'resuelta', o 'ya-resuelta' si la apuesta ya estaba cerrada (no pasa nada y no se mueve ninguna carta).
create or replace function cartas_i_aplicar_verificacion(p_id uuid, p_resultado text, p_motivo text, p_detalle text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  previo cartas_partidas%rowtype;
  f cartas_partidas%rowtype;
  perdedor uuid;
begin
  if p_resultado not in ('j1', 'j2', 'empate') then raise exception 'Resultado inválido'; end if;
  if p_motivo not in ('verificada', 'abandono') then raise exception 'Motivo inválido'; end if;
  if p_motivo = 'abandono' and p_resultado = 'empate' then raise exception 'Un abandono no puede ser empate'; end if;
  select * into previo from cartas_partidas where id = p_id;
  if not found then raise exception 'Partida no encontrada'; end if;
  perform cartas_i_candado_jugadores(previo.j1, previo.j2);
  select * into f from cartas_partidas where id = p_id for update;
  if f.estado not in ('en_curso', 'disputa') or f.apuesta_estado is distinct from 'activa' then return 'ya-resuelta'; end if;

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
          left(format('Resultado %s (%s). %s', p_resultado, p_motivo, coalesce(p_detalle, '')), 300), now());
  return 'resuelta';
end;
$$;
revoke all on function cartas_i_aplicar_verificacion(uuid, text, text, text) from public, anon, authenticated;
grant execute on function cartas_i_aplicar_verificacion(uuid, text, text, text) to service_role;

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
