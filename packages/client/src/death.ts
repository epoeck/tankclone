import type { Look } from '@tankclone/core';
import { drawSoul } from './chars';
import { drawCharacterTimeline, loadCharacterTimeline, type TimelineAsset } from './character-timeline';
let ghost: TimelineAsset | undefined;
if (typeof Image !== 'undefined') void loadCharacterTimeline('/character-effects/ghost').then(value => { ghost = value; }).catch(() => {});

let tomb: HTMLImageElement | undefined;
function tombImage(): HTMLImageElement | undefined {
  if (!tomb && typeof Image !== 'undefined') { tomb = new Image(); tomb.src = '/character-effects/tomb.png'; }
  return tomb;
}
/** Lápide ancorada no solo e SOUL acima dela, como GamePlayer.die. */
export function drawDeath(ctx: CanvasRenderingContext2D, look: Look, weaponId: string, x: number, y: number, facing: 1 | -1, elapsed: number, slopeDeg: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-slopeDeg * facing * Math.PI / 180);
  const image = tombImage();
  if (image?.complete && image.naturalWidth) ctx.drawImage(image, -20, -47);
  ctx.restore();
  const soulY = y - 70 + Math.sin(Math.max(0, elapsed) * 2) * 2;
  drawSoul(ctx, look, weaponId, x, soulY, facing);
  if (ghost) {
    const name = look.appearance.sex === 'f' ? 'asset.game.ghostGirlMovieAsset' : 'asset.game.ghostManMovieAsset';
    const id = ghost.library.classes[name]?.id;
    if (id) { ctx.save(); ctx.translate(x, soulY); ctx.scale(facing, 1); ctx.translate(-26, -50);
      drawCharacterTimeline(ctx, ghost, id, Math.floor(Math.max(0, elapsed) * ghost.library.frameRate)); ctx.restore(); }
  }
}
