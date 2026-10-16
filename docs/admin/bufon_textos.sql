-- Editor de diálogos del Bufón: el Admin cambia desde su panel (pestaña Bufón: textos) lo que dice el Bufón, sin tocar los archivos de data/.
-- Cada fila cambia UN texto:
--   'n:<id del nodo>'                     -> las líneas de ese nodo (lista de textos, una por pantalla)
--   'o:<id de la elección>:<id opción>'   -> el texto de un botón de elección
-- La página del Bufón (secreto.html) carga el diálogo de siempre y después sobrescribe lo que haya aquí (js/bufon-textos.js). Los ids, las ramas y las
-- condiciones no cambian: solo el texto. Sin filas, todo queda como en los archivos.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede correr más de una vez.

create table if not exists public.bufon_textos (
  clave text primary key check (clave ~ '^(n:[A-Za-z0-9_.-]{1,100}|o:[A-Za-z0-9_.-]{1,100}:[A-Za-z0-9_.-]{1,100})$'),
  valor jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null,
  constraint bufon_textos_valor check (
    (clave like 'n:%' and jsonb_typeof(valor) = 'array' and jsonb_array_length(valor) between 1 and 40
       and not jsonb_path_exists(valor, '$[*] ? (@.type() != "string" || @.size() > 700 || @ == "")'))
    or (clave like 'o:%' and jsonb_typeof(valor) = 'string' and length(valor #>> '{}') between 1 and 300)
  )
);

alter table public.bufon_textos enable row level security;
drop policy if exists "bufon_textos_select" on public.bufon_textos;
create policy "bufon_textos_select" on public.bufon_textos for select using (true);
grant select on public.bufon_textos to anon, authenticated;

create or replace function public.bufon_texto_guardar(p_clave text, p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  insert into bufon_textos (clave, valor, actualizado, actualizado_por) values (p_clave, p_valor, now(), auth.uid())
  on conflict (clave) do update set valor = excluded.valor, actualizado = now(), actualizado_por = auth.uid();
end;
$$;

create or replace function public.bufon_texto_quitar(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from bufon_textos where clave = p_clave;
end;
$$;

revoke all on function public.bufon_texto_guardar(text, jsonb) from public, anon;
revoke all on function public.bufon_texto_quitar(text) from public, anon;
grant execute on function public.bufon_texto_guardar(text, jsonb) to authenticated;
grant execute on function public.bufon_texto_quitar(text) to authenticated;

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('bufon_textos', array['clave'], 'Textos del Bufón');
