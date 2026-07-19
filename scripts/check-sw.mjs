/**
 * Comprueba que el service worker precarga todo el codigo que la
 * aplicacion necesita.
 *
 * Existe porque olvidar un modulo en la lista no da ningun error visible:
 * la aplicacion funciona con conexion y solo revienta sin ella, que es
 * justo cuando nadie esta mirando.
 *
 * Uso: npm run check-sw   (falla con codigo 1 si falta algo)
 */
import { readFile, readdir } from "node:fs/promises";

const SW = "app/sw.js";

async function main() {
  const sw = await readFile(SW, "utf8");

  const bloque = sw.match(/const RECURSOS = \[([\s\S]*?)\];/);
  if (!bloque) throw new Error(`No se encontro la lista RECURSOS en ${SW}`);

  const declarados = new Set([...bloque[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

  // Todo lo que el navegador necesita para arrancar sin red
  const necesarios = [
    ...(await readdir("js")).filter((f) => f.endsWith(".js")).map((f) => `/js/${f}`),
    ...(await readdir("app"))
      .filter((f) => /\.(js|css)$/.test(f) && f !== "sw.js")
      .map((f) => `/app/${f}`),
    "/app/",
    "/app/index.html",
    "/style.css",
  ];

  const faltan = necesarios.filter((r) => !declarados.has(r));
  const sobran = [...declarados].filter(
    (r) => /^\/(js|app)\/.+\.(js|css)$/.test(r) && !necesarios.includes(r),
  );

  for (const f of faltan) console.error(`  FALTA en RECURSOS: ${f}`);
  for (const s of sobran) console.error(`  SOBRA en RECURSOS (no existe): ${s}`);

  if (faltan.length || sobran.length) {
    console.error(`\n${faltan.length} ausencias, ${sobran.length} sobrantes.`);
    process.exit(1);
  }

  console.log(`Service worker al dia: ${necesarios.length} recursos comprobados.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
