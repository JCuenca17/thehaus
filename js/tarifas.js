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

/**
 * Descuento por volumen. Ordenados de mayor a menor para que baste con
 * quedarse con el primero que se alcanza.
 *
 * Cuando exista backend estos tramos viven en base de datos, no aqui: son
 * una decision comercial y cambiarlos no deberia requerir un despliegue.
 */
export const TRAMOS = [
  { desde: 20, descuento: 0.25 },
  { desde: 10, descuento: 0.15 },
  { desde: 5, descuento: 0.1 },
];

export const descuentoPor = (dias) => TRAMOS.find((t) => dias >= t.desde)?.descuento ?? 0;

/** El siguiente tramo, para poder decir "2 días más y baja un 15 %" */
export function proximoTramo(dias) {
  const siguiente = [...TRAMOS].reverse().find((t) => t.desde > dias);
  return siguiente ? { ...siguiente, faltan: siguiente.desde - dias } : null;
}

/**
 * Importe de una reserva de varios dias. Devuelve tambien el desglose
 * porque la ficha tiene que poder ensenar de donde sale el numero: un
 * total sin explicacion en una pantalla de pago no se lo cree nadie.
 *
 * `porDia` es lo que se guarda en cada fila, con el descuento ya repartido.
 * Se reparte el redondeo en el ultimo dia para que la suma de las filas
 * cuadre exactamente con el total; si no, sale un centimo de diferencia y
 * no hay forma de explicarlo.
 */
export function presupuesto(zonaId, franjaId, dias) {
  const base = precioDe(zonaId, franjaId);
  if (base == null || dias < 1) return null;

  const descuento = descuentoPor(dias);
  const bruto = base * dias;
  const total = Math.round(bruto * (1 - descuento) * 100) / 100;

  const porDia = Math.floor((total / dias) * 100) / 100;
  const ultimo = Math.round((total - porDia * (dias - 1)) * 100) / 100;

  return { base, dias, descuento, bruto, total, ahorro: Math.round((bruto - total) * 100) / 100, porDia, ultimo };
}

export const porcentaje = (fraccion) => `${Math.round(fraccion * 100)} %`;

export const formatear = (importe) =>
  importe == null ? "—" : `${MONEDA} ${importe.toFixed(2)}`;

export const franjaPorId = (id) => FRANJAS.find((f) => f.id === id);
