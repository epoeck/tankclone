import { describe, it, expect } from "vitest";
import { Terrain } from "../src/terrain";
import { simulateShot, type Shot } from "../src/physics";

const flat = () => Terrain.fromHeightFn(200, 100, () => 60);

describe("Terrain", () => {
  it("sólido abaixo da superfície, vazio acima", () => {
    const t = flat();
    expect(t.isSolid(50, 59)).toBe(false);
    expect(t.isSolid(50, 60)).toBe(true);
    expect(t.surfaceY(50)).toBe(60);
  });
  it("limites: laterais e fundo sólidos, topo vazio", () => {
    const t = flat();
    expect(t.isSolid(-1, 10)).toBe(true);
    expect(t.isSolid(200, 10)).toBe(true);
    expect(t.isSolid(50, 100)).toBe(true);
    expect(t.isSolid(50, -5)).toBe(false);
  });
  it("carveCircle abre cratera e devolve pixels removidos", () => {
    const t = flat();
    const n = t.carveCircle(100, 60, 10);
    expect(n).toBeGreaterThan(0);
    expect(t.isSolid(100, 65)).toBe(false);
    expect(t.surfaceY(100)).toBeGreaterThan(65);
    expect(t.isSolid(100, 75)).toBe(true); // fora do raio continua sólido
    expect(t.carveCircle(100, 60, 10)).toBe(0); // idempotente
  });
  it("cratera na borda não estoura o array", () => {
    const t = flat();
    expect(() => t.carveCircle(0, 99, 30)).not.toThrow();
    expect(() => t.carveCircle(-50, -50, 10)).not.toThrow();
  });
  it("clone é independente", () => {
    const a = flat(); const b = a.clone();
    b.carveCircle(100, 60, 10);
    expect(a.isSolid(100, 65)).toBe(true);
  });
  it("fromMask valida tamanho", () => {
    expect(() => Terrain.fromMask(10, 10, new Uint8Array(5))).toThrow();
  });
  it("mesma sequência de crateras → mesma máscara (determinismo)", () => {
    const run = () => { const t = flat(); t.carveCircle(40, 60, 12); t.carveCircle(55, 70, 9); return t.getMask(); };
    expect(Array.from(run())).toEqual(Array.from(run()));
  });
});

describe("tiro contra terreno", () => {
  it("o tiro acerta o terreno e a cratera muda o próximo impacto", () => {
    const t = Terrain.fromHeightFn(1000, 600, () => 430);
    const shot: Shot = { x: 100, y: 420, angleDeg: 45, power: 30, facing: 1, wind: 0 };
    const first = simulateShot(shot, (x, y) => t.isSolid(x, y));
    expect(first.hit).not.toBeNull();
    t.carveCircle(first.hit!.x, first.hit!.y, 25);
    const second = simulateShot(shot, (x, y) => t.isSolid(x, y));
    expect(second.hit!.y).toBeGreaterThan(first.hit!.y); // cai dentro da cratera
  });
});
