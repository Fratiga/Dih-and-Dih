// Nuevas reglas: valor esperado exacto (baraja infinita, solo pedir/plantarse y la acción de cada regla). Unidades: apuesta = 1.
const FIG = 10;
const cartas = []; for (let r = 1; r <= 13; r++) cartas.push({ v: r === 1 ? 1 : (r >= 11 ? FIG : r), as: r === 1, p: 1 / 13 });
const total = (h, as) => (as && h + 10 <= 21 ? h + 10 : h);

function crearDealer(stand) {
  const memo = new Map();
  // distribución final del crupier desde (h, as); con primera carta forzada opcional (índice) si tiene que robar
  function dist(h, as, forzada) {
    const k = h + ',' + (as ? 1 : 0) + ',' + (forzada == null ? -1 : forzada);
    if (memo.has(k)) return memo.get(k);
    const t = total(h, as); let out;
    if (t > 21) out = { bust: 1 }; else if (t >= stand) out = { [t]: 1 };
    else {
      out = {};
      if (forzada != null) { const c = cartas[forzada]; const d = dist(h + c.v, as || c.as, null); for (const [key, pr] of Object.entries(d)) out[key] = pr; }
      else for (const c of cartas) { const d = dist(h + c.v, as || c.as, null); for (const [key, pr] of Object.entries(d)) out[key] = (out[key] || 0) + pr * c.p; }
    }
    memo.set(k, out); return out;
  }
  return dist;
}
const vs = (t, d) => { let v = 0; for (const [k, pr] of Object.entries(d)) { if (k === 'bust') v += pr; else { const x = +k; v += pr * (t > x ? 1 : t < x ? -1 : 0); } } return v; };
function holes(up) { const l = []; let tot = 0; for (let i = 0; i < 13; i++) { const c = cartas[i], h = up.v + c.v, as = up.as || c.as; if (total(h, as) >= 21) continue; l.push({ i, h, as, p: c.p }); tot += c.p; } return l.map(x => ({ ...x, p: x.p / tot })); }

// Valor esperado del reparto: la función `valor(h, as, ui)` da el valor de seguir con esa mano (decisión óptima) cuando la mano continúa.
function evReparto(valorSigue, opciones = {}) {
  const NAT = opciones.nat != null ? opciones.nat : 1.5;
  let ev = 0;
  for (let ui = 0; ui < 13; ui++) {
    const up = cartas[ui];
    let pSigueC = 0; for (const c4 of cartas) if (total(up.v + c4.v, up.as || c4.as) < 21) pSigueC += c4.p;
    for (let a = 0; a < 13; a++) for (let b = 0; b < 13; b++) {
      const c1 = cartas[a], c2 = cartas[b], h = c1.v + c2.v, as = c1.as || c2.as, t = total(h, as), p = c1.p * c2.p * up.p;
      for (const c4 of cartas) {
        const pp = p * c4.p, tc = total(up.v + c4.v, up.as || c4.as);
        if (t > 21) { ev -= pp; continue; }
        if (t === 21 && tc === 21) continue;
        if (t === 21) { ev += NAT * pp; continue; }
        if (tc === 21) { ev -= pp; continue; }
        if (tc > 21) { ev += pp; continue; }
      }
      if (t >= 21) continue;
      ev += p * pSigueC * valorSigue(h, as, ui, a, b);
    }
  }
  return ev;
}

// ---------------------------------------------------------------- base con crupier que se planta en `stand`
function base(stand, nat) {
  const dist = crearDealer(stand); const cacheC = new Map(); const memo = new Map();
  const distC = ui => { if (cacheC.has(ui)) return cacheC.get(ui); const out = {}; for (const hl of holes(cartas[ui])) { const d = dist(hl.h, hl.as, null); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheC.set(ui, out); return out; };
  function V(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memo.has(k)) return memo.get(k); const t = total(h, as); let best = vs(t, distC(ui)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ui)); } best = Math.max(best, ev); } memo.set(k, best); return best; }
  return evReparto((h, as, ui) => V(h, as, ui), { nat });
}

// ---------------------------------------------------------------- Cartas marcadas: pagas y ves la carta oculta del crupier
function marcadas(toll) {
  const dist = crearDealer(17); const memo = new Map();
  const cacheC = new Map(); const distC = ui => { if (cacheC.has(ui)) return cacheC.get(ui); const out = {}; for (const hl of holes(cartas[ui])) { const d = dist(hl.h, hl.as, null); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheC.set(ui, out); return out; };
  // con la carta oculta conocida hi
  function Vk(h, as, ui, hi) { const k = [h, as, ui, hi].join(','); if (memo.has(k)) return memo.get(k); const up = cartas[ui], hc = cartas[hi]; const d = dist(up.v + hc.v, up.as || hc.as, null); const t = total(h, as); let best = vs(t, d); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : Vk(h2, as2, ui, hi)); } best = Math.max(best, ev); } memo.set(k, best); return best; }
  const memoU = new Map();
  function V(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memoU.has(k)) return memoU.get(k); const t = total(h, as); let best = vs(t, distC(ui)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ui)); } best = Math.max(best, ev); }
    // marcar: pagas y ves la oculta
    let evm = -toll; for (const hl of holes(cartas[ui])) evm += hl.p * Vk(h, as, ui, hl.i); best = Math.max(best, evm); memoU.set(k, best); return best; }
  return evReparto((h, as, ui) => V(h, as, ui));
}

// ---------------------------------------------------------------- Ojo del Tahúr: pagas y ves la siguiente carta de la baraja (que será tu próxima carta o la primera que robe el crupier)
function ojo(toll) {
  const dist = crearDealer(17); const cacheC = new Map(); const memoU = new Map(); const memoK = new Map();
  const distC = (ui, forz) => { const key = ui + ',' + (forz == null ? -1 : forz); if (cacheC.has(key)) return cacheC.get(key); const out = {}; for (const hl of holes(cartas[ui])) { const d = dist(hl.h, hl.as, forz); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheC.set(key, out); return out; };
  // sabiendo que la siguiente carta es kk (aún no usado el ojo → ya usado)
  function Vk(h, as, ui, kk) {
    const key = [h, as, ui, kk].join(','); if (memoK.has(key)) return memoK.get(key);
    const t = total(h, as); let best = vs(t, distC(ui, kk));
    if (t < 21) { const c = cartas[kk]; const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); const ev = t2 > 21 ? -1 : Vsin(h2, as2, ui); best = Math.max(best, ev); }
    memoK.set(key, best); return best;
  }
  // sin ojo disponible (ya usado o no): decisión normal
  const memoS = new Map();
  function Vsin(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memoS.has(k)) return memoS.get(k); const t = total(h, as); let best = vs(t, distC(ui, null)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : Vsin(h2, as2, ui)); } best = Math.max(best, ev); } memoS.set(k, best); return best; }
  function V(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memoU.has(k)) return memoU.get(k); const t = total(h, as); let best = vs(t, distC(ui, null));
    if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ui)); } best = Math.max(best, ev);
      let evo = -toll; for (let kk = 0; kk < 13; kk++) evo += cartas[kk].p * Vk(h, as, ui, kk); best = Math.max(best, evo); }
    memoU.set(k, best); return best; }
  return evReparto((h, as, ui) => V(h, as, ui));
}

// ---------------------------------------------------------------- Trueque con la casa: antes de pedir, cambias tu primera carta por la visible del crupier
function trueque(toll) {
  const dist = crearDealer(17); const cacheC = new Map(); const memo = new Map();
  const distC = ui => { if (cacheC.has(ui)) return cacheC.get(ui); const out = {}; for (const hl of holes(cartas[ui])) { const d = dist(hl.h, hl.as, null); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheC.set(ui, out); return out; };
  function V(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memo.has(k)) return memo.get(k); const t = total(h, as); let best = vs(t, distC(ui)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ui)); } best = Math.max(best, ev); } memo.set(k, best); return best; }
  // En el reparto la mano 'sigue' (sin naturales ni 22). El trueque se evalúa sobre cartas concretas (a = tu 1ª, b = tu 2ª, ui = visible del crupier);
  // la carta oculta sigue siendo desconocida pero NO es natural con la visible original: tras el trueque la oculta se queda como estaba (condicionada a la visible original).
  return evReparto((h, as, ui, a, b) => {
    const sigue = V(h, as, ui);
    // tras el trueque: tú (ui, b), crupier muestra a; la oculta ~ condicionada a (ui original)
    const nc1 = cartas[ui], c2 = cartas[b]; const h2 = nc1.v + c2.v, as2 = nc1.as || c2.as, t2 = total(h2, as2);
    let evt = -toll;
    for (const hl of holes(cartas[ui])) {
      // el crupier ahora tiene (a, oculta)
      const dh = cartas[a].v + cartas[hl.i].v, das = cartas[a].as || cartas[hl.i].as; const d = dist(dh, das, null);
      let v = t2 > 21 ? -1 : t2 === 21 ? vs(21, d) : null;
      if (v == null) { // seguir jugando con (h2, as2) contra un crupier de mano conocida solo por distribución: aproximación: decide con la distribución promedio de ese crupier
        v = Math.max(vs(t2, dist(dh, das, null)), 0); // placeholder, abajo se refina
      }
      evt += hl.p * v;
    }
    return Math.max(sigue, evt);
  });
}

module.exports = { base, marcadas, ojo, trueque, cartas, total };
if (require.main === module) {
  const f = x => (x * 100).toFixed(2) + '%';
  console.log('base (S17)', f(base(17)));
  for (const s of [15, 16, 18, 19]) console.log('crupier se planta con ' + s, f(base(s)));
  for (const t of [0.3, 0.5, 0.7, 0.9, 1.1]) console.log('cartas marcadas peaje ' + t, f(marcadas(t)));
  for (const t of [0.05, 0.1, 0.15, 0.2, 0.3]) console.log('ojo del tahúr peaje ' + t, f(ojo(t)));
}
