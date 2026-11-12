import { describe, it, expect } from "vitest";
import { Match, MatchPlayback, SHOT_INTERVAL_SECONDS, Terrain, craterShape, playbackDuration, type MatchEvent } from "../src/index";

const flight = (index: number, at: number, duration: number): MatchEvent => ({
  type: "shot", playerId: "a", index, at, duration, stepSeconds: 1,
  points: Array.from({ length: duration + 1 }, (_, x) => ({ x, y: index })),
  hit: null, hitKind: null, targetId: null, damageMult: 1,
});

describe("linha de animação", () => {
  it("leque sai junto e cada impacto acontece no próprio instante", () => {
    const playback = new MatchPlayback(), seen: MatchEvent[] = [];
    playback.push([flight(0, 0, 2), flight(1, 0, 1), flight(2, 0, 3),
      { type: "damage", playerId: "b", amount: 10, hp: 90, crit: false, at: 1 },
      { type: "damage", playerId: "b", amount: 20, hp: 70, crit: false, at: 2 },
      { type: "damage", playerId: "b", amount: 30, hp: 40, crit: false, at: 3 }]);
    playback.update(0, e => seen.push(e));
    expect(playback.positions).toHaveLength(3);
    expect(seen.map(e => e.type)).toEqual(["shot", "shot", "shot"]);
    playback.update(1, e => seen.push(e));
    expect(playback.positions).toHaveLength(2);
    expect(seen.at(-1)).toMatchObject({ type: "damage", hp: 90 });
    playback.update(1, e => seen.push(e));
    expect(playback.positions).toHaveLength(1);
    expect(seen.at(-1)).toMatchObject({ type: "damage", hp: 70 });
    expect(playback.update(1.5, e => seen.push(e))).toBe(0.5);
    expect(playback.busy).toBe(false);
    expect(seen.at(-1)).toMatchObject({ type: "damage", hp: 40 });
  });
  it("informa o tempo restante do quadro para envelhecer efeitos no instante correto", () => {
    const p = new MatchPlayback(), ages: number[] = [];
    p.push([{ type: "damage", playerId: "a", amount: 10, hp: 90, crit: false, at: 0.25 },
      { type: "damage", playerId: "a", amount: 20, hp: 70, crit: true, at: 0.75 }]);
    p.update(1, (_event, remaining) => ages.push(remaining));
    expect(ages).toEqual([0.75, 0.25]);
  });
  it("notifica impacto imediato de duração zero", () => {
    const p = new MatchPlayback(), ended: number[] = [];
    p.push([flight(0, 0, 0)]);
    p.update(0, () => {}, shot => ended.push(shot.index));
    expect(ended).toEqual([0]);
  });
  it("leva o tempo que sobra no frame para o próximo disparo", () => {
    const p = new MatchPlayback();
    p.push([flight(0, 0, 1), flight(1, 1, 2)]);
    p.update(1.5, () => {});
    expect(p.positions[0]).toMatchObject({ x: 0.5, y: 1, playerId: "a", elapsed: 0.5, angle: 0 });
    expect(p.update(3, () => {})).toBe(1.5);
  });
  it("30, 60 e 144 FPS preservam a posição e a ordem dos eventos", () => {
    const run = (fps: number) => {
      const p = new MatchPlayback(), events: string[] = [];
      p.push([flight(0, 0, 2), flight(1, 0, 1), flight(2, 2, 1)]);
      for (let i = 0; i < 1.5 * fps; i++) p.update(1 / fps, e => events.push(`${e.type}:${e.at}`));
      return { events, positions: p.positions };
    };
    for (const fps of [30, 60, 144]) {
      const result = run(fps);
      expect(result.events).toEqual(["shot:0", "shot:0"]);
      expect(result.positions).toHaveLength(1);
      expect(result.positions[0]!.x).toBeCloseTo(1.5, 9);
    }
  });
  it("relógio fica parado durante o tempo de pensar; log completo e respostas separadas reproduzem igual", () => {
    const together = new MatchPlayback(), split = new MatchPlayback();
    const first = [flight(0, 0, 1)], second = [flight(1, 1, 2)];
    together.push([...first, ...second]);
    together.update(2, () => {});
    split.push(first); split.update(50, () => {});
    split.update(50, () => {}); // sem eventos: não avança a linha de animação
    split.push(second); split.update(1, () => {});
    expect(split.positions).toEqual(together.positions);
  });
});

describe("partida com máscaras e leques", () => {
  const create = () => new Match({ seed: 12, terrain: Terrain.fromHeightFn(1200, 600, () => 450), players: [
    { id: "a", team: 1, x: 200, weaponId: "sledge", hp: 10000 },
    { id: "b", team: 2, x: 1000, weaponId: "sledge", hp: 10000 },
  ] });
  it("combinação 12 inicia leques a cada segundo e espera o último impacto", () => {
    const m = create();
    m.submit({ type: "item", playerId: "a", key: "1" });
    m.submit({ type: "item", playerId: "a", key: "2" });
    const events: MatchEvent[] = [];
    for (let i = 0; i < 3; i++) { const r = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 }); if (!r.ok) throw new Error(r.error); events.push(...r.events); }
    const shots = events.filter(e => e.type === "shot");
    expect(shots).toHaveLength(9);
    // Reborn: os leques saem 1 s um do outro (um tiro por intenção, ângulo livre entre eles), mesmo com o anterior no ar
    let end = 0;
    for (let i = 0; i < 9; i += 3) {
      const group = shots.slice(i, i + 3), start = (i / 3) * SHOT_INTERVAL_SECONDS;
      expect(group.map(s => s.at)).toEqual([start, start, start]);
      end = Math.max(end, ...group.map(s => start + s.duration));
    }
    expect(playbackDuration(events)).toBeCloseTo(end, 9);
    expect(events.at(-1)).toMatchObject({ type: "turnStart", at: end });
    // no cliente, a fila reordena pelo instante: tudo é aplicado em ordem crescente
    const p = new MatchPlayback(), applied: number[] = [];
    p.push(JSON.parse(JSON.stringify(events)) as MatchEvent[]);
    p.update(1e6, e => applied.push(e.at!));
    expect(applied).toEqual([...applied].sort((a, b) => a - b));
  });
  it("reaplicar os eventos no cliente reconstrói exatamente a máscara autoritativa", () => {
    const m = create(), terrain = m.terrain.clone();
    m.submit({ type: "item", playerId: "a", key: "2" });
    const result = m.submit({ type: "shoot", playerId: "a", angleDeg: 45, power: 30 });
    if (!result.ok) throw new Error(result.error);
    const p = new MatchPlayback();
    p.push(JSON.parse(JSON.stringify(result.events)) as MatchEvent[]);
    p.update(60, e => { if (e.type === "crater") terrain.carveShape(e.x, e.y, craterShape(e.ballId)); });
    expect(p.busy).toBe(false);
    expect(terrain.getMask()).toEqual(m.terrain.getMask());
  });
});
