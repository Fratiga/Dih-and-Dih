-- LA ÚLTIMA VELA: el desafío de Muerte Súbita contra Cera (muerte-subita.html → ultima-vela.html).
-- Corre esto en el SQL Editor de Supabase DESPUÉS de docs/veintiuna.sql y de Muerte Súbita (scratchpad/muerte_subita.sql, _2 y _3). Se puede repetir.
--
-- Qué es (el diseño y los números están en docs/veintiuna.md, sección «La Última Vela»):
--   * Blackjack contra Cera con la baraja, los valores y el reparto de Las Veintiuna Velas, sin reglas especiales de ronda, sin doblar ni dividir, con DOS reglas fijas:
--       - El testigo: Cera enseña sus dos cartas desde que se reparte.
--       - Cera exigente: Cera pide carta hasta llegar a 18 (en la mesa normal se planta con 17).
--   * Hay que ganar 3 de 5 manos. Un empate repite la mano, hasta dos veces; el tercer empate seguido cuenta como derrota de esa mano. El reto acaba en cuanto
--     se llega a 3 victorias (ganado) o a 3 derrotas (perdido).
--   * Todo vive aquí: la baraja se baraja en el servidor y no sale de él, el navegador solo recibe cartas ya repartidas y pide «pedir» o «plantar».
--   * NO mueve tokens ni cartas, NO toca estadísticas, desafíos ni rachas de Las Veintiuna Velas, y NO mata a nadie. Al terminar solo cierra el intento de Muerte Súbita
--     como «ganado» o «perdido» (puntaje = manos ganadas, puntaje_rival = manos perdidas) y el DM resuelve con el veredicto de siempre (confirmar, anular o perdonar).
--   * Un solo intento por personaje: lo da el índice único de muerte_subita_intentos (ms_iniciar). Una vez repartida la primera mano, recargar o desconectarse no da otro:
--     la partida entera (mano en curso incluida) se recupera con veintiuna_reto_estado.
--   * El resultado lo decide solo el servidor: ms_finalizar (el cierre con puntajes que manda el navegador, usado por Verdam) se niega a cerrar este desafío.

/* ================================================================== 1) TABLAS */
create table if not exists veintiuna_retos (
  intento uuid primary key references muerte_subita_intentos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  estado text not null default 'en_curso' check (estado in ('en_curso', 'ganado', 'perdido')),
  ganadas int not null default 0,
  perdidas int not null default 0,
  empates_seguidos int not null default 0,                  -- empates seguidos de la mano que se está jugando (0 a 2; el tercero es derrota)
  manos int not null default 0,                             -- manos repartidas en total (las repetidas por empate cuentan)
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  cerrado timestamptz
);

-- Una fila por mano repartida. Lleva la baraja entera: NO se lee desde el navegador (solo el admin, para revisar)
create table if not exists veintiuna_reto_manos (
  id uuid primary key default gen_random_uuid(),
  intento uuid not null references veintiuna_retos(intento) on delete cascade,
  orden int not null,                                       -- 1, 2, 3...: cada mano repartida
  numero int not null,                                      -- a qué mano del reto (1 a 5) pertenece
  repeticion int not null default 0,                        -- 0 la primera vez; 1 o 2 si se repite por empate
  estado text not null default 'en_curso' check (estado in ('en_curso', 'terminada')),
  paso int not null default 0,
  mazo smallint[] not null,
  repartidas int not null,
  jugador smallint[] not null,
  cera smallint[] not null,
  resultado text check (resultado in ('victoria', 'empate', 'derrota')),
  cuenta text check (cuenta in ('victoria', 'empate', 'derrota')),     -- cómo contó para el reto (un tercer empate seguido cuenta como derrota)
  razon text,
  creada timestamptz not null default now(),
  terminada timestamptz,
  unique (intento, orden),
  check ((estado = 'terminada') = (resultado is not null))
);
create unique index if not exists veintiuna_reto_una_en_curso on veintiuna_reto_manos (intento) where estado = 'en_curso';

alter table veintiuna_retos enable row level security;
alter table veintiuna_reto_manos enable row level security;
drop policy if exists "veintiuna_retos_select" on veintiuna_retos;
create policy "veintiuna_retos_select" on veintiuna_retos for select using (user_id = auth.uid() or fichas_es_admin());
drop policy if exists "veintiuna_reto_manos_admin" on veintiuna_reto_manos;
create policy "veintiuna_reto_manos_admin" on veintiuna_reto_manos for select using (fichas_es_admin());
-- Nadie escribe directamente: solo las funciones de abajo
revoke all on veintiuna_retos, veintiuna_reto_manos from anon, authenticated;
grant select on veintiuna_retos, veintiuna_reto_manos to authenticated;

/* ================================================================== 2) PIEZAS */
-- Los números del reto, en un solo sitio
create or replace function veintiuna_i_reto_const(p_clave text)
returns int
language sql
immutable
as $$
  select case p_clave
    when 'ganar' then 3              -- manos que hay que ganar...
    when 'manos' then 5              -- ...de estas
    when 'empates' then 2            -- veces que se repite una mano empatada
    when 'cera' then 18              -- Cera exigente: pide hasta llegar a esto
  end
$$;

-- Lo que ve el navegador. Cera enseña sus dos cartas desde el principio (El testigo); la baraja no sale nunca.
create or replace function veintiuna_i_reto_json(p_intento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i muerte_subita_intentos%rowtype;
  r veintiuna_retos%rowtype;
  h veintiuna_reto_manos%rowtype;
  vj record;
  vc record;
  v_mano jsonb;
  v_hist jsonb;
begin
  select * into i from muerte_subita_intentos where id = p_intento;
  select * into r from veintiuna_retos where intento = p_intento;
  select * into h from veintiuna_reto_manos where intento = p_intento and estado = 'en_curso';
  if found then
    select * into vj from veintiuna_i_valor(h.jugador, '{}'::int[], 10);
    select * into vc from veintiuna_i_valor(h.cera, '{}'::int[], 10);
    v_mano := jsonb_build_object('paso', h.paso, 'numero', h.numero, 'repeticion', h.repeticion, 'fase', 'jugador',
      'jugador', jsonb_build_object('cartas', veintiuna_i_mano_json(h.jugador, '{}'::int[]), 'total', vj.total, 'blando', vj.blando),
      'cera', jsonb_build_object('cartas', veintiuna_i_mano_json(h.cera, '{}'::int[]), 'total', vc.total, 'blando', vc.blando));
  else
    -- La última mano terminada se sigue enseñando (con todo a la vista) hasta que se reparta otra
    select * into h from veintiuna_reto_manos where intento = p_intento order by orden desc limit 1;
    if found then
      select * into vj from veintiuna_i_valor(h.jugador, '{}'::int[], 10);
      select * into vc from veintiuna_i_valor(h.cera, '{}'::int[], 10);
      v_mano := jsonb_build_object('paso', h.paso, 'numero', h.numero, 'repeticion', h.repeticion, 'fase', 'terminada',
        'resultado', h.resultado, 'cuenta', h.cuenta, 'razon', h.razon,
        'jugador', jsonb_build_object('cartas', veintiuna_i_mano_json(h.jugador, '{}'::int[]), 'total', vj.total, 'blando', vj.blando),
        'cera', jsonb_build_object('cartas', veintiuna_i_mano_json(h.cera, '{}'::int[]), 'total', vc.total, 'blando', vc.blando));
    end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('orden', m.orden, 'numero', m.numero, 'resultado', m.resultado, 'cuenta', m.cuenta) order by m.orden), '[]'::jsonb)
    into v_hist from veintiuna_reto_manos m where m.intento = p_intento and m.estado = 'terminada';
  return jsonb_build_object(
    'intento', p_intento,
    'personaje', i.personaje_nombre,
    'estado', coalesce(r.estado, i.estado),
    'meta', jsonb_build_object('ganar', veintiuna_i_reto_const('ganar'), 'manos', veintiuna_i_reto_const('manos'), 'empates', veintiuna_i_reto_const('empates'), 'cera', veintiuna_i_reto_const('cera')),
    'ganadas', coalesce(r.ganadas, 0), 'perdidas', coalesce(r.perdidas, 0), 'empates_seguidos', coalesce(r.empates_seguidos, 0),
    'repartidas', coalesce(r.manos, 0),
    'numero', least(coalesce(r.ganadas, 0) + coalesce(r.perdidas, 0) + 1, veintiuna_i_reto_const('manos')),
    'historial', v_hist,
    'mano', v_mano
  );
end;
$$;

-- Termina una mano y la cuenta para el reto. Si con ella se llega a 3 victorias o a 3 derrotas, cierra el reto y el intento de Muerte Súbita.
create or replace function veintiuna_i_reto_cerrar_mano(p_mano uuid, p_resultado text, p_razon text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h veintiuna_reto_manos%rowtype;
  r veintiuna_retos%rowtype;
  v_cuenta text := p_resultado;
  v_emp int := 0;
  v_fin text;
begin
  select * into h from veintiuna_reto_manos where id = p_mano for update;
  select * into r from veintiuna_retos where intento = h.intento for update;
  if p_resultado = 'empate' then
    v_emp := r.empates_seguidos + 1;
    if v_emp > veintiuna_i_reto_const('empates') then v_cuenta := 'derrota'; v_emp := 0; end if;      -- el tercer empate seguido es una derrota
  end if;
  update veintiuna_reto_manos set estado = 'terminada', resultado = p_resultado, cuenta = v_cuenta, razon = p_razon, terminada = now() where id = p_mano;
  update veintiuna_retos
     set ganadas = ganadas + (v_cuenta = 'victoria')::int, perdidas = perdidas + (v_cuenta = 'derrota')::int, empates_seguidos = v_emp, actualizado = now()
   where intento = h.intento returning * into r;
  v_fin := case when r.ganadas >= veintiuna_i_reto_const('ganar') then 'ganado'
                when r.perdidas > veintiuna_i_reto_const('manos') - veintiuna_i_reto_const('ganar') then 'perdido' end;
  if v_fin is not null then
    update veintiuna_retos set estado = v_fin, cerrado = now() where intento = h.intento;
    update muerte_subita_intentos set estado = v_fin, puntaje = r.ganadas, puntaje_rival = r.perdidas, cerrado_en = now()
     where id = h.intento and estado = 'en_curso' and veredicto is null;
  end if;
end;
$$;

-- El turno de Cera cuando el jugador se planta (o llega a 21): pide hasta llegar a 18 y se compara
create or replace function veintiuna_i_reto_plantar(p_mano uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  h veintiuna_reto_manos%rowtype;
  vj record;
  vc record;
  t record;
  v_res text;
  v_razon text;
begin
  select * into h from veintiuna_reto_manos where id = p_mano for update;
  select * into t from veintiuna_i_turno_crupier(h.mazo, h.repartidas, h.cera, 10, false, veintiuna_i_reto_const('cera'));
  update veintiuna_reto_manos set cera = t.o_crupier, repartidas = t.o_repartidas where id = p_mano;
  select * into vj from veintiuna_i_valor(h.jugador, '{}'::int[], 10);
  select * into vc from veintiuna_i_valor(t.o_crupier, '{}'::int[], 10);
  if vc.total > 21 then v_res := 'victoria'; v_razon := 'cera_se_pasa';
  elsif vj.total > vc.total then v_res := 'victoria'; v_razon := 'mejor_mano';
  elsif vj.total < vc.total then v_res := 'derrota'; v_razon := 'cera_mejor';
  else v_res := 'empate'; v_razon := 'mismo_total'; end if;
  perform veintiuna_i_reto_cerrar_mano(p_mano, v_res, v_razon);
end;
$$;

-- Comprueba que el intento es de quien llama y es de este desafío. Devuelve la fila.
create or replace function veintiuna_i_reto_intento(p_uid uuid, p_intento uuid)
returns muerte_subita_intentos
language plpgsql
security definer
set search_path = public
as $$
declare
  i muerte_subita_intentos%rowtype;
begin
  if p_uid is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  select * into i from muerte_subita_intentos where id = p_intento;
  if not found or i.user_id <> p_uid or i.desafio <> 'cera-veintiuna' then
    perform veintiuna_i_error('No encuentro ese desafío en tu cuenta.', 'no_encontrado');
  end if;
  if i.veredicto = 'anulado' then perform veintiuna_i_error('El DM anuló este intento.', 'anulado'); end if;
  return i;
end;
$$;

/* ================================================================== 3) LO QUE LLAMA EL NAVEGADOR */
-- La partida entera tal como está (sirve para empezar, para recargar y para recuperar tras un corte)
create or replace function veintiuna_reto_estado(p_intento uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  i muerte_subita_intentos%rowtype;
begin
  i := veintiuna_i_reto_intento(uid, p_intento);
  return veintiuna_i_reto_json(p_intento);
end;
$$;

-- Reparte la siguiente mano con la baraja dada (la pública le pasa una recién barajada; las pruebas, una escrita carta por carta).
-- p_manos: cuántas manos había repartidas cuando se pidió (lo que enseñaba la pantalla); si ya no coincide, no se reparte otra y se devuelve el estado actual
-- (así un clic repetido o una petición que llega tarde no gasta una mano). La primera vez abre el reto: desde aquí el intento ya no se repite.
create or replace function veintiuna_i_reto_repartir(p_uid uuid, p_intento uuid, p_manos int, p_mazo smallint[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  i muerte_subita_intentos%rowtype;
  r veintiuna_retos%rowtype;
  v_id uuid := gen_random_uuid();
  vj record;
  vc record;
begin
  i := veintiuna_i_reto_intento(p_uid, p_intento);
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_reto_' || p_intento::text, 0));
  select * into i from muerte_subita_intentos where id = p_intento;
  if i.estado <> 'en_curso' or i.veredicto is not null then return veintiuna_i_reto_json(p_intento); end if;
  insert into veintiuna_retos (intento, user_id) values (p_intento, p_uid) on conflict do nothing;
  select * into r from veintiuna_retos where intento = p_intento for update;
  if r.estado <> 'en_curso' or exists (select 1 from veintiuna_reto_manos where intento = p_intento and estado = 'en_curso') or p_manos is distinct from r.manos then
    return veintiuna_i_reto_json(p_intento);
  end if;

  -- Reparto: jugador, Cera, jugador, Cera
  insert into veintiuna_reto_manos (id, intento, orden, numero, repeticion, mazo, repartidas, jugador, cera)
    values (v_id, p_intento, r.manos + 1, r.ganadas + r.perdidas + 1, r.empates_seguidos, p_mazo, 4, array[p_mazo[1], p_mazo[3]], array[p_mazo[2], p_mazo[4]]);
  update veintiuna_retos set manos = manos + 1, actualizado = now() where intento = p_intento;
  select * into vj from veintiuna_i_valor(array[p_mazo[1], p_mazo[3]], '{}'::int[], 10);
  select * into vc from veintiuna_i_valor(array[p_mazo[2], p_mazo[4]], '{}'::int[], 10);
  -- Los naturales se resuelven al repartir
  if vj.total = 21 and vc.total = 21 then perform veintiuna_i_reto_cerrar_mano(v_id, 'empate', 'ambos_natural');
  elsif vj.total = 21 then perform veintiuna_i_reto_cerrar_mano(v_id, 'victoria', 'natural');
  elsif vc.total = 21 then perform veintiuna_i_reto_cerrar_mano(v_id, 'derrota', 'natural_cera');
  end if;
  return veintiuna_i_reto_json(p_intento);
end;
$$;

create or replace function veintiuna_reto_repartir(p_intento uuid, p_manos int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then perform veintiuna_i_error('Hay que iniciar sesión.', 'sin_sesion'); end if;
  return veintiuna_i_reto_repartir(auth.uid(), p_intento, p_manos, veintiuna_i_mazo());
end;
$$;

-- Pedir carta o plantarse. p_paso: el número de paso de la mano que enseñaba la pantalla (repetir una acción ya aplicada devuelve el estado sin aplicarla otra vez).
create or replace function veintiuna_reto_accion(p_intento uuid, p_paso int, p_accion text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  i muerte_subita_intentos%rowtype;
  r veintiuna_retos%rowtype;
  h veintiuna_reto_manos%rowtype;
  v_jug smallint[];
  vj record;
begin
  i := veintiuna_i_reto_intento(uid, p_intento);
  perform pg_advisory_xact_lock(hashtextextended('veintiuna_reto_' || p_intento::text, 0));
  select * into r from veintiuna_retos where intento = p_intento;
  if not found then perform veintiuna_i_error('Todavía no has repartido la primera mano.', 'sin_mano'); end if;
  select * into h from veintiuna_reto_manos where intento = p_intento and estado = 'en_curso' for update;
  if not found or p_paso < h.paso then return veintiuna_i_reto_json(p_intento) || jsonb_build_object('repetida', true); end if;
  if p_paso > h.paso then perform veintiuna_i_error('La mesa y tu pantalla no coinciden. Recarga la página.', 'paso_futuro'); end if;
  if p_accion not in ('pedir', 'plantar') then perform veintiuna_i_error('Esa acción no existe.', 'accion_invalida'); end if;

  if p_accion = 'plantar' then
    update veintiuna_reto_manos set paso = paso + 1 where id = h.id;
    perform veintiuna_i_reto_plantar(h.id);
  else
    v_jug := h.jugador || h.mazo[h.repartidas + 1];
    update veintiuna_reto_manos set jugador = v_jug, repartidas = repartidas + 1, paso = paso + 1 where id = h.id;
    select * into vj from veintiuna_i_valor(v_jug, '{}'::int[], 10);
    if vj.total > 21 then perform veintiuna_i_reto_cerrar_mano(h.id, 'derrota', 'te_pasas');
    elsif vj.total = 21 then perform veintiuna_i_reto_plantar(h.id);                       -- con 21 no se puede pedir más: se planta solo
    end if;
  end if;
  return veintiuna_i_reto_json(p_intento);
end;
$$;

/* ================================================================== 4) EL CIERRE DE VERDAM NO VALE AQUÍ */
-- Igual que la original (muerte_subita.sql), más una negativa: el desafío de Cera lo cierra solo el servidor, con las manos que de verdad se jugaron.
create or replace function ms_finalizar(p_id uuid, p_puntaje int, p_puntaje_rival int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  resultado text;
begin
  if p_puntaje is null or p_puntaje_rival is null
     or p_puntaje < 0 or p_puntaje > 3000 or p_puntaje_rival < 0 or p_puntaje_rival > 3000 then
    raise exception 'Puntajes inválidos';
  end if;
  if exists (select 1 from muerte_subita_intentos where id = p_id and desafio = 'cera-veintiuna') then
    raise exception 'Este desafío lo cierra el servidor al terminar las manos';
  end if;
  resultado := case when p_puntaje > p_puntaje_rival then 'ganado' else 'perdido' end;
  update muerte_subita_intentos
     set estado = resultado, puntaje = p_puntaje, puntaje_rival = p_puntaje_rival, cerrado_en = now()
   where id = p_id and user_id = auth.uid() and estado = 'en_curso' and veredicto is null;
  if not found then
    raise exception 'Intento no encontrado o ya cerrado';
  end if;
  return resultado;
end;
$$;

/* ================================================================== 5) PERMISOS */
revoke all on function veintiuna_i_reto_const(text), veintiuna_i_reto_json(uuid), veintiuna_i_reto_cerrar_mano(uuid, text, text), veintiuna_i_reto_plantar(uuid),
  veintiuna_i_reto_intento(uuid, uuid), veintiuna_i_reto_repartir(uuid, uuid, int, smallint[]) from public, anon, authenticated;
revoke all on function veintiuna_reto_estado(uuid), veintiuna_reto_repartir(uuid, int), veintiuna_reto_accion(uuid, int, text) from public, anon;
grant execute on function veintiuna_reto_estado(uuid), veintiuna_reto_repartir(uuid, int), veintiuna_reto_accion(uuid, int, text) to authenticated;
revoke all on function ms_finalizar(uuid, int, int) from public, anon;
grant execute on function ms_finalizar(uuid, int, int) to authenticated;
