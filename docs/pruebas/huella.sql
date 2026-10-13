-- Huella del estado de seguridad y de funciones de la economía de cartas (para comparar antes y después de una etapa o de una restauración).
-- No incluye las columnas ni las tablas nuevas que añaden las migraciones, que la restauración deja a propósito.
with t(n) as (select tablename from pg_tables where schemaname='public' and (tablename like 'cartas\_%' or tablename in ('perfiles','fichas_admins')) and tablename not in ('cartas_incidencias'))
select 'politicas' as cat, count(*) n, md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select tablename||':'||policyname||':'||cmd||':'||array_to_string(roles,',')||':'||coalesce(qual,'')||':'||coalesce(with_check,'') x from pg_policies where schemaname='public' and tablename in (select n from t) and not ('claude_lectura' = any(roles))) a
union all select 'restricciones', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select conrelid::regclass::text||':'||conname||':'||pg_get_constraintdef(oid) x from pg_constraint where connamespace='public'::regnamespace and conrelid::regclass::text in (select n from t)) a
union all select 'indices', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select indexdef x from pg_indexes where schemaname='public' and tablename in (select n from t)) a
union all select 'disparadores', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select pg_get_triggerdef(g.oid) x from pg_trigger g join pg_class c on c.oid=g.tgrelid where not g.tgisinternal and c.relnamespace='public'::regnamespace and c.relname in (select n from t)) a
union all select 'permisos_tablas', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select table_name||':'||grantee||':'||privilege_type x from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in (select n from t)) a
union all select 'permisos_funciones', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select p.proname||'('||pg_get_function_identity_arguments(p.oid)||'):'||has_function_privilege('anon',p.oid,'execute')||':'||has_function_privilege('authenticated',p.oid,'execute') x from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname like 'cartas\_%' or p.proname in ('fichas_es_admin', 'perfiles_proteger'))) a
union all select 'rls', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select c.relname||':'||c.relrowsecurity x from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r' and c.relname in (select n from t)) a
union all select 'funciones_texto', count(*), md5(coalesce(string_agg(x, E'\n' order by x), '')) from (
  select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')|'||md5(regexp_replace(replace(pg_get_functiondef(p.oid), E'\r', ''), '\s+', ' ', 'g')) x
  from pg_proc p where p.pronamespace='public'::regnamespace and (p.proname like 'cartas\_%' or p.proname in ('fichas_es_admin', 'perfiles_proteger'))) a
order by 1;
