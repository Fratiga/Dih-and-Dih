// Genera data/discord-indice.json: el índice de búsqueda que usa el comando /buscar del bot de Discord.
// Parte de los mismos archivos data/*.js que lee la web, los pasa a texto plano y guarda para cada entrada su título, categoría, etiquetas, resumen,
// datos sueltos (daño, precio, región...), texto completo, el lado al que pertenece (A, B o ninguno) y sus subsecciones por lado.
// También guarda las novedades del lobby (data/novedades.js) para que el bot las anuncie. Nunca copia los campos solo para el GM (datosGM). El Side se aplica después, en la Edge Function, con las mismas reglas que la web.
//
// Uso (cada vez que cambie algo de data/*.js que quieras que el bot conozca):
//   node tools/generar-indice-discord.js
// y sube data/discord-indice.json con el resto de cambios. Si te olvidas, el bot responde con la versión anterior (y aplica encima lo que se edite
// desde el panel de Admin, que va por otra vía), pero no conoce las entradas nuevas de los archivos hasta que lo regeneres.
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { aTexto } from "../docs/discord/texto.js";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ARCHIVOS = ["entries", "personajes", "lugares", "facciones", "pergaminos", "armas", "bestiario", "razas", "religiones", "objetos", "reglas", "economia", "cronologia-a", "cronologia-b", "novedades"];

export function cargarDatos() {
  const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
  for (const f of ARCHIVOS) vm.runInContext(fs.readFileSync(RAIZ + "data/" + f + ".js", "utf8"), ctx, { filename: f });
  return ctx.window;
}

const ETIQUETAS = {
  titulo: "Título", raza: "Raza", ocupacion: "Ocupación", faccion: "Facción", lugarOrigen: "Origen", primeraAparicion: "Primera aparición",
  tipo: "Tipo", region: "Región", gobierno: "Gobierno", religionPredominante: "Religión predominante", ideologia: "Ideología",
  "daño": "Daño", tipoDano: "Tipo de daño", alcance: "Alcance", peso: "Peso", coste: "Coste", escala: "Escala", propiedades: "Propiedades",
  clasificacion: "Clasificación", amenaza: "Amenaza", simbolo: "Símbolo", principio: "Principio", muerte: "Muerte", eternos: "Eternos",
  precio: "Precio", nota: "Nota", lugaresDestacados: "Lugares destacados", miembrosConocidos: "Miembros conocidos", relaciones: "Relaciones", relacionesConocidas: "Relaciones"
};
const OMITIR = new Set(["id", "title", "category", "tags", "summary", "content", "retrato", "imagen", "lado", "subsecciones", "habilidades", "datosGM", "orden", "numero", "fecha"]);
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function construirIndice(w) {
  const titulos = new Map();
  for (const col of ["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS"])
    for (const e of w[col] || []) titulos.set(e.id, e.title);
  const nombreDe = v => titulos.get(v) || String(v);
  const valor = (campo, v) => {
    if (Array.isArray(v)) {
      const partes = v.map(x => {
        if (typeof x === "string" || typeof x === "number") return campo === "propiedades" ? String(x) : nombreDe(x);
        if (x && typeof x === "object" && x.id) return nombreDe(x.id) + (x.signo ? ` (${x.signo})` : "");
        return null;
      }).filter(Boolean);
      return partes.join(", ");
    }
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return ["region", "faccion", "lugarOrigen", "religionPredominante"].includes(campo) ? nombreDe(v) : v;
    return "";
  };

  const entradas = [];
  const agregar = (e, ruta, categoriaFija, ladoFijo) => {
    const datos = [];
    for (const [k, v] of Object.entries(e)) {
      if (OMITIR.has(k) || !(k in ETIQUETAS)) continue;
      const t = valor(k, v);
      if (t) datos.push([ETIQUETAS[k], t.length > 400 ? t.slice(0, 399) + "…" : t]);
    }
    let texto = aTexto(e.content || "");
    if (Array.isArray(e.habilidades) && e.habilidades.length)
      texto = [texto, ...e.habilidades.filter(h => h && h.nombre).map(h => `${h.nombre}: ${aTexto(h.descripcion || "")}`)].filter(Boolean).join("\n\n");
    const item = {
      id: e.id, t: e.title, c: categoriaFija || e.category || "", g: Array.isArray(e.tags) ? e.tags : [], r: aTexto(e.summary || ""),
      l: ladoFijo ? [ladoFijo] : (Array.isArray(e.lado) && e.lado.length ? e.lado : null), x: texto, d: datos, p: ruta(e)
    };
    if (Array.isArray(e.subsecciones) && e.subsecciones.length)
      item.s = e.subsecciones.map(s => ({ l: String(s.lado || ""), t: s.titulo || "", x: aTexto(s.texto || "") })).filter(s => s.t || s.x);
    entradas.push(item);
  };

  for (const col of ["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS"])
    for (const e of w[col] || []) agregar(e, x => `compendio.html#e=${encodeURIComponent(x.id)}`);
  for (const e of w.CRONOLOGIA_A || []) agregar({ ...e, id: "cron-a-" + e.id, title: `${e.numero ? e.numero + ". " : ""}${e.title}` }, () => "cronologia.html", "Cronología (Side A)", "A");
  for (const e of w.CRONOLOGIA_B || []) agregar({ ...e, id: "cron-b-" + e.id, title: `${e.numero ? e.numero + ". " : ""}${e.title}` }, () => "cronologia.html", "Cronología (Side B)", "B");
  for (const r of w.REGLAS || []) {
    const items = Array.isArray(r.items) ? r.items.map(i => typeof i === "string" ? aTexto(i) : i && (i.titulo || i.nombre) ? `${i.titulo || i.nombre}: ${aTexto(i.descripcion || i.texto || "")}` : "").filter(Boolean) : [];
    entradas.push({ id: "regla-" + slug(r.titulo), t: r.titulo, c: "Reglas", g: [], r: aTexto(r.descripcion || ""), l: null, x: items.map(i => "• " + i).join("\n"), d: [], p: "reglas.html" });
  }
  for (const e of w.ECONOMIA || [])
    entradas.push({ id: "eco-" + slug(e.categoria + "-" + e.nombre), t: e.nombre, c: "Economía", g: [e.categoria].filter(Boolean), r: [e.categoria, e.precio].filter(Boolean).join(" · "), l: null, x: e.nota || "", d: [["Precio", e.precio || ""]].filter(d => d[1]), p: "economia.html" });
  // Las novedades del lobby (data/novedades.js): el bot anuncia las de los últimos 2 días. La clave es la misma que usa el panel de Admin (fecha|título).
  const novedades = (w.NOVEDADES || []).filter(n => n && n.fecha && n.titulo).map(n => ({ clave: `${n.fecha}|${n.titulo}`, fecha: n.fecha, titulo: n.titulo, texto: aTexto(n.texto || ""), enlace: n.enlace || null }));
  return { generado: new Date().toISOString(), novedades, entradas };
}

// Solo se escribe el archivo cuando se ejecuta este script, no cuando lo importan las pruebas.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const idx = construirIndice(cargarDatos());
  const json = JSON.stringify(idx);
  fs.writeFileSync(RAIZ + "data/discord-indice.json", json);
  const porCat = {}; for (const e of idx.entradas) porCat[e.c] = (porCat[e.c] || 0) + 1;
  console.log(`data/discord-indice.json: ${idx.entradas.length} entradas, ${(json.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([c, n]) => `  ${c}: ${n}`).join("\n"));
}
