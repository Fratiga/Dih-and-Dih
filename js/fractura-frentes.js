/* =============================================================================
   LA FRACTURA: los frentes. Una rotación de guerras ya montadas contra la máquina: tres al día y una
   gran guerra a la semana. Son las que dan cartas (una guerra libre no da nada).
   Todo sale de la fecha (en hora universal), así que todos los jugadores ven los mismos frentes y
   juegan el mismo mapa. El nivel de cada frente lo vuelve a calcular el servidor con los bandos y la
   dificultad (docs/fractura-3_frentes_y_mesas.sql): aquí solo se muestra.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);

  const NIVELES = {
    escaramuza: { nombre: "Escaramuza", premio: "Premio menor", texto: "Una de cada dos veces, una carta común o poco común. Si no, un sello." },
    guerra: { nombre: "Guerra", premio: "Premio medio", texto: "Casi siempre una carta poco común o rara. Si no, un sello." },
    gran_guerra: { nombre: "Gran guerra", premio: "Premio mayor", texto: "Una carta rara." }
  };
  /* La misma regla que el servidor */
  const nivelDe = (bandos, dificultad) => (bandos >= 5 || (bandos >= 4 && dificultad === "dificil") ? "gran_guerra" : bandos >= 3 || dificultad === "dificil" ? "guerra" : dificultad === "normal" ? "escaramuza" : null);

  function semillaDe(texto) {
    let h = 2166136261;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function azar(semilla) {
    let a = semilla >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const dosCifras = n => String(n).padStart(2, "0");
  const fechaClave = f => `${f.getUTCFullYear()}${dosCifras(f.getUTCMonth() + 1)}${dosCifras(f.getUTCDate())}`;

  function montar(clave, hasta, que) {
    const r = azar(semillaDe(`fractura:${clave}`));
    const de = lista => lista[Math.floor(r() * lista.length)];
    const tipos = Object.keys(D.TIPOS_FRACTURA), formas = Object.keys(D.FORMAS_MAPA);
    const tierra = formas.filter(f => !D.FORMAS_MAPA[f].maritimo), mar = formas.filter(f => D.FORMAS_MAPA[f].maritimo);
    let tipo = de(tipos), forma, bandos, dificultad, equipos = false, titulo;
    if (que === "escaramuza") { bandos = 2; dificultad = "normal"; forma = de(tierra); titulo = "Escaramuza"; }
    else if (que === "guerra") { bandos = r() < 0.5 ? 3 : 4; dificultad = "normal"; forma = r() < 0.55 ? de(mar) : de(formas); titulo = "Guerra abierta"; }
    else if (que === "duro") { bandos = r() < 0.6 ? 2 : 3; dificultad = "dificil"; forma = de(formas); titulo = "Frente duro"; }
    else { bandos = 5 + Math.floor(r() * 4); dificultad = r() < 0.35 ? "dificil" : "normal"; forma = de(formas); equipos = bandos % 2 === 0 && r() < 0.4; titulo = "Gran guerra de la semana"; }
    // El Horizonte Roto no tiene mar: si la forma es de mar, se cambia de lugar
    if (tipo === "horizonte" && D.FORMAS_MAPA[forma].maritimo) tipo = de(tipos.filter(t => t !== "horizonte"));
    if (tipo === "horizonte") forma = "continente";
    // Rivales: todos los ejércitos barajados. Al empezar se cogen los primeros que no sean el del jugador.
    const rivales = Object.keys(D.FACCIONES);
    for (let i = rivales.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rivales[i], rivales[j]] = [rivales[j], rivales[i]]; }
    const nivel = nivelDe(bandos, dificultad);
    return { clave, titulo, nivel, tipo, forma, bandos, equipos, dificultad, rivales, semilla: (semillaDe(`mapa:${clave}`) % 2000000000) + 1, hasta: hasta.getTime(), semanal: que === "gran" };
  }

  /* Los frentes abiertos ahora mismo */
  function abiertos(ahora) {
    const f = ahora ? new Date(ahora) : new Date();
    const dia = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate()));
    const manana = new Date(dia.getTime() + 86400000);
    const lunes = new Date(dia.getTime() - ((dia.getUTCDay() + 6) % 7) * 86400000);
    const otroLunes = new Date(lunes.getTime() + 7 * 86400000);
    const k = fechaClave(dia);
    return [montar(`d${k}-0`, manana, "escaramuza"), montar(`d${k}-1`, manana, "guerra"), montar(`d${k}-2`, manana, "duro"), montar(`w${fechaClave(lunes)}-0`, otroLunes, "gran")];
  }
  /* Los rivales de un frente para un ejército concreto (nunca contra sí mismo) */
  const rivalesPara = (frente, faccion) => frente.rivales.filter(x => x !== faccion).slice(0, frente.bandos - 1);
  /* Cuánto queda para que cambie, en palabras */
  function quedan(frente, ahora) {
    const ms = Math.max(0, frente.hasta - (ahora || Date.now())), h = Math.floor(ms / 3600000);
    if (h >= 48) return `${Math.floor(h / 24)} días`;
    if (h >= 24) return "1 día";
    if (h >= 1) return `${h} h`;
    return `${Math.max(1, Math.floor(ms / 60000))} min`;
  }

  raiz.FracturaFrentes = { abiertos, rivalesPara, quedan, nivelDe, NIVELES };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaFrentes;
})(typeof window !== "undefined" ? window : globalThis);
