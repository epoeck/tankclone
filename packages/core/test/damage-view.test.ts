import { afterEach, expect, it, vi } from "vitest";
import type { MatchEvent } from "../src/index";
const calls = vi.hoisted(() => ({ popup: vi.fn() }));
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, stopSfx: () => {}, preloadLocalSfx: () => {}, projectileSfx: () => {} }));
vi.mock("../../client/src/projectile-effects", () => ({ drawProjectile: () => true, drawImpact: () => true, drawTrail: () => true, impactDuration: () => 1, TRAIL_MAX_LIFE: .5 }));
vi.mock("../../client/src/damage-popup", () => ({ drawDamagePopup: calls.popup, damagePopupDuration: (crit: boolean) => crit ? 1.12 : 1.32 }));
vi.mock("../../client/src/chars", () => ({ drawCharacter: () => {} }));
vi.mock("../../client/src/death", () => ({ drawDeath: () => {} }));
import { MatchView } from "../../client/src/view";
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup() {
  const ctx = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), createLinearGradient: () => ({ addColorStop: () => {} }) }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => {} });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx }) });
  vi.stubGlobal("Image", class { onload = null; src = ""; });
  calls.popup.mockClear();
  const view = new MatchView("colinas", [{ id: "a", team: 1, x: 200, weaponId: "sledge", build: "media", facing: 1 }]);
  return { view, ctx: ctx as unknown as CanvasRenderingContext2D };
}
const damage = (amount: number, crit: boolean, at: number): MatchEvent => ({ type: "damage", playerId: "a", amount, crit, hp: 1, at });
it("vários danos preservam valor e crítico, separam instâncias e sobrevivem à morte", () => {
  const { view, ctx } = setup(), c = view.chars.get("a")!, y = c.y;
  view.push([damage(0, false, 0), damage(123, false, 0), damage(456, true, 0), { type: "death", playerId: "a", reason: "hp", at: 0 }]);
  view.update(.2); view.draw(ctx, null);
  expect(c.alive).toBe(false); expect(calls.popup).toHaveBeenCalledTimes(2);
  expect(calls.popup.mock.calls[0]!.slice(1)).toEqual([123, false, 200, y, .2, 0]);
  expect(calls.popup.mock.calls[1]!.slice(1)).toEqual([456, true, 200, y, .2, 1]);
  view.update(1); calls.popup.mockClear(); view.draw(ctx, null);
  expect(calls.popup).toHaveBeenCalledTimes(1); expect(calls.popup.mock.calls[0]![1]).toBe(123);
  view.update(.13); calls.popup.mockClear(); view.draw(ctx, null); expect(calls.popup).not.toHaveBeenCalled();
});
it("eventos atrasados envelhecem em relação ao impacto e expiram com dt grande", () => {
  const { view, ctx } = setup();
  view.push([damage(11, false, .25), damage(22, true, .75)]); view.update(1); view.draw(ctx, null);
  expect(calls.popup.mock.calls.map(call => [call[1], call[5]])).toEqual([[11, .75], [22, .25]]);
  view.update(2); calls.popup.mockClear(); view.draw(ctx, null); expect(calls.popup).not.toHaveBeenCalled();
});
it("acerto próprio fica na posição do impacto mesmo se a vítima se deslocar", () => {
  const { view, ctx } = setup(), y = view.chars.get("a")!.y;
  view.push([damage(47, false, 0), { type: "fly", playerId: "a", x: 400, y: 350, at: .2 }]); view.update(.3); view.draw(ctx, null);
  expect(view.chars.get("a")!.x).toBe(400);
  expect(calls.popup.mock.calls[0]!.slice(1, 5)).toEqual([47, false, 200, y]);
});
