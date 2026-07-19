/**
 * Proyeccion isometrica de la planta.
 *
 * No define geometria propia: toma los mismos rectangulos de planta.js y
 * los proyecta. Cambiar de vista plana a isometrica no toca el modelo.
 *
 * El plano descansa en pasos de 90 grados pero la animacion recorre los
 * angulos intermedios. Se rota en coordenadas de planta, antes de
 * proyectar, no con un transform del SVG: girando el SVG entero girarian
 * tambien las etiquetas y las caras dejarian de corresponder con la
 * orientacion de la luz.
 *
 * Convencion: +x va a la derecha y abajo, +y a la izquierda y abajo, y la
 * elevacion z sube en pantalla. Las dos caras laterales visibles son
 * siempre la de x maximo y la de y maxima.
 */

const RAD = Math.PI / 180;

/** Altura de extrusion por tipo de elemento, en cm */
export const ALTURAS = {
  zona: 0,
  servicio: 8,
  puesto: 46,
  espacio: 78,
};

export const GIROS = 4;

export function crearProyeccion({ local, angulo = 30, giro = 0 } = {}) {
  const cos = Math.cos(angulo * RAD);
  const sen = Math.sin(angulo * RAD);

  const cx = local.ancho / 2;
  const cy = local.alto / 2;

  // `giro` se mide en cuartos de vuelta y admite decimales: en reposo vale
  // un entero, pero durante la animacion pasa por todos los valores
  // intermedios. De ahi que se rote con seno y coseno en vez de
  // intercambiando ejes.
  const anguloGiro = giro * (Math.PI / 2);
  const cosG = Math.cos(anguloGiro);
  const senG = Math.sin(anguloGiro);

  /** Rota un punto de planta alrededor del centro del local */
  const rotar = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cosG - dy * senG, cy + dx * senG + dy * cosG];
  };

  /** Punto del plano (cm) → punto de pantalla */
  const punto = (x, y, z = 0) => {
    const [rx, ry] = rotar(x, y);
    return [(rx - ry) * cos, (rx + ry) * sen - z];
  };

  const cadena = (puntos) => puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  /**
   * Las cuatro esquinas de un rectangulo. Se rotan una a una y se conserva
   * el orden, asi que la figura sigue cerrando bien en cualquier angulo,
   * tambien en los intermedios del giro.
   */
  const esquinas = ({ x, y, w, h }, z) => [
    punto(x, y, z),
    punto(x + w, y, z),
    punto(x + w, y + h, z),
    punto(x, y + h, z),
  ];

  const suelo = (rect, z = 0) => cadena(esquinas(rect, z));

  /**
   * Prisma extruido: cara superior mas las dos caras laterales que dan al
   * observador. Cuales son esas dos depende del giro, asi que se eligen
   * comparando profundidad en vez de asumir siempre x+w e y+h.
   */
  const prisma = (rect, altura) => {
    const arriba = esquinas(rect, altura);
    const abajo = esquinas(rect, 0);

    // De los cuatro lados del rectangulo, los dos visibles son aquellos
    // cuyo punto medio queda mas abajo en pantalla que el centro
    const centroY = arriba.reduce((a, p) => a + p[1], 0) / 4;
    const caras = [];

    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const medioY = (arriba[i][1] + arriba[j][1]) / 2;
      if (medioY <= centroY) continue;
      caras.push(cadena([arriba[i], arriba[j], abajo[j], abajo[i]]));
    }

    return { superior: cadena(arriba), laterales: caras };
  };

  /** Centro proyectado, para colocar etiquetas */
  const centro = ({ x, y, w, h }, z = 0) => punto(x + w / 2, y + h / 2, z);

  /**
   * Orden del pintor: lo mas lejano se dibuja antes. Tras rotar, la
   * profundidad sigue creciendo con x + y en coordenadas ya giradas.
   */
  const profundidad = ({ rect }) => {
    const [rx, ry] = rotar(rect.x + rect.w / 2, rect.y + rect.h / 2);
    return rx + ry;
  };

  const porProfundidad = (a, b) => profundidad(a) - profundidad(b);

  /** Marco que envuelve el local ya girado, con sitio para la extrusion */
  const marco = (alturaMax = 0, margen = 60) => {
    const puntos = [
      punto(0, 0),
      punto(local.ancho, 0),
      punto(local.ancho, local.alto),
      punto(0, local.alto),
    ];
    const xs = puntos.map((p) => p[0]);
    const ys = puntos.map((p) => p[1]);

    const minX = Math.min(...xs) - margen;
    const minY = Math.min(...ys) - alturaMax - margen;
    const maxX = Math.max(...xs) + margen;
    const maxY = Math.max(...ys) + margen;

    return {
      viewBox: `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`,
    };
  };

  return { punto, suelo, prisma, centro, marco, porProfundidad };
}
