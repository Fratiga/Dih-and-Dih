/* =============================================================================
   CACHÉ DE AUDIO (para ahorrar ancho de banda de Supabase)
   Las canciones guardadas en Supabase Storage se bajan una sola vez por navegador y se guardan en la Cache Storage
   del sitio. Las siguientes veces suenan desde ahí, sin pedir nada a Supabase. Sin esto, el <audio> pide la canción
   entera por trozos (respuestas 206) en cada página y cada vuelta, y eso era casi todo el gasto del plan gratuito.

   AudioCache.obtener(url) devuelve una promesa con la dirección que hay que poner en audio.src: un blob: si la canción
   ya está guardada (o se acaba de bajar), o la misma url si algo falla o no es de Supabase Storage.
   Todo reproductor de audio que use archivos de Supabase Storage tiene que pasar por aquí (docs/ancho-de-banda.md).
============================================================================= */
window.AudioCache = window.AudioCache || (function () {
  const NOMBRE = "audio-supabase-v1";
  const INDICE = "audioCacheIndice";          // localStorage: { url: [último uso, bytes] }
  const TOPE = 400 * 1048576;                  // pasado este total se borran las que llevan más tiempo sin sonar
  const VIVOS_MAX = 6;                         // blob: abiertos a la vez en esta página
  const vivos = new Map();                     // url -> blob:
  const enCurso = new Map();                   // url -> promesa

  const apta = u => typeof u === "string" && u.includes("/storage/v1/object/public/") && "caches" in window && window.isSecureContext;

  function leerIndice() { try { return JSON.parse(localStorage.getItem(INDICE) || "{}") || {}; } catch (e) { return {}; } }
  function escribirIndice(i) { try { localStorage.setItem(INDICE, JSON.stringify(i)); } catch (e) { /* sin almacenamiento */ } }
  function tocar(url, bytes) {
    const i = leerIndice();
    i[url] = [Date.now(), bytes || (i[url] && i[url][1]) || 0];
    escribirIndice(i);
  }

  async function recortar(cache) {
    const i = leerIndice();
    let total = Object.values(i).reduce((a, v) => a + (v[1] || 0), 0);
    if (total <= TOPE) return;
    const viejas = Object.keys(i).sort((a, b) => i[a][0] - i[b][0]);
    for (const u of viejas) {
      if (total <= TOPE * 0.8) break;
      if (vivos.has(u)) continue;
      try { await cache.delete(u); } catch (e) { /* nada */ }
      total -= i[u][1] || 0;
      delete i[u];
    }
    escribirIndice(i);
  }

  function guardarVivo(url, obj) {
    vivos.set(url, obj);
    while (vivos.size > VIVOS_MAX) {
      const [u, o] = vivos.entries().next().value;
      vivos.delete(u);
      try { URL.revokeObjectURL(o); } catch (e) { /* nada */ }
    }
  }

  function obtener(url) {
    if (!apta(url)) return Promise.resolve(url);
    if (vivos.has(url)) {
      const o = vivos.get(url);
      vivos.delete(url); vivos.set(url, o);    // la más reciente queda al final
      tocar(url);
      return Promise.resolve(o);
    }
    if (enCurso.has(url)) return enCurso.get(url);
    const p = (async () => {
      try {
        const cache = await caches.open(NOMBRE);
        let blob = null;
        const guardada = await cache.match(url);
        if (guardada) blob = await guardada.blob();
        if (!blob || !blob.size) {
          const r = await fetch(url, { mode: "cors", credentials: "omit" });
          if (r.status !== 200) return url;
          blob = await r.blob();
          if (!blob.size) return url;
          try {
            await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || r.headers.get("Content-Type") || "audio/mpeg" } }));
          } catch (e) { /* sin espacio: suena igual, la próxima vez se baja otra vez */ }
        }
        const obj = URL.createObjectURL(blob);
        guardarVivo(url, obj);
        tocar(url, blob.size);
        recortar(cache);
        return obj;
      } catch (e) {
        return url;
      } finally {
        enCurso.delete(url);
      }
    })();
    enCurso.set(url, p);
    return p;
  }

  /* ¿Esta dirección (un blob: de aquí) corresponde a esa url? Para comparar audio.src con la pista pedida */
  const origenDe = src => { for (const [u, o] of vivos) if (o === src) return u; return src; };

  return { obtener, origenDe };
})();
