import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { classifyPixel, decodeStates, type MapManifest } from "../src/maps";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/public/maps");

describe("mapas em disco: mask.bin em dia com mask.png", () => {
  const ids = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(dir, d.name, "manifest.json"))).map(d => d.name) : [];
  it("há mapas", () => { expect(ids.length).toBeGreaterThanOrEqual(5); });
  for (const id of ids) {
    it(`${id}: mask.bin == classificação do mask.png (senão: rode npm run maps:build -w @tankclone/core)`, () => {
      const m = JSON.parse(readFileSync(join(dir, id, "manifest.json"), "utf8")) as MapManifest;
      const png = PNG.sync.read(readFileSync(join(dir, id, m.mask)));
      const hint = `mask.bin de "${id}" desatualizado: rode npm run maps:build -w @tankclone/core`;
      expect(png.width * png.height, hint).toBe(m.width * m.height);
      let bin: Uint8Array;
      try { bin = decodeStates(new Uint8Array(readFileSync(join(dir, id, "mask.bin"))), png.width * png.height); } catch { throw new Error(hint); }
      let diff = 0;
      for (let i = 0; i < bin.length; i++) if (bin[i] !== classifyPixel(png.data[i * 4]!, png.data[i * 4 + 1]!, png.data[i * 4 + 2]!)) diff++;
      expect(diff, hint).toBe(0);
    });
  }
});
