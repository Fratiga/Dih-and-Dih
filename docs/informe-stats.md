# Informe de estadísticas (data/stats.js)

Generado con `node tools/informe-stats.js`. No se modificó `data/stats.js`.

## Criterio

- El archivo no tiene valor de desafío. Se usa `nivel` en su lugar, con la tabla de competencia de 5e: 0 a 4 → +2, 5 a 8 → +3, 9 a 12 → +4, 13 a 16 → +5, 17 a 20 → +6.
- Bono de ataque esperado: competencia + modificador. Como el texto no dice qué atributo usa cada ataque, se acepta cualquiera de FUE, DES, INT, SAB o CAR. Solo aparece en la tabla si ninguno cuadra. En "esperado" va el de FUE o DES más cercano.
- CD esperada: 8 + competencia + modificador, aceptando cualquier atributo. En "esperado" va el valor más cercano al actual.
- PV: el archivo no tiene dados de golpe. Para cada bloque se busca la expresión NdX + N×CON (X entre 6 y 12) que más se acerca al PV. Se considera coherente si el total queda a 1 o menos. Como el número de dados es libre, casi siempre cuadra; lo útil es ver cuántos dados implica cada PV. El número de dados no se fuerza a ser igual al nivel; se muestra la comparación en la segunda tabla.
- Los bloques sin `nivel` numérico (milicianos, nombres propios sin nivel, etc.) no se pueden validar contra una competencia. Sí entran en la tabla de PV. Para ellos solo se comprueba que exista una competencia entre 2 y 6 que explique el número.
- Algunas diferencias son intencionales. Esta tabla solo señala las que no salen con la regla.

## Resumen

- Ataques revisados: 66, coherentes: 54.
- CD revisadas: 85, coherentes: 72.
- PV revisados: 49, coherentes: 48.
- Diferencias en la tabla: 26.

## Bloques que no se pudieron comprobar

- adam-kovacs: sin atributos (stats), no se puede calcular.
- miliciano-brurland: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- arquero-milicia: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- sargento-milicia: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- caballero-brurland: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- alma-errante: sin atributos (stats), no se puede calcular.
- darian: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- coronel-tobi: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- baltasar-sorel: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- elias-morcant: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).
- nico: sin nivel/VD numérico, no se valida la competencia (solo plausibilidad).

## PV: dados de golpe inferidos

| bloque | pv | expresión inferida | nivel | coherente | nota |
|---|---|---|---|---|---|
| rook | 145 | 17d8+68 (media 144) | 8 | sí | 17 dados frente a nivel 8 |
| bull | 95 | 10d10+40 (media 95) | 5 | sí | 10 dados frente a nivel 5 |
| garra | 80 | 12d6+36 (media 78) | 5 | no, error +2 | 12 dados frente a nivel 5. Alternativas: 11d8+33 (82), 9d10+27 (76) |
| baraja | 55 | 10d8+10 (media 55) | 4 | sí | 10 dados frente a nivel 4 |
| verdam | 180 | 24d6+96 (media 180) | 20 | sí | 24 dados frente a nivel 20 |
| eklino | 42 | 5d10+15 (media 42) | 3 | sí | 5 dados frente a nivel 3 |
| aldeano-comun | 8 | 2d6+0 (media 7) | 0 | sí | 2 dados frente a nivel 0 |
| miliciano-brurland | 28 | 5d6+10 (media 27) | — | sí | sin nivel |
| arquero-milicia | 20 | 3d10+3 (media 19) | — | sí | sin nivel |
| sargento-milicia | 45 | 7d6+21 (media 45) | — | sí | sin nivel |
| caballero-brurland | 75 | 10d6+40 (media 75) | — | sí | sin nivel |
| kobold | 12 | 3d8+0 (media 13) | 1 | sí | 3 dados frente a nivel 1 |
| restos-de-ledros | 32 | 5d6+15 (media 32) | 3 | sí | 5 dados frente a nivel 3 |
| colmillo-gris | 52 | 8d6+24 (media 52) | 3 | sí | 8 dados frente a nivel 3 |
| guillotina | 180 | 24d6+96 (media 180) | 7 | sí | 24 dados frente a nivel 7 |
| dragarto | 48 | 5d12+15 (media 47) | 3 | sí | 5 dados frente a nivel 3 |
| protodraco | 145 | 17d6+85 (media 144) | 6 | sí | 17 dados frente a nivel 6 |
| guiverno | 210 | 20d8+120 (media 210) | 9 | sí | 20 dados frente a nivel 9 |
| draco | 260 | 18d10+162 (media 261) | 12 | sí | 18 dados frente a nivel 12 |
| dragonante | 340 | 22d12+198 (media 341) | 16 | sí | 22 dados frente a nivel 16 |
| dragon | 1500 | 77d8+1155 (media 1501) | 20 | sí | 77 dados frente a nivel 20 |
| voss | 34 | 6d8+6 (media 33) | 4 | sí | 6 dados frente a nivel 4 |
| billy | 58 | 7d6+35 (media 59) | 5 | sí | 7 dados frente a nivel 5 |
| victor | 31 | 7d6+7 (media 31) | 4 | sí | 7 dados frente a nivel 4 |
| torvrena | 48 | 5d10+20 (media 47) | 4 | sí | 5 dados frente a nivel 4 |
| rojo-ultimo-apunte | 42 | 5d12+10 (media 42) | 4 | sí | 5 dados frente a nivel 4 |
| verde-ultimo-apunte | 34 | 6d8+6 (media 33) | 4 | sí | 6 dados frente a nivel 4 |
| morado-ultimo-apunte | 36 | 5d10+10 (media 37) | 4 | sí | 5 dados frente a nivel 4 |
| amarillo-ultimo-apunte | 52 | 8d6+24 (media 52) | 4 | sí | 8 dados frente a nivel 4 |
| azul-ultimo-apunte | 35 | 8d6+8 (media 36) | 4 | sí | 8 dados frente a nivel 4 |
| gris-ultimo-apunte | 46 | 7d6+21 (media 45) | 4 | sí | 7 dados frente a nivel 4 |
| darian | 126 | 12d12+48 (media 126) | — | sí | sin nivel |
| coronel-tobi | 115 | 11d10+55 (media 115) | — | sí | sin nivel |
| baltasar-sorel | 75 | 10d6+40 (media 75) | — | sí | sin nivel |
| elias-morcant | 58 | 9d6+27 (media 58) | — | sí | sin nivel |
| nico | 48 | 5d12+15 (media 47) | — | sí | sin nivel |
| restos-de-ledros-piedra | 32 | 5d6+15 (media 32) | 3 | sí | 5 dados frente a nivel 3 |
| restos-de-ledros-madera | 32 | 5d6+15 (media 32) | 3 | sí | 5 dados frente a nivel 3 |
| restos-de-ledros-barro | 42 | 5d10+15 (media 42) | 3 | sí | 5 dados frente a nivel 3 |
| desollado | 160 | 19d8+76 (media 161) | 5 | sí | 19 dados frente a nivel 5 |
| acechador-descabezado | 150 | 20d6+80 (media 150) | 5 | sí | 20 dados frente a nivel 5 |
| mortaja-de-ojos | 142 | 19d6+76 (media 142) | 5 | sí | 19 dados frente a nivel 5 |
| gigante-velludo | 200 | 21d8+105 (media 199) | 5 | sí | 21 dados frente a nivel 5 |
| segador-acorazado | 150 | 20d6+80 (media 150) | 5 | sí | 20 dados frente a nivel 5 |
| callador | 120 | 16d8+48 (media 120) | 5 | sí | 16 dados frente a nivel 5 |
| miron | 125 | 23d6+46 (media 126) | 5 | sí | 23 dados frente a nivel 5 |
| colgado | 180 | 19d8+95 (media 180) | 5 | sí | 19 dados frente a nivel 5 |
| reptil-indestructible | 230 | 20d8+140 (media 230) | 7 | sí | 20 dados frente a nivel 7 |
| perseguidor | 190 | 20d6+120 (media 190) | 5 | sí | 20 dados frente a nivel 5 |

## Diferencias

| bloque | campo | valor actual | valor esperado | nota |
|---|---|---|---|---|
| rook | Arpón (Acción) (ataque) | +10 | +9 | Competencia +3 (nivel 8). FUE +7, DES +9, INT +4, SAB +6, CAR +3. |
| rook | Degüello (Acción) (ataque) | +10 | +9 | Competencia +3 (nivel 8). FUE +7, DES +9, INT +4, SAB +6, CAR +3. |
| rook | Degüello (Acción) (CD) | 18 | 17 | 8 + competencia +3 + mod. Más cercano: DES. DES 17, FUE 15, SAB 14, INT 12, CAR 11, CON 15. |
| garra | pv | 80 | 78 (12d6+36) | Ninguna combinación d6 a d12 con la CON +3 da este total exacto. Más cercana: 12d6+36. |
| guillotina | Desmembrar (Recarga 5-6) (ataque) | +10 | +9 | Competencia +3 (nivel 7). FUE +9, DES +7, INT +0, SAB +7, CAR +1. |
| guiverno | Mordida (Acción) (ataque) | +12 | +11 | Competencia +4 (nivel 9). FUE +11, DES +10, INT +1, SAB +7, CAR +4. |
| guiverno | Garra (Acción) (ataque) | +12 | +11 | Competencia +4 (nivel 9). FUE +11, DES +10, INT +1, SAB +7, CAR +4. |
| guiverno | Cola (Acción) (ataque) | +12 | +11 | Competencia +4 (nivel 9). FUE +11, DES +10, INT +1, SAB +7, CAR +4. |
| draco | Embestida Brutal (Pasiva) (CD) | 23 | 22 | 8 + competencia +4 + mod. Más cercano: FUE. FUE 22, SAB 15, DES 14, CAR 13, INT 10, CON 21. |
| draco | Mordida (Acción) (ataque) | +15 | +14 | Competencia +4 (nivel 12). FUE +14, DES +6, INT +2, SAB +7, CAR +5. |
| draco | Garra (Acción) (ataque) | +15 | +14 | Competencia +4 (nivel 12). FUE +14, DES +6, INT +2, SAB +7, CAR +5. |
| draco | Cola (Acción) (ataque) | +15 | +14 | Competencia +4 (nivel 12). FUE +14, DES +6, INT +2, SAB +7, CAR +5. |
| draco | Cola (Acción) (CD) | 23 | 22 | 8 + competencia +4 + mod. Más cercano: FUE. FUE 22, SAB 15, DES 14, CAR 13, INT 10, CON 21. |
| draco | Pisotón (Acción Especial) (CD) | 23 | 22 | 8 + competencia +4 + mod. Más cercano: FUE. FUE 22, SAB 15, DES 14, CAR 13, INT 10, CON 21. |
| dragonante | Segunda Fase — Ascensión Dracónica (Rasgo especial) (CD) | 25 | 22 | 8 + competencia +5 + mod. Más cercano: FUE. FUE 22, CAR 18, DES 17, SAB 17, INT 16, CON 22. |
| dragon | Presencia Aterradora (Acción) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Mordida (Acción) (ataque) | +27 | +21 | Competencia +6 (nivel 20). FUE +21, DES +15, INT +16, SAB +17, CAR +19. |
| dragon | Mordida (Acción) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Garra (Acción) (ataque) | +27 | +21 | Competencia +6 (nivel 20). FUE +21, DES +15, INT +16, SAB +17, CAR +19. |
| dragon | Cola (Acción) (ataque) | +27 | +21 | Competencia +6 (nivel 20). FUE +21, DES +15, INT +16, SAB +17, CAR +19. |
| dragon | Cola (Acción) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Aliento del Dragón (Recarga 4-6) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Acciones Legendarias (hasta 5 por ronda) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Acciones Legendarias (hasta 5 por ronda) (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Segunda Fase — El Dragón Desatado (Rasgo especial) (CD) | 35 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
| dragon | Muerte (CD) | 30 | 29 | 8 + competencia +6 + mod. Más cercano: FUE. FUE 29, CAR 27, SAB 25, INT 24, DES 23, CON 29. |
