/**
 * Builds de teste na escala ANTIGA (2011): stats de equipamento na casa das centenas a poucos milhares, vida ~5000.
 * É a escala da build PvP (decisão do dono, docs/decisoes.md item 32). Equipamentos reais com stats fixos virão depois;
 * estes são conjuntos-exemplo para testes e para a sala de teste.
 */
import type { Stats } from "./stats";

export const BUILDS: Record<string, Stats> = {
  media: { atk: 1500, def: 500, agi: 900, luck: 400, hp: 5000, armor: 60, damage: 250 },
  tanque: { atk: 1000, def: 1200, agi: 300, luck: 200, hp: 7000, armor: 150, damage: 150 },
  canhao: { atk: 2800, def: 200, agi: 700, luck: 600, hp: 3500, armor: 30, damage: 400 },
  veloz: { atk: 1400, def: 400, agi: 3000, luck: 800, hp: 4500, armor: 50, damage: 200 },
};
export const DEFAULT_BUILD = "media";
