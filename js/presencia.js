/* =============================================================================
   PRESENCIA — quién está conectado y qué anda haciendo, en cualquier página del
   sitio. Cada página (con la sesión iniciada) se anuncia en el canal de presencia
   de Supabase con su nombre y una frase según la página; el lobby las muestra en
   la caja "En la taberna". Solo funciona con la sesión iniciada y no guarda nada:
   se borra al cerrar la página.

   No se carga en las páginas secretas (Bufón, Muerte Súbita) ni dice nada de las
   páginas escondidas: ahí se muestra una frase genérica.
============================================================================= */
(function () {
  if (typeof fichasCliente !== "function" || typeof fichasSesionActual !== "function") return;

  // Frases por página (se elige una al azar al entrar). Siempre en tercera persona.
  const FRASES = {
    "index.html": ["Calentándose junto a la chimenea", "Mirando la taberna con cara de misterio", "Eligiendo puerta sin decidirse", "Haciendo como que busca a alguien"],
    "compendio.html": ["Hojeando el Compendio", "Perdido entre cientos de entradas", "Buscando algo que juraba haber leído", "Leyendo \"solo una entrada más\""],
    "mapa.html": ["Mirando el mapa fingiendo que sabe dónde está", "Trazando rutas que nadie le pidió", "Buscando su casa en el mapa"],
    "cronologia.html": ["Repasando quién hizo qué y cuándo", "Viajando por la línea del tiempo", "Descubriendo que todo fue culpa de alguien"],
    "lugares.html": ["Planeando unas vacaciones peligrosas", "Eligiendo dónde NO ir", "Buscando una posada decente"],
    "facciones.html": ["Decidiendo a qué bando traicionar", "Evaluando alianzas dudosas", "Leyendo quién odia a quién"],
    "personajes.html": ["Chismeando sobre los personajes del mundo", "Buscando al culpable de todo", "Mirando caras conocidas"],
    "razas.html": ["Comparando orejas y colmillos", "Eligiendo qué raza se le da mejor mentir"],
    "religion.html": ["Charlando con los dioses (en silencio)", "Contando cuántos dioses son demasiados"],
    "textos.html": ["Leyendo letra chica", "Cultivándose, de a poquito"],
    "pergaminos.html": ["Descifrando pergaminos polvorientos", "Estornudando por culpa de un pergamino"],
    "armas.html": ["Admirando armas que no puede pagar", "Eligiendo con qué golpear mejor"],
    "objetos.html": ["Hurgando en el baúl de objetos", "Buscando algo que brille"],
    "bestiario.html": ["Estudiando cómo no ser comido", "Descubriendo qué criatura lo perseguiría", "Tomando notas de lo que más muerde"],
    "reglas.html": ["Discutiendo las reglas con el reglamento", "Buscando la regla que le conviene"],
    "economia.html": ["Contando monedas imaginarias", "Calculando si le alcanza para la posada"],
    "estadisticas.html": ["Midiendo monstruos con una cinta", "Mirando números con cara seria"],
    "fanarts.html": ["Babeando con los fanarts", "Buscando su personaje entre los dibujos", "Admirando lo que dibuja la gente"],
    "peticiones.html": ["Dejando una petición en el buzón", "Redactando una sugerencia con mucha seriedad"],
    "fichas.html": ["Revisando los misterios de sus personajes", "Contando puntos de atributo con los dedos", "Dándole un último retoque a su ficha", "Preguntándose por qué su personaje hizo eso"],
    "minijuegos.html": ["Eligiendo con qué perder el tiempo", "Decidiendo qué juego le va a doler más"],
    "ajedrez.html": ["Pensando una jugada durante demasiado tiempo", "Fingiendo que sabe de ajedrez", "Moviendo un peón con aire de gran estratega"],
    "ritmo.html": ["Golpeando notas al compás de la Zarabanda", "Moviendo los dedos como si fueran de otro", "Siguiendo el ritmo con la cabeza"],
    "parranda.html": ["Rasgueando el aire mientras caen las notas", "Sintiéndose estrella de rock en el escenario", "Perdiendo el combo por culpa del dedo meñique"],
    "parranda-editor.html": ["Armando un mapa de Parranda carril por carril", "Grabando notas a mano de oído", "Mapeando una batería con paciencia infinita"],
    "ritmo-editor.html": ["Jugueteando con el editor del Zarabanda", "Acomodando notas en el editor de mapas", "Poniéndole ritmo a una canción desde cero", "Pelando con el compás en el editor"],
    "rocola.html": ["Poniendo música a la taberna", "Peleando con la rocola", "Eligiendo la canción que todos van a odiar"],
    "sacrificio.html": ["Sacrificando a Hooey sin remordimientos", "Tratando de que ninguno toque el piso"]
  };
  // Páginas escondidas o de administración: no se dice qué son
  const GENERICAS = ["Trasteando por ahí", "Tras bambalinas, moviendo hilos", "En algún rincón de la taberna"];
  const OCULTAS = ["arqueria.html", "duelo.html", "cartas.html", "valhalla.html", "admin.html"];
  const FALLBACK = ["Paseando por la taberna", "Curioseando por ahí"];
  const OTRA_PESTANA = ["En otra pestaña, vaya a saber qué hace", "Se fue a mirar otra cosa", "Desaparecido (probablemente tomando agua)"];

  const alAzar = lista => lista[Math.floor(Math.random() * lista.length)];
  const pagina = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const miFrase = OCULTAS.includes(pagina) ? alAzar(GENERICAS) : alAzar(FRASES[pagina] || FALLBACK);
  const miOtra = alAzar(OTRA_PESTANA);

  const oyentes = new Set();
  let ultimo = [];
  let canal = null;

  function leer() {
    if (!canal) return [];
    const estado = canal.presenceState();
    return Object.entries(estado).map(([id, metas]) => {
      // si hay varias pestañas de la misma persona, vale la más reciente
      const m = metas.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || {};
      return { id, nombre: m.nombre || "alguien", frase: m.frase || "", oculto: !!m.oculto };
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  function avisar() {
    ultimo = leer();
    oyentes.forEach(cb => { try { cb(ultimo); } catch (e) { /* un oyente roto no frena a los demás */ } });
  }

  window.Presencia = {
    /* cb(lista) con [{ id, nombre, frase, oculto }]; se llama al instante con lo último y en cada cambio. */
    suscribir(cb) { oyentes.add(cb); cb(ultimo); return () => oyentes.delete(cb); }
  };

  async function iniciar() {
    let sesion;
    try { sesion = await fichasSesionActual(); } catch (e) { return; }
    if (!sesion) return;
    const miId = sesion.user.id;
    // el nombre lo guarda lado.js en localStorage (se lee directo: esta página puede cargar antes que lado.js)
    let nombre = "";
    try { nombre = localStorage.getItem("compendioUsername") || ""; } catch (e) { /* sin almacenamiento */ }
    nombre = nombre || (sesion.user.email || "").split("@")[0] || "alguien";
    let supabase;
    try { supabase = await fichasCliente(); } catch (e) { return; }
    try {
      canal = supabase.channel("lobby-presencia", { config: { presence: { key: miId } } });
      canal.on("presence", { event: "sync" }, avisar);
      const anunciar = () => canal.track({
        nombre, ts: Date.now(),
        frase: document.hidden ? miOtra : miFrase,
        oculto: document.hidden
      });
      canal.subscribe(async estado => { if (estado === "SUBSCRIBED") await anunciar(); });
      document.addEventListener("visibilitychange", () => { try { anunciar(); } catch (e) { /* sin conexión */ } });
    } catch (e) { /* sin tiempo real: simplemente no hay presencia */ }
  }
  iniciar();
})();
