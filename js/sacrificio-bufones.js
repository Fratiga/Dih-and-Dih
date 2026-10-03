/* Bufones de Slappy bailando encima del juego de Hooey. Un solo renderer y
   una sola escena para todos (clones del mismo modelo), con el canvas encima
   del campo pero con pointer-events: none, así que los clics lo atraviesan y
   siguen llegando a los Hooeys de abajo. El modelo (~7 MB) se carga recién
   cuando se pulsa play, no con la página. */
(function () {
  // Repertorio verificado contra los clips del modelo. Mientras están quietos
  // alternan bailes y gestos; cuando rebotan por la pantalla, sobre todo corren.
  const GRUPOS = {
    baile: {
      velocidad: 2,
      nombres: ["breakdance", "Breakdance", "Breakdancemedio", "Breakdancerapido", "Rumba", "SillyDance",
        "Sillydance2", "Sillydance2rapido", "Twerk", "Twist", "Swag", "Gangnam"]
    },
    gesto: {
      velocidad: 1.5,
      nombres: ["Aplaudirnormal", "Aplaudirrapido", "Apuntando", "Auch", "Aymisbolas", "Bateria", "Boxing",
        "Cantando", "Cariñito", "Celebrar", "Fistifght", "happyidle", "JumpinJacks", "Mma Kick",
        "Pumpin", "Riendosesentao", "Saltito", "Toma pesao"]
    },
    correr: {
      velocidad: 1.6,
      nombres: ["Run", "Runlookback", "Injuredrun", "Crawl"]
    }
  };
  const BUFONES_PARA_REBOTAR = 3;
  const VUELTA_TPOSE = 2.6; // segundos por vuelta de los Slappy en T-pose
  const BUFONES_PARA_SALIR = 4; // desde acá rebotan por toda la ventana, no solo dentro del juego

  let contenedor = null;
  let cargaPromesa = null;
  let THREE = null;
  let SkeletonUtils = null;
  let renderer = null;
  let clasico = false;
  let ultimoCuadro = 0;
  let scene = null;
  let camera = null;
  let modelo = null;
  let centro = null;
  let radio = 1;
  let clips = {};
  const disponibles = { baile: [], gesto: [], correr: [] };
  let reloj = null;
  let ancho = 0;
  let alto = 0;
  let bufones = [];
  let tposes = [];
  let generacion = 0;

  function pausa() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  function cargarScriptClasico(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  // El lienzo cubre toda la ventana (fijo, sin capturar clics). Los bufones se
  // mueven dentro de la caja del juego hasta que son 4; entonces se sueltan y
  // rebotan contra los bordes de la ventana.
  let escenarioEl = null;
  function cajaEscenario() {
    if (!escenarioEl) escenarioEl = document.querySelector(".sacrificio-escenario");
    return escenarioEl ? escenarioEl.getBoundingClientRect() : { left: 0, top: 0, width: ancho, height: alto };
  }

  function tamanoBufon() {
    return cajaEscenario().width * 0.17; // proporcional al escenario, que ya tiene proporción fija
  }

  function ajustarCamara() {
    if (!camera) return;
    camera.left = 0;
    camera.right = ancho;
    camera.top = alto;
    camera.bottom = 0;
    camera.updateProjectionMatrix();
  }

  function cargar() {
    if (cargaPromesa) return cargaPromesa;
    cargaPromesa = (async () => {
      contenedor = document.getElementById("sacrificioBufones");
      if (!contenedor) throw new Error("Falta #sacrificioBufones");
      if (!window.CLOWN_GLB_BASE64) await cargarScriptClasico("assets/clown-model-base64.js?v=20260918");

      THREE = await import("three");
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      SkeletonUtils = await import("three/addons/utils/SkeletonUtils.js");
      const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

      ancho = contenedor.clientWidth || window.innerWidth;
      alto = contenedor.clientHeight || window.innerHeight;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, ancho, alto, 0, 1, 3000);
      camera.position.z = 1500;

      // WebGPU real solo donde es confiable. En Firefox se usa el WebGLRenderer
      // clásico, mucho más liviano que el modo WebGL de WebGPURenderer.
      // Si WebGPU falla al arrancar, también se cae a WebGL.
      clasico = /firefox/i.test(navigator.userAgent) || /[?&]clasico=1/.test(location.search);
      const prefiereWebGL = !navigator.gpu;
      async function abrirRenderer(webgl) {
        const r = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: webgl });
        await r.init();
        return r;
      }
      try {
        if (clasico) {
          renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
        } else {
          renderer = await abrirRenderer(prefiereWebGL);
        }
      } catch (err) {
        if (prefiereWebGL) throw err;
        console.warn("WebGPU falló, se usa WebGL:", err);
        renderer = await abrirRenderer(true);
      }
      // El lienzo cubre toda la ventana: en el modo clásico se dibuja a menor
      // resolución (el navegador lo estira) para que Firefox no se arrastre.
      renderer.setPixelRatio(clasico ? 0.7 : 1);
      renderer.setSize(ancho, alto);
      renderer.setClearColor(0x000000, 0);
      contenedor.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, clasico ? 2 : 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, clasico ? 2.2 : 1.3);
      dir.position.set(200, 400, 600);
      scene.add(dir);
      if (!clasico) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.35).texture;
      }

      await pausa();
      const respuesta = await fetch("data:application/octet-stream;base64," + window.CLOWN_GLB_BASE64);
      const buffer = await respuesta.arrayBuffer();
      await pausa();
      const gltf = await new GLTFLoader().parseAsync(buffer, "");
      modelo = gltf.scene;
      modelo.traverse(o => {
        if (!o.isMesh || !o.material) return;
        o.material.side = THREE.FrontSide;
        // Sin mapa de entorno, lo metálico se ve negro: se baja el metal
        if (clasico && o.material.metalness > 0.2) o.material.metalness = 0.2;
      });

      const caja = new THREE.Box3().setFromObject(modelo, true);
      const esfera = new THREE.Sphere();
      caja.getBoundingSphere(esfera);
      centro = esfera.center.clone();
      radio = esfera.radius || 1;

      gltf.animations.forEach(c => { clips[c.name] = c; });
      try {
        if (!window.GANGNAM_CLIP) await cargarScriptClasico("assets/gangnam-clip.js?v=20261054");
        const g = window.GANGNAM_CLIP;
        // three.js quita los dos puntos de los nombres de nodo al cargar el modelo
        const pistas = g.pistas.map(p => {
          const n = p.n.replace(":", "");
          return n.endsWith(".quaternion")
            ? new THREE.QuaternionKeyframeTrack(n, p.t, p.v)
            : new THREE.VectorKeyframeTrack(n, p.t, p.v);
        });
        clips.Gangnam = new THREE.AnimationClip("Gangnam", g.duracion, pistas);
      } catch (e) { console.warn("[bufones] no se cargó el Gangnam:", e); }
      Object.keys(GRUPOS).forEach(g => { disponibles[g] = GRUPOS[g].nombres.filter(n => clips[n]); });
      reloj = new THREE.Clock();

      // Calentamiento: un bufón diminuto dentro de la vista, dibujado una vez,
      // para que los shaders se compilen ahora y no cuando aparezca el primero.
      await pausa();
      const prueba = crearBufon(0);
      prueba.grupo.scale.setScalar(0.0001 * prueba.grupo.scale.x);
      prueba.grupo.position.set(ancho / 2, alto / 2, 0);
      try {
        if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
        if (renderer.renderAsync) await renderer.renderAsync(scene, camera); else renderer.render(scene, camera);
      } catch (e) { /* si falla, igual se compila al primer uso */ }
      scene.remove(prueba.grupo);

      window.addEventListener("resize", () => {
        ancho = contenedor.clientWidth || window.innerWidth;
        alto = contenedor.clientHeight || window.innerHeight;
        renderer.setSize(ancho, alto);
        ajustarCamara();
      });
    })().catch(err => {
      console.warn("Los bufones no se pudieron cargar:", err);
      cargaPromesa = null;
      throw err;
    });
    return cargaPromesa;
  }

  function elegirAnimacion(b, esElPrimero) {
    if (esElPrimero && clips.Twerk) return { nombre: "Twerk", velocidad: GRUPOS.baile.velocidad };
    const r = Math.random();
    let grupo;
    if (b.rebota) grupo = r < 0.65 ? "correr" : r < 0.85 ? "gesto" : "baile";
    else grupo = r < 0.5 ? "baile" : "gesto";
    if (!disponibles[grupo].length) grupo = Object.keys(disponibles).find(g => disponibles[g].length);
    if (!grupo) return null;
    const lista = disponibles[grupo];
    return { nombre: lista[Math.floor(Math.random() * lista.length)], velocidad: GRUPOS[grupo].velocidad };
  }

  function cambiarAnimacion(b, esElPrimero) {
    const sel = elegirAnimacion(b, esElPrimero);
    if (!sel) return;
    const accion = b.mixer.clipAction(clips[sel.nombre]);
    accion.reset();
    accion.setLoop(THREE.LoopRepeat, Infinity);
    accion.timeScale = sel.velocidad;
    accion.enabled = true;
    accion.setEffectiveWeight(1);
    if (b.accion && b.accion !== accion) {
      accion.play();
      b.accion.crossFadeTo(accion, 0.3, true);
    } else {
      accion.fadeIn(0.2).play();
    }
    b.accion = accion;
    // El del twerk se queda un buen rato; los demás cambian cada pocos segundos
    b.cambio = esElPrimero && sel.nombre === "Twerk" ? 9 : 3.5 + Math.random() * 4.5;
  }

  function crearBufon(indice, libre) {
    const lado = tamanoBufon();
    const caja = cajaEscenario();
    const interior = SkeletonUtils.clone(modelo);
    interior.position.copy(centro).multiplyScalar(-1);
    const grupo = new THREE.Group();
    grupo.add(interior);
    grupo.scale.setScalar(lado / (2 * radio));

    // Libre: coordenadas de ventana. Si no: relativas a la caja del juego.
    const anchoZona = libre ? ancho : caja.width;
    const altoZona = libre ? alto : caja.height;
    const x = lado / 2 + Math.random() * Math.max(1, anchoZona - lado);
    const y = lado / 2 + Math.random() * Math.max(1, altoZona - lado);
    grupo.position.set(libre ? x : caja.left + x, alto - (libre ? y : caja.top + y), 0);
    scene.add(grupo);

    const mixer = new THREE.AnimationMixer(interior);
    const rumbo = Math.random() * Math.PI * 2;
    const rapidez = (160 + Math.random() * 140) * (caja.width / 960);
    const b = { grupo, mixer, x, y, lado, libre: !!libre, vx: Math.cos(rumbo) * rapidez, vy: Math.sin(rumbo) * rapidez, rebota: false, accion: null, cambio: 0 };
    const primero = indice === 0;
    cambiarAnimacion(b, primero);
    // El del twerk aparece de espaldas (180°), para verle la espalda
    if (primero && b.accion && clips.Twerk && b.accion.getClip() === clips.Twerk) grupo.rotation.y = Math.PI;
    return b;
  }

  // Slappy gigante en T-pose (sin animación, la pose original del modelo),
  // girando sobre cada banner lateral.
  function crearTpose(banner) {
    const interior = SkeletonUtils.clone(modelo);
    interior.position.copy(centro).multiplyScalar(-1);
    const grupo = new THREE.Group();
    grupo.add(interior);
    scene.add(grupo);
    return { grupo, banner };
  }

  function actualizarTposes(dt) {
    for (const t of tposes) {
      const r = t.banner.getBoundingClientRect();
      // En pantallas angostas los banners no se muestran
      t.grupo.visible = r.width > 0;
      if (!r.width) continue;
      const lado = Math.max(r.width * 1.9, 240);
      t.grupo.scale.setScalar(lado / (2 * radio));
      t.grupo.position.set(r.left + r.width / 2, alto - (r.top + r.height / 2), 0);
      t.grupo.rotation.y += dt * (Math.PI * 2 / VUELTA_TPOSE);
    }
  }

  function cuadro() {
    // En el modo clásico (Firefox) se dibuja a 30 cuadros por segundo como máximo
    if (clasico) {
      const ahora = performance.now();
      if (ahora - ultimoCuadro < 30) return;
      ultimoCuadro = ahora;
    }
    const dt = Math.min(0.05, reloj.getDelta());
    const caja = cajaEscenario();
    for (const b of bufones) {
      b.mixer.update(dt);
      b.cambio -= dt;
      if (b.cambio <= 0) cambiarAnimacion(b, false);
      const m = b.lado / 2;
      const anchoZona = b.libre ? ancho : caja.width;
      const altoZona = b.libre ? alto : caja.height;
      if (b.rebota) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < m) { b.x = m; b.vx = Math.abs(b.vx); }
        if (b.x > anchoZona - m) { b.x = anchoZona - m; b.vx = -Math.abs(b.vx); }
        if (b.y < m) { b.y = m; b.vy = Math.abs(b.vy); }
        if (b.y > altoZona - m) { b.y = altoZona - m; b.vy = -Math.abs(b.vy); }
        b.grupo.rotation.y += dt * 7;
        b.grupo.rotation.z += dt * 2.5;
      }
      // Dentro de la caja siguen a la página si se hace scroll; sueltos, no.
      const px = b.libre ? b.x : caja.left + b.x;
      const py = b.libre ? b.y : caja.top + b.y;
      b.grupo.position.set(px, alto - py, 0);
    }
    actualizarTposes(dt);
    renderer.render(scene, camera);
  }

  function quitarTposes() {
    for (const t of tposes) scene.remove(t.grupo);
    tposes = [];
  }

  function limpiar() {
    generacion += 1;
    if (!renderer) return;
    renderer.setAnimationLoop(null);
    for (const b of bufones) scene.remove(b.grupo);
    bufones = [];
    quitarTposes();
    renderer.render(scene, camera); // deja el canvas vacío
  }

  async function sincronizar(cantidad, conTpose) {
    if (cantidad <= 0) { limpiar(); return; }
    const miGeneracion = ++generacion;
    try { await cargar(); } catch (e) { return; }
    if (miGeneracion !== generacion) return;

    const suelta = cantidad >= BUFONES_PARA_SALIR;
    while (bufones.length < cantidad) bufones.push(crearBufon(bufones.length, suelta));
    if (bufones.length >= BUFONES_PARA_REBOTAR) bufones.forEach(b => { if (!b.rebota) { b.rebota = true; b.cambio = 0; } });
    if (suelta) {
      // Con el cuarto, los que seguían dentro de la caja salen a la ventana
      const caja = cajaEscenario();
      for (const b of bufones) {
        if (!b.libre) { b.x += caja.left; b.y += caja.top; b.libre = true; }
      }
    }
    if (conTpose && !tposes.length) {
      document.querySelectorAll(".sacrificio-banner").forEach(el => tposes.push(crearTpose(el)));
    } else if (!conTpose && tposes.length) {
      quitarTposes();
    }
    reloj.getDelta();
    renderer.setAnimationLoop(cuadro);
  }

  window.SacrificioBufones = {
    precargar() { cargar().catch(() => { /* el juego sigue sin bufones */ }); },
    sincronizar,
    limpiar
  };
})();
