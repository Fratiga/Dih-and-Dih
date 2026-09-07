/* =============================================================================
   PERSONAJES ESTABLECIDOS (Side B, por ahora) — negar el registro si
   alguien intenta ponerse el nombre de un personaje real de la
   campaña. Ver renderFormularioRegistro() en secreto.html: si el
   nombre ingresado matchea una de estas claves (sin distinguir
   mayúsculas), NO se guarda — se muestra el remate y se vuelve al
   formulario para que lo intenten de nuevo con su nombre real.

   Principio: SOLO personajes NPC. Ningún personaje jugador (tipo
   "Jugador" en data/personajes.js) va acá, aunque no tenga todavía un
   chiste propio — siempre puede existir una persona real de mesa que
   legítimamente quiera registrarse con el nombre de su propio
   personaje, y negarle la entrada sería el error contrario al que
   este archivo trata de evitar.

   Por eso NO incluye, a propósito: "eledar"/"eledar eagerdawn" (ya
   tiene su chiste propio en reaccionPorNombreRegistrado, que asume que
   el registro SÍ se completa), "ryn" (idem), "cassius"/"cassius
   coldgrave" (idem), "laia" (jugador, sin chiste propio todavía),
   "hooey"/"hooey magoo" (jugador, sin chiste propio todavía),
   "sigismund" (jugador, sin chiste propio todavía). Si alguno de estos
   tres últimos consigue su propio chiste de reconocimiento más
   adelante, mejor — pero mientras no lo tenga, que pase el registro
   sin problema es preferible a rechazarlo.

   Cada entrada: alias en minúsculas -> array de líneas (mismo formato
   que cualquier nodo). Varios alias pueden compartir el mismo array.
============================================================================= */
window.BUFON_NOMBRES_PERSONAJES = (() => {
  const tabla = {};
  function agregar(alias, lineas) {
    alias.forEach(a => { tabla[a] = lineas; });
  }

  agregar(["adam", "adam kovacs", "adam klasrom"], [
    "No me gustan las mentiras.",
    "Adam no es el tipo de persona que soñaría con payasos.",
    "Ya le gustaría."
  ]);
  agregar(["bull"], [
    "Bull no habla con nadie que no le deba dinero primero.",
    "Tú no me debes nada. Todavía."
  ]);
  agregar(["garra"], [
    "Garra no tiene paciencia ni para esto.",
    "Ya te habría echado de la sala."
  ]);
  agregar(["baraja"], [
    "Baraja nunca entra primero a ningún lado.",
    "Tú sí. Eso ya te delata."
  ]);
  agregar(["ocevat"], [
    "Ocevat está muerto.",
    "Con todo respeto, se nota bastante que tú no."
  ]);
  agregar(["verdam"], [
    "Verdam no habla con nadie. Ni siquiera contigo.",
    "Y menos te diría dónde está."
  ]);
  agregar(["eklino"], [
    "Eklino murió defendiendo un refugio que ya no existe.",
    "Tú, en cambio, estás vivo y mintiéndome."
  ]);
  agregar(["coach"], [
    "Coach murió antes de terminar su encargo.",
    "Tú ya terminaste el tuyo. Mentirme."
  ]);
  agregar(["prisionero enmascarado", "el enmascarado", "prisionero de la mascara", "prisionero de la máscara"], [
    "Nadie sabe quién hay debajo de esa máscara.",
    "Tú tampoco, por lo visto."
  ]);
  agregar(["sunny", "hoare", "sunny y hoare"], [
    "Sunny y Hoare siguen huyendo de Kigan.",
    "No tienen tiempo para esto. Tú, evidentemente, sí."
  ]);
  agregar(["sett"], [
    "Sett está en Wolfmere, esperando volver a ver a alguien.",
    "No a ti."
  ]);
  agregar(["isa"], [
    "Isa se pasa el día recordándole a todo el mundo lo guapo que es.",
    "Tú ni siquiera lo intentaste."
  ]);
  agregar(["leonard", "principe leonard", "príncipe leonard", "leonard goldenside"], [
    "Un príncipe no necesita registrarse en nada.",
    "Eso ya te delata bastante."
  ]);
  agregar(["julius", "rey julius", "julius goldenside", "rey julius goldenside"], [
    "El rey no tiene paciencia para juicios largos.",
    "Y esto, ya de por sí, se está poniendo largo."
  ]);
  agregar(["gareth"], [
    "Gareth no le debe nada a nadie.",
    "Y definitivamente no te prestaría el nombre."
  ]);
  agregar(["torvrena"], [
    "Torvrena cobra por adelantado y no habla de más.",
    "Tú, en cambio, hablaste de más. Ahí está el problema."
  ]);
  agregar(["billy"], [
    "Billy sigue dolido por cómo terminó esa pelea en Kigan.",
    "No tiene ánimo para prestarle el nombre a nadie."
  ]);
  agregar(["voss"], [
    "Voss ya perdió una pelea este mes.",
    "No va a perder también el nombre."
  ]);
  agregar(["victor"], [
    "Victor no aprende. Pero tampoco presta su nombre."
  ]);
  agregar(["desconocido de los baños", "desconocido de los banos", "el desconocido"], [
    "Ni él mismo dice quién es en realidad.",
    "Mal ejemplo para copiar."
  ]);
  agregar(["rojo"], [
    "Rojo ya se autoproclamó líder de todo lo que se le ocurrió.",
    "El nombre también, seguramente. Pero no es tuyo."
  ]);
  agregar(["verde"], [
    "Verde roba cosas por la espalda.",
    "El nombre lo intentaste robar de frente. Mal instinto."
  ]);
  agregar(["morado"], [
    "Morado se especializa en que nadie termine de hacer lo que estaba haciendo.",
    "Esto tampoco lo vas a terminar."
  ]);
  agregar(["amarillo"], [
    "Amarillo no entiende palabras difíciles.",
    "Pero entiende perfecto cuando alguien intenta algo raro. Como esto."
  ]);
  agregar(["azul"], [
    "Azul nunca ataca directo. Prefiere estorbar.",
    "Esto que intentaste es puro estorbo. Encaja, al menos."
  ]);
  agregar(["gris"], [
    "Gris es el único de esos seis que piensa antes de actuar.",
    "A ti se te ocurrió esto sin pensar nada. No califica."
  ]);

  return tabla;
})();
