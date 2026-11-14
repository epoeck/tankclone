/** Owned pets, real attributes and the inventory equip/unequip actions. */
import { itemName } from "./catalog-ui";
import { el, weaponName, type BagState } from "./forge";
import { actionButton, frame, itemIcon, itemPreview, itemStats, panel, replaceView, screenVisible, status } from "./ui/workshop";

type Send = (message: Record<string, unknown>) => void;
export class Pets {
  private state: BagState | null = null;
  private selectedId = 0;
  private result = "";
  private pending = false;
  private pendingSuccess = "";
  private opened = false;
  constructor(private host: HTMLElement, private send: Send, private onBack: () => void) {}
  open(): void { this.opened = true; this.render(); this.send({ t: "bag" }); }
  update(state: BagState): void {
    const wasPending = this.pending; this.state = state; this.pending = false;
    const pets = state.items.filter(item => item.kind === "pet");
    if (!pets.some(item => item.id === this.selectedId)) this.selectedId = pets.find(item => item.place === "pet")?.id ?? pets[0]?.id ?? 0;
    if (this.opened && screenVisible(this.host)) { if (state.result) this.result = state.result; else if (wasPending) this.result = this.pendingSuccess; this.render(); }
  }
  fail(message: string): void {
    if (!this.pending) return;
    this.pending = false; this.result = message;
    if (this.opened && screenVisible(this.host)) { this.render(); this.send({ t: "bag" }); }
  }
  private render(): void {
    const root = frame("Pets", this.state?.gold, () => { this.opened = false; this.onBack(); }, "COMPANHEIROS"); root.classList.add("workshop-pets");
    if (!this.state) { root.append(el("p", "Carregando seus pets…", "workshop-empty")); status(root, this.result); replaceView(this.host, root); return; }
    const pets = this.state.items.filter(item => item.kind === "pet");
    const pet = pets.find(item => item.id === this.selectedId) ?? pets.find(item => item.place === "pet") ?? pets[0];
    const body = el("div", "", "workshop-pets-body"); root.append(body);
    const roster = panel(`Seus pets (${pets.length})`, "workshop-pet-roster"); body.append(roster);
    const list = el("div", "", "workshop-pet-list"); list.setAttribute("aria-label", "Pets possuídos"); list.dataset.scrollKey = "pets"; roster.append(list);
    pets.forEach((entry, index) => {
      const row = actionButton("", () => { this.selectedId = entry.id; this.render(); }, "workshop-pet-row");
      row.dataset.petId = String(entry.id); row.setAttribute("aria-label", `Selecionar ${itemName(entry, weaponName)} ${index + 1}`); row.setAttribute("aria-pressed", String(entry.id === pet?.id));
      const caption = el("span"); caption.append(el("strong", itemName(entry, weaponName)), el("small", entry.place === "pet" ? "Equipado" : "Na mochila"));
      row.append(itemIcon(entry, undefined, 48), caption); list.append(row);
    });
    const detail = panel(pet ? "Seu companheiro" : "Sua coleção começa aqui", "workshop-pet-detail"); body.append(detail);
    if (pet) {
      itemPreview(detail, pet); detail.append(el("p", pet.place === "pet" ? "Este pet está equipado e seus atributos entram no total do personagem." : "Equipe este pet para usar seus atributos no personagem.", "workshop-note"));
      itemStats(detail, pet);
      const equip = actionButton(pet.place === "pet" ? "Retirar pet" : "Equipar pet", () => {
        if (this.pending) return;
        this.pending = true; this.pendingSuccess = pet.place === "pet" ? "Pet retirado." : "Pet equipado."; this.result = "Processando…"; this.render();
        this.send(pet.place === "pet" ? { t: "unequip", place: "pet" } : { t: "equip", itemId: pet.id, place: "pet" });
      }, "workshop-button--primary"); equip.disabled = this.pending; equip.dataset.action = pet.place === "pet" ? "unequip-pet" : "equip-pet"; detail.append(equip);
    } else {
      list.append(el("p", "Nenhum pet na mochila.", "workshop-empty"));
      detail.append(el("p", "Você ainda não possui pets. Eles podem ser comprados na Loja; volte ao saguão para abrir a Loja.", "workshop-empty"));
    }
    status(root, this.result || (pet ? "Selecione um pet para equipar ou retirar." : ""), this.pending); replaceView(this.host, root);
  }
}
