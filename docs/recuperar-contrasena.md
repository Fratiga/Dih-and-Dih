# Recuperar la contraseña: lo que falta

Este documento es para la sesión que tiene acceso a Supabase. La parte que se puede hacer sin servidor ya está en `main`. Falta la que hay que probar con un correo real.

## Lo que ya hay

Todo está en `js/fichas-supabase.js`, y los avisos usan el sistema de `js/dialogos.js`.

| qué | dónde se abre | función |
|---|---|---|
| "¿Olvidaste tu contraseña?" como aviso con el email | panel de inicio de sesión del encabezado (todas las páginas) y `fichas.html` | `fichasOlvideContrasena(emailInicial)` |
| Cambiar la contraseña con la sesión iniciada (actual, nueva y repetir) | panel del encabezado con sesión ("Cambiar contraseña") y `fichas.html`, junto a "Cerrar sesión" | `fichasCambiarContrasena()` |
| Elegir la contraseña nueva tras recuperarla | **sin conectar** | `fichasElegirContrasenaNueva()` |

- `dialogo.formulario(mensaje, campos, opciones)` es nuevo en `js/dialogos.js`: varios campos de una línea, con validación y foco en el campo que falla.
- Las cuentas creadas con un email inventado no reciben el correo. El aviso de "olvidé mi contraseña" lo dice y manda a pedir el cambio a un admin, que sí puede hacerlo desde el panel de administración (`adminCambiarPassword`).
- `fichasTraducirErrorAuth` pasó de `js/fichas-auth-ui.js` a `js/fichas-supabase.js` para que la use todo el sitio.

## Lo que falta

El correo de recuperación lleva a la persona de vuelta al sitio con una sesión de recuperación, pero nada le pide la contraseña nueva. Hoy entra sin más y la contraseña no cambia.

### 1. Conectar el evento (código)

1. En `resetPasswordForEmail`, pasar `redirectTo`. Lo más simple es `fichas.html`, que siempre crea el cliente al cargar:
   ```js
   await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL("fichas.html", location.href).href });
   ```
2. En `fichasEnCambioDeSesion`, hoy se ignora el nombre del evento (`_evento`). Cuando sea `"PASSWORD_RECOVERY"`, llamar a `fichasElegirContrasenaNueva()` una sola vez.
3. Limpiar el hash de la URL después de procesarlo (`history.replaceState`), para que recargar no repita el aviso.
4. Si el enlace venció o ya se usó, Supabase vuelve con `#error=access_denied&error_code=otp_expired` en el hash. Mostrar un aviso claro ("El enlace venció, pide otro") en vez de dejar la pantalla sin explicar.
5. Si la persona pulsa "Ahora no", se queda con la sesión de recuperación iniciada y sin contraseña nueva. Decidir si se cierra esa sesión (lo más limpio) o se deja.

### 2. Configuración en Supabase

- **Authentication > URL Configuration.** La página de retorno (`fichas.html` en el dominio real del sitio) tiene que estar en "Redirect URLs". Si no, el enlace del correo cae en el "Site URL" y el evento no llega a la página correcta.
- **Correo saliente.** Con el servicio de correo por defecto de Supabase hay límite de envíos por hora y solo se manda a direcciones del equipo del proyecto. Si es así, ningún jugador recibirá nada hasta configurar un SMTP propio (Authentication > SMTP Settings). Es lo primero que conviene comprobar.
- **Authentication > Email Templates > Reset Password.** Revisar que el texto sea el que quieres y que use `{{ .ConfirmationURL }}`.
- **Authentication > Policies.** Revisar el largo mínimo de contraseña. El código pide 6; si el proyecto exige más, hay que subir el mínimo en `fichasValidarContrasenaNueva` y en el texto de los avisos.
- **"Secure password change".** Si está activado, `updateUser` exige una sesión reciente. `fichasCambiarContrasena` ya vuelve a iniciar sesión justo antes de cambiarla, así que lo cumple. Confirmarlo.

### 3. Pruebas con el proyecto real

1. "Olvidé mi contraseña" desde el encabezado, sin sesión, con un email del equipo: llega el correo.
2. El enlace del correo lleva a `fichas.html` y se abre "Contraseña nueva".
3. Con la contraseña nueva se puede entrar, y la vieja ya no.
4. Un enlace usado dos veces o vencido muestra el aviso del punto 1.4.
5. Dos contraseñas distintas, menos de 6 caracteres y una contraseña igual a la anterior muestran el error en el campo correcto.
6. Con sesión iniciada: "Cambiar contraseña" con la actual correcta cambia. Con la actual mala dice "La contraseña actual no es correcta" y no guarda nada.
7. Pedir muchos correos seguidos muestra el aviso de demasiados correos.

## Cómo probarlo sin Supabase

Las rutas de `esm.sh` se pueden interceptar con un módulo falso que implemente `auth.getSession`, `signInWithPassword`, `resetPasswordForEmail` y `updateUser`. Así se probaron los avisos que ya hay.
