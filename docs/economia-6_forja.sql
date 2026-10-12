-- ECONOMÍA DE CARTAS, parte 6: la forja.
-- Corre esto DESPUÉS de economia_1_nucleo.sql. Se puede correr más de una vez (no pisa lo que cambies en Admin).
--
-- La forja es un sumidero voluntario (docs/economia-de-cartas.md, sección 11.2): entregas varias cartas y a cambio te llevas
-- una mejor. Nunca es una vía segura de ganar valor: las recetas piden más valor del que devuelven y algunas fallan.
--   * Cada receta pide un número de cartas de una rareza y devuelve una carta de otra, con una probabilidad de éxito.
--   * Las cartas entregadas se destruyen (bajan de verdad la oferta total) o vuelven a la reserva, según la receta.
--   * La carta que sale se emite respetando el límite global (primero sale de la reserva) y el límite por jugador. Si no
--     hay carta disponible para dar, no se consume nada.
--   * Las legendarias y limitadas no entran ni salen de la forja. Máximo 3 forjas al día por jugador.

create table if not exists cartas_recetas (
  id text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  nombre text not null,
  descripcion text not null default '',
  activa boolean not null default true,
  entrada jsonb not null,                 -- [{ "rareza": "comun", "n": 5, "tipos": [...] }]  (tipos opcional)
  salida jsonb not null,                  -- { "rareza": "infrecuente", "tipos": [...] }       (tipos opcional)
  exito numeric not null default 1 check (exito between 0 and 1),
  al_fallar text not null default 'perder_todo' check (al_fallar in ('perder_todo', 'devolver_una')),
  destino text not null default 'destruida' check (destino in ('destruida', 'reserva')),
  orden int not null default 0,
  actualizada timestamptz not null default now()
);

insert into cartas_recetas (id, nombre, descripcion, entrada, salida, exito, al_fallar, destino, orden) values
  ('fundir-comunes', 'Fundir comunes', 'Cinco cartas comunes, de cualquier tipo, se funden en una carta poco común. Siempre sale.',
     '[{"rareza": "comun", "n": 5}]', '{"rareza": "infrecuente"}', 1, 'perder_todo', 'destruida', 1),
  ('alquimia', 'Alquimia', 'Tres cartas poco comunes para intentar una carta rara. Si falla, te devuelven una de las tres.',
     '[{"rareza": "infrecuente", "n": 3}]', '{"rareza": "rara"}', 0.8, 'devolver_una', 'destruida', 2),
  ('contrapeso', 'Contrapeso', 'Dos cartas raras y una poco común se reforjan en otra carta rara, a tu suerte. Si falla pierdes todo.',
     '[{"rareza": "rara", "n": 2}, {"rareza": "infrecuente", "n": 1}]', '{"rareza": "rara"}', 0.6, 'perder_todo', 'destruida', 3)
on conflict (id) do nothing;

create table if not exists cartas_forja_registro (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  receta text not null,
  exito boolean not null,
  carta_id text,
  entrega jsonb not null default '[]'::jsonb,
  creado timestamptz not null default now()
);
create index if not exists cartas_forja_registro_user_idx on cartas_forja_registro (user_id, creado desc);

alter table cartas_recetas enable row level security;
alter table cartas_forja_registro enable row level security;
drop policy if exists "cartas_recetas_select" on cartas_recetas;
create policy "cartas_recetas_select" on cartas_recetas for select using (auth.uid() is not null);
drop policy if exists "cartas_forja_registro_select" on cartas_forja_registro;
create policy "cartas_forja_registro_select" on cartas_forja_registro for select using (user_id = auth.uid() or fichas_es_admin());

create or replace function cartas_forjar(p_receta text, p_ejemplares uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r cartas_recetas%rowtype;
  problema text;
  total int := 0;
  g jsonb;
  asignadas uuid[] := '{}';
  grupo_ids uuid[];
  e uuid;
  hoy int;
  lado_usuario text;
  elegida text;
  emision jsonb;
  salio boolean;
  guardada uuid;
  intento int;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select * into r from cartas_recetas where id = p_receta and activa;
  if not found then raise exception 'Esa receta no existe'; end if;
  select count(*) into hoy from cartas_forja_registro where user_id = uid and creado >= date_trunc('day', now());
  if hoy >= 3 then raise exception 'Hoy ya forjaste 3 veces. Vuelve mañana'; end if;

  problema := cartas_i_error_copias(uid, p_ejemplares, 12);
  if problema is not null then raise exception 'Lo que entregas: %', problema; end if;
  if exists (select 1 from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id where x.id = any(p_ejemplares) and c.rareza in ('legendaria', 'limitada')) then
    raise exception 'La forja no acepta cartas legendarias ni limitadas';
  end if;

  -- Reparte las copias entregadas entre los grupos de la receta; tiene que salir exacto
  for g in select value from jsonb_array_elements(r.entrada) loop
    total := total + (g ->> 'n')::int;
    select array_agg(x.id order by x.numero) into grupo_ids from (
      select e2.id, e2.numero from cartas_ejemplares e2 join cartas_catalogo c on c.id = e2.carta_id
      where e2.id = any(p_ejemplares) and not (e2.id = any(asignadas)) and c.rareza = g ->> 'rareza'
        and (not (g ? 'tipos') or jsonb_array_length(g -> 'tipos') = 0 or c.tipo in (select jsonb_array_elements_text(g -> 'tipos')))
      order by e2.numero limit (g ->> 'n')::int) x;
    if coalesce(array_length(grupo_ids, 1), 0) <> (g ->> 'n')::int then
      raise exception 'Esta receta pide % carta% de rareza %', g ->> 'n', case when (g ->> 'n')::int = 1 then '' else 's' end, g ->> 'rareza';
    end if;
    asignadas := asignadas || grupo_ids;
  end loop;
  if coalesce(array_length(p_ejemplares, 1), 0) <> total then raise exception 'Entregas cartas de más: esta receta pide exactamente %', total; end if;

  select side into lado_usuario from perfiles where user_id = uid;
  salio := random() < r.exito;

  -- Todo dentro de un bloque: si no hay carta que dar, no se consume nada
  begin
    guardada := case when not salio and r.al_fallar = 'devolver_una' then p_ejemplares[1] else null end;
    foreach e in array p_ejemplares loop
      if guardada is null or e <> guardada then
        perform cartas_i_retirar(e, case r.destino when 'destruida' then 'destruida' else 'reserva' end, 'forja: ' || r.nombre, 'forja:' || r.id);
      end if;
    end loop;
    if salio then
      for intento in 1..3 loop
        select c.id into elegida
        from cartas_catalogo c
        left join lateral (select count(*) n from cartas_ejemplares x where x.carta_id = c.id and x.estado = 'en_reserva') res on true
        left join lateral (select coalesce(max(numero), 0) n from cartas_ejemplares x where x.carta_id = c.id) em on true
        where c.obtenible and c.publicada and c.rareza = r.salida ->> 'rareza'
          and (c.lado is null or (lado_usuario is not null and lado_usuario = any(c.lado)))
          and (not (r.salida ? 'tipos') or jsonb_array_length(r.salida -> 'tipos') = 0 or c.tipo in (select jsonb_array_elements_text(r.salida -> 'tipos')))
          and (res.n > 0 or (c.limite is not null and em.n < c.limite))
          and cartas_i_error_recibir(uid, c.id, 1) is null
        order by -ln(1 - random()) / greatest(1, res.n + case when c.limite is null then 0 else greatest(c.limite - em.n, 0) end)
        limit 1;
        if elegida is null then raise exception 'SIN-SALIDA'; end if;
        begin
          emision := cartas_i_emitir(uid, elegida, 'forja: ' || r.nombre, 'forja:' || r.id, null, false);
          exit;
        exception when others then
          elegida := null;
        end;
      end loop;
      if elegida is null then raise exception 'SIN-SALIDA'; end if;
    end if;
  exception when others then
    if sqlerrm = 'SIN-SALIDA' then
      return jsonb_build_object('resultado', 'sin-salida', 'mensaje', 'No hay ninguna carta disponible que darte con esta receta ahora mismo. No se consumió nada.');
    end if;
    raise;
  end;

  insert into cartas_forja_registro (user_id, receta, exito, carta_id, entrega) values (uid, r.id, salio, elegida, cartas_i_info_apuesta(p_ejemplares));
  if salio then
    insert into cartas_registro (user_id, carta_id, origen, detalle) values (uid, elegida, 'juego', left('forja:' || r.id, 200));
    return jsonb_build_object('resultado', 'carta', 'carta', elegida, 'numero', (emision ->> 'numero')::int,
      'nombre', coalesce((select data ->> 'nombre' from cartas_definiciones where id = elegida), elegida));
  end if;
  return jsonb_build_object('resultado', 'fallo', 'devuelta', guardada is not null);
end;
$$;

create or replace function cartas_forja_ver()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Hay que iniciar sesión'; end if;
  return jsonb_build_object(
    'recetas', coalesce((select jsonb_agg(to_jsonb(r) - 'actualizada' order by r.orden, r.id) from cartas_recetas r where r.activa), '[]'::jsonb),
    'hoy', (select count(*) from cartas_forja_registro where user_id = auth.uid() and creado >= date_trunc('day', now())),
    'tope', 3);
end;
$$;

-- Admin: cambiar una receta
create or replace function cartas_admin_guardar_receta(p_id text, p_cfg jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
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

grant execute on function cartas_forjar(text, uuid[]) to authenticated;
grant execute on function cartas_forja_ver() to authenticated;
grant execute on function cartas_admin_guardar_receta(text, jsonb) to authenticated;
