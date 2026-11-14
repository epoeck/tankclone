import { describe, it, expect } from "vitest";
import { DEFAULT_PHYSICS, ITEMS, Match, Terrain, WEAPONS, launch, sampleTrajectory, simulateShot, type Facing } from "../src/index";
import reference from "./fixtures/ddtank41.json";

describe("referência DDTank41", () => {
  it("mantém os custos e delays independentes dos XMLs", () => {
    for (const [key, item] of Object.entries(ITEMS)) {
      const source = reference.items[key as keyof typeof reference.items];
      expect(item.cost).toBe(source.Property4);
      expect(item.delay).toBe(source.Property5);
    }
  });
  it("raios de dano e quantidade de bolas do especial vêm dos XMLs", () => {
    for (const [weapon, common, special] of [[WEAPONS.prism!, reference.balls[101], reference.balls[111]],
      [WEAPONS.sledge!, reference.balls[381], reference.balls[391]], [WEAPONS.furnace!, reference.balls[161], reference.balls[171]]] as const) {
      expect(weapon.damageRadius).toBe(common.Radii);
      expect(weapon.special.damageRadius).toBe(special.Radii);
      expect(weapon.special.balls).toBe(special.Amount);
    }
  });
  for (const trace of reference.trajectories) {
    it(`reproduz EulerVector em 40 ms: ${trace.angle}°, força ${trace.power}, vento ${trace.wind}`, () => {
      const r = simulateShot({ x: 200, y: 400, angleDeg: trace.angle, power: trace.power,
        wind: trace.wind, facing: trace.facing as Facing }, () => false, { ...DEFAULT_PHYSICS, maxSteps: 100 });
      for (const p of trace.points) {
        // Referência calculada separadamente em float32, como no C#.
        expect(Math.abs(r.points[p.step]!.x - p.x)).toBeLessThan(0.02);
        expect(Math.abs(r.points[p.step]!.y - p.y)).toBeLessThan(0.02);
      }
      expect(r.duration).toBe(4);
    });
  }
  it("a ordem dos itens afeta CurrentDamagePlus: 24 = 1.0, 42 = 0.75", () => {
    const multiplier = (keys: string) => {
      const m = new Match({ seed: 1, terrain: Terrain.fromHeightFn(1000, 600, () => 450), players: [
        { id: "a", team: 1, x: 200, weaponId: "sledge" }, { id: "b", team: 2, x: 800, weaponId: "sledge" },
      ] });
      for (const key of keys) expect(m.submit({ type: "item", playerId: "a", key: key as "2" | "4" }).ok).toBe(true);
      return 1 + m.turnInfo.bonus;
    };
    expect(multiplier("24")).toBe(1);
    expect(multiplier("42")).toBe(0.75);
  });
  it("as velocidades laterais do triplo usam 0.9 e 1.1 da força", () => {
    const m = new Match({ seed: 1, terrain: Terrain.fromHeightFn(3000, 600, () => 450), players: [
      { id: "a", team: 1, x: 200, weaponId: "sledge" }, { id: "b", team: 2, x: 2800, weaponId: "sledge" },
    ] });
    m.submit({ type: "item", playerId: "a", key: "2" });
    const result = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 50 });
    if (!result.ok) throw new Error(result.error);
    const shots = result.events.filter(e => e.type === "shot");
    expect(shots).toHaveLength(3);
    for (const [i, angle, power] of [[0, 45, 50], [1, 50, 45], [2, 40, 55]] as const) {
      const v = launch({ x: 0, y: 0, angleDeg: angle, power: power, wind: m.startEvents[0]!.type === "turnStart" ? m.startEvents[0]!.wind : 0, facing: 1 });
      const shot = shots[i]!;
      // A aceleração inicial em X também inclui o vento do turno original.
      const wind = m.startEvents[0]!.type === "turnStart" ? m.startEvents[0]!.wind : 0;
      const expectedDx = (v.vx + (wind * 24 - 0.2 * v.vx) * 0.04) * 0.04;
      expect(shot.points[1]!.x - shot.points[0]!.x).toBeCloseTo(expectedDx, 4);
    }
  });
});

describe("tempo de voo e reprodução", () => {
  it("colisão dentro do último passo conserva o tempo parcial", () => {
    const r = simulateShot({ x: 0, y: 100, angleDeg: 0, power: 100, wind: 0, facing: 1 }, x => x >= 40);
    expect(r.duration).toBeGreaterThan(0);
    expect(r.duration).toBeLessThan(DEFAULT_PHYSICS.dt);
    expect(sampleTrajectory(r.points, r.duration, DEFAULT_PHYSICS.dt, r.duration)).toEqual(r.hit);
  });
  it("30, 60 e 144 FPS chegam à mesma posição no mesmo instante", () => {
    const r = simulateShot({ x: 0, y: 500, angleDeg: 65, power: 80, wind: 0, facing: 1 }, () => false);
    const expected = sampleTrajectory(r.points, 1, DEFAULT_PHYSICS.dt, r.duration);
    for (const fps of [30, 60, 144]) {
      let elapsed = 0;
      for (let i = 0; i < fps; i++) elapsed += 1 / fps;
      const actual = sampleTrajectory(r.points, elapsed, DEFAULT_PHYSICS.dt, r.duration);
      expect(actual.x).toBeCloseTo(expected.x, 8);
      expect(actual.y).toBeCloseTo(expected.y, 8);
    }
  });
});
