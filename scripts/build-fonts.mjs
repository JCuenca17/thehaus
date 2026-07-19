/**
 * Convierte las fuentes de marca a WOFF2 y baja Inter para auto-hospedarla.
 *
 * Inter se sirve como fuente variable (un solo archivo cubre los pesos 300-700)
 * y solo en el subconjunto latin, que cubre entero el castellano.
 *
 * Uso: npm run fonts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import wawoff from "wawoff2";

const OUT = "fonts";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const GOOGLE = "https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap";

const MARCA = [
  { src: "BDSans-Regular.otf", dst: "bdsans-regular.woff2" },
  { src: "BDSans-Bold.otf", dst: "bdsans-bold.woff2" },
];

const kb = (bytes) => (bytes / 1024).toFixed(1) + " KB";

async function convertirMarca() {
  for (const { src, dst } of MARCA) {
    const entrada = await readFile(src);
    const salida = Buffer.from(await wawoff.compress(entrada));
    await writeFile(path.join(OUT, dst), salida);

    const ahorro = (100 - (salida.length / entrada.length) * 100).toFixed(0);
    console.log(`  ${src}  ${kb(entrada.length)} → ${kb(salida.length)}  (-${ahorro}%)`);
  }
}

async function bajarInter() {
  // El UA moderno hace que Google devuelva WOFF2 en vez de TTF.
  const css = await (await fetch(GOOGLE, { headers: { "User-Agent": UA } })).text();

  const bloque = css.split("/*").find((b) => b.trim().startsWith("latin */"));
  if (!bloque) throw new Error("Google Fonts cambió el formato del CSS: no se halló el bloque latin");

  const url = bloque.match(/url\((https:[^)]+)\)/)[1];
  const rango = bloque.match(/unicode-range:\s*([^;]+);/)[1].trim();

  const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
  await writeFile(path.join(OUT, "inter-latin-var.woff2"), buf);

  console.log(`  inter-latin-var.woff2  ${kb(buf.length)}  (variable 300-700)`);
  console.log(`\n  unicode-range para el CSS:\n  ${rango}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("Generando fuentes\n");
  await convertirMarca();
  await bajarInter();
  console.log("\nListo.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
