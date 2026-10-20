-- Muerte Súbita tal como la deja scratchpad/muerte_subita.sql (partes 1 y 3), solo la tabla y el índice, para que las pruebas locales puedan cargar docs/veintiuna-reto.sql.
-- (ms_iniciar y ms_finalizar no hacen falta: las pruebas insertan los intentos directamente y docs/veintiuna-reto.sql trae su propia ms_finalizar.)
create table if not exists muerte_subita_intentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  personaje_id text not null,
  personaje_nombre text not null,
  desafio text not null,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'ganado', 'perdido')),
  puntaje int,
  puntaje_rival int,
  veredicto text check (veredicto in ('confirmado', 'anulado', 'perdonado')),
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz
);
create unique index if not exists muerte_subita_unico_vivo on muerte_subita_intentos (personaje_id, desafio) where veredicto is distinct from 'anulado';
alter table muerte_subita_intentos enable row level security;
drop policy if exists "ms_select" on muerte_subita_intentos;
create policy "ms_select" on muerte_subita_intentos for select using (user_id = auth.uid() or fichas_es_admin());
revoke all on muerte_subita_intentos from anon, authenticated;
grant select on muerte_subita_intentos to authenticated;
