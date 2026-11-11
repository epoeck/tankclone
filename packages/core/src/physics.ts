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
  windAccel: 17, // calibrado: reproduz "ângulo ± vento × 2" (vento 0–10); ver fitWindAccel
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
}

/** Tamanho provisório do boneco (px). Ajustar quando a arte chegar. */
export const PLAYER_HITBOX = { w: 36, h: 52 } as const;

export function hitboxContains(b: Hitbox, x: number, y: number): boolean {
  return x >= b.x - b.w / 2 && x <= b.x + b.w / 2 && y >= b.y - b.h && y <= b.y;
}

export interface SimOptions {
  /** Jogadores que o projétil pode acertar. */
  hitboxes?: readonly Hitbox[];
  /** Id de quem atirou: sua caixa é ignorada enquanto o projétil ainda estiver dentro dela. */
  shooterId?: string;
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
  for (const b of boxes) if (b.id === opts.shooterId && hitboxContains(b, p.x, p.y)) exempt.add(b.id);

  for (let i = 1; i <= cfg.maxSteps; i++) {
    const px = p.x, py = p.y;
    step(p, shot.wind, cfg);
    const dist = Math.hypot(p.x - px, p.y - py);
    const n = Math.max(1, Math.ceil(dist / sweep));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const x = px + (p.x - px) * t, y = py + (p.y - py) * t;
      for (const b of boxes) {
        const inside = hitboxContains(b, x, y);
        if (exempt.has(b.id)) { if (!inside) exempt.delete(b.id); continue; }
        if (inside) {
          points.push({ x, y });
          return { points, hit: { x, y }, hitKind: "player", targetId: b.id, steps: i };
        }
      }
      if (isSolid(x, y)) {
        points.push({ x, y });
        return { points, hit: { x, y }, hitKind: "terrain", targetId: null, steps: i };
      }
    }
    points.push({ x: p.x, y: p.y });
  }
  return { points, hit: null, hitKind: null, targetId: null, steps: cfg.maxSteps };
}
