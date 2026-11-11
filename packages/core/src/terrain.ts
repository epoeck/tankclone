/** Estados de um pixel do terreno. */
export const AIR = 0;
export const DESTRUCTIBLE = 1;
export const INDESTRUCTIBLE = 2;

/** Limiares da máscara em tons de cinza: < 64 = ar (preto), >= 192 = destrutível (branco), no meio = indestrutível (cinza). */
export const MASK_AIR_BELOW = 64;
export const MASK_DESTRUCTIBLE_FROM = 192;

/**
 * Terreno: 1 byte por pixel com 3 estados (ar / chão destrutível / chão indestrutível).
 * Determinístico — o servidor e o cliente aplicam as mesmas crateras na mesma ordem.
 * Fora dos limites laterais e abaixo do mapa conta como sólido; acima do mapa, vazio.
 */
export class Terrain {
  readonly width: number;
  readonly height: number;
  private mask: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.mask = new Uint8Array(width * height);
  }

  /** Cria a partir de uma função de altura: sólido para y >= surface(x). */
  static fromHeightFn(width: number, height: number, surface: (x: number) => number): Terrain {
    const t = new Terrain(width, height);
    for (let x = 0; x < width; x++) {
      const top = Math.max(0, Math.min(height, Math.ceil(surface(x))));
      for (let y = top; y < height; y++) t.mask[y * width + x] = DESTRUCTIBLE;
    }
    return t;
  }

  /**
   * Cria a partir da máscara do mapa em tons de cinza (0–255 por pixel, como o PNG de máscara):
   * preto (< 64) = ar, branco (>= 192) = destrutível, cinza no meio = indestrutível.
   */
  static fromMask(width: number, height: number, gray: ArrayLike<number>): Terrain {
    if (gray.length !== width * height) throw new Error("tamanho da máscara não bate com width*height");
    const t = new Terrain(width, height);
    for (let i = 0; i < gray.length; i++) {
      const g = gray[i]!;
      t.mask[i] = g < MASK_AIR_BELOW ? AIR : g >= MASK_DESTRUCTIBLE_FROM ? DESTRUCTIBLE : INDESTRUCTIBLE;
    }
    return t;
  }

  /** Marca um retângulo como indestrutível (útil em testes e mapas procedurais). */
  fillIndestructible(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = Math.max(0, y0); y < Math.min(this.height, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(this.width, x1); x++) this.mask[y * this.width + x] = INDESTRUCTIBLE;
  }

  /** Estado do pixel: AIR, DESTRUCTIBLE ou INDESTRUCTIBLE (fora do mapa: laterais/fundo indestrutíveis, topo ar). */
  stateAt(x: number, y: number): number {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy >= this.height) return INDESTRUCTIBLE;
    if (iy < 0) return AIR;
    return this.mask[iy * this.width + ix]!;
  }

  isSolid(x: number, y: number): boolean {
    return this.stateAt(x, y) !== AIR;
  }

  /** Apaga um círculo de chão destrutível (o indestrutível resiste). Retorna quantos pixels foram removidos. */
  carveCircle(cx: number, cy: number, r: number): number {
    let removed = 0;
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) {
          const i = y * this.width + x;
          if (this.mask[i] === DESTRUCTIBLE) { this.mask[i] = AIR; removed++; }
        }
      }
    }
    return removed;
  }

  /** Primeiro pixel sólido descendo a partir de fromY na coluna x; -1 se não houver. */
  surfaceY(x: number, fromY = 0): number {
    const ix = Math.floor(x);
    if (ix < 0 || ix >= this.width) return -1;
    for (let y = Math.max(0, Math.floor(fromY)); y < this.height; y++) {
      if (this.mask[y * this.width + ix] !== AIR) return y;
    }
    return -1;
  }

  /**
   * Inclinação (graus) do chão sob um personagem em `x`, medida entre `x - facing*half` e `x + facing*half`.
   * Positivo = o chão sobe na direção para onde ele olha (rampa de subida). `fromY` = altura de onde procurar o chão.
   */
  slopeDeg(x: number, fromY: number, facing: 1 | -1, half = 16): number {
    const back = this.surfaceY(x - facing * half, fromY), front = this.surfaceY(x + facing * half, fromY);
    if (back < 0 || front < 0) return 0;
    return (Math.atan2(back - front, 2 * half) * 180) / Math.PI;
  }

  /** Acesso somente-leitura para renderização. */
  getMask(): Readonly<Uint8Array> { return this.mask; }

  clone(): Terrain {
    const t = new Terrain(this.width, this.height);
    t.mask.set(this.mask);
    return t;
  }
}
