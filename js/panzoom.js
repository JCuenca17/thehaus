/**
 * Desplazamiento y zoom del plano.
 *
 * El zoom se hace con los botones o con pellizco tactil, nunca con la
 * rueda ni con el trackpad.
 *
 * Actua sobre una capa intermedia con transform, no sobre el viewBox del
 * SVG: asi el navegador compone en GPU y no rehace el layout en cada
 * fotograma. Con mas de mil poligonos la diferencia se nota.
 *
 * Distingue el arrastre del toque: si el puntero apenas se movio, el
 * evento sigue su curso y la unidad se puede seleccionar.
 */

const UMBRAL_TOQUE = 6; // px de movimiento por debajo de los cuales es un tap

/* Elementos que gestionan su propio click. Sin esta excepcion, el
   setPointerCapture del contenedor se queda el puntero y el boton nunca
   llega a recibir su evento: los controles dejan de responder al raton. */
const esControl = (el) => !!el?.closest?.("button, a, input, select, label");

export function crearPanZoom(contenedor, capa, opciones = {}) {
  const { min = 0.6, max = 4, inicial = 1 } = opciones;

  let escala = inicial;
  let x = 0;
  let y = 0;

  const punteros = new Map();
  let distanciaPrevia = null;
  let arrastrando = false;
  let movimiento = 0;

  /* El plano no se puede arrastrar fuera de la vista: siempre queda al
     menos un margen visible por cada lado. Sin esto es facil perderlo y
     no saber como recuperarlo. */
  const contener = () => {
    const caja = contenedor.getBoundingClientRect();
    const margen = Math.min(caja.width, caja.height) * 0.4;
    const anchoEscalado = caja.width * escala;
    const altoEscalado = caja.height * escala;

    x = Math.min(caja.width - margen, Math.max(margen - anchoEscalado, x));
    y = Math.min(caja.height - margen, Math.max(margen - altoEscalado, y));
  };

  const aplicar = () => {
    contener();
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

  /* El zoom con rueda y trackpad esta quitado a proposito. Por muy fina
     que se afine la sensibilidad, un trackpad acaba disparando el zoom sin
     que nadie lo haya pedido mientras se recorre el plano. El zoom queda en
     los botones, que son deliberados, y en el pellizco tactil. Solo se
     frena el desplazamiento para que el gesto no arrastre la pagina. */
  contenedor.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });

  contenedor.addEventListener("pointerdown", (e) => {
    if (esControl(e.target)) return;
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
