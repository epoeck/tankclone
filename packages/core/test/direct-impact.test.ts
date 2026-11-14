import { expect, it } from "vitest";
import { Match, MatchPlayback, Terrain, craterShape } from "../src/index";

it("impacto direto causa dano e escava no mesmo ponto, reconstruindo o terreno", () => {
  const terrain = Terrain.fromHeightFn(600, 500, () => 350), before = terrain.clone();
  const m = new Match({ seed: 12, terrain, players: [
    { id: "a", team: 1, x: 100, weaponId: "sledge", hp: 10000 },
    { id: "b", team: 2, x: 300, weaponId: "sledge", hp: 10000 },
  ] });
  const result = m.submit({ type: "shoot", playerId: "a", angleDeg: 20, power: 21 });
  if (!result.ok) throw new Error(result.error);
  const shot = result.events.find(e => e.type === "shot");
  const crater = result.events.find(e => e.type === "crater");
  expect(shot).toMatchObject({ type: "shot", hitKind: "player", targetId: "b" });
  if (!shot || shot.type !== "shot" || !shot.hit || !crater || crater.type !== "crater") throw new Error("sem impacto direto");
  expect(crater).toMatchObject({ x: shot.hit.x, y: shot.hit.y, ballId: 381 });
  expect(result.events.some(e => e.type === "damage" && e.playerId === "b" && e.amount > 0)).toBe(true);
  expect(terrain.getMask().some((p, i) => p === 0 && before.getMask()[i] === 1)).toBe(true);
  const replay = new MatchPlayback(); replay.push(result.events);
  replay.update(60, e => { if (e.type === "crater") before.carveShape(e.x, e.y, craterShape(e.ballId)); });
  expect(before.getMask()).toEqual(terrain.getMask());
});

it("tiro que sai pela lateral termina sem cratera e andar respeita a borda", () => {
  const m = new Match({ seed: 12, terrain: Terrain.fromHeightFn(600, 500, () => 350), players: [
    { id: "a", team: 1, x: 100, weaponId: "sledge", hp: 10000 },
    { id: "b", team: 2, x: 300, weaponId: "sledge", hp: 10000 },
  ] });
  const shot = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 100 });
  if (!shot.ok) throw new Error(shot.error);
  expect(shot.events.find(e => e.type === "shot")).toMatchObject({ hit: null, hitKind: null });
  expect(shot.events.some(e => e.type === "crater")).toBe(false);
  m.getChar("b")!.energy = 10000;
  const move = m.submit({ type: "move", playerId: "b", dir: 1, px: 10000 });
  if (!move.ok) throw new Error(move.error);
  expect(m.getChar("b")!.x).toBe(598);
});

it("morte no primeiro impacto encerra a partida depois do último voo, sem tiros restantes", () => {
  const m = new Match({ seed: 12, terrain: Terrain.fromHeightFn(600, 500, () => 350), players: [
    { id: "a", team: 1, x: 100, weaponId: "sledge", hp: 10000, agi: 3300 },
    { id: "b", team: 2, x: 300, weaponId: "sledge", hp: 1 },
  ] });
  const item = m.submit({ type: "item", playerId: "a", key: "1" }); if (!item.ok) throw Error(item.error);
  const result = m.submit({ type: "shoot", playerId: "a", angleDeg: 20, power: 21 }); if (!result.ok) throw Error(result.error);
  const shots = result.events.filter(e => e.type === "shot"), death = result.events.find(e => e.type === "death"), end = result.events.find(e => e.type === "gameOver");
  expect(shots).toHaveLength(1);
  expect(death).toBeDefined(); expect(end).toBeDefined();
  expect(end!.at).toBeGreaterThanOrEqual(Math.max(...shots.map(s => s.at! + s.duration)));
  expect(end!.at).toBeGreaterThanOrEqual(death!.at!);
  expect(m.submit({ type: "shoot", playerId: "a", angleDeg: 20, power: 21 }).ok).toBe(false);
});
