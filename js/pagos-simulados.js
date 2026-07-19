/**
 * Pasarela de pago SIMULADA.
 *
 * ⚠️ AQUI NO SE COBRA NADA Y NO SE TOCA NINGUN DATO DE PAGO. No hay
 * pasarela real, no hay servidor y —a proposito— no hay ningun campo donde
 * escribir un numero de tarjeta.
 *
 * ─── Por que no hay campos de tarjeta, ni siquiera simulados ───
 *
 * Esto se despliega en una URL publica. Un formulario que pida el numero
 * de tarjeta ensena a la gente a escribirlo, y aqui no habria nada que lo
 * cifrase ni que lo cobrase: seria un sitio que recoge tarjetas sin
 * ninguna de las obligaciones de uno que las cobra. El estropicio no se
 * quedaria en esta demostracion, porque una tarjeta sirve en cualquier
 * otra parte.
 *
 * Asi que el resultado del pago no se deduce de unos datos: lo elige quien
 * prueba, con tres botones. Es lo unico que cambia respecto a una pasarela
 * de verdad; todo lo que la rodea —el importe, el estado \"procesando\", la
 * referencia, el que la reserva solo se confirme si el pago se aprueba— es
 * el flujo real, que es justo lo que se quiere ensayar.
 *
 * Vive en un archivo aparte para que el dia que entre una pasarela de
 * verdad se borre entero. Quien lo sustituya solo tiene que devolver un
 * resultado con la misma forma.
 */

export const RESULTADOS = {
  APROBADO: "aprobado",
  RECHAZADO: "rechazado",
  CADUCADO: "caducado",
};

/**
 * Referencia de la operacion. Una pasarela real devuelve una; se imita el
 * formato para que \"Mis reservas\" pueda guardarla desde ya y nada dependa
 * de como sea mas adelante.
 */
export function referenciaPago() {
  const marca = Date.now().toString(36).toUpperCase();
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SIM-${marca}-${azar}`;
}

/**
 * \"Procesa\" el pago: espera un momento —como esperaria una pasarela— y
 * resuelve con el resultado que se le pide. La espera es teatro, pero es el
 * teatro que habra que manejar cuando sea de verdad (botones desactivados,
 * estado \"procesando\", no dejar pulsar dos veces).
 *
 * Devuelve siempre, incluso en rechazo o caducidad: un fallo de pago no es
 * un error del programa, es una respuesta, y el codigo que llama la trata
 * como tal.
 */
export function procesarPago({ resultado, importe }) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        resultado,
        importe,
        referencia: resultado === RESULTADOS.APROBADO ? referenciaPago() : null,
        en: new Date().toISOString(),
      });
    }, 900);
  });
}

/** Que decir cuando el pago no sale, en un solo sitio */
export const MOTIVOS_PAGO = {
  [RESULTADOS.RECHAZADO]: "El pago fue rechazado. Prueba con otro medio o inténtalo de nuevo.",
  [RESULTADOS.CADUCADO]: "La sesión de pago caducó antes de completarse. Vuelve a intentarlo.",
};
