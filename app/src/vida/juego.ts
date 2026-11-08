/* El controlador del juego: une la simulacion, la escena de Phaser y la interfaz. Guarda lo que el jugador elige (velocidad, camara,
   criatura seleccionada) y ofrece las herramientas (soltar objetos, premiar, asustar). */

import type Phaser from "phaser";
import type { Criatura } from "./nucleo/criatura.ts";
import { Simulacion } from "./nucleo/simulacion.ts";
import { AJ } from "./nucleo/ajustes.ts";
import { AJUSTES_INICIALES, guardarLocal, simulacionNueva, type AjustesVida, type Guardado } from "./guardado.ts";
import { sonido } from "./audio/audio.ts";
import { DIA, MORTALIDADES } from "./nucleo/tipos.ts";

type Oyente = (...a: unknown[]) => void;

export class Juego {
  sim: Simulacion;
  ajustes: AjustesVida;
  seleccion = 1;
  pausado = false;
  observar = false;
  creada = Date.now();
  /** Pixeles de abajo de la pantalla que tapa la interfaz (la bandeja). La camara los deja libres para que el suelo se vea entero. */
  margenInferior = 40;
  game: Phaser.Game | null = null;
  private oyentes = new Map<string, Oyente[]>();
  private ultimoGuardado = 0;

  constructor(g: Guardado | null) {
    if (g) {
      this.sim = Simulacion.restaurar(g.sim);
      this.ajustes = g.ajustes;
      this.seleccion = g.seleccion;
      this.creada = g.creada;
    } else {
      this.sim = simulacionNueva();
      this.ajustes = { ...AJUSTES_INICIALES };
    }
    sonido.fijar({ volumen: this.ajustes.volumen, silencio: this.ajustes.silencio });
    for (const c of this.sim.criaturas) c.capRegistro = 400;
  }

  on(ev: string, f: Oyente): void {
    const l = this.oyentes.get(ev) ?? [];
    l.push(f);
    this.oyentes.set(ev, l);
  }

  emit(ev: string, ...a: unknown[]): void {
    for (const f of this.oyentes.get(ev) ?? []) f(...a);
  }

  get criatura(): Criatura {
    return this.sim.criatura(this.seleccion) ?? this.sim.criaturas[0];
  }

  seleccionar(id: number): void {
    if (!this.sim.criatura(id)) return;
    this.seleccion = id;
    this.emit("seleccion", id);
  }

  anterior(): void {
    const ids = this.sim.criaturas.map((c) => c.id);
    this.seleccionar(ids[(ids.indexOf(this.seleccion) - 1 + ids.length) % ids.length]);
  }

  siguiente(): void {
    const ids = this.sim.criaturas.map((c) => c.id);
    this.seleccionar(ids[(ids.indexOf(this.seleccion) + 1) % ids.length]);
  }

  /** Un ensayo nuevo: se cambia la simulacion entera y la escena vuelve a dibujarla. */
  reemplazarSim(sim: Simulacion): void {
    this.sim = sim;
    for (const c of sim.criaturas) c.capRegistro = 400;
    this.seleccion = sim.criaturas[0].id;
    this.creada = Date.now();
    this.emit("simNueva");
  }

  /* --- Herramientas --- */
  soltar(tipo: string, x: number): void {
    const xs = Math.max(40, Math.min(AJ.ancho - 40, x));
    const o = this.sim.mundo.agregar(tipo, xs, { z: 40, vz: 0 });
    sonido.soltar(0);
    this.emit("objeto", o.id);
    this.guardar();
  }

  mover(id: number, x: number): void {
    const o = this.sim.mundo.obj(id);
    if (!o) return;
    o.x = Math.max(30, Math.min(AJ.ancho - 30, x));
    o.vx = 0;
  }

  quitar(id: number): void {
    this.sim.mundo.quitar(id);
    this.emit("quitado", id);
    this.guardar();
  }

  premiar(): void {
    const c = this.criatura;
    if (!c.vivo) return;
    c.recompensar({ mundo: this.sim.mundo, criaturas: this.sim.criaturas, t: this.sim.t });
    this.emit("premio", c.id);
    this.guardar();
  }

  asustar(): void {
    const c = this.criatura;
    if (!c.vivo) return;
    c.asustar({ mundo: this.sim.mundo, criaturas: this.sim.criaturas, t: this.sim.t });
    this.emit("susto", c.id);
    this.guardar();
  }

  /* --- Ajustes --- */
  fijarVelocidad(v: number): void {
    this.ajustes.velocidad = v;
    this.pausado = v === 0;
    this.emit("velocidad", v);
  }

  fijarCamara(m: AjustesVida["camara"]): void {
    this.ajustes.camara = m;
    this.emit("camara", m);
  }

  /** Activa o apaga las secuelas fisicas (cojera, menos fuerza, peor vista u oido tras golpes graves o repetidos). */
  alternarSecuelas(): boolean {
    this.sim.fijarSecuelas(!this.sim.secuelas);
    this.emit("secuelas", this.sim.secuelas);
    this.guardar(true);
    return this.sim.secuelas;
  }

  /** Cambia entre mortalidad protegida, recuperable y permanente. */
  alternarMortalidad(): string {
    const i = MORTALIDADES.indexOf(this.sim.mortalidad);
    const m = MORTALIDADES[(i + 1) % MORTALIDADES.length];
    this.sim.fijarMortalidad(m);
    this.emit("mortalidad", m);
    this.guardar(true);
    return m;
  }

  /** Cria con la criatura elegida y otra que viva. Devuelve un texto si no se puede. */
  criar(): string | null {
    const vivas = this.sim.criaturas.filter((c) => c.vivo && c.incap < 0);
    const a = this.criatura;
    if (!a.vivo || a.incap >= 0) return "La criatura elegida no está en condiciones.";
    const b = vivas.filter((c) => c !== a).sort((p, q) => Math.abs(p.x - a.x) - Math.abs(q.x - a.x))[0];
    if (!b) return "Hacen falta dos criaturas vivas para criar.";
    if (this.sim.criaturas.filter((c) => c.vivo).length >= 4) return "La sala está llena: caben cuatro criaturas vivas.";
    if (a.edad < DIA * 0.5 || b.edad < DIA * 0.5) return "Las crías todavía son demasiado jóvenes para criar.";
    const hueco = 4 - this.sim.criaturas.filter((c) => c.vivo).length;
    const camada = this.sim.parir(a, b, hueco);
    for (const h of camada) this.emit("nacimiento", h.id);
    this.seleccionar(camada[0].id);
    this.guardar(true);
    return null;
  }

  /** Enciende o apaga el dispensador automatico de fruta. */
  alternarComedero(): boolean {
    const c = this.sim.comedero;
    if (!c) return false;
    c.activo = c.activo === false;
    this.emit("comedero", c.activo !== false);
    this.guardar(true);
    return c.activo !== false;
  }

  get comederoActivo(): boolean {
    return !!this.sim.comedero && this.sim.comedero.activo !== false;
  }

  alternarObservar(): void {
    this.observar = !this.observar;
    if (this.observar && this.ajustes.camara === "panorama") this.fijarCamara("seguir");
    this.emit("observar", this.observar);
  }

  alternarSilencio(): void {
    this.ajustes.silencio = !this.ajustes.silencio;
    sonido.fijar({ volumen: this.ajustes.volumen, silencio: this.ajustes.silencio });
    this.emit("sonido", this.ajustes.silencio);
    this.guardar();
  }

  /* --- Guardado --- */
  guardar(forzar = false): void {
    const ahora = Date.now();
    if (!forzar && ahora - this.ultimoGuardado < 2500) return;
    this.ultimoGuardado = ahora;
    guardarLocal({ v: 1, sim: this.sim.serializar(), ultima: ahora, ajustes: this.ajustes, seleccion: this.seleccion, creada: this.creada });
  }

  /** "Dia 3, 14:20" para un instante de la simulacion. */
  static reloj(t: number): { dia: number; hora: string; fraccion: number } {
    const dia = Math.floor(t / DIA) + 1;
    const f = (t % DIA) / DIA;
    const min = Math.floor(f * 24 * 60);
    return { dia, hora: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, fraccion: f };
  }
}
