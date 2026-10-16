-- Dificultad de los rivales: el Admin cambia desde su panel (pestaña Rivales) los números de los rivales de Ajedrez, Arquería y Duelo.
-- Cada fila es UN número (o una lista corta de números) de UN rival: por ejemplo ('duelo', 'caballero', 'reaccion', 0.3). El juego carga su
-- tabla de rivales como siempre y después sobrescribe lo que aquí haya (js/rivales-ajustes.js); si no hay nada, todo queda como en el archivo.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede correr más de una vez.

create table if not exists public.rivales_ajustes (
  juego text not null check (juego in ('ajedrez', 'arqueria', 'duelo')),
  rival text not null check (rival ~ '^[a-z0-9-]{1,40}$'),
  campo text not null check (campo ~ '^[A-Za-z]{1,30}$'),
  valor jsonb not null,
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null,
  primary key (juego, rival, campo),
  -- un número, o una lista de 1 a 6 números
  constraint rivales_ajustes_valor check (
    jsonb_typeof(valor) = 'number'
    or (jsonb_typeof(valor) = 'array' and jsonb_array_length(valor) between 1 and 6 and not jsonb_path_exists(valor, '$[*] ? (@.type() != "number")'))
  )
);

alter table public.rivales_ajustes enable row level security;
drop policy if exists "rivales_ajustes_select" on public.rivales_ajustes;
create policy "rivales_ajustes_select" on public.rivales_ajustes for select using (true);
-- Sin políticas de escritura: solo escriben las funciones de abajo.
grant select on public.rivales_ajustes to anon, authenticated;

create or replace function public.rival_ajuste_guardar(p_juego text, p_rival text, p_campo text, p_valor jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  insert into rivales_ajustes (juego, rival, campo, valor, actualizado, actualizado_por)
  values (p_juego, p_rival, p_campo, p_valor, now(), auth.uid())
  on conflict (juego, rival, campo) do update set valor = excluded.valor, actualizado = now(), actualizado_por = auth.uid();
end;
$$;

-- Quita un ajuste (el campo) o todos los de ese rival (sin campo): vuelven los números del archivo
create or replace function public.rival_ajuste_quitar(p_juego text, p_rival text, p_campo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from rivales_ajustes where juego = p_juego and rival = p_rival and (p_campo is null or campo = p_campo);
end;
$$;

revoke all on function public.rival_ajuste_guardar(text, text, text, jsonb) from public, anon;
revoke all on function public.rival_ajuste_quitar(text, text, text) from public, anon;
grant execute on function public.rival_ajuste_guardar(text, text, text, jsonb) to authenticated;
grant execute on function public.rival_ajuste_quitar(text, text, text) to authenticated;

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('rivales_ajustes', array['juego', 'rival', 'campo'], 'Dificultad de los rivales');
