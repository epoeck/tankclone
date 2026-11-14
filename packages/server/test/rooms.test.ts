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

it("mantém a partida encerrada disponível até terminar a animação", () => {
  const room = new Room("fim", "colinas", 2, "a"); room.add("a", 1); room.add("b", 2); room.start("a", 1000);
  const id = room.match!.currentId, victim = id === "a" ? "b" : "a";
  room.match!.getChar(victim)!.hp = 1;
  // O teste força um fim após um tiro já agendado, sem depender da pontaria do mapa.
  const result = room.intent(id, { type: "shoot", angleDeg: 45, power: 40 }, 1000);
  if ("error" in result) throw new Error(result.error);
  Object.defineProperty(room.match!, "over", { value: true });
  expect(room.readyToFinish(room.pausedUntil - 1)).toBe(false);
  expect(room.readyToFinish(room.pausedUntil)).toBe(true);
  expect(room.status).toBe("playing"); expect(room.log).toContainEqual(result.events[0]);
});

it("rajada (+2): os tiros extras entram 1 s depois, com o anterior ainda no ar, e cada um usa o seu ângulo", () => {
  const room = new Room("rajada", "colinas", 2, "a");
  room.add("a", 1); room.add("b", 2);
  room.start("a", 1000);
  const id = room.match!.currentId;
  room.intent(id, { type: "item", key: "1" }, 1000);
  const first = room.intent(id, { type: "shoot", angleDeg: 45, power: 40 }, 1000);
  if ("error" in first) throw new Error(first.error);
  // fora da rajada continua valendo a pausa da animação
  expect(room.intent(id, { type: "pass" }, 2000)).toEqual({ error: "aguarde a animação" });
  const ats: number[] = [first.events.find(e => e.type === "shot")!.at!];
  for (const [t, ang] of [[2000, 50], [3000, 55]] as const) {
    const r = room.intent(id, { type: "shoot", angleDeg: ang, power: 40 }, t);
    if ("error" in r) throw new Error(r.error);
    ats.push(r.events.find(e => e.type === "shot")!.at!);
  }
  expect(ats.map(a => a - ats[0]!)).toEqual([0, 1, 2]);
  // acabou a rajada: o turno passou; um tiro a mais é recusado
  expect("error" in room.intent(id, { type: "shoot", angleDeg: 45, power: 40 }, 4000)).toBe(true);
});
