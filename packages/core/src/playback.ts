import type { MatchEvent } from "./match";

/** Interpola a trajetória pelo tempo da simulação, independente da taxa de quadros. */
export function sampleTrajectory(
  points: readonly { x: number; y: number }[], elapsed: number, stepSeconds: number, duration: number,
): { x: number; y: number } {
  if (!points.length) throw new Error("trajetória vazia");
  if (elapsed >= duration || points.length === 1) return points[points.length - 1]!;
  const i = Math.min(points.length - 2, Math.floor(Math.max(0, elapsed) / stepSeconds));
  const a = points[i]!, b = points[i + 1]!;
  const end = Math.min((i + 1) * stepSeconds, duration);
  const t = Math.min(1, Math.max(0, (elapsed - i * stepSeconds) / (end - i * stepSeconds)));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

type Flight = { shot: Extract<MatchEvent, { type: "shot" }>; start: number; end: number };

/** Relógio da apresentação: permite voos simultâneos e impactos em seus próprios instantes.
 * Os tempos são absolutos na linha de animação da partida, inclusive no log de reconexão.
 * O relógio para quando fica ocioso; o tempo de pensar do jogador é contado pelo Match.
 */
export class MatchPlayback {
  private queue: Array<{ event: MatchEvent; at: number }> = [];
  private flights: Flight[] = [];
  private clock = 0;
  private tail = 0;

  get busy(): boolean { return this.queue.length > 0 || this.flights.length > 0; }
  get positions(): Array<{ x: number; y: number }> {
    return this.flights.map(({ shot, start }) => sampleTrajectory(shot.points, this.clock - start, shot.stepSeconds, shot.duration));
  }

  push(events: readonly MatchEvent[]): void {
    for (const event of events) {
      this.tail = Math.max(this.tail, event.at ?? this.tail);
      this.queue.push({ event, at: this.tail });
    }
  }

  /** Devolve a fração do frame que sobrou depois das animações, para o contador do turno. */
  update(dt: number, apply: (event: MatchEvent) => void): number {
    let remaining = Math.max(0, dt);
    while (true) {
      this.flights = this.flights.filter(f => f.end > this.clock);
      while (this.queue.length && this.queue[0]!.at <= this.clock) {
        const { event, at } = this.queue.shift()!;
        if (event.type === "shot" && event.duration > 0) this.flights.push({ shot: event, start: at, end: at + event.duration });
        apply(event);
      }
      if (!this.busy || remaining === 0) return this.busy ? 0 : remaining;
      const next = Math.min(this.queue[0]?.at ?? Infinity, ...this.flights.map(f => f.end));
      const advance = Math.min(remaining, Math.max(0, next - this.clock));
      this.clock += advance;
      remaining = Math.max(0, remaining - advance);
    }
  }
}

/** Duração da animação recebida em uma resposta; leques compartilham o mesmo início. */
export function playbackDuration(events: readonly MatchEvent[]): number {
  let first = Infinity, last = -Infinity, fallback = 0;
  for (const event of events) {
    const at = event.at ?? fallback;
    first = Math.min(first, at);
    last = Math.max(last, at + (event.type === "shot" ? event.duration : 0));
    fallback = at;
  }
  return Number.isFinite(first) ? Math.max(0, last - first) : 0;
}
