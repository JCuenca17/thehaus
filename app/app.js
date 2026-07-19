/**
 * Orquestacion de /app.
 *
 * Une mapa, filtros, hoja de reserva y persistencia. Toda la logica de
 * datos vive en reservas.js y todos los importes en tarifas.js; aqui solo
 * se coordina.
 */
import { crearEscena } from "../js/escena3d.js";
import { crearHoja } from "../js/hoja.js";
import {
  FRANJAS,
  franjaPorId,
  formatear,
  presupuesto,
  descuentoPor,
  proximoTramo,
  porcentaje,
  SON_PROVISIONALES,
} from "../js/tarifas.js";
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
  estadosDeRango,
  disponibilidadDe,
  crearReservaMultiple,
  cancelarReserva,
  cancelarGrupo,
  listarGrupos,
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

/* Los dias se guardan como lista ordenada aunque casi siempre tenga uno
   solo: tener dos caminos, "un dia" y "varios dias", duplicaba cada
   consulta de disponibilidad y cada calculo de importe. */
const estado = {
  fechas: [hoy()],
  franja: "manana",
};

const diasElegidos = () => estado.fechas.length;
const unSoloDia = () => estado.fechas.length === 1;

const fechaLarga = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long",
  });

const fechaCorta = (f) =>
  new Date(`${f}T12:00:00`).toLocaleDateString("es-PE", {
    weekday: "short", day: "numeric", month: "short",
  });

/** "3 días: del 5 al 9 de agosto" — sin prometer que sean consecutivos */
function resumenDeFechas(fechas) {
  if (fechas.length === 1) return fechaLarga(fechas[0]);
  const seguidos = fechas.every((f, i) => {
    if (i === 0) return true;
    const previo = new Date(`${fechas[i - 1]}T12:00:00`);
    previo.setDate(previo.getDate() + 1);
    return previo.toISOString().slice(0, 10) === f;
  });
  const extremos = `${fechaCorta(fechas[0])} – ${fechaCorta(fechas.at(-1))}`;
  return `${fechas.length} días · ${seguidos ? extremos : "sueltos, " + extremos}`;
}

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

/** Se puede quitar cualquier dia menos el ultimo: sin dias no hay plano */
function alternarDia(valor) {
  const i = estado.fechas.indexOf(valor);
  if (i === -1) estado.fechas = [...estado.fechas, valor].sort();
  else if (estado.fechas.length > 1) estado.fechas.splice(i, 1);
  else {
    avisar("Elige al menos un día");
    return;
  }
  pintarFiltros();
  refrescar();
}

function pintarFiltros() {
  const dias = $("filtroDias");
  // Cuatro semanas: reservar veinte dias seguidos es justo el caso que hace
  // interesante el descuento, y con siete no cabia
  dias.replaceChildren(
    ...proximosDias(28).map((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip-dia";
      b.dataset.valor = d.valor;
      // Casillas y no pestanas: se pueden marcar varias a la vez, y "tab"
      // le contaria al lector de pantalla que solo cabe una
      b.role = "checkbox";
      b.setAttribute("aria-checked", String(estado.fechas.includes(d.valor)));
      b.setAttribute("aria-label", fechaLarga(d.valor));
      b.innerHTML =
        `<span class="chip-dia-semana">${d.esHoy ? "Hoy" : d.diaSemana}</span>` +
        `<span class="chip-dia-numero">${d.diaMes}</span>`;
      b.addEventListener("click", () => alternarDia(d.valor));
      return b;
    }),
  );
  pintarSeleccion();

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

/** Cuantos dias van, que descuento sale y que falta para el siguiente */
function pintarSeleccion() {
  const caja = $("filtroResumen");
  if (!caja) return;

  const dias = diasElegidos();
  const dto = descuentoPor(dias);
  const siguiente = proximoTramo(dias);

  const partes = [dias === 1 ? "1 día" : `${dias} días`];
  if (dto) partes.push(`−${porcentaje(dto)} por volumen`);
  else if (siguiente) {
    partes.push(
      `${siguiente.faltan} ${siguiente.faltan === 1 ? "día más" : "días más"} y baja ${porcentaje(siguiente.descuento)}`,
    );
  }

  caja.replaceChildren(
    Object.assign(document.createElement("span"), {
      textContent: partes.join(" · "),
      className: dto ? "con-descuento" : "",
    }),
  );

  if (!unSoloDia()) {
    const limpiar = document.createElement("button");
    limpiar.type = "button";
    limpiar.className = "enlace-sutil";
    limpiar.textContent = "Solo hoy";
    limpiar.addEventListener("click", () => {
      estado.fechas = [hoy()];
      pintarFiltros();
      refrescar();
    });
    caja.appendChild(limpiar);
  }
}

/* ─── Mapa ─── */

function refrescar() {
  mapa.aplicarEstados(estadosDeRango(estado.fechas, estado.franja));

  const r = mapa.resumen();
  const tuyas = r.reservado === 1 ? "1 tuya" : `${r.reservado} tuyas`;
  // "parcial" solo se nombra cuando existe: con un dia siempre es 0 y
  // enseñar "0 parciales" invita a preguntarse que es eso
  const trozos = [`${r.libre} libres`, tuyas, `${r.ocupado} ocupadas`];
  if (r.parcial) trozos.splice(1, 0, `${r.parcial} a medias`);
  $("resumen").textContent = trozos.join(" · ");

  const propias = listarGrupos().length;
  const contador = $("contadorReservas");
  contador.hidden = propias === 0;
  contador.textContent = propias;

  pintarSeleccion();
}

/* ─── Hoja de reserva ─── */

const hoja = crearHoja($("hoja"));

/**
 * Bloque de importe con el desglose del descuento, si lo hay.
 *
 * `fechas` son los dias que se van a reservar de verdad, que en el caso
 * parcial no son los que el usuario tiene marcados arriba. Enseñar aqui
 * los marcados hacia que la ficha dijera "6 días" junto a un precio de 5.
 */
function bloqueImporte(pres, fechas) {
  const frag = document.createDocumentFragment();
  const detalle = document.createElement("dl");
  detalle.className = "hoja-detalle";

  const filas = [
    ["Días", resumenDeFechas(fechas)],
    ["Franja", `${franjaPorId(estado.franja).nombre} · ${franjaPorId(estado.franja).horario}`],
  ];
  if (pres.descuento) {
    filas.push([`${pres.dias} × ${formatear(pres.base)}`, formatear(pres.bruto)]);
    filas.push([`Descuento ${porcentaje(pres.descuento)}`, `−${formatear(pres.ahorro)}`]);
  }
  filas.push(["Total", formatear(pres.total)]);

  for (const [k, v] of filas) {
    const dt = document.createElement("dt");
    dt.textContent = k;
    const dd = document.createElement("dd");
    dd.textContent = v;
    detalle.append(dt, dd);
  }
  frag.appendChild(detalle);
  return frag;
}

/** Guarda una reserva de N dias y avisa; devuelve si salio bien */
function reservar(unidad, fechas) {
  const cuenta = obtenerSesion();
  if (!cuenta) {
    hoja.cerrar();
    mostrarPuerta();
    return false;
  }

  const pres = presupuesto(unidad.zona, estado.franja, fechas.length);
  const importes = fechas.map((_, i) => (i === fechas.length - 1 ? pres.ultimo : pres.porDia));

  const res = crearReservaMultiple({
    unidadId: unidad.id,
    nombre: unidad.nombre,
    zona: unidad.zona,
    fechas,
    franja: estado.franja,
    importes,
    titular: cuenta.nombre,
    contacto: cuenta.contacto,
  });

  hoja.cerrar();

  if (!res.ok) {
    avisar(
      res.motivo === "almacenamiento"
        ? "No se pudo guardar: almacenamiento no disponible"
        : `Alguien acaba de coger el ${fechaCorta(res.fecha)}`,
    );
    refrescar();
    return false;
  }

  refrescar();
  avisar(
    fechas.length === 1
      ? `${unidad.nombre} reservado`
      : `${unidad.nombre}, ${fechas.length} días reservados`,
    { texto: "Deshacer", hacer: () => { cancelarGrupo(res.grupoId); refrescar(); } },
  );
  return true;
}

function fichaDeUnidad(unidad) {
  const frag = document.createDocumentFragment();
  const disp = disponibilidadDe(unidad.id, estado.fechas, estado.franja);

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

  /* ── Ya es suyo, del todo o en parte ── */
  if (disp.libres.length === 0 && disp.mias.length > 0) {
    const tuyo = document.createElement("p");
    tuyo.className = "hoja-meta";
    tuyo.textContent =
      disp.mias.length === estado.fechas.length
        ? `Ya lo tienes reservado ${unSoloDia() ? "este día" : "los " + disp.mias.length + " días"}.`
        : `Tienes ${disp.mias.length} de estos ${estado.fechas.length} días; los otros ${disp.ocupadas.length} están ocupados.`;
    frag.appendChild(tuyo);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost-oscuro hoja-accion";
    btn.textContent = "Ver en Mis reservas";
    btn.addEventListener("click", () => hoja.abrir(listaDeReservas()));
    frag.appendChild(btn);
    return frag;
  }

  /* ── No sirve ningun dia ── */
  if (disp.libres.length === 0) {
    if (SON_PROVISIONALES) frag.appendChild(notaProvisional());
    const ocupado = document.createElement("p");
    ocupado.className = "hoja-ocupado";
    ocupado.textContent = unSoloDia()
      ? "Ocupado en esta franja. Prueba con otro horario o con otro día."
      : `Ocupado los ${estado.fechas.length} días en esta franja.`;
    frag.appendChild(ocupado);
    frag.appendChild(botonVerLibres());
    return frag;
  }

  const parcial = disp.libres.length < estado.fechas.length;
  const pres = presupuesto(unidad.zona, estado.franja, disp.libres.length);

  /* ── Falla algun dia: se dice cual y se deja decidir ── */
  if (parcial) {
    const aviso = document.createElement("div");
    aviso.className = "hoja-parcial";
    const lineas = [
      `<strong>Libre ${disp.libres.length} de los ${estado.fechas.length} días.</strong>`,
    ];
    // Cada linea solo si tiene contenido: sin esto salia "Ocupado el ."
    // cuando los dias que faltaban eran todos reservas propias
    if (disp.ocupadas.length) {
      lineas.push(
        `<span>Ocupado el ${disp.ocupadas.map(fechaCorta).join(", ")}.</span>`,
      );
    }
    if (disp.mias.length) {
      lineas.push(
        `<span>${disp.mias.length === 1 ? "1 día ya es tuyo" : `${disp.mias.length} días ya son tuyos`}.</span>`,
      );
    }
    aviso.innerHTML = lineas.join("");
    frag.appendChild(aviso);
  }

  frag.appendChild(bloqueImporte(pres, disp.libres));
  if (SON_PROVISIONALES) frag.appendChild(notaProvisional());

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-dark hoja-accion";
  // El boton dice exactamente cuantos dias se van a reservar: nunca se
  // reserva un subconjunto sin decirlo, o el usuario no reconoceria
  // despues lo que acaba de reservar
  btn.innerHTML =
    `${parcial || !unSoloDia() ? `Reservar los ${disp.libres.length} días libres` : "Reservar"} por ${formatear(pres.total)}
    <svg class="ico ico-xs" aria-hidden="true"><use href="#i-arrow-right" /></svg>`;
  btn.addEventListener("click", () => reservar(unidad, disp.libres));
  frag.appendChild(btn);

  if (parcial) frag.appendChild(botonVerLibres());
  return frag;
}

function notaProvisional() {
  const nota = document.createElement("p");
  nota.className = "hoja-provisional";
  nota.textContent = "Precios provisionales, pendientes de confirmar.";
  return nota;
}

/** Cierra la ficha y devuelve al plano, donde el verde ya es la respuesta */
function botonVerLibres() {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn btn-ghost-oscuro hoja-accion";
  btn.textContent = unSoloDia()
    ? "Ver los que están libres"
    : `Ver los libres los ${estado.fechas.length} días`;
  btn.addEventListener("click", () => {
    hoja.cerrar();
    avisar(
      unSoloDia()
        ? "En verde, los sitios libres"
        : `En verde, los que están libres los ${estado.fechas.length} días`,
    );
  });
  return btn;
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

  const grupos = listarGrupos();
  if (!grupos.length) {
    const vacio = document.createElement("p");
    vacio.className = "hoja-meta";
    vacio.textContent = "Todavía no has reservado nada.";
    frag.appendChild(vacio);
    return frag;
  }

  const ul = document.createElement("ul");
  ul.className = "reservas-lista";

  for (const g of grupos) {
    const li = document.createElement("li");
    li.className = "reserva-grupo";

    const info = document.createElement("div");
    const cuando =
      g.dias.length === 1
        ? fechaCorta(g.dias[0].fecha)
        : `${g.dias.length} días · ${fechaCorta(g.dias[0].fecha)} – ${fechaCorta(g.dias.at(-1).fecha)}`;

    /* El importe se recalcula sobre los dias que quedan hoy, en vez de
       sumar lo guardado en cada fila. Al quitar un dia de diez se pasa de
       nueve, y con nueve el tramo ya no es el del 15 % sino el del 10 %:
       sumar los importes viejos ensenaba un total que nadie va a pagar.
       Como todavia no se ha cobrado nada, rehacerlo es solo aritmetica. */
    const actual = presupuesto(g.zona, g.franja, g.dias.length);
    const total = actual ? actual.total : g.total;

    info.innerHTML =
      `<strong>${g.nombre}</strong>` +
      `<span>${cuando} · ${franjaPorId(g.franja).nombre} · ${formatear(total)}</span>`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "reserva-cancelar";
    btn.setAttribute(
      "aria-label",
      g.dias.length === 1 ? `Cancelar ${g.nombre}` : `Cancelar los ${g.dias.length} días de ${g.nombre}`,
    );
    btn.innerHTML = '<svg class="ico" aria-hidden="true"><use href="#i-xmark" /></svg>';
    btn.addEventListener("click", () => {
      cancelarGrupo(g.grupoId);
      hoja.abrir(listaDeReservas());
      refrescar();
      avisar(g.dias.length === 1 ? "Reserva cancelada" : `${g.dias.length} días cancelados`);
    });

    li.append(info, btn);

    /* Los dias sueltos van plegados: una reserva de veinte dias no puede
       ocupar veinte lineas de la hoja, pero cancelar uno solo tiene que
       ser posible sin tirar la reserva entera. */
    if (g.dias.length > 1) {
      const detalles = document.createElement("details");
      detalles.className = "reserva-dias";
      const resumen = document.createElement("summary");
      resumen.textContent = "Ver o quitar días sueltos";
      detalles.appendChild(resumen);

      const sub = document.createElement("ul");
      for (const d of g.dias) {
        const sli = document.createElement("li");
        sli.innerHTML = `<span>${fechaCorta(d.fecha)}</span><span>${formatear(d.importe)}</span>`;
        const quitar = document.createElement("button");
        quitar.type = "button";
        quitar.className = "enlace-sutil";
        quitar.textContent = "Quitar";
        quitar.addEventListener("click", () => {
          cancelarReserva(d.id);
          hoja.abrir(listaDeReservas());
          refrescar();
          // El descuento se recalcula sobre los dias que quedan; mientras
          // no haya cobro esto es solo aritmetica, pero hay que avisarlo
          avisar("Día quitado · el descuento se recalcula al confirmar");
        });
        sli.appendChild(quitar);
        sub.appendChild(sli);
      }
      detalles.appendChild(sub);
      li.appendChild(detalles);
    }

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
