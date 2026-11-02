import Phaser from "phaser";
import type { Expresion } from "../arte/chibis.ts";

/* Un muñeco con vida: respira, parpadea, camina, salta y cambia de cara. Sirve igual para el menu, el puzzle y las habitaciones.
   Si algun dia hay arte real (un solo PNG por personaje), las expresiones se quedan en la misma imagen y solo cambian los movimientos. */
export class ChibiVivo extends Phaser.GameObjects.Container {
  id: string;
  img: Phaser.GameObjects.Image;
  sombra: Phaser.GameObjects.Ellipse;
  escalaBase: number;
  private respira?: Phaser.Tweens.Tween;
  private parpadeo?: Phaser.Time.TimerEvent;
  private caminando?: Phaser.Tweens.Tween;
  private balanceo?: Phaser.Tweens.Tween;
  private cara: Expresion = "idle";
  private reaccion?: Phaser.Time.TimerEvent;
  private tienePose: boolean;

  constructor(escena: Phaser.Scene, x: number, y: number, id: string, escala = 1) {
    super(escena, x, y);
    this.id = id;
    this.escalaBase = escala;
    this.tienePose = escena.textures.exists(`chibi:${id}:blink`);
    this.sombra = escena.add.ellipse(0, 0, 150, 26, 0x2a1545, 0.3);
    this.img = escena.add.image(0, 0, `chibi:${id}:idle`).setOrigin(0.5, 0.94);
    this.add([this.sombra, this.img]);
    this.setScale(escala);
    escena.add.existing(this);
    this.vivir();
  }

  private vivir(): void {
    const e = this.scene;
    this.respira = e.tweens.add({ targets: this.img, scaleY: 1.035, scaleX: 0.985, duration: 1300 + Math.random() * 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: Math.random() * 900 });
    if (this.tienePose) {
      const siguiente = (): void => {
        this.parpadeo = e.time.delayedCall(1800 + Math.random() * 3200, () => {
          if (this.cara === "idle") { this.img.setTexture(`chibi:${this.id}:blink`); e.time.delayedCall(130, () => { if (this.cara === "idle") this.img.setTexture(`chibi:${this.id}:idle`); }); }
          siguiente();
        });
      };
      siguiente();
    }
  }

  expresion(x: Expresion, ms = 0): void {
    this.cara = x;
    if (this.tienePose) this.img.setTexture(`chibi:${this.id}:${x}`);
    this.reaccion?.remove();
    if (ms > 0 && x !== "idle") this.reaccion = this.scene.time.delayedCall(ms, () => this.expresion("idle"));
  }

  /** Salto corto con cambio de cara: seleccion, acierto, saludo. */
  saltar(altura = 36, cara: Expresion = "feliz"): void {
    this.expresion(cara, 900);
    this.scene.tweens.add({ targets: this.img, y: -altura, duration: 160, yoyo: true, ease: "Quad.easeOut" });
    this.scene.tweens.add({ targets: this.sombra, scaleX: 0.75, duration: 160, yoyo: true });
  }

  victoria(): void {
    this.expresion("feliz", 3000);
    this.scene.tweens.add({ targets: this.img, y: -46, duration: 220, yoyo: true, repeat: 3, ease: "Quad.easeOut" });
    this.scene.tweens.add({ targets: this.img, angle: { from: -8, to: 8 }, duration: 180, yoyo: true, repeat: 5, onComplete: () => this.img.setAngle(0) });
  }

  derrota(): void {
    this.expresion("dolor", 4000);
    this.scene.tweens.add({ targets: this.img, scaleY: 0.86, scaleX: 1.08, duration: 260, yoyo: true, ease: "Quad.easeOut" });
  }

  poder(): void {
    this.expresion("poder", 1400);
    this.scene.tweens.add({ targets: this.img, scale: 1.18, duration: 140, yoyo: true, repeat: 1, ease: "Back.easeOut" });
  }

  /** Camina hasta x (coordenadas del mundo) y avisa al llegar. */
  caminar(x: number, ms: number, alLlegar?: () => void): void {
    this.caminando?.remove();
    this.balanceo?.remove();
    const dir = x >= this.x ? 1 : -1;
    this.img.setFlipX(dir < 0);
    this.balanceo = this.scene.tweens.add({ targets: this.img, angle: { from: -4, to: 4 }, y: { from: 0, to: -10 }, duration: 220, yoyo: true, repeat: -1 });
    this.caminando = this.scene.tweens.add({
      targets: this, x, duration: ms, ease: "Linear",
      onComplete: () => { this.balanceo?.remove(); this.img.setAngle(0).setY(0); alLlegar?.(); },
    });
  }

  quieto(): void {
    this.caminando?.remove();
    this.balanceo?.remove();
    this.img.setAngle(0).setY(0);
  }

  destruirTodo(): void {
    this.respira?.remove();
    this.parpadeo?.remove();
    this.caminando?.remove();
    this.balanceo?.remove();
    this.reaccion?.remove();
    this.destroy();
  }
}
