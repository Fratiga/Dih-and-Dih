/* =============================================================================
   HIPÓDROMO: el glosario. Cada palabra técnica de las carreras (terreno, drenaje, cuota, podio, estilo, núcleo...) se
   puede señalar o tocar y explica qué es en una frase. Uso en el HTML que pintan las pestañas:
     HipodromoGlosario.tip("drenaje", "Drenaje")  ->  <span class="hip-tip" ...>Drenaje</span>
   o directamente <span class="hip-tip" data-tip-id="cuota" tabindex="0">Cuota</span> en el HTML de la página.
   La caja con la explicación es una sola, flotante, que sigue al ratón, al foco del teclado o al dedo.
============================================================================= */
window.HipodromoGlosario = (function () {
  "use strict";
  const G = {
    /* ---- la pista */
    pista: "El lugar donde se corre. Cada pista tiene su suelo, sus curvas, sus cuestas y su drenaje, y cada jornada (12 carreras seguidas, medio día) se corre en una. Las hay normales y las arcanas, con reglas propias.",
    suelo: "De qué está hecha la pista: hierba, arcilla o arena (y cristal, nube, pantano o brasa en las arcanas). Cambia cómo se ve la carrera; lo que de verdad pesa en el resultado es la humedad.",
    terreno: "El estado del suelo ese día, según lo húmedo que esté: firme, bueno, blando o pesado. Lo moja la lluvia y lo seca el drenaje de la pista. Importa por la pezuña de cada criatura.",
    terreno_firme: "Terreno firme: suelo seco, humedad por debajo de 0,12. Rinden mejor las criaturas de pezuña fina.",
    terreno_bueno: "Terreno bueno: algo de humedad, de 0,12 a 0,30. Es casi neutro: ni ayuda ni estorba a ninguna pezuña.",
    terreno_blando: "Terreno blando: bastante húmedo, de 0,30 a 0,55. Favorece a las de pezuña ancha, y suben un poco los tropiezos y las lesiones.",
    terreno_pesado: "Terreno pesado: barro, humedad por encima de 0,55. Favorece mucho a las de pezuña ancha, frena a las de pezuña fina y sube los tropiezos, las lesiones y el cansancio.",
    humedad: "Cuánta agua tiene la pista, de 0 a 1. Sale de la lluvia que dejó antes más el clima de hoy, y se reduce con el drenaje. Se queda de una carrera a otra y baja a la mitad al cambiar de jornada.",
    drenaje: "Lo bien que la pista se deshace del agua, de 0 a 1. Con drenaje alto la humedad baja casi a la mitad (la arena casi nunca se embarra); con drenaje bajo, cualquier lluvia la deja pesada (la arcilla).",
    curvas: "Cuántas curvas tiene la pista, de 0 a 1. En las curvas pierden velocidad las criaturas poco ágiles (las de cola corta y rígida), y la puerta de salida pesa un poco más.",
    cuestas: "Lo empinada que es la pista, de 0 a 1. Cada tramo en cuesta gasta más energía, así que pesa más la resistencia. Las alas y las garras alivian el coste.",
    arcana: "Pista arcana: una pista con una regla propia (ilusión, corrientes, sumidero o brasas) que cambia la carrera. Las criaturas con núcleo responden mejor en ellas. La regla se explica en cada carrera.",
    /* ---- la carrera */
    grado: "La categoría de la carrera. Decide cuánta bolsa hay y qué criaturas entran, por su valoración: Gran Premio y Selecta para las mejores, Corriente para las del montón y Novatos para las que casi no han corrido.",
    grado_gran: "Gran Premio: la categoría más alta. La bolsa más grande y las criaturas de mejor valoración.",
    grado_selecta: "Selecta: por debajo del Gran Premio. Criaturas buenas, con una bolsa media.",
    grado_corriente: "Corriente: las criaturas de valoración media. Es la categoría más frecuente.",
    grado_novatos: "Novatos: para las que casi no han corrido o todavía no han ganado. La bolsa es la más pequeña.",
    distancia: "Lo larga que es la carrera, en metros. En las cortas manda la velocidad; en las largas, la resistencia. Cada 100 metros es un tramo.",
    tramo: "Un tramo son 100 metros. El motor calcula cuánto tarda cada criatura en cada tramo; con eso se anima la carrera.",
    bolsa: "El dinero que reparte la carrera entre los cinco primeros: 50 %, 25 %, 12 %, 8 % y 5 %. Si la criatura tiene dueño, se lo lleva el dueño. Es aparte de las apuestas.",
    pronostico: "La probabilidad de cada tipo de tiempo (despejado, lluvia, tormenta...) para esta carrera. Es la probabilidad real, no una pista falsa, pero el tiempo que sale puede no ser el más probable.",
    rumores: "Lo que se comenta en las cuadras antes de la carrera. Aciertan en torno al 65 % de las veces: sirven de pista, no de certeza.",
    puerta: "La puerta de salida: el número del carril desde el que sale. En pistas con muchas curvas las puertas interiores tienen una pequeña ventaja, y salir en medio de un pelotón apretado cuesta tropezar con los de delante.",
    margen: "La distancia a la ganadora, en cuerpos: un cuerpo es lo que mide una criatura, unos 2,4 metros. «Por un hocico» y «por una cabeza» son diferencias de centímetros.",
    foto_meta: "Foto de meta: las dos primeras llegaron tan juntas (menos de 6 centésimas de cuerpo) que solo se decide mirando la foto.",
    favorito: "El favorito: la criatura con la cuota más baja, la que el público cree que tiene más posibilidades.",
    /* ---- apuestas */
    cuota: "Lo que paga la apuesta por cada moneda si aciertas, contando la que apostaste. Con cuota 4,00, apostar 100 devuelve 400 si aciertas. Cuanto más baja, más probable cree el público que es.",
    ganador: "Apuesta a ganador: aciertas si la criatura llega la primera. Cuota fija.",
    podio: "Apuesta a podio: aciertas si la criatura llega entre las tres primeras. Paga menos que ganador.",
    exacta: "Apuesta exacta: aciertas si eliges la primera y la segunda, en ese orden. Paga mucho, pero es difícil.",
    pozo: "Apuesta al pozo: aciertas si la criatura gana, pero no hay cuota fija. Todo lo apostado al pozo más 50 monedas de la casa, menos un 10 %, se reparte entre quienes aciertan según lo que pusieron. Cuanta menos gente acierta, más paga.",
    doble: "Doble: si aciertas, lo que cobras no pasa a tu saldo, sino que se juega solo a ganador al favorito de la carrera siguiente, con su cuota. Si no se puede apostar a esa, se cobra normal.",
    rendimiento: "Lo que has ganado o perdido en apuestas, en porcentaje de lo apostado. Con una cuota con margen de la casa, a la larga lo normal es perder un poco.",
    /* ---- la criatura */
    valoracion: "Una nota de 0,5 a 5 estrellas según sus resultados. Lleva ruido: con pocas salidas puede engañar, y se afina cuantas más carreras corre.",
    ultimas: "Los puestos de sus últimas carreras (1.º, 2.º...). Pasa el ratón por cada una para ver cuál fue.",
    estilo: "Cómo corre: al frente (sale lanzada y marca el ritmo), a media tabla, o remontando desde atrás. Se descubre después de unas cuantas salidas. Si salen varias al frente a la vez, se desgastan.",
    tipo_dist: "A qué distancia le va mejor. Velocista: las cortas. Milero: las medias. Fondista: las largas. Sale de comparar su resistencia con su velocidad.",
    arq_flecha: "Flecha: patas largas y poco fondo. Muy rápida en distancias cortas.",
    arq_tanque: "Tanque: mucho fondo y poca punta de velocidad. Aguanta, pero no es rápida.",
    arq_maratonista: "Maratonista: pecho muy amplio, mucha resistencia. Brilla en las carreras largas.",
    arq_saltador: "Saltador: ancas muy potentes. Sale y acelera mejor que nadie y se recupera antes del cansancio.",
    etapa: "La edad de la criatura: cría, potro, joven, adulto, veterano, y al final retirada o fallecida. No corre hasta cumplir 1 año; rinde al máximo de los 2,5 a los 5 y pierde algo después.",
    generacion: "Cuántas generaciones de padres tiene en este mundo. Las fundadoras son la 1; sus hijas, la 2.",
    capacidades: "Las cinco cosas que mide su entrenador: velocidad, resistencia, arranque, agilidad y temple.",
    cap_vel: "Velocidad: la velocidad punta. Sale de las patas largas.",
    cap_res: "Resistencia: cuánto aguanta antes de aflojar. Sale del pecho. Pesa más en las carreras largas.",
    cap_ace: "Arranque: lo bien que sale y acelera, y lo pronto que se recupera del cansancio. Sale de las ancas.",
    cap_agi: "Agilidad: cuánto pierde en las curvas y con el tráfico. Sale de la cola.",
    cap_tem: "Temple: cuánto se equivoca y cuánto la altera el mal tiempo, la niebla o los Espejos. Sale de la mirada.",
    cansancio: "Lo cansada que está, de 0 a 100. Cada salida lo sube (más en las largas y con barro) y cada carrera que pasa lo baja. Cansada rinde menos y se lesiona más. Hasta 68 se la considera descansada.",
    forma: "Cómo ha amanecido: sube y baja con el tiempo, sin avisar. Una criatura en un gran momento rinde más de lo que dicen sus números; una apagada, menos.",
    pezuna: "La pezuña dice cómo le sienta el barro: la ancha rinde mejor con terreno blando o pesado, la fina con el suelo seco.",
    pelaje: "El pelaje dice cómo le sienta el clima: el denso rinde mejor con frío y el ralo con calor.",
    aptitudes: "Cómo le ha ido en cada tipo de terreno. Hacen falta 2 salidas en ese terreno para tener estrellas.",
    lesion: "Lesionada: no puede correr hasta que se cure. Las leves duran de 10 a 30 carreras, las medias de 36 a 96, y las graves la retiran. A veces dejan una secuela permanente.",
    secuelas: "Lo que le quedó de una lesión media: una capacidad que ya no es la misma. Se nota en el dibujo (vendajes, cicatrices).",
    leyenda: "Leyenda: una criatura que ganó 14 carreras o 3 Grandes Premios.",
    racha: "En racha: lleva varias victorias seguidas.",
    mala_racha: "En mala racha: lleva cuatro carreras seguidas en la parte de atrás del pelotón.",
    rinde_mejor: "Rinde mejor en ese terreno: ha corrido al menos 3 veces en él y sus resultados ahí son claramente mejores que su media.",
    sufre: "Sufre en ese terreno: ha corrido al menos 3 veces en él y sus resultados ahí son claramente peores que su media.",
    criador: "En la cría: ya no corre y pasa a tener crías. Las hembras las tienen, los machos son sementales.",
    retirada: "Retirada: ya no corre. Se retira por edad, por lesión grave o porque su dueño lo decide.",
    nucleo: "Núcleo de carrera: un órgano que algunas criaturas llevan en el pecho (se ve como un brillo). Solo importa en las pistas arcanas, donde da una ventaja pequeña; las de núcleo vivo y ardiente son más frágiles.",
    rasgos: "Rasgos: cosas como los cuernos, las alas, la piel, los ojos o las patas extra. Algunos cambian algo en la carrera (se dice en cada uno) y otros son solo adorno. Se heredan de los padres.",
    familia: "La cinta de color del tobillo y la manta son el color de su familia: las criaturas de un mismo linaje comparten color.",
    /* ---- el cuerpo: cada parte dice una capacidad (la ficha enseña el nivel de 1 a 5) */
    cuerpo_pat: "Patas: dicen la velocidad punta. Cuanto más largas, más rápida.",
    cuerpo_pul: "Pecho: dice la resistencia, cuánto aguanta antes de aflojar. El de barril es el que más aguanta.",
    cuerpo_mus: "Ancas: dicen la salida y la aceleración, y lo pronto que se recupera del cansancio.",
    cuerpo_col: "Cola: dice la agilidad en las curvas. La larga y suelta es de las más ágiles.",
    cuerpo_ojo: "Mirada: dice el temple, cuánto se equivoca y cuánto la altera el mal tiempo.",
    cuerpo_pez: "Pezuña: dice cómo le sienta el barro. La ancha rinde mejor con terreno blando; la fina, con suelo seco.",
    cuerpo_pel: "Pelaje: dice cómo le sienta el clima. El denso rinde mejor con frío y el ralo con calor.",
    cuerpo_tam: "Talla: no cambia nada en la carrera. Es solo adorno.",
    /* ---- la cuadra */
    cuadra: "Tu cuadra: las criaturas que son tuyas. Los entrenadores del mundo no las mueven: las inscribes tú, y los premios son tuyos.",
    inscribir: "Inscribir cuesta el 10 % de la bolsa y se devuelve si la carrera no se corre o la criatura no puede salir. Las inscripciones de cada carrera cierran cuando termina la anterior.",
    entrenar: "Una sesión dura 6 carreras (6 horas), cuesta 30 monedas y la criatura no corre mientras tanto. Mejora un poco una capacidad (más si es joven, menos cuanto más entrenada; tope +8) y puede lesionarla.",
    cuidar: "Cuidados veterinarios: quitan 20 de cansancio y acortan una lesión leve o media un 40 %. Cuestan 40 monedas y hay que esperar 6 carreras entre uno y otro.",
    tactica: "Cómo sale a correr: al frente, a media tabla o desde atrás. Ir contra la naturaleza de la criatura cuesta un poco de velocidad.",
    monta: "La monta es lo que se paga por que un semental críe con una de tus hembras. Si el semental es de otro jugador, el dinero va para él.",
    cruzar: "Cruzar una hembra retirada a la cría con un semental. La cría nace 12 carreras después y es del dueño de la madre.",
    reserva: "La reserva de cartas: las copias que los jugadores vendieron o perdieron. Es lo único que se puede comprar con monedas; comprar no crea cartas nuevas."
  };

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /* El texto con su explicación. Si la clave no existe devuelve el texto tal cual. */
  const tip = (clave, texto) => (G[clave] ? `<span class="hip-tip" data-tip-id="${esc(clave)}" tabindex="0">${texto == null ? esc(clave) : texto}</span>` : (texto == null ? "" : texto));
  /* Las etiquetas de la ficha («Rinde mejor en terreno pesado», «En racha: 3 victorias seguidas»...) */
  function claveEtiqueta(t) {
    if (/^Rinde mejor/.test(t)) return "rinde_mejor";
    if (/^Sufre/.test(t)) return "sufre";
    if (/^En racha/.test(t)) return "racha";
    if (/^En mala racha/.test(t)) return "mala_racha";
    if (/^Leyenda/.test(t)) return "leyenda";
    return null;
  }

  /* ---------------------------------------------------------------- la caja flotante */
  let caja = null, actual = null;
  function crearCaja() {
    caja = document.createElement("div");
    caja.className = "hip-tipcaja"; caja.setAttribute("role", "tooltip"); caja.hidden = true;
    document.body.appendChild(caja);
  }
  function mostrar(el) {
    const t = G[el.dataset.tipId]; if (!t) return;
    if (!caja) crearCaja();
    actual = el; caja.textContent = t; caja.hidden = false;
    const r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
    caja.style.maxWidth = w + "px";
    const h = caja.offsetHeight, ancho = caja.offsetWidth;
    let x = Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left + r.width / 2 - ancho / 2));
    let y = r.bottom + 8; if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 8);
    caja.style.left = x + "px"; caja.style.top = y + "px";
  }
  function ocultar() { if (caja) caja.hidden = true; actual = null; }
  document.addEventListener("mouseover", e => { const el = e.target.closest && e.target.closest(".hip-tip"); if (el) mostrar(el); });
  document.addEventListener("mouseout", e => { const el = e.target.closest && e.target.closest(".hip-tip"); if (el && !(e.relatedTarget && el.contains(e.relatedTarget))) ocultar(); });
  document.addEventListener("focusin", e => { const el = e.target.closest && e.target.closest(".hip-tip"); if (el) mostrar(el); });
  document.addEventListener("focusout", ocultar);
  document.addEventListener("click", e => {   // en el móvil no hay ratón: un toque abre y otro toque (o tocar fuera) cierra
    const el = e.target.closest && e.target.closest(".hip-tip");
    if (el && el === actual && caja && !caja.hidden && e.detail === 0) ocultar();
    else if (el) mostrar(el);
    else ocultar();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") ocultar(); });
  window.addEventListener("scroll", ocultar, true);
  return { G, tip, claveEtiqueta, mostrar, ocultar };
})();
