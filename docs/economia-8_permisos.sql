-- ECONOMÍA DE CARTAS, parte 8: permisos y datos de los jugadores (auditoría del 12 de octubre de 2026, A6, A7 y A10).
-- BORRADOR SIN APLICAR. Se prueba primero en una rama de pruebas (ver docs/economia-correcciones-plan.md).
-- Corre esto DESPUÉS de economia_7_integridad.sql. Se puede correr más de una vez.
--
--   A6  Solo el admin cambia los parámetros económicos de una carta existente (rareza, tipo, lado, disponibilidad para
--       recompensas y límite global). Un editor puede seguir editando el resto (nombre, texto, imagen, coste, ataque...).
--       Una carta NUEVA de un editor nace sin publicar, sin límite global y no ganable; un admin la revisa y la configura.
--       Un editor tampoco publica ni despublica cartas existentes (la disponibilidad es del admin).
--   A7  El Side no se puede cambiar una vez elegido (salvo el admin, que puede previsualizar ambos lados, como ya hace la
--       interfaz). El nombre de usuario es único sin distinguir mayúsculas.
--   A10 Menos permisos: ninguna función de cartas es ejecutable sin sesión (salvo las dos que usan las políticas y la
--       interfaz), las funciones internas no se llaman desde el navegador y las tablas de cartas no admiten escrituras
--       directas (nunca hubo políticas de escritura, así que no se rompe ningún flujo).

-- A6 ---------------------------------------------------------------------------------------------------------------
create or replace function cartas_guardar(p_id text, p_data jsonb, p_publicada boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_rareza text := p_data ->> 'rareza';
  v_tipo text := p_data ->> 'tipo';
  v_lado text[];
  v_limite int;
  v_obtenible boolean;
  v_afin text;
  v_max_numero int;
  v_imagen text := p_data ->> 'imagen';
  v_forma jsonb;
  v_es_admin boolean;
  v_previa cartas_catalogo%rowtype;
  v_existe boolean;
  v_ignorados text[] := '{}';
  v_publicada boolean := coalesce(p_publicada, true);
begin
  if uid is null or not cartas_puede_editar() then
    raise exception 'No autorizado';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,60}$' then
    raise exception 'El identificador solo admite minúsculas, números y guiones (hasta 60)';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or length(p_data::text) > 20000 then
    raise exception 'Datos de carta inválidos';
  end if;
  if coalesce(length(p_data ->> 'nombre'), 0) not between 1 and 60 then
    raise exception 'El nombre debe tener entre 1 y 60 letras';
  end if;
  if coalesce(length(p_data ->> 'epiteto'), 0) > 60 then
    raise exception 'El subtítulo es demasiado largo';
  end if;
  if v_tipo not in ('Personaje', 'Criatura', 'Entidad', 'Objeto', 'Acción', 'Terreno', 'Reacción') then
    raise exception 'Tipo de carta inválido';
  end if;
  if v_rareza not in ('comun', 'infrecuente', 'rara', 'legendaria', 'limitada') then
    raise exception 'Rareza inválida';
  end if;
  if jsonb_typeof(p_data -> 'afinidad') <> 'array' or jsonb_array_length(p_data -> 'afinidad') not between 1 and 2 then
    raise exception 'Elige una o dos afinidades';
  end if;
  for v_afin in select jsonb_array_elements_text(p_data -> 'afinidad') loop
    if v_afin not in ('juramento', 'sombra', 'carne', 'arcano', 'eternidad', 'caceria') then
      raise exception 'Afinidad inválida';
    end if;
  end loop;
  if jsonb_typeof(p_data -> 'coste') <> 'number' or (p_data ->> 'coste')::numeric not between 0 and 20 or (p_data ->> 'coste')::numeric <> floor((p_data ->> 'coste')::numeric) then
    raise exception 'El coste va de 0 a 20';
  end if;
  foreach v_afin in array array['atq', 'pv'] loop
    if p_data -> v_afin is not null and jsonb_typeof(p_data -> v_afin) <> 'null' then
      if jsonb_typeof(p_data -> v_afin) <> 'number' or (p_data ->> v_afin)::numeric not between 0 and 99 or (p_data ->> v_afin)::numeric <> floor((p_data ->> v_afin)::numeric) then
        raise exception 'Ataque y vida van de 0 a 99';
      end if;
    end if;
  end loop;
  if coalesce(jsonb_typeof(p_data -> 'atq') = 'number', false) <> coalesce(jsonb_typeof(p_data -> 'pv') = 'number', false) then
    raise exception 'Pon ataque y vida los dos, o ninguno';
  end if;
  if coalesce(length(p_data ->> 'habilidad'), 0) > 600 then
    raise exception 'Las reglas son demasiado largas (600 letras)';
  end if;
  if coalesce(length(p_data ->> 'descripcion'), 0) > 1500 then
    raise exception 'La descripción es demasiado larga (1500 letras)';
  end if;
  if v_imagen is not null and v_imagen !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cartas/[A-Za-z0-9/_.-]+$' then
    raise exception 'La imagen debe estar subida desde el editor';
  end if;
  if p_data ? 'formas' and jsonb_typeof(p_data -> 'formas') <> 'null' then
    if jsonb_typeof(p_data -> 'formas') <> 'array' or jsonb_array_length(p_data -> 'formas') > 7 then
      raise exception 'Una carta puede tener hasta 7 formas además de la base';
    end if;
    for v_forma in select value from jsonb_array_elements(p_data -> 'formas') loop
      if jsonb_typeof(v_forma) <> 'object' then
        raise exception 'Forma inválida';
      end if;
      if coalesce(length(v_forma ->> 'nombre'), 0) not between 1 and 40 then
        raise exception 'El nombre de cada forma debe tener entre 1 y 40 letras';
      end if;
      if (v_forma ->> 'imagen') is not null and (v_forma ->> 'imagen') !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/cartas/[A-Za-z0-9/_.-]+$' then
        raise exception 'La imagen de cada forma debe estar subida desde el editor';
      end if;
      if v_forma -> 'ajuste' is not null and jsonb_typeof(v_forma -> 'ajuste') <> 'null' then
        if jsonb_typeof(v_forma -> 'ajuste') <> 'object'
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'z'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'z')::numeric not between 1 and 3
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'x'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'x')::numeric not between 0 and 100
           or coalesce(jsonb_typeof(v_forma -> 'ajuste' -> 'y'), '') <> 'number' or (v_forma -> 'ajuste' ->> 'y')::numeric not between 0 and 100 then
          raise exception 'Encuadre de la foto de una forma inválido';
        end if;
      end if;
    end loop;
  end if;
  if p_data -> 'copiasMax' is not null and jsonb_typeof(p_data -> 'copiasMax') <> 'null' then
    if jsonb_typeof(p_data -> 'copiasMax') <> 'number' or (p_data ->> 'copiasMax')::numeric not between 1 and 3
       or (p_data ->> 'copiasMax')::numeric <> floor((p_data ->> 'copiasMax')::numeric) then
      raise exception 'Las copias por mazo van de 1 a 3';
    end if;
  end if;
  if p_data -> 'ajuste' is not null and jsonb_typeof(p_data -> 'ajuste') <> 'null' then
    if jsonb_typeof(p_data -> 'ajuste') <> 'object'
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'z'), '') <> 'number' or (p_data -> 'ajuste' ->> 'z')::numeric not between 1 and 3
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'x'), '') <> 'number' or (p_data -> 'ajuste' ->> 'x')::numeric not between 0 and 100
       or coalesce(jsonb_typeof(p_data -> 'ajuste' -> 'y'), '') <> 'number' or (p_data -> 'ajuste' ->> 'y')::numeric not between 0 and 100 then
      raise exception 'Encuadre de la foto inválido';
    end if;
  end if;
  if p_data ? 'fuente' and jsonb_typeof(p_data -> 'fuente') = 'object' then
    if (p_data -> 'fuente' ->> 'data') not in ('PERSONAJES', 'BESTIARIO', 'OBJETOS', 'LUGARES') or (p_data -> 'fuente' ->> 'id') !~ '^[a-z0-9-]{1,80}$' then
      raise exception 'Entrada del compendio inválida';
    end if;
  end if;

  if p_data -> 'lado' is null or jsonb_typeof(p_data -> 'lado') = 'null' then
    v_lado := null;
  else
    if jsonb_typeof(p_data -> 'lado') <> 'array' then raise exception 'Lado inválido'; end if;
    select array_agg(x) into v_lado from jsonb_array_elements_text(p_data -> 'lado') x;
    if exists (select 1 from unnest(v_lado) x where x not in ('A', 'B')) then
      raise exception 'Lado inválido';
    end if;
  end if;

  if p_data -> 'limite' is null or jsonb_typeof(p_data -> 'limite') = 'null' then
    v_limite := null;
  else
    if jsonb_typeof(p_data -> 'limite') <> 'number' or (p_data ->> 'limite')::numeric not between 1 and 999 then
      raise exception 'El límite de copias va de 1 a 999';
    end if;
    v_limite := (p_data ->> 'limite')::int;
    select coalesce(max(numero), 0) into v_max_numero from cartas_ejemplares where carta_id = p_id;
    if v_limite < v_max_numero then
      raise exception 'Ya se emitieron % copias de esta carta: el límite no puede ser menor', v_max_numero;
    end if;
  end if;

  v_obtenible := coalesce((p_data ->> 'obtenible')::boolean, true);

  -- A6: lo económico solo lo cambia el admin
  v_es_admin := fichas_es_admin();
  select * into v_previa from cartas_catalogo where id = p_id;
  v_existe := found;
  if not v_es_admin then
    if v_existe then
      if v_rareza is distinct from v_previa.rareza then v_ignorados := array_append(v_ignorados, 'rareza'); end if;
      if v_tipo is distinct from v_previa.tipo then v_ignorados := array_append(v_ignorados, 'tipo'); end if;
      if v_lado is distinct from v_previa.lado then v_ignorados := array_append(v_ignorados, 'lado'); end if;
      if v_limite is distinct from v_previa.limite then v_ignorados := array_append(v_ignorados, 'limite'); end if;
      if v_obtenible is distinct from v_previa.obtenible then v_ignorados := array_append(v_ignorados, 'obtenible'); end if;
      if v_publicada is distinct from v_previa.publicada then v_ignorados := array_append(v_ignorados, 'publicada'); end if;
      v_publicada := v_previa.publicada;
      v_rareza := v_previa.rareza; v_tipo := v_previa.tipo; v_lado := v_previa.lado;
      v_limite := v_previa.limite; v_obtenible := v_previa.obtenible;
    else
      -- Una carta nueva de un editor queda sin publicar, sin límite global y no obtenible hasta que un admin la revise y la configure
      if v_publicada then v_ignorados := array_append(v_ignorados, 'publicada'); end if;
      v_publicada := false;
      v_limite := null;
      v_obtenible := false;
    end if;
    p_data := p_data || jsonb_build_object('rareza', v_rareza, 'tipo', v_tipo, 'lado', to_jsonb(v_lado),
                                           'limite', to_jsonb(v_limite), 'obtenible', v_obtenible);
  end if;

  insert into cartas_catalogo (id, rareza, lado, obtenible, limite, publicada, tipo, copias_max)
  values (p_id, v_rareza, v_lado, v_obtenible, v_limite, v_publicada,
          v_tipo, (p_data ->> 'copiasMax')::int)
  on conflict (id) do update set
    rareza = excluded.rareza, lado = excluded.lado, obtenible = excluded.obtenible,
    limite = excluded.limite, publicada = excluded.publicada, tipo = excluded.tipo, copias_max = excluded.copias_max;

  insert into cartas_definiciones (id, data, actualizada, actualizada_por)
  values (p_id, p_data, now(), uid)
  on conflict (id) do update set data = excluded.data, actualizada = now(), actualizada_por = uid;

  return jsonb_build_object('id', p_id, 'publicada', v_publicada, 'ignorados', to_jsonb(v_ignorados));
end;
$$;
grant execute on function cartas_guardar(text, jsonb, boolean) to authenticated;

-- A7: Side permanente y nombre de usuario único -----------------------------------------------------------------------
-- Nombres repetidos que ya existieran: el más antiguo (por user_id) se queda con el suyo y los demás pasan a "nombre (2)",
-- "nombre (3)"... Hoy no hay ninguno, así que esto no cambia nada, pero así la migración nunca falla por datos viejos.
do $$
declare
  r record;
  n int;
begin
  for r in
    select user_id, username,
           row_number() over (partition by lower(btrim(username)) order by user_id) as pos
    from perfiles where username is not null and btrim(username) <> ''
  loop
    if r.pos > 1 then
      n := r.pos;
      while exists (select 1 from perfiles where lower(btrim(username)) = lower(btrim(r.username || ' (' || n || ')'))) loop
        n := n + 1;
      end loop;
      update perfiles set username = r.username || ' (' || n || ')' where user_id = r.user_id;
    end if;
  end loop;
end;
$$;

create unique index if not exists perfiles_username_unico on perfiles (lower(btrim(username)))
  where username is not null and btrim(username) <> '';

create or replace function perfiles_proteger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cambia_nombre boolean := new.username is not null;
begin
  if new.side is not null and new.side not in ('A', 'B') then
    raise exception 'Side inválido';
  end if;
  if tg_op = 'UPDATE' then
    if old.side is not null and new.side is distinct from old.side then
      -- El Side es permanente. Solo el admin puede cambiar el suyo (para previsualizar ambos lados) y quien trabaja con
      -- el rol de servicio o desde el editor SQL (sin sesión de jugador).
      if auth.uid() is not null and not fichas_es_admin() then
        raise exception 'El Side no se puede cambiar';
      end if;
    end if;
    cambia_nombre := new.username is not null and new.username is distinct from old.username;
  end if;
  if cambia_nombre then
    new.username := btrim(new.username);
    if new.username <> '' and char_length(new.username) not between 2 and 30 then
      raise exception 'El nombre de usuario debe tener entre 2 y 30 caracteres';
    end if;
    if new.username ~ '[[:cntrl:]]' then
      raise exception 'El nombre de usuario tiene caracteres no válidos';
    end if;
    if new.username <> '' and exists (select 1 from perfiles p where lower(btrim(p.username)) = lower(new.username) and p.user_id <> new.user_id) then
      raise exception 'Ese nombre de usuario ya está en uso';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function perfiles_proteger() from public, anon, authenticated;

drop trigger if exists perfiles_proteger_trg on perfiles;
create trigger perfiles_proteger_trg before insert or update on perfiles
  for each row execute function perfiles_proteger();

-- La política antigua permitía también DELETE: borrar el perfil y crearlo de nuevo con otro Side saltaba la protección
drop policy if exists "Cada quien lee y edita su propio perfil" on perfiles;
drop policy if exists "perfiles_select_propio" on perfiles;
drop policy if exists "perfiles_insert_propio" on perfiles;
drop policy if exists "perfiles_update_propio" on perfiles;
create policy "perfiles_select_propio" on perfiles for select to authenticated using (auth.uid() = user_id);
create policy "perfiles_insert_propio" on perfiles for insert to authenticated with check (auth.uid() = user_id);
create policy "perfiles_update_propio" on perfiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A10: funciones ----------------------------------------------------------------------------------------------------
do $$
declare
  f record;
begin
  for f in select p.oid::regprocedure as firma, p.proname
           from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'cartas\_%'
  loop
    execute format('revoke execute on function %s from public, anon', f.firma);
    -- internas: el navegador nunca las llama
    if f.proname like 'cartas\_i\_%' or f.proname like 'cartas\_trg\_%' or f.proname in ('cartas_sincronizar', 'cartas_ajuste', 'cartas_mazo_error') then
      execute format('revoke execute on function %s from authenticated', f.firma);
    end if;
  end loop;
end;
$$;
-- Las usan las políticas de lectura y la interfaz antes de iniciar sesión
grant execute on function cartas_puede_editar() to anon, authenticated;
grant execute on function cartas_es_editor() to anon, authenticated;

-- A10: tablas. Ninguna tabla de cartas tiene políticas de escritura, así que ningún flujo escribe directamente.
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'cartas\_%' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on table %I from anon, authenticated', t);
  end loop;
end;
$$;
revoke all on table perfiles from anon;
revoke delete, truncate, references, trigger on table perfiles from authenticated;
revoke insert, update, delete, truncate, references, trigger on table fichas_admins from anon, authenticated;
