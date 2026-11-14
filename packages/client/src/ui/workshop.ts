import { ACCESSORIES, SLOT_GEAR, type ItemInstance, type Look } from "@tankclone/core";
import { CATEGORY_OF, SLOT_ICON, itemBaseStats, itemIndex, itemName, pieces } from "../catalog-ui";
import { el, itemThumb, weaponName } from "../forge";

export const ATTRIBUTES = { atk: "Ataque", def: "Defesa", agi: "Agilidade", luck: "Sorte" } as const;
export const formatGold = (value: number) => value.toLocaleString("pt-BR");
export const itemLabel = (item: ItemInstance) => `${itemName(item, weaponName)}${item.level ? ` · +${item.level}` : ""}`;
export function actionButton(text: string, onClick: () => void, className = ""): HTMLButtonElement {
  const button = el("button", text, `workshop-button ${className}`); button.type = "button"; button.onclick = onClick; return button;
}
export function frame(title: string, gold: number | undefined, back: () => void, eyebrow = "OFICINA"): HTMLElement {
  const root = el("section", "", "workshop-window"); root.setAttribute("aria-label", title);
  const header = el("header", "", "workshop-header");
  const heading = el("div", "", "workshop-heading"); heading.append(el("span", eyebrow, "workshop-eyebrow"), el("h1", title));
  const controls = el("div", "", "workshop-header-actions");
  const balance = el("span", gold === undefined ? "Carregando ouro…" : `${formatGold(gold)} ouro`, "workshop-gold"); balance.dataset.testid = "workshop-gold";
  controls.append(balance, actionButton("Voltar", back, "workshop-button--quiet")); header.append(heading, controls); root.append(header); return root;
}
export function panel(title: string, className = ""): HTMLElement {
  const root = el("section", "", `workshop-panel ${className}`); root.append(el("h2", title, "workshop-panel-title")); return root;
}
export function status(root: HTMLElement, message: string, pending = false): void {
  const line = el("div", message || "Selecione os itens para continuar.", "workshop-status"); line.setAttribute("role", "status"); line.setAttribute("aria-live", "polite"); line.dataset.pending = String(pending); root.append(line);
}
export function itemIcon(item: ItemInstance, look?: Look, size = 48): HTMLElement {
  const accessory = ACCESSORIES.find(a => a.kind === item.kind && a.ref === item.ref);
  const category = CATEGORY_OF[item.kind];
  const arm = ({ sledge: "brick", prism: "bomb", furnace: "bombpack" } as Record<string, string>)[item.ref];
  let src = item.kind === "weapon" && arm ? item.level < 10 ? `/ui-local/forge/weapon-${arm}.png` : `/assets/avatar/arm/${arm}${item.level >= 12 ? 3 : 2}/1/icon.png` : "";
  if (!src && accessory) src = `/ui-local/accessories/${accessory.icon}.png`;
  if (!src && SLOT_GEAR.some(g => g.kind === item.kind && g.ref === item.ref)) src = SLOT_ICON[item.kind] ?? "";
  if (!src && category) src = pieces(item.sex === "f" ? "f" : "m").find(p => p.category === category && p.index === itemIndex(item))?.icon ?? "";
  if (src) { const img = el("img", "", "workshop-item-icon"); img.src = src; img.alt = ""; img.width = size; img.height = size; img.draggable = false; return img; }
  if (look) { const canvas = itemThumb(item, look, size * 3, size * 3); canvas.className = "workshop-item-icon"; canvas.style.width = `${size}px`; canvas.style.height = `${size}px`; return canvas; }
  return el("span", "◇", "workshop-item-icon workshop-item-icon--fallback");
}
export function itemPreview(parent: HTMLElement, item: ItemInstance, look?: Look): void {
  const preview = el("div", "", "workshop-item-preview");
  const slot = el("div", "", "workshop-slot workshop-slot--large"); slot.append(itemIcon(item, look, 72));
  const name = el("div", "", "workshop-item-description"); name.append(el("h3", itemLabel(item)), el("span", item.place ? "Equipado" : "Na mochila", "workshop-item-location"));
  preview.append(slot, name); parent.append(preview);
}
export function itemStats(parent: HTMLElement, item: ItemInstance): void {
  const base = itemBaseStats(item);
  statList(parent, Object.fromEntries(Object.entries(ATTRIBUTES).map(([key]) => [key, (base?.[key as keyof typeof ATTRIBUTES] ?? 0) + (item.compose[key as keyof typeof ATTRIBUTES] ?? 0)])));
}
export function statList(parent: HTMLElement, values: Record<string, number>): void {
  const list = el("dl", "", "workshop-stats");
  for (const [key, label] of Object.entries(ATTRIBUTES)) { const row = el("div"); row.append(el("dt", label), el("dd", String(values[key] ?? 0))); list.append(row); }
  parent.append(list);
}
/** Preserve text input focus and list scroll when a server response refreshes the view. */
export function replaceView(host: HTMLElement, next: HTMLElement): void {
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement && host.contains(active) ? active.dataset.focusKey : undefined;
  const scroll = new Map(Array.from(host.querySelectorAll<HTMLElement>("[data-scroll-key]"), node => [node.dataset.scrollKey, node.scrollTop]));
  host.replaceChildren(next);
  for (const node of host.querySelectorAll<HTMLElement>("[data-scroll-key]")) node.scrollTop = scroll.get(node.dataset.scrollKey) ?? 0;
  if (focusKey) host.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)?.focus({ preventScroll: true });
}
export const screenVisible = (host: HTMLElement) => host.id.startsWith("s-") ? host.classList.contains("on") : !host.hidden;
