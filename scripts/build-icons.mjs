/**
 * Arma el sprite SVG con los unicos iconos que la landing usa de verdad.
 *
 * Sustituye a la hoja completa de Font Awesome: eran 19 KB de CSS bloqueante
 * mas una webfont, para pintar catorce iconos.
 *
 * El sprite se pega a mano dentro del <body> de index.html; los iconos
 * cambian una vez al año, no hace falta automatizar el pegado.
 *
 * Uso: npm run icons
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const PAQUETE = "@fortawesome/fontawesome-free";
const BASE = path.join(path.dirname(require.resolve(`${PAQUETE}/package.json`)), "svgs");
const VERSION = require(`${PAQUETE}/package.json`).version;

const ICONOS = [
  ["solid", "users"],
  ["solid", "layer-group"],
  ["solid", "expand"],
  ["solid", "clock"],
  ["solid", "bolt"],
  ["solid", "mug-hot"],
  ["solid", "handshake"],
  ["solid", "shield-halved"],
  ["solid", "arrow-right"],
  ["solid", "location-dot"],
  ["brands", "whatsapp"],
  ["brands", "instagram"],
  ["brands", "tiktok"],
  ["brands", "linkedin-in"],
];

async function traer(estilo, nombre) {
  const svg = await readFile(path.join(BASE, estilo, `${nombre}.svg`), "utf8");

  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  const trazado = svg.match(/<path[^>]*\bd="([^"]+)"/)?.[1];
  if (!viewBox || !trazado) throw new Error(`${nombre}: no se pudo extraer el trazado`);

  return `  <symbol id="i-${nombre}" viewBox="${viewBox}"><path d="${trazado}"/></symbol>`;
}

async function main() {
  const simbolos = [];
  for (const [estilo, nombre] of ICONOS) {
    simbolos.push(await traer(estilo, nombre));
    console.log(`  ${nombre}`);
  }

  const sprite = [
    `<!-- Iconos de Font Awesome Free ${VERSION}, CC BY 4.0 — fontawesome.com -->`,
    '<svg class="sprite" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">',
    simbolos.join("\n"),
    "</svg>",
  ].join("\n");

  await writeFile("scripts/icons-sprite.html", sprite + "\n");
  console.log(`\n${(sprite.length / 1024).toFixed(1)} KB → scripts/icons-sprite.html`);
  console.log("Pegalo dentro del <body> de index.html.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
