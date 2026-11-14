/** Catálogo de peças para as telas de loja e mochila (nomes, ícones, atributos), e a ponte item da mochila ↔ categoria do visual. */
import { ACCESSORIES, SLOT_GEAR, SLOT_GEAR_NOTE, WEAPONS, accessoryStats, slotGear, cn147Wing, cnPieces, legacyCount, pieceInfo, COUNTS, type AvatarSex, type ItemInstance, type ItemKind, type Look, type PieceStats, type WardrobeSlot } from "@tankclone/core";

export type Category = "outfit" | "hair" | "face" | "hat" | "glasses" | "wings" | "bracelets" | "rings" | "offhand" | "pets" | "effects" | "suits" | "necklaces" | "chatballs" | "healstones";
export type Piece = { id: string; category: Category; index: number; name: string; complete: boolean; icon?: string | null; stats?: PieceStats };
export const CATEGORIES: { id: Category; label: string; singular: string; optional?: boolean }[] = [
  { id: "outfit", label: "Roupas", singular: "Roupa" },
  { id: "hair", label: "Cabelos", singular: "Cabelo" },
  { id: "face", label: "Rostos", singular: "Rosto" },
  { id: "hat", label: "Chapéus", singular: "Chapéu", optional: true },
  { id: "glasses", label: "Óculos", singular: "Óculos", optional: true },
  { id: "wings", label: "Asas", singular: "Asas", optional: true },
  { id: "bracelets", label: "Pulseiras", singular: "Pulseira", optional: true },
  { id: "rings", label: "Anéis", singular: "Anel", optional: true },
  { id: "offhand", label: "Armas secundárias", singular: "Arma secundária", optional: true },
  { id: "pets", label: "Pets", singular: "Pet", optional: true },
  { id: "effects", label: "Efeitos", singular: "Efeito", optional: true },
  { id: "suits", label: "Trajes", singular: "Traje", optional: true },
  { id: "necklaces", label: "Colares", singular: "Colar", optional: true },
  { id: "chatballs", label: "Balões de chat", singular: "Balão de chat", optional: true },
  { id: "healstones", label: "Pedras de cura", singular: "Pedra de cura", optional: true },
];
// Catálogo da build atual. A importação futura pode substituir esta lista mantendo a UI.
export const LEGACY_PIECES: Piece[] = CATEGORIES.slice(0, 6).flatMap(c => Array.from(
  { length: (COUNTS as Partial<Record<Category, number>>)[c.id]! - (c.optional ? 1 : 0) }, (_, n) => {
    const index = n + (c.optional ? 1 : 0);
    return { id: `${c.id}-${index}`, category: c.id, index, name: c.id === "wings" && cn147Wing(index) ? cn147Wing(index)!.name : `${c.singular} ${n + 1}`, complete: true };
  },
));
export const slotFor: Partial<Record<Category, WardrobeSlot>> = { outfit: "cloth", hair: "hair", face: "face", hat: "head", glasses: "glass" };
export function pieces(sex: AvatarSex): Piece[] {
  return [...LEGACY_PIECES, ...CATEGORIES.flatMap<Piece>(c => {
    if (c.id === "bracelets" || c.id === "rings") return ACCESSORIES.filter(a => a.kind === (c.id === "bracelets" ? "armlet" : "ring") && (a.ref === "8015" || a.ref === "9024")).map(a => ({ id: `accessory-${a.ref}`, category: c.id, index: Number(a.ref), name: a.name, complete: true, icon: `/ui-local/accessories/${a.icon}.png`, stats: accessoryStats(a.ref) }));
    const kinds: Partial<Record<Category, ItemKind>> = { offhand: "offhand", pets: "pet", effects: "eff", suits: "suits", necklaces: "necklace", chatballs: "chatball", healstones: "healstone" };
    if (kinds[c.id]) return SLOT_GEAR.filter(a => a.kind === kinds[c.id]).map(a => ({ id: `gear-${a.ref}`, category: c.id, index: Number(a.ref), name: a.name, complete: true, icon: SLOT_ICON[KIND_OF[c.id]], stats: { atk:a.atk, def:a.def, agi:a.agi, luck:a.luck } } as Piece));
    const slot = slotFor[c.id]; if (!slot) return [];
    const offset = c.optional ? 1 : 0;
    return cnPieces(sex, slot).map((item, i) => ({ id: `${c.id}-${i + legacyCount(slot) + offset}`, category: c.id,
      index: i + legacyCount(slot) + offset, name: (item as { name?: string }).name || `${c.singular} ${item.pic}`, complete: item.complete, icon: item.icon,
      stats: (item as { stats?: PieceStats }).stats }));
  })];
}

/** Categoria do visual ↔ tipo do item da mochila. */
export const KIND_OF: Record<Category, ItemKind> = { outfit: "cloth", hair: "hair", face: "face", hat: "head", glasses: "glass", wings: "wing", bracelets: "armlet", rings: "ring", offhand: "offhand", pets: "pet", effects: "eff", suits: "suits", necklaces: "necklace", chatballs: "chatball", healstones: "healstone" };
export const CATEGORY_OF: Partial<Record<ItemKind, Category>> = { cloth: "outfit", hair: "hair", face: "face", head: "hat", glass: "glasses", wing: "wings", armlet: "bracelets", ring: "rings", offhand: "offhand", pet: "pets", eff: "effects", suits: "suits", necklace: "necklaces", chatball: "chatballs", healstone: "healstones" };
/** Ícones locais (gitignored, via scripts/import-cn-equipment-icons.py) dos itens de lugar único. */
export const SLOT_ICON: Partial<Record<ItemKind, string>> = { offhand: "/ui-local/slots/offhand.png", pet: "/ui-local/slots/pet.png", eff: "/ui-local/slots/effect.png", necklace: "/ui-local/slots/necklace.png", chatball: "/ui-local/slots/chatball.png", healstone: "/ui-local/slots/healstone.png" };
/** Categorias de equipamento sem prévia no boneco (só vão para a mochila). */
export type EquipmentCategory = Exclude<Category, "outfit" | "hair" | "face" | "hat" | "glasses" | "wings">;
export const EQUIPMENT_CATEGORIES: readonly EquipmentCategory[] = ["bracelets", "rings", "offhand", "pets", "effects", "suits", "necklaces", "chatballs", "healstones"];
export const SLOT_GEAR_TEXT = (item: { kind: string; ref: string }) => SLOT_GEAR_NOTE[`${item.kind}:${item.ref}`];
/** Índice do visual de uma peça (mesmo valor guardado no Look; chapéu e óculos já contam o deslocamento +1). */
export const itemIndex = (item: ItemInstance) => Number(item.ref) || 0;
export const KIND_LABEL: Record<ItemKind, string> = { head: "Chapéu", glass: "Óculos", hair: "Cabelo", eff: "Efeito", cloth: "Roupa", face: "Rosto", weapon: "Arma", wing: "Asas", armlet: "Bracelete", ring: "Anel", suits: "Traje", necklace: "Colar", offhand: "Secundária", pet: "Pet", chatball: "Balão de chat", badge: "Emblema", healstone: "Pedra de cura" };

export function itemName(item: ItemInstance, weaponName: (id: string) => string): string {
  if (item.kind === "weapon") return weaponName(item.ref);
  const accessory = ACCESSORIES.find(a => a.ref === item.ref); if (accessory) return accessory.name;
  const gear = SLOT_GEAR.find(a => a.kind === item.kind && a.ref === item.ref); if (gear) return gear.name;
  const category = CATEGORY_OF[item.kind];
  const piece = category && pieces(item.sex === "f" ? "f" : "m").find(p => p.category === category && p.index === itemIndex(item));
  return piece?.name ?? `${KIND_LABEL[item.kind]} ${itemIndex(item) || "padrão"}`;
}
/** Atributos de base do template da peça (CN): chapéu, óculos, roupa, rosto e cabelo. */
export function itemBaseStats(item: ItemInstance): PieceStats | undefined {
  if (item.kind === "weapon") return WEAPONS[item.ref]?.stats;
  if (item.kind === "armlet" || item.kind === "ring") return accessoryStats(item.ref);
  const gear = slotGear(item.kind, item.ref); if (gear) return { atk: gear.atk, def: gear.def, agi: gear.agi, luck: gear.luck };
  const category = CATEGORY_OF[item.kind], slot = category && slotFor[category]; if (!slot) return undefined;
  const offset = category === "hat" || category === "glasses" ? 1 : 0;
  return pieceInfo(item.sex === "f" ? "f" : "m", slot, itemIndex(item) - offset).stats;
}
/** Look de teste com só esta peça trocada (para miniaturas). */
export function lookWith(base: Look, item: ItemInstance): Look {
  const l = structuredClone(base), category = CATEGORY_OF[item.kind]; if (!category) return l;
  l.appearance.sex = item.sex === "f" ? "f" : item.sex === "m" ? "m" : l.appearance.sex;
  if (category === "hair" || category === "face") l.appearance[category] = itemIndex(item);
  else if (["outfit", "hat", "glasses", "wings"].includes(category)) l.equipped[category as "outfit" | "hat" | "glasses" | "wings"] = itemIndex(item);
  return l;
}
export const isEquipmentCategory = (c: Category): c is EquipmentCategory => (EQUIPMENT_CATEGORIES as readonly Category[]).includes(c);
