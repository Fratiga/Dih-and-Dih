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
  /** Entradas ampliables de la red (a la derecha de las de siempre). Con 0 todo es igual que antes; con cualquier valor, una criatura que no use las nuevas se comporta igual
      (probado en tests/vida.test.ts, y con EXTRA=4 en toda la regresion). Cada capacidad con verbos o sensores nuevos sube este numero. */
  entradasExtra: 0,
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
  /** Cuanto empuja a probar a empujar a otra criatura el caracter agresivo (por encima de 0,4), mientras no sepa si compensa. */
  /** Probabilidad de una camada de dos y de tres crias (el resto, una). Cada cria tiene su propio genoma: mellizos, no gemelos identicos. */
  camadaDos: 0.17,
  camadaTres: 0.03,
  /** Cuanto cuenta, al acercarse a alguien, el gusto aprendido por su aspecto y su conducta. */
  pesoGusto: 1.0,
  /** Cuanto cambia un gusto con cada experiencia buena o mala con alguien que tiene ese rasgo. */
  pasoGusto: 0.12,
  /** Cuanto empuja a atacar a una criatura debil el hambre, saber que la carne alimenta y que atacar ya ha dado comida. */
  pesoPresa: 24,
  /** Reproduccion autonoma. El impulso sube por segundo en una adulta; la gestacion dura estos segundos; en una sala caben tantas criaturas vivas. */
  impulsoTasa: 0.0008,
  gestacion: 400,
  maxCriaturasSala: 4,
  /** Cuanto empuja a buscar pareja el impulso. */
  pesoCortejo: 1.6,
  /** Lo que hace falta de deseo para aceptar, y cuanto pesan afecto, gusto, impulso propio y aversion en ese deseo. */
  umbralAceptacion: 0.45,
  pesoAfectoDeseo: 0.8,
  pesoGustoDeseo: 0.4,
  pesoAversionDeseo: 0.9,
  /** Cuanto sube la aversion por sexo y por individuo con un castigo justo despues de un cortejo, y cuanto baja con un premio. */
  pasoAversionSexo: 0.25,
  pasoAversionInd: 0.3,
  /** Cuanto cambia el peso de una reaccion al rechazo con un premio (sube) o un susto (baja) justo despues de tenerla. */
  pasoReaccion: 0.6,
  /** Fatiga de combate: cuanto sube con cada golpe dado o recibido, lo que tarda en bajar (segundos, mas si esta herida o asustada y si es agresiva) y cuanto frena empujar
      a otra y empuja a descansar. Con fatiga alta la frustracion tambien se calma mas deprisa. */
  fatigaPorGolpeDado: 0.05,
  fatigaPorGolpeRecibido: 0.08,
  tauFatiga: 60,
  pesoFatiga: 4,
  pesoDescansoFatiga: 1.2,
  /** Atencion social (social.ts): hasta donde, a que velocidad maxima, cuanto tiene que durar y cuanto puede cortarse sin que deje de contar. */
  atencionAlcance: 170,
  atencionVelocidad: 60,
  atencionPermanencia: 3,
  atencionContinuidad: 1.5,
  /** Celos: afecto minimo por quien atiende a otra para que cuente como vinculo significativo, rapidez con que suben, lo que tardan en irse (s), y cuanto pesan al
      decidir: acercarse a su vinculo, no jugar ni explorar, y (solo agresiva y enfadada) empujar a la tercera. */
  umbralVinculoCelos: 0.3,
  tasaCelos: 0.05,
  tauCelos: 70,
  pesoCelosAcercar: 1.5,
  pesoCelosInhibe: 0.6,
  pesoCelosAgresion: 2.0,
  /** Envidia (solo alimento): hambre minima para desear lo que otra come, cuanto sube con cada bocado visto, lo que tarda en irse (s), y cuanto pesa al decidir:
      acercarse a quien come, buscar otro alimento, no jugar ni explorar ni descansar, y (solo agresiva y enfadada) empujar al poseedor. */
  umbralHambreEnvidia: 0.3,
  tasaEnvidia: 0.35,
  tauEnvidia: 45,
  ventanaAccesoPropio: 10,
  pesoEnvidiaAcercar: 1.2,
  pesoEnvidiaBuscar: 0.8,
  pesoEnvidiaInhibe: 0.5,
  pesoEnvidiaAgresion: 2.0,
  pesoAgresion: 0.8,
  /** Cuanto cuesta intentar comer lo que otra esta comiendo (con el conflicto por comida). */
  penaOcupada: 0.5,
  /** Cuanto empuja a empujar ver a otra comiendo estando hambrienta, segun el caracter. */
  pesoDisputa: 1.6,
  /** Cuanto empuja a responder haber sido golpeada hace poco. */
  pesoRepresalia: 5,
  /** Segundos que tarda en olvidarse a medias el dano intercambiado con otra criatura. */
  olvidoAgravio: 300,
  /** Cuanto empuja a empujar a otra la frustracion (por quedarse sin lo que esperaba) en un caracter agresivo. */
  pesoFrustracionAgresion: 1.5,
  /** Cuanto frena empujar a otra el afecto que se le tiene. */
  frenoAfectoAgresion: 1.4,

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
