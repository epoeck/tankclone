/**
 * Aparência do personagem (bonequinho customizável em camadas, como no original).
 * - `Appearance`: base do corpo (pele, rosto, cabelo + cor do cabelo) — escolha livre do jogador.
 * - `EquippedLook`: visual dos EQUIPAMENTOS vestidos (roupa, chapéu). No original eles também dão stats; na 1ª build, sem
 *   inventário real, são itens placeholder em que o índice é o próprio visual (futuro: ItemDef.visual).
 * Tudo são índices; a arte final entra como um arquivo por opção de cada camada.
 */

export const SKIN_TONES = ["#ffe0c2", "#f8cfa6", "#e7b27e", "#c98d5c", "#a06a42", "#6f4528"] as const;
export const HAIR_COLORS = ["#2b2118", "#6b4a2b", "#d9a441", "#e8e0c8", "#c0392b", "#3b6fd6", "#8e5bd6", "#2fa36b"] as const;
export const COUNTS = { skin: SKIN_TONES.length, face: 6, hair: 8, hairColor: HAIR_COLORS.length, outfit: 6, hat: 5 } as const;

export interface Appearance { skin: number; face: number; hair: number; hairColor: number }
/** Índice do item equipado em cada slot visual; hat 0 = sem chapéu. */
export interface EquippedLook { outfit: number; hat: number }
export interface Look { appearance: Appearance; equipped: EquippedLook }

/** Camadas de trás para frente (o braço com a arma é desenhado à parte, para girar com o ângulo). */
export const LAYER_ORDER = ["hair-back", "body", "outfit", "face", "hair-front", "hat"] as const;

export const DEFAULT_LOOK: Look = { appearance: { skin: 1, face: 0, hair: 0, hairColor: 1 }, equipped: { outfit: 0, hat: 0 } };

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
    equipped: { outfit: int(e.outfit, COUNTS.outfit, d.equipped.outfit), hat: int(e.hat, COUNTS.hat, d.equipped.hat) },
  };
}
