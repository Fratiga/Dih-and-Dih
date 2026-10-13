-- Datos inventados para las pruebas locales (nada de esto existe en producción).
-- Usuarios: admin, editor y cuatro jugadores. Catálogo: cartas sintéticas de cada rareza.
-- Se carga ANTES de economia-1 (así el disparador del catálogo todavía no existe).

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@prueba.local'),
  ('00000000-0000-0000-0000-0000000000e1', 'editor@prueba.local'),
  ('00000000-0000-0000-0000-000000000001', 'uno@prueba.local'),
  ('00000000-0000-0000-0000-000000000002', 'dos@prueba.local'),
  ('00000000-0000-0000-0000-000000000003', 'tres@prueba.local'),
  ('00000000-0000-0000-0000-000000000004', 'cuatro@prueba.local');

insert into perfiles (user_id, side, username) values
  ('00000000-0000-0000-0000-0000000000a1', 'B', 'Admin'),
  ('00000000-0000-0000-0000-0000000000e1', 'A', 'Editor'),
  ('00000000-0000-0000-0000-000000000001', 'A', 'Uno'),
  ('00000000-0000-0000-0000-000000000002', 'A', 'Dos'),
  ('00000000-0000-0000-0000-000000000003', 'B', 'Tres'),
  ('00000000-0000-0000-0000-000000000004', 'B', 'Cuatro');
insert into fichas_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1');
insert into cartas_editores (user_id) values ('00000000-0000-0000-0000-0000000000e1');

-- 6 comunes (limite 20), 4 poco comunes (12), 3 raras (5), 1 legendaria (1), 1 limitada tipo Bufón (5, no obtenible)
do $$
declare
  i int;
  tipos text[] := array['Criatura', 'Criatura', 'Criatura', 'Objeto', 'Objeto', 'Terreno', 'Criatura', 'Criatura', 'Criatura', 'Objeto', 'Objeto', 'Terreno'];
  tipos_poco text[] := array['Criatura', 'Objeto', 'Terreno', 'Acción', 'Reacción', 'Entidad'];   -- uno distinto por carta
  id_ text;
  tipo_ text;
begin
  for i in 1..12 loop
    id_ := 'comun-' || i; tipo_ := tipos[i];
    insert into cartas_catalogo (id, rareza, tipo, limite, obtenible, publicada) values (id_, 'comun', tipo_, 20, true, true);
    insert into cartas_definiciones (id, data) values (id_, jsonb_build_object('nombre', 'Común ' || i, 'epiteto', '', 'tipo', tipo_, 'rareza', 'comun',
      'afinidad', jsonb_build_array('carne'), 'coste', 1 + i % 3, 'atq', case when tipo_ = 'Criatura' then 1 + i % 3 end, 'pv', case when tipo_ = 'Criatura' then 2 end,
      'habilidad', 'Habilidad común ' || i));
  end loop;
  for i in 1..6 loop
    id_ := 'poco-' || i; tipo_ := tipos_poco[i];
    insert into cartas_catalogo (id, rareza, tipo, limite, obtenible, publicada) values (id_, 'infrecuente', tipo_, 12, true, true);
    insert into cartas_definiciones (id, data) values (id_, jsonb_build_object('nombre', 'Poco común ' || i, 'epiteto', '', 'tipo', tipo_, 'rareza', 'infrecuente',
      'afinidad', jsonb_build_array('arcano'), 'coste', 3, 'atq', case when tipo_ = 'Criatura' then 3 end, 'pv', case when tipo_ = 'Criatura' then 3 end,
      'habilidad', 'Habilidad poco común ' || i));
  end loop;
  for i in 1..3 loop
    id_ := 'rara-' || i;
    insert into cartas_catalogo (id, rareza, tipo, limite, obtenible, publicada) values (id_, 'rara', 'Criatura', 5, true, true);
    insert into cartas_definiciones (id, data) values (id_, jsonb_build_object('nombre', 'Rara ' || i, 'epiteto', '', 'tipo', 'Criatura', 'rareza', 'rara',
      'afinidad', jsonb_build_array('sombra'), 'coste', 5, 'atq', 5, 'pv', 5, 'habilidad', 'Habilidad rara ' || i));
  end loop;
end;
$$;
insert into cartas_catalogo (id, rareza, tipo, limite, obtenible, publicada) values
  ('legendaria-1', 'legendaria', 'Criatura', 1, true, true),
  ('bufon', 'limitada', 'Entidad', 5, false, true);
insert into cartas_definiciones (id, data) values
  ('legendaria-1', '{"nombre": "Legendaria", "epiteto": "", "tipo": "Criatura", "rareza": "legendaria", "afinidad": ["carne"], "coste": 7, "atq": 7, "pv": 7, "habilidad": "Cuerpo blindado"}'),
  ('bufon', '{"nombre": "El Bufón", "epiteto": "El último espectador", "tipo": "Entidad", "rareza": "limitada", "afinidad": ["arcano"], "coste": 4, "atq": 3, "pv": 3, "habilidad": "Cambio de reglas"}');
