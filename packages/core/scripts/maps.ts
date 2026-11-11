/**
 * Ferramenta de mapas.
 *   npm run maps:generate -w @tankclone/core   gera os 5 mapas provisórios (só os que ainda não existem; --force sobrescreve)
 *   npm run maps:build    -w @tankclone/core   valida cada mapa (arte + máscara + manifesto) e assa mask.bin + index.json
 * Pasta dos mapas: packages/client/public/maps/<id>/  (manifest.json, art.png, mask.png, mask.bin). Ver docs/mapas.md.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { analyzeMask, classifyPixel, encodeStates, type MapManifest } from "../src/maps";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(process.env.MAPS_DIR ?? join(here, "../../client/public/maps"));
const W = 2400, H = 600;
const AIR = 0, DEST = 1, STEEL = 2;

// ---------- pintura de estados ----------
class Canvas {
  s = new Uint8Array(W * H);
  rect(x0: number, y0: number, x1: number, y1: number, v: number) { for (let y = Math.max(0, y0); y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) this.s[y * W + x] = v; }
  height(fn: (x: number) => number, v: number, x0 = 0, x1 = W, bottom = H) { for (let x = x0; x < x1; x++) for (let y = Math.max(0, Math.ceil(fn(x))); y < bottom; y++) this.s[y * W + x] = v; }
  ellipse(cx: number, cy: number, rx: number, ry: number, v: number, onlyLower = false) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (x < 0 || x >= W || y < 0 || y >= H) continue;
      if (onlyLower && y < cy) continue;
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.s[y * W + x] = v;
    }
  }
}

interface Gen { id: string; name: string; spawns: MapManifest["spawns"]; windMultiplier?: number; paint(c: Canvas): void }
const mirror = (xs: number[]) => xs.map(x => W - x);

const GENS: Gen[] = [
  { id: "colinas", name: "Colinas de Latão", spawns: { "1": [180, 330, 480, 630], "2": mirror([180, 330, 480, 630]) },
    paint: c => c.height(x => 410 + Math.sin(x / 150) * 45 + Math.sin(x / 47) * 9, DEST) },
  { id: "ferro", name: "Pátio de Ferro", spawns: { "1": [180, 330, 480, 630], "2": mirror([180, 330, 480, 630]) },
    paint: c => { c.height(x => 450 + Math.sin(x / 220) * 25, DEST); c.rect(0, 545, W, H, STEEL); c.rect(760, 392, 960, 416, STEEL); c.rect(W - 960, 392, W - 760, 416, STEEL); c.rect(W / 2 - 30, 330, W / 2 + 30, 545, STEEL); } },
  { id: "ilhas", name: "Ilhas Flutuantes", spawns: { "1": [150, 260, 370, 480], "2": mirror([150, 260, 370, 480]) },
    paint: c => { for (const [cx, w, top] of [[300, 230, 400], [760, 200, 470], [1200, 170, 360], [W - 760, 200, 470], [W - 300, 230, 400]] as const) { c.ellipse(cx, top, w, 22, DEST); c.ellipse(cx, top, w * 0.85, 110, DEST, true); } } },
  { id: "forja", name: "Forja Vulcânica", spawns: { "1": [180, 330, 480, 630], "2": mirror([180, 330, 480, 630]) }, windMultiplier: 1.2,
    paint: c => { c.rect(0, 560, W, H, STEEL); c.rect(1050, 560, 1350, H, AIR); c.height(x => 480 + Math.sin(x / 120) * 30, DEST, 0, 1050, 560); c.height(x => 480 + Math.sin(x / 120) * 30, DEST, 1350, W, 560); c.rect(1170, 300, 1230, 560, STEEL); } },
  { id: "nuvens", name: "Torres de Nuvem", spawns: { "1": [160, 330, 500, 670], "2": mirror([160, 330, 500, 670]) },
    paint: c => { c.rect(0, 575, W, H, DEST); let x = 40, i = 0; while (x + 150 < W - 40) { const top = 320 + ((i * 53) % 150); c.rect(x, top, x + 150, 575, DEST); x += 210; i++; } } },
];

// ---------- arte provisória a partir da máscara ----------
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) & 255) / 255; };
function artFrom(states: Uint8Array): PNG {
  const png = new PNG({ width: W, height: H });
  for (let x = 0; x < W; x++) {
    let depth = 0;
    for (let y = 0; y < H; y++) {
      const i = y * W + x, s = states[i]!, o = i * 4;
      if (s === AIR) { depth = 0; continue; }
      const n = hash(x, y) * 14;
      let r: number, g: number, b: number;
      if (s === STEEL) { const base = 120 + (depth < 4 ? 40 : 0) - Math.min(depth, 60) * 0.5; r = base + n; g = base + 8 + n; b = base + 22 + n; if (x % 40 < 3 && depth > 4) { r -= 25; g -= 25; b -= 25; } }
      else if (depth < 7) { r = 96 + n; g = 150 + n; b = 66 + n; } else { const d = Math.min(depth, 120); r = 134 - d * 0.35 + n; g = 98 - d * 0.3 + n; b = 62 - d * 0.2 + n; }
      png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255;
      depth++;
    }
  }
  return png;
}

function maskPng(states: Uint8Array): PNG {
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < states.length; i++) {
    const s = states[i]!, o = i * 4;
    png.data[o] = s === AIR ? 0 : 255; png.data[o + 1] = s === STEEL ? 0 : s === DEST ? 255 : 0; png.data[o + 2] = s === STEEL ? 0 : s === DEST ? 255 : 0; png.data[o + 3] = 255;
  }
  return png;
}

function generate(force: boolean) {
  for (const g of GENS) {
    const dir = join(OUT, g.id);
    if (existsSync(join(dir, "manifest.json")) && !force) { console.log(`= ${g.id}: já existe (use --force para sobrescrever)`); continue; }
    mkdirSync(dir, { recursive: true });
    const c = new Canvas(); g.paint(c);
    writeFileSync(join(dir, "mask.png"), PNG.sync.write(maskPng(c.s)));
    writeFileSync(join(dir, "art.png"), PNG.sync.write(artFrom(c.s)));
    const m: MapManifest = { id: g.id, name: g.name, width: W, height: H, art: "art.png", mask: "mask.png", spawns: g.spawns, ...(g.windMultiplier ? { windMultiplier: g.windMultiplier } : {}) };
    writeFileSync(join(dir, "manifest.json"), JSON.stringify(m, null, 2) + "\n");
    console.log(`+ ${g.id}: gerado`);
  }
}

function build(): boolean {
  const ids: string[] = [];
  let failed = false;
  for (const id of readdirSync(OUT, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()) {
    const dir = join(OUT, id), mf = join(dir, "manifest.json");
    if (!existsSync(mf)) continue;
    const m = JSON.parse(readFileSync(mf, "utf8")) as MapManifest;
    if (m.id !== id) { console.error(`✗ ${id}: id do manifesto (${m.id}) difere da pasta`); failed = true; continue; }
    const mask = PNG.sync.read(readFileSync(join(dir, m.mask))), art = PNG.sync.read(readFileSync(join(dir, m.art)));
    const manifest = { ...m, width: mask.width, height: mask.height };
    const rep = analyzeMask(manifest, mask.data, { width: art.width, height: art.height });
    const tag = rep.errors.length ? "✗" : rep.warnings.length ? "!" : "✓";
    console.log(`${tag} ${id} ${mask.width}×${mask.height}  ar ${rep.pct.air.toFixed(1)}% · destrutível ${rep.pct.destructible.toFixed(1)}% · indestrutível ${rep.pct.indestructible.toFixed(1)}%`);
    for (const e of rep.errors) console.error(`    erro: ${e}`);
    for (const w of rep.warnings) console.warn(`    aviso: ${w}`);
    if (rep.errors.length) { failed = true; continue; }
    if (m.width !== mask.width || m.height !== mask.height) console.warn(`    aviso: manifesto dizia ${m.width}×${m.height}; usando o tamanho real da máscara`);
    const states = new Uint8Array(mask.width * mask.height);
    for (let i = 0; i < states.length; i++) states[i] = classifyPixel(mask.data[i * 4]!, mask.data[i * 4 + 1]!, mask.data[i * 4 + 2]!);
    writeFileSync(join(dir, "mask.bin"), encodeStates(states));
    writeFileSync(mf, JSON.stringify(manifest, null, 2) + "\n");
    ids.push(id);
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify({ maps: ids }, null, 2) + "\n");
  console.log(`index.json: ${ids.join(", ")}`);
  return !failed;
}

const cmd = process.argv[2];
if (cmd === "generate") generate(process.argv.includes("--force"));
else if (cmd === "build") { if (!build()) process.exit(1); }
else { console.error("uso: maps.ts generate [--force] | build"); process.exit(2); }
