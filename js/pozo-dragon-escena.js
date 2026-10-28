/* =============================================================================
   EL POZO DEL DRAGÓN: la escena de cada tirada (dados 3D que ruedan y rebotan, contador del premio, monedas que caen, vuelan o se consumen).
   Aquí no hay reglas ni red: todo lo que se anima enseña un resultado que el servidor ya decidió. Sin librerías: CSS 3D y la Web Animations API.
   Ritmo: cada espera y cada animación pasa por ms(), así que se puede acelerar («tiradas rápidas») o saltar entera (saltar()). Con prefers-reduced-motion no se anima nada.
============================================================================= */
window.PozoEscena = (function () {
  // Qué giro del cubo deja de frente la cara v. Las caras son 1 delante, 6 detrás, 2 a la derecha, 5 a la izquierda, 3 arriba y 4 abajo (las opuestas suman 7).
  const ORIENTACION = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  // La inclinación fija con la que se ve cada dado de reposo, para que se note que es un cubo y no un dibujo plano
  const INCLINACION = [[-22, -28], [-26, 24], [-20, 32]];
  const CARAS = [1, 2, 3, 4, 5, 6].map(n => `<i class="pz-d3-cara c${n}"></i>`).join("");

  const R = { factor: 1, saltando: false, forzar: false, animaciones: new Set(), esperas: new Set() };
  // Con «reducir movimiento» en el sistema no se anima nada, salvo que el jugador lo pida a mano (forzar): los dados que ruedan son lo esencial del juego
  const reducido = () => !R.forzar && !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const ms = n => (R.saltando ? 0 : Math.round(n * R.factor));
  const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
  const aleatorio = (a, b) => a + Math.random() * (b - a);
  const arte = () => window.PozoArte;

  function esperar(n) {
    const t = ms(n);
    if (t <= 0) return Promise.resolve();
    return new Promise(ok => { const fin = () => { clearTimeout(id); R.esperas.delete(fin); ok(); }; const id = setTimeout(fin, t); R.esperas.add(fin); });
  }
  // Anima un elemento y avisa cuando acaba (o cuando se salta la escena). Si no se puede animar, no espera nada.
  function animar(el, fotogramas, opciones) {
    if (!el || !el.animate || reducido() || R.saltando) return Promise.resolve();
    try {
      const o = Object.assign({ fill: "none" }, opciones, { duration: ms((opciones && opciones.duration) || 300), delay: ms((opciones && opciones.delay) || 0) });
      const a = el.animate(fotogramas, o);
      R.animaciones.add(a);
      // Si la pestaña no pinta (está en segundo plano) la animación no avanza: a su hora se da por terminada
      const limite = new Promise(ok => setTimeout(() => { try { a.finish(); } catch (e) { /* ya terminó */ } ok(); }, o.duration + o.delay + 500));
      return Promise.race([a.finished.catch(() => {}), limite]).then(() => { R.animaciones.delete(a); });
    } catch (e) { return Promise.resolve(); }
  }
  // Termina de golpe lo que esté en marcha y deja pasar las esperas: lo que falta se enseña ya
  function saltar() {
    R.saltando = true;
    R.animaciones.forEach(a => { try { a.finish(); } catch (e) { /* ya terminó */ } });
    R.esperas.forEach(fin => fin());
  }
  const nueva = () => { R.saltando = false; };
  const forzar = v => { R.forzar = !!v; };
  const ritmo = f => { R.factor = limitar(Number(f) || 1, 0.3, 2); };
  const animando = () => R.animaciones.size > 0 || R.esperas.size > 0;

  /* ---------------------------------------------------------------- dados 3D */
  function dado(valor, clase, indice) {
    const v = limitar(Math.round(Number(valor)) || 1, 1, 6), [rx, ry] = ORIENTACION[v], [tx, ty] = INCLINACION[(indice || 0) % INCLINACION.length];
    return `<span class="pz-d3${clase ? " " + clase : ""}" data-v="${v}" role="img" aria-label="Dado: ${v}" style="--tx:${tx}deg;--ty:${ty}deg"><span class="pz-d3-sombra"></span><span class="pz-d3-salto"><span class="pz-d3-cubo" style="--rx:${rx}deg;--ry:${ry}deg">${CARAS}</span></span></span>`;
  }
  const dados = (valores, clase) => (valores || []).map((v, i) => dado(v, clase, i)).join("");
  // Cambia la cara que queda arriba de un dado que ya está en la página
  function poner(el, valor) {
    if (!el) return;
    const v = limitar(Math.round(Number(valor)) || 1, 1, 6), [rx, ry] = ORIENTACION[v], cubo = el.querySelector(".pz-d3-cubo");
    el.dataset.v = String(v); el.setAttribute("aria-label", "Dado: " + v);
    if (cubo) { cubo.style.setProperty("--rx", rx + "deg"); cubo.style.setProperty("--ry", ry + "deg"); }
  }

  // Lanza los dados de la bandeja: caen desde arriba, chocan, rebotan tres veces y giran cada vez más despacio hasta quedar en su cara. T es la duración total (1,15 s).
  async function lanzar(cont, valores, opciones) {
    const o = opciones || {};
    const els = cont ? [...cont.querySelectorAll(".pz-d3")] : [];
    if (!els.length) return;
    els.forEach((d, i) => poner(d, valores[i]));
    if (R.saltando || reducido()) return;
    const T = 1150, n = els.length;
    if (o.alEmpezar) o.alEmpezar();
    const caida = setTimeout(() => { if (o.alCaer) o.alCaer(); }, ms(T * 0.36));
    const tareas = els.map((d, i) => {
      const salto = d.querySelector(".pz-d3-salto"), cubo = d.querySelector(".pz-d3-cubo"), sombra = d.querySelector(".pz-d3-sombra");
      const [rx, ry] = ORIENTACION[limitar(Math.round(Number(valores[i])) || 1, 1, 6)], [tx, ty] = INCLINACION[i % INCLINACION.length];
      const lado = i - (n - 1) / 2, dist = aleatorio(110, 160), retraso = i * 70;
      const sube = "cubic-bezier(.1,.5,.4,1)", baja = "cubic-bezier(.55,0,.9,.5)";
      const giro = k => `${(Math.random() < 0.5 ? -1 : 1) * (k + Math.floor(Math.random() * 2))}`;
      const x0 = lado === 0 ? aleatorio(-40, 40) : -Math.sign(lado) * dist, choque = lado === 0 ? 0 : Math.sign(lado) * -22;
      return Promise.all([
        animar(d, [
          { transform: `translateX(${x0}px)`, offset: 0, easing: "cubic-bezier(.2,.7,.4,1)" },
          { transform: `translateX(${choque}px)`, offset: 0.4, easing: "ease-out" },
          { transform: `translateX(${-choque * 0.35}px)`, offset: 0.62, easing: "ease-in-out" },
          { transform: `translateX(${choque * 0.12}px)`, offset: 0.82 },
          { transform: "translateX(0)", offset: 1 }
        ], { duration: T, delay: retraso }),
        animar(salto, [
          { transform: "translateY(-130px) scale(1.12)", offset: 0, easing: baja },
          { transform: "translateY(0) scale(1)", offset: 0.36, easing: sube },
          { transform: "translateY(-48px)", offset: 0.54, easing: baja },
          { transform: "translateY(0)", offset: 0.68, easing: sube },
          { transform: "translateY(-15px)", offset: 0.8, easing: baja },
          { transform: "translateY(0)", offset: 0.9 },
          { transform: "translateY(0)", offset: 1 }
        ], { duration: T, delay: retraso }),
        animar(cubo, [
          { transform: `rotateX(${tx}deg) rotateY(${ty}deg) rotateX(${rx + 360 * giro(2)}deg) rotateY(${ry + 360 * giro(2)}deg) rotateZ(${aleatorio(-50, 50)}deg)` },
          { transform: `rotateX(${tx}deg) rotateY(${ty}deg) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(0deg)` }
        ], { duration: T, delay: retraso, easing: "cubic-bezier(.15,.55,.3,1)" }),
        animar(sombra, [
          { opacity: 0.1, transform: "scale(.45)", offset: 0 }, { opacity: 0.55, transform: "scale(1)", offset: 0.36 }, { opacity: 0.25, transform: "scale(.72)", offset: 0.54 },
          { opacity: 0.55, transform: "scale(1)", offset: 0.68 }, { opacity: 0.4, transform: "scale(.88)", offset: 0.8 }, { opacity: 0.55, transform: "scale(1)", offset: 1 }
        ], { duration: T, delay: retraso })
      ]);
    });
    await Promise.all(tareas);
    clearTimeout(caida);
  }

  /* ---------------------------------------------------------------- el tesoro */
  // Un número que sube o baja con suavidad hasta su valor final (fmt le da formato)
  function contar(el, desde, hasta, duracion, fmt) {
    if (!el) return Promise.resolve();
    const f = fmt || String, d = Number(desde), h = Number(hasta);
    if (R.saltando || reducido() || !Number.isFinite(d) || !Number.isFinite(h) || d === h) { el.textContent = f(h); return Promise.resolve(); }
    return new Promise(ok => {
      const t0 = performance.now(), T = Math.max(1, ms(duracion || 700));
      let hecho = false;
      const fin = () => { if (hecho) return; hecho = true; el.textContent = f(h); ok(); };
      const paso = t => {
        if (hecho) return;
        const p = limitar((t - t0) / T, 0, 1), e = 1 - Math.pow(1 - p, 3);
        el.textContent = f(d + (h - d) * e);
        if (p < 1 && !R.saltando) requestAnimationFrame(paso); else fin();
      };
      requestAnimationFrame(paso);
      setTimeout(fin, T + 400);
    });
  }
  // Pone en el contenedor un montón con n discos; los que se añaden caen con un rebote
  function actualizarMonton(cont, n) {
    const A = arte(); if (!cont || !A) return;
    const viejo = cont.querySelector(".pz-monton"), k = limitar(Math.round(n), 1, 14), antes = viejo ? Number(viejo.dataset.n) || 0 : 0;
    if (viejo && antes === k) return;
    const html = A.monton(n, reducido() ? 0 : Math.max(0, k - antes));
    if (viejo) viejo.outerHTML = html; else cont.insertAdjacentHTML("afterbegin", html);
  }
  // La Ruina: los discos se encienden y suben hacia el dragón uno a uno, hasta que solo queda uno
  async function devorar(cont) {
    const m = cont && cont.querySelector(".pz-monton"); if (!m) return;
    const discos = [...m.querySelectorAll(".pz-disco-g")];
    discos.forEach(g => g.classList.add("pz-disco-ardiendo"));
    await Promise.all(discos.map((g, i) => animar(g, [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-46px)", opacity: 0 }], { duration: 520, delay: (discos.length - 1 - i) * 55, easing: "cubic-bezier(.5,0,.9,.5)", fill: "forwards" })));
    actualizarMonton(cont, 1);
  }
  // Monedas que viajan de un elemento a otro (del tesoro al saldo al cobrar; del tesoro a la boca del dragón al perder)
  function volar(desde, hasta, cuantas, opciones) {
    const A = arte(), o = opciones || {};
    if (!desde || !hasta || !A || reducido() || R.saltando) return Promise.resolve();
    const a = desde.getBoundingClientRect(), b = hasta.getBoundingClientRect();
    if ((!a.width && !a.height) || (!b.width && !b.height)) return Promise.resolve();
    const x0 = a.left + a.width / 2 - 12, y0 = a.top + a.height / 2 - 12, x1 = b.left + b.width / 2 - 12, y1 = b.top + b.height / 2 - 12;
    const n = limitar(Math.round(cuantas) || 8, 3, 16), tareas = [];
    for (let i = 0; i < n; i++) {
      const m = document.createElement("span");
      m.className = "pz-moneda-vuela" + (o.clase ? " " + o.clase : "");
      m.setAttribute("aria-hidden", "true"); m.innerHTML = A.moneda();
      document.body.appendChild(m);
      const jx = aleatorio(-26, 26), arco = -aleatorio(50, 120);
      tareas.push(animar(m, [
        { transform: `translate(${x0 + jx}px, ${y0}px) scale(.6)`, opacity: 0, offset: 0 },
        { transform: `translate(${x0 + jx + (x1 - x0) * 0.4}px, ${y0 + (y1 - y0) * 0.4 + arco}px) scale(1.1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: o.apaga ? 0 : 1, offset: 1 }
      ], { duration: o.duracion || 850, delay: i * 70, easing: "cubic-bezier(.4,0,.3,1)", fill: "both" }).then(() => m.remove()));
    }
    return Promise.all(tareas);
  }
  function pulso(el, clase, duracion) {
    if (!el) return;
    el.classList.remove(clase); void el.offsetWidth; el.classList.add(clase);
    setTimeout(() => el.classList.remove(clase), duracion || 800);
  }

  return { dado, dados, poner, lanzar, contar, actualizarMonton, devorar, volar, pulso, esperar, animar, saltar, nueva, ritmo, animando, forzar, ORIENTACION };
})();
