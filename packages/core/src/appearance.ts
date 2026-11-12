import { isAvailablePiece, cnPieces, legacyCount, type WardrobeSlot } from "./wardrobe-catalog";
/**
 * Aparência do personagem clássico, composta por itens e folhas GAME/SHOW.
 * - `Appearance`: sexo, pele, rosto, cabelo + cor do cabelo — escolha livre do jogador.
 * - `EquippedLook`: visual dos EQUIPAMENTOS vestidos (roupa, chapéu). No original eles também dão stats; na 1ª build, sem
 *   inventário real, são itens placeholder em que o índice é o próprio visual (futuro: ItemDef.visual).
 * Índices estáveis selecionam o catálogo local de PNGs clássicos; contas antigas recebem sexo masculino.
 */

export const SKIN_TONES = ["#FFE0C7", "#F2C79F", "#D9A066", "#B97A4B", "#8A5530", "#5E3A22"] as const;
export const PIECE_COLORS = ["#6B3A1F", "#1F1F2B", "#F5C542", "#E0372A", "#3B6FD1", "#4FC263", "#F28FC2", "#E8ECF2"] as const;
export const HAIR_COLORS = ["#6B3A1F", "#1F1F2B", "#F5C542", "#E0372A", "#3B6FD1", "#4FC263", "#F28FC2", "#E8ECF2"] as const;
/** Opções do catálogo clássico (src/reference/avatar.json). hat/glasses/wings: 0 = sem item. */
export const COUNTS = { skin: SKIN_TONES.length, face: 3, hair: 3, hairColor: HAIR_COLORS.length, outfit: 3, hat: 3, glasses: 2, wings: 2 } as const;

export type AvatarSex = "m" | "f";
export interface Appearance { sex: AvatarSex; skin: number; face: number; hair: number; hairColor: number }
/** Índice do item equipado em cada slot visual; outfit 0..2 (arquivo n+1); hat/glasses/wings 0 = nenhum. */
export interface EquippedLook { outfit: number; hat: number; glasses: number; wings: number }
export interface Look { appearance: Appearance; equipped: EquippedLook; tints?: { face: Record<string, number>; outfit: Record<string, number>; hat: Record<string, number> } }

/** Camadas de trás para frente (o braço com a arma é desenhado à parte, para girar com o ângulo). */
export const LAYER_ORDER = ["wings", "hair-back", "body", "outfit", "face", "hair-front", "glasses", "hat", "weapon", "arm"] as const;

export const DEFAULT_LOOK: Look = { appearance: { sex: "m", skin: 1, face: 0, hair: 0, hairColor: 1 }, equipped: { outfit: 0, hat: 0, glasses: 0, wings: 0 }, tints: { face: {}, outfit: {}, hat: {} } };

const int = (v: unknown, max: number, fallback: number): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : fallback;

/** Aceita qualquer lixo e devolve um Look válido (índices inteiros dentro dos limites). */
export function sanitizeLook(raw: unknown): Look {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as { appearance?: Record<string, unknown>; equipped?: Record<string, unknown>; tints?: Record<string, unknown> };
  const a = (o.appearance ?? {}) as Record<string, unknown>, e = (o.equipped ?? {}) as Record<string, unknown>;
  const d = DEFAULT_LOOK;
  const t = o.tints && typeof o.tints === "object" ? o.tints : {};
  const sex = a.sex === "f" ? "f" : "m";
  const piece = (v: unknown, slot: WardrobeSlot, offset = 0) => {
    if (offset && v === 0) return 0;
    return typeof v === "number" && isAvailablePiece(sex, slot, v - offset) ? v : 0;
  };
  const colors = (value: unknown, slot: WardrobeSlot, offset = 0): Record<string, number> => {
    const out: Record<string, number> = {};
    if (!value || typeof value !== "object") return out;
    for (const [key, v] of Object.entries(value)) {
      if (!/^(?:[mf]:)?(?:0|[1-9][0-9]*)$/.test(key) || typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= PIECE_COLORS.length) continue;
      const [prefix, suffix] = key.includes(":") ? key.split(":") : ["", key];
      const index = Number(suffix) - offset;
      const max = legacyCount(slot) + Math.max(cnPieces("m", slot).length, cnPieces("f", slot).length);
      if (index < 0 || index >= max || (prefix && !isAvailablePiece(prefix as AvatarSex, slot, index))) continue;
      out[key] = v;
    }
    return out;
  };
  return {
    appearance: { sex, skin: int(a.skin, COUNTS.skin, d.appearance.skin), face: piece(a.face, "face"),
      hair: piece(a.hair, "hair"), hairColor: int(a.hairColor, COUNTS.hairColor, d.appearance.hairColor) },
    tints: { face: colors(t.face, "face"), outfit: colors(t.outfit, "cloth"), hat: colors(t.hat, "head", 1) },
    equipped: { outfit: piece(e.outfit, "cloth"), hat: piece(e.hat, "head", 1), glasses: piece(e.glasses, "glass", 1), wings: int(e.wings, COUNTS.wings, 0) },
  };
}
