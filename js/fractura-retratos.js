/* =============================================================================
   LA FRACTURA: retratos de los soldados. Un busto distinto para cada uno, dibujado en un canvas con
   formas planas: la cara, el pelo, la barba, las cicatrices y la edad salen del id del soldado (siempre el
   mismo rostro), y el yelmo, la capucha o la corona salen de su clase y su facción. Los retratos con
   animación parpadean, respiran y los ojos siguen el cursor. Sin degradados ni resplandores.
   Uso: FracturaRetratos.dibujar(canvas, soldado, { faccion, anio, herido, w, anim })
============================================================================= */
window.FracturaRetratos = (function () {
  "use strict";
  const D = window.FRACTURA_DATOS;
  const FACCIONES = D.FACCIONES, RANGOS = D.RANGOS;
  const REDUCIDO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CX = 50, CY = 54;
  const ACERO = "#b9c0c8", ACERO2 = "#8f969e", MADERA = "#7a5632", HUESO = "#e9e2cf", ORO = "#f0cf6a";

  /* --- Colores --- */
  const num = c => {
    if (c[0] === "#") { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    const m = c.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
  };
  const mez = (a, b, t) => { const x = num(a), y = num(b); return "rgb(" + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",") + ")"; };
  const osc = (c, t) => mez(c, "#000000", t), cla = (c, t) => mez(c, "#ffffff", t);

  /* --- Semilla --- */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const PIELES = ["#f3d8bd", "#e8c39d", "#d8a87d", "#c08a62", "#9c6a49", "#765038", "#573828"];
  const PELOS = ["#1d1713", "#3a2a1e", "#5a3b24", "#7a5230", "#a8793a", "#d2b46a", "#2b2f3a", "#8f3a22"];
  const IRIS = ["#3b5f8a", "#4f7a45", "#7a5230", "#2a2a30", "#6a8f9a", "#8a6a30"];
  const ESTILO_M = [0, 1, 1, 2, 2, 4, 6, 7], ESTILO_F = [1, 2, 3, 3, 4, 5, 6, 3];
  const OJOS = [[3.3, 2.3], [3.7, 1.7], [3.4, 2.8]];

  /* --- Primitivas --- */
  function P(c, col, pts) { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); c.fill(); }
  function E(c, col, x, y, rx, ry, rot) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 7); c.fill(); }
  function L(c, col, w, x1, y1, x2, y2) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

  /* =========================================================================
     RASGOS: salen del id. Se guardan para no recalcularlos en cada fotograma.
  ========================================================================= */
  const cacheRasgos = new Map();
  function rasgos(s, anio) {
    const clave = [s.id, anio, s.clase, s.cicatrices || 0, s.origen, s.reanimado ? 1 : 0, s.estado === "nino" ? 1 : 0, s.sexo].join("|");
    if (cacheRasgos.has(clave)) return cacheRasgos.get(clave);
    const r = rng(hashStr(String(s.id)));
    const f = s.sexo === "f";
    const edad = Math.max(0, anio - (s.nacimiento === undefined ? anio - 22 : s.nacimiento));
    const nino = s.estado === "nino" || edad < 15;
    const R = { f, edad, nino };
    R.piel = PIELES[Math.floor(r() * PIELES.length)];
    const peloBase = PELOS[Math.floor(r() * PELOS.length)];
    const indiceEstilo = Math.floor(r() * 8);
    R.estilo = (f ? ESTILO_F : ESTILO_M)[indiceEstilo];
    R.rx = 15.5 + r() * 3.5 - (f ? 0.9 : 0) - (nino ? 1.6 : 0);
    R.ry = 19.8 + r() * 2.8 - (nino ? 1.8 : 0);
    const mand = r();
    R.cj = 4 + (f ? mand * 3.5 : 2 + mand * 5.5);
    R.ojo = Math.floor(r() * 3);
    R.iris = IRIS[Math.floor(r() * IRIS.length)];
    R.ceja = Math.floor(r() * 4);
    R.cejaG = 1.1 + r() * 1.3;
    R.nariz = 5 + r() * 3;
    R.narizAncho = 1.6 + r() * 1.7;
    R.boca = Math.floor(r() * 3);
    const bR = r();
    R.barba = f || nino ? 0 : bR < 0.36 ? 0 : bR < 0.52 ? 1 : bR < 0.74 ? 2 : bR < 0.9 ? 3 : 4;
    R.pecas = r() < 0.24;
    const parcheR = r();
    R.cicTipos = [Math.floor(r() * 4), Math.floor(r() * 4), Math.floor(r() * 4)];
    R.sepOjos = r();
    R.ladoParche = r() < 0.5 ? -1 : 1;
    const nCic = Math.min(3, s.cicatrices || 0);
    R.nCic = nCic;
    R.parche = !nino && (nCic >= 3 ? parcheR < 0.65 : nCic >= 2 ? parcheR < 0.3 : s.clase === "mercenario" ? parcheR < 0.34 : false);
    // edad: pelo gris y arrugas
    const gris = Math.max(0, Math.min(1, (edad - 42) / 24));
    R.pelo = gris > 0 ? mez(peloBase, "#c4c4cb", gris) : peloBase;
    R.arrugas = edad >= 38 ? (edad >= 52 ? 2 : 1) : 0;
    // orígenes y estados
    R.piel0 = R.piel;
    if (s.origen === "criatura") { R.piel = mez(R.piel, "#8fae92", 0.42); R.puntiagudas = true; R.iris = "#d6b13a"; R.rendija = true; }
    if (s.origen === "eco") { R.piel = mez(R.piel, "#cfe6ee", 0.32); R.iris = "#7fd6dc"; }
    if (s.reanimado) { R.piel = mez(R.piel, "#a3b3a0", 0.5); R.sutura = true; R.iris = "#cfe0cf"; }
    if (s.clase === "archimago" && !f) { R.barba = 3; if (R.pelo === peloBase) R.pelo = mez(peloBase, "#d8d8e0", 0.6); }
    if (s.clase === "mercenario" && R.barba === 0 && !f) R.barba = 1;
    if (s.clase === "eco") R.piel = "#cfe3ea";
    R.pelaje = ["#5a4a52", "#6b5640", "#4c5560", "#7a4b3a"][hashStr(String(s.id)) % 4];
    R.ex = R.rx * 0.46 + (R.sepOjos - 0.5) * 1.3;
    cacheRasgos.set(clave, R);
    if (cacheRasgos.size > 800) cacheRasgos.delete(cacheRasgos.keys().next().value);
    return R;
  }

  /* =========================================================================
     CARA
  ========================================================================= */
  function trazoCara(c, R) {
    const { rx, ry, cj } = R;
    c.beginPath();
    c.moveTo(CX - rx, CY - 3);
    c.bezierCurveTo(CX - rx, CY - ry - 5, CX + rx, CY - ry - 5, CX + rx, CY - 3);
    c.bezierCurveTo(CX + rx, CY + ry * 0.55, CX + cj + 5, CY + ry, CX + cj, CY + ry);
    c.lineTo(CX - cj, CY + ry);
    c.bezierCurveTo(CX - cj - 5, CY + ry, CX - rx, CY + ry * 0.55, CX - rx, CY - 3);
    c.closePath();
  }

  function cuello(K) {
    const { c, R } = K;
    E(c, osc(K.piel, 0.22), CX, CY + R.ry + 3, R.cj + 3, 3.6);
    P(c, osc(K.piel, 0.14), [[CX - 6.5, CY + R.ry - 8], [CX + 6.5, CY + R.ry - 8], [CX + 8.5, 100], [CX - 8.5, 100]]);
  }

  function orejas(K) {
    const { c, R } = K;
    [-1, 1].forEach(l => {
      if (R.puntiagudas) P(c, K.piel, [[CX + l * (R.rx - 1), CY - 2], [CX + l * (R.rx + 10), CY - 10], [CX + l * (R.rx + 1), CY + 9]]);
      else { E(c, K.piel, CX + l * (R.rx + 0.4), CY + 3, 2.7, 4.3); E(c, osc(K.piel, 0.16), CX + l * (R.rx + 0.6), CY + 3.4, 1.2, 2.5); }
    });
  }

  function cara(K) {
    const { c, R } = K;
    trazoCara(c, R); c.fillStyle = K.piel; c.fill();
    c.save(); trazoCara(c, R); c.clip();
    c.fillStyle = osc(K.piel, 0.1); c.fillRect(CX + R.rx * 0.38, 0, 40, 130);          // sombra plana a la derecha
    c.fillStyle = osc(K.piel, 0.07); c.fillRect(0, CY + R.ry - 5, 100, 12);            // bajo la mandíbula
    c.restore();
  }

  function ojos(K) {
    const { c, R } = K;
    const dim = OJOS[R.ojo], k = R.nino ? 1.2 : 1;
    [-1, 1].forEach(l => {
      if (K.parche === l) return;
      const ex = CX + l * R.ex, ey = CY + 1, orx = dim[0] * k, ory = dim[1] * k, ab = Math.max(0.06, 1 - K.parp);
      // cuenca suave
      E(c, osc(K.piel, 0.08), ex, ey + 0.4, orx + 1.8, ory + 1.6);
      if (K.parp > 0.8) { L(c, osc(K.piel, 0.5), 1.5, ex - orx, ey + 0.4, ex + orx, ey + 0.6); }
      else {
        E(c, K.cl === "eco" ? "#e9fbff" : "#f4efe6", ex, ey, orx, ory * ab);
        if (K.cl !== "eco") {
          c.save(); c.beginPath(); c.ellipse(ex, ey, orx, ory * ab, 0, 0, 7); c.clip();
          const ix = ex + K.mx * 1.2, iy = ey + K.my * 0.8;
          E(c, R.iris, ix, iy, ory * 0.95, ory * 0.95);
          if (R.rendija) E(c, "#15110f", ix, iy, 0.7, ory); else E(c, "#15110f", ix, iy, ory * 0.46, ory * 0.46);
          E(c, "#ffffff", ix - 0.7, iy - 0.8, 0.55, 0.55);
          c.restore();
        }
        c.strokeStyle = osc(K.piel, 0.58); c.lineWidth = 1.1; c.beginPath(); c.ellipse(ex, ey, orx, ory * ab, 0, Math.PI * 1.04, Math.PI * 1.96); c.stroke();
        if (R.f) { L(c, osc(K.piel, 0.6), 1, ex + l * orx, ey - 0.4, ex + l * (orx + 1.7), ey - 1.6); }
      }
    });
  }

  function cejas(K) {
    const { c, R } = K;
    const col = osc(K.pelo, 0.12), g = R.cejaG * (R.f ? 0.72 : 1), by = CY - 5.6;
    [-1, 1].forEach(l => {
      if (K.parche === l) return;
      const x1 = CX + l * (R.ex - 4.7), x2 = CX + l * (R.ex + 4.6);
      let y1 = by, y2 = by - 0.2, ym = by - 0.8;
      if (R.ceja === 1) { y1 = by + 1.3; y2 = by - 1.1; ym = by - 0.4; }
      else if (R.ceja === 2) { y1 = by + 0.4; y2 = by + 0.6; ym = by - 2.2; }
      else if (R.ceja === 3) { y1 = by - 0.9; y2 = by + 1.3; ym = by - 1; }
      c.strokeStyle = col; c.lineWidth = g; c.lineCap = "round";
      c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, ym, x2, y2); c.stroke();
    });
  }

  function nariz(K) {
    const { c, R } = K;
    const ny = CY + 1 + R.nariz, na = R.narizAncho;
    L(c, osc(K.piel, 0.15), 1.1, CX + 1.4, CY + 2, CX + 1.7, ny - 0.6);
    c.strokeStyle = osc(K.piel, 0.28); c.lineWidth = 1.1; c.lineCap = "round";
    c.beginPath(); c.moveTo(CX - na, ny + 0.2); c.quadraticCurveTo(CX, ny + 2.3, CX + na, ny + 0.2); c.stroke();
    E(c, cla(K.piel, 0.1), CX - 0.4, ny - 1.4, 1.1, 0.9);
  }

  function barba(K) {
    const { c, R } = K;
    if (!R.barba || K.sinBarba) return;
    const col = osc(K.pelo, 0.05), my = CY + R.ry * 0.62;
    const borde = [[CX - R.rx - 2, CY + 2], [CX - R.rx * 0.7, CY + 10], [CX - 6.8, my - 2.2], [CX - 3.2, my - 4.4], [CX, my - 3.1], [CX + 3.2, my - 4.4], [CX + 6.8, my - 2.2], [CX + R.rx * 0.7, CY + 10], [CX + R.rx + 2, CY + 2]];
    if (R.barba === 1) {
      c.save(); trazoCara(c, R); c.clip(); c.globalAlpha = 0.3; c.fillStyle = col; c.fillRect(0, CY + 8, 100, 40); c.restore();
    } else if (R.barba === 2) {
      c.save(); trazoCara(c, R); c.clip(); P(c, col, borde.concat([[CX + R.rx + 2, CY + R.ry + 10], [CX - R.rx - 2, CY + R.ry + 10]])); c.restore();
    } else if (R.barba === 3) {
      P(c, col, borde.concat([[CX + R.rx + 1.5, CY + R.ry * 0.5], [CX + R.cj + 4, CY + R.ry + 8], [CX, CY + R.ry + 14], [CX - R.cj - 4, CY + R.ry + 8], [CX - R.rx - 1.5, CY + R.ry * 0.5]]));
    } else {
      [-1, 1].forEach(l => P(c, col, [[CX, my - 4.6], [CX + l * 8.5, my - 2.4], [CX + l * 7.4, my + 0.6], [CX, my - 2.2]]));
      P(c, col, [[CX - 3, my + 3], [CX + 3, my + 3], [CX + 1.6, CY + R.ry + 5], [CX - 1.6, CY + R.ry + 5]]);
    }
  }

  function boca(K) {
    const { c, R } = K;
    if (K.sinBoca) return;
    const my = CY + R.ry * 0.62, col = osc(mez(K.piel, "#8a3030", 0.5), 0.4);
    if (R.barba >= 2) E(c, mez(K.piel, "#c58a7a", 0.4), CX, my + 0.5, 4.6, 1.8);
    if (R.f) E(c, mez(K.piel, "#b23a4a", 0.58), CX, my + 0.3, 3.7, 1.55);
    c.strokeStyle = col; c.lineWidth = 1.35; c.lineCap = "round"; c.beginPath();
    if (R.boca === 0) { c.moveTo(CX - 3.8, my); c.lineTo(CX + 3.8, my); }
    else if (R.boca === 1) { c.moveTo(CX - 4, my + 0.1); c.quadraticCurveTo(CX + 1, my + 1.3, CX + 4.4, my - 1.2); }
    else { c.moveTo(CX - 4, my + 0.7); c.quadraticCurveTo(CX, my - 0.5, CX + 4, my + 0.7); }
    c.stroke();
  }

  function detalles(K) {
    const { c, R } = K;
    const ny = CY + 1 + R.nariz, my = CY + R.ry * 0.62;
    if (R.arrugas) {
      c.strokeStyle = osc(K.piel, 0.17); c.lineWidth = 0.9; c.lineCap = "round";
      [-1, 1].forEach(l => { c.beginPath(); c.moveTo(CX + l * 4, ny + 1); c.quadraticCurveTo(CX + l * 7.6, my - 3, CX + l * 6.2, my + 2); c.stroke(); });
      if (R.arrugas > 1) [-1, 1].forEach(l => L(c, osc(K.piel, 0.14), 0.8, CX + l * (R.ex + 3), CY + 6, CX + l * (R.ex + 6), CY + 9));
    }
    if (R.pecas) { c.fillStyle = osc(K.piel, 0.2); [[-9, 8], [-6, 10], [-3, 7], [3, 7], [6, 10], [9, 8], [-7, 6], [7, 6]].forEach(p => { c.beginPath(); c.arc(CX + p[0], CY + p[1], 0.55, 0, 7); c.fill(); }); }
    if (R.sutura) {
      L(c, "#2a2228", 0.9, CX + 3, CY - 15, CX + 9, CY - 2);
      for (let i = 0; i < 4; i++) L(c, "#2a2228", 0.8, CX + 3 + i * 1.6 - 1.4, CY - 13 + i * 3.3, CX + 3 + i * 1.6 + 1.4, CY - 12.2 + i * 3.3);
    }
  }

  function cicatrices(K) {
    const { c, R } = K;
    const col = mez(K.piel, "#d9928a", 0.55);
    for (let i = 0; i < R.nCic; i++) {
      let x1, y1, x2, y2;
      switch (R.cicTipos[i]) {
        case 0: x1 = CX - R.rx * 0.62; y1 = CY - 9; x2 = CX - R.rx * 0.28; y2 = CY + 4; break;
        case 1: x1 = CX + R.rx * 0.28; y1 = CY + 5; x2 = CX + R.rx * 0.82; y2 = CY + 14; break;
        case 2: x1 = CX - 3; y1 = CY + R.ry - 9; x2 = CX + 1.5; y2 = CY + R.ry - 1; break;
        default: x1 = CX - 9; y1 = CY + 5; x2 = CX + 9; y2 = CY + 8.5;
      }
      L(c, col, 1.5, x1, y1, x2, y2);
      const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy);
      for (let t = 0.2; t < 0.9; t += 0.22) { const px = x1 + dx * t, py = y1 + dy * t; L(c, osc(col, 0.25), 0.8, px - dy / n * 1.8, py + dx / n * 1.8, px + dy / n * 1.8, py - dx / n * 1.8); }
    }
  }

  /* =========================================================================
     PELO
  ========================================================================= */
  function flequillo(c, R, col, ctrl, asim, e) {
    c.fillStyle = col; c.beginPath();
    c.moveTo(CX - R.rx - 1.2 - e, CY + 2);
    c.bezierCurveTo(CX - R.rx - 2.4 - e, CY - R.ry - 7 - e, CX + R.rx + 2.4 + e, CY - R.ry - 7 - e, CX + R.rx + 1.2 + e, CY + 2);
    c.lineTo(CX + R.rx - 0.2, CY - 1); c.lineTo(CX + R.rx - 1.4, CY - 6);
    c.quadraticCurveTo(CX + asim, CY - ctrl, CX - R.rx + 1.4, CY - 6);
    c.lineTo(CX - R.rx + 0.2, CY - 1);
    c.closePath(); c.fill();
  }

  function peloAtras(K) {
    const { c, R } = K;
    if (K.cub >= 3 || (R.estilo !== 3 && R.estilo !== 4)) return;
    if (R.estilo === 3) P(c, osc(K.pelo, 0.08), [[CX - R.rx - 3, CY - 8], [CX - R.rx - 9, CY + R.ry + 24], [CX + R.rx + 9, CY + R.ry + 24], [CX + R.rx + 3, CY - 8]]);
    else { P(c, osc(K.pelo, 0.08), [[CX - R.rx - 1, CY - 8], [CX - R.rx - 10, CY + 4], [CX - R.rx - 8, CY + 22], [CX - R.rx - 4.5, CY + 8], [CX - R.rx + 1, CY]]); L(c, K.ban, 2.2, CX - R.rx - 8.2, CY + 5, CX - R.rx - 6.3, CY + 7); }
  }

  function peloFrente(K) {
    const { c, R } = K;
    if (K.cub >= 2) return;
    const p = K.pelo;
    switch (R.estilo) {
      case 0: break;
      case 1: flequillo(c, R, p, 17, 0, 0); break;
      case 2:
        flequillo(c, R, p, 22, 0, 0);
        [-6, 0, 6].forEach(x => L(c, osc(p, 0.28), 0.9, CX + x, CY - 19, CX + x * 1.5, CY - R.ry - 6));
        break;
      case 3:
        flequillo(c, R, p, 13, -4, 0);
        [-1, 1].forEach(l => P(c, p, [[CX + l * (R.rx + 2), CY - 3], [CX + l * (R.rx - 3), CY - 6], [CX + l * (R.rx - 2.5), CY + R.ry - 6], [CX + l * (R.rx + 3), CY + R.ry + 4]]));
        break;
      case 4: flequillo(c, R, p, 17, 3, 0); break;
      case 5:
        flequillo(c, R, p, 17, 0, 0);
        E(c, p, CX, CY - R.ry - 8, 6.6, 6); L(c, osc(p, 0.3), 1, CX - 6, CY - R.ry - 4, CX + 6, CY - R.ry - 4);
        break;
      case 6: {
        flequillo(c, R, p, 15, 0, 1);
        for (let a = Math.PI * 1.02; a < Math.PI * 2; a += 0.28) E(c, p, CX + Math.cos(a) * (R.rx + 2.4), CY - 3 + Math.sin(a) * (R.ry + 4), 4.6, 4.6);
        break;
      }
      default:
        c.save(); c.globalAlpha = 0.28; flequillo(c, R, p, 17, 0, 0); c.restore();
        P(c, p, [[CX - 6, CY - R.ry + 2], [CX - 3.4, CY - R.ry - 11], [CX + 3, CY - R.ry - 14], [CX + 6, CY - R.ry + 2]]);
    }
  }

  /* =========================================================================
     CAPUCHAS Y CASCOS (los comparten varias clases)
  ========================================================================= */
  function capucha(K, color, fase) {
    const { c, R } = K;
    const arco = () => { c.moveTo(CX - R.rx - 8, CY + 30); c.bezierCurveTo(CX - R.rx - 11, CY - R.ry - 14, CX + R.rx + 11, CY - R.ry - 14, CX + R.rx + 8, CY + 30); c.closePath(); };
    if (fase === "atras") {
      c.fillStyle = color; c.beginPath(); arco(); c.fill();
      E(c, osc(color, 0.6), CX, CY + 4, R.rx + 2, R.ry + 1);
    } else {
      c.fillStyle = color; c.beginPath(); arco();
      c.moveTo(CX + R.rx + 0.6, CY + 5); c.ellipse(CX, CY + 5, R.rx + 0.6, R.ry * 0.88, 0, 0, Math.PI * 2);
      c.fill("evenodd");
      c.strokeStyle = osc(color, 0.32); c.lineWidth = 1.2; c.beginPath(); c.ellipse(CX, CY + 5, R.rx + 0.6, R.ry * 0.88, 0, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
    }
  }

  /* Cúpula de metal o tela que cubre la parte alta. borde: y de su borde inferior; lado: cuánto baja por los lados */
  function cupula(K, color, borde, lado) {
    const { c, R } = K;
    c.fillStyle = color; c.beginPath();
    c.moveTo(CX - R.rx - 2.6, CY + lado);
    c.bezierCurveTo(CX - R.rx - 3.8, CY - R.ry - 9, CX + R.rx + 3.8, CY - R.ry - 9, CX + R.rx + 2.6, CY + lado);
    c.lineTo(CX + R.rx - 0.4, CY + lado); c.lineTo(CX + R.rx - 0.4, borde); c.lineTo(CX - R.rx + 0.4, borde); c.lineTo(CX - R.rx + 0.4, CY + lado);
    c.closePath(); c.fill();
    L(c, osc(color, 0.28), 2.6, CX - R.rx - 1.6, borde, CX + R.rx + 1.6, borde);
  }

  function hombros(c, color) {
    c.fillStyle = color; c.beginPath();
    c.moveTo(4, 131); c.lineTo(8, 110); c.quadraticCurveTo(12, 98, 32, 95); c.lineTo(68, 95); c.quadraticCurveTo(88, 98, 92, 110); c.lineTo(96, 131); c.closePath(); c.fill();
    c.save(); c.clip(); c.fillStyle = "rgba(0,0,0,.17)"; c.fillRect(63, 90, 40, 45); c.restore();
  }

  /* =========================================================================
     CLASES: lo que cambia de una a otra. cub: 0 nada, 1 adorno (se ve el pelo), 2 cubre la parte alta
     (solo asoma el pelo largo), 3 cubre todo.
  ========================================================================= */
  const CLASE = {
    guerrero: {
      cub: 2,
      atras(K) { const c = K.c; E(c, osc(K.col, 0.35), 85, 106, 15, 15); c.strokeStyle = ACERO; c.lineWidth = 2; c.beginPath(); c.arc(85, 106, 14, 0, 7); c.stroke(); E(c, K.ban, 85, 106, 5.5, 5.5); },
      cuerpo(K) {
        const c = K.c; hombros(c, K.col);
        P(c, osc(K.col, 0.28), [[36, 95], [64, 95], [60, 131], [40, 131]]);
        L(c, "#5a4026", 5, 16, 99, 76, 131);
        E(c, ACERO, 17, 103, 12.5, 7, -0.3); L(c, ACERO2, 1.4, 8, 102, 24, 99);
        [[12, 103], [22, 100]].forEach(p => E(c, "#e8e2d0", p[0], p[1], 0.9, 0.9));
      },
      collar(K) { const c = K.c; for (let i = 0; i < 3; i++) E(c, i % 2 ? ACERO2 : "#a5adb6", CX, 94 + i * 1.8, 13 - i * 1.3, 4.6); },
      casco(K, fase) {
        if (fase !== "frente") return;
        const { c, R } = K; cupula(K, ACERO, CY - 8, 5);
        P(c, ACERO2, [[CX - 1.5, CY - 8], [CX + 1.5, CY - 8], [CX + 1.2, CY + 9], [CX - 1.2, CY + 9]]);
        [-1, 1].forEach(l => E(c, "#e8e2d0", CX + l * (R.rx + 0.4), CY - 8, 0.9, 0.9));
        L(c, claro3(ACERO), 1.2, CX - 8, CY - R.ry - 4, CX - 2, CY - R.ry - 6);
      }
    },
    cazador: {
      cub: 3,
      atras(K) {
        const c = K.c; c.strokeStyle = MADERA; c.lineWidth = 2.8; c.lineCap = "round"; c.beginPath(); c.moveTo(80, 18); c.quadraticCurveTo(99, 74, 80, 130); c.stroke();
        L(c, "#e8e2d0", 0.8, 80, 18, 80, 130);
        P(c, MADERA, [[14, 80], [22, 76], [30, 102], [22, 106]]);
        [[15, 77], [19, 76], [23, 75]].forEach((p, i) => { L(c, "#d8c9a6", 1.2, p[0] - 1, p[1] + 4, p[0] - 2 + i, p[1] - 8); P(c, K.ban, [[p[0] - 2 + i, p[1] - 9], [p[0] - 5 + i, p[1] - 5], [p[0] + 1 + i, p[1] - 6]]); });
      },
      cuerpo(K) {
        const c = K.c; hombros(c, osc(K.col, 0.45));
        P(c, K.col, [[14, 100], [34, 92], [66, 92], [86, 100], [92, 131], [8, 131]]);
        L(c, "#8a6a3c", 5, 14, 98, 70, 131); L(c, osc("#8a6a3c", 0.3), 1, 14, 98, 70, 131);
      },
      casco(K, fase) { capucha(K, K.col, fase); if (fase === "frente") P(K.c, K.ban, [[CX + K.R.rx - 4, CY - K.R.ry - 4], [CX + K.R.rx + 12, CY - K.R.ry - 16], [CX + K.R.rx + 4, CY - K.R.ry - 1]]); }
    },
    arcanista: {
      cub: 1,
      atras(K) { const c = K.c; L(c, MADERA, 3, 85, 14, 85, 131); c.strokeStyle = "#cfe9f5"; c.lineWidth = 1.2; c.beginPath(); c.arc(85, 11, 6.6, 0, 7); c.stroke(); E(c, "#8fd8ff", 85, 11, 5, 5); E(c, "#ffffff", 83.4, 9.4, 1.5, 1.5); },
      cuerpo(K) {
        const c = K.c; hombros(c, K.col);
        P(c, cla(K.col, 0.12), [[24, 98], [34, 78], [42, 96]]); P(c, cla(K.col, 0.12), [[76, 98], [66, 78], [58, 96]]);
        P(c, K.ban, [[40, 98], [60, 98], [50, 118]]);
        P(c, ORO, [[50, 104], [53, 108], [50, 112], [47, 108]]);
      },
      casco(K, fase) {
        if (fase !== "frente") return; const { c, R } = K;
        c.strokeStyle = ORO; c.lineWidth = 2.1; c.lineCap = "round"; c.beginPath(); c.moveTo(CX - R.rx, CY - 8); c.quadraticCurveTo(CX, CY - 5, CX + R.rx, CY - 8); c.stroke();
        E(c, "#8fd8ff", CX, CY - 6.4, 1.9, 2.3);
      }
    },
    paladin: {
      cub: 2,
      atras(K) { const c = K.c; c.strokeStyle = ORO; c.lineWidth = 1.3; c.beginPath(); c.arc(CX, 58, 37, 0, 7); c.stroke(); c.lineWidth = 0.8; c.beginPath(); c.arc(CX, 58, 41, 0, 7); c.stroke(); },
      cuerpo(K) {
        const c = K.c; hombros(c, "#aeb5bd");
        E(c, "#c3cad2", 16, 102, 14, 8.5, -0.35); E(c, "#c3cad2", 84, 102, 14, 8.5, 0.35); L(c, K.col, 2, 6, 106, 26, 98); L(c, K.col, 2, 94, 106, 74, 98);
        P(c, K.col, [[40, 96], [60, 96], [62, 131], [38, 131]]);
        P(c, K.ban, [[48.4, 101], [51.6, 101], [51.6, 125], [48.4, 125]]); P(c, K.ban, [[42, 108], [58, 108], [58, 111], [42, 111]]);
      },
      collar(K) { E(K.c, ACERO2, CX, 95, 14, 5.6); },
      casco(K, fase) {
        const { c, R } = K;
        if (fase === "atras") { P(c, "#c0463c", [[CX - 3, CY - R.ry - 8], [CX + 16, CY - R.ry - 18], [CX + 10, CY - R.ry - 2], [CX + 4, CY - R.ry - 5]]); return; }
        cupula(K, ACERO, CY - 7, 11);
        P(c, ACERO2, [[CX - 1.6, CY - 7], [CX + 1.6, CY - 7], [CX + 1.2, CY + 10], [CX - 1.2, CY + 10]]);
        L(c, ORO, 1.4, CX - R.rx - 2, CY - 12, CX + R.rx + 2, CY - 12);
      }
    },
    picaro: {
      cub: 3, sinBoca: true, sinBarba: true,
      atras(K) {
        const c = K.c;
        [[18, 1], [82, -1]].forEach(([x, l]) => { L(c, MADERA, 3.4, x, 98, x - l * 2, 84); L(c, ACERO2, 3, x - l * 6, 83, x + l * 2, 83); E(c, "#c0a050", x - l * 2.2, 81.5, 2, 2); });
      },
      cuerpo(K) { const c = K.c; hombros(c, "#3a3342"); L(c, "#6a5a46", 4.4, 12, 100, 70, 131); L(c, "#6a5a46", 3, 88, 102, 36, 131); L(c, K.col, 2.4, 10, 108, 30, 102); },
      casco(K, fase) {
        capucha(K, osc(K.col, 0.4), fase);
        if (fase === "frente") {
          const { c, R } = K;
          P(c, osc(K.col, 0.58), [[CX - R.rx - 0.6, CY + 2.5], [CX - 3, CY + 7], [CX, CY + 4.2], [CX + 3, CY + 7], [CX + R.rx + 0.6, CY + 2.5], [CX + R.cj + 4, CY + R.ry - 1], [CX, CY + R.ry + 4], [CX - R.cj - 4, CY + R.ry - 1]]);
          L(c, osc(K.col, 0.75), 1, CX - 4, CY + R.ry - 3, CX + 4, CY + R.ry - 3);
        }
      }
    },
    caballero: {
      cub: 2,
      atras(K) { const c = K.c; L(c, MADERA, 2.8, 88, 0, 88, 131); P(c, K.ban, [[88, 6], [88, 26], [64, 16]]); P(c, K.col, [[88, 11], [88, 17], [74, 14]]); },
      cuerpo(K) {
        const c = K.c; hombros(c, "#aab1ba");
        E(c, "#c6ccd4", 15, 103, 15, 9.5, -0.4); E(c, "#c6ccd4", 85, 103, 15, 9.5, 0.4);
        L(c, K.col, 2.6, 4, 108, 26, 99); L(c, K.col, 2.6, 96, 108, 74, 99);
        L(c, osc("#aab1ba", 0.3), 1.5, CX, 96, CX, 131); L(c, K.col, 2.4, 30, 100, 40, 108); L(c, K.col, 2.4, 70, 100, 60, 108);
      },
      collar(K) { E(K.c, ACERO2, CX, 95, 14.5, 6); },
      casco(K, fase) {
        const { c, R } = K;
        if (fase === "atras") { P(c, K.col, [[CX - 2, CY - R.ry - 7], [CX - 24, CY - R.ry - 2], [CX - 27, CY - R.ry + 16], [CX - 9, CY - R.ry + 3], [CX + 5, CY - R.ry - 4]]); return; }
        cupula(K, ACERO, CY - 8, 15);
        P(c, cla(ACERO, 0.2), [[CX - R.rx + 1, CY - 9], [CX + R.rx - 1, CY - 9], [CX + R.rx - 4, CY - 18], [CX - R.rx + 4, CY - 18]]);
        L(c, osc(ACERO, 0.45), 1.1, CX - R.rx + 4, CY - 13.5, CX + R.rx - 4, CY - 13.5);
        P(c, ACERO2, [[CX - 1.6, CY - 8], [CX + 1.6, CY - 8], [CX + 1.2, CY + 11], [CX - 1.2, CY + 11]]);
      }
    },
    esqueleto: {
      cub: 0, total(K) {
        const c = K.c;
        hombros(c, osc(K.col, 0.25));
        for (let i = 0; i < 3; i++) { c.strokeStyle = HUESO; c.lineWidth = 2; c.beginPath(); c.arc(CX, 100 + i * 7, 18 - i * 1.5, Math.PI * 0.12, Math.PI * 0.88); c.stroke(); }
        L(c, HUESO, 3.4, CX, 94, CX, 131);
        E(c, HUESO, 17, 102, 8, 5, -0.3); E(c, HUESO, 83, 102, 8, 5, 0.3);
        [0, 1, 2].forEach(i => L(c, "#d3cbb4", 2.2, CX, 74 + i * 6.5, CX, 77.5 + i * 6.5));
        E(c, HUESO, CX, CY - 2, 18.5, 20); P(c, HUESO, [[CX - 13, CY + 10], [CX + 13, CY + 10], [CX + 9.5, CY + 24], [CX - 9.5, CY + 24]]);
        c.save(); c.beginPath(); c.ellipse(CX, CY - 2, 18.5, 20, 0, 0, 7); c.clip(); c.fillStyle = "rgba(0,0,0,.1)"; c.fillRect(CX + 6, 0, 30, 100); c.restore();
        [-1, 1].forEach(l => { E(c, "#1c1620", CX + l * 8, CY, 5.4, 6.4); E(c, "#e8742a", CX + l * 8 + K.mx, CY + 0.5 + K.my * 0.6, 1.3, 1.3); });
        P(c, "#1c1620", [[CX, CY + 6], [CX - 3, CY + 13], [CX + 3, CY + 13]]);
        c.fillStyle = "#1c1620"; c.fillRect(CX - 9, CY + 16, 18, 6.2); c.fillStyle = HUESO; c.fillRect(CX - 8.2, CY + 16.8, 16.4, 4.6);
        for (let i = -3; i <= 3; i++) L(c, "#4a4438", 0.8, CX + i * 2.3, CY + 16.5, CX + i * 2.3, CY + 21);
        L(c, "#6d6657", 1, CX + 7, CY - 21, CX + 11, CY - 11); L(c, "#6d6657", 1, CX + 11, CY - 11, CX + 8.6, CY - 7);
        c.save(); c.beginPath(); c.rect(0, 0, CX, 130); c.clip();
        c.fillStyle = "#6b6a66"; c.beginPath(); c.moveTo(CX - 20, CY + 2); c.bezierCurveTo(CX - 22, CY - 34, CX + 4, CY - 36, CX + 6, CY - 14); c.lineTo(CX, CY - 8); c.lineTo(CX - 20, CY - 8); c.closePath(); c.fill();
        L(c, "#4e4d4a", 1.4, CX - 20, CY - 8, CX, CY - 8); L(c, "#8a5a3a", 1, CX - 12, CY - 22, CX - 8, CY - 16);
        c.restore();
      }
    },
    archimago: {
      cub: 2,
      atras(K) { const c = K.c; c.strokeStyle = K.ban; c.lineWidth = 1.2; c.beginPath(); c.arc(CX, 62, 34, 0, 7); c.stroke(); c.setLineDash([2.5, 4]); c.beginPath(); c.arc(CX, 62, 39, 0, 7); c.stroke(); c.setLineDash([]); },
      cuerpo(K) {
        const c = K.c; hombros(c, K.col);
        P(c, cla(K.col, 0.15), [[22, 99], [33, 70], [42, 96]]); P(c, cla(K.col, 0.15), [[78, 99], [67, 70], [58, 96]]);
        P(c, K.ban, [[38, 98], [62, 98], [50, 128]]);
        [[50, 104], [46, 110], [54, 110]].forEach(p => P(c, ORO, [[p[0], p[1] - 2.4], [p[0] + 1.8, p[1]], [p[0], p[1] + 2.4], [p[0] - 1.8, p[1]]]));
      },
      casco(K, fase) {
        if (fase !== "frente") return; const { c, R } = K;
        E(c, osc(K.col, 0.35), CX, CY - 12, R.rx + 14, 6.5);
        P(c, osc(K.col, 0.25), [[CX - R.rx - 1, CY - 12], [CX + R.rx + 1, CY - 12], [CX + 7, CY - R.ry - 14], [CX + 15, CY - R.ry - 26], [CX + 8, CY - R.ry - 29], [CX - 2, CY - R.ry - 14]]);
        P(c, K.ban, [[CX - R.rx - 1, CY - 12], [CX + R.rx + 1, CY - 12], [CX + R.rx + 0.4, CY - 18], [CX - R.rx - 0.4, CY - 18]]);
        P(c, ORO, [[CX - 2.4, CY - 18.4], [CX + 2.4, CY - 18.4], [CX + 2.4, CY - 11.6], [CX - 2.4, CY - 11.6]]); P(c, osc(K.ban, 0.3), [[CX - 1, CY - 17], [CX + 1, CY - 17], [CX + 1, CY - 13], [CX - 1, CY - 13]]);
        [[CX + 1, CY - R.ry - 4], [CX + 9, CY - R.ry - 17]].forEach(p => P(c, ORO, [[p[0], p[1] - 2.6], [p[0] + 1.8, p[1]], [p[0], p[1] + 2.6], [p[0] - 1.8, p[1]]]));
      }
    },
    ballestero: {
      cub: 2,
      atras(K) { const c = K.c; L(c, MADERA, 4, 62, 116, 96, 88); c.strokeStyle = ACERO; c.lineWidth = 2.4; c.beginPath(); c.moveTo(76, 90); c.quadraticCurveTo(88, 100, 84, 114); c.stroke(); L(c, "#e8e2d0", 0.8, 76, 90, 84, 114); },
      cuerpo(K) {
        const c = K.c; hombros(c, K.col);
        for (let x = 24; x <= 76; x += 8) L(c, osc(K.col, 0.22), 1, x, 100, x, 131);
        L(c, "#6a4a2c", 6, 12, 98, 70, 131);
        for (let i = 0; i < 6; i++) { const t = i / 5; L(c, ACERO, 1.4, 18 + t * 44, 101 + t * 26, 18 + t * 44 + 1.5, 95 + t * 26); }
      },
      casco(K, fase) {
        if (fase !== "frente") return; const { c, R } = K;
        E(c, ACERO, CX, CY - 9, R.rx + 15, 5.6); cupula(K, ACERO, CY - 9, 1);
        L(c, claro3(ACERO), 1.2, CX - R.rx - 8, CY - 10.4, CX - R.rx + 2, CY - 12);
      }
    },
    mercenario: {
      cub: 2,
      cuerpo(K) {
        const c = K.c; hombros(c, "#6a5a46");
        for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) E(c, "#b3a58a", 22 + i * 11 + (r % 2) * 5, 104 + r * 8, 1, 1);
        E(c, ACERO, 16, 103, 13, 7.5, -0.3); L(c, "#c0463c", 6, 12, 108, 68, 131);
      },
      casco(K, fase) {
        if (fase !== "frente") return; const { c, R } = K;
        cupula(K, "#b8453a", CY - 6.5, 0);
        P(c, "#b8453a", [[CX - R.rx - 1, CY - 8], [CX - R.rx - 10, CY - 3], [CX - R.rx - 7, CY + 3], [CX - R.rx - 1, CY - 3]]);
      }
    },
    sanador: {
      cub: 3,
      atras(K) {
        const c = K.c; L(c, MADERA, 3, 84, 30, 84, 131);
        c.strokeStyle = MADERA; c.lineWidth = 1.4; c.beginPath(); c.arc(84, 24, 3, Math.PI, 0); c.stroke();
        P(c, "#ffe9a6", [[80, 24], [88, 24], [87, 34], [81, 34]]); L(c, MADERA, 1.2, 80, 24, 88, 24); L(c, MADERA, 1.2, 81, 34, 87, 34);
      },
      cuerpo(K) {
        const c = K.c; hombros(c, cla(K.col, 0.4));
        P(c, K.ban, [[48.4, 102], [51.6, 102], [51.6, 120], [48.4, 120]]); P(c, K.ban, [[42, 109], [58, 109], [58, 112.2], [42, 112.2]]);
        L(c, MADERA, 3, 16, 98, 68, 131);
      },
      casco(K, fase) { capucha(K, cla(K.col, 0.45), fase); }
    },
    eco: {
      cub: 1, ghost: true,
      atras(K) { const c = K.c; c.strokeStyle = "#bfe9f2"; c.lineWidth = 1; [24, 34, 44].forEach(r => { c.globalAlpha = 0.65 - r / 90; c.beginPath(); c.ellipse(CX, 120, r + 14, r * 0.34, 0, 0, 7); c.stroke(); }); c.globalAlpha = 1; },
      cuerpo(K) { const c = K.c; hombros(c, mez(K.col, "#bfe9f2", 0.62)); L(c, "#e6c6ff", 1.4, 20, 108, 80, 108); },
      casco() { }
    },
    lider: {
      cub: 1,
      atras(K) {
        const c = K.c;
        P(c, osc(K.ban, 0.1), [[4, 131], [10, 100], [32, 92], [68, 92], [90, 100], [96, 131]]);
        [[6, 26], [74, 94]].forEach(([a, b]) => { P(c, K.ban, [[a, 0], [b, 0], [b, 58], [(a + b) / 2, 50], [a, 58]]); E(c, K.col, (a + b) / 2, 20, 5, 5); });
      },
      cuerpo(K) {
        const c = K.c; hombros(c, "#b3bac3");
        E(c, "#c6ccd4", 15, 103, 14, 8.5, -0.35); E(c, "#c6ccd4", 85, 103, 14, 8.5, 0.35); L(c, ORO, 2.2, 5, 108, 26, 99); L(c, ORO, 2.2, 95, 108, 74, 99);
        P(c, "#ece5d2", [[22, 97], [34, 90], [40, 99], [46, 90], [50, 99], [54, 90], [60, 99], [66, 90], [78, 97], [78, 106], [22, 106]]);
        L(c, K.ban, 2.4, 50, 106, 50, 112); E(c, ORO, 50, 115, 4.2, 4.2); E(c, K.ban, 50, 115, 1.7, 1.7);
      },
      casco(K, fase) {
        if (fase !== "frente") return; const { c, R } = K;
        P(c, ORO, [[CX - R.rx + 1, CY - 9], [CX + R.rx - 1, CY - 9], [CX + R.rx - 1, CY - 15], [CX - R.rx + 1, CY - 15]]);
        P(c, ORO, [[CX - R.rx + 1, CY - 15], [CX - R.rx + 3, CY - 25], [CX - R.rx * 0.5, CY - 18], [CX, CY - 28], [CX + R.rx * 0.5, CY - 18], [CX + R.rx - 3, CY - 25], [CX + R.rx - 1, CY - 15]]);
        [[CX - R.rx + 3, CY - 25], [CX, CY - 28], [CX + R.rx - 3, CY - 25]].forEach(p => E(c, K.ban, p[0], p[1], 1.5, 1.5));
        [-6, 0, 6].forEach(x => E(c, K.ban, CX + x, CY - 12, 1.3, 1.3));
      }
    },
    salvaje: {
      cub: 0, total(K) {
        const { c, R } = K, pel = R.pelaje;
        hombros(c, pel);
        P(c, osc(pel, 0.25), [[16, 100], [24, 90], [30, 102], [38, 90], [44, 104], [56, 104], [62, 90], [70, 102], [76, 90], [84, 100], [84, 112], [16, 112]]);
        P(c, pel, [[CX - 21, CY - 10], [CX - 15, CY - 31], [CX - 6, CY - 17]]); P(c, pel, [[CX + 21, CY - 10], [CX + 15, CY - 31], [CX + 6, CY - 17]]);
        P(c, osc(pel, 0.4), [[CX - 17, CY - 12], [CX - 14, CY - 24], [CX - 9, CY - 16]]); P(c, osc(pel, 0.4), [[CX + 17, CY - 12], [CX + 14, CY - 24], [CX + 9, CY - 16]]);
        E(c, pel, CX, CY + 2, 23, 21);
        c.save(); c.beginPath(); c.ellipse(CX, CY + 2, 23, 21, 0, 0, 7); c.clip(); c.fillStyle = "rgba(0,0,0,.14)"; c.fillRect(CX + 6, 0, 40, 100); c.restore();
        E(c, cla(pel, 0.16), CX, CY + 12, 12.5, 9.5); E(c, "#1c1418", CX, CY + 5.5, 4.6, 3.2);
        L(c, osc(pel, 0.5), 1.5, CX, CY + 8, CX, CY + 14); c.strokeStyle = osc(pel, 0.5); c.lineWidth = 1.4; c.beginPath(); c.moveTo(CX - 7, CY + 16); c.quadraticCurveTo(CX, CY + 12.5, CX + 7, CY + 16); c.stroke();
        [-1, 1].forEach(l => {
          P(c, "#eee6d2", [[CX + l * 10, CY + 17], [CX + l * 6.4, CY + 17], [CX + l * 8.4, CY + 7]]);
          E(c, "#ffd36a", CX + l * 10, CY - 3, 3.6, 2.2, l * 0.35);
          L(c, "#15110f", 1.1, CX + l * 10 + K.mx * 0.8, CY - 4.8, CX + l * 10 + K.mx * 0.8, CY - 1.2);
          L(c, osc(pel, 0.55), 2, CX + l * 14, CY - 7.5, CX + l * 6, CY - 5);
        });
      }
    }
  };
  function claro3(c) { return cla(c, 0.35); }

  /* =========================================================================
     FONDO Y MARCOS
  ========================================================================= */
  const GRUPO = { guerrero: 0, caballero: 0, paladin: 0, mercenario: 0, ballestero: 0, lider: 0, arcanista: 1, archimago: 1, eco: 1, sanador: 1, cazador: 2, picaro: 2, salvaje: 2, esqueleto: 2 };
  function fondo(K, s) {
    const { c } = K;
    let base = osc(K.col, 0.74);
    if (s.origen === "eco" || K.cl === "eco") base = mez(base, "#2f6a7a", 0.4);
    else if (s.origen === "criatura") base = mez(base, "#2f5a34", 0.34);
    else if (s.origen === "mercenario") base = mez(base, "#5a4426", 0.3);
    c.fillStyle = base; c.fillRect(0, 0, 100, 130);
    const g = GRUPO[K.cl] === undefined ? 0 : GRUPO[K.cl];
    const t1 = mez(base, K.col, 0.17), t2 = mez(base, K.col, 0.3);
    if (g === 0) { P(c, t1, [[-10, 74], [110, 14], [110, 38], [-10, 98]]); P(c, t2, [[-10, 100], [110, 40], [110, 48], [-10, 108]]); }
    else if (g === 1) { E(c, t1, CX, 60, 47, 47); E(c, t2, CX, 60, 35, 35); }
    else { P(c, t1, [[-10, 130], [30, 20], [60, 130]]); P(c, t2, [[40, 130], [80, 36], [110, 130]]); P(c, t1, [[70, 130], [100, 70], [110, 130]]); }
    c.fillStyle = K.ban; c.fillRect(0, 0, 4, 130);
    c.fillStyle = osc(K.col, 0.55); c.fillRect(4, 0, 1.4, 130);
  }

  function marco(K) {
    const { c } = K;
    const col = ["#5b4660", "#8f8498", "#c4c9d2", "#e0b24c", "#f0cf6a"][K.rango] || "#5b4660";
    c.strokeStyle = col; c.lineWidth = K.rango >= 3 ? 3 : 2; c.strokeRect(1.5, 1.5, 97, 127);
    if (K.rango >= 4) { c.lineWidth = 0.9; c.strokeRect(5, 5, 90, 120); [[5, 5], [95, 5], [5, 125], [95, 125]].forEach(p => E(c, ORO, p[0], p[1], 2.4, 2.4)); }
    // galones del rango
    c.strokeStyle = ORO; c.lineWidth = 2.3; c.lineCap = "round"; c.lineJoin = "round";
    for (let i = 0; i < K.rango; i++) { const y = 123 - i * 5.6; c.beginPath(); c.moveTo(8, y + 3); c.lineTo(14, y); c.lineTo(20, y + 3); c.stroke(); }
    if (K.cap) {
      P(c, K.ban, [[88, 0], [100, 0], [100, 0], [100, 26], [94, 21], [88, 26]]);
      c.fillStyle = "#f4ecd8"; c.font = "bold 9px Cinzel, Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(["", "I", "II", "III"][K.cap] || "C", 94, 11);
    }
  }

  function venda(K) {
    const { c, R } = K;
    P(c, "#e9e2cf", [[CX - R.rx - 1.4, CY - 14], [CX + R.rx + 1.4, CY - 8.5], [CX + R.rx + 1.4, CY - 2.5], [CX - R.rx - 1.4, CY - 8]]);
    L(c, "#c9c0a8", 0.8, CX - R.rx - 1, CY - 11, CX + R.rx + 1, CY - 5.5);
    E(c, "#9a2a22", CX + 6, CY - 5.8, 2.6, 2.1);
  }

  function parche(K) {
    const { c, R } = K, l = K.parche, ex = CX + l * R.ex, ey = CY + 1;
    L(c, "#1c1c20", 1.4, CX - R.rx - 1, CY - 7, CX + R.rx + 1, CY - 9.4);
    E(c, "#1c1c20", ex, ey + 0.2, 4.6, 4.2); L(c, "#3a3a44", 0.8, ex - 3, ey - 2, ex + 2.5, ey + 2.4);
  }

  /* =========================================================================
     DIBUJAR
  ========================================================================= */
  const puntero = { x: -1, y: -1, ok: false };
  window.addEventListener("pointermove", e => { puntero.x = e.clientX; puntero.y = e.clientY; puntero.ok = true; }, { passive: true });

  function dibujar(canvas, s, o) {
    o = o || {};
    const wpx = o.w || +canvas.dataset.w || 100, hpx = Math.round(wpx * 1.3), d = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(wpx * d), bh = Math.round(hpx * d);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    const c = canvas.getContext("2d");
    c.setTransform(bw / 100, 0, 0, bh / 130, 0, 0);
    c.clearRect(0, 0, 100, 130);
    const fac = FACCIONES[o.faccion] || FACCIONES[Object.keys(FACCIONES)[0]];
    const anio = o.anio === undefined ? 1 : o.anio;
    const R = rasgos(s, anio);
    const t = o.t || 0;
    const cl = s.clase && CLASE[s.clase] ? s.clase : "guerrero", cls = CLASE[cl];
    // parpadeo y mirada
    const sem = (hashStr(String(s.id)) % 1000) / 1000;
    const ciclo = 3.4 + sem * 2.2, fasep = (t + sem * 7) % ciclo;
    const parp = fasep < 0.16 ? Math.sin(fasep / 0.16 * Math.PI) : 0;
    let mx = 0.3, my = 0.1;
    if (puntero.ok && o.anim) {
      const r = canvas.getBoundingClientRect();
      mx = Math.max(-1, Math.min(1, (puntero.x - (r.left + r.width / 2)) / 260)); my = Math.max(-1, Math.min(1, (puntero.y - (r.top + r.height / 2)) / 260));
    }
    const rangoIdx = RANGOS.indexOf(RANGOS.slice().reverse().find(x => (s.victorias || 0) >= x.desde) || RANGOS[0]);
    const K = {
      c, cl, R, col: fac.color, ban: fac.bandera, piel: R.piel, pelo: R.pelo, cub: cls.cub,
      sinBoca: !!cls.sinBoca, sinBarba: !!cls.sinBarba, parp, mx, my, rango: Math.max(0, rangoIdx),
      cap: s.capitan ? (s.compania || 1) : 0, parche: R.parche ? R.ladoParche : 0
    };
    if (K.cl === "mercenario" && o.faccion !== "compania-dorada") K.col = mezcolMerc(fac.color);
    fondo(K, s);
    c.save();
    if (o.anim && !REDUCIDO) c.translate(0, Math.sin(t * 1.7 + sem * 6) * 0.55);
    if (cls.ghost) c.globalAlpha = 0.86;
    if (cls.total) { cls.total(K); }
    else {
      if (cls.atras) cls.atras(K);
      peloAtras(K);
      c.save(); c.translate(0, -6);
      cls.cuerpo(K);
      cuello(K);
      if (cls.collar) cls.collar(K);
      c.restore();
      if (cls.casco) cls.casco(K, "atras");
      orejas(K);
      cara(K);
      detalles(K);
      ojos(K);
      cejas(K);
      nariz(K);
      barba(K);
      boca(K);
      peloFrente(K);
      if (cls.casco) cls.casco(K, "frente");
    }
    c.globalAlpha = 1;
    if (!cls.total) cicatrices(K);
    if (K.parche && !cls.total) parche(K);
    if (o.herido) venda(K);
    if (s.luto) { P(c, "#0f0c12", [[8, 108], [22, 100], [25, 108], [11, 117]]); L(c, "#3a3440", 0.9, 10, 110, 23, 104); }
    c.restore();
    marco(K);
  }
  const mezcolMerc = col => col;

  /* =========================================================================
     ANIMACIÓN: un solo bucle para todos los retratos animados que se ven
  ========================================================================= */
  const registro = new Map();
  let bucle = 0, visibles = null;
  if (window.IntersectionObserver) visibles = new IntersectionObserver(es => es.forEach(e => { e.target.__fvis = e.isIntersecting; }), { rootMargin: "80px" });

  function animar(canvas, s, o) {
    o = Object.assign({}, o, { anim: true });
    o.t0 = performance.now();
    dibujar(canvas, s, Object.assign({}, o, { t: 0 }));
    if (REDUCIDO) return;
    registro.set(canvas, { s, o });
    canvas.__fvis = true;
    if (visibles) visibles.observe(canvas);
    if (!bucle) bucle = requestAnimationFrame(paso);
  }
  let ultimo = 0;
  function paso(ahora) {
    bucle = 0;
    if (!registro.size) return;
    if (ahora - ultimo >= 55) {
      ultimo = ahora;
      registro.forEach((v, canvas) => {
        if (!canvas.isConnected) { registro.delete(canvas); if (visibles) visibles.unobserve(canvas); return; }
        if (canvas.__fvis === false) return;
        dibujar(canvas, v.s, Object.assign({}, v.o, { t: (ahora - v.o.t0) / 1000 }));
      });
    }
    bucle = requestAnimationFrame(paso);
  }

  /* Soldado de relleno para mostrar una clase y una facción sin tener a nadie (portadas) */
  function generico(clase, id, sexo) { return { id: String(id), clase, sexo: sexo || "m", origen: "voluntario", nacimiento: -22, victorias: 0, cicatrices: 0, estado: "activo" }; }

  return { dibujar, animar, generico };
})();
