import { describe, expect, it } from "vitest";
import { ACCESSORIES, Match, NEW_WEAPON, STRENGTHEN_EXP, STRENGTHEN_MAX, Terrain, accessoryByRef, composeWith, lookStats, shopItem, stonesToNext, strengthenWith, strengthenedDamage, weaponStage, type MatchEvent } from "../src/index";

describe("ferreiro garantido (CN 14.7: EXP por nível, máximo +12)", () => {
  it("sobe exatamente ao completar a EXP; sobra fica no nível novo; nada de sorteio", () => {
    const s1 = shopItem("super")!; // 10 EXP
    expect(stonesToNext(NEW_WEAPON, s1.exp!)).toBe(1);
    const a = strengthenWith(NEW_WEAPON, s1.exp!, 1);
    expect(a).toMatchObject({ used: 1, weapon: { level: 1, exp: 0 } });
    expect(stonesToNext(a.weapon, s1.exp!)).toBe(5); // 50 EXP para o +2
    const b = strengthenWith(a.weapon, s1.exp!, 3);
    expect(b.weapon).toMatchObject({ level: 1, exp: 30 });
    // muitas pedras: sobe vários níveis e para no +12 sem gastar pedra a mais
    const total = (STRENGTHEN_EXP as readonly number[]).reduce((x, y) => x + y, 0);
    const c = strengthenWith(NEW_WEAPON, 10, 99999);
    expect(c.weapon.level).toBe(STRENGTHEN_MAX); expect(c.used).toBe(Math.ceil(total / 10));
    expect(strengthenWith(c.weapon, 10, 5).used).toBe(0);
  });
  it("modelo da arma muda no +10 e no +12; dano-base × 1,1^nível", () => {
    expect([0, 9, 10, 11, 12].map(weaponStage)).toEqual([0, 0, 1, 1, 2]);
    expect(strengthenedDamage(200, 0)).toBe(200); expect(strengthenedDamage(200, 12)).toBe(Math.round(200 * 1.1 ** 12));
  });
  it("composição grava o valor da pedra no atributo (garantida, substitui)", () => {
    const w = composeWith(composeWith(NEW_WEAPON, "atk", 20), "atk", 51);
    expect(w.compose).toEqual({ atk: 51, def: 0, agi: 0, luck: 0 });
  });
  it("roupas somam os atributos do catálogo CN (+5 por peça) e as clássicas não somam", () => {
    expect(lookStats({ appearance: { face: 0, hair: 0 }, equipped: { outfit: 0 } })).toEqual({ atk: 0, def: 0, agi: 0, luck: 0 });
  });
});

describe("tiers de fusão CN 14.7", () => {
  it("usa quatro iguais até os tetos locais: pulseira +10, anel +8", () => {
    const bracelet = ACCESSORIES.filter(a => a.kind === "armlet"), ring = ACCESSORIES.filter(a => a.kind === "ring");
    expect(bracelet[0]).toMatchObject({ ref: "8015", atk: 20, def: 15, agi: 15, luck: 20, next: "8115" });
    expect(bracelet.at(-1)).toMatchObject({ ref: "85154", atk: 535, def: 400 }); expect(bracelet.at(-1)).not.toHaveProperty("next");
    expect(ring[0]).toMatchObject({ ref: "9024", name: "Anel do Romance", next: "9124" });
    expect(ring.at(-1)).toMatchObject({ ref: "95242", atk: 146 }); expect(ring.at(-1)).not.toHaveProperty("next");
    expect(accessoryByRef("95241")?.next).toBe("95242");
  });
});

describe("bolas por estágio e por item (ballconfig do Reborn)", () => {
  const shoot = (weaponLevel: number, item?: "1" | "4" | "2") => {
    const m = new Match({ seed: 3, terrain: Terrain.fromHeightFn(1200, 600, () => 450), players: [
      { id: "a", team: 1, x: 200, weaponId: "sledge", weaponLevel, hp: 10000 }, { id: "b", team: 2, x: 1000, weaponId: "sledge", hp: 10000 }] });
    while (m.currentId !== "a") m.submit({ type: "pass", playerId: m.currentId });
    if (item) m.submit({ type: "item", playerId: "a", key: item });
    const r = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 40 }); if (!r.ok) throw Error(r.error);
    return (r.events as MatchEvent[]).filter(e => e.type === "shot").map(e => e.type === "shot" ? e.ballId : 0);
  };
  it("+0/+10/+12 trocam a bola comum; +tiros usa MultiBall e +dano usa AddWound; leque fica na comum", () => {
    expect(shoot(0)).toEqual([381]);
    expect(shoot(10)).toEqual([382]);
    expect(shoot(12)).toEqual([383]);
    expect(shoot(0, "1")).toEqual([3811]);
    expect(shoot(10, "4")).toEqual([3822]);
    expect(shoot(0, "2")).toEqual([381, 381, 381]);
  });
});
