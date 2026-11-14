import { describe, it, expect } from "vitest";
import { COUNTS, DEFAULT_LOOK, sanitizeLook } from "../src/appearance";

describe("aparência", () => {
  it("lixo vira o padrão", () => {
    for (const raw of [null, undefined, 5, "x", [], {}, { appearance: 3 }]) expect(sanitizeLook(raw)).toEqual(DEFAULT_LOOK);
  });
  it("índices válidos passam; inválidos caem no padrão campo a campo", () => {
    const l = sanitizeLook({ appearance: { skin: 3, face: 99, hair: -1, hairColor: 1.5 }, equipped: { outfit: COUNTS.outfit - 1, hat: "a", wings: 1, glasses: 9 } });
    expect(l.appearance).toEqual({ sex: "m", skin: 3, face: DEFAULT_LOOK.appearance.face, hair: DEFAULT_LOOK.appearance.hair, hairColor: DEFAULT_LOOK.appearance.hairColor });
    expect(l.equipped).toEqual({ outfit: COUNTS.outfit - 1, hat: 0, glasses: 0, wings: 1 });
  });
  it("não deixa chaves de protótipo vazarem", () => {
    const l = sanitizeLook(JSON.parse('{"appearance":{"__proto__":{"skin":2},"skin":"constructor"}}'));
    expect(l).toEqual(DEFAULT_LOOK);
  });
});
