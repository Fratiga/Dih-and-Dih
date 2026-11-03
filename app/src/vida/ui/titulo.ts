/* La pantalla de titulo, con la sala viva de fondo, y el paso al juego con las puertas de seguridad. */

import { sonido } from "../audio/audio.ts";
import { borrarGuardado } from "../guardado.ts";
import { boton, esperar, h } from "./base.ts";
import { abrirLaboratorio } from "./labDev.ts";

export interface OpcionesTitulo {
  hayGuardado: boolean;
  /** Entra al juego. `nuevo` descarta lo guardado. Puede tardar (simula el tiempo fuera de linea). */
  entrar(nuevo: boolean, alAvance: (txt: string) => void): Promise<void>;
}

export function pantallaTitulo(raiz: HTMLElement, o: OpcionesTitulo): void {
  const puertas = h("div", { clase: "va-puertas" }, h("div", { clase: "va-puerta" }), h("div", { clase: "va-puerta" }));
  raiz.append(puertas);
  const menu = h("div", { clase: "va-menu" });
  // eslint-disable-next-line prefer-const
  let t: HTMLElement;
  /** Las puertas se cierran, se retira el titulo y se abren para dejar ver la sala. */
  const pasar = async (): Promise<void> => {
    puertas.classList.add("activa", "abre");
    void puertas.offsetWidth;
    sonido.puerta();
    puertas.classList.remove("abre");
    await esperar(1050);
    t.remove();
    await esperar(150);
    puertas.classList.add("abre");
    await esperar(1050);
    puertas.remove();
  };
  const empezar = async (b: HTMLButtonElement, nuevo: boolean): Promise<void> => {
    sonido.iniciar();
    const texto = b.textContent ?? "";
    await o.entrar(nuevo, (x) => { b.textContent = x; });
    b.textContent = texto;
    await pasar();
  };
  if (o.hayGuardado) {
    menu.append(boton("Continuar", (b) => empezar(b, false), { clase: "va-btn-lleno" }));
    let seguro = false;
    const nuevo = boton("Nuevo ensayo", (b) => {
      if (!seguro) {
        seguro = true;
        b.textContent = "¿Seguro? Se borra el ensayo actual";
        b.classList.add("va-confirma");
        window.setTimeout(() => { seguro = false; b.textContent = "Nuevo ensayo"; b.classList.remove("va-confirma"); }, 4000);
        return;
      }
      borrarGuardado();
      return empezar(b, true);
    });
    menu.append(nuevo);
  } else {
    menu.append(boton("Empezar el ensayo", (b) => empezar(b, true), { clase: "va-btn-lleno" }));
  }
  menu.append(boton("Laboratorio de pruebas", () => { sonido.iniciar(); abrirLaboratorio(raiz); }));
  menu.append(boton("Volver a los minijuegos", () => { window.location.href = "../../minijuegos.html"; }, { silencioso: true }));

  t = h("div", { clase: "va-titulo" },
    h("h1", {}, "VIDA", h("b", {}, "·"), "ARTIFICIAL"),
    h("p", { clase: "va-lema" }, "Criaturas que aprenden de lo que viven."),
    menu,
    h("p", { clase: "va-nota" }, "Dos criaturas nacen iguales. Lo que les pase en esta sala las hará distintas. Puedes mirar sin intervenir o enseñarles con objetos, premios y sustos."),
  );
  raiz.append(t);
}
