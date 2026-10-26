-- CRÓNICA DEL MUNDO (disparadores): anotan los sucesos solos, en el momento en que el servidor termina lo que importa.
-- Cada disparador mira una tabla de resultados que YA existe y llama a cronica_i_anotar (docs/cronica-1_base.sql). Ninguno edita las funciones de los juegos, así que
-- volver a correr un SQL antiguo de un juego no los quita, y un fallo aquí nunca rompe el juego (cada uno atrapa sus errores).
-- Corre esto DESPUÉS de docs/cronica-1_base.sql. Se puede repetir. Un disparador solo se crea si su tabla existe: lo que aún no esté desplegado se salta solo
-- (corre este archivo otra vez cuando despliegues esa tabla).
--
--   Suceso                  Tabla observada             Momento
--   carta_ganada            cartas_registro             al entrar una carta a un jugador jugando, forjando o con sellos
--   carta_ganada            cartas_movimientos          al ganar una carta de otro jugador: el pozo de Veintiuna o una apuesta de cartas de Triunfos
--   intercambio             cartas_intercambios         cuando una oferta pasa a «aceptada»
--   cria_nacida             cartas_crias                cuando una cría pasa a «nacida» (al recogerla del corral)
--   apuesta_hipodromo       hipodromo_apuestas          cuando una apuesta pasa a «ganada»
--   apuesta_veintiuna       veintiuna_partidas          cuando una mano o mesa con apuesta termina y paga mucho
--   racha_veintiuna         veintiuna_estadisticas      cuando sube o se corta la racha de victorias
--   logro_oro_veintiuna     veintiuna_logros            al completar un desafío de oro
--   copa_hipodromo          hipodromo_carreras          al publicarse el resultado de una copa o un Gran Premio (se enseña cuando acaba la carrera)

/* ================================================================== CARTAS GANADAS */
-- La lógica común de «alguien ganó una carta»: rareza mínima, nombre, número de copia y tope diario (pasado el tope, las demás se juntan en una línea).
create or replace function public.cronica_i_carta(p_user uuid, p_carta text, p_origen text, p_clave text, p_enlace text, p_ejemplar uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_rareza text;
  v_nombre text;
  v_numero int;
  v_hoy int;
  v_extras int;
  v_max int;
  v_clave_resumen text := 'carta:resumen:' || p_user || ':' || to_char(now() at time zone 'utc', 'YYYYMMDD');
begin
  select * into t from cronica_tipos where tipo = 'carta_ganada';
  if not found or not t.activo then return; end if;
  select rareza into v_rareza from cartas_catalogo where id = p_carta;
  if cronica_i_rango(v_rareza) < cronica_i_rango(coalesce(t.config ->> 'min_rareza', 'rara')) then return; end if;
  v_nombre := coalesce((select data ->> 'nombre' from cartas_definiciones where id = p_carta), p_carta);
  if cronica_i_rango(v_rareza) >= 4 and coalesce((t.config ->> 'numero_copia')::boolean, false) then
    if p_ejemplar is not null then
      select numero into v_numero from cartas_ejemplares where id = p_ejemplar;
    else
      select e.numero into v_numero from cartas_movimientos m join cartas_ejemplares e on e.id = m.ejemplar
       where m.carta_id = p_carta and m.a = p_user order by m.id desc limit 1;
    end if;
  end if;
  v_max := coalesce((t.config ->> 'max_por_dia')::int, 3);
  select count(*) into v_hoy from cronica_sucesos
   where tipo = 'carta_ganada' and user_id = p_user and creado > now() - interval '24 hours' and not (datos ? 'resumen');
  if v_hoy < v_max then
    perform cronica_i_anotar('carta_ganada', p_user, null, null,
      jsonb_build_object('carta_id', p_carta, 'nombre', v_nombre, 'rareza', v_rareza, 'origen', p_origen, 'numero', v_numero), p_clave, p_enlace);
  else
    -- Pasado el tope del día, las demás se juntan en una sola línea: «ganó N cartas hoy»
    select coalesce((datos ->> 'extras')::int, 0) into v_extras from cronica_sucesos where clave = v_clave_resumen;
    v_extras := coalesce(v_extras, 0) + 1;
    perform cronica_i_anotar('carta_ganada', p_user, null, null, jsonb_build_object('resumen', true, 'extras', v_extras, 'n', v_max + v_extras), v_clave_resumen, 'cartas.html', true);
  end if;
end;
$$;

-- Carta ganada jugando, forjando o con sellos (la fila que deja cartas_i_emitir en cartas_registro)
create or replace function public.cronica_t_carta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text;
begin
  begin
    -- Solo lo que se gana jugando. Compras al Buhonero y regalos del Admin no cuentan, y las crías tienen su propio tipo (anónimo): si no, delatarían a quien las recogió.
    if new.origen is distinct from 'juego' or coalesce(new.detalle, '') = 'mercader' or coalesce(new.detalle, '') like 'cria:%' then return new; end if;
    v_origen := case when coalesce(new.detalle, '') like 'sellos:%' then 'sellos' when coalesce(new.detalle, '') like 'forja:%' then 'forja' else 'juego' end;
    perform cronica_i_carta(new.user_id, new.carta_id, v_origen, 'carta:' || new.id, case v_origen when 'forja' then 'forja.html' else 'cartas.html' end);
  exception when others then null;
  end;
  return new;
end;
$$;

-- Carta ganada a otro jugador: el pozo de cartas de Las Veintiuna Velas y las apuestas de cartas de Triunfos (los dos pasan por cartas_i_transferir)
create or replace function public.cronica_t_movimiento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen text;
begin
  begin
    if new.a is null or new.tipo <> 'transferencia' then return new; end if;
    if new.motivo like 'pozo ganado%' then v_origen := 'pozo';
    elsif new.motivo = 'apuesta ganada' then v_origen := 'apuesta';
    else return new;
    end if;
    perform cronica_i_carta(new.a, new.carta_id, v_origen, 'mov:' || new.id, case v_origen when 'pozo' then 'veintiuna.html' else 'cartas.html' end, new.ejemplar);
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== INTERCAMBIOS (anónimo) */
create or replace function public.cronica_t_trueque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_dio jsonb;
  v_recibio jsonb;
  v_max int;
  v_total int;
begin
  begin
    select * into t from cronica_tipos where tipo = 'intercambio';
    if not found or not t.activo then return new; end if;
    -- Lo que dio quien ofrecía (las copias ya cambiaron de dueño, pero siguen en cartas_ejemplares) y lo que pidió
    select coalesce(jsonb_agg(jsonb_build_object('carta_id', x.carta_id, 'nombre', x.nombre, 'n', x.n)), '[]'::jsonb) into v_dio
      from (select e.carta_id, coalesce(d.data ->> 'nombre', e.carta_id) as nombre, count(*) as n
              from cartas_ejemplares e left join cartas_definiciones d on d.id = e.carta_id
             where e.id = any (new.ofrece) group by 1, 2) x;
    select coalesce(jsonb_agg(jsonb_build_object('carta_id', y ->> 'carta', 'nombre', coalesce(d.data ->> 'nombre', y ->> 'carta'), 'n', (y ->> 'n')::int)), '[]'::jsonb) into v_recibio
      from jsonb_array_elements(coalesce(new.pide, '[]'::jsonb)) y left join cartas_definiciones d on d.id = y ->> 'carta';
    select coalesce(max(cronica_i_rango(c.rareza)), 0) into v_max from cartas_catalogo c
     where c.id in (select value ->> 'carta_id' from jsonb_array_elements(v_dio || v_recibio));
    select coalesce(sum((value ->> 'n')::int), 0) into v_total from jsonb_array_elements(v_dio || v_recibio);
    if v_max < cronica_i_rango(coalesce(t.config ->> 'min_rareza', 'rara')) and v_total < coalesce((t.config ->> 'min_cartas')::int, 3) then return new; end if;
    perform cronica_i_anotar('intercambio', new.de, new.aceptada_por, null, jsonb_build_object('dio', v_dio, 'recibio', v_recibio),
      'trueque:' || new.id, 'intercambios.html');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== CRÍAS (anónimo) */
create or replace function public.cronica_t_cria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_rareza text;
  v_primera boolean;
begin
  begin
    select * into t from cronica_tipos where tipo = 'cria_nacida';
    if not found or not t.activo then return new; end if;
    select rareza into v_rareza from cartas_catalogo where id = new.carta_id;
    v_primera := coalesce((t.config ->> 'primera_especie')::boolean, false)
                 and not exists (select 1 from cartas_crias c where c.carta_id = new.carta_id and c.estado = 'nacida' and c.id <> new.id);
    if cronica_i_rango(v_rareza) < cronica_i_rango(coalesce(t.config ->> 'min_rareza', 'rara')) and not v_primera then return new; end if;
    perform cronica_i_anotar('cria_nacida', new.user_id, null, null,
      jsonb_build_object('carta_id', new.carta_id, 'nombre', coalesce((select data ->> 'nombre' from cartas_definiciones where id = new.carta_id), new.carta_id),
        'rareza', v_rareza, 'habitat', new.habitat, 'primera', v_primera),
      'cria:' || new.id, 'corrales.html');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== APUESTAS DEL HIPÓDROMO */
create or replace function public.cronica_t_apuesta_hipodromo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_monto numeric := new.monto;
  v_origen bigint := new.origen;
  v_fila record;
  v_pasos int := 0;
begin
  begin
    -- Con «doble» lo ganado no se cobra: pasa a la carrera siguiente. Solo cuenta el último eslabón, medido contra lo que se apostó al empezar.
    if new.doble then return new; end if;
    select * into t from cronica_tipos where tipo = 'apuesta_hipodromo';
    if not found or not t.activo then return new; end if;
    while v_origen is not null and v_pasos < 12 loop
      select a.monto, a.origen into v_fila from hipodromo_apuestas a where a.id = v_origen;
      exit when not found;
      v_monto := v_fila.monto; v_origen := v_fila.origen; v_pasos := v_pasos + 1;
    end loop;
    -- Cuenta si paga 4 veces lo apostado y al menos 200 tokens, o si el premio es grande por sí solo (config.pago_siempre, 1000 por defecto)
    if v_monto <= 0 then return new; end if;
    if not ((new.pago >= coalesce((t.config ->> 'min_pago')::numeric, 200) and new.pago >= v_monto * coalesce((t.config ->> 'ratio')::numeric, 4))
            or new.pago >= coalesce((t.config ->> 'pago_siempre')::numeric, 1000)) then return new; end if;
    perform cronica_i_anotar('apuesta_hipodromo', new.usuario, null, null,
      jsonb_build_object('apuesta', new.tipo, 'criaturas', new.nombres, 'carrera', new.carrera, 'monto', v_monto, 'pago', new.pago, 'mult', round(new.pago / v_monto, 1),
        'cadena', v_pasos > 0),
      'hip:apuesta:' || new.id, 'hipodromo.html');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== APUESTAS DE VEINTIUNA (manos y mesas) */
create or replace function public.cronica_t_apuesta_veintiuna()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
begin
  begin
    if new.pago is null or new.apuesta is null or new.apuesta <= 0 then return new; end if;
    select * into t from cronica_tipos where tipo = 'apuesta_veintiuna';
    if not found or not t.activo then return new; end if;
    -- Cuenta si paga 4 veces lo apostado y al menos 200 tokens, o si el premio es grande por sí solo (config.pago_siempre, 1000 por defecto)
    if not ((new.pago >= coalesce((t.config ->> 'min_pago')::numeric, 200) and new.pago >= new.apuesta * coalesce((t.config ->> 'ratio')::numeric, 4))
            or new.pago >= coalesce((t.config ->> 'pago_siempre')::numeric, 1000)) then return new; end if;
    perform cronica_i_anotar('apuesta_veintiuna', new.user_id, null, null,
      jsonb_build_object('apuesta', new.apuesta, 'pago', new.pago, 'mult', round(new.pago / new.apuesta, 1), 'regla', new.regla),
      'v21:apuesta:' || new.id, 'veintiuna.html');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== RACHAS DE VEINTIUNA (una sola línea viva) */
create or replace function public.cronica_t_racha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t cronica_tipos%rowtype;
  v_min int;
  v_viva_id bigint;
  v_viva_record boolean;
  v_record boolean;
begin
  begin
    select * into t from cronica_tipos where tipo = 'racha_veintiuna';
    if not found or not t.activo then return new; end if;
    v_min := coalesce((t.config ->> 'min')::int, 4);
    select id, coalesce((datos ->> 'record')::boolean, false) into v_viva_id, v_viva_record from cronica_sucesos
     where tipo = 'racha_veintiuna' and user_id = new.user_id and coalesce((datos ->> 'activa')::boolean, false) order by id desc limit 1;
    if new.racha >= v_min and new.racha > old.racha then
      -- Récord: supera la mejor racha de todos los demás jugadores
      v_record := new.racha > coalesce((select max(mejor_racha) from veintiuna_estadisticas where user_id <> new.user_id), 0);
      if v_viva_id is not null then
        update cronica_sucesos set datos = jsonb_build_object('racha', new.racha, 'activa', true, 'record', v_record or v_viva_record), actualizado = now() where id = v_viva_id;
      else
        perform cronica_i_anotar('racha_veintiuna', new.user_id, null, null, jsonb_build_object('racha', new.racha, 'activa', true, 'record', v_record),
          'v21:racha:' || new.user_id || ':' || extract(epoch from now())::bigint, 'veintiuna.html');
      end if;
    elsif new.racha < old.racha and v_viva_id is not null then
      -- Perdió: la línea se cierra con la racha que llevaba
      update cronica_sucesos set datos = jsonb_build_object('racha', old.racha, 'activa', false, 'record', v_viva_record), actualizado = now() where id = v_viva_id;
    end if;
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== DESAFÍOS DE ORO DE VEINTIUNA */
create or replace function public.cronica_t_oro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d veintiuna_logros_def%rowtype;
begin
  begin
    select * into d from veintiuna_logros_def where id = new.logro;
    if not found or d.nivel <> 'oro' then return new; end if;
    -- Los desafíos se reinician cada día: la clave lleva el día para que pueda volver a salir mañana
    perform cronica_i_anotar('logro_oro_veintiuna', new.user_id, null, null, jsonb_build_object('logro', d.id, 'nombre', d.nombre),
      'v21:oro:' || new.user_id || ':' || d.id || ':' || to_char(now() at time zone 'utc', 'YYYYMMDD'), 'veintiuna.html');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== COPAS DEL HIPÓDROMO */
create or replace function public.cronica_t_copa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grado text := new.resultado ->> 'grado';
  v_gana jsonb := new.resultado -> 'llegada' -> 0;
  v_dueno uuid;
begin
  begin
    if v_grado is null or not (v_grado like 'copa\_%' or v_grado = 'gran') then return new; end if;
    select c.dueno::uuid into v_dueno from hipodromo_criaturas c
     where c.id = (v_gana ->> 'id')::bigint and c.dueno ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    if v_dueno is null then return new; end if;   -- las criaturas del mundo sin dueño no cuentan
    -- El resultado se guarda una hora antes de la carrera: no se enseña hasta que acaba (salida + 3 minutos)
    perform cronica_i_anotar('copa_hipodromo', v_dueno, null, null,
      jsonb_build_object('criatura', v_gana ->> 'nombre', 'copa', coalesce(new.resultado ->> 'nombre', v_grado), 'grado', v_grado,
        'premio', coalesce((v_gana ->> 'premio')::numeric, 0), 'carrera', new.n),
      'hip:copa:' || new.n, 'hipodromo.html', false, new.hora + interval '3 minutes');
  exception when others then null;
  end;
  return new;
end;
$$;

/* ================================================================== PERMISOS Y DISPARADORES */
revoke all on function public.cronica_i_carta(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.cronica_t_carta() from public, anon, authenticated;
revoke all on function public.cronica_t_movimiento() from public, anon, authenticated;
revoke all on function public.cronica_t_trueque() from public, anon, authenticated;
revoke all on function public.cronica_t_cria() from public, anon, authenticated;
revoke all on function public.cronica_t_apuesta_hipodromo() from public, anon, authenticated;
revoke all on function public.cronica_t_apuesta_veintiuna() from public, anon, authenticated;
revoke all on function public.cronica_t_racha() from public, anon, authenticated;
revoke all on function public.cronica_t_oro() from public, anon, authenticated;
revoke all on function public.cronica_t_copa() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.cartas_registro') is not null then
    drop trigger if exists cronica_carta on public.cartas_registro;
    create trigger cronica_carta after insert on public.cartas_registro for each row execute function public.cronica_t_carta();
  end if;
  if to_regclass('public.cartas_movimientos') is not null then
    drop trigger if exists cronica_movimiento on public.cartas_movimientos;
    create trigger cronica_movimiento after insert on public.cartas_movimientos for each row
      when (new.tipo = 'transferencia' and new.a is not null) execute function public.cronica_t_movimiento();
  end if;
  if to_regclass('public.cartas_intercambios') is not null then
    drop trigger if exists cronica_trueque on public.cartas_intercambios;
    create trigger cronica_trueque after update of estado on public.cartas_intercambios for each row
      when (new.estado = 'aceptada' and old.estado is distinct from new.estado) execute function public.cronica_t_trueque();
  end if;
  if to_regclass('public.cartas_crias') is not null then
    drop trigger if exists cronica_cria on public.cartas_crias;
    create trigger cronica_cria after update of estado on public.cartas_crias for each row
      when (new.estado = 'nacida' and old.estado is distinct from new.estado) execute function public.cronica_t_cria();
  end if;
  if to_regclass('public.hipodromo_apuestas') is not null then
    drop trigger if exists cronica_apuesta_hipodromo on public.hipodromo_apuestas;
    create trigger cronica_apuesta_hipodromo after update of estado on public.hipodromo_apuestas for each row
      when (new.estado = 'ganada' and old.estado is distinct from new.estado) execute function public.cronica_t_apuesta_hipodromo();
  end if;
  if to_regclass('public.veintiuna_partidas') is not null then
    drop trigger if exists cronica_apuesta_veintiuna on public.veintiuna_partidas;
    create trigger cronica_apuesta_veintiuna after update of estado, pago on public.veintiuna_partidas for each row
      when (new.estado = 'terminada' and new.modo = 'apuesta') execute function public.cronica_t_apuesta_veintiuna();
  end if;
  if to_regclass('public.veintiuna_estadisticas') is not null then
    drop trigger if exists cronica_racha on public.veintiuna_estadisticas;
    create trigger cronica_racha after update of racha on public.veintiuna_estadisticas for each row
      when (old.racha is distinct from new.racha) execute function public.cronica_t_racha();
  end if;
  if to_regclass('public.veintiuna_logros') is not null then
    drop trigger if exists cronica_oro on public.veintiuna_logros;
    create trigger cronica_oro after insert on public.veintiuna_logros for each row execute function public.cronica_t_oro();
  end if;
  if to_regclass('public.hipodromo_carreras') is not null then
    drop trigger if exists cronica_copa on public.hipodromo_carreras;
    create trigger cronica_copa after insert on public.hipodromo_carreras for each row execute function public.cronica_t_copa();
  end if;
end $$;
