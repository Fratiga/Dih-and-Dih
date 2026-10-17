-- Valor esperado de cada regla jugando miles de manos de verdad contra el servidor, con una estrategia fija (la misma que la simulación de docs/veintiuna.md).
-- Comprueba que el SQL y la simulación dicen lo mismo: si una regla estuviera mal escrita, saldría un valor esperado muy distinto. Mesa de práctica (sin tocar monedas).
create or replace function t_ev(p_regla text, p_n int, p_tb int, p_ta int, p_ts int, p_fortuna_min int default 0, p_lv_desde int default null, p_lv_hasta int default null)
returns table (ev numeric, error numeric, voluntades int, fortunas int)
language plpgsql as $$
declare
  u uuid := '00000000-0000-0000-0000-000000000003';
  s jsonb; p veintiuna_partidas%rowtype; vj record; up int; i int; x numeric; suma numeric := 0; suma2 numeric := 0; figura int := case p_regla when 'maldicion' then 11 else 10 end;
  v_vol int := 0; v_for int := 0; accion text; r int;
begin
  delete from veintiuna_partidas where user_id = u;
  for i in 1..p_n loop
    insert into veintiuna_estadisticas (user_id, proxima_regla) values (u, p_regla) on conflict (user_id) do update set proxima_regla = p_regla;
    s := veintiuna_i_repartir(u, gen_random_uuid(), 'practica', 0, veintiuna_i_mazo());
    select * into p from veintiuna_partidas where id = (s ->> 'partida')::uuid;
    while p.estado = 'en_curso' loop
      select * into vj from veintiuna_i_valor(p.jugador, p.jugador_as1, figura);
      r := (p.crupier[1] % 13) + 1;
      up := case when r = 1 then 11 when r >= 11 then figura else r end;
      if p.fase = 'fortuna' then
        accion := case when (select total from veintiuna_i_valor(p.jugador, p.jugador_as1 || array_length(p.jugador, 1), figura)) >= p_fortuna_min then 'fortuna' else 'aceptar' end;
        if accion = 'fortuna' then v_for := v_for + 1; end if;
      elsif vj.total >= 21 then accion := 'plantar';
      elsif (case when vj.blando then vj.total >= (case when up >= 9 then 19 else p_ts end) else vj.total >= (case when up >= 7 then p_ta else p_tb end) end) then
        accion := case when p_regla = 'voluntad' and p_lv_desde is not null and vj.total between p_lv_desde and p_lv_hasta and not p.voluntad_usada then 'voluntad' else 'plantar' end;
        if accion = 'voluntad' then v_vol := v_vol + 1; end if;
      else accion := 'pedir';
      end if;
      perform veintiuna_i_aplicar(p.id, accion);
      select * into p from veintiuna_partidas where id = p.id;
    end loop;
    x := p.neto / p.apuesta;
    suma := suma + x; suma2 := suma2 + x * x;
    delete from veintiuna_partidas where id = p.id;
  end loop;
  ev := suma / p_n; error := sqrt(greatest(suma2 / p_n - (suma / p_n) ^ 2, 0)) / sqrt(p_n); voluntades := v_vol; fortunas := v_for;
  return next;
end $$;
