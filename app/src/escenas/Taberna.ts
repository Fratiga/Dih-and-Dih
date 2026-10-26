import Phaser from "phaser";
import { crearTexturas } from "../texturas";
import { mostrarDialogo, ocultarDialogo, ponerAviso, ponerFps } from "../interfaz";

export const ANCHO = 320;
export const ALTO = 192;

const VELOCIDAD = 62; // pixeles del juego por segundo
const SALIDA = "../../minijuegos.html";

interface Zona {
  id: string;
  x: number;
  y: number;
  radio: number;
  aviso: string;
  accion: () => void;
}

type Direccion = "abajo" | "arriba" | "lado";

const LINEAS_TABERNERO = [
  "Siéntate donde quieras. Hoy hay sopa.",
  "Si buscas partida, las mesas del fondo están libres.",
  "La cerveza se paga antes. Ya me han engañado una vez.",
];

export class Taberna extends Phaser.Scene {
  private jugador!: Phaser.GameObjects.Sprite;
  private obstaculos: Phaser.Geom.Rectangle[] = [];
  private zonas: Zona[] = [];
  private teclas!: Record<"arriba" | "abajo" | "izq" | "der" | "usar" | "usar2", Phaser.Input.Keyboard.Key>;
  private cursores!: Phaser.Types.Input.Keyboard.CursorKeys;
  private destino: Phaser.Math.Vector2 | null = null;
  private zonaPendiente: Zona | null = null;
  private direccion: Direccion = "abajo";
  private zonaActual: Zona | null = null;
  private lineaTabernero = 0;
  private ultimoX = 0;
  private ultimoY = 0;
  private sinMover = 0;

  constructor() {
    super("Taberna");
  }

  create(): void {
    crearTexturas(this);
    this.crearAnimaciones();
    this.dibujarSala();
    this.crearZonas();

    this.jugador = this.add.sprite(160, 142, "pj_abajo_1").setOrigin(0.5, 1);
    this.ultimoX = this.jugador.x;
    this.ultimoY = this.jugador.y;

    this.crearLuces();

    const teclado = this.input.keyboard!;
    this.cursores = teclado.createCursorKeys();
    this.teclas = {
      arriba: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      abajo: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      izq: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      der: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      usar: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      usar2: teclado.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
    };
    teclado.on("keydown-E", () => this.interactuar());
    teclado.on("keydown-ENTER", () => this.interactuar());
    teclado.on("keydown-SPACE", () => this.interactuar());

    this.input.on("pointerdown", (puntero: Phaser.Input.Pointer) => this.alTocar(puntero.worldX, puntero.worldY));

    this.time.addEvent({ delay: 500, loop: true, callback: () => ponerFps(this.game.loop.actualFps) });
  }

  /* --- Construccion de la sala --- */

  private crearAnimaciones(): void {
    const crear = (clave: string, a: string, b: string, velocidad: number): void => {
      if (this.anims.exists(clave)) return;
      this.anims.create({ key: clave, frames: [{ key: a }, { key: b }], frameRate: velocidad, repeat: -1 });
    };
    for (const dir of ["abajo", "arriba", "lado"] as const) {
      crear(`caminar_${dir}`, `pj_${dir}_0`, `pj_${dir}_1`, 6);
    }
  }

  private dibujarSala(): void {
    this.add.rectangle(0, 0, ANCHO, ALTO, 0x0e0a08).setOrigin(0).setDepth(-10);
    this.add.tileSprite(8, 32, ANCHO - 16, 144, "suelo").setOrigin(0).setDepth(-5);
    this.add.tileSprite(0, 0, ANCHO, 32, "pared").setOrigin(0).setDepth(-4);
    this.add.tileSprite(0, 176, ANCHO, 16, "pared").setOrigin(0).setDepth(-4);
    this.add.tileSprite(0, 32, 8, 144, "pared").setOrigin(0).setDepth(-4);
    this.add.tileSprite(ANCHO - 8, 32, 8, 144, "pared").setOrigin(0).setDepth(-4);
    this.add.rectangle(8, 32, ANCHO - 16, 4, 0x000000, 0.3).setOrigin(0).setDepth(-3);
    this.add.image(160, 118, "alfombra").setDepth(-2);

    this.add.image(248, 32, "chimenea").setOrigin(0.5, 1).setDepth(-1);
    const fuego = this.add.image(248, 31, "fuego_0").setOrigin(0.5, 1).setDepth(-0.5);
    let paso = 0;
    this.time.addEvent({ delay: 170, loop: true, callback: () => fuego.setTexture(`fuego_${(paso = 1 - paso)}`) });

    this.add.image(160, 192, "puerta").setOrigin(0.5, 1).setDepth(1);

    // Barra y tabernero
    this.add.image(8, 48, "barra").setOrigin(0).setDepth(60);
    const tabernero = this.add.image(64, 46, "tab_abajo_1").setOrigin(0.5, 1).setDepth(46);
    this.tweens.add({ targets: tabernero, y: 45, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Mesas, taburetes y barriles
    for (const [x, y] of [[110, 130], [214, 122], [64, 152]] as const) {
      this.add.image(x, y, "mesa").setOrigin(0.5, 1).setDepth(y);
      this.add.image(x - 22, y + 4, "taburete").setOrigin(0.5, 1).setDepth(y + 4);
      this.add.image(x + 22, y + 4, "taburete").setOrigin(0.5, 1).setDepth(y + 4);
      this.obstaculos.push(new Phaser.Geom.Rectangle(x - 16, y - 12, 32, 12));
      this.obstaculos.push(new Phaser.Geom.Rectangle(x - 27, y - 2, 10, 6));
      this.obstaculos.push(new Phaser.Geom.Rectangle(x + 17, y - 2, 10, 6));
    }
    for (const y of [60, 80]) {
      this.add.image(298, y, "barril").setOrigin(0.5, 1).setDepth(y);
      this.obstaculos.push(new Phaser.Geom.Rectangle(290, y - 8, 16, 8));
    }

    // Paredes y barra
    this.obstaculos.push(
      new Phaser.Geom.Rectangle(0, 0, ANCHO, 34),
      new Phaser.Geom.Rectangle(0, 0, 8, ALTO),
      new Phaser.Geom.Rectangle(ANCHO - 8, 0, 8, ALTO),
      new Phaser.Geom.Rectangle(0, 176, 152, 16),
      new Phaser.Geom.Rectangle(168, 176, 152, 16),
      new Phaser.Geom.Rectangle(8, 48, 112, 12),
      new Phaser.Geom.Rectangle(116, 32, 6, 16),
    );
  }

  private crearLuces(): void {
    // Un velo oscuro para que la sala parezca de noche y dos luces calidas que parpadean
    this.add.rectangle(0, 0, ANCHO, ALTO, 0x000000, 0.28).setOrigin(0).setDepth(9000);
    for (const [x, y, escala] of [[248, 34, 1.7], [64, 58, 1.1]] as const) {
      const luz = this.add.image(x, y, "luz").setScale(escala).setBlendMode(Phaser.BlendModes.ADD).setDepth(9001).setAlpha(0.7);
      this.tweens.add({
        targets: luz,
        alpha: { from: 0.55, to: 0.8 },
        duration: Phaser.Math.Between(260, 420),
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  }

  private crearZonas(): void {
    this.zonas = [
      {
        id: "tabernero", x: 64, y: 68, radio: 22, aviso: "E · Hablar con el tabernero",
        accion: () => {
          mostrarDialogo("Tabernero", LINEAS_TABERNERO[this.lineaTabernero]);
          this.lineaTabernero = (this.lineaTabernero + 1) % LINEAS_TABERNERO.length;
        },
      },
      {
        id: "chimenea", x: 248, y: 42, radio: 24, aviso: "E · Mirar el fuego",
        accion: () => mostrarDialogo("Chimenea", "El fuego está encendido y la sala se mantiene caliente."),
      },
      {
        id: "puerta", x: 160, y: 172, radio: 20, aviso: "E · Salir a Minijuegos",
        accion: () => {
          if (import.meta.env.DEV) mostrarDialogo("Puerta", "En la web publicada, aquí se vuelve a Minijuegos.");
          else window.location.href = SALIDA;
        },
      },
    ];
  }

  /* --- Interaccion --- */

  private zonaCercana(): Zona | null {
    let mejor: Zona | null = null;
    let distancia = Infinity;
    for (const z of this.zonas) {
      const d = Phaser.Math.Distance.Between(this.jugador.x, this.jugador.y, z.x, z.y);
      if (d <= z.radio && d < distancia) {
        mejor = z;
        distancia = d;
      }
    }
    return mejor;
  }

  private interactuar(): void {
    const zona = this.zonaCercana();
    if (zona) zona.accion();
  }

  private alTocar(x: number, y: number): void {
    const tocada = this.zonas.find(z => Phaser.Math.Distance.Between(x, y, z.x, z.y) <= 14);
    this.zonaPendiente = tocada ?? null;
    const objetivo = tocada ? new Phaser.Math.Vector2(tocada.x, tocada.y) : new Phaser.Math.Vector2(x, y);
    this.destino = objetivo;
  }

  /* --- Movimiento --- */

  private choca(x: number, y: number): boolean {
    const caja = new Phaser.Geom.Rectangle(x - 4, y - 5, 8, 5);
    return this.obstaculos.some(o => Phaser.Geom.Rectangle.Overlaps(o, caja));
  }

  update(_tiempo: number, delta: number): void {
    const dt = delta / 1000;
    let dx = 0;
    let dy = 0;
    if (this.cursores.left.isDown || this.teclas.izq.isDown) dx -= 1;
    if (this.cursores.right.isDown || this.teclas.der.isDown) dx += 1;
    if (this.cursores.up.isDown || this.teclas.arriba.isDown) dy -= 1;
    if (this.cursores.down.isDown || this.teclas.abajo.isDown) dy += 1;

    if (dx !== 0 || dy !== 0) {
      this.destino = null;
      this.zonaPendiente = null;
    } else if (this.destino) {
      const falta = new Phaser.Math.Vector2(this.destino.x - this.jugador.x, this.destino.y - this.jugador.y);
      if (falta.length() < 2) {
        this.destino = null;
      } else {
        falta.normalize();
        dx = falta.x;
        dy = falta.y;
      }
    }

    const mueve = dx !== 0 || dy !== 0;
    if (mueve) {
      const largo = Math.hypot(dx, dy);
      const paso = VELOCIDAD * dt;
      const nx = this.jugador.x + (dx / largo) * paso;
      const ny = this.jugador.y + (dy / largo) * paso;
      if (!this.choca(nx, this.jugador.y)) this.jugador.x = Phaser.Math.Clamp(nx, 10, ANCHO - 10);
      if (!this.choca(this.jugador.x, ny)) this.jugador.y = Phaser.Math.Clamp(ny, 24, ALTO - 1);

      if (Math.abs(dx) > Math.abs(dy)) {
        this.direccion = "lado";
        this.jugador.setFlipX(dx < 0);
      } else {
        this.direccion = dy > 0 ? "abajo" : "arriba";
        this.jugador.setFlipX(false);
      }
      this.jugador.anims.play(`caminar_${this.direccion}`, true);
    } else {
      this.jugador.anims.stop();
      this.jugador.setTexture(`pj_${this.direccion}_1`);
    }

    // Si el camino hacia un punto toca un obstaculo, se deja el destino en vez de empujar contra la pared
    if (this.destino) {
      const movido = Math.hypot(this.jugador.x - this.ultimoX, this.jugador.y - this.ultimoY);
      this.sinMover = movido < 0.01 ? this.sinMover + dt : 0;
      if (this.sinMover > 0.25) {
        this.destino = null;
        this.sinMover = 0;
      }
    }
    this.ultimoX = this.jugador.x;
    this.ultimoY = this.jugador.y;

    this.jugador.setDepth(this.jugador.y);

    const zona = this.zonaCercana();
    if (zona !== this.zonaActual) {
      this.zonaActual = zona;
      ponerAviso(zona ? zona.aviso : null);
      if (!zona) ocultarDialogo();
    }
    if (zona && this.zonaPendiente === zona && !this.destino) {
      this.zonaPendiente = null;
      zona.accion();
    }
  }
}
