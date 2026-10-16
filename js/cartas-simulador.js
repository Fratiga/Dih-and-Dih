/* =============================================================================
   SIMULADOR DE TRIUNFOS PARA EL PANEL DE ADMIN
   Juega cientos de partidas entre mazos al azar con un bot sencillo y mide cuánto gana una carta. Es la misma lógica que
   tools/simular-balance.js (que sigue siendo la herramienta de línea de comandos para el catálogo entero), pensada para
   «prueba esta carta» desde el navegador.
   El bot no es listo: juega lo más caro que puede, ataca cuando no pierde la unidad y bloquea si le conviene. Vale para
   comparar una carta con lo normal, no para saber cómo la jugaría una persona.
   Necesita CartasMotor (cartas-motor.js + cartas-efectos.js + cartas-vinculos.js) y CartasCliente.instantanea.
============================================================================= */
window.CartasSimulador = (function () {
  const M = () => window.CartasMotor;

  function azar(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* Un mazo legal al azar. semilla: ids que van seguro (con sus copias máximas). Composición: unos 15 de cada 24 son unidades. */
  function mazoAlAzar(r, cartas, lado, tam, semilla) {
    const pool = Object.values(cartas).filter(c => c.obtenible !== false && c.id !== "el-bufon" && (!c.lado || c.lado.includes(lado)));
    const cuenta = {}, mazo = [];
    const esU = c => c.atq !== null && c.atq !== undefined;
    const mete = c => { const tope = M().topeCopias(c); if ((cuenta[c.id] || 0) >= tope) return false; cuenta[c.id] = (cuenta[c.id] || 0) + 1; mazo.push(c.id); return true; };
    (semilla || []).forEach(id => { const c = cartas[id]; if (!c) return; for (let i = 0; i < M().topeCopias(c); i++) mete(c); });
    const unidades = Math.round(tam * 15 / 24);
    const us = pool.filter(esU), otras = pool.filter(c => !esU(c));
    let g = 0;
    while (mazo.filter(id => esU(cartas[id])).length < unidades && g++ < 2000 && us.length) mete(us[Math.floor(r() * us.length)]);
    while (mazo.length < tam && g++ < 4000 && otras.length) mete(otras[Math.floor(r() * otras.length)]);
    while (mazo.length < tam && g++ < 6000) mete(pool[Math.floor(r() * pool.length)]);
    return mazo.slice(0, tam);
  }

  const valor = (est, u) => M().atqEfectivo(est, u) + u.pv;

  function bloqueos(est, J) {
    const c = est.combate, pares = [], usados = new Set(Object.values(c.forzados || {}));
    const entrante = c.atacantes.reduce((s, uid) => { const h = M().buscar(est, uid); return s + (h ? M().atqEfectivo(est, h.u) : 0); }, 0);
    const peligro = entrante >= J.vida - 2;
    const orden = c.atacantes.filter(uid => !(uid in (c.forzados || {}))).map(uid => M().buscar(est, uid)).filter(Boolean).sort((a, b) => M().atqEfectivo(est, b.u) - M().atqEfectivo(est, a.u));
    orden.forEach(h => {
      const posibles = M().bloqueadoresLibres(est, h.u.uid).filter(b => !usados.has(b)).map(uid => M().buscar(est, uid).u);
      if (!posibles.length) return;
      const dano = M().atqEfectivo(est, h.u);
      const buenos = posibles.filter(b => M().atqEfectivo(est, b) >= h.u.pv && b.pv > dano);
      const cambios = posibles.filter(b => M().atqEfectivo(est, b) >= h.u.pv && valor(est, b) <= valor(est, h.u) + 1);
      let b = buenos.sort((x, y) => valor(est, x) - valor(est, y))[0] || cambios.sort((x, y) => valor(est, x) - valor(est, y))[0];
      if (!b && peligro) b = posibles.sort((x, y) => valor(est, x) - valor(est, y))[0];
      if (b) { pares.push([h.u.uid, b.uid]); usados.add(b.uid); }
    });
    return { t: "bloquear", b: pares };
  }

  function eligir(est, r) {
    const m = M();
    const quien = m.quienActua(est), legales = m.accionesLegales(est);
    const J = est.jugadores[quien], R = est.jugadores[1 - quien];
    if (est.pendiente) {
      if (est.pendiente.tipo === "bloqueo") return { a: bloqueos(est, J), quien };
      const rea = legales.filter(x => x.t === "reaccionar");
      if (rea.length && r() < 0.8) return { a: rea[Math.floor(r() * rea.length)], quien };
      return { a: { t: "pasar" }, quien };
    }
    const jugadas = legales.filter(x => x.t === "jugar");
    if (jugadas.length) {
      const coste = x => m.costeDe(est, quien, J.mano[x.i]);
      const mejor = Math.max(...jugadas.map(coste));
      const conMejor = jugadas.filter(x => coste(x) === mejor);
      let escogida = conMejor[0];
      const porCarta = {}; conMejor.forEach(x => { (porCarta[x.i] = porCarta[x.i] || []).push(x); });
      const grupo = porCarta[conMejor[0].i];
      if (grupo.length > 1) {
        const peso = x => { if (!x.o || x.o.u === undefined) return 0; const h = m.buscar(est, x.o.u); if (!h) return 0; return h.j === quien ? (h.u.pvMax - h.u.pv) : valor(est, h.u); };
        escogida = grupo.reduce((a, b) => (peso(b) > peso(a) ? b : a));
      }
      if (mejor > 0 || r() < 0.9) return { a: escogida, quien };
    }
    if (est.atacado !== est.turno) {
      const listas = J.campo.filter(u => m.unidadPuedeAtacar(est, u));
      const totalAtq = listas.reduce((s, u) => s + m.atqEfectivo(est, u), 0);
      const apuro = R.vida <= totalAtq * 1.5;
      const elegidas = listas.filter(u => {
        const blk = R.campo.filter(b => m.puedeBloquear(est, b, u));
        const peligro = blk.some(b => m.atqEfectivo(est, b) >= u.pv);
        return apuro || !peligro || blk.length === 0 || valor(est, u) <= 3;
      });
      const defensores = J.campo.length - elegidas.length;
      const ataca = J.vida < 8 && defensores === 0 ? elegidas.slice(1) : elegidas;
      if (ataca.length) {
        const d = {}, usados = new Set();
        ataca.forEach(u => {
          const opts = m.objetivosDeDesafio(est, u).filter(uid => !usados.has(uid));
          if (opts.length && r() < 0.5) {
            const objetivo = opts.map(uid => m.buscar(est, uid).u).sort((a, b) => valor(est, b) - valor(est, a))[0];
            d[u.uid] = objetivo.uid; usados.add(objetivo.uid);
          }
        });
        const acc = { t: "atacar", u: ataca.map(u => u.uid) };
        if (Object.keys(d).length) acc.d = d;
        return { a: acc, quien };
      }
    }
    return { a: { t: "fin" }, quien };
  }

  function jugar(cartas, mazoA, mazoB, semilla, primero, r) {
    const m = M();
    const est = m.crearPartida({ semilla, primero, cartas, jugadores: [{ id: "a", nombre: "A", mazo: mazoA }, { id: "b", nombre: "B", mazo: mazoB }] });
    let pasos = 0, errores = 0;
    while (est.ganador === null && pasos++ < 4000) {
      const { a, quien } = eligir(est, r);
      let res = m.aplicar(est, a, quien);
      if (res.error) {
        errores++;
        const legales = m.accionesLegales(est);
        const alt = legales.find(x => x.t === "fin" || x.t === "pasar") || legales[0];
        res = m.aplicar(est, alt, quien);
        if (res.error || errores > 40) break;
      }
    }
    return est;
  }

  /* Mide una carta: partidas con un mazo que la lleva (con sus copias máximas) contra mazos al azar, y, como referencia, mazos al
     azar contra mazos al azar con el mismo reparto. alProgreso(hechas, total) se llama de vez en cuando; cancelado() corta. */
  async function probarCarta({ cartas, cartaId, partidas = 300, tam = 24, semilla = 1, alProgreso, cancelado }) {
    const r = azar(semilla * 7919);
    const carta = cartas[cartaId];
    const lados = carta.lado && carta.lado.length === 1 ? [carta.lado[0]] : ["A", "B"];
    const res = { con: { j: 0, w: 0, e: 0 }, base: { j: 0, w: 0, e: 0 }, turnos: 0, sinFin: 0 };
    const total = partidas * 2;
    let hechas = 0;
    for (let g = 0; g < partidas; g++) {
      for (const tipo of ["con", "base"]) {
        const ladoA = lados[Math.floor(r() * lados.length)], ladoB = r() < 0.5 ? "A" : "B";
        const mazoA = mazoAlAzar(r, cartas, ladoA, tam, tipo === "con" ? [cartaId] : []);
        const mazoB = mazoAlAzar(r, cartas, ladoB, tam, []);
        const primero = g % 2;
        const est = jugar(cartas, mazoA, mazoB, semilla * 100000 + g * 2 + (tipo === "con" ? 0 : 1), primero, r);
        const x = res[tipo];
        if (est.ganador === null) res.sinFin++;
        else if (est.ganador === "empate") x.e++;
        else { x.j++; if (est.ganador === 0) x.w++; res.turnos += est.turno; }
        hechas++;
      }
      if (g % 10 === 9) {
        if (alProgreso) alProgreso(hechas, total);
        if (cancelado && cancelado()) break;
        await new Promise(ok => setTimeout(ok, 0));
      }
    }
    return res;
  }

  return { probarCarta, mazoAlAzar, azar, jugar };
})();
