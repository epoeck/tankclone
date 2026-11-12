import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { damagePopupDuration, damagePopupGeometry, damagePopupState, drawDamagePopup } from '../../client/src/damage-popup';

describe('números de dano', () => {
  it('reproduz as etapas e duração das animações originais a 24 fps', () => {
    expect(damagePopupDuration(false)).toBe(33 / 24);
    expect(damagePopupDuration(true)).toBe(28 / 24);
    expect(damagePopupState(0, false)).toMatchObject({ alpha: 0, offsetY: -20, scale: 1 });
    expect(damagePopupState(1 / 24, false)).toMatchObject({ alpha: .22, offsetY: -28, scale: 1 });
    expect(damagePopupState(1 / 24, true)).toMatchObject({ alpha: .4, scale: .74 });
    expect(damagePopupState(10 / 24, false)?.alpha).toBe(1);
    expect(damagePopupState(25 / 24, true)!.alpha).toBeLessThan(1);
    expect(damagePopupState(33 / 24, false)).toBeNull();
    expect(damagePopupState(28 / 24, true)).toBeNull();
  });
  it('normaliza a origem negativa para oito dígitos', () => {
    expect(damagePopupGeometry('12345678', true)).toEqual({ minX: -7, width: 161, digitX: 0, backgroundX: 12 });
    expect(damagePopupGeometry('1234', true)).toEqual({ minX: 0, width: 133, digitX: 33, backgroundX: 5 });
  });
  it('omite zero e danos fora do limite original', () => {
    const ctx = {} as CanvasRenderingContext2D;
    expect(() => drawDamagePopup(ctx, 0, false, 0, 0, 0)).not.toThrow();
    expect(() => drawDamagePopup(ctx, 100000000, true, 0, 0, 0)).not.toThrow();
  });
  it('mantém os dez dígitos e o fundo de crítico sem alterar os arquivos originais', () => {
    const root = new URL('../../client/public/damage-popup/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { files: Record<string, string> };
    expect(Object.keys(manifest.files)).toHaveLength(11);
    for (const [path, hash] of Object.entries(manifest.files)) expect(createHash('sha256').update(readFileSync(new URL(path, root))).digest('hex')).toBe(hash);
  });
});
