/**
 * ⚠️ TARIFAS PROVISIONALES ⚠️
 *
 * Cifras de referencia para poder cerrar el flujo de reserva; NO son
 * precios acordados. Todo el importe que se muestra en la aplicacion sale
 * de este archivo: para poner los definitivos basta cambiar estos numeros.
 *
 * Importes en soles, por unidad y franja.
 */

export const MONEDA = "S/";
export const SON_PROVISIONALES = true;

export const FRANJAS = [
  { id: "manana", nombre: "Mañana", horario: "8:00 – 13:00" },
  { id: "tarde", nombre: "Tarde", horario: "13:00 – 18:00" },
  { id: "completo", nombre: "Día completo", horario: "8:00 – 18:00" },
];

const TARIFAS = {
  coworking: { manana: 25, tarde: 25, completo: 40 },
  lounge: { manana: 18, tarde: 18, completo: 30 },
  oficinas: { manana: 120, tarde: 120, completo: 200 },
  juntas: { manana: 150, tarde: 150, completo: 260 },
  auditorio: { manana: 300, tarde: 300, completo: 500 },
};

export const precioDe = (zonaId, franjaId) => TARIFAS[zonaId]?.[franjaId] ?? null;

export const formatear = (importe) =>
  importe == null ? "—" : `${MONEDA} ${importe.toFixed(2)}`;

export const franjaPorId = (id) => FRANJAS.find((f) => f.id === id);
