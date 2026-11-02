/* =============================================================================
   PITTER-PATTER (app/src/pitter): guardado en el servidor y recompensas.
   Se instala DESPUÉS de las migraciones de economía y de docs/pozo-dragon.sql (usa cartas_juegos, cartas_ajuste, hipodromo_billeteras). Se puede volver a correr.

   Qué guarda el servidor y por qué:
   * pitter_progreso: lo que el jugador va coleccionando y decorando (personajes, equipos, habitaciones, récords, ajustes), como un JSON de tamaño acotado. Es cosmético:
     nada de esto da ventajas en las partidas de rol y el servidor no lo interpreta.
   * pitter_victorias: la PRIMERA vez que se supera cada jefe. Solo ahí hay premio: tokens de juego (los del Hipódromo, sin moneda nueva) y, con tres estrellas,
     una carta por el cierre oficial de recompensas (cartas_juegos 'pitter'). Repetir un jefe no paga.
   * Lo honesto: el puzzle corre en el navegador, así que el servidor no puede comprobar la partida. Lo que SÍ acota el daño es que cada jefe paga una sola vez,
     hay que superarlos en orden, los resultados deben ser plausibles, los tokens tienen un tope diario (pitter_tokens_dia) y las cartas pasan por los topes de siempre.
     Lo máximo que se puede sacar haciendo trampa es la suma de los premios de los jefes (una vez) y las cartas que permitan los topes diarios.

   INTERRUPTOR: mientras el ajuste 'pitter_publico' sea false, cada función pública solo responde al admin (fichas_es_admin()).
   Para abrirlo: update cartas_economia_ajustes set valor = 'true' where clave = 'pitter_publico';  (y quitar la comprobación de admin de app/src/pitter/main.ts)
   Las cartas de recompensa nacen apagadas (cartas_juegos.activo = false), igual que el resto de juegos: las enciende el admin.
============================================================================= */

/* ================================================================== 0) AJUSTES */
insert into cartas_economia_ajustes (clave, valor) values
  ('pitter_publico', 'false'),       -- false: solo el admin lo ve y lo juega
  ('pitter_tokens_dia', '150'),      -- tokens de juego que se pueden cobrar al día por primeras victorias
  ('pitter_guardado_max', '60000')   -- bytes máximos del JSON de progreso de un jugador
on conflict (clave) do nothing;

/* ================================================================== 1) TABLAS */
-- Los jefes, con lo que el servidor necesita para dar por bueno un resultado (la fuente es app/src/pitter/datos/campana.ts: mantenlos iguales)
create table if not exists pitter_jefes (
  id text primary key,
  orden int not null unique check (orden >= 1),
  nombre text not null,
  vida int not null check (vida > 0),
  tiempo int not null check (tiempo > 0),
  premio int not null default 0 check (premio >= 0)     -- tokens de juego de la primera victoria
);
insert into pitter_jefes (id, orden, nombre, vida, tiempo, premio) values
  ('kobold', 1, 'Kobold', 900, 60, 20),
  ('dragarto', 2, 'Dragarto', 1800, 60, 30),
  ('protodraco', 3, 'Protodraco', 3000, 60, 40),
  ('basilisco', 4, 'Basilisco', 4200, 60, 50),
  ('hidra', 5, 'Hidra', 5600, 60, 60),
  ('behemoth', 6, 'Behemoth', 7000, 60, 70),
  ('kraken', 7, 'Kraken', 8800, 60, 80),
  ('dragon-de-magma', 8, 'Dragón de Magma', 11000, 60, 100)
on conflict (id) do update set orden = excluded.orden, nombre = excluded.nombre, vida = excluded.vida, tiempo = excluded.tiempo, premio = excluded.premio;

create table if not exists pitter_progreso (
  user_id uuid primary key references auth.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

create table if not exists pitter_victorias (
  user_id uuid not null references auth.users(id) on delete cascade,
  jefe text not null references pitter_jefes(id),
  estrellas int not null check (estrellas between 1 and 3),
  puntos int not null default 0,
  mejor_segundos int not null default 0,
  combo int not null default 0,
  pagado int not null default 0,          -- tokens ya cobrados de esta primera victoria
  carta text,                             -- la carta que dio (una por jefe, con tres estrellas)
  carta_intentada boolean not null default false,
  primera timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  primary key (user_id, jefe)
);

create table if not exists pitter_pagos (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null,
  tokens int not null default 0,
  primary key (user_id, dia)
);

alter table pitter_jefes enable row level security;
alter table pitter_progreso enable row level security;
alter table pitter_victorias enable row level security;
alter table pitter_pagos enable row level security;
drop policy if exists "pitter_jefes_lectura" on pitter_jefes;
create policy "pitter_jefes_lectura" on pitter_jefes for select using (true);
drop policy if exists "pitter_progreso_admin" on pitter_progreso;
create policy "pitter_progreso_admin" on pitter_progreso for select using (fichas_es_admin());
drop policy if exists "pitter_victorias_propias" on pitter_victorias;
create policy "pitter_victorias_propias" on pitter_victorias for select using (user_id = auth.uid() or fichas_es_admin());
-- Nadie escribe directamente: solo las funciones de abajo
revoke all on pitter_jefes, pitter_progreso, pitter_victorias, pitter_pagos from anon, authenticated;
grant select on pitter_jefes to anon, authenticated;
grant select on pitter_victorias to authenticated;

/* ================================================================== 2) EL JUEGO EN LA ECONOMÍA DE CARTAS */
-- Una fila en cartas_juegos y el cierre oficial de la recompensa, igual que Las Veintiuna Velas. Un jefe de la primera tercera parte vale 1 (bueno),
-- uno de la segunda 3 (excelente) y los últimos 4 (extraordinario). Como mucho una carta al día desde aquí (tope_dia 1) y, si toca, siempre la que toca.
insert into cartas_juegos (juego, nombre, activo, umbrales, tope_dia, min_segundos, sellos_por_carta, grupo, pesos, prob, grupos, valores) values
  ('pitter', 'Pitter-Patter', false, '{"participacion": 0, "bueno": 1, "excelente": 3, "extraordinario": 4}', 1, 0, 5, '{}',
   '{"bueno": {"comun": 80, "infrecuente": 20}, "excelente": {"infrecuente": 60, "rara": 40}, "extraordinario": {"rara": 100}}',
   '{"bueno": 1, "excelente": 1, "extraordinario": 1}', '{}',
   '{"rivales": {"inicial": {"gana": 1, "tablas": 0, "pierde": 0}, "medio": {"gana": 3, "tablas": 0, "pierde": 0}, "final": {"gana": 4, "tablas": 0, "pierde": 0}, "_otros": {"gana": 1, "tablas": 0, "pierde": 0}}}')
on conflict (juego) do nothing;

-- El editor de Juegos y recetas guarda «valores»; el validador tiene que conocer este juego (mismo formato que Veintiuna: rivales con gana/tablas/pierde).
do $$
declare
  d text := pg_get_functiondef('public.cartas_i_validar_valores(text,jsonb)'::regprocedure);
  a1 text := $a$if p_juego in ('ajedrez', 'duelo', 'arqueria', 'veintiuna'$a$;
begin
  if position('''pitter''' in d) > 0 then return; end if;                           -- ya parcheada
  if position(a1 in d) = 0 then
    raise exception 'cartas_i_validar_valores ha cambiado: añade el juego pitter a mano a sus listas de juegos con «rivales»';
  end if;
  d := replace(d, $a$'ajedrez', 'duelo', 'arqueria', 'veintiuna'$a$, $b$'ajedrez', 'duelo', 'arqueria', 'veintiuna', 'pitter'$b$);
  execute d;
end $$;

/* ================================================================== 3) FUNCIONES */
create or replace function pitter_i_error(p_msg text, p_codigo text)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_msg using hint = p_codigo;
end;
$$;

create or replace function pitter_i_acceso()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform pitter_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  if not (cartas_ajuste('pitter_publico', 'false'))::text::boolean and not coalesce(fichas_es_admin(), false) then
    perform pitter_i_error('Pitter-Patter todavía no está abierto.', 'oculto');
  end if;
end;
$$;

create or replace function pitter_i_abonar(p_uid uuid, p_monto numeric, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saldo numeric;
begin
  if p_monto <= 0 then return; end if;
  insert into hipodromo_billeteras (usuario) values (p_uid) on conflict (usuario) do nothing;
  update hipodromo_billeteras set saldo = saldo + p_monto where usuario = p_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo) values (p_uid, null, left(p_concepto, 200), p_monto, v_saldo);
end;
$$;

-- Lo que hay guardado y las victorias, para pintar el juego al entrar
create or replace function pitter_cargar()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_datos jsonb;
  v_tope int := (cartas_ajuste('pitter_tokens_dia', '150'))::text::int;
  v_hoy int;
begin
  perform pitter_i_acceso();
  select datos into v_datos from pitter_progreso where user_id = uid;
  select coalesce(tokens, 0) into v_hoy from pitter_pagos where user_id = uid and dia = (now() at time zone 'utc')::date;
  return jsonb_build_object(
    'datos', coalesce(v_datos, 'null'::jsonb),
    'victorias', coalesce((select jsonb_agg(jsonb_build_object('jefe', jefe, 'estrellas', estrellas, 'puntos', puntos, 'segundos', mejor_segundos, 'combo', combo, 'pagado', pagado, 'carta', carta) order by primera)
                           from pitter_victorias where user_id = uid), '[]'::jsonb),
    'tokens_hoy', coalesce(v_hoy, 0),
    'tope_dia', v_tope
  );
end;
$$;

-- Guarda el progreso. El servidor no lo interpreta: solo comprueba que es un objeto y que no pasa del tamaño máximo.
create or replace function pitter_guardar(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_max int := (cartas_ajuste('pitter_guardado_max', '60000'))::text::int;
begin
  perform pitter_i_acceso();
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then perform pitter_i_error('Los datos de guardado no son válidos.', 'datos_invalidos'); end if;
  if octet_length(p_datos::text) > v_max then perform pitter_i_error('El guardado es demasiado grande.', 'guardado_grande'); end if;
  insert into pitter_progreso (user_id, datos, actualizado) values (uid, p_datos, now())
  on conflict (user_id) do update set datos = excluded.datos, actualizado = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- Primera victoria de un jefe: premio en tokens (con tope diario) y, con tres estrellas, una carta por el cierre oficial.
-- Se puede llamar otra vez con el mismo jefe: no vuelve a pagar lo ya pagado, pero cobra lo que quedó pendiente por el tope del día y mejora el récord.
create or replace function pitter_reclamar(p_jefe text, p_estrellas int, p_puntos int, p_segundos int, p_combo int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  j pitter_jefes%rowtype;
  v pitter_victorias%rowtype;
  cfg cartas_juegos%rowtype;
  v_tope int := (cartas_ajuste('pitter_tokens_dia', '150'))::text::int;
  v_dia date := (now() at time zone 'utc')::date;
  v_hoy int;
  v_debe int;
  v_pago int := 0;
  v_primera boolean := false;
  v_token uuid;
  v_clave text;
  hoy_total int;
  hoy_juego int;
  tope_total int := (cartas_ajuste('tope_dia_total', '6'))::text::int;
  r jsonb := jsonb_build_object('resultado', 'nada');
begin
  perform pitter_i_acceso();
  perform cartas_i_candado_jugador(uid);
  perform pg_advisory_xact_lock(hashtextextended('pitter_' || uid::text, 0));
  select * into j from pitter_jefes where id = p_jefe;
  if not found then perform pitter_i_error('Ese jefe no existe.', 'no_encontrado'); end if;
  -- Un resultado plausible: tres estrellas como mucho, tiempo dentro del reloj del jefe, puntos que no pasen de cuatro veces su vida
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 3 then perform pitter_i_error('Las estrellas no son válidas.', 'resultado_invalido'); end if;
  if p_segundos is null or p_segundos < 6 or p_segundos > j.tiempo + 20 then perform pitter_i_error('El tiempo no es plausible.', 'resultado_invalido'); end if;
  if p_puntos is null or p_puntos < 0 or p_puntos > j.vida * 4 then perform pitter_i_error('Los puntos no son plausibles.', 'resultado_invalido'); end if;
  if p_combo is null or p_combo < 0 or p_combo > 400 then perform pitter_i_error('El combo no es plausible.', 'resultado_invalido'); end if;
  -- Hay que ir en orden: el jefe anterior tiene que estar superado
  if j.orden > 1 and not exists (select 1 from pitter_victorias w join pitter_jefes k on k.id = w.jefe where w.user_id = uid and k.orden = j.orden - 1) then
    perform pitter_i_error('Antes tienes que superar al jefe anterior.', 'orden');
  end if;

  select * into v from pitter_victorias where user_id = uid and jefe = p_jefe for update;
  if not found then
    insert into pitter_victorias (user_id, jefe, estrellas, puntos, mejor_segundos, combo) values (uid, p_jefe, p_estrellas, p_puntos, p_segundos, p_combo) returning * into v;
    v_primera := true;
  else
    update pitter_victorias set estrellas = greatest(estrellas, p_estrellas), puntos = greatest(puntos, p_puntos), mejor_segundos = least(nullif(mejor_segundos, 0), p_segundos),
      combo = greatest(combo, p_combo), actualizada = now() where user_id = uid and jefe = p_jefe returning * into v;
    if v.mejor_segundos is null then update pitter_victorias set mejor_segundos = p_segundos where user_id = uid and jefe = p_jefe returning * into v; end if;
  end if;

  -- Tokens: lo que falta por pagar de esta primera victoria, con el tope del día
  v_debe := j.premio - v.pagado;
  if v_debe > 0 then
    insert into pitter_pagos (user_id, dia) values (uid, v_dia) on conflict do nothing;
    select tokens into v_hoy from pitter_pagos where user_id = uid and dia = v_dia for update;
    v_pago := greatest(0, least(v_debe, v_tope - v_hoy));
    if v_pago > 0 then
      perform pitter_i_abonar(uid, v_pago, 'Pitter-Patter: primera victoria contra ' || j.nombre);
      update pitter_pagos set tokens = tokens + v_pago where user_id = uid and dia = v_dia;
      update pitter_victorias set pagado = pagado + v_pago where user_id = uid and jefe = p_jefe;
      v_hoy := v_hoy + v_pago;
    end if;
  else
    select coalesce(tokens, 0) into v_hoy from pitter_pagos where user_id = uid and dia = v_dia;
  end if;

  -- Carta: una por jefe, con tres estrellas, por el cierre oficial (con sus topes). Si no hay carta, no pasa nada y se puede intentar otra vez.
  if v.estrellas >= 3 and v.carta is null and not v.carta_intentada then
    select * into cfg from cartas_juegos where juego = 'pitter';
    if found and cfg.activo then
      select count(*) into hoy_total from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and creado >= date_trunc('day', now());
      select count(*) into hoy_juego from cartas_recompensas_registro where user_id = uid and resultado = 'carta' and juego = 'pitter' and creado >= date_trunc('day', now());
      if hoy_total < tope_total and hoy_juego < cfg.tope_dia then
        v_clave := case when j.orden <= 3 then 'inicial' when j.orden <= 6 then 'medio' else 'final' end;
        insert into cartas_progreso (user_id, juego, mejor) values (uid, 'pitter', 1000) on conflict (user_id, juego) do update set mejor = 1000;
        begin
          insert into cartas_partidas_juego (user_id, juego, clave, inicio) values (uid, 'pitter', v_clave, now() - interval '1 hour') returning token into v_token;
          r := cartas_i_juego_terminar_nucleo(v_token, 'gana', 0);
          if r ->> 'resultado' is distinct from 'carta' then
            raise exception 'sin carta' using errcode = 'PT001';            -- deshace lo que hizo el cierre
          end if;
          update pitter_victorias set carta = r ->> 'carta', carta_intentada = true where user_id = uid and jefe = p_jefe;
        exception when sqlstate 'PT001' then
          r := jsonb_build_object('resultado', 'nada', 'motivo', coalesce(nullif(r ->> 'motivo', ''), 'agotado'));
        end;
      else
        r := jsonb_build_object('resultado', 'nada', 'motivo', 'tope-diario');
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'primera', v_primera, 'tokens', v_pago, 'tokens_hoy', coalesce(v_hoy, 0), 'tope_dia', v_tope, 'pendiente', greatest(0, j.premio - (select pagado from pitter_victorias where user_id = uid and jefe = p_jefe)),
    'carta', r -> 'carta', 'numero', r -> 'numero', 'carta_motivo', r ->> 'motivo', 'estrellas', v.estrellas
  );
end;
$$;

/* ================================================================== 4) PERMISOS */
revoke all on function pitter_i_error(text, text), pitter_i_acceso(), pitter_i_abonar(uuid, numeric, text) from public, anon, authenticated;
revoke all on function pitter_cargar(), pitter_guardar(jsonb), pitter_reclamar(text, int, int, int, int) from public, anon;
grant execute on function pitter_cargar(), pitter_guardar(jsonb), pitter_reclamar(text, int, int, int, int) to authenticated;
