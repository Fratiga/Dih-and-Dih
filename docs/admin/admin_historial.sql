-- Historial de cambios y "Deshacer" para todo lo que el Admin edita desde la web (herramienta 21 de docs/admin-herramientas.md).
-- Cada INSERT, UPDATE o DELETE de las tablas registradas guarda cómo estaba la fila antes y cómo quedó, con quién y cuándo.
-- El panel de Admin (pestaña "Cambios") los lista y puede revertir cualquiera: el revertir también queda anotado, así que se puede rehacer.
-- Corre esto en el SQL Editor de Supabase. Se puede correr más de una vez. No toca los datos que ya hay.
-- Requiere fichas_es_admin() (ya existe) y que las tablas que se registren existan (las que falten se saltan solas).

create table if not exists admin_tablas (
  tabla text primary key,
  claves text[] not null,           -- columnas de la clave primaria, en orden
  etiqueta text not null default ''
);

create table if not exists admin_cambios (
  id bigint generated always as identity primary key,
  tabla text not null,
  clave jsonb not null,             -- { columna: valor } de la clave primaria
  operacion text not null check (operacion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb,
  usuario uuid default auth.uid(),
  momento timestamptz not null default now(),
  revierte bigint                   -- id del cambio que este deshace, si es una reversión
);

create index if not exists admin_cambios_momento on admin_cambios (momento desc);
create index if not exists admin_cambios_tabla on admin_cambios (tabla, momento desc);

alter table admin_tablas enable row level security;
alter table admin_cambios enable row level security;

drop policy if exists "admin_tablas_select" on admin_tablas;
create policy "admin_tablas_select" on admin_tablas for select using (fichas_es_admin());
drop policy if exists "admin_cambios_select" on admin_cambios;
create policy "admin_cambios_select" on admin_cambios for select using (fichas_es_admin());
-- Sin políticas de escritura: solo el disparador y las funciones de abajo escriben.

-- Disparador: anota el cambio. No guarda nada si un UPDATE no cambió la fila.
create or replace function admin_registrar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claves text[];
  v_fila jsonb;
  v_antes jsonb;
  v_despues jsonb;
  v_clave jsonb := '{}'::jsonb;
  c text;
begin
  select claves into v_claves from admin_tablas where tabla = TG_TABLE_NAME;
  if v_claves is null then
    return coalesce(NEW, OLD);
  end if;
  if TG_OP in ('UPDATE', 'DELETE') then v_antes := to_jsonb(OLD); end if;
  if TG_OP in ('UPDATE', 'INSERT') then v_despues := to_jsonb(NEW); end if;
  if TG_OP = 'UPDATE' and v_antes = v_despues then
    return NEW;
  end if;
  v_fila := coalesce(v_despues, v_antes);
  foreach c in array v_claves loop
    v_clave := v_clave || jsonb_build_object(c, v_fila -> c);
  end loop;
  insert into admin_cambios (tabla, clave, operacion, antes, despues)
  values (TG_TABLE_NAME, v_clave, TG_OP, v_antes, v_despues);
  -- Se guardan 120 días; lo más viejo se borra de vez en cuando
  if random() < 0.02 then
    delete from admin_cambios where momento < now() - interval '120 days';
  end if;
  return coalesce(NEW, OLD);
end;
$$;

-- Registra una tabla: guarda su clave y le pone el disparador. Si la tabla no existe, no hace nada.
create or replace function admin_registrar_tabla(p_tabla text, p_claves text[], p_etiqueta text default '')
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if to_regclass(format('public.%I', p_tabla)) is null then
    return false;
  end if;
  insert into admin_tablas (tabla, claves, etiqueta) values (p_tabla, p_claves, p_etiqueta)
  on conflict (tabla) do update set claves = excluded.claves, etiqueta = excluded.etiqueta;
  execute format('drop trigger if exists admin_cambios_trg on %I', p_tabla);
  execute format('create trigger admin_cambios_trg after insert or update or delete on %I for each row execute function admin_registrar_cambio()', p_tabla);
  return true;
end;
$$;

revoke all on function admin_registrar_tabla(text, text[], text) from public, anon, authenticated;

-- Lista de los últimos cambios (solo Admin). p_tabla filtra por tabla; p_antes_de pagina hacia atrás.
create or replace function admin_cambios_listar(p_limite int default 60, p_tabla text default null, p_antes_de bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  return coalesce((
    select jsonb_agg(f order by f.id desc) from (
      select c.id, c.tabla, coalesce(t.etiqueta, c.tabla) as etiqueta, c.clave, c.operacion, c.antes, c.despues, c.momento, c.revierte,
             c.usuario, coalesce(nullif(p.username, ''), u.email, '') as quien,
             exists (select 1 from admin_cambios r where r.revierte = c.id) as revertido
      from admin_cambios c
      left join admin_tablas t on t.tabla = c.tabla
      left join perfiles p on p.user_id = c.usuario
      left join auth.users u on u.id = c.usuario
      where (p_tabla is null or c.tabla = p_tabla) and (p_antes_de is null or c.id < p_antes_de)
      order by c.id desc
      limit least(greatest(coalesce(p_limite, 60), 1), 200)
    ) f
  ), '[]'::jsonb);
end;
$$;

-- Revierte un cambio: devuelve la fila a como estaba antes (o la borra / la vuelve a crear). Queda anotado como un cambio nuevo.
create or replace function admin_cambio_revertir(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c admin_cambios%rowtype;
  v_claves text[];
  v_cols text;
  v_donde text;
  v_max bigint;
  v_marcados int;
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  select * into v_c from admin_cambios where id = p_id;
  if not found then raise exception 'Ese cambio ya no existe'; end if;
  select claves into v_claves from admin_tablas where tabla = v_c.tabla;
  if v_claves is null then raise exception 'La tabla % ya no se registra', v_c.tabla; end if;
  if exists (select 1 from admin_cambios where revierte = p_id) then
    raise exception 'Ese cambio ya se revirtió';
  end if;

  -- WHERE de la clave primaria
  select string_agg(format('%I = (%L::jsonb ->> %L)::%s', kc.col,
                           v_c.clave::text, kc.col,
                           (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
                             where a.attrelid = format('public.%I', v_c.tabla)::regclass and a.attname = kc.col)), ' and ')
    into v_donde from unnest(v_claves) as kc(col);

  select coalesce(max(id), 0) into v_max from admin_cambios;

  if v_c.operacion = 'INSERT' then
    execute format('delete from %I where %s', v_c.tabla, v_donde);
  elsif v_c.operacion = 'DELETE' then
    execute format('insert into %I select * from jsonb_populate_record(null::%I, %L::jsonb)', v_c.tabla, v_c.tabla, v_c.antes::text);
  else
    select string_agg(quote_ident(key), ', ') into v_cols from jsonb_object_keys(v_c.antes) as key;
    execute format('update %I set (%s) = (select %s from jsonb_populate_record(null::%I, %L::jsonb)) where %s',
                   v_c.tabla, v_cols, v_cols, v_c.tabla, v_c.antes::text, v_donde);
  end if;

  -- El disparador anotó la reversión como un cambio más: se marca como la reversión de este
  update admin_cambios set revierte = p_id where id > v_max and tabla = v_c.tabla and revierte is null;
  get diagnostics v_marcados = row_count;
  if v_marcados = 0 then
    insert into admin_cambios (tabla, clave, operacion, antes, despues, revierte)
    values (v_c.tabla, v_c.clave, 'UPDATE', v_c.despues, v_c.antes, p_id);
  end if;
  return jsonb_build_object('revertido', p_id);
end;
$$;

grant execute on function admin_cambios_listar(int, text, bigint) to authenticated;
grant execute on function admin_cambio_revertir(bigint) to authenticated;

-- Tablas que el Admin edita desde la web. Las que no existan todavía se saltan.
select admin_registrar_tabla('cartas_definiciones', array['id'], 'Cartas: definición');
select admin_registrar_tabla('cartas_catalogo', array['id'], 'Cartas: catálogo');
select admin_registrar_tabla('cartas_vinculos', array['id'], 'Cartas: sinergias y rivalidades');
select admin_registrar_tabla('musica_paginas', array['pagina'], 'Música de páginas');
select admin_registrar_tabla('fanarts_side', array['src'], 'Fanarts: Side');
select admin_registrar_tabla('fanarts_ocultos', array['src'], 'Fanarts: ocultos');
select admin_registrar_tabla('fanarts_subidos', array['src'], 'Fanarts: subidos');
select admin_registrar_tabla('rocola_nombres', array['ruta'], 'Rocola: nombres');
select admin_registrar_tabla('rocola_ocultas', array['ruta'], 'Rocola: canciones ocultas');
select admin_registrar_tabla('rocola_fondos', array['cancion', 'juego', 'dificultad'], 'Rocola: fondos');
