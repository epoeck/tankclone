import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeStates, mapFromStates, type MapManifest } from '../src/maps';
const root = resolve(import.meta.dirname, '../../client/public/maps');
const hashes: Record<string,string> = {
  'original-1001':'96769c056d695fab846421ec3b625c573971b887f840d5e433e2ff8941ebce3b',
  'original-1002':'80e6e6fecf69871b0e8e62cfe9f494b771a4b392f0f5fe3451230371b1a72b87',
  'original-1003':'a6e33b6f422d8ada3e925a0faf148c83a1d1810707199d7d0625c3a70c7005d3',
  'original-1004':'c41835ae9cdcf83ef1bb49b5f322d66b012498adad113cf00d58094fdfcf17a1',
  'original-1005':'fae21e0a0187ebcbc2d7d9aca56c6edad9964ec8c5b79daf67c81882b356cf87',
};
describe('mapas clássicos importados', () => {
  for (const [id, hash] of Object.entries(hashes)) it(`${id}: máscara e nascimentos preservados`, () => {
    const m = JSON.parse(readFileSync(resolve(root,id,'manifest.json'),'utf8')) as MapManifest;
    const states = decodeStates(readFileSync(resolve(root,id,'mask.bin')),m.width*m.height);
    expect(createHash('sha256').update(states).digest('hex')).toBe(hash);
    const map = mapFromStates(m, states); const terrain = map.build();
    for (const team of ['1','2'] as const) for (let i=0;i<4;i++) {
      const x=m.spawns[team][i]!, start=m.spawnsY![team][i]!, ground=terrain.surfaceY(x,start);
      expect(ground).toBeGreaterThanOrEqual(start); expect(ground-start).toBeLessThan(120);
    }
  });
});
