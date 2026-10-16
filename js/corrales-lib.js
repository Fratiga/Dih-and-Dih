/* Corrales: lo que comparten Mi habitación (el aviso de crías listas) y la pantalla de Corrales (js/corrales.js).
   Toda la lógica (parejas, fases, límites, sobrepoblación) vive en el servidor (docs/economia-18_crianza.sql); aquí está el dibujo de cada
   hábitat, el reloj del servidor y el cálculo del estado de cada corral, para que haya un solo sitio donde se decide. */
window.Corrales = (function () {
  const ORDEN = ["aviario", "bosque", "madriguera", "pantano", "glaciar", "cubil"];
  const RAREZAS = { comun: "común", infrecuente: "poco común", rara: "rara", legendaria: "legendaria", limitada: "limitada" };

  // El dibujo de cada hábitat (120 x 100)
  const ARTE = {
    aviario: () => `<rect width="120" height="100" fill="#3c5a82"/><rect x="10" y="12" width="28" height="8" fill="#dbe8f5"/><rect x="18" y="6" width="16" height="8" fill="#dbe8f5"/><rect x="78" y="24" width="30" height="8" fill="#dbe8f5"/><rect x="86" y="18" width="14" height="8" fill="#dbe8f5"/>
      <rect x="0" y="82" width="120" height="18" fill="#7a5a3a"/><rect x="12" y="56" width="96" height="5" fill="#8d6a45"/><rect x="22" y="44" width="5" height="12" fill="#6b4a2f"/><rect x="92" y="44" width="5" height="12" fill="#6b4a2f"/>
      <rect x="0" y="0" width="3" height="82" fill="#c9c2d6"/><rect x="117" y="0" width="3" height="82" fill="#c9c2d6"/><rect x="40" y="0" width="2" height="30" fill="#c9c2d6" opacity=".5"/><rect x="78" y="0" width="2" height="30" fill="#c9c2d6" opacity=".5"/>`,
    bosque: () => `<rect width="120" height="100" fill="#3f6b3a"/><rect y="70" width="120" height="30" fill="#34592f"/>
      <rect x="12" y="30" width="8" height="34" fill="#5a3d28"/><rect x="2" y="12" width="28" height="22" fill="#2a4f2a"/><rect x="8" y="4" width="16" height="12" fill="#2a4f2a"/>
      <rect x="96" y="36" width="8" height="30" fill="#5a3d28"/><rect x="88" y="20" width="24" height="20" fill="#2a4f2a"/>
      <rect x="44" y="68" width="34" height="14" fill="#d4b24a"/><rect x="44" y="68" width="34" height="3" fill="#ecd275"/>`,
    madriguera: () => `<rect width="120" height="100" fill="#5b4331"/><rect y="0" width="120" height="16" fill="#6b5039"/><rect x="0" y="16" width="120" height="3" fill="#3f2d20"/>
      <rect x="30" y="46" width="60" height="38" fill="#7a5a3f"/><rect x="42" y="54" width="36" height="30" fill="#1a110b"/><rect x="50" y="48" width="20" height="8" fill="#1a110b"/>
      <rect x="8" y="64" width="16" height="6" fill="#3f2d20"/><rect x="96" y="30" width="14" height="6" fill="#3f2d20"/><rect x="94" y="72" width="18" height="8" fill="#8a6a4a"/>`,
    pantano: () => `<rect width="120" height="100" fill="#3d5a3a"/><rect y="34" width="120" height="66" fill="#2f5c5a"/><rect x="10" y="48" width="30" height="3" fill="#4c8a86"/><rect x="60" y="62" width="40" height="3" fill="#4c8a86"/><rect x="24" y="76" width="34" height="3" fill="#4c8a86"/>
      <rect x="8" y="14" width="3" height="40" fill="#6aa04a"/><rect x="14" y="8" width="3" height="46" fill="#7fb85a"/><rect x="104" y="12" width="3" height="42" fill="#6aa04a"/><rect x="110" y="20" width="3" height="34" fill="#7fb85a"/>
      <rect x="70" y="44" width="16" height="6" fill="#4f9a45"/><rect x="40" y="58" width="12" height="5" fill="#4f9a45"/>`,
    glaciar: () => `<rect width="120" height="100" fill="#a6cde3"/><rect y="70" width="120" height="30" fill="#e9f4fa"/>
      <rect x="10" y="40" width="30" height="40" fill="#7fb4d4"/><rect x="16" y="30" width="18" height="12" fill="#9fc8e0"/><rect x="82" y="46" width="28" height="34" fill="#7fb4d4"/><rect x="88" y="38" width="16" height="10" fill="#9fc8e0"/>
      <polygon points="0,0 14,0 7,20" fill="#dff1fa"/><polygon points="40,0 56,0 48,24" fill="#dff1fa"/><polygon points="84,0 100,0 92,18" fill="#dff1fa"/><rect x="50" y="64" width="22" height="10" fill="#fff"/>`,
    cubil: () => `<rect width="120" height="100" fill="#4a3028"/><rect y="64" width="120" height="36" fill="#3a2420"/>
      <rect x="6" y="30" width="30" height="40" fill="#6b6370"/><rect x="12" y="22" width="18" height="12" fill="#857d8c"/><rect x="88" y="38" width="26" height="34" fill="#6b6370"/><rect x="94" y="30" width="14" height="10" fill="#857d8c"/>
      <rect x="48" y="52" width="24" height="28" fill="#d9c9a0"/><rect x="52" y="46" width="16" height="8" fill="#d9c9a0"/><rect x="54" y="60" width="4" height="4" fill="#a8956a"/><rect x="62" y="70" width="4" height="4" fill="#a8956a"/>
      <rect x="40" y="84" width="40" height="8" fill="#e0662a" opacity=".8"/>`
  };
  // Dos bichos genéricos que aparecen cuando hay una pareja en el corral
  const BICHOS = `<g class="hb-bichos"><g class="hb-bicho"><rect x="30" y="58" width="16" height="9"/><rect x="44" y="52" width="8" height="8"/><rect x="32" y="67" width="3" height="5"/><rect x="42" y="67" width="3" height="5"/></g>
    <g class="hb-bicho hb-b2"><rect x="72" y="58" width="16" height="9"/><rect x="68" y="52" width="8" height="8"/><rect x="74" y="67" width="3" height="5"/><rect x="84" y="67" width="3" height="5"/></g></g>`;

  let ver = null, offset = 0, cargando = null;
  const ahora = () => Date.now() + offset;

  function dur(ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (d) return `${d} d ${h} h`;
    if (h) return `${h} h ${String(m).padStart(2, "0")} min`;
    if (m) return `${m} min ${String(r).padStart(2, "0")} s`;
    return `${r} s`;
  }
  const horasTxt = h => h >= 1 ? `${Math.round(h * 10) / 10} h` : `${Math.round(h * 60)} min`;

  async function rpc(nombre, args) {
    const { data, error } = await (await fichasCliente()).rpc(nombre, args || {});
    if (error) throw error;
    return data;
  }

  /* Lee los corrales del servidor (cartas_corral_ver) y sincroniza el reloj con el suyo. Si ya hay una lectura en curso, la comparte. */
  function cargar() {
    if (cargando) return cargando;
    cargando = rpc("cartas_corral_ver").then(v => {
      ver = v;
      offset = Date.parse(v.ahora) - Date.now();
      return v;
    }).finally(() => { cargando = null; });
    return cargando;
  }

  /* Estado de un corral: en cría, lista, descansando, con parejas disponibles o vacío */
  function estado(c) {
    const cria = c.cria;
    if (cria) {
      const ini = Date.parse(cria.inicio), fin = Date.parse(cria.fin), t = ahora();
      if (t >= fin) return { tipo: "listo", prog: 1, texto: "¡LISTA!", ini, fin };
      return { tipo: "cria", prog: (t - ini) / (fin - ini), texto: dur(fin - t), ini, fin };
    }
    if (c.descanso_hasta && Date.parse(c.descanso_hasta) > ahora()) return { tipo: "descanso", prog: 0, texto: "Descansa " + dur(Date.parse(c.descanso_hasta) - ahora()) };
    const especies = ver.especies.filter(e => e.habitat === c.habitat);
    const lista = especies.filter(e => e.libres.length >= 2 && !e.sobrepoblada && e.en_circulacion);
    if (lista.length) return { tipo: "disponible", prog: 0, texto: "PUEDES CRIAR" };
    return { tipo: "vacio", prog: 0, texto: especies.length ? "FALTA UNA PAREJA" : "SIN ESPECIES" };
  }

  return { ORDEN, RAREZAS, ARTE, BICHOS, ahora, dur, horasTxt, rpc, cargar, estado, ver: () => ver };
})();
