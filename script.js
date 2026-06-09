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
window.addEventListener(
  "scroll",
  () => {
    if (window.scrollY < window.innerHeight) {
      heroBg.style.transform = `scale(1) translateY(${window.scrollY * 0.28}px)`;
    }
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
