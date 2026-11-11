/** Salas e partidas. Lógica pura de servidor: recebe intenções, roda o Match do core e devolve eventos. Sem rede aqui. */
import { randomInt } from "node:crypto";
import { BUILDS, DEFAULT_BUILD, ITEMS, MAPS, Match, WEAPONS, own, type Intent, type MatchEvent } from "@tankclone/core";
import type { ClientIntent, MatchSetup, RoomInfo } from "./protocol";

export const MAX_ROOM_PLAYERS = 8;
export const XP_WIN = 50, XP_LOSE = 20;

export interface Member { nick: string; team: number; weaponId: string; build: string; connected: boolean }

export type Outbox = {
  /** Envia a todos os membros conectados da sala. */
  broadcast(room: Room, msg: unknown): void;
  /** Fim de partida: o servidor concede XP. Devolve ganho e nível por apelido. */
  awardXp(results: Array<{ nick: string; won: boolean }>): Record<string, { gained: number; level: number }>;
};

export class Room {
  status: "lobby" | "playing" = "lobby";
  readonly members = new Map<string, Member>();
  match: Match | null = null;
  setup: MatchSetup | null = null;
  log: MatchEvent[] = [];
  /** Instante (ms) até o qual o relógio do turno fica parado, para o cliente animar o tiro. */
  pausedUntil = 0;

  constructor(readonly id: string, readonly mapId: string, readonly maxPlayers: number, public host: string) {}

  info(): RoomInfo {
    return { id: this.id, mapId: this.mapId, maxPlayers: this.maxPlayers, status: this.status, host: this.host,
      players: [...this.members.values()].map(m => ({ ...m })) };
  }

  add(nick: string, team?: number): string | null {
    if (this.status !== "lobby") return "partida em andamento";
    if (this.members.size >= this.maxPlayers) return "sala cheia";
    const counts = new Map<number, number>();
    for (const m of this.members.values()) counts.set(m.team, (counts.get(m.team) ?? 0) + 1);
    const t = team === 1 || team === 2 ? team : (counts.get(1) ?? 0) <= (counts.get(2) ?? 0) ? 1 : 2;
    this.members.set(nick, { nick, team: t, weaponId: "sledge", build: DEFAULT_BUILD, connected: true });
    return null;
  }

  setLoadout(nick: string, weaponId?: string, build?: string): string | null {
    const m = this.members.get(nick);
    if (!m) return "você não está nesta sala";
    if (this.status !== "lobby") return "partida em andamento";
    if (weaponId !== undefined) { if (!own(WEAPONS, weaponId)) return "arma desconhecida"; m.weaponId = weaponId; }
    if (build !== undefined) { if (!own(BUILDS, build)) return "build desconhecida"; m.build = build; }
    return null;
  }

  start(nick: string, now: number): { error: string } | { setup: MatchSetup; events: MatchEvent[] } {
    if (nick !== this.host) return { error: "só o dono da sala inicia" };
    if (this.status !== "lobby") return { error: "partida já iniciada" };
    const teams = new Set([...this.members.values()].map(m => m.team));
    if (teams.size < 2) return { error: "é preciso ao menos um jogador em cada time" };
    const map = own(MAPS, this.mapId)!;
    const idx = new Map<number, number>();
    const players = [...this.members.values()].map(m => {
      const i = idx.get(m.team) ?? 0; idx.set(m.team, i + 1);
      const x = m.team === 1 ? 150 + i * 140 : map.width - 150 - i * 140;
      return { id: m.nick, team: m.team, x, weaponId: m.weaponId, build: m.build, facing: (m.team === 1 ? 1 : -1) as 1 | -1 };
    });
    this.setup = { seed: randomInt(1, 2 ** 31), mapId: this.mapId, players };
    this.match = buildMatch(this.setup);
    this.status = "playing";
    this.log = [...this.match.startEvents];
    this.pausedUntil = now;
    return { setup: this.setup, events: this.log };
  }

  /** Intenção de um jogador. Devolve eventos a transmitir ou um erro só para ele. */
  intent(nick: string, intent: ClientIntent, now: number): { error: string } | { events: MatchEvent[] } {
    if (!this.match || this.status !== "playing") return { error: "sem partida em andamento" };
    const bad = validateIntent(intent);
    if (bad) return { error: bad };
    if (now < this.pausedUntil) return { error: "aguarde a animação" };
    const out = this.match.submit({ ...intent, playerId: nick } as Intent);
    if (!out.ok) return { error: out.error };
    this.record(out.events, now);
    return { events: out.events };
  }

  /** Avança o relógio da partida (chamado ~10×/s). Passa a vez de quem estourou o tempo ou está desconectado. */
  tick(dtSec: number, now: number): MatchEvent[] {
    if (!this.match || this.status !== "playing" || now < this.pausedUntil) return [];
    const cur = this.members.get(this.match.currentId);
    let events: MatchEvent[];
    if (cur && !cur.connected) {
      const o = this.match.submit({ type: "pass", playerId: cur.nick });
      events = o.ok ? o.events : [];
    } else events = this.match.tick(dtSec);
    if (events.length) this.record(events, now);
    return events;
  }

  private record(events: MatchEvent[], now: number): void {
    this.log.push(...events);
    // pausa o relógio pelo tempo real da animação: trajetória a 60 passos/s + 0,5 s por tiro
    let pause = 0;
    for (const e of events) if (e.type === "shot") pause += e.points.length / 60 + 0.5;
    if (pause) this.pausedUntil = now + pause * 1000;
  }

  get over(): boolean { return !!this.match?.over; }

  /** Encerra a partida (já `over`): concede XP e volta ao saguão. */
  finish(out: Outbox): { winnerTeam: number | null; xp: Record<string, { gained: number; level: number }> } {
    const winner = this.match!.winnerTeam ?? null;
    const xp = out.awardXp([...this.members.values()].map(m => ({ nick: m.nick, won: winner !== null && m.team === winner })));
    this.status = "lobby"; this.match = null; this.setup = null; this.log = [];
    return { winnerTeam: winner, xp };
  }
}

export function buildMatch(setup: MatchSetup): Match {
  return new Match({
    seed: setup.seed, terrain: own(MAPS, setup.mapId)!.build(),
    players: setup.players.map(p => ({ id: p.id, team: p.team, x: p.x, weaponId: p.weaponId, facing: p.facing, stats: own(BUILDS, p.build) })),
  });
}

export function validateIntent(i: ClientIntent): string | null {
  if (typeof i !== "object" || i === null) return "intenção inválida";
  switch (i.type) {
    case "move": return (i.dir === 1 || i.dir === -1) && Number.isFinite(i.px) && i.px >= 0 && i.px <= 1000 ? null : "movimento inválido";
    case "item": return own(ITEMS, i.key) ? null : "item inválido";
    case "shoot": return Number.isFinite(i.angleDeg) && Number.isFinite(i.power) ? null : "tiro inválido";
    case "pass": return null;
    default: return "intenção desconhecida";
  }
}

export class Lobby {
  readonly rooms = new Map<string, Room>();
  private byNick = new Map<string, string>();
  private n = 0;

  create(host: string, mapId: string, maxPlayers: number): Room | string {
    if (this.byNick.has(host)) return "você já está em uma sala";
    if (!own(MAPS, mapId)) return "mapa desconhecido";
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > MAX_ROOM_PLAYERS) return `máximo de jogadores: 2 a ${MAX_ROOM_PLAYERS}`;
    const room = new Room(`S${++this.n}`, mapId, maxPlayers, host);
    room.add(host, 1);
    this.rooms.set(room.id, room);
    this.byNick.set(host, room.id);
    return room;
  }

  join(nick: string, roomId: string, team?: number): Room | string {
    if (this.byNick.has(nick)) return "você já está em uma sala";
    const room = this.rooms.get(roomId);
    if (!room) return "sala não encontrada";
    const err = room.add(nick, team);
    if (err) return err;
    this.byNick.set(nick, roomId);
    return room;
  }

  roomOf(nick: string): Room | undefined { const id = this.byNick.get(nick); return id ? this.rooms.get(id) : undefined; }

  /** Sai da sala. Em partida, o jogador fica marcado como desconectado (pode reconectar). */
  leave(nick: string, hard = false): Room | undefined {
    const room = this.roomOf(nick);
    if (!room) return undefined;
    const m = room.members.get(nick)!;
    if (room.status === "playing") {
      m.connected = false; // o boneco continua no Match e passa a vez sozinho
      if (hard) this.byNick.delete(nick); // desistência: libera o jogador para outras salas, sem reconexão
      return room;
    }
    room.members.delete(nick); this.byNick.delete(nick);
    if (![...room.members.values()].some(x => x.connected)) { this.rooms.delete(room.id); this.forget(room); return room; }
    if (room.host === nick) room.host = [...room.members.values()].find(x => x.connected)!.nick;
    return room;
  }

  /** Solta o vínculo apelido→sala, só se ainda apontar para esta sala. */
  private forget(room: Room): void {
    for (const k of room.members.keys()) if (this.byNick.get(k) === room.id) this.byNick.delete(k);
  }

  /** Remove salas de partida em que ninguém está conectado. */
  prune(): void {
    for (const r of [...this.rooms.values()]) {
      if (![...r.members.values()].some(m => m.connected)) { this.rooms.delete(r.id); this.forget(r); }
    }
  }
}
