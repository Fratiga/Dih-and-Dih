-- Música de fondo por página (la configura el Admin desde la propia página, botón ⚙ al lado del ♪).
-- Cada fila es una página (por ejemplo 'compendio.html') y su config en JSON:
--   { "lista": [rutas de canciones], "desdeCero": true, "mezclar": false, "volumen": 0.5,
--     "partida": { "lista": [...], "desdeCero": true, "mezclar": false, "volumen": 0.5 },
--     "continua": false }
-- "partida" es la lista que suena mientras hay una partida en marcha (solo en páginas de juegos).
-- "continua" (opcional, true/false): si es true la canción no cambia ni se interrumpe al empezar o terminar una partida (no hace falta tocar nada en esta tabla: la config es libre).
-- Corre esto en el SQL Editor de Supabase. Se puede correr más de una vez.

create table if not exists musica_paginas (
  pagina text primary key check (pagina ~ '^[a-z0-9-]{1,60}\.html$'),
  config jsonb not null,
  actualizada timestamptz not null default now(),
  actualizada_por uuid references auth.users(id) on delete set null
);

alter table musica_paginas enable row level security;

-- Todos leen: la música tiene que sonar para cualquiera que entre a la página
drop policy if exists "musica_paginas_select" on musica_paginas;
create policy "musica_paginas_select" on musica_paginas for select using (true);
-- Sin políticas de escritura: solo las funciones de abajo escriben.

create or replace function musica_pagina_guardar(p_pagina text, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  if p_pagina is null or p_pagina !~ '^[a-z0-9-]{1,60}\.html$' then
    raise exception 'Página inválida';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' or length(p_config::text) > 30000 then
    raise exception 'Configuración inválida';
  end if;
  if p_config ? 'lista' and jsonb_typeof(p_config -> 'lista') <> 'array' then
    raise exception 'La lista de canciones debe ser una lista';
  end if;
  if p_config ? 'lista' and jsonb_array_length(p_config -> 'lista') > 100 then
    raise exception 'Demasiadas canciones (máximo 100)';
  end if;
  if p_config ? 'partida' and jsonb_typeof(p_config -> 'partida') <> 'object' then
    raise exception 'La lista de partida es inválida';
  end if;

  insert into musica_paginas (pagina, config, actualizada, actualizada_por)
  values (p_pagina, p_config, now(), uid)
  on conflict (pagina) do update set config = excluded.config, actualizada = now(), actualizada_por = uid;
end;
$$;

-- Quita la música de una página (vuelve a lo que traía de fábrica)
create or replace function musica_pagina_quitar(p_pagina text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not fichas_es_admin() then
    raise exception 'No autorizado';
  end if;
  delete from musica_paginas where pagina = p_pagina;
end;
$$;

grant execute on function musica_pagina_guardar(text, jsonb) to authenticated;
grant execute on function musica_pagina_quitar(text) to authenticated;
