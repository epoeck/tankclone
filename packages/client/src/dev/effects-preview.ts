import { drawImpact, drawProjectile, drawTrail } from '../projectile-effects';
import { projectileSfx } from '../sound';
const canvas = document.querySelector<HTMLCanvasElement>('#effects')!;
const ctx = canvas.getContext('2d')!;
const weapons = ['prism', 'sledge', 'furnace', 'fly'];
canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect(), row = Math.floor((event.clientY - rect.top) / rect.height * canvas.height / 130);
  const weapon = weapons[Math.floor(row / 2)]; if (weapon) projectileSfx(weapon, !!(row % 2), (event.clientX - rect.left) / rect.width > .45);
});
function frame(now: number) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 7; row++) {
    const weapon = weapons[Math.floor(row / 2)]!, special = !!(row % 2), y = row * 130 + 65, age = now / 1000 % 2.5;
    ctx.fillStyle = '#fff'; ctx.font = '20px sans-serif'; ctx.fillText(`${weapon === 'fly' ? 'avião' : `${weapon} ${special ? 'especial' : 'normal'}`}`, 12, y);
    drawTrail(ctx, weapon, special, Array.from({ length: 14 }, (_, i) => ({ x: 350 - (13 - i) * 5, y })), age + 1);
    drawProjectile(ctx, weapon, special, 350, y, 0, age);
    drawImpact(ctx, weapon, special, 760, y, age);
    ctx.strokeStyle = '#708091'; ctx.beginPath(); ctx.moveTo(0, row * 130 + 129); ctx.lineTo(1100, row * 130 + 129); ctx.stroke();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
