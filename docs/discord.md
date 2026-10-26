# Discord: el bot «The great mice» y la web

Estado (26 de octubre de 2026): **Etapa A, los comandos de la Etapa B y el aviso de «la carrera sale en 2 minutos» están hechos y probados en local.** La aplicación, el SQL de la vinculación y la función `discord` ya están en marcha (los puso el usuario). El aviso de carreras está listo pero **sin desplegar** (ver «Avisos de carreras»). La búsqueda general en el compendio (`/buscar`) también está hecha y probada en local, sin desplegar (ver «Buscar en el compendio»). Las inscripciones y el panel completo de la taberna **no están hechos**.

La aplicación se llama **D&D** y el bot **The great mice**.

## Diagnóstico (Fase 0)

**Arquitectura actual.** Sitio estático en GitHub Pages (sin compilación, scripts clásicos con `?v=` para la caché). Supabase (proyecto `ilicqboqelrjuvtslaxd`) hace de base de datos y de cuentas: Auth con email y contraseña (14 cuentas, ningún otro proveedor), tabla `perfiles(user_id, side, username)`, RLS en todas las tablas y funciones `security definer` que comprueban `fichas_es_admin()`. La clave pública (`sb_publishable_...`) va en el navegador; la `service_role` nunca sale de Supabase.

**Lo que ya existía y se reutiliza** (no se ha duplicado nada):

- Dos Edge Functions desplegadas (`hipodromo-avanzar`, sin JWT y con su propia clave; `admin-gestionar-cuenta`), `pg_cron` y `pg_net` activos y un cron de cada minuto. Mismo patrón que usa el bot: función sin JWT que comprueba algo propio (aquí, la firma de Discord).
- `eventos_sitio` (avisos con fechas y por Side, con regalo opcional) y `hipodromo_calendario` (carreras programadas): son lo que `/eventos` enseña. No hay un sistema de inscripciones.
- Tablas ya públicas en la web: `hooey_puntajes`, `mj_estadisticas` (ajedrez, arquería, duelo), `ritmo_puntajes`, `parranda_puntajes`. Cartas: `cartas_catalogo` (`publicada`, `lado`) y `cartas_definiciones`.
- Reglas de Side: cada cuenta tiene Side A o B, `side_excepciones` deja ver ambos y el admin ve todo. El bot las respeta con `discord_i_ve_lado`.
- No había ninguna integración con Discord, ni cola de notificaciones, ni servidor propio. No se creó ninguno.

**Visibilidad.** El Hipódromo y la Veintiuna son públicos desde hace tiempo (sus páginas ya no cargan `oculto.js`), así que salen en `/perfil` y `/eventos`. Ostelar, el Duelo y La Fractura siguen ocultos (solo admin en el mapa de la taberna) y no salen en ningún comando: `/perfil` y `/clasificacion` filtran `mj_estadisticas` a ajedrez y arquería. Cuando abras el Duelo a los jugadores, se añade a `discord_i_perfil`, `discord_i_clasificacion` y `COMANDOS`.

**Decisión de alojamiento.** Interactions por HTTP en una **Edge Function de Supabase** (`discord`), sin proceso permanente. Motivos: los comandos slash no necesitan el gateway; ya hay Edge Functions y cron en el proyecto; no hay coste ni servidor que mantener. Se recurrirá a un proceso persistente solo si más adelante hace falta recibir eventos de Discord en vivo (mensajes, presencia), que nada de lo pedido necesita. Las notificaciones salientes irán con `pg_cron` + `pg_net`, que ya están (Etapa B, pendiente).

**Riesgos y dependencias.**

- Discord exige respuesta en 3 segundos. Las consultas son rápidas; si alguna crece, se responde diferido.
- `crypto.subtle` con Ed25519 en Deno: está soportado; la función se probó en Node con firmas reales, pero **no se ha ejecutado dentro de Deno** (no está instalado aquí). Se comprueba al guardar la dirección en el portal de Discord, que manda un PING firmado.
- El nombre visible de Discord cambia; nunca se usa para decidir nada, solo el número (snowflake).
- Un fallo de Discord no toca los juegos: el bot solo lee, y las notificaciones (cuando existan) se leerán de colas aparte.

## Qué se hizo

| Archivo | Para qué |
|---|---|
| `docs/discord.sql` | Tablas `discord_vinculos`, `discord_codigos`, `discord_intentos` y las funciones. Solo crea cosas nuevas; se puede repetir |
| `docs/discord/index.ts` | La Edge Function (Deno). Delgada: solo conecta con Supabase |
| `docs/discord/servidor.js` | Comprueba firma, aplicación y servidor, y contesta |
| `docs/discord/firma.js` | Verificación Ed25519 de Discord (con límite de antigüedad de 5 minutos) |
| `docs/discord/comandos.js` | Los 7 comandos: `/ayuda`, `/vincular`, `/desvincular`, `/perfil`, `/clasificacion`, `/cartas`, `/eventos` |
| `docs/discord/registrar.js` | Registra los comandos en Discord (se corre desde tu ordenador) |
| `docs/discord/.env.example` | Nombres de variables con valores inventados. El `.env` real está en `.gitignore` |
| `discord.html`, `js/discord-panel.js`, `css/discord.css` | El Tablón de Discord de la taberna: estado, generar código, desvincular |
| `js/lobby-salas.js` | Una línea: el enlace «Tablón de Discord» en la taberna |
| `docs/pruebas/t_discord.sh` | 61 comprobaciones de la parte SQL (local, Docker) |
| `tools/probar-discord.js` | 50 comprobaciones de firmas, entrada de la función y comandos (Node, sin Discord) |

### Cómo funciona la vinculación

1. En la web, con la sesión iniciada, la persona pulsa «Generar código». La función SQL crea un código de 8 símbolos (sin 0/O/1/I), válido 10 minutos y de un solo uso. En la base solo queda su hash SHA-256.
2. En Discord escribe `/vincular codigo:XXXXXXXX`. Discord firma esa petición, la función comprueba la firma y entonces el número de Discord que llega es de fiar.
3. La función SQL comprueba el código, que no haya caducado ni se haya usado, y que ni la cuenta de la web ni la de Discord estén ya vinculadas con otra. Guarda `(user_id, discord_id)`.
4. Se puede desvincular desde la web o con `/desvincular`.

Así queda demostrado que la persona controla **las dos** cuentas, sin OAuth y sin contraseñas nuevas.

### Qué se comprobó

- **SQL** (`BD=discord sh docs/pruebas/cargar_local.sh todo && BD=discord sh docs/pruebas/t_discord.sh`): el código solo existe como hash; sin sesión o siendo jugador no se pueden llamar las funciones del servidor ni leer los códigos; un código no se reutiliza ni sirve caducado; una cuenta de Discord no se vincula a dos jugadores ni al revés; 5 intentos fallidos bloquean 15 minutos (esta prueba **encontró un fallo real**: un error deshace la transacción, así que los intentos fallidos no quedaban apuntados; ahora se devuelven como resultado); `/perfil` solo es de quien lo pide; `/cartas` esconde las no publicadas y las del otro Side (y las que tienen lado a quien no está vinculado); `/eventos` filtra por Side; el calendario no enseña carreras pasadas.
- **Node** (`node tools/probar-discord.js`): firma válida/alterada/de otra clave/antigua/futura/rota; 401 sin firma buena, 405, 413, 400, aplicación y servidor distintos; respuestas privadas por defecto; `/perfil` no admite elegir a otra persona; nombres tipo `@everyone` no mencionan a nadie; los límites de tamaño de Discord se respetan con datos enormes; los errores técnicos no se enseñan.
- **Navegador**: el flujo del Tablón (generar, copiar, vincular que se detecta solo, desvincular con confirmación) con un servidor de mentira.

### Qué NO se ha comprobado

- Nada contra Discord de verdad (no hay credenciales en esta sesión): ni el registro de comandos, ni el PING, ni un comando real.
- La Edge Function dentro de Deno, ni el SQL contra el Supabase real (se probó en Postgres local con roles simulados).
- El Tablón con una sesión real.

## Pasos manuales que tienes que hacer (en este orden)

1. **Discord Developer Portal** (https://discord.com/developers/applications): la aplicación «D&D» y su bot «The great mice». Anota *Application ID* y *Public Key* (General Information) y el *token* del bot (Bot > Reset Token; **se ve una sola vez, no lo pegues en ningún chat ni archivo del repositorio**). No marques ningún permiso de administrador ni «Privileged Gateway Intents»: no hacen falta.
2. **Invitar al bot**: OAuth2 > URL Generator con los ámbitos `bot` y `applications.commands`, y solo los permisos «Ver canales», «Enviar mensajes» e «Insertar enlaces» (los dos últimos solo se usarán cuando haya notificaciones). Abre la URL y elige tu servidor.
3. **Supabase** > SQL Editor: ejecuta `docs/discord.sql` (después de `docs/admin/admin_historial.sql` y `docs/admin/side_excepciones.sql`, que ya deberías tener).
4. **Edge Function**: sigue las instrucciones de la cabecera de `docs/discord/index.ts` (copiar `index.ts`, `servidor.js`, `comandos.js` y `firma.js` a `supabase/functions/discord/`, poner los secretos y `supabase functions deploy discord --no-verify-jwt`). Si prefieres no usar la terminal, también se puede crear en el editor del panel de Supabase pegando los cuatro archivos.
5. **Discord Developer Portal** > General Information > *Interactions Endpoint URL*: `https://ilicqboqelrjuvtslaxd.supabase.co/functions/v1/discord`. Discord manda un PING firmado y solo deja guardar si la función contesta bien. **Si falla aquí, es la comprobación de firma en Deno y es lo primero que hay que mirar.**
6. **Registrar los comandos** desde tu ordenador: copia `docs/discord/.env.example` a `docs/discord/.env`, rellénalo y ejecuta `node --env-file=docs/discord/.env docs/discord/registrar.js`.
7. En la web, abre el **Tablón de Discord** (taberna > Tablón de Discord, o `discord.html`), genera un código y escribe `/vincular` en Discord.
8. Opcional: pon el enlace de invitación permanente del servidor en la constante `INVITACION` de `js/discord-panel.js` para que salga el botón «Entrar al servidor».

Los roles de Discord se siguen administrando a mano: no hay sincronización.

## Avisos de carreras (hecho, sin desplegar)

El bot publica en un canal elegido un aviso cuando una carrera del Hipódromo sale en 2 minutos o menos (cada hora, que es lo que corren). Se puede pausar sin perder el canal.

| Archivo | Para qué |
|---|---|
| `docs/discord-avisos.sql` | Tablas `discord_canales` (dónde publicar) y `discord_cola` (la cola de salida) y sus funciones. Solo crea cosas nuevas; se puede repetir |
| `docs/discord-avisos/index.ts` | La segunda Edge Function, `discord-avisos`. La llama el cron de cada minuto |
| `docs/discord-avisos/avisos.js` | Su lógica: encola, publica, reintenta |
| `docs/pruebas/t_discord_avisos.sh` | 36 comprobaciones SQL (Docker local) |
| `tools/probar-discord-avisos.js` | 37 comprobaciones de la función (sin Discord) |

**Cómo funciona.** El cron llama cada minuto a `discord-avisos` con una clave propia. La función le pide a la base de datos que mire `hipodromo_programa` (la misma tabla que usa el aviso de la taberna) y apunte en la cola una carrera que salga en los próximos 2 minutos. La cola tiene una restricción única por carrera, así que nunca se avisa dos veces de la misma. Después toma lo pendiente (reservándolo, para que dos llamadas a la vez no lo tomen) y lo publica con el token del bot. Discord recibe además un `nonce` con `enforce_nonce`, que evita el doble mensaje aunque falle el apuntar el resultado. Si Discord falla se reintenta hasta 5 veces (respetando el «espera N segundos» de Discord); si tarda tanto que la carrera ya salió, el aviso caduca y no se manda. Una carrera suspendida no avisa. Un fallo de Discord solo afecta a esta cola.

**El mensaje** lleva solo datos públicos de la carrera: nombre, grado, pista, distancia, bolsa y las horas (cada persona las ve en su zona horaria), con enlaces a verla en vivo y a apostar. Nunca resultados, favoritas ni cuotas. No menciona a nadie.

**Pasos manuales** (también están en la cabecera de `docs/discord-avisos.sql`):

1. Ejecuta `docs/discord-avisos.sql` en el SQL Editor de Supabase.
2. Copia el ID del canal (Modo desarrollador > clic derecho en el canal > Copiar ID del canal) y ejecuta:
   `insert into discord_canales (evento, canal_id) values ('carrera', '<ID DEL CANAL>') on conflict (evento) do update set canal_id = excluded.canal_id, activo = true, actualizado = now();`
3. Crea la función `discord-avisos` con `index.ts` y `avisos.js` de `docs/discord-avisos/`, **sin comprobar JWT**, y pon sus secretos: `DISCORD_BOT_TOKEN` (el del bot) y `DISCORD_AVISOS_CLAVE` (una clave larga que inventas tú).
4. Programa la tarea con el SQL del final de `docs/discord-avisos.sql`, con la misma clave.
5. Dale al bot, en ese canal, los permisos «Ver canal», «Enviar mensajes» e «Insertar enlaces».

Para pausar: `update discord_canales set activo = false where evento = 'carrera';`. Para quitar la tarea: `select cron.unschedule('discord-avisos');`.

Esta cola está pensada para más avisos (récords, torneos, novedades) sin tocar la lógica de cada juego: basta con otra fuente que apunte en `discord_cola` y su mensaje en `avisos.js`.

## Buscar en el compendio (`/buscar`, hecho, sin desplegar)

Petición del usuario (26-oct-2026): poder consultar cualquier cosa del sitio desde Discord.

`/buscar consulta:<texto> [categoria:<tipo>]` busca en textos, personajes, lugares, facciones, pergaminos, armas, bestiario, razas, religión, objetos, reglas, economía y las cronologías (1.095 entradas). Mientras se escribe, Discord sugiere títulos (autocompletado). Si el título coincide con claridad, enseña el detalle (resumen, texto, datos como daño, precio o región, y las subsecciones de lugares que ese Side puede ver); si no, una lista de hasta 8 resultados con el fragmento donde aparece lo buscado. Todo con enlace a la página del sitio. **Siempre en privado.**

**De dónde salen los datos.** Los archivos `data/*.js` se pasan a texto plano con `node tools/generar-indice-discord.js`, que escribe `data/discord-indice.json` (2,5 MB, sin etiquetas HTML). La Edge Function lo baja del sitio (lo guarda 10 minutos) y le aplica encima lo editado desde el panel de Admin (tabla `contenido_servidor`, con 1 minuto de caché). Se hizo así porque la Edge Function no puede ejecutar los archivos de datos (no admite `eval`). **Cada vez que cambies algo de `data/*.js`, vuelve a correr ese comando y sube el JSON**; `node tools/probar-discord-buscar.js` falla si está desactualizado, para que no se olvide. Lo que se edite desde el panel de Admin no necesita regenerar nada (salvo los datos sueltos de una entrada como el daño o el precio, que sí vienen del archivo).

**Quién ve qué** (las mismas reglas que la web):

- Una entrada sin lado la ve cualquiera, incluso quien no ha vinculado su cuenta.
- Una entrada de un Side solo la ve ese Side, quien tiene la excepción de Side y los admin. Sin cuenta vinculada no sale nada de un Side.
- Ni los títulos de otro Side salen en las sugerencias del autocompletado. Un `id:...` escrito a mano de otro Side contesta «no encontré esa entrada» sin revelar el título.
- Las subsecciones de un lugar se enseñan solo en el detalle y a su Side, y no se buscan (igual que en la web).
- Los campos solo para el GM (`datosGM`) nunca llegan al índice, y una prueba lo comprueba.
- Las cronologías de cada Side llevan su identificador propio (`cron-a-...`, `cron-b-...`): los dos Sides repiten los mismos números de capítulo y sin eso un Side podría abrir el del otro.
- `stats.js` (las fichas de enemigos) y las cartas no están en el índice: las cartas tienen su propio `/cartas`.

| Archivo | Para qué |
|---|---|
| `tools/generar-indice-discord.js` | Genera `data/discord-indice.json` |
| `data/discord-indice.json` | El índice (generado; se sube con el resto) |
| `docs/discord/texto.js` | HTML a texto, normalizar, extractos |
| `docs/discord/buscar.js` | Carga del índice, parches de Admin, visibilidad por Side, orden, mensajes |
| `docs/discord.sql` | `discord_i_acceso`: el Side de quien pregunta y si lo ve todo |
| `tools/probar-discord-buscar.js` | 85 comprobaciones |

**Para ponerlo en marcha** (si ya hiciste los pasos de arriba, son cuatro cosas):

1. Vuelve a ejecutar `docs/discord.sql` en el SQL Editor (añade `discord_i_acceso`; se puede repetir).
2. En la función `discord`, añade los archivos `buscar.js` y `texto.js` y actualiza `index.ts`, `servidor.js` y `comandos.js` con los de `docs/discord/`. Vuelve a desplegar.
3. Registra los comandos otra vez para que aparezca `/buscar`: `node --env-file=docs/discord/.env docs/discord/registrar.js`.
4. Espera a que GitHub Pages publique `data/discord-indice.json` (lo hace con el siguiente despliegue del sitio).

## Lo que sigue (no hecho)

- **Más notificaciones.** La cola ya existe; faltan las fuentes: récords en `*_puntajes`, `eventos_sitio`, torneos. **Hay que decidir qué canales y qué eventos**: un anuncio en un canal lo ven los dos Sides, así que solo deberían salir cosas neutrales.
- **Más cosas consultables** (petición del 26-oct-2026, «cualquier cosa»). `/buscar` ya cubre el compendio. Faltan por añadir según quieras: las fichas de enemigos (`stats.js`, hoy solo admin), el mapa y sus pines, los pergaminos de cada Escuela, las novedades del lobby, y más datos personales (colección de cartas con nombres, mazos, historial de partidas). Cada cosa se añade como función SQL o como colección del índice, con su regla de visibilidad.
- **Etapa C, inscripciones.** No existe un sistema de inscripciones: hay que diseñarlo (tabla de inscritos con restricción única, plazas, estados, funciones con bloqueo para las carreras simultáneas) y luego exponerlo en la web y en un comando. Conviene decidir primero qué tipo de eventos serán (torneos de blackjack, carreras del Hipódromo...).
- **Etapa D, panel de la taberna.** Hoy el Tablón solo vincula. Falta lo visual: próximos eventos, anuncios, clasificaciones destacadas y accesos directos.
- **Etapa E, Bufón y ARG.** Nada se ha adelantado: las notificaciones narrativas tendrán su propia cola y su propio interruptor para poder pausarlas sin tocar el bot general.
