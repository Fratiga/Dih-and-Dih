/* =============================================================================
   LA FRACTURA: retratos de los soldados, en estilo de fantasía oscura. Un busto por soldado dibujado en
   canvas: la silueta (yelmo, capucha, máscara, calavera, corona) sale de su clase, los colores de su
   facción, y el metal, el penacho, las cicatrices y el pelaje de su id (siempre el mismo). Casi nadie
   enseña la cara: ojos encendidos en la sombra. Los animados respiran, sus ojos brillan y suben brasas.
   Uso: FracturaRetratos.dibujar(canvas, soldado, { faccion, herido, w }) / animar(...) / generico(...)
============================================================================= */
window.FracturaRetratos = (function () {
  "use strict";
  const D = window.FRACTURA_DATOS;
  const FACCIONES = D.FACCIONES, RANGOS = D.RANGOS;
  const REDUCIDO = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const W = 300, H = 380;
/* ---------- colores ---------- */
const nn = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => { const x = nn(a), y = nn(b); return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
const osc = (c, t) => mix(c, "#000000", t), cla = (c, t) => mix(c, "#ffffff", t);
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }


/* ---------- pinceles ---------- */
const P2 = d => new Path2D(d);
function relleno(c, d, fill, trazo, lw) { const p = P2(d); c.fillStyle = fill; c.fill(p); if (trazo) { c.strokeStyle = trazo; c.lineWidth = lw || 1.5; c.lineJoin = "round"; c.stroke(p); } }
function metal(c, x0, y0, x1, y1, base) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, cla(base, 0.32)); g.addColorStop(0.3, base); g.addColorStop(0.55, osc(base, 0.5)); g.addColorStop(0.78, mix(base, "#000000", 0.18)); g.addColorStop(1, osc(base, 0.78));
  return g;
}
function cuero(c, x0, y0, x1, y1, base) { const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, cla(base, 0.12)); g.addColorStop(0.5, base); g.addColorStop(1, osc(base, 0.6)); return g; }
function linea(c, col, w, x1, y1, x2, y2) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
function disco(c, col, x, y, r) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
const NEGRO = "#050405";
function ojo(S, x, y, rx, ry, col) { const k = S.k || 1, ky = S.ky || 1; S.ojos.push({ x: 150 + (x - 150) * k, y: 226 + (y - 226) * ky, rx: rx * Math.min(k, 1.15), ry: ry * ky, col: S.ojoOrigen || col || S.ojoCol }); }
/* cuánto se ensancha cada cabeza (se dibujó angosta): más los yelmos y la calavera, menos lo que ya tiene vuelo */
const ANCHO = { paladin: 1.24, caballero: 1.22, guerrero: 1.22, ballestero: 1.2, lider: 1.22, esqueleto: 1.06, mercenario: 1.18, picaro: 1.14, cazador: 1.12, salvaje: 1.14, arcanista: 1.08, sanador: 1.1, eco: 1.1, archimago: 1.1 };
/* alto de la cabeza (los yelmos se achatan un poco para que no parezcan cajas altas) y ancho del cuerpo: los hombros llegan casi al borde */
const ALTO = { paladin: 0.92, caballero: 0.94, guerrero: 0.94, ballestero: 0.94, lider: 0.94, mercenario: 0.97 };
const CUERPO_ANCHO = { paladin: 1.3, caballero: 1.3, guerrero: 1.28, ballestero: 1.26, lider: 1.22, mercenario: 1.24, cazador: 1.2, picaro: 1.2, salvaje: 1.14, esqueleto: 1.0, arcanista: 1.1, archimago: 1.1, sanador: 1.1, eco: 1.1 };
/* filo de luz: línea fina clara sobre el borde de una pieza */
function filo(c, d, col, lw) { c.strokeStyle = col || "rgba(255,244,214,.35)"; c.lineWidth = lw || 1.2; c.lineCap = "round"; c.stroke(P2(d)); }

/* ---------- fondo ---------- */
function escena(c, S) {
  const g = c.createRadialGradient(150, 130, 10, 150, 170, 320);
  g.addColorStop(0, mix(S.col, "#000000", 0.58)); g.addColorStop(0.55, mix(S.col, "#000000", 0.88)); g.addColorStop(1, "#030203");
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const grupo = S.grupo, oscuro = "#07060a";
  c.fillStyle = oscuro;
  if (grupo === "ruinas") {
    c.fillRect(0, 300, W, 80);
    relleno(c, "M0 300 L0 190 Q30 150 60 190 L60 300 Z M240 300 L240 170 Q270 120 300 170 L300 300 Z", "#0a090c");
    relleno(c, "M70 300 L70 230 L100 230 L100 300 Z M196 300 L196 215 L226 215 L226 300 Z", "#08070a");
    relleno(c, "M62 70 L66 70 L66 300 L62 300 Z", "#1a1410");
    relleno(c, "M66 74 L112 82 L104 104 L112 128 L66 118 Z", mix(S.ban, "#000000", 0.35));
  } else if (grupo === "bosque") {
    for (let i = 0; i < 9; i++) { const x = 10 + i * 36 + (i % 2) * 8, h = 120 + (i * 53) % 80; relleno(c, `M${x} 330 L${x + 22} ${330 - h} L${x + 44} 330 Z`, i % 2 ? "#07090a" : "#0a0c0c"); }
    c.fillStyle = "rgba(210,220,205,.10)"; c.beginPath(); c.arc(235, 70, 24, 0, 7); c.fill(); c.fillStyle = "rgba(210,220,205,.06)"; c.beginPath(); c.arc(235, 70, 36, 0, 7); c.fill();
  } else if (grupo === "arcano") {
    c.fillStyle = "rgba(190,175,255,.07)"; c.beginPath(); c.arc(150, 130, 120, 0, 7); c.fill(); c.fillStyle = "rgba(190,175,255,.05)"; c.beginPath(); c.arc(150, 130, 150, 0, 7); c.fill();
    relleno(c, "M30 340 L48 170 L66 340 Z M236 340 L258 120 L280 340 Z M84 340 L96 230 L108 340 Z", "#0b0a12");
    const r = S.r; c.fillStyle = "rgba(200,190,255,.55)"; for (let i = 0; i < 22; i++) { c.beginPath(); c.arc(r() * W, r() * 260, 0.6 + r() * 1.2, 0, 7); c.fill(); }
  } else {
    relleno(c, "M0 380 L0 150 Q20 120 38 150 L50 380 Z M262 380 L274 140 Q290 110 300 150 L300 380 Z", "#08070a");
    c.strokeStyle = "#0b0a0c"; c.lineWidth = 7; c.lineCap = "round"; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(20 + i * 60, 380); c.quadraticCurveTo(40 + i * 60, 250, 20 + i * 60 + (i % 2 ? 40 : -30), 170); c.stroke(); }
  }
  // haz de luz de lado
  const hz = c.createLinearGradient(0, 0, 260, 300);
  hz.addColorStop(0, "rgba(255,230,180,.13)"); hz.addColorStop(1, "rgba(255,230,180,0)");
  c.fillStyle = hz; c.beginPath(); c.moveTo(0, 0); c.lineTo(120, 0); c.lineTo(300, 320); c.lineTo(190, 380); c.lineTo(0, 120); c.closePath(); c.fill();
}

/* ---------- cuerpos ---------- */
function hombrerasPlaca(c, S, base, pesadas) {
  const m = metal(c, 40, 200, 260, 380, base), m2 = metal(c, 260, 200, 40, 380, base);
  relleno(c, "M96 232 L150 266 L204 232 L214 380 L86 380 Z", metal(c, 90, 230, 210, 380, osc(base, 0.1)), "#0c0c0f", 2);
  relleno(c, `M${pesadas ? 28 : 44} 270 C${pesadas ? 26 : 42} ${pesadas ? 196 : 210} 94 196 112 240 L102 336 L${pesadas ? 22 : 34} 316 Z`, m, "#0b0b0e", 2);
  relleno(c, `M${pesadas ? 272 : 256} 270 C${pesadas ? 274 : 258} ${pesadas ? 196 : 210} 206 196 188 240 L198 336 L${pesadas ? 278 : 266} 316 Z`, m2, "#0b0b0e", 2);
  filo(c, `M${pesadas ? 34 : 50} 262 C ${pesadas ? 40 : 56} 214 92 208 108 242`, "rgba(255,244,214,.4)");
  filo(c, `M${pesadas ? 266 : 250} 262 C ${pesadas ? 260 : 244} 214 208 208 192 242`, "rgba(255,244,214,.18)");
  c.strokeStyle = S.oro; c.lineWidth = 2.2; c.stroke(P2("M104 240 L104 330")); c.stroke(P2("M196 240 L196 330"));
  linea(c, "#0c0c0f", 3, 150, 266, 150, 380);
  [[120, 316], [180, 316], [126, 346], [174, 346]].forEach(p => disco(c, S.oro, p[0], p[1], 2.4));
  // rasguños
  c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 1.6; c.stroke(P2(`M${pesadas ? 52 : 60} 262 l22 24 M${pesadas ? 60 : 68} 258 l16 18`));
}
function tabardo(c, S, ancho) {
  const a = ancho || 22;
  relleno(c, `M${150 - a} 262 L${150 + a} 262 L${156 + a} 380 L${144 - a} 380 Z`, cuero(c, 0, 262, 0, 380, mix(S.ban, "#000000", 0.2)), "#120505", 1.5);
  c.strokeStyle = S.oro; c.lineWidth = 1.4; c.stroke(P2(`M${150 - a + 4} 270 L${150 - a + 6} 380 M${150 + a - 4} 270 L${150 + a - 2} 380`));
}
function cuerpoCuero(c, S, base) {
  relleno(c, "M52 262 Q150 226 248 262 L270 380 L30 380 Z", cuero(c, 40, 230, 260, 380, base), "#0a0705", 2);
  relleno(c, "M92 246 L150 268 L208 246 L218 380 L82 380 Z", cuero(c, 80, 240, 220, 380, osc(base, 0.3)), "#0a0705", 2);
  linea(c, osc(base, 0.7), 9, 70, 258, 226, 346); linea(c, "rgba(255,230,180,.12)", 1.5, 70, 253, 226, 341);
  disco(c, S.oro, 146, 296, 6.5); disco(c, osc(S.oro, 0.5), 146, 296, 3);
  filo(c, "M52 262 Q150 226 248 262", "rgba(255,244,214,.18)");
}
function cuerpoTunica(c, S, base, pliegues) {
  relleno(c, "M64 256 Q150 232 236 256 L274 380 L26 380 Z", cuero(c, 40, 230, 260, 380, base), "#08070a", 2);
  relleno(c, "M110 252 L150 300 L190 252 L204 380 L96 380 Z", cuero(c, 90, 250, 210, 380, osc(base, 0.35)), null);
  c.strokeStyle = "rgba(0,0,0,.45)"; c.lineWidth = 2; for (let i = 0; i < pliegues; i++) { const x = 56 + i * (190 / pliegues); c.beginPath(); c.moveTo(x, 270); c.lineTo(x - 8 + (i % 2) * 10, 380); c.stroke(); }
  linea(c, S.oro, 2, 112, 252, 150, 300); linea(c, S.oro, 2, 188, 252, 150, 300);
  relleno(c, "M150 296 L158 308 L150 322 L142 308 Z", S.oro, "#000", 1);
}
function cuerpoPiel(c, S, base) {
  relleno(c, "M44 270 C44 214 100 198 150 226 C200 198 256 214 256 270 L274 380 L26 380 Z", cuero(c, 40, 210, 260, 380, base), "#070506", 2);
  c.fillStyle = cla(base, 0.16); for (let i = 0; i < 18; i++) { const x = 46 + i * 12; c.beginPath(); c.moveTo(x, 232 + Math.abs(i - 9) * 3.5); c.lineTo(x + 6, 252 + Math.abs(i - 9) * 3.5); c.lineTo(x + 12, 232 + Math.abs(i - 9) * 3.5); c.fill(); }
}
function cuerpoHueso(c, S) {
  const carne = "#7a8670", hueso = "#d6cdb4", tela = mix(S.ban, "#08080a", 0.45), tela2 = mix(S.ban, "#08080a", 0.62);
  // capa hecha jirones, con el borde roto
  relleno(c, "M14 380 L24 292 C50 254 100 244 150 250 C200 244 250 254 276 292 L286 380 L268 358 L252 380 L234 354 L216 380 L198 356 L182 380 L150 360 L118 380 L102 356 L84 380 L66 354 L48 380 L32 358 Z", cuero(c, 20, 250, 280, 380, tela), "#050506", 2);
  linea(c, "rgba(0,0,0,.45)", 1.6, 60, 290, 52, 372); linea(c, "rgba(0,0,0,.45)", 1.6, 240, 290, 250, 372);
  // pecho: la túnica se abre y deja ver la carne gris y las costillas
  relleno(c, "M112 262 Q150 254 188 262 L180 380 L120 380 Z", metal(c, 112, 254, 188, 380, carne), "#0b0d09", 1.5);
  c.save(); c.beginPath(); c.moveTo(112, 262); c.quadraticCurveTo(150, 254, 188, 262); c.lineTo(180, 380); c.lineTo(120, 380); c.closePath(); c.clip();
  c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(150, 250, 50, 140);
  for (let i = 0; i < 5; i++) {
    const y = 276 + i * 20;
    c.strokeStyle = "rgba(0,0,0,.55)"; c.lineWidth = 6; c.beginPath(); c.moveTo(150, y - 4); c.quadraticCurveTo(122, y - 8, 112, y + 14); c.moveTo(150, y - 4); c.quadraticCurveTo(178, y - 8, 188, y + 14); c.stroke();
    c.strokeStyle = hueso; c.lineWidth = 3.6; c.beginPath(); c.moveTo(150, y - 4); c.quadraticCurveTo(122, y - 8, 112, y + 14); c.moveTo(150, y - 4); c.quadraticCurveTo(178, y - 8, 188, y + 14); c.stroke();
  }
  linea(c, hueso, 4.5, 150, 262, 150, 380);
  c.restore();
  // paneles de la túnica, rasgados en el borde
  relleno(c, "M70 270 L112 262 L120 380 L58 380 L66 340 L60 312 Z", cuero(c, 60, 262, 120, 380, tela2), "#050506", 1.6);
  relleno(c, "M230 270 L188 262 L180 380 L242 380 L234 340 L240 312 Z", cuero(c, 240, 262, 180, 380, tela2), "#050506", 1.6);
  linea(c, "rgba(0,0,0,.5)", 1.4, 92, 272, 86, 372); linea(c, "rgba(0,0,0,.5)", 1.4, 208, 272, 214, 372);
  // cuello flaco con tendones y una venda sucia
  relleno(c, "M132 226 L168 226 L176 268 L124 268 Z", metal(c, 124, 226, 176, 268, carne), "#0b0d09", 1.5);
  linea(c, "rgba(0,0,0,.4)", 2, 140, 232, 136, 264); linea(c, "rgba(0,0,0,.4)", 2, 160, 232, 164, 264);
  relleno(c, "M126 246 L174 242 L175 252 L125 256 Z", "#b8ad92", "#2a251c", 1); relleno(c, "M128 258 L176 256 L174 264 L127 267 Z", "#a79c82", "#2a251c", 1);
  // clavículas que asoman
  c.strokeStyle = hueso; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(148, 270); c.quadraticCurveTo(118, 262, 92, 278); c.moveTo(152, 270); c.quadraticCurveTo(182, 262, 208, 278); c.stroke();
  // hombro izquierdo: hombrera oxidada con pinchos
  relleno(c, "M28 318 C24 270 78 246 116 280 L102 336 L34 336 Z", metal(c, 28, 250, 116, 336, "#6b5240"), "#0a0705", 2.2);
  [[48, 276, 40, 244, 62, 270], [74, 262, 72, 232, 92, 266]].forEach(p => relleno(c, `M${p[0]} ${p[1]} L${p[2]} ${p[3]} L${p[4]} ${p[5]} Z`, metal(c, p[2], p[3], p[4], p[5], "#8a6a52"), "#0a0705", 1.2));
  linea(c, "#9a4a22", 1.8, 44, 300, 62, 318); linea(c, "rgba(255,230,190,.25)", 1.2, 40, 292, 70, 268);
  [[52, 316], [84, 322]].forEach(p => disco(c, "#b3a58a", p[0], p[1], 2.2));
  // hombro derecho: sin armadura, carne gris y hueso a la vista
  relleno(c, "M272 316 C276 272 226 250 188 282 L200 330 L266 330 Z", metal(c, 188, 250, 272, 330, carne), "#0b0d09", 2);
  linea(c, "rgba(0,0,0,.4)", 1.6, 214, 296, 232, 314); linea(c, "rgba(214,205,180,.55)", 2.2, 236, 300, 252, 318);
  linea(c, "rgba(0,0,0,.4)", 1.6, 230, 318, 240, 332);
}

/* ---------- cabezas: cada una ocupa una silueta distinta, sin cara humana entera ---------- */
const CABEZA = {
  paladin(c, S) {
    const a = S.acero;
    relleno(c, "M106 100 Q106 60 150 56 Q194 60 194 100 L194 194 Q194 216 150 224 Q106 216 106 194 Z", metal(c, 100, 60, 200, 224, a), "#09090b", 2.5);
    relleno(c, "M106 112 L194 112 L194 124 L106 124 Z", S.oro, "#3a2a06", 1);
    relleno(c, "M112 134 L188 134 L188 146 L112 146 Z", NEGRO); relleno(c, "M144 134 L156 134 L156 188 L144 188 Z", NEGRO);
    [[172, 168], [178, 176], [172, 184], [178, 192]].forEach(p => disco(c, NEGRO, p[0], p[1], 2));
    ojo(S, 130, 140, 8, 2.6); ojo(S, 170, 140, 8, 2.6);
    filo(c, "M112 100 Q112 66 150 62", "rgba(255,244,214,.45)", 1.6);
    relleno(c, "M150 58 C120 18 86 20 64 42 C98 38 122 52 138 74 Z", cuero(c, 60, 20, 150, 70, S.ban), "#120406", 1.5);
  },
  caballero(c, S) {
    const a = S.acero;
    relleno(c, "M108 136 Q108 54 150 50 Q192 54 192 136 Z", metal(c, 100, 50, 200, 140, a), "#09090b", 2.5);
    relleno(c, "M106 128 L194 128 L184 188 L150 238 L116 188 Z", metal(c, 106, 128, 194, 238, osc(a, 0.12)), "#09090b", 2.5);
    linea(c, "rgba(0,0,0,.6)", 2.5, 150, 56, 150, 236); linea(c, "rgba(255,244,214,.3)", 1, 152, 62, 152, 226);
    relleno(c, "M120 142 L144 150 L144 158 L122 154 Z M180 142 L156 150 L156 158 L178 154 Z", NEGRO);
    [[166, 176], [170, 188], [166, 200], [162, 212]].forEach(p => disco(c, NEGRO, p[0], p[1], 1.8));
    ojo(S, 132, 152, 8, 2.4); ojo(S, 168, 152, 8, 2.4);
    relleno(c, "M110 120 L190 120 L192 132 L108 132 Z", S.oro, "#2c2006", 1);
    relleno(c, "M150 50 C136 4 176 -18 222 2 C192 12 180 34 170 56 Z", cuero(c, 140, 0, 220, 50, S.ban), "#120406", 1.5);
  },
  guerrero(c, S) {
    const a = S.acero;
    relleno(c, "M104 164 L196 164 L208 238 Q150 266 92 238 Z", cuero(c, 90, 164, 210, 250, "#3a3e44"), "#08080a", 2);
    c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(100 + i * 4, 176 + i * 11); c.lineTo(200 - i * 4, 176 + i * 11); c.stroke(); }
    relleno(c, "M118 150 L182 150 L176 208 Q150 228 124 208 Z", "#0a0807");
    ojo(S, 136, 160, 6, 2.2); ojo(S, 164, 160, 6, 2.2);
    relleno(c, "M146 150 L154 150 L153 214 L147 214 Z", metal(c, 140, 150, 160, 214, a), "#08080a", 1);
    relleno(c, "M104 158 Q102 66 150 62 Q198 66 196 158 L196 172 L104 172 Z", metal(c, 98, 60, 202, 174, a), "#08080a", 2.5);
    relleno(c, "M104 148 L196 148 L196 162 L104 162 Z", S.oro, "#2c2006", 1);
    filo(c, "M110 150 Q110 74 150 68", "rgba(255,244,214,.45)", 1.6);
    disco(c, osc(S.oro, 0.4), 116, 155, 2.2); disco(c, osc(S.oro, 0.4), 184, 155, 2.2);
  },
  cazador(c, S) {
    relleno(c, "M88 226 C74 120 116 66 150 14 C184 66 226 120 212 226 C190 252 110 252 88 226 Z", cuero(c, 80, 20, 220, 250, mix(S.ban, "#1a140e", 0.55)), "#080605", 2.5);
    relleno(c, "M110 210 C102 130 126 94 150 72 C174 94 198 130 190 210 Q150 232 110 210 Z", "#060505");
    relleno(c, "M130 118 Q150 100 170 118 L162 158 L150 222 L138 158 Z", metal(c, 130, 100, 170, 222, "#d9d0b8"), "#1a1408", 1.5);
    linea(c, "rgba(0,0,0,.5)", 1.5, 150, 108, 150, 218);
    relleno(c, "M134 124 a7 8 0 1 0 0.1 0 Z", NEGRO); relleno(c, "M166 124 a7 8 0 1 0 0.1 0 Z", NEGRO);
    ojo(S, 135, 128, 4, 4); ojo(S, 165, 128, 4, 4);
    for (let i = 0; i < 3; i++) relleno(c, `M${84 - i * 8} ${70 + i * 22} C${70 - i * 8} ${96 + i * 22} ${74 - i * 8} ${128 + i * 22} ${96} ${150 + i * 18} C${92 - i * 4} ${124 + i * 20} ${90 - i * 4} ${96 + i * 20} ${84 - i * 8} ${70 + i * 22} Z`, i === 1 ? S.ban : "#17130e", "#050403", 1);
    filo(c, "M120 90 C130 60 142 40 150 22", "rgba(255,244,214,.22)", 1.4);
  },
  arcanista(c, S) {
    c.strokeStyle = "rgba(170,150,255,.35)"; c.lineWidth = 1.4; c.beginPath(); c.arc(150, 150, 104, 0, 7); c.stroke();
    c.setLineDash([2, 9]); c.strokeStyle = "rgba(170,150,255,.5)"; c.lineWidth = 3; c.beginPath(); c.arc(150, 150, 114, 0, 7); c.stroke(); c.setLineDash([]);
    relleno(c, "M84 230 C80 124 118 72 150 10 C182 72 220 124 216 230 C190 256 110 256 84 230 Z", cuero(c, 80, 10, 220, 250, mix(S.ban, "#0c0a14", 0.3)), "#060509", 2.5);
    relleno(c, "M112 208 C106 130 130 98 150 84 C170 98 194 130 188 208 Q150 230 112 208 Z", "#030208");
    ojo(S, 136, 152, 7, 2.6, "#8fe8ff"); ojo(S, 164, 152, 7, 2.6, "#8fe8ff");
    filo(c, "M96 200 C94 130 122 84 150 24", "rgba(200,190,255,.3)", 1.5);
    relleno(c, "M150 40 L154 46 L150 52 L146 46 Z", "#cfc6ff", null);
  },
  picaro(c, S) {
    relleno(c, "M86 224 C82 114 116 74 150 70 C184 74 218 114 214 224 Q150 254 86 224 Z", cuero(c, 80, 70, 220, 250, "#18221b"), "#030504", 2.5);
    relleno(c, "M114 132 L186 132 L184 160 L116 160 Z", "#2a2018");
    relleno(c, "M108 150 L192 150 L184 214 L150 240 L116 214 Z", cuero(c, 108, 150, 192, 240, "#26301f"), "#050705", 2);
    linea(c, "#0c130e", 2, 150, 152, 150, 236);
    [[128, 172], [172, 172], [134, 198], [166, 198]].forEach(p => disco(c, "#6b7c6c", p[0], p[1], 2.1));
    relleno(c, "M110 126 L190 126 L186 138 L114 138 Z", "#030403");
    ojo(S, 135, 146, 6, 2.1, "#a8f0d6"); ojo(S, 165, 146, 6, 2.1, "#a8f0d6");
    filo(c, "M96 200 C94 120 122 84 150 78", "rgba(200,255,220,.18)", 1.4);
  },
  esqueleto(c, S) {
    const hueso = "#d6cdb4", carne = "#7a8670", tela = mix(S.ban, "#08080a", 0.35);
    // capucha rota: el borde de abajo y los costados son tiras de tela
    relleno(c, "M80 236 C70 150 94 90 150 36 C206 90 230 150 220 236 L210 252 L200 234 L190 256 L176 238 L164 258 L150 240 L136 258 L124 238 L110 256 L100 234 L90 252 Z", cuero(c, 80, 36, 220, 256, tela), "#050506", 2.5);
    relleno(c, "M74 214 L62 250 L84 230 Z M226 214 L240 252 L216 230 Z", tela, "#050506", 1.4);
    filo(c, "M92 190 C88 126 112 80 150 46", "rgba(255,244,214,.16)", 1.5);
    c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 1.6; c.beginPath(); c.moveTo(184, 70); c.lineTo(194, 120); c.moveTo(112, 86); c.lineTo(104, 128); c.stroke();
    // hueco oscuro de la capucha y la cara chupada dentro
    relleno(c, "M108 204 C100 130 122 94 150 76 C178 94 200 130 192 204 Q150 230 108 204 Z", "#040306");
    relleno(c, "M117 150 C117 108 183 108 183 150 C183 178 177 196 168 216 L132 216 C123 196 117 178 117 150 Z", metal(c, 117, 108, 183, 216, carne), "#0b0d09", 1.6);
    c.fillStyle = "rgba(0,0,0,.32)"; c.beginPath(); c.ellipse(127, 180, 8, 20, 0.15, 0, 7); c.fill(); c.beginPath(); c.ellipse(173, 180, 8, 20, -0.15, 0, 7); c.fill();
    // hueso a la vista: la frente rota y el pómulo derecho
    relleno(c, "M119 140 C121 114 142 108 156 112 L150 124 L142 130 L148 142 L132 148 Z", metal(c, 119, 110, 156, 148, hueso), "#1a1810", 1.2);
    linea(c, "#5c5546", 1.2, 128, 118, 140, 136); linea(c, "#5c5546", 1.2, 140, 128, 150, 132);
    relleno(c, "M170 176 L184 154 L184 196 L172 212 L166 198 Z", metal(c, 166, 154, 184, 212, hueso), "#1a1810", 1.2);
    // cuencas hundidas con el brillo enfermizo
    relleno(c, "M122 150 C122 134 150 132 152 152 C152 166 124 168 122 150 Z", "#030205");
    relleno(c, "M154 152 C156 136 180 136 180 152 C180 164 156 166 154 152 Z", "#030205");
    ojo(S, 136, 152, 6, 6, "#c9f25a"); ojo(S, 167, 153, 4.6, 4.8, "#c9f25a");
    linea(c, "#0b0d09", 3, 120, 138, 152, 144); linea(c, "#0b0d09", 3, 156, 144, 182, 138);
    // sin nariz: un hueco, y la boca abierta con la mandíbula colgando
    relleno(c, "M150 168 L142 188 L150 183 L158 188 Z", "#030205");
    relleno(c, "M130 198 Q150 192 170 198 L168 222 Q150 244 132 222 Z", "#030205");
    c.fillStyle = hueso; for (let i = 0; i < 6; i++) { c.fillRect(132 + i * 6.4, 198 + Math.abs(i - 2.5) * 0.6, 4.6, 8 - Math.abs(i - 2.5)); }
    relleno(c, "M130 224 Q150 256 170 224 L166 240 Q150 258 134 240 Z", metal(c, 130, 224, 170, 258, hueso), "#1a1810", 1.4);
    c.fillStyle = hueso; for (let i = 0; i < 4; i++) c.fillRect(137 + i * 7.5, 216, 4.2, 6);
    // cicatriz cosida en la mejilla
    linea(c, "#0b0d09", 1.6, 124, 172, 140, 190);
    for (let i = 0; i < 4; i++) linea(c, "#0b0d09", 1.3, 127 + i * 4.6 - 3, 176 + i * 4.8 + 2, 127 + i * 4.6 + 3, 176 + i * 4.8 - 2);
    // mechones ralos que se escapan de la capucha
    c.strokeStyle = "#9a948a"; c.lineWidth = 1.3; c.lineCap = "round";
    [[118, 134, 104, 168, 108, 206], [122, 128, 110, 160, 118, 196], [182, 138, 196, 170, 192, 204]].forEach(p => { c.beginPath(); c.moveTo(p[0], p[1]); c.quadraticCurveTo(p[2], p[3], p[4], p[5]); c.stroke(); });
    // los bordes de la capucha caen delante, sombreando la frente
    relleno(c, "M110 124 C112 100 134 84 150 80 C130 92 118 106 118 128 Z M190 124 C188 100 166 84 150 80 C170 92 182 106 182 128 Z", tela, "#050506", 1);
    relleno(c, "M114 118 Q150 94 186 118 L186 104 Q150 78 114 104 Z", "rgba(0,0,0,.55)");
  },
  archimago(c, S) {
    relleno(c, "M112 118 C112 108 188 108 188 118 L186 196 C172 220 128 220 114 196 Z", "#040307");
    ojo(S, 136, 150, 6, 2.2, "#d6e8ff"); ojo(S, 164, 150, 6, 2.2, "#d6e8ff");
    relleno(c, "M110 176 C106 232 128 292 150 334 C172 292 194 232 190 176 C172 202 128 202 110 176 Z", metal(c, 110, 176, 190, 334, "#e6e2da"), "#1a1814", 1.5);
    c.strokeStyle = "rgba(0,0,0,.2)"; c.lineWidth = 1; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(126 + i * 9, 196 + (i % 2) * 6); c.lineTo(146 + (i - 3) * 2, 300 - Math.abs(i - 2.5) * 8); c.stroke(); }
    relleno(c, "M42 116 C60 98 240 98 258 116 C240 140 60 140 42 116 Z", cuero(c, 40, 98, 260, 140, mix(S.ban, "#0b0914", 0.45)), "#050408", 2);
    relleno(c, "M94 112 C108 74 128 38 164 -14 C184 8 196 28 182 52 C200 72 208 92 206 112 Z", cuero(c, 90, -10, 210, 112, mix(S.ban, "#0b0914", 0.4)), "#050408", 2);
    relleno(c, "M96 104 L204 104 L206 116 L94 116 Z", S.oro, "#2c2006", 1);
    [[150, 60], [166, 30], [136, 84]].forEach(p => relleno(c, `M${p[0]} ${p[1] - 5} L${p[0] + 3} ${p[1]} L${p[0]} ${p[1] + 5} L${p[0] - 3} ${p[1]} Z`, S.oro));
  },
  ballestero(c, S) {
    const a = S.acero;
    relleno(c, "M98 156 C98 70 202 70 202 156 L210 200 L194 238 L150 248 L106 238 L90 200 Z", metal(c, 90, 70, 210, 248, a), "#08080a", 2.5);
    relleno(c, "M110 142 L190 142 L190 156 L110 156 Z", NEGRO); ojo(S, 134, 149, 7, 2, "#ffcf6a"); ojo(S, 166, 149, 7, 2, "#ffcf6a");
    linea(c, "rgba(0,0,0,.55)", 2, 150, 160, 150, 244); for (let i = 0; i < 4; i++) linea(c, "rgba(0,0,0,.4)", 1.6, 112 + i * 4, 176 + i * 14, 188 - i * 4, 176 + i * 14);
    relleno(c, "M92 140 L208 140 L214 152 L86 152 Z", S.oro, "#2c2006", 1);
    filo(c, "M108 138 C106 82 146 74 150 74", "rgba(255,244,214,.4)", 1.6);
  },
  mercenario(c, S) {
    // capucha de cuero ajustada que cae sobre el cuello
    relleno(c, "M92 158 C90 82 118 62 150 62 C182 62 210 82 208 158 C210 190 214 208 218 226 Q150 262 82 226 C86 208 90 190 92 158 Z", cuero(c, 88, 62, 212, 250, "#4a3422"), "#0a0705", 2.5);
    filo(c, "M100 150 C98 90 122 70 150 68", "rgba(255,230,190,.3)", 1.5);
    // el trozo de cara que queda a la vista: un óvalo bajo el pañuelo
    relleno(c, "M108 146 C108 118 192 118 192 146 C192 172 174 182 150 182 C126 182 108 172 108 146 Z", cuero(c, 108, 118, 192, 184, "#5a3d2c"), "#150c07", 1.5);
    // ojo izquierdo con ceja y cicatriz; el derecho tapado por un parche redondo con su correa
    relleno(c, "M117 140 Q132 134 146 141 Q132 150 117 144 Z", "#0a0705"); ojo(S, 132, 142, 6, 2.2, "#ffd24a");
    linea(c, "#2a1810", 3, 116, 132, 146, 134);
    linea(c, "#b0584c", 1.8, 122, 128, 134, 158); linea(c, "rgba(0,0,0,.5)", 0.8, 124, 128, 136, 158);
    c.strokeStyle = "#140d0a"; c.lineWidth = 2.2; c.beginPath(); c.moveTo(108, 124); c.quadraticCurveTo(150, 118, 192, 132); c.stroke();
    c.fillStyle = "#090606"; c.beginPath(); c.ellipse(168, 144, 15, 13, 0.25, 0, 7); c.fill();
    c.strokeStyle = "rgba(255,230,190,.14)"; c.lineWidth = 1; c.beginPath(); c.ellipse(168, 144, 15, 13, 0.25, Math.PI * 1.1, Math.PI * 1.7); c.stroke();
    // pañuelo sobre nariz y boca
    relleno(c, "M104 166 C124 156 176 156 196 166 C196 190 190 212 184 226 Q150 246 116 226 C110 212 104 190 104 166 Z", cuero(c, 104, 156, 196, 244, "#2e2622"), "#080605", 2);
    c.strokeStyle = "rgba(0,0,0,.5)"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(122, 172); c.quadraticCurveTo(150, 186, 178, 172); c.stroke();
    c.beginPath(); c.moveTo(130, 200); c.quadraticCurveTo(150, 210, 170, 200); c.stroke();
    // pañuelo de cabeza rojo, siguiendo la curva del cráneo, con el nudo cayendo a un lado
    relleno(c, "M90 126 C104 90 196 90 210 126 L208 140 C190 122 110 122 92 140 Z", cuero(c, 90, 90, 210, 140, "#9a2e26"), "#1a0505", 1.5);
    filo(c, "M100 112 C120 98 180 98 200 112", "rgba(255,200,180,.3)", 1.3);
    relleno(c, "M96 128 C80 128 66 138 60 156 C76 152 88 150 100 142 Z", "#7a2019", "#1a0505", 1.2);
    relleno(c, "M98 132 C90 150 86 166 90 180 C98 168 104 154 106 138 Z", "#7a2019", "#1a0505", 1.2);
  },
  sanador(c, S) {
    c.strokeStyle = "rgba(240,210,120,.5)"; c.lineWidth = 2; c.beginPath(); c.arc(150, 142, 100, 0, 7); c.stroke();
    relleno(c, "M88 228 C82 112 118 60 150 52 C182 60 218 112 212 228 Q150 256 88 228 Z", cuero(c, 80, 50, 220, 250, "#d9d2c0"), "#1c1810", 2.5);
    relleno(c, "M124 108 Q150 88 176 108 L174 170 Q150 218 126 170 Z", metal(c, 124, 90, 176, 214, "#d6b25a"), "#2a1f08", 1.5);
    relleno(c, "M132 138 Q142 132 146 142 Q140 148 132 144 Z M168 138 Q158 132 154 142 Q160 148 168 144 Z", "#150f06");
    ojo(S, 139, 141, 3, 1.4, "#ffe9a6"); ojo(S, 161, 141, 3, 1.4, "#ffe9a6");
    linea(c, "#2a1f08", 1.4, 150, 148, 148, 168); relleno(c, "M142 182 Q150 187 158 182 Q150 190 142 182 Z", "#4a2e0a");
    disco(c, S.ban, 150, 112, 3);
    filo(c, "M98 200 C94 124 124 72 150 60", "rgba(255,255,255,.35)", 1.5);
  },
  eco(c, S) {
    c.save(); c.globalAlpha = 0.72;
    relleno(c, "M88 228 C82 116 118 64 150 56 C182 64 218 116 212 228 C196 250 176 238 160 256 C146 244 126 262 110 244 C100 244 92 238 88 228 Z", cuero(c, 80, 56, 220, 260, "#8fb8c8"), "rgba(200,240,255,.4)", 1.5);
    relleno(c, "M112 206 C106 134 130 100 150 88 C170 100 194 134 188 206 Q150 226 112 206 Z", "#04141a");
    c.restore();
    ojo(S, 136, 152, 7, 3, "#e9fbff"); ojo(S, 164, 152, 7, 3, "#e9fbff");
    c.strokeStyle = "rgba(190,235,255,.35)"; c.lineWidth = 1.4; for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(150, 238, 60 + i * 24, 12 + i * 5, 0, 0, 7); c.stroke(); }
  },
  lider(c, S) {
    const a = S.acero;
    relleno(c, "M104 104 Q104 72 150 68 Q196 72 196 104 L196 196 Q196 218 150 226 Q104 218 104 196 Z", metal(c, 98, 70, 202, 226, a), "#09090b", 2.5);
    relleno(c, "M110 128 L190 128 L190 142 L110 142 Z", NEGRO); relleno(c, "M110 142 L124 142 L150 186 L176 142 L190 142 L152 196 L148 196 Z", NEGRO);
    ojo(S, 130, 135, 8, 2.4, "#ff5a3a"); ojo(S, 170, 135, 8, 2.4, "#ff5a3a");
    relleno(c, "M102 98 L198 98 L198 112 L102 112 Z", S.oro, "#2c2006", 1);
    relleno(c, "M102 98 L108 54 L124 88 L138 40 L150 84 L162 40 L176 88 L192 54 L198 98 Z", metal(c, 100, 40, 200, 100, S.oro), "#2c2006", 1.5);
    [[108, 54], [138, 40], [162, 40], [192, 54]].forEach(p => disco(c, S.ban, p[0], p[1] + 2, 2.4));
    relleno(c, "M104 96 C84 70 84 34 108 12 C98 40 106 66 118 84 Z M196 96 C216 70 216 34 192 12 C202 40 194 66 182 84 Z", metal(c, 80, 10, 220, 96, "#6b5a46"), "#0a0705", 1.5);
  },
  salvaje(c, S) {
    const pel = S.pelaje;
    relleno(c, "M104 98 L96 36 L142 76 Z M196 98 L204 36 L158 76 Z", osc(pel, 0.3), "#050304", 2);
    relleno(c, "M94 158 C88 88 120 62 150 62 C180 62 212 88 206 158 C202 202 178 236 150 244 C122 236 98 202 94 158 Z", cuero(c, 90, 62, 210, 244, pel), "#050304", 2.5);
    relleno(c, "M118 176 C118 160 182 160 182 176 C184 210 166 234 150 238 C134 234 116 210 118 176 Z", cuero(c, 118, 160, 182, 238, cla(pel, 0.18)), "#080506", 1.5);
    relleno(c, "M138 176 L162 176 L158 190 L142 190 Z", NEGRO);
    relleno(c, "M122 130 L144 142 L142 150 L120 138 Z M178 130 L156 142 L158 150 L180 138 Z", NEGRO);
    ojo(S, 133, 141, 8, 2.8, "#ffd24a"); ojo(S, 167, 141, 8, 2.8, "#ffd24a");
    relleno(c, "M128 214 L134 192 L140 214 Z M160 214 L166 192 L172 214 Z", "#efe6cf", "#0a0806", 1);
    linea(c, "rgba(0,0,0,.5)", 1.5, 150, 190, 150, 226);
    linea(c, "rgba(255,244,214,.14)", 1.2, 108, 120, 120, 90);
  }
};
const CUERPO = {
  guerrero(c, S) { cuerpoPiel(c, S, "#463a2e"); hombrerasPlaca(c, S, S.acero, false); },
  paladin(c, S) { hombrerasPlaca(c, S, S.acero, true); tabardo(c, S, 24); },
  caballero(c, S) { hombrerasPlaca(c, S, S.acero, true); tabardo(c, S, 14); },
  lider(c, S) { relleno(c, "M16 380 L28 250 C70 214 230 214 272 250 L284 380 Z", cuero(c, 20, 220, 280, 380, osc(S.ban, 0.2)), "#0a0305", 2); hombrerasPlaca(c, S, S.acero, true); cuerpoPielCuello(c, S); },
  cazador(c, S) { cuerpoCuero(c, S, "#4a3722"); },
  picaro(c, S) { cuerpoCuero(c, S, "#202a22"); relleno(c, "M108 262 L122 262 L126 308 L104 308 Z", metal(c, 104, 262, 126, 308, "#6a6e72"), "#050505", 1); relleno(c, "M178 262 L192 262 L196 308 L174 308 Z", metal(c, 174, 262, 196, 308, "#6a6e72"), "#050505", 1); },
  ballestero(c, S) { cuerpoCuero(c, S, "#3a3d33"); hombrerasPlaca(c, S, S.acero, false); },
  mercenario(c, S) { cuerpoCuero(c, S, "#4d3a28"); relleno(c, "M40 270 C38 224 88 214 106 244 L98 330 L32 312 Z", metal(c, 36, 214, 106, 330, S.acero), "#0a0a0c", 2); linea(c, "#8a2a24", 12, 64, 258, 232, 350); },
  arcanista(c, S) { cuerpoTunica(c, S, mix(S.ban, "#0c0a16", 0.25), 7); },
  archimago(c, S) { cuerpoTunica(c, S, mix(S.ban, "#0c0a16", 0.3), 9); },
  sanador(c, S) { cuerpoTunica(c, S, "#cfc8b4", 7); },
  eco(c, S) { c.save(); c.globalAlpha = 0.6; cuerpoTunica(c, S, "#7ea0b2", 6); c.restore(); },
  esqueleto(c, S) { cuerpoHueso(c, S); },
  salvaje(c, S) { cuerpoPiel(c, S, S.pelaje); }
};
function cuerpoPielCuello(c, S) { c.fillStyle = "#e8e2d0"; for (let i = 0; i < 9; i++) { const x = 70 + i * 20; c.beginPath(); c.moveTo(x, 236 + Math.abs(i - 4) * 4); c.lineTo(x + 10, 262 + Math.abs(i - 4) * 4); c.lineTo(x + 20, 236 + Math.abs(i - 4) * 4); c.fill(); } }

const GRUPO = { guerrero: "ruinas", caballero: "ruinas", paladin: "ruinas", lider: "ruinas", mercenario: "ruinas", ballestero: "ruinas", cazador: "bosque", picaro: "bosque", salvaje: "bosque", arcanista: "arcano", archimago: "arcano", sanador: "arcano", eco: "arcano", esqueleto: "cripta" };
const ACEROS = ["#8a939e", "#7b8791", "#8f8d86", "#6f7d7a", "#948873"];
const OJOS = { guerrero: "#e6b04a", paladin: "#ffd27a", caballero: "#ffb84a" };


  /* =========================================================================
     UN RETRATO. Tres capas: fondo, figura (respira) y velo final (viñeta, grano, marco, galones y cinta).
     Entre la figura y el velo se pintan lo que se mueve: niebla, ojos encendidos y brasas.
  ========================================================================= */
  const RANGO_COL = ["#5b4660", "#8f8498", "#c4c9d2", "#e0b24c", "#f0cf6a"];
  const OJO_ORIGEN = { eco: "#8fe8ff", criatura: "#a6e36a" };

  function construir(canvas, s, o) {
    const wpx = o.w || +canvas.dataset.w || 170;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.round(wpx * dpr), bh = Math.round(bw * H / W), esc = bw / W;
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
    const mk = () => { const k = document.createElement("canvas"); k.width = bw; k.height = bh; const x = k.getContext("2d"); x.setTransform(esc, 0, 0, esc, 0, 0); return [k, x]; };
    const [kb, cb] = mk(), [kf, cf] = mk(), [ko, co] = mk();
    const fac = FACCIONES[o.faccion] || FACCIONES[Object.keys(FACCIONES)[0]];
    const r = rng(hashStr(String(s.id)));
    const cl = CABEZA[s.clase] ? s.clase : "guerrero";
    const victorias = s.victorias || 0;
    let rango = 0; RANGOS.forEach((x, i) => { if (victorias >= x.desde) rango = i; });
    const S = {
      col: fac.color, ban: fac.bandera, oro: mix(fac.color, "#6b5010", 0.35), cl, grupo: GRUPO[cl] || "ruinas", ojos: [], r,
      ojoCol: OJOS[cl] || "#ffcf6a", ojoOrigen: s.reanimado ? "#c9f0c9" : OJO_ORIGEN[s.origen] || null,
      acero: ACEROS[Math.floor(r() * ACEROS.length)], pelaje: ["#4a3c40", "#5a4630", "#3c4650", "#5a3a30"][Math.floor(r() * 4)], fase: r() * 6
    };
    if (cl === "esqueleto") S.ban = "#4a3a30";
    escena(cb, S);
    const kcu = CUERPO_ANCHO[cl] || 1.2;
    cf.save(); cf.translate(150, 0); cf.scale(kcu, 1); cf.translate(-150, 0);
    (CUERPO[cl] || CUERPO.guerrero)(cf, S);
    cf.restore();
    S.k = ANCHO[cl] || 1.15; S.ky = ALTO[cl] || 1;
    cf.save(); cf.translate(150, 226); cf.scale(S.k, S.ky); cf.translate(-150, -226);
    (CABEZA[cl] || CABEZA.guerrero)(cf, S);
    cf.restore();
    // cicatrices: marcas en el yelmo o la capucha
    const nCic = Math.min(4, s.cicatrices || 0);
    for (let i = 0; i < nCic; i++) {
      const x = 118 + r() * 64, y = 92 + r() * 90;
      cf.lineCap = "round"; cf.strokeStyle = "rgba(0,0,0,.55)"; cf.lineWidth = 1.8; cf.beginPath(); cf.moveTo(x, y); cf.lineTo(x + 14, y + 18); cf.stroke();
      cf.strokeStyle = "rgba(255,240,210,.35)"; cf.lineWidth = 0.8; cf.beginPath(); cf.moveTo(x + 1.5, y); cf.lineTo(x + 15.5, y + 18); cf.stroke();
    }
    // herido: un trapo blanco cruzado sobre el pecho con la sangre calada
    if (o.herido) {
      relleno(cf, "M58 262 L108 250 L150 300 L128 322 Z", "#d9d2bf", "#2a241a", 1.4);
      cf.strokeStyle = "rgba(0,0,0,.25)"; cf.lineWidth = 1; cf.beginPath(); cf.moveTo(70, 266); cf.lineTo(132, 314); cf.moveTo(84, 258); cf.lineTo(142, 306); cf.stroke();
      cf.fillStyle = "#7a1212"; cf.beginPath(); cf.ellipse(112, 292, 9, 12, 0.6, 0, 7); cf.fill();
      cf.fillStyle = "rgba(122,18,18,.5)"; cf.beginPath(); cf.ellipse(120, 312, 4, 10, 0.4, 0, 7); cf.fill();
    }
    // luto: brazalete negro con hilo dorado sobre el hombro
    if (s.luto) {
      relleno(cf, "M16 300 L74 272 L82 294 L22 324 Z", "#0d0b0e", "#000", 1);
      cf.strokeStyle = S.oro; cf.lineWidth = 1.4; cf.beginPath(); cf.moveTo(22, 306); cf.lineTo(76, 280); cf.stroke();
    }
    // velo final: viñeta, grano, marco con el color del rango, galones y cinta de capitán
    const vg = co.createRadialGradient(150, 170, 90, 150, 190, 270); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.82)");
    co.fillStyle = vg; co.fillRect(0, 0, W, H);
    co.fillStyle = "rgba(255,255,255,.035)"; for (let i = 0; i < 1100; i++) co.fillRect(r() * W, r() * H, 1, 1);
    const colMarco = rango >= 3 ? RANGO_COL[rango] : fac.color;
    co.strokeStyle = colMarco; co.globalAlpha = rango >= 3 ? 0.85 : 0.42; co.lineWidth = rango >= 3 ? 2.6 : 1.5; co.strokeRect(5, 5, W - 10, H - 10);
    co.globalAlpha = rango >= 4 ? 0.7 : 0.18; co.lineWidth = 1; co.strokeRect(11, 11, W - 22, H - 22); co.globalAlpha = 1;
    if (rango >= 4) [[11, 11], [W - 11, 11], [11, H - 11], [W - 11, H - 11]].forEach(p => { co.fillStyle = RANGO_COL[4]; co.beginPath(); co.arc(p[0], p[1], 5, 0, 7); co.fill(); });
    co.strokeStyle = RANGO_COL[Math.max(2, rango)]; co.lineWidth = 5; co.lineCap = "round"; co.lineJoin = "round";
    for (let i = 0; i < rango; i++) { const y = H - 26 - i * 15; co.beginPath(); co.moveTo(22, y + 8); co.lineTo(40, y); co.lineTo(58, y + 8); co.stroke(); }
    if (s.capitan) {
      relleno(co, "M236 0 L284 0 L284 76 L260 62 L236 76 Z", S.ban, "#050303", 2);
      co.strokeStyle = S.oro; co.lineWidth = 1.5; co.strokeRect(241, 4, 38, 62);
      co.fillStyle = "#f4ecd8"; co.font = "bold 24px Cinzel, Georgia, serif"; co.textAlign = "center"; co.textBaseline = "middle"; co.fillText(["", "I", "II", "III"][s.compania] || "C", 260, 34);
    }
    const embers = Array.from({ length: 12 }, () => ({ x: r() * W, y: r() * H, v: 6 + r() * 12, f: r() * 6 }));
    const c = canvas.getContext("2d");
    return function cuadro(t) {
      const anim = !!o.anim && !REDUCIDO;
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bw, bh);
      const resp = anim ? Math.sin(t * 1.5 + S.fase) * 1.8 * esc : 0;
      c.drawImage(kb, 0, 0);
      c.drawImage(kf, 0, resp);
      c.setTransform(esc, 0, 0, esc, 0, 0);
      if (anim) {
        c.fillStyle = "rgba(150,160,170,.07)";
        for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(((t * (8 + i * 5) + i * 120) % (W + 240)) - 120, 330 + i * 18, 120, 22, 0, 0, 7); c.fill(); }
      }
      S.ojos.forEach((e, i) => {
        const f = anim ? 0.78 + 0.22 * Math.sin(t * 3.1 + i * 1.7 + S.fase) : 1, y = e.y + resp / esc;
        const g = c.createRadialGradient(e.x, y, 0, e.x, y, e.rx * 3.6); g.addColorStop(0, e.col + "aa"); g.addColorStop(1, e.col + "00");
        c.globalAlpha = f; c.fillStyle = g; c.beginPath(); c.arc(e.x, y, e.rx * 3.6, 0, 7); c.fill(); c.globalAlpha = 1;
        c.fillStyle = e.col; c.beginPath(); c.ellipse(e.x, y, e.rx * 0.62, e.ry * 0.8, 0, 0, 7); c.fill();
        c.fillStyle = "#fff"; c.globalAlpha = f * 0.8; c.beginPath(); c.ellipse(e.x, y, e.rx * 0.28, e.ry * 0.36, 0, 0, 7); c.fill(); c.globalAlpha = 1;
      });
      if (anim) embers.forEach(e => { const y = (e.y - t * e.v) % H, yy = y < 0 ? y + H : y, a = 0.15 + 0.35 * Math.abs(Math.sin(t + e.f)); c.fillStyle = `rgba(255,170,70,${a})`; c.fillRect(e.x + Math.sin(t * 0.8 + e.f) * 6, yy, 1.6, 1.6); });
      c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(ko, 0, 0);
    };
  }

  /* --- Estático: se pinta una vez --- */
  function dibujar(canvas, s, o) { o = o || {}; registro.delete(canvas); construir(canvas, s, o)(0); }

  /* --- Animado: un solo bucle para todos los que se ven --- */
  const registro = new Map();
  let bucle = 0, ultimo = 0, visibles = null;
  if (window.IntersectionObserver) visibles = new IntersectionObserver(es => es.forEach(e => { e.target.__fvis = e.isIntersecting; }), { rootMargin: "80px" });
  function animar(canvas, s, o) {
    o = Object.assign({}, o, { anim: true });
    const f = construir(canvas, s, o);
    f(0);
    if (REDUCIDO) return;
    registro.set(canvas, { f, t0: performance.now() });
    canvas.__fvis = true;
    if (visibles) visibles.observe(canvas);
    if (!bucle) bucle = requestAnimationFrame(paso);
  }
  function paso(ahora) {
    bucle = 0;
    if (!registro.size) return;
    if (ahora - ultimo >= 66) {
      ultimo = ahora;
      registro.forEach((v, canvas) => {
        if (!canvas.isConnected) { registro.delete(canvas); if (visibles) visibles.unobserve(canvas); return; }
        if (canvas.__fvis === false) return;
        v.f((ahora - v.t0) / 1000);
      });
    }
    bucle = requestAnimationFrame(paso);
  }

  /* Soldado de relleno para mostrar una clase y una facción sin tener a nadie (portadas) */
  function generico(clase, id, sexo) { return { id: String(id), clase, sexo: sexo || "m", origen: "voluntario", nacimiento: -22, victorias: 0, cicatrices: 0, estado: "activo" }; }

  return { dibujar, animar, generico };
})();
