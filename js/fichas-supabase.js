/* =============================================================================
   SUPABASE — cliente + autenticación real para "Mis personajes". Mismo
   proyecto que ya usan el Bufón y Peticiones (misma key pública), pero aquí
   SÍ hay cuentas de verdad (Supabase Auth con email+contraseña): cada
   jugador inicia sesión y sus fichas quedan aisladas por RLS usando
   auth.uid(), no por un UUID inventado en localStorage. Uso privado, ~10
   personas, sin datos sensibles — por eso una cuenta simple con contraseña
   alcanza, sin 2FA ni verificación adicional.
============================================================================= */
window.FICHAS_SUPABASE_URL = "https://ilicqboqelrjuvtslaxd.supabase.co";
window.FICHAS_SUPABASE_KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

let fichasClientePromesa = null;
function fichasCliente() {
  if (!fichasClientePromesa) {
    fichasClientePromesa = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(window.FICHAS_SUPABASE_URL, window.FICHAS_SUPABASE_KEY));
  }
  return fichasClientePromesa;
}

/* Si el proyecto de Supabase tiene activado "Confirm email" (Authentication
   > Providers > Email), signUp no deja sesión iniciada hasta que el
   jugador haga click en el correo de confirmación — data.session viene
   null en ese caso. Si está desactivado, queda logueado al toque. El
   llamador (fichas-auth-ui.js) maneja ambos casos. */
async function fichasRegistrarse(email, password) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { necesitaConfirmarEmail: !data.session, session: data.session };
}

async function fichasIniciarSesion(email, password) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

async function fichasEnviarRecuperacion(email) {
  const supabase = await fichasCliente();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

/* Traduce el error de Supabase Auth a un texto para el jugador. */
function fichasTraducirErrorAuth(err) {
  const msg = (err && err.message) || "";
  if (/already registered|already exists/i.test(msg)) return "Ese email ya tiene una cuenta, prueba iniciar sesión.";
  if (/invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/password.*(at least|should be)/i.test(msg)) return "La contraseña necesita al menos 6 caracteres.";
  if (/email.*invalid/i.test(msg)) return "Ese email no parece válido.";
  if (/rate limit|only request this after|too many/i.test(msg)) return "Pediste demasiados correos seguidos. Espera unos minutos y prueba de nuevo.";
  if (/different from the old password|same as the old/i.test(msg)) return "La contraseña nueva tiene que ser distinta de la actual.";
  if (/reauthentication|recently logged in/i.test(msg)) return "Por seguridad, cierra sesión, vuelve a entrar y prueba de nuevo.";
  return msg || "Algo falló. Prueba de nuevo en un rato.";
}

/* Aviso de "¿Olvidaste tu contraseña?": pide el email, manda el correo de recuperación y avisa de lo que pasa
   con una cuenta de email inventado (no recibe nada, así que debe pedir el cambio a un admin).
   Lo usan el panel de inicio de sesión del encabezado y la página de fichas. Devuelve true si se mandó el correo. */
async function fichasOlvideContrasena(emailInicial) {
  const email = await dialogo.pedir(
    "Escribe el email de tu cuenta y te enviamos un enlace para elegir una contraseña nueva.\n\nSi te registraste con un email inventado, no te va a llegar nada. En ese caso pídele a un admin que te cambie la contraseña.",
    (emailInicial || "").trim(),
    { titulo: "¿Olvidaste tu contraseña?", aceptar: "Enviar correo", tipoCampo: "email", marcador: "tu@email.com",
      validar: v => (/^\S+@\S+\.\S+$/.test(v.trim()) ? "" : "Escribe un email válido.") }
  );
  if (email === null) return false;
  try {
    await fichasEnviarRecuperacion(email.trim());
  } catch (err) {
    await dialogo.avisar(fichasTraducirErrorAuth(err), { titulo: "No se pudo enviar", tipoAviso: "error" });
    return false;
  }
  await dialogo.avisar(
    "Si esa cuenta existe, te llegó un correo para elegir una contraseña nueva. Puede tardar unos minutos o caer en spam.\n\nSi no llega, es probable que el email sea inventado. Pídele a un admin que te cambie la contraseña.",
    { titulo: "Revisa tu correo", tipoAviso: "info" }
  );
  return true;
}

/* Guarda una contraseña nueva en la cuenta con la sesión actual. */
async function fichasGuardarContrasena(nueva) {
  const supabase = await fichasCliente();
  const { error } = await supabase.auth.updateUser({ password: nueva });
  if (error) throw error;
}

const fichasCamposContrasenaNueva = [
  { id: "nueva", etiqueta: "Contraseña nueva (mínimo 6 caracteres)", tipo: "password", autocomplete: "new-password" },
  { id: "repite", etiqueta: "Repite la contraseña nueva", tipo: "password", autocomplete: "new-password" }
];
function fichasValidarContrasenaNueva(v, actual) {
  if (v.nueva.length < 6) return { mensaje: "La contraseña nueva necesita al menos 6 caracteres.", campo: "nueva" };
  if (v.nueva !== v.repite) return { mensaje: "Las dos contraseñas nuevas no coinciden.", campo: "repite" };
  if (actual !== undefined && v.nueva === actual) return { mensaje: "La contraseña nueva tiene que ser distinta de la actual.", campo: "nueva" };
  return "";
}

/* Cambiar la contraseña con la sesión iniciada. Pide la actual, la nueva y su repetición. La actual se comprueba
   iniciando sesión otra vez, lo que además deja la sesión reciente por si el proyecto exige eso para cambiarla.
   Lo abre el panel del encabezado y la página de fichas. Devuelve true si se cambió. */
async function fichasCambiarContrasena() {
  const sesion = await fichasSesionActual();
  if (!sesion) {
    await dialogo.avisar("Inicia sesión para cambiar tu contraseña.", { titulo: "No se pudo cambiar", tipoAviso: "error" });
    return false;
  }
  const v = await dialogo.formulario("Escribe tu contraseña actual y elige la nueva.", [
    { id: "actual", etiqueta: "Contraseña actual", tipo: "password", autocomplete: "current-password" },
    ...fichasCamposContrasenaNueva
  ], {
    titulo: "Cambiar contraseña", aceptar: "Cambiar",
    validar: v => (!v.actual ? { mensaje: "Escribe tu contraseña actual.", campo: "actual" } : fichasValidarContrasenaNueva(v, v.actual))
  });
  if (!v) return false;
  try {
    await fichasIniciarSesion(sesion.user.email, v.actual);
  } catch (err) {
    await dialogo.avisar("La contraseña actual no es correcta.", { titulo: "No se pudo cambiar", tipoAviso: "error" });
    return false;
  }
  try {
    await fichasGuardarContrasena(v.nueva);
  } catch (err) {
    await dialogo.avisar(fichasTraducirErrorAuth(err), { titulo: "No se pudo cambiar", tipoAviso: "error" });
    return false;
  }
  await dialogo.avisar("Tu contraseña se cambió. La próxima vez entra con la nueva.", { titulo: "Contraseña cambiada", tipoAviso: "info" });
  return true;
}

/* Para quien llega desde el enlace del correo de recuperación (ya con sesión de recuperación, sin conocer la contraseña
   actual): pide la nueva y su repetición. AÚN SIN CONECTAR a ningún evento: falta engancharla a PASSWORD_RECOVERY y
   probarla con un correo real (ver docs/recuperar-contrasena.md). Devuelve true si se guardó. */
async function fichasElegirContrasenaNueva() {
  const v = await dialogo.formulario("Elige la contraseña con la que vas a entrar desde ahora.", fichasCamposContrasenaNueva, {
    titulo: "Contraseña nueva", aceptar: "Guardar", cancelar: "Ahora no", validar: v => fichasValidarContrasenaNueva(v)
  });
  if (!v) return false;
  try {
    await fichasGuardarContrasena(v.nueva);
  } catch (err) {
    await dialogo.avisar(fichasTraducirErrorAuth(err), { titulo: "No se pudo guardar", tipoAviso: "error" });
    return false;
  }
  await dialogo.avisar("Listo. Ya puedes entrar con tu contraseña nueva.", { titulo: "Contraseña guardada", tipoAviso: "info" });
  return true;
}

async function fichasCerrarSesion() {
  const supabase = await fichasCliente();
  await supabase.auth.signOut();
}

async function fichasSesionActual() {
  const supabase = await fichasCliente();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/* callback(session|null) — se llama de inmediato con el estado actual y de
   nuevo cada vez que cambia (login, logout, refresh de token). */
async function fichasEnCambioDeSesion(callback) {
  const supabase = await fichasCliente();
  const { data } = await supabase.auth.getSession();
  callback(data.session);
  supabase.auth.onAuthStateChange((_evento, session) => callback(session));
}

/* --- Panel de Admin: cuentas ------------------------------------------------
   Ambas pasan por funciones de Postgres (security definer) que revisan
   fichas_es_admin() del lado del servidor antes de tocar nada — no alcanza
   con esconder el botón aquí, ver panel-admin.sql. */
async function adminListarPerfiles() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.rpc("fichas_admin_listar_perfiles");
  if (error) throw error;
  return data;
}

/* Dar o quitar el Admin a una cuenta. Solo lo puede hacer un Admin y el servidor
   no deja quitarse el permiso a uno mismo ni dejar el sitio sin ningún Admin
   (ver scratchpad/admin_dar_admin.sql). */
async function adminCambiarAdmin(idUsuario, esAdmin) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("fichas_admin_set_admin", { target_id: idUsuario, nuevo: !!esAdmin });
  if (error) throw error;
}

/* Rol DJ (editor de mapas de Zarabanda y subir canciones a la rocola). Lo da y lo quita un
   Admin; ver scratchpad/ritmo_dj.sql. adminListarDJs devuelve los ids de las cuentas DJ. */
async function adminListarDJs() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.from("ritmo_djs").select("user_id");
  if (error) throw error;
  return (data || []).map(f => f.user_id);
}

async function adminCambiarDJ(idUsuario, esDJ) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("ritmo_admin_set_dj", { target_id: idUsuario, nuevo: !!esDJ });
  if (error) throw error;
}

/* Rol Editor de cartas (editar cartas desde el álbum). Solo lo da un Admin; ver
   scratchpad/cartas_editor.sql. adminListarEditoresCartas devuelve los ids de esas cuentas. */
async function adminListarEditoresCartas() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.from("cartas_editores").select("user_id");
  if (error) throw error;
  return (data || []).map(f => f.user_id);
}

async function adminCambiarEditorCartas(idUsuario, esEditor) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("cartas_admin_set_editor", { target_id: idUsuario, nuevo: !!esEditor });
  if (error) throw error;
}

async function adminCambiarSide(idUsuario, nuevoSide) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("fichas_admin_set_side", { target_id: idUsuario, nuevo_side: nuevoSide });
  if (error) throw error;
}

/* Estas dos pasan por una Edge Function (no una RPC de Postgres): borrar un
   usuario o cambiarle la contraseña son operaciones de la Admin API de
   Supabase Auth, que solo funcionan con la service_role key. Esa key nunca
   puede llegar al navegador, así que la función corre server-side y aquí
   solo se invoca. Ver scratchpad/edge-function-admin-gestionar-cuenta.ts. */
async function adminEliminarCuenta(idUsuario) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.functions.invoke("admin-gestionar-cuenta", {
    body: { accion: "eliminar", userId: idUsuario }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

async function adminCambiarPassword(idUsuario, nuevaPassword) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.functions.invoke("admin-gestionar-cuenta", {
    body: { accion: "cambiar_password", userId: idUsuario, nuevaPassword }
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

/* Historial de cambios en las fichas (solo Admin: RLS con fichas_es_admin()).
   Lo escribe un trigger de la base de datos, ver scratchpad/fichas_historial.sql. */
async function adminListarHistorialFichas(limite = 300) {
  const supabase = await fichasCliente();
  const { data, error } = await supabase
    .from("fichas_historial")
    .select("id, ficha_id, ficha_nombre, actor_username, owner_id, accion, cambios, creado_en")
    .order("creado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data || [];
}
