import { describe, expect, it } from "vitest";
import { CARD_COUNT, CARD_GOLD, CARD_PICK_MS, CARD_XP, CardTable, makeDeck } from "../src/cards";

const seq = (...v: number[]) => { let i = 0; return (n: number) => v[i++ % v.length]! % n; };

describe("cartas do fim de partida", () => {
  it("baralho de 9 só com XP ou gold, nos degraus definidos", () => {
    let s = 1; const rand = (n: number) => { s = (s * 1103515245 + 12345) % 2 ** 31; return s % n; };
    for (let k = 0; k < 50; k++) {
      const deck = makeDeck(rand);
      expect(deck).toHaveLength(CARD_COUNT);
      for (const c of deck) {
        const r = c.kind === "xp" ? CARD_XP : CARD_GOLD;
        expect(c.amount).toBeGreaterThanOrEqual(r.min); expect(c.amount).toBeLessThanOrEqual(r.max);
        expect((c.amount - r.min) % r.step).toBe(0);
      }
    }
  });
  it("uma escolha por jogador; índice validado; depois do prazo escolhe sozinho", () => {
    const t = new CardTable(seq(0, 3, 1, 5));
    t.deal(["a", "b"], 1000);
    expect(t.pick("a", 9)).toBe("carta inválida");
    expect(t.pick("a", 1.5)).toBe("carta inválida");
    const r = t.pick("a", 4);
    if (typeof r === "string") throw new Error(r);
    expect(r.index).toBe(4); expect(r.deck).toHaveLength(9); expect(r.deck[4]).toEqual(r.reward);
    expect(t.pick("a", 4)).toBe("nenhuma carta para escolher");
    expect(t.expire(1000 + CARD_PICK_MS - 1)).toEqual([]);
    const auto = t.expire(1000 + CARD_PICK_MS);
    expect(auto.map(x => x.nick)).toEqual(["b"]); expect(t.has("b")).toBe(false);
  });
});
