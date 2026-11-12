import { describe, it, expect } from "vitest";
import { MAPS, Match, Terrain } from "@tankclone/core";
import { loadMaps } from "../src/maps";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

describe("mapas assados", () => {
  const res = loadMaps();
  it("carrega os cinco mapas provisórios e os cinco clássicos", () => {
    // os clássicos (original-*) ficam só no disco, fora do git; num clone limpo eles aparecem como ignorados
    const classics = ["original-1001", "original-1002", "original-1003", "original-1004", "original-1005"];
    const local = existsSync(resolve(import.meta.dirname, "../../client/public/maps/original-1001"));
    expect(res.skipped.map(s => s.id).sort()).toEqual(local ? [] : classics);
    expect(res.loaded.sort()).toEqual(["colinas", "ferro", "forja", "ilhas", "nuvens", ...(local ? classics : [])]);
  });
  it("2 mapas com chão indestrutível e 3 tatuzáveis", () => {
    const ind = ["colinas", "ferro", "forja", "ilhas", "nuvens"].filter(id => MAPS[id]!.indestructible).sort();
    expect(ind).toEqual(["ferro", "forja"]);
  });
  it("todos os spawns (4 por time) têm chão e a partida 4v4 inicia em cada mapa", () => {
    for (const id of res.loaded) {
      const def = MAPS[id]!, t: Terrain = def.build();
      for (const team of ["1", "2"] as const) for (const x of def.spawns![team]) expect(t.surfaceY(x, 0), `${id} ${team} ${x}`).toBeGreaterThan(0);
      const players = [1, 2].flatMap(team => [0, 1, 2, 3].map(i => ({ id: `t${team}p${i}`, team, x: def.spawns![String(team) as "1" | "2"][i]!, spawnY: def.spawnsY?.[String(team) as "1" | "2"][i], weaponId: "sledge", facing: (team === 1 ? 1 : -1) as 1 | -1 })));
      expect(() => new Match({ seed: 1, terrain: def.build(), players })).not.toThrow();
    }
  });
  it("cratera não fura o chão indestrutível do Pátio de Ferro", () => {
    const t = MAPS.ferro!.build();
    const y = t.surfaceY(1200, 0); // coluna central: pilar de aço
    t.carveCircle(1200, y, 60);
    expect(t.stateAt(1200, y + 5)).toBe(2);
  });
  it("o buraco da Forja é um abismo: personagem que anda até lá sai do mapa", () => {
    const def = MAPS.forja!;
    const m = new Match({ seed: 1, terrain: def.build(), players: [{ id: "a", team: 1, x: 630, weaponId: "sledge", agi: 6000 }, { id: "b", team: 2, x: 1770, weaponId: "sledge" }] });
    const o = m.submit({ type: "move", playerId: "a", dir: 1, px: 500 });
    expect(o.ok && o.events.some(e => e.type === "death" && e.reason === "out_of_map")).toBe(true);
  });
});
