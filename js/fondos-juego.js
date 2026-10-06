/* Fondo de cada canción (tabla rocola_fondos, archivos en el bucket "rocola"): una imagen, un GIF o un video que
   se ve detrás de los carriles, semitransparente. Lo usan Zarabanda y Parranda. La lista es pública, no pide
   iniciar sesión. */
(function () {
  "use strict";

  const URL_BASE = "https://ilicqboqelrjuvtslaxd.supabase.co";
  const KEY = "sb_publishable_c9kPJ1tWbzCSiqVvmBJ0og_rUW9uLee";
  const cache = new Map(); // ruta de la canción -> promesa con { url, tipo, opacidad } o null

  /* El fondo de una canción, o null si no tiene (o no se pudo preguntar a tiempo) */
  function cargar(ruta) {
    if (cache.has(ruta)) return cache.get(ruta);
    const promesa = (async () => {
      try {
        const consulta = fetch(`${URL_BASE}/rest/v1/rocola_fondos?select=url,tipo,opacidad&cancion=eq.${encodeURIComponent(ruta)}`, {
          headers: { apikey: KEY, Authorization: "Bearer " + KEY }
        });
        const resp = await Promise.race([consulta, new Promise((_, no) => setTimeout(() => no(new Error("tiempo")), 3000))]);
        if (!resp.ok) return null;
        const lista = await resp.json();
        return Array.isArray(lista) && lista[0] ? lista[0] : null;
      } catch (e) {
        return null;
      }
    })();
    cache.set(ruta, promesa);
    setTimeout(() => cache.delete(ruta), 5 * 60 * 1000);
    return promesa;
  }

  function quitar(contenedor) {
    if (!contenedor) return;
    const v = contenedor.querySelector("video");
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) { /* ya parado */ } }
    contenedor.innerHTML = "";
    contenedor.classList.add("hidden");
  }

  /* Pone el fondo en el contenedor. Un video va en silencio y en bucle; empieza a sonar al llamar a reproducir. */
  function montar(contenedor, fondo) {
    quitar(contenedor);
    if (!contenedor || !fondo || !fondo.url) return false;
    let el;
    if (fondo.tipo === "video") {
      el = document.createElement("video");
      el.muted = true;
      el.setAttribute("muted", "");
      el.loop = true;
      el.playsInline = true;
      el.preload = "auto";
      el.disablePictureInPicture = true;
    } else {
      el = document.createElement("img");
      el.alt = "";
      el.decoding = "async";
    }
    el.src = fondo.url;
    el.style.opacity = String(Math.max(0.05, Math.min(1, Number(fondo.opacidad) || 0.35)));
    el.addEventListener("error", () => quitar(contenedor));
    contenedor.appendChild(el);
    contenedor.classList.remove("hidden");
    return true;
  }

  /* Un GIF no se puede pausar: al pausar el juego se deja congelado su fotograma actual en un lienzo encima */
  function reproducir(contenedor) {
    if (!contenedor) return;
    const congelado = contenedor.querySelector("canvas");
    if (congelado) congelado.remove();
    const img = contenedor.querySelector("img");
    if (img) img.style.visibility = "";
    const v = contenedor.querySelector("video");
    if (v) v.play().catch(() => { /* el navegador no dejó: queda la imagen parada */ });
  }

  function pausar(contenedor) {
    if (!contenedor) return;
    const v = contenedor.querySelector("video");
    if (v) v.pause();
    const img = contenedor.querySelector("img");
    if (img && /\.gif(\?|$)/i.test(img.src) && img.naturalWidth && !contenedor.querySelector("canvas")) {
      try {
        const lienzo = document.createElement("canvas");
        lienzo.width = img.naturalWidth;
        lienzo.height = img.naturalHeight;
        lienzo.style.cssText = `width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;opacity:${img.style.opacity}`;
        lienzo.getContext("2d").drawImage(img, 0, 0);
        contenedor.appendChild(lienzo);
        img.style.visibility = "hidden";
      } catch (e) { /* sin permiso para copiar el fotograma: el GIF sigue moviéndose */ }
    }
  }

  window.FondosJuego = { cargar, montar, reproducir, pausar, quitar };
})();
