/* Audio de Pitter-Patter.
   Musica: pistas mp3 de assets/musica (las del usuario), con fundido entre escenas. Se elige cual suena en cada escena en PISTAS.
   Efectos: sintetizados con Web Audio, sin archivos. Musica y efectos tienen volumen y silencio propios.
   Nada suena hasta que el jugador toca algo (iniciar() se llama desde el primer clic). */

export type Escena = "menu" | "puzzle" | "stand" | "habitaciones" | "calma";

/* Cambia aqui las canciones. Las rutas son relativas a la raiz del sitio. */
export const PISTAS: Record<Escena, string> = {
  menu: "assets/musica/Windmill Isle (Day) - Sonic Unleashed [OST] - DeoxysPrime (1).mp3",
  puzzle: "assets/musica/Bad Piggies Theme - Ilmari Hakkola.mp3",
  stand: "assets/musica/Great Escape - cinema staff.mp3",
  habitaciones: "assets/musica/Rayman Origins Music Sea of Serendipity ~ Lums of the Water - Soniman001.mp3",
  calma: "assets/musica/Windmill Isle (Day) - Sonic Unleashed [OST] - DeoxysPrime (1).mp3",
};
export const VICTORIA = "assets/cosas/Happy Wheels victory.mp3";

export interface AjustesAudio {
  musica: number;
  efectos: number;
  silencioMusica: boolean;
  silencioEfectos: boolean;
}

const RAIZ = import.meta.env.DEV ? "/" : "../../";

class Sonido {
  ctx: AudioContext | null = null;
  busMusica: GainNode | null = null;
  busEfectos: GainNode | null = null;
  ajustes: AjustesAudio = { musica: 0.6, efectos: 0.8, silencioMusica: false, silencioEfectos: false };
  activo = false;
  private pista: { el: HTMLAudioElement; nodo: GainNode; ruta: string } | null = null;
  private escenaActual: Escena | null = null;
  private agachado = 1;

  fijar(a: AjustesAudio): void {
    this.ajustes = { ...a };
    this.aplicar();
  }

  /** Se llama con el primer clic del jugador: los navegadores no dejan sonar antes. */
  iniciar(): void {
    if (this.activo) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    this.busMusica = this.ctx.createGain();
    this.busEfectos = this.ctx.createGain();
    this.busMusica.connect(this.ctx.destination);
    this.busEfectos.connect(this.ctx.destination);
    this.activo = true;
    this.aplicar();
    if (this.escenaActual) this.musica(this.escenaActual, true);
  }

  private aplicar(): void {
    if (!this.busMusica || !this.busEfectos) return;
    const t = this.ctx?.currentTime ?? 0;
    this.busMusica.gain.setTargetAtTime(this.ajustes.silencioMusica ? 0 : this.ajustes.musica * this.agachado, t, 0.05);
    this.busEfectos.gain.setTargetAtTime(this.ajustes.silencioEfectos ? 0 : this.ajustes.efectos, t, 0.05);
  }

  agachar(si: boolean): void {
    this.agachado = si ? 0.3 : 1;
    this.aplicar();
  }

  /** Cambia la musica con un fundido. Si ya suena esa pista, no hace nada. */
  musica(escena: Escena, forzar = false): void {
    this.escenaActual = escena;
    if (!this.ctx || !this.busMusica) return;
    const ruta = RAIZ + PISTAS[escena];
    if (this.pista && this.pista.ruta === ruta && !forzar) return;
    const vieja = this.pista;
    if (vieja) {
      vieja.nodo.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35);
      window.setTimeout(() => { vieja.el.pause(); vieja.el.src = ""; vieja.nodo.disconnect(); }, 1800);
    }
    const el = new Audio(encodeURI(ruta));
    el.loop = true;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    const fuente = this.ctx.createMediaElementSource(el);
    const nodo = this.ctx.createGain();
    nodo.gain.value = 0;
    fuente.connect(nodo);
    nodo.connect(this.busMusica);
    nodo.gain.setTargetAtTime(1, this.ctx.currentTime + 0.1, 0.6);
    void el.play().catch(() => { /* sin pista: el juego sigue */ });
    this.pista = { el, nodo, ruta };
  }

  parar(): void {
    this.escenaActual = null;
    if (!this.pista || !this.ctx) return;
    const p = this.pista;
    p.nodo.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
    window.setTimeout(() => p.el.pause(), 1200);
    this.pista = null;
  }

  /** Un trozo de musica suelto (la victoria): baja el fondo mientras suena. */
  jingle(ruta: string): void {
    if (!this.ctx || !this.busMusica) return;
    const el = new Audio(encodeURI(RAIZ + ruta));
    el.crossOrigin = "anonymous";
    const fuente = this.ctx.createMediaElementSource(el);
    const g = this.ctx.createGain();
    g.gain.value = this.ajustes.silencioEfectos ? 0 : this.ajustes.efectos;
    fuente.connect(g);
    g.connect(this.ctx.destination);
    this.agachar(true);
    el.addEventListener("ended", () => this.agachar(false));
    void el.play().catch(() => this.agachar(false));
  }

  /* --- efectos --- */
  private tono(freq: number, dur: number, tipo: OscillatorType = "square", vol = 0.2, inicio = 0, hasta?: number): void {
    if (!this.ctx || !this.busEfectos) return;
    const t0 = this.ctx.currentTime + inicio;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.busEfectos);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private ruido(dur: number, vol = 0.12, filtro = 1800, inicio = 0): void {
    if (!this.ctx || !this.busEfectos) return;
    const t0 = this.ctx.currentTime + inicio;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = filtro;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.busEfectos);
    s.start(t0);
  }

  clic(): void { this.tono(520, 0.07, "triangle", 0.18); this.tono(780, 0.09, "triangle", 0.14, 0.05); }
  hover(): void { this.tono(660, 0.04, "sine", 0.06); }
  atras(): void { this.tono(520, 0.08, "triangle", 0.16); this.tono(360, 0.1, "triangle", 0.14, 0.06); }
  agarrar(): void { this.tono(420, 0.06, "sine", 0.14, 0, 640); }
  soltar(): void { this.tono(300, 0.08, "sine", 0.12, 0, 200); }
  mover(): void { this.tono(480, 0.035, "sine", 0.07); }
  invalido(): void { this.tono(160, 0.16, "sawtooth", 0.12, 0, 110); }
  borrar(combo: number, tam: number): void {
    const base = 360 * Math.pow(1.0595, Math.min(combo, 24));
    this.tono(base, 0.1, "square", 0.12);
    this.tono(base * 1.25, 0.1, "square", 0.1, 0.06);
    this.tono(base * 1.5, 0.16, "square", 0.1, 0.12);
    if (tam >= 6) this.tono(base * 2, 0.22, "triangle", 0.14, 0.18);
    this.ruido(0.1, 0.08, 2600);
  }
  caer(): void { this.tono(220, 0.07, "sine", 0.08, 0, 120); }
  caja(): void { this.tono(660, 0.08, "square", 0.12); this.tono(990, 0.18, "square", 0.12, 0.07); this.ruido(0.25, 0.1, 900); }
  habilidad(): void { for (let i = 0; i < 6; i++) this.tono(400 * Math.pow(1.26, i), 0.12, "triangle", 0.14, i * 0.05); this.ruido(0.35, 0.08, 3200, 0.2); }
  cargada(): void { this.tono(880, 0.1, "sine", 0.14); this.tono(1320, 0.18, "sine", 0.12, 0.08); }
  standUp(): void { for (let i = 0; i < 8; i++) this.tono(220 * Math.pow(1.19, i), 0.16, "sawtooth", 0.1, i * 0.045); this.ruido(0.6, 0.12, 700, 0.1); }
  estalla(): void { this.ruido(0.7, 0.22, 500); this.tono(110, 0.5, "sawtooth", 0.2, 0, 40); }
  reloj(): void { this.tono(900, 0.05, "square", 0.08); }
  aviso(): void { this.tono(300, 0.14, "sawtooth", 0.1); this.tono(240, 0.2, "sawtooth", 0.1, 0.12); }
  victoria(): void { [523, 659, 784, 1047].forEach((f, i) => this.tono(f, 0.22, "square", 0.14, i * 0.11)); }
  derrota(): void { [392, 349, 311, 233].forEach((f, i) => this.tono(f, 0.3, "triangle", 0.16, i * 0.16)); }
  desbloqueo(): void { [659, 784, 988, 1319, 1568].forEach((f, i) => this.tono(f, 0.2, "triangle", 0.14, i * 0.08)); this.ruido(0.4, 0.06, 4200, 0.3); }
  mueble(): void { this.tono(330, 0.07, "sine", 0.14, 0, 480); this.tono(520, 0.08, "sine", 0.1, 0.05); }
}

export const sonido = new Sonido();
