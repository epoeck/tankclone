import { describe, it, expect } from "vitest";
import { Db, levelForXp, xpForLevel, unlocksAt, MAX_LEVEL } from "../src/db";

describe("contas", () => {
  it("registra, loga e rejeita senha errada/apelido repetido (sem diferenciar maiúsculas)", () => {
    const db = new Db();
    expect(db.register("Izzy", "segredo1")).toMatchObject({ nick: "Izzy", level: 1 });
    expect(typeof db.register("izzy", "outra123")).toBe("string");
    expect(db.login("IZZY", "segredo1")).toMatchObject({ nick: "Izzy" });
    expect(db.login("Izzy", "errada")).toBe("apelido ou senha incorretos");
    expect(db.login("ninguem", "segredo1")).toBe("apelido ou senha incorretos");
  });
  it("valida apelido e senha", () => {
    const db = new Db();
    expect(typeof db.register("a", "segredo1")).toBe("string");
    expect(typeof db.register("nome com espaço", "segredo1")).toBe("string");
    expect(typeof db.register("valido", "123")).toBe("string");
  });
  it("XP soma e sobe de nível, com teto em 30", () => {
    const db = new Db();
    db.register("jogador", "segredo1");
    expect(db.addXp("jogador", 100)).toMatchObject({ xp: 100, level: 2 });
    expect(db.addXp("jogador", 1_000_000)!.level).toBe(MAX_LEVEL);
    expect(db.login("jogador", "segredo1")).toMatchObject({ level: MAX_LEVEL });
  });
  it("níveis e desbloqueios", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(xpForLevel(10) - 1)).toBe(9);
    expect(levelForXp(xpForLevel(10))).toBe(10);
    expect(unlocksAt(9)).toEqual([]);
    expect(unlocksAt(18)).toEqual(["instancias", "perolas"]);
    expect(unlocksAt(30)).toEqual(["instancias", "perolas", "pets", "cartas"]);
  });
});
