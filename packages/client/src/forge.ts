/** Ferreiro: fortalecer (+0..+12, Super Pedra) e compor qualquer item da mochila, e comprar pedras com gold. Tudo garantido, sem sorteio.
 * Só envia pedidos; o servidor valida e devolve o estado ({t:"bag"}). Ícones das pedras: public/ui-local/forge (locais). */
import { SHOP_ITEMS, STRENGTHEN_EXP, STRENGTHEN_MAX, SUPER_STONE, SUPER_STONE_EXP, WEAPONS, canCompose, canStrengthen, stonesToNext, strengthenArmor, strengthenedDamage, type ItemInstance, type Look, type ShopItem, type Stats } from "@tankclone/core";
import { drawCharPortrait, drawWardrobePiece } from "./chars";
import { CATEGORY_OF, KIND_LABEL, itemName, lookWith } from "./catalog-ui";

export type BagState = { gold: number; materials: Record<string, number>; items: ItemInstance[]; stats: Stats; result?: string };
type Send = (m: Record<string, unknown>) => void;
const ATTR_PT: Record<string, string> = { atk: "Ataque", def: "Defesa", agi: "Agilidade", luck: "Sorte" };
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
  if (item.kind === "weapon") drawCharPortrait(cv, look, item.level >= 12 ? `${item.ref}:2` : item.level >= 10 ? `${item.ref}:1` : item.ref);
  else { const c = CATEGORY_OF[item.kind]; if (c) drawWardrobePiece(cv, lookWith(look, item), c); }
  return cv;
}
/** Efeito do fortalecimento no item, em texto. */
export function strengthenText(item: ItemInstance): string {
  if (item.kind === "weapon") return `dano-base ${strengthenedDamage(WEAPONS[item.ref]?.baseDamage ?? 0, item.level)} (×1,1 por nível)`;
  if (item.kind === "head" || item.kind === "cloth" || item.kind === "offhand") return `armadura +${strengthenArmor(item.level)}`;
  return "não fortalece";
}

export class Forge {
  private state: BagState | null = null;
  private look: Look | null = null;
  private selected = 0;
  constructor(private host: HTMLElement, private send: Send, private onBack: () => void) {}

  open(look: Look, itemId?: number): void {
    this.look = look; if (itemId) this.selected = itemId;
    this.send({ t: "bag" }); this.render();
  }
  setLook(look: Look) { this.look = look; }
  update(s: BagState): void { this.state = s; this.render(s.result); }

  private render(result?: string): void {
    const h = this.host; h.replaceChildren();
    const panel = el("div", "", "panel forge");
    const head = el("div", "", "row"); head.append(el("h3", "Ferreiro", "title title--lg grow"));
    head.append(el("span", this.state ? `${this.state.gold.toLocaleString("pt-BR")} gold` : "carregando…", "chip"));
    const back = el("button", "Voltar", "btn btn--steel btn--sm"); back.onclick = this.onBack; head.append(back);
    panel.append(head);
    if (result) panel.append(el("div", result, "forge__result"));
    if (!this.state) { h.append(panel); return; }
    const s = this.state, look = this.look!;
    // só entra aqui o que pode evoluir (CN CanStrengthen / CanCompose)
    const list = s.items.filter(i => canStrengthen(i.kind) || canCompose(i.kind));
    const w = list.find(i => i.id === this.selected) ?? list.find(i => i.place === "weapon") ?? list[0];
    if (w) this.selected = w.id;

    const picker = el("div", "", "forge__weapons");
    for (const it of list) {
      const b = el("button", "", "forge__weapon");
      b.setAttribute("aria-pressed", String(it.id === w?.id));
      b.append(itemThumb(it, look, 72, 72), el("b", `${itemName(it, weaponName)} +${it.level}`), el("small", `${KIND_LABEL[it.kind]}${it.place ? " · equipado" : ""}`));
      b.onclick = () => { this.selected = it.id; this.render(); };
      picker.append(b);
    }
    panel.append(picker);

    if (w) {
      const have = s.materials[SUPER_STONE] ?? 0;
      if (canStrengthen(w.kind)) {
        const fort = el("section", "", "paper forge__box");
        fort.append(el("h4", `Fortalecer ${itemName(w, weaponName)} (+${w.level} de +${STRENGTHEN_MAX})`, "title title--sm"));
        if (w.level < STRENGTHEN_MAX) {
          const need = STRENGTHEN_EXP[w.level + 1]!;
          const bar = el("div", "", "bar bar--energy"); bar.style.setProperty("--value", `${(w.exp / need) * 100}%`);
          bar.append(el("span", `${w.exp} / ${need} EXP para o +${w.level + 1}`, "bar__text num")); fort.append(bar);
          fort.append(el("small", `Garantido: cada Super Pedra soma ${SUPER_STONE_EXP} EXP; ao completar a barra o item sobe de nível. Efeito: ${strengthenText(w)}.${w.kind === "weapon" ? " A arma muda de modelo no +10 e no +12." : ""}`, "muted"));
          const stone = SHOP_ITEMS.find(i => i.id === SUPER_STONE)!, row = el("div", "", "row forge__row"), toNext = stonesToNext(w, SUPER_STONE_EXP);
          row.append(stoneIcon(stone), el("span", `Super Pedra · ${SUPER_STONE_EXP} EXP · você tem ${have}`, "grow"));
          const one = el("button", "Usar 1", "btn btn--sm btn--steel"); one.disabled = have < 1;
          one.onclick = () => this.send({ t: "strengthen", itemId: w.id, count: 1 });
          const up = el("button", `Subir de nível (${toNext})`, "btn btn--sm"); up.disabled = have < toNext;
          up.title = have < toNext ? `faltam ${toNext - have} pedras` : "usa exatamente o necessário para o próximo nível";
          up.onclick = () => this.send({ t: "strengthen", itemId: w.id, count: toNext });
          row.append(one, up); fort.append(row);
        } else fort.append(el("p", "Nível máximo (+12).", "muted"));
        panel.append(fort);
      }
      if (canCompose(w.kind)) {
        const comp = el("section", "", "paper forge__box"), c = w.compose;
        comp.append(el("h4", `Composição (garantida): ${itemName(w, weaponName)}`, "title title--sm"),
          el("p", `Atual: ATQ ${c.atk} · DEF ${c.def} · AGI ${c.agi} · SOR ${c.luck} (cada pedra grava o valor dela no atributo)`, "muted"));
        const grid = el("div", "", "forge__grid");
        for (const it of SHOP_ITEMS.filter(i => i.kind === "compose")) {
          const n = s.materials[it.id] ?? 0, b = el("button", "", "forge__stone"); b.disabled = n < 1;
          b.title = `${it.name}: ${ATTR_PT[it.attr!]} = ${it.value} (você tem ${n})`;
          b.append(stoneIcon(it), el("small", `${ATTR_PT[it.attr!]} ${it.value} ×${n}`));
          b.onclick = () => this.send({ t: "compose", itemId: w.id, stone: it.id });
          grid.append(b);
        }
        comp.append(grid); panel.append(comp);
      }
    } else panel.append(el("p", "Você ainda não tem chapéu, roupa nem arma para evoluir. Compre na Loja.", "muted"));

    // loja de materiais
    const shop = el("section", "", "paper forge__box");
    shop.append(el("h4", "Loja de pedras (fase de testes: 1 gold cada)", "title title--sm"));
    const grid = el("div", "", "forge__grid");
    for (const it of SHOP_ITEMS) {
      const card = el("div", "", "forge__stone"); card.append(stoneIcon(it), el("small", `${it.name} ×${s.materials[it.id] ?? 0}`));
      const row = el("div", "", "row");
      for (const n of [1, 10, 100]) {
        const b = el("button", `+${n}`, "btn btn--sm btn--steel"); b.disabled = s.gold < n * it.price;
        b.onclick = () => this.send({ t: "buy", item: it.id, count: n }); row.append(b);
      }
      card.append(row); grid.append(card);
    }
    shop.append(grid); panel.append(shop);
    h.append(panel);
  }
}
