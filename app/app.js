/**
 * Orquestacion de /app.
 *
 * Une mapa, filtros, hoja de reserva y persistencia. Toda la logica de
 * datos vive en reservas.js y todos los importes en tarifas.js; aqui solo
 * se coordina.
 */
import { crearEscena } from "../js/escena3d.js";
import { crearHoja } from "../js/hoja.js";
import { FRANJAS, franjaPorId, precioDe, formatear, SON_PROVISIONALES } from "../js/tarifas.js";
import {
  obtenerSesion,
  haySesion,
  hayCuenta,
  cuentaGuardada,
  registrar,
  iniciarSesion,
  cerrarSesion,
  olvidarCuenta,
  MOTIVOS,
} from "../js/sesion-simulada.js";
import {
  estadosDe,
  crearReserva,
  cancelarReserva,
  listarReservas,
  reservasDe,
  hoy,
  proximosDias,
  descartarReservasSinCuenta,
} from "../js/reservas.js";

const $ = (id) => document.getElementById(id);

/* Engancha un control tolerando que no exista. Un unico id desincronizado
   entre el HTML y este archivo tumbaba el modulo entero y con el toda la
   aplicacion; asi solo se pierde ese control. */
const alPulsar = (id, fn) => {
  const el = $(id);
  if (!el) {
    console.warn(`[app] falta el control #${id}`);
    return null;
  }
  el.addEventListener("click", fn);
  return el;
};

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
    // A esta ficha no se llega sin sesion: la puerta cubre la aplicacion
    // entera. Aun asi se comprueba, porque la sesion puede haberse cerrado
    // en otra pestana mientras esta ficha estaba abierta.
    const cuenta = obtenerSesion();
    if (!cuenta) {
      hoja.cerrar();
      mostrarPuerta();
      return;
    }

    const res = crearReserva({
      unidadId: unidad.id,
      nombre: unidad.nombre,
      zona: unidad.zona,
      fecha: estado.fecha,
      franja: estado.franja,
      importe,
      titular: cuenta.nombre,
      contacto: cuenta.contacto,
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

/* ─── Puerta de sesion ─── */

/**
 * Para entrar hace falta cuenta. No es autenticacion —lo dice el propio
 * modulo de sesion— pero el flujo es el que habra cuando lo sea, que es
 * justo lo que se quiere ensayar.
 */
function pintarPuerta(modo = hayCuenta() ? "entrar" : "registro") {
  const cuerpo = $("puertaCuerpo");
  const entrando = modo === "entrar";
  const cuenta = cuentaGuardada();

  const titulo = document.createElement("h1");
  titulo.className = "hoja-titulo";
  titulo.id = "puertaTitulo";
  titulo.textContent = entrando ? "Bienvenido de nuevo" : "Crea tu cuenta";

  const meta = document.createElement("p");
  meta.className = "hoja-meta";
  meta.textContent = entrando
    ? "Entra para ver el plano y reservar tu sitio."
    : "Para reservar necesitamos saber a quién avisar.";

  const form = document.createElement("form");
  form.className = "form-identidad";
  form.noValidate = true;
  form.innerHTML =
    (entrando
      ? ""
      : `<label>
          <span>Nombre y apellido</span>
          <input name="nombre" type="text" autocomplete="name" required />
        </label>`) +
    `<label>
      <span>Correo o teléfono</span>
      <input name="contacto" type="text" autocomplete="email" required
        value="${entrando && cuenta ? cuenta.contacto : ""}" />
    </label>
    <p class="form-error" hidden></p>
    <button type="submit" class="btn btn-dark hoja-accion">
      ${entrando ? "Entrar" : "Crear cuenta y entrar"}
    </button>`;

  const error = form.querySelector(".form-error");
  const fallar = (motivo, campo) => {
    error.textContent = MOTIVOS[motivo] ?? "No se ha podido completar.";
    error.hidden = false;
    form[campo]?.focus();
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = { contacto: form.contacto.value };
    if (!entrando) datos.nombre = form.nombre.value;

    const res = entrando ? iniciarSesion(datos) : registrar(datos);
    if (!res.ok) {
      fallar(res.motivo, res.motivo === "nombre" ? "nombre" : "contacto");
      return;
    }
    entrar();
  });

  // Cambiar de camino: sin servidor solo cabe una cuenta por navegador, asi
  // que "usar otra" es literalmente olvidar la que hay
  const alterna = document.createElement("button");
  alterna.type = "button";
  alterna.className = "enlace-sutil puerta-alterna";
  alterna.textContent = entrando ? "Usar otra cuenta" : "Ya tengo cuenta";
  alterna.addEventListener("click", () => {
    if (entrando) olvidarCuenta();
    pintarPuerta(entrando ? "registro" : "entrar");
  });

  const nota = document.createElement("p");
  nota.className = "puerta-nota";
  nota.textContent =
    "No pedimos contraseña: esto es una demostración y no queremos que escribas una real.";

  cuerpo.replaceChildren(titulo, meta, form, alterna, nota);
  form.querySelector("input")?.focus();
}

function mostrarPuerta() {
  $("puerta").hidden = false;
  document.body.classList.add("con-puerta");
  pintarPuerta();
}

function listaDeReservas() {
  const frag = document.createDocumentFragment();

  const titulo = document.createElement("h2");
  titulo.className = "hoja-titulo";
  titulo.textContent = "Mis reservas";
  frag.appendChild(titulo);

  const cuenta = obtenerSesion();
  if (cuenta) {
    const quien = document.createElement("p");
    quien.className = "hoja-meta identidad-actual";
    quien.innerHTML =
      `A nombre de <strong>${cuenta.nombre}</strong> · ${cuenta.contacto} ` +
      `<button type="button" class="enlace-sutil">Cerrar sesión</button>`;
    quien.querySelector("button").addEventListener("click", () => {
      cerrarSesion();
      hoja.cerrar();
      mostrarPuerta();
    });
    frag.appendChild(quien);
  }

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

/* La escena se monta la primera vez que se entra, no al cargar la pagina.
   Encuadrar la camara requiere medir el contenedor, y con la puerta encima
   se estaba midiendo algo que el usuario todavia no ve; montarla al entrar
   evita esa clase de encuadres torcidos. */
let montada = false;

function entrar() {
  $("puerta").hidden = true;
  document.body.classList.remove("con-puerta");

  if (!montada) {
    montada = true;
    mapa = crearEscena($("capaMapa"), {
      alSeleccionar: (unidad) => hoja.abrir(fichaDeUnidad(unidad)),
    });
    // La escena lleva su propia camara: orbitar, acercar y reencuadrar son
    // suyos, asi que hace de panzoom sin que el resto del archivo se entere
    panzoom = mapa;
    conectarControles();
    pintarFiltros();

    const descartadas = descartarReservasSinCuenta();
    if (descartadas) {
      avisar(
        descartadas === 1
          ? "Se descartó 1 reserva anterior a las cuentas"
          : `Se descartaron ${descartadas} reservas anteriores a las cuentas`,
      );
    }
  }

  refrescar();
}

/* Los controles se enganchan una sola vez, al montar la escena: antes de
   eso no hay nada que girar ni que acercar. */
function conectarControles() {
  alPulsar("btnGirar", () => {
    mapa.girar(1);
    // girar() repinta la escena, asi que hay que devolverle el estado
    refrescar();
    // Antes se reencuadraba aqui, lo que tiraba el zoom del usuario en cada
    // giro. Ya no hace falta: el encuadre es el mismo en las cuatro
    // orientaciones, asi que el plano no se descoloca al girar.
  });

  alPulsar("btnAcercar", () => panzoom.acercar());
  alPulsar("btnAlejar", () => panzoom.alejar());
  /* El icono de expandir promete pantalla completa, asi que hace eso.
     Reencuadrar pasa a estar en el doble clic sobre el plano, que es donde
     se busca por instinto. */
  const btnPantalla = alPulsar("btnPantalla", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      avisar("Tu navegador no permite pantalla completa aquí");
    }
  });

  document.addEventListener("fullscreenchange", () => {
    btnPantalla?.setAttribute("aria-pressed", String(!!document.fullscreenElement));
    panzoom.reiniciar();
  });

  $("lienzo")?.addEventListener("dblclick", () => panzoom.reiniciar());
  alPulsar("btnReservas", () => hoja.abrir(listaDeReservas()));
}

/* Con sesion se entra directo; sin ella la puerta se queda donde estaba,
   que es visible desde que llega el HTML. */
if (haySesion()) entrar();
else mostrarPuerta();

/* ─── Instalable ─── */
/* El registro va al final y sin bloquear: si falla, la aplicacion sigue
   funcionando igual, solo pierde el modo sin conexion. */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { scope: "/app/" }).catch(() => {});
  });
}
