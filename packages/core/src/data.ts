/**
 * Dados de jogo (itens, armas, regras da partida). Tudo aqui é configurável: ajustar balanço = mudar números,
 * não código. Nomes são placeholders internos; os nomes finais ficam na camada de UI.
 */
import type { AngleRange } from "./angle";

/** Busca segura em tabela de dados: só chaves próprias (rejeita "constructor", "__proto__" etc.) e só strings. */
export function own<T>(table: Record<string, T>, key: unknown): T | undefined {
  return typeof key === "string" && Object.hasOwn(table, key) ? table[key] : undefined;
}

export type ItemKey = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "F";

export interface ItemDef {
  key: ItemKey;
  /** Energia gasta ao usar (o mesmo item pode ser usado mais de uma vez no turno). */
  cost: number;
  /** Property5 do item no TemplateAlllist.xml; independente do custo de energia. */
  delay: number;
  /** Disparos extras (um depois do outro, mesmo ângulo e força). */
  extraShots?: number;
  /** Projéteis simultâneos em leque no disparo. Só pode ser usado uma vez por turno. */
  triple?: boolean;
  /** Multiplicador de dano de cada projétil (acumula multiplicando). */
  shotDamageMult?: number;
  /** Bônus de dano somado (0.5 = +50%). */
  damageBonus?: number;
  /** Voar: o personagem vai até onde o projétil cai, sem dano. */
  fly?: boolean;
}

/** Teclas preservadas; custos e delays conferidos no TemplateAlllist.xml do DDTank41. */
/** Voo (F): tratado como uma arma de faixa 0–90° relativa ao corpo; na rampa a faixa gira junto, como nas armas. */
export const FLY_ANGLE: AngleRange = { min: 0, max: 90 };

export const ITEMS: Record<ItemKey, ItemDef> = {
  "1": { key: "1", cost: 110, delay: 600, extraShots: 2, shotDamageMult: 0.6 },
  "2": { key: "2", cost: 110, delay: 600, triple: true },
  "3": { key: "3", cost: 110, delay: 500, extraShots: 1, shotDamageMult: 0.9 },
  "4": { key: "4", cost: 85, delay: 400, damageBonus: 0.5 },
  "5": { key: "5", cost: 80, delay: 340, damageBonus: 0.4 },
  "6": { key: "6", cost: 70, delay: 200, damageBonus: 0.3 },
  "7": { key: "7", cost: 55, delay: 150, damageBonus: 0.2 },
  "8": { key: "8", cost: 50, delay: 70, damageBonus: 0.1 },
  F: { key: "F", cost: 150, delay: 200, fly: true },
};

export interface SpecialDef {
  /** Disparos sequenciais extras (os especiais atuais usam Amount simultâneo). */
  shots: number;
  damageMult: number;
  /** Bola/máscara do especial. */
  ballId: number;
  damageRadius: number;
  /** Número de projéteis simultâneos (BallInfo.Amount). */
  balls: number;
}

export interface WeaponDef {
  id: string;
  /** Nome interno provisório. */
  name: string;
  baseDamage: number;
  /** BallInfo.Radii, separado da cratera visual. */
  damageRadius: number;
  /** Property8 da arma + BallInfo.Delay (confirmado no balls.json do Reborn). */
  delay: number;
  ballDelay: number;
  /** Faixa de ângulo relativa ao corpo. */
  angle: AngleRange;
  /** Bola/máscara comum. */
  ballId: number;
  /** Multiplica o vento sentido pelo projétil. */
  windFactor: number;
  /** Configuração das bolas 111, 391 e 171 no XML do repositório. */
  special: SpecialDef;
}

export const WEAPONS: Record<string, WeaponDef> = {
  prism: { id: "prism", name: "Prisma", baseDamage: 200, damageRadius: 55, delay: 2, ballDelay: 200, angle: { min: 55, max: 70 }, ballId: 101, windFactor: 1,
    special: { shots: 0, damageMult: 1, ballId: 111, damageRadius: 65, balls: 1 } },
  sledge: { id: "sledge", name: "Marreta", baseDamage: 200, damageRadius: 55, delay: 1, ballDelay: 200, angle: { min: 20, max: 65 }, ballId: 381, windFactor: 1,
    special: { shots: 0, damageMult: 1, ballId: 391, damageRadius: 65, balls: 1 } },
  furnace: { id: "furnace", name: "Fornalha", baseDamage: 205, damageRadius: 55, delay: 1, ballDelay: 200, angle: { min: 20, max: 50 }, ballId: 161, windFactor: 1,
    special: { shots: 0, damageMult: 1, ballId: 171, damageRadius: 45, balls: 3 } },
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
  /** Passar soma 100; atirar soma segundos inteiros gastos × 20, além de arma/bola/itens. */
  delayPass: number;
  delayPerSecond: number;
  furyOnAttack: number;
  furyOnPass: number;
  /** Limite e custo do especial na escala nativa do servidor. */
  maxFury: number;

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
  delayPass: 100,
  delayPerSecond: 20,
  furyOnAttack: 20,
  furyOnPass: 20,
  maxFury: 200,
  falloffEdge: 0.25,
  friendlyFire: false,
  maxWind: 10,
  windMultiplier: 1,
  maxTurns: 0,
  defaultHp: 1000,
};
