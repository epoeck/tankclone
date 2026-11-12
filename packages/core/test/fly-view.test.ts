import { expect, it, vi } from "vitest";
import { Match, Terrain, type MatchEvent } from "../src/index";
const calls = vi.hoisted(() => ({ sound: vi.fn(), projectile: vi.fn(() => true), impact: vi.fn(() => true) }));
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, projectileSfx: calls.sound, toggleMute: () => false }));
vi.mock("../../client/src/projectile-effects", () => ({ drawProjectile: calls.projectile, drawImpact: calls.impact, drawTrail: () => false, impactDuration: () => 2, TRAIL_MAX_LIFE: 0.5 }));
vi.mock("../../client/src/chars", () => ({ drawCharacter: () => {} }));
vi.mock("../../client/src/death", () => ({ drawDeath: () => {} }));
import { MatchView } from "../../client/src/view";

it.each([false, true])("item F reproduz avião e sons no MatchView (log legado: %s)", legacy => {
  calls.sound.mockClear(); calls.projectile.mockClear(); calls.impact.mockClear();
  const context = new Proxy({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), createLinearGradient: () => ({ addColorStop: () => {} }) }, { get: (target, key) => key in target ? target[key as keyof typeof target] : () => {} });
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  vi.stubGlobal("Image", class { onload = null; src = ""; });
  const players = [{ id: "a", team: 1, x: 200, weaponId: "sledge", build: "media", facing: 1 as const }, { id: "b", team: 2, x: 900, weaponId: "sledge", build: "media", facing: -1 as const }];
  const match = new Match({ seed: 12, terrain: Terrain.fromHeightFn(1800, 600, () => 450), players });
  const view = new MatchView("planalto", players);
  view.push(match.startEvents);
  const item = match.submit({ type: "item", playerId: "a", key: "F" }); if (!item.ok) throw new Error(item.error);
  view.push(item.events);
  const shot = match.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 }); if (!shot.ok) throw new Error(shot.error);
  const wire = JSON.parse(JSON.stringify(shot.events)) as MatchEvent[];
  if (legacy) for (const event of wire) if (event.type === "shot") event.ballId = 381;
  view.push(wire); view.update(0.01);
  view.draw(context as unknown as CanvasRenderingContext2D, null);
  expect(calls.sound).toHaveBeenCalledWith("fly", false, false);
  const original = wire.find(event => event.type === "shot");
  expect(original && original.type === "shot" ? original.ballId : null).toBe(legacy ? 381 : 3);
  expect(calls.projectile).toHaveBeenCalledWith(expect.anything(), "fly", false, expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
  const flight = wire.find(event => event.type === "shot"); if (!flight || flight.type !== "shot") throw new Error("sem voo");
  view.update(flight.duration - 0.01); view.draw(context as unknown as CanvasRenderingContext2D, null);
  expect(calls.sound).toHaveBeenCalledWith("fly", false, true);
  expect(calls.impact).toHaveBeenCalledWith(expect.anything(), "fly", false, expect.any(Number), expect.any(Number), expect.any(Number));
  vi.unstubAllGlobals();
});

it("reconexão reproduz a recarga de F a partir dos eventos de turno", () => {
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData: () => {} };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) });
  vi.stubGlobal("Image", class { onload = null; src = ""; });
  const players = [{ id: "a", team: 1, x: 200, weaponId: "sledge", build: "media", facing: 1 as const }, { id: "b", team: 2, x: 900, weaponId: "sledge", build: "media", facing: -1 as const }];
  const match = new Match({ seed: 12, terrain: Terrain.fromHeightFn(1800, 600, () => 450), players });
  const log = [...match.startEvents], item = match.submit({ type: "item", playerId: "a", key: "F" });
  if (!item.ok) throw Error(item.error); log.push(...item.events);
  do { const result = match.submit({ type: "pass", playerId: match.currentId }); if (!result.ok) throw Error(result.error); log.push(...result.events); } while (match.currentId !== "a");
  const view = new MatchView("planalto", players); view.push(JSON.parse(JSON.stringify(log)) as MatchEvent[]); view.update(0);
  expect(view.hud.player).toBe("a"); expect(view.ui.flyCooldown).toBe(true); expect(view.ui.fly).toBe(false);
  vi.unstubAllGlobals();
});

it("replay do leque sobreposto termina com o estado autoritativo dos personagens", () => {
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData: () => {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }) };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) }); vi.stubGlobal("Image", class { onload = null; src = ""; });
  const players = [{ id: "a", team: 1, x: 200, weaponId: "sledge", build: "media", facing: 1 as const }, { id: "b", team: 2, x: 900, weaponId: "sledge", build: "media", facing: -1 as const }];
  const view = new MatchView("colinas", players);
  const match = new Match({ seed: 12, terrain: view.terrain.clone(), players: players.map(p => ({ ...p, hp: 10000, agi: 3300 })) });
  view.push(match.startEvents);
  for (const key of ["1", "2"] as const) { const result = match.submit({ type: "item", playerId: "a", key }); if (!result.ok) throw Error(result.error); view.push(result.events); }
  const result = match.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 }); if (!result.ok) throw Error(result.error); view.push(result.events); view.update(60);
  for (const p of players) { const expected = match.getChar(p.id)!; expect(view.chars.get(p.id)).toMatchObject({ x: expected.x, y: expected.y, hp: expected.hp, fury: expected.fury, energy: expected.energy, alive: expected.alive }); }
  vi.unstubAllGlobals();
});

it("mira do avião mantém faixa absoluta 0–90 durante movimento em rampa", () => {
  const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w*h*4) }), putImageData: () => {} };
  vi.stubGlobal("document", { createElement: () => ({ getContext: () => context }) }); vi.stubGlobal("Image", class { onload = null; src = ""; });
  const players = [{ id: "a", team: 1, x: 200, weaponId: "prism", build: "media", facing: 1 as const }];
  const view = new MatchView("colinas", players); vi.spyOn(view.terrain, "slopeDeg").mockReturnValue(20);
  view.push([{ type: "turnStart", playerId: "a", wind: 0, turn: 1, timeLimit: 10, energy: 240, delays: {} }, { type: "item", playerId: "a", key: "F", energyLeft: 100 }]); view.update(0);
  expect(view.aimRange).toEqual({ min: 0, max: 90 }); view.ui.angle = 0;
  view.push([{ type: "move", playerId: "a", path: [{ x: 220, y: 400 }], facing: 1, energyLeft: 90 }]); view.update(0);
  expect(view.ui.angle).toBe(0); view.ui.angle = 100; view.update(0); expect(view.ui.angle).toBe(90);
  vi.unstubAllGlobals();
});
