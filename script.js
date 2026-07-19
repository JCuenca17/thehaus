/* ─── NAVBAR SCROLL ─── */
const nav = document.getElementById("nav");
window.addEventListener(
  "scroll",
  () => {
    nav.classList.toggle("scrolled", window.scrollY > 60);
  },
  { passive: true },
);

/* ─── HAMBURGER / MOBILE MENU ─── */
const hamburger = document.getElementById("hamburger");
const mobileMenu = document.getElementById("mobileMenu");
let menuOpen = false;

function closeMobileMenu() {
  menuOpen = false;
  hamburger.classList.remove("open");
  mobileMenu.classList.remove("open");
  document.body.style.overflow = "";
}

hamburger.addEventListener("click", () => {
  menuOpen = !menuOpen;
  hamburger.classList.toggle("open", menuOpen);
  mobileMenu.classList.toggle("open", menuOpen);
  document.body.style.overflow = menuOpen ? "hidden" : "";
});

/* ─── HERO PARALLAX ─── */
const heroBg = document.getElementById("heroBg");
let parallaxPendiente = false;

window.addEventListener(
  "scroll",
  () => {
    // Un solo write por frame en lugar de uno por evento de scroll
    if (parallaxPendiente) return;
    parallaxPendiente = true;

    requestAnimationFrame(() => {
      parallaxPendiente = false;
      if (window.scrollY < window.innerHeight) {
        heroBg.style.transform = `scale(1) translateY(${window.scrollY * 0.28}px)`;
      }
    });
  },
  { passive: true },
);

/* ─── WORD CYCLING ─── */
const cycleEl = document.getElementById("heroCycle");
const words = ["tu proyecto.", "tu visión.", "tu empresa.", "tu futuro."];
let wi = 0;

function cycleWord() {
  // Exit animation
  cycleEl.style.transition =
    "opacity 0.35s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)";
  cycleEl.style.opacity = "0";
  cycleEl.style.transform = "translateY(-14px)";

  setTimeout(() => {
    wi = (wi + 1) % words.length;
    cycleEl.textContent = words[wi];
    // Prepare entrance position
    cycleEl.style.transition = "none";
    cycleEl.style.transform = "translateY(18px)";
    cycleEl.style.opacity = "0";
    // Force reflow
    void cycleEl.offsetWidth;
    // Entrance animation
    cycleEl.style.transition =
      "opacity 0.45s ease, transform 0.5s cubic-bezier(0.16,1,0.3,1)";
    cycleEl.style.opacity = "1";
    cycleEl.style.transform = "translateY(0)";
  }, 380);
}

setTimeout(() => {
  setInterval(cycleWord, 2800);
}, 2000);

/* ─── INTERSECTION OBSERVER — REVEAL ─── */
const revealEls = document.querySelectorAll(".reveal, .reveal-scale");
const revealObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        revealObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
);

revealEls.forEach((el) => revealObs.observe(el));

/* ─── COUNTER ANIMATION ─── */
function animateCounter(el) {
  const target = parseInt(el.dataset.count, 10);
  const duration = 1400;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

const counterEls = document.querySelectorAll(".counter");
const counterObs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        counterObs.unobserve(e.target);
      }
    });
  },
  { threshold: 0.5 },
);

counterEls.forEach((el) => {
  el.textContent = "0";
  counterObs.observe(el);
});

/* ─── SMOOTH SCROLL FOR NAV LINKS ─── */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (id === "#") return;
    const target = document.querySelector(id);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});

/* ─── TEASER DEL MAPA ─── */
/* El modulo del mapa no entra en la carga inicial: se importa cuando el
   usuario se acerca a la seccion, y el simulador solo late mientras esta
   a la vista. */
const mapaTeaser = document.getElementById("mapaTeaser");

if (mapaTeaser) {
  const quietud = window.matchMedia("(prefers-reduced-motion: reduce)");
  const listaZonas = document.getElementById("mapaZonas");

  let simulador = null;
  let refresco = null;

  /* Simulador y refresco de cifras van juntos: ninguno de los dos sigue
     corriendo cuando la seccion no esta a la vista. */
  const arrancar = (mapa) => {
    if (refresco) return;
    simulador.iniciar();
    refresco = setInterval(() => pintarZonas(mapa), 1200);
  };

  const parar = () => {
    simulador?.detener();
    clearInterval(refresco);
    refresco = null;
  };

  const pintarZonas = (mapa) => {
    if (!listaZonas) return;
    listaZonas.hidden = false;
    listaZonas.replaceChildren(
      ...mapa.resumenPorZona().map((z) => {
        // Las zonas de un solo espacio no se cuentan, se describen
        const cifra =
          z.total === 1
            ? `<strong>${z.libres ? "Libre" : "Ocupado"}</strong>`
            : `<strong>${z.libres}</strong> de ${z.total} libres`;

        const li = document.createElement("li");
        li.dataset.libre = z.libres ? "si" : "no";
        li.innerHTML =
          `<span class="zona-nombre">${z.nombre}</span>` +
          `<span class="zona-cifra">${cifra}</span>`;
        return li;
      }),
    );
  };

  /* Sin WebGL no hay escena 3D: moviles viejos, navegadores con la
     aceleracion desactivada o maquinas en modo seguro. Se comprueba antes
     de descargar three.js para no gastar 180 KB en balde. */
  const hayWebGL = () => {
    try {
      const prueba = document.createElement("canvas");
      return !!(prueba.getContext("webgl2") || prueba.getContext("webgl"));
    } catch {
      return false;
    }
  };

  const montar = async () => {
    const { crearSimulador } = await import("./js/mapa.js");

    /* El teaser usa la misma escena que /app. Se carga solo al llegar a
       esta seccion, que esta muy por debajo del pliegue, asi que no toca
       el LCP; quien no baja hasta aqui no descarga three.js. */
    let mapa;
    if (hayWebGL()) {
      const { crearEscena } = await import("./js/escena3d.js");
      mapaTeaser.replaceChildren(); // fuera el "Cargando plano…"
      // Sin alSeleccionar: desde la landing se mira, no se reserva
      mapa = crearEscena(mapaTeaser, {});
    } else {
      const { renderizarMapa } = await import("./js/mapa.js");
      mapa = renderizarMapa(mapaTeaser, { interactivo: false });
    }
    simulador = crearSimulador(mapa, { intervalo: 2600, ritmo: 2 });

    if (quietud.matches) {
      // Con movimiento reducido el plano se siembra una vez y se queda quieto
      simulador.iniciar();
      simulador.detener();
      pintarZonas(mapa);
      return;
    }

    new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.isIntersecting ? arrancar(mapa) : parar();
      },
      { threshold: 0.08 },
    ).observe(mapaTeaser);

    pintarZonas(mapa);
  };

  const observadorCarga = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observadorCarga.disconnect();
      montar().catch(() => {
        mapaTeaser.innerHTML =
          '<p class="mapa-espera">No se pudo cargar el plano.</p>';
      });
    },
    { rootMargin: "300px 0px" },
  );

  observadorCarga.observe(mapaTeaser);
}
