import { FLY_BALL_ID, WEAPONS } from "@tankclone/core";
/** Bibliotecas convertidas dos SWFs do cliente de referência; ver docs/projeteis.md. */
type Place = { d?: number; id?: number; m?: number[]; mv?: number; rm?: number; ct?: number[] };
type Character = { k: string; img?: string; r?: number[]; tl?: { n: number; f: Place[][] } };
type Library = { frameRate: number; chars: Record<string, Character>; classes: Record<string, { id: number }> };
type Loaded = { lib: Library; images: Map<string, HTMLImageElement> };
// ids das bolas vêm da ficha de cada arma (core/data.ts)
const ids: Record<string, [number, number]> = { ...Object.fromEntries(Object.values(WEAPONS).map(w => [w.id, [w.ballId, w.special.ballId]])), fly: [FLY_BALL_ID, FLY_BALL_ID] };
const libraries = new Map<string, Loaded | null>();
function library(name: string): Loaded | null {
  if (!libraries.has(name)) {
    libraries.set(name, null);
    void fetch(`/projectiles/${name}/library.json`).then(r => { if (!r.ok) throw Error('library'); return r.json() as Promise<Library>; }).then(lib => {
      const images = new Map<string, HTMLImageElement>();
      for (const c of Object.values(lib.chars)) if (c.k === 'shape' && c.img && !images.has(c.img)) {
        const img = new Image(); img.src = `/projectiles/${name}/${c.img}`; images.set(c.img, img);
      }
      libraries.set(name, { lib, images });
    }).catch(() => { /* fallback do chamador */ });
  }
  return libraries.get(name) ?? null;
}
function drawChar(ctx: CanvasRenderingContext2D, asset: Loaded, id: number, frame: number, loop: boolean, depth = 0): boolean {
  const c = asset.lib.chars[id]; if (!c || depth > 8) return false;
  if (c.k === 'shape' && c.img && c.r) {
    const img = asset.images.get(c.img); if (!img?.complete || !img.naturalWidth) return false;
    ctx.drawImage(img, c.r[0]!, c.r[1]!, c.r[2]!, c.r[3]!); return true;
  }
  if (c.k !== 'sprite' || !c.tl) return false;
  const timeline = c.tl, index = (loop ? Math.max(0, frame) % timeline.n : Math.min(Math.max(0, frame), timeline.n - 1));
  const display = new Map<number, { id: number; m: number[]; start: number; alpha: number }>();
  for (let i = 0; i <= index; i++) for (const p of timeline.f[i] ?? []) {
    if (p.rm !== undefined) { display.delete(p.rm); continue; }
    if (p.d === undefined) continue;
    const old = display.get(p.d);
    if (p.id !== undefined) display.set(p.d, { id: p.id, m: p.m ?? old?.m ?? [1, 0, 0, 1, 0, 0], start: p.mv && old && old.id === p.id ? old.start : i, alpha: p.ct?.[3] ?? old?.alpha ?? 1 });
    else if (old) { if (p.m) old.m = p.m; if (p.ct) old.alpha = p.ct[3] ?? 1; }
  }
  let drawn = false;
  for (const [, child] of [...display].sort((a, b) => a[0] - b[0])) {
    ctx.save(); ctx.globalAlpha *= child.alpha; const m = child.m; ctx.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
    drawn = drawChar(ctx, asset, child.id, (timeline.n === 1 ? frame : index) - child.start, loop, depth + 1) || drawn; ctx.restore();
  }
  return drawn;
}
function render(ctx: CanvasRenderingContext2D, weapon: string, special: boolean, kind: 'flight' | 'impact', x: number, y: number, angle: number, age: number, variant?: number): boolean {
  const base = (ids[weapon] ?? ids.sledge)![special ? 1 : 0];
  // O exportador nomeia a biblioteca do projétil "blastout" e a explosão "bullet".
  // Bola do estágio/item (ex.: 382, 3811) quando existir; senão a bola-base da arma.
  const prefix = kind === 'flight' ? 'blastout' : 'bullet';
  let ball = base, asset = variant && variant !== base ? library(`${prefix}${variant}`) : null;
  if (asset) ball = variant!; else asset = library(`${prefix}${base}`);
  if (!asset) return false;
  const id = asset.lib.classes[`${kind === 'flight' ? 'bullet' : 'blastOutMovie'}${ball}`]?.id; if (!id) return false;
  if (kind === 'impact' && age * asset.lib.frameRate >= (asset.lib.chars[id]?.tl?.n ?? 0)) return false;
  ctx.save(); ctx.translate(x, y); if (kind === 'flight') ctx.rotate(angle);
  const drawn = drawChar(ctx, asset, id, Math.floor(Math.max(0, age) * asset.lib.frameRate), kind === 'flight'); ctx.restore(); return drawn;
}
export function drawProjectile(ctx: CanvasRenderingContext2D, weapon: string, special: boolean, x: number, y: number, angle: number, ageSeconds: number, ballId?: number): boolean {
  return render(ctx, weapon, special, 'flight', x, y, angle, ageSeconds, ballId);
}
export function drawImpact(ctx: CanvasRenderingContext2D, weapon: string, special: boolean, x: number, y: number, ageSeconds: number, ballId?: number): boolean {
  return render(ctx, weapon, special, 'impact', x, y, 0, ageSeconds, ballId);
}

// Iniciar o download antes do primeiro tiro.
for (const pair of Object.values(ids)) for (const id of pair) { library(`blastout${id}`); library(`bullet${id}`); }

/** Duração declarada pela timeline do impacto, em segundos; null enquanto carrega. */
export function impactDuration(weapon: string, special: boolean): number | null {
  const ball = (ids[weapon] ?? ids.sledge)![special ? 1 : 0];
  const asset = library(`bullet${ball}`); if (!asset) return null;
  const id = asset.lib.classes[`blastOutMovie${ball}`]?.id;
  return id ? (asset.lib.chars[id]?.tl?.n ?? 0) / asset.lib.frameRate : null;
}

export const TRAIL_MAX_LIFE = .5;
type TrailPoint = { x: number; y: number };
type Emitter = { shape: number; interval: number; life: number; size: number; sizeSpread: number; velocity: number; velocitySpread: number; motion: number; weight: number; weightSpread: number; spin: number; spinSpread: number; rotation: number; begin: number; end: number; alpha: [number, number][]; sizeLine: [number, number][]; colors?: [number, number][] };
// partical.xml e Emitter.as: motionV usa motionVOrient também como amplitude.
const trailConfig: Record<string, [Emitter, Emitter]> = {
  prism: [
    { shape: 13, interval: .1, life: .5, size: 1, sizeSpread: .1, velocity: 81, velocitySpread: 68, motion: 58, weight: 0, weightSpread: 0, spin: 10, spinSpread: -1, rotation: 0, begin: 0, end: 0, alpha: [[0,1],[.8,0],[.5,0],[0,0]], sizeLine: [[0,1],[1,.4]] },
    { shape: 25, interval: .03, life: .3, size: .7, sizeSpread: .2, velocity: 0, velocitySpread: 94, motion: 0, weight: 0, weightSpread: 0, spin: 0, spinSpread: 0, rotation: 6.28, begin: 0, end: 0, alpha: [[0,1],[1,0]], sizeLine: [], colors: [[0,16776982],[.2,16745472],[1,16739842]] },
  ],
  furnace: [
    { shape: 220, interval: .04, life: .5, size: 1, sizeSpread: 0, velocity: 35, velocitySpread: 28, motion: 10, weight: 5, weightSpread: 0, spin: 0, spinSpread: 0, rotation: 0, begin: 0, end: 6.28, alpha: [[0,1],[1,0]], sizeLine: [[0,1],[1,.6]] },
    { shape: 221, interval: .04, life: .5, size: 1, sizeSpread: 0, velocity: 169, velocitySpread: 0, motion: 0, weight: 7, weightSpread: -5, spin: 0, spinSpread: 0, rotation: 0, begin: 6.28, end: 3.5526857142857144, alpha: [[0,1],[1,0]], sizeLine: [[0,1],[1,.6]] },
  ],
  sledge: [
    { shape: 45, interval: .03, life: .2, size: 1, sizeSpread: 0, velocity: 0, velocitySpread: 0, motion: 0, weight: 0, weightSpread: 0, spin: 21, spinSpread: 0, rotation: 0, begin: 0, end: 6.28, alpha: [[0,.7],[1,0]], sizeLine: [] },
    { shape: 44, interval: .03, life: .3, size: 1, sizeSpread: 0, velocity: 0, velocitySpread: 0, motion: 0, weight: 0, weightSpread: 0, spin: 36, spinSpread: 0, rotation: 0, begin: 0, end: 6.28, alpha: [[0,.7],[1,0]], sizeLine: [] },
  ],
};
function random(seed: number, channel: number): number {
  const v = Math.sin(seed * 127.1 + channel * 311.7 + 72.3) * 43758.5453123;
  return v - Math.floor(v);
}
// XLine percorre os pontos na ordem do XML, inclusive os pontos fora de ordem do emissor 1.
export function particleLine(points: [number, number][], x: number): number {
  if (!points.length) return 1;
  if (points.length === 1) return points[0]![1];
  let i = 1; while (i < points.length - 1 && points[i]![0] <= x) i++;
  const a = points[i - 1]!, b = points[i]!;
  return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
}
function tintColor(points: [number, number][], x: number): [number, number, number] {
  let i = 1; while (i < points.length - 1 && points[i]![0] <= x) i++;
  const a = points[i - 1]!, b = points[i]!, t = (x - a[0]) / (b[0] - a[0]);
  return [16, 8, 0].map(shift => Math.round(((a[1] >> shift) & 255) * (1 - t) + ((b[1] >> shift) & 255) * t)) as [number, number, number];
}
/** Equações discretas de Particle.update, sem depender da frequência de renderização. */
export function particleMotion(velocity: number, direction: number, motion: number, weight: number, seed: number, steps: number): { x: number; y: number } {
  let x = 0, y = 0, gv = 0;
  for (let step = 0; step < steps; step++) {
    const noiseAngle = random(seed, 10 + step) * Math.PI * 2;
    gv += weight; x += (Math.cos(direction) * velocity + Math.cos(noiseAngle) * motion) * .04;
    y += (Math.sin(direction) * velocity + Math.sin(noiseAngle) * motion + gv) * .04;
  }
  return { x, y };
}
const tinted = new Map<string, HTMLCanvasElement>();
function drawTinted(ctx: CanvasRenderingContext2D, asset: Loaded, id: number, frame: number, rgb: [number, number, number]): boolean {
  // ColorTransform do Flash soma RGB mantendo os pixels originais (keepColor=true).
  const key = `${id}:${frame}:${rgb.join(',')}`;
  let canvas = tinted.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d', { willReadFrequently: true }); if (!c) return false;
    c.translate(128, 128); if (!drawChar(c, asset, id, frame, true)) return false;
    const image = c.getImageData(0, 0, 256, 256);
    for (let i = 0; i < image.data.length; i += 4) if (image.data[i + 3]) {
      image.data[i] = Math.min(255, image.data[i]! + rgb[0]);
      image.data[i + 1] = Math.min(255, image.data[i + 1]! + rgb[1]);
      image.data[i + 2] = Math.min(255, image.data[i + 2]! + rgb[2]);
    }
    c.putImageData(image, 0, 0); if (tinted.size > 128) tinted.clear(); tinted.set(key, canvas);
  }
  ctx.drawImage(canvas, -128, -128); return true;
}
/** Emissores avaliados em passos visuais de 40 ms, como ParticleEnginee; trajetória do core não é alterada. */
export function drawTrail(ctx: CanvasRenderingContext2D, weapon: string, special: boolean, trail: TrailPoint[], elapsed: number, tailAge = 0): boolean {
  if (weapon === 'fly') return false; // Ball 3 não possui FlyingPartical.
  const asset = library('particles'); if (!asset || trail.length < 1) return false;
  const config = (trailConfig[weapon] ?? trailConfig.sledge)![special ? 1 : 0];
  const id = asset.lib.classes[`ParticalShap${config.shape}`]?.id; if (!id) return false;
  // Emitter.execute usa comparação estrita e emite no máximo uma partícula por tick.
  const emissionTicks = Math.floor(config.interval / .04 + 1e-9) + 1;
  const tick = Math.floor((elapsed + tailAge) / .04), lastEmission = Math.floor(Math.floor(elapsed / .04) / emissionTicks) * emissionTicks;
  let drawn = false;
  for (let emitted = lastEmission; emitted >= 0; emitted -= emissionTicks) {
    const steps = tick - emitted + 1, age = steps * .04; if (age >= config.life) break;
    const pos = trail.length - 1 - (elapsed - emitted * .04) / .04; if (pos < 0) break;
    const i = Math.floor(pos), a = trail[i]!, b = trail[Math.min(i + 1, trail.length - 1)]!, f = pos - i;
    const previous = trail[Math.max(0, i - 1)]!;
    const tangent = Math.atan2(b.y - previous.y, b.x - previous.x);
    const direction = tangent + config.begin + random(emitted, 0) * (config.end - config.begin);
    const velocity = config.velocity + random(emitted, 1) * config.velocitySpread;
    const motion = config.motion * (1 + random(emitted, 2));
    const weight = config.weight + random(emitted, 3) * config.weightSpread;
    const size = config.size + random(emitted, 4) * config.sizeSpread;
    const spin = config.spin + random(emitted, 5) * config.spinSpread;
    const offset = particleMotion(velocity, direction, motion, weight, emitted, steps);
    const progress = age / config.life, scale = size * particleLine(config.sizeLine, progress);
    const alpha = Math.max(0, Math.min(1, particleLine(config.alpha, progress)));
    ctx.save(); ctx.translate(a.x + (b.x - a.x) * f + offset.x, a.y + (b.y - a.y) * f + offset.y);
    ctx.rotate(config.rotation + tangent + spin * age); ctx.scale(scale, scale);
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= alpha;
    const frame = Math.floor(age * asset.lib.frameRate);
    drawn = (config.colors ? drawTinted(ctx, asset, id, frame, tintColor(config.colors, progress)) : drawChar(ctx, asset, id, frame, true)) || drawn;
    ctx.restore();
  }
  return drawn;
}
library('particles');
