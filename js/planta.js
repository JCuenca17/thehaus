/**
 * Geometria de la planta de The Haus.
 *
 * Todo el mapa se genera a partir de este modulo: el SVG no existe como
 * archivo dibujado. Cuando llegue el plano real del local solo hay que
 * sustituir coordenadas aqui, sin tocar el renderizado ni la interaccion.
 *
 * Unidades en centimetros. El local mide 22 x 14 m = 308 m2.
 *
 * Cada zona reserva una banda superior de 80 cm para su titulo; las
 * unidades se colocan por debajo para que nada se solape.
 */

export const LOCAL = { ancho: 2200, alto: 1400 };

const BANDA = 80;

/* Unidad reservable:
   - "puesto"  → se reserva plaza a plaza (escritorios, lounge)
   - "espacio" → se reserva la sala entera por franja horaria           */

export const ZONAS = [
  {
    id: "oficinas",
    nombre: "Oficinas privadas",
    unidad: "espacio",
    rect: { x: 0, y: 0, w: 1250, h: 470 },
  },
  {
    id: "auditorio",
    nombre: "Auditorio",
    unidad: "espacio",
    rect: { x: 1300, y: 0, w: 900, h: 470 },
  },
  {
    id: "coworking",
    nombre: "Trabajo compartido",
    unidad: "puesto",
    rect: { x: 0, y: 540, w: 1250, h: 740 },
  },
  {
    id: "juntas",
    nombre: "Sala de juntas",
    unidad: "espacio",
    rect: { x: 1300, y: 540, w: 900, h: 330 },
  },
  {
    id: "lounge",
    nombre: "Sala de estar",
    unidad: "puesto",
    rect: { x: 1300, y: 900, w: 900, h: 380 },
  },
];

/* Servicios: se dibujan pero no se reservan ni cambian de color */
export const SERVICIOS = [
  { id: "recepcion", nombre: "Recepción", rect: { x: 0, y: 1310, w: 500, h: 90 } },
  { id: "cocina", nombre: "Cocina", rect: { x: 520, y: 1310, w: 620, h: 90 } },
  { id: "aseos", nombre: "Aseos", rect: { x: 1160, y: 1310, w: 480, h: 90 } },
];

/* ─── Espacios reservables completos ─── */

const OFICINAS = [20, 325, 630, 935].map((x, i) => ({
  id: `of-${i + 1}`,
  zona: "oficinas",
  nombre: `Oficina ${i + 1}`,
  capacidad: 4,
  rect: { x, y: BANDA + 20, w: 285, h: 350 },
}));

export const ESPACIOS = [
  ...OFICINAS,
  {
    id: "aud",
    zona: "auditorio",
    nombre: "30 plazas",
    capacidad: 30,
    rect: { x: 1320, y: BANDA + 20, w: 860, h: 350 },
  },
  {
    id: "juntas",
    zona: "juntas",
    nombre: "10 plazas",
    capacidad: 10,
    rect: { x: 1320, y: 540 + BANDA + 10, w: 860, h: 220 },
  },
];

/* ─── Puestos individuales ─── */

const ESCRITORIO = { w: 130, h: 70 };
const ISLA = { w: 406, h: 146 };

/**
 * Seis islas de seis escritorios en la zona de coworking: dos filas
 * enfrentadas de tres, que es como se montan los bancos de hot desking.
 * Se reparten en dos columnas por tres filas, dejando pasillo central.
 */
function generarEscritorios() {
  const puestos = [];
  const origen = { x: 30, y: 650 };
  const paso = { x: ISLA.w + 126, y: ISLA.h + 43 };

  let n = 0;
  for (let isla = 0; isla < 6; isla++) {
    const baseX = origen.x + (isla % 2) * paso.x;
    const baseY = origen.y + Math.floor(isla / 2) * paso.y;

    for (let i = 0; i < 6; i++) {
      n++;
      puestos.push({
        id: `ws-${String(n).padStart(2, "0")}`,
        zona: "coworking",
        nombre: `Escritorio ${n}`,
        rect: {
          x: baseX + (i % 3) * (ESCRITORIO.w + 8),
          y: baseY + Math.floor(i / 3) * (ESCRITORIO.h + 6),
          w: ESCRITORIO.w,
          h: ESCRITORIO.h,
        },
      });
    }
  }
  return puestos;
}

/** Butacas sueltas del lounge, en dos hileras informales */
function generarLounge() {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `lg-${i + 1}`,
    zona: "lounge",
    nombre: `Plaza lounge ${i + 1}`,
    rect: {
      x: 1330 + (i % 4) * 215,
      y: 900 + BANDA + 10 + Math.floor(i / 4) * 150,
      w: 180,
      h: 130,
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
