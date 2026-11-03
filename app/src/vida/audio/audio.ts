/* Audio de Vida Artificial, todo sintetizado con Web Audio (no hay archivos de sonido).
   Ambiente: un zumbido grave de instalacion, aire en los conductos, gotas con eco, algun pitido lejano y el borboteo de los tubos.
   Efectos: cada accion suena en el sitio de la habitacion donde ocurre (se reparte entre los dos altavoces).
   Nada suena hasta el primer clic. */

export interface AjustesAudio {
  volumen: number;
  silencio: boolean;
}

class Sonido {
  ctx: AudioContext | null = null;
  maestro: GainNode | null = null;
  fx: GainNode | null = null;
  ambiente: GainNode | null = null;
  eco: DelayNode | null = null;
  activo = false;
  ajustes: AjustesAudio = { volumen: 0.7, silencio: false };
  private timers: number[] = [];
  private filtroAmb: BiquadFilterNode | null = null;

  fijar(a: AjustesAudio): void {
    this.ajustes = { ...a };
    this.aplicar();
  }

  private aplicar(): void {
    if (!this.maestro || !this.ctx) return;
    this.maestro.gain.setTargetAtTime(this.ajustes.silencio ? 0 : this.ajustes.volumen, this.ctx.currentTime, 0.08);
  }

  iniciar(): void {
    if (this.activo) { void this.ctx?.resume(); return; }
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    } catch { return; }
    const c = this.ctx;
    this.maestro = c.createGain();
    this.fx = c.createGain();
    this.ambiente = c.createGain();
    this.fx.gain.value = 0.9;
    this.ambiente.gain.value = 0.5;
    this.eco = c.createDelay(1);
    this.eco.delayTime.value = 0.32;
    const retro = c.createGain(); retro.gain.value = 0.35;
    const filtroEco = c.createBiquadFilter(); filtroEco.type = "lowpass"; filtroEco.frequency.value = 2200;
    this.eco.connect(filtroEco); filtroEco.connect(retro); retro.connect(this.eco);
    const salidaEco = c.createGain(); salidaEco.gain.value = 0.5; filtroEco.connect(salidaEco); salidaEco.connect(this.maestro);
    this.fx.connect(this.maestro);
    this.ambiente.connect(this.maestro);
    this.maestro.connect(c.destination);
    this.activo = true;
    this.aplicar();
    this.arrancarAmbiente();
  }

  parar(): void {
    for (const t of this.timers) window.clearTimeout(t);
    this.timers = [];
  }

  /* --- Ambiente --- */
  private arrancarAmbiente(): void {
    const c = this.ctx!;
    const filtro = c.createBiquadFilter(); filtro.type = "lowpass"; filtro.frequency.value = 220; this.filtroAmb = filtro;
    const g = c.createGain(); g.gain.value = 0.07;
    for (const [f, tipo, v] of [[55, "sawtooth", 0.5], [55.45, "sawtooth", 0.5], [36.5, "sine", 0.9], [110.2, "sine", 0.12]] as [number, OscillatorType, number][]) {
      const o = c.createOscillator(); o.type = tipo; o.frequency.value = f;
      const gg = c.createGain(); gg.gain.value = v;
      o.connect(gg); gg.connect(filtro); o.start();
    }
    filtro.connect(g); g.connect(this.ambiente!);
    // Aire en los conductos: ruido filtrado que respira despacio
    const n = c.sampleRate * 3;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700; bp.Q.value = 0.6;
    const ga = c.createGain(); ga.gain.value = 0.012;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    const lg = c.createGain(); lg.gain.value = 0.008;
    lfo.connect(lg); lg.connect(ga.gain); lfo.start();
    src.connect(bp); bp.connect(ga); ga.connect(this.ambiente!); src.start();
    // Gotas, pitidos y borboteos de vez en cuando
    const ciclo = (min: number, max: number, accion: () => void): void => {
      const t = window.setTimeout(() => { if (this.activo) accion(); ciclo(min, max, accion); }, (min + Math.random() * (max - min)) * 1000);
      this.timers.push(t);
    };
    ciclo(3, 9, () => this.gota());
    ciclo(9, 22, () => this.pitido());
    ciclo(5, 14, () => this.borboteo());
  }

  /** De noche el ambiente se vuelve mas sordo. `noche` va de 0 a 1. */
  noche(n: number): void {
    if (!this.ctx || !this.filtroAmb) return;
    this.filtroAmb.frequency.setTargetAtTime(220 - 90 * n, this.ctx.currentTime, 2);
  }

  /* --- Piezas basicas --- */
  private tono(freq: number, dur: number, tipo: OscillatorType = "sine", vol = 0.2, inicio = 0, hasta?: number, pan = 0, eco = 0, bus: GainNode | null = null): void {
    if (!this.ctx || !this.fx) return;
    const c = this.ctx;
    const t0 = c.currentTime + inicio;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t0);
    if (hasta) o.frequency.exponentialRampToValueAtTime(hasta, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    let salida: AudioNode = g;
    if (pan !== 0 && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); salida = p; }
    salida.connect(bus ?? this.fx);
    if (eco > 0 && this.eco) { const ge = c.createGain(); ge.gain.value = eco; salida.connect(ge); ge.connect(this.eco); }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private ruido(dur: number, vol = 0.1, filtro = 1800, inicio = 0, pan = 0, q = 1): void {
    if (!this.ctx || !this.fx) return;
    const c = this.ctx;
    const t0 = c.currentTime + inicio;
    const n = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filtro; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g);
    let salida: AudioNode = g;
    if (pan !== 0 && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); salida = p; }
    salida.connect(this.fx);
    s.start(t0);
  }

  /* --- Ambiente puntual --- */
  private gota(): void { const p = Math.random() * 2 - 1; this.tono(1500 + Math.random() * 900, 0.18, "sine", 0.05, 0, 600, p * 0.8, 0.6, this.ambiente); }
  private pitido(): void { const p = Math.random() * 2 - 1; this.tono(880, 0.07, "sine", 0.025, 0, undefined, p, 0.3, this.ambiente); this.tono(880, 0.07, "sine", 0.025, 0.16, undefined, p, 0.3, this.ambiente); }
  private borboteo(): void { const p = 0.5 + Math.random() * 0.4; for (let i = 0; i < 3; i++) this.tono(240 + Math.random() * 120, 0.1, "sine", 0.03, i * 0.12, 520, p, 0.2, this.ambiente); }

  /* --- Voces de la criatura (pan = -1 izquierda, 1 derecha; v = tono de cada criatura, 0.8 a 1.3) --- */
  trino(pan = 0, v = 1): void { this.tono(620 * v, 0.1, "triangle", 0.12, 0, 900 * v, pan, 0.2); this.tono(900 * v, 0.14, "triangle", 0.12, 0.1, 1250 * v, pan, 0.2); }
  curiosear(pan = 0, v = 1): void { this.tono(480 * v, 0.12, "sine", 0.1, 0, 760 * v, pan, 0.15); }
  queja(pan = 0, v = 1): void { for (let i = 0; i < 2; i++) this.tono(680 * v, 0.28, "triangle", 0.13, i * 0.22, 330 * v, pan, 0.3); }
  grito(pan = 0, v = 1): void { this.tono(980 * v, 0.22, "sawtooth", 0.1, 0, 380 * v, pan, 0.3); this.ruido(0.12, 0.06, 2600, 0, pan); }
  ronquido(pan = 0): void { this.ruido(0.5, 0.03, 220, 0, pan, 0.8); this.tono(70, 0.5, "sine", 0.025, 0, 55, pan); }
  bostezo(pan = 0, v = 1): void { this.tono(420 * v, 0.55, "sine", 0.07, 0, 260 * v, pan, 0.3); }
  mordisco(pan = 0): void { this.ruido(0.07, 0.1, 1900, 0, pan, 2); this.ruido(0.07, 0.08, 1500, 0.11, pan, 2); }
  paso(pan = 0, fuerte = 0.03): void { this.ruido(0.05, fuerte, 380, 0, pan, 0.7); }

  /* --- Objetos --- */
  bote(pan = 0, vol = 0.14): void { this.tono(210, 0.14, "sine", vol, 0, 90, pan); this.ruido(0.04, vol * 0.4, 600, 0, pan); }
  golpePelota(pan = 0): void { this.tono(260, 0.12, "triangle", 0.18, 0, 120, pan); this.ruido(0.05, 0.08, 900, 0, pan); }
  palanca(pan = 0): void { this.tono(1800, 0.03, "square", 0.08, 0, 900, pan); this.tono(130, 0.3, "sine", 0.2, 0.05, 55, pan); this.ruido(0.25, 0.06, 500, 0.08, pan); this.tono(420, 0.5, "triangle", 0.05, 0.2, 300, pan, 0.4); }
  granuloCae(pan = 0): void { this.tono(2300, 0.1, "sine", 0.1, 0, 1300, pan, 0.4); this.tono(1500, 0.08, "sine", 0.06, 0.12, 900, pan, 0.4); }
  fruta(pan = 0): void { this.tono(330, 0.12, "sine", 0.1, 0, 480, pan); this.ruido(0.05, 0.04, 800, 0, pan); }
  soltar(pan = 0): void { this.tono(260, 0.08, "triangle", 0.12, 0, 160, pan); }
  descarga(pan = 0): void { this.ruido(0.28, 0.16, 3200, 0, pan, 1.5); this.tono(120, 0.3, "square", 0.08, 0, 70, pan); this.tono(2400, 0.08, "sawtooth", 0.05, 0.02, 800, pan); }

  /* --- Del jugador --- */
  premio(pan = 0): void { [660, 880, 1100, 1320].forEach((f, i) => this.tono(f, 0.28, "triangle", 0.1, i * 0.07, undefined, pan, 0.5)); }
  asustar(): void { this.tono(70, 0.5, "sine", 0.3, 0, 28); this.ruido(0.35, 0.18, 400); this.tono(200, 0.3, "sawtooth", 0.08, 0, 60); }
  clic(): void { this.tono(520, 0.05, "triangle", 0.1); this.tono(780, 0.06, "triangle", 0.08, 0.04); }
  hover(): void { this.tono(700, 0.03, "sine", 0.035); }
  atras(): void { this.tono(520, 0.06, "triangle", 0.1); this.tono(360, 0.08, "triangle", 0.09, 0.05); }
  puerta(): void { this.ruido(0.6, 0.12, 300, 0); this.tono(90, 0.5, "sawtooth", 0.07, 0, 60); this.tono(1200, 0.06, "square", 0.05, 0.45, 800); }
  aviso(): void { this.tono(540, 0.1, "sine", 0.1); this.tono(720, 0.14, "sine", 0.1, 0.09); }
}

export const sonido = new Sonido();
