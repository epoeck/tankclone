/** UI de partida do Reborn como placeholder local (public/ui-local, fora do git; gerada por scripts/import-reborn-ui.py).
 * Sem os arquivos, cada função devolve false e quem chama usa o visual próprio do jogo. */
import { drawCharacterTimeline, loadCharacterTimeline, type TimelineAsset } from "./character-timeline";

type Group = "game" | "gameii" | "gameover";
const libs: Partial<Record<Group, TimelineAsset>> = {};
if (typeof Image !== "undefined") for (const g of ["game", "gameii", "gameover"] as const) {
  void loadCharacterTimeline(`/ui-local/${g}`).then(a => { libs[g] = a; }).catch(() => { /* sem assets locais */ });
}

/** Quadros por segundo das bibliotecas exportadas (24 no original). */
export const UI_FPS = 24;
export function uiReady(group: Group): boolean { return !!libs[group]; }
export function classFrames(group: Group, cls: string): number {
  const a = libs[group], id = a?.library.classes[cls]?.id;
  return id === undefined ? 0 : a!.library.chars[id]?.tl?.n ?? 1;
}
/** Desenha um símbolo exportado no quadro `frame` (laço quando passa do fim). */
export function drawClass(ctx: CanvasRenderingContext2D, group: Group, cls: string, frame = 0): boolean {
  const a = libs[group], id = a?.library.classes[cls]?.id;
  return id !== undefined && drawCharacterTimeline(ctx, a!, id, Math.max(0, Math.floor(frame)));
}
/** Desenha um filho nomeado (instância `nm`) de um símbolo, no próprio quadro dele, com a matriz de posição do pai. */
export function drawNamedChild(ctx: CanvasRenderingContext2D, group: Group, cls: string, name: string, frame: number): boolean {
  const a = libs[group], id = a?.library.classes[cls]?.id; if (id === undefined) return false;
  const parent = a!.library.chars[id] as unknown as { tl?: { f: Array<Array<{ id?: number; nm?: string; m?: number[] }>> } };
  const p = parent.tl?.f[0]?.find(x => x.nm === name); if (!p?.id) return false;
  ctx.save(); const m = p.m ?? [1, 0, 0, 1, 0, 0]; ctx.transform(m[0]!, m[1]!, m[2]!, m[3]!, m[4]!, m[5]!);
  const n = a!.library.chars[p.id]?.tl?.n ?? 1;
  const ok = drawCharacterTimeline(ctx, a!, p.id, 0, Math.min(n - 1, Math.max(0, Math.floor(frame))));
  ctx.restore(); return ok;
}

/** Ícones originais dos itens (1–8, F), do POW e do especial. */
export const PROP_ICON = (key: string) => `/ui-local/props/${key.toLowerCase()}.png`;
const icons = new Map<string, HTMLImageElement>();
export function propIcon(key: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = icons.get(key);
  if (!img) { img = new Image(); img.src = PROP_ICON(key); icons.set(key, img); }
  return img.complete && img.naturalWidth ? img : null;
}

/** AutoPropEffect: o ícone do item aparece sobre a cabeça (−5,−140 do jogador; 60×60, deslocado −20), pisca e some.
 * `age` sobe 0,2 por quadro (25 fps no original). */
export function autoPropAlpha(seconds: number): number | null {
  const age = seconds * 25 * 0.2;
  if (age <= 1) return age;
  if (age < 4) return 1;
  if (age < 5) return Math.max(0.2, 5 - age);
  if (age <= 8) return 1;
  const a = 5 - age; return a < 0.2 ? null : a;
}
