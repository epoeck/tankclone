import { describe, it, expect } from "vitest";
import { Db, levelForXp, xpForLevel, unlocksAt, MAX_LEVEL } from "../src/db";

describe("contas", () => {
  it("registra, loga e rejeita senha errada/apelido repetido (sem diferenciar maiúsculas)", async () => {
    const db = new Db();
    expect(await db.register("Izzy", "segredo1")).toMatchObject({ nick: "Izzy", level: 1 });
    expect(typeof await db.register("izzy", "outra123")).toBe("string");
    expect(await db.login("IZZY", "segredo1")).toMatchObject({ nick: "Izzy" });
    expect(await db.login("Izzy", "errada")).toBe("apelido ou senha incorretos");
    expect(await db.login("ninguem", "segredo1")).toBe("apelido ou senha incorretos");
  });
  it("valida apelido e senha", async () => {
    const db = new Db();
    expect(typeof await db.register("a", "segredo1")).toBe("string");
    expect(typeof await db.register("nome com espaço", "segredo1")).toBe("string");
    expect(typeof await db.register("valido", "123")).toBe("string");
  });
  it("o hash não bloqueia o laço de eventos (scrypt assíncrono)", async () => {
    const db = new Db();
    let ticks = 0;
    const t = setInterval(() => ticks++, 5);
    await Promise.all(Array.from({ length: 6 }, (_, i) => db.register(`user${i}`, "segredo1")));
    clearInterval(t);
    expect(ticks).toBeGreaterThan(3);
  });
  it("XP soma e sobe de nível, com teto em 30", async () => {
    const db = new Db();
    await db.register("jogador", "segredo1");
    expect(db.addXp("jogador", 100)).toMatchObject({ xp: 100, level: 2 });
    expect(db.addXp("jogador", 1_000_000)!.level).toBe(MAX_LEVEL);
    expect(await db.login("jogador", "segredo1")).toMatchObject({ level: MAX_LEVEL });
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

describe("aparência na conta", () => {
  it("persiste, sanitiza e sobrevive ao login", async () => {
    const db = new Db();
    await db.register("bonequinho", "segredo1");
    const look = db.setLook("bonequinho", { appearance: { skin: 4, face: 2, hair: 2, hairColor: 5 }, equipped: { outfit: 2, hat: 1 } });
    expect(look.appearance.skin).toBe(4);
    expect(db.setLook("bonequinho", { appearance: { skin: 999 } }).appearance.skin).toBe(1);
    db.setLook("bonequinho", { appearance: { sex: "f", skin: 5 }, equipped: { hat: 2 } });
    const acc = await db.login("bonequinho", "segredo1");
    expect(typeof acc).not.toBe("string");
    expect((acc as { look: { appearance: { skin: number }; equipped: { hat: number } } }).look).toMatchObject({ appearance: { sex: "f", skin: 5 }, equipped: { hat: 2 } });
  });
});
