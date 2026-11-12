/** Composição do avatar clássico: GameCharacterLoader / ShowCharacterLoader do cliente 4.1.
 * Recursos PNG compatíveis do mesmo pacote doador usado pelo Reborn. Ver docs/avatar.md. */
import catalog from "./reference/avatar.json";
import { HAIR_COLORS, SKIN_TONES, sanitizeLook, type Look } from "./appearance";

export type AvatarMode = "game" | "show";
export interface AvatarLayer {
  slot: "face" | "cloth" | "hair" | "head" | "glass" | "weapon" | "wing";
  group: "face" | "upper" | "weapon" | "wing";
  file: string;
  tint?: string;
}

/** A ordem reproduz faceDown (arma), face e faceUp (cabelo/roupa/chapéu/óculos). */
export function avatarLayers(raw: Look, weaponId: string, mode: AvatarMode): AvatarLayer[] {
  const look = sanitizeLook(raw), a = look.appearance, e = look.equipped;
  const sex = catalog.sexes[a.sex];
  const layers: AvatarLayer[] = [];
  if (e.wings) layers.push({ slot: "wing", group: "wing", file: catalog.wings["1"] });
  const weapons: Record<string, { game: string; show: string }> = catalog.weapons;
  const weapon = Object.hasOwn(weapons, weaponId) ? weapons[weaponId]! : weapons.sledge!;
  // No retrato a arma é a última camada. Na batalha vai atrás do rosto e do corpo.
  if (mode === "game") layers.push({ slot: "weapon", group: "weapon", file: weapon[mode] });
  const part = (slot: "face" | "cloth" | "hair" | "head" | "glass", index: number) => {
    const item = sex[slot][index]!;
    const variants = item.variants as Record<string, { game: string[]; show: string[] }>;
    const files = variants[slot === "hair" ? e.hat ? "A" : "B" : "default"]![mode];
    const group = slot === "face" ? "face" : "upper";
    layers.push({ slot, group, file: files[0]! });
    if (slot === "hair") layers.push({ slot, group, file: files[1]!, tint: HAIR_COLORS[a.hairColor] });
    if (slot === "face" || slot === "cloth") layers.push({ slot, group, file: files[2]!, tint: SKIN_TONES[a.skin] });
  };
  part("face", a.face);
  part("hair", a.hair);
  part("cloth", e.outfit);
  if (e.hat) part("head", e.hat - 1);
  if (e.glasses) part("glass", e.glasses - 1);
  if (mode === "show") layers.push({ slot: "weapon", group: "weapon", file: weapon[mode] });
  return layers;
}

export const GAME_FRAME = { width: 114, height: 95, columns: 13, count: 39, feetX: 62, feetY: 91 } as const;
export const SHOW_FRAME = { width: 250, height: 312, feetX: 125, feetY: 305 } as const;
const WALK = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5];
const IDLE = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,6,6,7,7,8,8,9,9,9,9,8,8,7,7,6,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,10,10,10,10,10,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,10,10,10,10,10];

/** GameCharacter.HANDCLIP: o boneco "bate a mão" ao usar item (quadros 13–15, 50 passos a 25 fps = 2 s). */
export const HANDCLIP_SECONDS = 2;
const HANDCLIP = [13, 13, 14, 14, 15, 15, 14, 14];

export function avatarFrames(timeSeconds: number, walking: boolean, aiming: boolean, action?: "shoot" | "hit" | "handclip", actionElapsed = 0): { face: number; upper: number; weapon: number } {
  if (action === "handclip") { const f = HANDCLIP[Math.floor(Math.max(0, actionElapsed) * 25) % HANDCLIP.length]!; return { face: f, upper: f, weapon: f }; }
  if (action === "hit") return { face: 12, upper: 12, weapon: 12 };
  if (action === "shoot") {
    const frame = [22, 23, 26, 27][Math.min(3, Math.max(0, Math.floor(actionElapsed * 25)))]!;
    return { face: frame, upper: frame, weapon: frame };
  }
  if (walking) {
    const frame = WALK[Math.floor(Math.max(0, timeSeconds) * 25) % WALK.length]!;
    return { face: frame, upper: frame, weapon: frame };
  }
  // A mira não levanta o personagem; SHOWGUN pertence à ação de disparo.
  const frame = IDLE[Math.floor(Math.max(0, timeSeconds) * 25) % IDLE.length]!;
  return { face: frame, upper: frame === 0 || frame === 10 ? 7 : frame, weapon: frame };
}

export function avatarFrameRect(frame: number): { x: number; y: number; w: number; h: number } {
  const index = Number.isInteger(frame) && frame >= 0 && frame < GAME_FRAME.count ? frame : 0;
  return { x: index % GAME_FRAME.columns * GAME_FRAME.width, y: Math.floor(index / GAME_FRAME.columns) * GAME_FRAME.height, w: GAME_FRAME.width, h: GAME_FRAME.height };
}

/** BitmapUtils: cor sólida na máscara + a mesma máscara em HARDLIGHT para preservar relevo. */
export function avatarTint(hex: string): { fill: number[]; highlight: number[] } {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255], fill = [...rgb];
  let highlight = [0, 0, 0];
  const [r, g, b] = rgb as [number, number, number];
  if (r !== g && r !== b && g !== b) {
    if (r < g && r < b) { fill[1]! += 40; fill[2]! += 10; }
    else if (g < r && g < b) { fill[0]! += 40; fill[2]! += 10; }
    else { fill[1]! += 40; fill[0]! += 10; }
    highlight = r > g && r > b ? [50, 0, 0] : g > b ? [10, 30, 30] : [0, 0, 50];
  }
  return { fill: fill.map(c => Math.min(255, c)), highlight };
}
