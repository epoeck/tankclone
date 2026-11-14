import { describe, expect, it } from "vitest";
import { COMPOSE_KINDS, STRENGTHEN_KINDS, SUPER_STONE, canCompose, canStrengthen, shopItem, strengthenArmor, superStonesFromOld } from "../src/index";

describe("mochila original (CN CanStrengthen / CanCompose)", () => {
  it("fortalecem: chapéu, roupa e arma; a secundária de cura ainda não tem fortalecimento", () => {
    expect([...STRENGTHEN_KINDS].sort()).toEqual(["cloth", "head", "weapon"]);
    for (const k of ["glass", "hair", "face", "eff", "wing", "armlet", "ring", "offhand"]) expect(canStrengthen(k)).toBe(false);
  });
  it("compõem: chapéu, óculos, roupa, arma, bracelete e anel; cabelo, rosto, efeito, traje, colar, asa e secundária não", () => {
    expect([...COMPOSE_KINDS].sort()).toEqual(["armlet", "cloth", "glass", "head", "ring", "weapon"]);
    for (const k of ["hair", "face", "eff", "suits", "necklace", "wing", "offhand"]) expect(canCompose(k)).toBe(false);
  });
  it("Super Pedra é a única pedra de fortalecer (10 EXP)", () => {
    expect(shopItem(SUPER_STONE)).toMatchObject({ name: "Super Pedra", kind: "strengthen", exp: 10, icon: "strength11" });
    expect(shopItem("str1")).toBeUndefined();
  });
  it("armadura de chapéu/roupa: round(60·1,1^N) − 60", () => {
    expect([0, 1, 5, 12].map(strengthenArmor)).toEqual([0, 6, 37, 128]);
  });
  it("pedras antigas viram Super Pedras por EXP (Nv1/2 = 1, Nv3 = 2, Nv4 = 6, Nv5 = 22)", () => {
    expect(["str1", "str2", "str3", "str4", "str5"].map(i => superStonesFromOld(i, 1))).toEqual([1, 1, 2, 6, 22]);
    expect(superStonesFromOld("super", 4)).toBe(0);
  });
});
