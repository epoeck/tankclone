import { expect, it } from "vitest";
import { Match, Terrain } from "../src/index";
const create = () => new Match({ seed: 12, terrain: Terrain.fromHeightFn(1200, 600, () => 450), players: [
  { id: "a", team: 1, x: 200, weaponId: "prism", hp: 10000 }, { id: "b", team: 2, x: 1000, weaponId: "sledge", hp: 10000 },
] });
function passUntil(m: Match, id: string) { for (let i=0; i<20 && m.currentId !== id; i++) m.submit({ type: "pass", playerId: m.currentId }); expect(m.currentId).toBe(id); }
it("F bloqueia o próximo turno próprio e libera no seguinte, inclusive após passar", () => {
  const m = create(), id = m.currentId;
  expect(m.submit({ type: "item", playerId: id, key: "F" }).ok).toBe(true);
  m.submit({ type: "pass", playerId: id }); passUntil(m, id);
  expect(m.submit({ type: "item", playerId: id, key: "F" })).toEqual({ ok: false, error: "voar em recarga neste turno" });
  m.submit({ type: "pass", playerId: id }); passUntil(m, id);
  expect(m.submit({ type: "item", playerId: id, key: "F" }).ok).toBe(true);
});
it("F aceita 0 a 90 graus independentemente da faixa da arma", () => {
  const run = (angle: number) => { const m = create(); m.submit({ type: "item", playerId: "a", key: "F" }); const result = m.submit({ type: "shoot", playerId: "a", angleDeg: angle, power: 30 }); if (!result.ok) throw Error(result.error); const s = result.events.find(e => e.type === "shot"); if (!s || s.type !== "shot") throw Error("sem tiro"); return s.points; };
  expect(run(-20)).toEqual(run(0)); expect(run(110)).toEqual(run(90)); expect(run(0)).not.toEqual(run(55));
});
