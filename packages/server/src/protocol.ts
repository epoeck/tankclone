/** Protocolo JSON sobre WebSocket. O servidor é autoritativo: o cliente só envia intenções e só anima eventos. */
import type { Intent, MatchEvent } from "@tankclone/core";

export type ClientIntent = Exclude<Intent, never> extends infer I ? (I extends { playerId: string } ? Omit<I, "playerId"> : never) : never;

export type ClientMsg =
  | { t: "auth"; mode: "register" | "login"; nick: string; password: string }
  | { t: "rooms" }
  | { t: "createRoom"; mapId: string; maxPlayers: number }
  | { t: "joinRoom"; roomId: string; team?: number }
  | { t: "leaveRoom" }
  | { t: "setLoadout"; weaponId?: string; build?: string }
  | { t: "start" }
  | { t: "intent"; intent: ClientIntent };

export interface RoomInfo {
  id: string;
  mapId: string;
  maxPlayers: number;
  status: "lobby" | "playing";
  players: Array<{ nick: string; team: number; weaponId: string; build: string; connected: boolean }>;
  host: string;
}

export interface MatchSetup {
  seed: number;
  mapId: string;
  players: Array<{ id: string; team: number; x: number; weaponId: string; build: string; facing: 1 | -1 }>;
}

export type ServerMsg =
  | { t: "authOk"; nick: string; level: number; xp: number; unlocks: string[] }
  | { t: "error"; msg: string }
  | { t: "rooms"; rooms: RoomInfo[] }
  | { t: "room"; room: RoomInfo | null }
  | { t: "start"; setup: MatchSetup; events: MatchEvent[] }
  /** Reconexão: mesmo setup + todo o log de eventos desde o início. */
  | { t: "resume"; setup: MatchSetup; events: MatchEvent[] }
  | { t: "events"; events: MatchEvent[] }
  | { t: "end"; winnerTeam: number | null; xp: Record<string, { gained: number; level: number }> };
