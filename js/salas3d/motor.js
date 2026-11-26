/* =============================================================================
   LAS SALAS DE LA TABERNA EN 2.5D: el motor común
   Cada sala es una maqueta 3D sencilla (suelo con canto, paredes con grosor y el corte a la vista, muebles con volumen, luces y una
   sombra) con texturas pixel art (js/salas3d/texturas.js). Los personajes, las criaturas y la decoración pequeña son sprites 2D que
   miran a la cámara, así que pasan por delante y por detrás de los muebles con la profundidad de verdad.
   Las salas se dibujan en js/salas3d/salas.js; aquí están las herramientas que usan (contexto), el cambio de sala por el hash de la URL
   (#biblioteca, #juegos...), el cursor y los clics, la gente de la mesa y el bucle.
   Uso: montarSalas3D(contenedor, { base, esAdmin }) devuelve { fijar(lista), ir(sala), destruir() }. fijar recibe la lista de
   presencia de siempre (js/presencia.js: { id, nombre, oculto }) y usa data/protagonistas.js para los sprites.
   Rendimiento (gráfica integrada): tope de píxeles, sin MSAA, 30 fps con algo moviéndose y 20 en reposo, y se para fuera de pantalla.
============================================================================= */
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js";
import { crearTexturas } from "./texturas.js?v=20271271";
import { SALAS } from "./salas.js?v=20271272";

export function montarSalas3D(caja, opciones = {}) {
  const base = opciones.base || "";
  const admin = () => typeof opciones.esAdmin === "function" ? !!opciones.esAdmin() : !!opciones.esAdmin;
  const reducido = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tx = crearTexturas(THREE);
  const { T, S, lienzo, textura } = tx;

  /* ---------------------------------------------------------------- motor */
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.42;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;              // las sombras son de muebles quietos: se calculan al entrar en la sala
  renderer.domElement.className = "t3d-lienzo";
  caja.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x0a0810);
  const ASPECTO = 2;                                   // las salas son anchas: 2:1 deja poca franja vacía arriba y abajo
  const camara = new THREE.PerspectiveCamera(31, ASPECTO, 0.5, 70);
  const CAM = new THREE.Vector3(), MIRA = new THREE.Vector3();
  const ambiente = new THREE.HemisphereLight(0x7a6a9a, 0x3a2414, 1.2);
  escena.add(ambiente);

  const etiqueta = document.createElement("div");
  etiqueta.className = "t3d-etq"; etiqueta.hidden = true;
  caja.appendChild(etiqueta);

  const cargador = new THREE.TextureLoader();
  const texCache = new Map();
  function texSprite(url) {
    if (!texCache.has(url)) {
      const t = cargador.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;      // al encoger, sin el ruido de saltarse píxeles
      texCache.set(url, t);
    }
    return texCache.get(url);
  }

  /* ================================================================= LA SALA ACTUAL */
  let sala = null;            // { clave, grupo, zonas, animar[], ventanas[], rejilla, puestos, ambiente }

  function contexto(grupo, estado) {
    const L = (map, extra) => new THREE.MeshLambertMaterial(Object.assign({ map }, extra || {}));
    const color = c => new THREE.MeshLambertMaterial({ color: c });
    const basica = c => new THREE.MeshBasicMaterial({ color: c });
    const ctx = {
      THREE, T, S, lienzo, textura, L, color, basica, base, admin: admin(), reducido, texSprite,
      ALTO: 4.4, X0: -7, X1: 7, ZF: -4.5, ZD: 3.4,
      add: (...o) => { grupo.add(...o); return o[0]; },
      grupo(x = 0, y = 0, z = 0, padre) { const g = new THREE.Group(); g.position.set(x, y, z); if (padre !== null) (padre || grupo).add(g); return g; },   // padre null: sin colgar (zona() lo cuelga)
      caja3(w, h, d, mat, x, y, z, padre, sombra = true) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y + h / 2, z); m.castShadow = sombra; m.receiveShadow = true;
        (padre || grupo).add(m); return m;
      },
      plano(w, h, mat, x, y, z, ry = 0, rx = 0, padre) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true;
        (padre || grupo).add(m); return m;
      },
      cilindro(rt, rb, h, seg, mat, x, y, z, padre, theta, desde = 0) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, false, desde, theta || Math.PI * 2), mat);
        m.position.set(x, y + h / 2, z); m.castShadow = true; m.receiveShadow = true;
        (padre || grupo).add(m); return m;
      },
      // Sprite plano: pegado a una pared (ry) o tumbado; con iluminación de la sala
      sprite(tex, w, h, x, y, z, ry = 0, padre) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.5 }));
        m.position.set(x, y, z); m.rotation.y = ry;
        (padre || grupo).add(m); return m;
      },
      puntual(col, intensidad, distancia, x, y, z) { const l = new THREE.PointLight(col, intensidad, distancia, 2); l.position.set(x, y, z); grupo.add(l); return l; },
      foco(col, intensidad, distancia, angulo, x, y, z, tx2, ty, tz, sombra) {
        const l = new THREE.SpotLight(col, intensidad, distancia, angulo, 0.7, 1.7);
        l.position.set(x, y, z); l.target.position.set(tx2, ty, tz);
        if (sombra) { l.castShadow = true; l.shadow.mapSize.set(1024, 1024); l.shadow.bias = -0.0015; l.shadow.camera.near = 0.5; l.shadow.camera.far = 9; }
        grupo.add(l, l.target); return l;
      },
      animar(fn) { estado.animar.push(fn); },
      // Un objeto con enlace: se ilumina al pasar el cursor y lleva a su página (o a otra sala si el enlace empieza por #)
      zona(g, href, nombre) {
        g.userData.zona = { href, nombre };
        g.traverse(o => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          o.userData.em0 = o.material.emissive ? o.material.emissive.clone() : null;
        });
        estado.zonas.push(g);
        if (!g.parent) grupo.add(g);
        return g;
      },
      ocupar(x, z, w, d, margen = 0.32) {
        const R = estado.rejilla;
        const ax = Math.floor((x - w / 2 - margen - R.x0) / R.paso), bx = Math.ceil((x + w / 2 + margen - R.x0) / R.paso);
        const az = Math.floor((z - d / 2 - margen - R.z0) / R.paso), bz = Math.ceil((z + d / 2 + margen - R.z0) / R.paso);
        for (let i = Math.max(0, ax); i <= Math.min(R.nx - 1, bx); i++) for (let k = Math.max(0, az); k <= Math.min(R.nz - 1, bz); k++) R.libre[k * R.nx + i] = 0;
      },
      camara(pos, mira) { estado.cam = new THREE.Vector3(...pos); estado.mira = new THREE.Vector3(...mira); },
      // Una foto (fanart) recortada para llenar el marco sin deformarse
      imagen(mat, url, w, h) {
        cargador.load(base + url, t => {
          t.colorSpace = THREE.SRGBColorSpace;
          const ar = (t.image.width / t.image.height) / (w / h);
          if (ar > 1) { t.repeat.set(1 / ar, 1); t.offset.set((1 - 1 / ar) / 2, 0); } else { t.repeat.set(1, ar); t.offset.set(0, (1 - ar) / 2); }
          if (mat.map) mat.map.dispose();
          mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
        });
      },
      luzAmbiente(intensidad, cielo = 0x7a6a9a, suelo = 0x3a2414) { estado.ambiente = { intensidad, cielo, suelo }; },
      puestos(lista) { estado.puestos = lista; },
      fondo(col) { estado.fondo = col; }
    };
    const { caja3, plano } = ctx;

    /* La caja de la sala: suelo con canto, pared del fondo y paredes laterales con grosor. Opciones:
       suelo (textura), pared (textura del yeso o papel), zocalo (textura o null), viga (material), alto, tapa (color del corte) */
    ctx.cascaron = (o = {}) => {
      const ALTO = ctx.ALTO = o.alto || 4.4, W = 14, ZF = ctx.ZF, ZD = ctx.ZD;
      const tapa = color(o.tapa || 0x17121c);
      const canto = L(o.canto || T.piedra("#4a4250", 13, [7, 1]));
      const sueloTex = (o.suelo || T.suelo()).clone(); sueloTex.needsUpdate = true;
      if (!o.suelo) sueloTex.repeat.set(W / 2, (ZD - ZF) / 2);
      const suelo = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.45, ZD - ZF + 0.6), [canto, canto, L(sueloTex), canto, canto, canto]);
      suelo.position.set(0, -0.225, (ZD + ZF) / 2); suelo.receiveShadow = true; grupo.add(suelo);
      const paredTex = (o.pared || T.yeso()).clone(); paredTex.needsUpdate = true;
      paredTex.repeat.set(o.repPared ? o.repPared[0] : 7, o.repPared ? o.repPared[1] : 1.6 * ALTO / 4.4);
      const fondo = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, ALTO, 0.3), [tapa, tapa, tapa, tapa, L(paredTex), tapa]);
      fondo.position.set(0, ALTO / 2, ZF - 0.15); fondo.receiveShadow = true; grupo.add(fondo);
      const zocaloAlto = o.zocalo === null ? 0 : 1.25;
      if (zocaloAlto) {
        const zt = (o.zocalo || T.maderaVertical("#4f3420")).clone(); zt.repeat.set(9, 1); zt.needsUpdate = true;
        caja3(W, zocaloAlto, 0.08, L(zt), 0, 0, ZF + 0.04);
        caja3(W, 0.1, 0.14, color(0x3a2516), 0, zocaloAlto - 0.05, ZF + 0.06);
      }
      const viga = o.viga || L(T.madera("#4a2f1c", 8));
      caja3(W + 0.6, 0.36, 0.42, viga, 0, ALTO - 0.36, ZF + 0.1);
      (o.postes || [-3.6, 3.6]).forEach(x => caja3(0.32, ALTO - zocaloAlto, 0.18, viga, x, zocaloAlto, ZF + 0.08));
      const ladoTex = paredTex.clone(); ladoTex.repeat.set(3.5, paredTex.repeat.y); ladoTex.needsUpdate = true;
      const zocLado = (o.zocaloLado || T.piedra("#6b6170", 15, [3.5, 2.2]));
      [[ctx.X0 - 0.15, 1], [ctx.X1 + 0.15, -1]].forEach(([x, lado]) => {
        const caras = lado > 0 ? [L(ladoTex), tapa, tapa, tapa, tapa, tapa] : [tapa, L(ladoTex), tapa, tapa, tapa, tapa];
        const pared = new THREE.Mesh(new THREE.BoxGeometry(0.3, ALTO, 6.9), caras);
        pared.position.set(x, ALTO / 2, ZF + 3.3); pared.receiveShadow = true; grupo.add(pared);
        if (zocaloAlto) { const z1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, zocaloAlto, 6.9), L(zocLado)); z1.position.set(x + 0.19 * lado, zocaloAlto / 2, ZF + 3.3); z1.receiveShadow = true; grupo.add(z1); }
        const v = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 6.9), viga); v.position.set(x + 0.1 * lado, ALTO - 0.18, ZF + 3.3); grupo.add(v);
      });
    };

    /* Una puerta en una pared lateral (lado -1 izquierda, 1 derecha) o en la del fondo (lado 0, z es la x) */
    ctx.puerta = (lado, pos, href, nombre, o = {}) => {
      const g = lado === 0 ? ctx.grupo(pos, 0, ctx.ZF + 0.03, null) : ctx.grupo(lado < 0 ? ctx.X0 + 0.02 : ctx.X1 - 0.02, 0, pos, null);
      g.rotation.y = lado === 0 ? 0 : -lado * Math.PI / 2;
      const ancho = o.ancho || 1.1, alto = o.alto || 2.2;
      caja3(ancho + 0.22, alto + 0.15, 0.1, color(0x2a1a10), 0, 0, 0, g, false);
      if (o.doble) {
        [-1, 1].forEach(s => plano(ancho / 2 - 0.02, alto, L(T.puerta(o.madera || "#6b4425", false)), s * ancho / 4, alto / 2, 0.055, 0, 0, g));
      } else plano(ancho, alto, L(T.puerta(o.madera || "#6b4425", !!o.ventanita)), 0, alto / 2, 0.055, 0, 0, g);
      caja3(ancho + 0.32, 0.14, 0.18, color(0x3a2516), 0, alto + 0.15, 0.02, g, false);
      if (o.letrero) plano(0.9, 0.22, new THREE.MeshLambertMaterial({ map: T.letrero(o.letrero, "#2a1a10", "#e8c87a", 80, 16) }), 0, alto + 0.42, 0.06, 0, 0, g);
      if (o.icono) ctx.sprite(S.icono(o.icono), 0.34, 0.34, 0, alto + 0.42, 0.07, 0, g);
      return ctx.zona(g, href, nombre);
    };

    /* Ventana en la pared del fondo con el cielo de la hora y el clima, haz de luz y polvo */
    ctx.ventana = (x, y, w = 1.4, h = 1.7, haz = true) => {
      const g = ctx.grupo(x, y, ctx.ZF + 0.02);
      const [c] = lienzo(36, 44), tex = textura(c);
      plano(w, h, new THREE.MeshBasicMaterial({ map: tex }), 0, h / 2, 0.01, 0, 0, g);
      const marco = color(0x3a2516);
      caja3(w + 0.2, 0.12, 0.2, marco, 0, -0.06, 0.05, g); caja3(w + 0.2, 0.12, 0.16, marco, 0, h, 0.03, g);
      caja3(0.12, h + 0.1, 0.16, marco, -w / 2 - 0.06, -0.06, 0.03, g); caja3(0.12, h + 0.1, 0.16, marco, w / 2 + 0.06, -0.06, 0.03, g);
      caja3(0.06, h, 0.08, marco, 0, 0, 0.03, g); caja3(w, 0.06, 0.08, marco, 0, h / 2, 0.03, g);
      const luz = ctx.foco(0xbcd6ff, 20, 14, 0.55, x, y + 2.1, ctx.ZF - 2.6, x - 0.8, 0, ctx.ZF + 3.2);
      let rayo = null, polvo = null;
      if (haz) {
        rayo = new THREE.Mesh(new THREE.PlaneGeometry(w, 4.6), new THREE.MeshBasicMaterial({ color: 0xfff1c8, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        rayo.position.set(x - 0.25, y - 0.2, ctx.ZF + 1.6); rayo.rotation.set(-0.95, 0.12, 0); rayo.renderOrder = 4; grupo.add(rayo);
        const n = 30, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = x - 0.7 + Math.random() * 1.1; pos[i * 3 + 1] = 0.3 + Math.random() * 2.6; pos[i * 3 + 2] = ctx.ZF + 0.6 + Math.random() * 2.4; }
        const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        polvo = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff1c8, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        grupo.add(polvo);
      }
      estado.ventanas.push({ c, g2: c.getContext("2d"), tex, luz, rayo, polvo, estado: "" });
      return g;
    };

    /* Fuego animado (chimenea, brasero, fragua): textura que se redibuja y una luz que parpadea */
    ctx.fuego = (x, y, z, w = 1.1, h = 1.05, fuerza = 16) => {     // coordenadas del mundo
      const [c] = lienzo(20, 24), g2 = c.getContext("2d"), tex = textura(c);
      const llama = plano(w, h, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, depthWrite: false }), x, y, z);
      llama.renderOrder = 2;
      const luz = ctx.puntual(0xff8a3a, fuerza, 10, x, y + 0.25, z + 0.75);
      const cols = ["#7a1f0a", "#d2461a", "#f28a2a", "#ffd27a", "#fff1c0"];
      ctx.animar((dt, t) => {
        g2.clearRect(0, 0, 20, 24);
        for (let i = 1; i < 19; i++) {
          const alto = 6 + Math.round((Math.sin(t * 9 + i * 1.7) + Math.sin(t * 13.3 + i * 0.6) + 2) * 3.2) - Math.abs(i - 10) * 0.6;
          for (let k = 0; k < alto; k++) { const n = Math.min(4, Math.floor((1 - k / alto) * 4.6 - Math.abs(i - 10) * 0.18)); if (n < 0) continue; g2.fillStyle = cols[n]; g2.fillRect(i, 23 - k, 1, 1); }
        }
        tex.needsUpdate = true;
        luz.intensity = fuerza * (reducido ? 1 : 0.85 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.05 + Math.random() * 0.04);
      });
      return { llama, luz };
    };

    /* Una vela con su llamita, para mesas y repisas */
    ctx.vela = (x, y, z, alto = 0.2, padre) => {
      caja3(0.07, alto, 0.07, color(0xf2ead2), x, y, z, padre, false);
      const m = caja3(0.045, 0.07, 0.045, basica(0xffc84a), x, y + alto, z, padre, false);
      const f = Math.random() * 6;
      ctx.animar((dt, t) => { m.scale.y = reducido ? 1 : 0.8 + Math.abs(Math.sin(t * 7 + f)) * 0.4; });
      return m;
    };

    /* Alguien que mira a la cámara y se mueve un poco: tabernero, crupier, criaturas de los corrales */
    ctx.figura = (texturas, ancho, alto, x, y, z, o = {}) => {
      const raiz = ctx.grupo(x, y, z);
      const mat = new THREE.MeshBasicMaterial({ map: texturas[0], alphaTest: 0.5, side: THREE.DoubleSide, color: o.tinte || 0xf4e8dc, toneMapped: false });
      const malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
      malla.position.y = alto / 2; if (o.volteo) malla.scale.x = -1;
      raiz.add(malla);
      raiz.rotation.y = Math.atan2(estado.cam.x - x, estado.cam.z - z);
      if (o.sombra !== false && y < 0.05) { const s = new THREE.Mesh(new THREE.CircleGeometry(ancho * 0.36, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.32, depthWrite: false })); s.rotation.x = -Math.PI / 2; s.scale.y = 0.5; s.position.set(x, 0.015, z + 0.02); grupo.add(s); }
      const f = Math.random() * 10, cambio = o.cambio || 1.6, salta = o.salta || 0;
      ctx.animar((dt, t) => {
        if (reducido) return;
        if (texturas.length > 1) { const m = texturas[Math.floor((t + f) / cambio) % texturas.length]; if (mat.map !== m) mat.map = m; }
        malla.scale.y = 1 + Math.sin((t + f) * 2.4) * 0.015;
        if (salta) raiz.position.y = y + Math.max(0, Math.sin((t + f) * 3)) * salta;
      });
      return raiz;
    };
    return ctx;
  }

  function vaciar(grupo) {
    grupo.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    escena.remove(grupo);
  }

  function construir(clave) {
    if (!SALAS[clave] || (SALAS[clave].admin && !admin())) clave = "taberna";
    if (sala) { vaciar(sala.grupo); quitarGente(); }
    const grupo = new THREE.Group();
    const RJ = { x0: -6.6, z0: -3.7, paso: 0.2 };
    RJ.nx = Math.round((6.6 - RJ.x0) / RJ.paso) + 1; RJ.nz = Math.round((3.25 - RJ.z0) / RJ.paso) + 1;
    RJ.libre = new Uint8Array(RJ.nx * RJ.nz).fill(1);
    const estado = { admin: admin(), clave, grupo, zonas: [], animar: [], ventanas: [], rejilla: RJ, puestos: null, cam: new THREE.Vector3(0, 7.6, 15.4), mira: new THREE.Vector3(0, 1.25, -0.4), ambiente: { intensidad: 1.2, cielo: 0x7a6a9a, suelo: 0x3a2414 }, fondo: 0x0a0810 };
    sala = estado;
    const ctx = contexto(grupo, estado);
    SALAS[clave].dibujar(ctx);
    escena.add(grupo);
    CAM.copy(estado.cam); MIRA.copy(estado.mira);
    camara.position.copy(CAM); camara.lookAt(MIRA);
    escena.background.set(estado.fondo);
    ambiente.color.set(estado.ambiente.cielo); ambiente.groundColor.set(estado.ambiente.suelo);
    estado.ventanas.forEach(v => (v.estado = ""));
    ultimoCielo = -99;
    if (clave === "taberna") ponerGente();
    renderer.shadowMap.needsUpdate = true;
    encima = null; etiqueta.hidden = true;
    caja.dataset.sala = clave;
    if (opciones.alCambiar) opciones.alCambiar(clave, SALAS[clave]);
    pintarUnaVez();
  }

  /* ================================================================= LA GENTE DE LA MESA (solo en la taberna) */
  const SILUETA = "assets/protagonistas/silueta.png";
  const clave = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  let lista = [];
  const gente = new Map();          // id -> personaje
  const sombraMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });

  function crearPersonaje(p, puesto, i) {
    const info = (window.PROTAGONISTAS || {})[clave(p.nombre)] || null;
    const conSprite = !!(info && info.sprite);
    const tam = conSprite && info.tam ? info.tam : [32, 48];
    const alto = ((conSprite && info.alto) || 144) / 144 * 1.4, ancho = alto * tam[0] / tam[1];
    const raiz = new THREE.Group(), giro = new THREE.Group(), centro = new THREE.Group();
    raiz.add(giro); giro.add(centro); centro.position.y = alto / 2;
    const mat = new THREE.MeshBasicMaterial({ map: texSprite(base + (conSprite ? info.sprite : SILUETA)), alphaTest: 0.5, side: THREE.DoubleSide, color: p.oculto ? 0x8a8090 : 0xf4e8dc, toneMapped: false });
    const malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
    malla.userData.personaje = p;
    centro.add(malla);
    const sombra = new THREE.Mesh(new THREE.CircleGeometry(ancho * 0.36, 12), sombraMat);
    sombra.rotation.x = -Math.PI / 2;
    sala.grupo.add(raiz, sombra);
    const pj = {
      p, raiz, giro, centro, malla, mat, sombra, puesto, alto, fase: i * 1.3, t: 0,
      cuadros: conSprite ? { base: mat.map, brillo: info.brillo ? texSprite(base + info.brillo) : null, parpadeo: info.parpadeo ? texSprite(base + info.parpadeo) : null } : null,
      pasea: !!(conSprite && info.pasea) && !reducido, x: puesto.x, z: puesto.z, y: puesto.y, dir: puesto.x < 0 ? -1 : 1, estado: "sentado"
    };
    if (pj.pasea) Object.assign(pj, { resto: /[?&]paseo=rapido\b/.test(location.search) ? 1.5 : 6 + Math.random() * 6, ruta: [], rueda: null });
    colocar(pj, 0, 0, 1, 1, 0);
    return pj;
  }
  function quitarGente() { gente.clear(); }
  function ponerGente() {
    if (!sala || sala.clave !== "taberna" || !sala.puestos) return;
    const P = sala.puestos;
    const presentes = new Map(lista.map(p => [p.id, p]));
    for (const [id, pj] of gente) if (!presentes.has(id)) { sala.grupo.remove(pj.raiz, pj.sombra); gente.delete(id); }
    const ocupados = new Set([...gente.values()].map(pj => P.indexOf(pj.puesto)));
    let i = gente.size;
    for (const p of presentes.values()) {
      const ya = gente.get(p.id);
      if (ya) { ya.mat.color.set(p.oculto ? 0x8a8090 : 0xf4e8dc); continue; }
      const info = (window.PROTAGONISTAS || {})[clave(p.nombre)];
      let k = P.findIndex((_, n) => !ocupados.has(n));
      if (info && info.pasea) { const b = P.findIndex((u, n) => !ocupados.has(n) && u.capa === "banco"); if (b >= 0) k = b; }
      if (k < 0) continue;
      ocupados.add(k);
      gente.set(p.id, crearPersonaje(p, P[k], i++));
    }
  }
  function fijar(nueva) { lista = (nueva || []).slice(); ponerGente(); }

  function colocar(pj, salto, bamb, sqx, sqy, rodar, suelo) {
    pj.raiz.position.set(pj.x, pj.y + salto, pj.z);
    pj.raiz.rotation.y = Math.atan2(camara.position.x - pj.x, camara.position.z - pj.z);
    pj.giro.rotation.z = bamb;
    pj.giro.scale.set(sqx * (pj.dir > 0 && pj.pasea ? -1 : 1), sqy, 1);
    pj.centro.rotation.z = rodar;
    pj.sombra.position.set(pj.x, (suelo ?? pj.y) + 0.015, pj.z + 0.02);
    const s = Math.max(0.4, 1 - salto * 1.2);
    pj.sombra.scale.set(s, 0.55 * s, 1);
    pj.sombra.visible = pj.y < 0.1 || pj.estado === "subir" || pj.estado === "bajar";
  }

  /* ---------------------------------------------------------------- caminos: A* sobre la rejilla del suelo de la sala */
  const celda = (R, x, z) => [Math.round((x - R.x0) / R.paso), Math.round((z - R.z0) / R.paso)];
  const centroDe = (R, i, k) => [R.x0 + i * R.paso, R.z0 + k * R.paso];
  const esLibre = (R, i, k) => i >= 0 && k >= 0 && i < R.nx && k < R.nz && R.libre[k * R.nx + i] === 1;
  function vista(R, a, b) {
    const pasos = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (R.paso * 0.5));
    for (let s = 1; s < pasos; s++) { const [i, k] = celda(R, a[0] + (b[0] - a[0]) * s / pasos, a[1] + (b[1] - a[1]) * s / pasos); if (!esLibre(R, i, k)) return false; }
    return true;
  }
  function camino(desde, hasta) {
    const R = sala.rejilla;
    const [si, sk] = celda(R, desde[0], desde[1]), [ei, ek] = celda(R, hasta[0], hasta[1]);
    if (!esLibre(R, ei, ek)) return null;
    const N = R.nx * R.nz, g = new Float32Array(N).fill(Infinity), de = new Int32Array(N).fill(-1), cerrado = new Uint8Array(N);
    const abiertos = [[0, si, sk]]; g[sk * R.nx + si] = 0;
    while (abiertos.length) {
      let mejor = 0; for (let j = 1; j < abiertos.length; j++) if (abiertos[j][0] < abiertos[mejor][0]) mejor = j;
      const [, i, k] = abiertos.splice(mejor, 1)[0], id = k * R.nx + i;
      if (cerrado[id]) continue; cerrado[id] = 1;
      if (i === ei && k === ek) {
        const pts = []; let c = id;
        while (c >= 0) { pts.push(centroDe(R, c % R.nx, Math.floor(c / R.nx))); c = de[c]; }
        pts.reverse(); pts[pts.length - 1] = [hasta[0], hasta[1]];
        const lisa = [pts[0]];
        let a = 0;
        while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !vista(R, pts[a], pts[b])) b--; lisa.push(pts[b]); a = b; }
        return lisa.slice(1);
      }
      for (let di = -1; di <= 1; di++) for (let dk = -1; dk <= 1; dk++) {
        if (!di && !dk) continue;
        const ni = i + di, nk = k + dk;
        if (!esLibre(R, ni, nk) || (di && dk && (!esLibre(R, i + di, k) || !esLibre(R, i, k + dk)))) continue;
        const nid = nk * R.nx + ni, ng = g[id] + (di && dk ? 1.414 : 1);
        if (ng < g[nid]) { g[nid] = ng; de[nid] = id; abiertos.push([ng + Math.hypot(ei - ni, ek - nk), ni, nk]); }
      }
    }
    return null;
  }
  function puntoLibre() {
    const R = sala.rejilla;
    for (let n = 0; n < 60; n++) { const i = Math.floor(Math.random() * R.nx), k = Math.floor(Math.random() * R.nz); if (esLibre(R, i, k)) return centroDe(R, i, k); }
    return [0, 2.4];
  }
  const pie = pj => pj.puesto.capa === "banco" ? [pj.puesto.x, pj.puesto.z - 0.73] : [pj.puesto.x + (pj.puesto.x < 0 ? -0.6 : 0.6), pj.puesto.z];
  function nuevaRuta(pj) {
    for (let n = 0; n < 8; n++) { const r = camino([pj.x, pj.z], puntoLibre()); if (r && r.length) { pj.ruta = r; return; } }
    pj.ruta = [];
  }

  function animarPersonaje(pj, dt) {
    pj.t += dt;
    const t = pj.t + pj.fase;
    if (pj.cuadros && !reducido) {      // brillo de los ojos y parpadeo, con el ritmo de la mesa 2D
      const ciclo = 5.2 + (pj.fase % 3) * 0.7, u = (t % ciclo) / ciclo;
      const m = pj.cuadros.parpadeo && u > 0.861 && u < 0.909 ? pj.cuadros.parpadeo : pj.cuadros.brillo && u > 0.181 && u < 0.499 ? pj.cuadros.brillo : pj.cuadros.base;
      if (pj.mat.map !== m) pj.mat.map = m;
    }
    if (!pj.pasea) { colocar(pj, 0, reducido ? 0 : Math.sin(t * 1.6) * 0.012, 1, reducido ? 1 : 1 + Math.sin(t * 2.4) * 0.014, 0); return false; }
    let salto = 0, bamb = 0, sqx = 1, sqy = 1, rodar = 0, suelo = 0, moviendo = false;
    if (pj.rueda) {          // barrel roll: un salto con una vuelta entera
      const r = pj.rueda; r.u += dt / r.dur;
      const u = Math.min(1, r.u), suave = u * u * (3 - 2 * u);
      salto = r.alto * Math.sin(Math.PI * u); rodar = -Math.PI * 2 * suave * r.sentido;
      sqy = 1 + 0.08 * Math.sin(Math.PI * u); sqx = 1 - 0.05 * Math.sin(Math.PI * u);
      if (r.u >= 1) pj.rueda = null;
      moviendo = true;
    }
    if (pj.estado === "sentado") {
      if (!pj.rueda) { sqy = 1 + 0.025 * Math.sin(t * 2.4); bamb = Math.sin(t * 1.6) * 0.03; }
      pj.resto -= dt;
      if (pj.resto <= 0) { pj.estado = "bajar"; pj.salto = { u: 0, de: [pj.x, pj.y, pj.z], a: [...pie(pj), 0] }; }
    } else if (pj.estado === "bajar" || pj.estado === "subir") {
      const s = pj.salto; s.u += dt / 0.55;
      const u = Math.min(1, s.u);
      // de: [x, y, z]; a: [x, z, y]
      pj.x = s.de[0] + (s.a[0] - s.de[0]) * u; pj.z = s.de[2] + (s.a[1] - s.de[2]) * u; pj.y = s.de[1] + (s.a[2] - s.de[1]) * u;
      salto = Math.sin(Math.PI * u) * 0.45; sqy = 1 + 0.08 * Math.sin(Math.PI * u);
      if (Math.abs(s.a[0] - s.de[0]) > 0.05) pj.dir = s.a[0] > s.de[0] ? 1 : -1;
      moviendo = true;
      if (u >= 1) {
        if (pj.estado === "bajar") { pj.estado = "paseo"; pj.tramos = 3 + Math.floor(Math.random() * 4); nuevaRuta(pj); }
        else { pj.estado = "sentado"; pj.resto = 25 + Math.random() * 20; if (!reducido) pj.rueda = { u: 0, dur: 0.9, alto: 0.32, sentido: pj.dir }; }
      }
    } else {
      if (pj.resto > 0) {
        pj.resto -= dt; sqy = 1 + 0.03 * Math.sin(t * 2.6); bamb = Math.sin(t * 1.9) * 0.05;
        if (pj.resto <= 0 && pj.estado === "paseo" && Math.random() < 0.4) pj.rueda = { u: 0, dur: 1.15, alto: 0.55, sentido: Math.random() < 0.5 ? -1 : 1 };
      } else if (!pj.ruta.length) {
        if (pj.estado === "volver") { pj.estado = "subir"; pj.salto = { u: 0, de: [pj.x, pj.y, pj.z], a: [pj.puesto.x, pj.puesto.z, pj.puesto.y] }; }
        else if (--pj.tramos > 0) { pj.resto = 0.8 + Math.random() * 1.6; nuevaRuta(pj); }
        else { pj.estado = "volver"; pj.resto = 0.6 + Math.random() * 0.8; pj.ruta = camino([pj.x, pj.z], pie(pj)) || [pie(pj)]; }
      } else {
        const [mx, mz] = pj.ruta[0], dx = mx - pj.x, dz = mz - pj.z, dist = Math.hypot(dx, dz);
        pj.fase += dt * 8.5;
        const s = Math.abs(Math.sin(pj.fase)), v = 1.5 * s * dt;
        if (dist <= v + 0.01) { pj.x = mx; pj.z = mz; pj.ruta.shift(); } else { pj.x += dx / dist * v; pj.z += dz / dist * v; }
        if (Math.abs(dx) > 0.05) pj.dir = dx > 0 ? 1 : -1;
        salto = s * 0.13; sqy = 0.86 + 0.2 * s; sqx = 1.14 - 0.18 * s;
        bamb = Math.sin(t * 3.4) * 0.1 + Math.sin(pj.fase) * 0.05;       // tambaleo
        moviendo = true;
      }
    }
    colocar(pj, salto, bamb, sqx, sqy, rodar, pj.estado === "sentado" ? pj.puesto.y : suelo);
    return moviendo;
  }

  /* ================================================================= CIELO DE LAS VENTANAS */
  const FASES = { noche: ["#0b1030", "#10163a", "#1a2250"], amanecer: ["#6b5b95", "#e88f6a", "#f6c177"], dia: ["#4f9ee6", "#6fb4e8", "#a5d6f4"], atardecer: ["#3b3a78", "#c9703a", "#f2a65a"] };
  function pintarCielo(t) {
    const st = window.Cielo ? window.Cielo.estado() : { fase: "noche", clima: "despejado", hora: 22 };
    const nublado = ["nublado", "lluvia", "tormenta", "niebla", "nieve"].includes(st.clima) ? 0.55 : 1;
    const cfg = { dia: [0xfff1d0, 34, 0.11, 1.42], amanecer: [0xffb080, 22, 0.08, 1.12], atardecer: [0xff9a5a, 22, 0.09, 1.12], noche: [0x7a8aff, 7, 0.035, 1.2] }[st.fase];
    ambiente.intensity = sala.ambiente.intensidad * cfg[3];
    for (const v of sala.ventanas) {
      const g = v.g2, [a, m, b] = FASES[st.fase];
      g.fillStyle = a; g.fillRect(0, 0, 36, 18); g.fillStyle = m; g.fillRect(0, 18, 36, 13); g.fillStyle = b; g.fillRect(0, 31, 36, 13);
      if (st.fase === "noche" && st.clima === "despejado") { g.fillStyle = "#fff"; [[4, 5], [14, 3], [26, 8], [31, 2], [9, 14]].forEach(([x, y], i) => { if ((Math.floor(t * 2) + i) % 5) g.fillRect(x, y, 1, 1); }); }
      const dia = st.hora >= 6 && st.hora < 19.5, u = dia ? (st.hora - 6) / 13.5 : ((st.hora + 4.5) % 24) / 10.5;
      const cx = Math.round(4 + 26 * Math.min(1, Math.max(0, u))), cy = Math.round(28 - Math.sin(Math.PI * Math.min(1, Math.max(0, u))) * 22);
      g.fillStyle = dia ? "#fff1b0" : "#f2ead2"; g.fillRect(cx - 3, cy - 3, 6, 6);
      if (!dia) { g.fillStyle = a; g.fillRect(cx - 1, cy - 4, 5, 6); }
      g.fillStyle = st.fase === "noche" ? "#141a30" : "#3b5a4a"; g.fillRect(0, 36, 36, 8); g.fillRect(6, 33, 9, 3); g.fillRect(22, 32, 10, 4);
      g.fillStyle = st.fase === "noche" ? "#ffd27a" : "#2a2a3a"; g.fillRect(9, 38, 1, 1); g.fillRect(26, 37, 1, 1);
      const nubes = { nublado: 3, lluvia: 3, tormenta: 4, niebla: 2, nieve: 3 }[st.clima] || 0;
      for (let i = 0; i < nubes; i++) { const x = Math.round((i * 13 + t * 0.6) % 46) - 10; g.fillStyle = st.clima === "tormenta" ? "#4a4f62" : st.fase === "noche" ? "#3b4468" : "#e8ecf4"; g.fillRect(x, 6 + i * 6, 12, 3); g.fillRect(x + 3, 4 + i * 6, 6, 2); }
      if (st.clima === "lluvia" || st.clima === "tormenta") { g.fillStyle = "#a9c4e8"; for (let i = 0; i < 14; i++) g.fillRect((i * 7) % 36, Math.floor((t * 40 + i * 11) % 44), 1, 3); }
      if (st.clima === "nieve") { g.fillStyle = "#fff"; for (let i = 0; i < 12; i++) g.fillRect((i * 11 + Math.floor(Math.sin(t + i) * 2)) % 36, Math.floor((t * 8 + i * 9) % 44), 1, 1); }
      if (st.clima === "tormenta" && (t % 7) < 0.12) { g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(0, 0, 36, 44); }
      v.tex.needsUpdate = true;
      const clave2 = st.fase + st.clima;
      if (clave2 !== v.estado) {
        v.estado = clave2;
        v.luz.color.set(cfg[0]); v.luz.intensity = cfg[1] * nublado;
        if (v.rayo) { v.rayo.material.color.set(cfg[0]); v.rayo.material.opacity = cfg[2] * nublado; }
        if (v.polvo) v.polvo.material.opacity = st.fase === "noche" ? 0.2 : 0.5 * nublado;
      }
      if (v.polvo && !reducido) {
        const a2 = v.polvo.geometry.attributes.position;
        for (let i = 0; i < a2.count; i++) { let y = a2.getY(i) + Math.sin(t * 0.7 + i) * 0.0015 + 0.0012; if (y > 3.0) y = 0.3; a2.setY(i, y); a2.setX(i, a2.getX(i) + Math.sin(t * 0.5 + i * 1.7) * 0.0012); }
        a2.needsUpdate = true;
      }
    }
  }

  /* ================================================================= ENTRADA: pasar el cursor, pulsar */
  const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
  let encima = null;
  const parallax = { x: 0, y: 0, ox: 0, oy: 0 };
  const brillo = new THREE.Color(0x2e2418), negro = new THREE.Color(0);
  function resaltar(g, si) { g.traverse(o => { if (o.isMesh && o.userData.em0) o.material.emissive.copy(o.userData.em0).add(si ? brillo : negro); }); }
  function bajoPuntero(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    const hit = rayo.intersectObjects(sala.zonas, true)[0];
    let g = hit && hit.object;
    while (g && !g.userData.zona) g = g.parent;
    return { zona: g || null, r };
  }
  function alMover(ev) {
    if (!sala) return;
    const { zona: z, r } = bajoPuntero(ev);
    parallax.x = (ev.clientX - r.left) / r.width - 0.5; parallax.y = (ev.clientY - r.top) / r.height - 0.5;
    if (z !== encima) { if (encima) resaltar(encima, false); if (z) resaltar(z, true); encima = z; }
    let texto = z ? z.userData.zona.nombre : "";
    if (!z) {
      const h = rayo.intersectObjects([...gente.values()].map(pj => pj.malla), false)[0];
      if (h) { const p = h.object.userData.personaje, info = (window.PROTAGONISTAS || {})[clave(p.nombre)]; texto = p.nombre + (info && info.personaje ? " · " + info.personaje : ""); }
    }
    renderer.domElement.style.cursor = z ? "pointer" : "";
    etiqueta.hidden = !texto;
    if (texto) {
      etiqueta.textContent = texto;
      const x = ev.clientX - r.left + 12, y = ev.clientY - r.top + 14;
      etiqueta.style.left = Math.min(x, r.width - etiqueta.offsetWidth - 4) + "px"; etiqueta.style.top = Math.min(y, r.height - 24) + "px";
    }
  }
  function alSalir() { if (encima) resaltar(encima, false); encima = null; etiqueta.hidden = true; parallax.x = parallax.y = 0; renderer.domElement.style.cursor = ""; }
  function alPulsar(ev) {
    const { zona: z } = bajoPuntero(ev);
    if (!z) return;
    const href = z.userData.zona.href;
    if (href.startsWith("#")) { if (location.hash !== href) location.hash = href; else construir(href.slice(1)); }
    else location.href = base + href;
  }
  renderer.domElement.addEventListener("pointermove", alMover);
  renderer.domElement.addEventListener("pointerleave", alSalir);
  renderer.domElement.addEventListener("click", alPulsar);
  const alHash = () => { const h = decodeURIComponent((location.hash || "").slice(1)); construir(SALAS[h] ? h : "taberna"); };
  window.addEventListener("hashchange", alHash);

  /* ================================================================= BUCLE */
  let raf = 0, ultimo = 0, enPantalla = true, reloj = 0, ultimoCielo = -99;
  function tamano() {
    const w = caja.clientWidth, h = Math.round(w / ASPECTO);
    if (!w) return;
    const pr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(1.3e6 / Math.max(1, w * h)));
    renderer.setPixelRatio(pr); renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "auto";
    camara.aspect = w / h; camara.updateProjectionMatrix();
  }
  function actualizar(dt) {
    reloj += dt;
    for (const fn of sala.animar) fn(dt, reloj);
    if (reloj - ultimoCielo > (reducido ? 30 : 0.15)) { pintarCielo(reloj); ultimoCielo = reloj; }
    let anda = false;
    for (const pj of gente.values()) anda = animarPersonaje(pj, dt) || anda;
    if (!reducido) {
      parallax.ox += (parallax.x - parallax.ox) * 0.08; parallax.oy += (parallax.y - parallax.oy) * 0.08;
      camara.position.set(CAM.x + parallax.ox * 0.9, CAM.y - parallax.oy * 0.4, CAM.z);
      camara.lookAt(MIRA);
    }
    return anda;
  }
  let anda = false;
  let revisado = 0;
  function paso(ahora) {
    raf = requestAnimationFrame(paso);
    if (!enPantalla || document.hidden || !sala) return;
    // El rol de admin se sabe un poco después de cargar: si cambia, se rehace la sala (aparecen o se quitan sus puertas)
    if (ahora - revisado > 2000) { revisado = ahora; if (admin() !== sala.admin) { construir(sala.clave); return; } }
    const fps = reducido ? 12 : anda || encima ? 30 : 20;
    if (ahora - ultimo < 1000 / fps - 2) return;
    const dt = Math.min(0.1, (ahora - (ultimo || ahora)) / 1000);
    ultimo = ahora;
    anda = actualizar(dt);
    renderer.render(escena, camara);
  }
  function pintarUnaVez() { actualizar(0); renderer.shadowMap.needsUpdate = true; renderer.render(escena, camara); }

  const ro = new ResizeObserver(() => { tamano(); if (sala) renderer.render(escena, camara); }); ro.observe(caja);
  const io = new IntersectionObserver(e => { enPantalla = e[0].isIntersecting; }); io.observe(caja);
  tamano();
  alHash();
  raf = requestAnimationFrame(paso);

  return {
    fijar,
    ir: c => { location.hash = "#" + c; },
    sala: () => sala && sala.clave,
    destruir() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener("hashchange", alHash); renderer.dispose(); renderer.domElement.remove(); etiqueta.remove(); },
    medir() { const gl = renderer.getContext(); const t0 = performance.now(); renderer.render(escena, camara); gl.finish(); return performance.now() - t0; },
    _escena: escena, _camara: camara, _gente: gente, _actualizar: actualizar, _pintar: () => renderer.render(escena, camara), _zonas: () => sala.zonas.map(z => z.userData.zona)
  };
}

window.Salas3D = { montar: montarSalas3D };
