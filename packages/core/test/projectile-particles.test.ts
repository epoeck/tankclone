import { describe, expect, it } from 'vitest';
import { particleLine, particleMotion } from '../../client/src/projectile-effects';

describe('partículas visuais da referência', () => {
  it('aplica os passos de Particle.update e as curvas do emissor 8', () => {
    // v=169, gravidade=7, ângulo=0: gv soma 7 por passo; dt=0,04.
    const p = particleMotion(169, 0, 0, 7, 3, 3);
    expect(p.x).toBeCloseTo(20.28);
    expect(p.y).toBeCloseTo(1.68);
    expect(particleLine([[0,1],[1,.6]], .24)).toBeCloseTo(.904);
    expect(particleLine([[0,1],[1,0]], .24)).toBeCloseTo(.76);
  });
  it('avalia o mesmo tick sem depender de quantos quadros foram desenhados', () => {
    const sample = (fps: number) => {
      let result = { x: 0, y: 0 };
      for (let frame = 0; frame <= fps; frame++) {
        const tick = Math.floor((frame / fps) / .04 + 1e-9);
        result = particleMotion(35, .7, 15, 5, 4, tick);
      }
      return result;
    };
    expect(sample(30)).toEqual(sample(60));
    expect(sample(144)).toEqual(sample(60));
  });
});
