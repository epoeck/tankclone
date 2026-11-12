import { describe, expect, it } from "vitest";
import { NEW_WEAPON, shopItem, strengthenWith } from "@tankclone/core";
import { Db } from "../src/db";
import { equippedStats } from "../src/rooms";

describe("loja e ferreiro no banco", () => {
  it("compra debita gold e soma pedras; sem gold não compra; gastar e gravar a arma é atômico", async () => {
    const db = new Db(":memory:");
    expect(typeof await db.register("ferreiro", "segredo1")).toBe("object");
    expect(db.buy("ferreiro", "str1", 3, 1)).toBe("gold insuficiente");
    db.addGold("ferreiro", 5);
    expect(db.buy("ferreiro", "str1", 3, 1)).toBeNull();
    expect(db.getGold("ferreiro")).toBe(2);
    expect(db.inventory("ferreiro")).toEqual({ str1: 3 });
    const { weapon, used } = strengthenWith(db.weapon("ferreiro", "sledge"), shopItem("str1")!.exp!, 3);
    expect(db.spendAndSetWeapon("ferreiro", "str1", used, "sledge", weapon)).toBeNull();
    expect(db.weapon("ferreiro", "sledge")).toMatchObject({ level: 1, exp: 20 });
    expect(db.inventory("ferreiro")).toEqual({});
    expect(db.spendAndSetWeapon("ferreiro", "str1", 1, "sledge", NEW_WEAPON)).toBe("recursos insuficientes");
    expect(db.weapon("ferreiro", "sledge").level).toBe(1); // nada mudou
    db.close();
  });
  it("atributos de composição entram nos stats da partida", () => {
    const base = equippedStats("media", { appearance: { sex: "m", skin: 0, face: 0, hair: 0, hairColor: 0 }, equipped: { outfit: 0, hat: 0, glasses: 0, wings: 0 } });
    const comp = equippedStats("media", { appearance: { sex: "m", skin: 0, face: 0, hair: 0, hairColor: 0 }, equipped: { outfit: 0, hat: 0, glasses: 0, wings: 0 } }, { atk: 51, def: 0, agi: 10, luck: 0 });
    expect(comp.atk - base.atk).toBe(51); expect(comp.agi - base.agi).toBe(10);
  });
});
