import { describe, it, expect } from "vitest";
import { AuthLimiter } from "../src/limits";

describe("AuthLimiter", () => {
  const mk = () => { let t = 0; const l = new AuthLimiter(undefined, () => t); return { l, adv: (ms: number) => { t += ms; } }; };
  it("bloqueia após 5 falhas e libera depois da espera", () => {
    const { l, adv } = mk();
    for (let i = 0; i < 4; i++) { l.fail("ip:1"); expect(l.blockedFor("ip:1")).toBe(0); }
    l.fail("ip:1");
    expect(l.blockedFor("ip:1")).toBeGreaterThan(0);
    adv(61_000);
    expect(l.blockedFor("ip:1")).toBe(0);
  });
  it("a espera cresce a cada bloqueio, até o teto", () => {
    const { l, adv } = mk();
    const wait = () => { for (let i = 0; i < 5; i++) l.fail("k"); const w = l.blockedFor("k"); adv(w * 1000 + 1); return w; };
    const w1 = wait(), w2 = wait(), w3 = wait();
    expect(w2).toBeGreaterThan(w1);
    expect(w3).toBeGreaterThan(w2);
    for (let i = 0; i < 12; i++) wait();
    expect(wait()).toBeLessThanOrEqual(3600);
  });
  it("falhas antigas saem da janela e sucesso zera", () => {
    const { l, adv } = mk();
    for (let i = 0; i < 4; i++) l.fail("k");
    adv(11 * 60_000);
    l.fail("k");
    expect(l.blockedFor("k")).toBe(0);
    for (let i = 0; i < 4; i++) l.fail("k2");
    l.success("k2"); l.fail("k2");
    expect(l.blockedFor("k2")).toBe(0);
  });
  it("cadastros: 3 por hora por IP", () => {
    const { l, adv } = mk();
    expect([1, 2, 3, 4].map(() => l.allowRegister("1.1.1.1"))).toEqual([true, true, true, false]);
    expect(l.allowRegister("2.2.2.2")).toBe(true);
    adv(3_600_001);
    expect(l.allowRegister("1.1.1.1")).toBe(true);
  });
});
