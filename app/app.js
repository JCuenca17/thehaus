/**
 * Orquestacion de /app.
 *
 * Une mapa, filtros, hoja de reserva y persistencia. Toda la logica de
 * datos vive en reservas.js y todos los importes en tarifas.js; aqui solo
 * se coordina.
 */
import { renderizarMapa } from "../js/mapa.js";
import { crearHoja } from "../js/hoja.js";
import { crearPanZoom } from "../js/panzoom.js";
import { FRANJAS, franjaPorId, precioDe, formatear, SON_PROVISIONALES } from "../js/tarifas.js";
import {
  estadosDe,
  crearReserva,
  cancelarReserva,
  listarReservas,
  reservasDe,
  hoy,
  proximosDias,
} from "../js/reservas.js";

const $ = (id) => document.getElementById(id);

const estado = {
  fecha: hoy(),
  franja: "manana",
};

let mapa = null;
let panzoom = null;

/* ─── Avisos efimeros ─── */

let temporizadorAviso = null;
function avisar(mensaje, accion) {
  const aviso = $("aviso");
  aviso.replaceChildren(Object.assign(document.createElement("span"), { textContent: mensaje }));

  if (accion) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = accion.texto;
    btn.addEventListener("click", () => {
      accion.hacer();
      aviso.classList.remove("visible");
    });
    aviso.appendChild(btn);
  }

  aviso.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove("visible"), accion ? 6000 : 3200);
}

/* ─── Filtros ─── */

function pintarFiltros() {
  const dias = $("filtroDias");
  dias.replaceChildren(
    ...proximosDias(7).map((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.className = "chip-dia";
      b.dataset.valor = d.valor;
      b.setAttribute("aria-selected", String(d.valor === estado.fecha));
      b.innerHTML =
        `<span class="chip-dia-semana">${d.esHoy ? "Hoy" : d.diaSemana}</span>` +
        `<span class="chip-dia-numero">${d.diaMes}</span>`;
      b.addEventListener("click", () => {
        estado.fecha = d.valor;
        pintarFiltros();
        refrescar();
      });
      return b;
    }),
  );

  const franjas = $("filtroFranjas");
  franjas.replaceChildren(
    ...FRANJAS.map((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.className = "chip-franja";
      b.setAttribute("aria-selected", String(f.id === estado.franja));
      b.innerHTML = `<strong>${f.nombre}</strong><span>${f.horario}</span>`;
      b.addEventListener("click", () => {
        estado.franja = f.id;
        pintarFiltros();
        refrescar();
      });
      return b;
    }),
  );
}

/* ─── Mapa ─── */

function refrescar() {
  mapa.aplicarEstados(estadosDe(estado.fecha, estado.franja));

  const r = mapa.resumen();
  const tuyas = r.reservado === 1 ? "1 tuya" : `${r.reservado} tuyas`;
  $("resumen").textContent = `${r.libre} libres · ${tuyas} · ${r.ocupado} ocupadas`;

  const propias = listarReservas().length;
  const contador = $("contadorReservas");
  contador.hidden = propias === 0;
  contador.textContent = propias;
}

/* ─── Hoja de reserva ─── */

const hoja = crearHoja($("hoja"));

function fichaDeUnidad(unidad) {
  const frag = document.createDocumentFragment();
  const franja = franjaPorId(estado.franja);
  const importe = precioDe(unidad.zona, estado.franja);
  const libre = unidad.estado === "libre";

  const titulo = document.createElement("h2");
  titulo.className = "hoja-titulo";
  titulo.textContent = unidad.nombre;
  frag.appendChild(titulo);

  const meta = document.createElement("p");
  meta.className = "hoja-meta";
  meta.textContent = unidad.capacidad
    ? `Espacio completo · hasta ${unidad.capacidad} personas`
    : "Puesto individual";
  frag.appendChild(meta);

  const detalle = document.createElement("dl");
  detalle.className = "hoja-detalle";
  const filas = [
    ["Fecha", new Date(`${estado.fecha}T12:00:00`).toLocaleDateString("es-PE", {
      weekday: "long", day: "numeric", month: "long",
    })],
    ["Franja", `${franja.nombre} · ${franja.horario}`],
    ["Importe", formatear(importe)],
  ];
  for (const [k, v] of filas) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    detalle.append(dt, dd);
  }
  frag.appendChild(detalle);

  if (SON_PROVISIONALES) {
    const nota = document.createElement("p");
    nota.className = "hoja-provisional";
    nota.textContent = "Precios provisionales, pendientes de confirmar.";
    frag.appendChild(nota);
  }

  if (unidad.estado === "reservado") {
    const reserva = reservasDe(estado.fecha, estado.franja).find(
      (r) => r.unidadId === unidad.id,
    );
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost-oscuro hoja-accion";
    btn.textContent = "Cancelar esta reserva";
    btn.addEventListener("click", () => {
      if (reserva) cancelarReserva(reserva.id);
      hoja.cerrar();
      refrescar();
      avisar("Reserva cancelada");
    });
    frag.appendChild(btn);
    return frag;
  }

  if (!libre) {
    const ocupado = document.createElement("p");
    ocupado.className = "hoja-ocupado";
    ocupado.textContent = "Ocupado en esta franja. Prueba con otro horario o con otro día.";
    frag.appendChild(ocupado);
    return frag;
  }

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-dark hoja-accion";
  btn.innerHTML = `Reservar por ${formatear(importe)}
    <svg class="ico ico-xs" aria-hidden="true"><use href="#i-arrow-right" /></svg>`;

  btn.addEventListener("click", () => {
    const res = crearReserva({
      unidadId: unidad.id,
      nombre: unidad.nombre,
      zona: unidad.zona,
      fecha: estado.fecha,
      franja: estado.franja,
      importe,
    });

    hoja.cerrar();

    if (!res.ok) {
      avisar(
        res.motivo === "almacenamiento"
          ? "No se pudo guardar: almacenamiento no disponible"
          : "Esa unidad ya está reservada en esa franja",
      );
      return;
    }

    refrescar();
    avisar(`${unidad.nombre} reservado`, {
      texto: "Deshacer",
      hacer: () => {
        cancelarReserva(res.reserva.id);
        refrescar();
      },
    });
  });

  frag.appendChild(btn);
  return frag;
}

function listaDeReservas() {
  const frag = document.createDocumentFragment();

  const titulo = document.createElement("h2");
  titulo.className = "hoja-titulo";
  titulo.textContent = "Mis reservas";
  frag.appendChild(titulo);

  const reservas = listarReservas();
  if (!reservas.length) {
    const vacio = document.createElement("p");
    vacio.className = "hoja-meta";
    vacio.textContent = "Todavía no has reservado nada.";
    frag.appendChild(vacio);
    return frag;
  }

  const ul = document.createElement("ul");
  ul.className = "reservas-lista";

  for (const r of reservas) {
    const li = document.createElement("li");
    const fecha = new Date(`${r.fecha}T12:00:00`).toLocaleDateString("es-PE", {
      weekday: "short", day: "numeric", month: "short",
    });

    const info = document.createElement("div");
    info.innerHTML =
      `<strong>${r.nombre}</strong>` +
      `<span>${fecha} · ${franjaPorId(r.franja).nombre} · ${formatear(r.importe)}</span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reserva-cancelar";
    btn.setAttribute("aria-label", `Cancelar ${r.nombre}`);
    btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-xmark" /></svg>';
    btn.addEventListener("click", () => {
      cancelarReserva(r.id);
      hoja.abrir(listaDeReservas());
      refrescar();
    });

    li.append(info, btn);
    ul.appendChild(li);
  }

  frag.appendChild(ul);
  return frag;
}

/* ─── Arranque ─── */

mapa = renderizarMapa($("capaMapa"), {
  interactivo: true,
  alSeleccionar: (unidad) => {
    // Tras arrastrar el plano no se abre nada: el gesto era mover, no elegir
    if (panzoom?.fueArrastre()) return;
    hoja.abrir(fichaDeUnidad(unidad));
  },
});

panzoom = crearPanZoom($("lienzo"), $("capaMapa"));

$("btnAcercar").addEventListener("click", () => panzoom.acercar());
$("btnAlejar").addEventListener("click", () => panzoom.alejar());
$("btnEncajar").addEventListener("click", () => panzoom.reiniciar());
$("btnReservas").addEventListener("click", () => hoja.abrir(listaDeReservas()));

pintarFiltros();
refrescar();
