-- HIPÓDROMO, parte 4: los personajes (js/hipodromo-npc.js) apuestan al pozo.
-- Cambia dos funciones que ya existen, sin tocar tablas ni datos (se pueden ejecutar más de una vez):
--   * hipodromo_guardar: al liquidar el pozo cuenta también lo que apostó la tribuna (los personajes), que viene en hipodromo_programa.publico->pozoNpc.
--   * hipodromo_apostar: la cuota estimada de una apuesta al pozo cuenta las apuestas de la tribuna cuya hora ya ha pasado (publico->tribuna).
-- Antes de ejecutarlo en Supabase (SQL Editor), despliega o prepara la Edge Function nueva: mientras las dos cosas no estén, el pozo se reparte como siempre
-- (sin personajes no hay pozoNpc ni tribuna y los coalesce lo dejan en cero), así que el orden no importa.

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
