import { afterEach, expect, it, vi } from "vitest";
import { Match, Terrain, type MatchEvent } from "../src/index";
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, stopSfx: () => {}, preloadLocalSfx: () => {}, projectileSfx: () => {} }));
vi.mock("../../client/src/projectile-effects", () => ({ drawProjectile: () => true, drawImpact: () => true, drawTrail: () => true, impactDuration: () => 1, TRAIL_MAX_LIFE: 0.5 }));
import { MatchView } from "../../client/src/view";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup() {
  const ctx = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData: () => {} };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx }) });
  vi.stubGlobal("Image", class { onload = null; src = ""; });
  const players = [{ id: "a", team: 1, x: 200, weaponId: "sledge", build: "media", facing: 1 as const }, { id: "b", team: 2, x: 800, weaponId: "sledge", build: "media", facing: -1 as const }];
  return { view: new MatchView("colinas", players), players };
}
const shot = (playerId: string, aimDeg: number, power: number, facing: 1 | -1): MatchEvent => ({ type: "shot", playerId, index: 0, points: [{ x: 0, y: 0 }], hit: null, hitKind: null, targetId: null, damageMult: 1, stepSeconds: .04, duration: 0, aimDeg, power, aimFacing: facing });
const turn = (playerId: string): MatchEvent => ({ type: "turnStart", playerId, wind: 0, timeLimit: 10, energy: 240, turn: 1, delays: {} });
it("marcadores são isolados por jogador e rede mostra sempre o local", () => {
  const { view } = setup(); view.push([turn("a")]); view.update(0); expect(view.lastShot).toBeNull();
  view.push([shot("a", 30, 0, 1), turn("b"), shot("b", 60, 80, -1)]); view.update(0);
  expect(view.lastShot).toEqual({ angle: 60, power: 80, facing: -1 });
  view.me = "a"; expect(view.lastShot).toEqual({ angle: 30, power: 0, facing: 1 });
  view.push([turn("a"), { type: "move", playerId: "a", path: [{ x: 220, y: 410 }], energyLeft: 200, facing: -1 }]); view.update(0);
  expect(view.lastShot).toEqual({ angle: 30, power: 0, facing: 1 });
});
it("intenção rejeitada não vira histórico; metadados do tiro aceito são reproduzíveis", () => {
  const { view, players } = setup(); view.push([turn("a")]); view.update(0);
  view.expectShot(40, 20); expect(view.lastShot).toBeNull();
  const m = new Match({ seed: 2, terrain: Terrain.fromHeightFn(1200, 600, () => 450), players });
  const out = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 33 }); if (!out.ok) throw Error(out.error);
  const event = out.events.find(e => e.type === "shot")!; expect(event).toMatchObject({ aimDeg: 45, power: 33, aimFacing: 1 });
  view.push([JSON.parse(JSON.stringify(event)) as MatchEvent]); view.update(0);
  expect(view.lastShot).toEqual({ angle: 45, power: 33, facing: 1 });
});

it("pendência rejeitada não contamina tiro legado do próximo turno", () => {
  const { view } = setup(); view.push([turn("a")]); view.update(0); view.expectShot(40, 20);
  view.push([turn("b"), turn("a")]); view.update(0); view.expectShot(60, 70);
  const event = shot("a", 60, 70, 1); if (event.type !== "shot") throw Error("sem tiro");
  delete event.aimDeg; delete event.power; delete event.aimFacing;
  view.push([event]); view.update(0);
  expect(view.lastShot).toEqual({ angle: 60, power: 70, facing: 1 });
});
