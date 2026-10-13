-- Contenido editable desde la web (herramientas 1 a 5 y 13 de docs/admin-herramientas.md):
-- entradas del compendio, cronología, reglas, economía, novedades y pines del mapa.
-- Los archivos data/*.js siguen siendo el punto de partida. Cada fila de aquí es un PARCHE sobre un elemento de una lista de esos archivos:
--   * si el elemento ya existe, los campos de "data" se superponen a los del archivo (un campo en null se quita);
--   * si no existe, la fila lo crea;
--   * si borrado = true, el elemento se oculta.
-- Quitar la fila devuelve el elemento a como está en el archivo.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql (para que quede en el historial). Se puede correr más de una vez.

create table if not exists contenido_servidor (
  coleccion text not null,
  clave text not null check (char_length(clave) between 1 and 200),
  data jsonb not null default '{}'::jsonb,
  borrado boolean not null default false,
  actualizada timestamptz not null default now(),
  actualizada_por uuid references auth.users(id) on delete set null,
  primary key (coleccion, clave)
);

alter table contenido_servidor enable row level security;

-- Todos leen: los jugadores necesitan ver lo editado. Sin políticas de escritura: solo las funciones de abajo escriben.
drop policy if exists "contenido_servidor_select" on contenido_servidor;
create policy "contenido_servidor_select" on contenido_servidor for select using (true);

create or replace function contenido_guardar(p_coleccion text, p_clave text, p_data jsonb, p_borrado boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_colecciones text[] := array['ENTRIES', 'PERSONAJES', 'LUGARES', 'FACCIONES', 'PERGAMINOS', 'ARMAS', 'BESTIARIO', 'RAZAS', 'RELIGIONES', 'OBJETOS',
                                'CRONOLOGIA_A', 'CRONOLOGIA_B', 'CRONOLOGIA_ARCOS', 'REGLAS', 'ECONOMIA', 'NOVEDADES', 'MAPA_PUNTOS'];
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  if not (p_coleccion = any (v_colecciones)) then
    raise exception 'Colección desconocida';
  end if;
  if p_clave is null or char_length(p_clave) not between 1 and 200 then
    raise exception 'Clave inválida';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 600000 then
    raise exception 'Datos inválidos o demasiado grandes (máximo 600 KB)';
  end if;

  insert into contenido_servidor (coleccion, clave, data, borrado, actualizada, actualizada_por)
  values (p_coleccion, p_clave, p_data, coalesce(p_borrado, false), now(), uid)
  on conflict (coleccion, clave) do update
    set data = excluded.data, borrado = excluded.borrado, actualizada = now(), actualizada_por = uid;
end;
$$;

-- Quita el parche: el elemento vuelve a ser el del archivo (o desaparece si lo había creado la web)
create or replace function contenido_restaurar(p_coleccion text, p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  delete from contenido_servidor where coleccion = p_coleccion and clave = p_clave;
end;
$$;

grant execute on function contenido_guardar(text, text, jsonb, boolean) to authenticated;
grant execute on function contenido_restaurar(text, text) to authenticated;

-- Para que quede en el historial de cambios (y se pueda deshacer). Si todavía no corriste admin_historial.sql, esta línea falla: córrelo antes.
select admin_registrar_tabla('contenido_servidor', array['coleccion', 'clave'], 'Contenido del compendio');
