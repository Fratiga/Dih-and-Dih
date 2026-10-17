// Equilibrio de Las Veintiuna Velas: estrategia óptima exacta (baraja infinita, solo pedir y plantarse) y valor esperado de cada regla para unos peajes dados.
// OJO: la Última voluntad de este archivo es la VERSIÓN ANTERIOR (el crupier roba una carta de más). La vigente está en tools/veintiuna-voluntad-cambio.js.
// Uso: node tools/veintiuna-equilibrio.js   (imprime el valor esperado del jugador por regla y peaje; unidades: apuesta = 1).
// Es lo que se usó para fijar los peajes de docs/veintiuna.sql; docs/pruebas/t_veintiuna_ev.sql comprueba que el servidor coincide con la simulación.
// Estrategia óptima exacta (baraja infinita) y valor esperado por regla, para fijar los peajes con seguridad.
// Unidades: apuesta = 1. Peajes como fracción de la apuesta. Sin doblar ni dividir. El crupier se planta con 17 blando.
function modelo(regla, tollF, tollV) {
  const fig = regla === 'maldicion' ? 11 : 10;
  // distribución de la siguiente carta: [valor "duro" (as=1), prob, esAs]
  const cartas = [];
  for (let r = 1; r <= 13; r++) cartas.push({ v: r === 1 ? 1 : (r >= 11 ? fig : r), as: r === 1, p: 1 / 13 });
  const total = (h, as) => (as && h + 10 <= 21 ? h + 10 : h);

  // ---- crupier: desde (h, as) roba hasta >= 17. Devuelve distribución {17..21, bust}
  const memoD = new Map();
  function dealer(h, as) {
    const k = h + ',' + (as ? 1 : 0);
    if (memoD.has(k)) return memoD.get(k);
    const t = total(h, as);
    let out;
    if (t > 21) out = { bust: 1 };
    else if (t >= 17) out = { [t]: 1 };
    else {
      out = {};
      for (const c of cartas) {
        const d = dealer(h + c.v, as || c.as);
        for (const [key, pr] of Object.entries(d)) out[key] = (out[key] || 0) + pr * c.p;
      }
    }
    memoD.set(k, out);
    return out;
  }
  // crupier con carta de más forzada antes de jugar
  function dealerForzado(h, as) {
    const out = {};
    for (const c of cartas) {
      const d = dealer(h + c.v, as || c.as);
      for (const [key, pr] of Object.entries(d)) out[key] = (out[key] || 0) + pr * c.p;
    }
    return out;
  }
  // La carta oculta, condicionada a que la mano siga (sin natural ni 22 del crupier)
  function holes(upCard) {
    const lista = [];
    let tot = 0;
    for (const c of cartas) {
      const h = upCard.v + c.v, as = upCard.as || c.as, t = total(h, as);
      if (t === 21 || t > 21) continue;
      lista.push({ h, as, p: c.p }); tot += c.p;
    }
    return lista.map(x => ({ ...x, p: x.p / tot }));
  }
  const dealerCache = new Map();
  function distCrupier(upIdx, forzado) {
    const k = upIdx + ',' + forzado;
    if (dealerCache.has(k)) return dealerCache.get(k);
    const up = cartas[upIdx];
    const out = {};
    for (const hl of holes(up)) {
      const d = forzado ? dealerForzado(hl.h, hl.as) : dealer(hl.h, hl.as);
      for (const [key, pr] of Object.entries(d)) out[key] = (out[key] || 0) + pr * hl.p;
    }
    dealerCache.set(k, out);
    return out;
  }
  const valorPlantarse = (t, dist) => {
    let v = 0;
    for (const [key, pr] of Object.entries(dist)) {
      if (key === 'bust') v += pr; else { const d = +key; v += pr * (t > d ? 1 : t < d ? -1 : 0); }
    }
    return v;
  };

  // ---- jugador: V(h, as, upIdx, fortunaDisp, voluntadDisp)
  const memoJ = new Map();
  const decision = new Map();
  function V(h, as, upIdx, fd, vd) {
    const k = [h, as ? 1 : 0, upIdx, fd ? 1 : 0, vd ? 1 : 0].join(',');
    if (memoJ.has(k)) return memoJ.get(k);
    const t = total(h, as);
    let mejor = valorPlantarse(t, distCrupier(upIdx, false)), acc = 'plantar';
    if (regla === 'voluntad' && vd) {
      const v = valorPlantarse(t, distCrupier(upIdx, true)) - tollV;
      if (v > mejor) { mejor = v; acc = 'voluntad'; }
    }
    if (t < 21) {
      let ev = 0;
      for (const c of cartas) {
        const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2);
        if (t2 > 21) {
          if (regla === 'fortuna' && fd) {
            // salvar la mano: la carta pasa a valer 1 (duro), se paga el peaje
            const salvada = V(h + 1, as, upIdx, false, vd) - tollF;
            ev += c.p * Math.max(-1, salvada);
          } else ev += c.p * -1;
        } else ev += c.p * V(h2, as2, upIdx, fd, vd);
      }
      if (ev > mejor) { mejor = ev; acc = 'pedir'; }
    }
    memoJ.set(k, mejor); decision.set(k, acc);
    return mejor;
  }

  // ---- reparto inicial
  let ev = 0, pNat = 0;
  for (let ui = 0; ui < cartas.length; ui++) {
    const up = cartas[ui];
    for (const c1 of cartas) for (const c2 of cartas) {
      const p = c1.p * c2.p * up.p;
      const h = c1.v + c2.v, as = c1.as || c2.as, t = total(h, as);
      // Para cada carta oculta posible del crupier
      for (const c4 of cartas) {
        const pp = p * c4.p;
        const hc = up.v + c4.v, asc = up.as || c4.as, tc = total(hc, asc);
        if (t > 21) { ev += pp * -1; continue; }
        if (t === 21 && tc === 21) { continue; }
        if (t === 21) { ev += pp * 1.5; pNat += pp; continue; }
        if (tc === 21) { ev += pp * -1; continue; }
        if (tc > 21) { ev += pp * 1; continue; }
        // la mano sigue: el crupier no tiene natural ni 22; la carta oculta ya está condicionada, así que se normaliza luego
        ev += 0; // (se calcula abajo con la condición)
      }
    }
  }
  // Parte «la mano sigue»: probabilidad de cada (mano inicial, carta del crupier) y valor óptimo
  let evSigue = 0, pSigue = 0;
  for (let ui = 0; ui < cartas.length; ui++) {
    const up = cartas[ui];
    const hs = holes(up);
    let pHoleSigue = 0; for (const x of hs) pHoleSigue += x.p; // =1 tras normalizar
    const pSigueCrup = cartas.reduce((a, c4) => { const tc = total(up.v + c4.v, up.as || c4.as); return a + (tc < 21 ? c4.p : 0); }, 0);
    for (const c1 of cartas) for (const c2 of cartas) {
      const h = c1.v + c2.v, as = c1.as || c2.as, t = total(h, as);
      if (t >= 21) continue;
      const p = c1.p * c2.p * up.p * pSigueCrup;
      evSigue += p * V(h, as, ui, regla === 'fortuna', regla === 'voluntad');
      pSigue += p;
    }
  }
  return { ev: ev + evSigue, pSigue, pNat, V, decision, cartas, total };
}
module.exports = { modelo };

if (require.main === module) {
  const f = x => (x * 100).toFixed(2) + '%';
  console.log('base (sin regla)      ', f(modelo('base', 0, 0).ev));
  console.log('maldición             ', f(modelo('maldicion', 0, 0).ev));
  for (const t of [0.4, 0.5, 0.55, 0.6, 0.7]) console.log('fortuna peaje ' + t + '    ', f(modelo('fortuna', t, 0).ev));
  for (const t of [0.3, 0.35, 0.4, 0.45, 0.5, 0.6]) console.log('voluntad peaje ' + t + '   ', f(modelo('voluntad', 0, t).ev));
}
