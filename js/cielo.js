/* =============================================================================
   EL CIELO DE LAS VENTANAS
   Las ventanas (cualquier <svg class="cielo-ventana"> con width y height: la de la taberna, la de Mi habitación, el cielo de los Establos y
   la ventana del Despacho) ya no son siempre de noche: el cielo sigue la hora de
   quien mira (amanecer, día, atardecer, noche; el sol y la luna recorren el cielo) y a veces cambia el clima: nublado, lluvia, tormenta,
   niebla y, rara vez y solo en invierno, nieve.
   El clima sale de la fecha y de un tramo de tres horas, así que todos ven el mismo mientras dura ese tramo y cambia de vez en cuando.
   También tiñe un poco la sala entera (#lbTinte, #hbTinte) y la luz que entra por la ventana (#lbHaz).
   Cielo.estado(fecha) devuelve { fase, clima, hora }; ?cielo=lluvia&hora=21 en la URL fuerza clima y hora para probarlo.
============================================================================= */
window.Cielo = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const CLIMAS = [["despejado", 48], ["nublado", 24], ["lluvia", 15], ["tormenta", 5], ["niebla", 5], ["nieve", 3]];
  const FASES = {
    noche: ["#0b1030", "#10163a", "#1a2250"],
    amanecer: ["#6b5b95", "#e88f6a", "#f6c177"],
    dia: ["#4f9ee6", "#6fb4e8", "#a5d6f4"],
    atardecer: ["#3b3a78", "#c9703a", "#f2a65a"]
  };
  const NOMBRE_FASE = { noche: "de noche", amanecer: "amanece", dia: "de día", atardecer: "atardece" };
  const NOMBRE_CLIMA = { despejado: "despejado", nublado: "nublado", lluvia: "llueve", tormenta: "tormenta", niebla: "con niebla", nieve: "nieva" };

  function azar(texto) {            // número estable entre 0 y 1 a partir de un texto
    let h = 2166136261;
    for (const c of texto) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }
  const param = n => { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } };

  function estado(fecha) {
    const f = fecha || new Date();
    let hora = f.getHours() + f.getMinutes() / 60;
    const forzada = parseFloat(param("hora"));
    if (Number.isFinite(forzada)) hora = ((forzada % 24) + 24) % 24;
    const fase = hora < 5.5 ? "noche" : hora < 7.5 ? "amanecer" : hora < 17.5 ? "dia" : hora < 19.5 ? "atardecer" : "noche";
    let clima;
    const pedido = param("cielo");
    if (pedido && CLIMAS.some(c => c[0] === pedido)) clima = pedido;
    else {
      const r = azar(`${f.getFullYear()}-${f.getMonth()}-${f.getDate()}-${Math.floor(hora / 3)}`) * CLIMAS.reduce((s, c) => s + c[1], 0);
      let acum = 0;
      clima = "despejado";
      for (const [nombre, peso] of CLIMAS) { acum += peso; if (r < acum) { clima = nombre; break; } }
      if (clima === "nieve" && ![11, 0, 1].includes(f.getMonth())) clima = "lluvia";   // la nieve solo en invierno
    }
    return { fase, clima, hora };
  }

  const rect = (x, y, w, h, fill, extra) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${extra || ""}/>`;

  function nube(x, y, escala, color) {
    const e = escala;
    return `<g fill="${color}">${rect(x + 6 * e, y, 20 * e, 6 * e, color)}${rect(x, y + 5 * e, 36 * e, 7 * e, color)}${rect(x + 10 * e, y - 4 * e, 12 * e, 6 * e, color)}</g>`;
  }

  /* Dibuja el cielo dentro de un <svg> anidado (w x h) */
  function pintar(svg, w, h, st) {
    svg.style.setProperty("--cae", h + "px");
    const [alto, medio, bajo] = FASES[st.fase];
    const cubierto = st.clima === "nublado" || st.clima === "lluvia" || st.clima === "tormenta" || st.clima === "niebla" || st.clima === "nieve";
    const oscuro = st.clima === "tormenta" ? 0.5 : st.clima === "lluvia" ? 0.34 : st.clima === "nublado" || st.clima === "nieve" ? 0.2 : 0;
    let s = rect(0, 0, w, h * 0.4, alto) + rect(0, h * 0.4, w, h * 0.3, medio) + rect(0, h * 0.7, w, h * 0.3, bajo);

    // Estrellas, solo de noche y si el cielo está claro
    if (st.fase === "noche") {
      const estrellas = [[0.12, 0.14], [0.34, 0.08], [0.55, 0.2], [0.78, 0.1], [0.9, 0.3], [0.2, 0.36], [0.66, 0.42], [0.44, 0.3]];
      const op = cubierto ? (st.clima === "nublado" ? 0.25 : 0) : 1;
      if (op) s += `<g class="cielo-estrellas" opacity="${op}">${estrellas.map(([a, b], i) => rect(Math.round(a * w), Math.round(b * h), 2, 2, i % 3 ? "#fff" : "#cfd8ff", ` class="cielo-titila" style="animation-delay:${i * 0.4}s"`)).join("")}</g>`;
    }

    // Sol o luna siguiendo un arco por el cielo
    const diaSol = st.hora >= 6 && st.hora < 19.5;
    const t = diaSol ? (st.hora - 6) / 13.5 : (((st.hora + 24 - 19.5) % 24) / 10.5);
    const cx = Math.round(w * 0.12 + w * 0.7 * Math.min(1, Math.max(0, t))), cy = Math.round(h * 0.66 - Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * h * 0.5);
    const velo = cubierto ? (st.clima === "nublado" || st.clima === "nieve" ? 0.5 : 0.18) : 1;
    if (diaSol) {
      const color = st.fase === "dia" ? "#fff1b0" : "#ffd27a";
      s += `<g opacity="${velo}">${rect(cx - 6, cy - 6, 12, 12, color)}${rect(cx - 9, cy - 2, 18, 4, color, ' opacity=".6"')}${rect(cx - 2, cy - 9, 4, 18, color, ' opacity=".6"')}</g>`;
    } else {
      s += `<g opacity="${velo}">${rect(cx - 7, cy - 7, 14, 14, "#f2ead2")}${rect(cx - 3, cy - 8, 11, 12, alto)}</g>`;
    }

    // Nubes
    const nubes = st.clima === "despejado" ? (azar("n" + Math.floor(st.hora / 3)) < 0.45 ? 1 : 0) : st.clima === "nublado" ? 3 : st.clima === "niebla" ? 2 : st.clima === "nieve" ? 3 : st.clima === "lluvia" ? 4 : 5;
    const colorNube = st.clima === "tormenta" ? "#4a4f62" : st.clima === "lluvia" ? "#7a8296" : st.fase === "noche" ? "#3b4468" : st.fase === "dia" ? "#f4f8ff" : "#e8c8b0";
    for (let i = 0; i < nubes; i++) {
      const x = Math.round((i * 0.37 + 0.02) * w) % Math.max(10, w - 30), y = Math.round((0.06 + (i % 3) * 0.16) * h);
      s += `<g class="cielo-nube" style="animation-duration:${34 + i * 9}s;animation-delay:${-i * 11}s">${nube(x, y, st.clima === "despejado" ? 0.7 : 1, colorNube)}</g>`;
    }
    if (oscuro) s += rect(0, 0, w, h, st.fase === "noche" ? "#05060f" : "#4a5266", ` opacity="${oscuro}"`);

    // Lluvia, tormenta, nieve y niebla
    if (st.clima === "lluvia" || st.clima === "tormenta") {
      const gotas = st.clima === "tormenta" ? 18 : 12;
      s += `<g class="cielo-lluvia" fill="#a9c4e8">${Array.from({ length: gotas }, (_, i) => rect(Math.round(((i * 37) % 97) / 97 * (w - 2)), 0, 1, 6, "#a9c4e8", ` class="cielo-gota" style="animation-delay:${-((i * 0.17) % 0.7).toFixed(2)}s;animation-duration:${st.clima === "tormenta" ? 0.45 : 0.65}s"`)).join("")}</g>`;
    }
    if (st.clima === "tormenta") s += rect(0, 0, w, h, "#fff", ' class="cielo-rayo" opacity="0"');
    if (st.clima === "nieve") {
      s += `<g>${Array.from({ length: 12 }, (_, i) => rect(Math.round(((i * 53) % 89) / 89 * (w - 2)), 0, 2, 2, "#fff", ` class="cielo-copo" style="animation-delay:${-((i * 0.53) % 4).toFixed(2)}s"`)).join("")}</g>`;
    }
    if (st.clima === "niebla") {
      s += [0.45, 0.62, 0.8].map((y, i) => rect(0, Math.round(y * h), w * 2, Math.round(h * 0.14), "#d5dae4", ` class="cielo-niebla" opacity=".42" style="animation-delay:${-i * 7}s"`)).join("");
      s += rect(0, 0, w, h, "#cfd3dc", ' opacity=".25"');
    }
    svg.innerHTML = s + `<title>${NOMBRE_FASE[st.fase][0].toUpperCase() + NOMBRE_FASE[st.fase].slice(1)}, ${NOMBRE_CLIMA[st.clima]}</title>`;
  }

  function tinte(st) {
    const base = { noche: ["#0c1246", 0.2], amanecer: ["#e68c5a", 0.07], dia: ["#ffffff", 0], atardecer: ["#d26e32", 0.1] }[st.fase];
    let [color, op] = base;
    if (st.clima === "lluvia" || st.clima === "nieve") { color = st.fase === "noche" ? color : "#1c2236"; op = Math.max(op, 0.1); }
    if (st.clima === "tormenta") { color = "#10141f"; op = Math.max(op, 0.2); }
    if (st.clima === "niebla") { color = "#aab0bd"; op = Math.max(op, 0.08); }
    return { color, op };
  }

  function aplicar() {
    const st = estado();
    document.querySelectorAll("svg.cielo-ventana").forEach(e => { const w = parseFloat(e.getAttribute("width")), h = parseFloat(e.getAttribute("height")); if (w && h) pintar(e, w, h, st); });
    // El suelo que se ve por las ventanas (el patio de la puerta de los corrales) también cambia con la hora y el clima
    const suelo = st.clima === "nieve" ? "#e9f4fa" : { dia: "#6fa86b", amanecer: "#5f8f66", atardecer: "#4f7a52", noche: "#1d3a30" }[st.fase];
    document.querySelectorAll(".cielo-suelo").forEach(e => { e.setAttribute("fill", suelo); e.setAttribute("opacity", st.clima === "lluvia" || st.clima === "tormenta" ? "0.8" : "1"); });
    const t = tinte(st);
    ["lbTinte", "hbTinte", "salaTinte", "coTinte"].forEach(id => { const e = document.getElementById(id); if (e) { e.setAttribute("fill", t.color); e.setAttribute("opacity", String(t.op)); } });
    const haz = document.getElementById("lbHaz");
    if (haz) {
      const claro = st.clima === "despejado";
      haz.style.fill = st.fase === "noche" ? "var(--lb-luna, #f2ead2)" : st.fase === "dia" ? "#fff1b0" : "#ffb070";
      haz.setAttribute("fill-opacity", String(st.fase === "noche" ? (claro ? 0.1 : 0.035) : claro ? 0.12 : 0.04));
    }
    document.documentElement.dataset.cielo = `${st.fase} ${st.clima}`;
    return st;
  }

  function iniciar() { aplicar(); setInterval(aplicar, 5 * 60 * 1000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
  return { estado, aplicar, pintar };
})();
