import { describe, it, expect } from "vitest";
import { MAPS, analyzeMask, classifyPixel, decodeStates, encodeStates, mapFromStates, type MapManifest } from "../src/maps";
import { Terrain, AIR, DESTRUCTIBLE, INDESTRUCTIBLE } from "../src/terrain";

const px = (...c: Array<[number, number, number]>) => new Uint8ClampedArray(c.flatMap(([r, g, b]) => [r, g, b, 255]));

describe("codec RLE", () => {
  it("ida e volta, inclusive corridas longas (varint)", () => {
    const s = new Uint8Array(200_000); s.fill(1, 50, 150_000); s.fill(2, 150_000, 150_010); s[199_999] = 1;
    const back = decodeStates(encodeStates(s), s.length);
    expect(Array.from(back.subarray(0, 100))).toEqual(Array.from(s.subarray(0, 100)));
    expect(back.every((v, i) => v === s[i])).toBe(true);
    expect(encodeStates(s).length).toBeLessThan(40);
  });
  it("rejeita bytes corrompidos ou de tamanho errado", () => {
    const enc = encodeStates(new Uint8Array([0, 0, 1, 2]));
    expect(() => decodeStates(enc, 5)).toThrow();
    expect(() => decodeStates(Uint8Array.from([9, 1]), 1)).toThrow();
    expect(() => decodeStates(enc, 3)).toThrow();
  });
});

describe("classifyPixel", () => {
  it("preto = ar, branco = destrutível, vermelho = indestrutível, cinza claro/escuro por luminância", () => {
    expect(classifyPixel(0, 0, 0)).toBe(AIR);
    expect(classifyPixel(255, 255, 255)).toBe(DESTRUCTIBLE);
    expect(classifyPixel(255, 0, 0)).toBe(INDESTRUCTIBLE);
    expect(classifyPixel(200, 200, 200)).toBe(DESTRUCTIBLE);
    expect(classifyPixel(60, 60, 60)).toBe(AIR);
  });
});

describe("analyzeMask", () => {
  const manifest = (spawns: MapManifest["spawns"], width = 10, height = 6) => ({ width, height, spawns });
  // 10×6: ar em cima (4 linhas), chão destrutível na linha 4 e vermelho na 5
  const mask = (): Uint8ClampedArray => { const c: Array<[number, number, number]> = []; for (let y = 0; y < 6; y++) for (let x = 0; x < 10; x++) c.push(y < 4 ? [0, 0, 0] : y === 4 ? [255, 255, 255] : [255, 0, 0]); return px(...c); };
  it("máscara limpa: sem erros nem avisos de tom, com porcentagens certas", () => {
    const r = analyzeMask(manifest({ "1": [2], "2": [7] }), mask());
    expect(r.errors).toEqual([]);
    expect(r.pct.air).toBeCloseTo(66.7, 0);
    expect(r.pct.destructible).toBeCloseTo(16.7, 0);
    expect(r.pct.indestructible).toBeCloseTo(16.7, 0);
    expect(r.warnings.some(w => /intermediários|vermelho/.test(w))).toBe(false);
  });
  it("tamanho da arte diferente da máscara e máscara com tamanho errado são erros", () => {
    expect(analyzeMask(manifest({ "1": [2], "2": [7] }), mask(), { width: 11, height: 6 }).errors.join()).toMatch(/difere/);
    expect(analyzeMask(manifest({ "1": [2], "2": [7] }, 12), mask()).errors.join()).toMatch(/pixels/);
  });
  it("spawn sem chão, fora do mapa ou dentro do chão é erro", () => {
    const m = mask();
    for (let y = 0; y < 6; y++) { const i = (y * 10 + 3) * 4; m[i] = m[i + 1] = m[i + 2] = 0; } // coluna 3 vazia
    const r = analyzeMask(manifest({ "1": [3, 99], "2": [] }), m);
    expect(r.errors.join("\n")).toMatch(/sem chão/);
    expect(r.errors.join("\n")).toMatch(/fora do mapa/);
    expect(r.errors.join("\n")).toMatch(/time 2 sem pontos/);
  });
  it("avisa de cinza (antisserrilhado) e de vermelho não puro", () => {
    const m = mask();
    for (let x = 0; x < 10; x++) { const i = (4 * 10 + x) * 4; m[i] = m[i + 1] = m[i + 2] = 255; }
    for (let x = 0; x < 4; x++) { const i = (3 * 10 + x) * 4; m[i] = m[i + 1] = m[i + 2] = 128; } // cinza
    for (let x = 4; x < 6; x++) { const i = (5 * 10 + x) * 4; m[i] = 200; m[i + 1] = 40; m[i + 2] = 40; } // vermelho suave
    const w = analyzeMask(manifest({ "1": [7], "2": [8] }), m).warnings.join("\n");
    expect(w).toMatch(/intermediários/);
    expect(w).toMatch(/vermelho não puro/);
  });
});

describe("registro de mapas", () => {
  it("mapFromStates cria o terreno e marca se há chão indestrutível", () => {
    const s = new Uint8Array(6 * 4); s.fill(1, 12, 18); s.fill(2, 18, 24);
    const def = mapFromStates({ id: "x", name: "X", width: 6, height: 4, art: "a", mask: "m", spawns: { "1": [1], "2": [4] } }, s, "/maps/x/");
    expect(def.indestructible).toBe(true);
    const t = def.build(); expect(t).toBeInstanceOf(Terrain);
    expect(t.stateAt(0, 3)).toBe(INDESTRUCTIBLE);
    expect(def.windMultiplier).toBe(1);
  });
  it("mapas procedurais têm spawn válido para 4 por time", () => {
    for (const d of Object.values(MAPS)) {
      const t = d.build();
      for (const team of ["1", "2"] as const) { expect(d.spawns![team]).toHaveLength(4); for (const x of d.spawns![team]) expect(t.surfaceY(x, 0), `${d.id} ${team} ${x}`).toBeGreaterThan(0); }
    }
  });
});
