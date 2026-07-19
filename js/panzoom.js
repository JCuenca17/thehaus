/**
 * Desplazamiento y zoom del plano.
 *
 * Actua sobre una capa intermedia con transform, no sobre el viewBox del
 * SVG: asi el navegador compone en GPU y no rehace el layout en cada
 * fotograma. Con mas de mil poligonos la diferencia se nota.
 *
 * Distingue el arrastre del toque: si el puntero apenas se movio, el
 * evento sigue su curso y la unidad se puede seleccionar.
 */

const UMBRAL_TOQUE = 6; // px de movimiento por debajo de los cuales es un tap

export function crearPanZoom(contenedor, capa, opciones = {}) {
  const { min = 0.6, max = 4, inicial = 1 } = opciones;

  let escala = inicial;
  let x = 0;
  let y = 0;

  const punteros = new Map();
  let distanciaPrevia = null;
  let arrastrando = false;
  let movimiento = 0;

  const aplicar = () => {
    capa.style.transform = `translate(${x}px, ${y}px) scale(${escala})`;
  };

  const limitar = (v) => Math.min(max, Math.max(min, v));

  /** Zoom manteniendo fijo el punto bajo el cursor */
  const zoomEn = (factor, cx, cy) => {
    const caja = contenedor.getBoundingClientRect();
    const px = cx - caja.left;
    const py = cy - caja.top;

    const nueva = limitar(escala * factor);
    const real = nueva / escala;

    x = px - (px - x) * real;
    y = py - (py - y) * real;
    escala = nueva;
    aplicar();
  };

  contenedor.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomEn(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
    },
    { passive: false },
  );

  contenedor.addEventListener("pointerdown", (e) => {
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (punteros.size === 1) {
      arrastrando = true;
      movimiento = 0;
      contenedor.setPointerCapture(e.pointerId);
    }
  });

  contenedor.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    const previo = punteros.get(e.pointerId);
    punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (punteros.size === 2) {
      // Pellizco: el zoom lo marca la variacion de distancia entre dedos
      const [a, b] = [...punteros.values()];
      const distancia = Math.hypot(a.x - b.x, a.y - b.y);
      if (distanciaPrevia) {
        zoomEn(distancia / distanciaPrevia, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      distanciaPrevia = distancia;
      return;
    }

    if (!arrastrando) return;
    const dx = e.clientX - previo.x;
    const dy = e.clientY - previo.y;
    movimiento += Math.abs(dx) + Math.abs(dy);
    x += dx;
    y += dy;
    aplicar();
  });

  const soltar = (e) => {
    punteros.delete(e.pointerId);
    if (punteros.size < 2) distanciaPrevia = null;
    if (punteros.size === 0) arrastrando = false;
  };

  contenedor.addEventListener("pointerup", soltar);
  contenedor.addEventListener("pointercancel", soltar);

  aplicar();

  return {
    /** Si el puntero se desplazo, el gesto fue arrastre y no seleccion */
    fueArrastre: () => movimiento > UMBRAL_TOQUE,
    acercar: () => zoomEn(1.3, ...centroDe(contenedor)),
    alejar: () => zoomEn(1 / 1.3, ...centroDe(contenedor)),
    reiniciar() {
      escala = inicial;
      x = 0;
      y = 0;
      capa.style.transition = "transform 0.35s cubic-bezier(0.16,1,0.3,1)";
      aplicar();
      setTimeout(() => (capa.style.transition = ""), 380);
    },
    get escala() {
      return escala;
    },
  };
}

function centroDe(el) {
  const c = el.getBoundingClientRect();
  return [c.left + c.width / 2, c.top + c.height / 2];
}
