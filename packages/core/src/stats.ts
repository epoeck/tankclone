/**
 * Atributos e dano (Fase C). Fórmulas de guias de jogadores (docs/pesquisa-mecanicas.md §3), confiança baixa/média:
 * tudo configurável em `DamageConfig`; a escala dos números de fim de jogo ainda precisa de confirmação do dono.
 *
 *   bruto  = (dano_arma + Dano_equip + ATK / 10) × (1 + Σbônus)
 *   armadura = Armadura_equip + DEF / 25 ;  redução = A / (A + K)
 *   final  = bruto × (1 − redução) × multiplicador do projétil × queda radial × (crítico ? 1 + Sorte/25 % : 1)
 *   chance de crítico = Sorte / 20 (%)
 */
import type { WeaponDef } from "./data";

export interface Stats {
  atk: number;
  def: number;
  agi: number;
  luck: number;
  hp: number;
  /** Armadura somada dos equipamentos. */
  armor: number;
  /** "Dano" somado dos equipamentos (somado ao dano base da arma). */
  damage: number;
}

export const ZERO_STATS: Stats = { atk: 0, def: 0, agi: 0, luck: 0, hp: 1000, armor: 0, damage: 0 };

/** Conta de referência (print do dono, 2026-11-11) — escala de fim de jogo. */
export const REFERENCE_STATS: Stats = { atk: 33281, def: 28663, agi: 29551, luck: 26078, hp: 531164, armor: 8550, damage: 8912 };

export interface DamageConfig {
  atkDivisor: number;
  defArmorDivisor: number;
  /** Constante K da redução A / (A + K). */
  armorK: number;
  /** Chance de crítico (%) = Sorte / critChanceDivisor, limitada por critChanceCap. */
  critChanceDivisor: number;
  critChanceCap: number;
  /** Bônus do crítico (%) = Sorte / critBonusDivisor, limitado por critBonusCap. */
  critBonusDivisor: number;
  critBonusCap: number;
}

export const DEFAULT_DAMAGE: DamageConfig = {
  atkDivisor: 10, defArmorDivisor: 25, armorK: 100,
  critChanceDivisor: 20, critChanceCap: 100,
  critBonusDivisor: 25, critBonusCap: 100, // tetos provisórios: com Sorte de fim de jogo a fórmula crua explode
};

export function withStats(s: Partial<Stats> = {}): Stats {
  return { ...ZERO_STATS, ...s };
}

/** Chance de crítico em % (0–100). */
export function critChancePct(luck: number, cfg: DamageConfig = DEFAULT_DAMAGE): number {
  return Math.min(cfg.critChanceCap, Math.max(0, luck / cfg.critChanceDivisor));
}

/** Bônus de dano do crítico em % (soma sobre 100%). */
export function critBonusPct(luck: number, cfg: DamageConfig = DEFAULT_DAMAGE): number {
  return Math.min(cfg.critBonusCap, Math.max(0, luck / cfg.critBonusDivisor));
}

export function totalArmor(s: Stats, cfg: DamageConfig = DEFAULT_DAMAGE): number {
  return s.armor + s.def / cfg.defArmorDivisor;
}

/** Fração do dano absorvida pela armadura (0–1). */
export function armorReduction(s: Stats, cfg: DamageConfig = DEFAULT_DAMAGE): number {
  const a = totalArmor(s, cfg);
  return a / (a + cfg.armorK);
}

/**
 * Força de combate (placeholder). Ajuste de um único ponto, a conta de referência:
 * (ATK+DEF+AGI+Sorte+Dano+Armadura) × Vida / 200 ≈ 359 milhões (erro ~0,1%). Forma suposta, não documentada.
 */
export function combatPower(s: Stats): number {
  return Math.round(((s.atk + s.def + s.agi + s.luck + s.damage + s.armor) * s.hp) / 200);
}

export interface DamageBreakdown {
  gross: number;
  reduction: number;
  crit: boolean;
  final: number;
}

export interface StatDamageInput {
  weapon: Pick<WeaponDef, "baseDamage">;
  attacker: Stats;
  target: Stats;
  /** Soma dos bônus de dano (+50% = 0.5). */
  bonus: number;
  /** Multiplicador do projétil (itens de tiro múltiplo, especial). */
  shotMult: number;
  /** Queda radial: 1 no centro. */
  falloff: number;
  crit: boolean;
}

export function damageBreakdown(d: StatDamageInput, cfg: DamageConfig = DEFAULT_DAMAGE): DamageBreakdown {
  const gross = (d.weapon.baseDamage + d.attacker.damage + d.attacker.atk / cfg.atkDivisor) * (1 + d.bonus);
  const reduction = armorReduction(d.target, cfg);
  const critMult = d.crit ? 1 + critBonusPct(d.attacker.luck, cfg) / 100 : 1;
  const final = Math.max(1, Math.round(gross * (1 - reduction) * d.shotMult * d.falloff * critMult));
  return { gross, reduction, crit: d.crit, final };
}

export function statDamage(d: StatDamageInput, cfg: DamageConfig = DEFAULT_DAMAGE): number {
  return damageBreakdown(d, cfg).final;
}
