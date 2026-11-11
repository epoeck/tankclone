import { describe, it, expect } from "vitest";
import { Terrain, AIR, DESTRUCTIBLE, INDESTRUCTIBLE } from "../src/terrain";
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

describe("3 estados e máscara em tons de cinza", () => {
  const px = (...c: Array<[number, number, number]>) => new Uint8ClampedArray(c.flatMap(([r, g, b]) => [r, g, b, 255]));
  it("fromMask RGBA: preto = ar, branco = destrutível, vermelho = indestrutível", () => {
    const t = Terrain.fromMask(3, 1, px([0, 0, 0], [255, 255, 255], [255, 0, 0]));
    expect([0, 1, 2].map(x => t.stateAt(x, 0))).toEqual([AIR, DESTRUCTIBLE, INDESTRUCTIBLE]);
    expect(t.isSolid(0, 0)).toBe(false);
    expect(t.isSolid(2, 0)).toBe(true);
  });
  it("borda antisserrilhada branco→preto nunca vira indestrutível", () => {
    const grays: Array<[number, number, number]> = [];
    for (let v = 0; v <= 255; v += 5) grays.push([v, v, v]);
    const t = Terrain.fromMask(grays.length, 1, px(...grays));
    for (let x = 0; x < grays.length; x++) expect(t.stateAt(x, 0)).not.toBe(INDESTRUCTIBLE);
    expect(t.stateAt(grays.length - 1, 0)).toBe(DESTRUCTIBLE);
    expect(t.stateAt(0, 0)).toBe(AIR);
  });
  it("borda vermelho→preto é ar ou indestrutível, e carve num terreno com borda cinza apaga tudo", () => {
    const t = Terrain.fromMask(4, 1, px([255, 0, 0], [128, 0, 0], [60, 0, 0], [0, 0, 0]));
    expect(t.stateAt(0, 0)).toBe(INDESTRUCTIBLE);
    expect([AIR, INDESTRUCTIBLE]).toContain(t.stateAt(1, 0));
    expect(t.stateAt(2, 0)).toBe(AIR);
    const w = 10, h = 3, data: Array<[number, number, number]> = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.push(y === 1 ? [128, 128, 128] : [255, 255, 255]); // linha de borda cinza
    const m = Terrain.fromMask(w, h, px(...data));
    m.carveCircle(5, 1, 10);
    expect(m.stateAt(5, 1)).toBe(AIR);
  });
  it("fromMask valida tamanho RGBA", () => {
    expect(() => Terrain.fromMask(2, 2, new Uint8ClampedArray(4))).toThrow();
  });
  it("cratera não apaga chão indestrutível", () => {
    const t = flat();
    t.fillIndestructible(80, 60, 120, 100);
    t.carveCircle(100, 70, 15);
    expect(t.stateAt(100, 70)).toBe(INDESTRUCTIBLE);
    t.carveCircle(60, 60, 8);
    expect(t.stateAt(60, 62)).toBe(AIR);
  });
  it("slopeDeg: rampa de 45° mede 45° na subida e −45° na descida, espelhada por facing", () => {
    const t = Terrain.fromHeightFn(400, 400, x => 300 - x); // sobe para a direita a 45°
    const feet = t.surfaceY(200);
    expect(t.slopeDeg(200, feet, 1)).toBeCloseTo(45, 1);
    expect(t.slopeDeg(200, feet, -1)).toBeCloseTo(-45, 1);
  });
  it("slopeDeg: rampa suave e chão plano", () => {
    const t = Terrain.fromHeightFn(400, 300, x => 250 - x * 0.5);
    expect(t.slopeDeg(200, t.surfaceY(200), 1)).toBeCloseTo(26.57, 0);
    expect(flat().slopeDeg(100, 60, 1)).toBeCloseTo(0);
  });
});
