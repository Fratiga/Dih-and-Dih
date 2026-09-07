/* =============================================================================
   SUPABASE — cliente + autenticación real para "Mis personajes". Mismo
   proyecto que ya usan el Bufón y Peticiones (misma key pública), pero acá
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
   con esconder el botón acá, ver panel-admin.sql. */
async function adminListarPerfiles() {
  const supabase = await fichasCliente();
  const { data, error } = await supabase.rpc("fichas_admin_listar_perfiles");
  if (error) throw error;
  return data;
}

async function adminCambiarSide(idUsuario, nuevoSide) {
  const supabase = await fichasCliente();
  const { error } = await supabase.rpc("fichas_admin_set_side", { target_id: idUsuario, nuevo_side: nuevoSide });
  if (error) throw error;
}
