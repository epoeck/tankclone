/** Ferreiro e loja: fortalecer +0..+12 (garantido, por EXP das pedras), composição (garantida) e compra de pedras com gold.
 * Só envia pedidos; o servidor valida e devolve o estado ({t:"forge"}). Ícones das pedras: public/ui-local/forge (locais). */
import { SHOP_ITEMS, STRENGTHEN_EXP, STRENGTHEN_MAX, WEAPONS, shopItem, stonesToNext, strengthenedDamage, weaponStage, type ShopItem, type WeaponState } from "@tankclone/core";
import { drawCharPortrait } from "./chars";
import type { Look } from "@tankclone/core";

type State = { gold: number; inventory: Record<string, number>; weapons: Record<string, WeaponState> };
type Send = (m: Record<string, unknown>) => void;
const ATTR_PT: Record<string, string> = { atk: "Ataque", def: "Defesa", agi: "Agilidade", luck: "Sorte" };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = "", cls = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e;
}
function icon(item: ShopItem): HTMLElement {
  const img = el("img"); img.src = `/ui-local/forge/${item.icon}.png`; img.alt = ""; img.width = 40; img.height = 40;
  img.onerror = () => { const s = el("span", item.kind === "strengthen" ? `★${item.level}` : `${item.attr?.toUpperCase()}${item.level}`, "forge__noicon"); img.replaceWith(s); };
  return img;
}

export class Forge {
  private state: State | null = null;
  private weaponId = "sledge";
  private look: Look | null = null;
  constructor(private host: HTMLElement, private send: Send, private onBack: () => void) {}

  open(look: Look, weaponId?: string): void {
    this.look = look; if (weaponId && WEAPONS[weaponId]) this.weaponId = weaponId;
    this.send({ t: "forge" }); this.render();
  }
  update(s: State & { result?: string }): void { this.state = s; this.render(s.result); }

  private render(result?: string): void {
    const h = this.host; h.replaceChildren();
    const panel = el("div", "", "panel forge");
    const head = el("div", "", "row"); head.append(el("h3", "Ferreiro", "title title--lg grow"));
    head.append(el("span", this.state ? `${this.state.gold.toLocaleString("pt-BR")} gold` : "carregando…", "chip"));
    const back = el("button", "Voltar", "btn btn--steel btn--sm"); back.onclick = this.onBack; head.append(back);
    panel.append(head);
    if (result) panel.append(el("div", result, "forge__result"));
    if (!this.state) { h.append(panel); return; }
    const s = this.state, w = s.weapons[this.weaponId]!;

    // armas
    const weapons = el("div", "", "forge__weapons");
    for (const id of Object.keys(WEAPONS)) {
      const st = s.weapons[id]!, b = el("button", "", "forge__weapon");
      b.setAttribute("aria-pressed", String(id === this.weaponId));
      const cv = el("canvas"); cv.width = 72; cv.height = 96;
      if (this.look) drawCharPortrait(cv, this.look, weaponStage(st.level) ? `${id}:${weaponStage(st.level)}` : id);
      b.append(cv, el("b", `${WEAPONS[id]!.name} +${st.level}`), el("small", `dano-base ${strengthenedDamage(WEAPONS[id]!.baseDamage, st.level)}`));
      b.onclick = () => { this.weaponId = id; this.render(); };
      weapons.append(b);
    }
    panel.append(weapons);

    // fortalecer
    const fort = el("section", "", "paper forge__box");
    fort.append(el("h4", `Fortalecer ${WEAPONS[this.weaponId]!.name} (+${w.level} de +${STRENGTHEN_MAX})`, "title title--sm"));
    if (w.level < STRENGTHEN_MAX) {
      const need = STRENGTHEN_EXP[w.level + 1]!;
      const bar = el("div", "", "bar bar--energy"); bar.style.setProperty("--value", `${(w.exp / need) * 100}%`);
      bar.append(el("span", `${w.exp} / ${need} EXP para o +${w.level + 1}`, "bar__text num")); fort.append(bar);
      fort.append(el("small", "Garantido: cada pedra soma EXP fixa; ao completar a barra a arma sobe de nível. A arma muda de modelo no +10 e no +12.", "muted"));
      for (const it of SHOP_ITEMS.filter(i => i.kind === "strengthen")) {
        const have = s.inventory[it.id] ?? 0, row = el("div", "", "row forge__row");
        const toNext = stonesToNext(w, it.exp!);
        row.append(icon(it), el("span", `${it.name} · ${it.exp} EXP · você tem ${have}`, "grow"));
        const one = el("button", "Usar 1", "btn btn--sm btn--steel"); one.disabled = have < 1;
        one.onclick = () => this.send({ t: "strengthen", weaponId: this.weaponId, item: it.id, count: 1 });
        const up = el("button", `Subir de nível (${toNext})`, "btn btn--sm"); up.disabled = have < toNext;
        up.title = have < toNext ? `faltam ${toNext - have} pedras` : "usa exatamente o necessário para o próximo nível";
        up.onclick = () => this.send({ t: "strengthen", weaponId: this.weaponId, item: it.id, count: toNext });
        row.append(one, up); fort.append(row);
      }
    } else fort.append(el("p", "Nível máximo (+12).", "muted"));
    panel.append(fort);

    // composição
    const comp = el("section", "", "paper forge__box");
    const c = w.compose;
    comp.append(el("h4", "Composição (garantida)", "title title--sm"),
      el("p", `Atual: ATQ ${c.atk} · DEF ${c.def} · AGI ${c.agi} · SOR ${c.luck} (cada pedra grava o valor dela no atributo)`, "muted"));
    const grid = el("div", "", "forge__grid");
    for (const it of SHOP_ITEMS.filter(i => i.kind === "compose")) {
      const have = s.inventory[it.id] ?? 0, b = el("button", "", "forge__stone"); b.disabled = have < 1;
      b.title = `${it.name}: ${ATTR_PT[it.attr!]} = ${it.value} (você tem ${have})`;
      b.append(icon(it), el("small", `${ATTR_PT[it.attr!]} ${it.value} ×${have}`));
      b.onclick = () => this.send({ t: "compose", weaponId: this.weaponId, item: it.id });
      grid.append(b);
    }
    comp.append(grid); panel.append(comp);

    // loja
    const shop = el("section", "", "paper forge__box");
    shop.append(el("h4", "Loja de recursos (fase de testes: 1 gold cada)", "title title--sm"));
    const list = el("div", "", "forge__grid");
    for (const it of SHOP_ITEMS) {
      const card = el("div", "", "forge__stone"); card.append(icon(it), el("small", it.name));
      const row = el("div", "", "row");
      for (const n of [1, 10, 100]) {
        const b = el("button", `+${n}`, "btn btn--sm btn--steel"); b.disabled = s.gold < n * it.price;
        b.onclick = () => this.send({ t: "buy", item: it.id, count: n }); row.append(b);
      }
      card.append(row); list.append(card);
    }
    shop.append(list); panel.append(shop);
    h.append(panel);
  }
}
export { shopItem };
