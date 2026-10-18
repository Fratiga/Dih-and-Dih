-- ECONOMÍA DE CARTAS, parte 13: Hipódromo, opción B (decisión del usuario, 13 oct). BORRADOR SIN APLICAR.
-- Corre DESPUÉS de economia_11 (usa la etiqueta «En circulación»). Se puede correr más de una vez.
-- Avisado a la sesión que mantiene el Hipódromo («Caballo») antes de escribirlo.
--
-- Qué cambia, SOLO en las tres funciones de compra y venta de cartas del Hipódromo, y en el servidor (una llamada directa también
-- queda rechazada, no solo la interfaz):
--   * Las cartas LEGENDARIAS y LIMITADAS no se compran ni se venden: lo comprueba la propia función por rareza, no solo la falta de
--     precio (si alguien vuelve a poner un precio de legendaria con hipodromo_admin_precios, sigue sin poder comerciarse).
--   * Solo se pueden COMPRAR cartas «en circulación»; se comprueba antes de cobrar.
--   * hipodromo_cartas_reserva() solo lista cartas en circulación y excluye legendarias y limitadas.
-- Qué NO cambia: los precios (ni la tabla hipodromo_precios_cartas ni hipodromo_admin_precios), las firmas, el formato de lo que
-- devuelven, la vía de venta de cartas normales, ni nada más del Hipódromo. Vender una carta fuera de circulación se sigue permitiendo
-- (vuelve a la reserva; allí no se puede comprar hasta que esté en circulación).
-- El texto base de las tres funciones es el que hay en producción el 13 de octubre de 2026 (revisado antes de escribir esto).

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
    where c.publicada and c.en_circulacion and c.rareza not in ('legendaria', 'limitada')
      and (c.lado is null or (v_lado is not null and v_lado = any (c.lado)))
  ), '[]'::jsonb);
end;
$$;

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
  if v_carta.rareza in ('legendaria', 'limitada') then raise exception 'Las cartas legendarias y limitadas no se venden en el hipódromo.'; end if;
  if not v_carta.en_circulacion then raise exception 'Esa carta todavía no está en circulación.'; end if;
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
  if v_saldo < v_precio then raise exception 'No tienes tokens suficientes (cuesta %).', v_precio; end if;
  v_res := cartas_i_emitir(v_uid, p_carta, 'comprada con tokens de juego', 'hipodromo:compra');
  update hipodromo_billeteras set saldo = saldo - v_precio where usuario = v_uid returning saldo into v_saldo;
  insert into hipodromo_movimientos (usuario, n, concepto, monto, saldo)
    values (v_uid, null, 'Compra de carta: ' || p_carta || ' (' || v_carta.rareza || ')', -v_precio, v_saldo);
  return jsonb_build_object('ok', true, 'carta', p_carta, 'rareza', v_carta.rareza, 'precio', v_precio, 'saldo', v_saldo, 'numero', v_res -> 'numero');
end;
$$;

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
  perform pg_advisory_xact_lock(hashtext('cartas_jugador_' || v_uid::text));
  select * into v_ej from cartas_ejemplares where id = p_ejemplar;
  if not found or v_ej.propietario is distinct from v_uid then raise exception 'Esa carta no es tuya.'; end if;
  select rareza into v_rareza from cartas_catalogo where id = v_ej.carta_id;
  if v_rareza in ('legendaria', 'limitada') then raise exception 'Las cartas legendarias y limitadas no se compran en el hipódromo.'; end if;
  select venta into v_precio from hipodromo_precios_cartas where rareza = v_rareza;
  if v_precio is null then raise exception 'Esa rareza no se compra.'; end if;
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
