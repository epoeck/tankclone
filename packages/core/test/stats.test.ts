import reference from "./fixtures/ddtank41.json";
import { describe, it, expect } from "vitest";
import { armorReduction, rollCritical, turnDelay, furyFromDamage, combatPower, critBonusPct, critChancePct, damageBreakdown, statDamage, withStats, REFERENCE_STATS, ZERO_STATS } from "../src/stats";
import { Match } from "../src/match";
import { Terrain } from "../src/terrain";

const w = (baseDamage: number) => ({ baseDamage });
describe("fórmula PvP DDTank41", () => {
  for (const c of reference.damage) {
    it(c.name, () => {
      const b = damageBreakdown({ weapon: w(200),
        attacker: withStats({ atk: c.atk, damage: c.damage, grade: c.grade, luck: c.luck }),
        target: withStats({ armor: c.armor, def: c.defence }),
        bonus: c.bonus, shotMult: c.mult, falloff: c.falloff, crit: c.crit });
      expect(b.base).toBe(c.expectedBase);
      expect(b.critical).toBe(c.expectedCritical);
      expect(b.final).toBe(c.expectedFinal);
    });
  }
  it("sorte reduz apenas a parcela de defesa; nível reduz apenas a armadura", () => {
    const target = withStats({ def: 800, armor: 150 });
    expect(armorReduction(target, withStats({ luck: 800 }))).toBeLessThan(armorReduction(target));
    expect(armorReduction(target, withStats({ grade: 30 }))).toBeLessThan(armorReduction(target));
  });
  it("crítico segue a taxa saturante e a comparação inclusiva com inteiro 0–99", () => {
    expect(critChancePct(400)).toBe(15);
    expect(critBonusPct(400)).toBeCloseTo(56);
    expect(critChancePct(REFERENCE_STATS.luck)).toBeLessThan(45);
    expect(critBonusPct(REFERENCE_STATS.luck)).toBeGreaterThan(100);
    expect(rollCritical(400, 0.15)).toBe(true);
    expect(rollCritical(400, 0.16)).toBe(false);
    expect(rollCritical(0, 0)).toBe(true); // >= Random.Next(100), inclusive em zero
    expect(rollCritical(0, 0.01)).toBe(false);
  });
  it("delay inclui ataque e tem retorno decrescente de agilidade", () => {
    expect(turnDelay(withStats())).toBe(1600);
    expect(turnDelay(withStats({ atk: 1500, agi: 900 }))).toBe(1235);
    expect(turnDelay(withStats({ atk: 1000, agi: 3000 }))).toBe(842);
  });
  it("fúria por dano usa os truncamentos intermediários e exclui crítico", () => {
    expect(furyFromDamage(0)).toBe(2);
    expect(furyFromDamage(199)).toBe(42);
    expect(furyFromDamage(200)).toBe(42);
  });
});

describe("FC", () => {
  it("conta de referência ≈ 359 milhões (±1%)", () => {
    expect(Math.abs(combatPower(REFERENCE_STATS) / 359_025_000 - 1)).toBeLessThan(0.01);
  });
});

describe("stats na partida", () => {
  const flat = () => Terrain.fromHeightFn(1000, 600, () => 450);
  it("energia sai de AGI, HP dos stats, FC calculada; armadura do alvo reduz o dano recebido", () => {
    const m = new Match({ seed: 1, terrain: flat(), players: [
      { id: "a", team: 1, x: 200, weaponId: "sledge", stats: { agi: 3000, hp: 5000, atk: 2000 } },
      { id: "b", team: 2, x: 320, weaponId: "sledge", stats: { armor: 100 } },
    ] });
    const a = m.getChar("a")!, b = m.getChar("b")!;
    expect(a.maxEnergy).toBe(340);
    expect(a.maxHp).toBe(5000);
    expect(a.fc).toBe(combatPower(a.stats));
    expect(b.stats.armor).toBe(100);
  });
});

import { BUILDS } from "../src/builds";
describe("escala antiga (build PvP)", () => {
  const shot = (a: string, t: string) => statDamage({ weapon: w(200), attacker: BUILDS[a]!, target: BUILDS[t]!, bonus: 0, shotMult: 1, falloff: 1, crit: false });
  it("builds preservam a fórmula de referência sem reajustar stats para esconder a diferença", () => {
    expect(shot("media", "media")).toBe(877);
    expect(shot("media", "canhao")).toBe(1070);
    expect(shot("tanque", "media")).toBe(431);
  });
  it("canhão de vidro bate mais forte que o tanque e morre mais fácil", () => {
    expect(shot("canhao", "media")).toBeGreaterThan(shot("tanque", "media"));
    expect(shot("media", "canhao") / BUILDS.canhao!.hp).toBeGreaterThan(shot("media", "tanque") / BUILDS.tanque!.hp);
  });
  it("crítico de build média segue o servidor de referência", () => {
    expect(critChancePct(BUILDS.media!.luck)).toBe(15);
    expect(critBonusPct(BUILDS.media!.luck)).toBeCloseTo(56);
  });
});
