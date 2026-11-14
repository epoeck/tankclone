import list from "./reference/cn147-wings.json";

/** Asas extras do CN 14.7: só a lista (pasta e nome). Os SWF ficam locais em vestuario-local/ e nunca vão ao git. */
export const CN147_WINGS: readonly { pic: string; templateId: number; name: string }[] = list;
/** Índice 0 = sem asa, 1 = wing002 (Reborn), 2.. = CN147_WINGS[n - 2]. */
export const WING_COUNT = 2 + CN147_WINGS.length;
export function cn147Wing(index: number) { return index >= 2 ? CN147_WINGS[index - 2] : undefined; }
/** Pasta pública da timeline convertida (library.json); gerada por scripts/convert-cn147-wings.mts. */
export function wingLibraryPath(index: number): string | null {
  if (index === 1) return "/character-effects/wing";
  const w = cn147Wing(index); return w ? `/vestuario-local/cn147/wing-lib/${w.pic}` : null;
}
/** Ícone usado na miniatura do vestiário e como asa reserva enquanto a timeline não carrega. */
export function wingIcon(index: number): string | null {
  const w = cn147Wing(index); return w ? `../../vestuario-local/cn147/wing/${w.pic}/icon.png` : null;
}
