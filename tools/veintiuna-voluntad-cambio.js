// Última voluntad (cambiar tu última carta): estrategia óptima exacta y valor esperado por peaje. node tools/veintiuna-voluntad-cambio.js
// Última voluntad nueva: una vez por mano cambias tu ÚLTIMA carta por la siguiente de la baraja (peaje = fracción de la apuesta).
// Baraja infinita, solo pedir/plantarse/cambiar. Estado del jugador: (suma dura h, hay as, valor de la última carta, si es as, upIdx, voluntad disponible).
function modelo(toll, opciones = {}) {
  const permitirAlInicio = opciones.alInicio !== false;
  const fig = 10;
  const cartas = [];
  for (let r = 1; r <= 13; r++) cartas.push({ v: r === 1 ? 1 : (r >= 11 ? fig : r), as: r === 1, p: 1 / 13 });
  const total = (h, as) => (as && h + 10 <= 21 ? h + 10 : h);
  const memoD = new Map();
  function dealer(h, as) {
    const k = h + ',' + (as ? 1 : 0); if (memoD.has(k)) return memoD.get(k);
    const t = total(h, as); let out;
    if (t > 21) out = { bust: 1 }; else if (t >= 17) out = { [t]: 1 };
    else { out = {}; for (const c of cartas) { const d = dealer(h + c.v, as || c.as); for (const [key, pr] of Object.entries(d)) out[key] = (out[key] || 0) + pr * c.p; } }
    memoD.set(k, out); return out;
  }
  function holes(up) { const l = []; let tot = 0; for (const c of cartas) { const h = up.v + c.v, as = up.as || c.as, t = total(h, as); if (t >= 21) continue; l.push({ h, as, p: c.p }); tot += c.p; } return l.map(x => ({ ...x, p: x.p / tot })); }
  const cacheC = new Map();
  function distCrupier(ui) { if (cacheC.has(ui)) return cacheC.get(ui); const out = {}; for (const hl of holes(cartas[ui])) { const d = dealer(hl.h, hl.as); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheC.set(ui, out); return out; }
  const plantarse = (t, dist) => { let v = 0; for (const [k, pr] of Object.entries(dist)) { if (k === 'bust') v += pr; else { const d = +k; v += pr * (t > d ? 1 : t < d ? -1 : 0); } } return v; };
  const memo = new Map(), decision = new Map();
  // li: índice de la última carta (0..12), lh/las: la mano SIN la última carta
  function V(h, as, li, ui, vd) {
    const k = [h, as ? 1 : 0, li, ui, vd ? 1 : 0].join(','); if (memo.has(k)) return memo.get(k);
    const t = total(h, as);
    let mejor = plantarse(t, distCrupier(ui)), acc = 'plantar';
    if (t < 21) {
      let ev = 0;
      for (let ci = 0; ci < 13; ci++) { const c = cartas[ci], h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ci, ui, vd)); }
      if (ev > mejor) { mejor = ev; acc = 'pedir'; }
    }
    if (vd && li >= 0 && t < 21) {
      // la mano sin la última carta
      const hp = h - cartas[li].v; // suma dura sin esa carta
      // ¿tenía otro as sin contar la última?
      // (aproximación exacta: se guarda si había as antes en 'as' menos el de la última)
      const asSin = as && !(cartas[li].as) ? true : (as && cartas[li].as ? opciones._asAntes : false);
      let ev = -toll;
      let s = 0;
      for (let ci = 0; ci < 13; ci++) { const c = cartas[ci], h2 = hp + c.v, as2 = asSin || c.as, t2 = total(h2, as2); s += c.p * (t2 > 21 ? -1 : V(h2, as2, ci, ui, false)); }
      ev += s;
      if (ev > mejor) { mejor = ev; acc = 'cambiar'; }
    }
    memo.set(k, mejor); decision.set(k, acc); return mejor;
  }
  let ev = 0;
  for (let ui = 0; ui < 13; ui++) {
    const up = cartas[ui]; let pSigueC = 0; for (const c4 of cartas) { if (total(up.v + c4.v, up.as || c4.as) < 21) pSigueC += c4.p; }
    for (let a = 0; a < 13; a++) for (let b = 0; b < 13; b++) {
      const c1 = cartas[a], c2 = cartas[b]; const h = c1.v + c2.v, as = c1.as || c2.as, t = total(h, as); const p = c1.p * c2.p * up.p;
      for (const c4 of cartas) {
        const pp = p * c4.p; const tc = total(up.v + c4.v, up.as || c4.as);
        if (t > 21) { ev += -pp; continue; }
        if (t === 21 && tc === 21) continue;
        if (t === 21) { ev += 1.5 * pp; continue; }
        if (tc === 21) { ev += -pp; continue; }
        if (tc > 21) { ev += pp; continue; }
      }
      if (t >= 21) continue;
      // la mano sigue: probabilidad condicionada
      const opcionesAs = c1.as && c2.as;
      ev += p * pSigueC * V(h, as, permitirAlInicio ? b : -1, ui, true);
    }
  }
  return { ev, decision, V };
}
module.exports = { modelo };
if (require.main === module) {
  const f = x => (x * 100).toFixed(2) + '%';
  console.log('sin voluntad (peaje enorme)', f(modelo(9).ev));
  for (const t of [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6]) console.log('cambiar última carta, peaje', t, f(modelo(t).ev));
}
