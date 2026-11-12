/**
 * Boneco montado a partir das camadas SVG da arte (public/assets/chars, manifest.json > character).
 * Pele e cabelo usam tinta (currentColor): o SVG é lido como texto, o atributo color da raiz é trocado pelo hex e
 * rasterizado como imagem (uma por arquivo+cor, em cache). Enquanto as imagens carregam, usa o boneco procedural (doll.ts).
 */
import { HAIR_COLORS, SKIN_TONES, type Look } from "@tankclone/core";
import { drawDoll, type DollPose } from "./doll";

const CANVAS = { w: 96, h: 128 }, FEET = { x: 48, y: 124 }, SHOULDER = { x: 56, y: 82 }, ARM_PIVOT = { x: 8, y: 10 }, HAND = { x: 38, y: 10 }, GRIP = { x: 10, y: 27 };
export const CHAR_SCALE = 0.433;
const CROUCH_Y = 0.72, CROUCH_DROP = 14, SHOULDER_DROP = 12;

type Entry = { img: HTMLImageElement; ok: boolean };
const cache = new Map<string, Entry>();
const texts = new Map<string, Promise<string>>();

function fetchText(file: string): Promise<string> {
  let p = texts.get(file);
  if (!p) { p = fetch(`/assets/${file}`).then(r => (r.ok ? r.text() : Promise.reject(new Error(file)))); texts.set(file, p); }
  return p;
}

/** Imagem da camada já pronta (ou null e dispara o carregamento). */
function layer(file: string, tint?: string): HTMLImageElement | null {
  const key = `${file}|${tint ?? ""}`;
  let e = cache.get(key);
  if (!e) {
    e = { img: new Image(), ok: false }; cache.set(key, e);
    const entry = e;
    fetchText(file).then(svg => {
      // tinta: atributo color da raiz (currentColor) e também a cor literal padrão, caso o SVG tenha sido reexportado sem currentColor
      const literal = file.includes("hair") ? /#6B3A1F/gi : /#F2C79F/gi;
      const text = tint ? svg.replace(/(<svg[^>]*?)\scolor="[^"]*"/, `$1`).replace("<svg", `<svg color="${tint}"`).replace(literal, tint) : svg;
      entry.img.onload = () => { entry.ok = true; };
      entry.img.src = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    }).catch(() => { /* arquivo ausente: a camada simplesmente não aparece */ });
  }
  return e.ok ? e.img : null;
}

const FILES = (look: Look, weaponId: string) => {
  const { appearance: a, equipped: q } = look;
  const skin = SKIN_TONES[a.skin]!, hair = HAIR_COLORS[a.hairColor]!;
  return [
    q.wings ? { f: `chars/wings/wings-${q.wings}.svg` } : null,
    { f: `chars/hair-back/hair-back-${a.hair + 1}.svg`, t: hair },
    { f: "chars/body/body-1.svg", t: skin },
    { f: `chars/outfit/outfit-${q.outfit + 1}.svg` },
    { f: "chars/head/head-1.svg", t: skin },
    { f: `chars/face/face-${a.face + 1}.svg` },
    { f: `chars/hair-front/hair-front-${a.hair + 1}.svg`, t: hair },
    q.glasses ? { f: `chars/glasses/glasses-${q.glasses}.svg` } : null,
    q.hat ? { f: `chars/hat/hat-${q.hat}.svg` } : null,
    { f: `ui/weapons/weapon-${weaponId}.svg`, weapon: true },
    { f: "chars/arm/arm-1.svg", t: skin, arm: true },
  ].filter(Boolean) as Array<{ f: string; t?: string; weapon?: boolean; arm?: boolean }>;
};

/** Desenha o boneco com os pés em (x, y). Usa a arte se todas as camadas já carregaram; senão, o placeholder procedural. */
export function drawCharacter(ctx: CanvasRenderingContext2D, look: Look, pose: DollPose, x: number, y: number, scale = CHAR_SCALE): void {
  const parts = FILES(look, pose.weaponId);
  const imgs = parts.map(p => layer(p.f, p.t));
  if (imgs.some(i => !i)) { drawDoll(ctx, look, pose, x, y, scale / CHAR_SCALE); return; }
  const bob = pose.walk ? Math.abs(Math.sin(pose.walk)) * 3 : 0;
  ctx.save(); ctx.translate(x, y - bob * scale); ctx.scale(pose.facing * scale, scale); ctx.translate(-FEET.x, -FEET.y);
  const crouch = !!pose.crouch, sway = x * 0.013;
  const ang = pose.aiming ? (pose.angleDeg * Math.PI) / 180 : 0.35;
  parts.forEach((p, i) => {
    const img = imgs[i]!;
    if (p.weapon || p.arm) return;
    const head = /hair-|head|face|glasses|hat/.test(p.f);
    if (!crouch) { ctx.drawImage(img, 0, 0, CANVAS.w, CANVAS.h); return; }
    // em partida: corpo achatado e só a cabeça chibi balança
    ctx.save();
    if (head) { ctx.translate(0, CROUCH_DROP + Math.sin(performance.now() / 260 + sway) * 2.2); ctx.translate(CANVAS.w / 2, 40); ctx.rotate(Math.sin(performance.now() / 330 + sway) * 0.05); ctx.translate(-CANVAS.w / 2, -40); }
    else { ctx.translate(0, FEET.y * (1 - CROUCH_Y)); ctx.scale(1, CROUCH_Y); }
    ctx.drawImage(img, 0, 0, CANVAS.w, CANVAS.h);
    ctx.restore();
  });
  // arma e braço giram juntos em torno do ombro; o cabo da arma fica na mão
  ctx.save(); ctx.translate(SHOULDER.x, SHOULDER.y + (crouch ? SHOULDER_DROP : 0)); ctx.rotate(-ang);
  parts.forEach((p, i) => {
    if (p.weapon) ctx.drawImage(imgs[i]!, HAND.x - ARM_PIVOT.x - GRIP.x, HAND.y - ARM_PIVOT.y - GRIP.y, 96, 48);
  });
  parts.forEach((p, i) => { if (p.arm) ctx.drawImage(imgs[i]!, -ARM_PIVOT.x, -ARM_PIVOT.y, 48, 20); });
  ctx.restore();
  ctx.restore();
}

/** Retrato montado (saguão/sala/vestiário). */
export function drawCharPortrait(canvas: HTMLCanvasElement, look: Look, weaponId = "sledge"): void {
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.min(canvas.width / 80, canvas.height / 128) ;
  drawCharacter(c, look, { facing: 1, angleDeg: 15, walk: 0, weaponId, aiming: true }, canvas.width / 2, canvas.height - 2, s);
}
