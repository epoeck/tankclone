/** Partida local (hot-seat) sobre o Match do core: segurar/soltar força, régua, câmera + minimapa, barra de itens. */
import {
  ITEMS, MUZZLE_HEIGHT, PLAYER_HITBOX, Terrain, WEAPONS, Match, clampAbsoluteAngle,
  type Facing, type ItemKey, type MatchEvent,
} from "@tankclone/core";

const W = 2000, H = 600, VIEW_W = 1000, UNIT = 100;
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

// ---------- mapa de demonstração: colinas destrutíveis sobre faixa indestrutível ----------
const terrain = Terrain.fromHeightFn(W, H, x => 400 + Math.sin(x / 140) * 40 + Math.sin(x / 47) * 10);
terrain.fillIndestructible(0, H - 30, W, H);
const match = new Match({
  seed: (Date.now() & 0xffff) | 1, terrain,
  players: [
    { id: "A1", team: 1, x: 200, weaponId: "prism", agi: 3300, facing: 1 },
    { id: "B1", team: 2, x: 1800, weaponId: "sledge", agi: 3300, facing: -1 },
    { id: "A2", team: 1, x: 420, weaponId: "furnace", agi: 0, facing: 1 },
    { id: "B2", team: 2, x: 1580, weaponId: "prism", agi: 0, facing: -1 },
  ],
});
const COLORS: Record<number, string> = { 1: "#6aa7ff", 2: "#ff8a6a" };

// ---------- terreno em canvas offscreen (cratera = destination-out) ----------
const tc = document.createElement("canvas"); tc.width = W; tc.height = H;
const tctx = tc.getContext("2d")!;
{
  const img = tctx.createImageData(W, H), m = terrain.getMask();
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const c = m[i] === 2 ? [90, 90, 105] : [74, 98, 58];
    img.data.set([c[0]!, c[1]!, c[2]!, 255], i * 4);
  }
  tctx.putImageData(img, 0, 0);
}

// ---------- estado de visualização, atualizado pelos eventos (permite animar o tiro) ----------
interface View { x: number; y: number; hp: number; maxHp: number; fury: number; alive: boolean; facing: Facing }
const view = new Map<string, View>(match.chars.map(c => [c.id, { x: c.x, y: c.y, hp: c.hp, maxHp: c.maxHp, fury: c.fury, alive: true, facing: c.facing }]));
const hud = { wind: 0, energy: 0, turn: 1, player: match.currentId, time: 10, over: false, winner: null as number | null };
const ui = { angle: 45, power: 0, charging: false, special: false, msg: "" };
const queue: MatchEvent[] = [];
let anim: { points: Array<{ x: number; y: number }>; i: number } | null = null;
let cam = 0;

function apply(e: MatchEvent) {
  const v = "playerId" in e ? view.get(e.playerId) : undefined;
  switch (e.type) {
    case "turnStart": hud.wind = e.wind; hud.energy = e.energy; hud.turn = e.turn; hud.player = e.playerId; hud.time = e.timeLimit;
      ui.power = 0; ui.special = false; break;
    case "move": if (v) { const p = e.path[e.path.length - 1]; if (p) { v.x = p.x; v.y = p.y; } } break;
    case "fall": if (v) v.y = e.toY; break;
    case "fly": if (v) { v.x = e.x; v.y = e.y; } break;
    case "item": hud.energy = e.energyLeft; break;
    case "crater": tctx.globalCompositeOperation = "destination-out"; tctx.beginPath(); tctx.arc(e.x, e.y, e.radius, 0, 7); tctx.fill(); tctx.globalCompositeOperation = "source-over"; break;
    case "damage": if (v) v.hp = e.hp; break;
    case "fury": if (v) v.fury = e.fury; break;
    case "death": if (v) v.alive = false; break;
    case "gameOver": hud.over = true; hud.winner = e.winnerTeam; break;
    case "shot": anim = { points: e.points, i: 0 }; break;
    case "turnEnd": break;
  }
}
const push = (es: MatchEvent[]) => queue.push(...es);
push(match.startEvents);

function submit(i: Parameters<Match["submit"]>[0]) {
  if (anim || queue.length) return;
  const o = match.submit(i);
  if (!o.ok) { ui.msg = o.error; return; }
  ui.msg = ""; push(o.events);
  // move/item/fall não têm animação própria: aplicados já no quadro seguinte
}

// ---------- entrada ----------
const keys = new Set<string>();
addEventListener("keydown", e => {
  if (e.repeat && e.code === "Space") { e.preventDefault(); return; }
  keys.add(e.code);
  const id = match.currentId;
  if (hud.over) return;
  if (e.code === "Space") { e.preventDefault(); if (!anim && !queue.length) { ui.charging = true; ui.power = 0; } return; }
  const k = e.key.toUpperCase();
  if (k in ITEMS) submit({ type: "item", playerId: id, key: k as ItemKey });
  else if (k === "P") submit({ type: "pass", playerId: id });
  else if (k === "R") ui.special = !ui.special;
});
addEventListener("keyup", e => {
  keys.delete(e.code);
  if (e.code === "Space" && ui.charging) {
    ui.charging = false;
    if (ui.power > 1) submit({ type: "shoot", playerId: match.currentId, angleDeg: ui.angle, power: ui.power, special: ui.special });
    ui.power = 0;
  }
});

// ---------- laço principal ----------
let last = performance.now(), walkAcc = 0, angleAcc = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const busy = !!anim || queue.length > 0;
  const cur = match.getChar(match.currentId)!;
  if (!busy && !hud.over) {
    if (ui.charging) { ui.power = Math.min(100, ui.power + 70 * dt); if (ui.power >= 100) { keys.delete("Space"); ui.charging = false; submit({ type: "shoot", playerId: cur.id, angleDeg: ui.angle, power: 100, special: ui.special }); ui.power = 0; } }
    const dir = (keys.has("ArrowRight") ? 1 : 0) - (keys.has("ArrowLeft") ? 1 : 0);
    if (dir && !ui.charging) { walkAcc += dt * 80; const px = Math.floor(walkAcc); if (px > 0) { walkAcc -= px; submit({ type: "move", playerId: cur.id, dir: dir as Facing, px }); } }
    const ad = (keys.has("ArrowUp") ? 1 : 0) - (keys.has("ArrowDown") ? 1 : 0);
    if (ad) { angleAcc += dt * 40; const d = Math.floor(angleAcc); if (d > 0) { angleAcc -= d; ui.angle += ad * d; } }
    const slope = terrain.slopeDeg(cur.x, cur.y, cur.facing);
    ui.angle = clampAbsoluteAngle(ui.angle, WEAPONS[cur.weaponId]!.angle, slope);
    const ticks = match.tick(dt);
    if (ticks.length) push(ticks);
    hud.time = match.timeLeft;
  }
  // consome eventos; o tiro anima ponto a ponto
  if (anim) {
    anim.i += Math.max(1, Math.round(900 * dt / 8)); // ~900 px/s (≈8 px por ponto)
    if (anim.i >= anim.points.length) anim = null;
  }
  while (!anim && queue.length) { const e = queue.shift()!; apply(e); if (e.type === "shot") break; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- desenho ----------
function draw() {
  const cur = view.get(hud.player)!;
  const target = anim ? anim.points[Math.min(anim.i, anim.points.length - 1)]!.x : cur.x;
  cam += (Math.max(0, Math.min(W - VIEW_W, target - VIEW_W / 2)) - cam) * 0.15;
  ctx.clearRect(0, 0, VIEW_W, H);
  ctx.save(); ctx.translate(-Math.round(cam), 0);
  ctx.drawImage(tc, 0, 0);

  const cc = match.getChar(hud.player)!;
  const weapon = WEAPONS[cc.weaponId]!;
  // régua de distância (1 un = 100 px) na linha dos pés do jogador da vez
  if (!hud.over && cur.alive) {
    ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "11px system-ui"; ctx.lineWidth = 1;
    for (let u = 1; u <= 20; u++) { const x = cur.x + cur.facing * u * UNIT; if (x < 0 || x > W) break; ctx.beginPath(); ctx.moveTo(x, cur.y - 8); ctx.lineTo(x, cur.y + 8); ctx.stroke(); ctx.fillText(String(u), x - 3, cur.y + 22); }
  }
  // personagens
  for (const c of match.chars) {
    const v = view.get(c.id)!; if (!v.alive) continue;
    ctx.fillStyle = COLORS[c.team]!; ctx.fillRect(v.x - PLAYER_HITBOX.w / 2, v.y - PLAYER_HITBOX.h, PLAYER_HITBOX.w, PLAYER_HITBOX.h);
    ctx.strokeStyle = c.id === hud.player ? "#fff" : "#0006"; ctx.lineWidth = 2; ctx.strokeRect(v.x - PLAYER_HITBOX.w / 2, v.y - PLAYER_HITBOX.h, PLAYER_HITBOX.w, PLAYER_HITBOX.h);
    bar(v.x - 22, v.y - PLAYER_HITBOX.h - 12, 44, 5, v.hp / v.maxHp, "#5c5");
    if (c.id === hud.player && !anim) { // cano
      const a = (ui.angle * Math.PI) / 180, sy = v.y - MUZZLE_HEIGHT;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(v.x, sy); ctx.lineTo(v.x + Math.cos(a) * 34 * cc.facing, sy - Math.sin(a) * 34); ctx.stroke();
    }
  }
  if (anim) { const p = anim.points[Math.min(anim.i, anim.points.length - 1)]!; ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); }
  ctx.restore();

  // HUD
  ctx.fillStyle = "#0008"; ctx.fillRect(0, 0, VIEW_W, 44);
  ctx.fillStyle = "#fff"; ctx.font = "14px system-ui";
  ctx.fillText(`${hud.player} · ${weapon.name}  turno ${hud.turn}  ${Math.ceil(hud.time)}s`, 12, 18);
  const w = hud.wind;
  ctx.fillText(`vento ${w === 0 ? "·" : w > 0 ? "→" : "←"} ${Math.abs(w).toFixed(1)}`, 12, 37);
  ctx.fillText(`ângulo ${Math.round(ui.angle)}°${ui.special ? "  [ESPECIAL]" : ""}`, 200, 18);
  ctx.fillText(`energia ${cc.energy}`, 200, 37);
  const v = view.get(hud.player)!;
  ctx.fillText("fúria", 330, 18); bar(375, 8, 100, 10, v.fury / 100, "#e8a33a");
  ctx.fillText("força", 330, 37); bar(375, 28, 100, 10, ui.power / 100, "#e55");
  if (ui.msg) { ctx.fillStyle = "#fc8"; ctx.fillText(ui.msg, 500, 18); }
  // itens
  const keysList: ItemKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "F"];
  keysList.forEach((k, i) => {
    const x = 12 + i * 52, y = H - 50, can = cc.energy >= ITEMS[k].cost;
    ctx.fillStyle = can ? "#2b3550" : "#2228"; ctx.fillRect(x, y, 46, 40);
    ctx.fillStyle = can ? "#fff" : "#888"; ctx.font = "bold 15px system-ui"; ctx.fillText(k, x + 6, y + 18);
    ctx.font = "11px system-ui"; ctx.fillText(String(ITEMS[k].cost), x + 6, y + 34);
  });
  const ti = match.turnInfo;
  ctx.fillStyle = "#fff"; ctx.font = "12px system-ui";
  ctx.fillText(`dano +${Math.round(ti.bonus * 100)}%${ti.extraShots ? `  +${ti.extraShots} tiros` : ""}${ti.triple ? "  triplo" : ""}${ti.fly ? "  VOAR" : ""}`, 12, H - 58);
  // minimapa
  const mw = 200, mh = (H / W) * mw, mx = VIEW_W - mw - 10, my = 52;
  ctx.fillStyle = "#000a"; ctx.fillRect(mx, my, mw, mh); ctx.drawImage(tc, 0, 0, W, H, mx, my, mw, mh);
  for (const c of match.chars) { const vv = view.get(c.id)!; if (vv.alive) { ctx.fillStyle = COLORS[c.team]!; ctx.fillRect(mx + (vv.x / W) * mw - 2, my + (vv.y / H) * mh - 4, 4, 4); } }
  ctx.strokeStyle = "#fff"; ctx.strokeRect(mx + (cam / W) * mw, my, (VIEW_W / W) * mw, mh);

  if (hud.over) {
    ctx.fillStyle = "#000b"; ctx.fillRect(0, 230, VIEW_W, 100);
    ctx.fillStyle = "#fff"; ctx.font = "bold 32px system-ui"; ctx.textAlign = "center";
    ctx.fillText(hud.winner === null ? "Empate" : `Time ${hud.winner} venceu!`, VIEW_W / 2, 290); ctx.textAlign = "left";
  }
}
function bar(x: number, y: number, w: number, h: number, f: number, color: string) {
  ctx.fillStyle = "#0008"; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}
