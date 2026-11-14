/** Atributos base neutros. Na partida, os stats variáveis vêm do equipamento vestido. */
import type { Stats } from "./stats";

export const BUILDS: Record<string, Stats> = {
  equipamento: { atk: 0, def: 0, agi: 0, luck: 0, hp: 1000, armor: 0, damage: 0 },
};
export const DEFAULT_BUILD = "equipamento";
