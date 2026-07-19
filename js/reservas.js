/**
 * Estado de ocupacion y persistencia de reservas.
 *
 * Unico punto del codigo que sabe de donde salen los datos. Hoy son
 * localStorage mas una ocupacion simulada; cuando exista API se
 * reescribe este archivo y ni la UI ni el mapa se enteran.
 *
 * La ocupacion simulada es DETERMINISTA por fecha y franja: al volver a
 * un dia ya visitado se ve exactamente lo mismo. Con valores al azar el
 * mapa cambiaria cada vez y no habria forma de confiar en el.
 */
import { PUESTOS, ESPACIOS } from "./planta.js";

const CLAVE = "thehaus.reservas.v2";
const IDS = [...PUESTOS, ...ESPACIOS].map((u) => u.id);

/**
 * Las reservas de antes de que existieran las cuentas no tienen dueno.
 * Se descartan en vez de atribuirselas a la primera cuenta que se cree:
 * eso haria que alguien abriera la aplicacion y heredase reservas que no
 * hizo, e inventar propiedad sobre unos datos es peor que perder datos de
 * demostracion.
 *
 * Devuelve cuantas se descartaron, para poder avisar una sola vez. Se
 * llama al arrancar; a partir de la segunda vez no hay nada que borrar y
 * devuelve 0.
 */
export function descartarReservasSinCuenta() {
  const CLAVE_VIEJA = "thehaus.reservas.v1";
  try {
    const viejas = JSON.parse(localStorage.getItem(CLAVE_VIEJA));
    if (!Array.isArray(viejas)) return 0;
    localStorage.removeItem(CLAVE_VIEJA);
    localStorage.removeItem("thehaus.identidad.v1"); // la reemplaza la cuenta
    return viejas.length;
  } catch {
    return 0;
  }
}

/* ─── Generador pseudoaleatorio con semilla (mulberry32) ─── */

function semillaDe(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    h = Math.imul(h ^ texto.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function generador(semilla) {
  let a = semilla;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** El lunes de la semana de una fecha, como clave estable de esa semana */
function semanaDe(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Ocupacion base del local para una fecha y franja concretas.
 *
 * La ocupacion se sortea POR SEMANA Y UNIDAD, no por dia suelto: quien
 * coge un escritorio lo coge de lunes a jueves, no los martes alternos.
 * Antes se tiraba una moneda independiente cada dia, y como salia cara un
 * 52 % de las veces, la probabilidad de que algo estuviera libre seis dias
 * seguidos era del 1 %: al pedir mas de tres dias el plano se quedaba sin
 * un solo sitio verde y no habia forma de reservar una temporada larga.
 *
 * Sigue siendo DETERMINISTA: al volver a un dia ya visitado se ve
 * exactamente lo mismo.
 */
function ocupacionSimulada(fecha, franja) {
  const semana = semanaDe(fecha);
  const indice = (new Date(`${fecha}T12:00:00`).getDay() + 6) % 7; // lunes = 0

  const estados = {};
  for (const id of IDS) {
    const azar = generador(semillaDe(`${id}|${semana}|${franja}`));

    // ¿Tiene esta unidad dueno esta semana?
    if (azar() >= 0.42) {
      estados[id] = "libre";
      continue;
    }

    // Si lo tiene, ocupa un tramo seguido de dias laborables; los fines de
    // semana quedan libres solos, sin necesidad de tratarlos aparte
    const inicio = Math.floor(azar() * 5);
    const largo = 1 + Math.floor(azar() * 5);
    estados[id] = indice >= inicio && indice < inicio + largo ? "ocupado" : "libre";
  }
  return estados;
}

/* ─── Persistencia ─── */

function leerTodas() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) ?? [];
  } catch {
    // Almacenamiento corrupto o bloqueado: se opera sin historial
    return [];
  }
}

function guardarTodas(reservas) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(reservas));
    return true;
  } catch {
    return false;
  }
}

/* ─── API publica ─── */

/** El dia completo choca con las dos medias franjas, y viceversa */
const solapan = (a, b) => a === b || a === "completo" || b === "completo";

export const listarReservas = () =>
  leerTodas().sort((a, b) => (a.fecha + a.franja).localeCompare(b.fecha + b.franja));

export function reservasDe(fecha, franja) {
  return leerTodas().filter((r) => r.fecha === fecha && r.franja === franja);
}

/**
 * Estado de cada unidad combinando ocupacion simulada y reservas propias.
 * Lo que el usuario ha reservado se marca "reservado" para distinguirlo
 * de lo que ocupan otros.
 */
export function estadosDe(fecha, franja) {
  const estados = ocupacionSimulada(fecha, franja);

  for (const r of leerTodas()) {
    if (r.fecha !== fecha || !solapan(r.franja, franja)) continue;
    estados[r.unidadId] = r.franja === franja ? "reservado" : "ocupado";
  }
  return estados;
}

export function crearReserva({ unidadId, nombre, zona, fecha, franja, importe, titular, contacto }) {
  const reservas = leerTodas();

  const yaEsta = reservas.some(
    (r) =>
      r.unidadId === unidadId &&
      r.fecha === fecha &&
      (r.franja === franja || r.franja === "completo" || franja === "completo"),
  );
  if (yaEsta) return { ok: false, motivo: "duplicada" };

  const reserva = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    unidadId,
    nombre,
    zona,
    fecha,
    franja,
    importe,
    titular,
    contacto,
    creada: new Date().toISOString(),
  };

  reservas.push(reserva);
  if (!guardarTodas(reservas)) return { ok: false, motivo: "almacenamiento" };
  return { ok: true, reserva };
}

export function cancelarReserva(id) {
  const restantes = leerTodas().filter((r) => r.id !== id);
  return guardarTodas(restantes);
}

/* ─── Varios dias ─── */

/**
 * Que dias de los pedidos sirve esta unidad y cuales no.
 *
 * `mias` son los dias que ya tiene reservados quien pregunta: no estan
 * libres, pero tampoco son un choque con otro, y la ficha lo cuenta
 * distinto ("ya lo tienes" no es "esta ocupado").
 */
export function disponibilidadDe(unidadId, fechas, franja) {
  const propias = leerTodas().filter((r) => r.unidadId === unidadId);
  const ocupacion = new Map(fechas.map((f) => [f, ocupacionSimulada(f, franja)[unidadId]]));

  const libres = [];
  const ocupadas = [];
  const mias = [];

  for (const fecha of fechas) {
    const propia = propias.find((r) => r.fecha === fecha && solapan(r.franja, franja));
    if (propia) mias.push(fecha);
    else if (ocupacion.get(fecha) === "ocupado") ocupadas.push(fecha);
    else libres.push(fecha);
  }
  return { libres, ocupadas, mias, total: fechas.length };
}

/**
 * Estado de cada unidad para un rango de dias.
 *
 * Verde solo si sirve TODOS los dias pedidos: si el plano pintase de verde
 * una unidad que falla el miercoles, la eleccion se haria a ciegas y el
 * choque aparecena al confirmar, que es el peor momento para enterarse.
 */
export function estadosDeRango(fechas, franja) {
  if (fechas.length <= 1) return estadosDe(fechas[0] ?? hoy(), franja);

  const estados = {};
  for (const id of IDS) {
    const { libres, mias } = disponibilidadDe(id, fechas, franja);

    if (libres.length === fechas.length) estados[id] = "libre";
    // Quedan dias por coger: la ficha dira cuales fallan
    else if (libres.length > 0) estados[id] = "parcial";
    // Ya no cabe nada mas aqui. Si algo de esto es suyo se dice "reservado"
    // y no "ocupado": en gris el usuario no encontraria en el plano lo que
    // el mismo tiene cogido, y el gris significa "de otro".
    else if (mias.length > 0) estados[id] = "reservado";
    else estados[id] = "ocupado";
  }
  return estados;
}

/**
 * Una fila por dia, unidas por grupoId. Se mantiene la fila por dia porque
 * la deteccion de choques y el estado del plano funcionan por (unidad,
 * fecha, franja); con un rango guardado como intervalo habria que
 * reescribir esa logica entera.
 *
 * `importes` llega ya calculado por tarifas.js: este modulo no sabe de
 * precios ni de descuentos, solo guarda lo que le dan.
 */
export function crearReservaMultiple({ unidadId, nombre, zona, fechas, franja, importes, titular, contacto, referencia }) {
  if (!fechas.length) return { ok: false, motivo: "sin-dias" };

  const reservas = leerTodas();
  const grupoId = `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const creada = new Date().toISOString();

  // Se revalida aqui aunque la ficha ya lo mirase: entre que se pinto el
  // plano y se pulso el boton pudo cambiar algo en otra pestana
  const choca = fechas.find((fecha) =>
    reservas.some((r) => r.unidadId === unidadId && r.fecha === fecha && solapan(r.franja, franja)),
  );
  if (choca) return { ok: false, motivo: "duplicada", fecha: choca };

  const nuevas = fechas.map((fecha, i) => ({
    id: `r-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
    grupoId,
    unidadId,
    nombre,
    zona,
    fecha,
    franja,
    importe: importes[i],
    titular,
    contacto,
    // Referencia del pago que confirmo la reserva. Con backend sera la de
    // la pasarela real; hoy la de pagos-simulados.js
    referencia,
    creada,
  }));

  if (!guardarTodas([...reservas, ...nuevas])) return { ok: false, motivo: "almacenamiento" };
  return { ok: true, grupoId, reservas: nuevas };
}

/**
 * Las reservas agrupadas por grupoId, para que "Mis reservas" ensene
 * "Escritorio 3 · 5 días" en vez de cinco lineas identicas.
 */
export function listarGrupos() {
  const grupos = new Map();
  for (const r of listarReservas()) {
    // Las reservas de un solo dia no tienen grupoId: cada una es su grupo
    const clave = r.grupoId ?? r.id;
    if (!grupos.has(clave)) {
      grupos.set(clave, { grupoId: clave, unidadId: r.unidadId, nombre: r.nombre, zona: r.zona, franja: r.franja, dias: [], total: 0 });
    }
    const g = grupos.get(clave);
    g.dias.push({ id: r.id, fecha: r.fecha, importe: r.importe });
    g.total = Math.round((g.total + r.importe) * 100) / 100;
  }
  return [...grupos.values()];
}

export function cancelarGrupo(grupoId) {
  const restantes = leerTodas().filter((r) => (r.grupoId ?? r.id) !== grupoId);
  return guardarTodas(restantes);
}

/** Fecha de hoy en formato YYYY-MM-DD, en horario local */
export function hoy() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Los proximos N dias a partir de hoy */
export function proximosDias(n = 7) {
  const dias = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    dias.push({
      valor: `${d.getFullYear()}-${mes}-${dia}`,
      diaSemana: d.toLocaleDateString("es-PE", { weekday: "short" }),
      diaMes: d.getDate(),
      esHoy: i === 0,
    });
  }
  return dias;
}
