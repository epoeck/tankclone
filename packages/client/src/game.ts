/** Partida local (hot-seat) sobre o Match do core, usando a mesma visão do jogo em rede. */
import { BUILDS, Match, MAPS, WEAPONS, sanitizeLook, type Intent } from "@tankclone/core";
import { loadClientMaps } from "./maps";
import { Hud } from "./hud";
import { Controls } from "./controls";
import { MatchView, VIEW_H, VIEW_W } from "./view";

const canvas = document.getElementById("c") as HTMLCanvasElement;
canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext("2d")!;

async function main() {
  await loadClientMaps();
  const mapId = new URLSearchParams(location.search).get("map") ?? (MAPS.ferro ? "ferro" : "planalto");
  const map = MAPS[mapId] ?? MAPS.planalto!;
  const S1 = map.spawns!["1"], S2 = map.spawns!["2"];
  const players = [
    { id: "A1", team: 1, x: S1[0]!, weaponId: "prism", build: "equipamento", facing: 1 as const, look: sanitizeLook({ appearance: { skin: 2, face: 0, hair: 1, hairColor: 2 }, equipped: { outfit: 0, hat: 1 } }) },
    { id: "B1", team: 2, x: S2[0]!, weaponId: "sledge", build: "equipamento", facing: -1 as const, look: sanitizeLook({ appearance: { skin: 4, face: 3, hair: 1, hairColor: 4 }, equipped: { outfit: 1, hat: 0 } }) },
    { id: "A2", team: 1, x: S1[1]!, weaponId: "furnace", build: "equipamento", facing: 1 as const, look: sanitizeLook({ appearance: { skin: 0, face: 2, hair: 2, hairColor: 5 }, equipped: { outfit: 2, hat: 2, wings: 1 } }) },
    { id: "B2", team: 2, x: S2[1]!, weaponId: "prism", build: "equipamento", facing: -1 as const, look: sanitizeLook({ appearance: { skin: 5, face: 4, hair: 0, hairColor: 0 }, equipped: { outfit: 1, hat: 1, glasses: 1 } }) },
  ];

  const equipped = players.map(p => ({ ...p, spawnY: map.spawnsY?.[p.team === 1 ? "1" : "2"]?.[p.id.endsWith("1") ? 0 : 1], stats: { ...BUILDS[p.build]!, ...WEAPONS[p.weaponId]!.stats } }));
  const match = new Match({
    seed: (Date.now() & 0xffff) | 1, terrain: map.build(), config: { windMultiplier: map.windMultiplier ?? 1 },
    players: equipped.map(p => ({ id: p.id, team: p.team, x: p.x, spawnY: p.spawnY, weaponId: p.weaponId, facing: p.facing, stats: p.stats })),
  });
  const view = new MatchView(mapId, equipped);
  view.push(match.startEvents);

  const hud = new Hud(document.getElementById("hud")!, view, () => null, k => { if (view.canAct) controls.send({ type: "item", key: k }); }, () => { if (view.canAct) controls.send({ type: "pass" }); });
  const controls = new Controls(view, () => true, i => {
    const o = match.submit({ ...i, playerId: match.currentId } as Intent);
    if (!o.ok) view.ui.msg = o.error; else { view.ui.msg = ""; view.push(o.events); }
  });

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (view.canAct) { const t = match.tick(dt); if (t.length) view.push(t); }
    controls.update(dt); view.update(dt);
    view.draw(ctx, null); hud.update();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

}
void main();
