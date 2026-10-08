# Acceso de solo lectura para Claude

Para que Claude pueda mirar tu Supabase sin poder cambiar nada ni ver lo privado. Funciona con un rol de la base de datos (`claude_lectura`) y un token firmado para ese rol que se guarda como secreto del entorno en la nube, de modo que ni siquiera Claude lo ve.

## Qué se puede y qué no

- El rol lee solo las tablas de la lista de `docs/claude-lectura.sql`: el contenido del juego (cartas, mapas, rocola, fanarts). Las partidas, los puntajes y el estado secreto del hipódromo están comentados y se abren cuando quieras.
- Nunca están en la lista: peticiones, perfiles, fichas de personajes, el Bufón, atajos, colecciones y mazos de cada jugador, ni los esquemas `auth` y `storage`.
- No puede escribir, borrar ni crear nada. No tiene contraseña ni se puede conectar directo a la base de datos: solo existe para la API, con un token.
- Funciones (`rpc`): las mismas que ya puede llamar un visitante sin cuenta, y no más.

## Pasos

1. **Crear el rol.** Ejecuta `docs/claude-lectura.sql` en el editor SQL de Supabase. Se puede repetir.
2. **Conseguir el secreto JWT.** En el panel de Supabase, Project Settings, JWT Keys, pestaña del secreto JWT antiguo ("Legacy JWT Secret"). Si no existe o está desactivado, este método no sirve: dímelo y buscamos otro.
3. **Firmar el token en tu ordenador.** El secreto es la llave maestra del proyecto: no lo pegues en el chat ni lo guardes en un archivo del repositorio.
   - Windows (PowerShell): `$env:SUPABASE_JWT_SECRET = "el-secreto"; node tools/firmar-jwt-lectura.js 90`
   - Mac o Linux: `SUPABASE_JWT_SECRET="el-secreto" node tools/firmar-jwt-lectura.js 90`

   Sale un token que caduca en 90 días (de 1 a 365). Cierra la terminal o borra la variable después.
4. **Guardarlo como secreto del entorno.** Menú del entorno en la nube, Editar entorno, "Secretos de red", Agregar secreto:
   - Nombre: `Supabase lectura`
   - Sitios permitidos: `ilicqboqelrjuvtslaxd.supabase.co`
   - Tipo: Bearer, con una cabecera `Authorization` y prefijo `Bearer`. En el valor pegas el token.

   Se guarda al pulsar el botón de conectar del propio formulario y después no se puede volver a ver.
5. **Avisar a Claude.** Con el secreto puesto, todo lo que Claude pida a ese host va con el rol de lectura (no tiene que añadir ninguna cabecera, solo la clave pública en `apikey`). Eso significa que mientras exista el secreto Claude ya no puede probar lo que ve un visitante anónimo.

## Revocar

- Al instante: borra el secreto del entorno. Claude deja de tener acceso.
- Del todo: ejecuta el bloque comentado al final de `docs/claude-lectura.sql`.
- Si el secreto JWT del proyecto se hubiera filtrado, rótalo en el panel: invalida todos los tokens, también este.

## Cómo se probó

El script se ejecutó dos veces en un PostgreSQL 16 local con los roles `anon`, `authenticated` y `authenticator` simulados: el rol lee las tablas de la lista (con y sin seguridad por filas), no puede leer `peticiones`, `perfiles` ni las tablas del nivel 2, no puede insertar, actualizar, borrar ni crear, `authenticator` puede cambiar a él, abrir el nivel 2 funciona y el bloque de quitarlo lo borra todo. El token se comprobó firmando y verificando con HS256. **No se probó contra el Supabase real**: queda por ver si acepta ese token (depende de que el secreto JWT antiguo siga activo) y si aplica los ajustes del rol (`statement_timeout` y solo lectura por defecto, que son una protección extra: lo que impide escribir son los permisos).
