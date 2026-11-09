-- Concurso: vistas de jugador remotas (concurso-jugador.html). Corre esto en el SQL Editor de Supabase.
-- Requiere fichas_es_admin() (panel-admin.sql). Se puede correr más de una vez.
--
-- Nadie lee estas tablas directamente: no tienen políticas de lectura salvo para Admin. La cabina publica con
-- concurso_publicar() y cada jugador lee solo lo suyo con concurso_jugador(token). El token va en el enlace
-- personal de cada jugador; sin token no se ve nada.

create table if not exists concurso_partidas (
  id uuid primary key,
  publico jsonb not null default '{}'::jsonb,
  actualizada timestamptz not null default now()
);

create table if not exists concurso_jugadores (
  token uuid primary key,
  partida_id uuid not null references concurso_partidas(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  actualizada timestamptz not null default now()
);

create index if not exists concurso_jugadores_partida on concurso_jugadores (partida_id);

alter table concurso_partidas enable row level security;
alter table concurso_jugadores enable row level security;

drop policy if exists "concurso_partidas_admin" on concurso_partidas;
create policy "concurso_partidas_admin" on concurso_partidas
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "concurso_jugadores_admin" on concurso_jugadores;
create policy "concurso_jugadores_admin" on concurso_jugadores
  for all using (fichas_es_admin()) with check (fichas_es_admin());

-- La cabina manda la parte pública de la partida y, por jugador, su token y sus datos privados.
-- Los jugadores que ya no están en la lista se borran.
create or replace function concurso_publicar(p_id uuid, p_publico jsonb, p_jugadores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  j jsonb;
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  if octet_length(p_publico::text) > 200000 or octet_length(p_jugadores::text) > 400000 then
    raise exception 'Demasiados datos';
  end if;

  insert into concurso_partidas (id, publico, actualizada) values (p_id, p_publico, now())
  on conflict (id) do update set publico = excluded.publico, actualizada = now();

  delete from concurso_jugadores
  where partida_id = p_id
    and token not in (select (x ->> 'token')::uuid from jsonb_array_elements(coalesce(p_jugadores, '[]'::jsonb)) x);

  for j in select * from jsonb_array_elements(coalesce(p_jugadores, '[]'::jsonb)) loop
    insert into concurso_jugadores (token, partida_id, datos, actualizada)
    values ((j ->> 'token')::uuid, p_id, coalesce(j -> 'datos', '{}'::jsonb), now())
    on conflict (token) do update set partida_id = excluded.partida_id, datos = excluded.datos, actualizada = now();
  end loop;
end;
$$;

grant execute on function concurso_publicar(uuid, jsonb, jsonb) to authenticated;

-- Lo que ve un jugador: lo público de su partida y lo suyo. Devuelve null si el token no existe.
create or replace function concurso_jugador(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'partida', p.id,
    'publico', p.publico,
    'privado', j.datos,
    'actualizada', greatest(p.actualizada, j.actualizada)
  )
  from concurso_jugadores j
  join concurso_partidas p on p.id = j.partida_id
  where j.token = p_token;
$$;

grant execute on function concurso_jugador(uuid) to anon, authenticated;
