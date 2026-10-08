-- ROL DE SOLO LECTURA PARA CLAUDE
-- Crea el rol claude_lectura: solo puede LEER las tablas de la lista de abajo y nada más. No puede escribir,
-- ni crear nada, ni tiene contraseña ni se puede conectar a la base de datos directamente: solo existe para
-- la API (PostgREST) cuando alguien llega con un token firmado para ese rol (tools/firmar-jwt-lectura.js).
-- Se ejecuta una vez en el editor SQL de Supabase y se puede repetir: deja el rol exactamente como dice la lista.
--
-- Qué ve:
--   NIVEL 1 (activo): el contenido del juego y su configuración: cartas y su catálogo, mapas y patrones de Zarabanda
--     y de Parranda, la rocola, los fanarts.
--   NIVEL 2 (comentado): partidas, puntajes y estadísticas de los jugadores, y el estado secreto del hipódromo.
--     Quita los dos guiones de la línea de cada tabla que quieras abrir y vuelve a ejecutar el script.
--   NUNCA: peticiones, perfiles, fichas de personajes, el Bufón, atajos, colecciones y mazos de cada jugador, ni
--     los esquemas auth y storage. No están en ninguna lista y no hay que añadirlos.
--
-- Funciones (rpc): el rol puede llamar a las mismas funciones que cualquier visitante sin cuenta (las que tienen
-- permiso para todo el mundo). Sin sesión, auth.uid() es nulo y las que piden una cuenta fallan. No se le da más.
--
-- Para quitarlo del todo, al final del archivo hay un bloque comentado.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'claude_lectura') then
    create role claude_lectura nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
  end if;
end $$;

-- PostgREST entra como "authenticator" y cambia de rol según el token: tiene que poder cambiar a este
grant claude_lectura to authenticator;

-- Consultas cortas y de solo lectura por defecto
alter role claude_lectura set statement_timeout = '8s';
alter role claude_lectura set default_transaction_read_only = on;
alter role claude_lectura set search_path = public;

-- Empezar de cero en cada ejecución, para que el rol quede exactamente como dice la lista
revoke all on all tables in schema public from claude_lectura;
grant usage on schema public to claude_lectura;

do $$
declare
  t text;
  lista text[] := array[
    -- NIVEL 1: contenido del juego y configuración
    'cartas', 'cartas_catalogo', 'cartas_definiciones', 'cartas_numeradas', 'cartas_editores',
    'ritmo_mapas', 'ritmo_patrones', 'ritmo_djs',
    'parranda_mapas', 'parranda_patrones',
    'rocola', 'rocola_canciones', 'rocola_fondos', 'rocola_nombres', 'rocola_ocultas',
    'fanarts', 'fanarts_side', 'fanarts_ocultos', 'fanarts_subidos'
    -- NIVEL 2 (jugadores): quita el guion inicial de las líneas que quieras abrir
    -- , 'ajedrez_partidas', 'arqueria_partidas'
    -- , 'hooey_puntajes', 'muerte_subita_intentos', 'mj_estadisticas'
    -- , 'ritmo_fallos', 'parranda_fallos', 'ritmo_mapas_historial', 'parranda_mapas_historial'
    -- , 'cartas_partidas', 'cartas_registro'
    -- NIVEL 2 (hipódromo, cuando exista): el estado secreto del mundo, con genes y forma
    -- , 'hipodromo_estado'
  ];
begin
  foreach t in array lista loop
    if to_regclass('public.' || quote_ident(t)) is null then
      raise notice 'No existe public.%: se salta', t;
      continue;
    end if;
    execute format('grant select on public.%I to claude_lectura', t);
    -- con la seguridad por filas activa, el rol necesita su propia política para ver filas
    if (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || quote_ident(t))) then
      execute format('drop policy if exists %I on public.%I', 'claude_lectura lee', t);
      execute format('create policy %I on public.%I for select to claude_lectura using (true)', 'claude_lectura lee', t);
    end if;
    raise notice 'Lectura abierta: public.%', t;
  end loop;
end $$;

-- Comprobación rápida (como el rol): select * from cartas limit 1;  y esto debe fallar: select * from peticiones;

-- ---------------------------------------------------------------------------------------------------------
-- PARA QUITARLO DEL TODO (quita los guiones y ejecuta solo este bloque):
-- do $$
-- declare t text;
-- begin
--   for t in select tablename from pg_policies where policyname = 'claude_lectura lee' and schemaname = 'public' loop
--     execute format('drop policy %I on public.%I', 'claude_lectura lee', t);
--   end loop;
-- end $$;
-- revoke claude_lectura from authenticator;
-- drop owned by claude_lectura;
-- drop role claude_lectura;
