-- ECONOMÍA DE CARTAS, parte 27: los corrales aceptan las criaturas nuevas.
--
-- Mete en cartas_cria_especies a las bestias y monstruos que han salido desde la primera tanda de crianza (parte 18), cada uno en su corral.
-- Solo entran las que ya existen en cartas_catalogo (las que aún no estén se saltan sin error) y las que ya estaban configuradas no se tocan,
-- así que se puede repetir. Los tiempos siguen la misma regla que la parte 18: total en horas repartido 20 % / 55 % / 25 % y descanso de la mitad.
-- Las legendarias de límite 1 salen en el corral pero no se pueden criar (parte 21): el servidor lo rechaza solo.
-- Todo se cambia después desde Admin → Economía → Crianza (corral, horas, descanso, activa). Se corre en el SQL Editor de Supabase.
--
--   aviario    fenix 96, pegaso 36, hipogrifo 36, grifo 60
--   bosque     kirin 60, unicornio 60, manticora 72, behemoth 96
--   pantano    kelpie 36, leviatan 96, cubo-gelatinoso 24
--   cubil      dragon-dorado 72, dragon-de-magma 72, dragon-ancestral 96, basilisco 72
--   madriguera y cámara de hielo: sin novedades por ahora

insert into cartas_cria_especies (carta_id, habitat, horas, descanso_horas)
select v.carta, v.habitat, jsonb_build_array(round(v.total * 0.2, 2), round(v.total * 0.55, 2), round(v.total * 0.25, 2)), round(v.total * 0.5, 2)
from (values
  ('fenix', 'aviario', 96), ('pegaso', 'aviario', 36), ('hipogrifo', 'aviario', 36), ('grifo', 'aviario', 60),
  ('kirin', 'bosque', 60), ('unicornio', 'bosque', 60), ('manticora', 'bosque', 72), ('behemoth', 'bosque', 96),
  ('kelpie', 'pantano', 36), ('leviatan', 'pantano', 96), ('cubo-gelatinoso', 'pantano', 24),
  ('dragon-dorado', 'cubil', 72), ('dragon-de-magma', 'cubil', 72), ('dragon-ancestral', 'cubil', 96), ('basilisco', 'cubil', 72)
) as v(carta, habitat, total)
join cartas_catalogo c on c.id = v.carta and c.tipo = 'Criatura'
on conflict (carta_id) do nothing;

-- Qué quedó: cada criatura de las de arriba, con su corral, o «sin carta en el catálogo» si todavía no existe en el servidor
select v.carta, coalesce(s.habitat, 'sin carta en el catálogo o ya configurada de otro modo') as corral, s.horas, c.limite
from (values ('fenix'), ('pegaso'), ('hipogrifo'), ('grifo'), ('kirin'), ('unicornio'), ('manticora'), ('behemoth'), ('kelpie'), ('leviatan'), ('cubo-gelatinoso'),
             ('dragon-dorado'), ('dragon-de-magma'), ('dragon-ancestral'), ('basilisco')) as v(carta)
left join cartas_cria_especies s on s.carta_id = v.carta
left join cartas_catalogo c on c.id = v.carta
order by s.habitat nulls last, v.carta;
