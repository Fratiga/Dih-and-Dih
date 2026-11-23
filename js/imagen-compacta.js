/* =============================================================================
   IMAGEN COMPACTA (para ahorrar ancho de banda de Supabase)
   Antes de subir una imagen a Supabase Storage se pasa a WebP en el navegador y, si es enorme, se achica.
   Un PNG de 1,5 a 6 MB queda en unos cientos de KB con la misma pinta, y cada visita baja eso en vez del original.

   ImagenCompacta.reducir(archivo, { max, calidad }) devuelve una promesa con un File: el WebP si sale más liviano, o el
   original si no vale la pena (ya es chico, es GIF o WebP, es un PNG animado, o el navegador no puede).
   Toda subida de imágenes a Supabase Storage tiene que pasar por aquí (docs/ancho-de-banda.md).
============================================================================= */
window.ImagenCompacta = window.ImagenCompacta || (function () {
  const MINIMO = 300 * 1024;          // por debajo de esto no se toca

  async function esPngAnimado(archivo) {
    if (archivo.type !== "image/png") return false;
    try {
      const b = new Uint8Array(await archivo.slice(0, 64 * 1024).arrayBuffer());
      for (let i = 8; i < b.length - 4; i++) if (b[i] === 0x61 && b[i + 1] === 0x63 && b[i + 2] === 0x54 && b[i + 3] === 0x4c) return true;   // "acTL"
    } catch (e) { return true; }
    return false;
  }

  async function reducir(archivo, opciones) {
    opciones = opciones || {};
    const max = opciones.max || 2560, calidad = opciones.calidad || 0.9;
    try {
      if (!archivo || !/^image\/(png|jpeg|bmp)$/.test(archivo.type) || archivo.size < MINIMO) return archivo;
      if (typeof createImageBitmap !== "function" || await esPngAnimado(archivo)) return archivo;
      const bmp = await createImageBitmap(archivo);
      const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const lienzo = document.createElement("canvas");
      lienzo.width = w; lienzo.height = h;
      const ctx = lienzo.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, w, h);
      if (bmp.close) bmp.close();
      const blob = await new Promise(ok => lienzo.toBlob(ok, "image/webp", calidad));
      if (!blob || blob.type !== "image/webp" || blob.size >= archivo.size * 0.9) return archivo;
      const nombre = (archivo.name || "imagen").replace(/\.[^.]+$/, "") + ".webp";
      return new File([blob], nombre, { type: "image/webp" });
    } catch (e) {
      return archivo;
    }
  }

  return { reducir };
})();
