/**
 * Geometria de la planta de The Haus.
 *
 * Todo el mapa se genera a partir de este modulo: el SVG no existe como
 * archivo dibujado. Cuando llegue el plano real del local solo hay que
 * sustituir coordenadas aqui, sin tocar el renderizado ni la interaccion.
 *
 * Unidades en centimetros. El local mide 22 x 14 m = 308 m2.
 *
 * ─── Como esta organizada ───
 *
 * El local se lee desde la puerta, que esta en el muro oeste. De ella
 * arranca un pasillo que recorre los 22 m de largo y del que cuelga todo
 * lo demas, ordenado por ruido y por quien entra:
 *
 *   - Junto a la puerta: recepcion (sur) y cafeteria (norte). Se atiende
 *     y se toma un cafe sin pisar la zona de trabajo.
 *   - Banda norte: lo social y lo que recibe visitas — cafeteria, sala de
 *     estar (pegada a la cafeteria a proposito) y auditorio.
 *   - Banda sur: el trabajo — puestos compartidos primero y, al fondo,
 *     lo que necesita silencio: sala de juntas y oficinas privadas.
 *   - Los aseos van detras de recepcion, sin fachada, que es espacio caro.
 *
 * Nadie tiene que cruzar una zona para llegar a otra: todas dan al pasillo.
 *
 * Cada zona reserva una banda superior de 80 cm para su titulo; las
 * unidades se colocan por debajo para que nada se solape.
 */

export const LOCAL = { ancho: 2200, alto: 1400 };

const BANDA = 80;

/** Puerta de entrada, en el muro oeste, a la altura del pasillo */
export const ACCESO = { x: 0, y: 580, w: 24, h: 160 };

/** Pasillo de reparto: de la puerta al fondo, sirve a todas las zonas */
export const CIRCULACION = [{ id: "pasillo", rect: { x: 0, y: 560, w: 2200, h: 160 } }];

/* Unidad reservable:
   - "puesto"  → se reserva plaza a plaza (escritorios, lounge)
   - "espacio" → se reserva la sala entera por franja horaria           */

export const ZONAS = [
  /* ─── Banda norte: social y visitas ─── */
  {
    id: "lounge",
    nombre: "Sala de estar",
    unidad: "puesto",
    rect: { x: 620, y: 0, w: 600, h: 560 },
  },
  {
    id: "auditorio",
    nombre: "Auditorio",
    unidad: "espacio",
    rect: { x: 1280, y: 0, w: 920, h: 560 },
  },

  /* ─── Banda sur: trabajo, de menos a mas silencio ─── */
  {
    id: "coworking",
    nombre: "Trabajo compartido",
    unidad: "puesto",
    rect: { x: 500, y: 720, w: 700, h: 680 },
  },
  {
    id: "juntas",
    nombre: "Sala de juntas",
    unidad: "espacio",
    rect: { x: 1260, y: 720, w: 940, h: 320 },
  },
  {
    id: "oficinas",
    nombre: "Oficinas privadas",
    unidad: "espacio",
    rect: { x: 1260, y: 1080, w: 940, h: 320 },
  },
];

/* Servicios: se dibujan pero no se reservan ni cambian de color.
   Recepcion y cafeteria flanquean la puerta; los aseos se esconden. */
export const SERVICIOS = [
  { id: "recepcion", nombre: "Recepción", rect: { x: 0, y: 720, w: 440, h: 320 } },
  { id: "cafeteria", nombre: "Cafetería", rect: { x: 0, y: 0, w: 560, h: 560 } },
  { id: "aseos", nombre: "Aseos", rect: { x: 0, y: 1080, w: 440, h: 320 } },
];

/* ─── Espacios reservables completos ─── */

/** Cuatro despachos en hilera, pensados para equipos de dos */
const OFICINAS = Array.from({ length: 4 }, (_, i) => ({
  id: `of-${i + 1}`,
  zona: "oficinas",
  nombre: `Oficina ${i + 1}`,
  capacidad: 2,
  rect: { x: 1280 + i * 231, y: 1080 + BANDA, w: 207, h: 220 },
}));

export const ESPACIOS = [
  ...OFICINAS,
  {
    id: "aud",
    zona: "auditorio",
    nombre: "30 plazas",
    capacidad: 30,
    rect: { x: 1300, y: BANDA + 20, w: 880, h: 440 },
  },
  {
    id: "juntas",
    zona: "juntas",
    nombre: "10 plazas",
    capacidad: 10,
    rect: { x: 1280, y: 720 + BANDA, w: 900, h: 240 },
  },
];

/* ─── Puestos individuales ─── */

const ESCRITORIO = { w: 120, h: 66 };
const ISLA = { w: 2 * ESCRITORIO.w + 8, h: 2 * ESCRITORIO.h + 6 };

/**
 * Seis islas de cuatro escritorios, en dos columnas por tres filas.
 * Cuatro por isla y no seis: con 700 cm de fondo, islas mayores dejarian
 * un pasillo central por el que no se pasa.
 */
function generarEscritorios() {
  const puestos = [];
  const origen = { x: 520, y: 800 };
  const paso = { x: ISLA.w + 164, y: ISLA.h + 83 };

  let n = 0;
  for (let isla = 0; isla < 6; isla++) {
    const baseX = origen.x + (isla % 2) * paso.x;
    const baseY = origen.y + Math.floor(isla / 2) * paso.y;

    for (let i = 0; i < 4; i++) {
      n++;
      puestos.push({
        id: `ws-${String(n).padStart(2, "0")}`,
        zona: "coworking",
        nombre: `Escritorio ${n}`,
        rect: {
          x: baseX + (i % 2) * (ESCRITORIO.w + 8),
          y: baseY + Math.floor(i / 2) * (ESCRITORIO.h + 6),
          w: ESCRITORIO.w,
          h: ESCRITORIO.h,
        },
      });
    }
  }
  return puestos;
}

/**
 * Butacas del lounge en dos hileras enfrentadas: las de arriba miran al
 * sur y las de abajo al norte, de modo que la sala conversa consigo misma
 * en vez de mirar todas a la pared.
 */
function generarLounge() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `lg-${i + 1}`,
    zona: "lounge",
    nombre: `Plaza lounge ${i + 1}`,
    mira: i < 4 ? "sur" : "norte",
    rect: {
      x: 640 + (i % 4) * 140,
      y: 120 + Math.floor(i / 4) * 220,
      w: 125,
      h: 160,
    },
  }));
}

export const PUESTOS = [...generarEscritorios(), ...generarLounge()];

/** Todo lo reservable, en una sola lista con su unidad de reserva */
export const RESERVABLES = [
  ...PUESTOS.map((p) => ({ ...p, unidad: "puesto" })),
  ...ESPACIOS.map((e) => ({ ...e, unidad: "espacio" })),
];

export const ESTADOS = ["libre", "reservado", "ocupado"];

/** Superficie en m2 de cualquier rectangulo del modelo */
export const areaM2 = ({ w, h }) => (w * h) / 10000;
