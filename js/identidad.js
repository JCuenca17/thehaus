/**
 * Identidad de quien reserva.
 *
 * ⚠️ ESTO NO ES AUTENTICACION. No hay contraseña, ni verificacion, ni
 * servidor: son unos datos guardados en el navegador para que cada
 * reserva quede a nombre de alguien y se pueda contactar. Cualquiera
 * puede escribir cualquier nombre.
 *
 * La autenticacion de verdad necesita backend. Cuando exista, se
 * sustituye este modulo por el que consulte la sesion y el resto de la
 * aplicacion no cambia: pide identidad y recibe {nombre, contacto}.
 */

const CLAVE = "thehaus.identidad.v1";

export function obtenerIdentidad() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE));
    return guardada?.nombre ? guardada : null;
  } catch {
    return null;
  }
}

export function guardarIdentidad({ nombre, contacto }) {
  const identidad = {
    nombre: nombre.trim(),
    contacto: contacto.trim(),
    desde: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(identidad));
    return identidad;
  } catch {
    return null;
  }
}

export function olvidarIdentidad() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento bloqueado: no hay nada que borrar */
  }
}

/** Correo o telefono peruano; suficiente para poder contactar */
export function contactoValido(valor) {
  const v = valor.trim();
  const esCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  const esTelefono = /^\+?[\d\s-]{9,15}$/.test(v);
  return esCorreo || esTelefono;
}

export const nombreValido = (valor) => valor.trim().length >= 3;
