-- Avisos automáticos en Discord (bot «The great mice»): cola de salida y aviso de que una carrera del Hipódromo sale en 2 minutos.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/discord.sql. Se puede repetir. No toca ninguna tabla ni función existente.
--
-- Cómo funciona (ver docs/discord.md):
--   * Cada minuto, pg_cron llama a la Edge Function «discord-avisos» (la tarea se programa al final de este archivo, con tu clave).
--   * La función pide a la base de datos que mire la carrera programada (hipodromo_programa, la misma tabla que usa el aviso de la taberna) y apunte en
--     la cola un aviso por cada carrera que sale en los próximos 2 minutos. Una sola vez por carrera: la cola tiene una restricción única.
--   * Luego toma de la cola lo pendiente y lo publica en el canal con el token del bot. Si Discord falla, se reintenta (hasta 5 veces); si tarda demasiado
--     y la carrera ya salió, el aviso caduca y no se manda. Un fallo de Discord solo afecta a esta cola: no toca las carreras, las apuestas ni los premios.
--   * El canal se elige en la tabla discord_canales (abajo se explica cómo). Sin canal configurado, no se avisa de nada.

-- === Tablas ======================================================================================================

-- Dónde se publica cada tipo de aviso. Una fila por tipo ('carrera' por ahora); activo = false lo pausa sin borrar el canal.
create table if not exists public.discord_canales (
  evento text primary key check (evento ~ '^[a-z_]{3,30}$'),
  canal_id text not null check (canal_id ~ '^[0-9]{15,25}$'),
  activo boolean not null default true,
  actualizado timestamptz not null default now()
);

-- La cola de salida. Una fila por aviso. (origen, clave) es único: es lo que impide avisar dos veces de lo mismo.
create table if not exists public.discord_cola (
  id bigserial primary key,
  origen text not null,                     -- de qué viene: 'carrera'
  clave text not null,                      -- qué cosa concreta: 'carrera:612'
  canal_id text not null,
  contenido jsonb not null,                 -- solo datos públicos; el mensaje se arma en la función
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'caducado', 'fallido')),
  creado timestamptz not null default now(),
  caduca timestamptz not null,              -- pasada esta hora ya no tiene sentido mandarlo
  intentos int not null default 0,
  proximo_intento timestamptz not null default now(),
  reservado_hasta timestamptz,              -- mientras una llamada lo está enviando, nadie más lo toma
  enviado timestamptz,
  ultimo_error text check (ultimo_error is null or length(ultimo_error) <= 200),
  unique (origen, clave)
);
create index if not exists discord_cola_pendientes on public.discord_cola (estado, proximo_intento);

alter table public.discord_canales enable row level security;
alter table public.discord_cola enable row level security;
revoke all on public.discord_canales, public.discord_cola from public, anon, authenticated;
revoke all on sequence public.discord_cola_id_seq from public, anon, authenticated;
-- Sin políticas: nadie con sesión lee ni escribe estas tablas. Solo el servidor, a través de las funciones de abajo.

-- === Funciones del servidor (solo service_role) ==================================================================

-- Apunta en la cola un aviso por cada carrera que sale en los próximos 2 minutos. Idempotente.
-- Mira cualquier carrera de la tabla (no solo la última), salta las suspendidas y las que ya salieron.
create or replace function public.discord_i_encolar_carreras()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  canal text;
  r record;
  nuevas int := 0;
  filas int;
begin
  select canal_id into canal from discord_canales where evento = 'carrera' and activo;
  if canal is null then return 0; end if;
  for r in
    select n, hora, cierre, publico from hipodromo_programa
    where hora > now() and hora <= now() + interval '2 minutes'
      and coalesce((publico ->> 'suspendida')::boolean, false) = false
  loop
    insert into discord_cola (origen, clave, canal_id, contenido, caduca)
    values ('carrera', 'carrera:' || r.n, canal,
            jsonb_build_object('n', r.n, 'nombre', r.publico ->> 'nombre', 'grado', r.publico ->> 'grado', 'pista', r.publico ->> 'pista',
                               'dist', r.publico -> 'dist', 'bolsa', r.publico -> 'bolsa',
                               'hora', extract(epoch from r.hora)::bigint, 'cierre', extract(epoch from r.cierre)::bigint),
            r.hora)
    on conflict (origen, clave) do nothing;
    get diagnostics filas = row_count;
    nuevas := nuevas + filas;
  end loop;
  return nuevas;
end;
$$;

-- Toma hasta p_max avisos pendientes y los reserva 2 minutos para quien los va a enviar (dos llamadas a la vez nunca toman el mismo).
-- Los que ya caducaron se marcan como caducados y no se devuelven.
create or replace function public.discord_i_tomar_cola(p_max int default 10)
returns table (id bigint, origen text, clave text, canal_id text, contenido jsonb, intentos int)
language plpgsql
security definer
set search_path = public
as $$
begin
  update discord_cola c set estado = 'caducado', ultimo_error = 'caducado antes de enviarse'
  where c.estado = 'pendiente' and c.caduca <= now();
  return query
  update discord_cola c set reservado_hasta = now() + interval '2 minutes', intentos = c.intentos + 1
  where c.id in (
    select q.id from discord_cola q
    where q.estado = 'pendiente' and q.proximo_intento <= now() and (q.reservado_hasta is null or q.reservado_hasta < now())
    order by q.id limit greatest(1, least(coalesce(p_max, 10), 25))
    for update skip locked)
  returning c.id, c.origen, c.clave, c.canal_id, c.contenido, c.intentos;
end;
$$;

-- Anota cómo salió un envío. Si falló: se reintenta tras p_espera_seg segundos; al 5.º intento fallido se da por perdido.
-- p_espera_seg = 0 significa «no insistas»: se da por perdido ya (por ejemplo, alguien que no acepta mensajes privados).
create or replace function public.discord_i_marcar_cola(p_id bigint, p_ok boolean, p_error text default null, p_espera_seg int default 60)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare c discord_cola;
begin
  select * into c from discord_cola where discord_cola.id = p_id for update;
  if not found or c.estado <> 'pendiente' then return; end if;
  if p_ok then
    update discord_cola set estado = 'enviado', enviado = now(), reservado_hasta = null, ultimo_error = null where discord_cola.id = p_id;
  elsif c.intentos >= 5 or p_espera_seg = 0 then
    update discord_cola set estado = 'fallido', reservado_hasta = null, ultimo_error = left(coalesce(p_error, 'sin detalle'), 200) where discord_cola.id = p_id;
  else
    update discord_cola set reservado_hasta = null, proximo_intento = now() + make_interval(secs => greatest(5, least(coalesce(p_espera_seg, 60), 900))),
                            ultimo_error = left(coalesce(p_error, 'sin detalle'), 200) where discord_cola.id = p_id;
  end if;
end;
$$;

-- Limpieza: borra lo ya resuelto de hace más de una semana (lo llama la propia función de avisos de vez en cuando).
create or replace function public.discord_i_limpiar_cola()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare filas int;
begin
  -- Lo resuelto de hace más de una semana (las novedades se guardan 60 días para no volver a anunciar lo mismo)
  delete from discord_cola where estado <> 'pendiente'
    and creado < now() - case when origen in ('novedad', 'entradas') then interval '60 days' else interval '7 days' end;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

revoke all on function public.discord_i_encolar_carreras(), public.discord_i_tomar_cola(int), public.discord_i_marcar_cola(bigint, boolean, text, int), public.discord_i_limpiar_cola()
  from public, anon, authenticated;
grant execute on function public.discord_i_encolar_carreras(), public.discord_i_tomar_cola(int), public.discord_i_marcar_cola(bigint, boolean, text, int), public.discord_i_limpiar_cola()
  to service_role;

-- === Lo que tienes que hacer después de correr esto =============================================================
--
-- 1) Elegir el canal. En Discord (con el Modo desarrollador activado), clic derecho en el canal > Copiar ID del canal. Luego aquí:
--      insert into discord_canales (evento, canal_id) values ('carrera', '<ID DEL CANAL>')
--      on conflict (evento) do update set canal_id = excluded.canal_id, activo = true, actualizado = now();
--    Para pausar los avisos sin perder el canal:   update discord_canales set activo = false where evento = 'carrera';
--
-- 2) Desplegar la Edge Function «discord-avisos» (docs/discord-avisos/index.ts) y poner sus secretos: DISCORD_BOT_TOKEN y DISCORD_AVISOS_CLAVE
--    (una clave larga al azar, la inventas tú). Sin comprobar JWT, porque la llama el cron con su propia clave.
--
-- 3) Programar la tarea de cada minuto, poniendo la misma clave (extensiones pg_cron y pg_net, que ya están activas por el Hipódromo):
--      select cron.schedule('discord-avisos', '* * * * *', $$
--        select net.http_post(
--          url := 'https://ilicqboqelrjuvtslaxd.supabase.co/functions/v1/discord-avisos',
--          headers := jsonb_build_object('Content-Type', 'application/json', 'x-discord-clave', '<LA MISMA CLAVE>'),
--          body := '{}'::jsonb,
--          timeout_milliseconds := 20000) $$);
--    Para quitarla:   select cron.unschedule('discord-avisos');
--
-- 4) El bot necesita permiso en ese canal para «Ver canal», «Enviar mensajes» e «Insertar enlaces».
