/**
 * Física do projétil — pura e determinística (sem DOM, sem rede, sem Math.random).
 * Cliente e servidor rodam este mesmo código com o mesmo passo fixo.
 *
 * Convenções: unidades em pixels e segundos; eixo Y cresce para BAIXO (como na tela).
 * Ângulo em graus: 0° = direita, 90° = para cima. `facing` espelha para quem mira à esquerda.
 */
import { eulerStep } from "./euler";

export interface PhysicsConfig {
  /** Passo fixo da simulação (s). */
  dt: number;
  /** Massa do projétil (kg do motor original). */
  mass: number;
  /** Gravidade (px/s²), positiva = puxa para baixo. */
  gravity: number;
  /** Velocidade inicial (px/s) por ponto de força (força vai de 0 a 100). */
  speedPerPower: number;
  /** Aceleração horizontal (px/s²) por unidade de vento. */
  windAccel: number;
  /** Arrasto linear do ar (1/s): a = -drag·v. 0 = parábola ideal. */
  drag: number;
  /** Limite de passos por tiro, evita laço infinito. */
  maxSteps: number;
}

/** DDTank41: mapa Weight=10, DragIndex=2; bola Mass=10, Weight=70, Wind=240, DragIndex=1.
 * BombObject + EulerVector: g=10×70, arrasto=2×1/10, vento=240/10.
 * Barra 0–100 corresponde à força 0–2000. Ver docs/ddtank41.md.
 */
export const DEFAULT_PHYSICS: PhysicsConfig = {
  dt: 0.04, gravity: 700, speedPerPower: 20,
  windAccel: 24, drag: 0.2, maxSteps: 25 * 20,
  mass: 10,
};

/** Ponto de saída do tiro, como no Reborn: fixo no corpo (30 px à frente, 23 px acima dos pés, em chão plano), independente da mira
 * e da pose, e girando com a inclinação do chão. */
export const MUZZLE = { forward: 30, up: 23 } as const;

/** `slopeDeg` positivo = o chão sobe à frente (mesma convenção de `Terrain.slopeDeg`). */
export function muzzlePoint(x: number, feetY: number, facing: 1 | -1, slopeDeg = 0): { x: number; y: number } {
  const t = (slopeDeg * Math.PI) / 180, c = Math.cos(t), sn = Math.sin(t);
  const forward = MUZZLE.forward * c - MUZZLE.up * sn, up = MUZZLE.forward * sn + MUZZLE.up * c;
  return { x: x + facing * forward, y: feetY - up };
}

export type Facing = 1 | -1;

export interface Shot {
  x: number;
  y: number;
  angleDeg: number;
  power: number; // 0..100
  facing: Facing;
  wind: number; // positivo = sopra para a direita
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function launch(shot: Shot, cfg: PhysicsConfig = DEFAULT_PHYSICS): Projectile {
  const speed = shot.power * cfg.speedPerPower;
  const a = (shot.angleDeg * Math.PI) / 180;
  return {
    // como no servidor C#: posição em float32 e velocidades iniciais inteiras
    x: Math.fround(shot.x),
    y: Math.fround(shot.y),
    vx: Math.trunc(Math.cos(a) * speed * shot.facing),
    vy: Math.trunc(-Math.sin(a) * speed),
  };
}

/** Avança um passo com o EulerVector do Reborn (float32). */
export function step(p: Projectile, wind: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): void {
  const f = Math.fround, mass = f(cfg.mass);
  const air = f(cfg.drag * mass);
  const horizontal = f(f(wind) * f(cfg.windAccel * mass));
  [p.x, p.vx] = eulerStep(p.x, p.vx, mass, air, horizontal, cfg.dt);
  [p.y, p.vy] = eulerStep(p.y, p.vy, mass, air, f(cfg.gravity * mass), cfg.dt);
}

/** Algo que diz se um ponto está sólido (terreno ou limite do mapa). */
export type SolidQuery = (x: number, y: number) => boolean;

/**
 * Hitbox retangular de um jogador. (x, y) = centro dos pés; a caixa cobre
 * x ± w/2 horizontalmente e de y − h até y (eixo Y para baixo).
 */
export interface Hitbox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Extensão da caixa abaixo dos pés, em pixels. */
  bottomOffset?: number;
}

/** Caixa única do boneco (px), usada na colisão do projétil e no raio de dano; mesma medida do Reborn (30×30, 10 px abaixo dos pés). */
export const PLAYER_HITBOX = { w: 30, h: 30, bottomOffset: 10 } as const;

export function hitboxContains(b: Hitbox, x: number, y: number, radius = 0): boolean {
  const bottom = b.y + (b.bottomOffset ?? 0);
  return x >= b.x - b.w / 2 - radius && x <= b.x + b.w / 2 + radius && y >= bottom - b.h - radius && y <= bottom + radius;
}

export interface SimOptions {
  /** Jogadores que o projétil pode acertar. */
  hitboxes?: readonly Hitbox[];
  /** Id de quem atirou: sua caixa é ignorada enquanto o projétil ainda estiver dentro dela. */
  shooterId?: string;
  /** Metade do tamanho da caixa do projétil ao testar personagens. */
  hitboxRadius?: number;
  /** Saída definitiva do mapa: encerra como erro antes de testar sólidos ou jogadores. */
  outOfBounds?: (x: number, y: number) => boolean;
  /** Passo máximo (px) da varredura entre dois passos da simulação. Padrão 1. */
  sweepPx?: number;
}

export interface TrajectoryResult {
  points: Array<{ x: number; y: number }>;
  hit: { x: number; y: number } | null;
  /** O que foi atingido: terreno/limite do mapa ou um jogador (ver `targetId`). */
  hitKind: "terrain" | "player" | null;
  targetId: string | null;
  steps: number;
  /** Tempo real de voo; o último segmento pode terminar antes de um passo inteiro. */
  duration: number;
}

/**
 * Simula o tiro inteiro até colidir ou estourar `maxSteps`.
 * A colisão é **contínua**: o segmento entre dois passos é varrido em passos de ≤ `sweepPx`,
 * então tiros rápidos não atravessam paredes finas nem jogadores. A cada ponto da varredura
 * o jogador tem prioridade sobre o terreno só se vier antes ao longo do segmento.
 */
export function simulateShot(
  shot: Shot,
  isSolid: SolidQuery,
  cfg: PhysicsConfig = DEFAULT_PHYSICS,
  opts: SimOptions = {},
): TrajectoryResult {
  const p = launch(shot, cfg);
  const points = [{ x: p.x, y: p.y }];
  const boxes = opts.hitboxes ?? [];
  const sweep = opts.sweepPx ?? 1;
  // caixas que já contêm o ponto inicial (normalmente a do atirador) ficam isentas até o projétil sair delas
  const exempt = new Set<string>();
  for (const b of boxes) if (b.id === opts.shooterId && hitboxContains(b, p.x, p.y, opts.hitboxRadius)) exempt.add(b.id);

  for (let i = 1; i <= cfg.maxSteps; i++) {
    const px = p.x, py = p.y;
    step(p, shot.wind, cfg);
    const dist = Math.hypot(p.x - px, p.y - py);
    const n = Math.max(1, Math.ceil(dist / sweep));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const x = px + (p.x - px) * t, y = py + (p.y - py) * t;
      if (opts.outOfBounds?.(x, y)) {
        points.push({ x, y });
        return { points, hit: null, hitKind: null, targetId: null, steps: i, duration: (i - 1 + t) * cfg.dt };
      }
      for (const b of boxes) {
        const inside = hitboxContains(b, x, y, opts.hitboxRadius);
        if (exempt.has(b.id)) { if (!inside) exempt.delete(b.id); continue; }
        if (inside) {
          points.push({ x, y });
          return { points, hit: { x, y }, hitKind: "player", targetId: b.id, steps: i, duration: (i - 1 + t) * cfg.dt };
        }
      }
      if (isSolid(x, y)) {
        points.push({ x, y });
        return { points, hit: { x, y }, hitKind: "terrain", targetId: null, steps: i, duration: (i - 1 + t) * cfg.dt };
      }
    }
    points.push({ x: p.x, y: p.y });
  }
  return { points, hit: null, hitKind: null, targetId: null, steps: cfg.maxSteps, duration: cfg.maxSteps * cfg.dt };
}
