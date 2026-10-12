-- ECONOMÍA DE CARTAS, parte 5: intercambios entre jugadores y mercader.
-- Corre esto DESPUÉS de economia_1_nucleo.sql y economia_4_apuestas.sql. Se puede correr más de una vez.
--
-- Intercambios (docs/economia-de-cartas.md, sección 8.1):
--   * Un jugador ofrece de 1 a 5 copias suyas y pide cartas concretas (por nombre y cantidad). Puede dirigirlo a alguien
--     o dejarlo en el tablón abierto. Sus copias quedan bloqueadas hasta que se acepte, se cancele o caduque (7 días).
--   * Quien acepta entrega copias que cumplan exactamente lo pedido. Antes de completar se comprueba que ninguno de los
--     dos pase su límite por jugador con el cambio hecho. Todo o nada.
-- Mercader (secciones 8.2 a 8.4):
--   * No tiene moneda: cambia cartas por cartas. Cada día muestra unas pocas ofertas con existencias de una copia, que salen de
--     lo que él mismo compró y de la reserva. Nunca crea copias por su cuenta (solo el admin puede añadirle una, y cuenta
--     contra el límite global).
--   * Cada carta tiene una categoría de valor (común 1, poco común 2, rara 3, legendaria y limitada 4). Para llevarte una carta
--     tienes que entregar cartas cuyo valor sume lo que ella vale más uno (el mercader siempre se queda con algo), sin pasarte
--     de dos de más. Las legendarias y limitadas no se le entregan.
--   * Máximo 3 cambios por jugador al día, y no puedes recomprarle en 24 horas una carta que le diste.

-- 0) Utilidades -----------------------------------------------------------------------------------------
-- Comprueba que p_ids son copias libres y propias, de 1 a p_max, sin repetir (mensajes neutros)
create or replace function cartas_i_error_copias(p_user uuid, p_ids uuid[], p_max int default 5)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n int := coalesce(array_length(p_ids, 1), 0);
begin
  if n < 1 or n > p_max then return format('Tienen que ser de 1 a %s cartas', p_max); end if;
  if n <> (select count(distinct x) from unnest(p_ids) x) then return 'Hay una carta repetida'; end if;
  if (select count(*) from cartas_ejemplares where id = any(p_ids) and propietario = p_user and estado = 'poseida') <> n then
    return 'Alguna de las cartas no es tuya o no está libre (puede estar apostada o en otro intercambio)';
  end if;
  return null;
end;
$$;

-- null si, tras el cambio, el jugador no pasa su límite por jugador. sale / entra: copias que salen de su colección y que entran.
create or replace function cartas_i_error_canje(p_user uuid, p_sale uuid[], p_entra uuid[])
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fila record;
  tiene int;
  lim int;
begin
  for fila in
    select carta_id, sum(delta) as delta from (
      select carta_id, 1 as delta from cartas_ejemplares where id = any(p_entra)
      union all
      select carta_id, -1 from cartas_ejemplares where id = any(p_sale)
    ) x group by carta_id having sum(delta) > 0
  loop
    select count(*) into tiene from cartas_ejemplares where propietario = p_user and carta_id = fila.carta_id and estado in ('poseida', 'bloqueada');
    lim := cartas_limite_jugador(fila.carta_id);
    if tiene + fila.delta > lim then
      return format('Con ese cambio tendría %s copias de %s y el límite por jugador es %s',
                    tiene + fila.delta, coalesce((select data ->> 'nombre' from cartas_definiciones where id = fila.carta_id), fila.carta_id), lim);
    end if;
  end loop;
  return null;
end;
$$;

-- Mueve una copia de dueño sin volver a comprobar límites (quien llama ya comprobó el resultado final)
create or replace function cartas_i_mover_forzado(p_ejemplar uuid, p_a uuid, p_motivo text, p_referencia text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
begin
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if not found or ej.propietario is null then raise exception 'Esa copia no es de ningún jugador'; end if;
  delete from cartas_bloqueos where ejemplar = p_ejemplar;
  update cartas_ejemplares set propietario = p_a, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, de, a, motivo, referencia)
  values (p_ejemplar, ej.carta_id, 'transferencia', ej.propietario, p_a, left(p_motivo, 200), left(p_referencia, 200));
end;
$$;

-- Entrega a un jugador una copia concreta que está en la reserva o en el inventario del mercader
create or replace function cartas_i_dar_ejemplar(p_ejemplar uuid, p_user uuid, p_motivo text, p_referencia text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ej cartas_ejemplares%rowtype;
  problema text;
begin
  select * into ej from cartas_ejemplares where id = p_ejemplar;
  if not found then raise exception 'Esa copia no existe'; end if;
  perform cartas_i_candado(ej.carta_id);
  select * into ej from cartas_ejemplares where id = p_ejemplar for update;
  if ej.estado not in ('en_reserva', 'en_mercader') then raise exception 'Esa copia ya no está disponible'; end if;
  problema := cartas_i_error_recibir(p_user, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;
  update cartas_ejemplares set propietario = p_user, estado = 'poseida', actualizada = now() where id = p_ejemplar;
  insert into cartas_movimientos (ejemplar, carta_id, tipo, a, motivo, referencia)
  values (p_ejemplar, ej.carta_id, 'entrega_reserva', p_user, left(p_motivo, 200), left(p_referencia, 200));
end;
$$;

revoke all on function cartas_i_error_copias(uuid, uuid[], int) from public, anon, authenticated;
revoke all on function cartas_i_error_canje(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function cartas_i_mover_forzado(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function cartas_i_dar_ejemplar(uuid, uuid, text, text) from public, anon, authenticated;

-- 1) Intercambios entre jugadores -----------------------------------------------------------------------------
create table if not exists cartas_intercambios (
  id uuid primary key default gen_random_uuid(),
  de uuid not null references auth.users(id) on delete cascade,
  para uuid references auth.users(id) on delete cascade,
  nombre_de text not null default '',
  nombre_para text not null default '',
  ofrece uuid[] not null,
  ofrece_info jsonb not null default '[]'::jsonb,
  pide jsonb not null,
  pide_info jsonb not null default '[]'::jsonb,
  nota text not null default '',
  estado text not null default 'abierta' check (estado in ('abierta', 'aceptada', 'cancelada', 'caducada')),
  aceptada_por uuid,
  nombre_acepta text,
  entregado_info jsonb not null default '[]'::jsonb,
  creada timestamptz not null default now(),
  caduca timestamptz not null default now() + interval '7 days',
  cerrada timestamptz
);
create index if not exists cartas_intercambios_estado_idx on cartas_intercambios (estado, creada desc);

alter table cartas_intercambios enable row level security;
drop policy if exists "cartas_intercambios_select" on cartas_intercambios;
create policy "cartas_intercambios_select" on cartas_intercambios for select using (
  auth.uid() is not null and (de = auth.uid() or para = auth.uid() or aceptada_por = auth.uid() or (para is null and estado = 'abierta') or fichas_es_admin())
);

create or replace function cartas_i_info_pedido(p_pide jsonb)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('carta', x ->> 'carta', 'n', (x ->> 'n')::int,
      'nombre', coalesce(d.data ->> 'nombre', x ->> 'carta'), 'rareza', c.rareza)), '[]'::jsonb)
  from jsonb_array_elements(p_pide) x
  join cartas_catalogo c on c.id = x ->> 'carta'
  left join cartas_definiciones d on d.id = c.id;
$$;
revoke all on function cartas_i_info_pedido(jsonb) from public, anon, authenticated;

-- Limpia los intercambios caducados y devuelve sus cartas
create or replace function cartas_i_limpiar_intercambios()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
begin
  for f in select id from cartas_intercambios where estado = 'abierta' and caduca < now() loop
    update cartas_intercambios set estado = 'caducada', cerrada = now() where id = f.id;
    perform cartas_i_desbloquear('trueque:' || f.id::text);
  end loop;
end;
$$;
revoke all on function cartas_i_limpiar_intercambios() from public, anon, authenticated;

create or replace function cartas_refrescar()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform cartas_i_limpiar_apuestas();
  perform cartas_i_limpiar_intercambios();
end;
$$;
grant execute on function cartas_refrescar() to authenticated;

-- p_pide: [{ "carta": "kobold", "n": 2 }] (de 1 a 5 cartas en total)
create or replace function cartas_ofrecer(p_para uuid, p_ofrece uuid[], p_pide jsonb, p_nota text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  problema text;
  total int := 0;
  x jsonb;
  nueva uuid;
  nombre_yo text;
  nombre_el text := '';
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_limpiar_intercambios();
  problema := cartas_i_error_copias(uid, p_ofrece, 5);
  if problema is not null then raise exception 'Lo que ofreces: %', problema; end if;
  if p_pide is null or jsonb_typeof(p_pide) <> 'array' or jsonb_array_length(p_pide) < 1 or jsonb_array_length(p_pide) > 5 then
    raise exception 'Pide de 1 a 5 cartas distintas';
  end if;
  for x in select value from jsonb_array_elements(p_pide) loop
    if jsonb_typeof(x) <> 'object' or not (x ? 'carta') or coalesce(jsonb_typeof(x -> 'n'), '') <> 'number' or (x ->> 'n')::numeric not between 1 and 5 then
      raise exception 'Lo que pides no es válido';
    end if;
    if not exists (select 1 from cartas_catalogo where id = x ->> 'carta' and publicada) then raise exception 'La carta % no existe', x ->> 'carta'; end if;
    total := total + (x ->> 'n')::int;
  end loop;
  if total > 5 then raise exception 'Se pueden pedir como mucho 5 cartas'; end if;
  if (select count(distinct y ->> 'carta') from jsonb_array_elements(p_pide) y) <> jsonb_array_length(p_pide) then
    raise exception 'Una carta pedida está repetida: suma sus cantidades';
  end if;
  if p_para is not null then
    if p_para = uid then raise exception 'No puedes ofrecerte un intercambio a ti mismo'; end if;
    select username into nombre_el from perfiles where user_id = p_para;
    if not found then raise exception 'Ese jugador no existe'; end if;
  end if;
  if (select count(*) from cartas_intercambios where de = uid and estado = 'abierta') >= 5 then
    raise exception 'Ya tienes 5 intercambios abiertos';
  end if;
  select username into nombre_yo from perfiles where user_id = uid;

  insert into cartas_intercambios (de, para, nombre_de, nombre_para, ofrece, pide, nota)
  values (uid, p_para, coalesce(nombre_yo, 'Anónimo'), coalesce(nombre_el, ''), p_ofrece, p_pide, left(coalesce(p_nota, ''), 200))
  returning id into nueva;
  perform cartas_i_bloquear(p_ofrece, 'intercambio', 'trueque:' || nueva::text, now() + interval '8 days');
  update cartas_intercambios set ofrece_info = cartas_i_info_apuesta(p_ofrece), pide_info = cartas_i_info_pedido(p_pide) where id = nueva;
  return nueva;
end;
$$;

create or replace function cartas_aceptar_trueque(p_id uuid, p_ejemplares uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f cartas_intercambios%rowtype;
  problema text;
  x jsonb;
  e uuid;
  ref text := 'trueque:' || p_id::text;
  nombre_yo text;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_limpiar_intercambios();
  select * into f from cartas_intercambios where id = p_id for update;
  if not found then raise exception 'Ese intercambio no existe'; end if;
  if f.estado <> 'abierta' then raise exception 'Ese intercambio ya no está abierto'; end if;
  if f.de = uid then raise exception 'No puedes aceptar tu propio intercambio'; end if;
  if f.para is not null and f.para <> uid then raise exception 'Ese intercambio es para otro jugador'; end if;

  problema := cartas_i_error_copias(uid, p_ejemplares, 5);
  if problema is not null then raise exception 'Lo que entregas: %', problema; end if;
  -- Tiene que ser exactamente lo que se pidió
  if coalesce(array_length(p_ejemplares, 1), 0) <> (select coalesce(sum((y ->> 'n')::int), 0) from jsonb_array_elements(f.pide) y) then
    raise exception 'Tienes que entregar exactamente lo que se pide';
  end if;
  for x in select value from jsonb_array_elements(f.pide) loop
    if (select count(*) from cartas_ejemplares where id = any(p_ejemplares) and carta_id = x ->> 'carta') <> (x ->> 'n')::int then
      raise exception 'Tienes que entregar exactamente lo que se pide';
    end if;
  end loop;

  problema := cartas_i_error_canje(f.de, f.ofrece, p_ejemplares);
  if problema is not null then raise exception 'Quien ofrece no puede recibirlo: %', problema; end if;
  problema := cartas_i_error_canje(uid, p_ejemplares, f.ofrece);
  if problema is not null then raise exception 'Tú no podrías recibirlo: %', problema; end if;

  select username into nombre_yo from perfiles where user_id = uid;
  foreach e in array f.ofrece loop perform cartas_i_mover_forzado(e, uid, 'intercambio', ref); end loop;
  foreach e in array p_ejemplares loop perform cartas_i_mover_forzado(e, f.de, 'intercambio', ref); end loop;
  update cartas_intercambios set estado = 'aceptada', aceptada_por = uid, nombre_acepta = coalesce(nombre_yo, 'Anónimo'),
         entregado_info = cartas_i_info_apuesta(p_ejemplares), cerrada = now() where id = p_id;
end;
$$;

create or replace function cartas_cancelar_trueque(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  f cartas_intercambios%rowtype;
begin
  select * into f from cartas_intercambios where id = p_id for update;
  if not found or auth.uid() is null or (f.de <> auth.uid() and not fichas_es_admin()) then raise exception 'Ese intercambio no existe'; end if;
  if f.estado <> 'abierta' then raise exception 'Ese intercambio ya no está abierto'; end if;
  update cartas_intercambios set estado = 'cancelada', cerrada = now() where id = p_id;
  perform cartas_i_desbloquear('trueque:' || p_id::text);
end;
$$;

grant execute on function cartas_ofrecer(uuid, uuid[], jsonb, text) to authenticated;
grant execute on function cartas_aceptar_trueque(uuid, uuid[]) to authenticated;
grant execute on function cartas_cancelar_trueque(uuid) to authenticated;

-- 2) Mercader imposible -------------------------------------------------------------------------------------
create table if not exists cartas_mercader_ofertas (
  id uuid primary key default gen_random_uuid(),
  ejemplar uuid not null references cartas_ejemplares(id),
  valor_min int not null check (valor_min between 1 and 40),
  dia date not null default current_date,
  especial boolean not null default false,       -- puesta por el admin: no se retira con la rotación del día
  estado text not null default 'activa' check (estado in ('activa', 'vendida', 'retirada')),
  vendida_a uuid references auth.users(id) on delete set null,
  vendida timestamptz,
  creada timestamptz not null default now()
);
create index if not exists cartas_mercader_ofertas_estado_idx on cartas_mercader_ofertas (estado, dia);

create table if not exists cartas_mercader_registro (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  oferta uuid,
  recibe text not null,
  entrega jsonb not null default '[]'::jsonb,
  creado timestamptz not null default now()
);
create index if not exists cartas_mercader_registro_user_idx on cartas_mercader_registro (user_id, creado desc);

alter table cartas_mercader_ofertas enable row level security;
alter table cartas_mercader_registro enable row level security;
drop policy if exists "cartas_mercader_registro_select" on cartas_mercader_registro;
create policy "cartas_mercader_registro_select" on cartas_mercader_registro for select using (user_id = auth.uid() or fichas_es_admin());
-- las ofertas se leen con cartas_mercader_ver()

-- Cada día se renuevan las ofertas normales (hasta 6 cartas distintas)
create or replace function cartas_i_mercader_rotar()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from cartas_mercader_ofertas where estado = 'activa' and not especial and dia = current_date) then return; end if;
  update cartas_mercader_ofertas set estado = 'retirada' where estado = 'activa' and not especial;
  insert into cartas_mercader_ofertas (ejemplar, valor_min)
  select id, cartas_categoria_valor(rareza) + 1 from (
    select distinct on (e.carta_id) e.id, c.rareza, e.estado
    from cartas_ejemplares e join cartas_catalogo c on c.id = e.carta_id
    where e.estado in ('en_mercader', 'en_reserva') and c.rareza in ('comun', 'infrecuente', 'rara') and c.publicada
      and not exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = e.id and o.estado = 'activa')
    order by e.carta_id, (e.estado = 'en_mercader') desc, random()
  ) cand
  order by (estado = 'en_mercader') desc, random()
  limit 6;
end;
$$;
revoke all on function cartas_i_mercader_rotar() from public, anon, authenticated;

create or replace function cartas_mercader_ver()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_mercader_rotar();
  -- Una oferta cuya copia ya no está disponible se retira
  update cartas_mercader_ofertas o set estado = 'retirada'
    where o.estado = 'activa' and not exists (select 1 from cartas_ejemplares e where e.id = o.ejemplar and e.estado in ('en_mercader', 'en_reserva'));
  return jsonb_build_object(
    'ofertas', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'carta', e.carta_id, 'nombre', coalesce(d.data ->> 'nombre', e.carta_id), 'rareza', c.rareza,
                                          'numero', e.numero, 'valor_min', o.valor_min, 'especial', o.especial) order by o.especial desc, o.valor_min desc, e.carta_id)
      from cartas_mercader_ofertas o join cartas_ejemplares e on e.id = o.ejemplar join cartas_catalogo c on c.id = e.carta_id
      left join cartas_definiciones d on d.id = e.carta_id where o.estado = 'activa'), '[]'::jsonb),
    'hoy', (select count(*) from cartas_mercader_registro where user_id = uid and creado >= date_trunc('day', now())),
    'tope', 3);
end;
$$;

create or replace function cartas_mercader_comprar(p_oferta uuid, p_ejemplares uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  o cartas_mercader_ofertas%rowtype;
  ej cartas_ejemplares%rowtype;
  problema text;
  valor int;
  ref text;
  e uuid;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  select * into o from cartas_mercader_ofertas where id = p_oferta for update;
  if not found or o.estado <> 'activa' then raise exception 'Esa oferta ya no está'; end if;
  if not o.especial and o.dia <> current_date then
    update cartas_mercader_ofertas set estado = 'retirada' where id = p_oferta;
    raise exception 'Esa oferta ya caducó: el mercader cambia de inventario cada día';
  end if;
  select * into ej from cartas_ejemplares where id = o.ejemplar;
  if ej.estado not in ('en_mercader', 'en_reserva') then
    update cartas_mercader_ofertas set estado = 'retirada' where id = p_oferta;
    raise exception 'El mercader ya no tiene esa carta';
  end if;
  if (select count(*) from cartas_mercader_registro where user_id = uid and creado >= date_trunc('day', now())) >= 3 then
    raise exception 'Hoy ya hiciste 3 cambios con el mercader. Vuelve mañana';
  end if;
  if exists (select 1 from cartas_movimientos where tipo = 'retirada_mercader' and de = uid and carta_id = ej.carta_id and creado > now() - interval '24 hours') then
    raise exception 'Esa carta se la diste tú al mercader hace poco: no te la vende de vuelta hasta mañana';
  end if;

  problema := cartas_i_error_copias(uid, p_ejemplares, 5);
  if problema is not null then raise exception 'Lo que entregas: %', problema; end if;
  if exists (select 1 from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id
             where x.id = any(p_ejemplares) and (c.rareza in ('legendaria', 'limitada') or x.carta_id = ej.carta_id)) then
    raise exception 'El mercader no acepta cartas legendarias ni limitadas, ni otra copia de la que te ofrece';
  end if;
  select sum(cartas_categoria_valor(c.rareza)) into valor from cartas_ejemplares x join cartas_catalogo c on c.id = x.carta_id where x.id = any(p_ejemplares);
  if valor < o.valor_min then raise exception 'No alcanza: tienes que entregar cartas que sumen al menos % de valor (común 1, poco común 2, rara 3) y entregas %', o.valor_min, valor; end if;
  if valor > o.valor_min + 2 then raise exception 'Te pasas: entrega cartas que sumen % de valor, como mucho % (entregas %)', o.valor_min, o.valor_min + 2, valor; end if;
  problema := cartas_i_error_recibir(uid, ej.carta_id, 1);
  if problema is not null then raise exception '%', problema; end if;

  ref := 'mercader:' || p_oferta::text;
  foreach e in array p_ejemplares loop perform cartas_i_retirar(e, 'mercader', 'cambio con el mercader', ref); end loop;
  perform cartas_i_dar_ejemplar(o.ejemplar, uid, 'cambio con el mercader', ref);
  update cartas_mercader_ofertas set estado = 'vendida', vendida_a = uid, vendida = now() where id = p_oferta;
  insert into cartas_mercader_registro (user_id, oferta, recibe, entrega)
  values (uid, p_oferta, ej.carta_id, cartas_i_info_apuesta(p_ejemplares));
  insert into cartas_registro (user_id, carta_id, origen, detalle) values (uid, ej.carta_id, 'juego', 'mercader');
  return jsonb_build_object('carta', ej.carta_id, 'numero', ej.numero,
    'nombre', coalesce((select data ->> 'nombre' from cartas_definiciones where id = ej.carta_id), ej.carta_id));
end;
$$;

-- Admin: ponerle al mercader una copia especial (se emite nueva, contando contra el límite global, o sale de la reserva)
create or replace function cartas_admin_mercader_agregar(p_carta text, p_valor_min int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c cartas_catalogo%rowtype;
  ej uuid;
  emitidas int;
begin
  if uid is null or not fichas_es_admin() then raise exception 'No autorizado'; end if;
  select * into c from cartas_catalogo where id = p_carta;
  if not found then raise exception 'Esa carta no existe'; end if;
  if p_valor_min not between 1 and 40 then raise exception 'El valor va de 1 a 40'; end if;
  perform cartas_i_candado(p_carta);
  select id into ej from cartas_ejemplares where carta_id = p_carta and estado in ('en_reserva', 'en_mercader')
    and not exists (select 1 from cartas_mercader_ofertas o where o.ejemplar = cartas_ejemplares.id and o.estado = 'activa')
    order by (estado = 'en_mercader') desc, numero limit 1;
  if ej is null then
    select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = p_carta;
    if c.limite is not null and emitidas >= c.limite then raise exception 'AGOTADA: ya se emitieron las % copias de esta carta', c.limite; end if;
    insert into cartas_ejemplares (carta_id, numero, propietario, estado) values (p_carta, emitidas + 1, null, 'en_mercader') returning id into ej;
    insert into cartas_movimientos (ejemplar, carta_id, tipo, motivo, por) values (ej, p_carta, 'emision', 'oferta especial del mercader', uid);
  end if;
  insert into cartas_mercader_ofertas (ejemplar, valor_min, especial) values (ej, p_valor_min, true);
end;
$$;

create or replace function cartas_admin_mercader_quitar(p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  update cartas_mercader_ofertas set estado = 'retirada' where id = p_oferta and estado = 'activa';
end;
$$;

grant execute on function cartas_mercader_ver() to authenticated;
grant execute on function cartas_mercader_comprar(uuid, uuid[]) to authenticated;
grant execute on function cartas_admin_mercader_agregar(text, int) to authenticated;
grant execute on function cartas_admin_mercader_quitar(uuid) to authenticated;
