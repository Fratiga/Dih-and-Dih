/* Editor de mapas de Ritmo (solo admin). Carga una canción, genera el mapa automático con el
   mismo análisis que usa el juego (ritmo-analisis.js) y deja corregirlo a mano: poner, mover
   y borrar notas, hacer largas y dobles, elegir qué banda sigue cada tramo y arreglar el
   pulso. Lo guardado va a la tabla ritmo_mapas (scratchpad/ritmo_mapas.sql) y el juego lo
   usa en lugar del automático. */
(function () {
  "use strict";

  const AN = window.RitmoAnalisis;
  const CLAVE_AJUSTES = "compendioRitmoAjustes";
  const COLOR = { arriba: "#8fdcff", abajo: "#e8837b", ambos: "#f2d46b" };
  const COLOR_BANDA = { bajo: "232, 131, 123", medio: "126, 216, 127", alto: "143, 220, 255", vacio: "108, 109, 112" };
  const ETIQUETA_BANDA = { bajo: "graves", medio: "medios", alto: "agudos", vacio: "sin notas" };

  // Franjas del lienzo (px CSS)
  const ALTO = 360;
  const Y_REGLA = [0, 22];
  const Y_TRAMOS = [22, 46];
  const Y_ARRIBA = 96;
  const Y_ABAJO = 186;
  const Y_ONDA = [244, 340];

  const $ = id => document.getElementById(id);
  const lienzo = $("reLienzo");
  const g = lienzo.getContext("2d");
  const cancionEl = $("reCancion");
  const difEl = $("reDif");
  const estadoEl = $("reEstado");
  const playEl = $("rePlay");
  const tiempoEl = $("reTiempo");
  const velEl = $("reVel");
  const snapEl = $("reSnap");
  const zoomEl = $("reZoom");
  const contadorEl = $("reSelCuenta");
  let contadorPrevio = "";

  /* --- Estado ----------------------------------------------------------------- */
  // Las canciones subidas por los DJ son direcciones completas (ya codificadas); las de assets, rutas
  const urlDe = ruta => (/^https?:/i.test(ruta) ? ruta : encodeURI(ruta));
  function cancionDe(ruta) {
    let nombre = (window.MUSICA_NUBE_NOMBRES || {})[ruta];
    if (!nombre) {
      nombre = ruta.split("/").pop();
      try { nombre = decodeURIComponent(nombre); } catch (e) { /* tal cual */ }
      nombre = nombre.replace(/\.[^.]+$/, "");
    }
    return { ruta, nombre };
  }
  const canciones = (window.MUSICA || []).map(cancionDe);

  let audio = null;
  let buffer = null;
  let rutaCargada = "";
  let onda = null; // picos cada 10 ms
  let notas = [];
  let pulsos = [];
  let tramos = [];
  let forzadas = {}; // número de tramo -> banda elegida a mano
  let sel = null; // la última nota tocada
  const seleccion = new Set(); // todas las notas elegidas (Mayús o Ctrl para varias)
  let tramosSel = null; // { a, b }
  let sucio = true; // hay que redibujar
  let cambios = false; // hay cambios sin guardar
  let historial = [];
  let posHistorial = -1;

  // Vista
  let vistaIni = -1;
  let pps = 90;
  let ancho = 800;

  // Reproducción
  let fuente = null;
  let reproduciendo = false;
  let posIni = 0;
  let ctxIni = 0;
  let vel = 1;
  let proxClic = 0;
  let proxPulso = 0;

  const toastEl = $("reToast");
  let toastT = 0;
  function deseleccionar() {
    sel = null;
    seleccion.clear();
  }

  function mensaje(texto, error) {
    estadoEl.textContent = texto;
    estadoEl.classList.toggle("error", !!error);
    if (toastEl) {
      toastEl.textContent = texto;
      toastEl.className = "re-toast visible" + (error ? " error" : "");
      clearTimeout(toastT);
      toastT = setTimeout(() => toastEl.classList.remove("visible"), error ? 6500 : 3800);
    }
  }

  /* --- Lista de canciones y dificultades -------------------------------------- */
  function llenarSelectCanciones() {
    cancionEl.innerHTML = canciones.map((c, i) => `<option value="${i}">${c.nombre.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]))}</option>`).join("");
  }
  llenarSelectCanciones();
  /* Vuelve a leer la lista de canciones (por ejemplo después de subir o quitar una) */
  function recargarCanciones() {
    const actual = canciones[Number(cancionEl.value)] ? canciones[Number(cancionEl.value)].ruta : "";
    canciones.length = 0;
    (window.MUSICA || []).forEach(r => canciones.push(cancionDe(r)));
    llenarSelectCanciones();
    const k = canciones.findIndex(c => c.ruta === actual);
    if (k >= 0) cancionEl.value = String(k);
  }
  window.addEventListener("musica-nube", recargarCanciones);
  difEl.innerHTML = Object.entries(AN.DIFICULTADES).map(([id, d]) => `<option value="${id}">${d.nombre}</option>`).join("");
  try {
    const aj = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}");
    const k = canciones.findIndex(c => c.ruta === aj.ruta);
    if (k >= 0) cancionEl.value = String(k);
    if (aj.dificultad && AN.DIFICULTADES[aj.dificultad]) difEl.value = aj.dificultad;
  } catch (e) { /* sin almacenamiento */ }

  const rutaActual = () => canciones[Number(cancionEl.value)].ruta;
  const difActual = () => difEl.value;

  /* --- Historial ---------------------------------------------------------------- */
  function foto() { return JSON.stringify({ notas, pulsos, forzadas, bandas: tramos.map(t => [t.banda, t.vacio]) }); }
  function aplicarFoto(texto) {
    const f = JSON.parse(texto);
    notas = f.notas; pulsos = f.pulsos; forzadas = f.forzadas || {};
    f.bandas.forEach((b, i) => { if (tramos[i]) { tramos[i].banda = b[0]; tramos[i].vacio = b[1]; } });
    actualizarTramos();
    deseleccionar();
    reiniciarClics();
    sucio = true;
  }
  function guardarFoto() {
    historial = historial.slice(0, posHistorial + 1);
    historial.push(foto());
    if (historial.length > 120) historial.shift();
    posHistorial = historial.length - 1;
    cambios = true;
  }
  function deshacer() { if (posHistorial > 0) { posHistorial--; aplicarFoto(historial[posHistorial]); cambios = true; } }
  function rehacer() { if (posHistorial < historial.length - 1) { posHistorial++; aplicarFoto(historial[posHistorial]); cambios = true; } }

  /* --- Carga del mapa -------------------------------------------------------------- */
  /* Dos volúmenes: la música y los sonidos del editor (clic de notas y metrónomo). Se
     recuerdan entre visitas. */
  const CLAVE_VOL = "compendioRitmoEditorVol";
  let volumenes = { musica: 0.8, clics: 0.6 };
  try { Object.assign(volumenes, JSON.parse(localStorage.getItem(CLAVE_VOL) || "{}")); } catch (e) { /* sin almacenamiento */ }
  let gMusica = null;
  let gClics = null;

  function aplicarVolumenes() {
    if (gMusica) gMusica.gain.value = volumenes.musica;
    if (gClics) gClics.gain.value = volumenes.clics;
  }

  async function prepararAudio() {
    if (!audio) {
      audio = new (window.AudioContext || window.webkitAudioContext)();
      gMusica = audio.createGain();
      gClics = audio.createGain();
      gMusica.connect(audio.destination);
      gClics.connect(audio.destination);
      aplicarVolumenes();
    }
    if (audio.state === "suspended") await audio.resume();
  }

  async function cargarAudio() {
    const ruta = rutaActual();
    if (buffer && rutaCargada === ruta) return;
    detener();
    mensaje("Cargando la canción...");
    await prepararAudio();
    const resp = await fetch(urlDe(ruta));
    if (!resp.ok) throw new Error("No se pudo descargar la canción");
    buffer = await audio.decodeAudioData(await resp.arrayBuffer());
    rutaCargada = ruta;
    // Picos cada 10 ms para dibujar la forma de onda
    const datos = buffer.getChannelData(0);
    const paso = Math.max(1, Math.floor(buffer.sampleRate / 100));
    onda = new Float32Array(Math.ceil(datos.length / paso));
    for (let i = 0; i < onda.length; i++) {
      let m = 0;
      for (let k = i * paso; k < Math.min(datos.length, (i + 1) * paso); k += 4) { const v = Math.abs(datos[k]); if (v > m) m = v; }
      onda[i] = m;
    }
    posIni = 0;
    vistaIni = -1;
    playEl.disabled = false;
  }

  function tomarMapa(m) {
    notas = m.notas.map(n => ({ t: n.t, carril: n.carril, dur: n.dur || 0 }));
    pulsos = m.pulsos.slice();
    tramos = m.tramos.map(t => ({ k0: t.k0, k1: t.k1, banda: t.banda, vacio: t.vacio }));
    forzadas = {};
    deseleccionar();
    tramosSel = null;
    historial = [];
    posHistorial = -1;
    guardarFoto();
    cambios = false;
    reiniciarClics();
    sucio = true;
  }

  async function cargarAutomatico() {
    try {
      await cargarAudio();
      mensaje("Analizando la canción...");
      await new Promise(r => setTimeout(r, 30));
      tomarMapa(AN.crearMapa(buffer, difActual()));
      mensaje(`Mapa automático: ${notas.length} notas, ${tramos.length} tramos.`);
    } catch (err) {
      mensaje("No se pudo cargar esa canción: " + (err && err.message || err), true);
    }
  }

  function aplicarGuardado(guardado) {
    if (typeof guardado.firma === "string") firmaEl.value = guardado.firma;
    // Los tramos y la banda de cada uno se recalculan con el pulso guardado
    const m = AN.crearMapa(buffer, difActual(), { pulsos: guardado.pulsos });
    tomarMapa({
      notas: guardado.notas.map(x => ({ t: x[0], carril: ["abajo", "arriba", "ambos"][x[1]] || "abajo", dur: x[2] || 0 })),
      pulsos: guardado.pulsos,
      tramos: m.tramos
    });
  }

  async function supabase() {
    if (typeof fichasCliente !== "function") throw new Error("Sin conexión a Supabase");
    return fichasCliente();
  }

  async function cargarGuardado() {
    try {
      await cargarAudio();
      const sb = await supabase();
      const { data, error } = await sb.from("ritmo_mapas").select("mapa").eq("cancion", rutaActual()).eq("dificultad", difActual()).maybeSingle();
      if (error) throw error;
      if (!data) { mensaje("No hay un mapa guardado para esta canción y dificultad."); return; }
      aplicarGuardado(data.mapa);
      mensaje(`Mapa guardado cargado: ${notas.length} notas.`);
    } catch (err) {
      mensaje("No se pudo cargar: " + (err && err.message || err), true);
    }
  }

  /* --- Guardar, probar, exportar ----------------------------------------------------- */
  /* Arregla lo que rompería el juego: largas que pisan la nota siguiente de su carril y
     dobles con duración. */
  function limpiarNotas() {
    notas.sort((a, b) => a.t - b.t);
    notas.forEach(n => { if (n.carril === "ambos") n.dur = 0; });
    for (let i = 0; i < notas.length; i++) {
      const n = notas[i];
      if (!(n.dur > 0)) { n.dur = 0; continue; }
      for (let j = i + 1; j < notas.length; j++) {
        if (notas[j].carril === n.carril || notas[j].carril === "ambos" || n.carril === "ambos") {
          const tope = notas[j].t - 0.2 - n.t;
          if (n.dur > tope) n.dur = tope >= 0.3 ? tope : 0;
          break;
        }
      }
    }
  }

  /* La firma va dentro del mapa guardado y se ve en el juego junto a la estrella. */
  const firmaEl = $("reFirma");
  try { firmaEl.value = localStorage.getItem("compendioRitmoFirma") || ""; } catch (e) { /* sin almacenamiento */ }
  firmaEl.addEventListener("change", () => { try { localStorage.setItem("compendioRitmoFirma", firmaEl.value.trim()); } catch (e) { /* sin almacenamiento */ } });
  function conFirma(mapa) {
    const f = firmaEl.value.trim().slice(0, 30);
    if (f) mapa.firma = f;
    return mapa;
  }

  async function guardar() {
    if (!notas.length) { mensaje("No hay nada que guardar.", true); return; }
    limpiarNotas();
    try {
      const sb = await supabase();
      const { error } = await sb.from("ritmo_mapas").upsert({
        cancion: rutaActual(),
        dificultad: difActual(),
        mapa: conFirma(AN.guardable(notas, pulsos)),
        actualizado: new Date().toISOString()
      });
      if (error) throw error;
      cambios = false;
      mensaje(`Guardado (${notas.length} notas). Los jugadores lo usan desde la próxima vez que abran la canción.`);
    } catch (err) {
      const t = String(err && err.message || err);
      mensaje(/ritmo_mapas|relation|does not exist/i.test(t) ? "Falta correr scratchpad/ritmo_mapas.sql en Supabase." : /row-level|policy|permission|JWT/i.test(t) ? "Sin permiso: inicia sesión con la cuenta admin." : "No se pudo guardar: " + t, true);
    }
    sucio = true;
  }

  function probar() {
    if (!notas.length) return;
    limpiarNotas();
    try {
      localStorage.setItem("ritmoPrueba", JSON.stringify({ ruta: rutaActual(), dificultad: difActual(), mapa: conFirma(AN.guardable(notas, pulsos)) }));
      const aj = JSON.parse(localStorage.getItem(CLAVE_AJUSTES) || "{}");
      aj.ruta = rutaActual();
      aj.dificultad = difActual();
      localStorage.setItem(CLAVE_AJUSTES, JSON.stringify(aj));
    } catch (e) { mensaje("No se pudo preparar la prueba.", true); return; }
    window.open("ritmo.html?prueba=1", "_blank");
    mensaje("Se abrió el juego con este mapa sin guardar. Elige la canción y juega.");
  }

  function exportar() {
    if (!notas.length) return;
    limpiarNotas();
    const texto = JSON.stringify({ cancion: rutaActual(), dificultad: difActual(), mapa: conFirma(AN.guardable(notas, pulsos)) });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
    a.download = `mapa-${canciones[Number(cancionEl.value)].nombre.replace(/[^\w-]+/g, "_").slice(0, 40)}-${difActual()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function importar(archivo) {
    try {
      const data = JSON.parse(await archivo.text());
      const mapa = data.mapa || data;
      if (!mapa || !Array.isArray(mapa.notas) || !Array.isArray(mapa.pulsos)) throw new Error("El archivo no es un mapa");
      if (data.cancion) { const k = canciones.findIndex(c => c.ruta === data.cancion); if (k >= 0) cancionEl.value = String(k); }
      if (data.dificultad && AN.DIFICULTADES[data.dificultad]) difEl.value = data.dificultad;
      await cargarAudio();
      aplicarGuardado(mapa);
      cambios = true;
      mensaje(`Importado: ${notas.length} notas.`);
    } catch (err) {
      mensaje("No se pudo importar: " + (err && err.message || err), true);
    }
  }

  async function borrarGuardado() {
    if (!confirm("¿Borrar el mapa guardado de esta canción y dificultad? El juego volverá a usar el automático.")) return;
    try {
      const sb = await supabase();
      const { error } = await sb.from("ritmo_mapas").delete().eq("cancion", rutaActual()).eq("dificultad", difActual());
      if (error) throw error;
      mensaje("Guardado borrado. El juego usa el mapa automático.");
    } catch (err) {
      mensaje("No se pudo borrar: " + (err && err.message || err), true);
    }
  }

  /* --- Tramos y pulso ------------------------------------------------------------------- */
  function tramoT0(i) { return pulsos[tramos[i].k0]; }
  function tramoT1(i) { return pulsos[tramos[i].k1]; }

  function actualizarTramos() {
    // Los tiempos de cada tramo salen del pulso actual
    sucio = true;
  }

  function regenerar(a, b, banda) {
    if (!buffer || !tramos.length) return;
    guardarFoto();
    for (let i = a; i <= b; i++) {
      if (banda === "auto") delete forzadas[i]; else forzadas[i] = banda;
    }
    const t0 = tramoT0(a);
    const t1 = tramoT1(b);
    const m = AN.crearMapa(buffer, difActual(), { pulsos, bandasForzadas: forzadas });
    notas = notas.filter(n => n.t < t0 || n.t >= t1);
    m.notas.forEach(n => { if (n.t >= t0 && n.t < t1) notas.push({ t: n.t, carril: n.carril, dur: n.dur || 0 }); });
    notas.sort((x, y) => x.t - y.t);
    for (let i = a; i <= b; i++) { if (m.tramos[i]) { tramos[i].banda = m.tramos[i].banda; tramos[i].vacio = m.tramos[i].vacio; } }
    deseleccionar();
    guardarFoto();
    reiniciarClics();
    sucio = true;
    mensaje(`Tramos ${a + 1}${b > a ? " a " + (b + 1) : ""}: ${banda === "auto" ? "automático" : ETIQUETA_BANDA[banda]}. Notas ahora: ${notas.length}.`);
  }

  function rangoPulsos() {
    if (!tramosSel) return null;
    return { k0: tramos[tramosSel.a].k0, k1: tramos[tramosSel.b].k1 };
  }

  function regularizar() {
    const r = rangoPulsos();
    if (!r) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    guardarFoto();
    const p0 = pulsos[r.k0];
    const p1 = pulsos[r.k1];
    for (let k = r.k0; k <= r.k1; k++) pulsos[k] = p0 + ((p1 - p0) * (k - r.k0)) / (r.k1 - r.k0);
    guardarFoto();
    sucio = true;
    mensaje("Pulso regularizado: intervalos iguales entre el primer y el último pulso del rango.");
  }

  function moverPulsos(delta) {
    const r = rangoPulsos();
    if (!r) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    guardarFoto();
    for (let k = r.k0; k <= r.k1; k++) pulsos[k] += delta;
    guardarFoto();
    sucio = true;
  }

  /* --- Copiar y pegar tramos ------------------------------------------------------------------
     Se copian las notas de los tramos elegidos medidas en pulsos desde el primero del rango, no
     en segundos, así al pegarlas en otro sitio se acomodan al pulso de ahí aunque el tempo sea
     distinto. Al pegar en el inicio de un tramo también viaja la banda que seguía cada uno. */
  let portapapeles = null; // { pulsos, notas: [{ b, carril, d }], bandas: [{ banda, vacio, forzada }] }

  function enPulsos(t, k0, k1) {
    const k = Math.max(k0, Math.min(k1 - 1, indicePulso(t)));
    return (k - k0) + (t - pulsos[k]) / (pulsos[k + 1] - pulsos[k]);
  }

  function copiarTramos() {
    const r = rangoPulsos();
    if (!r) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    const t0 = pulsos[r.k0];
    const t1 = pulsos[r.k1];
    const enRango = notas.filter(n => n.t >= t0 - 1e-6 && n.t < t1);
    portapapeles = {
      pulsos: r.k1 - r.k0,
      notas: enRango.map(n => {
        const b = enPulsos(n.t, r.k0, r.k1);
        return { b, carril: n.carril, d: n.dur > 0 ? enPulsos(n.t + n.dur, r.k0, r.k1) - b : 0 };
      }),
      bandas: []
    };
    for (let i = tramosSel.a; i <= tramosSel.b; i++) portapapeles.bandas.push({ banda: tramos[i].banda, vacio: tramos[i].vacio });
    mensaje(`Copiados ${enRango.length} notas de ${tramosSel.b - tramosSel.a + 1} tramo${tramosSel.b > tramosSel.a ? "s" : ""}. Pégalos en otro lugar.`);
  }

  /* Copia solo las notas elegidas (da igual si son de varios tramos o de la mitad de uno) */
  function copiarSeleccion() {
    const lista = [...seleccion].sort((a, b) => a.t - b.t);
    if (!lista.length) { mensaje("Elige primero algunas notas.", true); return; }
    const k0 = Math.max(0, indicePulso(lista[0].t));
    const ultimo = lista.reduce((m, n) => Math.max(m, n.t + (n.dur || 0)), 0);
    const k1 = Math.min(pulsos.length - 1, Math.max(k0 + 1, indicePulso(ultimo) + 2));
    portapapeles = {
      pulsos: k1 - k0, soloNotas: true, bandas: [],
      notas: lista.map(n => { const b = enPulsos(n.t, k0, k1); return { b, carril: n.carril, d: n.dur > 0 ? enPulsos(n.t + n.dur, k0, k1) - b : 0 }; })
    };
    mensaje(`Copiadas ${lista.length} notas. Pon el cursor donde quieras y pega (Ctrl+V).`);
  }

  function tiempoDePulso(kT, b) {
    const base = kT + Math.floor(b);
    if (base + 1 >= pulsos.length) return null;
    return pulsos[base] + (b - Math.floor(b)) * (pulsos[base + 1] - pulsos[base]);
  }

  function pegarEn(kT) {
    if (!portapapeles) { mensaje("Primero copia uno o más tramos.", true); return; }
    if (kT < 0 || kT + 1 >= pulsos.length) { mensaje("Ese punto queda fuera de la canción.", true); return; }
    const sumar = $("reSumar").checked || !!portapapeles.soloNotas;
    const creadas = [];
    guardarFoto();
    const tIni = pulsos[kT];
    const tFin = pulsos[Math.min(kT + portapapeles.pulsos, pulsos.length - 1)];
    if (!sumar) notas = notas.filter(n => n.t < tIni - 1e-6 || n.t >= tFin);
    let puestas = 0;
    portapapeles.notas.forEach(n => {
      const t = tiempoDePulso(kT, n.b);
      if (t === null || t >= tFin + 1e-6) return;
      const fin = n.d > 0 ? tiempoDePulso(kT, n.b + n.d) : null;
      const nueva = { t, carril: n.carril, dur: fin !== null && n.carril !== "ambos" ? Math.max(0.2, fin - t) : 0 };
      notas.push(nueva);
      creadas.push(nueva);
      puestas++;
    });
    notas.sort((a, b) => a.t - b.t);
    // Si se pega justo al inicio de un tramo, los tramos de destino siguen la misma banda
    let bandas = false;
    if (!portapapeles.soloNotas && kT % 8 === 0) {
      const i0 = kT / 8;
      portapapeles.bandas.forEach((b, j) => {
        const tr = tramos[i0 + j];
        if (!tr) return;
        tr.banda = b.banda; tr.vacio = b.vacio;
        forzadas[i0 + j] = b.vacio ? "vacio" : b.banda;
      });
      tramosSel = { a: i0, b: Math.min(tramos.length - 1, i0 + portapapeles.bandas.length - 1) };
      bandas = true;
    }
    deseleccionar();
    guardarFoto();
    reiniciarClics();
    sucio = true;
    if (portapapeles.soloNotas) { creadas.forEach(n => seleccion.add(n)); sel = creadas[creadas.length - 1] || null; }
    mensaje(`Pegadas ${puestas} notas${bandas ? " y la banda de cada tramo" : ""}${sumar ? " (sumadas a lo que había)" : ", reemplazando lo que había"}.`);
  }

  function pegarEnTramo() {
    if (!tramosSel) { mensaje("Elige el tramo donde quieres pegar.", true); return; }
    pegarEn(tramos[tramosSel.a].k0);
  }

  function pegarEnCursor() {
    if (!pulsos.length) return;
    const t = tiempoActual();
    let mejor = 0;
    for (let k = 0; k < pulsos.length; k++) if (Math.abs(pulsos[k] - t) < Math.abs(pulsos[mejor] - t)) mejor = k;
    pegarEn(mejor);
  }

  /* Rellena el resto de la canción, desde el compás del cursor, con notas generadas que imitan
     el estilo de lo ya hecho (densidad, rachas por carril, largas y dobles). Lo anterior al
     cursor no se toca. */
  function completarDesdeCursor() {
    if (!buffer || !pulsos.length) { mensaje("Carga primero un mapa.", true); return; }
    const t = tiempoActual();
    let k = 0;
    for (let q = 0; q < pulsos.length; q++) if (Math.abs(pulsos[q] - t) < Math.abs(pulsos[k] - t)) k = q;
    k = Math.min(pulsos.length - 1, Math.round(k / 4) * 4);
    const t0 = pulsos[k];
    const estilo = AN.estiloDe(notas, 0, t0);
    if (!estilo) { mensaje("Hay muy poco trabajo antes del cursor para sacar un estilo. Pon el cursor más adelante.", true); return; }
    guardarFoto();
    const m = AN.crearMapa(buffer, difActual(), { pulsos, bandasForzadas: forzadas, estilo });
    notas = notas.filter(n => n.t < t0 - 1e-6);
    m.notas.forEach(n => { if (n.t >= t0 - 1e-6) notas.push({ t: n.t, carril: n.carril, dur: n.dur || 0 }); });
    notas.sort((a, b) => a.t - b.t);
    deseleccionar();
    guardarFoto();
    reiniciarClics();
    sucio = true;
    mensaje(`Completado desde ${formatoT(t0)} con tu estilo (${estilo.nps} notas/s, racha máxima ${estilo.maxRacha}, ${Math.round(estilo.fraccionLargas * 100)} % largas). Lo anterior no se tocó.`);
  }

  function pulsoAlCursor() {
    const r = rangoPulsos();
    if (!r) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    const t = tiempoActual();
    let mejor = r.k0;
    for (let k = r.k0; k <= r.k1; k++) if (Math.abs(pulsos[k] - t) < Math.abs(pulsos[mejor] - t)) mejor = k;
    const delta = t - pulsos[mejor];
    guardarFoto();
    for (let k = r.k0; k <= r.k1; k++) pulsos[k] += delta;
    guardarFoto();
    sucio = true;
    mensaje(`Pulsos del rango movidos ${Math.round(delta * 1000)} ms para que uno caiga en el cursor.`);
  }

  /* --- Ajuste a la cuadrícula ------------------------------------------------------------ */
  function indicePulso(t) {
    let a = 0;
    let b = pulsos.length;
    while (a < b) { const m = (a + b) >> 1; if (pulsos[m] <= t) a = m + 1; else b = m; }
    return a - 1;
  }

  function ajustar(t) {
    const sd = Number(snapEl.value);
    if (!sd || pulsos.length < 2) return Math.max(0, Math.round(t * 1000) / 1000);
    let k = indicePulso(t);
    k = Math.max(0, Math.min(pulsos.length - 2, k));
    const periodo = pulsos[k + 1] - pulsos[k];
    const f = (t - pulsos[k]) / periodo;
    return Math.max(0, pulsos[k] + (Math.round(f * sd) / sd) * periodo);
  }

  function periodoEn(t) {
    const k = Math.max(0, Math.min(pulsos.length - 2, indicePulso(t)));
    return pulsos.length > 1 ? pulsos[k + 1] - pulsos[k] : 0.5;
  }

  /* --- Reproducción ------------------------------------------------------------------------ */
  function tiempoActual() {
    if (!reproduciendo || !audio) return posIni;
    return Math.min(buffer.duration, posIni + Math.max(0, audio.currentTime - ctxIni) * vel);
  }

  function reiniciarClics() {
    const t = tiempoActual();
    proxClic = 0;
    while (proxClic < notas.length && notas[proxClic].t < t) proxClic++;
    proxPulso = 0;
    while (proxPulso < pulsos.length && pulsos[proxPulso] < t) proxPulso++;
  }

  function tono(frecuencia, cuando, duracion, volumen) {
    const o = audio.createOscillator();
    const v = audio.createGain();
    o.frequency.value = frecuencia;
    o.type = "square";
    v.gain.setValueAtTime(volumen, cuando);
    v.gain.exponentialRampToValueAtTime(0.0001, cuando + duracion);
    o.connect(v); v.connect(gClics);
    o.start(cuando);
    o.stop(cuando + duracion + 0.02);
  }

  function programarClics(t) {
    const horizonte = t + 0.15 * vel;
    const cuando = tt => ctxIni + (tt - posIni) / vel;
    if ($("reClics").checked) {
      notas.sort((a, b) => a.t - b.t);
      while (proxClic < notas.length && notas[proxClic].t < horizonte) {
        const n = notas[proxClic++];
        if (n.t < t - 0.03) continue;
        if (n.carril !== "abajo") tono(880, cuando(n.t), 0.05, 0.12);
        if (n.carril !== "arriba") tono(300, cuando(n.t), 0.07, 0.16);
      }
    } else {
      while (proxClic < notas.length && notas[proxClic].t < horizonte) proxClic++;
    }
    if ($("reMetro").checked) {
      while (proxPulso < pulsos.length && pulsos[proxPulso] < horizonte) {
        const k = proxPulso++;
        if (pulsos[k] < t - 0.03) continue;
        tono(k % 4 === 0 ? 1500 : 1100, cuando(pulsos[k]), 0.03, 0.07);
      }
    } else {
      while (proxPulso < pulsos.length && pulsos[proxPulso] < horizonte) proxPulso++;
    }
  }

  /* Todas las fuentes de audio creadas que aún pueden sonar. Al pausar o mover el cursor se
     paran todas, no solo la última: así nunca quedan pistas sonando por detrás. */
  const fuentesVivas = new Set();

  function detener() {
    if (reproduciendo) posIni = tiempoActual();
    fuentesVivas.forEach(f => { f.onended = null; try { f.stop(); } catch (e) { /* ya parada */ } });
    fuentesVivas.clear();
    fuente = null;
    reproduciendo = false;
    playEl.textContent = "▶";
  }

  async function reproducir() {
    if (!buffer) return;
    await prepararAudio();
    detener();
    vel = Number(velEl.value);
    const esta = audio.createBufferSource();
    esta.buffer = buffer;
    esta.playbackRate.value = vel;
    esta.connect(gMusica);
    fuente = esta;
    fuentesVivas.add(esta);
    ctxIni = audio.currentTime + 0.06;
    esta.start(ctxIni, posIni);
    // Solo cuenta el final de la fuente actual: el aviso de una que se acaba de parar no debe
    // tocar el estado de la nueva
    esta.onended = () => {
      fuentesVivas.delete(esta);
      if (fuente === esta) { reproduciendo = false; posIni = buffer.duration; fuente = null; playEl.textContent = "▶"; sucio = true; }
    };
    reproduciendo = true;
    playEl.textContent = "❚❚";
    reiniciarClics();
  }

  function alternarReproduccion() { if (reproduciendo) { detener(); sucio = true; } else reproducir(); }

  function buscar(t) {
    posIni = Math.max(0, Math.min(buffer ? buffer.duration : 0, t));
    if (reproduciendo) reproducir(); else { reiniciarClics(); sucio = true; }
  }

  /* --- Dibujo ------------------------------------------------------------------------------------ */
  const tX = t => (t - vistaIni) * pps;
  const xT = x => x / pps + vistaIni;

  function ajustarLienzo() {
    const r = lienzo.getBoundingClientRect();
    ancho = Math.max(200, r.width);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(ancho * dpr);
    const h = Math.round(ALTO * dpr);
    if (lienzo.width !== w || lienzo.height !== h) { lienzo.width = w; lienzo.height = h; }
    g.setTransform(w / ancho, 0, 0, h / ALTO, 0, 0);
  }

  function formatoT(s) {
    const m = Math.floor(s / 60);
    return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
  }

  function dibujarNota(n) {
    const x = tX(n.t);
    const largo = n.dur > 0 ? n.dur * pps : 0;
    if (x + largo < -20 || x > ancho + 20) return;
    const lineas = n.carril === "ambos" ? [Y_ARRIBA, Y_ABAJO] : [n.carril === "arriba" ? Y_ARRIBA : Y_ABAJO];
    const color = COLOR[n.carril];
    if (n.carril === "ambos") {
      g.strokeStyle = COLOR.ambos; g.lineWidth = 4;
      g.beginPath(); g.moveTo(x, Y_ARRIBA); g.lineTo(x, Y_ABAJO); g.stroke();
    }
    lineas.forEach(y => {
      if (largo) {
        g.fillStyle = color; g.globalAlpha = 0.45;
        g.fillRect(x, y - 8, largo, 16);
        g.globalAlpha = 1;
        g.fillRect(x + largo - 4, y - 8, 4, 16);
      }
      g.fillStyle = n.carril === "ambos" ? (y === Y_ARRIBA ? COLOR.arriba : COLOR.abajo) : color;
      g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
      if (seleccion.has(n)) { g.strokeStyle = "#fff"; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 15, 0, Math.PI * 2); g.stroke(); }
    });
  }

  function dibujar() {
    ajustarLienzo();
    const t = tiempoActual();
    if (reproduciendo) vistaIni = t - (ancho / pps) * 0.3;
    g.clearRect(0, 0, ancho, ALTO);

    // Franjas de carril
    [Y_ARRIBA, Y_ABAJO].forEach(y => { g.fillStyle = "rgba(255,255,255,0.035)"; g.fillRect(0, y - 30, ancho, 60); });

    // Tramos (franja de colores por banda)
    tramos.forEach((tr, i) => {
      const x0 = tX(tramoT0(i));
      const x1 = tX(tramoT1(i));
      if (x1 < 0 || x0 > ancho) return;
      const color = COLOR_BANDA[tr.vacio ? "vacio" : tr.banda];
      const elegido = tramosSel && i >= tramosSel.a && i <= tramosSel.b;
      g.fillStyle = `rgba(${color}, ${elegido ? 0.6 : 0.28})`;
      g.fillRect(x0, Y_TRAMOS[0], x1 - x0 - 1, Y_TRAMOS[1] - Y_TRAMOS[0]);
      if (x1 - x0 > 46) {
        g.fillStyle = "rgba(255,255,255,0.8)"; g.font = "11px sans-serif"; g.textAlign = "left";
        g.fillText(`${i + 1} ${ETIQUETA_BANDA[tr.vacio ? "vacio" : tr.banda]}${forzadas[i] ? " ✎" : ""}`, x0 + 4, Y_TRAMOS[0] + 16);
      }
    });

    // Regla
    const paso = pps >= 160 ? 1 : pps >= 60 ? 2 : pps >= 30 ? 5 : 10;
    g.fillStyle = "rgba(255,255,255,0.5)"; g.font = "10px sans-serif"; g.textAlign = "left";
    g.strokeStyle = "rgba(255,255,255,0.12)"; g.lineWidth = 1;
    for (let s = Math.ceil(vistaIni / paso) * paso; tX(s) < ancho; s += paso) {
      const x = tX(s);
      g.beginPath(); g.moveTo(x, Y_REGLA[0] + 12); g.lineTo(x, Y_REGLA[1]); g.stroke();
      g.fillText(formatoT(s).replace(/\.0$/, ""), x + 3, 10);
    }

    // Pulsos
    let k = Math.max(0, indicePulso(vistaIni));
    for (; k < pulsos.length; k++) {
      const x = tX(pulsos[k]);
      if (x > ancho) break;
      if (x < 0) continue;
      g.strokeStyle = k % 4 === 0 ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)";
      g.lineWidth = k % 4 === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(x, Y_TRAMOS[1]); g.lineTo(x, Y_ONDA[0] - 6); g.stroke();
    }

    // Notas
    notas.forEach(dibujarNota);

    // Forma de onda
    if (onda) {
      const mitad = (Y_ONDA[0] + Y_ONDA[1]) / 2;
      const amp = (Y_ONDA[1] - Y_ONDA[0]) / 2;
      g.fillStyle = "rgba(143, 220, 255, 0.45)";
      for (let x = 0; x < ancho; x++) {
        const i0 = Math.floor(xT(x) * 100);
        const i1 = Math.max(i0 + 1, Math.floor(xT(x + 1) * 100));
        if (i1 < 0 || i0 >= onda.length) continue;
        let m = 0;
        for (let i = Math.max(0, i0); i < Math.min(onda.length, i1); i++) if (onda[i] > m) m = onda[i];
        const h = Math.min(1, m * 1.4) * amp;
        g.fillRect(x, mitad - h, 1, Math.max(1, h * 2));
      }
    }

    // Caja de selección (Mayús + arrastrar en un hueco)
    if (arrastre && arrastre.tipo === "caja") {
      const bx = Math.min(arrastre.x0, arrastre.x1);
      const by = Math.min(arrastre.y0, arrastre.y1);
      const bw = Math.abs(arrastre.x1 - arrastre.x0);
      const bh = Math.abs(arrastre.y1 - arrastre.y0);
      g.fillStyle = "rgba(255, 79, 216, 0.14)";
      g.fillRect(bx, by, bw, bh);
      g.strokeStyle = "#ff4fd8"; g.lineWidth = 1;
      g.strokeRect(bx + 0.5, by + 0.5, bw, bh);
    }
    if (contadorEl) {
      const txt = seleccion.size ? `${seleccion.size} nota${seleccion.size === 1 ? "" : "s"} elegida${seleccion.size === 1 ? "" : "s"}` : "Sin notas elegidas";
      if (txt !== contadorPrevio) {
        contadorPrevio = txt;
        contadorEl.textContent = txt;
        contadorEl.classList.toggle("activo", seleccion.size > 0);
      }
    }

    // Cursor de reproducción
    const xc = tX(t);
    g.strokeStyle = "#f2d46b"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(xc, 0); g.lineTo(xc, ALTO); g.stroke();
    tiempoEl.textContent = formatoT(t);
  }

  function bucle() {
    if (reproduciendo) {
      const t = tiempoActual();
      programarClics(t);
      sucio = true;
    }
    if (sucio) { sucio = false; dibujar(); }
    requestAnimationFrame(bucle);
  }

  /* --- Ratón ----------------------------------------------------------------------------------------- */
  let arrastre = null;

  function posicion(ev) {
    const r = lienzo.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  }

  function notaEn(x, y) {
    let mejor = null;
    let dmin = Infinity;
    notas.forEach(n => {
      const nx = tX(n.t);
      const ys = n.carril === "ambos" ? [Y_ARRIBA, Y_ABAJO] : [n.carril === "arriba" ? Y_ARRIBA : Y_ABAJO];
      ys.forEach(ny => {
        const enCabeza = Math.hypot(x - nx, y - ny) <= 15;
        const enBarra = n.dur > 0 && x >= nx && x <= nx + n.dur * pps && Math.abs(y - ny) <= 9;
        if (enCabeza || enBarra) {
          const d = Math.hypot(x - nx, y - ny);
          if (d < dmin) { dmin = d; mejor = n; }
        }
      });
    });
    return mejor;
  }

  function enBordeLargo(n, x) {
    return n.dur > 0 && Math.abs(x - tX(n.t + n.dur)) <= 7;
  }

  function carrilEn(y) { return y < (Y_ARRIBA + Y_ABAJO) / 2 ? "arriba" : "abajo"; }

  function tramoEn(x) {
    const t = xT(x);
    for (let i = 0; i < tramos.length; i++) if (t >= tramoT0(i) && t < tramoT1(i)) return i;
    return -1;
  }

  lienzo.addEventListener("contextmenu", ev => {
    ev.preventDefault();
    const { x, y } = posicion(ev);
    const n = notaEn(x, y);
    if (n) {
      if (seleccion.has(n) && seleccion.size > 1) { borrarSeleccion(); return; }
      guardarFoto(); notas.splice(notas.indexOf(n), 1); seleccion.delete(n); if (sel === n) sel = null; guardarFoto(); reiniciarClics(); sucio = true;
    }
  });

  lienzo.addEventListener("mousedown", ev => {
    if (ev.button !== 0 || !buffer) return;
    const { x, y } = posicion(ev);
    if (y < Y_REGLA[1] || y > Y_ONDA[0]) {
      arrastre = { tipo: "buscar" };
      buscar(xT(x));
      return;
    }
    if (y < Y_TRAMOS[1]) {
      const i = tramoEn(x);
      if (i >= 0) {
        tramosSel = ev.shiftKey && tramosSel ? { a: Math.min(tramosSel.a, i), b: Math.max(tramosSel.b, i) } : { a: i, b: i };
        sucio = true;
      }
      return;
    }
    const n = notaEn(x, y);
    const suma = ev.shiftKey || ev.ctrlKey || ev.metaKey;
    if (n) {
      // Mayús o Ctrl + clic en una nota la suma o la quita de la selección
      if (suma) { if (seleccion.has(n)) seleccion.delete(n); else seleccion.add(n); sel = n; sucio = true; return; }
      if (!seleccion.has(n)) { seleccion.clear(); seleccion.add(n); }
      sel = n;
      if (enBordeLargo(n, x) && seleccion.size === 1) arrastre = { tipo: "larga", nota: n, foto: foto(), movida: false };
      else arrastre = { tipo: "mover", nota: n, dx: xT(x) - n.t, foto: foto(), movida: false, origen: [...seleccion].map(o => ({ o, t: o.t })) };
    } else if (ev.shiftKey) {
      // Mayús + arrastrar en un hueco: caja de selección
      arrastre = { tipo: "caja", x0: x, y0: y, x1: x, y1: y, aditiva: ev.ctrlKey || ev.metaKey };
    } else {
      // Nota nueva en el carril donde se hizo clic
      guardarFoto();
      const nueva = { t: ajustar(xT(x)), carril: carrilEn(y), dur: 0 };
      notas.push(nueva);
      notas.sort((a, b) => a.t - b.t);
      seleccion.clear(); seleccion.add(nueva); sel = nueva;
      guardarFoto();
      reiniciarClics();
    }
    sucio = true;
  });

  window.addEventListener("mousemove", ev => {
    if (!arrastre) return;
    const { x, y } = posicion(ev);
    if (arrastre.tipo === "buscar") { buscar(xT(x)); return; }
    if (arrastre.tipo === "caja") { arrastre.x1 = x; arrastre.y1 = y; sucio = true; return; }
    const n = arrastre.nota;
    if (!arrastre.movida) {
      arrastre.movida = true;
      // La foto previa al arrastre queda como paso de deshacer
      historial = historial.slice(0, posHistorial + 1);
      historial[posHistorial] = arrastre.foto;
    }
    if (arrastre.tipo === "mover") {
      // Todas las notas elegidas se mueven juntas la misma distancia
      const nuevoT = ajustar(xT(x) - arrastre.dx);
      const delta = nuevoT - arrastre.origen.find(r => r.o === n).t;
      arrastre.origen.forEach(r => { r.o.t = Math.max(0, Math.round((r.t + delta) * 1000) / 1000); });
      if (arrastre.origen.length === 1 && n.carril !== "ambos") n.carril = carrilEn(y);
    } else {
      const fin = ajustar(xT(x));
      n.dur = Math.max(0.2, fin - n.t);
    }
    sucio = true;
  });

  function seleccionarCaja(c) {
    const x0 = Math.min(c.x0, c.x1);
    const x1 = Math.max(c.x0, c.x1);
    const y0 = Math.min(c.y0, c.y1);
    const y1 = Math.max(c.y0, c.y1);
    if (!c.aditiva) seleccion.clear();
    notas.forEach(n => {
      const nx = tX(n.t);
      const fin = n.dur > 0 ? tX(n.t + n.dur) : nx;
      if (fin < x0 - 8 || nx > x1 + 8) return;
      const ys = n.carril === "ambos" ? [Y_ARRIBA, Y_ABAJO] : [n.carril === "arriba" ? Y_ARRIBA : Y_ABAJO];
      if (ys.some(ny => ny + 15 >= y0 && ny - 15 <= y1)) seleccion.add(n);
    });
    sel = [...seleccion].pop() || null;
    mensaje(seleccion.size ? `${seleccion.size} nota${seleccion.size === 1 ? "" : "s"} elegida${seleccion.size === 1 ? "" : "s"}.` : "No hay notas en esa caja.");
  }

  window.addEventListener("mouseup", () => {
    if (!arrastre) return;
    if (arrastre.tipo === "caja") { seleccionarCaja(arrastre); arrastre = null; sucio = true; return; }
    if (arrastre.movida) {
      notas.sort((a, b) => a.t - b.t);
      guardarFoto();
      reiniciarClics();
    }
    arrastre = null;
    sucio = true;
  });

  lienzo.addEventListener("wheel", ev => {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      const { x } = posicion(ev);
      const t = xT(x);
      pps = Math.max(20, Math.min(320, pps * (ev.deltaY < 0 ? 1.15 : 1 / 1.15)));
      vistaIni = t - x / pps;
      zoomEl.value = String(Math.round(pps));
    } else if (!reproduciendo) {
      vistaIni += (ev.deltaX || ev.deltaY) / pps * 1.2;
    }
    sucio = true;
  }, { passive: false });

  zoomEl.addEventListener("input", () => {
    const centro = vistaIni + ancho / pps / 2;
    pps = Number(zoomEl.value);
    vistaIni = centro - ancho / pps / 2;
    sucio = true;
  });

  /* --- Edición de la nota elegida ---------------------------------------------------------------------------- */
  function conSeleccion(fn) {
    if (!seleccion.size) { mensaje("Elige primero una nota (Mayús o Ctrl para varias).", true); return; }
    guardarFoto();
    [...seleccion].forEach(fn);
    notas.sort((a, b) => a.t - b.t);
    guardarFoto();
    reiniciarClics();
    sucio = true;
  }

  function alternarLarga() {
    if (!seleccion.size) { mensaje("Elige primero una nota (Mayús o Ctrl para varias).", true); return; }
    const lista = [...seleccion].filter(n => n.carril !== "ambos");
    if (!lista.length) { mensaje("Una nota doble no puede ser larga.", true); return; }
    const quitar = lista.every(n => n.dur > 0);
    conSeleccion(n => {
      if (n.carril === "ambos") return;
      n.dur = quitar ? 0 : (n.dur > 0 ? n.dur : Math.max(0.4, periodoEn(n.t) * 2));
    });
  }
  function alternarDoble() {
    const todas = seleccion.size > 0 && [...seleccion].every(n => n.carril === "ambos");
    conSeleccion(n => { if (todas) n.carril = "abajo"; else { n.carril = "ambos"; n.dur = 0; } });
  }
  function cambiarCarril() {
    conSeleccion(n => { if (n.carril !== "ambos") n.carril = n.carril === "arriba" ? "abajo" : "arriba"; });
  }
  function borrarSeleccion() {
    if (!seleccion.size) return;
    guardarFoto();
    notas = notas.filter(n => !seleccion.has(n));
    deseleccionar();
    guardarFoto();
    reiniciarClics();
    sucio = true;
  }
  function nudge(ms) { conSeleccion(n => { n.t = Math.max(0, Math.round((n.t + ms / 1000) * 1000) / 1000); }); }

  function seleccionarTodo() {
    seleccion.clear();
    notas.forEach(n => seleccion.add(n));
    sel = notas[notas.length - 1] || null;
    sucio = true;
    mensaje(`${seleccion.size} notas elegidas.`);
  }
  function seleccionarDelTramo() {
    const r = rangoPulsos();
    if (!r) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    const t0 = pulsos[r.k0];
    const t1 = pulsos[r.k1];
    seleccion.clear();
    notas.forEach(n => { if (n.t >= t0 - 1e-6 && n.t < t1) seleccion.add(n); });
    sel = [...seleccion].pop() || null;
    sucio = true;
    mensaje(`${seleccion.size} notas elegidas en los tramos.`);
  }

  /* --- Controles ---------------------------------------------------------------------------------------------------- */
  $("reAuto").addEventListener("click", cargarAutomatico);
  $("reGuardado").addEventListener("click", cargarGuardado);
  playEl.addEventListener("click", alternarReproduccion);
  [["reVolMusica", "musica"], ["reVolClics", "clics"]].forEach(([id, clave]) => {
    const el = $(id);
    el.value = String(Math.round(volumenes[clave] * 100));
    el.addEventListener("input", () => {
      volumenes[clave] = Number(el.value) / 100;
      aplicarVolumenes();
      try { localStorage.setItem(CLAVE_VOL, JSON.stringify(volumenes)); } catch (e) { /* sin almacenamiento */ }
    });
  });
  velEl.addEventListener("change", () => { if (reproduciendo) reproducir(); else vel = Number(velEl.value); });
  $("reLarga").addEventListener("click", alternarLarga);
  $("reDoble").addEventListener("click", alternarDoble);
  $("reCarril").addEventListener("click", cambiarCarril);
  $("reBorrar").addEventListener("click", borrarSeleccion);
  $("reCompletar").addEventListener("click", completarDesdeCursor);
  $("reCopiar").addEventListener("click", () => (seleccion.size ? copiarSeleccion() : copiarTramos()));
  $("reSelTodo").addEventListener("click", seleccionarTodo);
  $("reSelTramo").addEventListener("click", seleccionarDelTramo);
  $("reSelNada").addEventListener("click", () => { deseleccionar(); sucio = true; });
  $("reNotaMenos").addEventListener("click", () => nudge(-10));
  $("reNotaMas").addEventListener("click", () => nudge(10));
  $("rePegarTramo").addEventListener("click", pegarEnTramo);
  $("rePegarCursor").addEventListener("click", pegarEnCursor);
  $("reDeshacer").addEventListener("click", deshacer);
  $("reRehacer").addEventListener("click", rehacer);
  $("reRegular").addEventListener("click", regularizar);
  $("reAlCursor").addEventListener("click", pulsoAlCursor);
  $("reMenos").addEventListener("click", () => moverPulsos(-0.01));
  $("reMas").addEventListener("click", () => moverPulsos(0.01));
  $("reGuardar").addEventListener("click", guardar);
  $("reProbar").addEventListener("click", probar);
  $("reExportar").addEventListener("click", exportar);
  $("reImportar").addEventListener("click", () => $("reArchivo").click());
  $("reArchivo").addEventListener("change", ev => { if (ev.target.files[0]) importar(ev.target.files[0]); ev.target.value = ""; });
  $("reBorrarGuardado").addEventListener("click", borrarGuardado);
  document.querySelectorAll("[data-banda]").forEach(b => b.addEventListener("click", () => {
    if (!tramosSel) { mensaje("Elige primero uno o más tramos en la franja de colores.", true); return; }
    regenerar(tramosSel.a, tramosSel.b, b.dataset.banda);
  }));
  [cancionEl, difEl].forEach(el => el.addEventListener("change", () => {
    if (cambios && !confirm("Hay cambios sin guardar. ¿Descartarlos?")) return;
    detener();
    notas = []; pulsos = []; tramos = []; forzadas = {}; deseleccionar(); tramosSel = null; cambios = false;
    sucio = true;
    mensaje("Carga el mapa automático o el guardado para empezar.");
  }));

  window.addEventListener("keydown", ev => {
    const tag = (ev.target && ev.target.tagName) || "";
    if (/INPUT|SELECT|TEXTAREA/.test(tag) && ev.target.type !== "range" && ev.target.type !== "checkbox") return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === "z") { ev.preventDefault(); deshacer(); return; }
    if ((ev.ctrlKey || ev.metaKey) && (k === "y" || (ev.shiftKey && k === "z"))) { ev.preventDefault(); rehacer(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k === "a") { ev.preventDefault(); seleccionarTodo(); return; }
    if (k === "escape") { deseleccionar(); sucio = true; return; }
    if ((ev.ctrlKey || ev.metaKey) && k === "c" && (seleccion.size || tramosSel)) { ev.preventDefault(); if (seleccion.size) copiarSeleccion(); else copiarTramos(); return; }
    if ((ev.ctrlKey || ev.metaKey) && k === "v" && portapapeles) {
      ev.preventDefault();
      if (portapapeles.soloNotas || !tramosSel) pegarEnCursor(); else pegarEnTramo();
      return;
    }
    if (k === " ") { ev.preventDefault(); alternarReproduccion(); }
    else if (k === "delete" || k === "backspace") { ev.preventDefault(); borrarSeleccion(); }
    else if (k === "h") alternarLarga();
    else if (k === "d") alternarDoble();
    else if (k === "f") cambiarCarril();
    else if (k === "arrowleft" && seleccion.size) { ev.preventDefault(); nudge(-10); }
    else if (k === "arrowright" && seleccion.size) { ev.preventDefault(); nudge(10); }
  });

  window.addEventListener("beforeunload", ev => { if (cambios) { ev.preventDefault(); ev.returnValue = ""; } });
  if (window.ResizeObserver) new ResizeObserver(() => { sucio = true; }).observe(lienzo);

  requestAnimationFrame(bucle);

  // Lo usan los apartados extra de la página (js/ritmo-editor-extras.js)
  window.RitmoEditor = { recargarCanciones, mensaje, hayCambios: () => cambios };

  if (/[?&]debug\b/.test(location.search)) {
    window.__editor = {
      estado: () => ({ notas: notas.length, pulsos: pulsos.length, tramos: tramos.length, seleccion: seleccion.size, tramosSel, cambios, hist: historial.length }),
      notas: () => notas, pulsos: () => pulsos, tramos: () => tramos, cargarAutomatico, regenerar,
      fijarTramos: (a, b) => { tramosSel = { a, b }; }, limpiarNotas, ajustar, buscar,
      copiarTramos, copiarSeleccion, pegarEnTramo, pegarEnCursor, completarDesdeCursor, portapapeles: () => portapapeles,
      seleccion: () => seleccion, seleccionarTodo, seleccionarDelTramo, borrarSeleccion, alternarLarga, alternarDoble, cambiarCarril, nudge,
      guardable: () => AN.guardable(notas, pulsos), dibujar: () => { sucio = true; dibujar(); }
    };
  }
})();
