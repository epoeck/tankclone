import { describe, it, expect } from "vitest";
import { DEFAULT_PHYSICS, launch, simulateShot, type Hitbox, type Shot } from "../src/physics";

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

describe("colisão contínua", () => {
  it("não atravessa parede de 1 px mesmo a velocidade altíssima", () => {
    const fast: Shot = { x: 0, y: 500, angleDeg: 0, power: 100, facing: 1, wind: 0 }; // ~28 px/passo
    const r = simulateShot(fast, x => Math.floor(x) === 513);
    expect(r.hit).not.toBeNull();
    expect(Math.floor(r.hit!.x)).toBe(513);
    expect(r.hitKind).toBe("terrain");
  });
});

describe("colisão com jogadores", () => {
  const target: Hitbox = { id: "alvo", x: 400, y: 500, w: 36, h: 52 };
  const flat = (_x: number, y: number) => y >= 520;
  const aim: Shot = { x: 100, y: 480, angleDeg: 0, power: 100, facing: 1, wind: 0 };
  it("acerta o jogador antes do terreno", () => {
    const r = simulateShot(aim, flat, DEFAULT_PHYSICS, { hitboxes: [target] });
    expect(r.hitKind).toBe("player");
    expect(r.targetId).toBe("alvo");
    expect(r.hit!.x).toBeGreaterThanOrEqual(382);
    expect(r.hit!.x).toBeLessThan(386);
  });
  it("sem a hitbox o tiro segue até o terreno", () => {
    expect(simulateShot(aim, flat).hitKind).toBe("terrain");
  });
  it("não acerta o próprio atirador ao sair, mas acerta se voltar", () => {
    const self: Hitbox = { id: "eu", x: 100, y: 500, w: 36, h: 52 };
    const out = simulateShot(aim, flat, DEFAULT_PHYSICS, { hitboxes: [self], shooterId: "eu" });
    expect(out.hitKind).toBe("terrain");
    const up: Shot = { ...aim, angleDeg: 90, power: 40 }; // sobe reto e cai em cima de si
    const back = simulateShot(up, flat, DEFAULT_PHYSICS, { hitboxes: [self], shooterId: "eu" });
    expect(back.hitKind).toBe("player");
    expect(back.targetId).toBe("eu");
  });
  it("tiro acima da caixa passa por cima", () => {
    const high: Hitbox = { ...target, y: 560 };
    const r = simulateShot({ ...aim, y: 400 }, flat, DEFAULT_PHYSICS, { hitboxes: [high] });
    expect(r.hitKind).toBe("terrain");
  });
});
