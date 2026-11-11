import { describe, it, expect } from "vitest";
import { armorReduction, combatPower, critBonusPct, critChancePct, damageBreakdown, statDamage, withStats, REFERENCE_STATS, ZERO_STATS } from "../src/stats";
import { Match } from "../src/match";
import { Terrain } from "../src/terrain";

const w = (baseDamage: number) => ({ baseDamage });
const hit = (o: Partial<Parameters<typeof statDamage>[0]> = {}) =>
  statDamage({ weapon: w(200), attacker: ZERO_STATS, target: ZERO_STATS, bonus: 0, shotMult: 1, falloff: 1, crit: false, ...o });

describe("fórmula de dano", () => {
  it("exemplo do guia 4399: (205×1,96 + 560/10) × 2,8 ≈ 1281,8", () => {
    const d = statDamage({ weapon: w(205 * 1.96), attacker: withStats({ atk: 560 }), target: ZERO_STATS, bonus: 1.8, shotMult: 1, falloff: 1, crit: false });
    expect(Math.abs(d - 1281.8)).toBeLessThanOrEqual(1); // tolerância: arredondamento do guia
  });
  it("sem stats o dano é o da arma; ATK soma ATK/10; Dano soma direto", () => {
    expect(hit()).toBe(200);
    expect(hit({ attacker: withStats({ atk: 1000 }) })).toBe(300);
    expect(hit({ attacker: withStats({ damage: 50 }) })).toBe(250);
  });
  it("armadura: A/(A+100); DEF/25 conta como armadura", () => {
    expect(armorReduction(withStats({ armor: 100 }))).toBeCloseTo(0.5);
    expect(armorReduction(withStats({ def: 2500 }))).toBeCloseTo(0.5);
    expect(hit({ target: withStats({ armor: 100 }) })).toBe(100);
  });
  it("bônus somam, multiplicador de projétil e queda radial multiplicam", () => {
    expect(hit({ bonus: 1.3 })).toBe(460);
    expect(hit({ shotMult: 0.5, falloff: 0.8 })).toBe(80);
  });
  it("crítico: chance Sorte/20 %, bônus Sorte/25 %, com tetos", () => {
    expect(critChancePct(100)).toBe(5);
    expect(critBonusPct(100)).toBe(4);
    expect(critChancePct(REFERENCE_STATS.luck)).toBe(100);
    expect(critBonusPct(REFERENCE_STATS.luck)).toBe(100);
    expect(hit({ crit: true, attacker: withStats({ luck: 500 }) })).toBe(240); // +20%
  });
  it("dano mínimo é 1", () => {
    expect(hit({ target: withStats({ armor: 1e9 }) })).toBe(1);
  });
  it("detalha o cálculo", () => {
    const b = damageBreakdown({ weapon: w(200), attacker: ZERO_STATS, target: withStats({ armor: 100 }), bonus: 0, shotMult: 1, falloff: 1, crit: false });
    expect(b).toMatchObject({ gross: 200, reduction: 0.5, final: 100 });
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
  it("tiro central sem itens, média contra média: 5% a 15% da vida", () => {
    const pct = shot("media", "media") / BUILDS.media!.hp;
    expect(pct).toBeGreaterThanOrEqual(0.05);
    expect(pct).toBeLessThanOrEqual(0.15);
  });
  it("qualquer par de builds fica entre 2% e 30% da vida do alvo", () => {
    for (const a of Object.keys(BUILDS)) for (const t of Object.keys(BUILDS)) {
      const pct = shot(a, t) / BUILDS[t]!.hp;
      expect(pct, `${a} → ${t}`).toBeGreaterThanOrEqual(0.02);
      expect(pct, `${a} → ${t}`).toBeLessThanOrEqual(0.3);
    }
  });
  it("canhão de vidro bate mais forte que o tanque e morre mais fácil", () => {
    expect(shot("canhao", "media")).toBeGreaterThan(shot("tanque", "media"));
    expect(shot("media", "canhao") / BUILDS.canhao!.hp).toBeGreaterThan(shot("media", "tanque") / BUILDS.tanque!.hp);
  });
  it("crítico de build média é plausível (chance Sorte/20, bônus Sorte/25)", () => {
    expect(critChancePct(BUILDS.media!.luck)).toBe(20);
    expect(critBonusPct(BUILDS.media!.luck)).toBe(16);
  });
});
