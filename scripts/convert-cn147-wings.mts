/**
 * Converte wings.swf do CN 14.7 (copiados em vestuario-local/cn147/wing/<pic>/) para library.json + shapes/images,
 * o mesmo formato da wing002 (character-effects/wing). Saída: vestuario-local/cn147/wing-lib/<pic>/ (gitignored).
 * Usa o FFDec e o buildLibrary do clone local do Reborn (nada do Reborn é copiado para o git).
 *
 *   REBORN=/var/home/bazzite/Games/ddtank-reborn /var/home/bazzite/Games/ddtank-reborn/node_modules/.bin/tsx scripts/convert-cn147-wings.mts [wing141 ...]
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REBORN = process.env.REBORN ?? '/var/home/bazzite/Games/ddtank-reborn';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'packages/client/public/vestuario-local/cn147');
const OUT = join(BASE, 'wing-lib');
const TMP = join(process.env.TMPDIR ?? '/tmp', 'cn147-wing-convert');
const JAVA = join(REBORN, 'vendor/_tools/jre/bin/java'), FFDEC = join(REBORN, 'vendor/_tools/ffdec/ffdec-cli.jar');
const { buildLibrary } = await import(join(REBORN, 'tools/swf-export/src/library.ts'));
const sharp = (await import(join(REBORN, 'tools/swf-export/node_modules/sharp/lib/index.js'))).default;
const ffdec = (...a: string[]) => execFileSync(JAVA, ['-Xmx1g', '-jar', FFDEC, ...a], { stdio: 'pipe', maxBuffer: 64 << 20 });
const index = (dir: string) => new Map<number, string>(existsSync(dir) ? readdirSync(dir).filter(n => !Number.isNaN(parseInt(n, 10))).map(n => [parseInt(n, 10), n] as [number, string]) : []);
const prefix = (d: string, m: Map<number, string>) => new Map([...m].map(([k, v]) => [k, `${d}/${v}`] as [number, string]));

const wanted = process.argv.slice(2);
const pics = readdirSync(join(BASE, 'wing')).filter(p => (!wanted.length || wanted.includes(p)) && existsSync(join(BASE, 'wing', p, 'wings.swf')));
for (const pic of pics) {
  const swf = join(BASE, 'wing', pic, 'wings.swf'), tmp = join(TMP, pic), out = join(OUT, pic), warns: string[] = [];
  rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });
  ffdec('-swf2xml', swf, join(tmp, 'swf.xml'));
  ffdec('-format', 'shape:png,image:png_gif_jpeg', '-export', 'shape,image', tmp, swf);
  rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true });
  for (const d of ['shapes', 'images']) if (existsSync(join(tmp, d))) cpSync(join(tmp, d), join(out, d), { recursive: true });
  const imagesDir = index(join(tmp, 'images')), sizes = new Map<number, [number, number]>();
  for (const [id, n] of imagesDir) { const m = await sharp(join(tmp, 'images', n)).metadata(); if (m.width && m.height) sizes.set(id, [m.width, m.height]); }
  const imgs = { shapes: prefix('shapes', index(join(tmp, 'shapes'))), images: prefix('images', imagesDir), imageSizes: sizes, sounds: new Map(), binary: new Map(), texts: new Map(), morphs: new Map() };
  const lib = buildLibrary(readFileSync(join(tmp, 'swf.xml'), 'utf8'), `${pic}/wings.swf`, imgs, (m: string) => warns.push(m));
  for (const info of Object.values(lib.classes) as any[]) info.base = 'flash.display.MovieClip';
  writeFileSync(join(out, 'library.json'), JSON.stringify(lib));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`${pic}: ${Object.keys(lib.chars).length} caracteres; classes ${Object.keys(lib.classes).join(', ')}${warns.length ? `; ${warns.length} avisos` : ''}`);
}
