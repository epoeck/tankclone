import { readFileSync } from "node:fs";
import { TABLE_PHYSICS, fitPhysics, requiredPower, samplesFromTables } from "../src/index";

const file = process.argv[2] ?? new URL("../calibration/ddtank-tables.json", import.meta.url).pathname;
const raw = JSON.parse(readFileSync(file, "utf8")) as { unitPx: number; tables: Record<string, number[]> };
const samples = samplesFromTables(raw.tables, raw.unitPx);

const fit = fitPhysics(samples, TABLE_PHYSICS);
console.log(`unitPx=${raw.unitPx}  amostras=${samples.length}`);
console.log(`speedPerPower: ${fit.cfg.speedPerPower.toFixed(4)}`);
console.log(`drag:          ${fit.cfg.drag.toFixed(4)}`);
console.log(`muzzleHeight:  ${fit.muzzleHeight.toFixed(2)} px`);
console.log(`gravity:       ${fit.cfg.gravity.toFixed(2)}   RMS relativo: ${(Math.sqrt(fit.loss / samples.length) * 100).toFixed(2)}%\n`);

console.log("Erro em PONTOS DE FORÇA (modelo − tabela) para cada distância 1..20:");
for (const a of Object.keys(raw.tables)) {
  const errs = raw.tables[a]!.map((p, i) => (requiredPower(+a, (i + 1) * raw.unitPx, fit.cfg, fit.muzzleHeight) ?? NaN) - p);
  const maxAbs = Math.max(...errs.map(Math.abs));
  console.log(`${a.padStart(2)}°  máx ${maxAbs.toFixed(2)} | ` + errs.map(e => e.toFixed(1)).join(" "));
}
