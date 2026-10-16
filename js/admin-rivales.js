/* =============================================================================
   PESTAÑA RIVALES (panel de Admin): dificultad de los rivales de Ajedrez, Arquería y Duelo
   Los valores de fábrica se leen del propio archivo de cada juego (el literal `const RIVALES = ...`), así que no hay una segunda lista que se desincronice:
   si alguien cambia un rival en el archivo, aquí aparece con sus números nuevos. Lo que cambies se guarda en rivales_ajustes (docs/admin/rivales.sql) campo
   por campo y los juegos lo aplican encima (js/rivales-ajustes.js). «Volver al original» borra los cambios de ese rival.
   docs/pruebas-web/rivales.js comprueba que el literal de cada juego se sigue pudiendo leer.
============================================================================= */
(function () {
  const panel = document.getElementById("adminPanelRivales");
  if (!panel) return;
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const JUEGOS = {
    ajedrez: { nombre: "Ajedrez", archivo: "js/ajedrez.js", excluir: [] },
    arqueria: { nombre: "Arquería", archivo: "js/arqueria.js", excluir: [] },
    duelo: { nombre: "Duelo", archivo: "js/duelo.js", excluir: ["arma"] }
  };
  // Qué significa cada número, en palabras de quien juega. Lo que no esté aquí sale con su nombre en el archivo.
  const ETIQUETAS = {
    ajedrez: { prof: ["Jugadas que mira por adelantado", "Más = juega mejor"], tiempo: ["Tope de cálculo (milisegundos)", "Más = piensa más"], error: ["Probabilidad de elegir una jugada peor (0 a 1)", "Más = más fácil"], tiempoTotal: ["Segundos por jugador en la partida", "Menos = más apremio"] },
    arqueria: { radio: ["Tamaño de los blancos", "Menos = más difícil acertar"], vida: ["Segundos que dura un blanco", "Menos = más rápido"], desliza: ["Fracción de blancos que se mueven de lado (0 a 1)", ""], rapido: ["Fracción de blancos dorados (0 a 1)", ""],
      reaccion: ["Segundos que tarda en ver un blanco", "Menos = más difícil"], veloz: ["Velocidad de su mira (píxeles por segundo)", "Más = más difícil"], asentar: ["Segundos que tarda en estabilizar la mira", "Menos = más difícil"],
      recarga: ["Pausa entre disparos (segundos)", "Menos = más difícil"], vuelo: ["Segundos que tarda su flecha", "Menos = más difícil"], ruido: ["Cuánto se despista al elegir blanco", "Menos = más difícil"],
      precision: ["Proporción de tiros que aciertan (0 a 1)", "Más = más difícil"], dist: ["Reparto de los aciertos: centro, medio, borde", "Debe sumar 1"], intervalo: ["Segundos entre disparos", "Menos = más difícil"], velocidadBase: ["Velocidad base", ""] },
    duelo: { hp: ["Vida", ""], dano: ["Daño: mínimo y máximo", "Dos números"], reaccion: ["Segundos que tarda en reaccionar", "Menos = más difícil"], bloqueo: ["Probabilidad de bloquear (0 a 1)", "Más = más difícil"],
      esquiva: ["Probabilidad de esquivar (0 a 1)", "Más = más difícil"], agresion: ["Agresividad", "Más = ataca más seguido"], finta: ["Probabilidad de fintar (0 a 1)", ""], castigo: ["Probabilidad de castigar si te expones (0 a 1)", "Más = más difícil"],
      aviso: ["Segundos de aviso de sus ataques", "Menos = más difícil de leer"] }
  };

  /* --- Leer los valores de fábrica del archivo de cada juego --- */
  function extraerLiteral(texto, nombre) {
    const m = new RegExp(`const\\s+${nombre}\\s*=\\s*`).exec(texto);
    if (!m) return null;
    const i = m.index + m[0].length;
    if (texto[i] !== "[" && texto[i] !== "{") return null;
    let prof = 0;
    for (let j = i; j < texto.length; j++) {
      const c = texto[j];
      if (c === '"' || c === "'" || c === "`") { j++; while (j < texto.length && texto[j] !== c) { if (texto[j] === "\\") j++; j++; } continue; }
      if (c === "/" && texto[j + 1] === "/") { while (j < texto.length && texto[j] !== "\n") j++; continue; }
      if (c === "/" && texto[j + 1] === "*") { j = texto.indexOf("*/", j + 2); if (j < 0) return null; j++; continue; }
      if (c === "[" || c === "{" || c === "(") prof++;
      else if (c === "]" || c === "}" || c === ")") { prof--; if (prof === 0) return texto.slice(i, j + 1); }
    }
    return null;
  }
  async function valoresDeFabrica(juego) {
    const r = await fetch(JUEGOS[juego].archivo, { cache: "no-cache" });
    if (!r.ok) throw new Error(`No se pudo leer ${JUEGOS[juego].archivo}`);
    const literal = extraerLiteral(await r.text(), "RIVALES");
    if (!literal) throw new Error(`No encuentro la tabla de rivales en ${JUEGOS[juego].archivo}`);
    const datos = new Function(`return (${literal});`)();
    const lista = Array.isArray(datos) ? datos : Object.keys(datos).map(id => Object.assign({ id }, datos[id]));
    return lista.map(r2 => {
      const campos = [];
      Object.keys(r2).forEach(k => {
        if (k === "id" || JUEGOS[juego].excluir.includes(k)) return;
        const v = r2[k];
        if (typeof v === "number" && Number.isFinite(v)) campos.push({ k, v, lista: false });
        else if (Array.isArray(v) && v.length && v.length <= 6 && v.every(x => typeof x === "number" && Number.isFinite(x))) campos.push({ k, v: v.slice(), lista: true });
      });
      return { id: r2.id, nombre: r2.nombre || r2.id, dificultad: r2.dificultad || "", campos };
    });
  }

  /* --- Estado --- */
  let ajustes = {};            // juego -> rival -> campo -> valor (lo que hay en el servidor)
  let rivales = [];
  let juego = "ajedrez";
  const estado = (t, error) => { const e = $("adminRivalesEstado"); e.textContent = t || ""; e.classList.toggle("admin-error", !!error); };
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const texto = v => (Array.isArray(v) ? v.join(", ") : String(v));

  async function leerAjustes() {
    const { data, error } = await (await fichasCliente()).from("rivales_ajustes").select("juego, rival, campo, valor");
    if (error) throw error;
    ajustes = {};
    (data || []).forEach(f => { (((ajustes[f.juego] = ajustes[f.juego] || {})[f.rival]) = ajustes[f.juego][f.rival] || {})[f.campo] = f.valor; });
  }

  function pintar() {
    const mios = ajustes[juego] || {};
    $("adminRivalesLista").innerHTML = rivales.map(r => {
      const cambios = mios[r.id] || {};
      const filas = r.campos.map(c => {
        const [etq, ayuda] = (ETIQUETAS[juego] || {})[c.k] || [c.k, ""];
        const actual = c.k in cambios ? cambios[c.k] : null;
        return `<tr class="${actual !== null ? "admin-rivales-cambiado" : ""}"><td>${esc(etq)}${ayuda ? `<small>${esc(ayuda)}</small>` : ""}</td><td>${esc(texto(c.v))}</td>
          <td><input type="text" inputmode="decimal" data-campo="${esc(c.k)}" data-lista="${c.lista ? 1 : 0}" placeholder="${esc(texto(c.v))}" value="${actual !== null ? esc(texto(actual)) : ""}" aria-label="${esc(etq)} de ${esc(r.nombre)}"></td></tr>`;
      }).join("");
      return `<section class="admin-rival" data-rival="${esc(r.id)}"><h3>${esc(r.nombre)} <small>${esc(r.dificultad)}</small></h3>
        <table><thead><tr><th>Qué</th><th>De fábrica</th><th>Ahora</th></tr></thead><tbody>${filas}</tbody></table>
        <div class="admin-rival-botones"><button type="button" class="admin-cuenta-accion" data-guardar>Guardar</button>
        <button type="button" class="admin-cuenta-accion admin-cuenta-peligro" data-original${Object.keys(cambios).length ? "" : " disabled"}>Volver al original</button></div></section>`;
    }).join("") || `<p class="admin-vacio">Este juego no tiene rivales con números que se puedan cambiar.</p>`;
  }

  async function abrirJuego(j) {
    juego = j;
    $("adminRivalesLista").innerHTML = `<p class="admin-vacio">Leyendo los rivales...</p>`;
    try {
      await leerAjustes();
      rivales = await valoresDeFabrica(j);
      estado("");
      pintar();
    } catch (e) {
      $("adminRivalesLista").innerHTML = "";
      estado(/rivales_ajustes|relation|does not exist|schema cache/i.test(e.message || "") ? "Falta correr docs/admin/rivales.sql en Supabase." : `No se pudo cargar: ${e.message || e}`, true);
    }
  }

  function leerCampo(input, c) {
    const t = input.value.trim().replace(/,/g, c.lista ? "," : ".");
    if (!t) return { vacio: true };
    if (!c.lista) { const n = Number(t); return Number.isFinite(n) && n >= 0 ? { v: n } : { mal: true }; }
    const partes = input.value.split(/[,;]/).map(x => Number(x.trim().replace(",", ".")));
    return partes.length === c.v.length && partes.every(n => Number.isFinite(n) && n >= 0) ? { v: partes } : { mal: true };
  }

  async function guardar(seccion) {
    const r = rivales.find(x => x.id === seccion.dataset.rival);
    const sb = await fichasCliente();
    const mios = (ajustes[juego] || {})[r.id] || {};
    let hechos = 0;
    try {
      for (const input of seccion.querySelectorAll("input[data-campo]")) {
        const c = r.campos.find(x => x.k === input.dataset.campo);
        const l = leerCampo(input, c);
        if (l.mal) throw new Error(`«${input.getAttribute("aria-label")}»: escribe ${c.lista ? `${c.v.length} números separados por comas` : "un número"} (sin negativos).`);
        const hay = c.k in mios;
        if (l.vacio || igual(l.v, c.v)) {
          if (hay) { const { error } = await sb.rpc("rival_ajuste_quitar", { p_juego: juego, p_rival: r.id, p_campo: c.k }); if (error) throw error; hechos++; }
        } else if (!hay || !igual(mios[c.k], l.v)) {
          const { error } = await sb.rpc("rival_ajuste_guardar", { p_juego: juego, p_rival: r.id, p_campo: c.k, p_valor: l.v }); if (error) throw error; hechos++;
        }
      }
      await leerAjustes(); pintar();
      estado(hechos ? `Guardado lo de ${r.nombre}. Se nota en la siguiente partida que se abra.` : "No habías cambiado nada.");
    } catch (e) { estado(`No se pudo guardar: ${e.message || e}`, true); }
  }
  async function volverAlOriginal(seccion) {
    const r = rivales.find(x => x.id === seccion.dataset.rival);
    if (!confirm(`¿Volver a los números de fábrica de ${r.nombre}?`)) return;
    try {
      const { error } = await (await fichasCliente()).rpc("rival_ajuste_quitar", { p_juego: juego, p_rival: r.id });
      if (error) throw error;
      await leerAjustes(); pintar(); estado(`${r.nombre} vuelve a sus números de fábrica.`);
    } catch (e) { estado(`No se pudo: ${e.message || e}`, true); }
  }

  let listo = false;
  document.querySelector('[data-tab="rivales"]').addEventListener("click", () => { if (!listo) { listo = true; abrirJuego(juego); } });
  $("adminRivalesJuego").addEventListener("change", ev => abrirJuego(ev.target.value));
  $("adminRivalesLista").addEventListener("click", ev => {
    const s = ev.target.closest(".admin-rival");
    if (!s) return;
    if (ev.target.closest("[data-guardar]")) guardar(s);
    else if (ev.target.closest("[data-original]")) volverAlOriginal(s);
  });
  window.AdminRivales = { extraerLiteral };
})();
