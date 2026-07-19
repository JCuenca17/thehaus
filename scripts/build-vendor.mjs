/**
 * Copia las dependencias de terceros a vendor/ para servirlas nosotros.
 *
 * El sitio no carga nada de ningun CDN: cada dominio externo es una
 * conexion mas que bloquea el renderizado, un punto de fallo que no
 * controlamos y algo que el service worker no puede cachear con garantias.
 * Se versiona la copia para que un `npm i` no cambie lo desplegado sin que
 * nadie lo note.
 *
 * Uso: npm run vendor
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const ARCHIVOS = [
  // three.module.min.js importa three.core.min.js con ruta relativa, asi
  // que los dos tienen que acabar en la misma carpeta
  "node_modules/three/build/three.module.min.js",
  "node_modules/three/build/three.core.min.js",
];

async function main() {
  await mkdir("vendor", { recursive: true });

  // No se puede pedir por require: three no exporta su package.json
  const version = JSON.parse(await readFile("node_modules/three/package.json", "utf8")).version;
  let total = 0;

  for (const origen of ARCHIVOS) {
    const contenido = await readFile(origen);
    const nombre = origen.split("/").pop();
    await writeFile(`vendor/${nombre}`, contenido);
    total += contenido.length;
    console.log(`  ${nombre.padEnd(24)} ${(contenido.length / 1024).toFixed(0)} KB`);
  }

  console.log(`\nthree.js ${version} copiado a vendor/ (${(total / 1024).toFixed(0)} KB sin comprimir).`);
  console.log("Licencia MIT, incluida en la cabecera de cada archivo.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
