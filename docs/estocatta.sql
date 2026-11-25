-- Estocatta: registro de partidas en línea.
-- Lo escribe SOLO el servidor de Estocatta (servidor/estocatta/servidor.js) con la clave de
-- servicio, una vez por partida: si el servidor reintenta, la misma partida no se anota dos
-- veces (la clave primaria es el identificador de la partida que genera el servidor).
-- Cada jugador puede leer sus propias partidas (la portada muestra victorias y derrotas);
-- el admin las ve todas. Nadie puede escribir desde el navegador.
-- Se puede volver a correr entero sin romper nada.

create table if not exists estocatta_partidas (
  partida uuid primary key,
  creada timestamptz not null default now(),
  j0 uuid not null references auth.users(id) on delete cascade,
  j1 uuid not null references auth.users(id) on delete cascade,
  ganador smallint not null check (ganador in (-1, 0, 1)),        -- -1 = empate
  motivo text not null check (motivo in ('salida', 'territorio', 'bajas', 'muerte_subita', 'abandono', 'empate')),
  bajas0 int not null default 0 check (bajas0 between 0 and 1000),
  bajas1 int not null default 0 check (bajas1 between 0 and 1000),
  duracion_ms int not null default 0 check (duracion_ms between 0 and 3600000),
  check (j0 <> j1)
);
create index if not exists estocatta_partidas_j0 on estocatta_partidas (j0, creada desc);
create index if not exists estocatta_partidas_j1 on estocatta_partidas (j1, creada desc);

alter table estocatta_partidas enable row level security;

drop policy if exists "estocatta: cada uno ve las suyas" on estocatta_partidas;
create policy "estocatta: cada uno ve las suyas" on estocatta_partidas
  for select to authenticated
  using (j0 = auth.uid() or j1 = auth.uid() or fichas_es_admin());

revoke insert, update, delete on estocatta_partidas from anon, authenticated;
grant select on estocatta_partidas to authenticated;

/* Anota una partida terminada. Devuelve true si es nueva y false si ya estaba anotada. */
create or replace function estocatta_registrar(
  p_partida uuid, p_j0 uuid, p_j1 uuid, p_ganador smallint, p_motivo text,
  p_bajas0 int, p_bajas1 int, p_duracion_ms int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into estocatta_partidas (partida, j0, j1, ganador, motivo, bajas0, bajas1, duracion_ms)
  values (p_partida, p_j0, p_j1, p_ganador, p_motivo, greatest(0, p_bajas0), greatest(0, p_bajas1), least(greatest(0, p_duracion_ms), 3600000))
  on conflict (partida) do nothing;
  return found;
end;
$$;

revoke all on function estocatta_registrar(uuid, uuid, uuid, smallint, text, int, int, int) from public, anon, authenticated;
grant execute on function estocatta_registrar(uuid, uuid, uuid, smallint, text, int, int, int) to service_role;
