-- ECONOMÍA DE CARTAS, parte 26: el Buhonero del Hipódromo, con reglas más finas. Se puede correr más de una vez. Corre DESPUÉS de hipodromo-2_cartas.sql
-- (las tres funciones de compra y venta viven AQUÍ desde ahora: si se vuelve a correr hipodromo-2_cartas.sql no se pisan).
--
--   1) Las cartas ÚNICAS (una sola copia en toda la página) no se compran ni se venden por tokens, igual que las legendarias y las limitadas. Antes, un
--      personaje único vendido por 200 tokens se podía recomprar por 500 y dejaba de ser único.
--   2) El precio depende de la ESCASEZ: cuantas menos copias puede haber de una carta (su límite global), más paga y más cobra el Buhonero. Se parte
--      del precio por rareza y se multiplica por raíz(20 / límite global) (el 20 es el límite global predeterminado), entre 0,5 y 3. Una carta con 20
--      copias paga lo de siempre; una rara con 5, el doble; una común con 50, algo menos de la mitad... pero la compra sigue costando 2,5 veces la venta.
--      Se apaga con el ajuste hipodromo_escasez = 0.
--   3) Tope diario de ventas por jugador (ajuste hipodromo_ventas_dia, 10 por defecto; 0 = sin tope), para que los tokens no salgan solo de vender cartas.
--   4) «Lo que buscas»: cada jugador puede apuntar hasta 12 cartas que le faltan y el Buhonero le enseña cuándo las tiene en la reserva.
--   5) La reserva solo enseña cartas en circulación y que se pueden comprar; marca las que el jugador busca.
insert into cartas_economia_ajustes (clave, valor) values ('hipodromo_escasez', '1'), ('hipodromo_ventas_dia', '10') on conflict (clave) do nothing;

-- 1) Precio de una carta (null = esa carta no se compra ni se vende en el Hipódromo) ----------------------------------------------
create or replace function public.hipodromo_i_precio(p_carta text, p_que text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c cartas_catalogo%rowtype;
  p hipodromo_precios_cartas%rowtype;
  f numeric := 1;
  ref numeric;
begin
  select * into c from cartas_catalogo where id = p_carta;
  if not found then return null; end if;
  if c.rareza in ('legendaria', 'limitada') or c.limite = 1 then return null; end if;      -- legendarias, limitadas y únicas: no se compran ni se venden
  select * into p from hipodromo_precios_cartas where rareza = c.rareza;
  if not found then return null; end if;
  if coalesce((cartas_ajuste('hipodromo_escasez', '1'::jsonb))::text::numeric, 1) = 1 and c.limite is not null then
    ref := greatest(1, coalesce((cartas_ajuste('limite_global_defecto', '20'::jsonb))::text::numeric, 20));
    f := least(3, greatest(0.5, sqrt(ref / c.limite)));
  end if;
  return greatest(1, round((case p_que when 'venta' then p.venta else p.compra end) * f))::int;
end;
$$;
revoke all on function public.hipodromo_i_precio(text, text) from public, anon, authenticated;

-- 2) Vender una carta ------------------------------------------------------------------------------------------------------------------
create or replace function public.hipodromo_vender_carta(p_ejemplar uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ej cartas_ejemplares%rowtype;
  v_rareza text;
  v_precio integer;
  v_saldo numeric;
  v_tope integer;
  v_hoy integer;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  -- mismo candado por jugador que usa el resto de la economía de cartas (se toma a mano para que valga con cualquier versión de sus funciones)
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  select * into v_ej from cartas_ejemplares where id = p_ejemplar;
  if not found or v_ej.propietario is distinct from v_uid then raise exception 'Esa carta no es tuya.'; end if;
  select rareza into v_rareza from cartas_catalogo where id = v_ej.carta_id;
  v_precio := hipodromo_i_precio(v_ej.carta_id, 'venta');
  if v_precio is null then raise exception 'El Buhonero no compra esa carta: es única, legendaria o limitada.'; end if;
  v_tope := coalesce((cartas_ajuste('hipodromo_ventas_dia', '10'::jsonb))::text::int, 10);
  if v_tope > 0 then
    select count(*) into v_hoy from hipodromo_movimientos where usuario = v_uid and concepto like 'Venta de carta%' and creado >= date_trunc('day', now());
    if v_hoy >= v_tope then raise exception 'Hoy ya le vendiste % cartas al Buhonero: vuelve mañana.', v_hoy; end if;
  end if;
  -- la copia tiene que estar libre (no apostada ni en un intercambio); se bloquea la fila para que nadie la mueva a la vez
  perform cartas_i_candado(v_ej.carta_id);
  select * into v_ej from cartas_ejemplares where id = p_ejemplar for update;
  if v_ej.propietario is distinct from v_uid or v_ej.estado <> 'poseida' then raise exception 'Esa carta no está libre: puede estar apostada o en un intercambio.'; end if;
  perform cartas_i_retirar(p_ejemplar, 'reserva', 'vendida por tokens de juego', 'hipodromo:venta');
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  update hipodromo_billeteras set saldo = saldo + v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Venta de carta: ' || v_ej.carta_id || ' (' || v_rareza || ')', v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', v_ej.carta_id, 'rareza', v_rareza, 'precio', v_precio, 'saldo', v_saldo);
end;
$$;
revoke all on function public.hipodromo_vender_carta(uuid) from public, anon;
grant execute on function public.hipodromo_vender_carta(uuid) to authenticated;

-- 3) Qué hay para comprar --------------------------------------------------------------------------------------------------------------
create or replace function public.hipodromo_cartas_reserva()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lado text;
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'carta', c.id, 'rareza', c.rareza, 'tipo', c.tipo, 'copias', r.copias, 'precio', hipodromo_i_precio(c.id, 'compra'),
             'tengo', (select count(*) from cartas_ejemplares x where x.propietario = v_uid and x.carta_id = c.id and x.estado in ('poseida', 'bloqueada')),
             'limite', cartas_limite_jugador(c.id),
             'buscada', exists (select 1 from hipodromo_deseos d where d.usuario = v_uid and d.carta = c.id))
           order by exists (select 1 from hipodromo_deseos d where d.usuario = v_uid and d.carta = c.id) desc,
                    case c.rareza when 'comun' then 1 when 'infrecuente' then 2 when 'rara' then 3 when 'limitada' then 4 else 5 end, c.id)
    from (select carta_id, count(*)::int as copias from cartas_ejemplares where estado = 'en_reserva' group by carta_id) r
    join cartas_catalogo c on c.id = r.carta_id
    where c.publicada and c.en_circulacion and hipodromo_i_precio(c.id, 'compra') is not null
      and (c.lado is null or (v_lado is not null and v_lado = any (c.lado)))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.hipodromo_cartas_reserva() from public, anon;
grant execute on function public.hipodromo_cartas_reserva() to authenticated;

-- 4) Comprar una carta de la reserva ---------------------------------------------------------------------------------------------------
create or replace function public.hipodromo_comprar_carta(p_carta text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if not v_carta.en_circulacion then raise exception 'Esa carta todavía no está disponible.'; end if;
  select side into v_lado from perfiles where user_id = v_uid;
  if v_carta.lado is not null and (v_lado is null or not (v_lado = any (v_carta.lado))) then raise exception 'Esa carta no está disponible para ti.'; end if;
  v_precio := hipodromo_i_precio(p_carta, 'compra');
  if v_precio is null then raise exception 'El Buhonero no vende esa carta: es única, legendaria o limitada.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  perform cartas_i_candado(p_carta);
  -- solo de la reserva: si no hubiera copia, cartas_i_emitir emitiría una nueva y comprar crearía cartas
  if not exists (select 1 from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva') then
    raise exception 'No quedan copias de esa carta en la reserva.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid for update;
  if v_saldo < v_precio then raise exception 'No tienes tokens suficientes (cuesta %).', v_precio; end if;
  -- respeta el límite por jugador: si ya tiene las que puede tener, aborta y no cobra nada
  v_res := cartas_i_emitir(v_uid, p_carta, 'comprada con tokens de juego', 'hipodromo:compra');
  update hipodromo_billeteras set saldo = saldo - v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Compra de carta: ' || p_carta || ' (' || v_carta.rareza || ')', -v_precio, v_saldo);
  -- si la tenía apuntada en «lo que buscas», ya la consiguió
  delete from hipodromo_deseos where usuario = v_uid and carta = p_carta;
  return jsonb_build_object('ok', true, 'carta', p_carta, 'rareza', v_carta.rareza, 'precio', v_precio, 'saldo', v_saldo, 'numero', v_res -> 'numero');
end;
$$;
revoke all on function public.hipodromo_comprar_carta(text) from public, anon;
grant execute on function public.hipodromo_comprar_carta(text) to authenticated;

-- 5) Lo que se paga por las cartas que tengo y cuántas he vendido hoy -----------------------------------------------------------------
create or replace function public.hipodromo_precios_mis_cartas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  return jsonb_build_object(
    'hoy', (select count(*) from hipodromo_movimientos where usuario = v_uid and concepto like 'Venta de carta%' and creado >= date_trunc('day', now())),
    'tope', coalesce((cartas_ajuste('hipodromo_ventas_dia', '10'::jsonb))::text::int, 10),
    'cartas', coalesce((select jsonb_object_agg(x.carta_id, jsonb_build_object('venta', hipodromo_i_precio(x.carta_id, 'venta')))
                        from (select distinct carta_id from cartas_ejemplares where propietario = v_uid) x), '{}'::jsonb));
end;
$$;
revoke all on function public.hipodromo_precios_mis_cartas() from public, anon;
grant execute on function public.hipodromo_precios_mis_cartas() to authenticated;

-- 6) Lo que buscas ------------------------------------------------------------------------------------------------------------------------
create table if not exists public.hipodromo_deseos (
  usuario uuid not null references auth.users(id) on delete cascade,
  carta text not null references public.cartas_catalogo(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (usuario, carta)
);
alter table public.hipodromo_deseos enable row level security;
revoke all on public.hipodromo_deseos from anon, authenticated;

create or replace function public.hipodromo_deseo_poner(p_carta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  if not exists (select 1 from cartas_catalogo where id = p_carta and publicada) then raise exception 'Esa carta no existe.'; end if;
  if hipodromo_i_precio(p_carta, 'compra') is null then raise exception 'El Buhonero no vende esa carta: es única, legendaria o limitada.'; end if;
  if (select count(*) from hipodromo_deseos where usuario = v_uid) >= 12 and not exists (select 1 from hipodromo_deseos where usuario = v_uid and carta = p_carta) then
    raise exception 'Solo puedes apuntar 12 cartas. Quita alguna antes.';
  end if;
  insert into hipodromo_deseos (usuario, carta) values (v_uid, p_carta) on conflict do nothing;
end;
$$;

create or replace function public.hipodromo_deseo_quitar(p_carta text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Hace falta iniciar sesión.'; end if;
  delete from hipodromo_deseos where usuario = auth.uid() and carta = p_carta;
end;
$$;

create or replace function public.hipodromo_deseos_ver()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'carta', d.carta,
             'copias', (select count(*) from cartas_ejemplares e where e.carta_id = d.carta and e.estado = 'en_reserva' and c.en_circulacion and c.publicada),
             'precio', hipodromo_i_precio(d.carta, 'compra'),
             'tengo', (select count(*) from cartas_ejemplares x where x.propietario = v_uid and x.carta_id = d.carta and x.estado in ('poseida', 'bloqueada')),
             'limite', cartas_limite_jugador(d.carta)) order by d.creado)
    from hipodromo_deseos d join cartas_catalogo c on c.id = d.carta where d.usuario = v_uid), '[]'::jsonb);
end;
$$;

revoke all on function public.hipodromo_deseo_poner(text) from public, anon;
revoke all on function public.hipodromo_deseo_quitar(text) from public, anon;
revoke all on function public.hipodromo_deseos_ver() from public, anon;
grant execute on function public.hipodromo_deseo_poner(text) to authenticated;
grant execute on function public.hipodromo_deseo_quitar(text) to authenticated;
grant execute on function public.hipodromo_deseos_ver() to authenticated;
