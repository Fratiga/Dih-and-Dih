/* =============================================================================
   HIPÓDROMO: dibujo de las criaturas. Una silueta de perfil, mirando a la derecha, hecha en SVG a partir
   de las proporciones del perfil público (perfil.silueta, de 0 a 1) y del color de la capa. Sin imágenes:
   patas más largas o cortas, pecho y cadera más grandes, cuerpo y cuello más largos, cola, cabeza y manchas.
   Es un dibujo simple a propósito; cuando haya arte de verdad se cambia solo esta función.
============================================================================= */
window.HipodromoDibujo = (function () {
  const CAPAS = { castaña: "#8a5a3a", ceniza: "#8b8f94", marfil: "#e3dcc6", carbón: "#34343a", canela: "#c48b52", rojiza: "#a8452f", verdosa: "#6f8f5c", azulada: "#5d7ea0" };
  const mezcla = (hex, f) => {   // f < 0 oscurece, f > 0 aclara
    const n = parseInt(hex.slice(1), 16), ch = s => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + (f < 0 ? ((n >> s) & 255) * f : (255 - ((n >> s) & 255)) * f))));
    return "#" + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, "0")).join("");
  };
  const colorCapa = capa => CAPAS[String(capa || "").split(" ")[0]] || "#8a5a3a";

  /* Devuelve el SVG como texto. opciones: { clase, titulo } */
  function silueta(perfil, opciones) {
    opciones = opciones || {};
    const s = perfil.silueta || {}, g = k => (typeof s[k] === "number" ? s[k] : 0.5);
    const base = colorCapa(perfil.capa), oscuro = mezcla(base, -0.45), lejos = mezcla(base, -0.3), claro = mezcla(base, 0.25);
    const escala = 0.82 + 0.3 * g("altura");
    const largoPata = 24 + 40 * g("longitud_patas"), grosorPata = 3 + 4.5 * g("grosor_patas");
    const largoCuerpo = 64 + 54 * g("longitud_cuerpo"), alto = 24 + 24 * g("anchura_torso");
    const rPecho = 12 + 10 * g("tamano_pecho"), rCadera = 12 + 10 * g("tamano_cadera");
    const largoCuello = 14 + 24 * g("longitud_cuello"), cabezaX = 8 + 8 * g("tamano_cabeza"), cabezaY = 5.5 + 4.5 * g("tamano_cabeza");
    const largoCola = 14 + 30 * g("tamano_cola");

    const suelo = 128, cy = suelo - largoPata - alto / 2;
    const xAtras = 110 - largoCuerpo / 2 + rCadera * 0.5, xFrente = 110 + largoCuerpo / 2 - rPecho * 0.5;
    const cuelloX = xFrente + rPecho * 0.35, cuelloY = cy - alto / 2 + 3;
    const cabX = cuelloX + largoCuello * 0.72 + cabezaX * 0.55, cabY = cuelloY - largoCuello * 0.7 + 2;
    const cabecera = `M ${cuelloX - 7} ${cuelloY + 8} L ${cabX - cabezaX * 0.6} ${cabY - cabezaY * 0.8} L ${cabX - cabezaX * 0.2} ${cabY + cabezaY * 0.9} L ${cuelloX + 6} ${cuelloY + alto * 0.45} Z`;
    const pata = (x, pintar, anchoX) => `<rect x="${(x - grosorPata / 2).toFixed(1)}" y="${(cy + alto / 2 - 4).toFixed(1)}" width="${grosorPata.toFixed(1)}" height="${(largoPata + 4).toFixed(1)}" rx="${(grosorPata / 2).toFixed(1)}" fill="${pintar}"/>` +
      `<rect x="${(x - grosorPata / 2 - 0.8).toFixed(1)}" y="${(suelo - 5).toFixed(1)}" width="${(grosorPata + 1.6 + (anchoX || 0)).toFixed(1)}" height="5" rx="2" fill="${oscuro}"/>`;
    const colaX = xAtras - rCadera * 0.7, colaY = cy - alto * 0.15;
    const cola = `<path d="M ${colaX} ${colaY} C ${colaX - largoCola * 0.5} ${colaY - 8}, ${colaX - largoCola} ${colaY + 6}, ${colaX - largoCola * 0.9} ${colaY + largoCola * 0.8}" fill="none" stroke="${oscuro}" stroke-width="${(3 + 3 * g("tamano_cola")).toFixed(1)}" stroke-linecap="round"/>`;
    // manchas: posiciones fijas por criatura
    let manchas = "";
    if (/mancha|motead/.test(perfil.capa || "")) {
      let semilla = (perfil.id * 2654435761) >>> 0;
      const al = () => { semilla = (Math.imul(semilla, 1664525) + 1013904223) >>> 0; return semilla / 4294967296; };
      const cuantas = /motead/.test(perfil.capa) ? 9 : 4;
      for (let i = 0; i < cuantas; i++) manchas += `<circle cx="${(xAtras + al() * (xFrente - xAtras)).toFixed(1)}" cy="${(cy - alto * 0.3 + al() * alto * 0.6).toFixed(1)}" r="${(2.2 + al() * 3.4).toFixed(1)}" fill="${claro}" opacity=".75"/>`;
    }
    return `<svg class="${opciones.clase || "hip-silueta"}" viewBox="0 0 240 140" role="img" aria-label="${(opciones.titulo || perfil.nombre || "Criatura").replace(/"/g, "&quot;")}" xmlns="http://www.w3.org/2000/svg">` +
      `<g transform="translate(120 ${suelo}) scale(${escala.toFixed(3)}) translate(-120 ${-suelo})">` +
      `<ellipse cx="110" cy="${suelo}" rx="${(largoCuerpo * 0.6).toFixed(0)}" ry="3" fill="rgba(0,0,0,.28)"/>` +
      cola +
      pata(xAtras + 10, lejos) + pata(xFrente - 2, lejos) +
      `<path d="${cabecera}" fill="${base}"/>` +
      `<ellipse cx="${((xAtras + xFrente) / 2).toFixed(1)}" cy="${cy.toFixed(1)}" rx="${((xFrente - xAtras) / 2 + 12).toFixed(1)}" ry="${(alto / 2).toFixed(1)}" fill="${base}"/>` +
      `<ellipse cx="${xFrente.toFixed(1)}" cy="${(cy + 1).toFixed(1)}" rx="${rPecho.toFixed(1)}" ry="${(alto / 2 + 2 + 8 * g("tamano_pecho")).toFixed(1)}" fill="${base}"/>` +
      `<ellipse cx="${xAtras.toFixed(1)}" cy="${(cy - 1).toFixed(1)}" rx="${rCadera.toFixed(1)}" ry="${(alto / 2 + 2 + 9 * g("tamano_cadera")).toFixed(1)}" fill="${base}"/>` +
      manchas +
      pata(xAtras - 2, base) + pata(xFrente + 8, base) +
      `<ellipse cx="${cabX.toFixed(1)}" cy="${cabY.toFixed(1)}" rx="${cabezaX.toFixed(1)}" ry="${cabezaY.toFixed(1)}" fill="${base}" transform="rotate(18 ${cabX.toFixed(1)} ${cabY.toFixed(1)})"/>` +
      `<path d="M ${(cabX - cabezaX * 0.45).toFixed(1)} ${(cabY - cabezaY * 0.9).toFixed(1)} l -3 -9 l 7 5 Z" fill="${oscuro}"/>` +
      `<circle cx="${(cabX + cabezaX * 0.15).toFixed(1)}" cy="${(cabY - cabezaY * 0.2).toFixed(1)}" r="1.7" fill="#101010"/>` +
      `</g></svg>`;
  }

  return { silueta, colorCapa };
})();
