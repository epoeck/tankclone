/**
 * Dados de jogo (itens, armas, regras da partida). Tudo aqui é configurável: ajustar balanço = mudar números,
 * não código. Nomes são placeholders internos; os nomes finais ficam na camada de UI.
 */
import type { AngleRange } from "./angle";

export type ItemKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "F";

export interface ItemDef {
  key: ItemKey;
  /** Energia gasta ao usar (o mesmo item pode ser usado mais de uma vez no turno). */
  cost: number;
  /** Disparos extras (um depois do outro, mesmo ângulo e força). */
  extraShots?: number;
  /** Projéteis simultâneos em leque no disparo. */
  triple?: boolean;
  /** Multiplicador de dano de cada projétil (acumula multiplicando). */
  shotDamageMult?: number;
  /** Bônus de dano somado (0.5 = +50%). */
  damageBonus?: number;
  /** Voar: o personagem vai até onde o projétil cai, sem dano. */
  fly?: boolean;
}

/** Itens de turno nas teclas 1–8 e F. Custos do guia doyo, confirmados pelo dono (docs/pesquisa-mecanicas.md §1). */
export const ITEMS: Record<ItemKey, ItemDef> = {
  "1": { key: "1", cost: 110, extraShots: 2, shotDamageMult: 0.6 },
  "2": { key: "2", cost: 110, triple: true, shotDamageMult: 0.5 },
  "3": { key: "3", cost: 110, extraShots: 1, shotDamageMult: 0.8 },
  "4": { key: "4", cost: 85, damageBonus: 0.5 },
  "5": { key: "5", cost: 80, damageBonus: 0.4 },
  "6": { key: "6", cost: 70, damageBonus: 0.3 },
  "7": { key: "7", cost: 55, damageBonus: 0.2 },
  "8": { key: "8", cost: 50, damageBonus: 0.1 },
  F: { key: "F", cost: 150, fly: true },
};

export interface SpecialDef {
  /** Projéteis extras do especial, lançados em sequência. */
  shots: number;
  damageMult: number;
  craterMult: number;
}

export interface WeaponDef {
  id: string;
  /** Nome interno provisório. */
  name: string;
  baseDamage: number;
  /** Faixa de ângulo relativa ao corpo. */
  angle: AngleRange;
  craterRadius: number;
  /** Multiplica o vento sentido pelo projétil. */
  windFactor: number;
  /** Placeholder até o dono ajustar jogando. */
  special: SpecialDef;
}

export const WEAPONS: Record<string, WeaponDef> = {
  prism: { id: "prism", name: "Prisma", baseDamage: 200, angle: { min: 55, max: 70 }, craterRadius: 40, windFactor: 1,
    special: { shots: 0, damageMult: 1.5, craterMult: 1.5 } },
  sledge: { id: "sledge", name: "Marreta", baseDamage: 200, angle: { min: 20, max: 65 }, craterRadius: 26, windFactor: 1,
    special: { shots: 0, damageMult: 2, craterMult: 1 } },
  furnace: { id: "furnace", name: "Fornalha", baseDamage: 205, angle: { min: 20, max: 50 }, craterRadius: 30, windFactor: 1,
    special: { shots: 2, damageMult: 1, craterMult: 1 } },
};

export interface MatchConfig {
  /** Energia = baseEnergy + AGI / agiPerEnergy. */
  baseEnergy: number;
  agiPerEnergy: number;
  energyPerPx: number;
  /** Degrau máximo (px) que o personagem sobe por px andado. */
  maxStepUp: number;
  /** Queda maior que isto (px) em 1 px andado vira queda livre. */
  maxStepDown: number;
  turnTime: number;
  /** Tempo reduzido quando todos os vivos têm FC acima do limiar. */
  turnTimeFast: number;
  fcThreshold: number;
  /** Leque do tiro triplo (graus entre projéteis). */
  tripleSpreadDeg: number;
  /** Delay ganho por turno = (base + energia gasta × perEnergy) / (1 + AGI / agiDelayScale). */
  delayBase: number;
  delayPerEnergy: number;
  delayPassFactor: number;
  agiDelayScale: number;
  furyOnAttack: number;
  furyOnPass: number;
  furyOnHit: number;
  /** Raio de dano = raio da cratera × este fator; dano cai de 100% (centro) a (1 − falloffMin)... ver match.ts. */
  damageRadiusFactor: number;
  /** Fração do dano perdida na borda do raio de dano. */
  falloffEdge: number;
  friendlyFire: boolean;
  maxWind: number;
  /** Multiplicador de vento do mapa (hazards futuros). */
  windMultiplier: number;
  /** Limite de turnos (0 = sem limite). */
  maxTurns: number;
  defaultHp: number;
}

export const DEFAULT_MATCH: MatchConfig = {
  baseEnergy: 240,
  agiPerEnergy: 30,
  energyPerPx: 1,
  maxStepUp: 2,
  maxStepDown: 3,
  turnTime: 10,
  turnTimeFast: 5,
  fcThreshold: 1_000_000,
  tripleSpreadDeg: 5,
  delayBase: 100,
  delayPerEnergy: 0.2,
  delayPassFactor: 0.5,
  agiDelayScale: 10_000,
  furyOnAttack: 15,
  furyOnPass: 10,
  furyOnHit: 10,
  damageRadiusFactor: 1.4,
  falloffEdge: 0.5,
  friendlyFire: false,
  maxWind: 10,
  windMultiplier: 1,
  maxTurns: 0,
  defaultHp: 1000,
};
