import { ACCESSORIES, SHOP_ITEMS, STRENGTHEN_EXP, STRENGTHEN_MAX, SUPER_STONE, SUPER_STONE_EXP, canCompose, canStrengthen, stonesToNext, type ItemInstance, type Look, type ShopItem } from "@tankclone/core";
import { el, stoneIcon, strengthenText, type BagState } from "./forge";
import { ATTRIBUTES, actionButton, frame, itemIcon, itemLabel, itemPreview, itemStats, panel, replaceView, statList, status } from "./ui/workshop";

export type ForgeTab = "strengthen" | "compose" | "fusion";
type Options = {
  host: HTMLElement; state: BagState | null; look: Look; selected: number; tab: ForgeTab;
  fusionRecipe: string | null; fusionAvailableOnly: boolean; composeStone: string | null;
  buyItem: string; buyQuantity: string; pending: boolean; result: string;
  onBack: () => void; send: (message: Record<string, unknown>) => void;
  select: (id: number) => void; setTab: (tab: ForgeTab) => void;
  setFusionRecipe: (ref: string) => void; setFusionAvailableOnly: (value: boolean) => void;
  setComposeStone: (id: string) => void; setBuyItem: (id: string) => void; setBuyQuantity: (quantity: string) => void;
};
const tabNames: Record<ForgeTab, string> = { strengthen: "Fortalecer", compose: "Compor", fusion: "Fusão" };
function note(parent: HTMLElement, text: string, className = ""): HTMLElement { const out = el("p", text, `workshop-note ${className}`); parent.append(out); return out; }
function empty(parent: HTMLElement, message: string): void { parent.append(el("p", message, "workshop-empty")); }
function availableItems(state: BagState, ref: string): ItemInstance[] { return state.items.filter(item => item.ref === ref && !item.place && (item.kind === "armlet" || item.kind === "ring")); }

export function renderForgeScene(o: Options): void {
  const root = frame("Ferreiro", o.state?.gold, o.onBack); root.classList.add("workshop-forge"); root.dataset.operation = o.tab;
  const layout = el("div", "", "workshop-layout"); root.append(layout);
  const tabs = el("nav", "", "workshop-tabs"); tabs.setAttribute("aria-label", "Operações do ferreiro"); tabs.setAttribute("role", "tablist");
  for (const tab of ["strengthen", "compose", "fusion"] as const) {
    const b = actionButton(tabNames[tab], () => o.setTab(tab), "workshop-tab"); b.setAttribute("role", "tab"); b.setAttribute("aria-label", `Aba ${tabNames[tab]}`); b.setAttribute("aria-selected", String(o.tab === tab)); b.dataset.tab = tab; tabs.append(b);
  }
  layout.append(tabs);
  const body = el("div", "", "workshop-body"); layout.append(body);
  if (!o.state) { empty(body, "Carregando sua mochila…"); status(root, o.result); replaceView(o.host, root); return; }
  const state = o.state;
  const gear = state.items.filter(item => o.tab === "strengthen" ? canStrengthen(item.kind) : canCompose(item.kind));
  const active = gear.find(item => item.id === o.selected) ?? gear.find(item => item.place === "weapon") ?? gear[0];
  const operation = panel(tabNames[o.tab], "workshop-operation"); operation.setAttribute("aria-label", `Operação ${tabNames[o.tab]}`); body.append(operation);
  const inventory = el("aside", "", "workshop-inventory"); body.append(inventory);
  if (o.tab === "fusion") renderFusion();
  else {
    if (active) { itemPreview(operation, active, o.look); itemStats(operation, active); }
    else empty(operation, "Você não possui equipamentos compatíveis. Compre um equipamento na Loja.");
    if (o.tab === "strengthen") renderStrength(active); else renderCompose(active);
    renderGear(); renderMaterials(); renderBuy();
  }
  status(root, o.result, o.pending); replaceView(o.host, root);

  function renderGear(): void {
    const bag = panel("Equipamentos compatíveis"); inventory.append(bag);
    const grid = el("div", "", "workshop-item-grid"); grid.setAttribute("aria-label", "Equipamentos da mochila"); grid.dataset.scrollKey = `equipment-${o.tab}`; bag.append(grid);
    if (!gear.length) empty(bag, "Nenhum equipamento compatível nesta mochila.");
    for (const item of gear) {
      const b = actionButton("", () => o.select(item.id), "workshop-slot workshop-equipment"); b.dataset.itemId = String(item.id); b.title = itemLabel(item); b.setAttribute("aria-label", itemLabel(item)); b.setAttribute("aria-pressed", String(item.id === active?.id));
      b.append(itemIcon(item, o.look, 42));
      if (item.level) b.append(el("span", `+${item.level}`, "workshop-slot-level"));
      if (item.place) b.append(el("span", "E", "workshop-slot-equipped"));
      grid.append(b);
    }
    if (active) note(bag, `${itemLabel(active)}${active.place ? " · equipado" : ""}`, "workshop-selection-name");
  }
  function renderMaterials(): void {
    const bag = panel(o.tab === "compose" ? "Pedras de composição" : "Suas Super Pedras"); inventory.append(bag);
    const grid = el("div", "", "workshop-item-grid workshop-material-grid"); grid.setAttribute("aria-label", "Pedras da mochila"); bag.append(grid);
    for (const stone of SHOP_ITEMS.filter(item => o.tab === "compose" ? item.kind === "compose" : item.id === SUPER_STONE)) {
      const count = state.materials[stone.id] ?? 0;
      const cell = o.tab === "compose" ? actionButton("", () => o.setComposeStone(stone.id), "workshop-slot workshop-material") : el("div", "", "workshop-slot workshop-material");
      cell.dataset.stoneId = stone.id; cell.title = `${stone.name} · ${count} disponíveis`; cell.setAttribute("aria-label", cell.title);
      if (cell instanceof HTMLButtonElement) cell.setAttribute("aria-pressed", String(o.composeStone === stone.id));
      cell.append(stoneIcon(stone), el("span", String(count), "workshop-slot-count")); grid.append(cell);
    }
    if (o.tab === "compose") note(bag, "Selecione uma pedra para ver o novo bônus. A compra fica abaixo.");
  }
  function renderStrength(item: ItemInstance | undefined): void {
    note(operation, "Suba um nível aplicando a quantidade exata de Super Pedras.");
    if (!item) return;
    const max = item.level >= STRENGTHEN_MAX, required = stonesToNext(item, SUPER_STONE_EXP), stock = state.materials[SUPER_STONE] ?? 0;
    const exp = el("div", "", "workshop-exp"); exp.append(el("strong", `Fortalecimento +${item.level}${max ? " · máximo" : ` → +${item.level + 1}`}`));
    if (!max) {
      const next = STRENGTHEN_EXP[item.level + 1]!;
      const bar = el("progress"); bar.max = next; bar.value = item.exp; bar.setAttribute("aria-label", "Experiência de fortalecimento");
      exp.append(bar, el("span", `${item.exp} / ${next} EXP`));
    }
    operation.append(exp);
    note(operation, `Atual: ${strengthenText(item)}.`, "workshop-effect");
    if (!max) {
      note(operation, `Após fortalecer: ${strengthenText({ ...item, level: item.level + 1 })}.`, "workshop-effect");
      const cost = el("div", "", "workshop-requirement"); cost.append(stoneIcon(SHOP_ITEMS.find(i => i.id === SUPER_STONE)!), el("strong", `${required} ${required === 1 ? "Super Pedra" : "Super Pedras"}`), el("span", `+${required * SUPER_STONE_EXP} EXP · você tem ${stock}`)); operation.append(cost);
    }
    const button = actionButton("Fortalecer", () => o.send({ t: "strengthen", itemId: item.id, count: required }), "workshop-button--primary");
    button.disabled = o.pending || max || stock < required; button.dataset.action = "strengthen"; operation.append(button);
    if (!max && stock < required) note(operation, `Faltam ${required - stock} Super Pedras. Compre a quantidade necessária ao lado.`, "workshop-validation");
  }
  function renderCompose(item: ItemInstance | undefined): void {
    note(operation, "A composição consome uma pedra e substitui o bônus desse atributo.");
    const stone = SHOP_ITEMS.find(s => s.id === o.composeStone && s.kind === "compose");
    if (stone) {
      const preview = el("div", "", "workshop-composition-preview"); preview.append(stoneIcon(stone), el("strong", stone.name)); operation.append(preview);
      if (item && stone.attr) {
        const current = item.compose[stone.attr], value = stone.value!;
        const change = el("div", "", "workshop-attribute-change"); change.append(el("span", `Bônus de ${ATTRIBUTES[stone.attr]}`), el("strong", `${current} → ${value}`)); operation.append(change);
        if (value < current) note(operation, "Esta pedra reduz o bônus atual. O valor anterior será substituído.", "workshop-validation");
      }
      note(operation, `Consumo: 1 pedra · você tem ${state.materials[stone.id] ?? 0}.`);
    } else empty(operation, "Selecione uma das 20 pedras na mochila para comparar o bônus.");
    const button = actionButton("Compor", () => { if (item && stone) o.send({ t: "compose", itemId: item.id, stone: stone.id }); }, "workshop-button--primary");
    button.disabled = o.pending || !item || !stone || (state.materials[stone.id] ?? 0) < 1; button.dataset.action = "compose"; operation.append(button);
    if (stone && (state.materials[stone.id] ?? 0) < 1) note(operation, "Você não tem esta pedra. Use a compra de materiais.", "workshop-validation");
  }
  function renderBuy(): void {
    const shop = panel("Comprar materiais", "workshop-shop"); inventory.append(shop);
    const form = el("form", "", "workshop-purchase-form"); shop.append(form);
    const materialLabel = el("label", "Material", "workshop-field");
    const select = el("select"); select.setAttribute("aria-label", "Material para comprar"); select.dataset.focusKey = "buy-material";
    for (const stone of SHOP_ITEMS) { const option = el("option", stone.name); option.value = stone.id; option.selected = stone.id === o.buyItem; select.append(option); }
    select.onchange = () => o.setBuyItem(select.value); materialLabel.append(select); form.append(materialLabel);
    const stone = SHOP_ITEMS.find(item => item.id === o.buyItem) ?? SHOP_ITEMS[0]!;
    const quantityLabel = el("label", "Quantidade", "workshop-field workshop-field--quantity"); const quantity = el("input"); quantity.type = "number"; quantity.min = "1"; quantity.max = "9999"; quantity.step = "1"; quantity.value = o.buyQuantity; quantity.dataset.focusKey = "buy-quantity"; quantity.setAttribute("aria-label", "Quantidade a comprar"); quantityLabel.append(quantity); form.append(quantityLabel);
    const info = el("div", "", "workshop-purchase-info"); info.append(stoneIcon(stone)); const total = el("strong"); info.append(total); form.append(info);
    const feedback = el("p", "", "workshop-purchase-feedback"); form.append(feedback);
    const buy = actionButton("Comprar", () => {}, "workshop-button--buy"); buy.type = "submit"; buy.dataset.action = "buy"; form.append(buy);
    const update = () => {
      const count = Number(quantity.value), valid = Number.isInteger(count) && count >= 1 && count <= 9999;
      total.textContent = valid ? `Total: ${(count * stone.price).toLocaleString("pt-BR")} ouro` : `Preço: ${stone.price} ouro por unidade`;
      feedback.textContent = !valid ? "Informe uma quantidade inteira entre 1 e 9.999." : count * stone.price > state.gold ? "Ouro insuficiente para esta compra." : `${stone.price} ouro por unidade · estoque: ${state.materials[stone.id] ?? 0}`;
      buy.disabled = o.pending || !valid || count * stone.price > state.gold;
    };
    quantity.oninput = () => { o.setBuyQuantity(quantity.value); update(); };
    form.onsubmit = event => { event.preventDefault(); update(); if (!buy.disabled) o.send({ t: "buy", item: stone.id, count: Number(quantity.value) }); };
    update();
  }
  function renderFusion(): void {
    const recipes = ACCESSORIES.filter(recipe => recipe.next);
    const recipe = recipes.find(r => r.ref === o.fusionRecipe) ?? recipes.find(r => availableItems(state, r.ref).length >= 4) ?? recipes[0]!;
    const target = ACCESSORIES.find(r => r.ref === recipe.next)!;
    const free = availableItems(state, recipe.ref);
    note(operation, "Quatro acessórios iguais e livres viram uma peça do próximo nível. Fusão garantida.");
    const flow = el("div", "", "workshop-fusion-preview");
    const input = el("div"); const inputIcon = el("div", "", "workshop-slot workshop-slot--large"); const inPic = el("img"); inPic.src = `/ui-local/accessories/${recipe.icon}.png`; inPic.alt = ""; inputIcon.append(inPic); input.append(inputIcon, el("span", "4×"), el("strong", recipe.name));
    const output = el("div"); const outputIcon = el("div", "", "workshop-slot workshop-slot--large"); const outPic = el("img"); outPic.src = `/ui-local/accessories/${target.icon}.png`; outPic.alt = ""; outputIcon.append(outPic); output.append(outputIcon, el("span", "1×"), el("strong", target.name));
    flow.append(input, el("span", "→", "workshop-fusion-arrow"), output); operation.append(flow);
    operation.append(el("h3", "Atributos da nova peça", "workshop-subtitle")); statList(operation, { atk: target.atk, def: target.def, agi: target.agi, luck: target.luck });
    note(operation, `${free.length}/4 cópias livres · custo: 0 ouro.`, "workshop-fusion-availability");
    note(operation, "A composição e o fortalecimento das peças usadas são reiniciados na nova peça.");
    const button = actionButton("Fundir", () => { if (free.length >= 4) o.send({ t: "fuse", itemIds: free.slice(0, 4).map(item => item.id) }); }, "workshop-button--primary"); button.disabled = o.pending || free.length < 4; button.dataset.action = "fuse"; operation.append(button);
    if (free.length < 4) note(operation, `Faltam ${4 - free.length} cópias livres deste acessório.`, "workshop-validation");
    const listPanel = panel("Receitas de acessórios"); inventory.append(listPanel);
    const filterLabel = el("label", "", "workshop-filter"); const filter = el("input"); filter.type = "checkbox"; filter.checked = o.fusionAvailableOnly; filter.setAttribute("aria-label", "Mostrar apenas receitas disponíveis"); filter.onchange = () => o.setFusionAvailableOnly(filter.checked); filterLabel.append(filter, el("span", "Só receitas disponíveis")); listPanel.append(filterLabel);
    const list = el("div", "", "workshop-recipes"); list.dataset.scrollKey = "recipes"; list.setAttribute("aria-label", "Receitas de fusão"); listPanel.append(list);
    const visible = recipes.filter(entry => !o.fusionAvailableOnly || availableItems(state, entry.ref).length >= 4);
    if (!visible.length) empty(list, "Nenhuma receita tem quatro cópias livres. Desmarque o filtro para ver todas.");
    for (const entry of visible) {
      const reward = ACCESSORIES.find(r => r.ref === entry.next)!, count = availableItems(state, entry.ref).length;
      const row = actionButton("", () => o.setFusionRecipe(entry.ref), "workshop-recipe"); row.dataset.recipe = entry.ref; row.setAttribute("aria-label", `Receita ${reward.name}`); row.setAttribute("aria-pressed", String(recipe.ref === entry.ref));
      const icon = el("img"); icon.src = `/ui-local/accessories/${reward.icon}.png`; icon.alt = "";
      const description = el("span"); description.append(el("strong", reward.name), el("small", `Usa 4× ${entry.name}`));
      row.append(icon, description, el("span", `${count}/4`, "workshop-recipe-count")); list.append(row);
    }
  }
}
