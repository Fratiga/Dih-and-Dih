-- Tablero de juego (tablero.html), al estilo de Roll20: escenas, objetos, niebla, diario, chat con tiradas,
-- orden de turno, macros y gramola.
-- Corre esto en el SQL Editor de Supabase. Requiere fichas_es_admin() (panel-admin.sql) y la tabla perfiles.
-- Se puede correr más de una vez.
--
-- Quién puede qué:
--   - El GM (fichas_es_admin) ve y edita todo.
--   - Un jugador con sesión ve solo la escena que el GM mostró a los jugadores, y de ella nada de la capa del DJ.
--     Lo decide el servidor (RLS): lo de la capa del DJ, las notas del DJ y las tiradas secretas no llegan nunca
--     al navegador de un jugador.
--   - Un jugador mueve las fichas que controla, cambia sus barras si el GM se lo permite, dibuja y escribe texto
--     en la capa de fichas, y borra solo lo que dibujó él.
--   - Las tiradas se hacen en el servidor: nadie puede inventarse un resultado.

-- ============================================================ tablas
create table if not exists tablero_escenas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null default 'Escena' check (char_length(nombre) between 1 and 80),
  cuadricula jsonb not null default '{"tam": 70, "visible": true, "ajustar": true, "color": "#c0c0c0", "opacidad": 0.5, "pies": 5}'::jsonb,
  fondo text not null default '#ffffff' check (char_length(fondo) <= 20),
  niebla jsonb not null default '{"activa": false, "zonas": []}'::jsonb,
  orden int not null default 0,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now()
);
alter table tablero_escenas add column if not exists niebla jsonb not null default '{"activa": false, "zonas": []}'::jsonb;
alter table tablero_escenas add column if not exists miniatura text not null default '';
alter table tablero_escenas add column if not exists carpeta text not null default '';
-- Tamaño del lienzo en casillas (los mapas se encajan dentro) y el resto de la configuración de la página
alter table tablero_escenas add column if not exists ancho int not null default 40 check (ancho between 1 and 500);
alter table tablero_escenas add column if not exists alto int not null default 40 check (alto between 1 and 500);
alter table tablero_escenas add column if not exists opciones jsonb not null default '{}'::jsonb;   -- colorTablero, audio, ...
alter table tablero_escenas add column if not exists archivada boolean not null default false;

create table if not exists tablero_estado (
  id int primary key default 1 check (id = 1),
  escena_jugadores uuid references tablero_escenas(id) on delete set null,
  iniciativa jsonb not null default '{"lista": [], "turno": 0, "ronda": 1, "visible": false}'::jsonb,
  musica jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
alter table tablero_estado add column if not exists musica jsonb not null default '{}'::jsonb;
-- El DJ pausa el movimiento: ningún jugador mueve fichas hasta que lo quite
alter table tablero_estado add column if not exists pausa boolean not null default false;
-- Listas de la gramola y efectos del soundboard del DJ
alter table tablero_estado add column if not exists gramola jsonb not null default '{}'::jsonb;

insert into tablero_estado (id) values (1) on conflict (id) do nothing;

create table if not exists tablero_objetos (
  id uuid primary key default gen_random_uuid(),
  escena uuid not null references tablero_escenas(id) on delete cascade,
  capa text not null default 'fichas',
  tipo text not null default 'imagen',
  x double precision not null default 0,       -- centro del objeto
  y double precision not null default 0,
  ancho double precision not null default 70 check (ancho > 0),
  alto double precision not null default 70 check (alto > 0),
  rot double precision not null default 0,
  z bigint not null default 0,
  opacidad real not null default 1 check (opacidad between 0 and 1),
  bloqueado boolean not null default false,
  controladores uuid[] not null default '{}',  -- jugadores que pueden moverlo
  controlan_todos boolean not null default false,
  autor uuid default auth.uid() references auth.users(id) on delete set null,
  datos jsonb not null default '{}'::jsonb,    -- src, nombre, verNombre, barras, auras, color, texto, puntos...
  actualizado timestamptz not null default now()
);
alter table tablero_objetos add column if not exists controladores uuid[] not null default '{}';
alter table tablero_objetos add column if not exists controlan_todos boolean not null default false;
alter table tablero_objetos add column if not exists autor uuid default auth.uid() references auth.users(id) on delete set null;
alter table tablero_objetos drop constraint if exists tablero_objetos_capa_check;
alter table tablero_objetos add constraint tablero_objetos_capa_check check (capa in ('mapa', 'fichas', 'gm', 'delantero', 'luz'));
alter table tablero_objetos drop constraint if exists tablero_objetos_tipo_check;
alter table tablero_objetos add constraint tablero_objetos_tipo_check check (tipo in ('imagen', 'texto', 'forma', 'dibujo', 'pin', 'luz'));
create index if not exists tablero_objetos_escena on tablero_objetos (escena, z);

-- Notas del DJ de cada ficha (no las ve ningún jugador)
create table if not exists tablero_notas_gm (
  objeto uuid primary key references tablero_objetos(id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 5000)
);

-- Diario: personajes y notas (handouts). Cada entrada la ven todos, o solo los jugadores elegidos.
create table if not exists tablero_diario (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'personaje' check (tipo in ('personaje', 'nota')),
  nombre text not null default 'Nuevo' check (char_length(nombre) between 1 and 80),
  imagen text not null default '' check (char_length(imagen) <= 1000),
  texto text not null default '' check (char_length(texto) <= 20000),
  carpeta text not null default '' check (char_length(carpeta) <= 60),
  orden int not null default 0,
  ver_todos boolean not null default false,
  ver uuid[] not null default '{}',
  controladores uuid[] not null default '{}',
  ficha uuid,                                  -- ficha de fichas_personajes que representa (si es un personaje jugador)
  etiquetas text[] not null default '{}',
  archivado boolean not null default false,
  grupo boolean not null default false,        -- miembro del grupo
  token jsonb,                                 -- token predeterminado: {ancho, alto, datos}
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
alter table tablero_diario add column if not exists etiquetas text[] not null default '{}';
alter table tablero_diario add column if not exists archivado boolean not null default false;
alter table tablero_diario add column if not exists grupo boolean not null default false;
alter table tablero_diario add column if not exists token jsonb;
create table if not exists tablero_diario_gm (
  diario uuid primary key references tablero_diario(id) on delete cascade,
  texto text not null default '' check (char_length(texto) <= 20000)
);

create table if not exists tablero_mensajes (
  id bigint generated always as identity primary key,
  autor uuid default auth.uid() references auth.users(id) on delete set null,
  nombre text not null,
  avatar text not null default '',
  texto text not null default '' check (char_length(texto) <= 1000),
  tirada jsonb,
  modo text not null default 'todos' check (modo in ('todos', 'dj', 'secreta', 'susurro')),
  para uuid[],                                 -- destinatarios de un susurro
  creado timestamptz not null default now()
);
alter table tablero_mensajes add column if not exists avatar text not null default '';
alter table tablero_mensajes add column if not exists modo text not null default 'todos';
alter table tablero_mensajes add column if not exists para uuid[];
create index if not exists tablero_mensajes_creado on tablero_mensajes (creado desc);

-- Arte subido por el GM (la biblioteca de la pestaña Arte)
create table if not exists tablero_arte (
  id uuid primary key default gen_random_uuid(),
  src text not null check (char_length(src) <= 1000),
  nombre text not null default '' check (char_length(nombre) <= 120),
  creado timestamptz not null default now()
);

-- Macros de cada jugador (la barra de macros de abajo)
create table if not exists tablero_macros (
  id uuid primary key default gen_random_uuid(),
  autor uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  texto text not null default '' check (char_length(texto) <= 2000),
  en_barra boolean not null default true,
  orden int not null default 0
);

alter table tablero_escenas enable row level security;
alter table tablero_estado enable row level security;
alter table tablero_objetos enable row level security;
alter table tablero_notas_gm enable row level security;
alter table tablero_diario enable row level security;
alter table tablero_diario_gm enable row level security;
alter table tablero_mensajes enable row level security;
alter table tablero_macros enable row level security;
alter table tablero_arte enable row level security;

-- ============================================================ políticas
-- La escena que ven los jugadores (sin pasar por RLS, para usarla dentro de las políticas)
create or replace function tablero_escena_jugadores()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select escena_jugadores from tablero_estado where id = 1
$$;

-- La escena que pueden ver los jugadores: la página donde el GM los puso a todos (solo el GM navega entre páginas)
create or replace function tablero_escena_visible(p_escena uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_escena is not null and p_escena = (select escena_jugadores from tablero_estado where id = 1)
$$;

drop policy if exists "tablero_escenas_ver" on tablero_escenas;
create policy "tablero_escenas_ver" on tablero_escenas
  for select using (fichas_es_admin() or (auth.uid() is not null and tablero_escena_visible(id)));
drop policy if exists "tablero_escenas_gm" on tablero_escenas;
create policy "tablero_escenas_gm" on tablero_escenas
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_estado_ver" on tablero_estado;
create policy "tablero_estado_ver" on tablero_estado
  for select using (auth.uid() is not null);
drop policy if exists "tablero_estado_gm" on tablero_estado;
create policy "tablero_estado_gm" on tablero_estado
  for update using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_objetos_ver" on tablero_objetos;
create policy "tablero_objetos_ver" on tablero_objetos
  for select using (fichas_es_admin() or (auth.uid() is not null and capa <> 'gm' and tablero_escena_visible(escena)));
drop policy if exists "tablero_objetos_gm" on tablero_objetos;
create policy "tablero_objetos_gm" on tablero_objetos
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_notas_gm_gm" on tablero_notas_gm;
create policy "tablero_notas_gm_gm" on tablero_notas_gm
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_diario_ver" on tablero_diario;
create policy "tablero_diario_ver" on tablero_diario
  for select using (fichas_es_admin() or (auth.uid() is not null and (ver_todos or auth.uid() = any(ver) or auth.uid() = any(controladores))));
drop policy if exists "tablero_diario_gm" on tablero_diario;
create policy "tablero_diario_gm" on tablero_diario
  for all using (fichas_es_admin()) with check (fichas_es_admin());
drop policy if exists "tablero_diario_gm_gm" on tablero_diario_gm;
create policy "tablero_diario_gm_gm" on tablero_diario_gm
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_mensajes_ver" on tablero_mensajes;
create policy "tablero_mensajes_ver" on tablero_mensajes
  for select using (fichas_es_admin() or (auth.uid() is not null and (
    modo = 'todos'
    or (modo in ('dj', 'susurro') and autor = auth.uid())
    or (modo = 'susurro' and auth.uid() = any(para)))));
drop policy if exists "tablero_mensajes_gm_borrar" on tablero_mensajes;
create policy "tablero_mensajes_gm_borrar" on tablero_mensajes
  for delete using (fichas_es_admin());

drop policy if exists "tablero_arte_gm" on tablero_arte;
create policy "tablero_arte_gm" on tablero_arte
  for all using (fichas_es_admin()) with check (fichas_es_admin());

drop policy if exists "tablero_macros_propias" on tablero_macros;
create policy "tablero_macros_propias" on tablero_macros
  for all using (autor = auth.uid()) with check (autor = auth.uid());

-- ============================================================ funciones
-- Nombre de quien escribe o tira (su nombre de usuario del compendio)
create or replace function tablero_i_nombre()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(btrim((select username from perfiles where user_id = auth.uid())), ''), 'Jugador')
$$;

-- Hablar como un personaje del diario: el GM como cualquiera, un jugador solo como los que controla.
create or replace function tablero_i_como(p_como uuid, out nombre text, out avatar text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_como is null then
    nombre := tablero_i_nombre();
    avatar := coalesce((select p.avatar from tablero_perfil p where p.uid = auth.uid()), '');
    return;
  end if;
  select d.nombre, d.imagen into nombre, avatar from tablero_diario d
  where d.id = p_como and d.tipo = 'personaje' and (fichas_es_admin() or auth.uid() = any(d.controladores));
  if not found then raise exception 'No puedes hablar como ese personaje.'; end if;
end;
$$;

-- Un jugador mueve una ficha que controla. El GM mueve cualquier cosa (también directamente sobre la tabla).
create or replace function tablero_mover(p_id uuid, p_x double precision, p_y double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para mover fichas.'; end if;
  if p_x is null or p_y is null or abs(p_x) > 1000000 or abs(p_y) > 1000000 then raise exception 'Posición no válida.'; end if;
  if not fichas_es_admin() and coalesce((select pausa from tablero_estado where id = 1), false) then
    raise exception 'El DJ ha pausado el movimiento.';
  end if;
  update tablero_objetos o set x = p_x, y = p_y, actualizado = now()
  where o.id = p_id
    and (fichas_es_admin() or ((o.controlan_todos or auth.uid() = any(o.controladores))
      and o.capa = 'fichas' and not o.bloqueado and tablero_escena_visible(o.escena)));
  if not found then raise exception 'No puedes mover esa ficha.'; end if;
end;
$$;

-- Cambiar una barra (1, 2 o 3) de una ficha: el GM siempre; un jugador si controla la ficha y la barra se puede editar.
create or replace function tablero_barra(p_id uuid, p_n int, p_valor numeric, p_max numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o tablero_objetos;
  b jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if p_n not between 1 and 3 or abs(coalesce(p_valor, 0)) > 1000000 or abs(coalesce(p_max, 0)) > 1000000 then raise exception 'Valor no válido.'; end if;
  select * into o from tablero_objetos where id = p_id for update;
  if not found then raise exception 'Esa ficha no existe.'; end if;
  b := coalesce(o.datos -> 'barras' -> (p_n - 1), '{}'::jsonb);
  if not (fichas_es_admin() or ((o.controlan_todos or auth.uid() = any(o.controladores)) and o.capa = 'fichas'
          and tablero_escena_visible(o.escena) and coalesce((b ->> 'editar')::boolean, false))) then
    raise exception 'No puedes cambiar esa barra.';
  end if;
  b := b || jsonb_build_object('valor', p_valor, 'max', p_max);
  update tablero_objetos set
    datos = jsonb_set(case when jsonb_typeof(datos -> 'barras') = 'array' then datos
                           else jsonb_set(datos, '{barras}', '[{}, {}, {}]'::jsonb) end,
                      array['barras', (p_n - 1)::text], b),
    actualizado = now()
  where id = p_id;
end;
$$;

-- Un jugador dibuja o escribe en la capa de fichas de la escena de los jugadores.
drop function if exists tablero_crear_propio(text, double precision, double precision, double precision, double precision, jsonb);
create or replace function tablero_crear_propio(p_escena uuid, p_tipo text, p_x double precision, p_y double precision,
  p_ancho double precision, p_alto double precision, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_escena uuid := p_escena;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if p_tipo not in ('dibujo', 'texto') then raise exception 'Solo puedes dibujar o escribir.'; end if;
  if not tablero_escena_visible(v_escena) then raise exception 'No puedes dibujar en esa escena.'; end if;
  if abs(p_x) > 1000000 or abs(p_y) > 1000000 or p_ancho <= 0 or p_alto <= 0 or p_ancho > 100000 or p_alto > 100000 then raise exception 'Tamaño no válido.'; end if;
  if char_length(coalesce(p_datos, '{}'::jsonb)::text) > 40000 then raise exception 'Dibujo demasiado grande.'; end if;
  if (select count(*) from tablero_objetos where escena = v_escena and autor = auth.uid()) >= 300 then
    raise exception 'Has llegado al máximo de dibujos en esta escena. Borra alguno.';
  end if;
  insert into tablero_objetos (escena, capa, tipo, x, y, ancho, alto, z, controladores, autor, datos)
  values (v_escena, 'fichas', p_tipo, p_x, p_y, p_ancho, p_alto,
          coalesce((select max(z) from tablero_objetos where escena = v_escena), 0) + 1,
          array[auth.uid()], auth.uid(), coalesce(p_datos, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

-- Un jugador borra lo que dibujó o escribió él.
create or replace function tablero_borrar_propio(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  delete from tablero_objetos
  where id = any(p_ids) and autor = auth.uid() and tipo in ('dibujo', 'texto') and tablero_escena_visible(escena);
  get diagnostics n = row_count;
  return n;
end;
$$;

/* Tira una expresión de dados en el servidor, con la sintaxis de Roll20 más usada:
   1d20+5, 2d6+1d4-1, 2d20kh1 (ventaja), 2d20kl1 (desventaja), 4d6kh3, 3d6>4 (éxitos), 4df (dados Fudge),
   1d6! (explota), 1d6!! (se acumula), 1d6!p (penetra). Devuelve {expr, total, partes}. */
create or replace function tablero_i_tirar(p_expr text)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  v text := lower(regexp_replace(coalesce(p_expr, ''), '\s+', '', 'g'));
  termino text := '([0-9]*d([0-9]+|f)(!!|!p|!)?(k[hl][0-9]+)?([<>][0-9]+)?|[0-9]+)';
  m text[];
  signo int;
  n int;
  caras int;
  fudge boolean;
  explota text;
  modo text;
  k int;
  comp text;
  objetivo int;
  valores int[];
  extra boolean[];
  orden int[];
  usados boolean[];
  r int;
  acc int;
  suma int;
  total int := 0;
  dados int := 0;
  partes jsonb := '[]'::jsonb;
  i int;
begin
  if v = '' or char_length(v) > 80 or v !~ ('^[+-]?' || termino || '([+-]' || termino || ')*$') then
    raise exception 'Tirada no válida. Usa algo como 1d20+5, 2d6+3 o 2d20kh1.';
  end if;
  for m in select regexp_matches(v, '([+-]?)([0-9]*)d([0-9]+|f)(!!|!p|!)?(?:k([hl])([0-9]+))?(?:([<>])([0-9]+))?|([+-]?)([0-9]+)', 'g') loop
    if m[3] is not null then
      signo := case when m[1] = '-' then -1 else 1 end;
      n := coalesce(nullif(m[2], ''), '1')::int;
      fudge := m[3] = 'f';
      caras := case when fudge then 3 else m[3]::int end;
      explota := m[4];
      modo := m[5];
      k := coalesce(nullif(m[6], ''), '0')::int;
      comp := m[7];
      objetivo := nullif(m[8], '')::int;
      if n < 1 or n > 100 or (not fudge and (caras < 2 or caras > 1000)) then raise exception 'Entre 1 y 100 dados de 2 a 1000 caras.'; end if;
      if fudge and explota is not null then raise exception 'Los dados Fudge no explotan.'; end if;
      valores := '{}'; extra := '{}';
      for i in 1 .. n loop
        r := case when fudge then floor(random() * 3)::int - 1 else floor(random() * caras)::int + 1 end;
        dados := dados + 1;
        if explota = '!!' then
          acc := r;
          while r = caras and dados < 200 loop r := floor(random() * caras)::int + 1; dados := dados + 1; acc := acc + r; end loop;
          valores := valores || acc; extra := extra || false;
        else
          valores := valores || r; extra := extra || false;
          while explota in ('!', '!p') and r = caras and dados < 200 loop
            r := floor(random() * caras)::int + 1; dados := dados + 1;
            valores := valores || (case when explota = '!p' then r - 1 else r end); extra := extra || true;
          end loop;
        end if;
      end loop;
      if dados > 200 then raise exception 'Demasiados dados.'; end if;
      usados := array_fill(true, array[array_length(valores, 1)]);
      if modo is not null then
        if k < 1 or k > array_length(valores, 1) then raise exception 'Te quedas con más dados de los que tiras.'; end if;
        select array_agg(p order by case when modo = 'h' then -valores[p] else valores[p] end, p) into orden from generate_subscripts(valores, 1) p;
        usados := array_fill(false, array[array_length(valores, 1)]);
        for i in 1 .. k loop usados[orden[i]] := true; end loop;
      end if;
      suma := 0;
      for i in 1 .. array_length(valores, 1) loop
        if usados[i] then
          if comp is null then suma := suma + valores[i];
          elsif (comp = '>' and valores[i] >= objetivo) or (comp = '<' and valores[i] <= objetivo) then suma := suma + 1;
          end if;
        end if;
      end loop;
      total := total + signo * suma;
      partes := partes || jsonb_build_object('tipo', 'dados', 'signo', signo, 'n', n, 'caras', case when fudge then 'f' else caras::text end,
        'explota', explota, 'guardar', case when modo is null then null else modo || k end,
        'exito', case when comp is null then null else comp || objetivo end,
        'valores', to_jsonb(valores), 'extra', to_jsonb(extra), 'usados', to_jsonb(usados), 'suma', signo * suma);
    else
      signo := case when m[9] = '-' then -1 else 1 end;
      total := total + signo * m[10]::int;
      partes := partes || jsonb_build_object('tipo', 'numero', 'valor', signo * m[10]::int);
    end if;
  end loop;
  if dados > 200 then raise exception 'Demasiados dados.'; end if;
  return jsonb_build_object('expr', v, 'total', total, 'partes', partes);
end;
$$;

-- p_modo: 'todos' (público), 'dj' (lo ven el GM y quien tira), 'secreta' (solo el GM)
create or replace function tablero_tirar(p_expr text, p_etiqueta text default '', p_modo text default 'todos', p_como uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t jsonb;
  c record;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para tirar.'; end if;
  if coalesce(p_modo, 'todos') not in ('todos', 'dj', 'secreta') then raise exception 'Modo no válido.'; end if;
  select * into c from tablero_i_como(p_como);
  t := tablero_i_tirar(p_expr) || jsonb_build_object('etiqueta', left(btrim(coalesce(p_etiqueta, '')), 60));
  insert into tablero_mensajes (autor, nombre, avatar, texto, tirada, modo)
  values (auth.uid(), c.nombre, coalesce(c.avatar, ''), '', t, coalesce(p_modo, 'todos'));
  return case when p_modo = 'secreta' and not fichas_es_admin() then jsonb_build_object('secreta', true) else t end;
end;
$$;

/* Escribe en el chat. Las tiradas en línea [[1d20+5]] se resuelven en el servidor y quedan en tirada.enlinea;
   en el texto cada una se cambia por ⟦0⟧, ⟦1⟧... p_modo: 'todos', 'dj' (/w gm) o 'susurro' (p_para: nombre
   de usuario o de personaje del diario). */
create or replace function tablero_decir(p_texto text, p_modo text default 'todos', p_para text default null, p_como uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v text := left(btrim(coalesce(p_texto, '')), 1000);
  c record;
  m text[];
  enlinea jsonb := '[]'::jsonb;
  i int := 0;
  destinos uuid[];
begin
  if auth.uid() is null then raise exception 'Inicia sesión para escribir.'; end if;
  if v = '' then return; end if;
  if coalesce(p_modo, 'todos') not in ('todos', 'dj', 'susurro') then raise exception 'Modo no válido.'; end if;
  if p_modo = 'susurro' then
    select array_agg(distinct u) into destinos from (
      select user_id u from perfiles where lower(btrim(username)) = lower(btrim(p_para))
      union all
      select unnest(controladores) from tablero_diario where tipo = 'personaje' and lower(btrim(nombre)) = lower(btrim(p_para))
    ) q;
    if destinos is null then raise exception 'No encuentro a "%".', p_para; end if;
  end if;
  select * into c from tablero_i_como(p_como);
  for m in select regexp_matches(v, '\[\[([^\]]{1,80})\]\]', 'g') loop
    exit when i >= 10;
    enlinea := enlinea || tablero_i_tirar(m[1]);
    v := regexp_replace(v, '\[\[' || regexp_replace(m[1], '([.+*?^$()\[\]{}|\\])', '\\\1', 'g') || '\]\]', '⟦' || i || '⟧');
    i := i + 1;
  end loop;
  insert into tablero_mensajes (autor, nombre, avatar, texto, tirada, modo, para)
  values (auth.uid(), c.nombre, coalesce(c.avatar, ''), v,
          case when i > 0 then jsonb_build_object('enlinea', enlinea) else null end,
          coalesce(p_modo, 'todos'), destinos);
end;
$$;

-- Tira 1d20 + modificador por una ficha y la pone (o la cambia) en el orden de turno. El jugador solo por las suyas.
create or replace function tablero_tirar_iniciativa(p_objeto uuid, p_mod int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o tablero_objetos;
  t jsonb;
  v_nombre text;
  v_total int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para tirar.'; end if;
  select * into o from tablero_objetos where id = p_objeto;
  if not found or not (fichas_es_admin() or ((o.controlan_todos or auth.uid() = any(o.controladores)) and o.capa = 'fichas' and tablero_escena_visible(o.escena))) then
    raise exception 'Esa ficha no es tuya.';
  end if;
  if abs(coalesce(p_mod, 0)) > 50 then raise exception 'Modificador no válido.'; end if;
  t := tablero_i_tirar('1d20' || case when coalesce(p_mod, 0) >= 0 then '+' else '' end || coalesce(p_mod, 0)::text);
  v_nombre := coalesce(nullif(btrim(o.datos ->> 'nombre'), ''), 'Ficha');
  v_total := (t ->> 'total')::int;
  t := t || jsonb_build_object('etiqueta', 'Iniciativa de ' || left(v_nombre, 40));
  insert into tablero_mensajes (autor, nombre, texto, tirada, modo)
  values (auth.uid(), tablero_i_nombre(), '', t, case when o.capa = 'gm' then 'secreta' else 'todos' end);
  update tablero_estado set
    iniciativa = jsonb_set(coalesce(iniciativa, '{}'::jsonb), '{lista}', (
      select coalesce(jsonb_agg(q.e order by (q.e ->> 'valor')::numeric desc), '[]'::jsonb) from (
        select e from jsonb_array_elements(coalesce(iniciativa -> 'lista', '[]'::jsonb)) e where e ->> 'id' is distinct from p_objeto::text
        union all
        select jsonb_build_object('id', p_objeto, 'nombre', v_nombre, 'valor', v_total, 'oculto', o.capa = 'gm', 'src', coalesce(o.datos ->> 'src', ''))
      ) q(e))),
    actualizado = now()
  where id = 1;
  return t;
end;
$$;

-- El jugador cambia el número de iniciativa de una ficha suya (el GM cambia cualquier cosa directamente).
create or replace function tablero_iniciativa_valor(p_objeto uuid, p_valor numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ini jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if p_valor is null or abs(p_valor) > 1000 then raise exception 'Valor no válido.'; end if;
  if not (fichas_es_admin() or exists (select 1 from tablero_objetos o where o.id = p_objeto
          and (o.controlan_todos or auth.uid() = any(o.controladores)) and tablero_escena_visible(o.escena))) then
    raise exception 'Esa ficha no es tuya.';
  end if;
  select iniciativa into ini from tablero_estado where id = 1 for update;
  if not exists (select 1 from jsonb_array_elements(coalesce(ini -> 'lista', '[]'::jsonb)) e where e ->> 'id' = p_objeto::text) then
    raise exception 'Esa ficha no está en el orden de turno.';
  end if;
  update tablero_estado set iniciativa = jsonb_set(ini, '{lista}', (
      select jsonb_agg(case when e ->> 'id' = p_objeto::text then e || jsonb_build_object('valor', p_valor) else e end order by o)
      from jsonb_array_elements(ini -> 'lista') with ordinality x(e, o))),
    actualizado = now()
  where id = 1;
end;
$$;

-- Las barras de una ficha del tablero pueden seguir los PV de una ficha del compendio (opcional). El dueño de la
-- ficha o el GM cambian ahí los PV actuales, máximos o temporales; lo que llegue en null no se toca.
create or replace function tablero_ficha_pv(p_ficha uuid, p_actual int default null, p_max int default null, p_temp int default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if not exists (select 1 from fichas_personajes where id = p_ficha and (owner_id = auth.uid() or fichas_es_admin())) then
    raise exception 'Esa ficha no es tuya.';
  end if;
  if abs(coalesce(p_actual, 0)) > 100000 or abs(coalesce(p_max, 0)) > 100000 or abs(coalesce(p_temp, 0)) > 100000 then raise exception 'Valor no válido.'; end if;
  update fichas_personajes set
    data = jsonb_set(jsonb_set(jsonb_set(data,
      '{combate,pvActual}', to_jsonb(coalesce(p_actual, (data #>> '{combate,pvActual}')::int, 0))),
      '{combate,pvMax}', to_jsonb(coalesce(p_max, (data #>> '{combate,pvMax}')::int, 0))),
      '{combate,pvTemp}', to_jsonb(coalesce(p_temp, (data #>> '{combate,pvTemp}')::int, 0))),
    updated_at = now()
  where id = p_ficha;
end;
$$;

-- Un jugador abre o cierra una puerta de su página, salvo que el DJ la haya cerrado con llave. Solo cambia
-- datos.abierta: el resto del muro sigue siendo del DJ.
create or replace function tablero_puerta(p_objeto uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  o tablero_objetos;
  nuevo boolean;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into o from tablero_objetos where id = p_objeto;
  if not found or o.capa <> 'luz' or o.tipo <> 'dibujo' or coalesce(o.datos ->> 'muro', '') <> 'puerta' then raise exception 'Eso no es una puerta.'; end if;
  if not fichas_es_admin() then
    if not tablero_escena_visible(o.escena) then raise exception 'Esa puerta no está en tu página.'; end if;
    if coalesce((o.datos ->> 'llave')::boolean, false) then raise exception 'La puerta está cerrada con llave.'; end if;
  end if;
  nuevo := not coalesce((o.datos ->> 'abierta')::boolean, false);
  update tablero_objetos set datos = jsonb_set(datos, '{abierta}', to_jsonb(nuevo)), actualizado = now() where id = p_objeto;
  return nuevo;
end;
$$;

-- Marcadores de estado (envenenado, derribado, concentración…) de una ficha: el DJ en cualquiera, el jugador en las
-- suyas. Solo cambia datos.estados: [{ "id": "envenenado", "n": 2 }, …]
create or replace function tablero_estados(p_objeto uuid, p_estados jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o tablero_objetos;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  if jsonb_typeof(p_estados) <> 'array' or jsonb_array_length(p_estados) > 30 or pg_column_size(p_estados) > 4000 then raise exception 'Estados no válidos.'; end if;
  select * into o from tablero_objetos where id = p_objeto;
  if not found then raise exception 'Esa ficha ya no existe.'; end if;
  if not fichas_es_admin() and not ((o.controlan_todos or auth.uid() = any(o.controladores)) and o.capa = 'fichas' and tablero_escena_visible(o.escena)) then
    raise exception 'Esa ficha no es tuya.';
  end if;
  update tablero_objetos set datos = jsonb_set(coalesce(datos, '{}'::jsonb), '{estados}', p_estados), actualizado = now() where id = p_objeto;
end;
$$;

-- Copiar apariencias (cambiaformas): el jugador cambia la imagen, el nombre y el tinte de su ficha si el DJ le dio
-- datos.cambiaformas. Se guarda su aspecto original para volver a él. p_ap = null vuelve al original.
create or replace function tablero_apariencia(p_objeto uuid, p_ap jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o tablero_objetos;
  d jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select * into o from tablero_objetos where id = p_objeto;
  if not found or o.tipo <> 'imagen' then raise exception 'Esa ficha ya no existe.'; end if;
  if not fichas_es_admin() then
    if not ((o.controlan_todos or auth.uid() = any(o.controladores)) and o.capa = 'fichas' and tablero_escena_visible(o.escena)) then raise exception 'Esa ficha no es tuya.'; end if;
    if not coalesce((o.datos ->> 'cambiaformas')::boolean, false) then raise exception 'Tu ficha no puede cambiar de aspecto.'; end if;
  end if;
  d := coalesce(o.datos, '{}'::jsonb);
  if p_ap is null or jsonb_typeof(p_ap) = 'null' then
    if d ? 'original' and jsonb_typeof(d -> 'original') = 'object' then
      d := (d - 'original' - 'disfraz') || (d -> 'original');
    end if;
  else
    if jsonb_typeof(p_ap) <> 'object' or coalesce(p_ap ->> 'src', '') !~ '^(https://|assets/)' or char_length(p_ap ->> 'src') > 1000
       or char_length(coalesce(p_ap ->> 'nombre', '')) > 80 then
      raise exception 'Apariencia no válida.';
    end if;
    if not (d ? 'original') then
      d := d || jsonb_build_object('original', jsonb_build_object('src', d -> 'src', 'nombre', d -> 'nombre', 'verNombre', d -> 'verNombre', 'tinte', d -> 'tinte', 'voltearH', d -> 'voltearH'));
    end if;
    d := d || jsonb_build_object('src', p_ap -> 'src', 'nombre', coalesce(p_ap -> 'nombre', '""'::jsonb), 'verNombre', coalesce(p_ap -> 'verNombre', 'false'::jsonb),
      'tinte', coalesce(p_ap -> 'tinte', 'null'::jsonb), 'voltearH', coalesce(p_ap -> 'voltearH', 'false'::jsonb), 'disfraz', 'true'::jsonb);
  end if;
  update tablero_objetos set datos = d, actualizado = now() where id = p_objeto;
end;
$$;

-- Pasar turno. El GM adelante o atrás; un jugador solo adelante y solo cuando el turno es de una ficha suya.
create or replace function tablero_turno(p_paso int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ini jsonb;
  n int;
  t int;
  r int;
  actual text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión.'; end if;
  select iniciativa into ini from tablero_estado where id = 1 for update;
  n := jsonb_array_length(coalesce(ini -> 'lista', '[]'::jsonb));
  if n = 0 then return; end if;
  t := least(greatest(coalesce((ini ->> 'turno')::int, 0), 0), n - 1);
  r := greatest(coalesce((ini ->> 'ronda')::int, 1), 1);
  if not fichas_es_admin() then
    actual := ini -> 'lista' -> t ->> 'id';
    if p_paso <> 1 or not exists (select 1 from tablero_objetos o where o.id::text = actual
         and (o.controlan_todos or auth.uid() = any(o.controladores)) and tablero_escena_visible(o.escena)) then
      raise exception 'No es tu turno.';
    end if;
  end if;
  if p_paso >= 0 then
    t := t + 1;
    if t >= n then t := 0; r := r + 1; end if;
  else
    t := t - 1;
    if t < 0 then t := n - 1; r := greatest(r - 1, 1); end if;
  end if;
  update tablero_estado set iniciativa = ini || jsonb_build_object('turno', t, 'ronda', r), actualizado = now() where id = 1;
end;
$$;

revoke all on function tablero_i_tirar(text) from public, anon, authenticated;
revoke all on function tablero_i_nombre() from public, anon, authenticated;
revoke all on function tablero_i_como(uuid) from public, anon, authenticated;
revoke all on function tablero_mover(uuid, double precision, double precision) from public, anon;
revoke all on function tablero_barra(uuid, int, numeric, numeric) from public, anon;
revoke all on function tablero_crear_propio(uuid, text, double precision, double precision, double precision, double precision, jsonb) from public, anon;
revoke all on function tablero_borrar_propio(uuid[]) from public, anon;
revoke all on function tablero_tirar(text, text, text, uuid) from public, anon;
revoke all on function tablero_decir(text, text, text, uuid) from public, anon;
revoke all on function tablero_tirar_iniciativa(uuid, int) from public, anon;
revoke all on function tablero_turno(int) from public, anon;
revoke all on function tablero_ficha_pv(uuid, int, int, int) from public, anon;
revoke all on function tablero_iniciativa_valor(uuid, numeric) from public, anon;
revoke all on function tablero_puerta(uuid) from public, anon;
revoke all on function tablero_estados(uuid, jsonb) from public, anon;
revoke all on function tablero_apariencia(uuid, jsonb) from public, anon;
grant execute on function tablero_escena_jugadores() to authenticated;
grant execute on function tablero_escena_visible(uuid) to authenticated;
grant execute on function tablero_mover(uuid, double precision, double precision) to authenticated;
grant execute on function tablero_barra(uuid, int, numeric, numeric) to authenticated;
grant execute on function tablero_crear_propio(uuid, text, double precision, double precision, double precision, double precision, jsonb) to authenticated;
grant execute on function tablero_borrar_propio(uuid[]) to authenticated;
grant execute on function tablero_tirar(text, text, text, uuid) to authenticated;
grant execute on function tablero_decir(text, text, text, uuid) to authenticated;
grant execute on function tablero_tirar_iniciativa(uuid, int) to authenticated;
grant execute on function tablero_turno(int) to authenticated;
grant execute on function tablero_ficha_pv(uuid, int, int, int) to authenticated;
grant execute on function tablero_iniciativa_valor(uuid, numeric) to authenticated;
grant execute on function tablero_puerta(uuid) to authenticated;
grant execute on function tablero_estados(uuid, jsonb) to authenticated;
grant execute on function tablero_apariencia(uuid, jsonb) to authenticated;

-- ============================================================ tiempo real y almacenamiento
do $$
declare t text;
begin
  foreach t in array array['tablero_escenas', 'tablero_estado', 'tablero_objetos', 'tablero_mensajes', 'tablero_diario'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object or undefined_object then null;
    end;
  end loop;
end;
$$;

-- Perfil de cada uno en el tablero: su avatar (lo ven todos, sale en el chat y en la barra de jugadores) y sus GIFs
-- favoritos (solo los ve su dueño). Cada uno cambia lo suyo.
create table if not exists tablero_perfil (
  uid uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  avatar text not null default '' check (avatar = '' or (avatar ~ '^https://' and char_length(avatar) <= 1000)),
  actualizado timestamptz not null default now()
);
create table if not exists tablero_gifs (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https://' and char_length(url) <= 1000),
  nombre text not null default '' check (char_length(nombre) <= 60),
  creado timestamptz not null default now()
);
create index if not exists tablero_gifs_owner on tablero_gifs (owner, creado desc);
-- Biblioteca de apariencias copiadas de cada jugador (solo la ve su dueño)
create table if not exists tablero_apariencias (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null default '' check (char_length(nombre) <= 80),
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) <= 4000),
  creado timestamptz not null default now()
);
create index if not exists tablero_apariencias_owner on tablero_apariencias (owner, creado desc);
-- Como mucho 300 GIFs por persona
create or replace function tablero_i_tope_gifs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from tablero_gifs where owner = new.owner) >= 300 then raise exception 'Ya tienes 300 GIFs: borra alguno antes.'; end if;
  return new;
end;
$$;
drop trigger if exists tablero_tope_gifs on tablero_gifs;
create trigger tablero_tope_gifs before insert on tablero_gifs for each row execute function tablero_i_tope_gifs();
revoke all on function tablero_i_tope_gifs() from public, anon, authenticated;

alter table tablero_perfil enable row level security;
drop policy if exists "tablero_perfil_ver" on tablero_perfil;
create policy "tablero_perfil_ver" on tablero_perfil for select to authenticated using (true);
drop policy if exists "tablero_perfil_mio" on tablero_perfil;
create policy "tablero_perfil_mio" on tablero_perfil for insert to authenticated with check (uid = auth.uid());
drop policy if exists "tablero_perfil_cambiar" on tablero_perfil;
create policy "tablero_perfil_cambiar" on tablero_perfil for update to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
alter table tablero_apariencias enable row level security;
drop policy if exists "tablero_apariencias_mias" on tablero_apariencias;
create policy "tablero_apariencias_mias" on tablero_apariencias for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
revoke all on tablero_apariencias from anon;
grant select, insert, update, delete on tablero_apariencias to authenticated;
alter table tablero_gifs enable row level security;
drop policy if exists "tablero_gifs_mios" on tablero_gifs;
create policy "tablero_gifs_mios" on tablero_gifs for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
revoke all on tablero_perfil, tablero_gifs from anon;
grant select, insert, update on tablero_perfil to authenticated;
grant select, insert, delete on tablero_gifs to authenticated;

-- Imágenes del tablero (mapas, fichas, diario) y efectos de sonido del soundboard: bucket público, solo el GM sube o
-- borra. Hasta 15 MB. Cada jugador puede subir lo suyo (avatar y GIFs) en su carpeta u/<su id>/.
do $$
begin
  if to_regclass('storage.buckets') is null then return; end if;   -- base de pruebas sin Storage
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('tablero', 'tablero', true, 15728640, array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/aac', 'video/mp4', 'video/webm'])
  on conflict (id) do update set public = true, file_size_limit = 15728640,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/mp4', 'audio/aac', 'video/mp4', 'video/webm'];
  execute 'drop policy if exists "tablero_storage_select" on storage.objects';
  execute 'create policy "tablero_storage_select" on storage.objects for select using (bucket_id = ''tablero'')';
  execute 'drop policy if exists "tablero_storage_insert" on storage.objects';
  execute 'create policy "tablero_storage_insert" on storage.objects for insert to authenticated with check (bucket_id = ''tablero'' and (fichas_es_admin() or ((storage.foldername(name))[1] = ''u'' and (storage.foldername(name))[2] = auth.uid()::text)))';
  execute 'drop policy if exists "tablero_storage_delete" on storage.objects';
  execute 'create policy "tablero_storage_delete" on storage.objects for delete to authenticated using (bucket_id = ''tablero'' and (fichas_es_admin() or ((storage.foldername(name))[1] = ''u'' and (storage.foldername(name))[2] = auth.uid()::text)))';
end;
$$;
