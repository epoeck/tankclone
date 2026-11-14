/** Ferreiro: fortalecer (+0..+12, Super Pedra) e compor qualquer item da mochila, e comprar pedras com gold. Tudo garantido, sem sorteio.
 * Só envia pedidos; o servidor valida e devolve o estado ({t:"bag"}). Ícones das pedras: public/ui-local/forge (locais). */
import { ACCESSORIES, BASE_ARMOR, SLOT_GEAR, WEAPONS, strengthenArmor, strengthenedDamage, type ItemInstance, type Look, type ShopItem, type Stats } from "@tankclone/core";
import { drawCharPortrait, drawWardrobePiece } from "./chars";
import { renderForgeScene, type ForgeTab } from "./forge-scene";
import { screenVisible } from "./ui/workshop";
import { CATEGORY_OF, SLOT_ICON, lookWith } from "./catalog-ui";

export type BagState = { gold: number; materials: Record<string, number>; items: ItemInstance[]; stats: Stats; result?: string };
type Send = (m: Record<string, unknown>) => void;
export const weaponName = (id: string) => WEAPONS[id]?.name ?? id;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e;
}
export function stoneIcon(item: ShopItem): HTMLElement {
  const img = el("img"); img.src = `/ui-local/forge/${item.icon}.png`; img.alt = ""; img.width = 40; img.height = 40;
  img.onerror = () => { const s = el("span", item.kind === "strengthen" ? "★" : `${item.attr?.toUpperCase()}${item.level}`, "forge__noicon"); img.replaceWith(s); };
  return img;
}
/** Miniatura de um item da mochila (peça do visual ou arma). */
export function itemThumb(item: ItemInstance, look: Look, w = 64, h = 64): HTMLCanvasElement {
  const cv = el("canvas"); cv.width = w; cv.height = h; cv.setAttribute("aria-hidden", "true");
  if (item.kind === "armlet" || item.kind === "ring" || item.kind === "offhand" || item.kind === "pet" || item.kind === "eff" || item.kind === "suits" || item.kind === "necklace" || item.kind === "chatball" || item.kind === "healstone") {
    const a = ACCESSORIES.find(x => x.ref === item.ref), g = SLOT_GEAR.find(x => x.kind === item.kind && x.ref === item.ref);
    const src = a ? `/ui-local/accessories/${a.icon}.png` : g ? SLOT_ICON[g.kind] ?? "" : "";
    if (src) { const img = new Image(); img.onload = () => cv.getContext("2d")?.drawImage(img, 2, 2, w - 4, h - 4); img.src = src; }
    else { const ctx = cv.getContext("2d")!; ctx.fillStyle = "#f1c65a"; ctx.font = `bold ${Math.max(18, Math.round(w * .5))}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(item.kind === "suits" ? "♟" : item.kind === "necklace" ? "◇" : item.kind === "chatball" ? "☁" : item.kind === "healstone" ? "✚" : "✦", w / 2, h / 2); }
  }
  else if (item.kind === "weapon") drawCharPortrait(cv, look, item.level >= 12 ? `${item.ref}:2` : item.level >= 10 ? `${item.ref}:1` : item.ref);
  else { const c = CATEGORY_OF[item.kind]; if (c && ["outfit", "hair", "face", "hat", "glasses", "wings"].includes(c)) drawWardrobePiece(cv, lookWith(look, item), c as "outfit" | "hair" | "face" | "hat" | "glasses" | "wings"); }
  return cv;
}
/** Efeito do fortalecimento no item, em texto. */
export function strengthenText(item: ItemInstance): string {
  if (item.kind === "weapon") return `dano-base ${strengthenedDamage(WEAPONS[item.ref]?.baseDamage ?? 0, item.level)} (×1,1 por nível)`;
  if (item.kind === "head" || item.kind === "cloth") {
    const bonus = strengthenArmor(item.level);
    return `armadura ${BASE_ARMOR + bonus} (${BASE_ARMOR} base + ${bonus} de fortalecimento)`;
  }
  if (item.kind === "offhand") return `Bênção do Anjo: nível +${item.level}; o bônus de cura do CN não é usado no combate atual.`;
  return "não fortalece";
}

export class Forge {
  private state: BagState | null = null;
  private look: Look | null = null;
  private selected = 0;
  private tab: ForgeTab = "strengthen";
  private fusionRecipe: string | null = null;
  private fusionAvailableOnly = false;
  private composeStone: string | null = null;
  private buyItem = "super";
  private buyQuantity = "1";
  private result = "";
  private pending = false;
  private opened = false;
  constructor(private host: HTMLElement, private send: Send, private onBack: () => void) {}

  open(look: Look, itemId?: number): void {
    this.look = look; this.opened = true; if (itemId) this.selected = itemId;
    this.render(); this.send({ t: "bag" });
  }
  setLook(look: Look): void { this.look = look; }
  update(state: BagState): void {
    const wasPending = this.pending; this.state = state; this.pending = false;
    if (this.opened && screenVisible(this.host)) { if (state.result) this.result = state.result; else if (wasPending) this.result = "Operação concluída."; this.render(); }
  }
  fail(message: string): void {
    if (!this.pending) return;
    this.pending = false; this.result = message;
    if (this.opened && screenVisible(this.host)) { this.render(); this.send({ t: "bag" }); }
  }
  private request(message: Record<string, unknown>): void {
    if (this.pending) return;
    this.pending = true; this.result = "Processando…"; this.render(); this.send(message);
  }
  private render(): void {
    if (!this.look) return;
    renderForgeScene({
      host: this.host, state: this.state, look: this.look, selected: this.selected, tab: this.tab,
      fusionRecipe: this.fusionRecipe, fusionAvailableOnly: this.fusionAvailableOnly,
      composeStone: this.composeStone, buyItem: this.buyItem, buyQuantity: this.buyQuantity,
      pending: this.pending, result: this.result,
      onBack: () => { this.opened = false; this.onBack(); },
      send: message => this.request(message),
      select: id => { this.selected = id; this.render(); },
      setTab: tab => { this.tab = tab; this.render(); },
      setFusionAvailableOnly: value => { this.fusionAvailableOnly = value; this.render(); },
      setFusionRecipe: ref => { this.fusionRecipe = ref; this.render(); },
      setComposeStone: id => { this.composeStone = id; this.render(); },
      setBuyItem: id => { this.buyItem = id; this.render(); },
      setBuyQuantity: quantity => { this.buyQuantity = quantity; },
    });
  }
}
