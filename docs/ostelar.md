# Ostelar

Arena de combate puro: sin diálogos, sin roleplay. Los jugadores usan alzados predeterminados o copias de sus personajes caídos, pelean contra enemigos controlados por IA (después, contra otros jugadores), suben hasta el nivel 20 y encuentran equipo según los rivales.

Página: `ostelar.html` (oculta, solo admin, igual que Duelo y Ajedrez; aparece en la pestaña Ocultos del admin).

## Decisiones

- **Combate por turnos sobre cuadrícula** (14 x 9), reglas de D&D 5e simplificadas. Inspiración de Mewgenics: tablero chico, terreno que importa (fuego, pinchos, barro, rocas), empujones con daño por choque y fuego amigo.
- **El mapa depende de cuántas fichas pelean:** 8x6 (hasta 3), 10x7 (hasta 5), 12x8 (hasta 8), 14x9 (hasta 11) y 16x10. Seis temas de terreno: claro, ruinas, pozo de fuego, pantano, puente y salón de pilares. Los flancos de cada bando siempre quedan libres y el mapa siempre es conexo.
- **Grupo de 1 a 4**, mezclando alzados y copias de fichas.
- **Las fichas se copian.** El alzado de Ostelar sube por su cuenta; la ficha de campaña no se toca.
- **Todo lo automatizable, desde el principio.** Los conjuros son datos (`VH.CONJUROS`) y el motor solo interpreta campos. Lo que no se puede leer de una ficha (texto libre) aparece como "sin automatizar".
- Ostelar devuelve a todos al terminar: no hay muerte permanente. Perder da un 20 % de la experiencia.

## Archivos

| Archivo | Qué hace |
| --- | --- |
| `js/ostelar-reglas.js` | Dados, tabla de XP, condiciones, catálogo de conjuros, armaduras, afijos del botín |
| `js/ostelar-datos.js` | Clases predeterminadas, conversión de fichas y de `data/stats.js` a unidades, generador de encuentros y de botín |
| `js/ostelar-combate.js` | Motor: mapa, turnos, movimiento, ataques, conjuros, áreas, empujones, IA |
| `js/ostelar.js` | Pantallas: salón, arena (canvas), resultado |
| `css/ostelar.css` | Estilos |

## Hecho (fase 1)

- 7 clases predeterminadas nivel 1 a 20 (guerrero, bárbaro, pícaro, mago, clérigo, paladín, explorador) con sus rasgos principales.
- Copia de fichas (ataques, conjuros con nombre conocido o con daño legible, espacios, PV, CA, competencia que sube con el nivel).
- Enemigos desde `data/stats.js`: acciones leídas con `statsR20Leer`; rasgos pasivos y reacciones se muestran como texto.
- 31 conjuros automatizados (trucos hasta nivel 9) con áreas (esfera, explosión, cono, línea), escalado por espacio, concentración, empuje.
- Botín (armas con bonus y afijos, armaduras, escudos, accesorios), reserva compartida, equipar.
- Progreso en localStorage del navegador (`compendioOstelar`).

## Falta

1. **Guardado en la cuenta** (Supabase), para que el salón siga entre dispositivos.
2. **Rasgos de las fichas**: leer `rasgos` y `macros` de la ficha y convertir los reconocibles (furia, ataque furtivo, imposición de manos, etc.).
3. **Reacciones** (ataque de oportunidad, contraataque) y rasgos pasivos de los enemigos (Depredador, Formación cerrada...).
4. **Más conjuros** y objetivos múltiples para dardos y rayos.
5. **Jugador contra jugador**: asíncrono (el equipo de un jugador defiende) o por turnos en vivo.
6. **Equilibrio** por encima del nivel 12: hay pocos enemigos de nivel alto; hoy se suben de rango los de nivel bajo.
7. Más temas de mapa, mapas fijos para jefes y enemigos con afijos caóticos.
