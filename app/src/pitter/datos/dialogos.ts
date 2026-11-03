/* Lo que dice un personaje al entrar el jugador en su habitacion. Una sola frase por entrada, y nunca la misma dos veces seguidas.
   Cada personaje tiene la suya (la de siempre), y ademas hay frases por situacion: la habitacion, los muebles que tiene y con quien vive. */

const PROPIAS: Record<string, string[]> = {
  "bull": ["Aquí me quedo. Pasa tú si quieres.", "No me muevo de este sitio."],
  "garra": ["Te vi llegar desde la ventana.", "Hoy no he salido. Tampoco lo necesito."],
  "baraja": ["Justo pensaba en ti. Saca una carta.", "Hoy las cartas decían que vendrías."],
  "ocevat": ["El refugio está en orden. Puedes descansar.", "Todo en su sitio. Es lo único que pido."],
  "verdam": ["Huelo lluvia. Hoy no salgo.", "Llevo un rato quieto, mirando."],
  "gareth": ["Siéntate, que ya te sirvo algo.", "Aquí también se escucha, si hace falta."],
  "ceniza-coronada": ["Llegas tarde. Tampoco importa.", "Esta habitación es lo más cerca que he estado de un trono."],
  "rook": ["Si vienes con más gente, me quedo quieto.", "Prefiero hablar de uno en uno."],
  "dagren": ["Otra vez tú. Bien, pasa.", "Otra vez por aquí. Siéntate un rato."],
  "sir-buffolet": ["Cuidado con el suelo. Fue un conjuro.", "Ensayo un conjuro nuevo. Casi seguro que sale."],
  "edge": ["Qué rápido has llegado.", "No me dio tiempo ni a sentarme."],
  "torvrena": ["No hagas ruido, preparo una cosa.", "Esta noche toca salir de caza."],
  "ryn": ["Llevas un rato por la zona. Te vi.", "Duermo poco y se nota."],
  "hooey-magoo": ["¿Hay algo que cargar hoy?", "Dime qué hay que cargar y cuánto pagan."],
  "cassius-coldgrave": ["Mira qué bien. Ahora cuéntame qué quieres.", "Tengo un trato que te va a encantar."],
  "adam-kovacs": ["Informe. Aquí todo en su sitio.", "Siéntate. Aquí no hace falta formalidad."],
};

const GENERALES = [
  "Ya estás aquí.", "Pasa, no te quedes en la puerta.", "Qué bien que vengas.", "Hoy ha estado tranquilo.", "Me alegra verte.",
  "Se te echaba de menos.", "Siéntete como en casa.", "Cuéntame cómo te ha ido.", "No esperaba visita.", "Tengo la habitación como me gusta.",
  "Justo a tiempo.", "Qué rara es la casa cuando está vacía.", "Hoy me he levantado con buen pie.",
];

const PAREJA = [
  "{otro} ha vuelto a ocupar mi sitio.", "{otro} y yo casi nunca coincidimos, pero aquí cabemos.", "Si buscabas a {otro}, está ahí mismo.",
  "{otro} no ha dicho nada en toda la mañana.", "{otro} está muy callado hoy.", "{otro} dice que tú traes la suerte.",
];

const MUEBLES: Record<string, string[]> = {
  cama: ["La cama es lo mejor de esta habitación.", "Esta noche he dormido como hacía tiempo que no."],
  mesa: ["Me debes una partida de dados.", "En esa mesa nadie gana dos veces seguidas."],
  sillon: ["Ese sillón ya tiene mi forma.", "Me he quedado dormido en el sillón otra vez."],
  estante: ["He movido unos libros. Seguro que ni lo notas.", "En el estante hay algo que no me atrevo a abrir."],
  planta: ["Hay que regar la planta. Alguien tiene que hacerlo.", "La planta crece más cuando le hablo."],
  lampara: ["Esa lámpara da muy buena luz.", "Con la lámpara encendida se lee mejor."],
  alfombra: ["Cuidado con la alfombra, resbala.", "La alfombra es nueva. O eso me parece."],
  cuadro: ["Ese cuadro no lo puse yo.", "Siempre pienso que el cuadro está torcido."],
};

const recientes: string[] = [];

function elegir<T>(lista: T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}

export interface ContextoDialogo {
  /** Quien habla y sus compañeros de habitacion, con su nombre de pila. */
  hablante: { id: string; nombre: string };
  otro?: { id: string; nombre: string };
  muebles: string[];
}

/* Devuelve una frase para el hablante. Evita repetir las ultimas 24 que se dijeron. */
export function fraseDeEntrada(c: ContextoDialogo): string {
  const intentos: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = Math.random();
    let candidatas: string[];
    if (r < 0.4 && PROPIAS[c.hablante.id]) candidatas = PROPIAS[c.hablante.id];
    else if (r < 0.6 && c.muebles.length) { const m = elegir(c.muebles); candidatas = MUEBLES[m] ?? GENERALES; }
    else if (r < 0.75 && c.otro) candidatas = PAREJA.map((f) => f.replace("{otro}", c.otro?.nombre ?? ""));
    else candidatas = GENERALES;
    const f = elegir(candidatas);
    intentos.push(f);
    if (!recientes.includes(f)) { recordar(f); return f; }
  }
  const f = intentos[0];
  recordar(f);
  return f;
}

function recordar(f: string): void {
  recientes.push(f);
  while (recientes.length > 24) recientes.shift();
}
