import { expect, it, vi } from "vitest";
import { MAPS, Terrain } from "../src/index";
vi.mock("../../client/src/sound", () => ({ sfx: () => {}, projectileSfx: () => {}, toggleMute: () => false, stopSfx: () => {}, preloadLocalSfx: () => {} }));
import { MatchView } from "../../client/src/view";

// Um canvas mínimo em memória, com composição de pixels verificável sem navegador.
class Canvas {
  width = 0; height = 0; data = new Uint8ClampedArray();
  getContext() { return new Context(this); }
}
class Context {
  constructor(private c: Canvas) {}
  private pixels() { if (this.c.data.length !== this.c.width * this.c.height * 4) this.c.data = new Uint8ClampedArray(this.c.width * this.c.height * 4); return this.c.data; }
  createImageData(w: number, h: number) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
  getImageData(x: number, y: number, w: number, h: number) {
    const img = this.createImageData(w, h), src = this.pixels();
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) img.data.set(src.subarray(((y+j)*this.c.width+x+i)*4, ((y+j)*this.c.width+x+i)*4+4), (j*w+i)*4);
    return img;
  }
  putImageData(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) {
    const dst = this.pixels();
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) dst.set(img.data.subarray((j*img.width+i)*4, (j*img.width+i)*4+4), ((y+j)*this.c.width+x+i)*4);
  }
  clearRect() { this.pixels().fill(0); }
  drawImage(img: FakeImage, x: number, y: number) {
    const dst = this.pixels();
    for (let j = 0; j < img.naturalHeight; j++) for (let i = 0; i < img.naturalWidth; i++) {
      const dx=x+i, dy=y+j; if (dx<0 || dy<0 || dx>=this.c.width || dy>=this.c.height) continue;
      dst.set(img.data.subarray((j*img.naturalWidth+i)*4, (j*img.naturalWidth+i)*4+4), (dy*this.c.width+dx)*4);
    }
  }
}
class FakeImage {
  static all: FakeImage[] = [];
  onload: (() => void) | null = null; src = ""; complete = false; naturalWidth = 0; naturalHeight = 0; data = new Uint8ClampedArray();
  constructor() { FakeImage.all.push(this); }
  load(w: number, h: number, color: number[]) { this.naturalWidth=w; this.naturalHeight=h; this.complete=true; this.data=new Uint8ClampedArray(w*h*4); for (let i=0;i<w*h;i++) this.data.set(color,i*4); this.onload?.(); }
}

it("recorta ar, pinta só terreno destrutível e reconstrói a borda sobre arte carregada depois", () => {
  FakeImage.all = []; vi.stubGlobal("Image", FakeImage); vi.stubGlobal("document", { createElement: () => new Canvas() });
  const terrain = Terrain.fromHeightFn(4, 4, () => 1); terrain.fillIndestructible(2, 2, 3, 3);
  MAPS.testPaint = { id: "testPaint", name: "test", width: 4, height: 4, indestructible: true, spawns: { 1: [], 2: [] }, build: () => terrain, artBase: "/", manifest: { id: "testPaint", name: "test", width: 4, height: 4, art: "art.png", mask: "mask.png", spawns: { 1: [], 2: [] } } };
  const view = new MatchView("testPaint", []);
  // Substitui apenas a escavação para obter três pixels vizinhos com estados conhecidos.
  vi.spyOn(terrain, "carveShape").mockImplementation(() => { (terrain.getMask() as Uint8Array)[2 * 4 + 1] = 0; return 1; });
  const brink = FakeImage.all.find(i => i.src.endsWith('/101.png'))!; brink.load(3, 3, [200, 0, 0, 128]);
  view.push([{ type: "crater", x: 2, y: 2, ballId: 101 }]); view.update(0);
  const pixel = (x: number, y: number) => [...(view.terrainCanvas as unknown as Canvas).data.slice((y*4+x)*4, (y*4+x)*4+4)];
  expect(pixel(1, 2)[3]).toBe(0);
  expect(pixel(2, 2)).toEqual([90, 90, 105, 255]);
  expect(pixel(3, 2)).toEqual([137, 49, 29, 255]);
  const art = FakeImage.all.find(i => i.src === '/art.png')!; art.load(4, 4, [0, 0, 200, 255]);
  expect(pixel(1, 2)[3]).toBe(0);
  expect(pixel(2, 2)).toEqual([0, 0, 200, 255]);
  expect(pixel(3, 2)).toEqual([100, 0, 100, 255]);
  delete MAPS.testPaint; vi.unstubAllGlobals();
});
