import type { Facing, MatchEvent } from "@tankclone/core";

type MovingCharacter = { x: number; y: number; facing: Facing; energy: number; walk: number };

/** Um pacote pode conter um único ponto: o lado vem do servidor, nunca do comprimento do caminho. */
export function applyCharacterMove(c: MovingCharacter, e: Extract<MatchEvent, { type: "move" }>): void {
  const end = e.path.at(-1);
  if (end) { c.x = end.x; c.y = end.y; c.walk = 0.14; }
  c.energy = e.energyLeft;
  c.facing = e.facing;
}
