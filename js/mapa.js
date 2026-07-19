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
import {
  LOCAL,
  ZONAS,
  SERVICIOS,
  PUESTOS,
  ESPACIOS,
  ESTADOS,
  CIRCULACION,
  ACCESO,
} from "./planta.js";
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

  /**
   * Encuadre unico para todas las orientaciones. Si se recalculase en cada
   * fotograma, el plano se encogeria y creceria mientras gira. Se toma la
   * union de varios angulos intermedios, no solo de los cuatro en reposo.
   */
  const ENCUADRE =
    vista === "isometrico"
      ? (() => {
          const cajas = Array.from({ length: 8 }, (_, i) =>
            crearProyeccion({ local: LOCAL, giro: i / 2 })
              .marco(ALTURAS.espacio)
              .viewBox.split(" ")
              .map(Number),
          );
          const minX = Math.min(...cajas.map((c) => c[0]));
          const minY = Math.min(...cajas.map((c) => c[1]));
          const maxX = Math.max(...cajas.map((c) => c[0] + c[2]));
          const maxY = Math.max(...cajas.map((c) => c[1] + c[3]));
          return `${minX.toFixed(1)} ${minY.toFixed(1)} ${(maxX - minX).toFixed(1)} ${(maxY - minY).toFixed(1)}`;
        })()
      : `0 0 ${LOCAL.ancho} ${LOCAL.alto}`;

  /**
   * `detalle` en falso dibuja solo suelos y plataformas. Se usa durante el
   * giro por coste medido: rehacer el plano completo son 954 poligonos y
   * ~10 ms por fotograma en escritorio, que en un movil de gama media se
   * va por encima del presupuesto de 16,7 ms y tira la animacion a 25 fps.
   * Sin mobiliario baja a unos 200 poligonos. En movimiento no se distingue
   * una silla, y lo que importa —el color de estado— vive en la plataforma,
   * asi que sigue viendose durante todo el giro.
   */
  function construir({ detalle = true } = {}) {
    const iso = vista === "isometrico" ? crearProyeccion({ local: LOCAL, giro }) : null;

    svg = crear("svg", {
      viewBox: ENCUADRE,
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

    /* ─── Suelo del local, pasillo y puerta ───
       El pasillo se dibuja porque es lo que explica el plano: sin el, las
       zonas flotan y no se ve por donde se llega a cada una. */
    const capaBase = crear("g", { class: "mapa-base" });
    const planta = { x: 0, y: 0, w: LOCAL.ancho, h: LOCAL.alto };

    const suelo = (rect, clase, rx) =>
      iso
        ? crear("polygon", { points: iso.suelo(rect), class: clase })
        : crear("rect", { ...medidas(rect), rx, class: clase });

    capaBase.appendChild(suelo(planta, "local-suelo", 18));
    for (const c of CIRCULACION) capaBase.appendChild(suelo(c.rect, "circulacion", 6));
    capaBase.appendChild(suelo(ACCESO, "acceso", 3));
    svg.appendChild(capaBase);

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

        if (detalle) {
          const mobiliario = crear("g", { class: "mobiliario" });
          for (const pieza of [...piezas].sort(iso.porProfundidad)) {
            extruir(mobiliario, pieza.rect, plataforma.alto + pieza.alto, `pieza mat--${pieza.material}`);
          }
          g.appendChild(mobiliario);
        }
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
      ...(iso && detalle ? SERVICIOS.map((u) => ({ ...u, _clase: "servicio" })) : []),
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

  /* ─── Giro animado ─── */

  const normalizar = (g) => (((g % GIROS) + GIROS) % GIROS);
  const sinMovimiento = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  // Se guarda aparte del `giro` en curso: si se pulsa otra vez a mitad de
  // animacion, el destino se acumula en vez de partir de un angulo roto
  let objetivo = giro;
  let animacion = null;

  function animarGiro(duracion = 420) {
    cancelAnimationFrame(animacion);
    const desde = giro;
    const recorrido = objetivo - desde;
    const t0 = performance.now();

    const paso = (ahora) => {
      const t = Math.min(1, (ahora - t0) / duracion);
      // Arranca y frena: un plano que gira de golpe se lee como un salto
      const suave = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
      giro = desde + recorrido * suave;

      if (t < 1) {
        construir({ detalle: false });
        animacion = requestAnimationFrame(paso);
      } else {
        rematarGiro();
      }
    };

    animacion = requestAnimationFrame(paso);
  }

  /** Planta el giro en su destino y devuelve el plano al detalle completo */
  function rematarGiro() {
    if (animacion === null) return;
    cancelAnimationFrame(animacion);
    animacion = null;
    giro = objetivo = normalizar(objetivo);
    construir();
  }

  // Con la pestana oculta requestAnimationFrame deja de dispararse. Sin
  // esto el plano se queda congelado a medio girar y sin mobiliario, y el
  // usuario se lo encuentra roto al volver.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) rematarGiro();
  });

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
    /** Gira el plano un cuarto de vuelta, animando el recorrido */
    girar(pasos = 1) {
      objetivo += pasos;

      // Con la pestana oculta requestAnimationFrame no llega a dispararse,
      // asi que animar dejaria el giro sin empezar siquiera
      if (vista !== "isometrico" || sinMovimiento() || document.hidden) {
        giro = objetivo = normalizar(objetivo);
        construir();
      } else {
        animarGiro();
      }
      return normalizar(objetivo);
    },
    get giro() {
      return normalizar(objetivo);
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
