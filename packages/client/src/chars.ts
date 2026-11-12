/** Avatar clássico: sprites PNG por item, máscaras de cor e folhas GAME/SHOW do cliente original.
 * Todos os recursos são locais; não usa Flash nem consulta CDNs durante a partida. */
import { avatarFrames, avatarFrameRect, avatarLayers, avatarTint, GAME_FRAME, SHOW_FRAME, type AvatarLayer, type AvatarMode, type Look } from "@tankclone/core";
import { drawDoll, type DollPose } from "./doll";

export const CHAR_SCALE = 1;
type ImageEntry = { img: HTMLImageElement; loaded: boolean; ready: Promise<void> };
type Sheets = { face: HTMLCanvasElement; upper: HTMLCanvasElement; weapon: HTMLCanvasElement; wing?: HTMLImageElement };
const images = new Map<string, ImageEntry>();
const tinted = new Map<string, HTMLCanvasElement>();
const sheets = new Map<string, Sheets>();

function boundedSet<T>(cache: Map<string, T>, key: string, value: T, limit: number): T {
  cache.set(key, value);
  while (cache.size > limit) cache.delete(cache.keys().next().value!);
  return value;
}
function asset(file: string): ImageEntry {
  const cached = images.get(file);
  if (cached) return cached;
  const img = new Image();
  let finish!: () => void;
  const entry: ImageEntry = { img, loaded: false, ready: new Promise<void>(resolve => (finish = resolve)) };
  images.set(file, entry);
  img.onload = () => { entry.loaded = true; finish(); };
  img.onerror = () => { console.warn(`Avatar: não foi possível carregar ${file}`); finish(); };
  img.src = `/assets/avatar/${file}`;
  return entry;
}
function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}
function colorMask(part: AvatarLayer, img: HTMLImageElement): CanvasImageSource {
  if (!part.tint) return img;
  const key = `${part.file}|${part.tint}`;
  const cached = tinted.get(key);
  if (cached) return cached;
  const { fill, highlight } = avatarTint(part.tint);
  const c = canvas(img.naturalWidth, img.naturalHeight), ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = `rgb(${fill.join(",")})`; ctx.fillRect(0, 0, c.width, c.height);
  const h = canvas(c.width, c.height), hc = h.getContext("2d")!;
  hc.drawImage(img, 0, 0);
  const pixels = hc.getImageData(0, 0, h.width, h.height);
  for (let i = 0; i < pixels.data.length; i += 4) {
    pixels.data[i] = Math.min(255, pixels.data[i]! + highlight[0]!);
    pixels.data[i + 1] = Math.min(255, pixels.data[i + 1]! + highlight[1]!);
    pixels.data[i + 2] = Math.min(255, pixels.data[i + 2]! + highlight[2]!);
  }
  hc.putImageData(pixels, 0, 0);
  ctx.globalCompositeOperation = "hard-light"; ctx.drawImage(h, 0, 0);
  return boundedSet(tinted, key, c, 64);
}
function prepare(look: Look, weaponId: string, mode: AvatarMode): Sheets | null {
  const key = JSON.stringify([look, weaponId, mode]);
  const cached = sheets.get(key);
  if (cached) { sheets.delete(key); sheets.set(key, cached); return cached; }
  const parts = avatarLayers(look, weaponId, mode), entries = parts.map(p => asset(p.file));
  if (entries.some(e => !e.loaded)) return null;
  const size = mode === "game" ? { w: GAME_FRAME.width * GAME_FRAME.columns, h: GAME_FRAME.height * 3 } : { w: SHOW_FRAME.width, h: SHOW_FRAME.height };
  // SHOW tem quatro expressões lado a lado no rosto; roupa e demais peças usam o mesmo quadro.
  const result: Sheets = { face: canvas(size.w * (mode === "show" ? 4 : 1), size.h), upper: canvas(size.w, size.h), weapon: canvas(size.w, size.h) };
  parts.forEach((part, i) => {
    const img = entries[i]!.img;
    if (part.group === "wing") { result.wing = img; return; }
    result[part.group].getContext("2d")!.drawImage(colorMask(part, img), 0, 0);
  });
  return boundedSet(sheets, key, result, 32);
}

/** O mesmo espelhamento é aplicado a todas as peças, ancoradas no mesmo ponto dos pés. */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, pose: DollPose, x: number, y: number, scale = CHAR_SCALE): void {
  const ready = prepare(look, pose.weaponId, "game");
  if (!ready) { drawDoll(ctx, look, pose, x, y, scale); return; }
  const now = performance.now() / 1000;
  const frames = avatarFrames(now + x * 0.013, pose.walk > 0, pose.aiming, pose.action, pose.actionElapsed);
  ctx.save(); ctx.translate(x, y); ctx.scale(pose.facing * scale, scale);
  if (ready.wing) ctx.drawImage(ready.wing, -32, -61, 60, 60);
  for (const group of ["weapon", "face", "upper"] as const) {
    const rect = avatarFrameRect(frames[group]);
    ctx.drawImage(ready[group], rect.x, rect.y, rect.w, rect.h, -GAME_FRAME.feetX, -GAME_FRAME.feetY, rect.w, rect.h);
  }
  ctx.restore();
}

const portraitPending = new WeakMap<HTMLCanvasElement, string>();
const portraitLook = new WeakMap<HTMLCanvasElement, { key: string; look: Look; weaponId: string }>();

/** Retrato SHOW original, separado da folha de batalha. Atualiza após o carregamento inicial. */
export function drawCharPortrait(target: HTMLCanvasElement, look: Look, weaponId = "sledge"): void {
  const key = JSON.stringify([look, weaponId]);
  portraitLook.set(target, { key, look, weaponId });
  const ctx = target.getContext("2d")!;
  ctx.clearRect(0, 0, target.width, target.height);
  const ready = prepare(look, weaponId, "show");
  if (!ready) {
    const scale = Math.min(target.width / 48, target.height / 72);
    drawDoll(ctx, look, { facing: 1, angleDeg: 20, walk: 0, weaponId, aiming: true }, target.width / 2, target.height - 3, scale);
    if (portraitPending.get(target) !== key) {
      portraitPending.set(target, key);
      void Promise.all(avatarLayers(look, weaponId, "show").map(p => asset(p.file).ready)).then(() => {
        const latest = portraitLook.get(target);
        if (latest?.key === key && prepare(latest.look, latest.weaponId, "show")) drawCharPortrait(target, latest.look, latest.weaponId);
      });
    }
    return;
  }
  const scale = Math.min(target.width / 185, target.height / 305);
  ctx.save(); ctx.translate(target.width / 2, target.height - 2); ctx.scale(scale, scale);
  if (ready.wing) ctx.drawImage(ready.wing, -65, -150, 130, 130);
  const faceFrame = performance.now() % 4500 > 4350 ? 2 : 0;
  for (const group of ["face", "upper", "weapon"] as const) {
    ctx.drawImage(ready[group], group === "face" ? faceFrame * SHOW_FRAME.width : 0, 0, SHOW_FRAME.width, SHOW_FRAME.height,
      -SHOW_FRAME.feetX, -SHOW_FRAME.feetY, SHOW_FRAME.width, SHOW_FRAME.height);
  }
  ctx.restore();
}
