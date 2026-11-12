/** Cálculos PvP do DDTank41 (SimpleBomb.MakeDamage, Living.MakeCriticalDamage,
 * TurnedLiving.GetTurnDelay). Fontes e limites em docs/ddtank41.md. */
import type { WeaponDef } from "./data";

export interface Stats {
  /** Grade do atacante no servidor de referência; padrão 1 enquanto não informado. */
  grade?: number;
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

/** Conta de referência (print do dono, 2026-11-11). **Escala 2022 — NÃO usar na build PvP** (ver BUILDS e docs/decisoes.md item 32). */
export const REFERENCE_STATS: Stats = { atk: 33281, def: 28663, agi: 29551, luck: 26078, hp: 531164, armor: 8550, damage: 8912 };

export function withStats(s: Partial<Stats> = {}): Stats {
  return { ...ZERO_STATS, ...s };
}

/** Taxa antes da comparação com Random.Next(100), que usa >= no servidor. */
export function critChancePct(luck: number): number {
  return Math.max(0, luck) * 45 / (800 + Math.max(0, luck));
}

export function rollCritical(luck: number, roll: number): boolean {
  return critChancePct(luck) >= Math.floor(roll * 100);
}

export function critBonusPct(luck: number): number {
  return (0.5 + Math.max(0, luck) * 0.00015) * 100;
}

/** BaseGuard já é a armadura; DEF é uma segunda redução, não armadura adicional. */
export function totalArmor(s: Stats): number { return s.armor; }

export function armorReduction(target: Stats, attacker: Stats = ZERO_STATS): number {
  const guard = target.armor - 3 * (attacker.grade ?? 1);
  // O servidor permite DR1 negativo: alvos com pouca armadura sofrem dano adicional.
  const dr1 = 0.95 * guard / (500 + guard);
  const defence = target.def - attacker.luck;
  const dr2 = defence >= 0 ? 0.95 * defence / (600 + defence) : 0;
  return dr1 + dr2 - dr1 * dr2;
}

export function turnDelay(s: Stats): number {
  return Math.trunc(1600 - 1200 * s.agi / (s.agi + 1200) + s.atk / 10);
}

/** Inteiros intermediários de Player.TakeDamage; crítico não entra nesta conta. */
export function furyFromDamage(baseDamage: number): number {
  return Math.trunc((Math.trunc(baseDamage * 2 / 5) + 5) / 2);
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
  base: number;
  critical: number;
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

export function damageBreakdown(d: StatDamageInput): DamageBreakdown {
  const gross = (d.weapon.baseDamage + d.attacker.damage) * (1 + d.attacker.atk * 0.001);
  const reduction = armorReduction(d.target, d.attacker);
  const raw = gross * (1 - reduction) * Math.fround(1 + d.bonus) * Math.fround(d.shotMult) * d.falloff;
  const base = raw < 0 ? 1 : Math.trunc(raw);
  const critical = d.crit ? Math.trunc(base * critBonusPct(d.attacker.luck) / 100) : 0;
  return { gross, reduction, crit: d.crit, base, critical, final: base + critical };
}

export function statDamage(d: StatDamageInput): number {
  return damageBreakdown(d).final;
}
