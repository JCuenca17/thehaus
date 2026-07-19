/**
 * Mobiliario de cada unidad y de cada servicio.
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
  mostrador: 96,
  barra: 98,
  vending: 148,
  taburete: 68,
  cabina: 118,
  lavabo: 85,
};

const caja = (x, y, w, h, alto, material) => ({
  rect: { x, y, w, h },
  alto,
  material,
});

const GROSOR_RESPALDO = 9;

/**
 * Silla con orientacion. `mira` indica hacia donde se sienta el usuario,
 * asi que el respaldo va siempre en el lado contrario.
 * @param {"norte"|"sur"|"este"|"oeste"} mira
 */
function silla(x, y, ancho, fondo, mira = "sur") {
  const asiento = caja(x, y, ancho, fondo, A.asiento, "tapizado");

  const respaldos = {
    sur: caja(x, y, ancho, GROSOR_RESPALDO, A.respaldo, "tapizado"),
    norte: caja(x, y + fondo - GROSOR_RESPALDO, ancho, GROSOR_RESPALDO, A.respaldo, "tapizado"),
    este: caja(x, y, GROSOR_RESPALDO, fondo, A.respaldo, "tapizado"),
    oeste: caja(x + ancho - GROSOR_RESPALDO, y, GROSOR_RESPALDO, fondo, A.respaldo, "tapizado"),
  };

  return [asiento, respaldos[mira]];
}

/* ─── Escritorio de coworking (140 x 140) ─── */
function escritorio({ x, y, w, h }, unidad = {}) {
  // En un bench los tableros se juntan en el centro de la isla y las sillas
  // quedan fuera, asi que el puesto se dibuja segun hacia donde mira
  const alSur = (unidad.mira ?? "norte") === "sur";
  const mesaY = alSur ? y + h - 76 : y + 6;
  const sillaY = alSur ? y + 16 : y + h - 52;

  // El mueble se mete hacia dentro a proposito: el borde de plataforma que
  // queda libre es lo que deja ver el color de estado desde lejos.
  return [
    caja(x + 10, mesaY, w - 20, 70, A.mesa, "madera"),
    caja(x + w / 2 - 26, mesaY + (alSur ? 54 : 8), 52, 6, A.mesa + 34, "pantalla"),
    ...silla(x + w / 2 - 24, sillaY, 48, 36, alSur ? "sur" : "norte"),
  ];
}

/* ─── Butaca de lounge (125 x 160) ─── */
function butaca({ x, y, w, h }, unidad = {}) {
  // El asiento se pega al lado contrario al que mira, para que el respaldo
  // quede detras y la mesita caiga siempre al alcance de la mano
  const alSur = (unidad.mira ?? "sur") === "sur";
  const fondo = h - 58;
  const asientoY = alSur ? y + 8 : y + h - 8 - fondo;

  return [
    caja(x + 8, asientoY, w - 16, fondo, A.sofa, "tapizado"),
    caja(x + 8, alSur ? asientoY : asientoY + fondo - 14, w - 16, 14, A.sofa + 26, "tapizado"),
    caja(x + w / 2 - 26, alSur ? y + h - 44 : y + 10, 52, 34, A.mesita, "madera"),
  ];
}

/* ─── Oficina privada (207 x 220): despacho para dos ─── */
function oficina({ x, y, w, h }) {
  const piezas = [
    // Tabiques bajos: dejan ver el interior, que es lo que interesa
    caja(x, y, w, 10, A.tabique, "tabique"),
    caja(x, y, 10, h, A.tabique, "tabique"),
    caja(x + w - 10, y, 10, h, A.tabique, "tabique"),
    // Mesa corrida contra el fondo, con dos monitores
    caja(x + 18, y + 34, w - 36, 54, A.mesa, "madera"),
    caja(x + w / 2 - 46, y + 40, 26, 4, A.mesa + 28, "pantalla"),
    caja(x + w / 2 + 20, y + 40, 26, 4, A.mesa + 28, "pantalla"),
  ];

  // Las dos sillas quedan al sur de la mesa, asi que se sientan mirando al norte
  for (const dx of [-56, 12]) {
    piezas.push(...silla(x + w / 2 + dx, y + 104, 44, 34, "norte"));
  }
  return piezas;
}

/* ─── Sala de juntas: mesa larga con sillas enfrentadas ─── */
function salaJuntas({ x, y, w, h }) {
  const piezas = [
    caja(x, y, w, 10, A.tabique, "tabique"),
    caja(x + w / 2 - 190, y + h / 2 - 42, 380, 84, A.mesa, "madera"),
    caja(x + w - 70, y + h / 2 - 44, 12, 88, A.pantalla, "pantalla"),
  ];

  for (let i = 0; i < 5; i++) {
    const cx = x + w / 2 - 170 + i * 75;
    piezas.push(...silla(cx, y + h / 2 - 84, 40, 34, "sur"));
    piezas.push(...silla(cx, y + h / 2 + 50, 40, 34, "norte"));
  }
  return piezas;
}

/* ─── Auditorio: tarima, pantalla y cinco filas de seis butacas ─── */
function auditorio({ x, y, w, h }) {
  const piezas = [
    caja(x + w - 130, y + 10, 120, h - 20, A.tarima, "madera"),
    caja(x + w - 34, y + h / 2 - 90, 14, 180, A.pantalla, "pantalla"),
  ];

  const origenX = x + 40;
  const origenY = y + h / 2 - (5 * 52) / 2 - 18;

  for (let f = 0; f < 5; f++) {
    for (let b = 0; b < 6; b++) {
      // La pantalla esta al este: todo el patio de butacas mira alli
      piezas.push(...silla(origenX + f * 118, origenY + b * 52, 46, 36, "este"));
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
 * Plataforma de estado mas muebles de una unidad reservable.
 * @returns {{plataforma: {rect, alto}, piezas: Array}}
 */
export function amueblar(unidad) {
  const generador = POR_ZONA[unidad.zona];
  return {
    plataforma: { rect: unidad.rect, alto: A.plataforma },
    // Se pasa la unidad entera y no solo su rectangulo: hay muebles que
    // necesitan saber hacia donde se orientan
    piezas: generador ? generador(unidad.rect, unidad) : [],
  };
}

/* ================================================================
   SERVICIOS
   No se reservan, pero sin ellos el plano no se lee como un local.
================================================================ */

/* ─── Recepción: mostrador en L y puesto de atención ─── */
function recepcion({ x, y, w, h }) {
  return [
    caja(x + 20, y + 30, w - 120, 34, A.mostrador, "madera"),
    caja(x + w - 110, y + 30, 34, h - 70, A.mostrador, "madera"),
    ...silla(x + 60, y + 80, 34, 34, "sur"),
    caja(x + w - 60, y + h - 55, 40, 40, A.mesita, "planta"),
  ];
}

/* ─── Cafetería: barra, máquinas de vending y taburetes ─── */
function cafeteria({ x, y, w, h }) {
  const piezas = [
    caja(x + 16, y + 24, w - 180, 40, A.barra, "madera"),
    // Cafetera sobre la barra
    caja(x + 40, y + 30, 34, 28, A.barra + 34, "pantalla"),
    // Dos máquinas de vending al fondo, como en la referencia
    caja(x + w - 150, y + 18, 62, 46, A.vending, "pantalla"),
    caja(x + w - 80, y + 18, 62, 46, A.vending, "pantalla"),
  ];

  // Taburetes pegados a la barra, no en el extremo opuesto de la sala
  for (let i = 0; i < 4; i++) {
    piezas.push(caja(x + 40 + i * 72, y + 78, 36, 36, A.taburete, "tapizado"));
  }

  // Dos mesas para quedarse: sin ellas esto es un office, no una cafeteria
  for (const my of [y + 200, y + 400]) {
    piezas.push(caja(x + 70, my, 150, 90, A.mesa, "madera"));
    for (const dx of [20, 88]) {
      piezas.push(...silla(x + 70 + dx, my - 46, 44, 38, "sur"));
      piezas.push(...silla(x + 70 + dx, my + 98, 44, 38, "norte"));
    }
  }
  return piezas;
}

/* ─── Aseos: tres cabinas y una fila de lavabos ─── */
function aseos({ x, y, w, h }) {
  const piezas = [caja(x + 14, y + h - 46, w - 28, 30, A.lavabo, "tabique")];

  for (let i = 0; i < 3; i++) {
    piezas.push(caja(x + 16 + i * ((w - 32) / 3), y + 16, (w - 44) / 3, 62, A.cabina, "tabique"));
  }
  return piezas;
}

const POR_SERVICIO = { recepcion, cafeteria, aseos };

/** Muebles de un servicio; no lleva plataforma de estado */
export function amueblarServicio(servicio) {
  const generador = POR_SERVICIO[servicio.id];
  return generador ? generador(servicio.rect) : [];
}

export const ALTURA_PLATAFORMA = A.plataforma;
