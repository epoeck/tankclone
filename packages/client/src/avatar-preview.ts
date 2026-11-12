import { COUNTS, DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, WEAPONS } from "@tankclone/core";
import { drawCharacter, drawCharPortrait } from "./chars";
import { drawDeath } from "./death";

const look = structuredClone(DEFAULT_LOOK);
const portrait = document.getElementById("portrait") as HTMLCanvasElement;
const battle = document.getElementById("battle") as HTMLCanvasElement;
const ctx = battle.getContext("2d")!;
const controls = document.getElementById("controls")!;
let weaponId = "sledge", action = "idle";
function select(label: string, values: Array<[string, string]>, value: string, set: (value: string) => void) {
  const row = document.createElement("label"); row.append(label);
  const input = document.createElement("select");
  for (const [key, text] of values) { const option = document.createElement("option"); option.value = key; option.textContent = text; input.append(option); }
  input.value = value; input.onchange = () => set(input.value); row.append(input); controls.append(row);
}
select("Avatar", [["m", "Masculino"], ["f", "Feminino"]], look.appearance.sex, v => (look.appearance.sex = v === "f" ? "f" : "m"));
for (const [key, label] of [["face", "Rosto"], ["hair", "Cabelo"], ["skin", "Pele"], ["hairColor", "Cor do cabelo"]] as const) {
  const count = key === "skin" ? SKIN_TONES.length : key === "hairColor" ? HAIR_COLORS.length : COUNTS[key];
  select(label, Array.from({ length: count }, (_, i) => [String(i), String(i + 1)]), String(look.appearance[key]), v => (look.appearance[key] = +v));
}
for (const [key, label] of [["outfit", "Roupa"], ["hat", "Chapéu"], ["glasses", "Óculos"], ["wings", "Asas"]] as const) {
  select(label, Array.from({ length: COUNTS[key] }, (_, i) => [String(i), key !== "outfit" && i === 0 ? "Sem item" : String(key === "outfit" ? i + 1 : i)]), String(look.equipped[key]), v => (look.equipped[key] = +v));
}
select("Arma", Object.values(WEAPONS).map(w => [w.id, w.name]), weaponId, v => (weaponId = v));
select("Animação", [["idle", "Parado"], ["walk", "Andando"], ["aim", "Mirando"], ["shoot", "Atirando"], ["hit", "Recebendo dano"], ["death", "Morte"]], action, v => (action = v));
function frame() {
  drawCharPortrait(portrait, look, weaponId);
  ctx.clearRect(0, 0, battle.width, battle.height);
  ctx.fillStyle = "#8ba880"; ctx.fillRect(0, 226, battle.width, 34);
  const elapsed = performance.now() / 1000 % 0.8;
  for (const [x, facing] of [[170, 1], [450, -1]] as const) {
    if (action === "death") { drawDeath(ctx, look, weaponId, x, 226, facing, performance.now() / 1000, 0); continue; }
    drawCharacter(ctx, look, {
    facing, weaponId, angleDeg: 45, walk: action === "walk" ? 1 : 0, aiming: action === "aim",
    action: elapsed < 0.24 && (action === "shoot" || action === "hit") ? action : undefined, actionElapsed: elapsed,
  }, x, 226, 2);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
