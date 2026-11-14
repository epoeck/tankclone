import { describe, expect, it } from 'vitest';
import { miniTransform, miniToMap, mapToMini } from '../../client/src/minimap-geometry';
describe('minimapa com escala uniforme', () => {
  it.each([[2400,600],[2000,1425],[1272,950]])('preserva proporção e inverte coordenadas %ix%i', (width,height) => {
    const t=miniTransform(width,height,300,130), p=mapToMini(t,width*.7,height*.3), back=miniToMap(t,p.x,p.y);
    expect(t.width/t.height).toBeCloseTo(width/height); expect(t.width).toBeLessThanOrEqual(300); expect(t.height).toBeLessThanOrEqual(120);
    expect(back.x).toBeCloseTo(width*.7); expect(back.y).toBeCloseTo(height*.3);
    const end=mapToMini(t,width,height); const clamped=miniToMap(t,end.x+100,end.y+100); expect(clamped.x).toBeCloseTo(width); expect(clamped.y).toBeCloseTo(height);
  });
});

import { lastShotMarker } from '../../client/src/character-state';
describe('marcas do tiro anterior', () => {
  it('não mostra marca antes de tiro e espelha a agulha conforme o lado do disparo', () => {
    expect(lastShotMarker(null)).toBeNull();
    expect(lastShotMarker({angle: 60, power: 73, facing: 1})).toEqual({angle: 60, power: 73});
    expect(lastShotMarker({angle: 60, power: 73, facing: -1})).toEqual({angle: -240, power: 73});
  });
});
