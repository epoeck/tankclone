import { DEFAULT_PHYSICS, muzzlePoint, Terrain, simulateShot, type Facing, type PhysicsConfig, type Shot } from "@tankclone/core";

const W = 2200, H = 600; // mapa largo: 20 unidades de distância = 2000 px (1 un = 100 px)
const UNIT = 100;
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const out = document.getElementById("out")!;

const makeTerrain = () => Terrain.fromHeightFn(W, H, x => 430 + Math.sin(x / 90) * 28 + Math.sin(x / 33) * 8);
let terrain = makeTerrain();
const isSolid = (x: number, y: number) => terrain.isSolid(x, y);
const groundY = (x: number) => { const y = terrain.surfaceY(x); return y < 0 ? H : y; };

// Cache do terreno em canvas offscreen; só redesenha quando a máscara muda.
const terrainCanvas = document.createElement("canvas");
terrainCanvas.width = W; terrainCanvas.height = H;
function renderTerrain() {
  const c = terrainCanvas.getContext("2d")!;
  const img = c.createImageData(W, H), m = terrain.getMask();
  for (let i = 0; i < m.length; i++) {
    if (m[i]) { img.data[i * 4] = 59; img.data[i * 4 + 1] = 74; img.data[i * 4 + 2] = 47; img.data[i * 4 + 3] = 255; }
  }
  c.putImageData(img, 0, 0);
}
renderTerrain();
let boomR = 30;

const cfg: PhysicsConfig = { ...DEFAULT_PHYSICS };
const state = { x: 120, angleDeg: 45, power: 60, wind: 0, facing: 1 as Facing };

type Slider = { key: string; label: string; min: number; max: number; step: number; get: () => number; set: (v: number) => void };
const slider = (host: string, s: Slider) => {
  const el = document.createElement("label");
  el.innerHTML = `<span>${s.label}</span><b></b><input type="range" min="${s.min}" max="${s.max}" step="${s.step}">`;
  const input = el.querySelector("input")!, val = el.querySelector("b")!;
  const sync = () => { input.value = String(s.get()); val.textContent = String(+s.get().toFixed(3)); };
  input.oninput = () => { s.set(+input.value); sync(); draw(); };
  document.getElementById(host)!.append(el);
  syncers.push(sync); sync();
};
const syncers: Array<() => void> = [];

slider("shot", { key: "a", label: "Ângulo (°)", min: 0, max: 180, step: 1, get: () => state.angleDeg, set: v => (state.angleDeg = v) });
slider("shot", { key: "p", label: "Força", min: 0, max: 100, step: 0.1, get: () => state.power, set: v => (state.power = v) });
slider("shot", { key: "w", label: "Vento", min: -10, max: 10, step: 0.1, get: () => state.wind, set: v => (state.wind = v) });
slider("boom", { key: "r", label: "Raio da cratera", min: 5, max: 80, step: 1, get: () => boomR, set: v => (boomR = v) });
slider("phys", { key: "g", label: "Gravidade", min: 100, max: 1500, step: 1, get: () => cfg.gravity, set: v => (cfg.gravity = v) });
slider("phys", { key: "s", label: "Vel. por força", min: 2, max: 20, step: 0.1, get: () => cfg.speedPerPower, set: v => (cfg.speedPerPower = v) });
slider("phys", { key: "dr", label: "Arrasto do ar", min: 0, max: 0.5, step: 0.005, get: () => cfg.drag, set: v => (cfg.drag = v) });
slider("phys", { key: "wa", label: "Efeito do vento", min: 0, max: 40, step: 0.5, get: () => cfg.windAccel, set: v => (cfg.windAccel = v) });

const flip = document.getElementById("flip") as HTMLButtonElement;
flip.onclick = () => { state.facing = (state.facing === 1 ? -1 : 1) as Facing; draw(); };
(document.getElementById("reset") as HTMLButtonElement).onclick = () => { Object.assign(cfg, DEFAULT_PHYSICS); syncers.forEach(f => f()); draw(); };

function fire() {
  const mz = muzzlePoint(state.x, groundY(state.x), state.facing, terrain.slopeDeg(state.x, groundY(state.x), state.facing));
  const res = simulateShot({ x: mz.x, y: mz.y, angleDeg: state.angleDeg, power: state.power, facing: state.facing, wind: state.wind }, isSolid, cfg);
  if (res.hit) { terrain.carveCircle(res.hit.x, res.hit.y, boomR); renderTerrain(); }
  draw();
}
(document.getElementById("fire") as HTMLButtonElement).onclick = fire;
(document.getElementById("flatbtn") as HTMLButtonElement).onclick = () => { terrain = Terrain.fromHeightFn(W, H, () => 430); renderTerrain(); draw(); };
(document.getElementById("regen") as HTMLButtonElement).onclick = () => { terrain = makeTerrain(); renderTerrain(); draw(); };

canvas.onclick = e => {
  const r = canvas.getBoundingClientRect();
  state.x = Math.max(10, Math.min(W - 10, ((e.clientX - r.left) * W) / r.width));
  draw();
};
addEventListener("keydown", e => {
  if (e.code === "Space") { e.preventDefault(); fire(); return; }
  const d: Record<string, () => void> = {
    ArrowLeft: () => (state.angleDeg = Math.max(0, state.angleDeg - 1)),
    ArrowRight: () => (state.angleDeg = Math.min(180, state.angleDeg + 1)),
    ArrowUp: () => (state.power = Math.min(100, state.power + 1)),
    ArrowDown: () => (state.power = Math.max(0, state.power - 1)),
  };
  if (d[e.key]) { e.preventDefault(); d[e.key]!(); syncers.forEach(f => f()); draw(); }
});

function draw() {
  ctx.clearRect(0, 0, W, H);
  // terreno
  ctx.drawImage(terrainCanvas, 0, 0);

  const mz = muzzlePoint(state.x, groundY(state.x), state.facing, terrain.slopeDeg(state.x, groundY(state.x), state.facing));
  const sy = mz.y;
  const shot: Shot = { x: mz.x, y: mz.y, angleDeg: state.angleDeg, power: state.power, facing: state.facing, wind: state.wind };
  const res = simulateShot(shot, isSolid, cfg);

  // trajetória
  ctx.strokeStyle = "#ffcf5a"; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath();
  res.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke(); ctx.setLineDash([]);

  // atirador + cano
  ctx.fillStyle = "#6aa7ff"; ctx.fillRect(state.x - 10, sy - 6, 20, 16);
  const a = (state.angleDeg * Math.PI) / 180;
  ctx.strokeStyle = "#cfe"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(state.x, sy);
  ctx.lineTo(state.x + Math.cos(a) * 26 * state.facing, sy - Math.sin(a) * 26); ctx.stroke();

  // impacto
  if (res.hit) { ctx.fillStyle = "#ff5a5a"; ctx.beginPath(); ctx.arc(res.hit.x, res.hit.y, 6, 0, 7); ctx.fill(); }

  // seta do vento
  ctx.fillStyle = "#9bd"; ctx.font = "14px system-ui";
  ctx.fillText(`vento ${state.wind > 0 ? "→" : state.wind < 0 ? "←" : "·"} ${Math.abs(state.wind)}`, 16, 24);

  const apex = Math.min(...res.points.map(p => p.y));
  flip.textContent = state.facing === 1 ? "→ direita" : "← esquerda";
  out.innerHTML = res.hit
    ? `Impacto x: <b>${res.hit.x.toFixed(0)}</b> px<br>Distância: <b>${(Math.abs(res.hit.x - state.x) / UNIT).toFixed(1)}</b> un (${Math.abs(res.hit.x - state.x).toFixed(0)} px)<br>Altura máx.: <b>${(sy - apex).toFixed(0)}</b> px<br>Tempo: <b>${(res.steps * cfg.dt).toFixed(2)}</b> s`
    : `Sem impacto (saiu do alcance de ${res.steps} passos)`;
}
draw();
