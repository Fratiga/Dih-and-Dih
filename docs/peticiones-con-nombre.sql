-- PETICIONES: ya no hay peticiones anónimas, la petición lleva el nombre de la cuenta.
-- La página (js/peticiones.js) ya pide iniciar sesión y manda el nombre de usuario de la cuenta, pero eso solo
-- lo controla el navegador: quien hable directo con la API podría mandar otro nombre o ninguno. Este disparador
-- lo arregla en el servidor: antes de guardar cada petición exige una sesión y pone él mismo el nombre.
--
-- Se ejecuta una vez en el editor SQL de Supabase (se puede repetir). Funciona tanto si la petición entra por
-- peticion_enviar como por un insert directo. El nombre sale de perfiles.username; si la cuenta no tiene,
-- la parte del correo antes de la @.
--
-- Ojo: los inserts hechos desde el editor SQL o con la service_role no llevan sesión y se rechazan. Para
-- importar peticiones a mano, desactiva el disparador un momento:
--   alter table public.peticiones disable trigger peticiones_poner_nombre;
-- Las peticiones que ya estaban, anónimas o no, no se tocan.

create or replace function public.peticiones_poner_nombre()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_usuario uuid := auth.uid();
  v_nombre text;
begin
  if v_usuario is null then
    raise exception 'Inicia sesión para enviar una petición' using errcode = '42501';
  end if;
  select nullif(btrim(p.username), '') into v_nombre from public.perfiles p where p.user_id = v_usuario;
  if v_nombre is null then
    select split_part(u.email, '@', 1) into v_nombre from auth.users u where u.id = v_usuario;
  end if;
  new.nombre := v_nombre;
  return new;
end;
$$;

drop trigger if exists peticiones_poner_nombre on public.peticiones;
create trigger peticiones_poner_nombre
  before insert on public.peticiones
  for each row execute function public.peticiones_poner_nombre();
