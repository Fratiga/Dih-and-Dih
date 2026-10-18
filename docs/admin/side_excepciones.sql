-- Excepciones de Side: una cuenta de esta tabla ve también el contenido del otro Side (entradas del compendio, subsecciones, cartas y los jugadores
-- conectados del otro Side), sin ser Admin y sin cambiar su Side (sigue siendo del suyo para el resto: mensajes, eventos, Bufón...).
-- El sitio lo pregunta al iniciar sesión con side_ve_ambos() y lo guarda en el navegador (js/lado.js). Sin esta tabla, nadie tiene la excepción.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede repetir. Deja a Caro con la excepción.
--   Para dar otra:    select side_excepcion_dar('<id de la cuenta>', 'motivo');
--   Para quitarla:    select side_excepcion_quitar('<id de la cuenta>');

create table if not exists public.side_excepciones (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motivo text not null default '',
  creado timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null
);

alter table public.side_excepciones enable row level security;
drop policy if exists "side_excepciones_select" on public.side_excepciones;
create policy "side_excepciones_select" on public.side_excepciones for select to authenticated using (user_id = auth.uid() or fichas_es_admin());
grant select on public.side_excepciones to authenticated;
-- Sin políticas de escritura: solo las funciones de abajo escriben.

create or replace function public.side_ve_ambos()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from side_excepciones where user_id = auth.uid())
$$;

create or replace function public.side_excepcion_dar(p_usuario uuid, p_motivo text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  insert into side_excepciones (user_id, motivo, creado_por) values (p_usuario, coalesce(p_motivo, ''), auth.uid())
  on conflict (user_id) do update set motivo = excluded.motivo;
end;
$$;

create or replace function public.side_excepcion_quitar(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from side_excepciones where user_id = p_usuario;
end;
$$;

revoke all on function public.side_ve_ambos(), public.side_excepcion_dar(uuid, text), public.side_excepcion_quitar(uuid) from public, anon;
grant execute on function public.side_ve_ambos(), public.side_excepcion_dar(uuid, text), public.side_excepcion_quitar(uuid) to authenticated;

-- Caro ve también el Side B
insert into public.side_excepciones (user_id, motivo)
select user_id, 'Excepción: ve también el Side B' from public.perfiles where lower(username) = 'caro'
on conflict (user_id) do nothing;

-- Lo que se cambia aquí queda en el historial de Admin (si ya corriste admin_historial.sql)
do $$ begin
  if to_regprocedure('admin_registrar_tabla(text,text[],text)') is not null then
    perform admin_registrar_tabla('side_excepciones', array['user_id'], 'Excepciones de Side');
  end if;
end $$;
