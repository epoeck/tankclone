/**
 * Aparência do personagem (bonequinho customizável em camadas, como no original).
 * - `Appearance`: base do corpo (pele, rosto, cabelo + cor do cabelo) — escolha livre do jogador.
 * - `EquippedLook`: visual dos EQUIPAMENTOS vestidos (roupa, chapéu). No original eles também dão stats; na 1ª build, sem
 *   inventário real, são itens placeholder em que o índice é o próprio visual (futuro: ItemDef.visual).
 * Tudo são índices; a arte final entra como um arquivo por opção de cada camada.
 */

export const SKIN_TONES = ["#FFE0C7", "#F2C79F", "#D9A066", "#B97A4B", "#8A5530", "#5E3A22"] as const;
export const HAIR_COLORS = ["#6B3A1F", "#1F1F2B", "#F5C542", "#E0372A", "#3B6FD1", "#4FC263", "#F28FC2", "#E8ECF2"] as const;
/** Opções por camada (batem com a arte em public/assets/chars). hat/glasses/wings: 0 = sem item, 1..n = arquivo n. */
export const COUNTS = { skin: SKIN_TONES.length, face: 3, hair: 3, hairColor: HAIR_COLORS.length, outfit: 3, hat: 3, glasses: 2, wings: 2 } as const;

export interface Appearance { skin: number; face: number; hair: number; hairColor: number }
/** Índice do item equipado em cada slot visual; outfit 0..2 (arquivo n+1); hat/glasses/wings 0 = nenhum. */
export interface EquippedLook { outfit: number; hat: number; glasses: number; wings: number }
export interface Look { appearance: Appearance; equipped: EquippedLook }

/** Camadas de trás para frente (o braço com a arma é desenhado à parte, para girar com o ângulo). */
export const LAYER_ORDER = ["wings", "hair-back", "body", "outfit", "face", "hair-front", "glasses", "hat", "weapon", "arm"] as const;

export const DEFAULT_LOOK: Look = { appearance: { skin: 1, face: 0, hair: 0, hairColor: 1 }, equipped: { outfit: 0, hat: 0, glasses: 0, wings: 0 } };

const int = (v: unknown, max: number, fallback: number): number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v < max ? v : fallback;

/** Aceita qualquer lixo e devolve um Look válido (índices inteiros dentro dos limites). */
export function sanitizeLook(raw: unknown): Look {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as { appearance?: Record<string, unknown>; equipped?: Record<string, unknown> };
  const a = (o.appearance ?? {}) as Record<string, unknown>, e = (o.equipped ?? {}) as Record<string, unknown>;
  const d = DEFAULT_LOOK;
  return {
    appearance: { skin: int(a.skin, COUNTS.skin, d.appearance.skin), face: int(a.face, COUNTS.face, d.appearance.face),
      hair: int(a.hair, COUNTS.hair, d.appearance.hair), hairColor: int(a.hairColor, COUNTS.hairColor, d.appearance.hairColor) },
    equipped: { outfit: int(e.outfit, COUNTS.outfit, d.equipped.outfit), hat: int(e.hat, COUNTS.hat, 0), glasses: int(e.glasses, COUNTS.glasses, 0), wings: int(e.wings, COUNTS.wings, 0) },
  };
}
