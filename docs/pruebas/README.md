# Pruebas de la economía de cartas (entorno local)

Postgres 17 en Docker con un Supabase simulado (roles `anon` y `authenticated`, esquema `auth`, `auth.uid()` leyendo la sesión simulada). **No toca producción** y no cuesta nada. Los datos son inventados: 6 usuarios y un catálogo de 23 cartas.

## Requisitos

- Docker Desktop encendido.
- Un contenedor llamado `cartas-pruebas` (se crea una vez):

```bash
docker run -d --name cartas-pruebas -e POSTGRES_PASSWORD=pruebas -p 54329:5432 postgres:17
```

## Cómo se usa

```bash
sh docs/pruebas/cargar_local.sh prod    # esquema tal como está HOY en producción (economia-1 a economia-6)
sh docs/pruebas/cargar_local.sh todo    # lo mismo más las correcciones (economia-7, 8 y 9)
sh docs/pruebas/correr_todo.sh todo     # recarga la base y corre todas las baterías (unos 10 minutos)
sh docs/pruebas/correr_todo.sh prod     # lo mismo contra el código actual: sirve para ver qué fallos se reproducen
sh docs/pruebas/t_permisos.sh           # una sola batería (recarga antes con cargar_local.sh)
```

## Baterías

| Archivo | Qué comprueba |
|---|---|
| `t_concurrencia.sh` | Dos sesiones a la vez: dos compras al mercader con las mismas cartas (A2), aceptar un intercambio con una copia que se ofrece en otro (A3) |
| `t_topes.sh` | Cinco compras y cinco forjas a la vez contra el tope de 3 al día, ocho ofertas a la vez contra el tope de 5 abiertos, dos forjas con las mismas cartas (A9) |
| `t_permisos.sh` | Sin sesión, jugador, editor y admin: funciones de admin, funciones internas, escrituras directas, Side y nombre (A6, A7, A10) |
| `t_apuestas.sh` | Cartas del duelo desde las definiciones (A1), avisos iguales, empate, disputa, regla de 24 horas, 72 horas sin avisos, concesión, reto sin respuesta, bloqueos huérfanos, panel (A11) |
| `t_regresion.sh` | Flujos normales: regalar y quitar, reserva y límites, intercambios, mercader, forja, defensas internas, recompensas encendidas en la copia local |
| `t_explotacion.sh` | Cada receta de la forja pierde valor de media, el mercader cobra siempre más de lo que vale la carta, dos cuentas colaborando no crean valor, 45 operaciones aleatorias donde el valor total nunca sube. Imprime la diferencia de precio entre mercader y forja |
| `t_verificacion.sh` | Cerrar una apuesta con el veredicto del registro (`cartas_i_aplicar_verificacion`): solo el servidor puede, el que avisó algo falso queda anotado, el abandono, la idempotencia y los casos que no se tocan |
| `t_circulacion.sh` | La etiqueta «En circulación»: las cartas nuevas nacen fuera, solo el admin la cambia, ninguna vía automática (recompensas, forja, reserva, mercader) emite una carta fuera de circulación, quitarla no quita copias |
| `t_simultaneas.sh` | Resoluciones simultáneas de una apuesta (verificación contra avisos, rendición, admin, barrido por tiempo, jugadas y entre sí): una sola resolución, cartas movidas o devueltas una sola vez, nadie anotado dos veces |
| `t_externas.sh` | Compatibilidad con lo que no es de la economía: Hipódromo (comprar y vender cartas con tokens), cambio de Side del panel de admin y la recompensa de La Fractura (que se salta los ejemplares: sale como NOTA) |
| `t_recuperacion.sh` | El procedimiento de vuelta atrás (`economia-etapa0_respaldo.sql`): aplicar etapas, restaurar copias y comprobar que todo queda idéntico y sin perder datos |
| `t_estres.sh` | Más de 120 operaciones aleatorias simultáneas de cuatro jugadores: sin interbloqueos, sin cartas perdidas ni duplicadas, auditoría limpia |
| `t_reserva_compartida.sh` | El Buhonero y el Hipódromo reparten del mismo montón (economia-20): lo que se le da al Buhonero llega a la reserva, el Hipódromo lo vende y se prefiere la copia que no está en oferta |
| `t_crianza_unicas.sh` | Las criaturas únicas (límite global menor que 2) y los mundos con más copias que el límite no pueden criar (economia-21) |
| `t_regalos.sh` | Regalos de cartas y tokens del Admin, eventos con fechas y reclamo único del regalo (`docs/admin/regalos_eventos.sql`) |
| `t_veintiuna.sh` | Las Veintiuna Velas (`docs/veintiuna.sql`) con su mesa con amigos (`t_veintiuna_amigos.sql`: turnos, plazos, abandono, pozo de cartas y 60 rondas al azar): puntuación y reglas del blackjack, las tres reglas especiales, la carta oculta que no sale del servidor, tokens y libro, peticiones repetidas y simultáneas, permisos, desafíos y recompensas de cartas con sus límites, y el valor esperado de cada regla jugando miles de manos contra el servidor (`t_veintiuna_ev.sql`, `t_veintiuna_api.sql`). Las pruebas del navegador están en `docs/pruebas-web/veintiuna.js` |

Además, `node tools/probar-verificacion.js` prueba el veredicto en sí (volver a jugar el registro de una partida) con 120 partidas completas al azar y 60 cortadas. Cada batería parte de una base limpia (`correr_todo.sh` la recarga antes de cada una). Las pruebas con dos sesiones usan dos conexiones reales a Postgres, y la primera retiene sus candados unos segundos (una espera dentro de su transacción) para obligar a la segunda a esperar.

## Qué no cubre

- El navegador con una sesión real de Supabase (inicio de sesión, Realtime, Storage). Eso se prueba con la web publicada.
- La versión exacta del servidor de Supabase (Auth, PostgREST). Los permisos se simulan con roles de Postgres.
- La función `cartas_guardar` anterior a la corrección no está en el entorno (no se guardó en el repositorio), así que su "antes" se verificó leyendo el código de producción.
