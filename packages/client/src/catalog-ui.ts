/** Catálogo de peças para as telas de loja e mochila (nomes, ícones, atributos), e a ponte item da mochila ↔ categoria do visual. */
import { cn147Wing, cnPieces, legacyCount, pieceInfo, COUNTS, type AvatarSex, type ItemInstance, type ItemKind, type Look, type PieceStats, type WardrobeSlot } from "@tankclone/core";

export type Category = "outfit" | "hair" | "face" | "hat" | "glasses" | "wings";
export type Piece = { id: string; category: Category; index: number; name: string; complete: boolean; icon?: string | null; stats?: PieceStats };
export const CATEGORIES: { id: Category; label: string; singular: string; optional?: boolean }[] = [
  { id: "outfit", label: "Roupas", singular: "Roupa" },
  { id: "hair", label: "Cabelos", singular: "Cabelo" },
  { id: "face", label: "Rostos", singular: "Rosto" },
  { id: "hat", label: "Chapéus", singular: "Chapéu", optional: true },
  { id: "glasses", label: "Óculos", singular: "Óculos", optional: true },
  { id: "wings", label: "Asas", singular: "Asas", optional: true },
];
// Catálogo da build atual. A importação futura pode substituir esta lista mantendo a UI.
export const LEGACY_PIECES: Piece[] = CATEGORIES.flatMap(c => Array.from(
  { length: COUNTS[c.id] - (c.optional ? 1 : 0) }, (_, n) => {
    const index = n + (c.optional ? 1 : 0);
    return { id: `${c.id}-${index}`, category: c.id, index, name: c.id === "wings" && cn147Wing(index) ? cn147Wing(index)!.name : `${c.singular} ${n + 1}`, complete: true };
  },
));
export const slotFor: Partial<Record<Category, WardrobeSlot>> = { outfit: "cloth", hair: "hair", face: "face", hat: "head", glasses: "glass" };
export function pieces(sex: AvatarSex): Piece[] {
  return [...LEGACY_PIECES, ...CATEGORIES.flatMap(c => {
    const slot = slotFor[c.id]; if (!slot) return [];
    const offset = c.optional ? 1 : 0;
    return cnPieces(sex, slot).map((item, i) => ({ id: `${c.id}-${i + legacyCount(slot) + offset}`, category: c.id,
      index: i + legacyCount(slot) + offset, name: (item as { name?: string }).name || `${c.singular} ${item.pic}`, complete: item.complete, icon: item.icon,
      stats: (item as { stats?: PieceStats }).stats }));
  })];
}

/** Categoria do visual ↔ tipo do item da mochila. */
export const KIND_OF: Record<Category, ItemKind> = { outfit: "cloth", hair: "hair", face: "face", hat: "head", glasses: "glass", wings: "wing" };
export const CATEGORY_OF: Partial<Record<ItemKind, Category>> = { cloth: "outfit", hair: "hair", face: "face", head: "hat", glass: "glasses", wing: "wings" };
/** Índice do visual de uma peça (mesmo valor guardado no Look; chapéu e óculos já contam o deslocamento +1). */
export const itemIndex = (item: ItemInstance) => Number(item.ref) || 0;
export const KIND_LABEL: Record<ItemKind, string> = { head: "Chapéu", glass: "Óculos", hair: "Cabelo", eff: "Efeito", cloth: "Roupa", face: "Rosto", weapon: "Arma", wing: "Asas", armlet: "Bracelete", ring: "Anel", suits: "Traje", necklace: "Colar", offhand: "Secundária" };

export function itemName(item: ItemInstance, weaponName: (id: string) => string): string {
  if (item.kind === "weapon") return weaponName(item.ref);
  const category = CATEGORY_OF[item.kind];
  const piece = category && pieces(item.sex === "f" ? "f" : "m").find(p => p.category === category && p.index === itemIndex(item));
  return piece?.name ?? `${KIND_LABEL[item.kind]} ${itemIndex(item) || "padrão"}`;
}
/** Atributos de base do template da peça (CN): chapéu, óculos, roupa, rosto e cabelo. */
export function itemBaseStats(item: ItemInstance): PieceStats | undefined {
  const category = CATEGORY_OF[item.kind], slot = category && slotFor[category]; if (!slot) return undefined;
  const offset = category === "hat" || category === "glasses" ? 1 : 0;
  return pieceInfo(item.sex === "f" ? "f" : "m", slot, itemIndex(item) - offset).stats;
}
/** Look de teste com só esta peça trocada (para miniaturas). */
export function lookWith(base: Look, item: ItemInstance): Look {
  const l = structuredClone(base), category = CATEGORY_OF[item.kind]; if (!category) return l;
  l.appearance.sex = item.sex === "f" ? "f" : item.sex === "m" ? "m" : l.appearance.sex;
  if (category === "hair" || category === "face") l.appearance[category] = itemIndex(item); else l.equipped[category] = itemIndex(item);
  return l;
}
