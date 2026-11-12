import { describe, it, expect } from "vitest";
import { Match, Terrain, WEAPONS, DEFAULT_PHYSICS, MUZZLE_HEIGHT, simulateShot, furyFromDamage, type MatchEvent, type PlayerSetup, type ItemKey } from "../src/index";

const flat = () => Terrain.fromHeightFn(1000, 600, () => 450);
const duo = (over: Partial<PlayerSetup> = {}, over2: Partial<PlayerSetup> = {}): PlayerSetup[] => [
  { id: "a", team: 1, x: 200, weaponId: "sledge", agi: 100, ...over },
  { id: "b", team: 2, x: 320, weaponId: "sledge", agi: 0, ...over2 },
];
const mk = (players = duo(), terrain = flat(), config = {}, seed = 1) => new Match({ seed, terrain, players, config });
const ok = (o: ReturnType<Match["submit"]>): MatchEvent[] => { if (!o.ok) throw new Error(o.error); return o.events; };
const ev = <T extends MatchEvent["type"]>(es: MatchEvent[], t: T) => es.filter((e): e is Extract<MatchEvent, { type: T }> => e.type === t);

/** Força que faz o tiro de `from` cair mais perto de `targetX` (ângulo fixo, chão plano). */
function aim(m: Match, id: string, targetX: number, angle: number): number {
  const c = m.getChar(id)!;
  let best = 0, bestErr = Infinity;
  for (let p = 5; p <= 100; p += 0.25) {
    const r = simulateShot({ x: c.x, y: c.y - MUZZLE_HEIGHT, angleDeg: angle, power: p, facing: c.facing, wind: m.wind * WEAPONS[c.weaponId]!.windFactor },
      (x, y) => m.terrain.isSolid(x, y), DEFAULT_PHYSICS);
    if (r.hit && Math.abs(r.hit.x - targetX) < bestErr) { bestErr = Math.abs(r.hit.x - targetX); best = p; }
  }
  return best;
}

describe("energia e itens", () => {
  it("energia = 240 + AGI/30 (conta de referência: 29551 → 1225)", () => {
    const m = mk(duo({ agi: 29551 }));
    expect(m.energyFor(29551)).toBe(1225);
    expect(m.getChar("a")!.maxEnergy).toBe(1225);
    expect(m.getChar("b")!.maxEnergy).toBe(240);
  });
  const combo = (m: Match, id: string, keys: string) => keys.split("").map(k => m.submit({ type: "item", playerId: id, key: k as ItemKey }));
  it('"14" cabe na energia inicial (195 ≤ 240)', () => {
    const m = mk(duo({ agi: 0 }));
    expect(combo(m, "a", "14").every(o => o.ok)).toBe(true);
    expect(m.getChar("a")!.energy).toBe(45);
  });
  it('"124" (305) não cabe em 240 e "1446" (350) só com AGI ≥ 3300', () => {
    const low = mk(duo({ agi: 0 }));
    const r = combo(low, "a", "124");
    expect(r.map(o => o.ok)).toEqual([true, true, false]); // 110+110=220, depois +85 estoura
    const rich = mk(duo({ agi: 3300 })); // 240 + 110 = 350
    expect(combo(rich, "a", "1446").every(o => o.ok)).toBe(true);
    expect(rich.getChar("a")!.energy).toBe(0);
    const rich2 = mk(duo({ agi: 3300 }));
    expect(combo(rich2, "a", "124").every(o => o.ok)).toBe(true); // 305 ≤ 350
  });
  it("todos os itens repetem no turno, exceto o 2 (triplo): a segunda tentativa dá erro e não gasta energia", () => {
    const m = mk(duo({ agi: 6000 })); // 440 de energia
    expect(combo(m, "a", "44").every(o => o.ok)).toBe(true);
    expect(m.submit({ type: "item", playerId: "a", key: "2" }).ok).toBe(true);
    const e = m.getChar("a")!.energy;
    const again = m.submit({ type: "item", playerId: "a", key: "2" });
    expect(again.ok).toBe(false);
    expect(m.getChar("a")!.energy).toBe(e);
  });
  it("+1 tiro causa −10% e +2 tiros −40% por disparo", () => {
    const one = mk(duo({ agi: 3300 })), two = mk(duo({ agi: 3300 }));
    ok(one.submit({ type: "item", playerId: "a", key: "3" })); ok(two.submit({ type: "item", playerId: "a", key: "1" }));
    expect(ev(ok(one.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 })), "shot").map(s => s.damageMult)).toEqual([0.9, 0.9]);
    expect(ev(ok(two.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 })), "shot").map(s => s.damageMult)).toEqual([0.6, 0.6, 0.6]);
  });
  it("só o jogador da vez age", () => {
    const m = mk();
    expect(m.submit({ type: "pass", playerId: "b" }).ok).toBe(false);
  });
});

describe("turnos", () => {
  it("começa quem tem mais agilidade e o delay define a ordem seguinte", () => {
    const m = mk(duo({ agi: 100 }, { agi: 0 }));
    expect(m.currentId).toBe("a");
    ok(m.submit({ type: "pass", playerId: "a" }));
    expect(m.currentId).toBe("b"); // a acumulou delay
    ok(m.submit({ type: "pass", playerId: "b" }));
    expect(m.currentId).toBe("a"); // a ganha menos delay por turno (agi 100) e volta antes
  });
  it("delay de itens é independente de energia, movimento não acrescenta delay sozinho", () => {
    const calm = mk(), moved = mk(), item = mk();
    ok(moved.submit({ type: "move", playerId: "a", dir: -1, px: 50 }));
    ok(item.submit({ type: "item", playerId: "a", key: "4" }));
    const end = (m: Match) => ev(ok(m.submit({ type: "pass", playerId: "a" })), "turnEnd")[0]!.delay;
    const baseline = end(calm);
    expect(end(moved)).toBe(baseline);
    expect(end(item) - baseline).toBe(400);
  });
  it("tempo antes do tiro soma 20 de delay por segundo inteiro", () => {
    const quick = mk(), slow = mk();
    slow.tick(3.9);
    const shot = (m: Match) => ev(ok(m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 10 })), "turnEnd")[0]!.delay;
    expect(shot(slow) - shot(quick)).toBe(60);
  });
  it("PrepareShoot limita o tempo ao id do modo: 3 para turno de 10 s", () => {
    const early = mk(), late = mk();
    early.tick(3); late.tick(9);
    const shot = (m: Match) => ev(ok(m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 10 })), "turnEnd")[0]!.delay;
    expect(shot(late)).toBe(shot(early));
  });
  it("ataque também participa da escolha do primeiro jogador", () => {
    const m = mk(duo({ agi: 100, stats: { atk: 10000 } }, { agi: 0, stats: { atk: 0 } }));
    expect(m.currentId).toBe("b");
  });
  it("tempo: 10 s, passa a vez ao estourar; 5 s se todos têm FC alta", () => {
    const m = mk();
    expect(m.timeLeft).toBe(10);
    expect(m.tick(9.9)).toEqual([]);
    expect(ev(m.tick(0.2), "turnStart")).toHaveLength(1);
    expect(m.currentId).toBe("b");
    const fast = mk(duo({ fc: 5e6 }, { fc: 5e6 }));
    expect(fast.timeLeft).toBe(5);
    const mixed = mk(duo({ fc: 5e6 }, { fc: 10 }));
    expect(mixed.timeLeft).toBe(10);
  });
  it("vento semeado: determinístico, em [-10,10], favorece baixos", () => {
    const winds = (seed: number) => { const m = mk(duo(), flat(), {}, seed); const w: number[] = [m.wind]; for (let i = 0; i < 1500; i++) { m.tick(11); w.push(m.wind); } return w; };
    const a = winds(7), b = winds(7), c = winds(8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a.every(w => Math.abs(w) <= 10)).toBe(true);
    expect(a.filter(w => Math.abs(w) <= 5).length / a.length).toBeGreaterThan(0.7);
    expect(a.some(w => w < 0) && a.some(w => w > 0)).toBe(true);
  });
});

describe("movimento", () => {
  it("anda 1 px por energia e para quando a energia acaba", () => {
    const m = mk();
    const e = ev(ok(m.submit({ type: "move", playerId: "a", dir: 1, px: 1000 })), "move");
    const c = m.getChar("a")!;
    expect(c.energy).toBe(0);
    expect(c.x).toBe(200 + 243); // 240 + 100/30 = 243 de energia
    expect(e.length).toBeGreaterThan(0);
    expect(ok(m.submit({ type: "move", playerId: "a", dir: -1, px: 5 }))).toEqual([
      { type: "move", playerId: "a", facing: -1, path: [], energyLeft: 0 },
    ]);
  });
  it("sobe rampa suave e é barrado por parede alta", () => {
    const t = Terrain.fromHeightFn(1000, 600, x => (x >= 260 ? 360 : 450 - Math.max(0, x - 200) * 1)); // rampa de 45° e depois parede de 90 px
    const m = mk(duo(), t);
    ok(m.submit({ type: "move", playerId: "a", dir: 1, px: 200 }));
    const c = m.getChar("a")!;
    expect(c.y).toBeLessThan(450);
    expect(c.x).toBeLessThan(262);
  });
  it("cair em buraco sem fundo = morte por sair do mapa", () => {
    const t = Terrain.fromHeightFn(1000, 600, x => (x >= 230 && x <= 240 ? 600 : 450));
    const m = mk(duo(), t);
    const es = ok(m.submit({ type: "move", playerId: "a", dir: 1, px: 100 }));
    expect(ev(es, "death")[0]).toMatchObject({ playerId: "a", reason: "out_of_map" });
    expect(m.over).toBe(true);
    expect(m.winnerTeam).toBe(2);
  });
  it("queda: a cratera sob o personagem o faz cair", () => {
    const m = mk(duo({}, { x: 600 }));
    const b = m.getChar("b")!, y0 = b.y;
    m.terrain.carveCircle(600, y0, 30);
    // próximo impacto qualquer reassenta; força um via tiro curto perto de b
    ok(m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 5 }));
    expect(b.y).toBeGreaterThan(y0);
  });
});

describe("tiro, dano e fúria", () => {
  const shoot = (m: Match, id: string, target: number, extra: Partial<{ special: boolean }> = {}) =>
    m.submit({ type: "shoot", playerId: id, angleDeg: 45, power: aim(m, id, target, 45), ...extra });

  it("acerta o alvo: dano, fúria do atacante e do alvo, e cratera", () => {
    const m = mk();
    const es = ok(shoot(m, "a", 320));
    const dmg = ev(es, "damage")[0]!;
    expect(dmg.playerId).toBe("b");
    expect(dmg.amount).toBeGreaterThan(100);
    expect(m.getChar("b")!.hp).toBe(1000 - dmg.amount);
    expect(m.getChar("a")!.fury).toBe(20);
    expect(m.getChar("b")!.fury).toBe(furyFromDamage(dmg.amount));
    expect(ev(es, "crater")).toHaveLength(1);
    expect(m.currentId).toBe("b");
  });
  it("itens de dano somam: 4+4+6 = +130%", () => {
    const base = mk(), buffed = mk();
    const d0 = ev(ok(shoot(base, "a", 320)), "damage")[0]!.amount;
    for (const k of ["4", "4", "6"] as ItemKey[]) ok(buffed.submit({ type: "item", playerId: "a", key: k }));
    const m2 = ev(ok(shoot(buffed, "a", 320)), "damage")[0]!.amount;
    expect(m2 / d0).toBeCloseTo(2.3, 1);
  });
  it("+2 tiros dispara 3 vezes e triplo dispara 3 projéteis", () => {
    const m = mk(duo({ agi: 3300 }));
    ok(m.submit({ type: "item", playerId: "a", key: "1" }));
    expect(ev(ok(shoot(m, "a", 320)), "shot")).toHaveLength(3);
    const t = mk(duo({ agi: 3300 }));
    ok(t.submit({ type: "item", playerId: "a", key: "2" }));
    const shots = ev(ok(shoot(t, "a", 320)), "shot");
    expect(shots).toHaveLength(3);
    expect(shots.every(s => s.damageMult === 1)).toBe(true);
    expect(shots[0]!.points[1]).not.toEqual(shots[1]!.points[1]);
  });
  it("tecla F: voa até onde o projétil cai, sem dano nem cratera", () => {
    const m = mk(duo({ agi: 3300 }, { x: 900 }));
    ok(m.submit({ type: "item", playerId: "a", key: "F" }));
    const es = ok(shoot(m, "a", 500));
    expect(ev(es, "fly")).toHaveLength(1);
    expect(m.getChar("a")!.x).toBeGreaterThan(400);
    expect(ev(es, "damage")).toHaveLength(0);
    expect(ev(es, "crater")).toHaveLength(0);
  });
  it("faixa de ângulo: o Prisma (55–70) prende 10° em 55°", () => {
    const run = (angle: number) => { const m = mk(duo({ weaponId: "prism" })); return ev(ok(m.submit({ type: "shoot", playerId: "a", angleDeg: angle, power: 60 })), "shot")[0]!.points; };
    expect(run(10)).toEqual(run(55));
  });
  it("especial exige fúria cheia e a zera", () => {
    const m = mk(duo({ weaponId: "furnace" }));
    expect(m.submit({ type: "shoot", playerId: "a", angleDeg: 30, power: 50, special: true }).ok).toBe(false);
    m.getChar("a")!.fury = 200;
    const es = ok(m.submit({ type: "shoot", playerId: "a", angleDeg: 30, power: 50, special: true }));
    expect(ev(es, "shot")).toHaveLength(WEAPONS.furnace!.special.balls);
    expect(m.getChar("a")!.fury).toBe(20);
  });
  it("aliados não se ferem (friendlyFire off)", () => {
    const m = mk([{ id: "a", team: 1, x: 200, weaponId: "sledge" }, { id: "c", team: 1, x: 320, weaponId: "sledge" }, { id: "b", team: 2, x: 800, weaponId: "sledge" }]);
    expect(ev(ok(shoot(m, "a", 320)), "damage")).toHaveLength(0);
  });
  it("o atirador sofre dano do próprio tiro, mas a vida desce no máximo até 1", () => {
    const hit = (hp: number) => { const m = mk(duo({ hp }), flat(), {}, 1); return { es: ok(m.submit({ type: "shoot", playerId: "a", angleDeg: 65, power: 12 })), m }; };
    const a = hit(5000); const dmg = ev(a.es, "damage").find(e => e.playerId === "a");
    expect(dmg).toBeTruthy(); expect(a.m.getChar("a")!.hp).toBe(5000 - dmg!.amount);
    const b = hit(1); expect(b.m.getChar("a")!.alive).toBe(true); expect(b.m.getChar("a")!.hp).toBe(1);
    const c = hit(30); expect(c.m.getChar("a")!.alive).toBe(true); expect(c.m.getChar("a")!.hp).toBeGreaterThanOrEqual(1);
  });
  it("voo (F): faixa 0–90° em vez da da arma", () => {
    const run = (angle: number, fly: boolean) => { const m = mk(); if (fly) ok(m.submit({ type: "item", playerId: "a", key: "F" })); return ev(ok(m.submit({ type: "shoot", playerId: "a", angleDeg: angle, power: 40 })), "shot")[0]!.points; };
    expect(run(5, false)).toEqual(run(20, false)); // Marreta prende em 20°
    expect(run(5, true)).not.toEqual(run(20, true)); // com F, 5° vale
    expect(run(100, true)).toEqual(run(90, true));
  });
  it("morte por HP encerra a partida quando só resta um time", () => {
    const m = mk(duo({}, { hp: 50 }));
    const es = ok(shoot(m, "a", 320));
    expect(ev(es, "death")[0]).toMatchObject({ playerId: "b", reason: "hp" });
    expect(ev(es, "gameOver")[0]).toMatchObject({ winnerTeam: 1 });
    expect(m.over).toBe(true);
    expect(m.submit({ type: "pass", playerId: "a" }).ok).toBe(false);
  });
  it("limite de turnos: vence o time com mais HP", () => {
    const m = mk(duo(), flat(), { maxTurns: 2 });
    m.getChar("b")!.hp = 400;
    ok(m.submit({ type: "pass", playerId: "a" }));
    const es = ok(m.submit({ type: "pass", playerId: "b" }));
    expect(ev(es, "gameOver")[0]).toMatchObject({ winnerTeam: 1 });
  });
  it("determinismo: mesma semente e mesmas intenções → mesmos eventos", () => {
    const run = () => { const m = mk(); const out: MatchEvent[] = [...m.startEvents]; out.push(...ok(shoot(m, "a", 320))); out.push(...ok(m.submit({ type: "pass", playerId: "b" }))); return out; };
    expect(run()).toEqual(run());
  });
});

describe("morte do jogador da vez", () => {
  it("cair do mapa andando encerra o turno e o morto não age mais", () => {
    const t = Terrain.fromHeightFn(1000, 600, x => (x >= 230 && x <= 240 ? 600 : 450));
    const m = mk([{ id: "a", team: 1, x: 200, weaponId: "sledge", agi: 100 }, { id: "c", team: 1, x: 100, weaponId: "sledge" }, { id: "b", team: 2, x: 800, weaponId: "sledge" }], t);
    expect(m.currentId).toBe("a");
    const es = ok(m.submit({ type: "move", playerId: "a", dir: 1, px: 100 }));
    expect(ev(es, "death")[0]).toMatchObject({ playerId: "a" });
    expect(ev(es, "turnStart")).toHaveLength(1);
    expect(m.currentId).not.toBe("a");
    expect(m.submit({ type: "move", playerId: "a", dir: -1, px: 10 }).ok).toBe(false);
  });
});

describe("chaves de protótipo", () => {
  it("item 'constructor' é rejeitado e não corrompe a energia", () => {
    const m = mk();
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty"]) expect(m.submit({ type: "item", playerId: "a", key: key as ItemKey }).ok).toBe(false);
    expect(m.getChar("a")!.energy).toBe(m.getChar("a")!.maxEnergy);
  });
  it("arma '__proto__' ou 'constructor' é recusada ao criar a partida", () => {
    for (const weaponId of ["__proto__", "constructor", "toString"]) expect(() => mk(duo({ weaponId }))).toThrow();
  });
});
