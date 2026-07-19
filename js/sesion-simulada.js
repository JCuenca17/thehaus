/**
 * Sesion de usuario SIMULADA.
 *
 * ⚠️ ESTO NO AUTENTICA A NADIE. No hay servidor, no hay contrasena y no
 * hay nada que impida a cualquiera decir que es quien quiera. Guarda unos
 * datos en el navegador para que la aplicacion pueda ensayar el flujo real
 * de cuenta: registrarse, entrar, salir y encontrarse la puerta cerrada.
 *
 * Vive en un archivo aparte, y no mezclado con la logica de reservas, para
 * que el dia que entre Supabase se borre este archivo entero en vez de ir
 * buscando codigo falso repartido por ahi. Quien lo sustituya solo tiene
 * que ofrecer las mismas funciones.
 *
 * ─── Cuenta y sesion son dos cosas ───
 *
 * La cuenta son los datos de la persona; la sesion es que ahora mismo esta
 * dentro. Se guardan por separado porque salir no es darse de baja: si
 * cerrar la sesion borrase la cuenta, "Entrar" no podria funcionar nunca y
 * la puerta solo sabria registrar. Distinguirlas cuesta una clave mas y
 * hace que el ensayo se parezca a lo que habra despues.
 *
 * ─── Por que no pide contrasena ───
 *
 * Esto se despliega en una URL publica. Un campo de contrasena ensena a la
 * gente a escribir su contrasena real, y aqui acabaria en localStorage en
 * texto plano: la gente reutiliza contrasenas, asi que el estropicio no se
 * quedaria en este sitio. La contrasena la anade Supabase cuando exista, y
 * la guarda quien sabe hacerlo.
 *
 * Por lo mismo aqui no se pide ni se guarda nada de pago. Eso vive en
 * pagos-simulados.js y tampoco toca datos reales.
 */

const CLAVE_CUENTA = "thehaus.cuenta.demo.v1";
const CLAVE_SESION = "thehaus.sesion.demo.v1";

/** Se avisa a la interfaz en vez de que ande consultando si hay sesion */
const oyentes = new Set();

function leerJSON(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave));
  } catch {
    // Almacenamiento corrupto o bloqueado: se opera como si no hubiera nada
    return null;
  }
}

function escribirJSON(clave, valor) {
  try {
    if (valor) localStorage.setItem(clave, JSON.stringify(valor));
    else localStorage.removeItem(clave);
    return true;
  } catch {
    // Modo privado o almacenamiento lleno: durara lo que dure la pagina
    return false;
  }
}

function avisar() {
  const sesion = obtenerSesion();
  for (const oyente of oyentes) oyente(sesion);
  return sesion;
}

/* ─── Lectura ─── */

/** Los datos de la cuenta, haya sesion abierta o no */
export function cuentaGuardada() {
  const c = leerJSON(CLAVE_CUENTA);
  return c?.nombre ? c : null;
}

export const hayCuenta = () => cuentaGuardada() !== null;

/** La cuenta solo si ademas hay sesion abierta; si no, null */
export function obtenerSesion() {
  const cuenta = cuentaGuardada();
  if (!cuenta) return null;
  return leerJSON(CLAVE_SESION)?.cuentaId === cuenta.id ? cuenta : null;
}

export const haySesion = () => obtenerSesion() !== null;

/* ─── Escritura ─── */

function abrirSesion(cuenta) {
  escribirJSON(CLAVE_SESION, { cuentaId: cuenta.id, desde: new Date().toISOString() });
  return avisar();
}

/**
 * Alta de cuenta. Devuelve {ok, sesion} o {ok: false, motivo}, la misma
 * forma que tendra la llamada real, para que la interfaz no cambie.
 */
export function registrar({ nombre, contacto }) {
  if (!nombreValido(nombre)) return { ok: false, motivo: "nombre" };
  if (!contactoValido(contacto)) return { ok: false, motivo: "contacto" };

  const cuenta = {
    // El id imita al uuid que devolvera Supabase, para que nada dependa
    // de su formato mas adelante
    id: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    nombre: nombre.trim(),
    contacto: contacto.trim(),
    desde: new Date().toISOString(),
    simulada: true,
  };

  if (!escribirJSON(CLAVE_CUENTA, cuenta)) return { ok: false, motivo: "almacenamiento" };
  return { ok: true, sesion: abrirSesion(cuenta) };
}

/**
 * "Entrar" con una cuenta ya creada en este navegador. Sin servidor no hay
 * censo de usuarios: se compara con la unica cuenta guardada aqui. Es
 * teatro, pero es el mismo teatro que vera el usuario cuando sea de verdad.
 */
export function iniciarSesion({ contacto }) {
  const cuenta = cuentaGuardada();
  if (!cuenta) return { ok: false, motivo: "sin-cuenta" };
  if (cuenta.contacto !== (contacto ?? "").trim()) return { ok: false, motivo: "no-coincide" };
  return { ok: true, sesion: abrirSesion(cuenta) };
}

/** Salir conserva la cuenta: salir no es darse de baja */
export function cerrarSesion() {
  escribirJSON(CLAVE_SESION, null);
  return avisar();
}

/** Darse de baja de verdad: se va la cuenta y con ella la sesion */
export function olvidarCuenta() {
  escribirJSON(CLAVE_SESION, null);
  escribirJSON(CLAVE_CUENTA, null);
  return avisar();
}

/** Avisa de cada alta, entrada o salida. Devuelve como dejar de escuchar. */
export function alCambiar(oyente) {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/* ─── Validacion ─── */

export const nombreValido = (valor) => (valor ?? "").trim().length >= 3;

/** Correo o telefono peruano; suficiente para poder contactar */
export function contactoValido(valor) {
  const v = (valor ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) || /^\+?[\d\s-]{9,15}$/.test(v);
}

/** Texto de cada rechazo, en un solo sitio para no repartirlo por la interfaz */
export const MOTIVOS = {
  nombre: "Escribe tu nombre completo.",
  contacto: "Necesitamos un correo o un teléfono para avisarte.",
  almacenamiento: "Este navegador no deja guardar datos. Prueba sin modo privado.",
  "sin-cuenta": "Todavía no hay ninguna cuenta en este navegador.",
  "no-coincide": "Esos datos no coinciden con la cuenta guardada.",
};
