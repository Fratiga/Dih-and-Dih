-- ECONOMÍA DE CARTAS, parte 2: límites globales de partida.
-- Corre esto DESPUÉS de economia_1_nucleo.sql. Solo rellena las cartas que todavía no tienen límite global
-- (null); lo que ya tenga un valor no se toca, así que se puede volver a correr sin pisar tus correcciones.
--
-- Son valores de partida para que el sistema funcione desde el primer día. Se corrigen carta por carta en
-- Admin > Cartas: límites. Criterio, con unos diez jugadores y el tope por jugador de 3 (personajes) y 10 (el resto):
--
--   tipo         común  poco común  rara   legendaria
--   Personaje        8           5     3            1
--   Criatura        20          12     5            1
--   Objeto          20          12     5            1
--   Reacción        15           8     4            1
--   Terreno         12           8     4            1
--   Otros           12           8     4            1
--   (las limitadas ya tienen su propia edición, por ejemplo el Bufón con 5)
--
-- Con el catálogo actual suma unas 900 copias entre todas las cartas. Eso es el techo de lo que puede llegar a existir,
-- no lo que se reparte de golpe: el motor de recompensas lo suelta poco a poco.

with valores as (
  select c.id,
    case
      when c.rareza = 'legendaria' then 1
      when c.rareza = 'limitada' then 1
      when c.tipo = 'Personaje' then case c.rareza when 'comun' then 8 when 'infrecuente' then 5 else 3 end
      when c.tipo = 'Criatura'  then case c.rareza when 'comun' then 20 when 'infrecuente' then 12 else 5 end
      when c.tipo = 'Objeto'    then case c.rareza when 'comun' then 20 when 'infrecuente' then 12 else 5 end
      when c.tipo = 'Reacción'  then case c.rareza when 'comun' then 15 when 'infrecuente' then 8 else 4 end
      when c.tipo = 'Terreno'   then case c.rareza when 'comun' then 12 when 'infrecuente' then 8 else 4 end
      else case c.rareza when 'comun' then 12 when 'infrecuente' then 8 else 4 end
    end as limite
  from cartas_catalogo c
  where c.limite is null
)
update cartas_catalogo c set limite = v.limite
from valores v
where c.id = v.id;

-- El editor de cartas guarda este número en la ficha de la carta; se deja igual para que no lo borre al guardar
update cartas_definiciones d
set data = jsonb_set(d.data, '{limite}', to_jsonb(c.limite)), actualizada = now()
from cartas_catalogo c
where c.id = d.id and c.limite is not null and (d.data -> 'limite' is null or jsonb_typeof(d.data -> 'limite') = 'null');

insert into cartas_limites_historial (carta_id, campo, antes, despues)
select id, 'limite', null, limite from cartas_catalogo where limite is not null
  and not exists (select 1 from cartas_limites_historial h where h.carta_id = cartas_catalogo.id and h.campo = 'limite');
