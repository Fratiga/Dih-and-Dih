/* Config pública de Supabase. Esta key es la "publicable" (equivalente a
   la vieja "anon"): está pensada para vivir en el navegador. La seguridad
   real la da RLS del lado de Supabase, no que esto esté escondido acá. */
window.BUFON_SUPABASE_URL = "https://ilicqboqelrjuvtslaxd.supabase.co";
window.BUFON_SUPABASE_KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

/* Identidad del visitante: un UUID sin ningún dato personal, generado la
   primera vez y reutilizado siempre desde ese mismo navegador. */
function bufonPlayerId() {
  let id = localStorage.getItem("jester_player_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("jester_player_id", id);
  }
  return id;
}

/* Identidad de esta sesión (una por pestaña/visita, no persiste entre
   recargas del navegador cerradas y vueltas a abrir). Sirve para agrupar
   qué elecciones pasaron en una misma sentada. */
function bufonSessionId() {
  let id = sessionStorage.getItem("jester_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("jester_session_id", id);
  }
  return id;
}

let bufonClientePromesa = null;
function bufonCliente() {
  if (!bufonClientePromesa) {
    bufonClientePromesa = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => createClient(window.BUFON_SUPABASE_URL, window.BUFON_SUPABASE_KEY));
  }
  return bufonClientePromesa;
}

/* Guarda una elección en Supabase. Falla en silencio a propósito: el
   jugador nunca debe notar que esto se está registrando.

   En modo Admin (js/lado.js) no se guarda nada — son pruebas del GM, no
   partidas reales, y no tiene sentido que le ensucien la tabla al
   sistema de sideEvidence. El comportamiento local (qué se ve en
   pantalla) sigue funcionando igual, porque eso lo maneja el historial
   en localStorage/sessionStorage, no esta llamada. */
async function bufonRegistrar({ dialogueId, category, choiceId, questionText, choiceText }) {
  if (typeof esAdmin === "function" && esAdmin()) return;
  try {
    const supabase = await bufonCliente();
    await supabase.from("bufon_elecciones").insert({
      player_id: bufonPlayerId(),
      session_id: bufonSessionId(),
      dialogue_id: dialogueId,
      category,
      choice_id: choiceId,
      question_text: questionText,
      choice_text: choiceText ?? null
    });
  } catch (err) {
    // Silencioso a propósito. Sin RLS de lectura no hay forma de
    // confirmarle nada al cliente de todas formas.
  }
}

/* Guarda el nombre opcional que el jugador le da a Slappy — no es una
   cuenta, solo una etiqueta atada a jester_player_id (ver
   scratchpad/bufon_jugadores.sql para la tabla y su RLS). Solo insert:
   si el mismo player_id ya tiene fila, esto falla en silencio, como
   bufonRegistrar. No pasa nada — localStorage["jesterPlayerName"] es la
   fuente de verdad real para "¿ya se ofreció/aceptó registro?", esto es
   nomás la copia que ve el GM desde el dashboard. */
async function bufonRegistrarNombre(nombre) {
  if (typeof esAdmin === "function" && esAdmin()) return;
  try {
    const supabase = await bufonCliente();
    await supabase.from("bufon_jugadores").insert({
      player_id: bufonPlayerId(),
      nombre
    });
  } catch (err) {
    // Silencioso a propósito.
  }
}
