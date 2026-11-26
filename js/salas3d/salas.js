/* =============================================================================
   LAS SALAS 2.5D (las monta js/salas3d/motor.js)
   Cada página del sitio está en una sola sala, y cada sala tiene un propósito y una composición propia:
     taberna    vida social: la mesa de los protagonistas, la chimenea con los fanarts, la barra, la rocola, el tablón y el Intercambios;
                desde aquí se sube a Mi habitación y se entra a las demás salas
     biblioteca verticalidad: el compendio por estantes en dos alturas, con galería y escalera
     juegos     sala recreativa: máquinas, arquería, ajedrez (y, solo admin, duelo y Ostelar)
     naipes     salón de naipes: Triunfos, Las Veintiuna Velas y El Pozo del Dragón
     campana    sala de campaña: el Tablero, el Mapa, Mis personajes, el Registro y el tablón de Discord
     establos   el Hipódromo (por el portón), el Hipódromo en vivo y los Corrales con sus criaturas
     despacho   solo admin: el panel, los editores y el Concurso (que sigue cerrado al público)
   docs/pruebas-web/enlaces_lobby.js comprueba que todas las páginas de MAPA (js/lobby-salas.js) estén aquí.
============================================================================= */

/* ---------------------------------------------------------------- piezas que se repiten entre salas */
function estanteria(c, x, z, w, h, sem, padre, filas = 5, ry = 0) {
  const g = c.grupo(x, 0, z, padre === undefined ? undefined : padre);
  g.rotation.y = ry;
  const marco = c.L(c.T.madera("#5a3b22", 2));
  c.caja3(w, h, 0.5, marco, 0, 0, 0, g);
  c.plano(w - 0.14, h - 0.14, c.L(c.T.libros(sem, filas)), 0, h / 2, 0.255, 0, 0, g);
  c.caja3(w + 0.14, 0.12, 0.6, marco, 0, h, 0, g);
  return g;
}
function barril(c, x, z, r = 0.34, alto = 0.8, y = 0) { c.cilindro(r, r, alto, 12, c.L(c.T.barril()), x, y, z); }
function planta(c, x, z, alto = 0.9) { c.sprite(c.S.planta(), alto * 0.75, alto, x, alto / 2, z); }
function silla(c, x, z, ry = 0, padre) {
  const g = c.grupo(x, 0, z, padre); g.rotation.y = ry;
  const madera = c.L(c.T.madera("#6b4a2f", 12));
  c.caja3(0.5, 0.06, 0.5, madera, 0, 0.46, 0, g);
  c.caja3(0.5, 0.6, 0.06, madera, 0, 0.5, -0.22, g);
  [[-0.21, -0.21], [0.21, -0.21], [-0.21, 0.21], [0.21, 0.21]].forEach(([a, b]) => c.caja3(0.05, 0.46, 0.05, c.color(0x4a2f1c), a, 0, b, g));
  return g;
}
function farol(c, x, y, z, col = 0xffa850, fuerza = 8) {
  c.caja3(0.2, 0.28, 0.2, c.color(0x2b2b33), x, y, z, null, false);
  c.caja3(0.14, 0.2, 0.14, c.basica(0xffc46a), x, y + 0.04, z, null, false);
  c.puntual(col, fuerza, 6, x + (x < 0 ? 0.3 : x > 0 ? -0.3 : 0), y, z + 0.3);
}
function lampara(c, x, z, alto = 3.6, radio = 0.75, sombra = true, fuerza = 46) {
  const lg = c.grupo(x, alto, z);
  const aro = new c.THREE.Mesh(new c.THREE.TorusGeometry(radio, 0.05, 4, 12), c.color(0x2b2b33)); aro.rotation.x = Math.PI / 2; lg.add(aro);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; c.vela(Math.cos(a) * radio, 0.03, Math.sin(a) * radio, 0.16, lg); }
  c.caja3(0.03, c.ALTO - alto, 0.03, c.color(0x2b2b33), 0, 0.05, 0, lg, false);
  const luz = c.foco(0xffc478, fuerza, 11, 1.05, x, alto - 0.1, z, x, 0, z + 0.2, sombra);
  c.animar((dt, t) => { luz.intensity = fuerza * (c.reducido ? 1 : 0.97 + Math.sin(t * 7.1) * 0.02); });
  return lg;
}
// Pantalla animada (máquinas, espejo del directo): un lienzo pequeño que se redibuja
function pantalla(c, w, h, pintor, x, y, z, padre, ry = 0) {
  const [lz] = c.lienzo(w, h), g2 = lz.getContext("2d"), tex = c.textura(lz);
  const m = c.plano(1, 1, new c.THREE.MeshBasicMaterial({ map: tex }), x, y, z, ry, 0, padre);
  c.animar((dt, t) => { pintor(g2, c.reducido ? 0 : t, w, h); tex.needsUpdate = true; });
  pintor(g2, 0, w, h); tex.needsUpdate = true;
  return m;
}
/* ================================================================= LA TABERNA */
function taberna(c) {
  const { T, S, ZF } = c;
  c.cascaron();
  c.luzAmbiente(1.2);

  // Fondo, a la izquierda: la entrada a la Biblioteca entre dos estanterías
  {
    const g = c.grupo(-5.2, 0, 0, null);
    estanteria(c, -1.15, ZF + 0.3, 1.1, 3.2, 4, g, 5);
    estanteria(c, 1.15, ZF + 0.3, 1.1, 3.2, 8, g, 5);
    c.caja3(1.4, 0.3, 0.55, c.L(T.madera("#5a3b22", 2)), 0, 2.55, ZF + 0.3, g);
    const [lz, k] = c.lienzo(24, 36);
    k.fillStyle = "#0e0a12"; k.fillRect(0, 0, 24, 36);
    k.fillStyle = "#3a2516"; k.fillRect(2, 8, 20, 28);
    const lib = ["#8e2f2f", "#2f4f7a", "#b88a2e", "#3f6b3a", "#5d3a78"];
    for (let f = 0; f < 4; f++) for (let i = 0; i < 9; i++) { k.fillStyle = lib[(i * 3 + f) % 5]; k.fillRect(3 + i * 2, 10 + f * 7, 2, 5 + ((i + f) % 2)); }
    k.fillStyle = "rgba(255,190,110,.22)"; k.fillRect(0, 0, 24, 36);
    c.plano(1.2, 2.5, c.L(c.textura(lz)), 0, 1.27, ZF + 0.06, 0, 0, g);
    c.sprite(S.planta(), 0.5, 0.66, 1.4, 3.53, ZF + 0.3, 0, g);
    c.plano(1.2, 0.24, new c.THREE.MeshLambertMaterial({ map: T.letrero("BIBLIOTECA", "#2a1a10", "#e8c87a", 96, 20) }), 0, 2.7, ZF + 0.58, 0, 0, g);
    c.zona(g, "#biblioteca", "Biblioteca");
    c.ocupar(-5.2, ZF + 0.3, 3.4, 0.6);
  }
  // Fondo: la puerta trasera de los Establos
  c.puerta(0, -2.55, "#establos", "Establos", { doble: true, ancho: 1.4, alto: 2.3, madera: "#8a6a3a", letrero: "ESTABLOS" });
  { const h = new c.THREE.Mesh(new c.THREE.TorusGeometry(0.16, 0.035, 4, 10, Math.PI), c.color(0x8d8d99)); h.position.set(-2.55, 2.95, ZF + 0.1); h.rotation.z = Math.PI; c.add(h); }
  c.caja3(0.9, 0.45, 0.55, c.L(T.heno()), -3.55, 0, ZF + 0.95); c.ocupar(-3.55, ZF + 0.95, 0.9, 0.55);
  // Chimenea, fuego y el cuadro que cicla los fanarts
  {
    const piedra = c.L(T.piedra("#7a6e66", 27, [1.4, 1.1]));
    c.caja3(2.7, 2.15, 0.7, piedra, 0, 0, ZF + 0.35);
    c.caja3(1.9, c.ALTO - 2.15, 0.45, c.L(T.piedra("#6d6470", 29, [1, 1.2])), 0, 2.15, ZF + 0.23);
    c.caja3(3.0, 0.16, 0.9, c.L(T.madera("#5a3a22", 5)), 0, 2.12, ZF + 0.4);
    c.plano(1.5, 1.05, c.color(0x120a08), 0, 0.72, ZF + 0.706);
    [[-0.25, 0.3], [0.2, -0.25]].forEach(([x, r]) => { const l = c.cilindro(0.08, 0.08, 0.9, 6, c.color(0x5a3a22), x, 0.08, ZF + 0.8); l.rotation.z = Math.PI / 2 + r * 0.3; });
    c.fuego(0, 0.6, ZF + 0.72);
    [-1.2, 1.2].forEach(x => c.vela(x, 2.28, ZF + 0.35));
    const f = c.grupo(0, 3.2, ZF + 0.5, null);
    c.caja3(1.34, 1.02, 0.08, c.color(0xb8862e), 0, -0.51, 0, f, false);
    const lienzo = c.plano(1.16, 0.84, new c.THREE.MeshLambertMaterial({ color: 0x6b5a4a }), 0, 0, 0.045, 0, 0, f);
    c.zona(f, "fanarts.html", "Fanarts");
    const fan = (window.ROTACION || []).slice();
    if (fan.length) {
      let i = 0, desde = 0;
      c.imagen(lienzo.material, fan[0], 1.16, 0.84);
      c.animar((dt, t) => { if (t - desde > 7 && fan.length > 1) { desde = t; i = (i + 1) % fan.length; c.imagen(lienzo.material, fan[i], 1.16, 0.84); } });
    }
    c.ocupar(0, ZF + 0.4, 2.8, 0.8);
  }
  // La barra: botellero en la pared, ventana encima, mostrador, el tabernero y taburetes
  {
    c.caja3(4.0, 2.0, 0.36, c.L(T.madera("#4a2f1c", 9)), 4.4, 0, ZF + 0.2);
    c.plano(3.8, 1.9, c.L(T.botellas()), 4.4, 1.0, ZF + 0.385);
    c.ventana(4.4, 2.45, 1.4, 1.35);
    c.figura([S.tabernero(0), S.tabernero(1)], 0.95, 1.45, 4.6, 0, ZF + 0.95, { cambio: 1.1, sombra: false });
    const madera = c.L(T.madera("#6b4425", 19));
    c.caja3(3.9, 1.0, 0.55, madera, 4.45, 0, ZF + 1.55);
    c.caja3(4.1, 0.08, 0.7, c.L(T.madera("#8a5a32", 20)), 4.45, 1.0, ZF + 1.55);
    [[3.2], [4.5], [5.8]].forEach(([x], i) => {
      c.cilindro(0.06, 0.06, 0.16, 8, c.color(0xc9a14a), x - 0.2, 1.08, ZF + 1.6);
      c.cilindro(0.065, 0.065, 0.03, 8, c.color(0xfff1b0), x - 0.2, 1.24, ZF + 1.6);
      c.cilindro(0.22, 0.22, 0.07, 10, madera, x, 0.66, ZF + 2.25);
      c.cilindro(0.04, 0.04, 0.66, 6, c.color(0x4a2f1c), x, 0, ZF + 2.25);
    });
    c.ocupar(4.45, ZF + 1.0, 4.1, 2.0);
    c.ocupar(4.5, ZF + 2.25, 3.2, 0.5, 0.2);
  }
  // Pared izquierda: la escalera que sube a Mi habitación y la puerta de la Sala de campaña
  {
    const g = c.grupo(0, 0, 0, null);
    const madera = c.L(T.madera("#6b4a2f", 22)), oscura = c.color(0x4a2f1c);
    const n = 10, zAbajo = 0.6, zArriba = -3.0, alto = 2.4, x = -6.4;
    for (let i = 0; i < n; i++) {
      const z = zAbajo - (i + 0.5) * (zAbajo - zArriba) / n, y = (i + 1) * alto / n;
      c.caja3(1.1, 0.08, (zAbajo - zArriba) / n + 0.02, madera, x, y - 0.08, z, g);
      c.caja3(1.1, y - 0.08, 0.05, oscura, x, 0, z + (zAbajo - zArriba) / n / 2 - 0.03, g, false);
    }
    c.caja3(1.1, 0.1, 1.3, madera, x, alto - 0.1, zArriba - 0.65, g);
    const zanca = c.caja3(0.08, 0.3, Math.hypot(zAbajo - zArriba, alto) + 0.2, oscura, x + 0.56, 0, (zAbajo + zArriba) / 2, g);
    zanca.position.y = alto / 2 + 0.1; zanca.rotation.x = Math.atan2(alto, zAbajo - zArriba);
    for (let i = 0; i <= 5; i++) { const z = zAbajo - i * (zAbajo - zArriba) / 5; c.caja3(0.05, 0.75, 0.05, oscura, x + 0.56, (i / 5) * alto, z, g, false); }
    const pasamanos = c.caja3(0.07, 0.07, Math.hypot(zAbajo - zArriba, alto) + 0.2, madera, x + 0.56, 0, (zAbajo + zArriba) / 2, g, false);
    pasamanos.position.y = alto / 2 + 0.75; pasamanos.rotation.x = zanca.rotation.x;
    // La puerta de arriba, en el rellano
    const p = c.grupo(c.X0 + 0.02, alto, zArriba - 0.7, g); p.rotation.y = Math.PI / 2;
    c.caja3(1.1, 1.65, 0.1, c.color(0x2a1a10), 0, 0, 0, p, false);
    c.plano(0.9, 1.55, c.L(T.puerta("#7a4a2a")), 0, 0.78, 0.055, 0, 0, p);
    c.zona(g, "habitacion.html", "Mi habitación (arriba)");
    c.ocupar(x, (zAbajo + zArriba) / 2 - 0.3, 1.2, zAbajo - zArriba + 1.3);
  }
  c.puerta(-1, 1.55, "#campana", "Sala de campaña", { madera: "#4a5a3a", icono: "mapa" });
  // Pared derecha: Sala recreativa, Salón de naipes y (solo admin) el Despacho
  c.puerta(1, -2.55, "#juegos", "Sala recreativa", { madera: "#5a2f6a", letrero: "RECREATIVA" });
  c.puerta(1, -0.35, "#naipes", "Salón de naipes", { madera: "#6b2a2a", icono: "dado" });
  if (c.admin) c.puerta(1, 1.6, "#despacho", "Despacho (admin)", { madera: "#3d2a1a", ancho: 0.9, alto: 1.9 });
  farol(c, c.X0 + 0.25, 2.9, 0.4); farol(c, c.X1 - 0.25, 2.9, 0.65);

  // La mesa común (el foco): banco detrás, taburetes en las cabeceras, jarras y la lámpara de velas
  const PUESTOS = [
    { x: -0.55, z: -0.62, y: 0.44, capa: "banco" }, { x: 0.55, z: -0.62, y: 0.44, capa: "banco" },
    { x: -1.6, z: -0.62, y: 0.44, capa: "banco" }, { x: 1.6, z: -0.62, y: 0.44, capa: "banco" },
    { x: -2.72, z: 0.2, y: 0.58, capa: "cabecera" }, { x: 2.72, z: 0.2, y: 0.58, capa: "cabecera" }
  ];
  {
    c.plano(6.6, 3.6, c.L(T.alfombra()), 0, 0.012, 0.0, 0, -Math.PI / 2);
    const madera = c.L(T.madera("#7a5332", 14)), oscura = c.color(0x4a2f1c);
    c.caja3(4.3, 0.12, 1.05, madera, 0, 0.78, 0.18);
    [[-1.95, -0.25], [1.95, -0.25], [-1.95, 0.6], [1.95, 0.6]].forEach(([x, z]) => c.caja3(0.14, 0.78, 0.14, oscura, x, 0, z));
    c.caja3(4.0, 0.08, 0.08, oscura, 0, 0.25, 0.18);
    c.caja3(4.3, 0.1, 0.42, madera, 0, 0.4, -0.62);
    c.caja3(4.3, 0.4, 0.06, oscura, 0, 0, -0.45);
    [-2.0, 2.0].forEach(x => c.caja3(0.1, 0.4, 0.4, oscura, x, 0, -0.62));
    [-2.72, 2.72].forEach(x => { c.cilindro(0.26, 0.26, 0.08, 10, madera, x, 0.5, 0.2); c.cilindro(0.05, 0.05, 0.5, 6, oscura, x, 0, 0.2); });
    c.caja3(0.5, 0.1, 0.24, c.color(0xd9c9a0), -0.05, 0.9, 0.3, null, false);
    c.caja3(0.2, 0.09, 0.14, c.color(0xd4a24a), -0.05, 1.0, 0.3, null, false);
    c.vela(0.45, 0.9, 0.36, 0.22);
    c.cilindro(0.11, 0.1, 0.26, 8, c.color(0xc9a14a), -0.6, 0.9, 0.45);
    PUESTOS.forEach(p => {
      const jx = p.capa === "banco" ? p.x + 0.2 : p.x * 0.8, jz = p.capa === "banco" ? 0.0 : 0.3;
      c.cilindro(0.07, 0.07, 0.16, 8, c.color(0xc9a14a), jx, 0.9, jz);
      c.cilindro(0.075, 0.075, 0.03, 8, c.color(0xfff1b0), jx, 1.06, jz);
    });
    lampara(c, 0, 0.2);
    c.ocupar(0, -0.05, 4.4, 1.55, 0.25);
    c.ocupar(-2.72, 0.2, 0.5, 0.5); c.ocupar(2.72, 0.2, 0.5, 0.5);
  }
  c.puestos(PUESTOS);

  // Delante a la izquierda: el tablón de peticiones de pie (con los cuatro fanarts más nuevos) y la rocola en la esquina
  {
    const g = c.grupo(-3.75, 0, 2.35, null);
    g.rotation.y = 0.35;
    const oscura = c.color(0x4a2f1c);
    c.caja3(0.1, 2.3, 0.1, oscura, -0.85, 0, 0, g); c.caja3(0.1, 2.3, 0.1, oscura, 0.85, 0, 0, g);
    const tejado = c.caja3(1.95, 0.08, 0.5, c.L(T.madera("#5a3b22", 6)), 0, 2.3, 0, g); tejado.rotation.x = 0.0;
    c.caja3(1.72, 1.15, 0.06, c.L(T.madera("#5a3b22", 6)), 0, 1.0, 0, g);
    c.plano(1.56, 1.0, c.L(T.corcho()), 0, 1.575, 0.035, 0, 0, g);
    c.plano(1.0, 0.2, new c.THREE.MeshLambertMaterial({ map: T.letrero("PETICIONES", "#2a1a10", "#e8c87a", 96, 20) }), 0, 2.2, 0.04, 0, 0, g);
    c.zona(g, "peticiones.html", "Tablón de peticiones");
    const fan = (window.ROTACION || []).slice(-4).reverse();
    [[-0.45, 0.22], [-0.05, 0.25], [0.32, -0.08], [-0.3, -0.22]].forEach(([x, y], i) => {
      const m = c.grupo(x, 1.575 + y, 0.06, g);
      const foto = c.plano(0.34, 0.34, new c.THREE.MeshLambertMaterial({ color: 0xdddddd }), 0, 0, 0, 0, 0, m);
      c.caja3(0.05, 0.05, 0.03, c.color(0xc0392b), 0, 0.15, 0.02, m, false);
      m.rotation.z = (i % 2 ? 1 : -1) * 0.06;
      m.removeFromParent(); g.add(m);
      c.zona(m, "fanarts.html", "Fanarts");
      if (fan[i]) c.imagen(foto.material, fan[i], 1, 1);
    });
    c.ocupar(-3.75, 2.35, 2.0, 0.5);
  }
  {
    const g = c.grupo(-6.05, 0, 2.65, null);
    g.rotation.y = 0.5;
    c.caja3(0.85, 1.35, 0.6, c.color(0x6b2a2a), 0, 0, 0, g);
    const arcoR = c.cilindro(0.425, 0.425, 0.6, 14, c.color(0x7a3232), 0, 0, 0, g, Math.PI);
    arcoR.rotation.set(Math.PI / 2, 0, Math.PI / 2); arcoR.position.set(0, 1.35, 0);
    c.plano(0.62, 0.5, c.color(0x2a1a2a), 0, 0.95, 0.305, 0, 0, g);
    const tiras = [0, 1, 2].map(k => c.plano(0.08, 0.9, c.basica(0xffb04a), -0.22 + k * 0.22, 0.6, 0.31, 0, 0, g));
    c.caja3(0.7, 0.12, 0.62, c.color(0xb8862e), 0, 0.2, 0, g);
    c.zona(g, "rocola.html", "Rocola");
    const luz = c.puntual(0xff4a9a, 2.4, 3, -5.6, 1.0, 2.9);
    c.animar((dt, t) => { tiras.forEach((m, k) => m.material.color.setHSL(((t * 0.08 + k * 0.33) % 1), 0.8, 0.6)); luz.color.setHSL((t * 0.08) % 1, 0.8, 0.55); });
    c.ocupar(-6.05, 2.65, 0.9, 0.7);
  }
  // Delante a la derecha: el puesto de Intercambios
  {
    const g = c.grupo(4.7, 0, 2.15, null);
    c.caja3(1.9, 0.95, 0.75, c.L(T.madera("#7a5030", 18)), 0, 0, 0, g);
    c.caja3(2.0, 0.08, 0.85, c.color(0x4a2f1c), 0, 0.95, 0, g);
    [[-0.92, -0.3], [0.92, -0.3]].forEach(([x, z]) => c.caja3(0.08, 2.15, 0.08, c.color(0x4a2f1c), x, 0, z, g));
    const toldo = c.plano(2.2, 1.0, c.L(T.toldo(), { side: c.THREE.DoubleSide }), 0, 2.0, 0.05, 0, -0.95, g);
    toldo.castShadow = true;
    c.caja3(0.3, 0.22, 0.25, c.L(T.caja()), -0.55, 1.03, -0.1, g); c.caja3(0.22, 0.18, 0.2, c.L(T.caja()), 0.5, 1.03, 0.05, g);
    const rollo = c.cilindro(0.08, 0.08, 0.5, 8, c.color(0x2f6b6b), 0.05, 1.11, -0.15, g); rollo.rotation.z = Math.PI / 2;
    c.caja3(0.14, 0.2, 0.14, c.basica(0xffc46a), 0.75, 1.4, 0.3, g, false);
    c.zona(g, "intercambios.html", "Intercambios");
    c.puntual(0xffb050, 4, 4, 5.45, 1.6, 2.75);
    c.ocupar(4.7, 2.15, 2.0, 0.85, 0.36);
  }
  // Rincones sin enlace: barriles, planta y el gato junto al fuego
  barril(c, 6.35, 3.0, 0.36, 0.85); barril(c, 6.35, 3.0, 0.32, 0.75, 0.85);
  c.ocupar(6.35, 3.0, 0.8, 0.8);
  planta(c, 2.05, ZF + 0.5, 0.85); c.ocupar(2.05, ZF + 0.5, 0.4, 0.4);
  const gato = c.sprite(S.gato(0), 0.6, 0.3, 1.75, 0.15, ZF + 1.1);
  c.animar((dt, t) => { const m = S.gato(Math.floor(t / 1.6) % 2); if (gato.material.map !== m) gato.material.map = m; });
  c.ocupar(1.75, ZF + 1.1, 0.6, 0.3, 0.2);
}

/* ================================================================= LA BIBLIOTECA (verticalidad: dos alturas de estantes) */
const MUNDO = [["cronologia.html", "Cronología", "reloj"], ["lugares.html", "Lugares", "mapa"], ["facciones.html", "Facciones", "estandarte"], ["personajes.html", "Personajes", "corona"], ["razas.html", "Razas", "arbol"], ["religion.html", "Religión", "sol"]];
const ARCHIVO = [["textos.html", "Textos", "pluma"], ["pergaminos.html", "Pergaminos", "pergamino"], ["armas.html", "Armas", "espada"], ["objetos.html", "Objetos", "cofre"], ["bestiario.html", "Bestiario", "calavera"]];
const REGLAS = [["reglas.html", "Reglas", "balanza"], ["economia.html", "Economía", "moneda"], ["estadisticas.html", "Estadísticas", "dado"], ["biblioteca.html", "Biblioteca de los jugadores", "gente"]];

function biblioteca(c) {
  const { T, S, ZF } = c;
  c.cascaron({ alto: 5.6, pared: T.papel("#2f3a2a", "#3a4a32"), postes: [] });
  c.camara([0, 9.8, 17.6], [0, 2.55, -0.9]);
  c.luzAmbiente(1.3, 0x7a8aaa, 0x3a2a1a);
  const libroEstante = (x, z, w, h, def, sem, padre, ry = 0, banda = "#3f6b3a") => {
    const g = estanteria(c, x, z, w, h, sem, null, Math.max(3, Math.round(h / 0.62)), ry);
    c.caja3(0.62, 0.36, 0.06, c.color(0x2a1a10), 0, h + 0.14, 0.27, g, false);
    c.sprite(S.icono(def[2]), 0.3, 0.3, 0, h + 0.32, 0.31, 0, g);
    c.plano(w - 0.1, 0.08, c.basica(new c.THREE.Color(banda).getHex()), 0, h - 0.1, 0.258, 0, 0, g);
    return c.zona(g, def[0], def[1]);
  };
  // Abajo, pared del fondo: Mundo
  MUNDO.forEach((d, i) => libroEstante(-5.25 + i * 2.1, ZF + 0.3, 1.9, 2.25, d, 30 + i, null, 0, "#3f6b3a"));
  // La galería: suelo volado, barandilla y los estantes del Archivo arriba
  {
    const madera = c.L(T.madera("#5a3b22", 33)), oscura = c.color(0x3a2516);
    const losa = c.caja3(13.9, 0.18, 1.55, madera, 0, 2.95, ZF + 0.78);
    c.caja3(13.9, 0.24, 0.06, oscura, 0, 2.89, ZF + 1.57);
    [-6.5, -2.15, 2.15, 6.5].forEach(x => c.caja3(0.16, 2.95, 0.16, oscura, x, 0, ZF + 1.45));
    for (let i = 0; i <= 34; i++) c.caja3(0.04, 0.62, 0.04, oscura, -6.8 + i * 0.4, 3.13, ZF + 1.5, null, false);
    c.caja3(13.9, 0.07, 0.09, madera, 0, 3.73, ZF + 1.5, null, false);
    c.plano(1.6, 0.32, new c.THREE.MeshLambertMaterial({ map: T.letrero("ARCHIVO", "#2a1a10", "#e8c87a", 96, 20) }), 0, 4.15, ZF + 1.5);
    c.plano(1.6, 0.32, new c.THREE.MeshLambertMaterial({ map: T.letrero("MUNDO", "#2a1a10", "#e8c87a", 96, 20) }), 0, 2.84, ZF + 1.61);
    losa.castShadow = true;
    [-4.2, 0, 4.2].forEach(x => { c.puntual(0xffc880, 7, 4.5, x, 2.6, ZF + 1.4); c.caja3(0.16, 0.1, 0.16, c.basica(0xffd890), x, 2.78, ZF + 1.3, null, false); });
  }
  ARCHIVO.forEach((d, i) => libroEstante(-4.8 + i * 2.4, ZF + 0.3, 2.0, 2.0, d, 50 + i, null, 0, "#7a2f2f").position.y = 3.13);
  // La escalera de mano que sube a la galería
  {
    const g = c.grupo(6.25, 0, ZF + 1.9);
    g.rotation.x = -0.28;
    const oscura = c.color(0x8d6a45);
    c.caja3(0.06, 3.4, 0.06, oscura, -0.25, 0, 0, g); c.caja3(0.06, 3.4, 0.06, oscura, 0.25, 0, 0, g);
    for (let i = 1; i < 11; i++) c.caja3(0.5, 0.04, 0.05, oscura, 0, i * 0.31, 0, g, false);
  }
  // Pared derecha: Reglas y cifras (la Biblioteca de los jugadores con lomos de otros colores)
  REGLAS.forEach((d, i) => libroEstante(c.X1 - 0.3, -2.0 + i * 1.3, 1.15, 2.25, d, 70 + i * 3, null, -Math.PI / 2, i === 3 ? "#4f7fb5" : "#c9a14a"));
  c.plano(1.6, 0.32, new c.THREE.MeshLambertMaterial({ map: T.letrero("REGLAS Y CIFRAS", "#2a1a10", "#e8c87a", 120, 20) }), c.X1 - 0.05, 3.25, -0.05, -Math.PI / 2);
  // Pared izquierda: la puerta a la taberna y el rincón de lectura (sillón, lámpara de pie, globo)
  c.puerta(-1, -0.6, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  {
    const roja = c.color(0x8a2f3a);
    c.caja3(1.1, 0.42, 0.9, roja, -5.4, 0, 2.2); c.caja3(1.1, 0.75, 0.2, roja, -5.4, 0.42, 1.8); c.caja3(0.18, 0.62, 0.9, roja, -5.95, 0.2, 2.2); c.caja3(0.18, 0.62, 0.9, roja, -4.85, 0.2, 2.2);
    c.caja3(0.06, 1.5, 0.06, c.color(0x8d8d99), -6.3, 0, 1.6, null, false);
    c.caja3(0.36, 0.22, 0.36, c.basica(0xffe0a0), -6.3, 1.5, 1.6, null, false);
    c.puntual(0xffc070, 6, 4, -6.0, 1.7, 1.9);
    const globo = new c.THREE.Mesh(new c.THREE.SphereGeometry(0.32, 10, 8), c.color(0x3f7fb5)); globo.position.set(-3.9, 1.2, 2.6); globo.castShadow = true; c.add(globo);
    c.caja3(0.05, 0.85, 0.05, c.color(0x8d6a45), -3.9, 0, 2.6); c.caja3(0.4, 0.05, 0.4, c.color(0x6b4a2f), -3.9, 0, 2.6);
    c.animar((dt, t) => { globo.rotation.y = c.reducido ? 0 : t * 0.3; });
  }
  // En el centro, la mesa de lectura con el Compendio abierto (el que lo tiene todo)
  {
    const g = c.grupo(0.4, 0, 0.6, null);
    const madera = c.L(T.madera("#6b4a2f", 36));
    c.caja3(3.4, 0.1, 1.2, madera, 0, 0.78, 0, g);
    [[-1.55, -0.5], [1.55, -0.5], [-1.55, 0.5], [1.55, 0.5]].forEach(([x, z]) => c.caja3(0.12, 0.78, 0.12, c.color(0x4a2f1c), x, 0, z, g));
    const libro = c.plano(0.9, 0.58, c.L(S.libroAbierto()), 0, 0.9, 0.0, 0, -Math.PI / 2, g);
    libro.scale.set(1, 1, 1);
    c.caja3(0.06, 0.3, 0.06, c.color(0xc9a14a), 1.2, 0.88, -0.25, g, false);
    c.caja3(0.36, 0.14, 0.3, c.basica(0x2f6a4d), 1.2, 1.18, -0.25, g, false);
    c.zona(g, "compendio.html", "El Compendio completo");
    silla(c, -0.6, 1.55, Math.PI, null); silla(c, 1.4, -0.35, 0);
    c.puntual(0xffd890, 7, 4, 1.6, 1.6, 0.4);
  }
  c.plano(6.0, 3.2, c.L(T.alfombra()), 0.4, 0.012, 0.8, 0, -Math.PI / 2);
  c.foco(0xffe0b0, 30, 13, 0.9, 0, 5.4, 0.6, 0, 0, 0.6, true);
  farol(c, -4.2, 4.6, ZF + 1.0); farol(c, 4.2, 4.6, ZF + 1.0);
}

/* ================================================================= LA SALA RECREATIVA (máquinas y juegos de habilidad) */
const PANTALLAS = {
  ritmo: (g, t, w, h) => { g.fillStyle = "#0c0a24"; g.fillRect(0, 0, w, h); ["#5fe0d2", "#ff7ac0", "#ffd84a", "#5fe0d2"].forEach((col, i) => { g.fillStyle = col; const y = Math.floor((t * 14 + i * 5) % (h + 4)) - 4; g.fillRect(3 + i * 5, y, 3, 3); }); g.fillStyle = "#fff"; g.fillRect(0, h - 4, w, 1); },
  parranda: (g, t, w, h) => { g.fillStyle = "#1a0c24"; g.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? "#ff7ac0" : "#5fe0d2"; const a = Math.abs(Math.sin(t * 3 + i)) * (h - 4); g.fillRect(2 + i * 4, h - 2 - a, 3, a); } },
  hooey: (g, t, w, h) => { g.fillStyle = "#1a0e0a"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8872a"; g.fillRect(8, 10, 8, 6); g.fillStyle = (Math.floor(t * 6) % 2) ? "#f7dd6a" : "#f0b038"; g.fillRect(9, 4 + (Math.floor(t * 6) % 2), 6, 6); },
  fractura: (g, t, w, h) => { g.fillStyle = "#14101e"; g.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? "#5a3f27" : "#8d6a45"; g.fillRect(2 + i * 5, 2 + j * 5, 5, 5); } g.fillStyle = (Math.floor(t * 2) % 2) ? "#b6453f" : "#4f7fb5"; g.fillRect(7, 7, 5, 5); },
  estocatta: (g, t, w, h) => { g.fillStyle = "#0c1a18"; g.fillRect(0, 0, w, h); g.fillStyle = "#5fe0d2"; g.fillRect(0, h - 3, w, 1); const d = Math.floor(Math.abs(Math.sin(t * 2)) * 4); g.fillStyle = "#e8b84a"; g.fillRect(4 + d, h - 9, 2, 6); g.fillStyle = "#ff7ac0"; g.fillRect(w - 6 - d, h - 9, 2, 6); g.fillStyle = "#f2ead2"; g.fillRect(6 + d, h - 7, 4, 1); g.fillRect(w - 10 - d, h - 7, 4, 1); }
};
function maquina(c, x, z, tipo, color, href, nombre, rotulo) {
  const g = c.grupo(x, 0, z, null);
  c.caja3(0.95, 1.95, 0.8, c.color(color), 0, 0, 0, g);
  c.caja3(0.99, 0.3, 0.84, c.color(0x1c1430), 0, 1.95, 0, g);
  const p = pantalla(c, 24, 18, PANTALLAS[tipo], 0, 1.45, 0.405, g); p.scale.set(0.72, 0.54, 1);
  c.plano(0.86, 0.2, new c.THREE.MeshBasicMaterial({ map: c.T.letrero(rotulo, "#120d2a", "#ffd84a", 64, 14) }), 0, 2.1, 0.425, 0, 0, g);
  c.caja3(0.95, 0.12, 0.3, c.color(0x1c1430), 0, 0.98, 0.45, g);
  [[-0.2, 0xe84a5f], [0.12, 0x4ab8e8], [0.28, 0xf2c14e]].forEach(([a, col]) => c.caja3(0.08, 0.05, 0.08, new c.THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 }), a, 1.1, 0.5, g));
  c.zona(g, href, nombre);
  return g;
}
function juegos(c) {
  const { T, S, ZF } = c;
  c.cascaron({ pared: T.papel("#1d1736", "#2a2050"), suelo: T.moqueta("#241a3a", "#3a2a6a", [8, 5]), zocalo: T.maderaVertical("#2a2040"), viga: c.color(0x1c1430), tapa: 0x0e0a16 });
  c.luzAmbiente(1.35, 0x8a6aca, 0x3a2a5a);
  c.fondo(0x08060e);
  // Tiras de neón
  const neones = [[0, c.ALTO - 0.5, ZF + 0.06, 13.8, 0x5fe0d2], [0, 0.04, ZF + 0.12, 13.8, 0xff7ac0]].map(([x, y, z, w, col]) => c.caja3(w, 0.05, 0.03, c.basica(col), x, y, z, null, false));
  // Rótulo de neón: la página con todos los juegos
  {
    const g = c.grupo(0, 3.2, ZF + 0.06, null);
    c.caja3(4.0, 0.7, 0.06, c.color(0x2a1d4a), 0, -0.35, 0, g, false);
    c.plano(3.8, 0.56, new c.THREE.MeshBasicMaterial({ map: T.letrero("MINIJUEGOS", "#120d2a", "#ff7ac0", 120, 18) }), 0, 0, 0.04, 0, 0, g);
    c.zona(g, "minijuegos.html", "Minijuegos: todos los juegos");
  }
  // Las máquinas en fila contra la pared del fondo
  const filas = [["ritmo", 0x2a5a8a, "ritmo.html", "Zarabanda", "RITMO"], ["parranda", 0x8a2f5a, "parranda.html", "Parranda", "PARRANDA"], ["hooey", 0x8a3a22, "sacrificio.html", "Hooey", "HOOEY"], ["fractura", 0x4a4066, "fractura.html", "La Fractura", "FRACTURA"]];
  filas.push(["estocatta", 0x2a6a5a, "estocatta.html", "Estocatta", "ESTOCATTA"]);
  const x0 = -(filas.length - 1) * 0.65;
  filas.forEach((f, i) => { const m = maquina(c, x0 + i * 1.3, ZF + 0.5, f[0], f[1], f[2], f[3], f[4]); m.scale.setScalar(1.12); });
  filas.forEach((f, i) => c.puntual([0x5fe0d2, 0xff7ac0, 0xffd84a, 0x8a7aff, 0x6fe08a][i], 3, 2.6, x0 + i * 1.3, 1.6, ZF + 1.4));
  c.ocupar(0, ZF + 0.5, filas.length * 1.3, 0.9);
  // Arquería, a la izquierda: diana sobre pacas de heno y la línea de tiro
  {
    const g = c.grupo(-5.4, 0, ZF + 0.9, null);
    c.caja3(1.4, 0.7, 0.7, c.L(T.heno()), 0, 0, 0, g); c.caja3(1.2, 0.6, 0.65, c.L(T.heno()), 0.05, 0.7, 0, g);
    const diana = c.sprite(S.diana(), 1.1, 1.1, 0, 1.85, 0.2, 0, g);
    c.caja3(0.06, 1.3, 0.06, c.color(0x6b4a2f), -0.45, 1.3, 0.15, g, false); c.caja3(0.06, 1.3, 0.06, c.color(0x6b4a2f), 0.45, 1.3, 0.15, g, false);
    [[0.15, 0.1], [-0.2, -0.15]].forEach(([a, b]) => { const f = c.caja3(0.02, 0.02, 0.55, c.color(0xe9dcc0), a, 1.85 + b, 0.45, g, false); f.rotation.x = 0.1; });
    c.zona(g, "arqueria.html", "Arquería");
    c.plano(2.6, 0.06, c.basica(0xe9dcc0), -5.4, 0.015, 1.4, 0, -Math.PI / 2);
  }
  // Ajedrez, a la derecha: mesa con tablero, reloj y dos sillas
  {
    const g = c.grupo(4.6, 0, -0.6, null);
    const madera = c.L(T.madera("#6b4a2f", 40));
    c.caja3(1.3, 0.08, 1.0, madera, 0, 0.72, 0, g);
    c.cilindro(0.08, 0.16, 0.72, 8, c.color(0x4a2f1c), 0, 0, 0, g);
    const t = T.ajedrezSuelo("#e9dcc0", "#3a2a1d", [4, 4]);
    c.plano(0.8, 0.8, c.L(t), 0, 0.81, 0, 0, -Math.PI / 2, g);
    [[-0.25, 0.2, 0xf2ead2], [0.1, 0.25, 0xf2ead2], [0.25, -0.2, 0x2a2030], [-0.1, -0.25, 0x2a2030]].forEach(([a, b, col]) => c.cilindro(0.04, 0.05, 0.14, 6, c.color(col), a, 0.81, b, g));
    c.caja3(0.22, 0.12, 0.1, c.color(0x1c1422), 0.55, 0.8, 0, g);
    c.zona(g, "ajedrez.html", "Ajedrez");
    silla(c, 4.6, -1.45, 0); silla(c, 4.6, 0.25, Math.PI);
    c.ocupar(4.6, -0.6, 1.4, 2.2);
  }
  // Solo admin: Duelo (panoplia en la pared derecha) y Ostelar (trampilla en el suelo)
  if (c.admin) {
    const g = c.grupo(c.X1 - 0.05, 0, 2.0, null); g.rotation.y = -Math.PI / 2;
    c.caja3(1.4, 1.4, 0.06, c.color(0x4a2f1c), 0, 1.3, 0, g, false);
    c.sprite(S.espadas(), 1.1, 1.1, 0, 2.0, 0.06, 0, g);
    c.zona(g, "duelo.html", "Duelo (admin)");
    const o = c.grupo(4.6, 0, 2.5, null);
    c.plano(1.3, 0.9, c.color(0x2a1d14), 0, 0.02, 0, 0, -Math.PI / 2, o);
    c.plano(1.1, 0.7, c.basica(0x0a0604), 0, 0.025, 0, 0, -Math.PI / 2, o);
    c.caja3(1.3, 0.06, 0.08, c.color(0x8d8d99), 0, 0.02, -0.2, o, false);
    c.zona(o, "ostelar.html", "Ostelar (admin)");
  }
  // Rincón de espectadores: sofá y mesita con bebidas
  {
    const sofa = c.color(0x3a6a8a);
    c.caja3(1.9, 0.4, 0.8, sofa, -4.3, 0, 2.4); c.caja3(1.9, 0.6, 0.2, sofa, -4.3, 0.4, 2.75); c.caja3(0.2, 0.55, 0.8, sofa, -5.25, 0.15, 2.4); c.caja3(0.2, 0.55, 0.8, sofa, -3.35, 0.15, 2.4);
    c.caja3(0.8, 0.4, 0.5, c.L(T.madera("#5a3b22", 41)), -4.3, 0, 1.55);
    c.cilindro(0.06, 0.06, 0.16, 8, c.basica(0x5fe0d2), -4.45, 0.4, 1.5); c.cilindro(0.06, 0.06, 0.16, 8, c.basica(0xff7ac0), -4.15, 0.4, 1.6);
  }
  c.puerta(-1, -0.9, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  planta(c, 6.4, ZF + 0.6, 1.0);
  // Luces de colores que cambian despacio
  const luces = [[-4, 0xff7ac0], [0, 0x5fe0d2], [4, 0xffd84a]].map(([x, col]) => c.puntual(col, 26, 9, x, 3.2, 0.2));
  {
    const madera = c.L(T.madera("#5a2f1c", 45));
    c.caja3(2.6, 0.16, 1.4, madera, 0, 0.72, 0.7); c.plano(2.3, 1.1, c.L(T.fieltro("#1f5a3a")), 0, 0.885, 0.7, 0, -Math.PI / 2);
    [[-1.15, 0.15], [1.15, 0.15], [-1.15, 1.25], [1.15, 1.25]].forEach(([x, z]) => c.caja3(0.16, 0.72, 0.16, c.color(0x3a2014), x, 0, z));
    [[-0.5, 0.5, 0xb6453f], [-0.3, 0.8, 0xe8b84a], [0.2, 0.6, 0x3b4a8a], [0.6, 0.9, 0xf2ead2]].forEach(([x, z, col]) => { const b = new c.THREE.Mesh(new c.THREE.SphereGeometry(0.06, 8, 6), c.color(col)); b.position.set(x, 0.95, z); c.add(b); });
    const taco = c.caja3(1.4, 0.03, 0.03, c.color(0xc9a14a), 0.4, 0.92, 1.1, null, false); taco.rotation.y = 0.3;
    c.caja3(1.2, 0.08, 0.3, c.basica(0x5fe0d2), 0, 2.85, 0.7, null, false);
    c.ocupar(0, 0.7, 2.7, 1.5);
  }
  c.animar((dt, t) => { luces.forEach((l, i) => { l.intensity = 26 * (c.reducido ? 1 : 0.8 + 0.2 * Math.sin(t * 1.3 + i * 2)); }); neones.forEach((n, i) => n.material.color.setHSL(((t * 0.03 + i * 0.4) % 1), 0.75, 0.6)); });
  c.foco(0xd8c8ff, 22, 12, 1.0, 0, 4.2, 0.6, 0, 0, 0.6, true);
}

/* ================================================================= EL SALÓN DE NAIPES (cartas, dados y apuestas) */
function naipes(c) {
  const { T, S, ZF } = c;
  c.cascaron({ pared: T.papel("#6a2a34", "#7a3440"), suelo: T.moqueta("#24442f", "#33683f", [9, 5]), zocalo: T.maderaVertical("#4a2a1c"), viga: c.color(0x2a1410) });
  c.luzAmbiente(1.4, 0xa07080, 0x3a2a1a);
  [[-3.9, 2.6, ZF + 1.4], [-4.8, 2.4, 2.6], [0, 3.6, 2.2]].forEach(([x, y, z]) => c.puntual(0xffc070, 9, 6, x, y, z));
  // Tapices con los palos en la pared del fondo
  [["#7a2f4a", "♠", -5.6], ["#2f4f7a", "♥", -1.9], ["#3f6b3a", "♦", 1.9], ["#7a5a2a", "♣", 5.6]].forEach(([col, p, x]) => c.sprite(T.tapiz(col, p), 0.8, 1.28, x, 3.1, ZF + 0.08));
  // Mazos: la vitrina con las cajas de mazos
  {
    const g = c.grupo(-3.9, 0, ZF + 0.35, null);
    c.caja3(1.8, 2.3, 0.55, c.L(T.madera("#4a2a1c", 43)), 0, 0, 0, g);
    const colores = [0x7a2f4a, 0x3b4a8a, 0x3f6b3a, 0xb8862e, 0x5d3a78, 0x2f6b6b];
    for (let f = 0; f < 3; f++) for (let i = 0; i < 5; i++) c.caja3(0.22, 0.3, 0.16, c.color(colores[(i + f * 2) % 6]), -0.6 + i * 0.3, 0.3 + f * 0.65, 0.12, g, false);
    c.plano(1.6, 2.0, new c.THREE.MeshLambertMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.16 }), 0, 1.15, 0.285, 0, 0, g);
    c.zona(g, "mazos.html", "Mazos");
    c.ocupar(-3.9, ZF + 0.35, 1.8, 0.6);
  }
  // Batalla: la mesa grande de Triunfos, con dos mazos frente a frente
  {
    const g = c.grupo(-0.6, 0, -0.4, null);
    c.caja3(3.0, 0.12, 1.5, c.color(0x4a2a1c), 0, 0.72, 0, g);
    c.plano(2.8, 1.3, c.L(T.fieltro("#1f5a3a")), 0, 0.845, 0, 0, -Math.PI / 2, g);
    [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.6], [1.3, 0.6]].forEach(([x, z]) => c.caja3(0.12, 0.72, 0.12, c.color(0x3a2014), x, 0, z, g));
    [[-1.05, 0, 0x7a2f4a], [1.05, 0, 0x3b4a8a]].forEach(([x, z, col]) => c.caja3(0.24, 0.12, 0.32, c.color(col), x, 0.85, z, g));
    [[-0.4, -0.2, 0.1], [-0.1, 0.25, -0.2], [0.3, -0.15, 0.3], [0.55, 0.2, -0.1], [-0.6, 0.3, 0.4]].forEach(([x, z, r], i) => { const ca = c.plano(0.22, 0.3, c.L(S.carta(i % 2 ? "#efe3c2" : "#d9d0b8")), x, 0.852 + i * 0.002, z, 0, -Math.PI / 2, g); ca.rotation.z = r; });
    c.zona(g, "batalla.html", "Batalla");
    silla(c, -0.6, -1.5, 0); silla(c, -0.6, 0.7, Math.PI);
    c.ocupar(-0.6, -0.4, 3.1, 2.8);
  }
  // Álbum: el gran álbum abierto sobre un atril, delante a la izquierda
  {
    const g = c.grupo(-4.8, 0, 1.9, null);
    c.caja3(0.3, 0.95, 0.3, c.color(0x4a2a1c), 0, 0, 0, g);
    const atril = c.caja3(1.0, 0.07, 0.7, c.color(0x5a3a22), 0, 0.95, 0, g); atril.rotation.x = 0.45;
    const [lz, k] = c.lienzo(32, 20);
    k.fillStyle = "#5a2a2a"; k.fillRect(0, 0, 32, 20); k.fillStyle = "#efe3c2"; k.fillRect(1, 1, 14, 18); k.fillRect(17, 1, 14, 18);
    for (let f = 0; f < 2; f++) for (let i = 0; i < 3; i++) { k.fillStyle = ["#7a2f4a", "#3b4a8a", "#3f6b3a"][(i + f) % 3]; k.fillRect(2 + i * 4 + (i > 2 ? 2 : 0), 2 + f * 8, 3, 6); k.fillRect(18 + i * 4, 2 + f * 8, 3, 6); }
    const libro = c.plano(0.92, 0.58, c.L(c.textura(lz)), 0, 1.06, 0.03, 0, 0, g); libro.rotation.x = -Math.PI / 2 + 0.45;
    c.zona(g, "cartas.html", "Álbum de Triunfos");
    c.ocupar(-4.8, 1.9, 1.0, 0.8);
  }
  // Las Veintiuna Velas: media luna de fieltro con Cera, la crupier de cera, y velas por todas partes
  {
    const g = c.grupo(3.6, 0, -2.6, null);
    c.cilindro(0.95, 0.95, 0.06, 18, c.L(T.fieltro("#1f5a46")), 0, 0.8, 0, g, Math.PI, -Math.PI / 2);
    c.cilindro(1.02, 1.02, 0.1, 18, c.color(0x5a3a22), 0, 0.72, 0, g, Math.PI, -Math.PI / 2);
    c.cilindro(0.9, 0.7, 0.72, 18, c.color(0x2a1a2e), 0, 0, 0, g, Math.PI, -Math.PI / 2);
    c.caja3(2.04, 0.82, 0.08, c.color(0x3a2516), 0, 0, -0.04, g);
    [[-0.3, 0.45], [0.1, 0.55], [0.4, 0.35]].forEach(([x, z], i) => { const ca = c.plano(0.18, 0.24, c.L(S.carta()), x, 0.84, z, 0, -Math.PI / 2, g); ca.rotation.z = i * 0.3 - 0.3; });
    [-0.85, -0.55, 0.55, 0.85].forEach((x, i) => c.vela(x, 0.84, 0.15 + (i % 2) * 0.12, 0.22, g));
    c.zona(g, "veintiuna.html", "Las Veintiuna Velas");
    c.figura([S.cera(0), S.cera(1)], 0.9, 1.4, 3.6, 0, -3.25, { cambio: 2.2, sombra: false });
    [[2.3, ZF + 0.2], [4.9, ZF + 0.2]].forEach(([x, z]) => { c.caja3(0.3, 1.2, 0.3, c.color(0x3a2516), x, 0, z); c.vela(x - 0.06, 1.2, z, 0.3); c.vela(x + 0.08, 1.2, z + 0.05, 0.2); });
    c.puntual(0xffb050, 6, 4, 3.6, 1.4, -2.0);
    c.ocupar(3.6, -2.7, 2.2, 1.4);
  }
  // El Pozo del Dragón: pozo de piedra con su tejadillo y un dragón enroscado en el brocal
  {
    const g = c.grupo(4.4, 0, 1.8, null);
    const piedra = c.L(T.piedra("#6e6a78", 47, [2, 1]));
    c.cilindro(0.7, 0.75, 0.75, 14, piedra, 0, 0, 0, g);
    c.cilindro(0.58, 0.58, 0.02, 14, c.basica(0x10302a), 0, 0.74, 0, g);
    c.caja3(0.1, 1.8, 0.1, c.color(0x6b4a2f), -0.65, 0, 0, g); c.caja3(0.1, 1.8, 0.1, c.color(0x6b4a2f), 0.65, 0, 0, g);
    const t1 = c.caja3(0.9, 0.06, 1.2, c.color(0x7a2f2f), -0.35, 1.95, 0, g); t1.rotation.z = 0.55;
    const t2 = c.caja3(0.9, 0.06, 1.2, c.color(0x7a2f2f), 0.35, 1.95, 0, g); t2.rotation.z = -0.55;
    c.caja3(0.2, 0.18, 0.2, c.color(0x8d6a45), 0, 1.15, 0, g);
    c.zona(g, "pozo-dragon.html", "El Pozo del Dragón");
    c.figura([c.texSprite(c.base + "assets/criaturas/dragarto.png")], 0.62, 0.62, 4.85, 0.74, 2.15, { sombra: false, salta: 0.03 });
    c.puntual(0x6fe08a, 3, 3, 4.4, 1.0, 2.4);
    [[3.8, 2.6], [4.95, 2.6], [3.9, 1.2]].forEach(([x, z]) => c.cilindro(0.08, 0.08, 0.03, 8, c.basica(0xe8b84a), x, 0, z));
    c.ocupar(4.4, 1.8, 1.5, 1.5);
  }
  c.puerta(-1, -1.3, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  planta(c, -6.35, ZF + 0.6, 1.0); planta(c, 6.4, 0.4, 0.9);
  lampara(c, -0.6, -0.4, 3.4, 0.7, true, 40);
  farol(c, c.X1 - 0.25, 2.9, -0.4, 0xffa850, 6);
}

/* ================================================================= LA SALA DE CAMPAÑA (las partidas de rol) */
function campana(c) {
  const { T, S, ZF } = c;
  c.cascaron({ pared: T.piedra("#5a5460", 57, [1, 1]), repPared: [7, 2.2], suelo: T.losas("#5e5866", [9, 5]), zocalo: null, postes: [-4.6, 4.6] });
  c.luzAmbiente(1.4, 0x8a8aaa, 0x3a3028);
  // El Mapa: grande, en la pared del fondo
  {
    const g = c.grupo(0, 2.6, ZF + 0.06, null);
    c.caja3(3.9, 2.4, 0.08, c.color(0x4a2f1c), 0, -1.2, 0, g, false);
    c.plano(3.7, 2.2, c.L(T.mapa()), 0, 0, 0.05, 0, 0, g);
    c.zona(g, "mapa.html", "Mapa");
  }
  // Estandartes a los lados del mapa
  [-2.9, 2.9].forEach((x, i) => c.sprite(T.tapiz(i ? "#2f4f7a" : "#7a2f2f", i ? "⚑" : "⚔"), 0.7, 1.1, x, 3.0, ZF + 0.08));
  // El Tablero: la mesa grande con el mapa cuadriculado, miniaturas, dados y la pantalla del director
  {
    const g = c.grupo(0, 0, 0.1, null);
    const madera = c.L(T.madera("#5a3b22", 61));
    c.caja3(4.4, 0.14, 2.3, madera, 0, 0.72, 0, g);
    c.plano(4.1, 2.0, c.L(T.rejillaMapa()), 0, 0.865, 0, 0, -Math.PI / 2, g);
    [[-2.0, -1.0], [2.0, -1.0], [-2.0, 1.0], [2.0, 1.0]].forEach(([x, z]) => c.caja3(0.16, 0.72, 0.16, c.color(0x3a2516), x, 0, z, g));
    [[-1.1, -0.4, 0xb6453f], [-0.7, 0.3, 0x4f7fb5], [0.2, -0.5, 0xe8b84a], [0.6, 0.2, 0x3f7a3a], [1.3, -0.1, 0x2a2030], [1.5, 0.4, 0x2a2030]].forEach(([x, z, col]) => {
      c.cilindro(0.07, 0.09, 0.05, 8, c.color(0x2a2030), x, 0.87, z, g);
      c.cilindro(0.04, 0.06, 0.18, 6, c.color(col), x, 0.92, z, g);
      const cab = new c.THREE.Mesh(new c.THREE.SphereGeometry(0.05, 6, 5), c.color(0xe0b890)); cab.position.set(x, 1.13, z); g.add(cab);
    });
    [[0.9, 0.75, 0xf2ead2], [1.05, 0.7, 0xb6453f]].forEach(([x, z, col]) => { const d = c.caja3(0.09, 0.09, 0.09, c.color(col), x, 0.87, z, g); d.rotation.y = 0.6; });
    [-0.45, 0, 0.45].forEach((x, i) => { const p = c.caja3(0.42, 0.42, 0.04, c.color(0x7a2f4a), -1.6 + x, 0.87, 0.95, g); p.rotation.y = (i - 1) * 0.35; });
    c.vela(-1.9, 0.86, -0.85, 0.24, g); c.vela(1.9, 0.86, -0.85, 0.24, g);
    c.zona(g, "tablero.html", "El Tablero (partidas)");
    [[-1.0, -1.35, 0], [1.0, -1.35, 0], [-2.7, 0.1, Math.PI / 2], [2.7, 0.1, -Math.PI / 2]].forEach(([x, z, r]) => silla(c, x, z, r));
    c.ocupar(0, 0.1, 4.6, 2.5);
  }
  // Mis personajes: el corcho con los retratos y el escritorio de las fichas, a la izquierda
  {
    const g = c.grupo(c.X0 + 0.05, 0, -1.6, null); g.rotation.y = Math.PI / 2;
    c.caja3(2.2, 1.3, 0.05, c.L(T.madera("#5a3b22", 6)), 0, 1.6, 0, g, false);
    c.plano(2.05, 1.15, c.L(T.corcho()), 0, 2.25, 0.03, 0, 0, g);
    const colores = [0xb6453f, 0x4f7fb5, 0xe8b84a, 0x3f7a3a, 0x7a2f4a, 0x2f6b6b];
    colores.forEach((col, i) => { const x = -0.75 + (i % 3) * 0.75, y = 2.5 - Math.floor(i / 3) * 0.5; c.caja3(0.32, 0.4, 0.02, c.color(0xb8862e), x, y - 0.2, 0.04, g, false); c.plano(0.24, 0.3, c.color(col), x, y, 0.055, 0, 0, g); c.plano(0.12, 0.12, c.color(0xe0b890), x, y + 0.06, 0.06, 0, 0, g); });
    const madera = c.L(T.madera("#6b4a2f", 12));
    c.caja3(1.8, 0.08, 0.7, madera, 0, 0.78, 0.45, g);
    [[-0.82, 0.18], [0.82, 0.18], [-0.82, 0.72], [0.82, 0.72]].forEach(([x, z]) => c.caja3(0.08, 0.78, 0.08, c.color(0x4a2f1c), x, 0, z, g));
    [[-0.5, 0.45, 0.2], [0.1, 0.5, -0.15], [0.55, 0.4, 0.3]].forEach(([x, z, r]) => { const p = c.plano(0.32, 0.4, c.L(S.papel()), x, 0.87, z, 0, -Math.PI / 2, g); p.rotation.z = r; });
    c.vela(0.75, 0.86, 0.3, 0.2, g);
    c.zona(g, "fichas.html", "Mis personajes");
    c.ocupar(c.X0 + 0.5, -1.6, 0.9, 2.0);
  }
  // El Registro: atril con el libro de las sesiones y la estantería de cuadernos, al fondo a la derecha
  {
    const g = c.grupo(4.9, 0, ZF + 0.3, null);
    estanteria(c, 0.9, 0, 1.3, 2.6, 88, g, 4);
    const a = c.grupo(-0.6, 0, 0.75, g);
    c.caja3(0.16, 1.0, 0.16, c.color(0x4a2f1c), 0, 0, 0, a);
    const atril = c.caja3(0.62, 0.06, 0.48, c.color(0x5a3b22), 0, 1.0, 0, a); atril.rotation.x = 0.5;
    const libro = c.plano(0.56, 0.36, c.L(S.libroAbierto()), 0, 1.1, 0.02, 0, 0, a); libro.rotation.x = -Math.PI / 2 + 0.5;
    c.vela(0.35, 0, -0.1, 1.1, a);
    c.zona(g, "cronica.html", "El Registro (crónica)");
    c.ocupar(4.9, ZF + 0.7, 2.6, 1.2);
  }
  // El tablón de Discord, en la pared derecha, con su cuerno de llamada
  {
    const g = c.grupo(c.X1 - 0.05, 0, -0.9, null); g.rotation.y = -Math.PI / 2;
    c.caja3(1.6, 1.1, 0.05, c.color(0x2a2a52), 0, 1.6, 0, g, false);
    c.plano(1.45, 0.95, c.L(T.pizarra(6, "#3a3a6a")), 0, 2.15, 0.03, 0, 0, g);
    c.plano(0.6, 0.2, new c.THREE.MeshLambertMaterial({ map: T.letrero("DISCORD", "#2a2a52", "#9aa4ff", 64, 14) }), 0, 2.82, 0.04, 0, 0, g);
    const cuerno = c.cilindro(0.03, 0.16, 0.5, 10, c.color(0xc9a14a), 0.95, 1.9, 0.15, g); cuerno.rotation.z = -1.1;
    c.zona(g, "discord.html", "Tablón de Discord");
  }
  c.ventana(-4.6, 1.5, 1.2, 1.5);
  c.puerta(-1, 1.5, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  c.foco(0xffd0a0, 40, 12, 0.75, 0, 5.5, 1.6, 0, 0, 0.1, true);
  farol(c, c.X1 - 0.25, 2.9, 1.4, 0xffa850, 9); farol(c, c.X0 + 0.25, 2.9, -0.2, 0xffa850, 9);
  c.puntual(0xffd0a0, 8, 6, 0, 3.0, ZF + 1.6);
  barril(c, -6.3, 2.8); planta(c, 6.4, 2.6, 0.9);
}

/* ================================================================= LOS ESTABLOS (el portón al hipódromo, el directo y los corrales) */
function establos(c) {
  const { T, S, ZF } = c;
  const vertical = T.maderaVertical("#6b4a2f");
  c.cascaron({ pared: vertical, repPared: [10, 1], suelo: T.tierra([10, 6]), zocalo: null, postes: [-3.2, 3.2], canto: T.madera("#4a2f1c", 3) });
  c.luzAmbiente(1.45, 0x9ab0d0, 0x4a3a22);
  // El portón abierto al fondo: por él se ve la pista con los corredores (Hipódromo)
  {
    const g = c.grupo(-0.9, 0, ZF + 0.03, null);
    const pintor = (k, t, w, h) => {
      const st = window.Cielo ? window.Cielo.estado() : { fase: "dia" };
      const cielo = { noche: ["#0b1030", "#1a2250"], amanecer: ["#6b5b95", "#f6c177"], dia: ["#4f9ee6", "#a5d6f4"], atardecer: ["#3b3a78", "#f2a65a"] }[st.fase];
      k.fillStyle = cielo[0]; k.fillRect(0, 0, w, 14); k.fillStyle = cielo[1]; k.fillRect(0, 14, w, 8);
      k.fillStyle = st.fase === "noche" ? "#1f3a28" : "#4a7a52"; k.fillRect(0, 20, w, 4); k.fillRect(8, 18, 14, 2); k.fillRect(40, 17, 16, 3);
      k.fillStyle = st.fase === "noche" ? "#2a4a30" : "#5b8a3a"; k.fillRect(0, 24, w, 16);
      k.fillStyle = st.fase === "noche" ? "#5a4a30" : "#a8834f"; k.fillRect(0, 27, w, 8);
      k.fillStyle = "#f2ead2"; k.fillRect(0, 26, w, 1); k.fillRect(0, 35, w, 1); for (let x = 0; x < w; x += 6) k.fillRect(x, 24, 1, 3);
      ["#b6453f", "#4f7fb5", "#e8b84a"].forEach((col, i) => { const x = Math.floor((t * (9 + i * 2.3) + i * 23) % (w + 10)) - 8; k.fillStyle = col; k.fillRect(x, 28 + i * 2, 5, 2); k.fillRect(x + 4, 27 + i * 2, 2, 2); });
      if (st.fase === "noche") { k.fillStyle = "#fff"; k.fillRect(10, 4, 1, 1); k.fillRect(44, 7, 1, 1); k.fillRect(30, 2, 1, 1); }
    };
    const p = pantalla(c, 64, 40, pintor, 0, 1.55, 0.02, g); p.scale.set(4.2, 3.1, 1);
    const oscura = c.color(0x3a2516);
    c.caja3(0.3, 3.3, 0.3, oscura, -2.25, 0, 0.1, g); c.caja3(0.3, 3.3, 0.3, oscura, 2.25, 0, 0.1, g); c.caja3(4.8, 0.3, 0.32, oscura, 0, 3.1, 0.1, g);
    [-1, 1].forEach(s => { const hoja = c.plano(1.4, 3.0, c.L(T.puerta("#5d4a2a"), { side: c.THREE.DoubleSide }), s * 2.55, 1.5, 0.6, s * 0.9, 0, g); hoja.castShadow = true; });
    // La pizarra de las apuestas, junto al portón
    c.caja3(0.9, 0.7, 0.05, c.color(0x4a2f1c), 2.95, 1.4, 0.06, g, false);
    c.plano(0.8, 0.6, c.L(T.pizarra(5)), 2.95, 1.75, 0.1, 0, 0, g);
    c.zona(g, "hipodromo.html", "Hipódromo");
    c.foco(0xfff1d0, 26, 12, 0.7, -0.9, 3.0, ZF - 1.5, -0.6, 0, 0.5, false);
  }
  // El Hipódromo en vivo: un espejo encantado sobre un pie, a la izquierda, que enseña la carrera
  {
    const g = c.grupo(-4.9, 0, -1.4, null);
    g.rotation.y = 0.5;
    c.caja3(0.12, 1.1, 0.12, c.color(0x6b4a2f), 0, 0, 0, g); c.caja3(0.7, 0.08, 0.5, c.color(0x6b4a2f), 0, 0, 0, g);
    c.caja3(1.3, 1.0, 0.1, c.color(0xb8862e), 0, 1.1, 0, g);
    const pintor = (k, t, w, h) => {
      k.fillStyle = "#0c1a2a"; k.fillRect(0, 0, w, h);
      for (let i = 0; i < 4; i++) { k.fillStyle = "rgba(255,255,255,.15)"; k.fillRect(0, 4 + i * 5, w, 1); }
      ["#e8b84a", "#5fe0d2", "#ff7ac0", "#6fe08a"].forEach((col, i) => { const x = Math.floor((t * (5 + i * 1.3) + i * 7) % (w + 6)) - 4; k.fillStyle = col; k.fillRect(x, 2 + i * 5, 4, 3); });
      k.fillStyle = (Math.floor(t * 2) % 2) ? "#e04a4a" : "#601a1a"; k.fillRect(1, 1, 2, 2);
    };
    const p = pantalla(c, 32, 22, pintor, 0, 1.6, 0.06, g); p.scale.set(1.15, 0.85, 1);
    c.zona(g, "hipodromo-vivo.html", "Hipódromo en vivo");
    c.puntual(0x5fe0d2, 3, 3, -4.6, 1.6, -0.8);
    c.ocupar(-4.9, -1.4, 1.2, 0.8);
  }
  // Los Corrales: dos cercados a la derecha con criaturas de verdad dentro
  {
    const g = c.grupo(0, 0, 0, null);
    const valla = c.color(0x8d6a45), poste = c.color(0x6b4a2f);
    const cercado = (x0, x1, z0, z1) => {
      [[x0, x1, z1]].forEach(([a, b, z]) => { for (let x = a; x <= b + 0.01; x += (b - a) / 4) c.caja3(0.1, 1.0, 0.1, poste, x, 0, z, g); c.caja3(b - a, 0.07, 0.06, valla, (a + b) / 2, 0.45, z, g); c.caja3(b - a, 0.07, 0.06, valla, (a + b) / 2, 0.8, z, g); });
      [[x0, z0, z1]].forEach(([x, a, b]) => { for (let z = a; z <= b + 0.01; z += (b - a) / 3) c.caja3(0.1, 1.0, 0.1, poste, x, 0, z, g); c.caja3(0.06, 0.07, b - a, valla, x, 0.45, (a + b) / 2, g); c.caja3(0.06, 0.07, b - a, valla, x, 0.8, (a + b) / 2, g); });
    };
    cercado(2.4, 6.9, ZF + 0.2, -1.4);
    cercado(2.4, 6.9, -1.2, 1.6);
    c.caja3(4.5, 0.07, 0.06, valla, 4.65, 0.45, -1.3, g); c.caja3(4.5, 0.07, 0.06, valla, 4.65, 0.8, -1.3, g);
    c.caja3(1.0, 0.5, 0.6, c.L(T.heno()), 6.2, 0, ZF + 0.7, g); c.caja3(0.9, 0.3, 0.35, c.color(0x6b4a2f), 3.2, 0, 0.8, g);
    c.plano(0.8, 0.25, c.basica(0x3f7fb5), 3.2, 0.31, 0.8, 0, -Math.PI / 2, g);
    c.plano(1.3, 0.28, new c.THREE.MeshLambertMaterial({ map: T.letrero("CORRALES", "#2a1a10", "#e8c87a", 96, 20) }), 4.65, 1.25, 1.64, 0, 0, g);
    c.zona(g, "corrales.html", "Corrales");
    const criatura = (id, x, z, alto, volteo) => c.figura([c.texSprite(c.base + "assets/criaturas/" + id + ".png")], alto, alto, x, 0, z, { salta: 0.05, volteo });
    criatura("lobo", 3.5, -2.3, 1.25); criatura("cocatriz", 5.6, -3.1, 1.05, true); criatura("guiverno", 4.7, -2.0, 1.45);
    criatura("sapo-beluto", 3.6, 0.6, 1.0, true); criatura("mamut-gelido", 5.5, 0.1, 1.7);
    c.puntual(0xffc070, 12, 7, 4.6, 3.2, -0.6);
    c.ocupar(4.65, -1.3, 4.6, 6.2);
  }
  // Pacas, herramientas colgadas y la puerta a la taberna
  c.caja3(1.1, 0.55, 0.65, c.L(T.heno()), -5.9, 0, 2.5); c.caja3(1.0, 0.5, 0.6, c.L(T.heno()), -5.85, 0.55, 2.5); c.caja3(1.1, 0.55, 0.65, c.L(T.heno()), -4.7, 0, 2.7);
  { const h = c.caja3(0.04, 1.6, 0.04, c.color(0x8d6a45), -6.9, 1.2, -3.4); h.rotation.x = 0.1; }
  c.puerta(-1, 0.4, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  farol(c, c.X0 + 0.25, 2.9, -2.6); farol(c, 0, 3.4, 1.0, 0xffb060, 10);
}

/* ================================================================= EL DESPACHO (solo admin) */
function despacho(c) {
  const { T, S, ZF } = c;
  c.cascaron({ pared: T.papel("#243326", "#2c3d2e"), suelo: T.suelo(), zocalo: T.maderaVertical("#3a2a2a"), viga: c.color(0x2a1a14) });
  c.luzAmbiente(1.45, 0x8a9aaa, 0x3a3020);
  c.puntual(0xffc880, 8, 6, -3.6, 2.4, 0.4); c.puntual(0xffc880, 8, 6, 3.4, 2.4, 0.6); c.puntual(0xffc880, 6, 5, 1.2, 2.2, 2.6);
  c.ventana(-4.4, 1.5, 1.4, 1.6);
  estanteria(c, 4.6, ZF + 0.3, 2.2, 3.0, 99, undefined, 5);
  c.plano(6.0, 2.8, c.L(T.alfombra()), 0, 0.012, 0.3, 0, -Math.PI / 2);
  // El escritorio grande: el Panel de Admin (libro de cuentas y un cristal con gráficas)
  {
    const g = c.grupo(0, 0, -2.4, null);
    const madera = c.L(T.madera("#5a3b22", 77));
    c.caja3(2.8, 0.1, 1.1, madera, 0, 0.8, 0, g); c.caja3(0.7, 0.8, 1.0, madera, -1.0, 0, 0, g); c.caja3(0.7, 0.8, 1.0, madera, 1.0, 0, 0, g);
    c.caja3(1.0, 0.7, 0.08, c.color(0x1c1422), 0.2, 0.9, -0.3, g);
    const pintor = (k, t, w, h) => { k.fillStyle = "#0c1a2a"; k.fillRect(0, 0, w, h); ["#5fe0d2", "#e8b84a", "#ff7ac0", "#6fe08a"].forEach((col, i) => { const a = 3 + Math.floor((Math.sin(t * 0.8 + i * 1.7) + 1) * 4); k.fillStyle = col; k.fillRect(3 + i * 5, h - 2 - a, 3, a); }); };
    const p = pantalla(c, 24, 16, pintor, 0.2, 1.25, -0.255, g); p.scale.set(0.9, 0.6, 1);
    const libro = c.plano(0.5, 0.34, c.L(S.libroAbierto()), -0.7, 0.86, 0.2, 0, -Math.PI / 2, g);
    c.vela(1.15, 0.9, 0.2, 0.22, g);
    c.zona(g, "admin.html", "Panel de Admin");
    silla(c, 0, -1.5, Math.PI);
  }
  // Editor de Zarabanda: atril de partituras y metrónomo, a la izquierda
  {
    const g = c.grupo(-3.6, 0, 0.2, null);
    c.caja3(0.06, 1.2, 0.06, c.color(0x2b2b33), 0, 0, 0, g);
    const atril = c.plano(0.7, 0.5, c.L(T.pizarra(5, "#e9dcc0")), 0, 1.4, 0.05, 0, -0.3, g); atril.material.color.set(0xffffff);
    c.caja3(0.2, 0.32, 0.16, c.color(0x5a3b22), 0.55, 0, 0.1, g);
    c.zona(g, "ritmo-editor.html", "Editor de Zarabanda");
  }
  // Editor de Parranda: tambor y platillo, a la derecha
  {
    const g = c.grupo(3.4, 0, 0.3, null);
    c.cilindro(0.45, 0.45, 0.55, 14, c.color(0xb6453f), 0, 0.2, 0, g);
    c.cilindro(0.46, 0.46, 0.02, 14, c.color(0xe9dcc0), 0, 0.76, 0, g);
    [-0.25, 0.25].forEach(x => c.caja3(0.04, 0.22, 0.04, c.color(0x2b2b33), x, 0, 0.2, g));
    c.caja3(0.03, 1.1, 0.03, c.color(0x8d8d99), 0.75, 0, -0.1, g);
    c.cilindro(0.3, 0.32, 0.02, 14, c.color(0xc9a14a), 0.75, 1.1, -0.1, g);
    c.zona(g, "parranda-editor.html", "Editor de Parranda");
  }
  // El Concurso (cerrado al público): la cabina con el micro y el cartel EN EL AIRE, y el guion en la pared
  {
    const g = c.grupo(1.2, 0, 1.9, null);
    c.caja3(2.0, 0.08, 0.7, c.L(T.madera("#6b4a2f", 81)), 0, 0.75, 0, g);
    c.caja3(1.9, 0.75, 0.08, c.color(0x4a2f1c), 0, 0, -0.3, g);
    c.caja3(0.04, 0.45, 0.04, c.color(0x8d8d99), -0.5, 0.83, 0, g);
    const micro = new c.THREE.Mesh(new c.THREE.SphereGeometry(0.08, 8, 6), c.color(0x2a2030)); micro.position.set(-0.5, 1.33, 0); g.add(micro);
    [[0.1, 0xff7ac0], [0.35, 0x5fe0d2], [0.6, 0xe8b84a]].forEach(([x, col]) => c.cilindro(0.07, 0.07, 0.05, 10, c.basica(col), x, 0.83, 0.05, g));
    c.plano(0.9, 0.22, new c.THREE.MeshBasicMaterial({ map: T.letrero("EN EL AIRE", "#3a0a0a", "#ff4a4a", 80, 16) }), 0, 1.75, -0.32, 0, 0, g);
    c.zona(g, "concurso.html", "Concurso: la cabina (admin)");
    const p = c.grupo(c.X1 - 0.05, 0, -0.6, null); p.rotation.y = -Math.PI / 2;
    c.caja3(1.3, 0.9, 0.05, c.color(0x6b4a2f), 0, 1.6, 0, p, false);
    c.plano(1.2, 0.8, c.L(T.pizarra(7, "#e9dcc0")), 0, 2.05, 0.03, 0, 0, p);
    c.zona(p, "concurso-programa.html", "Concurso: el programa (admin)");
  }
  c.puerta(-1, -1.0, "#taberna", "Volver a la taberna", { letrero: "TABERNA" });
  c.caja3(0.9, 1.6, 0.6, c.color(0x5e5a69), -6.2, 0, 2.4);
  lampara(c, 0, -0.5, 3.6, 0.6, true, 38);
  planta(c, -6.4, ZF + 0.6, 1.0);
}

export const SALAS = {
  taberna: { nombre: "Taberna", dibujar: taberna },
  biblioteca: { nombre: "Biblioteca", dibujar: biblioteca },
  juegos: { nombre: "Sala recreativa", dibujar: juegos },
  naipes: { nombre: "Salón de naipes", dibujar: naipes },
  campana: { nombre: "Sala de campaña", dibujar: campana },
  establos: { nombre: "Establos", dibujar: establos },
  despacho: { nombre: "Despacho", dibujar: despacho, admin: true }
};
