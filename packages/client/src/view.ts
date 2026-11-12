/**
 * Visão da partida: aplica os EVENTOS do core (nunca re-simula física) e desenha no canvas.
 * Serve ao jogo local (game.ts) e ao jogo em rede (play.ts). O cliente só anima o que o core/servidor decidiu.
 */
import { drawCharacter } from "./chars";
import { applyCharacterTransform } from "./doll";
import { UI_FPS, autoPropAlpha, classFrames, drawClass, propIcon } from "./reborn-ui";
import { TerrainLayer } from "./terrain-layer";
import { drawDeath } from "./death";
import { drawDamagePopup, damagePopupDuration } from "./damage-popup";
import { applyCharacterMove } from "./character-state";
import { drawImpact, drawProjectile, drawTrail, impactDuration, TRAIL_MAX_LIFE } from "./projectile-effects";
import { preloadLocalSfx, projectileSfx, sfx, stopSfx } from "./sound";
import {
  BUILDS, DEFAULT_LOOK, HANDCLIP_SECONDS, ballInfo, weaponStage, MatchPlayback, allowedAbsoluteRange, FLY_ANGLE, FLY_BALL_ID, ITEMS, MAPS, PLAYER_HITBOX, Terrain, WEAPONS, clampAbsoluteAngle, own, sampleTrajectory,
  type Facing, type ItemKey, type Look, type MatchEvent,
} from "@tankclone/core";

export interface PlayerInfo { id: string; team: number; weaponId: string; build: string; x: number; spawnY?: number; facing: Facing; look?: Look; weaponLevel?: number }

export interface CharView {
  id: string; team: number; weaponId: string; x: number; y: number; hp: number; maxHp: number;
  /** Arte da arma no boneco: "sledge", ou "sledge:1"/"sledge:2" para os modelos do +10/+12. */
  weaponArt: string;
  fury: number; alive: boolean; facing: Facing; energy: number; maxEnergy: number; look: Look; walk: number; delay: number; action?: "shoot" | "hit" | "handclip"; actionStart?: number; deathAge?: number;
  /** Itens usados neste instante: animação de pegar item e o ícone sobre a cabeça. */
  itemFx?: Array<{ key: string; start: number }>;
}

export interface LastShot { angle: number; power: number; facing: Facing }

export const VIEW_W = 1280, VIEW_H = 720;
const TEAM = { 1: { color: "#6aa7ff" }, 2: { color: "#ff8a6a" } } as const;
export class MatchView {
  readonly terrain: Terrain;
  readonly chars = new Map<string, CharView>();
  readonly order: string[] = [];
  hud = { wind: 0, turn: 0, player: "", timeLimit: 10, timeLeft: 10, over: false, winner: null as number | null };
  clockPaused = false; private lastTickSec = -1; private lastStep = 0;
  ui = { pressed: null as { key: string; at: number } | null, fired: false, angle: 45, power: 0, last: 0, special: false, msg: "", turnBonus: 0, extraShots: 0, triple: false, fly: false, flyCooldown: false, spent: 0, used: {} as Record<string, number> };
  /** Quem somos (para sons de vitória/derrota e do início do nosso turno); null no jogo local. */
  me: string | null = null;
  private bg: HTMLImageElement | null = null;
  private lastShotSound: string | null = null;
  private shotHistory = new Map<string, LastShot>();
  private pendingShots = new Map<string, LastShot[]>();
  private tails: Array<{ weapon: string; special: boolean; trail: Array<{ x: number; y: number }>; elapsed: number; age: number }> = [];
  private damagePopups: Array<{ playerId: string; amount: number; crit: boolean; x: number; y: number; age: number; variant: number }> = [];
  private impacts: Array<{ x: number; y: number; weapon: string; special: boolean; ballId?: number; age: number }> = [];
  private layer: TerrainLayer;
  private playback = new MatchPlayback();
  private cam = 0;
  private cameraY = 0;
  private manualCamera = false;
  private cameraInitialized = false;
  readonly width: number; readonly height: number;

  constructor(readonly mapId: string, players: PlayerInfo[]) {
    preloadLocalSfx();
    this.terrain = own(MAPS, mapId)!.build();
    this.width = this.terrain.width; this.height = this.terrain.height;
    this.layer = new TerrainLayer(this.terrain, this.width, this.height);
    const def = own(MAPS, mapId)!;
    if (def.artBase && def.manifest) { // arte do mapa: recortada pela máscara (ar vira transparente) quando carregar
      const art = new Image(); art.onload = () => this.layer.setArt(art); art.src = def.artBase + def.manifest.art;
      if (def.manifest.background) { const bg = new Image(); bg.onload = () => (this.bg = bg); bg.src = def.artBase + def.manifest.background; }
    }
    for (const p of players) {
      const st = own(BUILDS, p.build) ?? BUILDS.media!;
      const y = this.terrain.surfaceY(p.x, p.spawnY ?? 0);
      const maxEnergy = 240 + Math.floor(st.agi / 30);
      this.chars.set(p.id, { id: p.id, team: p.team, weaponId: p.weaponId, weaponArt: weaponStage(p.weaponLevel ?? 0) ? `${p.weaponId}:${weaponStage(p.weaponLevel ?? 0)}` : p.weaponId, x: p.x, y, hp: st.hp, maxHp: st.hp, fury: 0, alive: true, facing: p.facing, energy: maxEnergy, maxEnergy, look: p.look ?? DEFAULT_LOOK, walk: 0, delay: 0 });
      this.order.push(p.id);
    }
  }

  private moveWithSlope(v: CharView, change: () => void): void {
    const old = this.terrain.slopeDeg(v.x, v.y, v.facing);
    change();
    if (v.id === this.hud.player) {
      const slope = this.terrain.slopeDeg(v.x, v.y, v.facing);
      this.ui.angle = this.ui.fly ? Math.max(0, Math.min(90, this.ui.angle)) : clampAbsoluteAngle(this.ui.angle + slope - old, own(WEAPONS, v.weaponId)!.angle, slope);
    }
  }

  /** Cache do terreno (para o minimapa do HUD). */
  get terrainCanvas(): HTMLCanvasElement { return this.layer.canvas; }
  get camX(): number { return this.cam; }
  get camY(): number { return this.cameraY; }
  moveCameraTo(x: number, y: number): void {
    this.manualCamera = true;
    this.cam = Math.max(0, Math.min(Math.max(0, this.width - VIEW_W), x - VIEW_W / 2));
    this.cameraY = Math.max(0, Math.min(Math.max(0, this.height - VIEW_H), y - VIEW_H / 2));
  }

  get busy(): boolean { return this.playback.busy; }
  push(events: MatchEvent[]): void { this.playback.push(events.map(event => ({ ...event }))); }
  get current(): CharView | undefined { return this.chars.get(this.hud.player); }
  get lastShot(): LastShot | null { return this.shotHistory.get(this.me ?? this.hud.player) ?? null; }
  /** Fallback para servidores antigos: só vira histórico se o evento de tiro chegar. */
  expectShot(angle: number, power: number): void {
    const c = this.current; if (!c) return;
    const pending = this.pendingShots.get(c.id) ?? [];
    pending.push({ angle, power, facing: c.facing }); this.pendingShots.set(c.id, pending);
  }

  private apply(e: MatchEvent, remaining: number): void {
    const v = "playerId" in e ? this.chars.get(e.playerId) : undefined;
    switch (e.type) {
      case "turnStart": {
        this.pendingShots.delete(e.playerId);
        this.manualCamera = false;
        this.ui.flyCooldown = e.flyCooldown ?? false; this.hud.wind = e.wind; this.hud.turn = e.turn; this.hud.player = e.playerId; this.hud.timeLimit = e.timeLimit; this.hud.timeLeft = e.timeLimit; for (const [id, delay] of Object.entries(e.delays)) { const c = this.chars.get(id); if (c) c.delay = delay; }
        if (v) { v.energy = e.energy; v.maxEnergy = Math.max(v.maxEnergy, e.energy); this.ui.angle = Math.max(this.ui.angle, 0); }
        if (e.playerId === this.me) sfx("whistle"); else sfx("turnChange");
        this.lastTickSec = -1;
        this.ui.power = 0; this.ui.special = false; this.ui.turnBonus = 0; this.ui.extraShots = 0; this.ui.triple = false; this.ui.fly = false; this.ui.spent = 0; this.ui.used = {}; this.ui.fired = false; this.clockPaused = false;
        break;
      }
      case "move": { const t = performance.now(); if (e.path.length && t - this.lastStep > 300) { this.lastStep = t; sfx("steps"); } } if (v) this.moveWithSlope(v, () => applyCharacterMove(v, e)); break;
      case "fall": if (v) this.moveWithSlope(v, () => { v.y = e.toY; }); break;
      case "fly": if (v) this.moveWithSlope(v, () => { v.x = e.x; v.y = e.y; }); break;
      case "item": {
        if (v) v.energy = e.energyLeft;
        const d = own(ITEMS, e.key); if (!d) break;
        // GamePlayer.__usingItem: som 039, boneco "bate a mão" (HANDCLIP) e o ícone do item sobe sobre a cabeça
        sfx("useItem");
        if (v) { const t = performance.now() / 1000; v.action = "handclip"; v.actionStart = t; (v.itemFx ??= []).push({ key: e.key, start: t }); }
        this.ui.spent += d.cost; this.ui.used[e.key] = (this.ui.used[e.key] ?? 0) + 1;
        this.ui.turnBonus += d.damageBonus ?? 0; if (d.triple) this.ui.turnBonus = (1 + this.ui.turnBonus) * 0.5 - 1; this.ui.extraShots += d.extraShots ?? 0; this.ui.triple ||= !!d.triple; this.ui.fly ||= !!d.fly;
        break;
      }
      case "crater": this.layer.carve(e); break;
      case "damage": {
        if (v) {
          v.hp = Math.max(0, v.hp - e.amount); v.action = "hit"; v.actionStart = performance.now() / 1000;
          if (e.amount > 0 && remaining < damagePopupDuration(e.crit)) {
            const occupied = new Set(this.damagePopups.filter(p => p.playerId === v.id && p.age - remaining < damagePopupDuration(p.crit)).map(p => p.variant));
            let variant = 0; while (occupied.has(variant)) variant++;
            this.damagePopups.push({ playerId: v.id, amount: e.amount, crit: e.crit, x: v.x, y: v.y, age: remaining, variant });
          }
        }
        sfx("hit"); break;
      }
      case "fury": if (v) v.fury = e.fury; break;
      case "death": if (v) { v.alive = false; v.deathAge = 0; } sfx("death"); break;
      case "gameOver": { this.hud.over = true; this.hud.winner = e.winnerTeam; const mine = this.me ? this.chars.get(this.me)?.team : undefined; sfx("gameEnd"); if (mine !== undefined) sfx(e.winnerTeam === mine ? "win" : "lose"); break; }
      case "shot": {
        this.manualCamera = false;
        // Logs de servidores anteriores enviavam o ID da arma mesmo com o item F ativo.
        // O evento de item já é autoritativo e precede o disparo na mesma linha do tempo.
        if (this.ui.fly) e.ballId = FLY_BALL_ID;
        if (v && e.index === 0) {
          const pending = this.pendingShots.get(v.id)?.shift();
          const last = e.aimDeg !== undefined && e.power !== undefined
            ? { angle: e.aimDeg, power: e.power, facing: e.aimFacing ?? v.facing } : pending;
          if (last) this.shotHistory.set(v.id, last);
        }
        this.ui.fired = true;
        if (v) { v.action = "shoot"; v.actionStart = performance.now() / 1000; }
        const visual = this.projectileVisual(e.ballId, v?.weaponId);
        const key = `${e.playerId}:${e.at ?? "unknown"}`;
        if (e.at === undefined || key !== this.lastShotSound) {
          if (visual) projectileSfx(visual.weapon, visual.special, false); else sfx("shoot");
          this.lastShotSound = key;
        }
        break;
      }
      case "stateSync": if (v) { v.x = e.x; v.y = e.y; v.hp = e.hp; v.fury = e.fury; v.energy = e.energy; if (!e.alive && v.alive) v.deathAge = 0; v.alive = e.alive; } break;
      case "turnEnd": if (v) v.delay = e.delay; break;
      case "charge": this.clockPaused = e.on; break;
    }
  }

  private projectileVisual(ballId: number | undefined, fallback?: string): { weapon: string; special: boolean; ballId?: number } | undefined {
    if (ballId === FLY_BALL_ID) return { weapon: "fly", special: false };
    // bolas dos estágios +10/+12 e dos itens (+tiros/+dano): mesma arma, arte própria quando existir
    const info = ballId === undefined ? undefined : ballInfo(ballId);
    if (info) return { weapon: info.weaponId, special: info.kind === "special", ballId };
    for (const weapon of Object.values(WEAPONS)) {
      if (weapon.ballId === ballId) return { weapon: weapon.id, special: false };
      if (weapon.special.ballId === ballId) return { weapon: weapon.id, special: true };
    }
    return fallback ? { weapon: fallback, special: false } : undefined;
  }

  get aimRange(): { min: number; max: number } {
    // voo também é relativo ao corpo (mesma regra do core: clampAbsoluteAngle com FLY_ANGLE)
    const c = this.current; if (!c) return { ...FLY_ANGLE };
    const range = this.ui.fly ? FLY_ANGLE : own(WEAPONS, c.weaponId)!.angle;
    return allowedAbsoluteRange(range, this.terrain.slopeDeg(c.x, c.y, c.facing));
  }

  /** Avança animações e o relógio exibido (o relógio de verdade é do core/servidor). */
  update(dt: number): void {
    for (const popup of this.damagePopups) popup.age += Math.max(0, dt);
    this.damagePopups = this.damagePopups.filter(popup => popup.age < damagePopupDuration(popup.crit));
    for (const tail of this.tails) tail.age += dt;
    this.tails = this.tails.filter(tail => tail.age < TRAIL_MAX_LIFE);
    for (const impact of this.impacts) impact.age += dt;
    this.impacts = this.impacts.filter(impact => impact.age < (impactDuration(impact.weapon, impact.special) ?? 3));
    for (const c of this.chars.values()) { c.walk = Math.max(0, c.walk - dt); if (c.deathAge !== undefined) c.deathAge += dt; }
    const idleTime = this.playback.update(dt, (e, remaining) => this.apply(e, remaining), (shot, remaining) => {
      const visual = this.projectileVisual(shot.ballId, this.chars.get(shot.playerId)?.weaponId);
      if (visual && shot.points.length && remaining < TRAIL_MAX_LIFE) {
        const length = Math.min(14, Math.floor(shot.duration / 0.04) + 1);
        const trail = Array.from({ length }, (_, i) => sampleTrajectory(shot.points,
          shot.duration - (length - 1 - i) * 0.04, shot.stepSeconds, shot.duration));
        this.tails.push({ ...visual, trail, elapsed: shot.duration, age: remaining });
      }
      if (!shot.hit) return;
      if (visual && remaining < (impactDuration(visual.weapon, visual.special) ?? 3)) this.impacts.push({ ...shot.hit, ...visual, age: remaining });
      if (remaining < 0.25) { if (visual) projectileSfx(visual.weapon, visual.special, true); else sfx("boom"); }
    });
    // relógio com som só na sua vez: tique 1×/s e alerta nos últimos 4 s; pausa para o alerta
    if (this.me && this.hud.player === this.me && !this.busy && !this.hud.over) {
      if (this.clockPaused) stopSfx("alert");
      else { const sec = Math.ceil(this.hud.timeLeft); if (sec !== this.lastTickSec) { this.lastTickSec = sec; if (sec > 4) sfx("tick"); else if (sec >= 1) sfx("alert"); } }
    }
    if (!this.busy && !this.hud.over && !this.clockPaused) this.hud.timeLeft = Math.max(0, this.hud.timeLeft - idleTime);
    // a faixa de ângulo da arma gira com a rampa; o ângulo é sempre o absoluto
    const c = this.current;
    if (c) this.ui.angle = clampAbsoluteAngle(this.ui.angle, this.ui.fly ? FLY_ANGLE : own(WEAPONS, c.weaponId)!.angle, this.terrain.slopeDeg(c.x, c.y, c.facing));
  }

  /** Quem está na vez fica livre para agir quando nada está animando. */
  get canAct(): boolean { return !this.busy && !this.hud.over; }

  draw(ctx: CanvasRenderingContext2D, me: string | null): void {
    const cur = this.current;
    const W = this.width, H = this.height;
    const projectiles = this.playback.positions;
    const targetX = projectiles.length ? projectiles.reduce((sum, p) => sum + p.x, 0) / projectiles.length : cur?.x ?? W / 2;
    const targetY = projectiles.length ? projectiles.reduce((sum, p) => sum + p.y, 0) / projectiles.length : cur?.y ?? H / 2;
    if (!this.manualCamera) {
      const x = Math.max(0, Math.min(Math.max(0, W - VIEW_W), targetX - VIEW_W / 2));
      const y = Math.max(0, Math.min(Math.max(0, H - VIEW_H), targetY - VIEW_H / 2));
      const rate = this.cameraInitialized ? .15 : 1;
      this.cam += (x - this.cam) * rate; this.cameraY += (y - this.cameraY) * rate; this.cameraInitialized = true;
    }
    if (this.bg) ctx.drawImage(this.bg, 0, 0, VIEW_W, VIEW_H);
    else { const g = ctx.createLinearGradient(0, 0, 0, VIEW_H); g.addColorStop(0, "#7fb8ee"); g.addColorStop(1, "#dcefff"); ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, VIEW_H); }
    ctx.save(); ctx.translate(-Math.round(this.cam), H < VIEW_H ? VIEW_H - H : -Math.round(this.cameraY));
    ctx.drawImage(this.layer.canvas, 0, 0);

    if (cur?.alive && !this.hud.over) { // régua de distância (1 un = 100 px)
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "11px Nunito, system-ui"; ctx.lineWidth = 1;
      for (let u = 1; u <= 20; u++) { const x = cur.x + cur.facing * u * 100; if (x < 0 || x > W) break; ctx.beginPath(); ctx.moveTo(x, cur.y - 8); ctx.lineTo(x, cur.y + 8); ctx.stroke(); ctx.fillText(String(u), x - 3, cur.y + 22); }
    }
    for (const c of this.chars.values()) {
      if (!c.alive) {
        drawDeath(ctx, c.look, c.weaponArt, c.x, c.y, c.facing, c.deathAge ?? 0, this.terrain.slopeDeg(c.x, c.y, c.facing));
        continue;
      }
      this.drawTank(ctx, c, c.id === this.hud.player && !this.busy);
      this.drawCharFx(ctx, c);
      const bx = c.x - 22, by = c.y - PLAYER_HITBOX.h - 22;
      ctx.fillStyle = "#0008"; ctx.fillRect(bx, by, 44, 5); ctx.fillStyle = "#5c5"; ctx.fillRect(bx, by, 44 * Math.max(0, c.hp / c.maxHp), 5);
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px Nunito, system-ui"; ctx.textAlign = "center"; ctx.fillText(c.id, c.x, by - 3); ctx.textAlign = "left";
      if (c.id === me) { ctx.fillStyle = "#ffe98a"; ctx.beginPath(); ctx.moveTo(c.x, by - 16); ctx.lineTo(c.x - 5, by - 24); ctx.lineTo(c.x + 5, by - 24); ctx.fill(); }
    }
    for (const tail of this.tails) drawTrail(ctx, tail.weapon, tail.special, tail.trail, tail.elapsed, tail.age);
    for (const impact of this.impacts) drawImpact(ctx, impact.weapon, impact.special, impact.x, impact.y, impact.age, impact.ballId);
    for (const p of projectiles) {
      const visual = this.projectileVisual(p.ballId, this.chars.get(p.playerId)?.weaponId);
      if (visual) drawTrail(ctx, visual.weapon, visual.special, p.trail, p.elapsed);
      if (!visual || !drawProjectile(ctx, visual.weapon, visual.special, p.x, p.y, p.angle, p.elapsed, visual.ballId)) {
        ctx.fillStyle = "#101010"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 5.5, 0, 7); ctx.fill(); ctx.stroke();
      }
    }
    for (const popup of this.damagePopups) drawDamagePopup(ctx, popup.amount, popup.crit, popup.x, popup.y, popup.age, popup.variant);
    ctx.restore();

  }

  /** Efeitos do Reborn sobre o boneco (só com os assets locais): fogo de fúria cheia e a animação de pegar item. */
  private drawCharFx(ctx: CanvasRenderingContext2D, c: CharView): void {
    const now = performance.now() / 1000, slope = this.terrain.slopeDeg(c.x, c.y, c.facing);
    if (c.fury >= 200) { // GamePlayer.__danderChanged: danderAsset em (3, corpo+5) dentro do sprite do jogador (y −3)
      ctx.save(); applyCharacterTransform(ctx, c.x, c.y, c.facing, 1, slope); ctx.translate(3, 2);
      drawClass(ctx, "gameii", "asset.game.danderAsset", now * UI_FPS); ctx.restore();
    }
    if (!c.itemFx?.length) return;
    const pick = "asset.game.ghostPcikPropAsset", frames = classFrames("gameii", pick) || 52;
    c.itemFx = c.itemFx.filter(fx => {
      const t = now - fx.start, f = t * UI_FPS;
      if (f < frames) { ctx.save(); ctx.translate(c.x, c.y - 10); drawClass(ctx, "gameii", pick, f); ctx.restore(); }
      // headPropEffect no quadro 12 da animação: ícone 60×60 em (−5−20, −140)
      const a = f >= 12 ? autoPropAlpha(t - 12 / UI_FPS) : 0;
      const icon = propIcon(fx.key);
      if (icon && a) { ctx.save(); ctx.globalAlpha = a; ctx.drawImage(icon, c.x - 25, c.y - 140, 60, 60); ctx.restore(); }
      return f < frames || a !== null;
    });
  }

  private drawTank(ctx: CanvasRenderingContext2D, c: CharView, aiming: boolean): void {
    const elapsed = performance.now() / 1000 - (c.actionStart ?? -Infinity);
    const window = c.action === "handclip" ? HANDCLIP_SECONDS : 0.24;
    drawCharacter(ctx, c.look, { action: elapsed < window ? c.action : undefined, actionElapsed: elapsed, facing: c.facing, slopeDeg: this.terrain.slopeDeg(c.x, c.y, c.facing), angleDeg: this.ui.angle, walk: c.walk, weaponId: c.weaponArt, aiming, crouch: true }, c.x, c.y);
  }
}
