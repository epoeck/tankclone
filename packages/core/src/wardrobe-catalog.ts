import catalog from "./reference/cn-wardrobe.json";
import type { AvatarSex } from "./appearance";

export type WardrobeSlot = "face" | "hair" | "cloth" | "head" | "glass";
export interface CatalogPiece {
  pic: string; complete: boolean; source: string; show: boolean; icon: string | null;
  variants: Record<string, { game: (string | null)[]; show: (string | null)[] }>;
}
const legacy: Record<WardrobeSlot, number> = { face: 3, hair: 3, cloth: 3, head: 2, glass: 1 };
export function cnPieces(sex: AvatarSex, slot: WardrobeSlot): CatalogPiece[] { return catalog.sexes[sex][slot] as CatalogPiece[]; }
export function cnPiece(sex: AvatarSex, slot: WardrobeSlot, index: number): CatalogPiece | undefined {
  return cnPieces(sex, slot)[index - legacy[slot]];
}
export function isAvailablePiece(sex: AvatarSex, slot: WardrobeSlot, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && (index < legacy[slot] || !!cnPiece(sex, slot, index)?.complete);
}
export function legacyCount(slot: WardrobeSlot): number { return legacy[slot]; }
