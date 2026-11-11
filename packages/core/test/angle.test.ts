import { describe, it, expect } from "vitest";
import { allowedAbsoluteRange, clampAbsoluteAngle, relativeAngle } from "../src/angle";

const range = { min: 20, max: 65 };

describe("faixa de ângulo por arma", () => {
  it("no plano a faixa é a da arma", () => {
    expect(allowedAbsoluteRange(range, 0)).toEqual(range);
    expect(clampAbsoluteAngle(80, range, 0)).toBe(65);
    expect(clampAbsoluteAngle(10, range, 0)).toBe(20);
  });
  it("na subida a faixa gira junto: o ângulo absoluto máximo sobe", () => {
    expect(allowedAbsoluteRange(range, 15)).toEqual({ min: 35, max: 80 });
    expect(clampAbsoluteAngle(80, range, 15)).toBe(80);
  });
  it("na descida o jogador precisa compensar: 20° absolutos ficam fora", () => {
    expect(clampAbsoluteAngle(20, range, -15)).toBe(20); // 5..50 → 20 cabe
    expect(clampAbsoluteAngle(60, range, -15)).toBe(50); // 60 passa do máximo (50)
  });
  it("ângulo relativo = absoluto − inclinação", () => {
    expect(relativeAngle(50, 15)).toBe(35);
  });
});
