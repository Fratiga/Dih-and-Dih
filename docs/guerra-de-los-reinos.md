# Guerra de los Reinos (La Fractura): borrador de diseño

Idea reunida de tres propuestas. Nada de esto está construido ni aprobado. Sirve para decidir antes de programar.

## Qué es

Juego de estrategia por turnos sobre un mapa por casillas (unos 12×12 al principio). Cada jugador lleva una facción del mundo y un ejército de soldados con nombre, historia y descendencia. Las partidas duran 20 a 40 turnos y dejan una crónica.

## Ambientación: La Fractura

Los combates ocurren en la Fractura, un espacio fuera del mundo conocido hecho de fragmentos de lugares, sueños y recuerdos. Resuelve dos problemas:

- Lugares y facciones de regiones distintas pueden compartir tablero sin contradecir la geografía del canon.
- Lo que pasa en una partida no cambia el canon de la campaña. Si alguien conquista Brurland, cae una representación de Brurland dentro de la Fractura.

Tres capas, que no se mezclan:

1. **Canon**: personajes, lugares y hechos como están en el compendio. No cambian por una partida.
2. **Fractura**: la versión jugable (regiones aisladas, duplicadas o conectadas por «costuras»).
3. **Crónica de guerra**: lo que ocurrió en cada partida (conquistas, caídos, casas militares).

**Decisión de lore pendiente (es del DM):** la Fractura y el Núcleo del Sueño serían elementos nuevos del mundo. No entran al compendio hasta que se aprueben.

## Soldados con identidad

Cada soldado es una ficha: nombre, procedencia, edad, clase, victorias, rango, equipo, padre y fecha de muerte.

- Rangos por victorias: Recluta (0-4), Soldado (5-14), Veterano (15-29), Élite (30-49), Leyenda (50+).
- Al llegar a Veterano se elige una especialización (guardia, duelista, explorador, tirador, rompelíneas). Sin habilidades activas.
- Linajes: un soldado veterano puede quedar «establecido» y tener descendencia. Herencia orientativa: 60 % propia de la clase, 20 % del padre, 20 % de azar.
- Capitanes: el jugador nombra a pocos (por ejemplo 3). Llevan un objeto extra (estandarte).
- Objetos con historia: al morir un portador se recuperan y se eligen heredero; cada objeto recuerda sus propietarios.
- Relaciones (compañeros, hermanos, rivales) que se generan en momentos importantes y dan pequeños bonos.
- Salón de los Caídos con la historia de cada soldado.

## Lo demás

- **Civilizaciones**: facciones del compendio con una ventaja cada una.
- **Clases de unidad**: guerrero, cazador, arcanista, paladín, pícaro.
- **Recursos** (3 al principio): comida, materiales, oro. Más adelante mineral, maná y ánima.
- **Ciudades**: producen recursos y reclutan; luego, especialización (militar, económica, mágica).
- **Estabilidad dimensional** por región: las estables se defienden mejor; las inestables cambian conexiones, generan criaturas o alteran recursos.
- **Mapas por tipo de fractura**: Reinos, Sueño de los Muertos, Jardín Imposible, Archivo Hundido, Horizonte Roto.
- **Crónica e historia del mundo**: relato automático de cada partida y estadísticas acumuladas.
- **Premios**: cartas por ganar guerras, derrotar facciones concretas o conquistar regiones especiales.

## Qué se reutiliza

- Motor por turnos sobre cuadrícula y clases: Ostelar.
- Partidas entre jugadores guardadas en el servidor: Ajedrez, Arquería, batalla de Triunfos.
- Facciones, razas, lugares y objetos: datos del compendio.
- Cartas como premio: Triunfos.

## Lo que cambia por tener un ejército que dura

- Hay que guardar el ejército por cuenta (tabla en Supabase con RLS): es una campaña, no un minijuego suelto.
- La muerte permanente pesa más contra otro jugador; mejor dejar eso para una fase posterior.
- Hay que ajustar el ritmo de rangos y herencias jugando; si no, nadie llega a ver un ascenso.

## Fases propuestas

1. Partida contra la IA con soldados con identidad guardados por cuenta (nombre, victorias, rango, muerte, Salón de los Caídos).
2. Linajes, objetos con historial y crónica de cada partida.
3. Capitanes, relaciones y estandartes.
4. Jugador contra jugador, mapas por tipo de fractura y premios en cartas.

## Pendiente de decidir

- ¿Se empieza por la fase 1 contra la IA?
- ¿Se aprueba la Fractura como parte del lore, o se plantea sin explicar el origen?
- ¿Qué facciones entran primero?
