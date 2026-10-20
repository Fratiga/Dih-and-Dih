-- Los personajes del Hipódromo (js/hipodromo-npc.js): el Admin los maneja desde su panel (pestaña Personajes, js/admin-hipodromo-npc.js).
-- Dos tablas, que solo el Admin puede leer, y tres funciones, que solo el Admin puede llamar:
--   * hipodromo_npc_ajustes: lo que el Admin ha cambiado, encima de los valores de fábrica del código. Una fila por personaje (clave 'npc:remedios', 'npc:brea'...)
--     con solo los campos que ha tocado, y una fila 'global' con el interruptor general, la escala de las apuestas y las noticias por carrera. Un personaje nuevo
--     lleva "nuevo": true en sus datos y la descripción completa. Sin filas, todo queda como en el archivo.
--   * hipodromo_npc_ordenes: las órdenes puntuales (dar o quitar tokens, dar o quitar criaturas, soltar, vender, préstamo, reiniciar). La Edge Function
--     hipodromo-avanzar las lee y las aplica con el motor (que apunta hasta qué orden llegó, así que repetir un paso no las repite) y marca el resultado.
-- Al guardar o mandar algo se avisa a la Edge Function en ese momento (como docs/hipodromo-3_ordenes_inmediatas.sql: pg_net y la tabla hipodromo_secreto), y si
-- el aviso falla lo recoge su pasada de cada minuto. La función no se rompe si estas tablas todavía no existen.
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/admin/admin_historial.sql. Se puede correr más de una vez.

create table if not exists public.hipodromo_npc_ajustes (
  clave text primary key check (clave = 'global' or clave ~ '^npc:[a-z0-9-]{2,24}$'),
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and length(datos::text) <= 20000),
  actualizado timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null
);
alter table public.hipodromo_npc_ajustes enable row level security;
drop policy if exists "hipodromo_npc_ajustes_admin" on public.hipodromo_npc_ajustes;
create policy "hipodromo_npc_ajustes_admin" on public.hipodromo_npc_ajustes for select using (public.fichas_es_admin());
revoke all on public.hipodromo_npc_ajustes from anon, authenticated;
grant select on public.hipodromo_npc_ajustes to authenticated;           -- y solo ve filas el Admin (la política); no hay políticas de escritura

create table if not exists public.hipodromo_npc_ordenes (
  id bigint generated always as identity primary key,
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and length(datos::text) <= 2000),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'hecha', 'rechazada')),
  texto text,
  creada timestamptz not null default now(),
  resuelta timestamptz,
  creado_por uuid references auth.users(id) on delete set null
);
create index if not exists hipodromo_npc_ordenes_pendientes on public.hipodromo_npc_ordenes (id) where estado = 'pendiente';
alter table public.hipodromo_npc_ordenes enable row level security;
drop policy if exists "hipodromo_npc_ordenes_admin" on public.hipodromo_npc_ordenes;
create policy "hipodromo_npc_ordenes_admin" on public.hipodromo_npc_ordenes for select using (public.fichas_es_admin());
revoke all on public.hipodromo_npc_ordenes from anon, authenticated;
grant select on public.hipodromo_npc_ordenes to authenticated;

-- Guardar lo que el Admin ha cambiado de un personaje (o de los ajustes generales): reemplaza sus datos enteros
create or replace function public.hipodromo_npc_guardar(p_clave text, p_datos jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  insert into hipodromo_npc_ajustes (clave, datos, actualizado, actualizado_por) values (p_clave, p_datos, now(), auth.uid())
  on conflict (clave) do update set datos = excluded.datos, actualizado = now(), actualizado_por = auth.uid();
end;
$$;

-- Quitar los ajustes de un personaje (vuelve a los de fábrica) o borrar a uno que creó el Admin
create or replace function public.hipodromo_npc_quitar(p_clave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  delete from hipodromo_npc_ajustes where clave = p_clave;
end;
$$;

-- Mandar una orden puntual a un personaje. Devuelve el id de la orden: míralo en hipodromo_npc_ordenes hasta que deje de estar pendiente.
-- Solo se guardan los campos conocidos y con su forma.
create or replace function public.hipodromo_npc_orden(p_datos jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text := p_datos->>'tipo';
  v_npc text := p_datos->>'npc';
  v_d jsonb;
  v_id bigint;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if v_tipo is null or v_tipo not in ('caja', 'dar', 'quitar', 'soltar', 'vender', 'prestamo', 'reiniciar') then raise exception 'Orden desconocida.'; end if;
  if v_npc is null or v_npc !~ '^npc:[a-z0-9-]{2,24}$' then raise exception 'Personaje no válido.'; end if;
  if (select count(*) from hipodromo_npc_ordenes where estado = 'pendiente') >= 30 then raise exception 'Hay demasiadas órdenes sin resolver.'; end if;
  if v_tipo = 'caja' and (coalesce(p_datos->>'modo', '') not in ('sumar', 'fijar') or coalesce(jsonb_typeof(p_datos->'monto'), '') <> 'number' or abs((p_datos->>'monto')::numeric) > 10000000) then
    raise exception 'La orden de caja necesita un modo (sumar o fijar) y un importe.';
  end if;
  if v_tipo in ('dar', 'quitar', 'vender') and coalesce(jsonb_typeof(p_datos->'criatura'), '') <> 'number' then raise exception 'Falta la criatura.'; end if;
  v_d := jsonb_strip_nulls(jsonb_build_object('tipo', v_tipo, 'npc', v_npc,
    'modo', case when v_tipo = 'caja' then p_datos->>'modo' end,
    'monto', case when v_tipo = 'caja' then (p_datos->>'monto')::numeric end,
    'criatura', case when v_tipo in ('dar', 'quitar', 'vender') then (p_datos->>'criatura')::bigint end));
  insert into hipodromo_npc_ordenes (datos, creado_por) values (v_d, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.hipodromo_npc_guardar(text, jsonb) from public, anon;
revoke all on function public.hipodromo_npc_quitar(text) from public, anon;
revoke all on function public.hipodromo_npc_orden(jsonb) from public, anon;
grant execute on function public.hipodromo_npc_guardar(text, jsonb) to authenticated;
grant execute on function public.hipodromo_npc_quitar(text) to authenticated;
grant execute on function public.hipodromo_npc_orden(jsonb) to authenticated;

-- Avisar a la Edge Function al momento (cuando hay pg_net y la clave en hipodromo_secreto; si no, o si algo falla, la recoge su pasada de cada minuto)
create or replace function public.hipodromo_npc_avisar() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_clave text;
begin
  begin
    select clave into v_clave from hipodromo_secreto where id = 1;
    if v_clave is not null then
      perform net.http_post(
        url := 'https://ilicqboqelrjuvtslaxd.supabase.co/functions/v1/hipodromo-avanzar',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hipodromo-clave', v_clave),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000);
    end if;
  exception when others then null;
  end;
  return coalesce(new, old);
end;
$$;
revoke all on function public.hipodromo_npc_avisar() from public, anon, authenticated;

drop trigger if exists hipodromo_npc_ordenes_avisar on public.hipodromo_npc_ordenes;
create trigger hipodromo_npc_ordenes_avisar after insert on public.hipodromo_npc_ordenes for each row execute function public.hipodromo_npc_avisar();
drop trigger if exists hipodromo_npc_ajustes_avisar on public.hipodromo_npc_ajustes;
create trigger hipodromo_npc_ajustes_avisar after insert or update or delete on public.hipodromo_npc_ajustes for each row execute function public.hipodromo_npc_avisar();

-- Lo que se cambia aquí queda en el historial de Admin
select admin_registrar_tabla('hipodromo_npc_ajustes', array['clave'], 'Personajes del hipódromo');
