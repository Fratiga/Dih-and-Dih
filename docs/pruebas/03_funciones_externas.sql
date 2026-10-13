-- Funciones de producción que NO son de la economía de cartas pero la usan o escriben en tablas que las migraciones tocan.
-- Se copian tal cual de producción (13 de octubre de 2026) para probar que las migraciones no las rompen.
-- Se cargan DESPUÉS de economia-1 a economia-6 y ANTES de las correcciones.

-- Cambiar el Side de un jugador (lo usa el panel de admin). Escribe en perfiles.
CREATE OR REPLACE FUNCTION public.fichas_admin_set_side(target_id uuid, nuevo_side text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  if nuevo_side not in ('A', 'B') then
    raise exception 'Side inválido: %', nuevo_side;
  end if;
  update perfiles set side = nuevo_side where user_id = target_id;
end;
$function$;

-- Hipódromo (otra sesión): compra y venta de cartas con monedas. Tablas mínimas para que las funciones corran.
create table public.hipodromo_precios_cartas (rareza text primary key, compra integer not null, venta integer not null);
insert into public.hipodromo_precios_cartas values ('comun', 50, 20), ('infrecuente', 150, 60), ('rara', 500, 200), ('legendaria', 2000, 800);
create table public.hipodromo_billeteras (usuario uuid primary key references auth.users(id), saldo numeric not null default 0, creada timestamptz default now());
create table public.hipodromo_movimientos (id bigserial primary key, usuario uuid, n integer, concepto text, monto numeric, saldo numeric, creado timestamptz default now());
alter table public.hipodromo_precios_cartas enable row level security;
alter table public.hipodromo_billeteras enable row level security;
alter table public.hipodromo_movimientos enable row level security;

CREATE OR REPLACE FUNCTION public.hipodromo_cartas_reserva() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_uid uuid := auth.uid();
  v_lado text;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'carta', c.id, 'rareza', c.rareza, 'tipo', c.tipo, 'copias', r.copias, 'precio', p.compra,
             'tengo', (select count(*) from cartas_ejemplares x where x.propietario = v_uid and x.carta_id = c.id and x.estado in ('poseida', 'bloqueada')),
             'limite', cartas_limite_jugador(c.id))
           order by case c.rareza when 'comun' then 1 when 'infrecuente' then 2 when 'rara' then 3 when 'limitada' then 4 else 5 end, c.id)
    from (select carta_id, count(*)::int as copias from cartas_ejemplares where estado = 'en_reserva' group by carta_id) r
    join cartas_catalogo c on c.id = r.carta_id
    join hipodromo_precios_cartas p on p.rareza = c.rareza
    where c.publicada and (c.lado is null or (v_lado is not null and v_lado = any (c.lado)))
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hipodromo_comprar_carta(p_carta text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_uid uuid := auth.uid();
  v_carta cartas_catalogo%rowtype;
  v_lado text;
  v_precio integer;
  v_saldo numeric;
  v_res jsonb;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  select * into v_carta from cartas_catalogo where id = p_carta and publicada;
  if not found then raise exception 'Esa carta no existe.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  if v_carta.lado is not null and (v_lado is null or not (v_lado = any (v_carta.lado))) then raise exception 'Esa carta no está disponible para ti.'; end if;
  select compra into v_precio from hipodromo_precios_cartas where rareza = v_carta.rareza;
  if v_precio is null then raise exception 'Esa rareza no se vende.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  perform cartas_i_candado(p_carta);
  if not exists (select 1 from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva') then
    raise exception 'No quedan copias de esa carta en la reserva.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid for update;
  if v_saldo < v_precio then raise exception 'No tienes monedas suficientes (cuesta %).', v_precio; end if;
  v_res := cartas_i_emitir(v_uid, p_carta, 'comprada con monedas del hipódromo', 'hipodromo:compra');
  update hipodromo_billeteras set saldo = saldo - v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Compra de carta: ' || p_carta || ' (' || v_carta.rareza || ')', -v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', p_carta, 'rareza', v_carta.rareza, 'precio', v_precio, 'saldo', v_saldo, 'numero', v_res -> 'numero');
end;
$function$;

CREATE OR REPLACE FUNCTION public.hipodromo_vender_carta(p_ejemplar uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_uid uuid := auth.uid();
  v_ej cartas_ejemplares%rowtype;
  v_rareza text;
  v_precio integer;
  v_saldo numeric;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  select * into v_ej from cartas_ejemplares where id = p_ejemplar;
  if not found or v_ej.propietario is distinct from v_uid then raise exception 'Esa carta no es tuya.'; end if;
  select rareza into v_rareza from cartas_catalogo where id = v_ej.carta_id;
  select venta into v_precio from hipodromo_precios_cartas where rareza = v_rareza;
  if v_precio is null then raise exception 'Esa rareza no se compra.'; end if;
  perform cartas_i_candado(v_ej.carta_id);
  select * into v_ej from cartas_ejemplares where id = p_ejemplar for update;
  if v_ej.propietario is distinct from v_uid or v_ej.estado <> 'poseida' then raise exception 'Esa carta no está libre: puede estar apostada o en un intercambio.'; end if;
  perform cartas_i_retirar(p_ejemplar, 'reserva', 'vendida por monedas del hipódromo', 'hipodromo:venta');
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  update hipodromo_billeteras set saldo = saldo + v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Venta de carta: ' || v_ej.carta_id || ' (' || v_rareza || ')', v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', v_ej.carta_id, 'rareza', v_rareza, 'precio', v_precio, 'saldo', v_saldo);
end;
$function$;

-- La Fractura (juego de estrategia): su recompensa escribe DIRECTAMENTE en cartas_coleccion, saltándose los ejemplares
CREATE TABLE public.fractura_guerras (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), titulo text not null default '', resultado text, pvp boolean not null default false, recompensada boolean not null default false, logros jsonb not null default '[]'::jsonb);
alter table public.fractura_guerras enable row level security;
CREATE OR REPLACE FUNCTION public.fractura_recompensa(p_guerra uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  uid uuid := auth.uid();
  g fractura_guerras%rowtype;
  objetivo text;
  carta text;
  total int;
  tirada numeric := random();
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  select * into g from fractura_guerras where id = p_guerra for update;
  if not found or g.user_id <> uid then raise exception 'Esa guerra no es tuya'; end if;
  if g.resultado <> 'victoria' then raise exception 'Solo se premia ganar'; end if;
  if g.pvp then raise exception 'Las guerras entre jugadores no dan cartas'; end if;
  if g.recompensada then raise exception 'Esa guerra ya dio su premio'; end if;

  objetivo := case when tirada < 0.7 then 'comun' else 'infrecuente' end;
  if g.logros ? 'victoria_dificil' or g.logros ? 'nucleo' or g.logros ? 'capital' then
    objetivo := case when tirada < 0.6 then 'infrecuente' else 'rara' end;
  end if;
  if exists (select 1 from jsonb_array_elements_text(g.logros) l where l like 'primera_victoria:%')
     or g.logros ? 'leyenda' or g.logros ? 'nemesis' or g.logros ? 'tres_generaciones' then
    objetivo := 'rara';
  end if;

  select id into carta from cartas_catalogo
   where rareza = objetivo and obtenible and publicada and limite is null
   order by random() limit 1;
  if carta is null then
    select id into carta from cartas_catalogo
     where rareza in ('comun', 'infrecuente', 'rara') and obtenible and publicada and limite is null
     order by case rareza when objetivo then 0 else 1 end, random() limit 1;
  end if;
  if carta is null then raise exception 'No hay cartas disponibles de premio'; end if;

  insert into cartas_coleccion (user_id, carta_id, cantidad) values (uid, carta, 1)
  on conflict (user_id, carta_id) do update set cantidad = cartas_coleccion.cantidad + 1
  returning cantidad into total;
  insert into cartas_registro (user_id, carta_id, origen, detalle, por)
  values (uid, carta, 'juego', left('La Fractura: ' || g.titulo, 200), uid);
  update fractura_guerras set recompensada = true where id = p_guerra;
  return jsonb_build_object('carta', carta, 'cantidad', total, 'rareza', objetivo);
end;
$function$;
