// La búsqueda general del compendio para el comando /buscar: carga el índice (data/discord-indice.json, generado con tools/generar-indice-discord.js),
// le aplica encima lo editado desde el panel de Admin (tabla contenido_servidor), filtra por el Side de quien pregunta y ordena los resultados.
// JavaScript normal: corre en Deno (Edge Function) y en Node (tools/probar-discord-buscar.js).
//
// Reglas de visibilidad (las mismas que la web, js/lado.js y js/modal.js):
//   * Una entrada sin lado la ve cualquiera, también quien no ha vinculado su cuenta.
//   * Una entrada con lado ["A"] o ["B"] solo la ve quien sea de ese Side, quien tenga la excepción de Side o un admin.
//   * Las subsecciones de un lugar (A, B o AB) solo se enseñan en el detalle, a su Side (o a quien lo ve todo), y no se buscan: igual que en la web.
//   * Los campos solo para el GM nunca llegan al índice.
import { normalizar, extracto, fragmento } from "./texto.js";
import { aTexto } from "./texto.js";

const COLOR = 0x8a6d3b;
const TTL_INDICE_MS = 10 * 60 * 1000;
const TTL_PARCHES_MS = 60 * 1000;
const PARADAS = new Set(["de", "la", "el", "los", "las", "un", "una", "y", "o", "en", "del", "al", "que", "por", "con", "se", "su", "es", "a"]);
const COLECCIONES_EDITABLES = new Set(["ENTRIES", "PERSONAJES", "LUGARES", "FACCIONES", "PERGAMINOS", "ARMAS", "BESTIARIO", "RAZAS", "RELIGIONES", "OBJETOS"]);

const corta = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const enlace = (sitio, ruta) => sitio.replace(/\/+$/, "") + "/" + ruta;

/* ------------------------------------------------------------------ visibilidad */
export const entradaVisible = (e, acceso) => !e.l || !e.l.length || !!acceso?.veAmbos || (!!acceso?.side && e.l.includes(acceso.side));
export const subseccionVisible = (s, acceso) => !!acceso?.veAmbos || (!!acceso?.side && String(s.l || "").includes(acceso.side));

/* ------------------------------------------------------------------ índice */
let cache = { cuando: 0, datos: null, parches: null, cuandoParches: 0, combinado: null, claveCombinado: "" };

/* Lo editado desde el panel de Admin se aplica encima del índice, igual que js/contenido-servidor.js lo aplica a las listas de la web.
   Solo se tocan los campos que el panel edita y el índice conoce: título, categoría, etiquetas, resumen, texto y lado. */
export function aplicarParches(entradas, filas) {
  const lista = entradas.map(e => e);
  const pos = new Map(lista.map((e, i) => [e.id, i]));
  const fusionar = (e, d) => {
    const n = { ...e };
    if ("title" in d) n.t = d.title ?? n.t;
    if ("category" in d) n.c = d.category ?? n.c;
    if ("tags" in d) n.g = Array.isArray(d.tags) ? d.tags : [];
    if ("summary" in d) n.r = aTexto(d.summary ?? "");
    if ("content" in d) n.x = aTexto(d.content ?? "");
    if ("lado" in d) n.l = Array.isArray(d.lado) && d.lado.length ? d.lado : null;
    delete n._n;
    return n;
  };
  const borrar = new Set();
  for (const f of filas || []) {
    if (!f || !COLECCIONES_EDITABLES.has(f.coleccion)) continue;
    const i = pos.get(f.clave);
    if (f.borrado) { if (i !== undefined) borrar.add(i); continue; }
    if (i !== undefined) lista[i] = fusionar(lista[i], f.data || {});
    else if (f.data && f.data.id && f.data.title) {   // una entrada creada desde la web
      lista.push(fusionar({ id: f.data.id, t: f.data.title, c: f.data.category || "", g: [], r: "", l: null, x: "", d: [], p: `compendio.html#e=${encodeURIComponent(f.data.id)}` }, f.data));
    }
  }
  return lista.filter((e, i) => !borrar.has(i));
}

/* Trae el índice (con caché de 10 minutos) y le aplica los parches de Admin (caché de 1 minuto).
   dependencias: { sitio, obtener(url) -> Response, parches?() -> filas, ahora?() -> ms }. Si la red falla y hay una copia anterior, usa esa. */
export async function cargarIndice({ sitio, obtener, parches, ahora = () => Date.now() }) {
  const t = ahora();
  if (!cache.datos || t - cache.cuando > TTL_INDICE_MS) {
    try {
      const r = await obtener(enlace(sitio, "data/discord-indice.json"));
      if (!r.ok) throw new Error("índice " + r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.entradas)) throw new Error("índice roto");
      cache = { ...cache, cuando: t, datos: j, combinado: null };
    } catch (e) {
      if (!cache.datos) throw e;     // sin copia anterior no hay nada que enseñar
      cache = { ...cache, cuando: t - TTL_INDICE_MS + 30000 };   // se reintenta dentro de 30 s y mientras tanto se usa la copia
    }
  }
  if (parches && (!cache.parches || t - cache.cuandoParches > TTL_PARCHES_MS)) {
    try { cache = { ...cache, parches: await parches(), cuandoParches: t, combinado: null }; }
    catch (e) { cache = { ...cache, cuandoParches: t - TTL_PARCHES_MS + 15000 }; }   // sin parches: el índice tal cual
  }
  if (!cache.combinado) cache.combinado = cache.parches ? aplicarParches(cache.datos.entradas, cache.parches) : cache.datos.entradas;
  return cache.combinado;
}
export function olvidarIndice() { cache = { cuando: 0, datos: null, parches: null, cuandoParches: 0, combinado: null, claveCombinado: "" }; }

/* ------------------------------------------------------------------ búsqueda */
function normalizado(e) {
  if (!e._n) {
    Object.defineProperty(e, "_n", {
      enumerable: false, configurable: true, writable: true,
      value: {
        t: normalizar(e.t), c: normalizar(e.c),
        meta: normalizar([e.t, e.c, ...(e.g || []), e.r, ...(e.d || []).map(d => d[1])].join(" ")),
        x: normalizar(e.x)
      }
    });
  }
  return e._n;
}

export function palabrasDe(consulta) {
  const todas = normalizar(consulta).split(" ").filter(Boolean);
  const utiles = todas.filter(p => p.length >= 2 && !PARADAS.has(p));
  return utiles.length ? utiles : todas.filter(p => p.length >= 2);
}

/* Devuelve hasta `limite` entradas visibles para ese acceso, de mejor a peor, con el motivo de cada coincidencia. */
export function buscar(entradas, consulta, acceso, { categoria, limite = 8 } = {}) {
  const q = normalizar(consulta);
  const palabras = palabrasDe(consulta);
  if (!q || !palabras.length) return [];
  const cat = categoria ? normalizar(categoria) : "";
  const res = [];
  for (const e of entradas) {
    if (!entradaVisible(e, acceso)) continue;
    const n = normalizado(e);
    if (cat && !n.c.startsWith(cat)) continue;
    let puntos = 0, donde = "";
    if (n.t === q) { puntos = 1000; donde = "titulo"; }
    else if (n.t.startsWith(q)) { puntos = 800; donde = "titulo"; }
    else if (n.t.includes(q)) { puntos = 650; donde = "titulo"; }
    else if (palabras.every(p => n.t.includes(p))) { puntos = 500; donde = "titulo"; }
    else if (palabras.every(p => n.meta.includes(p))) { puntos = 300; donde = "datos"; }
    else if (palabras.every(p => n.meta.includes(p) || n.x.includes(p))) {
      let veces = 0; for (const p of palabras) { let i = -1, k = 0; while ((i = n.x.indexOf(p, i + 1)) >= 0 && k < 10) { veces++; k++; } }
      puntos = 100 + Math.min(veces, 50); donde = "texto";
    }
    if (!puntos) continue;
    puntos -= Math.min(n.t.length, 100) / 100;   // a igualdad, el título más corto (más cercano a lo escrito)
    res.push({ e, puntos, donde });
  }
  res.sort((a, b) => b.puntos - a.puntos);
  return res.slice(0, limite);
}

/* Sugerencias para el autocompletado de Discord: hasta 25, solo títulos que esa persona puede ver. */
export function sugerencias(entradas, texto, acceso, categoria) {
  const hallados = buscar(entradas, texto, acceso, { categoria, limite: 25 });
  return hallados.filter(h => h.e.id.length <= 90).map(h => ({ name: corta(`${h.e.t} (${h.e.c})`, 100), value: `id:${h.e.id}` }));
}

export const porId = (entradas, id) => entradas.find(e => e.id === id);

/* ------------------------------------------------------------------ respuestas */
export function embedDetalle(e, acceso, sitio, otros = []) {
  const campos = [];
  for (const [etiqueta, v] of (e.d || []).slice(0, 8)) campos.push({ name: corta(etiqueta, 100), value: corta(v, 300), inline: v.length < 40 });
  const subs = (e.s || []).filter(s => subseccionVisible(s, acceso)).slice(0, 4);
  for (const s of subs) campos.push({ name: corta(`Dentro de ${e.t}: ${s.t}`, 250), value: corta(extracto(s.x, 700), 1000) || "—" });
  const cuerpo = extracto([e.r && e.r !== e.x ? `*${e.r}*` : "", e.x].filter(Boolean).join("\n\n"), 1400);
  const emb = {
    color: COLOR, title: corta(e.t, 250), description: cuerpo || "—", fields: campos.slice(0, 25),
    url: enlace(sitio, e.p || "compendio.html"), author: { name: corta(e.c || "Compendio", 200) }
  };
  if (otros.length) emb.footer = { text: corta("También: " + otros.map(o => o.e.t).join(" · "), 200) };
  return emb;
}

export function embedLista(hallados, consulta, sitio) {
  const lineas = hallados.map((h, i) => {
    const e = h.e;
    let extra = e.r ? corta(e.r.replace(/\s+/g, " "), 110) : "";
    if (h.donde === "texto") extra = fragmento(e.x, palabrasDe(consulta)) || extra;
    const titulo = corta(e.t, 80).replace(/[[\]]/g, "");   // los corchetes romperían el enlace de Markdown
    return `**${i + 1}. [${titulo}](${enlace(sitio, e.p || "compendio.html")})** · ${corta(e.c, 40)}${extra ? `\n${corta(extra, 180)}` : ""}`;
  });
  return { color: COLOR, title: corta(`Resultados para «${consulta}»`, 250), description: corta(lineas.join("\n\n"), 3800), footer: { text: "Elige uno con el autocompletado de /buscar para ver el detalle." } };
}
