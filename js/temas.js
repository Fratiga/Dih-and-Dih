/* =============================================================================
   TEMAS — paletas de color con nombres sacados del propio mundo. Cada uno
   solo reescribe las variables CSS de :root (ver css/style.css), así que
   ningún otro archivo necesita saber que esto existe. Se guarda en
   localStorage, sitio entero, sin distinción de Side A/B ni de usuario.
============================================================================= */
const TEMAS = [
  { id: "taberna", nombre: "La Taberna", muestra: "#8f6bd1" },
  { id: "original", nombre: "Cátedra de Dolbred", muestra: "#cfcfba" },
  { id: "primer-tomo", nombre: "Primer Tomo", muestra: "#c6a96b" },
  { id: "rescoldos", nombre: "Rescoldos de Vado Ceniza", muestra: "#e0a15c" },
  { id: "escarcha", nombre: "Escarcha de Brurland", muestra: "#9fd3e8" },
  { id: "espesura", nombre: "La Espesura", muestra: "#a3c98d" },
  { id: "fragua", nombre: "Fragua de Balutia", muestra: "#d97b62" },
  { id: "kigan", nombre: "Baños de Kigan", muestra: "#7fd4c4" },
  { id: "tarrena", nombre: "Trono Perdido de Tarrena", muestra: "#b8c4dd" },
  { id: "bufon", nombre: "Guiño del Bufón", muestra: "#d8b04a" }
];

const TEMA_KEY = "compendioTema";

function temaActual() {
  const id = localStorage.getItem(TEMA_KEY);
  return TEMAS.some(t => t.id === id) ? id : "taberna";
}

function aplicarTema(id) {
  // "original" es el :root sin atributo; todos los demás (incluido "taberna") llevan el suyo
  if (id === "original") document.documentElement.removeAttribute("data-tema");
  else document.documentElement.setAttribute("data-tema", id);
}

/* Personalización de la taberna (css/taberna.css): letra legible en títulos y menús,
   y el fondo (estrellas, cuadrícula o liso). */
const FUENTE_KEY = "compendioFuenteLegible";
const FONDO_KEY = "compendioFondo";
const FONDOS = [["estrellas", "Estrellas"], ["cuadricula", "Cuadrícula"], ["tablas", "Tablas de madera"], ["liso", "Liso"]];

function fuenteLegible() { return localStorage.getItem(FUENTE_KEY) === "1"; }
function fondoActual() {
  const f = localStorage.getItem(FONDO_KEY);
  return FONDOS.some(x => x[0] === f) ? f : "estrellas";
}
function aplicarPersonalizacion() {
  const raiz = document.documentElement;
  if (fuenteLegible()) raiz.setAttribute("data-fuente", "legible"); else raiz.removeAttribute("data-fuente");
  raiz.setAttribute("data-fondo", fondoActual());
}
aplicarPersonalizacion();

// Se aplica ya mismo, antes de armar el widget — así no hace falta esperar
// a que el resto de la página termine de cargar para ver el tema elegido.
aplicarTema(temaActual());

function initTemaWidget() {
  const widget = document.getElementById("temaWidget");
  if (!widget) return;
  const badge = document.getElementById("temaBadge");
  const popover = document.getElementById("temaPopover");

  function cerrarPopover() {
    popover.classList.add("hidden");
  }

  function pintarOpciones() {
    const actual = temaActual();
    popover.innerHTML = TEMAS.map(t => `
      <button type="button" class="tema-opcion ${t.id === actual ? "is-active" : ""}" data-tema-opcion="${t.id}">
        <span class="tema-opcion-punto" style="background:${t.muestra}"></span>
        ${t.nombre}
      </button>
    `).join("") + `
      <div class="tema-personalizar">
        <label class="tema-check"><input type="checkbox" id="temaFuenteLegible" ${fuenteLegible() ? "checked" : ""}> Letra legible en títulos y menús</label>
        <label class="tema-check">Fondo
          <select id="temaFondo">${FONDOS.map(f => `<option value="${f[0]}" ${f[0] === fondoActual() ? "selected" : ""}>${f[1]}</option>`).join("")}</select>
        </label>
      </div>`;
    popover.querySelector("#temaFuenteLegible").addEventListener("change", e => {
      localStorage.setItem(FUENTE_KEY, e.target.checked ? "1" : "0");
      aplicarPersonalizacion();
    });
    popover.querySelector("#temaFondo").addEventListener("change", e => {
      localStorage.setItem(FONDO_KEY, e.target.value);
      aplicarPersonalizacion();
    });
    popover.querySelectorAll("[data-tema-opcion]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.temaOpcion;
        localStorage.setItem(TEMA_KEY, id);
        aplicarTema(id);
        pintarOpciones();
        cerrarPopover();
      });
    });
  }

  badge.addEventListener("click", e => {
    e.stopPropagation();
    popover.classList.toggle("hidden");
  });
  document.addEventListener("click", e => {
    if (!widget.contains(e.target)) cerrarPopover();
  });

  pintarOpciones();
}

initTemaWidget();
