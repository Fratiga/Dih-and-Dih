-- HIPÓDROMO, parte 3: las órdenes de la cuadra se procesan al instante.
-- Antes: hipodromo_ordenar solo guardaba la orden y la Edge Function la leía en su pasada de cada minuto (pg_cron), así que entrenar, bautizar o inscribir
-- tardaban entre 10 y 60 segundos (media de 30) en contestar. Ahora, al guardarse una orden, la propia base de datos avisa a la Edge Function en ese momento
-- (pg_net, después de confirmar la orden) y la respuesta llega en 2 a 4 segundos. El cron de cada minuto sigue ahí como red de seguridad.
-- Solo para producción: necesita pg_net (no está en el Postgres de pruebas), por eso va aparte de docs/hipodromo.sql.
-- La clave es la misma que usa el cron (x-hipodromo-clave); se guarda en una tabla que nadie puede leer salvo la función de servicio.
-- Antes de ejecutarlo, cambia <LA MISMA CLAVE> por la de la Edge Function (en docs/hipodromo-avanzar.ts y en el cron).

create table if not exists public.hipodromo_secreto (
  id    integer primary key default 1 check (id = 1),
  clave text not null
);
alter table public.hipodromo_secreto enable row level security;                  -- sin políticas: solo service_role y las funciones security definer
revoke all on public.hipodromo_secreto from anon, authenticated;
insert into public.hipodromo_secreto (id, clave) values (1, '<LA MISMA CLAVE>') on conflict (id) do update set clave = excluded.clave;

create or replace function public.hipodromo_avisar_orden() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_clave text;
begin
  select clave into v_clave from hipodromo_secreto where id = 1;
  if v_clave is not null then
    begin
      perform net.http_post(
        url := 'https://ilicqboqelrjuvtslaxd.supabase.co/functions/v1/hipodromo-avanzar',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-hipodromo-clave', v_clave),
        body := '{}'::jsonb,
        timeout_milliseconds := 20000);
    exception when others then null;       -- si el aviso falla, la orden se guarda igual y la procesa el cron en el siguiente minuto
    end;
  end if;
  return new;
end;
$$;
revoke all on function public.hipodromo_avisar_orden() from public, anon, authenticated;

drop trigger if exists hipodromo_ordenes_avisar on public.hipodromo_ordenes;
create trigger hipodromo_ordenes_avisar after insert on public.hipodromo_ordenes
  for each row execute function public.hipodromo_avisar_orden();
