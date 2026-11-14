/** Itens únicos para ocupar os lugares ainda sem o sistema inteiro de equipamento/pets. Atributos vêm do CN 14.7. */
export const SLOT_GEAR = [
  { kind: "eff", ref: "4102", name: "Tribo", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "eff1" },
  { kind: "suits", ref: "13101", name: "Traje padrão", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "default" },
  { kind: "necklace", ref: "14058", name: "Cisne ao Luar", atk: 5, def: 5, agi: 5, luck: 5, hp: 0, icon: "necklace15" },
  { kind: "offhand", ref: "17000", name: "Bênção do Anjo", atk: 40, def: 40, agi: 40, luck: 40, hp: 0, icon: "offhand6" },
  // Pet CN de nível 1: loadpetfightproperty_out.xml, ID 1. Os atributos máximos do template não são concedidos ao comprar.
  { kind: "pet", ref: "100101", name: "Pintinho", atk: 1, def: 1, agi: 1, luck: 1, hp: 0, icon: "chicken" },
  // Balão de chat (CN categoria 16, 聊天泡泡): ícone specialprop/chatball/chatball1; os atributos 70 são os do template.
  { kind: "chatball", ref: "16001", name: "Nuvem Colorida", atk: 0, def: 0, agi: 0, luck: 0, hp: 0, icon: "chatBall1" }, // TemplateAlllist.xml atual (2024): 0; o _out.xml antigo (2018) tinha 70
  // Pedra de cura (categoria 19): no CN 14.7 é item sem efeito ("无效道具"); só ocupa o lugar 18.
  { kind: "healstone", ref: "315001", name: "Pedra de Cura Nv1", atk: 0, def: 0, agi: 0, luck: 0, hp: 0, icon: "recover1" },
] as const;
export type SlotGear = typeof SLOT_GEAR[number];
export const slotGear = (kind: string, ref: string) => SLOT_GEAR.find(g => g.kind === kind && g.ref === ref);
/** Descrição curta do efeito especial (além dos atributos) de cada item de lugar; mostrada na mochila. */
export const SLOT_GEAR_NOTE: Record<string, string> = {
  "healstone:315001": "Sem efeito: no CN 14.7 este item é marcado como inválido.",
  "chatball:16001": "Cosmético: balão de chat.",
};
