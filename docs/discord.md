# Discord: el bot «The great mice» y la web

Estado (26 de octubre de 2026): **Etapa A, los comandos de la Etapa B y el aviso de «la carrera sale en 2 minutos» están hechos y probados en local.** La aplicación, el SQL de la vinculación y la función `discord` ya están en marcha (los puso el usuario). El aviso de carreras **ya está desplegado y funcionando** (la función `discord-avisos`, el canal y el cron los puso el usuario). La búsqueda general en el compendio (`/buscar`) también está hecha y probada en local, sin desplegar (ver «Buscar en el compendio»). También están hechos y probados en local, sin desplegar, `/cronica`, `/racha`, `/desafios`, `/carrera`, `/saldo` y los anuncios de la crónica por Side (ver «Crónica del mundo, Veintiuna, carrera y saldo»). También están hechos y probados en local, sin desplegar, `/ficha`, `/avisos` (avisos personales por mensaje privado), el resumen semanal y las novedades del sitio (ver «/ficha, resumen semanal, novedades y avisos personales»). Las inscripciones y el panel completo de la taberna **no están hechos**.

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

## Crónica del mundo, Veintiuna, carrera y saldo (hecho, sin desplegar)

Idea de la sesión «Crónica del mundo» (26-oct-2026), hecha con las reglas que ella pedía: nada de Side cruzado en canales compartidos, los intercambios y las crías siguen siendo anónimos y los juegos ocultos no salen. Todo esto vive en `docs/discord-2_consultas.sql` (se ejecuta después de `docs/discord.sql`, `docs/discord-avisos.sql` y `docs/cronica-1_base.sql`).

**Comandos nuevos** (siempre en privado, y todos piden tener la cuenta vinculada):

| Comando | Qué hace |
|---|---|
| `/cronica` | Los últimos 10 sucesos de la crónica que tu Side puede ver, con las mismas frases que enseña la web. En intercambios y crías no se dice quién fue, ni a un admin (en Discord se lee en un canal) |
| `/racha` | Tu racha actual en Las Veintiuna Velas, la mejor y tus victorias |
| `/desafios` | Tus desafíos de hoy por nivel (✅ reclamado, ☑️ completado sin reclamar, ▫️ pendiente) y cuándo se reinician |
| `/carrera` | La próxima carrera, cuándo sale y cierran las apuestas, y las 3 favoritas por cuota (la web ya enseña esas cuotas) |
| `/saldo` | Tus tokens de juego |

**Anuncios en canales.** El mismo cron de cada minuto apunta en la cola los sucesos fuertes de los últimos 30 minutos (para que al encender un canal no salga lo antiguo). Se anuncia: cartas legendarias o limitadas, copas del Hipódromo, apuestas de 5000 tokens o más (y como mucho **una por jugador cada 30 minutos**: si juega varias manos seguidas, sale la primera y las demás no; sigue saliendo todo en la crónica de la web), rachas récord de Veintiuna ya terminadas, La Última Vela, récords (Hooey, Zarabanda, Parranda, Ajedrez, Arquería) y la primera cría de una especie. **No** se anuncian solos los intercambios, los desafíos de oro, las rachas vivas ni las noticias del Admin. Lo que se anuncia está en la función `discord_i_cronica_fuerte`; para cambiarlo se cambia esa función.

Cada suceso va al canal de su Side. Se configuran en la tabla `discord_canales`, igual que el de las carreras:

| Evento | Qué recibe |
|---|---|
| `cronica_a` | Los sucesos del Side A, y solo esos |
| `cronica_b` | Los del Side B, y solo esos |
| `cronica_general` | Los que ven los dos Sides (intercambios entre Sides, noticias para todos) |
| `veintiuna` | El recordatorio de las 23:50 UTC: «los desafíos se reinician a las 00:00 UTC y lo no reclamado se pierde» |

Sin canal configurado para un evento, no se anuncia nada de ese tipo. Los canales de Side tienen que ser canales que solo lea ese Side: el bot no lo comprueba. Ejemplo:

```sql
insert into discord_canales (evento, canal_id) values ('cronica_a', '<ID>'), ('cronica_b', '<ID>'), ('cronica_general', '<ID>'), ('veintiuna', '<ID>')
on conflict (evento) do update set canal_id = excluded.canal_id, activo = true, actualizado = now();
```

**Una noticia del Admin a Discord.** `select discord_admin_anunciar(<id del suceso>)` (solo admin) manda esa noticia al canal de su Side. Es lo que usaría una casilla «publicar también en Discord» en `js/admin-cronica.js` (no se ha tocado: es de la sesión de la crónica). Anunciarla dos veces no la duplica.

**Las copias de `js/cronica.js`.** Las frases de la crónica salen del mismo archivo que usa la web. La Edge Function no puede cargarlo desde el sitio, así que hay una copia sin cambios en `docs/discord/cronica.js` y otra en `docs/discord-avisos/cronica.js`. `node tools/probar-discord-cronica.js` falla si dejan de ser idénticas a `js/cronica.js` (si cambias las frases, copia el archivo a los dos sitios).

**Para ponerlo en marcha:**

1. Ejecuta `docs/discord-2_consultas.sql` en el SQL Editor.
2. Actualiza la función `discord` (añade `cronica.js`; actualiza `comandos.js` e `index.ts`) y la función `discord-avisos` (añade `cronica.js`; actualiza `avisos.js`). Vuelve a desplegar las dos.
3. Registra los comandos otra vez (aparecen los 5 nuevos): `node --env-file=docs/discord/.env docs/discord/registrar.js`.
4. Configura en `discord_canales` los canales que quieras (arriba).

Pruebas: `docs/pruebas/t_discord_cronica.sh` (SQL) y `tools/probar-discord-cronica.js`.

## /ficha, resumen semanal, novedades y avisos personales (hecho, sin desplegar)

Cuatro ideas más del 27-oct-2026. Todo está en `docs/discord-3_extras.sql` (se ejecuta después de `docs/discord-2_consultas.sql`).

**`/ficha [nombre]`** (privado). Un resumen de uno de tus personajes de Mis personajes: nivel, clase, raza, vida, CA, iniciativa, competencia, atributos con su modificador, condiciones y resistencias, ataques y monedas. Sin nombre da la lista de tus personajes; con el campo `nombre` hay autocompletado (solo con los tuyos). Solo salen las fichas de la cuenta vinculada y no las archivadas. **No** sale la historia, la descripción física, las notas ni el correo. La CA, la competencia, la iniciativa y los modificadores se calculan en SQL con las mismas cuentas que `js/fichas-calc.js`: `tools/ficha-paridad.js` compara las dos en 14 fichas de ejemplo, para que no se desvíen si alguien cambia las cuentas en un solo sitio.

**Resumen semanal.** Cada domingo entre las 20:00 y las 23:00 UTC (17:00 en Chile) se apunta un resumen por canal de la crónica (`cronica_a`, `cronica_b`, `cronica_general`): la mejor racha de Las Veintiuna Velas, la apuesta más pagada del Hipódromo y las tres cartas más raras ganadas esa semana, con el total. Sale de la crónica, así que solo cuenta lo que ya se consideró digno de anotar (una apuesta de 650 tokens, por ejemplo, no está si no pasó los umbrales). Cada canal resume lo de su Side y lo de los dos; el general, solo lo de los dos. Una semana sin nada no publica nada, y no se repite en la misma semana.

**Novedades del sitio** (canal `novedades` en `discord_canales`):

- Las del lobby (`data/novedades.js`) llegan por el índice: `tools/generar-indice-discord.js` ahora guarda también las novedades en `data/discord-indice.json`. Se anuncian las de los últimos 2 días, una sola vez.
- Las que escribes desde el panel de Admin (colección `NOVEDADES` de `contenido_servidor`) se anuncian si las editaste en el último día.
- **Entradas nuevas del compendio.** Cuando el índice trae identificadores que no estaban, se anuncian en un solo aviso (hasta 8 títulos con enlace y cuántas más hay). La primera vez solo se guardan los existentes: no se anuncia todo el compendio. Solo salen las que no son de un Side (un canal lo leen los dos Sides); esas se encuentran con `/buscar` pero no se anuncian.
- No se anuncian las **ediciones** de entradas que ya existían: no hay forma fiable de saber qué cambió, y sería ruido. Para algo importante, escribe una novedad.
- El índice se baja como mucho una vez cada 10 minutos (lo decide la base de datos con `discord_i_indice_toca`, así que no depende de que la función siga encendida) y solo si hay un canal `novedades` encendido.
- **Importante:** como todo sale del índice, hay que regenerarlo (`node tools/generar-indice-discord.js`) y subirlo con cada cambio de `data/*.js`, y esperar a que GitHub Pages lo publique.

**Avisos personales por mensaje privado.** Son opcionales y están apagados por defecto: cada persona los activa con `/avisos cria:sí carrera:sí` (y los apaga con `no`).

- **Cría lista:** cuando una cría en curso de tus corrales llega a su hora (y no han pasado más de 24 horas).
- **Tu criatura corre pronto:** 2 minutos antes de una carrera en la que corra una criatura tuya (un solo aviso aunque corran varias, con la puerta de cada una).
- Van por mensaje privado del bot. Para que lleguen, la persona tiene que permitir mensajes directos de los miembros del servidor. Si Discord dice que no los acepta, **no se insiste** (el aviso se da por perdido a la primera) y no se vuelve a intentar con ese aviso. Cada persona solo recibe lo suyo.

| Archivo | Para qué |
|---|---|
| `docs/discord-3_extras.sql` | Preferencias, `/ficha`, el resumen, las novedades, las entradas nuevas y los avisos personales |
| `docs/discord-avisos.sql` | Cambia `discord_i_marcar_cola` (espera 0 = no insistas) y la limpieza (60 días para novedades) |
| `docs/discord-avisos/avisos.js`, `index.ts` | Los mensajes nuevos y el envío por mensaje privado |
| `docs/discord/comandos.js` | `/ficha` y `/avisos` (ya son 15 comandos) |
| `tools/generar-indice-discord.js` | Ahora guarda también las novedades |
| `tools/ficha-paridad.js` | Compara las cuentas de la ficha con `js/fichas-calc.js` |
| `docs/pruebas/t_discord_extras.sh`, `tools/probar-discord-extras.js` | 123 comprobaciones SQL y 65 de la función |

**Para ponerlo en marcha:**

1. Ejecuta `docs/discord-avisos.sql` (cambia dos funciones; se puede repetir) y después `docs/discord-3_extras.sql`.
2. Actualiza la función `discord` (cambia `comandos.js`) y la función `discord-avisos` (cambian `avisos.js` e `index.ts`). Vuelve a desplegar las dos. Los archivos de `docs/discord-avisos/` son tres: `index.ts`, `avisos.js` y `cronica.js`.
3. Registra los comandos otra vez (aparecen `/ficha` y `/avisos`): `node --env-file=docs/discord/.env docs/discord/registrar.js`.
4. Para las novedades, añade el canal: `insert into discord_canales (evento, canal_id) values ('novedades', '<ID>') on conflict (evento) do update set canal_id = excluded.canal_id, activo = true, actualizado = now();`. El resumen semanal usa los mismos canales de la crónica.

## Lo que sigue (no hecho)

- **Más notificaciones.** La cola ya existe y ya anuncia carreras, la crónica y el recordatorio de Veintiuna. Faltan fuentes como `eventos_sitio` y los torneos, y más avisos personales por mensaje privado (intercambio dirigido a ti, reto de ajedrez, ofertas del Buhonero). Los de cría lista y criatura que corre pronto ya existen (`/avisos`).
- **Más cosas consultables** (petición del 26-oct-2026, «cualquier cosa»). `/buscar` ya cubre el compendio. Faltan por añadir según quieras: las fichas de enemigos (`stats.js`, hoy solo admin), el mapa y sus pines, los pergaminos de cada Escuela, las novedades del lobby, y más datos personales (colección de cartas con nombres, mazos, historial de partidas). Cada cosa se añade como función SQL o como colección del índice, con su regla de visibilidad.
- **Etapa C, inscripciones.** No existe un sistema de inscripciones: hay que diseñarlo (tabla de inscritos con restricción única, plazas, estados, funciones con bloqueo para las carreras simultáneas) y luego exponerlo en la web y en un comando. Conviene decidir primero qué tipo de eventos serán (torneos de blackjack, carreras del Hipódromo...).
- **Etapa D, panel de la taberna.** Hoy el Tablón solo vincula. Falta lo visual: próximos eventos, anuncios, clasificaciones destacadas y accesos directos.
- **Etapa E, Bufón y ARG.** Nada se ha adelantado: las notificaciones narrativas tendrán su propia cola y su propio interruptor para poder pausarlas sin tocar el bot general.
