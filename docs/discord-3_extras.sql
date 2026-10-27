-- Discord (bot «The great mice»), parte 3: /ficha, el resumen semanal, las novedades del sitio y los avisos personales por mensaje privado.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/discord.sql, docs/discord-avisos.sql, docs/discord-2_consultas.sql y docs/cronica-1_base.sql. Se puede repetir.
-- No toca ninguna tabla ni función existente: solo lee las que ya hay y crea las suyas.
--
-- Canales nuevos de docs/discord-avisos.sql (tabla discord_canales):
--   novedades   las novedades del sitio y las entradas nuevas del compendio (solo las que no son de un Side)
--   cronica_a, cronica_b, cronica_general   también reciben el resumen semanal (cada Side el suyo, el general solo lo que ven los dos)
-- Los avisos personales NO usan canales: van por mensaje privado a quien los active con /avisos.

-- === Avisos personales: quién quiere recibir qué =================================================================
create table if not exists public.discord_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cria boolean not null default false,       -- «tu cría está lista»
  carrera boolean not null default false,    -- «tu criatura corre en 2 minutos»
  actualizado timestamptz not null default now()
);
alter table public.discord_preferencias enable row level security;
revoke all on public.discord_preferencias from public, anon, authenticated;

-- Los identificadores del índice del compendio que ya se conocen: lo que aparezca de nuevo se anuncia en el canal «novedades».
create table if not exists public.discord_indice_ids (
  id text primary key check (length(id) <= 200),
  visto timestamptz not null default now()
);
alter table public.discord_indice_ids enable row level security;
revoke all on public.discord_indice_ids from public, anon, authenticated;

-- /avisos: ver y cambiar tus avisos personales. Por defecto todo está apagado. Solo la cuenta vinculada y solo los suyos.
create or replace function public.discord_i_avisos(p_discord_id text, p_cria boolean default null, p_carrera boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  r discord_preferencias;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  if p_cria is not null or p_carrera is not null then
    insert into discord_preferencias (user_id, cria, carrera) values (uid, coalesce(p_cria, false), coalesce(p_carrera, false))
    on conflict (user_id) do update set cria = coalesce(p_cria, discord_preferencias.cria), carrera = coalesce(p_carrera, discord_preferencias.carrera), actualizado = now();
  end if;
  select * into r from discord_preferencias where user_id = uid;
  return jsonb_build_object('cria', coalesce(r.cria, false), 'carrera', coalesce(r.carrera, false));
end;
$$;

-- === /ficha ======================================================================================================

-- Un número de una ficha, venga como número o como texto (los campos de la ficha los escribe el navegador). null si no se entiende.
create or replace function public.discord_i_num(j jsonb)
returns numeric
language sql
immutable
as $$
  select case jsonb_typeof(j)
    when 'number' then (j #>> '{}')::numeric
    when 'string' then case when (j #>> '{}') ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then (j #>> '{}')::numeric end
  end
$$;

-- El modificador final de un atributo, como js/fichas-calc.js (fichasModificadorFinal): el de la puntuación más el ajuste manual.
create or replace function public.discord_i_ficha_mod(d jsonb, k text)
returns numeric
language sql
immutable
as $$
  select case when discord_i_num(d -> 'atributos' -> k) is null then null
    else floor((discord_i_num(d -> 'atributos' -> k) - 10) / 2) + coalesce(discord_i_num(d -> 'ajustesAtributos' -> k), 0) end
$$;

-- El resumen de una ficha con las mismas cuentas que js/fichas-calc.js (CA, competencia, iniciativa). Deja fuera lo privado de verdad: la historia,
-- la descripción física, las notas y el correo. Una prueba (docs/pruebas/t_discord_extras.sh) compara los números con los del navegador.
create or replace function public.discord_i_ficha_resumen(d jsonb)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'nombre', coalesce(nullif(left(d #>> '{identidad,nombre}', 80), ''), 'Sin nombre'),
    'clase', nullif(left(d #>> '{identidad,clase}', 60), ''), 'subclase', nullif(left(d #>> '{identidad,subclase}', 60), ''),
    'raza', nullif(left(d #>> '{identidad,raza}', 60), ''), 'trasfondo', nullif(left(d #>> '{identidad,trasfondo}', 60), ''),
    'alineamiento', nullif(left(d #>> '{identidad,alineamiento}', 40), ''), 'campania', nullif(left(d #>> '{identidad,campania}', 60), ''),
    'nivel', discord_i_num(d #> '{identidad,nivelTotal}'), 'experiencia', discord_i_num(d #> '{identidad,experiencia}'),
    'pv', discord_i_num(d #> '{combate,pvActual}'), 'pv_max', discord_i_num(d #> '{combate,pvMax}'), 'pv_temp', discord_i_num(d #> '{combate,pvTemp}'),
    'velocidad', nullif(left(d #>> '{combate,velocidad}', 40), ''),
    'ca', case when d #>> '{combate,ca,modo}' = 'manual' then coalesce(nullif(discord_i_num(d #> '{combate,ca,manual}'), 0), 10)
      else coalesce(nullif(discord_i_num(d #> '{combate,ca,armadura}'), 0), 10) + coalesce(discord_i_num(d #> '{combate,ca,escudo}'), 0)
           + (case when d #> '{combate,ca,incluyeDes}' = 'true'::jsonb then coalesce(discord_i_ficha_mod(d, 'des'), 0) else 0 end)
           + coalesce(discord_i_num(d #> '{combate,ca,otros}'), 0) end,
    'iniciativa', coalesce(discord_i_ficha_mod(d, 'des'), 0) + coalesce(discord_i_num(d #> '{combate,iniciativaAjuste}'), 0),
    'competencia', 2 + floor(greatest(0, coalesce(nullif(discord_i_num(d #> '{identidad,nivelTotal}'), 0), 1) - 1) / 4) + coalesce(discord_i_num(d -> 'competenciaAjusteManual'), 0),
    'atributos', (select jsonb_object_agg(k, jsonb_build_object('punt', discord_i_num(d -> 'atributos' -> k), 'mod', discord_i_ficha_mod(d, k)))
                    from unnest(array['fue', 'des', 'con', 'int', 'sab', 'car']) k),
    'condiciones', nullif(left(d #>> '{combate,condiciones}', 200), ''), 'resistencias', nullif(left(d #>> '{combate,resistencias}', 200), ''),
    'inmunidades', nullif(left(d #>> '{combate,inmunidades}', 200), ''), 'vulnerabilidades', nullif(left(d #>> '{combate,vulnerabilidades}', 200), ''),
    'monedas', jsonb_build_object('oro', discord_i_num(d #> '{inventario,monedas,oro}'), 'plata', discord_i_num(d #> '{inventario,monedas,plata}'), 'cobre', discord_i_num(d #> '{inventario,monedas,cobre}')),
    'ataques', coalesce((select jsonb_agg(left(a ->> 'nombre', 60)) from (select a from jsonb_array_elements(case when jsonb_typeof(d -> 'ataques') = 'array' then d -> 'ataques' else '[]'::jsonb end) a
                          where nullif(a ->> 'nombre', '') is not null limit 6) q), '[]'::jsonb),
    'n_rasgos', case when jsonb_typeof(d -> 'rasgos') = 'array' then jsonb_array_length(d -> 'rasgos') else 0 end,
    'n_hechizos', case when jsonb_typeof(d -> 'hechizos') = 'array' then jsonb_array_length(d -> 'hechizos') else 0 end,
    'fallecido', d -> 'fallecido' = 'true'::jsonb)
$$;

-- /ficha [nombre]: tus personajes (sin los archivados). Sin nombre da la lista; con nombre da el resumen del que mejor coincida (exacto, empieza por, o contiene).
-- Solo las fichas de la cuenta vinculada: no se puede pedir la de otra persona.
create or replace function public.discord_i_fichas(p_discord_id text, p_nombre text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  t text := lower(btrim(replace(replace(coalesce(p_nombre, ''), '%', ''), '_', '')));
  lista jsonb;
  elegido fichas_personajes;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('nombre', coalesce(nullif(left(f.data #>> '{identidad,nombre}', 80), ''), 'Sin nombre'),
                                               'clase', nullif(left(f.data #>> '{identidad,clase}', 60), ''), 'nivel', discord_i_num(f.data #> '{identidad,nivelTotal}')) order by f.updated_at desc), '[]'::jsonb)
    into lista
    from fichas_personajes f where f.owner_id = uid and not coalesce(f.archivado, false);
  if t = '' then return jsonb_build_object('lista', lista, 'ficha', null); end if;
  select * into elegido from fichas_personajes f
   where f.owner_id = uid and not coalesce(f.archivado, false) and lower(coalesce(f.data #>> '{identidad,nombre}', '')) like '%' || t || '%'
   order by (lower(f.data #>> '{identidad,nombre}') = t) desc, (lower(f.data #>> '{identidad,nombre}') like t || '%') desc, f.updated_at desc
   limit 1;
  if not found then return jsonb_build_object('lista', lista, 'ficha', null); end if;
  return jsonb_build_object('lista', lista, 'ficha', discord_i_ficha_resumen(elegido.data) || jsonb_build_object('actualizada', elegido.updated_at));
end;
$$;

-- === Resumen semanal =============================================================================================

-- Cada domingo (entre las 20:00 y las 23:00 UTC) apunta en la cola el resumen de los últimos 7 días para cada canal de la crónica: la mejor racha de
-- Veintiuna, la apuesta más pagada del Hipódromo y las cartas más raras ganadas. Sale de la crónica (cronica_sucesos), así que solo cuenta lo que ya se
-- consideró digno de anotar. El canal de un Side resume lo de su Side y lo de los dos; el general, solo lo que ven los dos. Si la semana no tuvo nada, no se publica.
create or replace function public.discord_i_encolar_resumen(p_ahora timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := coalesce(p_ahora, now());
  ev record;
  canal text;
  semana text := to_char(ahora at time zone 'utc', 'IYYY-IW');
  r_racha jsonb; r_apuesta jsonb; r_cartas jsonb; n_cartas int;
  total int := 0;
  filas int;
begin
  if extract(isodow from ahora at time zone 'utc') <> 7 or (ahora at time zone 'utc')::time < time '20:00' or (ahora at time zone 'utc')::time >= time '23:00' then
    return 0;
  end if;
  for ev in select * from (values ('cronica_a', 'A'), ('cronica_b', 'B'), ('cronica_general', null)) v(evento, lado) loop
    select canal_id into canal from discord_canales where evento = ev.evento and activo;
    if canal is null then continue; end if;

    select jsonb_build_object('user', coalesce(p.username, 'Alguien'), 'racha', (s.datos ->> 'racha')::int) into r_racha
      from cronica_sucesos s left join perfiles p on p.user_id = s.user_id
     where s.tipo = 'racha_veintiuna' and not s.oculto and s.visible_desde <= ahora and s.actualizado > ahora - interval '7 days' and s.actualizado <= ahora
       and ((ev.lado is null and s.side is null) or (ev.lado is not null and (s.side is null or s.side = ev.lado)))
       and (s.datos ->> 'racha') ~ '^[0-9]+$'
     order by (s.datos ->> 'racha')::int desc, s.id limit 1;

    select jsonb_build_object('user', coalesce(p.username, 'Alguien'), 'monto', s.datos -> 'monto', 'pago', s.datos -> 'pago', 'mult', s.datos -> 'mult', 'criaturas', s.datos -> 'criaturas') into r_apuesta
      from cronica_sucesos s left join perfiles p on p.user_id = s.user_id
     where s.tipo = 'apuesta_hipodromo' and not s.oculto and s.visible_desde <= ahora and s.actualizado > ahora - interval '7 days' and s.actualizado <= ahora
       and ((ev.lado is null and s.side is null) or (ev.lado is not null and (s.side is null or s.side = ev.lado)))
       and (s.datos ->> 'pago') ~ '^[0-9.]+$'
     order by (s.datos ->> 'pago')::numeric desc, s.id limit 1;

    select count(*), coalesce(jsonb_agg(jsonb_build_object('nombre', x.datos ->> 'nombre', 'rareza', x.datos ->> 'rareza', 'user', x.nombre) order by x.rango desc, x.id), '[]'::jsonb)
      into n_cartas, r_cartas
      from (select s.id, s.datos, coalesce(p.username, 'Alguien') as nombre, coalesce(array_position(array['comun', 'infrecuente', 'rara', 'legendaria', 'limitada'], s.datos ->> 'rareza'), 0) as rango,
                   row_number() over (order by coalesce(array_position(array['comun', 'infrecuente', 'rara', 'legendaria', 'limitada'], s.datos ->> 'rareza'), 0) desc, s.id) as puesto
              from cronica_sucesos s left join perfiles p on p.user_id = s.user_id
             where s.tipo = 'carta_ganada' and coalesce(s.datos ->> 'resumen', 'false') <> 'true' and not s.oculto and s.visible_desde <= ahora
               and s.actualizado > ahora - interval '7 days' and s.actualizado <= ahora
               and ((ev.lado is null and s.side is null) or (ev.lado is not null and (s.side is null or s.side = ev.lado)))) x
     where x.puesto <= 3;
    -- n_cartas cuenta solo las 3 mostradas: el total de la semana se pide aparte
    select count(*) into n_cartas from cronica_sucesos s
     where s.tipo = 'carta_ganada' and coalesce(s.datos ->> 'resumen', 'false') <> 'true' and not s.oculto and s.visible_desde <= ahora
       and s.actualizado > ahora - interval '7 days' and s.actualizado <= ahora
       and ((ev.lado is null and s.side is null) or (ev.lado is not null and (s.side is null or s.side = ev.lado)));

    if r_racha is null and r_apuesta is null and n_cartas = 0 then continue; end if;
    insert into discord_cola (origen, clave, canal_id, contenido, caduca)
    values ('resumen', 'resumen:' || semana || ':' || ev.evento, canal,
            jsonb_build_object('tipo', 'resumen_semanal', 'racha', r_racha, 'apuesta', r_apuesta, 'cartas', r_cartas, 'total_cartas', n_cartas,
                               'hasta', extract(epoch from ahora)::bigint),
            ahora + interval '3 hours')
    on conflict (origen, clave) do nothing;
    get diagnostics filas = row_count;
    total := total + filas;
  end loop;
  return total;
end;
$$;

-- === Novedades del sitio ========================================================================================

-- Una novedad (de data/novedades.js, que llega por el índice, o escrita desde el panel de Admin) al canal «novedades». Solo las de los últimos 2 días,
-- para que al encender el canal no salga lo antiguo. Una sola vez por novedad (restricción única de la cola).
create or replace function public.discord_i_encolar_novedad(p_clave text, p_titulo text, p_texto text, p_enlace text, p_fecha text, p_ahora timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := coalesce(p_ahora, now());
  canal text;
  filas int;
begin
  if p_clave is null or length(p_clave) > 200 or coalesce(btrim(p_titulo), '') = '' or p_fecha is null or p_fecha !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return 0; end if;
  if p_fecha::date < (ahora at time zone 'utc')::date - 2 or p_fecha::date > (ahora at time zone 'utc')::date + 1 then return 0; end if;
  select canal_id into canal from discord_canales where evento = 'novedades' and activo;
  if canal is null then return 0; end if;
  insert into discord_cola (origen, clave, canal_id, contenido, caduca)
  values ('novedad', 'novedad:' || p_clave, canal,
          jsonb_build_object('tipo', 'novedad', 'titulo', left(p_titulo, 200), 'texto', left(coalesce(p_texto, ''), 1000),
                             'enlace', case when p_enlace ~ '^[a-z0-9_-]+\.html(#[A-Za-z0-9_-]*)?$' then p_enlace end),
          ahora + interval '12 hours')
  on conflict (origen, clave) do nothing;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

-- Las novedades que el Admin escribe desde el panel (tabla contenido_servidor, colección NOVEDADES), editadas en el último día.
create or replace function public.discord_i_encolar_novedades_admin(p_ahora timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := coalesce(p_ahora, now());
  r record;
  total int := 0;
begin
  for r in select clave, data from contenido_servidor where coleccion = 'NOVEDADES' and not coalesce(borrado, false) and actualizada > ahora - interval '1 day' and actualizada <= ahora loop
    total := total + discord_i_encolar_novedad(r.clave, r.data ->> 'titulo', r.data ->> 'texto', r.data ->> 'enlace', r.data ->> 'fecha', ahora);
  end loop;
  return total;
end;
$$;

-- Tareas que no hace falta repetir cada minuto: guarda cuándo se hicieron por última vez.
create table if not exists public.discord_tareas (
  clave text primary key,
  ultima timestamptz not null default now()
);
alter table public.discord_tareas enable row level security;
revoke all on public.discord_tareas from public, anon, authenticated;

-- ¿Toca mirar el índice del compendio? Sí como mucho una vez cada 10 minutos, y solo si hay un canal «novedades» encendido (si no, no merece la pena
-- bajar 2,5 MB). Dos llamadas a la vez nunca reciben las dos «sí» (lo decide la propia base de datos).
create or replace function public.discord_i_indice_toca(p_ahora timestamptz default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := coalesce(p_ahora, now());
  ganado boolean;
begin
  if not exists (select 1 from discord_canales where evento = 'novedades' and activo) then return false; end if;
  with sube as (
    insert into discord_tareas (clave, ultima) values ('indice', ahora)
    on conflict (clave) do update set ultima = ahora where discord_tareas.ultima <= ahora - interval '10 minutes'
    returning 1)
  select exists (select 1 from sube) into ganado;
  return ganado;
end;
$$;

-- Apunta los identificadores del índice del compendio y devuelve los que son nuevos. La primera vez (tabla vacía) solo guarda: no se anuncia todo el compendio.
create or replace function public.discord_i_indice_nuevas(p_ids text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare nuevos jsonb;
begin
  if p_ids is null or cardinality(p_ids) > 20000 then raise exception 'Lista de identificadores no válida.'; end if;
  if not exists (select 1 from discord_indice_ids) then
    insert into discord_indice_ids (id) select distinct i from unnest(p_ids) i where i is not null and length(i) <= 200 on conflict do nothing;
    return '[]'::jsonb;
  end if;
  with nuevo as (
    insert into discord_indice_ids (id) select distinct i from unnest(p_ids) i where i is not null and length(i) <= 200 on conflict do nothing returning id)
  select coalesce(jsonb_agg(id), '[]'::jsonb) into nuevos from nuevo;
  return nuevos;
end;
$$;

-- Anuncia entradas nuevas del compendio (las que no son de un Side; la función de JavaScript ya las filtra) en el canal «novedades»: un solo aviso por tanda.
-- p_items: [{id, t (título), c (categoría), p (ruta)}].
create or replace function public.discord_i_encolar_entradas(p_items jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  canal text;
  filas int;
  n int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return 0; end if;
  n := jsonb_array_length(p_items);
  if n = 0 or n > 500 then return 0; end if;
  select canal_id into canal from discord_canales where evento = 'novedades' and activo;
  if canal is null then return 0; end if;
  insert into discord_cola (origen, clave, canal_id, contenido, caduca)
  values ('entradas', 'entradas:' || md5(p_items::text), canal,
          jsonb_build_object('tipo', 'entradas', 'total', n,
                             'items', (select jsonb_agg(jsonb_build_object('t', left(i ->> 't', 120), 'c', left(i ->> 'c', 40),
                                                                           'p', case when i ->> 'p' ~ '^[a-z0-9_-]+\.html(#[A-Za-z0-9_%.=-]*)?$' then i ->> 'p' end))
                                         from (select i from jsonb_array_elements(p_items) i limit 8) q)),
          now() + interval '12 hours')
  on conflict (origen, clave) do nothing;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

-- === Avisos personales por mensaje privado ======================================================================

-- A quien lo haya activado con /avisos: «tu criatura corre en 2 minutos» y «tu cría está lista». Va a la cola con el destino «dm:<id de Discord>».
create or replace function public.discord_i_encolar_personales(p_ahora timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ahora timestamptz := coalesce(p_ahora, now());
  r record;
  total int := 0;
  filas int;
begin
  for r in
    select n, hora, publico from hipodromo_programa
     where hora > ahora and hora <= ahora + interval '2 minutes' and coalesce((publico ->> 'suspendida')::boolean, false) = false
  loop
    insert into discord_cola (origen, clave, canal_id, contenido, caduca)
    select 'dm', 'dm:carrera:' || r.n || ':' || p.user_id, 'dm:' || v.discord_id,
           jsonb_build_object('tipo', 'dm_carrera', 'n', r.n, 'nombre', r.publico ->> 'nombre', 'hora', extract(epoch from r.hora)::bigint,
                              'criaturas', jsonb_agg(jsonb_build_object('nombre', left(e ->> 'nombre', 60), 'puerta', e ->> 'puerta') order by (e ->> 'puerta'))),
           r.hora
      from jsonb_array_elements(coalesce(r.publico -> 'entrantes', '[]'::jsonb)) e
      join discord_preferencias p on p.carrera and p.user_id::text = (e -> 'dueno' ->> 'id')
      join discord_vinculos v on v.user_id = p.user_id
     group by p.user_id, v.discord_id
    on conflict (origen, clave) do nothing;
    get diagnostics filas = row_count;
    total := total + filas;
  end loop;

  insert into discord_cola (origen, clave, canal_id, contenido, caduca)
  select 'dm', 'dm:cria:' || c.id, 'dm:' || v.discord_id,
         jsonb_build_object('tipo', 'dm_cria', 'cria', coalesce((select data ->> 'nombre' from cartas_definiciones where id = c.carta_id), 'una criatura')),
         ahora + interval '1 day'
    from cartas_crias c
    join discord_preferencias p on p.cria and p.user_id = c.user_id
    join discord_vinculos v on v.user_id = c.user_id
   where c.estado = 'en_curso' and c.fin <= ahora and c.fin > ahora - interval '1 day'
  on conflict (origen, clave) do nothing;
  get diagnostics filas = row_count;
  return total + filas;
end;
$$;

-- === Permisos ===================================================================================================
revoke all on function
  public.discord_i_avisos(text, boolean, boolean), public.discord_i_num(jsonb), public.discord_i_ficha_mod(jsonb, text), public.discord_i_ficha_resumen(jsonb),
  public.discord_i_fichas(text, text), public.discord_i_encolar_resumen(timestamptz), public.discord_i_encolar_novedad(text, text, text, text, text, timestamptz),
  public.discord_i_encolar_novedades_admin(timestamptz), public.discord_i_indice_nuevas(text[]), public.discord_i_encolar_entradas(jsonb),
  public.discord_i_encolar_personales(timestamptz), public.discord_i_indice_toca(timestamptz)
  from public, anon, authenticated;
grant execute on function
  public.discord_i_avisos(text, boolean, boolean), public.discord_i_num(jsonb), public.discord_i_ficha_mod(jsonb, text), public.discord_i_ficha_resumen(jsonb),
  public.discord_i_fichas(text, text), public.discord_i_encolar_resumen(timestamptz), public.discord_i_encolar_novedad(text, text, text, text, text, timestamptz),
  public.discord_i_encolar_novedades_admin(timestamptz), public.discord_i_indice_nuevas(text[]), public.discord_i_encolar_entradas(jsonb),
  public.discord_i_encolar_personales(timestamptz), public.discord_i_indice_toca(timestamptz)
  to service_role;
