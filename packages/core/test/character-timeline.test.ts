import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { drawCharacterTimeline, type TimelineAsset } from '../../client/src/character-timeline';

const root = new URL('../../client/public/character-effects/', import.meta.url);
describe('recursos e timeline de personagem', () => {
  it('valida os hashes das asas e dos fantasmas importados', () => {
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { files: Record<string, string> };
    for (const [file, hash] of Object.entries(manifest.files)) expect(createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex')).toBe(hash);
    expect(Object.keys(manifest.files).some(f => f.startsWith('ghost/'))).toBe(true);
  });
  it('mantém a animação interna enquanto muda o quadro de estado da asa', () => {
    const library = JSON.parse(readFileSync(new URL('wing/library.json', root), 'utf8'));
    const images = new Map<string, HTMLImageElement>();
    for (const c of Object.values(library.chars) as Array<{k: string; img?: string}>) if (c.k === 'shape' && c.img) images.set(c.img, { complete: true, naturalWidth: 10 } as HTMLImageElement);
    const asset: TimelineAsset = { library, images };
    const frames: string[] = [], matrices: number[][] = [];
    const ctx = { globalAlpha: 1, save() {}, restore() {}, transform(...m: number[]) { matrices.push(m); }, drawImage(image: HTMLImageElement) { frames.push([...images].find(([, v]) => v === image)![0]); } } as unknown as CanvasRenderingContext2D;
    drawCharacterTimeline(ctx, asset, 18, 0, 0); const idleImage = frames.at(-1), idleMatrix = matrices[0];
    frames.length = matrices.length = 0;
    drawCharacterTimeline(ctx, asset, 18, 8, 0); expect(frames.at(-1)).not.toBe(idleImage);
    frames.length = matrices.length = 0;
    drawCharacterTimeline(ctx, asset, 18, 0, 1); expect(matrices[0]).not.toEqual(idleMatrix);
  });
});
