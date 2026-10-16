/* Mi habitación: tu colección, tus mazos y la forja. Los corrales donde crían tus criaturas viven en su propia pantalla (corrales.html,
   js/corrales.js); aquí solo se ve, en la lámpara de la puerta, si hay una cría lista. La forja es js/forja.js. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const NS = "http://www.w3.org/2000/svg";

  let supa = null, perfil = null, colec = null, hayCorrales = false;

  function aviso(t, error) {
    const a = $("hbAviso");
    a.textContent = t || "";
    a.classList.toggle("hidden", !t);
    a.classList.toggle("hb-error", !!error);
  }

  /* ------------------------------------------------------------------ escena */
  function el(tag, attrs, html) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (html) e.innerHTML = html;
    return e;
  }
  function decorar() {
    const t = $("hbTablones"), s = $("hbSuelo");
    for (let i = 0; i <= 960; i += 48) t.appendChild(el("rect", { x: i, y: 0, width: 2, height: 296, fill: "#231a2d" }));
    for (let y = 330, k = 0; y < 540; y += 30, k++) {
      s.appendChild(el("rect", { x: 0, y, width: 960, height: 2, fill: "#46301f" }));
      for (let x = (k % 2) * 90; x < 960; x += 180) s.appendChild(el("rect", { x, y, width: 2, height: 30, fill: "#46301f" }));
    }
  }
  // Los lomos de la estantería se llenan según cuánto del álbum tienes
  function lomos(pct) {
    const colores = ["#b6453f", "#3b6aa8", "#d4a43a", "#4f8f4a", "#7a4fa0", "#c9703a", "#2f8a8a", "#a8546a"];
    const g = $("hbLomos"); g.innerHTML = "";
    const filas = [[64, 48], [124, 48], [184, 48], [244, 40]], porFila = 10, total = filas.length * porFila;
    const llenos = Math.round(total * Math.max(0, Math.min(1, pct)));
    let n = 0;
    filas.forEach(([y, alto]) => {
      let x = 790;
      for (let i = 0; i < porFila; i++, n++) {
        const w = 10 + ((n * 7) % 5), h = alto - 6 - ((n * 5) % 12);
        if (x + w > 922) break;
        g.appendChild(el("rect", { class: "hb-lomo", x, y: y + alto - h, width: w, height: h, fill: n < llenos ? colores[(n * 3) % colores.length] : "#2a1b10", opacity: n < llenos ? 1 : .55 }));
        x += w + 2;
      }
    });
  }

  /* ------------------------------------------------------------------ cajas laterales y lámpara */
  function pintarLados() {
    let filas = `<div class="hb-fila"><span>Jugador</span><b>${esc(perfil && perfil.username || "Tú")}</b></div>`;
    const ver = hayCorrales && window.Corrales.ver();
    if (ver) {
      const crias = ver.corrales.filter(c => c.cria), listas = crias.filter(c => window.Corrales.estado(c).tipo === "listo");
      filas += `<div class="hb-fila"><span>Crías en marcha</span><b>${crias.length}</b></div>
        <div class="hb-fila"><span>Listas para recoger</span><b>${listas.length ? `<span class="hb-pildora hb-ok">${listas.length}</span>` : "0"}</b></div>`;
    }
    $("hbTu").innerHTML = filas;
    if (colec) {
      const visibles = (window.CARTAS || []).filter(c => !c.borrador);
      const unicas = [...colec.cartas.entries()].filter(([id, n]) => n > 0 && visibles.some(c => c.id === id)).length;
      const copias = [...colec.cartas.values()].reduce((s, n) => s + n, 0);
      const pct = visibles.length ? unicas / visibles.length : 0;
      const criaturas = visibles.filter(c => c.tipo === "Criatura");
      const criaturasMias = criaturas.filter(c => (colec.cartas.get(c.id) || 0) > 0).length;
      $("hbColeccion").innerHTML = `<div class="hb-fila"><span>Cartas distintas</span><b>${unicas} / ${visibles.length}</b></div>
        <div class="hb-barra-colec"><i style="width:${Math.round(pct * 100)}%"></i></div>
        <div class="hb-fila"><span>Copias en total</span><b>${copias}</b></div>
        <div class="hb-fila"><span>Criaturas distintas</span><b>${criaturasMias} / ${criaturas.length}</b></div>`;
      lomos(pct);
    }
  }
  // La lámpara de la puerta de los corrales: verde si hay una cría lista, azul si hay alguna en marcha, ámbar si se puede criar
  function pintarLampara() {
    const l = $("hbLampaCorrales"), ver = hayCorrales && window.Corrales.ver();
    if (!l || !ver) return;
    const tipos = ver.corrales.map(c => window.Corrales.estado(c).tipo);
    const t = tipos.includes("listo") ? "listo" : tipos.includes("cria") ? "cria" : tipos.includes("disponible") ? "disponible" : "";
    l.setAttribute("class", `hb-lampara${t ? " hb-e-" + t : ""}`);
    $("hbPuertaCorrales").setAttribute("aria-label", `Los corrales: el patio donde crían tus criaturas${t === "listo" ? " (hay una cría lista)" : ""}`);
  }

  async function cargar() {
    try { colec = await CartasCliente.coleccion(); } catch (e) { /* sin colección */ }
    try { await window.Corrales.cargar(); hayCorrales = true; } catch (e) { hayCorrales = false; }   // sin la crianza instalada solo faltan la lámpara y los números
    pintarLados(); pintarLampara();
  }

  /* ------------------------------------------------------------------ arranque */
  /* Los carteles con el nombre de cada objeto van en una capa que se pinta la última y solo se ven con el cursor o el teclado */
  function capaEtiquetas() {
    const capa = $("hbEtiquetas");
    if (!capa) return;
    document.querySelectorAll("#hbEscena a.lb-spot, #hbEscena .hb-forja").forEach(zona => {
      const t = zona.querySelector("text.hb-etq");
      if (!t) return;
      capa.appendChild(t);
      const ver = () => t.classList.add("hb-etq-ver"), ocultar = () => t.classList.remove("hb-etq-ver");
      zona.addEventListener("pointerenter", ver); zona.addEventListener("pointerleave", ocultar);
      zona.addEventListener("focus", ver); zona.addEventListener("blur", ocultar);
    });
  }

  async function iniciar() {
    decorar();
    capaEtiquetas();
    lomos(0);
    const forja = $("hbForja");
    forja.addEventListener("click", () => window.Forja.abrir());
    forja.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); window.Forja.abrir(); } });
    let sesion = null;
    try { sesion = await fichasSesionActual(); } catch (e) { sesion = null; }
    if (!sesion) {
      aviso("Inicia sesión para entrar en tu habitación.");
      $("hbCuerpo").classList.add("hidden");
      return;
    }
    supa = await fichasCliente();
    try {
      const rol = await CartasCliente.verificarRol();
      await CartasCliente.cargarDefiniciones(rol.puede);
    } catch (e) { /* las cartas se verán por su id */ }
    try { const r = await supa.from("perfiles").select("username, side").eq("user_id", sesion.user.id).maybeSingle(); perfil = r.data; } catch (e) { perfil = null; }
    await cargar();
    setInterval(() => { if (!document.hidden) cargar().catch(() => {}); }, 30000);
    setInterval(pintarLampara, 15000);
  }
  iniciar();
})();
