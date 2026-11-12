import { wingLibraryPath } from '@tankclone/core';
import { drawCharacterTimeline, loadCharacterTimeline, type TimelineAsset } from './character-timeline';
/** Bibliotecas por asa (1 = wing002 do Reborn; 2.. = CN 14.7 convertidas localmente). null = indisponível. */
const assets = new Map<number, TimelineAsset | null | undefined>();
type Ids = { back?: number; front?: number; show?: number; junction: [number, number] };
const ids = new Map<number, Ids>();
function resolve(asset: TimelineAsset): Ids {
  const { chars, classes } = asset.library;
  const named = (prefix: string) => Object.entries(classes).find(([n]) => n.startsWith(prefix))?.[1].id;
  const game = named('wing_game_'), show = named('wing_show_');
  const child = (id: number | undefined, nm: string) => (id === undefined ? undefined : (chars[id]?.tl?.f[0] as { nm?: string; id?: number }[] | undefined)?.find(p => p.nm === nm)?.id);
  // GAME: leftWing atrás, rightWing à frente (instâncias nomeadas no clipe wing_game_*).
  let back = child(game, 'leftWing'), front = child(game, 'rightWing');
  back ??= classes['wings_fla.gameWingIn_2']?.id; front ??= classes['wings_fla.gameWingOut_4']?.id;
  // SHOW: o clipe põe as duas asas simétricas em torno da junção; a média das duas posições dá o ponto de apoio.
  const pl = show === undefined ? [] : (chars[show]?.tl?.f[0] as { m?: number[] }[] | undefined) ?? [];
  const jx = pl.length ? pl.reduce((s, p) => s + (p.m?.[4] ?? 0), 0) / pl.length : 50, jy = pl.length ? pl.reduce((s, p) => s + (p.m?.[5] ?? 0), 0) / pl.length : 111;
  return { back, front, show, junction: [jx, jy] };
}
function get(index: number): TimelineAsset | null {
  if (typeof Image === 'undefined') return null;
  if (!assets.has(index)) {
    assets.set(index, undefined);
    const path = wingLibraryPath(index);
    if (path) void loadCharacterTimeline(path).then(value => { assets.set(index, value); ids.set(index, resolve(value)); }).catch(() => { assets.set(index, null); });
    else assets.set(index, null);
  }
  return assets.get(index) ?? null;
}
/** GAME: GamePlayer.addWing usa weaponX=-62, weaponY=-83; pés da folha estão em y=91. */
export function drawWing(ctx: CanvasRenderingContext2D, time: number, mode: 'game' | 'show' = 'game', layer: 'back' | 'front' = 'back', active = true, shooting = false, wing = 1): boolean {
  const asset = get(wing); if (!asset) return false;
  const found = ids.get(wing)!;
  const frame = active ? Math.floor(Math.max(0, time) * asset.library.frameRate) : 0;
  ctx.save();
  let id: number | undefined, state: number | null = null;
  if (mode === 'game') {
    id = layer === 'back' ? found.back : found.front;
    state = shooting ? 1 : 0;
    ctx.translate(-62, -91);
  } else {
    id = found.show;
    // wing002: junção ≈(50,117) em (−100,−213) atrás dos ombros do corpo SHOW (ajustado a olho no vestiário).
    // Outras asas: mesma regra a partir da junção medida no clipe.
    if (wing === 1) ctx.translate(-100, -213); else ctx.translate(-found.junction[0] - 50, -found.junction[1] - 102);
  }
  const result = id ? drawCharacterTimeline(ctx, asset, id, frame, state) : false;
  ctx.restore(); return result;
}
