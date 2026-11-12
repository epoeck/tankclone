/** Leitor das linhas de tempo SWF exportadas para imagens e matrizes Canvas. */
type Placement = { d?: number; id?: number; m?: number[]; mv?: number; rm?: number; ct?: number[] };
type Part = { k: string; img?: string; r?: number[]; w?: number; h?: number; tl?: { n: number; f: Placement[][] } };
export type CharacterLibrary = { frameRate: number; chars: Record<string, Part>; classes: Record<string, { id: number }> };
export type TimelineAsset = { library: CharacterLibrary; images: Map<string, HTMLImageElement> };
export function loadCharacterTimeline(path: string): Promise<TimelineAsset> {
  return fetch(`${path}/library.json`).then(r => { if (!r.ok) throw Error(path); return r.json() as Promise<CharacterLibrary>; }).then(library => {
    const images = new Map<string, HTMLImageElement>();
    for (const c of Object.values(library.chars)) if ((c.k === 'shape' || c.k === 'bitmap') && c.img && !images.has(c.img)) {
      const image = new Image(); image.src = `${path}/${c.img}`; images.set(c.img, image);
    }
    return { library, images };
  });
}
export function drawCharacterTimeline(ctx: CanvasRenderingContext2D, asset: TimelineAsset, id: number, frame: number, state: number | null = null, depth = 0): boolean {
  const c = asset.library.chars[id]; if (!c || depth > 12) return false;
  if (c.k === 'shape' && c.img && c.r) {
    const image = asset.images.get(c.img); if (!image?.complete || !image.naturalWidth) return false;
    ctx.drawImage(image, c.r[0]!, c.r[1]!, c.r[2]!, c.r[3]!); return true;
  }
  if (c.k === 'bitmap' && c.img) {
    const image = asset.images.get(c.img); if (!image?.complete || !image.naturalWidth) return false;
    ctx.drawImage(image, 0, 0, c.w ?? image.naturalWidth, c.h ?? image.naturalHeight); return true;
  }
  if (!c.tl) return false;
  const index = state === null ? Math.max(0, frame) % c.tl.n : Math.min(state, c.tl.n - 1);
  const display = new Map<number, { id: number; m: number[]; start: number; alpha: number }>();
  for (let i = 0; i <= index; i++) for (const p of c.tl.f[i] ?? []) {
    if (p.rm !== undefined) { display.delete(p.rm); continue; }
    if (p.d === undefined) continue;
    const old = display.get(p.d);
    if (p.id !== undefined) display.set(p.d, { id: p.id, m: p.m ?? old?.m ?? [1,0,0,1,0,0], start: p.mv && old?.id === p.id ? old.start : i, alpha: p.ct?.[3] ?? old?.alpha ?? 1 });
    else if (old) { if (p.m) old.m = p.m; if (p.ct) old.alpha = p.ct[3] ?? 1; }
  }
  let drawn = false;
  for (const [, child] of [...display].sort((a, b) => a[0] - b[0])) {
    ctx.save(); ctx.globalAlpha *= child.alpha; const m = child.m; ctx.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
    drawn = drawCharacterTimeline(ctx, asset, child.id, (state === null && c.tl.n > 1 ? index : frame) - child.start, null, depth + 1) || drawn; ctx.restore();
  }
  return drawn;
}
