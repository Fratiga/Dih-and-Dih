/* =============================================================================
   VALHALLA — motor de combate por turnos sobre cuadrícula. No toca el DOM:
   solo estado y reglas. La pantalla (valhalla.js) le pregunta qué se puede
   hacer y le ordena hacerlo.

   Reglas (D&D 5e simplificado):
     · Iniciativa d20 + DES. Cada turno: movimiento, una acción, una acción
       adicional (y las acciones extra que den los rasgos).
     · Ataque: d20 + bono contra la CA. 20 natural es crítico (dados dobles),
       1 natural falla. Ventaja y desventaja según condiciones y situación.
     · Salvaciones: d20 + modificador contra la CD.
     · Sin ataques de oportunidad (como en un táctico de tablero pequeño): la
       gracia está en el terreno, los empujones y el fuego amigo.
============================================================================= */
(function (VH) {
  const TERRENO = { SUELO: 0, ROCA: 1, FUEGO: 2, PINCHOS: 3, BARRO: 4 };
  VH.TERRENO = TERRENO;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const clave = (x, y) => `${x},${y}`;

  /* El tamaño del tablero depende de cuántas fichas pelean: pocas fichas en un
     ring chico, muchas en un campo grande. */
  VH.TAMANOS_MAPA = [
    { hasta: 3, ancho: 8, alto: 6, flanco: 2, nombre: "Reñidero" },
    { hasta: 5, ancho: 10, alto: 7, flanco: 2, nombre: "Claro" },
    { hasta: 8, ancho: 12, alto: 8, flanco: 3, nombre: "Plaza" },
    { hasta: 11, ancho: 14, alto: 9, flanco: 3, nombre: "Campo" },
    { hasta: 99, ancho: 16, alto: 10, flanco: 3, nombre: "Gran campo" }
  ];
  VH.tamanoMapa = n => VH.TAMANOS_MAPA.find(t => n <= t.hasta);

  /* Cada tema coloca terreno en la zona central (entre los dos flancos, que
     siempre quedan libres). Reciben (t, xMin, xMax, ancho, alto, poner). */
  VH.TEMAS_MAPA = [
    {
      id: "claro", nombre: "Claro abierto",
      generar(t, x0, x1, W, H, poner) {
        const area = (x1 - x0 + 1) * H;
        poner(TERRENO.ROCA, Math.round(area * 0.1));
        poner(TERRENO.BARRO, Math.round(area * 0.07));
        poner(TERRENO.FUEGO, Math.max(1, Math.round(area * 0.03)));
        poner(TERRENO.PINCHOS, Math.max(1, Math.round(area * 0.03)));
      }
    },
    {
      id: "ruinas", nombre: "Ruinas",
      generar(t, x0, x1, W, H, poner) {
        // muros cortos con huecos, como paredes caídas
        const columnas = [x0 + Math.floor((x1 - x0) / 3), x0 + Math.floor((x1 - x0) * 2 / 3)].filter((v, i, a) => a.indexOf(v) === i);
        columnas.forEach(x => {
          const hueco = 1 + Math.floor(Math.random() * (H - 2));
          for (let y = 0; y < H; y++) if (Math.abs(y - hueco) > 0 && Math.random() < 0.7) t[y][x] = TERRENO.ROCA;
        });
        poner(TERRENO.BARRO, Math.max(2, Math.round(H * 0.4)));
        poner(TERRENO.PINCHOS, 2);
      }
    },
    {
      id: "pozo", nombre: "Pozo de fuego",
      generar(t, x0, x1, W, H, poner) {
        const cx = Math.round((x0 + x1) / 2), cy = Math.floor(H / 2);
        for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, (y - cy) * 1.2);
          if (d < 1.2) t[y][x] = TERRENO.FUEGO;
          else if (d < 2.2) t[y][x] = Math.random() < 0.5 ? TERRENO.PINCHOS : TERRENO.SUELO;
        }
        poner(TERRENO.ROCA, Math.max(3, Math.round(H * 0.7)));
      }
    },
    {
      id: "pantano", nombre: "Pantano",
      generar(t, x0, x1, W, H, poner) {
        const area = (x1 - x0 + 1) * H;
        poner(TERRENO.BARRO, Math.round(area * 0.3));
        poner(TERRENO.ROCA, Math.round(area * 0.05));
        poner(TERRENO.PINCHOS, Math.max(1, Math.round(area * 0.04)));
      }
    },
    {
      id: "puente", nombre: "Puente",
      generar(t, x0, x1, W, H, poner) {
        // una franja de pinchos y fuego que parte el campo, con uno o dos pasos
        const x = Math.round((x0 + x1) / 2);
        const pasos = new Set([Math.floor(H / 2)]);
        if (H >= 8) pasos.add(Math.floor(H / 2) + (Math.random() < 0.5 ? -3 : 3));
        for (let y = 0; y < H; y++) {
          if (pasos.has(y)) continue;
          t[y][x] = y % 2 ? TERRENO.FUEGO : TERRENO.PINCHOS;
        }
        poner(TERRENO.ROCA, Math.max(2, Math.round(H * 0.5)));
      }
    },
    {
      id: "pilares", nombre: "Salón de pilares",
      generar(t, x0, x1, W, H, poner) {
        for (let x = x0 + 1; x <= x1 - 1; x += 3) for (let y = 1; y < H - 1; y += 3) t[y][x] = TERRENO.ROCA;
        poner(TERRENO.BARRO, Math.max(2, Math.round(H * 0.5)));
        poner(TERRENO.FUEGO, 2);
      }
    }
  ];

  VH.crearCombate = function (jugadores, enemigos, opciones) {
    const tam = VH.tamanoMapa(jugadores.length + enemigos.length);
    const ANCHO = tam.ancho;
    const ALTO = tam.alto;
    const FLANCO = tam.flanco;
    const c = {
      ancho: ANCHO, alto: ALTO, terreno: [], unidades: [], orden: [], indice: 0, ronda: 1, activo: null,
      log: [], flotantes: [], fin: null, xpGanada: 0, version: 0, mapaNombre: "", tema: null
    };

    /* --- Mapa ----------------------------------------------------------- */
    function conectado(t) {
      const y0 = Math.floor(ALTO / 2);
      const vistos = new Set([clave(0, y0)]);
      const cola = [[0, y0]];
      while (cola.length) {
        const [x, y] = cola.shift();
        DIRS.forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= ANCHO || ny >= ALTO || t[ny][nx] === TERRENO.ROCA || vistos.has(clave(nx, ny))) return;
          vistos.add(clave(nx, ny)); cola.push([nx, ny]);
        });
      }
      for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) if (t[y][x] !== TERRENO.ROCA && !vistos.has(clave(x, y))) return false;
      return true;
    }
    function generarMapa() {
      const x0 = FLANCO, x1 = ANCHO - 1 - FLANCO;
      for (let intento = 0; intento < 60; intento++) {
        const tema = VH.TEMAS_MAPA[Math.floor(Math.random() * VH.TEMAS_MAPA.length)];
        const t = Array.from({ length: ALTO }, () => Array(ANCHO).fill(TERRENO.SUELO));
        const poner = (tipo, n) => {
          for (let i = 0; i < n; i++) t[Math.floor(Math.random() * ALTO)][x0 + Math.floor(Math.random() * (x1 - x0 + 1))] = tipo;
        };
        tema.generar(t, x0, x1, ANCHO, ALTO, poner);
        for (let y = 0; y < ALTO; y++) for (let x = 0; x < FLANCO; x++) { t[y][x] = TERRENO.SUELO; t[y][ANCHO - 1 - x] = TERRENO.SUELO; }
        if (conectado(t)) { c.tema = tema; return t; }
      }
      return Array.from({ length: ALTO }, () => Array(ANCHO).fill(TERRENO.SUELO));
    }
    c.terreno = generarMapa();
    c.mapaNombre = `${c.tema ? c.tema.nombre : "Campo"} (${ANCHO}×${ALTO})`;

    /* --- Utilidades --------------------------------------------------------- */
    const enMapa = (x, y) => x >= 0 && y >= 0 && x < ANCHO && y < ALTO;
    const terrenoEn = (x, y) => (enMapa(x, y) ? c.terreno[y][x] : TERRENO.ROCA);
    const vivo = u => !u.muerto && !u.caido;
    c.vivo = vivo;
    const unidadEn = (x, y) => c.unidades.find(u => !u.muerto && !u.caido && u.x === x && u.y === y) || null;
    c.unidadEn = unidadEn;
    const bando = u => u.equipo;
    const aliados = u => c.unidades.filter(o => vivo(o) && bando(o) === bando(u));
    const rivales = u => c.unidades.filter(o => vivo(o) && bando(o) !== bando(u));
    c.rivales = rivales; c.aliadosDe = aliados;
    const tieneCond = (u, n) => u.cond[n] !== undefined;
    const incapacitado = u => tieneCond(u, "aturdido") || tieneCond(u, "paralizado");

    function escribir(msg, tipo) {
      c.log.push({ msg, tipo: tipo || "", ronda: c.ronda });
      if (c.log.length > 200) c.log.shift();
      c.version++;
    }
    function flotar(u, msg, color) {
      c.flotantes.push({ x: u.x, y: u.y, msg, color: color || "#fff", t: 0 });
    }

    /* Línea de visión: la bloquean las rocas. */
    function visible(a, b) {
      let x0 = a.x, y0 = a.y;
      const x1 = b.x, y1 = b.y;
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;
      while (!(x0 === x1 && y0 === y1)) {
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
        if (!(x0 === x1 && y0 === y1) && terrenoEn(x0, y0) === TERRENO.ROCA) return false;
      }
      return true;
    }
    c.visible = visible;

    /* --- Preparación ----------------------------------------------------- */
    // las fichas de cada bando se ponen en su flanco, empezando por el centro
    const pos = (lista, columna, haciaDentro) => {
      const centro = Math.floor(ALTO / 2);
      const filas = [centro];
      for (let k = 1; filas.length < ALTO; k++) { if (centro - k >= 0) filas.push(centro - k); if (centro + k < ALTO) filas.push(centro + k); }
      lista.forEach((u, i) => { u.x = columna + Math.floor(i / ALTO) * haciaDentro; u.y = filas[i % ALTO]; });
    };
    pos(jugadores, 1, 1);
    pos(enemigos, ANCHO - 2, -1);
    jugadores.forEach(u => { u.equipo = "jugadores"; });
    enemigos.forEach(u => { u.equipo = "enemigos"; });
    c.unidades = jugadores.concat(enemigos);
    c.unidades.forEach(u => {
      u.pv = u.pvMax; u.cond = {}; u.usos = {}; u.recargaPend = {}; u.usados = (u.espacios || []).map(() => 0);
      u.muerto = false; u.caido = false; u.concentra = null; u.castigoActivo = false; u.reservaMano = null;
      u.ini = VH.d(20) + (u.iniciativa || 0);
    });
    c.orden = c.unidades.slice().sort((a, b) => b.ini - a.ini || b.mod.des - a.mod.des).map(u => u.id);

    /* --- Movimiento ------------------------------------------------------ */
    function velocidadActual(u) {
      let v = u.vel;
      if (tieneCond(u, "ralentizado")) v = Math.floor(v / 2);
      if (tieneCond(u, "acelerado")) v *= 2;
      if (tieneCond(u, "apresado") || incapacitado(u)) v = 0;
      return v;
    }
    c.velocidadActual = velocidadActual;

    /* Casillas a las que puede llegar con el movimiento que le queda. */
    function alcanzables(u, movimiento) {
      const mov = movimiento === undefined ? (u.turno ? u.turno.mov : 0) : movimiento;
      const dist = new Map([[clave(u.x, u.y), { coste: 0, prev: null, x: u.x, y: u.y }]]);
      const cola = [{ x: u.x, y: u.y, coste: 0 }];
      while (cola.length) {
        cola.sort((a, b) => a.coste - b.coste);
        const cur = cola.shift();
        if (dist.get(clave(cur.x, cur.y)).coste < cur.coste) continue;
        DIRS.forEach(([dx, dy]) => {
          const nx = cur.x + dx, ny = cur.y + dy;
          if (!enMapa(nx, ny) || terrenoEn(nx, ny) === TERRENO.ROCA) return;
          const otro = unidadEn(nx, ny);
          if (otro && bando(otro) !== bando(u)) return;
          const coste = cur.coste + (terrenoEn(nx, ny) === TERRENO.BARRO ? 2 : 1);
          if (coste > mov) return;
          const k = clave(nx, ny);
          if (!dist.has(k) || dist.get(k).coste > coste) {
            dist.set(k, { coste, prev: clave(cur.x, cur.y), x: nx, y: ny });
            cola.push({ x: nx, y: ny, coste });
          }
        });
      }
      // no se puede terminar encima de otra unidad
      [...dist.keys()].forEach(k => {
        const d = dist.get(k);
        const otro = unidadEn(d.x, d.y);
        if (otro && otro !== u) dist.delete(k);
      });
      return dist;
    }
    c.alcanzables = alcanzables;

    function caminoA(mapa, x, y) {
      const ruta = [];
      let k = clave(x, y);
      while (k && mapa.get(k)) {
        const d = mapa.get(k);
        ruta.unshift({ x: d.x, y: d.y });
        k = d.prev;
      }
      return ruta;
    }

    function peligroEn(u, x, y) {
      const t = terrenoEn(x, y);
      if (t === TERRENO.FUEGO) { recibirDano(u, VH.tirar("1d6").total, "fuego", null, "el fuego"); }
      else if (t === TERRENO.PINCHOS) { recibirDano(u, VH.tirar("2d6").total, "perforante", null, "los pinchos"); }
    }

    c.mover = function (u, x, y) {
      const t = u.turno;
      const mapa = alcanzables(u);
      const destino = mapa.get(clave(x, y));
      if (!destino || (x === u.x && y === u.y)) return false;
      const ruta = caminoA(mapa, x, y).slice(1);
      ruta.forEach(p => {
        if (!vivo(u)) return;
        u.x = p.x; u.y = p.y;
        peligroEn(u, p.x, p.y);
      });
      t.mov -= destino.coste;
      t.movido = true;
      c.version++;
      return true;
    };

    /* Empujón: se desplaza casilla a casilla y choca con rocas, bordes y otras unidades. */
    function empujar(objetivo, desde, casillas) {
      let dx = Math.sign(objetivo.x - desde.x), dy = Math.sign(objetivo.y - desde.y);
      if (!dx && !dy) return;
      for (let i = 0; i < casillas && vivo(objetivo); i++) {
        const nx = objetivo.x + dx, ny = objetivo.y + dy;
        const otro = enMapa(nx, ny) ? unidadEn(nx, ny) : null;
        if (!enMapa(nx, ny) || terrenoEn(nx, ny) === TERRENO.ROCA) {
          escribir(`${objetivo.nombre} choca contra la pared.`, "dano");
          recibirDano(objetivo, VH.tirar("1d6").total, "contundente", null, "el choque");
          return;
        }
        if (otro) {
          escribir(`${objetivo.nombre} choca contra ${otro.nombre}.`, "dano");
          recibirDano(objetivo, VH.tirar("1d6").total, "contundente", null, "el choque");
          recibirDano(otro, VH.tirar("1d6").total, "contundente", null, "el choque");
          return;
        }
        objetivo.x = nx; objetivo.y = ny;
        peligroEn(objetivo, nx, ny);
      }
    }

    /* --- Daño y curación ----------------------------------------------------- */
    function recibirDano(u, cantidad, tipo, fuente, causa) {
      if (!vivo(u) || cantidad <= 0) return 0;
      const t = VH.tipoDanoCanon(tipo);
      let n = cantidad;
      const resiste = u.res.includes(t) || (tieneCond(u, "furia") && VH.FISICOS.includes(t));
      if (u.inm.includes(t)) n = 0;
      else if (resiste) n = Math.floor(n / 2);
      else if (u.vul.includes(t)) n *= 2;
      n = Math.max(0, n);
      u.pv -= n;
      flotar(u, n ? `-${n}` : "0", n ? "#ff7a6b" : "#aaa");
      if (n) escribir(`${u.nombre} recibe ${n} de daño${t ? " " + t : ""}${causa ? " por " + causa : ""}${resiste && n ? " (resiste)" : ""}.`, "dano");
      if (u.concentra && n > 0) {
        const cd = Math.max(10, Math.floor(n / 2));
        const tirada = VH.d(20) + u.mod.con;
        if (tirada < cd) { escribir(`${u.nombre} pierde la concentración.`, "info"); cortarConcentracion(u); }
      }
      if (u.pv <= 0) {
        u.pv = 0;
        if (u.equipo === "enemigos") u.muerto = true; else u.caido = true;
        u.cond = {};
        cortarConcentracion(u);
        escribir(`${u.nombre} ${u.equipo === "enemigos" ? "cae derrotado" : "cae inconsciente"}.`, "muerte");
        comprobarFin();
      }
      return n;
    }
    c.recibirDano = recibirDano;

    function curar(u, cantidad) {
      if (u.muerto) return 0;
      const antes = u.pv;
      u.pv = Math.min(u.pvMax, u.pv + cantidad);
      if (u.caido && u.pv > 0) { u.caido = false; escribir(`${u.nombre} se levanta.`, "cura"); }
      const dif = u.pv - antes;
      flotar(u, `+${dif}`, "#8be08f");
      escribir(`${u.nombre} recupera ${dif} PV.`, "cura");
      return dif;
    }

    function ponerCondicion(u, estado, turnos, de) {
      if (!vivo(u)) return;
      u.cond[estado] = turnos;
      if (estado === "marcado" && de) u.marcadoPor = de.id;
      flotar(u, estado, "#e0cf7a");
      escribir(`${u.nombre}: ${estado}.`, "info");
    }

    function cortarConcentracion(u) {
      if (!u.concentra) return;
      const { estado, objetivos } = u.concentra;
      objetivos.forEach(o => { if (estado && o.cond[estado] !== undefined) delete o.cond[estado]; });
      u.concentra = null;
    }

    function comprobarFin() {
      if (c.fin) return;
      if (c.unidades.filter(u => u.equipo === "enemigos").every(u => u.muerto)) {
        c.fin = "victoria";
        c.xpGanada = c.unidades.filter(u => u.equipo === "enemigos").reduce((t, u) => t + VH.xpEnemigo(u.nivel), 0);
        escribir("¡Victoria!", "info");
      } else if (c.unidades.filter(u => u.equipo === "jugadores").every(u => u.caido)) {
        c.fin = "derrota";
        escribir("Todos han caído.", "info");
      }
    }

    /* --- Tiradas ---------------------------------------------------------------- */
    function ventajaContra(att, def, cuerpo) {
      let v = 0;
      if (["derribado", "apresado", "envenenado", "asustado", "cegado"].some(n => tieneCond(att, n))) v -= 1;
      if (tieneCond(def, "esquivando")) v -= 1;
      if (["aturdido", "paralizado", "cegado"].some(n => tieneCond(def, n))) v += 1;
      if (tieneCond(def, "derribado")) v += cuerpo ? 1 : -1;
      if (!cuerpo && rivales(att).some(o => VH.dist(o, att) <= 1 && !incapacitado(o))) v -= 1;
      return v;
    }

    function d20(ventaja) {
      const a = VH.d(20), b = VH.d(20);
      return ventaja > 0 ? Math.max(a, b) : ventaja < 0 ? Math.min(a, b) : a;
    }

    function tirarAtaque(att, def, bono, cuerpo) {
      const v = ventajaContra(att, def, cuerpo);
      const natural = d20(v);
      let total = natural + bono;
      if (tieneCond(att, "bendecido")) total += VH.d(4);
      const critico = natural === 20 || (tieneCond(def, "paralizado") && cuerpo && natural !== 1);
      const impacta = natural !== 1 && (critico || total >= def.ca);
      return { natural, total, critico, impacta, ventaja: v };
    }

    function salvar(def, atributo, cd) {
      let total = VH.d(20) + (def.mod[atributo] || 0);
      if (tieneCond(def, "bendecido")) total += VH.d(4);
      return { total, exito: total >= cd };
    }

    /* --- Geometría de áreas --------------------------------------------------- */
    function casillasArea(origen, area, destino) {
      const out = [];
      const f = (() => {
        const dx = destino.x - origen.x, dy = destino.y - origen.y;
        const l = Math.hypot(dx, dy) || 1;
        return { x: dx / l, y: dy / l };
      })();
      if (area.forma === "esfera") {
        for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
          if ((x - destino.x) ** 2 + (y - destino.y) ** 2 <= (area.radio + 0.5) ** 2 && visible(destino, { x, y })) out.push({ x, y });
        }
      } else if (area.forma === "explosion") {
        for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
          if ((x === origen.x && y === origen.y)) continue;
          if (Math.max(Math.abs(x - origen.x), Math.abs(y - origen.y)) <= area.radio && visible(origen, { x, y })) out.push({ x, y });
        }
      } else if (area.forma === "cono") {
        for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
          const dx = x - origen.x, dy = y - origen.y;
          const d = Math.hypot(dx, dy);
          if (!d || d > area.largo + 0.5) continue;
          const cos = (dx * f.x + dy * f.y) / d;
          if (cos >= Math.SQRT1_2 - 0.02 && visible(origen, { x, y })) out.push({ x, y });
        }
      } else if (area.forma === "linea") {
        const vistos = new Set();
        for (let t = 1; t <= area.largo; t += 0.5) {
          const x = Math.round(origen.x + f.x * t), y = Math.round(origen.y + f.y * t);
          if (!enMapa(x, y) || terrenoEn(x, y) === TERRENO.ROCA) break;
          const k = clave(x, y);
          if (!vistos.has(k) && !(x === origen.x && y === origen.y)) { vistos.add(k); out.push({ x, y }); }
        }
      }
      return out;
    }
    c.casillasArea = casillasArea;

    /* --- Acciones disponibles ---------------------------------------------------- */
    function nivelEspacioMinimo(u, nivel) {
      for (let i = nivel - 1; i < u.espacios.length; i++) if (u.usados[i] < u.espacios[i]) return i + 1;
      return 0;
    }
    function espaciosLibres(u, nivelMin) {
      const out = [];
      for (let i = Math.max(1, nivelMin) - 1; i < u.espacios.length; i++) if (u.usados[i] < u.espacios[i]) out.push(i + 1);
      return out;
    }
    c.espaciosLibres = espaciosLibres;

    /* Todas las cosas que puede intentar la unidad activa, con su estado. */
    c.opciones = function (u) {
      const t = u.turno;
      const lista = [];
      const hayAccion = () => t.accion > 0;
      u.acciones.forEach(a => {
        let ok = true, motivo = "";
        const esExtra = a.arma && t.ataquesExtra > 0;
        if (a.costo === "accion" && !hayAccion() && !esExtra) { ok = false; motivo = "Sin acción"; }
        if (a.costo === "bonus" && !t.bonus) { ok = false; motivo = "Sin acción adicional"; }
        if (a.usos && (u.usos[a.id] || 0) >= a.usos) { ok = false; motivo = "Sin usos"; }
        if (a.recarga && u.recargaPend[a.id]) { ok = false; motivo = "Recargando"; }
        if (incapacitado(u)) { ok = false; motivo = "Incapacitado"; }
        lista.push({ clave: `a:${a.id}`, nombre: a.nombre, tipo: a.tipo, costo: a.costo, ok, motivo, accion: a, desc: a.desc || "", info: infoAccion(u, a) });
      });
      u.conjuros.forEach(cj => {
        let ok = true, motivo = "";
        const min = cj.nivel === 0 ? 0 : nivelEspacioMinimo(u, cj.nivel);
        if (cj.nivel > 0 && !min) { ok = false; motivo = "Sin espacios"; }
        if (cj.costo === "accion" && !hayAccion()) { ok = false; motivo = "Sin acción"; }
        if (cj.costo === "bonus" && !t.bonus) { ok = false; motivo = "Sin acción adicional"; }
        if (incapacitado(u)) { ok = false; motivo = "Incapacitado"; }
        lista.push({ clave: `c:${cj.id}`, nombre: cj.nombre, tipo: "conjuro", costo: cj.costo, ok, motivo, conjuro: cj, nivel: cj.nivel, info: `Nv. ${cj.nivel || "truco"}` });
      });
      return lista;
    };

    function infoAccion(u, a) {
      const partes = [];
      if (a.ataque !== undefined && a.ataque !== null) partes.push(`${VH.signo(a.ataque)} al ataque`);
      if (a.danos && a.danos.length) partes.push(a.danos.map(d => `${d.f} ${d.t}`).join(" + "));
      if (a.cura) partes.push(`cura ${a.cura}`);
      if (a.salv) partes.push(`salv. ${a.salv.toUpperCase()} CD ${a.cd}`);
      return partes.join(" · ");
    }

    /* --- Resolución de objetivos ------------------------------------------------- */
    function propiedades(u, op, nivelEspacio) {
      if (op.conjuro) {
        const cj = op.conjuro;
        return { alcance: cj.alcance, area: cj.area || null, tipo: cj.tipo, aliados: !!cj.aliados || cj.tipo === "cura", cj };
      }
      const a = op.accion;
      const ayuda = a.tipo === "cura" || (a.tipo === "efecto" && a.estado && ["furia", "bendecido", "acelerado"].includes(a.estado.nombre));
      return { alcance: a.alcance, area: a.area || null, tipo: a.tipo, aliados: ayuda, a };
    }

    /* Posibles "clics" desde un origen: casilla destino y las unidades a las que alcanzaría. */
    c.destinosDesde = function (u, op, origen, nivelEspacio) {
      const p = propiedades(u, op, nivelEspacio);
      const o = origen || { x: u.x, y: u.y };
      const salida = [];
      const esEspecial = op.accion && op.accion.tipo === "especial";
      if (esEspecial) return [{ x: o.x, y: o.y, victimas: [u], propio: true }];
      if (p.tipo === "teleport") {
        for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
          if (VH.dist(o, { x, y }) <= p.alcance && terrenoEn(x, y) !== TERRENO.ROCA && !unidadEn(x, y)) salida.push({ x, y, victimas: [], teleport: true });
        }
        return salida;
      }
      const propioSolo = p.alcance === 0 && !p.area;
      if (propioSolo) return [{ x: o.x, y: o.y, victimas: [u], propio: true }];
      if (p.alcance === 0 && p.area) {
        // área que sale del propio lanzador: cualquier casilla dirige
        const dirs = p.area.forma === "explosion" ? [{ x: o.x, y: o.y }] : DIRS.map(([dx, dy]) => ({ x: o.x + dx * 3, y: o.y + dy * 3 }));
        const ref = { x: o.x, y: o.y };
        const vistas = new Set();
        dirs.forEach(d => {
          const casillas = casillasArea(ref, p.area, d);
          const victimas = c.unidades.filter(v => vivo(v) && v !== u && casillas.some(k => k.x === v.x && k.y === v.y));
          const firma = victimas.map(v => v.id).sort().join("|") + `/${d.x},${d.y}`;
          if (vistas.has(firma)) return;
          vistas.add(firma);
          salida.push({ x: d.x, y: d.y, victimas, area: casillas, desde: ref, dirigido: true });
        });
        return salida;
      }
      for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
        const d = VH.dist(o, { x, y });
        if (d > p.alcance) continue;
        if (!(x === o.x && y === o.y) && p.alcance > 1 && !visible(o, { x, y })) continue;
        if (terrenoEn(x, y) === TERRENO.ROCA) continue;
        if (p.area && (p.area.forma === "esfera")) {
          const casillas = casillasArea(o, p.area, { x, y });
          const victimas = c.unidades.filter(v => vivo(v) && casillas.some(k => k.x === v.x && k.y === v.y));
          salida.push({ x, y, victimas, area: casillas });
        } else if (p.area && p.area.forma !== "esfera") {
          continue;
        } else {
          const v = unidadEn(x, y);
          if (!v) continue;
          if (p.aliados ? bando(v) !== bando(u) : bando(v) === bando(u)) continue;
          if (v === u && !p.aliados) continue;
          salida.push({ x, y, victimas: [v] });
        }
      }
      return salida;
    };

    /* --- Ejecución ---------------------------------------------------------------------- */
    function gastarCosto(u, op, esExtra) {
      const t = u.turno;
      const costo = op.costo;
      if (costo === "accion") {
        if (esExtra) t.ataquesExtra--;
        else { t.accion--; t.ataquesExtra = op.accion && op.accion.arma ? Math.max(0, u.ataquesPorAccion - 1) : 0; }
      } else if (costo === "bonus") t.bonus = false;
    }

    c.ejecutar = function (u, op, destino, nivelEspacio) {
      if (c.fin || !vivo(u)) return false;
      const lista = c.destinosDesde(u, op, { x: u.x, y: u.y }, nivelEspacio);
      const d = lista.find(z => z.x === destino.x && z.y === destino.y);
      if (!d) return false;
      const t = u.turno;
      const esExtra = !!(op.accion && op.accion.arma && t.ataquesExtra > 0);
      if (op.conjuro) {
        const cj = op.conjuro;
        let nivelUsado = cj.nivel;
        if (cj.nivel > 0) {
          nivelUsado = nivelEspacio && espaciosLibres(u, cj.nivel).includes(nivelEspacio) ? nivelEspacio : nivelEspacioMinimo(u, cj.nivel);
          if (!nivelUsado) return false;
          u.usados[nivelUsado - 1]++;
        }
        gastarCosto(u, op, false);
        lanzar(u, cj, d, nivelUsado);
      } else {
        const a = op.accion;
        if (a.usos) u.usos[a.id] = (u.usos[a.id] || 0) + 1;
        if (a.recarga) u.recargaPend[a.id] = true;
        gastarCosto(u, op, esExtra);
        ejecutarAccion(u, a, d);
      }
      comprobarFin();
      c.version++;
      return true;
    };

    function ejecutarAccion(u, a, d) {
      const objetivos = d.victimas || [];
      if (a.tipo === "especial") {
        if (a.especial === "esquivar") { ponerCondicion(u, "esquivando", 1, u); }
        else if (a.especial === "correr") { u.turno.mov += velocidadActual(u); escribir(`${u.nombre} corre.`, "info"); flotar(u, "¡Corre!", "#cde"); }
        else if (a.especial === "oleada") { u.turno.accion++; escribir(`${u.nombre} actúa de nuevo.`, "info"); flotar(u, "¡Oleada!", "#ffe08a"); }
        return;
      }
      if (a.tipo === "cura") {
        const blanco = objetivos[0] || u;
        let n;
        if (a.cura === "reserva") {
          const falta = blanco.pvMax - blanco.pv;
          n = Math.min(falta, u.reservaMano === null ? a.reserva : u.reservaMano);
          u.reservaMano = (u.reservaMano === null ? a.reserva : u.reservaMano) - n;
        } else n = VH.tirar(a.cura).total;
        escribir(`${u.nombre} usa ${a.nombre}${blanco !== u ? " sobre " + blanco.nombre : ""}.`, "accion");
        curar(blanco, n);
        return;
      }
      if (a.tipo === "efecto") {
        escribir(`${u.nombre} usa ${a.nombre}.`, "accion");
        const blanco = objetivos[0] || u;
        if (a.estado) ponerCondicion(blanco, a.estado.nombre, a.estado.turnos, u);
        return;
      }
      if (a.tipo === "arma" && !a.area) {
        const blanco = objetivos[0];
        if (blanco) ataqueArma(u, a, blanco);
        return;
      }
      // salvación (con o sin área) o daño automático
      escribir(`${u.nombre} usa ${a.nombre}.`, "accion");
      const lista = a.area ? objetivos.filter(v => v !== u) : objetivos;
      lista.forEach(v => {
        if (a.tipo === "salvacion") {
          const s = salvar(v, a.salv, a.cd);
          escribir(`${v.nombre} salva ${a.salv.toUpperCase()}: ${s.total} contra CD ${a.cd} ${s.exito ? "(éxito)" : "(falla)"}.`, "tirada");
          const total = a.danos.reduce((t, z) => t + VH.tirar(z.f).total, 0);
          if (a.danos.length) {
            const por = s.exito ? (a.mitad ? Math.floor(total / 2) : 0) : total;
            if (por > 0) recibirDano(v, por, a.danos[0].t, u, a.nombre);
          }
          if (!s.exito) { aplicarSecundarios(u, a, v); }
        } else {
          a.danos.forEach(z => recibirDano(v, VH.tirar(z.f).total, z.t, u, a.nombre));
          aplicarSecundarios(u, a, v);
        }
      });
    }

    function aplicarSecundarios(u, a, v) {
      if (a.estado && vivo(v)) ponerCondicion(v, a.estado.nombre, a.estado.turnos, u);
      if (a.empuje && vivo(v)) empujar(v, u, a.empuje);
    }

    function ataqueArma(u, a, blanco) {
      const cuerpo = !a.distancia && a.alcance <= 2;
      const r = tirarAtaque(u, blanco, a.ataque, cuerpo);
      const etiqueta = r.ventaja > 0 ? " (ventaja)" : r.ventaja < 0 ? " (desventaja)" : "";
      escribir(`${u.nombre} ataca a ${blanco.nombre} con ${a.nombre}${etiqueta}: ${r.natural}${VH.signo(a.ataque)} = ${r.total} contra CA ${blanco.ca} ${r.impacta ? (r.critico ? "¡crítico!" : "impacta") : "falla"}.`, "tirada");
      if (!r.impacta) { flotar(blanco, "falla", "#aaa"); return; }
      let total = 0;
      let tipoPrincipal = a.danos[0] ? a.danos[0].t : "";
      const partes = [];
      a.danos.forEach(z => {
        const v = VH.tirar(z.f, r.critico).total;
        total += v; partes.push([v, z.t]);
      });
      const extras = [];
      if (a.furtivo && !u.turno.furtivo) {
        const hayAliado = aliados(u).some(o => o !== u && VH.dist(o, blanco) <= 1 && !incapacitado(o));
        if (r.ventaja > 0 || (hayAliado && r.ventaja >= 0)) {
          u.turno.furtivo = true;
          const v = VH.tirar(`${u.furtivoDados}d6`, r.critico).total;
          extras.push([v, a.danos[0].t, "furtivo"]);
        }
      }
      if (cuerpo && tieneCond(u, "furia")) extras.push([u.furia, a.danos[0].t, "furia"]);
      if (a.castigo && u.castigoActivo) {
        const nivel = nivelEspacioMinimo(u, 1);
        if (nivel) {
          u.usados[nivel - 1]++;
          const v = VH.tirar(`${Math.min(5, 1 + nivel)}d8`, r.critico).total;
          extras.push([v, "radiante", "castigo divino"]);
        }
      }
      if (a.cazador && tieneCond(blanco, "marcado") && blanco.marcadoPor === u.id) {
        extras.push([VH.tirar(u.cazadorDados || "1d6", r.critico).total, a.danos[0].t, "presa marcada"]);
      }
      let dañado = 0;
      partes.forEach(([v, t]) => { dañado += recibirDano(blanco, v, t, u, a.nombre); });
      extras.forEach(([v, t, nombre]) => { dañado += recibirDano(blanco, v, t, u, nombre); });
      if (a.robo && dañado > 0) curar(u, Math.floor(dañado * a.robo));
      if (vivo(blanco)) {
        if (a.estado && !(a.estado.salv)) {
          if (a.cd && a.salv) {
            const s = salvar(blanco, a.salv, a.cd);
            if (!s.exito) ponerCondicion(blanco, a.estado.nombre, a.estado.turnos, u);
          } else ponerCondicion(blanco, a.estado.nombre, a.estado.turnos, u);
        }
        if (a.empuje) empujar(blanco, u, a.empuje);
        if (blanco.espinas && cuerpo) recibirDano(u, VH.tirar(blanco.espinas.f).total, blanco.espinas.t, blanco, "las espinas");
      }
    }

    function danoConjuro(cj, nivelUsado, nivelPj) {
      const base = cj.danos.map(z => ({ f: z.f, t: z.t }));
      if (cj.truco) {
        const mult = VH.multiplicadorTruco(nivelPj);
        if (mult > 1) base.forEach(z => { z.f = z.f.replace(/^(\d+)d/, (m, n) => `${parseInt(n, 10) * mult}d`); });
      } else if (cj.escala && nivelUsado > cj.nivel) {
        const extra = nivelUsado - cj.nivel;
        const m = cj.escala.match(/^(\d+)d(\d+)$/);
        if (m) base[0].f = `${base[0].f}+${parseInt(m[1], 10) * extra}d${m[2]}`;
      }
      return base;
    }

    function lanzar(u, cj, d, nivelUsado) {
      const objetivos = d.victimas || [];
      escribir(`${u.nombre} lanza ${cj.nombre}${nivelUsado > cj.nivel && cj.nivel > 0 ? ` (nivel ${nivelUsado})` : ""}.`, "accion");
      if (cj.concentracion) {
        cortarConcentracion(u);
      }
      if (d.teleport) { u.x = d.x; u.y = d.y; flotar(u, "¡Puf!", "#b9a0ff"); peligroEn(u, u.x, u.y); return; }
      const danos = danoConjuro(cj, nivelUsado, u.nivel);
      if (cj.tipo === "cura") {
        objetivos.forEach(v => {
          let f = cj.cura;
          if (cj.escalaCura && nivelUsado > cj.nivel) f = `${f}+${(nivelUsado - cj.nivel)}${cj.escalaCura.replace(/^\d+/, "")}`;
          const n = VH.tirar(f).total + (cj.sumaMod ? Math.max(0, u.lanz.mod) : 0);
          curar(v, n);
        });
        return;
      }
      if (cj.tipo === "efecto") {
        const lista = objetivos.slice(0, cj.objetivosMax || 1);
        lista.forEach(v => ponerCondicion(v, cj.estado.nombre, cj.estado.turnos, u));
        if (cj.concentracion) u.concentra = { estado: cj.estado.nombre, objetivos: lista };
        return;
      }
      const lista = objetivos.filter(v => v !== u);
      const rayos = cj.rayos === "truco" ? VH.multiplicadorTruco(u.nivel) : (cj.rayos ? cj.rayos + (cj.escalaRayos && nivelUsado > cj.nivel ? cj.escalaRayos * (nivelUsado - cj.nivel) : 0) : 1);
      const dardos = cj.dardos ? cj.dardos + (cj.escalaDardos ? cj.escalaDardos * Math.max(0, nivelUsado - cj.nivel) : 0) : 1;
      lista.forEach(v => {
        if (cj.tipo === "ataque") {
          for (let i = 0; i < rayos && vivo(v); i++) {
            const r = tirarAtaque(u, v, u.lanz.ataque, false);
            escribir(`${u.nombre} contra ${v.nombre}: ${r.natural}${VH.signo(u.lanz.ataque)} = ${r.total} contra CA ${v.ca} ${r.impacta ? (r.critico ? "¡crítico!" : "impacta") : "falla"}.`, "tirada");
            if (!r.impacta) { flotar(v, "falla", "#aaa"); continue; }
            danos.forEach(z => recibirDano(v, VH.tirar(z.f, r.critico).total + (cj.sumaMod && z === danos[0] ? Math.max(0, u.lanz.mod) : 0), z.t, u, cj.nombre));
            if (cj.estado && vivo(v)) ponerCondicion(v, cj.estado.nombre, cj.estado.turnos, u);
            if (cj.empuje && vivo(v)) empujar(v, u, cj.empuje);
          }
        } else if (cj.tipo === "salvacion") {
          const s = salvar(v, cj.salv, u.lanz.cd);
          escribir(`${v.nombre} salva ${cj.salv.toUpperCase()}: ${s.total} contra CD ${u.lanz.cd} ${s.exito ? "(éxito)" : "(falla)"}.`, "tirada");
          const total = danos.reduce((t, z) => t + VH.tirar(z.f).total, 0);
          if (danos.length) {
            const por = s.exito ? (cj.mitad ? Math.floor(total / 2) : 0) : total;
            if (por > 0) recibirDano(v, por, danos[0].t, u, cj.nombre);
          }
          if (!s.exito) {
            if (cj.estado && vivo(v)) {
              ponerCondicion(v, cj.estado.nombre, cj.estado.turnos, u);
              if (cj.concentracion) u.concentra = { estado: cj.estado.nombre, objetivos: [v] };
            }
            if (cj.empuje && vivo(v)) empujar(v, u, cj.empuje);
          }
        } else if (cj.tipo === "auto") {
          for (let i = 0; i < dardos && vivo(v); i++) {
            danos.forEach(z => recibirDano(v, VH.tirar(z.f).total + (cj.sumaMod && z === danos[0] ? Math.max(0, u.lanz.mod) : 0), z.t, u, cj.nombre));
          }
        }
      });
    }

    /* --- Turnos -------------------------------------------------------------------------- */
    function iniciarTurno(u) {
      c.activo = u;
      u.turno = { mov: velocidadActual(u), accion: 1, bonus: true, ataquesExtra: 0, movido: false, furtivo: false };
      if (tieneCond(u, "esquivando")) delete u.cond.esquivando;
      if (tieneCond(u, "acelerado")) u.turno.accion = 2;
      Object.keys(u.recargaPend).forEach(id => {
        const a = u.acciones.find(z => z.id === id);
        if (a && VH.d(6) >= a.recarga) { delete u.recargaPend[id]; escribir(`${u.nombre} recarga ${a.nombre}.`, "info"); }
      });
      const t = terrenoEn(u.x, u.y);
      if (t === TERRENO.FUEGO) peligroEn(u, u.x, u.y);
      if (incapacitado(u)) { escribir(`${u.nombre} no puede actuar.`, "info"); u.turno.accion = 0; u.turno.bonus = false; u.turno.mov = 0; }
      c.version++;
    }

    c.empezar = function () {
      c.indice = 0;
      const primero = c.unidades.find(u => u.id === c.orden[0]);
      iniciarTurno(primero);
      saltarSiNoVive();
    };

    function saltarSiNoVive() {
      let guarda = 0;
      while (!c.fin && !vivo(c.activo) && guarda++ < 40) avanzar();
    }

    function avanzar() {
      const anterior = c.activo;
      if (anterior && vivo(anterior)) {
        Object.keys(anterior.cond).forEach(n => {
          if (anterior.cond[n] === 99) return;
          anterior.cond[n]--;
          if (anterior.cond[n] <= 0) delete anterior.cond[n];
        });
      }
      c.indice++;
      if (c.indice >= c.orden.length) { c.indice = 0; c.ronda++; escribir(`— Ronda ${c.ronda} —`, "ronda"); }
      const sig = c.unidades.find(u => u.id === c.orden[c.indice]);
      iniciarTurno(sig);
    }

    c.terminarTurno = function () {
      if (c.fin) return;
      avanzar();
      saltarSiNoVive();
    };

    /* --- IA -------------------------------------------------------------------------------- */
    function campoDistancia(destino) {
      const mapa = new Map([[clave(destino.x, destino.y), 0]]);
      const cola = [[destino.x, destino.y]];
      while (cola.length) {
        const [x, y] = cola.shift();
        const d = mapa.get(clave(x, y));
        DIRS.forEach(([dx, dy]) => {
          const nx = x + dx, ny = y + dy;
          if (!enMapa(nx, ny) || terrenoEn(nx, ny) === TERRENO.ROCA || mapa.has(clave(nx, ny))) return;
          mapa.set(clave(nx, ny), d + 1); cola.push([nx, ny]);
        });
      }
      return mapa;
    }

    function valorOpcion(u, op, d, nivelEspacio) {
      const a = op.accion;
      const cj = op.conjuro;
      let valor = 0;
      const amigos = d.victimas.filter(v => bando(v) === bando(u) && v !== u);
      const enemigosV = d.victimas.filter(v => bando(v) !== bando(u));
      const tipo = cj ? cj.tipo : a.tipo;
      const danosBase = cj ? danoConjuro(cj, nivelEspacio || cj.nivel, u.nivel) : a.danos;
      const promedio = (danosBase || []).reduce((t, z) => t + VH.promedio(z.f), 0);
      const reparto = (v, probabilidad, mitad) => {
        const base = promedio * (mitad ? (0.5 + 0.5 * probabilidad) : probabilidad);
        return Math.min(base, v.pv + 6) + (base >= v.pv ? 6 : 0);
      };
      if (tipo === "cura") {
        const f = cj ? cj.cura : a.cura;
        if (f === "reserva") return 0;
        const prom = VH.promedio(f) + (cj && cj.sumaMod ? Math.max(0, u.lanz.mod) : 0);
        const blancos = d.victimas.filter(v => bando(v) === bando(u));
        blancos.forEach(v => { if (v.pvMax - v.pv >= prom * 0.6 && v.pv < v.pvMax * 0.6) valor += Math.min(prom, v.pvMax - v.pv) * 0.9 + (v.caido ? 12 : 0); });
        return valor;
      }
      if (tipo === "efecto") {
        const est = cj ? cj.estado : a.estado;
        if (!est) return 0;
        const ayuda = ["furia", "bendecido", "acelerado"].includes(est.nombre);
        if (est.nombre === "marcado") { const b = enemigosV[0]; return b && !tieneCond(b, "marcado") ? 5 : 0; }
        if (ayuda) { const k = d.victimas.filter(v => bando(v) === bando(u) && !tieneCond(v, est.nombre)).length; return k && rivales(u).some(r => VH.dist(r, u) <= 8) ? 7 * Math.min(k, cj && cj.objetivosMax ? cj.objetivosMax : 1) : 0; }
        return enemigosV.length ? 6 : 0;
      }
      enemigosV.forEach(v => {
        let p = 1;
        if (tipo === "arma") {
          const falta = Math.max(0, v.ca - (a.ataque || 0));
          p = Math.min(0.95, Math.max(0.05, (21 - falta) / 20));
          valor += reparto(v, p, false) * (a.furtivo ? 1.4 : 1);
        } else if (tipo === "ataque") {
          p = Math.min(0.95, Math.max(0.05, (21 - Math.max(0, v.ca - u.lanz.ataque)) / 20));
          valor += reparto(v, p, false);
        } else if (tipo === "salvacion") {
          const cd = cj ? u.lanz.cd : a.cd;
          const atr = cj ? cj.salv : a.salv;
          p = Math.min(0.95, Math.max(0.05, (cd - (v.mod[atr] || 0) - 1) / 20));
          valor += reparto(v, p, cj ? cj.mitad : a.mitad);
          if ((cj && cj.estado) || (a && a.estado)) valor += 4 * p;
        } else {
          valor += reparto(v, 1, false);
        }
      });
      // el fuego amigo cuesta más que lo que gana
      amigos.forEach(v => { valor -= promedio * 1.6; });
      // las acciones limitadas rinden un poco más al principio
      if (a && (a.usos || a.recarga)) valor *= 1.15;
      return valor;
    }

    function mejorJugada(u) {
      const mapa = alcanzables(u);
      let mejor = null;
      const ops = c.opciones(u).filter(o => o.ok && !(o.accion && o.accion.tipo === "especial") && !(o.conjuro && o.conjuro.tipo === "teleport"));
      const lejos = u.ia === "distancia";
      mapa.forEach((info, k) => {
        const origen = { x: info.x, y: info.y };
        let bonoPos = 0;
        const ter = terrenoEn(info.x, info.y);
        if (ter === TERRENO.FUEGO) bonoPos -= 7;
        if (ter === TERRENO.PINCHOS) bonoPos -= 9;
        if (ter === TERRENO.BARRO) bonoPos -= 1;
        const cercanos = rivales(u).filter(r => VH.dist(r, origen) <= 1);
        if (lejos) bonoPos -= cercanos.length * 3;
        bonoPos -= info.coste * 0.05;
        ops.forEach(op => {
          const destinos = c.destinosDesde(u, op, origen);
          const nivel = op.conjuro && op.conjuro.nivel > 0 ? nivelEspacioMinimo(u, op.conjuro.nivel) : 0;
          // con espacios de sobra, la IA gasta el nivel más alto para los daños grandes
          destinos.forEach(d => {
            if (!d.victimas.length) return;
            const v = valorOpcion(u, op, d, nivel) + bonoPos;
            if (v > 0 && (!mejor || v > mejor.valor)) mejor = { valor: v, tile: origen, op, d, nivel };
          });
        });
      });
      return mejor;
    }

    c.siguientePasoIA = function () {
      const u = c.activo;
      if (!u || c.fin || !vivo(u)) return null;
      const t = u.turno;
      t.pasos = (t.pasos || 0) + 1;
      if (t.pasos > 14) return null;
      const jugada = mejorJugada(u);
      if (jugada) {
        if (jugada.tile.x !== u.x || jugada.tile.y !== u.y) return { tipo: "mover", x: jugada.tile.x, y: jugada.tile.y, luego: jugada };
        return { tipo: "accion", op: jugada.op, destino: jugada.d, nivel: jugada.nivel };
      }
      // nada que hacer desde donde llegue: acercarse
      if (t.mov > 0 && !t.acerco) {
        t.acerco = true;
        const enemigos = rivales(u);
        if (!enemigos.length) return null;
        const campos = enemigos.map(e => campoDistancia(e));
        const mapa = alcanzables(u);
        let mejor = null;
        mapa.forEach((info) => {
          const dm = Math.min(...campos.map(f => (f.get(clave(info.x, info.y)) === undefined ? 99 : f.get(clave(info.x, info.y)))));
          const ter = terrenoEn(info.x, info.y);
          let costo = dm + (ter === TERRENO.FUEGO ? 6 : ter === TERRENO.PINCHOS ? 8 : 0);
          if (u.ia === "distancia") costo = Math.abs(dm - 6) + (ter === TERRENO.FUEGO ? 6 : ter === TERRENO.PINCHOS ? 8 : 0);
          if (!mejor || costo < mejor.costo) mejor = { costo, x: info.x, y: info.y };
        });
        if (mejor && (mejor.x !== u.x || mejor.y !== u.y)) return { tipo: "mover", x: mejor.x, y: mejor.y };
      }
      // el caído en retirada: si no se puede hacer nada más, se cura o esquiva
      if (t.accion > 0 && !t.esquivo && u.pv < u.pvMax * 0.3) {
        const esq = c.opciones(u).find(o => o.ok && o.accion && o.accion.especial === "esquivar");
        if (esq) { t.esquivo = true; return { tipo: "accion", op: esq, destino: { x: u.x, y: u.y, victimas: [u], propio: true } }; }
      }
      return null;
    };

    c.pasoMoverEjecutar = function (paso) { return c.mover(c.activo, paso.x, paso.y); };

    return c;
  };
})(window.VH);
