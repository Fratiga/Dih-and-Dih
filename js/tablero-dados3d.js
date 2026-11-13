/* =============================================================================
   TABLERO — dados en 3D y moneda. El resultado lo decide siempre el servidor: aquí solo se anima.
   - Modelos propios: el poliedro de cada dado (d4, d6, d8, d10, d12, d20 y el d100 como dos d10) con las aristas
     y las esquinas biseladas y sombreado suave en el bisel. Los números se pintan en una textura por cara.
   - La moneda es un cilindro con canto estriado y dos caras dibujadas (cara y cruz).
   - three.js se carga la primera vez que se tira. Solo se dibuja mientras hay algo rodando; después se apaga.
============================================================================= */
(function () {
  const SKINS = [
    { id: "marfil", nombre: "Marfil", cuerpo: "#efe7d4", numero: "#3b2a1c", rugosidad: 0.5, metal: 0 },
    { id: "obsidiana", nombre: "Obsidiana y oro", cuerpo: "#1a1a1f", numero: "#e2b23c", rugosidad: 0.22, metal: 0.15, brillo: true },
    { id: "rubi", nombre: "Rubí", cuerpo: "#a3122a", numero: "#fff4e8", rugosidad: 0.16, metal: 0, brillo: true },
    { id: "esmeralda", nombre: "Esmeralda", cuerpo: "#0f6e45", numero: "#f5f5ec", rugosidad: 0.18, metal: 0, brillo: true },
    { id: "zafiro", nombre: "Zafiro", cuerpo: "#1a3f96", numero: "#f3e7c4", rugosidad: 0.18, metal: 0, brillo: true },
    { id: "acero", nombre: "Acero", cuerpo: "#a9b0b8", numero: "#1c1c1c", rugosidad: 0.3, metal: 0.95 },
    { id: "hueso", nombre: "Hueso viejo", cuerpo: "#d8ccb0", numero: "#5a1010", rugosidad: 0.75, metal: 0, manchas: true },
    { id: "arlequin", nombre: "Arlequín", cuerpo: "#d6127e", cuerpo2: "#3b1f6e", numero: "#ffd23f", rugosidad: 0.35, metal: 0, rombos: true }
  ];
  const MONEDAS = [
    { id: "oro", nombre: "Oro", cuerpo: "#f0c24e", relieve: "#8a6212", metal: 0.85, rugosidad: 0.3 },
    { id: "plata", nombre: "Plata", cuerpo: "#e3e7ec", relieve: "#5f656e", metal: 0.85, rugosidad: 0.26 },
    { id: "cobre", nombre: "Cobre", cuerpo: "#de8550", relieve: "#5e2a10", metal: 0.85, rugosidad: 0.36 },
    { id: "obsidiana", nombre: "Obsidiana y oro", cuerpo: "#1e1e24", relieve: "#e2b23c", metal: 0.35, rugosidad: 0.25 }
  ];
  const CARAS_3D = ["4", "6", "8", "10", "12", "20", "100"];
  const MAX_DADOS = 14;

  let T = null, cargando = null;           // three.js
  let renderer = null, scene = null, camera = null, lienzo = null, envListo = false;
  const cacheGeo = new Map(), cacheMat = new Map();
  let activos = [], animando = false, fin = 0, cola = Promise.resolve();

  function cargar() {
    if (T) return Promise.resolve(T);
    if (!cargando) cargando = Promise.all([import("three"), import("three/addons/environments/RoomEnvironment.js")])
      .then(([three, env]) => { T = three; T.__Room = env.RoomEnvironment; return T; })
      .catch(e => { cargando = null; throw e; });
    return cargando;
  }

  /* ------------------------------------------------------------ geometría */
  // Caras de un poliedro convexo a partir de sus vértices (pocas decenas: fuerza bruta)
  function envolvente(pts) {
    const caras = [], vistas = new Set(), n = pts.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
      const nor = new T.Vector3().subVectors(pts[j], pts[i]).cross(new T.Vector3().subVectors(pts[k], pts[i]));
      if (nor.length() < 1e-9) continue;
      nor.normalize();
      let d = nor.dot(pts[i]), pos = 0, neg = 0;
      for (let m = 0; m < n; m++) { const s = nor.dot(pts[m]) - d; if (s > 1e-6) pos++; else if (s < -1e-6) neg++; }
      if (pos && neg) continue;
      if (pos) { nor.negate(); d = -d; }
      const clave = [nor.x, nor.y, nor.z].map(v => v.toFixed(4)).join(",");
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      const idx = [];
      for (let m = 0; m < n; m++) if (Math.abs(nor.dot(pts[m]) - d) < 1e-5) idx.push(m);
      const c = idx.reduce((a, m) => a.add(pts[m]), new T.Vector3()).divideScalar(idx.length);
      const u = new T.Vector3().subVectors(pts[idx[0]], c).normalize(), w = new T.Vector3().crossVectors(nor, u);
      idx.sort((a, b) => { const pa = new T.Vector3().subVectors(pts[a], c), pb = new T.Vector3().subVectors(pts[b], c); return Math.atan2(pa.dot(w), pa.dot(u)) - Math.atan2(pb.dot(w), pb.dot(u)); });
      caras.push({ n: nor, idx, c });
    }
    return caras;
  }
  function verticesDe(tipo) {
    const V = (x, y, z) => new T.Vector3(x, y, z), f = (1 + Math.sqrt(5)) / 2;
    if (tipo === "4") return [V(1, 1, 1), V(-1, -1, 1), V(-1, 1, -1), V(1, -1, -1)];
    if (tipo === "6") { const r = []; for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) r.push(V(x, y, z)); return r; }
    if (tipo === "8") return [V(1, 0, 0), V(-1, 0, 0), V(0, 1, 0), V(0, -1, 0), V(0, 0, 1), V(0, 0, -1)];
    if (tipo === "10") {
      const r = [V(0, 1, 0), V(0, -1, 0)], a = (1 - Math.cos(Math.PI / 5)) / (1 + Math.cos(Math.PI / 5));
      for (let k = 0; k < 10; k++) { const ang = k * Math.PI / 5; r.push(V(Math.cos(ang), k % 2 ? -a : a, Math.sin(ang))); }
      return r;
    }
    if (tipo === "12") {
      const r = [];
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) r.push(V(x, y, z));
      for (const a of [-1, 1]) for (const b of [-1, 1]) { r.push(V(0, a / f, b * f)); r.push(V(a / f, b * f, 0)); r.push(V(a * f, 0, b / f)); }
      return r;
    }
    const r = [];   // 20
    for (const a of [-1, 1]) for (const b of [-1, 1]) { r.push(V(0, a, b * f)); r.push(V(a, b * f, 0)); r.push(V(b * f, 0, a)); }
    return r;
  }
  const BISEL = { "4": 0.16, "6": 0.13, "8": 0.14, "10": 0.12, "12": 0.11, "20": 0.11 };
  const TAM = { "4": 1.25, "6": 0.95, "8": 1.1, "10": 1.08, "12": 1.12, "20": 1.15 };

  // Valor de cada cara (o de cada vértice en el d4). Las caras opuestas suman n+1, como en los dados de verdad.
  function numerar(tipo, caras, pts) {
    if (tipo === "4") return pts.map((p, i) => i + 1);
    const n = caras.length, valores = new Array(n).fill(null);
    // Orden estable: por altura y ángulo, y emparejando opuestas
    const orden = caras.map((c, i) => i).sort((a, b) => (caras[b].n.y - caras[a].n.y) || (Math.atan2(caras[a].n.z, caras[a].n.x) - Math.atan2(caras[b].n.z, caras[b].n.x)));
    let siguiente = 1;
    for (const i of orden) {
      if (valores[i] !== null) continue;
      const op = caras.findIndex(c => c.n.dot(caras[i].n) < -0.999);
      valores[i] = siguiente;
      if (op >= 0 && valores[op] === null) valores[op] = n + 1 - siguiente;
      siguiente++;
      while (valores.includes(siguiente) && siguiente <= n) siguiente++;
    }
    return valores;
  }

  // Textura con una celda por cara (y una celda lisa para los biseles)
  function textura(tipo, caras, pts, valores, skin, etiquetas) {
    const n = caras.length + 1, col = Math.ceil(Math.sqrt(n)), fil = Math.ceil(n / col), C = 192;
    const cv = document.createElement("canvas");
    cv.width = col * C; cv.height = fil * C;
    const g = cv.getContext("2d");
    g.fillStyle = skin.cuerpo; g.fillRect(0, 0, cv.width, cv.height);
    if (skin.rombos) {
      g.fillStyle = skin.cuerpo2;
      for (let y = -C; y < cv.height + C; y += C / 3) for (let x = -C; x < cv.width + C; x += C / 3) {
        if (((x + y) / (C / 3)) % 2) continue;
        g.beginPath(); g.moveTo(x, y - C / 6); g.lineTo(x + C / 6, y); g.lineTo(x, y + C / 6); g.lineTo(x - C / 6, y); g.closePath(); g.fill();
      }
    }
    if (skin.manchas) {
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,60,30,${Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * cv.width, Math.random() * cv.height, 2 + Math.random() * 10, 0, 7); g.fill(); }
    }
    const celdas = caras.map((cara, i) => {
      const cx = (i % col) * C + C / 2, cy = Math.floor(i / col) * C + C / 2;
      // Arriba del texto: hacia un vértice (en el d10, hacia el polo)
      let ref = cara.idx[0];
      if (tipo === "10") ref = cara.idx.reduce((a, b) => (Math.abs(pts[b].y) > Math.abs(pts[a].y) ? b : a));
      const U = new T.Vector3().subVectors(pts[ref], cara.c); U.sub(cara.n.clone().multiplyScalar(U.dot(cara.n))).normalize();
      const Rr = new T.Vector3().crossVectors(U, cara.n);
      let radio = 0;
      cara.idx.forEach(m => { const p = new T.Vector3().subVectors(pts[m], cara.c); radio = Math.max(radio, Math.hypot(p.dot(Rr), p.dot(U))); });
      const escala = (C * 0.5 * 0.94) / radio;
      return { cx, cy, U, R: Rr, escala, radio };
    });
    g.textAlign = "center"; g.textBaseline = "middle";
    const escribir = (txt, x, y, tam, ang) => {
      g.save(); g.translate(x, y); g.rotate(ang || 0);
      g.font = `700 ${tam}px Georgia, "Times New Roman", serif`;
      g.lineWidth = Math.max(2, tam * 0.08); g.strokeStyle = "rgba(0,0,0,.35)"; g.strokeText(txt, 0, tam * 0.04);
      g.fillStyle = skin.numero; g.fillText(txt, 0, 0);
      if (txt === "6" || txt === "9") { g.fillRect(-tam * 0.22, tam * 0.42, tam * 0.44, Math.max(2, tam * 0.07)); }
      g.restore();
    };
    caras.forEach((cara, i) => {
      const cel = celdas[i];
      if (tipo === "4") {
        // Cada cara lleva los números de sus tres vértices, cerca de cada esquina y mirando hacia ella
        cara.idx.forEach(m => {
          const p = new T.Vector3().subVectors(pts[m], cara.c);
          const x = p.dot(cel.R) * cel.escala * 0.52, y = -p.dot(cel.U) * cel.escala * 0.52;
          escribir(String(valores[m]), cel.cx + x, cel.cy + y, C * 0.2, Math.atan2(x, -y));
        });
        return;
      }
      const v = valores[i];
      if (tipo === "6") {
        // Puntos, como los de un dado de verdad
        const P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[v];
        P.forEach(([a, b]) => {
          g.fillStyle = "rgba(0,0,0,.35)"; g.beginPath(); g.arc(cel.cx + a * C * 0.24, cel.cy + b * C * 0.24 + 2, C * 0.085, 0, 7); g.fill();
          g.fillStyle = skin.numero; g.beginPath(); g.arc(cel.cx + a * C * 0.24, cel.cy + b * C * 0.24, C * 0.08, 0, 7); g.fill();
        });
        return;
      }
      const txt = etiquetas ? etiquetas(v) : String(v);
      const tam = C * ({ "8": 0.36, "10": txt.length > 1 ? 0.24 : 0.32, "12": 0.32, "20": 0.27 }[tipo] || 0.3) * (txt.length > 2 ? 0.8 : 1);
      escribir(txt, cel.cx, cel.cy + (tipo === "10" ? C * 0.06 : 0), tam, 0);
    });
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    const lisa = { cx: (caras.length % col) * C + C / 2, cy: Math.floor(caras.length / col) * C + C / 2 };
    return { tex, celdas, lisa, W: cv.width, H: cv.height };
  }

  // Poliedro biselado: caras encogidas, tiras en las aristas y polígonos en las esquinas, con normales suaves en el bisel
  function dadoGeo(tipo, skin, etiquetas, claveEtq) {
    const clave = tipo + "|" + skin.id + "|" + (claveEtq || "");
    if (cacheGeo.has(clave)) return cacheGeo.get(clave);
    const pts = verticesDe(tipo);
    const r0 = Math.max(...pts.map(p => p.length()));
    pts.forEach(p => p.multiplyScalar(TAM[tipo] / r0));
    const caras = envolvente(pts);
    const valores = numerar(tipo, caras, pts);
    const tx = textura(tipo, caras, pts, valores, skin, etiquetas);
    const s = BISEL[tipo];
    const ins = caras.map(c => { const m = new Map(); c.idx.forEach(v => m.set(v, new T.Vector3().subVectors(pts[v], c.c).multiplyScalar(1 - s).add(c.c))); return m; });
    const P = [], N = [], UV = [];
    const uvDe = (i, p) => {
      const cel = tx.celdas[i], d = new T.Vector3().subVectors(p, caras[i].c);
      const px = cel.cx + d.dot(cel.R) * cel.escala, py = cel.cy - d.dot(cel.U) * cel.escala;
      return [px / tx.W, 1 - py / tx.H];
    };
    const uvLisa = [tx.lisa.cx / tx.W, 1 - tx.lisa.cy / tx.H];
    const tri = (a, b, c, na, nb, nc, ua, ub, uc) => {
      const cr = new T.Vector3().subVectors(b, a).cross(new T.Vector3().subVectors(c, a));
      const cen = new T.Vector3().add(a).add(b).add(c);
      if (cr.dot(cen) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [ub, uc] = [uc, ub]; }
      P.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      N.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
      UV.push(...ua, ...ub, ...uc);
    };
    // Caras
    caras.forEach((c, i) => {
      const poli = c.idx.map(v => ins[i].get(v));
      for (let k = 0; k < poli.length; k++) tri(c.c, poli[k], poli[(k + 1) % poli.length], c.n, c.n, c.n, uvDe(i, c.c), uvDe(i, poli[k]), uvDe(i, poli[(k + 1) % poli.length]));
    });
    // Aristas
    const hechas = new Set();
    caras.forEach((c, i) => {
      c.idx.forEach((a, k) => {
        const b = c.idx[(k + 1) % c.idx.length], key = Math.min(a, b) + "-" + Math.max(a, b);
        if (hechas.has(key)) return;
        hechas.add(key);
        const j = caras.findIndex((d, jj) => jj !== i && d.idx.includes(a) && d.idx.includes(b));
        if (j < 0) return;
        const A = ins[i].get(a), B = ins[i].get(b), C = ins[j].get(b), D = ins[j].get(a);
        tri(B, A, D, c.n, c.n, caras[j].n, uvLisa, uvLisa, uvLisa);
        tri(B, D, C, c.n, caras[j].n, caras[j].n, uvLisa, uvLisa, uvLisa);
      });
    });
    // Esquinas
    pts.forEach((p, v) => {
      const alrededor = caras.map((c, i) => ({ c, i })).filter(x => x.c.idx.includes(v));
      const dir = p.clone().normalize(), u = alrededor[0].c.n.clone().sub(dir.clone().multiplyScalar(alrededor[0].c.n.dot(dir))).normalize(), w = new T.Vector3().crossVectors(dir, u);
      alrededor.sort((x, y) => Math.atan2(x.c.n.dot(w), x.c.n.dot(u)) - Math.atan2(y.c.n.dot(w), y.c.n.dot(u)));
      const centro = alrededor.reduce((acc, x) => acc.add(ins[x.i].get(v)), new T.Vector3()).divideScalar(alrededor.length);
      for (let k = 0; k < alrededor.length; k++) {
        const x = alrededor[k], y = alrededor[(k + 1) % alrededor.length];
        tri(centro, ins[x.i].get(v), ins[y.i].get(v), dir, x.c.n, y.c.n, uvLisa, uvLisa, uvLisa);
      }
    });
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    geo.setAttribute("normal", new T.Float32BufferAttribute(N, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(UV, 2));
    // Normales que miran hacia arriba para cada valor (en el d4, el vértice de arriba)
    const arriba = new Map();
    if (tipo === "4") pts.forEach((p, i) => arriba.set(valores[i], p.clone().normalize()));
    else caras.forEach((c, i) => arriba.set(valores[i], c.n.clone()));
    const inradio = Math.min(...caras.map(c => c.n.dot(c.c)));
    const mat = new (skin.brillo ? T.MeshPhysicalMaterial : T.MeshStandardMaterial)(Object.assign({ map: tx.tex, roughness: skin.rugosidad, metalness: skin.metal },
      skin.brillo ? { clearcoat: 1, clearcoatRoughness: 0.08 } : {}));
    const r = { geo, mat, arriba, inradio, tam: TAM[tipo] };
    cacheGeo.set(clave, r);
    return r;
  }

  function monedaGeo(m) {
    if (cacheGeo.has("moneda|" + m.id)) return cacheGeo.get("moneda|" + m.id);
    const R = 0.95, H = 0.13;
    const geo = new T.CylinderGeometry(R, R, H, 72, 1);
    const cara = cv => {
      const g = cv.getContext("2d"), S = cv.width, c = S / 2;
      g.fillStyle = m.cuerpo; g.fillRect(0, 0, S, S);
      g.strokeStyle = m.relieve; g.lineWidth = S * 0.025;
      g.beginPath(); g.arc(c, c, S * 0.44, 0, 7); g.stroke();
      g.setLineDash([S * 0.012, S * 0.018]); g.beginPath(); g.arc(c, c, S * 0.4, 0, 7); g.stroke(); g.setLineDash([]);
      return g;
    };
    const lienzoCara = document.createElement("canvas"); lienzoCara.width = lienzoCara.height = 512;
    let g = cara(lienzoCara);
    // Cara: una corona
    g.fillStyle = m.relieve; g.beginPath();
    g.moveTo(150, 300); g.lineTo(165, 185); g.lineTo(205, 245); g.lineTo(256, 160); g.lineTo(307, 245); g.lineTo(347, 185); g.lineTo(362, 300); g.closePath(); g.fill();
    g.fillRect(150, 310, 212, 26);
    [165, 256, 347].forEach((x, i) => { g.beginPath(); g.arc(x, i === 1 ? 152 : 178, 13, 0, 7); g.fill(); });
    g.font = "700 52px Georgia, serif"; g.textAlign = "center"; g.fillText("CARA", 256, 400);
    const lienzoCruz = document.createElement("canvas"); lienzoCruz.width = lienzoCruz.height = 512;
    g = cara(lienzoCruz);
    // Cruz: una cruz griega con remates
    g.fillStyle = m.relieve;
    g.fillRect(226, 130, 60, 230); g.fillRect(141, 215, 230, 60);
    [[256, 130], [256, 360], [141, 245], [371, 245]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); });
    g.font = "700 52px Georgia, serif"; g.textAlign = "center"; g.fillText("CRUZ", 256, 430);
    const lienzoCanto = document.createElement("canvas"); lienzoCanto.width = 512; lienzoCanto.height = 16;
    const gc = lienzoCanto.getContext("2d");
    gc.fillStyle = m.cuerpo; gc.fillRect(0, 0, 512, 16);
    gc.fillStyle = m.relieve; for (let x = 0; x < 512; x += 6) gc.fillRect(x, 0, 2, 16);
    const t = c => { const x = new T.CanvasTexture(c); x.colorSpace = T.SRGBColorSpace; x.anisotropy = 4; return x; };
    const base = { roughness: m.rugosidad, metalness: m.metal };
    const mats = [new T.MeshStandardMaterial(Object.assign({ map: t(lienzoCanto) }, base)), new T.MeshStandardMaterial(Object.assign({ map: t(lienzoCara) }, base)), new T.MeshStandardMaterial(Object.assign({ map: t(lienzoCruz) }, base))];
    const r = { geo, mats, H };
    cacheGeo.set("moneda|" + m.id, r);
    return r;
  }

  /* ------------------------------------------------------------ escena */
  function preparar() {
    if (renderer) return;
    const caja = document.getElementById("tbLienzo");
    lienzo = document.createElement("canvas");
    lienzo.className = "tb-dados3d";
    document.body.appendChild(lienzo);
    renderer = new T.WebGLRenderer({ canvas: lienzo, alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(32, 1, 0.1, 200);
    scene.add(new T.HemisphereLight(0xffffff, 0x444455, 0.9));
    const sol = new T.DirectionalLight(0xffffff, 2.2);
    sol.position.set(-6, 14, 6);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    Object.assign(sol.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
    sol.shadow.radius = 4;
    scene.add(sol);
    const suelo = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.3 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    scene.add(suelo);
    const ajustar = () => {
      // Solo la parte visible del tablero: sin la barra de la izquierda ni el panel de la derecha
      const r0 = caja.getBoundingClientRect(), lado = document.getElementById("tbLado"), barra = document.querySelector(".tb-barra");
      let izq = r0.left, der = r0.right;
      if (barra && barra.offsetParent) izq = Math.max(izq, barra.getBoundingClientRect().right);
      if (lado && !document.body.classList.contains("lado-plegado")) der = Math.min(der, lado.getBoundingClientRect().left);
      const r = { left: izq, top: r0.top, width: Math.max(100, der - izq), height: r0.height };
      Object.assign(lienzo.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
      const pr = Math.min(window.devicePixelRatio || 1, (window.TB && TB.prefs && { alta: 1.5, media: 1, baja: 0.75 }[TB.prefs.calidad]) || 1);
      renderer.setPixelRatio(pr);
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / Math.max(1, r.height);
      // La cámara mira la mesa desde arriba y algo inclinada; el ancho visible es de unas 20 unidades
      const ancho = 15, alto = ancho / camera.aspect;
      const dist = (Math.max(alto, 9) / 2) / Math.tan(camera.fov * Math.PI / 360);
      camera.position.set(0, dist * 0.96, dist * 0.26);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
    };
    ajustar();
    new ResizeObserver(ajustar).observe(caja);
    window.addEventListener("resize", ajustar);
    preparar.ajustar = ajustar;
  }
  function entorno() {
    if (envListo) return;
    envListo = true;
    try {
      const pm = new T.PMREMGenerator(renderer);
      scene.environment = pm.fromScene(new T.__Room(), 0.04).texture;
      scene.environmentIntensity = 1.25;
      pm.dispose();
    } catch (e) { /* sin reflejos */ }
  }

  /* ------------------------------------------------------------ movimiento */
  // Se precalcula una trayectoria con rebotes; al final se gira suavemente hasta la cara que salió
  function trayectoria(destino, alto, giro, desde) {
    const dt = 1 / 120, pasos = [], g = -32;
    const p = desde.clone(), v = new T.Vector3((destino.x - desde.x) * 1.15, 6 + Math.random() * 3, (destino.z - desde.z) * 1.15);
    const w = new T.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(giro);
    const q = new T.Quaternion().setFromEuler(new T.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    let quieto = 0;
    for (let i = 0; i < 260; i++) {
      v.y += g * dt;
      p.addScaledVector(v, dt);
      if (p.y < alto) {
        p.y = alto;
        if (v.y < 0) { v.y = -v.y * 0.42; v.x *= 0.72; v.z *= 0.72; w.multiplyScalar(0.62); }
        if (Math.abs(v.y) < 0.6) v.y = 0;
      }
      if (p.y <= alto + 1e-3) { v.x *= 0.965; v.z *= 0.965; w.multiplyScalar(0.95); }
      const ang = w.length() * dt;
      if (ang > 1e-6) q.premultiply(new T.Quaternion().setFromAxisAngle(w.clone().normalize(), ang));
      pasos.push({ p: p.clone(), q: q.clone() });
      if (v.length() < 0.15 && w.length() < 0.3 && p.y <= alto + 1e-3) { if (++quieto > 10) break; }
    }
    // Llevar el punto de reposo exactamente al destino
    const ult = pasos[pasos.length - 1].p, corr = new T.Vector3(destino.x - ult.x, 0, destino.z - ult.z);
    pasos.forEach((s, i) => s.p.addScaledVector(corr, i / (pasos.length - 1)));
    return pasos;
  }
  function orientacionFinal(normalArriba, cerca) {
    const base = new T.Quaternion().setFromUnitVectors(normalArriba.clone().normalize(), new T.Vector3(0, 1, 0));
    let mejor = null, dmin = Infinity;
    for (let k = 0; k < 16; k++) {
      const q = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), k * Math.PI / 8).multiply(base);
      const d = q.angleTo(cerca);
      if (d < dmin) { dmin = d; mejor = q; }
    }
    return mejor;
  }

  // Lista de dados a animar a partir de una tirada del servidor
  function dadosDe(t) {
    const out = [];
    (t.partes || []).forEach(p => {
      if (p.tipo !== "dados") return;
      const c = String(p.caras);
      p.valores.forEach((v, i) => {
        if (out.length >= MAX_DADOS) return;
        if (c === "2") out.push({ moneda: true, valor: v });
        else if (c === "100") {
          const decenas = Math.floor((v % 100) / 10), unidades = v % 10;
          out.push({ tipo: "10", valor: decenas === 0 ? 10 : decenas, decenas: true });
          out.push({ tipo: "10", valor: unidades === 0 ? 10 : unidades });
        } else if (CARAS_3D.includes(c) && !p.extra[i]) out.push({ tipo: c, valor: v });
      });
    });
    return out.slice(0, MAX_DADOS);
  }

  function lanzar(t) {
    const P = (window.TB && TB.prefs && TB.prefs.dados) || {};
    if (!t || t.secreta || P.tresD === false) return Promise.resolve(false);
    const lista = dadosDe(t);
    if (!lista.length) return Promise.resolve(false);
    cola = cola.then(() => animar(lista).catch(e => { console.warn("[dados 3D]", e); return false; }));
    return cola;
  }

  async function animar(lista) {
    await cargar();
    preparar();
    entorno();
    limpiar();
    if (preparar.ajustar) preparar.ajustar();
    const P = TB.prefs.dados || {};
    const skin = SKINS.find(s => s.id === P.skin) || SKINS[0];
    const mon = MONEDAS.find(s => s.id === P.moneda) || MONEDAS[0];
    // Destinos repartidos en una rejilla cerca del centro; salen desde abajo a la derecha
    const n = lista.length, columnas = Math.min(n, 5);
    const ahora = performance.now();
    lista.forEach((d, i) => {
      const fila = Math.floor(i / columnas), col = i % columnas, enFila = Math.min(columnas, n - fila * columnas);
      const destino = new T.Vector3((col - (enFila - 1) / 2) * 2.5 + (Math.random() - 0.5) * 0.5, 0, (fila - (Math.ceil(n / columnas) - 1) / 2) * 2.5 + (Math.random() - 0.5) * 0.5);
      const desde = new T.Vector3(7 + Math.random() * 2, 3 + Math.random() * 2, 4 + Math.random() * 2);
      let malla, alto, arriba;
      if (d.moneda) {
        const m = monedaGeo(mon);
        malla = new T.Mesh(m.geo, m.mats);
        alto = m.H / 2;
        arriba = new T.Vector3(0, d.valor === 1 ? 1 : -1, 0);
      } else {
        const etq = d.tipo === "10" ? (d.decenas ? v => (v === 10 ? "00" : v + "0") : v => String(v === 10 ? 0 : v)) : null;
        const m = dadoGeo(d.tipo, skin, etq, d.tipo === "10" ? (d.decenas ? "dec" : "uni") : "");
        malla = new T.Mesh(m.geo, m.mat);
        alto = m.inradio;
        arriba = m.arriba.get(d.valor) || new T.Vector3(0, 1, 0);
      }
      malla.castShadow = true;
      scene.add(malla);
      const pasos = trayectoria(destino, alto, d.moneda ? 22 : 14 + Math.random() * 8, desde);
      const iBlend = Math.floor(pasos.length * 0.55);
      const qFinal = orientacionFinal(arriba, pasos[iBlend].q);
      activos.push({ malla, pasos, iBlend, qFinal, inicio: ahora + i * 70 });
    });
    lienzo.style.transition = "none";
    lienzo.style.opacity = "1";
    lienzo.hidden = false;
    const durMax = Math.max(...activos.map(a => a.inicio - ahora + a.pasos.length * 1000 / 120));
    fin = ahora + durMax;
    return new Promise(res => {
      animando = true;
      const cuadro = tAhora => {
        let todos = true;
        activos.forEach(a => {
          const k = Math.max(0, (tAhora - a.inicio) / 1000 * 120);
          const i = Math.min(a.pasos.length - 1, Math.floor(k));
          if (i < a.pasos.length - 1) todos = false;
          const s = a.pasos[i];
          a.malla.position.copy(s.p);
          if (i <= a.iBlend) a.malla.quaternion.copy(s.q);
          else {
            const f = (i - a.iBlend) / Math.max(1, a.pasos.length - 1 - a.iBlend), e = 1 - Math.pow(1 - f, 3);
            a.malla.quaternion.copy(s.q).slerp(a.qFinal, Math.min(1, e * 1.15));
          }
        });
        renderer.render(scene, camera);
        if (!todos) { requestAnimationFrame(cuadro); return; }
        animando = false;
        res(true);
        // Quedan un momento a la vista y se desvanecen; después no se dibuja nada más
        setTimeout(() => {
          if (animando) return;
          lienzo.style.transition = "opacity .5s";
          lienzo.style.opacity = "0";
          setTimeout(() => { if (!animando) { limpiar(); renderer.render(scene, camera); lienzo.hidden = true; } }, 520);
        }, 1500);
      };
      requestAnimationFrame(cuadro);
    });
  }
  function limpiar() { activos.forEach(a => scene.remove(a.malla)); activos = []; }
  // Precarga en segundo plano (para que la primera tirada no espere a three.js)
  function precargar() { return cargar().then(() => { preparar(); entorno(); renderer.compile(scene, camera); }).catch(() => {}); }

  window.TBDados3D = { SKINS, MONEDAS, lanzar, precargar, _activos: () => activos };
})();
