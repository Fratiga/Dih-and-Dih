# Estocatta

Duelo de esgrima en tiempo real inspirado en Nidhogg. Dos esgrimistas en una pista horizontal; gana quien cruza la puerta del rival. Un golpe limpio mata, el caído reaparece delante de quien lo mató y la partida sigue. Es **pública** desde el 26-nov-2026: tarjeta en Minijuegos y máquina en la Sala recreativa de la taberna. El modo en línea necesita el servidor desplegado.

## Archivos

| Archivo | Qué hace |
|---|---|
| `servidor/estocatta/estocatta-sim.js` | Las reglas. Simulación determinista a 30 ticks por segundo. La cargan el servidor y el navegador: no hay dos versiones de las reglas. |
| `servidor/estocatta/servidor.js` | Servidor autoritativo: salas de dos plazas con código, cuentas de Supabase, reconexión, abandono y registro del resultado. |
| `servidor/estocatta/pruebas-local.js` | El mismo servidor con cuentas de prueba (`prueba:<id>:<nombre>`) y sin base de datos. Solo para este ordenador; nunca se despliega. |
| `servidor/estocatta/test/` | 36 pruebas de reglas y 19 de red (`npm test`). |
| `estocatta.html`, `css/estocatta.css` | La página: el lienzo y los menús encima. |
| `js/estocatta-sprites.js` | Arte: letra de píxeles, esgrimistas con articulaciones, capa y sombrero, maniquí y efectos. |
| `js/estocatta-mundo.js` | El claustro: capas con parallax, luz, partículas, estandartes, puertas y manchas. |
| `js/estocatta-cliente.js` | Escenas, cámara, teclas, autómatas, modo local, escuela y cliente en línea. |
| `js/estocatta-config.js` | Dirección del servidor en línea (vacía hasta desplegarlo). |
| `docs/estocatta.sql` | Tabla `estocatta_partidas` y función `estocatta_registrar`. |

## Reglas (resumen; el detalle está en la simulación y sus pruebas)

- **Alturas.** La espada va alta, media o baja. La estocada hiere solo a su altura; el tajo barre dos o tres. De pie se ocupan las tres alturas, agachado media y baja, en el aire alta y media.
- **Fases.** Todo ataque tiene preparación (se ve venir), impacto y recuperación (vulnerable). Un ataque fallido deja hueco para castigar.
- **Defensa.** La guardia cubre solo su altura, solo hacia delante, y se cansa a los 1,4 s. La parada es un golpe de tiempo (130 ms): bien medida aturde al atacante y da contragolpe; mal medida deja 320 ms de recuperación.
- **Choque.** Dos golpes a la vez a la misma altura chocan; a distinta altura, mueren los dos.
- **Terreno.** Quien mata se lleva la ventaja; el caído reaparece 720 unidades delante de él, hacia la salida de quien mató, con 1,5 s de protección que se pierde al atacar o fintar. Los cuerpos no se atraviesan salvo saltando por encima.
- **Fin.** Cruzar la puerta del rival gana. Al acabarse los 3 minutos: más terreno; si hay empate, más bajas; si sigue igual, muerte súbita de 25 s sin reapariciones; si nadie muere, empate.
- **Desconexión.** La partida se congela 12 s; si el ausente no vuelve, pierde por abandono.

Todas las cifras están en `CFG` al principio de `estocatta-sim.js`.

## Presentación

- **Dirección artística.** Un claustro en ruinas de noche, en pixel art de 480×270 ampliado sin suavizado. La paleta es índigo nocturno y fuego de antorcha. Los bandos se distinguen solo por el color: carmesí y turquesa.
- **Escenas.**
  - **Portada:** duelo de autómatas de fondo y menú con cursor de espada.
  - **Puerta de los retos:** tablón con el reto clavado; los dos esgrimistas esperan o saludan según estén listos.
  - **Combate:** «VS» con cuenta atrás, HUD de estandartes con muescas de bajas, cuerda de la pista y «¡ADELANTE!» cuando el camino está libre.
  - **Juicio:** el vencedor bajo un foco, el vencido de rodillas y el pergamino que se desenrolla.
  - **Escuela:** libro de lecciones, maniquí con guardia elegible o autómata.
  - **Pausa:** solo en la mesa local.
- **Vida.**
  - **Mundo:** parallax de siete capas, antorchas con brasas, murciélagos, luz por bloques a media resolución y faroles colgantes.
  - **Bandos:** estandartes que se tiñen del color de quien avanza y puertas cuyo rastrillo sube cuando se acerca quien tiene la ventaja.
  - **Golpes:** sangre que queda en el suelo, sombreros que salen volando, capas con física y polvo al correr y aterrizar.
  - **Impacto:** pausa breve, temblor, sonido sintetizado y transición de puntos entre escenas.
- **Rendimiento.** Unos 1,5 ms por fotograma en la portada y 3,5 ms en combate, medidos sin tarjeta gráfica. Los menús van a 30 fps y el bucle se duerme fuera de pantalla. `estado.msDibujo` guarda la media.

## Cómo probar

```bash
cd servidor/estocatta && npm install && npm test
```

Para jugar en línea en este ordenador:

```bash
cd servidor/estocatta && node pruebas-local.js
```

Abre `estocatta.html?servidor=ws://localhost:8787` en dos pestañas. En la consola de cada una pon una cuenta de prueba distinta, por ejemplo `window.fichasSesionActual = async () => ({ access_token: "prueba:ana:Ana", user: { id: "ana" } })`.

## Desplegar el servidor (gratis, en Render)

1. **Crear el servicio:** en render.com, «New › Web Service» con este repositorio y la rama `main`.
2. **Configurarlo:**
   - Root Directory: `servidor/estocatta`
   - Build: `npm install`
   - Start: `node servidor.js`
   - Plan: Free
3. **Variables de entorno:**
   - `SUPABASE_SERVICE_KEY`: la clave `service_role` de Supabase. Solo vive en Render; no va nunca al repositorio.
   - `SOLO_ADMIN` (opcional): `1` para dejar entrar solo al admin; sin ella entra cualquier cuenta.
   - `ORIGENES` (opcional): por defecto `https://fratiga.github.io`.
4. **Base de datos:** pegar `docs/estocatta.sql` en el editor SQL de Supabase.
5. **Conectar la página:** poner la dirección del servicio en `js/estocatta-config.js` con `wss://`, por ejemplo `wss://estocatta.onrender.com`, y subir la versión de caché.

Límites del plan gratuito (comprobados en noviembre de 2026):
- **Reposo:** el servicio se duerme tras 15 minutos sin tráfico y tarda alrededor de un minuto en despertar. La página lo avisa («El heraldo despierta al servidor») y reintenta sola. Mientras haya mensajes por WebSocket no se duerme.
- **Horas:** hay 750 horas gratis al mes por cuenta.
- **Reinicios:** un despliegue o un reinicio corta las partidas en curso; el cliente reintenta cuatro veces.

## Decisiones

- **Sin Phaser ni TypeScript:** son 2.000 líneas de JavaScript clásico. La simulación es común a servidor y navegador, y un canvas de 480×270 no necesita más motor.
- **Sin Colyseus:** un servidor propio con `ws` (una sola dependencia) cubre salas de dos con código y se prueba entero con `node --test`.
- **Sin Supabase Realtime para el combate:** no puede ser autoritativo. Supabase solo valida la cuenta y guarda el resultado.
- **Interpolación sin predicción:** el cliente interpola con 110 ms de retraso. No hay predicción ni compensación de latencia, porque no se ha demostrado que hagan falta.
- **Sin desarme en esta versión:** la parada y el choque ya cubren ese papel.
- **Autómatas solo en el navegador:** los de la portada y la escuela usan la misma simulación y no tocan el servidor.

## Pendiente

- Desplegar el servidor y correr `docs/estocatta.sql` (lo hace el usuario: necesita sus cuentas).
- Probar con dos cuentas reales desde dos ordenadores y en móvil.
- Recompensas de cartas: no se conectan hasta que el modo en línea esté probado; hay que revisar `docs/economia-de-cartas.md` antes de tocar nada.
- Hojas de sprites hechas a mano, si se quieren: basta con sustituir `dibujarEsgrimista` en `js/estocatta-sprites.js`.
