const { cartas, total } = require('./veintiuna-reglas-nuevas.js');
const fs = require('fs'); let src = fs.readFileSync('./veintiuna-reglas-nuevas.js', 'utf8');
// reutilizamos helpers copiando el módulo: evaluamos el archivo y extraemos funciones internas
const m = {}; new Function('module', 'exports', 'require', src.replace('module.exports =', 'module.__x =').replace(/if \(require\.main === module\) \{[\s\S]*$/, '') + '\nmodule.__h = { crearDealer, vs, holes, evReparto, base };')(m, {}, require);
const { crearDealer, vs, holes, evReparto } = m.__h;
function trueque(toll) {
  const dist = crearDealer(17); const memoV = new Map(), memoT = new Map(), cacheM = new Map();
  const distC = ui => { const out = {}; for (const hl of holes(cartas[ui])) { const d = dist(hl.h, hl.as, null); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } return out; };
  const cacheD = new Map();
  function V(h, as, ui) { const k = h + ',' + as + ',' + ui; if (memoV.has(k)) return memoV.get(k); if (!cacheD.has(ui)) cacheD.set(ui, distC(ui)); const t = total(h, as); let best = vs(t, cacheD.get(ui)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : V(h2, as2, ui)); } best = Math.max(best, ev); } memoV.set(k, best); return best; }
  // tras el trueque: crupier muestra 'a' y su oculta sale de holes(u)
  function mix(a, u) { const key = a + ',' + u; if (cacheM.has(key)) return cacheM.get(key); const out = {}; for (const hl of holes(cartas[u])) { const d = dist(cartas[a].v + cartas[hl.i].v, cartas[a].as || cartas[hl.i].as, null); for (const [k, pr] of Object.entries(d)) out[k] = (out[k] || 0) + pr * hl.p; } cacheM.set(key, out); return out; }
  function VT(h, as, a, u) { const k = [h, as, a, u].join(','); if (memoT.has(k)) return memoT.get(k); const t = total(h, as); let best = vs(t, mix(a, u)); if (t < 21) { let ev = 0; for (const c of cartas) { const h2 = h + c.v, as2 = as || c.as, t2 = total(h2, as2); ev += c.p * (t2 > 21 ? -1 : VT(h2, as2, a, u)); } best = Math.max(best, ev); } memoT.set(k, best); return best; }
  return evReparto((h, as, ui, a, b) => {
    const sigue = V(h, as, ui);
    const c1 = cartas[ui], c2 = cartas[b], h2 = c1.v + c2.v, as2 = c1.as || c2.as, t2 = total(h2, as2);
    const evt = -toll + (t2 > 21 ? -1 : VT(h2, as2, a, ui));
    return Math.max(sigue, evt);
  });
}
module.exports = { trueque };
if (require.main === module) {
  const f = x => (x * 100).toFixed(2) + '%';
  for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.7]) console.log('trueque peaje ' + t, f(trueque(t)));
  const d = require('./veintiuna-reglas-nuevas.js'); for (const t of [0.12, 0.15, 0.18, 0.2, 0.25]) console.log('marcadas ' + t, f(d.marcadas(t)));
  for (const t of [0.3, 0.33, 0.36, 0.4, 0.45]) console.log('ojo ' + t, f(d.ojo(t)));
}
