-- CRÓNICA DEL MUNDO (base): una lista corta de lo que pasa en la taberna, escrita por el servidor y leída por todos.
-- Cada suceso es una fila con su tipo, quién lo hizo, un par de cifras y, si hace falta, un enlace. El texto de cada frase NO se guarda: lo arma el navegador
-- (js/cronica.js) con plantillas, así se puede reescribir el tono sin tocar la base.
-- Los sucesos los anotan los disparadores de docs/cronica-2_disparadores.sql (cartas ganadas, intercambios, crías, apuestas grandes, rachas y desafíos de oro de
-- Veintiuna, copas del Hipódromo). El Admin también puede escribir noticias propias (cronica_publicar).
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql (fichas_es_admin) y de la economía de cartas. Se puede repetir sin romper nada.
--
-- Quién puede qué:
--   * cronica_sucesos y cronica_tipos: nadie las lee ni las escribe directo. Todo pasa por las funciones de abajo (security definer).
--   * cronica_ver / cronica_contar: cualquiera con sesión. Filtran por Side (mismo Side o sin Side; el Admin y quien tenga la excepción de Side ven los dos),
--     respetan la hora de visibilidad (una copa no se cuenta antes de que acabe la carrera) y esconden quién fue en los tipos anónimos (intercambios y crías).
--   * cronica_publicar, cronica_ocultar, cronica_tipo_guardar, cronica_admin_ver y cronica_admin_tipos: solo el Admin.
--   * cronica_i_*: internas. Ni los jugadores ni la web pueden llamarlas.

/* ================================================================== 1) TABLAS */
create table if not exists public.cronica_tipos (
  tipo text primary key,
  juego text not null,
  activo boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  descripcion text not null default ''
);

create table if not exists public.cronica_sucesos (
  id bigint generated always as identity primary key,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),           -- sube al actualizarse (la racha viva de Veintiuna) y ordena la lista
  visible_desde timestamptz not null default now(),         -- no se enseña antes (una copa no se cuenta hasta que acaba la carrera)
  juego text not null,
  tipo text not null,
  user_id uuid references auth.users(id) on delete set null,   -- protagonista (vacío = el mundo o el DM)
  otro_id uuid references auth.users(id) on delete set null,   -- el otro lado de un intercambio
  side text check (side is null or side in ('A', 'B')),        -- vacío = los dos lados
  datos jsonb not null default '{}'::jsonb,                    -- cifras y cartas para la plantilla (nunca nombres de jugadores)
  enlace text check (enlace is null or enlace ~ '^[a-z0-9_-]+\.html(#[A-Za-z0-9_-]*)?$'),
  clave text unique,                                           -- evita anotar dos veces lo mismo: 'hip:apuesta:123'
  oculto boolean not null default false
);
create index if not exists cronica_sucesos_actualizado_idx on public.cronica_sucesos (actualizado desc, id desc);
create index if not exists cronica_sucesos_usuario_idx on public.cronica_sucesos (user_id, tipo, creado desc);

alter table public.cronica_tipos enable row level security;
alter table public.cronica_sucesos enable row level security;
revoke all on public.cronica_tipos, public.cronica_sucesos from public, anon, authenticated;
-- Sin políticas: la lectura y la escritura pasan solo por las funciones de abajo.

/* ================================================================== 2) LOS TIPOS Y SUS UMBRALES (el Admin los cambia desde su panel) */
insert into public.cronica_tipos (tipo, juego, activo, config, descripcion) values
  ('carta_ganada', 'cartas', true, '{"min_rareza": "rara", "max_por_dia": 3, "numero_copia": true}',
    'Alguien gana una carta rara o mejor jugando, forjando o con los sellos. No cuenta lo que se compra al Buhonero ni lo que regala el Admin, y las crías van por su tipo.'),
  ('intercambio', 'cartas', true, '{"anonimo": true, "min_rareza": "rara", "min_cartas": 3}',
    'Se cierra un intercambio donde alguna carta es rara o mejor, o suman 3 cartas o más. Sin nombres.'),
  ('cria_nacida', 'cartas', true, '{"anonimo": true, "min_rareza": "rara", "primera_especie": true}',
    'Nace una cría rara o mejor, o la primera de su especie en el mundo. Sin nombres.'),
  ('apuesta_hipodromo', 'hipodromo', true, '{"ratio": 4, "min_pago": 200}',
    'Una apuesta del Hipódromo paga al menos 4 veces lo apostado y al menos 200 tokens de juego.'),
  ('apuesta_veintiuna', 'veintiuna', true, '{"ratio": 4, "min_pago": 200}',
    'Una mano o una mesa de Veintiuna con apuesta paga al menos 4 veces lo apostado y al menos 200 tokens de juego.'),
  ('racha_veintiuna', 'veintiuna', true, '{"min": 4}',
    'Una racha de más de 3 victorias seguidas en Veintiuna. Una sola línea que se actualiza mientras dura y se cierra cuando se pierde.'),
  ('logro_oro_veintiuna', 'veintiuna', true, '{}',
    'Se completa un desafío de nivel oro de Veintiuna.'),
  ('copa_hipodromo', 'hipodromo', true, '{}',
    'Una criatura con dueño gana una copa o un Gran Premio del Hipódromo.'),
  ('partida_dificil', 'ajedrez', false, '{}',
    'Ganar a un rival difícil. Apagado: esas partidas las informa el navegador y la crónica anotaría algo falsificable.'),
  ('nota', 'campana', true, '{"dias": 60}',
    'Noticias que escribe el Admin.')
on conflict (tipo) do update set juego = excluded.juego, descripcion = excluded.descripcion;

/* ================================================================== 3) FUNCIONES INTERNAS */
-- Orden de las rarezas, para comparar umbrales
create or replace function public.cronica_i_rango(p_rareza text)
returns int
language sql
immutable
set search_path = public
as $$
  select case coalesce(p_rareza, '') when 'comun' then 1 when 'infrecuente' then 2 when 'rara' then 3 when 'legendaria' then 4 when 'limitada' then 5 else 0 end
$$;

-- Anota un suceso. Nunca lanza un error: un fallo aquí no puede romper el juego que lo provocó.
--   p_actualizar: si ya existe un suceso con esa clave, lo pone al día (la racha viva) en vez de dejarlo como estaba.
create or replace function public.cronica_i_anotar(
  p_tipo text, p_user uuid, p_otro uuid, p_side text, p_datos jsonb, p_clave text,
  p_enlace text default null, p_actualizar boolean default false, p_visible_desde timestamptz default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_side text := p_side;
  v_otro_side text;
  v_id bigint;
begin
  select * into t from cronica_tipos where tipo = p_tipo;
  if not found or not t.activo then return null; end if;
  if v_side is null and p_user is not null then
    select side into v_side from perfiles where user_id = p_user;
    if p_otro is not null then
      select side into v_otro_side from perfiles where user_id = p_otro;
      if v_otro_side is distinct from v_side then v_side := null; end if;   -- dos Sides distintos: lo ven los dos
    end if;
  end if;
  if v_side is not null and v_side not in ('A', 'B') then v_side := null; end if;
  insert into cronica_sucesos (juego, tipo, user_id, otro_id, side, datos, enlace, clave, visible_desde)
  values (t.juego, p_tipo, p_user, p_otro, v_side, coalesce(p_datos, '{}'::jsonb), p_enlace, p_clave, coalesce(p_visible_desde, now()))
  on conflict (clave) do update set datos = excluded.datos, actualizado = now() where p_actualizar
  returning id into v_id;
  return v_id;
exception when others then
  return null;
end;
$$;

-- Los sucesos que la persona que llama puede ver ahora mismo. Una sola definición de «quién ve qué» para cronica_ver y cronica_contar.
create or replace function public.cronica_i_visibles()
returns setof cronica_sucesos
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_admin boolean;
  v_side text;
  v_ambos boolean := false;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  v_admin := fichas_es_admin();
  select side into v_side from perfiles where user_id = uid;
  begin v_ambos := coalesce(side_ve_ambos(), false); exception when undefined_function then v_ambos := false; end;   -- la excepción de Side es opcional
  return query
    select s.* from cronica_sucesos s
      left join cronica_tipos t on t.tipo = s.tipo
     where not s.oculto
       and s.visible_desde <= now()
       and s.actualizado > now() - make_interval(days => coalesce((t.config ->> 'dias')::int, 14))
       and (v_admin or v_ambos or s.side is null or s.side = v_side);
end;
$$;

/* ================================================================== 4) LECTURA (jugadores) */
-- Los últimos sucesos, del más reciente al más antiguo. p_antes pagina (pasa el campo «actualizado» del último que tengas). p_juego filtra por juego.
-- En los tipos anónimos (config.anonimo) no se dice quién: user y otro vienen vacíos, salvo para el Admin. «yo» dice si el suceso te toca.
create or replace function public.cronica_ver(p_limite int default 20, p_antes timestamptz default null, p_juego text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_admin boolean;
  r jsonb;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  v_admin := fichas_es_admin();
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'tipo', x.tipo, 'juego', x.juego, 'creado', x.creado, 'actualizado', x.actualizado,
      'yo', (x.user_id = uid or x.otro_id = uid),
      'anonimo', x.anon,
      'user', case when x.anon and not v_admin then null else coalesce(x.nombre_user, case when x.user_id is null then null else 'Alguien' end) end,
      'otro', case when x.anon and not v_admin then null else coalesce(x.nombre_otro, case when x.otro_id is null then null else 'Alguien' end) end,
      'datos', x.datos, 'enlace', x.enlace, 'side', x.side
    ) order by x.actualizado desc, x.id desc), '[]'::jsonb)
    into r
    from (
      select s.*, coalesce((t.config ->> 'anonimo')::boolean, false) as anon,
             (select p.username from perfiles p where p.user_id = s.user_id) as nombre_user,
             (select p.username from perfiles p where p.user_id = s.otro_id) as nombre_otro
        from cronica_i_visibles() s
        left join cronica_tipos t on t.tipo = s.tipo
       where (p_antes is null or s.actualizado < p_antes)
         and (p_juego is null or s.juego = p_juego)
       order by s.actualizado desc, s.id desc
       limit least(greatest(coalesce(p_limite, 20), 1), 100)
    ) x;
  return jsonb_build_object('ahora', now(), 'sucesos', r);
end;
$$;

-- Cuántos sucesos hay desde una hora (para el aviso de la taberna) y cuántos te tocan a ti. No devuelve nada más.
create or replace function public.cronica_contar(p_desde timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_n int; v_mios int;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select count(*), count(*) filter (where s.user_id = uid or s.otro_id = uid) into v_n, v_mios
    from cronica_i_visibles() s
   where s.actualizado > coalesce(p_desde, now() - interval '1 day');
  return jsonb_build_object('n', v_n, 'mios', v_mios);
end;
$$;

/* ================================================================== 5) ADMIN */
-- Una noticia escrita por el Admin: a un Side o a los dos, con enlace opcional.
create or replace function public.cronica_publicar(p_texto text, p_side text default null, p_enlace text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint; v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if length(v_texto) < 1 or length(v_texto) > 240 then raise exception 'La noticia tiene que tener entre 1 y 240 caracteres'; end if;
  if p_side is not null and p_side not in ('A', 'B') then raise exception 'El Side es A o B (o vacío para los dos)'; end if;
  insert into cronica_sucesos (juego, tipo, user_id, side, datos, enlace)
  values ('campana', 'nota', null, p_side, jsonb_build_object('texto', v_texto), nullif(btrim(coalesce(p_enlace, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.cronica_ocultar(p_id bigint, p_oculto boolean default true)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  update cronica_sucesos set oculto = coalesce(p_oculto, true) where id = p_id;
  if not found then raise exception 'Ese suceso no existe'; end if;
end;
$$;

-- Encender o apagar un tipo y cambiar sus umbrales
create or replace function public.cronica_tipo_guardar(p_tipo text, p_activo boolean, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'La configuración tiene que ser un objeto JSON'; end if;
  update cronica_tipos set activo = coalesce(p_activo, activo), config = p_config where tipo = p_tipo;
  if not found then raise exception 'Ese tipo no existe'; end if;
end;
$$;

create or replace function public.cronica_admin_tipos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('tipo', t.tipo, 'juego', t.juego, 'activo', t.activo, 'config', t.config, 'descripcion', t.descripcion,
           'total', (select count(*) from cronica_sucesos s where s.tipo = t.tipo)) order by t.juego, t.tipo) from cronica_tipos t), '[]'::jsonb);
end;
$$;

-- Todo lo anotado (también lo oculto, lo que aún no se enseña y quién fue en los anónimos), para que el Admin revise
create or replace function public.cronica_admin_ver(p_limite int default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'tipo', x.tipo, 'juego', x.juego, 'creado', x.creado, 'actualizado', x.actualizado, 'visible_desde', x.visible_desde, 'oculto', x.oculto, 'side', x.side,
      'anonimo', coalesce((x.config ->> 'anonimo')::boolean, false),
      'user', x.nombre_user, 'otro', x.nombre_otro, 'datos', x.datos, 'enlace', x.enlace
    ) order by x.actualizado desc, x.id desc)
    from (
      select s.*, t.config,
             (select p.username from perfiles p where p.user_id = s.user_id) as nombre_user,
             (select p.username from perfiles p where p.user_id = s.otro_id) as nombre_otro
        from cronica_sucesos s left join cronica_tipos t on t.tipo = s.tipo
       order by s.actualizado desc, s.id desc
       limit least(greatest(coalesce(p_limite, 60), 1), 200)
    ) x), '[]'::jsonb);
end;
$$;

/* ================================================================== 6) PERMISOS */
-- Supabase da EXECUTE a todos por defecto: se quita de lo interno y se da solo a lo que corresponde.
revoke all on function public.cronica_i_rango(text) from public, anon, authenticated;
revoke all on function public.cronica_i_anotar(text, uuid, uuid, text, jsonb, text, text, boolean, timestamptz) from public, anon, authenticated;
revoke all on function public.cronica_i_visibles() from public, anon, authenticated;
revoke all on function public.cronica_ver(int, timestamptz, text) from public, anon;
revoke all on function public.cronica_contar(timestamptz) from public, anon;
revoke all on function public.cronica_publicar(text, text, text) from public, anon;
revoke all on function public.cronica_ocultar(bigint, boolean) from public, anon;
revoke all on function public.cronica_tipo_guardar(text, boolean, jsonb) from public, anon;
revoke all on function public.cronica_admin_tipos() from public, anon;
revoke all on function public.cronica_admin_ver(int) from public, anon;
grant execute on function public.cronica_ver(int, timestamptz, text) to authenticated;
grant execute on function public.cronica_contar(timestamptz) to authenticated;
grant execute on function public.cronica_publicar(text, text, text) to authenticated;
grant execute on function public.cronica_ocultar(bigint, boolean) to authenticated;
grant execute on function public.cronica_tipo_guardar(text, boolean, jsonb) to authenticated;
grant execute on function public.cronica_admin_tipos() to authenticated;
grant execute on function public.cronica_admin_ver(int) to authenticated;
