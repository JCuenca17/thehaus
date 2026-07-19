/**
 * Escena 3D del plano, solo para /app.
 *
 * Sustituye al SVG isometrico dentro de la aplicacion de reservas: aqui
 * hay volumen, luz y sombras de verdad, y el plano se gira arrastrando.
 * La landing sigue con mapa.js, que pesa nada y lo indexa Google; el coste
 * de three.js solo lo paga quien entra a reservar.
 *
 * Mantiene la misma API que renderizarMapa() —aplicarEstados, resumen,
 * girar…— para que la aplicacion no sepa con cual de los dos habla.
 *
 * La geometria sigue saliendo entera de planta.js. El canvas no es
 * accesible, asi que se publica en paralelo una lista de unidades en DOM
 * real: sin ella, reservar con teclado o lector de pantalla seria
 * imposible.
 */
import * as THREE from "../vendor/three.module.min.js";
import { LOCAL, ZONAS, SERVICIOS, PUESTOS, ESPACIOS, ESTADOS, CIRCULACION, ACCESO } from "./planta.js";
import * as M from "./muebles3d.js";

/* Centimetros del modelo a metros de escena, con el local centrado */
const E = 100;
const CX = LOCAL.ancho / 2 / E;
const CZ = LOCAL.alto / 2 / E;

const aX = (cm) => cm / E - CX;
const aZ = (cm) => cm / E - CZ;

/** Centro de un rectangulo de planta, en coordenadas de escena */
const centro = ({ x, y, w, h }) => [aX(x + w / 2), aZ(y + h / 2)];

const COLOR_ESTADO = {
  libre: 0x5fbf8f,
  reservado: 0xe0a33c,
  ocupado: 0xb9bec6,
};

const SUELOS = {
  local: 0xe7e4df,
  pasillo: 0xf7f5f2,
  zona: 0xdedad4,
  acceso: 0xd8a63e,
};

export function crearEscena(contenedor, opciones = {}) {
  const { alSeleccionar } = opciones;

  const estados = new Map();
  const unidades = new Map(); // id → {unidad, plataforma, material}

  /* ─── Motor ─── */

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // por encima de 2 no se nota y cuesta el doble
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  contenedor.appendChild(renderer.domElement);

  const escena = new THREE.Scene();
  const camara = new THREE.PerspectiveCamera(38, 1, 0.5, 200);

  /* ─── Luz ───
     Una direccional hace la sombra y da la forma; la hemisferica levanta
     los interiores para que nada quede en negro plano. */
  escena.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a8, 2.1));

  const sol = new THREE.DirectionalLight(0xfff4e2, 2.6);
  sol.position.set(9, 14, 7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.bias = -0.0008;
  sol.shadow.normalBias = 0.02;
  const s = sol.shadow.camera;
  s.left = -16; s.right = 16; s.top = 14; s.bottom = -14; s.near = 1; s.far = 45;
  s.updateProjectionMatrix();
  escena.add(sol);

  /* ─── Suelos ─── */

  const losa = (rect, color, alto, y) => {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(rect.w / E, alto, rect.h / E),
      new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
    );
    const [cx, cz] = centro(rect);
    m.position.set(cx, y + alto / 2, cz);
    m.receiveShadow = true;
    return m;
  };

  escena.add(losa({ x: 0, y: 0, w: LOCAL.ancho, h: LOCAL.alto }, SUELOS.local, 0.12, -0.12));
  for (const z of ZONAS) escena.add(losa(z.rect, SUELOS.zona, 0.015, 0));
  for (const c of CIRCULACION) escena.add(losa(c.rect, SUELOS.pasillo, 0.02, 0));
  escena.add(losa(ACCESO, SUELOS.acceso, 0.03, 0));

  /* ─── Ayudas para colocar muebles ─── */

  /** Coloca un grupo en el punto de planta indicado, con giro cardinal */
  const poner = (grupo, xcm, ycm, { mira = "norte", y = 0.02 } = {}) => {
    grupo.position.set(aX(xcm), y, aZ(ycm));
    grupo.rotation.y = M.GIRO_CARDINAL[mira] ?? 0;
    return grupo;
  };

  /* ─── Mobiliario por tipo de unidad ─── */

  const MUEBLES = {
    coworking(unidad, g) {
      const { rect } = unidad;
      const alSur = unidad.mira === "sur";
      const [cx, cz] = centro(rect);
      const signo = alSur ? 1 : -1;
      // El tablero va al centro de la isla y la silla al exterior
      const mesaZ = cz + signo * (rect.h / E / 2 - 0.38);
      const sillaZ = cz - signo * (rect.h / E / 2 - 0.42);

      const mesa = M.escritorio(rect.w / E - 0.08, 0.7);
      mesa.position.set(cx, 0.02, mesaZ);
      mesa.rotation.y = alSur ? Math.PI : 0;
      g.add(mesa);

      const sil = M.silla();
      sil.position.set(cx, 0.02, sillaZ);
      sil.rotation.y = alSur ? Math.PI : 0;
      g.add(sil);
    },

    lounge(unidad, g) {
      const [cx, cz] = centro(unidad.rect);
      g.add(poner(M.butaca(1.0, 0.95), unidad.rect.x + unidad.rect.w / 2, unidad.rect.y + unidad.rect.h / 2, { mira: unidad.mira }));
      const mesita = M.mesa(0.5, 0.5, 0.42, M.MAT.maderaOscura);
      mesita.position.set(cx, 0.02, cz + (unidad.mira === "sur" ? 0.72 : -0.72));
      g.add(mesita);
    },

    oficinas(unidad, g) {
      const { rect } = unidad;
      const [cx, cz] = centro(rect);
      const w = rect.w / E;
      const d = rect.h / E;

      // Mamparas en tres lados: el cuarto es la entrada
      const norte = M.mampara(w); norte.position.set(cx, 0.02, cz - d / 2); g.add(norte);
      for (const s2 of [-1, 1]) {
        const lateral = M.mampara(d);
        lateral.position.set(cx + s2 * (w / 2), 0.02, cz);
        lateral.rotation.y = Math.PI / 2;
        g.add(lateral);
      }

      const escritorioOf = M.escritorio(w - 0.45, 0.65);
      escritorioOf.position.set(cx, 0.02, cz - d / 2 + 0.55);
      g.add(escritorioOf);

      for (const s2 of [-1, 1]) {
        const sil = M.silla(0.44, 0.44);
        sil.position.set(cx + s2 * 0.32, 0.02, cz - d / 2 + 1.3);
        g.add(sil);
      }
      g.add(poner(M.maceta(), rect.x + rect.w - 28, rect.y + rect.h - 28));
    },

    juntas(unidad, g) {
      const { rect } = unidad;
      const [cx, cz] = centro(rect);

      const tabla = M.mesa(3.9, 1.2);
      tabla.position.set(cx, 0.02, cz);
      g.add(tabla);

      // Cinco a cada lado, mirandose
      for (let i = 0; i < 5; i++) {
        const x = cx - 1.6 + i * 0.8;
        for (const s2 of [-1, 1]) {
          const sil = M.silla(0.5, 0.5);
          sil.position.set(x, 0.02, cz + s2 * 0.95);
          sil.rotation.y = s2 === 1 ? 0 : Math.PI;
          g.add(sil);
        }
      }

      const tv = M.pantallaMural(1.5);
      tv.position.set(cx + rect.w / E / 2 - 0.25, 0.02, cz);
      tv.rotation.y = -Math.PI / 2;
      g.add(tv);
    },

    auditorio(unidad, g) {
      const { rect } = unidad;
      const [cx, cz] = centro(rect);
      const w = rect.w / E;

      const escenario = M.tarima(1.3, rect.h / E - 0.4);
      escenario.position.set(cx + w / 2 - 0.75, 0.02, cz);
      g.add(escenario);

      const tv = M.pantallaMural(2.4, 1.3);
      tv.position.set(cx + w / 2 - 0.12, 0.24, cz);
      tv.rotation.y = -Math.PI / 2;
      g.add(tv);

      // Cinco filas de seis, todas hacia la pantalla (este)
      for (let fila = 0; fila < 5; fila++)
        for (let n = 0; n < 6; n++) {
          const sil = M.silla(0.48, 0.5);
          sil.position.set(cx - w / 2 + 0.6 + fila * 1.15, 0.02, cz - 1.5 + n * 0.6);
          sil.rotation.y = -Math.PI / 2;
          g.add(sil);
        }
    },
  };

  /* ─── Unidades reservables ─── */

  const grupoUnidades = new THREE.Group();
  escena.add(grupoUnidades);

  for (const unidad of [...PUESTOS, ...ESPACIOS]) {
    const g = new THREE.Group();
    g.userData.id = unidad.id;

    // Plataforma: es la que lleva el color de estado. Los muebles no
    // cambian de color, que si no el plano parece un semaforo.
    const material = new THREE.MeshStandardMaterial({
      color: COLOR_ESTADO.libre,
      roughness: 0.85,
    });
    const plataforma = new THREE.Mesh(
      new THREE.BoxGeometry(unidad.rect.w / E, 0.04, unidad.rect.h / E),
      material,
    );
    const [cx, cz] = centro(unidad.rect);
    plataforma.position.set(cx, 0.02, cz);
    plataforma.receiveShadow = true;
    plataforma.userData.id = unidad.id;
    g.add(plataforma);

    // Los muebles se funden en una malla por material; la plataforma queda
    // fuera porque su color cambia con el estado de la reserva
    const muebles = new THREE.Group();
    MUEBLES[unidad.zona]?.(unidad, muebles);
    g.add(M.fundirGrupo(muebles));

    grupoUnidades.add(g);
    unidades.set(unidad.id, { unidad, material, grupo: g });
    estados.set(unidad.id, "libre");
  }

  /* ─── Servicios: no se reservan, pero sin ellos no es un local ─── */

  const servicio = {
    recepcion(rect, g) {
      const [cx, cz] = centro(rect);
      const most = M.mostrador(rect.w / E - 1.1, 0.6);
      most.position.set(cx - 0.4, 0.02, cz - 0.5);
      g.add(most);

      const lateral = M.mostrador(1.4, 0.6);
      lateral.position.set(cx + rect.w / E / 2 - 0.9, 0.02, cz + 0.25);
      lateral.rotation.y = Math.PI / 2;
      g.add(lateral);

      g.add(poner(M.silla(), rect.x + 120, rect.y + 190, { mira: "norte" }));
      g.add(poner(M.maceta(), rect.x + rect.w - 45, rect.y + rect.h - 45));
    },

    cafeteria(rect, g) {
      const [cx, cz] = centro(rect);
      const barra = M.mostrador(rect.w / E - 1.6, 0.65, 1.1);
      barra.position.set(cx - 0.5, 0.02, aZ(rect.y + 55));
      g.add(barra);

      // Cafetera sobre la barra
      g.add(poner(M.armario(0.42, 0.36, 0.5, M.MAT.metal), rect.x + 90, rect.y + 55, { y: 1.12 }));

      for (let i = 0; i < 2; i++)
        g.add(poner(M.armario(0.75, 0.6, 1.9), rect.x + rect.w - 130 + i * 80, rect.y + 60));

      for (let i = 0; i < 4; i++)
        g.add(poner(M.taburete(), rect.x + 80 + i * 75, rect.y + 135));

      // Dos mesas para quedarse: sin ellas es un office, no una cafeteria
      for (const my of [rect.y + 300, rect.y + 460]) {
        const t = M.mesa(1.3, 0.85, 0.74);
        t.position.set(cx - 0.6, 0.02, aZ(my));
        g.add(t);
        for (const dx of [-45, 45])
          for (const [dz, mira] of [[-75, "sur"], [75, "norte"]])
            g.add(poner(M.silla(0.46, 0.46), rect.x + 195 + dx, my + dz, { mira }));
      }
    },

    aseos(rect, g) {
      const ancho = rect.w / E;
      for (let i = 0; i < 3; i++)
        g.add(poner(M.cabina(ancho / 3 - 0.08, 1.25), rect.x + rect.w / 6 + (i * rect.w) / 3, rect.y + 80));
      const pila = M.lavabos(ancho - 0.5, 0.55);
      const [cx] = centro(rect);
      pila.position.set(cx, 0.02, aZ(rect.y + rect.h - 45));
      pila.rotation.y = Math.PI;
      g.add(pila);
    },
  };

  for (const s2 of SERVICIOS) {
    const g = new THREE.Group();
    servicio[s2.id]?.(s2.rect, g);
    escena.add(M.fundirGrupo(g));
  }

  /* ─── Espejo accesible ───
     Un canvas es un pixel opaco: ni lector de pantalla ni teclado entran.
     Se publica la misma informacion como botones reales, fuera de vista
     pero enfocables, para que reservar no dependa de ver ni de usar raton.
     El estado va en el texto y no solo en el color de la plataforma. */

  const lista = document.createElement("ul");
  lista.className = "solo-asistencia";
  lista.setAttribute("aria-label", "Unidades reservables del plano");

  const filas = new Map();
  for (const [id, { unidad }] of unidades) {
    const li = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.textContent = `${unidad.nombre}, libre`;
    boton.addEventListener("click", () =>
      alSeleccionar?.({ ...unidad, estado: estados.get(id) }),
    );
    li.appendChild(boton);
    lista.appendChild(li);
    filas.set(id, boton);
  }
  contenedor.appendChild(lista);

  /* ─── Camara orbital ───
     Angulo acimutal libre arrastrando y elevacion acotada: por debajo del
     suelo no hay nada que ver y por encima se pierde el volumen. */

  let theta = Math.PI * 0.25;
  let phi = Math.PI * 0.33;
  let objetivo = theta; // acimut de destino, para el boton de girar

  const MIN_RADIO = 6;
  const MAX_RADIO = 90;

  /* Encuadre calculado, no fijado a ojo: depende del tamaño de la ventana
     y del angulo, y en un movil apaisado el encuadre bueno no se parece en
     nada al de un escritorio.

     Se proyectan las ocho esquinas del volumen del local y se ajusta la
     distancia hasta que todas caben. Ajustar por la esfera envolvente
     seria mas corto pero deja el plano diminuto: la planta es plana y se
     ve escorzada, asi que ocupa mucho menos que la esfera que la envuelve. */
  const ESQUINAS = [];
  for (const sx of [-1, 1])
    for (const sy of [0, 1])
      for (const sz of [-1, 1])
        ESQUINAS.push(new THREE.Vector3((sx * LOCAL.ancho) / E / 2, sy * 2.4, (sz * LOCAL.alto) / E / 2));

  function distanciaParaEncuadrar() {
    const guardado = radio;
    radio = Math.hypot(LOCAL.ancho / E, LOCAL.alto / E); // punto de partida

    // Converge en dos o tres pasadas: el tamaño proyectado es casi
    // inversamente proporcional a la distancia
    for (let i = 0; i < 4; i++) {
      situarCamara();
      camara.updateMatrixWorld();
      let borde = 0;
      for (const p of ESQUINAS) {
        const v = p.clone().project(camara);
        borde = Math.max(borde, Math.abs(v.x), Math.abs(v.y));
      }
      radio *= borde / 0.94; // 0.94 deja un respiro contra los bordes
    }

    const ajustado = radio;
    radio = guardado;
    return ajustado;
  }

  let radio = 26; // se recalcula en cuanto se conoce el tamaño del lienzo
  // Mientras nadie haya tocado la camara el encuadre es nuestro y se
  // rehace con cada cambio de tamaño; en cuanto el usuario orbita o hace
  // zoom, la vista es suya y recolocarla seria arrebatarsela
  let camaraDelUsuario = false;

  function situarCamara() {
    phi = Math.min(Math.PI * 0.46, Math.max(0.15, phi));
    radio = Math.min(MAX_RADIO, Math.max(MIN_RADIO, radio));
    camara.position.set(
      radio * Math.sin(phi) * Math.sin(theta),
      radio * Math.cos(phi),
      radio * Math.sin(phi) * Math.cos(theta),
    );
    camara.lookAt(0, 0, 0);
  }

  /* ─── Bucle de dibujo bajo demanda ───
     La escena es estatica: solo se redibuja cuando algo cambia. Un bucle
     continuo gastaria bateria para repetir el mismo fotograma. */
  let pendiente = false;
  function pintar() {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      situarCamara();
      renderer.render(escena, camara);
    });
  }

  function dimensionar() {
    const { clientWidth: w, clientHeight: h } = contenedor;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    camara.updateProjectionMatrix();

    if (!camaraDelUsuario) radio = distanciaParaEncuadrar();
    pintar();
  }

  const observador = new ResizeObserver(dimensionar);
  observador.observe(contenedor);
  dimensionar();

  /* ─── Interaccion ─── */

  const punteros = new Map();
  let arrastrando = false;
  let movimiento = 0;
  let distanciaPrevia = null;

  const lienzo = renderer.domElement;
  lienzo.style.touchAction = "none";

  lienzo.addEventListener("pointerdown", (e) => {
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      arrastrando = true;
      movimiento = 0;
      lienzo.setPointerCapture(e.pointerId);
    }
  });

  lienzo.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    const previo = punteros.get(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanciaPrevia) {
        radio *= distanciaPrevia / d;
        camaraDelUsuario = true;
        pintar();
      }
      distanciaPrevia = d;
      return;
    }
    if (!arrastrando) return;

    const dx = e.clientX - previo.x;
    const dy = e.clientY - previo.y;
    movimiento += Math.abs(dx) + Math.abs(dy);
    theta -= dx * 0.006;
    phi -= dy * 0.005;
    objetivo = theta;
    camaraDelUsuario = true;
    pintar();
  });

  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) distanciaPrevia = null;
    if (punteros.size === 0) arrastrando = false;
  };
  lienzo.addEventListener("pointerup", soltar);
  lienzo.addEventListener("pointercancel", soltar);

  // La rueda no hace zoom, igual que en el plano plano: con un trackpad se
  // dispara sin querer mientras se recorre. El zoom vive en los botones.
  lienzo.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

  /* ─── Seleccion por rayo ─── */

  const rayo = new THREE.Raycaster();
  const punto = new THREE.Vector2();

  lienzo.addEventListener("click", (e) => {
    if (movimiento > 6) return; // era un arrastre, no una eleccion
    const caja = lienzo.getBoundingClientRect();
    punto.x = ((e.clientX - caja.left) / caja.width) * 2 - 1;
    punto.y = -((e.clientY - caja.top) / caja.height) * 2 + 1;

    rayo.setFromCamera(punto, camara);
    for (const golpe of rayo.intersectObjects(grupoUnidades.children, true)) {
      let nodo = golpe.object;
      while (nodo && !nodo.userData.id) nodo = nodo.parent;
      if (!nodo) continue;
      const registro = unidades.get(nodo.userData.id);
      if (registro) {
        alSeleccionar?.({ ...registro.unidad, estado: estados.get(nodo.userData.id) });
        return;
      }
    }
  });

  /* ─── Giro animado del acimut ─── */

  let animacion = null;
  const sinMovimiento = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  function animarHasta(destino, duracion = 520) {
    cancelAnimationFrame(animacion);
    const desde = theta;
    const t0 = performance.now();

    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / duracion);
      const suave = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      theta = desde + (destino - desde) * suave;
      pintar();
      if (t < 1) animacion = requestAnimationFrame(paso);
      else { theta = destino; animacion = null; pintar(); }
    };
    animacion = requestAnimationFrame(paso);
  }

  /* ─── API, igual que la del mapa SVG ─── */

  return {
    aplicarEstados(nuevos) {
      for (const [id, estado] of Object.entries(nuevos)) {
        if (!ESTADOS.includes(estado)) continue;
        estados.set(id, estado);
        const registro = unidades.get(id);
        if (registro) registro.material.color.setHex(COLOR_ESTADO[estado]);
        // El espejo accesible lleva el estado en el texto: el color de la
        // plataforma no puede ser el unico portador de la informacion
        const fila = filas.get(id);
        if (fila) fila.textContent = `${registro.unidad.nombre}, ${estado}`;
      }
      pintar();
    },
    obtenerEstado: (id) => estados.get(id) ?? null,
    resumen() {
      const total = { libre: 0, reservado: 0, ocupado: 0 };
      for (const e of estados.values()) total[e]++;
      return total;
    },
    resumenPorZona() {
      const porZona = new Map(ZONAS.map((z) => [z.id, { ...z, libres: 0, total: 0 }]));
      for (const [id, { unidad }] of unidades) {
        const z = porZona.get(unidad.zona);
        if (!z) continue;
        z.total++;
        if (estados.get(id) === "libre") z.libres++;
      }
      return [...porZona.values()];
    },
    /** Un cuarto de vuelta, como el boton del plano plano */
    girar(pasos = 1) {
      objetivo += (pasos * Math.PI) / 2;
      if (sinMovimiento()) { theta = objetivo; pintar(); }
      else animarHasta(objetivo);
      return objetivo;
    },
    acercar() { radio /= 1.25; camaraDelUsuario = true; pintar(); },
    alejar() { radio *= 1.25; camaraDelUsuario = true; pintar(); },
    reiniciar() {
      camaraDelUsuario = false;
      radio = distanciaParaEncuadrar();
      phi = Math.PI * 0.33;
      theta = objetivo = Math.PI * 0.25;
      pintar();
    },
    /** El arrastre orbita la camara; nunca es una seleccion */
    fueArrastre: () => movimiento > 6,
    listaUnidades: () => [...unidades.values()].map(({ unidad }) => unidad),
    /* Coste real del ultimo fotograma. Esta escena vive o muere por el
       numero de llamadas de dibujo, asi que conviene poder medirlo en el
       navegador de verdad en vez de estimarlo. */
    diagnostico: () => ({
      llamadas: renderer.info.render.calls,
      triangulos: renderer.info.render.triangles,
      geometrias: renderer.info.memory.geometries,
    }),
    destruir() {
      observador.disconnect();
      renderer.dispose();
      lienzo.remove();
    },
  };
}
