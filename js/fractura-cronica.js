/* =============================================================================
   LA FRACTURA: crónica de cada guerra. Convierte los sucesos que anotó el motor (est.cronica) y lo
   que pasó con los soldados (resumen de fractura-campana.js) en un relato corto. Las frases salen
   de plantillas con variantes, elegidas con la semilla de la guerra para que el mismo relato
   salga igual si se vuelve a generar. También junta las guerras de todos en la historia del mundo.
   Se usa igual en el navegador y en Node.
============================================================================= */
(function (raiz) {
  const D = raiz.FRACTURA_DATOS || (typeof require !== "undefined" ? require("./fractura-datos.js") : null);
  const { FACCIONES, TIPOS_FRACTURA } = D;

  const ROMANOS = ["", "I", "II", "III"];
  const pick = (semilla, i, lista) => lista[Math.abs(Math.imul(semilla ^ (i * 2654435761), 1597334677) >>> 8) % lista.length];

  /* Una plantilla por tipo de suceso, con varias formas. {x} se sustituye con los datos. */
  const PLANTILLAS = {
    conquista: [
      "{por} tomó {ciudad}, en {region}.",
      "{ciudad} cayó en manos de {bando} cuando {por} cruzó sus puertas.",
      "En {region}, {por} entró en {ciudad} y la hizo suya."
    ],
    capital: [
      "{por} llegó a {ciudad}, la capital de {rival}, y la guerra se decidió ahí.",
      "La capital de {rival} cayó. {por} plantó allí el estandarte de {bando}.",
      "{ciudad} no resistió. {por} la tomó y terminó la guerra."
    ],
    fortaleza: [
      "{por} se hizo con la fortaleza de {region}.",
      "La fortaleza de {region} cambió de manos con {por} al frente."
    ],
    caida: [
      "{nombre} cayó en {region}{por}.",
      "En {region} murió {nombre}{por}.",
      "{nombre} no volvió de {region}{por}."
    ],
    caidaCapitan: [
      "{nombre}, capitán de la {compania} compañía, cayó en {region}{por}. Los suyos quedaron sin mando.",
      "La {compania} compañía perdió a su capitán, {nombre}, en {region}{por}."
    ],
    lider: [
      "{nombre} fue abatido{por}. {estado}.",
      "{nombre} cayó en {region}{por}. Para {bando}, {estado_min}."
    ],
    heroico: [
      "{nombre} debió morir en {region} y siguió en pie.",
      "En {region}, {nombre} aguantó un golpe que no tenía que aguantar."
    ],
    reliquia: [
      "{nombre} recogió {reliquia}.",
      "{reliquia} cambió de manos: ahora la lleva {nombre}."
    ],
    tecnologia: [
      "{bando} dominó {nombre}, de la escuela {escuela}.",
      "{nombre} quedó al alcance de {bando}."
    ],
    nucleo: [
      "{bando} puso un pie sobre el Núcleo del Sueño y empezó a mantener la posición.",
      "El Núcleo del Sueño quedó bajo la sombra de {bando}."
    ],
    sabotaje: [
      "{por} saboteó {edificio} en {ciudad}.",
      "En {ciudad}, {por} dejó fuera de servicio {edificio}."
    ],
    reanimacion: [
      "{nombre} se levantó otra vez al servicio de {bando}.",
      "Los muertos no descansaron en esta guerra: {nombre} volvió a pelear para {bando}."
    ],
    suceso: [
      "Algo se movió en {region}.",
      "La Fractura se agitó en {region}."
    ]
  };

  const lleno = (txt, d) => txt.replace(/\{(\w+)\}/g, (m, k) => (d[k] === undefined || d[k] === null ? "" : d[k]));

  function importancia(e) {
    switch (e.tipo) {
      case "fin": return 100;
      case "conquista": return e.capital ? 90 : 55;
      case "lider": return 80;
      case "caida": return e.capitan ? 70 : Math.min(60, 20 + (e.victorias || 0));
      case "heroico": return 45;
      case "reliquia": return 40;
      case "nucleo": return 50;
      case "fortaleza": return 35;
      case "sabotaje": return 30;
      case "reanimacion": return 38;
      case "tecnologia": return 20;
      default: return 10;
    }
  }

  /* Texto de un suceso */
  function frase(est, e, ctx, i) {
    const J = est.jugadores;
    const bandoDe = d => (d === 0 || d === 1 ? J[d].nombre : "las fuerzas del lugar");
    const rivalDe = d => (d === 0 || d === 1 ? J[1 - d].nombre : "el rival");
    const datos = {
      por: e.por ? `${e.por}` : "", ciudad: e.ciudad, region: e.region, bando: bandoDe(e.dueno), rival: rivalDe(e.dueno), nombre: e.nombre, escuela: e.escuela,
      reliquia: e.reliquia, edificio: e.edificio, estado: e.estado, estado_min: e.estado ? e.estado.charAt(0).toLowerCase() + e.estado.slice(1) : "",
      compania: ROMANOS[e.compania] || e.compania || ""
    };
    let clave = e.tipo === "conquista" && e.capital ? "capital" : e.tipo === "caida" && e.capitan ? "caidaCapitan" : e.tipo;
    if (!PLANTILLAS[clave]) return null;
    if (e.tipo === "caida" || e.tipo === "lider") datos.por = e.por ? ` a manos de ${e.por}` : "";
    else if (e.tipo === "conquista" || e.tipo === "fortaleza" || e.tipo === "capital") datos.por = e.por || "Un soldado";
    else if (e.tipo === "sabotaje") datos.por = e.por;
    let t = lleno(pick(est.semilla, i, PLANTILLAS[clave]), datos).replace(/\s+\./g, ".").replace(/\s{2,}/g, " ");
    // Los saludos de las plantillas ya llevan punto; si el texto final no lo trae, se pone
    if (!/[.!?]$/.test(t)) t += ".";
    return t;
  }

  function tituloDe(est, eventos) {
    const capital = eventos.find(e => e.tipo === "conquista" && e.capital);
    if (capital) return `La caída de ${capital.ciudad}`;
    const peso = {};
    eventos.forEach(e => { if (e.region) peso[e.region] = (peso[e.region] || 0) + importancia(e); });
    const top = Object.keys(peso).sort((a, b) => peso[b] - peso[a])[0];
    if (est.razon && est.razon.includes("Núcleo")) return "La guerra por el Núcleo del Sueño";
    if (top) return `La batalla de ${top.replace(/^Fragmento de /, "")}`;
    return "Una guerra sin nombre";
  }

  /* Relato completo. resumen: lo que devolvió FracturaCampana.cerrarGuerra */
  function narrar(est, ej, resumen, jIdx) {
    jIdx = jIdx || 0;
    const J = est.jugadores;
    const yo = J[jIdx].nombre, rival = J[1 - jIdx].nombre;
    const tipo = TIPOS_FRACTURA[est.tipo].nombre;
    const vistoNucleo = new Set();
    const eventos = est.cronica.filter(e => (e.tipo !== "suceso" || e.que === "criatura") && !(e.tipo === "nucleo" && (vistoNucleo.has(e.dueno) || !vistoNucleo.add(e.dueno))));
    const titulo = tituloDe(est, eventos);
    const parrafos = [];

    parrafos.push(`${yo} y ${rival} se enfrentaron en ${tipo}. La guerra duró ${est.turno} turnos.`);

    // Los sucesos más importantes, en orden cronológico
    const elegidos = eventos.map((e, i) => ({ e, i, p: importancia(e) })).filter(x => x.e.tipo !== "fin").sort((a, b) => b.p - a.p).slice(0, 9).sort((a, b) => a.i - b.i);
    const lineas = elegidos.map(x => ({ t: x.e.t, texto: frase(est, x.e, null, x.i) })).filter(x => x.texto);
    const grupos = [];
    for (let i = 0; i < lineas.length; i += 3) grupos.push(lineas.slice(i, i + 3));
    grupos.forEach(g => {
      const ini = g[0].t, fin = g[g.length - 1].t;
      const prefijo = ini === fin ? `Turno ${ini}. ` : `Entre los turnos ${ini} y ${fin}. `;
      parrafos.push(prefijo + g.map(x => x.texto).join(" "));
    });

    // Cierre según el resultado
    let cierre = "";
    if (resumen.gano) cierre = `${yo} ganó la guerra. ${est.razon}`;
    else if (resumen.perdio) cierre = `${yo} perdió la guerra. ${est.razon}`;
    else cierre = `La guerra terminó en tablas. ${est.razon}`;
    parrafos.push(cierre);

    // Lo que le pasó a la gente
    const gente = [];
    if (resumen.muertos.length) gente.push(`No volvieron ${resumen.muertos.map(s => nombreLargo(s)).join(", ")}.`);
    if (resumen.heridos && resumen.heridos.length) gente.push(`Quedaron gravemente heridos ${resumen.heridos.map(s => nombreLargo(s)).join(", ")}, que no volverán a combatir en las próximas dos guerras.`);
    if (resumen.renacidos && resumen.renacidos.length) gente.push(`${resumen.renacidos.map(s => nombreLargo(s)).join(", ")} regresaron de entre los muertos como Renacientes.`);
    resumen.ascensos.slice(0, 4).forEach(a => gente.push(`${nombreLargo(a.s)} asciende a ${a.rango}.`));
    resumen.luto.slice(0, 3).forEach(l => gente.push(`${nombreLargo(l.quien)} llora a ${nombreLargo(l.por)}, a quien conocía de varias guerras.`));
    if (resumen.reliquiasHalladas && resumen.reliquiasHalladas.length) gente.push(`El ejército se queda con ${resumen.reliquiasHalladas.map(r => r.nombre).join(", ")}.`);
    if (resumen.reliquiasPerdidas && resumen.reliquiasPerdidas.length) gente.push(`Se pierde ${resumen.reliquiasPerdidas.map(r => r.nombre).join(", ")}.`);
    if (resumen.nemesisNuevo && resumen.nemesisNuevo.length) gente.push(`${resumen.nemesisNuevo.map(n => `${n.nombre} ${n.casa}${n.apodo ? ` «${n.apodo}»` : ""}`).join(", ")} sobrevive y se acordará de este día.`);
    if (resumen.nemesisCaido && resumen.nemesisCaido.length) gente.push(`${resumen.nemesisCaido.map(n => `${n.nombre} ${n.casa}`).join(", ")} ya no volverá a cruzarse en vuestro camino.`);
    if (gente.length) parrafos.push(gente.join(" "));

    const familia = [];
    resumen.nacimientos.forEach(n => familia.push(`Nace ${n.hijo.sexo === "f" ? "una hija" : "un hijo"} en la casa ${n.hijo.casa}. Es ${n.hijo.nombre}, de ${nombreLargo(n.padre)}${n.pareja ? ` y ${nombreLargo(n.pareja)}` : ""}.`));
    resumen.alistados.filter(s => s.padre).forEach(s => familia.push(`${nombreLargo(s)} se alista. Es ${s.sexo === "f" ? "hija" : "hijo"} de ${S2(ej, s.padre)}.`));
    resumen.retirados.slice(0, 3).forEach(s => familia.push(`${nombreLargo(s)} se retira del servicio.`));
    resumen.vejez.slice(0, 3).forEach(s => familia.push(`${nombreLargo(s)} muere en paz.`));
    if (familia.length) parrafos.push(familia.join(" "));

    return { titulo, parrafos, lineas: est.log.filter(l => ["conquista", "muerte", "lider", "heroico", "reliquia", "nucleo", "sabotaje", "magia"].includes(l.tipo)).map(l => ({ t: l.t, texto: l.texto })).slice(-80) };
  }

  const nombreLargo = s => `${s.nombre} ${s.casa}${s.apodo ? ` «${s.apodo}»` : ""}`;
  const S2 = (ej, id) => (ej.soldados[id] ? nombreLargo(ej.soldados[id]) : "alguien de la casa");

  /* Historia del mundo: junta las guerras que guarda el servidor (cada una con los datos de registrar) */
  function historiaDelMundo(guerras) {
    const h = { guerras: guerras.length, jugadores: new Set(), facciones: new Set(), capitalesTomadas: 0, rendiciones: 0, nucleos: 0, bajas: 0, victoriasJugador: 0, porFaccion: {}, mayor: null };
    guerras.forEach(g => {
      h.jugadores.add(g.jugador);
      h.facciones.add(g.faccion); h.facciones.add(g.rival);
      if (g.razon && g.razon.includes("capital")) h.capitalesTomadas++;
      if (g.razon && g.razon.includes("Núcleo")) h.nucleos++;
      h.bajas += (g.bajas || []).reduce((a, b) => a + b, 0);
      if (g.resultado === "victoria") h.victoriasJugador++;
      const f = h.porFaccion[g.faccion] = h.porFaccion[g.faccion] || { guerras: 0, victorias: 0 };
      f.guerras++; if (g.resultado === "victoria") f.victorias++;
      if (!h.mayor || (g.turnos || 0) > h.mayor.turnos) h.mayor = g;
    });
    h.jugadores = h.jugadores.size; h.facciones = h.facciones.size;
    return h;
  }

  raiz.FracturaCronica = { narrar, historiaDelMundo, frase, importancia };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.FracturaCronica;
})(typeof window !== "undefined" ? window : globalThis);
