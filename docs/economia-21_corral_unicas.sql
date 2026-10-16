-- ECONOMÍA DE CARTAS, parte 21: las criaturas únicas no se crían.
--
-- Una pareja necesita dos copias, así que una criatura con límite global de 1 (Zraith, Draco, Guillotina, Kraken) no puede criarse: solo existe una
-- copia en el mundo. Aun así el corral dejaba empezar una cría si el jugador tenía dos copias (por ejemplo, dadas por el admin saltándose el
-- límite). Ahora el servidor la rechaza en esos dos casos:
--   * el límite global de la criatura es menor que 2 (nunca puede haber una pareja);
--   * ya existen más copias vivas que el límite (el mundo está por encima de lo permitido: primero hay que corregirlo).
-- Solo cambia cartas_corral_iniciar. Se puede repetir. Se corre en el SQL Editor de Supabase.

create or replace function public.cartas_corral_iniciar(p_carta text, p_a uuid, p_b uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  perform cartas_i_candado(p_carta);
  -- Una criatura única no tiene pareja posible, y un mundo con más copias que el límite no puede criar hasta que se corrija
  if cat.limite is not null and cat.limite < 2 then
    raise exception 'Es una criatura única: solo existe una copia en el mundo y una pareja necesita dos';
  end if;
  if cat.limite is not null and (select count(*) from cartas_ejemplares where carta_id = p_carta and estado <> 'destruida') > cat.limite then
    raise exception 'Hay más copias de esta criatura que su límite (%): no se puede criar hasta que se corrija', cat.limite;
  end if;
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
$function$;
