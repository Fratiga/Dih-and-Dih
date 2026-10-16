-- Regalos y eventos: el Admin regala cartas o monedas del Hipódromo desde su panel (pestaña Regalos y eventos) y crea eventos con fechas.
--   * Regalo directo: una carta (o monedas) a una persona, a un Side o a todos. Pasa por las funciones de la economía de cartas (cartas_i_emitir): se respeta el límite
--     global, el límite por jugador y la etiqueta «En circulación», se reparte primero lo que haya en la reserva, y queda en el libro de movimientos. A quien no le cabe
--     se le salta y el panel dice quién y por qué.
--   * Evento: un aviso con fecha de inicio y de fin que sale en la taberna (con enlace opcional) y que puede llevar un regalo que cada jugador reclama UNA vez
--     (una carta y/o monedas). Si la carta no cabe (límite, agotada), el reclamo no se registra y el jugador puede volver a intentarlo.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql y de la economía de cartas (y del Hipódromo, para las monedas). Se puede repetir.

create table if not exists public.eventos_sitio (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(titulo) between 1 and 80),
  texto text not null default '' check (length(texto) <= 300),
  enlace text check (enlace is null or enlace ~ '^[a-z0-9_-]+\.html(#[A-Za-z0-9_-]*)?$'),
  side text check (side is null or side in ('A', 'B')),
  desde timestamptz not null default now(),
  hasta timestamptz not null,
  regalo_carta text,
  regalo_monedas integer check (regalo_monedas is null or regalo_monedas between 1 and 100000),
  creado timestamptz not null default now(),
  creado_por uuid references auth.users(id) on delete set null,
  constraint eventos_sitio_fechas check (hasta > desde and hasta - desde <= interval '120 days')
);
create table if not exists public.eventos_reclamos (
  evento uuid not null references public.eventos_sitio(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reclamado timestamptz not null default now(),
  primary key (evento, user_id)
);

alter table public.eventos_sitio enable row level security;
alter table public.eventos_reclamos enable row level security;
-- Cada quien ve los eventos que están en marcha y son para todos o para su Side; el Admin ve todos
drop policy if exists "eventos_sitio_select" on public.eventos_sitio;
create policy "eventos_sitio_select" on public.eventos_sitio for select to authenticated using (
  fichas_es_admin()
  or (desde <= now() and hasta > now() and (side is null or side = (select p.side from perfiles p where p.user_id = auth.uid() limit 1)))
);
drop policy if exists "eventos_reclamos_select" on public.eventos_reclamos;
create policy "eventos_reclamos_select" on public.eventos_reclamos for select to authenticated using (user_id = auth.uid() or fichas_es_admin());
-- Sin políticas de escritura: solo las funciones de abajo escriben.
grant select on public.eventos_sitio, public.eventos_reclamos to authenticated;

/* ---------------------------------------------------------------- crear, cambiar y quitar eventos (Admin) */
create or replace function public.evento_guardar(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_carta text := nullif(p ->> 'regalo_carta', '');
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if v_carta is not null and not exists (select 1 from cartas_catalogo where id = v_carta) then raise exception 'Esa carta no existe'; end if;
  if v_id is not null and exists (select 1 from eventos_reclamos where evento = v_id)
     and exists (select 1 from eventos_sitio e where e.id = v_id and (e.regalo_carta is distinct from v_carta or e.regalo_monedas is distinct from nullif(p ->> 'regalo_monedas', '')::int)) then
    raise exception 'Ya hay jugadores que reclamaron este regalo: no se puede cambiar lo que se regala (crea otro evento)';
  end if;
  if v_id is null then
    insert into eventos_sitio (titulo, texto, enlace, side, desde, hasta, regalo_carta, regalo_monedas, creado_por)
    values (p ->> 'titulo', coalesce(p ->> 'texto', ''), nullif(p ->> 'enlace', ''), nullif(p ->> 'side', ''), coalesce(nullif(p ->> 'desde', '')::timestamptz, now()),
            (p ->> 'hasta')::timestamptz, v_carta, nullif(p ->> 'regalo_monedas', '')::int, auth.uid())
    returning id into v_id;
  else
    update eventos_sitio set titulo = p ->> 'titulo', texto = coalesce(p ->> 'texto', ''), enlace = nullif(p ->> 'enlace', ''), side = nullif(p ->> 'side', ''),
      desde = coalesce(nullif(p ->> 'desde', '')::timestamptz, desde), hasta = (p ->> 'hasta')::timestamptz, regalo_carta = v_carta, regalo_monedas = nullif(p ->> 'regalo_monedas', '')::int
    where id = v_id;
    if not found then raise exception 'Ese evento no existe'; end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.evento_quitar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from eventos_sitio where id = p_id;
end;
$$;

/* ---------------------------------------------------------------- reclamar el regalo de un evento (cualquiera con sesión, una vez) */
create or replace function public.evento_reclamar(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  e eventos_sitio%rowtype;
  lado text;
  emision jsonb;
  v_saldo numeric;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select * into e from eventos_sitio where id = p_id;
  if not found or e.desde > now() or e.hasta <= now() then raise exception 'Ese evento ya no está en marcha'; end if;
  select side into lado from perfiles where user_id = uid limit 1;
  if e.side is not null and lado is distinct from e.side then raise exception 'Ese evento no es para ti'; end if;
  if e.regalo_carta is null and e.regalo_monedas is null then raise exception 'Este evento no tiene regalo'; end if;
  insert into eventos_reclamos (evento, user_id) values (p_id, uid) on conflict do nothing;
  if not found then raise exception 'Ya reclamaste este regalo'; end if;
  -- Si la carta no cabe (límite por jugador, agotada...) la excepción deshace también el reclamo
  if e.regalo_carta is not null then
    emision := cartas_i_emitir(uid, e.regalo_carta, 'regalo del evento: ' || left(e.titulo, 80), 'evento:' || p_id::text, null, false);
  end if;
  if e.regalo_monedas is not null then
    insert into hipodromo_billeteras (usuario) values (uid) on conflict (usuario) do nothing;
    update hipodromo_billeteras set saldo = saldo + e.regalo_monedas where usuario = uid returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (uid, null, 'Regalo del evento: ' || left(e.titulo, 80), e.regalo_monedas, v_saldo);
  end if;
  return jsonb_build_object('carta', e.regalo_carta, 'numero', emision -> 'numero', 'monedas', e.regalo_monedas);
end;
$$;

/* ---------------------------------------------------------------- regalos directos (Admin) */
-- A una persona (p_usuario), a un Side (p_side) o a todos (los dos nulos). Devuelve { entregadas, omitidas: [{ usuario, nombre, motivo }] }
create or replace function public.admin_regalar_carta(p_carta text, p_usuario uuid default null, p_side text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  entregadas int := 0;
  omitidas jsonb := '[]'::jsonb;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from cartas_catalogo where id = p_carta) then raise exception 'Esa carta no existe'; end if;
  if p_side is not null and p_side not in ('A', 'B') then raise exception 'El Side es A o B'; end if;
  for r in select user_id, coalesce(nullif(username, ''), left(user_id::text, 8)) as nombre from perfiles
           where (p_usuario is null or user_id = p_usuario) and (p_side is null or side = p_side) order by username limit 300 loop
    begin
      perform cartas_i_emitir(r.user_id, p_carta, 'regalo del admin', 'regalo', auth.uid(), false);
      entregadas := entregadas + 1;
    exception when others then
      omitidas := omitidas || jsonb_build_object('usuario', r.user_id, 'nombre', r.nombre, 'motivo', sqlerrm);
    end;
  end loop;
  return jsonb_build_object('entregadas', entregadas, 'omitidas', omitidas);
end;
$$;

create or replace function public.admin_regalar_monedas(p_monto integer, p_usuario uuid default null, p_side text default null, p_motivo text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_saldo numeric;
  n int := 0;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_monto is null or p_monto not between 1 and 100000 then raise exception 'El monto va de 1 a 100000'; end if;
  if p_side is not null and p_side not in ('A', 'B') then raise exception 'El Side es A o B'; end if;
  for r in select user_id from perfiles where (p_usuario is null or user_id = p_usuario) and (p_side is null or side = p_side) limit 300 loop
    insert into hipodromo_billeteras (usuario) values (r.user_id) on conflict (usuario) do nothing;
    update hipodromo_billeteras set saldo = saldo + p_monto where usuario = r.user_id returning saldo into v_saldo;
    insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (r.user_id, null, 'Regalo del admin' || case when coalesce(p_motivo, '') <> '' then ': ' || left(p_motivo, 80) else '' end, p_monto, v_saldo);
    n := n + 1;
  end loop;
  return jsonb_build_object('entregadas', n);
end;
$$;

revoke all on function public.evento_guardar(jsonb), public.evento_quitar(uuid), public.evento_reclamar(uuid), public.admin_regalar_carta(text, uuid, text), public.admin_regalar_monedas(integer, uuid, text, text) from public, anon;
grant execute on function public.evento_guardar(jsonb), public.evento_quitar(uuid), public.evento_reclamar(uuid), public.admin_regalar_carta(text, uuid, text), public.admin_regalar_monedas(integer, uuid, text, text) to authenticated;

-- Lo que se cambia aquí queda en el historial de Admin (si ya corriste admin_historial.sql)
do $$ begin
  if to_regprocedure('admin_registrar_tabla(text,text[],text)') is not null then
    perform admin_registrar_tabla('eventos_sitio', array['id'], 'Eventos del sitio');
  end if;
end $$;
