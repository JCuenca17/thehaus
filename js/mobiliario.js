/**
 * Mobiliario de cada unidad reservable.
 *
 * Separa dos cosas que no deben mezclarse: la plataforma del suelo, que
 * es la que lleva el color de estado, y los muebles que van encima, que
 * son siempre del mismo material. Asi el estado se lee sin que las mesas
 * y las sillas cambien de color como semaforos.
 *
 * Cada pieza es {rect, alto, material}; el renderizador solo sabe
 * extruir cajas, no conoce el significado de ninguna.
 */

/** Alturas en cm */
const A = {
  plataforma: 6,
  mesa: 42,
  asiento: 30,
  respaldo: 58,
  sofa: 38,
  mesita: 32,
  tarima: 20,
  pantalla: 105,
  tabique: 34,
};

const caja = (x, y, w, h, alto, material) => ({
  rect: { x, y, w, h },
  alto,
  material,
});

/** Silla mirando hacia +y (de frente al observador) */
function silla(x, y, ancho = 38, fondo = 38) {
  return [
    caja(x, y, ancho, fondo, A.asiento, "tapizado"),
    caja(x, y, ancho, 9, A.respaldo, "tapizado"),
  ];
}

/* ─── Escritorio de coworking (130 x 70) ─── */
function escritorio({ x, y, w, h }) {
  // El mueble se mete hacia dentro a proposito: el borde de plataforma que
  // queda libre es lo que deja ver el color de estado desde lejos.
  return [
    caja(x + 12, y + 10, w - 24, 30, A.mesa, "madera"),
    caja(x + w / 2 - 14, y + 13, 28, 4, A.mesa + 30, "pantalla"),
    ...silla(x + w / 2 - 16, y + h - 24, 32, 16),
  ];
}

/* ─── Butaca de lounge (180 x 130) ─── */
function butaca({ x, y, w, h }) {
  return [
    caja(x + 4, y + 4, w - 60, h - 8, A.sofa, "tapizado"),
    caja(x + 4, y + 4, w - 60, 12, A.sofa + 26, "tapizado"),
    caja(x + w - 48, y + h / 2 - 22, 42, 44, A.mesita, "madera"),
  ];
}

/* ─── Oficina privada: tabiques bajos, mesa y cuatro sillas ─── */
function oficina({ x, y, w, h }) {
  const piezas = [
    // Tabiques bajos: dejan ver el interior, que es lo que interesa
    caja(x, y, w, 10, A.tabique, "tabique"),
    caja(x, y, 10, h, A.tabique, "tabique"),
    caja(x + w - 10, y, 10, h, A.tabique, "tabique"),
    // Mesa central
    caja(x + w / 2 - 62, y + h / 2 - 45, 124, 90, A.mesa, "madera"),
  ];

  // Dos sillas arriba y dos abajo
  for (const dx of [-42, 10]) {
    piezas.push(...silla(x + w / 2 + dx, y + h / 2 - 82, 34, 32));
    piezas.push(...silla(x + w / 2 + dx, y + h / 2 + 50, 34, 32));
  }
  return piezas;
}

/* ─── Sala de juntas: mesa larga con sillas a ambos lados ─── */
function salaJuntas({ x, y, w, h }) {
  const piezas = [
    caja(x, y, w, 10, A.tabique, "tabique"),
    caja(x + w / 2 - 190, y + h / 2 - 42, 380, 84, A.mesa, "madera"),
    caja(x + w - 70, y + h / 2 - 44, 12, 88, A.pantalla, "pantalla"),
  ];

  for (let i = 0; i < 5; i++) {
    const cx = x + w / 2 - 170 + i * 75;
    piezas.push(...silla(cx, y + h / 2 - 84, 40, 34));
    piezas.push(...silla(cx, y + h / 2 + 50, 40, 34));
  }
  return piezas;
}

/* ─── Auditorio: tarima, pantalla y cinco filas de seis butacas ─── */
function auditorio({ x, y, w, h }) {
  const piezas = [
    caja(x + w - 130, y + 10, 120, h - 20, A.tarima, "madera"),
    caja(x + w - 34, y + h / 2 - 90, 14, 180, A.pantalla, "pantalla"),
  ];

  const filas = 5;
  const porFila = 6;
  const pasoX = 118;
  const pasoY = 52;
  const origenX = x + 40;
  const origenY = y + h / 2 - ((porFila - 1) * pasoY) / 2 - 18;

  for (let f = 0; f < filas; f++) {
    for (let b = 0; b < porFila; b++) {
      piezas.push(...silla(origenX + f * pasoX, origenY + b * pasoY, 46, 36));
    }
  }
  return piezas;
}

const POR_ZONA = {
  coworking: escritorio,
  lounge: butaca,
  oficinas: oficina,
  juntas: salaJuntas,
  auditorio: auditorio,
};

/**
 * Plataforma de estado mas muebles de una unidad.
 * @returns {{plataforma: {rect, alto}, piezas: Array}}
 */
export function amueblar(unidad) {
  const generador = POR_ZONA[unidad.zona];
  return {
    plataforma: { rect: unidad.rect, alto: A.plataforma },
    piezas: generador ? generador(unidad.rect) : [],
  };
}

export const ALTURA_PLATAFORMA = A.plataforma;
