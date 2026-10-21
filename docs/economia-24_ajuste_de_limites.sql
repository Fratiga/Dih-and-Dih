-- ECONOMÍA DE CARTAS, parte 24: ajuste de los límites de copias (global y por jugador) de todo el catálogo.
-- Se puede correr más de una vez. Nunca baja un límite por debajo de lo ya emitido (global) ni de lo que ya tenga el jugador que más tiene
-- (por jugador), así que no quita nada a nadie ni deja la auditoría con avisos. No cambia ninguna etiqueta «En circulación».
--
-- 1) CARTAS ÚNICAS (1 copia en toda la página y 1 por jugador): personajes que son «el» líder, jefe o figura de algo, aunque su nombre no lo diga
--    (solo hay un Cabecilla de la Cofradía del Carbón, una Jefa de las Comadrejas...), criaturas con nombre propio y reliquias con nombre propio.
--      Personajes: El Tiznado, Magistrada de la Colmena (Mandíbula), Portador del Sello Rojo (Cobrojo), Trazahorizontes (La Ventarrossa),
--                  La Anfitriona (Espejera), El Desenterrador (Desolterro), La Primera Aurora (Peralba), Pregonero de Cambalache (Pregalache),
--                  Señor de las Calas (Rumbonero), Señora de la Madriguera (Jefa de las Comadrejas), Garra.
--      Criaturas:  Draco, Gofiri (La Jauría), Kraken, Zraith (El Águila de la Tormenta), El Bufón.
--      Objetos:    Reliquia de Asmodeo, Estandarte de Brurland.
--    Si alguna ya tiene más de una copia emitida, se salta (no se puede). Los que ya eran 1 y 1 se quedan como estaban.
-- 2) El resto, por tipo y rareza, con un ratio global / por jugador de 4 o 5 (en la mesa hay unos 8 jugadores activos): así hace falta repartir entre
--    varios jugadores, pero sigue siendo posible coleccionar. En las criaturas el por jugador nunca baja de 3 en las raras para poder criar
--    (dos padres más la cría).
--        Acción:   común 24 / 5      infrecuente 15 / 3      rara 8 / 2
--        Criatura: común 40 / 8      infrecuente 16 / 4      rara 9 / 3      (la Rata sigue en 70 / 15; Guillotina, ya única, no cambia)
--        Objeto:   común 24 / 5      infrecuente 15 / 3      rara 8 / 2
--        Reacción: común 30 / 6      infrecuente 16 / 3      rara 8 / 2
--        Terreno:  común 20 / 4      infrecuente 12 / 3      rara 6 / 2
--    Los personajes con nombre que ya eran únicos y las tropas genéricas (35 / 5) no se tocan, y los personajes genéricos sin límite siguen sin él.
--    (Las legendarias y limitadas que no están en la lista de únicas tampoco se tocan.)

-- 1) Únicas
update cartas_catalogo c set limite = 1, limite_jugador = 1
where c.id in ('el-tiznado', 'magistrada-de-la-colmena', 'portador-del-sello-rojo', 'trazahorizontes', 'el-anfitrion', 'el-desenterrador', 'la-primera-aurora',
               'pregonero-de-cambalache', 'senor-de-las-calas', 'senora-de-la-madriguera', 'garra',
               'draco', 'gofiri-la-jauria', 'kraken', 'zraith', 'el-bufon', 'reliquia-de-asmodeo', 'estandarte-de-brurland')
  and coalesce((select max(numero) from cartas_ejemplares e where e.carta_id = c.id), 0) <= 1
  and coalesce((select max(n) from (select count(*) n from cartas_ejemplares e where e.carta_id = c.id and e.estado in ('poseida', 'bloqueada') group by propietario) z), 0) <= 1
  and (c.limite is distinct from 1 or c.limite_jugador is distinct from 1);

-- 2) El resto, por tipo y rareza
update cartas_catalogo c set limite = x.lim, limite_jugador = x.lj
from (
  select c2.id,
         greatest(t.lim, coalesce(em.mx, 0)) as lim,
         least(greatest(t.lj, coalesce(em.mj, 0)), greatest(t.lim, coalesce(em.mx, 0))) as lj
  from cartas_catalogo c2
  join (values
    ('Acción', 'comun', 24, 5), ('Acción', 'infrecuente', 15, 3), ('Acción', 'rara', 8, 2),
    ('Criatura', 'comun', 40, 8), ('Criatura', 'infrecuente', 16, 4), ('Criatura', 'rara', 9, 3),
    ('Objeto', 'comun', 24, 5), ('Objeto', 'infrecuente', 15, 3), ('Objeto', 'rara', 8, 2),
    ('Reacción', 'comun', 30, 6), ('Reacción', 'infrecuente', 16, 3), ('Reacción', 'rara', 8, 2),
    ('Terreno', 'comun', 20, 4), ('Terreno', 'infrecuente', 12, 3), ('Terreno', 'rara', 6, 2)
  ) as t(tipo, rareza, lim, lj) on t.tipo = c2.tipo and t.rareza = c2.rareza
  left join lateral (
    select max(e.numero) as mx,
           (select max(n) from (select count(*) n from cartas_ejemplares e2 where e2.carta_id = c2.id and e2.estado in ('poseida', 'bloqueada') group by e2.propietario) z) as mj
    from cartas_ejemplares e where e.carta_id = c2.id) em on true
  where c2.id not in ('el-tiznado', 'magistrada-de-la-colmena', 'portador-del-sello-rojo', 'trazahorizontes', 'el-anfitrion', 'el-desenterrador', 'la-primera-aurora',
                      'pregonero-de-cambalache', 'senor-de-las-calas', 'senora-de-la-madriguera', 'garra',
                      'draco', 'gofiri-la-jauria', 'kraken', 'zraith', 'el-bufon', 'reliquia-de-asmodeo', 'estandarte-de-brurland', 'rata')
    and c2.limite is distinct from 1
) x
where c.id = x.id and (c.limite is distinct from x.lim or c.limite_jugador is distinct from x.lj);
