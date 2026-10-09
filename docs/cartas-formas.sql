-- Formas de una carta (posturas o transformaciones). Cada carta puede traer en su definición un campo `formas`:
-- una lista de hasta 7 objetos { nombre, imagen, ajuste } (la carta base es la forma 0 y no va en la lista).
-- Esta migración hace que cartas_guardar valide ese campo igual que valida la imagen y el encuadre de la base:
-- nombre de 1 a 40 letras, imagen solo del almacenamiento `cartas` y encuadre con x e y de 0 a 100 y z de 1 a 3.
-- Se aplicó una vez sobre la función que había (se le añaden la variable v_forma y el bloque antes de «copiasMax»).
do $migracion$
declare
  d text := pg_get_functiondef('public.cartas_guardar(text,jsonb,boolean)'::regprocedure);
  ancla_var text := 'v_imagen text := p_data ->> ''imagen'';';
  ancla_bloque text := '  if p_data -> ''copiasMax'' is not null and';
begin
  if position('v_forma' in d) > 0 then
    raise notice 'cartas_guardar ya valida las formas';
    return;
  end if;
  if position(ancla_var in d) = 0 or position(ancla_bloque in d) = 0 then
    raise exception 'cartas_guardar cambió: hay que ajustar esta migración a mano';
  end if;
  d := replace(d, ancla_var, ancla_var || E'\n  v_forma jsonb;');
  d := replace(d, ancla_bloque, $bloque$  if p_data ? 'formas' and jsonb_typeof(p_data -> 'formas') <> 'null' then
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
$bloque$ || ancla_bloque);
  execute d;
end
$migracion$;
