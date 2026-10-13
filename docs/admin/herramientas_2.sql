-- Segunda tanda de herramientas de Admin (docs/admin-herramientas.md): interruptores, mensajes a jugadores, suspensión de cuentas,
-- respuestas a peticiones y gestor de archivos. Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql.
-- Se puede correr más de una vez.

-- =====================================================================================================
-- 1) Interruptores: apagar o encender partes del sitio sin publicar nada
-- =====================================================================================================
create table if not exists sitio_interruptores (
  clave text primary key check (clave ~ '^[a-z0-9_]{1,60}$'),
  activo boolean not null default true,
  actualizada timestamptz not null default now(),
  actualizada_por uuid references auth.users(id) on delete set null
);
alter table sitio_interruptores enable row level security;
drop policy if exists "sitio_interruptores_select" on sitio_interruptores;
create policy "sitio_interruptores_select" on sitio_interruptores for select using (true);

create or replace function interruptor_poner(p_clave text, p_activo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_clave is null or p_clave !~ '^[a-z0-9_]{1,60}$' then raise exception 'Clave inválida'; end if;
  insert into sitio_interruptores (clave, activo, actualizada, actualizada_por) values (p_clave, coalesce(p_activo, true), now(), auth.uid())
  on conflict (clave) do update set activo = excluded.activo, actualizada = now(), actualizada_por = auth.uid();
end;
$$;
grant execute on function interruptor_poner(text, boolean) to authenticated;

-- =====================================================================================================
-- 2) Mensajes del Admin a los jugadores (un aviso que ven al entrar, una sola vez)
-- =====================================================================================================
create table if not exists admin_mensajes (
  id bigint generated always as identity primary key,
  texto text not null check (char_length(texto) between 1 and 600),
  para uuid references auth.users(id) on delete cascade,      -- null = todos
  side text check (side in ('A', 'B')),                       -- null = de cualquier Side
  creado timestamptz not null default now(),
  expira timestamptz,                                          -- null = no caduca
  activo boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null
);
alter table admin_mensajes enable row level security;

-- Cada jugador lee lo que es para él: para todos, para su cuenta o para su Side. El Admin lee todo.
drop policy if exists "admin_mensajes_select" on admin_mensajes;
create policy "admin_mensajes_select" on admin_mensajes for select using (
  fichas_es_admin()
  or (activo and (expira is null or expira > now())
      and (para is null or para = auth.uid())
      and (side is null or side = (select p.side from perfiles p where p.user_id = auth.uid())))
);

create or replace function admin_mensaje_enviar(p_texto text, p_para uuid default null, p_side text default null, p_dias int default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_texto is null or char_length(btrim(p_texto)) = 0 or char_length(p_texto) > 600 then raise exception 'El mensaje debe tener entre 1 y 600 letras'; end if;
  if p_side is not null and p_side not in ('A', 'B') then raise exception 'Side inválido'; end if;
  insert into admin_mensajes (texto, para, side, expira, creado_por)
  values (btrim(p_texto), p_para, p_side, case when p_dias is null then null else now() + make_interval(days => greatest(p_dias, 1)) end, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function admin_mensaje_quitar(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  update admin_mensajes set activo = false where id = p_id;
end;
$$;
grant execute on function admin_mensaje_enviar(text, uuid, text, int) to authenticated;
grant execute on function admin_mensaje_quitar(bigint) to authenticated;

-- =====================================================================================================
-- 3) Suspensión de cuentas (aviso y cierre de sesión; no borra nada)
-- =====================================================================================================
create table if not exists cuentas_suspendidas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motivo text not null default '' check (char_length(motivo) <= 300),
  hasta timestamptz,                                           -- null = hasta que se levante
  creada timestamptz not null default now(),
  creada_por uuid references auth.users(id) on delete set null
);
alter table cuentas_suspendidas enable row level security;
drop policy if exists "cuentas_suspendidas_select" on cuentas_suspendidas;
create policy "cuentas_suspendidas_select" on cuentas_suspendidas for select using (user_id = auth.uid() or fichas_es_admin());

create or replace function cuenta_suspender(p_usuario uuid, p_motivo text default '', p_dias int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_usuario = auth.uid() then raise exception 'No puedes suspender tu propia cuenta'; end if;
  if exists (select 1 from fichas_admins where user_id = p_usuario) then raise exception 'No se suspende a un admin'; end if;
  insert into cuentas_suspendidas (user_id, motivo, hasta, creada_por)
  values (p_usuario, coalesce(left(p_motivo, 300), ''), case when p_dias is null then null else now() + make_interval(days => greatest(p_dias, 1)) end, auth.uid())
  on conflict (user_id) do update set motivo = excluded.motivo, hasta = excluded.hasta, creada = now(), creada_por = auth.uid();
end;
$$;

create or replace function cuenta_levantar(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from cuentas_suspendidas where user_id = p_usuario;
end;
$$;
grant execute on function cuenta_suspender(uuid, text, int) to authenticated;
grant execute on function cuenta_levantar(uuid) to authenticated;

-- =====================================================================================================
-- 4) Respuestas a las peticiones (la persona ve la respuesta junto a «Atendida»)
-- =====================================================================================================
do $$ begin
  if to_regclass('public.peticiones') is not null then
    alter table peticiones add column if not exists respuesta text;
    alter table peticiones add column if not exists respondida timestamptz;
  end if;
end $$;

create or replace function peticion_responder(p_id uuid, p_respuesta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_respuesta is not null and char_length(p_respuesta) > 1000 then raise exception 'La respuesta es demasiado larga (1000 letras)'; end if;
  update peticiones set respuesta = nullif(btrim(coalesce(p_respuesta, '')), ''), respondida = case when nullif(btrim(coalesce(p_respuesta, '')), '') is null then null else now() end,
         atendida = true
   where id = p_id;
end;
$$;
grant execute on function peticion_responder(uuid, text) to authenticated;

-- peticiones_estado ahora devuelve también la respuesta (cambia el tipo de lo que devuelve: hay que recrearla)
do $$ begin
  if to_regclass('public.peticiones') is not null then
    drop function if exists peticiones_estado(uuid[]);
    create function peticiones_estado(p_codigos uuid[])
    returns table (codigo uuid, atendida boolean, respuesta text)
    language sql
    security definer
    set search_path = public
    stable
    as $f$
      select p.codigo, p.atendida, p.respuesta
      from peticiones p
      where p.codigo = any (p_codigos)
      limit 50;
    $f$;
    grant execute on function peticiones_estado(uuid[]) to anon, authenticated;
  end if;
end $$;

-- =====================================================================================================
-- 5) Archivos del sitio (imágenes y audio que el Admin sube y usa en el contenido)
-- =====================================================================================================
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('archivos', 'archivos', true, 20971520,
            array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'])
    on conflict (id) do update set public = true, file_size_limit = 20971520,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/mp4'];

    drop policy if exists "archivos_select" on storage.objects;
    create policy "archivos_select" on storage.objects for select using (bucket_id = 'archivos');
    drop policy if exists "archivos_insert" on storage.objects;
    create policy "archivos_insert" on storage.objects for insert to authenticated with check (bucket_id = 'archivos' and fichas_es_admin());
    drop policy if exists "archivos_delete" on storage.objects;
    create policy "archivos_delete" on storage.objects for delete to authenticated using (bucket_id = 'archivos' and fichas_es_admin());
  end if;
end $$;

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('sitio_interruptores', array['clave'], 'Interruptores del sitio');
select admin_registrar_tabla('cuentas_suspendidas', array['user_id'], 'Cuentas suspendidas');
