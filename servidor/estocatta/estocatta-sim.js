/* Estocatta: simulación del combate. Es el único sitio donde viven las reglas.
   Lo cargan el servidor (Node) y el navegador (modo local de pruebas y dibujo), así
   que no puede haber dos versiones distintas de las reglas.

   Es determinista: sin azar y sin relojes. Cada llamada a paso() avanza un tick
   (TICK_HZ por segundo) con las entradas de los dos jugadores. Mismas entradas,
   mismo resultado. Todos los tiempos de CFG están en milisegundos y las distancias
   en unidades lógicas (el suelo es y = 0 y la altura crece hacia arriba).

   Alturas de la espada: 0 alta, 1 media, 2 baja. Un golpe alcanza a un cuerpo si
   alguna de las alturas del golpe cae en las alturas que el cuerpo ocupa:
   de pie ocupa las tres, agachado solo media y baja, en el aire solo alta y media. */
(function (raiz, fabrica) {
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.Estocatta = fabrica();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const CFG = {
    TICK_HZ: 30,                // simulación; el envío de estados es otra frecuencia (ver servidor)
    TIEMPO_PARTIDA: 180000,
    TIEMPO_MUERTE_SUBITA: 25000,
    CUENTA_ATRAS: 3000,

    PISTA: 4800,                // largo de la pista; la salida del jugador 0 está a la derecha y la del 1 a la izquierda
    SALIDA: 140,                // ancho de la zona de salida: llegar a ella gana
    SEPARACION_INICIAL: 300,    // cada uno empieza a esta distancia del centro
    ANCHO_CUERPO: 40,
    ALTO_CUERPO: 100,

    CAMINAR: 150, CORRER: 270,  // unidades por segundo
    VEL_GUARDIA: 0.5,           // multiplicador al caminar con guardia levantada
    SALTO_VY: 600, GRAVEDAD: 1500, AIRE_ACEL: 420,
    ATERRIZAJE: 90,            // ms sin poder actuar al tocar el suelo

    // Cada ataque: preparación (se ve venir), impacto (hace daño) y recuperación (vulnerable).
    ESTOCADA: { prep: 150, impacto: 90, recup: 300, alcance: 130, avance: 36 },
    TAJO: { prep: 300, impacto: 120, recup: 480, alcance: 165, avance: 20 },
    FINTA: { prep: 140, recup: 120, avance: 24, cancelar: 0.6 }, // cancelar: multiplica la preparación del ataque al que se cancela

    PARADA: { ventana: 130, fallo: 320, aturdimiento: 520, contragolpe: 500, prepContragolpe: 60 },
    GUARDIA: { maxima: 1400, cansada: 700 },
    BLOQUEO: { retroceso_atacante: 250, empuje_atacante: 34, empuje_defensor: 12, tajo_cansa: 500 },
    CHOQUE: { recup_extra: 300, empuje: 60 },

    REAPARICION: 1800,          // ms hasta volver tras morir
    PROTECCION: 1500,           // ms sin poder ser herido; atacar o fintar la termina
    DISTANCIA_REAPARICION: 720, // el caído reaparece delante del que lo mató, hacia la salida de este
    DISTANCIA_MINIMA_REAPARICION: 140,
    MARGEN_EMPATE: 0.03,        // diferencia de progreso por debajo de la cual se mira otro criterio al acabarse el tiempo

    ESPERA_RECONEXION: 12000    // lo usa el servidor
  };

  const ms = n => Math.max(1, Math.round(n / (1000 / CFG.TICK_HZ)));
  const DT = 1 / CFG.TICK_HZ;
  const HW = CFG.ANCHO_CUERPO / 2;

  const ENTRADA_NEUTRA = Object.freeze({ mov: 0, correr: false, agachar: false, guardia: false, ev: Object.freeze([]) });
  const EVENTOS_VALIDOS = ["saltar", "estocada", "tajo", "finta", "parada", "altura+", "altura-"];

  /* Entradas que llegan de fuera (teclado o red): se limpian siempre antes de usarse. */
  function normalizar(e) {
    if (!e || typeof e !== "object") return ENTRADA_NEUTRA;
    const mov = e.mov > 0 ? 1 : e.mov < 0 ? -1 : 0;
    const ev = Array.isArray(e.ev) ? e.ev.filter(x => EVENTOS_VALIDOS.indexOf(x) >= 0).slice(0, 6) : [];
    return { mov, correr: e.correr === true, agachar: e.agachar === true, guardia: e.guardia === true, ev };
  }

  function nuevoLuchador(id, x, cara) {
    return {
      id, x, y: 0, vy: 0, vx: 0, cara, altura: 1, agachado: false,
      accion: null,         // { tipo, fase, t, altura, resuelto }
      guardando: false, guardiaT: 0, sinGuardia: 0,
      aturdido: 0, contra: 0,
      vivo: true, muertoT: 0, proteccion: 0, matador: -1,
      bajas: 0, muertes: 0, mov: 0, correr: false
    };
  }

  function crearPartida(opciones) {
    const o = opciones || {};
    const c = CFG.PISTA / 2;
    return {
      version: 1,
      tick: 0,
      fase: o.sinCuenta ? "juego" : "cuenta",   // cuenta | juego | muerte_subita | fin
      cuenta: ms(CFG.CUENTA_ATRAS),
      reloj: ms(o.tiempo || CFG.TIEMPO_PARTIDA),
      j: [nuevoLuchador(0, c - CFG.SEPARACION_INICIAL, 1), nuevoLuchador(1, c + CFG.SEPARACION_INICIAL, -1)],
      ventaja: -1,       // quién tiene la ventaja territorial: el último que mató; -1 si nadie
      eventos: [],
      ganador: -1,       // -1 sin ganador (o empate si fase = fin)
      motivo: "",
      pausado: false
    };
  }

  /* --- Geometría ---------------------------------------------------------------- */

  function bandasCuerpo(f) {
    if (f.y > 20) return [0, 1];
    if (f.agachado) return [1, 2];
    return [0, 1, 2];
  }
  function bandasAtaque(tipo, altura) {
    if (tipo === "estocada") return [altura];
    if (altura === 0) return [0, 1];
    if (altura === 1) return [0, 1, 2];
    return [1, 2];
  }
  function hayInterseccion(a, b) { return a.some(x => b.indexOf(x) >= 0); }

  function alcanceDe(f) {
    const a = f.accion;
    return a.tipo === "tajo" ? CFG.TAJO.alcance : CFG.ESTOCADA.alcance;
  }

  /* Los cuerpos se atraviesan solo si uno está por encima de la cabeza del otro. */
  function sonSolidos(a, b) {
    return Math.abs(a.y - b.y) < CFG.ALTO_CUERPO;
  }

  /* Mueve a f en dx sin entrar en el cuerpo del otro ni salirse de la pista. Si ya se
     solapaban (uno aterrizó encima del otro) se puede retroceder, pero no avanzar. */
  function desplazar(est, f, dx) {
    const o = est.j[1 - f.id];
    let nx = f.x + dx;
    if (o.vivo && sonSolidos(f, o)) {
      if (f.x < o.x) nx = Math.min(nx, Math.max(f.x, o.x - CFG.ANCHO_CUERPO));
      else nx = Math.max(nx, Math.min(f.x, o.x + CFG.ANCHO_CUERPO));
    }
    f.x = Math.max(HW, Math.min(CFG.PISTA - HW, nx));
  }

  /* --- Acciones ---------------------------------------------------------------- */

  function libre(f) {
    return f.vivo && !f.accion && f.aturdido === 0 && f.y === 0;
  }

  function iniciar(f, tipo, extra) {
    const a = { tipo, fase: "prep", t: 1, altura: f.altura, resuelto: false };
    if (tipo === "estocada") a.t = ms(CFG.ESTOCADA.prep);
    else if (tipo === "tajo") a.t = ms(CFG.TAJO.prep);
    else if (tipo === "finta") a.t = ms(CFG.FINTA.prep);
    else if (tipo === "parada") { a.fase = "ventana"; a.t = ms(CFG.PARADA.ventana); }
    if (extra && extra.reducir) a.t = Math.max(1, Math.round(a.t * extra.reducir));
    if (extra && extra.prep) a.t = extra.prep;
    f.accion = a;
    if (tipo !== "parada") f.proteccion = 0;   // atacar o fintar termina la protección
    f.guardando = false;
  }

  function procesarEventos(est, f, entrada) {
    for (const ev of entrada.ev) {
      if (!f.vivo) return;
      if (ev === "altura+" || ev === "altura-") {
        const en_finta = f.accion && f.accion.tipo === "finta" && f.accion.fase === "prep";
        if (!f.accion || en_finta) {
          f.altura = ev === "altura+" ? Math.max(0, f.altura - 1) : Math.min(2, f.altura + 1);
          if (en_finta) f.accion.altura = f.altura;
        }
        continue;
      }
      // desde una finta se puede pasar directamente a un ataque con la preparación recortada
      const enFinta = f.accion && f.accion.tipo === "finta" && f.accion.fase === "prep";
      if (enFinta && (ev === "estocada" || ev === "tajo")) {
        iniciar(f, ev, { reducir: CFG.FINTA.cancelar });
        continue;
      }
      if (!libre(f)) continue;
      if (ev === "saltar") {
        f.vy = CFG.SALTO_VY; f.y = 0.001; f.agachado = false;
        f.vx = entrada.mov * (entrada.correr ? CFG.CORRER : CFG.CAMINAR);
      } else if (ev === "estocada") {
        if (f.contra > 0) { iniciar(f, "estocada", { prep: ms(CFG.PARADA.prepContragolpe) }); f.contra = 0; }
        else iniciar(f, "estocada");
      } else if (ev === "tajo") iniciar(f, "tajo");
      else if (ev === "finta") iniciar(f, "finta");
      else if (ev === "parada") iniciar(f, "parada");
    }
  }

  function avanzarAcciones(est) {
    for (const f of est.j) {
      if (!f.vivo || !f.accion) continue;
      const a = f.accion;
      a.t--;
      if (a.t > 0) {
        if (a.tipo === "finta" && a.fase === "prep") desplazar(est, f, f.cara * CFG.FINTA.avance / ms(CFG.FINTA.prep));
        continue;
      }
      // cambio de fase
      if (a.tipo === "estocada" || a.tipo === "tajo") {
        const c = a.tipo === "estocada" ? CFG.ESTOCADA : CFG.TAJO;
        if (a.fase === "prep") { a.fase = "impacto"; a.t = ms(c.impacto); }
        else if (a.fase === "impacto") { a.fase = "recup"; a.t = ms(c.recup); }
        else f.accion = null;
      } else if (a.tipo === "finta") {
        if (a.fase === "prep") { a.fase = "recup"; a.t = ms(CFG.FINTA.recup); }
        else f.accion = null;
      } else if (a.tipo === "parada") {
        if (a.fase === "ventana") { a.fase = "recup"; a.t = ms(CFG.PARADA.fallo); }
        else f.accion = null;
      } else f.accion = null;
    }
    // el golpe avanza al cuerpo mientras dura el impacto, también en el primer tick
    for (const f of est.j) {
      const a = f.accion;
      if (!f.vivo || !a || a.fase !== "impacto") continue;
      if (a.tipo === "estocada") desplazar(est, f, f.cara * CFG.ESTOCADA.avance / ms(CFG.ESTOCADA.impacto));
      else if (a.tipo === "tajo") desplazar(est, f, f.cara * CFG.TAJO.avance / ms(CFG.TAJO.impacto));
    }
  }

  /* --- Impactos ---------------------------------------------------------------- */

  function ataqueActivo(f) {
    const a = f.accion;
    return !!(f.vivo && a && a.fase === "impacto" && !a.resuelto && (a.tipo === "estocada" || a.tipo === "tajo"));
  }

  /* ¿Llega la espada de a al cuerpo de d? Solo hacia donde mira a, y solo al alcance. */
  function alcanza(a, d) {
    const dist = (d.x - a.x) * a.cara;
    if (dist < -HW) return false;                       // está a su espalda
    if (dist - HW > alcanceDe(a)) return false;
    return hayInterseccion(bandasAtaque(a.accion.tipo, a.accion.altura), bandasCuerpo(d));
  }

  /* Qué le pasa a d cuando a lo golpea: nada | herido | bloqueo | parada */
  function defensa(a, d) {
    if (d.proteccion > 0) return "nada";
    const bandas = bandasAtaque(a.accion.tipo, a.accion.altura);
    const dePie = (a.x - d.x) * d.cara > 0;             // d mira hacia a: solo así puede defender
    if (dePie && d.accion && d.accion.tipo === "parada" && d.accion.fase === "ventana" && bandas.indexOf(d.accion.altura) >= 0) return "parada";
    if (dePie && d.guardando && bandas.indexOf(d.altura) >= 0) return "bloqueo";
    return "herido";
  }

  function resolverImpactos(est) {
    const A = est.j[0], B = est.j[1];
    const aA = ataqueActivo(A), aB = ataqueActivo(B);

    // choque de espadas: los dos golpean a la vez a la misma altura y sus espadas se cruzan
    if (aA && aB) {
      const dist = Math.abs(B.x - A.x);
      const mirandose = (B.x - A.x) * A.cara > 0 && (A.x - B.x) * B.cara > 0;
      if (mirandose && dist <= alcanceDe(A) + alcanceDe(B) &&
          hayInterseccion(bandasAtaque(A.accion.tipo, A.accion.altura), bandasAtaque(B.accion.tipo, B.accion.altura))) {
        for (const f of [A, B]) {
          f.accion.resuelto = true;
          f.accion.fase = "recup"; f.accion.t = ms(CFG[f.accion.tipo === "tajo" ? "TAJO" : "ESTOCADA"].recup + CFG.CHOQUE.recup_extra);
          desplazar(est, f, -f.cara * CFG.CHOQUE.empuje);
        }
        est.eventos.push({ e: "choque", x: (A.x + B.x) / 2 });
        return;
      }
    }

    const resultado = [null, null];                      // resultado[i]: lo que le pasa al defensor del ataque de i
    for (const a of est.j) {
      if (!ataqueActivo(a)) continue;
      const d = est.j[1 - a.id];
      if (!d.vivo) continue;
      if (!alcanza(a, d)) continue;
      resultado[a.id] = defensa(a, d);
    }

    // heridas simultáneas: mueren los dos
    if (resultado[0] === "herido" && resultado[1] === "herido") {
      matar(est, B, -1); matar(est, A, -1);
      est.ventaja = -1;
      est.eventos.push({ e: "doble", x: (A.x + B.x) / 2 });
      if (est.fase === "muerte_subita") terminar(est, -1, "empate");
      return;
    }
    for (const a of est.j) {
      const r = resultado[a.id];
      if (!r) continue;
      const d = est.j[1 - a.id];
      if (r === "herido") { a.accion.resuelto = true; matar(est, d, a.id); }
      else if (r === "bloqueo") {
        a.accion.resuelto = true;
        a.accion.fase = "recup";
        a.accion.t = ms((a.accion.tipo === "tajo" ? CFG.TAJO.recup : CFG.ESTOCADA.recup) + CFG.BLOQUEO.retroceso_atacante);
        desplazar(est, a, -a.cara * CFG.BLOQUEO.empuje_atacante);
        desplazar(est, d, -d.cara * CFG.BLOQUEO.empuje_defensor);
        if (a.accion.tipo === "tajo") d.sinGuardia = Math.max(d.sinGuardia, ms(CFG.BLOQUEO.tajo_cansa));
        est.eventos.push({ e: "bloqueo", x: d.x, por: d.id });
      } else if (r === "parada") {
        a.accion = null;
        a.aturdido = ms(CFG.PARADA.aturdimiento);
        d.accion = null;
        d.contra = ms(CFG.PARADA.contragolpe);
        est.eventos.push({ e: "parada", x: d.x, por: d.id });
      }
    }
  }

  /* --- Muerte, reaparición y fin ---------------------------------------------------------------- */

  function matar(est, d, matador) {
    if (!d.vivo) return;
    d.vivo = false;
    d.accion = null; d.guardando = false; d.agachado = false; d.aturdido = 0; d.contra = 0;
    d.vy = 0; d.y = 0; d.vx = 0;
    d.muertes++;
    d.muertoT = ms(CFG.REAPARICION);
    d.matador = matador;
    if (matador >= 0) {
      est.j[matador].bajas++;
      est.ventaja = matador;
    }
    est.eventos.push({ e: "muerte", quien: d.id, por: matador, x: d.x });
    if (est.fase === "muerte_subita") {
      if (matador >= 0) terminar(est, matador, "muerte_subita");
    }
  }

  function terminar(est, ganador, motivo) {
    est.fase = "fin";
    est.ganador = ganador;
    est.motivo = motivo;
    est.eventos.push({ e: "fin", ganador, motivo });
  }

  /* El caído reaparece delante de quien lo mató, hacia la salida de este: así sigue
     siendo el obstáculo. La posición se calcula al reaparecer, no al morir. */
  function posicionReaparicion(est, d) {
    const m = d.matador;
    if (m < 0) {
      const o = est.j[1 - d.id];
      const medio = (est.j[0].x + est.j[1].x) / 2;
      const x = d.id === 0 ? medio - CFG.SEPARACION_INICIAL : medio + CFG.SEPARACION_INICIAL;
      return Math.max(HW + 10, Math.min(CFG.PISTA - HW - 10, x));
    }
    const k = est.j[m];
    const dir = m === 0 ? 1 : -1;
    let x = k.x + dir * CFG.DISTANCIA_REAPARICION;
    x = Math.max(HW + 10, Math.min(CFG.PISTA - HW - 10, x));
    // nunca encima de quien lo mató
    if ((x - k.x) * dir < CFG.DISTANCIA_MINIMA_REAPARICION) {
      x = Math.max(HW + 10, Math.min(CFG.PISTA - HW - 10, k.x + dir * CFG.DISTANCIA_MINIMA_REAPARICION));
    }
    return x;
  }

  function reaparecer(est, d) {
    d.x = posicionReaparicion(est, d);
    d.y = 0; d.vy = 0; d.vx = 0;
    d.vivo = true; d.muertoT = 0;
    d.altura = 1; d.agachado = false; d.accion = null;
    d.guardando = false; d.guardiaT = 0; d.sinGuardia = 0; d.aturdido = 0; d.contra = 0;
    d.proteccion = ms(CFG.PROTECCION);
    const o = est.j[1 - d.id];
    d.cara = o.x >= d.x ? 1 : -1;
    est.eventos.push({ e: "reaparece", quien: d.id, x: d.x });
  }

  function progreso(est, i) {
    const f = est.j[i];
    return i === 0 ? f.x / CFG.PISTA : (CFG.PISTA - f.x) / CFG.PISTA;
  }

  function agotarTiempo(est) {
    if (est.fase === "muerte_subita") { terminar(est, -1, "empate"); return; }
    const p0 = progreso(est, 0), p1 = progreso(est, 1);
    if (Math.abs(p0 - p1) > CFG.MARGEN_EMPATE) { terminar(est, p0 > p1 ? 0 : 1, "territorio"); return; }
    const b0 = est.j[0].bajas, b1 = est.j[1].bajas;
    if (b0 !== b1) { terminar(est, b0 > b1 ? 0 : 1, "bajas"); return; }
    // muerte súbita: el siguiente que muera pierde; sin reapariciones
    est.fase = "muerte_subita";
    est.reloj = ms(CFG.TIEMPO_MUERTE_SUBITA);
    const c = CFG.PISTA / 2;
    est.j.forEach((f, i) => {
      f.x = c + (i === 0 ? -CFG.SEPARACION_INICIAL : CFG.SEPARACION_INICIAL);
      f.y = 0; f.vy = 0; f.vx = 0; f.vivo = true; f.muertoT = 0;
      f.accion = null; f.aturdido = 0; f.contra = 0; f.guardando = false; f.agachado = false;
      f.proteccion = 0; f.cara = i === 0 ? 1 : -1;
    });
    est.eventos.push({ e: "muerte_subita" });
  }

  /* --- Un tick ---------------------------------------------------------------- */

  function paso(est, entradas) {
    est.eventos = [];
    if (est.fase === "fin" || est.pausado) return est;
    est.tick++;
    if (est.fase === "cuenta") {
      est.cuenta--;
      if (est.cuenta <= 0) { est.fase = "juego"; est.eventos.push({ e: "empieza" }); }
      return est;
    }
    const ent = [normalizar(entradas && entradas[0]), normalizar(entradas && entradas[1])];

    // 1. temporizadores y entradas
    for (const f of est.j) {
      if (!f.vivo) {
        if (est.fase !== "muerte_subita" && f.muertoT > 0) f.muertoT--;
        continue;
      }
      if (f.proteccion > 0) f.proteccion--;
      if (f.aturdido > 0) f.aturdido--;
      if (f.contra > 0) f.contra--;
      if (f.sinGuardia > 0) f.sinGuardia--;
    }
    for (const f of est.j) {
      if (!f.vivo) continue;
      const e = ent[f.id];
      f.mov = e.mov; f.correr = e.correr;
      procesarEventos(est, f, e);
      // guardia y agacharse: solo mientras se está libre en el suelo
      const puede = f.vivo && !f.accion && f.aturdido === 0 && f.y === 0;
      f.guardando = puede && e.guardia && f.sinGuardia === 0;
      if (puede) f.agachado = e.agachar;
      if (f.guardando) {
        f.guardiaT++;
        if (f.guardiaT > ms(CFG.GUARDIA.maxima)) { f.sinGuardia = ms(CFG.GUARDIA.cansada); f.guardiaT = 0; f.guardando = false; }
      } else f.guardiaT = Math.max(0, f.guardiaT - 2);
      // girar hacia donde se quiere ir, solo si no se está en medio de una acción
      if (puede && e.mov !== 0) f.cara = e.mov;
    }

    // 2. movimiento
    for (const f of est.j) {
      if (!f.vivo) continue;
      if (f.y > 0 || f.vy > 0) {
        // en el aire
        if (f.mov !== 0 && !f.accion) f.vx = Math.max(-CFG.CORRER, Math.min(CFG.CORRER, f.vx + f.mov * CFG.AIRE_ACEL * DT));
        desplazar(est, f, f.vx * DT);
        f.vy -= CFG.GRAVEDAD * DT;
        f.y += f.vy * DT;
        if (f.y <= 0) {
          f.y = 0; f.vy = 0; f.vx = 0;
          f.accion = { tipo: "aterriza", fase: "recup", t: ms(CFG.ATERRIZAJE), altura: f.altura, resuelto: true };
          // si cayó dentro del otro, se separa hacia el lado desde el que venía
          const o = est.j[1 - f.id];
          if (o.vivo && Math.abs(f.x - o.x) < CFG.ANCHO_CUERPO) {
            const lado = f.cara >= 0 ? 1 : -1;
            f.x = Math.max(HW, Math.min(CFG.PISTA - HW, o.x + lado * CFG.ANCHO_CUERPO));
          }
        }
        continue;
      }
      if (f.accion || f.aturdido > 0 || f.agachado) continue;
      if (f.mov !== 0) {
        let v = f.correr ? CFG.CORRER : CFG.CAMINAR;
        if (f.guardando) v *= CFG.VEL_GUARDIA;
        desplazar(est, f, f.mov * v * DT);
      }
    }

    // 3. fases de las acciones y 4. impactos
    avanzarAcciones(est);
    resolverImpactos(est);

    // 5. reapariciones
    for (const f of est.j) {
      if (!f.vivo && est.fase !== "muerte_subita" && f.muertoT === 0 && est.fase !== "fin") reaparecer(est, f);
    }

    // 6. victoria por salida
    if (est.fase !== "fin") {
      const [a, b] = est.j;
      const aLlega = a.vivo && a.x >= CFG.PISTA - CFG.SALIDA;
      const bLlega = b.vivo && b.x <= CFG.SALIDA;
      if (aLlega && bLlega) terminar(est, -1, "empate");
      else if (aLlega) terminar(est, 0, "salida");
      else if (bLlega) terminar(est, 1, "salida");
    }

    // 7. reloj
    if (est.fase !== "fin") {
      est.reloj--;
      if (est.reloj <= 0) agotarTiempo(est);
    }
    return est;
  }

  function abandono(est, i, motivo) {
    if (est.fase === "fin") return est;
    est.eventos = [];
    terminar(est, 1 - i, motivo || "abandono");
    return est;
  }

  /* Animación que debe mostrarse (el cliente no necesita conocer las reglas). */
  function animacion(f) {
    if (!f.vivo) return "muerto";
    if (f.aturdido > 0) return "aturdido";
    const a = f.accion;
    if (a) return a.tipo + "_" + a.fase;
    if (f.y > 0) return "salto";
    if (f.guardando) return "guardia";
    if (f.agachado) return "agachado";
    if (f.mov !== 0) return f.correr ? "correr" : "caminar";
    return "espera";
  }

  /* Lo que se envía por la red y lo que dibuja el cliente. */
  function instantanea(est) {
    const r = v => Math.round(v * 10) / 10;
    return {
      n: est.tick, f: est.fase, c: est.cuenta, r: est.reloj, v: est.ventaja, g: est.ganador, m: est.motivo,
      j: est.j.map(f => ({
        x: r(f.x), y: r(f.y), c: f.cara, h: f.altura, a: animacion(f),
        t: f.accion ? f.accion.t : 0, ha: f.accion ? f.accion.altura : f.altura,
        p: f.proteccion > 0 ? 1 : 0, vivo: f.vivo ? 1 : 0, mt: f.muertoT, ct: f.contra > 0 ? 1 : 0,
        b: f.bajas, d: f.muertes
      })),
      ev: est.eventos.slice()
    };
  }

  function huella(est) {
    return JSON.stringify([est.tick, est.fase, est.ventaja, est.ganador, est.j.map(f => [f.x, f.y, f.vivo, f.accion && [f.accion.tipo, f.accion.fase, f.accion.t], f.proteccion, f.bajas])]);
  }

  return { CFG, ms, crearPartida, paso, abandono, instantanea, animacion, normalizar, huella, ENTRADA_NEUTRA, EVENTOS_VALIDOS, bandasAtaque, bandasCuerpo };
});
