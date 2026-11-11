/**
 * Terreno destrutível: máscara de bits (1 byte por pixel, 1 = sólido).
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
      for (let y = top; y < height; y++) t.mask[y * width + x] = 1;
    }
    return t;
  }

  /** Cria a partir de um bitmap (ex.: alfa de uma imagem de mapa): sólido onde solid[i] != 0. */
  static fromMask(width: number, height: number, solid: ArrayLike<number>): Terrain {
    if (solid.length !== width * height) throw new Error("tamanho da máscara não bate com width*height");
    const t = new Terrain(width, height);
    for (let i = 0; i < solid.length; i++) t.mask[i] = solid[i] ? 1 : 0;
    return t;
  }

  isSolid(x: number, y: number): boolean {
    const ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || ix >= this.width || iy >= this.height) return true;
    if (iy < 0) return false;
    return this.mask[iy * this.width + ix] === 1;
  }

  /** Apaga um círculo. Retorna quantos pixels foram removidos. */
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
          if (this.mask[i] === 1) { this.mask[i] = 0; removed++; }
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
      if (this.mask[y * this.width + ix] === 1) return y;
    }
    return -1;
  }

  /** Acesso somente-leitura para renderização. */
  getMask(): Readonly<Uint8Array> { return this.mask; }

  clone(): Terrain {
    const t = new Terrain(this.width, this.height);
    t.mask.set(this.mask);
    return t;
  }
}
