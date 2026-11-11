/**
 * Visão da partida: aplica os EVENTOS do core (nunca re-simula física) e desenha no canvas.
 * Serve ao jogo local (game.ts) e ao jogo em rede (play.ts). O cliente só anima o que o core/servidor decidiu.
 */
import { drawDoll } from "./doll";
import {
  BUILDS, DEFAULT_LOOK, ITEMS, MAPS, PLAYER_HITBOX, Terrain, WEAPONS, clampAbsoluteAngle, own,
  type Facing, type ItemKey, type Look, type MatchEvent,
} from "@tankclone/core";

export interface PlayerInfo { id: string; team: number; weaponId: string; build: string; x: number; facing: Facing; look?: Look }

export interface CharView {
  id: string; team: number; weaponId: string; x: number; y: number; hp: number; maxHp: number;
  fury: number; alive: boolean; facing: Facing; energy: number; maxEnergy: number; look: Look; walk: number;
}

export const VIEW_W = 1000, VIEW_H = 600;
const TEAM = { 1: { color: "#6aa7ff" }, 2: { color: "#ff8a6a" } } as const;
export class MatchView {
  readonly terrain: Terrain;
  readonly chars = new Map<string, CharView>();
  readonly order: string[] = [];
  hud = { wind: 0, turn: 0, player: "", timeLimit: 10, timeLeft: 10, over: false, winner: null as number | null };
  ui = { angle: 45, power: 0, special: false, msg: "", turnBonus: 0, extraShots: 0, triple: false, fly: false };
  private tc: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private queue: MatchEvent[] = [];
  private anim: { points: Array<{ x: number; y: number }>; i: number } | null = null;
  private cam = 0;
  readonly width: number; readonly height: number;

  constructor(readonly mapId: string, players: PlayerInfo[]) {
    this.terrain = own(MAPS, mapId)!.build();
    this.width = this.terrain.width; this.height = this.terrain.height;
    this.tc = document.createElement("canvas"); this.tc.width = this.width; this.tc.height = this.height;
    this.tctx = this.tc.getContext("2d")!;
    this.paintTerrain();
    for (const p of players) {
      const st = own(BUILDS, p.build) ?? BUILDS.media!;
      const y = this.terrain.surfaceY(p.x, 0);
      const maxEnergy = 240 + Math.floor(st.agi / 30);
      this.chars.set(p.id, { id: p.id, team: p.team, weaponId: p.weaponId, x: p.x, y, hp: st.hp, maxHp: st.hp, fury: 0, alive: true, facing: p.facing, energy: maxEnergy, maxEnergy, look: p.look ?? DEFAULT_LOOK, walk: 0 });
      this.order.push(p.id);
    }
  }

  private paintTerrain() {
    const img = this.tctx.createImageData(this.width, this.height), m = this.terrain.getMask();
    for (let i = 0; i < m.length; i++) {
      if (!m[i]) continue;
      img.data.set(m[i] === 2 ? [90, 90, 105, 255] : [74, 98, 58, 255], i * 4);
    }
    this.tctx.putImageData(img, 0, 0);
  }

  get busy(): boolean { return !!this.anim || this.queue.length > 0; }
  push(events: MatchEvent[]): void { this.queue.push(...events); }
  get current(): CharView | undefined { return this.chars.get(this.hud.player); }

  private apply(e: MatchEvent): void {
    const v = "playerId" in e ? this.chars.get(e.playerId) : undefined;
    switch (e.type) {
      case "turnStart": {
        this.hud.wind = e.wind; this.hud.turn = e.turn; this.hud.player = e.playerId; this.hud.timeLimit = e.timeLimit; this.hud.timeLeft = e.timeLimit;
        if (v) { v.energy = e.energy; v.maxEnergy = Math.max(v.maxEnergy, e.energy); this.ui.angle = Math.max(this.ui.angle, 0); }
        this.ui.power = 0; this.ui.special = false; this.ui.turnBonus = 0; this.ui.extraShots = 0; this.ui.triple = false; this.ui.fly = false;
        break;
      }
      case "move": if (v) { const p = e.path[e.path.length - 1]; if (p) { v.x = p.x; v.y = p.y; } v.energy = e.energyLeft; if (e.path.length) { const a = e.path[0]!; if (p) v.facing = (p.x >= a.x ? 1 : -1) as Facing; } v.walk += 0.9; } break;
      case "fall": if (v) v.y = e.toY; break;
      case "fly": if (v) { v.x = e.x; v.y = e.y; } break;
      case "item": {
        if (v) v.energy = e.energyLeft;
        const d = own(ITEMS, e.key); if (!d) break;
        this.ui.turnBonus += d.damageBonus ?? 0; this.ui.extraShots += d.extraShots ?? 0; this.ui.triple ||= !!d.triple; this.ui.fly ||= !!d.fly;
        break;
      }
      case "crater": {
        this.terrain.carveCircle(e.x, e.y, e.radius); // mesma operação determinística do core, só para desenhar e medir o chão
        this.tctx.globalCompositeOperation = "destination-out"; this.tctx.beginPath(); this.tctx.arc(e.x, e.y, e.radius, 0, 7); this.tctx.fill(); this.tctx.globalCompositeOperation = "source-over";
        break;
      }
      case "damage": if (v) v.hp = e.hp; break;
      case "fury": if (v) v.fury = e.fury; break;
      case "death": if (v) v.alive = false; break;
      case "gameOver": this.hud.over = true; this.hud.winner = e.winnerTeam; break;
      case "shot": this.anim = { points: e.points, i: 0 }; break;
      case "turnEnd": break;
    }
  }

  /** Avança animações e o relógio exibido (o relógio de verdade é do core/servidor). */
  update(dt: number): void {
    if (this.anim) { this.anim.i += Math.max(1, Math.round((900 * dt) / 8)); if (this.anim.i >= this.anim.points.length) this.anim = null; }
    while (!this.anim && this.queue.length) { const e = this.queue.shift()!; this.apply(e); if (e.type === "shot") break; }
    if (!this.busy && !this.hud.over) this.hud.timeLeft = Math.max(0, this.hud.timeLeft - dt);
    // a faixa de ângulo da arma gira com a rampa; o ângulo é sempre o absoluto
    const c = this.current;
    if (c && !this.busy) this.ui.angle = clampAbsoluteAngle(this.ui.angle, own(WEAPONS, c.weaponId)!.angle, this.terrain.slopeDeg(c.x, c.y, c.facing));
  }

  /** Quem está na vez fica livre para agir quando nada está animando. */
  get canAct(): boolean { return !this.busy && !this.hud.over; }

  draw(ctx: CanvasRenderingContext2D, me: string | null): void {
    const cur = this.current;
    const W = this.width, H = this.height;
    const target = this.anim ? this.anim.points[Math.min(this.anim.i, this.anim.points.length - 1)]!.x : cur?.x ?? 0;
    this.cam += (Math.max(0, Math.min(W - VIEW_W, target - VIEW_W / 2)) - this.cam) * 0.15;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save(); ctx.translate(-Math.round(this.cam), 0);
    ctx.drawImage(this.tc, 0, 0);
    const weapon = cur ? own(WEAPONS, cur.weaponId) : undefined;

    if (cur?.alive && !this.hud.over) { // régua de distância (1 un = 100 px)
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "11px Nunito, system-ui"; ctx.lineWidth = 1;
      for (let u = 1; u <= 20; u++) { const x = cur.x + cur.facing * u * 100; if (x < 0 || x > W) break; ctx.beginPath(); ctx.moveTo(x, cur.y - 8); ctx.lineTo(x, cur.y + 8); ctx.stroke(); ctx.fillText(String(u), x - 3, cur.y + 22); }
    }
    for (const c of this.chars.values()) {
      if (!c.alive) continue;
      this.drawTank(ctx, c, c.id === this.hud.player && !this.anim);
      const bx = c.x - 22, by = c.y - PLAYER_HITBOX.h - 22;
      ctx.fillStyle = "#0008"; ctx.fillRect(bx, by, 44, 5); ctx.fillStyle = "#5c5"; ctx.fillRect(bx, by, 44 * Math.max(0, c.hp / c.maxHp), 5);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText(c.id, c.x, by - 3); ctx.textAlign = "left";
      if (c.id === me) { ctx.fillStyle = "#ffe98a"; ctx.beginPath(); ctx.moveTo(c.x, by - 16); ctx.lineTo(c.x - 5, by - 24); ctx.lineTo(c.x + 5, by - 24); ctx.fill(); }
    }
    if (this.anim) { const p = this.anim.points[Math.min(this.anim.i, this.anim.points.length - 1)]!; ctx.fillStyle = "#ffd24a"; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); }
    ctx.restore();

    // HUD de canvas (mínimo; o HUD final do design entra por HTML)
    ctx.fillStyle = "#0008"; ctx.fillRect(0, 0, VIEW_W, 44);
    ctx.fillStyle = "#fff"; ctx.font = "14px Nunito, system-ui";
    ctx.fillText(`${this.hud.player} · ${weapon?.name ?? ""}  turno ${this.hud.turn}  ${Math.ceil(this.hud.timeLeft)}s`, 12, 18);
    const w = this.hud.wind;
    ctx.fillText(`vento ${w === 0 ? "·" : w > 0 ? "→" : "←"} ${Math.abs(w).toFixed(1)}`, 12, 37);
    ctx.fillText(`ângulo ${Math.round(this.ui.angle)}°${this.ui.special ? "  [ESPECIAL]" : ""}`, 250, 18);
    ctx.fillText(`energia ${cur?.energy ?? 0}`, 250, 37);
    ctx.fillText("fúria", 380, 18); bar(ctx, 425, 8, 100, 10, (cur?.fury ?? 0) / 100, "#e8a33a");
    ctx.fillText("força", 380, 37); bar(ctx, 425, 28, 100, 10, this.ui.power / 100, "#e55");
    if (this.ui.msg) { ctx.fillStyle = "#fc8"; ctx.fillText(this.ui.msg, 540, 18); }
    const keys: ItemKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "F"];
    keys.forEach((k, i) => {
      const x = 12 + i * 52, y = VIEW_H - 50, can = (cur?.id === me || me === null) && (cur?.energy ?? 0) >= ITEMS[k].cost && !(k === "2" && this.ui.triple);
      ctx.fillStyle = can ? "#2b3550" : "#2228"; ctx.fillRect(x, y, 46, 40);
      ctx.fillStyle = can ? "#fff" : "#888"; ctx.font = "bold 15px Nunito, system-ui"; ctx.fillText(k, x + 6, y + 18);
      ctx.font = "11px Nunito, system-ui"; ctx.fillText(String(ITEMS[k].cost), x + 6, y + 34);
    });
    ctx.fillStyle = "#fff"; ctx.font = "12px Nunito, system-ui";
    ctx.fillText(`dano +${Math.round(this.ui.turnBonus * 100)}%${this.ui.extraShots ? `  +${this.ui.extraShots} tiros` : ""}${this.ui.triple ? "  triplo" : ""}${this.ui.fly ? "  VOAR" : ""}`, 12, VIEW_H - 58);
    const mw = 200, mh = (H / W) * mw, mx = VIEW_W - mw - 10, my = 52;
    ctx.fillStyle = "#000a"; ctx.fillRect(mx, my, mw, mh); ctx.drawImage(this.tc, 0, 0, W, H, mx, my, mw, mh);
    for (const c of this.chars.values()) if (c.alive) { ctx.fillStyle = (TEAM[c.team as 1 | 2] ?? TEAM[1]).color; ctx.fillRect(mx + (c.x / W) * mw - 2, my + (c.y / H) * mh - 4, 4, 4); }
    ctx.strokeStyle = "#fff"; ctx.strokeRect(mx + (this.cam / W) * mw, my, (VIEW_W / W) * mw, mh);
    if (this.hud.over) {
      ctx.fillStyle = "#000b"; ctx.fillRect(0, 230, VIEW_W, 100);
      ctx.fillStyle = "#fff"; ctx.font = "bold 32px Nunito, system-ui"; ctx.textAlign = "center";
      ctx.fillText(this.hud.winner === null ? "Empate" : `Time ${this.hud.winner} venceu!`, VIEW_W / 2, 290); ctx.textAlign = "left";
    }
  }

  private drawTank(ctx: CanvasRenderingContext2D, c: CharView, aiming: boolean): void {
    drawDoll(ctx, c.look, { facing: c.facing, angleDeg: this.ui.angle, walk: c.walk, weaponId: c.weaponId, aiming }, c.x, c.y);
    if (!aiming) c.walk = 0;
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, color: string) {
  ctx.fillStyle = "#0008"; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}

/** Entrada de teclado compartilhada: andar, ângulo, força de segurar/soltar, itens, especial, passar. */
export class Controls {
  private keys = new Set<string>();
  charging = false;
  private walkAcc = 0; private angleAcc = 0;
  constructor(public view: MatchView, private canControl: () => boolean, private send: (i: Record<string, unknown>) => void) {
    addEventListener("keydown", e => this.down(e));
    addEventListener("keyup", e => this.up(e));
  }
  private down(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); if (e.repeat) return; if (this.canControl() && this.view.canAct) { this.charging = true; this.view.ui.power = 0; } return; }
    this.keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (!this.canControl() || !this.view.canAct) return;
    const k = e.key.toUpperCase();
    if (own(ITEMS, k)) this.send({ type: "item", key: k });
    else if (k === "P") this.send({ type: "pass" });
    else if (k === "R") this.view.ui.special = !this.view.ui.special;
  }
  private up(e: KeyboardEvent) {
    this.keys.delete(e.code);
    if (e.code === "Space" && this.charging) {
      this.charging = false;
      if (this.view.ui.power > 1 && this.canControl()) this.send({ type: "shoot", angleDeg: this.view.ui.angle, power: this.view.ui.power, special: this.view.ui.special });
      this.view.ui.power = 0;
    }
  }
  update(dt: number) {
    const ui = this.view.ui;
    if (!this.canControl() || !this.view.canAct) { if (this.charging && !this.view.canAct) { this.charging = false; ui.power = 0; } return; }
    if (this.charging) {
      ui.power = Math.min(100, ui.power + 70 * dt);
      if (ui.power >= 100) { this.charging = false; this.send({ type: "shoot", angleDeg: ui.angle, power: 100, special: ui.special }); ui.power = 0; }
      return;
    }
    const dir = (this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("ArrowLeft") ? 1 : 0);
    if (dir) { this.walkAcc += dt * 80; const px = Math.floor(this.walkAcc); if (px > 0) { this.walkAcc -= px; this.send({ type: "move", dir, px }); } }
    const ad = (this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("ArrowDown") ? 1 : 0);
    if (ad) { this.angleAcc += dt * 40; const d = Math.floor(this.angleAcc); if (d > 0) { this.angleAcc -= d; ui.angle += ad * d; } }
  }
}
