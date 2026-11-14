import { describe, expect, it } from 'vitest';
import { simulateShot, hitboxContains, type Shot } from '../src/physics';
import { Terrain } from '../src/terrain';
const boundary = (x: number, y: number) => x < 0 || x >= 100 || y >= 100;
const terrain = new Terrain(100, 100);
const fire = (shot: Partial<Shot>, hitboxes = [] as {id:string;x:number;y:number;w:number;h:number}[]) => simulateShot(
  { x: 50, y: 50, angleDeg: 0, power: 30, facing: 1, wind: 0, ...shot },
  (x, y) => terrain.isSolid(x, y), undefined, { outOfBounds: boundary, hitboxes },
);
describe('saída dos projéteis', () => {
  it('encerra nas duas laterais e no fundo como erro, sem atingir caixa fora do mapa', () => {
    for (const shot of [{facing: 1 as const}, {facing: -1 as const}, {angleDeg: -90}]) {
      const r = fire(shot, [{id:'fora',x:110,y:50,w:20,h:30}]);
      expect(r.hit).toBeNull(); expect(r.hitKind).toBeNull(); expect(r.targetId).toBeNull();
      expect(r.duration).toBeLessThan(2); expect(boundary(r.points.at(-1)!.x, r.points.at(-1)!.y)).toBe(true);
    }
  });
  it('deixa cruzar o topo e voltar ao mapa', () => {
    const r = fire({angleDeg: 90, power: 20});
    expect(r.points.some(p => p.y < 0)).toBe(true);
    expect(r.points.at(-1)!.y).toBeGreaterThanOrEqual(100);
    expect(r.hit).toBeNull(); expect(r.duration).toBeLessThan(3);
  });
  it('considera offset e raio da bomba sem alterar a caixa padrão', () => {
    const b = {id:'alvo',x:50,y:50,w:30,h:30,bottomOffset:10};
    expect(hitboxContains(b, 68, 37, 3)).toBe(true);
    expect(hitboxContains(b, 68.01, 37, 3)).toBe(false);
    expect(hitboxContains(b, 50, 27, 3)).toBe(true);
    expect(hitboxContains(b, 50, 26.99, 3)).toBe(false);
    expect(hitboxContains({id:'p',x:50,y:50,w:36,h:42}, 50, 8)).toBe(true);
  });
  it('mantém colisões de terreno e jogador dentro do mapa e limites do jogador', () => {
    const r = fire({}, [{id:'alvo',x:75,y:65,w:20,h:30}]);
    expect(r.hitKind).toBe('player'); expect(r.targetId).toBe('alvo');
    const wall = new Terrain(100,100); wall.fillIndestructible(70,0,71,100);
    const land = simulateShot({x:50,y:50,angleDeg:0,power:30,facing:1,wind:0}, (x,y) => wall.isSolid(x,y), undefined, {outOfBounds: boundary});
    expect(land.hitKind).toBe('terrain'); expect(land.hit!.x).toBeGreaterThanOrEqual(70);
    expect(terrain.isSolid(-1,50)).toBe(true); expect(terrain.isSolid(100,50)).toBe(true);
  });
});
