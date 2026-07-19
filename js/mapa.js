/**
 * Renderiza la planta como SVG y mantiene el estado de ocupacion.
 *
 * No conoce la geometria: la recibe de planta.js. Y no conoce el origen
 * del estado: hoy lo alimenta un simulador, manana un backend, mediante
 * la misma llamada a aplicarEstados().
 *
 * Dos vistas sobre los mismos datos: "plano" (cenital) e "isometrico",
 * esta ultima girable en pasos de 90 grados.
 */
import { LOCAL, ZONAS, SERVICIOS, PUESTOS, ESPACIOS, ESTADOS } from "./planta.js";
import { crearProyeccion, ALTURAS, GIROS } from "./isometrico.js";
import { amueblar, amueblarServicio } from "./mobiliario.js";

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

/** Las dos caras laterales se sombrean distinto para dar volumen */
const SOMBRA = ["cara-der", "cara-izq"];

export function renderizarMapa(contenedor, opciones = {}) {
  const { vista = "isometrico", interactivo = false, alSeleccionar } = opciones;

  let giro = opciones.giro ?? 0;
  const estados = new Map();
  let nodos = new Map();
  let svg = null;

  function construir() {
    const iso = vista === "isometrico" ? crearProyeccion({ local: LOCAL, giro }) : null;

    svg = crear("svg", {
      viewBox: iso ? iso.marco(ALTURAS.espacio).viewBox : `0 0 ${LOCAL.ancho} ${LOCAL.alto}`,
      class: `mapa mapa--${vista}` + (interactivo ? " mapa--interactivo" : ""),
      role: "img",
      "aria-label": "Plano de ocupación de The Haus",
    });

    const ordenar = (lista) =>
      iso ? [...lista].sort(iso.porProfundidad) : [...lista];

    /** Extruye una caja como cara superior mas sus laterales visibles */
    const extruir = (destino, rect, alto, clases) => {
      const p = iso.prisma(rect, alto);
      p.laterales.forEach((puntos, i) => {
        destino.appendChild(
          crear("polygon", { points: puntos, class: `${clases} ${SOMBRA[i] ?? SOMBRA[1]}` }),
        );
      });
      destino.appendChild(crear("polygon", { points: p.superior, class: `${clases} cara-sup` }));
    };

    /* ─── Suelos de zona ─── */
    const capaZonas = crear("g", { class: "mapa-zonas" });
    for (const z of ordenar(ZONAS)) {
      if (iso) {
        capaZonas.appendChild(
          crear("polygon", { points: iso.suelo(z.rect), class: `zona-fondo zona--${z.id}` }),
        );
      } else {
        capaZonas.appendChild(
          crear("rect", { ...medidas(z.rect), rx: 14, class: `zona-fondo zona--${z.id}` }),
        );
        capaZonas.appendChild(
          texto({ x: z.rect.x + 26, y: z.rect.y + 54, class: "zona-etiqueta" }, z.nombre),
        );
      }
    }
    svg.appendChild(capaZonas);

    /* ─── Suelos de servicio ─── */
    const capaSuelos = crear("g", { class: "mapa-servicios" });
    for (const s2 of ordenar(SERVICIOS)) {
      if (iso) {
        capaSuelos.appendChild(
          crear("polygon", { points: iso.suelo(s2.rect), class: "servicio cara-sup" }),
        );
      } else {
        capaSuelos.appendChild(crear("rect", { ...medidas(s2.rect), rx: 8, class: "servicio" }));
        capaSuelos.appendChild(
          texto({
            x: s2.rect.x + s2.rect.w / 2,
            y: s2.rect.y + s2.rect.h / 2 + 10,
            class: "servicio-etiqueta",
          }, s2.nombre),
        );
      }
    }
    svg.appendChild(capaSuelos);

    /* ─── Volumenes: unidades y muebles de servicio en una sola pasada ───
       Ordenar por capas en vez de por profundidad hacia que un mostrador
       situado delante se dibujase detras de los escritorios. */
    const capaUnidades = crear("g", { class: "mapa-volumenes" });
    nodos = new Map();

    const grupoServicio = (s2) => {
      const g = crear("g", { class: `servicio-grupo servicio--${s2.id}` });
      for (const pieza of [...amueblarServicio(s2)].sort(iso.porProfundidad)) {
        extruir(g, pieza.rect, pieza.alto, `pieza mat--${pieza.material}`);
      }
      // Flota por encima del mueble mas alto para no quedar enterrado
      const [ex, ey] = iso.centro(s2.rect, 175);
      g.appendChild(texto({ x: ex, y: ey, class: "servicio-etiqueta" }, s2.nombre));
      return g;
    };

    const pintar = (unidad, tipo, indice) => {
      const g = crear("g", {
        class: `unidad unidad--${tipo}`,
        "data-id": unidad.id,
        "data-estado": estados.get(unidad.id) ?? "libre",
      });
      g.style.setProperty("--orden", indice);

      if (iso) {
        const { plataforma, piezas } = amueblar(unidad);
        extruir(g, plataforma.rect, plataforma.alto, "plat");

        const mobiliario = crear("g", { class: "mobiliario" });
        for (const pieza of [...piezas].sort(iso.porProfundidad)) {
          extruir(mobiliario, pieza.rect, plataforma.alto + pieza.alto, `pieza mat--${pieza.material}`);
        }
        g.appendChild(mobiliario);
      } else {
        g.appendChild(crear("rect", { ...medidas(unidad.rect), rx: tipo === "espacio" ? 12 : 6 }));
        if (tipo === "espacio") {
          g.appendChild(texto({
            x: unidad.rect.x + unidad.rect.w / 2,
            y: unidad.rect.y + unidad.rect.h / 2,
            class: "unidad-etiqueta",
          }, unidad.nombre));
        }
      }

      if (interactivo) {
        g.setAttribute("tabindex", "0");
        g.setAttribute("role", "button");
        // El estado va tambien en el nombre accesible: el color no puede
        // ser el unico portador de la informacion.
        g.setAttribute("aria-label", `${unidad.nombre}, ${g.dataset.estado}`);
      }

      nodos.set(unidad.id, { nodo: g, unidad, tipo });
      return g;
    };

    const volumenes = ordenar([
      ...PUESTOS.map((u) => ({ ...u, _clase: "puesto" })),
      ...ESPACIOS.map((u) => ({ ...u, _clase: "espacio" })),
      ...(iso ? SERVICIOS.map((u) => ({ ...u, _clase: "servicio" })) : []),
    ]);

    volumenes.forEach((v, i) => {
      capaUnidades.appendChild(
        v._clase === "servicio" ? grupoServicio(v) : pintar(v, v._clase, i),
      );
    });

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
  }

  construir();

  const api = {
    get svg() {
      return svg;
    },
    /** @param {Record<string,string>} nuevos mapa de id → estado */
    aplicarEstados(nuevos) {
      for (const [id, estado] of Object.entries(nuevos)) {
        if (!ESTADOS.includes(estado)) continue;
        estados.set(id, estado);

        const registro = nodos.get(id);
        if (!registro) continue;
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
    /** Gira el plano un cuarto de vuelta y lo vuelve a construir */
    girar(pasos = 1) {
      giro = (((giro + pasos) % GIROS) + GIROS) % GIROS;
      construir();
      return giro;
    },
    get giro() {
      return giro;
    },
  };

  return api;
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
    const nuevos = {};
    for (const id of ids) {
      const r = Math.random();
      nuevos[id] = r < 0.45 ? "ocupado" : r < 0.62 ? "reservado" : "libre";
    }
    mapa.aplicarEstados(nuevos);
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
