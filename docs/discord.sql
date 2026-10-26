-- Integración con Discord (bot «The great mice», aplicación «D&D»): vinculación de cuentas y consultas del bot.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql y de docs/admin/side_excepciones.sql. Se puede repetir.
-- No toca ninguna tabla ni función existente: solo crea tablas y funciones nuevas.
--
-- Cómo está repartido el trabajo (ver docs/discord.md):
--   * Las funciones discord_estado, discord_crear_codigo y discord_desvincular las llama la PÁGINA con la sesión del jugador.
--   * Las que empiezan por discord_i_ solo las puede llamar el servidor (la Edge Function «discord» con la clave de servicio). Discord ya firmó la
--     petición y la función ya comprobó la firma, así que el identificador de Discord que reciben es de fiar. Ningún jugador puede llamarlas.
--   * Las consultas públicas (cartas publicadas, clasificaciones) las hace la función con las mismas reglas que la web, no con permisos de más.

-- === Tablas ======================================================================================================

-- Una cuenta de la web con una cuenta de Discord, y al revés. El identificador de Discord es el número (snowflake), nunca el nombre visible.
create table if not exists public.discord_vinculos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discord_id text not null unique check (discord_id ~ '^[0-9]{15,25}$'),
  discord_nombre text check (discord_nombre is null or length(discord_nombre) <= 80),   -- solo para mostrarlo; puede cambiar y no se usa para decidir nada
  vinculada timestamptz not null default now()
);

-- Códigos de un solo uso. Solo se guarda el hash: ni la base de datos puede leer un código que aún no se ha usado.
create table if not exists public.discord_codigos (
  codigo_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  creado timestamptz not null default now(),
  expira timestamptz not null,
  usado timestamptz
);
create index if not exists discord_codigos_usuario on public.discord_codigos (user_id);

-- Intentos fallidos de /vincular por cuenta de Discord (frena que alguien pruebe códigos al azar).
create table if not exists public.discord_intentos (
  discord_id text not null,
  hora timestamptz not null default now()
);
create index if not exists discord_intentos_id on public.discord_intentos (discord_id, hora);

alter table public.discord_vinculos enable row level security;
alter table public.discord_codigos enable row level security;
alter table public.discord_intentos enable row level security;

-- Nadie escribe directamente. Cada jugador solo puede ver su propia vinculación.
revoke all on public.discord_vinculos, public.discord_codigos, public.discord_intentos from public, anon, authenticated;
grant select on public.discord_vinculos to authenticated;
drop policy if exists "discord_vinculos_propia" on public.discord_vinculos;
create policy "discord_vinculos_propia" on public.discord_vinculos for select to authenticated using (user_id = auth.uid());

-- === Lo que llama la página (con la sesión del jugador) ==========================================================

-- Estado de la vinculación de quien pregunta.
create or replace function public.discord_estado()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then jsonb_build_object('vinculada', false)
    else coalesce((select jsonb_build_object('vinculada', true, 'nombre', v.discord_nombre, 'desde', v.vinculada)
                   from discord_vinculos v where v.user_id = auth.uid()),
                  jsonb_build_object('vinculada', false)) end
$$;

-- Crea un código nuevo (8 letras y números sin los que se confunden), válido 10 minutos y de un solo uso. Sustituye a los anteriores sin usar.
-- Como mucho 5 códigos por hora y cuenta.
create or replace function public.discord_crear_codigo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 símbolos, sin 0, O, 1 ni I (se confunden)
  semilla bytea;
  codigo text := '';
  i int;
begin
  if uid is null then raise exception 'Inicia sesión para vincular tu cuenta.'; end if;
  if exists (select 1 from discord_vinculos where user_id = uid) then
    raise exception 'Tu cuenta ya está vinculada con Discord. Desvincúlala primero si quieres usar otra.';
  end if;
  if (select count(*) from discord_codigos where user_id = uid and creado > now() - interval '1 hour') >= 5 then
    raise exception 'Has pedido demasiados códigos. Espera un rato y vuelve a intentarlo.';
  end if;
  -- gen_random_uuid() sale del generador seguro de Postgres; con su hash se eligen los 8 símbolos sin sesgo (256 es múltiplo de 32).
  semilla := sha256(gen_random_uuid()::text::bytea);
  for i in 0..7 loop
    codigo := codigo || substr(alfabeto, (get_byte(semilla, i) % 32) + 1, 1);
  end loop;
  -- Los códigos anteriores sin usar dejan de valer (se conservan una hora para poder contar el límite de arriba)
  update discord_codigos set expira = now() where user_id = uid and usado is null and expira > now();
  delete from discord_codigos where creado < now() - interval '1 day';
  insert into discord_codigos (codigo_hash, user_id, expira)
  values (encode(sha256(codigo::bytea), 'hex'), uid, now() + interval '10 minutes');
  return jsonb_build_object('codigo', codigo, 'expira', now() + interval '10 minutes');
end;
$$;

-- Desvincula la cuenta de quien llama.
create or replace function public.discord_desvincular()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  delete from discord_vinculos where user_id = auth.uid();
  delete from discord_codigos where user_id = auth.uid();
end;
$$;

-- === Lo que llama el servidor (Edge Function «discord», clave de servicio) =======================================

-- Normaliza lo que escribe la persona: mayúsculas, sin espacios ni guiones.
create or replace function public.discord_i_normalizar(p text)
returns text
language sql
immutable
as $$ select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g')) $$;

-- Cuenta de la web de una cuenta de Discord (null si no está vinculada).
create or replace function public.discord_i_usuario(p_discord_id text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$ select user_id from discord_vinculos where discord_id = p_discord_id $$;

-- ¿Es admin esa cuenta de la web?
create or replace function public.discord_i_es_admin(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from fichas_admins where user_id = p_uid) $$;

-- ¿Puede esa cuenta ver contenido de ese lado? lado nulo o vacío = contenido de todos. Sin cuenta vinculada solo se ve lo de todos.
-- Mismas reglas que la web: su propio Side, o la excepción de Side, o ser admin.
create or replace function public.discord_i_ve_lado(p_uid uuid, p_lado text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_lado is null or cardinality(p_lado) = 0
      or (p_uid is not null and (
            exists (select 1 from perfiles where user_id = p_uid and side = any (p_lado))
         or exists (select 1 from side_excepciones where user_id = p_uid)
         or exists (select 1 from fichas_admins where user_id = p_uid)))
$$;

-- Vincula la cuenta de Discord con la cuenta que generó el código. El identificador viene de una petición ya firmada por Discord.
-- Nunca devuelve el código ni el hash. Devuelve {ok, mensaje}: los fallos esperados NO se lanzan como error, porque un error deshace la transacción y
-- el intento fallido no quedaría apuntado (y el límite de 5 intentos no serviría de nada). El mensaje se puede enseñar tal cual.
create or replace function public.discord_i_vincular(p_codigo text, p_discord_id text, p_discord_nombre text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c discord_codigos;
  hash text := encode(sha256(discord_i_normalizar(p_codigo)::bytea), 'hex');
  nombre text;
begin
  if p_discord_id is null or p_discord_id !~ '^[0-9]{15,25}$' then return jsonb_build_object('ok', false, 'mensaje', 'No pude identificar tu cuenta de Discord.'); end if;
  delete from discord_intentos where hora < now() - interval '1 day';
  if (select count(*) from discord_intentos where discord_id = p_discord_id and hora > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'mensaje', 'Demasiados intentos con código incorrecto. Espera 15 minutos.');
  end if;

  select * into c from discord_codigos where codigo_hash = hash for update;
  if not found or c.usado is not null or c.expira <= now() then
    insert into discord_intentos (discord_id) values (p_discord_id);
    return jsonb_build_object('ok', false, 'mensaje', 'Ese código no es válido o ya caducó. Genera uno nuevo en la web.');
  end if;
  if exists (select 1 from discord_vinculos where discord_id = p_discord_id) then
    return jsonb_build_object('ok', false, 'mensaje', 'Esta cuenta de Discord ya está vinculada a un jugador de la web. Usa /desvincular si quieres cambiarla.');
  end if;
  if exists (select 1 from discord_vinculos where user_id = c.user_id) then
    return jsonb_build_object('ok', false, 'mensaje', 'Esa cuenta de la web ya está vinculada con otra cuenta de Discord.');
  end if;

  insert into discord_vinculos (user_id, discord_id, discord_nombre)
  values (c.user_id, p_discord_id, left(p_discord_nombre, 80));
  update discord_codigos set usado = now() where codigo_hash = hash;
  delete from discord_codigos where user_id = c.user_id and codigo_hash <> hash;
  delete from discord_intentos where discord_id = p_discord_id;
  select username into nombre from perfiles where user_id = c.user_id;
  return jsonb_build_object('ok', true, 'usuario', coalesce(nombre, 'jugador'));
end;
$$;

-- Desvincula por el lado de Discord (/desvincular).
create or replace function public.discord_i_desvincular(p_discord_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  select user_id into uid from discord_vinculos where discord_id = p_discord_id;
  if uid is null then return false; end if;
  delete from discord_vinculos where user_id = uid;
  delete from discord_codigos where user_id = uid;
  return true;
end;
$$;

-- /perfil: solo la cuenta vinculada y solo lo suyo. No se puede pedir el de otra persona. Incluye lo de los juegos públicos (Hipódromo y Veintiuna
-- ya lo son); Ostelar sigue oculto y no sale.
create or replace function public.discord_i_perfil(p_discord_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  p perfiles;
  res jsonb;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  select * into p from perfiles where user_id = uid;
  res := jsonb_build_object(
    'usuario', coalesce(p.username, 'jugador'),
    'side', p.side,
    'cartas', jsonb_build_object(
      'total', (select count(*) from cartas_ejemplares where propietario = uid),
      'distintas', (select count(distinct carta_id) from cartas_ejemplares where propietario = uid)),
    'juegos', coalesce((select jsonb_agg(jsonb_build_object('juego', juego, 'partidas', partidas, 'victorias', victorias, 'derrotas', derrotas, 'tablas', tablas) order by juego)
                        from (select juego, sum(partidas)::int partidas, sum(victorias)::int victorias, sum(derrotas)::int derrotas, sum(tablas)::int tablas
                              from mj_estadisticas where user_id = uid and juego in ('ajedrez', 'arqueria') group by juego) j), '[]'::jsonb),
    'hooey', (select jsonb_build_object('total', total, 'mejor_racha', mejor_racha) from hooey_puntajes where user_id = uid),
    'tokens', coalesce((select saldo from hipodromo_billeteras where usuario = uid), 0),
    'veintiuna', (select jsonb_build_object('rondas', rondas, 'victorias', victorias, 'mejor_racha', mejor_racha) from veintiuna_estadisticas where user_id = uid));
  return res;
end;
$$;

-- /clasificacion: tablas que ya son públicas en la web (cualquiera con sesión las ve). Juegos permitidos: ajedrez, arqueria y hooey (el Duelo sigue oculto a los jugadores y no sale).
create or replace function public.discord_i_clasificacion(p_juego text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_juego = 'hooey' then
    return coalesce((select jsonb_agg(jsonb_build_object('usuario', username, 'puntos', total, 'extra', mejor_racha) order by total desc, username)
                     from (select username, total, mejor_racha from hooey_puntajes order by total desc, username limit 10) t), '[]'::jsonb);
  elsif p_juego in ('ajedrez', 'arqueria') then
    return coalesce((select jsonb_agg(jsonb_build_object('usuario', usuario, 'puntos', victorias, 'extra', partidas) order by victorias desc, usuario)
                     from (select coalesce(max(username), 'jugador') usuario, sum(victorias)::int victorias, sum(partidas)::int partidas
                           from mj_estadisticas where juego = p_juego group by user_id
                           order by sum(victorias) desc, max(username) limit 10) t), '[]'::jsonb);
  end if;
  raise exception 'Esa clasificación no existe.';
end;
$$;

-- /cartas: busca por nombre entre las cartas PUBLICADAS. Respeta el lado de cada carta (la reserva a quien no pueda verla) y, para quien no tiene
-- cuenta vinculada, solo salen las que no son de un lado concreto. Devuelve datos para el embed, nada más.
create or replace function public.discord_i_cartas(p_discord_id text, p_texto text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  t text := lower(btrim(replace(replace(coalesce(p_texto, ''), '%', ''), '_', '')));
begin
  if length(t) < 2 then raise exception 'Escribe al menos 2 letras del nombre.'; end if;
  return coalesce((
    select jsonb_agg(x) from (
      select jsonb_build_object(
               'id', d.id, 'nombre', d.data ->> 'nombre', 'epiteto', d.data ->> 'epiteto', 'tipo', d.data ->> 'tipo', 'rareza', c.rareza,
               'coste', d.data -> 'coste', 'atq', d.data -> 'atq', 'pv', d.data -> 'pv', 'afinidad', d.data -> 'afinidad',
               'habilidad', d.data ->> 'habilidad', 'descripcion', d.data ->> 'descripcion', 'imagen', d.data ->> 'imagen') x
      from cartas_definiciones d
      join cartas_catalogo c on c.id = d.id
      where c.publicada
        and discord_i_ve_lado(uid, c.lado)
        and (lower(d.data ->> 'nombre') like '%' || t || '%')
      order by (lower(d.data ->> 'nombre') = t) desc, d.data ->> 'nombre'
      limit 5) q), '[]'::jsonb);
end;
$$;

-- /eventos: avisos del sitio activos y las próximas carreras del Hipódromo (el calendario ya es público en la web). Sin cuenta vinculada solo salen los
-- avisos de todos; con cuenta, también los de su Side.
create or replace function public.discord_i_eventos(p_discord_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  lado text;
begin
  select side into lado from perfiles where user_id = uid;
  return jsonb_build_object(
    'eventos', coalesce((
      select jsonb_agg(jsonb_build_object('titulo', titulo, 'texto', texto, 'enlace', enlace, 'hasta', hasta) order by hasta)
      from eventos_sitio
      where desde <= now() and hasta > now()
        and (side is null or (uid is not null and (side = lado
             or exists (select 1 from side_excepciones where user_id = uid) or discord_i_es_admin(uid))))), '[]'::jsonb),
    'carreras', coalesce((
      select jsonb_agg(jsonb_build_object('nombre', datos ->> 'nombre', 'hora', ((datos ->> 'hora')::bigint / 1000), 'grado', datos ->> 'gradoNombre',
                                          'bolsa', datos -> 'bolsa', 'inscripcion', datos -> 'inscripcion') order by (datos ->> 'hora')::bigint)
      from (select datos from hipodromo_calendario
            where (datos ->> 'hora')::bigint > extract(epoch from now()) * 1000
            order by (datos ->> 'hora')::bigint limit 3) c), '[]'::jsonb));
end;
$$;

-- Permisos: las funciones del servidor solo para service_role; las de la página solo para quien tenga sesión.
revoke all on function
  public.discord_estado(), public.discord_crear_codigo(), public.discord_desvincular(),
  public.discord_i_normalizar(text), public.discord_i_usuario(text), public.discord_i_es_admin(uuid), public.discord_i_ve_lado(uuid, text[]),
  public.discord_i_vincular(text, text, text), public.discord_i_desvincular(text), public.discord_i_perfil(text),
  public.discord_i_clasificacion(text), public.discord_i_cartas(text, text), public.discord_i_eventos(text)
  from public, anon, authenticated;
grant execute on function public.discord_estado(), public.discord_crear_codigo(), public.discord_desvincular() to authenticated;
grant execute on function
  public.discord_i_normalizar(text), public.discord_i_usuario(text), public.discord_i_es_admin(uuid), public.discord_i_ve_lado(uuid, text[]),
  public.discord_i_vincular(text, text, text), public.discord_i_desvincular(text), public.discord_i_perfil(text),
  public.discord_i_clasificacion(text), public.discord_i_cartas(text, text), public.discord_i_eventos(text)
  to service_role;
