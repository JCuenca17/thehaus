/**
 * Renderiza la planta como SVG y mantiene el estado de ocupacion.
 *
 * No conoce la geometria: la recibe de planta.js. Y no conoce el origen
 * del estado: hoy lo alimenta un simulador, manana un backend, mediante
 * la misma llamada a aplicarEstados().
 */
import { LOCAL, ZONAS, SERVICIOS, PUESTOS, ESPACIOS, ESTADOS } from "./planta.js";

const NS = "http://www.w3.org/2000/svg";

const crear = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** El modelo usa w/h; SVG espera width/height */
const medidas = ({ x, y, w, h }) => ({ x, y, width: w, height: h });

/**
 * Pinta el plano dentro de un contenedor.
 *
 * @param {HTMLElement} contenedor
 * @param {{interactivo?: boolean, alSeleccionar?: (unidad) => void}} opciones
 */
export function renderizarMapa(contenedor, opciones = {}) {
  const { interactivo = false, alSeleccionar } = opciones;

  const svg = crear("svg", {
    viewBox: `0 0 ${LOCAL.ancho} ${LOCAL.alto}`,
    class: "mapa" + (interactivo ? " mapa--interactivo" : ""),
    role: "img",
    "aria-label": "Plano de ocupación de The Haus",
  });

  // Zonas al fondo
  const capaZonas = crear("g", { class: "mapa-zonas" });
  for (const z of ZONAS) {
    capaZonas.appendChild(
      crear("rect", { ...medidas(z.rect), rx: 14, class: `zona-fondo zona--${z.id}` }),
    );
    // Dentro de la banda superior que la zona reserva para su titulo
    capaZonas.appendChild(
      Object.assign(crear("text", {
        x: z.rect.x + 26,
        y: z.rect.y + 54,
        class: "zona-etiqueta",
      }), { textContent: z.nombre }),
    );
  }
  svg.appendChild(capaZonas);

  const capaServicios = crear("g", { class: "mapa-servicios" });
  for (const s of SERVICIOS) {
    capaServicios.appendChild(crear("rect", { ...medidas(s.rect), rx: 8, class: "servicio" }));
    capaServicios.appendChild(
      Object.assign(crear("text", {
        x: s.rect.x + s.rect.w / 2,
        y: s.rect.y + s.rect.h / 2 + 10,
        class: "servicio-etiqueta",
      }), { textContent: s.nombre }),
    );
  }
  svg.appendChild(capaServicios);

  // Unidades reservables encima
  const capaUnidades = crear("g", { class: "mapa-unidades" });
  const nodos = new Map();

  const pintar = (unidad, tipo) => {
    const g = crear("g", {
      class: `unidad unidad--${tipo}`,
      "data-id": unidad.id,
      "data-estado": "libre",
    });

    g.appendChild(crear("rect", { ...medidas(unidad.rect), rx: tipo === "espacio" ? 12 : 6 }));

    if (tipo === "espacio") {
      g.appendChild(
        Object.assign(crear("text", {
          x: unidad.rect.x + unidad.rect.w / 2,
          y: unidad.rect.y + unidad.rect.h / 2 + 12,
          class: "unidad-etiqueta",
        }), { textContent: unidad.nombre }),
      );
    }

    if (interactivo) {
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      // El estado va tambien en el nombre accesible: el color no puede ser
      // el unico portador de la informacion.
      g.setAttribute("aria-label", `${unidad.nombre}, libre`);
    }

    capaUnidades.appendChild(g);
    nodos.set(unidad.id, { nodo: g, unidad, tipo });
  };

  PUESTOS.forEach((p) => pintar(p, "puesto"));
  ESPACIOS.forEach((e) => pintar(e, "espacio"));
  svg.appendChild(capaUnidades);

  contenedor.replaceChildren(svg);

  if (interactivo && alSeleccionar) {
    const activar = (target) => {
      const g = target.closest(".unidad");
      if (!g) return;
      const registro = nodos.get(g.dataset.id);
      if (registro) alSeleccionar({ ...registro.unidad, estado: g.dataset.estado });
    };

    svg.addEventListener("click", (e) => activar(e.target));
    svg.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activar(e.target);
      }
    });
  }

  return {
    svg,
    /** @param {Record<string,string>} estados mapa de id → estado */
    aplicarEstados(estados) {
      for (const [id, estado] of Object.entries(estados)) {
        const registro = nodos.get(id);
        if (!registro || !ESTADOS.includes(estado)) continue;

        registro.nodo.dataset.estado = estado;
        if (interactivo) {
          registro.nodo.setAttribute("aria-label", `${registro.unidad.nombre}, ${estado}`);
        }
      }
    },
    obtenerEstado(id) {
      return nodos.get(id)?.nodo.dataset.estado ?? null;
    },
    resumen() {
      const total = { libre: 0, reservado: 0, ocupado: 0 };
      for (const { nodo } of nodos.values()) total[nodo.dataset.estado]++;
      return total;
    },
  };
}

/**
 * Simulador de ocupacion. Sustituye al backend mientras no exista:
 * arranca con un reparto verosimil y va cambiando unidades sueltas
 * para que el mapa se vea vivo.
 */
export function crearSimulador(mapa, opciones = {}) {
  const { intervalo = 2200, ritmo = 3 } = opciones;
  const ids = [...PUESTOS, ...ESPACIOS].map((u) => u.id);
  let timer = null;

  const alAzar = (lista) => lista[Math.floor(Math.random() * lista.length)];

  const sembrar = () => {
    const estados = {};
    for (const id of ids) {
      const r = Math.random();
      estados[id] = r < 0.45 ? "ocupado" : r < 0.62 ? "reservado" : "libre";
    }
    mapa.aplicarEstados(estados);
  };

  const latir = () => {
    const cambios = {};
    for (let i = 0; i < ritmo; i++) {
      const id = alAzar(ids);
      const actual = mapa.obtenerEstado(id);
      cambios[id] = alAzar(ESTADOS.filter((e) => e !== actual));
    }
    mapa.aplicarEstados(cambios);
  };

  return {
    iniciar() {
      if (timer) return;
      sembrar();
      timer = setInterval(latir, intervalo);
    },
    detener() {
      clearInterval(timer);
      timer = null;
    },
  };
}
