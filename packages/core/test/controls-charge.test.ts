import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../client/src/sound", () => ({ sfx: vi.fn(), stopSfx: vi.fn(), toggleMute: () => false }));
import { Controls } from "../../client/src/controls";
import type { MatchView } from "../../client/src/view";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function setup() {
  const handlers = new Map<string, (e: KeyboardEvent) => void>();
  vi.stubGlobal("addEventListener", (type: string, fn: (e: KeyboardEvent) => void) => handlers.set(type, fn));
  const view = { hud: { over: false }, current: { id: "a", weaponId: "sledge", fury: 200, facing: 1 }, canAct: true,
    aimRange: { min: 20, max: 65 }, ui: { power: 0, angle: 45, special: false, fired: false, fly: false, extraShots: 0, msg: "" }, expectShot: vi.fn() };
  const sent: Record<string, unknown>[] = [];
  const controls = new Controls(view as unknown as MatchView, () => true, event => sent.push(event));
  const key = (type: "keydown" | "keyup", code: string, key = code) => handlers.get(type)!({ code, key, repeat: false, preventDefault() {}, target: null } as KeyboardEvent);
  return { view, controls, sent, key };
}
it("permite tocar e segurar ↑↓ enquanto carrega e dispara com a força e ângulo atuais", () => {
  const { view, controls, sent, key } = setup();
  key("keydown", "Space", " "); controls.update(1); expect(view.ui.power).toBe(25);
  key("keydown", "ArrowUp"); expect(view.ui.angle).toBe(46);
  controls.update(0.1); expect(view.ui.angle).toBe(47); expect(view.ui.power).toBeCloseTo(27.5);
  key("keyup", "ArrowUp"); key("keydown", "ArrowDown"); expect(view.ui.angle).toBe(46);
  key("keyup", "Space", " "); expect(sent.at(-1)).toMatchObject({ type: "shoot", angleDeg: 46, power: 27.5 });
  expect(view.expectShot).toHaveBeenCalledWith(46, 27.5);
});
it("rajada automática usa ângulo atualizado e preserva a força", () => {
  const { view, controls, sent, key } = setup(); vi.spyOn(performance, "now").mockReturnValue(1000);
  view.ui.extraShots = 1; key("keydown", "Space", " "); controls.update(1); key("keyup", "Space", " ");
  key("keydown", "ArrowUp"); vi.spyOn(performance, "now").mockReturnValue(2000); controls.update(0);
  expect(sent.filter(e => e.type === "shoot")).toEqual([{ type: "shoot", angleDeg: 45, power: 25, special: false }, { type: "shoot", angleDeg: 46, power: 25, special: false }]);
});
