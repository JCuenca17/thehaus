/**
 * Proyeccion isometrica de la planta.
 *
 * No define geometria propia: toma los mismos rectangulos de planta.js y
 * los proyecta. Cambiar de vista plana a isometrica no toca el modelo.
 *
 * Convencion: +x va a la derecha y abajo, +y a la izquierda y abajo, y la
 * elevacion z sube en pantalla. Las dos caras laterales visibles son
 * siempre la de x maximo y la de y maxima.
 */

const RAD = Math.PI / 180;

/** Altura de extrusion por tipo de elemento, en cm */
export const ALTURAS = {
  zona: 0,
  servicio: 18,
  puesto: 46,
  espacio: 78,
};

export function crearProyeccion({ angulo = 30 } = {}) {
  const cos = Math.cos(angulo * RAD);
  const sen = Math.sin(angulo * RAD);

  /** Punto del plano (cm) → punto de pantalla */
  const punto = (x, y, z = 0) => [(x - y) * cos, (x + y) * sen - z];

  const cadena = (puntos) => puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  /** Poligono plano a ras de suelo (para zonas y suelos) */
  const suelo = ({ x, y, w, h }, z = 0) =>
    cadena([
      punto(x, y, z),
      punto(x + w, y, z),
      punto(x + w, y + h, z),
      punto(x, y + h, z),
    ]);

  /**
   * Prisma extruido: cara superior mas las dos caras laterales visibles.
   * Se devuelven por separado para poder sombrearlas distinto.
   */
  const prisma = ({ x, y, w, h }, altura) => ({
    superior: cadena([
      punto(x, y, altura),
      punto(x + w, y, altura),
      punto(x + w, y + h, altura),
      punto(x, y + h, altura),
    ]),
    // Cara en x maximo
    derecha: cadena([
      punto(x + w, y, altura),
      punto(x + w, y + h, altura),
      punto(x + w, y + h, 0),
      punto(x + w, y, 0),
    ]),
    // Cara en y maximo
    izquierda: cadena([
      punto(x, y + h, altura),
      punto(x + w, y + h, altura),
      punto(x + w, y + h, 0),
      punto(x, y + h, 0),
    ]),
  });

  /** Centro proyectado, para colocar etiquetas */
  const centro = ({ x, y, w, h }, z = 0) => punto(x + w / 2, y + h / 2, z);

  /**
   * Marco que envuelve el local completo, ya con margen para la
   * extrusion mas alta. Sirve de viewBox.
   */
  const marco = ({ ancho, alto }, alturaMax = 0, margen = 60) => {
    const esquinas = [
      punto(0, 0),
      punto(ancho, 0),
      punto(ancho, alto),
      punto(0, alto),
    ];
    const xs = esquinas.map((p) => p[0]);
    const ys = esquinas.map((p) => p[1]);

    const minX = Math.min(...xs) - margen;
    const minY = Math.min(...ys) - alturaMax - margen;
    const maxX = Math.max(...xs) + margen;
    const maxY = Math.max(...ys) + margen;

    return {
      viewBox: `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`,
      ancho: maxX - minX,
      alto: maxY - minY,
    };
  };

  return { punto, suelo, prisma, centro, marco };
}

/**
 * Orden del pintor: lo que esta mas lejos del observador se dibuja antes.
 * En esta proyeccion la profundidad crece con x + y.
 */
export const porProfundidad = (a, b) => {
  const clave = ({ rect }) => rect.x + rect.w / 2 + (rect.y + rect.h / 2);
  return clave(a) - clave(b);
};
