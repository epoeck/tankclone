/** Mochila original: itens possuídos (instâncias), quem pode ser fortalecido/composto (CN `CanStrengthen`/`CanCompose`),
 * armadura do fortalecimento e os lugares de equipar (Place do original). Sem RNG. */
import { STRENGTHEN_MAX, type GearState } from "./forge";

export type ItemKind = "head" | "glass" | "hair" | "eff" | "cloth" | "face" | "weapon" | "wing" | "armlet" | "ring" | "suits" | "necklace" | "offhand" | "pet" | "chatball" | "badge" | "healstone";
export type EquipPlace = "head" | "glass" | "hair" | "eff" | "cloth" | "face" | "weapon" | "armlet1" | "armlet2" | "ring1" | "ring2" | "suits" | "necklace" | "wing" | "offhand" | "pet" | "chatball" | "badge" | "healstone";
/** Fortalecem com Super Pedra: chapéu (cat. 1), roupa (5), arma (7) e arma secundária (17). */
export const STRENGTHEN_KINDS: readonly ItemKind[] = ["head", "cloth", "weapon", "offhand"];
/** Compõem: chapéu (1), óculos (2), roupa (5), arma (7), bracelete (8) e anel (9). */
export const COMPOSE_KINDS: readonly ItemKind[] = ["head", "glass", "cloth", "weapon", "armlet", "ring"];
export const canStrengthen = (kind: string) => (STRENGTHEN_KINDS as readonly string[]).includes(kind);
export const canCompose = (kind: string) => (COMPOSE_KINDS as readonly string[]).includes(kind);
/** Tipos que existem nesta build (têm arte de jogo); os demais aparecem bloqueados na mochila. */
export const OWNABLE_KINDS: readonly ItemKind[] = ["head", "glass", "hair", "eff", "cloth", "face", "weapon", "wing", "armlet", "ring", "suits", "necklace", "offhand", "pet", "chatball", "badge", "healstone"];
/** Tipos que sempre têm um item equipado (padrão grátis, ref 0). */
export const REQUIRED_KINDS: readonly ItemKind[] = ["hair", "cloth", "face", "weapon"];
/** Place do original (0 chapéu, 1 óculos, 2 cabelo, 3 efeito, 4 roupa, 5 rosto, 6 arma, 7–8 bracelete, 9–10 anel, 11 traje, 12 colar, 13 asa, 14 balão de chat, 15 secundária, 17 emblema, 18 pedra de cura). */
export const PLACES: Record<ItemKind, number> = { head: 0, glass: 1, hair: 2, eff: 3, cloth: 4, face: 5, weapon: 6, armlet: 7, ring: 9, suits: 11, necklace: 12, wing: 13, offhand: 15, pet: 16, chatball: 14, badge: 17, healstone: 18 };

export interface ItemInstance extends GearState {
  id: number; kind: ItemKind; ref: string; sex: "m" | "f" | "";
  /** null = na mochila; senão o lugar em que está equipado (o próprio `kind`). */
  place: EquipPlace | null;
}

/** Armadura do template (Property7 = 60) de chapéu e roupa. */
export const BASE_ARMOR = 60;
/** Acréscimo de armadura do fortalecimento: round(60·1,1^N) − 60, como o getBaseDefence do Reborn. */
export function strengthenArmor(level: number): number {
  return Math.round(BASE_ARMOR * Math.pow(1.1, Math.max(0, Math.min(STRENGTHEN_MAX, level)))) - BASE_ARMOR;
}
