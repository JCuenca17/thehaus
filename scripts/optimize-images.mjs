/**
 * Genera las variantes responsive de cada imagen a partir de img/originals.
 *
 * Salida en img/: <nombre>-<ancho>.avif, .webp y un .jpg de fallback.
 * Además imprime el data URI del placeholder del hero para pegarlo en el CSS.
 *
 * Uso: npm run img
 */
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC = "img/originals";
const OUT = "img";

/* El hero es el LCP: necesita más escalones porque cubre toda la pantalla.
   Las zonas viven en un bento de tarjetas, nunca pasan de ~700px reales. */
const PERFILES = {
  hero: { anchos: [640, 960, 1280, 1920, 2560], calidad: { avif: 52, webp: 72 } },
  zona: { anchos: [400, 700, 1000], calidad: { avif: 50, webp: 70 } },
};

const HERO = "inicio";

async function generar(archivo) {
  const nombre = path.parse(archivo).name;
  const perfil = nombre === HERO ? PERFILES.hero : PERFILES.zona;
  const entrada = path.join(SRC, archivo);
  const meta = await sharp(entrada).metadata();

  const saltados = [];

  for (const ancho of perfil.anchos) {
    // No reescalamos hacia arriba: si el original es más chico, se salta.
    if (ancho > meta.width) {
      saltados.push(ancho);
      continue;
    }

    const base = sharp(entrada).resize({ width: ancho, withoutEnlargement: true });

    await base
      .clone()
      .avif({ quality: perfil.calidad.avif, effort: 6 })
      .toFile(path.join(OUT, `${nombre}-${ancho}.avif`));

    await base
      .clone()
      .webp({ quality: perfil.calidad.webp, effort: 5 })
      .toFile(path.join(OUT, `${nombre}-${ancho}.webp`));
  }

  // Fallback JPEG en el ancho intermedio, para navegadores sin AVIF ni WebP.
  const anchoFallback = perfil.anchos[Math.floor(perfil.anchos.length / 2)];
  await sharp(entrada)
    .resize({ width: Math.min(anchoFallback, meta.width), withoutEnlargement: true })
    .jpeg({ quality: 78, mozjpeg: true })
    .toFile(path.join(OUT, `${nombre}-${anchoFallback}.jpg`));

  const generados = perfil.anchos.length - saltados.length;
  console.log(`  ${nombre}  (${meta.width}×${meta.height})  →  ${generados} anchos`);

  if (saltados.length) {
    // El srcset del HTML no debe apuntar a estos: el archivo no existe.
    console.warn(`    ⚠ original muy chico, sin generar: ${saltados.join("w, ")}w`);
  }
}

/* Miniatura borrosa en base64 que ocupa el hueco del hero mientras baja la
   imagen real. Pesa ~1 KB y va incrustada en el CSS, así que no cuesta request. */
async function placeholder(archivo) {
  const buffer = await sharp(path.join(SRC, archivo))
    .resize({ width: 24 })
    .blur(1.2)
    .webp({ quality: 30 })
    .toBuffer();

  return `data:image/webp;base64,${buffer.toString("base64")}`;
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const archivos = (await readdir(SRC)).filter((f) => /\.(jpe?g|png)$/i.test(f));
  if (!archivos.length) {
    console.error(`No hay imágenes en ${SRC}`);
    process.exit(1);
  }

  console.log("Optimizando imágenes\n");
  for (const archivo of archivos) await generar(archivo);

  const lqip = await placeholder(`${HERO}.jpeg`);
  await writeFile(path.join(OUT, "hero-placeholder.txt"), lqip);

  console.log(`\nListo. Placeholder del hero guardado en ${OUT}/hero-placeholder.txt`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
