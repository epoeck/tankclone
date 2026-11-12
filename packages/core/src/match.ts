/**
 * Partida local: máquina de estados determinística.
 * Entrada = intenções do jogador da vez (andar, usar item, atirar, passar) + passagem de tempo;
 * saída = lista de eventos para o cliente animar. Sem DOM, rede, relógio ou Math.random.
 */
import { craterShape } from "./craters";
import { clampAbsoluteAngle } from "./angle";
import { DEFAULT_MATCH, FLY_ANGLE, FLY_BALL_ID, ITEMS, WEAPONS, own, type ItemKey, type MatchConfig, type WeaponDef } from "./data";
import { DEFAULT_PHYSICS, MUZZLE_HEIGHT, PLAYER_HITBOX, simulateShot, type Facing, type Hitbox, type PhysicsConfig } from "./physics";
import { Rng } from "./rng";
import { combatPower, statDamage, damageBreakdown, withStats, rollCritical, turnDelay, furyFromDamage, type Stats } from "./stats";
import type { Terrain } from "./terrain";

export interface PlayerSetup {
  id: string;
  team: number;
  /** Posição horizontal inicial; o personagem nasce em cima do chão. */
  x: number;
  spawnY?: number;
  weaponId: string;
  /** Atalho para stats.agi. */
  agi?: number;
  hp?: number;
  /** Atributos (Fase C). O que faltar vira 0 (hp = defaultHp). */
  stats?: Partial<Stats>;
  /** Força de combate (define o tempo de turno de 5 s). Se omitida, calculada dos stats. */
  fc?: number;
  facing?: Facing;
}

export interface Character {
  id: string;
  team: number;
  x: number;
  /** Altura dos pés (primeiro pixel sólido sob o personagem). */
  y: number;
  facing: Facing;
  hp: number;
  maxHp: number;
  agi: number;
  stats: Stats;
  fc: number;
  weaponId: string;
  energy: number;
  maxEnergy: number;
  fury: number;
  delay: number;
  alive: boolean;
  flyCooldown: number;
}

export type Intent =
  | { type: "move"; playerId: string; dir: Facing; px: number }
  | { type: "item"; playerId: string; key: ItemKey }
  | { type: "shoot"; playerId: string; angleDeg: number; power: number; special?: boolean }
  | { type: "charge"; playerId: string; on: boolean }
  | { type: "pass"; playerId: string };

export type MatchEvent = (
  | { type: "turnStart"; playerId: string; wind: number; timeLimit: number; energy: number; turn: number; flyCooldown?: boolean; delays: Record<string, number> }
  | { type: "move"; playerId: string; path: Array<{ x: number; y: number }>; energyLeft: number; facing: Facing }
  | { type: "fall"; playerId: string; fromY: number; toY: number }
  | { type: "item"; playerId: string; key: ItemKey; energyLeft: number }
  | { type: "shot"; playerId: string; index: number; points: Array<{ x: number; y: number }>; hit: { x: number; y: number } | null;
      hitKind: "terrain" | "player" | null; targetId: string | null; damageMult: number; stepSeconds: number; duration: number; ballId?: number }
  | { type: "crater"; x: number; y: number; ballId: number }
  | { type: "damage"; playerId: string; amount: number; hp: number; crit: boolean }
  | { type: "fly"; playerId: string; x: number; y: number }
  | { type: "fury"; playerId: string; fury: number }
  | { type: "charge"; playerId: string; on: boolean }
  | { type: "death"; playerId: string; reason: "hp" | "out_of_map" }
  | { type: "stateSync"; playerId: string; x: number; y: number; hp: number; fury: number; energy: number; alive: boolean }
  | { type: "turnEnd"; playerId: string; delay: number }
  | { type: "gameOver"; winnerTeam: number | null }
) & { /** Instante absoluto na linha de animação da partida (segundos). */ at?: number };

export type Outcome = { ok: true; events: MatchEvent[] } | { ok: false; error: string };

export interface DamageInput {
  weapon: WeaponDef;
  attacker: Stats;
  target: Stats;
  /** Soma dos bônus de dano (+50% = 0.5). */
  bonus: number;
  /** Multiplicador do projétil (itens de tiro múltiplo, especial). */
  shotMult: number;
  /** 1 no centro, cai até 1 − falloffEdge na borda do raio. */
  falloff: number;
  crit: boolean;
}

/** Dano padrão da partida: fórmula de stats.ts. */
export const defaultDamage = (d: DamageInput): number => statDamage(d);

export interface MatchOptions {
  seed: number;
  terrain: Terrain;
  players: PlayerSetup[];
  config?: Partial<MatchConfig>;
  physics?: PhysicsConfig;
  damageFn?: (d: DamageInput) => number;
}

interface TurnState {
  spent: number;
  itemDelay: number;
  bonus: number;
  mult: number;
  extraShots: number;
  triple: boolean;
  fly: boolean;
  elapsed: number;
  /** Como no Reborn: ao começar a carregar a força o relógio do turno para e não volta mais neste turno.
   * `idleSeconds` limita o tempo parado (evita travar a partida soltando sem atirar). */
  clockStopped: boolean;
  idleSeconds: number;
  /** Está com a barra de força em uso (prazo CHARGE_MAX_SECONDS); só pode reiniciar uma vez por tiro. */
  charging: boolean;
  chargedThisShot: boolean;
  /** Tiros já disparados e restantes neste turno (vários tiros: o ângulo pode mudar entre eles). */
  shotsFired: number;
  shotsLeft: number;
  special: boolean;
}

/** Com o relógio parado: prazo para soltar o tiro depois de começar a carregar, e para o próximo tiro (ajustar o ângulo). */
export const CHARGE_MAX_SECONDS = 3.5;
export const BETWEEN_SHOTS_SECONDS = 5;

export class Match {
  readonly terrain: Terrain;
  readonly cfg: MatchConfig;
  readonly physics: PhysicsConfig;
  readonly chars: Character[] = [];
  private rng: Rng;
  /** Sorteio de críticos, separado do vento para um não mexer na sequência do outro. */
  private combatRng: Rng;
  private damageFn: (d: DamageInput) => number;
  private animationTime = 0;
  turn = 0;
  wind = 0;
  private rawWind = 0;
  private nextWind = 0;
  winnerTeam: number | null | undefined = undefined; // undefined = em andamento
  private current: Character;
  private ts: TurnState = freshTurn();
  /** Eventos do início da partida (primeiro turnStart). */
  readonly startEvents: MatchEvent[] = [];

  constructor(opts: MatchOptions) {
    this.terrain = opts.terrain;
    this.cfg = { ...DEFAULT_MATCH, ...opts.config };
    this.physics = opts.physics ?? DEFAULT_PHYSICS;
    this.rng = new Rng(opts.seed);
    this.combatRng = new Rng((opts.seed ^ 0x9e3779b9) >>> 0);
    this.damageFn = opts.damageFn ?? defaultDamage;
    for (const p of opts.players) {
      if (!own(WEAPONS, p.weaponId)) throw new Error(`arma desconhecida: ${p.weaponId}`);
      const stats = withStats({ ...p.stats, ...(p.agi !== undefined ? { agi: p.agi } : {}), ...(p.hp !== undefined ? { hp: p.hp } : {}), ...(p.stats?.hp === undefined && p.hp === undefined ? { hp: this.cfg.defaultHp } : {}) });
      const agi = stats.agi;
      const y = this.terrain.surfaceY(p.x, p.spawnY ?? 0);
      if (y < 0) throw new Error(`sem chão em x=${p.x}`);
      const maxEnergy = this.energyFor(agi);
      this.chars.push({
        id: p.id, team: p.team, x: p.x, y, facing: p.facing ?? 1, hp: stats.hp, maxHp: stats.hp,
        agi, stats, fc: p.fc ?? combatPower(stats), weaponId: p.weaponId, energy: maxEnergy, maxEnergy, fury: 0, delay: turnDelay(stats), alive: true, flyCooldown: 0,
      });
    }
    if (this.chars.length < 2) throw new Error("a partida precisa de ao menos 2 jogadores");
    this.current = this.pickNext();
    this.startEvents.push(this.beginTurn());
  }

  energyFor(agi: number): number {
    return this.cfg.baseEnergy + Math.floor(agi / this.cfg.agiPerEnergy);
  }

  get currentId(): string { return this.current.id; }
  get over(): boolean { return this.winnerTeam !== undefined; }
  getChar(id: string): Character | undefined { return this.chars.find(c => c.id === id); }
  /** Segundos de turno restantes. */
  get timeLeft(): number { return Math.max(0, this.turnTimeLimit() - this.ts.elapsed); }
  /** Estado do turno atual (para a UI: itens usados, bônus de dano acumulado etc.). */
  get turnInfo(): Readonly<TurnState> { return this.ts; }

  /** Ordem: menor delay; empate → maior agilidade → id. */
  private pickNext(): Character {
    return this.chars.filter(c => c.alive).sort((a, b) => a.delay - b.delay || b.agi - a.agi || (a.id < b.id ? -1 : 1))[0]!;
  }

  private turnTimeLimit(): number {
    const alive = this.chars.filter(c => c.alive);
    return alive.every(c => c.fc > this.cfg.fcThreshold) ? this.cfg.turnTimeFast : this.cfg.turnTime;
  }

  private rollWind(): number {
    // BaseGame.GetNextWind: muda em até 1 unidade por turno, buscando um alvo em [-4, 3.9].
    const previous = this.rawWind;
    const delta = Math.floor(this.rng.next() * 11);
    this.rawWind += previous > this.nextWind ? -delta : delta;
    if (previous === this.nextWind) this.nextWind = Math.floor(this.rng.next() * 80) - 40;
    this.rawWind = Math.max(-this.cfg.maxWind * 10, Math.min(this.cfg.maxWind * 10, this.rawWind));
    return this.rawWind / 10 * this.cfg.windMultiplier;
  }

  private beginTurn(): MatchEvent {
    // PVPGame.MinusDelays normaliza a fila; StartAttacking acrescenta GetTurnDelay.
    const minimum = this.current.delay;
    for (const c of this.chars) c.delay -= minimum;
    this.current.delay += turnDelay(this.current.stats);
    this.turn++;
    this.ts = freshTurn();
    this.current.flyCooldown = Math.max(0, this.current.flyCooldown - 1);
    this.wind = this.rollWind();
    this.current.energy = this.current.maxEnergy;
    return { type: "turnStart", playerId: this.current.id, wind: this.wind, timeLimit: this.turnTimeLimit(), energy: this.current.energy, turn: this.turn, flyCooldown: this.current.flyCooldown > 0, delays: Object.fromEntries(this.chars.map(c => [c.id, c.delay])) };
  }

  /** Passa o tempo; ao estourar o limite do turno, passa a vez automaticamente. */
  tick(dt: number): MatchEvent[] {
    if (this.over) return [];
    if (this.ts.clockStopped) {
      this.ts.idleSeconds += dt;
      const limit = this.ts.charging ? CHARGE_MAX_SECONDS : BETWEEN_SHOTS_SECONDS;
      return this.ts.idleSeconds >= limit ? this.endTurn(this.ts.shotsFired === 0) : [];
    }
    this.ts.elapsed += dt;
    if (this.ts.elapsed >= this.turnTimeLimit()) return this.endTurn(this.ts.shotsFired === 0);
    return [];
  }

  submit(intent: Intent): Outcome {
    if (this.over) return { ok: false, error: "partida encerrada" };
    if (intent.playerId !== this.current.id) return { ok: false, error: "não é a vez deste jogador" };
    if (!this.current.alive) return { ok: false, error: "jogador morto" };
    switch (intent.type) {
      case "move": if (this.ts.clockStopped) return { ok: false, error: "já está atirando" }; return this.doMove(intent.dir, intent.px);
      case "charge": {
        // comprometido: o relógio para e não volta; ligar/desligar não reabre nada nem renova o prazo mais de uma vez por tiro
        if (!intent.on || this.ts.chargedThisShot) return { ok: true, events: [] };
        const first = !this.ts.clockStopped;
        this.ts.clockStopped = true; this.ts.charging = true; this.ts.chargedThisShot = true; this.ts.idleSeconds = 0;
        return { ok: true, events: first ? [{ type: "charge", playerId: this.current.id, on: true }] : [] };
      }
      case "item": if (this.ts.clockStopped) return { ok: false, error: "já está atirando" }; return this.doItem(intent.key);
      case "shoot": return this.doShoot(intent.angleDeg, intent.power, !!intent.special);
      case "pass": return { ok: true, events: this.endTurn(true) };
    }
  }

  // ---------- movimento ----------

  private doMove(dir: Facing, px: number): Outcome {
    const c = this.current, cfg = this.cfg, T = this.terrain;
    const changedFacing = c.facing !== dir;
    c.facing = dir;
    const path: Array<{ x: number; y: number }> = [];
    const events: MatchEvent[] = [];
    let steps = Math.floor(px);
    while (steps-- > 0 && c.energy >= cfg.energyPerPx) {
      const nx = c.x + dir;
      if (nx < 1 || nx >= T.width - 1) break;
      if (T.isSolid(nx, c.y - cfg.maxStepUp - 1)) break; // parede alta demais
      const g = T.surfaceY(nx, c.y - cfg.maxStepUp);
      c.energy -= cfg.energyPerPx;
      this.ts.spent += cfg.energyPerPx;
      c.x = nx;
      if (g >= 0 && g - c.y <= cfg.maxStepDown) { c.y = g; path.push({ x: c.x, y: c.y }); continue; }
      // sem chão logo abaixo: queda livre
      path.push({ x: c.x, y: c.y });
      events.push({ type: "move", playerId: c.id, path: [...path], energyLeft: c.energy, facing: c.facing });
      path.length = 0;
      this.settle(c, events);
      if (!c.alive) break;
    }
    if (path.length || (changedFacing && !events.some(e => e.type === "move"))) {
      events.push({ type: "move", playerId: c.id, path, energyLeft: c.energy, facing: c.facing });
    }
    this.checkOver(events);
    if (!c.alive && !this.over) events.push(...this.endTurn(false)); // o da vez morreu andando: passa o turno
    return { ok: true, events };
  }

  /** Faz o personagem cair até o chão; sem chão = sai do mapa e morre. */
  private settle(c: Character, events: MatchEvent[]): void {
    if (!c.alive) return;
    const g = this.terrain.surfaceY(c.x, c.y);
    if (g < 0) { c.alive = false; c.hp = 0; events.push({ type: "death", playerId: c.id, reason: "out_of_map" }); return; }
    if (g !== c.y) {
      events.push({ type: "fall", playerId: c.id, fromY: c.y, toY: g });
      c.y = g;
    }
  }

  // ---------- itens ----------

  private doItem(key: ItemKey): Outcome {
    const def = own(ITEMS, key), c = this.current;
    if (!def) return { ok: false, error: "item desconhecido" };
    if (c.energy < def.cost) return { ok: false, error: "energia insuficiente" };
    if (this.ts.shotsFired > 0) return { ok: false, error: "itens só antes do primeiro tiro" };
    if (def.triple && this.ts.triple) return { ok: false, error: "tiro triplo só uma vez por turno" };
    if (def.fly && this.ts.fly) return { ok: false, error: "voar já ativo" };
    if (def.fly && c.flyCooldown > 0) return { ok: false, error: "voar em recarga neste turno" };
    c.energy -= def.cost;
    this.ts.spent += def.cost;
    this.ts.itemDelay += def.delay;
    this.ts.bonus += def.damageBonus ?? 0;
    if (def.triple) this.ts.bonus = (1 + this.ts.bonus) * 0.5 - 1;
    if (!def.triple) this.ts.mult *= def.shotDamageMult ?? 1;
    this.ts.extraShots += def.extraShots ?? 0;
    this.ts.triple ||= !!def.triple;
    this.ts.fly ||= !!def.fly;
    if (def.fly) c.flyCooldown = 2;
    return { ok: true, events: [{ type: "item", playerId: c.id, key, energyLeft: c.energy }] };
  }

  // ---------- tiro ----------

  private hitboxes(): Hitbox[] {
    return this.chars.filter(c => c.alive).map(c => ({ id: c.id, x: c.x, y: c.y, w: PLAYER_HITBOX.w, h: PLAYER_HITBOX.h, bottomOffset: PLAYER_HITBOX.bottomOffset }));
  }

  private doShoot(angleDeg: number, power: number, specialReq: boolean): Outcome {
    let special = specialReq;
    const c = this.current, cfg = this.cfg, T = this.terrain, weapon = own(WEAPONS, c.weaponId)!;
    if (!Number.isFinite(angleDeg) || !Number.isFinite(power)) return { ok: false, error: "valores inválidos" };
    if (this.ts.shotsFired > 0) special = this.ts.special; // o especial é decidido no primeiro tiro
    if (this.ts.shotsFired === 0 && special && c.fury < cfg.maxFury) return { ok: false, error: "fúria insuficiente" };
    const events: MatchEvent[] = [];
    const slope = T.slopeDeg(c.x, c.y, c.facing);
    const ang = clampAbsoluteAngle(angleDeg, this.ts.fly ? FLY_ANGLE : weapon.angle, slope);
    const pow = Math.min(100, Math.max(0, power));
    const wind = this.wind * weapon.windFactor;
    const ts = this.ts;

    // Lista de projéteis do disparo: cada elemento = um tiro simulado em sequência
    type Proj = { ang: number; mult: number; power: number };
    const base = ts.fly ? 1 : ts.mult * (special ? weapon.special.damageMult : 1);
    if (ts.shotsFired === 0) {
      ts.special = special;
      ts.shotsLeft = 1 + (ts.fly ? 0 : ts.extraShots + (special ? weapon.special.shots : 0));
    }
    ts.shotsFired++; ts.shotsLeft--;
    ts.clockStopped = true; ts.charging = false; ts.chargedThisShot = false; ts.idleSeconds = 0;
    const count = ts.fly ? 1 : special ? weapon.special.balls : ts.triple ? 3 : 1;
    // Living.ShootImp: o primeiro é central; os laterais usam força 0.9 e 1.1.
    // O ângulo absoluto do servidor é espelhado ao mirar para a esquerda.
    const volley: Proj[] = Array.from({ length: count }, (_, n) => ({
      ang: ang + (n === 1 ? 1 : n === 2 ? -1 : 0) * cfg.tripleSpreadDeg * c.facing,
      power: pow * (n === 1 ? 0.9 : n === 2 ? 1.1 : 1), mult: base,
    }));

    let index = 0;
    {
      const start = this.animationTime;
      const results = volley.map(p => ({ mult: p.mult, r: simulateShot(
        { x: c.x, y: c.y - MUZZLE_HEIGHT, angleDeg: p.ang, power: p.power, facing: c.facing, wind },
        (x, y) => T.isSolid(x, y), this.physics, { hitboxes: this.hitboxes(), shooterId: c.id, hitboxRadius: 3, outOfBounds: (x, y) => x < 0 || x >= T.width || y >= T.height }),
      }));
      // As bolas do leque saem juntas. Os impactos são aplicados em ordem de chegada.
      for (const { r, mult } of results) events.push({
        type: "shot", playerId: c.id, index: index++, points: r.points, hit: r.hit, hitKind: r.hitKind,
        targetId: r.targetId, damageMult: mult, ballId: ts.fly ? FLY_BALL_ID : special ? weapon.special.ballId : weapon.ballId, stepSeconds: this.physics.dt, duration: r.duration, at: start,
      });
      for (const { r, mult } of [...results].sort((a, b) => a.r.duration - b.r.duration)) {
        const effects: MatchEvent[] = [];
        if (ts.fly) this.flyTo(c, r.hit, effects);
        else if (r.hit) this.impact(c, weapon, r.hit, mult, special, effects);
        events.push(...effects.map(e => ({ ...e, at: start + r.duration })));
      }
      this.animationTime = Math.max(this.animationTime, start + Math.max(...results.map(({ r }) => r.duration)));
    }

    // (um tiro por intenção: o ângulo pode mudar entre os tiros)
    // A simulação original é síncrona por disparo; voos sobrepostos podem terminar em outra ordem visual.
    // Consolida o estado autoritativo após a última animação para replay/reconexão.
    for (const t of this.chars) events.push({ type: "stateSync", playerId: t.id, x: t.x, y: t.y, hp: t.hp, fury: t.fury, energy: t.energy, alive: t.alive });
    this.checkOver(events);
    if (ts.shotsLeft > 0 && !this.over && c.alive) return { ok: true, events: events.map(e => ({ ...e, at: e.at ?? this.animationTime })) };
    c.fury = Math.min(cfg.maxFury, (special ? 0 : c.fury) + cfg.furyOnAttack);
    events.push({ type: "fury", playerId: c.id, fury: c.fury });
    if (!this.over) events.push(...this.endTurn(false));
    return { ok: true, events: events.map(e => ({ ...e, at: e.at ?? this.animationTime })).sort((a, b) => a.at - b.at) };
  }

  private flyTo(c: Character, hit: { x: number; y: number } | null, events: MatchEvent[]): void {
    if (!hit) return;
    const x = Math.min(this.terrain.width - 2, Math.max(1, Math.floor(hit.x)));
    const g = this.terrain.surfaceY(x, Math.max(0, hit.y - 4));
    if (g < 0) return;
    c.x = x; c.y = g;
    events.push({ type: "fly", playerId: c.id, x, y: g });
  }

  private impact(shooter: Character, weapon: WeaponDef, hit: { x: number; y: number }, mult: number, special: boolean, events: MatchEvent[]): void {
    const cfg = this.cfg;
    const ballId = special ? weapon.special.ballId : weapon.ballId;
    const dmgRadius = special ? weapon.special.damageRadius : weapon.damageRadius;
    for (const t of this.chars) {
      if (!t.alive) continue;
      const ally = t.team === shooter.team; // como no Reborn: a bomba fere o atirador e os aliados
      if (ally && !cfg.friendlyFire) continue;
      // distância do impacto à caixa do alvo
      const dx = Math.max(t.x - PLAYER_HITBOX.w / 2 - hit.x, 0, hit.x - (t.x + PLAYER_HITBOX.w / 2));
      const bottom = t.y + PLAYER_HITBOX.bottomOffset;
      const dy = Math.max(bottom - PLAYER_HITBOX.h - hit.y, 0, hit.y - bottom);
      const d = Math.hypot(dx, dy);
      if (d >= dmgRadius) continue;
      const falloff = 1 - cfg.falloffEdge * (d / dmgRadius);
      const crit = rollCritical(shooter.stats.luck, this.combatRng.next());
      const input = { weapon, attacker: shooter.stats, target: t.stats, bonus: this.ts.bonus, shotMult: mult, falloff, crit };
      let amount = this.damageFn(input), shownCrit = crit;
      // Dano em si/aliado que mataria vira "vida − 1", com crítico zerado (mesma fórmula do Reborn)
      const spared = ally && amount >= t.hp;
      if (spared) { amount = Math.max(0, t.hp - 1); shownCrit = false; }
      t.hp = Math.max(ally ? 1 : 0, t.hp - amount);
      events.push({ type: "damage", playerId: t.id, amount, hp: t.hp, crit: shownCrit });
      const baseDamage = spared ? amount : this.damageFn === defaultDamage ? damageBreakdown(input).base : this.damageFn({ ...input, crit: false });
      if (t.hp > 0) t.fury = Math.min(cfg.maxFury, t.fury + furyFromDamage(baseDamage));
      events.push({ type: "fury", playerId: t.id, fury: t.fury });
      if (t.hp <= 0) { t.alive = false; events.push({ type: "death", playerId: t.id, reason: "hp" }); }
    }
    this.terrain.carveShape(hit.x, hit.y, craterShape(ballId));
    events.push({ type: "crater", x: hit.x, y: hit.y, ballId });
    for (const t of this.chars) this.settle(t, events); // o chão pode ter sumido sob alguém
  }

  // ---------- fim de turno / partida ----------

  private checkOver(events: MatchEvent[]): void {
    if (this.over) return;
    const teams = new Set(this.chars.filter(c => c.alive).map(c => c.team));
    if (teams.size <= 1) {
      this.winnerTeam = teams.size === 1 ? [...teams][0]! : null;
      events.push({ type: "gameOver", winnerTeam: this.winnerTeam });
    }
  }

  private endTurn(passed: boolean): MatchEvent[] {
    const c = this.current, cfg = this.cfg, events: MatchEvent[] = [];
    if (passed) {
      c.fury = Math.min(cfg.maxFury, c.fury + cfg.furyOnPass);
      events.push({ type: "fury", playerId: c.id, fury: c.fury });
    }
    const weapon = own(WEAPONS, c.weaponId)!;
    // PrepareShoot limita speedTime por GetTurnWaitTime(), que retorna o identificador
    // do modo (1..6), e não a duração em segundos retornada pela outra sobrecarga.
    const timeType = new Map([[5, 1], [7, 2], [10, 3], [15, 4], [20, 5], [30, 6]]).get(this.turnTimeLimit()) ?? this.turnTimeLimit();
    c.delay += this.ts.itemDelay + (passed ? cfg.delayPass :
      weapon.delay + weapon.ballDelay + Math.floor(Math.min(this.ts.elapsed, timeType)) * cfg.delayPerSecond);
    events.push({ type: "turnEnd", playerId: c.id, delay: c.delay });
    if (cfg.maxTurns > 0 && this.turn >= cfg.maxTurns && !this.over) {
      const hp = new Map<number, number>();
      for (const k of this.chars) if (k.alive) hp.set(k.team, (hp.get(k.team) ?? 0) + k.hp);
      const sorted = [...hp.entries()].sort((a, b) => b[1] - a[1]);
      this.winnerTeam = sorted.length === 0 || (sorted[1] && sorted[0]![1] === sorted[1][1]) ? null : sorted[0]![0];
      events.push({ type: "gameOver", winnerTeam: this.winnerTeam });
      return events;
    }
    this.current = this.pickNext();
    events.push(this.beginTurn());
    return events;
  }
}

function freshTurn(): TurnState {
  return { spent: 0, itemDelay: 0, bonus: 0, mult: 1, extraShots: 0, triple: false, fly: false, elapsed: 0, clockStopped: false, idleSeconds: 0, charging: false, chargedThisShot: false, shotsFired: 0, shotsLeft: 0, special: false };
}
