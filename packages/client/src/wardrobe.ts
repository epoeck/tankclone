import { lookStats, HAIR_COLORS, HAIR_ORIGINAL, PIECE_COLORS, SKIN_TONES, sanitizeLook, type ItemInstance, type Look } from "@tankclone/core";
import { drawCharPortrait, drawWardrobePiece } from "./chars";

import { CATEGORIES, KIND_OF, LEGACY_PIECES, pieces, type Category, type Piece } from "./catalog-ui";
const PAGE_SIZE = 12;
const same = (a: Look, b: Look) => JSON.stringify(a) === JSON.stringify(b);
/** O que a loja salva: sexo, pele, cor do cabelo e tinturas. As peças experimentadas são só prévia (comprar põe na mochila). */
const coreOf = (l: Look) => JSON.stringify({ sex: l.appearance.sex, skin: l.appearance.skin, hairColor: l.appearance.hairColor, tints: l.tints });
const value = (look: Look, c: Category) => c === "hair" || c === "face" ? look.appearance[c] : look.equipped[c];
function equip(look: Look, c: Category, index: number) {
  if (c === "hair" || c === "face") look.appearance[c] = index;
  else look.equipped[c] = index;
}
const button = (text: string, cls: string) => {
  const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = text; return b;
};
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

/** A prévia é um rascunho: só authOk confirma que o servidor salvou o visual. */
export class Wardrobe {
  private saved!: Look;
  private draft!: Look;
  private pending: Look | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private category: Category | "all" = "all";
  private selected = LEGACY_PIECES[0]!;
  private showAll = false;
  private get pieces() { return pieces(this.draft.appearance.sex); }
  private page = 0;
  private weaponId = "sledge";
  private leave: (() => void) | null = null;
  private active = false;
  private statusText = "";

  private owned: ItemInstance[] = [];
  constructor(private host: HTMLElement, private save: (look: Look) => boolean, private buy: (m: Record<string, unknown>) => boolean) {
    host.innerHTML = `
      <div class="panel wardrobe">
        <header class="wardrobe__header">
          <div><span class="label">Seu personagem</span><h1 class="title title--lg">Loja</h1></div>
          <span class="wardrobe__section">Vestuário · 1 gold cada na fase de testes</span>
          <button type="button" class="btn btn--steel btn--sm" data-back>Voltar</button>
        </header>
        <div class="wardrobe__body">
          <section class="wardrobe__character" aria-label="Prévia do visual">
            <div class="wardrobe__identity"><b data-nick></b><span data-preview-label>Visual salvo</span></div>
            <div class="wardrobe__stage"><div class="wardrobe__halo"></div>
              <canvas data-portrait width="250" height="330" role="img" aria-label="Prévia do personagem com as peças experimentadas"></canvas>
              <span class="wardrobe__pedestal"></span>
            </div>
            <div class="wardrobe__slots" aria-label="Peças em uso na prévia" data-slots></div>
            <details class="wardrobe__appearance" open>
              <summary>Aparência e cores</summary>
              <div class="wardrobe__sex" role="group" aria-label="Avatar" data-sex></div>
              <div class="wardrobe__palette"><span>Pele</span><div role="group" aria-label="Tom de pele" data-skin></div></div>
              <div class="wardrobe__palette"><span>Cabelo</span><div role="group" aria-label="Cor do cabelo" data-hair-color></div></div>
            </details>
          </section>
          <section class="wardrobe__inventory" aria-label="Peças disponíveis">
            <div class="wardrobe__inventory-head"><h2>Vestuário à venda</h2><span data-count></span></div>
            <div class="wardrobe__filters" role="group" aria-label="Categorias de vestuário" data-categories></div>
            <label class="wardrobe__search"><span class="label">Buscar peça</span>
              <input type="search" placeholder="Nome da peça…" aria-label="Buscar peça pelo nome" maxlength="80" data-search>
            </label>
            <label class="wardrobe__availability"><input type="checkbox" data-show-all> Mostrar todos os recursos, inclusive incompletos</label>
            <div class="wardrobe__grid" data-grid></div>
            <div class="wardrobe__pagination"><button type="button" data-prev aria-label="Página anterior">←</button>
              <span data-page></span><button type="button" data-next aria-label="Próxima página">→</button></div>
            <div class="wardrobe__detail" data-detail></div>
          </section>
        </div>
        <footer class="wardrobe__footer">
          <p data-status role="status" aria-live="polite"></p>
          <div><button type="button" class="btn btn--steel btn--sm" data-reset>Desfazer</button>
            <button type="button" class="btn btn--ember" data-save>Salvar cores</button></div>
        </footer>
      </div>
      <dialog class="wardrobe__dialog">
        <h2>Descartar as cores?</h2><p>As cores e a aparência que você mudou ainda não foram salvas.</p>
        <div><button type="button" class="btn btn--steel btn--sm" data-continue>Continuar editando</button>
          <button type="button" class="btn btn--ember btn--sm" data-discard>Descartar e sair</button></div>
      </dialog>`;
    this.get<HTMLInputElement>("search").oninput = () => { this.page = 0; this.renderInventory(); };
    this.get<HTMLInputElement>("show-all").onchange = e => { this.showAll = (e.target as HTMLInputElement).checked; this.page = 0; this.renderInventory(); };
    this.get("prev").onclick = () => { this.page--; this.renderInventory(); };
    this.get("next").onclick = () => { this.page++; this.renderInventory(); };
    this.get("save").onclick = () => this.commit();
    this.get("reset").onclick = () => { this.draft = structuredClone(this.saved); this.statusText = ""; this.render(); };
    this.get("continue").onclick = () => this.dialog.close();
    this.get("discard").onclick = () => { this.dialog.close(); this.finishClose(); };
  }

  private get<T extends HTMLElement = HTMLElement>(name: string): T { return this.host.querySelector<T>(`[data-${name}]`)!; }
  private get dialog() { return this.host.querySelector("dialog")!; }
  private get dirty() { return coreOf(this.draft) !== coreOf(this.saved); }
  private get trying() { return !same(this.draft, this.saved); }
  /** Mochila atualizada pelo servidor: marca na loja o que você já tem. */
  setItems(items: ItemInstance[]) { this.owned = items; if (this.active) this.renderInventory(); }
  private count(p: Piece) { return this.owned.filter(i => i.kind === KIND_OF[p.category] && (Number(i.ref) || 0) === p.index && (!i.sex || i.sex === this.draft.appearance.sex)).length; }

  open(look: Look, nick: string, back: () => void, weaponId = "sledge") {
    this.clearPending();
    this.active = true; this.leave = back; this.weaponId = weaponId;
    this.saved = sanitizeLook(look); this.draft = sanitizeLook(look);
    this.category = "all"; this.page = 0; this.statusText = ""; this.showAll = false; this.get<HTMLInputElement>("show-all").checked = false;
    this.selected = this.pieces.find(p => p.category === "outfit" && p.index === look.equipped.outfit)!;
    this.get<HTMLInputElement>("search").value = "";
    this.get("nick").textContent = nick;
    this.get("back").onclick = () => {
      if (this.pending) return;
      if (this.dirty) this.dialog.showModal(); else this.finishClose();
    };
    this.render();
  }

  /** Chamado após o perfil confirmado pelo servidor; não altera a conta por conta própria. */
  confirm(look: Look) {
    if (!this.active) return;
    look = sanitizeLook(look);
    const wasDirty = this.dirty;
    const wasPending = !!this.pending;
    // Uma resposta atrasada de outro salvamento não confirma o rascunho atual.
    const matchesPending = this.pending && coreOf(this.pending) === coreOf(look);
    this.saved = structuredClone(look);
    if (wasPending && !matchesPending) { this.render(); return; }
    if (matchesPending || !wasDirty) this.draft = structuredClone(look);
    this.clearPending();
    this.statusText = wasPending ? "Cores salvas na sua conta." : "";
    this.render();
  }

  fail(message: string) {
    if (!this.active || !this.pending) return;
    this.clearPending(); this.statusText = message; this.render();
  }

  disconnect() {
    this.active = false; this.clearPending(); this.dialog.close();
  }

  private finishClose() { this.active = false; this.leave?.(); }
  private clearPending() { clearTimeout(this.timer); this.pending = null; }
  private mutate(change: (look: Look) => void) {
    if (this.pending) return;
    change(this.draft); this.statusText = ""; this.render();
  }
  private commit() {
    if (this.pending || !this.dirty) return;
    this.pending = structuredClone(this.draft);
    if (!this.save(structuredClone(this.pending))) { this.fail("Sem conexão. Seu visual ainda não foi salvo."); return; }
    this.timer = setTimeout(() => this.fail("O servidor não confirmou o salvamento. Tente novamente."), 10000);
    this.render();
  }

  private render() {
    drawCharPortrait(this.get<HTMLCanvasElement>("portrait"), this.draft, this.weaponId);
    this.get("preview-label").textContent = this.trying ? "Experimentando" : "Visual vestido";
    this.renderSlots(); this.renderAppearance(); this.renderCategories(); this.renderInventory();
    this.get("status").textContent = this.pending ? "Salvando visual…" : this.statusText ||
      (this.dirty ? "Você tem cores para salvar." : this.trying ? "Experimentando: compre para levar à mochila." : "Experimente as peças; comprar leva à mochila.");
    this.get<HTMLButtonElement>("save").disabled = !!this.pending || !this.dirty;
    this.get<HTMLButtonElement>("reset").disabled = !!this.pending || !this.trying;
    this.get<HTMLButtonElement>("back").disabled = !!this.pending;
    this.host.toggleAttribute("data-saving", !!this.pending);
  }

  private renderSlots() {
    const slots = this.get("slots"); slots.replaceChildren();
    for (const c of CATEGORIES) {
      const current = this.pieces.find(p => p.category === c.id && p.index === value(this.draft, c.id));
      const b = button("", "wardrobe__slot");
      b.setAttribute("aria-label", `${c.singular}: ${current?.name ?? "sem peça"}. Ver ${c.label.toLowerCase()}`);
      b.setAttribute("aria-pressed", String(this.category === c.id)); b.disabled = !!this.pending;
      const label = document.createElement("span"); label.textContent = c.singular;
      const title = document.createElement("b"); title.textContent = current?.name ?? "Sem peça";
      b.append(label, title);
      b.onclick = () => { this.category = c.id; this.page = 0; this.get<HTMLInputElement>("search").value = "";
        this.selected = current ?? this.pieces.find(p => p.category === c.id)!; this.render(); };
      slots.append(b);
    }
  }

  private renderAppearance() {
    const sex = this.get("sex"); sex.replaceChildren();
    for (const [id, name] of [["m", "Masculino"], ["f", "Feminino"]] as const) {
      const b = button(name, "wardrobe__toggle"); b.setAttribute("aria-pressed", String(this.draft.appearance.sex === id));
      b.disabled = !!this.pending; b.onclick = () => this.mutate(l => { l.appearance.sex = id; Object.assign(l, sanitizeLook(l)); }); sex.append(b);
    }
    for (const [host, colors, key, label] of [
      ["skin", SKIN_TONES, "skin", "Tom de pele"], ["hair-color", HAIR_COLORS, "hairColor", "Cor do cabelo"],
    ] as const) {
      const palette = this.get(host); palette.replaceChildren();
      if (key === "hairColor") { // cor original da arte do cabelo (sem tintura)
        const b = button("Original", "wardrobe__toggle"); b.title = "Cor original do cabelo";
        b.setAttribute("aria-pressed", String(this.draft.appearance.hairColor === HAIR_ORIGINAL)); b.disabled = !!this.pending;
        b.onclick = () => this.mutate(l => { l.appearance.hairColor = HAIR_ORIGINAL; }); palette.append(b);
      }
      colors.forEach((color, index) => {
        const b = button("", "wardrobe__swatch"); b.style.setProperty("--swatch", color);
        b.setAttribute("aria-label", `${label} ${index + 1}`); b.title = `${label} ${index + 1}`;
        b.setAttribute("aria-pressed", String(this.draft.appearance[key] === index)); b.disabled = !!this.pending;
        b.onclick = () => this.mutate(l => { l.appearance[key] = index; }); palette.append(b);
      });
    }
  }

  private renderCategories() {
    const host = this.get("categories"); host.replaceChildren();
    for (const c of [{ id: "all", label: "Tudo" }, ...CATEGORIES]) {
      const b = button(c.label, "wardrobe__filter"); b.setAttribute("aria-pressed", String(c.id === this.category));
      b.onclick = () => {
        this.category = c.id as Category | "all"; this.page = 0;
        if (this.category !== "all" && this.selected.category !== this.category) this.selected = this.pieces.find(p => p.category === this.category)!;
        this.renderCategories(); this.renderSlots(); this.renderInventory();
      };
      host.append(b);
    }
  }

  private renderInventory() {
    const query = fold(this.get<HTMLInputElement>("search").value.trim());
    const list = this.pieces.filter(p => (this.showAll || p.complete) && (this.category === "all" || p.category === this.category) && fold(p.name).includes(query));
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); this.page = Math.max(0, Math.min(this.page, pages - 1));
    this.get("count").textContent = `${list.length} ${list.length === 1 ? "peça" : "peças"}`;
    const grid = this.get("grid"); grid.replaceChildren();
    const visible = list.slice(this.page * PAGE_SIZE, (this.page + 1) * PAGE_SIZE);
    if (!visible.some(p => p.id === this.selected.id) && visible.length) this.selected = visible[0]!;
    for (const piece of visible) {
      const worn = value(this.draft, piece.category) === piece.index;
      const b = button("", "wardrobe__item"); b.dataset.item = piece.id;
      b.setAttribute("aria-pressed", String(this.selected.id === piece.id));
      b.setAttribute("aria-label", `${piece.name}${worn ? ", em uso na prévia" : ""}`);
      const image = piece.complete ? document.createElement("canvas") : document.createElement("img");
      image.width = 148; image.height = 112; image.setAttribute("aria-hidden", "true");
      if (image instanceof HTMLCanvasElement) {
        const thumbLook = structuredClone(this.draft); equip(thumbLook, piece.category, piece.index);
        drawWardrobePiece(image, thumbLook, piece.category);
      } else if (piece.icon) image.src = `/assets/avatar/${piece.icon}`;
      const title = document.createElement("span"); title.textContent = piece.name;
      const badge = document.createElement("small"); const own = this.count(piece); badge.textContent = worn ? "Experimentando" : own ? `Você tem ${own}` : piece.complete ? "1 gold" : "Incompleta";
      b.append(image, title, badge);
      b.onclick = () => {
        this.selected = piece;
        // Mantém o botão e o foco: permite selecionar pelo teclado e experimentar com duplo clique.
        for (const item of grid.querySelectorAll<HTMLButtonElement>("[data-item]")) {
          item.setAttribute("aria-pressed", String(item.dataset.item === piece.id));
        }
        this.renderDetail(true);
      };
      b.ondblclick = () => { if (piece.complete) this.mutate(l => equip(l, piece.category, piece.index)); };
      b.disabled = !!this.pending; grid.append(b);
    }
    if (!list.length) { const empty = document.createElement("p"); empty.className = "wardrobe__empty";
      empty.textContent = "Nenhuma peça encontrada. Tente outro nome ou categoria."; grid.append(empty); }
    this.get("page").textContent = `Página ${this.page + 1} de ${pages}`;
    this.get<HTMLButtonElement>("prev").disabled = this.page === 0;
    this.get<HTMLButtonElement>("next").disabled = this.page >= pages - 1;
    this.renderDetail(list.length > 0);
  }

  private renderDetail(hasItems: boolean) {
    const host = this.get("detail"); host.replaceChildren();
    if (!hasItems) return;
    const p = this.selected, c = CATEGORIES.find(c => c.id === p.category)!;
    const text = document.createElement("div"), name = document.createElement("b"), desc = document.createElement("span");
    const st = p.stats, bonus = st && (st.atk || st.def || st.agi || st.luck) ? `Ataque +${st.atk} · Defesa +${st.def} · Agilidade +${st.agi} · Sorte +${st.luck}` : "sem bônus de atributos";
    const total = lookStats(this.draft);
    name.textContent = p.name; desc.textContent = p.complete ? `${c.singular} · ${bonus} · Total vestido: ATQ ${total.atk} DEF ${total.def} AGI ${total.agi} SOR ${total.luck}` : `${c.singular} · Recursos GAME/SHOW incompletos ou incompatíveis; não equipável`;
    text.append(name, desc); host.append(text);
    const worn = value(this.draft, p.category) === p.index;
    const bought = this.count(p);
    const purchase = button(`Comprar (1 gold)${bought ? ` · você tem ${bought}` : ""}`, "btn btn--ember btn--sm"); purchase.disabled = !p.complete || !!this.pending;
    purchase.onclick = () => { if (!this.buy({ t: "buy", catalogKind: KIND_OF[p.category], ref: String(p.index), sex: this.draft.appearance.sex })) this.statusText = "Sem conexão."; };
    host.append(purchase);
    const tryOn = button(worn ? "Experimentando" : "Experimentar", "btn btn--steel btn--sm"); tryOn.disabled = worn || !p.complete || !!this.pending;
    tryOn.onclick = () => this.mutate(l => equip(l, p.category, p.index)); host.append(tryOn);
    if (p.category === "outfit" || p.category === "face" || p.category === "hat") {
      const category = p.category;
      const palette = document.createElement("div"); palette.className = "wardrobe__piece-palette";
      const label = document.createElement("span");
      label.textContent = `${category === "face" ? "Cor dos olhos" : category === "outfit" ? "Cor da roupa" : "Cor do chapéu"} · ${p.name}${worn ? "" : " (experimente a peça para tingir)"}`;
      palette.append(label);
      const choices = document.createElement("div"); choices.setAttribute("role", "group"); choices.setAttribute("aria-label", label.textContent);
      const key = `${this.draft.appearance.sex}:${p.index}`;
      const selected = this.draft.tints?.[category][key] ?? this.draft.tints?.[category][p.index] ?? -1;
      for (let index = -1; index < PIECE_COLORS.length; index++) {
        const color = index < 0 ? "Original" : `Cor ${index + 1}`;
        const b = button(index < 0 ? "Original" : "", index < 0 ? "wardrobe__toggle" : "wardrobe__swatch");
        if (index >= 0) b.style.setProperty("--swatch", PIECE_COLORS[index]!);
        b.title = color; b.setAttribute("aria-label", `${label.textContent}: ${color}`);
        b.setAttribute("aria-pressed", String(selected === index)); b.disabled = !worn || !!this.pending;
        b.onclick = () => this.mutate(l => { if (index < 0) { delete l.tints![category][key]; delete l.tints![category][p.index]; } else l.tints![category][key] = index; }); choices.append(b);
      }
      palette.append(choices); host.append(palette);
    }
    if (c.optional && worn) {
      const remove = button("Tirar da prévia", "btn btn--steel btn--sm"); remove.disabled = !!this.pending;
      remove.onclick = () => this.mutate(l => equip(l, p.category, 0)); host.append(remove);
    }
  }
}
