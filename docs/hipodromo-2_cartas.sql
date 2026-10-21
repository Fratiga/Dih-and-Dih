-- HIPÓDROMO, parte 2: los tokens de juego y las cartas.
-- Se ejecuta DESPUÉS de docs/hipodromo.sql y de la economía de cartas (economia-1 a economia-9). Se puede repetir.
--
-- Qué hace:
--   * Nadie empieza con tokens: la billetera nace con 0. El dinero entra vendiendo cartas, con los premios de una criatura
--     o con lo que se gana apostando.
--   * Vender una carta: la copia pasa a la reserva (las copias sin dueño que la economía de cartas reparte antes de emitir ninguna nueva) y
--     el jugador cobra un precio que depende de la rareza.
--   * Comprar una carta: solo de lo que hay en la reserva (copias que algún jugador vendió o perdió). No se emite nada
--     nuevo: comprar no crea cartas, solo las mueve. Cuesta más de lo que se paga al vender (2,5 veces por defecto), así
--     que vender y recomprar siempre pierde tokens y no hay forma de ganar con ese ciclo.
--   * Todo pasa por las funciones de la economía de cartas (cartas_i_retirar y cartas_i_emitir), así que se respetan los
--     límites por jugador, los bloqueos y el libro de movimientos. Las cartas de un Side que el jugador no ve no se compran.
--
-- Esto cambia una decisión de docs/economia-de-cartas.md («no existe un token universal»): ahora hay un token, el del
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
  ('comun', 20, 50), ('infrecuente', 60, 150), ('rara', 200, 500)
on conflict (rareza) do nothing;
-- Las limitadas y las legendarias no se compran ni se venden en el hipódromo (decisión del 13-oct-2026): solo las da el DM o salen jugando. Sin precio, las
-- funciones las rechazan y no salen en la lista. Si vuelves a poner un precio a mano, esto lo quita al repetir el archivo.
delete from public.hipodromo_precios_cartas where rareza in ('limitada', 'legendaria');
alter table public.hipodromo_precios_cartas enable row level security;
drop policy if exists "hipodromo_precios_cartas se lee" on public.hipodromo_precios_cartas;
create policy "hipodromo_precios_cartas se lee" on public.hipodromo_precios_cartas for select using (true);
revoke all on public.hipodromo_precios_cartas from anon, authenticated;
grant select on public.hipodromo_precios_cartas to anon, authenticated;

-- 3) a 5) Vender una carta, qué hay para comprar y comprar: las funciones (hipodromo_vender_carta, hipodromo_cartas_reserva y hipodromo_comprar_carta) viven ahora
--    en docs/economia-26_buhonero_precios_y_deseos.sql, que se corre DESPUÉS de este archivo. Así volver a correr este archivo no las pisa.

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
