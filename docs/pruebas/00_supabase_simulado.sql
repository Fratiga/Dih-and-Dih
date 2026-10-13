-- Entorno de pruebas local (Postgres 17 en Docker). Simula lo mínimo de Supabase que usa la economía de cartas:
-- roles anon/authenticated, el esquema auth (usuarios y auth.uid() leyendo la sesión simulada) y los permisos por defecto
-- de Supabase sobre el esquema public (todo para anon y authenticated; lo que protege es RLS y los permisos que se quitan a mano).
-- No toca producción: corre solo en el contenedor "cartas-pruebas".

-- los roles son del clúster: se crean una sola vez
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

-- Como en Supabase: el usuario sale del JWT que el servidor deja en la variable request.jwt.claims
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claim.role', true), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
grant select on auth.users to service_role;
grant execute on function auth.uid() to anon, authenticated, service_role, public;
grant execute on function auth.role() to anon, authenticated, service_role, public;

-- Permisos por defecto de Supabase en public (los mismos que dejan "todo" en las tablas de producción)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
