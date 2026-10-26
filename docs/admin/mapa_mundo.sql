-- Mapa vectorial del mundo: lo guarda el editor del mapa (solo Admin) y lo leen todos.
-- Una fila 'principal' con el documento entero (geografía, líneas, relieve, etiquetas, posiciones de lugares) y su versión.
-- Cada guardado copia la versión anterior al historial, para poder volver atrás.
-- Guardar pide la versión de la que partió el editor: si otro Admin guardó entretanto, falla con «conflicto» y no pisa nada.
-- Las fichas de los lugares NO se copian aquí: el mapa solo guarda dónde va cada lugar si el editor lo movió.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql (fichas_es_admin). Se puede correr más de una vez.

create or replace function public.mapa_datos_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'object'
    and (p ->> 'esquema') = '1'
    and jsonb_typeof(p -> 'geografia') = 'object'
    and jsonb_typeof(p -> 'geografia' -> 'arcos') = 'array'
    and jsonb_typeof(p -> 'geografia' -> 'estados') = 'array'
    and jsonb_typeof(p -> 'etiquetas') = 'array'
    and jsonb_typeof(p -> 'relieve') = 'array'
    and jsonb_typeof(p -> 'lineas') = 'object'
    and pg_column_size(p) < 3000000
$$;

create table if not exists public.mapa_mundo (
  id text primary key check (id = 'principal'),
  version integer not null check (version > 0),
  datos jsonb not null,
  nota text,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null,
  constraint mapa_mundo_datos check (public.mapa_datos_ok(datos))
);

create table if not exists public.mapa_mundo_historial (
  version integer primary key,
  datos jsonb not null,
  nota text,
  guardado timestamptz not null,
  guardado_por uuid references auth.users(id) on delete set null
);

alter table public.mapa_mundo enable row level security;
alter table public.mapa_mundo_historial enable row level security;
drop policy if exists "mapa_mundo_select" on public.mapa_mundo;
create policy "mapa_mundo_select" on public.mapa_mundo for select using (true);
drop policy if exists "mapa_mundo_historial_select" on public.mapa_mundo_historial;
create policy "mapa_mundo_historial_select" on public.mapa_mundo_historial for select using (public.fichas_es_admin());
grant select on public.mapa_mundo to anon, authenticated;
grant select on public.mapa_mundo_historial to authenticated;
-- Sin políticas de escritura: solo escriben las funciones de abajo.

-- Guarda una versión nueva. p_version_base es la versión que tenía el editor al empezar (0 si no había ninguna guardada).
create or replace function public.mapa_guardar(p_datos jsonb, p_version_base integer, p_nota text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actual mapa_mundo;
  nueva integer;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if not mapa_datos_ok(p_datos) then raise exception 'El mapa no tiene el formato esperado' using errcode = '22023'; end if;
  select * into actual from mapa_mundo where id = 'principal' for update;
  if found then
    if actual.version <> coalesce(p_version_base, 0) then
      raise exception 'conflicto: otro Admin guardó la versión % mientras editabas', actual.version using errcode = 'P0409';
    end if;
    insert into mapa_mundo_historial (version, datos, nota, guardado, guardado_por)
    values (actual.version, actual.datos, actual.nota, actual.actualizado, actual.actualizado_por)
    on conflict (version) do nothing;
    nueva := actual.version + 1;
    update mapa_mundo set version = nueva, datos = p_datos, nota = left(p_nota, 200), actualizado = now(), actualizado_por = auth.uid() where id = 'principal';
  else
    if coalesce(p_version_base, 0) <> 0 then
      raise exception 'conflicto: el mapa guardado ya no existe' using errcode = 'P0409';
    end if;
    nueva := 1;
    insert into mapa_mundo (id, version, datos, nota, actualizado_por) values ('principal', nueva, p_datos, left(p_nota, 200), auth.uid());
  end if;
  -- el historial no crece sin fin: se quedan las 60 versiones más recientes
  delete from mapa_mundo_historial where version <= nueva - 61;
  return nueva;
end;
$$;

-- Lista de versiones anteriores (sin los datos, que pesan)
create or replace function public.mapa_versiones()
returns table (version integer, nota text, guardado timestamptz, guardado_por uuid, actual boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return query
    select m.version, m.nota, m.actualizado, m.actualizado_por, true from mapa_mundo m where m.id = 'principal'
    union all
    select h.version, h.nota, h.guardado, h.guardado_por, false from mapa_mundo_historial h
    order by 1 desc;
end;
$$;

-- Vuelve a una versión anterior guardándola como versión nueva (no se borra nada)
create or replace function public.mapa_restaurar(p_version integer, p_version_base integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d jsonb;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select datos into d from mapa_mundo_historial where version = p_version;
  if d is null then raise exception 'No existe la versión %', p_version using errcode = 'P0002'; end if;
  return mapa_guardar(d, p_version_base, 'Restaurada la versión ' || p_version);
end;
$$;

-- Trae los datos de una versión del historial (para previsualizarla o exportarla)
create or replace function public.mapa_version_datos(p_version integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare d jsonb;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select datos into d from mapa_mundo where id = 'principal' and version = p_version;
  if d is null then select datos into d from mapa_mundo_historial where version = p_version; end if;
  return d;
end;
$$;

revoke all on function public.mapa_guardar(jsonb, integer, text) from public, anon;
revoke all on function public.mapa_versiones() from public, anon;
revoke all on function public.mapa_restaurar(integer, integer) from public, anon;
revoke all on function public.mapa_version_datos(integer) from public, anon;
grant execute on function public.mapa_guardar(jsonb, integer, text) to authenticated;
grant execute on function public.mapa_versiones() to authenticated;
grant execute on function public.mapa_restaurar(integer, integer) to authenticated;
grant execute on function public.mapa_version_datos(integer) to authenticated;
