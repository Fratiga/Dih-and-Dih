-- ECONOMÍA DE CARTAS, parte 18: la crianza (corrales) y el mensaje de la forja cuando no se pueden crear más objetos.
-- Se puede correr más de una vez. Corre DESPUÉS de economia_1 a economia_17.
--
-- Cómo funciona la crianza
--   * Hay 6 corrales según el medio de la criatura: aviario, bosque, madriguera, pantano, glaciar y cubil. Cada carta de tipo Criatura
--     pertenece a uno (tabla cartas_cria_especies, con el tiempo de cada fase según la especie; el admin lo cambia desde el panel).
--   * Un corral solo funciona con DOS copias tuyas de la MISMA criatura. Las dos se bloquean mientras dura la cría.
--   * La cría pasa por tres fases (cortejo, gestación y cría; con nombres propios de cada corral). Al terminar se recoge: las dos cartas
--     vuelven a ti y recibes una copia nueva, que sale primero de la reserva y, si no hay, se emite una nueva respetando el límite global,
--     el límite por jugador y la etiqueta «En circulación». Criar nunca pasa esos topes.
--   * Si la especie ya llegó a su límite global (y no queda ninguna en la reserva): «Sobrepoblación de la especie: hay que respetar el
--     medio ambiente». Se avisa al empezar y, si pasa mientras tanto, al recoger (las dos cartas vuelven y no nace nada).
--   * Tras un nacimiento el corral descansa un tiempo (descanso_horas de la especie) antes de poder criar otra vez.
--   * Un corral solo guarda una pareja a la vez; hay seis corrales, así que como mucho seis parejas a la vez.

-- 1) Corrales y especies ---------------------------------------------------------------------------------------
create table if not exists cartas_corrales (
  habitat text primary key,
  nombre text not null,
  descripcion text not null default '',
  fases jsonb not null default '["Cortejo", "Gestación", "Cría"]'::jsonb,       -- nombres de las tres fases
  orden int not null default 0
);
insert into cartas_corrales (habitat, nombre, descripcion, fases, orden) values
  ('aviario',    'Aviario',        'Un recinto abierto al cielo, con perchas y corrientes de aire para las criaturas que vuelan.', '["Cortejo en vuelo", "Incubación del huevo", "Primer vuelo"]', 1),
  ('bosque',     'Corral del bosque', 'Hierba alta, un abrigo de ramas y sitio para correr: el hogar de las bestias de caza y de campo.', '["Cortejo", "Gestación", "Cría en la camada"]', 2),
  ('madriguera', 'Madriguera',     'Túneles estrechos y cálidos bajo tierra para las criaturas pequeñas y escurridizas.', '["Cortejo", "Gestación bajo tierra", "Primeras salidas"]', 3),
  ('pantano',    'Ciénaga',        'Agua turbia, juncos y barro hasta las rodillas: lo que piden los anfibios y las bestias de las aguas.', '["Cortejo", "Desove", "Crecimiento en el agua"]', 4),
  ('glaciar',    'Cámara de hielo', 'Una gruta helada, de aire quieto, para las criaturas hechas al frío eterno.', '["Cortejo", "Gestación al abrigo", "Cría entre la nieve"]', 5),
  ('cubil',      'Cubil',          'Roca caliente, huesos viejos y un nido de cenizas: el sitio de los dragones y sus parientes.', '["Cortejo", "Incubación del huevo", "Primeras llamas"]', 6)
on conflict (habitat) do nothing;

create table if not exists cartas_cria_especies (
  carta_id text primary key references cartas_catalogo(id) on delete cascade,
  habitat text not null references cartas_corrales(habitat),
  horas jsonb not null default '[4, 12, 8]'::jsonb,        -- [cortejo, gestación, cría], en horas
  descanso_horas numeric not null default 12 check (descanso_horas >= 0),
  activa boolean not null default true
);

-- Estimación por especie (solo las cartas que existen): tiempo total en horas, repartido 20 % / 55 % / 25 %
insert into cartas_cria_especies (carta_id, habitat, horas, descanso_horas)
select v.carta, v.habitat, jsonb_build_array(round(v.total * 0.2, 2), round(v.total * 0.55, 2), round(v.total * 0.25, 2)), round(v.total * 0.5, 2)
from (values
  ('rata', 'madriguera', 6), ('kobold', 'madriguera', 12),
  ('cuervo-del-augurio', 'aviario', 12), ('halcon-linire', 'aviario', 18), ('manta-del-cielo', 'aviario', 36), ('guiverno', 'aviario', 60), ('zraith', 'aviario', 96),
  ('colmillo-gris', 'bosque', 24), ('lobo', 'bosque', 24), ('perro-sabio', 'bosque', 24), ('felino-veloz-mistico', 'bosque', 36), ('guillotina', 'bosque', 48),
  ('sapo-beluto', 'pantano', 12), ('hidra', 'pantano', 72), ('kraken', 'pantano', 96),
  ('mamut-gelido', 'glaciar', 72),
  ('cocatriz', 'cubil', 24), ('dragarto', 'cubil', 72), ('protodraco', 'cubil', 72), ('draco', 'cubil', 96)
) as v(carta, habitat, total)
join cartas_catalogo c on c.id = v.carta
on conflict (carta_id) do nothing;

-- Las crías en curso y su historia
create table if not exists cartas_crias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  carta_id text not null references cartas_catalogo(id),
  habitat text not null references cartas_corrales(habitat),
  ejemplar_a uuid not null references cartas_ejemplares(id),
  ejemplar_b uuid not null references cartas_ejemplares(id),
  fases jsonb not null,                       -- [{nombre, horas}, ...] tal como estaban al empezar
  inicio timestamptz not null default now(),
  fin timestamptz not null,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'nacida', 'cancelada', 'sin_cupo')),
  cria_ejemplar uuid references cartas_ejemplares(id),
  cerrada timestamptz,
  descanso_hasta timestamptz
);
create unique index if not exists cartas_crias_un_corral_idx on cartas_crias (user_id, habitat) where estado = 'en_curso';
create index if not exists cartas_crias_usuario_idx on cartas_crias (user_id, inicio desc);

alter table cartas_corrales enable row level security;
alter table cartas_cria_especies enable row level security;
alter table cartas_crias enable row level security;
drop policy if exists "cartas_corrales_select" on cartas_corrales;
create policy "cartas_corrales_select" on cartas_corrales for select to authenticated using (true);
drop policy if exists "cartas_cria_especies_select" on cartas_cria_especies;
create policy "cartas_cria_especies_select" on cartas_cria_especies for select to authenticated using (true);
drop policy if exists "cartas_crias_select" on cartas_crias;
create policy "cartas_crias_select" on cartas_crias for select to authenticated using (user_id = auth.uid() or fichas_es_admin());
revoke all on cartas_corrales, cartas_cria_especies, cartas_crias from public, anon, authenticated;
grant select on cartas_corrales, cartas_cria_especies, cartas_crias to authenticated;

-- 2) ¿Queda sitio para otra copia de la especie? (una de la reserva o un número libre bajo el límite global)
create or replace function cartas_i_hay_cupo(p_carta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from cartas_ejemplares where carta_id = p_carta and estado = 'en_reserva')
      or exists (select 1 from cartas_catalogo c where c.id = p_carta and c.limite is not null
                 and (select coalesce(max(numero), 0) from cartas_ejemplares e where e.carta_id = c.id) < c.limite);
$$;
revoke all on function cartas_i_hay_cupo(text) from public, anon, authenticated;

-- 3) Ver mis corrales ------------------------------------------------------------------------------------------
create or replace function cartas_corral_ver()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  return jsonb_build_object(
    'ahora', now(),
    'corrales', coalesce((
      select jsonb_agg(jsonb_build_object(
        'habitat', co.habitat, 'nombre', co.nombre, 'descripcion', co.descripcion, 'fases', co.fases,
        'cria', (select to_jsonb(x) from (select c.id, c.carta_id, c.ejemplar_a, c.ejemplar_b, c.fases, c.inicio, c.fin,
                        (select numero from cartas_ejemplares where id = c.ejemplar_a) as numero_a,
                        (select numero from cartas_ejemplares where id = c.ejemplar_b) as numero_b
                 from cartas_crias c where c.user_id = uid and c.habitat = co.habitat and c.estado = 'en_curso') x),
        'descanso_hasta', (select max(c.descanso_hasta) from cartas_crias c where c.user_id = uid and c.habitat = co.habitat and c.estado = 'nacida' and c.descanso_hasta > now())
      ) order by co.orden) from cartas_corrales co), '[]'::jsonb),
    'especies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'carta', s.carta_id, 'habitat', s.habitat, 'horas', s.horas, 'descanso_horas', s.descanso_horas,
        'limite', c.limite,
        'libres', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'numero', e.numero) order by e.numero) from cartas_ejemplares e
                            where e.propietario = uid and e.carta_id = s.carta_id and e.estado = 'poseida'), '[]'::jsonb),
        'sobrepoblada', not cartas_i_hay_cupo(s.carta_id),
        'en_circulacion', c.en_circulacion
      ) order by s.habitat, c.rareza, s.carta_id)
      from cartas_cria_especies s join cartas_catalogo c on c.id = s.carta_id where s.activa), '[]'::jsonb));
end;
$$;

-- 4) Empezar una cría ------------------------------------------------------------------------------------------
create or replace function cartas_corral_iniciar(p_carta text, p_a uuid, p_b uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  esp cartas_cria_especies%rowtype;
  cat cartas_catalogo%rowtype;
  co cartas_corrales%rowtype;
  problema text;
  nueva uuid := gen_random_uuid();
  fases jsonb;
  total numeric;
  descanso timestamptz;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  if p_a is null or p_b is null or p_a = p_b then raise exception 'Hacen falta dos copias distintas de la misma criatura'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into esp from cartas_cria_especies where carta_id = p_carta and activa;
  if not found then raise exception 'Esta criatura no se puede criar'; end if;
  select * into cat from cartas_catalogo where id = p_carta;
  if cat.tipo <> 'Criatura' then raise exception 'Solo se crían criaturas'; end if;
  select * into co from cartas_corrales where habitat = esp.habitat;

  -- Las dos copias: tuyas, libres y de ESA criatura (con las filas bloqueadas)
  perform cartas_i_exigir(uid, array[p_a, p_b], 'poseida');
  if (select count(*) from cartas_ejemplares where id in (p_a, p_b) and carta_id = p_carta) <> 2 then
    raise exception 'Las dos copias tienen que ser de la misma criatura';
  end if;

  if not cat.en_circulacion then raise exception 'Esta criatura todavía no está en circulación'; end if;
  if exists (select 1 from cartas_crias where user_id = uid and habitat = esp.habitat and estado = 'en_curso') then
    raise exception 'El % ya tiene una pareja', lower(co.nombre);
  end if;
  select max(descanso_hasta) into descanso from cartas_crias where user_id = uid and habitat = esp.habitat and estado = 'nacida';
  if descanso is not null and descanso > now() then
    raise exception 'El % está descansando después del último nacimiento', lower(co.nombre);
  end if;
  if not cartas_i_hay_cupo(p_carta) then
    raise exception 'Sobrepoblación de la especie: hay que respetar el medio ambiente.';
  end if;
  problema := cartas_i_error_recibir(uid, p_carta, 1);
  if problema is not null then raise exception 'Ya tienes el máximo de esta criatura: no cabría la cría (%)', problema; end if;

  fases := jsonb_build_array(
    jsonb_build_object('nombre', co.fases ->> 0, 'horas', (esp.horas ->> 0)::numeric),
    jsonb_build_object('nombre', co.fases ->> 1, 'horas', (esp.horas ->> 1)::numeric),
    jsonb_build_object('nombre', co.fases ->> 2, 'horas', (esp.horas ->> 2)::numeric));
  total := (esp.horas ->> 0)::numeric + (esp.horas ->> 1)::numeric + (esp.horas ->> 2)::numeric;

  perform cartas_i_bloquear(array[p_a, p_b], 'cría', 'cria:' || nueva::text, null);
  insert into cartas_crias (id, user_id, carta_id, habitat, ejemplar_a, ejemplar_b, fases, inicio, fin)
  values (nueva, uid, p_carta, esp.habitat, p_a, p_b, fases, now(), now() + total * interval '1 hour');
  return jsonb_build_object('id', nueva, 'fin', now() + total * interval '1 hour', 'horas', total);
end;
$$;

-- 5) Recoger la cría ----------------------------------------------------------------------------------------------
create or replace function cartas_corral_recoger(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f cartas_crias%rowtype;
  esp cartas_cria_especies%rowtype;
  ref text;
  emision jsonb;
  descanso timestamptz;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into f from cartas_crias where id = p_id and user_id = uid for update;
  if not found or f.estado <> 'en_curso' then raise exception 'Esa cría ya no está en el corral'; end if;
  if f.fin > now() then raise exception 'Todavía no ha terminado: faltan unos minutos'; end if;
  ref := 'cria:' || p_id::text;

  -- Las dos copias tienen que seguir en el corral (retenidas por esta cría)
  begin
    perform cartas_i_exigir(uid, array[f.ejemplar_a, f.ejemplar_b], 'bloqueada', ref);
  exception when others then
    update cartas_crias set estado = 'cancelada', cerrada = now() where id = p_id;
    perform cartas_i_desbloquear(ref);
    return jsonb_build_object('resultado', 'cancelada', 'mensaje', 'Las dos criaturas ya no estaban en el corral: la cría se canceló.');
  end;
  perform cartas_i_desbloquear(ref);

  select * into esp from cartas_cria_especies where carta_id = f.carta_id;
  begin
    emision := cartas_i_emitir(uid, f.carta_id, 'cría en el corral', ref, null, false);
  exception when others then
    if sqlerrm like 'AGOTADA%' or sqlerrm like 'Esta carta no tiene límite%' or sqlerrm like 'El límite por jugador%' or sqlerrm like '%no está en circulación%' then
      update cartas_crias set estado = 'sin_cupo', cerrada = now() where id = p_id;
      return jsonb_build_object('resultado', 'sin-cupo',
        'mensaje', case when sqlerrm like 'El límite por jugador%' then 'Ya tienes el máximo de esta criatura: la cría no cabe en tu colección. Tus dos criaturas vuelven contigo.'
                        else 'Sobrepoblación de la especie: hay que respetar el medio ambiente. Tus dos criaturas vuelven contigo.' end);
    end if;
    raise;
  end;
  descanso := now() + coalesce(esp.descanso_horas, 12) * interval '1 hour';
  update cartas_crias set estado = 'nacida', cria_ejemplar = (emision ->> 'ejemplar')::uuid, cerrada = now(), descanso_hasta = descanso where id = p_id;
  insert into cartas_registro (user_id, carta_id, origen, detalle) values (uid, f.carta_id, 'juego', left(ref, 200));
  return jsonb_build_object('resultado', 'cria', 'carta', f.carta_id, 'numero', (emision ->> 'numero')::int, 'de_reserva', (emision ->> 'de_reserva')::boolean,
    'nombre', coalesce((select data ->> 'nombre' from cartas_definiciones where id = f.carta_id), f.carta_id), 'descanso_hasta', descanso);
end;
$$;

-- 6) Sacar a la pareja antes de tiempo (no nace nada) ---------------------------------------------------------------------
create or replace function cartas_corral_sacar(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  f cartas_crias%rowtype;
begin
  if uid is null then raise exception 'Hay que iniciar sesión'; end if;
  perform cartas_i_candado_jugador(uid);
  select * into f from cartas_crias where id = p_id and user_id = uid for update;
  if not found or f.estado <> 'en_curso' then raise exception 'Esa cría ya no está en el corral'; end if;
  update cartas_crias set estado = 'cancelada', cerrada = now() where id = p_id;
  perform cartas_i_desbloquear('cria:' || p_id::text);
end;
$$;

-- 7) Admin: ver y configurar las especies --------------------------------------------------------------------------------
create or replace function cartas_admin_crianza()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'corrales', coalesce((select jsonb_agg(to_jsonb(c) order by c.orden) from cartas_corrales c), '[]'::jsonb),
    'criaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'carta', c.id, 'nombre', coalesce(d.data ->> 'nombre', c.id), 'rareza', c.rareza, 'limite', c.limite, 'en_circulacion', c.en_circulacion,
        'configurada', s.carta_id is not null, 'habitat', coalesce(s.habitat, 'bosque'), 'horas', coalesce(s.horas, '[4, 12, 8]'::jsonb),
        'descanso_horas', coalesce(s.descanso_horas, 12), 'activa', coalesce(s.activa, false)
      ) order by coalesce(s.habitat, 'zzz'), c.rareza, c.id)
      from cartas_catalogo c left join cartas_definiciones d on d.id = c.id left join cartas_cria_especies s on s.carta_id = c.id
      where c.tipo = 'Criatura'), '[]'::jsonb),
    'en_curso', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'jugador', coalesce(p.username, '(sin nombre)'), 'carta', x.carta_id, 'habitat', x.habitat, 'inicio', x.inicio, 'fin', x.fin) order by x.fin)
      from cartas_crias x left join perfiles p on p.user_id = x.user_id where x.estado = 'en_curso'), '[]'::jsonb));
end;
$$;

create or replace function cartas_admin_guardar_cria(p_carta text, p_cfg jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h numeric;
  i int;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if not exists (select 1 from cartas_catalogo where id = p_carta and tipo = 'Criatura') then raise exception 'Solo se crían cartas de tipo Criatura'; end if;
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'Configuración inválida'; end if;
  if p_cfg ? 'habitat' and not exists (select 1 from cartas_corrales where habitat = p_cfg ->> 'habitat') then raise exception 'Ese corral no existe'; end if;
  if p_cfg ? 'horas' then
    if jsonb_typeof(p_cfg -> 'horas') <> 'array' or jsonb_array_length(p_cfg -> 'horas') <> 3 then raise exception 'Las horas son tres: cortejo, gestación y cría'; end if;
    for i in 0..2 loop
      if jsonb_typeof(p_cfg -> 'horas' -> i) <> 'number' or (p_cfg -> 'horas' ->> i)::numeric not between 0.01 and 720 then
        raise exception 'Cada fase dura entre 0,01 y 720 horas';
      end if;
    end loop;
  end if;
  if p_cfg ? 'descanso_horas' and (jsonb_typeof(p_cfg -> 'descanso_horas') <> 'number' or (p_cfg ->> 'descanso_horas')::numeric not between 0 and 720) then
    raise exception 'El descanso va de 0 a 720 horas';
  end if;
  insert into cartas_cria_especies (carta_id, habitat, horas, descanso_horas, activa)
  values (p_carta, coalesce(p_cfg ->> 'habitat', 'bosque'), coalesce(p_cfg -> 'horas', '[4, 12, 8]'::jsonb),
          coalesce((p_cfg ->> 'descanso_horas')::numeric, 12), coalesce((p_cfg ->> 'activa')::boolean, true))
  on conflict (carta_id) do update set
    habitat = coalesce(p_cfg ->> 'habitat', cartas_cria_especies.habitat),
    horas = coalesce(p_cfg -> 'horas', cartas_cria_especies.horas),
    descanso_horas = coalesce((p_cfg ->> 'descanso_horas')::numeric, cartas_cria_especies.descanso_horas),
    activa = coalesce((p_cfg ->> 'activa')::boolean, cartas_cria_especies.activa);
end;
$$;

-- 8) Los bloqueos de una cría que ya no existe se sueltan solos, como los de apuestas e intercambios
create or replace function cartas_i_liberar_huerfanos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  ref text;
  n int := 0;
begin
  for ref in
    select distinct b.referencia from cartas_bloqueos b
    where (b.referencia like 'apuesta:%' and not exists (
             select 1 from cartas_partidas p
             where 'apuesta:' || p.id::text = b.referencia and p.apuesta_estado in ('pendiente', 'activa')
               and p.estado in ('pendiente', 'en_curso', 'disputa')))
       or (b.referencia like 'trueque:%' and not exists (
             select 1 from cartas_intercambios t where 'trueque:' || t.id::text = b.referencia and t.estado = 'abierta'))
       or (b.referencia like 'cria:%' and not exists (
             select 1 from cartas_crias c where 'cria:' || c.id::text = b.referencia and c.estado = 'en_curso'))
  loop
    n := n + cartas_i_desbloquear(ref);
    insert into cartas_incidencias (tipo, referencia, detalle, resuelta)
    values ('bloqueo_huerfano_liberado', ref, 'Se soltaron las copias de un bloqueo cuya operación ya había terminado', now());
  end loop;
  return n;
end;
$$;
revoke all on function cartas_i_liberar_huerfanos() from public, anon, authenticated;

-- 9) Forja: cuando ya no se pueden crear más objetos del calibre pedido, falla sin consumir nada y lo dice claro
do $$
declare
  def text;
  nuevo text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'cartas_i_forjar_nucleo';
  if def is null then raise exception 'No existe cartas_i_forjar_nucleo'; end if;
  def := replace(def, chr(13), '');
  if position('No se pueden crear más objetos de este calibre' in def) > 0 then return; end if;
  nuevo := replace(def, 'No hay ninguna carta disponible que darte con esta receta ahora mismo. No se consumió nada.', 'No se pueden crear más objetos de este calibre. No se consumió nada.');
  if nuevo = def then raise exception 'No se encontró el mensaje de la forja'; end if;
  execute nuevo;
end;
$$;

-- 10) Permisos
revoke all on function cartas_corral_ver() from public, anon;
revoke all on function cartas_corral_iniciar(text, uuid, uuid) from public, anon;
revoke all on function cartas_corral_recoger(uuid) from public, anon;
revoke all on function cartas_corral_sacar(uuid) from public, anon;
revoke all on function cartas_admin_crianza() from public, anon;
revoke all on function cartas_admin_guardar_cria(text, jsonb) from public, anon;
grant execute on function cartas_corral_ver() to authenticated;
grant execute on function cartas_corral_iniciar(text, uuid, uuid) to authenticated;
grant execute on function cartas_corral_recoger(uuid) to authenticated;
grant execute on function cartas_corral_sacar(uuid) to authenticated;
grant execute on function cartas_admin_crianza() to authenticated;
grant execute on function cartas_admin_guardar_cria(text, jsonb) to authenticated;
