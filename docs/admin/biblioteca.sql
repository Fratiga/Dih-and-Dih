-- Biblioteca de los jugadores (biblioteca.html): clases, subclases, razas y otras reglas que suben los propios
-- jugadores para que todos las tengan a mano. Corre esto en el SQL Editor de Supabase; se puede repetir.
-- Requiere fichas_es_admin() (panel-admin.sql) y la tabla perfiles.
--
-- Quién hace qué:
--   - Cualquiera con sesión iniciada lee todo lo publicado (sin sesión no se ve nada: hay material de manuales).
--   - Cualquiera con sesión sube entradas nuevas. El autor lo pone el servidor, no el navegador.
--   - El autor edita o borra lo suyo. El Admin edita o borra cualquier entrada.
--   - Los archivos (PDF o imágenes, hasta 20 MB) van al bucket privado "biblioteca", dentro de una carpeta con el id
--     del que los sube. Se abren con enlaces firmados que caducan.

create table if not exists biblioteca_entradas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'clase' check (tipo in ('clase', 'subclase', 'raza', 'otro')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 80),
  fuente text not null default '' check (char_length(fuente) <= 80),
  resumen text not null default '' check (char_length(resumen) <= 300),
  contenido text not null default '' check (char_length(contenido) <= 200000),
  tabla jsonb not null default '{"columnas": [], "filas": []}'::jsonb,
  archivos jsonb not null default '[]'::jsonb,
  autor uuid not null default auth.uid() references auth.users (id) on delete cascade,
  autor_nombre text not null default '',
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
create index if not exists biblioteca_entradas_tipo on biblioteca_entradas (tipo, nombre);

-- El autor y su nombre los pone el servidor; al editar no se pueden cambiar.
create or replace function biblioteca_i_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.autor := auth.uid();
    new.autor_nombre := coalesce(nullif(btrim((select username from perfiles where user_id = auth.uid())), ''), 'Jugador');
    new.creada := now();
  else
    new.autor := old.autor;
    new.autor_nombre := old.autor_nombre;
    new.creada := old.creada;
  end if;
  new.actualizada := now();
  if jsonb_typeof(new.tabla) <> 'object' or jsonb_typeof(new.archivos) <> 'array' then raise exception 'Datos no válidos.'; end if;
  if jsonb_array_length(new.archivos) > 12 then raise exception 'Como mucho 12 archivos por entrada.'; end if;
  if pg_column_size(new.tabla) > 60000 then raise exception 'La tabla es demasiado grande.'; end if;
  return new;
end;
$$;
drop trigger if exists biblioteca_autor on biblioteca_entradas;
create trigger biblioteca_autor before insert or update on biblioteca_entradas
  for each row execute function biblioteca_i_autor();
revoke all on function biblioteca_i_autor() from public, anon, authenticated;

alter table biblioteca_entradas enable row level security;
drop policy if exists "biblioteca_select" on biblioteca_entradas;
create policy "biblioteca_select" on biblioteca_entradas for select to authenticated using (true);
drop policy if exists "biblioteca_insert" on biblioteca_entradas;
create policy "biblioteca_insert" on biblioteca_entradas for insert to authenticated with check (auth.uid() is not null);
drop policy if exists "biblioteca_update" on biblioteca_entradas;
create policy "biblioteca_update" on biblioteca_entradas for update to authenticated
  using (autor = auth.uid() or fichas_es_admin()) with check (autor = auth.uid() or fichas_es_admin());
drop policy if exists "biblioteca_delete" on biblioteca_entradas;
create policy "biblioteca_delete" on biblioteca_entradas for delete to authenticated using (autor = auth.uid() or fichas_es_admin());
revoke all on biblioteca_entradas from anon;
grant select, insert, update, delete on biblioteca_entradas to authenticated;

-- Archivos: bucket privado. Cada uno sube en su carpeta (<su id>/...); todos los que tienen sesión pueden abrirlos;
-- borra el dueño de la carpeta o el Admin.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;   -- base de pruebas sin Storage
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('biblioteca', 'biblioteca', false, 20971520, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'])
  on conflict (id) do update set public = false, file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  execute 'drop policy if exists "biblioteca_storage_select" on storage.objects';
  execute 'create policy "biblioteca_storage_select" on storage.objects for select to authenticated using (bucket_id = ''biblioteca'')';
  execute 'drop policy if exists "biblioteca_storage_insert" on storage.objects';
  execute 'create policy "biblioteca_storage_insert" on storage.objects for insert to authenticated with check (bucket_id = ''biblioteca'' and (storage.foldername(name))[1] = auth.uid()::text)';
  execute 'drop policy if exists "biblioteca_storage_delete" on storage.objects';
  execute 'create policy "biblioteca_storage_delete" on storage.objects for delete to authenticated using (bucket_id = ''biblioteca'' and ((storage.foldername(name))[1] = auth.uid()::text or fichas_es_admin()))';
end;
$$;
