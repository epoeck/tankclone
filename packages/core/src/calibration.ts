/**
 * Calibração da física contra medições do jogo original.
 * Cada amostra = um tiro medido no original em chão plano: ângulo, força e
 * distância horizontal percorrida (px) até o impacto.
 */
import { DEFAULT_PHYSICS, simulateShot, type Facing, type PhysicsConfig } from "./physics";

export interface ShotSample {
  label?: string;
  angleDeg: number;
  power: number;
  /** Distância horizontal medida no original (px), em módulo. */
  dx: number;
  /** Altura do cano acima do chão de pouso (px). Se omitido, usa `muzzleHeight` do ajuste. */
  dy?: number;
  /** Vento no momento da medição. Padrão 0. */
  wind?: number;
}

export interface SampleResult {
  sample: ShotSample;
  predicted: number | null;
  errorPx: number | null;
  errorPct: number | null;
}

/** Distância horizontal prevista pelo nosso modelo para uma amostra. */
export function predictDx(s: ShotSample, cfg: PhysicsConfig, muzzleHeight = 0): number | null {
  const y0 = 1000, x0 = 0;
  const groundY = y0 + (s.dy ?? muzzleHeight);
  const facing: Facing = 1;
  const r = simulateShot(
    { x: x0, y: y0, angleDeg: s.angleDeg, power: s.power, facing, wind: s.wind ?? 0 },
    (x, y) => y >= groundY && x > x0 + 1,
    { ...cfg, maxSteps: 60 * 60 },
  );
  return r.hit ? r.hit.x - x0 : null;
}

export function evaluate(samples: ShotSample[], cfg: PhysicsConfig, muzzleHeight = 0): SampleResult[] {
  return samples.map(sample => {
    const predicted = predictDx(sample, cfg, muzzleHeight);
    const errorPx = predicted === null ? null : predicted - sample.dx;
    return { sample, predicted, errorPx, errorPct: errorPx === null ? null : (errorPx / sample.dx) * 100 };
  });
}

/** Erro quadrático relativo total (amostras sem impacto contam como erro enorme). */
export function loss(samples: ShotSample[], cfg: PhysicsConfig, muzzleHeight = 0): number {
  return evaluate(samples, cfg, muzzleHeight).reduce((a, r) => a + (r.errorPct === null ? 1e6 : (r.errorPct / 100) ** 2), 0);
}

/** Converte tabelas "ângulo → força necessária por distância 1..N" em amostras. */
export function samplesFromTables(tables: Record<string, number[]>, unitPx: number): ShotSample[] {
  const out: ShotSample[] = [];
  for (const [angle, powers] of Object.entries(tables)) {
    powers.forEach((power, i) => out.push({ label: `${angle}° d${i + 1}`, angleDeg: +angle, power, dx: (i + 1) * unitPx }));
  }
  return out;
}

export interface FitResult { cfg: PhysicsConfig; muzzleHeight: number; loss: number }

/**
 * Ajusta speedPerPower, gravity, drag e muzzleHeight por Nelder-Mead, minimizando o erro relativo quadrático do alcance.
 */
export function fitPhysics(
  samples: ShotSample[],
  base: PhysicsConfig = DEFAULT_PHYSICS,
  start = { speedPerPower: 15, gravity: 600, drag: 0.1, muzzleHeight: 30 },
): FitResult {
  const unpack = (x: number[]) => ({
    cfg: { ...base, speedPerPower: Math.abs(x[0]!), gravity: Math.abs(x[1]!), drag: Math.abs(x[2]!) },
    h: x[3]!,
  });
  const f = (x: number[]) => { const u = unpack(x); return loss(samples, u.cfg, u.h); };
  let best: { x: number[]; f: number } | null = null;
  for (const scale of [1, 0.6, 1.6]) {
    const r = nelderMead(f, [start.speedPerPower * scale, start.gravity * scale, start.drag * scale, start.muzzleHeight * scale]);
    if (!best || r.f < best.f) best = r;
  }
  const u = unpack(best!.x);
  return { cfg: u.cfg, muzzleHeight: u.h, loss: best!.f };
}

function nelderMead(f: (x: number[]) => number, x0: number[], iters = 1500): { x: number[]; f: number } {
  const n = x0.length;
  type P = { x: number[]; f: number };
  const mk = (x: number[]): P => ({ x, f: f(x) });
  let S: P[] = [mk(x0), ...x0.map((_, i) => mk(x0.map((v, j) => (j === i ? v * 1.15 + 0.01 : v))))];
  for (let it = 0; it < iters; it++) {
    S.sort((a, b) => a.f - b.f);
    const c = x0.map((_, j) => S.slice(0, n).reduce((s, p) => s + p.x[j]!, 0) / n);
    const w = S[n]!;
    const along = (t: number) => c.map((v, j) => v + t * (v - w.x[j]!));
    const r = mk(along(1));
    if (r.f < S[0]!.f) { const e = mk(along(2)); S[n] = e.f < r.f ? e : r; }
    else if (r.f < S[n - 1]!.f) S[n] = r;
    else {
      const k = mk(along(r.f < w.f ? 0.5 : -0.5));
      if (k.f < Math.min(r.f, w.f)) S[n] = k;
      else S = S.map((p, i) => (i === 0 ? p : mk(p.x.map((v, j) => S[0]!.x[j]! + 0.5 * (v - S[0]!.x[j]!)))));
    }
  }
  S.sort((a, b) => a.f - b.f);
  return S[0]!;
}

/**
 * Diagnóstico: com força linear e sem arrasto o alcance escala com força². Se a razão
 * medida full/meia-força for bem diferente, o modelo precisa de outro termo (ex.: arrasto).
 */
export function powerScalingCheck(samples: ShotSample[]): Array<{ angleDeg: number; ratio: number; expected: number }> {
  const out: Array<{ angleDeg: number; ratio: number; expected: number }> = [];
  const byAngle = new Map<number, ShotSample[]>();
  for (const s of samples) if (!s.wind && !s.dy) byAngle.set(s.angleDeg, [...(byAngle.get(s.angleDeg) ?? []), s]);
  for (const [angleDeg, list] of byAngle) {
    if (list.length < 2) continue;
    const lo = list.reduce((m, s) => (s.power < m.power ? s : m));
    const hi = list.reduce((m, s) => (s.power > m.power ? s : m));
    if (lo.power === hi.power) continue;
    out.push({ angleDeg, ratio: hi.dx / lo.dx, expected: (hi.power / lo.power) ** 2 });
  }
  return out;
}

/** Força necessária (0..150) para o modelo atingir `dx` px a este ângulo, por bisseção. */
export function requiredPower(angleDeg: number, dx: number, cfg: PhysicsConfig, muzzleHeight = 0): number | null {
  let lo = 0, hi = 150;
  const at = (p: number) => predictDx({ angleDeg, power: p, dx }, cfg, muzzleHeight);
  const top = at(hi);
  if (top === null || top < dx) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2, d = at(mid);
    if (d !== null && d < dx) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
