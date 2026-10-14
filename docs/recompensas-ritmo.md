# Recompensas de Zarabanda y Parranda

Antes estos dos juegos no daban cartas. Ahora tienen recompensas (migración `docs/economia-19_ritmo_recompensas.sql`), pensadas **exigentes** y calculadas por los **puntos ganados** en la canción, no por el rango (en una canción corta o fácil sacar una S es sencillo; los puntos, en cambio, dependen de cuántas notas se tocan y del combo). Nacen **apagadas**: se encienden en Admin → Economía → Juegos y recetas (tarjetas de Zarabanda y Parranda).

## Cuándo cuenta una partida
- Solo una canción **completa** y **jugada de verdad**: la práctica y las pruebas del editor no dan nada, y quedarse sin vida tampoco.
- Mínimo 50 segundos de partida.
- Una **precisión mínima** del 80 % (para que una canción larguísima no se gane a base de puntos con una precisión mediocre). Se cambia en el panel; 0 la quita.
- Como en los demás juegos, el resultado lo informa el navegador y el servidor no puede comprobarlo; lo que limita el daño es lo exigente de las condiciones y los topes por día (2 cartas al día en cada juego, 6 entre todos).

## Puntos necesarios (valores iniciales, todo editable en el panel)
Referencia de la mesa: mediana en Difícil 285.000 puntos, en Experto 350.000; máximo visto, 1.054.000. «-1» significa que ese tramo no existe en esa dificultad.

| Dificultad | Un sello desde | Bueno desde | Excelente desde | Extraordinario desde |
|---|---|---|---|---|
| Fácil | no da nada | | | |
| Normal | 350.000 | -1 | -1 | -1 |
| Difícil | 300.000 | 400.000 | 550.000 | -1 |
| Experto | 350.000 | 500.000 | 700.000 | 900.000 |

Los puntos tienen que subir de «sello» a «extraordinario». «Bueno», «excelente» y «extraordinario» son los tramos de siempre.

## Probabilidades y cartas
- Probabilidad de carta dentro de cada tramo: bueno 35 %, excelente 55 %, extraordinario 80 % (más bajas que en el resto de juegos). Se multiplica por el factor del día (1ª carta ×1, 2ª ×0,5).
- Rarezas: bueno 85 % común / 15 % poco común; excelente 20 % común / 60 % poco común / 20 % rara; extraordinario 40 % poco común / 60 % rara.
- Ocho sellos (no cinco) para ganar una carta por sellos.
- Sin filtro de tipos: cualquier carta en circulación. Se puede limitar por tipo o por cartas concretas desde el panel, en cada tramo.

## Cómo se manda al servidor
El juego avisa al empezar la canción (`Recompensas.iniciar("zarabanda" | "parranda", dificultad)`) y al terminar (`Recompensas.terminar(...)`) con la puntuación = **puntos × 10000 + precisión en décimas de %** (950 = 95,0 %). El servidor lo separa, aplica la precisión mínima y busca el tramo más alto cuyos puntos mínimos se alcanzan (`cartas_juegos.valores`).
