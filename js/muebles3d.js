/**
 * Mobiliario en geometria 3D real.
 *
 * Equivalente de mobiliario.js para la escena de three.js, pero aqui una
 * silla es un asiento con patas y respaldo, no dos cajas: con luz y sombras
 * de verdad, una caja se ve como lo que es.
 *
 * Todo se modela en metros y centrado en el origen mirando al norte (-Z);
 * la escena se encarga de colocarlo y girarlo. Las medidas salen de las
 * mismas unidades de planta.js, asi que el plano real seguira encajando.
 */
import * as THREE from "../vendor/three.module.min.js";

/* ─── Materiales compartidos ───
   Una sola instancia por material: cada material distinto es un cambio de
   estado mas para la GPU, y aqui hay cientos de piezas. */
export const MAT = {
  madera: new THREE.MeshStandardMaterial({ color: 0xc39a6b, roughness: 0.72 }),
  maderaOscura: new THREE.MeshStandardMaterial({ color: 0x8a6844, roughness: 0.75 }),
  tapizado: new THREE.MeshStandardMaterial({ color: 0x4a545f, roughness: 0.92 }),
  tapizadoClaro: new THREE.MeshStandardMaterial({ color: 0x8d9299, roughness: 0.92 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x3b4046, roughness: 0.35, metalness: 0.75 }),
  pantalla: new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.25 }),
  tabique: new THREE.MeshStandardMaterial({ color: 0xe8e5e0, roughness: 0.85 }),
  ceramica: new THREE.MeshStandardMaterial({ color: 0xf2f0ec, roughness: 0.3 }),
  planta: new THREE.MeshStandardMaterial({ color: 0x4f7d5a, roughness: 0.9 }),
  // El cristal de las mamparas: sin el, una oficina privada no se distingue
  // de un escritorio suelto
  cristal: new THREE.MeshStandardMaterial({
    color: 0xbcd4dd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
  }),
};

/* ─── Primitivas ─── */

const CACHE = new Map();

/** Caja con las esquinas redondeadas; las aristas vivas delatan el render */
function geoRedondeada(w, h, d, r = 0.02) {
  const clave = `r${w}|${h}|${d}|${r}`;
  if (CACHE.has(clave)) return CACHE.get(clave);

  const radio = Math.min(r, w / 2 - 0.001, d / 2 - 0.001);
  const forma = new THREE.Shape();
  const x = w / 2 - radio;
  const z = d / 2 - radio;

  forma.absarc(-x, -z, radio, Math.PI, Math.PI * 1.5);
  forma.absarc(x, -z, radio, Math.PI * 1.5, 0);
  forma.absarc(x, z, radio, 0, Math.PI * 0.5);
  forma.absarc(-x, z, radio, Math.PI * 0.5, Math.PI);

  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: h,
    bevelEnabled: true,
    bevelThickness: Math.min(0.012, h / 3),
    bevelSize: Math.min(0.012, radio / 2),
    bevelSegments: 2,
    curveSegments: 4,
  });
  // ExtrudeGeometry crece en +Z; se tumba para que crezca en altura
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0);

  CACHE.set(clave, geo);
  return geo;
}

function geoCilindro(radio, alto, lados = 10) {
  const clave = `c${radio}|${alto}|${lados}`;
  if (!CACHE.has(clave)) CACHE.set(clave, new THREE.CylinderGeometry(radio, radio, alto, lados));
  return CACHE.get(clave);
}

/** Pieza rectangular apoyada en `base`, centrada en (x, z) */
function bloque(w, alto, d, material, { x = 0, y = 0, z = 0, r = 0.02 } = {}) {
  const m = new THREE.Mesh(geoRedondeada(w, alto, d, r), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function poste(radio, alto, material, x, y, z) {
  const m = new THREE.Mesh(geoCilindro(radio, alto), material);
  m.position.set(x, y + alto / 2, z);
  m.castShadow = true;
  return m;
}

/** Cuatro patas en las esquinas de una huella de w x d */
function patas(g, w, d, alto, material, grosor = 0.022, margen = 0.05) {
  const px = w / 2 - margen;
  const pz = d / 2 - margen;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) g.add(poste(grosor, alto, material, sx * px, 0, sz * pz));
}

/* ─── Muebles ─── */

/** Silla con asiento, respaldo inclinado y cuatro patas. Mira al norte. */
export function silla(ancho = 0.46, fondo = 0.46, tapiceria = MAT.tapizado) {
  const g = new THREE.Group();
  const altoAsiento = 0.44;

  patas(g, ancho, fondo, altoAsiento, MAT.metal, 0.018, 0.045);
  g.add(bloque(ancho, 0.07, fondo, tapiceria, { y: altoAsiento, r: 0.04 }));

  // El respaldo va detras (sur, +Z) porque el usuario mira al norte
  const respaldo = bloque(ancho, 0.42, 0.06, tapiceria, {
    y: altoAsiento + 0.07,
    z: fondo / 2 - 0.03,
    r: 0.04,
  });
  respaldo.rotation.x = -0.12; // ligera inclinacion: una silla recta parece un cajon
  g.add(respaldo);

  return g;
}

/** Escritorio con tablero, patas y monitor */
export function escritorio(ancho, fondo) {
  const g = new THREE.Group();
  const alto = 0.74;

  patas(g, ancho, fondo, alto, MAT.metal, 0.022, 0.06);
  g.add(bloque(ancho, 0.04, fondo, MAT.madera, { y: alto, r: 0.015 }));

  // Monitor: pie, brazo y panel
  g.add(bloque(0.2, 0.015, 0.14, MAT.metal, { y: alto + 0.04, z: -fondo / 2 + 0.12 }));
  g.add(poste(0.018, 0.16, MAT.metal, 0, alto + 0.05, -fondo / 2 + 0.12));
  const panel = bloque(0.5, 0.3, 0.02, MAT.pantalla, {
    y: alto + 0.2,
    z: -fondo / 2 + 0.12,
    r: 0.01,
  });
  panel.rotation.x = 0.08;
  g.add(panel);

  return g;
}

/** Butaca de lounge: cojines, brazos y respaldo */
export function butaca(ancho = 0.9, fondo = 0.9) {
  const g = new THREE.Group();
  const base = 0.16;

  g.add(bloque(ancho, base, fondo, MAT.tapizadoClaro, { y: 0.08, r: 0.05 }));
  g.add(bloque(ancho - 0.22, 0.14, fondo - 0.18, MAT.tapizado, { y: base + 0.08, z: 0.03, r: 0.06 }));
  g.add(bloque(ancho, 0.46, 0.16, MAT.tapizado, { y: base + 0.08, z: fondo / 2 - 0.08, r: 0.07 }));

  for (const s of [-1, 1])
    g.add(bloque(0.12, 0.26, fondo - 0.1, MAT.tapizadoClaro, {
      x: s * (ancho / 2 - 0.06), y: base + 0.08, z: 0.02, r: 0.05,
    }));

  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      g.add(poste(0.02, 0.08, MAT.maderaOscura, sx * (ancho / 2 - 0.1), 0, sz * (fondo / 2 - 0.1)));

  return g;
}

/** Mesa alargada sobre dos pies, para juntas y cafeteria */
export function mesa(largo, fondo, alto = 0.74, material = MAT.madera) {
  const g = new THREE.Group();
  g.add(bloque(largo, 0.05, fondo, material, { y: alto, r: 0.03 }));

  for (const s of [-1, 1]) {
    g.add(bloque(0.08, alto, fondo - 0.18, MAT.metal, { x: s * (largo / 2 - 0.28), y: 0, r: 0.02 }));
    g.add(bloque(0.5, 0.03, fondo - 0.12, MAT.metal, { x: s * (largo / 2 - 0.28), y: 0, r: 0.02 }));
  }
  return g;
}

/** Mampara de oficina: zocalo opaco y cristal hasta arriba */
export function mampara(largo, alto = 2.1) {
  const g = new THREE.Group();
  const zocalo = 0.35;

  g.add(bloque(largo, zocalo, 0.07, MAT.tabique, { y: 0, r: 0.01 }));
  g.add(bloque(largo, alto - zocalo - 0.06, 0.03, MAT.cristal, { y: zocalo, r: 0.005 }));
  g.add(bloque(largo, 0.06, 0.08, MAT.tabique, { y: alto - 0.06, r: 0.01 }));

  for (const s of [-1, 1])
    g.add(bloque(0.06, alto, 0.08, MAT.tabique, { x: s * (largo / 2 - 0.03), y: 0, r: 0.01 }));

  return g;
}

/** Monitor grande de pared, para juntas y auditorio */
export function pantallaMural(ancho, alto = 0.62) {
  const g = new THREE.Group();
  g.add(bloque(ancho, alto, 0.05, MAT.pantalla, { y: 1.1, r: 0.02 }));
  g.add(bloque(ancho * 0.85, 0.04, 0.03, MAT.metal, { y: 1.06 }));
  return g;
}

/** Maquina alta: vending, nevera o armario */
export function armario(ancho, fondo, alto, material = MAT.pantalla) {
  const g = new THREE.Group();
  g.add(bloque(ancho, alto, fondo, material, { y: 0, r: 0.03 }));
  g.add(bloque(ancho * 0.7, alto * 0.45, 0.02, MAT.cristal, {
    y: alto * 0.45, z: -fondo / 2 + 0.01, r: 0.01,
  }));
  return g;
}

/** Mostrador o barra: cuerpo mas encimera volada */
export function mostrador(largo, fondo, alto = 1.05) {
  const g = new THREE.Group();
  g.add(bloque(largo, alto - 0.05, fondo, MAT.maderaOscura, { y: 0, r: 0.02 }));
  g.add(bloque(largo + 0.06, 0.05, fondo + 0.06, MAT.madera, { y: alto - 0.05, r: 0.02 }));
  return g;
}

/** Taburete de barra */
export function taburete() {
  const g = new THREE.Group();
  g.add(poste(0.03, 0.68, MAT.metal, 0, 0, 0));
  g.add(poste(0.17, 0.03, MAT.metal, 0, 0.005, 0));
  g.add(bloque(0.34, 0.07, 0.34, MAT.tapizado, { y: 0.68, r: 0.06 }));
  return g;
}

/** Planta de interior: maceta y masa de hojas */
export function maceta() {
  const g = new THREE.Group();
  g.add(bloque(0.3, 0.32, 0.3, MAT.maderaOscura, { y: 0, r: 0.05 }));
  const hojas = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), MAT.planta);
  hojas.position.y = 0.6;
  hojas.scale.set(1, 1.25, 1);
  hojas.castShadow = true;
  g.add(hojas);
  return g;
}

/** Cabina de aseo con puerta insinuada */
export function cabina(ancho, fondo, alto = 2) {
  const g = new THREE.Group();
  for (const s of [-1, 1])
    g.add(bloque(0.05, alto, fondo, MAT.tabique, { x: s * (ancho / 2), y: 0, r: 0.01 }));
  g.add(bloque(ancho, alto, 0.05, MAT.tabique, { z: fondo / 2, y: 0, r: 0.01 }));
  g.add(bloque(ancho - 0.12, alto - 0.3, 0.03, MAT.tabique, { z: -fondo / 2, y: 0.15, r: 0.01 }));
  return g;
}

/** Fila de lavabos sobre encimera */
export function lavabos(largo, fondo) {
  const g = new THREE.Group();
  g.add(bloque(largo, 0.08, fondo, MAT.ceramica, { y: 0.82, r: 0.02 }));
  g.add(bloque(largo - 0.1, 0.7, fondo - 0.08, MAT.tabique, { y: 0.12, r: 0.01 }));

  const cuantos = Math.max(1, Math.floor(largo / 0.7));
  for (let i = 0; i < cuantos; i++) {
    const x = -largo / 2 + largo / (cuantos * 2) + (i * largo) / cuantos;
    g.add(poste(0.02, 0.22, MAT.metal, x, 0.9, fondo / 2 - 0.12));
  }
  return g;
}

/** Tarima de auditorio */
export function tarima(ancho, fondo, alto = 0.2) {
  return bloque(ancho, alto, fondo, MAT.maderaOscura, { y: 0, r: 0.01 });
}

/**
 * Funde un grupo de mallas en una por material.
 *
 * Modelar una silla con seis mallas se lee muy bien en el codigo y muy mal
 * en la GPU: setenta y tres sillas son cuatrocientas llamadas de dibujo, y
 * un movil no las aguanta. Fundidas, una unidad entera cuesta tres o
 * cuatro. Se pierde la identidad de cada pieza suelta, que no hace falta:
 * lo seleccionable es la unidad, no su silla.
 *
 * Se hace a mano porque mergeGeometries vive en los ejemplos de three, que
 * no se pueden importar sin mapa de importaciones.
 */
export function fundirGrupo(raiz) {
  raiz.updateMatrixWorld(true);

  const porMaterial = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh) return;
    // clone/toNonIndexed protegen la geometria compartida de la cache
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!porMaterial.has(o.material)) porMaterial.set(o.material, []);
    porMaterial.get(o.material).push(g);
  });

  const salida = new THREE.Group();

  for (const [material, geos] of porMaterial) {
    const vertices = geos.reduce((n, g) => n + g.getAttribute("position").count, 0);
    const posiciones = new Float32Array(vertices * 3);
    const normales = new Float32Array(vertices * 3);

    let desplazamiento = 0;
    for (const g of geos) {
      const p = g.getAttribute("position");
      posiciones.set(p.array, desplazamiento * 3);
      normales.set(g.getAttribute("normal").array, desplazamiento * 3);
      desplazamiento += p.count;
      g.dispose();
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normales, 3));

    const malla = new THREE.Mesh(geo, material);
    malla.castShadow = true;
    malla.receiveShadow = true;
    salida.add(malla);
  }

  return salida;
}

/** Orientacion en radianes a partir del punto cardinal del modelo */
export const GIRO_CARDINAL = {
  norte: 0,
  sur: Math.PI,
  este: -Math.PI / 2,
  oeste: Math.PI / 2,
};
