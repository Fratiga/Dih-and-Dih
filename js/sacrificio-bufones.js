/* Bufones de Slappy bailando encima del juego de Hooey. Un solo renderer y
   una sola escena para todos (clones del mismo modelo), con el canvas encima
   del campo pero con pointer-events: none, así que los clics lo atraviesan y
   siguen llegando a los Hooeys de abajo. El modelo (~7 MB) se carga recién
   cuando se pulsa play, no con la página. */
(function () {
  const NOMBRES_BAILE = [
    "breakdance", "Breakdance", "Breakdancemedio", "Breakdancerapido",
    "Rumba", "SillyDance", "Sillydance2", "Sillydance2rapido",
    "Twerk", "Twist"
  ];
  const BUFONES_PARA_REBOTAR = 3;

  let contenedor = null;
  let cargaPromesa = null;
  let THREE = null;
  let SkeletonUtils = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let modelo = null;
  let centro = null;
  let radio = 1;
  let clips = {};
  let bailes = [];
  let reloj = null;
  let ancho = 0;
  let alto = 0;
  let bufones = [];
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

  function tamanoBufon() {
    return Math.max(110, Math.min(190, ancho * 0.3));
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

      ancho = contenedor.clientWidth || 600;
      alto = contenedor.clientHeight || 440;

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(0, ancho, alto, 0, 1, 3000);
      camera.position.z = 1500;

      renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: !navigator.gpu });
      await renderer.init();
      renderer.setPixelRatio(1);
      renderer.setSize(ancho, alto);
      renderer.setClearColor(0x000000, 0);
      contenedor.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 1.3);
      dir.position.set(200, 400, 600);
      scene.add(dir);
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.35).texture;

      await pausa();
      const respuesta = await fetch("data:application/octet-stream;base64," + window.CLOWN_GLB_BASE64);
      const buffer = await respuesta.arrayBuffer();
      await pausa();
      const gltf = await new GLTFLoader().parseAsync(buffer, "");
      modelo = gltf.scene;
      modelo.traverse(o => { if (o.isMesh && o.material) o.material.side = THREE.FrontSide; });

      const caja = new THREE.Box3().setFromObject(modelo, true);
      const esfera = new THREE.Sphere();
      caja.getBoundingSphere(esfera);
      centro = esfera.center.clone();
      radio = esfera.radius || 1;

      gltf.animations.forEach(c => { clips[c.name] = c; });
      bailes = NOMBRES_BAILE.filter(n => clips[n]);
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
        ancho = contenedor.clientWidth || ancho;
        alto = contenedor.clientHeight || alto;
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

  function elegirBaile(esElPrimero) {
    if (esElPrimero && clips.Twerk) return "Twerk";
    return bailes[Math.floor(Math.random() * bailes.length)];
  }

  function crearBufon(indice) {
    const lado = tamanoBufon();
    const interior = SkeletonUtils.clone(modelo);
    interior.position.copy(centro).multiplyScalar(-1);
    const grupo = new THREE.Group();
    grupo.add(interior);
    grupo.scale.setScalar(lado / (2 * radio));

    const x = lado / 2 + Math.random() * Math.max(1, ancho - lado);
    const y = lado / 2 + Math.random() * Math.max(1, alto - lado);
    grupo.position.set(x, alto - y, 0);
    scene.add(grupo);

    const mixer = new THREE.AnimationMixer(interior);
    const nombre = elegirBaile(indice === 0);
    if (nombre) {
      const accion = mixer.clipAction(clips[nombre]);
      accion.setLoop(THREE.LoopRepeat, Infinity);
      accion.timeScale = 2;
      accion.play();
    }

    const rumbo = Math.random() * Math.PI * 2;
    const rapidez = 160 + Math.random() * 140;
    return { grupo, mixer, x, y, lado, vx: Math.cos(rumbo) * rapidez, vy: Math.sin(rumbo) * rapidez, rebota: false };
  }

  function cuadro() {
    const dt = Math.min(0.05, reloj.getDelta());
    for (const b of bufones) {
      b.mixer.update(dt);
      if (b.rebota) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const m = b.lado / 2;
        if (b.x < m) { b.x = m; b.vx = Math.abs(b.vx); }
        if (b.x > ancho - m) { b.x = ancho - m; b.vx = -Math.abs(b.vx); }
        if (b.y < m) { b.y = m; b.vy = Math.abs(b.vy); }
        if (b.y > alto - m) { b.y = alto - m; b.vy = -Math.abs(b.vy); }
        b.grupo.position.set(b.x, alto - b.y, 0);
        b.grupo.rotation.y += dt * 7;
        b.grupo.rotation.z += dt * 2.5;
      }
    }
    renderer.render(scene, camera);
  }

  function limpiar() {
    generacion += 1;
    if (!renderer) return;
    renderer.setAnimationLoop(null);
    for (const b of bufones) scene.remove(b.grupo);
    bufones = [];
    renderer.render(scene, camera); // deja el canvas vacío
  }

  async function sincronizar(cantidad) {
    if (cantidad <= 0) { limpiar(); return; }
    const miGeneracion = ++generacion;
    try { await cargar(); } catch (e) { return; }
    if (miGeneracion !== generacion) return;

    while (bufones.length < cantidad) bufones.push(crearBufon(bufones.length));
    if (bufones.length >= BUFONES_PARA_REBOTAR) bufones.forEach(b => { b.rebota = true; });
    reloj.getDelta();
    renderer.setAnimationLoop(cuadro);
  }

  window.SacrificioBufones = {
    precargar() { cargar().catch(() => { /* el juego sigue sin bufones */ }); },
    sincronizar,
    limpiar
  };
})();
