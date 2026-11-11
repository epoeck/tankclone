import { describe, it, expect } from "vitest";
import { DEFAULT_PHYSICS, launch, simulateShot, type Shot } from "../src/physics";

const flatGround = (groundY: number) => (_x: number, y: number) => y >= groundY;
const ideal = { ...DEFAULT_PHYSICS, drag: 0 }; // parábola ideal para comparar com a fórmula analítica
const base: Shot = { x: 0, y: 500, angleDeg: 45, power: 50, facing: 1, wind: 0 };

describe("launch", () => {
  it("90° vai reto para cima", () => {
    const p = launch({ ...base, angleDeg: 90 });
    expect(p.vx).toBeCloseTo(0);
    expect(p.vy).toBeLessThan(0);
  });
  it("facing -1 espelha o eixo X", () => {
    const r = launch({ ...base, facing: 1 });
    const l = launch({ ...base, facing: -1 });
    expect(l.vx).toBeCloseTo(-r.vx);
    expect(l.vy).toBeCloseTo(r.vy);
  });
});

describe("simulateShot", () => {
  it("é determinístico: mesma entrada, mesma saída", () => {
    const a = simulateShot(base, flatGround(500.5));
    const b = simulateShot(base, flatGround(500.5));
    expect(a).toEqual(b);
  });

  it("alcance em solo plano ≈ fórmula analítica v²·sin(2θ)/g", () => {
    const v = base.power * ideal.speedPerPower;
    const expected = (v * v * Math.sin((2 * 45 * Math.PI) / 180)) / ideal.gravity;
    // o chão fica em y=500 (mesma altura do disparo): cruza ao voltar
    const r = simulateShot({ ...base }, (_x, y) => y >= 500 && _x > 1, ideal);
    expect(r.hit).not.toBeNull();
    expect(Math.abs(r.hit!.x - expected) / expected).toBeLessThan(0.03); // erro do Euler < 3%
  });

  it("mais força → mais alcance", () => {
    const g = (_x: number, y: number) => y >= 500 && _x > 1;
    const near = simulateShot({ ...base, power: 40 }, g).hit!.x;
    const far = simulateShot({ ...base, power: 60 }, g).hit!.x;
    expect(far).toBeGreaterThan(near);
  });

  it("vento a favor aumenta alcance; contra diminui", () => {
    const g = (_x: number, y: number) => y >= 500 && _x > 1;
    const calm = simulateShot({ ...base, wind: 0 }, g).hit!.x;
    const tail = simulateShot({ ...base, wind: 5 }, g).hit!.x;
    const head = simulateShot({ ...base, wind: -5 }, g).hit!.x;
    expect(tail).toBeGreaterThan(calm);
    expect(head).toBeLessThan(calm);
  });

  it("sem colisão termina em maxSteps com hit=null", () => {
    const r = simulateShot(base, () => false);
    expect(r.hit).toBeNull();
    expect(r.steps).toBe(DEFAULT_PHYSICS.maxSteps);
  });
});
