# Discord: el bot «The great mice» y la web

Estado (26 de octubre de 2026): **Etapa A y los comandos de la Etapa B están hechos y probados en local. Nada está desplegado todavía**: faltan los pasos manuales de abajo (crear la aplicación de Discord, ejecutar el SQL y desplegar la función). Las notificaciones automáticas, las inscripciones y el panel completo de la taberna son las etapas siguientes y **no están hechas**.

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

## Lo que sigue (no hecho)

- **Etapa B, notificaciones.** Una cola `discord_cola` con identificador único (para no publicar dos veces), un `pg_cron` que llame cada minuto a una segunda función que publique con el token del bot (reintentos y límites de Discord). Fuentes ya existentes que se leerían sin tocar las reglas de los juegos: `hipodromo_noticias`, `hipodromo_programa`, récords en `*_puntajes`, `eventos_sitio`. Los canales se configurarían en una tabla, no en el código de cada juego. **Hay que decidir qué canales y qué eventos**: un anuncio en un canal lo ven los dos Sides, así que solo deberían salir cosas neutrales.
- **Etapa C, inscripciones.** No existe un sistema de inscripciones: hay que diseñarlo (tabla de inscritos con restricción única, plazas, estados, funciones con bloqueo para las carreras simultáneas) y luego exponerlo en la web y en un comando. Conviene decidir primero qué tipo de eventos serán (torneos de blackjack, carreras del Hipódromo...).
- **Etapa D, panel de la taberna.** Hoy el Tablón solo vincula. Falta lo visual: próximos eventos, anuncios, clasificaciones destacadas y accesos directos.
- **Etapa E, Bufón y ARG.** Nada se ha adelantado: las notificaciones narrativas tendrán su propia cola y su propio interruptor para poder pausarlas sin tocar el bot general.
