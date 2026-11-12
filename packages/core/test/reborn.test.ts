import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { DEFAULT_PHYSICS, WEAPONS, Terrain, craterShape, damageBreakdown, eulerStep, step, turnDelay, withStats } from "../src/index";
import golden from "./fixtures/reborn-golden.json";
import assets from "../src/reference/reborn-craters.json";

describe("vetores do oráculo C# publicados pelo DDTank Reborn", () => {
  for (const [i, run] of golden.euler.entries()) {
    it(`Euler #${i}: 50 passos iguais em float32, também pelo step usado na partida`, () => {
      let x = Math.fround(run.init[0]!), v = Math.fround(run.init[1]!);
      const p = { x, y: 0, vx: v, vy: 0 };
      const cfg = { ...DEFAULT_PHYSICS, windAccel: run.f / 10 };
      for (const expected of run.steps) {
        const result = eulerStep(x, v, 10, 2, Math.fround(run.f), 0.04);
        expect(result).toEqual(expected.map(Math.fround));
        [x, v] = result;
        step(p, 1, cfg);
        expect([p.x, p.vx]).toEqual([x, v]);
      }
    });
  }
  it("30 pares de agilidade/ataque mantêm o delay do C#", () => {
    for (const [agi, atk, delay] of golden.turnDelay) expect(turnDelay(withStats({ agi, atk }))).toBe(delay);
  });
  for (const [i, c] of golden.damage.entries()) {
    it(`dano #${i}: mesmo inteiro do C#`, () => {
      const [base, attack, grade, luck, plus, minus] = c.owner;
      const [armor, defence, , , , tx, ty] = c.target;
      const distance = Math.hypot(tx! - c.bomb[0]!, ty! - c.bomb[1]!);
      const result = damageBreakdown({ weapon: { baseDamage: base! },
        attacker: withStats({ atk: attack, grade, luck }), target: withStats({ armor, def: defence }),
        bonus: plus! - 1, shotMult: minus!, crit: false,
        falloff: distance < c.radius ? 1 - distance / c.radius / 4 : 0 });
      expect(result.final).toBe(c.damage);
    });
  }
  it("delay 200 e máscaras das três armas correspondem aos dados empacotados", () => {
    for (const weapon of Object.values(WEAPONS)) for (const id of [weapon.ballId, weapon.special.ballId]) {
      const ball = assets.balls.find(b => b.id === id)!;
      expect(ball.delay).toBe(200);
      expect(weapon.ballDelay).toBe(ball.delay);
      expect(craterShape(id).width).toBeGreaterThan(0);
    }
  });
});

describe("máscaras .bomb no terreno próprio", () => {
  for (const [id, encoded] of Object.entries(golden.maskFiles)) {
    const raw = Buffer.from(encoded, "base64");
    const width = raw.readInt32LE(0), height = raw.readInt32LE(4), stride = Math.trunc(width / 8) + 1;
    const shape = craterShape(+id);
    it(`bola ${id}: preserva dimensões, pixels e hash do arquivo original`, () => {
      const entry = assets.shapes[id as keyof typeof assets.shapes];
      expect([shape.width, shape.height]).toEqual([width, height]);
      expect(createHash("sha256").update(raw).digest("hex")).toBe(entry.sha256);
      const terrain = Terrain.fromHeightFn(width, height, () => 0);
      terrain.carveShape(Math.trunc(width / 2), Math.trunc(height / 2), shape);
      const expected = new Uint8Array(width * height).fill(1);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        if (raw[8 + y * stride + Math.trunc(x / 8)]! & (1 << (7 - x % 8))) expected[y * width + x] = 0;
      }
      expect(terrain.getMask()).toEqual(expected);
    });
    it(`bola ${id}: bordas, alinhamentos e chão indestrutível`, () => {
      for (const [cx, cy] of [[0, 0], [199, 159], [-12, 80], [100, -10], [300, 300], [101, 90], [108, 90]]) {
        const terrain = Terrain.fromHeightFn(200, 160, () => 0);
        terrain.fillIndestructible(90, 0, 94, 160);
        const expected = terrain.getMask().slice();
        const ox = cx! - Math.trunc(width / 2), oy = cy! - Math.trunc(height / 2);
        for (let y = 0; y < 160; y++) for (let x = 0; x < 200; x++) {
          const sx = x - ox, sy = y - oy;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
          if (expected[y * 200 + x] === 1 && (raw[8 + sy * stride + Math.trunc(sx / 8)]! & (1 << (7 - sx % 8)))) expected[y * 200 + x] = 0;
        }
        terrain.carveShape(cx!, cy!, shape);
        expect(terrain.getMask()).toEqual(expected);
        expect(terrain.carveShape(cx!, cy!, shape)).toBe(0);
      }
    });
  }
});
