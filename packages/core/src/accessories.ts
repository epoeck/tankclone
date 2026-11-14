/** Cadeias de fusão confirmadas no TemplateAlllist.xml do CN 14.7. Quatro cópias iguais por nível. */
import type { ItemKind } from "./items";

export interface AccessoryTier { ref: string; name: string; kind: "armlet" | "ring"; atk: number; def: number; agi: number; luck: number; icon: string; next?: string }
const tier = (ref: number, name: string, kind: "armlet" | "ring", stats: [number,number,number,number], icon: string, next?: number): AccessoryTier => ({ ref: String(ref), name, kind, atk: stats[0], def: stats[1], agi: stats[2], luck: stats[3], icon, ...(next ? { next: String(next) } : {}) });

// CN 14.7: pulseira 周年白金手链 (+0 a +10) e anel 浪漫之戒 (+0 a +8).
export const ACCESSORIES: readonly AccessoryTier[] = [
  tier(8015,"Pulseira de Aniversário", "armlet",[20,15,15,20],"fiveyearsz0",8115), tier(8115,"Pulseira de Aniversário +1","armlet",[28,22,22,28],"fiveyearsz1",8215), tier(8215,"Pulseira de Aniversário +2","armlet",[38,30,30,38],"fiveyearsz2",8315), tier(8315,"Pulseira de Aniversário +3","armlet",[52,40,40,52],"fiveyearsz3",8415), tier(8415,"Pulseira de Aniversário +4","armlet",[72,54,54,72],"fiveyearsz4",8515), tier(8515,"Pulseira de Aniversário +5","armlet",[99,74,74,99],"fiveyearsz5",85150), tier(85150,"Pulseira de Aniversário +6","armlet",[139,104,104,139],"fiveyearsz6",85151), tier(85151,"Pulseira de Aniversário +7","armlet",[195,146,146,195],"fiveyearsz7",85152), tier(85152,"Pulseira de Aniversário +8","armlet",[273,204,204,273],"fiveyearsz8",85153), tier(85153,"Pulseira de Aniversário +9","armlet",[382,286,286,382],"fiveyearsz8",85154), tier(85154,"Pulseira de Aniversário +10","armlet",[535,400,400,535],"fiveyearsz8"),
  tier(9024,"Anel do Romance","ring",[10,10,10,10],"ring60",9124), tier(9124,"Anel do Romance +1","ring",[14,14,14,14],"ring61",9224), tier(9224,"Anel do Romance +2","ring",[19,19,19,19],"ring62",9324), tier(9324,"Anel do Romance +3","ring",[27,27,27,27],"ring63",9424), tier(9424,"Anel do Romance +4","ring",[38,38,38,38],"ring64",9524), tier(9524,"Anel do Romance +5","ring",[53,53,53,53],"ring65",95240), tier(95240,"Anel do Romance +6","ring",[74,74,74,74],"ring66",95241), tier(95241,"Anel do Romance +7","ring",[104,104,104,104],"ring67",95242), tier(95242,"Anel do Romance +8","ring",[146,146,146,146],"ring68"),
];
export const accessoryByRef = (ref: string) => ACCESSORIES.find(a => a.ref === ref);
export const accessoryByKind = (kind: ItemKind) => ACCESSORIES.filter(a => a.kind === kind);
export function accessoryStats(ref: string) { const a = accessoryByRef(ref); return a ? { atk: a.atk, def: a.def, agi: a.agi, luck: a.luck } : { atk: 0, def: 0, agi: 0, luck: 0 }; }
export const accessoryIconPath = (ref: string) => `/ui-local/accessories/${accessoryByRef(ref)?.icon ?? ""}.png`;
