-- ECONOMÍA DE CARTAS, parte 23: límites predeterminados al publicar una carta, y cartas «únicas».
-- Se puede correr más de una vez.
--
-- 1) Al marcar una carta como PUBLICADA, si no tiene límites, se le ponen los predeterminados (ajustes limite_global_defecto y
--    limite_jugador_defecto, que se cambian en Admin → Economía → Límites). Nunca pisa un límite que ya esté puesto y respeta lo ya emitido
--    (si la carta ya tiene más copias que el predeterminado, el global sube a lo emitido y el de por jugador a lo que ya tenga el que más tiene). Las legendarias nacen únicas (1 y 1) y las limitadas
--    con 1 por jugador. Las cartas ya publicadas no se tocan salvo con el botón «Poner el predeterminado a las publicadas sin límite global».
-- 2) «Única» (botón en la lista de límites): una sola copia en toda la página y una por jugador, y se pone en circulación. Solo es un atajo
--    sobre los límites de siempre; no hace falta nada nuevo en el servidor.
insert into cartas_economia_ajustes (clave, valor) values
  ('limite_global_defecto', '20'),
  ('limite_jugador_defecto', '4')
on conflict (clave) do nothing;

-- Los límites que le tocan a una carta que se publica (comparte regla el disparador y el botón de aplicar a las ya publicadas)
create or replace function cartas_i_limites_defecto(p_rareza text, p_limite int, p_limite_jugador int, p_emitidas int, p_max_jugador int default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g int := coalesce((cartas_ajuste('limite_global_defecto', '20'::jsonb))::text::int, 20);
  j int := coalesce((cartas_ajuste('limite_jugador_defecto', '4'::jsonb))::text::int, 4);
  lim int := p_limite;
  lj int := p_limite_jugador;
begin
  if lim is null then
    lim := greatest(case when p_rareza = 'legendaria' then 1 else g end, coalesce(p_emitidas, 0), 1);
  end if;
  if lj is null then
    lj := least(greatest(case when p_rareza in ('legendaria', 'limitada') then 1 else j end, coalesce(p_max_jugador, 0)), lim);
  end if;
  return jsonb_build_object('limite', lim, 'limite_jugador', lj);
end;
$$;
revoke all on function cartas_i_limites_defecto(text, int, int, int, int) from public, anon, authenticated;

create or replace function cartas_trg_publicar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
  emitidas int := 0;
  max_jugador int := 0;
begin
  if new.publicada and (tg_op = 'INSERT' or old.publicada is distinct from true) and (new.limite is null or new.limite_jugador is null) then
    if tg_op = 'UPDATE' then
      select coalesce(max(numero), 0) into emitidas from cartas_ejemplares where carta_id = new.id;
      select coalesce(max(n), 0) into max_jugador from (select count(*) n from cartas_ejemplares where carta_id = new.id and estado in ('poseida', 'bloqueada') group by propietario) x;
    end if;
    r := cartas_i_limites_defecto(new.rareza, new.limite, new.limite_jugador, emitidas, max_jugador);
    new.limite := (r ->> 'limite')::int;
    new.limite_jugador := (r ->> 'limite_jugador')::int;
  end if;
  return new;
end;
$$;
revoke all on function cartas_trg_publicar() from public, anon, authenticated;
drop trigger if exists cartas_catalogo_publicar on cartas_catalogo;
create trigger cartas_catalogo_publicar before insert or update of publicada on cartas_catalogo
  for each row execute function cartas_trg_publicar();

-- Los predeterminados en el panel
create or replace function cartas_admin_defectos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  return jsonb_build_object(
    'global', coalesce((cartas_ajuste('limite_global_defecto', '20'::jsonb))::text::int, 20),
    'jugador', coalesce((cartas_ajuste('limite_jugador_defecto', '4'::jsonb))::text::int, 4),
    'publicadas_sin_limite', (select count(*) from cartas_catalogo where publicada and limite is null));
end;
$$;

create or replace function cartas_admin_guardar_defectos(p_global int, p_jugador int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  if p_global is null or p_global not between 1 and 999 then raise exception 'El límite global predeterminado va de 1 a 999'; end if;
  if p_jugador is null or p_jugador not between 1 and 99 then raise exception 'El límite por jugador predeterminado va de 1 a 99'; end if;
  if p_jugador > p_global then raise exception 'Por jugador no puede ser mayor que el global'; end if;
  insert into cartas_economia_ajustes (clave, valor, actualizado) values ('limite_global_defecto', to_jsonb(p_global), now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
  insert into cartas_economia_ajustes (clave, valor, actualizado) values ('limite_jugador_defecto', to_jsonb(p_jugador), now())
    on conflict (clave) do update set valor = excluded.valor, actualizado = now();
end;
$$;

-- Poner el predeterminado a las ya publicadas que no tienen límite global (solo rellena lo que falta; nunca cambia un límite puesto)
create or replace function cartas_admin_aplicar_defectos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  f record;
  r jsonb;
  n int := 0;
  mj int;
begin
  if not fichas_es_admin() then raise exception 'No autorizado'; end if;
  for f in select c.id, c.rareza, c.limite, c.limite_jugador, coalesce((select max(numero) from cartas_ejemplares e where e.carta_id = c.id), 0) emitidas
           from cartas_catalogo c where c.publicada and c.limite is null order by c.id loop
    select coalesce(max(c), 0) into mj from (select count(*) c from cartas_ejemplares e where e.carta_id = f.id and e.estado in ('poseida', 'bloqueada') group by e.propietario) x;
    r := cartas_i_limites_defecto(f.rareza, f.limite, f.limite_jugador, f.emitidas, mj);
    update cartas_catalogo set limite = (r ->> 'limite')::int, limite_jugador = (r ->> 'limite_jugador')::int where id = f.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke all on function cartas_admin_defectos() from public, anon;
revoke all on function cartas_admin_guardar_defectos(int, int) from public, anon;
revoke all on function cartas_admin_aplicar_defectos() from public, anon;
grant execute on function cartas_admin_defectos() to authenticated;
grant execute on function cartas_admin_guardar_defectos(int, int) to authenticated;
grant execute on function cartas_admin_aplicar_defectos() to authenticated;
