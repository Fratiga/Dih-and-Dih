/* Config pública de Supabase. Esta key es la "publicable" (equivalente a
   la vieja "anon"): está pensada para vivir en el navegador. La seguridad
   real la da RLS del lado de Supabase, no que esto esté escondido acá. */
window.BUFON_SUPABASE_URL = "https://ilicqboqelrjuvtslaxd.supabase.co";
window.BUFON_SUPABASE_KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";

/* Identidad del visitante. Por defecto es un UUID sin ningún dato
   personal, generado la primera vez y reutilizado desde ese mismo
   navegador — que es justo su punto débil: se pierde si se borra el
   storage del sitio, junto con todo lo demás.

   Si la página tiene cargado js/fichas-supabase.js (secreto.html sí, la
   mayoría de las otras páginas del sitio no) Y la persona ya inició
   sesión ahí ("Mis personajes" — cuenta real con email+contraseña, ver
   ese archivo), se usa ese uid en su lugar tal cual, SIN prefijo — la
   columna player_id de bufon_elecciones es de tipo uuid, no text (lo
   confirmó un error real en producción: "operator does not exist: uuid
   = text" al intentar guardar "auth:" + uid, que no es un uuid válido).
   Un uid de auth.uid() y un UUID anónimo son, en la práctica, imposibles
   de confundir entre sí (son aleatorios de 128 bits cada uno), así que
   no hace falta el prefijo para evitar choques — alcanza con no mezclar
   nunca ambos tipos de identidad dentro de la misma fila.

   Como ya no hay forma de distinguir "es cuenta real" mirando el FORMATO
   del id (antes era el prefijo "auth:"), quien necesite saber eso debe
   llamar a bufonEsIdentidadReal() en su lugar, no inspeccionar el string.

   Esa identidad SÍ sobrevive un borrado de navegador (basta con volver a
   iniciar sesión), así que es la que además hace posible
   hidratarHistorialDesdeAuth() en secreto.html. bufonHistorial en
   localStorage sigue siendo la única fuente de verdad para lo que se VE
   en pantalla — esto solo cambia qué id se manda a Supabase. */
let bufonAuthUidCache = null;
async function chequearFichasAuth() {
  try {
    if (typeof fichasSesionActual !== "function") return; // fichas-supabase.js no está en esta página
    const session = await fichasSesionActual();
    if (session && session.user && session.user.id) {
      bufonAuthUidCache = session.user.id;
    }
  } catch (err) {
    // Silencioso, igual que el resto de las llamadas a Supabase.
  }
}
chequearFichasAuth();

function bufonEsIdentidadReal() {
  return !!bufonAuthUidCache;
}

function bufonPlayerId() {
  if (bufonAuthUidCache) return bufonAuthUidCache;
  let id = localStorage.getItem("jester_player_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("jester_player_id", id);
  }
  return id;
}

/* Reclama, UNA sola vez por cuenta, el historial anónimo que este mismo
   navegador acumuló ANTES de iniciar sesión en "Mis personajes" — si no,
   ese historial viejo queda huérfano bajo el UUID anónimo para siempre
   (ver scratchpad/bufon_migrar_anonimo.sql, SECURITY DEFINER: el destino
   de la migración lo decide auth.uid() verificado del lado del servidor,
   nunca un parámetro del cliente).

   Se llama desde iniciarBufon() en secreto.html, ANTES de
   hidratarHistorialDesdeAuth() — el orden importa: si la migración
   corrió, esas filas viejas ya aparecen bajo la identidad real para
   cuando la hidratación las va a buscar. El marcador de "ya migré para
   esta cuenta" vive en localStorage y solo se graba si la llamada
   confirma éxito (sin error) — si falla, se reintenta la próxima vez que
   cargue la página. */
async function bufonMigrarAnonimoSiCorresponde() {
  if (!bufonAuthUidCache) return;
  const idAnonimo = localStorage.getItem("jester_player_id");
  if (!idAnonimo) return; // este navegador nunca jugó como anónimo
  const marcador = "bufonMigradoA_" + bufonAuthUidCache;
  if (localStorage.getItem(marcador)) return;
  try {
    const supabase = await bufonCliente();
    const { error } = await supabase.rpc("bufon_migrar_anonimo", { p_anon_id: idAnonimo });
    if (!error) localStorage.setItem(marcador, "1");
  } catch (err) {
    // Silencioso a propósito, se reintenta en la próxima visita.
  }
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
async function bufonRegistrar({ dialogueId, category, choiceId, questionText, choiceText, eventId }) {
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
      choice_text: choiceText ?? null,
      // Necesario para bufon_side_b_avanzo() (ver
      // scratchpad/bufon_generaciones.sql) — sin esto no hay forma de
      // saber, del lado del servidor, qué elecciones vinieron de qué
      // Side.
      side: (typeof ladoActual === "function") ? ladoActual() : null,
      // Identifica ESTE evento puntual (ver registrarEnHistorial en
      // secreto.html) — es lo que permite fusionar el historial de dos
      // dispositivos sin duplicar nada (ver hidratarHistorialDesdeAuth).
      // eventId ?? null en vez de solo eventId: si algún llamador viejo
      // todavía no lo manda, que quede null y no "undefined" (Supabase
      // no acepta esa clave).
      event_id: eventId ?? null
    });
  } catch (err) {
    // Silencioso a propósito. Sin RLS de lectura no hay forma de
    // confirmarle nada al cliente de todas formas.
  }
}

/* Estado agregado de un choice_id en bufon_elecciones (para el chiste de
   "varios Eledar": alguien afirma durante la conversación "ese fui yo",
   ver data/bufon-contenido.js y el manejo de "asyncNext" en secreto.html).
   Nunca devuelve filas ni player_id ajenos: solo dos números agregados,
   vía la función SECURITY DEFINER bufon_estado_eleccion (ver
   scratchpad/bufon_estado_eleccion.sql). Devuelve null si falla — el
   llamador ya sabe tratar eso como "no hay dato". */
async function bufonEstadoEleccion(choiceId) {
  try {
    const supabase = await bufonCliente();
    const { data } = await supabase.rpc("bufon_estado_eleccion", {
      p_choice_id: choiceId,
      p_player_id: bufonPlayerId()
    });
    const fila = Array.isArray(data) ? data[0] : data;
    return fila || null;
  } catch (err) {
    return null;
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
