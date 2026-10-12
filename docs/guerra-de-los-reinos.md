# La Fractura (antes «Guerra de los Reinos»)

Estrategia por turnos con soldados que tienen nombre, familia e historia. Página: `fractura.html`, oculta (solo admin) y en «En pruebas» del hub de minijuegos.

## Lo que ya está hecho

- **Mapa** 13×13 simétrico, siempre conectado, con fragmentos de lugares del compendio, costuras entre fragmentos, ruinas, fortalezas con guardianes y el Núcleo del Sueño. Cinco tipos de Fractura.
- **Motor** de reglas determinista (`js/fractura-motor.js`): movimiento por casillas, combate con represalia, niebla de guerra, 6 recursos, edificios con especialización de ciudad, 3 escuelas de desarrollo, estabilidad de regiones, sucesos, reliquias en el suelo y estado del líder caído.
- **Seis facciones** (Caballeros del Reino, Academia Arcana de Dolbred, Trono de Ceniza, Compañía Dorada, Hijos del Acero, Peregrinos del Alba) con ventajas y clases propias.
- **IA** con tres dificultades. El rival crece con tu ejército.
- **Soldados con identidad**: nombre, casa, características ocultas, victorias, rangos (Recluta a Leyenda), apodos, especializaciones de veterano y cicatrices.
- **Campaña por cuenta** (`js/fractura-campana.js`): contingente limitado, capitanes y compañías, heridos graves en vez de muerte segura, luto por los caídos, compañeros de armas, némesis que vuelven, hijos y casas con árbol, retiro y vejez, reliquias heredables con su historial de propietarios.
- **Crónica** narrada de cada guerra (`js/fractura-cronica.js`) y **historia del mundo** con las guerras de todos.
- **Guerras entre jugadores** por turnos, asíncronas. Las dos partes reconstruyen la misma guerra desde la semilla y las acciones guardadas. No dan cartas.
- **Premio en cartas** por ganar contra la IA (el servidor elige la rareza según los logros).

## SQL (en `scratchpad/`, correr en este orden)

1. `fractura.sql`: ejércitos por cuenta, historia de guerras y premios.
2. `fractura_pvp.sql`: partidas entre jugadores. Reemplaza dos funciones de la primera (registrar y premio) para marcar las guerras entre jugadores.

Sin el SQL el juego funciona igual, pero solo guarda en este navegador.

## Decisiones que se tomaron

- **No hay personajes del canon.** Los líderes y soldados son inventados. Los personajes del compendio tienen lado y secretos de campaña, y usarlos filtraría información. Se puede añadir una lista de «ecos» por lado más adelante.
- **La Fractura** se trata como un lugar fuera de la continuidad. No hay entrada en el compendio hasta que se apruebe.
- **Contingente limitado** (6, y sube con las guerras ganadas): solo quien va a la guerra gana experiencia o muere.
- **Heridos graves.** Al caer, un soldado tiene entre un 40 y un 65 % de sobrevivir herido y fuera de dos guerras. Sin eso el ejército se vaciaba.

## Pendiente o por pulir

- Probar con jugadores reales las guerras entre jugadores (las pruebas en Node confirman que repetir las acciones reproduce la misma guerra).
- Balance: la Compañía Dorada sigue por debajo del resto; el ritmo de rangos y herencias se ajusta jugando.
- La interfaz móvil funciona pero no se ha revisado a fondo.
- Ideas sin hacer: relaciones entre soldados distintas de familia y compañeros (rivales, amigos), estandartes con más efectos, eventos de región con elecciones, eco de personajes del canon por lado.
