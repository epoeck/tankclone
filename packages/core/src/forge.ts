/**
 * Ferreiro (fortalecer +0..+12) e composição — decisão do dono: tudo GARANTIDO, sem sorteio.
 * Referências cruzadas:
 * - CN 14.7 `loadstrengthexp.xml`: EXP para subir de cada nível (o sistema novo, igual ao 6600 do Reborn:
 *   `strengthen6600` acumula EXP e sobe ao passar o limiar; máximo +12). EXP por pedra = Property2 (mínimo 10).
 * - CN 14.7 `itemstrengthengoodsinfo.xml`: a arma muda de arte/modelo no +10 (…2) e no +12 (…3).
 * - Reborn `ballconfig.json`: cada modelo tem bola comum, especial, "+dano" (AddWound) e "+tiros" (MultiBall).
 * - Reborn `getHertAddition`: dano-base da arma × 1,1^nível.
 * - Composição (Reborn `compor.ts`, CN pedras 朱雀/玄武/青龙/白虎): grava ATQ/DEF/AGI/SOR = valor da pedra (10/20/30/40/51).
 *   No original há chance de falha; aqui é garantida.
 */

export const STRENGTHEN_MAX = 12;
/** EXP necessária para ir do nível N−1 ao N (índice N), já zerando a sobra no nível novo (como o 6600). */
export const STRENGTHEN_EXP = [0, 10, 50, 150, 350, 700, 1500, 2300, 3300, 4500, 6000, 7500, 9000] as const;

export type ComposeAttr = "atk" | "def" | "agi" | "luck";
export interface ShopItem {
  id: string; name: string; kind: "strengthen" | "compose"; level: number; price: number; icon: string;
  /** Pedra de fortalecer: EXP por unidade. */
  exp?: number;
  /** Pedra de composição: atributo e valor gravado. */
  attr?: ComposeAttr; value?: number;
}
/** Preço de teste (decisão do dono): tudo a 1 gold. */
export const TEST_PRICE = 1;
const STRENGTH_STONES: Array<[number, number, string]> = [[1, 10, "strength1"], [2, 10, "strength2"], [3, 15, "strength3"], [4, 55, "strength4"], [5, 215, "strength9"]];
const COMPOSE_KIND: Record<ComposeAttr, [string, string]> = { atk: ["Pedra Fênix (ATQ)", "zhuque"], def: ["Pedra Tartaruga (DEF)", "xuanwu"], agi: ["Pedra Dragão (AGI)", "qinglong"], luck: ["Pedra Tigre (SOR)", "baihu"] };
const COMPOSE_VALUES = [10, 20, 30, 40, 51];
export const SHOP_ITEMS: ShopItem[] = [
  ...STRENGTH_STONES.map(([level, exp, pic]) => ({ id: `str${level}`, name: `Pedra de fortalecer Nv${level}`, kind: "strengthen" as const, level, exp, price: TEST_PRICE, icon: pic })),
  ...(Object.keys(COMPOSE_KIND) as ComposeAttr[]).flatMap(attr => COMPOSE_VALUES.map((value, i) => ({
    id: `${attr}${i + 1}`, name: `${COMPOSE_KIND[attr][0]} Nv${i + 1}`, kind: "compose" as const, level: i + 1, attr, value, price: TEST_PRICE, icon: `${COMPOSE_KIND[attr][1]}${i + 1}`,
  }))),
];
export const shopItem = (id: string): ShopItem | undefined => SHOP_ITEMS.find(i => i.id === id);

export interface WeaponState { level: number; exp: number; compose: Record<ComposeAttr, number> }
export const NEW_WEAPON: WeaponState = { level: 0, exp: 0, compose: { atk: 0, def: 0, agi: 0, luck: 0 } };

/** Quantas pedras (de `exp` cada) faltam para o próximo nível. 0 no máximo. */
export function stonesToNext(w: WeaponState, exp: number): number {
  if (w.level >= STRENGTHEN_MAX) return 0;
  return Math.max(1, Math.ceil((STRENGTHEN_EXP[w.level + 1]! - w.exp) / exp));
}

/** Injeta até `count` pedras; sobe quantos níveis a EXP permitir (garantido). Não gasta pedra além do +12. */
export function strengthenWith(w: WeaponState, exp: number, count: number): { weapon: WeaponState; used: number } {
  if (!(exp > 0) || !Number.isInteger(count) || count < 1) return { weapon: w, used: 0 };
  let { level, exp: cur } = w, used = 0;
  while (used < count && level < STRENGTHEN_MAX) {
    cur += exp; used++;
    while (level < STRENGTHEN_MAX && cur >= STRENGTHEN_EXP[level + 1]!) { cur -= STRENGTHEN_EXP[level + 1]!; level++; }
  }
  if (level >= STRENGTHEN_MAX) cur = 0;
  return { weapon: { ...w, level, exp: cur }, used };
}

/** Composição garantida: grava o valor da pedra no atributo (substitui o anterior, como no original). */
export function composeWith(w: WeaponState, attr: ComposeAttr, value: number): WeaponState {
  return { ...w, compose: { ...w.compose, [attr]: value } };
}

/** Dano-base da arma fortalecida (Reborn getHertAddition: base × 1,1^nível, arredondado). */
export function strengthenedDamage(base: number, level: number): number {
  return Math.round(base * Math.pow(1.1, Math.max(0, Math.min(STRENGTHEN_MAX, level))));
}

/** Estágio de arte/modelo: +0..+9 → 0, +10/+11 → 1 (…2), +12 → 2 (…3). */
export function weaponStage(level: number): 0 | 1 | 2 { return level >= 12 ? 2 : level >= 10 ? 1 : 0; }

export interface WeaponBalls { common: number; special: number; addWound: number; multi: number }
/** ballconfig do Reborn para os modelos de cada arma (estágios 0, 1 e 2). */
export const WEAPON_BALLS: Record<string, [WeaponBalls, WeaponBalls, WeaponBalls]> = {
  prism: [{ common: 101, special: 111, addWound: 1012, multi: 1011 }, { common: 102, special: 112, addWound: 1022, multi: 1021 }, { common: 103, special: 113, addWound: 1032, multi: 1031 }],
  sledge: [{ common: 381, special: 391, addWound: 3812, multi: 3811 }, { common: 382, special: 392, addWound: 3822, multi: 3821 }, { common: 383, special: 393, addWound: 3832, multi: 3831 }],
  furnace: [{ common: 161, special: 171, addWound: 1612, multi: 1611 }, { common: 162, special: 172, addWound: 1622, multi: 1621 }, { common: 163, special: 173, addWound: 1632, multi: 1631 }],
};
/** Pasta da arte da arma (avatar) por estágio: brick, brick2, brick3… */
export const WEAPON_ART: Record<string, string> = { prism: "bomb", sledge: "brick", furnace: "bombpack" };

/** De qual arma/estágio/tipo é uma bola (para escolher sons e efeitos visuais). */
export function ballInfo(ballId: number): { weaponId: string; stage: number; kind: keyof WeaponBalls } | undefined {
  for (const [weaponId, stages] of Object.entries(WEAPON_BALLS)) for (let stage = 0; stage < stages.length; stage++)
    for (const kind of ["common", "special", "addWound", "multi"] as const) if (stages[stage]![kind] === ballId) return { weaponId, stage, kind };
  return undefined;
}
