import source from "./reference/reborn-craters.json";

/** Cada linha guarda pares [início, fim exclusivo] dos pixels removidos pela explosão. */
export interface CraterShape {
  readonly width: number;
  readonly height: number;
  readonly rows: readonly (readonly number[])[];
}

export function craterShape(ballId: number): CraterShape {
  const shapes: Record<string, CraterShape> = source.shapes;
  const key = String(ballId);
  if (!Object.hasOwn(shapes, key)) throw new Error(`máscara de explosão desconhecida: ${ballId}`);
  return shapes[key]!;
}

/** Mesmo ponto de ancoragem de Tile.Dig: impacto inteiro menos metade inteira da máscara. */
export function craterOrigin(x: number, y: number, shape: CraterShape): { x: number; y: number } {
  return { x: Math.trunc(x) - Math.trunc(shape.width / 2), y: Math.trunc(y) - Math.trunc(shape.height / 2) };
}
