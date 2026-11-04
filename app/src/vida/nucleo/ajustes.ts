/* Todos los numeros ajustables de la simulacion, en un solo sitio. Estan documentados en docs/vida-artificial-plan.md. */

export const AJ = {
  /** Paso de simulacion normal, en segundos. */
  dt: 0.25,
  /** Ancho de la habitacion, en unidades (una criatura camina unas 70 por segundo). */
  ancho: 1600,

  /* --- Cuerpo --- */
  velCaminar: 70,
  velCorrer: 135,
  alcance: 38,
  /** Subida por segundo de cada necesidad (con metabolismo 1). */
  hambre: 0.0016,
  sueno: 0.001,
  suenoDormido: -0.006,
  aburrimiento: 0.004,
  soledad: 0.0018,
  dolorCae: 0.03,
  saludCura: 0.0015,
  saludHambre: 0.002,

  /* --- Percepcion (unidades) --- */
  vista: 360,
  olfato: 760,
  oido: 1000,

  /* --- Memoria asociativa --- */
  /** Anchura de la semejanza entre dos cosas: cuanto mas grande, mas generaliza. */
  sigma: 0.24,
  /** Dos recuerdos con mas semejanza que esto se funden en uno. */
  fusion: 0.82,
  capacidad: 90,
  /** Vida media (segundos) de un recuerdo que no se usa, con memoria 1. */
  vidaMedia: 3 * 3600,
  /** Minimo de lo que cambia un recuerdo con cada experiencia nueva (con plasticidad 1). */
  alfaMin: 0.3,
  /** Segundos que una accion puede recibir credito por lo que pasa despues. */
  ventanaCausal: 9,
  tauCausal: 3.5,

  /* --- Red --- */
  ocultas: 12,
  lrRed: 0.12,
  olvidoRed: 0.00002,

  /* --- Decision --- */
  reconsiderar: 0.5,
  histeresis: 0.1,
  temperatura: 0.07,
  costeViaje: 0.0002,
  pesoSacia: 2.2,
  pesoDano: 1.7,
  bonoCuriosidad: 0.9,
  /** Cuanto vale, con un vinculo fuerte, ver bajar la angustia de otra criatura (se multiplica por 0,15 mas el afecto). */
  pesoAlivio: 2.4,
  /** Reconocimiento por rasgos: cuanto se parece lo que ve a lo que recuerda de alguien para tomarla por ella (menor es mas exigente). */
  sigmaReconocer: 0.07,
  /** Cuanto atrae acercarse a alguien conocido (se multiplica por el afecto y por 0,3 mas la soledad). */
  pesoFamiliar: 0.9,
  /** Cuanto cuenta de lo que consigue otra con una accion, frente a si lo hubiera hecho uno (aprendizaje por observacion). */
  pesoVicario: 0.55,

  /* --- Habituacion: repetir lo mismo entretiene cada vez menos y se recupera con el descanso --- */
  /** Segundos que tarda en olvidarse la repeticion reciente. */
  habituacionTau: 20,
  /** Cuanto cansa cada repeticion (con 10 seguidas, el maximo). */
  habituacionPaso: 0.08,
  /** Lo maximo que baja la diversion esperada de algo que se acaba de repetir mucho (0.6 = al 40 %). */
  habituacionMax: 0.6,

  /* --- Personalidad --- */
  /** Cuanto puede alejarse un rasgo vivido de su predisposicion genetica. */
  desarrolloMax: 0.45,

  /* --- Memoria legible --- */
  maxEpisodios: 160,

  /* --- Simulacion fuera de linea --- */
  topeFueraDeLinea: 8 * 3600,
  dtFueraDeLinea: 1,
};
