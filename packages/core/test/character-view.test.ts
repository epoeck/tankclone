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

describe("orientação visual", () => {
  it("inclina o eixo dos pés ao terreno nos dois sentidos e mantém a mira absoluta", async () => {
    const { applyCharacterTransform } = await import("../../client/src/doll");
    const { relativeAngle } = await import("../src/angle");
    for (const facing of [1, -1] as const) {
      const slope = 30 * facing;
      let sx = 1, sy = 1, rotation = 0;
      const ctx = {
        translate: () => {},
        scale: (x: number, y: number) => { sx = x; sy = y; },
        rotate: (angle: number) => { rotation = angle; },
      } as unknown as CanvasRenderingContext2D;
      applyCharacterTransform(ctx, 100, 200, facing, 1, slope);
      // Vetor local para a frente segue a tangente do chão em coordenadas de tela.
      expect(sx * Math.cos(rotation)).toBeCloseTo(facing * Math.cos(Math.PI / 6));
      expect(sy * Math.sin(rotation)).toBeCloseTo(-Math.sin(Math.PI / 6) * facing);
      // A rotação local da arma cancela a inclinação para preservar a mira absoluta.
      expect(-(rotation - relativeAngle(45, slope) * Math.PI / 180)).toBeCloseTo(Math.PI / 4);
    }
  });
  it("aponta a agulha para o lado de tiro sem mudar o número do ângulo", async () => {
    const { dialAngle } = await import("../../client/src/character-state");
    for (const facing of [1, -1] as const) {
      const cssRotation = -dialAngle(45, facing) * Math.PI / 180;
      expect(Math.cos(cssRotation)).toBeCloseTo(facing * Math.SQRT1_2);
      expect(Math.sin(cssRotation)).toBeCloseTo(-Math.SQRT1_2);
    }
  });
});

describe('registro da alma', () => {
  it('mantém o rosto no registro de GameCharacter e o corpo no mesmo referencial, nos dois lados', async () => {
    const { SOUL_BODY_ORIGIN } = await import('../../client/src/chars');
    // Flash: _body=(-62,-83), face reduzida em 0,75 e transladada (7,5);
    // ghostMovie=(-26,-50), ambos dentro do mesmo GameCharacter espelhado.
    expect(SOUL_BODY_ORIGIN).toEqual({ x: -62, y: -83 });
    for (const facing of [1, -1] as const) {
      const face = { x: facing * (SOUL_BODY_ORIGIN.x + 7), y: SOUL_BODY_ORIGIN.y + 5 };
      const ghost = { x: facing * -26, y: -50 };
      expect(face.y - ghost.y).toBe(-28);
      expect(face.x - ghost.x).toBe(-29 * facing);
    }
  });
});
