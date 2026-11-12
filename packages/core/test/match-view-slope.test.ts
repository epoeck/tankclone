import { expect, it, vi } from "vitest";
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, projectileSfx: () => {}, toggleMute: () => false }));
import { MatchView } from "../../client/src/view";

it("mantém a mira relativa ao andar e virar, inclusive durante playback", () => {
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => {} };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  vi.stubGlobal("Image", class { onload: (() => void) | null = null; src = ""; });
  const view = new MatchView("colinas", [{ id: "a", team: 1, x: 200, facing: 1, build: "media", weaponId: "sledge" }]);
  vi.spyOn(view.terrain, "slopeDeg").mockImplementation((x, _y, facing) => (x < 210 ? 5 : 15) * facing);
  view.push([{ type: "turnStart", playerId: "a", wind: 0, turn: 1, timeLimit: 10, energy: 240, delays: {} }]);
  view.update(0); view.ui.angle = 45;
  view.push([{ type: "move", playerId: "a", facing: 1, energyLeft: 230, path: [{ x: 220, y: 400 }] }]);
  view.update(0); expect(view.ui.angle).toBe(55);
  view.push([{ type: "move", playerId: "a", facing: -1, energyLeft: 230, path: [] }]);
  view.update(0); expect(view.ui.angle).toBe(25);
  vi.unstubAllGlobals();
});
