/** Regras da mochila no servidor: Look derivado do que está equipado, equipamento para a partida e painel de atributos. */
import { BASE_ARMOR, BUILDS, DEFAULT_BUILD, WEAPONS, accessoryStats, slotGear, strengthenedDamage, own, sanitizeLook, strengthenArmor, type ItemInstance, type Look, type Stats } from "@tankclone/core";
import { equippedStats } from "./rooms";

export interface Gear { weaponId: string; weaponLevel: number; compose: { atk: number; def: number; agi: number; luck: number }; armorBonus: number; hpBonus: number }

/** O Look mostra o que está vestido; cores (`tints`, pele, cor do cabelo) e sexo continuam os do Look salvo. */
export function deriveLook(base: Look, items: ItemInstance[]): Look {
  const eq = (k: string) => items.find(i => i.kind === k && i.place && (!i.sex || i.sex === base.appearance.sex));
  const n = (k: string) => { const r = eq(k); return r ? Number(r.ref) || 0 : 0; };
  return sanitizeLook({ ...base, appearance: { ...base.appearance, face: n("face"), hair: n("hair") },
    equipped: { outfit: n("cloth"), hat: n("head"), glasses: n("glass"), wings: n("wing") } });
}

/** Atributos que o equipamento vestido leva para a partida: arma, composição de cada peça e armadura do fortalecimento. */
export function gearOf(items: ItemInstance[]): Gear {
  const worn = items.filter(i => i.place), w = worn.find(i => i.kind === "weapon");
  const compose = { atk: 0, def: 0, agi: 0, luck: 0 };
  let hpBonus = 0;
  for (const i of worn) for (const k of Object.keys(compose) as Array<keyof typeof compose>) compose[k] += i.compose[k] + (i.kind === "armlet" || i.kind === "ring" ? accessoryStats(i.ref)[k] : slotGear(i.kind, i.ref)?.[k] ?? 0);
  if (w && WEAPONS[w.ref]) for (const k of Object.keys(compose) as Array<keyof typeof compose>) compose[k] += WEAPONS[w.ref]!.stats[k];
  for (const i of worn) hpBonus += slotGear(i.kind, i.ref)?.hp ?? 0;
  const armorBonus = worn.filter(i => i.kind === "head" || i.kind === "cloth").reduce((s, i) => s + BASE_ARMOR + strengthenArmor(i.level), 0);
  return { weaponId: w?.ref ?? "sledge", weaponLevel: w?.level ?? 0, compose, armorBonus, hpBonus };
}

/** Painel de atributos da mochila (build padrão + peças + composição + fortalecimento). */
export function statsPanel(look: Look, items: ItemInstance[]): Stats {
  const g = gearOf(items), s = equippedStats(DEFAULT_BUILD, look, g.compose, g.armorBonus);
  return { ...(own(BUILDS, DEFAULT_BUILD) ?? s), ...s, hp: s.hp + g.hpBonus, damage: strengthenedDamage(WEAPONS[g.weaponId]?.baseDamage ?? 0, g.weaponLevel) };
}
