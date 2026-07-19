/**
 * Bottom Sheet.
 *
 * Se arrastra hacia abajo para cerrar, responde a Escape y devuelve el
 * foco a donde estaba. Mientras esta abierta el fondo no hace scroll.
 */

export function crearHoja(elemento) {
  const panel = elemento.querySelector(".hoja-panel");
  const velo = elemento.querySelector(".hoja-velo");
  const cuerpo = elemento.querySelector(".hoja-cuerpo");
  const tirador = elemento.querySelector(".hoja-tirador");

  let abierta = false;
  let focoPrevio = null;
  let arrastre = null;

  const cerrar = () => {
    if (!abierta) return;
    abierta = false;
    elemento.classList.remove("abierta");
    elemento.setAttribute("aria-hidden", "true");
    panel.style.removeProperty("--arrastre");
    document.body.style.overflow = "";
    focoPrevio?.focus?.();
  };

  const abrir = (contenido) => {
    focoPrevio = document.activeElement;
    cuerpo.replaceChildren(contenido);

    abierta = true;
    elemento.classList.add("abierta");
    elemento.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Al primer control util, no al panel entero
    const foco = cuerpo.querySelector("button, [href], input, select");
    (foco ?? panel).focus({ preventScroll: true });
  };

  velo.addEventListener("click", cerrar);
  elemento.querySelector(".hoja-cerrar")?.addEventListener("click", cerrar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && abierta) cerrar();
  });

  /* Arrastre para descartar: solo hacia abajo y solo desde el tirador o
     la cabecera, para no robarle el gesto al scroll del contenido. */
  const inicio = (e) => {
    arrastre = { y0: e.touches?.[0]?.clientY ?? e.clientY, dy: 0 };
    panel.style.transition = "none";
  };

  const mover = (e) => {
    if (!arrastre) return;
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    arrastre.dy = Math.max(0, y - arrastre.y0);
    panel.style.setProperty("--arrastre", `${arrastre.dy}px`);
  };

  const soltar = () => {
    if (!arrastre) return;
    panel.style.transition = "";
    // Un tercio de la altura del panel es umbral suficiente
    if (arrastre.dy > panel.offsetHeight / 3) cerrar();
    else panel.style.removeProperty("--arrastre");
    arrastre = null;
  };

  for (const asa of [tirador, elemento.querySelector(".hoja-cabecera")].filter(Boolean)) {
    asa.addEventListener("pointerdown", inicio);
  }
  document.addEventListener("pointermove", mover);
  document.addEventListener("pointerup", soltar);
  document.addEventListener("pointercancel", soltar);

  return { abrir, cerrar, estaAbierta: () => abierta };
}
