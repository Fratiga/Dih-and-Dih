-- Rocola de fondos: la biblioteca de canciones del Admin para la música de las páginas.
-- Es aparte de la Rocola pública: sus canciones no salen en rocola.html ni en ningún juego, y la lista solo la ve el Admin.
-- (Los archivos son públicos por enlace para que suenen en las páginas, pero nadie puede listarlos.)
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede correr más de una vez.

create table if not exists musica_fondos (
  id uuid primary key default gen_random_uuid(),
  ruta text not null unique,                 -- enlace público del archivo (es lo que guardan las listas de las páginas)
  archivo text not null,                     -- nombre dentro del bucket musica_fondos
  titulo text not null check (length(titulo) between 1 and 120),
  duracion numeric,
  bytes bigint,
  creada timestamptz not null default now(),
  subida_por uuid references auth.users(id) on delete set null default auth.uid()
);

alter table musica_fondos enable row level security;

drop policy if exists "musica_fondos_select" on musica_fondos;
create policy "musica_fondos_select" on musica_fondos for select to authenticated using (fichas_es_admin());
drop policy if exists "musica_fondos_insert" on musica_fondos;
create policy "musica_fondos_insert" on musica_fondos for insert to authenticated with check (fichas_es_admin());
drop policy if exists "musica_fondos_update" on musica_fondos;
create policy "musica_fondos_update" on musica_fondos for update to authenticated using (fichas_es_admin()) with check (fichas_es_admin());
drop policy if exists "musica_fondos_delete" on musica_fondos;
create policy "musica_fondos_delete" on musica_fondos for delete to authenticated using (fichas_es_admin());

do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('musica_fondos', 'musica_fondos', true, 31457280,
            array['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/flac'])
    on conflict (id) do update set public = true, file_size_limit = 31457280,
      allowed_mime_types = array['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/flac'];

    -- Bucket público: el enlace funciona para todos sin política. Estas son para listar, subir y borrar (solo Admin).
    drop policy if exists "musica_fondos_obj_select" on storage.objects;
    create policy "musica_fondos_obj_select" on storage.objects for select to authenticated using (bucket_id = 'musica_fondos' and fichas_es_admin());
    drop policy if exists "musica_fondos_obj_insert" on storage.objects;
    create policy "musica_fondos_obj_insert" on storage.objects for insert to authenticated with check (bucket_id = 'musica_fondos' and fichas_es_admin());
    drop policy if exists "musica_fondos_obj_delete" on storage.objects;
    create policy "musica_fondos_obj_delete" on storage.objects for delete to authenticated using (bucket_id = 'musica_fondos' and fichas_es_admin());
  end if;
end $$;

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('musica_fondos', array['id'], 'Rocola de fondos');
