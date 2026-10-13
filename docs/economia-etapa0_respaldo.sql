-- ECONOMÍA DE CARTAS, etapa 0: copias recuperables y procedimiento de vuelta atrás. BORRADOR SIN APLICAR.
-- No cambia el comportamiento de nada: solo crea un esquema aparte (respaldo_economia_20261013) que PostgREST no expone
-- (nadie con sesión de navegador puede leerlo ni escribirlo) con dos funciones:
--
--   select respaldo_economia_20261013.tomar_copia('e1');    -- ANTES de cada etapa: guarda cómo está todo ahora
--   select respaldo_economia_20261013.restaurar('e1');      -- SI HACE FALTA: deja todo como estaba cuando se tomó esa copia
--
-- Qué guarda cada copia (con la etiqueta de la etapa):
--   * el texto exacto de TODAS las funciones de cartas (y fichas_es_admin) y sus permisos,
--   * las políticas, los permisos de tablas, las restricciones, los disparadores y los índices de las tablas de cartas,
--     perfiles y fichas_admins,
--   * una copia de los DATOS de esas tablas (hoy son pocas filas).
-- Qué hace restaurar (todo en una sola transacción: o queda todo o no cambia nada): vuelve a crear cada función con su texto y
-- sus permisos de entonces, borra las funciones y los disparadores que las migraciones añadieron, repone políticas, permisos de
-- tablas, restricciones e índices. NO borra las tablas ni las columnas que las migraciones añadieron (son inofensivas) y NO toca
-- los datos: las copias de datos están ahí para consultarlas o recuperar filas a mano.
-- Se prueba entera en local (docs/pruebas/t_recuperacion.sh) antes de usarla en producción.

create schema if not exists respaldo_economia_20261013;
revoke all on schema respaldo_economia_20261013 from public, anon, authenticated;

create or replace function respaldo_economia_20261013.tomar_copia(p_etapa text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s constant text := 'respaldo_economia_20261013';
  t text;
  n_datos int := 0;
begin
  if p_etapa !~ '^[a-z0-9_]{1,20}$' then raise exception 'Etapa inválida'; end if;
  if to_regclass(s || '.funciones_' || p_etapa) is not null then raise exception 'Ya existe una copia de la etapa %: usa otro nombre', p_etapa; end if;

  execute format($f$create table %I.%I as
    select p.oid::regprocedure::text as firma, p.proname::text as nombre, pg_get_functiondef(p.oid) as def,
           coalesce(p.proacl, acldefault('f', p.proowner))::text as acl, now() as copiado
    from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'cartas\_%%' or p.proname in ('fichas_es_admin', 'perfiles_proteger'))$f$, s, 'funciones_' || p_etapa);
  execute format($f$create table %I.%I as
    select tablename::text as tabla, policyname::text as nombre, permissive::text as permisiva, roles::text as roles, cmd::text as orden, qual, with_check
    from pg_policies where schemaname = 'public' and (tablename like 'cartas\_%%' or tablename in ('perfiles', 'fichas_admins'))$f$, s, 'politicas_' || p_etapa);
  execute format($f$create table %I.%I as
    select c.relname::text as tabla, coalesce(c.relacl, acldefault('r', c.relowner))::text as acl, c.relrowsecurity as rls
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and (c.relname like 'cartas\_%%' or c.relname in ('perfiles', 'fichas_admins'))$f$, s, 'tablas_' || p_etapa);
  execute format($f$create table %I.%I as
    select (conrelid::regclass)::text as tabla, conname::text as nombre, pg_get_constraintdef(oid) as def
    from pg_constraint where connamespace = 'public'::regnamespace and (conrelid::regclass)::text in
      (select tablename from pg_tables where schemaname = 'public' and (tablename like 'cartas\_%%' or tablename in ('perfiles', 'fichas_admins')))$f$, s, 'restricciones_' || p_etapa);
  execute format($f$create table %I.%I as
    select (g.tgrelid::regclass)::text as tabla, g.tgname::text as nombre, pg_get_triggerdef(g.oid) as def
    from pg_trigger g join pg_class c on c.oid = g.tgrelid
    where not g.tgisinternal and c.relnamespace = 'public'::regnamespace and (c.relname like 'cartas\_%%' or c.relname in ('perfiles', 'fichas_admins'))$f$, s, 'disparadores_' || p_etapa);
  execute format($f$create table %I.%I as
    select tablename::text as tabla, indexname::text as nombre, indexdef as def
    from pg_indexes where schemaname = 'public' and (tablename like 'cartas\_%%' or tablename in ('perfiles', 'fichas_admins'))$f$, s, 'indices_' || p_etapa);

  for t in select tablename from pg_tables where schemaname = 'public' and (tablename like 'cartas\_%' or tablename in ('perfiles', 'fichas_admins')) loop
    execute format('create table %I.%I as table public.%I', s, 'd_' || p_etapa || '_' || t, t);
    n_datos := n_datos + 1;
  end loop;
  return format('Copia %s tomada: %s funciones, %s tablas de datos', p_etapa,
                (select count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'cartas\_%' or p.proname in ('fichas_es_admin', 'perfiles_proteger'))), n_datos);
end;
$$;

create or replace function respaldo_economia_20261013.restaurar(p_etapa text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s constant text := 'respaldo_economia_20261013';
  f record;
  a record;
  x record;
  firmas text[];
  roles_ok text;
  cnt int;
  n_func int := 0; n_borradas int := 0; n_disp int := 0; n_pol int := 0; n_rest int := 0; n_ind int := 0;
begin
  if p_etapa !~ '^[a-z0-9_]{1,20}$' then raise exception 'Etapa inválida'; end if;
  if to_regclass(s || '.funciones_' || p_etapa) is null then raise exception 'No hay una copia de la etapa %', p_etapa; end if;

  -- 1) Funciones: cada una vuelve a su texto y a sus permisos de entonces
  for f in execute format('select * from %I.%I order by firma', s, 'funciones_' || p_etapa) loop
    execute f.def;
    execute format('revoke all on function %s from public, anon, authenticated', f.firma);
    for a in select * from aclexplode(f.acl::aclitem[]) where grantee = 0 or grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid) loop
      execute format('grant execute on function %s to %s', f.firma, case when a.grantee = 0 then 'public' else a.grantee::regrole::text end);
    end loop;
    n_func := n_func + 1;
  end loop;

  -- 2) Funciones que no existían entonces (las añadieron las migraciones): se borran
  execute format('select array_agg(firma) from %I.%I', s, 'funciones_' || p_etapa) into firmas;
  for x in select p.oid::regprocedure::text as firma from pg_proc p
           where p.pronamespace = 'public'::regnamespace and (p.proname like 'cartas\_%' or p.proname in ('fichas_es_admin', 'perfiles_proteger'))
             and not (p.oid::regprocedure::text = any (firmas)) loop
    execute format('drop function if exists %s cascade', x.firma);
    n_borradas := n_borradas + 1;
  end loop;

  -- 3) Disparadores: se quitan los que no había y se reponen los que faltan
  for x in select (g.tgrelid::regclass)::text as tabla, g.tgname::text as nombre from pg_trigger g join pg_class c on c.oid = g.tgrelid
           where not g.tgisinternal and c.relnamespace = 'public'::regnamespace and (c.relname like 'cartas\_%' or c.relname in ('perfiles', 'fichas_admins')) loop
    execute format('select count(*) from %I.%I where tabla = %L and nombre = %L', s, 'disparadores_' || p_etapa, x.tabla, x.nombre) into cnt;
    if cnt = 0 then
      execute format('drop trigger if exists %I on %s', x.nombre, x.tabla);
      n_disp := n_disp + 1;
    end if;
  end loop;
  for x in execute format('select * from %I.%I', s, 'disparadores_' || p_etapa) loop
    if not exists (select 1 from pg_trigger g where g.tgname = x.nombre and (g.tgrelid::regclass)::text = x.tabla) then
      execute x.def; n_disp := n_disp + 1;
    end if;
  end loop;

  -- 4) Políticas de las tablas que ya existían: se borran las de ahora y se reponen las de entonces (en la misma transacción)
  for x in execute format('select distinct tabla from %I.%I', s, 'tablas_' || p_etapa) loop
    for a in select policyname from pg_policies where schemaname = 'public' and tablename = x.tabla loop
      execute format('drop policy %I on public.%I', a.policyname, x.tabla);
    end loop;
  end loop;
  for x in execute format('select * from %I.%I', s, 'politicas_' || p_etapa) loop
    select string_agg(r, ', ') into roles_ok from unnest(string_to_array(trim(both '{}' from x.roles), ',')) r
      where r = 'public' or exists (select 1 from pg_roles where rolname = r);
    if roles_ok is null then continue; end if;
    execute format('create policy %I on public.%I as %s for %s to %s%s%s', x.nombre, x.tabla, x.permisiva, x.orden, roles_ok,
                   case when x.qual is not null then ' using (' || x.qual || ')' else '' end,
                   case when x.with_check is not null then ' with check (' || x.with_check || ')' else '' end);
    n_pol := n_pol + 1;
  end loop;

  -- 5) Permisos y seguridad por filas de las tablas
  for x in execute format('select * from %I.%I', s, 'tablas_' || p_etapa) loop
    execute format('revoke all on table public.%I from public, anon, authenticated', x.tabla);
    for a in select * from aclexplode(x.acl::aclitem[]) where grantee = 0 or grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid) loop
      execute format('grant %s on table public.%I to %s', a.privilege_type, x.tabla, case when a.grantee = 0 then 'public' else a.grantee::regrole::text end);
    end loop;
    execute format('alter table public.%I %s row level security', x.tabla, case when x.rls then 'enable' else 'disable' end);
  end loop;

  -- 6) Restricciones: las que no estaban se quitan; las que cambiaron o faltan se reponen como eran
  for x in execute format($q$select c.tabla, c.nombre, c.def from %I.%I c
                              where not exists (select 1 from pg_constraint k where k.connamespace = 'public'::regnamespace
                                                and (k.conrelid::regclass)::text = c.tabla and k.conname = c.nombre and pg_get_constraintdef(k.oid) = c.def)$q$, s, 'restricciones_' || p_etapa) loop
    execute format('alter table %s drop constraint if exists %I', x.tabla, x.nombre);
    execute format('alter table %s add constraint %I %s', x.tabla, x.nombre, x.def);
    n_rest := n_rest + 1;
  end loop;
  for x in execute format($q$select (k.conrelid::regclass)::text as tabla, k.conname::text as nombre from pg_constraint k
                              where k.connamespace = 'public'::regnamespace and (k.conrelid::regclass)::text in (select tabla from %I.%I)
                                and not exists (select 1 from %I.%I c where c.tabla = (k.conrelid::regclass)::text and c.nombre = k.conname)$q$,
                          s, 'tablas_' || p_etapa, s, 'restricciones_' || p_etapa) loop
    execute format('alter table %s drop constraint if exists %I', x.tabla, x.nombre);
    n_rest := n_rest + 1;
  end loop;

  -- 7) Índices que las migraciones añadieron sobre tablas que ya existían
  for x in execute format($q$select i.tablename::text as tabla, i.indexname::text as nombre from pg_indexes i
                              where i.schemaname = 'public' and i.tablename in (select tabla from %I.%I)
                                and not exists (select 1 from %I.%I c where c.tabla = i.tablename and c.nombre = i.indexname)
                                and not exists (select 1 from pg_constraint k where k.conname = i.indexname)$q$,
                          s, 'tablas_' || p_etapa, s, 'indices_' || p_etapa) loop
    execute format('drop index if exists public.%I', x.nombre);
    n_ind := n_ind + 1;
  end loop;

  return format('Restaurada la copia %s: %s funciones repuestas, %s borradas, %s disparadores repuestos, %s políticas, %s restricciones tocadas, %s índices quitados',
                p_etapa, n_func, n_borradas, n_disp, n_pol, n_rest, n_ind);
end;
$$;
