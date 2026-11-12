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

/** Atributos de uma peça (TemplateAlllist do CN 14.7: quase todas dão +5 em cada). Peças clássicas antigas não têm. */
export type PieceStats = { atk: number; def: number; agi: number; luck: number };
export const NO_STATS: PieceStats = { atk: 0, def: 0, agi: 0, luck: 0 };
export function pieceInfo(sex: AvatarSex, slot: WardrobeSlot, index: number): { name?: string; templateId?: number; stats: PieceStats } {
  const p = cnPiece(sex, slot, index) as (CatalogPiece & { name?: string; templateId?: number; stats?: PieceStats }) | undefined;
  return { name: p?.name, templateId: p?.templateId, stats: p?.stats ?? NO_STATS };
}
