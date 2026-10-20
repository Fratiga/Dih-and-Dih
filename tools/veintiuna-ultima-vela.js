/* =============================================================================
   LA ÚLTIMA VELA (Muerte Súbita con Las Veintiuna Velas): simulación comparativa de reglas candidatas.
   Reparte con las reglas de la mesa (baraja de 52 nueva en cada mano, sin doblar ni dividir, la crupier se planta con 17 salvo que la regla diga otra cosa)
   y mide, para tres jugadores (novato, básico y «informado»: el que aprovecha lo que la regla le enseña), la probabilidad de ganar / empatar / perder
   UNA mano y la de superar el reto completo (ganar 3 de 5, 4 de 5 o 5 de 7 manos), con los empates repitiendo la mano hasta DOS veces (a la tercera repetición cuenta como pérdida).
   Las decisiones salen de una programación dinámica con baraja infinita (la baraja real es finita: el valor exacto de cada regla se afina simulando).
   Uso:  node tools/veintiuna-ultima-vela.js [manos por escenario, por defecto 400000]
   Con require() solo expone mano() y REGLAS (lo usa tools/veintiuna-ultima-vela-verificar.js para comprobar el servidor mano a mano).
============================================================================= */
const N = Number(process.argv[2]) || 400000;
const COMO_PRINCIPAL = require.main === module;
const rng = (s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)(20271018);
const PESO = Array.from({ length: 13 }, (_, i) => ({ v: i === 0 ? 1 : Math.min(i + 1, 10), p: 1 / 13 }));   // rango 1..13 → valor 1..10, baraja infinita
const val = cs => { let h = 0, a = false; for (const r of cs) { if (r === 1) { h += 1; a = true; } else h += r >= 10 ? 10 : r; } return a && h + 10 <= 21 ? { t: h + 10, blando: true } : { t: h, blando: false }; };

/* ---- distribución del total final de la crupier que empieza con (h, as) (baraja infinita) */
const memoD = new Map();
function distCrupier(h, as, limite) {
  const k = `${h}|${as}|${limite}`; if (memoD.has(k)) return memoD.get(k);
  const t = as && h + 10 <= 21 ? h + 10 : h;
  let d;
  if (t > 21) d = { 22: 1 };
  else if (t >= limite) d = { [t]: 1 };
  else { d = {}; for (const c of PESO) { const dd = distCrupier(h + c.v, as || c.v === 1, limite); for (const f in dd) d[f] = (d[f] || 0) + c.p * dd[f]; } }
  memoD.set(k, d); return d;
}
/* valor de plantarse con t contra una distribución de la crupier: P(gana) - P(pierde) */
const valPlantar = (t, d) => { let v = 0; for (const f in d) { const x = Number(f); v += d[f] * (x > 21 || t > x ? 1 : t < x ? -1 : 0); } return v; };
/* mejor valor de una mano del jugador (h, as) contra la distribución d, pidiendo o plantándose con baraja infinita */
const memoV = new Map();
function V(h, as, d, idD) {
  const k = `${h}|${as}|${idD}`; if (memoV.has(k)) return memoV.get(k);
  const t = as && h + 10 <= 21 ? h + 10 : h;
  let r;
  if (t > 21) r = { v: -1, pide: false };
  else {
    const plantar = valPlantar(t, d);
    let pedir = -Infinity;
    if (t < 21) { pedir = 0; for (const c of PESO) pedir += c.p * V(h + c.v, as || c.v === 1, d, idD).v; }
    r = pedir > plantar ? { v: pedir, pide: true } : { v: plantar, pide: false };
  }
  memoV.set(k, r); return r;
}
const idDist = new Map(); let sigId = 0;
const idDe = d => { const k = JSON.stringify(d); if (!idDist.has(k)) idDist.set(k, ++sigId); return idDist.get(k); };

/* ---- las reglas candidatas */
const REGLAS = {
  base:        { nombre: 'Sin regla (blackjack de la mesa)', limite: 17 },
  testigo:     { nombre: 'El testigo: Cera enseña las dos cartas desde el principio', limite: 17, info: 'crupier' },
  siguiente:   { nombre: 'La cera recuerda: sabes la siguiente carta que robarías (cada vez que decides)', limite: 17, info: 'siguiente' },
  vela16:      { nombre: 'Vela corta: Cera se planta con 16', limite: 16 },
  casa18:      { nombre: 'Cera exigente: Cera se planta con 18', limite: 18 },
  testigo18:   { nombre: 'Testigo + Cera exigente (se planta con 18)', limite: 18, info: 'crupier' }
};

/* ---- una mano contra la crupier. Devuelve +1, 0 o -1. mazoDado (opcional): los 52 rangos (1 a 13) en el orden en que se reparten; si no, se baraja */
function mano(regla, nivel, mazoDado) {
  const m = []; for (let i = 0; i < 52; i++) m.push((i % 13) + 1);
  if (mazoDado) { for (let i = 0; i < 52; i++) m[i] = mazoDado[i]; }
  else for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [m[i], m[j]] = [m[j], m[i]]; }
  let p = 4; const J = [m[0], m[2]], D = [m[1], m[3]];
  const vj = val(J), vd = val(D);
  if (vj.t === 21 && vd.t === 21) return 0; if (vj.t === 21) return 1; if (vd.t === 21) return -1;       // los naturales se resuelven al repartir
  const L = REGLAS[regla].limite, info = REGLAS[regla].info;
  const up = D[0] === 1 ? 11 : Math.min(D[0], 10);
  // distribución que el jugador cree para la crupier
  const hDeUp = D[0] === 1 ? 1 : Math.min(D[0], 10), asUp = D[0] === 1;
  const dDesc = (() => {            // la crupier con la carta visible, sin saber la oculta (y sin natural: ya se comprobó que no lo tiene)
    const d = {}; let tot = 0;
    for (const c of PESO) { const dd = distCrupier(hDeUp + c.v, asUp || c.v === 1, L); const nat = (hDeUp === 1 && c.v === 10) || (hDeUp === 10 && c.v === 1); if (nat) continue; tot += c.p; for (const f in dd) d[f] = (d[f] || 0) + c.p * dd[f]; }
    for (const f in d) d[f] /= tot; return d;
  })();
  const dExacta = (() => { const h = D.map(r => (r >= 10 ? 10 : r)).reduce((a, b) => a + b, 0); return distCrupier(h, D.includes(1), L); })();
  const dUsada = info === 'crupier' && nivel === 'informado' ? dExacta : dDesc;
  const idD = idDe(dUsada);
  let J2 = J.slice();
  for (;;) {
    const v = val(J2); if (v.t >= 21) break;
    let h = J2.reduce((a, r) => a + (r >= 10 ? 10 : r), 0), as = J2.includes(1);
    let pide;
    if (nivel === 'novato') pide = v.t < 17;
    else if (nivel === 'basico') pide = !(v.blando ? v.t >= (up >= 9 ? 19 : 18) : v.t >= (up >= 7 ? 17 : 12));
    else {
      pide = V(h, as, dUsada, idD).pide;
      if (info === 'siguiente') {
        const c = m[p]; const cv = c >= 10 ? 10 : c;
        const tras = val(J2.concat([c]));
        const plantar = valPlantar(v.t, dUsada);
        const pedirConocido = tras.t > 21 ? -1 : V(h + cv, as || c === 1, dUsada, idD).v;
        pide = pedirConocido > plantar;
      }
    }
    if (!pide) break;
    J2.push(m[p++]); if (val(J2).t > 21) return -1;
  }
  const tj = val(J2).t;
  while (val(D).t < L) D.push(m[p++]);
  const td = val(D).t;
  if (td > 21) return 1;
  return tj > td ? 1 : tj < td ? -1 : 0;
}

/* ---- del resultado de una mano al del reto: ganar k de n manos; los empates repiten la mano hasta 2 veces (la 3.ª repetición cuenta como pérdida) */
const C = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
function reto(w, t, l, k, n) {
  let pw = 0, pl = 0, pt = 1;
  for (let i = 0; i <= 2; i++) { pw += pt * w; pl += pt * l; pt *= t; }
  pl += pt;
  let exito = 0;
  for (let g = k; g <= n; g++) exito += C(n, g) * pw ** g * pl ** (n - g);
  return exito;
}
const FORMATOS = [[3, 5], [4, 5], [5, 7]];

module.exports = { mano, REGLAS };
if (COMO_PRINCIPAL) {
  console.log(`Simulación con ${N.toLocaleString('es')} manos por escenario y jugador. Reto: ganar 3 de 5 manos (los empates repiten la mano hasta 2 veces).\n`);
  const filas = [];
  for (const r of Object.keys(REGLAS)) {
    const fila = { regla: REGLAS[r].nombre };
    for (const nivel of ['novato', 'basico', 'informado']) {
      if (nivel === 'informado' && !REGLAS[r].info) { fila[nivel] = null; continue; }
      let w = 0, t = 0, l = 0;
      for (let i = 0; i < N; i++) { const x = mano(r, nivel); if (x > 0) w++; else if (x < 0) l++; else t++; }
      fila[nivel] = { w: w / N, t: t / N, l: l / N, retos: FORMATOS.map(([a, b]) => reto(w / N, t / N, l / N, a, b)) };
    }
    filas.push(fila);
  }
  const pc = x => (x * 100).toFixed(1).padStart(5) + ' %';
  console.log('                                una mano: gana / empata / pierde        reto: 3 de 5 · 4 de 5 · 5 de 7');
  for (const f of filas) {
    console.log(f.regla);
    for (const nivel of ['novato', 'basico', 'informado']) {
      const x = f[nivel]; if (!x) continue;
      console.log('   ' + nivel.padEnd(10), pc(x.w), pc(x.t), pc(x.l), '       ', x.retos.map(pc).join(' · '));
    }
  }
}
