import { drawCharacterTimeline, loadCharacterTimeline, type TimelineAsset } from './character-timeline';
let asset: TimelineAsset | undefined;
if (typeof Image !== 'undefined') void loadCharacterTimeline('/character-effects/wing').then(value => { asset = value; }).catch(() => {});
/** GAME: GamePlayer.addWing usa weaponX=-62, weaponY=-83; pés da folha estão em y=91. */
export function drawWing(ctx: CanvasRenderingContext2D, time: number, mode: 'game' | 'show' = 'game', layer: 'back' | 'front' = 'back', active = true, shooting = false): boolean {
  if (!asset) return false;
  const frame = active ? Math.floor(Math.max(0, time) * asset.library.frameRate) : 0;
  ctx.save();
  let id: number | undefined, state: number | null = null;
  if (mode === 'game') {
    // Os dois clipes são separados no original: leftWing atrás, rightWing à frente.
    id = asset.library.classes[layer === 'back' ? 'wings_fla.gameWingIn_2' : 'wings_fla.gameWingOut_4']?.id;
    state = shooting ? 1 : 0;
    ctx.translate(-62, -91);
  } else {
    id = asset.library.classes.wing_show_15002?.id;
    // Origem do contexto = pés do retrato. No clipe wing_show_15002 a junção das duas asas fica em ≈(50,117);
    // (−100,−213) põe essa junção atrás dos ombros do corpo SHOW (ajustado a olho no vestiário).
    // (−126,−303), o (−1,2) do ShowCharacter somado ao registro, deixava a asa acima e à esquerda da cabeça;
    // (−1,2) direto jogava a asa para fora do canvas.
    ctx.translate(-100, -213);
  }
  const result = id ? drawCharacterTimeline(ctx, asset, id, frame, state) : false;
  ctx.restore(); return result;
}
