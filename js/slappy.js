/* =============================================================================
   SLAPPY BAILANDO — huevo de pascua permanente. Se prende/apaga escribiendo
   "Slappy" en el widget de contraseñas mágicas (ver initClaveMagicaWidget en
   js/lado.js, que llama a toggleSlappy() acá abajo en vez de mostrar una
   imagen). Reusa el mismo modelo 3D y el mismo repertorio de bailes que ya
   existe para el Bufón en secreto.html, pero acá el modelo/Three.js se
   cargan recién cuando hace falta — no tiene sentido sumarle ~7MB a cada
   carga del sitio por un chiste escondido.

   "Permanente" quiere decir: el estado (prendido/apagado) vive en
   localStorage y sobrevive a la navegación entre páginas — cada carga
   nueva vuelve a armar la escena de cero si estaba prendido, no es la
   misma instancia de JS sobreviviendo (eso no existe en un sitio
   multipágina), pero el efecto para quien mira es el mismo: sigue
   bailando en cualquier página hasta que se apague a propósito.
============================================================================= */
(function () {
  const SLAPPY_KEY = "slappyActivo";

  // Mismo repertorio de bailes que la idle de aburrimiento del Bufón (ver
  // secreto.html) — nombres de clip verificados contra el GLB real.
  const NOMBRES_BAILE = [
    "breakdance", "Breakdance", "Breakdancemedio", "Breakdancerapido",
    "Rumba", "SillyDance", "Sillydance2", "Sillydance2rapido",
    "Twerk", "Twist"
  ];
  const RECAMBIO_MS = 9000; // cada cuánto cambia de baile (van al doble de velocidad)

  let escenaPromesa = null;
  let renderer = null;
  let intervaloBaile = null;
  let resizeHandler = null;

  function contenedor() {
    return document.getElementById("slappyContenedor");
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

  function mostrarContenedor(mostrar) {
    const cont = contenedor();
    if (cont) cont.classList.toggle("hidden", !mostrar);
  }

  async function iniciarEscena() {
    const cont = contenedor();
    if (!cont) return;

    if (!window.CLOWN_GLB_BASE64) await cargarScriptClasico("assets/clown-model-base64.js");

    const THREE = await import("three");
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

    const w = cont.clientWidth || 600;
    const h = cont.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);

    renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
    await renderer.init();
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    cont.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.3);
    dir.position.set(2, 4, 3);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dir2.position.set(-2, 1, -2);
    scene.add(dir2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.35).texture;

    const binary = atob(window.CLOWN_GLB_BASE64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer, "");
    const clown = gltf.scene;

    clown.traverse(o => { if (o.isMesh && o.material) o.material.side = THREE.FrontSide; });

    const box = new THREE.Box3().setFromObject(clown, true);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    clown.position.sub(sphere.center);
    clown.updateMatrixWorld(true);

    const jester = new THREE.Group();
    jester.add(clown);
    scene.add(jester);

    const fitDistance = sphere.radius / Math.sin((camera.fov * Math.PI / 180) / 2);
    const distance = fitDistance * 1.2;
    camera.position.set(0, sphere.radius * 0.1, distance);
    camera.lookAt(0, 0, 0);
    // El modelo viene en una escala muy chica (radio ~0.04 unidades) — con el
    // near plane por defecto (0.1) la cámara queda MÁS cerca que el propio
    // near, así que recorta el modelo entero y no se ve nada. Ajustarlo en
    // proporción a la distancia real (misma idea que la cámara de cara en
    // secreto.html) lo arregla para cualquier escala de modelo.
    camera.near = Math.max(0.001, distance * 0.02);
    camera.updateProjectionMatrix();

    const mixer = new THREE.AnimationMixer(clown);
    const clipsPorNombre = {};
    gltf.animations.forEach(clip => { clipsPorNombre[clip.name] = clip; });
    const bailesDisponibles = NOMBRES_BAILE.filter(n => clipsPorNombre[n]);

    let accionActual = null;
    function reproducirBaileAlAzar() {
      if (!bailesDisponibles.length) return;
      const nombre = bailesDisponibles[Math.floor(Math.random() * bailesDisponibles.length)];
      const accion = mixer.clipAction(clipsPorNombre[nombre]);
      accion.reset();
      accion.setLoop(THREE.LoopRepeat, Infinity);
      accion.timeScale = 2; // el doble de velocidad, a propósito
      accion.enabled = true;
      accion.setEffectiveWeight(1);
      if (accionActual && accionActual !== accion) {
        accion.play();
        accionActual.crossFadeTo(accion, 0.25, true);
      } else {
        accion.fadeIn(0.2).play();
      }
      accionActual = accion;
    }
    reproducirBaileAlAzar();
    intervaloBaile = setInterval(reproducirBaileAlAzar, RECAMBIO_MS);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const delta = clock.getDelta();
      mixer.update(delta);
      jester.rotation.y += delta * 0.1;
      renderer.render(scene, camera);
    });

    resizeHandler = () => {
      const w2 = cont.clientWidth || w;
      const h2 = cont.clientHeight || h;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", resizeHandler);
  }

  function detenerEscena() {
    if (renderer) {
      renderer.setAnimationLoop(null);
      try { renderer.dispose(); } catch (e) { /* no todas las versiones lo requieren */ }
    }
    if (intervaloBaile) clearInterval(intervaloBaile);
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    const cont = contenedor();
    if (cont) cont.innerHTML = "";
    escenaPromesa = null;
    renderer = null;
    intervaloBaile = null;
    resizeHandler = null;
  }

  window.toggleSlappy = function () {
    const activo = localStorage.getItem(SLAPPY_KEY) === "1";
    if (activo) {
      localStorage.removeItem(SLAPPY_KEY);
      mostrarContenedor(false);
      detenerEscena();
    } else {
      localStorage.setItem(SLAPPY_KEY, "1");
      mostrarContenedor(true);
      if (!escenaPromesa) {
        escenaPromesa = iniciarEscena().catch(err => console.warn("Slappy no se pudo cargar:", err));
      }
    }
  };

  // Si ya estaba prendido de una carga anterior, arranca solo.
  if (localStorage.getItem(SLAPPY_KEY) === "1") {
    mostrarContenedor(true);
    escenaPromesa = iniciarEscena().catch(err => console.warn("Slappy no se pudo cargar:", err));
  }
})();
