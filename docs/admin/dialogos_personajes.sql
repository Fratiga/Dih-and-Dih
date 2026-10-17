-- Editor de diálogos del Buhonero (intercambios.html) y del herrero de la forja (forja.html): el Admin añade, cambia y quita frases desde su panel
-- (pestaña Diálogos), sin tocar archivos.
-- Cada fila es UN grupo de frases de un personaje (por ejemplo 'buhonero' / 'saludo'). La lista guardada REEMPLAZA a las frases de fábrica de ese grupo: para
-- añadir una frase se guarda la lista completa con la nueva, y para volver a las de fábrica se quita la fila. Los grupos son los momentos que el código ya
-- conoce (al saludar, al cerrar un trato, al golpear...): un grupo que el código no conoce se ignora. Sin filas, todo queda como en los archivos.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede correr más de una vez.

-- La comprobación vive en una función porque un CHECK no admite subconsultas (y el .size() de jsonpath cuenta elementos, no letras)
create or replace function public.dialogos_frases_ok(p jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p) = 'array' and jsonb_array_length(p) between 1 and 30
    and not exists (select 1 from jsonb_array_elements(p) e where jsonb_typeof(e) <> 'string' or length(e #>> '{}') not between 1 and 240)
$$;

create table if not exists public.dialogos_personajes (
  personaje text not null check (personaje in ('buhonero', 'herrero')),
  grupo text not null check (grupo ~ '^[A-Za-z0-9_]{1,40}$'),
  frases jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null,
  primary key (personaje, grupo),
  constraint dialogos_personajes_frases check (public.dialogos_frases_ok(frases))
);

alter table public.dialogos_personajes enable row level security;
drop policy if exists "dialogos_personajes_select" on public.dialogos_personajes;
create policy "dialogos_personajes_select" on public.dialogos_personajes for select using (true);
grant select on public.dialogos_personajes to anon, authenticated;
-- Sin políticas de escritura: solo las funciones de abajo escriben.

create or replace function public.dialogo_guardar(p_personaje text, p_grupo text, p_frases jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  insert into dialogos_personajes (personaje, grupo, frases, actualizado, actualizado_por) values (p_personaje, p_grupo, p_frases, now(), auth.uid())
  on conflict (personaje, grupo) do update set frases = excluded.frases, actualizado = now(), actualizado_por = auth.uid();
end;
$$;

create or replace function public.dialogo_quitar(p_personaje text, p_grupo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from dialogos_personajes where personaje = p_personaje and grupo = p_grupo;
end;
$$;

revoke all on function public.dialogo_guardar(text, text, jsonb) from public, anon;
revoke all on function public.dialogo_quitar(text, text) from public, anon;
grant execute on function public.dialogo_guardar(text, text, jsonb) to authenticated;
grant execute on function public.dialogo_quitar(text, text) to authenticated;

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('dialogos_personajes', array['personaje', 'grupo'], 'Diálogos de personajes');
