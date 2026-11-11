/** Partida local (hot-seat) sobre o Match do core, usando a mesma visão do jogo em rede. */
import { BUILDS, Match, MAPS, type Intent } from "@tankclone/core";
import { Controls, MatchView, VIEW_H, VIEW_W } from "./view";

const canvas = document.getElementById("c") as HTMLCanvasElement;
canvas.width = VIEW_W; canvas.height = VIEW_H;
const ctx = canvas.getContext("2d")!;

const players = [
  { id: "A1", team: 1, x: 200, weaponId: "prism", build: "media", facing: 1 as const, look: { appearance: { skin: 2, face: 0, hair: 1, hairColor: 2 }, equipped: { outfit: 0, hat: 1 } } },
  { id: "B1", team: 2, x: 1800, weaponId: "sledge", build: "media", facing: -1 as const, look: { appearance: { skin: 4, face: 3, hair: 5, hairColor: 4 }, equipped: { outfit: 1, hat: 0 } } },
  { id: "A2", team: 1, x: 420, weaponId: "furnace", build: "canhao", facing: 1 as const, look: { appearance: { skin: 0, face: 2, hair: 6, hairColor: 5 }, equipped: { outfit: 3, hat: 3 } } },
  { id: "B2", team: 2, x: 1580, weaponId: "prism", build: "tanque", facing: -1 as const, look: { appearance: { skin: 5, face: 4, hair: 2, hairColor: 0 }, equipped: { outfit: 5, hat: 2 } } },
];

const match = new Match({
  seed: (Date.now() & 0xffff) | 1, terrain: MAPS.planalto!.build(),
  players: players.map(p => ({ id: p.id, team: p.team, x: p.x, weaponId: p.weaponId, facing: p.facing, stats: BUILDS[p.build] })),
});
const view = new MatchView("planalto", players);
view.push(match.startEvents);

const controls = new Controls(view, () => true, i => {
  const o = match.submit({ ...i, playerId: match.currentId } as Intent);
  if (!o.ok) view.ui.msg = o.error; else { view.ui.msg = ""; view.push(o.events); }
});

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (view.canAct) { const t = match.tick(dt); if (t.length) view.push(t); }
  controls.update(dt); view.update(dt);
  view.draw(ctx, null);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
