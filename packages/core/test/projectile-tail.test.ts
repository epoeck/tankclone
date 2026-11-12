import { expect, it, vi } from "vitest";
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, projectileSfx: () => {}, toggleMute: () => false }));
vi.mock("../../client/src/projectile-effects", () => ({ drawImpact: () => false, drawProjectile: () => false, drawTrail: () => false, impactDuration: () => 2, TRAIL_MAX_LIFE: 0.5 }));
import { MatchView } from "../../client/src/view";

it("mantém apenas a cauda do voo encerrado e a remove após a vida das partículas", () => {
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData: () => {} }) }) });
  vi.stubGlobal("Image", class { onload = null; src = ""; });
  const view = new MatchView("colinas", [{ id: "a", team: 1, x: 200, facing: 1, build: "media", weaponId: "sledge" }]);
  view.push([{ type: "shot", playerId: "a", index: 0, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], hit: { x: 100, y: 0 }, hitKind: "player", targetId: "b", damageMult: 1, ballId: 381, stepSeconds: 1, duration: 1 }]);
  view.update(1.2);
  const state = view as unknown as { tails: Array<{ trail: Array<{ x: number }>; age: number }>; playback: { positions: unknown[] } };
  expect(state.playback.positions).toHaveLength(0);
  expect(state.tails).toHaveLength(1);
  expect(state.tails[0]!.age).toBeCloseTo(0.2);
  expect(state.tails[0]!.trail.at(-1)!.x).toBe(100);
  view.update(0.31); expect(state.tails).toHaveLength(0);
  vi.unstubAllGlobals();
});
