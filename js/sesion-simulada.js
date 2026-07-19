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

const CLAVE = "thehaus.sesion.demo.v1";

/** Se avisa a la interfaz en vez de que ande consultando si hay sesion */
const oyentes = new Set();

function leer() {
  try {
    const guardada = JSON.parse(localStorage.getItem(CLAVE));
    return guardada?.nombre ? guardada : null;
  } catch {
    // Almacenamiento corrupto o bloqueado: se opera sin sesion
    return null;
  }
}

function escribir(sesion) {
  try {
    if (sesion) localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Modo privado o almacenamiento lleno: la sesion durara lo que la pagina
  }
  for (const oyente of oyentes) oyente(sesion);
  return sesion;
}

/* ─── API ─── */

export const obtenerSesion = () => leer();
export const haySesion = () => leer() !== null;

/**
 * Alta de cuenta. Devuelve {ok, sesion} o {ok: false, motivo}, la misma
 * forma que tendra la llamada real, para que la interfaz no cambie.
 */
export function registrar({ nombre, contacto }) {
  if (!nombreValido(nombre)) return { ok: false, motivo: "nombre" };
  if (!contactoValido(contacto)) return { ok: false, motivo: "contacto" };

  return {
    ok: true,
    sesion: escribir({
      // El id imita al uuid que devolvera Supabase, para que nada dependa
      // de su formato mas adelante
      id: `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      nombre: nombre.trim(),
      contacto: contacto.trim(),
      desde: new Date().toISOString(),
      simulada: true,
    }),
  };
}

/**
 * "Entrar" con una cuenta ya creada en este navegador. Sin servidor no hay
 * censo de usuarios: si los datos guardados no coinciden, se rechaza, y si
 * no hay ninguno se manda a registrarse. Es teatro, pero es el mismo teatro
 * que vera el usuario cuando sea de verdad.
 */
export function iniciarSesion({ contacto }) {
  const guardada = leer();
  if (!guardada) return { ok: false, motivo: "sin-cuenta" };
  if (guardada.contacto !== contacto.trim()) return { ok: false, motivo: "no-coincide" };
  return { ok: true, sesion: guardada };
}

export const cerrarSesion = () => escribir(null);

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
  "sin-cuenta": "Todavía no hay ninguna cuenta en este navegador.",
  "no-coincide": "Esos datos no coinciden con la cuenta guardada.",
};
