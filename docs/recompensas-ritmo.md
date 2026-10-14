# Recompensas de Zarabanda y Parranda

Antes estos dos juegos no daban cartas. Ahora tienen recompensas (migración `docs/economia-19_ritmo_recompensas.sql`), pensadas **exigentes**. Nacen **apagadas**: se encienden en Admin → Economía → Juegos y recetas (tarjetas de Zarabanda y Parranda).

## Cuándo cuenta una partida
- Solo una canción **completa** y **jugada de verdad**: la práctica y las pruebas del editor no dan nada, y quedarse sin vida tampoco.
- Mínimo 50 segundos de partida.
- Como en los demás juegos, el resultado lo informa el navegador y el servidor no puede comprobarlo; lo que limita el daño es la dificultad de las condiciones y los topes por día (2 cartas al día en cada juego, 6 entre todos).

## Qué da cada resultado (valores iniciales, todo editable en el panel)
El rango sale de la precisión: **S** 95 %, **A** 88 %, **B** 75 %, **C** 60 %.

| Dificultad | S | A | B | C | Bonus «sin fallos» (con S) |
|---|---|---|---|---|---|
| Fácil | nada | nada | nada | nada | |
| Normal | solo un sello | nada | nada | nada | |
| Difícil | bueno | solo un sello | nada | nada | +2 (llega a excelente) |
| Experto | excelente | bueno | solo un sello | nada | +1 (llega a extraordinario) |

«Sin fallos» = ni un fallo ni una pulsación de más. «Bueno», «excelente» y «extraordinario» son los tramos de siempre (puntaje 1, 3 y 4 contra los umbrales del juego).

## Probabilidades y cartas
- Probabilidad de carta dentro de cada tramo: bueno 35 %, excelente 55 %, extraordinario 80 % (más bajas que en el resto de juegos). Se multiplica por el factor del día (1ª carta ×1, 2ª ×0,5).
- Rarezas: bueno 85 % común / 15 % poco común; excelente 20 % común / 60 % poco común / 20 % rara; extraordinario 40 % poco común / 60 % rara.
- Ocho sellos (no cinco) para ganar una carta por sellos.
- Sin filtro de tipos: cualquier carta en circulación. Se puede limitar por tipo o por cartas concretas desde el panel, en cada tramo.

## Cómo se manda al servidor
El juego avisa al empezar la canción (`Recompensas.iniciar("zarabanda" | "parranda", dificultad)`) y al terminar (`Recompensas.terminar(...)`) con la puntuación = precisión en décimas de % (950 = 95,0 %), más 10000 si no hubo ningún fallo ni pulsación de más. El servidor recalcula el rango y el puntaje con la configuración (`cartas_juegos.valores`).
