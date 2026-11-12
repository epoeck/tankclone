/** Cache de pintura do terreno (arte recortada pela máscara + bordas das crateras). Só desenha; a máscara é do core. */
import { WEAPONS, craterOrigin, craterShape, type Terrain } from "@tankclone/core";

type Crater = { x: number; y: number; ballId: number };

export class TerrainLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private art: HTMLImageElement | null = null;
  private craters: Crater[] = [];
  private brinks = new Map<number, HTMLImageElement>();

  constructor(private terrain: Terrain, readonly width: number, readonly height: number) {
    this.canvas = document.createElement("canvas"); this.canvas.width = width; this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d")!;
    this.paintFlat();
    for (const ballId of Object.values(WEAPONS).flatMap(w => [w.ballId, w.special.ballId])) this.loadBrink(ballId);
  }

  /** Arte do mapa, recortada pela máscara (ar vira transparente) assim que carregar. */
  setArt(art: HTMLImageElement): void { this.art = art; this.rebuild(); }

  private loadBrink(ballId: number): void {
    const image = new Image(); this.brinks.set(ballId, image);
    image.onload = () => this.rebuild(); image.src = `/assets/craters/${ballId}.png`;
  }

  private paintFlat() {
    const img = this.ctx.createImageData(this.width, this.height), m = this.terrain.getMask();
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      img.data.set(m[i] === 2 ? [90, 90, 105, 255] : [74, 98, 58, 255], i * 4);
    }
    this.ctx.putImageData(img, 0, 0);
  }

  /** Pinta a arte respeitando o estado atual do terreno (crateras já abertas ficam transparentes). */
  private paintArt(art: HTMLImageElement): void {
    const c = document.createElement("canvas"); c.width = this.width; c.height = this.height;
    const cx = c.getContext("2d")!; cx.drawImage(art, 0, 0, this.width, this.height);
    const img = cx.getImageData(0, 0, this.width, this.height), m = this.terrain.getMask();
    for (let i = 0; i < m.length; i++) if (!m[i]) img.data[i * 4 + 3] = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.putImageData(img, 0, 0);
  }

  /** Reconstrói o cache com a máscara atual e reaplica as bordas persistentes. */
  private rebuild(): void {
    if (this.art) this.paintArt(this.art); else this.paintFlat();
    for (const crater of this.craters) this.paintBrink(crater);
  }

  private paintBrink(crater: Crater): void {
    const image = this.brinks.get(crater.ballId);
    if (!image?.complete || !image.naturalWidth) return;
    const x0 = Math.trunc(crater.x) - Math.trunc(image.naturalWidth / 2);
    const y0 = Math.trunc(crater.y) - Math.trunc(image.naturalHeight / 2);
    const x = Math.max(0, x0), y = Math.max(0, y0);
    const w = Math.min(this.width, x0 + image.naturalWidth) - x;
    const h = Math.min(this.height, y0 + image.naturalHeight) - y;
    if (w <= 0 || h <= 0) return;
    const temp = document.createElement("canvas"); temp.width = w; temp.height = h;
    const cx = temp.getContext("2d")!; cx.drawImage(image, x0 - x, y0 - y);
    const edge = cx.getImageData(0, 0, w, h), patch = this.ctx.getImageData(x, y, w, h), mask = this.terrain.getMask();
    for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      if (mask[(y + row) * this.width + x + col] !== 1 || !patch.data[i + 3]) continue;
      const alpha = edge.data[i + 3]! / 255;
      for (let k = 0; k < 3; k++) patch.data[i + k] = Math.round(edge.data[i + k]! * alpha + patch.data[i + k]! * (1 - alpha));
    }
    this.ctx.putImageData(patch, x, y);
  }

  /** Cratera nova: o core já cavou a máscara; recorta a imagem e guarda a borda. */
  carve(e: Crater): void {
    const shape = craterShape(e.ballId);
    this.terrain.carveShape(e.x, e.y, shape);
    // Recorta a imagem pela máscara atual; pixels indestrutíveis também permanecem visíveis.
    const origin = craterOrigin(e.x, e.y, shape);
    const x = Math.max(0, origin.x), y = Math.max(0, origin.y);
    const w = Math.min(this.width, origin.x + shape.width) - x;
    const h = Math.min(this.height, origin.y + shape.height) - y;
    if (w > 0 && h > 0) {
      const patch = this.ctx.getImageData(x, y, w, h), mask = this.terrain.getMask();
      for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
        if (!mask[(y + row) * this.width + x + col]) patch.data[(row * w + col) * 4 + 3] = 0;
      }
      this.ctx.putImageData(patch, x, y);
    }
    this.craters.push({ x: e.x, y: e.y, ballId: e.ballId });
    if (!this.brinks.has(e.ballId)) this.loadBrink(e.ballId);
    this.paintBrink(e);
  }
}
