-- Discord (bot «The great mice»), parte 2: la crónica del mundo, los desafíos de Veintiuna, la próxima carrera y los anuncios por Side.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/discord.sql, docs/discord-avisos.sql y docs/cronica-1_base.sql. Se puede repetir.
-- No toca ninguna tabla ni función existente. Todo lo que lee ya lo lee la web; aquí solo se le pone la misma regla de «quién ve qué».
--
-- Anuncios en canales (los elige el Admin en la tabla discord_canales, igual que el de las carreras):
--   cronica_a        sucesos del Side A (y solo del Side A)
--   cronica_b        sucesos del Side B (y solo del Side B)
--   cronica_general  sucesos que ven los dos Sides (intercambios entre Sides, noticias del Admin para todos)
--   veintiuna        el recordatorio diario de que los desafíos se reinician
-- Sin canal configurado para un tipo, no se anuncia nada de ese tipo. Los canales de Side deben ser canales que solo lea ese Side: el bot no lo comprueba.

-- === Consultas de jugadores (servidor) ==========================================================================

-- /cronica: los últimos sucesos que esa cuenta puede ver. Misma regla que cronica_ver() de la web (docs/cronica-1_base.sql): sin ocultos, no antes de su hora,
-- dentro de los días de cada tipo y solo de su Side (o de ambos si tiene la excepción de Side o es admin). Los tipos anónimos (intercambios y crías) nunca
-- dicen quién fue, ni siquiera a un admin: en Discord se lee en un canal. Hace falta tener la cuenta vinculada, como en la web hace falta tener sesión.
create or replace function public.discord_i_cronica(p_discord_id text, p_limite int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  v_side text;
  v_ambos boolean;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  select side into v_side from perfiles where user_id = uid;
  v_ambos := exists (select 1 from side_excepciones where user_id = uid) or exists (select 1 from fichas_admins where user_id = uid);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', x.id, 'tipo', x.tipo, 'juego', x.juego, 'actualizado', x.actualizado, 'yo', (x.user_id = uid or x.otro_id = uid),
        'user', case when x.anon then null else coalesce(x.nombre_user, case when x.user_id is null then null else 'Alguien' end) end,
        'otro', case when x.anon then null else coalesce(x.nombre_otro, case when x.otro_id is null then null else 'Alguien' end) end,
        'datos', x.datos, 'enlace', x.enlace) order by x.actualizado desc, x.id desc)
    from (
      select s.*, coalesce((t.config ->> 'anonimo')::boolean, false) as anon,
             (select p.username from perfiles p where p.user_id = s.user_id) as nombre_user,
             (select p.username from perfiles p where p.user_id = s.otro_id) as nombre_otro
        from cronica_sucesos s
        left join cronica_tipos t on t.tipo = s.tipo
       where not s.oculto and s.visible_desde <= now()
         and s.actualizado > now() - make_interval(days => coalesce((t.config ->> 'dias')::int, 14))
         and (v_ambos or s.side is null or s.side = v_side)
       order by s.actualizado desc, s.id desc
       limit least(greatest(coalesce(p_limite, 10), 1), 15)) x), '[]'::jsonb);
end;
$$;

-- /racha y /desafios: lo de Las Veintiuna Velas de esa cuenta. Los desafíos se reinician cada día a las 00:00 UTC (docs/veintiuna.sql): si el último día
-- anotado es anterior a hoy, no cuenta nada de lo anterior.
create or replace function public.discord_i_veintiuna(p_discord_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  est veintiuna_estadisticas;
  hoy date := (now() at time zone 'utc')::date;
  vigente boolean;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  select * into est from veintiuna_estadisticas where user_id = uid;
  vigente := found and est.dia_logros >= hoy;
  return jsonb_build_object(
    'rondas', coalesce(est.rondas, 0), 'victorias', coalesce(est.victorias, 0), 'racha', coalesce(est.racha, 0), 'mejor_racha', coalesce(est.mejor_racha, 0),
    'reinicia', extract(epoch from ((hoy + 1)::timestamp at time zone 'utc'))::bigint,
    'desafios', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre, 'nivel', d.nivel, 'texto', d.texto,
               'estado', case when l.reclamado is not null then 'reclamado' when l.completado is not null then 'completado' else 'pendiente' end) order by d.orden)
        from veintiuna_logros_def d
        left join veintiuna_logros l on l.logro = d.id and l.user_id = uid and vigente), '[]'::jsonb));
end;
$$;

-- /carrera: la próxima carrera con sus entrantes por cuota (las cuotas de ganador y de podio ya las enseña la web a cualquiera con sesión).
create or replace function public.discord_i_carrera(p_discord_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := discord_i_usuario(p_discord_id);
  r record;
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  select n, hora, cierre, publico into r from hipodromo_programa where hora > now() order by hora limit 1;
  if not found then return jsonb_build_object('hay', false); end if;
  return jsonb_build_object(
    'hay', true, 'n', r.n, 'hora', extract(epoch from r.hora)::bigint, 'cierre', extract(epoch from r.cierre)::bigint,
    'suspendida', coalesce((r.publico ->> 'suspendida')::boolean, false),
    'nombre', r.publico ->> 'nombre', 'grado', r.publico ->> 'grado', 'pista', r.publico ->> 'pista', 'dist', r.publico -> 'dist', 'bolsa', r.publico -> 'bolsa',
    'entrantes', coalesce((
      select jsonb_agg(jsonb_build_object('puerta', e ->> 'puerta', 'nombre', e ->> 'nombre', 'gan', e -> 'gan', 'pod', e -> 'pod',
                                          'dueno', e -> 'dueno' ->> 'nombre') order by (e ->> 'gan')::numeric)
        from (select e from jsonb_array_elements(coalesce(r.publico -> 'entrantes', '[]'::jsonb)) e
               where (e ->> 'gan') ~ '^[0-9.]+$' order by (e ->> 'gan')::numeric limit 3) q), '[]'::jsonb));
end;
$$;

-- /saldo: los tokens de juego de esa cuenta.
create or replace function public.discord_i_saldo(p_discord_id text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare uid uuid := discord_i_usuario(p_discord_id);
begin
  if uid is null then raise exception 'Primero vincula tu cuenta: genera un código en la web y usa /vincular.'; end if;
  return coalesce((select saldo from hipodromo_billeteras where usuario = uid), 0);
end;
$$;

-- === Anuncios (cola de docs/discord-avisos.sql) =================================================================

-- ¿Merece un anuncio en un canal este suceso de la crónica? Solo lo fuerte: cartas legendarias o limitadas, copas, apuestas de 1000 tokens o más, rachas
-- récord ya terminadas, La Última Vela, récords y la primera cría de una especie. Los intercambios, los desafíos de oro, las rachas vivas y las
-- noticias del Admin NO se anuncian solos (las noticias, con discord_admin_anunciar). Para cambiar lo que se anuncia, se cambia esta función.
create or replace function public.discord_i_cronica_fuerte(s cronica_sucesos)
returns boolean
language sql
immutable
as $$
  select case s.tipo
    when 'carta_ganada' then coalesce((s.datos ->> 'resumen')::boolean, false) = false and (s.datos ->> 'rareza') in ('legendaria', 'limitada')
    when 'copa_hipodromo' then true
    when 'apuesta_hipodromo' then coalesce((s.datos ->> 'pago')::numeric, 0) >= 1000
    when 'apuesta_veintiuna' then coalesce((s.datos ->> 'pago')::numeric, 0) >= 1000
    when 'racha_veintiuna' then coalesce((s.datos ->> 'activa')::boolean, true) = false and coalesce((s.datos ->> 'record')::boolean, false)
    when 'ultima_vela' then true
    when 'record_hooey' then true
    when 'record_ritmo' then true
    when 'record_parranda' then true
    when 'record_minijuego' then true
    when 'cria_nacida' then coalesce((s.datos ->> 'primera')::boolean, false)
    else false
  end
$$;

-- Qué canal le toca a un suceso: el de su Side, o el general si lo ven los dos Sides.
create or replace function public.discord_i_cronica_evento(p_side text)
returns text
language sql
immutable
as $$ select case p_side when 'A' then 'cronica_a' when 'B' then 'cronica_b' else 'cronica_general' end $$;

-- Pone en la cola el contenido de un suceso (sin nombres en los tipos anónimos). Una sola vez por suceso (restricción única de la cola).
create or replace function public.discord_i_encolar_suceso(s cronica_sucesos, p_canal text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  anon boolean := coalesce((select (config ->> 'anonimo')::boolean from cronica_tipos where tipo = s.tipo), false);
  filas int;
begin
  insert into discord_cola (origen, clave, canal_id, contenido, caduca)
  values ('cronica', 'cronica:' || s.id, p_canal,
          jsonb_build_object('id', s.id, 'tipo', s.tipo, 'datos', s.datos, 'enlace', s.enlace,
                             'user', case when anon or s.user_id is null then null else coalesce((select username from perfiles where user_id = s.user_id), 'Alguien') end),
          now() + interval '2 hours')
  on conflict (origen, clave) do nothing;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

-- Apunta los sucesos fuertes de los últimos 30 minutos (no se anuncia lo antiguo al encender un canal) y el recordatorio de Veintiuna.
-- p_ahora solo sirve para las pruebas (simular otra hora); el servidor la llama sin argumentos.
create or replace function public.discord_i_encolar_cronica(p_ahora timestamptz default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  s cronica_sucesos;
  canal text;
  total int := 0;
  filas int;
  ahora timestamptz := coalesce(p_ahora, now());
  hoy date := (ahora at time zone 'utc')::date;
  salida timestamptz;
begin
  for s in
    select * from cronica_sucesos
     where not oculto and visible_desde <= ahora and actualizado > ahora - interval '30 minutes' and actualizado <= ahora
     order by id
  loop
    if not discord_i_cronica_fuerte(s) then continue; end if;
    select canal_id into canal from discord_canales where evento = discord_i_cronica_evento(s.side) and activo;
    if canal is null then continue; end if;
    total := total + discord_i_encolar_suceso(s, canal);
  end loop;

  -- Los desafíos de Las Veintiuna Velas se reinician a las 00:00 UTC: un recordatorio a las 23:50, una vez al día.
  select canal_id into canal from discord_canales where evento = 'veintiuna' and activo;
  salida := (hoy + 1)::timestamp at time zone 'utc';
  if canal is not null and ahora >= salida - interval '10 minutes' and ahora < salida then
    insert into discord_cola (origen, clave, canal_id, contenido, caduca)
    values ('recordatorio', 'veintiuna:reinicio:' || hoy, canal, jsonb_build_object('tipo', 'veintiuna_reinicio', 'hora', extract(epoch from salida)::bigint), salida)
    on conflict (origen, clave) do nothing;
    get diagnostics filas = row_count;
    total := total + filas;
  end if;
  return total;
end;
$$;

-- El Admin manda a un canal una noticia (u otro suceso) concreta de la crónica, aunque no sea de las que se anuncian solas. Es lo que usaría una casilla
-- «publicar también en Discord» en la pestaña Crónica del panel de Admin.
create or replace function public.discord_admin_anunciar(p_suceso bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  s cronica_sucesos;
  canal text;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into s from cronica_sucesos where id = p_suceso and not oculto;
  if not found then raise exception 'Ese suceso no existe o está oculto.'; end if;
  select canal_id into canal from discord_canales where evento = discord_i_cronica_evento(s.side) and activo;
  if canal is null then raise exception 'No hay un canal de Discord configurado para %.', discord_i_cronica_evento(s.side); end if;
  if discord_i_encolar_suceso(s, canal) = 0 then return 'Ya estaba anunciado.'; end if;
  return 'En la cola: sale en el próximo minuto.';
end;
$$;

-- === Permisos ===================================================================================================
revoke all on function
  public.discord_i_cronica(text, int), public.discord_i_veintiuna(text), public.discord_i_carrera(text), public.discord_i_saldo(text),
  public.discord_i_cronica_fuerte(cronica_sucesos), public.discord_i_cronica_evento(text), public.discord_i_encolar_suceso(cronica_sucesos, text),
  public.discord_i_encolar_cronica(timestamptz), public.discord_admin_anunciar(bigint)
  from public, anon, authenticated;
grant execute on function
  public.discord_i_cronica(text, int), public.discord_i_veintiuna(text), public.discord_i_carrera(text), public.discord_i_saldo(text),
  public.discord_i_cronica_fuerte(cronica_sucesos), public.discord_i_cronica_evento(text), public.discord_i_encolar_suceso(cronica_sucesos, text),
  public.discord_i_encolar_cronica(timestamptz)
  to service_role;
grant execute on function public.discord_admin_anunciar(bigint) to authenticated;   -- comprueba fichas_es_admin() dentro
