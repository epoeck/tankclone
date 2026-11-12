import type { Facing, MatchEvent } from "@tankclone/core";

type MovingCharacter = { x: number; y: number; facing: Facing; energy: number; walk: number };

/** Um pacote pode conter um único ponto: o lado vem do servidor, nunca do comprimento do caminho. */
export function applyCharacterMove(c: MovingCharacter, e: Extract<MatchEvent, { type: "move" }>): void {
  const end = e.path.at(-1);
  if (end) { c.x = end.x; c.y = end.y; c.walk = 0.14; }
  c.energy = e.energyLeft;
  c.facing = e.facing;
}

/** CSS da agulha usa rotação negativa; o valor exibido continua relativo ao olhar. */
export function dialAngle(angleDeg: number, facing: Facing): number {
  return facing === -1 ? -180 - angleDeg : angleDeg;
}

/** Posição do marcador de tiro anterior em coordenadas da interface. */
export function lastShotMarker(shot: { angle: number; power: number; facing: Facing } | null): { angle: number; power: number } | null {
  return shot ? { angle: dialAngle(shot.angle, shot.facing), power: Math.max(0, Math.min(100, shot.power)) } : null;
}
