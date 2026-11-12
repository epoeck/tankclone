/**
 * Visão da partida: aplica os EVENTOS do core (nunca re-simula física) e desenha no canvas.
 * Serve ao jogo local (game.ts) e ao jogo em rede (play.ts). O cliente só anima o que o core/servidor decidiu.
 */
import { drawCharacter } from "./chars";
import { applyCharacterMove } from "./character-state";
import { sfx, toggleMute } from "./sound";
import {
  BUILDS, DEFAULT_LOOK, MatchPlayback, craterShape, craterOrigin, FLY_ANGLE, ITEMS, MAPS, PLAYER_HITBOX, Terrain, WEAPONS, clampAbsoluteAngle, own,
  type Facing, type ItemKey, type Look, type MatchEvent,
} from "@tankclone/core";

export interface PlayerInfo { id: string; team: number; weaponId: string; build: string; x: number; facing: Facing; look?: Look }

export interface CharView {
  id: string; team: number; weaponId: string; x: number; y: number; hp: number; maxHp: number;
  fury: number; alive: boolean; facing: Facing; energy: number; maxEnergy: number; look: Look; walk: number; delay: number; action?: "shoot" | "hit"; actionStart?: number;
}

export const VIEW_W = 1280, VIEW_H = 720;
const TEAM = { 1: { color: "#6aa7ff" }, 2: { color: "#ff8a6a" } } as const;
export class MatchView {
  readonly terrain: Terrain;
  readonly chars = new Map<string, CharView>();
  readonly order: string[] = [];
  hud = { wind: 0, turn: 0, player: "", timeLimit: 10, timeLeft: 10, over: false, winner: null as number | null };
  ui = { angle: 45, power: 0, last: 0, special: false, msg: "", turnBonus: 0, extraShots: 0, triple: false, fly: false, spent: 0, used: {} as Record<string, number> };
  /** Quem somos (para sons de vitória/derrota e do início do nosso turno); null no jogo local. */
  me: string | null = null;
  private bg: HTMLImageElement | null = null;
  private tc: HTMLCanvasElement;
  private tctx: CanvasRenderingContext2D;
  private playback = new MatchPlayback();
  private cam = 0;
  readonly width: number; readonly height: number;

  constructor(readonly mapId: string, players: PlayerInfo[]) {
    this.terrain = own(MAPS, mapId)!.build();
    this.width = this.terrain.width; this.height = this.terrain.height;
    this.tc = document.createElement("canvas"); this.tc.width = this.width; this.tc.height = this.height;
    this.tctx = this.tc.getContext("2d")!;
    this.paintTerrain();
    const def = own(MAPS, mapId)!;
    if (def.artBase && def.manifest) { // arte do mapa: recortada pela máscara (ar vira transparente) quando carregar
      const art = new Image(); art.onload = () => this.paintArt(art); art.src = def.artBase + def.manifest.art;
      if (def.manifest.background) { const bg = new Image(); bg.onload = () => (this.bg = bg); bg.src = def.artBase + def.manifest.background; }
    }
    for (const p of players) {
      const st = own(BUILDS, p.build) ?? BUILDS.media!;
      const y = this.terrain.surfaceY(p.x, 0);
      const maxEnergy = 240 + Math.floor(st.agi / 30);
      this.chars.set(p.id, { id: p.id, team: p.team, weaponId: p.weaponId, x: p.x, y, hp: st.hp, maxHp: st.hp, fury: 0, alive: true, facing: p.facing, energy: maxEnergy, maxEnergy, look: p.look ?? DEFAULT_LOOK, walk: 0, delay: 0 });
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

  /** Pinta a arte no cache do terreno, respeitando o estado atual do terreno (crateras já abertas ficam transparentes). */
  private paintArt(art: HTMLImageElement): void {
    const c = document.createElement("canvas"); c.width = this.width; c.height = this.height;
    const cx = c.getContext("2d")!; cx.drawImage(art, 0, 0, this.width, this.height);
    const img = cx.getImageData(0, 0, this.width, this.height), m = this.terrain.getMask();
    for (let i = 0; i < m.length; i++) if (!m[i]) img.data[i * 4 + 3] = 0;
    this.tctx.clearRect(0, 0, this.width, this.height);
    this.tctx.putImageData(img, 0, 0);
  }

  /** Cache do terreno (para o minimapa do HUD). */
  get terrainCanvas(): HTMLCanvasElement { return this.tc; }
  get camX(): number { return this.cam; }

  get busy(): boolean { return this.playback.busy; }
  push(events: MatchEvent[]): void { this.playback.push(events); }
  get current(): CharView | undefined { return this.chars.get(this.hud.player); }

  private apply(e: MatchEvent): void {
    const v = "playerId" in e ? this.chars.get(e.playerId) : undefined;
    switch (e.type) {
      case "turnStart": {
        this.hud.wind = e.wind; this.hud.turn = e.turn; this.hud.player = e.playerId; this.hud.timeLimit = e.timeLimit; this.hud.timeLeft = e.timeLimit; for (const [id, delay] of Object.entries(e.delays)) { const c = this.chars.get(id); if (c) c.delay = delay; }
        if (v) { v.energy = e.energy; v.maxEnergy = Math.max(v.maxEnergy, e.energy); this.ui.angle = Math.max(this.ui.angle, 0); }
        if (e.playerId === this.me) sfx("turn");
        this.ui.power = 0; this.ui.special = false; this.ui.turnBonus = 0; this.ui.extraShots = 0; this.ui.triple = false; this.ui.fly = false; this.ui.spent = 0; this.ui.used = {};
        break;
      }
      case "move": if (v) applyCharacterMove(v, e); break;
      case "fall": if (v) v.y = e.toY; break;
      case "fly": if (v) { v.x = e.x; v.y = e.y; } break;
      case "item": {
        if (v) v.energy = e.energyLeft;
        const d = own(ITEMS, e.key); if (!d) break;
        sfx("item"); this.ui.spent += d.cost; this.ui.used[e.key] = (this.ui.used[e.key] ?? 0) + 1;
        this.ui.turnBonus += d.damageBonus ?? 0; if (d.triple) this.ui.turnBonus = (1 + this.ui.turnBonus) * 0.5 - 1; this.ui.extraShots += d.extraShots ?? 0; this.ui.triple ||= !!d.triple; this.ui.fly ||= !!d.fly;
        break;
      }
      case "crater": {
        sfx("boom");
        const shape = craterShape(e.ballId);
        this.terrain.carveShape(e.x, e.y, shape);
        // Recorta a imagem pela máscara atual; pixels indestrutíveis também permanecem visíveis.
        const origin = craterOrigin(e.x, e.y, shape);
        const x = Math.max(0, origin.x), y = Math.max(0, origin.y);
        const w = Math.min(this.width, origin.x + shape.width) - x;
        const h = Math.min(this.height, origin.y + shape.height) - y;
        if (w > 0 && h > 0) {
          const patch = this.tctx.getImageData(x, y, w, h), mask = this.terrain.getMask();
          for (let row = 0; row < h; row++) for (let col = 0; col < w; col++) {
            if (!mask[(y + row) * this.width + x + col]) patch.data[(row * w + col) * 4 + 3] = 0;
          }
          this.tctx.putImageData(patch, x, y);
        }
        break;
      }
      case "damage": if (v) { v.hp = e.hp; v.action = "hit"; v.actionStart = performance.now() / 1000; } sfx("hit"); break;
      case "fury": if (v) v.fury = e.fury; break;
      case "death": if (v) v.alive = false; sfx("death"); break;
      case "gameOver": { this.hud.over = true; this.hud.winner = e.winnerTeam; const mine = this.me ? this.chars.get(this.me)?.team : undefined; if (mine !== undefined) sfx(e.winnerTeam === mine ? "win" : "lose"); break; }
      case "shot": if (v) { v.action = "shoot"; v.actionStart = performance.now() / 1000; } sfx("shoot"); break;
      case "turnEnd": if (v) v.delay = e.delay; break;
    }
  }

  /** Avança animações e o relógio exibido (o relógio de verdade é do core/servidor). */
  update(dt: number): void {
    for (const c of this.chars.values()) c.walk = Math.max(0, c.walk - dt);
    const idleTime = this.playback.update(dt, e => this.apply(e));
    if (!this.busy && !this.hud.over) this.hud.timeLeft = Math.max(0, this.hud.timeLeft - idleTime);
    // a faixa de ângulo da arma gira com a rampa; o ângulo é sempre o absoluto
    const c = this.current;
    if (c && !this.busy) this.ui.angle = clampAbsoluteAngle(this.ui.angle, this.ui.fly ? FLY_ANGLE : own(WEAPONS, c.weaponId)!.angle, this.terrain.slopeDeg(c.x, c.y, c.facing));
  }

  /** Quem está na vez fica livre para agir quando nada está animando. */
  get canAct(): boolean { return !this.busy && !this.hud.over; }

  draw(ctx: CanvasRenderingContext2D, me: string | null): void {
    const cur = this.current;
    const W = this.width, H = this.height;
    const projectiles = this.playback.positions;
    const target = projectiles.length ? projectiles.reduce((sum, p) => sum + p.x, 0) / projectiles.length : cur?.x ?? 0;
    this.cam += (Math.max(0, Math.min(W - VIEW_W, target - VIEW_W / 2)) - this.cam) * 0.15;
    if (this.bg) ctx.drawImage(this.bg, 0, 0, VIEW_W, VIEW_H);
    else { const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, "#7fb8ee"); g.addColorStop(1, "#dcefff"); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    ctx.save(); ctx.translate(-Math.round(this.cam), VIEW_H - H);
    ctx.drawImage(this.tc, 0, 0);

    if (cur?.alive && !this.hud.over) { // régua de distância (1 un = 100 px)
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "11px Nunito, system-ui"; ctx.lineWidth = 1;
      for (let u = 1; u <= 20; u++) { const x = cur.x + cur.facing * u * 100; if (x < 0 || x > W) break; ctx.beginPath(); ctx.moveTo(x, cur.y - 8); ctx.lineTo(x, cur.y + 8); ctx.stroke(); ctx.fillText(String(u), x - 3, cur.y + 22); }
    }
    for (const c of this.chars.values()) {
      if (!c.alive) continue;
      this.drawTank(ctx, c, c.id === this.hud.player && !this.busy);
      const bx = c.x - 22, by = c.y - PLAYER_HITBOX.h - 22;
      ctx.fillStyle = "#0008"; ctx.fillRect(bx, by, 44, 5); ctx.fillStyle = "#5c5"; ctx.fillRect(bx, by, 44 * Math.max(0, c.hp / c.maxHp), 5);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText(c.id, c.x, by - 3); ctx.textAlign = "left";
      if (c.id === me) { ctx.fillStyle = "#ffe98a"; ctx.beginPath(); ctx.moveTo(c.x, by - 16); ctx.lineTo(c.x - 5, by - 24); ctx.lineTo(c.x + 5, by - 24); ctx.fill(); }
    }
    for (const p of projectiles) { ctx.fillStyle = "#101010"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, 7); ctx.fill(); ctx.stroke(); }
    ctx.restore();

  }

  private drawTank(ctx: CanvasRenderingContext2D, c: CharView, aiming: boolean): void {
    const elapsed = performance.now() / 1000 - (c.actionStart ?? -Infinity);
    drawCharacter(ctx, c.look, { action: elapsed < 0.24 ? c.action : undefined, actionElapsed: elapsed, facing: c.facing, angleDeg: this.ui.angle, walk: c.walk, weaponId: c.weaponId, aiming, crouch: true }, c.x, c.y);
  }
}

function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, color: string) {
  ctx.fillStyle = "#0008"; ctx.fillRect(x, y, w, h); ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}

/** Entrada de teclado compartilhada: andar, ângulo, força de segurar/soltar, itens, especial, passar. */
export class Controls {
  private keys = new Set<string>();
  charging = false; private chargeDir = 1;
  private walkAcc = 0; private angleAcc = 0;
  constructor(public view: MatchView, private canControl: () => boolean, readonly send: (i: Record<string, unknown>) => void) {
    addEventListener("keydown", e => this.down(e));
    addEventListener("keyup", e => this.up(e));
  }
  private down(e: KeyboardEvent) {
    if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
    if (e.code === "Space") { e.preventDefault(); if (e.repeat) return; if (this.canControl() && this.view.canAct) { this.charging = true; this.chargeDir = 1; this.view.ui.power = 0; } return; }
    this.keys.add(e.code);
    if (e.code.startsWith("Arrow")) e.preventDefault();
    if (!this.canControl() || !this.view.canAct) return;
    const k = e.key.toUpperCase();
    if (k === "M") { this.view.ui.msg = toggleMute() ? "som desligado" : "som ligado"; return; }
    if (own(ITEMS, k)) this.send({ type: "item", key: k });
    else if (k === "P") this.send({ type: "pass" });
    else if (k === "R") this.view.ui.special = !this.view.ui.special;
  }
  private up(e: KeyboardEvent) {
    this.keys.delete(e.code);
    if (e.code === "Space" && this.charging) {
      this.charging = false;
      if (this.view.ui.power > 1 && this.canControl()) { this.view.ui.last = this.view.ui.power; } if (this.view.ui.power > 1 && this.canControl()) this.send({ type: "shoot", angleDeg: this.view.ui.angle, power: this.view.ui.power, special: this.view.ui.special });
      this.view.ui.power = 0;
    }
  }
  update(dt: number) {
    const ui = this.view.ui;
    if (!this.canControl() || !this.view.canAct) { if (this.charging && !this.view.canAct) { this.charging = false; ui.power = 0; } return; }
    if (this.charging) {
      // a barra sobe até 100 e desce; se voltar a 0 sem soltar Espaço, passa a vez
      ui.power += this.chargeDir * 80 * dt;
      if (ui.power >= 100) { ui.power = 100; this.chargeDir = -1; }
      else if (ui.power <= 0) { ui.power = 0; this.charging = false; this.chargeDir = 1; this.send({ type: "pass" }); }
      return;
    }
    const dir = (this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("ArrowLeft") ? 1 : 0);
    if (dir) { this.walkAcc += dt * 80; const px = Math.floor(this.walkAcc); if (px > 0) { this.walkAcc -= px; this.send({ type: "move", dir, px }); } }
    const ad = (this.keys.has("ArrowUp") ? 1 : 0) - (this.keys.has("ArrowDown") ? 1 : 0);
    if (ad) { this.angleAcc += dt * 40; const d = Math.floor(this.angleAcc); if (d > 0) { this.angleAcc -= d; ui.angle += ad * d; } }
  }
}
