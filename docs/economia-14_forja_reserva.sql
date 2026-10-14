-- ECONOMÍA DE CARTAS, parte 14: la forja nunca destruye cartas. Las copias que se entregan vuelven a la reserva (y de ahí al reparto).
-- Decisión del usuario del 13-oct-2026: ni siquiera existe la opción de destruir. Se puede correr más de una vez.
update cartas_recetas set destino = 'reserva' where destino <> 'reserva';
alter table cartas_recetas alter column destino set default 'reserva';

-- Aunque alguien mande otra cosa (el panel, una llamada directa o un SQL a mano), el destino siempre queda en 'reserva'
create or replace function cartas_trg_recetas_reserva()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.destino := 'reserva';
  return new;
end;
$$;
drop trigger if exists cartas_recetas_reserva on cartas_recetas;
create trigger cartas_recetas_reserva before insert or update on cartas_recetas
  for each row execute function cartas_trg_recetas_reserva();
revoke all on function cartas_trg_recetas_reserva() from public, anon, authenticated;
