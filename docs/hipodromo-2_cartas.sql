-- HIPÓDROMO, parte 2: las monedas del hipódromo y las cartas.
-- Se ejecuta DESPUÉS de docs/hipodromo.sql y de la economía de cartas (economia-1 a economia-9). Se puede repetir.
--
-- Qué hace:
--   * Nadie empieza con monedas: la billetera nace con 0. El dinero entra vendiendo cartas, con los premios de una criatura
--     o con lo que se gana apostando.
--   * Vender una carta: la copia pasa a la reserva (la misma a la que vuelven las cartas que se pierden contra la IA) y
--     el jugador cobra un precio que depende de la rareza.
--   * Comprar una carta: solo de lo que hay en la reserva (copias que algún jugador vendió o perdió). No se emite nada
--     nuevo: comprar no crea cartas, solo las mueve. Cuesta más de lo que se paga al vender (2,5 veces por defecto), así
--     que vender y recomprar siempre pierde monedas y no hay forma de ganar con ese ciclo.
--   * Todo pasa por las funciones de la economía de cartas (cartas_i_retirar y cartas_i_emitir), así que se respetan los
--     límites por jugador, los bloqueos y el libro de movimientos. Las cartas de un Side que el jugador no ve no se compran.
--
-- Esto cambia una decisión de docs/economia-de-cartas.md («no existe una moneda universal»): ahora hay una moneda, la del
-- hipódromo, que se puede cambiar por cartas en los dos sentidos. Lo decidió el DM el 13 de octubre de 2026.

-- 1) La billetera empieza en 0 --------------------------------------------------------------------------------------------
alter table public.hipodromo_billeteras alter column saldo set default 0;

-- 2) Precios por rareza -----------------------------------------------------------------------------------------------------
create table if not exists public.hipodromo_precios_cartas (
  rareza text primary key,
  venta  integer not null check (venta >= 0),       -- lo que paga la casa al comprar una carta al jugador
  compra integer not null check (compra >= venta)   -- lo que cobra al vender una carta de la reserva
);
insert into public.hipodromo_precios_cartas (rareza, venta, compra) values
  ('comun', 20, 50), ('infrecuente', 60, 150), ('rara', 200, 500), ('legendaria', 800, 2000)
on conflict (rareza) do nothing;
-- Las limitadas no se compran ni se venden en el hipódromo: solo las da el DM. Sin precio, las funciones las rechazan y no salen en la lista.
delete from public.hipodromo_precios_cartas where rareza = 'limitada';
alter table public.hipodromo_precios_cartas enable row level security;
drop policy if exists "hipodromo_precios_cartas se lee" on public.hipodromo_precios_cartas;
create policy "hipodromo_precios_cartas se lee" on public.hipodromo_precios_cartas for select using (true);
revoke all on public.hipodromo_precios_cartas from anon, authenticated;
grant select on public.hipodromo_precios_cartas to anon, authenticated;

-- 3) Vender una carta ---------------------------------------------------------------------------------------------------------
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
begin
  if v_uid is null then raise exception 'Hace falta iniciar sesión.'; end if;
  -- mismo candado por jugador que usa el resto de la economía de cartas (se toma a mano para que valga con cualquier versión de sus funciones)
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  select * into v_ej from cartas_ejemplares where id = p_ejemplar;
  if not found or v_ej.propietario is distinct from v_uid then raise exception 'Esa carta no es tuya.'; end if;
  select rareza into v_rareza from cartas_catalogo where id = v_ej.carta_id;
  select venta into v_precio from hipodromo_precios_cartas where rareza = v_rareza;
  if v_precio is null then raise exception 'Esa rareza no se compra.'; end if;
  -- la copia tiene que estar libre (no apostada ni en un intercambio); se bloquea la fila para que nadie la mueva a la vez
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
$$;
revoke all on function public.hipodromo_vender_carta(uuid) from public, anon;
grant execute on function public.hipodromo_vender_carta(uuid) to authenticated;

-- 4) Qué hay para comprar ----------------------------------------------------------------------------------------------------------
-- Las cartas con copias en la reserva que el jugador puede ver (por su Side), con su precio y cuántas tiene ya.
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
$$;
revoke all on function public.hipodromo_cartas_reserva() from public, anon;
grant execute on function public.hipodromo_cartas_reserva() to authenticated;

-- 5) Comprar una carta de la reserva -----------------------------------------------------------------------------------------------
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
  select side into v_lado from perfiles where user_id = v_uid;
  if v_carta.lado is not null and (v_lado is null or not (v_lado = any (v_carta.lado))) then raise exception 'Esa carta no está disponible para ti.'; end if;
  select compra into v_precio from hipodromo_precios_cartas where rareza = v_carta.rareza;
  if v_precio is null then raise exception 'Esa rareza no se vende.'; end if;
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  perform cartas_i_candado(p_carta);
  -- solo de la reserva: si no hubiera copia, cartas_i_emitir emitiría una nueva y comprar crearía cartas
  if not exists (select 1 from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva') then
    raise exception 'No quedan copias de esa carta en la reserva.';
  end if;
  insert into hipodromo_billeteras (usuario) values (v_uid) on conflict (usuario) do nothing;
  select saldo into v_saldo from hipodromo_billeteras where usuario = v_uid for update;
  if v_saldo < v_precio then raise exception 'No tienes monedas suficientes (cuesta %).', v_precio; end if;
  -- respeta el límite por jugador: si ya tiene las que puede tener, aborta y no cobra nada
  v_res := cartas_i_emitir(v_uid, p_carta, 'comprada con monedas del hipódromo', 'hipodromo:compra');
  update hipodromo_billeteras set saldo = saldo - v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Compra de carta: ' || p_carta || ' (' || v_carta.rareza || ')', -v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', p_carta, 'rareza', v_carta.rareza, 'precio', v_precio, 'saldo', v_saldo, 'numero', v_res -> 'numero');
end;
$$;
revoke all on function public.hipodromo_comprar_carta(text) from public, anon;
grant execute on function public.hipodromo_comprar_carta(text) to authenticated;

-- 6) Cambiar los precios (solo el admin) ----------------------------------------------------------------------------------------------
-- p_cambios: { "comun": { "venta": 20, "compra": 50 }, ... }
create or replace function public.hipodromo_admin_precios(p_cambios jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  k text;
begin
  if not fichas_es_admin() then raise exception 'Solo el admin puede cambiar los precios.'; end if;
  for k in select jsonb_object_keys(p_cambios) loop
    insert into hipodromo_precios_cartas (rareza, venta, compra)
    values (k, (p_cambios -> k ->> 'venta')::int, (p_cambios -> k ->> 'compra')::int)
    on conflict (rareza) do update set venta = excluded.venta, compra = excluded.compra;
  end loop;
end;
$$;
revoke all on function public.hipodromo_admin_precios(jsonb) from public, anon;
grant execute on function public.hipodromo_admin_precios(jsonb) to authenticated;
