-- Cambiar el nombre de las imágenes de la galería de fanarts desde el panel de Admin.
-- Corre esto en el SQL Editor de Supabase. Requiere fichas_es_admin() (panel-admin.sql)
-- y fanarts_subidos.sql ya corrido. Se puede correr más de una vez.
--
-- Las imágenes subidas desde el panel ya guardan su nombre en fanarts_subidos: la función
-- lo actualiza ahí. Las imágenes que vienen del repositorio no tienen nombre propio (se
-- deduce del archivo), así que el nombre nuevo se guarda en fanarts_nombres. Dejar el
-- nombre vacío en una imagen del repositorio vuelve al nombre del archivo.

create table if not exists fanarts_nombres (
  src text primary key,
  nombre text not null check (char_length(nombre) between 1 and 140),
  actualizada timestamptz not null default now()
);

alter table fanarts_nombres enable row level security;

drop policy if exists "fanarts_nombres_select" on fanarts_nombres;
create policy "fanarts_nombres_select" on fanarts_nombres
  for select using (true);

create or replace function fanarts_admin_set_nombre(p_src text, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text := left(btrim(coalesce(p_nombre, '')), 140);
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  if exists (select 1 from fanarts_subidos where src = p_src) then
    if v_nombre = '' then
      raise exception 'El nombre no puede quedar vacío.';
    end if;
    update fanarts_subidos set nombre = v_nombre where src = p_src;
  elsif v_nombre = '' then
    delete from fanarts_nombres where src = p_src;
  else
    insert into fanarts_nombres (src, nombre) values (p_src, v_nombre)
    on conflict (src) do update set nombre = excluded.nombre, actualizada = now();
  end if;
end;
$$;

grant execute on function fanarts_admin_set_nombre(text, text) to authenticated;
