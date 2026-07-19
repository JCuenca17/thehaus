/**
 * Renderiza la planta como SVG y mantiene el estado de ocupacion.
 *
 * No conoce la geometria: la recibe de planta.js. Y no conoce el origen
 * del estado: hoy lo alimenta un simulador, manana un backend, mediante
 * la misma llamada a aplicarEstados().
 *
 * Dos vistas sobre los mismos datos: "plano" (cenital) e "isometrico".
 */
import { LOCAL, ZONAS, SERVICIOS, PUESTOS, ESPACIOS, ESTADOS } from "./planta.js";
import { crearProyeccion, porProfundidad, ALTURAS } from "./isometrico.js";

const NS = "http://www.w3.org/2000/svg";

const crear = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

const texto = (attrs, contenido) =>
  Object.assign(crear("text", attrs), { textContent: contenido });

/** El modelo usa w/h; SVG espera width/height */
const medidas = ({ x, y, w, h }) => ({ x, y, width: w, height: h });

/**
 * Pinta el plano dentro de un contenedor.
 *
 * @param {HTMLElement} contenedor
 * @param {{vista?: "plano"|"isometrico", interactivo?: boolean,
 *          alSeleccionar?: (unidad) => void}} opciones
 */
export function renderizarMapa(contenedor, opciones = {}) {
  const { vista = "isometrico", interactivo = false, alSeleccionar } = opciones;

  const iso = vista === "isometrico" ? crearProyeccion() : null;
  const marco = iso ? iso.marco(LOCAL, ALTURAS.espacio) : null;

  const svg = crear("svg", {
    viewBox: marco ? marco.viewBox : `0 0 ${LOCAL.ancho} ${LOCAL.alto}`,
    class: `mapa mapa--${vista}` + (interactivo ? " mapa--interactivo" : ""),
    role: "img",
    "aria-label": "Plano de ocupación de The Haus",
  });

  /* ─── Zonas y servicios (suelo) ─── */

  const capaZonas = crear("g", { class: "mapa-zonas" });

  for (const z of [...ZONAS].sort(porProfundidad)) {
    if (iso) {
      // Sin rotulo dentro del plano: en isometrico no queda hueco libre
      // sin chocar con las unidades. Los nombres van en la lista de
      // disponibilidad por zona, que ademas es texto real.
      capaZonas.appendChild(crear("polygon", {
        points: iso.suelo(z.rect),
        class: `zona-fondo zona--${z.id}`,
      }));
    } else {
      capaZonas.appendChild(crear("rect", {
        ...medidas(z.rect), rx: 14, class: `zona-fondo zona--${z.id}`,
      }));
      capaZonas.appendChild(
        texto({ x: z.rect.x + 26, y: z.rect.y + 54, class: "zona-etiqueta" }, z.nombre),
      );
    }
  }
  svg.appendChild(capaZonas);

  const capaServicios = crear("g", { class: "mapa-servicios" });
  for (const s of [...SERVICIOS].sort(porProfundidad)) {
    if (iso) {
      const p = iso.prisma(s.rect, ALTURAS.servicio);
      capaServicios.appendChild(crear("polygon", { points: p.izquierda, class: "servicio cara-izq" }));
      capaServicios.appendChild(crear("polygon", { points: p.derecha, class: "servicio cara-der" }));
      capaServicios.appendChild(crear("polygon", { points: p.superior, class: "servicio cara-sup" }));
      const [cx, cy] = iso.centro(s.rect, ALTURAS.servicio);
      capaServicios.appendChild(texto({ x: cx, y: cy + 8, class: "servicio-etiqueta" }, s.nombre));
    } else {
      capaServicios.appendChild(crear("rect", { ...medidas(s.rect), rx: 8, class: "servicio" }));
      capaServicios.appendChild(texto({
        x: s.rect.x + s.rect.w / 2,
        y: s.rect.y + s.rect.h / 2 + 10,
        class: "servicio-etiqueta",
      }, s.nombre));
    }
  }
  svg.appendChild(capaServicios);

  /* ─── Unidades reservables ─── */

  const capaUnidades = crear("g", { class: "mapa-unidades" });
  const nodos = new Map();

  const pintar = (unidad, tipo) => {
    const g = crear("g", {
      class: `unidad unidad--${tipo}`,
      "data-id": unidad.id,
      "data-estado": "libre",
    });

    if (iso) {
      // Las laterales primero: la cara superior las tapa por el borde
      const p = iso.prisma(unidad.rect, ALTURAS[tipo]);
      g.appendChild(crear("polygon", { points: p.izquierda, class: "cara-izq" }));
      g.appendChild(crear("polygon", { points: p.derecha, class: "cara-der" }));
      g.appendChild(crear("polygon", { points: p.superior, class: "cara-sup" }));
    } else {
      g.appendChild(crear("rect", { ...medidas(unidad.rect), rx: tipo === "espacio" ? 12 : 6 }));
    }

    if (tipo === "espacio") {
      const [cx, cy] = iso
        ? iso.centro(unidad.rect, ALTURAS.espacio)
        : [unidad.rect.x + unidad.rect.w / 2, unidad.rect.y + unidad.rect.h / 2];
      g.appendChild(texto({ x: cx, y: cy + 10, class: "unidad-etiqueta" }, unidad.nombre));
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

  // En isometrico el orden de pintado es la profundidad; en plano da igual
  const unidades = [
    ...PUESTOS.map((u) => ({ ...u, _tipo: "puesto" })),
    ...ESPACIOS.map((u) => ({ ...u, _tipo: "espacio" })),
  ];
  if (iso) unidades.sort(porProfundidad);
  unidades.forEach((u) => pintar(u, u._tipo));

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
    /** Libres y total por zona, para la lista de disponibilidad */
    resumenPorZona() {
      const porZona = new Map(ZONAS.map((z) => [z.id, { ...z, libres: 0, total: 0 }]));
      for (const { nodo, unidad } of nodos.values()) {
        const z = porZona.get(unidad.zona);
        if (!z) continue;
        z.total++;
        if (nodo.dataset.estado === "libre") z.libres++;
      }
      return [...porZona.values()];
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
