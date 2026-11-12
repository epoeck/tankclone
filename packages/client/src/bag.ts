/** Mochila original (aba Equipar do bagAndInfo): slots em duas colunas de cada lado do personagem, grade de itens à direita
 * (abas Equipamentos e Itens), tooltip, duplo clique/arrastar para equipar e painel de atributos. O servidor decide tudo. */
import { SHOP_ITEMS, STRENGTHEN_MAX, OWNABLE_KINDS, canCompose, canStrengthen, type ItemInstance, type ItemKind, type Look } from "@tankclone/core";
import { drawCharPortrait } from "./chars";
import { KIND_LABEL, itemBaseStats, itemName } from "./catalog-ui";
import { el, itemThumb, stoneIcon, strengthenText, weaponName, type BagState } from "./forge";

type Send = (m: Record<string, unknown>) => void;
/** Pares de slots (esquerda e direita) na ordem do Place do original; `null` = lugar sem item nesta versão. */
const LEFT: Array<[ItemKind, ItemKind]> = [["head", "glass"], ["hair", "eff"], ["cloth", "face"], ["weapon", "offhand"]];
const RIGHT: Array<[ItemKind, ItemKind | null]> = [["armlet", null], ["ring", null], ["suits", "necklace"], ["wing", null]];
const OPTIONAL: ItemKind[] = ["head", "glass", "wing"];

export class Bag {
  private state: BagState | null = null;
  private look: Look | null = null;
  private tab: "equip" | "items" = "equip";
  private selected = 0;
  constructor(private host: HTMLElement, private send: Send, private onBack: () => void, private openShop: () => void, private openForge: (itemId?: number) => void) {}

  open(look: Look): void { this.look = look; this.send({ t: "bag" }); this.render(); }
  setLook(look: Look) { this.look = look; if (this.state) this.render(); }
  update(s: BagState): void { this.state = s; this.render(); }

  private equipped(kind: ItemKind): ItemInstance | undefined { return this.state?.items.find(i => i.kind === kind && i.place); }
  private pick(id: number) { this.selected = id; this.render(); }
  private toggle(it: ItemInstance) {
    if (!it.place) this.send({ t: "equip", itemId: it.id });
    else this.send({ t: "unequip", place: it.kind });
  }

  private slot(kind: ItemKind | null): HTMLElement {
    const b = el("div", "", "bag__slot"); if (!kind) { b.classList.add("bag__slot--off"); return b; }
    const it = this.equipped(kind), usable = (OWNABLE_KINDS as readonly string[]).includes(kind);
    b.title = usable ? KIND_LABEL[kind] : `${KIND_LABEL[kind]}: ainda sem arte nesta versão`;
    b.dataset.kind = kind; if (!usable) b.classList.add("bag__slot--off");
    if (it) {
      b.append(itemThumb(it, this.look!, 52, 52));
      if (it.level) b.append(el("em", `+${it.level}`, "bag__lvl"));
      b.classList.toggle("bag__slot--picked", it.id === this.selected);
      b.draggable = true; b.ondragstart = e => e.dataTransfer?.setData("text/plain", `item:${it.id}`);
      b.onclick = () => this.pick(it.id); b.ondblclick = () => this.toggle(it);
    } else b.append(el("small", KIND_LABEL[kind], "bag__slot-name"));
    if (usable) {
      b.ondragover = e => e.preventDefault();
      b.ondrop = e => { e.preventDefault(); const id = Number(e.dataTransfer?.getData("text/plain").replace("item:", "")); const dragged = this.state!.items.find(i => i.id === id); if (dragged && dragged.kind === kind && !dragged.place) this.toggle(dragged); };
    }
    return b;
  }

  private render(): void {
    const h = this.host; h.replaceChildren();
    const panel = el("div", "", "panel bag");
    const head = el("div", "", "row"); head.append(el("h3", "Mochila", "title title--lg grow"));
    head.append(el("span", this.state ? `${this.state.gold.toLocaleString("pt-BR")} gold` : "carregando…", "chip"));
    const shop = el("button", "Loja", "btn btn--sm"); shop.onclick = this.openShop;
    const forge = el("button", "Ferreiro", "btn btn--sm"); forge.onclick = () => this.openForge(this.selected || undefined);
    const back = el("button", "Voltar", "btn btn--steel btn--sm"); back.onclick = this.onBack;
    head.append(shop, forge, back); panel.append(head);
    if (!this.state || !this.look) { h.append(panel); return; }
    const s = this.state;
    if (s.result) panel.append(el("div", s.result, "forge__result"));
    const body = el("div", "", "bag__body"); panel.append(body);

    // personagem com slots dos dois lados
    const left = el("div", "", "bag__side");
    for (const [a, b] of LEFT) left.append(this.slot(a), this.slot(b));
    const right = el("div", "", "bag__side");
    for (const [a, b] of RIGHT) right.append(this.slot(a), this.slot(b));
    const stage = el("div", "", "bag__stage"); const cv = el("canvas"); cv.width = 250; cv.height = 330; cv.setAttribute("role", "img"); cv.setAttribute("aria-label", "Personagem com o equipamento vestido");
    const w = this.equipped("weapon");
    drawCharPortrait(cv, this.look, w ? (w.level >= 12 ? `${w.ref}:2` : w.level >= 10 ? `${w.ref}:1` : w.ref) : "sledge");
    stage.append(cv);
    const stats = el("dl", "", "bag__stats"), st = s.stats;
    for (const [name, v] of [["ATQ", st.atk], ["DEF", st.def], ["AGI", st.agi], ["SOR", st.luck], ["Vida", st.hp], ["Armadura", st.armor], ["Dano", st.damage]] as const) {
      stats.append(el("dt", name), el("dd", String(v)));
    }
    const character = el("section", "", "bag__character");
    const row = el("div", "", "bag__equip"); row.append(left, stage, right);
    character.append(row, stats);
    // soltar um item equipado na grade desequipa
    character.ondragover = e => e.preventDefault();

    // grade (direita)
    const grid = el("section", "", "bag__inventory");
    const tabs = el("div", "", "wardrobe__filters");
    for (const [id, label] of [["equip", "Equipamentos"], ["items", "Itens"]] as const) {
      const t = el("button", label, "wardrobe__filter"); t.type = "button"; t.setAttribute("aria-pressed", String(this.tab === id));
      t.onclick = () => { this.tab = id; this.render(); }; tabs.append(t);
    }
    grid.append(tabs);
    const cells = el("div", "", "bag__grid");
    cells.ondragover = e => e.preventDefault();
    cells.ondrop = e => { e.preventDefault(); const id = Number(e.dataTransfer?.getData("text/plain").replace("item:", "")); const it = s.items.find(i => i.id === id); if (it?.place) this.toggle(it); };
    if (this.tab === "equip") {
      const bag = s.items.filter(i => !i.place);
      for (const it of bag) {
        const c = el("button", "", "bag__cell"); c.type = "button"; c.setAttribute("aria-pressed", String(it.id === this.selected));
        c.title = `${itemName(it, weaponName)}${it.level ? ` +${it.level}` : ""} (duplo clique para equipar)`;
        c.append(itemThumb(it, this.look, 56, 56)); if (it.level) c.append(el("em", `+${it.level}`, "bag__lvl"));
        c.draggable = true; c.ondragstart = e => e.dataTransfer?.setData("text/plain", `item:${it.id}`);
        c.onclick = () => this.pick(it.id); c.ondblclick = () => this.toggle(it);
        cells.append(c);
      }
      if (!bag.length) cells.append(el("p", "Mochila vazia. Compre peças na Loja.", "wardrobe__empty"));
    } else {
      for (const it of SHOP_ITEMS) {
        const n = s.materials[it.id] ?? 0; if (!n) continue;
        const c = el("div", "", "bag__cell bag__cell--stone"); c.title = it.name; c.append(stoneIcon(it), el("em", `×${n}`, "bag__lvl"), el("small", it.name));
        cells.append(c);
      }
      if (!cells.children.length) cells.append(el("p", "Sem pedras. Compre Super Pedras e pedras de composição na Loja.", "wardrobe__empty"));
    }
    grid.append(cells, this.tooltip());
    body.append(character, grid);
    h.append(panel);
  }

  private tooltip(): HTMLElement {
    const box = el("div", "", "bag__tip"); const it = this.state!.items.find(i => i.id === this.selected);
    if (!it) { box.append(el("p", "Selecione um item para ver os detalhes.", "muted")); return box; }
    box.append(el("b", `${itemName(it, weaponName)}${it.level ? ` +${it.level}` : ""}`), el("span", `${KIND_LABEL[it.kind]}${it.place ? " · equipado" : ""}`, "muted"));
    const base = itemBaseStats(it), c = it.compose;
    if (base && (base.atk || base.def || base.agi || base.luck)) box.append(el("span", `Atributos base: ATQ +${base.atk} · DEF +${base.def} · AGI +${base.agi} · SOR +${base.luck}`));
    if (c.atk || c.def || c.agi || c.luck) box.append(el("span", `Composição: ATQ ${c.atk} · DEF ${c.def} · AGI ${c.agi} · SOR ${c.luck}`));
    if (canStrengthen(it.kind)) box.append(el("span", `Fortalecimento +${it.level}/${STRENGTHEN_MAX}: ${strengthenText(it)}`));
    else box.append(el("span", "Não fortalece.", "muted"));
    if (!canCompose(it.kind)) box.append(el("span", "Não recebe composição.", "muted"));
    const actions = el("div", "", "row");
    const usable = (OWNABLE_KINDS as readonly string[]).includes(it.kind);
    const eq = el("button", it.place ? "Retirar" : "Equipar", "btn btn--sm"); eq.disabled = !usable || (!!it.place && !OPTIONAL.includes(it.kind));
    eq.onclick = () => this.toggle(it); actions.append(eq);
    if (canStrengthen(it.kind) || canCompose(it.kind)) { const f = el("button", "Ferreiro", "btn btn--sm btn--steel"); f.onclick = () => this.openForge(it.id); actions.append(f); }
    box.append(actions);
    return box;
  }
}
