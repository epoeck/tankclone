import { describe, it, expect } from "vitest";
import {
  TABLE_PHYSICS as DEFAULT_PHYSICS, MUZZLE_HEIGHT, evaluate, fitPhysics, powerScalingCheck,
  predictDx, requiredPower, windRuleError, fitWindAccel, samplesFromTables, type ShotSample,
} from "../src/index";
import data from "../calibration/ddtank-tables.json";

describe("ferramenta de ajuste (dados sintéticos)", () => {
  const truth = { ...DEFAULT_PHYSICS, speedPerPower: 14, gravity: 700, drag: 0.08 };
  const synth: ShotSample[] = [20, 30, 50, 65, 80].flatMap(a =>
    [30, 50, 70, 90].map(p => ({ angleDeg: a, power: p, dx: predictDx({ angleDeg: a, power: p, dx: 1 }, truth, 25)! })));
  it("reproduz as medições sintéticas com erro pequeno", () => {
    const fit = fitPhysics(synth);
    expect(Math.sqrt(fit.loss / synth.length)).toBeLessThan(0.02);
  });
  it("sem arrasto a razão full/meia ≈ força²", () => {
    const flat = { ...DEFAULT_PHYSICS, drag: 0 };
    const s = [50, 100].map(p => ({ angleDeg: 45, power: p, dx: predictDx({ angleDeg: 45, power: p, dx: 1 }, flat)! }));
    const c = powerScalingCheck(s)[0]!;
    expect(c.ratio).toBeCloseTo(c.expected, 0);
  });
});

// Arquivo histórico: verifica o perfil ajustado por tabelas, separado do perfil DDTank41 usado no jogo.
describe("tabelas de tiro DDTank (20°, 30°, 50°, 65°)", () => {
  const U = data.unitPx;
  for (const [angle, powers] of Object.entries(data.tables)) {
    it(`${angle}°: força prevista a ≤ 3 pts da tabela (mediana ≤ 1,2)`, () => {
      const errs = powers.map((p, i) => Math.abs(requiredPower(+angle, (i + 1) * U, DEFAULT_PHYSICS, MUZZLE_HEIGHT)! - p));
      expect(Math.max(...errs)).toBeLessThanOrEqual(3);
      const med = [...errs].sort((a, b) => a - b)[Math.floor(errs.length / 2)]!;
      expect(med).toBeLessThanOrEqual(1.2);
    });
  }
  it("tiro alto (força 95, ângulo = 90 − distância) cai a ≤ 0,7 un da distância esperada", () => {
    for (const d of [10, 12, 14, 16, 18, 20]) {
      const got = predictDx({ angleDeg: 90 - d, power: 95, dx: 1 }, DEFAULT_PHYSICS, MUZZLE_HEIGHT)! / U;
      expect(Math.abs(got - d)).toBeLessThanOrEqual(0.7);
    }
  });
  it("amostras geradas têm 80 pontos", () => {
    expect(samplesFromTables(data.tables, U)).toHaveLength(80);
    expect(evaluate(samplesFromTables(data.tables, U), DEFAULT_PHYSICS, MUZZLE_HEIGHT)).toHaveLength(80);
  });
});

describe("vento (regra: ângulo ± vento × 2)", () => {
  it("com o windAccel padrão a regra erra em média ≤ 0,5 distância", () => {
    expect(windRuleError(DEFAULT_PHYSICS)).toBeLessThanOrEqual(0.5);
  });
  it("o windAccel padrão está perto do ótimo da regra", () => {
    const best = fitWindAccel(DEFAULT_PHYSICS);
    expect(Math.abs(best.windAccel - DEFAULT_PHYSICS.windAccel)).toBeLessThanOrEqual(1.5);
  });
  it("tiro médio: força 62,5 e ângulo 90 − 2d cai perto da distância d", () => {
    for (const d of [8, 10, 12, 14]) {
      const got = predictDx({ angleDeg: 90 - 2 * d, power: 62.5, dx: 1 }, DEFAULT_PHYSICS, MUZZLE_HEIGHT)! / data.unitPx;
      expect(Math.abs(got - d)).toBeLessThanOrEqual(1);
    }
  });
});
