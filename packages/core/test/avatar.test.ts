import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { avatarFrameRect, avatarFrames, avatarLayers, avatarTint, COUNTS, DEFAULT_LOOK, sanitizeLook } from "../src/index";
import catalog from "../src/reference/avatar.json";

describe("avatar clássico", () => {
  it("contas antigas recebem masculino e mantêm os índices de aparência", () => {
    const look = sanitizeLook({ appearance: { hair: 2, skin: 4 }, equipped: { hat: 2 } });
    expect(look.appearance).toMatchObject({ sex: "m", hair: 2, skin: 4 });
    expect(look.equipped.hat).toBe(2);
    expect(sanitizeLook({ appearance: { sex: "f" } }).appearance.sex).toBe("f");
    expect(sanitizeLook({ appearance: { sex: "constructor" } }).appearance.sex).toBe("m");
  });
  it("usa cabelo com e sem chapéu nas variantes A e B, como no cliente original", () => {
    const normal = avatarLayers(DEFAULT_LOOK, "sledge", "game");
    const hat = avatarLayers(sanitizeLook({ ...DEFAULT_LOOK, equipped: { ...DEFAULT_LOOK.equipped, hat: 1 } }), "sledge", "game");
    expect(normal.find(p => p.slot === "hair")!.file).toContain("/B/game.png");
    expect(hat.find(p => p.slot === "hair")!.file).toContain("/A/game.png");
    expect(hat.some(p => p.slot === "head")).toBe(true);
  });
  it("todas as combinações de opções apontam somente para arquivos importados", () => {
    for (const sex of ["m", "f"] as const) for (const mode of ["game", "show"] as const) {
      for (let hair = 0; hair < COUNTS.hair; hair++) for (let face = 0; face < COUNTS.face; face++)
        for (let outfit = 0; outfit < COUNTS.outfit; outfit++) for (let hat = 0; hat < COUNTS.hat; hat++) {
          const look = sanitizeLook({ appearance: { sex, hair, face }, equipped: { outfit, hat, glasses: 1, wings: 1 } });
          for (const part of avatarLayers(look, "sledge", mode)) expect(Object.hasOwn(catalog.files, part.file)).toBe(true);
        }
    }
  });
  it("arquivos locais mantêm os hashes e tamanhos dos PNGs originais", () => {
    for (const [file, metadata] of Object.entries(catalog.files)) {
      const bytes = readFileSync(new URL(`../../client/public/assets/avatar/${file}`, import.meta.url));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(metadata.sha256);
      expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([metadata.width, metadata.height]);
      if (file.endsWith("game.png")) expect([metadata.width, metadata.height]).toEqual([1482, 285]);
    }
  });
  it("recorta os 39 quadros da folha 13×3 de 114×95", () => {
    expect(avatarFrameRect(0)).toEqual({ x: 0, y: 0, w: 114, h: 95 });
    expect(avatarFrameRect(13)).toEqual({ x: 0, y: 95, w: 114, h: 95 });
    expect(avatarFrameRect(38)).toEqual({ x: 1368, y: 190, w: 114, h: 95 });
    expect(avatarFrameRect(-1)).toEqual(avatarFrameRect(0));
    expect(avatarFrameRect(999)).toEqual(avatarFrameRect(0));
  });
  it("caminhar usa a sequência original; mirar permanece agachado; disparar e receber dano têm quadros próprios", () => {
    expect(Array.from({ length: 10 }, (_, i) => avatarFrames(i / 25 + 1e-9, true, true).face)).toEqual([1,1,2,2,3,3,4,4,5,5]);
    expect(avatarFrames(0, false, true)).toEqual(avatarFrames(0, false, false));
    expect(avatarFrames(0, false, false, "shoot", 0.09).face).toBe(26);
    expect(avatarFrames(0, false, false, "hit").face).toBe(12);
  });
  it("a cor afeta somente as máscaras correspondentes", () => {
    const parts = avatarLayers(DEFAULT_LOOK, "sledge", "game");
    expect(parts.filter(p => p.tint).map(p => p.slot)).toEqual(["face", "hair", "cloth"]);
    expect(avatarTint("#808080")).toEqual({ fill: [128,128,128], highlight: [0,0,0] });
    expect(avatarTint("#F2C79F")).toEqual({ fill: [252,239,159], highlight: [50,0,0] });
  });
});
