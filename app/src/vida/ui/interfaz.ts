/* La interfaz del laboratorio: la ficha de la criatura (como esta, no una hoja de numeros), su memoria legible, la bandeja de objetos
   y los controles de tiempo y camara. Con "Observar" todo se esconde y solo queda mirar. */

import type { Criatura } from "../nucleo/criatura.ts";
import { CATALOGO } from "../nucleo/catalogo.ts";
import { AJ } from "../nucleo/ajustes.ts";
import { DIA, E, N, RASGOS } from "../nucleo/tipos.ts";
import { sonido } from "../audio/audio.ts";
import { icono, crearObjetos } from "../arte/objetos.ts";
import { pintarRetrato } from "../arte/criatura.ts";
import type { Laboratorio } from "../escenas/Laboratorio.ts";
import { Juego } from "../juego.ts";
import { aviso, boton, h } from "./base.ts";

const BANDEJA: { tipo: string; nombre: string; ayuda: string }[] = [
  { tipo: "fruta", nombre: "Fruta", ayuda: "Fruta azul|Quita el hambre. Huele bien." },
  { tipo: "baya", nombre: "Baya", ayuda: "Baya roja|Sienta mal, pero algo alimenta. Solo se la come quien no tiene otra cosa." },
  { tipo: "pelota", nombre: "Pelota", ayuda: "Pelota|Rueda y rebota cuando se empuja." },
  { tipo: "bola_fija", nombre: "Bola fija", ayuda: "Bola atornillada|Se ve igual que la pelota pero no se mueve." },
  { tipo: "palanca", nombre: "Palanca", ayuda: "Palanca|Al tocarla suelta un gránulo de comida poco después." },
  { tipo: "palanca_rota", nombre: "Palanca rota", ayuda: "Palanca rota|Se mueve y suena, pero no suelta nada." },
  { tipo: "placa", nombre: "Placa", ayuda: "Placa roja|Da descargas a quien se pone encima." },
  { tipo: "reja", nombre: "Reja", ayuda: "Reja|Cierra el paso. Se rompe a empujones, y quien tiene hambre y ve comida al otro lado puede acabar probándolo." },
  { tipo: "muro", nombre: "Muro", ayuda: "Muro|Cierra el paso y no se rompe." },
  { tipo: "foco_rojo", nombre: "Foco rojo", ayuda: "Foco rojo|Da una descarga al tocarlo." },
  { tipo: "foco_rojo_b", nombre: "Foco rojo 2", ayuda: "Foco rojo grande|Parecido al rojo, pero no hace nada." },
  { tipo: "foco_azul", nombre: "Foco azul", ayuda: "Foco azul|No hace nada." },
];

const NECESIDADES: { i: number; nombre: string }[] = [
  { i: N.hambre, nombre: "Hambre" },
  { i: N.sueno, nombre: "Sueño" },
  { i: N.aburrimiento, nombre: "Aburrimiento" },
  { i: N.soledad, nombre: "Compañía" },
  { i: N.dolor, nombre: "Dolor" },
];

const EMOCIONES: { i: number; nombre: string }[] = [
  { i: E.miedo, nombre: "Miedo" },
  { i: E.curiosidad, nombre: "Curiosidad" },
  { i: E.frustracion, nombre: "Frustración" },
  { i: E.apego, nombre: "Apego" },
  { i: E.excitacion, nombre: "Alegría" },
];

const NOMBRE_RASGO = ["Curiosidad", "Sociabilidad", "Agresividad", "Miedo", "Apego", "Persistencia", "Territorialidad", "Sensibilidad"];

const VERBO_LARGO: Record<string, string> = { probar: "Probar", empujar: "Empujar", tocar: "Tocar", acercarse: "Acercarse a", evitar: "Alejarse de", explorar: "Explorar", descansar: "Descansar", dormir: "Dormir" };

export class Interfaz {
  raiz: HTMLElement;
  juego: Juego;
  escena: Laboratorio;
  private ficha!: HTMLElement;
  private retrato!: HTMLCanvasElement;
  private nombre!: HTMLElement;
  private edad!: HTMLElement;
  private estado!: HTMLElement;
  private filasNec = new Map<number, HTMLElement>();
  private tags!: HTMLElement;
  private radar!: HTMLCanvasElement;
  private selector!: HTMLElement;
  private reloj!: HTMLElement;
  private relojLuna!: HTMLElement;
  private memoria!: HTMLElement;
  private cabSecuelas!: HTMLElement;
  private secuelasEl!: HTMLElement;
  private panelMem!: HTMLElement;
  private pestana = "historia";
  private bandeja!: HTMLElement;
  private pie!: HTMLElement;
  private subtitulo!: HTMLElement;
  private velocidades = new Map<number, HTMLButtonElement>();
  private camaras = new Map<string, HTMLButtonElement>();
  private btnObservar!: HTMLButtonElement;
  private btnSonido!: HTMLButtonElement;
  private clavesMem = "";
  private objetos = crearObjetos();
  private temporizador = 0;
  /** El mapa del complejo (solo si hay mas de una sala) y sus cajas por sala. */
  private mapaEl: HTMLElement | null = null;
  private mapaCajas = new Map<number, { caja: HTMLElement; puntos: HTMLElement; cuenta: HTMLElement }>();
  private mapaTitulo: HTMLElement | null = null;
  private tick = 0;

  constructor(raiz: HTMLElement, juego: Juego, escena: Laboratorio) {
    this.raiz = raiz;
    this.juego = juego;
    this.escena = escena;
  }

  montar(): void {
    const j = this.juego;
    this.raiz.replaceChildren();
    this.raiz.classList.toggle("observando", j.observar);

    /* --- Barra superior --- */
    this.reloj = h("span", { clase: "va-reloj-texto" });
    this.relojLuna = h("i", { clase: "va-reloj-astro" });
    const seg = (items: { v: string; txt: string; tip: string }[], alElegir: (v: string) => void, mapa: Map<string, HTMLButtonElement>): HTMLElement => {
      const g = h("div", { clase: "va-seg" });
      for (const it of items) {
        const b = boton(it.txt, () => alElegir(it.v), { clase: "va-seg-b", tip: it.tip, silencioso: false });
        mapa.set(it.v, b);
        g.append(b);
      }
      return g;
    };
    const mapaVel = new Map<string, HTMLButtonElement>();
    const velocidades = seg(
      [{ v: "0", txt: "II", tip: "Pausa|Detiene el tiempo. Barra espaciadora." }, { v: "1", txt: "1×", tip: "Tiempo real" }, { v: "4", txt: "4×", tip: "Cuatro veces más rápido" }, { v: "16", txt: "16×", tip: "Dieciséis veces más rápido" }],
      (v) => this.velocidad(Number(v)),
      mapaVel,
    );
    mapaVel.forEach((b, k) => this.velocidades.set(Number(k), b));
    const camaras = seg(
      [{ v: "panorama", txt: "Sala", tip: "Toda la sala|Se ve la habitación entera." }, { v: "seguir", txt: "Seguir", tip: "Seguir a la criatura|La cámara acompaña a la criatura elegida." }, { v: "cercano", txt: "Cerca", tip: "Plano cercano" }],
      (v) => this.juego.fijarCamara(v as "panorama" | "seguir" | "cercano"),
      this.camaras,
    );
    this.btnObservar = boton("Observar", () => this.alternarObservar(), { clase: "va-btn-lleno", tip: "Observar sin intervenir|Esconde los paneles y sigue a la criatura. Tecla D." });
    this.btnSonido = boton("Sonido", () => this.juego.alternarSilencio(), { clase: "va-btn-ico", tip: "Sonido|Activa o silencia el audio. Tecla G." });
    const btnPantalla = boton("Pantalla", () => void this.pantallaCompleta(), { clase: "va-btn-ico", tip: "Pantalla completa|Tecla F." });
    const btnSalir = boton("Salir", () => { sonido.atras(); window.location.href = "../../minijuegos.html"; }, { clase: "va-btn-ico", tip: "Volver a los minijuegos", silencioso: true });
    const barra = h("header", { clase: "va-barra" },
      h("div", { clase: "va-barra-izq" }, btnSalir, h("div", { clase: "va-logo" }, "VIDA", h("b", {}, "·"), "ARTIFICIAL")),
      h("div", { clase: "va-reloj" }, this.relojLuna, this.reloj),
      h("div", { clase: "va-barra-der" }, velocidades, camaras, this.btnObservar, this.btnSonido, btnPantalla),
    );

    /* --- Ficha de la criatura --- */
    this.selector = h("div", { clase: "va-selector" });
    this.retrato = h("canvas", { clase: "va-retrato", width: 184, height: 184 });
    this.nombre = h("h2", { clase: "va-nombre" });
    this.edad = h("p", { clase: "va-edad" });
    this.estado = h("p", { clase: "va-estado" });
    this.cabSecuelas = h("h3", { clase: "va-sec", "data-tip": "Secuelas|Lo que dejaron los golpes graves o repetidos. No se cura: limita lo que puede hacer y se ve en su cuerpo." }, "Secuelas");
    this.secuelasEl = h("div", { clase: "va-secuelas" });
    this.cabSecuelas.hidden = true;
    this.secuelasEl.hidden = true;
    const nec = h("div", { clase: "va-nec" });
    for (const n of NECESIDADES) {
      const barra_ = h("i");
      const fila = h("div", { clase: "va-nec-fila" }, h("span", {}, n.nombre), h("div", { clase: "va-cap" }, barra_));
      this.filasNec.set(n.i, fila);
      nec.append(fila);
    }
    this.tags = h("div", { clase: "va-tags" });
    this.radar = h("canvas", { clase: "va-radar", width: 440, height: 380 });
    const acciones = h("div", { clase: "va-acciones" },
      boton("Premiar", () => this.premiar(), { clase: "va-btn-lleno", tip: "Premiar|Una caricia: lo último que hizo se le vuelve más agradable. Tecla A." }),
      boton("Criar", () => { const e = this.juego.criar(); if (e) aviso(this.raiz, e, 2400); }, { clase: "va-btn-ico", tip: "Criar|Con la criatura elegida y la más cercana nace una cría. Hereda predisposiciones mezcladas de las dos, con alguna mutación pequeña, y empieza sin recuerdos." }),
      boton("Asustar", () => this.asustar(), { clase: "va-btn-alerta", tip: "Asustar|Un susto: lo último que hizo se le vuelve más desagradable. Tecla S." }),
    );
    this.ficha = h("aside", { clase: "va-panel va-ficha" },
      this.selector,
      h("div", { clase: "va-cab" }, this.retrato, h("div", {}, this.nombre, this.edad)),
      this.estado,
      this.cabSecuelas,
      this.secuelasEl,
      h("h3", { clase: "va-sec" }, "Necesidades"),
      nec,
      h("h3", { clase: "va-sec" }, "Cómo se siente"),
      this.tags,
      h("h3", { clase: "va-sec", "data-tip": "Personalidad|La línea clara es con lo que nació. El relleno es cómo es ahora, tras lo que ha vivido." }, "Carácter"),
      this.radar,
      acciones,
    );

    /* --- Memoria --- */
    const pestanas = h("div", { clase: "va-pestanas" });
    for (const [id, txt] of [["historia", "Historia"], ["sabe", "Lo que sabe"], ["conducta", "Conducta"], ["linaje", "Linaje"], ["legado", "Legado"]] as const) {
      const b = boton(txt, () => { this.pestana = id; this.clavesMem = ""; pestanas.querySelectorAll("button").forEach((q) => q.classList.toggle("activa", q === b)); this.refrescarMemoria(true); }, { clase: id === "historia" ? "va-pest activa" : "va-pest" });
      pestanas.append(b);
    }
    this.memoria = h("div", { clase: "va-mem" });
    this.panelMem = h("aside", { clase: "va-panel va-memoria" }, h("h3", { clase: "va-sec grande" }, "Memoria"), pestanas, this.memoria);

    /* --- Bandeja --- */
    this.bandeja = h("footer", { clase: "va-bandeja" });
    this.subtitulo = h("p", { clase: "va-sub" });
    for (const it of BANDEJA) this.bandeja.append(this.celdaBandeja(it));
    const ayuda = h("p", { clase: "va-bandeja-ayuda" }, "Arrastra un objeto a la sala. Para quitarlo, ponle el ratón encima y pulsa X, o arrástralo de vuelta aquí abajo.");
    const pie = h("div", { clase: "va-pie" }, ayuda, this.bandeja);
    // La bandeja tambien se pliega: la lengueta va dentro y se queda a la vista cuando el resto baja
    const lenguetaPie = boton("Objetos", () => { const p_ = pie.classList.toggle("plegada"); lenguetaPie.classList.toggle("activa", !p_); this.ajustarMargen(); }, { clase: "va-lengueta-pie activa", tip: "Mostrar u ocultar la lista de objetos" });
    const toggleComedero = boton("", () => { j.alternarComedero(); }, { clase: "va-toggle", tip: "Comedero automático|Deja caer fruta de vez en cuando. Apágalo para que solo coma lo que tú pongas. Con mucha hambre y sin otra cosa, se comerá hasta las bayas." });
    const pintarToggle = (): void => {
      const on = j.comederoActivo;
      toggleComedero.replaceChildren(h("i", { clase: "va-interruptor" }), `Comedero automático: ${on ? "sí" : "no"}`);
      toggleComedero.setAttribute("aria-pressed", on ? "true" : "false");
      toggleComedero.classList.toggle("activa", on);
    };
    pintarToggle();
    j.on("comedero", pintarToggle);
    const toggleMort = boton("", () => { j.alternarMortalidad(); }, { clase: "va-toggle", tip: "Mortalidad|Protegida: nunca muere. Recuperable: si se agota cae al suelo y una caricia (A) la reanima antes de 4 minutos. Permanente: muere y queda su legado." });
    const pintarMort = (): void => {
      toggleMort.replaceChildren(`Mortalidad: ${j.sim.mortalidad}`);
      toggleMort.classList.toggle("alerta", j.sim.mortalidad === "permanente");
    };
    pintarMort();
    j.on("mortalidad", pintarMort);
    const toggleSec = boton("", () => { j.alternarSecuelas(); }, { clase: "va-toggle", tip: "Secuelas|Si está activa, los golpes graves o repetidos dejan marcas que no se curan: cojera, menos fuerza, peor vista u oído. Se ven en el dibujo y en la ficha." });
    const pintarSec = (): void => {
      toggleSec.replaceChildren(`Secuelas: ${j.sim.secuelas ? "sí" : "no"}`);
      toggleSec.classList.toggle("alerta", j.sim.secuelas);
    };
    pintarSec();
    j.on("secuelas", pintarSec);
    j.on("simNueva", pintarSec);
    const toggleExt = boton("", () => { j.alternarExtincion(); }, { clase: "va-toggle", tip: "Superar miedos|Si está activa, el miedo aprendido a alguien baja poco a poco cuando lo tiene cerca y no le pasa nada malo, más deprisa con compañía. Permite rehabilitar a una criatura maltratada." });
    const pintarExt = (): void => {
      toggleExt.replaceChildren(`Superar miedos: ${j.sim.extincion ? "sí" : "no"}`);
      toggleExt.classList.toggle("activa", j.sim.extincion);
    };
    pintarExt();
    j.on("extincion", pintarExt);
    j.on("simNueva", pintarExt);
    j.on("nacimiento", (id) => { aviso(this.raiz, `Ha nacido ${this.juego.sim.criatura(id as number)?.nombre ?? "una cría"}.`, 2200); this.clavesMem = ""; });
    const botonRaza = (rutina: "hostil" | "amistosa", texto: string, tip: string): HTMLElement => boton(texto, () => { const e = j.agregarRazaSimple(rutina); if (e) aviso(this.raiz, e, 2400); }, { clase: "va-toggle", tip });
    const hostil = botonRaza("hostil", "+ Hostil", "Raza simple hostil|Añade una criatura de regla fija que pega sin parar a la que tenga más cerca. No aprende ni cambia. Sirve de agresora para probar secuelas y rehabilitación.");
    const amistosa = botonRaza("amistosa", "+ Amistosa", "Raza simple amistosa|Añade una criatura de regla fija que se acerca a la más cercana y se queda a su lado. No aprende ni cambia. Sirve de cuidadora o de compañía.");
    const toggleTrans = boton("", () => { j.alternarTransporte(); }, { clase: "va-toggle", tip: "Transporte|Si está activo, las criaturas pueden recoger lo que se mueve y llevarlo a cuestas (más despacio cuanto más pesa) y soltarlo. Nadie les dice para qué sirve." });
    const pintarTrans = (): void => {
      toggleTrans.replaceChildren(`Transporte: ${j.sim.transporte ? "sí" : "no"}`);
      toggleTrans.classList.toggle("activa", j.sim.transporte);
    };
    pintarTrans();
    j.on("transporte", pintarTrans);
    j.on("simNueva", pintarTrans);
    const toggleBloq = boton("", () => { j.alternarBloqueos(); }, { clase: "va-toggle", tip: "Aprender de los choques|Si está activo, cuando una barrera le corta el paso hacia algo, la criatura recuerda que ahí, con eso, no se consigue nada, y deja de insistir. Apagado, solo se frustra un poco y lo vuelve a intentar." });
    const pintarBloq = (): void => {
      toggleBloq.replaceChildren(`Aprender de choques: ${j.sim.aprendeBloqueos ? "sí" : "no"}`);
      toggleBloq.classList.toggle("activa", j.sim.aprendeBloqueos);
    };
    pintarBloq();
    j.on("bloqueos", pintarBloq);
    j.on("simNueva", pintarBloq);
    const cab = h("div", { clase: "va-pie-cab" }, lenguetaPie, toggleComedero, toggleMort, toggleSec, toggleExt, toggleTrans, toggleBloq, hostil, amistosa);
    pie.prepend(cab);
    this.pie = pie;

    // Lenguetas para plegar cada panel y dejar la sala despejada (en pantallas pequenas la memoria empieza plegada)
    const lengueta = (clase: string, texto: string, panel: HTMLElement, plegada: boolean): HTMLButtonElement => {
      panel.classList.toggle("plegada", plegada);
      const b = boton(texto, () => { const p_ = panel.classList.toggle("plegada"); b.classList.toggle("activa", !p_); }, { clase: `va-lengueta ${clase}`, tip: "Mostrar u ocultar este panel" });
      b.classList.toggle("activa", !plegada);
      return b;
    };
    const pequena = window.innerWidth < 1500;
    this.mapaEl = this.montarMapa();
    if (this.mapaEl) this.raiz.append(this.mapaEl);
    this.raiz.append(barra, this.ficha, this.panelMem, lengueta("izq", "Ficha", this.ficha, false), lengueta("der", "Memoria", this.panelMem, pequena), pie, this.subtitulo);

    // Teclas
    this.teclas = this.teclas.bind(this);
    window.addEventListener("keydown", this.teclas);

    j.on("seleccion", () => { this.clavesMem = ""; this.refrescar(); });
    j.on("camara", () => this.refrescarControles());
    j.on("velocidad", () => this.refrescarControles());
    j.on("observar", () => { this.raiz.classList.toggle("observando", j.observar); this.refrescarControles(); });
    j.on("sonido", () => this.refrescarControles());
    j.on("quitadoConArrastre", () => aviso(this.raiz, "Objeto quitado.", 1000));
    j.on("colocado", () => this.bandeja.querySelectorAll(".activa").forEach((q) => q.classList.remove("activa")));
    this.refrescarControles();
    this.refrescar();
    this.temporizador = window.setInterval(() => this.refrescar(), 250);
  }

  /** El mapa del complejo: las salas como cajas con sus conexiones y un punto por criatura. Una caja lleva a esa sala, un punto elige a esa criatura. */
  private montarMapa(): HTMLElement | null {
    const j = this.juego;
    const salas = j.sim.salas;
    this.mapaCajas.clear();
    if (salas.length < 2) return null;
    const W = 112, H = 50, G = 14;
    const col = (c: number): number => c * (W + G);
    const caja = (s: (typeof salas)[number]): { x: number; y: number; w: number } => ({ x: col(s.mapa?.c ?? 0), y: (s.mapa?.f ?? 0) * (H + G), w: (s.mapa?.w ?? 1) * W + ((s.mapa?.w ?? 1) - 1) * G });
    const cols = Math.max(...salas.map((s) => (s.mapa?.c ?? 0) + (s.mapa?.w ?? 1)));
    const filas = Math.max(...salas.map((s) => (s.mapa?.f ?? 0) + 1));
    const ancho = cols * W + (cols - 1) * G, alto = filas * H + (filas - 1) * G;
    const lienzo = h("div", { clase: "va-mapa-lienzo", style: `width:${ancho}px;height:${alto}px` });
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", String(ancho)); svg.setAttribute("height", String(alto)); svg.setAttribute("class", "va-mapa-lineas");
    const hechas = new Set<string>();
    for (const s of salas) for (const o of s.mundo.objetos) {
      if (o.tipo !== "puerta" || !o.destino) continue;
      const clave = [s.id, o.destino.sala].sort().join("-");
      if (hechas.has(clave)) continue;
      hechas.add(clave);
      const a = caja(s), b = caja(salas[o.destino.sala]);
      const l = document.createElementNS(ns, "line");
      l.setAttribute("x1", String(a.x + a.w / 2)); l.setAttribute("y1", String(a.y + H / 2)); l.setAttribute("x2", String(b.x + b.w / 2)); l.setAttribute("y2", String(b.y + H / 2));
      svg.append(l);
    }
    lienzo.append(svg);
    for (const s of salas) {
      const p = caja(s);
      const puntos = h("span", { clase: "va-sala-puntos" });
      const cuenta = h("em", {});
      const b = h("button", { type: "button", clase: `va-sala t-${s.tipo}`, style: `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${H}px`, "data-tip": `${s.nombre}|Ir a esta sala.` }, h("b", {}, s.nombre), puntos, cuenta);
      b.addEventListener("click", (e) => { if ((e.target as HTMLElement).closest(".va-sala-punto")) return; sonido.clic(); j.verSala(s.id); this.refrescar(); });
      this.mapaCajas.set(s.id, { caja: b, puntos, cuenta });
      lienzo.append(b);
    }
    this.mapaTitulo = h("h3", { clase: "va-sec" }, "Complejo");
    return h("aside", { clase: "va-mapa" }, this.mapaTitulo, lienzo);
  }

  private refrescarMapa(): void {
    if (!this.mapaEl) return;
    const j = this.juego;
    for (const s of j.sim.salas) {
      const m = this.mapaCajas.get(s.id);
      if (!m) continue;
      m.caja.classList.toggle("activa", s.id === j.salaVista);
      const aqui = j.sim.criaturas.filter((c) => c.sala === s.id && c.vivo);
      m.cuenta.textContent = `${aqui.length}/${s.capacidad ?? AJ.maxCriaturasSala}`;
      const clave = aqui.map((c) => `${c.id}${c.id === j.seleccion ? "*" : ""}`).join(",");
      if (m.puntos.dataset.clave !== clave) {
        m.puntos.dataset.clave = clave;
        m.puntos.replaceChildren(...aqui.map((c) => {
          const p = h("i", { clase: `va-sala-punto${c.id === j.seleccion ? " sel" : ""}`, style: `background:hsl(${Math.round(c.huella * 360)},68%,58%)`, "data-tip": `${c.nombre}|Elegir a esta criatura.` });
          p.addEventListener("click", () => { sonido.clic(); j.seleccionar(c.id); this.refrescar(); });
          return p;
        }));
      }
    }
    if (this.mapaTitulo) this.mapaTitulo.textContent = `Complejo · ${j.salaActual.nombre}`;
  }

  desmontar(): void {
    window.clearInterval(this.temporizador);
    window.removeEventListener("keydown", this.teclas);
  }

  /* ---------- Bandeja ---------- */
  private celdaBandeja(it: (typeof BANDEJA)[number]): HTMLElement {
    const cv = icono(it.tipo, this.objetos, 84);
    cv.className = "va-ico";
    const celda = h("button", { type: "button", clase: "va-celda", "data-tip": it.ayuda }, cv, h("span", {}, it.nombre));
    let inicio: { x: number; y: number } | null = null;
    let arrastrando = false;
    celda.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      inicio = { x: e.clientX, y: e.clientY };
      arrastrando = false;
      celda.setPointerCapture(e.pointerId);
      sonido.clic();
    });
    celda.addEventListener("pointermove", (e) => {
      if (!inicio) return;
      if (!arrastrando && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > 8) { arrastrando = true; this.escena.arrastrarNuevo(it.tipo); celda.classList.add("arrastrando"); }
      if (arrastrando) this.escena.moverFantasma(e.clientX, e.clientY);
    });
    celda.addEventListener("pointerup", (e) => {
      if (!inicio) return;
      inicio = null;
      celda.classList.remove("arrastrando");
      if (arrastrando) {
        const dentro = e.clientY < window.innerHeight - 130 && e.clientY > 70;
        const ok = this.escena.soltarFantasma(e.clientX, e.clientY, dentro);
        if (!ok && !dentro) aviso(this.raiz, "Suelta el objeto dentro de la sala.", 1400);
      } else {
        // Un clic: se queda elegido y se coloca con el siguiente clic en la sala
        const ya = celda.classList.contains("activa");
        this.bandeja.querySelectorAll(".activa").forEach((q) => q.classList.remove("activa"));
        this.escena.colocando = ya ? null : it.tipo;
        if (!ya) { celda.classList.add("activa"); aviso(this.raiz, `Pulsa en la sala para soltar: ${CATALOGO[it.tipo]?.nombre ?? it.nombre}.`, 1800); }
      }
    });
    return celda;
  }

  /* ---------- Acciones ---------- */
  private velocidad(v: number): void {
    this.juego.fijarVelocidad(v);
  }

  private premiar(): void {
    this.juego.premiar();
    aviso(this.raiz, `${this.juego.criatura.nombre} recibe una caricia.`, 1500);
  }

  private asustar(): void {
    this.juego.asustar();
    aviso(this.raiz, `${this.juego.criatura.nombre} se asusta.`, 1500);
  }

  private alternarObservar(): void {
    sonido.clic();
    this.juego.alternarObservar();
  }

  private async pantallaCompleta(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch { aviso(this.raiz, "Tu navegador no deja usar la pantalla completa aquí."); }
  }

  private teclas(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const j = this.juego;
    const k = e.key.toLowerCase();
    if (k === " ") { e.preventDefault(); this.velocidad(j.pausado ? 1 : 0); }
    else if (k === "1") this.velocidad(1);
    else if (k === "2") this.velocidad(4);
    else if (k === "3") this.velocidad(16);
    else if (k === "d") this.alternarObservar();
    else if (k === "g") j.alternarSilencio();
    else if (k === "f") void this.pantallaCompleta();
    else if (k === "c") j.fijarCamara(j.ajustes.camara === "panorama" ? "seguir" : j.ajustes.camara === "seguir" ? "cercano" : "panorama");
    else if (k === "x" || k === "delete") {
      if (this.escena.quitarBajoRaton()) aviso(this.raiz, "Objeto quitado.", 1000);
      else aviso(this.raiz, "Pon el ratón sobre un objeto y pulsa X para quitarlo.", 1800);
    }
    else if (k === "e") j.siguiente();
    else if (k === "q") j.anterior();
    else if (k === "tab") { e.preventDefault(); if (e.shiftKey) j.anterior(); else j.siguiente(); }
    else if (k === "a") this.premiar();
    else if (k === "s") this.asustar();
    else if (k === "escape") { this.escena.colocando = null; this.bandeja.querySelectorAll(".activa").forEach((q) => q.classList.remove("activa")); if (j.observar) j.alternarObservar(); }
  }

  private refrescarControles(): void {
    const j = this.juego;
    const vel = j.pausado ? 0 : j.ajustes.velocidad;
    this.velocidades.forEach((b, v) => b.classList.toggle("activa", v === vel));
    this.camaras.forEach((b, v) => b.classList.toggle("activa", v === j.ajustes.camara));
    this.btnObservar.classList.toggle("activa", j.observar);
    this.btnSonido.classList.toggle("apagado", j.ajustes.silencio);
    this.btnSonido.textContent = j.ajustes.silencio ? "Sin sonido" : "Sonido";
  }

  /** Cuanto tapa la bandeja por abajo, para que la camara deje el suelo libre. */
  private ajustarMargen(): void {
    const j = this.juego;
    const abierta = !this.pie.classList.contains("plegada") && !j.observar;
    j.margenInferior = abierta ? this.pie.offsetHeight + 14 : j.observar ? 64 : 44;
  }

  /* ---------- Lo que se ve ---------- */
  refrescar(): void {
    this.ajustarMargen();
    const j = this.juego;
    const c = j.criatura;
    const rel = Juego.reloj(j.sim.t);
    this.reloj.textContent = `Día ${rel.dia} · ${rel.hora}`;
    const hora = rel.fraccion * 24;
    this.relojLuna.classList.toggle("noche", hora >= 20 || hora < 6);
    this.tick++;
    this.refrescarMapa();

    // Selector de criatura
    if (this.selector.childElementCount !== j.sim.criaturas.length) {
      this.selector.replaceChildren(...j.sim.criaturas.map((q) => {
        const b = boton(h("span", {}, h("i", { clase: "va-punto", style: `background:hsl(${Math.round(q.huella * 360)},68%,58%)` }), q.nombre), () => j.seleccionar(q.id), { clase: "va-chip", silencioso: true, tip: "Ver a esta criatura|Q y E (o Tab) cambian de criatura." });
        b.dataset.id = String(q.id);
        return b;
      }));
    }
    this.selector.querySelectorAll<HTMLElement>("button").forEach((b) => b.classList.toggle("activa", Number(b.dataset.id) === c.id));

    this.nombre.textContent = c.nombre;
    const esp = c.genoma.especializacion;
    const estilo = esp ? [esp.craneo > 0.5 ? "embestida" : "", esp.mandibula > 0.5 ? "mordida" : "", esp.garras > 0.5 ? "garras" : "", esp.agilidad > 0.5 ? "persecución" : "", esp.recursos > 0.7 ? "defiende recursos" : "", esp.depredador > 0.7 ? "caza" : "", esp.territorial > 0.5 ? "territorial" : ""].filter(Boolean).join(", ") : "";
    this.edad.textContent = `Día ${Math.floor(c.edad / DIA) + 1} de vida${c.rutina ? ` · raza simple ${c.rutina === "hostil" ? "hostil" : "amistosa"}` : ""}${estilo ? ` · combate: ${estilo}` : ""}${this.juego.sim.salas.length > 1 ? ` · en ${this.juego.sim.salas[c.sala]?.nombre ?? "la sala"}` : ""}${this.llevaTexto(c)}`;
    this.estado.textContent = this.fraseEstado(c);
    const sec = c.secuelas ?? [];
    this.cabSecuelas.hidden = this.secuelasEl.hidden = sec.length === 0;
    this.secuelasEl.replaceChildren(...sec.map((s) => h("p", { clase: "va-estado" }, `${s.texto} ${s.efecto}`)));
    this.subtitulo.textContent = `${c.nombre}. ${this.fraseEstado(c)}`;

    for (const n of NECESIDADES) {
      const fila = this.filasNec.get(n.i)!;
      const v = c.nec[n.i];
      (fila.querySelector("i") as HTMLElement).style.setProperty("--v", String(v));
      fila.dataset.nivel = v > 0.75 ? "alto" : v > 0.45 ? "medio" : "bajo";
      fila.classList.toggle("callada", n.i === N.dolor && v < 0.05);
    }

    // Emociones: aparecen las que se sienten ahora
    const activas = EMOCIONES.filter((q) => c.emo[q.i] > 0.18).sort((a, b) => c.emo[b.i] - c.emo[a.i]);
    const clave = activas.map((q) => q.nombre).join("|");
    if (this.tags.dataset.clave !== clave) {
      this.tags.dataset.clave = clave;
      this.tags.replaceChildren(...(activas.length ? activas.map((q) => h("span", { clase: `va-tag e${q.i}`, "data-e": String(q.i) }, q.nombre)) : [h("span", { clase: "va-tag calma" }, "Tranquilo")]));
    }
    this.tags.querySelectorAll<HTMLElement>(".va-tag[data-e]").forEach((t) => t.style.setProperty("--v", String(Math.min(1, c.emo[Number(t.dataset.e)] * 1.3))));

    // Retrato y radar
    const v = this.escena.vistas.get(c.id);
    if (v) pintarRetrato(this.retrato, v, c.genoma, c.huella);
    this.pintarRadar(c);
    this.refrescarMemoria(false);
  }

  /** Describe en una frase lo que la criatura esta haciendo, con lo que necesita. */
  /** Lo que lleva a cuestas, para la ficha (vacio si no lleva nada). */
  private llevaTexto(c: Criatura): string {
    const o = c.lleva !== null ? this.juego.sim.salas[c.sala]?.mundo.obj(c.lleva) : undefined;
    const def = o ? CATALOGO[o.tipo] : undefined;
    return def ? ` · lleva ${def.gen === "f" ? "la" : "el"} ${def.nombre}` : "";
  }

  private fraseEstado(c: Criatura): string {
    if (!c.vivo) return `Murió ${c.causa || "de causas naturales"}.`;
    if (c.incap >= 0) return "Está en el suelo, sin fuerzas. Una caricia puede reanimarla.";
    const a = c.accion;
    const partes: string[] = [];
    if (c.nec[N.dolor] > 0.5) partes.push("Le duele");
    else if (c.emo[E.miedo] > 0.5) partes.push("Tiene miedo");
    else if (c.nec[N.hambre] > 0.65) partes.push("Tiene hambre");
    else if (c.nec[N.sueno] > 0.7 && !c.dormido) partes.push("Tiene sueño");
    else if (c.nec[N.aburrimiento] > 0.7) partes.push("Se aburre");
    else if (c.nec[N.soledad] > 0.7) partes.push("Echa de menos compañía");
    let hace = "Está pensando";
    if (c.dormido) hace = "Está durmiendo";
    else if (a) {
      const def = CATALOGO[a.tipo];
      const art = def ? (def.gen === "f" ? "la" : "el") : "";
      const obj = def ? `${art} ${def.nombre}` : a.nombre;
      const cerca = a.fase === "hacer";
      switch (a.v) {
        case "probar": hace = cerca ? `Está probando ${obj}` : `Va a probar ${obj}`; break;
        case "empujar": hace = cerca ? `Está empujando ${obj}` : `Va a empujar ${obj}`; break;
        case "tocar": hace = cerca ? `Está tocando ${obj}` : `Va a tocar ${obj}`; break;
        case "acercarse": hace = `Se acerca a ${a.nombre}`; break;
        case "evitar": hace = `Se aleja de ${obj}`; break;
        case "explorar": hace = cerca ? "Olfatea el lugar" : "Explora la sala"; break;
        case "descansar": hace = "Descansa"; break;
        default: hace = "Está pensando";
      }
      if (a.recordado) hace += ", donde la vio antes".replace("la vio", "lo vio");
    }
    if (partes.length && !c.dormido) return `${partes[0]} y ${hace.charAt(0).toLowerCase()}${hace.slice(1)}.`;
    return `${hace}.`;
  }

  private pintarRadar(c: Criatura): void {
    const cv = this.radar;
    const g = cv.getContext("2d") as CanvasRenderingContext2D;
    const W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) * 0.34;
    const n = RASGOS.length;
    const punto = (i: number, v: number): [number, number] => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
    };
    g.strokeStyle = "rgba(120,180,195,0.16)"; g.lineWidth = 1.5;
    for (const k of [0.33, 0.66, 1]) { g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = punto(i, k); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
    for (let i = 0; i < n; i++) { const [x, y] = punto(i, 1); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); }
    const poli = (vals: number[], relleno: string | null, linea: string, ancho: number): void => {
      g.beginPath(); vals.forEach((v, i) => { const [x, y] = punto(i, 0.08 + v * 0.92); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
      if (relleno) { g.fillStyle = relleno; g.fill(); }
      g.strokeStyle = linea; g.lineWidth = ancho; g.stroke();
    };
    poli(c.base, null, "rgba(217,228,222,0.45)", 2);
    poli(c.rasgos, "rgba(70,217,232,0.22)", "rgba(70,217,232,0.95)", 3);
    g.font = '600 21px "Chakra Petch", sans-serif';
    g.fillStyle = "rgba(217,228,222,0.75)";
    g.textBaseline = "middle";
    NOMBRE_RASGO.forEach((nombre, i) => {
      const [x, y] = punto(i, 1.2);
      g.textAlign = Math.abs(x - cx) < 14 ? "center" : x > cx ? "left" : "right";
      g.fillText(nombre, x + (g.textAlign === "left" ? -6 : g.textAlign === "right" ? 6 : 0), y + (y < cy - R * 0.9 ? -4 : y > cy + R * 0.9 ? 4 : 0));
    });
  }

  /* ---------- Memoria ---------- */
  private refrescarMemoria(forzar: boolean): void {
    if (this.panelMem.offsetParent === null && !forzar) return;
    const c = this.juego.criatura;
    const m = c.mem;
    let clave: string;
    if (this.pestana === "historia") clave = `h${c.id}|${m.episodios.length}|${m.episodios[m.episodios.length - 1]?.t ?? 0}`;
    else clave = `${this.pestana}${c.id}|${Math.floor(this.tick / 8)}|${this.juego.sim.legado.length}`;
    if (clave === this.clavesMem && !forzar) return;
    this.clavesMem = clave;
    const lista = h("div", { clase: "va-lista" });
    if (this.pestana === "historia") {
      const eps = m.episodios.slice().sort((a, b) => b.t - a.t).slice(0, 40);
      if (!eps.length) lista.append(h("p", { clase: "va-vacio" }, "Todavía no le ha pasado nada que merezca recordarse."));
      for (const e of eps) {
        const r = Juego.reloj(e.t);
        lista.append(h("div", { clase: `va-ep ${e.val > 0.15 ? "bueno" : e.val < -0.15 ? "malo" : ""}` },
          h("span", { clase: "va-ep-hora" }, `Día ${r.dia} · ${r.hora}`),
          h("p", {}, e.texto, e.n > 1 ? h("b", {}, ` ×${e.n}`) : null)));
      }
    } else if (this.pestana === "linaje") {
      // Arbol genealogico: las que nacieron del laboratorio arriba y sus crias debajo, con lo que heredaron
      type Nodo = { id: number; nombre: string; gen: number; padres: number[]; viva: boolean; sens: number; cur: number };
      const nodos = new Map<number, Nodo>();
      for (const q of this.juego.sim.criaturas) nodos.set(q.id, { id: q.id, nombre: q.nombre, gen: q.generacion, padres: q.padres, viva: q.vivo, sens: q.genoma.rasgos[7], cur: q.genoma.rasgos[0] });
      for (const l of this.juego.sim.legado) if (!nodos.has(l.id)) nodos.set(l.id, { id: l.id, nombre: l.nombre, gen: l.generacion, padres: l.padres, viva: false, sens: l.genoma.rasgos[7], cur: l.genoma.rasgos[0] });
      const hijosDe = (id: number): Nodo[] => [...nodos.values()].filter((n) => n.padres[0] === id);
      const raices = [...nodos.values()].filter((n) => !n.padres.length || !nodos.has(n.padres[0]));
      const barra = (nombre: string, v: number): HTMLElement => h("div", { clase: "va-pensar" }, h("span", {}, nombre), h("div", { clase: "va-cap fino" }, h("i", { style: `--v:${Math.max(0.03, v)}` })));
      const pintar = (n: Nodo, prof: number): void => {
        const otro = n.padres.length > 1 ? nodos.get(n.padres[1])?.nombre : null;
        lista.append(h("div", { clase: `va-ep ${n.viva ? "bueno" : "malo"}`, style: `margin-left:${prof * 16}px` },
          h("span", { clase: "va-ep-hora" }, `Generación ${n.gen}${n.viva ? "" : " · murió"}`),
          h("p", {}, n.padres.length ? `${n.nombre}, cría de ${nodos.get(n.padres[0])?.nombre ?? "?"}${otro ? ` y ${otro}` : ""}.` : `${n.nombre}, del laboratorio.`),
          barra("Sensibilidad heredada", n.sens), barra("Curiosidad heredada", n.cur)));
        for (const h_ of hijosDe(n.id)) pintar(h_, prof + 1);
      };
      if (nodos.size <= 1 && !this.juego.sim.criaturas.some((q) => q.padres.length)) lista.append(h("p", { clase: "va-vacio" }, "Todavía no ha nacido ninguna cría. Con el botón Criar, dos criaturas tienen una hija que hereda un poco de cada una, con alguna mutación pequeña."));
      for (const r of raices) pintar(r, 0);
    } else if (this.pestana === "legado") {
      const leg = this.juego.sim.legado;
      if (!leg.length) lista.append(h("p", { clase: "va-vacio" }, "Todavía no ha muerto nadie. Con la mortalidad permanente, o si una criatura tendida no recibe cuidados, aquí queda lo que dejó."));
      for (const l of leg.slice().reverse()) {
        lista.append(h("div", { clase: "va-ep malo" },
          h("span", { clase: "va-ep-hora" }, `Día ${l.dia} · vivió ${l.edadDias} ${l.edadDias === 1 ? "día" : "días"}`),
          h("p", {}, `${l.nombre} murió ${l.causa}.`),
          ...l.episodios.slice(0, 3).map((t) => h("p", { style: "color:var(--hueso-2);font-size:14px" }, t))));
      }
    } else if (this.pestana === "sabe") {
      const as = m.asociacionesLegibles().slice(0, 14);
      if (!as.length) lista.append(h("p", { clase: "va-vacio" }, "Todavía no ha aprendido nada de lo que le rodea."));
      for (const a of as) {
        lista.append(h("div", { clase: `va-asoc ${a.valor > 0.02 ? "bueno" : a.valor < -0.02 ? "malo" : ""}` },
          h("p", {}, a.texto),
          h("div", { clase: "va-cap fino" }, h("i", { style: `--v:${Math.min(1, a.fuerza / 1.2)}` })),
          h("span", { clase: "va-asoc-n" }, `${a.veces} ${a.veces === 1 ? "vez" : "veces"}`)));
      }
    } else {
      const hs = m.habitosLegibles();
      lista.append(h("h4", { clase: "va-sub-sec" }, "Lo que se le ve hacer"));
      if (!hs.length) lista.append(h("p", { clase: "va-vacio" }, "Aún no hay costumbres claras."));
      for (const t of hs) lista.append(h("p", { clase: "va-hab" }, t));
      lista.append(h("h4", { clase: "va-sub-sec" }, "Lo que piensa ahora"));
      const piensa = c.ultimaDecision.filter((q) => q.u > -0.3);
      const max = Math.max(0.2, ...piensa.map((q) => q.u));
      for (const q of piensa.slice(0, 4)) {
        const def = CATALOGO[q.tipo];
        const nombre = `${VERBO_LARGO[q.v] ?? q.v}${def ? " " + (def.gen === "f" ? "la " : "el ") + def.nombre : q.tipo === "criatura" ? " otra criatura" : ""}`;
        lista.append(h("div", { clase: "va-pensar" }, h("span", {}, nombre), h("div", { clase: "va-cap fino" }, h("i", { style: `--v:${Math.max(0.04, q.u / max)}` }))));
      }
      lista.append(h("h4", { clase: "va-sub-sec" }, "Cómo ha cambiado"));
      const cambios: string[] = [];
      c.rasgos.forEach((v, i) => {
        const d = v - c.base[i];
        if (Math.abs(d) >= 0.04) cambios.push(`${d > 0 ? "Más" : "Menos"} ${NOMBRE_RASGO[i].toLowerCase()} que al nacer.`);
      });
      if (!cambios.length) lista.append(h("p", { clase: "va-vacio" }, "Su carácter sigue como al nacer."));
      for (const t of cambios) lista.append(h("p", { clase: "va-hab" }, t));
    }
    this.memoria.replaceChildren(lista);
  }
}
