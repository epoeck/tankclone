import { describe, expect, it } from "vitest";
import { Match, Terrain, type Facing, type MatchEvent } from "../src/index";
import { applyCharacterMove } from "../../client/src/character-state";

const create = () => new Match({ seed: 19, terrain: Terrain.fromHeightFn(1000, 600, () => 450), players: [
  { id: "a", team: 1, x: 200, weaponId: "sledge" }, { id: "b", team: 2, x: 800, weaponId: "sledge" },
] });

describe("lado autoritativo do personagem", () => {
  it("andar para a esquerda em pacotes alternados de um e dois pixels não vira para a direita", () => {
    const m = create();
    const view = { x: 200, y: 450, facing: 1 as Facing, energy: 240, walk: 0 };
    for (const px of [1, 2, 1, 1, 2, 1]) {
      const result = m.submit({ type: "move", playerId: "a", dir: -1, px });
      if (!result.ok) throw new Error(result.error);
      for (const event of result.events) if (event.type === "move") applyCharacterMove(view, event);
      expect(view.facing).toBe(-1);
      expect(view.x).toBe(m.getChar("a")!.x);
    }
  });
  it("virar no lugar ou contra uma parede também chega ao cliente", () => {
    const m = create();
    const result = m.submit({ type: "move", playerId: "a", dir: -1, px: 0 });
    if (!result.ok) throw new Error(result.error);
    const event = result.events.find(e => e.type === "move")!;
    expect(event).toMatchObject({ type: "move", facing: -1, path: [], energyLeft: 240 });
    const view = { x: 200, y: 450, facing: 1 as Facing, energy: 240, walk: 0 };
    applyCharacterMove(view, event as Extract<MatchEvent, { type: "move" }>);
    expect(view).toMatchObject({ x: 200, y: 450, facing: -1, walk: 0 });
  });
  it("direção explícita preserva o lado na reconstrução do log", () => {
    const m = create(), view = { x: 200, y: 450, facing: 1 as Facing, energy: 240, walk: 0 };
    const log: MatchEvent[] = [];
    for (const dir of [-1, -1, 1, -1] as const) {
      const result = m.submit({ type: "move", playerId: "a", dir, px: 1 });
      if (!result.ok) throw new Error(result.error);
      log.push(...result.events);
    }
    for (const e of JSON.parse(JSON.stringify(log)) as MatchEvent[]) if (e.type === "move") applyCharacterMove(view, e);
    expect(view.facing).toBe(m.getChar("a")!.facing);
    expect(view.x).toBe(m.getChar("a")!.x);
  });
});

describe("progressão do vento", () => {
  it("muda no máximo uma unidade por turno e nunca durante mira, espera, movimento ou itens", () => {
    const m = create();
    for (let i = 0; i < 300; i++) {
      const previous = m.wind, id = m.currentId;
      expect(m.tick(0.25)).toEqual([]);
      m.submit({ type: "move", playerId: id, dir: 1, px: 0 });
      m.submit({ type: "item", playerId: id, key: "8" });
      expect(m.wind).toBe(previous);
      const result = m.submit({ type: "pass", playerId: id });
      if (!result.ok) throw new Error(result.error);
      expect(Math.abs(m.wind - previous)).toBeLessThanOrEqual(1.00000001);
      expect(m.wind * 10).toBeCloseTo(Math.round(m.wind * 10), 8);
      expect(result.events.filter(e => e.type === "turnStart")).toHaveLength(1);
    }
  });
});
