/* Duelo en tiempo real: atacar (toque = rápido, mantener = pesado), bloquear
   (mantener; justo antes del golpe es una parada) y esquivar. El rival hace lo
   mismo y reacciona a lo que haces, con más o menos reflejos según quién sea.
   Campo de tamaño lógico fijo (960x600), igual que el juego de Hooey: el zoom o
   la ventana no cambian la dificultad. Todo se dibuja con formas, sin imágenes. */
(function () {
  const LOGICO_ANCHO = 960;
  const LOGICO_ALTO = 600;
  const SUELO = 470;
  const CLAVE_VICTORIAS = "compendioDueloVictorias";

  const canvas = document.getElementById("dueloCampo");
  const ctx = canvas.getContext("2d");
  const menuEl = document.getElementById("dueloMenu");
  const listaRivalesEl = document.getElementById("dueloRivales");
  const finEl = document.getElementById("dueloFin");
  const finTituloEl = document.getElementById("dueloFinTitulo");
  const finTextoEl = document.getElementById("dueloFinTexto");

  // Con sesión iniciada se muestra el nombre de usuario en vez de "Tú"
  let nombreJugador = "Tú";
  if (window.MjStats) MjStats.cargarSesion().then(({ nombre }) => { if (nombre) nombreJugador = nombre.slice(0, 16); });

  const RIVALES = [
    { id: "recluta", nombre: "Recluta de Brurland", descripcion: "Para aprender los controles.", hp: 60, dano: [7, 13], reaccion: 0.55, bloqueo: 0.12, esquiva: 0.04, agresion: 0.55, finta: 0, castigo: 0.2, aviso: 0.4, arma: 62, color: "#7f93a8" },
    { id: "miliciano", nombre: "Miliciano de Brurland", descripcion: "Pega fuerte si lo dejas.", hp: 80, dano: [9, 17], reaccion: 0.42, bloqueo: 0.28, esquiva: 0.1, agresion: 0.75, finta: 0.05, castigo: 0.35, aviso: 0.33, arma: 68, color: "#9a8a6a" },
    { id: "caballero", nombre: "Caballero de Brurland", descripcion: "Bloquea, esquiva y contraataca.", hp: 105, dano: [11, 21], reaccion: 0.3, bloqueo: 0.45, esquiva: 0.2, agresion: 0.95, finta: 0.15, castigo: 0.55, aviso: 0.27, arma: 74, color: "#8a9aa6" },
    { id: "adam", nombre: "Adam Kovacs, capitán de los caballeros", descripcion: "Casi no se le puede sorprender.", hp: 140, dano: [13, 26], reaccion: 0.17, bloqueo: 0.55, esquiva: 0.3, agresion: 1.15, finta: 0.3, castigo: 0.85, aviso: 0.2, arma: 84, color: "#c9a14a" }
  ];

  // Tiempos del jugador y reglas comunes (segundos)
  const PARADA = 0.14;            // ventana de parada desde que se levanta la guardia
  const RAPIDO = { aviso: 0.2, recuperar: 0.36, costo: 12 };
  const PESADO = { aviso: 0.55, recuperar: 0.62, costo: 26 };
  const ESQUIVA = { dur: 0.42, inicioInv: 0.05, finInv: 0.27, costo: 18 };
  const REGEN_ST = 22;

  let ancho = LOGICO_ANCHO;
  let alto = LOGICO_ALTO;
  let rival = null;
  let j = null;           // jugador
  let e = null;           // rival
  let fase = "menu";      // menu | cuenta | duelo | fin
  let cuenta = 0;
  let textos = [];
  let temblor = 0;
  let ultimo = 0;
  let est = null;         // estadísticas de la partida en curso (del jugador)
  let victorias = {};
  try { victorias = JSON.parse(localStorage.getItem(CLAVE_VICTORIAS) || "{}") || {}; } catch (err) { victorias = {}; }

  function ajustarTamano() {
    const dpr = window.devicePixelRatio || 1;
    const caja = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(caja.width * dpr));
    canvas.height = Math.max(1, Math.round(caja.height * dpr));
  }

  function nuevoLuchador(nombre, x, dir, hp, dano, arma, color) {
    return {
      nombre, x, dir, hp, hpMax: hp, st: 100, dano, arma, color,
      accion: "idle", tipo: "rapido", t: 0, dur: 0,
      sinRegen: 0, buffer: null, retroceso: 0, destello: 0, parry: 0,
      finta: false, mantener: false, cargando: false
    };
  }

  function empezar(r) {
    rival = r;
    j = nuevoLuchador(nombreJugador, 330, 1, 100, [9, 20], 66, "#d8d2b8");
    e = nuevoLuchador(r.nombre.split(",")[0], 630, -1, r.hp, r.dano, r.arma, r.color);
    e.ia = { piensa: 1.2, estado: "libre", t: 0, plan: null, espera: 0, restante: 0 };
    est = { dano: 0, recibido: 0, paradas: 0, esquivas: 0, segundos: 0 };
    textos = [];
    temblor = 0;
    cuenta = 2.2;
    fase = "cuenta";
    menuEl.classList.add("hidden");
    finEl.classList.add("hidden");
  }

  function irAlMenu() {
    fase = "menu";
    finEl.classList.add("hidden");
    menuEl.classList.remove("hidden");
    pintarMenu();
  }

  function pintarMenu() {
    listaRivalesEl.innerHTML = RIVALES.map(r => `
      <button type="button" class="duelo-rival" data-rival="${r.id}">
        <strong>${r.nombre}</strong>
        <span>${r.descripcion}</span>
        <small>${victorias[r.id] ? `Victorias: ${victorias[r.id]}` : "Sin vencer"}</small>
      </button>`).join("");
  }

  /* --- Acciones --------------------------------------------------------- */
  function libre(f) { return f.accion === "idle" || f.accion === "block"; }

  function empezarAccion(f, accion, dur, tipo) {
    f.accion = accion; f.t = 0; f.dur = dur; if (tipo) f.tipo = tipo;
  }

  function atacar(f, tipo) {
    const cfg = f === j ? (tipo === "pesado" ? PESADO : RAPIDO) : null;
    const costo = cfg ? cfg.costo : (tipo === "pesado" ? PESADO.costo : RAPIDO.costo);
    if (f.st < costo) { if (f === j) texto("Sin aliento", f, "#e0645c"); return false; }
    f.st -= costo; f.sinRegen = 0.5;
    const aviso = f === j ? cfg.aviso : (tipo === "pesado" ? rival.aviso * 2.3 : rival.aviso);
    empezarAccion(f, "windup", aviso, tipo);
    f.finta = false;
    return true;
  }

  function bloquear(f) {
    if (f.accion === "block") return;
    empezarAccion(f, "block", 9999);
  }

  function esquivar(f) {
    if (f.st < ESQUIVA.costo) { if (f === j) texto("Sin aliento", f, "#e0645c"); return false; }
    f.st -= ESQUIVA.costo; f.sinRegen = 0.5;
    empezarAccion(f, "dodge", ESQUIVA.dur);
    return true;
  }

  function invulnerable(f) {
    return f.accion === "dodge" && f.t >= ESQUIVA.inicioInv && f.t <= ESQUIVA.finInv;
  }

  function texto(msg, f, color) {
    textos.push({ msg, x: f.x, y: SUELO - 150, t: 0, color: color || "#e8e4d0" });
  }

  function golpeFlash(f, fuerza) {
    f.destello = 0.22;
    f.retroceso = 22 * fuerza;
    temblor = Math.max(temblor, 6 * fuerza);
  }

  /* El golpe llega: depende de lo que esté haciendo el que lo recibe. */
  function resolverGolpe(a, d) {
    const antes = d.hp;
    resolverGolpeCrudo(a, d);
    const perdido = Math.max(0, antes - Math.max(0, d.hp));
    if (est) {
      if (d === e) est.dano += perdido; else est.recibido += perdido;
    }
  }

  function resolverGolpeCrudo(a, d) {
    const dano = a.dano[a.tipo === "pesado" ? 1 : 0];
    if (invulnerable(d)) { if (d === j && est) est.esquivas++; texto("¡Esquiva!", d, "#8fdcff"); a.parry = 0; return; }
    if (d.accion === "block") {
      if (d.t <= PARADA) {
        if (d === j && est) est.paradas++;
        texto("¡Parada!", d, "#ffe08a");
        d.parry = 0.3; d.st = Math.min(100, d.st + 18);
        empezarAccion(a, "stun", 0.85);
        temblor = Math.max(temblor, 4);
        return;
      }
      const costo = dano * 1.2;
      if (d.st - costo <= 0) {
        d.st = 0;
        texto("¡Guardia rota!", d, "#e0645c");
        d.hp -= dano * 0.5; golpeFlash(d, 1.3);
        empezarAccion(d, "stun", 1.0);
        return;
      }
      d.st -= costo; d.sinRegen = 0.6;
      d.hp -= dano * (a.tipo === "pesado" ? 0.4 : 0.15);
      d.parry = 0.12; golpeFlash(d, 0.5);
      texto("Bloqueado", d, "#b9b5a2");
      return;
    }
    d.hp -= dano;
    golpeFlash(d, a.tipo === "pesado" ? 1.5 : 1);
    texto(`-${Math.round(dano)}`, d, "#ff7a6b");
    if (d.accion !== "stun") empezarAccion(d, "hit", a.tipo === "pesado" ? 0.5 : 0.3);
  }

  /* --- Jugador ----------------------------------------------------------- */
  const teclas = { z: false, x: false };

  function pulsarAtaque() {
    if (fase !== "duelo") return;
    j.cargando = true;
    ordenar("rapido");
  }

  function soltarAtaque() {
    if (j) j.cargando = false;
  }

  function ordenar(tipo) {
    if (fase !== "duelo" || j.accion === "dead") return;
    if (libre(j)) {
      if (tipo === "esquiva") esquivar(j);
      else atacar(j, tipo);
    } else {
      j.buffer = { tipo, hasta: 0.25 };
    }
  }

  function guardia(arriba) {
    if (fase !== "duelo") return;
    j.mantener = arriba;
    if (arriba && libre(j)) bloquear(j);
    else if (!arriba && j.accion === "block") { j.accion = "idle"; j.t = 0; }
  }

  document.addEventListener("keydown", ev => {
    if (ev.repeat) return;
    const k = ev.key.toLowerCase();
    if (k === "z") { pulsarAtaque(); ev.preventDefault(); }
    else if (k === "x") { guardia(true); ev.preventDefault(); }
    else if (k === "c" || k === " ") { ordenar("esquiva"); ev.preventDefault(); }
  });
  document.addEventListener("keyup", ev => {
    const k = ev.key.toLowerCase();
    if (k === "z") soltarAtaque();
    else if (k === "x") guardia(false);
  });

  const botonAtacar = document.getElementById("dueloBtnAtacar");
  const botonBloquear = document.getElementById("dueloBtnBloquear");
  const botonEsquivar = document.getElementById("dueloBtnEsquivar");
  const mantenible = (el, abajo, arriba) => {
    el.addEventListener("pointerdown", ev => { ev.preventDefault(); abajo(); });
    ["pointerup", "pointerleave", "pointercancel"].forEach(n => el.addEventListener(n, arriba));
  };
  mantenible(botonAtacar, pulsarAtaque, soltarAtaque);
  mantenible(botonBloquear, () => guardia(true), () => guardia(false));
  botonEsquivar.addEventListener("pointerdown", ev => { ev.preventDefault(); ordenar("esquiva"); });

  listaRivalesEl.addEventListener("click", ev => {
    const b = ev.target.closest("[data-rival]");
    if (b) empezar(RIVALES.find(r => r.id === b.dataset.rival));
  });
  document.getElementById("dueloReintentar").addEventListener("click", () => empezar(rival));
  document.getElementById("dueloMenuBtn").addEventListener("click", irAlMenu);

  /* --- Rival (IA) -------------------------------------------------------- */
  function pensar(dt) {
    const ia = e.ia;
    const jPrepara = j.accion === "windup";

    // Reacciona al aviso de un ataque del jugador, con su tiempo de reacción, y lo enfrenta (bloquea, esquiva o lo deja pasar).
    if (ia.estado === "libre" && jPrepara && libre(e)) {
      ia.estado = "reaccionando";
      ia.t = rival.reaccion * (0.8 + Math.random() * 0.4);
      const r = Math.random();
      ia.plan = r < rival.bloqueo ? "bloquear" : (r < rival.bloqueo + rival.esquiva ? "esquivar" : "ignorar");
      ia.restante = Math.max(0, j.dur - j.t);
    } else if (ia.estado === "reaccionando") {
      ia.t -= dt; ia.restante -= dt;
      if (!jPrepara) ia.estado = "libre";
      else if (ia.t <= 0) {
        ia.estado = "ejecutando";
        const llega = Math.max(0, ia.restante);
        ia.espera = ia.plan === "esquivar" ? Math.max(0, llega - 0.1 - Math.random() * 0.08) : Math.max(0, llega - Math.random() * 0.3);
      }
    } else if (ia.estado === "ejecutando") {
      ia.espera -= dt;
      if (!jPrepara) ia.estado = "libre";
      else if (ia.espera <= 0) {
        if (libre(e)) {
          if (ia.plan === "bloquear") { bloquear(e); e.mantenerHasta = 0.55; }
          else if (ia.plan === "esquivar") esquivar(e);
        }
        ia.estado = "enfriando"; ia.t = 0.35;
      }
    } else if (ia.estado === "enfriando") {
      ia.t -= dt;
      if (ia.t <= 0 && !jPrepara) ia.estado = "libre";
    }

    if (e.accion === "block" && e.mantenerHasta !== undefined) {
      e.mantenerHasta -= dt;
      if (e.mantenerHasta <= 0) { e.accion = "idle"; e.t = 0; e.mantenerHasta = undefined; }
    }

    // Iniciativa propia: ataca, finta o espera. Castiga cuando el jugador queda expuesto.
    ia.piensa -= dt;
    if (e.accion !== "idle") return;
    const expuesto = j.accion === "recover" || j.accion === "stun" || j.accion === "hit";
    if (expuesto && ia.piensa <= 0 && Math.random() < rival.castigo) {
      atacar(e, Math.random() < 0.35 ? "pesado" : "rapido");
      ia.piensa = 0.5 + Math.random() * 0.4;
      return;
    }
    if (ia.piensa <= 0 && !jPrepara) {
      ia.piensa = (0.6 + Math.random() * 0.9) / rival.agresion;
      if (Math.random() < rival.finta) {
        if (atacar(e, "rapido")) e.finta = true;
      } else {
        atacar(e, Math.random() < 0.3 ? "pesado" : "rapido");
      }
    }
  }

  /* --- Simulación -------------------------------------------------------- */
  function actualizarLuchador(f, dt) {
    f.t += dt;
    if (f.destello > 0) f.destello -= dt;
    if (f.parry > 0) f.parry -= dt;
    f.retroceso *= Math.pow(0.0005, dt);

    if (f.accion === "windup") {
      let listo = f.t >= f.dur;
      if (f === j) {
        // Mantener el ataque lo convierte en pesado: sigue preparándose y golpea al soltar (o al llegar al máximo).
        if (f.tipo === "rapido" && f.t >= f.dur && f.cargando && f.st >= 14) { f.tipo = "pesado"; f.dur = 0.55; f.st -= 14; listo = false; }
        else if (f.tipo === "pesado") listo = f.cargando ? f.t >= f.dur : f.t >= 0.34;
      }
      if (f.finta && f.t >= f.dur * 0.65) { f.finta = false; texto("¡Finta!", f, "#ffe08a"); empezarAccion(f, "recover", 0.25); }
      else if (listo) {
        const objetivo = f === j ? e : j;
        resolverGolpe(f, objetivo);
        if (f.accion === "windup") empezarAccion(f, "recover", f.tipo === "pesado" ? PESADO.recuperar : RAPIDO.recuperar);
      }
    } else if (f.accion === "recover" || f.accion === "dodge" || f.accion === "hit" || f.accion === "stun") {
      if (f.t >= f.dur) {
        f.accion = "idle"; f.t = 0;
        if (f === j && f.mantener) bloquear(f);
      }
    }

    // Aguante: se recupera si no está haciendo esfuerzo
    f.sinRegen = Math.max(0, f.sinRegen - dt);
    if (f.sinRegen <= 0 && f.accion !== "block") f.st = Math.min(100, f.st + REGEN_ST * dt);

    // Orden guardada mientras estaba ocupado
    if (f === j && f.buffer) {
      f.buffer.hasta -= dt;
      if (f.buffer.hasta <= 0) f.buffer = null;
      else if (libre(f)) {
        const b = f.buffer; f.buffer = null;
        if (b.tipo === "esquiva") esquivar(f); else atacar(f, b.tipo);
      }
    }
  }

  function actualizar(dt) {
    if (fase === "cuenta") {
      cuenta -= dt;
      if (cuenta <= 0) { fase = "duelo"; texto("¡Duelo!", { x: 480 }, "#ffe08a"); }
    }
    if (fase === "duelo") {
      if (est) est.segundos += dt;
      pensar(dt);
      actualizarLuchador(j, dt);
      actualizarLuchador(e, dt);
      if (j.hp <= 0 || e.hp <= 0) terminar(e.hp <= 0 && j.hp > 0);
      else if (j.hp <= 0 && e.hp <= 0) terminar(false);
    } else if (fase === "fin") {
      actualizarLuchador(j, dt);
      actualizarLuchador(e, dt);
    }
    temblor *= Math.pow(0.003, dt);
    textos.forEach(t => { t.t += dt; t.y -= 40 * dt; });
    textos = textos.filter(t => t.t < 1.1);
  }

  /* Manda la partida al ranking (solo con sesión iniciada). */
  async function anotarPartida(gano) {
    if (!est || !window.MjStats) return;
    const r = est;
    const suma = {
      dano: Math.round(r.dano), recibido: Math.round(r.recibido),
      paradas: r.paradas, esquivas: r.esquivas, segundos: Math.round(r.segundos)
    };
    const max = {}, min = {};
    if (gano) {
      max.vida = Math.max(1, Math.round(j.hp));
      min.segundos = Math.max(1, Math.round(r.segundos));
    }
    const res = await MjStats.registrar("duelo", rival.id, gano ? "gana" : "pierde", { suma, max, min });
    if (res.guardado) cargarRanking();
  }

  /* --- Ranking ----------------------------------------------------------- */
  const rankingEl = document.getElementById("dueloRankings");
  const segundosTxt = n => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, "0")}`;
  const venceA = id => u => (u.porClave[id] ? u.porClave[id].victorias : 0);

  function cargarRanking() {
    if (!rankingEl || !window.MjStats) return;
    MjStats.cargarYPintar("duelo", rankingEl, [
      { titulo: "Más victorias", valor: u => u.victorias },
      { titulo: "Victorias contra Adam Kovacs", valor: venceA("adam") },
      { titulo: "Victoria más rápida", valor: u => u.minimo.segundos, menorEsMejor: true, formato: segundosTxt },
      { titulo: "Más paradas", valor: u => u.suma.paradas },
      { titulo: "Más esquivas", valor: u => u.suma.esquivas },
      { titulo: "Más daño infligido", valor: u => u.suma.dano }
    ]);
  }

  if (window.MjStats) MjStats.cargarSesion().then(cargarRanking);

  function terminar(gano) {
    fase = "fin";
    j.accion = gano ? j.accion : "dead";
    e.accion = gano ? "dead" : e.accion;
    j.cargando = false;
    if (gano) {
      victorias[rival.id] = (victorias[rival.id] || 0) + 1;
      try { localStorage.setItem(CLAVE_VICTORIAS, JSON.stringify(victorias)); } catch (err) { /* sin almacenamiento */ }
    }
    anotarPartida(gano);
    setTimeout(() => {
      finTituloEl.textContent = gano ? "Victoria" : "Derrota";
      finTextoEl.textContent = gano ? `Venciste a ${rival.nombre}.` : `${rival.nombre} te venció.`;
      finEl.classList.remove("hidden");
    }, 900);
  }

  /* --- Dibujo ------------------------------------------------------------ */
  function dibujarLuchador(f) {
    const tiemblaX = f.accion === "hit" ? Math.sin(f.t * 60) * 3 : 0;
    ctx.save();
    ctx.translate(f.x + tiemblaX - f.dir * f.retroceso, SUELO);
    ctx.scale(f.dir, 1);

    let alpha = 1, inclinacion = 0, agachar = 0;
    if (f.accion === "dodge") { alpha = invulnerable(f) ? 0.35 : 0.7; inclinacion = -0.35; agachar = 14; }
    if (f.accion === "dead") { inclinacion = -1.4; }
    if (f.accion === "stun") { inclinacion = 0.12; }
    ctx.globalAlpha = alpha;
    ctx.rotate(inclinacion);

    const color = f.destello > 0 ? "#ff6b5a" : f.color;
    // aura de aviso del rival al preparar un ataque
    if (f.accion === "windup") {
      const p = Math.min(1, f.t / f.dur);
      ctx.fillStyle = f.tipo === "pesado" ? `rgba(255, 140, 90, ${0.18 + 0.35 * p})` : `rgba(255, 224, 138, ${0.12 + 0.3 * p})`;
      ctx.beginPath(); ctx.arc(0, -70, 70 + 10 * p, 0, Math.PI * 2); ctx.fill();
    }
    // piernas, torso, cabeza
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 9; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-8, -48 + agachar / 2); ctx.lineTo(-14, 0); ctx.moveTo(8, -48 + agachar / 2); ctx.lineTo(16, 0); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-18, -118 + agachar, 36, 74 - agachar / 2, 10); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -138 + agachar, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1d1e20"; ctx.fillRect(8, -142 + agachar, 9, 5);

    // arma: el ángulo depende de la fase
    let ang = 0.7; // reposo, hacia abajo-adelante
    const levantado = -2.0;
    if (f.accion === "windup") ang = 0.7 + (levantado - 0.7) * Math.min(1, f.t / f.dur);
    else if (f.accion === "recover") ang = f.t < 0.12 ? levantado + (1.3 - levantado) * (f.t / 0.12) : 1.3 + (0.7 - 1.3) * Math.min(1, (f.t - 0.12) / (f.dur - 0.12 + 0.001));
    else if (f.accion === "stun") ang = 1.6;
    if (f.accion === "recover" && f.t < 0.12 && f.tipo) {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(14, -108 + agachar, f.arma + 4, levantado, ang, false); ctx.stroke();
    }
    ctx.strokeStyle = "#cfd3d6"; ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(14, -108 + agachar);
    ctx.lineTo(14 + Math.cos(ang) * f.arma, -108 + agachar + Math.sin(ang) * f.arma);
    ctx.stroke();

    // escudo al bloquear
    if (f.accion === "block") {
      ctx.strokeStyle = f.t <= PARADA ? "#ffe08a" : "#8fdcff"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.arc(22, -88, 54, -1.0, 1.0); ctx.stroke();
    }
    if (f.parry > 0) {
      ctx.fillStyle = `rgba(255, 224, 138, ${f.parry * 2.2})`;
      ctx.beginPath(); ctx.arc(40, -88, 34, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function barra(x, y, w, valor, max, color, alinearDerecha) {
    ctx.fillStyle = "rgba(255,255,255,.1)"; ctx.fillRect(x, y, w, 16);
    const p = Math.max(0, valor / max);
    ctx.fillStyle = color;
    if (alinearDerecha) ctx.fillRect(x + w * (1 - p), y, w * p, 16); else ctx.fillRect(x, y, w * p, 16);
  }

  function dibujar() {
    const dpr = canvas.width / LOGICO_ANCHO;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, LOGICO_ANCHO, LOGICO_ALTO);
    ctx.save();
    if (temblor > 0.3) ctx.translate((Math.random() - 0.5) * temblor, (Math.random() - 0.5) * temblor);

    // fondo: suelo y un resplandor tenue
    const g = ctx.createLinearGradient(0, 0, 0, LOGICO_ALTO);
    g.addColorStop(0, "rgba(255,255,255,.02)"); g.addColorStop(1, "rgba(255,255,255,.07)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, LOGICO_ANCHO, LOGICO_ALTO);
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(0, SUELO, LOGICO_ANCHO, 3);

    if (j && e) {
      dibujarLuchador(j);
      dibujarLuchador(e);

      // HUD
      ctx.font = "600 16px sans-serif"; ctx.textAlign = "left"; ctx.fillStyle = "#e8e4d0";
      ctx.fillText(j.nombre, 30, 30);
      barra(30, 38, 340, j.hp, j.hpMax, "#7fc45a", false);
      barra(30, 58, 340, j.st, 100, "#8fdcff", false);
      ctx.textAlign = "right"; ctx.fillText(e.nombre, 930, 30);
      barra(590, 38, 340, e.hp, e.hpMax, "#d8574a", true);
      barra(590, 58, 340, e.st, 100, "#e0b45c", true);

      textos.forEach(t => {
        ctx.globalAlpha = Math.max(0, 1 - t.t / 1.1);
        ctx.fillStyle = t.color; ctx.textAlign = "center"; ctx.font = "700 22px sans-serif";
        ctx.fillText(t.msg, t.x, t.y);
      });
      ctx.globalAlpha = 1;

      if (fase === "cuenta") {
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 0, LOGICO_ANCHO, LOGICO_ALTO);
        ctx.fillStyle = "#e8e4d0"; ctx.textAlign = "center"; ctx.font = "700 72px sans-serif";
        ctx.fillText(cuenta > 1.4 ? "Prepárate" : (cuenta > 0.7 ? "Listo" : "¡Ya!"), 480, 280);
      }
    }
    ctx.restore();
  }

  function cuadro(t) {
    const dt = Math.min(0.05, (t - ultimo) / 1000 || 0);
    ultimo = t;
    if (fase !== "menu") actualizar(dt);
    dibujar();
    requestAnimationFrame(cuadro);
  }

  window.addEventListener("resize", ajustarTamano);
  ajustarTamano();
  pintarMenu();
  requestAnimationFrame(cuadro);
})();
