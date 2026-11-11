/**
 * Boneco em camadas desenhado por código (placeholder até a arte final por camada chegar).
 * Pés em (0, 0), olhando para a direita, ~52 px de altura (hitbox 36×52). Camadas, de trás para frente (LAYER_ORDER):
 * hair-back, body, outfit, face, hair-front, hat; o braço com a arma gira com o ângulo de tiro.
 */
import { HAIR_COLORS, SKIN_TONES, type Look } from "@tankclone/core";

const OUTFITS = ["#4f7fd6", "#d65f4f", "#4fb06a", "#e0b43a", "#8a5bd6", "#3a3f58"];
const HATS_COLOR = ["", "#c0392b", "#222a44", "#7a4bd1", "#9aa3b3"];
const WEAPON_COLOR: Record<string, string> = { prism: "#ff8ad0", sledge: "#d6a43a", furnace: "#ff6d1f" };
const INK = "#141a3a";

export interface DollPose { facing: 1 | -1; angleDeg: number; walk: number; weaponId: string; aiming: boolean; crouch?: boolean }

export function drawDoll(ctx: CanvasRenderingContext2D, look: Look, pose: DollPose, x: number, y: number, scale = 1): void {
  const { appearance: a, equipped: e } = look;
  const skin = SKIN_TONES[a.skin]!, hairC = HAIR_COLORS[a.hairColor]!, cloth = OUTFITS[e.outfit]!;
  ctx.save(); ctx.translate(x, y); ctx.scale(pose.facing * scale, scale);
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = 2; ctx.strokeStyle = INK;
  const bob = Math.abs(Math.sin(pose.walk)) * 1.5;

  // pernas
  ctx.fillStyle = "#2a2f4a";
  for (const dx of [-4, 2]) { const lift = pose.walk ? Math.sin(pose.walk + (dx < 0 ? 0 : Math.PI)) * 2 : 0; ctx.beginPath(); ctx.rect(dx, -14 - Math.max(0, lift) * 0, 5, 14 + Math.min(0, lift)); ctx.fill(); ctx.stroke(); }
  ctx.translate(0, -bob);

  // hair-back (cabelos compridos)
  if (a.hair >= 4) { ctx.fillStyle = hairC; ctx.beginPath(); ctx.ellipse(-3, -38, 11, a.hair === 7 ? 17 : 12, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  // body + outfit
  ctx.fillStyle = skin; ctx.beginPath(); ctx.rect(-2, -32, 4, 5); ctx.fill(); // pescoço
  ctx.fillStyle = cloth; ctx.beginPath(); ctx.roundRect(-8, -30, 16, 17, 3); ctx.fill(); ctx.stroke();
  if (e.outfit % 3 === 1) { ctx.fillStyle = "#ffffff55"; ctx.fillRect(-8, -24, 16, 3); }
  if (e.outfit % 3 === 2) { ctx.fillStyle = "#00000033"; ctx.fillRect(-1, -30, 2, 17); }
  // cabeça
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, -39, 10, 0, 7); ctx.fill(); ctx.stroke();
  // face
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
  const eye = (ex: number, ey: number, r = 1.4) => { ctx.beginPath(); ctx.arc(ex, ey, r, 0, 7); ctx.fill(); };
  switch (a.face) {
    case 0: eye(2, -40); eye(7, -40); ctx.beginPath(); ctx.arc(5, -36, 2.5, 0.2, Math.PI - 0.2); ctx.stroke(); break;
    case 1: eye(2, -40, 2); eye(7, -40, 2); ctx.beginPath(); ctx.moveTo(3, -35); ctx.lineTo(7, -35); ctx.stroke(); break;
    case 2: ctx.beginPath(); ctx.arc(3, -40, 2, Math.PI, 0); ctx.arc(8, -40, 2, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(5.5, -36, 2.5, 0.2, Math.PI - 0.2); ctx.stroke(); break;
    case 3: eye(3, -39); eye(7, -39); ctx.beginPath(); ctx.moveTo(1, -43); ctx.lineTo(4.5, -41.5); ctx.moveTo(9, -43); ctx.lineTo(6, -41.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(3, -35); ctx.lineTo(7, -36); ctx.stroke(); break;
    case 4: eye(3, -40); eye(7, -40); ctx.beginPath(); ctx.arc(5.5, -35.5, 1.8, 0, 7); ctx.stroke(); break;
    default: eye(2, -40); ctx.beginPath(); ctx.moveTo(5.5, -40); ctx.lineTo(8.5, -40); ctx.stroke(); ctx.beginPath(); ctx.arc(5, -36, 2.5, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  // hair-front
  ctx.fillStyle = hairC;
  const hairFront: Record<number, () => void> = {
    0: () => { ctx.beginPath(); ctx.arc(0, -41, 10.5, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); ctx.fill(); ctx.stroke(); },
    1: () => { ctx.beginPath(); ctx.moveTo(-10, -42); for (let i = 0; i < 5; i++) { ctx.lineTo(-10 + i * 5 + 2.5, -54 + (i % 2) * 4); ctx.lineTo(-10 + (i + 1) * 5, -43); } ctx.closePath(); ctx.fill(); ctx.stroke(); },
    2: () => { hairFront[0]!(); ctx.beginPath(); ctx.arc(-2, -52, 5, 0, 7); ctx.fill(); ctx.stroke(); },
    3: () => { ctx.beginPath(); ctx.arc(0, -41, 10.5, Math.PI * 0.95, Math.PI * 1.9); ctx.lineTo(8, -34); ctx.lineTo(1, -44); ctx.closePath(); ctx.fill(); ctx.stroke(); },
  };
  (hairFront[a.hair % 4] ?? hairFront[0]!)();
  // hat
  if (e.hat > 0) {
    ctx.fillStyle = HATS_COLOR[e.hat]!;
    if (e.hat === 1) { ctx.beginPath(); ctx.arc(0, -43, 10.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(2, -44, 11, 3); ctx.strokeRect(2, -44, 11, 3); }
    if (e.hat === 2) { ctx.fillRect(-12, -48, 24, 3); ctx.strokeRect(-12, -48, 24, 3); ctx.fillRect(-7, -60, 14, 12); ctx.strokeRect(-7, -60, 14, 12); }
    if (e.hat === 3) { ctx.beginPath(); ctx.moveTo(-11, -47); ctx.lineTo(0, -66); ctx.lineTo(11, -47); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (e.hat === 4) { ctx.beginPath(); ctx.arc(0, -41, 11.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  }
  // braço + arma (gira em torno do ombro com o ângulo absoluto)
  const ang = pose.aiming ? (pose.angleDeg * Math.PI) / 180 : 0.35;
  ctx.save(); ctx.translate(4, -27); ctx.rotate(-ang);
  ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(0, -2.5, 10, 5, 2.5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = WEAPON_COLOR[pose.weaponId] ?? "#999"; ctx.beginPath(); ctx.roundRect(8, -3.5, 18, 7, 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

/** Retrato do boneco montado (saguão/sala/oficina). */
export function drawPortrait(canvas: HTMLCanvasElement, look: Look, weaponId = "sledge"): void {
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  const s = Math.min(canvas.width / 46, canvas.height / 72);
  drawDoll(c, look, { facing: 1, angleDeg: 20, walk: 0, weaponId, aiming: true }, canvas.width / 2 - 2 * s, canvas.height - 4, s);
}
