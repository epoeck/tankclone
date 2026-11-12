import { it, expect } from "vitest";
import { Room } from "../src/rooms";

it("pausa a sala pelo tempo de voo transmitido, sem presumir 60 passos por segundo", () => {
  const room = new Room("tempo", "colinas", 2, "a");
  expect(room.add("a", 1)).toBeNull();
  expect(room.add("b", 2)).toBeNull();
  const start = room.start("a", 1000);
  if ("error" in start) throw new Error(start.error);
  const result = room.intent(room.match!.currentId, { type: "shoot", angleDeg: 45, power: 40 }, 1000);
  if ("error" in result) throw new Error(result.error);
  const shots = result.events.filter(e => e.type === "shot");
  expect(shots).toHaveLength(1);
  expect(shots[0]!.stepSeconds).toBe(0.04);
  expect(room.pausedUntil).toBe(1000 + shots[0]!.duration * 1000);
  const early = room.intent(room.match!.currentId, { type: "pass" }, room.pausedUntil - 1);
  expect(early).toEqual({ error: "aguarde a animação" });
});

it("pausa pelo último impacto do triplo, sem somar as três durações", () => {
  const room = new Room("leque", "colinas", 2, "a");
  room.add("a", 1); room.add("b", 2);
  room.start("a", 1000);
  const id = room.match!.currentId;
  room.intent(id, { type: "item", key: "2" }, 1000);
  const result = room.intent(id, { type: "shoot", angleDeg: 45, power: 40 }, 1000);
  if ("error" in result) throw new Error(result.error);
  const shots = result.events.filter(e => e.type === "shot");
  expect(shots).toHaveLength(3);
  expect(room.pausedUntil).toBe(1000 + Math.max(...shots.map(s => s.duration)) * 1000);
});
