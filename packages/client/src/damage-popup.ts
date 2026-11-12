/** ShootPercentView e BloodNumberCreater do cliente 4.1; fps original do combate. */
const FPS = 24;
export function damagePopupDuration(critical: boolean): number { return (critical ? 28 : 33) / FPS; }
export interface DamagePopupState { alpha: number; offsetY: number; scale: number }
/** Simula as transições por quadro, inclusive o quadro que inicia o desaparecimento. */
export function damagePopupState(elapsed: number, critical: boolean): DamagePopupState | null {
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= damagePopupDuration(critical)) return null;
  const frames = Math.floor(elapsed * FPS + 1e-9);
  let alpha = 0, offsetY = -20, scale = critical ? 0.5 : 1, hold = 0, adding = true;
  for (let i = 0; i < frames; i++) {
    if (alpha > .95 && ++hold === 20) { adding = false; alpha = .9; }
    if (alpha < 1) {
      if (critical) { scale += adding ? .24 : .125; alpha += adding ? .4 : -.15; }
      else { offsetY -= adding ? 8 : 6; alpha += adding ? .22 : -.1; }
    }
  }
  return { alpha: Math.max(0, Math.min(1, alpha)), offsetY, scale };
}
const images = new Map<string, HTMLImageElement>();
function asset(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let img = images.get(name);
  if (!img) { img = new Image(); img.src = `/damage-popup/${name}.png`; images.set(name, img); }
  return img.complete && img.naturalWidth ? img : null;
}
if (typeof Image !== 'undefined') for (const name of ['0','1','2','3','4','5','6','7','8','9','critical']) asset(name);
/** Limites equivalentes a ShootPercentView.returnNum, incluindo origem negativa. */
export function damagePopupGeometry(digits: string, critical: boolean): { minX: number; width: number; digitX: number; backgroundX: number } {
  const left = 33 + (4 - digits.length) * 10;
  const widths = [21, 15, 18, 18, 21, 19, 21, 19, 21, 21];
  const minX = Math.min(0, left);
  const maxX = Math.max(critical ? 133 : 0, left + (digits.length - 1) * 20 + widths[Number(digits.at(-1))]!);
  return { minX, width: maxX - minX, digitX: left - minX, backgroundX: 5 - minX };
}
/** Posição recebida é a dos pés; variação reproduz deslocamento por golpe e separa acertos simultâneos. */
export function drawDamagePopup(ctx: CanvasRenderingContext2D, amount: number, critical: boolean, x: number, y: number, elapsed: number, variant = 0): void {
  const state = damagePopupState(elapsed, critical); if (!state || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 99999999) return;
  const digits = String(Math.min(99999999, Math.max(1, Math.round(Math.abs(amount)))));
  const glyphs = [...digits].map(asset), background = critical ? asset('critical') : null;
  const slot = Math.abs(variant) % 5;
  const dx = [0, -16, 16, -28, 28][slot]!, dy = [0, -10, 10, -24, 24][slot]!, parentScale = [1, .9, 1.1, .8, 1.2][slot]!;
  const { width, digitX, backgroundX } = damagePopupGeometry(digits, critical);
  const height = critical ? 78 : 47;
  ctx.save(); ctx.translate(x + dx, y - 50 + dy); ctx.globalAlpha *= state.alpha; ctx.scale(parentScale, parentScale);
  if (critical) { ctx.translate(10 - width * state.scale / 2, -height * state.scale / 2); ctx.scale(state.scale, state.scale); }
  else ctx.translate(-70, state.offsetY);
  if (critical && background) ctx.drawImage(background, backgroundX, 0);
  else if (critical) {
    ctx.fillStyle = '#c81c14'; ctx.strokeStyle = '#ffe574'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? .67 : 1, px = backgroundX + 64 + Math.cos(a) * 62 * r, py = 39 + Math.sin(a) * 37 * r; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  digits.split('').forEach((digit, i) => {
    const img = glyphs[i];
    if (img) ctx.drawImage(img, digitX + i * 20, critical ? 30 : 20);
    else { ctx.font = 'bold 27px sans-serif'; ctx.textBaseline = 'top'; ctx.lineWidth = 3; ctx.strokeStyle = '#3b0000'; ctx.fillStyle = '#ff4941'; ctx.strokeText(digit, digitX + i * 20, critical ? 30 : 20); ctx.fillText(digit, digitX + i * 20, critical ? 30 : 20); }
  });
  ctx.restore();
}
