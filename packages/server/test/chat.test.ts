import { describe, it, expect } from "vitest";
import { ChatLimiter, CHAT_MAX, cleanChat } from "../src/chat";

describe("cleanChat", () => {
  it("corta em 200, tira controles/bidi e normaliza espaços", () => {
    expect(cleanChat("a".repeat(500))).toHaveLength(CHAT_MAX);
    expect(cleanChat("  oi\n\n  tudo\tbem\u202E ")).toBe("oi tudo bem");
    expect(cleanChat("\u0000\u0007")).toBe("");
    expect(cleanChat(42)).toBe("");
    expect(cleanChat({})).toBe("");
  });
  it("não mexe em HTML (a UI usa textContent)", () => {
    expect(cleanChat("<img src=x onerror=1>")).toBe("<img src=x onerror=1>");
  });
});

describe("ChatLimiter", () => {
  it("rajada de 4, depois 1 a cada 1,5 s", () => {
    let t = 0; const l = new ChatLimiter(4, 1500, () => t);
    expect([1, 2, 3, 4, 5].map(() => l.allow())).toEqual([true, true, true, true, false]);
    t += 1500; expect(l.allow()).toBe(true); expect(l.allow()).toBe(false);
  });
});
