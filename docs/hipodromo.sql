-- HIPÓDROMO: tablas, permisos y la función que guarda cada tanda de carreras.
-- Se ejecuta una vez en el editor SQL de Supabase. Se puede repetir sin romper nada.
-- Explicación del conjunto en docs/hipodromo.md. Probado con PostgreSQL 16 (ver «Cómo se probó»).
--
-- Quién puede qué:
--   * hipodromo_estado    : el mundo entero, con lo oculto (genes, forma, resultado de la próxima carrera).
--                           Nadie lo lee ni lo escribe salvo la función de servicio (service_role).
--   * hipodromo_criaturas : el perfil público de cada criatura. Lo lee cualquiera.
--   * hipodromo_programa  : la próxima carrera (inscritos, puertas, pronóstico, cuotas). Lo lee cualquiera.
--   * hipodromo_carreras  : el resultado de cada carrera. La propia base lo esconde hasta la hora de salida
--                           (la carrera se calcula 30 minutos antes), así no hace falta un reloj exacto en el servidor.
--   * hipodromo_noticias  : las noticias; se leen cuando su hora ya pasó.
--   * hipodromo_votos     : (opcional) a quién apuesta cada jugador, para enseñar el porcentaje de la comunidad.

-- ------------------------------------------------------------------ estado secreto del mundo
create table if not exists public.hipodromo_estado (
  id          integer primary key default 1 check (id = 1),
  version     bigint not null default 0,
  mundo       jsonb not null,
  actualizado timestamptz not null default now()
);
alter table public.hipodromo_estado enable row level security;
revoke all on public.hipodromo_estado from anon, authenticated;      -- sin políticas: solo service_role

-- ------------------------------------------------------------------ lo público
create table if not exists public.hipodromo_criaturas (
  id        bigint primary key,
  nombre    text not null,
  sexo      text not null check (sexo in ('m', 'f')),
  estado    text not null check (estado in ('activo', 'criador', 'retirado', 'fallecido')),
  nac       integer not null,                 -- número de carrera en que nació (negativo para las que ya estaban)
  gen       integer not null default 1,       -- generación: 1 las fundadoras, 2 sus hijas...
  padre_id  bigint,
  madre_id  bigint,
  salidas   integer not null default 0,
  victorias integer not null default 0,
  premios   integer not null default 0,
  leyenda   boolean not null default false,
  n         integer not null default 0,       -- última carrera en la que cambió
  publico   jsonb not null                    -- perfil público completo, tal como lo calcula el motor
);
create unique index if not exists hipodromo_criaturas_nombre on public.hipodromo_criaturas (lower(nombre));
create index if not exists hipodromo_criaturas_estado on public.hipodromo_criaturas (estado);
create index if not exists hipodromo_criaturas_victorias on public.hipodromo_criaturas (victorias desc);
create index if not exists hipodromo_criaturas_leyenda on public.hipodromo_criaturas (leyenda) where leyenda;

create table if not exists public.hipodromo_programa (
  n       integer primary key,
  hora    timestamptz not null,
  cierre  timestamptz not null,
  publico jsonb not null
);

create table if not exists public.hipodromo_carreras (
  n         integer primary key,
  hora      timestamptz not null,
  resultado jsonb not null
);

create table if not exists public.hipodromo_noticias (
  id     bigint generated always as identity primary key,
  n      integer not null,
  hora   timestamptz not null,
  tipo   text not null,
  titulo text not null,
  texto  text not null,
  ids    bigint[] not null default '{}'
);
create index if not exists hipodromo_noticias_hora on public.hipodromo_noticias (hora desc);
create index if not exists hipodromo_noticias_ids on public.hipodromo_noticias using gin (ids);

alter table public.hipodromo_criaturas enable row level security;
alter table public.hipodromo_programa enable row level security;
alter table public.hipodromo_carreras enable row level security;
alter table public.hipodromo_noticias enable row level security;

drop policy if exists "hipodromo_criaturas se lee" on public.hipodromo_criaturas;
create policy "hipodromo_criaturas se lee" on public.hipodromo_criaturas for select using (true);
drop policy if exists "hipodromo_programa se lee" on public.hipodromo_programa;
create policy "hipodromo_programa se lee" on public.hipodromo_programa for select using (true);
drop policy if exists "hipodromo_carreras se lee desde la salida" on public.hipodromo_carreras;
create policy "hipodromo_carreras se lee desde la salida" on public.hipodromo_carreras for select using (hora <= now());
drop policy if exists "hipodromo_noticias se lee cuando toca" on public.hipodromo_noticias;
create policy "hipodromo_noticias se lee cuando toca" on public.hipodromo_noticias for select using (hora <= now());

revoke all on public.hipodromo_criaturas, public.hipodromo_programa, public.hipodromo_carreras, public.hipodromo_noticias from anon, authenticated;
grant select on public.hipodromo_criaturas, public.hipodromo_programa, public.hipodromo_carreras, public.hipodromo_noticias to anon, authenticated;

-- ------------------------------------------------------------------ guardar una tanda (la llama la Edge Function)
-- p_version: la versión del estado que leyó la función (0 la primera vez). Si otra ejecución se adelantó, falla con
-- el código 40001 y la función simplemente vuelve a intentarlo desde el estado nuevo. Todo se guarda en una transacción.
-- p_lote: lo que devuelve HipodromoMotor.lote(...) o loteInicial(...): { mundo, criaturas, programas, carreras, noticias }
create or replace function public.hipodromo_guardar(p_version bigint, p_lote jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nueva bigint;
begin
  if p_version = 0 then
    insert into hipodromo_estado (id, version, mundo) values (1, 1, p_lote->'mundo') on conflict (id) do nothing;
    if not found then raise exception 'version' using errcode = '40001'; end if;
    v_nueva := 1;
  else
    update hipodromo_estado
       set mundo = p_lote->'mundo', version = version + 1, actualizado = now()
     where id = 1 and version = p_version
     returning version into v_nueva;
    if v_nueva is null then raise exception 'version' using errcode = '40001'; end if;
  end if;

  insert into hipodromo_criaturas (id, nombre, sexo, estado, nac, gen, padre_id, madre_id, salidas, victorias, premios, leyenda, n, publico)
  select x.id, x.nombre, x.sexo, x.estado, x.nac, x.gen, x.padre_id, x.madre_id, x.salidas, x.victorias, x.premios, x.leyenda, x.n, x.publico
    from jsonb_to_recordset(coalesce(p_lote->'criaturas', '[]'::jsonb)) as x(
      id bigint, nombre text, sexo text, estado text, nac integer, gen integer, padre_id bigint, madre_id bigint,
      salidas integer, victorias integer, premios integer, leyenda boolean, n integer, publico jsonb)
  on conflict (id) do update set
    estado = excluded.estado, gen = excluded.gen, salidas = excluded.salidas, victorias = excluded.victorias,
    premios = excluded.premios, leyenda = excluded.leyenda, n = excluded.n, publico = excluded.publico;

  insert into hipodromo_programa (n, hora, cierre, publico)
  select x.n, to_timestamp(x.hora / 1000.0), to_timestamp(x.cierre / 1000.0), x.publico
    from jsonb_to_recordset(coalesce(p_lote->'programas', '[]'::jsonb)) as x(n integer, hora bigint, cierre bigint, publico jsonb)
  on conflict (n) do update set hora = excluded.hora, cierre = excluded.cierre, publico = excluded.publico;

  -- un resultado ya publicado no se vuelve a escribir
  insert into hipodromo_carreras (n, hora, resultado)
  select x.n, to_timestamp(x.hora / 1000.0), x.resultado
    from jsonb_to_recordset(coalesce(p_lote->'carreras', '[]'::jsonb)) as x(n integer, hora bigint, resultado jsonb)
  on conflict (n) do nothing;

  insert into hipodromo_noticias (n, hora, tipo, titulo, texto, ids)
  select x.n, to_timestamp(x.hora / 1000.0), x.tipo, x.titulo, x.texto,
         coalesce(array(select jsonb_array_elements_text(x.ids)::bigint), '{}')
    from jsonb_to_recordset(coalesce(p_lote->'noticias', '[]'::jsonb)) as x(n integer, hora bigint, tipo text, titulo text, texto text, ids jsonb);

  return v_nueva;
end;
$$;
revoke all on function public.hipodromo_guardar(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.hipodromo_guardar(bigint, jsonb) to service_role;

-- ------------------------------------------------------------------ vistas útiles para la interfaz
create or replace view public.hipodromo_leyendas with (security_invoker = true) as
  select id, nombre, sexo, estado, gen, salidas, victorias, premios, publico
    from public.hipodromo_criaturas
   where leyenda
   order by victorias desc, premios desc;
grant select on public.hipodromo_leyendas to anon, authenticated;

-- ------------------------------------------------------------------ OPCIONAL: opinión de la comunidad
-- Cada jugador con sesión deja a quién apuesta como ganador (una sola criatura por carrera, se puede cambiar
-- hasta que cierran las apuestas). No hay monedas: las monedas son del navegador. Esto solo sirve para enseñar
-- «Relámpago 43 %, Peregrino 21 %...». Ojo: como las monedas no están en el servidor, quien quiera puede votar
-- distinto de lo que apuesta; es una encuesta, no un registro.
create table if not exists public.hipodromo_votos (
  n           integer not null,
  usuario     uuid not null default auth.uid(),
  criatura_id bigint not null,
  creado      timestamptz not null default now(),
  primary key (n, usuario)
);
alter table public.hipodromo_votos enable row level security;

drop policy if exists "hipodromo_votos ver el propio" on public.hipodromo_votos;
create policy "hipodromo_votos ver el propio" on public.hipodromo_votos for select using (usuario = auth.uid());

drop policy if exists "hipodromo_votos votar" on public.hipodromo_votos;
create policy "hipodromo_votos votar" on public.hipodromo_votos for insert with check (
  usuario = auth.uid()
  and exists (select 1 from public.hipodromo_programa p
               where p.n = hipodromo_votos.n and now() < p.cierre
                 and p.publico->'entrantes' @> jsonb_build_array(jsonb_build_object('id', hipodromo_votos.criatura_id))));

drop policy if exists "hipodromo_votos cambiar" on public.hipodromo_votos;
create policy "hipodromo_votos cambiar" on public.hipodromo_votos for update using (usuario = auth.uid()) with check (
  usuario = auth.uid()
  and exists (select 1 from public.hipodromo_programa p
               where p.n = hipodromo_votos.n and now() < p.cierre
                 and p.publico->'entrantes' @> jsonb_build_array(jsonb_build_object('id', hipodromo_votos.criatura_id))));

revoke all on public.hipodromo_votos from anon, authenticated;
grant select, insert, update on public.hipodromo_votos to authenticated;

-- Solo cuentas agregadas: nadie ve quién votó qué. Es una vista con los permisos de su dueño (hace falta para contar los
-- votos de todos), y el panel de Supabase la marca como aviso de seguridad: es a propósito, solo da números.
create or replace view public.hipodromo_comunidad as
  select n, criatura_id, count(*)::integer as votos
    from public.hipodromo_votos
   group by n, criatura_id;
grant select on public.hipodromo_comunidad to anon, authenticated;
