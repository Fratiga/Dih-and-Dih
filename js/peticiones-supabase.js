/* Mismo proyecto de Supabase que usa el Bufón (js/bufon-supabase.js), pero
   una tabla separada ("peticiones") con su propia policy de RLS. La key es
   la publicable, pensada para vivir en el navegador — la seguridad real la
   da RLS del lado de Supabase, solo insert, nunca lectura. */
window.PETICIONES_SUPABASE_URL = "https://ilicqboqelrjuvtslaxd.supabase.co";
window.PETICIONES_SUPABASE_KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

let peticionesClientePromesa = null;
function peticionesCliente() {
  if (!peticionesClientePromesa) {
    peticionesClientePromesa = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(window.PETICIONES_SUPABASE_URL, window.PETICIONES_SUPABASE_KEY));
  }
  return peticionesClientePromesa;
}

/* A diferencia de bufonRegistrar, esto NO falla en silencio: es un
   formulario que el jugador llena a propósito, así que sí necesita
   avisarle si algo salió mal para que no piense que se mandó. */
async function enviarPeticion({ texto, nombre }) {
  const supabase = await peticionesCliente();
  const { error } = await supabase.from("peticiones").insert({
    texto,
    nombre: nombre || null
  });
  if (error) throw error;
}

/* Solo el Admin puede llegar hasta acá de verdad: RLS bloquea el select a
   cualquier otra cuenta (ver panel-admin.sql). */
async function adminListarPeticiones() {
  const supabase = await peticionesCliente();
  const { data, error } = await supabase
    .from("peticiones")
    .select("id, texto, nombre, atendida, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function adminMarcarPeticion(id, atendida) {
  const supabase = await peticionesCliente();
  const { error } = await supabase.from("peticiones").update({ atendida }).eq("id", id);
  if (error) throw error;
}
