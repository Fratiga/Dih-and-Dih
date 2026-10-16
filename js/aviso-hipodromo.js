/* =============================================================================
   AVISO DE LA CARRERA (taberna, index.html)
   Cuando faltan 5 minutos o menos para la salida de la próxima carrera del Hipódromo, la taberna enseña una franja con la cuenta atrás y un
   enlace para verla en vivo (hipodromo-vivo.html). Mientras corren dice que están corriendo y después se quita sola.
   Solo lee la carrera programada (tabla hipodromo_programa, la que lee cualquiera con sesión) y el reloj del servidor (hipodromo_ahora): no carga
   nada del motor del Hipódromo. Si el servidor no responde, la franja no sale. Una carrera suspendida tampoco avisa.

   Prueba sin servidor: index.html?caballos=90 simula una carrera que sale dentro de 90 segundos (hasta 300).
============================================================================= */
(function () {
  const caja = document.getElementById("lbAvisoCaballos");
  if (!caja) return;
  const $ = id => document.getElementById(id);
  const AVISO_MS = 5 * 60000;          // desde cuándo se avisa
  const DURACION_MS = 75 * 1000;       // lo que dura la carrera en pantalla (DURACION_SEG de js/hipodromo-motor.js)
  const params = new URLSearchParams(location.search);
  const simulada = Number(params.get("caballos"));

  let supa = null, desfase = 0, prog = null, ultimaLectura = 0, leyendo = false, reloj = null, estado = "", activo = false;
  const ahora = () => Date.now() + desfase;
  const pad = n => String(n).padStart(2, "0");
  const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };

  async function sincronizar() {
    const t0 = Date.now();
    const { data, error } = await supa.rpc("hipodromo_ahora");
    if (error || !data) return;
    desfase = new Date(data).getTime() - (t0 + Date.now()) / 2;
  }
  async function leer() {
    if (leyendo) return;
    leyendo = true; ultimaLectura = Date.now();
    try {
      const { data, error } = await supa.from("hipodromo_programa").select("n, hora, cierre, publico").order("n", { ascending: false }).limit(1);
      if (!error && data && data.length) {
        const f = data[0];
        prog = { n: f.n, hora: new Date(f.hora).getTime(), cierre: new Date(f.cierre).getTime(), suspendida: !!(f.publico && f.publico.suspendida) };
      }
    } catch (e) { /* sin servidor: no hay aviso */ }
    leyendo = false;
  }

  function ocultar() { if (!caja.hidden) { caja.hidden = true; estado = ""; } }
  function pintar() {
    if (!prog || prog.suspendida) { ocultar(); return; }
    const resto = prog.hora - ahora();
    let nuevo = "";
    if (resto > 0 && resto <= AVISO_MS) nuevo = resto <= 60000 ? "ya" : "pronto";
    else if (resto <= 0 && resto > -DURACION_MS) nuevo = "corre";
    if (!nuevo) { ocultar(); return; }
    caja.hidden = false;
    caja.dataset.estado = nuevo;
    const corre = nuevo === "corre";
    $("lbAvisoTxt").textContent = corre ? `¡La carrera ${prog.n} está corriendo ahora mismo!` : `La carrera ${prog.n} del Hipódromo sale en`;
    $("lbAvisoCrono").hidden = corre;
    if (!corre) $("lbAvisoCrono").textContent = mmss(resto);
    $("lbAvisoApostar").hidden = corre || ahora() >= prog.cierre;
    // El lector de pantalla solo oye los cambios de fase, no cada segundo
    if (nuevo !== estado) {
      estado = nuevo;
      $("lbAvisoLector").textContent = corre ? `La carrera ${prog.n} está corriendo.` : nuevo === "ya" ? `La carrera ${prog.n} sale en menos de un minuto.` : `La carrera ${prog.n} sale en menos de cinco minutos.`;
    }
  }

  function vuelta() {
    if (!activo) return;
    pintar();
    if (simulada || !supa) return;
    // Se vuelve a leer poco: una vez por minuto, cada 30 s cuando ya casi sale y cada 10 s hasta que aparezca la siguiente carrera
    const resto = prog ? prog.hora - ahora() : null;
    const espera = !prog || resto < -DURACION_MS - 5000 ? 10000 : resto <= AVISO_MS + 60000 ? 30000 : 60000;
    if (!document.hidden && Date.now() - ultimaLectura >= espera) leer();
  }

  async function arrancar() {
    if (activo) return;
    activo = true;
    if (simulada > 0) {
      prog = { n: "de prueba", hora: Date.now() + Math.min(simulada, 300) * 1000, cierre: Date.now() + Math.min(simulada, 300) * 1000 - 20000, suspendida: false };
    } else {
      try { supa = await fichasCliente(); await sincronizar(); await leer(); } catch (e) { activo = false; return; }
      setInterval(() => { if (activo && supa) sincronizar().catch(() => {}); }, 5 * 60000);
    }
    pintar();
    reloj = setInterval(vuelta, 1000);
  }
  function parar() { activo = false; clearInterval(reloj); ocultar(); }

  if (simulada > 0) arrancar();
  else if (typeof fichasEnCambioDeSesion === "function") fichasEnCambioDeSesion(ses => { if (ses) arrancar(); else parar(); }).catch(() => {});
})();
