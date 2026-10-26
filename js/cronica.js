/* =============================================================================
   CRÓNICA DEL MUNDO: las frases. El servidor (docs/cronica-1_base.sql) guarda de cada suceso solo su tipo y sus cifras; aquí se convierten en una línea de texto.
   Cada tipo tiene varias formas y se elige una con el número del suceso, así el mismo suceso se lee siempre igual y la lista no repite la misma frase.
   Cambiar una frase no toca la base de datos. Las frases son llanas y concretas a propósito.
   Uso: Cronica.linea(suceso) devuelve { icono, texto, enlace, mio } o null si no se sabe contar ese tipo. El texto NO viene escapado: quien lo pinte debe escaparlo.
   Se usa en la taberna (js/cronica-taberna.js) y en el panel de Admin (js/admin-cronica.js).
============================================================================= */
(function (raiz) {
  const num = n => Number(n || 0).toLocaleString("es");
  const mult = v => String(v ?? "").replace(".", ",");
  const elegir = (id, lista) => lista[Math.abs(Number(id) || 0) % lista.length];
  const lista = a => {
    a = (a || []).filter(Boolean);
    return a.length < 2 ? (a[0] || "") : a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
  };
  /* [{ nombre, n }] → «2 × Kobold y Draco» */
  const cartas = arr => lista((arr || []).map(c => (c.n > 1 ? `${c.n} × ` : "") + (c.nombre || c.carta_id || "una carta")));
  const nombres = v => (Array.isArray(v) ? lista(v) : String(v || "una criatura"));
  const quien = s => s.user || "Alguien";

  const FRASES = {
    carta_ganada: s => {
      const d = s.datos || {};
      if (d.resumen) return `${quien(s)} ha ganado ${num(d.n)} cartas raras hoy.`;
      const c = (d.nombre || "una carta") + (d.numero ? ` (copia n.º ${d.numero})` : "");
      if (d.origen === "forja") return elegir(s.id, [`${quien(s)} forjó ${c}.`, `${c} salió de la forja de ${quien(s)}.`]);
      if (d.origen === "pozo") return elegir(s.id, [`${quien(s)} se llevó ${c} del pozo de Las Veintiuna Velas.`, `${c} salió del pozo de Las Veintiuna Velas y es de ${quien(s)}.`]);
      if (d.origen === "apuesta") return elegir(s.id, [`${quien(s)} ganó ${c} en una apuesta de cartas.`, `${quien(s)} se quedó con ${c} tras una apuesta de cartas.`]);
      if (d.origen === "sellos") return elegir(s.id, [`${quien(s)} cambió sus sellos por ${c}.`, `${quien(s)} ganó ${c} con sus sellos.`]);
      return elegir(s.id, [`${quien(s)} ganó ${c}.`, `${quien(s)} se hizo con ${c}.`, `${c} tiene dueño nuevo: ${quien(s)}.`]);
    },
    intercambio: s => {
      const d = s.datos || {};
      return elegir(s.id, [
        `Se cerró un intercambio: ${cartas(d.dio)} por ${cartas(d.recibio)}.`,
        `${cartas(d.dio)} cambió de manos por ${cartas(d.recibio)}.`,
        `Alguien dio ${cartas(d.dio)} y se llevó ${cartas(d.recibio)}.`
      ]);
    },
    cria_nacida: s => {
      const d = s.datos || {};
      if (d.primera) return elegir(s.id, [`Nació la primera cría de ${d.nombre} del mundo.`, `En un corral nació la primera cría de ${d.nombre}.`]);
      return elegir(s.id, [`Nació una cría de ${d.nombre}.`, `Un corral dio una cría de ${d.nombre}.`]);
    },
    apuesta_hipodromo: s => {
      const d = s.datos || {};
      const una = `${quien(s)} apostó ${num(d.monto)} tokens de juego por ${nombres(d.criaturas)} y cobró ${num(d.pago)} (${mult(d.mult)} veces).`;
      if (Array.isArray(d.criaturas) && d.criaturas.length > 1) return una;
      return elegir(s.id, [una, `${nombres(d.criaturas)} pagó ${mult(d.mult)} veces a ${quien(s)}: ${num(d.monto)} se convirtieron en ${num(d.pago)}.`]);
    },
    apuesta_veintiuna: s => {
      const d = s.datos || {};
      return elegir(s.id, [
        `${quien(s)} cobró ${num(d.pago)} tokens de juego en Las Veintiuna Velas con una apuesta de ${num(d.apuesta)} (${mult(d.mult)} veces).`,
        `Mano de ${mult(d.mult)} veces para ${quien(s)} en Las Veintiuna Velas: apostó ${num(d.apuesta)} y se llevó ${num(d.pago)}.`
      ]);
    },
    racha_veintiuna: s => {
      const d = s.datos || {};
      if (d.activa === false) return `La racha de ${quien(s)} en Las Veintiuna Velas terminó en ${d.racha} victorias.` + (d.record ? " Fue la mejor de la mesa." : "");
      return `${quien(s)} lleva ${d.racha} victorias seguidas en Las Veintiuna Velas.` + (d.record ? " Es la mejor racha de la mesa." : "");
    },
    record_hooey: s => {
      const d = s.datos || {};
      return `${quien(s)} tiene ahora la mejor racha de Hooey, ${num(d.racha)}.` + (d.anterior ? ` Le quitó el primer puesto a ${d.anterior}.` : "");
    },
    record_ritmo: s => {
      const d = s.datos || {};
      return `${quien(s)} tomó el primer puesto de «${d.cancion}» (${d.dificultad}) en Zarabanda con ${num(d.puntos)} puntos.` + (d.anterior ? ` Antes lo tenía ${d.anterior}.` : "");
    },
    record_parranda: s => {
      const d = s.datos || {};
      return `${quien(s)} tomó el primer puesto de «${d.cancion}» (${d.dificultad}) en Parranda con ${num(d.puntos)} puntos.` + (d.anterior ? ` Antes lo tenía ${d.anterior}.` : "");
    },
    record_minijuego: s => {
      const d = s.datos || {};
      const juego = d.juego === "arqueria" ? "Arquería" : "Ajedrez";
      return `${quien(s)} pasó a liderar las victorias de ${juego} con ${num(d.victorias)}.` + (d.anterior ? ` Antes lo hacía ${d.anterior}.` : "");
    },
    ultima_vela: s => {
      const d = s.datos || {};
      if (d.resultado === "ganado") return `${quien(s)} le ganó a Cera en La Última Vela, ${d.ganadas} manos a ${d.perdidas}.`;
      return `${quien(s)} cayó ante Cera en La Última Vela (${d.ganadas} a ${d.perdidas}).`;
    },
    logro_oro_veintiuna: s => `${quien(s)} completó el desafío «${(s.datos || {}).nombre}» en Las Veintiuna Velas.`,
    copa_hipodromo: s => {
      const d = s.datos || {};
      return elegir(s.id, [
        `${d.criatura} ganó la ${String(d.copa || "copa").replace(/^La /, "")} y se llevó ${num(d.premio)} tokens de juego. Es de ${quien(s)}.`,
        `La criatura de ${quien(s)}, ${d.criatura}, ganó la ${String(d.copa || "copa").replace(/^La /, "")}.`
      ]);
    },
    nota: s => String((s.datos || {}).texto || "")
  };
  const ICONOS = { carta_ganada: "🃏", intercambio: "⇄", cria_nacida: "🐣", apuesta_hipodromo: "🐎", apuesta_veintiuna: "🕯", racha_veintiuna: "🕯", logro_oro_veintiuna: "🕯", ultima_vela: "🕯", record_hooey: "🏅", record_ritmo: "🏅", record_parranda: "🏅", record_minijuego: "🏅", copa_hipodromo: "🏆", nota: "📜" };

  function linea(s) {
    const f = FRASES[s && s.tipo];
    if (!f) return null;
    let texto = "";
    try { texto = f(s); } catch (e) { return null; }
    if (!texto) return null;
    return { icono: ICONOS[s.tipo] || "•", texto, enlace: s.enlace || "", mio: !!s.yo };
  }

  /* «hace 5 min», «hace 3 h», «ayer», «hace 4 días» */
  function hace(iso, ahora) {
    const t = Date.parse(iso);
    if (isNaN(t)) return "";
    const s = Math.max(0, ((ahora || Date.now()) - t) / 1000);
    if (s < 90) return "ahora mismo";
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    const d = Math.floor(s / 86400);
    return d === 1 ? "ayer" : `hace ${d} días`;
  }

  /* Sucesos de ejemplo para ver cómo queda (index.html?cronica=prueba y la prueba de las frases) */
  const EJEMPLOS = [
    { id: 1, tipo: "racha_veintiuna", user: "Ana", yo: false, actualizado: new Date(Date.now() - 120000).toISOString(), enlace: "veintiuna.html", datos: { racha: 6, activa: true, record: true } },
    { id: 2, tipo: "apuesta_hipodromo", user: "Beto", yo: false, actualizado: new Date(Date.now() - 1800000).toISOString(), enlace: "hipodromo.html", datos: { monto: 100, pago: 650, mult: 6.5, criaturas: ["Brasa"] } },
    { id: 3, tipo: "intercambio", user: null, yo: false, anonimo: true, actualizado: new Date(Date.now() - 5400000).toISOString(), enlace: "intercambios.html", datos: { dio: [{ nombre: "Dragón Dorado", n: 1 }], recibio: [{ nombre: "Kobold", n: 2 }, { nombre: "Draco", n: 1 }] } },
    { id: 4, tipo: "cria_nacida", user: null, yo: true, anonimo: true, actualizado: new Date(Date.now() - 9000000).toISOString(), enlace: "corrales.html", datos: { nombre: "Hidra", primera: true } },
    { id: 5, tipo: "carta_ganada", user: "Caro", yo: false, actualizado: new Date(Date.now() - 14400000).toISOString(), enlace: "cartas.html", datos: { nombre: "El Bufón", numero: 3, origen: "sellos" } },
    { id: 6, tipo: "nota", user: null, yo: false, actualizado: new Date(Date.now() - 90000000).toISOString(), enlace: "compendio.html", datos: { texto: "El puente de Valmar cayó anoche." } }
  ];

  raiz.Cronica = { linea, hace, EJEMPLOS, FRASES };
  if (typeof module !== "undefined" && module.exports) module.exports = raiz.Cronica;
})(typeof window !== "undefined" ? window : globalThis);
