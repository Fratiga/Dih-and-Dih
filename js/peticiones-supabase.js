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
   avisarle si algo salió mal para que no piense que se mandó.
   Ya no hay peticiones anónimas: siempre llevan el nombre de la cuenta. Para que no se
   pueda saltar desde fuera de la página, el servidor también lo tiene que poner él
   (docs/peticiones-con-nombre.sql). */
async function enviarPeticion({ texto, nombre }) {
  if (!nombre) throw new Error("Falta el nombre de la cuenta");
  const supabase = await peticionesCliente();
  // Con scratchpad/peticiones_estado.sql la petición vuelve con un código para seguirla;
  // sin él, se manda como siempre y simplemente no hay seguimiento.
  const { data, error } = await supabase.rpc("peticion_enviar", { p_texto: texto, p_nombre: nombre });
  if (!error) return data;
  const { error: errorInsert } = await supabase.from("peticiones").insert({
    texto,
    nombre
  });
  if (errorInsert) throw errorInsert;
  return null;
}

/* Estado de tus peticiones: [{ codigo, atendida }]. Solo dice si ya la atendí. */
async function peticionesEstado(codigos) {
  if (!codigos.length) return [];
  const supabase = await peticionesCliente();
  const { data, error } = await supabase.rpc("peticiones_estado", { p_codigos: codigos });
  if (error) throw error;
  return data || [];
}

/* Solo el Admin puede llegar hasta aquí de verdad: RLS bloquea el select a
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
