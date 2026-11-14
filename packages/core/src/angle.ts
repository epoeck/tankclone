/**
 * Faixa de ângulo por arma, relativa ao corpo do personagem.
 * Na rampa o corpo inclina: a faixa gira junto, mas o ângulo EXIBIDO e usado no tiro é o absoluto real
 * (0° = horizontal na direção do olhar, 90° = para cima). Assim, numa subida o jogador precisa compensar.
 */
export interface AngleRange {
  /** Mínimo e máximo relativos ao corpo (graus). */
  min: number;
  max: number;
}

/** Limites de ângulo absoluto permitidos para uma inclinação `slopeDeg` (positiva = chão sobe à frente). */
export function allowedAbsoluteRange(range: AngleRange, slopeDeg: number): AngleRange {
  return { min: range.min + slopeDeg, max: range.max + slopeDeg };
}

/** Prende o ângulo absoluto desejado à faixa da arma na inclinação atual. */
export function clampAbsoluteAngle(absDeg: number, range: AngleRange, slopeDeg: number): number {
  const r = allowedAbsoluteRange(range, slopeDeg);
  return Math.min(r.max, Math.max(r.min, absDeg));
}

/** Ângulo relativo ao corpo, para posicionar o cano no sprite. */
export function relativeAngle(absDeg: number, slopeDeg: number): number {
  return absDeg - slopeDeg;
}
