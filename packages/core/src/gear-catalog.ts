/** Itens únicos para ocupar os lugares ainda sem o sistema inteiro de equipamento/pets. Atributos vêm do CN 14.7. */
export const SLOT_GEAR = [
  { kind: "eff", ref: "4102", name: "Tribo", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "eff1" },
  { kind: "suits", ref: "13101", name: "Traje padrão", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "default" },
  { kind: "necklace", ref: "14058", name: "Cisne ao Luar", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "necklace15" },
  { kind: "offhand", ref: "17000", name: "Bênção do Anjo", atk: 40, def: 40, agi: 40, luck: 40, hp: 0, icon: "offhand6" },
  // Pet CN de nível 1: loadpetfightproperty_out.xml, ID 1. Os atributos máximos do template não são concedidos ao comprar.
  { kind: "pet", ref: "100101", name: "Pintinho", atk: 1, def: 1, agi: 1, luck: 1, hp: 0, icon: "chicken" },
] as const;
export type SlotGear = typeof SLOT_GEAR[number];
export const slotGear = (kind: string, ref: string) => SLOT_GEAR.find(g => g.kind === kind && g.ref === ref);
