/**
 * Física do projétil — pura e determinística (sem DOM, sem rede, sem Math.random).
 * Cliente e servidor rodam este mesmo código com o mesmo passo fixo.
 *
 * Convenções: unidades em pixels e segundos; eixo Y cresce para BAIXO (como na tela).
 * Ângulo em graus: 0° = direita, 90° = para cima. `facing` espelha para quem mira à esquerda.
 */

export interface PhysicsConfig {
  /** Passo fixo da simulação (s). */
  dt: number;
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

/**
 * Valores ajustados contra as tabelas de tiro da comunidade DDTank
 * (packages/core/calibration + `npm run calibrate -w @tankclone/core`).
 * Assumem tela de 1000 px (1 unidade de distância = 100 px). Gravidade e velocidade
 * são "unidades do nosso modelo", não constantes do jogo original.
 */
export const DEFAULT_PHYSICS: PhysicsConfig = {
  dt: 1 / 60,
  gravity: 507.32,
  speedPerPower: 16.748,
  windAccel: 8, // ainda NÃO calibrado
  drag: 0.1416,
  maxSteps: 60 * 20,
};

/** Altura (px) do ponto de saída do tiro acima do chão onde o tanque está. Resultado do ajuste. */
export const MUZZLE_HEIGHT = 30.18;

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
    x: shot.x,
    y: shot.y,
    vx: Math.cos(a) * speed * shot.facing,
    vy: -Math.sin(a) * speed,
  };
}

/** Avança um passo (Euler semi-implícito: velocidade primeiro, depois posição). */
export function step(p: Projectile, wind: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): void {
  p.vx += (wind * cfg.windAccel - cfg.drag * p.vx) * cfg.dt;
  p.vy += (cfg.gravity - cfg.drag * p.vy) * cfg.dt;
  p.x += p.vx * cfg.dt;
  p.y += p.vy * cfg.dt;
}

/** Algo que diz se um ponto está sólido (terreno ou limite do mapa). Terreno real vem depois. */
export type SolidQuery = (x: number, y: number) => boolean;

export interface TrajectoryResult {
  points: Array<{ x: number; y: number }>;
  hit: { x: number; y: number } | null;
  steps: number;
}

/** Simula o tiro inteiro até colidir ou estourar `maxSteps`. */
export function simulateShot(
  shot: Shot,
  isSolid: SolidQuery,
  cfg: PhysicsConfig = DEFAULT_PHYSICS,
): TrajectoryResult {
  const p = launch(shot, cfg);
  const points = [{ x: p.x, y: p.y }];
  for (let i = 1; i <= cfg.maxSteps; i++) {
    step(p, shot.wind, cfg);
    points.push({ x: p.x, y: p.y });
    if (isSolid(p.x, p.y)) return { points, hit: { x: p.x, y: p.y }, steps: i };
  }
  return { points, hit: null, steps: cfg.maxSteps };
}
