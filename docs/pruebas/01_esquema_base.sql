-- Esquema base de producción que necesita la economía de cartas (leído del catálogo de producción el 12 de octubre de 2026,
-- sin datos de jugadores). Después se cargan docs/economia-1 a economia-6 y por último las correcciones 7 a 9.

create sequence public.cartas_registro_id_seq;

create table public.cartas_catalogo (id text not null, rareza text not null, lado text[], obtenible boolean not null default true, limite integer, publicada boolean not null default true, tipo text, copias_max integer, limite_jugador integer);
create table public.cartas_coleccion (user_id uuid not null, carta_id text not null, cantidad integer not null default 0, primera_vez timestamp with time zone not null default now());
create table public.cartas_definiciones (id text not null, data jsonb not null, actualizada timestamp with time zone not null default now(), actualizada_por uuid);
create table public.cartas_editores (user_id uuid not null, desde timestamp with time zone not null default now());
create table public.cartas_mazos (id uuid not null default gen_random_uuid(), user_id uuid not null, nombre text not null, cartas jsonb not null, actualizado timestamp with time zone not null default now());
create table public.cartas_numeradas (carta_id text not null, numero integer not null, user_id uuid not null);
create table public.cartas_partidas (id uuid not null default gen_random_uuid(), j1 uuid not null, j2 uuid not null, nombre1 text not null default 'Anónimo'::text, nombre2 text not null default 'Anónimo'::text, estado text not null default 'pendiente'::text, mazo1 jsonb not null, mazo2 jsonb, cartas jsonb not null default '{}'::jsonb, semilla integer, primero smallint, acciones jsonb not null default '[]'::jsonb, turno uuid, resultado text, motivo text, creada timestamp with time zone not null default now(), actualizada timestamp with time zone not null default now(), apuesta1 uuid[] not null default '{}'::uuid[], apuesta2 uuid[] not null default '{}'::uuid[], apuesta1_info jsonb not null default '[]'::jsonb, apuesta2_info jsonb not null default '[]'::jsonb, apuesta_estado text, reporte1 text, reporte2 text, reportado timestamp with time zone);
create table public.cartas_registro (id bigint not null default nextval('cartas_registro_id_seq'::regclass), user_id uuid not null, carta_id text not null, origen text not null, detalle text not null default ''::text, por uuid, creado timestamp with time zone not null default now());
create table public.cartas_vinculos (id text not null, tipo text not null, data jsonb not null default '{}'::jsonb, borrado boolean not null default false, actualizada timestamp with time zone not null default now(), actualizada_por uuid);
create table public.fichas_admins (user_id uuid not null);
create table public.perfiles (user_id uuid not null default auth.uid(), side text, username text);

-- Funciones base (copiadas de producción)
CREATE OR REPLACE FUNCTION public.fichas_es_admin() RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
  select exists (select 1 from public.fichas_admins where user_id = auth.uid());
$function$;
CREATE OR REPLACE FUNCTION public.cartas_es_editor() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  select exists (select 1 from cartas_editores where user_id = auth.uid());
$function$;
CREATE OR REPLACE FUNCTION public.cartas_puede_editar() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  select fichas_es_admin() or exists (select 1 from cartas_editores where user_id = auth.uid());
$function$;
CREATE OR REPLACE FUNCTION public.cartas_aplanar_mazo(p_cartas jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $function$
  select coalesce(jsonb_agg(key), '[]'::jsonb)
  from jsonb_each(p_cartas), generate_series(1, (value #>> '{}')::int);
$function$;
CREATE OR REPLACE FUNCTION public.cartas_mazo_error(p_user uuid, p_cartas jsonb) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  total int := 0;
  fila record;
  cat cartas_catalogo%rowtype;
  tope int;
  posee int;
  lado_usuario text;
  es_editor boolean;
begin
  if p_cartas is null or jsonb_typeof(p_cartas) <> 'object' then
    return 'Mazo inválido';
  end if;
  select side into lado_usuario from perfiles where user_id = p_user;
  es_editor := exists (select 1 from fichas_admins where user_id = p_user)
            or exists (select 1 from cartas_editores where user_id = p_user);

  for fila in select key, value from jsonb_each(p_cartas) loop
    if jsonb_typeof(fila.value) <> 'number' or (fila.value #>> '{}')::numeric <> floor((fila.value #>> '{}')::numeric)
       or (fila.value #>> '{}')::numeric < 1 or (fila.value #>> '{}')::numeric > 3 then
      return 'Cantidad inválida';
    end if;
    total := total + (fila.value #>> '{}')::int;
    select * into cat from cartas_catalogo where id = fila.key;
    if not found then
      return 'La carta ' || fila.key || ' no existe';
    end if;
    if not cat.publicada and not es_editor then
      return 'La carta ' || fila.key || ' no está disponible';
    end if;
    if cat.lado is not null and not es_editor and (lado_usuario is null or not (lado_usuario = any(cat.lado))) then
      return 'La carta ' || fila.key || ' no es de tu lado';
    end if;
    tope := case
      when cat.copias_max is not null then least(cat.copias_max, 3)
      when cat.tipo = 'Personaje' then 1
      else case cat.rareza when 'rara' then 2 when 'legendaria' then 1 when 'limitada' then 1 else 3 end
    end;
    if (fila.value #>> '{}')::int > tope then
      return 'Demasiadas copias de ' || fila.key || ' (máximo ' || tope || ')';
    end if;
    if not es_editor then
      select cantidad into posee from cartas_coleccion where user_id = p_user and carta_id = fila.key;
      if coalesce(posee, 0) < (fila.value #>> '{}')::int then
        return 'No tienes suficientes copias de ' || fila.key;
      end if;
    end if;
  end loop;

  if total < 20 then return 'Faltan cartas: el mazo lleva al menos 20'; end if;
  if total > 30 then return 'Sobran cartas: el mazo lleva como máximo 30'; end if;
  return null;
end;
$function$;

-- Restricciones, índices y políticas
alter table public.fichas_admins add constraint fichas_admins_pkey PRIMARY KEY (user_id);
alter table public.fichas_admins add constraint fichas_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.perfiles add constraint perfiles_side_check CHECK ((side = ANY (ARRAY['A'::text, 'B'::text])));
alter table public.perfiles add constraint perfiles_pkey PRIMARY KEY (user_id);
alter table public.perfiles add constraint perfiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_catalogo add constraint cartas_catalogo_id_check CHECK ((id ~ '^[a-z0-9-]{1,60}$'::text));
alter table public.cartas_catalogo add constraint cartas_catalogo_rareza_check CHECK ((rareza = ANY (ARRAY['comun'::text, 'infrecuente'::text, 'rara'::text, 'legendaria'::text, 'limitada'::text])));
alter table public.cartas_catalogo add constraint cartas_catalogo_pkey PRIMARY KEY (id);
alter table public.cartas_coleccion add constraint cartas_coleccion_cantidad_check CHECK ((cantidad >= 0));
alter table public.cartas_coleccion add constraint cartas_coleccion_pkey PRIMARY KEY (user_id, carta_id);
alter table public.cartas_coleccion add constraint cartas_coleccion_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_coleccion add constraint cartas_coleccion_carta_id_fkey FOREIGN KEY (carta_id) REFERENCES cartas_catalogo(id);
alter table public.cartas_numeradas add constraint cartas_numeradas_pkey PRIMARY KEY (carta_id, numero);
alter table public.cartas_numeradas add constraint cartas_numeradas_carta_id_fkey FOREIGN KEY (carta_id) REFERENCES cartas_catalogo(id);
alter table public.cartas_numeradas add constraint cartas_numeradas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_registro add constraint cartas_registro_origen_check CHECK ((origen = ANY (ARRAY['juego'::text, 'admin'::text, 'quitada'::text])));
alter table public.cartas_registro add constraint cartas_registro_pkey PRIMARY KEY (id);
alter table public.cartas_registro add constraint cartas_registro_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_registro add constraint cartas_registro_carta_id_fkey FOREIGN KEY (carta_id) REFERENCES cartas_catalogo(id);
alter table public.cartas_definiciones add constraint cartas_definiciones_id_fkey FOREIGN KEY (id) REFERENCES cartas_catalogo(id) ON DELETE CASCADE;
alter table public.cartas_definiciones add constraint cartas_definiciones_actualizada_por_fkey FOREIGN KEY (actualizada_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.cartas_editores add constraint cartas_editores_pkey PRIMARY KEY (user_id);
alter table public.cartas_editores add constraint cartas_editores_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_definiciones add constraint cartas_definiciones_pkey PRIMARY KEY (id);
alter table public.cartas_mazos add constraint cartas_mazos_nombre_check CHECK (((char_length(nombre) >= 1) AND (char_length(nombre) <= 40)));
alter table public.cartas_mazos add constraint cartas_mazos_pkey PRIMARY KEY (id);
alter table public.cartas_mazos add constraint cartas_mazos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_partidas add constraint cartas_partidas_primero_check CHECK ((primero = ANY (ARRAY[0, 1])));
alter table public.cartas_partidas add constraint cartas_partidas_resultado_check CHECK ((resultado = ANY (ARRAY['j1'::text, 'j2'::text, 'empate'::text])));
alter table public.cartas_partidas add constraint cartas_partidas_check CHECK ((j1 <> j2));
alter table public.cartas_partidas add constraint cartas_partidas_pkey PRIMARY KEY (id);
alter table public.cartas_partidas add constraint cartas_partidas_j1_fkey FOREIGN KEY (j1) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_partidas add constraint cartas_partidas_j2_fkey FOREIGN KEY (j2) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cartas_vinculos add constraint cartas_vinculos_tipo_check CHECK ((tipo = ANY (ARRAY['circulo'::text, 'lazo'::text, 'rivalidad'::text])));
alter table public.cartas_vinculos add constraint cartas_vinculos_pkey PRIMARY KEY (id);
alter table public.cartas_vinculos add constraint cartas_vinculos_actualizada_por_fkey FOREIGN KEY (actualizada_por) REFERENCES auth.users(id) ON DELETE SET NULL;
alter table public.cartas_catalogo add constraint cartas_catalogo_limite_jugador_check CHECK (((limite_jugador IS NULL) OR ((limite_jugador >= 1) AND (limite_jugador <= 99))));
CREATE INDEX cartas_partidas_j1_idx ON public.cartas_partidas USING btree (j1);
CREATE INDEX cartas_partidas_j2_idx ON public.cartas_partidas USING btree (j2);
CREATE INDEX cartas_mazos_usuario_idx ON public.cartas_mazos USING btree (user_id);
CREATE INDEX cartas_registro_usuario_idx ON public.cartas_registro USING btree (user_id, creado DESC);

alter table public.cartas_catalogo enable row level security;
alter table public.cartas_coleccion enable row level security;
alter table public.cartas_definiciones enable row level security;
alter table public.cartas_editores enable row level security;
alter table public.cartas_mazos enable row level security;
alter table public.cartas_numeradas enable row level security;
alter table public.cartas_partidas enable row level security;
alter table public.cartas_registro enable row level security;
alter table public.cartas_vinculos enable row level security;
alter table public.fichas_admins enable row level security;
alter table public.perfiles enable row level security;

create policy cartas_catalogo_select on public.cartas_catalogo for SELECT to public using (true);
create policy cartas_coleccion_select on public.cartas_coleccion for SELECT to public using (((user_id = auth.uid()) OR fichas_es_admin()));
create policy cartas_definiciones_select on public.cartas_definiciones for SELECT to public using ((cartas_puede_editar() OR (EXISTS ( SELECT 1 FROM cartas_catalogo c WHERE ((c.id = cartas_definiciones.id) AND c.publicada)))));
create policy cartas_editores_select on public.cartas_editores for SELECT to public using (((user_id = auth.uid()) OR fichas_es_admin()));
create policy cartas_mazos_select on public.cartas_mazos for SELECT to public using ((user_id = auth.uid()));
create policy cartas_numeradas_select on public.cartas_numeradas for SELECT to public using (((user_id = auth.uid()) OR fichas_es_admin()));
create policy cartas_partidas_select on public.cartas_partidas for SELECT to public using (((auth.uid() = j1) OR (auth.uid() = j2)));
create policy cartas_registro_select on public.cartas_registro for SELECT to public using (((user_id = auth.uid()) OR fichas_es_admin()));
create policy cartas_vinculos_select on public.cartas_vinculos for SELECT to public using (true);
create policy "Cada quien lee y edita su propio perfil" on public.perfiles for ALL to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
