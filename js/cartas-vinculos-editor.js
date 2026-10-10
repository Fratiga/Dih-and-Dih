/* Editor de sinergias (círculos y lazos) y rivalidades de Triunfos. Lo ve quien puede editar cartas.
   Edita solo los datos (miembros, niveles, bonos). Los efectos de código de una rivalidad
   (alMatarContra, alMorirPropia...) viven en js/cartas-vinculos.js y se conservan tal cual. */
window.VinculosEditor = (function () {
  const { esc } = window.CartasVista;
  const $ = id => document.getElementById(id);
  const PALABRAS = ["arrollar", "desafiante", "duro", "esquivo", "provocar", "veloz", "volar"];
  const TIPOS = { circulo: "Círculo", lazo: "Lazo", rivalidad: "Rivalidad" };

  let dlg, listaEl, formEl, st = null; // st: { id, nuevo, tipo, v, base }

  const clonar = o => JSON.parse(JSON.stringify(o));
  const nombreCarta = id => { const c = window.cartaPorId && window.cartaPorId(id); return c ? c.nombre : id; };
  const slug = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  /* --- Lectura de lo que hay ahora (archivo + servidor) --- */
  function todos() {
    const V = window.CARTAS_VINCULOS;
    return [
      ...V.circulos.map(c => ({ tipo: c.tipo === "lazo" ? "lazo" : "circulo", v: c })),
      ...V.rivalidades.map(r => ({ tipo: "rivalidad", v: r }))
    ];
  }
  const filaDe = id => (CartasCliente.vinculosGuardados() || []).find(f => f.id === id);
  const enArchivo = id => { const b = window.vinculosBase(); return b.circulos.includes(id) || b.rivalidades.includes(id); };

  /* --- Ruta tipo "niveles.0.ind.coach.atq" sobre el estado --- */
  function ir(obj, ruta, crear) {
    const partes = ruta.split(".");
    let o = obj;
    for (let i = 0; i < partes.length - 1; i++) {
      const k = partes[i];
      if (o[k] === undefined || o[k] === null) { if (!crear) return null; o[k] = /^\d+$/.test(partes[i + 1]) ? [] : {}; }
      o = o[k];
    }
    return { o, k: partes[partes.length - 1] };
  }
  const leer = (ruta) => { const r = ir(st.v, ruta, false); return r ? r.o[r.k] : undefined; };
  function poner(ruta, valor) {
    const r = ir(st.v, ruta, true);
    if (valor === undefined || valor === null || valor === "" || valor === false) delete r.o[r.k]; else r.o[r.k] = valor;
  }

  /* --- Piezas del formulario --- */
  const num = (ruta, etiqueta, min = 0, max = 99) =>
    `<label class="vinc-num">${etiqueta}<input type="number" data-p="${ruta}" data-t="n" min="${min}" max="${max}" step="1" value="${leer(ruta) ?? ""}"></label>`;
  const marca = (ruta, etiqueta) =>
    `<label class="vinc-marca"><input type="checkbox" data-p="${ruta}" data-t="b"${leer(ruta) ? " checked" : ""}> ${etiqueta}</label>`;
  const palabras = (ruta, etiqueta) => {
    const act = leer(ruta) || [];
    return `<span class="vinc-palabras"><span>${etiqueta}</span>${PALABRAS.map(w =>
      `<label><input type="checkbox" data-p="${ruta}" data-t="arr" data-v="${w}"${act.includes(w) ? " checked" : ""}> ${w}</label>`).join("")}</span>`;
  };
  function chips(ruta, vacio) {
    const l = leer(ruta) || [];
    return `<div class="vinc-chips">${l.map((id, i) =>
      `<span class="vinc-chip" title="${esc(id)}">${esc(nombreCarta(id))}<button type="button" data-quitar="${ruta}" data-i="${i}" aria-label="Quitar">×</button></span>`).join("")}
      <input type="text" list="vincCartas" data-add="${ruta}" placeholder="${esc(vacio || "Añadir carta...")}"></div>`;
  }
  /* Bono de un nivel / de un grupo / de un bando: ataque, vida, reduce, barrera, palabras que gana y que pierde */
  const bono = (ruta, conGuarda) => `
    <div class="vinc-bono">
      ${num(ruta + ".atq", "Ataque", -9, 9)}${num(ruta + ".pv", "Vida", -9, 9)}${num(ruta + ".reduce", "Reduce el daño", 0, 9)}
      ${marca(ruta + ".barrera", "Barrera")}
      ${palabras(ruta + ".palabras", "Gana:")}
      <details><summary>Pierde${(leer(ruta + ".quita") || []).length ? ` (${leer(ruta + ".quita").length})` : ""}${conGuarda ? " · Cubre" : ""}</summary>
        ${palabras(ruta + ".quita", "Pierde:")}
        ${conGuarda ? `<div class="vinc-cubre"><span>Cubre a (el golpe lo recibe esta carta):</span>${chips(ruta + ".guarda", "Carta a la que cubre...")}</div>` : ""}
      </details>
    </div>`;

  function formCirculo() {
    const v = st.v, miembros = v.miembros || [];
    const niveles = (v.niveles || []).map((n, i) => `
      <fieldset class="vinc-nivel">
        <legend>Nivel ${i + 1}</legend>
        <div class="vinc-fila">${num(`niveles.${i}.n`, "Con cuántas cartas juntas", 2, 12)}
          <button type="button" class="cartas-boton" data-quita-nivel="${i}">Quitar nivel</button></div>
        <p class="vinc-ayuda">Cada miembro gana esto:</p>
        ${bono(`niveles.${i}`, false)}
        <details><summary>Bonos de una sola carta${Object.keys(n.ind || {}).length ? ` (${Object.keys(n.ind).length})` : ""}</summary>
          ${miembros.map(id => `<div class="vinc-ind"><b>${esc(nombreCarta(id))}</b>${bono(`niveles.${i}.ind.${id}`, true)}</div>`).join("") || "<p class='vinc-ayuda'>Añade miembros primero.</p>"}
        </details>
      </fieldset>`).join("");
    const comp = v.completo;
    return `
      <div class="vinc-grupo"><span class="vinc-etq">Miembros</span>${chips("miembros")}</div>
      <p class="vinc-ayuda">Cada miembro gana el bono del nivel más alto que alcance el número de miembros distintos en su campo.</p>
      ${niveles}
      <button type="button" class="cartas-boton" data-nuevo-nivel>+ Nivel</button>
      <fieldset class="vinc-nivel">
        <legend><label class="vinc-marca"><input type="checkbox" data-completo${comp ? " checked" : ""}> Bono extra si están todas las cartas de una lista</label></legend>
        ${comp ? `
          <label>Nombre que sale en el registro <input type="text" data-p="completo.nombre" data-t="s" maxlength="160" value="${esc(comp.nombre || "")}"></label>
          <div class="vinc-grupo"><span class="vinc-etq">Cartas que se necesitan</span>${chips("completo.requiere")}</div>
          ${bono("completo", false)}
          <details><summary>Bonos de una sola carta${Object.keys(comp.ind || {}).length ? ` (${Object.keys(comp.ind).length})` : ""}</summary>
            ${(comp.requiere || []).map(id => `<div class="vinc-ind"><b>${esc(nombreCarta(id))}</b>${bono(`completo.ind.${id}`, true)}</div>`).join("")}
          </details>` : ""}
      </fieldset>`;
  }

  function formRivalidad() {
    const viva = st.nuevo ? null : window.CARTAS_VINCULOS.rivalidades.find(r => r.id === st.id);
    const codigo = [];
    ["paraBando", "paraContra"].forEach(k => Object.keys((viva && viva[k]) || {}).forEach(h => { if (typeof viva[k][h] === "function") codigo.push(h); }));
    return `
      <div class="vinc-grupo"><span class="vinc-etq">Bando (el que persigue)</span>${chips("bando")}</div>
      <div class="vinc-grupo"><span class="vinc-etq">Contra (la rival)</span>${chips("contra")}</div>
      <p class="vinc-ayuda">Se activa cuando hay una carta del bando en un campo y una de las rivales en el otro. Es secreta: las cartas no lo dicen, solo el registro de la partida.</p>
      <fieldset class="vinc-nivel"><legend>Lo que gana el bando</legend>
        ${bono("paraBando", false)}
        <div class="vinc-fila">${num("paraBando.bonusContra", "Daño extra contra la rival", 0, 9)}
          ${marca("paraBando.marca", "Puede desafiarla aunque haya Provocar")}
          ${marca("paraBando.anulaAlMorirContra", "Si la mata, su habilidad al morir no ocurre")}</div>
      </fieldset>
      <fieldset class="vinc-nivel"><legend>Lo que gana la rival</legend>
        ${bono("paraContra", false)}
        <div class="vinc-fila">${num("paraContra.bonusContra", "Daño extra contra el bando", 0, 9)}</div>
      </fieldset>
      ${codigo.length ? `<p class="vinc-ayuda">Efectos especiales de código que se conservan y no se editan aquí: ${codigo.map(esc).join(", ")}.</p>` : ""}`;
  }

  function pintarForm() {
    if (!st) {
      formEl.innerHTML = `<p class="vinc-ayuda">Elige un vínculo de la lista o crea uno nuevo.</p>`;
      return;
    }
    const v = st.v;
    const origen = filaDe(st.id);
    formEl.innerHTML = `
      <h3>${st.nuevo ? "Nuevo" : "Editar"}: ${TIPOS[st.tipo]}</h3>
      <div class="carta-editor-grupo">
        <label>Nombre <input type="text" data-p="nombre" data-t="s" maxlength="80" value="${esc(v.nombre || "")}" required></label>
        ${st.nuevo ? `<label>Identificador <input type="text" id="vincId" maxlength="60" pattern="[a-z0-9\\-]{1,60}" value="${esc(st.id)}"></label>` : ""}
        ${st.nuevo && st.tipo !== "rivalidad" ? `<label>Clase <select id="vincClase"><option value="circulo"${st.tipo === "circulo" ? " selected" : ""}>Círculo (varias cartas)</option><option value="lazo"${st.tipo === "lazo" ? " selected" : ""}>Lazo (dos cartas)</option></select></label>` : ""}
      </div>
      <label>Texto (lo que se lee ${st.tipo === "rivalidad" ? "en el registro" : "en el álbum"}) <textarea data-p="texto" data-t="s" rows="2" maxlength="600">${esc(v.texto || "")}</textarea></label>
      ${st.tipo === "rivalidad" ? formRivalidad() : formCirculo()}
      <datalist id="vincCartas">${(window.CARTAS || []).map(c => `<option value="${esc(c.nombre)} · ${esc(c.id)}"></option>`).join("")}</datalist>
      <p id="vincEstado" class="carta-editor-estado"></p>
      <div class="carta-editor-botones">
        <button type="submit" class="cartas-boton cartas-boton-principal">Guardar</button>
        ${st.nuevo ? "" : `<button type="button" class="cartas-boton cartas-boton-peligro" data-borrar>${enArchivo(st.id) ? "Quitar de la partida" : "Borrar"}</button>`}
        ${origen && enArchivo(st.id) ? `<button type="button" class="cartas-boton" data-restaurar>Volver al original</button>` : ""}
      </div>`;
  }

  function pintarLista() {
    const filas = CartasCliente.vinculosGuardados() || [];
    const quitados = filas.filter(f => f.borrado);
    const item = ({ tipo, v }) => {
      const f = filas.find(x => x.id === v.id);
      const marcaTxt = f ? (enArchivo(v.id) ? "editado" : "nuevo") : "";
      return `<button type="button" class="vinc-item${st && st.id === v.id ? " activo" : ""}" data-abrir="${esc(v.id)}">${esc(v.nombre)}${marcaTxt ? ` <i>${marcaTxt}</i>` : ""}</button>`;
    };
    const grupo = (titulo, tipos) => {
      const l = todos().filter(x => tipos.includes(x.tipo));
      return `<h4>${titulo}</h4>${l.map(item).join("") || "<p class='vinc-ayuda'>Ninguno.</p>"}`;
    };
    listaEl.innerHTML = `
      <div class="vinc-nuevos">
        <button type="button" class="cartas-boton" data-nuevo="circulo">+ Círculo</button>
        <button type="button" class="cartas-boton" data-nuevo="lazo">+ Lazo</button>
        <button type="button" class="cartas-boton" data-nuevo="rivalidad">+ Rivalidad</button>
      </div>
      ${grupo("Círculos", ["circulo"])}${grupo("Lazos", ["lazo"])}${grupo("Rivalidades", ["rivalidad"])}
      ${quitados.length ? `<h4>Quitados</h4>${quitados.map(f => `<button type="button" class="vinc-item quitado" data-restaurar-id="${esc(f.id)}">${esc(f.id)} <i>volver a ponerlo</i></button>`).join("")}` : ""}`;
  }

  function abrirVinculo(id) {
    const x = todos().find(t => t.v.id === id);
    if (!x) return;
    st = { id, nuevo: false, tipo: x.tipo, v: clonar(x.v) };
    pintarLista(); pintarForm();
  }

  function nuevoVinculo(tipo) {
    const v = tipo === "rivalidad"
      ? { nombre: "", texto: "", bando: [], contra: [], paraBando: {}, paraContra: {} }
      : { nombre: "", texto: "", miembros: [], niveles: [{ n: 2 }] };
    st = { id: "", nuevo: true, tipo, v };
    pintarLista(); pintarForm();
  }

  /* Quita ceros, falsos y vacíos para que lo guardado sea solo lo que hace algo */
  function limpiar(o) {
    if (Array.isArray(o)) return o.map(limpiar);
    if (o && typeof o === "object") {
      const r = {};
      Object.keys(o).forEach(k => {
        const x = limpiar(o[k]);
        if (x === undefined || x === null || x === "" || x === false || x === 0 && k !== "n" || (Array.isArray(x) && !x.length) ||
            (typeof x === "object" && !Array.isArray(x) && !Object.keys(x).length && k !== "paraBando" && k !== "paraContra")) return;
        r[k] = x;
      });
      return r;
    }
    return o;
  }

  function estado(t) { const e = $("vincEstado"); if (e) e.textContent = t || ""; }

  async function guardar(ev) {
    ev.preventDefault();
    if (!st) return;
    const v = limpiar(st.v);
    let id = st.id;
    if (st.nuevo) {
      id = ($("vincId").value || slug(v.nombre || "")).trim();
      if (!/^[a-z0-9-]{1,60}$/.test(id)) { estado("El identificador solo admite minúsculas, números y guiones."); return; }
      if (todos().some(t => t.v.id === id)) { estado("Ya existe un vínculo con ese identificador."); return; }
    }
    if (!v.nombre) { estado("Ponle un nombre."); return; }
    if (st.tipo === "rivalidad") {
      if (!v.bando || !v.contra) { estado("Pon al menos una carta en cada bando."); return; }
      v.paraBando = v.paraBando || {}; v.paraContra = v.paraContra || {};
    } else {
      if ((v.miembros || []).length < 2) { estado("Hacen falta al menos dos cartas."); return; }
      if (!(v.niveles || []).length) { estado("Hace falta al menos un nivel."); return; }
      if (st.tipo === "lazo" && v.miembros.length !== 2) { estado("Un lazo son exactamente dos cartas."); return; }
      if (v.completo && !(v.completo.requiere || []).length) { delete v.completo; }
      if (st.nuevo && $("vincClase")) st.tipo = $("vincClase").value;
    }
    const miembros = st.tipo === "rivalidad" ? v.bando.concat(v.contra) : v.miembros;
    const faltan = miembros.filter(m => !(window.cartaPorId && window.cartaPorId(m)));
    if (faltan.length) { estado(`No existe la carta: ${faltan[0]}`); return; }
    if (st.tipo !== "rivalidad") v.niveles.sort((a, b) => a.n - b.n);
    delete v.id;
    estado("Guardando...");
    try {
      await CartasCliente.guardarVinculo(id, st.tipo, v, false);
      estado("");
      st = null;
      abrirVinculo(id);
    } catch (e) {
      estado(`No se pudo guardar: ${e.message || e}. ¿Corriste scratchpad/cartas_vinculos.sql?`);
    }
  }

  async function quitar() {
    if (!st || st.nuevo) return;
    const enBase = enArchivo(st.id);
    if (!await dialogoConfirmar(enBase ? "¿Quitar este vínculo de las partidas? Podrás volver a ponerlo." : "¿Borrar este vínculo?")) return;
    try {
      if (enBase) await CartasCliente.guardarVinculo(st.id, st.tipo, {}, true);
      else await CartasCliente.restaurarVinculo(st.id);
      st = null; pintarLista(); pintarForm();
    } catch (e) { estado(`No se pudo: ${e.message || e}`); }
  }

  async function restaurar(id) {
    try {
      await CartasCliente.restaurarVinculo(id);
      st = null; pintarLista(); pintarForm();
    } catch (e) { estado(`No se pudo: ${e.message || e}`); }
  }

  function dialogoConfirmar(texto) {
    return window.dialogo ? window.dialogo.confirmar(texto, { peligro: true }) : Promise.resolve(window.confirm(texto));
  }

  /* Convierte lo escrito en el buscador ("Nombre · id") en un id de carta */
  function idDeTexto(t) {
    t = t.trim();
    const i = t.lastIndexOf(" · ");
    if (i >= 0) t = t.slice(i + 3);
    if (window.cartaPorId && window.cartaPorId(t)) return t;
    const c = (window.CARTAS || []).find(x => x.nombre.toLowerCase() === t.toLowerCase());
    return c ? c.id : null;
  }

  function alCambiar(ev) {
    const el = ev.target;
    if (!st) return;
    if (el.matches("[data-completo]")) {
      if (el.checked) st.v.completo = { requiere: (st.v.miembros || []).slice() }; else delete st.v.completo;
      pintarForm(); return;
    }
    if (el.matches("[data-add]")) {
      const id = idDeTexto(el.value);
      if (!id) { if (el.value.trim()) estado(`No encuentro la carta «${el.value.trim()}».`); return; }
      const l = leer(el.dataset.add) || [];
      if (!l.includes(id)) { l.push(id); poner(el.dataset.add, l); }
      pintarForm(); return;
    }
    const p = el.dataset.p;
    if (!p) return;
    if (el.dataset.t === "n") poner(p, el.value === "" ? undefined : Math.round(Number(el.value)));
    else if (el.dataset.t === "b") poner(p, el.checked);
    else if (el.dataset.t === "arr") {
      const l = (leer(p) || []).filter(x => x !== el.dataset.v);
      if (el.checked) l.push(el.dataset.v);
      poner(p, l.length ? l : undefined);
    } else poner(p, el.value);
  }

  function alClic(ev) {
    const t = ev.target.closest("button");
    if (!t) return;
    if (t.dataset.nuevo) return nuevoVinculo(t.dataset.nuevo);
    if (t.dataset.abrir) return abrirVinculo(t.dataset.abrir);
    if (t.dataset.restaurarId) return restaurar(t.dataset.restaurarId);
    if (!st) return;
    if (t.dataset.quitar) {
      const l = (leer(t.dataset.quitar) || []).slice();
      l.splice(Number(t.dataset.i), 1);
      poner(t.dataset.quitar, l.length ? l : undefined);
      return pintarForm();
    }
    if (t.hasAttribute("data-nuevo-nivel")) {
      const ult = st.v.niveles[st.v.niveles.length - 1];
      st.v.niveles.push({ n: ult ? ult.n + 1 : 2 });
      return pintarForm();
    }
    if (t.dataset.quitaNivel !== undefined) { st.v.niveles.splice(Number(t.dataset.quitaNivel), 1); return pintarForm(); }
    if (t.hasAttribute("data-borrar")) return quitar();
    if (t.hasAttribute("data-restaurar")) return restaurar(st.id);
  }

  function preparar() {
    dlg = $("vincEditor");
    if (!dlg) return;
    listaEl = $("vincLista"); formEl = $("vincForm");
    $("vincCerrar").addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", ev => { if (ev.target === dlg) dlg.close(); });
    formEl.addEventListener("submit", guardar);
    formEl.addEventListener("change", alCambiar);
    formEl.addEventListener("input", ev => { if (ev.target.dataset && (ev.target.dataset.t === "s" || ev.target.dataset.t === "n")) alCambiar(ev); });
    formEl.addEventListener("click", alClic);
    listaEl.addEventListener("click", alClic);
    formEl.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.matches("[data-add]")) { ev.preventDefault(); alCambiar({ target: ev.target }); } });
    const abrirBtn = $("vinculosAbrir");
    if (abrirBtn) abrirBtn.addEventListener("click", () => abrir());
  }

  async function abrir(id) {
    if (!dlg) return;
    await CartasCliente.cargarVinculos();
    st = null;
    pintarLista(); pintarForm();
    if (!dlg.open) dlg.showModal();
    if (id) abrirVinculo(id);
  }

  preparar();
  return { abrir };
})();
