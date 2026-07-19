/**
 * Iconos de la PWA a partir del monograma "th".
 *
 * El monograma es tipografia de marca convertida a trazos (BDSans Bold),
 * no una fuente cargada en tiempo de render: asi el icono se ve igual en
 * cualquier maquina que regenere los PNG.
 *
 * Genera dos familias:
 *  - normal    : el monograma ocupa casi todo el lienzo
 *  - maskable  : mas margen, porque Android recorta el icono en circulo,
 *                cuadrado o gota segun el lanzador
 *
 * Uso: npm run pwa-icons
 */
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const FONDO = "#0c0c0c";
const OUT = "icons";

/** Proporcion del lienzo que ocupa el monograma */
const OCUPACION = { normal: 0.62, maskable: 0.44 };

const TAMANOS = [
  { archivo: "icono-192.png", lado: 192, modo: "normal" },
  { archivo: "icono-512.png", lado: 512, modo: "normal" },
  { archivo: "icono-maskable-512.png", lado: 512, modo: "maskable" },
  { archivo: "apple-touch-icon.png", lado: 180, modo: "normal" },
];

async function main() {
  const monograma = await readFile(`${OUT}/monograma.svg`, "utf8");

  // El viewBox reserva sitio para el descendente, que "th" no usa. Sin
  // recortar, el monograma queda visiblemente bajo dentro del icono.
  const recortado = await sharp(Buffer.from(monograma), { density: 600 })
    .trim()
    .png()
    .toBuffer();
  const { width: anchoReal, height: altoReal } = await sharp(recortado).metadata();
  const proporcion = anchoReal / altoReal;

  for (const { archivo, lado, modo } of TAMANOS) {
    const anchoMarca = Math.round(lado * OCUPACION[modo]);
    const altoMarca = Math.round(anchoMarca / proporcion);

    const marca = await sharp(recortado)
      .resize(anchoMarca, altoMarca, { fit: "fill" })
      .png()
      .toBuffer();

    await sharp({
      create: { width: lado, height: lado, channels: 4, background: FONDO },
    })
      .composite([{ input: marca, gravity: "center" }])
      .png({ compressionLevel: 9 })
      .toFile(`${OUT}/${archivo}`);

    console.log(`  ${archivo}  ${lado}×${lado}  (${modo})`);
  }

  // Favicon del sitio: el mismo monograma, en el tamano que pide el navegador
  await writeFile(
    `${OUT}/favicon.svg`,
    monograma.replace(
      "<g transform",
      `<rect width="100%" height="100%" fill="${FONDO}"/><g transform`,
    ),
  );
  console.log("  favicon.svg");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
