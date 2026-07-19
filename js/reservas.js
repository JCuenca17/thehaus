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

const CLAVE = "thehaus.reservas.v1";
const IDS = [...PUESTOS, ...ESPACIOS].map((u) => u.id);

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

/** Ocupacion base del local para una fecha y franja concretas */
function ocupacionSimulada(fecha, franja) {
  const azar = generador(semillaDe(`${fecha}|${franja}`));

  // Los fines de semana el local esta mucho mas vacio
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  const finDeSemana = dia === 0 || dia === 6;
  const presion = finDeSemana ? 0.18 : 0.52;

  const estados = {};
  for (const id of IDS) estados[id] = azar() < presion ? "ocupado" : "libre";
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

  // El dia completo choca con las dos medias franjas, y viceversa
  const solapan = (a, b) =>
    a === b || a === "completo" || b === "completo";

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
