# Editar las fichas de Estadísticas

Las fichas de combate viven en `data/stats.js` y son el punto de partida. El Admin puede
editar cualquiera desde `estadisticas.html`: abre la ficha y pulsa **Editar ficha**.

## Qué se puede editar

Nombre, rol, tipo, raza, nivel, iniciativa, PV, CA, velocidad, las seis características,
rasgos de combate, equipo, habilidades (agregar, quitar, reordenar) y estrategia. Un campo
vacío se quita de la ficha. `id` y `personajeId` no se tocan.

## Dónde se guarda

Tabla `public.stats_ediciones` (una fila por ficha editada, con la ficha completa en `data`).

- Leer: todos (Ostelar usa estas fichas para armar enemigos).
- Escribir: solo quien esté en `fichas_admins` (`fichas_es_admin()`), por RLS.
- `js/stats-ediciones.js` pone cada fila encima de la ficha original en `window.STATS`, así que
  Estadísticas, el panel de Enemigos de Roll20 y Ostelar ven la versión editada.
- **Restaurar original** borra la fila y la ficha vuelve a ser la de `data/stats.js`.
- Si cambias una ficha en `data/stats.js` y ya estaba editada, se sigue viendo la editada:
  restáurala para ver la del archivo.

## SQL

```sql
create table if not exists public.stats_ediciones (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.stats_ediciones enable row level security;
create policy stats_ediciones_select on public.stats_ediciones for select using (true);
create policy stats_ediciones_insert on public.stats_ediciones for insert with check (public.fichas_es_admin());
create policy stats_ediciones_update on public.stats_ediciones for update using (public.fichas_es_admin()) with check (public.fichas_es_admin());
create policy stats_ediciones_delete on public.stats_ediciones for delete using (public.fichas_es_admin());
-- trigger stats_ediciones_marca: pone updated_at y updated_by en cada insert/update
```
